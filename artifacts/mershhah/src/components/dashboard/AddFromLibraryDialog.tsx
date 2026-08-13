'use client';

import { useState, useTransition, useEffect, useRef, useMemo } from 'react';
import { Dialog, DialogContent, DialogTrigger, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Search, ArrowRight, UploadCloud, X, Library } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { StorageImage } from '@/components/shared/StorageImage';
import { syncPublicPage } from '@/lib/public-pages';
import { useUser } from '@/hooks/useUser';
import type { SharedMenuProduct, MenuItem } from '@/lib/types';

interface AddFromLibraryDialogProps {
  children: React.ReactNode;
  restaurantId?: string | null;
  menuItems?: MenuItem[];
  itemCount?: number;
  onSave?: () => void;
}

export function AddFromLibraryDialog({ children, restaurantId, menuItems, itemCount = 0, onSave }: AddFromLibraryDialogProps) {
  const [open, setOpen] = useState(false);
  const [products, setProducts] = useState<SharedMenuProduct[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<SharedMenuProduct | null>(null);
  const [category, setCategory] = useState('');
  const [price, setPrice] = useState('');
  const [cost, setCost] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isSaving, startSaving] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const { user } = useUser();

  const uniqueCategories = useMemo(() => {
    if (!menuItems) return [];
    return [...new Set(menuItems.map(i => i.category).filter(Boolean))];
  }, [menuItems]);

  useEffect(() => {
    if (!open) return;
    setSelected(null);
    setSearch('');
    supabase.from('shared_menu_products').select('*').order('name').then(({ data }: { data: any[] | null }) => {
      setProducts((data || []) as SharedMenuProduct[]);
      setIsLoading(false);
    });
  }, [open]);

  const filteredProducts = useMemo(() => {
    if (!search.trim()) return products;
    return products.filter(p => p.name.toLowerCase().includes(search.toLowerCase()));
  }, [products, search]);

  const handleSelect = (product: SharedMenuProduct) => {
    setSelected(product);
    setCategory(product.category || '');
    setPrice('');
    setCost('');
    setImageFile(null);
    setImagePreview(product.image_path || null);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 4 * 1024 * 1024) {
      toast({ title: 'الصورة كبيرة جداً', description: 'اختر صورة أقل من 4 ميجابايت', variant: 'destructive' });
      return;
    }
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  async function handleAdd() {
    if (!selected || !restaurantId) return;
    if (!category.trim()) {
      toast({ title: 'اختر تصنيف للصنف', variant: 'destructive' });
      return;
    }
    const priceNum = Number(price);
    if (!price || isNaN(priceNum) || priceNum < 0) {
      toast({ title: 'أدخل سعر صحيح', variant: 'destructive' });
      return;
    }

    const maxMenuItems = user?.entitlements?.maxMenuItems ?? 30;
    if (itemCount >= maxMenuItems) {
      toast({
        variant: 'destructive',
        title: 'وصلت للحد الأقصى من الأصناف',
        description: `باقتك الحالية (${user?.entitlements?.planName || ''}) تسمح بحد أقصى ${maxMenuItems} صنف. رقّي باقتك لإضافة المزيد.`,
      });
      return;
    }

    startSaving(async () => {
      try {
        const newId = crypto.randomUUID();
        let imagePath: string | null = null;

        if (imageFile) {
          const ext = imageFile.name.split('.').pop();
          const path = `restaurants/${restaurantId}/menu_items/${Date.now()}.${ext}`;
          const { error } = await supabase.storage.from('restaurant-assets').upload(path, imageFile);
          if (error) throw error;
          imagePath = path;
        } else if (selected.image_path) {
          // Independent snapshot copy: physically duplicates the storage object
          // so later admin edits to the library item never affect this restaurant's copy.
          const ext = selected.image_path.split('.').pop() || 'jpg';
          const newPath = `restaurants/${restaurantId}/menu_items/${Date.now()}.${ext}`;
          const { error } = await supabase.storage.from('restaurant-assets').copy(selected.image_path, newPath);
          if (error) throw error;
          imagePath = newPath;
        }

        const { error } = await supabase.from('menu_items').insert({
          id: newId,
          restaurant_id: restaurantId,
          name: selected.name,
          description: '',
          category,
          image_url: imagePath || '',
          status: 'available',
          display_tags: 'none',
          calories: selected.calories || 0,
          allergens: [],
          position: itemCount,
          created_at: new Date().toISOString(),
          sizes: [{ id: `s-${Date.now()}`, name: 'عادي', price: priceNum, cost: Number(cost) || 0, calories: selected.calories || 0 }],
        });
        if (error) throw error;

        toast({ title: 'تمت إضافة الصنف للمنيو' });
        syncPublicPage(restaurantId).catch(() => {});
        onSave?.();
        setOpen(false);
      } catch (e: any) {
        toast({ variant: 'destructive', title: 'خطأ', description: e.message });
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-lg max-h-[92vh] overflow-y-auto p-0 gap-0" dir="rtl">
        <DialogTitle className="sr-only">إضافة من المكتبة المشتركة</DialogTitle>
        <DialogDescription className="sr-only">تصفح منتجات جاهزة وأضفها لمنيوك</DialogDescription>

        {!selected ? (
          <>
            <div className="px-5 pt-5 pb-3 border-b border-gray-100 space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center">
                  <Library className="h-5 w-5 text-gray-500" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-gray-900">المكتبة المشتركة</h2>
                  <p className="text-xs text-gray-400 mt-0.5">اختر منتجاً جاهزاً بصورته وسعراته الحرارية</p>
                </div>
              </div>
              <div className="relative">
                <Search className="absolute end-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-300" />
                <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="ابحث عن منتج..." className="h-10 rounded-xl border-gray-200 text-sm pe-9" />
              </div>
            </div>

            <div className="p-5">
              {isLoading ? (
                <div className="flex items-center justify-center py-10">
                  <Loader2 className="h-5 w-5 animate-spin text-gray-300" />
                </div>
              ) : filteredProducts.length === 0 ? (
                <p className="text-center text-sm text-gray-400 py-10">لا توجد منتجات مطابقة</p>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {filteredProducts.map((product) => (
                    <button
                      key={product.id}
                      type="button"
                      onClick={() => handleSelect(product)}
                      className="text-right rounded-2xl border border-gray-100 hover:border-gray-300 hover:shadow-sm transition-all overflow-hidden"
                    >
                      <div className="aspect-square bg-gray-50 relative">
                        <StorageImage imagePath={product.image_path} alt={product.name} fill className="w-full h-full object-cover" />
                      </div>
                      <div className="p-2">
                        <p className="text-xs font-bold text-gray-900 truncate">{product.name}</p>
                        {!!product.calories && <p className="text-[10px] text-gray-400">{product.calories} سعرة</p>}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </>
        ) : (
          <>
            <div className="relative w-full aspect-[16/9] bg-gray-100 overflow-hidden">
              {imagePreview ? (
                <>
                  <StorageImage imagePath={imagePreview} alt={selected.name} fill className="object-cover" sizes="600px" />
                  <button type="button" onClick={() => { setImagePreview(null); setImageFile(null); }}
                    className="absolute top-3 left-3 w-8 h-8 rounded-full bg-black/50 flex items-center justify-center text-white hover:bg-black/70 transition-colors">
                    <X className="h-4 w-4" />
                  </button>
                </>
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 cursor-pointer hover:bg-gray-200/50 transition-colors" onClick={() => fileInputRef.current?.click()}>
                  <div className="w-14 h-14 rounded-2xl bg-gray-200 flex items-center justify-center">
                    <UploadCloud className="h-6 w-6 text-gray-400" />
                  </div>
                  <p className="text-sm text-gray-400">اضغط لرفع صورة</p>
                </div>
              )}
              <button type="button" onClick={() => fileInputRef.current?.click()}
                className="absolute bottom-3 left-3 h-8 px-3 rounded-full bg-white/90 text-[11px] font-bold text-gray-700 hover:bg-white transition-colors">
                تغيير الصورة
              </button>
            </div>
            <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" className="hidden" />

            <div className="p-5 space-y-4">
              <button type="button" onClick={() => setSelected(null)} className="flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-gray-700 transition-colors">
                <ArrowRight className="h-3.5 w-3.5" />
                رجوع للمكتبة
              </button>

              <div>
                <h3 className="text-base font-bold text-gray-900">{selected.name}</h3>
                {!!selected.calories && <p className="text-xs text-gray-400 mt-0.5">{selected.calories} سعرة حرارية</p>}
              </div>

              <div>
                <label className="text-xs text-gray-500 block mb-1.5">التصنيف في منيوك</label>
                <Input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="مثال: مشروبات" className="h-11 rounded-xl border-gray-200 text-sm" disabled={isSaving} />
                {uniqueCategories.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {uniqueCategories.map((cat) => (
                      <button key={cat} type="button" onClick={() => setCategory(cat)}
                        className={`px-2 py-0.5 rounded-full text-[10px] transition-colors ${category === cat ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
                        {cat}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500 block mb-1.5">السعر (ر.س)</label>
                  <Input type="number" min={0} step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0" className="h-11 rounded-xl border-gray-200 text-sm" dir="ltr" disabled={isSaving} />
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1.5">التكلفة (اختياري)</label>
                  <Input type="number" min={0} step="0.01" value={cost} onChange={(e) => setCost(e.target.value)} placeholder="0" className="h-11 rounded-xl border-gray-200 text-sm" dir="ltr" disabled={isSaving} />
                </div>
              </div>

              <div className="flex flex-wrap gap-2 pt-2">
                <button type="button" onClick={() => setOpen(false)} className="flex-1 h-11 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors">
                  إلغاء
                </button>
                <button type="button" onClick={handleAdd} disabled={isSaving}
                  className="flex-1 h-11 rounded-xl bg-gray-900 text-white text-sm font-medium hover:bg-gray-800 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                  {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {isSaving ? 'جاري الإضافة...' : 'إضافة للمنيو'}
                </button>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
