export type SuggestColorPaletteInput = { restaurantType: string; mood?: string };
export type SuggestColorPaletteOutput = { primary: string; secondary: string; accent: string };
export async function suggestColorPalette(input: SuggestColorPaletteInput): Promise<SuggestColorPaletteOutput> {
  const res = await fetch('/api/ai/suggest-color-palette', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) });
  if (!res.ok) throw new Error('AI request failed');
  return res.json();
}