import { callAiApi } from '@/ai/call-ai-api';

export type SuggestMenuComboInput = { menuItems: Array<{ name: string; description?: string; category: string; price: number }>; peopleCount: number; budget: number; preferences?: string };
export type SuggestMenuComboOutput = { suggestedItems: Array<{ name: string; quantity: number; reason: string }>; totalPrice: number; summary: string };
export async function suggestMenuCombo(input: SuggestMenuComboInput): Promise<SuggestMenuComboOutput> {
  return callAiApi('suggest-menu-combo', input);
}