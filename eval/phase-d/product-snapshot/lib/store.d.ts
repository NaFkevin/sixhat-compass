import type { Review } from './domain.js';
export interface ReviewStore {
    reviews: Review[];
    save(): void;
}
export declare class FileReviewStore implements ReviewStore {
    readonly file: string;
    reviews: Review[];
    constructor(file: string);
    save(): void;
}
