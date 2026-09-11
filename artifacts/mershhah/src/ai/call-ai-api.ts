import { supabase } from '@/lib/supabase';

// Every /api/ai/* route except restaurant-chat now requires a real owner/
// admin session server-side (api-server's requireOwnerOrAdmin middleware) -
// these calls used to carry no Authorization header at all, so the fix
// would otherwise 401 every dashboard AI tool. Centralized here instead of
// repeating the session lookup in every flow file.
export async function callAiApi<T>(path: string, body: unknown): Promise<T> {
  const { data: { session } } = await supabase.auth.getSession();
  const res = await fetch(`/api/ai/${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error('AI request failed');
  return res.json();
}
