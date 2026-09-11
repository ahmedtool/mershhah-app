import { callAiApi } from '@/ai/call-ai-api';

export type RedesignMenuImageInput = { imageDataUri: string; itemName: string; instruction?: string };
export type RedesignMenuImageOutput = { imageDataUri: string };
export async function redesignMenuImage(input: RedesignMenuImageInput): Promise<RedesignMenuImageOutput> {
  return callAiApi('redesign-menu-image', input);
}