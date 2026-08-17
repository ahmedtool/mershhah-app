'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogTrigger, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Plus, Pencil, Trash2, ChevronUp, ChevronDown, ArrowRight, Check, ListChecks, Tag, Search } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { syncPublicPage } from '@/lib/public-pages';
import { cn } from '@/lib/utils';
import type { MenuCategory, MenuItem } from '@/lib/types';
import { COMMON_CATEGORY_SUGGESTIONS } from '@/lib/category-suggestions';

interface ManageCategoriesDialogProps {
  children: React.ReactNode;
  restaurantId: string;
  menuItems: MenuItem[];
  onSave?: () => void;
}

export function ManageCategoriesDialog({ children, restaurantId, menuItems, onSave }: ManageCategoriesDialogProps) {
  const [open, setOpen] = useState(false);
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [newName, setNewName] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [assigning, setAssigning] = useState<MenuCategory | null>(null);
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set());
  const [isSavingAssignment, setIsSavingAssignment] = useState(false);
  const [itemSearch, setItemSearch] = useState('');
  const { toast } = useToast();

  const existingNames = new Set(categories.map((c) => c.name.trim().toLowerCase()));
  const categorySuggestions = COMMON_CATEGORY_SUGGESTIONS.filter((name) => {
    if (existingNames.has(name.toLowerCase())) return false;
    const q = newName.trim().toLowerCase();
    return q ? name.toLowerCase().includes(q) : true;
  }).slice(0, 8);

  const visibleItems = menuItems.filter((item) =>
    item.name.toLowerCase().includes(itemSearch.trim().toLowerCase())
  );

  const fetchCategories = async () => {
    setIsLoading(true);
    const { data } = await supabase
      .from('menu_categories')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .order('position');
    setCategories((data || []) as MenuCategory[]);
    setIsLoading(false);
  };

  useEffect(() => {
    if (open) {
      fetchCategories();
      setAssigning(null);
    }
  }, [open, restaurantId]);

  const countInCategory = (categoryId: string) => menuItems.filter((i) => i.category_id === categoryId).length;

  const handleAdd = async (nameOverride?: string) => {
    const name = (nameOverride ?? newName).trim();
    if (!name) return;
    setIsAdding(true);
    try {
      const { error } = await supabase.from('menu_categories').insert({
        restaurant_id: restaurantId,
        name,
        position: categories.length,
      });
      if (error) throw error;
      setNewName('');
      fetchCategories();
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'خطأ', description: e.message });
    } finally {
      setIsAdding(false);
    }
  };

  const handleRename = async (cat: MenuCategory) => {
    const name = renameValue.trim();
    if (!name || name === cat.name) { setRenamingId(null); return; }
    setBusyId(cat.id);
    try {
      const { error } = await supabase.from('menu_categories').update({ name }).eq('id', cat.id);
      if (error) throw error;
      // Keep the denormalized text mirror on items in sync with the rename.
      await supabase.from('menu_items').update({ category: name }).eq('category_id', cat.id);
      setRenamingId(null);
      fetchCategories();
      onSave?.();
      syncPublicPage(restaurantId).catch(() => {});
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'خطأ', description: e.message });
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (cat: MenuCategory) => {
    const count = countInCategory(cat.id);
    if (!confirm(count > 0 ? `حذف "${cat.name}"؟ ${count} صنف بيصير بدون تصنيف.` : `حذف "${cat.name}"؟`)) return;
    setBusyId(cat.id);
    try {
      await supabase.from('menu_items').update({ category_id: null, category: '' }).eq('category_id', cat.id);
      const { error } = await supabase.from('menu_categories').delete().eq('id', cat.id);
      if (error) throw error;
      fetchCategories();
      onSave?.();
      syncPublicPage(restaurantId).catch(() => {});
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'خطأ', description: e.message });
    } finally {
      setBusyId(null);
    }
  };

  const handleReorder = async (index: number, direction: -1 | 1) => {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= categories.length) return;
    const a = categories[index];
    const b = categories[targetIndex];
    setBusyId(a.id);
    try {
      await Promise.all([
        supabase.from('menu_categories').update({ position: b.position }).eq('id', a.id),
        supabase.from('menu_categories').update({ position: a.position }).eq('id', b.id),
      ]);
      fetchCategories();
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'خطأ', description: e.message });
    } finally {
      setBusyId(null);
    }
  };

  const openAssignment = (cat: MenuCategory) => {
    setAssigning(cat);
    setItemSearch('');
    setSelectedItemIds(new Set(menuItems.filter((i) => i.category_id === cat.id).map((i) => i.id)));
  };

  const toggleItem = (itemId: string) => {
    setSelectedItemIds((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId); else next.add(itemId);
      return next;
    });
  };

  const saveAssignment = async () => {
    if (!assigning) return;
    setIsSavingAssignment(true);
    try {
      const updates = menuItems
        .filter((item) => {
          const wasIn = item.category_id === assigning.id;
          const isIn = selectedItemIds.has(item.id);
          return wasIn !== isIn;
        })
        .map((item) => {
          const isIn = selectedItemIds.has(item.id);
          return supabase.from('menu_items').update(
            isIn ? { category_id: assigning.id, category: assigning.name } : { category_id: null, category: '' }
          ).eq('id', item.id);
        });
      await Promise.all(updates);
      toast({ title: 'تم حفظ الربط' });
      setAssigning(null);
      onSave?.();
      syncPublicPage(restaurantId).catch(() => {});
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'خطأ', description: e.message });
    } finally {
      setIsSavingAssignment(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-lg max-h-[92vh] overflow-y-auto p-0 gap-0" dir="rtl">
        <DialogTitle className="sr-only">إدارة التصنيفات</DialogTitle>
        <DialogDescription className="sr-only">أنشئ تصنيفات ورتّبها وحدد الأصناف اللي تنتمي لكل وحدة</DialogDescription>

        {!assigning ? (
          <>
            <div className="px-5 pt-5 pb-3 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center">
                  <Tag className="h-5 w-5 text-gray-500" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-gray-900">إدارة التصنيفات</h2>
                  <p className="text-xs text-gray-400 mt-0.5">رتّبها بالسحب، وحدد أصناف كل تصنيف</p>
                </div>
              </div>
            </div>

            <div className="p-5 space-y-4">
              <div className="flex gap-2">
                <Input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
                  placeholder="اسم تصنيف جديد..."
                  className="h-10 rounded-xl border-gray-200 text-sm"
                  disabled={isAdding}
                />
                <button
                  onClick={() => handleAdd()}
                  disabled={isAdding || !newName.trim()}
                  className="h-10 px-4 rounded-xl bg-gray-900 text-white text-xs font-bold hover:bg-gray-800 disabled:opacity-50 flex items-center gap-1.5 shrink-0"
                >
                  {isAdding ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                  إضافة
                </button>
              </div>

              {categorySuggestions.length > 0 && (
                <div className="flex flex-wrap gap-1.5 -mt-1.5">
                  {categorySuggestions.map((name) => (
                    <button
                      key={name}
                      type="button"
                      onClick={() => handleAdd(name)}
                      disabled={isAdding}
                      className="px-2.5 py-1 rounded-full border border-gray-200 text-[11px] font-medium text-gray-500 hover:border-gray-400 hover:text-gray-700 transition-colors disabled:opacity-50"
                    >
                      + {name}
                    </button>
                  ))}
                </div>
              )}

              {isLoading ? (
                <div className="flex items-center justify-center py-10">
                  <Loader2 className="h-5 w-5 animate-spin text-gray-300" />
                </div>
              ) : categories.length === 0 ? (
                <p className="text-center text-sm text-gray-400 py-10">لا توجد تصنيفات بعد — أضف أول واحد فوق</p>
              ) : (
                <div className="space-y-2">
                  {categories.map((cat, index) => (
                    <div key={cat.id} className="flex items-center gap-2 border border-gray-100 rounded-xl p-2.5">
                      <div className="flex flex-col shrink-0">
                        <button onClick={() => handleReorder(index, -1)} disabled={index === 0 || busyId === cat.id}
                          className="text-gray-300 hover:text-gray-600 disabled:opacity-30">
                          <ChevronUp className="h-3.5 w-3.5" />
                        </button>
                        <button onClick={() => handleReorder(index, 1)} disabled={index === categories.length - 1 || busyId === cat.id}
                          className="text-gray-300 hover:text-gray-600 disabled:opacity-30">
                          <ChevronDown className="h-3.5 w-3.5" />
                        </button>
                      </div>

                      {renamingId === cat.id ? (
                        <Input
                          value={renameValue}
                          onChange={(e) => setRenameValue(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && handleRename(cat)}
                          onBlur={() => handleRename(cat)}
                          autoFocus
                          className="h-8 rounded-lg border-gray-200 text-xs flex-1"
                        />
                      ) : (
                        <button onClick={() => openAssignment(cat)} className="flex-1 text-right min-w-0">
                          <p className="text-sm font-bold text-gray-900 truncate">{cat.name}</p>
                          <p className="text-[10px] text-gray-400">{countInCategory(cat.id)} صنف</p>
                        </button>
                      )}

                      <button onClick={() => openAssignment(cat)}
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-50 transition-colors shrink-0" title="ربط الأصناف">
                        <ListChecks className="h-3.5 w-3.5" />
                      </button>
                      <button onClick={() => { setRenamingId(cat.id); setRenameValue(cat.name); }}
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-50 transition-colors shrink-0">
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button onClick={() => handleDelete(cat)} disabled={busyId === cat.id}
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors shrink-0 disabled:opacity-50">
                        {busyId === cat.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        ) : (
          <>
            <div className="px-5 pt-5 pb-3 border-b border-gray-100">
              <button onClick={() => setAssigning(null)} className="flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-gray-700 transition-colors mb-3">
                <ArrowRight className="h-3.5 w-3.5" />
                رجوع للتصنيفات
              </button>
              <h2 className="text-base font-bold text-gray-900">أصناف "{assigning.name}"</h2>
              <p className="text-xs text-gray-400 mt-0.5">حدد الأصناف اللي تنتمي لهذا التصنيف</p>
            </div>

            <div className="px-5 pt-3">
              <div className="relative">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-300" />
                <Input
                  value={itemSearch}
                  onChange={(e) => setItemSearch(e.target.value)}
                  placeholder="ابحث عن صنف..."
                  className="h-9 rounded-xl border-gray-200 text-sm pr-9"
                />
              </div>
            </div>

            <div className="p-5 space-y-1.5 max-h-[50vh] overflow-y-auto">
              {menuItems.length === 0 ? (
                <p className="text-center text-sm text-gray-400 py-10">لا توجد أصناف بالمنيو بعد</p>
              ) : visibleItems.length === 0 ? (
                <p className="text-center text-sm text-gray-400 py-10">لا توجد نتائج لـ "{itemSearch}"</p>
              ) : (
                visibleItems.map((item) => {
                  const isSelected = selectedItemIds.has(item.id);
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => toggleItem(item.id)}
                      className={cn(
                        "w-full flex items-center gap-3 p-2.5 rounded-xl border text-right transition-colors",
                        isSelected ? "bg-gray-900 border-gray-900" : "border-gray-100 hover:border-gray-200"
                      )}
                    >
                      <div className={cn(
                        "w-5 h-5 rounded-md border flex items-center justify-center shrink-0",
                        isSelected ? "bg-white border-white" : "border-gray-300"
                      )}>
                        {isSelected && <Check className="h-3.5 w-3.5 text-gray-900" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={cn("text-xs font-bold truncate", isSelected ? "text-white" : "text-gray-900")}>{item.name}</p>
                        {item.category && item.category_id !== assigning.id && (
                          <p className={cn("text-[10px]", isSelected ? "text-gray-300" : "text-gray-400")}>حالياً: {item.category}</p>
                        )}
                      </div>
                    </button>
                  );
                })
              )}
            </div>

            <div className="px-5 pb-5 pt-2 flex gap-2">
              <button onClick={() => setAssigning(null)} className="flex-1 h-11 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors">
                إلغاء
              </button>
              <button onClick={saveAssignment} disabled={isSavingAssignment}
                className="flex-1 h-11 rounded-xl bg-gray-900 text-white text-sm font-medium hover:bg-gray-800 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                {isSavingAssignment ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {isSavingAssignment ? 'جاري الحفظ...' : 'حفظ الربط'}
              </button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
