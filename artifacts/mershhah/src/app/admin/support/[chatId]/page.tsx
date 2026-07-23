
'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SendHorizonal, Paperclip, Loader2, FileIcon, Download } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { FormEvent, useEffect, useRef, useState } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import type { ChatMessage, ChatSession, Profile } from '@/lib/types';
import { useUser } from '@/hooks/useUser';
import { useParams } from 'wouter';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabase';
import { StorageImage } from '@/components/shared/StorageImage';

const getInitials = (name?: string | null) => {
  if (!name) return 'A';
  return name.split(' ').map((n) => n[0]).join('').substring(0, 2).toUpperCase();
};

export default function AdminChatPage() {
  const params = useParams();
  const chatId = params.chatId as string;
  const { user: adminUser } = useUser();
  const { toast } = useToast();
  const [session, setSession] = useState<ChatSession | null>(null);
  const [ownerProfile, setOwnerProfile] = useState<Profile | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!chatId) return;

    setIsLoading(true);

    const fetchInitial = async () => {
      const [chatRes, profileRes, messagesRes] = await Promise.all([
        supabase.from('chats').select('*').eq('id', chatId).single(),
        supabase.from('profiles').select('*').eq('id', chatId).single(),
        supabase.from('chat_messages').select('*').eq('chat_id', chatId).order('timestamp', { ascending: true }),
      ]);

      if (chatRes.data) {
        const sessionData = chatRes.data as ChatSession;
        setSession(sessionData);
        if (sessionData.adminHasUnread) {
          supabase.from('chats').update({ adminHasUnread: false }).eq('id', chatId);
        }
      }

      if (profileRes.data) setOwnerProfile(profileRes.data as Profile);
      setMessages((messagesRes.data || []) as ChatMessage[]);
      setIsLoading(false);
    };

    fetchInitial();

    const chatChannel = supabase
      .channel(`admin-chat-session-${chatId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'chats', filter: `id=eq.${chatId}` }, (payload) => {
        setSession(payload.new as ChatSession);
      })
      .subscribe();

    const messagesChannel = supabase
      .channel(`admin-chat-messages-${chatId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `chat_id=eq.${chatId}` }, (payload) => {
        setMessages((prev) => [...prev, payload.new as ChatMessage]);
        supabase.from('chats').update({ adminHasUnread: false }).eq('id', chatId);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(chatChannel);
      supabase.removeChannel(messagesChannel);
    };
  }, [chatId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async (e: FormEvent, file?: File) => {
    e.preventDefault();
    if ((message.trim() === '' && !file) || !chatId || !adminUser || (!session && !ownerProfile)) return;

    const messageText = message;
    setMessage('');
    setIsUploading(true);

    let attachmentData: Partial<ChatMessage> = {};

    try {
      if (file) {
        const filePath = `chat_attachments/${chatId}/${Date.now()}-${file.name}`;
        const { error: uploadError } = await supabase.storage.from('chat-attachments').upload(filePath, file);
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
        senderId: adminUser.uid,
        senderRole: 'admin',
        text: messageText,
        timestamp: now,
        ...attachmentData,
      });

      await supabase.from('chats').upsert({
        id: chatId,
        lastMessage: file ? `ملف: ${file.name}` : messageText,
        lastMessageTimestamp: now,
        ownerHasUnread: true,
        adminHasUnread: false,
        ownerName: session?.ownerName || ownerProfile?.restaurant_name || ownerProfile?.full_name,
        ownerLogo: session?.ownerLogo || null,
      });
    } catch (error: any) {
      toast({ title: 'خطأ في الإرسال', description: error.message, variant: 'destructive' });
    } finally {
      setIsUploading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast({ title: 'حجم الملف كبير جداً', description: 'الرجاء اختيار ملف أصغر من 5 ميجابايت.', variant: 'destructive' });
        return;
      }
      handleSendMessage(e as unknown as FormEvent, file);
    }
  };

  const pageTitleName = session?.ownerName || ownerProfile?.restaurant_name || ownerProfile?.full_name || '...';

  return (
    <div className="flex flex-col h-full bg-background">
      <header className="flex items-center gap-4 border-b p-4 shrink-0">
        <Avatar className="h-10 w-10 border overflow-hidden">
          {session?.ownerLogo ? (
            <StorageImage imagePath={session.ownerLogo} alt={pageTitleName} className="object-cover" />
          ) : (
            <AvatarFallback className="bg-muted text-foreground font-bold">
              {getInitials(pageTitleName)}
            </AvatarFallback>
          )}
        </Avatar>
        <div>
          <h2 className="text-lg font-semibold">{pageTitleName}</h2>
          <p className="text-sm text-muted-foreground">صاحب مطعم</p>
        </div>
      </header>

      <div className="flex-1 relative">
        <div className="absolute inset-0 overflow-y-auto p-6 space-y-4">
          {isLoading && (
            <div className="space-y-4">
              <Skeleton className="h-16 w-3/4 rounded-lg" />
              <Skeleton className="h-16 w-3/4 ml-auto rounded-lg" />
              <Skeleton className="h-12 w-1/2 rounded-lg" />
            </div>
          )}
          {!isLoading && messages.map((msg) => {
            const isAdmin = msg.senderRole === 'admin';
            return (
              <div key={msg.id} className={`flex items-end gap-3 ${isAdmin ? 'justify-end' : 'justify-start'}`}>
                {!isAdmin && (
                  <Avatar className="h-8 w-8 shrink-0 self-end overflow-hidden">
                    {session?.ownerLogo ? (
                      <StorageImage imagePath={session.ownerLogo} alt={pageTitleName} className="object-cover" />
                    ) : (
                      <AvatarFallback className="bg-muted text-foreground">
                        {getInitials(session?.ownerName || ownerProfile?.full_name)}
                      </AvatarFallback>
                    )}
                  </Avatar>
                )}
                <div className={`p-3 text-sm rounded-2xl max-w-[70%] ${isAdmin ? 'bg-primary text-primary-foreground rounded-br-none' : 'bg-muted rounded-bl-none'}`}>
                  {msg.text && <p className="whitespace-pre-wrap">{msg.text}</p>}
                  {msg.attachment_url && (
                    <div className="mt-2">
                      {msg.attachment_type === 'image' ? (
                        <a href={msg.attachment_url} target="_blank" rel="noopener noreferrer">
                          <img src={msg.attachment_url} alt={msg.attachment_filename || 'Attachment'} width={200} height={200} className="rounded-md object-cover cursor-pointer" />
                        </a>
                      ) : (
                        <a href={msg.attachment_url} target="_blank" rel="noopener noreferrer" className={`flex items-center gap-2 p-2 rounded-md ${isAdmin ? 'bg-primary-foreground/10' : 'bg-background/50'} hover:bg-background/70`}>
                          <FileIcon className="h-5 w-5" />
                          <span className="text-sm underline">{msg.attachment_filename || 'تنزيل الملف'}</span>
                          <Download className="h-4 w-4" />
                        </a>
                      )}
                    </div>
                  )}
                </div>
                {isAdmin && (
                  <Avatar className="h-8 w-8 shrink-0 self-end">
                    <AvatarFallback className="bg-primary text-primary-foreground font-bold text-xs">أد</AvatarFallback>
                  </Avatar>
                )}
              </div>
            );
          })}
          {!isLoading && messages.length === 0 && (
            <p className="text-center text-muted-foreground pt-10">لا توجد رسائل بعد في هذه المحادثة.</p>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      <form onSubmit={handleSendMessage} className="flex items-center gap-2 border-t p-4 shrink-0">
        <Input
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="اكتب ردك هنا..."
          className="flex-1"
          disabled={isLoading || isUploading}
        />
        <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => fileInputRef.current?.click()}
          disabled={isLoading || isUploading}
        >
          {isUploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Paperclip className="h-5 w-5" />}
        </Button>
        <Button type="submit" disabled={isLoading || !message.trim() || isUploading}>
          <SendHorizonal className="h-4 w-4" />
        </Button>
      </form>
    </div>
  );
}
