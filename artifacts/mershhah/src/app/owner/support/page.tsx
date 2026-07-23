'use client';

import { Input } from '@/components/ui/input';
import { SendHorizonal, Paperclip, Loader2, FileIcon, Download } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { FormEvent, useEffect, useRef, useState } from 'react';
import PageHeader from '@/components/dashboard/PageHeader';
import { Skeleton } from '@/components/ui/skeleton';
import { useUser } from '@/hooks/useUser';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabase';
import type { ChatMessage } from '@/lib/types';

export default function OwnerSupportPage() {
  const { user, isLoading: isUserLoading } = useUser();
  const { toast } = useToast();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [message, setMessage] = useState('');
  const [isLoadingMessages, setIsLoadingMessages] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const chatId = user?.id;

  useEffect(() => {
    if (!chatId || !user) return;

    const initChat = async () => {
      const { data: existing } = await supabase.from('chats').select('id, ownerHasUnread').eq('id', chatId).single();

      if (!existing) {
        await supabase.from('chats').upsert({
          id: chatId,
          ownerId: user.id,
          ownerName: user.restaurant_name || user.full_name || 'New User',
          ownerLogo: user.logo || null,
          lastMessageTimestamp: new Date().toISOString(),
          adminHasUnread: false,
          ownerHasUnread: false,
        });
      } else if (existing.ownerHasUnread) {
        await supabase.from('chats').update({ ownerHasUnread: false }).eq('id', chatId);
      }
    };

    initChat();

    const fetchMessages = async () => {
      const { data } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('chat_id', chatId)
        .order('timestamp', { ascending: true });
      setMessages((data || []) as ChatMessage[]);
      setIsLoadingMessages(false);
    };

    fetchMessages();

    const channel = supabase
      .channel(`owner-chat-${chatId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'chat_messages',
        filter: `chat_id=eq.${chatId}`,
      }, (payload) => {
        setMessages((prev) => [...prev, payload.new as ChatMessage]);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [chatId, user]);

  const getInitials = (name?: string | null) => {
    if (!name) return 'U';
    return name.split(' ').map((n) => n[0]).join('').substring(0, 2).toUpperCase();
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async (e: FormEvent, file?: File) => {
    e.preventDefault();
    if ((message.trim() === '' && !file) || !chatId || !user) return;

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
        senderId: user.id,
        senderRole: 'owner',
        text: messageText,
        timestamp: now,
        ...attachmentData,
      });

      await supabase.from('chats').upsert({
        id: chatId,
        lastMessage: file ? `ملف: ${file.name}` : messageText,
        lastMessageTimestamp: now,
        adminHasUnread: true,
        ownerHasUnread: false,
        ownerLogo: user.logo || null,
        ownerName: user.restaurant_name || user.full_name || 'New User',
      });
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
      handleSendMessage(e, file);
    }
  };

  const loading = isLoadingMessages || isUserLoading;

  return (
    <div className="flex flex-col h-[calc(100vh-theme(spacing.24))]">
      <PageHeader title="الدعم المباشر" description="تواصل مع فريق الدعم الفني." />

      {/* Chat container */}
      <div className="flex-1 mt-4 bg-white border border-gray-100 rounded-2xl flex flex-col overflow-hidden min-h-0">
        {/* Messages */}
        <div className="flex-1 relative min-h-0">
          <div className="absolute inset-0 overflow-y-auto space-y-3 p-4">
            {loading && (
              <div className="space-y-3">
                <Skeleton className="h-10 w-3/4 rounded-2xl" />
                <Skeleton className="h-10 w-3/4 ml-auto rounded-2xl" />
                <Skeleton className="h-10 w-3/4 rounded-2xl" />
              </div>
            )}
            {!loading && messages.map((msg) => {
              const isOwner = msg.senderRole === 'owner';
              return (
                <div key={msg.id} className={`flex items-end gap-2 ${isOwner ? 'justify-end' : 'justify-start'}`}>
                  {!isOwner && (
                    <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
                      <span className="text-[9px] font-bold text-gray-400">A</span>
                    </div>
                  )}
                  <div className={`p-3 text-[13px] rounded-2xl max-w-[70%] ${isOwner ? 'bg-gray-900 text-white rounded-br-md' : 'bg-gray-50 text-gray-700 border border-gray-100 rounded-bl-md'}`}>
                    {msg.text && <p className="whitespace-pre-wrap leading-relaxed">{msg.text}</p>}
                    {msg.attachment_url && (
                      <div className="mt-2">
                        {msg.attachment_type === 'image' ? (
                          <a href={msg.attachment_url} target="_blank" rel="noopener noreferrer">
                            <img src={msg.attachment_url} alt={msg.attachment_filename || ''} width={200} height={200} className="rounded-lg object-cover cursor-pointer" />
                          </a>
                        ) : (
                          <a href={msg.attachment_url} target="_blank" rel="noopener noreferrer" className={`flex items-center gap-2 p-2 rounded-lg ${isOwner ? 'bg-white/10' : 'bg-white border border-gray-100'} hover:opacity-80 transition-opacity`}>
                            <FileIcon className="h-4 w-4 shrink-0" />
                            <span className="text-[11px] underline truncate">{msg.attachment_filename || 'ملف'}</span>
                            <Download className="h-3 w-3 shrink-0" />
                          </a>
                        )}
                      </div>
                    )}
                  </div>
                  {isOwner && (
                    <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
                      <span className="text-[9px] font-bold text-gray-500">{getInitials(user?.full_name)}</span>
                    </div>
                  )}
                </div>
              );
            })}
            {!loading && messages.length === 0 && (
              <div className="text-center pt-16">
                <p className="text-xs text-gray-300">هنا بداية محادثتك مع الدعم الفني</p>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Input */}
        <form onSubmit={handleSendMessage} className="p-3 border-t border-gray-100 flex items-center gap-2 shrink-0">
          <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" />
          <button type="button" onClick={() => fileInputRef.current?.click()} disabled={loading || !chatId || isUploading}
            className="w-9 h-9 rounded-xl flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-colors shrink-0 disabled:opacity-30">
            {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Paperclip className="h-4 w-4" />}
          </button>
          <Input
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="اكتب رسالتك..."
            className="flex-1 h-10 rounded-xl border-gray-200 text-xs"
            disabled={loading || !chatId || isUploading}
          />
          <button type="submit" disabled={loading || !chatId || (!message.trim()) || isUploading}
            className="w-10 h-10 rounded-xl bg-gray-900 text-white flex items-center justify-center hover:bg-gray-800 transition-colors shrink-0 disabled:opacity-30">
            <SendHorizonal className="h-4 w-4" />
          </button>
        </form>
      </div>
    </div>
  );
}
