import { callAiApi } from '@/ai/call-ai-api';

export type SummarizeCustomerFeedbackInput = { chatMessages: Array<{ text: string; timestamp: string }> };
export type SummarizeCustomerFeedbackOutput = { summary: string; frequentTopics: string[]; customerSentiment: string; peakHours: string };
export async function summarizeCustomerFeedback(input: SummarizeCustomerFeedbackInput): Promise<SummarizeCustomerFeedbackOutput> {
  return callAiApi('summarize-feedback', input);
}