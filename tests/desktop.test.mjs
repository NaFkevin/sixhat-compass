import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
function client(extra={}){
 const sandbox={require:()=>({createElement:(type,props,...children)=>({type,props,children}),useState:value=>[value,()=>{}]}),...extra};
 vm.runInNewContext(readFileSync(new URL('../src/ui.cjs',import.meta.url),'utf8')+'\nglobalThis.exposed={api,DownloadLink};',sandbox);
 return sandbox.exposed;
}
test('all UI API requests carry the Desktop forwarding header, including POST admission',async()=>{
 const calls=[],ui=client({fetch:async(url,options)=>{calls.push({url,options});return{ok:true,json:async()=>({accepted:true})}}});
 await ui.api('state');await ui.api('action',{kind:'nativeStart'});
 assert.equal(calls[0].options.headers['x-sixhat-client'],'1');assert.equal(calls[1].options.headers['x-sixhat-client'],'1');
 assert.equal(calls[1].options.method,'POST');assert.equal(JSON.parse(calls[1].options.body).kind,'nativeStart');
});
test('downloads fetch with the Desktop header before creating a local file link; failures never save error JSON',async()=>{
 const requests=[],links=[],revoked=[];let ok=true;
 const ui=client({fetch:async(url,options)=>{requests.push({url,options});return {ok,blob:async()=>({file:true})}},URL:{createObjectURL:()=> 'blob:local-backup',revokeObjectURL:url=>revoked.push(url)},document:{createElement:()=>{const link={click(){links.push({...link})}};return link}},setTimeout:fn=>fn()});
 const button=ui.DownloadLink({path:'backup',filename:'backup.json',children:'备份'}).children[0];
 await button.props.onClick();assert.equal(requests[0].options.headers['x-sixhat-client'],'1');assert.equal(links.length,1);assert.equal(links[0].download,'backup.json');assert.equal(links[0].href,'blob:local-backup');assert.deepEqual(revoked,['blob:local-backup']);
 ok=false;await button.props.onClick();assert.equal(links.length,1);
});
