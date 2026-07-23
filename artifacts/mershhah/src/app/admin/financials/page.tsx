'use client';

import { useEffect, useState } from 'react';
import { DollarSign, TrendingUp, CreditCard, Users, ArrowUpRight, ArrowDownRight, Calendar, BarChart3, PieChart, Loader2, Package, ShoppingCart, Tag } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Skeleton } from '@/components/ui/skeleton';
import { Link } from 'wouter';
import { usePathname } from '@/lib/navigation';
import type { Subscription, Plan } from '@/lib/types';

type RevenueStats = {
  totalRevenue: number;
  monthlyRevenue: number;
  avgPerRestaurant: number;
  totalSubscriptions: number;
  activeSubscriptions: number;
  cancelledSubscriptions: number;
  revenueByPlan: { plan: string; count: number; revenue: number }[];
  monthlyTrend: { month: string; revenue: number }[];
  recentPayments: {
    id: string;
    restaurant: string;
    plan: string;
    amount: number;
    date: string;
    status: 'paid' | 'pending' | 'failed';
  }[];
};

const monthNames = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];

export default function AdminFinancialsPage() {
  const [stats, setStats] = useState<RevenueStats>({
    totalRevenue: 0, monthlyRevenue: 0, avgPerRestaurant: 0,
    totalSubscriptions: 0, activeSubscriptions: 0, cancelledSubscriptions: 0,
    revenueByPlan: [], monthlyTrend: [], recentPayments: [],
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      const [subsRes, plansRes, restaurantsRes] = await Promise.all([
        supabase.from('subscriptions').select('*'),
        supabase.from('plans').select('*'),
        supabase.from('restaurants').select('*'),
      ]);

      const subs = (subsRes.data || []) as Subscription[];
      const plans = (plansRes.data || []) as Plan[];
      const restaurants = restaurantsRes.data || [];

      const planMap = new Map(plans.map(p => [p.id, p]));

      const activeSubs = subs.filter(s => s.status === 'active');
      const cancelledSubs = subs.filter(s => s.status === 'cancelled');

      let totalRevenue = 0;
      const revenueByPlanMap = new Map<string, { count: number; revenue: number }>();

      activeSubs.forEach(sub => {
        const plan = planMap.get(sub.plan_id);
        if (plan && plan.price > 0) {
          totalRevenue += plan.price;
          const existing = revenueByPlanMap.get(sub.plan_name) || { count: 0, revenue: 0 };
          existing.count += 1;
          existing.revenue += plan.price;
          revenueByPlanMap.set(sub.plan_name, existing);
        }
      });

      const revenueByPlan = Array.from(revenueByPlanMap.entries()).map(([plan, data]) => ({
        plan, ...data,
      })).sort((a, b) => b.revenue - a.revenue);

      const now = new Date();
      const thisMonth = subs.filter(s => {
        const start = new Date(s.start_date);
        return start.getMonth() === now.getMonth() && start.getFullYear() === now.getFullYear();
      });
      const monthlyRevenue = thisMonth.reduce((sum, sub) => {
        const plan = planMap.get(sub.plan_id);
        return sum + (plan?.price || 0);
      }, 0);

      const monthlyTrend = [];
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const monthSubs = subs.filter(s => {
          const start = new Date(s.start_date);
          return start.getMonth() === d.getMonth() && start.getFullYear() === d.getFullYear();
        });
        const monthRev = monthSubs.reduce((sum, sub) => {
          const plan = planMap.get(sub.plan_id);
          return sum + (plan?.price || 0);
        }, 0);
        monthlyTrend.push({ month: monthNames[d.getMonth()], revenue: monthRev });
      }

      const recentPayments = activeSubs.slice(0, 8).map(sub => {
        const plan = planMap.get(sub.plan_id);
        const rest = restaurants.find((r: any) => r.owner_id === sub.profile_id);
        return {
          id: sub.id,
          restaurant: rest?.name || sub.profile_id,
          plan: sub.plan_name,
          amount: plan?.price || 0,
          date: sub.start_date,
          status: 'paid' as const,
        };
      });

      setStats({
        totalRevenue,
        monthlyRevenue,
        avgPerRestaurant: restaurants.length > 0 ? Math.round(totalRevenue / restaurants.length) : 0,
        totalSubscriptions: subs.length,
        activeSubscriptions: activeSubs.length,
        cancelledSubscriptions: cancelledSubs.length,
        revenueByPlan,
        monthlyTrend,
        recentPayments,
      });
      setIsLoading(false);
    };

    fetchData();
  }, []);

  const maxRevenue = Math.max(...stats.monthlyTrend.map(m => m.revenue), 1);
  const pathname = usePathname();

  const tabs = [
    { href: '/financials', label: 'نظرة عامة', icon: BarChart3 },
    { href: '/financials/plans', label: 'الباقات', icon: Package },
    { href: '/financials/orders', label: 'الطلبات', icon: ShoppingCart },
    { href: '/financials/discounts', label: 'أكواد الخصم', icon: Tag },
  ];

  return (
    <div className="space-y-5">
      {/* Tabs */}
      <div className="flex items-center gap-1 bg-gray-50 rounded-xl p-1 w-fit">
        {tabs.map((tab) => {
          const isActive = tab.href === '/financials'
            ? pathname === '/financials'
            : pathname.startsWith(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex items-center gap-1.5 h-9 px-4 rounded-lg text-[11px] font-bold transition-colors ${
                isActive
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              <tab.icon className="h-3.5 w-3.5" />
              {tab.label}
            </Link>
          );
        })}
      </div>

      <div>
        <h1 className="text-lg font-bold text-gray-900">المالية</h1>
        <p className="text-xs text-gray-400 mt-1">نظرة عامة على الإيرادات والاشتراكات</p>
      </div>

      {/* Main Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)
        ) : (
          <>
            <div className="bg-white border border-gray-100 rounded-2xl p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="w-9 h-9 rounded-xl bg-gray-50 flex items-center justify-center">
                  <DollarSign className="h-4 w-4 text-gray-500" />
                </div>
                <span className="text-[10px] text-gray-400">إجمالي</span>
              </div>
              <p className="text-xl font-black text-gray-900">{stats.totalRevenue.toLocaleString()} ر.س</p>
              <p className="text-[10px] text-gray-400 mt-1">الإيراد الكلي</p>
            </div>

            <div className="bg-white border border-gray-100 rounded-2xl p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center">
                  <TrendingUp className="h-4 w-4 text-emerald-500" />
                </div>
                <div className="flex items-center gap-0.5 text-emerald-500">
                  <ArrowUpRight className="h-3 w-3" />
                  <span className="text-[10px] font-bold">+12%</span>
                </div>
              </div>
              <p className="text-xl font-black text-gray-900">{stats.monthlyRevenue.toLocaleString()} ر.س</p>
              <p className="text-[10px] text-gray-400 mt-1">إيراد هذا الشهر</p>
            </div>

            <div className="bg-white border border-gray-100 rounded-2xl p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center">
                  <CreditCard className="h-4 w-4 text-blue-500" />
                </div>
                <span className="text-[10px] text-gray-400">متوسط</span>
              </div>
              <p className="text-xl font-black text-gray-900">{stats.avgPerRestaurant.toLocaleString()} ر.س</p>
              <p className="text-[10px] text-gray-400 mt-1">متوسط الدفع لكل مطعم</p>
            </div>

            <div className="bg-white border border-gray-100 rounded-2xl p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="w-9 h-9 rounded-xl bg-amber-50 flex items-center justify-center">
                  <Users className="h-4 w-4 text-amber-500" />
                </div>
                <span className="text-[10px] text-gray-400">{stats.totalSubscriptions}</span>
              </div>
              <p className="text-xl font-black text-gray-900">{stats.activeSubscriptions}</p>
              <p className="text-[10px] text-gray-400 mt-1">اشتراك نشط</p>
            </div>
          </>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Monthly Revenue Chart */}
        <div className="lg:col-span-2 bg-white border border-gray-100 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="text-sm font-bold text-gray-900">الإيرادات الشهرية</h3>
              <p className="text-[10px] text-gray-400 mt-0.5">آخر 6 أشهر</p>
            </div>
            <div className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center">
              <BarChart3 className="h-4 w-4 text-gray-400" />
            </div>
          </div>

          {isLoading ? (
            <Skeleton className="h-48 rounded-xl" />
          ) : (
            <div className="flex items-end gap-2 h-48">
              {stats.monthlyTrend.map((item, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-2">
                  <span className="text-[9px] font-bold text-gray-500">{item.revenue.toLocaleString()}</span>
                  <div className="w-full bg-gray-100 rounded-lg relative" style={{ height: '120px' }}>
                    <div
                      className="absolute bottom-0 left-0 right-0 bg-gray-900 rounded-lg transition-all duration-500"
                      style={{ height: `${Math.max((item.revenue / maxRevenue) * 100, 4)}%` }}
                    />
                  </div>
                  <span className="text-[9px] text-gray-400">{item.month}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Revenue by Plan */}
        <div className="bg-white border border-gray-100 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="text-sm font-bold text-gray-900">الإيراد حسب الباقة</h3>
              <p className="text-[10px] text-gray-400 mt-0.5">توزيع الاشتراكات</p>
            </div>
            <div className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center">
              <PieChart className="h-4 w-4 text-gray-400" />
            </div>
          </div>

          {isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-12 rounded-xl" />
              <Skeleton className="h-12 rounded-xl" />
            </div>
          ) : stats.revenueByPlan.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-xs text-gray-400">لا توجد بيانات بعد</p>
            </div>
          ) : (
            <div className="space-y-3">
              {stats.revenueByPlan.map((item, i) => {
                const maxItemRevenue = Math.max(...stats.revenueByPlan.map(p => p.revenue), 1);
                const percentage = Math.round((item.revenue / stats.totalRevenue) * 100);
                return (
                  <div key={i} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-gray-700">{item.plan}</span>
                      <span className="text-[10px] text-gray-400">{item.count} اشتراك</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2">
                      <div
                        className="bg-gray-900 rounded-full h-2 transition-all duration-500"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-gray-900">{item.revenue.toLocaleString()} ر.س</span>
                      <span className="text-[10px] text-gray-400">{percentage}%</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Subscription Status */}
      <div className="grid grid-cols-3 gap-3">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-2xl" />)
        ) : (
          <>
            <div className="bg-white border border-gray-100 rounded-2xl p-4 text-center">
              <p className="text-2xl font-black text-gray-900">{stats.activeSubscriptions}</p>
              <p className="text-[10px] text-gray-400 mt-1">نشط</p>
            </div>
            <div className="bg-white border border-gray-100 rounded-2xl p-4 text-center">
              <p className="text-2xl font-black text-gray-400">{stats.totalSubscriptions - stats.activeSubscriptions - stats.cancelledSubscriptions}</p>
              <p className="text-[10px] text-gray-400 mt-1">منتهي</p>
            </div>
            <div className="bg-white border border-gray-100 rounded-2xl p-4 text-center">
              <p className="text-2xl font-black text-red-400">{stats.cancelledSubscriptions}</p>
              <p className="text-[10px] text-gray-400 mt-1">ملغي</p>
            </div>
          </>
        )}
      </div>

      {/* Recent Payments */}
      <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
        <div className="px-5 pt-5 pb-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-gray-900">آخر المعاملات</h3>
              <p className="text-[10px] text-gray-400 mt-0.5">جميع الدفعات الأخيرة</p>
            </div>
            <div className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center">
              <Calendar className="h-4 w-4 text-gray-400" />
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="p-5 space-y-3">
            <Skeleton className="h-12 rounded-xl" />
            <Skeleton className="h-12 rounded-xl" />
            <Skeleton className="h-12 rounded-xl" />
          </div>
        ) : stats.recentPayments.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-xs text-gray-400">لا توجد معاملات بعد</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-t border-gray-100">
                  <th className="text-right px-5 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-wider">المطعم</th>
                  <th className="text-right px-5 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-wider">الباقة</th>
                  <th className="text-right px-5 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-wider">المبلغ</th>
                  <th className="text-right px-5 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-wider">التاريخ</th>
                  <th className="text-right px-5 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-wider">الحالة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {stats.recentPayments.map((payment) => {
                  const date = new Date(payment.date);
                  return (
                    <tr key={payment.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-5 py-3">
                        <span className="font-bold text-gray-700">{payment.restaurant}</span>
                      </td>
                      <td className="px-5 py-3">
                        <span className="text-gray-500">{payment.plan}</span>
                      </td>
                      <td className="px-5 py-3">
                        <span className="font-bold text-gray-900">{payment.amount.toLocaleString()} ر.س</span>
                      </td>
                      <td className="px-5 py-3">
                        <span className="text-gray-400">{date.toLocaleDateString('ar-SA')}</span>
                      </td>
                      <td className="px-5 py-3">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-600">
                          مدفوع
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
