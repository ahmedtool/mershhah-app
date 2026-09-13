'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Skeleton } from '@/components/ui/skeleton';
import { differenceInCalendarDays, startOfMonth, subMonths, format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { pickActiveSubscription } from '@/hooks/useUser';
import { DashboardKpiCards } from '@/components/admin/dashboard/DashboardKpiCards';
import { GrowthCharts, type MonthPoint } from '@/components/admin/dashboard/GrowthCharts';
import { PlanDistributionCard, type PlanSlice } from '@/components/admin/dashboard/PlanDistributionCard';
import { ExpiringSoonCard, type ExpiringItem } from '@/components/admin/dashboard/ExpiringSoonCard';
import { UsageStatsGrid } from '@/components/admin/dashboard/UsageStatsGrid';
import { TopRestaurantsCard, type TopRestaurant } from '@/components/admin/dashboard/TopRestaurantsCard';
import { RecentActivityCard, type ActivityItem } from '@/components/admin/dashboard/RecentActivityCard';
import type { Profile, Subscription } from '@/lib/types';

const TRIAL_PLAN_ID = '93250b42-d34c-4996-8d83-359ea26ab264';
const PLAN_COLORS: Record<string, string> = {
  pro: '#111827',
  free: '#9ca3af',
  [TRIAL_PLAN_ID]: '#f59e0b',
  none: '#e5e7eb',
};

type PlanLite = { id: string; name: string; price_yearly: number };

type Stats = {
  totalRestaurants: number;
  totalMenuItems: number;
  totalReviews: number;
  totalOffers: number;
  totalBranches: number;
  totalHubVisits: number;
  totalApplications: number;
  avgRating: number;
};

export default function AdminDashboardPage() {
  const [owners, setOwners] = useState<Profile[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [plans, setPlans] = useState<PlanLite[]>([]);
  const [stats, setStats] = useState<Stats>({
    totalRestaurants: 0, totalMenuItems: 0, totalReviews: 0, totalOffers: 0,
    totalBranches: 0, totalHubVisits: 0, totalApplications: 0, avgRating: 0,
  });
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [topRestaurants, setTopRestaurants] = useState<TopRestaurant[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const fetchData = async () => {
      setIsLoading(true);
      try {
        const [
          ownersRes, subsRes, plansRes, restaurantsRes, activityRes,
          menuItemsRes, reviewsRes, offersRes, branchesRes, hubVisitsRes, appsRes,
        ] = await Promise.all([
          supabase.from('profiles').select('*').eq('role', 'owner'),
          supabase.from('subscriptions').select('*'),
          supabase.from('plans').select('id, name, price_yearly').eq('is_active', true),
          supabase.from('restaurants').select('*'),
          supabase.from('activity').select('*').order('timestamp', { ascending: false }).limit(50),
          supabase.from('menu_items').select('*'),
          supabase.from('reviews').select('*'),
          supabase.from('offers').select('*'),
          supabase.from('branches').select('*'),
          supabase.from('hub_visits').select('*'),
          supabase.from('applications').select('*'),
        ]);

        if (!isMounted) return;

        setOwners((ownersRes.data || []) as Profile[]);
        setSubscriptions((subsRes.data || []) as Subscription[]);
        setPlans((plansRes.data || []) as PlanLite[]);

        const restaurants = (restaurantsRes.data || []) as any[];
        const menuItems = (menuItemsRes.data || []) as any[];
        const reviews = (reviewsRes.data || []) as any[];
        const offers = (offersRes.data || []) as any[];
        const branches = (branchesRes.data || []) as any[];
        const hubVisits = (hubVisitsRes.data || []) as any[];
        const apps = (appsRes.data || []) as any[];

        const avgRating = reviews.length > 0 ? reviews.reduce((sum: number, r: any) => sum + (r.rating || 0), 0) / reviews.length : 0;

        setStats({
          totalRestaurants: restaurants.length,
          totalMenuItems: menuItems.length,
          totalReviews: reviews.length,
          totalOffers: offers.length,
          totalBranches: branches.length,
          totalHubVisits: hubVisits.length,
          totalApplications: apps.length,
          avgRating: Math.round(avgRating * 10) / 10,
        });

        const visitCounts: Record<string, number> = {};
        hubVisits.forEach((v: any) => {
          const rid = v.restaurant_id || v.restaurantId;
          if (rid) visitCounts[rid] = (visitCounts[rid] || 0) + 1;
        });
        const dishCounts: Record<string, number> = {};
        menuItems.forEach((m: any) => {
          if (m.restaurant_id) dishCounts[m.restaurant_id] = (dishCounts[m.restaurant_id] || 0) + 1;
        });
        const reviewCounts: Record<string, number> = {};
        reviews.forEach((r: any) => {
          if (r.restaurant_id) reviewCounts[r.restaurant_id] = (reviewCounts[r.restaurant_id] || 0) + 1;
        });

        const topList: TopRestaurant[] = restaurants
          .map((r: any) => ({
            name: r.name || r.restaurant_name || 'مطعم',
            visits: visitCounts[r.id] || 0,
            dishes: dishCounts[r.id] || 0,
            reviews: reviewCounts[r.id] || 0,
          }))
          .sort((a: TopRestaurant, b: TopRestaurant) => b.visits - a.visits)
          .slice(0, 5);
        setTopRestaurants(topList);

        setActivities((activityRes.data || []).map((d: any) => ({
          id: d.id,
          type: d.type,
          restaurantId: d.restaurantId ?? null,
          restaurantName: d.restaurantName ?? null,
          planName: d.planName ?? null,
          userId: d.userId ?? null,
          timestamp: d.timestamp ?? null,
        })));
      } catch (error) {
        console.error('Error fetching admin dashboard data:', error);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    fetchData();
    return () => { isMounted = false; };
  }, []);

  const subsByProfile = useMemo(() => {
    const map = new Map<string, Subscription[]>();
    for (const sub of subscriptions) {
      const list = map.get(sub.profile_id) || [];
      list.push(sub);
      map.set(sub.profile_id, list);
    }
    return map;
  }, [subscriptions]);

  const activeSubs = useMemo(() => owners
    .map((o) => pickActiveSubscription(subsByProfile.get(o.id) || []))
    .filter((s): s is Subscription => !!s), [owners, subsByProfile]);

  const kpis = useMemo(() => {
    const now = new Date();
    const monthStart = startOfMonth(now);
    const planPrice = new Map(plans.map((p) => [p.id, p.price_yearly || 0]));

    const arr = activeSubs.reduce((sum, s) => sum + (planPrice.get(s.plan_id) || 0), 0);
    const newThisMonth = subscriptions.filter((s) => {
      const start = s.start_date ? new Date(s.start_date) : null;
      return start && start >= monthStart;
    }).length;
    const expiringSoonList: ExpiringItem[] = [];
    for (const sub of activeSubs) {
      if (sub.plan_id === 'free' || !sub.end_date) continue;
      const end = new Date(sub.end_date);
      const daysLeft = differenceInCalendarDays(end, now);
      if (daysLeft >= 0 && daysLeft <= 30) {
        const owner = owners.find((o) => o.id === sub.profile_id);
        expiringSoonList.push({
          profileId: sub.profile_id,
          name: owner?.restaurant_name || owner?.full_name || '—',
          planName: sub.plan_name,
          daysLeft,
        });
      }
    }
    expiringSoonList.sort((a, b) => a.daysLeft - b.daysLeft);

    return {
      arr,
      mrr: arr / 12,
      activeSubscribers: activeSubs.length,
      newThisMonth,
      expiringSoon: expiringSoonList.length,
      expiringSoonList: expiringSoonList.slice(0, 6),
    };
  }, [activeSubs, subscriptions, owners, plans]);

  const planDistribution = useMemo((): { items: PlanSlice[]; total: number } => {
    const counts = new Map<string, number>();
    for (const sub of activeSubs) {
      counts.set(sub.plan_id, (counts.get(sub.plan_id) || 0) + 1);
    }
    const noSubCount = owners.length - activeSubs.length;
    const items: PlanSlice[] = [];
    for (const plan of plans) {
      const count = counts.get(plan.id) || 0;
      if (count > 0) items.push({ label: plan.name, count, color: PLAN_COLORS[plan.id] || '#6366f1' });
    }
    if (noSubCount > 0) items.push({ label: 'بدون اشتراك', count: noSubCount, color: PLAN_COLORS.none });
    items.sort((a, b) => b.count - a.count);
    return { items, total: owners.length };
  }, [activeSubs, owners, plans]);

  const monthlyGrowth = useMemo((): MonthPoint[] => {
    const now = new Date();
    const planPrice = new Map(plans.map((p) => [p.id, p.price_yearly || 0]));
    const months: MonthPoint[] = [];
    for (let i = 5; i >= 0; i--) {
      const monthDate = subMonths(startOfMonth(now), i);
      const nextMonthDate = subMonths(startOfMonth(now), i - 1);
      const accounts = owners.filter((o) => {
        const created = o.created_at ? new Date(o.created_at) : null;
        return created && created >= monthDate && created < nextMonthDate;
      }).length;
      const revenue = subscriptions
        .filter((s) => {
          const start = s.start_date ? new Date(s.start_date) : null;
          return start && start >= monthDate && start < nextMonthDate && s.plan_id !== 'free';
        })
        .reduce((sum, s) => sum + (planPrice.get(s.plan_id) || 0), 0);
      months.push({ month: format(monthDate, 'MMM', { locale: ar }), accounts, revenue });
    }
    return months;
  }, [owners, subscriptions, plans]);

  if (isLoading) {
    return (
      <div className="p-4 lg:p-6 space-y-5">
        <div className="space-y-2">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-4 w-80" />
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <Skeleton className="h-64 rounded-2xl" />
          <Skeleton className="h-64 rounded-2xl" />
        </div>
        <Skeleton className="h-48 rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-6 space-y-5">
      <div>
        <h1 className="text-lg font-bold text-gray-900">لوحة التحكم</h1>
        <p className="text-xs text-gray-600 mt-0.5">نظرة عامة على أداء ونمو المنصة</p>
      </div>

      <DashboardKpiCards
        arr={kpis.arr}
        mrr={kpis.mrr}
        activeSubscribers={kpis.activeSubscribers}
        newThisMonth={kpis.newThisMonth}
        expiringSoon={kpis.expiringSoon}
      />

      <GrowthCharts data={monthlyGrowth} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <div className="lg:col-span-1">
          <PlanDistributionCard items={planDistribution.items} total={planDistribution.total} />
        </div>
        <div className="lg:col-span-2">
          <ExpiringSoonCard items={kpis.expiringSoonList} />
        </div>
      </div>

      <UsageStatsGrid
        totalRestaurants={stats.totalRestaurants}
        totalBranches={stats.totalBranches}
        totalMenuItems={stats.totalMenuItems}
        totalOffers={stats.totalOffers}
        totalHubVisits={stats.totalHubVisits}
        totalReviews={stats.totalReviews}
        avgRating={stats.avgRating}
        totalApplications={stats.totalApplications}
      />

      <TopRestaurantsCard items={topRestaurants} />

      <RecentActivityCard items={activities} />
    </div>
  );
}
