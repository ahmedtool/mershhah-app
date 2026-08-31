import { toNumber } from './types';

export type KeetaRestaurantDaySummary = {
  totalRevenue: number;
  totalSales: number;
  gap: number;
  totalCommission: number;
  totalPlatformCost: number;
  totalDeliveryFee: number;
  totalOrders: number;
  totalCancelled: number;
  avgPrepTime: number | null;
  netPer100: number;
  dateRange: { from: string; to: string } | null;
  dailySeries: { date: string; sales: number; revenue: number; orders: number }[];
};

const REQUIRED_COLUMNS = ['الإيرادات', 'المبيعات', 'تكاليف المنصة', 'العمولة', 'الطلبات الملغاة'];

export function isKeetaRestaurantData(headers: string[]): boolean {
  return REQUIRED_COLUMNS.every((c) => headers.includes(c));
}

function formatYyyymmdd(raw: unknown): string {
  const s = String(raw ?? '').replace(/[^0-9]/g, '');
  if (s.length !== 8) return String(raw ?? '');
  return `${s.slice(6, 8)}/${s.slice(4, 6)}/${s.slice(0, 4)}`;
}

export function parseKeetaRestaurantData(headers: string[], dataRows: any[][]): KeetaRestaurantDaySummary {
  const col = (name: string) => headers.indexOf(name);
  const idx = {
    day: col('اليوم'),
    revenue: col('الإيرادات'),
    sales: col('المبيعات'),
    commission: col('العمولة'),
    platformCost: col('تكاليف المنصة'),
    deliveryFee: col('رسوم التوصيل'),
    totalOrders: col('إجمالي الطلبات'),
    cancelled: col('الطلبات الملغاة'),
    prepTime: col('مدة تحضير الطلب'),
  };

  const rows = dataRows.filter((r) => r.some((c) => String(c ?? '').trim() !== ''));

  const totalRevenue = rows.reduce((s, r) => s + toNumber(r[idx.revenue]), 0);
  const totalSales = rows.reduce((s, r) => s + toNumber(r[idx.sales]), 0);
  const totalCommission = rows.reduce((s, r) => s + Math.abs(toNumber(r[idx.commission])), 0);
  const totalPlatformCost = rows.reduce((s, r) => s + Math.abs(toNumber(r[idx.platformCost])), 0);
  const totalDeliveryFee = rows.reduce((s, r) => s + Math.abs(toNumber(r[idx.deliveryFee])), 0);
  const totalOrders = rows.reduce((s, r) => s + toNumber(r[idx.totalOrders]), 0);
  const totalCancelled = rows.reduce((s, r) => s + toNumber(r[idx.cancelled]), 0);

  const prepTimes = rows.map((r) => toNumber(r[idx.prepTime])).filter((n) => n > 0);
  const avgPrepTime = prepTimes.length ? prepTimes.reduce((s, n) => s + n, 0) / prepTimes.length : null;

  const gap = totalSales - totalRevenue;
  const netPer100 = totalSales > 0 ? Math.round((totalRevenue / totalSales) * 100) : 0;

  const days = rows.map((r) => formatYyyymmdd(r[idx.day])).filter(Boolean);
  const dateRange = days.length ? { from: days[days.length - 1], to: days[0] } : null;

  const dailySeries = rows
    .map((r) => ({
      date: formatYyyymmdd(r[idx.day]),
      sales: toNumber(r[idx.sales]),
      revenue: toNumber(r[idx.revenue]),
      orders: toNumber(r[idx.totalOrders]),
    }))
    .reverse();

  return {
    totalRevenue,
    totalSales,
    gap,
    totalCommission,
    totalPlatformCost,
    totalDeliveryFee,
    totalOrders,
    totalCancelled,
    avgPrepTime,
    netPer100,
    dateRange,
    dailySeries,
  };
}
