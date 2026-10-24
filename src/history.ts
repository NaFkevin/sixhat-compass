import type { Review } from './domain.js';
export function failureHelp(code?: string): { title: string; action: string } {
  const map: Record<string, [string,string]> = {
    AUTH:['模型认证失败','请在宿主修复凭据，再手动重试。'],
    MISSING_CREDENTIAL:['尚未配置模型凭据','请在宿主配置模型凭据，再手动重试。'],
    UNKNOWN_MODEL:['所选模型不可用','请在宿主选择可用的默认模型，再手动重试。'],
    INVALID_REQUEST:['模型请求被拒绝','请核对宿主默认模型名称与供应商配置，再手动重试。'],
    NO_DEFAULT_MODEL:['没有可用的默认模型','请先在宿主选择默认模型。'],
    RATE_LIMIT:['供应商请求限流','等待限制解除后手动重试。'],
    TIMEOUT:['模型响应超时','部分正文已保留，检查网络或模型后重试。'],
    INVALID_OUTPUT:['输出结构或来源校验失败','保留失败输出；重试会重新生成，不会补造证据。'],
    HOST_RESTART:['宿主运行期间中断','已恢复最后保存的内容；点击恢复才会重新调用。'],
    CANCELLED:['已停止','已接收内容保留；可以手动恢复未完成步骤。'],
    STORE_WRITE_FAILED:['本地保存失败','请先处理磁盘或权限问题，再启用并恢复。'],
    STORE_CHANGED_EXTERNALLY:['存储被其他程序修改','停止另一写入进程，检查备份后重启宿主。'],
    FINISH_MAX_TOKENS:['输出达到上限','保留部分内容；可调整宿主模型后重试。'],
    'FINISH_max-tokens':['输出达到上限','保留部分内容；可调整宿主模型后重试。']
  };
  const value=map[code||'']||['本次调用未完成','查看错误码和已保留内容，检查宿主模型后手动重试。'];
  return {title:value[0],action:value[1]};
}
export function recoveryInfo(review: Review) {
  const next=review.stages.find(s=>s.state!=='completed');
  const last=review.calls.filter(c=>c.step>=0).at(-1);
  const error=review.storageError || (review.state==='interrupted'?'HOST_RESTART':review.state==='cancelled'?'CANCELLED':last?.errorCode);
  return { canResume:['failed','cancelled','interrupted'].includes(review.state), nextHat:next?.hat??null,
    retainedStages:review.stages.filter(s=>s.state==='completed').length, automaticRetriesUsed:review.automaticRetries,
    automaticRetriesRemaining:Math.max(0,(['structured','hat-chat'].includes(review.mode)?1:2)-review.automaticRetries), errorCode:error, ...failureHelp(error) };
}
export function queryHistory(reviews: Review[], params: URLSearchParams) {
  const search=(params.get('search')||'').trim().toLocaleLowerCase().slice(0,500);
  const filter=params.get('filter')||'all';
  const filtered=reviews.filter(r=> {
    const issue=['failed','cancelled','interrupted'].includes(r.state)||!!r.storageError||r.followups.some(f=>['failed','cancelled','interrupted'].includes(f.state));
    if(filter==='attention'&&!issue)return false;
    if(!['all','attention'].includes(filter)&&r.state!==filter)return false;
    return !search||[r.title,r.goal,r.messages.find(m=>m.id===r.materialMessageId)?.text||''].some(s=>s.toLocaleLowerCase().includes(search));
  }).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt)||b.createdAt.localeCompare(a.createdAt)||a.id.localeCompare(b.id));
  const sizeValue=Number(params.get('pageSize')||15);const pageSize=Number.isFinite(sizeValue)?Math.min(30,Math.max(1,Math.floor(sizeValue))):15;
  const pages=Math.max(1,Math.ceil(filtered.length/pageSize));const pageValue=Number(params.get('page')||1);
  const page=Number.isFinite(pageValue)?Math.min(pages,Math.max(1,Math.floor(pageValue))):1;
  return { total:filtered.length,page,pageSize,pages,items:filtered.slice((page-1)*pageSize,page*pageSize).map(r=>({id:r.id,title:r.title,state:r.state,createdAt:r.createdAt,updatedAt:r.updatedAt,mode:r.mode,cardVersion:r.cardVersion,
    callCount:r.calls.length,completedStages:r.stages.filter(s=>s.state==='completed').length,totalStages:r.stages.length,needsAttention:['failed','cancelled','interrupted'].includes(r.state)||!!r.storageError||r.followups.some(f=>['failed','cancelled','interrupted'].includes(f.state))})) };
}
