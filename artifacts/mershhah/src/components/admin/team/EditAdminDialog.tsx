'use client';

import { useState, useTransition, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import { supabase } from '@/lib/supabase';
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import type { Profile } from "@/lib/types";

const permissions = [
  { id: 'dashboard', label: 'لوحة التحكم' },
  { id: 'management', label: 'إدارة المشتركين' },
  { id: 'financials', label: 'القسم المالي' },
  { id: 'store-management', label: 'إدارة المتجر' },
  { id: 'applications', label: 'التطبيقات' },
  { id: 'announcements', label: 'الإعلانات' },
  { id: 'support', label: 'الدعم المباشر' },
  { id: 'team', label: 'إدارة الفريق' },
  { id: 'workflow', label: 'سير العمل' },
  { id: 'sales', label: 'دليل المبيعات' },
];

const formSchema = z.object({
  fullName: z.string().min(2, { message: "الاسم الكامل مطلوب." }),
  admin_permissions: z.array(z.string()).refine(value => value.length > 0, {
    message: "يجب أن تختار صلاحية واحدة على الأقل.",
  }),
});

interface EditAdminDialogProps {
    admin: Profile;
    onAdminUpdated: () => void;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function EditAdminDialog({ admin, onAdminUpdated, open, onOpenChange }: EditAdminDialogProps) {
    const [isPending, startTransition] = useTransition();
    const { toast } = useToast();

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: { fullName: "", admin_permissions: [] },
    });

    useEffect(() => {
        if (admin && open) {
            form.reset({
                fullName: admin.full_name || '',
                admin_permissions: admin.admin_permissions || [],
            });
        }
    }, [admin, form, open]);

    async function onSubmit(values: z.infer<typeof formSchema>) {
        startTransition(async () => {
            try {
                const { error } = await supabase
                    .from('profiles')
                    .update({
                        full_name: values.fullName,
                        admin_permissions: values.admin_permissions,
                    })
                    .eq('id', admin.id);
                if (error) throw error;

                toast({
                    title: "تم تحديث الصلاحيات بنجاح",
                    description: `تم تحديث بيانات المسؤول ${values.fullName}.`,
                });

                onAdminUpdated();
                onOpenChange(false);
            } catch (error: any) {
                toast({
                    variant: "destructive",
                    title: "خطأ في تحديث المسؤول",
                    description: error.message || "حدث خطأ غير متوقع.",
                });
            }
        });
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-lg">
                 <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        <DialogHeader>
                            <DialogTitle>تعديل صلاحيات: {admin.full_name}</DialogTitle>
                            <DialogDescription>
                                قم بتحديث بيانات المسؤول وصلاحياته.
                            </DialogDescription>
                        </DialogHeader>

                        <div className="space-y-4 py-4">
                            <FormField control={form.control} name="fullName" render={({ field }) => (
                                <FormItem><FormLabel>الاسم الكامل</FormLabel><FormControl><Input placeholder="الاسم" {...field} disabled={isPending} /></FormControl><FormMessage /></FormItem>
                            )}/>

                            <Separator />

                            <FormField
                                control={form.control}
                                name="admin_permissions"
                                render={() => (
                                    <FormItem>
                                    <div className="mb-4">
                                        <FormLabel>صلاحيات الوصول</FormLabel>
                                        <FormMessage />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        {permissions.map((permission) => (
                                            <FormField
                                            key={permission.id}
                                            control={form.control}
                                            name="admin_permissions"
                                            render={({ field }) => {
                                                return (
                                                <FormItem key={permission.id} className="flex flex-row items-start space-x-3 space-y-0 space-x-reverse">
                                                    <FormControl>
                                                    <Checkbox
                                                        checked={field.value?.includes(permission.id)}
                                                        onCheckedChange={(checked) => {
                                                        const currentPermissions = field.value || [];
                                                        return checked
                                                            ? field.onChange([...currentPermissions, permission.id])
                                                            : field.onChange(currentPermissions.filter((value) => value !== permission.id));
                                                        }}
                                                    />
                                                    </FormControl>
                                                    <FormLabel className="font-normal">{permission.label}</FormLabel>
                                                </FormItem>
                                                )
                                            }}
                                            />
                                        ))}
                                    </div>
                                    </FormItem>
                                )}
                            />
                        </div>

                        <DialogFooter className="flex-wrap">
                             <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>إلغاء</Button>
                            <Button type="submit" disabled={isPending}>
                                {isPending && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
                                حفظ التعديلات
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
