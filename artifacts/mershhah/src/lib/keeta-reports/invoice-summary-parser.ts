import { toNumber } from './types';

export type KeetaInvoicePeriod = {
  period: string;
  grossSales: number;
  totalCommission: number;
  totalBankFees: number;
  merchantBorneDiscounts: number;
  netPayable: number;
};

export type KeetaInvoiceSummary = {
  periods: KeetaInvoicePeriod[];
  totalGrossSales: number;
  totalNetPayable: number;
  totalCommission: number;
  totalMerchantBorneDiscounts: number;
  dateRange: { from: string; to: string } | null;
};

const SUMMARY_SHEET_NAME = 'ملخص بيانات الفوترة';

export function isKeetaInvoiceSummary(sheetNames: string[]): boolean {
  return sheetNames.includes(SUMMARY_SHEET_NAME);
}

export function parseKeetaInvoiceSummary(sheets: Record<string, any[][]>): KeetaInvoiceSummary | null {
  const rows = sheets[SUMMARY_SHEET_NAME];
  if (!rows || rows.length < 4) return null;

  // Row index 2 (the 3rd row) carries the real column names - rows 0-1 are
  // Keeta's own grouping labels ("إجمالي الإيرادات" spanning several cols).
  const headers = rows[2].map((h: any) => String(h ?? '').trim());
  const col = (name: string) => headers.indexOf(name);
  const idx = {
    period: col('تاريخ المعاملة'),
    grossSales: col('إجمالي السعر الأصلي للصنف'),
    commission: col('إجمالي العمولة'),
    bankFees: col('إجمالي الرسوم المصرفية'),
    merchantDiscounts: col('إجمالي الخصومات من المنصة التي يتحملها التاجر (مسؤولية التاجر، شاملة ضريبة القيمة المضافة)'),
    netPayable: col('إجمالي المبالغ المستحقة للمطعم'),
  };

  const dataRows = rows.slice(3).filter((r) => r.some((c: any) => String(c ?? '').trim() !== ''));

  const periods: KeetaInvoicePeriod[] = dataRows.map((r) => ({
    period: String(r[idx.period] ?? ''),
    grossSales: toNumber(r[idx.grossSales]),
    totalCommission: Math.abs(toNumber(r[idx.commission])),
    totalBankFees: Math.abs(toNumber(r[idx.bankFees])),
    merchantBorneDiscounts: Math.abs(toNumber(r[idx.merchantDiscounts])),
    netPayable: toNumber(r[idx.netPayable]),
  }));

  const totalGrossSales = periods.reduce((s, p) => s + p.grossSales, 0);
  const totalNetPayable = periods.reduce((s, p) => s + p.netPayable, 0);
  const totalCommission = periods.reduce((s, p) => s + p.totalCommission, 0);
  const totalMerchantBorneDiscounts = periods.reduce((s, p) => s + p.merchantBorneDiscounts, 0);

  const dates = periods.map((p) => p.period).filter(Boolean);
  const dateRange = dates.length ? { from: dates[dates.length - 1], to: dates[0] } : null;

  return { periods, totalGrossSales, totalNetPayable, totalCommission, totalMerchantBorneDiscounts, dateRange };
}
