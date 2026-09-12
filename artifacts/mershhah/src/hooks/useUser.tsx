'use client';

import { createContext, useContext, useEffect, useState, useRef, useCallback, useMemo, type ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import type { Profile, Restaurant, Subscription } from '@/lib/types';
import { isUnlimitedAccount } from '@/lib/unlimited-account';

export type Entitlements = {
  planId: string;
  planName: string;
  endDate: Date | null;
  canUseAiAnalysis: boolean;
  canUseStudioImageGeneration: boolean;
  canUseDashboardAgent: boolean;
  canUseWhiteLabel: boolean;
  canUsePrioritySupport: boolean;
  canUseGatewayFranchise: boolean;
  canUseGatewayWholesale: boolean;
  canUseGatewayCorporate: boolean;
  canUseGatewayPartnership: boolean;
  canUseGatewayCustomTypes: boolean;
  maxBranches: number;
  maxMenuItems: number;
  maxTools: number;
  maxJobPostings: number;
};

const UNLIMITED = Number.MAX_SAFE_INTEGER;

const defaultEntitlements: Entitlements = {
  planId: 'none',
  planName: 'لا يوجد',
  endDate: null,
  canUseAiAnalysis: false,
  canUseStudioImageGeneration: false,
  canUseDashboardAgent: false,
  canUseWhiteLabel: false,
  canUsePrioritySupport: false,
  canUseGatewayFranchise: false,
  canUseGatewayWholesale: false,
  canUseGatewayCorporate: false,
  canUseGatewayPartnership: false,
  canUseGatewayCustomTypes: false,
  maxBranches: 1,
  maxMenuItems: 30,
  maxTools: 2,
  maxJobPostings: 1,
};

type PlanRow = {
  id: string;
  max_branches?: number | null;
  max_menu_items?: number | null;
  max_tools?: number | null;
  max_job_postings?: number | null;
  features?: Record<string, boolean | number> | null;
};

function featureFlag(features: Record<string, boolean | number> | null | undefined, key: string): boolean {
  const value = features?.[key];
  return typeof value === 'number' ? value > 0 : !!value;
}

export function pickActiveSubscription(subscriptions: Subscription[]): Subscription | null {
  const now = new Date();
  let activeSub: Subscription | null = null;

  for (const sub of subscriptions) {
    const subEndDate = sub.end_date ? new Date(sub.end_date) : new Date(0);
    if (subEndDate > now) {
      if (!activeSub) {
        activeSub = sub;
      } else {
        const currentIsPaid = activeSub.plan_id !== 'free' && activeSub.plan_id !== 'none';
        const nextIsPaid = sub.plan_id !== 'free' && sub.plan_id !== 'none';
        const activeSubEndDate = new Date(activeSub.end_date);
        if (nextIsPaid && !currentIsPaid) {
          activeSub = sub;
        } else if (nextIsPaid === currentIsPaid && subEndDate > activeSubEndDate) {
          activeSub = sub;
        }
      }
    }
  }
  return activeSub;
}

const unlimitedEntitlements: Entitlements = {
  planId: 'unlimited',
  planName: 'غير محدود',
  endDate: null,
  canUseAiAnalysis: true,
  canUseStudioImageGeneration: true,
  canUseDashboardAgent: true,
  canUseWhiteLabel: true,
  canUsePrioritySupport: true,
  canUseGatewayFranchise: true,
  canUseGatewayWholesale: true,
  canUseGatewayCorporate: true,
  canUseGatewayPartnership: true,
  canUseGatewayCustomTypes: true,
  maxBranches: UNLIMITED,
  maxMenuItems: UNLIMITED,
  maxTools: UNLIMITED,
  maxJobPostings: UNLIMITED,
};

// The DB columns (max_branches/max_menu_items/max_tools) are the source of
// truth for numeric limits — `plans.features` may also carry numbers for a
// couple of legacy keys (branches/offers), but those are display-only and
// intentionally not used for enforcement to avoid two limits disagreeing.
function computeEntitlements(activeSub: Subscription | null, profile: Profile, plan: PlanRow | null): Entitlements {
  // Our own team account - every feature unlocked regardless of subscription
  // state, so it's never gated by an expired/missing/free plan row.
  if (isUnlimitedAccount(profile.email)) return unlimitedEntitlements;
  if (!activeSub) return defaultEntitlements;

  const isPaidPlan = activeSub.plan_id !== 'free' && activeSub.plan_id !== 'none';
  const hasTrial = !isPaidPlan && !profile.ai_trial_used;
  const planHasAi = featureFlag(plan?.features, 'ai_analysis');
  const enableAi = planHasAi || hasTrial;

  const rawMaxBranches = plan?.max_branches ?? defaultEntitlements.maxBranches;
  const rawMaxMenuItems = plan?.max_menu_items ?? defaultEntitlements.maxMenuItems;
  const rawMaxTools = plan?.max_tools ?? defaultEntitlements.maxTools;
  const rawMaxJobPostings = plan?.max_job_postings ?? defaultEntitlements.maxJobPostings;

  return {
    planId: activeSub.plan_id,
    planName: activeSub.plan_name,
    endDate: new Date(activeSub.end_date),
    canUseAiAnalysis: enableAi,
    canUseStudioImageGeneration: enableAi,
    canUseDashboardAgent: enableAi,
    canUseWhiteLabel: featureFlag(plan?.features, 'white_label'),
    canUsePrioritySupport: featureFlag(plan?.features, 'priority_support'),
    canUseGatewayFranchise: featureFlag(plan?.features, 'gateway_franchise'),
    canUseGatewayWholesale: featureFlag(plan?.features, 'gateway_wholesale'),
    canUseGatewayCorporate: featureFlag(plan?.features, 'gateway_corporate'),
    canUseGatewayPartnership: featureFlag(plan?.features, 'gateway_partnership'),
    canUseGatewayCustomTypes: featureFlag(plan?.features, 'gateway_custom_types'),
    // 0 or unset historically meant "not customized" for these columns —
    // treat it as unlimited rather than silently blocking everyone.
    maxBranches: rawMaxBranches > 0 ? rawMaxBranches : UNLIMITED,
    maxMenuItems: rawMaxMenuItems > 0 ? rawMaxMenuItems : UNLIMITED,
    maxTools: rawMaxTools > 0 ? rawMaxTools : UNLIMITED,
    maxJobPostings: rawMaxJobPostings > 0 ? rawMaxJobPostings : UNLIMITED,
  };
}

interface UserContextValue {
  user: AppUser | null;
  isLoading: boolean;
}

const UserContext = createContext<UserContextValue>({ user: null, isLoading: true });

// Fetches profile -> (owner's) restaurant -> active subscription -> plan and
// combines them into one AppUser, or null if the profile doesn't exist (yet,
// or ever). Shared by the initial load and the background revalidation below
// so both build the exact same shape - they only differ in how they react to
// a failure, which is genuinely different between the two call sites (see
// revalidateUserData's comment).
async function fetchUserBundle(userId: string): Promise<AppUser | null> {
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (profileError || !profile) return null;

  let restaurantData: Restaurant | null = null;
  if (profile.role === 'owner' && profile.restaurant_id) {
    const { data: restaurant } = await supabase
      .from('restaurants')
      .select('*')
      .eq('id', profile.restaurant_id)
      .single();
    restaurantData = restaurant;
  }

  const { data: subscriptions } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('profile_id', userId)
    .eq('status', 'active');

  const activeSub = pickActiveSubscription(subscriptions || []);
  let planRow: PlanRow | null = null;
  if (activeSub) {
    const { data: plan } = await supabase
      .from('plans')
      .select('id, max_branches, max_menu_items, max_tools, max_job_postings, features')
      .eq('id', activeSub.plan_id)
      .maybeSingle();
    planRow = plan;
  }

  const entitlements = computeEntitlements(activeSub, profile, planRow);

  return {
    ...profile,
    ...(restaurantData ? { ...restaurantData } : {}),
    uid: userId,
    id: userId,
    restaurantId: restaurantData?.id || profile.restaurant_id || undefined,
    entitlements,
  } as AppUser;
}

// Background re-check interval/trigger for an already-loaded session - not
// how often the DATA is actually protected (RLS re-evaluates role on every
// query regardless of this), just how quickly a role/permission change made
// elsewhere shows up in an already-open tab's UI.
const REVALIDATE_INTERVAL_MS = 5 * 60 * 1000;

export function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const loadingRef = useRef(false);
  const mountedRef = useRef(true);
  const loadedUserIdRef = useRef<string | null>(null);
  const userRef = useRef<AppUser | null>(null);
  useEffect(() => { userRef.current = user; }, [user]);

  const loadUserData = useCallback(async (userId: string, retryCount = 0) => {
    if (loadingRef.current && retryCount === 0) return;
    if (loadedUserIdRef.current === userId && retryCount === 0) return;
    loadingRef.current = true;

    try {
      const combinedUser = await fetchUserBundle(userId);

      if (!mountedRef.current) return;

      if (!combinedUser) {
        // Profile might not be committed yet (race condition after login)
        if (retryCount < 3) {
          await new Promise(r => setTimeout(r, 500));
          return loadUserData(userId, retryCount + 1);
        }
        setUser(null);
        setIsLoading(false);
        return;
      }

      setUser(combinedUser);
      loadedUserIdRef.current = userId;
    } catch (error) {
      console.error('Error loading user data:', error);
      if (mountedRef.current) {
        setUser(null);
        loadedUserIdRef.current = null;
      }
    } finally {
      if (mountedRef.current) setIsLoading(false);
      loadingRef.current = false;
    }
  }, []);

  // Re-checks role/permissions/account_status for the session that's already
  // loaded and displayed - e.g. an admin's access was revoked from another
  // tab/device while this one stayed open. Deliberately best-effort: unlike
  // loadUserData, a failed or empty fetch here NEVER signs the user out or
  // clears the UI - a transient network blip during a routine background
  // check must not look like a real sign-out. Actual data access was never
  // gated by this anyway (RLS re-checks the DB's current role on every
  // query); this only keeps the UI itself from showing stale permissions
  // for longer than necessary.
  const revalidateUserData = useCallback(async () => {
    const userId = loadedUserIdRef.current;
    if (!userId || loadingRef.current) return;
    try {
      const combinedUser = await fetchUserBundle(userId);
      if (!mountedRef.current || !combinedUser) return;
      // fetchUserBundle always returns a brand-new object, so calling
      // setUser unconditionally re-renders every useUser() consumer in the
      // app (context value changes identity) on every 5-minute tick and
      // every tab-focus - even when nothing actually changed, which is the
      // overwhelmingly common case. That was visible as the owner's pages
      // seeming to "reload" out of nowhere. Only commit the new object when
      // the data actually differs.
      if (JSON.stringify(combinedUser) === JSON.stringify(userRef.current)) return;
      setUser(combinedUser);
    } catch {
      // Keep showing the last known-good state.
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;

    const timeout = setTimeout(() => {
      if (mountedRef.current) {
        setUser(null);
        setIsLoading(false);
      }
    }, 8000);

    supabase.auth.getSession().then(({ data: { session } }) => {
      clearTimeout(timeout);
      if (!mountedRef.current) return;
      if (session?.user) {
        loadUserData(session.user.id);
      } else {
        setUser(null);
        setIsLoading(false);
      }
    }).catch(() => {
      clearTimeout(timeout);
      if (mountedRef.current) {
        setUser(null);
        setIsLoading(false);
      }
    });

    const { data: { subscription: authSubscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (!mountedRef.current) return;
        if (event === 'SIGNED_OUT') {
          setUser(null);
          setIsLoading(false);
          loadedUserIdRef.current = null;
          return;
        }
        if (event === 'SIGNED_IN') {
          if (session?.user && session.user.id !== loadedUserIdRef.current) {
            loadedUserIdRef.current = null;
            loadUserData(session.user.id);
          }
        }
      }
    );

    return () => {
      mountedRef.current = false;
      authSubscription.unsubscribe();
    };
  }, [loadUserData]);

  // Catches a role/permission/account_status change made elsewhere while
  // this tab stayed open: once when the tab regains focus (the common case -
  // someone switches back after an admin changed something), and otherwise
  // on a slow interval as a backstop for a tab that's simply left open and
  // never loses focus.
  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') revalidateUserData();
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    const interval = setInterval(revalidateUserData, REVALIDATE_INTERVAL_MS);
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      clearInterval(interval);
    };
  }, [revalidateUserData]);

  const ctxValue = useMemo(() => ({ user, isLoading }), [user, isLoading]);

  return (
    <UserContext.Provider value={ctxValue}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser(): UserContextValue {
  return useContext(UserContext);
}
