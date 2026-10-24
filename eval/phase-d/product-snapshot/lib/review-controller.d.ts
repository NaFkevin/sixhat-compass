import type { Adapter } from './controller.js';
import { type Review } from './domain.js';
import type { ReviewStore } from './store.js';
export declare class ReviewController {
    private adapter;
    readonly store: ReviewStore;
    enabled: boolean;
    private active?;
    private timeoutMs;
    private checkpointMs;
    constructor(adapter: Adapter, store: ReviewStore, options?: {
        timeoutMs?: number;
        checkpointMs?: number;
    });
    get reviews(): Review[];
    get busy(): boolean;
    private requireReady;
    private persist;
    find(id: string): Review;
    start(text: string, goal: string, mode?: 'review' | 'single', fallback?: unknown): Review;
    private alreadyRecorded;
    resume(id: string, operationId?: string): Review;
    followup(id: string, targetClaimId: string, text: string, fallback: unknown): Review;
    retryFollowup(id: string, followupId: string, operationId?: string): Review;
    private executeFollowup;
    editCard(id: string, expectedVersion: number, value: unknown): Review;
    private setCard;
    settled(): Promise<void>;
    cancel(): void;
    disable(): void;
    private safePersist;
    private launch;
    private addMessage;
    private executeReview;
    private attempt;
}
