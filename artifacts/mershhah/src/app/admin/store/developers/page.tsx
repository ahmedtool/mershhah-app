'use client';

import { Link } from 'wouter';
import PageHeader from '@/components/dashboard/PageHeader';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Code2, Wrench, Sparkles, Info } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

export default function StoreDevelopersPage() {
  return (
    <div className="space-y-6" dir="rtl">
      <PageHeader
        title="دليل مطوري الأدوات"
        description="مرجع موحّد لتنسيق الأدوات التي تظهر في متجر مرشح والتطبيقات المرتبطة بها."
      >
        <Badge variant="outline" className="flex items-center gap-1 text-xs">
          <Sparkles className="h-3 w-3" />
          الإصدار الأول التجريبي
        </Badge>
      </PageHeader>

      <Tabs defaultValue="meta" className="space-y-6 max-w-4xl mx-auto" dir="rtl">
        <TabsList className="grid w-full md:w-auto md:inline-grid grid-cols-3 gap-2 bg-muted/40 rounded-2xl p-1">
          <TabsTrigger value="meta" className="text-xs md:text-sm">تعريف الأداة</TabsTrigger>
          <TabsTrigger value="example" className="text-xs md:text-sm">مثال برمجي</TabsTrigger>
          <TabsTrigger value="prompt" className="text-xs md:text-sm">برومبت الذكاء الاصطناعي</TabsTrigger>
        </TabsList>

        <TabsContent value="meta" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Wrench className="h-5 w-5 text-primary" />
                  شكل الأداة في المتجر
                </CardTitle>
                <CardDescription>
                  كل أداة في المتجر هي بطاقة واحدة تظهر لصاحب المطعم في لوحة التحكم، وتحتوي على عنوان، وصف، أيقونة، وتصنيف واضح.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 text-sm text-muted-foreground">
                <p className="font-semibold text-foreground">حقول الأداة الأساسية (كما تُخزَّن في Supabase في جدول <code className="px-1 py-0.5 rounded bg-muted text-xs">tools</code>):</p>
                <ul className="list-disc pr-5 space-y-1">
                  <li><span className="font-semibold text-foreground">id</span>: المعرف البرمجي للأداة، بصيغة <code className="px-1 py-0.5 rounded bg-muted text-xs">[a-z0-9-]</code> فقط (مثال: <code className="px-1 py-0.5 rounded bg-muted text-xs">smart-reviews</code>).</li>
                  <li><span className="font-semibold text-foreground">title</span>: اسم الأداة الظاهر لصاحب المطعم (مثال: <span className="font-semibold">محلل التقييمات الذكي</span>).</li>
                  <li><span className="font-semibold text-foreground">description</span>: وصف قصير يشرح فائدة الأداة وكيف تساعد المطعم.</li>
                  <li><span className="font-semibold text-foreground">category</span>: تصنيف عام للأداة مثل <code className="px-1 py-0.5 rounded bg-muted text-xs">marketing</code> أو <code className="px-1 py-0.5 rounded bg-muted text-xs">operations</code> أو <code className="px-1 py-0.5 rounded bg-muted text-xs">analytics</code>.</li>
                  <li><span className="font-semibold text-foreground">price_label</span>: عبارة نصية تظهر كسعر مختصر (مثال: <span className="font-semibold">مجاني</span>، <span className="font-semibold">50 ر.س / شهر</span>).</li>
                  <li><span className="font-semibold text-foreground">icon</span>: اسم أيقونة من مكتبة <code className="px-1 py-0.5 rounded bg-muted text-xs">Lucide</code> (مثل <code className="px-1 py-0.5 rounded bg-muted text-xs">BarChart3</code>, <code className="px-1 py-0.5 rounded bg-muted text-xs">Megaphone</code>).</li>
                  <li><span className="font-semibold text-foreground">color</span>: كلاس لون نص يبدأ بـ <code className="px-1 py-0.5 rounded bg-muted text-xs">text-</code> (مثال: <code className="px-1 py-0.5 rounded bg-muted text-xs">text-primary</code> أو <code className="px-1 py-0.5 rounded bg-muted text-xs">text-blue-500</code>).</li>
                  <li><span className="font-semibold text-foreground">bg_color</span>: كلاس لون خلفية يبدأ بـ <code className="px-1 py-0.5 rounded bg-muted text-xs">bg-</code> (مثال: <code className="px-1 py-0.5 rounded bg-muted text-xs">bg-primary/10</code>).</li>
                  <li><span className="font-semibold text-foreground">popular</span>: قيمة منطقية تحدد هل الأداة مميزة / مقترحة لصاحب المطعم.</li>
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Code2 className="h-5 w-5 text-primary" />
                  ربط الأداة مع نظامك الخارجي
                </CardTitle>
                <CardDescription>
                  حالياً المخزن في مرشح هو تعريف الأداة وشكلها فقط، بينما منطق التنفيذ (API / خدمة خارجية) يكون عند المطور.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 text-sm text-muted-foreground">
                <p>
                  عند تفعيل الأداة لمطعم معيّن، يستطيع النظام لاحقاً استهلاك تعريفك البرمجي (API أو Webhook) لتنفيذ الوظائف الفعلية للأداة.
                  في الإصدارات القادمة سيتم إضافة حقول مثل:
                </p>
                <ul className="list-disc pr-5 space-y-1">
                  <li><span className="font-semibold text-foreground">integration_url</span>: رابط الـ API أو لوحة الإعدادات الخاصة بالأداة.</li>
                  <li><span className="font-semibold text-foreground">config_schema</span>: JSON يوضح إعدادات الأداة التي يحتاج صاحب المطعم لتعبئتها.</li>
                  <li><span className="font-semibold text-foreground">permissions</span>: ما الذي تحتاجه الأداة من صلاحيات داخل مرشح (قراءة منيو، كتابة عروض، ...).</li>
                </ul>
                <p className="text-xs text-muted-foreground flex items-start gap-1">
                  <Info className="h-3 w-3 mt-0.5" />
                  حتى يتم تفعيل التكاملات المتقدمة، يمكن استخدام حقل <code className="px-1 py-0.5 rounded bg-muted text-xs">description</code> لكتابة رابط مستند خارجي يشرح كيفية الربط حالياً.
                </p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                أفضل ممارسات لتصميم الأداة
              </CardTitle>
              <CardDescription>
                نصائح لتوحيد تجربة المطاعم في واجهة مرشح، حتى لو كانت الأداة مطورة من فرق مختلفة.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid md:grid-cols-3 gap-6 text-sm text-muted-foreground">
              <div className="space-y-2">
                <h3 className="font-semibold text-foreground">العنوان والوصف</h3>
                <ul className="list-disc pr-5 space-y-1">
                  <li>اجعل العنوان قصيراً وواضحاً (٣–٤ كلمات كحد أقصى).</li>
                  <li>ابدأ الوصف بفعل واضح: <span className="font-semibold">حلّل، أنشئ، راقب، نظّم...</span>.</li>
                  <li>اذكر بوضوح هل الأداة تعمل تلقائياً أم تحتاج تفاعل من المستخدم.</li>
                </ul>
              </div>
              <div className="space-y-2">
                <h3 className="font-semibold text-foreground">الأيقونة والألوان</h3>
                <ul className="list-disc pr-5 space-y-1">
                  <li>اختر أيقونة Lucide تعبّر عن وظيفة الأداة (مثل <code className="px-1 py-0.5 rounded bg-muted text-xs">BarChart3</code> للتحليلات).</li>
                  <li>استخدم ألوان هادئة متناسقة مع هوية مرشح (primary / blue / violet).</li>
                  <li>تجنّب استخدام ألوان تحذيرية (أحمر قوي) إلا للأدوات الحرجة.</li>
                </ul>
              </div>
              <div className="space-y-2">
                <h3 className="font-semibold text-foreground">تجربة مالك المطعم</h3>
                <ul className="list-disc pr-5 space-y-1">
                  <li>تأكد أن الأداة لا تحتاج أكثر من ٣–٥ حقول إعداد أساسية.</li>
                  <li>إن كانت الأداة معقدة، وفر صفحة مساعدة أو فيديو قصير في الوصف.</li>
                  <li>خطّط للأخطاء (مثل انتهاء صلاحية التكامل أو نقص الصلاحيات) برسائل عربية واضحة.</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="example" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Code2 className="h-5 w-5 text-primary" />
                مثال برمجي لأداة داخل مرشح
              </CardTitle>
              <CardDescription>
                هذا مثال مبسّط على صفحة أداة تعمل داخل لوحة المالك، تقرأ المنيو وتعرض تحليلاً سريعاً.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-muted-foreground">
              <p className="font-semibold text-foreground">مثال صفحة أداة في <code className="px-1 py-0.5 rounded bg-muted text-xs">/owner/tools/smart-reviews/page.tsx</code>:</p>
              <pre className="bg-muted rounded-xl p-4 text-xs overflow-x-auto text-left ltr">
{`'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useUser } from '@/hooks/useUser';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export default function SmartReviewsToolPage() {
  const { user } = useUser();
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState<{ count: number; avg: number } | null>(null);

  useEffect(() => {
    if (!user?.restaurantId) return;

    const run = async () => {
      setIsLoading(true);
      const { data } = await supabase
        .from('reviews')
        .select('rating')
        .eq('restaurant_id', user.restaurantId);
      const docs = data ?? [];
      const count = docs.length;
      const avg = count ? docs.reduce((s, r) => s + (r.rating ?? 0), 0) / count : 0;
      setStats({ count, avg });
      setIsLoading(false);
    };

    run().catch(() => setIsLoading(false));
  }, [user?.restaurantId]);

  if (isLoading || !stats) {
    return <Skeleton className="h-40 w-full rounded-xl" />;
  }

  return (
    <Card dir="rtl">
      <CardHeader>
        <CardTitle>محلل التقييمات الذكي</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <p>عدد التقييمات: {stats.count}</p>
        <p>متوسط التقييم: {stats.avg.toFixed(1)} / 5</p>
      </CardContent>
    </Card>
  );
}`}
              </pre>
              <p>
                الفكرة: تربط هذه الصفحة بين تعريف الأداة في المتجر وبين منطقها البرمجي الفعلي، وكل أداة جديدة يمكن أن تتّبع نفس النمط:
                ملف Route تحت <code className="px-1 py-0.5 rounded bg-muted text-xs">/owner/tools/[toolId]</code> يقرأ بيانات المطعم وينفّذ وظيفة واحدة واضحة.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="prompt" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                برومبت مساعد لإنشاء أداة رهيبة
              </CardTitle>
              <CardDescription>
                استخدم هذا البرومبت مع أي نموذج ذكاء اصطناعي ليقترح لك فكرة أداة جديدة متوافقة مع متجر مرشح.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <p>انسخ هذا النص كما هو، ثم عدّل فقط الجزء الخاص بنوع الأداة إن رغبت:</p>
              <pre className="bg-muted rounded-xl p-4 text-xs whitespace-pre-wrap text-left ltr">
{`أنت تساعدني في بناء أداة داخل منصة مرشح لإدارة المطاعم.

أريد منك أن:
1) تقترح فكرة أداة واحدة مفيدة لأصحاب المطاعم أو الكافيهات داخل لوحة التحكم (مثال: محلل تقييمات، منسق منيو، صانع عروض...).
2) تعطي النتيجة بصيغة JSON فقط بدون شروحات إضافية، بالترتيب التالي:
   - id: معرف برمجي قصير بالإنجليزية الصغيرة وشرطة (-) فقط، بدون مسافات، مثل "smart-reviews".
   - title: عنوان عربي قصير وجذاب للأداة.
   - description: وصف عربي واضح يشرح ماذا تفعل الأداة في سطرين كحد أقصى.
   - category: أحد القيم التالية فقط: "marketing" أو "operations" أو "analytics".
   - price_label: نص عربي يصف السعر (مثل "مجاني" أو "50 ر.س / شهر").
   - icon: اسم أيقونة مناسبة من مكتبة Lucide (مثل "BarChart3", "Megaphone", "CalendarDays").
   - color: كلاس Tailwind يبدأ بـ "text-" مثل "text-primary" أو "text-blue-500".
   - bg_color: كلاس Tailwind يبدأ بـ "bg-" مثل "bg-primary/10" أو "bg-blue-500/10".
   - popular: true أو false حسب ما تراه مناسباً.

مثال شكل الـ JSON الذي أريده (فقط للتوضيح، لا تعِده كما هو):
{
  "id": "smart-reviews",
  "title": "محلل التقييمات الذكي",
  "description": "يجمع تقييمات العملاء ويقترح تحسينات عملية على المنيو والخدمة.",
  "category": "analytics",
  "price_label": "50 ر.س / شهر",
  "icon": "BarChart3",
  "color": "text-primary",
  "bg_color": "bg-primary/10",
  "popular": true
}

أعد لي النتيجة على شكل JSON صالح مباشرة لأستخدمه كملف tool.json داخل مرشح دون أي كلمات إضافية خارج JSON.`}
              </pre>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <p className="text-xs text-muted-foreground text-center">
        هل تحتاج تكامل أعمق للمطورين (SDK أو Webhooks مخصصة)؟ تواصل مع فريق مرشح عبر صفحة{' '}
        <Link href="/contact" className="underline font-semibold">
          تواصل معنا
        </Link>
        .
      </p>
    </div>
  );
}


