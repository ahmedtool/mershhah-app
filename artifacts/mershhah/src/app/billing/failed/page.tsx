'use client';

import { AlertCircle, ArrowRight, RefreshCw } from "lucide-react";
import { Link } from "wouter";

export default function BillingFailedPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4" dir="rtl">
      <div className="w-full max-w-md bg-white rounded-2xl border border-gray-100 p-8 text-center space-y-5">
        <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center mx-auto">
          <AlertCircle className="h-8 w-8 text-red-500" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">فشلت عملية الدفع</h1>
          <p className="text-sm text-gray-400 mt-2">حدثت مشكلة أثناء الدفع. يمكنك المحاولة مرة أخرى.</p>
        </div>
        <div className="flex gap-3">
          <Link href="/owner/billing" className="flex-1">
            <button className="w-full h-11 rounded-xl bg-gray-900 text-white text-sm font-bold hover:bg-gray-800 transition-colors flex items-center justify-center gap-2">
              <RefreshCw className="h-4 w-4" />
              المحاولة مرة أخرى
            </button>
          </Link>
          <Link href="/owner/dashboard" className="flex-1">
            <button className="w-full h-11 rounded-xl border border-gray-200 text-sm font-bold text-gray-600 hover:bg-gray-50 transition-colors flex items-center justify-center gap-2">
              لوحة التحكم
              <ArrowRight className="h-4 w-4" />
            </button>
          </Link>
        </div>
      </div>
    </div>
  );
}
