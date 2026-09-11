import { callAiApi } from '@/ai/call-ai-api';

export type GenerateSmartOffersInput = { menuItems: any[]; restaurantName: string };
export type GenerateSmartOffersOutput = { offers: any[] };
export async function generateSmartOffers(input: GenerateSmartOffersInput): Promise<GenerateSmartOffersOutput> {
  return callAiApi('generate-smart-offers', input);
}