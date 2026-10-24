import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import vm from 'node:vm';
import {ReviewController} from '../lib/review-controller.js';
import {recentContext,mountNative,preferenceDefaults} from '../lib/native.js';
import {DurableReviewStore} from '../lib/durable-store.js';
const memory=()=>({reviews:[],save(){}}),selection=()=>({provider:'test',model:'model'});
const binding={sessionId:'session-native',commandId:'cmd',operationId:'operation',requestHash:'hash',question:'看看风险',replyLength:'standard',context:[],contextOmitted:0};
const stream=async function*(){yield{type:'text-delta',text:'先验证需求。\n\n不要扩大范围。'};yield{type:'finish',reason:{kind:'stop'}}};
test('native blue and black produce one plain reply without JSON validation, cards or tools',async()=>{
 for(const hat of ['blue','black']){const requests=[],c=new ReviewController({selection,stream:async function*(o){requests.push(o);yield*stream()}},memory());const r=c.start('看看风险','当前方案','hat-chat',hat,structuredClone(binding));await c.settled();assert.equal(r.state,'completed');assert.equal(r.calls.length,1);assert.equal(r.card,null);assert.equal(r.messages.at(-1).text,'先验证需求。\n\n不要扩大范围。');assert.deepEqual(requests[0].tools,[]);assert(!requests[0].system.includes('合法 JSON'));assert(requests[0].messages[0].content[0].text.includes('看看风险'));}
});
test('native cancellation retains partial, no automatic dispatch, explicit resume preserves mode',async()=>{
 let n=0,seen;const c=new ReviewController({selection,stream:async function*(o){n++;if(n===1){yield{type:'text-delta',text:'部分建议'};await new Promise(r=>{seen=r;o.signal.addEventListener('abort',r,{once:true})})}else yield*stream()}},memory());const r=c.start('问题','方案','hat-chat','black',structuredClone(binding));while(!seen)await new Promise(r=>setTimeout(r,1));c.cancel();await c.settled();assert.equal(n,1);assert.equal(r.calls[0].text,'部分建议');c.resume(r.id,'resume-once');c.resume(r.id,'resume-once');await c.settled();assert.equal(r.mode,'hat-chat');assert.equal(r.state,'completed');assert.equal(n,2);assert.equal(r.calls[0].text,'部分建议');
});
test('native context is current-session visible text, ordered, at most 20 complete messages',()=>{
 const events=Array.from({length:24},(_,seq)=>({type:'user/message',seq,data:{source:{kind:'user'},content:[{type:'text',text:'文本'+seq}]}}));events.push({type:'user/message',seq:30,data:{source:{kind:'file-instruction'},content:[{type:'text',text:'隐藏提示'}]}});events.push({type:'tool/result',seq:31,data:{message:{content:[{type:'text',text:'工具机密'}]}}});const c={reviews:[]};let result=recentContext({id:'this',snapshotEvents:()=>events},c);assert.equal(result.context.length,20);assert.equal(result.context[0].text,'文本4');assert.equal(result.contextOmitted,4);assert(!JSON.stringify(result).includes('隐藏提示'));assert(!JSON.stringify(result).includes('工具机密'));
 result=recentContext({id:'this',snapshotEvents:()=>[{type:'user/message',seq:1,data:{source:{kind:'user'},content:[{type:'text',text:'长'.repeat(24001)}]}}]},c);assert.equal(result.context.length,0);assert.equal(result.contextOmitted,1);
});
test('native context includes only this conversation hat questions and replies',()=>{
 const c={reviews:[{native:{sessionId:'this',commandId:'x',question:'当前问题'},materialMessageId:'m',stages:[{hat:'green'}],messages:[{id:'answer',kind:'analysis',text:'当前建议'}]},{native:{sessionId:'other',commandId:'x',question:'别人的问题'}}]};const result=recentContext({id:'this',snapshotEvents:()=>[{seq:3,type:'command/run',data:{name:'hexamind',commandId:'x'}}]},c);assert.deepEqual(result.context.map(i=>i.text),['当前问题','当前建议']);
});
test('native command admission deduplicates same operation, survives recreation and rejects conflicting replay',async()=>{
 const c=new ReviewController({selection,stream},memory());let handler,count=0;const session={id:'session-native',snapshotEvents:()=>[]};const ctx={commands:{register(d){handler=d.handler;return()=>{}},async execute(agent,line){count++;return {commandId:'cmd',result:await handler({agent,commandId:'cmd',rawInput:line.slice('/hexamind'.length),signal:new AbortController().signal})}}},agents:{get:id=>id===session.id?{id}:undefined},sessions:{get:()=>session,flush:async()=>true}};
 const mount=()=>mountNative(ctx,c,()=>preferenceDefaults);let bridge=mount();const request={sessionId:session.id,hat:'black',text:'当前计划',operationId:'one'};const [a,b]=await Promise.all([bridge.submit(request),bridge.submit(request)]);assert.equal(a.reviewId,b.reviewId);assert.equal(count,1);bridge.dispose();bridge=mount();await bridge.submit(request);assert.equal(count,1);await assert.rejects(bridge.submit({...request,text:'不同请求'}),/OPERATION_CONFLICT/);await assert.rejects(bridge.submit({...request,operationId:'two',sessionId:'unknown'}),/NOT_FOUND/);bridge.dispose();
});
test('native admission returns after durable acceptance while generation remains running; completion stays compatible',async()=>{
 let release,handler,commands=0,flushes=0;
 const gate=new Promise(r=>{release=r});
 const c=new ReviewController({selection,stream:async function*(){yield {type:'text-delta',text:'已经开始'};await gate;yield*stream()}},memory());
 const session={id:'session-native',snapshotEvents:()=>[]};
 const ctx={commands:{register(d){handler=d.handler;return()=>{}},async execute(agent,line){commands++;return {commandId:'accepted-command',result:await handler({agent,commandId:'accepted-command',rawInput:line.slice('/hexamind'.length),signal:new AbortController().signal})}}},agents:{get:()=>({id:session.id})},sessions:{get:()=>session,async flush(){flushes++;return true}}};
 const bridge=mountNative(ctx,c,()=>preferenceDefaults),request={sessionId:session.id,hat:'green',text:'公开测试计划',operationId:'accept-one'};
 try{
  const accepted=await Promise.race([bridge.accept(request),new Promise((_,reject)=>setTimeout(()=>reject(Error('admission waited for model completion')),250))]);
  assert.equal(accepted.accepted,true);assert.equal(accepted.reviewId,c.reviews[0].id);assert.equal(c.reviews[0].state,'running');assert(flushes>0);
  const duplicate=await bridge.accept(request);assert.equal(duplicate.reviewId,accepted.reviewId);assert.equal(commands,1);
  let settled=false;const completion=bridge.submit(request).then(r=>{settled=true;return r});await Promise.resolve();assert.equal(settled,false);
  release();assert.equal((await completion).state,'completed');assert.equal(commands,1);assert.equal(c.reviews[0].calls.length,1);
 }finally{release();await c.settled();bridge.dispose();}
});
test('native admission refuses unsaved requests and rejects concurrent different operations before dispatch',async()=>{
 let handler,release;const gate=new Promise(r=>release=r),c=new ReviewController({selection,stream},memory());
 const ctx={commands:{register(d){handler=d.handler;return()=>{}},async execute(agent,line){await gate;return {commandId:'x',result:await handler({agent,commandId:'x',rawInput:line.slice('/hexamind'.length),signal:new AbortController().signal})}}},agents:{get:()=>({id:'session-native'})},sessions:{get:()=>({snapshotEvents:()=>[]}),flush:async()=>false}};
 const bridge=mountNative(ctx,c,()=>preferenceDefaults),request={sessionId:'session-native',hat:'black',text:'测试',operationId:'unsaved'};
 try{const accepted=bridge.accept(request);await assert.rejects(bridge.accept({...request,operationId:'other'}),/BUSY/);release();await assert.rejects(accepted,/SESSION_FLUSH_FAILED/);}finally{release();await c.settled();bridge.dispose();}
});
test('native v3 migration preserves records and an exact immutable backup',()=>{const dir=mkdtempSync(join(tmpdir(),'hexamind-native-')),file=join(dir,'store.json');try{const reviews=[],raw=JSON.stringify({schemaVersion:3,generation:8,checksum:createHash('sha256').update(JSON.stringify(reviews)).digest('hex'),reviews});writeFileSync(file,raw);const store=new DurableReviewStore(file);assert.equal(store.info.schemaVersion,4);assert.equal(store.info.generation,9);assert.equal(readFileSync(file+'.v3-backup','utf8'),raw);store.close();}finally{rmSync(dir,{recursive:true,force:true})}});
function ui(extra={}){const sandbox={errors:{},require:()=>({MarkdownText:()=>null}),...extra};vm.runInNewContext(readFileSync(new URL('../src/native-ui.cjs',import.meta.url),'utf8')+'\nglobalThis.testApi={nativeRoute,NativeInputGuard,applyNative,createHatDiscussion,NativeReply};',sandbox);return sandbox.testApi;}
test('native route accepts only a leading known hat; quoted, fenced, email and inline mentions remain ordinary',()=>{const {nativeRoute}=ui();assert.equal(nativeRoute('@黑帽 当前计划').hat,'black');assert.equal(nativeRoute('@GREEN 更多方案').hat,'green');assert.equal(nativeRoute('@评审 材料').hat,'structured');for(const text of ['请 @黑帽 看看','> @黑帽 看看','```\n@黑帽 看看','a@black.example','@unknown 问题'])assert.equal(nativeRoute(text),null);});
test('pasted prefix is claimed using the public revision-guarded input event, never a global DOM listener',async()=>{
 for(const draft of ['@黑帽 粘贴全文','@绿帽 下一步','@黑帽']){let called=0,cleanup;const state={draft,draftRev:8,phase:'plain'};const input={state:{getSnapshot:()=>state,subscribe(){return()=>{}}}};const actx={bail(self,event,request){called++;assert.equal(self,actx);assert.equal(event,'slash/input-begin-command');assert.equal(request.span.draftRev,8);assert.equal(request.span.end,3);state.phase='claimed';return true}};const api=ui({useEffect:fn=>{cleanup=fn()},queueMicrotask});api.NativeInputGuard({input,actx,session:{sessionId:'s'},claim:()=>({token:'@黑帽 '})});await Promise.resolve();assert.equal(called,1);cleanup();}
});
test('unfinished Chinese text and inline quoted mentions never auto-claim',async()=>{
 for(const draft of ['@','@黑','@黑帽子 ','请 @黑帽 评审','> @黑帽 评审','```\n@黑帽 评审']){let count=0,cleanup;const input={state:{getSnapshot:()=>({draft,draftRev:1,phase:'plain'}),subscribe:()=>()=>{}}};const api=ui({useEffect:fn=>{cleanup=fn()},queueMicrotask});api.NativeInputGuard({input,actx:{bail(){count++}},session:{sessionId:'s'},claim:()=>({})});await Promise.resolve();assert.equal(count,0,draft);cleanup();}
});
test('native advice activates command-only Chat, uses known command events and leaves other commands alone',async()=>{
 let definition,source;const entries=[];const scope={getSnapshot:()=>({value:{enabled:true,enabledHats:['black']}})};
 const ctx={effect(fn){return fn()},configForms:{get:()=>scope},inputTriggers:{registerSource(s){source=s;return()=>{}}},uiConversation:{events:{register(d){definition=d;return()=>{}}}},slots:{inject(_name,fn){return fn()},register(entry,component){entries.push({entry,component});return()=>{}}}};
 const api=ui({document:{createElement:()=>({remove(){}}),head:{append(){}}}});api.applyNative(ctx);
 assert.equal(definition.match({type:'command/run',data:{name:'other',commandId:'x'}}),null);
 const event={type:'command/run',seq:7,time:1,data:{name:'hexamind',commandId:'hat1'}};assert.equal(definition.match(event).role,'start');const match={event,location:{kind:'unresolved'}};const state=definition.start({},match);const node=definition.buildViewNode({key:'key',id:'hat1',state,start:match});assert.equal(node.target,'chat');assert.notEqual(node.kind,'command');assert.equal(node.anchorSeq,7);assert.equal(definition.match({type:'command/done',data:{commandId:'x'}}),null);assert(entries.some(e=>e.entry.key==='hexamind-advice'));assert(entries.some(e=>e.entry.name==='settings.section'));
 assert.equal((await source.candidates({}, {position:'leading',query:''})).length,6);assert.equal((await source.candidates({}, {position:'inline',query:''})).length,0);assert((await source.candidates({}, {position:'leading',query:'评审'})).some(c=>c.value==='structured'));const selected=source.onPick({session:{sessionId:'s'},candidate:{value:'black',name:'黑帽'}});assert.equal(selected.claim.token,'@黑帽 ');assert.equal(selected.claim.attachments,false);
});
test('new hat discussion creates a distinct native Session without model work or workspace reuse',async()=>{
 const calls=[];const ctx={workspaces:{list:{getSnapshot:()=>({items:[{workspaceId:'workspace',sessionIds:['old-session']}]})}},sessions:{async create(request){calls.push(['create',request.workspaceId]);return 'new-session'}},uiWorkspace:{async openSession(id){calls.push(['open',id])}}};const {createHatDiscussion,nativeRoute}=ui();assert.equal(nativeRoute('@新讨论').hat,'new-discussion');assert.equal(await createHatDiscussion(ctx,'old-session'),'new-session');assert.deepEqual(calls,[['create','workspace'],['open','new-session']]);
});
test('composer completes on accepted request, retains errors before admission and retries with the same operation id',async()=>{
 let source;const sent=[];let refuse=false;
 const ctx={effect:fn=>fn(),configForms:{get:()=>({getSnapshot:()=>({value:{}})})},inputTriggers:{registerSource(s){source=s}},uiConversation:{events:{register(){}}},slots:{inject(_name,fn){fn()},register(){}}};
 ui({document:{createElement:()=>({remove(){}}),head:{append(){}}},crypto:{randomUUID:()=> 'stable-operation'},api:async(path,data)=>{sent.push(data);if(refuse)throw Error('已有任务进行中');return {accepted:true,state:'running',reviewId:'live'}}}).applyNative(ctx);
 const claim=source.onPick({session:{sessionId:'s'},candidate:{value:'black',name:'黑帽'}}).claim;
 assert.equal((await claim.submit('计划',{},[])).kind,'success');assert.equal(sent[0].kind,'nativeStart');
 refuse=true;assert.equal((await claim.submit('计划',{},[])).kind,'error');assert.equal(sent[0].request.operationId,sent[1].request.operationId);
 assert.equal((await claim.submit('',{},[])).kind,'error');assert.equal(sent.length,2);
});
test('stopping before the first token does not render the command error as a model reply or offer to copy it',()=>{
 const r={state:'cancelled',mode:'hat-chat',stages:[{hat:'blue'}],calls:[{text:'',selection:{provider:'test',model:'model'}}],native:{question:'停止验证',context:[]}};
 const states=[undefined,{review:r,preferences:{}},'',false,false];let i=0;
 const {NativeReply}=ui({labels:{cancelled:'已停止'},useState:()=>[states[i++],()=>{}],useEffect(){},h:(type,props,...children)=>({type:typeof type==='string'?type:'Markdown',props,children})});
 const tree=JSON.stringify(NativeReply({node:{commandId:'c',outcome:{kind:'error',text:'COMMAND_ERROR_SENTINEL'}}}));
 assert(!tree.includes('COMMAND_ERROR_SENTINEL'));assert(!tree.includes('复制回复'));assert(tree.includes('未收到回复正文'));
});
