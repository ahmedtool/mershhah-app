'use client';

import { useState, useTransition } from "react";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from '@/lib/supabase';
import { EditApplicationDialog } from "./EditApplicationDialog";
import { Application } from "@/lib/types";
import { StorageImage } from "@/components/shared/StorageImage";
import { Card, CardContent } from "@/components/ui/card";

interface ApplicationsTableProps {
  applications: Application[];
  onActionComplete: () => void;
}

export function ApplicationsTable({ applications, onActionComplete }: ApplicationsTableProps) {
  const [appToDelete, setAppToDelete] = useState<Application | null>(null);
  const [isDeleting, startDelete] = useTransition();
  const { toast } = useToast();

  const handleDelete = () => {
    if (!appToDelete) return;
    startDelete(async () => {
        try {
            const { error } = await supabase.from('applications').delete().eq('id', appToDelete.id);
            if (error) throw error;
            toast({ title: "تم حذف التطبيق بنجاح" });
            onActionComplete();
            setAppToDelete(null);
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
                    <TableHead>التطبيق</TableHead>
                    <TableHead>المعرّف (Platform ID)</TableHead>
                    <TableHead>التصنيف</TableHead>
                    <TableHead className="text-right">الإجراءات</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {applications.length === 0 ? (
                    <TableRow><TableCell colSpan={4} className="h-24 text-center">لا توجد تطبيقات مضافة حالياً.</TableCell></TableRow>
                ) : applications.map((app) => (
                    <TableRow key={app.id}>
                        <TableCell className="font-medium">
                            <div className="flex items-center gap-3">
                                <StorageImage imagePath={app.logo_url} alt={app.name} height={32} width={32} className="rounded-md object-contain border p-1" />
                                <span>{app.name}</span>
                            </div>
                        </TableCell>
                        <TableCell>
                            <Badge variant="outline" className="font-mono">{app.platform_id}</Badge>
                        </TableCell>
                        <TableCell>
                           <Badge variant="secondary">{app.category}</Badge>
                        </TableCell>
                        <TableCell className="text-right">
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                    <EditApplicationDialog application={app} onSave={onActionComplete}>
                                        <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                                            <Pencil className="ml-2 h-4 w-4" /> تعديل
                                        </DropdownMenuItem>
                                    </EditApplicationDialog>
                                    <DropdownMenuItem onClick={() => setAppToDelete(app)} className="text-destructive">
                                        <Trash2 className="ml-2 h-4 w-4" /> حذف
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </TableCell>
                    </TableRow>
                ))}
            </TableBody>
        </Table>
      </div>

       <div className="md:hidden space-y-4">
            {applications.length === 0 ? (
                <Card><CardContent className="p-6 text-center text-muted-foreground">لا توجد تطبيقات مضافة حالياً.</CardContent></Card>
            ) : applications.map((app) => (
                <Card key={app.id}>
                    <CardContent className="p-4 flex justify-between items-center">
                        <div className="flex items-center gap-3">
                           <StorageImage imagePath={app.logo_url} alt={app.name} height={40} width={40} className="rounded-lg object-contain border p-1" />
                            <div>
                                <p className="font-bold">{app.name}</p>
                                <Badge variant="outline" className="font-mono text-xs">{app.platform_id}</Badge>
                            </div>
                        </div>
                         <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <EditApplicationDialog application={app} onSave={onActionComplete}>
                                    <DropdownMenuItem onSelect={(e) => e.preventDefault()}><Pencil className="ml-2 h-4 w-4" /> تعديل</DropdownMenuItem>
                                </EditApplicationDialog>
                                <DropdownMenuItem onClick={() => setAppToDelete(app)} className="text-destructive"><Trash2 className="ml-2 h-4 w-4" /> حذف</DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </CardContent>
                </Card>
            ))}
        </div>

      <AlertDialog open={!!appToDelete} onOpenChange={(open) => !open && setAppToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>هل أنت متأكد؟</AlertDialogTitle><AlertDialogDescription>سيتم حذف تطبيق "{appToDelete?.name}" نهائياً.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel disabled={isDeleting}>إلغاء</AlertDialogCancel><AlertDialogAction onClick={handleDelete} disabled={isDeleting} className="bg-destructive hover:bg-destructive/90">{isDeleting ? "جاري الحذف..." : "حذف"}</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
