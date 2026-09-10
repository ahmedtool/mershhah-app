'use client';

import { OnboardingForm } from "@/components/auth/OnboardingForm";
import { Smartphone } from "lucide-react";

export default function OnboardingPage() {
  return (
    <div className="min-h-screen flex" dir="rtl">
      {/* Left: Form */}
      <div className="flex-1 flex items-center justify-center px-6 bg-white">
        <div className="w-full max-w-sm">
          <OnboardingForm />
        </div>
      </div>

      {/* Right: Visual */}
      <div className="hidden lg:flex flex-1 bg-gray-900 items-center justify-center relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,rgba(255,255,255,0.05),transparent)]" />
        <div className="text-center relative z-10 px-12">
          <div className="w-20 h-20 rounded-3xl bg-white/10 backdrop-blur-sm flex items-center justify-center mx-auto mb-8">
            <Smartphone className="h-10 w-10 text-white" />
          </div>
          <h2 className="text-3xl font-black text-white mb-3">مرشح</h2>
          <p className="text-sm text-white/50 leading-relaxed">
            منصة ذكية لإدارة مطعمك<br />قائمة طعام، فروع، عروض، وتقييمات
          </p>
        </div>
      </div>
    </div>
  );
}
