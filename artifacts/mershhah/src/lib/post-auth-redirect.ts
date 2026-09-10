import { supabase } from '@/lib/supabase';
import type { User } from '@supabase/supabase-js';

export const ADMIN_EMAIL = 'ahmedsupsa@gmail.com';

const allAdminPermissions = [
  'dashboard', 'management', 'financials', 'store-management',
  'applications', 'announcements', 'support', 'team', 'workflow', 'sales',
];

const adminPages = [
  { href: '/admin/dashboard', permissionId: 'dashboard' },
  { href: '/admin/management', permissionId: 'management' },
  { href: '/admin/financials', permissionId: 'financials' },
  { href: '/admin/referrals', permissionId: 'referrals' },
  { href: '/admin/store-management', permissionId: 'store-management' },
  { href: '/admin/support', permissionId: 'support' },
  { href: '/admin/team', permissionId: 'team' },
  { href: '/admin/workflow', permissionId: 'workflow' },
  { href: '/admin/sales', permissionId: 'sales' },
];

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
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle();

  if (!profile) {
    if (user.email === ADMIN_EMAIL) {
      const now = new Date().toISOString();
      await supabase.from('profiles').insert({
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
