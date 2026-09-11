import { callAiApi } from '@/ai/call-ai-api';

export type GenerateWeeklyContentInput = { restaurantName: string; restaurantType: string; optionalTheme?: string };
export type GenerateWeeklyContentOutput = { posts: Array<{ day: string; casualCopy: string; formalCopy: string; hashtags: string; cta: string }> };
export async function generateWeeklyContent(input: GenerateWeeklyContentInput): Promise<GenerateWeeklyContentOutput> {
  return callAiApi('generate-weekly-content', input);
}