'use client';

import { useState, useTransition } from 'react';
import { useUser } from '@/hooks/useUser';
import { supabase } from '@/lib/supabase';
import { summarizeCustomerFeedback, SummarizeCustomerFeedbackOutput } from '@/ai/flows/summarize-customer-feedback';
import PageHeader from '@/components/dashboard/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Zap, FileText, Bot, BrainCircuit, BarChartHorizontal } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';

export default function SummarizeFeedbackPage() {
    const { user } = useUser();
    const { toast } = useToast();
    const [isAnalyzing, startAnalysis] = useTransition();
    const [analysisResult, setAnalysisResult] = useState<SummarizeCustomerFeedbackOutput | null>(null);

    const handleAnalyze = () => {
        if (!user?.restaurantId) {
            toast({ title: 'خطأ', description: 'لم يتم العثور على المطعم.', variant: 'destructive' });
            return;
        }

        startAnalysis(async () => {
            setAnalysisResult(null);
            try {
                const { data: messages, error } = await supabase
                    .from('ai_session_messages')
                    .select('text, created_at')
                    .eq('restaurant_id', user.restaurantId!)
                    .order('created_at', { ascending: false })
                    .limit(500);

                if (error) throw error;

                if (!messages || messages.length === 0) {
                    toast({ title: 'لا توجد بيانات كافية', description: 'لا توجد محادثات مع المساعد الذكي لتحليلها بعد.' });
                    return;
                }

                if (messages.length < 5) {
                    toast({ title: 'لا توجد بيانات كافية', description: 'تحتاج إلى 5 رسائل على الأقل لبدء التحليل.' });
                    return;
                }

                const chatMessages = messages.map((m: any) => ({
                    text: m.text || '',
                    timestamp: m.created_at,
                }));

                const result = await summarizeCustomerFeedback({ chatMessages });
                setAnalysisResult(result);
                toast({ title: 'اكتمل التحليل بنجاح!' });

            } catch (error: any) {
                console.error("Analysis failed:", error);
                toast({ title: 'فشل التحليل', description: error.message, variant: 'destructive' });
            }
        });
    };

    return (
        <div className="space-y-6">
            <PageHeader
                title="ملخص آراء العملاء"
                description="استخدم الذكاء الاصطناعي لتحليل محادثات العملاء مع المساعد الذكي واكتشاف رؤى قيمة."
            >
                 <Button onClick={handleAnalyze} disabled={isAnalyzing}>
                    {isAnalyzing ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : <Zap className="ml-2 h-4 w-4" />}
                    {isAnalyzing ? 'جاري التحليل...' : 'ابدأ تحليل المحادثات'}
                </Button>
            </PageHeader>

            {isAnalyzing && (
                 <div className="flex flex-col items-center justify-center text-center gap-4 h-64 border-2 border-dashed rounded-xl">
                    <BrainCircuit className="h-16 w-16 text-primary animate-pulse" />
                    <h3 className="text-xl font-semibold">يقوم الذكاء الاصطناعي بتحليل البيانات...</h3>
                    <p className="text-muted-foreground">قد تستغرق هذه العملية بضع لحظات.</p>
                </div>
            )}

            {!isAnalyzing && !analysisResult && (
                 <div className="flex flex-col items-center justify-center text-center gap-4 h-64 border-2 border-dashed rounded-xl">
                    <Bot className="h-16 w-16 text-muted-foreground" />
                    <h3 className="text-xl font-semibold">جاهز لاكتشاف آراء عملائك؟</h3>
                    <p className="text-muted-foreground">
                      اضغط على زر "ابدأ التحليل" للحصول على ملخص شامل للمحادثات.
                    </p>
                </div>
            )}

            {analysisResult && (
                 <div className="space-y-6">
                    <Card>
                        <CardHeader><CardTitle>الملخص العام</CardTitle></CardHeader>
                        <CardContent><p className="text-muted-foreground leading-relaxed">{analysisResult.summary}</p></CardContent>
                    </Card>
                     <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <Card>
                            <CardHeader className="flex-row items-center gap-2 space-y-0">
                                 <BarChartHorizontal className="h-5 w-5 text-primary"/>
                                <CardTitle>أبرز المواضيع</CardTitle>
                            </CardHeader>
                            <CardContent className="flex flex-wrap gap-2">
                                {analysisResult.frequentTopics.map((topic, i) => <Badge key={i} variant="secondary">{topic}</Badge>)}
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader className="flex-row items-center gap-2 space-y-0">
                                 <Zap className="h-5 w-5 text-primary"/>
                                <CardTitle>شعور العملاء العام</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <p className="text-2xl font-bold">{analysisResult.customerSentiment}</p>
                            </CardContent>
                        </Card>
                        <Card>
                           <CardHeader className="flex-row items-center gap-2 space-y-0">
                                 <FileText className="h-5 w-5 text-primary"/>
                                <CardTitle>أوقات الذروة</CardTitle>
                            </CardHeader>
                           <CardContent>
                                <p className="text-2xl font-bold">{analysisResult.peakHours}</p>
                            </CardContent>
                        </Card>
                     </div>
                 </div>
            )}
        </div>
    );
}
