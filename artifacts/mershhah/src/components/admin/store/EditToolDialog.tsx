'use client';

import { useState, useTransition, useEffect, useMemo, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Code2, Copy, Sparkles, Box } from "lucide-react";
import { supabase } from '@/lib/supabase';
import { generateToolIdeas } from "@/ai/flows/generate-tool-ideas";
import { StorageImage } from "@/components/shared/StorageImage";
import type { Tool } from "@/lib/types";

const formSchema = z.object({
  id: z.string().min(3, "المعرّف يجب أن يكون 3 أحرف على الأقل.").regex(/^[a-z0-9-]+$/, "استخدم حروف إنجليزية صغيرة وأرقام وشرطات فقط."),
  title: z.string().min(2, "العنوان مطلوب"),
  description: z.string().min(10, "الوصف يجب أن يكون 10 أحرف على الأقل"),
  category: z.string().min(1, "الرجاء اختيار أو إدخال تصنيف."),
  price_label: z.string().min(1, "بطاقة السعر مطلوبة"),
  icon: z.string().min(1, "الأيقونة مطلوبة"),
  color: z.string().regex(/^text-/, "يجب أن يبدأ بـ 'text-'"),
  bg_color: z.string().regex(/^bg-/, "يجب أن يبدأ بـ 'bg-'"),
  popular: z.boolean().default(false),
  billing_type: z.enum(["plan", "addon"]).default("plan"),
  period_months: z.coerce.number().int().min(1, "المدة يجب أن تكون شهراً واحداً على الأقل.").nullable().optional(),
});

type FormValues = z.infer<typeof formSchema>;

interface EditToolDialogProps {
  children: React.ReactNode;
  tool?: Tool;
  allTools?: any[];
  onSave?: () => void;
}

const iconList = ['MessageCircle', 'Star', 'Truck', 'BarChart3', 'Megaphone', 'Box', 'KeyRound', 'Clock', 'Info', 'Calculator', 'FileText', 'Wrench', 'BrainCircuit', 'HeartPulse', 'ThumbsUp', 'Sparkles', 'CalendarDays'];
const colorList = [
  { name: 'أزرق', value: 'blue-500' },
  { name: 'أخضر', value: 'green-500' },
  { name: 'برتقالي', value: 'orange-500' },
  { name: 'بنفسجي', value: 'violet-500' },
  { name: 'وردي', value: 'pink-500' },
  { name: 'أساسي', value: 'primary' },
];

export function EditToolDialog({ children, tool, allTools = [], onSave }: EditToolDialogProps) {
  const [open, setOpen] = useState(false);
  const [isSaving, startSaving] = useTransition();
  const [isGenerating, startGeneratingIdea] = useTransition();
  const { toast } = useToast();
  const isEditing = !!tool;

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(tool?.image_path || null);
  const [localImageFile, setLocalImageFile] = useState<File | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
  });

  const toolId = form.watch('id');
  const selectedCategory = form.watch('category');
  const billingType = form.watch('billing_type');

  const uniqueCategories = useMemo(() => {
    if (!allTools) return ['marketing', 'operations', 'analytics'];
    const existing = allTools.map(t => t.category).filter(Boolean);
    const defaults = ['marketing', 'operations', 'analytics'];
    return [...new Set([...defaults, ...existing])];
  }, [allTools]);

  useEffect(() => {
    if (open) {
      form.reset(isEditing ? {
        ...tool,
        id: tool.id,
        billing_type: tool.billing_type || "plan",
        period_months: tool.period_months ?? (tool.billing_type === "addon" ? 1 : null),
      } : {
        id: "",
        title: "",
        description: "",
        category: "",
        price_label: "مجاني",
        icon: "Box",
        color: "text-primary",
        bg_color: "bg-primary/10",
        popular: false,
        billing_type: "plan",
        period_months: null,
      });
      setPreviewImage(tool?.image_path || null);
      setLocalImageFile(null);
    }
  }, [open, tool, isEditing, form]);

  const handleGenerateToolIdea = () => {
    if (!selectedCategory) {
      toast({ title: "الرجاء اختيار تصنيف أولاً", variant: "destructive" });
      return;
    }
    startGeneratingIdea(async () => {
      try {
        const result = await generateToolIdeas({
          restaurantType: selectedCategory,
          currentTools: allTools.map(t => t.title),
        });
        if (result.ideas && result.ideas.length > 0) {
          form.setValue('description', result.ideas[0], { shouldValidate: true });
          toast({ title: "تم إنشاء فكرة أداة جديدة!", description: "تم تعبئة حقل الوصف بالفكرة المقترحة." });
        }
      } catch (error: any) {
        toast({ title: "فشل إنشاء الفكرة", description: error.message, variant: "destructive" });
      }
    });
  };

  async function onSubmit(values: FormValues) {
    startSaving(async () => {
      try {
        let imagePath: string | null | undefined = tool?.image_path || null;

        if (localImageFile) {
          const fileExt = localImageFile.name.split('.').pop();
          const safeId = isEditing ? tool!.id : values.id;
          const fileName = `tools/${safeId}/${safeId}.${fileExt}`;
          const { data: uploadData, error: uploadError } = await supabase.storage
            .from('restaurant-assets')
            .upload(fileName, localImageFile, { upsert: true });
          if (uploadError) throw uploadError;
          imagePath = uploadData.path;
        }

        const dataToSave: any = {
          ...values,
          type: 'free',
          image_path: imagePath ?? null,
        };

        if (isEditing) {
          const { id, ...updateData } = dataToSave;
          const { error } = await supabase.from('tools').update(updateData).eq('id', tool!.id);
          if (error) throw error;
        } else {
          const { data: existing } = await supabase.from('tools').select('id').eq('id', values.id).single();
          if (existing) {
            toast({ variant: "destructive", title: "المعرف مستخدم بالفعل", description: "هذا المعرف مستخدم من قبل أداة أخرى." });
            return;
          }
          const { error } = await supabase.from('tools').insert(dataToSave);
          if (error) throw error;
        }

        toast({ title: `تم ${isEditing ? 'تعديل' : 'إضافة'} الأداة بنجاح` });
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
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center">
                <Box className="h-5 w-5 text-gray-500" />
              </div>
              <div>
                <h2 className="text-base font-bold text-gray-900">{isEditing ? 'تعديل الأداة' : 'إضافة أداة جديدة'}</h2>
                <p className="text-xs text-gray-400 mt-0.5">{isEditing ? 'عدّل بيانات الأداة ثم احفظ' : 'أدخل البيانات أو استخدم الذكاء الاصطناعي'}</p>
              </div>
            </div>
            {!isEditing && (
              <button type="button" onClick={handleGenerateToolIdea} disabled={isGenerating || !selectedCategory}
                className="h-8 px-3 rounded-lg bg-purple-50 text-purple-600 text-[11px] font-medium hover:bg-purple-100 transition-colors flex items-center gap-1.5 disabled:opacity-50">
                {isGenerating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                اقترح فكرة
              </button>
            )}
          </div>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="p-5 space-y-4">
            {/* Title + Image */}
            <div className="flex items-start gap-4">
              <div className="flex-1 space-y-3">
                <FormField control={form.control} name="title" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs text-gray-500">عنوان الأداة</FormLabel>
                    <FormControl>
                      <Input placeholder="مثال: تحليلات متقدمة" {...field} className="h-11 rounded-xl border-gray-200 text-sm" disabled={isSaving} />
                    </FormControl>
                    <FormMessage className="text-[10px]" />
                  </FormItem>
                )} />
                <FormField control={form.control} name="id" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs text-gray-500">المعرّف <span className="text-gray-300">(إنجليزي)</span></FormLabel>
                    <FormControl>
                      <Input placeholder="advanced-analytics" {...field} disabled={isEditing || isSaving} className="h-11 rounded-xl border-gray-200 text-sm" dir="ltr" />
                    </FormControl>
                    <FormMessage className="text-[10px]" />
                  </FormItem>
                )} />
              </div>
              {/* Image Upload */}
              <button type="button" onClick={() => fileInputRef.current?.click()}
                className="w-20 h-20 rounded-2xl border-2 border-dashed border-gray-200 flex items-center justify-center hover:border-gray-300 hover:bg-gray-50 transition-all shrink-0">
                {previewImage ? (
                  <StorageImage imagePath={previewImage} alt="tool" height={72} width={72} className="w-full h-full object-contain rounded-xl" />
                ) : (
                  <span className="text-[9px] text-gray-300 text-center">صورة<br />الأداة</span>
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

            {/* Category */}
            <FormField control={form.control} name="category" render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs text-gray-500">التصنيف</FormLabel>
                <FormControl>
                  <Input placeholder="مثال: marketing, operations, analytics" {...field} className="h-11 rounded-xl border-gray-200 text-sm" disabled={isSaving} />
                </FormControl>
                <div className="flex flex-wrap gap-1 mt-1">
                  {uniqueCategories.slice(0, 5).map((cat) => (
                    <button key={cat} type="button" onClick={() => field.onChange(cat)}
                      className={`px-2 py-0.5 rounded-full text-[10px] transition-colors ${field.value === cat ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
                      {cat}
                    </button>
                  ))}
                </div>
                <FormMessage className="text-[10px]" />
              </FormItem>
            )} />

            {/* Billing Type & Period */}
            <div className="grid grid-cols-2 gap-3">
              <FormField control={form.control} name="billing_type" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs text-gray-500">نوع الصلاحية</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger className="h-11 rounded-xl border-gray-200 text-xs"><SelectValue /></SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="plan" className="text-xs">مع الاشتراك الأساسي</SelectItem>
                      <SelectItem value="addon" className="text-xs">اشتراك مستقل</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage className="text-[10px]" />
                </FormItem>
              )} />
              <FormField control={form.control} name="period_months" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs text-gray-500">المدة (أشهر)</FormLabel>
                  <FormControl>
                    <Input type="number" min={1} placeholder="1" {...field} value={field.value ?? ''} disabled={billingType !== 'addon'} className="h-11 rounded-xl border-gray-200 text-sm" dir="ltr" />
                  </FormControl>
                  <FormMessage className="text-[10px]" />
                </FormItem>
              )} />
            </div>

            {/* Description */}
            <FormField control={form.control} name="description" render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs text-gray-500">الوصف</FormLabel>
                <FormControl>
                  <Textarea placeholder="وصف قصير وجذاب للأداة..." {...field} className="rounded-xl border-gray-200 text-sm min-h-[70px] resize-none" disabled={isSaving} />
                </FormControl>
                <FormMessage className="text-[10px]" />
              </FormItem>
            )} />

            {/* Price & Icon */}
            <div className="grid grid-cols-2 gap-3">
              <FormField control={form.control} name="price_label" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs text-gray-500">بطاقة السعر</FormLabel>
                  <FormControl>
                    <Input placeholder="مجاني أو 50 ر.س" {...field} className="h-11 rounded-xl border-gray-200 text-sm" disabled={isSaving} />
                  </FormControl>
                  <FormMessage className="text-[10px]" />
                </FormItem>
              )} />
              <FormField control={form.control} name="icon" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs text-gray-500">الأيقونة</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger className="h-11 rounded-xl border-gray-200 text-xs"><SelectValue /></SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {iconList.map(i => <SelectItem key={i} value={i} className="text-xs">{i}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <FormMessage className="text-[10px]" />
                </FormItem>
              )} />
            </div>

            {/* Colors */}
            <div className="grid grid-cols-2 gap-3">
              <FormField control={form.control} name="color" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs text-gray-500">لون الأيقونة</FormLabel>
                  <div className="flex gap-1.5">
                    {colorList.map((c) => (
                      <button key={c.value} type="button" onClick={() => field.onChange(`text-${c.value}`)}
                        className={`w-8 h-8 rounded-lg border-2 transition-all flex items-center justify-center ${field.value === `text-${c.value}` ? 'border-gray-900 scale-110' : 'border-gray-100 hover:border-gray-300'}`}>
                        <span className={`w-3 h-3 rounded-full bg-${c.value}`} />
                      </button>
                    ))}
                  </div>
                  <FormMessage className="text-[10px]" />
                </FormItem>
              )} />
              <FormField control={form.control} name="bg_color" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs text-gray-500">لون الخلفية</FormLabel>
                  <div className="flex gap-1.5">
                    {colorList.map((c) => (
                      <button key={c.value} type="button" onClick={() => field.onChange(`bg-${c.value}/10`)}
                        className={`w-8 h-8 rounded-lg border-2 transition-all flex items-center justify-center ${field.value === `bg-${c.value}/10` ? 'border-gray-900 scale-110' : 'border-gray-100 hover:border-gray-300'}`}>
                        <span className={`w-3 h-3 rounded-full bg-${c.value}/20`} />
                      </button>
                    ))}
                  </div>
                  <FormMessage className="text-[10px]" />
                </FormItem>
              )} />
            </div>

            {/* Popular Toggle */}
            <FormField control={form.control} name="popular" render={({ field }) => (
              <FormItem>
                <button type="button" onClick={() => field.onChange(!field.value)}
                  className={`w-full h-11 rounded-xl text-xs font-medium transition-all border ${field.value ? 'bg-amber-50 border-amber-200 text-amber-700' : 'bg-white border-gray-200 text-gray-400 hover:border-gray-300'}`}>
                  {field.value ? '⭐ أداة شائعة' : 'تعيين كأداة شائعة'}
                </button>
              </FormItem>
            )} />

            {/* Developer Info */}
            <div className="rounded-xl bg-gray-50 p-4 space-y-2">
              <div className="flex items-center gap-2">
                <Code2 className="h-4 w-4 text-gray-400" />
                <span className="text-xs font-bold text-gray-600">مسار الملف</span>
              </div>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-[11px] text-gray-400 bg-white px-3 py-2 rounded-lg border border-gray-200" dir="ltr">
                  {toolId ? `src/app/owner/tools/${toolId}/page.tsx` : 'src/app/owner/tools/.../page.tsx'}
                </code>
                <button type="button" onClick={() => { navigator.clipboard.writeText(`src/app/owner/tools/${toolId}/page.tsx`); toast({ title: "تم النسخ" }); }} disabled={!toolId}
                  className="h-9 w-9 rounded-lg border border-gray-200 flex items-center justify-center hover:bg-gray-100 transition-colors disabled:opacity-50">
                  <Copy className="h-3.5 w-3.5 text-gray-400" />
                </button>
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
                {isSaving ? 'جاري الحفظ...' : isEditing ? 'حفظ التعديلات' : 'إضافة الأداة'}
              </button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
