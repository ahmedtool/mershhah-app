export type KeetaReportType =
  | 'order_log'
  | 'order_data'
  | 'ratings'
  | 'campaign_data'
  | 'restaurant_data'
  | 'item_data'
  | 'item_analysis'
  | 'invoice_summary';

export const REPORT_TYPE_LABELS: Record<KeetaReportType, string> = {
  order_log: 'سجل الطلبات',
  order_data: 'تقرير بيانات الطلب',
  ratings: 'التقييمات',
  campaign_data: 'تقرير بيانات الحملة',
  restaurant_data: 'تقرير بيانات المطعم',
  item_data: 'تقرير بيانات الصنف',
  item_analysis: 'تحليل الصنف',
  invoice_summary: 'موجز الفاتورة',
};

export function toNumber(value: unknown): number {
  const n = parseFloat(String(value ?? '').replace(/[^0-9.\-]/g, ''));
  return isNaN(n) ? 0 : n;
}

export function splitList(value: unknown, sep = ';'): string[] {
  return String(value ?? '')
    .split(sep)
    .map((s) => s.trim())
    .filter(Boolean);
}

export const sar = (n: number) => `${n.toLocaleString('ar-SA', { maximumFractionDigits: 0 })} ر.س`;
