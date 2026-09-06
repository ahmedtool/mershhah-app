'use client';

import { useState, useEffect } from 'react';
import PageHeader from "@/components/dashboard/PageHeader";
import { Input } from "@/components/ui/input";
import {
    Search,
    Check,
    Clock,
    Box,
    Loader2,
    icons,
    Star,
    Lock,
    Sparkles,
    SlidersHorizontal,
    ChevronDown,
} from 'lucide-react';
import { Link } from 'wouter';
import { useToast } from "@/hooks/use-toast";
import { getTools } from '@/services/restaurant.service';
import { Skeleton } from '@/components/ui/skeleton';
import { useUser } from '@/hooks/useUser';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import { toolGradient } from '@/lib/tool-gradient';
import { ToolDetailModal } from '@/components/store/ToolDetailModal';
import { StorageImage } from '@/components/shared/StorageImage';
import { isUnlimitedAccount } from '@/lib/unlimited-account';
import { useLanguage } from '@/components/shared/LanguageContext';

const iconMap: { [key: string]: React.ElementType } = { ...icons, Box };

const TABS = [
    { value: 'all', labelKey: 'toolsStore.tabAll' },
    { value: 'marketing', labelKey: 'toolsStore.tabMarketing' },
    { value: 'operations', labelKey: 'toolsStore.tabOperations' },
    { value: 'analytics', labelKey: 'toolsStore.tabAnalytics' },
];

const SORTS = [
    { value: 'relevance', labelKey: 'toolsStore.sortRelevance' },
    { value: 'price_asc', labelKey: 'toolsStore.sortPriceAsc' },
    { value: 'price_desc', labelKey: 'toolsStore.sortPriceDesc' },
    { value: 'installs', labelKey: 'toolsStore.sortInstalls' },
];

// The tool's own screenshots/logo, used as real imagery behind its icon in
// cards and banners — falls back to the brand-color gradient only when the
// admin hasn't uploaded anything yet, never a fabricated stock photo.
function coverImageOf(tool: any): string | null {
  if (Array.isArray(tool.screenshots) && tool.screenshots.length > 0) return tool.screenshots[0];
  return tool.image_path || null;
}

function SortDropdown({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { t, dir } = useLanguage();
  const [open, setOpen] = useState(false);
  const current = t(SORTS.find((s) => s.value === value)?.labelKey || SORTS[0].labelKey);
  const alignStart = dir === 'rtl' ? 'text-right' : 'text-left';
  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="h-9 px-4 rounded-full bg-gray-100/80 text-gray-600 text-[12px] font-bold flex items-center gap-1.5 hover:bg-gray-200/70 transition-colors"
      >
        <SlidersHorizontal className="h-3.5 w-3.5" />
        {current}
        <ChevronDown className={cn("h-3 w-3 transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute start-0 top-11 z-20 bg-white border border-gray-100 rounded-2xl shadow-lg p-1.5 w-44">
            {SORTS.map((s) => (
              <button
                key={s.value}
                onClick={() => { onChange(s.value); setOpen(false); }}
                className={cn(
                  "w-full px-3 py-2 rounded-xl text-[12px] font-bold transition-colors",
                  alignStart,
                  value === s.value ? "bg-gray-900 text-white" : "text-gray-600 hover:bg-gray-50"
                )}
              >
                {t(s.labelKey)}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function IconTile({ tool, size = 'md', ring = 'thin' }: { tool: any; size?: 'md' | 'lg'; ring?: 'thin' | 'white' }) {
  const Icon = tool.icon;
  const dims = size === 'lg' ? 'w-16 h-16 rounded-[22px]' : 'w-14 h-14 rounded-[18px]';
  const iconDims = size === 'lg' ? 'h-8 w-8' : 'h-7 w-7';
  const ringClass = ring === 'white' ? 'ring-4 ring-white' : 'ring-1 ring-black/[0.03]';

  // A custom uploaded logo (tools.image_path) replaces the Lucide icon
  // wherever the tool's identity is shown — that's the whole point of it.
  if (tool.image_path) {
    return (
      <div className={cn(dims, "shrink-0 overflow-hidden shadow-sm bg-gray-50", ringClass)}>
        <StorageImage imagePath={tool.image_path} alt={tool.title} className="w-full h-full object-cover" />
      </div>
    );
  }

  return (
    <div className={cn(dims, "shrink-0 flex items-center justify-center shadow-sm", ringClass, tool.bg_color)}>
      <Icon className={cn(iconDims, tool.color)} strokeWidth={2} />
    </div>
  );
}

function ActionPill({ tool, installing, hasPaidPlan, onActivate }: {
  tool: any; installing: string | null; hasPaidPlan: boolean; onActivate: (tool: any) => void;
}) {
  const { t } = useLanguage();
  const isBusy = installing === tool.id;
  const base = "shrink-0 h-8 min-w-[76px] px-4 rounded-full text-[11px] font-bold flex items-center justify-center gap-1.5 transition-colors";

  if (tool.installed) {
    return (
      <span className={cn(base, "bg-emerald-50 text-emerald-600")}>
        <Check className="h-3 w-3" /> {t('toolsStore.installed')}
      </span>
    );
  }

  if (tool.type === 'paid' && (tool.billing_type || 'plan') === 'plan' && !hasPaidPlan) {
    return (
      <Link href="/owner/billing" className={cn(base, "bg-gray-100 text-gray-600 hover:bg-gray-200")}>
        <Lock className="h-3 w-3" /> {t('toolsStore.upgrade')}
      </Link>
    );
  }

  const label = tool.type === 'paid' && tool.billing_type === 'addon' ? tool.price_label : t('toolsStore.activate');

  return (
    <button
      onClick={() => onActivate(tool)}
      disabled={!!installing}
      className={cn(base, "bg-gray-900 text-white hover:bg-gray-800 disabled:opacity-50")}
    >
      {isBusy ? <Loader2 className="h-3 w-3 animate-spin" /> : label}
    </button>
  );
}

function ToolCard({ tool, installing, hasPaidPlan, onActivate, onOpenDetail, categoryLabel }: {
  tool: any; installing: string | null; hasPaidPlan: boolean; onActivate: (tool: any) => void; onOpenDetail: (tool: any) => void; categoryLabel: string;
}) {
  const { t } = useLanguage();
  const cover = coverImageOf(tool);
  return (
    <div
      onClick={() => onOpenDetail(tool)}
      className="group bg-white border border-gray-100 rounded-[26px] overflow-hidden flex flex-col hover:shadow-[0_8px_24px_-8px_rgba(0,0,0,0.08)] hover:border-gray-200 transition-all duration-300 cursor-pointer"
    >
      {/* Cover band — the tool's own screenshot/logo when available, its
          brand-color gradient otherwise. Never a stock/fabricated image. */}
      <div className="h-[84px] relative" style={cover ? undefined : { background: toolGradient(tool) }}>
        {cover && (
          <>
            <StorageImage imagePath={cover} alt="" className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-black/10" />
          </>
        )}
      </div>

      <div className="px-5 pb-5 -mt-7 relative z-10">
        <div className="flex items-end justify-between gap-3 mb-3">
          <IconTile tool={tool} ring="white" />
          <div onClick={(e) => e.stopPropagation()} className="mb-0.5">
            <ActionPill tool={tool} installing={installing} hasPaidPlan={hasPaidPlan} onActivate={onActivate} />
          </div>
        </div>
        <h3 className="text-[14px] font-bold text-gray-900">{tool.title}</h3>
        <p className="text-[10.5px] text-gray-600 mt-0.5 flex items-center gap-1">
          {categoryLabel}
          {tool.popular && (
            <span className="inline-flex items-center gap-0.5 text-amber-500 font-bold">
              · <Star className="h-2.5 w-2.5 fill-amber-400 text-amber-400" /> {t('toolsStore.popular')}
            </span>
          )}
        </p>
        <p className="text-[11.5px] text-gray-600 leading-relaxed mt-2 line-clamp-2">{tool.description}</p>
      </div>
    </div>
  );
}

function FeaturedCard({ tool, installing, hasPaidPlan, onActivate, onOpenDetail }: {
  tool: any; installing: string | null; hasPaidPlan: boolean; onActivate: (tool: any) => void; onOpenDetail: (tool: any) => void;
}) {
  const Icon = tool.icon;
  const cover = coverImageOf(tool);
  return (
    <div
      onClick={() => onOpenDetail(tool)}
      className="snap-start shrink-0 w-[260px] sm:w-[300px] rounded-[28px] p-6 relative overflow-hidden flex flex-col justify-between min-h-[220px] cursor-pointer"
      style={cover ? undefined : { background: toolGradient(tool) }}
    >
      {/* A real screenshot fills the whole banner, like Apple's editorial
          cards — falls back to the brand gradient when none is uploaded. */}
      {cover ? (
        <>
          <StorageImage imagePath={cover} alt="" className="absolute inset-0 w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-black/10" />
        </>
      ) : (
        <Icon className="absolute -left-6 -bottom-6 h-32 w-32 text-white/10" strokeWidth={1.5} />
      )}
      <div className="relative z-10">
        {tool.image_path ? (
          <div className="w-14 h-14 rounded-[18px] overflow-hidden mb-4 ring-2 ring-white/30 bg-white/20">
            <StorageImage imagePath={tool.image_path} alt={tool.title} className="w-full h-full object-cover" />
          </div>
        ) : (
          <div className="w-14 h-14 rounded-[18px] bg-white/20 backdrop-blur-sm flex items-center justify-center mb-4">
            <Icon className="h-7 w-7 text-white" strokeWidth={2} />
          </div>
        )}
        <h3 className="text-white text-base font-black">{tool.title}</h3>
        <p className="text-white/80 text-[11px] leading-relaxed mt-1.5 line-clamp-2">{tool.description}</p>
      </div>
      <div className="relative z-10 mt-4" onClick={(e) => e.stopPropagation()}>
        <ActionPillLight tool={tool} installing={installing} hasPaidPlan={hasPaidPlan} onActivate={onActivate} />
      </div>
    </div>
  );
}

function ActionPillLight({ tool, installing, hasPaidPlan, onActivate }: {
  tool: any; installing: string | null; hasPaidPlan: boolean; onActivate: (tool: any) => void;
}) {
  const { t } = useLanguage();
  const isBusy = installing === tool.id;
  const base = "h-8 px-4 rounded-full text-[11px] font-bold flex items-center justify-center gap-1.5 w-fit transition-colors";

  if (tool.installed) {
    return <span className={cn(base, "bg-white/25 text-white")}><Check className="h-3 w-3" /> {t('toolsStore.installed')}</span>;
  }
  if (tool.type === 'paid' && (tool.billing_type || 'plan') === 'plan' && !hasPaidPlan) {
    return (
      <Link href="/owner/billing" className={cn(base, "bg-white/90 text-gray-800 hover:bg-white")}>
        <Lock className="h-3 w-3" /> {t('toolsStore.upgradePlan')}
      </Link>
    );
  }
  const label = tool.type === 'paid' && tool.billing_type === 'addon' ? tool.price_label : t('toolsStore.activateNow');
  return (
    <button onClick={() => onActivate(tool)} disabled={!!installing} className={cn(base, "bg-white text-gray-900 hover:bg-white/90 disabled:opacity-60")}>
      {isBusy ? <Loader2 className="h-3 w-3 animate-spin" /> : label}
    </button>
  );
}

export default function ToolsStorePage() {
  const { user, isLoading: isUserLoading } = useUser();
  const { t, dir } = useLanguage();
  const [allTools, setAllTools] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [installing, setInstalling] = useState<string | null>(null);
  const [subscription, setSubscription] = useState<any>(null);
  const [activeTab, setActiveTab] = useState('all');
  const [sortBy, setSortBy] = useState('relevance');
  const [selectedTool, setSelectedTool] = useState<any>(null);
  const { toast } = useToast();

  const dateLocale = dir === 'rtl' ? 'ar-SA' : 'en-US';
  const platformExpiryDate = subscription
    ? new Date(subscription.end_date).toLocaleDateString(dateLocale)
    : t('toolsStore.notSpecified');
  const unlimitedAccount = isUnlimitedAccount(user?.email);
  const hasPaidPlan = unlimitedAccount || (!!subscription && subscription.plan_id !== 'free');

  // Land back here after a real StreamPay tool purchase (success or failure)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const result = params.get('tool_purchase');
    if (!result) return;
    if (result === 'success') {
      toast({ title: t('toolsStore.paymentSuccessTitle'), description: t('toolsStore.paymentSuccessDesc') });
    } else if (result === 'failed') {
      toast({ variant: 'destructive', title: t('toolsStore.paymentFailedTitle'), description: t('toolsStore.paymentFailedDesc') });
    }
    window.history.replaceState({}, '', window.location.pathname);
  }, [toast, t]);

  const fetchAllData = async () => {
    if (!user || !user.id) return;
    setIsLoading(true);
    try {
      const [toolsData, activatedToolsRes, subscriptionRes] = await Promise.all([
        getTools(),
        supabase.from('activated_tools').select('tool_id, expires_at, activated_at').eq('profile_id', user.id).eq('status', 'active'),
        supabase.from('subscriptions').select('*').eq('profile_id', user.id).eq('status', 'active').limit(1),
      ]);

      if (subscriptionRes.data && subscriptionRes.data.length > 0) {
        setSubscription(subscriptionRes.data[0]);
      }

      const activatedById = new Map<string, any>((activatedToolsRes.data || []).map((t: any) => [t.tool_id, t]));

      const processedTools = toolsData.map(tool => {
        const activation = activatedById.get(tool.id);
        return {
          ...tool,
          billing_type: tool.billing_type || 'plan',
          period_months: tool.period_months ?? null,
          icon: iconMap[tool.icon] || Box,
          installed: !!activation,
          expires_at: activation?.expires_at ?? null,
          activated_at: activation?.activated_at ?? null,
        };
      });
      setAllTools(processedTools);
      setSelectedTool((prev: any) => prev ? processedTools.find(t => t.id === prev.id) ?? null : null);
    } catch (error) {
      console.error("Failed to fetch tools", error);
      toast({ title: t('toolsStore.loadFailedTitle'), variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!isUserLoading && user) {
        fetchAllData();
    }
  }, [isUserLoading, user]);

  const filteredTools = allTools.filter(tool =>
    tool.title.includes(searchQuery) || tool.description.includes(searchQuery)
  );

  // Free tools, and paid-but-plan-bundled tools an owner already qualifies
  // for, activate instantly with no charge.
  const activateBundledOrFreeTool = async (tool: any) => {
    if (!user || !user.id) return;

    const maxTools = user.entitlements?.maxTools ?? 2;
    const activeToolsCount = allTools.filter(t => t.installed).length;
    if (activeToolsCount >= maxTools) {
      toast({
        variant: 'destructive',
        title: t('toolsStore.maxToolsReachedTitle'),
        description: `${t('toolsStore.maxToolsReachedDescPrefix')} (${user.entitlements?.planName || ''}) ${t('toolsStore.maxToolsReachedDescMiddle')} ${maxTools} ${t('toolsStore.maxToolsReachedDescSuffix')}`,
      });
      return;
    }

    setInstalling(tool.id);
    try {
      const billingType = tool.billing_type || 'plan';
      const now = new Date();
      let expiresAt: string | null = null;
      let humanExpiry = '';

      if (billingType === 'plan') {
        expiresAt = subscription?.end_date || null;
        humanExpiry = expiresAt
          ? new Date(expiresAt).toLocaleDateString(dateLocale)
          : platformExpiryDate;
      } else {
        const months = tool.period_months && tool.period_months > 0 ? tool.period_months : 1;
        const endDate = new Date(now);
        endDate.setMonth(endDate.getMonth() + months);
        expiresAt = endDate.toISOString();
        humanExpiry = endDate.toLocaleDateString(dateLocale);
      }

      const { error } = await supabase.from('activated_tools').upsert({
        profile_id: user.id,
        tool_id: tool.id,
        billing_type: billingType,
        period_months: billingType === 'addon' ? (tool.period_months || 1) : null,
        status: 'active',
        activated_at: now.toISOString(),
        expires_at: expiresAt,
      }, { onConflict: 'profile_id,tool_id' });

      if (error) throw error;
      toast({ title: t('toolsStore.activatedTitle'), description: `${t('toolsStore.activatedDescPrefix')} ${humanExpiry}` });
      await fetchAllData();
    } catch (error: any) {
      toast({ title: t('toolsStore.errorTitle'), description: error.message, variant: "destructive" });
    } finally {
      setInstalling(null);
    }
  };

  // Soft-cancels the activation row rather than deleting it, so a paid
  // addon's purchase history stays intact for billing records.
  const deactivateTool = async (tool: any) => {
    if (!user || !user.id) return;
    try {
      const { error } = await supabase
        .from('activated_tools')
        .update({ status: 'cancelled' })
        .eq('profile_id', user.id)
        .eq('tool_id', tool.id);
      if (error) throw error;
      toast({ title: t('toolsStore.deactivatedTitle'), description: `"${tool.title}" ${t('toolsStore.deactivatedDescSuffix')}` });
      await fetchAllData();
    } catch (error: any) {
      toast({ title: t('toolsStore.errorTitle'), description: error.message, variant: 'destructive' });
      throw error;
    }
  };

  // Paid, independently-purchased tools go through a real StreamPay checkout
  const purchaseTool = async (tool: any) => {
    if (!user || !user.id) return;
    setInstalling(tool.id);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/streampay-tool-checkout`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({ tool_id: tool.id }),
        }
      );
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        toast({ variant: 'destructive', title: t('toolsStore.paymentStartFailedTitle'), description: data.error || t('toolsStore.paymentLinkFailedDesc') });
        setInstalling(null);
      }
    } catch (error: any) {
      toast({ title: t('toolsStore.errorTitle'), description: error.message, variant: "destructive" });
      setInstalling(null);
    }
  };

  const handleActivate = (tool: any) => {
    if (!user || !user.id) return;
    const billingType = tool.billing_type || 'plan';

    if (tool.type !== 'paid') {
      activateBundledOrFreeTool(tool);
      return;
    }

    // Our own team account skips real payment entirely, including
    // independently-priced addon tools that would otherwise go to checkout.
    if (unlimitedAccount) {
      activateBundledOrFreeTool(tool);
      return;
    }

    if (billingType === 'addon') {
      purchaseTool(tool);
      return;
    }

    // Paid + bundled with the platform plan: requires an active paid
    // subscription (not the free plan) — no separate charge otherwise.
    if (!hasPaidPlan) {
      toast({
        title: t('toolsStore.needsPaidPlanTitle'),
        description: t('toolsStore.needsPaidPlanDesc'),
      });
      return;
    }
    activateBundledOrFreeTool(tool);
  };

  if (isLoading || isUserLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-1/3" />
        <div className="flex gap-4">
          <Skeleton className="h-56 w-72 rounded-[28px] shrink-0" />
          <Skeleton className="h-56 w-72 rounded-[28px] shrink-0" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1,2,3].map(i => <Skeleton key={i} className="h-44 rounded-[26px]" />)}
        </div>
      </div>
    );
  }

  const tabFiltered = [...filteredTools.filter(t => activeTab === 'all' || t.category === activeTab)].sort((a, b) => {
    if (sortBy === 'price_asc') return (a.price ?? 0) - (b.price ?? 0);
    if (sortBy === 'price_desc') return (b.price ?? 0) - (a.price ?? 0);
    if (sortBy === 'installs') return (b.total_installs ?? 0) - (a.total_installs ?? 0);
    return 0;
  });
  const featured = !searchQuery ? allTools.filter(t => t.popular).slice(0, 6) : [];
  const categoryLabelOf = (category: string) => {
    const tab = TABS.find(tb => tb.value === category);
    return tab ? t(tab.labelKey) : category;
  };

  return (
    <div className="space-y-8 pb-20">
      <PageHeader title={t('toolsStore.pageTitle')} description={t('toolsStore.pageDescription')}>
        <div className="relative w-full max-w-sm">
            <Search className="absolute end-4 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-600" />
            <Input
                placeholder={t('toolsStore.searchPlaceholder')}
                className={cn("h-10 pe-10 text-xs rounded-full border-0 bg-gray-100/80 focus-visible:ring-1 focus-visible:ring-gray-300 focus-visible:bg-white", dir === 'rtl' ? 'text-right' : 'text-left')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
            />
        </div>
      </PageHeader>

      {/* Info banner */}
      <div className="bg-amber-50 border border-amber-100 rounded-2xl px-4 py-3 flex items-center gap-2.5">
        <Clock className="h-3.5 w-3.5 text-amber-500 shrink-0" />
        <p className="text-[11px] text-amber-700">
            {t('toolsStore.planToolsPrefix')} <span className="font-bold">{t('toolsStore.planToolsLabel')}</span> {t('toolsStore.planToolsSuffix')}
            {' '}{t('toolsStore.standaloneToolsPrefix')} <span className="font-bold">{t('toolsStore.standaloneToolsLabel')}</span> {t('toolsStore.standaloneToolsSuffix')}
        </p>
      </div>

      {/* Featured strip */}
      {featured.length > 0 && (
        <div>
          <div className="flex items-center gap-1.5 mb-3.5 px-0.5">
            <Sparkles className="h-4 w-4 text-amber-500" />
            <h2 className="text-[15px] font-black text-gray-900">{t('toolsStore.featuredForYou')}</h2>
          </div>
          <div className="flex gap-4 overflow-x-auto pb-2 -mx-1 px-1 snap-x snap-mandatory no-scrollbar">
            {featured.map((tool) => (
              <FeaturedCard key={tool.id} tool={tool} installing={installing} hasPaidPlan={hasPaidPlan} onActivate={handleActivate} onOpenDetail={setSelectedTool} />
            ))}
          </div>
        </div>
      )}

      {/* Category chips */}
      <div className="flex gap-2 overflow-x-auto no-scrollbar">
        {TABS.map(tab => (
          <button
            key={tab.value}
            onClick={() => setActiveTab(tab.value)}
            className={cn(
              "shrink-0 h-9 px-5 rounded-full text-[12px] font-bold transition-colors",
              activeTab === tab.value
                ? "bg-gray-900 text-white shadow-sm"
                : "bg-gray-100/80 text-gray-600 hover:bg-gray-200/70"
            )}
          >
            {t(tab.labelKey)}
          </button>
        ))}
      </div>

      {/* Tools Grid */}
      <div>
        <div className="flex items-center justify-between mb-3.5 px-0.5">
          <h2 className="text-[15px] font-black text-gray-900">
            {activeTab === 'all' ? t('toolsStore.allTools') : categoryLabelOf(activeTab)}
          </h2>
          <SortDropdown value={sortBy} onChange={setSortBy} />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" dir={dir}>
          {tabFiltered.map((tool) => (
            <ToolCard
              key={tool.id}
              tool={tool}
              installing={installing}
              hasPaidPlan={hasPaidPlan}
              onActivate={handleActivate}
              onOpenDetail={setSelectedTool}
              categoryLabel={categoryLabelOf(tool.category)}
            />
          ))}
        </div>

        {tabFiltered.length === 0 && (
          <div className="bg-white border border-gray-100 rounded-[26px] p-10 text-center">
            <Box className="h-8 w-8 text-gray-200 mx-auto mb-3" />
            <p className="text-sm font-bold text-gray-900 mb-1">{t('toolsStore.noToolsFound')}</p>
            <p className="text-[11px] text-gray-600">{t('toolsStore.tryDifferentSearch')}</p>
          </div>
        )}
      </div>

      <ToolDetailModal
        tool={selectedTool}
        open={!!selectedTool}
        onOpenChange={(open) => !open && setSelectedTool(null)}
        installing={installing}
        hasPaidPlan={hasPaidPlan}
        onActivate={handleActivate}
        onDeactivate={deactivateTool}
        categoryLabel={selectedTool ? categoryLabelOf(selectedTool.category) : ''}
      />
    </div>
  );
}
