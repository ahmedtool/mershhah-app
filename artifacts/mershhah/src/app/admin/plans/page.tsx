'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Pencil, Plus, CreditCard, Clock, Link as LinkIcon } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import type { Plan } from '@/lib/types';
import { EditPlanDialog } from '@/components/admin/plans/EditPlanDialog';

export default function PlansPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    const fetchPlans = async () => {
      setIsLoading(true);
      try {
        const { data, error } = await supabase.from('plans').select('*').order('price');
        if (error) throw error;
        setPlans((data || []) as Plan[]);
      } catch (error: any) {
        toast({ variant: 'destructive', title: 'خطأ في جلب الباقات', description: error.message });
      } finally {
        setIsLoading(false);
      }
    };
    fetchPlans();
  }, [toast]);

  if (isLoading) {
    return (
      <div className="p-4 lg:p-6 space-y-4">
        <div className="space-y-2">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-4 w-80" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-72 rounded-2xl" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-gray-900">باقات الاشتراك</h1>
          <p className="text-xs text-gray-400 mt-0.5">{plans.length} باقة متاحة</p>
        </div>
        <EditPlanDialog onSave={() => window.location.reload()}>
          <button className="h-10 px-4 rounded-xl bg-gray-900 text-white text-xs font-medium hover:bg-gray-800 transition-colors flex items-center gap-2">
            <Plus className="h-4 w-4" />
            باقة جديدة
          </button>
        </EditPlanDialog>
      </div>

      {/* Plans Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {plans.map((plan) => (
          <div key={plan.id} className={`rounded-2xl border overflow-hidden flex flex-col ${plan.is_featured ? 'border-gray-900 ring-1 ring-gray-900' : 'border-gray-100'}`}>
            {/* Plan Header */}
            <div className={`px-5 pt-5 pb-4 ${plan.is_featured ? 'bg-gray-900' : 'bg-gray-50'}`}>
              {plan.is_featured && (
                <span className="text-[10px] font-medium text-gray-400 bg-white/10 px-2 py-0.5 rounded-full">الأكثر انتشاراً</span>
              )}
              <h3 className={`text-base font-bold mt-2 ${plan.is_featured ? 'text-white' : 'text-gray-900'}`}>{plan.name}</h3>
              {plan.description && (
                <p className={`text-xs mt-1 ${plan.is_featured ? 'text-gray-300' : 'text-gray-400'}`}>{plan.description}</p>
              )}
            </div>

            {/* Price */}
            <div className="px-5 py-4 border-b border-gray-100">
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-bold text-gray-900">{plan.price}</span>
                <span className="text-xs text-gray-400">ر.س</span>
                <span className="text-[10px] text-gray-300">/ {plan.duration_months > 1 ? `${plan.duration_months} أشهر` : 'شهر'}</span>
              </div>
            </div>

            {/* Details */}
            <div className="px-5 py-4 space-y-3 flex-1">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="h-3.5 w-3.5 text-gray-300" />
                  <span className="text-[11px] text-gray-400">المدة</span>
                </div>
                <span className="text-xs font-medium text-gray-600">{plan.duration_months} {plan.duration_months > 1 ? 'أشهر' : 'شهر'}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CreditCard className="h-3.5 w-3.5 text-gray-300" />
                  <span className="text-[11px] text-gray-400">الحالة</span>
                </div>
                <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${plan.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>
                  {plan.is_active ? 'نشطة' : 'غير نشطة'}
                </span>
              </div>
              {plan.payment_link && (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <LinkIcon className="h-3.5 w-3.5 text-gray-300" />
                    <span className="text-[11px] text-gray-400">الدفع</span>
                  </div>
                  <a href={plan.payment_link} target="_blank" rel="noopener noreferrer" className="text-[10px] text-blue-500 hover:underline truncate max-w-[120px]">رابط الدفع</a>
                </div>
              )}
            </div>

            {/* Edit Button */}
            <div className="px-5 pb-5">
              <EditPlanDialog plan={plan} onSave={() => window.location.reload()}>
                <button className="w-full h-10 rounded-xl border border-gray-200 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors flex items-center justify-center gap-2">
                  <Pencil className="h-3.5 w-3.5" />
                  تعديل
                </button>
              </EditPlanDialog>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
