export type TranslateMenuItemInput = { name: string; description?: string };
export type TranslateMenuItemOutput = { name_en: string; description_en: string };
export async function translateMenuItem(input: TranslateMenuItemInput): Promise<TranslateMenuItemOutput> {
  const res = await fetch('/api/ai/translate-menu-item', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) });
  if (!res.ok) throw new Error('AI request failed');
  return res.json();
}
