import type { Review } from './domain.js';
export declare function failureHelp(code?: string): {
    title: string;
    action: string;
};
export declare function recoveryInfo(review: Review): {
    title: string;
    action: string;
    canResume: boolean;
    nextHat: import("./domain.js").HatId | null;
    retainedStages: number;
    automaticRetriesUsed: number;
    automaticRetriesRemaining: number;
    errorCode: string | undefined;
};
export declare function queryHistory(reviews: Review[], params: URLSearchParams): {
    total: number;
    page: number;
    pageSize: number;
    pages: number;
    items: {
        id: string;
        title: string;
        state: import("./domain.js").WorkState;
        createdAt: string;
        updatedAt: string;
        mode: "review" | "single";
        cardVersion: number;
        callCount: number;
        completedStages: number;
        totalStages: number;
        needsAttention: boolean;
    }[];
};
