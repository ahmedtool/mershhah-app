'use client';

import { ShoppingBag, Utensils, Star, Megaphone, MapPin, Eye, MessageSquare, LayoutGrid } from 'lucide-react';

interface UsageStatsGridProps {
  totalRestaurants: number;
  totalBranches: number;
  totalMenuItems: number;
  totalOffers: number;
  totalHubVisits: number;
  totalReviews: number;
  avgRating: number;
  totalApplications: number;
}

export function UsageStatsGrid(stats: UsageStatsGridProps) {
  const tiles = [
    { label: 'المطاعم', value: stats.totalRestaurants, icon: ShoppingBag, color: 'bg-blue-50 text-blue-500' },
    { label: 'الفروع', value: stats.totalBranches, icon: MapPin, color: 'bg-teal-50 text-teal-500' },
    { label: 'الأطباق', value: stats.totalMenuItems, icon: Utensils, color: 'bg-rose-50 text-rose-500' },
    { label: 'العروض', value: stats.totalOffers, icon: Megaphone, color: 'bg-sky-50 text-sky-500' },
    { label: 'الزيارات', value: stats.totalHubVisits, icon: Eye, color: 'bg-amber-50 text-amber-500' },
    { label: 'التقييمات', value: stats.totalReviews, icon: Star, color: 'bg-yellow-50 text-yellow-600' },
    { label: 'متوسط التقييم', value: stats.avgRating, icon: Star, color: 'bg-orange-50 text-orange-500' },
    { label: 'تطبيقات التوصيل', value: stats.totalApplications, icon: LayoutGrid, color: 'bg-violet-50 text-violet-500' },
  ];

  return (
    <div className="rounded-2xl border border-gray-100 p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-bold text-gray-900">استخدام المنصة</h2>
        <MessageSquare className="h-4 w-4 text-gray-300" />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {tiles.map((tile) => {
          const Icon = tile.icon;
          return (
            <div key={tile.label} className="rounded-xl bg-gray-50 p-3.5">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-2.5 ${tile.color}`}>
                <Icon className="h-4 w-4" />
              </div>
              <div className="text-lg font-bold text-gray-900" style={{ fontVariantNumeric: 'tabular-nums' }}>{tile.value}</div>
              <p className="text-[10px] text-gray-600 mt-0.5">{tile.label}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
