import { supabase } from '@/lib/supabase';
import type { User } from '@supabase/supabase-js';

export const ADMIN_EMAIL = 'ahmedsupsa@gmail.com';

const allAdminPermissions = [
  'dashboard', 'management', 'financials', 'store-management',
  'applications', 'announcements', 'support', 'team', 'sales', 'infrastructure',
];

const adminPages = [
  { href: '/admin/dashboard', permissionId: 'dashboard' },
  { href: '/admin/management', permissionId: 'management' },
  { href: '/admin/financials', permissionId: 'financials' },
  { href: '/admin/referrals', permissionId: 'referrals' },
  { href: '/admin/store-management', permissionId: 'store-management' },
  { href: '/admin/support', permissionId: 'support' },
  { href: '/admin/team', permissionId: 'team' },
  { href: '/admin/sales', permissionId: 'sales' },
  { href: '/admin/infrastructure', permissionId: 'infrastructure' },
];

async function hasExistingAccountUnderDifferentIdentity(): Promise<boolean> {
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) return false;
    const res = await fetch('/api/auth/check-existing-account', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return false;
    const data = await res.json();
    return !!data.existingAccountFound;
  } catch {
    // If the check itself fails (network blip, endpoint not deployed yet),
    // fail open to onboarding rather than blocking every new sign-up on it.
    return false;
  }
}

/**
 * Called right after any successful sign-in (Google OAuth callback or email
 * OTP verification). Figures out where this user belongs: a brand-new
 * account goes to /onboarding to collect the few things Google/OTP can't
 * supply (project name, business type, phone) - except the hardcoded admin
 * email, which gets an admin profile directly and skips onboarding, matching
 * the previous password-based RegisterForm's behavior. A returning user goes
 * straight to their dashboard.
 */
export async function resolvePostAuthRoute(user: User): Promise<string> {
  // A profile row can take a beat to become visible to this session right
  // after a fresh OTP/OAuth sign-in (same class of race useUser.tsx's own
  // loadUserData already retries around) - a single immediate miss here
  // must NOT be treated as proof the account doesn't exist, or a perfectly
  // normal returning admin/owner gets bounced to /auth/account-exists just
  // because this query ran a few hundred ms too early.
  let profile: any = null;
  for (let attempt = 0; attempt < 4; attempt++) {
    if (attempt > 0) await new Promise((r) => setTimeout(r, 500));
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();
    if (data) { profile = data; break; }
  }

  if (!profile) {
    // profiles RLS only lets a session read its OWN row, so it's
    // impossible to tell client-side whether this email already has an
    // account under a DIFFERENT auth identity (e.g. this person originally
    // registered with a password, and is now trying Google for the first
    // time - a different provider that, without account linking
    // configured, gets its own separate auth.users id). Ask the
    // service-role-backed check before assuming "brand new" - this applies
    // to the hardcoded admin email too: `profiles.email` is UNIQUE, so
    // blindly inserting a second admin row here would violate that
    // constraint and silently leave this new identity with no profile at
    // all, bouncing the admin straight back to /login.
    if (await hasExistingAccountUnderDifferentIdentity()) {
      return '/auth/account-exists';
    }

    if (user.email === ADMIN_EMAIL) {
      const now = new Date().toISOString();
      const { error } = await supabase.from('profiles').insert({
        id: user.id,
        full_name: user.user_metadata?.full_name || user.email,
        email: user.email,
        phone_number: null,
        role: 'admin',
        account_status: 'active',
        created_at: now,
        restaurant_name: null,
        restaurant_id: null,
        admin_permissions: allAdminPermissions,
      });
      if (error) {
        console.error('Failed to create admin profile:', error);
        return '/auth/account-exists';
      }
      return '/admin/dashboard';
    }

    return '/onboarding';
  }

  if (profile.role === 'admin') {
    if (profile.email !== ADMIN_EMAIL && profile.admin_permissions?.length) {
      const firstPermittedPage = adminPages.find((page) => profile.admin_permissions.includes(page.permissionId));
      if (firstPermittedPage) return firstPermittedPage.href;
    }
    return '/admin/dashboard';
  }

  return '/owner/dashboard';
}
