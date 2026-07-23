export type DailyPulseInput = { restaurantName: string; mostDiscussedItem: string; peakActivityHour: string; totalInteractions: number };
export type DailyPulseOutput = { pulseSummary: string; singleActionableRecommendation: string };
export async function generateDailyPulse(input: DailyPulseInput): Promise<DailyPulseOutput> {
  const res = await fetch('/api/ai/generate-daily-pulse', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) });
  if (!res.ok) throw new Error('AI request failed');
  return res.json();
}