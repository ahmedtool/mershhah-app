'use client';

import { useState, useTransition } from 'react';
import PageHeader from "@/components/dashboard/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Sparkles, Copy, Bot } from 'lucide-react';
import { useUser } from '@/hooks/useUser';
import { useToast } from '@/hooks/use-toast';
import { generateReplyTemplates, ReplyTemplatesOutput } from '@/ai/flows/generate-reply-templates';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';

const scenarios = [
    { value: 'order_delay', label: 'تأخير في توصيل الطلب' },
    { value: 'item_unavailable', label: 'صنف غير متوفر' },
    { value: 'complaint_food_quality', label: 'شكوى من جودة الأكل' },
    { value: 'complaint_service', label: 'شكوى من الخدمة' },
    { value: 'positive_feedback', label: 'شكر وثناء من عميل' },
    { value: 'booking_inquiry', label: 'استفسار عن حجز' },
    { value: 'general_inquiry', label: 'استفسار عام' },
];

export default function ReplyTemplatesPage() {
    const { user } = useUser();
    const { toast } = useToast();
    const [isGenerating, startGeneration] = useTransition();
    const [generatedReplies, setGeneratedReplies] = useState<ReplyTemplatesOutput | null>(null);
    const [selectedScenario, setSelectedScenario] = useState<string>('');

    const handleGenerate = () => {
        if (!selectedScenario) {
            toast({ title: "الرجاء اختيار سيناريو أولاً.", variant: "destructive" });
            return;
        }
        if (!user?.name) {
            toast({ title: "اسم المطعم غير متوفر", variant: "destructive" });
            return;
        }

        startGeneration(async () => {
            setGeneratedReplies(null);
            try {
                const result = await generateReplyTemplates({
                    scenario: selectedScenario as any,
                    restaurantName: user.name!,
                });
                setGeneratedReplies(result);
                toast({ title: 'تم إنشاء قوالب الردود بنجاح!' });
            } catch (error: any) {
                toast({ title: 'فشل إنشاء الردود', description: error.message, variant: 'destructive' });
            }
        });
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        toast({ title: 'تم نسخ الرد!' });
    };

    return (
        <div className="space-y-6">
            <PageHeader
                title="قوالب ردود جاهزة"
                description="أنشئ ردودًا احترافية وسريعة لمختلف مواقف خدمة العملاء."
            />

            <Card>
                <CardContent className="p-6">
                    <div className="flex flex-col sm:flex-row items-center gap-4">
                        <div className="w-full sm:w-auto flex-1 space-y-1.5">
                            <Label htmlFor="scenario">اختر الموقف</Label>
                            <Select value={selectedScenario} onValueChange={setSelectedScenario}>
                                <SelectTrigger id="scenario"><SelectValue placeholder="اختر سيناريو..." /></SelectTrigger>
                                <SelectContent>
                                    {scenarios.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        <Button onClick={handleGenerate} disabled={isGenerating || !selectedScenario} className="w-full sm:w-auto mt-4 sm:mt-0">
                            {isGenerating ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : <Sparkles className="ml-2 h-4 w-4" />}
                            {isGenerating ? 'جاري الإنشاء...' : 'أنشئ الردود'}
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {isGenerating && (
                <div className="flex flex-col items-center justify-center text-center gap-4 h-64 border-2 border-dashed rounded-xl">
                    <Bot className="h-16 w-16 text-primary animate-pulse" />
                    <h3 className="text-xl font-semibold">يقوم الذكاء الاصطناعي بصياغة الردود...</h3>
                </div>
            )}

            {generatedReplies && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>رد سريع ومختصر</CardTitle>
                            <CardDescription>مثالي للردود السريعة على الرسائل.</CardDescription>
                        </CardHeader>
                        <CardContent><p className="text-sm text-muted-foreground p-4 bg-muted rounded-md">{generatedReplies.shortReply}</p></CardContent>
                        <CardFooter><Button variant="outline" size="sm" onClick={() => copyToClipboard(generatedReplies.shortReply)}><Copy className="ml-2 h-3 w-3"/> نسخ</Button></CardFooter>
                    </Card>
                    <Card>
                        <CardHeader>
                            <CardTitle>رد احترافي ومتعاطف</CardTitle>
                            <CardDescription>يظهر اهتمامك بالعميل بشكل أكبر.</CardDescription>
                        </CardHeader>
                        <CardContent><p className="text-sm text-muted-foreground p-4 bg-muted rounded-md">{generatedReplies.empatheticReply}</p></CardContent>
                        <CardFooter><Button variant="outline" size="sm" onClick={() => copyToClipboard(generatedReplies.empatheticReply)}><Copy className="ml-2 h-3 w-3"/> نسخ</Button></CardFooter>
                    </Card>
                     <Card>
                        <CardHeader>
                            <CardTitle>رد لتهدئة العميل</CardTitle>
                            <CardDescription>يستخدم في حالات الشكوى لامتصاص الغضب.</CardDescription>
                        </CardHeader>
                        <CardContent><p className="text-sm text-muted-foreground p-4 bg-muted rounded-md">{generatedReplies.deEscalationReply}</p></CardContent>
                        <CardFooter><Button variant="outline" size="sm" onClick={() => copyToClipboard(generatedReplies.deEscalationReply)}><Copy className="ml-2 h-3 w-3"/> نسخ</Button></CardFooter>
                    </Card>
                </div>
            )}
        </div>
    );
}
