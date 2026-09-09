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
        // Namespacing the iframe's storage/lock name away from the parent
        // tab's own name is defense in depth, but it doesn't fix the core
        // problem: supabase-js's default lock uses navigator.locks with
        // { ifAvailable: true } around session reads/refreshes and just
        // throws "immediately failed" instead of waiting whenever another
        // caller in the SAME tab (or a genuinely different open tab on the
        // same origin - this app is routinely used with several tabs open
        // at once) happens to hold that lock at that instant. A user hit
        // exactly that: a Customize page save's storage upload attached no
        // valid token because of this, and got rejected with "new row
        // violates row-level security policy" instead of just working.
        // Replacing the lock with a plain passthrough (no real mutual
        // exclusion, just run the critical section) trades away perfectly
        // race-free cross-tab session refresh for never throwing here -
        // the right tradeoff for an app that isn't relying on that
        // cross-tab guarantee anywhere.
        lock: async (_name: string, _acquireTimeout: number, fn: () => Promise<any>) => fn(),
        ...(skipAuthPersistence ? { storageKey: 'sb-preview-iframe-auth-token' } : {}),
      },
    }
  );
}

export { supabase };
