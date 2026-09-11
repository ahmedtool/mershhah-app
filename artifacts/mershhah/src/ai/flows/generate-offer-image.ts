import { callAiApi } from '@/ai/call-ai-api';

export type GenerateOfferImageInput = { offerTitle: string; offerDescription?: string; style: 'modern_and_bold' | 'elegant_and_minimalist' | 'fun_and_festive'; includedItems?: Array<{ name: string; description?: string }> };
export type GenerateOfferImageOutput = { imageDataUri: string };
export async function generateOfferImage(input: GenerateOfferImageInput): Promise<GenerateOfferImageOutput> {
  return callAiApi('generate-offer-image', input);
}