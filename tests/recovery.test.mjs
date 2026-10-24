import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,writeFileSync,rmSync,readdirSync,existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {DurableReviewStore} from '../lib/durable-store.js';
import {ReviewController} from '../lib/review-controller.js';
import {queryHistory,recoveryInfo} from '../lib/history.js';
const digest=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const tick=()=>new Promise(r=>setImmediate(r));
const memory=()=>({reviews:[],save(){}});
const base=()=>({schemaVersion:1,id:'r',title:'项目',goal:'是否发布',mode:'single',state:'completed',createdAt:'2026-01-01',updatedAt:'2026-01-02',materialMessageId:'m',calls:[],messages:[{id:'m',text:'原材料 独立插件',kind:'material'}],stages:[{hat:'black',state:'completed'}],followups:[],automaticRetries:0,cardVersion:0,card:null,cardRevisions:[],evidence:[]});
function disk(fn){const dir=mkdtempSync(join(tmpdir(),'hexamind-c-')),file=join(dir,'reviews.json');try{return fn(file,dir)}finally{rmSync(dir,{recursive:true,force:true})}}
function valid(o){const input=o.messages[0].content[0].text;const id=input.match(/允许引用的真实消息ID：([^\n,]+)/)?.[1]||'m';return JSON.stringify({summary:'建议实验',observations:[{text:'验证安装成功率',sourceMessageIds:[id]}],questions:[]})}
const good={selection:()=>({provider:'p',model:'m'}),async *stream(o){yield{type:'text-delta',text:valid(o)};yield{type:'finish',reason:{kind:'stop'}}}};
test('migration preserves every legacy record and exact immutable v1 backup',()=>disk(file=>{
 const legacy={schemaVersion:1,reviews:[base()]},raw=JSON.stringify(legacy,null,2);writeFileSync(file,raw);
 const store=new DurableReviewStore(file);assert.deepEqual(store.reviews,legacy.reviews);assert.equal(readFileSync(file+'.v1-backup','utf8'),raw);assert.equal(store.info.migratedFrom,1);
 const saved=JSON.parse(store.snapshot());assert.equal(saved.schemaVersion,4);assert.equal(saved.checksum,digest(legacy.reviews));store.save();store.close();
 const reload=new DurableReviewStore(file);assert.equal(reload.info.generation,2);assert.equal(readFileSync(file+'.v1-backup','utf8'),raw);reload.close();
}));
test('restart retains partial output and interrupts both review and followup without dispatch',()=>disk(file=>{
 const r=base();r.state='running';r.stages[0].state='running';r.calls=[{id:'call',state:'running',text:'已刷盘的部分正文',checkpointAt:'2026-01-01'}];r.followups=[{state:'running'}];writeFileSync(file,JSON.stringify({schemaVersion:1,reviews:[r]}));
 const store=new DurableReviewStore(file);const v=store.reviews[0];assert.equal(v.state,'interrupted');assert.equal(v.calls[0].state,'interrupted');assert.equal(v.calls[0].text,'已刷盘的部分正文');assert.equal(v.followups[0].errorCode,'HOST_RESTART');assert.equal(v.stages[0].state,'interrupted');assert.equal(recoveryInfo(v).canResume,true);store.close();
}));
test('corrupt main recovers last valid generation, warns and quarantines original',()=>disk((file,dir)=>{
 const store=new DurableReviewStore(file);store.reviews.push(base());store.save();store.reviews[0].title='较新保存';store.save();store.close();writeFileSync(file,'corrupt');
 const recovered=new DurableReviewStore(file);assert.equal(recovered.reviews[0].title,'项目');assert.match(recovered.info.recoveryNotice,/最近一次保存可能缺失/);assert(readdirSync(dir).some(x=>x.includes('.corrupt-')));recovered.close();
}));
test('checksum tampering rejected; corrupt no-backup store left untouched',()=>disk(file=>{
 const raw=JSON.stringify({schemaVersion:2,generation:1,checksum:'bad',reviews:[base()]});writeFileSync(file,raw);assert.throws(()=>new DurableReviewStore(file),/STORE_CORRUPT/);assert.equal(readFileSync(file,'utf8'),raw);assert(!existsSync(file+'.lock'));
}));
test('missing main recovers a valid backup instead of presenting an empty history',()=>disk(file=>{const s=new DurableReviewStore(file);s.reviews.push(base());s.save();s.save();s.close();rmSync(file);const restored=new DurableReviewStore(file);assert.equal(restored.reviews.length,1);assert.match(restored.info.recoveryNotice,/缺失/);restored.close();}));
test('initial save failure does not leave an unresumable running history item',()=>{const s={reviews:[],save(){throw Error('disk')}};const c=new ReviewController(good,s);assert.throws(()=>c.start('材料','目标'),/STORE_WRITE_FAILED/);assert.equal(c.busy,false);assert.equal(c.enabled,false);assert.equal(c.reviews.length,0);});
test('future version refused even when valid old backup exists',()=>disk(file=>{
 const raw=JSON.stringify({schemaVersion:5,reviews:[]});writeFileSync(file,raw);writeFileSync(file+'.bak',JSON.stringify({schemaVersion:1,reviews:[]}));assert.throws(()=>new DurableReviewStore(file),/STORE_SCHEMA_UNSUPPORTED/);assert.equal(readFileSync(file,'utf8'),raw);
}));
test('single writer lock rejects second instance and releases on close',()=>disk(file=>{const s=new DurableReviewStore(file);assert.throws(()=>new DurableReviewStore(file),/STORE_IN_USE/);s.close();const b=new DurableReviewStore(file);b.close();}));
test('external generation change prevents stale overwrite',()=>disk(file=>{const s=new DurableReviewStore(file);s.save();const raw=JSON.parse(readFileSync(file));raw.generation++;writeFileSync(file,JSON.stringify(raw));assert.throws(()=>s.save(),/STORE_CHANGED_EXTERNALLY/);assert.equal(JSON.parse(readFileSync(file)).generation,2);s.close();}));
test('history searches source material, sorts updates, filters failed followups and clamps pages',()=>{
 const a=base(),b={...base(),id:'b',title:'其他',updatedAt:'2026-02-01',followups:[{state:'failed'}]};
 const all=queryHistory([a,b],new URLSearchParams('pageSize=1&page=999'));assert.equal(all.page,2);assert.equal(all.items[0].id,'r');
 assert.equal(queryHistory([a,b],new URLSearchParams('filter=attention')).items[0].id,'b');
 assert.equal(queryHistory([a],new URLSearchParams('search=独立插件')).total,1);assert.equal(queryHistory([a],new URLSearchParams('search=缺失')).total,0);
});
test('manual resume idempotency survives controller recreation and does not reset retry budgets',async()=>{
 const s=memory();let fail=true;const a={...good,async *stream(o){if(fail){yield{type:'finish',reason:{kind:'error',failure:{code:'AUTH'}}};return}yield*good.stream(o)}};
 const c=new ReviewController(a,s),r=c.start('公开材料','目标','single','black');await c.settled();r.automaticRetries=2;r.stages[0].automaticRetries=1;fail=false;
 c.resume(r.id,'request-1');c.resume(r.id,'request-1');await c.settled();assert.equal(r.calls.length,2);assert.equal(r.calls[1].parentCallId,r.calls[0].id);assert.equal(r.automaticRetries,2);assert.equal(recoveryInfo(r).automaticRetriesRemaining,0);
 const recreated=new ReviewController(a,s);recreated.resume(r.id,'request-1');await recreated.settled();assert.equal(r.calls.length,2);assert.throws(()=>recreated.retryFollowup(r.id,'f','request-1'),/OPERATION_CONFLICT/);
});
test('failed followup retry retains original question, claim snapshot and previous call',async()=>{
 const r=base();r.card={claims:[{id:'c1',text:'最初结论'}]};r.cardVersion=1;const s=memory();s.reviews.push(r);let fail=true;
 const a={...good,async *stream(o){if(fail){yield{type:'finish',reason:{kind:'error',failure:{code:'AUTH'}}};return}assert(o.messages[0].content[0].text.includes('最初结论'));assert(!o.messages[0].content[0].text.includes('后来改写'));yield{type:'text-delta',text:JSON.stringify({summary:'回答',observations:[{text:'执行实验',sourceMessageIds:['m']}],questions:[]})};yield{type:'finish',reason:{kind:'stop'}}}};
 const c=new ReviewController(a,s);c.followup(r.id,'c1','如何验证？','black');await c.settled();const f=r.followups[0],old=r.calls[0];assert.equal(f.state,'failed');r.card.claims[0].text='后来改写';fail=false;
 c.retryFollowup(r.id,f.id,'retry-1');c.retryFollowup(r.id,f.id,'retry-1');await c.settled();assert.equal(f.state,'completed');assert.equal(r.calls.length,2);assert.equal(r.calls[1].purpose,'followup-retry');assert.equal(r.calls[1].parentCallId,old.id);assert.equal(r.messages.filter(m=>m.kind==='question').length,1);assert.equal(old.state,'failed');assert.equal(r.cardVersion,1);
});
test('checkpoint is persisted before stop; late text cannot alter persisted partial',async()=>{
 let release,seen;const gate=new Promise(r=>release=r);let snapshot;
 const store={reviews:[],save(){snapshot=structuredClone(this.reviews)}};
 const a={...good,async *stream(){yield{type:'text-delta',text:'保留前缀'};await gate;yield{type:'text-delta',text:'晚到内容'}}};
 const c=new ReviewController(a,store,{checkpointMs:0}),r=c.start('材料','目标','single','black');await tick();seen=snapshot[0].calls[0];assert.equal(seen.text,'保留前缀');assert(seen.checkpointAt);c.cancel();await c.settled();release();await tick();assert.equal(snapshot[0].calls[0].text,'保留前缀');assert.equal(r.calls[0].text,'保留前缀');assert.equal(r.state,'cancelled');
});
