'use client';

import { Logo } from "@/components/shared/Logo";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { Link } from "wouter";
import { PublicFooter } from "@/components/shared/PublicFooter";

export default function PrivacyPage() {
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
        <div className="max-w-3xl mx-auto">
          <h1 className="text-2xl sm:text-3xl font-black text-gray-900 mb-3">سياسة الخصوصية</h1>
          <p className="text-xs text-gray-400 mb-10 leading-relaxed">
            نحن في «مرشح» نحترم خصوصيتك ونلتزم بحماية بياناتك الشخصية. تصف هذه السياسة كيفية جمعنا لمعلوماتك واستخدامها عند استخدامك لمنصتنا.
          </p>

          <div className="space-y-8">
            {sections.map((s, i) => (
              <div key={i}>
                <h2 className="text-sm font-bold text-gray-900 mb-2">{s.title}</h2>
                <p className="text-xs text-gray-400 leading-relaxed">{s.content}</p>
              </div>
            ))}
          </div>

          <p className="text-[10px] text-gray-300 mt-10">ننصح بمراجعة هذه الصفحة دوريًا للاطلاع على أي تحديثات.</p>
        </div>
      </main>

      <PublicFooter />
    </div>
  );
}

const sections = [
  { title: "1. المسؤول عن المعالجة", content: "المسؤول عن معالجة بياناتك الشخصية هو مقدم الخدمة (صاحب المشروع). يمكنك التواصل معنا عبر صفحة «تواصل معنا» لأي استفسار متعلق بالخصوصية." },
  { title: "2. البيانات التي نجمعها", content: "قد نجمع بيانات الحساب (الاسم، البريد، الجوال)، بيانات المشروع (الاسم، الشعار، القوائم)، والمراسلات والدعم. كما نجمع تلقائيًا بيانات الاستخدام والتقنية وملفات تعريف الارتباط." },
  { title: "3. الأغراض القانونية", content: "نستخدم بياناتك لتقديم الخدمة وإدارتها، الدعم الفني، تحسين الخدمة والأمان، الامتثال القانوني، والتسويق بموافقتك فقط." },
  { title: "4. مشاركة البيانات", content: "لا نبيع بياناتك. قد نشاركها مع مقدمي الخدمات المختارين، وتكون المحتوى العامة مرئية للمستخدمين، ونكشف عنها عند المتطلبات القانونية فقط." },
  { title: "5. الاحتفاظ بالبيانات", content: "نحتفظ ببياناتك طالما حسابك نشطًا أو كما هو مطلوب قانونيًا. بعد الإغلاق، نحذف البيانات أو نجهزها بحيث لا تعود قابلة للتعريف." },
  { title: "6. أمان البيانات", content: "نطبق تدابير فنية وتنظيمية لحماية بياناتك من الوصول غير المصرح به. لا يوجد نقل أو تخزين إلكتروني آمن بنسبة 100%." },
  { title: "7. حقوقك", content: "لك الحق في الوصول إلى بياناتك، تصحيحها، حذفها، تقييد معالجتها، أو سحب موافقتك. تواصل معنا لممارسة أي من هذه الحقوق." },
  { title: "8. خصوصية القاصرين", content: "الخدمة غير موجهة لمن تقل أعمارهم عن السن المحدد. لا نجمع عن قصد بيانات شخصية من قاصرين." },
  { title: "9. التخزين والنقل الدولي", content: "قد تُخزَّن بياناتك على خوادم داخل أو خارج المملكة. نلتزم بتطبيق ضمانات مناسبة لحماية بياناتك." },
  { title: "10. التعديلات", content: "قد نحدّث هذه السياسة من وقت لآخر. سننشر النسخة المحدثة على هذه الصفحة مع تاريخ آخر تحديث." },
  { title: "11. اتصل بنا", content: "لأي استفسار حول الخصوصية أو لممارسة حقوقك، تواصل معنا عبر صفحة «تواصل معنا» أو البريد الإلكتروني." },
];
