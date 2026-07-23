'use client';

import { useState, useRef, useEffect, useTransition } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bot, SendHorizonal, User, Loader2 } from 'lucide-react';
import { dashboardAssistant } from '@/ai/flows/dashboard-assistant-flow';
import { usePathname, useRouter } from '@/lib/navigation';
import { useToast } from '@/hooks/use-toast';
import { useUser } from '@/hooks/useUser';
import { supabase } from '@/lib/supabase';
import type { MenuItem as MenuItemType } from '@/lib/types';
import { cn } from '@/lib/utils';

interface Message {
  id: number;
  sender: 'user' | 'bot';
  text: string;
  cards?: { name: string; price?: number; image_url?: string; category?: string; description?: string }[];
  stats?: { label: string; value: string | number }[];
  action?: {
    type: string;
    payload?: any;
  };
}

export function DashboardAssistant() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isThinking, startThinking] = useTransition();
  const [pendingAction, setPendingAction] = useState<Message['action']>(null);
  const [isExecutingAction, startExecutingAction] = useTransition();
  const scrollRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const router = useRouter();
  const { toast } = useToast();
  const { user } = useUser();
  const [menuItems, setMenuItems] = useState<MenuItemType[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [offers, setOffers] = useState<any[]>([]);
  const [reviews, setReviews] = useState<any[]>([]);
  const [isFetchingData, setIsFetchingData] = useState(false);

  // ── Fetch all data ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isOpen || !user?.restaurantId) {
      setMenuItems([]);
      setBranches([]);
      setOffers([]);
      setReviews([]);
      return;
    }

    setIsFetchingData(true);

    const fetchAll = async () => {
      const [menuRes, branchRes, offerRes, reviewRes] = await Promise.all([
        supabase.from('menu_items').select('*').eq('restaurant_id', user.restaurantId),
        supabase.from('branches').select('*').eq('restaurant_id', user.restaurantId),
        supabase.from('offers').select('*').eq('restaurant_id', user.restaurantId),
        supabase.from('reviews').select('*').eq('restaurant_id', user.restaurantId),
      ]);
      if (!menuRes.error) setMenuItems((menuRes.data || []) as MenuItemType[]);
      if (!branchRes.error) setBranches(branchRes.data || []);
      if (!offerRes.error) setOffers(offerRes.data || []);
      if (!reviewRes.error) setReviews(reviewRes.data || []);
      setIsFetchingData(false);
    };

    fetchAll();

    const channel = supabase.channel('assistant_all_data')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'menu_items', filter: `restaurant_id=eq.${user.restaurantId}` }, fetchAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'branches', filter: `restaurant_id=eq.${user.restaurantId}` }, fetchAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'offers', filter: `restaurant_id=eq.${user.restaurantId}` }, fetchAll)
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [isOpen, user?.restaurantId]);

  // ── Open/close reset ────────────────────────────────────────────────────────
  useEffect(() => {
    if (isOpen) {
      setMessages([{
        id: Date.now(),
        sender: 'bot',
        text: 'أهلاً بك! أنا رفيق دربك في منصة مرشح. كيف يمكنني مساعدتك اليوم؟',
      }]);
      setInput('');
      setPendingAction(null);
    }
  }, [isOpen]);

  // ── Auto scroll ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isThinking]);

  // ── Handle send ─────────────────────────────────────────────────────────────
  const handleSend = async () => {
    if (!input.trim()) return;

    const userMessage: Message = { id: Date.now(), sender: 'user', text: input };
    setMessages((prev) => [...prev, userMessage]);
    const currentInput = input;
    setInput('');
    setPendingAction(null);

    startThinking(async () => {
      try {
        const response = await dashboardAssistant({
          question: currentInput,
          currentPage: pathname,
          menuItems,
          branches,
          offers,
          reviews,
          user: user ? { uid: user.uid, restaurantId: user.restaurantId, full_name: user.full_name } : undefined,
        });

        const botMessage: Message = {
          id: Date.now() + 1,
          sender: 'bot',
          text: response.answer,
          cards: response.cards,
          stats: response.stats,
          action: response.action,
        };

        // Handle immediate actions
        if (response.action?.type === 'NAVIGATE' && response.action.payload?.path) {
          router.push(response.action.payload.path);
          setIsOpen(false);
          return;
        }

        if (response.action?.type === 'ADD_MENU_ITEM' && response.action.payload) {
          setPendingAction(response.action);
        } else if (response.action?.type === 'ADD_BRANCH' && response.action.payload) {
          setPendingAction(response.action);
        } else if (response.action?.type === 'ADD_OFFER' && response.action.payload) {
          setPendingAction(response.action);
        } else if (response.action?.type === 'UPDATE_MENU_ITEM_COST' && response.action.payload) {
          setPendingAction(response.action);
        }

        setMessages((prev) => [...prev, botMessage]);
      } catch (error) {
        toast({ title: 'خطأ', description: 'حدث خطأ أثناء التواصل مع المساعد.', variant: 'destructive' });
        setMessages((prev) => [...prev, { id: Date.now() + 1, sender: 'bot', text: "عفواً، واجهتني مشكلة. الرجاء المحاولة مرة أخرى." }]);
      }
    });
  };

  // ── Handle confirm action ───────────────────────────────────────────────────
  const handleConfirmAction = async () => {
    if (!pendingAction || !user?.restaurantId) return;

    startExecutingAction(async () => {
      try {
        if (pendingAction.type === 'ADD_MENU_ITEM' && pendingAction.payload) {
          const { name, price, sizes, hasSizes } = pendingAction.payload;
          
          // Build the insert object
          const insertData: any = {
            name,
            restaurant_id: user.restaurantId,
            status: 'available',
            created_at: new Date().toISOString(),
          };
          
          if (hasSizes && sizes && sizes.length > 0) {
            // Insert with sizes
            insertData.sizes = sizes;
            insertData.price = Math.min(...sizes.map((s: any) => s.price)); // base price = cheapest
          } else {
            insertData.price = price || 0;
          }
          
          const { error } = await supabase.from('menu_items').insert(insertData);
          if (error) throw error;
          
          // Build confirmation message
          let confirmMsg = `✅ تمت إضافة "${name}" بنجاح!`;
          if (hasSizes && sizes && sizes.length > 0) {
            const sizesList = sizes.map((s: any) => `${s.name}: ${s.price} ريال`).join(' | ');
            confirmMsg += `\n\n📋 الأحجام:\n${sizesList}`;
          } else {
            confirmMsg += `\n💰 السعر: ${price} ريال`;
          }
          confirmMsg += `\n\n💡 كم تكلفة تحضيره (التكلفة) عشان نحسب الربح؟`;
          
          toast({ title: 'تمت الإضافة بنجاح!', description: `تم إضافة "${name}" إلى المنيو.` });
          setMessages(prev => [...prev, { id: Date.now(), sender: 'bot', text: confirmMsg }]);

        } else if (pendingAction.type === 'ADD_BRANCH' && pendingAction.payload) {
          const { city } = pendingAction.payload;
          const { error } = await supabase.from('branches').insert({
            name: `فرع ${city}`,
            city: city || '',
            restaurant_id: user.restaurantId,
            created_at: new Date().toISOString(),
          });
          if (error) throw error;
          toast({ title: 'تمت الإضافة بنجاح!', description: `تم إضافة فرع جديد في ${city}.` });
          setMessages(prev => [...prev, { id: Date.now(), sender: 'bot', text: `✅ تمت إضافة فرع جديد في ${city} بنجاح!` }]);

        } else if (pendingAction.type === 'ADD_OFFER' && pendingAction.payload) {
          const { discount } = pendingAction.payload;
          const { error } = await supabase.from('offers').insert({
            title: `عرض خصم ${discount || ''}%`,
            discount: discount ? `${discount}%` : '',
            restaurant_id: user.restaurantId,
            is_active: true,
            created_at: new Date().toISOString(),
          });
          if (error) throw error;
          toast({ title: 'تمت الإضافة بنجاح!', description: 'تم إضافة العرض الجديد.' });
          setMessages(prev => [...prev, { id: Date.now(), sender: 'bot', text: `✅ تمت إضافة العرض بنجاح!` }]);

        } else if (pendingAction.type === 'UPDATE_MENU_ITEM_COST' && pendingAction.payload) {
          const { itemId, cost, profit, profitMargin } = pendingAction.payload;
          const { error } = await supabase.from('menu_items').update({
            profit: cost,
            profitMargin: parseFloat(profitMargin),
          }).eq('id', itemId);
          if (error) throw error;
          toast({ title: 'تم التحديث!', description: 'تم حفظ التكلفة وهامش الربح.' });

        } else {
          throw new Error('نوع الإجراء غير معروف.');
        }
      } catch (error: any) {
        console.error("Failed to execute action:", error);
        toast({ title: 'خطأ', description: error.message || 'فشل تنفيذ الإجراء.', variant: 'destructive' });
        setMessages(prev => [...prev, { id: Date.now(), sender: 'bot', text: `❌ فشل التنفيذ: ${error.message}` }]);
      } finally {
        setPendingAction(null);
      }
    });
  };

  const finalInputDisabled = isThinking || isFetchingData || isExecutingAction;

  if (!user?.entitlements.canUseDashboardAgent) return null;

  return (
    <>
      {/* FAB Button */}
      <motion.div initial={{ scale: 0, y: 50 }} animate={{ scale: 1, y: 0 }} transition={{ delay: 1, type: 'spring' }} className="fixed bottom-6 left-6 z-50">
        <button onClick={() => setIsOpen(true)} className="h-14 w-14 rounded-2xl bg-gray-900 text-white hover:bg-gray-800 transition-colors flex items-center justify-center shadow-sm">
          <Bot className="h-6 w-6" />
        </button>
      </motion.div>

      {/* Overlay */}
      <AnimatePresence>
        {isOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/20 z-[99]" onClick={() => setIsOpen(false)} />
        )}
      </AnimatePresence>

      {/* Chat Panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ y: '100%', opacity: 0 }}
            animate={{ y: '0%', opacity: 1 }}
            exit={{ y: '100%', opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed bottom-0 left-0 z-[100] h-full w-full max-h-[85vh] sm:h-auto sm:max-h-[600px] sm:max-w-sm sm:bottom-6 sm:left-6 sm:rounded-2xl bg-white border border-gray-100 flex flex-col overflow-hidden"
          >
            {/* Header */}
            <header className="px-5 py-4 border-b border-gray-100 flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center">
                <Bot className="h-4.5 w-4.5 text-gray-500" />
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-bold text-gray-900">رفيق الدرب</h3>
                <p className="text-[10px] text-gray-400">مساعدك الذكي في مرشح</p>
              </div>
              <button onClick={() => setIsOpen(false)} className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-300 hover:text-gray-500 hover:bg-gray-50 transition-colors">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </header>

            {/* Messages */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
              {messages.map((msg, index) => {
                  const isLastMessage = index === messages.length - 1;
                  return (
                    <div key={msg.id} className={cn("flex gap-2.5", msg.sender === 'user' ? 'justify-end' : 'justify-start')}>
                      {msg.sender === 'bot' && (
                        <div className="w-7 h-7 rounded-lg bg-gray-100 flex items-center justify-center shrink-0 mt-0.5">
                          <Bot className="h-3.5 w-3.5 text-gray-400" />
                        </div>
                      )}
                      <div className={cn(
                        "max-w-[80%] px-3.5 py-2.5 text-[11px] leading-relaxed",
                        msg.sender === 'user'
                          ? 'bg-gray-900 text-white rounded-2xl rounded-br-md'
                          : 'bg-gray-50 text-gray-700 border border-gray-100 rounded-2xl rounded-bl-md'
                      )}>
                        <p className="whitespace-pre-line">{msg.text}</p>

                        {/* Cards */}
                        {msg.cards && msg.cards.length > 0 && (
                          <div className="mt-3 flex gap-2 overflow-x-auto scrollbar-hide pb-1">
                            {msg.cards.map((card, i) => (
                              <div key={i} className="shrink-0 w-32 bg-white border border-gray-100 rounded-xl p-2.5">
                                {card.image_url ? (
                                  <img src={card.image_url} alt={card.name} className="w-full h-20 object-cover rounded-lg mb-2" />
                                ) : (
                                  <div className="w-full h-20 bg-gray-50 rounded-lg mb-2 flex items-center justify-center">
                                    <span className="text-lg">🍽️</span>
                                  </div>
                                )}
                                <p className="text-[10px] font-bold text-gray-900 truncate">{card.name}</p>
                                {card.price && <p className="text-[9px] text-gray-400">{card.price} ر.س</p>}
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Stats */}
                        {msg.stats && msg.stats.length > 0 && (
                          <div className="mt-3 grid grid-cols-2 gap-2">
                            {msg.stats.map((stat, i) => (
                              <div key={i} className="bg-white border border-gray-100 rounded-lg px-2.5 py-2">
                                <p className="text-[9px] text-gray-400">{stat.label}</p>
                                <p className="text-sm font-bold text-gray-900">{stat.value}</p>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Action Button */}
                        {isLastMessage && pendingAction && pendingAction.type !== 'NAVIGATE' && pendingAction.type !== 'NONE' && (
                            <div className="mt-3 pt-3 border-t border-gray-200/50">
                                <button onClick={handleConfirmAction} disabled={isExecutingAction}
                                  className="h-8 px-3 rounded-lg bg-gray-900 text-white text-[10px] font-bold hover:bg-gray-800 transition-colors disabled:opacity-50 flex items-center gap-1.5">
                                    {isExecutingAction ? <Loader2 className="h-3 w-3 animate-spin"/> : <span>⚡</span>}
                                    {pendingAction.type === 'ADD_MENU_ITEM' && 'إضافة الطبق'}
                                    {pendingAction.type === 'ADD_BRANCH' && 'إضافة الفرع'}
                                    {pendingAction.type === 'ADD_OFFER' && 'إضافة العرض'}
                                    {pendingAction.type === 'UPDATE_MENU_ITEM_COST' && 'حفظ التكلفة'}
                                </button>
                            </div>
                        )}
                      </div>
                      {msg.sender === 'user' && (
                        <div className="w-7 h-7 rounded-lg bg-gray-200 flex items-center justify-center shrink-0 mt-0.5">
                          <User className="h-3.5 w-3.5 text-gray-500" />
                        </div>
                      )}
                    </div>
                  )
              })}
               {isThinking && (
                 <div className="flex justify-start gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
                      <Bot className="h-3.5 w-3.5 text-gray-400" />
                    </div>
                    <div className="bg-gray-50 border border-gray-100 rounded-2xl rounded-bl-md px-4 py-3 flex items-center gap-2">
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-gray-400"/>
                      <span className="text-[11px] text-gray-400">يفكر...</span>
                    </div>
                 </div>
               )}
            </div>

            {/* Input */}
            <footer className="px-5 py-4 border-t border-gray-100 bg-white">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="اسألني عن أي شيء..."
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                  disabled={finalInputDisabled}
                  className="flex-1 h-10 px-3 rounded-xl border border-gray-200 text-xs text-gray-900 placeholder:text-gray-300 focus-visible:outline-none focus-visible:border-gray-900 transition-colors disabled:opacity-50"
                />
                <button onClick={handleSend} disabled={finalInputDisabled || !input.trim()}
                  className="w-10 h-10 rounded-xl bg-gray-900 text-white hover:bg-gray-800 transition-colors disabled:opacity-50 flex items-center justify-center shrink-0">
                  <SendHorizonal className="h-4 w-4" />
                </button>
              </div>
            </footer>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
