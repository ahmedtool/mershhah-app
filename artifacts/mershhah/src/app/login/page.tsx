'use client';

import { LoginForm } from "@/components/auth/LoginForm";
import { Link } from "wouter";

export default function LoginPage() {
  return (
    <div className="min-h-screen flex" dir="rtl">
      {/* Right side - Form */}
      <div className="flex-1 flex items-center justify-center px-6 bg-white">
        <div className="w-full max-w-sm">
          {/* Logo */}
          <Link href="/" className="inline-flex items-center gap-2 mb-10">
            <span className="text-xl font-bold text-gray-900">مرشح</span>
          </Link>

          {/* Title */}
          <div className="mb-8">
            <h1 className="text-2xl font-black text-gray-900 mb-2">أهلاً بك مجدداً</h1>
            <p className="text-sm text-gray-400">سجّل دخولك للوصول إلى لوحة التحكم</p>
          </div>

          {/* Form Card */}
          <div className="bg-gray-50 border border-gray-100 rounded-2xl p-6">
            <LoginForm />
          </div>

          {/* Register Link */}
          <div className="mt-6 text-center">
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <p className="text-sm text-gray-500">ما عندك حساب؟</p>
              <Link href="/register" className="inline-block mt-2 text-sm font-bold text-gray-900 hover:underline">
                أنشئ حسابك الآن
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Left side - Branding */}
      <div className="hidden lg:flex flex-1 bg-gray-900 items-center justify-center p-12">
        <div className="text-center max-w-md">
          <div className="w-20 h-20 rounded-2xl bg-white/10 flex items-center justify-center mx-auto mb-8">
            <span className="text-3xl font-bold text-white">م</span>
          </div>
          <h2 className="text-3xl font-black text-white mb-4">مرشح</h2>
          <p className="text-gray-400 text-sm leading-relaxed">
            منصة ذكية لإدارة مطعمك أو مقهاك. تابع مبيعاتك، أدر قائمتك، وتواصل مع عملائك في مكان واحد.
          </p>
          <div className="flex items-center justify-center gap-6 mt-8">
            <div className="text-center">
              <p className="text-2xl font-black text-white">+500</p>
              <p className="text-xs text-gray-500">مطعم مسجل</p>
            </div>
            <div className="w-px h-10 bg-white/10" />
            <div className="text-center">
              <p className="text-2xl font-black text-white">+50K</p>
              <p className="text-xs text-gray-500">طلب شهرياً</p>
            </div>
            <div className="w-px h-10 bg-white/10" />
            <div className="text-center">
              <p className="text-2xl font-black text-white">99%</p>
              <p className="text-xs text-gray-500">رضا العملاء</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
