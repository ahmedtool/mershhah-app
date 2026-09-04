'use client';

import { useState, useEffect } from 'react';
import { Plus, Tag, Percent, DollarSign, Gift, Trash2, Edit, Users, Calendar, Clock } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';

interface DiscountCode {
  id: string;
  code: string;
  description: string;
  discount_type: 'percentage' | 'fixed' | 'free_trial';
  discount_value: number;
  max_uses: number;
  current_uses: number;
  applicable_plans: string[];
  min_amount: number;
  valid_from: string;
  valid_until: string;
  is_active: boolean;
  created_at: string;
}

export default function AdminDiscountsPage() {
  const [codes, setCodes] = useState<DiscountCode[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editingCode, setEditingCode] = useState<DiscountCode | null>(null);
  const { toast } = useToast();

  const [form, setForm] = useState({
    code: '',
    description: '',
    discount_type: 'percentage' as const,
    discount_value: 0,
    max_uses: 0,
    valid_until: '',
    is_active: true,
  });

  useEffect(() => {
    fetchCodes();
  }, []);

  const fetchCodes = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('discount_codes')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setCodes(data || []);
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'خطأ', description: error.message });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      const payload = {
        code: form.code.toUpperCase(),
        description: form.description,
        discount_type: form.discount_type,
        discount_value: form.discount_value,
        max_uses: form.max_uses || null,
        valid_until: form.valid_until || null,
        is_active: form.is_active,
      };

      if (editingCode) {
        const { error } = await supabase.from('discount_codes').update(payload).eq('id', editingCode.id);
        if (error) throw error;
        toast({ title: 'تم التعديل' });
      } else {
        const { error } = await supabase.from('discount_codes').insert(payload);
        if (error) throw error;
        toast({ title: 'تم الإنشاء' });
      }
      setShowCreate(false);
      setEditingCode(null);
      setForm({ code: '', description: '', discount_type: 'percentage', discount_value: 0, max_uses: 0, valid_until: '', is_active: true });
      fetchCodes();
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'خطأ', description: error.message });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('حذف الكوبون؟')) return;
    try {
      const { error } = await supabase.from('discount_codes').delete().eq('id', id);
      if (error) throw error;
      toast({ title: 'تم الحذف' });
      fetchCodes();
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'خطأ', description: error.message });
    }
  };

  const toggleActive = async (id: string, current: boolean) => {
    try {
      await supabase.from('discount_codes').update({ is_active: !current }).eq('id', id);
      fetchCodes();
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'خطأ', description: error.message });
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'percentage': return <Percent className="h-4 w-4 text-blue-500" />;
      case 'fixed': return <DollarSign className="h-4 w-4 text-emerald-500" />;
      case 'free_trial': return <Gift className="h-4 w-4 text-amber-500" />;
      default: return <Tag className="h-4 w-4 text-gray-600" />;
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'percentage': return 'نسبة';
      case 'fixed': return 'مبلغ ثابت';
      case 'free_trial': return 'فترة مجانية';
      default: return type;
    }
  };

  if (isLoading) {
    return (
      <div className="p-4 lg:p-6 space-y-4">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-gray-900">كوبونات الخصم</h1>
          <p className="text-xs text-gray-600 mt-0.5">{codes.length} كوبون</p>
        </div>
        <button
          onClick={() => { setShowCreate(true); setEditingCode(null); }}
          className="h-10 px-4 rounded-xl bg-gray-900 text-white text-xs font-medium hover:bg-gray-800 transition-colors flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          كوبون جديد
        </button>
      </div>

      {/* Create/Edit Form */}
      {(showCreate || editingCode) && (
        <div className="bg-white border border-gray-100 rounded-2xl p-5 space-y-4">
          <h3 className="text-sm font-bold text-gray-900">{editingCode ? 'تعديل الكوبون' : 'كوبون جديد'}</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] font-bold text-gray-600 mb-1 block">الكود</label>
              <input
                type="text"
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
                placeholder="خصم20"
                className="w-full h-10 px-3 rounded-xl border border-gray-200 text-xs font-bold tracking-wider text-center placeholder:text-gray-600 focus:outline-none focus:border-gray-300"
                dir="ltr"
                disabled={!!editingCode}
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-gray-600 mb-1 block">الوصف</label>
              <input
                type="text"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="خصم 20% على الباقة"
                className="w-full h-10 px-3 rounded-xl border border-gray-200 text-xs placeholder:text-gray-600 focus:outline-none focus:border-gray-300"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-gray-600 mb-1 block">نوع الخصم</label>
              <select
                value={form.discount_type}
                onChange={(e) => setForm({ ...form, discount_type: e.target.value as any })}
                className="w-full h-10 px-3 rounded-xl border border-gray-200 text-xs focus:outline-none focus:border-gray-300"
              >
                <option value="percentage">نسبة (%)</option>
                <option value="fixed">مبلغ ثابت (ر.س)</option>
                <option value="free_trial">فترة مجانية</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] font-bold text-gray-600 mb-1 block">
                {form.discount_type === 'percentage' ? 'النسبة (%)' : form.discount_type === 'fixed' ? 'المبلغ (ر.س)' : 'قيمة'}
              </label>
              <input
                type="number"
                value={form.discount_value || ''}
                onChange={(e) => setForm({ ...form, discount_value: Number(e.target.value) })}
                className="w-full h-10 px-3 rounded-xl border border-gray-200 text-xs focus:outline-none focus:border-gray-300"
                dir="ltr"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-gray-600 mb-1 block">الحد الأقصى للاستخدام</label>
              <input
                type="number"
                value={form.max_uses || ''}
                onChange={(e) => setForm({ ...form, max_uses: Number(e.target.value) })}
                placeholder="0 = غير محدود"
                className="w-full h-10 px-3 rounded-xl border border-gray-200 text-xs placeholder:text-gray-600 focus:outline-none focus:border-gray-300"
                dir="ltr"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-gray-600 mb-1 block">صالح حتى</label>
              <input
                type="date"
                value={form.valid_until}
                onChange={(e) => setForm({ ...form, valid_until: e.target.value })}
                className="w-full h-10 px-3 rounded-xl border border-gray-200 text-xs focus:outline-none focus:border-gray-300"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={handleSave} className="h-10 px-6 rounded-xl bg-gray-900 text-white text-xs font-bold hover:bg-gray-800 transition-colors">
              {editingCode ? 'حفظ التعديل' : 'إنشاء'}
            </button>
            <button onClick={() => { setShowCreate(false); setEditingCode(null); }} className="h-10 px-4 rounded-xl border border-gray-200 text-xs font-bold text-gray-600 hover:bg-gray-50 transition-colors">
              إلغاء
            </button>
          </div>
        </div>
      )}

      {/* Codes Table */}
      <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
        {codes.length === 0 ? (
          <div className="p-12 text-center">
            <Tag className="h-10 w-10 text-gray-200 mx-auto mb-3" />
            <p className="text-xs text-gray-600">لا توجد كوبونات بعد</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {codes.map((code) => (
              <div key={code.id} className="flex items-center justify-between flex-wrap gap-y-3 gap-x-4 px-5 py-4 hover:bg-gray-50 transition-colors">
                <div className="flex items-center gap-4 min-w-0">
                  {getTypeIcon(code.discount_type)}
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold text-gray-900 font-mono tracking-wider">{code.code}</span>
                      <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${code.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>
                        {code.is_active ? 'نشط' : 'معطل'}
                      </span>
                    </div>
                    <p className="text-[11px] text-gray-600 mt-0.5 truncate">
                      {getTypeLabel(code.discount_type)} · {code.discount_type === 'percentage' ? `${code.discount_value}%` : code.discount_type === 'fixed' ? `${code.discount_value} ر.س` : 'مجاني'}
                      {code.description && ` · ${code.description}`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4 sm:gap-6 shrink-0">
                  <div className="text-center">
                    <p className="text-[10px] text-gray-600">الاستخدام</p>
                    <p className="text-xs font-bold text-gray-900">{code.current_uses}/{code.max_uses || '∞'}</p>
                  </div>
                  {code.valid_until && (
                    <div className="text-center">
                      <p className="text-[10px] text-gray-600">الصلاحية</p>
                      <p className="text-xs font-bold text-gray-900">{new Date(code.valid_until).toLocaleDateString('ar-SA')}</p>
                    </div>
                  )}
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => toggleActive(code.id, code.is_active)}
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-600 hover:bg-gray-100 transition-colors"
                    >
                      <Tag className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => {
                        setEditingCode(code);
                        setForm({
                          code: code.code,
                          description: code.description || '',
                          discount_type: code.discount_type,
                          discount_value: code.discount_value,
                          max_uses: code.max_uses || 0,
                          valid_until: code.valid_until ? code.valid_until.split('T')[0] : '',
                          is_active: code.is_active,
                        });
                        setShowCreate(true);
                      }}
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-600 hover:bg-gray-100 transition-colors"
                    >
                      <Edit className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(code.id)}
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-600 hover:text-red-500 hover:bg-red-50 transition-colors"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
