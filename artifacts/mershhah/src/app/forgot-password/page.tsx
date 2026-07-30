'use client';

import { ForgotPasswordForm } from "@/components/auth/ForgotPasswordForm";
import { Link } from "wouter";

export default function ForgotPasswordPage() {
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
            <h1 className="text-2xl font-black text-gray-900 mb-2">نسيت كلمة المرور؟</h1>
            <p className="text-sm text-gray-400">أدخل بريدك الإلكتروني وسنرسل لك رابطاً لإعادة التعيين</p>
          </div>

          {/* Form Card */}
          <div className="bg-gray-50 border border-gray-100 rounded-2xl p-6">
            <ForgotPasswordForm />
          </div>

          {/* Back Link */}
          <div className="mt-6 text-center">
            <Link href="/login" className="text-sm font-bold text-gray-900 hover:underline">
              العودة لتسجيل الدخول
            </Link>
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
            لا تقلق، يحدث للجميع. سنساعدك في استعادة حسابك في أسرع وقت.
          </p>
        </div>
      </div>
    </div>
  );
}
