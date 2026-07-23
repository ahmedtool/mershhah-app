export type ReplyTemplatesInput = { scenario: string; restaurantName: string };
export type ReplyTemplatesOutput = { shortReply: string; empatheticReply: string; deEscalationReply: string };
export async function generateReplyTemplates(input: ReplyTemplatesInput): Promise<ReplyTemplatesOutput> {
  const res = await fetch('/api/ai/generate-reply-templates', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) });
  if (!res.ok) throw new Error('AI request failed');
  return res.json();
}