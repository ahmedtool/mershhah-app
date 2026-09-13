'use client';

import { Database, Cloud, CreditCard, Sparkles, Mail, Shield, Info } from 'lucide-react';

type ServiceStatus = 'ok' | 'warning' | 'critical' | 'unknown';

type ServiceRow = {
  name: string;
  icon: any;
  description: string;
  plan: string;
  usageLabel: string;
  limitLabel: string;
  remainingLabel: string;
  usagePercent: number | null;
  status: ServiceStatus;
  dashboardUrl: string;
};

// Placeholder only — every numeric field here is a stand-in until each
// service is actually wired up (official usage API where the provider
// offers one, a manual entry otherwise). usagePercent stays null rather
// than 0 so the progress bar reads as "unknown", not "empty and fine".
const SERVICES: ServiceRow[] = [
  {
    name: 'Supabase',
    icon: Database,
    description: 'قاعدة البيانات، المصادقة، التخزين، وEdge Functions',
    plan: '—',
    usageLabel: '—',
    limitLabel: '—',
    remainingLabel: '—',
    usagePercent: null,
    status: 'unknown',
    dashboardUrl: 'https://supabase.com/dashboard/project/smmriycsboexindabanc/settings/billing/usage',
  },
  {
    name: 'Vercel',
    icon: Cloud,
    description: 'استضافة الموقع (الواجهة وAPI)',
    plan: '—',
    usageLabel: '—',
    limitLabel: '—',
    remainingLabel: '—',
    usagePercent: null,
    status: 'unknown',
    dashboardUrl: 'https://vercel.com/dashboard',
  },
  {
    name: 'StreamPay',
    icon: CreditCard,
    description: 'بوابة الدفع وإدارة الاشتراكات',
    plan: '—',
    usageLabel: '—',
    limitLabel: '—',
    remainingLabel: '—',
    usagePercent: null,
    status: 'unknown',
    dashboardUrl: 'https://app.streampay.sa',
  },
  {
    name: 'Mistral AI',
    icon: Sparkles,
    description: 'المساعد الذكي وتحليل قوائم الطعام',
    plan: '—',
    usageLabel: '—',
    limitLabel: '—',
    remainingLabel: '—',
    usagePercent: null,
    status: 'unknown',
    dashboardUrl: 'https://console.mistral.ai/usage',
  },
  {
    name: 'SNDR',
    icon: Mail,
    description: 'إرسال البريد الإلكتروني (فواتير وتنبيهات)',
    plan: '—',
    usageLabel: '—',
    limitLabel: '—',
    remainingLabel: '—',
    usagePercent: null,
    status: 'unknown',
    dashboardUrl: 'https://sndr.sh',
  },
  {
    name: 'Cloudflare',
    icon: Shield,
    description: 'تحليلات وحماية الموقع',
    plan: '—',
    usageLabel: '—',
    limitLabel: '—',
    remainingLabel: '—',
    usagePercent: null,
    status: 'unknown',
    dashboardUrl: 'https://dash.cloudflare.com',
  },
];

const statusConfig: Record<ServiceStatus, { label: string; className: string }> = {
  ok: { label: 'جيد', className: 'bg-emerald-50 text-emerald-700' },
  warning: { label: 'قريب من الحد', className: 'bg-amber-50 text-amber-700' },
  critical: { label: 'تجاوز الحد', className: 'bg-red-50 text-red-700' },
  unknown: { label: 'لم يُربط بعد', className: 'bg-gray-100 text-gray-600' },
};

export default function InfrastructurePage() {
  return (
    <div className="p-4 lg:p-6 space-y-5">
      <div>
        <h1 className="text-lg font-bold text-gray-900">استهلاك الخدمات</h1>
        <p className="text-xs text-gray-600 mt-0.5">مراقبة كل الخدمات الخارجية اللي تعتمد عليها المنصة، وكم مستهلك من كل وحدة</p>
      </div>

      <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4 flex items-start gap-3">
        <Info className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
        <p className="text-xs text-amber-800 leading-relaxed">
          هذي الصفحة واجهة أولية فقط — الأرقام أدناه غير مربوطة ببيانات حقيقية لسا. كل خدمة تحتاج ربط منفصل (API رسمي للاستهلاك حيث متاح، أو إدخال يدوي لباقي الخدمات) قبل ما تعكس الاستهلاك الفعلي. اضغط على أي خدمة يوديك للوحتها الفعلية بتبويب جديد.
        </p>
      </div>

      <div className="rounded-2xl border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <div className="min-w-[860px]">
            <div className="grid grid-cols-[1.7fr_.8fr_.8fr_.8fr_.8fr_1.3fr_1fr] gap-3 items-center px-5 py-3 bg-gray-50 border-b border-gray-100 text-[11px] font-bold text-gray-600">
              <div>الخدمة</div>
              <div>الخطة</div>
              <div>الاستخدام</div>
              <div>الحد</div>
              <div>المتبقي</div>
              <div>نسبة الاستهلاك</div>
              <div>الحالة</div>
            </div>
            <div className="divide-y divide-gray-50">
              {SERVICES.map((s) => {
                const Icon = s.icon;
                const status = statusConfig[s.status];
                return (
                  <a
                    key={s.name}
                    href={s.dashboardUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="grid grid-cols-[1.7fr_.8fr_.8fr_.8fr_.8fr_1.3fr_1fr] gap-3 items-center px-5 py-3.5 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-xl bg-gray-900 text-white flex items-center justify-center shrink-0">
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-gray-900 truncate">{s.name}</p>
                        <p className="text-[10px] text-gray-600 truncate">{s.description}</p>
                      </div>
                    </div>
                    <div className="text-xs text-gray-700">{s.plan}</div>
                    <div className="text-xs text-gray-700">{s.usageLabel}</div>
                    <div className="text-xs text-gray-700">{s.limitLabel}</div>
                    <div className="text-xs text-gray-700">{s.remainingLabel}</div>
                    <div>
                      <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-gray-300"
                          style={{ width: s.usagePercent !== null ? `${s.usagePercent}%` : '0%' }}
                        />
                      </div>
                    </div>
                    <div>
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-[10px] font-bold whitespace-nowrap ${status.className}`}>
                        {status.label}
                      </span>
                    </div>
                  </a>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-gray-100 p-5">
        <h2 className="text-sm font-bold text-gray-900 mb-1">تنبيهات ذكية</h2>
        <p className="text-[10px] text-gray-600 mb-4">مثل: "Supabase تجاوز 80% من الحد" أو "باقي 9 أيام قبل تجاوز حد البريد"</p>
        <div className="py-10 text-center">
          <p className="text-xs text-gray-600">ما فيه تنبيهات حاليًا — تحتاج ربط الخدمات ببيانات حقيقية أولاً</p>
        </div>
      </div>
    </div>
  );
}
