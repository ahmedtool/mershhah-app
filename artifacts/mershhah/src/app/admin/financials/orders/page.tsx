'use client';

import { useEffect, useState } from 'react';
import { ShoppingCart, Search, Filter, Download, Loader2, Eye, CheckCircle, Clock, XCircle, BarChart3, Package, Tag } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Skeleton } from '@/components/ui/skeleton';
import { Link } from 'wouter';
import { usePathname } from '@/lib/navigation';
import type { Subscription, Plan, Profile, Restaurant } from '@/lib/types';

type Order = {
  id: string;
  restaurant: string;
  ownerName: string;
  plan: string;
  amount: number;
  status: 'active' | 'inactive' | 'cancelled';
  startDate: string;
  endDate: string;
};

export default function FinancialsOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive' | 'cancelled'>('all');

  useEffect(() => {
    const fetchOrders = async () => {
      const [subsRes, plansRes, profilesRes, restaurantsRes] = await Promise.all([
        supabase.from('subscriptions').select('*'),
        supabase.from('plans').select('*'),
        supabase.from('profiles').select('*'),
        supabase.from('restaurants').select('*'),
      ]);

      const subs = (subsRes.data || []) as Subscription[];
      const plans = (plansRes.data || []) as Plan[];
      const profiles = (profilesRes.data || []) as Profile[];
      const restaurants = (restaurantsRes.data || []) as Restaurant[];

      const planMap = new Map(plans.map(p => [p.id, p]));
      const profileMap = new Map(profiles.map(p => [p.id, p]));
      const restaurantMap = new Map(restaurants.map(r => [r.owner_id, r]));

      const ordersData: Order[] = subs.map(sub => {
        const plan = planMap.get(sub.plan_id);
        const profile = profileMap.get(sub.profile_id);
        const restaurant = restaurantMap.get(sub.profile_id);

        return {
          id: sub.id,
          restaurant: restaurant?.name || profile?.restaurant_name || 'غير محدد',
          ownerName: profile?.full_name || 'غير محدد',
          plan: sub.plan_name,
          amount: plan?.price || 0,
          status: sub.status,
          startDate: sub.start_date,
          endDate: sub.end_date,
        };
      }).sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());

      setOrders(ordersData);
      setIsLoading(false);
    };

    fetchOrders();
  }, []);

  const filteredOrders = orders.filter(order => {
    const matchesSearch = order.restaurant.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.ownerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.plan.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || order.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const statusConfig = {
    active: { label: 'نشط', icon: CheckCircle, color: 'bg-emerald-50 text-emerald-600' },
    inactive: { label: 'منتهي', icon: Clock, color: 'bg-gray-50 text-gray-500' },
    cancelled: { label: 'ملغي', icon: XCircle, color: 'bg-red-50 text-red-500' },
  };

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

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-bold text-gray-900">الطلبات والاشتراكات</h2>
          <p className="text-[10px] text-gray-400 mt-0.5">{filteredOrders.length} طلب</p>
        </div>
        <button className="h-9 px-4 rounded-xl border border-gray-200 text-[11px] font-bold text-gray-600 hover:bg-gray-50 transition-colors flex items-center gap-2">
          <Download className="h-3.5 w-3.5" />
          تصدير
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-300" />
          <input
            placeholder="بحث بالاسم أو الباقة..."
            className="w-full h-9 pr-8 pl-3 rounded-xl border border-gray-200 text-[11px] text-right placeholder:text-gray-300 focus:outline-none focus:border-gray-300"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-1 bg-gray-50 rounded-xl p-1">
          {(['all', 'active', 'inactive', 'cancelled'] as const).map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`h-8 px-3 rounded-lg text-[10px] font-bold transition-colors ${
                statusFilter === status
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              {status === 'all' ? 'الكل' : statusConfig[status].label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
        {isLoading ? (
          <div className="p-5 space-y-3">
            <Skeleton className="h-12 rounded-xl" />
            <Skeleton className="h-12 rounded-xl" />
            <Skeleton className="h-12 rounded-xl" />
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="text-center py-12">
            <ShoppingCart className="h-10 w-10 text-gray-200 mx-auto mb-3" />
            <p className="text-xs text-gray-400 font-bold">لا توجد طلبات</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-right px-5 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-wider">المطعم</th>
                  <th className="text-right px-5 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-wider">المالك</th>
                  <th className="text-right px-5 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-wider">الباقة</th>
                  <th className="text-right px-5 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-wider">المبلغ</th>
                  <th className="text-right px-5 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-wider">تاريخ البداية</th>
                  <th className="text-right px-5 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-wider">تاريخ النهاية</th>
                  <th className="text-right px-5 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-wider">الحالة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filteredOrders.map((order) => {
                  const startDate = new Date(order.startDate);
                  const endDate = new Date(order.endDate);
                  const statusInfo = statusConfig[order.status];
                  const StatusIcon = statusInfo.icon;
                  return (
                    <tr key={order.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-5 py-3">
                        <span className="font-bold text-gray-700">{order.restaurant}</span>
                      </td>
                      <td className="px-5 py-3">
                        <span className="text-gray-500">{order.ownerName}</span>
                      </td>
                      <td className="px-5 py-3">
                        <span className="text-gray-600">{order.plan}</span>
                      </td>
                      <td className="px-5 py-3">
                        <span className="font-bold text-gray-900">{order.amount.toLocaleString()} ر.س</span>
                      </td>
                      <td className="px-5 py-3">
                        <span className="text-gray-400">{startDate.toLocaleDateString('ar-SA')}</span>
                      </td>
                      <td className="px-5 py-3">
                        <span className="text-gray-400">{endDate.toLocaleDateString('ar-SA')}</span>
                      </td>
                      <td className="px-5 py-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${statusInfo.color}`}>
                          <StatusIcon className="h-3 w-3" />
                          {statusInfo.label}
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
