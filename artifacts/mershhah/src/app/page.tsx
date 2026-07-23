'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Logo } from '@/components/shared/Logo';
import { 
  Globe, 
  Bot, 
  TrendingUp, 
  Palette, 
  Store, 
  BarChart3,
  QrCode,
  Link as LinkIcon,
  ArrowLeft,
  Check
} from 'lucide-react';
import { Link } from 'wouter';
import { PublicFooter } from '@/components/shared/PublicFooter';

export default function HomePage() {
  const [currentYear, setCurrentYear] = useState<number | null>(null);

  useEffect(() => {
    setCurrentYear(new Date().getFullYear());
  }, []);

  const features = [
    {
      icon: Globe,
      title: "واجهة رقمية موحدة",
      description: "رابط واحد يجمع منيوك، عروضك، وفروعك. يعمل كرابط في البايو أو QR كود داخل الفرع."
    },
    {
      icon: Bot,
      title: "مساعد ذكي لعملائك",
      description: "يرد على استفسارات عملائك، يقترح أطباق، ويساعدهم على مدار الساعة."
    },
    {
      icon: TrendingUp,
      title: "أدوات نمو ذكية",
      description: "حوّل بياناتك إلى أرباح: تحليل المنيو، حاسبة الأرباح، وأكثر."
    },
    {
      icon: Palette,
      title: "استوديو الهوية",
      description: "صمم واجهاتك الرقمية بنفسك لتتناسب مع علامتك التجارية."
    },
    {
      icon: Store,
      title: "متجر أدوات إضافية",
      description: "فعّل أدوات تساعك على النمو مثل تقويم التسويق وكاتب المحتوى."
    },
    {
      icon: BarChart3,
      title: "تحليلات الأداء",
      description: "قرارات مبنية على أرقام دقيقة عن أداء مشروعك وسلوك عملائك."
    }
  ];

  const steps = [
    {
      icon: QrCode,
      title: "داخل الفرع",
      subtitle: "عبر QR",
      description: "يمسح العميل الكود على الطاولة فيظهر له منيو ت互动لي. يرى صور الأطباق، يقرأ المكونات، ويسأل المساعد الذكي."
    },
    {
      icon: LinkIcon,
      title: "خارج الفرع",
      subtitle: "عبر رابط",
      description: "رابط ذكي تضعه في انستقرام أو جوجل. أي شخص يبحث عنك يجد واجهة مرتبة بكل شيء."
    }
  ];

  return (
    <div className="min-h-screen overflow-x-hidden" dir="rtl">
      {/* Navbar */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex justify-between items-center">
          <Logo />
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" className="text-gray-600 text-sm font-bold hover:bg-gray-50 rounded-xl px-4">
              <Link href="/login">دخول</Link>
            </Button>
            <Button asChild className="bg-gray-900 text-white hover:bg-gray-800 rounded-xl text-sm font-bold px-5 h-9">
              <Link href="/register">ابدأ مجاناً</Link>
            </Button>
          </div>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="pt-20 pb-24 sm:pt-28 sm:pb-32 px-4">
          <div className="max-w-3xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 bg-gray-50 border border-gray-100 rounded-full px-4 py-1.5 mb-6">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
              <span className="text-[11px] font-bold text-gray-500">متوفر مجاناً للتجربة</span>
            </div>
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-black text-gray-900 leading-tight mb-6">
              الواجهة الرقمية <br className="hidden sm:block" />
              <span className="text-gray-400">الموحدة لمشروعك</span>
            </h1>
            <p className="text-base sm:text-lg text-gray-400 max-w-xl mx-auto mb-10 leading-relaxed">
              رابط واحد يجمع كل شيء: منيو تفاعلي، مساعد ذكي، وتحليلات. كل هذا مصمم خصيصاً للمطاعم والمقاهي.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <Button asChild className="w-full sm:w-auto h-12 px-8 bg-gray-900 text-white hover:bg-gray-800 rounded-xl text-sm font-bold">
                <Link href="/register">سجل الآن مجاناً</Link>
              </Button>
              <Button asChild variant="outline" className="w-full sm:w-auto h-12 px-8 rounded-xl text-sm font-bold border-gray-200 text-gray-600 hover:bg-gray-50">
                <Link href="/pricing">اكتشف الباقات</Link>
              </Button>
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="py-20 px-4 bg-gray-50/50">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-14">
              <h2 className="text-2xl sm:text-3xl font-black text-gray-900 mb-3">فريق عمل رقمي في جيبك</h2>
              <p className="text-sm text-gray-400 max-w-lg mx-auto">أدوات ذكية تعمل معاً لنمو مطعمك أو مقهاك.</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {features.map((f, i) => (
                <div key={i} className="bg-white border border-gray-100 rounded-2xl p-6 hover:border-gray-200 transition-colors">
                  <div className="w-11 h-11 rounded-xl bg-gray-50 flex items-center justify-center mb-4">
                    <f.icon className="h-5 w-5 text-gray-400" />
                  </div>
                  <h3 className="text-sm font-bold text-gray-900 mb-2">{f.title}</h3>
                  <p className="text-xs text-gray-400 leading-relaxed">{f.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* How it works */}
        <section className="py-20 px-4">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-14">
              <h2 className="text-2xl sm:text-3xl font-black text-gray-900 mb-3">بساطة في خطوتين</h2>
              <p className="text-sm text-gray-400">صممنا منصة للسرعة والتبسيط في قطاع الأغذية والمشروبات.</p>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              {steps.map((s, i) => (
                <div key={i} className="bg-white border border-gray-100 rounded-2xl p-8">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl bg-gray-900 text-white flex items-center justify-center text-sm font-black">
                      {i + 1}
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-gray-900">{s.title}</h3>
                      <span className="text-[10px] font-bold text-gray-300">{s.subtitle}</span>
                    </div>
                  </div>
                  <p className="text-xs text-gray-400 leading-relaxed">{s.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-20 px-4">
          <div className="max-w-3xl mx-auto">
            <div className="bg-gray-900 rounded-3xl p-10 sm:p-16 text-center">
              <h2 className="text-2xl sm:text-3xl font-black text-white mb-4">ابدأ رحلة التحول الرقمي اليوم</h2>
              <p className="text-sm text-gray-400 max-w-md mx-auto mb-8">
                انضم لمئات المطاعم والمقاهي التي تستخدم مرشّح لتجربة عملاء أذكى.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                <Button asChild className="w-full sm:w-auto h-11 px-8 bg-white text-gray-900 hover:bg-gray-100 rounded-xl text-sm font-bold">
                  <Link href="/register">ابدأ الآن مجاناً</Link>
                </Button>
                <Button asChild variant="ghost" className="w-full sm:w-auto h-11 px-8 text-white hover:bg-white/10 rounded-xl text-sm font-bold">
                  <Link href="/pricing">عرض الباقات</Link>
                </Button>
              </div>
            </div>
          </div>
        </section>
      </main>

      <PublicFooter />
    </div>
  );
}
