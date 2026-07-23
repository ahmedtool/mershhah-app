export type SuggestMenuComboInput = { menuItems: Array<{ name: string; description?: string; category: string; price: number }>; peopleCount: number; budget: number; preferences?: string };
export type SuggestMenuComboOutput = { suggestedItems: Array<{ name: string; quantity: number; reason: string }>; totalPrice: number; summary: string };
export async function suggestMenuCombo(input: SuggestMenuComboInput): Promise<SuggestMenuComboOutput> {
  const res = await fetch('/api/ai/suggest-menu-combo', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) });
  if (!res.ok) throw new Error('AI request failed');
  return res.json();
}