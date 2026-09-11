import { callAiApi } from '@/ai/call-ai-api';

export type ExtractMenuFromImageInput = { imageDataUri: string };
export type ExtractMenuFromImageOutput = { items: any[] };

// Routed through /api/ai/extract-menu-from-image (which holds MISTRAL_API_KEY
// server-side) instead of calling Mistral directly from the browser - this
// used to ship VITE_MISTRAL_API_KEY straight into the client bundle, where
// anyone could read it out and use it to run up a bill on our Mistral account.
export async function extractMenuFromImage(input: ExtractMenuFromImageInput): Promise<ExtractMenuFromImageOutput> {
  return callAiApi('extract-menu-from-image', input);
}
