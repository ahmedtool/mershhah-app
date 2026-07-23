'use client';

import { useState, useTransition } from 'react';
import PageHeader from "@/components/dashboard/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Sparkles, Copy, Bot } from 'lucide-react';
import { useUser } from '@/hooks/useUser';
import { useToast } from '@/hooks/use-toast';
import { generateWeeklyContent, GenerateWeeklyContentOutput } from '@/ai/flows/generate-weekly-content';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function WeeklyContentWriterPage() {
    const { user } = useUser();
    const { toast } = useToast();
    const [isGenerating, startGeneration] = useTransition();
    const [generatedContent, setGeneratedContent] = useState<GenerateWeeklyContentOutput | null>(null);
    const [theme, setTheme] = useState('');

    const handleGenerate = () => {
        if (!user?.name || !user.restaurantId) {
            toast({ title: "معلومات المطعم غير كاملة", variant: "destructive" });
            return;
        }

        startGeneration(async () => {
            setGeneratedContent(null);
            try {
                const result = await generateWeeklyContent({
                    restaurantName: user.name!,
                    restaurantType: 'مطعم', // Can be dynamic later
                    optionalTheme: theme,
                });
                setGeneratedContent(result);
                toast({ title: 'تم إنشاء محتوى الأسبوع بنجاح!' });
            } catch (error: any) {
                toast({ title: 'فشل إنشاء المحتوى', description: error.message, variant: 'destructive' });
            }
        });
    };
    
    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        toast({ title: 'تم نسخ النص!' });
    };

    return (
        <div className="space-y-6">
            <PageHeader
                title="كاتب المحتوى الأسبوعي"
                description="احصل على 7 منشورات جاهزة للنشر لتبقى على تواصل دائم مع عملائك."
            />

            <Card>
                 <CardContent className="p-6">
                    <div className="flex flex-col sm:flex-row items-center gap-4">
                        <div className="w-full sm:w-auto flex-1 space-y-1.5">
                            <Label htmlFor="theme">موضوع الأسبوع (اختياري)</Label>
                            <Input id="theme" placeholder="مثال: العودة للمدارس، يوم التأسيس، طبقنا الجديد..." value={theme} onChange={(e) => setTheme(e.target.value)} />
                        </div>
                        <Button onClick={handleGenerate} disabled={isGenerating} className="w-full sm:w-auto mt-4 sm:mt-0">
                            {isGenerating ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : <Sparkles className="ml-2 h-4 w-4" />}
                            {isGenerating ? 'جاري الكتابة...' : 'أنشئ محتوى 7 أيام'}
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {isGenerating && (
                 <div className="flex flex-col items-center justify-center text-center gap-4 h-64 border-2 border-dashed rounded-xl">
                    <Bot className="h-16 w-16 text-primary animate-pulse" />
                    <h3 className="text-xl font-semibold">يقوم الذكاء الاصطناعي بإعداد المنشورات...</h3>
                </div>
            )}

            {generatedContent && (
                <Accordion type="single" collapsible className="w-full space-y-4" defaultValue="item-0">
                    {generatedContent.posts.map((post, index) => (
                        <AccordionItem value={`item-${index}`} key={index} className="bg-card border rounded-lg">
                            <AccordionTrigger className="p-4 font-bold text-lg">
                                {post.day}
                            </AccordionTrigger>
                            <AccordionContent className="p-4 pt-0">
                                <Tabs defaultValue="casual">
                                    <TabsList className="grid w-full grid-cols-2">
                                        <TabsTrigger value="casual">لهجة عامية (سناب/تيك توك)</TabsTrigger>
                                        <TabsTrigger value="formal">رسمية (انستغرام)</TabsTrigger>
                                    </TabsList>
                                    <TabsContent value="casual" className="mt-4 p-4 bg-muted rounded-md relative">
                                        <Button size="icon" variant="ghost" className="absolute top-2 left-2 h-7 w-7" onClick={() => copyToClipboard(post.casualCopy)}><Copy className="h-4 w-4" /></Button>
                                        <p className="text-sm text-muted-foreground whitespace-pre-wrap">{post.casualCopy}</p>
                                    </TabsContent>
                                    <TabsContent value="formal" className="mt-4 p-4 bg-muted rounded-md relative">
                                        <Button size="icon" variant="ghost" className="absolute top-2 left-2 h-7 w-7" onClick={() => copyToClipboard(post.formalCopy)}><Copy className="h-4 w-4" /></Button>
                                        <p className="text-sm text-muted-foreground whitespace-pre-wrap">{post.formalCopy}</p>
                                    </TabsContent>
                                </Tabs>
                                 <div className="mt-4">
                                    <p className="text-sm font-semibold">الهاشتاقات:</p>
                                    <p className="text-xs text-muted-foreground p-2 bg-muted rounded-md">{post.hashtags}</p>
                                </div>
                                <div className="mt-4">
                                    <p className="text-sm font-semibold">الدعوة لاتخاذ إجراء (CTA):</p>
                                    <p className="text-sm font-bold text-primary p-2 bg-primary/10 rounded-md">{post.cta}</p>
                                </div>
                            </AccordionContent>
                        </AccordionItem>
                    ))}
                </Accordion>
            )}
        </div>
    );
}
