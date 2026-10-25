import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,cp,writeFile,readFile,rm} from 'node:fs/promises';
import {resolve,join,sep} from 'node:path';
import {tmpdir} from 'node:os';
import {inspectSkill} from '../scripts/validate-skill.mjs';

async function fixture(run){
  const folder=await mkdtemp(join(tmpdir(),'sixhat-skill-'));
  try{await cp('skills/sixhat-compass',folder,{recursive:true});await run(folder)}finally{
    assert(resolve(folder).startsWith(resolve(tmpdir())+sep));
    assert(resolve(folder).split(sep).at(-1).startsWith('sixhat-skill-'));
    await rm(folder,{recursive:true,force:true});
  }
}
test('instruction-only distribution has a complete independently readable manifest',async()=>{
  const skill=await inspectSkill();assert.equal(skill.name,'sixhat-compass');assert.equal(skill.files.length,5);
  assert(skill.files.every(f=>f.bytes>0&&/^[a-f0-9]{64}$/u.test(f.sha256)));
});
test('a missing advanced reference prevents publishing a broken skill',async()=>fixture(async folder=>{
  const path=join(folder,'SKILL.md');await writeFile(path,(await readFile(path,'utf8')).replace('references/review-workflows.md','references/missing.md'));
  await assert.rejects(inspectSkill(folder),/Missing reference/u);
}));
test('a reference cannot pull unrelated user files into a portable skill',async()=>fixture(async folder=>{
  const path=join(folder,'SKILL.md');await writeFile(path,(await readFile(path,'utf8'))+'\n[extra](../../outside.md)\n');
  await assert.rejects(inspectSkill(folder),/escapes skill directory/u);
}));
test('accidental runtime scripts or private files are refused by the package allowlist',async()=>fixture(async folder=>{
  await writeFile(join(folder,'install.js'),'console.log("unexpected executable")');
  await assert.rejects(inspectSkill(folder),/Unexpected or missing/u);
}));
