import {readFile,writeFile,mkdir,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
export function semanticText(output){
 try{const x=JSON.parse(output);const keys=new Set(['decision','text','summary','observations','questions','claims','assumptions','risks','alternatives','disagreements','experiments','action','metric','passCondition']);
 const visit=v=>typeof v==='string'?v:Array.isArray(v)?v.map(visit).join('\n'):v&&typeof v==='object'?Object.entries(v).filter(([k])=>keys.has(k)).map(([,v])=>visit(v)).join('\n'):'';return visit(x);
 }catch{return output;}
}
export function checklist(text,checks){return checks.map(c=>{const matches=c.groups.map(group=>group.find(word=>text.toLocaleLowerCase().includes(word.toLocaleLowerCase())));const ok=matches.every(Boolean);const at=ok?text.toLocaleLowerCase().indexOf(matches[0].toLocaleLowerCase()):-1;return {id:c.id,kind:c.kind,description:c.description,covered:ok,matches:matches.map(x=>x||null),evidence:ok?text.slice(Math.max(0,at-45),Math.min(text.length,at+170)):''};})}
function readable(output){
 try{const v=JSON.parse(output);const out=['### 决策事项',v.decision||''];
 const sections=[['关键结论','claims'],['待验证假设','assumptions'],['风险','risks'],['替代方案','alternatives'],['分歧与信息缺口','disagreements']];
 for(const [title,key]of sections){out.push('### '+title);for(const item of v[key]||[])out.push('- '+(typeof item==='string'?item:item.text+('verification'in item?'（'+item.origin+' / '+item.verification+'）':'')));}
 out.push('### 验证实验');for(const e of v.experiments||[])out.push('- 行动：'+e.action+'\n  - 指标：'+e.metric+'\n  - 通过条件：'+e.passCondition);
 out.push('### 用户最终决定',v.humanDecision?.text||'未填写');return out.join('\n\n');
 }catch{return output;}
}
const grams=s=>new Set([...s.replace(/[^\p{L}\p{N}]/gu,'').toLocaleLowerCase()].map((_,i,a)=>a.slice(i,i+3).join('')).filter(x=>[...x].length===3));
export function repetition(text){const sentences=text.split(/[。！？\n]+/).map(s=>s.trim()).filter(s=>s.length>=25);let similar=0,total=0;for(let i=0;i<sentences.length;i++)for(let j=i+1;j<sentences.length;j++){total++;const a=grams(sentences[i]),b=grams(sentences[j]),both=[...a].filter(s=>b.has(s)).length;if(both/(a.size+b.size-both||1)>=0.6)similar++;}return {sentences:sentences.length,similarPairs:similar,totalPairs:total,ratio:total?similar/total:0};}
const median=xs=>{const a=xs.toSorted((a,b)=>a-b);return a.length%2?a[(a.length-1)/2]:(a[a.length/2-1]+a[a.length/2])/2};
if(process.argv.includes('--score')){
 const root='eval/phase-d',out='docs/reports/phase-d';await mkdir(root+'/blind',{recursive:true});
 const cases=JSON.parse(await readFile(root+'/cases.json'));const arms=['ordinary','structured','six-hat'];const records=[],evidence=[],key={};
 for(const c of cases){
  const blindOrder=[...arms].sort((a,b)=>createHash('sha256').update(c.id+a+'phase-d').digest('hex').localeCompare(createHash('sha256').update(c.id+b+'phase-d').digest('hex')));key[c.id]=Object.fromEntries(blindOrder.map((a,i)=>[String.fromCharCode(65+i),a]));
  const samples=[];
  for(const arm of arms){let r;try{r=JSON.parse(await readFile(root+'/results/'+c.id+'-'+arm+'.json'))}catch(e){if(e.code==='ENOENT')continue;throw e}
   const text=semanticText(r.output),checks=checklist(text,c.checks),rep=repetition(text),tokens=r.calls.reduce((n,c)=>n+(c.usage?.totalTokens||0),0);
   const row={caseId:c.id,category:c.category,arm,state:r.state,strictJson:r.strictJson,covered:checks.filter(x=>x.covered).length,total:checks.length,coverage:checks.filter(x=>x.covered).length/checks.length,risk:checks.filter(x=>x.kind==='risk'&&x.covered).length,alternative:checks.filter(x=>x.kind==='alternative'&&x.covered).length,experiment:checks.filter(x=>x.kind==='experiment'&&x.covered).length,calls:r.calls.length,retries:r.calls.filter(c=>c.purpose==='auto-retry').length,failedCalls:r.calls.filter(c=>c.state!=='completed').length,reportedTokens:tokens,missingUsageCalls:r.calls.filter(c=>!c.usage).length,elapsedMs:r.elapsedMs,chars:text.length,repetition:rep};records.push(row);evidence.push({caseId:c.id,arm,checks});samples.push({arm,text:readable(r.output)});
  }
  if(samples.length===3){const material=`# ${c.id} ${c.title}\n\n目标：${c.goal}\n\n材料：${c.text}\n\n`;await writeFile(root+'/blind/'+c.id+'.md',material+blindOrder.map((a,i)=>`## 输出 ${String.fromCharCode(65+i)}\n\n${samples.find(s=>s.arm===a).text}`).join('\n\n'));}
 }
 const summary=arms.map(arm=>{const rows=records.filter(r=>r.arm===arm);return {arm,cases:rows.length,completed:rows.filter(r=>r.state==='completed').length,strictJsonCount:rows.filter(r=>r.strictJson&&r.state==='completed').length,covered:rows.reduce((n,r)=>n+r.covered,0),checks:rows.length*6,coverage:rows.reduce((n,r)=>n+r.covered,0)/(rows.length*6),riskCoverage:rows.reduce((n,r)=>n+r.risk,0)/(rows.length*2),alternativeCoverage:rows.reduce((n,r)=>n+r.alternative,0)/(rows.length*2),experimentCoverage:rows.reduce((n,r)=>n+r.experiment,0)/(rows.length*2),calls:rows.reduce((n,r)=>n+r.calls,0),retries:rows.reduce((n,r)=>n+r.retries,0),failedCalls:rows.reduce((n,r)=>n+r.failedCalls,0),reportedTokens:rows.reduce((n,r)=>n+r.reportedTokens,0),missingUsageCalls:rows.reduce((n,r)=>n+r.missingUsageCalls,0),medianReportedTokens:rows.length?median(rows.map(r=>r.reportedTokens)):0,medianElapsedSeconds:rows.length?median(rows.map(r=>r.elapsedMs/1000)):0,meanChars:rows.reduce((n,r)=>n+r.chars,0)/rows.length,similarSentencePairs:rows.reduce((n,r)=>n+r.repetition.similarPairs,0),sentencePairs:rows.reduce((n,r)=>n+r.repetition.totalPairs,0)}});
 const pairs=cases.map(c=>{const rows=records.filter(r=>r.caseId===c.id);return rows.length===3?{caseId:c.id,coverageDeltaSixVsStructured:rows.find(r=>r.arm==='six-hat').coverage-rows.find(r=>r.arm==='structured').coverage,tokenRatioSixVsStructured:rows.find(r=>r.arm==='six-hat').reportedTokens/rows.find(r=>r.arm==='structured').reportedTokens}:null}).filter(Boolean);
 const delta=pairs.reduce((n,r)=>n+r.coverageDeltaSixVsStructured,0)/(pairs.length||1),ratio=pairs.length?median(pairs.map(p=>p.tokenRatioSixVsStructured)):null;
 const result={scoredAt:new Date().toISOString(),complete:records.length===60,records:records.length,summary,pairs,decision:{coverageDeltaSixVsStructured:delta,medianPairedTokenRatio:ratio,coverageThresholdMet:delta>=.1,tokenThresholdMet:ratio!==null&&ratio<=3,candidateScreenPass:records.length===60&&delta>=.1&&ratio<=3},userStudy:{actualParticipants:0,status:'prepared_not_collected'},limitations:['keyword surface proxy, not semantic score','single run per case, one provider/model','synthetic cases, no user distribution','no independent human ratings or factual-error estimate for whole sample']};
 await writeFile(out+'/metrics.json',JSON.stringify(result,null,2));await writeFile(out+'/scores.json',JSON.stringify(records,null,2));await writeFile(out+'/checklist-evidence.json',JSON.stringify(evidence,null,2));await writeFile(root+'/blind-key.json',JSON.stringify(key,null,2));
 const cols=['caseId','category','arm','state','covered','total','risk','alternative','experiment','calls','retries','failedCalls','reportedTokens','missingUsageCalls','elapsedMs','chars'];await writeFile(out+'/scores.csv','\ufeff'+cols.join(',')+'\n'+records.map(r=>cols.map(k=>r[k]).join(',')).join('\n')+'\n');console.log(JSON.stringify({records:records.length,summary,decision:result.decision},null,2));
}
