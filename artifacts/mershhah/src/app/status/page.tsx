
import { Logo } from "@/components/shared/Logo";
import { Button } from "@/components/ui/button";
import { ArrowLeft, CheckCircle2, Bot, LayoutDashboard, Bell } from "lucide-react";
import { Link } from "wouter";
import { PublicFooter } from "@/components/shared/PublicFooter";

const services = [
  { name: "المساعد الذكي وواجهة المحادثة", icon: Bot, status: "شغالة" },
  { name: "لوحات التحكم (للأدمن وأصحاب المطاعم)", icon: LayoutDashboard, status: "شغالة" },
  { name: "نظام الإشعارات والتنبيهات", icon: Bell, status: "شغالة" },
];

export default function StatusPage() {
  const allOk = services.every(s => s.status === "شغالة");

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
        <div className="max-w-lg mx-auto text-center mb-12">
          <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4 ${allOk ? 'bg-emerald-50' : 'bg-amber-50'}`}>
            <CheckCircle2 className={`h-7 w-7 ${allOk ? 'text-emerald-500' : 'text-amber-500'}`} />
          </div>
          <h1 className="text-2xl font-black text-gray-900 mb-2">
            {allOk ? 'كل الأنظمة شغالة' : 'توجد مشاكل في بعض الخدمات'}
          </h1>
          <p className="text-xs text-gray-400">
            {allOk ? 'جميع خدماتنا تعمل بشكل طبيعي. لا توجد مشاكل حالية.' : 'بعض الخدمات قد تواجه تأخراً مؤقتاً.'}
          </p>
        </div>

        <div className="max-w-lg mx-auto space-y-2">
          {services.map((s) => (
            <div key={s.name} className="bg-white border border-gray-100 rounded-xl px-5 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <s.icon className="h-4 w-4 text-gray-300" />
                <span className="text-xs font-bold text-gray-700">{s.name}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                <span className="text-[10px] font-bold text-emerald-600">{s.status}</span>
              </div>
            </div>
          ))}
        </div>
      </main>

      <PublicFooter />
    </div>
  );
}
