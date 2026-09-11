import { callAiApi } from '@/ai/call-ai-api';

export type ReplyTemplatesInput = { scenario: string; restaurantName: string };
export type ReplyTemplatesOutput = { shortReply: string; empatheticReply: string; deEscalationReply: string };
export async function generateReplyTemplates(input: ReplyTemplatesInput): Promise<ReplyTemplatesOutput> {
  return callAiApi('generate-reply-templates', input);
}