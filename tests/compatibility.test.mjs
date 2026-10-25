import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import {readFileSync} from 'node:fs';
const require=createRequire(import.meta.url);
const hostRequire=createRequire(require.resolve('@deepseek-ai/dsh-agent-default-model'));
const {evaluatePluginCompatibility}=await import(pathToFileURL(hostRequire.resolve('@deepseek-ai/dsh-app-boot')));
const manifest=JSON.parse(readFileSync(new URL('../package.json',import.meta.url),'utf8'));
test('the real DSH compatibility gate accepts every validated host without exemptions',()=>{
 for(const version of ['0.2.0-rc.2','0.2.1-rc.2','0.2.1-rc.3']){
  assert.equal(evaluatePluginCompatibility(manifest,{},version),undefined,'host '+version);
 }
});
test('unvalidated host versions remain blocked by the real DSH compatibility gate',()=>{
 for(const version of ['0.2.0-rc.1','0.2.1-rc.4','0.2.1','0.2.2','1.0.0']){
  const issue=evaluatePluginCompatibility(manifest,{},version);assert(issue,'host '+version);assert.equal(issue.exempted,false);
 }
});
