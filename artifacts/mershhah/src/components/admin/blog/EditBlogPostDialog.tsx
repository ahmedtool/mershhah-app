'use client';

import { useState, useTransition, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Dialog, DialogContent, DialogTrigger, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Loader2, FileText } from "lucide-react";
import { supabase } from '@/lib/supabase';

const slugify = (s: string) =>
  s.trim().toLowerCase()
    .replace(/[^؀-ۿa-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');

const formSchema = z.object({
  slug: z.string().min(2, "الرابط مطلوب").regex(/^[a-z0-9-]+$/, "استخدم حروف إنجليزية صغيرة وأرقام وشرطات فقط."),
  title: z.string().min(3, "العنوان مطلوب"),
  description: z.string().optional(),
  reading_time: z.string().optional(),
  content: z.string().min(20, "المحتوى قصير جداً"),
  is_published: z.boolean().default(true),
});

type FormValues = z.infer<typeof formSchema>;

interface EditBlogPostDialogProps {
  children: React.ReactNode;
  post?: any;
  onSave?: () => void;
}

export function EditBlogPostDialog({ children, post, onSave }: EditBlogPostDialogProps) {
  const [open, setOpen] = useState(false);
  const [isSaving, startSaving] = useTransition();
  const [slugTouched, setSlugTouched] = useState(!!post);
  const { toast } = useToast();
  const isEditing = !!post;

  const form = useForm<FormValues>({ resolver: zodResolver(formSchema) });

  useEffect(() => {
    if (open) {
      form.reset(isEditing ? {
        slug: post.slug,
        title: post.title,
        description: post.description || "",
        reading_time: post.reading_time || "",
        content: post.content,
        is_published: post.is_published ?? true,
      } : {
        slug: "",
        title: "",
        description: "",
        reading_time: "",
        content: "",
        is_published: true,
      });
      setSlugTouched(isEditing);
    }
  }, [open, post, isEditing, form]);

  const handleTitleChange = (value: string) => {
    form.setValue('title', value);
    if (!slugTouched) {
      form.setValue('slug', slugify(value));
    }
  };

  async function onSubmit(values: FormValues) {
    startSaving(async () => {
      try {
        const dataToSave = {
          slug: values.slug,
          title: values.title,
          description: values.description || null,
          reading_time: values.reading_time || null,
          content: values.content,
          is_published: values.is_published,
          updated_at: new Date().toISOString(),
        };

        if (isEditing) {
          const { error } = await supabase.from('blog_posts').update(dataToSave).eq('id', post.id);
          if (error) throw error;
        } else {
          const { data: existing } = await supabase.from('blog_posts').select('id').eq('slug', values.slug).maybeSingle();
          if (existing) {
            toast({ variant: "destructive", title: "الرابط مستخدم بالفعل", description: "اختر رابطاً آخر لهذا المقال." });
            return;
          }
          const { error } = await supabase.from('blog_posts').insert({ ...dataToSave, published_at: new Date().toISOString() });
          if (error) throw error;
        }

        toast({ title: `تم ${isEditing ? 'تعديل' : 'نشر'} المقال بنجاح` });
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
      <DialogContent className="sm:max-w-2xl max-h-[92vh] overflow-y-auto p-0 gap-0" dir="rtl">
        <DialogTitle className="sr-only">{isEditing ? 'تعديل المقال' : 'مقال جديد'}</DialogTitle>
        <DialogDescription className="sr-only">أدخل بيانات المقال ثم احفظ</DialogDescription>

        <div className="px-5 pt-5 pb-3 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center">
              <FileText className="h-5 w-5 text-gray-600" />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900">{isEditing ? 'تعديل المقال' : 'مقال جديد'}</h2>
              <p className="text-xs text-gray-600 mt-0.5">{isEditing ? 'عدّل بيانات المقال ثم احفظ' : 'اكتب مقالاً جديداً للمدونة'}</p>
            </div>
          </div>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="p-5 space-y-4">
            <FormField control={form.control} name="title" render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs text-gray-600">عنوان المقال</FormLabel>
                <FormControl>
                  <Input placeholder="مثال: كيف تزيد أرباح مطعمك" {...field}
                    onChange={(e) => handleTitleChange(e.target.value)}
                    className="h-11 rounded-xl border-gray-200 text-sm" disabled={isSaving} />
                </FormControl>
                <FormMessage className="text-[10px]" />
              </FormItem>
            )} />

            <FormField control={form.control} name="slug" render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs text-gray-600">الرابط <span className="text-gray-600">(إنجليزي)</span></FormLabel>
                <FormControl>
                  <Input placeholder="how-to-grow-profits" {...field}
                    onChange={(e) => { setSlugTouched(true); field.onChange(e); }}
                    className="h-11 rounded-xl border-gray-200 text-sm" dir="ltr" disabled={isSaving} />
                </FormControl>
                <p className="text-[9px] text-gray-600 mt-1">mershhah.com/blog/{form.watch('slug') || '...'}</p>
                <FormMessage className="text-[10px]" />
              </FormItem>
            )} />

            <FormField control={form.control} name="description" render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs text-gray-600">وصف قصير (يظهر في بطاقة المقال)</FormLabel>
                <FormControl>
                  <Textarea placeholder="ملخص جذاب في سطر أو سطرين..." {...field} className="rounded-xl border-gray-200 text-sm min-h-[60px] resize-none" disabled={isSaving} />
                </FormControl>
                <FormMessage className="text-[10px]" />
              </FormItem>
            )} />

            <FormField control={form.control} name="reading_time" render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs text-gray-600">وقت القراءة</FormLabel>
                <FormControl>
                  <Input placeholder="مثال: 6 دقائق" {...field} className="h-11 rounded-xl border-gray-200 text-sm" disabled={isSaving} />
                </FormControl>
                <FormMessage className="text-[10px]" />
              </FormItem>
            )} />

            <FormField control={form.control} name="content" render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs text-gray-600">محتوى المقال (HTML)</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder={`<h2>عنوان فرعي</h2>\n<p>فقرة نصية...</p>\n<ul><li>نقطة أولى</li></ul>\n<blockquote>اقتباس مهم</blockquote>`}
                    {...field}
                    className="rounded-xl border-gray-200 text-xs font-mono min-h-[220px] resize-y"
                    dir="ltr"
                    disabled={isSaving}
                  />
                </FormControl>
                <p className="text-[9px] text-gray-600 mt-1">استخدم وسوم HTML بسيطة: h2, p, ul/li, blockquote, strong</p>
                <FormMessage className="text-[10px]" />
              </FormItem>
            )} />

            <FormField control={form.control} name="is_published" render={({ field }) => (
              <FormItem>
                <button type="button" onClick={() => field.onChange(!field.value)}
                  className={`w-full h-11 rounded-xl text-xs font-medium transition-all border ${field.value ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'}`}>
                  {field.value ? '✓ منشور — يظهر للزوار' : 'مسودة — غير منشور بعد'}
                </button>
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
                {isSaving ? 'جاري الحفظ...' : isEditing ? 'حفظ التعديلات' : 'نشر المقال'}
              </button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
