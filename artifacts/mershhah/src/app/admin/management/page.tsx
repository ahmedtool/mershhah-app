'use client';

import { useState, useEffect, useTransition, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { User, Building2, KeyRound, Loader2, CreditCard, Clock, Trash2, Search } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/lib/supabase';
import { format, addMonths, isAfter } from 'date-fns';
import { ar } from 'date-fns/locale';
import { Skeleton } from '@/components/ui/skeleton';
import { RestaurantsTable } from '@/components/admin/management/RestaurantsTable';
import type { Profile, Plan, Subscription } from '@/lib/types';
import { cn } from '@/lib/utils';

const formSchema = z.object({
  restaurant_name: z.string().min(2, 'اسم المشروع مطلوب'),
  full_name: z.string().min(2, 'الاسم الكامل مطلوب'),
  email: z.string().email('إيميل غير صحيح'),
  phone_number: z.string().optional().nullable(),
  account_status: z.enum(['active', 'pending', 'suspended']),
});
type FormValues = z.infer<typeof formSchema>;

function ProfileDetails({
  profileId,
  onSave,
  onDeleteRequest,
}: {
  profileId: string | null;
  onSave: () => void;
  onDeleteRequest: (profile: Profile) => void;
}) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [currentSub, setCurrentSub] = useState<Subscription | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, startSaving] = useTransition();
  const [isActivating, startActivating] = useTransition();
  const { toast } = useToast();
  const [activePlans, setActivePlans] = useState<Plan[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState<string>('');

  const form = useForm<FormValues>({ resolver: zodResolver(formSchema) });

  useEffect(() => {
    const fetchPlans = async () => {
      const { data } = await supabase.from('plans').select('*').eq('is_active', true);
      const plans = (data || []) as Plan[];
      setActivePlans(plans);
      if (plans.length > 0) {
        const featured = plans.find((p) => p.is_featured);
        setSelectedPlanId((prev) => prev || (featured ? featured.id : plans[0].id));
      }
    };
    fetchPlans();
  }, []);

  useEffect(() => {
    if (!profileId) {
      setProfile(null);
      setCurrentSub(null);
      setIsLoading(false);
      return;
    }

    let isMounted = true;
    setIsLoading(true);

    const fetchProfile = async () => {
      const { data: profileData } = await supabase.from('profiles').select('*').eq('id', profileId).single();
      if (!isMounted) return;

      if (profileData) {
        setProfile(profileData as Profile);
        form.reset({
          restaurant_name: profileData.restaurant_name || '',
          full_name: profileData.full_name || '',
          email: profileData.email || '',
          phone_number: profileData.phone_number || '',
          account_status: profileData.account_status || 'pending',
        });

        const { data: subsData } = await supabase
          .from('subscriptions')
          .select('*')
          .eq('profile_id', profileId);

        if (!isMounted) return;
        const subs = (subsData || []) as Subscription[];
        const activeSubs = subs
          .filter((s) => s.status === 'active')
          .sort((a, b) => new Date(b.end_date || 0).getTime() - new Date(a.end_date || 0).getTime());
        setCurrentSub(activeSubs[0] || null);
      } else {
        setProfile(null);
      }
      setIsLoading(false);
    };

    fetchProfile();

    const channel = supabase
      .channel(`profile-detail-${profileId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles', filter: `id=eq.${profileId}` }, () => {
        fetchProfile();
      })
      .subscribe();

    return () => {
      isMounted = false;
      supabase.removeChannel(channel);
    };
  }, [profileId, form]);

  function onSubmit(values: FormValues) {
    startSaving(async () => {
      if (!profile) return;
      try {
        await supabase.from('profiles').update({
          restaurant_name: values.restaurant_name,
          full_name: values.full_name,
          phone_number: values.phone_number,
          account_status: values.account_status,
        }).eq('id', profile.id);

        if (profile.restaurant_id) {
          await supabase.from('restaurants').update({ name: values.restaurant_name }).eq('id', profile.restaurant_id);
        }

        toast({ title: `تم تحديث بيانات "${values.restaurant_name}" بنجاح` });
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
        await supabase.from('profiles').update({ account_status: 'active' }).eq('id', profile.id);

        if (profile.restaurant_id) {
          await supabase.from('restaurants')
            .update({ is_paid_plan: selectedPlan.id !== 'free' })
            .eq('id', profile.restaurant_id);
        }

        let startDate = new Date();
        const subEndDate = currentSub?.end_date ? new Date(currentSub.end_date) : null;
        if (currentSub && currentSub.plan_id !== 'free' && subEndDate && isAfter(subEndDate, startDate)) {
          startDate = subEndDate;
        }
        const endDate = addMonths(startDate, selectedPlan.duration_months);

        await supabase.from('subscriptions').insert({
          id: crypto.randomUUID(),
          profile_id: profile.id,
          plan_name: selectedPlan.name,
          plan_id: selectedPlan.id,
          status: 'active',
          start_date: startDate.toISOString(),
          end_date: endDate.toISOString(),
        });

        toast({ title: 'تم تجديد/تفعيل الاشتراك بنجاح!' });
        onSave();
      } catch (err: any) {
        toast({ title: 'خطأ في التفعيل', description: err.message, variant: 'destructive' });
      }
    });
  };

  const handleDelete = () => { if (profile) onDeleteRequest(profile); };

  const handleResetPassword = async () => {
    if (!profile?.email) return;
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(profile.email);
      if (error) throw error;
      toast({
        title: 'تم إرسال رابط التغيير',
        description: `تم إرسال تعليمات إعادة تعيين كلمة المرور إلى بريد ${profile.email}`,
      });
    } catch (error: any) {
      toast({ title: 'خطأ', description: error.message, variant: 'destructive' });
    }
  };

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-gray-300" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center text-gray-300 py-20">
        <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
          <Building2 className="h-8 w-8 text-gray-200" />
        </div>
        <h3 className="text-sm font-bold text-gray-400">لم يتم اختيار مشترك</h3>
        <p className="text-xs text-gray-300 mt-1 max-w-[200px]">
          اختر مشتركاً من القائمة لعرض بياناته
        </p>
      </div>
    );
  }

  const subEndDate = currentSub?.end_date ? new Date(currentSub.end_date) : null;
  const isSubActive = subEndDate && isAfter(subEndDate, new Date());

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-5 pt-5 pb-4 border-b border-gray-100 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center">
              <User className="h-5 w-5 text-gray-500" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-gray-900">{profile.restaurant_name}</h2>
              <p className="text-xs text-gray-400">{profile.full_name}</p>
            </div>
          </div>
          <Badge className={cn('text-[10px] font-medium px-2.5 py-1 rounded-full', isSubActive ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200')}>
            {isSubActive ? 'نشط' : 'منتهي'}
          </Badge>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-5 space-y-5">
        {/* Subscription Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Current Subscription */}
          <div className="rounded-xl border border-gray-100 p-4 space-y-3">
            <div className="flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-gray-400" />
              <span className="text-xs font-bold text-gray-600">الاشتراك الحالي</span>
            </div>
            {currentSub ? (
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-[11px] text-gray-400">الباقة</span>
                  <span className="text-xs font-bold text-gray-700">{currentSub.plan_name}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[11px] text-gray-400">ينتهي</span>
                  <span className={cn('text-xs font-bold', isSubActive ? 'text-emerald-600' : 'text-red-600')}>
                    {currentSub.plan_id === 'free' ? 'دائم' : (subEndDate ? format(subEndDate, 'dd MMM yyyy', { locale: ar }) : '—')}
                  </span>
                </div>
              </div>
            ) : (
              <p className="text-[11px] text-gray-300 italic">لا يوجد اشتراك نشط</p>
            )}
          </div>

          {/* Renew */}
          <div className="rounded-xl border border-gray-100 p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-gray-400" />
              <span className="text-xs font-bold text-gray-600">تجديد / تفعيل</span>
            </div>
            <Select onValueChange={setSelectedPlanId} value={selectedPlanId}>
              <SelectTrigger className="h-9 rounded-lg border-gray-200 text-xs">
                <SelectValue placeholder="اختر الباقة" />
              </SelectTrigger>
              <SelectContent dir="rtl">
                {activePlans.map((p) => (
                  <SelectItem key={p.id} value={p.id} className="text-xs">
                    {p.name} — {p.price} ر.س / {p.duration_months} أشهر
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <button
              type="button"
              onClick={handleActivateOrRenew}
              disabled={isActivating || !selectedPlanId}
              className="w-full h-9 rounded-xl bg-gray-900 text-white text-xs font-medium hover:bg-gray-800 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isActivating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Clock className="h-3.5 w-3.5" />}
              {isSubActive && currentSub?.plan_id !== 'free' ? 'تجديد' : 'تفعيل'}
            </button>
          </div>
        </div>

        {/* Account Info */}
        <div className="space-y-3">
          <h3 className="text-xs font-bold text-gray-500">بيانات الحساب</h3>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <FormField control={form.control} name="restaurant_name" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[10px] text-gray-400">اسم المشروع</FormLabel>
                    <FormControl>
                      <Input {...field} className="h-10 rounded-xl border-gray-200 text-sm" disabled={isSaving} />
                    </FormControl>
                    <FormMessage className="text-[10px]" />
                  </FormItem>
                )} />
                <FormField control={form.control} name="full_name" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[10px] text-gray-400">اسم المالك</FormLabel>
                    <FormControl>
                      <Input {...field} className="h-10 rounded-xl border-gray-200 text-sm" disabled={isSaving} />
                    </FormControl>
                    <FormMessage className="text-[10px]" />
                  </FormItem>
                )} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <FormField control={form.control} name="email" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[10px] text-gray-400">البريد الإلكتروني</FormLabel>
                    <FormControl>
                      <Input type="email" {...field} disabled className="h-10 rounded-xl border-gray-200 text-sm bg-gray-50" />
                    </FormControl>
                    <FormMessage className="text-[10px]" />
                  </FormItem>
                )} />
                <FormField control={form.control} name="phone_number" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[10px] text-gray-400">رقم الجوال</FormLabel>
                    <FormControl>
                      <Input {...field} value={field.value || ''} dir="ltr" className="h-10 rounded-xl border-gray-200 text-sm text-left" placeholder="05XXXXXXXX" disabled={isSaving} />
                    </FormControl>
                    <FormMessage className="text-[10px]" />
                  </FormItem>
                )} />
              </div>
              <FormField control={form.control} name="account_status" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[10px] text-gray-400">حالة الحساب</FormLabel>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { value: 'active', label: 'نشط', color: 'bg-emerald-50 border-emerald-200 text-emerald-700' },
                      { value: 'pending', label: 'بانتظار', color: 'bg-amber-50 border-amber-200 text-amber-700' },
                      { value: 'suspended', label: 'معلق', color: 'bg-red-50 border-red-200 text-red-700' },
                    ].map((status) => (
                      <button
                        key={status.value}
                        type="button"
                        onClick={() => field.onChange(status.value)}
                        className={`h-9 rounded-xl text-xs font-medium transition-all border ${field.value === status.value ? status.color : 'bg-white border-gray-200 text-gray-400 hover:border-gray-300'}`}
                      >
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
        </div>

        {/* Danger Zone */}
        <div className="space-y-3">
          <h3 className="text-xs font-bold text-red-400">منطقة الخطر</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={handleResetPassword}
              className="h-auto p-4 rounded-xl border border-gray-200 text-right hover:bg-gray-50 transition-colors flex flex-col items-start gap-2"
            >
              <div className="flex items-center gap-2">
                <KeyRound className="h-4 w-4 text-gray-400" />
                <span className="text-xs font-bold text-gray-600">إعادة تعيين كلمة المرور</span>
              </div>
              <span className="text-[10px] text-gray-300">إرسال رابط آمن للبريد</span>
            </button>
            <button
              type="button"
              onClick={handleDelete}
              className="h-auto p-4 rounded-xl border border-red-200 bg-red-50/50 text-right hover:bg-red-50 transition-colors flex flex-col items-start gap-2"
            >
              <div className="flex items-center gap-2">
                <Trash2 className="h-4 w-4 text-red-400" />
                <span className="text-xs font-bold text-red-600">حذف المشترك</span>
              </div>
              <span className="text-[10px] text-red-300">حذف نهائي للبيانات والمطعم</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ManagementPage() {
  const [subscribers, setSubscribers] = useState<Profile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
  const [profileToDelete, setProfileToDelete] = useState<Profile | null>(null);
  const [isDeleting, startDeleteTransition] = useTransition();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState('');

  const fetchSubscribers = useCallback(async () => {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('role', 'owner')
      .order('created_at', { ascending: false });
    const profiles = (data || []) as Profile[];
    setSubscribers(profiles);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    fetchSubscribers();

    const channel = supabase
      .channel('profiles-management')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => {
        fetchSubscribers();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [fetchSubscribers]);

  useEffect(() => {
    if (!selectedProfileId && subscribers.length > 0) {
      setSelectedProfileId(subscribers[0].id);
    }
  }, [subscribers, selectedProfileId]);

  const handleProfileSelect = useCallback((profile: Profile) => {
    setSelectedProfileId(profile.id);
  }, []);

  const handleDeleteRequest = (profile: Profile) => setProfileToDelete(profile);

  const handleDeleteConfirm = () => {
    if (!profileToDelete) return;
    startDeleteTransition(async () => {
      try {
        await supabase.from('profiles').delete().eq('id', profileToDelete.id);
        if (profileToDelete.restaurant_id) {
          await supabase.from('restaurants').delete().eq('id', profileToDelete.restaurant_id);
        }
        await supabase.from('chats').delete().eq('id', profileToDelete.id);

        toast({ title: 'تم الحذف', description: `تم حذف بيانات ${profileToDelete.restaurant_name}.` });
        setProfileToDelete(null);
        if (selectedProfileId === profileToDelete.id) {
          const remaining = subscribers.filter((s) => s.id !== profileToDelete.id);
          setSelectedProfileId(remaining.length > 0 ? remaining[0].id : null);
        }
      } catch (err: any) {
        toast({ title: 'خطأ في الحذف', description: err.message, variant: 'destructive' });
        setProfileToDelete(null);
      }
    });
  };

  const filteredSubscribers = subscribers.filter((s) =>
    !searchQuery || s.restaurant_name?.includes(searchQuery) || s.full_name?.includes(searchQuery) || s.email?.includes(searchQuery)
  );

  if (isLoading) {
    return (
      <div className="flex flex-col h-[calc(100vh-8.5rem)] p-4 lg:p-6 gap-4">
        <div className="space-y-2">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-4 w-80" />
        </div>
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 flex-1">
          <Skeleton className="h-full" />
          <Skeleton className="h-full" />
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-col h-[calc(100vh-8.5rem)] p-4 lg:p-6">
        {/* Page Header */}
        <div className="mb-4 shrink-0">
          <h1 className="text-lg font-bold text-gray-900">إدارة المشتركين</h1>
          <p className="text-xs text-gray-400 mt-0.5">{subscribers.length} مشترك في المنصة</p>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 flex-1 min-h-0">
          {/* Subscribers List */}
          <div className="xl:col-span-1 h-full flex flex-col rounded-2xl border border-gray-100 overflow-hidden">
            {/* Search */}
            <div className="p-3 border-b border-gray-100 shrink-0">
              <div className="relative">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-300" />
                <input
                  type="text"
                  placeholder="بحث بالاسم أو البريد..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full h-9 pr-9 pl-3 rounded-xl border border-gray-200 text-xs text-right placeholder:text-gray-300 focus:outline-none focus:border-gray-300"
                />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto">
              <RestaurantsTable
                restaurants={filteredSubscribers}
                selectedProfileId={selectedProfileId}
                onProfileSelect={handleProfileSelect}
              />
            </div>
          </div>

          {/* Profile Details */}
          <div className="xl:col-span-2 h-full rounded-2xl border border-gray-100 overflow-hidden">
            <ProfileDetails
              profileId={selectedProfileId}
              onSave={fetchSubscribers}
              onDeleteRequest={handleDeleteRequest}
            />
          </div>
        </div>
      </div>

      <AlertDialog open={!!profileToDelete} onOpenChange={(open) => !open && setProfileToDelete(null)}>
        <AlertDialogContent className="sm:max-w-lg p-0 gap-0" dir="rtl">
          <div className="px-5 pt-5 pb-3 border-b border-gray-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center">
                <Trash2 className="h-5 w-5 text-red-500" />
              </div>
              <div>
                <AlertDialogTitle className="text-base font-bold text-gray-900">حذف المشترك</AlertDialogTitle>
                <AlertDialogDescription className="text-xs text-gray-400 mt-0.5">لا يمكن التراجع عن هذا الإجراء</AlertDialogDescription>
              </div>
            </div>
          </div>
          <div className="p-5">
            <p className="text-sm text-gray-600 leading-relaxed">
              سيتم حذف حساب <strong className="text-gray-900">{profileToDelete?.restaurant_name}</strong> وجميع بياناته المرتبطة بشكل نهائي.
            </p>
          </div>
          <div className="flex gap-2 px-5 pb-5">
            <AlertDialogCancel disabled={isDeleting}
              className="flex-1 h-11 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors">
              إلغاء
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={isDeleting}
              className="flex-1 h-11 rounded-xl bg-red-600 text-white text-sm font-medium hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
              {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              نعم، حذف نهائي
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
