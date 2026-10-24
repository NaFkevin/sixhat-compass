import { randomUUID } from 'node:crypto';
import { strategies } from './strategies.js';
/** One-shot Phase A controller. No retries, tool execution, recursion, or meeting scheduling. */
export class Controller {
    adapter;
    timeoutMs;
    runs = [];
    enabled = true;
    active;
    constructor(adapter, timeoutMs = 120_000) {
        this.adapter = adapter;
        this.timeoutMs = timeoutMs;
    }
    start(hat, input) {
        if (!this.enabled)
            throw new Error('DISABLED');
        if (this.active)
            throw new Error('BUSY');
        if (!Object.hasOwn(strategies, hat) || !input.trim() || input.length > 16000)
            throw new Error('INVALID_INPUT');
        const selection = { ...this.adapter.selection() };
        if (!selection.provider || !selection.model)
            throw new Error('NO_DEFAULT_MODEL');
        const run = { id: randomUUID(), hat, strategyVersion: strategies[hat].version, state: 'running', selection,
            input, system: strategies[hat].system, text: '', startedAt: new Date().toISOString(), logicalCalls: 1, observableStreamAttempts: 0 };
        this.runs.push(run);
        if (this.runs.length > 30)
            this.runs.shift();
        const abort = new AbortController();
        this.active = { run, abort };
        void this.execute(run, abort);
        return run;
    }
    cancel() {
        const active = this.active;
        if (!active)
            return;
        active.run.state = 'cancelled';
        active.run.endedAt = new Date().toISOString();
        active.abort.abort();
        this.active = undefined;
    }
    disable() { this.enabled = false; this.cancel(); }
    async execute(run, abort) {
        const timer = setTimeout(() => {
            if (run.state === 'running') {
                run.state = 'failed';
                run.errorCode = 'TIMEOUT';
                run.endedAt = new Date().toISOString();
                abort.abort();
                if (this.active?.run === run)
                    this.active = undefined;
            }
        }, this.timeoutMs);
        try {
            run.observableStreamAttempts++;
            let finished = false;
            for await (const chunk of this.adapter.stream({ ...run.selection, system: run.system,
                messages: [{ role: 'user', content: [{ type: 'text', text: run.input }] }],
                tools: [], signal: abort.signal, maxTokens: 2048 })) {
                if (abort.signal.aborted || run.state !== 'running')
                    break;
                if (chunk.type === 'text-delta')
                    run.text += chunk.text;
                if (chunk.type === 'usage')
                    run.usage = chunk.usage;
                if (chunk.type === 'finish') {
                    finished = true;
                    if (chunk.reason.kind === 'stop' && run.text.trim())
                        run.state = 'completed';
                    else if (chunk.reason.kind === 'aborted')
                        run.state = 'cancelled';
                    else {
                        run.state = 'failed';
                        run.errorCode = chunk.reason.kind === 'error' ? chunk.reason.failure.code : `FINISH_${chunk.reason.kind}`;
                    }
                    break;
                }
            }
            if (!finished && run.state === 'running') {
                run.state = 'failed';
                run.errorCode = 'MISSING_FINISH';
            }
        }
        catch {
            if (run.state === 'running') {
                run.state = 'failed';
                run.errorCode = 'STREAM_EXCEPTION';
            }
        }
        finally {
            clearTimeout(timer);
            run.endedAt ??= new Date().toISOString();
            if (this.active?.run === run)
                this.active = undefined;
        }
    }
}
//# sourceMappingURL=controller.js.map