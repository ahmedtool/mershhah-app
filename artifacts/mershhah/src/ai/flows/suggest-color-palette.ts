import { callAiApi } from '@/ai/call-ai-api';

export type SuggestColorPaletteInput = { restaurantType: string; mood?: string };
export type SuggestColorPaletteOutput = { primary: string; secondary: string; accent: string };
export async function suggestColorPalette(input: SuggestColorPaletteInput): Promise<SuggestColorPaletteOutput> {
  return callAiApi('suggest-color-palette', input);
}