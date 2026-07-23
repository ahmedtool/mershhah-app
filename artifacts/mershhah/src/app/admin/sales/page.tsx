'use client';

import { Sparkles, Store, UtensilsCrossed, Star, MessageCircle, Bot, Link2, Megaphone, Target, Lightbulb, ExternalLink, Copy, Check, ChevronDown } from "lucide-react";
import { Link } from "wouter";
import { useState } from "react";

const pitchShort =
  "مرشح منصة رقمية متكاملة للمطاعم والمقاهي في السعودية: صفحة واحدة تجمع المنيو، الفروع، التقييمات، الدعم، والمساعد الذكي — مع ربط تطبيقات التوصيل ووسائل التواصل.";

const pitchMedium = `مرشح يساعد المطاعم والمقاهي أن يكون لها وجود رقمي واحد وواضح للعميل: صفحة هبوط خاصة بالمطعم تعرض المنيو، الفروع، العروض، التقييمات، وفتح تذاكر الدعم. يضاف لها مساعد ذكي يجاوب عن أسئلة الزبون بلغة طبيعية ويعرّفه بالتطبيقات والفروع وطرق التواصل.`;

const talkingPoints = [
  { title: "صفحة واحدة للعميل", desc: "رابط واحد يجمع المنيو، الفروع، العروض، التقييمات والدعم بدل توزيع الروابط." },
  { title: "مساعد ذكي بالعربي", desc: "يجيب عن أسئلة الزبون (المنيو، التوصيل، الفروع، أوقات العمل) ويُظهر أزرار واتساب والخرائط." },
  { title: "ربط التوصيل والتواصل", desc: "إظهار تطبيقات التوصيل ووسائل التواصل من واجهة واحدة." },
  { title: "تقييمات وسمعة", desc: "صفحة تقييمات مخصصة تساعد في بناء الثقة والسمعة." },
  { title: "لوحة تحكم للمالك", desc: "إدارة المنيو، الفروع، العروض، والإعدادات من مكان واحد." },
  { title: "أدوات إضافية", desc: "إمكانية تفعيل أدوات مثل كتابة المحتوى والتسويق من داخل المنصة." },
];

const objections = [
  { objection: "عندنا موقع أو إنستقرام يكفينا", response: "مرشح لا يلغي الموقع أو الإنستقرام، بل يعطيك رابط واحد يجمّع كل شيء للعميل. العميل ما يحتاج يبحث في أكثر من مكان." },
  { objection: "غالي أو الميزانية محدودة", response: "نقدّم باقات تناسب أحجام مختلفة. يمكن البدء بباقة أساسية ثم الترقية. تكلفة عدم وجود منصة واضحة أعلى من الاشتراك." },
  { objection: "ما نعرف نستخدم تقنية معقدة", response: "الواجهة بالعربي وواضحة. المالك يملأ بياناته مرة واحدة وبعدها الصفحة والمساعد يعملان تلقائياً." },
  { objection: "متى نرى النتائج؟", response: "بمجرد الاشتراك تحصل على رابط الصفحة. يمكن مشاركته فوراً على الواتساب والإنستقرام." },
];

const features = [
  { icon: Store, title: "صفحة هاب", desc: "رابط واحد يعرض العروض، المنيو، الفروع وروابط التوصيل والدعم." },
  { icon: UtensilsCrossed, title: "المنيو الرقمي", desc: "صفحة منيو مرتبة مع تصنيفات وصور وأسعار." },
  { icon: Target, title: "الفروع والمواقع", desc: "عرض الفروع مع العناوين، أوقات العمل، واتساب، وخرائط غوغل." },
  { icon: Star, title: "التقييمات", desc: "صفحة تقييمات مخصصة لبناء السمعة والثقة." },
  { icon: MessageCircle, title: "الدعم والتذاكر", desc: "صفحة دعم للعميل ولوحة للمالك لمتابعة المحادثات." },
  { icon: Bot, title: "المساعد الذكي", desc: "يجيب بالعربي عن المنيو، التوصيل، الفروع والمواعيد." },
  { icon: Link2, title: "تطبيقات التوصيل", desc: "ربط هنقرستشن، طلبات، وإنستقرام في مكان واحد." },
  { icon: Megaphone, title: "العروض والترويج", desc: "عرض العروض الحالية في الصفحة والهاب." },
];

const tabs = [
  { id: 'what', label: 'ما هو مرشح' },
  { id: 'who', label: 'لمن مرشح' },
  { id: 'features', label: 'المزايا' },
  { id: 'pitch', label: 'كيف تسوق' },
  { id: 'objections', label: 'اعتراضات' },
  { id: 'links', label: 'روابط' },
];

export default function AdminSalesPage() {
  const [activeTab, setActiveTab] = useState('what');
  const [copied, setCopied] = useState(false);
  const [expandedObjection, setExpandedObjection] = useState<number | null>(null);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="p-4 lg:p-6 space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-lg font-bold text-gray-900">دليل المبيعات</h1>
        <p className="text-xs text-gray-400 mt-0.5">تعرف على مرشح وكيف تسوق له</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 rounded-xl text-xs font-medium transition-all whitespace-nowrap ${activeTab === tab.id ? 'bg-gray-900 text-white' : 'bg-white border border-gray-200 text-gray-500 hover:border-gray-300'}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="min-h-[400px]">
        {/* What */}
        {activeTab === 'what' && (
          <div className="rounded-2xl border border-gray-100 overflow-hidden">
            <div className="px-5 pt-5 pb-4">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center">
                  <Sparkles className="h-5 w-5 text-purple-500" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-gray-900">ما هو مرشح؟</h2>
                  <p className="text-[11px] text-gray-400">تعريف مختصر للمنتج</p>
                </div>
              </div>
              <p className="text-sm text-gray-600 leading-relaxed">{pitchMedium}</p>
            </div>
            <div className="px-5 pb-5">
              <div className="bg-gray-50 rounded-xl p-4">
                <p className="text-[11px] text-gray-400 mb-2">نسخة قصيرة:</p>
                <p className="text-xs text-gray-600 mb-3">{pitchShort}</p>
                <button
                  onClick={() => handleCopy(pitchShort)}
                  className="h-8 px-3 rounded-lg bg-white border border-gray-200 text-[11px] font-medium text-gray-500 hover:border-gray-300 transition-colors flex items-center gap-1.5"
                >
                  {copied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                  {copied ? 'تم النسخ' : 'نسخ'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Who */}
        {activeTab === 'who' && (
          <div className="rounded-2xl border border-gray-100 p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
                <Target className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-gray-900">لمن مرشح؟</h2>
                <p className="text-[11px] text-gray-400">الشريحة المستهدفة</p>
              </div>
            </div>
            <div className="space-y-2">
              {[
                'مطاعم ومقاهي في المملكة العربية السعودية',
                'منشآت تريد وجوداً رقمياً واحداً للعميل',
                'من يريد مساعداً ذكياً يرد على أسئلة الزبون بالعربية',
                'من يريد ربط تطبيقات التوصيل ووسائل التواصل',
                'المشاريع الصغيرة والمتوسطة التي تريد بداية سريعة',
              ].map((item, i) => (
                <div key={i} className="flex items-start gap-2.5 py-2">
                  <span className="w-5 h-5 rounded-full bg-gray-100 flex items-center justify-center shrink-0 mt-0.5">
                    <span className="text-[10px] font-bold text-gray-500">{i + 1}</span>
                  </span>
                  <span className="text-xs text-gray-600">{item}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Features */}
        {activeTab === 'features' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {features.map((f) => {
              const Icon = f.icon;
              return (
                <div key={f.title} className="rounded-2xl border border-gray-100 p-4 flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center shrink-0">
                    <Icon className="h-5 w-5 text-gray-500" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-gray-700 mb-0.5">{f.title}</p>
                    <p className="text-[11px] text-gray-400">{f.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Pitch */}
        {activeTab === 'pitch' && (
          <div className="space-y-3">
            <div className="rounded-2xl border border-gray-100 p-5">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center">
                  <Megaphone className="h-5 w-5 text-emerald-500" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-gray-900">كيف تسوق لمرشح</h2>
                  <p className="text-[11px] text-gray-400">نقاط الحديث الأساسية</p>
                </div>
              </div>
              <p className="text-xs text-gray-500 mb-4">ركّز على الفائدة للعميل النهائي: تقليل التشتت، رد أسرع على الزبون، وجود رقمي واحد.</p>
              <div className="space-y-2">
                {talkingPoints.map((tp) => (
                  <div key={tp.title} className="bg-gray-50 rounded-xl p-3">
                    <p className="text-xs font-bold text-gray-700 mb-0.5">{tp.title}</p>
                    <p className="text-[11px] text-gray-400">{tp.desc}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-2xl bg-amber-50 border border-amber-100 p-4 flex items-start gap-3">
              <Lightbulb className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-bold text-amber-700 mb-0.5">نصيحة</p>
                <p className="text-[11px] text-amber-600">اعرض تجربة حية: ادخل على صفحة هاب لأحد المشتركين وورّهم المنيو والمساعد الذكي.</p>
              </div>
            </div>
          </div>
        )}

        {/* Objections */}
        {activeTab === 'objections' && (
          <div className="space-y-2">
            {objections.map((o, i) => (
              <div key={i} className="rounded-2xl border border-gray-100 overflow-hidden">
                <button
                  onClick={() => setExpandedObjection(expandedObjection === i ? null : i)}
                  className="w-full px-5 py-4 flex items-center justify-between text-right hover:bg-gray-50 transition-colors"
                >
                  <span className="text-xs font-bold text-red-500">«{o.objection}»</span>
                  <ChevronDown className={`h-4 w-4 text-gray-300 transition-transform ${expandedObjection === i ? 'rotate-180' : ''}`} />
                </button>
                {expandedObjection === i && (
                  <div className="px-5 pb-4 border-t border-gray-50">
                    <p className="text-xs text-gray-500 mt-3 leading-relaxed">{o.response}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Links */}
        {activeTab === 'links' && (
          <div className="rounded-2xl border border-gray-100 p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-cyan-50 flex items-center justify-center">
                <ExternalLink className="h-5 w-5 text-cyan-500" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-gray-900">روابط سريعة</h2>
                <p className="text-[11px] text-gray-400">روابط تهم فريق المبيعات</p>
              </div>
            </div>
            <div className="space-y-2">
              <Link href="/pricing" target="_blank" rel="noopener noreferrer">
                <div className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 hover:bg-gray-50 transition-colors cursor-pointer">
                  <ExternalLink className="h-4 w-4 text-gray-400" />
                  <span className="text-xs font-medium text-gray-700">صفحة التسعير</span>
                </div>
              </Link>
              <Link href="/" target="_blank" rel="noopener noreferrer">
                <div className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 hover:bg-gray-50 transition-colors cursor-pointer">
                  <ExternalLink className="h-4 w-4 text-gray-400" />
                  <span className="text-xs font-medium text-gray-700">الصفحة الرئيسية</span>
                </div>
              </Link>
            </div>
            <p className="text-[11px] text-gray-300 mt-3">شارك رابط صفحة التسعير مع العملاء المحتملين لمعرفة الباقات والأسعار.</p>
          </div>
        )}
      </div>
    </div>
  );
}
