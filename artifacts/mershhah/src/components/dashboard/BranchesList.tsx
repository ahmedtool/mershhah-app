'use client';

import { useState } from 'react';
import { Pencil, Trash2, MapPin, Phone, Layers, Clock, Link2, X, CheckSquare } from 'lucide-react';
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
import { cn } from '@/lib/utils';
import type { Branch } from '@/lib/types';

interface BranchesListProps {
  branches: Branch[];
  restaurantId: string;
  username?: string | null;
  onChanged?: () => void;
}

export function BranchesList({ branches, restaurantId, username, onChanged }: BranchesListProps) {
  const { toast } = useToast();
  const [editBranch, setEditBranch] = useState<Branch | null>(null);
  const [deleteBranch, setDeleteBranch] = useState<Branch | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [bulkEditOpen, setBulkEditOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const selectedBranches = branches.filter((b) => selectedIds.has(b.id));

  const toggleSelected = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => setSelectedIds(new Set(branches.map((b) => b.id)));
  const clearSelection = () => setSelectedIds(new Set());

  const handleCopyBranchLink = (branch: Branch) => {
    if (!username) return;
    const link = `${window.location.origin}/${username}?branch=${branch.id}`;
    navigator.clipboard.writeText(link);
    toast({ title: 'تم نسخ رابط الفرع', description: 'اطبعه كرمز QR أو شاركه — العروض الخاصة بهذا الفرع تظهر لمن يفتحه' });
  };

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
          <MapPin className="h-7 w-7 text-gray-600" />
        </div>
        <p className="text-sm font-medium text-gray-600">لا توجد فروع بعد</p>
        <p className="text-xs text-gray-600 mt-1">اضغط "إضافة فرع" لبدء الإضافة</p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-3">
        {/* Selection bar - only appears once at least one branch is checked */}
        {selectedIds.size > 0 ? (
          <div className="flex items-center justify-between gap-3 flex-wrap bg-gray-900 rounded-xl px-4 py-2.5">
            <div className="flex items-center gap-3">
              <span className="text-xs font-bold text-white">{selectedIds.size} فرع محدد</span>
              {selectedIds.size < branches.length ? (
                <button onClick={selectAll} className="text-[11px] font-medium text-gray-300 hover:text-white transition-colors">
                  تحديد الكل ({branches.length})
                </button>
              ) : (
                <button onClick={clearSelection} className="text-[11px] font-medium text-gray-300 hover:text-white transition-colors">
                  إلغاء تحديد الكل
                </button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setBulkEditOpen(true)}
                className="h-8 px-3.5 rounded-lg bg-white text-gray-900 text-xs font-bold hover:bg-gray-100 transition-colors flex items-center gap-1.5"
              >
                <Layers className="h-3.5 w-3.5" />
                تعديل جماعي
              </button>
              <button
                onClick={clearSelection}
                title="إلغاء التحديد"
                className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-300 hover:text-white hover:bg-white/10 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        ) : branches.length > 1 ? (
          <p className="text-[11px] text-gray-600 flex items-center gap-1.5 px-0.5">
            <CheckSquare className="h-3 w-3" />
            حدد أكثر من فرع لتعديلهم دفعة وحدة
          </p>
        ) : null}

        {/* Branches grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {branches.map((branch) => {
            const isSelected = selectedIds.has(branch.id);
            return (
              <div
                key={branch.id}
                className={cn(
                  "group relative bg-white border rounded-xl p-4 hover:shadow-sm transition-all",
                  isSelected ? "border-gray-900 ring-1 ring-gray-900" : "border-gray-100 hover:border-gray-200"
                )}
              >
                {/* Header */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <button
                      onClick={() => toggleSelected(branch.id)}
                      title={isSelected ? "إلغاء التحديد" : "تحديد للتعديل الجماعي"}
                      className={cn(
                        "shrink-0 w-5 h-5 rounded-md border flex items-center justify-center transition-colors",
                        isSelected ? "bg-gray-900 border-gray-900 text-white" : "border-gray-300 text-transparent hover:border-gray-400"
                      )}
                    >
                      <svg viewBox="0 0 12 12" className="w-3 h-3" fill="none">
                        <path d="M2 6l2.5 2.5L10 3" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </button>
                    <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center text-sm font-bold text-gray-600 shrink-0">
                      {branch.name?.[0] || 'ف'}
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-sm font-semibold text-gray-900 leading-tight truncate">{branch.name}</h3>
                      <p className="text-[11px] text-gray-600 mt-0.5 truncate">{branch.city} · {branch.district}</p>
                    </div>
                  </div>

                  {/* Status */}
                  <span className={`shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                    branch.status === 'active' ? 'bg-emerald-50 text-emerald-600' : 'bg-gray-100 text-gray-600'
                  }`}>
                    {branch.status === 'active' ? 'نشط' : 'معطّل'}
                  </span>
                </div>

                {/* Info */}
                <div className="space-y-1.5 mb-3">
                  {branch.phone && (
                    <a href={`tel:${branch.phone}`} className="flex items-center gap-1.5 text-xs text-gray-600 hover:text-gray-900 transition-colors">
                      <Phone className="h-3 w-3 text-gray-600" />
                      {branch.phone}
                    </a>
                  )}
                  {branch.opening_hours && (
                    <div className="flex items-center gap-1.5 text-xs text-gray-600">
                      <Clock className="h-3 w-3 text-gray-600" />
                      <span className="truncate">{branch.opening_hours}</span>
                    </div>
                  )}
                  {branch.address && (
                    <div className="flex items-center gap-1.5 text-xs text-gray-600">
                      <MapPin className="h-3 w-3 text-gray-600 shrink-0" />
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
                    onClick={() => handleCopyBranchLink(branch)}
                    disabled={!username}
                    title="نسخ رابط خاص بهذا الفرع"
                    className="flex-1 flex items-center justify-center gap-1.5 h-8 rounded-lg text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-40"
                  >
                    <Link2 className="h-3.5 w-3.5" />
                    رابط الفرع
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
            );
          })}
        </div>
      </div>

      <BulkEditDialog
        open={bulkEditOpen}
        onOpenChange={setBulkEditOpen}
        branches={selectedBranches}
        restaurantId={restaurantId}
        onSaved={() => { setBulkEditOpen(false); clearSelection(); onChanged?.(); }}
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
