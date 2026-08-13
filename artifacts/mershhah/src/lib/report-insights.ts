import type { EngineeredItem, MenuClassification } from './menu-engineering';

export type InsightTone = 'good' | 'warning' | 'neutral';

export type Insight = {
  id: string;
  tone: InsightTone;
  text: string;
};

type EngineeredMenuItem = EngineeredItem<{ name: string; popularity: number; profitMargin: number }>;

export function buildInsights(params: {
  items: EngineeredMenuItem[];
  visitsThisWeek: number;
  visitsLastWeek: number;
  qrVisits: number;
  linkVisits: number;
}): Insight[] {
  const { items, visitsThisWeek, visitsLastWeek, qrVisits, linkVisits } = params;
  const insights: Insight[] = [];

  if (visitsLastWeek > 0) {
    const change = Math.round(((visitsThisWeek - visitsLastWeek) / visitsLastWeek) * 100);
    if (change >= 10) {
      insights.push({ id: 'visits-up', tone: 'good', text: `زياراتك زادت ${change}% هالأسبوع مقارنة باللي قبله.` });
    } else if (change <= -10) {
      insights.push({ id: 'visits-down', tone: 'warning', text: `زياراتك نزلت ${Math.abs(change)}% هالأسبوع — راجع آخر تحديث بالمنيو أو العروض.` });
    }
  } else if (visitsThisWeek > 0) {
    insights.push({ id: 'visits-new', tone: 'good', text: `بدأت تجيك زيارات هالأسبوع (${visitsThisWeek}) — استمر بمشاركة الرابط.` });
  }

  const stars = items.filter(i => i.classification === 'star');
  if (stars.length > 0) {
    const top = [...stars].sort((a, b) => b.popularity - a.popularity)[0];
    insights.push({ id: 'top-star', tone: 'good', text: `"${top.name}" أعلى صنف عندك تفاعلاً وربحية — ثبّته بمكان بارز بالمنيو.` });
  }

  const puzzles = items.filter(i => i.classification === 'puzzle');
  if (puzzles.length > 0) {
    const best = [...puzzles].sort((a, b) => b.profitMargin - a.profitMargin)[0];
    insights.push({ id: 'top-puzzle', tone: 'warning', text: `"${best.name}" هامش ربحه ممتاز بس نقراته قليلة — جرّب تسوي له عرض ترويجي.` });
  }

  const dogs = items.filter(i => i.classification === 'dog');
  if (dogs.length >= 3) {
    insights.push({ id: 'dogs-count', tone: 'warning', text: `${dogs.length} أصناف شعبيتها وربحيتها تحت المتوسط — راجعها قبل تجديد المنيو.` });
  }

  const totalTraffic = qrVisits + linkVisits;
  if (totalTraffic >= 10) {
    const qrShare = Math.round((qrVisits / totalTraffic) * 100);
    if (qrShare >= 70) {
      insights.push({ id: 'qr-heavy', tone: 'neutral', text: `${qrShare}% من زياراتك من QR داخل الفرع — أغلب عملائك يكتشفونك وهم جالسين.` });
    } else if (qrShare <= 30) {
      insights.push({ id: 'link-heavy', tone: 'neutral', text: `${100 - qrShare}% من زياراتك من الرابط برّا الفرع — يبدو إن السوشال ميديا يجيبلك زوار جدد.` });
    }
  }

  return insights;
}
