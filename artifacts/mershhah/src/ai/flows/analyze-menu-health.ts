export type AnalyzeMenuHealthInput = { menuItems: any[]; restaurantName: string };
export type AnalyzeMenuHealthOutput = { healthScore: number; insights: string[]; recommendations: string[] };
export async function analyzeMenuHealth(input: AnalyzeMenuHealthInput): Promise<AnalyzeMenuHealthOutput> {
  const res = await fetch('/api/ai/analyze-menu-health', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) });
  if (!res.ok) throw new Error('AI request failed');
  return res.json();
}