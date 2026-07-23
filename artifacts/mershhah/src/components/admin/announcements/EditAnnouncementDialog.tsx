'use client';

import { useState, useTransition, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { Announcement } from '@/lib/types';

const formSchema = z.object({
  title: z.string().min(5, 'العنوان مطلوب (5 أحرف على الأقل)'),
  content: z.string().min(10, 'محتوى الإعلان مطلوب (10 أحرف على الأقل)'),
  type: z.enum(['info', 'warning', 'success', 'update']),
  targetRole: z.enum(['owner', 'all']),
  isActive: z.boolean().default(true),
});

type FormValues = z.infer<typeof formSchema>;

interface EditAnnouncementDialogProps {
  children?: React.ReactNode;
  announcement?: Announcement;
  onSave?: () => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function EditAnnouncementDialog({
  children,
  announcement,
  onSave,
  open: controlledOpen,
  onOpenChange: setControlledOpen,
}: EditAnnouncementDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const [isSaving, startSaving] = useTransition();
  const { toast } = useToast();
  const isEditing = !!announcement;

  const open = controlledOpen ?? internalOpen;
  const setOpen = setControlledOpen ?? setInternalOpen;

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { title: '', content: '', type: 'info', targetRole: 'owner', isActive: true },
  });

  useEffect(() => {
    if (open) {
      form.reset(
        isEditing
          ? announcement
          : { title: '', content: '', type: 'info', targetRole: 'owner', isActive: true }
      );
    }
  }, [open, announcement, isEditing, form]);

  async function onSubmit(values: FormValues) {
    startSaving(async () => {
      try {
        if (isEditing) {
          const { error } = await supabase
            .from('announcements')
            .update(values)
            .eq('id', announcement.id);
          if (error) throw error;
        } else {
          const { error } = await supabase.from('announcements').insert({
            id: crypto.randomUUID(),
            ...values,
            createdAt: new Date().toISOString(),
          });
          if (error) throw error;
        }
        toast({ title: `تم ${isEditing ? 'تعديل' : 'إنشاء'} الإعلان بنجاح` });
        onSave?.();
        setOpen(false);
      } catch (error: any) {
        toast({ variant: 'destructive', title: 'حدث خطأ', description: error.message });
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {children && <DialogTrigger asChild>{children}</DialogTrigger>}
      <DialogContent className="sm:max-w-lg max-h-[92vh] overflow-y-auto p-0 gap-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-gray-100">
          <DialogTitle className="text-sm font-bold text-gray-900">{isEditing ? 'تعديل إعلان' : 'إنشاء إعلان جديد'}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="p-6 space-y-4">
            <FormField control={form.control} name="title" render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs font-bold text-gray-500">عنوان الإعلان</FormLabel>
                <FormControl>
                  <Input placeholder="مثال: تحديث جديد للمنصة" {...field} className="h-11 px-3 rounded-xl border border-gray-200 text-xs text-gray-900 placeholder:text-gray-300 focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-gray-900" />
                </FormControl>
                <FormMessage className="text-[10px]" />
              </FormItem>
            )} />
            <FormField control={form.control} name="content" render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs font-bold text-gray-500">محتوى الإعلان</FormLabel>
                <FormControl>
                  <Textarea rows={4} placeholder="اشرح تفاصيل الإعلان هنا..." {...field} className="px-3 py-2.5 rounded-xl border border-gray-200 text-xs text-gray-900 placeholder:text-gray-300 focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-gray-900 resize-none" />
                </FormControl>
                <FormMessage className="text-[10px]" />
              </FormItem>
            )} />
            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="type" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-bold text-gray-500">نوع الإعلان</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger className="h-11 px-3 rounded-xl border border-gray-200 text-xs text-gray-900 focus:ring-0 focus:ring-offset-0 focus:border-gray-900">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent className="rounded-xl border border-gray-100">
                      <SelectItem value="info" className="text-xs font-bold text-gray-500 focus:bg-gray-50 focus:text-gray-900">معلومات</SelectItem>
                      <SelectItem value="warning" className="text-xs font-bold text-gray-500 focus:bg-gray-50 focus:text-gray-900">تحذير</SelectItem>
                      <SelectItem value="success" className="text-xs font-bold text-gray-500 focus:bg-gray-50 focus:text-gray-900">نجاح</SelectItem>
                      <SelectItem value="update" className="text-xs font-bold text-gray-500 focus:bg-gray-50 focus:text-gray-900">تحديث</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage className="text-[10px]" />
                </FormItem>
              )} />
              <FormField control={form.control} name="targetRole" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-bold text-gray-500">الجمهور المستهدف</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger className="h-11 px-3 rounded-xl border border-gray-200 text-xs text-gray-900 focus:ring-0 focus:ring-offset-0 focus:border-gray-900">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent className="rounded-xl border border-gray-100">
                      <SelectItem value="owner" className="text-xs font-bold text-gray-500 focus:bg-gray-50 focus:text-gray-900">أصحاب المطاعم</SelectItem>
                      <SelectItem value="all" className="text-xs font-bold text-gray-500 focus:bg-gray-50 focus:text-gray-900">الكل</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage className="text-[10px]" />
                </FormItem>
              )} />
            </div>
            <FormField control={form.control} name="isActive" render={({ field }) => (
              <FormItem className="flex flex-row items-center justify-between px-4 py-3 rounded-xl border border-gray-200">
                <FormLabel className="text-xs font-bold text-gray-500">تفعيل الإعلان</FormLabel>
                <FormControl>
                  <button
                    type="button"
                    onClick={() => field.onChange(!field.value)}
                    className={`relative w-9 h-5 rounded-full transition-colors ${field.value ? 'bg-gray-900' : 'bg-gray-200'}`}
                  >
                    <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${field.value ? 'right-0.5' : 'right-[18px]'}`} />
                  </button>
                </FormControl>
              </FormItem>
            )} />
            <DialogFooter className="flex flex-row-reverse gap-2 pt-2 border-t border-gray-100 px-6 pb-6">
              <Button type="submit" disabled={isSaving} className="h-11 px-5 rounded-xl bg-gray-900 text-white hover:bg-gray-800 text-xs font-bold">
                {isSaving && <Loader2 className="h-4 w-4 animate-spin ml-2" />}
                {isEditing ? 'حفظ التعديلات' : 'إنشاء إعلان'}
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
