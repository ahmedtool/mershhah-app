export type GenerateSmartOffersInput = { menuItems: any[]; restaurantName: string };
export type GenerateSmartOffersOutput = { offers: any[] };
export async function generateSmartOffers(input: GenerateSmartOffersInput): Promise<GenerateSmartOffersOutput> {
  const res = await fetch('/api/ai/generate-smart-offers', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) });
  if (!res.ok) throw new Error('AI request failed');
  return res.json();
}