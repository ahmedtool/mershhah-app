'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import { Database, Cloud, CreditCard, Sparkles, Mail, Shield, Info, Pencil, Loader2, RefreshCw, Image as ImageIcon, MapPin } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { formatDistanceToNow } from 'date-fns';
import { ar } from 'date-fns/locale';
import { UpdateServiceUsageDialog } from '@/components/admin/infrastructure/UpdateServiceUsageDialog';
import { useToast } from '@/hooks/use-toast';
import type { ServiceUsageRow } from '@/lib/types';

// Services synced automatically by the sync-service-usage Edge Function -
// the rest stay manual since no usable API exists for them (see the
// "استهلاك الخدمات" conversation).
const AUTO_SYNCED_KEYS = new Set(['streampay', 'mistral', 'cloudflare', 'sndr', 'imagekit']);

type ServiceStatus = 'ok' | 'warning' | 'critical' | 'unknown';

type ServiceMeta = {
  key: string;
  name: string;
  icon: any;
  description: string;
  dashboardUrl: string;
};

// Descriptive metadata only - the actual numbers live in service_usage
// (manually entered, since most providers don't expose billing-quota usage
// through a public API - see the "استهلاك الخدمات" conversation).
const SERVICES: ServiceMeta[] = [
  {
    key: 'supabase',
    name: 'Supabase',
    icon: Database,
    description: 'قاعدة البيانات، المصادقة، التخزين، وEdge Functions',
    dashboardUrl: 'https://supabase.com/dashboard/project/smmriycsboexindabanc/settings/billing/usage',
  },
  {
    key: 'vercel',
    name: 'Vercel',
    icon: Cloud,
    description: 'استضافة الموقع (الواجهة وAPI)',
    dashboardUrl: 'https://vercel.com/dashboard',
  },
  {
    key: 'streampay',
    name: 'StreamPay',
    icon: CreditCard,
    description: 'بوابة الدفع وإدارة الاشتراكات',
    dashboardUrl: 'https://app.streampay.sa',
  },
  {
    key: 'mistral',
    name: 'Mistral AI',
    icon: Sparkles,
    description: 'المساعد الذكي وتحليل قوائم الطعام',
    dashboardUrl: 'https://console.mistral.ai/usage',
  },
  {
    key: 'sndr',
    name: 'SNDR',
    icon: Mail,
    description: 'إرسال البريد الإلكتروني (فواتير وتنبيهات)',
    dashboardUrl: 'https://sndr.sh',
  },
  {
    key: 'cloudflare',
    name: 'Cloudflare',
    icon: Shield,
    description: 'تحليلات وحماية الموقع',
    dashboardUrl: 'https://dash.cloudflare.com',
  },
  {
    key: 'imagekit',
    name: 'ImageKit',
    icon: ImageIcon,
    description: 'رفع وتخزين وتحويل الصور (لوقو، صور المنتجات)',
    dashboardUrl: 'https://imagekit.io/dashboard/usage',
  },
  {
    key: 'google_maps',
    name: 'Google Maps',
    icon: MapPin,
    description: 'تحويل عنوان الفرع لإحداثيات (Geocoding)',
    dashboardUrl: 'https://console.cloud.google.com/billing',
  },
];

const statusConfig: Record<ServiceStatus, { label: string; className: string }> = {
  ok: { label: 'جيد', className: 'bg-emerald-50 text-emerald-700' },
  warning: { label: 'قريب من الحد', className: 'bg-amber-50 text-amber-700' },
  critical: { label: 'تجاوز الحد', className: 'bg-red-50 text-red-700' },
  unknown: { label: 'ما تم إدخال بيانات', className: 'bg-gray-100 text-gray-600' },
};

function computeStatus(usage: number | null, limit: number | null): ServiceStatus {
  if (usage == null || limit == null || limit <= 0) return 'unknown';
  const pct = (usage / limit) * 100;
  if (pct >= 100) return 'critical';
  if (pct >= 80) return 'warning';
  return 'ok';
}

export default function InfrastructurePage() {
  const [rows, setRows] = useState<Record<string, ServiceUsageRow>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const { toast } = useToast();

  const fetchUsage = useCallback(async () => {
    const { data } = await supabase.from('service_usage').select('*');
    const map: Record<string, ServiceUsageRow> = {};
    for (const row of (data || []) as ServiceUsageRow[]) map[row.service_key] = row;
    setRows(map);
    setIsLoading(false);
  }, []);

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sync-service-usage`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'فشلت المزامنة');

      const synced = (data.results || []).filter((r: any) => r.status === 'synced').map((r: any) => r.service);
      const skipped = (data.results || []).filter((r: any) => r.status === 'skipped');
      const failed = (data.results || []).filter((r: any) => r.status === 'failed');

      if (failed.length > 0) {
        toast({ title: 'اكتملت المزامنة مع أخطاء', description: failed.map((f: any) => `${f.service}: ${f.detail}`).join(' — '), variant: 'destructive' });
      } else if (synced.length > 0) {
        toast({ title: 'تمت المزامنة', description: `تحديث: ${synced.join('، ')}${skipped.length > 0 ? ` — تخطي (بدون مفتاح): ${skipped.map((s: any) => s.service).join('، ')}` : ''}` });
      } else {
        toast({ title: 'ما تم تحديث أي خدمة', description: 'كل الخدمات محتاجة مفتاح API غير مُعدّ بعد.' });
      }
      await fetchUsage();
    } catch (error: any) {
      toast({ title: 'خطأ في المزامنة', description: error.message, variant: 'destructive' });
    } finally {
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    fetchUsage();
    const channel = supabase
      .channel('service-usage-admin')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'service_usage' }, () => fetchUsage())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchUsage]);

  const editingService = useMemo(() => SERVICES.find((s) => s.key === editingKey) || null, [editingKey]);

  return (
    <div className="p-4 lg:p-6 space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-gray-900">استهلاك الخدمات</h1>
          <p className="text-xs text-gray-600 mt-0.5">مراقبة كل الخدمات الخارجية اللي تعتمد عليها المنصة، وكم مستهلك من كل وحدة</p>
        </div>
        <button
          onClick={handleSync}
          disabled={isSyncing}
          className="h-9 px-4 rounded-xl bg-gray-900 text-white text-xs font-bold hover:bg-gray-800 transition-colors disabled:opacity-50 flex items-center gap-2 shrink-0"
        >
          {isSyncing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          مزامنة تلقائية الآن
        </button>
      </div>

      <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4 flex items-start gap-3">
        <Info className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
        <p className="text-xs text-amber-800 leading-relaxed">
          أغلب مزوّدي الخدمات ما يعطون نسبة الاستهلاك مقابل الحد عبر API عام (بيانات لوحة الفوترة نفسها فقط) — لهذا الأرقام هنا تُدخل يدويًا من لوحة كل خدمة. اضغط "تحديث" على أي خدمة عشان تدخل آخر رقم شفته، أو اضغط على اسم الخدمة يوديك للوحتها الفعلية بتبويب جديد.
        </p>
      </div>

      <div className="rounded-2xl border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <div className="min-w-[960px]">
            <div className="grid grid-cols-[1.6fr_.8fr_.8fr_.8fr_.8fr_1.2fr_1fr_.9fr_.6fr] gap-3 items-center px-5 py-3 bg-gray-50 border-b border-gray-100 text-[11px] font-bold text-gray-600">
              <div>الخدمة</div>
              <div>الخطة</div>
              <div>الاستخدام</div>
              <div>الحد</div>
              <div>المتبقي</div>
              <div>نسبة الاستهلاك</div>
              <div>الحالة</div>
              <div>آخر تحديث</div>
              <div />
            </div>
            <div className="divide-y divide-gray-50">
              {isLoading ? (
                <div className="py-14 text-center">
                  <Loader2 className="h-5 w-5 animate-spin text-gray-400 mx-auto" />
                </div>
              ) : (
                SERVICES.map((s) => {
                  const Icon = s.icon;
                  const row = rows[s.key] || null;
                  const usage = row?.usage_value ?? null;
                  const limit = row?.limit_value ?? null;
                  const pct = usage != null && limit != null && limit > 0 ? Math.min(100, Math.round((usage / limit) * 100)) : 0;
                  const status = statusConfig[computeStatus(usage, limit)];
                  const remaining = usage != null && limit != null ? `${Math.max(0, Math.round((limit - usage) * 100) / 100)} ${row?.limit_unit || ''}`.trim() : '—';

                  return (
                    <div key={s.key} className="grid grid-cols-[1.6fr_.8fr_.8fr_.8fr_.8fr_1.2fr_1fr_.9fr_.6fr] gap-3 items-center px-5 py-3.5">
                      <a href={s.dashboardUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 min-w-0 hover:opacity-80 transition-opacity">
                        <div className="w-9 h-9 rounded-xl bg-gray-900 text-white flex items-center justify-center shrink-0">
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className="text-xs font-bold text-gray-900 truncate">{s.name}</p>
                            {AUTO_SYNCED_KEYS.has(s.key) && (
                              <span className="shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded bg-blue-50 text-blue-600">تلقائي</span>
                            )}
                          </div>
                          <p className="text-[10px] text-gray-600 truncate">{s.description}</p>
                        </div>
                      </a>
                      <div className="text-xs text-gray-700 truncate">{row?.plan || '—'}</div>
                      <div className="text-xs text-gray-700 truncate">{usage != null ? `${usage} ${row?.usage_unit || ''}` : '—'}</div>
                      <div className="text-xs text-gray-700 truncate">{limit != null ? `${limit} ${row?.limit_unit || ''}` : '—'}</div>
                      <div className="text-xs text-gray-700 truncate">{remaining}</div>
                      <div>
                        <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                          <div
                            className={`h-full rounded-full ${pct >= 100 ? 'bg-red-500' : pct >= 80 ? 'bg-amber-500' : 'bg-gray-900'}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                      <div>
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-[10px] font-bold whitespace-nowrap ${status.className}`}>
                          {status.label}
                        </span>
                      </div>
                      <div className="text-[10px] text-gray-600 truncate">
                        {row?.updated_at ? formatDistanceToNow(new Date(row.updated_at), { addSuffix: true, locale: ar }) : '—'}
                      </div>
                      <div className="flex justify-end">
                        <button
                          onClick={() => setEditingKey(s.key)}
                          className="w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center text-gray-600 hover:bg-gray-50 transition-colors"
                          title="تحديث"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-gray-100 p-5">
        <h2 className="text-sm font-bold text-gray-900 mb-1">تنبيهات ذكية</h2>
        <p className="text-[10px] text-gray-600 mb-4">تظهر تلقائيًا لأي خدمة توصل نسبة استهلاكها 80% فأكثر</p>
        {(() => {
          const alerts = SERVICES
            .map((s) => ({ s, row: rows[s.key] }))
            .filter(({ row }) => row && row.usage_value != null && row.limit_value != null && row.limit_value > 0 && (row.usage_value / row.limit_value) >= 0.8);
          if (alerts.length === 0) {
            return <div className="py-10 text-center"><p className="text-xs text-gray-600">ما فيه تنبيهات حاليًا</p></div>;
          }
          return (
            <div className="space-y-2">
              {alerts.map(({ s, row }) => {
                const pct = Math.round((row!.usage_value! / row!.limit_value!) * 100);
                const isCritical = pct >= 100;
                return (
                  <div key={s.key} className={`flex items-center gap-2.5 rounded-xl px-4 py-2.5 text-xs font-bold ${isCritical ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'}`}>
                    <Info className="h-3.5 w-3.5 shrink-0" />
                    {s.name} {isCritical ? 'تجاوز الحد' : `وصل ${pct}% من الحد`}
                  </div>
                );
              })}
            </div>
          );
        })()}
      </div>

      {editingService && (
        <UpdateServiceUsageDialog
          serviceKey={editingService.key}
          serviceName={editingService.name}
          open={!!editingKey}
          onOpenChange={(open) => !open && setEditingKey(null)}
          existing={rows[editingService.key] || null}
          onSaved={fetchUsage}
        />
      )}
    </div>
  );
}
