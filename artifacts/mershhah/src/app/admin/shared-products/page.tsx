'use client';

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Pencil, Trash2, CupSoda } from "lucide-react";
import { EditSharedProductDialog } from "@/components/admin/shared-products/EditSharedProductDialog";
import { StorageImage } from "@/components/shared/StorageImage";
import { useToast } from "@/hooks/use-toast";
import type { SharedMenuProduct } from "@/lib/types";

export default function AdminSharedProductsPage() {
  const [products, setProducts] = useState<SharedMenuProduct[]>([]);
  const [isLoading, setIsLoading] = useState(true);
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

  const handleDelete = async (product: SharedMenuProduct) => {
    if (!confirm(`حذف "${product.name}" من المكتبة نهائياً؟`)) return;
    const { error } = await supabase.from('shared_menu_products').delete().eq('id', product.id);
    if (error) {
      toast({ variant: "destructive", title: "فشل الحذف", description: error.message });
    } else {
      toast({ title: "تم الحذف" });
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-gray-900">مكتبة المنتجات المشتركة</h1>
          <p className="text-xs text-gray-400 mt-0.5">منتجات جاهزة (مشروبات، عصائر، حلويات، صوصات) يقدر أصحاب المطاعم إضافتها لمنيوهم</p>
        </div>
        <EditSharedProductDialog onSave={fetchProducts}>
          <button className="h-10 px-4 rounded-xl bg-gray-900 text-white text-xs font-medium hover:bg-gray-800 transition-colors flex items-center gap-2">
            <Plus className="h-4 w-4" />
            منتج جديد
          </button>
        </EditSharedProductDialog>
      </div>

      {products.length === 0 ? (
        <div className="bg-white border border-gray-100 rounded-2xl p-10 flex flex-col items-center justify-center text-center gap-2">
          <CupSoda className="h-8 w-8 text-gray-300" />
          <p className="text-sm text-gray-400">لا توجد منتجات في المكتبة بعد</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {products.map(product => (
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
