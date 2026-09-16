import { Link } from 'wouter';
import { Logo } from '@/components/shared/Logo';
import { InstagramIcon, WhatsAppIcon } from '@/components/shared/SocialIcons';
import { Mail } from 'lucide-react';

const FOOTER_COLUMNS = [
  {
    title: 'المنتج',
    links: [
      { label: 'الأسعار', href: '/pricing' },
      { label: 'المدونة', href: '/blog' },
      { label: 'حالة النظام', href: '/status' },
    ],
  },
  {
    title: 'تعرّف علينا',
    links: [
      { label: 'من نحن', href: '/about' },
      { label: 'تواصل معنا', href: '/contact' },
    ],
  },
  {
    title: 'قانوني',
    links: [
      { label: 'الشروط والأحكام', href: '/terms' },
      { label: 'سياسة الخصوصية', href: '/privacy' },
    ],
  },
];

// The boxed/rounded-card footer shared by the redesigned landing-style
// pages (home, pricing). Deliberately separate from PublicFooter (the
// plain white full-bleed footer every other public page still uses) so
// restyling one doesn't drag the other's pages along with it.
export function LandingFooter() {
  return (
    <>
      <div className="bg-[#f4f4f7] rounded-[20px] m-6 p-8 sm:p-10 grid sm:grid-cols-[1.4fr_repeat(3,1fr)] gap-7">
        <div>
          <Logo />
          <p className="mt-3.5 text-[12.5px] text-[#8b8b95] leading-[1.9] max-w-[280px]">
            الواجهة الرقمية المتكاملة للمطاعم والمقاهي في السعودية.
          </p>
          <div className="flex gap-2.5 mt-5">
            <a href="https://www.instagram.com/mershhah/" target="_blank" rel="noopener noreferrer" aria-label="مرشح على انستقرام" className="w-[34px] h-[34px] rounded-[10px] bg-white flex items-center justify-center text-[#5b6478] hover:text-[#131a2b] transition-colors">
              <InstagramIcon size={15} />
            </a>
            <a href="https://wa.me/966541727971" target="_blank" rel="noopener noreferrer" aria-label="تواصل معنا عبر واتساب" className="w-[34px] h-[34px] rounded-[10px] bg-white flex items-center justify-center text-[#5b6478] hover:text-[#131a2b] transition-colors">
              <WhatsAppIcon size={15} />
            </a>
            <a href="mailto:info@mershhah.com" aria-label="راسلنا عبر البريد الإلكتروني" className="w-[34px] h-[34px] rounded-[10px] bg-white flex items-center justify-center text-[#5b6478] hover:text-[#131a2b] transition-colors">
              <Mail size={15} />
            </a>
          </div>
        </div>
        {FOOTER_COLUMNS.map((col) => (
          <div key={col.title}>
            <div className="text-[13.5px] font-bold text-[#131a2b]">{col.title}</div>
            <div className="flex flex-col gap-2.5 mt-4">
              {col.links.map((link) => (
                <Link key={link.href} href={link.href} className="text-[12.5px] text-[#8b8b95] hover:text-[#131a2b] transition-colors">
                  {link.label}
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="flex justify-between flex-wrap gap-3 px-6 sm:px-10 pb-8 text-xs text-[#a7a7b2]">
        <span>© مرشّح {new Date().getFullYear()}</span>
        <span>صُنع بكل حب في السعودية</span>
      </div>
    </>
  );
}
