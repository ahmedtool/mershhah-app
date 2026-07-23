"use client";

import { useEffect, useState, useTransition, useMemo } from 'react';
import { useParams } from 'wouter';
import { Button } from '@/components/ui/button';
import { ChevronRight, Star, Info, Eye, EyeOff } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { getPublicPage, syncPublicPage } from '@/lib/public-pages';
import { formatDistanceToNow } from 'date-fns';
import { ar } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { Link } from 'wouter';
import { StorageImage } from '@/components/shared/StorageImage';
import { Skeleton } from '@/components/ui/skeleton';

interface Review {
  id: string;
  rating: number;
  comment?: string;
  created_at: string | null;
  is_visible?: boolean;
}

const StarRating = ({ rating, size = 'md' }: { rating: number; size?: 'sm' | 'md' }) => {
  const starSize = size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4';
  return (
    <div className="flex gap-px" dir="ltr">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star key={star} className={cn(starSize, rating >= star ? 'text-amber-400 fill-amber-400' : 'text-gray-200')} />
      ))}
    </div>
  );
};

export default function PublicReviewsPage() {
  const params = useParams();
  const username = params.username as string;
  const { toast } = useToast();

  const [restaurant, setRestaurant] = useState<any>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState('');
  const [isSubmitting, startSubmission] = useTransition();
  const [isDialogOpen, setDialogOpen] = useState(false);
  const [filterTag, setFilterTag] = useState<string | null>(null);

  const toggleReviewVisibility = async (reviewId: string, currentVisible: boolean) => {
    try {
      const { error } = await supabase
        .from('reviews')
        .update({ is_visible: !currentVisible })
        .eq('id', reviewId);
      if (error) throw error;
      setReviews(prev => prev.map(r =>
        r.id === reviewId ? { ...r, is_visible: !currentVisible } : r
      ));
    } catch (error: any) {
      console.error('Failed to toggle visibility:', error);
    }
  };

  const reviewTags = [
    { id: 'quality', label: 'الجودة', icon: '✦', keywords: ['جودة', 'ممتاز', 'رائع', 'جميل', 'فخم', 'مميز', 'أفضل', 'نظيف', 'مرتب'] },
    { id: 'taste', label: 'الطعم', icon: '◆', keywords: ['طعم', 'لذيذ', 'بنكه', 'مذاق', 'حلو', 'مر', 'مالح', 'حار', 'طازج'] },
    { id: 'price', label: 'السعر', icon: '●', keywords: ['سعر', 'غالي', 'رخيص', 'مناسب', 'قيمة', 'فلوس', 'ميزانية', 'يبرد'] },
    { id: 'speed', label: 'الخدمة', icon: '▲', keywords: ['سريع', 'بطيء', 'انتظار', 'خدمة', 'توصيل', 'استلام', 'زحمة', 'مهمل', 'ودود'] },
  ];

  const fetchReviews = async (restaurantId: string) => {
    const { data } = await supabase
      .from('reviews')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .neq('is_visible', false)
      .order('created_at', { ascending: false });
    setReviews((data || []) as Review[]);
  };

  useEffect(() => {
    if (!username) return;
    setLoading(true);

    const init = async () => {
      try {
        const data = await getPublicPage(username);
        if (data?.restaurant && Array.isArray(data.reviews)) {
          setRestaurant(data.restaurant);
          setReviews(data.reviews as Review[]);
          setLoading(false);
          return;
        }

        const { data: rest } = await supabase
          .from('restaurants')
          .select('*')
          .eq('username', username)
          .limit(1)
          .single();

        if (!rest) {
          setRestaurant(null);
          setLoading(false);
          return;
        }

        setRestaurant(rest);
        await fetchReviews(rest.id);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };

    init();
  }, [username]);

  useEffect(() => {
    if (!restaurant?.id) return;
    const channel = supabase
      .channel(`reviews-${restaurant.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reviews', filter: `restaurant_id=eq.${restaurant.id}` },
        () => fetchReviews(restaurant.id))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [restaurant?.id]);

  const handleSubmit = () => {
    if (!restaurant || rating === 0) return;
    startSubmission(async () => {
      try {
        const { error: insertError } = await supabase.from('reviews').insert({
          rating,
          comment,
          created_at: new Date().toISOString(),
          restaurant_id: restaurant.id,
          is_visible: true,
        });
        if (insertError) throw insertError;

        const { data: allReviews } = await supabase
          .from('reviews')
          .select('rating')
          .eq('restaurant_id', restaurant.id)
          .neq('is_visible', false);

        if (allReviews && allReviews.length > 0) {
          const total = allReviews.reduce((sum: number, r: any) => sum + r.rating, 0);
          const avg = total / allReviews.length;
          await supabase.from('restaurants').update({
            rating: avg,
            review_count: allReviews.length,
          }).eq('id', restaurant.id);
        }

        toast({ title: 'شكراً لتقييمك!' });
        setRating(0);
        setComment('');
        setDialogOpen(false);
        syncPublicPage(restaurant.id).catch(() => {});
      } catch (error: any) {
        console.error('Failed to submit rating:', error);
        toast({ title: 'خطأ', description: error.message, variant: 'destructive' });
      }
    });
  };

  const { averageRating, distribution } = useMemo(() => {
    if (reviews.length === 0) return { averageRating: 0, distribution: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 } };
    const totalRating = reviews.reduce((sum, r) => sum + r.rating, 0);
    const avg = totalRating / reviews.length;
    const dist = reviews.reduce(
      (acc, review) => {
        const r = Math.floor(review.rating || 0);
        if (r >= 1 && r <= 5) acc[r as keyof typeof acc]++;
        return acc;
      },
      { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 }
    );
    return { averageRating: avg, distribution: dist };
  }, [reviews]);

  if (loading) {
    return (
      <div className="min-h-screen bg-white" dir="rtl">
        <div className="max-w-lg mx-auto px-5 space-y-8 pt-8">
          <div className="flex flex-col items-center space-y-4">
            <Skeleton className="h-20 w-20 rounded-2xl" />
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-4 w-32" />
          </div>
          <Skeleton className="h-40 w-full rounded-xl" />
          <div className="space-y-4">
            {[1,2,3].map(i => <Skeleton key={i} className="h-24 w-full rounded-xl" />)}
          </div>
        </div>
      </div>
    );
  }

  if (!restaurant) {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center bg-white text-center p-6 space-y-5">
        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center text-gray-400">
          <Info size={28} />
        </div>
        <h1 className="text-lg font-bold text-gray-900">المطعم غير موجود</h1>
        <Button onClick={() => window.location.href = '/'} variant="outline" className="rounded-xl px-6">العودة للرئيسية</Button>
      </div>
    );
  }

  const reviewsWithComments = reviews.filter(r => r.comment);

  return (
    <div className="min-h-screen bg-white pb-16" dir="rtl">

      {/* Header */}
      <div className="max-w-lg mx-auto w-full px-5 pt-6 pb-4 flex items-center justify-between">
        <Button
          variant="ghost"
          size="icon"
          className="w-9 h-9 rounded-xl text-gray-500 hover:text-gray-900 hover:bg-gray-100"
          onClick={() => window.history.back()}
        >
          <ChevronRight className="h-5 w-5" />
        </Button>
        <div className="w-9" />
      </div>

      <div className="max-w-lg mx-auto w-full px-5 pb-6 text-center space-y-3 text-right">
        <div className="relative w-16 h-16 mx-auto rounded-2xl overflow-hidden border border-gray-100">
          <StorageImage
            imagePath={restaurant.logo}
            alt={restaurant.name}
            fill
            sizes="64px"
            className="object-cover"
          />
        </div>
        <div>
          <h1 className="text-xl font-black text-gray-900">{restaurant.name}</h1>
          <p className="text-xs text-gray-400 mt-0.5">التقييمات وآراء العملاء</p>
        </div>
      </div>

      <div className="max-w-lg mx-auto w-full px-5 space-y-6">

        {/* Rating Summary */}
        <div className="border border-gray-100 rounded-2xl p-5">
          <div className="flex items-start gap-6">
            {/* Big number */}
            <div className="text-center shrink-0">
              <span className="text-4xl font-bold text-gray-900">{averageRating.toFixed(1)}</span>
              <div className="mt-1" dir="ltr">
                <StarRating rating={averageRating} />
              </div>
              <p className="text-[11px] text-gray-400 mt-1">{reviews.length} تقييم</p>
            </div>

            {/* Bars */}
            <div className="flex-1 space-y-2 pt-1">
              {[5, 4, 3, 2, 1].map((star) => {
                const count = distribution[star as keyof typeof distribution];
                const pct = reviews.length > 0 ? (count / reviews.length) * 100 : 0;
                return (
                  <div key={star} className="flex items-center gap-2">
                    <span className="text-[11px] text-gray-400 w-3 text-center shrink-0">{star}</span>
                    <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-500 bg-gray-900" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-[10px] text-gray-300 w-5 text-left">{count}</span>
                  </div>
                );
              })}
            </div>
          </div>

          <button
            onClick={() => setDialogOpen(true)}
            className="w-full h-11 rounded-xl text-sm font-bold text-white mt-5 bg-gray-900 hover:bg-gray-800 transition-colors"
          >
            أضف تقييمك
          </button>
        </div>

        {/* Divider */}
        <div className="border-b border-gray-100" />

        {/* Reviews List */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-gray-900">أحدث التقييمات</h2>
          </div>

          {reviewsWithComments.length > 0 && (
            <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
              {reviewTags.map((tag) => {
                const count = reviewsWithComments.filter(r =>
                  tag.keywords.some(kw => (r.comment || '').includes(kw))
                ).length;
                const isActive = filterTag === tag.id;
                return (
                  <button
                    key={tag.id}
                    onClick={() => setFilterTag(isActive ? null : tag.id)}
                    className={cn(
                      "shrink-0 flex items-center gap-1.5 px-3.5 h-8 rounded-full text-xs font-medium transition-all border",
                      isActive
                        ? "text-white border-transparent bg-gray-900"
                        : "bg-white text-gray-500 border-gray-100 hover:border-gray-200"
                    )}
                  >
                    <span className="text-[10px]">{tag.icon}</span>
                    {tag.label}
                    {count > 0 && (
                      <span className={cn(
                        "text-[9px] font-bold min-w-[16px] h-4 rounded-full flex items-center justify-center",
                        isActive ? "bg-white/20" : "bg-gray-100 text-gray-400"
                      )}>
                        {count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {reviewsWithComments.length === 0 ? (
            <div className="text-center py-16 space-y-3">
              <Star className="h-10 w-10 text-gray-200 mx-auto" />
              <p className="text-sm text-gray-400">لا توجد تعليقات بعد</p>
              <button
                onClick={() => setDialogOpen(true)}
                className="text-xs font-bold text-gray-900 mt-2"
              >
                كن أول من يقيّم
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {reviewsWithComments
                .filter(r => {
                  if (!filterTag) return true;
                  const tag = reviewTags.find(t => t.id === filterTag);
                  return tag?.keywords.some(kw => (r.comment || '').includes(kw));
                })
                .map((review) => (
                <div key={review.id} className="border border-gray-100 rounded-2xl p-4 text-right">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
                        <span className="text-[11px] font-bold text-gray-400">م</span>
                      </div>
                      <div>
                        <StarRating rating={review.rating} size="sm" />
                      </div>
                    </div>
                    <span className="text-[10px] text-gray-300">
                      {review.created_at
                        ? formatDistanceToNow(new Date(review.created_at), { addSuffix: true, locale: ar })
                        : ''}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 leading-relaxed">{review.comment}</p>
                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-[10px] text-gray-400 bg-gray-50 border border-gray-100 px-2 py-0.5 rounded-md">
                      {review.is_visible !== false ? 'معروض' : 'مخفي'}
                    </span>
                    <button
                      onClick={() => toggleReviewVisibility(review.id, review.is_visible !== false)}
                      className="flex items-center gap-1.5 text-[10px] text-gray-400 hover:text-gray-900 bg-gray-50 border border-gray-100 rounded-md px-2 py-1 transition-colors"
                    >
                      {review.is_visible !== false ? (
                        <><Eye className="h-3 w-3" /> إخفاء</>
                      ) : (
                        <><EyeOff className="h-3 w-3" /> إظهار</>
                      )}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Rating Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg max-h-[92vh] overflow-y-auto p-0 gap-0" dir="rtl">
          <DialogHeader className="p-5 pb-0 text-right">
            <DialogTitle className="text-base font-black text-gray-900">تقييم {restaurant.name}</DialogTitle>
            <DialogDescription className="text-xs text-gray-400">
              شاركنا رأيك لمساعدتنا على التحسن.
            </DialogDescription>
          </DialogHeader>

          <div className="p-5">
            {/* Star Picker */}
            <div className="flex justify-center mb-2 flex-row-reverse">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onMouseEnter={() => setHoverRating(star)}
                  onMouseLeave={() => setHoverRating(0)}
                  onClick={() => setRating(star)}
                  className="p-1 transition-transform hover:scale-110"
                >
                  <Star
                    className="h-9 w-9 transition-colors"
                    fill={star <= (hoverRating || rating) ? '#f59e0b' : 'none'}
                    stroke={star <= (hoverRating || rating) ? '#f59e0b' : '#d1d5db'}
                  />
                </button>
              ))}
            </div>
            <p className="text-center text-xs text-gray-300 mb-4">
              {rating === 0 && 'اضغط على النجمة'}
              {rating === 1 && 'سيء'}
              {rating === 2 && 'مقبول'}
              {rating === 3 && 'جيد'}
              {rating === 4 && 'جيد جداً'}
              {rating === 5 && 'ممتاز'}
            </p>

            <div className="rounded-xl border border-gray-200 overflow-hidden">
              <Textarea
                placeholder="اترك تعليقك (اختياري)"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                className="rounded-none border-0 text-sm min-h-[80px] resize-none focus-visible:ring-0"
              />
            </div>
          </div>

          <DialogFooter className="flex-wrap gap-2 p-5 pt-0">
            <Button
              variant="ghost"
              onClick={() => setDialogOpen(false)}
              className="rounded-xl text-sm h-10 flex-1"
            >
              إلغاء
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={rating === 0 || isSubmitting}
              className="rounded-xl text-sm h-10 flex-1 bg-gray-900 text-white hover:bg-gray-800 font-bold"
            >
              {isSubmitting ? 'جاري...' : 'إرسال'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
