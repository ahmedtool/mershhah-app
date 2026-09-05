'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
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
    Info,
    MapPin,
    Search,
} from 'lucide-react';
import { useUser } from '@/hooks/useUser';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabase';
import type { MenuItem } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { Link } from 'wouter';
import { cn } from '@/lib/utils';
import { classifyMenuItems, CLASSIFICATION_INFO, type MenuClassification } from '@/lib/menu-engineering';
import { buildInsights, type Insight } from '@/lib/report-insights';
import { REVIEW_TAGS, countReviewsByTag } from '@/lib/review-tags';
import { WhatsAppIcon, InstagramIcon, SnapchatIcon, TikTokIcon, XIcon } from '@/components/shared/SocialIcons';
import {
    TRAFFIC_SOURCE_LABEL_KEYS,
    MARKETING_LINK_PLATFORMS,
    buildMarketingLink,
    type TrafficSource,
} from '@/lib/traffic-source';
import { useLanguage } from '@/components/shared/LanguageContext';

const KNOWN_TRAFFIC_SOURCES = new Set(Object.keys(TRAFFIC_SOURCE_LABEL_KEYS));

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

export default function InsightsHubPage() {
    const { user, isLoading: isUserLoading } = useUser();
    const { toast } = useToast();
    const { t, locale } = useLanguage();
    const [isLoadingData, setIsLoadingData] = useState(true);
    const [analysisData, setAnalysisData] = useState<AnalyzedItem[]>([]);
    const [totalClicks, setTotalClicks] = useState(0);
    const [hubVisitsQr, setHubVisitsQr] = useState(0);
    const [hubVisitsLink, setHubVisitsLink] = useState(0);
    const [sourceCounts, setSourceCounts] = useState<Partial<Record<TrafficSource, number>>>({});
    const [visitDates, setVisitDates] = useState<string[]>([]);
    const [reviewComments, setReviewComments] = useState<string[]>([]);
    const [restaurantRating, setRestaurantRating] = useState(0);
    const [restaurantReviewCount, setRestaurantReviewCount] = useState(0);
    const [hubUsername, setHubUsername] = useState<string | null>(null);
    const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
    const [hoveredDay, setHoveredDay] = useState<number | null>(null);

    const isPaid = user?.entitlements?.planId && user.entitlements.planId !== 'free' && user.entitlements.planId !== 'none';

    const fetchData = useCallback(async () => {
        if (!user?.restaurantId) return;
        try {
            const restaurantId = user.restaurantId;
            const [itemsRes, interactionsRes, hubVisitsRes, restRes, reviewsRes] = await Promise.all([
                supabase.from('menu_items').select('*').eq('restaurant_id', restaurantId),
                supabase.from('menu_item_interactions').select('menu_item_id').eq('restaurant_id', restaurantId),
                supabase.from('hub_visits').select('source, created_at').eq('restaurant_id', restaurantId).gte('created_at', new Date(Date.now() - TREND_DAYS * DAY_MS).toISOString()),
                supabase.from('restaurants').select('username, rating, review_count').eq('id', restaurantId).single(),
                supabase.from('reviews').select('comment').eq('restaurant_id', restaurantId).neq('is_visible', false).not('comment', 'is', null),
            ]);

            const items = (itemsRes.data || []) as MenuItem[];
            const interactions = interactionsRes.data || [];
            setTotalClicks(interactions.length);

            let qrCount = 0; let linkCount = 0;
            const dates: string[] = [];
            const sources: Partial<Record<TrafficSource, number>> = {};
            (hubVisitsRes.data || []).forEach((d: any) => {
                if (d.source === 'qr_branch') qrCount++; else linkCount++;
                if (d.created_at) dates.push(dayKey(new Date(d.created_at)));
                // Rows from before the per-platform traffic-source upgrade
                // stored a plain 'link' (or nothing) instead of a real
                // TrafficSource value - fall back to 'other' for anything
                // not in the known set instead of trusting the DB value,
                // which would otherwise flow into a t()/labelKey lookup as
                // an unrecognized key.
                const src = (KNOWN_TRAFFIC_SOURCES.has(d.source) ? d.source : 'other') as TrafficSource;
                sources[src] = (sources[src] || 0) + 1;
            });
            setHubVisitsQr(qrCount);
            setHubVisitsLink(linkCount);
            setSourceCounts(sources);
            setVisitDates(dates);

            const rest = restRes.data as any;
            setHubUsername(rest?.username || null);
            setRestaurantRating(rest?.rating || 0);
            setRestaurantReviewCount(rest?.review_count || 0);

            setReviewComments((reviewsRes.data || []).map((r: any) => r.comment).filter(Boolean));

            const popularityMap = new Map<string, number>();
            interactions.forEach((i: any) => popularityMap.set(i.menu_item_id, (popularityMap.get(i.menu_item_id) || 0) + 1));

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
        t,
    }), [engineered, weekChange, hubVisitsQr, hubVisitsLink, t]);

    const topicCounts = useMemo(() => countReviewsByTag(reviewComments), [reviewComments]);
    const topicMax = Math.max(1, ...Object.values(topicCounts));

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
        <div className="space-y-5 pb-20">
            <PageHeader title={t('reports.title')} description={t('reports.subtitle')} />

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
            <div className="bg-white border border-gray-100 rounded-2xl p-5">
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
            <div className={cn("bg-white border border-gray-100 rounded-2xl p-5", !isPaid && "relative")}>
                <div className="flex items-center gap-2 mb-4">
                    <Sparkles className="h-4 w-4 text-gray-600" />
                    <h3 className="text-sm font-bold text-gray-900">{t('reports.smartInsights')}</h3>
                </div>
                {!isPaid ? (
                    <UpgradeGate description={t('reports.smartInsightsGateDesc')} />
                ) : insights.length === 0 ? (
                    <div className="py-10 text-center text-gray-600 text-xs">{t('reports.needMoreDataForInsights')}</div>
                ) : (
                    <div className="space-y-2">
                        {insights.map(insight => (
                            <div key={insight.id} className={cn(
                                "flex items-start gap-3 p-3 rounded-xl border text-xs leading-relaxed",
                                insight.tone === 'good' && "bg-emerald-50/60 border-emerald-100 text-emerald-800",
                                insight.tone === 'warning' && "bg-amber-50/60 border-amber-100 text-amber-800",
                                insight.tone === 'neutral' && "bg-gray-50 border-gray-100 text-gray-600",
                            )}>
                                <Info className="h-3.5 w-3.5 shrink-0 mt-0.5 opacity-60" />
                                <span className="font-medium">{insight.text}</span>
                            </div>
                        ))}
                    </div>
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
                                        <span className="text-sm font-bold text-gray-900">{item.name}</span>
                                    </div>
                                    <span className="text-[10px] font-mono font-bold text-gray-600 bg-white border border-gray-100 px-2 py-0.5 rounded-md">{item.popularity}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Menu Engineering Matrix — paid tier */}
                <div className={cn("bg-white border border-gray-100 rounded-2xl p-5", !isPaid && "relative")}>
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
                        <MenuEngineeringMatrix items={engineered} t={t} locale={locale} />
                    )}
                </div>
            </div>

            {/* Reviews by topic — paid tier */}
            <div className={cn("bg-white border border-gray-100 rounded-2xl p-5", !isPaid && "relative")}>
                <div className="flex items-center gap-2 mb-4">
                    <Star className="h-4 w-4 text-gray-600" />
                    <h3 className="text-sm font-bold text-gray-900">{t('reports.whatCustomersSayTitle')}</h3>
                </div>
                {!isPaid ? (
                    <UpgradeGate description={t('reports.reviewTopicsGateDesc')} />
                ) : reviewComments.length === 0 ? (
                    <div className="py-10 text-center text-gray-600 text-xs">{t('reports.notEnoughComments')}</div>
                ) : (
                    <div className="space-y-3">
                        {REVIEW_TAGS.map(tag => {
                            const count = topicCounts[tag.id];
                            return (
                                <div key={tag.id} className="flex items-center gap-3">
                                    <span className="text-xs font-bold text-gray-600 w-14 shrink-0">{t(tag.labelKey)}</span>
                                    <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                                        <div className="h-full rounded-full bg-[#2a78d6] transition-all" style={{ width: `${(count / topicMax) * 100}%` }} />
                                    </div>
                                    <span className="text-[10px] font-mono font-bold text-gray-600 w-6 text-left">{count}</span>
                                </div>
                            );
                        })}
                    </div>
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

function MenuEngineeringMatrix({ items, t, locale }: { items: (AnalyzedItem & { classification: MenuClassification })[]; t: (key: string) => string; locale: string }) {
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
                            <title>{`${item.name} — ${t(CLASSIFICATION_INFO[item.classification].labelKey)} (${t('reports.popularityWord')} ${item.popularity}${locale === 'ar' ? '،' : ','} ${t('reports.profitabilityWord')} ${item.profitMargin.toFixed(0)}%)`}</title>
                        </circle>
                        {labeled.has(item.id) && (
                            <text x={x(item.popularity) + 8} y={y(item.profitMargin) + 3} fontSize="9" fontWeight="700" fill="#0b0b0b">{item.name}</text>
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
