import type { Review } from './domain.js';
import type { ReviewStore } from './store.js';
export declare class DurableReviewStore implements ReviewStore {
    readonly file: string;
    reviews: Review[];
    readonly info: {
        schemaVersion: 2;
        generation: number;
        migratedFrom?: number;
        recoveryNotice?: string;
        backupAvailable: boolean;
    };
    private token;
    private closed;
    constructor(file: string);
    private acquire;
    private atomic;
    save(): void;
    snapshot(): string;
    close(): void;
}
