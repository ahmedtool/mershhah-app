'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Pencil, Trash2, MapPin, Phone, Layers, MoreVertical, Clock } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabase';
import { syncPublicPage } from '@/lib/public-pages';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { EditBranchDialog } from './EditBranchDialog';
import { BulkEditDialog } from './BulkEditDialog';
import type { Branch } from '@/lib/types';

interface BranchesListProps {
  branches: Branch[];
  restaurantId: string;
  onChanged?: () => void;
}

export function BranchesList({ branches, restaurantId, onChanged }: BranchesListProps) {
  const { toast } = useToast();
  const [editBranch, setEditBranch] = useState<Branch | null>(null);
  const [deleteBranch, setDeleteBranch] = useState<Branch | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [bulkEditOpen, setBulkEditOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState<string | null>(null);

  const handleDelete = async () => {
    if (!deleteBranch || !restaurantId) return;
    setDeleting(true);
    try {
      const { error } = await supabase
        .from('branches')
        .delete()
        .eq('id', deleteBranch.id)
        .eq('restaurant_id', restaurantId);
      if (error) throw error;
      toast({ title: 'تم حذف الفرع' });
      syncPublicPage(restaurantId).catch(() => {});
      onChanged?.();
      setDeleteBranch(null);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      toast({ variant: 'destructive', title: 'خطأ في الحذف', description: msg });
    } finally {
      setDeleting(false);
    }
  };

  if (branches.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
          <MapPin className="h-7 w-7 text-gray-300" />
        </div>
        <p className="text-sm font-medium text-gray-600">لا توجد فروع بعد</p>
        <p className="text-xs text-gray-400 mt-1">اضغط "إضافة فرع" لبدء الإضافة</p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-3">
        {/* Bulk edit button */}
        {branches.length > 1 && (
          <button
            onClick={() => setBulkEditOpen(true)}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-dashed border-gray-200 text-sm font-medium text-gray-500 hover:border-gray-300 hover:text-gray-700 hover:bg-gray-50/50 transition-all"
          >
            <Layers className="h-4 w-4" />
            تعديل جماعي ({branches.length} فروع)
          </button>
        )}

        {/* Branches grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {branches.map((branch) => (
            <div
              key={branch.id}
              className="group relative bg-white border border-gray-100 rounded-xl p-4 hover:border-gray-200 hover:shadow-sm transition-all"
            >
              {/* Header */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center text-sm font-bold text-gray-500">
                    {branch.name?.[0] || 'ف'}
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900 leading-tight">{branch.name}</h3>
                    <p className="text-[11px] text-gray-400 mt-0.5">{branch.city} · {branch.district}</p>
                  </div>
                </div>

                {/* Status */}
                <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                  branch.status === 'active' ? 'bg-emerald-50 text-emerald-600' : 'bg-gray-100 text-gray-400'
                }`}>
                  {branch.status === 'active' ? 'نشط' : 'معطّل'}
                </span>
              </div>

              {/* Info */}
              <div className="space-y-1.5 mb-3">
                {branch.phone && (
                  <a href={`tel:${branch.phone}`} className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-900 transition-colors">
                    <Phone className="h-3 w-3 text-gray-300" />
                    {branch.phone}
                  </a>
                )}
                {branch.opening_hours && (
                  <div className="flex items-center gap-1.5 text-xs text-gray-500">
                    <Clock className="h-3 w-3 text-gray-300" />
                    <span className="truncate">{branch.opening_hours}</span>
                  </div>
                )}
                {branch.address && (
                  <div className="flex items-center gap-1.5 text-xs text-gray-400">
                    <MapPin className="h-3 w-3 text-gray-300 shrink-0" />
                    <span className="truncate">{branch.address}</span>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1 pt-2 border-t border-gray-50">
                <button
                  onClick={() => setEditBranch(branch)}
                  className="flex-1 flex items-center justify-center gap-1.5 h-8 rounded-lg text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  <Pencil className="h-3.5 w-3.5" />
                  تعديل
                </button>
                <div className="w-px h-4 bg-gray-100" />
                <button
                  onClick={() => setDeleteBranch(branch)}
                  className="flex-1 flex items-center justify-center gap-1.5 h-8 rounded-lg text-xs font-medium text-red-500 hover:bg-red-50 transition-colors"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  حذف
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <BulkEditDialog
        open={bulkEditOpen}
        onOpenChange={setBulkEditOpen}
        branches={branches}
        restaurantId={restaurantId}
        onSaved={() => { setBulkEditOpen(false); onChanged?.(); }}
      />

      <EditBranchDialog
        open={Boolean(editBranch)}
        onOpenChange={(open) => !open && setEditBranch(null)}
        branch={editBranch}
        restaurantId={restaurantId}
        onSaved={() => { setEditBranch(null); onChanged?.(); }}
      />

      <AlertDialog open={Boolean(deleteBranch)} onOpenChange={(o) => !o && setDeleteBranch(null)}>
        <AlertDialogContent dir="rtl" className="text-right">
          <AlertDialogHeader>
            <AlertDialogTitle>حذف الفرع</AlertDialogTitle>
            <AlertDialogDescription>
              هل أنت متأكد من حذف &quot;{deleteBranch?.name}&quot;؟ لا يمكن التراجع.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>إلغاء</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleting} className="bg-destructive hover:bg-destructive/90">
              {deleting ? 'جاري الحذف...' : 'حذف'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
