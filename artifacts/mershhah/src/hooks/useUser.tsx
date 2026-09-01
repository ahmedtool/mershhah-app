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
  maxBranches: number;
  maxMenuItems: number;
  maxTools: number;
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
  maxBranches: 1,
  maxMenuItems: 30,
  maxTools: 2,
};

type PlanRow = {
  id: string;
  max_branches?: number | null;
  max_menu_items?: number | null;
  max_tools?: number | null;
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
  maxBranches: UNLIMITED,
  maxMenuItems: UNLIMITED,
  maxTools: UNLIMITED,
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

  return {
    planId: activeSub.plan_id,
    planName: activeSub.plan_name,
    endDate: new Date(activeSub.end_date),
    canUseAiAnalysis: enableAi,
    canUseStudioImageGeneration: enableAi,
    canUseDashboardAgent: enableAi,
    canUseWhiteLabel: featureFlag(plan?.features, 'white_label'),
    canUsePrioritySupport: featureFlag(plan?.features, 'priority_support'),
    // 0 or unset historically meant "not customized" for these columns —
    // treat it as unlimited rather than silently blocking everyone.
    maxBranches: rawMaxBranches > 0 ? rawMaxBranches : UNLIMITED,
    maxMenuItems: rawMaxMenuItems > 0 ? rawMaxMenuItems : UNLIMITED,
    maxTools: rawMaxTools > 0 ? rawMaxTools : UNLIMITED,
  };
}

interface UserContextValue {
  user: AppUser | null;
  isLoading: boolean;
}

const UserContext = createContext<UserContextValue>({ user: null, isLoading: true });

export function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const loadingRef = useRef(false);
  const mountedRef = useRef(true);
  const loadedUserIdRef = useRef<string | null>(null);

  const loadUserData = useCallback(async (userId: string, retryCount = 0) => {
    if (loadingRef.current && retryCount === 0) return;
    if (loadedUserIdRef.current === userId && retryCount === 0) return;
    loadingRef.current = true;

    try {
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (!mountedRef.current) return;

      if (profileError || !profile) {
        // Profile might not be committed yet (race condition after login)
        if (retryCount < 3) {
          await new Promise(r => setTimeout(r, 500));
          return loadUserData(userId, retryCount + 1);
        }
        setUser(null);
        setIsLoading(false);
        return;
      }

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

      if (!mountedRef.current) return;

      const activeSub = pickActiveSubscription(subscriptions || []);
      let planRow: PlanRow | null = null;
      if (activeSub) {
        const { data: plan } = await supabase
          .from('plans')
          .select('id, max_branches, max_menu_items, max_tools, features')
          .eq('id', activeSub.plan_id)
          .maybeSingle();
        planRow = plan;
      }

      if (!mountedRef.current) return;

      const entitlements = computeEntitlements(activeSub, profile, planRow);

      const combinedUser: AppUser = {
        ...profile,
        ...(restaurantData ? { ...restaurantData } : {}),
        uid: userId,
        id: userId,
        restaurantId: restaurantData?.id || profile.restaurant_id || undefined,
        entitlements,
      };

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
