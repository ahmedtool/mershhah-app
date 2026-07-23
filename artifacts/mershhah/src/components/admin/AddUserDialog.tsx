
'use client';

import { useState, useTransition } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "../ui/form";
import { useToast } from "@/hooks/use-toast";
import { Eye, EyeOff } from "lucide-react";

const formSchema = z.object({
  restaurantName: z.string().min(2, { message: "اسم المطعم لازم يكون حرفين عالأقل." }),
  email: z.string().email({ message: "الرجاء إدخال إيميل صحيح." }),
  password: z.string().min(6, { message: "كلمة المرور لازم تكون 6 أحرف عالأقل." }),
});

interface AddUserDialogProps {
    children: React.ReactNode;
    onUserAdded: () => void;
}

export function AddUserDialog({ children, onUserAdded }: AddUserDialogProps) {
    const [open, setOpen] = useState(false);
    const [isPending, startTransition] = useTransition();
    const [showPassword, setShowPassword] = useState(false);
    const { toast } = useToast();

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            restaurantName: "",
            email: "",
            password: "",
        },
    });

    async function onSubmit(values: z.infer<typeof formSchema>) {
        startTransition(async () => {
            // Mock adding user for UI-only phase
            console.log('Mock adding user:', values);
            setTimeout(() => {
                toast({
                    title: "تمت إضافة المستخدم والمطعم بنجاح!",
                    description: `تم إنشاء حساب لـ ${values.restaurantName}. (نسخة تجريبية)`,
                });
                onUserAdded();
                setOpen(false);
                form.reset();
            }, 1000);
        });
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                {children}
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg">
                 <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)}>
                        <DialogHeader>
                            <DialogTitle>إضافة راعي مطعم جديد</DialogTitle>
                            <DialogDescription>
                                أدخل تفاصيل راعي المطعم الجديد. سيتم إنشاء حساب له للدخول للوحة التحكم.
                            </DialogDescription>
                        </DialogHeader>

                        <div className="grid gap-4 py-4">
                            <FormField
                                control={form.control}
                                name="restaurantName"
                                render={({ field }) => (
                                    <FormItem>
                                    <FormLabel>اسم المطعم</FormLabel>
                                    <FormControl>
                                        <Input
                                        placeholder="مطعمي"
                                        {...field}
                                        disabled={isPending}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                    </FormItem>
                                )}
                                />
                            <FormField
                                control={form.control}
                                name="email"
                                render={({ field }) => (
                                    <FormItem>
                                    <FormLabel>الإيميل</FormLabel>
                                    <FormControl>
                                        <Input
                                        type="email"
                                        placeholder="بريد@example.com"
                                        {...field}
                                        disabled={isPending}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                    </FormItem>
                                )}
                                />
                             <FormField
                                control={form.control}
                                name="password"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>كلمة المرور</FormLabel>
                                        <FormControl>
                                            <div className="relative">
                                                <Input
                                                    type={showPassword ? "text" : "password"}
                                                    placeholder="••••••••"
                                                    {...field}
                                                    disabled={isPending}
                                                />
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="icon"
                                                    className="absolute left-2 top-1/2 -translate-y-1/2 h-7 w-7 text-muted-foreground"
                                                    onClick={() => setShowPassword(prev => !prev)}
                                                >
                                                    {showPassword ? <EyeOff /> : <Eye />}
                                                    <span className="sr-only">{showPassword ? "إخفاء" : "إظهار"} كلمة المرور</span>
                                                </Button>
                                            </div>
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                                />
                        </div>
                        
                        <DialogFooter className="flex-wrap">
                            <Button type="submit" disabled={isPending}>
                                {isPending ? "لحظات..." : "إضافة راعي مطعم"}
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
