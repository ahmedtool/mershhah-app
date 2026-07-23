'use client';

import { Logo } from "@/components/shared/Logo";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { Link } from "wouter";
import { PublicFooter } from "@/components/shared/PublicFooter";
import { InstagramIcon, WhatsAppIcon } from "@/components/shared/SocialIcons";
import { Mail } from "lucide-react";

const contactChannels = [
  {
    title: "البريد الإلكتروني",
    description: "للاستفسارات العامة والدعم",
    href: "mailto:info@mershhah.com",
    icon: Mail,
    label: "info@mershhah.com",
  },
  {
    title: "واتساب",
    description: "رد سريع على استفساراتك",
    href: "https://wa.me/966560766880",
    icon: WhatsAppIcon,
    label: "تواصل عبر واتساب",
  },
  {
    title: "إنستغرام",
    description: "تابعنا وأرسل رسالة",
    href: "https://www.instagram.com/mershhah/",
    icon: InstagramIcon,
    label: "@mershhah",
  },
];

export default function ContactPage() {
  return (
    <div className="min-h-screen overflow-x-hidden" dir="rtl">
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex justify-between items-center">
          <Logo />
          <Button asChild variant="ghost" className="text-gray-600 text-sm font-bold hover:bg-gray-50 rounded-xl px-4">
            <Link href="/"><ArrowLeft className="ml-2 h-4 w-4" />العودة</Link>
          </Button>
        </div>
      </header>

      <main className="py-16 sm:py-24 px-4">
        <div className="max-w-2xl mx-auto text-center mb-12">
          <h1 className="text-3xl sm:text-4xl font-black text-gray-900 mb-3">تواصل معنا</h1>
          <p className="text-sm text-gray-400">نسعد بتواصلك. اختر القناة المناسبة وسنرد عليك في أقرب وقت.</p>
        </div>

        <div className="grid sm:grid-cols-3 gap-4 max-w-3xl mx-auto">
          {contactChannels.map((channel) => (
            <a
              key={channel.title}
              href={channel.href}
              target={channel.href.startsWith("http") ? "_blank" : undefined}
              rel={channel.href.startsWith("http") ? "noopener noreferrer" : undefined}
              className="bg-white border border-gray-100 rounded-2xl p-6 text-center hover:border-gray-200 transition-colors"
            >
              <div className="w-11 h-11 rounded-xl bg-gray-50 flex items-center justify-center mx-auto mb-4">
                <channel.icon size={20} className="text-gray-400 shrink-0" />
              </div>
              <h3 className="text-sm font-bold text-gray-900 mb-1">{channel.title}</h3>
              <p className="text-[11px] text-gray-400 mb-3">{channel.description}</p>
              <span className="text-xs font-bold text-gray-600">{channel.label}</span>
            </a>
          ))}
        </div>
      </main>

      <PublicFooter />
    </div>
  );
}
