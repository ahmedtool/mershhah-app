'use client';

import { Sparkles, UserPlus, ImagePlus } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ar } from 'date-fns/locale';

export type ActivityItem = {
  id: string;
  type: 'restaurant_created' | 'subscription_started' | 'logo_added';
  restaurantId?: string | null;
  restaurantName?: string | null;
  planName?: string | null;
  userId?: string | null;
  timestamp: string | null;
};

const activityConfig: Record<string, { label: string; icon: any; color: string }> = {
  restaurant_created: { label: 'إنشاء حساب', icon: UserPlus, color: 'bg-blue-50 text-blue-600' },
  subscription_started: { label: 'تفعيل اشتراك', icon: Sparkles, color: 'bg-emerald-50 text-emerald-600' },
  logo_added: { label: 'إضافة شعار', icon: ImagePlus, color: 'bg-rose-50 text-rose-600' },
};

interface RecentActivityCardProps {
  items: ActivityItem[];
}

export function RecentActivityCard({ items }: RecentActivityCardProps) {
  return (
    <div className="rounded-2xl border border-gray-100 overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100">
        <h2 className="text-sm font-bold text-gray-900">النشاط الأخير</h2>
      </div>
      {items.length === 0 ? (
        <div className="py-16 text-center">
          <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-3">
            <Sparkles className="h-6 w-6 text-gray-600" />
          </div>
          <p className="text-xs font-bold text-gray-600">لا يوجد نشاط مسجل</p>
          <p className="text-[11px] text-gray-600 mt-1">ستظهر الأنشطة هنا فور حدوثها</p>
        </div>
      ) : (
        <div className="divide-y divide-gray-50">
          {items.slice(0, 10).map((item) => {
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
                  <p className="text-[11px] text-gray-600 truncate">{detail}</p>
                </div>
                <span className="text-[10px] text-gray-600 shrink-0" title={ts.toLocaleString('ar-SA')}>
                  {formatDistanceToNow(ts, { addSuffix: true, locale: ar })}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
