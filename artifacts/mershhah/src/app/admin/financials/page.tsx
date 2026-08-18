'use client';

import { useEffect, useState } from 'react';
import { DollarSign, TrendingUp, Users, ArrowUpRight, ArrowDownRight, Calendar, BarChart3, PieChart, Package, ShoppingCart, Tag, Undo2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Skeleton } from '@/components/ui/skeleton';
import { Link } from 'wouter';
import { usePathname } from '@/lib/navigation';
import type { Subscription } from '@/lib/types';

type RevenueStats = {
  totalRevenue: number;
  monthlyRevenue: number;
  lastMonthRevenue: number;
  totalRefunded: number;
  avgPerRestaurant: number;
  totalSubscriptions: number;
  activeSubscriptions: number;
  cancelledSubscriptions: number;
  pendingSubscriptions: number;
  revenueByPlan: { plan: string; count: number; revenue: number }[];
  monthlyTrend: { month: string; revenue: number; refunded: number }[];
  recentPayments: {
    id: string;
    restaurant: string;
    description: string;
    amount: number;
    date: string;
    status: 'completed' | 'failed' | 'pending';
    type: 'subscription' | 'refund' | 'tool_purchase' | 'adjustment' | 'credit_pack';
  }[];
};

const monthNames = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];

export default function AdminFinancialsPage() {
  const [stats, setStats] = useState<RevenueStats>({
    totalRevenue: 0, monthlyRevenue: 0, lastMonthRevenue: 0, totalRefunded: 0, avgPerRestaurant: 0,
    totalSubscriptions: 0, activeSubscriptions: 0, cancelledSubscriptions: 0, pendingSubscriptions: 0,
    revenueByPlan: [], monthlyTrend: [], recentPayments: [],
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      // Real cash flow lives in `transactions` — everything else here is
      // just for labeling (plan/restaurant names) and subscription counts.
      const [txRes, subsRes, restaurantsRes, profilesRes] = await Promise.all([
        supabase.from('transactions').select('*').order('created_at', { ascending: false }),
        supabase.from('subscriptions').select('*'),
        supabase.from('restaurants').select('id, name, owner_id'),
        supabase.from('profiles').select('id, restaurant_name'),
      ]);

      const transactions = txRes.data || [];
      const subs = (subsRes.data || []) as Subscription[];
      const restaurants = restaurantsRes.data || [];
      const profiles = profilesRes.data || [];

      const subMap = new Map(subs.map(s => [s.id, s]));
      const restaurantByProfile = new Map(restaurants.map((r: any) => [r.owner_id, r]));
      const profileMap = new Map(profiles.map((p: any) => [p.id, p]));

      const nameForProfile = (profileId: string) =>
        restaurantByProfile.get(profileId)?.name || profileMap.get(profileId)?.restaurant_name || profileId;

      const activeSubs = subs.filter(s => s.status === 'active');
      const cancelledSubs = subs.filter(s => s.status === 'cancelled');
      const pendingSubs = subs.filter(s => s.status === 'pending');

      const completedCharges = transactions.filter((t: any) => (t.type === 'subscription' || t.type === 'credit_pack') && t.status === 'completed');
      const completedRefunds = transactions.filter((t: any) => t.type === 'refund' && t.status === 'completed');

      const grossRevenue = completedCharges.reduce((sum: number, t: any) => sum + Number(t.amount || 0), 0);
      const totalRefunded = completedRefunds.reduce((sum: number, t: any) => sum + Number(t.amount || 0), 0);
      const totalRevenue = grossRevenue - totalRefunded;

      const revenueByPlanMap = new Map<string, { count: number; revenue: number }>();
      completedCharges.forEach((t: any) => {
        const planName = subMap.get(t.reference_id)?.plan_name || t.description || 'غير محدد';
        const existing = revenueByPlanMap.get(planName) || { count: 0, revenue: 0 };
        existing.count += 1;
        existing.revenue += Number(t.amount || 0);
        revenueByPlanMap.set(planName, existing);
      });
      const revenueByPlan = Array.from(revenueByPlanMap.entries())
        .map(([plan, data]) => ({ plan, ...data }))
        .sort((a, b) => b.revenue - a.revenue);

      const inMonth = (dateStr: string, d: Date) => {
        const dt = new Date(dateStr);
        return dt.getMonth() === d.getMonth() && dt.getFullYear() === d.getFullYear();
      };
      const netForMonth = (d: Date) => {
        const charged = completedCharges.filter((t: any) => inMonth(t.created_at, d))
          .reduce((sum: number, t: any) => sum + Number(t.amount || 0), 0);
        const refunded = completedRefunds.filter((t: any) => inMonth(t.created_at, d))
          .reduce((sum: number, t: any) => sum + Number(t.amount || 0), 0);
        return { charged, refunded };
      };

      const now = new Date();
      const { charged: monthlyRevenue } = netForMonth(now);
      const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const { charged: lastMonthRevenue } = netForMonth(lastMonthDate);

      const monthlyTrend = [];
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const { charged, refunded } = netForMonth(d);
        monthlyTrend.push({ month: monthNames[d.getMonth()], revenue: charged - refunded, refunded });
      }

      const recentPayments = transactions.slice(0, 10).map((t: any) => ({
        id: t.id,
        restaurant: nameForProfile(t.profile_id),
        description: t.description || (t.type === 'refund' ? 'استرجاع مبلغ' : 'اشتراك'),
        amount: Number(t.amount || 0),
        date: t.created_at,
        status: t.status,
        type: t.type,
      }));

      const payingProfiles = new Set(completedCharges.map((t: any) => t.profile_id));

      setStats({
        totalRevenue,
        monthlyRevenue,
        lastMonthRevenue,
        totalRefunded,
        avgPerRestaurant: payingProfiles.size > 0 ? Math.round(totalRevenue / payingProfiles.size) : 0,
        totalSubscriptions: subs.length,
        activeSubscriptions: activeSubs.length,
        cancelledSubscriptions: cancelledSubs.length,
        pendingSubscriptions: pendingSubs.length,
        revenueByPlan,
        monthlyTrend,
        recentPayments,
      });
      setIsLoading(false);
    };

    fetchData();
  }, []);

  const maxRevenue = Math.max(...stats.monthlyTrend.map(m => m.revenue), 1);
  const momChangePct = stats.lastMonthRevenue > 0
    ? Math.round(((stats.monthlyRevenue - stats.lastMonthRevenue) / stats.lastMonthRevenue) * 100)
    : (stats.monthlyRevenue > 0 ? 100 : 0);
  const pathname = usePathname();

  const tabs = [
    { href: '/admin/financials', label: 'نظرة عامة', icon: BarChart3 },
    { href: '/admin/plans', label: 'الباقات', icon: Package },
    { href: '/admin/financials/orders', label: 'الطلبات', icon: ShoppingCart },
    { href: '/admin/financials/discounts', label: 'أكواد الخصم', icon: Tag },
  ];

  return (
    <div className="space-y-5">
      {/* Tabs */}
      <div className="flex items-center gap-1 bg-gray-50 rounded-xl p-1 w-fit">
        {tabs.map((tab) => {
          const isActive = tab.href === '/admin/financials'
            ? pathname === '/admin/financials'
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
                {momChangePct !== 0 && (
                  <div className={`flex items-center gap-0.5 ${momChangePct > 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                    {momChangePct > 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                    <span className="text-[10px] font-bold">{momChangePct > 0 ? '+' : ''}{momChangePct}%</span>
                  </div>
                )}
              </div>
              <p className="text-xl font-black text-gray-900">{stats.monthlyRevenue.toLocaleString()} ر.س</p>
              <p className="text-[10px] text-gray-400 mt-1">إيراد هذا الشهر (مقارنة بالشهر الماضي)</p>
            </div>

            <div className="bg-white border border-gray-100 rounded-2xl p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="w-9 h-9 rounded-xl bg-red-50 flex items-center justify-center">
                  <Undo2 className="h-4 w-4 text-red-500" />
                </div>
                <span className="text-[10px] text-gray-400">مسترجع</span>
              </div>
              <p className="text-xl font-black text-gray-900">{stats.totalRefunded.toLocaleString()} ر.س</p>
              <p className="text-[10px] text-gray-400 mt-1">إجمالي المبالغ المسترجعة</p>
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
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-2xl" />)
        ) : (
          <>
            <div className="bg-white border border-gray-100 rounded-2xl p-4 text-center">
              <p className="text-2xl font-black text-gray-900">{stats.activeSubscriptions}</p>
              <p className="text-[10px] text-gray-400 mt-1">نشط</p>
            </div>
            <div className="bg-white border border-gray-100 rounded-2xl p-4 text-center">
              <p className="text-2xl font-black text-amber-500">{stats.pendingSubscriptions}</p>
              <p className="text-[10px] text-gray-400 mt-1">قيد الإتمام</p>
            </div>
            <div className="bg-white border border-gray-100 rounded-2xl p-4 text-center">
              <p className="text-2xl font-black text-gray-400">{stats.totalSubscriptions - stats.activeSubscriptions - stats.cancelledSubscriptions - stats.pendingSubscriptions}</p>
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
                  <th className="text-right px-5 py-3 text-[10px] font-bold text-gray-400">المطعم</th>
                  <th className="text-right px-5 py-3 text-[10px] font-bold text-gray-400">الوصف</th>
                  <th className="text-right px-5 py-3 text-[10px] font-bold text-gray-400">المبلغ</th>
                  <th className="text-right px-5 py-3 text-[10px] font-bold text-gray-400">التاريخ</th>
                  <th className="text-right px-5 py-3 text-[10px] font-bold text-gray-400">الحالة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {stats.recentPayments.map((payment) => {
                  const date = new Date(payment.date);
                  const isRefund = payment.type === 'refund';
                  const statusLabel = payment.status === 'completed' ? (isRefund ? 'مسترجع' : 'مدفوع')
                    : payment.status === 'failed' ? 'فشل' : 'معلّق';
                  const statusColor = payment.status === 'completed'
                    ? (isRefund ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600')
                    : payment.status === 'failed' ? 'bg-red-50 text-red-500' : 'bg-gray-100 text-gray-500';
                  return (
                    <tr key={payment.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-5 py-3">
                        <span className="font-bold text-gray-700">{payment.restaurant}</span>
                      </td>
                      <td className="px-5 py-3">
                        <span className="text-gray-500">{payment.description}</span>
                      </td>
                      <td className="px-5 py-3">
                        <span className={`font-bold ${isRefund ? 'text-red-500' : 'text-gray-900'}`}>
                          {isRefund ? '-' : ''}{payment.amount.toLocaleString()} ر.س
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <span className="text-gray-400">{date.toLocaleDateString('ar-SA')}</span>
                      </td>
                      <td className="px-5 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${statusColor}`}>
                          {statusLabel}
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
