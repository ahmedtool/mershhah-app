'use client';

import { useState, useTransition, useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Dialog, DialogContent, DialogTrigger, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Loader2, CupSoda } from "lucide-react";
import { supabase } from '@/lib/supabase';
import { StorageImage } from "@/components/shared/StorageImage";
import type { SharedMenuProduct } from "@/lib/types";

const CATEGORIES = ['مشروبات غازية', 'عصائر طبيعية', 'حلويات', 'صوصات'];

const formSchema = z.object({
  name: z.string().min(2, "الاسم مطلوب"),
  category: z.string().min(1, "الرجاء اختيار أو إدخال تصنيف"),
  calories: z.coerce.number().min(0).optional().or(z.literal(0)),
});

type FormValues = z.infer<typeof formSchema>;

interface EditSharedProductDialogProps {
  children: React.ReactNode;
  product?: SharedMenuProduct;
  onSave?: () => void;
}

export function EditSharedProductDialog({ children, product, onSave }: EditSharedProductDialogProps) {
  const [open, setOpen] = useState(false);
  const [isSaving, startSaving] = useTransition();
  const { toast } = useToast();
  const isEditing = !!product;

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(product?.image_path || null);
  const [localImageFile, setLocalImageFile] = useState<File | null>(null);

  const form = useForm<FormValues>({ resolver: zodResolver(formSchema) });

  useEffect(() => {
    if (open) {
      form.reset(isEditing ? {
        name: product.name,
        category: product.category || '',
        calories: product.calories ?? 0,
      } : {
        name: '', category: '', calories: 0,
      });
      setPreviewImage(product?.image_path || null);
      setLocalImageFile(null);
    }
  }, [open, product, isEditing, form]);

  async function onSubmit(values: FormValues) {
    startSaving(async () => {
      try {
        const productId = isEditing ? product!.id : crypto.randomUUID();
        let imagePath: string | null | undefined = product?.image_path || null;

        if (localImageFile) {
          const fileExt = localImageFile.name.split('.').pop();
          const fileName = `shared-products/${productId}/${productId}.${fileExt}`;
          const { data: uploadData, error: uploadError } = await supabase.storage
            .from('restaurant-assets')
            .upload(fileName, localImageFile, { upsert: true });
          if (uploadError) throw uploadError;
          imagePath = uploadData.path;
        }

        const dataToSave = {
          name: values.name,
          category: values.category,
          calories: values.calories || null,
          image_path: imagePath,
          updated_at: new Date().toISOString(),
        };

        if (isEditing) {
          const { error } = await supabase.from('shared_menu_products').update(dataToSave).eq('id', product!.id);
          if (error) throw error;
        } else {
          const { error } = await supabase.from('shared_menu_products').insert({ id: productId, ...dataToSave });
          if (error) throw error;
        }

        toast({ title: `تم ${isEditing ? 'تعديل' : 'إضافة'} المنتج بنجاح` });
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
      <DialogContent className="sm:max-w-md p-0 gap-0" dir="rtl">
        <DialogTitle className="sr-only">{isEditing ? 'تعديل المنتج' : 'إضافة منتج جديد'}</DialogTitle>
        <DialogDescription className="sr-only">أدخل اسم المنتج والسعرات الحرارية وصورته</DialogDescription>
        <div className="px-5 pt-5 pb-3 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center">
              <CupSoda className="h-5 w-5 text-gray-600" />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900">{isEditing ? 'تعديل المنتج' : 'إضافة منتج للمكتبة'}</h2>
              <p className="text-xs text-gray-600 mt-0.5">يظهر لكل أصحاب المطاعم ليضيفوه لمنيوهم</p>
            </div>
          </div>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="p-5 space-y-4">
            <div className="flex items-start gap-4">
              <div className="flex-1 space-y-3">
                <FormField control={form.control} name="name" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs text-gray-600">اسم المنتج</FormLabel>
                    <FormControl>
                      <Input placeholder="مثال: عصير مانجو" {...field} className="h-11 rounded-xl border-gray-200 text-sm" disabled={isSaving} />
                    </FormControl>
                    <FormMessage className="text-[10px]" />
                  </FormItem>
                )} />
                <FormField control={form.control} name="calories" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs text-gray-600">السعرات الحرارية</FormLabel>
                    <FormControl>
                      <Input type="number" min={0} placeholder="150" {...field} className="h-11 rounded-xl border-gray-200 text-sm" dir="ltr" disabled={isSaving} />
                    </FormControl>
                    <FormMessage className="text-[10px]" />
                  </FormItem>
                )} />
              </div>
              <button type="button" onClick={() => fileInputRef.current?.click()}
                className="w-20 h-20 rounded-2xl border-2 border-dashed border-gray-200 flex items-center justify-center hover:border-gray-300 hover:bg-gray-50 transition-all shrink-0 overflow-hidden">
                {previewImage ? (
                  <StorageImage imagePath={previewImage} alt="product" height={72} width={72} className="w-full h-full object-cover rounded-xl" />
                ) : (
                  <span className="text-[9px] text-gray-600 text-center">صورة<br />المنتج</span>
                )}
              </button>
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                if (file.size > 1024 * 1024) { toast({ variant: "destructive", title: "حجم الصورة كبير", description: "أقل من 1 ميجابايت" }); return; }
                setLocalImageFile(file);
                setPreviewImage(URL.createObjectURL(file));
              }} />
            </div>

            <FormField control={form.control} name="category" render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs text-gray-600">التصنيف</FormLabel>
                <FormControl>
                  <Input placeholder="مثال: عصائر طبيعية" {...field} className="h-11 rounded-xl border-gray-200 text-sm" disabled={isSaving} />
                </FormControl>
                <div className="flex flex-wrap gap-1 mt-1">
                  {CATEGORIES.map((cat) => (
                    <button key={cat} type="button" onClick={() => field.onChange(cat)}
                      className={`px-2 py-0.5 rounded-full text-[10px] transition-colors ${field.value === cat ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                      {cat}
                    </button>
                  ))}
                </div>
                <FormMessage className="text-[10px]" />
              </FormItem>
            )} />

            <div className="flex flex-wrap gap-2 pt-2">
              <button type="button" onClick={() => setOpen(false)}
                className="flex-1 h-11 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors">
                إلغاء
              </button>
              <button type="submit" disabled={isSaving}
                className="flex-1 h-11 rounded-xl bg-gray-900 text-white text-sm font-medium hover:bg-gray-800 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {isSaving ? 'جاري الحفظ...' : isEditing ? 'حفظ التعديلات' : 'إضافة المنتج'}
              </button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
