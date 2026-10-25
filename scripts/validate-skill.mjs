import {readFile,readdir,lstat} from 'node:fs/promises';
import {resolve,join,dirname,relative,isAbsolute,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {parse} from 'yaml';

export const skillFiles=['LICENSE','SKILL.md','agents/openai.yaml','assets/decision-card.md','references/review-workflows.md'];
const project=resolve(dirname(fileURLToPath(import.meta.url)),'..');
export async function inspectSkill(directory=join(project,'skills/sixhat-compass')){
  const root=resolve(directory),files=[];
  async function visit(folder){for(const entry of await readdir(folder,{withFileTypes:true})){
    const path=join(folder,entry.name);if((await lstat(path)).isSymbolicLink())throw Error('Symlinks are not packaged');
    if(entry.isDirectory())await visit(path);else files.push(relative(root,path).split(sep).join('/'));
  }}
  await visit(root);files.sort();if(JSON.stringify(files)!==JSON.stringify([...skillFiles].sort()))throw Error('Unexpected or missing skill files: '+files.join(', '));
  const entry=await readFile(join(root,'SKILL.md'),'utf8');
  const front=/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/u.exec(entry);if(!front)throw Error('Missing YAML frontmatter');
  const metadata=parse(front[1]);if(metadata.name!=='sixhat-compass'||!/^\d+\.\d+\.\d+-preview\.\d+$/u.test(metadata.metadata?.version||''))throw Error('Invalid skill identity or version');
  if(typeof metadata.description!=='string'||!metadata.description.trim()||metadata.description.length>1024)throw Error('Invalid description');
  if(metadata.license!=='MIT')throw Error('Missing MIT license');
  const ui=parse(await readFile(join(root,'agents/openai.yaml'),'utf8'));
  if(typeof ui.interface?.display_name!=='string'||!ui.interface.default_prompt?.includes('$sixhat-compass'))throw Error('Invalid interface metadata');
  const size=ui.interface.short_description?.length;if(!size||size<25||size>64)throw Error('UI description must contain 25–64 characters');
  if(ui.dependencies||ui.policy?.allow_implicit_invocation===false)throw Error('Unexpected tool dependency or explicit-only policy');
  const manifest=[];
  for(const file of files){
    const raw=await readFile(join(root,file)),text=raw.toString('utf8');
    if(/\[TODO|\bFIXME\b|[A-Z]:[\\/]+Users[\\/]|(?:sk-[A-Za-z0-9_-]{16,}|[?&]token=[A-Za-z0-9_-]{10,}|Bearer [A-Za-z0-9_-]{15,})/u.test(text))throw Error('Placeholder, private path or credential-like text in '+file);
    for(const [,link] of text.matchAll(/\[[^\]]*\]\(([^)]+)\)/gu)){
      if(/^[a-z]+:/iu.test(link))throw Error('Skill references must be self-contained');
      const target=resolve(dirname(join(root,file)),link.split('#')[0]);const rel=relative(root,target);
      if(rel.startsWith('..')||isAbsolute(rel))throw Error('Reference escapes skill directory');
      try{if(!(await lstat(target)).isFile())throw Error('Not a file')}catch{throw Error('Missing reference: '+file+' → '+link)}
    }
    const canonical=Buffer.from(text.replace(/\r\n/gu,'\n'),'utf8');
    manifest.push({path:file,bytes:canonical.length,sha256:createHash('sha256').update(canonical).digest('hex')});
  }
  return {name:metadata.name,version:metadata.metadata.version,files:manifest};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  inspectSkill(process.argv[2]).then(result=>console.log(JSON.stringify(result,null,2))).catch(error=>{console.error(error.message);process.exitCode=1});
}
