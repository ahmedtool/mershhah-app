'use client';

export type TopRestaurant = { name: string; visits: number; dishes: number; reviews: number };

interface TopRestaurantsCardProps {
  items: TopRestaurant[];
}

export function TopRestaurantsCard({ items }: TopRestaurantsCardProps) {
  if (items.length === 0) return null;

  const medalColor = (i: number) => (i === 0 ? 'bg-amber-100 text-amber-700' : i === 1 ? 'bg-gray-200 text-gray-700' : i === 2 ? 'bg-orange-100 text-orange-700' : 'bg-gray-100 text-gray-600');

  return (
    <div className="rounded-2xl border border-gray-100 overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100">
        <h2 className="text-sm font-bold text-gray-900">أفضل المطاعم أداءً</h2>
      </div>
      <div className="divide-y divide-gray-50">
        {items.map((r, i) => (
          <div key={i} className="flex items-center gap-3 px-5 py-3">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${medalColor(i)}`}>
              {i + 1}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-gray-700 truncate">{r.name}</p>
            </div>
            <div className="flex items-center gap-3 text-[10px] text-gray-600 shrink-0">
              <span>{r.visits} زيارة</span>
              <span>{r.dishes} طبق</span>
              <span>{r.reviews} تقييم</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
