'use client';

import { useState, useTransition, useEffect } from 'react';
import PageHeader from "@/components/dashboard/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { RefreshCw, Bot, BarChart, Lightbulb } from 'lucide-react';
import { useUser } from '@/hooks/useUser';
import { useToast } from '@/hooks/use-toast';
import { generateDailyPulse, DailyPulseOutput } from '@/ai/flows/generate-daily-pulse';
import { supabase } from '@/lib/supabase';

export default function DailyPulsePage() {
    const { user, isLoading: isUserLoading } = useUser();
    const { toast } = useToast();
    const [isAnalyzing, startAnalysis] = useTransition();
    const [analysisResult, setAnalysisResult] = useState<DailyPulseOutput | null>(null);

    const handleAnalyze = () => {
        if (!user?.restaurantId || !user.name) {
            toast({ title: 'خطأ', description: 'لم يتم العثور على معلومات المطعم.', variant: 'destructive' });
            return;
        }

        startAnalysis(async () => {
            setAnalysisResult(null);
            try {
                const yesterday = new Date();
                yesterday.setDate(yesterday.getDate() - 1);

                const { data: sessions } = await supabase
                    .from('ai_sessions')
                    .select('created_at')
                    .eq('restaurant_id', user.restaurantId!)
                    .gte('created_at', yesterday.toISOString());

                const recentSessions = sessions || [];

                if (recentSessions.length === 0) {
                    toast({ title: 'لا توجد بيانات', description: 'لا توجد تفاعلات في آخر 24 ساعة.' });
                    return;
                }

                const hourCounts: { [key: number]: number } = {};
                recentSessions.forEach((session: any) => {
                    const createdAt = session.created_at ? new Date(session.created_at) : null;
                    if (createdAt) {
                        const hour = createdAt.getHours();
                        hourCounts[hour] = (hourCounts[hour] || 0) + 1;
                    }
                });

                let peakHour = -1; let maxCount = 0;
                Object.entries(hourCounts).forEach(([hour, count]) => {
                    if (count > maxCount) { maxCount = count; peakHour = parseInt(hour, 10); }
                });

                const result = await generateDailyPulse({
                    restaurantName: user.name!,
                    totalInteractions: recentSessions.length,
                    peakActivityHour: peakHour !== -1 ? `${peakHour}:00 - ${peakHour + 1}:00` : "N/A",
                    mostDiscussedItem: "N/A",
                });

                setAnalysisResult(result);
                toast({ title: 'تم إنشاء نبض اليوم بنجاح!' });
            } catch (error: any) {
                toast({ title: 'فشل التحليل', description: error.message, variant: 'destructive' });
            }
        });
    };

    useEffect(() => {
        if (user?.restaurantId) handleAnalyze();
    }, [user?.restaurantId]);

    return (
        <div className="space-y-6">
            <PageHeader title="لوحة نبض اليوم" description="ملخص يومي ذكي لأهم ما حدث، مع توصية واحدة قابلة للتنفيذ.">
                <Button onClick={handleAnalyze} disabled={isAnalyzing || isUserLoading}>
                    <RefreshCw className={`ml-2 h-4 w-4 ${isAnalyzing ? 'animate-spin' : ''}`} />
                    تحديث النبض
                </Button>
            </PageHeader>

            {isAnalyzing && (
                <div className="flex flex-col items-center justify-center text-center gap-4 h-64 border-2 border-dashed rounded-xl">
                    <Bot className="h-16 w-16 text-primary animate-pulse" />
                    <h3 className="text-xl font-semibold">يقوم الذكاء الاصطناعي بتحليل بيانات الأمس...</h3>
                </div>
            )}

            {!isAnalyzing && !analysisResult && (
                <div className="flex flex-col items-center justify-center text-center gap-4 h-64 border-2 border-dashed rounded-xl">
                    <BarChart className="h-16 w-16 text-muted-foreground" />
                    <h3 className="text-xl font-semibold">لا يوجد تحليل لعرضه</h3>
                    <p className="text-muted-foreground">اضغط على "تحديث النبض" لبدء التحليل.</p>
                </div>
            )}

            {analysisResult && (
                <div className="space-y-6">
                    <Card className="bg-primary text-primary-foreground border-0">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2"><BarChart className="h-6 w-6" /><span>نبض اليوم</span></CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-2xl font-bold leading-relaxed">{analysisResult.pulseSummary}</p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-amber-600"><Lightbulb className="h-6 w-6" /><span>توصية اليوم التنفيذية</span></CardTitle>
                            <CardDescription>إجراء واحد بسيط يمكنك اتخاذه اليوم.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <p className="text-lg font-semibold">{analysisResult.singleActionableRecommendation}</p>
                        </CardContent>
                    </Card>
                </div>
            )}
        </div>
    );
}
