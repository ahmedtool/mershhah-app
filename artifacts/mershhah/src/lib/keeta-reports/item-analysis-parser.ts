import { toNumber } from './types';

export type KeetaItemAnalysisSummary = {
  totalItems: number;
  topGrowing: { name: string; category: string; salesVolume: number; changePercent: number }[];
  topDeclining: { name: string; category: string; salesVolume: number; changePercent: number }[];
};

const REQUIRED_COLUMNS = ['الصنف', 'ترتيب الصنف', 'حجم المبيعات_القيمة', 'حجم المبيعات_تغيير'];

export function isKeetaItemAnalysis(headers: string[]): boolean {
  return REQUIRED_COLUMNS.every((c) => headers.includes(c));
}

function cleanCategory(raw: unknown): string {
  const s = String(raw ?? '');
  const m = s.match(/"([^"]+)"/);
  return m ? m[1] : s.replace(/[\[\]"]/g, '');
}

export function parseKeetaItemAnalysis(headers: string[], dataRows: any[][]): KeetaItemAnalysisSummary {
  const col = (name: string) => headers.indexOf(name);
  const idx = {
    name: col('الصنف'),
    category: col('فئة الصنف'),
    salesVolume: col('حجم المبيعات_القيمة'),
    salesChange: col('حجم المبيعات_تغيير'),
  };

  const rows = dataRows.filter((r) => r.some((c) => String(c ?? '').trim() !== ''));

  const items = rows.map((r) => ({
    name: String(r[idx.name] ?? ''),
    category: cleanCategory(r[idx.category]),
    salesVolume: toNumber(r[idx.salesVolume]),
    changePercent: toNumber(r[idx.salesChange]) * 100,
  }));

  const sorted = [...items].sort((a, b) => b.changePercent - a.changePercent);

  return {
    totalItems: items.length,
    topGrowing: sorted.filter((i) => i.changePercent > 0).slice(0, 8),
    topDeclining: sorted.filter((i) => i.changePercent < 0).slice(-8).reverse(),
  };
}
