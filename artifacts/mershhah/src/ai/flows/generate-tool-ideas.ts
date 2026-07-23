export type GenerateToolIdeasInput = { restaurantType: string; currentTools?: string[] };
export type GenerateToolIdeasOutput = { ideas: string[] };
export async function generateToolIdeas(input: GenerateToolIdeasInput): Promise<GenerateToolIdeasOutput> {
  const res = await fetch('/api/ai/generate-tool-ideas', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) });
  if (!res.ok) throw new Error('AI request failed');
  return res.json();
}