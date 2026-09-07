'use client';

import { useEffect, useState, useTransition } from 'react';
import { Link } from 'wouter';
import PageHeader from "@/components/dashboard/PageHeader";
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  AlertTriangle, RefreshCw, MessageSquare, User, Clock, ArrowLeft, ArrowRight, Bot,
  Briefcase, Store, Package, Building2, Handshake, Lock, Plus, Trash2, FileText, Loader2,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useUser } from '@/hooks/useUser';
import { formatDistanceToNow } from 'date-fns';
import { ar } from 'date-fns/locale';
import { supabase } from '@/lib/supabase';
import { syncPublicPage } from '@/lib/public-pages';
import type { SupportTicket, BusinessGatewayService, JobPosting, BusinessRequest } from '@/lib/types';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/components/shared/LanguageContext';

const statusStyles: Record<string, string> = {
  open: 'bg-blue-50 text-blue-600 border-blue-100',
  contacted: 'bg-amber-50 text-amber-600 border-amber-100',
  resolved: 'bg-emerald-50 text-emerald-600 border-emerald-100',
  closed: 'bg-gray-50 text-gray-600 border-gray-100',
};

const statusTextKeys: Record<string, string> = {
  open: 'ownerTickets.statusOpen',
  contacted: 'ownerTickets.statusContacted',
  resolved: 'ownerTickets.statusResolved',
  closed: 'ownerTickets.statusClosed',
};

const categoryStyles: Record<string, string> = {
  complaint: 'bg-red-50 text-red-600 border-red-100',
  inquiry: 'bg-blue-50 text-blue-600 border-blue-100',
  employment: 'bg-teal-50 text-teal-600 border-teal-100',
  suggestion: 'bg-amber-50 text-amber-600 border-amber-100',
  other: 'bg-gray-50 text-gray-600 border-gray-100',
};

const categoryTextKeys: Record<string, string> = {
  complaint: 'ownerTickets.categoryComplaint',
  inquiry: 'ownerTickets.categoryInquiry',
  employment: 'ownerTickets.categoryEmployment',
  suggestion: 'ownerTickets.categorySuggestion',
  other: 'ownerTickets.categoryOther',
};

const requestStatusStyles: Record<string, string> = {
  new: 'bg-blue-50 text-blue-600 border-blue-100',
  contacted: 'bg-amber-50 text-amber-600 border-amber-100',
  closed: 'bg-gray-50 text-gray-600 border-gray-100',
};

const requestStatusKeys: Record<string, string> = {
  new: 'ownerGateway.statusNew',
  contacted: 'ownerTickets.statusContacted',
  closed: 'ownerTickets.statusClosed',
};

// Locked (plan-gated) service types built into the gateway. Each maps to an
// entitlements flag (hooks/useUser.tsx) computed from plans.features — none
// of these have a working intake form yet, they're shown as upgrade bait.
const LOCKED_SERVICES = [
  { type: 'franchise', icon: Store, titleKey: 'ownerGateway.franchiseTitle', descKey: 'ownerGateway.franchiseDescription', flag: 'canUseGatewayFranchise' as const },
  { type: 'wholesale', icon: Package, titleKey: 'ownerGateway.wholesaleTitle', descKey: 'ownerGateway.wholesaleDescription', flag: 'canUseGatewayWholesale' as const },
  { type: 'corporate', icon: Building2, titleKey: 'ownerGateway.corporateTitle', descKey: 'ownerGateway.corporateDescription', flag: 'canUseGatewayCorporate' as const },
  { type: 'partnership', icon: Handshake, titleKey: 'ownerGateway.partnershipTitle', descKey: 'ownerGateway.partnershipDescription', flag: 'canUseGatewayPartnership' as const },
];

export default function OwnerTicketsPage() {
  const { user, isLoading: isUserLoading } = useUser();
  const { t, dir } = useLanguage();
  const { toast } = useToast();
  const restaurantId = user?.restaurantId;

  const [activeService, setActiveService] = useState<'contact' | 'jobs'>('contact');

  // --- Contact tickets (existing, unchanged behavior) ---
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, startRefresh] = useTransition();
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  const fetchTickets = async () => {
    if (!restaurantId) return;
    const { data, error } = await supabase
      .from('support_tickets')
      .select('*')
      .eq('restaurant_id', restaurantId)
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
    if (!isUserLoading && restaurantId) {
      setIsLoading(true);
      fetchTickets().finally(() => setIsLoading(false));

      const channel = supabase
        .channel(`tickets-${restaurantId}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'support_tickets', filter: `restaurant_id=eq.${restaurantId}` }, fetchTickets)
        .subscribe();
      return () => { supabase.removeChannel(channel); };
    } else if (!isUserLoading) {
      setIsLoading(false);
      return;
    }
    return;
  }, [restaurantId, isUserLoading]);

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

  // --- Gateway services (which channels are turned on) ---
  const [gatewayServices, setGatewayServices] = useState<BusinessGatewayService[]>([]);
  const [isLoadingGateway, setIsLoadingGateway] = useState(true);
  const [isTogglingJobs, startTogglingJobs] = useTransition();

  const jobsService = gatewayServices.find(s => s.service_type === 'jobs');
  const jobsEnabled = !!jobsService?.is_enabled;

  const fetchGatewayServices = async () => {
    if (!restaurantId) return;
    const { data } = await supabase
      .from('business_gateway_services')
      .select('*')
      .eq('restaurant_id', restaurantId);
    setGatewayServices((data || []) as BusinessGatewayService[]);
  };

  useEffect(() => {
    if (!isUserLoading && restaurantId) {
      setIsLoadingGateway(true);
      fetchGatewayServices().finally(() => setIsLoadingGateway(false));
      const channel = supabase
        .channel(`gateway-services-${restaurantId}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'business_gateway_services', filter: `restaurant_id=eq.${restaurantId}` }, fetchGatewayServices)
        .subscribe();
      return () => { supabase.removeChannel(channel); };
    } else if (!isUserLoading) {
      setIsLoadingGateway(false);
    }
    return;
  }, [restaurantId, isUserLoading]);

  const toggleJobs = () => {
    if (!restaurantId) return;
    startTogglingJobs(async () => {
      try {
        if (jobsService) {
          const { error } = await supabase
            .from('business_gateway_services')
            .update({ is_enabled: !jobsEnabled, updated_at: new Date().toISOString() })
            .eq('id', jobsService.id);
          if (error) throw error;
        } else {
          const { error } = await supabase
            .from('business_gateway_services')
            .insert({ restaurant_id: restaurantId, service_type: 'jobs', is_enabled: true, config: {} });
          if (error) throw error;
        }
        await syncPublicPage(restaurantId);
        await fetchGatewayServices();
      } catch (error: any) {
        toast({ title: t('ownerSettings.errorTitle'), description: error.message, variant: 'destructive' });
      }
    });
  };

  // --- Job postings ---
  const [jobPostings, setJobPostings] = useState<JobPosting[]>([]);
  const [isLoadingPostings, setIsLoadingPostings] = useState(true);
  const [isAddingPosting, setIsAddingPosting] = useState(false);
  const [isSavingPosting, startSavingPosting] = useTransition();
  const [newPosting, setNewPosting] = useState({ title: '', location: '', employment_type: 'full_time' as 'full_time' | 'part_time', description: '' });

  const fetchJobPostings = async () => {
    if (!restaurantId) return;
    const { data } = await supabase
      .from('job_postings')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .order('created_at', { ascending: false });
    setJobPostings((data || []) as JobPosting[]);
  };

  useEffect(() => {
    if (!isUserLoading && restaurantId) {
      setIsLoadingPostings(true);
      fetchJobPostings().finally(() => setIsLoadingPostings(false));
      const channel = supabase
        .channel(`job-postings-${restaurantId}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'job_postings', filter: `restaurant_id=eq.${restaurantId}` }, fetchJobPostings)
        .subscribe();
      return () => { supabase.removeChannel(channel); };
    } else if (!isUserLoading) {
      setIsLoadingPostings(false);
    }
    return;
  }, [restaurantId, isUserLoading]);

  const activePostingsCount = jobPostings.filter(p => p.is_active).length;
  const maxJobPostings = user?.entitlements?.maxJobPostings ?? 1;
  const atPostingLimit = maxJobPostings !== Number.MAX_SAFE_INTEGER && activePostingsCount >= maxJobPostings;

  const handleAddPosting = () => {
    if (!restaurantId || !newPosting.title.trim()) return;
    if (atPostingLimit) {
      toast({ title: t('ownerGateway.jobLimitReachedTitle'), description: t('ownerGateway.jobLimitReachedDesc'), variant: 'destructive' });
      return;
    }
    startSavingPosting(async () => {
      try {
        const { error } = await supabase.from('job_postings').insert({
          restaurant_id: restaurantId,
          title: newPosting.title.trim(),
          location: newPosting.location.trim() || null,
          employment_type: newPosting.employment_type,
          description: newPosting.description.trim() || null,
          is_active: true,
        });
        if (error) throw error;
        await Promise.all([syncPublicPage(restaurantId), fetchJobPostings()]);
        setNewPosting({ title: '', location: '', employment_type: 'full_time', description: '' });
        setIsAddingPosting(false);
      } catch (error: any) {
        toast({ title: t('ownerSettings.errorTitle'), description: error.message, variant: 'destructive' });
      }
    });
  };

  const togglePostingActive = async (posting: JobPosting) => {
    if (!restaurantId) return;
    await supabase.from('job_postings').update({ is_active: !posting.is_active }).eq('id', posting.id);
    await Promise.all([syncPublicPage(restaurantId), fetchJobPostings()]);
  };

  const deletePosting = async (posting: JobPosting) => {
    if (!restaurantId) return;
    await supabase.from('job_postings').delete().eq('id', posting.id);
    await Promise.all([syncPublicPage(restaurantId), fetchJobPostings()]);
  };

  // --- Job applicants (business_requests where service_type = 'jobs') ---
  const [applicants, setApplicants] = useState<BusinessRequest[]>([]);
  const [isLoadingApplicants, setIsLoadingApplicants] = useState(true);

  const fetchApplicants = async () => {
    if (!restaurantId) return;
    const { data } = await supabase
      .from('business_requests')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .eq('service_type', 'jobs')
      .order('created_at', { ascending: false });
    setApplicants((data || []) as BusinessRequest[]);
  };

  useEffect(() => {
    if (!isUserLoading && restaurantId) {
      setIsLoadingApplicants(true);
      fetchApplicants().finally(() => setIsLoadingApplicants(false));
      const channel = supabase
        .channel(`job-applicants-${restaurantId}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'business_requests', filter: `restaurant_id=eq.${restaurantId}` }, fetchApplicants)
        .subscribe();
      return () => { supabase.removeChannel(channel); };
    } else if (!isUserLoading) {
      setIsLoadingApplicants(false);
    }
    return;
  }, [restaurantId, isUserLoading]);

  const setApplicantStatus = async (applicant: BusinessRequest, status: 'new' | 'contacted' | 'closed') => {
    await supabase.from('business_requests').update({ status }).eq('id', applicant.id);
    await fetchApplicants();
  };

  const postingTitleById = (id?: string | null) => jobPostings.find(p => p.id === id)?.title;

  return (
    <div className="space-y-5 pb-20">
      <PageHeader title={t('ownerTickets.pageTitle')} description={t('ownerTickets.pageDescription')} />

      {/* Gateway services */}
      <div className="space-y-3">
        <div>
          <h2 className="text-sm font-black text-gray-900">{t('ownerGateway.sectionTitle')}</h2>
          <p className="text-[11px] text-gray-600 mt-0.5">{t('ownerGateway.sectionDescription')}</p>
        </div>

        {isLoadingGateway ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-28 rounded-2xl" />)}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {/* Contact - always on */}
            <button
              onClick={() => setActiveService('contact')}
              className={cn(
                "text-start p-4 rounded-2xl border transition-all",
                activeService === 'contact' ? 'border-gray-900 bg-gray-900 text-white' : 'border-gray-100 bg-white hover:border-gray-200'
              )}
            >
              <div className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4 shrink-0" />
                <h3 className="text-xs font-bold">{t('ownerGateway.contactTitle')}</h3>
              </div>
              <p className={cn("text-[10px] mt-1.5", activeService === 'contact' ? 'text-white/70' : 'text-gray-600')}>{t('ownerGateway.contactDescription')}</p>
              <div className="flex items-center justify-between mt-3">
                <span className={cn("text-[9px] font-bold px-2 py-0.5 rounded-full", activeService === 'contact' ? 'bg-white/20' : 'bg-emerald-50 text-emerald-600')}>{t('ownerGateway.alwaysOn')}</span>
                <span className={cn("text-[10px] font-bold", activeService === 'contact' ? 'text-white/70' : 'text-gray-600')}>{tickets.length} {t('ownerGateway.requestsCount')}</span>
              </div>
            </button>

            {/* Jobs - toggleable */}
            <div className={cn(
              "text-start p-4 rounded-2xl border transition-all",
              activeService === 'jobs' ? 'border-gray-900 ring-1 ring-gray-900' : 'border-gray-100 bg-white'
            )}>
              <button onClick={() => setActiveService('jobs')} className="w-full text-start">
                <div className="flex items-center gap-2">
                  <Briefcase className="h-4 w-4 shrink-0 text-gray-600" />
                  <h3 className="text-xs font-bold text-gray-900">{t('ownerGateway.jobsTitle')}</h3>
                </div>
                <p className="text-[10px] text-gray-600 mt-1.5">{t('ownerGateway.jobsDescription')}</p>
              </button>
              <div className="flex items-center justify-between mt-3">
                <button
                  onClick={toggleJobs}
                  disabled={isTogglingJobs}
                  className={cn(
                    "text-[9px] font-bold px-2 py-0.5 rounded-full transition-colors disabled:opacity-50",
                    jobsEnabled ? 'bg-emerald-50 text-emerald-600' : 'bg-gray-100 text-gray-600'
                  )}
                >
                  {jobsEnabled ? t('ownerGateway.enabled') : t('ownerGateway.disabled')}
                </button>
                <span className="text-[10px] font-bold text-gray-600">{applicants.length} {t('ownerGateway.requestsCount')}</span>
              </div>
            </div>

            {/* Locked, plan-gated services */}
            {LOCKED_SERVICES.map((service) => {
              const Icon = service.icon;
              const isUnlocked = !!user?.entitlements?.[service.flag];
              if (isUnlocked) return null; // not built yet even when unlocked - out of scope for this phase
              return (
                <div key={service.type} className="p-4 rounded-2xl border border-dashed border-gray-200 bg-gray-50/50">
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4 shrink-0 text-gray-600" />
                    <h3 className="text-xs font-bold text-gray-600">{t(service.titleKey)}</h3>
                  </div>
                  <p className="text-[10px] text-gray-600 mt-1.5">{t(service.descKey)}</p>
                  <Link
                    href="/owner/billing"
                    className="mt-3 flex items-center gap-1.5 text-[10px] font-bold text-gray-600 hover:text-gray-900 transition-colors"
                  >
                    <Lock className="h-3 w-3" />
                    {t('ownerGateway.upgradeToActivateService')}
                  </Link>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {activeService === 'contact' ? (
        <div className="space-y-5">
          <div className="flex justify-end">
            <button onClick={handleRefresh} disabled={isRefreshing || isLoadingData}
              className="h-9 px-4 rounded-xl border border-gray-200 text-gray-600 text-xs font-bold hover:bg-gray-50 transition-colors disabled:opacity-50 flex items-center gap-2">
              <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing || isLoadingData ? 'animate-spin' : ''}`} />
              {t('ownerTickets.refresh')}
            </button>
          </div>

          {/* Filters */}
          {!isLoadingData && tickets.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide pb-1 [mask-image:linear-gradient(to_right,transparent,black_16px,black_calc(100%-16px),transparent)]">
                <button onClick={() => setFilterCategory('all')}
                  className={cn("shrink-0 h-8 px-3 rounded-lg text-[11px] font-bold border transition-all",
                    filterCategory === 'all' ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-100 hover:border-gray-200')}>
                  {t('ownerTickets.all')} ({tickets.length})
                </button>
                {Object.entries(categoryTextKeys).map(([key, labelKey]) => (
                  <button key={key} onClick={() => setFilterCategory(key)}
                    className={cn("shrink-0 h-8 px-3 rounded-lg text-[11px] font-bold border transition-all",
                      filterCategory === key ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-100 hover:border-gray-200')}>
                    {t(labelKey)} ({categoryCounts[key] || 0})
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide pb-1 [mask-image:linear-gradient(to_right,transparent,black_16px,black_calc(100%-16px),transparent)]">
                {Object.entries(statusTextKeys).map(([key, labelKey]) => (
                  <button key={key} onClick={() => setFilterStatus(filterStatus === key ? 'all' : key)}
                    className={cn("shrink-0 h-8 px-3 rounded-lg text-[11px] font-bold border transition-all",
                      filterStatus === key ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-100 hover:border-gray-200')}>
                    {t(labelKey)}
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
                <AlertTriangle className="h-5 w-5 text-gray-600" />
              </div>
              <p className="text-sm font-bold text-gray-900 mb-1">{tickets.length === 0 ? t('ownerTickets.noTickets') : t('ownerTickets.noResults')}</p>
              <p className="text-[11px] text-gray-600">{tickets.length === 0 ? t('ownerTickets.noTicketsDesc') : t('ownerTickets.tryDifferentFilter')}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {filteredTickets.map((ticket) => (
                <div key={ticket.id} className="bg-white border border-gray-100 rounded-2xl p-4 flex flex-col">
                  {/* Header */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-md border", categoryStyles[ticket.category] || categoryStyles.other)}>
                        {categoryTextKeys[ticket.category] ? t(categoryTextKeys[ticket.category]) : ticket.category}
                      </span>
                      <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-md border", statusStyles[ticket.status] || statusStyles.open)}>
                        {statusTextKeys[ticket.status] ? t(statusTextKeys[ticket.status]) : ticket.status}
                      </span>
                      {ticket.source === 'ai_assistant' && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md border bg-violet-50 text-violet-600 border-violet-100 flex items-center gap-1">
                          <Bot className="h-2.5 w-2.5" />
                          {t('ownerTickets.aiAssistant')}
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] text-gray-600 font-mono">{ticket.id.substring(0, 8)}</span>
                  </div>

                  {/* Subject */}
                  <h3 className="text-sm font-bold text-gray-900 mb-2">{ticket.subject}</h3>

                  {/* Meta */}
                  <div className="flex items-center gap-3 mb-2 text-[10px] text-gray-600">
                    <span className="flex items-center gap-1"><User className="h-3 w-3" />{ticket.name}</span>
                    {ticket.phone && <span className="font-mono" dir="ltr">{ticket.phone}</span>}
                    <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{ticket.created_at ? formatDistanceToNow(new Date(ticket.created_at as any), { addSuffix: true, locale: dir === 'rtl' ? ar : undefined }) : ''}</span>
                  </div>

                  {/* Message */}
                  <p className="text-[11px] text-gray-600 line-clamp-2 mb-3 flex-1">{ticket.message}</p>

                  {/* Action */}
                  <Link href={`/owner/tickets/${ticket.id}`}
                    className="w-full h-9 rounded-xl bg-gray-900 text-white text-xs font-bold hover:bg-gray-800 transition-colors flex items-center justify-center gap-2">
                    {t('ownerTickets.viewDetails')}
                    {dir === 'rtl' ? <ArrowLeft className="h-3.5 w-3.5" /> : <ArrowRight className="h-3.5 w-3.5" />}
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-5">
          {/* Postings management */}
          <div className="bg-white border border-gray-100 rounded-2xl p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-gray-900">{t('ownerGateway.managePostings')}</h3>
              {!isAddingPosting && (
                <button
                  onClick={() => setIsAddingPosting(true)}
                  disabled={!jobsEnabled}
                  className="h-9 px-3 rounded-xl bg-gray-900 text-white text-xs font-bold hover:bg-gray-800 transition-colors disabled:opacity-40 flex items-center gap-1.5"
                >
                  <Plus className="h-3.5 w-3.5" />
                  {t('ownerGateway.addPosting')}
                </button>
              )}
            </div>

            {isAddingPosting && (
              <div className="border border-gray-100 rounded-xl p-4 space-y-3">
                <div>
                  <label className="text-[11px] font-bold text-gray-600 mb-1.5 block">{t('ownerGateway.postingTitleLabel')}</label>
                  <Input
                    value={newPosting.title}
                    onChange={(e) => setNewPosting({ ...newPosting, title: e.target.value })}
                    placeholder={t('ownerGateway.postingTitlePlaceholder')}
                    className="h-10 rounded-xl border-gray-200 text-xs"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-gray-600 mb-1.5 block">{t('ownerGateway.postingLocationLabel')}</label>
                  <Input
                    value={newPosting.location}
                    onChange={(e) => setNewPosting({ ...newPosting, location: e.target.value })}
                    placeholder={t('ownerGateway.postingLocationPlaceholder')}
                    className="h-10 rounded-xl border-gray-200 text-xs"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-gray-600 mb-1.5 block">{t('ownerGateway.employmentTypeLabel')}</label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setNewPosting({ ...newPosting, employment_type: 'full_time' })}
                      className={cn("flex-1 h-9 rounded-lg text-xs font-bold border transition-colors",
                        newPosting.employment_type === 'full_time' ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-200')}
                    >
                      {t('ownerGateway.employmentFullTime')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setNewPosting({ ...newPosting, employment_type: 'part_time' })}
                      className={cn("flex-1 h-9 rounded-lg text-xs font-bold border transition-colors",
                        newPosting.employment_type === 'part_time' ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-200')}
                    >
                      {t('ownerGateway.employmentPartTime')}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="text-[11px] font-bold text-gray-600 mb-1.5 block">{t('ownerGateway.postingDescriptionLabel')}</label>
                  <Textarea
                    value={newPosting.description}
                    onChange={(e) => setNewPosting({ ...newPosting, description: e.target.value })}
                    placeholder={t('ownerGateway.postingDescriptionPlaceholder')}
                    className="rounded-xl border-gray-200 text-xs min-h-[80px] resize-none"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setIsAddingPosting(false)}
                    className="flex-1 h-10 rounded-xl border border-gray-200 text-xs font-bold text-gray-600 hover:bg-gray-50"
                  >
                    {t('publicShared.cancel')}
                  </button>
                  <button
                    onClick={handleAddPosting}
                    disabled={isSavingPosting || !newPosting.title.trim()}
                    className="flex-1 h-10 rounded-xl bg-gray-900 text-white text-xs font-bold hover:bg-gray-800 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {isSavingPosting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                    {t('common.save')}
                  </button>
                </div>
              </div>
            )}

            {isLoadingPostings ? (
              <Skeleton className="h-20 rounded-xl" />
            ) : jobPostings.length === 0 ? (
              <p className="text-xs text-gray-600 text-center py-6">{t('ownerGateway.noPostingsYet')}</p>
            ) : (
              <div className="space-y-2">
                {jobPostings.map((posting) => (
                  <div key={posting.id} className="flex items-center gap-3 p-3 border border-gray-100 rounded-xl">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-gray-900 truncate">{posting.title}</p>
                      <p className="text-[10px] text-gray-600 truncate">
                        {[posting.location, posting.employment_type === 'full_time' ? t('ownerGateway.employmentFullTime') : posting.employment_type === 'part_time' ? t('ownerGateway.employmentPartTime') : null].filter(Boolean).join(' · ')}
                      </p>
                    </div>
                    <button
                      onClick={() => togglePostingActive(posting)}
                      className={cn("text-[9px] font-bold px-2 py-0.5 rounded-full shrink-0",
                        posting.is_active ? 'bg-emerald-50 text-emerald-600' : 'bg-gray-100 text-gray-600')}
                    >
                      {posting.is_active ? t('ownerGateway.postingActive') : t('ownerGateway.postingInactive')}
                    </button>
                    <button onClick={() => deletePosting(posting)} className="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-gray-600 hover:bg-red-50 hover:text-red-500 transition-colors">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Applicants */}
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-gray-900">{t('ownerGateway.applicantsTitle')}</h3>
            {isLoadingApplicants ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                {[1, 2].map(i => <Skeleton key={i} className="h-32 rounded-2xl" />)}
              </div>
            ) : applicants.length === 0 ? (
              <div className="bg-white border border-gray-100 rounded-2xl p-8 text-center">
                <div className="w-12 h-12 bg-gray-50 border border-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
                  <Briefcase className="h-5 w-5 text-gray-600" />
                </div>
                <p className="text-sm font-bold text-gray-900">{t('ownerGateway.noApplicantsYet')}</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                {applicants.map((applicant) => (
                  <div key={applicant.id} className="bg-white border border-gray-100 rounded-2xl p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-md border", requestStatusStyles[applicant.status])}>
                        {t(requestStatusKeys[applicant.status])}
                      </span>
                      <span className="text-[10px] text-gray-600">
                        {applicant.created_at ? formatDistanceToNow(new Date(applicant.created_at as any), { addSuffix: true, locale: dir === 'rtl' ? ar : undefined }) : ''}
                      </span>
                    </div>
                    <p className="text-sm font-bold text-gray-900">{applicant.name}</p>
                    {postingTitleById(applicant.job_posting_id) && (
                      <p className="text-[11px] text-gray-600">{t('ownerGateway.appliedFor')}: {postingTitleById(applicant.job_posting_id)}</p>
                    )}
                    <div className="flex items-center gap-3 text-[10px] text-gray-600">
                      {applicant.phone && <span dir="ltr">{applicant.phone}</span>}
                      {applicant.email && <span dir="ltr">{applicant.email}</span>}
                    </div>
                    {applicant.fields?.cv_url && (
                      <a href={applicant.fields.cv_url} target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-[11px] font-bold text-gray-900 hover:underline">
                        <FileText className="h-3.5 w-3.5" />
                        {t('ownerGateway.viewCv')}
                      </a>
                    )}
                    <div className="flex gap-1.5 pt-1">
                      {(['new', 'contacted', 'closed'] as const).map((s) => (
                        <button
                          key={s}
                          onClick={() => setApplicantStatus(applicant, s)}
                          className={cn("flex-1 h-8 rounded-lg text-[10px] font-bold border transition-colors",
                            applicant.status === s ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-100 hover:border-gray-200')}
                        >
                          {t(requestStatusKeys[s])}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
