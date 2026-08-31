import { toNumber } from './types';

export type KeetaItemDataSummary = {
  totalItems: number;
  dateRange: { from: string; to: string } | null;
  topSellers: { name: string; salesVolume: number; salesAmount: number }[];
  viewedNotBought: { name: string; impressions: number; salesVolume: number }[];
};

const REQUIRED_COLUMNS = ['معرّف الصنف', 'اسم الصنف', 'حجم المبيعات', 'معدل الظهور للعميل'];

export function isKeetaItemData(headers: string[]): boolean {
  return REQUIRED_COLUMNS.every((c) => headers.includes(c));
}

function formatYyyymmdd(raw: unknown): string {
  const s = String(raw ?? '').replace(/[^0-9]/g, '');
  if (s.length !== 8) return String(raw ?? '');
  return `${s.slice(6, 8)}/${s.slice(4, 6)}/${s.slice(0, 4)}`;
}

export function parseKeetaItemData(headers: string[], dataRows: any[][]): KeetaItemDataSummary {
  const col = (name: string) => headers.indexOf(name);
  const idx = {
    day: col('اليوم'),
    itemId: col('معرّف الصنف'),
    itemName: col('اسم الصنف'),
    salesAmount: col('مبيعات الصنف'),
    salesVolume: col('حجم المبيعات'),
    impressions: col('معدل الظهور للعميل'),
  };

  const rows = dataRows.filter((r) => r.some((c) => String(c ?? '').trim() !== ''));

  const days = rows.map((r) => formatYyyymmdd(r[idx.day])).filter(Boolean);
  const dateRange = days.length ? { from: days[days.length - 1], to: days[0] } : null;

  const byItem = new Map<string, { name: string; salesVolume: number; salesAmount: number; impressions: number }>();
  rows.forEach((r) => {
    const id = String(r[idx.itemId] ?? '');
    const name = String(r[idx.itemName] ?? '');
    if (!id) return;
    const cur = byItem.get(id) || { name, salesVolume: 0, salesAmount: 0, impressions: 0 };
    cur.salesVolume += toNumber(r[idx.salesVolume]);
    cur.salesAmount += toNumber(r[idx.salesAmount]);
    cur.impressions += toNumber(r[idx.impressions]);
    byItem.set(id, cur);
  });

  const items = Array.from(byItem.values());
  const topSellers = [...items].sort((a, b) => b.salesVolume - a.salesVolume).slice(0, 10);
  const viewedNotBought = items
    .filter((i) => i.impressions >= 20 && i.salesVolume === 0)
    .sort((a, b) => b.impressions - a.impressions)
    .slice(0, 10);

  return { totalItems: byItem.size, dateRange, topSellers, viewedNotBought };
}
