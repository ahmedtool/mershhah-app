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

  // The owner Customize page renders a live preview of the public site in
  // an <iframe src="/:username">, which loads this same bundle again on
  // the same origin. That second app instance never needs an authenticated
  // session (it only ever renders public, anon-readable pages), but with
  // session persistence on it would still try to read/refresh/hold the
  // exact same localStorage-backed auth token as the parent tab's client -
  // both competing for the same browser-wide Navigator LockManager lock
  // and throwing "immediately failed" lock errors, especially right after
  // a save remounts the iframe and the old instance's lock hasn't been
  // released yet.
  //
  // Only skip persistence for THAT specific case, not every iframe: the
  // owner Tools page also embeds dedicated /owner/tools/... pages in an
  // iframe, and those genuinely need a real authenticated session to work.
  let isInIframe = false;
  try {
    isInIframe = window.self !== window.top;
  } catch {
    isInIframe = true;
  }
  const isOwnerOrAdminPath = /^\/(owner|admin)(\/|$)/.test(window.location.pathname);
  const skipAuthPersistence = isInIframe && !isOwnerOrAdminPath;

  supabase = createClient(
    supabaseUrl || 'https://placeholder.supabase.co',
    supabaseAnonKey || 'placeholder',
    {
      auth: {
        persistSession: !skipAuthPersistence,
        autoRefreshToken: !skipAuthPersistence,
        // supabase-js still briefly acquires a Navigator LockManager lock
        // around session reads even with persistSession/autoRefreshToken
        // off, and that lock is named after storageKey - which defaults to
        // the same value for every client on this origin. Without a
        // distinct storageKey here, the iframe's client keeps contending
        // for the exact same lock as the parent tab's client, so a save
        // that happens to call getSession() (or an upload that attaches
        // the current token) right as the iframe grabs the lock can fail
        // with "immediately failed" and go out unauthenticated - which is
        // what produced the "new row violates row-level security policy"
        // error saving a custom app logo while the preview iframe was open.
        ...(skipAuthPersistence ? { storageKey: 'sb-preview-iframe-auth-token' } : {}),
      },
    }
  );
}

export { supabase };
