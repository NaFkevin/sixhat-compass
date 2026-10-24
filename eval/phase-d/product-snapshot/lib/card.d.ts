import type { DecisionCard, HatResult, Review } from './domain.js';
export declare function parseJson(text: string): unknown;
export declare function validateHat(value: unknown, known: Set<string>): HatResult;
export declare function validateCard(value: unknown, review: Review, author: 'ai' | 'user'): DecisionCard;
export declare function exportMarkdown(review: Review): string;
