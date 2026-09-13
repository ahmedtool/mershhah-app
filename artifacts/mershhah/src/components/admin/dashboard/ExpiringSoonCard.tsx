'use client';

import { Link } from 'wouter';
import { AlarmClock, ChevronLeft } from 'lucide-react';

export type ExpiringItem = { profileId: string; name: string; planName: string; daysLeft: number };

interface ExpiringSoonCardProps {
  items: ExpiringItem[];
}

export function ExpiringSoonCard({ items }: ExpiringSoonCardProps) {
  return (
    <div className="rounded-2xl border border-gray-100 overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
        <h2 className="text-sm font-bold text-gray-900">اشتراكات تنتهي قريبًا</h2>
        <Link href="/admin/management" className="text-[11px] font-bold text-gray-600 hover:text-gray-900 flex items-center gap-1">
          إدارة المشتركين <ChevronLeft className="h-3.5 w-3.5" />
        </Link>
      </div>
      {items.length === 0 ? (
        <div className="py-10 text-center">
          <div className="w-12 h-12 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-2">
            <AlarmClock className="h-5 w-5 text-gray-600" />
          </div>
          <p className="text-xs text-gray-600">ما فيه اشتراكات تنتهي خلال ٣٠ يوم</p>
        </div>
      ) : (
        <div className="divide-y divide-gray-50">
          {items.map((item) => (
            <div key={item.profileId} className="flex items-center gap-3 px-5 py-3">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-gray-900 truncate">{item.name}</p>
                <p className="text-[10px] text-gray-600">{item.planName}</p>
              </div>
              <span className={`text-[11px] font-bold px-2 py-1 rounded-full shrink-0 ${item.daysLeft <= 7 ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-600'}`}>
                {item.daysLeft} يوم
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
