'use client';

import { useEffect, useState, useMemo, useTransition } from 'react';
import { useUser } from '@/hooks/useUser';
import { supabase } from '@/lib/supabase';
import { formatDistanceToNow } from 'date-fns';
import { ar } from 'date-fns/locale';

import { Skeleton } from "@/components/ui/skeleton";
import {
  Star, MessageCircle, TrendingUp, ThumbsUp, ThumbsDown, Lightbulb,
  BarChart3, Globe, Smartphone, Monitor, Tablet, MapPin, Phone,
  MessageSquare, ExternalLink, Eye, EyeOff, Users, MousePointerClick,
  Calendar, ArrowUpRight, ArrowDownRight, Filter
} from "lucide-react";
import StatCard from '@/components/dashboard/StatCard';
import { analyzeReviewsLocally, type ReviewAnalysisResult } from '@/lib/reviews-analyzer';
import { syncPublicPage } from '@/lib/public-pages';
import { useLanguage } from '@/components/shared/LanguageContext';

interface Review {
  id: string;
  rating: number;
  comment?: string;
  created_at: string | null;
  is_visible?: boolean;
  source?: string;
  source_detail?: string;
}

interface PageEvent {
  id: string;
  event_type: string;
  event_detail: string | null;
  device_type: string | null;
  created_at: string;
}

const SOURCE_LABELS: Record<string, { labelKey: string; icon: string; color: string }> = {
  direct: { labelKey: 'ownerReviews.sourceDirect', icon: '🔗', color: '#6366f1' },
  google: { labelKey: 'ownerReviews.sourceGoogle', icon: '🔍', color: '#4285f4' },
  social: { labelKey: 'ownerReviews.sourceSocial', icon: '📱', color: '#e4405f' },
  delivery: { labelKey: 'ownerReviews.sourceDelivery', icon: '🛵', color: '#f59e0b' },
  app: { labelKey: 'ownerReviews.sourceApp', icon: '📲', color: '#10b981' },
  branch: { labelKey: 'ownerReviews.sourceBranch', icon: '📍', color: '#8b5cf6' },
  qr: { labelKey: 'ownerReviews.sourceQr', icon: '⬜', color: '#64748b' },
  other: { labelKey: 'ownerReviews.sourceOther', icon: '🌐', color: '#94a3b8' },
};

const EVENT_LABELS: Record<string, { labelKey: string; icon: React.ReactNode; color: string }> = {
  app_click: { labelKey: 'ownerReviews.eventAppClick', icon: <MousePointerClick className="h-3.5 w-3.5" />, color: '#10b981' },
  delivery_click: { labelKey: 'ownerReviews.eventDeliveryClick', icon: <ExternalLink className="h-3.5 w-3.5" />, color: '#f59e0b' },
  social_click: { labelKey: 'ownerReviews.eventSocialClick', icon: <MessageSquare className="h-3.5 w-3.5" />, color: '#e4405f' },
  maps_click: { labelKey: 'ownerReviews.eventMapsClick', icon: <MapPin className="h-3.5 w-3.5" />, color: '#4285f4' },
  phone_click: { labelKey: 'ownerReviews.eventPhoneClick', icon: <Phone className="h-3.5 w-3.5" />, color: '#6366f1' },
  whatsapp_click: { labelKey: 'ownerReviews.eventWhatsappClick', icon: <MessageSquare className="h-3.5 w-3.5" />, color: '#25d366' },
  page_view: { labelKey: 'ownerReviews.eventPageView', icon: <Eye className="h-3.5 w-3.5" />, color: '#94a3b8' },
  branch_view: { labelKey: 'ownerReviews.eventBranchView', icon: <MapPin className="h-3.5 w-3.5" />, color: '#8b5cf6' },
};

interface MenuItemReview {
  id: string;
  menu_item_id: string;
  rating: number;
  comment?: string;
  created_at: string | null;
  is_visible?: boolean;
}

export default function ReviewsPage() {
  const { user, isLoading: isUserLoading } = useUser();
  const { t, dir } = useLanguage();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [itemReviews, setItemReviews] = useState<MenuItemReview[]>([]);
  const [itemNames, setItemNames] = useState<Record<string, string>>({});
  const [events, setEvents] = useState<PageEvent[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [updatingVisibility, startVisibilityUpdate] = useTransition();
  const [updatingItemVisibility, startItemVisibilityUpdate] = useTransition();
  const [activeTab, setActiveTab] = useState<'overview' | 'sources' | 'events' | 'reviews' | 'products'>('overview');

  const fetchItemReviews = async () => {
    if (!user?.restaurantId) return;
    const [itemReviewsRes, itemsRes] = await Promise.all([
      supabase.from('menu_item_reviews').select('*').eq('restaurant_id', user.restaurantId).order('created_at', { ascending: false }),
      supabase.from('menu_items').select('id, name').eq('restaurant_id', user.restaurantId),
    ]);
    if (!itemReviewsRes.error) setItemReviews((itemReviewsRes.data || []) as MenuItemReview[]);
    if (!itemsRes.error) {
      const names: Record<string, string> = {};
      (itemsRes.data || []).forEach((i: any) => { names[i.id] = i.name; });
      setItemNames(names);
    }
  };

  const handleItemVisibilityToggle = (reviewId: string, newVisibility: boolean) => {
    startItemVisibilityUpdate(async () => {
      const { error } = await supabase.from('menu_item_reviews').update({ is_visible: newVisibility }).eq('id', reviewId);
      if (error) return;
      fetchItemReviews();
      if (user?.restaurantId) syncPublicPage(user.restaurantId).catch(() => {});
    });
  };

  const fetchReviews = async () => {
    if (!user?.restaurantId) return;
    setIsLoadingData(true);
    const { data, error } = await supabase
      .from('reviews')
      .select('*')
      .eq('restaurant_id', user.restaurantId)
      .order('created_at', { ascending: false });
    if (!error) setReviews((data || []) as Review[]);
    setIsLoadingData(false);
  };

  const fetchEvents = async () => {
    if (!user?.restaurantId) return;
    const { data, error } = await supabase
      .from('page_events')
      .select('*')
      .eq('restaurant_id', user.restaurantId)
      .order('created_at', { ascending: false })
      .limit(500);
    if (!error) setEvents((data || []) as PageEvent[]);
  };

  useEffect(() => {
    if (user?.restaurantId) {
      fetchReviews();
      fetchEvents();
      fetchItemReviews();
      const channel = supabase
        .channel(`reviews-${user.restaurantId}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'reviews', filter: `restaurant_id=eq.${user.restaurantId}` }, fetchReviews)
        .subscribe();
      const eventsChannel = supabase
        .channel(`events-${user.restaurantId}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'page_events', filter: `restaurant_id=eq.${user.restaurantId}` }, fetchEvents)
        .subscribe();
      const itemReviewsChannel = supabase
        .channel(`item-reviews-${user.restaurantId}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'menu_item_reviews', filter: `restaurant_id=eq.${user.restaurantId}` }, fetchItemReviews)
        .subscribe();
      return () => { supabase.removeChannel(channel); supabase.removeChannel(eventsChannel); supabase.removeChannel(itemReviewsChannel); };
    } else if (!isUserLoading) {
      setIsLoadingData(false);
    }
    return undefined;
  }, [user, isUserLoading]);

  const stats = useMemo(() => {
    if (reviews.length === 0) return { totalReviews: 0, averageRating: 0, distribution: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 } };
    const totalReviews = reviews.length;
    const totalRating = reviews.reduce((sum, r) => sum + (r.rating || 0), 0);
    const averageRating = totalRating / totalReviews;
    const distribution = reviews.reduce((acc, r) => {
      const rating = Math.floor(r.rating || 0);
      if (rating >= 1 && rating <= 5) acc[rating as keyof typeof acc]++;
      return acc;
    }, { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 });
    return { totalReviews, averageRating, distribution };
  }, [reviews]);

  const analysis = useMemo<ReviewAnalysisResult | null>(() => {
    if (reviews.length === 0) return null;
    return analyzeReviewsLocally(reviews.map(r => ({ rating: r.rating, comment: r.comment })), t);
  }, [reviews, t]);

  const sourceStats = useMemo(() => {
    const counts: Record<string, number> = {};
    reviews.forEach(r => {
      const src = r.source || 'direct';
      counts[src] = (counts[src] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([source, count]) => ({
        source,
        count,
        pct: Math.round((count / reviews.length) * 100),
        ...SOURCE_LABELS[source] || SOURCE_LABELS.other,
      }))
      .sort((a, b) => b.count - a.count);
  }, [reviews]);

  const eventStats = useMemo(() => {
    const counts: Record<string, number> = {};
    events.forEach(e => {
      counts[e.event_type] = (counts[e.event_type] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([type, count]) => ({
        type,
        count,
        ...EVENT_LABELS[type] || { label: type, icon: null, color: '#94a3b8' },
      }))
      .sort((a, b) => b.count - a.count);
  }, [events]);

  const deviceStats = useMemo(() => {
    const counts: Record<string, number> = { mobile: 0, desktop: 0, tablet: 0 };
    events.forEach(e => {
      const d = e.device_type || 'mobile';
      counts[d] = (counts[d] || 0) + 1;
    });
    const total = events.length || 1;
    return [
      { device: t('ownerReviews.deviceMobile'), count: counts.mobile, pct: Math.round((counts.mobile / total) * 100), icon: <Smartphone className="h-3.5 w-3.5" /> },
      { device: t('ownerReviews.deviceDesktop'), count: counts.desktop, pct: Math.round((counts.desktop / total) * 100), icon: <Monitor className="h-3.5 w-3.5" /> },
      { device: t('ownerReviews.deviceTablet'), count: counts.tablet, pct: Math.round((counts.tablet / total) * 100), icon: <Tablet className="h-3.5 w-3.5" /> },
    ];
  }, [events, t]);

  const weeklyActivity = useMemo(() => {
    const days = [
      t('ownerReviews.daySun'), t('ownerReviews.dayMon'), t('ownerReviews.dayTue'), t('ownerReviews.dayWed'),
      t('ownerReviews.dayThu'), t('ownerReviews.dayFri'), t('ownerReviews.daySat'),
    ];
    const counts = new Array(7).fill(0);
    events.forEach(e => {
      const d = new Date(e.created_at).getDay();
      counts[d]++;
    });
    const max = Math.max(...counts, 1);
    return days.map((day, i) => ({ day, count: counts[i], pct: Math.round((counts[i] / max) * 100) }));
  }, [events, t]);

  const handleVisibilityToggle = (reviewId: string, newVisibility: boolean) => {
    startVisibilityUpdate(async () => {
      const { error } = await supabase.from('reviews').update({ is_visible: newVisibility }).eq('id', reviewId);
      if (error) return;
      fetchReviews();
      if (user?.restaurantId) syncPublicPage(user.restaurantId).catch(() => {});
    });
  };

  const loading = isUserLoading || isLoadingData;
  const alignEnd = dir === 'rtl' ? 'text-left' : 'text-right';

  if (loading) {
    return (
      <div className="space-y-5">
        <div className="h-8 w-48 bg-gray-100 rounded-xl" />
        <div className="grid gap-3 md:grid-cols-4"><Skeleton className="h-24 rounded-2xl" /><Skeleton className="h-24 rounded-2xl" /><Skeleton className="h-24 rounded-2xl" /><Skeleton className="h-24 rounded-2xl" /></div>
        <Skeleton className="h-80 rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-lg font-black text-gray-900">{t('ownerReviews.title')}</h1>
        <p className="text-xs text-gray-600 mt-0.5">{t('ownerReviews.subtitle')}</p>
      </div>

      {/* Overview Stats */}
      <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
        <StatCard title={t('ownerReviews.statReviews')} value={stats.totalReviews.toString()} icon={MessageCircle} />
        <StatCard title={t('ownerReviews.statAverageRating')} value={stats.averageRating.toFixed(1)} icon={Star} />
        <StatCard title={t('ownerReviews.statVisits')} value={events.filter(e => e.event_type === 'page_view').length.toString()} icon={Eye} />
        <StatCard title={t('ownerReviews.statClicks')} value={events.filter(e => e.event_type !== 'page_view').length.toString()} icon={MousePointerClick} />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl">
        {[
          { id: 'overview', label: t('ownerReviews.tabOverview') },
          { id: 'sources', label: t('ownerReviews.tabSources') },
          { id: 'events', label: t('ownerReviews.tabEvents') },
          { id: 'reviews', label: t('ownerReviews.tabReviews') },
          { id: 'products', label: t('ownerReviews.tabProducts') },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as typeof activeTab)}
            className={`flex-1 h-9 rounded-lg text-xs font-bold transition-all ${
              activeTab === tab.id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-600'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div className="space-y-4">
          {/* Sentiment */}
          {analysis && (
            <div className="bg-white border border-gray-100 rounded-2xl p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-gray-900">{t('ownerReviews.satisfactionIndex')}</h3>
                <span className="text-lg">{analysis.overallEmoji}</span>
              </div>
              <div className="h-3 bg-gray-100 rounded-full overflow-hidden mb-2">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${analysis.sentimentScore}%`,
                    background: analysis.sentimentScore >= 70
                      ? 'linear-gradient(90deg, #10b981, #059669)'
                      : analysis.sentimentScore >= 40
                        ? 'linear-gradient(90deg, #f59e0b, #d97706)'
                        : 'linear-gradient(90deg, #ef4444, #dc2626)',
                  }}
                />
              </div>
              <p className="text-[11px] text-gray-600 text-center">{analysis.sentimentLabel} — {analysis.sentimentScore}%</p>
            </div>
          )}

          {/* Strengths & Weaknesses */}
          {analysis && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="bg-white border border-gray-100 rounded-2xl p-4">
                <h4 className="text-[11px] font-bold text-emerald-700 mb-2 flex items-center gap-1">
                  <ThumbsUp className="h-3 w-3" />{t('ownerReviews.strengthsTitle')}
                </h4>
                {analysis.positiveThemes.length === 0 ? (
                  <p className="text-[10px] text-gray-600">{t('ownerReviews.noneYet')}</p>
                ) : (
                  <ul className="space-y-1">
                    {analysis.positiveThemes.map((theme, i) => <li key={i} className="text-[10px] text-gray-600">• {theme}</li>)}
                  </ul>
                )}
              </div>
              <div className="bg-white border border-gray-100 rounded-2xl p-4">
                <h4 className="text-[11px] font-bold text-red-700 mb-2 flex items-center gap-1">
                  <ThumbsDown className="h-3 w-3" />{t('ownerReviews.improvementsTitle')}
                </h4>
                {analysis.negativeThemes.length === 0 ? (
                  <p className="text-[10px] text-gray-600">{t('ownerReviews.noNegativeFeedback')}</p>
                ) : (
                  <ul className="space-y-1">
                    {analysis.negativeThemes.map((theme, i) => <li key={i} className="text-[10px] text-gray-600">• {theme}</li>)}
                  </ul>
                )}
              </div>
            </div>
          )}

          {/* Distribution */}
          <div className="bg-white border border-gray-100 rounded-2xl p-5">
            <h3 className="text-sm font-bold text-gray-900 mb-4">{t('ownerReviews.distributionTitle')}</h3>
            <div className="space-y-3">
              {[5, 4, 3, 2, 1].map(star => (
                <div key={star} className="flex items-center gap-3">
                  <span className="text-[10px] font-bold text-gray-600 w-4">{star}</span>
                  <Star className="h-3 w-3 text-amber-400 fill-amber-400" />
                  <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-amber-400 rounded-full transition-all"
                      style={{ width: `${stats.totalReviews > 0 ? (stats.distribution[star as keyof typeof stats.distribution] / stats.totalReviews) * 100 : 0}%` }} />
                  </div>
                  <span className={`text-[10px] text-gray-600 w-6 ${alignEnd}`}>{stats.distribution[star as keyof typeof stats.distribution]}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Topic Breakdown */}
          {analysis && analysis.topicBreakdown.some(topic => topic.positive + topic.negative + topic.neutral > 0) && (
            <div className="bg-white border border-gray-100 rounded-2xl p-5">
              <h3 className="text-sm font-bold text-gray-900 mb-3">{t('ownerReviews.topicAnalysisTitle')}</h3>
              <div className="space-y-2">
                {analysis.topicBreakdown.filter(topic => topic.positive + topic.negative + topic.neutral > 0).map((topic, i) => {
                  const total = topic.positive + topic.negative + topic.neutral;
                  const posPct = Math.round((topic.positive / total) * 100);
                  return (
                    <div key={i} className="flex items-center gap-2">
                      <span className="text-[10px] font-medium text-gray-600 w-14">{topic.topic}</span>
                      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-emerald-400 rounded-full" style={{ width: `${posPct}%` }} />
                      </div>
                      <span className={`text-[9px] text-gray-600 w-10 ${alignEnd}`}>{posPct}%</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Recommendation */}
          {analysis && (
            <div className="bg-white border border-gray-100 rounded-2xl p-4">
              <h4 className="text-[11px] font-bold text-gray-700 mb-1 flex items-center gap-1">
                <Lightbulb className="h-3 w-3" />{t('ownerReviews.recommendationTitle')}
              </h4>
              <p className="text-[10px] text-gray-600 leading-relaxed">{analysis.recommendation}</p>
            </div>
          )}
        </div>
      )}

      {activeTab === 'sources' && (
        <div className="space-y-4">
          {/* Source Breakdown */}
          <div className="bg-white border border-gray-100 rounded-2xl p-5">
            <h3 className="text-sm font-bold text-gray-900 mb-4">{t('ownerReviews.sourcesBreakdownTitle')}</h3>
            {sourceStats.length === 0 ? (
              <p className="text-xs text-gray-600 text-center py-6">{t('ownerReviews.noDataAvailable')}</p>
            ) : (
              <div className="space-y-3">
                {sourceStats.map(s => (
                  <div key={s.source} className="flex items-center gap-3">
                    <span className="text-lg">{s.icon}</span>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[11px] font-bold text-gray-700">{t(s.labelKey)}</span>
                        <span className="text-[10px] text-gray-600">{s.count} ({s.pct}%)</span>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all" style={{ width: `${s.pct}%`, backgroundColor: s.color }} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Device Stats */}
          <div className="bg-white border border-gray-100 rounded-2xl p-5">
            <h3 className="text-sm font-bold text-gray-900 mb-4">{t('ownerReviews.devicesTitle')}</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {deviceStats.map(d => (
                <div key={d.device} className="text-center p-3 bg-gray-50 rounded-xl">
                  <div className="flex justify-center mb-1 text-gray-600">{d.icon}</div>
                  <p className="text-lg font-black text-gray-900">{d.count}</p>
                  <p className="text-[10px] text-gray-600">{d.device} ({d.pct}%)</p>
                </div>
              ))}
            </div>
          </div>

          {/* Weekly Activity */}
          <div className="bg-white border border-gray-100 rounded-2xl p-5">
            <h3 className="text-sm font-bold text-gray-900 mb-4">{t('ownerReviews.weeklyActivityTitle')}</h3>
            <div className="space-y-2">
              {weeklyActivity.map(d => (
                <div key={d.day} className="flex items-center gap-2">
                  <span className="text-[10px] font-medium text-gray-600 w-12">{d.day}</span>
                  <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-400 rounded-full transition-all" style={{ width: `${d.pct}%` }} />
                  </div>
                  <span className={`text-[9px] text-gray-600 w-6 ${alignEnd}`}>{d.count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'events' && (
        <div className="bg-white border border-gray-100 rounded-2xl p-5">
          <h3 className="text-sm font-bold text-gray-900 mb-4">{t('ownerReviews.recentEventsTitle')}</h3>
          {eventStats.length === 0 ? (
            <p className="text-xs text-gray-600 text-center py-6">{t('ownerReviews.noEventsYet')}</p>
          ) : (
            <div className="space-y-2">
              {eventStats.map(e => (
                <div key={e.type} className="flex items-center gap-3 p-2 bg-gray-50 rounded-xl">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${e.color}15`, color: e.color }}>
                    {e.icon}
                  </div>
                  <div className="flex-1">
                    <span className="text-[11px] font-bold text-gray-700">{e.labelKey ? t(e.labelKey) : e.type}</span>
                  </div>
                  <span className="text-sm font-black text-gray-900">{e.count}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'reviews' && (
        <div className="bg-white border border-gray-100 rounded-2xl p-5">
          <h3 className="text-sm font-bold text-gray-900 mb-4">{t('ownerReviews.allReviewsTitle')}</h3>
          <div className="space-y-3 max-h-[32rem] overflow-y-auto">
            {reviews.length === 0 ? (
              <p className="text-xs text-gray-600 text-center py-8">{t('ownerReviews.noReviewsYet')}</p>
            ) : reviews.map(review => {
              const isVisible = review.is_visible !== false;
              const src = SOURCE_LABELS[review.source || 'direct'] || SOURCE_LABELS.direct;
              return (
                <div key={review.id} className="border border-gray-100 rounded-xl p-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <div className="flex gap-0.5">
                        {[1, 2, 3, 4, 5].map(s => (
                          <Star key={s} className={`h-3 w-3 ${review.rating >= s ? 'text-amber-400 fill-amber-400' : 'text-gray-200'}`} />
                        ))}
                      </div>
                      <span className="text-[9px] px-1.5 py-0.5 rounded-full font-medium" style={{ backgroundColor: `${src.color}15`, color: src.color }}>
                        {src.icon} {t(src.labelKey)}
                      </span>
                    </div>
                    <span className="text-[9px] text-gray-600">
                      {review.created_at ? formatDistanceToNow(new Date(review.created_at), { addSuffix: true, locale: dir === 'rtl' ? ar : undefined }) : ''}
                    </span>
                  </div>
                  {review.comment && <p className="text-[11px] text-gray-600 mt-2 leading-relaxed">{review.comment}</p>}
                  <div className="flex items-center justify-end gap-2 mt-2 pt-2 border-t border-gray-50">
                    <span className="text-[9px] text-gray-600">{isVisible ? t('ownerReviews.visible') : t('ownerReviews.hidden')}</span>
                    <button
                      onClick={() => handleVisibilityToggle(review.id, !isVisible)}
                      disabled={updatingVisibility}
                      className={`relative w-9 h-5 rounded-full transition-colors ${isVisible ? 'bg-gray-900' : 'bg-gray-200'}`}
                    >
                      <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${isVisible ? 'right-0.5' : 'right-[18px]'}`} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {activeTab === 'products' && (
        <div className="bg-white border border-gray-100 rounded-2xl p-5">
          <h3 className="text-sm font-bold text-gray-900 mb-4">{t('ownerReviews.productReviewsTitle')}</h3>
          <div className="space-y-3 max-h-[32rem] overflow-y-auto">
            {itemReviews.length === 0 ? (
              <p className="text-xs text-gray-600 text-center py-8">{t('ownerReviews.noProductReviewsYet')}</p>
            ) : itemReviews.map(review => {
              const isVisible = review.is_visible !== false;
              return (
                <div key={review.id} className="border border-gray-100 rounded-xl p-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <div className="flex gap-0.5">
                        {[1, 2, 3, 4, 5].map(s => (
                          <Star key={s} className={`h-3 w-3 ${review.rating >= s ? 'text-amber-400 fill-amber-400' : 'text-gray-200'}`} />
                        ))}
                      </div>
                      <span className="text-[10px] font-bold text-gray-600">{itemNames[review.menu_item_id] || t('ownerReviews.deletedItem')}</span>
                    </div>
                    <span className="text-[9px] text-gray-600">
                      {review.created_at ? formatDistanceToNow(new Date(review.created_at), { addSuffix: true, locale: dir === 'rtl' ? ar : undefined }) : ''}
                    </span>
                  </div>
                  {review.comment && <p className="text-[11px] text-gray-600 mt-2 leading-relaxed">{review.comment}</p>}
                  <div className="flex items-center justify-end gap-2 mt-2 pt-2 border-t border-gray-50">
                    <span className="text-[9px] text-gray-600">{isVisible ? t('ownerReviews.visible') : t('ownerReviews.hidden')}</span>
                    <button
                      onClick={() => handleItemVisibilityToggle(review.id, !isVisible)}
                      disabled={updatingItemVisibility}
                      className={`relative w-9 h-5 rounded-full transition-colors ${isVisible ? 'bg-gray-900' : 'bg-gray-200'}`}
                    >
                      <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${isVisible ? 'right-0.5' : 'right-[18px]'}`} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
