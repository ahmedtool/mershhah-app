'use client';

import { useEffect, useState, useTransition } from 'react';
import { Link } from 'wouter';
import PageHeader from "@/components/dashboard/PageHeader";
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  AlertTriangle, RefreshCw, MessageSquare, User, Clock, ArrowLeft, ArrowRight, Bot,
  Briefcase, Store, Package, Building2, Handshake, Lock, Plus, Trash2, FileText, Loader2, Inbox,
  Sparkles, Pencil,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useUser } from '@/hooks/useUser';
import { formatDistanceToNow } from 'date-fns';
import { ar } from 'date-fns/locale';
import { supabase } from '@/lib/supabase';
import { syncPublicPage } from '@/lib/public-pages';
import { GATEWAY_FIELD_DEFS, CUSTOM_TYPE_ICONS, DEFAULT_CUSTOM_TYPE_ICON, getCustomTypeIcon } from '@/lib/gateway-service-types';
import type { SupportTicket, BusinessGatewayService, JobPosting, BusinessRequest, BusinessGatewayField } from '@/lib/types';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/components/shared/LanguageContext';

type ActiveService = string;

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

// Gateway service types with a working toggle + intake flow. 'jobs' has no
// entitlement flag (always available, gated by a numeric posting limit
// instead); the rest are plan-gated — rendered as a locked upgrade-bait card
// when the flag is off, a real toggle + request list once it's on.
const GATEWAY_TYPES: Array<{ type: 'jobs' | 'franchise' | 'wholesale' | 'corporate' | 'partnership'; icon: any; titleKey: string; descKey: string; flag: 'canUseGatewayFranchise' | 'canUseGatewayWholesale' | 'canUseGatewayCorporate' | 'canUseGatewayPartnership' | null }> = [
  { type: 'jobs', icon: Briefcase, titleKey: 'ownerGateway.jobsTitle', descKey: 'ownerGateway.jobsDescription', flag: null },
  { type: 'franchise', icon: Store, titleKey: 'ownerGateway.franchiseTitle', descKey: 'ownerGateway.franchiseDescription', flag: 'canUseGatewayFranchise' },
  { type: 'wholesale', icon: Package, titleKey: 'ownerGateway.wholesaleTitle', descKey: 'ownerGateway.wholesaleDescription', flag: 'canUseGatewayWholesale' },
  { type: 'corporate', icon: Building2, titleKey: 'ownerGateway.corporateTitle', descKey: 'ownerGateway.corporateDescription', flag: 'canUseGatewayCorporate' },
  { type: 'partnership', icon: Handshake, titleKey: 'ownerGateway.partnershipTitle', descKey: 'ownerGateway.partnershipDescription', flag: 'canUseGatewayPartnership' },
];

function RequestsList({
  requests,
  fields,
  isLoading,
  onStatusChange,
  dir,
  t,
}: {
  requests: BusinessRequest[];
  fields: BusinessGatewayField[];
  isLoading: boolean;
  onStatusChange: (request: BusinessRequest, status: 'new' | 'contacted' | 'closed') => void;
  dir: 'rtl' | 'ltr';
  t: (key: string) => string;
}) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {[1, 2].map(i => <Skeleton key={i} className="h-32 rounded-2xl" />)}
      </div>
    );
  }
  if (requests.length === 0) {
    return (
      <div className="bg-white border border-gray-100 rounded-2xl p-8 text-center">
        <div className="w-12 h-12 bg-gray-50 border border-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
          <Inbox className="h-5 w-5 text-gray-600" />
        </div>
        <p className="text-sm font-bold text-gray-900">{t('ownerGateway.noRequestsYet')}</p>
      </div>
    );
  }
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
      {requests.map((request) => (
        <div key={request.id} className="bg-white border border-gray-100 rounded-2xl p-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-md border", requestStatusStyles[request.status])}>
              {t(requestStatusKeys[request.status])}
            </span>
            <span className="text-[10px] text-gray-600">
              {request.created_at ? formatDistanceToNow(new Date(request.created_at as any), { addSuffix: true, locale: dir === 'rtl' ? ar : undefined }) : ''}
            </span>
          </div>
          <p className="text-sm font-bold text-gray-900">{request.name}</p>
          <div className="flex items-center gap-3 text-[10px] text-gray-600">
            {request.phone && <span dir="ltr">{request.phone}</span>}
            {request.email && <span dir="ltr">{request.email}</span>}
          </div>
          {fields.map((field) => {
            const value = request.fields?.[field.id];
            if (!value) return null;
            return (
              <p key={field.id} className="text-[11px] text-gray-600">
                <span className="font-bold text-gray-900">{field.labelKey ? t(field.labelKey) : field.label}:</span> {value}
              </p>
            );
          })}
          <div className="flex gap-1.5 pt-1">
            {(['new', 'contacted', 'closed'] as const).map((s) => (
              <button
                key={s}
                onClick={() => onStatusChange(request, s)}
                className={cn("flex-1 h-8 rounded-lg text-[10px] font-bold border transition-colors",
                  request.status === s ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-100 hover:border-gray-200')}
              >
                {t(requestStatusKeys[s])}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function OwnerTicketsPage() {
  const { user, isLoading: isUserLoading } = useUser();
  const { t, dir } = useLanguage();
  const { toast } = useToast();
  const restaurantId = user?.restaurantId;

  const [activeService, setActiveService] = useState<ActiveService>('contact');

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
  const [isTogglingService, startTogglingService] = useTransition();

  const getService = (type: string) => gatewayServices.find(s => s.service_type === type);
  const isServiceEnabled = (type: string) => !!getService(type)?.is_enabled;
  const jobsEnabled = isServiceEnabled('jobs');

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

  const toggleService = (type: 'jobs' | 'franchise' | 'wholesale' | 'corporate' | 'partnership') => {
    if (!restaurantId) return;
    startTogglingService(async () => {
      try {
        const existing = getService(type);
        if (existing) {
          const { error } = await supabase
            .from('business_gateway_services')
            .update({ is_enabled: !existing.is_enabled, updated_at: new Date().toISOString() })
            .eq('id', existing.id);
          if (error) throw error;
        } else {
          const { error } = await supabase
            .from('business_gateway_services')
            .insert({ restaurant_id: restaurantId, service_type: type, is_enabled: true, config: {} });
          if (error) throw error;
        }
        await Promise.all([syncPublicPage(restaurantId), fetchGatewayServices()]);
      } catch (error: any) {
        toast({ title: t('ownerSettings.errorTitle'), description: error.message, variant: 'destructive' });
      }
    });
  };

  // --- Custom gateway types (owner-authored: title + icon + field list) ---
  const customTypes = gatewayServices.filter(s => s.service_type.startsWith('custom:'));
  const canUseCustomTypes = !!user?.entitlements?.canUseGatewayCustomTypes;

  const [isCustomEditorOpen, setIsCustomEditorOpen] = useState(false);
  const [editingCustomType, setEditingCustomType] = useState<BusinessGatewayService | null>(null);
  const [customDraft, setCustomDraft] = useState<{ title: string; icon: string; fields: BusinessGatewayField[] }>({ title: '', icon: DEFAULT_CUSTOM_TYPE_ICON, fields: [] });
  const [isSavingCustomType, startSavingCustomType] = useTransition();

  const openNewCustomType = () => {
    setEditingCustomType(null);
    setCustomDraft({ title: '', icon: DEFAULT_CUSTOM_TYPE_ICON, fields: [] });
    setIsCustomEditorOpen(true);
  };

  const openEditCustomType = (service: BusinessGatewayService) => {
    setEditingCustomType(service);
    setCustomDraft({
      title: service.config?.title || '',
      icon: service.config?.icon || DEFAULT_CUSTOM_TYPE_ICON,
      fields: service.config?.fields || [],
    });
    setIsCustomEditorOpen(true);
  };

  const addDraftField = () => {
    setCustomDraft(d => ({ ...d, fields: [...d.fields, { id: `f${Date.now().toString(36)}${Math.floor(Math.random() * 1000)}`, label: '', type: 'text' }] }));
  };
  const updateDraftField = (index: number, patch: Partial<BusinessGatewayField>) => {
    setCustomDraft(d => ({ ...d, fields: d.fields.map((f, i) => i === index ? { ...f, ...patch } : f) }));
  };
  const removeDraftField = (index: number) => {
    setCustomDraft(d => ({ ...d, fields: d.fields.filter((_, i) => i !== index) }));
  };
  const addFieldOption = (fieldIndex: number) => {
    setCustomDraft(d => ({ ...d, fields: d.fields.map((f, i) => i === fieldIndex ? { ...f, options: [...(f.options || []), ''] } : f) }));
  };
  const updateFieldOption = (fieldIndex: number, optionIndex: number, value: string) => {
    setCustomDraft(d => ({ ...d, fields: d.fields.map((f, i) => i === fieldIndex ? { ...f, options: (f.options || []).map((o, oi) => oi === optionIndex ? value : o) } : f) }));
  };
  const removeFieldOption = (fieldIndex: number, optionIndex: number) => {
    setCustomDraft(d => ({ ...d, fields: d.fields.map((f, i) => i === fieldIndex ? { ...f, options: (f.options || []).filter((_, oi) => oi !== optionIndex) } : f) }));
  };

  const saveCustomType = () => {
    if (!restaurantId || !customDraft.title.trim()) return;
    startSavingCustomType(async () => {
      try {
        const config = {
          title: customDraft.title.trim(),
          icon: customDraft.icon,
          fields: customDraft.fields.filter(f => (f.label || '').trim()),
        };
        if (editingCustomType) {
          const { error } = await supabase
            .from('business_gateway_services')
            .update({ config, updated_at: new Date().toISOString() })
            .eq('id', editingCustomType.id);
          if (error) throw error;
        } else {
          const slug = `${Date.now().toString(36)}${Math.floor(Math.random() * 1e4).toString(36)}`;
          const { error } = await supabase
            .from('business_gateway_services')
            .insert({ restaurant_id: restaurantId, service_type: `custom:${slug}`, is_enabled: true, config });
          if (error) throw error;
        }
        await Promise.all([syncPublicPage(restaurantId), fetchGatewayServices()]);
        setIsCustomEditorOpen(false);
      } catch (error: any) {
        toast({ title: t('ownerSettings.errorTitle'), description: error.message, variant: 'destructive' });
      }
    });
  };

  const toggleCustomType = (service: BusinessGatewayService) => {
    if (!restaurantId) return;
    startTogglingService(async () => {
      try {
        const { error } = await supabase
          .from('business_gateway_services')
          .update({ is_enabled: !service.is_enabled, updated_at: new Date().toISOString() })
          .eq('id', service.id);
        if (error) throw error;
        await Promise.all([syncPublicPage(restaurantId), fetchGatewayServices()]);
      } catch (error: any) {
        toast({ title: t('ownerSettings.errorTitle'), description: error.message, variant: 'destructive' });
      }
    });
  };

  const deleteCustomType = (service: BusinessGatewayService) => {
    if (!restaurantId) return;
    startTogglingService(async () => {
      try {
        const { error } = await supabase.from('business_gateway_services').delete().eq('id', service.id);
        if (error) throw error;
        if (activeService === service.service_type) setActiveService('contact');
        await Promise.all([syncPublicPage(restaurantId), fetchGatewayServices()]);
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

  // --- Business requests (jobs applicants + franchise/wholesale submissions) ---
  const [businessRequests, setBusinessRequests] = useState<BusinessRequest[]>([]);
  const [isLoadingRequests, setIsLoadingRequests] = useState(true);

  const fetchBusinessRequests = async () => {
    if (!restaurantId) return;
    const { data } = await supabase
      .from('business_requests')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .order('created_at', { ascending: false });
    setBusinessRequests((data || []) as BusinessRequest[]);
  };

  useEffect(() => {
    if (!isUserLoading && restaurantId) {
      setIsLoadingRequests(true);
      fetchBusinessRequests().finally(() => setIsLoadingRequests(false));
      const channel = supabase
        .channel(`business-requests-${restaurantId}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'business_requests', filter: `restaurant_id=eq.${restaurantId}` }, fetchBusinessRequests)
        .subscribe();
      return () => { supabase.removeChannel(channel); };
    } else if (!isUserLoading) {
      setIsLoadingRequests(false);
    }
    return;
  }, [restaurantId, isUserLoading]);

  const applicants = businessRequests.filter(r => r.service_type === 'jobs');
  const requestsByType = (type: string) => businessRequests.filter(r => r.service_type === type);
  const setRequestStatus = async (request: BusinessRequest, status: 'new' | 'contacted' | 'closed') => {
    await supabase.from('business_requests').update({ status }).eq('id', request.id);
    await fetchBusinessRequests();
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

            {/* Toggleable services: jobs, franchise, wholesale, corporate, partnership */}
            {GATEWAY_TYPES.map((service) => {
              const isUnlocked = !service.flag || !!user?.entitlements?.[service.flag];
              const Icon = service.icon;
              if (!isUnlocked) {
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
              }
              const enabled = isServiceEnabled(service.type);
              return (
                <div key={service.type} className={cn(
                  "text-start p-4 rounded-2xl border transition-all",
                  activeService === service.type ? 'border-gray-900 ring-1 ring-gray-900' : 'border-gray-100 bg-white'
                )}>
                  <div className="flex items-start justify-between gap-2">
                    <button onClick={() => setActiveService(service.type)} className="flex-1 min-w-0 text-start">
                      <div className="flex items-center gap-2">
                        <Icon className="h-4 w-4 shrink-0 text-gray-600" />
                        <h3 className="text-xs font-bold text-gray-900">{t(service.titleKey)}</h3>
                      </div>
                      <p className="text-[10px] text-gray-600 mt-1.5">{t(service.descKey)}</p>
                    </button>
                    <div className="flex flex-col items-center gap-1 shrink-0">
                      <Switch
                        checked={enabled}
                        onCheckedChange={() => toggleService(service.type)}
                        disabled={isTogglingService}
                        onClick={(e) => e.stopPropagation()}
                      />
                      <span className={cn("text-[9px] font-bold", enabled ? 'text-emerald-600' : 'text-gray-400')}>
                        {enabled ? t('ownerGateway.enabled') : t('ownerGateway.disabled')}
                      </span>
                    </div>
                  </div>
                  <button onClick={() => setActiveService(service.type)} className="flex items-center justify-between mt-3 w-full text-start">
                    <span className="text-[10px] font-bold text-gray-600">{requestsByType(service.type).length} {t('ownerGateway.requestsCount')}</span>
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Custom gateway types */}
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-black text-gray-900">{t('ownerGateway.customTypesTitle')}</h2>
            <p className="text-[11px] text-gray-600 mt-0.5">{t('ownerGateway.customTypesDescription')}</p>
          </div>
          {canUseCustomTypes && !isCustomEditorOpen && (
            <button
              onClick={openNewCustomType}
              className="h-9 px-3 rounded-xl bg-gray-900 text-white text-xs font-bold hover:bg-gray-800 transition-colors flex items-center gap-1.5 shrink-0"
            >
              <Plus className="h-3.5 w-3.5" />
              {t('ownerGateway.addCustomType')}
            </button>
          )}
        </div>

        {!canUseCustomTypes ? (
          <div className="p-4 rounded-2xl border border-dashed border-gray-200 bg-gray-50/50">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 shrink-0 text-gray-600" />
              <h3 className="text-xs font-bold text-gray-600">{t('ownerGateway.customTypesUpgradeTitle')}</h3>
            </div>
            <p className="text-[10px] text-gray-600 mt-1.5">{t('ownerGateway.customTypesUpgradeDescription')}</p>
            <Link
              href="/owner/billing"
              className="mt-3 flex items-center gap-1.5 text-[10px] font-bold text-gray-600 hover:text-gray-900 transition-colors"
            >
              <Lock className="h-3 w-3" />
              {t('ownerGateway.upgradeToActivateService')}
            </Link>
          </div>
        ) : (
          <>
            {isCustomEditorOpen && (
              <div className="border border-gray-100 rounded-xl p-4 space-y-3 bg-white">
                <div>
                  <label className="text-[11px] font-bold text-gray-600 mb-1.5 block">{t('ownerGateway.customTypeTitleLabel')}</label>
                  <Input
                    value={customDraft.title}
                    onChange={(e) => setCustomDraft({ ...customDraft, title: e.target.value })}
                    placeholder={t('ownerGateway.customTypeTitlePlaceholder')}
                    className="h-10 rounded-xl border-gray-200 text-xs"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-gray-600 mb-1.5 block">{t('ownerGateway.customTypeIconLabel')}</label>
                  <div className="flex flex-wrap gap-2">
                    {Object.keys(CUSTOM_TYPE_ICONS).map((name) => {
                      const IconOption = CUSTOM_TYPE_ICONS[name];
                      return (
                        <button
                          key={name}
                          type="button"
                          onClick={() => setCustomDraft({ ...customDraft, icon: name })}
                          className={cn(
                            "w-9 h-9 rounded-xl border flex items-center justify-center transition-colors",
                            customDraft.icon === name ? 'border-gray-900 bg-gray-900 text-white' : 'border-gray-200 text-gray-600 hover:border-gray-300'
                          )}
                        >
                          <IconOption className="h-4 w-4" />
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-bold text-gray-600">{t('ownerGateway.customTypeFieldsLabel')}</label>
                    <button type="button" onClick={addDraftField} className="text-[11px] font-bold text-gray-900 hover:underline flex items-center gap-1">
                      <Plus className="h-3 w-3" />
                      {t('ownerGateway.addField')}
                    </button>
                  </div>
                  {customDraft.fields.length === 0 && (
                    <p className="text-[11px] text-gray-400">{t('ownerGateway.noFieldsYet')}</p>
                  )}
                  {customDraft.fields.map((field, index) => (
                    <div key={field.id} className="border border-gray-100 rounded-lg p-3 space-y-2">
                      <div className="flex items-center gap-2">
                        <Input
                          value={field.label || ''}
                          onChange={(e) => updateDraftField(index, { label: e.target.value })}
                          placeholder={t('ownerGateway.fieldLabelPlaceholder')}
                          className="h-9 rounded-lg border-gray-200 text-xs flex-1"
                        />
                        <button type="button" onClick={() => removeDraftField(index)} className="w-8 h-8 shrink-0 rounded-lg flex items-center justify-center text-gray-600 hover:bg-red-50 hover:text-red-500 transition-colors">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <Select value={field.type} onValueChange={(v) => updateDraftField(index, { type: v as BusinessGatewayField['type'] })}>
                        <SelectTrigger className="h-9 rounded-lg border-gray-200 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="text">{t('ownerGateway.fieldTypeText')}</SelectItem>
                          <SelectItem value="textarea">{t('ownerGateway.fieldTypeTextarea')}</SelectItem>
                          <SelectItem value="number">{t('ownerGateway.fieldTypeNumber')}</SelectItem>
                          <SelectItem value="select">{t('ownerGateway.fieldTypeSelect')}</SelectItem>
                        </SelectContent>
                      </Select>
                      {field.type === 'select' && (
                        <div className="space-y-1.5">
                          {(field.options || []).map((opt, optIndex) => (
                            <div key={optIndex} className="flex items-center gap-2">
                              <Input
                                value={opt}
                                onChange={(e) => updateFieldOption(index, optIndex, e.target.value)}
                                placeholder={t('ownerGateway.optionPlaceholder')}
                                className="h-9 rounded-lg border-gray-200 text-xs flex-1"
                              />
                              <button type="button" onClick={() => removeFieldOption(index, optIndex)} className="w-8 h-8 shrink-0 rounded-lg flex items-center justify-center text-gray-600 hover:bg-red-50 hover:text-red-500 transition-colors">
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          ))}
                          <button type="button" onClick={() => addFieldOption(index)} className="text-[11px] font-bold text-gray-900 hover:underline flex items-center gap-1">
                            <Plus className="h-3 w-3" />
                            {t('ownerGateway.addOption')}
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setIsCustomEditorOpen(false)}
                    className="flex-1 h-10 rounded-xl border border-gray-200 text-xs font-bold text-gray-600 hover:bg-gray-50"
                  >
                    {t('publicShared.cancel')}
                  </button>
                  <button
                    onClick={saveCustomType}
                    disabled={isSavingCustomType || !customDraft.title.trim()}
                    className="flex-1 h-10 rounded-xl bg-gray-900 text-white text-xs font-bold hover:bg-gray-800 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {isSavingCustomType && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                    {t('common.save')}
                  </button>
                </div>
              </div>
            )}

            {customTypes.length === 0 ? (
              <p className="text-xs text-gray-600 text-center py-6 bg-white border border-gray-100 rounded-2xl">{t('ownerGateway.noCustomTypesYet')}</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {customTypes.map((service) => {
                  const Icon = getCustomTypeIcon(service.config?.icon);
                  const enabled = service.is_enabled;
                  return (
                    <div key={service.id} className={cn(
                      "text-start p-4 rounded-2xl border transition-all",
                      activeService === service.service_type ? 'border-gray-900 ring-1 ring-gray-900' : 'border-gray-100 bg-white'
                    )}>
                      <div className="flex items-start justify-between gap-2">
                        <button onClick={() => setActiveService(service.service_type)} className="flex-1 min-w-0 text-start">
                          <div className="flex items-center gap-2">
                            <Icon className="h-4 w-4 shrink-0 text-gray-600" />
                            <h3 className="text-xs font-bold text-gray-900 truncate">{service.config?.title || t('ownerGateway.untitledCustomType')}</h3>
                          </div>
                        </button>
                        <div className="flex flex-col items-center gap-1 shrink-0">
                          <Switch
                            checked={enabled}
                            onCheckedChange={() => toggleCustomType(service)}
                            disabled={isTogglingService}
                            onClick={(e) => e.stopPropagation()}
                          />
                          <span className={cn("text-[9px] font-bold", enabled ? 'text-emerald-600' : 'text-gray-400')}>
                            {enabled ? t('ownerGateway.enabled') : t('ownerGateway.disabled')}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between mt-3">
                        <button onClick={() => setActiveService(service.service_type)} className="text-[10px] font-bold text-gray-600">
                          {requestsByType(service.service_type).length} {t('ownerGateway.requestsCount')}
                        </button>
                        <div className="flex items-center gap-1">
                          <button onClick={() => openEditCustomType(service)} className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-600 hover:bg-gray-100 transition-colors">
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button onClick={() => deleteCustomType(service)} className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-600 hover:bg-red-50 hover:text-red-500 transition-colors">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
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
      ) : activeService === 'jobs' ? (
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
            {isLoadingRequests ? (
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
                          onClick={() => setRequestStatus(applicant, s)}
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
      ) : (
        <div className="space-y-3">
          <h3 className="text-sm font-bold text-gray-900">{t('ownerGateway.requestsTitle')}</h3>
          <RequestsList
            requests={requestsByType(activeService)}
            fields={activeService.startsWith('custom:') ? (customTypes.find(s => s.service_type === activeService)?.config?.fields || []) : (GATEWAY_FIELD_DEFS[activeService] || [])}
            isLoading={isLoadingRequests}
            onStatusChange={setRequestStatus}
            dir={dir}
            t={t}
          />
        </div>
      )}
    </div>
  );
}
