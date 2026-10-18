export const KNOWLEDGE_BASE = '任德耀新建华为PC知识库';
export interface GenerationTask {
  modelId: string; scenario: string; platform: string; goal: string; withPrice: boolean;
  audience: string; customerQuote: string; buyingStage: string; identity: string; software: string;
}
export interface GenerationRequest {
  task: GenerationTask; revision?: string; previous?: { title: string; body: string };
}
export interface Fact {
  id: string; claim: string; quote: string; title: string; entryId: string; location: string;
  date: string; identity: string; conditions: string; knowledgeBase: string; verifiedAt: string;
}
export interface SourceImage {
  id: string; filename: string; url: string; title: string; entryId: string; location: string;
  date: string; identity: string; conditions: string; knowledgeBase: string; verifiedAt: string;
  caption: string; placement: string;
}
export interface ClaimCheck { text: string; factIds: string[]; status: 'pending-human-review'; section?: 'title' | 'body' | 'cta' | 'price' }
export interface PriceQuote {
  knowledgeBase: string; identity: string; title: string; entryId: string; location: string;
  date: string; quote: string; sku: string; quantity: number; unitPrice: number;
  currency: 'CNY'; channel: string; conditions: string; currentVerified: true; currentVerifiedAt: string;
}
export interface GenerationResponse {
  ok: boolean; status: 'blocked' | 'draft'; message: string; issues: string[];
  title?: string; body?: string; cta?: string; tags?: string[];
  titleFactIds?: string[]; ctaFactIds?: string[];
  facts?: Fact[]; images?: SourceImage[]; claimChecks?: ClaimCheck[]; generatedAt?: string;
  priceQuote?: PriceQuote & { total: number; calculation: string };
  verification?: { status: 'pending-human-review'; issues: string[] };
}
export interface ServiceStatus {
  knowledgeBase: ConnectionStatus & { name: string }; model: ConnectionStatus;
}
export interface ConnectionStatus {
  status: 'unconfigured' | 'verified' | 'failed'; message: string; checkedAt?: string;
}
