import type { EngineeredItem, MenuClassification } from './menu-engineering';

export type InsightTone = 'good' | 'warning' | 'neutral';

// Where "عرض التفاصيل" scrolls to on the reports page - kept as a small
// closed set (not a free URL) since every insight lives on this same page.
export type InsightTarget = 'trend' | 'matrix';

export type Insight = {
  id: string;
  tone: InsightTone;
  text: string;
  target?: InsightTarget;
  actionLabel?: string;
};

type EngineeredMenuItem = EngineeredItem<{ name: string; popularity: number; profitMargin: number }>;

export function buildInsights(params: {
  items: EngineeredMenuItem[];
  visitsThisWeek: number;
  visitsLastWeek: number;
  qrVisits: number;
  linkVisits: number;
  uniqueVisitorsThisWeek: number;
  liveVisitorCount: number;
  t: (key: string) => string;
}): Insight[] {
  const { items, visitsThisWeek, visitsLastWeek, qrVisits, linkVisits, uniqueVisitorsThisWeek, liveVisitorCount, t } = params;
  const insights: Insight[] = [];

  // Pinned first when present - the one insight that's genuinely live
  // (Realtime Presence, same signal as the "الزوار الآن" card), not just
  // recomputed from the last fetch like everything else here.
  if (liveVisitorCount > 0) {
    insights.push({ id: 'live-now', tone: 'good', text: `${liveVisitorCount} ${t('reportsInsights.liveNowSuffix')}` });
  }

  if (visitsLastWeek > 0) {
    const change = Math.round(((visitsThisWeek - visitsLastWeek) / visitsLastWeek) * 100);
    if (change >= 10) {
      insights.push({ id: 'visits-up', tone: 'good', text: `${t('reportsInsights.visitsUpPrefix')} ${change}% ${t('reportsInsights.visitsUpSuffix')}`, target: 'trend', actionLabel: t('reportsInsights.viewTrendAction') });
    } else if (change <= -10) {
      insights.push({ id: 'visits-down', tone: 'warning', text: `${t('reportsInsights.visitsDownPrefix')} ${Math.abs(change)}% ${t('reportsInsights.visitsDownSuffix')}`, target: 'trend', actionLabel: t('reportsInsights.viewTrendAction') });
    }
  } else if (visitsThisWeek > 0) {
    insights.push({ id: 'visits-new', tone: 'good', text: `${t('reportsInsights.visitsNewPrefix')} (${visitsThisWeek}) ${t('reportsInsights.visitsNewSuffix')}`, target: 'trend', actionLabel: t('reportsInsights.viewTrendAction') });
  }

  // Real distinct-visitor count for the last 7 raw days (not the daily-
  // rollup approximation used elsewhere) - exact because it's computed
  // from individual hub_visits rows, each carrying its own visitor_id.
  if (uniqueVisitorsThisWeek > 0) {
    const repeatShare = visitsThisWeek > uniqueVisitorsThisWeek
      ? Math.round(((visitsThisWeek - uniqueVisitorsThisWeek) / visitsThisWeek) * 100)
      : 0;
    const text = repeatShare >= 20
      ? `${uniqueVisitorsThisWeek} ${t('reportsInsights.uniqueVisitorsPrefix')} — ${repeatShare}% ${t('reportsInsights.repeatShareSuffix')}`
      : `${uniqueVisitorsThisWeek} ${t('reportsInsights.uniqueVisitorsSuffix')}`;
    insights.push({ id: 'unique-visitors', tone: 'neutral', text, target: 'trend', actionLabel: t('reportsInsights.viewTrendAction') });
  }

  const stars = items.filter(i => i.classification === 'star');
  if (stars.length > 0) {
    const top = [...stars].sort((a, b) => b.popularity - a.popularity)[0];
    insights.push({ id: 'top-star', tone: 'good', text: `"${top.name}" ${t('reportsInsights.topStarSuffix')}`, target: 'matrix', actionLabel: t('reportsInsights.viewMatrixAction') });
  }

  const puzzles = items.filter(i => i.classification === 'puzzle');
  if (puzzles.length > 0) {
    const best = [...puzzles].sort((a, b) => b.profitMargin - a.profitMargin)[0];
    insights.push({ id: 'top-puzzle', tone: 'warning', text: `"${best.name}" ${t('reportsInsights.topPuzzleSuffix')}`, target: 'matrix', actionLabel: t('reportsInsights.viewMatrixAction') });
  }

  const dogs = items.filter(i => i.classification === 'dog');
  if (dogs.length >= 3) {
    insights.push({ id: 'dogs-count', tone: 'warning', text: `${dogs.length} ${t('reportsInsights.dogsCountSuffix')}`, target: 'matrix', actionLabel: t('reportsInsights.viewMatrixAction') });
  }

  const totalTraffic = qrVisits + linkVisits;
  if (totalTraffic >= 10) {
    const qrShare = Math.round((qrVisits / totalTraffic) * 100);
    if (qrShare >= 70) {
      insights.push({ id: 'qr-heavy', tone: 'neutral', text: `${qrShare}% ${t('reportsInsights.qrHeavySuffix')}`, target: 'trend', actionLabel: t('reportsInsights.viewTrendAction') });
    } else if (qrShare <= 30) {
      insights.push({ id: 'link-heavy', tone: 'neutral', text: `${100 - qrShare}% ${t('reportsInsights.linkHeavySuffix')}`, target: 'trend', actionLabel: t('reportsInsights.viewTrendAction') });
    }
  }

  return insights;
}
