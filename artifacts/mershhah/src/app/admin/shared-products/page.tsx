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

const CSV_HEADERS = ['المعرف', 'الاسم', 'التصنيف', 'السعرات الحرارية'];

function csvEscape(value: string | number | null | undefined): string {
  const s = value === null || value === undefined ? '' : String(value);
  if (/[",\r\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

function buildCsv(rows: (string | number | null | undefined)[][]): string {
  return rows.map((row) => row.map(csvEscape).join(',')).join('\r\n');
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      row.push(field); field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.length > 1 || row[0] !== '') rows.push(row);
      row = [];
    } else {
      field += c;
    }
  }
  if (field !== '' || row.length > 0) { row.push(field); rows.push(row); }
  return rows;
}

function downloadTextFile(filename: string, content: string) {
  const blob = new Blob(['﻿' + content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

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

  const handleDownloadTemplate = () => {
    const rows = [
      CSV_HEADERS,
      ...products.map((p) => [p.id, p.name, p.category || '', p.calories ?? '']),
    ];
    downloadTextFile(`مكتبة-المنتجات-${new Date().toISOString().slice(0, 10)}.csv`, buildCsv(rows));
  };

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setIsImporting(true);
    try {
      const text = await file.text();
      const allRows = parseCsv(text.replace(/^﻿/, ''));
      const dataRows = allRows.slice(1); // skip header row
      const existingIds = new Set(products.map((p) => p.id));

      const toInsert: { name: string; category: string | null; calories: number | null }[] = [];
      const toUpdate: { id: string; payload: { name: string; category: string | null; calories: number | null } }[] = [];

      for (const r of dataRows) {
        const [id, name, category, caloriesStr] = r;
        const trimmedName = (name || '').trim();
        if (!trimmedName) continue;
        const calories = caloriesStr && !isNaN(Number(caloriesStr)) ? Number(caloriesStr) : null;
        const payload = { name: trimmedName, category: (category || '').trim() || null, calories };

        const trimmedId = (id || '').trim();
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
          <p className="text-xs text-gray-400 mt-0.5">منتجات جاهزة (مشروبات، عصائر، حلويات، صوصات) يقدر أصحاب المطاعم إضافتها لمنيوهم</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <input type="file" ref={fileInputRef} onChange={handleFileSelected} accept=".csv" className="hidden" />
          <button
            onClick={handleDownloadTemplate}
            className="h-10 px-3.5 rounded-xl border border-gray-200 text-gray-600 text-xs font-medium hover:bg-gray-50 transition-colors flex items-center gap-2"
          >
            <Download className="h-3.5 w-3.5" />
            تحميل كملف (Excel/CSV)
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isImporting}
            className="h-10 px-3.5 rounded-xl border border-gray-200 text-gray-600 text-xs font-medium hover:bg-gray-50 transition-colors flex items-center gap-2 disabled:opacity-50"
          >
            {isImporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
            رفع ملف
          </button>
          <EditSharedProductDialog onSave={fetchProducts}>
            <button className="h-10 px-4 rounded-xl bg-gray-900 text-white text-xs font-medium hover:bg-gray-800 transition-colors flex items-center gap-2">
              <Plus className="h-4 w-4" />
              منتج جديد
            </button>
          </EditSharedProductDialog>
        </div>
      </div>

      <div className="bg-amber-50 border border-amber-100 rounded-xl px-3.5 py-2.5">
        <p className="text-[11px] text-amber-700">
          حمّل الملف الحالي، عدّل عليه أو زد صفوف جديدة بإكسل، وارفعه مرة ثانية — الصفوف اللي فيها معرّف (المعرف) موجود تتحدّث، والصفوف الجديدة (بدون معرّف) تُضاف كمنتجات جديدة. لا تعدّل عمود "المعرف".
        </p>
      </div>

      <div className="space-y-3">
        <div className="relative max-w-sm">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-300" />
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
                  : "bg-white text-gray-500 border-gray-200 hover:border-gray-300"
              )}
            >
              {cat}
            </button>
          ))}
        </div>
        <p className="text-[11px] text-gray-400">{filteredProducts.length} من {products.length} منتج</p>
      </div>

      {filteredProducts.length === 0 ? (
        <div className="bg-white border border-gray-100 rounded-2xl p-10 flex flex-col items-center justify-center text-center gap-2">
          <CupSoda className="h-8 w-8 text-gray-300" />
          <p className="text-sm text-gray-400">{products.length === 0 ? 'لا توجد منتجات في المكتبة بعد' : 'ما فيه نتائج مطابقة'}</p>
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
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">{product.category || '—'}</span>
                  {!!product.calories && <span className="text-[10px] text-gray-400">{product.calories} سعرة</span>}
                </div>
                <div className="flex items-center gap-2 pt-2">
                  <EditSharedProductDialog product={product} onSave={fetchProducts}>
                    <button className="flex-1 h-8 rounded-lg border border-gray-200 text-[11px] font-medium text-gray-600 hover:bg-gray-50 transition-colors flex items-center justify-center gap-1">
                      <Pencil className="h-3 w-3" />
                      تعديل
                    </button>
                  </EditSharedProductDialog>
                  <button onClick={() => handleDelete(product)}
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors shrink-0">
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
