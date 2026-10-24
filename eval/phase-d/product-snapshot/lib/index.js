import { ReviewController } from './review-controller.js';
import { DurableReviewStore } from './durable-store.js';
import { queryHistory, recoveryInfo, failureHelp } from './history.js';
import { exportMarkdown } from './card.js';
import { join } from 'node:path';
import { homedir } from 'node:os';
export const name = 'hexamind';
export const inject = ['llm', 'webServer', 'agentDefaultModel'];
function json(res, status, data) {
    res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
    res.end(JSON.stringify(data));
}
export function trusted(req) {
    const address = req.socket.remoteAddress;
    if (!address || !['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(address))
        return false;
    try {
        const target = new URL(`http://${req.headers.host}`);
        if (!['localhost', '127.0.0.1', '[::1]'].includes(target.hostname))
            return false;
        if (req.headers['sec-fetch-site'] === 'cross-site')
            return false;
        if (req.headers.origin)
            return req.headers.origin === target.origin;
        return req.headers['sec-fetch-site'] === 'same-origin';
    }
    catch {
        return false;
    }
}
export function apply(ctx, config = {}) {
    const store = new DurableReviewStore(config.storePath ?? join(process.env.DSH_HOME || join(homedir(), '.dsh'), 'storages', 'hexamind', 'reviews-v1.json'));
    const controller = new ReviewController({ selection: () => ctx.agentDefaultModel.currentSelection(), stream: o => ctx.llm.stream(o) }, store);
    ctx.effect(() => {
        const removers = [ctx.webServer.register({ kind: 'exact', path: '/api/hexamind/state', handler: (req, res) => {
                    if (!trusted(req))
                        return json(res, 403, { error: 'UNTRUSTED_ORIGIN' });
                    if (req.method !== 'GET')
                        return json(res, 405, { error: 'METHOD' });
                    const params = new URL(req.url, 'http://localhost').searchParams;
                    const history = queryHistory(controller.reviews, params);
                    const id = params.get('reviewId');
                    const review = id === 'new' ? null : controller.reviews.find(r => r.id === (id || history.items[0]?.id)) ?? null;
                    const safeReview = review ? { ...review, recovery: recoveryInfo(review), followups: review.followups.map(f => ({ ...f, recovery: { canRetry: ['failed', 'cancelled', 'interrupted'].includes(f.state), ...failureHelp(f.errorCode) } })), calls: review.calls.map(({ system, input, ...rest }) => rest) } : null;
                    json(res, 200, { phase: 'C', enabled: controller.enabled, busy: controller.busy, selection: ctx.agentDefaultModel.currentSelection(),
                        storage: store.info, history, reviews: history.items, selectionMissing: !!id && id !== 'new' && !review, review: safeReview });
                } }), ctx.webServer.register({ kind: 'exact', path: '/api/hexamind/action', handler: async (req, res) => {
                    if (!trusted(req))
                        return json(res, 403, { error: 'UNTRUSTED_ORIGIN' });
                    if (req.method !== 'POST')
                        return json(res, 405, { error: 'METHOD' });
                    try {
                        const chunks = [];
                        let bytes = 0;
                        for await (const chunk of req) {
                            bytes += chunk.length;
                            if (bytes > 600000)
                                return json(res, 413, { error: 'BODY_TOO_LARGE' });
                            chunks.push(Buffer.from(chunk));
                        }
                        const action = JSON.parse(Buffer.concat(chunks).toString('utf8'));
                        if (!action || typeof action !== 'object')
                            return json(res, 400, { error: 'INVALID_INPUT' });
                        if (action.kind === 'review' || action.kind === 'single') {
                            if (typeof action.text !== 'string' || typeof action.goal !== 'string')
                                return json(res, 400, { error: 'INVALID_INPUT' });
                            return json(res, 202, { reviewId: controller.start(action.text, action.goal, action.kind === 'single' ? 'single' : 'review', action.hat).id });
                        }
                        if (action.kind === 'followup') {
                            if (typeof action.reviewId !== 'string' || typeof action.claimId !== 'string' || typeof action.text !== 'string')
                                return json(res, 400, { error: 'INVALID_INPUT' });
                            return json(res, 202, { reviewId: controller.followup(action.reviewId, action.claimId, action.text, action.hat).id });
                        }
                        if (action.kind === 'resume') {
                            if (typeof action.reviewId !== 'string')
                                return json(res, 400, { error: 'INVALID_INPUT' });
                            return json(res, 202, { reviewId: controller.resume(action.reviewId, action.operationId).id });
                        }
                        if (action.kind === 'retryFollowup') {
                            if (typeof action.reviewId !== 'string' || typeof action.followupId !== 'string')
                                return json(res, 400, { error: 'INVALID_INPUT' });
                            return json(res, 202, { reviewId: controller.retryFollowup(action.reviewId, action.followupId, action.operationId).id });
                        }
                        if (action.kind === 'editCard') {
                            controller.editCard(action.reviewId, action.version, action.card);
                            return json(res, 200, { saved: true });
                        }
                        if (action.kind === 'stop')
                            controller.cancel();
                        else if (action.kind === 'disable')
                            controller.disable();
                        else if (action.kind === 'enable')
                            controller.enabled = true;
                        else
                            return json(res, 400, { error: 'UNKNOWN_ACTION' });
                        json(res, 200, { enabled: controller.enabled });
                    }
                    catch (error) {
                        const codes = ['BUSY', 'DISABLED', 'INVALID_INPUT', 'NO_DEFAULT_MODEL', 'ONE_HAT_REQUIRED', 'INVALID_HAT', 'INVALID_TARGET', 'NOT_FOUND', 'NOT_RECOVERABLE', 'NO_CARD', 'CARD_CONFLICT', 'STORE_WRITE_FAILED', 'STORE_CHANGED_EXTERNALLY', 'INVALID_OPERATION_ID', 'OPERATION_CONFLICT'];
                        const code = error instanceof Error && codes.includes(error.message) ? error.message : 'INVALID_CARD_OR_REQUEST';
                        json(res, ['BUSY', 'DISABLED', 'CARD_CONFLICT'].includes(code) ? 409 : code === 'STORE_WRITE_FAILED' ? 503 : 400, { error: code });
                    }
                } }), ctx.webServer.register({ kind: 'exact', path: '/api/hexamind/export', handler: (req, res) => {
                    if (!trusted(req))
                        return json(res, 403, { error: 'UNTRUSTED_ORIGIN' });
                    if (req.method !== 'GET')
                        return json(res, 405, { error: 'METHOD' });
                    try {
                        const id = new URL(req.url, 'http://localhost').searchParams.get('reviewId') ?? '';
                        const review = controller.find(id);
                        const markdown = exportMarkdown(review);
                        res.writeHead(200, { 'content-type': 'text/markdown; charset=utf-8', 'cache-control': 'no-store', 'content-disposition': `attachment; filename="hexamind-${review.id}.md"` });
                        res.end(markdown);
                    }
                    catch {
                        json(res, 400, { error: 'NO_CARD' });
                    }
                } }), ctx.webServer.register({ kind: 'exact', path: '/api/hexamind/backup', handler: (req, res) => {
                    if (!trusted(req))
                        return json(res, 403, { error: 'UNTRUSTED_ORIGIN' });
                    if (req.method !== 'GET')
                        return json(res, 405, { error: 'METHOD' });
                    try {
                        const snapshot = store.snapshot();
                        res.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'content-disposition': 'attachment; filename="hexamind-records-backup.json"' });
                        res.end(snapshot);
                    }
                    catch {
                        json(res, 503, { error: 'STORE_WRITE_FAILED' });
                    }
                } })];
        return async () => { controller.disable(); removers.forEach(remove => remove()); await controller.settled(); store.close(); };
    }, 'hexamind routes and cancellation');
}
//# sourceMappingURL=index.js.map