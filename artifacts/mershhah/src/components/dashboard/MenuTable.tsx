'use client';

import { Pencil, Trash2, Flame, CheckCircle, XCircle, MoreHorizontal, Package } from "lucide-react";
import { EditMenuItemDialog } from "./EditMenuItemDialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import React, { useState, useTransition } from "react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";
import { StorageImage } from "@/components/shared/StorageImage";
import type { MenuItem } from "@/lib/types";

interface MenuTableProps {
  items: MenuItem[];
  restaurantId: string;
  userId: string;
  onActionCompletion: () => void;
}

export function MenuTable({ items, restaurantId, userId, onActionCompletion }: MenuTableProps) {
  const { toast } = useToast();
  const [isDeleting, startDelete] = useTransition();
  const [itemToDelete, setItemToDelete] = useState<any | null>(null);

  const handleDelete = () => {
    if (!itemToDelete) return;
    startDelete(async () => {
      try {
        const { error } = await supabase.from('menu_items').delete().eq('id', itemToDelete.id);
        if (error) throw error;
        toast({ title: 'تم الحذف' });
        onActionCompletion();
        setItemToDelete(null);
      } catch (error: any) {
        toast({ variant: "destructive", title: 'خطأ', description: error.message });
      }
    });
  };

  const getPrice = (item: any) => {
    if (!item.sizes || !Array.isArray(item.sizes) || item.sizes.length === 0) return null;
    return item.sizes[0].price;
  };

  const getCost = (item: any) => {
    if (!item.sizes || !Array.isArray(item.sizes) || item.sizes.length === 0) return null;
    return item.sizes[0].cost;
  };

  const getTag = (item: any) => {
    if (item.display_tags === 'best_seller') return { label: 'الأكثر مبيعاً', color: 'bg-amber-50 text-amber-600' };
    if (item.display_tags === 'new') return { label: 'جديد', color: 'bg-blue-50 text-blue-600' };
    return null;
  };

  const getClassification = (item: any) => {
    const map: Record<string, { label: string; color: string }> = {
      Star: { label: 'نجمة', color: 'bg-amber-50 text-amber-600' },
      Puzzle: { label: 'لغز', color: 'bg-purple-50 text-purple-600' },
      'Plow-Horse': { label: 'حصان عمل', color: 'bg-blue-50 text-blue-600' },
      Dog: { label: 'يحتاج تحسين', color: 'bg-gray-50 text-gray-500' },
    };
    return map[item.classification] || map.Dog;
  };

  if (items.length === 0) {
    return (
      <div className="bg-white border border-gray-100 rounded-2xl p-12 text-center">
        <Package className="h-10 w-10 text-gray-200 mx-auto mb-3" />
        <p className="text-sm font-bold text-gray-900 mb-1">المنيو فارغ</p>
        <p className="text-xs text-gray-400">أضف أول طبق لتظهر כאן.</p>
      </div>
    );
  }

  return (
    <>
      <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => {
          const price = getPrice(item);
          const cost = getCost(item);
          const tag = getTag(item);
          const classification = getClassification(item);
          const profit = price != null && cost != null ? price - cost : null;
          const profitMargin = price != null && price > 0 && profit != null ? (profit / price) * 100 : null;
          const isAvailable = item.status !== 'unavailable';

          return (
            <div key={item.id} className="bg-white border border-gray-100 rounded-2xl overflow-hidden hover:border-gray-200 transition-colors group">
              {/* Image */}
              <div className="relative h-36 bg-gray-50">
                {item.image_url ? (
                  <StorageImage alt={item.name} className="object-cover w-full h-full" fill imagePath={item.image_url} sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Package className="h-10 w-10 text-gray-200" />
                  </div>
                )}
                {/* Status badge */}
                <div className="absolute top-2 right-2">
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[9px] font-bold ${isAvailable ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-500'}`}>
                    {isAvailable ? <CheckCircle className="h-2.5 w-2.5" /> : <XCircle className="h-2.5 w-2.5" />}
                    {isAvailable ? 'متاح' : 'غير متاح'}
                  </span>
                </div>
                {/* Tags */}
                {tag && (
                  <div className="absolute top-2 left-2">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[9px] font-bold ${tag.color}`}>
                      {tag.label}
                    </span>
                  </div>
                )}
              </div>

              {/* Content */}
              <div className="p-4">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h3 className="text-sm font-bold text-gray-900 leading-tight">{item.name}</h3>
                  <span className={`shrink-0 px-1.5 py-0.5 rounded text-[8px] font-bold ${classification.color}`}>
                    {classification.label}
                  </span>
                </div>

                {item.description && (
                  <p className="text-[10px] text-gray-400 leading-relaxed line-clamp-2 mb-3">{item.description}</p>
                )}

                {/* Price row */}
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <span className="text-lg font-black text-gray-900">{price != null ? price.toFixed(0) : '—'}</span>
                    <span className="text-[10px] text-gray-400 mr-1">ر.س</span>
                  </div>
                  {profitMargin != null && (
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-lg ${profitMargin >= 60 ? 'bg-emerald-50 text-emerald-600' : profitMargin >= 30 ? 'bg-amber-50 text-amber-600' : 'bg-red-50 text-red-500'}`}>
                      هامش {profitMargin.toFixed(0)}%
                    </span>
                  )}
                </div>

                {/* Info row */}
                <div className="flex items-center gap-3 text-[9px] text-gray-400 mb-3">
                  {cost != null && <span>التكلفة: {cost.toFixed(0)} ر.س</span>}
                  {profit != null && <span>الربح: {profit.toFixed(0)} ر.س</span>}
                  {typeof (item as any).popularity === 'number' && (item as any).popularity > 0 && (
                    <span className="flex items-center gap-0.5"><Flame className="h-2.5 w-2.5 text-amber-400" />{(item as any).popularity}</span>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 pt-3 border-t border-gray-50">
                  <EditMenuItemDialog menuItem={item} restaurantId={restaurantId} userId={userId} onSave={onActionCompletion} itemCount={items.length} menuItems={items}>
                    <button className="flex-1 h-8 rounded-lg border border-gray-200 text-[10px] font-bold text-gray-600 hover:bg-gray-50 transition-colors flex items-center justify-center gap-1">
                      <Pencil className="h-3 w-3" />
                      تعديل
                    </button>
                  </EditMenuItemDialog>
                  <button onClick={() => setItemToDelete(item)}
                    className="h-8 px-3 rounded-lg border border-gray-200 text-[10px] font-bold text-red-400 hover:bg-red-50 hover:text-red-500 hover:border-red-200 transition-colors flex items-center justify-center gap-1">
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <AlertDialog open={!!itemToDelete} onOpenChange={(open) => !open && setItemToDelete(null)}>
        <AlertDialogContent className="sm:max-w-lg p-0 gap-0" dir="rtl">
          <div className="px-5 pt-5 pb-3 border-b border-gray-100">
            <AlertDialogTitle className="text-base font-bold text-gray-900">حذف "{itemToDelete?.name}"</AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-gray-400 mt-0.5">لا يمكن التراجع عن هذا الإجراء.</AlertDialogDescription>
          </div>
          <div className="flex gap-2 px-5 pb-5 pt-3">
            <AlertDialogCancel disabled={isDeleting} className="flex-1 h-10 rounded-xl border border-gray-200 text-xs font-bold text-gray-600 hover:bg-gray-50">إلغاء</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={isDeleting}
              className="flex-1 h-10 rounded-xl bg-red-600 text-white text-xs font-bold hover:bg-red-700 disabled:opacity-50">
              {isDeleting ? 'جاري الحذف...' : 'نعم، حذف'}
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
