'use client';

import { useEffect, useState, useRef, FormEvent } from 'react';
import { useParams } from 'wouter';
import { supabase } from '@/lib/supabase';
import { getPublicPage } from '@/lib/public-pages';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SendHorizonal, ChevronRight, Info, MessageSquare, Loader2, Paperclip, FileIcon, Download } from 'lucide-react';
import { StorageImage } from '@/components/shared/StorageImage';
import { Skeleton } from '@/components/ui/skeleton';
import type { ChatMessage } from '@/lib/types';

interface CustomerChat {
  id: string;
  restaurant_id: string;
  customer_phone: string | null;
  customer_name: string | null;
  lastMessage: string | null;
  lastMessageTimestamp: string | null;
  chat_type: string | null;
}

export default function SupportPage() {
  const params = useParams();
  const username = params.username as string;

  const [restaurant, setRestaurant] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [chat, setChat] = useState<CustomerChat | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Step: 'loading' | 'phone' | 'chat'
  const [step, setStep] = useState<'loading' | 'phone' | 'chat'>('loading');
  const [phone, setPhone] = useState('');
  const [customerName, setCustomerName] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      if (!username) return;
      try {
        const data = await getPublicPage(username);
        if (data?.restaurant) {
          setRestaurant(data.restaurant);
          setLoading(false);
          setStep('phone');
          return;
        }
        const { data: rest } = await supabase
          .from('restaurants')
          .select('*')
          .eq('username', username)
          .limit(1)
          .single();
        setRestaurant(rest || null);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
        setStep('phone');
      }
    };
    fetchData();
  }, [username]);

  const startChat = async () => {
    if (!restaurant || !phone.trim()) return;
    setStep('loading');

    const cleanPhone = phone.replace(/[^0-9]/g, '');

    // Find existing chat
    const { data: existing } = await supabase
      .from('chats')
      .select('*')
      .eq('restaurant_id', restaurant.id)
      .eq('customer_phone', cleanPhone)
      .eq('chat_type', 'customer')
      .limit(1)
      .single();

    if (existing) {
      setChat(existing as CustomerChat);
      const { data: msgs } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('chat_id', existing.id)
        .order('timestamp', { ascending: true });
      setMessages((msgs || []) as ChatMessage[]);
      setStep('chat');
      return;
    }

    // Create new chat
    const chatId = crypto.randomUUID();
    const { error } = await supabase.from('chats').insert({
      id: chatId,
      restaurant_id: restaurant.id,
      chat_type: 'customer',
      customer_phone: cleanPhone,
      customer_name: customerName.trim() || null,
      ownerName: restaurant.name,
      ownerId: restaurant.owner_id || '',
      lastMessage: null,
      lastMessageTimestamp: new Date().toISOString(),
      adminHasUnread: false,
      ownerHasUnread: true,
    });

    if (error) {
      console.error('Failed to create chat:', error);
      setStep('phone');
      return;
    }

    const newChat: CustomerChat = {
      id: chatId,
      restaurant_id: restaurant.id,
      customer_phone: cleanPhone,
      customer_name: customerName.trim() || null,
      lastMessage: null,
      lastMessageTimestamp: new Date().toISOString(),
      chat_type: 'customer',
    };
    setChat(newChat);
    setMessages([]);
    setStep('chat');
  };

  useEffect(() => {
    if (!chat) return;
    const channel = supabase
      .channel(`customer-chat-${chat.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'chat_messages',
        filter: `chat_id=eq.${chat.id}`,
      }, (payload) => {
        setMessages(prev => [...prev, payload.new as ChatMessage]);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [chat?.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async (e: FormEvent, file?: File) => {
    e.preventDefault();
    if ((message.trim() === '' && !file) || !chat || !restaurant) return;

    const messageText = message;
    setMessage('');
    setIsSending(true);

    let attachmentData: Partial<ChatMessage> = {};

    try {
      if (file) {
        const filePath = `chat_attachments/${chat.id}/${Date.now()}-${file.name}`;
        const { error: uploadError } = await supabase.storage
          .from('chat-attachments')
          .upload(filePath, file);
        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage.from('chat-attachments').getPublicUrl(filePath);
        attachmentData = {
          attachment_url: urlData.publicUrl,
          attachment_filename: file.name,
          attachment_type: file.type.startsWith('image/') ? 'image' : 'file',
        };
      }

      const now = new Date().toISOString();

      await supabase.from('chat_messages').insert({
        id: crypto.randomUUID(),
        chat_id: chat.id,
        senderId: chat.customer_phone || 'customer',
        senderRole: 'customer',
        text: messageText,
        timestamp: now,
        ...attachmentData,
      });

      await supabase.from('chats').update({
        lastMessage: file ? `ملف: ${file.name}` : messageText,
        lastMessageTimestamp: now,
        ownerHasUnread: true,
      }).eq('id', chat.id);
    } catch (error: any) {
      console.error('Send error:', error);
    } finally {
      setIsSending(false);
      setIsUploading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) return;
      setIsUploading(true);
      handleSendMessage(e as any, file);
    }
  };

  const primaryColor = restaurant?.primaryColor || '#111827';

  if (loading) {
    return (
      <div className="min-h-screen bg-white" dir="rtl">
        <div className="max-w-lg mx-auto px-5 space-y-8 pt-8">
          <div className="flex flex-col items-center space-y-4">
            <Skeleton className="h-20 w-20 rounded-2xl" />
            <Skeleton className="h-6 w-40" />
          </div>
          <Skeleton className="h-80 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  if (!restaurant) {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center bg-white text-center p-6 space-y-5">
        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center text-gray-400">
          <Info size={28} />
        </div>
        <h1 className="text-lg font-bold text-gray-900">المطعم غير موجود</h1>
        <Button onClick={() => window.location.href = '/'} variant="outline" className="rounded-xl px-6">العودة للرئيسية</Button>
      </div>
    );
  }

  // Phone input step
  if (step === 'phone') {
    return (
      <div className="min-h-screen bg-white pb-16" dir="rtl">
        <div className="max-w-lg mx-auto w-full px-5 pt-6 pb-4 flex items-center justify-between">
          <button onClick={() => window.history.back()} className="w-9 h-9 rounded-xl flex items-center justify-center text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition-colors">
            <ChevronRight className="h-5 w-5" />
          </button>
          <div className="w-9" />
        </div>

        <div className="max-w-lg mx-auto w-full px-5 pb-8 text-center space-y-3">
          <div className="relative w-16 h-16 mx-auto rounded-2xl overflow-hidden">
            <StorageImage imagePath={restaurant.logo} alt={restaurant.name} fill sizes="64px" className="object-cover" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">{restaurant.name}</h1>
            <p className="text-sm text-gray-400 mt-0.5">تواصل معنا مباشرة</p>
          </div>
        </div>

        <div className="max-w-lg mx-auto w-full px-5">
          <div className="border border-gray-100 rounded-xl p-5 space-y-4">
            <div className="text-center mb-2">
              <div className="w-12 h-12 bg-gray-50 rounded-2xl flex items-center justify-center mx-auto mb-2">
                <MessageSquare className="h-5 w-5 text-gray-400" />
              </div>
              <p className="text-xs font-bold text-gray-900">ابدأ محادثة</p>
              <p className="text-[10px] text-gray-400">أدخل رقم جوالك للمتابعة</p>
            </div>

            <div>
              <label className="text-xs text-gray-500 mb-1 block text-right">رقم الجوال</label>
              <Input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="05XXXXXXXX"
                type="tel"
                className="h-10 text-sm rounded-lg border-gray-100"
                dir="ltr"
              />
            </div>

            <div>
              <label className="text-xs text-gray-500 mb-1 block text-right">اسمك (اختياري)</label>
              <Input
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="اسمك"
                className="h-10 text-sm rounded-lg border-gray-100"
                dir="rtl"
              />
            </div>

            <Button
              onClick={startChat}
              disabled={!phone.trim() || phone.replace(/[^0-9]/g, '').length < 10}
              className="w-full h-10 rounded-lg text-sm font-semibold text-white"
              style={{ backgroundColor: primaryColor }}
            >
              بدء المحادثة
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Chat step
  return (
    <div className="min-h-screen bg-white flex flex-col" dir="rtl">
      {/* Header */}
      <div className="border-b border-gray-100 px-4 py-3 flex items-center gap-3 shrink-0">
        <button onClick={() => window.history.back()} className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-500 hover:bg-gray-100">
          <ChevronRight className="h-4 w-4" />
        </button>
        <div className="relative w-9 h-9 rounded-xl overflow-hidden shrink-0">
          <StorageImage imagePath={restaurant.logo} alt={restaurant.name} fill sizes="36px" className="object-cover" />
        </div>
        <div className="flex-1">
          <p className="text-xs font-bold text-gray-900">{restaurant.name}</p>
          <p className="text-[9px] text-emerald-500">متصل</p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 relative min-h-0">
        <div className="absolute inset-0 overflow-y-auto space-y-3 p-4">
          {messages.length === 0 && (
            <div className="text-center pt-16">
              <div className="w-12 h-12 bg-gray-50 rounded-2xl flex items-center justify-center mx-auto mb-2">
                <MessageSquare className="h-5 w-5 text-gray-300" />
              </div>
              <p className="text-[11px] text-gray-400">ابدأ المحادثة، سنرد عليك قريباً</p>
            </div>
          )}
          {messages.map((msg) => {
            const isCustomer = msg.senderRole === 'customer';
            return (
              <div key={msg.id} className={`flex items-end gap-2 ${isCustomer ? 'justify-start' : 'justify-end'}`}>
                {!isCustomer && (
                  <div className="w-7 h-7 rounded-full overflow-hidden shrink-0">
                    <StorageImage imagePath={restaurant.logo} alt={restaurant.name} width={28} height={28} className="object-cover w-full h-full" />
                  </div>
                )}
                <div className={`p-3 text-[13px] rounded-2xl max-w-[75%] ${isCustomer ? 'bg-gray-100 text-gray-700 rounded-bl-md' : 'bg-gray-900 text-white rounded-br-md'}`}>
                  {msg.text && <p className="whitespace-pre-wrap leading-relaxed">{msg.text}</p>}
                  {msg.attachment_url && (
                    <div className="mt-2">
                      {msg.attachment_type === 'image' ? (
                        <a href={msg.attachment_url} target="_blank" rel="noopener noreferrer">
                          <img src={msg.attachment_url} alt={msg.attachment_filename || ''} width={200} height={200} className="rounded-lg object-cover cursor-pointer" />
                        </a>
                      ) : (
                        <a href={msg.attachment_url} target="_blank" rel="noopener noreferrer" className={`flex items-center gap-2 p-2 rounded-lg ${isCustomer ? 'bg-white border border-gray-100' : 'bg-white/10'} hover:opacity-80 transition-opacity`}>
                          <FileIcon className="h-4 w-4 shrink-0" />
                          <span className="text-[11px] underline truncate">{msg.attachment_filename || 'ملف'}</span>
                          <Download className="h-3 w-3 shrink-0" />
                        </a>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input */}
      <form onSubmit={handleSendMessage} className="p-3 border-t border-gray-100 flex items-center gap-2 shrink-0 bg-white">
        <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" />
        <button type="button" onClick={() => fileInputRef.current?.click()} disabled={isSending || isUploading}
          className="w-9 h-9 rounded-xl flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-colors shrink-0 disabled:opacity-30">
          {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Paperclip className="h-4 w-4" />}
        </button>
        <Input
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="اكتب رسالتك..."
          className="flex-1 h-10 rounded-xl border-gray-200 text-xs"
          disabled={isSending}
          dir="rtl"
        />
        <button type="submit" disabled={isSending || (!message.trim() && !isUploading)}
          className="w-10 h-10 rounded-xl flex items-center justify-center transition-colors shrink-0 disabled:opacity-30"
          style={{ backgroundColor: message.trim() ? primaryColor : '#f3f4f6', color: message.trim() ? 'white' : '#9ca3af' }}>
          <SendHorizonal className="h-4 w-4" />
        </button>
      </form>
    </div>
  );
}
