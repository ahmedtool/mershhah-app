'use client';

import { Wallet, Users, TrendingUp, AlarmClock } from 'lucide-react';

interface DashboardKpiCardsProps {
  arr: number;
  mrr: number;
  activeSubscribers: number;
  newThisMonth: number;
  expiringSoon: number;
}

export function DashboardKpiCards({ arr, mrr, activeSubscribers, newThisMonth, expiringSoon }: DashboardKpiCardsProps) {
  const money = (n: number) => `${Math.round(n).toLocaleString('ar')} ر.س`;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
      {/* Hero: ARR */}
      <div className="rounded-2xl p-5 text-white relative overflow-hidden" style={{ background: 'linear-gradient(135deg, #111827, #1f2937)' }}>
        <div className="absolute -end-6 -top-6 w-28 h-28 rounded-full bg-white/5" />
        <div className="relative">
          <div className="flex items-center gap-2 text-gray-300 text-[11px] mb-2">
            <Wallet className="h-3.5 w-3.5" />
            الإيراد السنوي المتكرر (ARR)
          </div>
          <div className="text-2xl font-black" style={{ fontVariantNumeric: 'tabular-nums' }}>{money(arr)}</div>
          <div className="text-[11px] text-gray-400 mt-1">≈ {money(mrr)} شهريًا</div>
        </div>
      </div>

      <div className="rounded-2xl border border-gray-100 p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <Users className="h-4 w-4" />
          </div>
          <span className="text-2xl font-bold text-gray-900" style={{ fontVariantNumeric: 'tabular-nums' }}>{activeSubscribers}</span>
        </div>
        <p className="text-[11px] text-gray-600">مشتركون نشطون</p>
      </div>

      <div className="rounded-2xl border border-gray-100 p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="w-9 h-9 rounded-xl bg-cyan-50 text-cyan-600 flex items-center justify-center">
            <TrendingUp className="h-4 w-4" />
          </div>
          <span className="text-2xl font-bold text-gray-900" style={{ fontVariantNumeric: 'tabular-nums' }}>{newThisMonth}</span>
        </div>
        <p className="text-[11px] text-gray-600">اشتراكات جديدة هذا الشهر</p>
      </div>

      <div className="rounded-2xl border border-gray-100 p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
            <AlarmClock className="h-4 w-4" />
          </div>
          <span className="text-2xl font-bold text-gray-900" style={{ fontVariantNumeric: 'tabular-nums' }}>{expiringSoon}</span>
        </div>
        <p className="text-[11px] text-gray-600">تنتهي خلال ٣٠ يوم</p>
      </div>
    </div>
  );
}
