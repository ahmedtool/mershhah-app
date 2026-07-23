'use client';

import { useState } from 'react';
import { X, Loader2, Tag } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import type { DiscountCode } from '@/lib/types';

type Props = {
  code?: DiscountCode;
  onSave: () => void;
  children: React.ReactNode;
};

export function EditDiscountDialog({ code, onSave, children }: Props) {
  const [open, setOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  const [form, setForm] = useState({
    code: code?.code || '',
    description: code?.description || '',
    discount_type: code?.discount_type || 'percentage' as 'percentage' | 'fixed',
    discount_value: code?.discount_value || 10,
    max_uses: code?.max_uses || '',
    min_amount: code?.min_amount || '',
    applicable_plans: code?.applicable_plans?.join(', ') || '',
    starts_at: code?.starts_at ? new Date(code.starts_at).toISOString().slice(0, 16) : '',
    expires_at: code?.expires_at ? new Date(code.expires_at).toISOString().slice(0, 16) : '',
  });

  const handleSave = async () => {
    if (!form.code.trim()) {
      toast({ variant: 'destructive', title: 'خطأ', description: 'الكود مطلوب' });
      return;
    }
    if (form.discount_value <= 0) {
      toast({ variant: 'destructive', title: 'خطأ', description: 'قيمة الخصم يجب أن تكون أكبر من صفر' });
      return;
    }
    if (form.discount_type === 'percentage' && form.discount_value > 100) {
      toast({ variant: 'destructive', title: 'خطأ', description: 'النسبة المئوية لا يمكن أن تتجاوز 100%' });
      return;
    }

    setIsSaving(true);
    try {
      const payload: any = {
        code: form.code.trim().toUpperCase(),
        description: form.description.trim() || null,
        discount_type: form.discount_type,
        discount_value: form.discount_value,
        max_uses: form.max_uses ? Number(form.max_uses) : null,
        min_amount: form.min_amount ? Number(form.min_amount) : 0,
        applicable_plans: form.applicable_plans ? form.applicable_plans.split(',').map(s => s.trim()).filter(Boolean) : null,
        starts_at: form.starts_at ? new Date(form.starts_at).toISOString() : new Date().toISOString(),
        expires_at: form.expires_at ? new Date(form.expires_at).toISOString() : null,
      };

      if (code) {
        const { error } = await supabase.from('discount_codes').update(payload).eq('id', code.id);
        if (error) throw error;
        toast({ title: 'تم التحديث', description: 'تم تحديث كود الخصم' });
      } else {
        const { error } = await supabase.from('discount_codes').insert(payload);
        if (error) throw error;
        toast({ title: 'تم الإنشاء', description: 'تم إنشاء كود الخصم الجديد' });
      }
      onSave();
      setOpen(false);
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'خطأ', description: error.message });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <div onClick={() => setOpen(true)}>{children}</div>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" dir="rtl">
          <div className="fixed inset-0 bg-black/20 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <div className="relative bg-white rounded-2xl border border-gray-100 w-full max-w-lg max-h-[92vh] overflow-y-auto p-0 gap-0 shadow-xl">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center">
                  <Tag className="h-4 w-4 text-gray-500" />
                </div>
                <h3 className="text-sm font-bold text-gray-900">{code ? 'تعديل الكود' : 'كود خصم جديد'}</h3>
              </div>
              <button onClick={() => setOpen(false)} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-gray-50">
                <X className="h-4 w-4 text-gray-400" />
              </button>
            </div>

            {/* Form */}
            <div className="px-5 py-4 space-y-4">
              {/* Code */}
              <div>
                <label className="block text-[11px] font-bold text-gray-600 mb-1.5">كود الخصم *</label>
                <input
                  type="text"
                  value={form.code}
                  onChange={(e) => setForm(prev => ({ ...prev, code: e.target.value.toUpperCase() }))}
                  placeholder="مثال: WELCOME20"
                  className="w-full h-10 px-3 rounded-xl border border-gray-200 text-xs text-right font-mono placeholder:text-gray-300 focus:outline-none focus:border-gray-300"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-[11px] font-bold text-gray-600 mb-1.5">الوصف</label>
                <input
                  type="text"
                  value={form.description}
                  onChange={(e) => setForm(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="وصف اختياري للكود"
                  className="w-full h-10 px-3 rounded-xl border border-gray-200 text-xs text-right placeholder:text-gray-300 focus:outline-none focus:border-gray-300"
                />
              </div>

              {/* Discount Type + Value */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-gray-600 mb-1.5">نوع الخصم *</label>
                  <select
                    value={form.discount_type}
                    onChange={(e) => setForm(prev => ({ ...prev, discount_type: e.target.value as 'percentage' | 'fixed' }))}
                    className="w-full h-10 px-3 rounded-xl border border-gray-200 text-xs text-right focus:outline-none focus:border-gray-300 bg-white"
                  >
                    <option value="percentage">نسبة مئوية (%)</option>
                    <option value="fixed">مبلغ ثابت (ر.س)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-gray-600 mb-1.5">قيمة الخصم *</label>
                  <input
                    type="number"
                    min="0"
                    max={form.discount_type === 'percentage' ? 100 : undefined}
                    value={form.discount_value}
                    onChange={(e) => setForm(prev => ({ ...prev, discount_value: Number(e.target.value) }))}
                    className="w-full h-10 px-3 rounded-xl border border-gray-200 text-xs text-right placeholder:text-gray-300 focus:outline-none focus:border-gray-300"
                  />
                </div>
              </div>

              {/* Max Uses + Min Amount */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-gray-600 mb-1.5">حد الاستخدام الأقصى</label>
                  <input
                    type="number"
                    min="0"
                    value={form.max_uses}
                    onChange={(e) => setForm(prev => ({ ...prev, max_uses: e.target.value }))}
                    placeholder="بدون حد"
                    className="w-full h-10 px-3 rounded-xl border border-gray-200 text-xs text-right placeholder:text-gray-300 focus:outline-none focus:border-gray-300"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-gray-600 mb-1.5">الحد الأدنى للمبلغ</label>
                  <input
                    type="number"
                    min="0"
                    value={form.min_amount}
                    onChange={(e) => setForm(prev => ({ ...prev, min_amount: e.target.value }))}
                    placeholder="0"
                    className="w-full h-10 px-3 rounded-xl border border-gray-200 text-xs text-right placeholder:text-gray-300 focus:outline-none focus:border-gray-300"
                  />
                </div>
              </div>

              {/* Applicable Plans */}
              <div>
                <label className="block text-[11px] font-bold text-gray-600 mb-1.5">الباقات المطبّق عليها</label>
                <input
                  type="text"
                  value={form.applicable_plans}
                  onChange={(e) => setForm(prev => ({ ...prev, applicable_plans: e.target.value }))}
                  placeholder="اترك فارغاً للتطبيق على الكل (مفصّلة بفاصلة)"
                  className="w-full h-10 px-3 rounded-xl border border-gray-200 text-xs text-right placeholder:text-gray-300 focus:outline-none focus:border-gray-300"
                />
              </div>

              {/* Dates */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-gray-600 mb-1.5">تاريخ البداية</label>
                  <input
                    type="datetime-local"
                    value={form.starts_at}
                    onChange={(e) => setForm(prev => ({ ...prev, starts_at: e.target.value }))}
                    className="w-full h-10 px-3 rounded-xl border border-gray-200 text-xs text-right focus:outline-none focus:border-gray-300"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-gray-600 mb-1.5">تاريخ الانتهاء</label>
                  <input
                    type="datetime-local"
                    value={form.expires_at}
                    onChange={(e) => setForm(prev => ({ ...prev, expires_at: e.target.value }))}
                    className="w-full h-10 px-3 rounded-xl border border-gray-200 text-xs text-right focus:outline-none focus:border-gray-300"
                  />
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center gap-3 px-5 py-4 border-t border-gray-100">
              <button onClick={() => setOpen(false)} className="flex-1 h-10 rounded-xl border border-gray-200 text-xs font-bold text-gray-600 hover:bg-gray-50 transition-colors">
                إلغاء
              </button>
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="flex-1 h-10 rounded-xl bg-gray-900 text-white text-xs font-bold hover:bg-gray-800 transition-colors flex items-center justify-center gap-2"
              >
                {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                {code ? 'تحديث' : 'إنشاء'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
