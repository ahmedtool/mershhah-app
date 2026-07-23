'use client';

import { useEffect, useState, useTransition } from 'react';
import { Link } from 'wouter';
import PageHeader from "@/components/dashboard/PageHeader";
import { Skeleton } from '@/components/ui/skeleton';
import { AlertTriangle, RefreshCw, MessageSquare, User, Clock, ArrowLeft, Filter } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useUser } from '@/hooks/useUser';
import { formatDistanceToNow } from 'date-fns';
import { ar } from 'date-fns/locale';
import { supabase } from '@/lib/supabase';
import type { SupportTicket } from '@/lib/types';
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

export default function OwnerTicketsPage() {
  const { user, isLoading: isUserLoading } = useUser();
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, startRefresh] = useTransition();
  const { toast } = useToast();
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  const fetchTickets = async () => {
    if (!user?.restaurantId) return;
    const { data, error } = await supabase
      .from('support_tickets')
      .select('*')
      .eq('restaurant_id', user.restaurantId)
      .order('created_at', { ascending: false });
    if (!error) {
      const withIds = (data || []).map((t: any, i: number) => ({
        ...t,
        id: t.id || `ticket-local-${i}`,
      })) as SupportTicket[];
      setTickets(withIds);
    }
  };

  useEffect(() => {
    if (!isUserLoading && user?.restaurantId) {
      setIsLoading(true);
      fetchTickets().finally(() => setIsLoading(false));

      const channel = supabase
        .channel(`tickets-${user.restaurantId}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'support_tickets', filter: `restaurant_id=eq.${user.restaurantId}` }, fetchTickets)
        .subscribe();
      return () => { supabase.removeChannel(channel); };
    } else if (!isUserLoading) {
      setIsLoading(false);
      return;
    }
    return;
  }, [user, isUserLoading]);

  const handleRefresh = () => {
    startRefresh(async () => { await fetchTickets(); });
  };

  const filteredTickets = tickets.filter(t => {
    if (filterCategory !== 'all' && t.category !== filterCategory) return false;
    if (filterStatus !== 'all' && t.status !== filterStatus) return false;
    return true;
  });

  const isLoadingData = isLoading || isUserLoading;

  const categoryCounts = tickets.reduce((acc, t) => {
    acc[t.category] = (acc[t.category] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="space-y-5 pb-20">
      <PageHeader title="تذاكر الدعم" description="استفسارات وشكاوى عملائك.">
        <button onClick={handleRefresh} disabled={isRefreshing || isLoadingData}
          className="h-9 px-4 rounded-xl border border-gray-200 text-gray-600 text-xs font-bold hover:bg-gray-50 transition-colors disabled:opacity-50 flex items-center gap-2">
          <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing || isLoadingData ? 'animate-spin' : ''}`} />
          تحديث
        </button>
      </PageHeader>

      {/* Filters */}
      {!isLoadingData && tickets.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide pb-1">
            <button onClick={() => setFilterCategory('all')}
              className={cn("shrink-0 h-8 px-3 rounded-lg text-[11px] font-bold border transition-all",
                filterCategory === 'all' ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-500 border-gray-100 hover:border-gray-200')}>
              الكل ({tickets.length})
            </button>
            {Object.entries(categoryText).map(([key, label]) => (
              <button key={key} onClick={() => setFilterCategory(key)}
                className={cn("shrink-0 h-8 px-3 rounded-lg text-[11px] font-bold border transition-all",
                  filterCategory === key ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-500 border-gray-100 hover:border-gray-200')}>
                {label} ({categoryCounts[key] || 0})
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide pb-1">
            {Object.entries(statusText).map(([key, label]) => (
              <button key={key} onClick={() => setFilterStatus(filterStatus === key ? 'all' : key)}
                className={cn("shrink-0 h-8 px-3 rounded-lg text-[11px] font-bold border transition-all",
                  filterStatus === key ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-500 border-gray-100 hover:border-gray-200')}>
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      {isLoadingData ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {[1,2,3,4].map(i => <Skeleton key={i} className="h-40 rounded-2xl" />)}
        </div>
      ) : filteredTickets.length === 0 ? (
        <div className="bg-white border border-gray-100 rounded-2xl p-8 text-center">
          <div className="w-12 h-12 bg-gray-50 border border-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
            <AlertTriangle className="h-5 w-5 text-gray-300" />
          </div>
          <p className="text-sm font-bold text-gray-900 mb-1">{tickets.length === 0 ? 'لا توجد تذاكر' : 'لا توجد نتائج'}</p>
          <p className="text-[11px] text-gray-400">{tickets.length === 0 ? 'ستظهر التذاكر هنا عندما يتواصل معك العملاء' : 'جرّب تغيير الفلتر'}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {filteredTickets.map((ticket) => (
            <div key={ticket.id} className="bg-white border border-gray-100 rounded-2xl p-4 flex flex-col">
              {/* Header */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-md border", categoryStyles[ticket.category] || categoryStyles.other)}>
                    {categoryText[ticket.category] || ticket.category}
                  </span>
                  <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-md border", statusStyles[ticket.status] || statusStyles.open)}>
                    {statusText[ticket.status] || ticket.status}
                  </span>
                </div>
                <span className="text-[10px] text-gray-300 font-mono">{ticket.id.substring(0, 8)}</span>
              </div>

              {/* Subject */}
              <h3 className="text-sm font-bold text-gray-900 mb-2">{ticket.subject}</h3>

              {/* Meta */}
              <div className="flex items-center gap-3 mb-2 text-[10px] text-gray-400">
                <span className="flex items-center gap-1"><User className="h-3 w-3" />{ticket.name}</span>
                {ticket.phone && <span className="font-mono" dir="ltr">{ticket.phone}</span>}
                <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{ticket.created_at ? formatDistanceToNow(new Date(ticket.created_at as any), { addSuffix: true, locale: ar }) : ''}</span>
              </div>

              {/* Message */}
              <p className="text-[11px] text-gray-400 line-clamp-2 mb-3 flex-1">{ticket.message}</p>

              {/* Action */}
              <Link href={`/owner/tickets/${ticket.id}`}
                className="w-full h-9 rounded-xl bg-gray-900 text-white text-xs font-bold hover:bg-gray-800 transition-colors flex items-center justify-center gap-2">
                عرض التفاصيل
                <ArrowLeft className="h-3.5 w-3.5" />
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
