'use client';

import { useEffect, useState } from 'react';
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

  const loadUserData = async (userId: string, retries = 3) => {
    try {
      let profile: any = null;
      let profileError: any = null;

      for (let attempt = 0; attempt < retries; attempt++) {
        const result = await supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .single();
        profile = result.data;
        profileError = result.error;
        if (profile) break;
        if (attempt < retries - 1) await new Promise(r => setTimeout(r, 800));
      }

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
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const timeout = setTimeout(() => {
      setUser(null);
      setIsLoading(false);
    }, 8000);

    supabase.auth.getSession().then(({ data: { session } }) => {
      clearTimeout(timeout);
      if (session?.user) {
        loadUserData(session.user.id);
      } else {
        setUser(null);
        setIsLoading(false);
      }
    }).catch(() => {
      clearTimeout(timeout);
      setUser(null);
      setIsLoading(false);
    });

    const { data: { subscription: authSubscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_OUT') {
          setUser(null);
          setIsLoading(false);
          return;
        }
        if (session?.user) {
          setIsLoading(true);
          await loadUserData(session.user.id);
        }
      }
    );

    return () => {
      authSubscription.unsubscribe();
    };
  }, []);

  return { user, isLoading };
}
