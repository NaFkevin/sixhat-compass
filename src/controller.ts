import { randomUUID } from 'node:crypto';
import type { GenerateOptions, StreamChunk, TokenUsage } from '@deepseek-ai/dsh-llm';
import type { HatId, RunState } from './domain.js';
import { strategies } from './strategies.js';
export interface Selection { provider: string; model: string; reasoningEffort?: GenerateOptions['reasoningEffort'] }
export interface Run {
  id: string; hat: HatId; strategyVersion: string; state: RunState;
  selection: Selection; input: string; system: string; text: string;
  startedAt: string; endedAt?: string; errorCode?: string; usage?: TokenUsage;
  logicalCalls: number; observableStreamAttempts: number;
}
export interface Adapter {
  selection(): Selection;
  stream(options: GenerateOptions): AsyncIterable<StreamChunk>;
}
/** One-shot Phase A controller. No retries, tool execution, recursion, or meeting scheduling. */
export class Controller {
  runs: Run[] = [];
  enabled = true;
  private active?: { run: Run; abort: AbortController };
  constructor(private adapter: Adapter, private timeoutMs = 120_000) {}
  start(hat: HatId, input: string): Run {
    if (!this.enabled) throw new Error('DISABLED');
    if (this.active) throw new Error('BUSY');
    if (!Object.hasOwn(strategies, hat) || !input.trim() || input.length > 16000) throw new Error('INVALID_INPUT');
    const selection = { ...this.adapter.selection() };
    if (!selection.provider || !selection.model) throw new Error('NO_DEFAULT_MODEL');
    const run: Run = { id: randomUUID(), hat, strategyVersion: strategies[hat].version, state: 'running', selection,
      input, system: strategies[hat].system, text: '', startedAt: new Date().toISOString(), logicalCalls: 1, observableStreamAttempts: 0 };
    this.runs.push(run);
    if (this.runs.length > 30) this.runs.shift();
    const abort = new AbortController();
    this.active = { run, abort };
    void this.execute(run, abort);
    return run;
  }
  cancel(): void {
    const active = this.active;
    if (!active) return;
    active.run.state = 'cancelled';
    active.run.endedAt = new Date().toISOString();
    active.abort.abort();
    this.active = undefined;
  }
  disable(): void { this.enabled = false; this.cancel(); }
  private async execute(run: Run, abort: AbortController): Promise<void> {
    const timer = setTimeout(() => {
      if (run.state === 'running') {
        run.state = 'failed'; run.errorCode = 'TIMEOUT'; run.endedAt = new Date().toISOString();
        abort.abort();
        if (this.active?.run === run) this.active = undefined;
      }
    }, this.timeoutMs);
    try {
      run.observableStreamAttempts++;
      let finished = false;
      for await (const chunk of this.adapter.stream({ ...run.selection, system: run.system,
        messages: [{ role: 'user', content: [{ type: 'text', text: run.input }] }],
        tools: [], signal: abort.signal, maxTokens: 2048 })) {
        if (abort.signal.aborted || run.state !== 'running') break;
        if (chunk.type === 'text-delta') run.text += chunk.text;
        if (chunk.type === 'usage') run.usage = chunk.usage;
        if (chunk.type === 'finish') {
          finished = true;
          if (chunk.reason.kind === 'stop' && run.text.trim()) run.state = 'completed';
          else if (chunk.reason.kind === 'aborted') run.state = 'cancelled';
          else { run.state = 'failed'; run.errorCode = chunk.reason.kind === 'error' ? chunk.reason.failure.code : `FINISH_${chunk.reason.kind}`; }
          break;
        }
      }
      if (!finished && run.state === 'running') { run.state = 'failed'; run.errorCode = 'MISSING_FINISH'; }
    } catch {
      if (run.state === 'running') { run.state = 'failed'; run.errorCode = 'STREAM_EXCEPTION'; }
    } finally {
      clearTimeout(timer);
      run.endedAt ??= new Date().toISOString();
      if (this.active?.run === run) this.active = undefined;
    }
  }
}
