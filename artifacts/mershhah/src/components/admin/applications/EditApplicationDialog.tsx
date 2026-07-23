'use client';

import { useState, useTransition, useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Loader2, UploadCloud, Package } from "lucide-react";
import { supabase } from '@/lib/supabase';
import { Application } from "@/lib/types";
import { StorageImage } from "@/components/shared/StorageImage";

const formSchema = z.object({
  name: z.string().min(2, "اسم التطبيق مطلوب"),
  platform_id: z.string().min(3, "المعرّف مطلوب (3 أحرف على الأقل)").regex(/^[a-z0-9_]+$/, "استخدم حروف إنجليزية صغيرة وأرقام وشرطة سفلية فقط."),
  category: z.enum(['delivery', 'loyalty', 'payment', 'other']),
  logo_url: z.string().optional().nullable(),
});

type FormValues = z.infer<typeof formSchema>;

const categories = [
  { value: 'delivery', label: 'توصيل', icon: '🚚' },
  { value: 'loyalty', label: 'ولاء', icon: '⭐' },
  { value: 'payment', label: 'دفع', icon: '💳' },
  { value: 'other', label: 'أخرى', icon: '📦' },
] as const;

interface EditApplicationDialogProps {
  children: React.ReactNode;
  application?: Application;
  onSave?: () => void;
}

export function EditApplicationDialog({ children, application, onSave }: EditApplicationDialogProps) {
  const [open, setOpen] = useState(false);
  const [isSaving, startSaving] = useTransition();
  const { toast } = useToast();
  const isEditing = !!application;

  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
  });

  useEffect(() => {
    if (open) {
      form.reset(isEditing ? application : {
        name: "",
        platform_id: "",
        category: 'delivery',
        logo_url: null,
      });
      setLogoFile(null);
      setLogoPreview(isEditing ? application.logo_url : null);
    }
  }, [open, application, isEditing, form]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.size > 1 * 1024 * 1024) {
        toast({ title: "حجم الصورة كبير", description: "الرجاء اختيار صورة بحجم أقل من 1 ميجابايت.", variant: "destructive" });
        return;
      }
      setLogoFile(file);
      setLogoPreview(URL.createObjectURL(file));
    }
  };

  async function onSubmit(values: FormValues) {
    if (!logoFile && !isEditing) {
      toast({ title: "شعار التطبيق مطلوب", variant: "destructive" });
      return;
    }

    startSaving(async () => {
      try {
        let finalLogoUrl = isEditing ? application.logo_url : '';
        if (logoFile) {
          const fileExtension = logoFile.name.split('.').pop();
          const newFileName = `application_logos/${values.platform_id}.${fileExtension}`;
          const { data: uploadData, error: uploadError } = await supabase.storage
            .from('restaurant-assets')
            .upload(newFileName, logoFile, { upsert: true });
          if (uploadError) throw uploadError;
          finalLogoUrl = uploadData.path;
        }

        const appData = {
          id: values.platform_id,
          ...values,
          logo_url: finalLogoUrl,
        };

        const { error } = await supabase
          .from('applications')
          .upsert(appData, { onConflict: 'id' });
        if (error) throw error;

        toast({ title: `تم ${isEditing ? 'تعديل' : 'إضافة'} التطبيق بنجاح` });
        onSave?.();
        setOpen(false);
      } catch (error: any) {
        toast({ variant: "destructive", title: "حدث خطأ", description: error.message });
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-lg max-h-[92vh] overflow-y-auto p-0 gap-0" dir="rtl">
        {/* Header */}
        <div className="px-5 pt-5 pb-3 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center">
              <Package className="h-5 w-5 text-gray-500" />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900">{isEditing ? 'تعديل التطبيق' : 'إضافة تطبيق جديد'}</h2>
              <p className="text-xs text-gray-400 mt-0.5">
                {isEditing ? 'عدّل بيانات التطبيق ثم احفظ' : 'أدخل تفاصيل التطبيق ليظهر في قائمة التطبيقات'}
              </p>
            </div>
          </div>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="p-5 space-y-4">
            {/* Logo Upload */}
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-20 h-20 rounded-2xl border-2 border-dashed border-gray-200 flex items-center justify-center hover:border-gray-300 hover:bg-gray-50 transition-all shrink-0"
              >
                {logoPreview ? (
                  <StorageImage imagePath={logoPreview} alt="logo" height={72} width={72} className="w-full h-full object-contain rounded-xl" />
                ) : (
                  <div className="text-center">
                    <UploadCloud className="h-6 w-6 text-gray-300 mx-auto" />
                    <span className="text-[9px] text-gray-300 mt-1 block">شعار</span>
                  </div>
                )}
              </button>
              <input type="file" ref={fileInputRef} onChange={handleImageChange} accept="image/*" className="hidden" />
              <div className="flex-1">
                <FormField control={form.control} name="name" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs text-gray-500">اسم التطبيق</FormLabel>
                    <FormControl>
                      <Input placeholder="مثال: جاهز" {...field} className="h-11 rounded-xl border-gray-200 text-sm" disabled={isSaving} />
                    </FormControl>
                    <FormMessage className="text-[10px]" />
                  </FormItem>
                )} />
              </div>
            </div>

            {/* Platform ID */}
            <FormField control={form.control} name="platform_id" render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs text-gray-500">المعرّف <span className="text-gray-300">(إنجليزي)</span></FormLabel>
                <FormControl>
                  <Input placeholder="jahez" {...field} disabled={isEditing || isSaving} className="h-11 rounded-xl border-gray-200 text-sm" dir="ltr" />
                </FormControl>
                <FormMessage className="text-[10px]" />
              </FormItem>
            )} />

            {/* Category */}
            <div className="space-y-2">
              <FormLabel className="text-xs text-gray-500">تصنيف التطبيق</FormLabel>
              <div className="grid grid-cols-4 gap-2">
                {categories.map((cat) => (
                  <button
                    key={cat.value}
                    type="button"
                    onClick={() => form.setValue('category', cat.value)}
                    className={`h-16 rounded-xl border text-center flex flex-col items-center justify-center gap-1 transition-all text-xs ${form.watch('category') === cat.value ? 'bg-gray-900 border-gray-900 text-white' : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300'}`}
                  >
                    <span className="text-base">{cat.icon}</span>
                    <span className="text-[10px] font-medium">{cat.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-wrap gap-2 pt-2">
              <button type="button" onClick={() => setOpen(false)}
                className="flex-1 h-11 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors">
                إلغاء
              </button>
              <button type="submit" disabled={isSaving}
                className="flex-1 h-11 rounded-xl bg-gray-900 text-white text-sm font-medium hover:bg-gray-800 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {isSaving ? 'جاري الحفظ...' : isEditing ? 'حفظ التعديلات' : 'إضافة التطبيق'}
              </button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
