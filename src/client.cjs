const {createElement:h,useState,useEffect} = require('react');
const labels = {running:'正在生成',completed:'已完成',cancelled:'已停止',failed:'调用失败'};
async function api(path, data) {
  const response = await fetch('/api/hexamind/'+path, data ? {method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(data)} : {});
  const value = await response.json();
  if (!response.ok) throw new Error(value.error || '请求失败');
  return value;
}
function Panel() {
  const [state,setState]=useState(null),[text,setText]=useState('我计划独立开发一个六帽方案评审插件。首版只做固定流程，目标用户是独立开发者。请简短分析。'),[hat,setHat]=useState('white'),[error,setError]=useState(''),[pending,setPending]=useState(false);
  useEffect(()=>{let live=true; const refresh=()=>api('state').then(v=>{if(live)setState(v)}).catch(()=>{if(live)setError('无法连接插件，请检查是否已禁用或宿主已停止。')}); refresh(); const timer=setInterval(refresh,500);return()=>{live=false;clearInterval(timer)}},[]);
  const action=async(data)=>{setPending(true);setError('');try{await api('action',data);setState(await api('state'))}catch(e){setError(e.message)}finally{setPending(false)}};
  const busy=state?.runs.some(r=>r.state==='running');
  const button=(label,data,disabled=false)=>h('button',{type:'button',disabled:pending||disabled,onClick:()=>action(data),style:{padding:'10px 16px',marginRight:8,minHeight:44,cursor:'pointer'}},label);
  return h('section',{'aria-label':'六帽规划 验证面板',style:{maxWidth:900,margin:'0 auto',padding:24,height:'100%',overflow:'auto',fontFamily:'system-ui',lineHeight:1.6}},
    h('h1',null,'六帽规划'),h('p',null,'六帽方案评审 · Phase A 集成验证'),
    h('p',null,'继承宿主全局默认模型：',state?state.selection.provider+' / '+state.selection.model:'正在连接…'),
    h('label',{htmlFor:'hm-hat'},'思考视角 '),h('select',{id:'hm-hat',value:hat,onChange:e=>setHat(e.target.value),style:{padding:10}},[['white','白帽 · 信息与假设'],['black','黑帽 · 风险与验证']].map(([v,l])=>h('option',{key:v,value:v},l))),
    h('div',null,h('label',{htmlFor:'hm-text'},'计划或问题'),h('textarea',{id:'hm-text',value:text,maxLength:16000,onChange:e=>setText(e.target.value),rows:5,style:{display:'block',width:'100%',boxSizing:'border-box',padding:12,font:'inherit',margin:'8px 0 16px'}})),
    button('开始分析',{kind:'start',hat,text},!state?.enabled||busy||!text.trim()),button('停止',{kind:'stop'},!busy),button(state?.enabled?'停用分析':'启用分析',{kind:state?.enabled?'disable':'enable'},!state),
    h('p',null,'当前验证单次真实调用。完整六帽流程、历史存储与决策卡将在 Phase B 实现。'),
    error&&h('p',{role:'alert'},error),
    ...(state?.runs||[]).slice().reverse().map(run=>h('article',{key:run.id,style:{border:'1px solid currentColor',borderRadius:8,padding:16,marginTop:16}},
      h('strong',null,run.hat==='white'?'白帽':'黑帽'),h('span',{role:'status',style:{marginLeft:12}},labels[run.state]),
      h('p',null,run.selection.model+' · 调用 '+run.observableStreamAttempts+' 次'),
      h('div',{style:{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}},run.text||'等待模型回复…'),run.errorCode&&h('p',{role:'alert'},'错误代码：'+run.errorCode),
      run.usage&&h('small',null,'用量：'+JSON.stringify(run.usage)) )));
}
function apply(ctx) {
  ctx.slots.inject('main',()=>ctx.slots.register({name:'main',key:'hexamind'},()=>h(Panel)));
  ctx.slots.inject('sidebar.panellist',()=>ctx.slots.register({name:'sidebar.panellist',id:'hexamind',order:55,label:'六帽规划'},()=>h('span',{'aria-hidden':true},'H')));
}
