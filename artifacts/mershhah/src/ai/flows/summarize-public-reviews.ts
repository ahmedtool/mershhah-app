export type SummarizePublicReviewsInput = { reviews: any[] };
export type SummarizePublicReviewsOutput = { summary: string };
export async function summarizePublicReviews(input: SummarizePublicReviewsInput): Promise<SummarizePublicReviewsOutput> {
  const res = await fetch('/api/ai/summarize-public-reviews', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) });
  if (!res.ok) throw new Error('AI request failed');
  return res.json();
}