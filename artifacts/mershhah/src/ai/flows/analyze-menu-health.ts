import { callAiApi } from '@/ai/call-ai-api';

export type AnalyzeMenuHealthInput = { menuItems: any[]; restaurantName: string };
export type AnalyzeMenuHealthOutput = { healthScore: number; insights: string[]; recommendations: string[] };
export async function analyzeMenuHealth(input: AnalyzeMenuHealthInput): Promise<AnalyzeMenuHealthOutput> {
  return callAiApi('analyze-menu-health', input);
}