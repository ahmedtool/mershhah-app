'use client';

import { Input } from '@/components/ui/input';
import { SendHorizonal, Paperclip, Loader2, FileIcon, Download, MessageSquare, User, ArrowLeft } from 'lucide-react';
import { FormEvent, useEffect, useRef, useState } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { useUser } from '@/hooks/useUser';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabase';
import type { ChatMessage, ChatSession } from '@/lib/types';
import { VoiceRecorder } from '@/components/shared/VoiceRecorder';
import { formatDistanceToNow } from 'date-fns';
import { ar } from 'date-fns/locale';

export default function OwnerSupportPage() {
  const { user, isLoading: isUserLoading } = useUser();
  const { toast } = useToast();

  const [chats, setChats] = useState<ChatSession[]>([]);
  const [selectedChat, setSelectedChat] = useState<ChatSession | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [message, setMessage] = useState('');
  const [isLoadingChats, setIsLoadingChats] = useState(true);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showChat, setShowChat] = useState(false);

  const fetchChats = async () => {
    if (!user?.id) return;
    const { data, error } = await supabase
      .from('chats')
      .select('*')
      .eq('ownerId', user.id)
      .order('lastMessageTimestamp', { ascending: false, nullsFirst: false });
    if (!error) setChats((data || []) as ChatSession[]);
    setIsLoadingChats(false);
  };

  useEffect(() => {
    if (user?.id) {
      fetchChats();
      const channel = supabase
        .channel('owner-admin-chats')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'chats', filter: `ownerId=eq.${user.id}` }, fetchChats)
        .subscribe();
      return () => { supabase.removeChannel(channel); };
    } else if (!isUserLoading) {
      setIsLoadingChats(false);
    }
  }, [user, isUserLoading]);

  const selectChat = async (chat: ChatSession) => {
    setSelectedChat(chat);
    setShowChat(true);
    setIsLoadingMessages(true);
    setMessages([]);

    if (chat.ownerHasUnread) {
      await supabase.from('chats').update({ ownerHasUnread: false }).eq('id', chat.id);
      setChats(prev => prev.map(c => c.id === chat.id ? { ...c, ownerHasUnread: false } : c));
    }

    const { data } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('chat_id', chat.id)
      .order('timestamp', { ascending: true });
    setMessages((data || []) as ChatMessage[]);
    setIsLoadingMessages(false);

    const msgChannel = supabase
      .channel(`chat-messages-${chat.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'chat_messages',
        filter: `chat_id=eq.${chat.id}`,
      }, (payload) => {
        setMessages(prev => [...prev, payload.new as ChatMessage]);
      })
      .subscribe();

    return () => { supabase.removeChannel(msgChannel); };
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async (e: FormEvent, file?: File) => {
    e.preventDefault();
    if ((message.trim() === '' && !file) || !selectedChat || !user) return;

    const messageText = message;
    setMessage('');
    setIsUploading(true);

    let attachmentData: Partial<ChatMessage> = {};

    try {
      if (file) {
        const filePath = `chat_attachments/${selectedChat.id}/${Date.now()}-${file.name}`;
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
        chat_id: selectedChat.id,
        senderId: user.id,
        senderRole: 'owner',
        text: messageText,
        timestamp: now,
        ...attachmentData,
      });

      await supabase.from('chats').update({
        lastMessage: file ? `ملف: ${file.name}` : messageText,
        lastMessageTimestamp: now,
        adminHasUnread: true,
        ownerHasUnread: false,
      }).eq('id', selectedChat.id);

      setChats(prev => prev.map(c => c.id === selectedChat.id
        ? { ...c, lastMessage: messageText, lastMessageTimestamp: now }
        : c
      ));
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

  const handleSendVoice = async (blob: Blob) => {
    if (!selectedChat || !user) return;
    try {
      const filePath = `chat_attachments/${selectedChat.id}/${Date.now()}-voice.webm`;
      const { error: uploadError } = await supabase.storage
        .from('chat-attachments')
        .upload(filePath, blob);
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from('chat-attachments').getPublicUrl(filePath);
      const now = new Date().toISOString();

      await supabase.from('chat_messages').insert({
        id: crypto.randomUUID(),
        chat_id: selectedChat.id,
        senderId: user.id,
        senderRole: 'owner',
        text: '',
        timestamp: now,
        attachment_url: urlData.publicUrl,
        attachment_type: 'file',
        attachment_filename: 'رسالة صوتية',
      });

      await supabase.from('chats').update({
        lastMessage: 'رسالة صوتية',
        lastMessageTimestamp: now,
        adminHasUnread: true,
        ownerHasUnread: false,
      }).eq('id', selectedChat.id);
    } catch (error: any) {
      toast({ title: 'خطأ', description: error.message, variant: 'destructive' });
    }
  };

  const loading = isUserLoading || isLoadingChats;
  const unreadCount = chats.filter(c => c.ownerHasUnread).length;

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48 rounded-xl" />
        <Skeleton className="h-[calc(100vh-200px)] rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-black text-gray-900">محادثة مع الإدارة</h1>
        <p className="text-xs text-gray-400 mt-0.5">{chats.length} محادثة {unreadCount > 0 && `• ${unreadCount} جديدة`}</p>
      </div>

      <div className="flex gap-0 bg-white border border-gray-100 rounded-2xl overflow-hidden h-[calc(100vh-180px)]">
        {/* Chat List */}
        <div className={`w-full md:w-80 lg:w-96 border-l border-gray-100 flex flex-col shrink-0 ${showChat ? 'hidden md:flex' : 'flex'}`}>
          <div className="p-3 border-b border-gray-100">
            <Input placeholder="بحث..." className="h-10 text-xs rounded-xl bg-gray-50 border-gray-100" dir="rtl" />
          </div>
          <div className="flex-1 overflow-y-auto">
            {chats.length === 0 ? (
              <div className="text-center py-16 px-4">
                <div className="w-12 h-12 bg-gray-50 rounded-2xl flex items-center justify-center mx-auto mb-3">
                  <MessageSquare className="h-5 w-5 text-gray-300" />
                </div>
                <p className="text-xs font-bold text-gray-900 mb-1">لا توجد محادثات</p>
                <p className="text-[10px] text-gray-400">ستظهر محادثاتك مع الإدارة هنا</p>
              </div>
            ) : chats.map(chat => (
              <button
                key={chat.id}
                onClick={() => { selectChat(chat); setShowChat(true); }}
                className={`w-full flex items-center gap-3 p-3 hover:bg-gray-50 transition-colors border-b border-gray-50 text-right ${
                  selectedChat?.id === chat.id ? 'bg-gray-50' : ''
                }`}
              >
                <div className="w-10 h-10 rounded-full bg-gray-900 flex items-center justify-center shrink-0">
                  <span className="text-xs font-bold text-white">أد</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-gray-900">الإدارة</span>
                    {chat.lastMessageTimestamp && (
                      <span className="text-[9px] text-gray-300 shrink-0">
                        {formatDistanceToNow(new Date(chat.lastMessageTimestamp), { addSuffix: true, locale: ar })}
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-gray-400 truncate mt-0.5">{chat.lastMessage || 'محادثة جديدة'}</p>
                </div>
                {chat.ownerHasUnread && (
                  <div className="w-2 h-2 rounded-full bg-gray-900 shrink-0" />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Chat View */}
        <div className={`flex-1 flex flex-col min-w-0 ${showChat ? 'flex' : 'hidden md:flex'}`}>
          {!selectedChat ? (
            <div className="flex-1 flex items-center justify-center text-center p-8">
              <div>
                <div className="w-16 h-16 bg-gray-50 rounded-2xl flex items-center justify-center mx-auto mb-3">
                  <MessageSquare className="h-7 w-7 text-gray-300" />
                </div>
                <p className="text-sm font-bold text-gray-900 mb-1">اختر محادثة</p>
                <p className="text-[11px] text-gray-400">اختر محادثة من القائمة للبدء</p>
              </div>
            </div>
          ) : (
            <>
              {/* Chat Header */}
              <div className="p-3 border-b border-gray-100 flex items-center gap-3 shrink-0">
                <button onClick={() => setShowChat(false)} className="md:hidden w-8 h-8 rounded-lg flex items-center justify-center text-gray-500 hover:bg-gray-100">
                  <ArrowLeft className="h-4 w-4" />
                </button>
                <div className="w-9 h-9 rounded-full bg-gray-900 flex items-center justify-center">
                  <span className="text-xs font-bold text-white">أد</span>
                </div>
                <div className="flex-1">
                  <p className="text-xs font-bold text-gray-900">الإدارة</p>
                  <p className="text-[10px] text-gray-400">محادثة مباشرة</p>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 relative min-h-0">
                <div className="absolute inset-0 overflow-y-auto space-y-3 p-4">
                  {isLoadingMessages && (
                    <div className="space-y-3">
                      <Skeleton className="h-10 w-3/4 rounded-2xl" />
                      <Skeleton className="h-10 w-3/4 ml-auto rounded-2xl" />
                    </div>
                  )}
                  {!isLoadingMessages && messages.map((msg) => {
                    const isOwner = msg.senderRole === 'owner';
                    return (
                      <div key={msg.id} className={`flex items-end gap-2 ${isOwner ? 'justify-end' : 'justify-start'}`}>
                        {!isOwner && (
                          <div className="w-7 h-7 rounded-full bg-gray-900 flex items-center justify-center shrink-0">
                            <span className="text-[9px] font-bold text-white">أد</span>
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
                      </div>
                    );
                  })}
                  {!isLoadingMessages && messages.length === 0 && (
                    <div className="text-center pt-16">
                      <p className="text-xs text-gray-300">ابدأ المحادثة مع الإدارة</p>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>
              </div>

              {/* Input */}
              <form onSubmit={handleSendMessage} className="p-3 border-t border-gray-100 flex items-center gap-2 shrink-0">
                <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" />
                <button type="button" onClick={() => fileInputRef.current?.click()} disabled={isLoadingMessages || isUploading}
                  className="w-9 h-9 rounded-xl flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-colors shrink-0 disabled:opacity-30">
                  {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Paperclip className="h-4 w-4" />}
                </button>
                <VoiceRecorder onSend={handleSendVoice} disabled={isLoadingMessages} />
                <Input
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="اكتب ردك..."
                  className="flex-1 h-10 rounded-xl border-gray-200 text-xs"
                  disabled={isLoadingMessages || isUploading}
                  dir="rtl"
                />
                <button type="submit" disabled={isLoadingMessages || (!message.trim() && !isUploading) || isUploading}
                  className="w-10 h-10 rounded-xl bg-gray-900 text-white flex items-center justify-center hover:bg-gray-800 transition-colors shrink-0 disabled:opacity-30">
                  <SendHorizonal className="h-4 w-4" />
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
