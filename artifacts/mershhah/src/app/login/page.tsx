'use client';

import { LoginForm } from "@/components/auth/LoginForm";
import { Logo } from "@/components/shared/Logo";
import { Link } from "wouter";

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4" dir="rtl">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-block mb-6">
            <Logo />
          </div>
          <h1 className="text-lg font-black text-gray-900 mb-1">تسجيل الدخول</h1>
          <p className="text-xs text-gray-400">أهلاً بك! أدخل بياناتك للوصول للوحة التحكم</p>
        </div>

        <div className="bg-white border border-gray-100 rounded-2xl p-6">
          <LoginForm />
        </div>

        <p className="text-center text-[11px] text-gray-400 mt-5">
          ما عندك حساب؟{' '}
          <Link href="/register" className="text-gray-900 font-bold hover:underline">سوّ حساب جديد</Link>
        </p>
      </div>
    </div>
  );
}
