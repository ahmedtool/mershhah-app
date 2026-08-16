'use client';

import { useState, useTransition, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Loader2, CreditCard } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { Plan } from '@/lib/types';
import { FEATURE_LABELS } from '@/lib/plan-feature-labels';

// The functional gates hooks/useUser.tsx actually enforces. Kept in sync
// with FEATURE_LABELS so this editor, the pricing page, and enforcement
// all read the exact same keys — editing a plan here used to silently
// overwrite these with free-text marketing bullets instead.
const TOGGLE_FEATURE_KEYS = ['ai_analysis', 'custom_domain', 'api_access', 'white_label', 'priority_support'] as const;

const formSchema = z.object({
  name: z.string().min(3, 'اسم الباقة يجب أن يكون 3 أحرف على الأقل.'),
  description: z.string().optional(),
  price_yearly: z.coerce.number().min(0, 'السعر يجب أن يكون 0 أو أكثر.'),
  payment_link: z
    .string()
    .url({ message: 'الرجاء إدخال رابط دفع صحيح.' })
    .optional()
    .or(z.literal('')),
  is_active: z.boolean().default(true),
  is_featured: z.boolean().default(false),
  max_branches: z.coerce.number().int().min(0, '0 = غير محدود'),
  max_menu_items: z.coerce.number().int().min(0, '0 = غير محدود'),
  max_tools: z.coerce.number().int().min(0, '0 = غير محدود'),
  ai_analysis: z.boolean().default(false),
  custom_domain: z.boolean().default(false),
  api_access: z.boolean().default(false),
  white_label: z.boolean().default(false),
  priority_support: z.boolean().default(false),
});

type FormValues = z.infer<typeof formSchema>;

interface EditPlanDialogProps {
  children?: React.ReactNode;
  plan?: Plan;
  onSave?: () => void;
}

const defaultValues: FormValues = {
  name: '', description: '', price_yearly: 0,
  payment_link: '', is_active: true, is_featured: false,
  max_branches: 1, max_menu_items: 30, max_tools: 2,
  ai_analysis: false, custom_domain: false, api_access: false, white_label: false, priority_support: false,
};

export function EditPlanDialog({ children, plan, onSave }: EditPlanDialogProps) {
  const [open, setOpen] = useState(false);
  const [isSaving, startSaving] = useTransition();
  const { toast } = useToast();
  const isEditing = !!plan;

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues,
  });

  useEffect(() => {
    if (open) {
      if (isEditing && plan) {
        const features = (plan.features || {}) as Record<string, boolean | number>;
        form.reset({
          name: plan.name,
          description: plan.description,
          price_yearly: plan.price_yearly || plan.price || 0,
          payment_link: plan.payment_link || '',
          is_active: plan.is_active,
          is_featured: plan.is_featured,
          max_branches: plan.max_branches ?? 1,
          max_menu_items: plan.max_menu_items ?? 30,
          max_tools: plan.max_tools ?? 2,
          ai_analysis: !!features.ai_analysis,
          custom_domain: !!features.custom_domain,
          api_access: !!features.api_access,
          white_label: !!features.white_label,
          priority_support: !!features.priority_support,
        });
      } else {
        form.reset(defaultValues);
      }
    }
  }, [open, plan, isEditing, form]);

  async function onSubmit(values: FormValues) {
    startSaving(async () => {
      try {
        const features: Record<string, boolean> = { menu: true };
        TOGGLE_FEATURE_KEYS.forEach((key) => { features[key] = values[key]; });

        const {
          ai_analysis, custom_domain, api_access, white_label, priority_support,
          price_yearly,
          ...rest
        } = values;
        // Yearly-only billing: price_monthly/duration_months are legacy
        // columns kept for old subscription rows, never edited here again.
        const payload: any = {
          ...rest,
          price_yearly,
          price: price_yearly,
          price_monthly: 0,
          duration_months: 12,
          features,
        };

        // Reusing a StreamPay product across a price change would silently
        // keep charging the old amount on the old terms - force a fresh one
        // next checkout.
        if (isEditing && plan && Number(plan.price_yearly ?? plan.price ?? 0) !== price_yearly) {
          payload.streampay_product_id = null;
        }

        if (isEditing && plan) {
          const { error } = await supabase.from('plans').update(payload).eq('id', plan.id);
          if (error) throw error;
        } else {
          const newId = crypto.randomUUID();
          const { error } = await supabase.from('plans').insert({ id: newId, ...payload });
          if (error) throw error;
        }

        toast({ title: `تم ${isEditing ? 'تعديل' : 'إنشاء'} الباقة بنجاح` });
        onSave?.();
        setOpen(false);
      } catch (error: any) {
        toast({ variant: 'destructive', title: 'حدث خطأ', description: error.message });
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {children && <DialogTrigger asChild>{children}</DialogTrigger>}
      <DialogContent className="sm:max-w-lg max-h-[92vh] overflow-y-auto p-0 gap-0" dir="rtl">
        {/* Header */}
        <div className="px-5 pt-5 pb-3 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center">
              <CreditCard className="h-5 w-5 text-gray-500" />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900">{isEditing ? 'تعديل الباقة' : 'إنشاء باقة جديدة'}</h2>
              <p className="text-xs text-gray-400 mt-0.5">{isEditing ? 'عدّل بيانات الباقة ثم احفظ' : 'أدخل بيانات الباقة الجديدة'}</p>
            </div>
          </div>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="p-5 space-y-4">
            {/* Name & Description */}
            <FormField control={form.control} name="name" render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs text-gray-500">اسم الباقة</FormLabel>
                <FormControl>
                  <Input placeholder="مثال: الباقة السنوية" {...field} className="h-11 rounded-xl border-gray-200 text-sm" disabled={isSaving} />
                </FormControl>
                <FormMessage className="text-[10px]" />
              </FormItem>
            )} />

            <FormField control={form.control} name="description" render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs text-gray-500">الوصف <span className="text-gray-300">(اختياري)</span></FormLabel>
                <FormControl>
                  <Textarea placeholder="وصف قصير للباقة..." {...field} className="rounded-xl border-gray-200 text-sm min-h-[60px] resize-none" disabled={isSaving} />
                </FormControl>
                <FormMessage className="text-[10px]" />
              </FormItem>
            )} />

            {/* Price (yearly-only billing) */}
            <FormField control={form.control} name="price_yearly" render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs text-gray-500">السعر السنوي (ر.س) — 0 = مجانية</FormLabel>
                <FormControl>
                  <Input type="number" min={0} {...field} className="h-11 rounded-xl border-gray-200 text-sm" dir="ltr" disabled={isSaving} />
                </FormControl>
                <p className="text-[10px] text-gray-300">كل الباقات سنوية فقط — لا يوجد تسعير شهري</p>
                <FormMessage className="text-[10px]" />
              </FormItem>
            )} />

            {/* Payment Link */}
            <FormField control={form.control} name="payment_link" render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs text-gray-500">رابط الدفع <span className="text-gray-300">(اختياري)</span></FormLabel>
                <FormControl>
                  <Input dir="ltr" placeholder="https://..." {...field} value={field.value ?? ''} className="h-11 rounded-xl border-gray-200 text-sm text-left" disabled={isSaving} />
                </FormControl>
                <FormMessage className="text-[10px]" />
              </FormItem>
            )} />

            {/* Real, enforced limits */}
            <div className="rounded-xl bg-gray-50 p-4 space-y-3">
              <p className="text-xs font-bold text-gray-600">الحدود الفعلية (0 = غير محدود)</p>
              <div className="grid grid-cols-3 gap-2">
                <FormField control={form.control} name="max_branches" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[10px] text-gray-400">الفروع</FormLabel>
                    <FormControl>
                      <Input type="number" min={0} {...field} className="h-10 rounded-lg border-gray-200 text-xs" dir="ltr" disabled={isSaving} />
                    </FormControl>
                    <FormMessage className="text-[10px]" />
                  </FormItem>
                )} />
                <FormField control={form.control} name="max_menu_items" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[10px] text-gray-400">أصناف المنيو</FormLabel>
                    <FormControl>
                      <Input type="number" min={0} {...field} className="h-10 rounded-lg border-gray-200 text-xs" dir="ltr" disabled={isSaving} />
                    </FormControl>
                    <FormMessage className="text-[10px]" />
                  </FormItem>
                )} />
                <FormField control={form.control} name="max_tools" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[10px] text-gray-400">الأدوات</FormLabel>
                    <FormControl>
                      <Input type="number" min={0} {...field} className="h-10 rounded-lg border-gray-200 text-xs" dir="ltr" disabled={isSaving} />
                    </FormControl>
                    <FormMessage className="text-[10px]" />
                  </FormItem>
                )} />
              </div>
            </div>

            {/* Feature gates */}
            <div className="space-y-2">
              <p className="text-xs font-bold text-gray-600">المزايا المفعّلة</p>
              <div className="grid grid-cols-2 gap-2">
                {TOGGLE_FEATURE_KEYS.map((key) => (
                  <FormField key={key} control={form.control} name={key} render={({ field }) => (
                    <FormItem>
                      <button type="button" onClick={() => field.onChange(!field.value)}
                        className={`w-full h-10 rounded-lg text-[11px] font-medium transition-all border ${field.value ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-white border-gray-200 text-gray-400 hover:border-gray-300'}`}>
                        {FEATURE_LABELS[key]}
                      </button>
                    </FormItem>
                  )} />
                ))}
              </div>
            </div>

            {/* Toggles */}
            <div className="grid grid-cols-2 gap-3">
              <FormField control={form.control} name="is_active" render={({ field }) => (
                <FormItem>
                  <button type="button" onClick={() => field.onChange(!field.value)}
                    className={`w-full h-11 rounded-xl text-xs font-medium transition-all border ${field.value ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-white border-gray-200 text-gray-400 hover:border-gray-300'}`}>
                    {field.value ? 'نشطة' : 'غير نشطة'}
                  </button>
                </FormItem>
              )} />
              <FormField control={form.control} name="is_featured" render={({ field }) => (
                <FormItem>
                  <button type="button" onClick={() => field.onChange(!field.value)}
                    className={`w-full h-11 rounded-xl text-xs font-medium transition-all border ${field.value ? 'bg-gray-900 border-gray-900 text-white' : 'bg-white border-gray-200 text-gray-400 hover:border-gray-300'}`}>
                    {field.value ? 'موصى بها' : 'غير موصى بها'}
                  </button>
                </FormItem>
              )} />
            </div>

            {/* Actions */}
            <div className="flex flex-wrap gap-2 pt-2">
              <button type="button" onClick={() => setOpen(false)}
                className="flex-1 h-11 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors">
                إلغاء
              </button>
              <button type="submit" disabled={isSaving}
                className="flex-1 h-11 rounded-xl bg-gray-900 text-white text-sm font-medium hover:bg-gray-800 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {isSaving ? 'جاري الحفظ...' : isEditing ? 'حفظ التعديلات' : 'إنشاء الباقة'}
              </button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
