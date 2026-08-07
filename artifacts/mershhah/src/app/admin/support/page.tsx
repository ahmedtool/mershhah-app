'use client';

import { Input } from '@/components/ui/input';
import { SendHorizonal, Paperclip, Loader2, FileIcon, Download, MessageSquare, User, ArrowLeft, Plus, Trash2 } from 'lucide-react';
import { FormEvent, useEffect, useRef, useState, useTransition } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabase';
import type { ChatMessage, ChatSession } from '@/lib/types';
import { StorageImage } from '@/components/shared/StorageImage';
import { formatDistanceToNow } from 'date-fns';
import { ar } from 'date-fns/locale';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogTitle } from '@/components/ui/alert-dialog';

export default function AdminSupportPage() {
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
  const [searchQuery, setSearchQuery] = useState('');
  const [sessionToDelete, setSessionToDelete] = useState<ChatSession | null>(null);
  const [isDeleting, startDeleteTransition] = useTransition();

  const [showPicker, setShowPicker] = useState(false);
  const [restaurants, setRestaurants] = useState<any[]>([]);
  const [isCreating, setIsCreating] = useState(false);

  const fetchChats = async () => {
    const { data, error } = await supabase
      .from('chats')
      .select('*')
      .order('lastMessageTimestamp', { ascending: false, nullsFirst: false });
    if (!error) setChats((data || []) as ChatSession[]);
    setIsLoadingChats(false);
  };

  useEffect(() => {
    fetchChats();
    const channel = supabase
      .channel('admin-chats-all')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chats' }, fetchChats)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const selectChat = async (chat: ChatSession) => {
    setSelectedChat(chat);
    setShowChat(true);
    setIsLoadingMessages(true);
    setMessages([]);

    if (chat.adminHasUnread) {
      await supabase.from('chats').update({ adminHasUnread: false }).eq('id', chat.id);
      setChats(prev => prev.map(c => c.id === chat.id ? { ...c, adminHasUnread: false } : c));
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
    if ((message.trim() === '' && !file) || !selectedChat) return;

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
      }).eq('id', selectedChat.id);

      setChats(prev => prev.map(c => c.id === selectedChat.id
        ? { ...c, lastMessage: messageText || `ملف: ${file?.name}`, lastMessageTimestamp: now }
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

  const handleDeleteConfirm = () => {
    if (!sessionToDelete) return;
    startDeleteTransition(async () => {
      try {
        await supabase.from('chat_messages').delete().eq('chat_id', sessionToDelete.id);
        await supabase.from('chats').delete().eq('id', sessionToDelete.id);
        if (selectedChat?.id === sessionToDelete.id) {
          setSelectedChat(null);
          setShowChat(false);
        }
        toast({ title: 'تم حذف المحادثة' });
      } catch (e: any) {
        toast({ title: 'خطأ', description: e.message, variant: 'destructive' });
      } finally {
        setSessionToDelete(null);
      }
    });
  };

  const openNewChat = async () => {
    setShowPicker(true);
    const { data } = await supabase.from('restaurants').select('id, name, logo, username, owner_id').order('name');
    setRestaurants(data || []);
  };

  const createChat = async (restaurant: any) => {
    setIsCreating(true);
    try {
      const chatId = crypto.randomUUID();
      const { error } = await supabase.from('chats').insert({
        id: chatId,
        ownerId: restaurant.owner_id || '',
        ownerName: restaurant.name,
        ownerLogo: restaurant.logo || null,
        lastMessage: null,
        lastMessageTimestamp: new Date().toISOString(),
        adminHasUnread: false,
        ownerHasUnread: true,
      });
      if (error) throw error;
      setShowPicker(false);
      toast({ title: 'تم إنشاء المحادثة' });
      const newChat: ChatSession = {
        id: chatId,
        ownerId: restaurant.owner_id || '',
        ownerName: restaurant.name,
        ownerLogo: restaurant.logo || null,
        lastMessageTimestamp: new Date().toISOString(),
        adminHasUnread: false,
        ownerHasUnread: true,
      };
      setChats(prev => [newChat, ...prev]);
      selectChat(newChat);
    } catch (e: any) {
      toast({ title: 'خطأ', description: e.message, variant: 'destructive' });
    } finally {
      setIsCreating(false);
    }
  };

  const filteredChats = chats.filter(chat =>
    chat.ownerName?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const unreadCount = chats.filter(c => c.adminHasUnread).length;

  if (isLoadingChats) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48 rounded-xl" />
        <Skeleton className="h-[calc(100vh-200px)] rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-black text-gray-900">محادثات المالكين</h1>
          <p className="text-xs text-gray-400 mt-0.5">{chats.length} محادثة {unreadCount > 0 && `• ${unreadCount} جديدة`}</p>
        </div>
        <button onClick={openNewChat} className="h-9 px-3 rounded-xl bg-gray-900 text-white text-xs font-bold flex items-center gap-1.5 hover:bg-gray-800 transition-colors">
          <Plus className="h-4 w-4" />
          جديدة
        </button>
      </div>

      <div className="flex gap-0 bg-white border border-gray-100 rounded-2xl overflow-hidden h-[calc(100vh-180px)]">
        {/* Chat List */}
        <div className={`w-full md:w-80 lg:w-96 border-l border-gray-100 flex flex-col shrink-0 ${showChat ? 'hidden md:flex' : 'flex'}`}>
          {showPicker ? (
            <div className="flex flex-col h-full">
              <div className="p-3 border-b border-gray-100 flex items-center justify-between">
                <h3 className="text-xs font-bold text-gray-900">اختر صاحب مطعم</h3>
                <button onClick={() => setShowPicker(false)} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-gray-100">
                  <span className="text-xs text-gray-400">✕</span>
                </button>
              </div>
              <div className="flex-1 overflow-y-auto">
                {restaurants.length === 0 ? (
                  <div className="text-center py-16 px-4">
                    <p className="text-xs text-gray-400">لا يوجد مطاعم مسجلة</p>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-50">
                    {restaurants.map((r: any) => (
                      <button
                        key={r.id}
                        onClick={() => createChat(r)}
                        disabled={isCreating}
                        className="w-full flex items-center gap-3 p-3 hover:bg-gray-50 transition-colors text-right disabled:opacity-50"
                      >
                        <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center shrink-0 overflow-hidden">
                          {r.logo ? (
                            <StorageImage imagePath={r.logo} alt={r.name} width={40} height={40} className="object-cover w-full h-full" />
                          ) : (
                            <span className="text-sm font-bold text-gray-400">{r.name?.charAt(0)}</span>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-gray-900 truncate">{r.name}</p>
                          {r.username && <p className="text-[10px] text-gray-400">@{r.username}</p>}
                        </div>
                        {isCreating && <Loader2 className="h-4 w-4 animate-spin text-gray-300" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <>
              <div className="p-3 border-b border-gray-100">
                <div className="relative">
                  <Input
                    placeholder="بحث..."
                    className="h-10 text-xs rounded-xl bg-gray-50 border-gray-100 pr-8"
                    dir="rtl"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                  <svg className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-300" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto">
                {filteredChats.length === 0 ? (
                  <div className="text-center py-16 px-4">
                    <div className="w-12 h-12 bg-gray-50 rounded-2xl flex items-center justify-center mx-auto mb-3">
                      <MessageSquare className="h-5 w-5 text-gray-300" />
                    </div>
                    <p className="text-xs font-bold text-gray-900 mb-1">لا توجد محادثات</p>
                    <p className="text-[10px] text-gray-400">ابدأ محادثة مع صاحب مطعم</p>
                  </div>
                ) : filteredChats.map(chat => (
                  <button
                    key={chat.id}
                    onClick={() => selectChat(chat)}
                    className={`w-full flex items-center gap-3 p-3 hover:bg-gray-50 transition-colors border-b border-gray-50 text-right relative group ${
                      selectedChat?.id === chat.id ? 'bg-gray-50' : ''
                    }`}
                  >
                    <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center shrink-0 overflow-hidden">
                      {chat.ownerLogo ? (
                        <StorageImage imagePath={chat.ownerLogo} alt={chat.ownerName || ''} width={40} height={40} className="object-cover w-full h-full" />
                      ) : (
                        <span className="text-xs font-bold text-gray-500">{chat.ownerName?.charAt(0) || 'م'}</span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-gray-900">{chat.ownerName || 'صاحب مطعم'}</span>
                        {chat.lastMessageTimestamp && (
                          <span className="text-[9px] text-gray-300 shrink-0">
                            {formatDistanceToNow(new Date(chat.lastMessageTimestamp), { addSuffix: true, locale: ar })}
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-gray-400 truncate mt-0.5">{chat.lastMessage || 'محادثة جديدة'}</p>
                    </div>
                    {chat.adminHasUnread && (
                      <div className="w-2 h-2 rounded-full bg-gray-900 shrink-0" />
                    )}
                    <button
                      onClick={(e) => { e.stopPropagation(); setSessionToDelete(chat); }}
                      className="absolute left-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-red-50 transition-all"
                    >
                      <Trash2 className="h-3.5 w-3.5 text-red-400" />
                    </button>
                  </button>
                ))}
              </div>
            </>
          )}
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
                <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center shrink-0 overflow-hidden">
                  {selectedChat.ownerLogo ? (
                    <StorageImage imagePath={selectedChat.ownerLogo} alt={selectedChat.ownerName || ''} width={36} height={36} className="object-cover w-full h-full" />
                  ) : (
                    <span className="text-xs font-bold text-gray-400">{selectedChat.ownerName?.charAt(0) || 'م'}</span>
                  )}
                </div>
                <div className="flex-1">
                  <p className="text-xs font-bold text-gray-900">{selectedChat.ownerName || 'صاحب المطعم'}</p>
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
                    const isAdmin = msg.senderRole === 'admin';
                    return (
                      <div key={msg.id} className={`flex items-end gap-2 ${isAdmin ? 'justify-end' : 'justify-start'}`}>
                        {!isAdmin && (
                          <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center shrink-0 overflow-hidden">
                            {selectedChat.ownerLogo ? (
                              <StorageImage imagePath={selectedChat.ownerLogo} alt={selectedChat.ownerName || ''} width={28} height={28} className="object-cover w-full h-full" />
                            ) : (
                              <span className="text-[9px] font-bold text-gray-400">{(selectedChat.ownerName || 'م')[0]}</span>
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
                  {!isLoadingMessages && messages.length === 0 && (
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
                <button type="button" onClick={() => fileInputRef.current?.click()} disabled={isLoadingMessages || isUploading}
                  className="w-9 h-9 rounded-xl flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-colors shrink-0 disabled:opacity-30">
                  {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Paperclip className="h-4 w-4" />}
                </button>
                <Input
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="اكتب رسالتك..."
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

      <AlertDialog open={!!sessionToDelete} onOpenChange={(open) => !open && setSessionToDelete(null)}>
        <AlertDialogContent className="sm:max-w-lg p-0 gap-0" dir="rtl">
          <div className="px-5 pt-5 pb-3 border-b border-gray-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center">
                <Trash2 className="h-5 w-5 text-red-500" />
              </div>
              <div>
                <AlertDialogTitle className="text-base font-bold text-gray-900">حذف المحادثة</AlertDialogTitle>
                <AlertDialogDescription className="text-xs text-gray-400 mt-0.5">لا يمكن التراجع عن هذا الإجراء</AlertDialogDescription>
              </div>
            </div>
          </div>
          <div className="p-5">
            <p className="text-sm text-gray-600">سيتم حذف هذه المحادثة وجميع رسائلها نهائياً.</p>
          </div>
          <div className="flex gap-2 px-5 pb-5">
            <AlertDialogCancel disabled={isDeleting} className="flex-1 h-11 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50">
              إلغاء
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm} disabled={isDeleting}
              className="flex-1 h-11 rounded-xl bg-red-600 text-white text-sm font-medium hover:bg-red-700 disabled:opacity-50 flex items-center justify-center gap-2">
              {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              نعم، حذف
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
