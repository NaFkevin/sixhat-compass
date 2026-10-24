export type HatId = 'white' | 'red' | 'black' | 'yellow' | 'green' | 'blue';
export type RunState = 'running' | 'completed' | 'failed' | 'cancelled';
export type ModelBinding = { mode: 'inherit-global' } | { mode: 'fixed'; provider: string; model: string };
export interface Claim {
  id: string;
  text: string;
  origin: 'user-material' | 'ai-analysis' | 'external-source';
  verification: 'unverified' | 'supported' | 'conflicting' | 'insufficient';
  sourceMessageIds: string[];
  evidenceIds: string[];
}
export interface DecisionCard {
  schemaVersion: 1;
  decision: string;
  claims: Claim[];
  assumptions: string[];
  risks: string[];
  alternatives: string[];
  disagreements: string[];
  experiments: { action: string; metric: string; passCondition: string }[];
  humanDecision: { author: 'user'; text: string } | null;
}
export const REVIEW_BUDGET = { normalSteps: 6, retriesPerStep: 1, retriesPerReview: 2 } as const;
export const HAT_ORDER: HatId[] = ['white', 'red', 'black', 'yellow', 'green', 'blue'];
export type WorkState = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled' | 'interrupted';
export interface HatResult { summary: string; observations: { text: string; sourceMessageIds: string[] }[]; questions: string[] }
export interface ReviewMessage {
  id: string; author: 'user' | HatId; kind: 'material' | 'analysis' | 'question' | 'followup';
  text: string; createdAt: string; mentionIds: HatId[]; callId?: string; targetClaimId?: string;
}
export interface ModelCall {
  id: string; hat: HatId; purpose: 'structured' | 'review' | 'single' | 'followup' | 'followup-retry' | 'auto-retry' | 'manual-retry';
  step: number; state: WorkState; strategyVersion: string;
  selection: { provider: string; model: string; reasoningEffort?: string };
  system: string; input: string; contextMessageIds: string[]; text: string;
  createdAt: string; endedAt?: string; errorCode?: string; validationError?: string;
  usage?: import('@deepseek-ai/dsh-llm').TokenUsage;
  parentCallId?: string; targetClaimId?: string; transportAttempts: null;
  operationId?: string; checkpointAt?: string;
}
export interface Stage { hat: HatId; state: WorkState; automaticRetries: number; messageId?: string; result?: HatResult }
export interface CardRevision { version: number; author: 'ai' | 'user'; createdAt: string; card: DecisionCard }
export interface Followup {
  id: string; hat: HatId; targetClaimId: string; questionMessageId: string; state: WorkState; messageId?: string;
  claimSnapshot?: Claim; cardVersion?: number; callId?: string; errorCode?: string;
}
export interface NativeBinding {
  sessionId: string; commandId: string; operationId: string; requestHash: string;
  question: string; replyLength: 'brief' | 'standard' | 'detailed';
  context: { id: string; role: string; text: string }[];
  contextOmitted: number;
}
export interface Review {
  schemaVersion: 1; id: string; title: string; goal: string; mode: 'structured' | 'review' | 'single' | 'hat-chat';
  native?: NativeBinding;
  state: WorkState; createdAt: string; updatedAt: string; materialMessageId: string;
  stages: Stage[]; messages: ReviewMessage[]; calls: ModelCall[];
  automaticRetries: number; card: DecisionCard | null; cardVersion: number; cardRevisions: CardRevision[];
  evidence: { id: string; url: string; verificationRecord: string }[];
  followups: Followup[];
  operations?: { id: string; kind: 'resume' | 'followup-retry'; sourceId?: string; createdAt: string }[];
  storageError?: string;
}
