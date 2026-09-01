'use client';

import { useEffect, useRef, useState } from 'react';
import PageHeader from "@/components/dashboard/PageHeader";
import {
  UploadCloud, FileSpreadsheet, FileText, RotateCw, Receipt, Calendar, ListOrdered, Loader2,
  TrendingDown, AlertTriangle, Lightbulb, ChevronDown, History, Star, Megaphone, Store, Package,
  TrendingUp, TrendingDown as TrendingDownIcon, FileStack, ExternalLink,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useUser } from '@/hooks/useUser';
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart';
import { Bar, BarChart, CartesianGrid, XAxis, YAxis, Line, LineChart, Cell } from 'recharts';
import { parseDeliveryReport, type ParsedDeliveryReport } from '@/lib/delivery-report-reader';
import { generateKeetaInsights } from '@/lib/keeta-order-log-parser';
import { detectAndParseKeetaReport, generateOrderDataInsights, REPORT_TYPE_LABELS, type KeetaParsedReport } from '@/lib/keeta-reports/registry';
import { saveKeetaReport, saveAccountStatementFile, listKeetaReports, getReportFileUrl, type KeetaReportRow } from '@/lib/keeta-reports/storage';
import { cn } from '@/lib/utils';

const sar = (n: number) => `${n.toLocaleString('ar-SA', { maximumFractionDigits: 0 })} ر.س`;
const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('ar-SA', { day: 'numeric', month: 'short', year: 'numeric' });

const VERDICT_STYLE = {
  good: { label: 'جيد', dot: 'bg-emerald-500', bg: 'bg-emerald-50', text: 'text-emerald-700' },
  review: { label: 'يحتاج مراجعة', dot: 'bg-amber-500', bg: 'bg-amber-50', text: 'text-amber-700' },
  costly: { label: 'مكلف', dot: 'bg-red-500', bg: 'bg-red-50', text: 'text-red-700' },
} as const;

function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("bg-white border border-gray-100 rounded-2xl p-5", className)}>{children}</div>;
}

function SectionTitle({ icon: Icon, children }: { icon: any; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <Icon className="h-4 w-4 text-gray-400" />
      <h3 className="text-sm font-bold text-gray-900">{children}</h3>
    </div>
  );
}

function WaterfallRow({ label, value, isFinal }: { label: string; value: number; isFinal?: boolean }) {
  return (
    <div className={cn("flex items-center justify-between py-2.5", !isFinal && "border-b border-gray-50")}>
      <span className={cn("text-xs", isFinal ? "font-bold text-gray-900" : "text-gray-500")}>{label}</span>
      <span className={cn("text-xs font-bold tabular-nums", isFinal ? "text-emerald-600 text-sm" : "text-red-500")}>
        {isFinal ? sar(value) : `- ${sar(value)}`}
      </span>
    </div>
  );
}

function AlertsRecs({ alerts, recommendations }: { alerts: string[]; recommendations: string[] }) {
  return (
    <>
      {alerts.length > 0 && (
        <Card className="bg-amber-50/60 border-amber-100">
          <SectionTitle icon={AlertTriangle}>تنبيهات</SectionTitle>
          <ul className="space-y-2">
            {alerts.map((a, i) => (
              <li key={i} className="text-[11px] text-gray-700 leading-relaxed flex gap-2">
                <span className="text-amber-500 shrink-0">•</span> {a}
              </li>
            ))}
          </ul>
        </Card>
      )}
      <div className="bg-gray-900 rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-3">
          <Lightbulb className="h-4 w-4 text-amber-400" />
          <h3 className="text-sm font-bold text-white">وش أسوي الحين؟</h3>
        </div>
        <ol className="space-y-2.5">
          {recommendations.map((r, i) => (
            <li key={i} className="text-[11px] text-gray-300 leading-relaxed flex gap-2.5">
              <span className="shrink-0 w-4 h-4 rounded-full bg-white/10 text-white text-[9px] font-bold flex items-center justify-center mt-0.5">{i + 1}</span>
              {r}
            </li>
          ))}
        </ol>
      </div>
    </>
  );
}

function CollapsibleTable({ title, count, headers, rows }: { title: string; count: number; headers: string[]; rows: (string | number)[][] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
      <button onClick={() => setOpen((v) => !v)} className="w-full px-4 py-3 flex items-center justify-between text-sm font-bold text-gray-900">
        {title} ({count})
        <ChevronDown className={cn("h-4 w-4 text-gray-400 transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="overflow-x-auto max-h-[480px] overflow-y-auto border-t border-gray-50">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-gray-50">
              <tr>
                {headers.map((h) => (
                  <th key={h} className="px-3 py-2 text-right font-bold text-gray-500 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {rows.map((row, i) => (
                <tr key={i} className="hover:bg-gray-50/50">
                  {row.map((c, j) => (
                    <td key={j} className="px-3 py-2 text-gray-700 whitespace-nowrap">{c}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ---- charts ----
// Real recharts, matching the same ChartContainer pattern used in
// src/components/dashboard/Analytics.tsx - not decoration, these carry the
// numbers a plain table buries: proportion at a glance, trend over time.

function BreakdownChart({ data, color = '#ef4444' }: { data: { name: string; value: number }[]; color?: string }) {
  const filtered = data.filter((d) => d.value > 0);
  if (filtered.length === 0) return null;
  const chartConfig: ChartConfig = { value: { label: 'القيمة', color } };
  return (
    <ChartContainer config={chartConfig} className="w-full aspect-auto" style={{ height: Math.max(120, filtered.length * 36) }}>
      <BarChart data={filtered} layout="vertical" margin={{ top: 0, right: 8, bottom: 0, left: 0 }}>
        <CartesianGrid horizontal={false} stroke="#f3f4f6" />
        <XAxis type="number" tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: '#9ca3af' }} />
        <YAxis type="category" dataKey="name" orientation="right" width={130} tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: '#374151' }} />
        <ChartTooltip cursor={{ fill: '#f9fafb' }} content={<ChartTooltipContent hideLabel />} />
        <Bar dataKey="value" radius={4} fill={color} />
      </BarChart>
    </ChartContainer>
  );
}

function DivergingChart({ data }: { data: { name: string; value: number }[] }) {
  if (data.length === 0) return null;
  const chartConfig: ChartConfig = { value: { label: 'التغيّر %' } };
  return (
    <ChartContainer config={chartConfig} className="w-full aspect-auto" style={{ height: Math.max(140, data.length * 32) }}>
      <BarChart data={data} layout="vertical" margin={{ top: 0, right: 8, bottom: 0, left: 0 }}>
        <CartesianGrid horizontal={false} stroke="#f3f4f6" />
        <XAxis type="number" tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: '#9ca3af' }} unit="%" />
        <YAxis type="category" dataKey="name" orientation="right" width={130} tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: '#374151' }} />
        <ChartTooltip cursor={{ fill: '#f9fafb' }} content={<ChartTooltipContent hideLabel />} />
        <Bar dataKey="value" radius={4}>
          {data.map((d, i) => (
            <Cell key={i} fill={d.value >= 0 ? '#10b981' : '#ef4444'} />
          ))}
        </Bar>
      </BarChart>
    </ChartContainer>
  );
}

function TrendChart({ data }: { data: { date: string; sales: number; revenue: number }[] }) {
  const chartConfig: ChartConfig = {
    sales: { label: 'المبيعات', color: '#111827' },
    revenue: { label: 'الإيرادات', color: '#10b981' },
  };
  return (
    <ChartContainer config={chartConfig} className="w-full aspect-auto h-[220px]">
      <LineChart data={data} margin={{ top: 10, left: 0, right: 10, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke="#f3f4f6" />
        <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={8} tick={{ fontSize: 9, fill: '#9ca3af' }} minTickGap={24} />
        <YAxis tickLine={false} axisLine={false} width={36} tick={{ fontSize: 10, fill: '#9ca3af' }} />
        <ChartTooltip content={<ChartTooltipContent indicator="line" />} />
        <Line type="monotone" dataKey="sales" stroke="var(--color-sales)" strokeWidth={2} dot={false} />
        <Line type="monotone" dataKey="revenue" stroke="var(--color-revenue)" strokeWidth={2} dot={false} />
      </LineChart>
    </ChartContainer>
  );
}

function GroupedBarChart({ data, aKey, bKey, aLabel, bLabel, xKey }: {
  data: Record<string, any>[]; aKey: string; bKey: string; aLabel: string; bLabel: string; xKey: string;
}) {
  const chartConfig: ChartConfig = {
    [aKey]: { label: aLabel, color: '#111827' },
    [bKey]: { label: bLabel, color: '#10b981' },
  };
  return (
    <ChartContainer config={chartConfig} className="w-full aspect-auto h-[220px]">
      <BarChart data={data} margin={{ top: 10, left: 0, right: 10, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke="#f3f4f6" />
        <XAxis dataKey={xKey} tickLine={false} axisLine={false} tick={{ fontSize: 9, fill: '#9ca3af' }} />
        <YAxis tickLine={false} axisLine={false} width={40} tick={{ fontSize: 10, fill: '#9ca3af' }} />
        <ChartTooltip content={<ChartTooltipContent indicator="dot" />} />
        <Bar dataKey={aKey} fill={`var(--color-${aKey})`} radius={4} />
        <Bar dataKey={bKey} fill={`var(--color-${bKey})`} radius={4} />
      </BarChart>
    </ChartContainer>
  );
}

// ---- per-type renderers ----

function OrderLogView({ summary }: { summary: Extract<KeetaParsedReport, { type: 'order_log' }>['summary'] }) {
  const insights = generateKeetaInsights(summary);
  const verdict = VERDICT_STYLE[summary.verdict];
  return (
    <div className="space-y-5">
      <Card>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-gray-900">ملخص الفلوس</h3>
          <span className={cn("flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full", verdict.bg, verdict.text)}>
            <span className={cn("w-1.5 h-1.5 rounded-full", verdict.dot)} /> {verdict.label}
          </span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
          <div><p className="text-lg font-black text-gray-900">{sar(summary.totalOriginalPrice)}</p><p className="text-[10px] text-gray-400">إجمالي المبيعات</p></div>
          <div><p className="text-lg font-black text-emerald-600">{sar(summary.totalProfit)}</p><p className="text-[10px] text-gray-400">وصلك فعلياً</p></div>
          <div><p className="text-lg font-black text-red-500">{sar(summary.gap)}</p><p className="text-[10px] text-gray-400">الفرق</p></div>
        </div>
        <p className="text-[11px] text-gray-500 bg-gray-50 rounded-xl px-3 py-2.5">
          كل 100 ريال مبيعات عن طريق كيتا، يبقى لك تقريباً <span className="font-bold text-gray-900">{summary.netPer100} ريال</span> قبل تكلفة الأكل والتشغيل. ({summary.orderCount} طلب{summary.dateRange ? ` · ${summary.dateRange.from} → ${summary.dateRange.to}` : ''})
        </p>
      </Card>
      <Card>
        <SectionTitle icon={TrendingDown}>وين راحت فلوسي؟</SectionTitle>
        <BreakdownChart
          data={[
            { name: 'عمولة كيتا', value: summary.totalCommission },
            { name: 'خصومات تحملتها', value: summary.totalMerchantPromo },
            { name: 'رسوم الدفع الإلكتروني', value: summary.totalPaymentFee },
            { name: 'فارق الحد الأدنى للطلب', value: summary.totalMinOrderDiff },
            { name: 'رسوم/تعديلات أخرى', value: summary.otherGap },
          ]}
        />
        <div className="mt-3">
          <WaterfallRow label="مبيعاتك" value={summary.totalOriginalPrice} isFinal />
          <WaterfallRow label="عمولة كيتا" value={summary.totalCommission} />
          {summary.totalMerchantPromo > 0 && <WaterfallRow label="خصومات تحملتها" value={summary.totalMerchantPromo} />}
          {summary.totalPaymentFee > 0 && <WaterfallRow label="رسوم الدفع الإلكتروني" value={summary.totalPaymentFee} />}
          {summary.totalMinOrderDiff > 0 && <WaterfallRow label="فارق الحد الأدنى للطلب" value={summary.totalMinOrderDiff} />}
          {summary.otherGap > 1 && <WaterfallRow label="رسوم/تعديلات أخرى" value={summary.otherGap} />}
          <div className="pt-2.5"><WaterfallRow label="الصافي المحول لك" value={summary.totalProfit} isFinal /></div>
        </div>
      </Card>
      <AlertsRecs {...insights} />
      <CollapsibleTable
        title="تفاصيل كل طلب"
        count={summary.orderCount}
        headers={['الوقت', 'الأصناف', 'السعر الأصلي', 'الأرباح', 'الحالة']}
        rows={summary.orders.map((o) => [o.orderTime, o.items.join('، '), sar(o.originalPrice), sar(o.profit), o.isRefunded ? 'استرداد' : o.status])}
      />
    </div>
  );
}

function OrderDataView({ summary }: { summary: Extract<KeetaParsedReport, { type: 'order_data' }>['summary'] }) {
  const insights = generateOrderDataInsights(summary);
  const verdict = VERDICT_STYLE[summary.verdict];
  const lowRated = summary.reviewedOrders.filter((r) => r.score <= 3);
  return (
    <div className="space-y-5">
      <Card>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-gray-900">ملخص الفلوس</h3>
          <span className={cn("flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full", verdict.bg, verdict.text)}>
            <span className={cn("w-1.5 h-1.5 rounded-full", verdict.dot)} /> {verdict.label}
          </span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
          <div><p className="text-lg font-black text-gray-900">{sar(summary.totalSales)}</p><p className="text-[10px] text-gray-400">إجمالي المبيعات</p></div>
          <div><p className="text-lg font-black text-emerald-600">{sar(summary.totalRevenue)}</p><p className="text-[10px] text-gray-400">وصلك فعلياً</p></div>
          <div><p className="text-lg font-black text-red-500">{sar(summary.gap)}</p><p className="text-[10px] text-gray-400">الفرق</p></div>
        </div>
        <p className="text-[11px] text-gray-500 bg-gray-50 rounded-xl px-3 py-2.5">
          كل 100 ريال مبيعات، يبقى لك تقريباً <span className="font-bold text-gray-900">{summary.netPer100} ريال</span>. ({summary.orderCount} طلب{summary.dateRange ? ` · ${summary.dateRange.from} → ${summary.dateRange.to}` : ''})
        </p>
      </Card>
      <Card>
        <SectionTitle icon={TrendingDown}>وين راحت فلوسي؟</SectionTitle>
        <BreakdownChart
          data={[
            { name: 'العمولة', value: summary.totalCommission },
            { name: 'تكاليف المنصة', value: summary.totalPlatformCost },
            { name: 'رسوم التوصيل', value: summary.totalDeliveryFee },
            { name: 'تكلفة العروض الترويجية', value: summary.totalPromoCost },
            { name: 'رسوم/تعديلات أخرى', value: summary.otherGap },
          ]}
        />
        <div className="mt-3">
          <WaterfallRow label="مبيعاتك" value={summary.totalSales} isFinal />
          <WaterfallRow label="العمولة" value={summary.totalCommission} />
          {summary.totalPlatformCost > 0 && <WaterfallRow label="تكاليف المنصة" value={summary.totalPlatformCost} />}
          {summary.totalDeliveryFee > 0 && <WaterfallRow label="رسوم التوصيل" value={summary.totalDeliveryFee} />}
          {summary.totalPromoCost > 0 && <WaterfallRow label="تكلفة العروض الترويجية" value={summary.totalPromoCost} />}
          {summary.otherGap > 1 && <WaterfallRow label="رسوم/تعديلات أخرى" value={summary.otherGap} />}
          <div className="pt-2.5"><WaterfallRow label="الصافي المحول لك" value={summary.totalRevenue} isFinal /></div>
        </div>
      </Card>
      <AlertsRecs {...insights} />
      {lowRated.length > 0 && (
        <Card>
          <SectionTitle icon={Star}>الطلبات المقيّمة بأقل من 4 نجوم</SectionTitle>
          <ul className="space-y-2">
            {lowRated.slice(0, 10).map((r) => (
              <li key={r.orderId} className="text-[11px] text-gray-700 flex items-start gap-2 border-b border-gray-50 pb-2 last:border-0">
                <span className="shrink-0 font-bold text-amber-600">{r.score}★</span>
                <span className="flex-1">{r.content || '(بدون تعليق)'}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}
      <CollapsibleTable
        title="تفاصيل كل طلب"
        count={summary.orderCount}
        headers={['الوقت', 'الأصناف', 'المبيعات', 'الإيرادات', 'التقييم', 'الحالة']}
        rows={summary.orders.map((o) => [o.orderTime, o.items, sar(o.sales), sar(o.revenue), o.reviewScore ?? '—', o.status])}
      />
    </div>
  );
}

function RatingsView({ summary }: { summary: Extract<KeetaParsedReport, { type: 'ratings' }>['summary'] }) {
  const maxCount = Math.max(1, ...Object.values(summary.distribution));
  return (
    <div className="space-y-5">
      <Card>
        <SectionTitle icon={Star}>ملخص التقييمات</SectionTitle>
        <div className="flex items-center gap-4 mb-4">
          <p className="text-3xl font-black text-gray-900">{summary.avgRating.toFixed(1)}</p>
          <div className="flex-1">
            {[5, 4, 3, 2, 1].map((n) => (
              <div key={n} className="flex items-center gap-2 mb-1">
                <span className="text-[10px] text-gray-400 w-3">{n}</span>
                <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-amber-400 rounded-full" style={{ width: `${(summary.distribution[n as 1] / maxCount) * 100}%` }} />
                </div>
                <span className="text-[10px] text-gray-400 w-6 text-left">{summary.distribution[n as 1]}</span>
              </div>
            ))}
          </div>
        </div>
        <p className="text-[11px] text-gray-500 bg-gray-50 rounded-xl px-3 py-2.5">
          من أصل {summary.totalReviews} تقييم، {summary.unrepliedCount} بدون رد منك.
        </p>
      </Card>
      {summary.topTags.length > 0 && (
        <Card>
          <SectionTitle icon={Megaphone}>أكثر الملاحظات تكراراً</SectionTitle>
          <div className="flex flex-wrap gap-2">
            {summary.topTags.map((t) => (
              <span key={t.name} className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-gray-50 text-gray-600">{t.name} · {t.count}</span>
            ))}
          </div>
        </Card>
      )}
      {summary.worstReviews.length > 0 && (
        <Card>
          <SectionTitle icon={AlertTriangle}>أضعف التقييمات</SectionTitle>
          <ul className="space-y-2.5">
            {summary.worstReviews.map((r, i) => (
              <li key={i} className="text-[11px] border-b border-gray-50 pb-2.5 last:border-0">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-gray-700">{r.customer || 'عميل'}</span>
                  <span className="font-bold text-red-500">{r.rating}★</span>
                </div>
                {r.content && <p className="text-gray-500 leading-relaxed">{r.content}</p>}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

function CampaignView({ summary }: { summary: Extract<KeetaParsedReport, { type: 'campaign_data' }>['summary'] }) {
  return (
    <div className="space-y-5">
      <Card>
        <SectionTitle icon={Megaphone}>ملخص الحملات</SectionTitle>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div><p className="text-lg font-black text-red-500">{sar(summary.totalCost)}</p><p className="text-[10px] text-gray-400">إجمالي التكلفة</p></div>
          <div><p className="text-lg font-black text-gray-900">{summary.totalOrders}</p><p className="text-[10px] text-gray-400">طلبات الحملات</p></div>
          <div><p className="text-lg font-black text-emerald-600">{sar(summary.totalSales)}</p><p className="text-[10px] text-gray-400">مبيعات الحملات</p></div>
        </div>
      </Card>
      <Card>
        <SectionTitle icon={ListOrdered}>التكلفة حسب الحملة</SectionTitle>
        <BreakdownChart data={summary.byCampaign.map((c) => ({ name: c.name, value: c.cost }))} />
      </Card>
      <CollapsibleTable
        title="تفاصيل كل حملة"
        count={summary.byCampaign.length}
        headers={['الحملة', 'التكلفة', 'الطلبات', 'المبيعات']}
        rows={summary.byCampaign.map((c) => [c.name, sar(c.cost), c.orders, sar(c.sales)])}
      />
    </div>
  );
}

function RestaurantDataView({ summary }: { summary: Extract<KeetaParsedReport, { type: 'restaurant_data' }>['summary'] }) {
  return (
    <div className="space-y-5">
      <Card>
        <SectionTitle icon={Store}>ملخص الفترة</SectionTitle>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-3">
          <div><p className="text-lg font-black text-gray-900">{sar(summary.totalSales)}</p><p className="text-[10px] text-gray-400">إجمالي المبيعات</p></div>
          <div><p className="text-lg font-black text-emerald-600">{sar(summary.totalRevenue)}</p><p className="text-[10px] text-gray-400">وصلك فعلياً</p></div>
          <div><p className="text-lg font-black text-red-500">{sar(summary.gap)}</p><p className="text-[10px] text-gray-400">الفرق</p></div>
        </div>
        <p className="text-[11px] text-gray-500 bg-gray-50 rounded-xl px-3 py-2.5">
          كل 100 ريال مبيعات يبقى لك تقريباً <span className="font-bold text-gray-900">{summary.netPer100} ريال</span> · {summary.totalOrders} طلب، منها {summary.totalCancelled} ملغي{summary.avgPrepTime ? ` · متوسط وقت التحضير ${Math.round(summary.avgPrepTime)} دقيقة` : ''}
          {summary.dateRange ? ` · ${summary.dateRange.from} → ${summary.dateRange.to}` : ''}
        </p>
      </Card>
      {summary.dailySeries.length > 1 && (
        <Card>
          <SectionTitle icon={TrendingUp}>الاتجاه اليومي</SectionTitle>
          <TrendChart data={summary.dailySeries} />
        </Card>
      )}
      {summary.dailySeries.length > 0 && (
        <CollapsibleTable
          title="التفصيل اليومي"
          count={summary.dailySeries.length}
          headers={['اليوم', 'المبيعات', 'الإيرادات', 'الطلبات']}
          rows={summary.dailySeries.map((d) => [d.date, sar(d.sales), sar(d.revenue), d.orders])}
        />
      )}
    </div>
  );
}

function ItemDataView({ summary }: { summary: Extract<KeetaParsedReport, { type: 'item_data' }>['summary'] }) {
  return (
    <div className="space-y-5">
      <Card>
        <SectionTitle icon={Package}>الأكثر مبيعاً</SectionTitle>
        <BreakdownChart color="#10b981" data={summary.topSellers.map((i) => ({ name: i.name, value: i.salesVolume }))} />
      </Card>
      {summary.viewedNotBought.length > 0 && (
        <Card className="bg-amber-50/60 border-amber-100">
          <SectionTitle icon={AlertTriangle}>يشوفها الزبون وما يطلبها</SectionTitle>
          <p className="text-[11px] text-gray-600 mb-3">أصناف بمشاهدات عالية بدون أي عملية بيع — سعرها أو صورتها أو وصفها قد يكون السبب.</p>
          <BreakdownChart color="#f59e0b" data={summary.viewedNotBought.map((i) => ({ name: i.name, value: i.impressions }))} />
        </Card>
      )}
    </div>
  );
}

function ItemAnalysisView({ summary }: { summary: Extract<KeetaParsedReport, { type: 'item_analysis' }>['summary'] }) {
  const diverging = [...summary.topGrowing, ...[...summary.topDeclining].reverse()].map((i) => ({ name: i.name, value: Math.round(i.changePercent) }));
  return (
    <div className="space-y-5">
      {diverging.length > 0 && (
        <Card>
          <SectionTitle icon={TrendingUp}>التغيّر في المبيعات</SectionTitle>
          <DivergingChart data={diverging} />
        </Card>
      )}
      <div className="grid sm:grid-cols-2 gap-5">
        <Card>
          <SectionTitle icon={TrendingUp}>الأصناف الصاعدة</SectionTitle>
          <ul className="space-y-2">
            {summary.topGrowing.map((i) => (
              <li key={i.name} className="text-[11px] flex items-center justify-between border-b border-gray-50 pb-2 last:border-0">
                <span className="text-gray-700">{i.name}</span>
                <span className="font-bold text-emerald-600">+{Math.round(i.changePercent)}%</span>
              </li>
            ))}
            {summary.topGrowing.length === 0 && <p className="text-[11px] text-gray-400">لا يوجد</p>}
          </ul>
        </Card>
        <Card>
          <SectionTitle icon={TrendingDownIcon}>الأصناف المتراجعة</SectionTitle>
          <ul className="space-y-2">
            {summary.topDeclining.map((i) => (
              <li key={i.name} className="text-[11px] flex items-center justify-between border-b border-gray-50 pb-2 last:border-0">
                <span className="text-gray-700">{i.name}</span>
                <span className="font-bold text-red-500">{Math.round(i.changePercent)}%</span>
              </li>
            ))}
            {summary.topDeclining.length === 0 && <p className="text-[11px] text-gray-400">لا يوجد</p>}
          </ul>
        </Card>
      </div>
    </div>
  );
}

function InvoiceSummaryView({ summary }: { summary: Extract<KeetaParsedReport, { type: 'invoice_summary' }>['summary'] }) {
  return (
    <div className="space-y-5">
      <Card>
        <SectionTitle icon={FileStack}>ملخص الفواتير</SectionTitle>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div><p className="text-lg font-black text-gray-900">{sar(summary.totalGrossSales)}</p><p className="text-[10px] text-gray-400">إجمالي المبيعات</p></div>
          <div><p className="text-lg font-black text-emerald-600">{sar(summary.totalNetPayable)}</p><p className="text-[10px] text-gray-400">صافي المستحق</p></div>
          <div><p className="text-lg font-black text-red-500">{sar(summary.totalCommission)}</p><p className="text-[10px] text-gray-400">إجمالي العمولة</p></div>
        </div>
      </Card>
      {summary.periods.length > 1 && (
        <Card>
          <SectionTitle icon={TrendingUp}>حسب الفترة</SectionTitle>
          <GroupedBarChart
            data={summary.periods.map((p) => ({ period: p.period, grossSales: p.grossSales, netPayable: p.netPayable }))}
            xKey="period"
            aKey="grossSales"
            bKey="netPayable"
            aLabel="إجمالي المبيعات"
            bLabel="الصافي المستحق"
          />
        </Card>
      )}
      <CollapsibleTable
        title="تفاصيل كل فترة"
        count={summary.periods.length}
        headers={['الفترة', 'إجمالي المبيعات', 'العمولة', 'رسوم بنكية', 'خصومات تتحملها', 'الصافي المستحق']}
        rows={summary.periods.map((p) => [p.period, sar(p.grossSales), sar(p.totalCommission), sar(p.totalBankFees), sar(p.merchantBorneDiscounts), sar(p.netPayable)])}
      />
    </div>
  );
}

function ReportView({ parsed }: { parsed: KeetaParsedReport }) {
  switch (parsed.type) {
    case 'order_log': return <OrderLogView summary={parsed.summary} />;
    case 'order_data': return <OrderDataView summary={parsed.summary} />;
    case 'ratings': return <RatingsView summary={parsed.summary} />;
    case 'campaign_data': return <CampaignView summary={parsed.summary} />;
    case 'restaurant_data': return <RestaurantDataView summary={parsed.summary} />;
    case 'item_data': return <ItemDataView summary={parsed.summary} />;
    case 'item_analysis': return <ItemAnalysisView summary={parsed.summary} />;
    case 'invoice_summary': return <InvoiceSummaryView summary={parsed.summary} />;
  }
}

// ---- history panel ----

function HistoryPanel({ history, onOpen, onOpenStatement }: { history: KeetaReportRow[]; onOpen: (row: KeetaReportRow) => void; onOpenStatement: (row: KeetaReportRow) => void }) {
  if (history.length === 0) {
    return <p className="text-xs text-gray-400 text-center py-6">ما فيه تقارير محفوظة بعد.</p>;
  }
  return (
    <div className="divide-y divide-gray-50">
      {history.map((row) => (
        <button
          key={row.id}
          onClick={() => (row.report_type === 'account_statement' ? onOpenStatement(row) : onOpen(row))}
          className="w-full flex items-center justify-between px-4 py-3 text-right hover:bg-gray-50/50"
        >
          <div className="min-w-0">
            <p className="text-xs font-bold text-gray-800 truncate">
              {REPORT_TYPE_LABELS[row.report_type as keyof typeof REPORT_TYPE_LABELS] || 'كشف حساب'}
            </p>
            <p className="text-[10px] text-gray-400 truncate">{row.file_name} · {fmtDate(row.created_at)}</p>
          </div>
          <ChevronDown className="h-3.5 w-3.5 text-gray-300 -rotate-90 shrink-0" />
        </button>
      ))}
    </div>
  );
}

export default function KeetaReportsReaderPage() {
  const { toast } = useToast();
  const { user } = useUser();
  const restaurantId = user?.restaurantId;
  const profileId = user?.id;

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [current, setCurrent] = useState<KeetaParsedReport | null>(null);
  const [genericReport, setGenericReport] = useState<ParsedDeliveryReport | null>(null);
  const [statementSaved, setStatementSaved] = useState<KeetaReportRow | null>(null);
  const [history, setHistory] = useState<KeetaReportRow[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  const hasReport = !!current || !!genericReport || !!statementSaved;

  useEffect(() => {
    if (!restaurantId) return;
    listKeetaReports(restaurantId).then(setHistory).catch(() => {});
  }, [restaurantId]);

  const handleFile = async (file: File) => {
    setIsParsing(true);
    setFileName(file.name);
    try {
      if (file.name.toLowerCase().endsWith('.pdf')) {
        if (restaurantId && profileId) {
          const row = await saveAccountStatementFile({ restaurantId, profileId, file });
          setStatementSaved(row);
          setCurrent(null);
          setGenericReport(null);
          setHistory((h) => [row, ...h]);
        } else {
          toast({ variant: 'destructive', title: 'تعذّر الحفظ', description: 'ما قدرنا نحدد المطعم المرتبط بحسابك' });
        }
        return;
      }

      const parsed = await detectAndParseKeetaReport(file);
      if (parsed) {
        setCurrent(parsed);
        setGenericReport(null);
        setStatementSaved(null);
        if (restaurantId && profileId) {
          try {
            const row = await saveKeetaReport({ restaurantId, profileId, file, parsed });
            setHistory((h) => [row, ...h]);
          } catch (e: any) {
            toast({ variant: 'destructive', title: 'ما قدرنا نحفظ التقرير', description: e.message });
          }
        }
        return;
      }

      const generic = await parseDeliveryReport(file);
      if (generic.rowCount === 0) {
        toast({ variant: 'destructive', title: 'ما قدرنا نقرأ صفوف من الملف', description: 'تأكد إن الملف تصدير حقيقي من كيتا' });
      } else {
        setGenericReport(generic);
        setCurrent(null);
        setStatementSaved(null);
      }
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'تعذّرت قراءة الملف', description: error.message });
    } finally {
      setIsParsing(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) handleFile(file);
  };

  const reset = () => {
    setCurrent(null);
    setGenericReport(null);
    setStatementSaved(null);
    setFileName(null);
  };

  const openHistoryRow = (row: KeetaReportRow) => {
    setCurrent({ type: row.report_type as any, summary: row.summary } as KeetaParsedReport);
    setGenericReport(null);
    setStatementSaved(null);
    setFileName(row.file_name);
    setShowHistory(false);
  };

  const openStatementRow = (row: KeetaReportRow) => {
    setStatementSaved(row);
    setCurrent(null);
    setGenericReport(null);
    setFileName(row.file_name);
    setShowHistory(false);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="قارئ تقارير كيتا"
        description="ارفع أي تقرير تصدّره من لوحة تحكم كيتا للتجار، ونطلع لك القصة: وش صار بفلوسك ووش تسوي حياله. التقارير تنحفظ عندك وترجع لها بأي وقت."
      />

      <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv,.pdf" onChange={handleFileChange} className="hidden" />

      <div className="flex items-center justify-between gap-3">
        {!hasReport ? (
          <div
            onClick={() => !isParsing && fileInputRef.current?.click()}
            className="flex-1 border-2 border-dashed border-gray-200 rounded-2xl p-10 text-center cursor-pointer hover:border-primary/40 hover:bg-gray-50 transition-colors"
          >
            {isParsing ? (
              <>
                <Loader2 className="h-10 w-10 text-primary animate-spin mx-auto mb-3" />
                <p className="text-sm font-bold text-gray-700">جاري قراءة {fileName}...</p>
              </>
            ) : (
              <>
                <UploadCloud className="h-10 w-10 text-gray-300 mx-auto mb-3" />
                <p className="text-sm font-bold text-gray-700">ارفع ملف تقرير من كيتا</p>
                <p className="text-xs text-gray-400 mt-1">أي تقرير Excel أو CSV، أو كشف حساب PDF</p>
              </>
            )}
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-between bg-white border border-gray-100 rounded-2xl px-4 py-3">
            <div className="flex items-center gap-2 min-w-0">
              <FileSpreadsheet className="h-4 w-4 text-emerald-500 shrink-0" />
              <span className="text-xs font-bold text-gray-700 truncate">{fileName}</span>
            </div>
            <button onClick={reset} className="h-8 px-3 rounded-lg text-xs font-bold text-gray-500 hover:bg-gray-50 flex items-center gap-1.5 shrink-0">
              <RotateCw className="h-3.5 w-3.5" /> ملف جديد
            </button>
          </div>
        )}
        <button
          onClick={() => setShowHistory((v) => !v)}
          className="h-[42px] px-4 rounded-2xl border border-gray-100 bg-white text-xs font-bold text-gray-600 hover:bg-gray-50 flex items-center gap-1.5 shrink-0"
        >
          <History className="h-3.5 w-3.5" /> السجل {history.length > 0 && `(${history.length})`}
        </button>
      </div>

      {showHistory && (
        <Card className="p-0 overflow-hidden">
          <HistoryPanel history={history} onOpen={openHistoryRow} onOpenStatement={openStatementRow} />
        </Card>
      )}

      {current && <ReportView parsed={current} />}

      {statementSaved && (
        <Card className="text-center py-8">
          <FileText className="h-10 w-10 text-gray-300 mx-auto mb-3" />
          <p className="text-sm font-bold text-gray-800 mb-1">تم حفظ كشف الحساب</p>
          <p className="text-xs text-gray-400 mb-4">هذا النوع من الملفات (PDF) نحفظه لك كما هو بدون تحليل تلقائي للأرقام.</p>
          {statementSaved.storage_path && (
            <a
              href={getReportFileUrl(statementSaved.storage_path)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-primary hover:underline"
            >
              فتح الملف <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </Card>
      )}

      {genericReport && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="bg-white border border-gray-100 rounded-2xl p-4">
              <ListOrdered className="h-4 w-4 text-gray-300 mb-2" />
              <p className="text-lg font-black text-gray-900">{genericReport.rowCount}</p>
              <p className="text-[11px] text-gray-400">عدد الصفوف</p>
            </div>
            {genericReport.totalAmount !== null && (
              <div className="bg-white border border-gray-100 rounded-2xl p-4">
                <Receipt className="h-4 w-4 text-emerald-400 mb-2" />
                <p className="text-lg font-black text-gray-900">{genericReport.totalAmount.toLocaleString('ar-SA', { maximumFractionDigits: 2 })}</p>
                <p className="text-[11px] text-gray-400">إجمالي "{genericReport.amountColumn}"</p>
              </div>
            )}
            {genericReport.dateRange && (
              <div className="bg-white border border-gray-100 rounded-2xl p-4">
                <Calendar className="h-4 w-4 text-gray-300 mb-2" />
                <p className="text-xs font-black text-gray-900">{genericReport.dateRange.from} → {genericReport.dateRange.to}</p>
                <p className="text-[11px] text-gray-400">الفترة</p>
              </div>
            )}
          </div>

          {genericReport.topItems.length > 0 && (
            <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-50">
                <h3 className="text-sm font-bold text-gray-900">الأكثر تكراراً في "{genericReport.itemColumn}"</h3>
              </div>
              <div className="divide-y divide-gray-50">
                {genericReport.topItems.map((item) => (
                  <div key={item.name} className="flex items-center justify-between px-4 py-2.5 text-xs">
                    <span className="font-medium text-gray-700 truncate">{item.name}</span>
                    <span className="text-gray-400 shrink-0 mr-3">{item.count} مرة{item.total > 0 ? ` · ${item.total.toLocaleString('ar-SA', { maximumFractionDigits: 2 })}` : ''}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-50">
              <h3 className="text-sm font-bold text-gray-900">بيانات الملف الكاملة</h3>
            </div>
            <div className="overflow-x-auto max-h-[480px] overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-gray-50">
                  <tr>
                    {genericReport.headers.map((h) => (
                      <th key={h} className="px-3 py-2 text-right font-bold text-gray-500 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {genericReport.rows.map((row, i) => (
                    <tr key={i} className="hover:bg-gray-50/50">
                      {genericReport.headers.map((h) => (
                        <td key={h} className="px-3 py-2 text-gray-700 whitespace-nowrap">{String(row[h] ?? '')}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
