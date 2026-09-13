'use client';

import { useState, useEffect, useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import {
  User, KeyRound, Loader2, CreditCard, Clock, Trash2, Building2,
  MapPin, Utensils, Tag, Eye, MousePointerClick, MessageSquare,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { syncPublicPage } from '@/lib/public-pages';
import { pickActiveSubscription } from '@/hooks/useUser';
import { format, addMonths, addDays, isAfter, differenceInCalendarDays } from 'date-fns';
import { ar } from 'date-fns/locale';
import { ImpersonationAccessCard } from '@/components/admin/management/ImpersonationAccessCard';
import type { Profile, Subscription } from '@/lib/types';
import { cn } from '@/lib/utils';
import type { SubscriberRow } from '@/components/admin/management/SubscribersTable';

type ManagementPlan = {
  id: string;
  name: string;
  price: number;
  price_monthly: number;
  price_yearly: number;
  duration_months: number;
  is_featured: boolean;
};

type UsageStats = {
  branches: number;
  menuItems: number;
  offers: number;
  visits: number;
  clicks: number;
  contactRequests: number;
};

type ActivityRow = { id: string; type: string | null; timestamp: string };

const ACTIVITY_LABELS: Record<string, string> = {
  logo_added: 'تمت إضافة شعار جديد',
};

const formSchema = z.object({
  restaurant_name: z.string().min(2, 'اسم المشروع مطلوب'),
  full_name: z.string().min(2, 'الاسم الكامل مطلوب'),
  email: z.string().email('إيميل غير صحيح'),
  phone_number: z.string().optional().nullable(),
  account_status: z.enum(['active', 'pending', 'suspended']),
});
type FormValues = z.infer<typeof formSchema>;

interface SubscriberDrawerProps {
  profile: SubscriberRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: () => void;
  onDeleteRequest: (profile: Profile) => void;
}

export function SubscriberDrawer({ profile, open, onOpenChange, onSave, onDeleteRequest }: SubscriberDrawerProps) {
  const [currentSub, setCurrentSub] = useState<Subscription | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, startSaving] = useTransition();
  const [isActivating, startActivating] = useTransition();
  const [isExtending, startExtending] = useTransition();
  const [isSavingNotes, startSavingNotes] = useTransition();
  const { toast } = useToast();
  const [activePlans, setActivePlans] = useState<ManagementPlan[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState<string>('');
  const [usage, setUsage] = useState<UsageStats | null>(null);
  const [activityLog, setActivityLog] = useState<ActivityRow[]>([]);
  const [notes, setNotes] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);

  const form = useForm<FormValues>({ resolver: zodResolver(formSchema) });

  useEffect(() => {
    supabase.from('plans').select('id, name, price, price_monthly, price_yearly, duration_months, is_featured').eq('is_active', true)
      .then(({ data }: { data: any[] | null }) => setActivePlans((data || []) as ManagementPlan[]));
  }, []);

  useEffect(() => {
    if (activePlans.length === 0) return;
    const currentPlanStillActive = currentSub && activePlans.some((p) => p.id === currentSub.plan_id);
    if (currentPlanStillActive) {
      setSelectedPlanId(currentSub!.plan_id);
    } else {
      const featured = activePlans.find((p) => p.is_featured);
      setSelectedPlanId(featured ? featured.id : activePlans[0].id);
    }
  }, [profile?.id, currentSub, activePlans]);

  useEffect(() => {
    if (!profile || !open) return;
    let isMounted = true;
    setIsLoading(true);

    const fetchAll = async () => {
      const [{ data: subsData }, activityRes] = await Promise.all([
        supabase.from('subscriptions').select('*').eq('profile_id', profile.id),
        supabase.from('activity').select('id, type, timestamp').eq('userId', profile.id).order('timestamp', { ascending: false }).limit(15),
      ]);
      if (!isMounted) return;
      setCurrentSub(pickActiveSubscription((subsData || []) as Subscription[]));
      setActivityLog((activityRes.data || []) as ActivityRow[]);
      setNotes(profile.admin_notes || '');

      form.reset({
        restaurant_name: profile.restaurant_name || '',
        full_name: profile.full_name || '',
        email: profile.email || '',
        phone_number: profile.phone_number || '',
        account_status: profile.account_status || 'pending',
      });

      if (profile.restaurant_id) {
        const restId = profile.restaurant_id;
        const [branches, menuItems, offers, visits, clicks, requests] = await Promise.all([
          supabase.from('branches').select('id', { count: 'exact', head: true }).eq('restaurant_id', restId),
          supabase.from('menu_items').select('id', { count: 'exact', head: true }).eq('restaurant_id', restId),
          supabase.from('offers').select('id', { count: 'exact', head: true }).eq('restaurant_id', restId),
          supabase.from('hub_visits').select('id', { count: 'exact', head: true }).eq('restaurant_id', restId),
          supabase.from('page_events').select('id', { count: 'exact', head: true }).eq('restaurant_id', restId),
          supabase.from('business_requests').select('id', { count: 'exact', head: true }).eq('restaurant_id', restId),
        ]);
        if (!isMounted) return;
        setUsage({
          branches: branches.count || 0,
          menuItems: menuItems.count || 0,
          offers: offers.count || 0,
          visits: visits.count || 0,
          clicks: clicks.count || 0,
          contactRequests: requests.count || 0,
        });
      } else {
        setUsage({ branches: 0, menuItems: 0, offers: 0, visits: 0, clicks: 0, contactRequests: 0 });
      }
      setIsLoading(false);
    };

    fetchAll();
    return () => { isMounted = false; };
  }, [profile?.id, open, refreshKey, form]);

  if (!profile) return null;

  const subEndDate = currentSub?.end_date ? new Date(currentSub.end_date) : null;
  const subStartDate = currentSub?.start_date ? new Date(currentSub.start_date) : null;
  const isSubActive = subEndDate && isAfter(subEndDate, new Date());
  const daysRemaining = subEndDate ? Math.max(0, differenceInCalendarDays(subEndDate, new Date())) : 0;
  const totalDays = subStartDate && subEndDate ? Math.max(1, differenceInCalendarDays(subEndDate, subStartDate)) : 0;
  const elapsedPct = totalDays > 0 ? Math.min(100, Math.max(0, Math.round(((totalDays - daysRemaining) / totalDays) * 100))) : 0;
  const isPerpetual = currentSub?.plan_id === 'free';

  function onSubmit(values: FormValues) {
    startSaving(async () => {
      if (!profile) return;
      try {
        const { error } = await supabase.from('profiles').update({
          restaurant_name: values.restaurant_name,
          full_name: values.full_name,
          phone_number: values.phone_number,
          account_status: values.account_status,
        }).eq('id', profile.id);
        if (error) throw error;

        if (profile.restaurant_id) {
          const { error: restErr } = await supabase.from('restaurants').update({ name: values.restaurant_name }).eq('id', profile.restaurant_id);
          if (restErr) throw restErr;
          syncPublicPage(profile.restaurant_id).catch(() => {});
        }

        toast({ title: `تم تحديث بيانات "${values.restaurant_name}" بنجاح` });
        setRefreshKey((k) => k + 1);
        onSave();
      } catch (err: any) {
        toast({ title: 'خطأ في الحفظ', description: err.message, variant: 'destructive' });
      }
    });
  }

  const handleActivateOrRenew = () => {
    const selectedPlan = activePlans.find((p) => p.id === selectedPlanId);
    if (!profile || !selectedPlan) {
      toast({ title: 'بيانات ناقصة', description: 'الرجاء اختيار باقة اشتراك صالحة.', variant: 'destructive' });
      return;
    }

    startActivating(async () => {
      try {
        const { error: profErr } = await supabase.from('profiles').update({ account_status: 'active' }).eq('id', profile.id);
        if (profErr) throw profErr;

        if (profile.restaurant_id) {
          const { error: restErr } = await supabase.from('restaurants')
            .update({ is_paid_plan: selectedPlan.id !== 'free' })
            .eq('id', profile.restaurant_id);
          if (restErr) throw restErr;
        }

        const { error: supersedeErr } = await supabase
          .from('subscriptions')
          .update({ status: 'inactive', updated_at: new Date().toISOString() })
          .eq('profile_id', profile.id)
          .eq('status', 'active');
        if (supersedeErr) throw supersedeErr;

        let startDate = new Date();
        const endDateExisting = currentSub?.end_date ? new Date(currentSub.end_date) : null;
        if (currentSub && currentSub.plan_id !== 'free' && endDateExisting && isAfter(endDateExisting, startDate)) {
          startDate = endDateExisting;
        }
        const endDate = addMonths(startDate, selectedPlan.duration_months || 1);
        const isYearlyPlan = (selectedPlan.duration_months || 1) >= 12;
        const planAmount = (isYearlyPlan ? selectedPlan.price_yearly : selectedPlan.price_monthly) || selectedPlan.price || 0;

        const { data: newSub, error: subErr } = await supabase.from('subscriptions').insert({
          id: crypto.randomUUID(),
          profile_id: profile.id,
          plan_name: selectedPlan.name,
          plan_id: selectedPlan.id,
          status: 'active',
          billing_cycle: isYearlyPlan ? 'yearly' : 'monthly',
          amount: 0,
          start_date: startDate.toISOString(),
          end_date: endDate.toISOString(),
          next_billing_date: endDate.toISOString(),
        }).select('id').single();
        if (subErr) throw subErr;

        if (planAmount > 0) {
          await supabase.from('transactions').insert({
            profile_id: profile.id,
            type: 'adjustment',
            amount: 0,
            currency: 'SAR',
            status: 'completed',
            description: `منح/تجديد يدوي من الإدارة — ${selectedPlan.name} (القيمة السوقية ${planAmount} ر.س)`,
            reference_type: 'subscription',
            reference_id: newSub?.id,
          });
        }

        if (profile.restaurant_id) syncPublicPage(profile.restaurant_id).catch(() => {});

        toast({ title: 'تم تجديد/تفعيل الاشتراك بنجاح!' });
        setRefreshKey((k) => k + 1);
        onSave();
      } catch (err: any) {
        toast({ title: 'خطأ في التفعيل', description: err.message, variant: 'destructive' });
      }
    });
  };

  const handleExtendTrial = () => {
    if (!currentSub) {
      toast({ title: 'ما فيه اشتراك نشط لتمديده', variant: 'destructive' });
      return;
    }
    startExtending(async () => {
      try {
        const newEnd = addDays(subEndDate || new Date(), 30);
        const { error } = await supabase.from('subscriptions').update({ end_date: newEnd.toISOString() }).eq('id', currentSub.id);
        if (error) throw error;
        toast({ title: 'تمت إضافة 30 يومًا للاشتراك' });
        setRefreshKey((k) => k + 1);
        onSave();
      } catch (err: any) {
        toast({ title: 'خطأ', description: err.message, variant: 'destructive' });
      }
    });
  };

  const handleSaveNotes = () => {
    startSavingNotes(async () => {
      try {
        const { error } = await supabase.from('profiles').update({ admin_notes: notes }).eq('id', profile.id);
        if (error) throw error;
        toast({ title: 'تم حفظ الملاحظة' });
        onSave();
      } catch (err: any) {
        toast({ title: 'خطأ', description: err.message, variant: 'destructive' });
      }
    });
  };

  const handleResetPassword = async () => {
    if (!profile?.email) return;
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(profile.email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      toast({ title: 'تم إرسال رابط التغيير', description: `تم إرسال تعليمات إعادة تعيين كلمة المرور إلى بريد ${profile.email}` });
    } catch (error: any) {
      toast({ title: 'خطأ', description: error.message, variant: 'destructive' });
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="w-full sm:max-w-xl p-0 flex flex-col gap-0" dir="rtl">
        {isLoading ? (
          <div className="flex-1 flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-gray-600" /></div>
        ) : (
          <>
            {/* Header */}
            <div className="px-6 pt-6 pb-4 border-b border-gray-100 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-gray-900 text-white flex items-center justify-center font-bold text-lg shrink-0">
                  {(profile.restaurant_name || '؟').charAt(0)}
                </div>
                <div className="min-w-0">
                  <h2 className="text-base font-bold text-gray-900 truncate">{profile.restaurant_name || '—'}</h2>
                  <p className="text-xs text-gray-600 truncate">{profile.full_name}</p>
                  <span className={cn(
                    'inline-flex items-center gap-1.5 mt-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold',
                    profile.account_status === 'active' ? 'bg-emerald-50 text-emerald-700' : profile.account_status === 'suspended' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'
                  )}>
                    <span className="w-1.5 h-1.5 rounded-full bg-current" />
                    {profile.account_status === 'active' ? 'نشط' : profile.account_status === 'suspended' ? 'معلق' : 'بانتظار'}
                  </span>
                </div>
              </div>

              {/* Subscription summary card */}
              <div className="mt-4 rounded-2xl p-4 text-white" style={{ background: 'linear-gradient(135deg, #111827, #1f2937)' }}>
                <div className="flex justify-between items-start gap-4">
                  <div>
                    <div className="text-[11px] text-gray-300">الاشتراك الحالي</div>
                    <div className="text-lg font-bold mt-1">{currentSub?.plan_name || 'لا يوجد'}</div>
                  </div>
                  {subEndDate && (
                    <div className="text-left">
                      <div className="text-[11px] text-gray-300">ينتهي</div>
                      <div className="text-sm font-bold mt-1">{isPerpetual ? 'دائم' : format(subEndDate, 'dd MMM yyyy', { locale: ar })}</div>
                    </div>
                  )}
                </div>
                {!isPerpetual && currentSub && (
                  <>
                    <div className="h-2 rounded-full bg-white/15 mt-4 mb-2 overflow-hidden">
                      <div className="h-full bg-white rounded-full" style={{ width: `${elapsedPct}%` }} />
                    </div>
                    <div className="text-[11px] text-gray-300">{daysRemaining} يوم متبقي من الاشتراك</div>
                  </>
                )}
                <div className="flex flex-wrap gap-2 mt-3">
                  <Select onValueChange={setSelectedPlanId} value={selectedPlanId}>
                    <SelectTrigger className="h-9 rounded-lg border-white/20 bg-white/10 text-white text-xs w-auto min-w-[140px]">
                      <SelectValue placeholder="اختر الباقة" />
                    </SelectTrigger>
                    <SelectContent dir="rtl">
                      {activePlans.map((p) => (
                        <SelectItem key={p.id} value={p.id} className="text-xs">{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <button onClick={handleActivateOrRenew} disabled={isActivating || !selectedPlanId}
                    className="h-9 px-3 rounded-lg bg-white/10 border border-white/20 text-white text-xs font-bold hover:bg-white/20 transition-colors disabled:opacity-50 flex items-center gap-1.5">
                    {isActivating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Clock className="h-3.5 w-3.5" />}
                    {isSubActive && currentSub?.plan_id !== 'free' ? 'تجديد الاشتراك' : 'تفعيل'}
                  </button>
                  <button onClick={handleExtendTrial} disabled={isExtending || !currentSub}
                    className="h-9 px-3 rounded-lg bg-white/10 border border-white/20 text-white text-xs font-bold hover:bg-white/20 transition-colors disabled:opacity-50 flex items-center gap-1.5">
                    {isExtending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                    + 30 يوم مجاني
                  </button>
                </div>
              </div>
            </div>

            <Tabs defaultValue="overview" className="flex-1 flex flex-col min-h-0">
              <TabsList className="mx-6 mt-3 w-fit bg-transparent p-0 border-b border-gray-100 rounded-none justify-start gap-1 shrink-0">
                {[
                  { value: 'overview', label: 'نظرة عامة' },
                  { value: 'account', label: 'الحساب' },
                  { value: 'subscription', label: 'الاشتراك' },
                  { value: 'activity', label: 'النشاط' },
                ].map((t) => (
                  <TabsTrigger key={t.value} value={t.value}
                    className="rounded-none border-b-2 border-transparent data-[state=active]:border-gray-900 data-[state=active]:bg-transparent data-[state=active]:shadow-none px-3 py-2.5 text-xs font-bold text-gray-600 data-[state=active]:text-gray-900">
                    {t.label}
                  </TabsTrigger>
                ))}
              </TabsList>

              <div className="flex-1 overflow-y-auto px-6 py-5">
                <TabsContent value="overview" className="mt-0 space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="rounded-xl border border-gray-100 p-4 space-y-2.5">
                      <h3 className="text-xs font-bold text-gray-900 mb-1">معلومات الحساب</h3>
                      <div className="flex justify-between text-[11px] border-b border-dashed border-gray-100 pb-2"><span className="text-gray-600">البريد</span><strong className="text-gray-900">{profile.email}</strong></div>
                      <div className="flex justify-between text-[11px] border-b border-dashed border-gray-100 pb-2"><span className="text-gray-600">الجوال</span><strong className="text-gray-900" dir="ltr">{profile.phone_number || '—'}</strong></div>
                      <div className="flex justify-between text-[11px]"><span className="text-gray-600">تاريخ الإنشاء</span><strong className="text-gray-900">{profile.created_at ? format(new Date(profile.created_at), 'dd MMM yyyy', { locale: ar }) : '—'}</strong></div>
                    </div>
                    <ImpersonationAccessCard restaurantId={profile.restaurant_id} />
                  </div>

                  {usage && (
                    <div className="rounded-xl border border-gray-100 p-4">
                      <h3 className="text-xs font-bold text-gray-900 mb-3">استخدام المنصة</h3>
                      <div className="grid grid-cols-3 gap-2.5">
                        {[
                          { icon: MapPin, label: 'الفروع', value: usage.branches },
                          { icon: Utensils, label: 'عناصر المنيو', value: usage.menuItems },
                          { icon: Tag, label: 'العروض', value: usage.offers },
                          { icon: Eye, label: 'الزيارات', value: usage.visits },
                          { icon: MousePointerClick, label: 'النقرات', value: usage.clicks },
                          { icon: MessageSquare, label: 'طلبات التواصل', value: usage.contactRequests },
                        ].map((u) => (
                          <div key={u.label} className="bg-gray-50 rounded-xl p-3">
                            <div className="flex items-center gap-1.5 text-[10px] text-gray-600"><u.icon className="h-3 w-3" />{u.label}</div>
                            <div className="text-lg font-bold text-gray-900 mt-1" style={{ fontVariantNumeric: 'tabular-nums' }}>{u.value.toLocaleString('ar')}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="rounded-xl border border-gray-100 p-4">
                    <h3 className="text-xs font-bold text-gray-900 mb-2">ملاحظات داخلية</h3>
                    <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className="text-xs rounded-xl resize-y" placeholder="ملاحظة داخلية عن هذا المشترك..." />
                    <button onClick={handleSaveNotes} disabled={isSavingNotes}
                      className="mt-2 h-8 px-3 rounded-lg border border-gray-200 text-gray-600 text-[11px] font-bold hover:bg-gray-50 transition-colors disabled:opacity-50 flex items-center gap-1.5">
                      {isSavingNotes ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                      حفظ الملاحظة
                    </button>
                  </div>
                </TabsContent>

                <TabsContent value="account" className="mt-0 space-y-4">
                  <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <FormField control={form.control} name="restaurant_name" render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-[10px] text-gray-600">اسم المشروع</FormLabel>
                            <FormControl><Input {...field} className="h-10 rounded-xl border-gray-200 text-sm" disabled={isSaving} /></FormControl>
                            <FormMessage className="text-[10px]" />
                          </FormItem>
                        )} />
                        <FormField control={form.control} name="full_name" render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-[10px] text-gray-600">اسم المالك</FormLabel>
                            <FormControl><Input {...field} className="h-10 rounded-xl border-gray-200 text-sm" disabled={isSaving} /></FormControl>
                            <FormMessage className="text-[10px]" />
                          </FormItem>
                        )} />
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <FormField control={form.control} name="email" render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-[10px] text-gray-600">البريد الإلكتروني</FormLabel>
                            <FormControl><Input type="email" {...field} disabled className="h-10 rounded-xl border-gray-200 text-sm bg-gray-50" /></FormControl>
                            <FormMessage className="text-[10px]" />
                          </FormItem>
                        )} />
                        <FormField control={form.control} name="phone_number" render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-[10px] text-gray-600">رقم الجوال</FormLabel>
                            <FormControl><Input {...field} value={field.value || ''} dir="ltr" className="h-10 rounded-xl border-gray-200 text-sm text-left" placeholder="05XXXXXXXX" disabled={isSaving} /></FormControl>
                            <FormMessage className="text-[10px]" />
                          </FormItem>
                        )} />
                      </div>
                      <FormField control={form.control} name="account_status" render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-[10px] text-gray-600">حالة الحساب</FormLabel>
                          <div className="grid grid-cols-3 gap-2">
                            {[
                              { value: 'active', label: 'نشط', color: 'bg-emerald-50 border-emerald-200 text-emerald-700' },
                              { value: 'pending', label: 'بانتظار', color: 'bg-amber-50 border-amber-200 text-amber-700' },
                              { value: 'suspended', label: 'معلق', color: 'bg-red-50 border-red-200 text-red-700' },
                            ].map((status) => (
                              <button key={status.value} type="button" onClick={() => field.onChange(status.value)}
                                className={`h-9 rounded-xl text-xs font-medium transition-all border ${field.value === status.value ? status.color : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'}`}>
                                {status.label}
                              </button>
                            ))}
                          </div>
                          <FormMessage className="text-[10px]" />
                        </FormItem>
                      )} />
                      <button type="submit" disabled={isSaving}
                        className="h-10 rounded-xl bg-gray-900 text-white text-sm font-medium hover:bg-gray-800 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 w-full sm:w-auto sm:px-8">
                        {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                        {isSaving ? 'جاري الحفظ...' : 'حفظ التعديلات'}
                      </button>
                    </form>
                  </Form>

                  <div className="rounded-xl border border-red-200 bg-red-50/40 p-4 space-y-3">
                    <h3 className="text-xs font-bold text-red-500">منطقة الخطر</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <button type="button" onClick={handleResetPassword}
                        className="h-auto p-3 rounded-xl border border-gray-200 bg-white text-right hover:bg-gray-50 transition-colors flex flex-col items-start gap-1.5">
                        <div className="flex items-center gap-2"><KeyRound className="h-4 w-4 text-gray-600" /><span className="text-xs font-bold text-gray-700">إعادة تعيين كلمة المرور</span></div>
                        <span className="text-[10px] text-gray-600">إرسال رابط آمن للبريد</span>
                      </button>
                      <button type="button" onClick={() => onDeleteRequest(profile)}
                        className="h-auto p-3 rounded-xl border border-red-200 bg-white text-right hover:bg-red-50 transition-colors flex flex-col items-start gap-1.5">
                        <div className="flex items-center gap-2"><Trash2 className="h-4 w-4 text-red-400" /><span className="text-xs font-bold text-red-600">حذف المشترك نهائيًا</span></div>
                        <span className="text-[10px] text-red-300">حذف نهائي للبيانات والمطعم</span>
                      </button>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="subscription" className="mt-0 space-y-4">
                  <div className="rounded-xl border border-gray-100 p-4 space-y-2.5">
                    <h3 className="text-xs font-bold text-gray-900 mb-1">إدارة الاشتراك</h3>
                    <div className="flex justify-between text-[11px] border-b border-dashed border-gray-100 pb-2"><span className="text-gray-600">الباقة</span><strong className="text-gray-900">{currentSub?.plan_name || 'لا يوجد'}</strong></div>
                    <div className="flex justify-between text-[11px] border-b border-dashed border-gray-100 pb-2"><span className="text-gray-600">بداية الاشتراك</span><strong className="text-gray-900">{subStartDate ? format(subStartDate, 'dd MMM yyyy', { locale: ar }) : '—'}</strong></div>
                    <div className="flex justify-between text-[11px]"><span className="text-gray-600">تاريخ الانتهاء</span><strong className="text-gray-900">{isPerpetual ? 'دائم' : subEndDate ? format(subEndDate, 'dd MMM yyyy', { locale: ar }) : '—'}</strong></div>
                  </div>
                  <div className="rounded-xl border border-gray-100 p-4 space-y-3">
                    <h3 className="text-xs font-bold text-gray-900">تغيير أو تجديد الباقة</h3>
                    <Select onValueChange={setSelectedPlanId} value={selectedPlanId}>
                      <SelectTrigger className="h-9 rounded-lg border-gray-200 text-xs">
                        <SelectValue placeholder="اختر الباقة" />
                      </SelectTrigger>
                      <SelectContent dir="rtl">
                        {activePlans.map((p) => (
                          <SelectItem key={p.id} value={p.id} className="text-xs">
                            {p.name} — {(p.duration_months || 1) >= 12 ? `${p.price_yearly || p.price || 0} ر.س/سنة` : `${p.price_monthly || p.price || 0} ر.س / ${p.duration_months || 1} أشهر`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <div className="flex flex-wrap gap-2">
                      <button onClick={handleActivateOrRenew} disabled={isActivating || !selectedPlanId}
                        className="h-9 px-4 rounded-xl bg-gray-900 text-white text-xs font-bold hover:bg-gray-800 disabled:opacity-50 flex items-center gap-2">
                        {isActivating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CreditCard className="h-3.5 w-3.5" />}
                        {isSubActive && currentSub?.plan_id !== 'free' ? 'تجديد' : 'تفعيل'}
                      </button>
                      <button onClick={handleExtendTrial} disabled={isExtending || !currentSub}
                        className="h-9 px-4 rounded-xl border border-gray-200 text-gray-700 text-xs font-bold hover:bg-gray-50 disabled:opacity-50 flex items-center gap-2">
                        {isExtending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                        تمديد 30 يوم
                      </button>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="activity" className="mt-0">
                  <div className="rounded-xl border border-gray-100 p-4">
                    <h3 className="text-xs font-bold text-gray-900 mb-3">آخر النشاط</h3>
                    {activityLog.length === 0 ? (
                      <p className="text-[11px] text-gray-600 py-6 text-center">ما فيه نشاط مسجّل لهذا الحساب.</p>
                    ) : (
                      <div className="relative pe-4 space-y-4 before:content-[''] before:absolute before:top-1 before:bottom-1 before:end-1 before:w-px before:bg-gray-100">
                        {activityLog.map((item) => (
                          <div key={item.id} className="relative pe-3.5">
                            <span className="absolute end-[-5px] top-1 w-2 h-2 rounded-full bg-gray-900 ring-2 ring-white" />
                            <strong className="block text-xs text-gray-900">{ACTIVITY_LABELS[item.type || ''] || item.type || 'نشاط'}</strong>
                            <span className="block text-[10px] text-gray-600 mt-1">{format(new Date(item.timestamp), 'dd MMM yyyy، hh:mm a', { locale: ar })}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </TabsContent>
              </div>
            </Tabs>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
