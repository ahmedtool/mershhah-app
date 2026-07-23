'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, MessageSquare, TrendingUp, Clock, Star } from 'lucide-react';
import StatCard from './StatCard';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartConfig,
} from '@/components/ui/chart';
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import { useEffect, useState } from 'react';
import { Skeleton } from '../ui/skeleton';
import { useUser } from '@/hooks/useUser';
import { supabase } from '@/lib/supabase';
import { format, eachDayOfInterval, startOfWeek, endOfWeek } from 'date-fns';
import { arSA, enUS } from 'date-fns/locale';
import { Tooltip, TooltipProvider, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { useLanguage } from '@/components/shared/LanguageContext';

type AnalyticsData = {
  totalVisitors: number;
  totalQuestions: number;
  peakStartHour: number | null;
  averageRating: number | null;
  weeklyVisitors: { date: Date; visitors: number }[];
  activityHeatMap: { hour: number; activity: number }[];
};

const getSentimentFromRating = (rating: number, isRTL: boolean): string => {
  if (rating >= 4.5) return isRTL ? 'ممتاز' : 'Excellent';
  if (rating >= 4.0) return isRTL ? 'جيد جداً' : 'Very Good';
  if (rating >= 3.0) return isRTL ? 'جيد' : 'Good';
  if (rating >= 2.0) return isRTL ? 'مقبول' : 'Fair';
  if (rating > 0) return isRTL ? 'سيء' : 'Poor';
  return isRTL ? 'لا يوجد' : 'N/A';
};

export default function Analytics({ ...props }) {
  const { user, isLoading: isUserLoading } = useUser();
  const { locale } = useLanguage();
  const isRTL = locale === 'ar';
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const chartConfig = {
    visitors: {
      label: isRTL ? 'الزوار' : 'Visitors',
      color: 'hsl(var(--primary))',
    },
  } satisfies ChartConfig;

  useEffect(() => {
    if (isUserLoading) return;
    if (!user || !user.restaurantId) {
      setIsLoading(false);
      setData({
        totalVisitors: 0,
        totalQuestions: 0,
        peakStartHour: null,
        averageRating: null,
        weeklyVisitors: [],
        activityHeatMap: Array.from({ length: 24 }, (_, i) => ({ hour: i, activity: 0 })),
      });
      return;
    }

    const fetchData = async () => {
      setIsLoading(true);
      try {
        const { data: sessions } = await supabase
          .from('ai_sessions')
          .select('id, created_at')
          .eq('restaurant_id', user.restaurantId!);

        const sessionIds = (sessions || []).map((s: any) => s.id);

        let totalQuestions = 0;
        if (sessionIds.length > 0) {
          const { count } = await supabase
            .from('ai_messages')
            .select('*', { count: 'exact', head: true })
            .in('session_id', sessionIds)
            .eq('sender', 'user');
          totalQuestions = count || 0;
        }

        const { data: hubVisits } = await supabase
          .from('hub_visits')
          .select('created_at')
          .eq('restaurant_id', user.restaurantId!);

        const { data: reviews } = await supabase
          .from('reviews')
          .select('rating')
          .eq('restaurant_id', user.restaurantId!);

        const allEventDates: Date[] = [
          ...(sessions || []).map((s: any) => new Date(s.created_at)),
          ...(hubVisits || []).map((v: any) => new Date(v.created_at || v.timestamp)),
        ];

        const totalVisitors = allEventDates.length;

        let avgRating: number | null = null;
        if ((reviews || []).length > 0) {
          const totalRating = (reviews || []).reduce((sum: number, r: any) => sum + (r.rating || 0), 0);
          avgRating = totalRating / (reviews || []).length;
        }

        let peakStartHour: number | null = null;
        if (allEventDates.length > 0) {
          const hourCounts: Record<number, number> = {};
          allEventDates.forEach((d) => {
            const h = d.getHours();
            hourCounts[h] = (hourCounts[h] || 0) + 1;
          });
          let peakStart = -1;
          let maxCount = 0;
          for (let i = 0; i < 24; i++) {
            if ((hourCounts[i] || 0) > maxCount) {
              maxCount = hourCounts[i] || 0;
              peakStart = i;
            }
          }
          if (peakStart !== -1) peakStartHour = peakStart;
        }

        const activityHeatMap = Array.from({ length: 24 }, (_, i) => {
          const hourCounts: Record<number, number> = {};
          allEventDates.forEach((d) => {
            const h = d.getHours();
            hourCounts[h] = (hourCounts[h] || 0) + 1;
          });
          return { hour: i, activity: hourCounts[i] || 0 };
        });
        const maxActivity = Math.max(...activityHeatMap.map((a) => a.activity));
        const normalizedHeatmap = activityHeatMap.map((a) => ({
          ...a,
          activity: maxActivity > 0 ? a.activity / maxActivity : 0,
        }));

        const today = new Date();
        const weekStart = startOfWeek(today, { weekStartsOn: 0 });
        const weekEnd = endOfWeek(today, { weekStartsOn: 0 });
        const daysOfWeek = eachDayOfInterval({ start: weekStart, end: weekEnd });

        const weeklyVisitorsData = daysOfWeek.map((day) => {
          const dayStr = format(day, 'yyyy-MM-dd');
          const visitors = allEventDates.filter(
            (d) => format(d, 'yyyy-MM-dd') === dayStr
          ).length;
          return { date: day, visitors };
        });

        setData({
          totalVisitors,
          totalQuestions,
          peakStartHour,
          averageRating: avgRating,
          weeklyVisitors: weeklyVisitorsData,
          activityHeatMap: normalizedHeatmap,
        });
      } catch (error) {
        console.error('Failed to fetch analytics data:', error);
        setData({
          totalVisitors: 0,
          totalQuestions: 0,
          peakStartHour: null,
          averageRating: null,
          weeklyVisitors: [],
          activityHeatMap: Array.from({ length: 24 }, (_, i) => ({ hour: i, activity: 0 })),
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [user, isUserLoading, props.key]);

  const formatPeakHours = (peakStart: number | null): string => {
    if (peakStart === null) return isRTL ? 'لا يوجد' : 'N/A';
    const startHour12 = peakStart % 12 || 12;
    const startAmPm = peakStart < 12 ? (isRTL ? 'ص' : 'AM') : isRTL ? 'م' : 'PM';
    const endHour = (peakStart + 1) % 24;
    const endHour12 = endHour % 12 || 12;
    const endAmPm = endHour < 12 ? (isRTL ? 'ص' : 'AM') : isRTL ? 'م' : 'PM';
    return `${startHour12}${startAmPm} - ${endHour12}${endAmPm}`;
  };

  const formatSentiment = (rating: number | null): string => {
    if (rating === null) return isRTL ? 'لا يوجد' : 'N/A';
    return getSentimentFromRating(rating, isRTL);
  };

  const formatWeeklyData = () =>
    data?.weeklyVisitors.map((item) => ({
      day: format(item.date, 'eee', { locale: isRTL ? arSA : enUS }),
      visitors: item.visitors,
    })) || [];

  if (isLoading || isUserLoading || !data) {
    return (
      <div className="space-y-4">
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          <Skeleton className="h-24 rounded-2xl" />
          <Skeleton className="h-24 rounded-2xl" />
          <Skeleton className="h-24 rounded-2xl" />
          <Skeleton className="h-24 rounded-2xl" />
        </div>
        <div className="grid gap-3 lg:grid-cols-2">
          <Skeleton className="h-72 rounded-2xl" />
          <Skeleton className="h-72 rounded-2xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title={isRTL ? 'زوار المساعد' : 'Visitors'}
          value={data.totalVisitors.toString()}
          icon={Users}
          change={isRTL ? 'زائر فريد' : 'unique visitors'}
        />
        <StatCard
          title={isRTL ? 'الأسئلة' : 'Questions'}
          value={data.totalQuestions.toString()}
          icon={MessageSquare}
          change={isRTL ? 'رسالة من العملاء' : 'from customers'}
        />
        <StatCard
          title={isRTL ? 'ذروة النشاط' : 'Peak Hours'}
          value={formatPeakHours(data.peakStartHour)}
          icon={Clock}
          change={isRTL ? 'نشاط الأسبوع' : 'weekly activity'}
        />
        <StatCard
          title={isRTL ? 'رضا العملاء' : 'Satisfaction'}
          value={formatSentiment(data.averageRating)}
          icon={Star}
          change={isRTL ? 'متوسط التقييمات' : 'avg ratings'}
        />
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <div className="bg-white border border-gray-100 rounded-2xl p-5">
          <h3 className="text-sm font-bold text-gray-900 mb-4">{isRTL ? 'زوار هذا الأسبوع' : "This Week's Visitors"}</h3>
          <ChartContainer config={chartConfig} className="h-[220px] w-full">
            <BarChart
              accessibilityLayer
              data={formatWeeklyData()}
              margin={{ top: 10, left: 0, right: -20, bottom: 5 }}
            >
              <CartesianGrid vertical={false} stroke="#f3f4f6" />
              <XAxis dataKey="day" tickLine={false} tickMargin={10} axisLine={false} tick={{ fontSize: 10, fill: '#9ca3af' }} />
              <YAxis tickLine={false} axisLine={false} tickMargin={10} allowDecimals={false} tick={{ fontSize: 10, fill: '#9ca3af' }} />
              <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="dot" />} />
              <Bar dataKey="visitors" fill="var(--color-visitors)" radius={6} />
            </BarChart>
          </ChartContainer>
        </div>
        <div className="bg-white border border-gray-100 rounded-2xl p-5">
          <h3 className="text-sm font-bold text-gray-900 mb-1">{isRTL ? 'خريطة النشاط' : 'Activity Map'}</h3>
          <p className="text-[10px] text-gray-300 mb-4">
            {isRTL ? 'الألوان الغامقة = نشاط أعلى' : 'Darker = higher activity'}
          </p>
          <div className="h-[220px] w-full flex flex-col">
            <div className="flex-1 min-h-0 flex flex-col justify-center">
              <div className="grid grid-cols-12 gap-1">
                {data.activityHeatMap.map((d) => (
                  <TooltipProvider key={d.hour}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="relative aspect-square w-full">
                          <div
                            className="w-full h-full rounded-sm bg-gray-900"
                            style={{ opacity: d.activity }}
                          />
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>{d.hour}:00 - {d.hour + 1}:00</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                ))}
              </div>
            </div>
            <div className="flex justify-between mt-2 text-[9px] text-gray-300 shrink-0">
              <span>12ص</span>
              <span>6ص</span>
              <span>12م</span>
              <span>6م</span>
              <span>11م</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
