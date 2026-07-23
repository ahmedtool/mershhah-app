export type GenerateMenuDescriptionsInput = { items: any[] };
export type GenerateMenuDescriptionsOutput = { items: any[] };
export async function generateMenuDescriptions(input: GenerateMenuDescriptionsInput): Promise<GenerateMenuDescriptionsOutput> {
  const res = await fetch('/api/ai/generate-menu-descriptions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) });
  if (!res.ok) throw new Error('AI request failed');
  return res.json();
}