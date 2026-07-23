export type AnalyzeReviewsInput = { reviews: Array<{ rating: number; comment?: string }>; restaurantName: string };
export type AnalyzeReviewsOutput = { positiveThemes: string[]; negativeThemes: string[]; actionableInsight: string; sentimentScore: number };
export async function analyzeReviews(input: AnalyzeReviewsInput): Promise<AnalyzeReviewsOutput> {
  const res = await fetch('/api/ai/analyze-reviews', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) });
  if (!res.ok) throw new Error('AI request failed');
  return res.json();
}