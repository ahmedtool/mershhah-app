'use client';

import { Link } from 'wouter';
import { Logo } from '@/components/shared/Logo';
import { InstagramIcon, WhatsAppIcon } from '@/components/shared/SocialIcons';
import { Mail } from 'lucide-react';

export function PublicFooter() {
  return (
    <footer className="border-t border-gray-100 bg-white" dir="rtl">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-8 mb-10">
          {/* Brand */}
          <div className="col-span-2 sm:col-span-1">
            <Logo />
            <p className="text-[11px] text-gray-400 mt-3 leading-relaxed max-w-[200px]">
              الواجهة الرقمية المتكاملة للمطاعم والمقاهي في السعودية.
            </p>
            <div className="flex gap-2 mt-4">
              <a href="https://www.instagram.com/mershhah/" target="_blank" rel="noopener noreferrer" className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors">
                <InstagramIcon size={16} />
              </a>
              <a href="https://wa.me/966560766880" target="_blank" rel="noopener noreferrer" className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors">
                <WhatsAppIcon size={16} />
              </a>
              <a href="mailto:info@mershhah.com" className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors">
                <Mail size={16} />
              </a>
            </div>
          </div>

          {/* Links */}
          <div>
            <h4 className="text-xs font-bold text-gray-900 mb-3">المنتج</h4>
            <ul className="space-y-2">
              <li><Link href="/pricing" className="text-[11px] text-gray-400 hover:text-gray-600 transition-colors">الأسعار</Link></li>
              <li><Link href="/blog" className="text-[11px] text-gray-400 hover:text-gray-600 transition-colors">المدونة</Link></li>
              <li><Link href="/status" className="text-[11px] text-gray-400 hover:text-gray-600 transition-colors">حالة النظام</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="text-xs font-bold text-gray-900 mb-3">تعرف علينا</h4>
            <ul className="space-y-2">
              <li><Link href="/about" className="text-[11px] text-gray-400 hover:text-gray-600 transition-colors">من نحن</Link></li>
              <li><Link href="/contact" className="text-[11px] text-gray-400 hover:text-gray-600 transition-colors">تواصل معنا</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="text-xs font-bold text-gray-900 mb-3">قانوني</h4>
            <ul className="space-y-2">
              <li><Link href="/terms" className="text-[11px] text-gray-400 hover:text-gray-600 transition-colors">الشروط والأحكام</Link></li>
              <li><Link href="/privacy" className="text-[11px] text-gray-400 hover:text-gray-600 transition-colors">سياسة الخصوصية</Link></li>
            </ul>
          </div>
        </div>

        <div className="border-t border-gray-100 pt-6 flex flex-col sm:flex-row justify-between items-center gap-3">
          <p className="text-[10px] font-bold text-gray-300">مرشح © {new Date().getFullYear()}</p>
          <p className="text-[10px] text-gray-300">صُنع بكل حب في السعودية</p>
        </div>
      </div>
    </footer>
  );
}
