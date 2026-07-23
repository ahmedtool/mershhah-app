'use client';

import { useState, useTransition } from "react";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MoreHorizontal, Pencil, Trash2, Info, AlertTriangle, CheckCircle, Bell } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from '@/lib/supabase';
import { format } from "date-fns";
import type { Announcement } from "@/lib/types";
import { EditAnnouncementDialog } from "./EditAnnouncementDialog";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

interface AnnouncementsTableProps {
  announcements: Announcement[];
  onActionComplete: () => void;
}

const typeConfig = {
    info: { text: "معلومات", icon: Info, className: "bg-blue-100 text-blue-800 border-blue-200" },
    warning: { text: "تحذير", icon: AlertTriangle, className: "bg-yellow-100 text-yellow-800 border-yellow-200" },
    success: { text: "نجاح", icon: CheckCircle, className: "bg-green-100 text-green-800 border-green-200" },
    update: { text: "تحديث", icon: Bell, className: "bg-purple-100 text-purple-800 border-purple-200" },
};

export function AnnouncementsTable({ announcements, onActionComplete }: AnnouncementsTableProps) {
  const [editingAnnouncement, setEditingAnnouncement] = useState<Announcement | null>(null);
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

  return (
    <>
      <div className="border rounded-lg hidden md:block">
        <Table>
            <TableHeader>
                <TableRow>
                    <TableHead>العنوان</TableHead>
                    <TableHead>النوع</TableHead>
                    <TableHead>الحالة</TableHead>
                    <TableHead>تاريخ الإنشاء</TableHead>
                    <TableHead className="text-right">الإجراءات</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {announcements.length === 0 ? (
                    <TableRow><TableCell colSpan={5} className="h-24 text-center">لا توجد إعلانات حالياً.</TableCell></TableRow>
                ) : announcements.map((ann) => {
                    const TypeIcon = typeConfig[ann.type].icon;
                    return (
                        <TableRow key={ann.id}>
                            <TableCell className="font-medium">{ann.title}</TableCell>
                            <TableCell>
                                <Badge variant="outline" className={typeConfig[ann.type].className}>
                                    <TypeIcon className="h-3.5 w-3.5 -ml-1 mr-1" />
                                    {typeConfig[ann.type].text}
                                </Badge>
                            </TableCell>
                            <TableCell>
                                <Badge variant={ann.isActive ? 'default' : 'secondary'} className={ann.isActive ? 'bg-green-500' : ''}>
                                    {ann.isActive ? 'نشط' : 'غير نشط'}
                                </Badge>
                            </TableCell>
                            <TableCell>{ann.createdAt ? format(new Date(ann.createdAt), 'yyyy/MM/dd') : '-'}</TableCell>
                            <TableCell className="text-right">
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                        <EditAnnouncementDialog announcement={ann} onSave={onActionComplete}>
                                            <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                                                <Pencil className="ml-2 h-4 w-4" /> تعديل
                                            </DropdownMenuItem>
                                        </EditAnnouncementDialog>
                                        <DropdownMenuItem onClick={() => setAnnouncementToDelete(ann)} className="text-destructive">
                                            <Trash2 className="ml-2 h-4 w-4" /> حذف
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </TableCell>
                        </TableRow>
                    )
                })}
            </TableBody>
        </Table>
      </div>

      <div className="md:hidden space-y-4">
        {announcements.length === 0 ? (
             <Card><CardContent className="p-6 text-center text-muted-foreground">لا توجد إعلانات حالياً.</CardContent></Card>
        ) : announcements.map((ann) => {
             const TypeIcon = typeConfig[ann.type].icon;
             return (
                <Card key={ann.id}>
                    <CardHeader>
                        <div className="flex justify-between items-start">
                           <CardTitle className="text-base">{ann.title}</CardTitle>
                             <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-8 w-8 -mr-2 -mt-2"><MoreHorizontal className="h-4 w-4" /></Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                    <EditAnnouncementDialog announcement={ann} onSave={onActionComplete}><DropdownMenuItem onSelect={(e) => e.preventDefault()}><Pencil className="ml-2 h-4 w-4" /> تعديل</DropdownMenuItem></EditAnnouncementDialog>
                                    <DropdownMenuItem onClick={() => setAnnouncementToDelete(ann)} className="text-destructive"><Trash2 className="ml-2 h-4 w-4" /> حذف</DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>
                        <CardDescription>{ann.createdAt ? format(new Date(ann.createdAt), 'yyyy/MM/dd') : '-'}</CardDescription>
                    </CardHeader>
                    <CardContent>
                         <p className="text-sm text-muted-foreground line-clamp-2">{ann.content}</p>
                    </CardContent>
                    <CardFooter className="flex justify-between items-center">
                        <Badge variant="outline" className={typeConfig[ann.type].className}>
                            <TypeIcon className="h-3.5 w-3.5 -ml-1 mr-1" />
                            {typeConfig[ann.type].text}
                        </Badge>
                        <Badge variant={ann.isActive ? 'default' : 'secondary'} className={ann.isActive ? 'bg-green-500' : ''}>
                            {ann.isActive ? 'نشط' : 'غير نشط'}
                        </Badge>
                    </CardFooter>
                </Card>
             )
        })}
      </div>

      <AlertDialog open={!!announcementToDelete} onOpenChange={(open) => !open && setAnnouncementToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>هل أنت متأكد؟</AlertDialogTitle><AlertDialogDescription>سيتم حذف الإعلان "{announcementToDelete?.title}" نهائياً.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel disabled={isDeleting}>إلغاء</AlertDialogCancel><AlertDialogAction onClick={handleDelete} disabled={isDeleting} className="bg-destructive hover:bg-destructive/90">{isDeleting ? "جاري الحذف..." : "حذف"}</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
