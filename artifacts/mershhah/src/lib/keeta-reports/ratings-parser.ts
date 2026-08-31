import { toNumber, splitList } from './types';

export type KeetaRatingsSummary = {
  totalReviews: number;
  avgRating: number;
  distribution: Record<1 | 2 | 3 | 4 | 5, number>;
  unrepliedCount: number;
  worstReviews: { customer: string; rating: number; date: string; content: string; tags: string[]; items: string }[];
  topTags: { name: string; count: number }[];
};

const REQUIRED_COLUMNS = ['المتجر', 'التقييم', 'تاريخ التقييم', 'التقييم الأصلي'];

export function isKeetaRatings(headers: string[]): boolean {
  return REQUIRED_COLUMNS.every((c) => headers.includes(c));
}

export function parseKeetaRatings(headers: string[], dataRows: any[][]): KeetaRatingsSummary {
  const col = (name: string) => headers.indexOf(name);
  const idx = {
    customer: col('اسم العميل'),
    rating: col('التقييم'),
    date: col('تاريخ التقييم'),
    tags: col('علامات تقييم العميل'),
    content: col('التقييم الأصلي'),
    items: col('تفاصيل الطلب'),
    reply: col('رد التاجر'),
  };

  const rows = dataRows.filter((r) => r.some((c) => String(c ?? '').trim() !== ''));
  const ratings = rows.map((r) => toNumber(r[idx.rating])).filter((n) => n >= 1 && n <= 5);

  const distribution: KeetaRatingsSummary['distribution'] = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  ratings.forEach((n) => {
    const bucket = Math.round(n) as 1 | 2 | 3 | 4 | 5;
    if (distribution[bucket] !== undefined) distribution[bucket]++;
  });

  const avgRating = ratings.length ? ratings.reduce((s, n) => s + n, 0) / ratings.length : 0;
  const unrepliedCount = rows.filter((r) => !String(r[idx.reply] ?? '').trim()).length;

  const worstReviews = rows
    .map((r) => ({
      customer: String(r[idx.customer] ?? ''),
      rating: toNumber(r[idx.rating]),
      date: String(r[idx.date] ?? ''),
      content: String(r[idx.content] ?? '').trim(),
      tags: splitList(r[idx.tags], ','),
      items: String(r[idx.items] ?? ''),
    }))
    .filter((r) => r.rating > 0 && r.rating <= 2)
    .sort((a, b) => a.rating - b.rating)
    .slice(0, 10);

  const tagCounts = new Map<string, number>();
  rows.forEach((r) => splitList(r[idx.tags], ',').forEach((t) => tagCounts.set(t, (tagCounts.get(t) || 0) + 1)));
  const topTags = Array.from(tagCounts.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  return { totalReviews: rows.length, avgRating, distribution, unrepliedCount, worstReviews, topTags };
}
