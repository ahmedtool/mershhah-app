'use client';

import { Button } from '@/components/ui/button';
import { Logo } from '@/components/shared/Logo';
import { QrCode, Link as LinkIcon } from 'lucide-react';
import { Link } from 'wouter';
import { LandingFooter } from '@/components/shared/LandingFooter';
import { useDocumentMeta } from '@/hooks/useDocumentMeta';

const MENU_ITEMS = [
  { name: 'فلات وايت', desc: 'حبوب إثيوبية — تحميص فاتح', price: '١٨ ر.س' },
  { name: 'كرواسون لوز', desc: 'مخبوز طازج يومياً', price: '٢٤ ر.س' },
  { name: 'سلطة كينوا', desc: 'خفيفة وغنية بالبروتين', price: '٣٢ ر.س' },
];

export default function HomePage() {
  useDocumentMeta(
    'منصة إدارة المطاعم والمقاهي الرقمية',
    'منيو رقمي تفاعلي، مساعد ذكاء اصطناعي للعملاء، وأدوات تحليلات ونمو لأصحاب المطاعم والمقاهي في السعودية — رابط واحد أو QR يجمع كل شيء لكل فرع.'
  );

  return (
    <div dir="rtl" className="min-h-screen bg-[#e9e9ec] py-6 sm:py-10 px-3 sm:px-6">
      <div className="max-w-[1040px] mx-auto bg-white rounded-[24px] sm:rounded-[28px] overflow-hidden">

        {/* Header */}
        <header className="flex items-center gap-4 sm:gap-7 px-5 sm:px-10 py-5 sm:py-6">
          <Logo />
          <Link href="/pricing" className="hidden sm:inline text-sm font-semibold text-[#131a2b] hover:text-[#3d4a66] transition-colors">
            الباقات
          </Link>
          <Link href="/login" className="text-sm font-semibold text-[#8b8b95] hover:text-[#3d4a66] transition-colors">
            دخول
          </Link>
          <div className="flex-1" />
          <Button asChild className="bg-[#131a2b] hover:bg-[#2b3549] text-white rounded-full px-5 sm:px-6 h-10 sm:h-11 text-[13px] sm:text-[13.5px] font-semibold">
            <Link href="/register">ابدأ الآن</Link>
          </Button>
        </header>

        {/* Hero */}
        <section className="grid md:grid-cols-2 gap-10 px-5 sm:px-10 pb-14 items-start">
          <div className="relative pt-3">
            <div className="inline-flex items-center gap-2 bg-[#f4f4f7] rounded-full px-4 py-[7px] text-xs font-semibold text-[#5b6478]">
              <span className="w-[7px] h-[7px] rounded-full bg-[#2fbf71]" />
              جاهز خلال دقائق
            </div>
            <h1 className="mt-[18px] text-3xl sm:text-4xl md:text-[44px] leading-[1.32] tracking-tight font-bold text-[#131a2b]">
              الواجهة الرقمية <span className="text-[#8b93a6]">✦</span>
              <br />الموحدة لمشروعك
              <br /><span className="text-[#8b93a6]">في رابط واحد</span>
            </h1>
            <p className="mt-6 max-w-[440px] text-[15px] leading-[1.9] text-[#8b8b95]">
              رابط واحد يجمع كل شيء: منيو تفاعلي، مساعد ذكي، وتحليلات دقيقة. كل هذا مصمم خصيصاً للمطاعم والمقاهي في السعودية.
            </p>
            <Button asChild className="mt-8 h-14 px-9 bg-[#131a2b] hover:bg-[#2b3549] text-white rounded-full text-sm font-semibold">
              <Link href="/register">ابدأ الآن</Link>
            </Button>
          </div>

          {/* Phone mockup */}
          <div className="relative flex justify-center pt-2">
            <div className="absolute inset-x-[6%] top-[70px] h-[66%] bg-[#131a2b] rounded-[28px]" />
            <div className="relative w-[260px] sm:w-[286px] bg-[#0d0d12] rounded-[40px] p-[9px] shadow-[0_30px_60px_rgba(13,13,18,0.28)]">
              <div className="bg-white rounded-[32px] overflow-hidden px-4 pt-3.5">
                <div className="flex justify-between items-center text-[11px] font-bold text-[#111] pb-3">
                  <span className="tracking-widest text-[#9a9aa5]">▰ ⌁ ▮▮</span>
                  <span dir="ltr">9:41</span>
                </div>
                <div className="flex justify-between items-center">
                  <div className="w-[26px] h-[26px] rounded-lg bg-[#f2f2f7] flex items-center justify-center text-[11px] text-[#131a2b]">☰</div>
                  <div className="flex items-center gap-2">
                    <div className="text-right">
                      <div className="text-[11.5px] font-bold text-[#131a2b]">مقهى الرصيف</div>
                      <div className="text-[9px] text-[#b0b0bb]">فرع الملقا</div>
                    </div>
                    <div className="w-[26px] h-[26px] rounded-lg bg-[#131a2b] text-white flex items-center justify-center text-[11px] font-bold">ر</div>
                  </div>
                </div>
                <div className="flex gap-1.5 mt-3.5 text-[9.5px] font-semibold">
                  <span className="bg-[#131a2b] text-white rounded-full px-3 py-1.5">الأكثر طلباً</span>
                  <span className="bg-[#f2f2f7] text-[#8b8b95] rounded-full px-3 py-1.5">قهوة مختصة</span>
                  <span className="bg-[#f2f2f7] text-[#8b8b95] rounded-full px-3 py-1.5">حلويات</span>
                </div>
                {MENU_ITEMS.map((item) => (
                  <div key={item.name} className="flex items-center gap-2.5 py-2.5 border-b border-[#f1f1f5]">
                    <div className="w-11 h-11 rounded-xl shrink-0" style={{ background: 'repeating-linear-gradient(45deg,#eeeef3 0 6px,#f7f7fa 6px 12px)' }} />
                    <div className="flex-1 min-w-0">
                      <div className="text-[11.5px] font-bold text-[#131a2b]">{item.name}</div>
                      <div className="text-[9.5px] text-[#b0b0bb] mt-0.5">{item.desc}</div>
                    </div>
                    <div className="text-[11.5px] font-bold text-[#131a2b] shrink-0">{item.price}</div>
                  </div>
                ))}
                <div className="flex items-center gap-2 bg-[#f4f4f7] rounded-2xl px-3 py-2.5 mt-3.5">
                  <div className="w-[22px] h-[22px] rounded-full bg-[#131a2b] text-white text-[10px] flex items-center justify-center shrink-0">✦</div>
                  <div className="flex-1 text-[10px] text-[#8b8b95]">اسأل المساعد الذكي عن المكوّنات…</div>
                </div>
                <div className="flex justify-between px-2.5 pt-3.5 pb-3 text-[13px] text-[#c3c3cd]">
                  <span className="text-[#131a2b]">▤</span><span>◎</span><span>✦</span><span>▥</span>
                </div>
                <div className="h-1 w-24 bg-[#0d0d12] rounded-full mx-auto mb-2" />
              </div>
            </div>
          </div>
        </section>

        {/* Team-in-your-pocket banner + feature cards */}
        <div className="px-4 sm:px-6">
          <div className="relative bg-[#131a2b] rounded-[24px] px-6 pt-12 pb-[150px] overflow-hidden">
            <div className="absolute left-1/2 -top-[120px] w-[760px] h-[760px] -ml-[380px] rounded-full border border-white/[0.07]" />
            <div className="absolute left-1/2 -top-10 w-[560px] h-[560px] -ml-[280px] rounded-full border border-white/[0.07]" />
            <h2 className="relative m-0 text-center text-2xl sm:text-3xl font-bold tracking-tight text-white">
              فريق عمل رقمي <span className="text-[#8b93a6]">في جيبك</span>
            </h2>
            <p className="relative mt-3 text-center text-sm text-[#9aa3b6]">أدوات ذكية تعمل معاً لنمو مطعمك أو مقهاك.</p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 -mt-[120px] relative">

            {/* Card 1: QR menu */}
            <div className="relative bg-[#f4f4f7] rounded-[20px] pt-6 px-5 h-[340px] overflow-hidden">
              <h3 className="m-0 text-center text-[17px] font-bold text-[#131a2b] leading-[1.6]">منيو يفتح بمسح كود<br />على الطاولة</h3>
              <div className="absolute left-1/2 top-[150px] w-[300px] h-[300px] -ml-[150px] rounded-full border border-[#e4e4ea]" />
              <div className="absolute left-1/2 top-[190px] w-[220px] h-[220px] -ml-[110px] rounded-full border border-[#e4e4ea]" />
              <div className="relative w-[150px] mx-auto mt-[22px] bg-[#0d0d12] rounded-[26px] p-1.5 pb-0">
                <div className="bg-white rounded-t-[22px] px-2.5 pt-2 pb-3.5">
                  <div className="flex justify-between text-[7px] font-bold text-[#111]">
                    <span className="text-[#9a9aa5]">▰ ⌁ ▮</span><span dir="ltr">9:41</span>
                  </div>
                  <div className="text-center mt-2.5 text-[8px] font-bold">امسح الكود</div>
                  <div className="mx-auto mt-3 w-[78px] h-[78px] border-[3px] border-white outline outline-1 outline-[#e4e4ea]" style={{ backgroundImage: 'repeating-conic-gradient(#131a2b 0% 25%, #fff 0% 50%)', backgroundSize: '9px 9px' }} />
                  <div className="text-center mt-2 text-[8px] font-bold text-[#131a2b]">مقهى الرصيف — طاولة ٧</div>
                  <div className="text-center mt-1 text-[6.5px] text-[#b0b0bb] leading-[1.6]">يفتح المنيو فوراً بلا تطبيق<br />ولا تحميل</div>
                </div>
              </div>
            </div>

            {/* Card 2: AI assistant */}
            <div className="relative bg-[#f4f4f7] rounded-[20px] px-5 pb-6 h-[340px] overflow-hidden flex flex-col justify-end">
              <div className="absolute left-1/2 top-5 w-[300px] h-[300px] -ml-[150px] rounded-full border border-[#e4e4ea]" />
              <div className="absolute left-1/2 top-[60px] w-[220px] h-[220px] -ml-[110px] rounded-full border border-[#e4e4ea]" />
              <div className="absolute left-1/2 -top-[26px] -ml-[75px] w-[150px] bg-[#0d0d12] rounded-[26px] p-1.5">
                <div className="bg-white rounded-[22px] px-2.5 pt-3.5 pb-3">
                  <div className="flex items-center gap-1.5">
                    <div className="w-[18px] h-[18px] rounded-full bg-[#131a2b] text-white text-[8px] flex items-center justify-center">✦</div>
                    <div className="text-[8px] font-bold text-[#131a2b]">المساعد الذكي</div>
                  </div>
                  <div className="bg-[#f4f4f7] rounded-tl-[10px] rounded-tr-[10px] rounded-br-[3px] rounded-bl-[10px] px-2 py-1.5 mt-2.5 text-[6.5px] text-[#5b6478] leading-[1.7]">هل يوجد طبق بدون لاكتوز؟</div>
                  <div className="bg-[#131a2b] text-white rounded-tl-[10px] rounded-tr-[10px] rounded-br-[10px] rounded-bl-[3px] px-2 py-1.5 mt-1.5 text-[6.5px] leading-[1.7]">نعم — لاتيه بحليب الشوفان وسلطة الكينوا. أضيفهما للطلب؟</div>
                  <div className="bg-[#f4f4f7] rounded-[10px] p-2 mt-2">
                    <div className="flex justify-between text-[6.5px] text-[#8b8b95]"><span>لاتيه شوفان</span><span className="text-[#131a2b] font-bold">١٩ ر.س</span></div>
                    <div className="flex justify-between text-[6.5px] text-[#8b8b95] mt-1"><span>سلطة كينوا</span><span className="text-[#131a2b] font-bold">٣٢ ر.س</span></div>
                  </div>
                  <div className="bg-[#131a2b] text-white rounded-full py-1.5 text-[7.5px] font-bold mt-2 text-center">أضف للطلب</div>
                </div>
              </div>
              <h3 className="relative m-0 text-center text-[17px] font-bold text-[#131a2b] leading-[1.6]">مساعد ذكي يرد على<br />عملائك على مدار الساعة</h3>
            </div>

            {/* Card 3: analytics */}
            <div className="relative bg-[#f4f4f7] rounded-[20px] pt-6 px-5 h-[340px] overflow-hidden sm:col-span-2 lg:col-span-1">
              <h3 className="m-0 text-center text-[17px] font-bold text-[#131a2b] leading-[1.6]">قرارات مبنية على<br />أرقام لا على تخمين</h3>
              <div className="absolute left-1/2 top-[150px] w-[300px] h-[300px] -ml-[150px] rounded-full border border-[#e4e4ea]" />
              <div className="relative w-[150px] mx-auto mt-[22px] bg-[#0d0d12] rounded-[26px] p-1.5 pb-0">
                <div className="bg-white rounded-t-[22px] px-2.5 pt-2 pb-3.5">
                  <div className="flex justify-between text-[7px] font-bold text-[#111]">
                    <span className="text-[#9a9aa5]">▰ ⌁ ▮</span><span dir="ltr">9:41</span>
                  </div>
                  <div className="text-center mt-2 text-[8px] font-bold">تحليلات الأداء</div>
                  <div className="bg-[#131a2b] rounded-xl px-2.5 py-2.5 mt-2.5 text-white">
                    <div className="text-[7px] opacity-75">مبيعات هذا الأسبوع</div>
                    <div className="text-[13px] font-bold mt-0.5">٤٨٬٢٥٠ ر.س</div>
                    <div className="flex items-end gap-1 h-[30px] mt-2.5">
                      <div className="flex-1 h-[40%] bg-white/30 rounded-sm" />
                      <div className="flex-1 h-[65%] bg-white/30 rounded-sm" />
                      <div className="flex-1 h-1/2 bg-white/30 rounded-sm" />
                      <div className="flex-1 h-[85%] bg-white rounded-sm" />
                      <div className="flex-1 h-[70%] bg-white/30 rounded-sm" />
                      <div className="flex-1 h-full bg-white/30 rounded-sm" />
                    </div>
                  </div>
                  <div className="flex justify-between mt-3 text-center">
                    <div><div className="text-[6.5px] text-[#b0b0bb]">زيارات المنيو</div><div className="text-[7.5px] font-bold">٣٬١٤٠</div></div>
                    <div><div className="text-[6.5px] text-[#b0b0bb]">متوسط الفاتورة</div><div className="text-[7.5px] font-bold">٦٨ ر.س</div></div>
                    <div><div className="text-[6.5px] text-[#b0b0bb]">النمو</div><div className="text-[7.5px] font-bold text-[#2fbf71]">+١٨٪</div></div>
                  </div>
                  <div className="flex gap-2 mt-3">
                    <div className="flex-1 bg-[#f4f4f7] rounded-lg p-2"><div className="text-[6.5px] text-[#b0b0bb]">الأكثر طلباً</div><div className="text-[7px] font-bold">فلات وايت</div></div>
                    <div className="flex-1 bg-[#f4f4f7] rounded-lg p-2"><div className="text-[6.5px] text-[#b0b0bb]">أعلى ربحية</div><div className="text-[7px] font-bold">سلطة كينوا</div></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Two steps */}
        <div className="pt-20 px-5 sm:px-10">
          <h2 className="m-0 text-center text-2xl sm:text-[28px] font-bold tracking-tight text-[#131a2b]">بساطة في خطوتين</h2>
          <p className="mt-3 text-center text-sm text-[#8b8b95]">صمّمنا المنصة للسرعة والتبسيط في قطاع الأغذية والمشروبات.</p>
          <div className="relative grid md:grid-cols-2 gap-5 mt-10">
            <div className="hidden md:block absolute top-24 right-[34%] left-[34%] h-px" style={{ backgroundImage: 'repeating-linear-gradient(to left,#d3d3dc 0 6px,transparent 6px 12px)' }} />

            <div className="relative bg-[#f4f4f7] rounded-[22px] p-7 overflow-hidden">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="w-[26px] h-[26px] rounded-full bg-[#131a2b] text-white text-xs font-bold flex items-center justify-center">١</span>
                    <span className="bg-white rounded-full px-3 py-1 text-[11px] font-semibold text-[#5b6478]">داخل الفرع</span>
                  </div>
                  <h3 className="mt-3.5 text-xl font-bold text-[#131a2b] tracking-tight">يمسح الكود من الطاولة</h3>
                </div>
                <div className="shrink-0 w-[62px] h-[62px] rounded-2xl bg-white p-2.5 box-border">
                  <QrCode className="w-full h-full text-[#131a2b]" strokeWidth={1.5} />
                </div>
              </div>
              <p className="mt-3.5 text-[13.5px] leading-[1.95] text-[#8b8b95] max-w-[330px]">يظهر له منيو تفاعلي فوراً: صور الأطباق، المكوّنات والحساسيات، ومساعد ذكي يجيب على أسئلته قبل ما ينادي الموظف.</p>
              <div className="flex flex-wrap gap-2 mt-5">
                <span className="bg-white rounded-full px-3.5 py-1.5 text-[11.5px] font-semibold text-[#5b6478]">بدون تطبيق</span>
                <span className="bg-white rounded-full px-3.5 py-1.5 text-[11.5px] font-semibold text-[#5b6478]">يفتح في ثانية</span>
                <span className="bg-white rounded-full px-3.5 py-1.5 text-[11.5px] font-semibold text-[#5b6478]">طاولة ٧</span>
              </div>
            </div>

            <div className="relative bg-[#131a2b] rounded-[22px] p-7 overflow-hidden">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="w-[26px] h-[26px] rounded-full bg-white text-[#131a2b] text-xs font-bold flex items-center justify-center">٢</span>
                    <span className="bg-white/10 rounded-full px-3 py-1 text-[11px] font-semibold text-[#c3cadb]">خارج الفرع</span>
                  </div>
                  <h3 className="mt-3.5 text-xl font-bold text-white tracking-tight">رابط واحد في كل مكان</h3>
                </div>
                <div className="shrink-0 w-[62px] h-[62px] rounded-2xl bg-white/10 flex items-center justify-center">
                  <LinkIcon className="h-6 w-6 text-white" />
                </div>
              </div>
              <p className="mt-3.5 text-[13.5px] leading-[1.95] text-[#9aa3b6] max-w-[330px]">ضعه في انستقرام أو خرائط جوجل — أي شخص يبحث عنك يجد واجهة مرتبة: المنيو، الفروع، أوقات العمل، والطلب.</p>
              <div className="flex items-center gap-2 bg-[#212b3f] rounded-full px-3.5 py-2 mt-5 max-w-[300px]">
                <span className="w-[7px] h-[7px] rounded-full bg-[#2fbf71] shrink-0" />
                <span dir="ltr" className="text-xs text-[#e4e8f1] font-medium whitespace-nowrap overflow-hidden text-ellipsis">mershhah.com/rasef-cafe</span>
              </div>
            </div>
          </div>
        </div>

        {/* Final CTA */}
        <div className="pt-16 px-4 sm:px-6">
          <div className="relative bg-[#131a2b] rounded-[24px] px-6 sm:px-8 py-12 text-center overflow-hidden">
            <div className="absolute left-1/2 -top-[200px] w-[640px] h-[640px] -ml-[320px] rounded-full border border-white/[0.07]" />
            <h2 className="relative m-0 text-2xl sm:text-[27px] font-bold tracking-tight text-white">ابدأ رحلة التحول الرقمي اليوم</h2>
            <p className="relative mt-3 text-sm text-[#9aa3b6]">انضم لمطاعم ومقاهي في السعودية تستخدم مرشّح لتجربة عملاء أذكى.</p>
            <div className="relative flex justify-center gap-3 mt-7 flex-wrap">
              <Button asChild className="bg-white hover:bg-[#e9e9ec] text-[#131a2b] rounded-full px-8 h-[52px] text-[13.5px] font-bold">
                <Link href="/register">ابدأ الآن</Link>
              </Button>
              <Button asChild variant="outline" className="bg-transparent hover:bg-transparent hover:border-white text-white border border-white/25 rounded-full px-8 h-[52px] text-[13.5px] font-semibold">
                <Link href="/pricing">عرض الباقات</Link>
              </Button>
            </div>
          </div>
        </div>

        <LandingFooter />

      </div>
    </div>
  );
}
