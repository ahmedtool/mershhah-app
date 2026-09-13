'use client';

import { useEffect, useState, useTransition } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { useUser } from '@/hooks/useUser';
import type { ServiceUsageRow } from '@/lib/types';

interface UpdateServiceUsageDialogProps {
  serviceKey: string;
  serviceName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existing: ServiceUsageRow | null;
  onSaved: () => void;
}

type FormState = {
  plan: string;
  usage_value: string;
  usage_unit: string;
  limit_value: string;
  limit_unit: string;
  cost_sar: string;
  billing_cycle: string;
  notes: string;
};

const EMPTY_FORM: FormState = {
  plan: '', usage_value: '', usage_unit: '', limit_value: '', limit_unit: '', cost_sar: '', billing_cycle: '', notes: '',
};

export function UpdateServiceUsageDialog({ serviceKey, serviceName, open, onOpenChange, existing, onSaved }: UpdateServiceUsageDialogProps) {
  const { user } = useUser();
  const { toast } = useToast();
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [isSaving, startSaving] = useTransition();

  useEffect(() => {
    if (!open) return;
    setForm(existing ? {
      plan: existing.plan || '',
      usage_value: existing.usage_value != null ? String(existing.usage_value) : '',
      usage_unit: existing.usage_unit || '',
      limit_value: existing.limit_value != null ? String(existing.limit_value) : '',
      limit_unit: existing.limit_unit || '',
      cost_sar: existing.cost_sar != null ? String(existing.cost_sar) : '',
      billing_cycle: existing.billing_cycle || '',
      notes: existing.notes || '',
    } : EMPTY_FORM);
  }, [open, existing]);

  const set = (key: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const handleSave = () => {
    startSaving(async () => {
      try {
        const { error } = await supabase.from('service_usage').upsert({
          service_key: serviceKey,
          plan: form.plan || null,
          usage_value: form.usage_value === '' ? null : Number(form.usage_value),
          usage_unit: form.usage_unit || null,
          limit_value: form.limit_value === '' ? null : Number(form.limit_value),
          limit_unit: form.limit_unit || null,
          cost_sar: form.cost_sar === '' ? null : Number(form.cost_sar),
          billing_cycle: form.billing_cycle || null,
          notes: form.notes || null,
          updated_by: user?.uid || null,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'service_key' });
        if (error) throw error;
        toast({ title: 'تم تحديث بيانات الاستهلاك' });
        onSaved();
        onOpenChange(false);
      } catch (error: any) {
        toast({ title: 'خطأ في الحفظ', description: error.message, variant: 'destructive' });
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle>تحديث استهلاك {serviceName}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-[11px] text-gray-600">الخطة</Label>
              <Input value={form.plan} onChange={set('plan')} placeholder="مثال: Free" className="h-10 text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px] text-gray-600">دورة الفوترة</Label>
              <Input value={form.billing_cycle} onChange={set('billing_cycle')} placeholder="شهري / سنوي" className="h-10 text-sm" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-[11px] text-gray-600">الاستخدام الحالي</Label>
              <Input value={form.usage_value} onChange={set('usage_value')} type="number" placeholder="3.8" className="h-10 text-sm" dir="ltr" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px] text-gray-600">وحدة الاستخدام</Label>
              <Input value={form.usage_unit} onChange={set('usage_unit')} placeholder="GB / Requests / SAR" className="h-10 text-sm" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-[11px] text-gray-600">الحد الأقصى (اتركه فاضي = بدون حد)</Label>
              <Input value={form.limit_value} onChange={set('limit_value')} type="number" placeholder="5" className="h-10 text-sm" dir="ltr" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px] text-gray-600">وحدة الحد</Label>
              <Input value={form.limit_unit} onChange={set('limit_unit')} placeholder="GB" className="h-10 text-sm" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-[11px] text-gray-600">التكلفة الشهرية (ر.س، اختياري)</Label>
            <Input value={form.cost_sar} onChange={set('cost_sar')} type="number" placeholder="0" className="h-10 text-sm" dir="ltr" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-[11px] text-gray-600">ملاحظات</Label>
            <Textarea value={form.notes} onChange={set('notes')} rows={2} className="text-sm resize-y" placeholder="أي تفاصيل إضافية..." />
          </div>
        </div>
        <DialogFooter>
          <button onClick={handleSave} disabled={isSaving}
            className="h-10 px-6 rounded-xl bg-gray-900 text-white text-sm font-medium hover:bg-gray-800 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 w-full sm:w-auto">
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            حفظ
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
