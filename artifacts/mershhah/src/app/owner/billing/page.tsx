'use client';

import PageHeader from "@/components/dashboard/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/lib/supabase";
import { useEffect, useState } from "react";
import { useUser } from "@/hooks/useUser";
import { Skeleton } from "@/components/ui/skeleton";
import { CreditCard, Clock, CheckCircle, AlertCircle, Zap, Calendar, Receipt, Tag } from "lucide-react";
import { PlanPricingGrid } from "@/components/dashboard/PlanPricingGrid";

export default function BillingPage() {
  const { user } = useUser();
  const [subscription, setSubscription] = useState<any>(null);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      if (!user?.id) return;
      try {
        const [subRes, invRes] = await Promise.all([
          supabase
            .from("subscriptions")
            .select("*")
            .eq("profile_id", user.id)
            .in("status", ["active", "pending"])
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle(),
          supabase
            .from("invoices")
            .select("*")
            .eq("profile_id", user.id)
            .order("created_at", { ascending: false })
            .limit(10),
        ]);
        setSubscription(subRes.data);
        setInvoices(invRes.data || []);
      } catch (error) {
        console.error(error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [user]);

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
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
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

      {/* Plans */}
      <div>
        <h2 className="text-sm font-bold text-gray-900 mb-3">الباقات المتاحة</h2>
        <PlanPricingGrid currentPlanId={subscription?.plan_id} isCurrentSubscriptionExpired={isExpired} />
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
