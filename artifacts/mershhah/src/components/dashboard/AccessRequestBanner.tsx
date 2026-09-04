'use client';

import { useState, useEffect } from 'react';
import { useUser } from '@/hooks/useUser';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { ShieldAlert, Loader2 } from 'lucide-react';

export function AccessRequestBanner() {
  const { user } = useUser();
  const [request, setRequest] = useState<any>(null);
  const [adminName, setAdminName] = useState('');
  const [isDeciding, setIsDeciding] = useState(false);
  const { toast } = useToast();

  const fetchPending = async () => {
    if (!user?.restaurantId) return;
    const { data } = await supabase
      .from('impersonation_requests')
      .select('*')
      .eq('restaurant_id', user.restaurantId)
      .eq('status', 'pending')
      .order('requested_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    setRequest(data);
    if (data?.admin_id) {
      const { data: adminProfile } = await supabase.from('profiles').select('full_name').eq('id', data.admin_id).single();
      setAdminName(adminProfile?.full_name || 'فريق الدعم');
    }
  };

  useEffect(() => {
    if (!user?.restaurantId) return;
    fetchPending();
    const channel = supabase
      .channel(`access-requests-${user.restaurantId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'impersonation_requests', filter: `restaurant_id=eq.${user.restaurantId}` }, fetchPending)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user?.restaurantId]);

  const decide = async (approve: boolean) => {
    if (!request) return;
    setIsDeciding(true);
    try {
      const updates: any = { status: approve ? 'approved' : 'denied', decided_at: new Date().toISOString() };
      if (approve) updates.expires_at = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      const { error } = await supabase.from('impersonation_requests').update(updates).eq('id', request.id);
      if (error) throw error;
      toast({ title: approve ? 'تم منح الدخول لمدة 24 ساعة' : 'تم رفض الطلب' });
      setRequest(null);
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'خطأ', description: e.message });
    } finally {
      setIsDeciding(false);
    }
  };

  if (!request) return null;

  return (
    <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 flex flex-col sm:flex-row items-start sm:items-center gap-3">
      <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
        <ShieldAlert className="h-4.5 w-4.5 text-amber-600" />
      </div>
      <div className="flex-1">
        <p className="text-sm font-bold text-gray-900">{adminName} من فريق الدعم يطلب دخول مؤقت لحسابك</p>
        <p className="text-xs text-gray-600 mt-0.5">
          {request.reason ? `السبب: ${request.reason} — ` : ''}
          لو وافقت، بيقدر يدخل لوحة تحكمك لمدة 24 ساعة بس عشان يساعدك.
        </p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <button onClick={() => decide(false)} disabled={isDeciding}
          className="h-9 px-4 rounded-xl border border-gray-200 bg-white text-xs font-bold text-gray-600 hover:bg-gray-50 disabled:opacity-50">
          رفض
        </button>
        <button onClick={() => decide(true)} disabled={isDeciding}
          className="h-9 px-4 rounded-xl bg-gray-900 text-white text-xs font-bold hover:bg-gray-800 disabled:opacity-50 flex items-center gap-2">
          {isDeciding ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
          موافقة
        </button>
      </div>
    </div>
  );
}
