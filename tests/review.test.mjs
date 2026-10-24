import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {ReviewController} from '../lib/review-controller.js';
import {FileReviewStore} from '../lib/store.js';
import {validateCard,exportMarkdown} from '../lib/card.js';
import {mentionIds,resolveHat} from '../lib/mentions.js';
const memory=()=>({reviews:[],save(){}});
const tick=()=>new Promise(r=>setImmediate(r));
function response(o){
 const data=JSON.parse(o.messages[0].content[0].text.match(/\n(\[[\s\S]*\])\n/)[1]);
 const refs=data.map(m=>m.id),material=data.find(m=>m.kind==='material').id;
 if(o.system.includes('输出决策卡 JSON'))return {schemaVersion:1,decision:'先验证安装与需求',claims:[{id:'c1',text:'首发应聚焦验证',origin:'ai-analysis',verification:'unverified',sourceMessageIds:[refs.at(-1)],evidenceIds:[]},{id:'c2',text:'用户计划开发插件',origin:'user-material',verification:'unverified',sourceMessageIds:[material],evidenceIds:[]}],assumptions:['存在需求'],risks:['兼容性变化导致安装失败'],alternatives:['先固定流程'],disagreements:['是否需要完整群聊'],experiments:[{action:'在干净环境安装发行包',metric:'成功安装人数',passCondition:'3人全部安装成功'}],humanDecision:null};
 return {summary:'限定任务分析',observations:[{text:'验证独立安装',sourceMessageIds:[material]}],questions:['目标用户是谁？']};
}
function adapter(handler){let n=0;return {selection:()=>({provider:'test',model:'model'}),async *stream(o){const value=handler?handler(o,n++):response(o);if(value instanceof Error){yield{type:'finish',reason:{kind:'error',failure:{code:value.message}}};return;}yield{type:'text-delta',text:typeof value==='string'?value:JSON.stringify(value)};yield{type:'usage',usage:{inputTokens:10,outputTokens:20,totalTokens:30}};yield{type:'finish',reason:{kind:'stop'}}}};}
test('six normal calls, independent four hats, targeted followup and export cost zero',async()=>{
 const requests=[];const a=adapter(o=>{requests.push(o);return response(o)}),store=memory(),c=new ReviewController(a,store);
 const r=c.start('完整原始计划','是否发布','review');await c.settled();
 assert.equal(r.state,'completed');assert.equal(r.calls.length,6);assert.deepEqual(r.stages.map(s=>s.hat),['white','red','black','yellow','green','blue']);
 const white=r.stages[0].messageId;
 for(const call of r.calls.slice(1,5))assert.deepEqual(call.contextMessageIds,[r.materialMessageId,white]);
 assert.equal(r.calls[5].contextMessageIds.length,6);assert.equal(r.card.humanDecision,null);assert(requests.every(o=>o.tools.length===0));
 const material=r.messages[0];
 // Followup parser input has a different prefix; supply a valid reply directly.
 c.adapter.stream=async function*(o){assert(o.messages[0].content[0].text.includes('c1'));yield{type:'text-delta',text:JSON.stringify({summary:'追问实验',observations:[{text:'邀请3人安装',sourceMessageIds:[material.id]}],questions:[]})};yield{type:'finish',reason:{kind:'stop'}}};
 c.followup(r.id,'c1','@黑帽 如何验证？','white');await c.settled();
 assert.equal(r.calls.length,7);assert.equal(r.calls[6].purpose,'followup');assert.equal(r.calls[6].hat,'black');assert.equal(r.calls[6].targetClaimId,'c1');assert.equal(r.followups[0].state,'completed');assert.equal(r.cardVersion,1);
 const before=r.calls.length;assert(exportMarkdown(r).includes('当前决策'));assert.equal(r.calls.length,before);
});
test('invalid JSON repair consumes one stage retry; total budget capped at two',async()=>{
 let stageCounts=new Map();const a=adapter((o)=>{const key=o.system.slice(0,8);const n=stageCounts.get(key)||0;stageCounts.set(key,n+1);return n===0?'not json':response(o)});
 const c=new ReviewController(a,memory()),r=c.start('材料','目标','review');await c.settled();
 assert.equal(r.state,'failed');assert.equal(r.automaticRetries,2);assert.equal(r.calls.filter(x=>x.purpose==='auto-retry').length,2);assert.equal(r.stages[0].state,'completed');assert.equal(r.stages[1].state,'completed');assert.equal(r.stages[2].state,'failed');assert.equal(r.calls.length,5);
});
test('transient retry permitted, auth and unknown model never retried',async()=>{
 for(const err of ['AUTH','UNKNOWN_MODEL']){const c=new ReviewController(adapter(()=>new Error(err)),memory()),r=c.start('材料','目标','review');await c.settled();assert.equal(r.calls.length,1);assert.equal(r.state,'failed');}
 const c=new ReviewController(adapter((o,n)=>n===0?new Error('RATE_LIMIT'):response(o)),memory()),r=c.start('材料','目标','review');await c.settled();assert.equal(r.state,'completed');assert.equal(r.calls.length,7);assert.equal(r.automaticRetries,1);
});
test('failure preserves successful stages and manual recovery only repeats incomplete stage',async()=>{
 let bad=true;const c=new ReviewController(adapter((o,n)=>bad&&n===2?new Error('AUTH'):response(o)),memory()),r=c.start('材料','目标','review');await c.settled();assert.equal(r.stages[1].state,'completed');assert.equal(r.state,'failed');bad=false;c.resume(r.id);await c.settled();assert.equal(r.state,'completed');assert.equal(r.calls.length,7);assert.equal(r.calls[3].purpose,'manual-retry');assert.equal(r.stages[0].state,'completed');
});
test('cancellation releases even uncooperative stream, no late text and no next role',async()=>{
 let release;const gate=new Promise(r=>release=r);const a={selection:()=>({provider:'test',model:'m'}),async *stream(){await gate;yield{type:'text-delta',text:'late'};yield{type:'finish',reason:{kind:'stop'}}}};
 const c=new ReviewController(a,memory()),r=c.start('材料','目标','review');await tick();c.cancel();await c.settled();assert.equal(r.state,'cancelled');assert.equal(r.calls.length,1);release();await tick();assert.equal(r.calls[0].text,'');assert.equal(c.busy,false);assert.equal(r.stages[1].state,'pending');
});
test('restart marks unfinished work interrupted without invoking model',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'hexamind-store-')),file=join(dir,'reviews.json');
 try{const store=new FileReviewStore(file),r={schemaVersion:1,id:'r',state:'running',calls:[{state:'running'}],stages:[{state:'running'}],messages:[],followups:[{state:'running'}]};store.reviews.push(r);store.save();const restored=new FileReviewStore(file);assert.equal(restored.reviews[0].state,'interrupted');assert.equal(restored.reviews[0].calls[0].errorCode,'HOST_RESTART');assert.equal(restored.reviews[0].followups[0].state,'interrupted');assert.equal(JSON.parse(readFileSync(file)).schemaVersion,1);}finally{rmSync(dir,{recursive:true,force:true})}
});
test('card edits preserve author history, stale versions refused, current export matches',async()=>{
 const c=new ReviewController(adapter(),memory()),r=c.start('材料','目标','review');await c.settled();const card=structuredClone(r.card);card.decision='用户修订的评审目标';card.humanDecision={author:'user',text:'暂不作发布决定'};c.editCard(r.id,1,card);assert.equal(r.cardVersion,2);assert.equal(r.cardRevisions[0].author,'ai');assert.equal(r.cardRevisions[1].author,'user');assert(exportMarkdown(r).includes('用户修订的评审目标'));assert(exportMarkdown(r).includes('暂不作发布决定'));assert.throws(()=>c.editCard(r.id,1,card),/CARD_CONFLICT/);
 for(const mutate of [c=>c.claims[0].sourceMessageIds=['invented'],c=>c.claims[0].evidenceIds=['fake'],c=>c.claims[0].verification='supported']){const invalid=structuredClone(card);mutate(invalid);assert.throws(()=>validateCard(invalid,r,'user'));}
 assert.throws(()=>validateCard(card,r,'ai'),/AI cannot fill/);
});
test('mentions ignore code fences, quotes, inline code and email addresses',()=>{
 assert.deepEqual(mentionIds('> @黑帽\n```js\n@white\n```\n`@红帽` abc@green @蓝帽 请分析'),['blue']);assert.equal(resolveHat('@green 创意','black'),'green');assert.throws(()=>resolveHat('@白帽 @黑帽 分析','blue'),/ONE_HAT_REQUIRED/);
});
test('pre-call disk failure prevents provider I/O',async()=>{
 let io=0,saves=0;const store={reviews:[],save(){if(++saves>=3)throw new Error('disk full')}};const a=adapter(o=>{io++;return response(o)}),c=new ReviewController(a,store);const r=c.start('材料','目标','review');await c.settled();assert.equal(io,0);assert.equal(r.state,'failed');assert.equal(c.enabled,false);
});
test('corrupt store is not overwritten',()=>{const dir=mkdtempSync(join(tmpdir(),'hexamind-bad-')),file=join(dir,'state.json');try{writeFileSync(file,'not-json');assert.throws(()=>new FileReviewStore(file));assert.equal(readFileSync(file,'utf8'),'not-json')}finally{rmSync(dir,{recursive:true,force:true})}});
test('card save failure rolls back to the last saved card and export',async()=>{
 let fail=false;const store={reviews:[],save(){if(fail)throw new Error('disk')}};
 const c=new ReviewController(adapter(),store),r=c.start('材料','目标','review');await c.settled();const old=exportMarkdown(r),changed=structuredClone(r.card);changed.decision='未保存的修改';fail=true;
 assert.throws(()=>c.editCard(r.id,1,changed),/STORE_WRITE_FAILED/);assert.equal(r.cardVersion,1);assert.equal(exportMarkdown(r),old);assert(!exportMarkdown(r).includes('未保存的修改'));
});
test('long fences do not close on shorter embedded fences',()=>{assert.deepEqual(mentionIds('````\n```\n@黑帽\n````\n@白帽 检查'),['white'])});
test('two transient errors complete in eight calls without exceeding review budget',async()=>{const c=new ReviewController(adapter((o,n)=>n===0||n===2?new Error('RATE_LIMIT'):response(o)),memory()),r=c.start('材料','目标','review');await c.settled();assert.equal(r.state,'completed');assert.equal(r.calls.length,8);assert.equal(r.automaticRetries,2);assert(r.stages.every(s=>s.automaticRetries<=1));});
for(const phase of ['checkpoint','terminal'])test(phase+' save failure stops subsequent calls even if disk recovers immediately',async()=>{let failed=false,io=0;const store={reviews:[],save(){const call=this.reviews[0]?.calls.at(-1);if(!failed&&call&&(phase==='checkpoint'?call.state==='running'&&call.checkpointAt:call.state==='completed')){failed=true;throw new Error('transient disk failure')}}};const c=new ReviewController(adapter(o=>{io++;return response(o)}),store),r=c.start('材料','目标','review');await c.settled();assert.equal(failed,true);assert.equal(io,1);assert.equal(r.state,'failed');assert.equal(c.enabled,false);assert.equal(r.stages[1].state,'pending');});
