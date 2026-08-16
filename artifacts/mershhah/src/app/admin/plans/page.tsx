'use client';

import { useState, useEffect } from 'react';
import { Pencil, Plus, CreditCard, Clock, Link as LinkIcon, Users, Zap, Utensils, Trash2, FlaskConical, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { EditPlanDialog } from '@/components/admin/plans/EditPlanDialog';
import { usePlanCheckout } from '@/hooks/usePlanCheckout';

interface Plan {
  id: string;
  name: string;
  description: string;
  price: number;
  price_monthly: number;
  price_yearly: number;
  duration_months: number;
  is_active: boolean;
  is_featured: boolean;
  payment_link: string;
  features: any;
  streampay_product_id: string;
  trial_days: number;
  max_branches: number;
  max_menu_items: number;
  max_tools: number;
}

// The hidden 1 SAR dev-only plan, kept solely to run a real StreamPay
// checkout end to end without paying full price while still building.
const TEST_PLAN_ID = '93250b42-d34c-4996-8d83-359ea26ab264';

export default function PlansPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [subscriptions, setSubscriptions] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();
  const { checkout, isCheckingOut } = usePlanCheckout();

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [plansRes, subsRes] = await Promise.all([
        supabase.from('plans').select('*').order('price_yearly'),
        supabase.from('subscriptions').select('id, status, plan_id, profile_id').in('status', ['active', 'pending']),
      ]);
      if (plansRes.error) throw plansRes.error;
      setPlans((plansRes.data || []) as Plan[]);
      setSubscriptions(subsRes.data || []);
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'خطأ', description: error.message });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const getSubCount = (planId: string) => subscriptions.filter(s => s.plan_id === planId).length;

  const handleDelete = async (plan: Plan) => {
    if (!confirm(`هل أنت متأكد من حذف باقة "${plan.name}"؟`)) return;
    try {
      const { error } = await supabase.from('plans').delete().eq('id', plan.id);
      if (error) throw error;
      setPlans((prev) => prev.filter((p) => p.id !== plan.id));
      toast({ title: 'تم الحذف', description: `تم حذف باقة ${plan.name}` });
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'خطأ', description: error.message });
    }
  };

  if (isLoading) {
    return (
      <div className="p-4 lg:p-6 space-y-4">
        <Skeleton className="h-7 w-48" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-80 rounded-2xl" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-gray-900">باقات الاشتراك</h1>
          <p className="text-xs text-gray-400 mt-0.5">{plans.length} باقة · {subscriptions.length} اشتراك نشط</p>
        </div>
        <EditPlanDialog onSave={fetchData}>
          <button className="h-10 px-4 rounded-xl bg-gray-900 text-white text-xs font-medium hover:bg-gray-800 transition-colors flex items-center gap-2">
            <Plus className="h-4 w-4" />
            باقة جديدة
          </button>
        </EditPlanDialog>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {plans.map((plan) => {
          const subCount = getSubCount(plan.id);
          const isFree = (plan.price_yearly || 0) === 0;
          const isTestPlan = plan.id === TEST_PLAN_ID;
          return (
            <div key={plan.id} className={`rounded-2xl border overflow-hidden flex flex-col ${plan.is_featured ? 'border-gray-900 ring-1 ring-gray-900' : isTestPlan ? 'border-dashed border-amber-300' : 'border-gray-100'}`}>
              <div className={`px-5 pt-5 pb-4 ${plan.is_featured ? 'bg-gray-900' : 'bg-gray-50'}`}>
                <div className="flex items-center gap-1.5">
                  {plan.is_featured && (
                    <span className="text-[10px] font-medium text-gray-400 bg-white/10 px-2 py-0.5 rounded-full">الأكثر انتشاراً</span>
                  )}
                  {isTestPlan && (
                    <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full flex items-center gap-1">
                      <FlaskConical className="h-2.5 w-2.5" />
                      للتطوير فقط
                    </span>
                  )}
                </div>
                <h3 className={`text-base font-bold mt-2 ${plan.is_featured ? 'text-white' : 'text-gray-900'}`}>{plan.name}</h3>
                {plan.description && (
                  <p className={`text-xs mt-1 ${plan.is_featured ? 'text-gray-300' : 'text-gray-400'}`}>{plan.description}</p>
                )}
              </div>

              <div className="px-5 py-4 border-b border-gray-100 space-y-2">
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-bold text-gray-900">{isFree ? 'مجاني' : plan.price_yearly}</span>
                  {!isFree && <span className="text-xs text-gray-400">ر.س/سنة</span>}
                </div>
              </div>

              <div className="px-5 py-4 space-y-2.5 flex-1">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-gray-400 flex items-center gap-1.5"><Users className="h-3 w-3" />الاشتراكات</span>
                  <span className="text-xs font-medium text-gray-600">{subCount}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-gray-400 flex items-center gap-1.5"><Zap className="h-3 w-3" />الحد الأقصى للفروع</span>
                  <span className="text-xs font-medium text-gray-600">{plan.max_branches || '∞'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-gray-400 flex items-center gap-1.5"><Utensils className="h-3 w-3" />الحد الأقصى للمنيو</span>
                  <span className="text-xs font-medium text-gray-600">{plan.max_menu_items || '∞'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-gray-400 flex items-center gap-1.5"><Clock className="h-3 w-3" />فترة التجربة</span>
                  <span className="text-xs font-medium text-gray-600">{plan.trial_days || 0} يوم</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-gray-400 flex items-center gap-1.5"><CreditCard className="h-3 w-3" />الحالة</span>
                  <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${plan.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>
                    {plan.is_active ? 'نشطة' : 'غير نشطة'}
                  </span>
                </div>
                {plan.streampay_product_id && (
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-gray-400 flex items-center gap-1.5"><LinkIcon className="h-3 w-3" />StreamPay</span>
                    <span className="text-[10px] font-medium text-emerald-600">متصل</span>
                  </div>
                )}
              </div>

              <div className="px-5 pb-5 space-y-2">
                {isTestPlan && (
                  <button
                    onClick={() => checkout(plan.id, 'yearly')}
                    disabled={isCheckingOut(plan.id, 'yearly')}
                    className="w-full h-10 rounded-xl bg-amber-500 text-white text-xs font-bold hover:bg-amber-600 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {isCheckingOut(plan.id, 'yearly') ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FlaskConical className="h-3.5 w-3.5" />}
                    اختبار الدفع الحقيقي (١ ر.س)
                  </button>
                )}
                <div className="flex items-center gap-2">
                  <EditPlanDialog plan={plan} onSave={fetchData}>
                    <button className="flex-1 h-10 rounded-xl border border-gray-200 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors flex items-center justify-center gap-2">
                      <Pencil className="h-3.5 w-3.5" />
                      تعديل
                    </button>
                  </EditPlanDialog>
                  <button
                    onClick={() => handleDelete(plan)}
                    className="w-10 h-10 rounded-xl border border-gray-200 flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors shrink-0"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
