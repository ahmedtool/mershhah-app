'use client';

import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartConfig } from '@/components/ui/chart';
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';

export type MonthPoint = { month: string; accounts: number; revenue: number };

interface GrowthChartsProps {
  data: MonthPoint[];
}

const accountsConfig = {
  accounts: { label: 'حسابات جديدة', color: '#111827' },
} satisfies ChartConfig;

const revenueConfig = {
  revenue: { label: 'إيراد جديد (ر.س)', color: '#10b981' },
} satisfies ChartConfig;

export function GrowthCharts({ data }: GrowthChartsProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
      <div className="rounded-2xl border border-gray-100 p-5">
        <h3 className="text-sm font-bold text-gray-900 mb-1">نمو الحسابات</h3>
        <p className="text-[10px] text-gray-600 mb-4">عدد المطاعم الجديدة المسجلة شهريًا</p>
        <ChartContainer config={accountsConfig} className="h-[220px] w-full">
          <BarChart accessibilityLayer data={data} margin={{ top: 10, left: 0, right: -20, bottom: 5 }}>
            <CartesianGrid vertical={false} stroke="#f3f4f6" />
            <XAxis dataKey="month" tickLine={false} tickMargin={10} axisLine={false} tick={{ fontSize: 10, fill: '#9ca3af' }} />
            <YAxis tickLine={false} axisLine={false} tickMargin={10} allowDecimals={false} tick={{ fontSize: 10, fill: '#9ca3af' }} />
            <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="dot" />} />
            <Bar dataKey="accounts" fill="var(--color-accounts)" radius={6} />
          </BarChart>
        </ChartContainer>
      </div>

      <div className="rounded-2xl border border-gray-100 p-5">
        <h3 className="text-sm font-bold text-gray-900 mb-1">نمو الإيراد</h3>
        <p className="text-[10px] text-gray-600 mb-4">قيمة الاشتراكات المدفوعة الجديدة شهريًا</p>
        <ChartContainer config={revenueConfig} className="h-[220px] w-full">
          <BarChart accessibilityLayer data={data} margin={{ top: 10, left: 0, right: -20, bottom: 5 }}>
            <CartesianGrid vertical={false} stroke="#f3f4f6" />
            <XAxis dataKey="month" tickLine={false} tickMargin={10} axisLine={false} tick={{ fontSize: 10, fill: '#9ca3af' }} />
            <YAxis tickLine={false} axisLine={false} tickMargin={10} allowDecimals={false} tick={{ fontSize: 10, fill: '#9ca3af' }} />
            <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="dot" />} />
            <Bar dataKey="revenue" fill="var(--color-revenue)" radius={6} />
          </BarChart>
        </ChartContainer>
      </div>
    </div>
  );
}
