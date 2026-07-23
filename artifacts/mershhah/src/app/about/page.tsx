'use client';

import { Logo } from "@/components/shared/Logo";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Target, Eye, Handshake, Sparkles } from "lucide-react";
import { Link } from "wouter";
import { PublicFooter } from "@/components/shared/PublicFooter";

const values = [
  {
    icon: Sparkles,
    title: 'الابتكار',
    description: 'نبحث باستمرار عن حلول تقنية مبتكرة لتبسيط تعقيدات إدارة المشاريع في قطاع الأغذية.'
  },
  {
    icon: Handshake,
    title: 'الشراكة',
    description: 'نؤمن بأن نجاحنا يقاس بنجاح شركائنا من أصحاب المشاريع.'
  },
  {
    icon: Target,
    title: 'التركيز على النتائج',
    description: 'نصمم أدواتنا لمساعدتك على تحقيق نتائج ملموسة من زيادة المبيعات إلى تعزيز ولاء العملاء.'
  }
];

export default function AboutPage() {
  return (
    <div className="min-h-screen overflow-x-hidden" dir="rtl">
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex justify-between items-center">
          <Logo />
          <Button asChild variant="ghost" className="text-gray-600 text-sm font-bold hover:bg-gray-50 rounded-xl px-4">
            <Link href="/"><ArrowLeft className="ml-2 h-4 w-4" />العودة</Link>
          </Button>
        </div>
      </header>

      <main className="py-16 sm:py-24 px-4">
        <div className="max-w-3xl mx-auto text-center mb-20">
          <h1 className="text-3xl sm:text-4xl font-black text-gray-900 mb-4">من نحن</h1>
          <p className="text-sm text-gray-400 leading-relaxed">
            أنا أحمد، بنيت «مرشح» كمشروع فردي — منصة رقمية واحدة تجمع للمطاعم والمقاهي المنيو، المساعد الذكي، والتحليلات. المشروع يُدار بشكل مستقل في إطار وثيقة العمل الحر، وهدفي تمكين أصحاب المشاريع بأدوات بسيطة وفعّالة.
          </p>
        </div>

        <div className="max-w-4xl mx-auto grid sm:grid-cols-2 gap-4 mb-20">
          <div className="bg-white border border-gray-100 rounded-2xl p-6">
            <div className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center mb-4">
              <Eye className="h-5 w-5 text-gray-400" />
            </div>
            <h3 className="text-sm font-bold text-gray-900 mb-2">رؤيتنا</h3>
            <p className="text-xs text-gray-400 leading-relaxed">أن نكون الشريك التقني الأول لكل مطعم ومقهى في الشرق الأوسط، ونساهم في نموهم من خلال حلول ذكية ومبتكرة.</p>
          </div>
          <div className="bg-white border border-gray-100 rounded-2xl p-6">
            <div className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center mb-4">
              <Target className="h-5 w-5 text-gray-400" />
            </div>
            <h3 className="text-sm font-bold text-gray-900 mb-2">مهمتنا</h3>
            <p className="text-xs text-gray-400 leading-relaxed">توفير منصة سهلة الاستخدام وقوية تدمج بين الذكاء الاصطناعي وأدوات التسويق لمساعدة المشاريع على بناء علاقات أعمق مع عملائها.</p>
          </div>
        </div>

        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-10">
            <h2 className="text-xl font-black text-gray-900 mb-2">قيمنا الأساسية</h2>
            <p className="text-xs text-gray-400">المبادئ التي توجه كل قرار نتخذه.</p>
          </div>
          <div className="grid sm:grid-cols-3 gap-4">
            {values.map((v, i) => (
              <div key={i} className="bg-white border border-gray-100 rounded-2xl p-6 text-center">
                <div className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center mx-auto mb-4">
                  <v.icon className="h-5 w-5 text-gray-400" />
                </div>
                <h3 className="text-sm font-bold text-gray-900 mb-2">{v.title}</h3>
                <p className="text-xs text-gray-400 leading-relaxed">{v.description}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="text-center mt-20">
          <p className="text-sm text-gray-400 mb-4">سجّل واحصل على واجهتك الرقمية.</p>
          <Button asChild className="h-11 px-8 bg-gray-900 text-white hover:bg-gray-800 rounded-xl text-sm font-bold">
            <Link href="/register">ابدأ الآن</Link>
          </Button>
        </div>
      </main>

      <PublicFooter />
    </div>
  );
}
