'use client';

import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { CheckCircle, ArrowRight } from "lucide-react";
import { Link } from "wouter";

export default function BillingSuccessPage() {
  const [, params] = useLocation();
  const [searchParams] = useState(() => new URLSearchParams(window.location.search));
  const invoiceId = searchParams.get("invoice_id");
  const status = searchParams.get("status");

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4" dir="rtl">
      <div className="w-full max-w-md bg-white rounded-2xl border border-gray-100 p-8 text-center space-y-5">
        <div className="w-16 h-16 rounded-full bg-emerald-50 flex items-center justify-center mx-auto">
          <CheckCircle className="h-8 w-8 text-emerald-500" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">تم الدفع بنجاح!</h1>
          <p className="text-sm text-gray-400 mt-2">تم تفعيل اشتراكك. يمكنك الآن الاستمتاع بجميع المميزات.</p>
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
