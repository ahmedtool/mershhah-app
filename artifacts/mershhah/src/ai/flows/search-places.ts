import { callAiApi } from '@/ai/call-ai-api';

export type SearchPlacesInput = { query: string; location?: string };
export type SearchPlacesOutput = { places: Array<{ placeId: string; name: string; address: string }> };
export async function searchPlaces(input: SearchPlacesInput): Promise<SearchPlacesOutput> {
  return callAiApi('search-places', input);
}