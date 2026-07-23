'use client';

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { supabase } from '@/lib/supabase';
import { Checkbox } from "@/components/ui/checkbox";

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
  email: z.string().email({ message: "الرجاء إدخال بريد إلكتروني صحيح." }),
  password: z.string().min(8, { message: "كلمة المرور يجب أن تكون 8 أحرف على الأقل." }),
  admin_permissions: z.array(z.string()).refine(value => value.length > 0, {
    message: "يجب أن تختار صلاحية واحدة على الأقل.",
  }),
});

interface AddAdminDialogProps {
    children: React.ReactNode;
    onAdminAdded: () => void;
}

export function AddAdminDialog({ children, onAdminAdded }: AddAdminDialogProps) {
    const [open, setOpen] = useState(false);
    const [isPending, startTransition] = useTransition();
    const [showPassword, setShowPassword] = useState(false);
    const { toast } = useToast();

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: { fullName: "", email: "", password: "", admin_permissions: [] },
    });

    async function onSubmit(values: z.infer<typeof formSchema>) {
        startTransition(async () => {
            try {
                const { data, error: signUpError } = await supabase.auth.signUp({
                    email: values.email,
                    password: values.password,
                    options: {
                        data: {
                            full_name: values.fullName,
                        },
                    },
                });

                if (signUpError) throw signUpError;
                if (!data.user) throw new Error('فشل إنشاء الحساب.');

                const { error: profileError } = await supabase.from('profiles').upsert({
                    id: data.user.id,
                    full_name: values.fullName,
                    email: values.email,
                    role: 'admin',
                    account_status: 'active',
                    created_at: new Date().toISOString(),
                    admin_permissions: values.admin_permissions,
                });

                if (profileError) throw profileError;

                toast({
                    title: "تمت إضافة المسؤول بنجاح",
                    description: `تم إنشاء حساب لـ ${values.fullName}.`,
                });

                onAdminAdded();
                setOpen(false);
                form.reset();

            } catch (error: any) {
                let description = error.message || "حدث خطأ غير متوقع.";
                if (error.message?.includes('already registered') || error.message?.includes('already been registered')) {
                    description = 'هذا البريد الإلكتروني مسجل بالفعل.';
                }
                toast({
                    variant: "destructive",
                    title: "خطأ في إضافة المسؤول",
                    description,
                });
            }
        });
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                {children}
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg max-h-[92vh] overflow-y-auto p-0 gap-0">
                <DialogHeader className="px-6 pt-6 pb-4 border-b border-gray-100">
                    <DialogTitle className="text-sm font-bold text-gray-900">إضافة مسؤول جديد</DialogTitle>
                    <p className="text-[11px] text-gray-400 mt-1">أدخل بيانات المسؤول الجديد وحدد صلاحياته.</p>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="p-6 space-y-4">
                        <FormField control={form.control} name="fullName" render={({ field }) => (
                            <FormItem>
                                <FormLabel className="text-xs font-bold text-gray-500">الاسم الكامل</FormLabel>
                                <FormControl>
                                    <Input placeholder="الاسم" {...field} disabled={isPending} className="h-11 px-3 rounded-xl border border-gray-200 text-xs text-gray-900 placeholder:text-gray-300 focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-gray-900" />
                                </FormControl>
                                <FormMessage className="text-[10px]" />
                            </FormItem>
                        )}/>
                        <FormField control={form.control} name="email" render={({ field }) => (
                            <FormItem>
                                <FormLabel className="text-xs font-bold text-gray-500">البريد الإلكتروني</FormLabel>
                                <FormControl>
                                    <Input type="email" placeholder="admin@example.com" {...field} disabled={isPending} className="h-11 px-3 rounded-xl border border-gray-200 text-xs text-gray-900 placeholder:text-gray-300 focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-gray-900" />
                                </FormControl>
                                <FormMessage className="text-[10px]" />
                            </FormItem>
                        )}/>
                        <FormField control={form.control} name="password" render={({ field }) => (
                            <FormItem>
                                <FormLabel className="text-xs font-bold text-gray-500">كلمة المرور</FormLabel>
                                <FormControl>
                                    <div className="relative">
                                        <Input type={showPassword ? "text" : "password"} placeholder="••••••••" {...field} disabled={isPending} className="h-11 px-3 pr-10 rounded-xl border border-gray-200 text-xs text-gray-900 placeholder:text-gray-300 focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-gray-900" />
                                        <button type="button" onClick={() => setShowPassword(prev => !prev)} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500">
                                            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                        </button>
                                    </div>
                                </FormControl>
                                <FormMessage className="text-[10px]" />
                            </FormItem>
                        )}/>

                        <div className="border-t border-gray-100 pt-4">
                            <FormField
                                control={form.control}
                                name="admin_permissions"
                                render={() => (
                                    <FormItem>
                                        <FormLabel className="text-xs font-bold text-gray-500">صلاحيات المسؤول</FormLabel>
                                        <FormMessage className="text-[10px]" />
                                        <div className="grid grid-cols-2 gap-3 mt-3">
                                            {permissions.map((permission) => (
                                                <FormField
                                                    key={permission.id}
                                                    control={form.control}
                                                    name="admin_permissions"
                                                    render={({ field }) => {
                                                        return (
                                                        <label key={permission.id} className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl border border-gray-200 cursor-pointer hover:bg-gray-50 transition-colors">
                                                            <Checkbox
                                                                checked={field.value?.includes(permission.id)}
                                                                onCheckedChange={(checked) => {
                                                                    const currentPermissions = field.value || [];
                                                                    return checked
                                                                        ? field.onChange([...currentPermissions, permission.id])
                                                                        : field.onChange(currentPermissions.filter((value) => value !== permission.id));
                                                                }}
                                                                className="border-gray-300 data-[state=checked]:bg-gray-900 data-[state=checked]:border-gray-900"
                                                            />
                                                            <span className="text-[11px] font-bold text-gray-600">{permission.label}</span>
                                                        </label>
                                                        )
                                                    }}
                                                />
                                            ))}
                                        </div>
                                    </FormItem>
                                )}
                            />
                        </div>

                        <DialogFooter className="flex flex-row-reverse gap-2 pt-2 border-t border-gray-100 px-6 pb-6">
                            <Button type="submit" disabled={isPending} className="h-11 px-5 rounded-xl bg-gray-900 text-white hover:bg-gray-800 text-xs font-bold">
                                {isPending && <Loader2 className="h-4 w-4 animate-spin ml-2" />}
                                إضافة مسؤول
                            </Button>
                            <Button type="button" variant="ghost" onClick={() => setOpen(false)} className="h-11 px-5 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 text-xs font-bold">
                                إلغاء
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
