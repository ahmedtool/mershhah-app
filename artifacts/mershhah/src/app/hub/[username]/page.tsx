"use client";

import { useEffect, useState, useRef } from 'react';
import { useParams } from 'wouter';
import { useRouter, useSearchParams } from '@/lib/navigation';
import { Button } from '@/components/ui/button';
import {
    Utensils,
    MapPin,
    Bot,
    Star,
    Share2,
    Info,
    Ticket,
    Loader2,
    Crosshair
} from 'lucide-react';
import { Link } from 'wouter';
import { supabase } from '@/lib/supabase';
import { getPublicPage } from '@/lib/public-pages';
import { StorageImage } from '@/components/shared/StorageImage';
import { InstagramIcon, TikTokIcon, SnapchatIcon, XIcon, WhatsAppIcon, WebsiteIcon, FacebookIcon, YoutubeIcon } from '@/components/shared/SocialIcons';
import { Skeleton } from '@/components/ui/skeleton';
import { trackAppClick, trackSocialClick, trackPageView } from '@/lib/event-tracker';
import { getPublicThemeStyle } from '@/lib/public-theme';
import { useToast } from '@/hooks/use-toast';

const SOCIAL_ICONS: { [key: string]: React.ElementType } = {
    whatsapp: WhatsAppIcon,
    instagram: InstagramIcon,
    twitter: XIcon,
    tiktok: TikTokIcon,
    snapchat: SnapchatIcon,
    facebook: FacebookIcon,
    youtube: YoutubeIcon,
    website: WebsiteIcon,
};

const SOCIAL_COLORS: { [key: string]: string } = {
    whatsapp: '#25D366',
    instagram: '#E4405F',
    tiktok: '#000000',
    twitter: '#000000',
    snapchat: '#FFFC00',
    facebook: '#1877F2',
    youtube: '#FF0000',
    website: '#714dfa',
};

function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export default function RestaurantHubPage() {
  const params = useParams();
  const username = params.username as string;
  const router = useRouter();
  const { toast } = useToast();

  const [restaurant, setRestaurant] = useState<any>(null);
  const [offers, setOffers] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [selectedBranch, setSelectedBranch] = useState<any>(null);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [locationDenied, setLocationDenied] = useState(false);
  const [loading, setLoading] = useState(true);
  const recordedViewOfferIds = useRef<Set<string>>(new Set());
  const searchParams = useSearchParams();
  const hubVisitRecorded = useRef(false);

  useEffect(() => {
    if (!restaurant?.id || hubVisitRecorded.current) return;
    hubVisitRecorded.current = true;
    const source = searchParams.get('source') === 'qr_branch' ? 'qr_branch' : 'link';
    supabase.from('hub_visits').insert({
      restaurant_id: restaurant.id,
      source,
      created_at: new Date().toISOString(),
    }).then(() => {});
    trackPageView(restaurant.id);
  }, [restaurant?.id, searchParams]);

  useEffect(() => {
    if (!restaurant?.id || !offers.length) return;
    const restId = restaurant.id;
    offers.forEach(async (offer) => {
      if (recordedViewOfferIds.current.has(offer.id)) return;
      recordedViewOfferIds.current.add(offer.id);
      const { data: current } = await supabase
        .from('offers')
        .select('views_count')
        .eq('id', offer.id)
        .single();
      const newCount = (current?.views_count || 0) + 1;
      supabase.from('offers').update({ views_count: newCount }).eq('id', offer.id).then(() => {});
    });
  }, [restaurant?.id, offers]);

  useEffect(() => {
    if (!username) return;
    setLoading(true);

    const fetchData = async () => {
      try {
        const data = await getPublicPage(username);
        if (data) {
          setRestaurant(data.restaurant);
          setOffers(data.offers ?? []);
          setBranches((data.branches ?? []).filter((b: any) => b.status === 'active'));
          setLoading(false);
          return;
        }

        const { data: rest } = await supabase
          .from('restaurants')
          .select('*')
          .eq('username', username)
          .limit(1)
          .single();

        if (!rest) {
          setRestaurant(null);
          setLoading(false);
          return;
        }

        setRestaurant(rest);

        const { data: branchData } = await supabase
          .from('branches')
          .select('*')
          .eq('restaurant_id', rest.id)
          .eq('status', 'active')
          .order('name');

        setBranches(branchData || []);

        const now = new Date().toISOString();
        const { data: offersData } = await supabase
          .from('offers')
          .select('*')
          .eq('restaurant_id', rest.id)
          .eq('status', 'active')
          .gt('valid_until', now);

        setOffers(offersData || []);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };

    fetchData();

    const channel = supabase
      .channel(`hub-${username}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'restaurants' }, fetchData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'offers' }, fetchData)
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [username]);

  const detectLocation = () => {
    if (!navigator.geolocation || branches.length === 0) return;
    setLocating(true);
    setLocationDenied(false);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setUserLocation(loc);
        setLocating(false);

        const branchesWithApps = branches.filter((b: any) => b.applications?.length > 0);
        if (branchesWithApps.length === 0) return;

        const sorted = [...branchesWithApps].sort((a: any, b: any) => {
          const distA = a.latitude && a.longitude ? haversineDistance(loc.lat, loc.lng, a.latitude, a.longitude) : Infinity;
          const distB = b.latitude && b.longitude ? haversineDistance(loc.lat, loc.lng, b.latitude, b.longitude) : Infinity;
          return distA - distB;
        });

        setSelectedBranch(sorted[0]);
      },
      () => {
        setLocating(false);
        setLocationDenied(true);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleOfferClick = async (offer: { id: string; external_link?: string | null }) => {
    if (!restaurant?.id) return;
    const { data: current } = await supabase
      .from('offers')
      .select('clicks_count, link_clicks_count')
      .eq('id', offer.id)
      .single();
    const updates: any = { clicks_count: (current?.clicks_count || 0) + 1 };
    if (offer.external_link) updates.link_clicks_count = (current?.link_clicks_count || 0) + 1;
    supabase.from('offers').update(updates).eq('id', offer.id).then(() => {});
    const url = offer.external_link || '#';
    if (url.startsWith('http')) window.location.href = url;
    else if (url !== '#') router.push(url);
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: restaurant?.name,
          text: restaurant?.description,
          url: window.location.href,
        });
      } catch (error: any) {
        if (error?.name !== 'AbortError') console.error('Error sharing:', error);
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast({ title: 'تم نسخ الرابط' });
    } catch {
      toast({ variant: 'destructive', title: 'تعذّر نسخ الرابط' });
    }
  };

  if (loading) return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white flex items-center justify-center p-4" dir="rtl">
      <div className="w-full max-w-lg space-y-6">
        <div className="flex flex-col items-center space-y-4">
          <Skeleton className="h-28 w-28 rounded-3xl" />
          <Skeleton className="h-8 w-48 rounded-xl" />
          <Skeleton className="h-4 w-64 rounded-lg" />
        </div>
        <Skeleton className="h-40 rounded-2xl" />
        <div className="grid grid-cols-2 gap-3">
          <Skeleton className="h-20 rounded-2xl" />
          <Skeleton className="h-20 rounded-2xl" />
          <Skeleton className="h-20 rounded-2xl" />
          <Skeleton className="h-20 rounded-2xl" />
        </div>
      </div>
    </div>
  );

  if (!restaurant) return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-b from-gray-50 to-white text-center p-4" dir="rtl">
      <div className="space-y-6 max-w-sm bg-white p-10 rounded-3xl shadow-xl w-full">
        <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto text-red-500">
          <Info className="h-10 w-10" />
        </div>
        <h1 className="text-xl font-black text-right text-gray-900">المطعم غير موجود!</h1>
        <Button asChild className="w-full h-12 rounded-2xl font-bold">
          <Link href="/">العودة للرئيسية</Link>
        </Button>
      </div>
    </div>
  );

  const primaryColor = restaurant.primaryColor || '#714dfa';
  const socialLinks = restaurant.social_links || restaurant.socialLinks || [];
  const themeStyle = getPublicThemeStyle(restaurant);

  return (
    <div
      className="min-h-screen flex flex-col items-center relative overflow-x-hidden"
      style={{ ...themeStyle, background: 'linear-gradient(to bottom, color-mix(in srgb, var(--r-secondary) 45%, white), white 55%)' }}
      dir="rtl"
    >
      {/* على الشاشات الواسعة، العمود المركزي يترك فراغ فاضي على الجنبين —
          نملأه بتوهج خفيف بلون هوية المطعم بدل ما يبقى فاضي بالكامل */}
      <div
        aria-hidden
        className="hidden lg:block fixed -top-24 -right-24 w-[420px] h-[420px] rounded-full blur-[110px] pointer-events-none"
        style={{ backgroundColor: 'color-mix(in srgb, var(--r-primary) 22%, transparent)' }}
      />
      <div
        aria-hidden
        className="hidden lg:block fixed -bottom-32 -left-24 w-[380px] h-[380px] rounded-full blur-[110px] pointer-events-none"
        style={{ backgroundColor: 'color-mix(in srgb, var(--r-primary) 14%, transparent)' }}
      />

      {/* Container principal - محدود العرض على الشاشات الكبيرة */}
      <div className="w-full max-w-lg mx-auto relative">

        {/* Header - الشعار والاسم */}
        <div className="relative px-5 py-8 text-center">
          {/* زر المشاركة */}
          <div className="absolute top-4 left-4">
            <Button
              onClick={handleShare}
              size="icon"
              variant="ghost"
              className="rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 h-10 w-10"
            >
              <Share2 className="h-4 w-4" />
            </Button>
          </div>

          {/* الشعار */}
          <div className="relative w-24 h-24 bg-white p-1.5 shadow-lg overflow-hidden mx-auto mb-4 border border-gray-100" style={{ borderRadius: 'var(--r-radius)' }}>
            <div className="w-full h-full relative overflow-hidden" style={{ borderRadius: 'calc(var(--r-radius) - 6px)' }}>
              <StorageImage 
                imagePath={restaurant.logo} 
                alt={restaurant.name} 
                fill 
                className="object-contain" 
                sizes="96px" 
              />
            </div>
          </div>

          {/* الاسم والوصف */}
          <div className="space-y-1.5">
            <h1 className="text-2xl font-black tracking-tight text-gray-900">
              {restaurant.name}
            </h1>
            <p className="text-sm text-gray-500 font-medium max-w-xs mx-auto line-clamp-2">
              {restaurant.description || "أهلاً بك في عالمنا الخاص."}
            </p>
          </div>
        </div>

        {/* المحتوى */}
        <div className="px-4 py-6 space-y-6">
          
          {/* فرع واحد فقط - التطبيقات تظهر مباشرة */}
          {branches.length === 1 && branches[0].applications?.length > 0 && (
            <section className="space-y-3">
              <div className="flex items-center gap-2 px-1">
                <MapPin className="h-3.5 w-3.5 text-gray-400" />
                <h3 className="font-black text-sm text-gray-500">{branches[0].name}</h3>
              </div>
              <div className="grid grid-cols-4 gap-3">
                {branches[0].applications.map((app: any, idx: number) => (
                  <a key={app.id || idx} href={app.value || '#'} target="_blank" rel="noopener noreferrer"
                    onClick={() => restaurant.id && trackAppClick(restaurant.id, app.name || 'unknown')}
                    className="aspect-square bg-white border border-gray-100 rounded-2xl p-3 flex items-center justify-center hover:shadow-md transition-all">
                    <div className="relative w-full h-full">
                      <StorageImage imagePath={app.logo} alt={app.name} fill className="object-contain" sizes="64px" />
                    </div>
                  </a>
                ))}
              </div>
            </section>
          )}

          {/* أكثر من فرع - كشف الموقع */}
          {branches.length > 1 && (
            <section className="space-y-3">
              {!selectedBranch ? (
                <div className="text-center space-y-3 py-4">
                  <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto">
                    <MapPin className="h-6 w-6 text-gray-400" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-gray-900">اختر فرعك القريب</p>
                    <p className="text-[11px] text-gray-400 mt-1">حدد موقعك لنعرض أقرب فرع وتطبيقاته</p>
                  </div>
                  <button
                    onClick={detectLocation}
                    disabled={locating}
                    className="h-11 px-6 text-sm font-bold transition-all flex items-center justify-center gap-2 mx-auto disabled:opacity-50"
                    style={{ backgroundColor: primaryColor, color: 'var(--r-button-text)', borderRadius: 'var(--r-radius-sm)' }}
                  >
                    {locating ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        جاري تحديد الموقع...
                      </>
                    ) : (
                      <>
                        <Crosshair className="h-4 w-4" />
                        حدد موقعي
                      </>
                    )}
                  </button>
                  {locationDenied && (
                    <p className="text-[10px] text-red-400">يرجى تفعيل خدمات الموقع من إعدادات المتصفح</p>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between px-1">
                    <div className="flex items-center gap-2">
                      <MapPin className="h-3.5 w-3.5 text-gray-400" />
                      <h3 className="font-black text-sm text-gray-500">أقرب فرع</h3>
                    </div>
                    <button onClick={() => { setSelectedBranch(null); setUserLocation(null); }}
                      className="text-[10px] text-gray-400 hover:text-gray-600">
                      تغيير
                    </button>
                  </div>

                  {/* البطاقة الرئيسية */}
                  <div className="bg-white border border-gray-100 p-4 space-y-3" style={{ borderRadius: 'var(--r-radius)' }}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-[9px] font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: primaryColor, color: 'var(--r-button-text)' }}>
                          الأقرب لك
                        </span>
                        <h4 className="text-sm font-bold text-gray-900">{selectedBranch.name}</h4>
                      </div>
                      {selectedBranch.opening_hours && (
                        <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-600">
                          مفتوح
                        </span>
                      )}
                    </div>
                    {selectedBranch.address && (
                      <p className="text-[11px] text-gray-400">{selectedBranch.address}</p>
                    )}
                    {selectedBranch.applications?.length > 0 && (
                      <div className="grid grid-cols-4 gap-2 pt-1">
                        {selectedBranch.applications.map((app: any, idx: number) => (
                          <a key={app.id || idx} href={app.value || '#'} target="_blank" rel="noopener noreferrer"
                            onClick={() => restaurant.id && trackAppClick(restaurant.id, app.name || 'unknown')}
                            className="aspect-square bg-gray-50 border border-gray-100 rounded-xl p-2 flex items-center justify-center hover:shadow-sm transition-all">
                            <div className="relative w-full h-full">
                              <StorageImage imagePath={app.logo} alt={app.name} fill className="object-contain" sizes="48px" />
                            </div>
                          </a>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* فروع أخرى قريبة */}
                  {(() => {
                    if (!userLocation) return null;
                    const otherBranches = branches
                      .filter((b: any) => b.id !== selectedBranch.id && b.applications?.length > 0)
                      .map((b: any) => ({
                        ...b,
                        distance: b.latitude && b.longitude
                          ? haversineDistance(userLocation.lat, userLocation.lng, b.latitude, b.longitude)
                          : Infinity
                      }))
                      .filter((b: any) => b.distance < 50)
                      .sort((a: any, b: any) => a.distance - b.distance)
                      .slice(0, 4);

                    if (otherBranches.length === 0) return null;

                    return (
                      <div className="space-y-2">
                        <p className="text-[10px] text-gray-400 font-medium px-1">فروع أخرى قريبة</p>
                        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1 snap-x snap-mandatory">
                          {otherBranches.map((branch: any) => (
                            <button key={branch.id} onClick={() => setSelectedBranch(branch)}
                              className="shrink-0 snap-center bg-white border border-gray-100 rounded-xl p-3 text-right min-w-[140px] hover:border-gray-200 transition-all">
                              <p className="text-xs font-bold text-gray-900 truncate">{branch.name}</p>
                              <p className="text-[10px] text-gray-400 mt-0.5">
                                {branch.distance < 1 ? `${Math.round(branch.distance * 1000)} م` : `${branch.distance.toFixed(1)} كم`}
                              </p>
                              <div className="flex gap-1 mt-2">
                                {branch.applications.slice(0, 3).map((app: any, idx: number) => (
                                  <div key={idx} className="w-5 h-5 rounded bg-gray-50 flex items-center justify-center">
                                    <StorageImage imagePath={app.logo} alt={app.name} width={16} height={16} className="object-contain" />
                                  </div>
                                ))}
                                {branch.applications.length > 3 && (
                                  <span className="text-[8px] text-gray-400 self-center">+{branch.applications.length - 3}</span>
                                )}
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}
            </section>
          )}

          {/* العروض */}
          {offers.length > 0 && (
            <section className="space-y-3">
              <div className="flex overflow-x-auto no-scrollbar pb-1 snap-x snap-mandatory gap-3">
                {offers.map((offer) => (
                  <button
                    key={offer.id}
                    type="button"
                    onClick={() => handleOfferClick(offer)}
                    className="shrink-0 flex-[0_0_100%] snap-center text-right"
                  >
                    <div className="relative shadow-md overflow-hidden group" style={{ aspectRatio: '16/10', borderRadius: 'var(--r-radius)' }}>
                      <StorageImage
                        imagePath={offer.image_url}
                        alt={offer.title}
                        fill
                        className="object-cover group-hover:scale-105 transition-transform duration-300"
                        sizes="400px"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                      <div className="absolute bottom-0 left-0 right-0 p-4">
                        <h4 className="text-base font-black text-white text-center drop-shadow-lg">
                          {offer.title}
                        </h4>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </section>
          )}

          {/* الأزرار الرئيسية */}
          <section className="space-y-3">
            {restaurant.is_paid_plan && (
              <Link href={`/ai/${username}`} className="block">
                <div
                  className="flex items-center gap-4 p-4 shadow-md transition-all h-16"
                  style={{ backgroundColor: primaryColor, color: 'var(--r-button-text)', borderRadius: 'var(--r-radius)' }}
                >
                  <div className="w-11 h-11 flex items-center justify-center bg-white/20 backdrop-blur-md border border-white/30" style={{ borderRadius: 'var(--r-radius-sm)' }}>
                    <Bot className="h-6 w-6" />
                  </div>
                  <div className="flex-1 text-right">
                    <span className="font-black text-base block">المساعد الذكي</span>
                  </div>
                </div>
              </Link>
            )}

            <div className="grid grid-cols-2 gap-3">
              <Link href={`/menu/${username}`} className="block">
                <div className="flex items-center gap-3 p-4 bg-white border border-gray-100 shadow-sm hover:shadow-md transition-all h-16" style={{ borderRadius: 'var(--r-radius)' }}>
                  <div
                    className="w-11 h-11 flex items-center justify-center shrink-0"
                    style={{ backgroundColor: primaryColor, color: 'var(--r-button-text)', borderRadius: 'var(--r-radius-sm)' }}
                  >
                    <Utensils className="h-5 w-5" />
                  </div>
                  <div className="flex-1 text-right min-w-0">
                    <span className="font-black text-sm text-gray-900 block truncate">المنيو</span>
                  </div>
                </div>
              </Link>

              <Link href={`/reviews/${username}`} className="block">
                <div className="flex items-center gap-3 p-4 bg-white border border-gray-100 shadow-sm hover:shadow-md transition-all h-16" style={{ borderRadius: 'var(--r-radius)' }}>
                  <div
                    className="w-11 h-11 flex items-center justify-center shrink-0"
                    style={{ backgroundColor: 'color-mix(in srgb, var(--r-primary) 14%, white)', color: 'var(--r-primary)', borderRadius: 'var(--r-radius-sm)' }}
                  >
                    <Star className="h-5 w-5 fill-current" />
                  </div>
                  <div className="flex-1 text-right min-w-0">
                    <span className="font-black text-sm text-gray-900 block truncate">التقييمات</span>
                  </div>
                </div>
              </Link>

              <Link href={`/branches/${username}`} className="block">
                <div className="flex items-center gap-3 p-4 bg-white border border-gray-100 shadow-sm hover:shadow-md transition-all h-16" style={{ borderRadius: 'var(--r-radius)' }}>
                  <div
                    className="w-11 h-11 flex items-center justify-center shrink-0"
                    style={{ backgroundColor: 'color-mix(in srgb, var(--r-primary) 14%, white)', color: 'var(--r-primary)', borderRadius: 'var(--r-radius-sm)' }}
                  >
                    <MapPin className="h-5 w-5" />
                  </div>
                  <div className="flex-1 text-right min-w-0">
                    <span className="font-black text-sm text-gray-900 block truncate">الفروع</span>
                  </div>
                </div>
              </Link>

              <Link href={`/support/${username}`} className="block">
                <div className="flex items-center gap-3 p-4 bg-white border border-gray-100 shadow-sm hover:shadow-md transition-all h-16" style={{ borderRadius: 'var(--r-radius)' }}>
                  <div
                    className="w-11 h-11 flex items-center justify-center shrink-0"
                    style={{ backgroundColor: 'color-mix(in srgb, var(--r-primary) 14%, white)', color: 'var(--r-primary)', borderRadius: 'var(--r-radius-sm)' }}
                  >
                    <Ticket className="h-5 w-5" />
                  </div>
                  <div className="flex-1 text-right min-w-0">
                    <span className="font-black text-sm text-gray-900 block truncate">تذكرة دعم</span>
                  </div>
                </div>
              </Link>
            </div>
          </section>

          {/* التطبيقات - للمطعم بدون فروع */}
          {branches.length === 0 && (() => {
            const activeApps = restaurant.applications || [];
            if (activeApps.length === 0) return null;
            return (
              <section className="space-y-3">
                <h3 className="font-black text-sm text-gray-500 px-1 text-right">التطبيقات</h3>
                <div className="grid grid-cols-4 gap-3">
                  {activeApps.map((app: any, idx: number) => (
                    <a key={app.id || idx} href={app.value || '#'} target="_blank" rel="noopener noreferrer"
                      onClick={() => restaurant.id && trackAppClick(restaurant.id, app.name || 'unknown')}
                      className="aspect-square bg-white border border-gray-100 p-3 flex items-center justify-center hover:shadow-md transition-all"
                      style={{ borderRadius: 'var(--r-radius-sm)' }}>
                      <div className="relative w-full h-full">
                        <StorageImage imagePath={app.logo} alt={app.name} fill className="object-contain" sizes="64px" />
                      </div>
                    </a>
                  ))}
                </div>
              </section>
            );
          })()}

          {/* التواصل الاجتماعي */}
          {Array.isArray(socialLinks) && socialLinks.filter((link: any) => link?.value?.trim()).length > 0 && (
            <section className="space-y-3">
              <h3 className="font-black text-sm text-gray-500 px-1 text-right">تواصل معنا</h3>
              <div className="flex flex-wrap justify-center gap-3 pb-8">
                {socialLinks
                  .filter((link: any) => link?.platform && link?.value?.trim())
                  .map((link: any, idx: number) => {
                    const Icon = SOCIAL_ICONS[link.platform] || WebsiteIcon;
                    return (
                      <Link 
                        key={link.id || idx} 
                        href={link.value.trim()} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        onClick={() => restaurant.id && trackSocialClick(restaurant.id, link.platform || 'unknown')}
                        className="w-12 h-12 flex items-center justify-center rounded-2xl bg-white border border-gray-100 shadow-sm hover:shadow-md transition-all"
                      >
                        <Icon size={22} style={{ color: SOCIAL_COLORS[link.platform] || primaryColor }} />
                      </Link>
                    );
                  })}
              </div>
            </section>
          )}

          {/* الفوتر */}
          {!restaurant.is_paid_plan && (
            <div className="pt-6 border-t border-gray-200 text-center pb-6">
              <Link
                href="/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[10px] font-black text-gray-400 hover:text-gray-600 transition-colors"
              >
                مدعوم بواسطة مرشح
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
