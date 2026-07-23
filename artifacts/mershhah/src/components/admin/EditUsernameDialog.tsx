
'use client';

import { useState, useTransition, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "../ui/form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { AtSign } from "lucide-react";

// This is a mock type. Replace with your actual user type.
type UserRecord = { id: string; username: string; restaurantName: string; };

const formSchema = z.object({
  username: z.string().min(3, "اسم المستخدم يجب أن يكون 3 أحرف على الأقل.").regex(/^[a-z0-9-]+$/, "استخدم حروف إنجليزية صغيرة وأرقام وشرطات فقط."),
});

interface EditUsernameDialogProps {
    user: UserRecord;
    isOpen: boolean;
    onOpenChange: (isOpen: boolean) => void;
    onUsernameUpdated: () => void;
}

export function EditUsernameDialog({ user, isOpen, onOpenChange, onUsernameUpdated }: EditUsernameDialogProps) {
    const [isPending, startTransition] = useTransition();
    const { toast } = useToast();

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            username: user.username || "",
        },
    });
    
    // Reset form when dialog opens with a new user
    useEffect(() => {
        if(user) {
            form.reset({ username: user.username });
        }
    }, [user, isOpen, form]);

    async function onSubmit(values: z.infer<typeof formSchema>) {
        startTransition(async () => {
            // TODO: Call a Cloud Function to update the username
            // const result = await callFunction('updateUsername', { userId: user.id, newUsername: values.username });
            const result = { success: true, error: "اسم المستخدم هذا محجوز." }; // Mock result

            if (result.success) {
                toast({
                    title: "تم تحديث اسم المستخدم بنجاح (محاكاة)",
                    description: `الرابط الجديد للمطعم هو /chat/${values.username}`,
                });
                onUsernameUpdated();
            } else {
                 toast({
                    variant: "destructive",
                    title: "حدث خطأ",
                    description: result.error,
                });
            }
        });
    }

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-lg">
                 <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)}>
                        <DialogHeader>
                            <DialogTitle>تغيير اسم المستخدم لـ "{user.restaurantName}"</DialogTitle>
                            <DialogDescription>
                                سيؤدي هذا إلى تغيير رابط المحادثة الخاص بالمطعم.
                            </DialogDescription>
                        </DialogHeader>

                        <div className="grid gap-4 py-4">
                            <FormField
                                control={form.control}
                                name="username"
                                render={({ field }) => (
                                    <FormItem>
                                    <FormLabel>اسم المستخدم الجديد</FormLabel>
                                    <FormControl>
                                        <div className="relative">
                                            <AtSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                            <Input
                                                dir="ltr"
                                                placeholder="new-username"
                                                className="pl-4 pr-10 text-left"
                                                {...field}
                                                disabled={isPending}
                                            />
                                        </div>
                                    </FormControl>
                                    <FormMessage />
                                    </FormItem>
                                )}
                                />
                        </div>
                        
                        <DialogFooter className="flex-wrap">
                            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>إلغاء</Button>
                            <Button type="submit" disabled={isPending}>
                                {isPending ? "جاري الحفظ..." : "حفظ التغيير"}
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
