'use client';

import { MoreHorizontal } from 'lucide-react';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import type { Profile, Subscription } from '@/lib/types';

export type SubscriberRow = Profile & { currentSub: Subscription | null };

interface SubscribersTableProps {
  rows: SubscriberRow[];
  selectedProfileId: string | null;
  onSelect: (profile: SubscriberRow) => void;
}

const statusConfig = {
  active: { text: 'نشط', className: 'bg-emerald-50 text-emerald-700' },
  pending: { text: 'بانتظار', className: 'bg-amber-50 text-amber-700' },
  suspended: { text: 'معلق', className: 'bg-red-50 text-red-700' },
};

export function SubscribersTable({ rows, selectedProfileId, onSelect }: SubscribersTableProps) {
  if (rows.length === 0) {
    return <div className="py-16 text-center text-gray-600 text-sm">لا توجد نتائج مطابقة.</div>;
  }

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[720px]">
        <div className="grid grid-cols-[1.8fr_1fr_1fr_1fr_.6fr] gap-3 items-center px-5 py-3 bg-gray-50 border-b border-gray-100 text-[11px] font-bold text-gray-600">
          <div>المشترك</div>
          <div>الحالة</div>
          <div>الباقة</div>
          <div>الانتهاء</div>
          <div />
        </div>
        <div className="divide-y divide-gray-50">
          {rows.map((row) => {
            const status = statusConfig[row.account_status] || statusConfig.pending;
            const endDate = row.currentSub?.end_date ? new Date(row.currentSub.end_date) : null;
            const isPerpetual = row.currentSub?.plan_id === 'free';
            return (
              <button
                key={row.id}
                type="button"
                onClick={() => onSelect(row)}
                className={cn(
                  'w-full grid grid-cols-[1.8fr_1fr_1fr_1fr_.6fr] gap-3 items-center px-5 py-3.5 text-right hover:bg-gray-50 transition-colors',
                  selectedProfileId === row.id && 'bg-gray-50'
                )}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-gray-900 text-white flex items-center justify-center font-bold shrink-0">
                    {(row.restaurant_name || '؟').charAt(0)}
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-gray-900 truncate">{row.restaurant_name || '—'}</div>
                    <div className="text-[10px] text-gray-600 truncate">{row.full_name}</div>
                  </div>
                </div>
                <div>
                  <span className={cn('inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold', status.className)}>
                    <span className="w-1.5 h-1.5 rounded-full bg-current" />
                    {status.text}
                  </span>
                </div>
                <div className="text-xs font-bold text-gray-700 truncate">{row.currentSub?.plan_name || '—'}</div>
                <div>
                  <div className="text-xs font-bold text-gray-900">
                    {isPerpetual ? 'دائم' : endDate ? format(endDate, 'dd MMM yyyy', { locale: ar }) : '—'}
                  </div>
                </div>
                <div className="flex justify-end">
                  <span className="w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center text-gray-600">
                    <MoreHorizontal className="h-4 w-4" />
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
