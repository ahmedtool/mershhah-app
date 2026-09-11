import { callAiApi } from '@/ai/call-ai-api';

export type GenerateMenuImageInput = { itemName: string; itemDescription?: string; style: 'clean_white_background' | 'realistic_restaurant_setting' | 'dramatic_charcoal_sketch' | 'vibrant_watercolor_art'; customInstructions?: string; restaurantLogoUrl?: string };
export type GenerateMenuImageOutput = { imageDataUri: string };
export async function generateMenuImage(input: GenerateMenuImageInput): Promise<GenerateMenuImageOutput> {
  return callAiApi('generate-menu-image', input);
}