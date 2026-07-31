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

const formSchema = z.object({
  name: z.string().min(3, 'اسم الباقة يجب أن يكون 3 أحرف على الأقل.'),
  description: z.string().optional(),
  price: z.coerce.number().min(0, 'السعر يجب أن يكون 0 أو أكثر.'),
  duration_months: z.coerce.number().int().min(1, 'المدة يجب أن تكون شهرًا واحدًا على الأقل.'),
  payment_link: z
    .string()
    .url({ message: 'الرجاء إدخال رابط دفع صحيح.' })
    .optional()
    .or(z.literal('')),
  is_active: z.boolean().default(true),
  is_featured: z.boolean().default(false),
  features_included: z.string().optional(),
  features_excluded: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

interface EditPlanDialogProps {
  children?: React.ReactNode;
  plan?: Plan;
  onSave?: () => void;
}

export function EditPlanDialog({ children, plan, onSave }: EditPlanDialogProps) {
  const [open, setOpen] = useState(false);
  const [isSaving, startSaving] = useTransition();
  const { toast } = useToast();
  const isEditing = !!plan;

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      description: '',
      price: 0,
      duration_months: 1,
      payment_link: '',
      is_active: true,
      is_featured: false,
      features_included: '',
      features_excluded: '',
    },
  });

  useEffect(() => {
    if (open) {
      if (isEditing && plan) {
        const includedLines: string[] = [];
        const excludedLines: string[] = [];
        if (plan.features) {
          Object.entries(plan.features).forEach(([label, included]) => {
            if (!label.trim()) return;
            if (included) includedLines.push(label);
            else excludedLines.push(label);
          });
        }
        form.reset({
          name: plan.name,
          description: plan.description,
          price: plan.price,
          duration_months: plan.duration_months,
          payment_link: plan.payment_link || '',
          is_active: plan.is_active,
          is_featured: plan.is_featured,
          features_included: includedLines.join('\n'),
          features_excluded: excludedLines.join('\n'),
        });
      } else {
        form.reset({
          name: '', description: '', price: 0, duration_months: 1,
          payment_link: '', is_active: true, is_featured: false,
          features_included: '', features_excluded: '',
        });
      }
    }
  }, [open, plan, isEditing, form]);

  async function onSubmit(values: FormValues) {
    startSaving(async () => {
      try {
        const features: Record<string, boolean> = {};
        const addLines = (text: string | undefined, included: boolean) => {
          if (!text) return;
          text.split('\n').map((l) => l.trim()).filter(Boolean).forEach((l) => { features[l] = included; });
        };
        addLines(values.features_included, true);
        addLines(values.features_excluded, false);

        const { features_included, features_excluded, ...rest } = values;
        const payload: any = {
          ...rest,
          features: Object.keys(features).length > 0 ? features : undefined,
        };

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

            {/* Price & Duration */}
            <div className="grid grid-cols-2 gap-3">
              <FormField control={form.control} name="price" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs text-gray-500">السعر (ر.س)</FormLabel>
                  <FormControl>
                    <Input type="number" {...field} className="h-11 rounded-xl border-gray-200 text-sm" dir="ltr" disabled={isSaving} />
                  </FormControl>
                  <FormMessage className="text-[10px]" />
                </FormItem>
              )} />
              <FormField control={form.control} name="duration_months" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs text-gray-500">المدة (بالأشهر)</FormLabel>
                  <FormControl>
                    <Input type="number" {...field} className="h-11 rounded-xl border-gray-200 text-sm" dir="ltr" disabled={isSaving} />
                  </FormControl>
                  <FormMessage className="text-[10px]" />
                </FormItem>
              )} />
            </div>

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

            {/* Features */}
            <FormField control={form.control} name="features_included" render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs text-gray-500">المميزات المشمولة</FormLabel>
                <FormControl>
                  <Textarea rows={3} placeholder={"كل ميزة في سطر مستقل:\nمساعد ذكي\nتحليلات متقدمة"} {...field} className="rounded-xl border-gray-200 text-sm resize-none" disabled={isSaving} />
                </FormControl>
                <FormMessage className="text-[10px]" />
              </FormItem>
            )} />

            <FormField control={form.control} name="features_excluded" render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs text-gray-500">مميزات غير مشمولة <span className="text-gray-300">(تظهر بخط مشطوب)</span></FormLabel>
                <FormControl>
                  <Textarea rows={2} placeholder={"مدير علاقات مخصص\nدعم فني 24/7"} {...field} className="rounded-xl border-gray-200 text-sm resize-none" disabled={isSaving} />
                </FormControl>
                <FormMessage className="text-[10px]" />
              </FormItem>
            )} />

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
