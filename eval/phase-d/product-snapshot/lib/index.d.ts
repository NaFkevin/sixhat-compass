import type { Context } from '@deepseek-ai/cordis';
import type { IncomingMessage } from 'node:http';
export declare const name = "hexamind";
export declare const inject: string[];
export declare function trusted(req: IncomingMessage): boolean;
export declare function apply(ctx: Context, config?: {
    storePath?: string;
}): void;
