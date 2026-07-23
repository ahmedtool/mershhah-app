export type RedesignMenuImageInput = { imageDataUri: string; itemName: string; instruction?: string };
export type RedesignMenuImageOutput = { imageDataUri: string };
export async function redesignMenuImage(input: RedesignMenuImageInput): Promise<RedesignMenuImageOutput> {
  const res = await fetch('/api/ai/redesign-menu-image', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) });
  if (!res.ok) throw new Error('AI request failed');
  return res.json();
}