'use client';

import { useEffect, useState } from 'react';
import { ShoppingBag, Loader2, CreditCard, UserPlus, ImagePlus, Sparkles, Utensils, Eye, Star, MapPin, Megaphone, MessageSquare, TrendingUp, Users } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDistanceToNow } from 'date-fns';
import { ar } from 'date-fns/locale';

type Stats = {
  totalRestaurants: number;
  totalSubscriptions: number;
  newSubscriptionsThisMonth: number;
  totalMenuItems: number;
  totalReviews: number;
  totalOffers: number;
  totalBranches: number;
  totalHubVisits: number;
  totalApplications: number;
  avgRating: number;
};

type ActivityItem = {
  id: string;
  type: 'restaurant_created' | 'subscription_started' | 'logo_added';
  restaurantId?: string | null;
  restaurantName?: string | null;
  planName?: string | null;
  userId?: string | null;
  timestamp: string | null;
};

type TopRestaurant = {
  name: string;
  visits: number;
  dishes: number;
  reviews: number;
};

const activityConfig: Record<string, { label: string; icon: any; color: string }> = {
  restaurant_created: { label: 'إنشاء حساب', icon: UserPlus, color: 'bg-blue-50 text-blue-600' },
  subscription_started: { label: 'تفعيل اشتراك', icon: Sparkles, color: 'bg-emerald-50 text-emerald-600' },
  logo_added: { label: 'إضافة شعار', icon: ImagePlus, color: 'bg-purple-50 text-purple-600' },
};

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<Stats>({
    totalRestaurants: 0, totalSubscriptions: 0, newSubscriptionsThisMonth: 0,
    totalMenuItems: 0, totalReviews: 0, totalOffers: 0, totalBranches: 0,
    totalHubVisits: 0, totalApplications: 0, avgRating: 0,
  });
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [topRestaurants, setTopRestaurants] = useState<TopRestaurant[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const fetchData = async () => {
      setIsLoading(true);
      try {
        const [restaurantsRes, subscriptionsRes, activityRes, menuItemsRes, reviewsRes, offersRes, branchesRes, hubVisitsRes, appsRes] = await Promise.all([
          supabase.from('restaurants').select('*'),
          supabase.from('subscriptions').select('*'),
          supabase.from('activity').select('*').order('timestamp', { ascending: false }).limit(50),
          supabase.from('menu_items').select('*'),
          supabase.from('reviews').select('*'),
          supabase.from('offers').select('*'),
          supabase.from('branches').select('*'),
          supabase.from('hub_visits').select('*'),
          supabase.from('applications').select('*'),
        ]);

        if (!isMounted) return;

        const restaurants = (restaurantsRes.data || []) as any[];
        const allSubs = (subscriptionsRes.data || []) as any[];
        const menuItems = (menuItemsRes.data || []) as any[];
        const reviews = (reviewsRes.data || []) as any[];
        const offers = (offersRes.data || []) as any[];
        const branches = (branchesRes.data || []) as any[];
        const hubVisits = (hubVisitsRes.data || []) as any[];
        const apps = (appsRes.data || []) as any[];

        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

        const totalRestaurants = restaurants.length;
        const totalSubscriptions = allSubs.length;
        const newSubscriptionsThisMonth = allSubs.filter((s: any) => {
          const startDate = s.start_date ? new Date(s.start_date) : null;
          return startDate && startDate >= startOfMonth;
        }).length;
        const totalMenuItems = menuItems.length;
        const totalReviews = reviews.length;
        const totalOffers = offers.length;
        const totalBranches = branches.length;
        const totalHubVisits = hubVisits.length;
        const totalApplications = apps.length;
        const avgRating = reviews.length > 0 ? reviews.reduce((sum: number, r: any) => sum + (r.rating || 0), 0) / reviews.length : 0;

        setStats({
          totalRestaurants, totalSubscriptions, newSubscriptionsThisMonth,
          totalMenuItems, totalReviews, totalOffers, totalBranches,
          totalHubVisits, totalApplications, avgRating: Math.round(avgRating * 10) / 10,
        });

        // Top restaurants by visits
        const visitCounts: Record<string, number> = {};
        hubVisits.forEach((v: any) => {
          const rid = v.restaurant_id || v.restaurantId;
          if (rid) visitCounts[rid] = (visitCounts[rid] || 0) + 1;
        });
        const dishCounts: Record<string, number> = {};
        menuItems.forEach((m: any) => {
          const rid = m.restaurant_id;
          if (rid) dishCounts[rid] = (dishCounts[rid] || 0) + 1;
        });
        const reviewCounts: Record<string, number> = {};
        reviews.forEach((r: any) => {
          const rid = r.restaurant_id;
          if (rid) reviewCounts[rid] = (reviewCounts[rid] || 0) + 1;
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

        const items: ActivityItem[] = (activityRes.data || []).map((d: any) => ({
          id: d.id,
          type: d.type as ActivityItem['type'],
          restaurantId: d.restaurantId ?? null,
          restaurantName: d.restaurantName ?? null,
          planName: d.planName ?? null,
          userId: d.userId ?? null,
          timestamp: d.timestamp ?? null,
        }));
        setActivities(items);
      } catch (error) {
        console.error('Error fetching admin dashboard data:', error);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    fetchData();
    return () => { isMounted = false; };
  }, []);

  if (isLoading) {
    return (
      <div className="p-4 lg:p-6 space-y-5">
        <div className="space-y-2">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-4 w-80" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}
        </div>
        <Skeleton className="h-48 rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-6 space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-lg font-bold text-gray-900">لوحة التحكم</h1>
        <p className="text-xs text-gray-400 mt-0.5">نظرة عامة على أداء ونمو المنصة</p>
      </div>

      {/* Main Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'المطاعم', value: stats.totalRestaurants, icon: ShoppingBag, color: 'bg-blue-50 text-blue-500' },
          { label: 'الاشتراكات', value: stats.totalSubscriptions, icon: Users, color: 'bg-emerald-50 text-emerald-500' },
          { label: 'اشتراكات الشهر', value: stats.newSubscriptionsThisMonth, icon: TrendingUp, color: 'bg-purple-50 text-purple-500' },
          { label: 'الزيارات', value: stats.totalHubVisits, icon: Eye, color: 'bg-amber-50 text-amber-500' },
          { label: 'الأطباق', value: stats.totalMenuItems, icon: Utensils, color: 'bg-rose-50 text-rose-500' },
          { label: 'التقييمات', value: stats.totalReviews, icon: Star, color: 'bg-yellow-50 text-yellow-600' },
          { label: 'العروض', value: stats.totalOffers, icon: Megaphone, color: 'bg-indigo-50 text-indigo-500' },
          { label: 'الفروع', value: stats.totalBranches, icon: MapPin, color: 'bg-teal-50 text-teal-500' },
        ].map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className="rounded-2xl border border-gray-100 p-4">
              <div className="flex items-center justify-between mb-3">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${stat.color}`}>
                  <Icon className="h-4 w-4" />
                </div>
                <span className="text-2xl font-bold text-gray-900">{stat.value}</span>
              </div>
              <p className="text-[11px] text-gray-400">{stat.label}</p>
            </div>
          );
        })}
      </div>

      {/* Second Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* Rating */}
        <div className="rounded-2xl border border-gray-100 p-5 flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-yellow-50 flex items-center justify-center">
            <Star className="h-6 w-6 text-yellow-500" />
          </div>
          <div>
            <p className="text-3xl font-bold text-gray-900">{stats.avgRating}</p>
            <p className="text-[11px] text-gray-400">متوسط التقييم من {stats.totalReviews} تقييم</p>
          </div>
        </div>

        {/* Applications */}
        <div className="rounded-2xl border border-gray-100 p-5 flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-cyan-50 flex items-center justify-center">
            <MessageSquare className="h-6 w-6 text-cyan-500" />
          </div>
          <div>
            <p className="text-3xl font-bold text-gray-900">{stats.totalApplications}</p>
            <p className="text-[11px] text-gray-400">تطبيق متاح للمطاعم</p>
          </div>
        </div>

        {/* Top Restaurant */}
        <div className="rounded-2xl border border-gray-100 p-5">
          <p className="text-xs font-bold text-gray-500 mb-3">أكثر المطاعم زيارة</p>
          {topRestaurants.length > 0 ? (
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gray-900 flex items-center justify-center text-white text-xs font-bold shrink-0">
                {topRestaurants[0].name.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-gray-900 truncate">{topRestaurants[0].name}</p>
                <p className="text-[10px] text-gray-400">{topRestaurants[0].visits} زيارة · {topRestaurants[0].dishes} طبق · {topRestaurants[0].reviews} تقييم</p>
              </div>
            </div>
          ) : (
            <p className="text-xs text-gray-300">لا توجد بيانات</p>
          )}
        </div>
      </div>

      {/* Top Restaurants Table */}
      {topRestaurants.length > 1 && (
        <div className="rounded-2xl border border-gray-100 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="text-sm font-bold text-gray-900">أفضل المطاعم أداءً</h2>
          </div>
          <div className="divide-y divide-gray-50">
            {topRestaurants.map((r, i) => (
              <div key={i} className="flex items-center gap-3 px-5 py-3">
                <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-500 shrink-0">
                  {i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-gray-700 truncate">{r.name}</p>
                </div>
                <div className="flex items-center gap-3 text-[10px] text-gray-400 shrink-0">
                  <span>{r.visits} زيارة</span>
                  <span>{r.dishes} طبق</span>
                  <span>{r.reviews} تقييم</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Activity */}
      <div className="rounded-2xl border border-gray-100 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="text-sm font-bold text-gray-900">النشاط الأخير</h2>
        </div>
        {activities.length === 0 ? (
          <div className="py-16 text-center">
            <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-3">
              <Sparkles className="h-6 w-6 text-gray-300" />
            </div>
            <p className="text-xs font-bold text-gray-400">لا يوجد نشاط مسجل</p>
            <p className="text-[11px] text-gray-300 mt-1">ستظهر الأنشطة هنا فور حدوثها</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {activities.slice(0, 10).map((item) => {
              const ts = item.timestamp ? new Date(item.timestamp) : new Date(0);
              const config = activityConfig[item.type] || activityConfig.restaurant_created;
              const Icon = config.icon;
              const detail =
                item.type === 'restaurant_created' || item.type === 'logo_added'
                  ? item.restaurantName || '—'
                  : item.type === 'subscription_started'
                  ? [item.planName, item.restaurantName].filter(Boolean).join(' · ') || '—'
                  : '—';

              return (
                <div key={item.id} className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50 transition-colors">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${config.color}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-gray-700">{config.label}</p>
                    <p className="text-[11px] text-gray-400 truncate">{detail}</p>
                  </div>
                  <span className="text-[10px] text-gray-300 shrink-0" title={ts.toLocaleString('ar-SA')}>
                    {formatDistanceToNow(ts, { addSuffix: true, locale: ar })}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
