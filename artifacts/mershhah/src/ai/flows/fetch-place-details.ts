import { callAiApi } from '@/ai/call-ai-api';

export type FetchPlaceDetailsInput = { placeId: string };
export type FetchPlaceDetailsOutput = { name: string; address: string; phone?: string; rating?: number };
export async function fetchPlaceDetails(input: FetchPlaceDetailsInput): Promise<FetchPlaceDetailsOutput> {
  return callAiApi('fetch-place-details', input);
}