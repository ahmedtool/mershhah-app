export type GenerateMenuImageInput = { itemName: string; itemDescription?: string; style: 'clean_white_background' | 'realistic_restaurant_setting' | 'dramatic_charcoal_sketch' | 'vibrant_watercolor_art'; customInstructions?: string; restaurantLogoUrl?: string };
export type GenerateMenuImageOutput = { imageDataUri: string };
export async function generateMenuImage(input: GenerateMenuImageInput): Promise<GenerateMenuImageOutput> {
  const res = await fetch('/api/ai/generate-menu-image', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) });
  if (!res.ok) throw new Error('AI request failed');
  return res.json();
}