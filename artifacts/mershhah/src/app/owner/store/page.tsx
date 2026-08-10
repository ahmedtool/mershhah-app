'use client';

import { useState, useEffect, useTransition } from 'react';
import PageHeader from "@/components/dashboard/PageHeader";
import { Input } from "@/components/ui/input";
import {
    Search,
    Zap,
    Check,
    Clock,
    Box,
    Loader2,
    icons,
    Star,
    ArrowLeft,
    Lock,
} from 'lucide-react';
import { Link } from 'wouter';
import { useToast } from "@/hooks/use-toast";
import { getTools } from '@/services/restaurant.service';
import { Skeleton } from '@/components/ui/skeleton';
import { useUser } from '@/hooks/useUser';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';

const iconMap: { [key: string]: React.ElementType } = { ...icons, Box };

const TABS = [
    { value: 'all', label: 'الكل' },
    { value: 'marketing', label: 'التسويق' },
    { value: 'operations', label: 'العمليات' },
    { value: 'analytics', label: 'التحليلات' },
];

export default function ToolsStorePage() {
  const { user, isLoading: isUserLoading } = useUser();
  const [allTools, setAllTools] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [installing, setInstalling] = useState<string | null>(null);
  const [subscription, setSubscription] = useState<any>(null);
  const [activeTab, setActiveTab] = useState('all');
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
        supabase.from('activated_tools').select('tool_id').eq('profile_id', user.id),
        supabase.from('subscriptions').select('*').eq('profile_id', user.id).eq('status', 'active').limit(1),
      ]);

      if (subscriptionRes.data && subscriptionRes.data.length > 0) {
        setSubscription(subscriptionRes.data[0]);
      }

      const activatedIds = (activatedToolsRes.data || []).map((t: any) => t.tool_id);

      const processedTools = toolsData.map(tool => ({
        ...tool,
        billing_type: tool.billing_type || 'plan',
        period_months: tool.period_months ?? null,
        icon: iconMap[tool.icon] || Box,
        installed: activatedIds.includes(tool.id),
      }));
      setAllTools(processedTools);
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
      <div className="space-y-5">
        <Skeleton className="h-10 w-1/3" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {[1,2,3].map(i => <Skeleton key={i} className="h-64 rounded-2xl" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 pb-20">
      <PageHeader title="متجر الأدوات" description="فعّل أدوات إضافية لتنمية مشروعك.">
        <div className="relative w-full max-w-xs">
            <Search className="absolute end-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-300" />
            <Input
                placeholder="ابحث عن أداة..."
                className="h-9 pe-9 text-xs rounded-xl border-gray-200 text-right"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
            />
        </div>
      </PageHeader>

      {/* Info banner */}
      <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 flex items-center gap-2.5">
        <Clock className="h-3.5 w-3.5 text-amber-500 shrink-0" />
        <p className="text-[11px] text-amber-700">
            أدوات <span className="font-bold">خطة مرشح</span> تنتهي مع اشتراكك —
            الأدوات <span className="font-bold">المستقلة</span> تنتهي حسب مدة الأداة
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1.5 overflow-x-auto scrollbar-hide">
        {TABS.map(tab => (
          <button
            key={tab.value}
            onClick={() => setActiveTab(tab.value)}
            className={cn(
              "shrink-0 h-8 px-4 rounded-lg text-[11px] font-bold transition-colors border",
              activeTab === tab.value
                ? "bg-gray-900 text-white border-gray-900"
                : "bg-white text-gray-500 border-gray-200 hover:border-gray-300"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tools Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3" dir="rtl">
        {filteredTools
          .filter(t => activeTab === 'all' || t.category === activeTab)
          .map((tool) => {
            const IconComponent = tool.icon;
            return (
              <div key={tool.id} className="bg-white border border-gray-100 rounded-2xl overflow-hidden flex flex-col">
                {/* Header */}
                <div className={cn("p-5 text-center", tool.bg_color)}>
                  <div className="w-14 h-14 rounded-2xl bg-white/80 border border-white/50 flex items-center justify-center mx-auto mb-3">
                    <IconComponent className={cn("h-7 w-7", tool.color)} />
                  </div>
                  <h3 className="text-sm font-bold text-gray-900">{tool.title}</h3>
                  {tool.popular && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-600 bg-amber-50 border border-amber-100 px-2 py-0.5 rounded-md mt-2">
                      <Star className="h-2.5 w-2.5 fill-amber-400" />
                      الأكثر شيوعاً
                    </span>
                  )}
                </div>

                {/* Description */}
                <div className="px-5 py-3 flex-1">
                  <p className="text-[11px] text-gray-400 leading-relaxed line-clamp-3">{tool.description}</p>
                </div>

                {/* Footer */}
                <div className="px-5 pb-5 space-y-3">
                  <div className="text-center">
                    <span className="text-lg font-black text-gray-900">{tool.price_label}</span>
                  </div>
                  {tool.installed ? (
                    <div className="w-full h-10 rounded-xl bg-emerald-50 border border-emerald-100 text-emerald-600 text-xs font-bold flex items-center justify-center gap-2">
                      <Check className="h-3.5 w-3.5" />
                      تم التفعيل
                    </div>
                  ) : tool.type === 'paid' && (tool.billing_type || 'plan') === 'plan' && !hasPaidPlan ? (
                    <Link href="/owner/billing" className="w-full h-10 rounded-xl border border-gray-200 text-gray-500 text-xs font-bold hover:bg-gray-50 transition-colors flex items-center justify-center gap-2">
                      <Lock className="h-3.5 w-3.5" />
                      يحتاج باقة مدفوعة
                    </Link>
                  ) : (
                    <button
                      onClick={() => handleActivate(tool)}
                      disabled={!!installing}
                      className="w-full h-10 rounded-xl bg-gray-900 text-white text-xs font-bold hover:bg-gray-800 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {installing === tool.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Zap className="h-3.5 w-3.5" />
                      )}
                      {installing === tool.id
                        ? (tool.type === 'paid' && tool.billing_type === 'addon' ? 'جاري تحويلك للدفع...' : 'جاري التفعيل...')
                        : (tool.type === 'paid' && tool.billing_type === 'addon' ? 'اشترك الآن' : 'تفعيل الأداة')}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
      </div>

      {filteredTools.filter(t => activeTab === 'all' || t.category === activeTab).length === 0 && (
        <div className="bg-white border border-gray-100 rounded-2xl p-8 text-center">
          <Box className="h-8 w-8 text-gray-200 mx-auto mb-3" />
          <p className="text-sm font-bold text-gray-900 mb-1">لا توجد أدوات</p>
          <p className="text-[11px] text-gray-400">جرّب تغيير كلمة البحث</p>
        </div>
      )}
    </div>
  );
}
