'use client';

import { useState, useTransition } from "react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Pencil, Trash2, Info, AlertTriangle, CheckCircle, Bell, Megaphone } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from '@/lib/supabase';
import { format } from "date-fns";
import { arSA } from "date-fns/locale";
import type { Announcement } from "@/lib/types";
import { EditAnnouncementDialog } from "./EditAnnouncementDialog";
import { cn } from "@/lib/utils";

interface AnnouncementsTableProps {
  announcements: Announcement[];
  onActionComplete: () => void;
}

const typeConfig = {
  info: { text: "معلومات", icon: Info, tileBg: "bg-blue-50", tileColor: "text-blue-600" },
  warning: { text: "تحذير", icon: AlertTriangle, tileBg: "bg-amber-50", tileColor: "text-amber-600" },
  success: { text: "نجاح", icon: CheckCircle, tileBg: "bg-emerald-50", tileColor: "text-emerald-600" },
  update: { text: "تحديث", icon: Bell, tileBg: "bg-violet-50", tileColor: "text-violet-600" },
};

export function AnnouncementsTable({ announcements, onActionComplete }: AnnouncementsTableProps) {
  const [announcementToDelete, setAnnouncementToDelete] = useState<Announcement | null>(null);
  const [isDeleting, startDelete] = useTransition();
  const { toast } = useToast();

  const handleDelete = () => {
    if (!announcementToDelete) return;
    startDelete(async () => {
      try {
        const { error } = await supabase.from('announcements').delete().eq('id', announcementToDelete.id);
        if (error) throw error;
        toast({ title: "تم حذف الإعلان بنجاح" });
        onActionComplete();
        setAnnouncementToDelete(null);
      } catch (error: any) {
        toast({ variant: "destructive", title: "خطأ في الحذف", description: error.message });
      }
    });
  };

  if (announcements.length === 0) {
    return (
      <div className="bg-white border border-gray-100 rounded-2xl p-10 text-center">
        <Megaphone className="h-8 w-8 text-gray-200 mx-auto mb-3" />
        <p className="text-sm font-bold text-gray-900 mb-1">لا توجد إعلانات</p>
        <p className="text-[11px] text-gray-400">أنشئ إعلاناً جديداً ليظهر لأصحاب المطاعم</p>
      </div>
    );
  }

  return (
    <>
      <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden divide-y divide-gray-50">
        {announcements.map((ann) => {
          const config = typeConfig[ann.type] ?? typeConfig.info;
          const Icon = config.icon;
          return (
            <div key={ann.id} className="flex items-center gap-3 px-4 py-3.5 hover:bg-gray-50/60 transition-colors">
              <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0", config.tileBg)}>
                <Icon className={cn("h-4.5 w-4.5", config.tileColor)} strokeWidth={2} />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-xs font-bold text-gray-900 truncate">{ann.title}</h3>
                  <span
                    className={cn("shrink-0 w-1.5 h-1.5 rounded-full", ann.isActive ? "bg-emerald-400" : "bg-gray-300")}
                    title={ann.isActive ? "نشط" : "غير نشط"}
                  />
                </div>
                <p className="text-[11px] text-gray-400 mt-0.5 truncate">{ann.content}</p>
              </div>

              <span className={cn("hidden sm:inline-flex shrink-0 text-[10px] font-bold px-2.5 py-1 rounded-full", config.tileBg, config.tileColor)}>
                {config.text}
              </span>

              <span className="hidden md:inline text-[10px] text-gray-400 shrink-0 w-20 text-center">
                {ann.createdAt ? format(new Date(ann.createdAt), 'd MMM yyyy', { locale: arSA }) : '-'}
              </span>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors">
                    <MoreHorizontal className="h-4 w-4" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <EditAnnouncementDialog announcement={ann} onSave={onActionComplete}>
                    <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                      <Pencil className="h-4 w-4" /> تعديل
                    </DropdownMenuItem>
                  </EditAnnouncementDialog>
                  <DropdownMenuItem onClick={() => setAnnouncementToDelete(ann)} className="text-destructive focus:text-destructive">
                    <Trash2 className="h-4 w-4" /> حذف
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          );
        })}
      </div>

      <AlertDialog open={!!announcementToDelete} onOpenChange={(open) => !open && setAnnouncementToDelete(null)}>
        <AlertDialogContent className="sm:max-w-md p-0 gap-0" dir="rtl">
          <div className="px-5 pt-5 pb-3 border-b border-gray-100">
            <AlertDialogTitle className="text-base font-bold text-gray-900">حذف "{announcementToDelete?.title}"</AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-gray-400 mt-0.5">لا يمكن التراجع عن هذا الإجراء.</AlertDialogDescription>
          </div>
          <div className="flex gap-2 px-5 pb-5 pt-3">
            <AlertDialogCancel disabled={isDeleting} className="flex-1 h-10 rounded-xl border border-gray-200 text-xs font-bold text-gray-600 hover:bg-gray-50">
              إلغاء
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={isDeleting} className="flex-1 h-10 rounded-xl bg-red-600 text-white text-xs font-bold hover:bg-red-700 disabled:opacity-50">
              {isDeleting ? 'جاري الحذف...' : 'نعم، حذف'}
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
