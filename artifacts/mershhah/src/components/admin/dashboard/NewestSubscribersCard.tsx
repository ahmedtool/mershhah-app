'use client';

import { Link } from 'wouter';
import { UserPlus, ChevronLeft } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ar } from 'date-fns/locale';

export type NewestSubscriber = {
  id: string;
  name: string;
  ownerName: string | null;
  createdAt: string | null;
  status: 'active' | 'pending' | 'suspended';
  planName: string | null;
};

interface NewestSubscribersCardProps {
  items: NewestSubscriber[];
}

const statusConfig: Record<string, { label: string; className: string }> = {
  active: { label: 'نشط', className: 'bg-emerald-50 text-emerald-700' },
  pending: { label: 'بانتظار', className: 'bg-amber-50 text-amber-700' },
  suspended: { label: 'معلق', className: 'bg-red-50 text-red-700' },
};

export function NewestSubscribersCard({ items }: NewestSubscribersCardProps) {
  return (
    <div className="rounded-2xl border border-gray-100 overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
        <h2 className="text-sm font-bold text-gray-900">أحدث المشتركين</h2>
        <Link href="/admin/management" className="text-[11px] font-bold text-gray-600 hover:text-gray-900 flex items-center gap-1">
          إدارة المشتركين <ChevronLeft className="h-3.5 w-3.5" />
        </Link>
      </div>
      {items.length === 0 ? (
        <div className="py-16 text-center">
          <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-3">
            <UserPlus className="h-6 w-6 text-gray-600" />
          </div>
          <p className="text-xs font-bold text-gray-600">ما فيه مشتركين لسا</p>
        </div>
      ) : (
        <div className="divide-y divide-gray-50">
          {items.map((item) => {
            const status = statusConfig[item.status] || statusConfig.pending;
            const ts = item.createdAt ? new Date(item.createdAt) : null;
            return (
              <div key={item.id} className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50 transition-colors">
                <div className="w-9 h-9 rounded-xl bg-gray-900 text-white flex items-center justify-center font-bold text-xs shrink-0">
                  {(item.name || '؟').charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-gray-900 truncate">{item.name}</p>
                  <p className="text-[10px] text-gray-600 truncate">{item.ownerName || '—'}{item.planName ? ` · ${item.planName}` : ''}</p>
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${status.className}`}>
                    {status.label}
                  </span>
                  {ts && <span className="text-[10px] text-gray-600">{formatDistanceToNow(ts, { addSuffix: true, locale: ar })}</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
