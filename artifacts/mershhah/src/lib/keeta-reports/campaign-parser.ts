import { toNumber } from './types';

export type KeetaCampaignSummary = {
  totalCost: number;
  totalOrders: number;
  totalSales: number;
  dateRange: { from: string; to: string } | null;
  byCampaign: { name: string; cost: number; orders: number; sales: number }[];
};

const REQUIRED_COLUMNS = ['ID النشاط', 'قواعد الخصم', 'تكاليف الحملة', 'تكلفة العرض الترويجي'];

export function isKeetaCampaignData(headers: string[]): boolean {
  return REQUIRED_COLUMNS.every((c) => headers.includes(c));
}

function formatYyyymmdd(raw: unknown): string {
  const s = String(raw ?? '').replace(/[^0-9]/g, '');
  if (s.length !== 8) return String(raw ?? '');
  return `${s.slice(6, 8)}/${s.slice(4, 6)}/${s.slice(0, 4)}`;
}

export function parseKeetaCampaignData(headers: string[], dataRows: any[][]): KeetaCampaignSummary {
  const col = (name: string) => headers.indexOf(name);
  const idx = {
    day: col('اليوم'),
    activityId: col('ID النشاط'),
    rules: col('قواعد الخصم'),
    orders: col('طلبات الحملة'),
    sales: col('المبيعات'),
    cost: col('تكاليف الحملة'),
  };

  const rows = dataRows.filter((r) => r.some((c) => String(c ?? '').trim() !== ''));

  const totalCost = rows.reduce((s, r) => s + toNumber(r[idx.cost]), 0);
  const totalOrders = rows.reduce((s, r) => s + toNumber(r[idx.orders]), 0);
  const totalSales = rows.reduce((s, r) => s + toNumber(r[idx.sales]), 0);

  const days = rows.map((r) => formatYyyymmdd(r[idx.day])).filter(Boolean);
  const dateRange = days.length ? { from: days[days.length - 1], to: days[0] } : null;

  const byCampaignMap = new Map<string, { cost: number; orders: number; sales: number }>();
  rows.forEach((r) => {
    const rulesText = String(r[idx.rules] ?? '');
    const name = rulesText.split(' - ')[0]?.trim() || String(r[idx.activityId] ?? 'حملة');
    const cur = byCampaignMap.get(name) || { cost: 0, orders: 0, sales: 0 };
    cur.cost += toNumber(r[idx.cost]);
    cur.orders += toNumber(r[idx.orders]);
    cur.sales += toNumber(r[idx.sales]);
    byCampaignMap.set(name, cur);
  });

  const byCampaign = Array.from(byCampaignMap.entries())
    .map(([name, v]) => ({ name, ...v }))
    .sort((a, b) => b.cost - a.cost);

  return { totalCost, totalOrders, totalSales, dateRange, byCampaign };
}
