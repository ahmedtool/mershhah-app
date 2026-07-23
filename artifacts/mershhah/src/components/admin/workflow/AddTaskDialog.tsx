'use client';

import { useState, useTransition, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger
} from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import { supabase } from '@/lib/supabase';
import type { Profile, Task } from "@/lib/types";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useUser } from "@/hooks/useUser";

const formSchema = z.object({
  title: z.string().min(5, "العنوان يجب أن يكون 5 أحرف على الأقل"),
  description: z.string().optional(),
  assigneeId: z.string({ required_error: "الرجاء إسناد المهمة لشخص." }),
  priority: z.enum(['low', 'medium', 'high']).default('medium'),
});

type FormValues = z.infer<typeof formSchema>;

interface AddTaskDialogProps {
  children: React.ReactNode;
  admins: Profile[];
  status: Task['status'];
  onTaskAdded: () => void;
}

export function AddTaskDialog({ children, admins, status, onTaskAdded }: AddTaskDialogProps) {
    const { user: currentUser } = useUser();
    const [open, setOpen] = useState(false);
    const [isSaving, startSaving] = useTransition();
    const { toast } = useToast();

    const form = useForm<FormValues>({
        resolver: zodResolver(formSchema),
        defaultValues: { title: "", description: "", priority: 'medium' }
    });

    useEffect(() => {
      if (!open) {
        form.reset();
      }
    }, [open, form]);

    async function onSubmit(values: FormValues) {
        if (!currentUser) return;

        const assignee = admins.find(a => a.id === values.assigneeId);
        if (!assignee) {
            toast({ title: 'خطأ', description: 'المسؤول المحدد غير موجود', variant: 'destructive' });
            return;
        }

        startSaving(async () => {
            try {
                const { error } = await supabase.from('tasks').insert({
                    ...values,
                    status,
                    assigneeName: assignee.full_name,
                    assigneeAvatar: null,
                    createdBy: currentUser.uid,
                    createdAt: new Date().toISOString(),
                });
                if (error) throw error;
                toast({ title: 'تمت إضافة المهمة بنجاح' });
                onTaskAdded();
                setOpen(false);
            } catch (error: any) {
                toast({ title: 'خطأ', description: 'فشل إضافة المهمة', variant: 'destructive' });
            }
        });
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>{children}</DialogTrigger>
            <DialogContent className="sm:max-w-lg max-h-[92vh] overflow-y-auto p-0 gap-0">
                <DialogHeader className="px-6 pt-6 pb-4 border-b border-gray-100">
                    <DialogTitle className="text-sm font-bold text-gray-900">إضافة مهمة جديدة</DialogTitle>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="p-6 space-y-4">
                        <FormField control={form.control} name="title" render={({ field }) => (
                            <FormItem>
                                <FormLabel className="text-xs font-bold text-gray-500">عنوان المهمة</FormLabel>
                                <FormControl>
                                    <Input {...field} placeholder="عنوان المهمة..." className="h-11 px-3 rounded-xl border border-gray-200 text-xs text-gray-900 placeholder:text-gray-300 focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-gray-900" />
                                </FormControl>
                                <FormMessage className="text-[10px]" />
                            </FormItem>
                        )}/>
                        <FormField control={form.control} name="description" render={({ field }) => (
                            <FormItem>
                                <FormLabel className="text-xs font-bold text-gray-500">الوصف <span className="text-gray-300 font-normal">(اختياري)</span></FormLabel>
                                <FormControl>
                                    <Textarea rows={3} {...field} placeholder="وصف المهمة..." className="px-3 py-2.5 rounded-xl border border-gray-200 text-xs text-gray-900 placeholder:text-gray-300 focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-gray-900 resize-none" />
                                </FormControl>
                                <FormMessage className="text-[10px]" />
                            </FormItem>
                        )}/>
                        <div className="grid grid-cols-2 gap-4">
                            <FormField control={form.control} name="assigneeId" render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="text-xs font-bold text-gray-500">إسناد إلى</FormLabel>
                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                        <FormControl>
                                            <SelectTrigger className="h-11 px-3 rounded-xl border border-gray-200 text-xs text-gray-900 focus:ring-0 focus:ring-offset-0 focus:border-gray-900">
                                                <SelectValue placeholder="اختر مسؤول..." />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent className="rounded-xl border border-gray-100">
                                            {admins.map(admin => (
                                                <SelectItem key={admin.id} value={admin.id} className="text-xs font-bold text-gray-500 focus:bg-gray-50 focus:text-gray-900">
                                                    {admin.full_name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <FormMessage className="text-[10px]" />
                                </FormItem>
                            )}/>
                            <FormField control={form.control} name="priority" render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="text-xs font-bold text-gray-500">الأولوية</FormLabel>
                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                        <FormControl>
                                            <SelectTrigger className="h-11 px-3 rounded-xl border border-gray-200 text-xs text-gray-900 focus:ring-0 focus:ring-offset-0 focus:border-gray-900">
                                                <SelectValue/>
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent className="rounded-xl border border-gray-100">
                                            <SelectItem value="low" className="text-xs font-bold text-gray-500 focus:bg-gray-50 focus:text-gray-900">منخفضة</SelectItem>
                                            <SelectItem value="medium" className="text-xs font-bold text-gray-500 focus:bg-gray-50 focus:text-gray-900">متوسطة</SelectItem>
                                            <SelectItem value="high" className="text-xs font-bold text-gray-500 focus:bg-gray-50 focus:text-gray-900">عالية</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <FormMessage className="text-[10px]" />
                                </FormItem>
                            )}/>
                        </div>
                        <DialogFooter className="flex flex-row-reverse gap-2 pt-2 border-t border-gray-100 px-6 pb-6">
                            <Button type="submit" disabled={isSaving} className="h-11 px-5 rounded-xl bg-gray-900 text-white hover:bg-gray-800 text-xs font-bold">
                                {isSaving && <Loader2 className="h-4 w-4 animate-spin ml-2" />}
                                إضافة المهمة
                            </Button>
                            <Button type="button" variant="ghost" onClick={() => setOpen(false)} className="h-11 px-5 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 text-xs font-bold">
                                إلغاء
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    )
}
