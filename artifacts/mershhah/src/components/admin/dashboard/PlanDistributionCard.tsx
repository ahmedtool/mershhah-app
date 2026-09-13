'use client';

export type PlanSlice = { label: string; count: number; color: string };

interface PlanDistributionCardProps {
  items: PlanSlice[];
  total: number;
}

export function PlanDistributionCard({ items, total }: PlanDistributionCardProps) {
  return (
    <div className="rounded-2xl border border-gray-100 p-5">
      <h3 className="text-sm font-bold text-gray-900 mb-4">توزيع المشتركين على الباقات</h3>
      {total === 0 ? (
        <p className="text-xs text-gray-600 py-6 text-center">لا توجد بيانات</p>
      ) : (
        <div className="space-y-3">
          {items.map((item) => {
            const pct = total > 0 ? Math.round((item.count / total) * 100) : 0;
            return (
              <div key={item.label}>
                <div className="flex items-center justify-between text-[11px] mb-1.5">
                  <span className="flex items-center gap-1.5 font-bold text-gray-700">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                    {item.label}
                  </span>
                  <span className="text-gray-600">{item.count} · {pct}%</span>
                </div>
                <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: item.color }} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
