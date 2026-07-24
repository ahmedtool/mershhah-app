'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { Profile, Restaurant, Subscription } from '@/lib/types';

export type Entitlements = {
  planId: string;
  planName: string;
  endDate: Date | null;
  canUseAiAnalysis: boolean;
  canUseStudioImageGeneration: boolean;
  canUseDashboardAgent: boolean;
};

const defaultEntitlements: Entitlements = {
  planId: 'none',
  planName: 'لا يوجد',
  endDate: null,
  canUseAiAnalysis: false,
  canUseStudioImageGeneration: false,
  canUseDashboardAgent: false,
};

export type AppUser = Profile & Partial<Omit<Restaurant, 'id'>> & {
  uid: string;
  restaurantId?: string;
  entitlements: Entitlements;
};

function computeEntitlements(subscriptions: Subscription[], profile: Profile): Entitlements {
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

  if (!activeSub) return defaultEntitlements;

  const isPaidPlan = activeSub.plan_id !== 'free' && activeSub.plan_id !== 'none';
  const hasTrial = !isPaidPlan && !profile.ai_trial_used;
  const enableAi = isPaidPlan || hasTrial;

  return {
    planId: activeSub.plan_id,
    planName: activeSub.plan_name,
    endDate: new Date(activeSub.end_date),
    canUseAiAnalysis: enableAi,
    canUseStudioImageGeneration: enableAi,
    canUseDashboardAgent: enableAi,
  };
}

export function useUser() {
  const [user, setUser] = useState<AppUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const loadingRef = useRef(false);
  const mountedRef = useRef(true);

  const loadUserData = useCallback(async (userId: string) => {
    if (loadingRef.current) return;
    loadingRef.current = true;

    try {
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (!mountedRef.current) return;

      if (profileError || !profile) {
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

      const entitlements = computeEntitlements(subscriptions || [], profile);

      const combinedUser: AppUser = {
        ...profile,
        ...(restaurantData ? { ...restaurantData } : {}),
        uid: userId,
        id: userId,
        restaurantId: restaurantData?.id || profile.restaurant_id || undefined,
        entitlements,
      };

      setUser(combinedUser);
    } catch (error) {
      console.error('Error loading user data:', error);
      if (mountedRef.current) setUser(null);
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
          return;
        }
        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          if (session?.user && !loadingRef.current) {
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

  return { user, isLoading };
}
