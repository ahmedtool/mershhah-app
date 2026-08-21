'use client';

import { useEffect, useState, useRef } from "react";
import { CheckCircle, ArrowRight, Loader2 } from "lucide-react";
import { Link } from "wouter";
import { supabase } from "@/lib/supabase";
import { useUser } from "@/hooks/useUser";

// StreamPay redirects the browser here the instant the payment itself
// succeeds, but the actual subscription activation happens separately via
// an async server-to-server webhook that can lag a few seconds behind.
// Showing "activated!" immediately was a lie in that gap - a customer who
// clicked straight back to /owner/billing would see "no subscription yet"
// even though the payment genuinely went through. Poll until the
// subscription really is active/pending before claiming success.
const POLL_INTERVAL_MS = 1500;
const POLL_TIMEOUT_MS = 20000;

export default function BillingSuccessPage() {
  const { user } = useUser();
  const [searchParams] = useState(() => new URLSearchParams(window.location.search));
  const invoiceId = searchParams.get("invoice_id");
  const [state, setState] = useState<'checking' | 'confirmed' | 'delayed'>('checking');
  const startedAt = useRef<number>(Date.now());

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;

    const poll = async () => {
      while (!cancelled) {
        const { data } = await supabase
          .from('subscriptions')
          .select('id, status')
          .eq('profile_id', user.id)
          .in('status', ['active', 'pending'])
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (cancelled) return;
        if (data) {
          setState('confirmed');
          return;
        }
        if (Date.now() - startedAt.current > POLL_TIMEOUT_MS) {
          setState('delayed');
          return;
        }
        await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
      }
    };

    poll();
    return () => { cancelled = true; };
  }, [user?.id]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4" dir="rtl">
      <div className="w-full max-w-md bg-white rounded-2xl border border-gray-100 p-8 text-center space-y-5">
        <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto ${state === 'checking' ? 'bg-gray-50' : 'bg-emerald-50'}`}>
          {state === 'checking'
            ? <Loader2 className="h-8 w-8 text-gray-300 animate-spin" />
            : <CheckCircle className="h-8 w-8 text-emerald-500" />}
        </div>
        <div>
          {state === 'checking' && (
            <>
              <h1 className="text-xl font-bold text-gray-900">جاري تفعيل اشتراكك...</h1>
              <p className="text-sm text-gray-400 mt-2">الدفع تم بنجاح، وراح يفعّل تلقائياً خلال لحظات.</p>
            </>
          )}
          {state === 'confirmed' && (
            <>
              <h1 className="text-xl font-bold text-gray-900">تم الدفع بنجاح!</h1>
              <p className="text-sm text-gray-400 mt-2">تم تفعيل اشتراكك. يمكنك الآن الاستمتاع بجميع المميزات.</p>
            </>
          )}
          {state === 'delayed' && (
            <>
              <h1 className="text-xl font-bold text-gray-900">تم الدفع بنجاح!</h1>
              <p className="text-sm text-gray-400 mt-2">التفعيل يأخذ وقت أطول من المعتاد — تحقق من صفحة الفواتير خلال دقيقة، أو حدّث الصفحة.</p>
            </>
          )}
        </div>
        {invoiceId && (
          <div className="bg-gray-50 rounded-xl p-3">
            <p className="text-[10px] text-gray-400">رقم الفاتورة</p>
            <p className="text-xs font-mono text-gray-600 mt-0.5">{invoiceId}</p>
          </div>
        )}
        <Link href="/owner/billing">
          <button className="w-full h-11 rounded-xl bg-gray-900 text-white text-sm font-bold hover:bg-gray-800 transition-colors flex items-center justify-center gap-2">
            العودة للفواتير
            <ArrowRight className="h-4 w-4" />
          </button>
        </Link>
      </div>
    </div>
  );
}
