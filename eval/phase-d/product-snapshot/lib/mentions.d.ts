import type { HatId } from './domain.js';
/** Ignore quoted lines, fenced code and inline code. Routing stores stable IDs. */
export declare function mentionIds(text: string): HatId[];
export declare function resolveHat(text: string, fallback: unknown): HatId;
