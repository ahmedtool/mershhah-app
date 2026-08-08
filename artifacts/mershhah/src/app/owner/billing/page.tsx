'use client';

import PageHeader from "@/components/dashboard/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/lib/supabase";
import { useEffect, useState } from "react";
import { useUser } from "@/hooks/useUser";
import { Skeleton } from "@/components/ui/skeleton";
import { CreditCard, Clock, CheckCircle, AlertCircle, Zap, ArrowRight, Tag, Calendar, Receipt } from "lucide-react";
import { Link } from "wouter";
import { useToast } from "@/hooks/use-toast";

export default function BillingPage() {
  const { user } = useUser();
  const { toast } = useToast();
  const [subscription, setSubscription] = useState<any>(null);
  const [plans, setPlans] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [couponCode, setCouponCode] = useState("");
  const [isCheckingCoupon, setIsCheckingCoupon] = useState(false);
  const [couponDiscount, setCouponDiscount] = useState<any>(null);

  useEffect(() => {
    const fetchData = async () => {
      if (!user?.id) return;
      try {
        const [subRes, plansRes, invRes] = await Promise.all([
          supabase
            .from("subscriptions")
            .select("*, plans(*)")
            .eq("profile_id", user.id)
            .in("status", ["active", "pending"])
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle(),
          supabase
            .from("plans")
            .select("*")
            .eq("is_active", true)
            .order("price_monthly"),
          supabase
            .from("invoices")
            .select("*")
            .eq("profile_id", user.id)
            .order("created_at", { ascending: false })
            .limit(10),
        ]);
        setSubscription(subRes.data);
        setPlans(plansRes.data || []);
        setInvoices(invRes.data || []);
      } catch (error) {
        console.error(error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [user]);

  const handleCheckout = async (planId: string, cycle: "monthly" | "yearly") => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/streampay-checkout`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({
            plan_id: planId,
            billing_cycle: cycle,
            discount_code: couponCode || undefined,
          }),
        }
      );
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        toast({ variant: "destructive", title: "خطأ", description: data.error || "فشل إنشاء رابط الدفع" });
      }
    } catch (error: any) {
      toast({ variant: "destructive", title: "خطأ", description: error.message });
    }
  };

  const handleCheckCoupon = async () => {
    if (!couponCode.trim()) return;
    setIsCheckingCoupon(true);
    try {
      const { data, error } = await supabase
        .from("discount_codes")
        .select("*")
        .eq("code", couponCode.toUpperCase())
        .eq("is_active", true)
        .single();
      if (error || !data) {
        toast({ variant: "destructive", title: "كوبون غير صالح" });
        setCouponDiscount(null);
        return;
      }
      const now = new Date();
      const validUntil = data.valid_until ? new Date(data.valid_until) : null;
      if (validUntil && validUntil < now) {
        toast({ variant: "destructive", title: "الكوبون منتهي الصلاحية" });
        setCouponDiscount(null);
        return;
      }
      if (data.max_uses && data.current_uses >= data.max_uses) {
        toast({ variant: "destructive", title: "الكوبون استُنفد" });
        setCouponDiscount(null);
        return;
      }
      setCouponDiscount(data);
      toast({ title: "كوبون صالح", description: data.discount_type === "percentage" ? `خصم ${data.discount_value}%` : data.discount_type === "fixed" ? `خصم ${data.discount_value} ر.س` : "فترة مجانية" });
    } catch {
      toast({ variant: "destructive", title: "خطأ" });
    } finally {
      setIsCheckingCoupon(false);
    }
  };

  const isExpired = subscription?.end_date && new Date(subscription.end_date) < new Date();
  const daysLeft = subscription?.end_date ? Math.max(0, Math.ceil((new Date(subscription.end_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24))) : 0;

  if (isLoading) {
    return (
      <div className="space-y-6 p-4">
        <Skeleton className="h-10 w-1/3" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4">
      <PageHeader title="الفواتير والاشتراكات" description="إدارة اشتراكك وطرق الدفع" />

      {/* Current Subscription */}
      {subscription ? (
        <Card className="border-gray-100">
          <CardContent className="p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isExpired ? 'bg-red-50' : 'bg-emerald-50'}`}>
                  {isExpired ? <AlertCircle className="h-5 w-5 text-red-500" /> : <CheckCircle className="h-5 w-5 text-emerald-500" />}
                </div>
                <div>
                  <h3 className="text-sm font-bold text-gray-900">{subscription.plan_name || "باقة"}</h3>
                  <p className="text-[11px] text-gray-400">{subscription.billing_cycle === "yearly" ? "اشتراك سنوي" : "اشتراك شهري"}</p>
                </div>
              </div>
              <div className="text-left">
                <p className="text-lg font-bold text-gray-900">{subscription.amount} ر.س</p>
                <p className="text-[10px] text-gray-400">/{subscription.billing_cycle === "yearly" ? "سنة" : "شهر"}</p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-gray-50 rounded-xl p-3 text-center">
                <Calendar className="h-4 w-4 text-gray-400 mx-auto mb-1" />
                <p className="text-[10px] text-gray-400">ينتهي</p>
                <p className="text-xs font-bold text-gray-900">{daysLeft} يوم</p>
              </div>
              <div className="bg-gray-50 rounded-xl p-3 text-center">
                <Clock className="h-4 w-4 text-gray-400 mx-auto mb-1" />
                <p className="text-[10px] text-gray-400">الحالة</p>
                <p className={`text-xs font-bold ${isExpired ? 'text-red-600' : 'text-emerald-600'}`}>
                  {isExpired ? "منتهية" : subscription.status === "active" ? "نشطة" : "معلقة"}
                </p>
              </div>
              <div className="bg-gray-50 rounded-xl p-3 text-center">
                <Receipt className="h-4 w-4 text-gray-400 mx-auto mb-1" />
                <p className="text-[10px] text-gray-400">الفواتير</p>
                <p className="text-xs font-bold text-gray-900">{invoices.length}</p>
              </div>
            </div>
            {subscription.discount_amount > 0 && (
              <div className="flex items-center gap-2 bg-emerald-50 rounded-xl px-3 py-2">
                <Tag className="h-3.5 w-3.5 text-emerald-500" />
                <span className="text-[11px] text-emerald-700 font-medium">خصم {subscription.discount_amount} ر.س مُطبّق</span>
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card className="border-gray-100">
          <CardContent className="p-8 text-center space-y-4">
            <Zap className="h-12 w-12 text-gray-200 mx-auto" />
            <h3 className="text-sm font-bold text-gray-900">لم تفعّل اشتراكاً بعد</h3>
            <p className="text-[11px] text-gray-400">اختر باقة تناسبك وابدأ بإدارة مطعمك</p>
          </CardContent>
        </Card>
      )}

      {/* Coupon */}
      <Card className="border-gray-100">
        <CardContent className="p-4">
          <div className="flex items-center gap-2">
            <Tag className="h-4 w-4 text-gray-400" />
            <span className="text-xs font-bold text-gray-700">كوبون خصم</span>
          </div>
          <div className="flex gap-2 mt-3">
            <input
              type="text"
              placeholder="أدخل الكوبون"
              value={couponCode}
              onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
              className="flex-1 h-10 px-3 rounded-xl border border-gray-200 text-xs text-center font-bold tracking-wider placeholder:text-gray-300 focus:outline-none focus:border-gray-300"
              dir="ltr"
            />
            <button
              onClick={handleCheckCoupon}
              disabled={isCheckingCoupon || !couponCode}
              className="h-10 px-4 rounded-xl bg-gray-100 text-xs font-bold text-gray-600 hover:bg-gray-200 transition-colors disabled:opacity-50"
            >
              تحقق
            </button>
          </div>
          {couponDiscount && (
            <div className="mt-2 text-[11px] text-emerald-600 font-medium">
              ✓ {couponDiscount.discount_type === "percentage" ? `خصم ${couponDiscount.discount_value}%` : couponDiscount.discount_type === "fixed" ? `خصم ثابت ${couponDiscount.discount_value} ر.س` : "فترة مجانية"}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Plans */}
      <div>
        <h2 className="text-sm font-bold text-gray-900 mb-3">الباقات المتاحة</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {plans.map((plan) => {
            let monthlyPrice = plan.price_monthly || plan.price || 0;
            let yearlyPrice = plan.price_yearly || 0;
            if (couponDiscount) {
              if (couponDiscount.discount_type === "percentage") {
                monthlyPrice = Math.round(monthlyPrice * (1 - couponDiscount.discount_value / 100));
                yearlyPrice = Math.round(yearlyPrice * (1 - couponDiscount.discount_value / 100));
              } else if (couponDiscount.discount_type === "fixed") {
                monthlyPrice = Math.max(0, monthlyPrice - couponDiscount.discount_value);
                yearlyPrice = Math.max(0, yearlyPrice - couponDiscount.discount_value);
              } else if (couponDiscount.discount_type === "free_trial") {
                monthlyPrice = 0;
                yearlyPrice = 0;
              }
            }
            return (
              <div key={plan.id} className={`rounded-2xl border overflow-hidden ${plan.is_featured ? 'border-gray-900 ring-1 ring-gray-900' : 'border-gray-100'}`}>
                <div className={`px-5 pt-5 pb-4 ${plan.is_featured ? 'bg-gray-900' : 'bg-gray-50'}`}>
                  {plan.is_featured && <span className="text-[10px] font-medium text-gray-400 bg-white/10 px-2 py-0.5 rounded-full">مميز</span>}
                  <h3 className={`text-base font-bold mt-2 ${plan.is_featured ? 'text-white' : 'text-gray-900'}`}>{plan.name}</h3>
                  {plan.description && <p className={`text-xs mt-1 ${plan.is_featured ? 'text-gray-300' : 'text-gray-400'}`}>{plan.description}</p>}
                </div>
                <div className="px-5 py-4 space-y-3">
                  {/* Monthly */}
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-gray-400">شهري</span>
                    <div className="flex items-baseline gap-1">
                      {couponDiscount && monthlyPrice !== (plan.price_monthly || plan.price) && (
                        <span className="text-[10px] text-gray-300 line-through">{plan.price_monthly || plan.price}</span>
                      )}
                      <span className="text-lg font-bold text-gray-900">{monthlyPrice}</span>
                      <span className="text-[10px] text-gray-400">ر.س</span>
                    </div>
                  </div>
                  {/* Yearly */}
                  {yearlyPrice > 0 && (
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-gray-400">سنوي</span>
                      <div className="flex items-baseline gap-1">
                        {couponDiscount && yearlyPrice !== plan.price_yearly && (
                          <span className="text-[10px] text-gray-300 line-through">{plan.price_yearly}</span>
                        )}
                        <span className="text-lg font-bold text-gray-900">{yearlyPrice}</span>
                        <span className="text-[10px] text-gray-400">ر.س</span>
                      </div>
                    </div>
                  )}
                  <div className="space-y-1.5 pt-2">
                    <button
                      onClick={() => handleCheckout(plan.id, "monthly")}
                      className="w-full h-10 rounded-xl bg-gray-900 text-white text-xs font-bold hover:bg-gray-800 transition-colors"
                    >
                      اشتراك شهري
                    </button>
                    {yearlyPrice > 0 && (
                      <button
                        onClick={() => handleCheckout(plan.id, "yearly")}
                        className="w-full h-10 rounded-xl border border-gray-200 text-xs font-bold text-gray-600 hover:bg-gray-50 transition-colors"
                      >
                        اشتراك سنوي
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Invoices History */}
      {invoices.length > 0 && (
        <div>
          <h2 className="text-sm font-bold text-gray-900 mb-3">سجل الفواتير</h2>
          <Card className="border-gray-100">
            <CardContent className="p-0 divide-y divide-gray-50">
              {invoices.map((inv) => (
                <div key={inv.id} className="flex items-center justify-between px-5 py-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${inv.status === 'paid' ? 'bg-emerald-50' : inv.status === 'failed' ? 'bg-red-50' : 'bg-gray-50'}`}>
                      <Receipt className={`h-4 w-4 ${inv.status === 'paid' ? 'text-emerald-500' : inv.status === 'failed' ? 'text-red-500' : 'text-gray-400'}`} />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-gray-900">{inv.description || "فاتورة اشتراك"}</p>
                      <p className="text-[10px] text-gray-400">{new Date(inv.created_at).toLocaleDateString("ar-SA")}</p>
                    </div>
                  </div>
                  <div className="text-left">
                    <p className="text-xs font-bold text-gray-900">{inv.amount} ر.س</p>
                    <span className={`text-[10px] font-medium ${inv.status === 'paid' ? 'text-emerald-600' : inv.status === 'failed' ? 'text-red-500' : 'text-gray-400'}`}>
                      {inv.status === 'paid' ? 'مدفوعة' : inv.status === 'failed' ? 'فشل' : 'معلقة'}
                    </span>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
