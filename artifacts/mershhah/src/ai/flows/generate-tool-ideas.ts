import { callAiApi } from '@/ai/call-ai-api';

export type GenerateToolIdeasInput = { restaurantType: string; currentTools?: string[] };
export type GenerateToolIdeasOutput = { ideas: string[] };
export async function generateToolIdeas(input: GenerateToolIdeasInput): Promise<GenerateToolIdeasOutput> {
  return callAiApi('generate-tool-ideas', input);
}