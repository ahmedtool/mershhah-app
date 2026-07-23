'use client';

import { useEffect, useState, useMemo, useTransition } from 'react';
import { useUser } from '@/hooks/useUser';
import { supabase } from '@/lib/supabase';
import { formatDistanceToNow } from 'date-fns';
import { ar } from 'date-fns/locale';

import PageHeader from "@/components/dashboard/PageHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Star, MessageCircle, TrendingUp, User as UserIcon, Bot, ThumbsUp, ThumbsDown, Lightbulb, Sparkles, Loader2, Eye, EyeOff } from "lucide-react";
import StatCard from '@/components/dashboard/StatCard';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { analyzeReviews, AnalyzeReviewsOutput } from '@/ai/flows/analyze-reviews';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { Link } from 'wouter';

interface Review {
  id: string;
  rating: number;
  comment?: string;
  createdAt: string | null;
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
  const [isAnalyzing, startAnalysis] = useTransition();
  const [analysisResult, setAnalysisResult] = useState<AnalyzeReviewsOutput | null>(null);
  const { toast } = useToast();
  const [updatingVisibility, startVisibilityUpdate] = useTransition();

  const canUseAiAnalysis = user?.entitlements.canUseAiAnalysis ?? false;

  const fetchReviews = async () => {
    if (!user?.restaurantId) return;
    setIsLoadingData(true);
    const { data, error } = await supabase
      .from('reviews')
      .select('*')
      .eq('restaurant_id', user.restaurantId)
      .order('createdAt', { ascending: false });
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
      return;
    }
    return;
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

  const handleAnalyzeReviews = () => {
    if (!user?.restaurantId || !user.name || reviews.length === 0) {
      toast({ title: "لا توجد بيانات كافية", description: "يجب أن يكون هناك تقييمات لتحليلها.", variant: "destructive" });
      return;
    }
    startAnalysis(async () => {
      try {
        if (user.entitlements.planId === 'free' && !user.ai_trial_used) {
          await supabase.from('profiles').update({ ai_trial_used: true }).eq('id', user.uid);
        }
        const { data: restData } = await supabase.from('restaurants').select('analysis_reviews_daily_count, analysis_reviews_last_reset').eq('id', user.restaurantId!).single();
        let dailyCount = restData?.analysis_reviews_daily_count || 0;
        const lastReset = restData?.analysis_reviews_last_reset ? new Date(restData.analysis_reviews_last_reset) : null;
        const today = new Date();
        const isNewDay = !lastReset || lastReset.getDate() !== today.getDate() || lastReset.getMonth() !== today.getMonth() || lastReset.getFullYear() !== today.getFullYear();
        if (isNewDay) {
          dailyCount = 0;
          await supabase.from('restaurants').update({ analysis_reviews_daily_count: 0, analysis_reviews_last_reset: new Date().toISOString() }).eq('id', user.restaurantId!);
        }
        if (dailyCount >= 3) {
          toast({ title: "تم الوصول للحد اليومي", description: "لقد استخدمت تحليلاتك الثلاثة لهذا اليوم.", variant: "destructive" });
          return;
        }
        const reviewDataForAI = reviews.map(r => ({ rating: r.rating, comment: r.comment || '' }));
        const result = await analyzeReviews({ reviews: reviewDataForAI, restaurantName: user.name! });
        setAnalysisResult(result);
        await supabase.from('restaurants').update({ analysis_reviews_daily_count: (dailyCount + 1) }).eq('id', user.restaurantId!);
        toast({ title: "تم تحليل الآراء بنجاح!" });
      } catch (error: any) {
        toast({ title: "فشل التحليل", description: error.message, variant: "destructive" });
      }
    });
  };

  const handleVisibilityToggle = (reviewId: string, newVisibility: boolean) => {
    startVisibilityUpdate(async () => {
      const { error } = await supabase.from('reviews').update({ is_visible: newVisibility }).eq('id', reviewId);
      if (error) {
        toast({ title: "خطأ", description: 'لم نتمكن من تحديث حالة التقييم.', variant: 'destructive' });
      } else {
        toast({ title: `تم ${newVisibility ? 'إظهار' : 'إخفاء'} التقييم بنجاح.` });
        fetchReviews();
      }
    });
  };

  const loading = isUserLoading || isLoadingData;

  if (loading) {
    return (
      <div className="space-y-5">
        <PageHeader title="تقييمات العملاء" description="آراء عملائك لمساعدتك على التطور." />
        <div className="grid gap-3 md:grid-cols-3"><Skeleton className="h-24 rounded-2xl" /><Skeleton className="h-24 rounded-2xl" /><Skeleton className="h-24 rounded-2xl" /></div>
        <Skeleton className="h-48 rounded-2xl" /><Skeleton className="h-64 rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader title="تقييمات العملاء" description="هنا تجد كل آراء عملائك لمساعدتك على التطور." />

      <div className="grid gap-3 md:grid-cols-3">
        <StatCard title="متوسط التقييم" value={stats.averageRating.toFixed(1)} icon={Star} change={`من ${stats.totalReviews} تقييم`} />
        <StatCard title="إجمالي التقييمات" value={stats.totalReviews.toString()} icon={MessageCircle} />
        <StatCard title="5 نجوم" value={`${(stats.distribution[5] / stats.totalReviews * 100 || 0).toFixed(0)}%`} icon={TrendingUp} change="من التقييمات" />
      </div>

      {/* AI Analysis */}
      <div className="bg-white border border-gray-100 rounded-2xl p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 rounded-xl bg-gray-50 flex items-center justify-center">
            <Bot className="h-4 w-4 text-gray-400" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-gray-900">تحليل الآراء بالذكاء الاصطناعي</h3>
            <p className="text-[10px] text-gray-300">3 تحليلات يومياً</p>
          </div>
        </div>
        {isAnalyzing ? (
          <div className="flex items-center justify-center h-20"><Loader2 className="w-6 h-6 animate-spin text-gray-300" /></div>
        ) : analysisResult ? (
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-3 bg-emerald-50 rounded-xl">
                <h4 className="text-[11px] font-bold text-emerald-700 mb-1 flex items-center gap-1"><ThumbsUp className="h-3 w-3" />نقاط القوة</h4>
                <ul className="space-y-0.5">{analysisResult.positiveThemes.map((t, i) => <li key={i} className="text-[10px] text-emerald-600">{t}</li>)}</ul>
              </div>
              <div className="p-3 bg-red-50 rounded-xl">
                <h4 className="text-[11px] font-bold text-red-700 mb-1 flex items-center gap-1"><ThumbsDown className="h-3 w-3" />للتحسين</h4>
                <ul className="space-y-0.5">{analysisResult.negativeThemes.map((t, i) => <li key={i} className="text-[10px] text-red-600">{t}</li>)}</ul>
              </div>
              <div className="p-3 bg-blue-50 rounded-xl text-center">
                <h4 className="text-[11px] font-bold text-blue-700 mb-1">مؤشر الرضا</h4>
                <p className="text-2xl font-black text-blue-900">{analysisResult.sentimentScore}%</p>
              </div>
            </div>
            <div className="p-3 bg-amber-50 rounded-xl">
              <h4 className="text-[11px] font-bold text-amber-700 mb-1 flex items-center gap-1"><Lightbulb className="h-3 w-3" />توصية ذكية</h4>
              <p className="text-[10px] text-amber-600">{analysisResult.actionableInsight}</p>
            </div>
          </div>
        ) : (
          <p className="text-xs text-gray-400 text-center py-6">
            {canUseAiAnalysis ? 'اضغط للبدء في تحليل التقييمات.' : 'متاح في الباقات المدفوعة.'}
          </p>
        )}
        <button onClick={handleAnalyzeReviews} disabled={isAnalyzing || reviews.length === 0 || !canUseAiAnalysis}
          className="w-full h-10 mt-4 rounded-xl bg-gray-900 text-white text-xs font-bold hover:bg-gray-800 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
          {isAnalyzing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {analysisResult ? 'إعادة التحليل' : 'تحليل الآن'}
        </button>
        {!canUseAiAnalysis && (
          <p className="text-[10px] text-gray-300 text-center mt-2">للوصول، <Link href="/pricing" className="text-gray-900 font-bold hover:underline">رقّ باقتك</Link></p>
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
                      {review.createdAt ? formatDistanceToNow(new Date(review.createdAt), { addSuffix: true, locale: ar }) : ''}
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
