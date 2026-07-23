export type SummarizeCustomerFeedbackInput = { chatMessages: Array<{ text: string; timestamp: string }> };
export type SummarizeCustomerFeedbackOutput = { summary: string; frequentTopics: string[]; customerSentiment: string; peakHours: string };
export async function summarizeCustomerFeedback(input: SummarizeCustomerFeedbackInput): Promise<SummarizeCustomerFeedbackOutput> {
  const res = await fetch('/api/ai/summarize-feedback', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) });
  if (!res.ok) throw new Error('AI request failed');
  return res.json();
}