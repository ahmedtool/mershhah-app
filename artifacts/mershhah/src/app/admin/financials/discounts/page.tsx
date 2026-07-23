'use client';

import { useState, useEffect } from 'react';
import { Tag, Plus, Pencil, Trash2, BarChart3, Package, ShoppingCart, Percent, DollarSign, Clock, Users, ToggleLeft, ToggleRight, Search, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { Link } from 'wouter';
import { usePathname } from '@/lib/navigation';
import type { DiscountCode } from '@/lib/types';
import { EditDiscountDialog } from '@/components/admin/discounts/EditDiscountDialog';

export default function FinancialsDiscountsPage() {
  const [codes, setCodes] = useState<DiscountCode[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const { toast } = useToast();
  const pathname = usePathname();

  const fetchCodes = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.from('discount_codes').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      setCodes((data || []) as DiscountCode[]);
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'خطأ', description: error.message });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCodes();
  }, []);

  const tabs = [
    { href: '/financials', label: 'نظرة عامة', icon: BarChart3 },
    { href: '/financials/plans', label: 'الباقات', icon: Package },
    { href: '/financials/orders', label: 'الطلبات', icon: ShoppingCart },
    { href: '/financials/discounts', label: 'أكواد الخصم', icon: Tag },
  ];

  const filteredCodes = codes.filter(c =>
    c.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (c.description || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const toggleActive = async (code: DiscountCode) => {
    try {
      const { error } = await supabase
        .from('discount_codes')
        .update({ is_active: !code.is_active })
        .eq('id', code.id);
      if (error) throw error;
      setCodes(prev => prev.map(c => c.id === code.id ? { ...c, is_active: !c.is_active } : c));
      toast({ title: code.is_active ? 'تم التعطيل' : 'تفعيل', description: `تم ${code.is_active ? 'تعطيل' : 'تفعيل'} الكود` });
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'خطأ', description: error.message });
    }
  };

  const deleteCode = async (code: DiscountCode) => {
    if (!confirm(`هل أنت متأكد من حذف كود "${code.code}"؟`)) return;
    try {
      const { error } = await supabase.from('discount_codes').delete().eq('id', code.id);
      if (error) throw error;
      setCodes(prev => prev.filter(c => c.id !== code.id));
      toast({ title: 'تم الحذف', description: `تم حذف كود ${code.code}` });
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'خطأ', description: error.message });
    }
  };

  const getDiscountLabel = (code: DiscountCode) => {
    if (code.discount_type === 'percentage') return `${code.discount_value}%`;
    return `${code.discount_value} ر.س`;
  };

  const getStatus = (code: DiscountCode) => {
    if (!code.is_active) return { label: 'معطّل', color: 'bg-gray-50 text-gray-500' };
    if (code.max_uses && code.used_count >= code.max_uses) return { label: 'منتهي', color: 'bg-red-50 text-red-500' };
    if (code.expires_at && new Date(code.expires_at) < new Date()) return { label: 'منتهي', color: 'bg-red-50 text-red-500' };
    if (code.starts_at && new Date(code.starts_at) > new Date()) return { label: 'لم يبدأ', color: 'bg-amber-50 text-amber-600' };
    return { label: 'نشط', color: 'bg-emerald-50 text-emerald-600' };
  };

  return (
    <div className="space-y-5">
      {/* Tabs */}
      <div className="flex items-center gap-1 bg-gray-50 rounded-xl p-1 w-fit">
        {tabs.map((tab) => {
          const isActive = tab.href === '/financials'
            ? pathname === '/financials'
            : pathname.startsWith(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex items-center gap-1.5 h-9 px-4 rounded-lg text-[11px] font-bold transition-colors ${
                isActive
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              <tab.icon className="h-3.5 w-3.5" />
              {tab.label}
            </Link>
          );
        })}
      </div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-bold text-gray-900">أكواد الخصم</h2>
          <p className="text-[10px] text-gray-400 mt-0.5">{codes.length} كود</p>
        </div>
        <EditDiscountDialog onSave={fetchCodes}>
          <button className="h-9 px-4 rounded-xl bg-gray-900 text-white text-[11px] font-bold hover:bg-gray-800 transition-colors flex items-center gap-2">
            <Plus className="h-3.5 w-3.5" />
            كود جديد
          </button>
        </EditDiscountDialog>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-300" />
          <input
            placeholder="بحث بالكود أو الوصف..."
            className="w-full h-9 pr-8 pl-3 rounded-xl border border-gray-200 text-[11px] text-right placeholder:text-gray-300 focus:outline-none focus:border-gray-300"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-2xl" />)
        ) : (
          <>
            <div className="bg-white border border-gray-100 rounded-2xl p-4 text-center">
              <p className="text-2xl font-black text-gray-900">{codes.filter(c => c.is_active).length}</p>
              <p className="text-[10px] text-gray-400 mt-1">نشط</p>
            </div>
            <div className="bg-white border border-gray-100 rounded-2xl p-4 text-center">
              <p className="text-2xl font-black text-gray-900">{codes.reduce((sum, c) => sum + c.used_count, 0)}</p>
              <p className="text-[10px] text-gray-400 mt-1">مرّات الاستخدام</p>
            </div>
            <div className="bg-white border border-gray-100 rounded-2xl p-4 text-center">
              <p className="text-2xl font-black text-gray-900">{codes.filter(c => c.discount_type === 'percentage').length}</p>
              <p className="text-[10px] text-gray-400 mt-1">نسبة مئوية</p>
            </div>
            <div className="bg-white border border-gray-100 rounded-2xl p-4 text-center">
              <p className="text-2xl font-black text-gray-900">{codes.filter(c => c.discount_type === 'fixed').length}</p>
              <p className="text-[10px] text-gray-400 mt-1">مبلغ ثابت</p>
            </div>
          </>
        )}
      </div>

      {/* Codes Table */}
      <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
        {isLoading ? (
          <div className="p-5 space-y-3">
            <Skeleton className="h-12 rounded-xl" />
            <Skeleton className="h-12 rounded-xl" />
            <Skeleton className="h-12 rounded-xl" />
          </div>
        ) : filteredCodes.length === 0 ? (
          <div className="text-center py-12">
            <Tag className="h-10 w-10 text-gray-200 mx-auto mb-3" />
            <p className="text-xs text-gray-400 font-bold">لا توجد أكواد خصم</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-right px-5 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-wider">الكود</th>
                  <th className="text-right px-5 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-wider">الخصم</th>
                  <th className="text-right px-5 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-wider">الاستخدام</th>
                  <th className="text-right px-5 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-wider">الحد الأدنى</th>
                  <th className="text-right px-5 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-wider">الصلاحية</th>
                  <th className="text-right px-5 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-wider">الحالة</th>
                  <th className="text-right px-5 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-wider">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filteredCodes.map((code) => {
                  const status = getStatus(code);
                  return (
                    <tr key={code.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-5 py-3">
                        <div>
                          <span className="font-bold text-gray-900 font-mono text-[11px]">{code.code}</span>
                          {code.description && (
                            <p className="text-[10px] text-gray-400 mt-0.5">{code.description}</p>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-gray-100 text-gray-700">
                          {code.discount_type === 'percentage' ? <Percent className="h-3 w-3" /> : <DollarSign className="h-3 w-3" />}
                          {getDiscountLabel(code)}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <span className="text-gray-600">
                          {code.used_count}{code.max_uses ? ` / ${code.max_uses}` : ''}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <span className="text-gray-500">{code.min_amount ? `${code.min_amount} ر.س` : '—'}</span>
                      </td>
                      <td className="px-5 py-3">
                        {code.applicable_plans && code.applicable_plans.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {code.applicable_plans.map(p => (
                              <span key={p} className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-blue-50 text-blue-600">{p}</span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-gray-400">الكل</span>
                        )}
                      </td>
                      <td className="px-5 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${status.color}`}>
                          {status.label}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-1">
                          <button onClick={() => toggleActive(code)} className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-gray-100 transition-colors" title={code.is_active ? 'تعطيل' : 'تفعيل'}>
                            {code.is_active ? <ToggleRight className="h-4 w-4 text-emerald-500" /> : <ToggleLeft className="h-4 w-4 text-gray-300" />}
                          </button>
                          <EditDiscountDialog code={code} onSave={fetchCodes}>
                            <button className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-gray-100 transition-colors" title="تعديل">
                              <Pencil className="h-3.5 w-3.5 text-gray-400" />
                            </button>
                          </EditDiscountDialog>
                          <button onClick={() => deleteCode(code)} className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-red-50 transition-colors" title="حذف">
                            <Trash2 className="h-3.5 w-3.5 text-red-400" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
