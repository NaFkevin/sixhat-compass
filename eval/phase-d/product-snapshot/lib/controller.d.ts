import type { GenerateOptions, StreamChunk, TokenUsage } from '@deepseek-ai/dsh-llm';
import type { HatId, RunState } from './domain.js';
export interface Selection {
    provider: string;
    model: string;
    reasoningEffort?: GenerateOptions['reasoningEffort'];
}
export interface Run {
    id: string;
    hat: HatId;
    strategyVersion: string;
    state: RunState;
    selection: Selection;
    input: string;
    system: string;
    text: string;
    startedAt: string;
    endedAt?: string;
    errorCode?: string;
    usage?: TokenUsage;
    logicalCalls: number;
    observableStreamAttempts: number;
}
export interface Adapter {
    selection(): Selection;
    stream(options: GenerateOptions): AsyncIterable<StreamChunk>;
}
/** One-shot Phase A controller. No retries, tool execution, recursion, or meeting scheduling. */
export declare class Controller {
    private adapter;
    private timeoutMs;
    runs: Run[];
    enabled: boolean;
    private active?;
    constructor(adapter: Adapter, timeoutMs?: number);
    start(hat: HatId, input: string): Run;
    cancel(): void;
    disable(): void;
    private execute;
}
