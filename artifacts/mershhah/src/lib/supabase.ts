import { createClient } from '@supabase/supabase-js';
import { mockSupabase } from './mock-supabase';

const useMock = import.meta.env.VITE_USE_MOCK === 'true';

let supabase: any;

if (useMock) {
  supabase = mockSupabase;
  console.log('[Mershhah] Running in MOCK mode - using localStorage');
} else {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error(
      '[Mershhah] Missing Supabase env vars: VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY.\n' +
      'Set them in your Vercel project → Settings → Environment Variables.\n' +
      'Or set VITE_USE_MOCK=true to use local mock data.'
    );
  }

  supabase = createClient(
    supabaseUrl || 'https://placeholder.supabase.co',
    supabaseAnonKey || 'placeholder',
    {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    }
  );
}

export { supabase };
