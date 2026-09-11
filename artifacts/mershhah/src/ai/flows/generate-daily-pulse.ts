import { callAiApi } from '@/ai/call-ai-api';

export type DailyPulseInput = { restaurantName: string; mostDiscussedItem: string; peakActivityHour: string; totalInteractions: number };
export type DailyPulseOutput = { pulseSummary: string; singleActionableRecommendation: string };
export async function generateDailyPulse(input: DailyPulseInput): Promise<DailyPulseOutput> {
  return callAiApi('generate-daily-pulse', input);
}