const nativeHats=[['white','白帽','区分事实、假设与信息缺口'],['red','红帽','表达直觉与可能的情绪反应'],['black','黑帽','找出风险、触发条件和验证行动'],['yellow','黄帽','分析价值和收益成立条件'],['green','绿帽','提出实质不同的替代方案'],['blue','蓝帽','整理目标、分歧与下一步']];
const nativeNames=Object.fromEntries(nativeHats.map(([id,label])=>[id,label]));
const nativeResponsibilities=Object.fromEntries(nativeHats.map(([id,_label,description])=>[id,description]));
const nativeAliases=Object.fromEntries(nativeHats.flatMap(([id,label])=>[[id,id],[label,id]]));
Object.assign(nativeAliases,{'评审':'structured','六帽':'review','新讨论':'new-discussion'});
const nativeLabels={structured:'结构化评审',review:'六帽深度评审',...nativeNames};
Object.assign(errors,{HAT_DISABLED:'这顶帽子已停用，请在“设置 → 六帽规划”中启用。',NATIVE_COMMAND_FAILED:'本次调用未完成，已收到内容保留在评审记录中，可在那里恢复。',SESSION_FLUSH_FAILED:'会话记录保存失败，请先备份并检查磁盘。',NOT_FOUND:'当前会话不可用，请重新打开会话。'});
const {MarkdownText:NativeMarkdown}=require('@deepseek-ai/dsh-client-ui-primitives');
const markdownLabels={code:{copyLabel:'复制',copiedLabel:'已复制'},footnotes:'脚注'};
const nativeCss=`.hm-native{font:inherit;line-height:1.7;min-width:0;width:100%;overflow-wrap:anywhere;padding:12px 0}.hm-native header{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:8px}.hm-native small{opacity:.76}.hm-native header{flex-wrap:wrap}.hm-hat-duty{display:block;font-size:12px}.hm-sr-only{position:absolute;width:1px;height:1px;padding:0;overflow:hidden;clip-path:inset(50%);white-space:nowrap}.hm-native summary{cursor:pointer}.hm-native details{margin-top:8px;font-size:13px}.hm-native button,.hm-settings button{font:inherit;min-height:40px;padding:7px 12px;border:1px solid var(--dsw-alias-border-base,#8886);border-radius:8px;background:transparent;color:inherit;cursor:pointer}.hm-native pre{white-space:pre-wrap;max-height:240px;overflow:auto}.hm-native :focus-visible,.hm-settings :focus-visible{outline:2px solid #8280ff;outline-offset:3px}.hm-settings{padding:20px;max-width:760px;line-height:1.6;color:inherit}.hm-settings label{display:flex;gap:10px;align-items:center;min-height:44px}.hm-settings select{font:inherit;color:inherit;background:var(--dsw-alias-bg-base,#222);border:1px solid #8886;border-radius:8px;padding:8px}.hm-settings fieldset{border:1px solid #8886;border-radius:10px;margin:18px 0;padding:12px}.hm-settings p{margin:8px 0}.hm-native .hm-error{margin:8px 0}.hm-native-question{opacity:.82;white-space:pre-wrap;margin-bottom:12px}`;
function nativeRoute(line){const m=line.match(/^@([^\s，,。:：]+)(?=$|[\s，,。:：])/u);return m&&nativeAliases[m[1].toLowerCase()]?{hat:nativeAliases[m[1].toLowerCase()],token:m[0],args:line.slice(m[0].length).trim()}:null;}
function NativeInputGuard({input,actx,session,claim}){
 useEffect(()=>{let live=true;const check=()=>{if(!live)return;const value=input.state.getSnapshot();if(value.phase!=='plain')return;const leading=value.draft.length-value.draft.trimStart().length,route=nativeRoute(value.draft.trimStart());if(!route)return;
  actx.bail(actx,'slash/input-begin-command',{claim:claim(session,route.hat,route.token),span:{start:leading,end:leading+route.token.length,draftRev:value.draftRev}});
 };const refresh=()=>queueMicrotask(check);const off=input.state.subscribe(refresh);refresh();return()=>{live=false;off();};},[input,actx,session.sessionId]);return null;
}
const recordsCss='.hm-records{display:flex;flex-direction:column;overflow:hidden}.hm-records .hm-header{padding:12px 20px;align-items:center;flex-wrap:wrap}.hm-records .hm-header h2{margin:0}.hm-records-grid{display:grid;grid-template-columns:220px minmax(0,1fr);min-height:0;flex:1;overflow:hidden}.hm-records .hm-history{overflow:auto}.hm-records .hm-history input,.hm-records .hm-history select{width:100%}.hm-records .hm-work{overflow:auto;height:100%;max-width:none;padding:20px}.hm-records .hm-columns{display:block}@media(max-width:700px){.hm-records-grid{grid-template-columns:minmax(0,1fr)}.hm-records .hm-history{max-height:26vh;border-right:0;border-bottom:1px solid #8886}.hm-records .hm-work{padding:14px}}';
function NativeReply({node,scope}){
 const [preferences,setPreferences]=useState(scope?.getSnapshot().value);useEffect(()=>scope?.subscribe(()=>setPreferences(scope.getSnapshot().value)),[scope]);
 const [snapshot,setSnapshot]=useState(null),[error,setError]=useState(''),[pending,setPending]=useState(false),[copied,setCopied]=useState(false);
 useEffect(()=>{if(!copied)return;const timer=setTimeout(()=>setCopied(false),1800);return()=>clearTimeout(timer)},[copied]);
 useEffect(()=>{let live=true,timer;async function refresh(){try{const s=await api('state?commandId='+encodeURIComponent(node.commandId));if(live){setSnapshot(s);setError('')}if(live&&(!s.review&&!node.outcome||s.review?.state==='running'))timer=setTimeout(refresh,650);}catch(e){if(live){setError(e.message);timer=setTimeout(refresh,1800)}}}refresh();return()=>{live=false;clearTimeout(timer)}},[node.commandId,node.outcome]);
 const r=snapshot?.review,call=r?.calls.at(-1),running=r?.state==='running',advanced=r&&r.mode!=='hat-chat';
 const content=advanced?(r.card?r.card.decision:'正在评审，完成后可查看决策卡。'):r?call?.text||'':node.outcome?.kind==='success'?node.outcome.text||'':'';
 async function stop(){setPending(true);try{await api('action',{kind:'stop'});setSnapshot(await api('state?commandId='+encodeURIComponent(node.commandId)))}catch(e){setError(e.message)}finally{setPending(false)}}
 async function copy(){try{await navigator.clipboard.writeText(content);setCopied(true)}catch{setError('复制失败，请选中回复文字手动复制。')}}
 return h('article',{className:'hm-native','aria-label':r?nativeLabels[r.mode==='hat-chat'?r.stages[0].hat:r.mode]:'六帽规划建议'},
  r?.native&&h('div',{className:'hm-native-question'},r.native.question.length<240?r.native.question:h('details',null,h('summary',null,'你 · '+r.native.question.slice(0,90)+'…'),h('pre',null,r.native.question))),
  h('header',null,h('div',null,h('strong',null,r?nativeLabels[r.mode==='hat-chat'?r.stages[0].hat:r.mode]:'六帽规划'),r?.mode==='hat-chat'&&h('small',{className:'hm-hat-duty'},nativeResponsibilities[r.stages[0].hat])),running?h('span',{role:'status'},'已发送 · 正在回复… ',h('button',{type:'button',disabled:pending,onClick:stop},'停止')):content&&h('button',{type:'button',onClick:copy,'aria-label':'复制回复'},copied?'已复制':'复制')),
  copied&&h('span',{className:'hm-sr-only',role:'status'},'回复已复制'),
  content?h(NativeMarkdown,{text:content,streaming:running,labels:markdownLabels}):h('span',{role:'status'},r&&r.state!=='running'?'未收到回复正文。':node.outcome?'本次调用未完成。':r?'等待模型回复…':'正在准备上下文…'),
  r&&r.state!=='running'&&r.state!=='completed'&&h('p',{role:'status'},'本次'+(labels[r.state]||r.state)+'，以上为已保留内容。可从评审记录恢复。'),
  (error||node.outcome?.kind==='error'&&!r)&&h('p',{role:'alert',className:'hm-error'},error||node.outcome.text),
  r?.card&&h(DownloadLink,{path:'export?reviewId='+encodeURIComponent(r.id),filename:'sixhat-decision.md'},'导出决策卡'),
  r?.native&&h('details',null,h('summary',null,'本次上下文 · '+r.native.context.length+' 条'+(r.native.contextOmitted?' · '+r.native.contextOmitted+' 条较早或过长内容未纳入':'')),r.native.context.map(item=>h('div',{key:item.id},h('strong',null,item.role+' · '+item.id),h('pre',null,item.text)))),
  r&&h('details',{open:(preferences?.showUsage??snapshot.preferences?.showUsage)||undefined},h('summary',null,'调用记录 · '+r.calls.length+' 次'),h('small',null,'默认模型：'+(call?call.selection.provider+' / '+call.selection.model:'未调用')),h('pre',null,JSON.stringify(r.calls.map(({hat,state,purpose,usage,errorCode})=>({hat,state,purpose,usage,errorCode})),null,2))));
}
function NativeSettings({scope}){
 const [settings,setSettings]=useState(scope.getSnapshot()),[error,setError]=useState(''),[pending,setPending]=useState(false);
 useEffect(()=>scope.subscribe(()=>setSettings(scope.getSnapshot())),[scope]);
 const value=settings.value||{enabled:true,enabledHats:nativeHats.map(h=>h[0]),replyLength:'standard',showUsage:false};
 async function change(key,next){setPending(true);setError('');try{if(!await scope.set(key,next))setError('设置未保存，请重新读取后再试。')}catch(e){setError(e.message)}finally{setPending(false)}}
 const disabled=pending||settings.status!=='ready'||!settings.writable;
 return h('section',{className:'hm-settings','aria-label':'六帽规划设置'},h('h2',null,'SixHat Compass · 六帽规划'),h('p',null,'在原生聊天中 @某一顶帽子，直接收到建议。'),
 h('label',null,h('input',{type:'checkbox',checked:value.enabled,disabled,onChange:e=>change('enabled',e.target.checked)}),'启用六帽规划'),
 h('fieldset',null,h('legend',null,'可用帽子'),nativeHats.map(([id,label,description])=>h('label',{key:id},h('input',{type:'checkbox',checked:value.enabledHats.includes(id),disabled,onChange:e=>change('enabledHats',e.target.checked?[...value.enabledHats,id]:value.enabledHats.filter(v=>v!==id))}),label+' · '+description))),
 h('label',null,'回复长度',h('select',{'aria-label':'回复长度',value:value.replyLength,disabled,onChange:e=>change('replyLength',e.target.value)},[['brief','简短'],['standard','标准'],['detailed','详细']].map(([id,label])=>h('option',{key:id,value:id},label)))),
 h('label',null,h('input',{type:'checkbox',checked:value.showUsage,disabled,onChange:e=>change('showUsage',e.target.checked)}),'默认展开用量详情'),
 settings.status!=='ready'&&h('p',{role:'status'},'正在连接宿主设置…'),!settings.writable&&settings.status==='ready'&&h('p',{role:'status'},'当前设置只读，不能保存修改。'),error&&h('p',{role:'alert'},error),
 h('details',null,h('summary',null,'使用方法'),h('p',null,'输入 @ 选择帽子，名称后加空格，再写问题。选中候选只补全，点击发送才调用。'),h('p',null,'单独发送 @新讨论 开始独立讨论，不调用模型。@评审 生成决策卡；@六帽 执行深度评审，正常分别1次和6次调用。'),h('p',null,'只有消息开头的命令用于调用；单帽读取当前会话最近20条文本，上下文按完整消息选取，最多24000字符。')),
 h('fieldset',null,h('legend',null,'模型与数据'),h('p',null,'使用 DSH 全局默认模型。模型密钥和供应商请在宿主的模型设置中管理。'),h(DownloadLink,{path:'backup',filename:'sixhat-records-backup.json'},'备份全部评审记录'),h('p',null,'备份含原材料和模型请求，请妥善保管。')),
 h('details',null,h('summary',null,'Preview 说明'),h('p',null,'SixHat Compass · 0.1.0-preview.3 · 真人产品价值验证尚未完成；来源关联不代表事实核验。帽子由同一宿主模型调用，不是独立专家。停止后保留已接收内容，崩溃恢复以最后成功落盘检查点为准。')));
}
async function createHatDiscussion(ctx,sessionId){
 const spaces=ctx.workspaces.list.getSnapshot().items;const space=spaces.find(w=>w.sessionIds.includes(sessionId))||spaces[0];if(!space)throw Error('请先在 DSH 中选择工作区。');
 const id=await ctx.sessions.create({workspaceId:space.workspaceId});await ctx.uiWorkspace.openSession(id);return id;
}
function applyNative(ctx){
 ctx.effect(()=>{const style=document.createElement('style');style.textContent=nativeCss+recordsCss;document.head.append(style);return()=>style.remove()});
 const scope=ctx.configForms.get('hexamind');
 const claim=(session,hat,token)=>{let operationId,previous;return {name:'hexamind',token:token+' ',hint:hat==='new-discussion'?'发送即可新建独立讨论，不调用模型':'输入问题或粘贴计划；结合当前会话最近上下文',attachments:false,submit:async(args,_actx,attachments)=>{if(attachments.length)return {kind:'error',text:'帽子目前仅支持文本，请直接粘贴材料。'};if(hat==='new-discussion'){if(args.trim())return {kind:'error',text:'请单独发送 @新讨论，再在新对话中输入计划。'};try{await createHatDiscussion(ctx,session.sessionId);return {kind:'success'}}catch(e){return {kind:'error',text:e.message}}}if(!args.trim())return {kind:'error',text:'请输入评审问题或粘贴计划。'};if(/^@(白帽|红帽|黑帽|黄帽|绿帽|蓝帽)(?=$|[\s，,:：])/u.test(args.trim()))return {kind:'error',text:'一次只调用一顶帽子。'};if(args!==previous){operationId=crypto.randomUUID();previous=args}try{const result=await api('action',{kind:'nativeStart',request:{sessionId:session.sessionId,hat,text:args,operationId}});if(!result.accepted)return {kind:'error',text:'请求未确认受理，草稿已保留，请稍后重试。'};return {kind:'success'};}catch(e){return {kind:'error',text:e.message}}}};};
 ctx.effect(()=>ctx.inputTriggers.registerSource({trigger:'@',name:'六帽规划',order:-20,
  candidates:async(_session,req)=>{if(req.position!=='leading')return [];const prefs=scope.getSnapshot().value;const q=req.query.toLowerCase();const choices=nativeHats.map(([id,label,description])=>({name:label,description,hint:prefs?.enabled===false||prefs?.enabledHats&&!prefs.enabledHats.includes(id)?'已在设置中停用':'单次回复建议',value:id}));if(q)choices.push({name:'评审',description:'主动生成结构化决策卡',value:'structured'},{name:'六帽',description:'完整六帽深度评审，通常6次调用',value:'review'},{name:'新讨论',description:'新建独立帽子对话，不调用模型',value:'new-discussion'});return choices.filter(c=>!q||c.name.includes(q)||c.value.includes(q));},
  onPick:pick=>({claim:claim(pick.session,pick.candidate.value,'@'+pick.candidate.name)}),
  matchSpace:(session,token)=>{const route=nativeRoute(token);return route?{claim:claim(session,route.hat,route.token)}:undefined;},
  matchEnter:async(session,line,_signal,envelope)=>{const route=nativeRoute(line);if(!route)return;if(envelope.attachments)throw Error('帽子目前仅支持文本，附件和草稿已保留。');return {claim:claim(session,route.hat,route.token)};},
  lexicon:()=>Object.keys(nativeAliases),
 }));
 const nativeCommands=new Set();
 ctx.effect(()=>ctx.uiConversation.events.register({kind:'hexamind-native-command',target:'chat',
  match:event=>{if(event.type==='command/run'&&event.data.name==='hexamind'){nativeCommands.add(event.data.commandId);return {id:event.data.commandId,role:'start'};}if(event.type==='command/done'&&nativeCommands.has(event.data.commandId))return {id:event.data.commandId,role:'update'};return null;},
  start:(_context,match)=>({commandId:match.event.data.commandId,name:'hexamind',seq:match.event.seq,time:match.event.time,outcome:match.event.type==='command/done'?match.event.data:null}),
  update:(context,match)=>({...context.state,...(match.event.type==='command/done'?{outcome:match.event.data}:{})}),
  buildViewNode:context=>({key:context.key,id:context.id,kind:'hexamind-advice',target:'chat',anchorSeq:context.state.seq,location:context.start?.location||{kind:'unresolved'},visibility:'visible',data:context.state}),
 }));
 ctx.slots.inject('conversation.chat.node',()=>ctx.slots.register({name:'conversation.chat.node',key:'hexamind-advice'},props=>h(NativeReply,{node:props.node.data,scope})));
 ctx.slots.inject('conversation.chat.commandview',()=>ctx.slots.register({name:'conversation.chat.commandview',key:'hexamind'},()=>null));
 ctx.slots.inject('conversation.input.overlay',()=>ctx.slots.register({name:'conversation.input.overlay',id:'hexamind-input-guard',order:0,inject:sessionId=>{const actx=ctx.sessions.scope(sessionId);if(!actx)throw Error('六帽规划 session scope unavailable');return {actx,input:ctx.conversation.input.for(actx),session:{sessionId},claim};}},props=>h(NativeInputGuard,props)));
 ctx.slots.inject('settings.section',()=>ctx.slots.register({name:'settings.section',id:'hexamind',order:65,label:()=> '六帽规划'},()=>h(NativeSettings,{scope})));
}
