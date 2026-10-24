import test from 'node:test';
import assert from 'node:assert/strict';
import { Controller } from '../lib/controller.js';
import { trusted, apply } from '../lib/index.js';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const tick = () => new Promise(r=>setImmediate(r));
const selection = () => ({provider:'test',model:'model'});
test('strategy injection, tools denied, fresh model selection and finish',async()=>{
  const requests=[]; let model='first';
  const c=new Controller({selection:()=>({...selection(),model}),async *stream(o){requests.push(o);yield {type:'text-delta',text:'response'};yield {type:'finish',reason:{kind:'stop'}}}});
  const a=c.start('white','public input');await tick();model='second';const b=c.start('black','public input');await tick();
  assert.equal(a.state,'completed');assert.equal(b.selection.model,'second');assert.notEqual(requests[0].system,requests[1].system);assert.deepEqual(requests[0].tools,[]);
});
test('late results after cancellation cannot revive or append',async()=>{
  let release; const gate=new Promise(r=>release=r);
  const c=new Controller({selection,async *stream(){await gate;yield {type:'text-delta',text:'late'};yield {type:'finish',reason:{kind:'stop'}}}});
  const a=c.start('white','x');c.cancel();release();await tick();assert.equal(a.state,'cancelled');assert.equal(a.text,'');
});
test('disable cancels and rejects new work',async()=>{
  const c=new Controller({selection,async *stream(o){await new Promise(r=>o.signal.addEventListener('abort',r,{once:true}));yield {type:'finish',reason:{kind:'aborted'}}}});
  const a=c.start('black','x');c.disable();assert.equal(a.state,'cancelled');assert.throws(()=>c.start('white','x'),/DISABLED/);await tick();
});
test('terminal failures are never successful or retried',async()=>{
  let count=0;const c=new Controller({selection,async *stream(){count++;yield {type:'finish',reason:{kind:'error',failure:{code:'AUTH'}}}}});
  const a=c.start('white','x');await tick();assert.equal(a.state,'failed');assert.equal(a.errorCode,'AUTH');assert.equal(count,1);
});
test('missing finish is failure',async()=>{
  const c=new Controller({selection,async *stream(){yield {type:'text-delta',text:'partial'}}});const a=c.start('white','x');await tick();assert.equal(a.errorCode,'MISSING_FINISH');
});
test('input validation, inherited object keys, concurrent runs',async()=>{
  const c=new Controller({selection,async *stream(o){await new Promise(r=>o.signal.addEventListener('abort',r,{once:true}));}});
  assert.throws(()=>c.start('__proto__','x'),/INVALID_INPUT/);assert.throws(()=>c.start('white',' '),/INVALID_INPUT/);
  c.start('white','x');assert.throws(()=>c.start('white','x'),/BUSY/);c.cancel();await tick();
});
test('origin boundary rejects cross-site and non-loopback access',()=>{
  const req=(headers,address='127.0.0.1')=>({headers,socket:{remoteAddress:address}});
  assert.equal(trusted(req({host:'127.0.0.1:3088',origin:'http://127.0.0.1:3088'})),true);
  assert.equal(trusted(req({host:'evil.test',origin:'http://evil.test'})),false);
  assert.equal(trusted(req({host:'127.0.0.1:3088',origin:'http://evil.test'})),false);
  assert.equal(trusted(req({host:'127.0.0.1:3088'})),false);
});
test('Desktop forwarded requests need the explicit client header and reject browser preflights',()=>{
  const req=(headers,method='GET',address='127.0.0.1')=>({headers,method,socket:{remoteAddress:address}});
  const desktop={host:'127.0.0.1:3088','x-sixhat-client':'1'};
  assert.equal(trusted(req(desktop)),true);
  assert.equal(trusted(req(desktop,'POST')),true);
  assert.equal(trusted(req(desktop,'OPTIONS')),false);
  assert.equal(trusted(req({...desktop,origin:'http://evil.test'})),false);
  assert.equal(trusted(req({...desktop,origin:'null'})),false);
  assert.equal(trusted(req({...desktop,'sec-fetch-site':'cross-site'})),false);
  assert.equal(trusted(req({...desktop,'sec-fetch-site':'same-site'})),false);
  assert.equal(trusted(req(desktop,'GET','192.168.1.2')),false);
});

test('lifecycle disposer removes routes and closes the store',async()=>{
  const directory=mkdtempSync(join(tmpdir(),'hexamind-lifecycle-'));
  let dispose;let removed=0;
  try{apply({on(){return()=>{}},agentDefaultModel:{currentSelection:selection},llm:{stream:async function*(){}},webServer:{register(){return()=>removed++}},effect(fn){dispose=fn()}},{storePath:join(directory,'state.json')});
  await dispose();assert.equal(removed,4);}finally{rmSync(directory,{recursive:true,force:true});}
});
test('timeout fails and aborts, never automatically retries',async()=>{
  let signal;const c=new Controller({selection,async *stream(o){signal=o.signal;await new Promise(r=>o.signal.addEventListener('abort',r,{once:true}));}},10);
  const a=c.start('white','x');await new Promise(r=>setTimeout(r,30));assert.equal(a.errorCode,'TIMEOUT');assert.equal(signal.aborted,true);
});
