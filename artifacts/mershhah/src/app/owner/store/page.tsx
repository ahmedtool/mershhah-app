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

const iconMap: { [key: string]: React.ElementType } = { ...icons, Box };

const TABS = [
    { value: 'all', label: 'الكل' },
    { value: 'marketing', label: 'التسويق' },
    { value: 'operations', label: 'العمليات' },
    { value: 'analytics', label: 'التحليلات' },
];

function IconTile({ tool, size = 'md' }: { tool: any; size?: 'md' | 'lg' }) {
  const Icon = tool.icon;
  const dims = size === 'lg' ? 'w-16 h-16 rounded-[22px]' : 'w-14 h-14 rounded-[18px]';
  const iconDims = size === 'lg' ? 'h-8 w-8' : 'h-7 w-7';

  // A custom uploaded logo (tools.image_path) replaces the Lucide icon
  // wherever the tool's identity is shown — that's the whole point of it.
  if (tool.image_path) {
    return (
      <div className={cn(dims, "shrink-0 overflow-hidden shadow-sm ring-1 ring-black/[0.03] bg-gray-50")}>
        <StorageImage imagePath={tool.image_path} alt={tool.title} className="w-full h-full object-cover" />
      </div>
    );
  }

  return (
    <div className={cn(dims, "shrink-0 flex items-center justify-center shadow-sm ring-1 ring-black/[0.03]", tool.bg_color)}>
      <Icon className={cn(iconDims, tool.color)} strokeWidth={2} />
    </div>
  );
}

function ActionPill({ tool, installing, hasPaidPlan, onActivate }: {
  tool: any; installing: string | null; hasPaidPlan: boolean; onActivate: (tool: any) => void;
}) {
  const isBusy = installing === tool.id;
  const base = "shrink-0 h-8 min-w-[76px] px-4 rounded-full text-[11px] font-bold flex items-center justify-center gap-1.5 transition-colors";

  if (tool.installed) {
    return (
      <span className={cn(base, "bg-emerald-50 text-emerald-600")}>
        <Check className="h-3 w-3" /> مُفعّلة
      </span>
    );
  }

  if (tool.type === 'paid' && (tool.billing_type || 'plan') === 'plan' && !hasPaidPlan) {
    return (
      <Link href="/owner/billing" className={cn(base, "bg-gray-100 text-gray-500 hover:bg-gray-200")}>
        <Lock className="h-3 w-3" /> ترقية
      </Link>
    );
  }

  const label = tool.type === 'paid' && tool.billing_type === 'addon' ? tool.price_label : 'تفعيل';

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
  return (
    <div
      onClick={() => onOpenDetail(tool)}
      className="group bg-white border border-gray-100 rounded-[26px] p-5 flex flex-col gap-3.5 hover:shadow-[0_8px_24px_-8px_rgba(0,0,0,0.08)] hover:border-gray-200 transition-all duration-300 cursor-pointer"
    >
      <div className="flex items-start justify-between gap-3">
        <IconTile tool={tool} />
        <div onClick={(e) => e.stopPropagation()}>
          <ActionPill tool={tool} installing={installing} hasPaidPlan={hasPaidPlan} onActivate={onActivate} />
        </div>
      </div>
      <div>
        <div className="flex items-center gap-1.5 flex-wrap">
          <h3 className="text-[14px] font-bold text-gray-900">{tool.title}</h3>
        </div>
        <p className="text-[10.5px] text-gray-400 mt-0.5 flex items-center gap-1">
          {categoryLabel}
          {tool.popular && (
            <span className="inline-flex items-center gap-0.5 text-amber-500 font-bold">
              · <Star className="h-2.5 w-2.5 fill-amber-400 text-amber-400" /> مميز
            </span>
          )}
        </p>
        <p className="text-[11.5px] text-gray-500 leading-relaxed mt-2 line-clamp-2">{tool.description}</p>
      </div>
    </div>
  );
}

function FeaturedCard({ tool, installing, hasPaidPlan, onActivate, onOpenDetail }: {
  tool: any; installing: string | null; hasPaidPlan: boolean; onActivate: (tool: any) => void; onOpenDetail: (tool: any) => void;
}) {
  const Icon = tool.icon;
  return (
    <div
      onClick={() => onOpenDetail(tool)}
      className="snap-start shrink-0 w-[260px] sm:w-[300px] rounded-[28px] p-6 relative overflow-hidden flex flex-col justify-between min-h-[220px] cursor-pointer"
      style={{ background: toolGradient(tool) }}
    >
      <Icon className="absolute -left-6 -bottom-6 h-32 w-32 text-white/10" strokeWidth={1.5} />
      <div className="relative z-10">
        {tool.image_path ? (
          <div className="w-14 h-14 rounded-[18px] overflow-hidden mb-4 bg-white/20">
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
  const isBusy = installing === tool.id;
  const base = "h-8 px-4 rounded-full text-[11px] font-bold flex items-center justify-center gap-1.5 w-fit transition-colors";

  if (tool.installed) {
    return <span className={cn(base, "bg-white/25 text-white")}><Check className="h-3 w-3" /> مُفعّلة</span>;
  }
  if (tool.type === 'paid' && (tool.billing_type || 'plan') === 'plan' && !hasPaidPlan) {
    return (
      <Link href="/owner/billing" className={cn(base, "bg-white/90 text-gray-800 hover:bg-white")}>
        <Lock className="h-3 w-3" /> ترقية الباقة
      </Link>
    );
  }
  const label = tool.type === 'paid' && tool.billing_type === 'addon' ? tool.price_label : 'تفعيل الآن';
  return (
    <button onClick={() => onActivate(tool)} disabled={!!installing} className={cn(base, "bg-white text-gray-900 hover:bg-white/90 disabled:opacity-60")}>
      {isBusy ? <Loader2 className="h-3 w-3 animate-spin" /> : label}
    </button>
  );
}

export default function ToolsStorePage() {
  const { user, isLoading: isUserLoading } = useUser();
  const [allTools, setAllTools] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [installing, setInstalling] = useState<string | null>(null);
  const [subscription, setSubscription] = useState<any>(null);
  const [activeTab, setActiveTab] = useState('all');
  const [selectedTool, setSelectedTool] = useState<any>(null);
  const { toast } = useToast();

  const platformExpiryDate = subscription
    ? new Date(subscription.end_date).toLocaleDateString('ar-SA')
    : "غير محدد";
  const hasPaidPlan = !!subscription && subscription.plan_id !== 'free';

  // Land back here after a real StreamPay tool purchase (success or failure)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const result = params.get('tool_purchase');
    if (!result) return;
    if (result === 'success') {
      toast({ title: 'تم الدفع بنجاح', description: 'جاري تفعيل الأداة...' });
    } else if (result === 'failed') {
      toast({ variant: 'destructive', title: 'فشل الدفع', description: 'لم تكتمل عملية الدفع. حاول مرة أخرى.' });
    }
    window.history.replaceState({}, '', window.location.pathname);
  }, [toast]);

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
      toast({ title: "فشل تحميل الأدوات", variant: "destructive" });
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
        title: 'وصلت للحد الأقصى من الأدوات',
        description: `باقتك الحالية (${user.entitlements?.planName || ''}) تسمح بحد أقصى ${maxTools} أدوات مفعّلة. رقّي باقتك لتفعيل المزيد.`,
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
          ? new Date(expiresAt).toLocaleDateString('ar-SA')
          : platformExpiryDate;
      } else {
        const months = tool.period_months && tool.period_months > 0 ? tool.period_months : 1;
        const endDate = new Date(now);
        endDate.setMonth(endDate.getMonth() + months);
        expiresAt = endDate.toISOString();
        humanExpiry = endDate.toLocaleDateString('ar-SA');
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
      toast({ title: "تم التفعيل", description: `صالح حتى ${humanExpiry}` });
      await fetchAllData();
    } catch (error: any) {
      toast({ title: "خطأ", description: error.message, variant: "destructive" });
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
      toast({ title: 'تم إلغاء التفعيل', description: `"${tool.title}" ما عادت مفعّلة على حسابك.` });
      await fetchAllData();
    } catch (error: any) {
      toast({ title: 'خطأ', description: error.message, variant: 'destructive' });
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
        toast({ variant: 'destructive', title: 'تعذّر بدء الدفع', description: data.error || 'فشل إنشاء رابط الدفع' });
        setInstalling(null);
      }
    } catch (error: any) {
      toast({ title: "خطأ", description: error.message, variant: "destructive" });
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

    if (billingType === 'addon') {
      purchaseTool(tool);
      return;
    }

    // Paid + bundled with the platform plan: requires an active paid
    // subscription (not the free plan) — no separate charge otherwise.
    if (!hasPaidPlan) {
      toast({
        title: 'تحتاج باقة مدفوعة',
        description: 'هذي الأداة متاحة فقط مع اشتراك مدفوع بالمنصة. رقّي باقتك أولاً من صفحة الفوترة.',
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

  const tabFiltered = filteredTools.filter(t => activeTab === 'all' || t.category === activeTab);
  const featured = !searchQuery ? allTools.filter(t => t.popular).slice(0, 6) : [];
  const categoryLabelOf = (category: string) => TABS.find(t => t.value === category)?.label || category;

  return (
    <div className="space-y-8 pb-20">
      <PageHeader title="متجر الأدوات" description="فعّل أدوات إضافية لتنمية مشروعك.">
        <div className="relative w-full max-w-sm">
            <Search className="absolute end-4 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
            <Input
                placeholder="ابحث عن أداة..."
                className="h-10 pe-10 text-xs rounded-full border-0 bg-gray-100/80 text-right focus-visible:ring-1 focus-visible:ring-gray-300 focus-visible:bg-white"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
            />
        </div>
      </PageHeader>

      {/* Info banner */}
      <div className="bg-amber-50 border border-amber-100 rounded-2xl px-4 py-3 flex items-center gap-2.5">
        <Clock className="h-3.5 w-3.5 text-amber-500 shrink-0" />
        <p className="text-[11px] text-amber-700">
            أدوات <span className="font-bold">خطة مرشح</span> تنتهي مع اشتراكك —
            الأدوات <span className="font-bold">المستقلة</span> تنتهي حسب مدة الأداة
        </p>
      </div>

      {/* Featured strip */}
      {featured.length > 0 && (
        <div>
          <div className="flex items-center gap-1.5 mb-3.5 px-0.5">
            <Sparkles className="h-4 w-4 text-amber-500" />
            <h2 className="text-[15px] font-black text-gray-900">مميزة لك</h2>
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
                : "bg-gray-100/80 text-gray-500 hover:bg-gray-200/70"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tools Grid */}
      <div>
        <h2 className="text-[15px] font-black text-gray-900 mb-3.5 px-0.5">
          {activeTab === 'all' ? 'كل الأدوات' : categoryLabelOf(activeTab)}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" dir="rtl">
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
            <p className="text-sm font-bold text-gray-900 mb-1">لا توجد أدوات</p>
            <p className="text-[11px] text-gray-400">جرّب تغيير كلمة البحث</p>
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
