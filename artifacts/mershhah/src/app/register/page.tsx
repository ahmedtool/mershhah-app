'use client';

import { RegisterForm } from "@/components/auth/RegisterForm";
import { Logo } from "@/components/shared/Logo";
import { Link } from "wouter";

export default function RegisterPage() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4" dir="rtl">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-block mb-6">
            <Logo />
          </div>
          <h1 className="text-lg font-black text-gray-900 mb-1">أنشئ حسابك</h1>
          <p className="text-xs text-gray-400">سجّل بياناتك للانضمام إلى المنصة</p>
        </div>

        <div className="bg-white border border-gray-100 rounded-2xl p-6">
          <RegisterForm />
        </div>

        <p className="text-center text-[11px] text-gray-400 mt-5">
          عندك حساب؟{' '}
          <Link href="/login" className="text-gray-900 font-bold hover:underline">سجل دخول</Link>
        </p>
      </div>
    </div>
  );
}
