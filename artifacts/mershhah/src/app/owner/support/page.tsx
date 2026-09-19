'use client';

import { Input } from '@/components/ui/input';
import { SendHorizonal, Paperclip, Loader2, FileIcon, Download, MessageSquare, Pencil, Trash2, Check, X } from 'lucide-react';
import { FormEvent, useEffect, useRef, useState } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { useUser } from '@/hooks/useUser';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabase';
import type { ChatMessage, ChatSession } from '@/lib/types';
import { sanitizeFileName } from '@/lib/utils';
import { useResolvedAttachmentUrls } from '@/hooks/useResolvedAttachmentUrls';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useLanguage } from '@/components/shared/LanguageContext';

type RealtimePayload = {
  eventType: 'INSERT' | 'UPDATE' | 'DELETE';
  new: ChatMessage;
  old: Partial<ChatMessage>;
};

// This page is deliberately a single fixed thread, not a messaging inbox:
// an owner only ever talks to one party (Mershhah admin), so there is
// exactly one `chats` row per owner - found on load, or created on the
// spot the first time this owner ever opens the page. No list, no search,
// no picking who to talk to.
export default function OwnerSupportPage() {
  const { user, isLoading: isUserLoading } = useUser();
  const { toast } = useToast();
  const { t, dir } = useLanguage();

  const [chat, setChat] = useState<ChatSession | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [message, setMessage] = useState('');
  const [isInitializing, setIsInitializing] = useState(true);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ChatMessage | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const msgChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    if (!user?.id) {
      if (!isUserLoading) setIsInitializing(false);
      return;
    }

    let cancelled = false;

    (async () => {
      setIsInitializing(true);
      setIsLoadingMessages(true);

      const { data: existing } = await supabase
        .from('chats')
        .select('*')
        .eq('ownerId', user.id)
        .order('lastMessageTimestamp', { ascending: false, nullsFirst: false })
        .limit(1)
        .maybeSingle();

      let resolvedChat = existing as ChatSession | null;

      if (!resolvedChat) {
        const chatId = crypto.randomUUID();
        const newChat: ChatSession = {
          id: chatId,
          ownerId: user.id,
          ownerName: (user as any).name || user.full_name || '',
          ownerLogo: (user as any).logo || null,
          lastMessage: undefined,
          lastMessageTimestamp: new Date().toISOString(),
          adminHasUnread: false,
          ownerHasUnread: false,
        };
        const { error } = await supabase.from('chats').insert(newChat);
        if (!error) resolvedChat = newChat;
      } else if (resolvedChat.ownerHasUnread) {
        await supabase.from('chats').update({ ownerHasUnread: false }).eq('id', resolvedChat.id);
        resolvedChat = { ...resolvedChat, ownerHasUnread: false };
      }

      if (cancelled) return;
      setChat(resolvedChat);

      if (resolvedChat) {
        const { data: msgs } = await supabase
          .from('chat_messages')
          .select('*')
          .eq('chat_id', resolvedChat.id)
          .order('timestamp', { ascending: true });
        if (!cancelled) setMessages((msgs || []) as ChatMessage[]);

        const msgChannel = supabase
          .channel(`chat-messages-${resolvedChat.id}`)
          .on('postgres_changes', {
            event: '*',
            schema: 'public',
            table: 'chat_messages',
            filter: `chat_id=eq.${resolvedChat.id}`,
          }, (payload: RealtimePayload) => {
            if (payload.eventType === 'INSERT') {
              setMessages(prev => [...prev, payload.new]);
            } else if (payload.eventType === 'UPDATE') {
              setMessages(prev => prev.map(m => m.id === payload.new.id ? payload.new : m));
            } else if (payload.eventType === 'DELETE') {
              setMessages(prev => prev.filter(m => m.id !== payload.old.id));
            }
          })
          .subscribe();
        msgChannelRef.current = msgChannel;
      }

      if (!cancelled) {
        setIsLoadingMessages(false);
        setIsInitializing(false);
      }
    })();

    return () => {
      cancelled = true;
      if (msgChannelRef.current) {
        supabase.removeChannel(msgChannelRef.current);
        msgChannelRef.current = null;
      }
    };
  }, [user?.id, isUserLoading]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const attachmentUrls = useResolvedAttachmentUrls(messages);

  const handleSendMessage = async (e: FormEvent, file?: File) => {
    e.preventDefault();
    if ((message.trim() === '' && !file) || !chat || !user) return;

    const messageText = message;
    setMessage('');
    setIsUploading(true);

    let attachmentData: Partial<ChatMessage> = {};

    try {
      if (file) {
        const filePath = `chat_attachments/${chat.id}/${Date.now()}-${sanitizeFileName(file.name)}`;
        const { error: uploadError } = await supabase.storage
          .from('chat-attachments')
          .upload(filePath, file);
        if (uploadError) throw uploadError;

        attachmentData = {
          attachment_url: filePath,
          attachment_filename: file.name,
          attachment_type: file.type.startsWith('image/') ? 'image' : 'file',
        };
      }

      const now = new Date().toISOString();

      await supabase.from('chat_messages').insert({
        id: crypto.randomUUID(),
        chat_id: chat.id,
        senderId: user.id,
        senderRole: 'owner',
        text: messageText,
        timestamp: now,
        ...attachmentData,
      });

      await supabase.from('chats').update({
        lastMessage: file ? `${t('ownerSupport.filePrefix')} ${file.name}` : messageText,
        lastMessageTimestamp: now,
        adminHasUnread: true,
        ownerHasUnread: false,
      }).eq('id', chat.id);

      setChat(prev => prev ? { ...prev, lastMessage: messageText, lastMessageTimestamp: now } : prev);
    } catch (error: any) {
      toast({ title: t('ownerSupport.errorTitle'), description: error.message, variant: 'destructive' });
    } finally {
      setIsUploading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast({ title: t('ownerSupport.fileTooLargeTitle'), description: t('ownerSupport.fileTooLargeDesc'), variant: 'destructive' });
        return;
      }
      handleSendMessage(e as any, file);
    }
    e.target.value = '';
  };

  const startEdit = (msg: ChatMessage) => {
    setEditingId(msg.id);
    setEditingText(msg.text || '');
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditingText('');
  };

  const saveEdit = async (msg: ChatMessage) => {
    const trimmed = editingText.trim();
    if (!trimmed || trimmed === msg.text) { cancelEdit(); return; }
    setIsSavingEdit(true);
    try {
      const editedAt = new Date().toISOString();
      const { error } = await supabase
        .from('chat_messages')
        .update({ text: trimmed, edited_at: editedAt })
        .eq('id', msg.id);
      if (error) throw error;
      setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, text: trimmed, edited_at: editedAt } : m));
      cancelEdit();
    } catch (error: any) {
      toast({ title: t('ownerSupport.errorTitle'), description: error.message, variant: 'destructive' });
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleDeleteMessage = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      const { error } = await supabase.from('chat_messages').delete().eq('id', deleteTarget.id);
      if (error) throw error;
      setMessages(prev => prev.filter(m => m.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (error: any) {
      toast({ title: t('ownerSupport.errorTitle'), description: error.message, variant: 'destructive' });
    } finally {
      setIsDeleting(false);
    }
  };

  if (isInitializing) {
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
        <h1 className="text-lg font-black text-gray-900">{t('ownerSupport.pageTitle')}</h1>
      </div>

      <div className="flex flex-col bg-white border border-gray-100 rounded-2xl overflow-hidden h-[calc(100vh-180px)]">
        {/* Header - always مرشح admin, no picker */}
        <div className="p-3 border-b border-gray-100 flex items-center gap-3 shrink-0">
          <div className="w-10 h-10 rounded-full bg-gray-900 flex items-center justify-center shrink-0">
            <span className="text-xs font-bold text-white">{t('ownerSupport.adminInitials')}</span>
          </div>
          <div className="flex-1">
            <p className="text-sm font-bold text-gray-900">{t('ownerSupport.admin')}</p>
            <p className="text-[10px] text-gray-600">{t('ownerSupport.liveChat')}</p>
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
              const isEditing = editingId === msg.id;
              return (
                <div key={msg.id} className={`group flex flex-col ${isOwner ? 'items-end' : 'items-start'}`}>
                  <div className={`flex items-end gap-2 w-full ${isOwner ? 'justify-end' : 'justify-start'}`}>
                    {!isOwner && (
                      <div className="w-7 h-7 rounded-full bg-gray-900 flex items-center justify-center shrink-0">
                        <span className="text-[9px] font-bold text-white">{t('ownerSupport.adminInitials')}</span>
                      </div>
                    )}
                    <div className={`p-3 text-[13px] rounded-2xl max-w-[70%] ${isOwner ? 'bg-gray-900 text-white rounded-br-md' : 'bg-gray-50 text-gray-700 border border-gray-100 rounded-bl-md'}`}>
                      {isEditing ? (
                        <div className="flex items-center gap-1.5 min-w-[180px]">
                          <input
                            autoFocus
                            value={editingText}
                            onChange={(e) => setEditingText(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') { e.preventDefault(); saveEdit(msg); }
                              if (e.key === 'Escape') cancelEdit();
                            }}
                            disabled={isSavingEdit}
                            className="flex-1 bg-white/10 text-white placeholder:text-white/50 text-[13px] rounded-lg px-2 py-1 outline-none border border-white/20"
                            dir={dir}
                          />
                          <button onClick={() => saveEdit(msg)} disabled={isSavingEdit} className="shrink-0 text-white/80 hover:text-white">
                            {isSavingEdit ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                          </button>
                          <button onClick={cancelEdit} disabled={isSavingEdit} className="shrink-0 text-white/80 hover:text-white">
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ) : (
                        <>
                          {msg.text && <p className="whitespace-pre-wrap leading-relaxed">{msg.text}</p>}
                          {msg.edited_at && (
                            <p className={`text-[9px] mt-0.5 ${isOwner ? 'text-white/50' : 'text-gray-400'}`}>{t('ownerSupport.editedLabel')}</p>
                          )}
                          {msg.attachment_url && (
                            <div className="mt-2">
                              {!attachmentUrls[msg.id] ? (
                                <div className="w-[200px] h-[200px] bg-black/10 rounded-lg animate-pulse" />
                              ) : msg.attachment_type === 'image' ? (
                                <a href={attachmentUrls[msg.id]} target="_blank" rel="noopener noreferrer">
                                  <img src={attachmentUrls[msg.id]} alt={msg.attachment_filename || ''} width={200} height={200} className="rounded-lg object-cover cursor-pointer" />
                                </a>
                              ) : (
                                <a href={attachmentUrls[msg.id]} target="_blank" rel="noopener noreferrer" className={`flex items-center gap-2 p-2 rounded-lg ${isOwner ? 'bg-white/10' : 'bg-white border border-gray-100'} hover:opacity-80 transition-opacity`}>
                                  <FileIcon className="h-4 w-4 shrink-0" />
                                  <span className="text-[11px] underline truncate">{msg.attachment_filename || t('ownerSupport.file')}</span>
                                  <Download className="h-3 w-3 shrink-0" />
                                </a>
                              )}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                  {/* Edit/delete - only on the owner's own messages, only when not mid-edit */}
                  {isOwner && !isEditing && (
                    <div className="flex items-center gap-2 mt-1 opacity-0 group-hover:opacity-100 transition-opacity pe-1">
                      {msg.text && (
                        <button onClick={() => startEdit(msg)} className="text-[10px] text-gray-500 hover:text-gray-900 flex items-center gap-1">
                          <Pencil className="h-2.5 w-2.5" /> {t('ownerSupport.editMessage')}
                        </button>
                      )}
                      <button onClick={() => setDeleteTarget(msg)} className="text-[10px] text-gray-500 hover:text-red-500 flex items-center gap-1">
                        <Trash2 className="h-2.5 w-2.5" /> {t('ownerSupport.deleteMessage')}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
            {!isLoadingMessages && messages.length === 0 && (
              <div className="text-center pt-16">
                <div className="w-12 h-12 bg-gray-50 rounded-2xl flex items-center justify-center mx-auto mb-3">
                  <MessageSquare className="h-5 w-5 text-gray-600" />
                </div>
                <p className="text-xs text-gray-600">{t('ownerSupport.startConversation')}</p>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Input */}
        <form onSubmit={handleSendMessage} className="p-3 border-t border-gray-100 flex items-center gap-2 shrink-0">
          <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*,application/pdf" className="hidden" />
          <button type="button" onClick={() => fileInputRef.current?.click()} disabled={isLoadingMessages || isUploading || !chat}
            className="w-9 h-9 rounded-xl flex items-center justify-center text-gray-600 hover:bg-gray-50 transition-colors shrink-0 disabled:opacity-30">
            {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Paperclip className="h-4 w-4" />}
          </button>
          <Input
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder={t('ownerSupport.typeYourReply')}
            className="flex-1 h-10 rounded-xl border-gray-200 text-xs"
            disabled={isLoadingMessages || isUploading || !chat}
            dir={dir}
          />
          <button type="submit" disabled={isLoadingMessages || !chat || (!message.trim() && !isUploading) || isUploading}
            className="w-10 h-10 rounded-xl bg-gray-900 text-white flex items-center justify-center hover:bg-gray-800 transition-colors shrink-0 disabled:opacity-30">
            <SendHorizonal className="h-4 w-4" />
          </button>
        </form>
      </div>

      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent dir={dir} className={dir === 'rtl' ? 'text-right' : 'text-left'}>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('ownerSupport.deleteMessage')}</AlertDialogTitle>
            <AlertDialogDescription>{t('ownerSupport.deleteMessageConfirm')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteMessage} disabled={isDeleting} className="bg-destructive hover:bg-destructive/90">
              {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : t('common.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
