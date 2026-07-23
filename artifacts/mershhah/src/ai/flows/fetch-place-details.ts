export type FetchPlaceDetailsInput = { placeId: string };
export type FetchPlaceDetailsOutput = { name: string; address: string; phone?: string; rating?: number };
export async function fetchPlaceDetails(input: FetchPlaceDetailsInput): Promise<FetchPlaceDetailsOutput> {
  const res = await fetch('/api/ai/fetch-place-details', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) });
  if (!res.ok) throw new Error('Failed');
  return res.json();
}