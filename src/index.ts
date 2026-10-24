import type { Context } from '@deepseek-ai/cordis';
import type {} from '@deepseek-ai/dsh-llm';
import type {} from '@deepseek-ai/dsh-host-webserver';
import type {} from '@deepseek-ai/dsh-agent-default-model';
import type {} from '@deepseek-ai/dsh-settings';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { ReviewController } from './review-controller.js';
import { DurableReviewStore } from './durable-store.js';
import { queryHistory, recoveryInfo, failureHelp } from './history.js';
import { exportMarkdown } from './card.js';
import { join } from 'node:path';
import { homedir } from 'node:os';
import z from '@deepseek-ai/schemastery';
import {mountNative,nativeSessionSummary,preferenceDefaults,type Preferences} from './native.js';
import {SessionId} from '@deepseek-ai/dsh-session/types';
import {HAT_ORDER} from './domain.js';
export const name = 'hexamind';
declare module '@deepseek-ai/cordis' {interface Events {'loader/volatile-update'(paths:readonly (readonly string[])[]):void}}
export const inject = ['llm', 'webServer', 'agentDefaultModel','commands','agents','sessions','settings'];
export const Config=z.object({
  storePath:z.string(),
  enabled:z.boolean().default(true).volatile(),
  enabledHats:z.array(z.union(HAT_ORDER.map(h=>z.const(h)))).default([...HAT_ORDER]).volatile(),
  replyLength:z.union(['brief','standard','detailed'].map(v=>z.const(v))).default('standard').volatile(),
  showUsage:z.boolean().default(false).volatile(),
});
type SettingsConfig={storePath?:string}&{[K in keyof Preferences]?:Preferences[K]|{get():Preferences[K]}};
function json(res: ServerResponse, status: number, data: unknown) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  res.end(JSON.stringify(data));
}
export function trusted(req: IncomingMessage): boolean {
  const address = req.socket.remoteAddress;
  if (!address || !['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(address)) return false;
  try {
    const target = new URL(`http://${req.headers.host}`);
    if (!['localhost', '127.0.0.1', '[::1]'].includes(target.hostname)) return false;
    if (req.headers['sec-fetch-site'] === 'cross-site') return false;
    if (req.headers.origin) return req.headers.origin === target.origin;
    return req.headers['sec-fetch-site'] === 'same-origin';
  } catch { return false; }
}
export function apply(ctx: Context, config: SettingsConfig = {}) {
  const store = new DurableReviewStore(config.storePath ?? join(process.env.DSH_HOME || join(homedir(), '.dsh'), 'storages', 'hexamind', 'reviews-v1.json'));
  const controller = new ReviewController({ selection: () => ctx.agentDefaultModel.currentSelection(), stream: o => ctx.llm.stream(o) }, store);
  const getPreferences=():Preferences=>Object.fromEntries(Object.entries(preferenceDefaults).map(([key,fallback])=>{const value=config[key as keyof Preferences];return [key,value&&typeof value==='object'&&!Array.isArray(value)&&'get' in value?value.get():value??fallback]})) as unknown as Preferences;
  if(!getPreferences().enabled)controller.disable();
  if(ctx.settings)ctx.effect(()=>ctx.settings.configure({auto:false}));
  ctx.on('loader/volatile-update',paths=>{if(!getPreferences().enabled)controller.disable();else if(paths.some(path=>path.includes('enabled')))controller.enabled=true;});
  const native=ctx.commands&&ctx.agents&&ctx.sessions?mountNative(ctx,controller,getPreferences):undefined;
  ctx.effect(() => {
    const removers = [ctx.webServer.register({ kind: 'exact', path: '/api/hexamind/state', handler: (req, res) => {
      if (!trusted(req)) return json(res, 403, { error: 'UNTRUSTED_ORIGIN' });
      if (req.method !== 'GET') return json(res, 405, { error: 'METHOD' });
      const params = new URL(req.url!, 'http://localhost').searchParams;
      const history=queryHistory(controller.reviews,params);const id=params.get('reviewId');
      const review = params.has('commandId')?controller.reviews.find(r=>r.native?.commandId===params.get('commandId'))??null:id==='new'?null:controller.reviews.find(r=>r.id===(id||history.items[0]?.id))??null;
      const safeReview = review ? { ...review, recovery:recoveryInfo(review),followups:review.followups.map(f=>({...f,recovery:{canRetry:['failed','cancelled','interrupted'].includes(f.state),...failureHelp(f.errorCode)}})),calls: review.calls.map(({ system, input, ...rest }) => rest) } : null;
      const nativeSession=review?.native&&ctx.sessions?.get(SessionId(review.native.sessionId));
      json(res, 200, { phase: 'Native Preview',version:'0.1.0-preview.3',productName:'SixHat Compass · 六帽规划',defaultMode:'hat-chat',preferences:getPreferences(),humanValidation:'not-completed', enabled: controller.enabled, busy: controller.busy, selection: ctx.agentDefaultModel.currentSelection(),
        storage:store.info,history,reviews:history.items,selectionMissing:!!id&&id!=='new'&&!review,review: safeReview,...(nativeSession?{nativeSessionStats:nativeSessionSummary(nativeSession)}:{}) });
    }}), ctx.webServer.register({ kind: 'exact', path: '/api/hexamind/action', handler: async (req, res) => {
      if (!trusted(req)) return json(res, 403, { error: 'UNTRUSTED_ORIGIN' });
      if (req.method !== 'POST') return json(res, 405, { error: 'METHOD' });
      try {
        const chunks: Buffer[] = []; let bytes = 0;
        for await (const chunk of req) { bytes += chunk.length; if (bytes > 600000) return json(res, 413, { error: 'BODY_TOO_LARGE' }); chunks.push(Buffer.from(chunk)); }
        const action = JSON.parse(Buffer.concat(chunks).toString('utf8'));
        if (!action || typeof action !== 'object') return json(res, 400, { error: 'INVALID_INPUT' });
        if(action.kind==='native'){if(!native)return json(res,503,{error:'NATIVE_UNAVAILABLE'});return json(res,200,await native.submit(action.request));}
        if(action.kind==='nativeStart'){if(!native)return json(res,503,{error:'NATIVE_UNAVAILABLE'});return json(res,202,await native.accept(action.request));}
        if (action.kind === 'review' || action.kind === 'deepReview' || action.kind === 'single') {
          if (typeof action.text !== 'string' || typeof action.goal !== 'string') return json(res, 400, { error: 'INVALID_INPUT' });
          return json(res, 202, { reviewId: controller.start(action.text, action.goal, action.kind === 'single' ? 'single' : action.kind==='deepReview'?'review':'structured', action.hat).id });
        }
        if (action.kind === 'followup') {
          if (typeof action.reviewId !== 'string' || typeof action.claimId !== 'string' || typeof action.text !== 'string') return json(res, 400, { error: 'INVALID_INPUT' });
          return json(res, 202, { reviewId: controller.followup(action.reviewId, action.claimId, action.text, action.hat).id });
        }
        if (action.kind === 'resume') { if (typeof action.reviewId !== 'string') return json(res, 400, { error: 'INVALID_INPUT' }); return json(res, 202, { reviewId: controller.resume(action.reviewId,action.operationId).id }); }
        if(action.kind==='retryFollowup'){
          if(typeof action.reviewId!=='string'||typeof action.followupId!=='string')return json(res,400,{error:'INVALID_INPUT'});
          return json(res,202,{reviewId:controller.retryFollowup(action.reviewId,action.followupId,action.operationId).id});
        }
        if (action.kind === 'editCard') { controller.editCard(action.reviewId, action.version, action.card); return json(res, 200, { saved: true }); }
        if (action.kind === 'stop') controller.cancel();
        else if (action.kind === 'disable') controller.disable();
        else if (action.kind === 'enable') controller.enabled = true;
        else return json(res, 400, { error: 'UNKNOWN_ACTION' });
        json(res, 200, { enabled: controller.enabled });
      } catch (error) {
        const codes = ['BUSY','DISABLED','HAT_DISABLED','NATIVE_COMMAND_FAILED','SESSION_FLUSH_FAILED','INVALID_INPUT','INVALID_MODE','NO_DEFAULT_MODEL','ONE_HAT_REQUIRED','INVALID_HAT','INVALID_TARGET','NOT_FOUND','NOT_RECOVERABLE','NO_CARD','CARD_CONFLICT','STORE_WRITE_FAILED','STORE_CHANGED_EXTERNALLY','INVALID_OPERATION_ID','OPERATION_CONFLICT'];
        const code = error instanceof Error && codes.includes(error.message) ? error.message : 'INVALID_CARD_OR_REQUEST';
        json(res, ['BUSY','DISABLED','CARD_CONFLICT'].includes(code) ? 409 : code === 'STORE_WRITE_FAILED' ? 503 : 400, { error: code });
      }
    }}), ctx.webServer.register({ kind: 'exact', path: '/api/hexamind/export', handler: (req, res) => {
      if (!trusted(req)) return json(res, 403, { error: 'UNTRUSTED_ORIGIN' });
      if (req.method !== 'GET') return json(res, 405, { error: 'METHOD' });
      try {
        const id = new URL(req.url!, 'http://localhost').searchParams.get('reviewId') ?? '';
        const review = controller.find(id); const markdown = exportMarkdown(review);
        res.writeHead(200, { 'content-type': 'text/markdown; charset=utf-8', 'cache-control':'no-store', 'content-disposition': `attachment; filename="hexamind-${review.id}.md"` }); res.end(markdown);
      } catch { json(res, 400, { error:'NO_CARD' }); }
    }}),ctx.webServer.register({kind:'exact',path:'/api/hexamind/backup',handler:(req,res)=>{
      if(!trusted(req))return json(res,403,{error:'UNTRUSTED_ORIGIN'});
      if(req.method!=='GET')return json(res,405,{error:'METHOD'});
      try{const snapshot=store.snapshot();res.writeHead(200,{'content-type':'application/json; charset=utf-8','cache-control':'no-store','content-disposition':'attachment; filename="hexamind-records-backup.json"'});res.end(snapshot)}catch{json(res,503,{error:'STORE_WRITE_FAILED'});}
    }})];
    return async () => { controller.disable(); native?.dispose(); removers.forEach(remove => remove()); await controller.settled(); store.close(); };
  }, 'hexamind routes and cancellation');
}
