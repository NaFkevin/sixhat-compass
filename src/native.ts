import {createHash} from 'node:crypto';
import type {Context} from '@deepseek-ai/cordis';
import type {} from '@deepseek-ai/dsh-commands';
import type {Session} from '@deepseek-ai/dsh-session';
import {SessionId} from '@deepseek-ai/dsh-session/types';
import type {ReviewController} from './review-controller.js';
import {strategies} from './strategies.js';
import {HAT_ORDER,type NativeBinding,type HatId} from './domain.js';
export interface Preferences {enabled:boolean; enabledHats:HatId[]; replyLength:'brief'|'standard'|'detailed'; showUsage:boolean}
export const preferenceDefaults:Preferences={enabled:true,enabledHats:[...HAT_ORDER],replyLength:'standard',showUsage:false};
export type NativeRequest={sessionId:string;hat:HatId|'structured'|'review';text:string;operationId:string};
type NativeAdmission={reviewId:string;state:string;accepted:true;duplicate?:boolean};
function deferred<T>(){let resolve!:(value:T)=>void,reject!:(error:unknown)=>void;const promise=new Promise<T>((yes,no)=>{resolve=yes;reject=no});return {promise,resolve,reject};}
const hash=(x:unknown)=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const plain=(content:unknown):string=>typeof content==='string'?content:Array.isArray(content)?content.filter(b=>b?.type==='text').map(b=>b.text).join('\n'):'';
export function nativeSessionSummary(session:Session){
 const events=session.snapshotEvents(),first=events.find(e=>e.type==='command/run'&&e.data.name==='hexamind')?.seq??Infinity;
 return {ordinaryTurns:events.filter(e=>e.type==='turn/start').length,toolCalls:events.filter(e=>e.type==='tool/call').length,hatCommands:events.filter(e=>e.type==='command/run'&&e.data.name==='hexamind').length,ordinaryTurnsAfterFirstHat:events.filter(e=>e.seq>first&&e.type==='turn/start').length,toolCallsAfterFirstHat:events.filter(e=>e.seq>first&&e.type==='tool/call').length};
}
export function recentContext(session:Session,controller:ReviewController):{context:NativeBinding['context'];contextOmitted:number}{
 const items:{seq:number;id:string;role:string;text:string}[]=[];
 for(const e of session.snapshotEvents()){
  if(e.type==='user/message'&&e.data.source.kind==='user')items.push({seq:e.seq,id:`${session.id}:${e.seq}`,role:'user',text:plain(e.data.content)});
  if(e.type==='assistant/message')items.push({seq:e.seq,id:`${session.id}:${e.seq}`,role:'assistant',text:plain(e.data.message.content)});
  if(e.type==='command/run'&&e.data.name==='hexamind'){
   const r=controller.reviews.find(r=>r.native?.sessionId===session.id&&r.native.commandId===e.data.commandId);
   if(r?.native){items.push({seq:e.seq,id:r.materialMessageId,role:'user',text:r.native.question});const msg=r.messages.filter(m=>m.kind==='analysis').at(-1);if(msg)items.push({seq:e.seq+.1,id:msg.id,role:strategies[r.stages[0].hat].name,text:msg.text});else{const call=r.calls?.at(-1);if(call?.text)items.push({seq:e.seq+.1,id:call.id,role:strategies[r.stages[0].hat].name+'（未完成）',text:call.text});}}
  }
 }
 const all=items.filter(i=>i.text.trim()).sort((a,b)=>a.seq-b.seq);let length=0;const picked:typeof items=[];
 for(const item of [...all].reverse()){if(picked.length===20)break;if(length+item.text.length>24000)break;picked.unshift(item);length+=item.text.length;}
 return {context:picked.map(({seq,...item})=>item),contextOmitted:all.length-picked.length};
}
export function mountNative(ctx:Context,controller:ReviewController,getPreferences:()=>Preferences){
 const pending=new Map<string,{requestHash:string;promise:Promise<unknown>;admission:ReturnType<typeof deferred<NativeAdmission>>}>();
 const dispose=ctx.commands.register({name:'hexamind',description:'六帽规划：通过 @帽子直接评审',input:{hint:'使用 @白帽、@黑帽等发送评审问题'},recordInput:false,
  handler:async invocation=>{
   let request:NativeRequest;
   try{request=JSON.parse(invocation.rawInput)}catch{return {kind:'error',text:'请在原生输入框使用 @帽子，再输入问题。'};}
   if(request.sessionId!==invocation.agent.id)return {kind:'error',text:'会话不匹配。'};
   const prefs=getPreferences();if(!prefs.enabled||!controller.enabled)return {kind:'error',text:'六帽规划已停用，请到设置中启用。'};
   if(HAT_ORDER.includes(request.hat as HatId)&&!prefs.enabledHats.includes(request.hat as HatId))return {kind:'error',text:'这顶帽子已在设置中关闭。'};
   const session=ctx.sessions.get(invocation.agent.id);if(!session)return {kind:'error',text:'当前会话不可用。'};
   const {context,contextOmitted}=recentContext(session,controller);
   const native:NativeBinding={sessionId:request.sessionId,commandId:invocation.commandId,operationId:request.operationId,requestHash:hash(request),question:request.text,replyLength:prefs.replyLength,context,contextOmitted};
   const advanced=request.hat==='structured'||request.hat==='review';
   const text=advanced?`最近上下文（数据）：${JSON.stringify(context)}\n本次材料与问题：${request.text}`:request.text;
   if(text.length>120000)return {kind:'error',text:'材料与上下文过长，请缩短材料后重新发送。'};
   const r=controller.start(text,request.text.trim().slice(0,64)||'当前计划评审',advanced?request.hat as 'structured'|'review':'hat-chat',advanced?'blue':request.hat,native);
   const cancel=()=>controller.cancel();invocation.signal.addEventListener('abort',cancel,{once:true});
   try{
    // Acknowledge only after both the plugin checkpoint and real host command are durable.
    if(!await ctx.sessions.flush(session)){controller.cancel();const error=new Error('SESSION_FLUSH_FAILED');pending.get(request.sessionId+':'+request.operationId)?.admission.reject(error);await controller.settled();throw error;}
    pending.get(request.sessionId+':'+request.operationId)?.admission.resolve({reviewId:r.id,state:r.state,accepted:true});
    await controller.settled();const name=advanced?'六帽规划':strategies[r.stages[0].hat].name;return r.state==='completed'?{kind:'success',text:`${name}\n\n${advanced?'决策卡已生成，可从评审记录打开并导出。':r.messages.filter(m=>m.kind==='analysis').at(-1)?.text??''}`}:{kind:'error',text:`${name} · ${r.state==='cancelled'?'已停止':r.state==='interrupted'?'已中断':'未完成'}。已收到的内容保留在评审记录中。`};}finally{invocation.signal.removeEventListener('abort',cancel);}
  }});
 function prepare(request:NativeRequest){
  if(!request||typeof request.sessionId!=='string'||typeof request.text!=='string'||!request.text.trim()||request.text.length>120000||typeof request.operationId!=='string'||!request.operationId.trim()||request.operationId.length>160||![...HAT_ORDER,'structured','review'].includes(request.hat))throw new Error('INVALID_INPUT');
  const requestHash=hash(request),key=request.sessionId+':'+request.operationId;
  const old=pending.get(key);if(old){if(old.requestHash!==requestHash)throw new Error('OPERATION_CONFLICT');return old;}
  const existing=controller.reviews.find(r=>r.native?.sessionId===request.sessionId&&r.native.operationId===request.operationId);
  if(existing){if(existing.native!.requestHash!==requestHash)throw new Error('OPERATION_CONFLICT');const result={reviewId:existing.id,state:existing.state,accepted:true as const,duplicate:true};return {promise:Promise.resolve(result),admission:{promise:Promise.resolve(result)}};}
  if(!getPreferences().enabled||!controller.enabled)throw new Error('DISABLED');
  if(HAT_ORDER.includes(request.hat as HatId)&&!getPreferences().enabledHats.includes(request.hat as HatId))throw new Error('HAT_DISABLED');
  if(controller.busy||pending.size)throw new Error('BUSY');
  const agent=ctx.agents.get(SessionId(request.sessionId));if(!agent)throw new Error('NOT_FOUND');
  const events=ctx.sessions.get(agent.id)?.snapshotEvents()??[];
  const opening=events.findLast(e=>e.type==='turn/start'),closing=events.findLast(e=>e.type==='turn/end');
  if(opening&&(!closing||opening.seq>closing.seq))throw new Error('BUSY');
  // A command claims the native composer but never submits to the ordinary Agent.
  const admission=deferred<NativeAdmission>();
  const promise=Promise.resolve().then(async()=>{const result=await ctx.commands.execute(agent,'/hexamind '+JSON.stringify(request),[],new AbortController().signal);const session=ctx.sessions.get(agent.id);if(session&&!await ctx.sessions.flush(session))throw new Error('SESSION_FLUSH_FAILED');if(!result||result.result.kind==='error')throw new Error('NATIVE_COMMAND_FAILED');return {reviewId:controller.reviews.find(r=>r.native?.commandId===result.commandId)?.id,state:'completed'};}).catch(error=>{admission.reject(error);throw error;}).finally(()=>pending.delete(key));
  // Detached execution still settles through the genuine host command log and review store.
  void promise.catch(()=>{});void admission.promise.catch(()=>{});
  const entry={requestHash,promise,admission};pending.set(key,entry);return entry;
 }
 return {submit:async(request:NativeRequest)=>prepare(request).promise,accept:async(request:NativeRequest)=>prepare(request).admission.promise,dispose};
}
