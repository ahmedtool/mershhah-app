import { callAiApi } from '@/ai/call-ai-api';

export type SummarizePublicReviewsInput = { reviews: any[] };
export type SummarizePublicReviewsOutput = { summary: string };
export async function summarizePublicReviews(input: SummarizePublicReviewsInput): Promise<SummarizePublicReviewsOutput> {
  return callAiApi('summarize-public-reviews', input);
}