const modeLabel=mode=>mode==='structured'?'结构化单次评审':mode==='review'?'六帽深度评审':mode==='hat-chat'?'单帽直接回复':'单帽分析';
const savedKey='hexamind.workspace.v1';
function readWorkspace(){try{const value=JSON.parse(localStorage.getItem(savedKey)||'{}');if(!value||typeof value!=='object')return {};return Object.fromEntries(['text','goal','hat','selected','view'].filter(k=>typeof value[k]==='string').map(k=>[k,value[k]]))}catch{return {}}}
function operationId(){return crypto.randomUUID()}
const historyCss=`.hm-layout{grid-template-columns:240px minmax(0,1fr)}.hm-history input,.hm-history select{width:100%;margin:4px 0 10px}.hm-history small{display:block}.hm-history .hm-row button{width:auto}.hm-recovery{border-color:#b7791f}.hm-backup{font-size:12px}@media(max-width:650px){.hm-layout{display:block}.hm-history{max-height:310px}}`;
function History({state,selected,onSelect,search,setSearch,filter,setFilter,setPage}){
 const x=state?.history;
 return h('nav',{className:'hm-history','aria-label':'评审历史'},h('h2',null,'评审记录'),
 h('button',{type:'button',onClick:()=>onSelect('new')},'新建评审 / 继续草稿'),
 h('label',{htmlFor:'hm-search'},'搜索记录'),h('input',{id:'hm-search',type:'search',value:search,placeholder:'标题、目标或材料',onChange:e=>{setSearch(e.target.value);setPage(1)}}),
 h('label',{htmlFor:'hm-filter'},'状态筛选'),h('select',{id:'hm-filter',value:filter,onChange:e=>{setFilter(e.target.value);setPage(1)}},[['all','全部'],['attention','需要处理'],['completed','已完成'],['failed','失败'],['cancelled','已停止'],['interrupted','重启中断'],['running','进行中']].map(([v,n])=>h('option',{key:v,value:v},n))),
 ...(x?.items||[]).map(r=>h('button',{key:r.id,type:'button','aria-current':selected===r.id||state?.review?.id===r.id,onClick:()=>onSelect(r.id)},r.title,h('small',null,modeLabel(r.mode)),h('small',null,labels[r.state]+(r.needsAttention?' · 待处理':'')),h('small',null,r.completedStages+'/'+r.totalStages+' 阶段 · '+r.callCount+' 次调用'),h('small',null,new Date(r.updatedAt).toLocaleString()))),
 x&&h('div',null,h('small',null,'共 '+x.total+' 条 · 第 '+x.page+' / '+x.pages+' 页'),h('div',{className:'hm-row'},h('button',{type:'button',disabled:x.page<=1,onClick:()=>setPage(x.page-1)},'上一页'),h('button',{type:'button',disabled:x.page>=x.pages,onClick:()=>setPage(x.page+1)},'下一页'))),
 x?.total===0&&h('p',null,'没有符合条件的记录。'),h('a',{className:'hm-backup',href:'/api/hexamind/backup',download:true},'备份全部已保存记录'),h('small',null,'备份含原始材料与调用内容，请妥善保管。'));
}
function Recovery({review,busy,action}){
 const x=review.recovery;if(!x?.canResume&&!review.storageError)return null;
 return h('section',{className:'hm-box hm-recovery','aria-label':'恢复评审'},h('h3',null,x.title),h('p',null,x.action),h('p',null,'已保留 '+x.retainedStages+' 个完成阶段；下一步：'+(review.mode==='structured'?'结构化评审':names[x.nextHat]||'核对保存状态')+'。剩余自动重试预算 '+x.automaticRetriesRemaining+' 次，恢复不会重置预算。'),h('small',null,'错误码：'+(x.errorCode||'UNKNOWN')),h('p',null,'恢复使用宿主当前默认模型，会产生新的调用。已完成阶段不重复执行。'),h('button',{type:'button',disabled:busy,onClick:()=>action({kind:'resume',reviewId:review.id,operationId:operationId()})},'从未完成步骤恢复'));
}
function FollowupStatus({followup:f,review,busy,action}){
 const q=review.messages.find(m=>m.id===f.questionMessageId);
 return h('article',{className:'hm-box','aria-label':'追问恢复'},h('strong',null,'追问 '+f.targetClaimId+' · '+names[f.hat]+' · '+labels[f.state]),h('p',null,q?.text),f.recovery?.canRetry&&h('div',null,h('p',null,f.recovery.title+'。'+f.recovery.action),h('small',null,'保留原问题与当时的结论快照，不覆盖失败记录。使用当前默认模型，新增一次调用；追问不自动重试。'),h('div',null,h('button',{type:'button',disabled:busy,onClick:()=>action({kind:'retryFollowup',reviewId:review.id,followupId:f.id,operationId:operationId()})},'重试这次追问'))));
}
