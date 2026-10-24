import { readFile, writeFile } from 'node:fs/promises';
import vm from 'node:vm';
const body = await readFile('src/ui.cjs', 'utf8')+'\n'+await readFile('src/recovery-ui.cjs','utf8')+'\n'+await readFile('src/native-ui.cjs','utf8');
const normalizedBody=body.replace(/\r\n/g,'\n');
const output = `window.__ModuleLoader__.load({id:'dsh-sixhat-compass',factory:(require)=>{\n${normalizedBody}\nconst legacyApply=apply;return {name:'sixhat-compass-client',inject:['slots','inputTriggers','configForms','sessions','conversation','uiConversation','workspaces','uiWorkspace'],apply:(ctx)=>{legacyApply(ctx);applyNative(ctx)}};\n}});\n`;
new vm.Script(output);
await writeFile('lib/client.js', output);
