'use client';

import { useEffect, useState, useMemo, useTransition } from 'react';
import { useUser } from '@/hooks/useUser';
import { supabase } from '@/lib/supabase';
import { formatDistanceToNow } from 'date-fns';
import { ar } from 'date-fns/locale';

import { Skeleton } from "@/components/ui/skeleton";
import { Star, MessageCircle, TrendingUp, ThumbsUp, ThumbsDown, Lightbulb, BarChart3 } from "lucide-react";
import StatCard from '@/components/dashboard/StatCard';
import { analyzeReviewsLocally, type ReviewAnalysisResult } from '@/lib/reviews-analyzer';

interface Review {
  id: string;
  rating: number;
  comment?: string;
  created_at: string | null;
  is_visible?: boolean;
}

const StarRating = ({ rating }: { rating: number }) => (
  <div className="flex gap-0.5">
    {[1, 2, 3, 4, 5].map((star) => (
      <Star key={star} className={`h-4 w-4 ${rating >= star ? 'text-amber-400 fill-amber-400' : 'text-gray-300'}`} />
    ))}
  </div>
);

export default function ReviewsPage() {
  const { user, isLoading: isUserLoading } = useUser();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [updatingVisibility, startVisibilityUpdate] = useTransition();

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

  useEffect(() => {
    if (user?.restaurantId) {
      fetchReviews();
      const channel = supabase
        .channel(`reviews-${user.restaurantId}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'reviews', filter: `restaurant_id=eq.${user.restaurantId}` }, fetchReviews)
        .subscribe();
      return () => { supabase.removeChannel(channel); };
    } else if (!isUserLoading) {
      setIsLoadingData(false);
    }
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
    return analyzeReviewsLocally(reviews.map(r => ({ rating: r.rating, comment: r.comment })));
  }, [reviews]);

  const handleVisibilityToggle = (reviewId: string, newVisibility: boolean) => {
    startVisibilityUpdate(async () => {
      const { error } = await supabase.from('reviews').update({ is_visible: newVisibility }).eq('id', reviewId);
      if (error) return;
      fetchReviews();
    });
  };

  const loading = isUserLoading || isLoadingData;

  if (loading) {
    return (
      <div className="space-y-5">
        <div className="h-8 w-48 bg-gray-100 rounded-xl" />
        <div className="grid gap-3 md:grid-cols-3"><Skeleton className="h-24 rounded-2xl" /><Skeleton className="h-24 rounded-2xl" /><Skeleton className="h-24 rounded-2xl" /></div>
        <Skeleton className="h-64 rounded-2xl" /><Skeleton className="h-64 rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-lg font-black text-gray-900">تقييمات العملاء</h1>
        <p className="text-xs text-gray-400 mt-0.5">تحليل تقريري لأراء عملائك</p>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <StatCard title="متوسط التقييم" value={stats.averageRating.toFixed(1)} icon={Star} change={`من ${stats.totalReviews} تقييم`} />
        <StatCard title="إجمالي التقييمات" value={stats.totalReviews.toString()} icon={MessageCircle} />
        <StatCard title="نسبة الرضا" value={`${analysis?.sentimentScore ?? 0}%`} icon={TrendingUp} change={analysis?.sentimentLabel || ''} />
      </div>

      {/* Analysis Report */}
      <div className="bg-white border border-gray-100 rounded-2xl p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 rounded-xl bg-gray-50 flex items-center justify-center">
            <BarChart3 className="h-4 w-4 text-gray-400" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-gray-900">التقرير التحليلي</h3>
            <p className="text-[10px] text-gray-300">تحليل فوري بالمؤشرات local</p>
          </div>
        </div>

        {analysis ? (
          <div className="space-y-3">
            {/* Sentiment Bar */}
            <div className="p-3 bg-gray-50 rounded-xl">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-[11px] font-bold text-gray-700">مؤشر الرضا العام</h4>
                <span className="text-lg">{analysis.overallEmoji}</span>
              </div>
              <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
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
              <p className="text-[10px] text-gray-400 mt-1 text-center">{analysis.sentimentLabel} — {analysis.sentimentScore}%</p>
            </div>

            {/* Strengths & Weaknesses */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="p-3 bg-emerald-50 rounded-xl">
                <h4 className="text-[11px] font-bold text-emerald-700 mb-1 flex items-center gap-1">
                  <ThumbsUp className="h-3 w-3" />نقاط القوة
                </h4>
                {analysis.positiveThemes.length === 0 ? (
                  <p className="text-[10px] text-emerald-500">لم يتم رصد ملاحظات إيجابية بعد.</p>
                ) : (
                  <ul className="space-y-0.5">
                    {analysis.positiveThemes.map((t, i) => <li key={i} className="text-[10px] text-emerald-600">• {t}</li>)}
                  </ul>
                )}
              </div>
              <div className="p-3 bg-red-50 rounded-xl">
                <h4 className="text-[11px] font-bold text-red-700 mb-1 flex items-center gap-1">
                  <ThumbsDown className="h-3 w-3" />للتحسين
                </h4>
                {analysis.negativeThemes.length === 0 ? (
                  <p className="text-[10px] text-red-500">ممتاز! لا توجد ملاحظات سلبية.</p>
                ) : (
                  <ul className="space-y-0.5">
                    {analysis.negativeThemes.map((t, i) => <li key={i} className="text-[10px] text-red-600">• {t}</li>)}
                  </ul>
                )}
              </div>
            </div>

            {/* Topic Breakdown */}
            <div className="p-3 bg-amber-50 rounded-xl">
              <h4 className="text-[11px] font-bold text-amber-700 mb-2 flex items-center gap-1">
                <BarChart3 className="h-3 w-3" />تحليل المواضيع
              </h4>
              <div className="space-y-1.5">
                {analysis.topicBreakdown.filter(t => t.positive + t.negative + t.neutral > 0).map((t, i) => {
                  const total = t.positive + t.negative + t.neutral;
                  const posPct = Math.round((t.positive / total) * 100);
                  return (
                    <div key={i} className="flex items-center gap-2">
                      <span className="text-[10px] font-medium text-gray-600 w-14">{t.topic}</span>
                      <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div className="h-full bg-amber-400 rounded-full" style={{ width: `${posPct}%` }} />
                      </div>
                      <span className="text-[9px] text-gray-400 w-10 text-left">{posPct}% إيجابي</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Recommendation */}
            <div className="p-3 bg-violet-50 rounded-xl">
              <h4 className="text-[11px] font-bold text-violet-700 mb-1 flex items-center gap-1">
                <Lightbulb className="h-3 w-3" />توصية
              </h4>
              <p className="text-[10px] text-violet-600 leading-relaxed">{analysis.recommendation}</p>
            </div>
          </div>
        ) : (
          <p className="text-xs text-gray-400 text-center py-6">لا توجد تقييمات كافية للتحليل.</p>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Distribution */}
        <div className="bg-white border border-gray-100 rounded-2xl p-5">
          <h3 className="text-sm font-bold text-gray-900 mb-4">توزيع التقييمات</h3>
          <div className="space-y-3">
            {[5, 4, 3, 2, 1].map(star => (
              <div key={star} className="flex items-center gap-3">
                <span className="text-[10px] font-bold text-gray-500 w-4">{star}</span>
                <Star className="h-3 w-3 text-amber-400 fill-amber-400" />
                <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-amber-400 rounded-full transition-all"
                    style={{ width: `${stats.totalReviews > 0 ? (stats.distribution[star as keyof typeof stats.distribution] / stats.totalReviews) * 100 : 0}%` }} />
                </div>
                <span className="text-[10px] text-gray-300 w-6 text-left">{stats.distribution[star as keyof typeof stats.distribution]}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Latest Reviews */}
        <div className="bg-white border border-gray-100 rounded-2xl p-5">
          <h3 className="text-sm font-bold text-gray-900 mb-4">أحدث التقييمات</h3>
          <div className="space-y-3 max-h-[28rem] overflow-y-auto">
            {reviews.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-8">لا توجد تقييمات بعد.</p>
            ) : reviews.map(review => {
              const isVisible = review.is_visible !== false;
              return (
                <div key={review.id} className="border border-gray-100 rounded-xl p-3">
                  <div className="flex items-start justify-between">
                    <div className="flex gap-0.5">
                      {[1, 2, 3, 4, 5].map(s => (
                        <Star key={s} className={`h-3 w-3 ${review.rating >= s ? 'text-amber-400 fill-amber-400' : 'text-gray-200'}`} />
                      ))}
                    </div>
                    <span className="text-[9px] text-gray-300">
                      {review.created_at ? formatDistanceToNow(new Date(review.created_at), { addSuffix: true, locale: ar }) : ''}
                    </span>
                  </div>
                  {review.comment && <p className="text-[11px] text-gray-500 mt-2 leading-relaxed">{review.comment}</p>}
                  <div className="flex items-center justify-end gap-2 mt-2 pt-2 border-t border-gray-50">
                    <span className="text-[9px] text-gray-300">{isVisible ? 'معروض' : 'مخفي'}</span>
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
      </div>
    </div>
  );
}
