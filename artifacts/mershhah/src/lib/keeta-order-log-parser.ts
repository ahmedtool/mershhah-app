// Parser for Keeta's "سجل الطلبات" (Order Log) export - the first of
// several Keeta report templates this tool will eventually support. Column
// names are matched exactly against a real sample export rather than
// guessed at, so this only activates when that exact report is uploaded;
// any other file falls back to the generic table+summary view.

import { readTabularFile } from './xlsx-robust-reader';

export type KeetaOrder = {
  orderId: string;
  status: string;
  isRefunded: boolean;
  refundReason: string | null;
  refundResponsibility: string | null;
  orderTime: string;
  items: string[];
  originalPrice: number;
  profit: number;
  customerPayment: number;
  commission: number;
  paymentFee: number;
  minOrderDiff: number;
  keetaPromo: number;
  merchantPromo: number;
  campaignTypes: string[];
};

export type KeetaOrderLogSummary = {
  orders: KeetaOrder[];
  orderCount: number;
  dateRange: { from: string; to: string } | null;
  totalOriginalPrice: number;
  totalProfit: number;
  gap: number;
  totalCommission: number;
  totalPaymentFee: number;
  totalMerchantPromo: number;
  totalMinOrderDiff: number;
  totalKeetaPromo: number;
  otherGap: number;
  netPer100: number;
  verdict: 'good' | 'review' | 'costly';
  refundedOrders: KeetaOrder[];
  refundedCost: number;
  topCampaignType: { name: string; count: number } | null;
};

const REQUIRED_COLUMNS = ['الأرباح', 'العمولة الأساسية', 'العرض الترويجي ممول من التاجر', 'السعر الأصلي'];

function toNumber(value: unknown): number {
  const n = parseFloat(String(value ?? '').replace(/[^0-9.\-]/g, ''));
  return isNaN(n) ? 0 : n;
}

function splitList(value: unknown): string[] {
  return String(value ?? '')
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean);
}

export function isKeetaOrderLog(headers: string[]): boolean {
  return REQUIRED_COLUMNS.every((c) => headers.includes(c));
}

export async function parseKeetaOrderLog(file: File): Promise<KeetaOrderLogSummary | null> {
  const { headers: rawHeaders, rows: dataOnlyRows } = await readTabularFile(file);
  if (rawHeaders.length === 0) return null;
  const headers = rawHeaders.map((h) => String(h ?? '').trim());
  return parseKeetaOrderLogRows(headers, dataOnlyRows);
}

export function parseKeetaOrderLogRows(headers: string[], dataOnlyRows: any[][]): KeetaOrderLogSummary | null {
  if (!isKeetaOrderLog(headers)) return null;
  const allRows: any[][] = [headers, ...dataOnlyRows];

  const col = (name: string) => headers.indexOf(name);
  const idx = {
    orderId: col('رقم الطلب'),
    status: col('حالة الطلب'),
    refundType: col('نوع الاسترداد'),
    orderTime: col('وقت الطلب'),
    items: col('الأصناف'),
    profit: col('الأرباح'),
    customerPayment: col('دفع العميل'),
    refundReason: col('سبب إلغاء الطلب'),
    responsibility: col('المسؤولية'),
    originalPrice: col('السعر الأصلي'),
    campaignType: col('نوع الحملة'),
    commission: col('العمولة الأساسية'),
    paymentFee: col('رسوم الدفع الإلكتروني'),
    minOrderDiff: col('الفارق عن الحد الأدنى للطلب'),
    keetaPromo: col('عرض ترويجي ممول من Keeta'),
    merchantPromo: col('العرض الترويجي ممول من التاجر'),
  };

  const dataRows = allRows.slice(1).filter((r) => r.some((c) => String(c ?? '').trim() !== ''));

  const orders: KeetaOrder[] = dataRows.map((r) => ({
    orderId: String(r[idx.orderId] ?? ''),
    status: String(r[idx.status] ?? ''),
    isRefunded: !!String(r[idx.refundType] ?? '').trim(),
    refundReason: String(r[idx.refundReason] ?? '').trim() || null,
    refundResponsibility: String(r[idx.responsibility] ?? '').trim() || null,
    orderTime: String(r[idx.orderTime] ?? ''),
    items: splitList(r[idx.items]),
    originalPrice: toNumber(r[idx.originalPrice]),
    profit: toNumber(r[idx.profit]),
    customerPayment: toNumber(r[idx.customerPayment]),
    commission: Math.abs(toNumber(r[idx.commission])),
    paymentFee: Math.abs(toNumber(r[idx.paymentFee])),
    minOrderDiff: Math.abs(toNumber(r[idx.minOrderDiff])),
    keetaPromo: Math.abs(toNumber(r[idx.keetaPromo])),
    merchantPromo: Math.abs(toNumber(r[idx.merchantPromo])),
    campaignTypes: splitList(r[idx.campaignType]),
  }));

  if (orders.length === 0) return null;

  const sum = (fn: (o: KeetaOrder) => number) => orders.reduce((s, o) => s + fn(o), 0);

  const totalOriginalPrice = sum((o) => o.originalPrice);
  const totalProfit = sum((o) => o.profit);
  const gap = totalOriginalPrice - totalProfit;
  const totalCommission = sum((o) => o.commission);
  const totalPaymentFee = sum((o) => o.paymentFee);
  const totalMerchantPromo = sum((o) => o.merchantPromo);
  const totalMinOrderDiff = sum((o) => o.minOrderDiff);
  const totalKeetaPromo = sum((o) => o.keetaPromo);
  const otherGap = Math.max(0, gap - (totalCommission + totalPaymentFee + totalMerchantPromo + totalMinOrderDiff));

  const netPer100 = totalOriginalPrice > 0 ? Math.round((totalProfit / totalOriginalPrice) * 100) : 0;
  const verdict: KeetaOrderLogSummary['verdict'] = netPer100 >= 75 ? 'good' : netPer100 >= 60 ? 'review' : 'costly';

  const refundedOrders = orders.filter((o) => o.isRefunded);
  const refundedCost = refundedOrders.reduce((s, o) => s + (o.originalPrice - o.profit), 0);

  const campaignCounts = new Map<string, number>();
  orders.forEach((o) => o.campaignTypes.forEach((c) => campaignCounts.set(c, (campaignCounts.get(c) || 0) + 1)));
  const topCampaignEntry = Array.from(campaignCounts.entries()).sort((a, b) => b[1] - a[1])[0];
  const topCampaignType = topCampaignEntry ? { name: topCampaignEntry[0], count: topCampaignEntry[1] } : null;

  const times = orders.map((o) => o.orderTime).filter(Boolean);
  const dateRange = times.length ? { from: times[times.length - 1], to: times[0] } : null;

  return {
    orders,
    orderCount: orders.length,
    dateRange,
    totalOriginalPrice,
    totalProfit,
    gap,
    totalCommission,
    totalPaymentFee,
    totalMerchantPromo,
    totalMinOrderDiff,
    totalKeetaPromo,
    otherGap,
    netPer100,
    verdict,
    refundedOrders,
    refundedCost,
    topCampaignType,
  };
}

const sar = (n: number) => `${n.toLocaleString('ar-SA', { maximumFractionDigits: 0 })} ر.س`;

// Deterministic, numbers-only alerts and recommendations - no AI call, so
// this never depends on an external provider's uptime. Every line is
// computed straight from the real parsed columns, not generic advice.
export function generateKeetaInsights(s: KeetaOrderLogSummary): { alerts: string[]; recommendations: string[] } {
  const alerts: string[] = [];
  const recs: { text: string; weight: number }[] = [];

  const costDrivers = [
    { name: 'العمولة', value: s.totalCommission },
    { name: 'الخصومات اللي تتحملها', value: s.totalMerchantPromo },
    { name: 'رسوم الدفع الإلكتروني', value: s.totalPaymentFee },
  ].sort((a, b) => b.value - a.value);
  const biggest = costDrivers[0];

  if (s.refundedOrders.length > 0) {
    alerts.push(`عندك ${s.refundedOrders.length} طلب فيه استرداد، كلفك تقريباً ${sar(s.refundedCost)} من صافيك.`);
    const merchantFault = s.refundedOrders.filter((o) => o.refundResponsibility === 'التاجر');
    if (merchantFault.length > 0) {
      recs.push({
        text: `راجع دقة تحضير الطلبات — ${merchantFault.length} من طلبات الاسترداد كانت مسؤوليتك (سبب متكرر: ${merchantFault[0].refundReason || 'غير محدد'}), وكلفتك تقريباً ${sar(s.refundedCost)}.`,
        weight: 90,
      });
    }
  }

  if (s.totalMerchantPromo > s.totalCommission) {
    alerts.push(`الخصومات اللي تتحملها (${sar(s.totalMerchantPromo)}) أكبر من عمولة كيتا نفسها (${sar(s.totalCommission)}).`);
  }

  if (s.netPer100 < 75) {
    alerts.push(`كل 100 ريال مبيعات عن طريق كيتا، يبقى لك تقريباً ${s.netPer100} ريال بس — أقل من المعدل الجيد (75+).`);
  }

  if (s.topCampaignType && s.orderCount > 0) {
    const pct = Math.round((s.topCampaignType.count / s.orderCount) * 100);
    if (pct >= 50) {
      alerts.push(`${pct}% من طلباتك فيها حملة "${s.topCampaignType.name}" — تأكد إنها فعلاً تزيد مبيعاتك مو بس تقلّل هامشك.`);
    }
  }

  if (biggest.value > 0) {
    recs.push({
      text: `أكبر شي أكل من دخلك هذا التقرير: ${biggest.name}، بمبلغ ${sar(biggest.value)}. راجعها أول شي.`,
      weight: 80,
    });
  }

  if (s.totalMerchantPromo > 0 && s.topCampaignType) {
    recs.push({
      text: `حملة "${s.topCampaignType.name}" كلفتك ${sar(s.totalMerchantPromo)} من الخصومات هذا التقرير — قارنها بالمبيعات الإضافية اللي جابتها لك، وشوف إذا فعلاً مجدية.`,
      weight: 70,
    });
  }

  recs.push({
    text: `التطبيق يبقي لك تقريباً ${s.netPer100} ريال لكل 100 ريال مبيعات. لو هامش ربحك على الأصناف نفسها أقل من كذا، فكر ترفع أسعار عناصر التوصيل بمقدار بسيط (2-3 ريال) يعوّض جزء من العمولة.`,
    weight: 10,
  });

  const recommendations = recs
    .sort((a, b) => b.weight - a.weight)
    .map((r) => r.text)
    .filter((text, i, arr) => arr.indexOf(text) === i)
    .slice(0, 3);

  return { alerts, recommendations };
}
