import { callAiApi } from '@/ai/call-ai-api';

export type AnalyzeReviewsInput = { reviews: Array<{ rating: number; comment?: string }>; restaurantName: string };
export type AnalyzeReviewsOutput = { positiveThemes: string[]; negativeThemes: string[]; actionableInsight: string; sentimentScore: number };
export async function analyzeReviews(input: AnalyzeReviewsInput): Promise<AnalyzeReviewsOutput> {
  return callAiApi('analyze-reviews', input);
}