'use client';

import { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabase';
import { Loader2, KeyRound, ExternalLink, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';

interface ImpersonationAccessCardProps {
  restaurantId: string | null | undefined;
}

export function ImpersonationAccessCard({ restaurantId }: ImpersonationAccessCardProps) {
  const [request, setRequest] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRequesting, setIsRequesting] = useState(false);
  const [isEntering, setIsEntering] = useState(false);
  const { toast } = useToast();

  const fetchLatestRequest = async () => {
    if (!restaurantId) { setRequest(null); setIsLoading(false); return; }
    setIsLoading(true);
    const { data } = await supabase
      .from('impersonation_requests')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .order('requested_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    setRequest(data);
    setIsLoading(false);
  };

  useEffect(() => {
    fetchLatestRequest();
    if (!restaurantId) return;
    const channel = supabase
      .channel(`impersonation-admin-${restaurantId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'impersonation_requests', filter: `restaurant_id=eq.${restaurantId}` }, fetchLatestRequest)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [restaurantId]);

  const callFunction = async (path: string, body: Record<string, unknown>) => {
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'حدث خطأ');
    return data;
  };

  const handleRequest = async () => {
    if (!restaurantId) return;
    setIsRequesting(true);
    try {
      await callFunction('request-owner-access', { restaurantId });
      toast({ title: 'تم إرسال الطلب', description: 'وصل إشعار لصاحب المطعم بلوحة تحكمه وبريده' });
      fetchLatestRequest();
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'خطأ', description: e.message });
    } finally {
      setIsRequesting(false);
    }
  };

  const handleEnter = async () => {
    if (!request) return;
    setIsEntering(true);
    try {
      const data = await callFunction('enter-owner-account', { requestId: request.id });
      window.open(data.actionLink, '_blank');
      fetchLatestRequest();
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'خطأ', description: e.message });
    } finally {
      setIsEntering(false);
    }
  };

  if (isLoading) return null;

  const isExpired = request?.status === 'approved' && request.expires_at && new Date(request.expires_at) < new Date();
  const effectiveStatus = isExpired ? 'expired' : request?.status;

  return (
    <div className="rounded-xl border border-gray-100 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <KeyRound className="h-4 w-4 text-gray-400" />
        <span className="text-xs font-bold text-gray-600">الدخول للوحة تحكم المطعم</span>
      </div>

      {(!request || effectiveStatus === 'denied' || effectiveStatus === 'expired') && (
        <>
          {effectiveStatus === 'denied' && <p className="text-[11px] text-red-500">رفض صاحب المطعم آخر طلب.</p>}
          {effectiveStatus === 'expired' && <p className="text-[11px] text-gray-400">انتهت صلاحية آخر دخول (24 ساعة).</p>}
          <button onClick={handleRequest} disabled={isRequesting}
            className="w-full h-9 rounded-lg bg-gray-900 text-white text-xs font-bold hover:bg-gray-800 disabled:opacity-50 flex items-center justify-center gap-2">
            {isRequesting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            اطلب دخول (24 ساعة بعد الموافقة)
          </button>
        </>
      )}

      {effectiveStatus === 'pending' && (
        <div className="flex items-center gap-2 text-[11px] text-amber-600 bg-amber-50 rounded-lg px-3 py-2">
          <Clock className="h-3.5 w-3.5" />
          بانتظار موافقة صاحب المطعم
        </div>
      )}

      {effectiveStatus === 'approved' && (
        <>
          <p className="text-[11px] text-emerald-600">
            موافق عليه — صالح لين {request.expires_at ? format(new Date(request.expires_at), 'dd MMM، hh:mm a', { locale: ar }) : ''}
          </p>
          <button onClick={handleEnter} disabled={isEntering}
            className="w-full h-9 rounded-lg bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 disabled:opacity-50 flex items-center justify-center gap-2">
            {isEntering ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ExternalLink className="h-3.5 w-3.5" />}
            دخول الآن
          </button>
        </>
      )}
    </div>
  );
}
