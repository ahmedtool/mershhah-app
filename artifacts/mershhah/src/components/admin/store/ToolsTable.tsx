'use client';

import { useState, useTransition } from "react";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MoreHorizontal, Pencil, Trash2, Box, icons } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from '@/lib/supabase';
import { EditToolDialog } from "./EditToolDialog";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { StorageImage } from "@/components/shared/StorageImage";
import type { Tool } from "@/lib/types";

interface ToolsTableProps {
  tools: Tool[];
  onActionComplete: () => void;
}

export function ToolsTable({ tools, onActionComplete }: ToolsTableProps) {
  const [toolToDelete, setToolToDelete] = useState<any | null>(null);
  const [isDeleting, startDelete] = useTransition();
  const { toast } = useToast();

  const handleDelete = () => {
    if (!toolToDelete) return;
    startDelete(async () => {
        try {
            const { error } = await supabase.from('tools').delete().eq('id', toolToDelete.id);
            if (error) throw error;
            toast({ title: "تم حذف الأداة بنجاح" });
            onActionComplete();
            setToolToDelete(null);
        } catch (error: any) {
            toast({ variant: "destructive", title: "خطأ في الحذف", description: error.message });
        }
    });
  };

  const getIcon = (name: string) => {
    const Icon = icons[name as keyof typeof icons];
    return Icon ? <Icon className="h-4 w-4" /> : <Box className="h-4 w-4" />;
  };

  return (
    <>
      <div className="hidden md:block">
        <Card>
          <CardContent className="p-0">
            <Table dir="rtl">
                <TableHeader>
                <TableRow className="bg-muted/50">
                    <TableHead className="text-right font-bold text-foreground">الأداة</TableHead>
                    <TableHead className="text-right font-bold text-foreground">المعرّف (ID)</TableHead>
                    <TableHead className="text-right font-bold text-foreground">التصنيف</TableHead>
                    <TableHead className="text-right font-bold text-foreground">السعر</TableHead>
                    <TableHead className="text-right font-bold text-foreground">الإجراء</TableHead>
                </TableRow>
                </TableHeader>
                <TableBody>
                {tools.map((tool) => (
                    <TableRow key={tool.id} className="hover:bg-muted/30 transition-colors">
                    <TableCell className="font-medium">
                        <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-lg ${tool.bg_color} ${tool.color} flex items-center justify-center overflow-hidden`}>
                                {tool.image_path ? (
                                  <StorageImage imagePath={tool.image_path} alt={tool.title} fill className="object-contain p-1" sizes="32px" />
                                ) : (
                                  getIcon(tool.icon)
                                )}
                            </div>
                            <span>{tool.title}</span>
                        </div>
                    </TableCell>
                    <TableCell><Badge variant="outline" className="font-mono">{tool.id}</Badge></TableCell>
                    <TableCell className="text-right">{tool.category}</TableCell>
                    <TableCell className="text-right font-mono">{tool.price_label}</TableCell>
                    <TableCell className="text-right">
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreHorizontal /></Button></DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <EditToolDialog tool={tool} onSave={onActionComplete} allTools={tools}>
                                    <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                                    <Pencil className="ml-2 h-4 w-4" /> تعديل
                                    </DropdownMenuItem>
                                </EditToolDialog>
                                <DropdownMenuItem onSelect={() => setToolToDelete(tool)} className="text-destructive focus:text-destructive">
                                <Trash2 className="ml-2 h-4 w-4" /> حذف
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </TableCell>
                    </TableRow>
                ))}
                </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
      <div className="md:hidden space-y-4">
        {tools.map(tool => (
            <Card key={tool.id}>
                <CardHeader>
                    <div className="flex items-center gap-3">
                         <div className={`w-10 h-10 rounded-lg ${tool.bg_color} ${tool.color} flex items-center justify-center overflow-hidden`}>
                            {tool.image_path ? (
                              <StorageImage imagePath={tool.image_path} alt={tool.title} fill className="object-contain p-1" sizes="40px" />
                            ) : (
                              getIcon(tool.icon)
                            )}
                        </div>
                        <CardTitle className="text-base">{tool.title}</CardTitle>
                    </div>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                     <div>
                        <p className="text-xs text-muted-foreground">المعرّف (ID)</p>
                        <Badge variant="outline" className="font-mono">{tool.id}</Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                        <div><p className="text-xs text-muted-foreground">التصنيف</p><p>{tool.category}</p></div>
                        <div><p className="text-xs text-muted-foreground">السعر</p><p className="font-mono">{tool.price_label}</p></div>
                    </div>
                </CardContent>
                <CardFooter className="bg-muted/50 p-2 flex justify-end gap-2">
                    <EditToolDialog tool={tool} onSave={onActionComplete} allTools={tools}><Button variant="ghost" size="sm"><Pencil className="h-4 w-4 ml-2" /> تعديل</Button></EditToolDialog>
                    <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => setToolToDelete(tool)}><Trash2 className="h-4 w-4 ml-2" /> حذف</Button>
                </CardFooter>
            </Card>
        ))}
      </div>

      <AlertDialog open={!!toolToDelete} onOpenChange={(open) => !open && setToolToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>هل أنت متأكد؟</AlertDialogTitle>
            <AlertDialogDescription>
              سيتم حذف أداة "{toolToDelete?.title}" نهائياً. لا يمكن التراجع عن هذا الإجراء.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>إلغاء</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={isDeleting} className="bg-destructive hover:bg-destructive/90">
              {isDeleting ? "جاري الحذف..." : "حذف"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
