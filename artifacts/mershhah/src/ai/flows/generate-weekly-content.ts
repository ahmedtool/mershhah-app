export type GenerateWeeklyContentInput = { restaurantName: string; restaurantType: string; optionalTheme?: string };
export type GenerateWeeklyContentOutput = { posts: Array<{ day: string; casualCopy: string; formalCopy: string; hashtags: string; cta: string }> };
export async function generateWeeklyContent(input: GenerateWeeklyContentInput): Promise<GenerateWeeklyContentOutput> {
  const res = await fetch('/api/ai/generate-weekly-content', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) });
  if (!res.ok) throw new Error('AI request failed');
  return res.json();
}