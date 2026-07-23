'use client';

import { useState, useTransition } from "react";
import { Shield, Mail, Trash2, KeyRound, Crown, Loader2, MoreHorizontal } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { toast } from "@/hooks/use-toast";
import type { Profile } from "@/lib/types";
import { useUser } from "@/hooks/useUser";
import { EditAdminDialog } from "./EditAdminDialog";
import { supabase } from "@/lib/supabase";

interface AdminUsersTableProps {
  admins: Profile[];
  onActionComplete: () => void;
}

const SUPER_ADMIN_EMAIL = 'ahmedsupsa@gmail.com';

export function AdminUsersTable({ admins, onActionComplete }: AdminUsersTableProps) {
  const { user: currentUser } = useUser();
  const [editingAdmin, setEditingAdmin] = useState<Profile | null>(null);
  const [adminToDelete, setAdminToDelete] = useState<Profile | null>(null);
  const [isDeleting, startDeleteTransition] = useTransition();
  const [isSendingReset, startResetTransition] = useTransition();

  const handleResetPassword = (admin: Profile) => {
    startResetTransition(async () => {
      try {
        const { error } = await supabase.auth.resetPasswordForEmail(admin.email);
        if (error) throw error;
        toast({ title: "تم إرسال الرابط", description: `تم إرسال رابط إعادة التعيين إلى ${admin.email}.` });
      } catch (error: any) {
        toast({ title: "خطأ", description: "لم نتمكن من إرسال الرابط.", variant: "destructive" });
      }
    });
  };

  const handleDelete = () => {
    if (!adminToDelete) return;
    startDeleteTransition(async () => {
      try {
        const { error } = await supabase.from('profiles').delete().eq('id', adminToDelete.id);
        if (error) throw error;
        toast({ title: "تم الحذف", description: `تم حذف ${adminToDelete.full_name}.` });
        onActionComplete();
      } catch (error: any) {
        toast({ title: "خطأ", description: error.message, variant: "destructive" });
      } finally {
        setAdminToDelete(null);
      }
    });
  };

  return (
    <>
      <div className="rounded-2xl border border-gray-100 overflow-hidden">
        {admins.length > 0 ? (
          <div className="divide-y divide-gray-50">
            {admins.map((admin) => {
              const isCurrentUser = admin.id === currentUser?.id;
              const isSuperAdmin = admin.email === SUPER_ADMIN_EMAIL;
              const canPerformActions = !isCurrentUser && !isSuperAdmin;

              return (
                <div key={admin.id} className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50 transition-colors">
                  <div className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center shrink-0">
                    <span className="text-xs font-bold text-gray-500">{admin.full_name?.charAt(0) || 'A'}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-gray-700 truncate">{admin.full_name}</span>
                      {isCurrentUser && <span className="text-[9px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">أنت</span>}
                      {isSuperAdmin && <span className="text-[9px] bg-amber-50 text-amber-600 px-1.5 py-0.5 rounded-full flex items-center gap-0.5"><Crown className="h-2.5 w-2.5" />المدير</span>}
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <Mail className="h-3 w-3 text-gray-300" />
                      <span className="text-[11px] text-gray-400">{admin.email}</span>
                    </div>
                  </div>
                  <span className="text-[10px] font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full shrink-0">نشط</span>
                  {canPerformActions && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-gray-100 transition-colors shrink-0" disabled={isSendingReset}>
                          {isSendingReset ? <Loader2 className="h-4 w-4 animate-spin text-gray-400" /> : <MoreHorizontal className="h-4 w-4 text-gray-400" />}
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48">
                        <DropdownMenuItem onSelect={() => setEditingAdmin(admin)}>
                          <Shield className="ml-2 h-4 w-4" /> تعديل الصلاحيات
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => handleResetPassword(admin)}>
                          <KeyRound className="ml-2 h-4 w-4" /> إعادة تعيين كلمة المرور
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-red-600" onSelect={() => setAdminToDelete(admin)}>
                          <Trash2 className="ml-2 h-4 w-4" /> حذف المسؤول
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="py-12 text-center text-gray-300 text-xs">لا يوجد مسؤولون</div>
        )}
      </div>

      {editingAdmin && (
        <EditAdminDialog
          admin={editingAdmin}
          open={!!editingAdmin}
          onOpenChange={(open) => !open && setEditingAdmin(null)}
          onAdminUpdated={() => { setEditingAdmin(null); onActionComplete(); }}
        />
      )}

      <AlertDialog open={!!adminToDelete} onOpenChange={(open) => !open && setAdminToDelete(null)}>
        <AlertDialogContent className="sm:max-w-lg p-0 gap-0" dir="rtl">
          <div className="px-5 pt-5 pb-3 border-b border-gray-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center">
                <Trash2 className="h-5 w-5 text-red-500" />
              </div>
              <div>
                <AlertDialogTitle className="text-base font-bold text-gray-900">حذف المسؤول</AlertDialogTitle>
                <AlertDialogDescription className="text-xs text-gray-400 mt-0.5">لا يمكن التراجع عن هذا الإجراء</AlertDialogDescription>
              </div>
            </div>
          </div>
          <div className="p-5">
            <p className="text-sm text-gray-600">
              سيتم حذف ملف <strong className="text-gray-900">{adminToDelete?.full_name}</strong> نهائياً من قاعدة البيانات.
            </p>
          </div>
          <div className="flex gap-2 px-5 pb-5">
            <AlertDialogCancel disabled={isDeleting} className="flex-1 h-11 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50">
              إلغاء
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={isDeleting}
              className="flex-1 h-11 rounded-xl bg-red-600 text-white text-sm font-medium hover:bg-red-700 disabled:opacity-50 flex items-center justify-center gap-2">
              {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              نعم، حذف
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
