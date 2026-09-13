'use client';

import { useState, useEffect, useTransition, useCallback, useMemo } from 'react';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Trash2, Search } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { isAfter, addDays } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';
import { SubscriberStats } from '@/components/admin/management/SubscriberStats';
import { SubscribersTable, type SubscriberRow } from '@/components/admin/management/SubscribersTable';
import { SubscriberDrawer } from '@/components/admin/management/SubscriberDrawer';
import { pickActiveSubscription } from '@/hooks/useUser';
import type { Profile, Subscription } from '@/lib/types';

type PlanLite = { id: string; name: string; price_yearly: number };

// The hidden dev-only 1 SAR/year plan (see restructure_plans.sql) - the
// only plan flagged as a "trial" for the stats row/filter, matching how
// PlanPricingGrid already treats it as the one non-customer-facing plan.
const TRIAL_PLAN_ID = '93250b42-d34c-4996-8d83-359ea26ab264';

export default function ManagementPage() {
  const [subscribers, setSubscribers] = useState<SubscriberRow[]>([]);
  const [plans, setPlans] = useState<PlanLite[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [profileToDelete, setProfileToDelete] = useState<Profile | null>(null);
  const [isDeleting, startDeleteTransition] = useTransition();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [planFilter, setPlanFilter] = useState<string>('all');

  const fetchSubscribers = useCallback(async () => {
    const [{ data: profilesData }, { data: plansData }] = await Promise.all([
      supabase.from('profiles').select('*').eq('role', 'owner').order('created_at', { ascending: false }),
      supabase.from('plans').select('id, name, price_yearly').eq('is_active', true),
    ]);
    const profiles = (profilesData || []) as Profile[];
    setPlans((plansData || []) as PlanLite[]);

    if (profiles.length === 0) {
      setSubscribers([]);
      setIsLoading(false);
      return;
    }

    const { data: subsData } = await supabase
      .from('subscriptions')
      .select('*')
      .in('profile_id', profiles.map((p) => p.id));

    const subsByProfile = new Map<string, Subscription[]>();
    for (const sub of (subsData || []) as Subscription[]) {
      const list = subsByProfile.get(sub.profile_id) || [];
      list.push(sub);
      subsByProfile.set(sub.profile_id, list);
    }

    const rows: SubscriberRow[] = profiles.map((p) => ({
      ...p,
      currentSub: pickActiveSubscription(subsByProfile.get(p.id) || []),
    }));
    setSubscribers(rows);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    fetchSubscribers();
    const channel = supabase
      .channel('profiles-management')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => fetchSubscribers())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'subscriptions' }, () => fetchSubscribers())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchSubscribers]);

  const handleSelect = useCallback((row: SubscriberRow) => {
    setSelectedProfileId(row.id);
    setDrawerOpen(true);
  }, []);

  const handleDeleteRequest = (profile: Profile) => setProfileToDelete(profile);

  const handleDeleteConfirm = () => {
    if (!profileToDelete) return;
    startDeleteTransition(async () => {
      try {
        const restId = profileToDelete.restaurant_id;

        const { data: { session } } = await supabase.auth.getSession();
        const { data: liveSubs } = await supabase
          .from('subscriptions')
          .select('id, streampay_subscription_id')
          .eq('profile_id', profileToDelete.id)
          .eq('status', 'active')
          .not('streampay_subscription_id', 'is', null);
        for (const sub of liveSubs || []) {
          try {
            await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/streampay-cancel-subscription`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
              body: JSON.stringify({ subscription_id: sub.id }),
            });
          } catch (cancelErr) {
            console.error('Failed to cancel StreamPay subscription before delete:', cancelErr);
          }
        }

        if (restId) {
          await supabase.from('menu_items').delete().eq('restaurant_id', restId);
          await supabase.from('branches').delete().eq('restaurant_id', restId);
          await supabase.from('offers').delete().eq('restaurant_id', restId);
          await supabase.from('reviews').delete().eq('restaurant_id', restId);
          await supabase.from('hub_visits').delete().eq('restaurant_id', restId);
          await supabase.from('applications').delete().eq('restaurant_id', restId);
        }
        await supabase.from('subscriptions').delete().eq('profile_id', profileToDelete.id);
        await supabase.from('activated_tools').delete().eq('profile_id', profileToDelete.id);
        await supabase.from('chats').delete().eq('ownerId', profileToDelete.id);
        await supabase.from('activity').delete().eq('userId', profileToDelete.id);

        if (restId) {
          const { error: restDelErr } = await supabase.from('restaurants').delete().eq('id', restId);
          if (restDelErr) throw restDelErr;
        }

        const { error: delErr } = await supabase.from('profiles').delete().eq('id', profileToDelete.id);
        if (delErr) throw delErr;

        const { error: authErr } = await supabase.rpc('delete_auth_user', { target_user_id: profileToDelete.id });
        if (authErr) throw authErr;

        toast({ title: 'تم الحذف', description: `تم حذف ${profileToDelete.restaurant_name} بالكامل من النظام.` });
        setProfileToDelete(null);
        if (selectedProfileId === profileToDelete.id) {
          setDrawerOpen(false);
          setSelectedProfileId(null);
        }
      } catch (err: any) {
        toast({ title: 'خطأ في الحذف', description: err.message, variant: 'destructive' });
        setProfileToDelete(null);
      }
    });
  };

  const filteredSubscribers = useMemo(() => subscribers.filter((s) => {
    const matchesSearch = !searchQuery
      || s.restaurant_name?.includes(searchQuery)
      || s.full_name?.includes(searchQuery)
      || s.email?.includes(searchQuery);
    const matchesStatus = statusFilter === 'all' || s.account_status === statusFilter;
    const matchesPlan = planFilter === 'all' || s.currentSub?.plan_id === planFilter;
    return matchesSearch && matchesStatus && matchesPlan;
  }), [subscribers, searchQuery, statusFilter, planFilter]);

  const stats = useMemo(() => {
    const now = new Date();
    const in30Days = addDays(now, 30);
    let active = 0, expiringSoon = 0, trial = 0, annualRevenue = 0;
    for (const s of subscribers) {
      if (s.account_status === 'active') active++;
      const end = s.currentSub?.end_date ? new Date(s.currentSub.end_date) : null;
      if (end && isAfter(end, now) && !isAfter(end, in30Days)) expiringSoon++;
      if (s.currentSub?.plan_id === TRIAL_PLAN_ID) trial++;
      if (s.currentSub && isAfter(end || now, now)) {
        const plan = plans.find((p) => p.id === s.currentSub!.plan_id);
        if (plan) annualRevenue += plan.price_yearly || 0;
      }
    }
    return { total: subscribers.length, active, expiringSoon, trial, annualRevenue };
  }, [subscribers, plans]);

  const selectedProfile = subscribers.find((s) => s.id === selectedProfileId) || null;

  const resetFilters = () => {
    setSearchQuery('');
    setStatusFilter('all');
    setPlanFilter('all');
  };

  if (isLoading) {
    return (
      <div className="p-4 lg:p-6 space-y-4">
        <Skeleton className="h-8 w-56" />
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-2xl" />)}
        </div>
        <Skeleton className="h-96 rounded-2xl" />
      </div>
    );
  }

  return (
    <>
      <div className="p-4 lg:p-6 space-y-4">
        <div>
          <h1 className="text-lg font-bold text-gray-900">إدارة المشتركين</h1>
          <p className="text-xs text-gray-600 mt-0.5">إدارة حسابات المطاعم، الاشتراكات، النشاط والصلاحيات من مكان واحد.</p>
        </div>

        <SubscriberStats {...stats} />

        <div className="grid grid-cols-1 sm:grid-cols-[1fr_180px_180px_auto] gap-2.5">
          <div className="relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-600" />
            <input
              type="text"
              placeholder="ابحث باسم المشروع أو المالك أو البريد..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-10 pr-9 pl-3 rounded-xl border border-gray-200 text-xs text-right placeholder:text-gray-600 focus:outline-none focus:border-gray-300"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-10 rounded-xl border-gray-200 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent dir="rtl">
              <SelectItem value="all" className="text-xs">كل الحالات</SelectItem>
              <SelectItem value="active" className="text-xs">نشط</SelectItem>
              <SelectItem value="pending" className="text-xs">بانتظار</SelectItem>
              <SelectItem value="suspended" className="text-xs">معلق</SelectItem>
            </SelectContent>
          </Select>
          <Select value={planFilter} onValueChange={setPlanFilter}>
            <SelectTrigger className="h-10 rounded-xl border-gray-200 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent dir="rtl">
              <SelectItem value="all" className="text-xs">كل الباقات</SelectItem>
              {plans.map((p) => <SelectItem key={p.id} value={p.id} className="text-xs">{p.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <button onClick={resetFilters}
            className="h-10 px-4 rounded-xl border border-gray-200 text-gray-600 text-xs font-bold hover:bg-gray-50 transition-colors whitespace-nowrap">
            إعادة الفلاتر
          </button>
        </div>

        <div className="rounded-2xl border border-gray-100 overflow-hidden bg-white">
          <SubscribersTable rows={filteredSubscribers} selectedProfileId={selectedProfileId} onSelect={handleSelect} />
        </div>
      </div>

      <SubscriberDrawer
        profile={selectedProfile}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        onSave={fetchSubscribers}
        onDeleteRequest={handleDeleteRequest}
      />

      <AlertDialog open={!!profileToDelete} onOpenChange={(open) => !open && setProfileToDelete(null)}>
        <AlertDialogContent className="sm:max-w-lg p-0 gap-0" dir="rtl">
          <div className="px-5 pt-5 pb-3 border-b border-gray-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center">
                <Trash2 className="h-5 w-5 text-red-500" />
              </div>
              <div>
                <AlertDialogTitle className="text-base font-bold text-gray-900">حذف المشترك</AlertDialogTitle>
                <AlertDialogDescription className="text-xs text-gray-600 mt-0.5">لا يمكن التراجع عن هذا الإجراء</AlertDialogDescription>
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
