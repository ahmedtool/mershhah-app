'use client';

import { useState, useEffect, useRef, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Plus, Pencil, Trash2, CupSoda, Search, Download, Upload, Loader2 } from "lucide-react";
import { EditSharedProductDialog } from "@/components/admin/shared-products/EditSharedProductDialog";
import { StorageImage } from "@/components/shared/StorageImage";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import type { SharedMenuProduct } from "@/lib/types";

const SHEET_HEADERS = ['المعرف', 'الاسم', 'التصنيف', 'السعرات الحرارية'];

export default function AdminSharedProductsPage() {
  const [products, setProducts] = useState<SharedMenuProduct[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('الكل');
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const fetchProducts = async () => {
    const { data } = await supabase.from('shared_menu_products').select('*').order('created_at', { ascending: false });
    setProducts((data || []) as SharedMenuProduct[]);
    setIsLoading(false);
  };

  useEffect(() => {
    fetchProducts();
    const channel = supabase.channel('admin_shared_products')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'shared_menu_products' }, fetchProducts)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const categories = useMemo(() => {
    const set = new Set(products.map((p) => p.category).filter(Boolean) as string[]);
    return ['الكل', ...Array.from(set).sort()];
  }, [products]);

  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter((p) => {
      const matchesCategory = activeCategory === 'الكل' || p.category === activeCategory;
      const matchesSearch = !q || p.name.toLowerCase().includes(q) || (p.category || '').toLowerCase().includes(q);
      return matchesCategory && matchesSearch;
    });
  }, [products, search, activeCategory]);

  const handleDelete = async (product: SharedMenuProduct) => {
    if (!confirm(`حذف "${product.name}" من المكتبة نهائياً؟`)) return;
    const { error } = await supabase.from('shared_menu_products').delete().eq('id', product.id);
    if (error) {
      toast({ variant: "destructive", title: "فشل الحذف", description: error.message });
    } else {
      toast({ title: "تم الحذف" });
    }
  };

  const handleDownloadTemplate = async () => {
    const XLSX = await import('xlsx');
    const rows = [
      SHEET_HEADERS,
      ...products.map((p) => [p.id, p.name, p.category || '', p.calories ?? '']),
    ];
    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = [{ wch: 38 }, { wch: 32 }, { wch: 20 }, { wch: 16 }];
    ws['!views'] = [{ RTL: true }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'المنتجات');
    XLSX.writeFile(wb, `مكتبة-المنتجات-${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setIsImporting(true);
    try {
      const XLSX = await import('xlsx');
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: 'array' });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const allRows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
      const dataRows = allRows.slice(1); // skip header row
      const existingIds = new Set(products.map((p) => p.id));

      const toInsert: { name: string; category: string | null; calories: number | null }[] = [];
      const toUpdate: { id: string; payload: { name: string; category: string | null; calories: number | null } }[] = [];

      for (const r of dataRows) {
        const [id, name, category, caloriesRaw] = r;
        const trimmedName = String(name ?? '').trim();
        if (!trimmedName) continue;
        const calories = caloriesRaw !== '' && caloriesRaw !== undefined && caloriesRaw !== null && !isNaN(Number(caloriesRaw))
          ? Number(caloriesRaw) : null;
        const payload = { name: trimmedName, category: String(category ?? '').trim() || null, calories };

        const trimmedId = String(id ?? '').trim();
        if (trimmedId && existingIds.has(trimmedId)) {
          toUpdate.push({ id: trimmedId, payload });
        } else {
          toInsert.push(payload);
        }
      }

      if (toInsert.length === 0 && toUpdate.length === 0) {
        toast({ variant: 'destructive', title: 'ما فيه صفوف صالحة بالملف' });
        return;
      }

      if (toInsert.length > 0) {
        const { error } = await supabase.from('shared_menu_products').insert(toInsert);
        if (error) throw error;
      }
      if (toUpdate.length > 0) {
        const results = await Promise.all(
          toUpdate.map((u) => supabase.from('shared_menu_products').update(u.payload).eq('id', u.id))
        );
        const failedCount = results.filter((r) => r.error).length;
        if (failedCount > 0) {
          toast({ variant: 'destructive', title: 'تنبيه', description: `${failedCount} صف فشل تحديثه` });
        }
      }

      toast({
        title: 'تم الاستيراد',
        description: `${toInsert.length} منتج جديد، ${toUpdate.length} منتج محدّث`,
      });
      fetchProducts();
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'فشل الاستيراد', description: e.message });
    } finally {
      setIsImporting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="p-4 lg:p-6 space-y-5">
        <Skeleton className="h-7 w-48" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-48 rounded-2xl" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-6 space-y-5" dir="rtl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-lg font-bold text-gray-900">مكتبة المنتجات المشتركة</h1>
          <p className="text-xs text-gray-600 mt-0.5">منتجات جاهزة (مشروبات، عصائر، حلويات، صوصات) يقدر أصحاب المطاعم إضافتها لمنيوهم</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <input type="file" ref={fileInputRef} onChange={handleFileSelected} accept=".xlsx,.xls" className="hidden" />
          <EditSharedProductDialog onSave={fetchProducts}>
            <button
              title="أضف منتجاً جديداً للمكتبة المشتركة"
              className="h-10 px-4 rounded-xl bg-gray-900 text-white text-xs font-bold hover:bg-gray-800 active:scale-[0.97] transition-all duration-200 flex items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              منتج جديد
            </button>
          </EditSharedProductDialog>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isImporting}
            title="ارفع ملف إكسل لتحديث أو إضافة منتجات بالجملة"
            className="h-10 px-3.5 rounded-xl border border-gray-200 text-gray-600 text-xs font-bold hover:bg-gray-50 hover:border-gray-300 active:scale-[0.97] transition-all duration-200 flex items-center gap-2 disabled:opacity-50"
          >
            {isImporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
            رفع ملف
          </button>
          <button
            onClick={handleDownloadTemplate}
            title="نزّل نسخة إكسل من المنتجات الحالية كقالب للتعديل"
            className="h-10 px-3.5 rounded-xl border border-gray-200 text-gray-600 text-xs font-bold hover:bg-gray-50 hover:border-gray-300 active:scale-[0.97] transition-all duration-200 flex items-center gap-2"
          >
            <Download className="h-3.5 w-3.5" />
            تحميل كملف إكسل
          </button>
        </div>
      </div>

      <div className="bg-amber-50 border border-amber-100 rounded-xl px-3.5 py-2.5">
        <p className="text-[11px] text-amber-700">
          حمّل الملف الحالي، عدّل عليه أو زد صفوف جديدة بإكسل، وارفعه مرة ثانية — الصفوف اللي فيها معرّف (المعرف) موجود تتحدّث، والصفوف الجديدة (بدون معرّف) تُضاف كمنتجات جديدة. لا تعدّل عمود "المعرف".
        </p>
      </div>

      <div className="space-y-3">
        <div className="relative max-w-sm">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-600" />
          <Input
            placeholder="ابحث بالاسم أو التصنيف..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 pe-9 text-xs rounded-xl border-gray-200 text-right"
          />
        </div>
        <div className="flex gap-1.5 overflow-x-auto scrollbar-hide">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={cn(
                "shrink-0 h-8 px-3.5 rounded-lg text-[11px] font-bold transition-colors border",
                activeCategory === cat
                  ? "bg-gray-900 text-white border-gray-900"
                  : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"
              )}
            >
              {cat}
            </button>
          ))}
        </div>
        <p className="text-[11px] text-gray-600">{filteredProducts.length} من {products.length} منتج</p>
      </div>

      {filteredProducts.length === 0 ? (
        <div className="bg-white border border-gray-100 rounded-2xl p-10 flex flex-col items-center justify-center text-center gap-2">
          <CupSoda className="h-8 w-8 text-gray-600" />
          <p className="text-sm text-gray-600">{products.length === 0 ? 'لا توجد منتجات في المكتبة بعد' : 'ما فيه نتائج مطابقة'}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {filteredProducts.map(product => (
            <div key={product.id} className="bg-white border border-gray-100 rounded-2xl overflow-hidden hover:shadow-md transition-shadow">
              <div className="aspect-square bg-gray-50 relative">
                <StorageImage imagePath={product.image_path} alt={product.name} fill className="w-full h-full object-cover" />
              </div>
              <div className="p-3 space-y-1">
                <h3 className="text-sm font-bold text-gray-900 truncate">{product.name}</h3>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">{product.category || '—'}</span>
                  {!!product.calories && <span className="text-[10px] text-gray-600">{product.calories} سعرة</span>}
                </div>
                <div className="flex items-center gap-2 pt-2">
                  <EditSharedProductDialog product={product} onSave={fetchProducts}>
                    <button className="flex-1 h-8 rounded-lg border border-gray-200 text-[11px] font-medium text-gray-600 hover:bg-gray-50 transition-colors flex items-center justify-center gap-1">
                      <Pencil className="h-3 w-3" />
                      تعديل
                    </button>
                  </EditSharedProductDialog>
                  <button onClick={() => handleDelete(product)}
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-600 hover:text-red-500 hover:bg-red-50 transition-colors shrink-0">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
