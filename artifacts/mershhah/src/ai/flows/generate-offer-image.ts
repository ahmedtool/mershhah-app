export type GenerateOfferImageInput = { offerTitle: string; offerDescription?: string; style: 'modern_and_bold' | 'elegant_and_minimalist' | 'fun_and_festive'; includedItems?: Array<{ name: string; description?: string }> };
export type GenerateOfferImageOutput = { imageDataUri: string };
export async function generateOfferImage(input: GenerateOfferImageInput): Promise<GenerateOfferImageOutput> {
  const res = await fetch('/api/ai/generate-offer-image', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) });
  if (!res.ok) throw new Error('AI request failed');
  return res.json();
}