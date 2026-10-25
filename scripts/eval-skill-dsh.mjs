// Developer-only live evaluation. Inherits the caller's DSH_HOME and credentials.
// Use a dedicated test home containing this Skill, without the legacy plugin.
import {readFileSync, writeFileSync, mkdirSync} from 'node:fs';
import {resolve, dirname} from 'node:path';
import {spawn} from 'node:child_process';
const [bin, destination, filter] = process.argv.slice(2);
if (!bin || !destination || !process.env.DSH_HOME) throw new Error('Usage: node scripts/eval-skill-dsh.mjs <dsh-bin.js> <result.json> [case-id]; requires isolated DSH_HOME');
const cases = JSON.parse(readFileSync(new URL('../eval/skill/cases.json', import.meta.url)));
const materials = JSON.parse(readFileSync(new URL('../eval/skill/materials.json', import.meta.url)));
const sessions = new Map();
const results = [];
  for (const c of cases.filter(c => !filter || filter.split(',').includes(c.id))) {
  if (c.continue && !sessions.has(c.continue)) throw new Error(`Run the full suite to retain ${c.continue} context`);
  const prompt = c.prompt + (c.material ? '\n\n' + materials[c.material] : '');
  const args = [resolve(bin), '--profile', 'headless', '--json'];
  if (c.continue) args.push('--session-id', sessions.get(c.continue));
  args.push(prompt);
  const started = Date.now();
  const result = await new Promise((resolveRun, reject) => {
    const child = spawn(process.execPath, args, {env:process.env, windowsHide:true, stdio:['ignore','pipe','pipe']});
    let stdout='', stderr='';
    child.stdout.on('data', b=>stdout+=b);
    child.stderr.on('data', b=>stderr+=b);
    child.on('error', reject);
    child.on('close', code=>{
      const events=stdout.split(/\r?\n/).flatMap(l=>{try{return [JSON.parse(l)];}catch{return [];}});
      const session=events.find(e=>e.type==='session')?.sessionId;
      // Keep only answer + tool summaries, never raw reasoning, credentials or local paths.
      const tools=events.filter(e=>e.type==='tool_call').map(e=>({tool:e.tool, ownSkillRead:JSON.stringify(e.input).includes('sixhat-compass'), status:events.find(r=>r.type==='tool_result'&&r.callId===e.callId)?.status??'unknown'}));
      resolveRun({id:c.id,prompt,expected:c.check,exitCode:code,durationMs:Date.now()-started,session,text:events.findLast(e=>e.type==='final')?.text??'',tools,diagnostic:code===0?null:'Host invocation failed; inspect local stderr (not included in public output).'});
    });
  });
  if(result.session)sessions.set(c.id,result.session);
  results.push(result);
  const out=resolve(destination);mkdirSync(dirname(out),{recursive:true});
  writeFileSync(out,JSON.stringify({host:'DSH 0.2.1-rc.3 headless',legacyPlugin:false,review:'Outputs require semantic review; runner does not decide pass/fail.',results},null,2)+'\n');
  console.log(c.id+': exit='+result.exitCode+' chars='+result.text.length+' tools='+result.tools.length);
  if(result.exitCode!==0)break;
}
