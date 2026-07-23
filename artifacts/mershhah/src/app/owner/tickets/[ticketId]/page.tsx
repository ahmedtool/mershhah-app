'use client';

import { useEffect, useState } from 'react';
import { useParams, Link } from 'wouter';
import { useRouter } from '@/lib/navigation';
import { useUser } from '@/hooks/useUser';
import { supabase } from '@/lib/supabase';
import { formatDistanceToNow } from 'date-fns';
import { ar } from 'date-fns/locale';
import { SearchX, ArrowRight, User as UserIcon, Clock, Phone, Mail, Tag } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import type { SupportTicket } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

const statusStyles: Record<string, string> = {
  open: 'bg-blue-50 text-blue-600 border-blue-100',
  contacted: 'bg-amber-50 text-amber-600 border-amber-100',
  resolved: 'bg-emerald-50 text-emerald-600 border-emerald-100',
  closed: 'bg-gray-50 text-gray-500 border-gray-100',
};

const statusText: Record<string, string> = {
  open: 'جديدة',
  contacted: 'تم التواصل',
  resolved: 'تم الحل',
  closed: 'مغلقة',
};

const categoryStyles: Record<string, string> = {
  complaint: 'bg-red-50 text-red-600 border-red-100',
  inquiry: 'bg-blue-50 text-blue-600 border-blue-100',
  employment: 'bg-purple-50 text-purple-600 border-purple-100',
  suggestion: 'bg-amber-50 text-amber-600 border-amber-100',
  other: 'bg-gray-50 text-gray-500 border-gray-100',
};

const categoryText: Record<string, string> = {
  complaint: 'شكوى',
  inquiry: 'استفسار',
  employment: 'توظيف',
  suggestion: 'اقتراح',
  other: 'أخرى',
};

export default function TicketDetailPage() {
  const params = useParams();
  const ticketId = params.ticketId as string;
  const { user, isLoading: isUserLoading } = useUser();
  const { toast } = useToast();
  const router = useRouter();

  const [ticket, setTicket] = useState<SupportTicket | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const fetchTicket = async () => {
    if (!ticketId) { setIsLoading(false); return; }
    const { data, error } = await supabase.from('support_tickets').select('*').eq('id', ticketId).single();
    if (error || !data) {
      setNotFound(true);
    } else {
      setTicket(data as SupportTicket);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchTicket();
    const channel = supabase
      .channel(`ticket-${ticketId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'support_tickets', filter: `id=eq.${ticketId}` }, fetchTicket)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [ticketId]);

  const handleStatusChange = async (newStatus: string) => {
    const { error } = await supabase.from('support_tickets').update({ status: newStatus }).eq('id', ticketId);
    if (error) {
      toast({ title: 'خطأ', description: 'لم نتمكن من تحديث الحالة.', variant: 'destructive' });
    } else {
      toast({ title: 'تم تحديث حالة التذكرة' });
      fetchTicket();
    }
  };

  const loading = isLoading || isUserLoading;

  if (loading) return <div className="p-6"><Skeleton className="h-96 w-full rounded-2xl" /></div>;

  if (notFound || !ticket) {
    return (
      <div className="space-y-5 pb-20">
        <div className="bg-white border border-gray-100 rounded-2xl p-8 text-center">
          <div className="w-12 h-12 bg-gray-50 border border-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
            <SearchX className="h-5 w-5 text-gray-300" />
          </div>
          <p className="text-sm font-bold text-gray-900 mb-1">التذكرة غير موجودة</p>
          <p className="text-[11px] text-gray-400 mb-4">يمكن تم حذفها أو الرابط غير صحيح</p>
          <Link href="/owner/tickets"
            className="h-9 px-4 rounded-xl bg-gray-900 text-white text-xs font-bold hover:bg-gray-800 transition-colors inline-flex items-center gap-2">
            <ArrowRight className="h-3.5 w-3.5" /> العودة للتذاكر
          </Link>
        </div>
      </div>
    );
  }

  if (user?.role !== 'admin' && user?.restaurantId !== ticket.restaurant_id) {
    return (
      <div className="space-y-5 pb-20">
        <div className="bg-white border border-gray-100 rounded-2xl p-8 text-center">
          <p className="text-sm font-bold text-red-500 mb-1">غير مصرح لك بعرض هذه التذكرة</p>
          <Link href="/owner/tickets"
            className="h-9 px-4 rounded-xl bg-gray-900 text-white text-xs font-bold hover:bg-gray-800 transition-colors inline-flex items-center gap-2 mt-4">
            <ArrowRight className="h-3.5 w-3.5" /> العودة للتذاكر
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 pb-20">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Link href="/owner/tickets" className="text-[11px] text-gray-400 hover:text-gray-600 transition-colors flex items-center gap-1 mb-2">
            <ArrowRight className="h-3 w-3" /> التذاكر
          </Link>
          <h1 className="text-lg font-bold text-gray-900">{ticket.subject}</h1>
          <p className="text-[11px] text-gray-400">تذكرة من {ticket.name}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-md border", categoryStyles[ticket.category] || categoryStyles.other)}>
            {categoryText[ticket.category] || ticket.category}
          </span>
          <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-md border", statusStyles[ticket.status] || statusStyles.open)}>
            {statusText[ticket.status] || ticket.status}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">
        {/* Message */}
        <div className="lg:col-span-2 bg-white border border-gray-100 rounded-2xl p-5">
          <h3 className="text-xs font-bold text-gray-900 mb-3">محتوى التذكرة</h3>
          <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap">{ticket.message}</p>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Status Change */}
          <div className="bg-white border border-gray-100 rounded-2xl p-4">
            <h4 className="text-xs font-bold text-gray-900 mb-3">تغيير الحالة</h4>
            <div className="flex flex-wrap gap-2">
              {Object.entries(statusText).map(([key, label]) => (
                <button key={key} onClick={() => handleStatusChange(key)}
                  className={cn("h-8 px-3 rounded-lg text-[11px] font-bold border transition-all",
                    ticket.status === key ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-500 border-gray-100 hover:border-gray-200')}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Client Info */}
          <div className="bg-white border border-gray-100 rounded-2xl p-4">
            <h4 className="text-xs font-bold text-gray-900 mb-3">العميل</h4>
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-[11px] text-gray-600">
                <UserIcon className="h-3.5 w-3.5 text-gray-400" />
                <span className="font-bold">{ticket.name}</span>
              </div>
              {ticket.phone && (
                <div className="flex items-center gap-2 text-[11px] text-gray-600" dir="ltr">
                  <Phone className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                  <span className="font-mono">{ticket.phone}</span>
                </div>
              )}
              {ticket.email && (
                <div className="flex items-center gap-2 text-[11px] text-gray-600">
                  <Mail className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                  <span>{ticket.email}</span>
                </div>
              )}
            </div>
          </div>

          {/* Meta */}
          <div className="bg-white border border-gray-100 rounded-2xl p-4">
            <h4 className="text-xs font-bold text-gray-900 mb-3">التفاصيل</h4>
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-[11px] text-gray-400">
                <Tag className="h-3.5 w-3.5" />
                <span className="font-mono">{ticket.id.substring(0, 12)}</span>
              </div>
              <div className="flex items-center gap-2 text-[11px] text-gray-400">
                <Clock className="h-3.5 w-3.5" />
                <span>{ticket.created_at ? formatDistanceToNow(new Date(ticket.created_at as any), { addSuffix: true, locale: ar }) : ''}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
