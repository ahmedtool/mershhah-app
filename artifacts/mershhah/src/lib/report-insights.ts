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
  t: (key: string) => string;
}): Insight[] {
  const { items, visitsThisWeek, visitsLastWeek, qrVisits, linkVisits, t } = params;
  const insights: Insight[] = [];

  if (visitsLastWeek > 0) {
    const change = Math.round(((visitsThisWeek - visitsLastWeek) / visitsLastWeek) * 100);
    if (change >= 10) {
      insights.push({ id: 'visits-up', tone: 'good', text: `${t('reportsInsights.visitsUpPrefix')} ${change}% ${t('reportsInsights.visitsUpSuffix')}` });
    } else if (change <= -10) {
      insights.push({ id: 'visits-down', tone: 'warning', text: `${t('reportsInsights.visitsDownPrefix')} ${Math.abs(change)}% ${t('reportsInsights.visitsDownSuffix')}` });
    }
  } else if (visitsThisWeek > 0) {
    insights.push({ id: 'visits-new', tone: 'good', text: `${t('reportsInsights.visitsNewPrefix')} (${visitsThisWeek}) ${t('reportsInsights.visitsNewSuffix')}` });
  }

  const stars = items.filter(i => i.classification === 'star');
  if (stars.length > 0) {
    const top = [...stars].sort((a, b) => b.popularity - a.popularity)[0];
    insights.push({ id: 'top-star', tone: 'good', text: `"${top.name}" ${t('reportsInsights.topStarSuffix')}` });
  }

  const puzzles = items.filter(i => i.classification === 'puzzle');
  if (puzzles.length > 0) {
    const best = [...puzzles].sort((a, b) => b.profitMargin - a.profitMargin)[0];
    insights.push({ id: 'top-puzzle', tone: 'warning', text: `"${best.name}" ${t('reportsInsights.topPuzzleSuffix')}` });
  }

  const dogs = items.filter(i => i.classification === 'dog');
  if (dogs.length >= 3) {
    insights.push({ id: 'dogs-count', tone: 'warning', text: `${dogs.length} ${t('reportsInsights.dogsCountSuffix')}` });
  }

  const totalTraffic = qrVisits + linkVisits;
  if (totalTraffic >= 10) {
    const qrShare = Math.round((qrVisits / totalTraffic) * 100);
    if (qrShare >= 70) {
      insights.push({ id: 'qr-heavy', tone: 'neutral', text: `${qrShare}% ${t('reportsInsights.qrHeavySuffix')}` });
    } else if (qrShare <= 30) {
      insights.push({ id: 'link-heavy', tone: 'neutral', text: `${100 - qrShare}% ${t('reportsInsights.linkHeavySuffix')}` });
    }
  }

  return insights;
}
