'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import { Database, Cloud, CreditCard, Sparkles, Mail, Shield, Info, Pencil, Loader2, RefreshCw, Image as ImageIcon, MapPin, Trophy, Users } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { formatDistanceToNow } from 'date-fns';
import { ar } from 'date-fns/locale';
import { UpdateServiceUsageDialog } from '@/components/admin/infrastructure/UpdateServiceUsageDialog';
import { useToast } from '@/hooks/use-toast';
import type { ServiceUsageRow } from '@/lib/types';

// Services synced automatically by the sync-service-usage Edge Function -
// the rest stay manual since no usable API exists for them (see the
// "استهلاك الخدمات" conversation).
const AUTO_SYNCED_KEYS = new Set(['streampay', 'mistral', 'cloudflare', 'sndr', 'imagekit', 'supabase', 'supabase_mau', 'supabase_api_traffic']);

type ServiceStatus = 'ok' | 'warning' | 'critical' | 'unknown';

type ServiceMeta = {
  key: string;
  name: string;
  icon: any;
  description: string;
  dashboardUrl: string;
};

// Descriptive metadata only - the actual numbers live in service_usage
// (manually entered for services with no public usage API - see the
// "استهلاك الخدمات" conversation).
const SERVICES: ServiceMeta[] = [
  {
    key: 'streampay',
    name: 'StreamPay',
    icon: CreditCard,
    description: 'بوابة الدفع وإدارة الاشتراكات',
    dashboardUrl: 'https://app.streampay.sa',
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
    key: 'mistral',
    name: 'Mistral AI',
    icon: Sparkles,
    description: 'المساعد الذكي وتحليل قوائم الطعام — لا يمكن ربطه برمجيًا حاليًا (يحتاج حساب Enterprise)',
    dashboardUrl: 'https://console.mistral.ai/usage',
  },
  {
    key: 'supabase',
    name: 'Supabase',
    icon: Database,
    description: 'قاعدة البيانات، المصادقة، التخزين، وEdge Functions',
    dashboardUrl: 'https://supabase.com/dashboard/project/smmriycsboexindabanc/settings/billing/usage',
  },
  {
    key: 'supabase_mau',
    name: 'Supabase — المستخدمون النشطون',
    icon: Users,
    description: 'تقريبي: محسوب من تاريخ آخر تسجيل دخول، وليس رقم الفوترة الرسمي لـ Supabase',
    dashboardUrl: 'https://supabase.com/dashboard/project/smmriycsboexindabanc/settings/billing/usage',
  },
  {
    key: 'supabase_api_traffic',
    name: 'Supabase — حركة API',
    icon: Database,
    description: 'تشغيلي فقط (آخر 24 ساعة): مجموع طلبات REST وAuth وStorage وRealtime — ليس رقم فوترة',
    dashboardUrl: 'https://supabase.com/dashboard/project/smmriycsboexindabanc/logs/explorer',
  },
  {
    key: 'vercel',
    name: 'Vercel',
    icon: Cloud,
    description: 'استضافة الموقع (الواجهة وAPI)',
    dashboardUrl: 'https://vercel.com/dashboard',
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
  unknown: { label: 'بدون حد مُدخل', className: 'bg-gray-100 text-gray-600' },
};

function computeStatus(usage: number | null, limit: number | null): ServiceStatus {
  if (usage == null || limit == null || limit <= 0) return 'unknown';
  const pct = (usage / limit) * 100;
  if (pct >= 100) return 'critical';
  if (pct >= 80) return 'warning';
  return 'ok';
}

type TopSubscriber = { name: string; amount: number; count: number };

export default function InfrastructurePage() {
  const [rows, setRows] = useState<Record<string, ServiceUsageRow>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [topSubscribers, setTopSubscribers] = useState<TopSubscriber[]>([]);
  const { toast } = useToast();

  const fetchUsage = useCallback(async () => {
    const { data } = await supabase.from('service_usage').select('*');
    const map: Record<string, ServiceUsageRow> = {};
    for (const row of (data || []) as ServiceUsageRow[]) map[row.service_key] = row;
    setRows(map);
    setIsLoading(false);
  }, []);

  const fetchTopSubscribers = useCallback(async () => {
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
    const { data: txRows } = await supabase
      .from('transactions')
      .select('profile_id, amount, status')
      .eq('status', 'completed')
      .gte('created_at', monthStart);

    const byProfile = new Map<string, { amount: number; count: number }>();
    for (const tx of (txRows || []) as any[]) {
      if (!tx.profile_id) continue;
      const entry = byProfile.get(tx.profile_id) || { amount: 0, count: 0 };
      entry.amount += Number(tx.amount) || 0;
      entry.count += 1;
      byProfile.set(tx.profile_id, entry);
    }
    const profileIds = [...byProfile.keys()];
    if (profileIds.length === 0) { setTopSubscribers([]); return; }

    const { data: profiles } = await supabase.from('profiles').select('id, restaurant_name, full_name').in('id', profileIds);
    const nameById = new Map<string, string>((profiles || []).map((p: any) => [p.id, p.restaurant_name || p.full_name || '—']));

    const list: TopSubscriber[] = profileIds
      .map((id) => ({ name: nameById.get(id) || '—', amount: byProfile.get(id)!.amount, count: byProfile.get(id)!.count }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);
    setTopSubscribers(list);
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
    fetchTopSubscribers();
    const channel = supabase
      .channel('service-usage-admin')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'service_usage' }, () => fetchUsage())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchUsage, fetchTopSubscribers]);

  const editingService = useMemo(() => SERVICES.find((s) => s.key === editingKey) || null, [editingKey]);

  const alerts = SERVICES
    .map((s) => ({ s, row: rows[s.key] }))
    .filter(({ row }) => row && row.usage_value != null && row.limit_value != null && row.limit_value > 0 && (row.usage_value / row.limit_value) >= 0.8);

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

      {alerts.length > 0 && (
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
      )}

      {isLoading ? (
        <div className="py-14 text-center"><Loader2 className="h-5 w-5 animate-spin text-gray-400 mx-auto" /></div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {SERVICES.map((s) => {
            const Icon = s.icon;
            const row = rows[s.key] || null;
            const usage = row?.usage_value ?? null;
            const limit = row?.limit_value ?? null;
            const hasLimit = usage != null && limit != null && limit > 0;
            const pct = hasLimit ? Math.min(100, Math.round((usage! / limit!) * 100)) : 0;
            const status = statusConfig[computeStatus(usage, limit)];
            const remaining = hasLimit ? `${Math.max(0, Math.round((limit! - usage!) * 100) / 100)} ${row?.limit_unit || ''}`.trim() : null;
            const isAuto = AUTO_SYNCED_KEYS.has(s.key);

            return (
              <div key={s.key} className="rounded-2xl border border-gray-100 p-4 flex flex-col gap-3">
                <div className="flex items-start justify-between gap-2">
                  <a href={s.dashboardUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 min-w-0 hover:opacity-80 transition-opacity">
                    <div className="w-10 h-10 rounded-xl bg-gray-900 text-white flex items-center justify-center shrink-0">
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="text-sm font-bold text-gray-900 truncate">{s.name}</p>
                        {isAuto && <span className="shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded bg-blue-50 text-blue-600">تلقائي</span>}
                      </div>
                      <p className="text-[10px] text-gray-600 line-clamp-2">{s.description}</p>
                    </div>
                  </a>
                  <button
                    onClick={() => setEditingKey(s.key)}
                    className="w-7 h-7 rounded-lg border border-gray-200 flex items-center justify-center text-gray-600 hover:bg-gray-50 transition-colors shrink-0"
                    title="تحديث يدوي"
                  >
                    <Pencil className="h-3 w-3" />
                  </button>
                </div>

                <div>
                  {usage != null ? (
                    <p className="text-xl font-black text-gray-900" style={{ fontVariantNumeric: 'tabular-nums' }}>
                      {usage.toLocaleString('ar')} <span className="text-xs font-bold text-gray-600">{row?.usage_unit}</span>
                    </p>
                  ) : (
                    <p className="text-xs text-gray-600">ما فيه بيانات استهلاك بعد</p>
                  )}
                  {row?.plan && row.plan !== '—' && <p className="text-[10px] text-gray-600 mt-0.5">الخطة: {row.plan}</p>}
                </div>

                {hasLimit ? (
                  <div>
                    <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${pct >= 100 ? 'bg-red-500' : pct >= 80 ? 'bg-amber-500' : 'bg-gray-900'}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between mt-1.5 text-[10px] text-gray-600">
                      <span>الحد: {limit} {row?.limit_unit}</span>
                      <span>باقي: {remaining}</span>
                    </div>
                  </div>
                ) : (
                  <p className="text-[10px] text-gray-500">
                    {usage != null ? 'بدون حد مُدخل — اضغط ✏️ عشان تدخل الحد وتفعّل شريط النسبة' : ''}
                  </p>
                )}

                <div className="flex items-center justify-between pt-2 border-t border-gray-50">
                  <span className={`inline-flex items-center px-2 py-1 rounded-full text-[10px] font-bold whitespace-nowrap ${status.className}`}>
                    {status.label}
                  </span>
                  <span className="text-[10px] text-gray-500">
                    {row?.updated_at ? formatDistanceToNow(new Date(row.updated_at), { addSuffix: true, locale: ar }) : 'ما تحدّث بعد'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="rounded-2xl border border-gray-100 p-5">
        <div className="flex items-center gap-2 mb-1">
          <Trophy className="h-4 w-4 text-amber-500" />
          <h2 className="text-sm font-bold text-gray-900">أكثر المشتركين استهلاكًا (StreamPay) هذا الشهر</h2>
        </div>
        <p className="text-[10px] text-gray-600 mb-4">
          مبني على جدول المعاملات الحقيقي — ترتيب المطاعم حسب قيمة المعاملات هذا الشهر. نفس التتبع لـ SNDR وImageKit يحتاج ربط كل عملية برقم المطعم أولاً (خطوة قادمة لو تبيها).
        </p>
        {topSubscribers.length === 0 ? (
          <div className="py-8 text-center"><p className="text-xs text-gray-600">ما فيه معاملات مسجّلة هذا الشهر</p></div>
        ) : (
          <div className="divide-y divide-gray-50">
            {topSubscribers.map((t, i) => (
              <div key={i} className="flex items-center gap-3 py-2.5">
                <div className="w-7 h-7 rounded-lg bg-gray-100 flex items-center justify-center text-[11px] font-bold text-gray-600 shrink-0">{i + 1}</div>
                <div className="flex-1 min-w-0"><p className="text-xs font-bold text-gray-900 truncate">{t.name}</p></div>
                <div className="text-[11px] text-gray-600 shrink-0">{t.count} معاملة</div>
                <div className="text-xs font-bold text-gray-900 shrink-0" style={{ fontVariantNumeric: 'tabular-nums' }}>{t.amount.toLocaleString('ar')} ر.س</div>
              </div>
            ))}
          </div>
        )}
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
