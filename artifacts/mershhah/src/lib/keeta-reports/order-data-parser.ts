import { toNumber, sar } from './types';

export type KeetaOrderDataOrder = {
  orderId: string;
  status: string;
  orderTime: string;
  items: string;
  revenue: number; // net to merchant
  sales: number; // gross item price
  commission: number;
  platformCost: number;
  deliveryFee: number;
  promoCost: number;
  reviewScore: number | null;
  reviewContent: string | null;
};

export type KeetaOrderDataSummary = {
  orders: KeetaOrderDataOrder[];
  orderCount: number;
  dateRange: { from: string; to: string } | null;
  totalSales: number;
  totalRevenue: number;
  gap: number;
  totalCommission: number;
  totalPlatformCost: number;
  totalDeliveryFee: number;
  totalPromoCost: number;
  otherGap: number;
  netPer100: number;
  verdict: 'good' | 'review' | 'costly';
  reviewedOrders: { orderId: string; score: number; content: string }[];
};

const REQUIRED_COLUMNS = ['معرّف الطلب', 'الإيرادات', 'المبيعات', 'تكاليف المنصة', 'العمولة', 'نقاط المراجعة'];

export function isKeetaOrderData(headers: string[]): boolean {
  return REQUIRED_COLUMNS.every((c) => headers.includes(c));
}

export function parseKeetaOrderData(headers: string[], dataRows: any[][]): KeetaOrderDataSummary {
  const col = (name: string) => headers.indexOf(name);
  const idx = {
    orderId: col('معرّف الطلب'),
    status: col('حالة الطلب'),
    orderTime: col('وقت الطلب'),
    items: col('تفاصيل الصنف'),
    revenue: col('الإيرادات'),
    sales: col('المبيعات'),
    platformCost: col('تكاليف المنصة'),
    commission: col('العمولة'),
    deliveryFee: col('رسوم التوصيل'),
    promoCost: col('تكلفة العرض الترويجي'),
    reviewScore: col('نقاط المراجعة'),
    reviewContent: col('محتوى المراجعة'),
  };

  const rows = dataRows.filter((r) => r.some((c) => String(c ?? '').trim() !== ''));

  const parseReview = (raw: unknown): number | null => {
    const s = String(raw ?? '').trim();
    if (!s || s === '-') return null;
    const n = toNumber(s);
    return n > 0 ? n : null;
  };

  const orders: KeetaOrderDataOrder[] = rows.map((r) => ({
    orderId: String(r[idx.orderId] ?? ''),
    status: String(r[idx.status] ?? ''),
    orderTime: String(r[idx.orderTime] ?? ''),
    items: String(r[idx.items] ?? ''),
    revenue: toNumber(r[idx.revenue]),
    sales: toNumber(r[idx.sales]),
    commission: Math.abs(toNumber(r[idx.commission])),
    platformCost: Math.abs(toNumber(r[idx.platformCost])),
    deliveryFee: Math.abs(toNumber(r[idx.deliveryFee])),
    promoCost: Math.abs(toNumber(r[idx.promoCost])),
    reviewScore: parseReview(r[idx.reviewScore]),
    reviewContent: (() => {
      const c = String(r[idx.reviewContent] ?? '').trim();
      return c && c !== '-' ? c : null;
    })(),
  }));

  const sum = (fn: (o: KeetaOrderDataOrder) => number) => orders.reduce((s, o) => s + fn(o), 0);

  const totalSales = sum((o) => o.sales);
  const totalRevenue = sum((o) => o.revenue);
  const gap = totalSales - totalRevenue;
  const totalCommission = sum((o) => o.commission);
  const totalPlatformCost = sum((o) => o.platformCost);
  const totalDeliveryFee = sum((o) => o.deliveryFee);
  const totalPromoCost = sum((o) => o.promoCost);
  const otherGap = Math.max(0, gap - (totalCommission + totalPlatformCost + totalPromoCost));

  const netPer100 = totalSales > 0 ? Math.round((totalRevenue / totalSales) * 100) : 0;
  const verdict: KeetaOrderDataSummary['verdict'] = netPer100 >= 75 ? 'good' : netPer100 >= 60 ? 'review' : 'costly';

  const times = orders.map((o) => o.orderTime).filter(Boolean);
  const dateRange = times.length ? { from: times[times.length - 1], to: times[0] } : null;

  const reviewedOrders = orders
    .filter((o) => o.reviewScore !== null)
    .map((o) => ({ orderId: o.orderId, score: o.reviewScore as number, content: o.reviewContent || '' }));

  return {
    orders,
    orderCount: orders.length,
    dateRange,
    totalSales,
    totalRevenue,
    gap,
    totalCommission,
    totalPlatformCost,
    totalDeliveryFee,
    totalPromoCost,
    otherGap,
    netPer100,
    verdict,
    reviewedOrders,
  };
}

export function generateOrderDataInsights(s: KeetaOrderDataSummary): { alerts: string[]; recommendations: string[] } {
  const alerts: string[] = [];
  const recs: { text: string; weight: number }[] = [];

  const drivers = [
    { name: 'العمولة', value: s.totalCommission },
    { name: 'تكاليف المنصة', value: s.totalPlatformCost },
    { name: 'رسوم التوصيل', value: s.totalDeliveryFee },
    { name: 'الخصومات الترويجية', value: s.totalPromoCost },
  ].sort((a, b) => b.value - a.value);
  const biggest = drivers[0];

  if (s.netPer100 < 75) {
    alerts.push(`كل 100 ريال مبيعات، يبقى لك تقريباً ${s.netPer100} ريال بس — أقل من المعدل الجيد (75+).`);
  }

  const lowRated = s.reviewedOrders.filter((r) => r.score <= 2);
  if (lowRated.length > 0) {
    alerts.push(`عندك ${lowRated.length} طلب بتقييم منخفض (2 نجوم أو أقل) مرتبط مباشرة بطلبات في هذا التقرير.`);
    recs.push({ text: `راجع الطلبات المقيّمة بأقل من 3 نجوم — أقرب سبب متكرر يفسر لك وين المشكلة بالضبط.`, weight: 85 });
  }

  if (biggest.value > 0) {
    recs.push({ text: `أكبر شي أكل من دخلك: ${biggest.name}، بمبلغ ${sar(biggest.value)}.`, weight: 70 });
  }

  recs.push({
    text: `التطبيق يبقي لك تقريباً ${s.netPer100} ريال لكل 100 ريال مبيعات — قارنها بهامش ربحك الفعلي على الأصناف.`,
    weight: 10,
  });

  const recommendations = recs
    .sort((a, b) => b.weight - a.weight)
    .map((r) => r.text)
    .slice(0, 3);

  return { alerts, recommendations };
}
