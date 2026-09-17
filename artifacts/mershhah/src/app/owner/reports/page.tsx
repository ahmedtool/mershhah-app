'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import PageHeader from "@/components/dashboard/PageHeader";
import { Button } from "@/components/ui/button";
import {
    BarChart3,
    Star,
    MousePointerClick,
    TrendingUp,
    TrendingDown,
    QrCode,
    Link2,
    Copy,
    Check,
    Eye,
    Zap,
    Crown,
    Sparkles,
    MapPin,
    Search,
    History,
    Users,
} from 'lucide-react';
import { useUser } from '@/hooks/useUser';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabase';
import type { MenuItem } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { Link } from 'wouter';
import { cn } from '@/lib/utils';
import { classifyMenuItems, CLASSIFICATION_INFO, type MenuClassification } from '@/lib/menu-engineering';
import { buildInsights, type Insight, type InsightTone, type InsightTarget } from '@/lib/report-insights';
import { REVIEW_TAGS, countReviewsByTag } from '@/lib/review-tags';
import { WhatsAppIcon, InstagramIcon, SnapchatIcon, TikTokIcon, XIcon } from '@/components/shared/SocialIcons';
import {
    TRAFFIC_SOURCE_LABEL_KEYS,
    MARKETING_LINK_PLATFORMS,
    buildMarketingLink,
    type TrafficSource,
} from '@/lib/traffic-source';
import { useLanguage } from '@/components/shared/LanguageContext';
import { syncPublicPage } from '@/lib/public-pages';
import { useLiveVisitorCount } from '@/hooks/useRestaurantPresence';
import { formatDistanceToNow } from 'date-fns';
import { ar } from 'date-fns/locale';

type FullReview = {
    id: string;
    rating: number;
    comment?: string | null;
    created_at: string | null;
    is_visible?: boolean;
};

type ItemReview = FullReview & { menu_item_id: string };

type ReviewSort = 'newest' | 'rating_desc' | 'rating_asc';

// 'newest' relies on the original Supabase query order (created_at desc) -
// rating sorts are stable (Array.prototype.sort in modern JS engines), so
// reviews with equal ratings keep their newest-first relative order too.
function sortReviews<T extends { rating: number }>(list: T[], sort: ReviewSort): T[] {
    if (sort === 'newest') return list;
    const sorted = [...list];
    sorted.sort((a, b) => sort === 'rating_desc' ? b.rating - a.rating : a.rating - b.rating);
    return sorted;
}

const KNOWN_TRAFFIC_SOURCES = new Set(Object.keys(TRAFFIC_SOURCE_LABEL_KEYS));

type HistoryPeriod = '7d' | 'this_month' | 'last_month' | '3m' | 'year';

type AnalyticsDailyRow = {
    day: string;
    visits_total: number;
    visits_unique: number;
    visits_qr: number;
    visits_link: number;
    source_breakdown: Record<string, number>;
    branch_breakdown: Record<string, number>;
};

// analytics_daily only has full calendar days in it (yesterday's the most
// recent), so every period here is expressed as day-string boundaries
// rather than timestamps - "today" itself never has a row yet.
function historyPeriodRange(period: HistoryPeriod): { start: string; end: string } {
    const now = new Date();
    const toDay = (d: Date) => d.toISOString().slice(0, 10);
    switch (period) {
        case 'this_month': {
            const start = new Date(now.getFullYear(), now.getMonth(), 1);
            return { start: toDay(start), end: toDay(now) };
        }
        case 'last_month': {
            const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            const end = new Date(now.getFullYear(), now.getMonth(), 0);
            return { start: toDay(start), end: toDay(end) };
        }
        case '3m': {
            const start = new Date(now.getTime() - 89 * DAY_MS);
            return { start: toDay(start), end: toDay(now) };
        }
        case 'year': {
            const start = new Date(now.getFullYear(), 0, 1);
            return { start: toDay(start), end: toDay(now) };
        }
        case '7d':
        default: {
            const start = new Date(now.getTime() - 6 * DAY_MS);
            return { start: toDay(start), end: toDay(now) };
        }
    }
}

const TRAFFIC_SOURCE_ICONS: Partial<Record<TrafficSource, React.ElementType>> = {
    whatsapp: WhatsAppIcon,
    instagram: InstagramIcon,
    snapchat: SnapchatIcon,
    tiktok: TikTokIcon,
    x: XIcon,
    google_maps: MapPin,
    google_search: Search,
    direct: Link2,
    qr_branch: QrCode,
};

function MarketingLinkCard({ icon: Icon, label, hint, link, onCopy }: {
    icon: React.ElementType;
    label: string;
    hint: string;
    link: string;
    onCopy: () => void;
}) {
    const [copied, setCopied] = useState(false);
    return (
        <button
            type="button"
            onClick={() => {
                navigator.clipboard.writeText(link);
                setCopied(true);
                onCopy();
                setTimeout(() => setCopied(false), 1500);
            }}
            className="flex flex-col items-center gap-1 p-2.5 bg-gray-50 border border-gray-100 rounded-xl text-center hover:bg-gray-100 transition-colors"
        >
            <div className="w-7 h-7 rounded-lg bg-white border border-gray-100 flex items-center justify-center text-gray-700 shrink-0">
                <Icon className="h-3.5 w-3.5" size={14} />
            </div>
            <p className="text-[11px] font-bold text-gray-900 truncate w-full">{label}</p>
            <p className="text-[9px] text-gray-500 truncate w-full">{hint}</p>
            {copied ? (
                <Check className="h-3 w-3 text-emerald-600 mt-0.5" />
            ) : (
                <Copy className="h-3 w-3 text-gray-400 mt-0.5" />
            )}
        </button>
    );
}

const INSIGHT_TONE_BLOCK: Record<InsightTone, string> = {
    good: "bg-emerald-50/60 border-emerald-100 text-emerald-800",
    warning: "bg-amber-50/60 border-amber-100 text-amber-800",
    neutral: "bg-gray-50 border-gray-100 text-gray-600",
};

function SmartInsightsCompact({ insights, onAction }: { insights: Insight[]; onAction: (target?: InsightTarget) => void }) {
    const [activeIndex, setActiveIndex] = useState(0);
    const active = insights[Math.min(activeIndex, insights.length - 1)];
    return (
        <div className={cn(
            "inline-flex max-w-full flex-wrap sm:flex-nowrap items-center gap-2 rounded-xl border p-1.5 text-xs",
            INSIGHT_TONE_BLOCK[active.tone],
        )}>
            <div className="flex items-center gap-1 shrink-0">
                {insights.map((insight, idx) => (
                    <button
                        key={insight.id}
                        type="button"
                        onClick={() => setActiveIndex(idx)}
                        className={cn(
                            "w-5 h-5 rounded-md text-[10px] font-bold flex items-center justify-center transition-opacity",
                            idx === activeIndex ? "bg-white/70 opacity-100" : "opacity-40 hover:opacity-70",
                            insight.id === 'live-now' && "relative",
                        )}
                    >
                        {insight.id === 'live-now' && (
                            <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        )}
                        {idx + 1}
                    </button>
                ))}
            </div>
            <span className="hidden sm:inline-block w-px h-4 bg-current opacity-20 shrink-0" />
            <span className="font-medium truncate min-w-0 max-w-[240px] sm:max-w-[420px]">{active.text}</span>
            {active.target && active.actionLabel && (
                <button
                    type="button"
                    onClick={() => onAction(active.target)}
                    className="shrink-0 text-[10px] font-bold underline decoration-dotted opacity-70 hover:opacity-100"
                >
                    {active.actionLabel}
                </button>
            )}
        </div>
    );
}

// Omit MenuItem's own (differently-cased) `classification` field so it
// doesn't collide with this page's lowercase MenuClassification below.
type AnalyzedItem = Omit<MenuItem, 'classification'> & {
    popularity: number;
    profitMargin: number;
};

const DAY_MS = 24 * 60 * 60 * 1000;
const TREND_DAYS = 30;

function dayKey(d: Date): string {
    return d.toISOString().slice(0, 10);
}

const RIYADH_OFFSET_MS = 3 * 60 * 60 * 1000; // Saudi Arabia has no DST

// Riyadh-local calendar day (YYYY-MM-DD) for a given UTC timestamp - matches
// the `day` column analytics_daily_items rows are keyed by.
function riyadhDayKey(isoString: string): string {
    const riyadhTime = new Date(new Date(isoString).getTime() + RIYADH_OFFSET_MS);
    return riyadhTime.toISOString().slice(0, 10);
}

// A generous safety window for the raw menu_item_interactions read below -
// NOT simply "today". A day only stops needing to be read live once it's
// actually present in analytics_daily_items, and a same-day manual backfill
// (e.g. `?date=<today>`, used once already in this project to preview
// unique-visitor counts) can put today's data in the rollup *before* the
// day is over. Reading raw rows purely by wall-clock "today" and adding
// them on top of a rollup that might already include today would double-
// count - the actual de-dup happens client-side in fetchData by comparing
// each raw row's day against the latest day present in the rollup.
function recentRawInteractionsStartUtcIso(): string {
    return new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
}

export default function InsightsHubPage() {
    const { user, isLoading: isUserLoading } = useUser();
    const { toast } = useToast();
    const { t, locale, dir } = useLanguage();
    const [isLoadingData, setIsLoadingData] = useState(true);
    const [analysisData, setAnalysisData] = useState<AnalyzedItem[]>([]);
    const [totalClicks, setTotalClicks] = useState(0);
    const [hubVisitsQr, setHubVisitsQr] = useState(0);
    const [hubVisitsLink, setHubVisitsLink] = useState(0);
    const [sourceCounts, setSourceCounts] = useState<Partial<Record<TrafficSource, number>>>({});
    const [branchCounts, setBranchCounts] = useState<Record<string, number>>({});
    const [branchNames, setBranchNames] = useState<Record<string, { name: string; name_en?: string }>>({});
    const [visitDates, setVisitDates] = useState<string[]>([]);
    const [fullReviews, setFullReviews] = useState<FullReview[]>([]);
    const [itemReviews, setItemReviews] = useState<ItemReview[]>([]);
    const [itemNames, setItemNames] = useState<Record<string, { name: string; name_en?: string }>>({});
    const [reputationTab, setReputationTab] = useState<'restaurant' | 'products'>('restaurant');
    const [reviewSort, setReviewSort] = useState<ReviewSort>('newest');
    const [hubUsername, setHubUsername] = useState<string | null>(null);
    const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
    const [hoveredDay, setHoveredDay] = useState<number | null>(null);
    const [isTogglingVisibility, setIsTogglingVisibility] = useState<string | null>(null);
    const [historyPeriod, setHistoryPeriod] = useState<HistoryPeriod>('7d');
    const [historyRows, setHistoryRows] = useState<AnalyticsDailyRow[]>([]);
    const [historyTopItems, setHistoryTopItems] = useState<[string, number][]>([]);
    const [isHistoryLoading, setIsHistoryLoading] = useState(false);
    const [uniqueVisitorsThisWeek, setUniqueVisitorsThisWeek] = useState(0);
    const trendChartRef = useRef<HTMLDivElement>(null);
    const matrixRef = useRef<HTMLDivElement>(null);

    const isPaid = user?.entitlements?.planId && user.entitlements.planId !== 'free' && user.entitlements.planId !== 'none';
    const liveVisitorCount = useLiveVisitorCount(user?.restaurantId);

    const itemNameOf = useCallback((id: string): string | null => {
        const entry = itemNames[id];
        if (!entry) return null;
        return (dir === 'ltr' && entry.name_en) || entry.name;
    }, [itemNames, dir]);

    const scrollToInsightTarget = useCallback((target?: InsightTarget) => {
        const ref = target === 'matrix' ? matrixRef : target === 'trend' ? trendChartRef : null;
        ref?.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, []);

    const fetchData = useCallback(async () => {
        if (!user?.restaurantId) return;
        try {
            const restaurantId = user.restaurantId;
            const [itemsRes, interactionsRes, itemRollupRes, hubVisitsRes, restRes, reviewsRes, itemReviewsRes, branchesRes] = await Promise.all([
                supabase.from('menu_items').select('*').eq('restaurant_id', restaurantId),
                // A few recent days as a raw safety net - de-duplicated
                // against analytics_daily_items below by day, not assumed
                // to exclude "today" outright (see recentRawInteractionsStartUtcIso).
                supabase.from('menu_item_interactions').select('menu_item_id, created_at').eq('restaurant_id', restaurantId).gte('created_at', recentRawInteractionsStartUtcIso()),
                supabase.from('analytics_daily_items').select('menu_item_id, day, interactions').eq('restaurant_id', restaurantId),
                supabase.from('hub_visits').select('source, created_at, visitor_id, branch_id').eq('restaurant_id', restaurantId).gte('created_at', new Date(Date.now() - TREND_DAYS * DAY_MS).toISOString()),
                supabase.from('restaurants').select('username').eq('id', restaurantId).single(),
                supabase.from('reviews').select('id, rating, comment, created_at, is_visible').eq('restaurant_id', restaurantId).order('created_at', { ascending: false }),
                supabase.from('menu_item_reviews').select('id, menu_item_id, rating, comment, created_at, is_visible').eq('restaurant_id', restaurantId).order('created_at', { ascending: false }),
                supabase.from('branches').select('id, name, name_en').eq('restaurant_id', restaurantId),
            ]);

            const items = (itemsRes.data || []) as MenuItem[];
            const interactions = interactionsRes.data || [];
            const itemRollup = itemRollupRes.data || [];

            let qrCount = 0; let linkCount = 0;
            const dates: string[] = [];
            const sources: Partial<Record<TrafficSource, number>> = {};
            const branchVisitCounts: Record<string, number> = {};
            const uniqueThisWeek = new Set<string>();
            const sevenDaysAgoMs = Date.now() - 7 * DAY_MS;
            (hubVisitsRes.data || []).forEach((d: any) => {
                if (d.source === 'qr_branch') qrCount++; else linkCount++;
                if (d.created_at) dates.push(dayKey(new Date(d.created_at)));
                if (d.visitor_id && d.created_at && new Date(d.created_at).getTime() >= sevenDaysAgoMs) {
                    uniqueThisWeek.add(d.visitor_id);
                }
                // Rows from before the per-platform traffic-source upgrade
                // stored a plain 'link' (or nothing) instead of a real
                // TrafficSource value - fall back to 'other' for anything
                // not in the known set instead of trusting the DB value,
                // which would otherwise flow into a t()/labelKey lookup as
                // an unrecognized key.
                const src = (KNOWN_TRAFFIC_SOURCES.has(d.source) ? d.source : 'other') as TrafficSource;
                sources[src] = (sources[src] || 0) + 1;
                if (d.branch_id) branchVisitCounts[d.branch_id] = (branchVisitCounts[d.branch_id] || 0) + 1;
            });
            setHubVisitsQr(qrCount);
            setHubVisitsLink(linkCount);
            setSourceCounts(sources);
            setBranchCounts(branchVisitCounts);
            setVisitDates(dates);
            setUniqueVisitorsThisWeek(uniqueThisWeek.size);

            const branchNameMap: Record<string, { name: string; name_en?: string }> = {};
            (branchesRes.data || []).forEach((b: any) => { branchNameMap[b.id] = { name: b.name, name_en: b.name_en }; });
            setBranchNames(branchNameMap);

            const rest = restRes.data as any;
            setHubUsername(rest?.username || null);

            setFullReviews((reviewsRes.data || []) as FullReview[]);
            setItemReviews((itemReviewsRes.data || []) as ItemReview[]);
            const names: Record<string, { name: string; name_en?: string }> = {};
            items.forEach(i => { if (i.id) names[i.id] = { name: i.name || '', name_en: i.name_en }; });
            setItemNames(names);

            const popularityMap = new Map<string, number>();
            let maxAggregatedDay: string | null = null;
            itemRollup.forEach((r: any) => {
                popularityMap.set(r.menu_item_id, (popularityMap.get(r.menu_item_id) || 0) + (r.interactions || 0));
                if (r.day && (!maxAggregatedDay || r.day > maxAggregatedDay)) maxAggregatedDay = r.day;
            });
            // Only add a raw row if its own day hasn't already been rolled
            // up - otherwise a same-day backfill (or any day the rollup
            // already covers) would get counted twice: once here, once in
            // itemRollup above.
            interactions.forEach((i: any) => {
                if (!i.created_at) return;
                if (maxAggregatedDay && riyadhDayKey(i.created_at) <= maxAggregatedDay) return;
                popularityMap.set(i.menu_item_id, (popularityMap.get(i.menu_item_id) || 0) + 1);
            });
            setTotalClicks(Array.from(popularityMap.values()).reduce((sum, n) => sum + n, 0));

            const analyzed = items.map(item => {
                const size = item.sizes?.[0] || { price: 0, cost: 0 };
                const profit = size.price - (size.cost || 0);
                const margin = size.price > 0 ? (profit / size.price) * 100 : 0;
                return { ...item, profitMargin: margin, popularity: popularityMap.get(item.id) || 0 };
            });
            analyzed.sort((a, b) => b.popularity - a.popularity);
            setAnalysisData(analyzed);
        } catch (e: any) {
            toast({ title: t('reports.fetchError'), description: e.message, variant: "destructive" });
        } finally {
            setIsLoadingData(false);
        }
    }, [user?.restaurantId, toast]);

    useEffect(() => {
        if (!user?.restaurantId) return;
        setIsLoadingData(true);
        fetchData();
    }, [user?.restaurantId, fetchData]);

    useEffect(() => {
        if (!user?.restaurantId) return;
        const channel = supabase
            .channel(`reports-${user.restaurantId}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'hub_visits', filter: `restaurant_id=eq.${user.restaurantId}` }, fetchData)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'menu_item_interactions', filter: `restaurant_id=eq.${user.restaurantId}` }, fetchData)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'reviews', filter: `restaurant_id=eq.${user.restaurantId}` }, fetchData)
            .subscribe();
        return () => { supabase.removeChannel(channel); };
    }, [user?.restaurantId, fetchData]);

    // Historical periods read from analytics_daily (the nightly rollup)
    // instead of the raw event tables above - it's the only way a "this
    // year" report stays cheap once traffic grows, and it's what lets the
    // owner go back past the fixed 30-day window the live chart is capped to.
    const fetchHistory = useCallback(async () => {
        if (!user?.restaurantId) return;
        setIsHistoryLoading(true);
        try {
            const { start, end } = historyPeriodRange(historyPeriod);
            const [visitsRes, itemsRes] = await Promise.all([
                supabase
                    .from('analytics_daily')
                    .select('day, visits_total, visits_unique, visits_qr, visits_link, source_breakdown, branch_breakdown')
                    .eq('restaurant_id', user.restaurantId)
                    .gte('day', start)
                    .lte('day', end)
                    .order('day', { ascending: false }),
                supabase
                    .from('analytics_daily_items')
                    .select('menu_item_id, interactions')
                    .eq('restaurant_id', user.restaurantId)
                    .gte('day', start)
                    .lte('day', end),
            ]);
            if (visitsRes.error) throw visitsRes.error;
            setHistoryRows((visitsRes.data || []) as AnalyticsDailyRow[]);

            const itemTotals = new Map<string, number>();
            (itemsRes.data || []).forEach((r: any) => {
                itemTotals.set(r.menu_item_id, (itemTotals.get(r.menu_item_id) || 0) + (r.interactions || 0));
            });
            setHistoryTopItems(Array.from(itemTotals.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5));
        } catch {
            setHistoryRows([]);
            setHistoryTopItems([]);
        } finally {
            setIsHistoryLoading(false);
        }
    }, [user?.restaurantId, historyPeriod]);

    useEffect(() => { fetchHistory(); }, [fetchHistory]);

    const historyTotals = useMemo(() => {
        const totals = { visits: 0, unique: 0, qr: 0, link: 0, sources: {} as Record<string, number>, branches: {} as Record<string, number> };
        historyRows.forEach((r) => {
            totals.visits += r.visits_total;
            totals.unique += r.visits_unique;
            totals.qr += r.visits_qr;
            totals.link += r.visits_link;
            Object.entries(r.source_breakdown || {}).forEach(([src, count]) => {
                totals.sources[src] = (totals.sources[src] || 0) + count;
            });
            Object.entries(r.branch_breakdown || {}).forEach(([branchId, count]) => {
                totals.branches[branchId] = (totals.branches[branchId] || 0) + count;
            });
        });
        return totals;
    }, [historyRows]);

    const topHistoryBranches = useMemo(() => {
        return Object.entries(historyTotals.branches)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 8);
    }, [historyTotals.branches]);

    useEffect(() => {
        if (!hubUsername || typeof window === 'undefined') return;
        const baseUrl = (import.meta.env.VITE_APP_URL || window.location.origin).replace(/\/$/, '');
        const qrUrl = `${baseUrl}/${hubUsername}?source=qr_branch`;
        import('qrcode').then((QRCode) => {
            QRCode.toDataURL(qrUrl, { width: 280, margin: 2 }).then(setQrDataUrl).catch(() => {});
        }).catch(() => {});
    }, [hubUsername]);

    const totalVisits = hubVisitsQr + hubVisitsLink;

    // 30-day daily bucket, oldest → newest
    const trend = useMemo(() => {
        const counts = new Map<string, number>();
        visitDates.forEach(d => counts.set(d, (counts.get(d) || 0) + 1));
        const days: { key: string; label: string; count: number }[] = [];
        for (let i = TREND_DAYS - 1; i >= 0; i--) {
            const d = new Date(Date.now() - i * DAY_MS);
            const key = dayKey(d);
            days.push({ key, label: d.toLocaleDateString(locale === 'ar' ? 'ar-SA' : 'en-US', { day: 'numeric', month: 'short' }), count: counts.get(key) || 0 });
        }
        return days;
    }, [visitDates, locale]);

    const weekChange = useMemo(() => {
        const thisWeek = trend.slice(-7).reduce((s, d) => s + d.count, 0);
        const lastWeek = trend.slice(-14, -7).reduce((s, d) => s + d.count, 0);
        return { thisWeek, lastWeek };
    }, [trend]);

    // Highest-count source first, dropping sources with zero visits
    const sortedSources = useMemo(() => {
        return (Object.entries(sourceCounts) as [TrafficSource, number][])
            .filter(([, count]) => count > 0)
            .sort((a, b) => b[1] - a[1]);
    }, [sourceCounts]);
    const sourceTotal = sortedSources.reduce((s, [, count]) => s + count, 0);

    // Highest-count branch first - only branches with at least one
    // branch-linked visit show up here (a branch nobody's visited via its
    // link yet simply doesn't appear, same convention as sortedSources).
    const sortedBranches = useMemo(() => {
        return Object.entries(branchCounts)
            .filter(([, count]) => count > 0)
            .sort((a, b) => b[1] - a[1]);
    }, [branchCounts]);
    const branchVisitTotal = sortedBranches.reduce((s, [, count]) => s + count, 0);
    const branchLabel = (id: string) => {
        const b = branchNames[id];
        if (!b) return t('reports.unknownBranch');
        return (dir === 'ltr' && b.name_en) || b.name;
    };

    const baseUrl = typeof window !== 'undefined'
        ? (import.meta.env.VITE_APP_URL || window.location.origin).replace(/\/$/, '')
        : '';

    const engineered = useMemo(() => classifyMenuItems(analysisData.map(i => ({ ...i, name: i.name || '' }))), [analysisData]);

    const insights: Insight[] = useMemo(() => buildInsights({
        items: engineered,
        visitsThisWeek: weekChange.thisWeek,
        visitsLastWeek: weekChange.lastWeek,
        qrVisits: hubVisitsQr,
        linkVisits: hubVisitsLink,
        uniqueVisitorsThisWeek,
        liveVisitorCount,
        t,
    }), [engineered, weekChange, hubVisitsQr, hubVisitsLink, uniqueVisitorsThisWeek, liveVisitorCount, t]);

    // Computed live from the same reviews already fetched, instead of
    // reading restaurants.rating/review_count - those columns are never
    // actually written anywhere in this app (confirmed: no write path, no
    // DB trigger), so they always read as 0 regardless of real reviews.
    // syncPublicPage() already computes this exact number correctly for
    // reviews_summary, just never persists it back onto the row.
    const { restaurantRating, restaurantReviewCount } = useMemo(() => {
        const visible = fullReviews.filter(r => r.is_visible !== false);
        const restaurantReviewCount = visible.length;
        const restaurantRating = restaurantReviewCount > 0
            ? visible.reduce((sum, r) => sum + (r.rating || 0), 0) / restaurantReviewCount
            : 0;
        return { restaurantRating, restaurantReviewCount };
    }, [fullReviews]);

    const reviewComments = useMemo(
        () => fullReviews.filter(r => r.is_visible !== false && r.comment).map(r => r.comment as string),
        [fullReviews],
    );
    const topicCounts = useMemo(() => countReviewsByTag(reviewComments), [reviewComments]);
    const sortedFullReviews = useMemo(() => sortReviews(fullReviews, reviewSort), [fullReviews, reviewSort]);
    const sortedItemReviews = useMemo(() => sortReviews(itemReviews, reviewSort), [itemReviews, reviewSort]);
    const topicMax = Math.max(1, ...Object.values(topicCounts));

    const handleVisibilityToggle = (reviewId: string, newVisibility: boolean) => {
        setIsTogglingVisibility(reviewId);
        supabase.from('reviews').update({ is_visible: newVisibility }).eq('id', reviewId).then(({ error }: { error: any }) => {
            setIsTogglingVisibility(null);
            if (error) return;
            setFullReviews(prev => prev.map(r => r.id === reviewId ? { ...r, is_visible: newVisibility } : r));
            if (user?.restaurantId) syncPublicPage(user.restaurantId).catch(() => {});
        });
    };

    const handleItemVisibilityToggle = (reviewId: string, newVisibility: boolean) => {
        setIsTogglingVisibility(reviewId);
        supabase.from('menu_item_reviews').update({ is_visible: newVisibility }).eq('id', reviewId).then(({ error }: { error: any }) => {
            setIsTogglingVisibility(null);
            if (error) return;
            setItemReviews(prev => prev.map(r => r.id === reviewId ? { ...r, is_visible: newVisibility } : r));
            if (user?.restaurantId) syncPublicPage(user.restaurantId).catch(() => {});
        });
    };

    if (isLoadingData || isUserLoading) {
        return (
            <div className="space-y-5">
                <Skeleton className="h-10 w-1/3" />
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3"><Skeleton className="h-24 rounded-2xl" /><Skeleton className="h-24 rounded-2xl" /><Skeleton className="h-24 rounded-2xl" /><Skeleton className="h-24 rounded-2xl" /></div>
                <Skeleton className="h-56 rounded-2xl" />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3"><Skeleton className="h-48 rounded-2xl" /><Skeleton className="h-48 rounded-2xl" /></div>
            </div>
        );
    }

    const trendMax = Math.max(1, ...trend.map(d => d.count));
    const chartW = 600;
    const chartH = 150;
    const padY = 12;
    const pointX = (i: number) => (i / (TREND_DAYS - 1)) * chartW;
    const pointY = (count: number) => chartH - padY - (count / trendMax) * (chartH - padY * 2);
    const linePath = trend.map((d, i) => `${i === 0 ? 'M' : 'L'}${pointX(i).toFixed(1)},${pointY(d.count).toFixed(1)}`).join(' ');
    const areaPath = `${linePath} L${pointX(TREND_DAYS - 1).toFixed(1)},${chartH} L0,${chartH} Z`;
    const weekPct = weekChange.lastWeek > 0 ? Math.round(((weekChange.thisWeek - weekChange.lastWeek) / weekChange.lastWeek) * 100) : null;

    return (
        <div className="space-y-4 pb-10">
            <PageHeader title={t('reports.title')} description={t('reports.subtitle')} />

            {/* Live visitors — Supabase Realtime Presence, no DB writes, updates the instant someone opens/closes the menu or hub page */}
            <div className="bg-gray-900 rounded-2xl p-5 text-white flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                    <span className="relative flex h-2.5 w-2.5 shrink-0">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
                    </span>
                    <div>
                        <h3 className="text-sm font-bold">{t('reports.liveVisitorsTitle')}</h3>
                        <p className="text-[10px] text-white/60">{t('reports.liveVisitorsDesc')}</p>
                    </div>
                </div>
                <p className="text-3xl font-black tabular-nums">{liveVisitorCount}</p>
            </div>

            {/* Stats Row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-white border border-gray-100 rounded-2xl p-4">
                    <div className="flex items-center gap-2 mb-3">
                        <div className="w-8 h-8 rounded-xl bg-gray-900 flex items-center justify-center">
                            <MousePointerClick className="h-3.5 w-3.5 text-white" />
                        </div>
                        <span className="text-[10px] text-gray-600 font-medium">{t('reports.interaction')}</span>
                    </div>
                    <p className="text-2xl font-black text-gray-900">{totalClicks}</p>
                    <p className="text-[10px] text-gray-600 mt-1">{t('reports.menuClick')}</p>
                </div>
                <div className="bg-white border border-gray-100 rounded-2xl p-4">
                    <div className="flex items-center gap-2 mb-3">
                        <div className="w-8 h-8 rounded-xl bg-amber-50 flex items-center justify-center">
                            <Star className="h-3.5 w-3.5 text-amber-500" />
                        </div>
                        <span className="text-[10px] text-gray-600 font-medium">{t('reports.rating')}</span>
                    </div>
                    <p className="text-2xl font-black text-gray-900">{restaurantRating.toFixed(1)}</p>
                    <p className="text-[10px] text-gray-600 mt-1">{restaurantReviewCount} {t('reports.ratingCount')}</p>
                </div>
                <div className="bg-white border border-gray-100 rounded-2xl p-4">
                    <div className="flex items-center gap-2 mb-3">
                        <div className="w-8 h-8 rounded-xl bg-emerald-50 flex items-center justify-center">
                            <Eye className="h-3.5 w-3.5 text-emerald-500" />
                        </div>
                        <span className="text-[10px] text-gray-600 font-medium">{t('reports.visits30Days')}</span>
                    </div>
                    <p className="text-2xl font-black text-gray-900">{totalVisits}</p>
                    <p className="text-[10px] text-gray-600 mt-1">{t('reports.menuVisit')}</p>
                </div>
                <div className="bg-white border border-gray-100 rounded-2xl p-4">
                    <div className="flex items-center gap-2 mb-3">
                        <div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center">
                            <Zap className="h-3.5 w-3.5 text-blue-500" />
                        </div>
                        <span className="text-[10px] text-gray-600 font-medium">{t('reports.status')}</span>
                    </div>
                    <p className="text-lg font-black text-gray-900">{totalClicks > 0 ? t('reports.active') : t('reports.newStatus')}</p>
                    <p className="text-[10px] text-gray-600 mt-1">{t('reports.yourDigitalInterface')}</p>
                </div>
            </div>

            {/* Trend chart — free tier */}
            <div ref={trendChartRef} className="bg-white border border-gray-100 rounded-2xl p-5">
                <div className="flex items-center justify-between mb-1 flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                        <TrendingUp className="h-4 w-4 text-gray-600" />
                        <h3 className="text-sm font-bold text-gray-900">{t('reports.visitsLast30Days')}</h3>
                    </div>
                    {weekPct !== null && (
                        <span className={cn(
                            "text-[10px] font-bold px-2 py-1 rounded-full flex items-center gap-1",
                            weekPct >= 0 ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-500"
                        )}>
                            {weekPct >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                            {Math.abs(weekPct)}% {t('reports.comparedToLastWeek')}
                        </span>
                    )}
                </div>
                <div className="relative mt-3" onMouseLeave={() => setHoveredDay(null)}>
                    <svg viewBox={`0 0 ${chartW} ${chartH}`} className="w-full h-40" preserveAspectRatio="none">
                        <defs>
                            <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#2a78d6" stopOpacity="0.18" />
                                <stop offset="100%" stopColor="#2a78d6" stopOpacity="0" />
                            </linearGradient>
                        </defs>
                        <line x1="0" y1={chartH - padY} x2={chartW} y2={chartH - padY} stroke="#e1e0d9" strokeWidth="1" />
                        <path d={areaPath} fill="url(#trendFill)" />
                        <path d={linePath} fill="none" stroke="#2a78d6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        {hoveredDay !== null && (
                            <>
                                <line x1={pointX(hoveredDay)} y1="0" x2={pointX(hoveredDay)} y2={chartH} stroke="#c3c2b7" strokeWidth="1" strokeDasharray="3,3" />
                                <circle cx={pointX(hoveredDay)} cy={pointY(trend[hoveredDay].count)} r="4" fill="#2a78d6" stroke="white" strokeWidth="1.5" />
                            </>
                        )}
                        <circle cx={pointX(TREND_DAYS - 1)} cy={pointY(trend[TREND_DAYS - 1].count)} r="3.5" fill="#2a78d6" />
                        {trend.map((d, i) => (
                            <rect key={d.key} x={pointX(i) - (chartW / TREND_DAYS) / 2} y="0" width={chartW / TREND_DAYS} height={chartH}
                                fill="transparent" onMouseEnter={() => setHoveredDay(i)} />
                        ))}
                    </svg>
                    {hoveredDay !== null && (
                        <div
                            className="absolute -top-1 bg-gray-900 text-white text-[10px] font-bold px-2 py-1 rounded-lg pointer-events-none whitespace-nowrap"
                            style={{ right: `${100 - (pointX(hoveredDay) / chartW) * 100}%`, transform: 'translateX(50%)' }}
                        >
                            {trend[hoveredDay].label} — {trend[hoveredDay].count} {t('reports.visitWord')}
                        </div>
                    )}
                </div>
            </div>

            {/* Visit Sources */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="bg-white border border-gray-100 rounded-2xl p-5">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-gray-900 flex items-center justify-center">
                                <QrCode className="h-4 w-4 text-white" />
                            </div>
                            <div>
                                <h3 className="text-sm font-bold text-gray-900">{t('reports.insideBranch')}</h3>
                                <p className="text-[10px] text-gray-600">{t('reports.qrOnTable')}</p>
                            </div>
                        </div>
                        <p className="text-2xl font-black text-gray-900">{hubVisitsQr}</p>
                    </div>
                    <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-gray-900 rounded-full transition-all" style={{ width: totalVisits > 0 ? `${(hubVisitsQr / totalVisits) * 100}%` : '0%' }} />
                    </div>
                </div>
                <div className="bg-white border border-gray-100 rounded-2xl p-5">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center">
                                <Link2 className="h-4 w-4 text-gray-600" />
                            </div>
                            <div>
                                <h3 className="text-sm font-bold text-gray-900">{t('reports.outsideBranch')}</h3>
                                <p className="text-[10px] text-gray-600">{t('reports.instagramLink')}</p>
                            </div>
                        </div>
                        <p className="text-2xl font-black text-gray-900">{hubVisitsLink}</p>
                    </div>
                    <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-gray-400 rounded-full transition-all" style={{ width: totalVisits > 0 ? `${(hubVisitsLink / totalVisits) * 100}%` : '0%' }} />
                    </div>
                </div>
            </div>

            {/* Detailed traffic-source breakdown */}
            {sortedSources.length > 0 && (
                <div className="bg-white border border-gray-100 rounded-2xl p-5">
                    <div className="flex items-center gap-2 mb-4">
                        <BarChart3 className="h-4 w-4 text-gray-600" />
                        <h3 className="text-sm font-bold text-gray-900">{t('reports.trafficSourceBreakdown')}</h3>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                        {sortedSources.map(([source, count]) => {
                            const SourceIcon = TRAFFIC_SOURCE_ICONS[source] || Link2;
                            const pct = sourceTotal > 0 ? (count / sourceTotal) * 100 : 0;
                            return (
                                <div key={source} className="flex items-center gap-2.5 p-2.5 bg-gray-50 border border-gray-100 rounded-xl">
                                    <div className="w-7 h-7 rounded-lg bg-white border border-gray-100 flex items-center justify-center shrink-0 text-gray-600">
                                        <SourceIcon className="h-3.5 w-3.5" size={14} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between gap-2">
                                            <span className="text-xs font-bold text-gray-900 truncate">{t(TRAFFIC_SOURCE_LABEL_KEYS[source])}</span>
                                            <span className="text-[10px] font-mono font-bold text-gray-600 shrink-0">{count} · {pct.toFixed(0)}%</span>
                                        </div>
                                        <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden mt-1.5">
                                            <div className="h-full rounded-full bg-[#2a78d6] transition-all" style={{ width: `${pct}%` }} />
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                    <p className="text-[10px] text-gray-500 mt-4 pt-4 border-t border-gray-100 leading-relaxed">
                        {t('reports.trafficSourceNote')}
                    </p>
                </div>
            )}

            {/* Per-branch performance - only visits recorded via a
                branch-specific link/QR (?branch=<id>) are attributable to a
                branch, so a restaurant with a single branch or with visitors
                only landing on the general hub link won't see this card. */}
            {sortedBranches.length > 0 && (
                <div className="bg-white border border-gray-100 rounded-2xl p-5">
                    <div className="flex items-center gap-2 mb-4">
                        <MapPin className="h-4 w-4 text-gray-600" />
                        <h3 className="text-sm font-bold text-gray-900">{t('reports.branchPerformanceTitle')}</h3>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                        {sortedBranches.map(([branchId, count]) => {
                            const pct = branchVisitTotal > 0 ? (count / branchVisitTotal) * 100 : 0;
                            return (
                                <div key={branchId} className="flex items-center gap-2.5 p-2.5 bg-gray-50 border border-gray-100 rounded-xl">
                                    <div className="w-7 h-7 rounded-lg bg-white border border-gray-100 flex items-center justify-center shrink-0 text-gray-600">
                                        <MapPin className="h-3.5 w-3.5" size={14} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between gap-2">
                                            <span className="text-xs font-bold text-gray-900 truncate">{branchLabel(branchId)}</span>
                                            <span className="text-[10px] font-mono font-bold text-gray-600 shrink-0">{count} · {pct.toFixed(0)}%</span>
                                        </div>
                                        <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden mt-1.5">
                                            <div className="h-full rounded-full bg-[#2a78d6] transition-all" style={{ width: `${pct}%` }} />
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                    <p className="text-[10px] text-gray-500 mt-4 pt-4 border-t border-gray-100 leading-relaxed">
                        {t('reports.branchPerformanceNote')}
                    </p>
                </div>
            )}

            {/* Historical reports by period — reads analytics_daily, not raw event tables */}
            <div className="bg-white border border-gray-100 rounded-2xl p-5">
                <div className="flex items-center justify-between flex-wrap gap-3 mb-1">
                    <div className="flex items-center gap-2">
                        <History className="h-4 w-4 text-gray-600" />
                        <h3 className="text-sm font-bold text-gray-900">{t('reports.historyTitle')}</h3>
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                        {([
                            ['7d', 'reports.periodWeek'],
                            ['this_month', 'reports.periodThisMonth'],
                            ['last_month', 'reports.periodLastMonth'],
                            ['3m', 'reports.period3Months'],
                            ['year', 'reports.periodYear'],
                        ] as [HistoryPeriod, string][]).map(([period, labelKey]) => (
                            <button
                                key={period}
                                type="button"
                                onClick={() => setHistoryPeriod(period)}
                                className={cn(
                                    "h-8 px-3 rounded-full text-[11px] font-bold transition-colors",
                                    historyPeriod === period ? "bg-gray-900 text-white" : "bg-gray-50 text-gray-600 hover:bg-gray-100",
                                )}
                            >
                                {t(labelKey)}
                            </button>
                        ))}
                    </div>
                </div>
                <p className="text-[10px] text-gray-600 mb-4">{t('reports.historyDesc')}</p>

                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
                    <div className="bg-gray-50 border border-gray-100 rounded-xl p-3.5">
                        <div className="flex items-center gap-1.5 text-gray-600 mb-1"><TrendingUp className="h-3 w-3" /><span className="text-[10px] font-medium">{t('reports.historyTotalVisits')}</span></div>
                        <p className="text-xl font-black text-gray-900">{historyTotals.visits}</p>
                    </div>
                    <div className="bg-gray-50 border border-gray-100 rounded-xl p-3.5">
                        <div className="flex items-center gap-1.5 text-gray-600 mb-1"><Users className="h-3 w-3" /><span className="text-[10px] font-medium">{t('reports.historyUniqueVisitors')}</span></div>
                        <p className="text-xl font-black text-gray-900">{historyTotals.unique}</p>
                    </div>
                    <div className="bg-gray-50 border border-gray-100 rounded-xl p-3.5">
                        <div className="flex items-center gap-1.5 text-gray-600 mb-1"><QrCode className="h-3 w-3" /><span className="text-[10px] font-medium">{t('reports.insideBranch')}</span></div>
                        <p className="text-xl font-black text-gray-900">{historyTotals.qr}</p>
                    </div>
                    <div className="bg-gray-50 border border-gray-100 rounded-xl p-3.5">
                        <div className="flex items-center gap-1.5 text-gray-600 mb-1"><Link2 className="h-3 w-3" /><span className="text-[10px] font-medium">{t('reports.outsideBranch')}</span></div>
                        <p className="text-xl font-black text-gray-900">{historyTotals.link}</p>
                    </div>
                </div>
                <p className="text-[10px] text-gray-500 mb-4">{t('reports.historyUniqueNote')}</p>

                {historyTopItems.length > 0 && (
                    <div className="border-t border-gray-100 pt-4 mb-4">
                        <div className="flex items-center gap-1.5 mb-3">
                            <Crown className="h-3.5 w-3.5 text-amber-500" />
                            <p className="text-[11px] font-bold text-gray-700">{t('reports.historyTopItemsTitle')}</p>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2">
                            {historyTopItems.map(([itemId, count], idx) => (
                                <div key={itemId} className="flex items-center gap-2 bg-gray-50 border border-gray-100 rounded-xl p-2.5">
                                    <span className="w-5 h-5 rounded-full bg-gray-900 text-white text-[10px] font-bold flex items-center justify-center shrink-0">{idx + 1}</span>
                                    <div className="min-w-0 flex-1">
                                        <p className="text-[11px] font-bold text-gray-900 truncate">{itemNameOf(itemId) || t('reports.historyUnknownItem')}</p>
                                        <p className="text-[10px] text-gray-500">{count} {t('reports.historyInteractionWord')}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {topHistoryBranches.length > 0 && (
                    <div className="border-t border-gray-100 pt-4 mb-4">
                        <div className="flex items-center gap-1.5 mb-3">
                            <MapPin className="h-3.5 w-3.5 text-gray-600" />
                            <p className="text-[11px] font-bold text-gray-700">{t('reports.historyTopBranchesTitle')}</p>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2">
                            {topHistoryBranches.map(([branchId, count], idx) => (
                                <div key={branchId} className="flex items-center gap-2 bg-gray-50 border border-gray-100 rounded-xl p-2.5">
                                    <span className="w-5 h-5 rounded-full bg-gray-900 text-white text-[10px] font-bold flex items-center justify-center shrink-0">{idx + 1}</span>
                                    <div className="min-w-0 flex-1">
                                        <p className="text-[11px] font-bold text-gray-900 truncate">{branchLabel(branchId)}</p>
                                        <p className="text-[10px] text-gray-500">{count} {t('reports.visitWord')}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                <div className="border-t border-gray-100 pt-4">
                    <p className="text-[11px] font-bold text-gray-700 mb-2">{t('reports.historyDailyLogTitle')}</p>
                    {isHistoryLoading ? (
                        <Skeleton className="h-24 w-full rounded-xl" />
                    ) : historyRows.length === 0 ? (
                        <p className="text-[11px] text-gray-500 py-4 text-center">{t('reports.historyDailyLogEmpty')}</p>
                    ) : (
                        <div className="max-h-72 overflow-y-auto rounded-xl border border-gray-100">
                            <table className="w-full text-xs">
                                <thead className="sticky top-0 bg-gray-50">
                                    <tr className="text-gray-600">
                                        <th className="text-start font-semibold px-3 py-2">{t('reports.historyDate')}</th>
                                        <th className="text-start font-semibold px-3 py-2">{t('reports.historyVisitsCol')}</th>
                                        <th className="text-start font-semibold px-3 py-2">{t('reports.historyUniqueCol')}</th>
                                        <th className="text-start font-semibold px-3 py-2">{t('reports.historyQrCol')}</th>
                                        <th className="text-start font-semibold px-3 py-2">{t('reports.historyLinkCol')}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {historyRows.map((row) => (
                                        <tr key={row.day} className="border-t border-gray-50">
                                            <td className="px-3 py-2 font-mono text-gray-700">{row.day}</td>
                                            <td className="px-3 py-2 font-bold text-gray-900">{row.visits_total}</td>
                                            <td className="px-3 py-2 text-gray-600">{row.visits_unique}</td>
                                            <td className="px-3 py-2 text-gray-600">{row.visits_qr}</td>
                                            <td className="px-3 py-2 text-gray-600">{row.visits_link}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>

            {/* QR & Link Section */}
            {hubUsername && (
                <div className="bg-white border border-gray-100 rounded-2xl p-5">
                    <div className="flex items-center gap-2 mb-5">
                        <h3 className="text-sm font-bold text-gray-900">{t('reports.smartLinkAndQr')}</h3>
                    </div>
                    <div className="flex flex-col md:flex-row gap-8 items-start">
                        <div className="flex-1 space-y-3">
                            <p className="text-[10px] text-gray-600 font-medium">{t('reports.smartLink')}</p>
                            <div className="flex gap-2 items-center flex-wrap">
                                <code className="text-xs text-gray-600 bg-gray-50 border border-gray-100 px-3 py-2 rounded-xl break-all">
                                    mershhah.com/{hubUsername}
                                </code>
                                <Button size="sm" variant="outline" className="h-8 rounded-xl text-xs border-gray-200" onClick={() => {
                                    const baseUrl = (import.meta.env.VITE_APP_URL || window.location.origin).replace(/\/$/, '');
                                    navigator.clipboard.writeText(`${baseUrl}/${hubUsername}`);
                                    toast({ title: t('reports.linkCopied') });
                                }}><Copy className="h-3 w-3 me-1" /> {t('common.copy')}</Button>
                            </div>
                        </div>
                        <div className="space-y-3">
                            <p className="text-[10px] text-gray-600 font-medium">{t('reports.qrForTable')}</p>
                            {qrDataUrl ? (
                                <div className="inline-flex flex-col items-center gap-3">
                                    <div className="inline-block p-3 bg-white rounded-2xl border border-gray-100">
                                        <img src={qrDataUrl} alt={t('reports.qrForMenuAlt')} className="w-[180px] h-[180px]" />
                                    </div>
                                    <Button size="sm" variant="outline" className="h-8 rounded-xl text-xs border-gray-200" onClick={() => {
                                        const link = document.createElement('a');
                                        link.href = qrDataUrl;
                                        link.download = `hub-qr-${hubUsername || 'menu'}.png`;
                                        document.body.appendChild(link); link.click(); link.remove();
                                    }}>{t('reports.downloadQr')}</Button>
                                </div>
                            ) : (
                                <div className="w-[180px] h-[180px] bg-gray-50 border border-gray-100 rounded-2xl animate-pulse flex items-center justify-center text-[10px] text-gray-600">{t('reports.generating')}</div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Marketing links generator */}
            {hubUsername && (
                <div className="bg-white border border-gray-100 rounded-2xl p-5">
                    <div className="mb-5">
                        <h3 className="text-sm font-bold text-gray-900">{t('reports.marketingLinksTitle')}</h3>
                        <p className="text-[10px] text-gray-600 mt-1">{t('reports.marketingLinksDesc')}</p>
                    </div>
                    <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
                        {MARKETING_LINK_PLATFORMS.map(({ source, labelKey, hintKey }) => {
                            const PlatformIcon = TRAFFIC_SOURCE_ICONS[source] || Link2;
                            const link = buildMarketingLink(baseUrl, hubUsername, source);
                            const label = t(labelKey);
                            return (
                                <MarketingLinkCard
                                    key={source}
                                    icon={PlatformIcon}
                                    label={label}
                                    hint={t(hintKey)}
                                    link={link}
                                    onCopy={() => toast({ title: `${t('reports.linkCopiedForPrefix')} ${label}` })}
                                />
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Smart Insights — paid tier */}
            <div className={cn("bg-white border border-gray-100 rounded-2xl p-4", !isPaid && "relative")}>
                <div className="flex items-center gap-2 mb-3">
                    <Sparkles className="h-4 w-4 text-gray-600" />
                    <h3 className="text-sm font-bold text-gray-900">{t('reports.smartInsights')}</h3>
                </div>
                {!isPaid ? (
                    <UpgradeGate description={t('reports.smartInsightsGateDesc')} />
                ) : insights.length === 0 ? (
                    <div className="py-10 text-center text-gray-600 text-xs">{t('reports.needMoreDataForInsights')}</div>
                ) : (
                    <SmartInsightsCompact insights={insights} onAction={scrollToInsightTarget} />
                )}
            </div>

            {/* Popular Items & Menu Engineering Matrix */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
                {/* Popular Items */}
                <div className="bg-white border border-gray-100 rounded-2xl p-5">
                    <div className="flex items-center gap-2 mb-4">
                        <TrendingUp className="h-4 w-4 text-gray-600" />
                        <h3 className="text-sm font-bold text-gray-900">{t('reports.topEngagedItems')}</h3>
                    </div>
                    {analysisData.length === 0 ? (
                        <div className="py-12 text-center text-gray-600 text-xs">{t('reports.noInteractionDataYet')}</div>
                    ) : (
                        <div className="space-y-2">
                            {analysisData.slice(0, 5).map((item, idx) => (
                                <div key={item.id || `popular-${idx}`} className="flex items-center justify-between p-3 bg-gray-50 border border-gray-100 rounded-xl">
                                    <div className="flex items-center gap-3">
                                        <span className="text-[10px] font-bold text-gray-600 w-4">{idx + 1}</span>
                                        <span className="text-sm font-bold text-gray-900">{(dir === 'ltr' && item.name_en) || item.name}</span>
                                    </div>
                                    <span className="text-[10px] font-mono font-bold text-gray-600 bg-white border border-gray-100 px-2 py-0.5 rounded-md">{item.popularity}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Menu Engineering Matrix — paid tier */}
                <div ref={matrixRef} className={cn("bg-white border border-gray-100 rounded-2xl p-5", !isPaid && "relative")}>
                    <div className="flex items-center gap-2 mb-1">
                        <BarChart3 className="h-4 w-4 text-gray-600" />
                        <h3 className="text-sm font-bold text-gray-900">{t('reports.menuEngineeringMatrix')}</h3>
                    </div>
                    <p className="text-[10px] text-gray-600 mb-4">{t('reports.menuEngineeringDesc')}</p>
                    {!isPaid ? (
                        <UpgradeGate description={t('reports.menuEngineeringGateDesc')} />
                    ) : engineered.length < 2 ? (
                        <div className="py-12 text-center text-gray-600 text-xs">{t('reports.needTwoItemsMinimum')}</div>
                    ) : (
                        <MenuEngineeringMatrix items={engineered} t={t} locale={locale} dir={dir} />
                    )}
                </div>
            </div>

            {/* Reviews by topic — paid tier */}
            <div className={cn("bg-white border border-gray-100 rounded-2xl p-4", !isPaid && "relative")}>
                <div className="flex items-center gap-2 mb-3">
                    <Star className="h-4 w-4 text-gray-600" />
                    <h3 className="text-sm font-bold text-gray-900">{t('reports.whatCustomersSayTitle')}</h3>
                </div>
                {!isPaid ? (
                    <UpgradeGate description={t('reports.reviewTopicsGateDesc')} />
                ) : reviewComments.length === 0 ? (
                    <div className="py-10 text-center text-gray-600 text-xs">{t('reports.notEnoughComments')}</div>
                ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {REVIEW_TAGS.map(tag => {
                            const count = topicCounts[tag.id];
                            const isTop = count === topicMax && count > 0;
                            return (
                                <div
                                    key={tag.id}
                                    className={cn(
                                        "rounded-xl p-3 text-center border",
                                        isTop ? "bg-[#2a78d6]/5 border-[#2a78d6]/20" : "bg-gray-50 border-gray-100",
                                    )}
                                >
                                    <p className={cn("text-xl font-black", isTop ? "text-[#2a78d6]" : "text-gray-900")}>{count}</p>
                                    <p className="text-[10px] text-gray-600 mt-0.5">{t(tag.labelKey)}</p>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* سمعتك — restaurant reviews and product reviews, each with a visibility toggle */}
            <div className="bg-white border border-gray-100 rounded-2xl p-5">
                <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
                    <div className="flex items-center gap-2">
                        <Eye className="h-4 w-4 text-gray-600" />
                        <h3 className="text-sm font-bold text-gray-900">{t('reports.reputationTitle')}</h3>
                    </div>
                    <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
                        <button
                            type="button"
                            onClick={() => setReputationTab('restaurant')}
                            className={cn("px-3 h-7 rounded-md text-[11px] font-bold transition-all", reputationTab === 'restaurant' ? "bg-white text-gray-900 shadow-sm" : "text-gray-600")}
                        >
                            {t('reports.reputationTabRestaurant')} ({fullReviews.length})
                        </button>
                        <button
                            type="button"
                            onClick={() => setReputationTab('products')}
                            className={cn("px-3 h-7 rounded-md text-[11px] font-bold transition-all", reputationTab === 'products' ? "bg-white text-gray-900 shadow-sm" : "text-gray-600")}
                        >
                            {t('reports.reputationTabProducts')} ({itemReviews.length})
                        </button>
                    </div>
                </div>

                <div className="flex items-center gap-1 bg-gray-50 border border-gray-100 p-1 rounded-lg w-fit mb-3">
                    {([
                        ['newest', 'reports.reviewSortNewest'],
                        ['rating_desc', 'reports.reviewSortHighest'],
                        ['rating_asc', 'reports.reviewSortLowest'],
                    ] as [ReviewSort, string][]).map(([sort, labelKey]) => (
                        <button
                            key={sort}
                            type="button"
                            onClick={() => setReviewSort(sort)}
                            className={cn("px-2.5 h-6 rounded-md text-[10px] font-bold transition-all", reviewSort === sort ? "bg-white text-gray-900 shadow-sm" : "text-gray-600")}
                        >
                            {t(labelKey)}
                        </button>
                    ))}
                </div>

                {reputationTab === 'restaurant' ? (
                    sortedFullReviews.length === 0 ? (
                        <div className="py-10 text-center text-gray-600 text-xs">{t('reports.noReviewsYet')}</div>
                    ) : (
                        <div className="space-y-2 max-h-[28rem] overflow-y-auto">
                            {sortedFullReviews.map(review => {
                                const isVisible = review.is_visible !== false;
                                return (
                                    <div key={review.id} className="border border-gray-100 rounded-xl p-3">
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="flex gap-0.5 shrink-0">
                                                {[1, 2, 3, 4, 5].map(s => (
                                                    <Star key={s} className={cn("h-3 w-3", review.rating >= s ? "text-amber-400 fill-amber-400" : "text-gray-200")} />
                                                ))}
                                            </div>
                                            <span className="text-[9px] text-gray-600 shrink-0">
                                                {review.created_at ? formatDistanceToNow(new Date(review.created_at), { addSuffix: true, locale: locale === 'ar' ? ar : undefined }) : ''}
                                            </span>
                                        </div>
                                        {review.comment && <p className="text-[11px] text-gray-600 mt-2 leading-relaxed">{review.comment}</p>}
                                        <div className="flex items-center justify-end gap-2 mt-2 pt-2 border-t border-gray-50">
                                            <span className="text-[9px] text-gray-600">{isVisible ? t('reports.reviewVisible') : t('reports.reviewHidden')}</span>
                                            <button
                                                type="button"
                                                onClick={() => handleVisibilityToggle(review.id, !isVisible)}
                                                disabled={isTogglingVisibility === review.id}
                                                className={cn("relative w-9 h-5 rounded-full transition-colors", isVisible ? "bg-gray-900" : "bg-gray-200")}
                                            >
                                                <span className={cn("absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform", isVisible ? "right-0.5" : "right-[18px]")} />
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )
                ) : (
                    sortedItemReviews.length === 0 ? (
                        <div className="py-10 text-center text-gray-600 text-xs">{t('reports.noProductReviewsYet')}</div>
                    ) : (
                        <div className="space-y-2 max-h-[28rem] overflow-y-auto">
                            {sortedItemReviews.map(review => {
                                const isVisible = review.is_visible !== false;
                                return (
                                    <div key={review.id} className="border border-gray-100 rounded-xl p-3">
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="flex items-center gap-2 min-w-0">
                                                <div className="flex gap-0.5 shrink-0">
                                                    {[1, 2, 3, 4, 5].map(s => (
                                                        <Star key={s} className={cn("h-3 w-3", review.rating >= s ? "text-amber-400 fill-amber-400" : "text-gray-200")} />
                                                    ))}
                                                </div>
                                                <span className="text-[10px] font-bold text-gray-700 truncate">{itemNameOf(review.menu_item_id) || t('reports.deletedItem')}</span>
                                            </div>
                                            <span className="text-[9px] text-gray-600 shrink-0">
                                                {review.created_at ? formatDistanceToNow(new Date(review.created_at), { addSuffix: true, locale: locale === 'ar' ? ar : undefined }) : ''}
                                            </span>
                                        </div>
                                        {review.comment && <p className="text-[11px] text-gray-600 mt-2 leading-relaxed">{review.comment}</p>}
                                        <div className="flex items-center justify-end gap-2 mt-2 pt-2 border-t border-gray-50">
                                            <span className="text-[9px] text-gray-600">{isVisible ? t('reports.reviewVisible') : t('reports.reviewHidden')}</span>
                                            <button
                                                type="button"
                                                onClick={() => handleItemVisibilityToggle(review.id, !isVisible)}
                                                disabled={isTogglingVisibility === review.id}
                                                className={cn("relative w-9 h-5 rounded-full transition-colors", isVisible ? "bg-gray-900" : "bg-gray-200")}
                                            >
                                                <span className={cn("absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform", isVisible ? "right-0.5" : "right-[18px]")} />
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )
                )}
            </div>
        </div>
    );
}

function UpgradeGate({ description }: { description: string }) {
    const { t } = useLanguage();
    return (
        <div className="py-10 text-center space-y-4">
            <div className="w-14 h-14 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto">
                <Crown className="h-6 w-6 text-gray-600" />
            </div>
            <div className="space-y-1">
                <p className="text-sm font-bold text-gray-900">{t('reports.availableOnPaidPlans')}</p>
                <p className="text-[10px] text-gray-600 max-w-xs mx-auto">{description}</p>
            </div>
            <Button asChild size="sm" className="h-9 rounded-xl bg-gray-900 text-white hover:bg-gray-800 font-bold text-xs px-6">
                <Link href="/pricing">{t('reports.upgradeAccount')}</Link>
            </Button>
        </div>
    );
}

function MenuEngineeringMatrix({ items, t, locale, dir }: { items: (AnalyzedItem & { classification: MenuClassification })[]; t: (key: string) => string; locale: string; dir: string }) {
    const size = 300;
    const pad = 28;
    const maxPop = Math.max(1, ...items.map(i => i.popularity));
    const maxMargin = Math.max(10, ...items.map(i => Math.max(0, i.profitMargin)));
    const avgPop = items.reduce((s, i) => s + i.popularity, 0) / items.length;
    const avgMargin = items.reduce((s, i) => s + i.profitMargin, 0) / items.length;

    const x = (pop: number) => pad + (pop / maxPop) * (size - pad * 2);
    const y = (margin: number) => size - pad - (Math.max(0, margin) / maxMargin) * (size - pad * 2);
    const splitX = x(avgPop);
    const splitY = y(avgMargin);

    const byClass = items.reduce((acc, i) => {
        (acc[i.classification] ||= []).push(i);
        return acc;
    }, {} as Record<MenuClassification, typeof items>);

    // label only the strongest point in each quadrant to avoid clutter
    const labeled = new Set(
        (Object.keys(byClass) as MenuClassification[]).map(cls => {
            const arr = byClass[cls];
            const top = [...arr].sort((a, b) => (b.popularity + b.profitMargin) - (a.popularity + a.profitMargin))[0];
            return top.id;
        })
    );

    return (
        <div>
            <svg viewBox={`0 0 ${size} ${size}`} className="w-full max-w-[300px] mx-auto">
                {/* quadrant zones */}
                <rect x={splitX} y={pad} width={size - pad - splitX} height={splitY - pad} fill={CLASSIFICATION_INFO.star.color} opacity="0.06" />
                <rect x={pad} y={pad} width={splitX - pad} height={splitY - pad} fill={CLASSIFICATION_INFO.puzzle.color} opacity="0.06" />
                <rect x={splitX} y={splitY} width={size - pad - splitX} height={size - pad - splitY} fill={CLASSIFICATION_INFO['plow-horse'].color} opacity="0.06" />
                <rect x={pad} y={splitY} width={splitX - pad} height={size - pad - splitY} fill={CLASSIFICATION_INFO.dog.color} opacity="0.06" />

                <line x1={splitX} y1={pad} x2={splitX} y2={size - pad} stroke="#c3c2b7" strokeWidth="1" strokeDasharray="3,3" />
                <line x1={pad} y1={splitY} x2={size - pad} y2={splitY} stroke="#c3c2b7" strokeWidth="1" strokeDasharray="3,3" />
                <line x1={pad} y1={size - pad} x2={size - pad} y2={size - pad} stroke="#c3c2b7" strokeWidth="1" />
                <line x1={pad} y1={pad} x2={pad} y2={size - pad} stroke="#c3c2b7" strokeWidth="1" />

                <text x={size - pad} y={size - pad + 14} textAnchor="end" fontSize="9" fill="#898781">{t('reports.morePopularAxis')}</text>
                <text x={pad} y={pad - 8} textAnchor="start" fontSize="9" fill="#898781">{t('reports.higherProfitAxis')}</text>

                {items.map(item => (
                    <g key={item.id}>
                        <circle cx={x(item.popularity)} cy={y(item.profitMargin)} r="5.5" fill={CLASSIFICATION_INFO[item.classification].color} stroke="white" strokeWidth="1.5">
                            <title>{`${(dir === 'ltr' && item.name_en) || item.name} — ${t(CLASSIFICATION_INFO[item.classification].labelKey)} (${t('reports.popularityWord')} ${item.popularity}${locale === 'ar' ? '،' : ','} ${t('reports.profitabilityWord')} ${item.profitMargin.toFixed(0)}%)`}</title>
                        </circle>
                        {labeled.has(item.id) && (
                            <text x={x(item.popularity) + 8} y={y(item.profitMargin) + 3} fontSize="9" fontWeight="700" fill="#0b0b0b">{(dir === 'ltr' && item.name_en) || item.name}</text>
                        )}
                    </g>
                ))}
            </svg>

            {/* legend */}
            <div className="grid grid-cols-2 gap-2 mt-4">
                {(Object.keys(CLASSIFICATION_INFO) as MenuClassification[]).filter(cls => byClass[cls]?.length).map(cls => (
                    <div key={cls} className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: CLASSIFICATION_INFO[cls].color }} />
                        <span className="text-[10px] text-gray-600 font-medium">{t(CLASSIFICATION_INFO[cls].labelKey)} ({byClass[cls].length})</span>
                    </div>
                ))}
            </div>

            {/* advice for the quadrant with the most items */}
            {(() => {
                const dominant = (Object.keys(byClass) as MenuClassification[]).sort((a, b) => (byClass[b]?.length || 0) - (byClass[a]?.length || 0))[0];
                if (!dominant || !byClass[dominant]?.length) return null;
                return (
                    <p className="text-[11px] text-gray-600 leading-relaxed mt-4 pt-4 border-t border-gray-100">
                        <span className="font-bold text-gray-700">{t(CLASSIFICATION_INFO[dominant].labelKey)}: </span>
                        {t(CLASSIFICATION_INFO[dominant].adviceKey)}
                    </p>
                );
            })()}
        </div>
    );
}
