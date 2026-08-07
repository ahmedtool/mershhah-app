'use client';

import { Input } from '@/components/ui/input';
import { SendHorizonal, Paperclip, Loader2, FileIcon, Download, MessageSquare, User, ArrowRight } from 'lucide-react';
import { FormEvent, useEffect, useRef, useState } from 'react';
import { useParams } from 'wouter';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/lib/supabase';
import type { ChatMessage, ChatSession } from '@/lib/types';
import { StorageImage } from '@/components/shared/StorageImage';
import { useToast } from '@/hooks/use-toast';
import { formatDistanceToNow } from 'date-fns';
import { ar } from 'date-fns/locale';

export default function AdminChatPage() {
  const params = useParams();
  const chatId = params.chatId as string;
  const { toast } = useToast();

  const [chat, setChat] = useState<ChatSession | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!chatId) return;
    const loadChat = async () => {
      const { data } = await supabase.from('chats').select('*').eq('id', chatId).single();
      if (data) setChat(data as ChatSession);
      setIsLoading(false);
    };
    loadChat();
  }, [chatId]);

  useEffect(() => {
    if (!chatId) return;
    const fetchMessages = async () => {
      const { data } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('chat_id', chatId)
        .order('timestamp', { ascending: true });
      setMessages((data || []) as ChatMessage[]);
    };
    fetchMessages();

    const channel = supabase
      .channel(`admin-chat-${chatId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'chat_messages',
        filter: `chat_id=eq.${chatId}`,
      }, (payload) => {
        setMessages(prev => [...prev, payload.new as ChatMessage]);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [chatId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async (e: FormEvent, file?: File) => {
    e.preventDefault();
    if ((message.trim() === '' && !file) || !chat) return;

    const messageText = message;
    setMessage('');
    setIsUploading(true);

    let attachmentData: Partial<ChatMessage> = {};

    try {
      if (file) {
        const filePath = `chat_attachments/${chatId}/${Date.now()}-${file.name}`;
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
        chat_id: chatId,
        senderId: 'admin',
        senderRole: 'admin',
        text: messageText,
        timestamp: now,
        ...attachmentData,
      });

      await supabase.from('chats').update({
        lastMessage: file ? `ملف: ${file.name}` : messageText,
        lastMessageTimestamp: now,
        adminHasUnread: false,
        ownerHasUnread: true,
      }).eq('id', chatId);
    } catch (error: any) {
      toast({ title: 'خطأ', description: error.message, variant: 'destructive' });
    } finally {
      setIsUploading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast({ title: 'حجم الملف كبير', description: 'أصغر من 5 ميجابايت.', variant: 'destructive' });
        return;
      }
      handleSendMessage(e as any, file);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col h-full">
        <Skeleton className="h-14 w-full" />
        <div className="flex-1 p-4 space-y-3">
          <Skeleton className="h-10 w-3/4 rounded-2xl" />
          <Skeleton className="h-10 w-3/4 ml-auto rounded-2xl" />
        </div>
        <Skeleton className="h-14 w-full" />
      </div>
    );
  }

  if (!chat) {
    return (
      <div className="flex-1 flex items-center justify-center text-center p-8">
        <div>
          <div className="w-16 h-16 bg-gray-50 rounded-2xl flex items-center justify-center mx-auto mb-3">
            <MessageSquare className="h-7 w-7 text-gray-300" />
          </div>
          <p className="text-sm font-bold text-gray-900">محادثة غير موجودة</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-3 border-b border-gray-100 flex items-center gap-3 shrink-0">
        <a href="/admin/support" className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-500 hover:bg-gray-100 shrink-0">
          <ArrowRight className="h-4 w-4" />
        </a>
        <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center shrink-0 overflow-hidden">
          {chat.ownerLogo ? (
            <StorageImage imagePath={chat.ownerLogo} alt={chat.ownerName || ''} width={36} height={36} className="object-cover w-full h-full" />
          ) : (
            <User className="h-4 w-4 text-gray-400" />
          )}
        </div>
        <div className="flex-1">
          <p className="text-xs font-bold text-gray-900">{chat.ownerName || 'صاحب المطعم'}</p>
          <p className="text-[10px] text-gray-400">محادثة مباشرة</p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 relative min-h-0">
        <div className="absolute inset-0 overflow-y-auto space-y-3 p-4">
          {messages.map((msg) => {
            const isAdmin = msg.senderRole === 'admin';
            return (
              <div key={msg.id} className={`flex items-end gap-2 ${isAdmin ? 'justify-end' : 'justify-start'}`}>
                {!isAdmin && (
                  <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center shrink-0 overflow-hidden">
                    {chat.ownerLogo ? (
                      <StorageImage imagePath={chat.ownerLogo} alt={chat.ownerName || ''} width={28} height={28} className="object-cover w-full h-full" />
                    ) : (
                      <span className="text-[9px] font-bold text-gray-400">{(chat.ownerName || 'م')[0]}</span>
                    )}
                  </div>
                )}
                <div className={`p-3 text-[13px] rounded-2xl max-w-[70%] ${isAdmin ? 'bg-gray-900 text-white rounded-br-md' : 'bg-gray-50 text-gray-700 border border-gray-100 rounded-bl-md'}`}>
                  {msg.text && <p className="whitespace-pre-wrap leading-relaxed">{msg.text}</p>}
                  {msg.attachment_url && (
                    <div className="mt-2">
                      {msg.attachment_type === 'image' ? (
                        <a href={msg.attachment_url} target="_blank" rel="noopener noreferrer">
                          <img src={msg.attachment_url} alt={msg.attachment_filename || ''} width={200} height={200} className="rounded-lg object-cover cursor-pointer" />
                        </a>
                      ) : (
                        <a href={msg.attachment_url} target="_blank" rel="noopener noreferrer" className={`flex items-center gap-2 p-2 rounded-lg ${isAdmin ? 'bg-white/10' : 'bg-white border border-gray-100'} hover:opacity-80 transition-opacity`}>
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
          {messages.length === 0 && (
            <div className="text-center pt-16">
              <p className="text-xs text-gray-300">ابدأ المحادثة مع صاحب المطعم</p>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input */}
      <form onSubmit={handleSendMessage} className="p-3 border-t border-gray-100 flex items-center gap-2 shrink-0">
        <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" />
        <button type="button" onClick={() => fileInputRef.current?.click()} disabled={isUploading}
          className="w-9 h-9 rounded-xl flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-colors shrink-0 disabled:opacity-30">
          {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Paperclip className="h-4 w-4" />}
        </button>
        <Input
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="اكتب رسالتك..."
          className="flex-1 h-10 rounded-xl border-gray-200 text-xs"
          disabled={isUploading}
          dir="rtl"
        />
        <button type="submit" disabled={(!message.trim() && !isUploading) || isUploading}
          className="w-10 h-10 rounded-xl bg-gray-900 text-white flex items-center justify-center hover:bg-gray-800 transition-colors shrink-0 disabled:opacity-30">
          <SendHorizonal className="h-4 w-4" />
        </button>
      </form>
    </div>
  );
}
