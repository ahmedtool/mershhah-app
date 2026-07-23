"use client";

import { useEffect, useState, useRef } from 'react';
import { useParams } from 'wouter';
import { useRouter } from '@/lib/navigation';
import { SendHorizonal, User, ChevronRight, Utensils, Info, MessageCircle, MapPin, Bot } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/lib/supabase';
import { getPublicPage } from '@/lib/public-pages';
import type { AiMessage, MenuItem, Offer } from '@/lib/types';
import { restaurantChat } from '@/ai/flows/restaurant-chat-flow';
import { Link } from 'wouter';
import { StorageImage } from '@/components/shared/StorageImage';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';

export default function AiAssistantPage() {
  const params = useParams();
  const router = useRouter();
  const username = params.username as string;

  const [restaurant, setRestaurant] = useState<any>(null);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [branches, setBranches] = useState<Array<{ id?: string; name?: string; address?: string; city?: string; district?: string; opening_hours?: string; phone?: string; google_maps_url?: string }>>([]);
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null);
  const [streamingLength, setStreamingLength] = useState(0);

  useEffect(() => {
    let sid = localStorage.getItem(`mershah-session-${username}`);
    if (!sid) {
      sid = crypto.randomUUID();
      localStorage.setItem(`mershah-session-${username}`, sid);
    }
    setSessionId(sid);
  }, [username]);

  useEffect(() => {
    if (!username || !sessionId) return;

    const fetchRestaurantData = async () => {
      setLoading(true);
      try {
        const data = await getPublicPage(username);
        if (data?.restaurant) {
          setRestaurant(data.restaurant);
          setMenuItems(Array.isArray(data.menu) ? (data.menu as MenuItem[]) : []);
          setOffers(Array.isArray(data.offers) ? (data.offers as Offer[]) : []);
          setBranches(Array.isArray(data.branches) ? data.branches : []);
          setMessages([
            { id: '1', sender: 'bot', text: "أنا رفيقك الذكي. كيف أقدر أساعدك اليوم؟", timestamp: new Date() }
          ]);
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

        const [menuRes, offersRes, branchesRes] = await Promise.all([
          supabase.from('menu_items').select('*').eq('restaurant_id', rest.id),
          supabase.from('offers').select('*').eq('restaurant_id', rest.id),
          supabase.from('branches').select('*').eq('restaurant_id', rest.id).eq('status', 'active'),
        ]);

        setMenuItems((menuRes.data || []) as MenuItem[]);
        setOffers((offersRes.data || []) as Offer[]);
        setBranches(branchesRes.data || []);

        setMessages([
          { id: '1', sender: 'bot', text: "أنا رفيقك الذكي. كيف أقدر أساعدك اليوم؟", timestamp: new Date() }
        ]);
      } catch (error) {
        console.error("Error fetching restaurant data", error);
        setRestaurant(null);
      } finally {
        setLoading(false);
      }
    };

    fetchRestaurantData();
  }, [username, sessionId]);

  useEffect(() => {
    const scrollToBottom = () => {
      requestAnimationFrame(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
      });
    };
    scrollToBottom();
  }, [messages, isTyping, streamingLength]);

  useEffect(() => {
    if (!streamingMessageId || !restaurant || !sessionId) return;
    const msg = messages.find((m) => m.id === streamingMessageId);
    if (!msg || msg.sender !== 'bot') return;
    const fullText = msg.text || '';
    if (fullText.length === 0) {
      setStreamingMessageId(null);
      return;
    }

    const chunk = 2;
    const interval = 25;
    const timer = setInterval(() => {
      setStreamingLength((prev) => {
        const next = Math.min(prev + chunk, fullText.length);
        if (next >= fullText.length) {
          clearInterval(timer);
          supabase.from('ai_session_messages').insert({
            session_id: sessionId,
            restaurant_id: restaurant.id,
            sender: 'bot',
            text: fullText,
            created_at: new Date().toISOString(),
          }).then(() => {});
          setStreamingMessageId(null);
          return fullText.length;
        }
        return next;
      });
    }, interval);
    return () => clearInterval(timer);
  }, [streamingMessageId, restaurant?.id, sessionId, messages]);

  const handleSend = async () => {
    if (!input.trim() || !sessionId || !restaurant) return;

    const userMsgContent = input;
    const userMsg: AiMessage = { id: Date.now().toString(), sender: 'user', text: userMsgContent, timestamp: new Date(), session_id: sessionId };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);

    try {
      await supabase.from('ai_session_messages').insert({
        session_id: sessionId,
        restaurant_id: restaurant.id,
        sender: 'user',
        text: userMsgContent,
        created_at: new Date().toISOString(),
      });

      const { data: freshRest } = await supabase
        .from('restaurants')
        .select('*')
        .eq('id', restaurant.id)
        .single();

      const currentRest = freshRest || restaurant;
      setRestaurant((prev: any) => (prev ? { ...prev, ...currentRest } : null));

      const apps = Array.isArray(currentRest.applications) ? currentRest.applications : [];
      const appUrl = (app: any) => (app?.value ?? app?.url ?? app?.link ?? '').toString().trim();
      const applicationsList = apps
        .filter((app: any) => app?.name && appUrl(app))
        .map((app: any) => ({ name: String(app.name), url: appUrl(app) }));

      const restaurantContextData = {
        name: currentRest.name ?? restaurant.name,
        menu: menuItems.map((i: any) => ({
          name: i.name,
          price: i.sizes?.[0]?.price,
          image_url: i.image_url || i.imageUrl || null,
          category: i.category || null,
          description: i.description || null,
          calories: i.calories || null,
        })),
        offers: offers.map((o: any) => ({
          title: o.title,
          description: o.description,
          image_url: o.image_url || o.imageUrl || null,
          discount: o.discount || null,
        })),
        applications: applicationsList,
        branches: branches.map(b => ({
          name: b.name,
          address: b.address,
          city: b.city,
          district: b.district,
          opening_hours: b.opening_hours,
          phone: b.phone,
          google_maps_url: b.google_maps_url,
        })),
        socialLinks: Array.isArray(currentRest.social_links)
          ? currentRest.social_links.filter((link: any) => link?.platform && link?.value).map((link: any) => ({ platform: link.platform, value: link.value }))
          : Array.isArray(currentRest.socialLinks)
          ? currentRest.socialLinks.filter((link: any) => link?.platform && link?.value).map((link: any) => ({ platform: link.platform, value: link.value }))
          : [],
      };

      const aiResponse = await restaurantChat({
        customerMessage: userMsgContent,
        restaurantData: JSON.stringify(restaurantContextData)
      });

      const botId = (Date.now() + 1).toString();
      const botMsg = {
        id: botId,
        sender: 'bot' as const,
        text: aiResponse.smartReply,
        timestamp: new Date(),
        session_id: sessionId,
        showApplications: aiResponse.showApplications === true,
        showBranches: aiResponse.showBranches === true,
        menuCards: aiResponse.menuCards || [],
        branchCards: aiResponse.branchCards || [],
        offerCards: aiResponse.offerCards || [],
        totalBudget: aiResponse.totalBudget,
      };
      setMessages(prev => [...prev, botMsg]);
      setIsTyping(false);
      setStreamingMessageId(botId);
      setStreamingLength(0);
    } catch (error) {
      setMessages(prev => [...prev, { id: 'err', sender: 'bot', text: 'حدث خطأ فني...', timestamp: new Date() }]);
      setIsTyping(false);
    }
  };

  const toWhatsAppUrl = (phone: string | undefined): string => {
    if (!phone || !phone.trim()) return '#';
    const digits = phone.replace(/\D/g, '');
    if (!digits.length) return '#';
    const withCountry = digits.startsWith('966') ? digits : digits.startsWith('0') ? '966' + digits.slice(1) : digits.length === 9 && digits.startsWith('5') ? '966' + digits : '966' + digits;
    return `https://wa.me/${withCountry}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white" dir="rtl">
        <div className="max-w-lg mx-auto px-5 py-8 space-y-6">
          <div className="flex flex-col items-center space-y-3">
            <Skeleton className="h-20 w-20 rounded-2xl" />
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-4 w-32" />
          </div>
          <Skeleton className="h-16 w-full rounded-2xl" />
          <Skeleton className="h-16 w-3/4 ml-auto rounded-2xl" />
          <Skeleton className="h-16 w-full rounded-2xl" />
        </div>
      </div>
    );
  }

  if (!restaurant) {
    return (
      <div className="min-h-screen w-full flex flex-col items-center justify-center bg-white text-center p-6" dir="rtl">
        <div className="w-14 h-14 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
          <Info className="h-6 w-6 text-gray-300" />
        </div>
        <h1 className="text-lg font-black text-gray-900">المطعم غير موجود</h1>
        <Link href="/" className="mt-4 h-10 px-6 rounded-xl bg-gray-900 text-white text-xs font-bold hover:bg-gray-800 inline-flex items-center">
          العودة للرئيسية
        </Link>
      </div>
    );
  }

  if (!restaurant.is_paid_plan) {
    return (
      <div className="min-h-screen w-full flex flex-col items-center justify-center bg-white text-center p-6" dir="rtl">
        <div className="max-w-sm w-full bg-white border border-gray-100 rounded-2xl p-8 space-y-3">
          <div className="w-14 h-14 bg-gray-50 border border-gray-100 rounded-2xl flex items-center justify-center mx-auto">
            <Bot className="h-6 w-6 text-gray-300" />
          </div>
          <h1 className="text-base font-black text-gray-900">المساعد الذكي متاح في الباقات المدفوعة</h1>
          <p className="text-[11px] text-gray-400">قم بترقية باقتك من لوحة التحكم</p>
          <Link href={`/hub/${username}`} className="w-full h-10 rounded-xl bg-gray-900 text-white text-xs font-bold hover:bg-gray-800 flex items-center justify-center">
            العودة للرابط الرئيسي
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-white pb-4 overflow-x-hidden" dir="rtl">
      {/* Header */}
      <div className="border-b border-gray-100 px-4 py-5 flex flex-col items-center text-center relative">
        <Link href={`/hub/${username}`}
          className="absolute top-4 right-4 w-9 h-9 rounded-xl bg-gray-50 border border-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
          <ChevronRight className="h-4 w-4" />
        </Link>

        <div className="relative w-16 h-16 rounded-2xl overflow-hidden border border-gray-100">
          <StorageImage
            imagePath={restaurant.logo}
            alt={restaurant.name}
            fill
            sizes="64px"
            className="object-cover"
          />
        </div>
        <div className="space-y-0.5 mt-3">
          <h1 className="text-base font-black text-gray-900">{restaurant.name}</h1>
          <p className="text-[11px] text-gray-400">المساعد الذكي</p>
        </div>
        <Link
          href={`/menu/${username}`}
          className="inline-flex items-center gap-1.5 mt-2 text-[11px] font-bold text-gray-500 rounded-lg px-3 py-1.5 border border-gray-100 hover:bg-gray-50 transition-colors"
        >
          <Utensils className="h-3 w-3" />
          قائمة الطعام
        </Link>
      </div>

      {/* Chat */}
      <div className="max-w-lg mx-auto w-full px-4 py-4 flex-1 flex flex-col min-h-0">
        <div className="border border-gray-100 rounded-2xl overflow-hidden flex flex-col h-[calc(100vh-220px)]">
          <div className="flex-1 overflow-y-auto p-4 space-y-4" ref={scrollRef}>
            <AnimatePresence initial={false}>
              {messages.map((msg) => (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={cn("flex", msg.sender === 'user' ? "justify-end" : "justify-start")}
                >
                  <div className={cn("flex gap-2 max-w-[80%]", msg.sender === 'user' ? "flex-row-reverse" : "flex-row")}>
                    {/* Avatar */}
                    <div className="w-7 h-7 rounded-full shrink-0 mt-1 overflow-hidden border border-gray-100">
                      {msg.sender === 'bot' ? (
                        <div className="w-full h-full relative bg-gray-50">
                          <StorageImage imagePath={restaurant.logo} alt="" fill className="object-cover" sizes="28px" />
                        </div>
                      ) : (
                        <div className="w-full h-full bg-gray-100 flex items-center justify-center">
                          <User className="h-3 w-3 text-gray-400" />
                        </div>
                      )}
                    </div>
                    {/* Bubble */}
                    <div
                      className={cn(
                        "px-3.5 py-2.5 text-[13px] leading-relaxed",
                        msg.sender === 'user'
                          ? 'bg-gray-900 text-white rounded-2xl rounded-tr-md'
                          : 'bg-gray-50 text-gray-700 border border-gray-100 rounded-2xl rounded-tl-md'
                      )}
                    >
                      {msg.sender === 'bot' && msg.id === streamingMessageId
                        ? (msg.text || '').slice(0, streamingLength)
                        : msg.text}
                      {msg.sender === 'bot' && msg.id === streamingMessageId && streamingLength < (msg.text || '').length && (
                        <span className="inline-block w-0.5 h-3.5 bg-gray-400 align-middle animate-pulse mr-0.5" />
                      )}
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>

            {/* Apps */}
            {messages.length > 0 && messages[messages.length - 1]?.showApplications && Array.isArray(restaurant.applications) && (
              <div className="flex flex-wrap gap-2 justify-end">
                {restaurant.applications
                  .filter((a: any) => a?.name && (a?.value || a?.url))
                  .map((app: any, idx: number) => (
                    <a key={app.id || idx} href={(app.value || app.url || '').trim() || '#'} target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-gray-50 border border-gray-100 hover:bg-gray-100 transition-colors text-right">
                      <span className="relative w-6 h-6 rounded-md overflow-hidden shrink-0 bg-gray-100">
                        <StorageImage imagePath={app.logo} alt={app.name} fill className="object-contain p-0.5" sizes="24px" />
                      </span>
                      <span className="text-[11px] font-bold text-gray-700">{app.name}</span>
                    </a>
                  ))}
              </div>
            )}

            {/* Branches - Horizontal Carousel */}
            {messages.length > 0 && messages[messages.length - 1]?.showBranches && (
              <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide" style={{ scrollSnapType: 'x mandatory' }}>
                {(messages[messages.length - 1].branchCards || []).map((branch: any, idx: number) => (
                  <div key={idx} className="border border-gray-100 rounded-xl p-3 bg-white shrink-0 w-[180px] text-right space-y-2" style={{ scrollSnapAlign: 'start' }}>
                    <p className="text-[11px] font-bold text-gray-900 truncate">{branch.name}</p>
                    {branch.address && (
                      <p className="text-[9px] text-gray-400 truncate">{branch.address}{branch.city ? `، ${branch.city}` : ''}</p>
                    )}
                    <div className="flex gap-1.5">
                      {branch.phone && String(branch.phone).trim() && (
                        <a href={toWhatsAppUrl(branch.phone)} target="_blank" rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-50 border border-emerald-100 text-emerald-600 text-[9px] font-bold">
                          <MessageCircle className="h-2.5 w-2.5" /> واتساب
                        </a>
                      )}
                      {(branch.google_maps_url || branch.address) && (
                        <a href={branch.google_maps_url || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([branch.address, branch.city, branch.district].filter(Boolean).join('، '))}`}
                          target="_blank" rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-gray-50 border border-gray-100 text-gray-600 text-[9px] font-bold">
                          <MapPin className="h-2.5 w-2.5" /> الخريطة
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Menu Cards with Images - Horizontal Scroll */}
            {messages.length > 0 && messages[messages.length - 1]?.menuCards?.length > 0 && (
              <div className="space-y-2">
                <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide" style={{ scrollSnapType: 'x mandatory' }}>
                  {messages[messages.length - 1].menuCards.map((card: any, idx: number) => (
                    <div key={idx} className="border border-gray-100 rounded-xl overflow-hidden bg-white shrink-0 w-[140px]" style={{ scrollSnapAlign: 'start' }}>
                      <div className="relative aspect-square bg-gray-50">
                        {card.image_url ? (
                          <StorageImage imagePath={card.image_url} alt={card.name} fill className="object-cover" sizes="140px" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Utensils className="h-6 w-6 text-gray-200" />
                          </div>
                        )}
                      </div>
                      <div className="p-2 space-y-0.5">
                        <p className="text-[11px] font-bold text-gray-900 truncate">{card.name}</p>
                        {card.price && (
                          <p className="text-[10px] font-bold text-gray-900">{card.price} ر.س</p>
                        )}
                        {card.category && (
                          <p className="text-[9px] text-gray-400 truncate">{card.category}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                {/* Budget Summary */}
                {messages[messages.length - 1]?.totalBudget && (
                  <div className="border border-gray-100 rounded-xl p-3 bg-gray-50">
                    <div className="flex justify-between items-center text-[11px]">
                      <span className="text-gray-400">الميزانية</span>
                      <span className="font-bold text-gray-900">{messages[messages.length - 1].totalBudget} ر.س</span>
                    </div>
                    <div className="flex justify-between items-center text-[11px] mt-1">
                      <span className="text-gray-400">الإجمالي</span>
                      <span className="font-bold text-gray-900">
                        {messages[messages.length - 1].menuCards.reduce((sum: number, c: any) => sum + (c.price || 0), 0)} ر.س
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-[11px] mt-1 pt-1 border-t border-gray-100">
                      <span className="text-gray-400">المتبقي</span>
                      <span className="font-bold text-emerald-600">
                        {messages[messages.length - 1].totalBudget - messages[messages.length - 1].menuCards.reduce((sum: number, c: any) => sum + (c.price || 0), 0)} ر.س
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Offer Cards - Horizontal Carousel */}
            {messages.length > 0 && messages[messages.length - 1]?.offerCards?.length > 0 && (
              <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide" style={{ scrollSnapType: 'x mandatory' }}>
                {messages[messages.length - 1].offerCards.map((card: any, idx: number) => (
                  <div key={idx} className="border border-gray-100 rounded-xl overflow-hidden bg-white shrink-0 w-[160px]" style={{ scrollSnapAlign: 'start' }}>
                    <div className="relative aspect-[4/3] bg-gray-50">
                      {card.image_url ? (
                        <StorageImage imagePath={card.image_url} alt={card.title} fill className="object-cover" sizes="160px" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <span className="text-3xl">🎯</span>
                        </div>
                      )}
                      {card.discount && (
                        <div className="absolute top-1.5 right-1.5 bg-red-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-md">
                          {card.discount}
                        </div>
                      )}
                    </div>
                    <div className="p-2 space-y-0.5">
                      <p className="text-[11px] font-bold text-gray-900 truncate">{card.title}</p>
                      {card.description && (
                        <p className="text-[9px] text-gray-400 line-clamp-2">{card.description}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Typing */}
            {isTyping && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
                <div className="flex gap-1.5 items-center bg-gray-50 border border-gray-100 px-3.5 py-2.5 rounded-2xl rounded-tl-md">
                  <span className="w-1.5 h-1.5 bg-gray-300 rounded-full animate-bounce" />
                  <span className="w-1.5 h-1.5 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-1.5 h-1.5 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </motion.div>
            )}
            <div ref={bottomRef} className="h-1 shrink-0" />
          </div>

          {/* Input */}
          <div className="p-3 border-t border-gray-100 bg-white">
            <div className="flex gap-2 items-center">
              <input
                placeholder="اسأل عن أي شيء..."
                className="flex-1 h-10 px-3 rounded-xl border border-gray-200 text-xs outline-none focus:border-gray-300 transition-colors"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              />
              <button onClick={handleSend} disabled={!input.trim() || isTyping}
                className="w-10 h-10 rounded-xl bg-gray-900 text-white flex items-center justify-center hover:bg-gray-800 transition-colors shrink-0 disabled:opacity-30">
                <SendHorizonal className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
