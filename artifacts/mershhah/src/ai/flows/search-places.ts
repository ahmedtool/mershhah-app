export type SearchPlacesInput = { query: string; location?: string };
export type SearchPlacesOutput = { places: Array<{ placeId: string; name: string; address: string }> };
export async function searchPlaces(input: SearchPlacesInput): Promise<SearchPlacesOutput> {
  const res = await fetch('/api/ai/search-places', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) });
  if (!res.ok) throw new Error('Failed');
  return res.json();
}