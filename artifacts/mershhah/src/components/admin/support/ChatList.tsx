'use client';

import { useEffect, useState, useTransition } from 'react';
import { supabase } from '@/lib/supabase';
import { Skeleton } from '@/components/ui/skeleton';
import type { ChatSession } from '@/lib/types';
import { Link } from 'wouter';
import { formatDistanceToNow } from 'date-fns';
import { ar } from 'date-fns/locale';
import { MessageSquare, Search, File, ImageIcon, Trash2, Loader2 } from 'lucide-react';
import { usePathname } from '@/lib/navigation';
import { cn } from '@/lib/utils';
import { StorageImage } from '@/components/shared/StorageImage';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';

export function ChatList() {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const pathname = usePathname();
  const [sessionToDelete, setSessionToDelete] = useState<ChatSession | null>(null);
  const [isDeleting, startDeleteTransition] = useTransition();
  const { toast } = useToast();

  useEffect(() => {
    const fetchSessions = async () => {
      const { data, error } = await supabase
        .from('chats')
        .select('*')
        .order('lastMessageTimestamp', { ascending: false });
      if (!error && data) setSessions(data as ChatSession[]);
      setIsLoading(false);
    };

    fetchSessions();

    const channel = supabase
      .channel('chats-list')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chats' }, () => {
        fetchSessions();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const handleDeleteConfirm = () => {
    if (!sessionToDelete) return;
    startDeleteTransition(async () => {
      try {
        await supabase.from('chat_messages').delete().eq('chat_id', sessionToDelete.id);
        await supabase.from('chats').delete().eq('id', sessionToDelete.id);
        toast({ title: 'تم حذف المحادثة' });
      } catch (e: any) {
        toast({ title: 'خطأ', description: e.message, variant: 'destructive' });
      } finally {
        setSessionToDelete(null);
      }
    });
  };

  const getInitials = (name?: string | null) => {
    if (!name) return 'U';
    return name.split(' ').map((n) => n[0]).join('').substring(0, 2).toUpperCase();
  };

  const filteredSessions = sessions.filter((session) =>
    session.ownerName?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const renderLastMessage = (session: ChatSession) => {
    if (session.lastMessage?.startsWith('ملف:')) {
      const isImage = session.lastMessage.toLowerCase().match(/\.(jpeg|jpg|gif|png|webp)$/);
      return (
        <div className="flex items-center gap-1.5">
          {isImage ? <ImageIcon className="h-3 w-3 text-gray-300 shrink-0" /> : <File className="h-3 w-3 text-gray-300 shrink-0" />}
          <span className="text-[11px] text-gray-400 truncate">{session.lastMessage.replace('ملف:', '').trim()}</span>
        </div>
      );
    }
    return <p className="text-[11px] text-gray-400 truncate">{session.lastMessage || 'لا توجد رسائل'}</p>;
  };

  return (
    <>
      <div className="flex flex-col h-full bg-white border-r border-gray-100">
        {/* Header */}
        <div className="p-4 border-b border-gray-100">
          <h2 className="text-sm font-bold text-gray-900">صندوق الوارد</h2>
          <p className="text-[10px] text-gray-400 mt-0.5">{sessions.length} محادثة</p>
          <div className="relative mt-3">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-300" />
            <input
              placeholder="بحث..."
              className="w-full h-9 pr-8 pl-3 rounded-xl border border-gray-200 text-xs text-right placeholder:text-gray-300 focus:outline-none focus:border-gray-300"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="space-y-1 p-2">
              <Skeleton className="h-16 rounded-xl" />
              <Skeleton className="h-16 rounded-xl" />
              <Skeleton className="h-16 rounded-xl" />
            </div>
          ) : filteredSessions.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-center h-full p-4">
              <MessageSquare className="h-8 w-8 text-gray-200 mb-2" />
              <p className="text-xs text-gray-400 font-bold">لا توجد محادثات</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {filteredSessions.map((session) => {
                const isActive = pathname === `/admin/support/${session.id}`;
                const ts = session.lastMessageTimestamp;
                const tsDate = ts
                  ? typeof ts === 'string'
                    ? new Date(ts)
                    : ts.seconds
                    ? new Date(ts.seconds * 1000)
                    : new Date(ts)
                  : null;

                return (
                  <div
                    key={session.id}
                    className={cn(
                      'relative flex items-center group/item transition-colors',
                      isActive ? 'bg-gray-50' : 'hover:bg-gray-50/50'
                    )}
                  >
                    <Link href={`/admin/support/${session.id}`} className="flex-1 px-4 py-3 flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center shrink-0 overflow-hidden">
                        <StorageImage imagePath={session.ownerLogo} alt={session.ownerName || ''} fill className="object-cover" sizes="40px" />
                        <span className="text-xs font-bold text-gray-500 absolute">{getInitials(session.ownerName)}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-center">
                          <span className="text-xs font-bold text-gray-700 truncate">{session.ownerName}</span>
                          {tsDate && (
                            <span className="text-[9px] text-gray-300 whitespace-nowrap mr-2">
                              {formatDistanceToNow(tsDate, { addSuffix: true, locale: ar })}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center justify-between mt-0.5">
                          <div className="flex-1 overflow-hidden">{renderLastMessage(session)}</div>
                          {session.adminHasUnread && (
                            <span className="w-2 h-2 bg-blue-500 rounded-full shrink-0 mr-2" />
                          )}
                        </div>
                      </div>
                    </Link>
                    <button
                      onClick={() => setSessionToDelete(session)}
                      className="absolute left-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-lg flex items-center justify-center opacity-0 group-hover/item:opacity-100 hover:bg-red-50 transition-all"
                    >
                      <Trash2 className="h-3.5 w-3.5 text-red-400" />
                    </button>
                  </div>
                );
              })}
            </div>
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
    </>
  );
}
