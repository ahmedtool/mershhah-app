'use client';

import { useState, useTransition, useEffect, useMemo, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Dialog, DialogContent, DialogTrigger, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Code2, Copy, Sparkles, Box, ExternalLink, FileCode, Globe, Plus, X as XIcon } from "lucide-react";
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
  price: z.coerce.number().min(0, "السعر لا يمكن أن يكون سالباً").default(0),
  icon: z.string().optional().default("Box"),
  color: z.string().optional().default("text-gray-600"),
  bg_color: z.string().optional().default("bg-gray-100"),
  popular: z.boolean().default(false),
  billing_type: z.enum(["plan", "addon"]).default("plan"),
  period_months: z.coerce.number().int().min(1, "المدة يجب أن تكون شهراً واحداً على الأقل.").nullable().optional(),
  tool_type: z.enum(["external", "embedded"]).default("external"),
  external_url: z.string().url("رابط غير صحيح").or(z.literal("")).optional(),
  content: z.string().optional(),
  developer_name: z.string().optional(),
  developer_url: z.string().url("رابط غير صحيح").or(z.literal("")).optional(),
  version: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

interface EditToolDialogProps {
  children: React.ReactNode;
  tool?: Tool;
  allTools?: any[];
  onSave?: () => void;
}

export function EditToolDialog({ children, tool, allTools = [], onSave }: EditToolDialogProps) {
  const [open, setOpen] = useState(false);
  const [isSaving, startSaving] = useTransition();
  const [isGenerating, startGeneratingIdea] = useTransition();
  const { toast } = useToast();
  const isEditing = !!tool;

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(tool?.image_path || null);
  const [localImageFile, setLocalImageFile] = useState<File | null>(null);

  const screenshotsInputRef = useRef<HTMLInputElement | null>(null);
  const [existingScreenshots, setExistingScreenshots] = useState<string[]>(tool?.screenshots || []);
  const [newScreenshots, setNewScreenshots] = useState<File[]>([]);
  const MAX_SCREENSHOTS = 6;

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
  });

  const toolId = form.watch('id');
  const selectedCategory = form.watch('category');
  const billingType = form.watch('billing_type');
  const toolType = form.watch('tool_type');

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
        price: (tool as any).price ?? 0,
        billing_type: tool.billing_type || "plan",
        period_months: tool.period_months ?? (tool.billing_type === "addon" ? 1 : null),
        tool_type: (tool as any).tool_type || "external",
        external_url: (tool as any).external_url || "",
        content: (tool as any).content || "",
        developer_name: tool.developer_name || "",
        developer_url: tool.developer_url || "",
        version: tool.version || "1.0.0",
      } : {
        id: "",
        title: "",
        description: "",
        category: "",
        price_label: "مجاني",
        price: 0,
        icon: "Box",
        color: "text-primary",
        bg_color: "bg-primary/10",
        popular: false,
        billing_type: "plan",
        period_months: null,
        tool_type: "external",
        external_url: "",
        content: "",
        developer_name: "",
        developer_url: "",
        version: "1.0.0",
      });
      setPreviewImage(tool?.image_path || null);
      setLocalImageFile(null);
      setExistingScreenshots(tool?.screenshots || []);
      setNewScreenshots([]);
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
        const safeId = isEditing ? tool!.id : values.id;

        if (localImageFile) {
          const fileExt = localImageFile.name.split('.').pop();
          const fileName = `tools/${safeId}/${safeId}.${fileExt}`;
          const { data: uploadData, error: uploadError } = await supabase.storage
            .from('restaurant-assets')
            .upload(fileName, localImageFile, { upsert: true });
          if (uploadError) throw uploadError;
          imagePath = uploadData.path;
        }

        const uploadedScreenshotPaths: string[] = [];
        for (let i = 0; i < newScreenshots.length; i++) {
          const file = newScreenshots[i];
          const fileExt = file.name.split('.').pop();
          const fileName = `tools/${safeId}/screenshots/${Date.now()}-${i}.${fileExt}`;
          const { data: uploadData, error: uploadError } = await supabase.storage
            .from('restaurant-assets')
            .upload(fileName, file, { upsert: true });
          if (uploadError) throw uploadError;
          uploadedScreenshotPaths.push(uploadData.path);
        }
        const screenshots = [...existingScreenshots, ...uploadedScreenshotPaths];

        const dataToSave: any = {
          title: values.title,
          description: values.description,
          category: values.category,
          price_label: values.price_label,
          price: values.price,
          icon: values.icon,
          color: values.color,
          bg_color: values.bg_color,
          popular: values.popular,
          billing_type: values.billing_type,
          period_months: values.period_months,
          tool_type: values.tool_type,
          external_url: values.tool_type === 'external' ? values.external_url : null,
          content: values.tool_type === 'embedded' ? values.content : null,
          developer_name: values.developer_name,
          developer_url: values.developer_url,
          version: values.version,
          // Derived from the actual numeric price, not a separate toggle —
          // a tool can't be "free" with a price attached or vice versa.
          type: values.price > 0 ? 'paid' : 'free',
          image_path: imagePath ?? null,
          screenshots,
        };

        // Reusing a StreamPay product across price edits would silently
        // keep charging the old amount — force a fresh one next purchase.
        if (isEditing && Number((tool as any).price ?? 0) !== values.price) {
          dataToSave.streampay_product_id = null;
        }

        if (isEditing) {
          const { error } = await supabase.from('tools').update(dataToSave).eq('id', tool!.id);
          if (error) throw error;
        } else {
          dataToSave.id = values.id;
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
        <DialogTitle className="sr-only">{isEditing ? 'تعديل الأداة' : 'إضافة أداة جديدة'}</DialogTitle>
        <DialogDescription className="sr-only">{isEditing ? 'عدّل بيانات الأداة ثم احفظ' : 'أدخل البيانات أو استخدم الذكاء الاصطناعي'}</DialogDescription>
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
                className="h-8 px-3 rounded-lg bg-blue-50 text-blue-600 text-[11px] font-medium hover:bg-blue-100 transition-colors flex items-center gap-1.5 disabled:opacity-50">
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

            {/* Screenshots */}
            <div>
              <p className="text-xs text-gray-500 mb-2">لقطات شاشة للأداة (تظهر لصاحب المطعم عند فتح تفاصيل الأداة)</p>
              <div className="flex items-center gap-2 overflow-x-auto pb-1">
                {existingScreenshots.map((path, i) => (
                  <div key={`existing-${i}`} className="relative w-16 h-16 rounded-xl overflow-hidden shrink-0 bg-gray-50">
                    <StorageImage imagePath={path} alt={`screenshot ${i + 1}`} width={64} height={64} className="w-full h-full object-cover" />
                    <button type="button" onClick={() => setExistingScreenshots(prev => prev.filter((_, idx) => idx !== i))}
                      className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-black/60 text-white flex items-center justify-center">
                      <XIcon className="h-2.5 w-2.5" />
                    </button>
                  </div>
                ))}
                {newScreenshots.map((file, i) => (
                  <div key={`new-${i}`} className="relative w-16 h-16 rounded-xl overflow-hidden shrink-0 bg-gray-50">
                    <img src={URL.createObjectURL(file)} alt={`new screenshot ${i + 1}`} className="w-full h-full object-cover" />
                    <button type="button" onClick={() => setNewScreenshots(prev => prev.filter((_, idx) => idx !== i))}
                      className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-black/60 text-white flex items-center justify-center">
                      <XIcon className="h-2.5 w-2.5" />
                    </button>
                  </div>
                ))}
                {existingScreenshots.length + newScreenshots.length < MAX_SCREENSHOTS && (
                  <button type="button" onClick={() => screenshotsInputRef.current?.click()}
                    className="w-16 h-16 rounded-xl border-2 border-dashed border-gray-200 flex items-center justify-center hover:border-gray-300 hover:bg-gray-50 transition-all shrink-0">
                    <Plus className="h-4 w-4 text-gray-300" />
                  </button>
                )}
              </div>
              <input ref={screenshotsInputRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => {
                const files = Array.from(e.target.files || []);
                e.target.value = '';
                const room = MAX_SCREENSHOTS - existingScreenshots.length - newScreenshots.length;
                const tooBig = files.find(f => f.size > 1024 * 1024);
                if (tooBig) { toast({ variant: "destructive", title: "حجم صورة كبير", description: "كل صورة أقل من 1 ميجابايت" }); return; }
                setNewScreenshots(prev => [...prev, ...files.slice(0, room)]);
              }} />
            </div>

            {/* Tool Type */}
            <FormField control={form.control} name="tool_type" render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs text-gray-500">نوع الأداة</FormLabel>
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => field.onChange('external')}
                    className={`h-14 rounded-xl border-2 flex flex-col items-center justify-center gap-1 transition-all ${
                      field.value === 'external' ? 'border-gray-900 bg-gray-50' : 'border-gray-200 hover:border-gray-300'
                    }`}>
                    <Globe className={`h-4 w-4 ${field.value === 'external' ? 'text-gray-900' : 'text-gray-400'}`} />
                    <span className={`text-[10px] font-bold ${field.value === 'external' ? 'text-gray-900' : 'text-gray-500'}`}>أداة خارجية</span>
                    <span className="text-[8px] text-gray-400">رابط URL</span>
                  </button>
                  <button type="button" onClick={() => field.onChange('embedded')}
                    className={`h-14 rounded-xl border-2 flex flex-col items-center justify-center gap-1 transition-all ${
                      field.value === 'embedded' ? 'border-gray-900 bg-gray-50' : 'border-gray-200 hover:border-gray-300'
                    }`}>
                    <FileCode className={`h-4 w-4 ${field.value === 'embedded' ? 'text-gray-900' : 'text-gray-400'}`} />
                    <span className={`text-[10px] font-bold ${field.value === 'embedded' ? 'text-gray-900' : 'text-gray-500'}`}>أداة مدمجة</span>
                    <span className="text-[8px] text-gray-400">HTML/CSS/JS</span>
                  </button>
                </div>
              </FormItem>
            )} />

            {/* External URL */}
            {toolType === 'external' && (
              <FormField control={form.control} name="external_url" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs text-gray-500">رابط الأداة الخارجي</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Globe className="absolute end-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-300" />
                      <Input placeholder="https://my-tool.com" {...field} className="h-11 rounded-xl border-gray-200 text-sm pe-9" dir="ltr" disabled={isSaving} />
                    </div>
                  </FormControl>
                  <p className="text-[9px] text-gray-400 mt-1">الأداة ستفتح داخل iframe في المنصة</p>
                  <FormMessage className="text-[10px]" />
                </FormItem>
              )} />
            )}

            {/* Embedded Content */}
            {toolType === 'embedded' && (
              <FormField control={form.control} name="content" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs text-gray-500">كود الأداة (HTML + CSS + JS)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder={`<div class="tool-container">\n  <h2>أداتي</h2>\n  <p>مرحباً!</p>\n</div>\n\n<style>\n  .tool-container { padding: 20px; }\n</style>\n\n<script>\n  console.log('أداة جديدة!');\n</script>`}
                      {...field}
                      className="rounded-xl border-gray-200 text-xs font-mono min-h-[150px] resize-y"
                      dir="ltr"
                      disabled={isSaving}
                    />
                  </FormControl>
                  <p className="text-[9px] text-gray-400 mt-1">اكتب الكود بالكامل — HTML + CSS + JS في ملف واحد</p>
                  <FormMessage className="text-[10px]" />
                </FormItem>
              )} />
            )}

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

            {/* Price */}
            <div className="grid grid-cols-2 gap-3">
              <FormField control={form.control} name="price" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs text-gray-500">السعر (ر.س) — 0 = مجانية</FormLabel>
                  <FormControl>
                    <Input type="number" min={0} step="0.01" {...field} className="h-11 rounded-xl border-gray-200 text-sm" dir="ltr" disabled={isSaving} />
                  </FormControl>
                  <p className="text-[9px] text-gray-400 mt-1">
                    {billingType === 'addon'
                      ? `يُحصَّل فعليًا عبر StreamPay عند التفعيل${form.watch('period_months') ? ` كل ${form.watch('period_months')} شهر` : ''}`
                      : 'مطلوب اشتراك مدفوع بالمنصة لتفعيلها — بدون تحصيل منفصل'}
                  </p>
                  <FormMessage className="text-[10px]" />
                </FormItem>
              )} />
              <FormField control={form.control} name="price_label" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs text-gray-500">بطاقة السعر (نص العرض)</FormLabel>
                  <FormControl>
                    <Input placeholder="مجاني أو 50 ر.س/شهر" {...field} className="h-11 rounded-xl border-gray-200 text-sm" disabled={isSaving} />
                  </FormControl>
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
            <div className="rounded-xl bg-gray-50 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Code2 className="h-4 w-4 text-gray-400" />
                <span className="text-xs font-bold text-gray-600">معلومات المطور</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <FormField control={form.control} name="developer_name" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[10px] text-gray-500">اسم المطور</FormLabel>
                    <FormControl>
                      <Input placeholder="اسم الشركة أو المطور" {...field} className="h-9 rounded-lg border-gray-200 text-[11px]" disabled={isSaving} />
                    </FormControl>
                    <FormMessage className="text-[10px]" />
                  </FormItem>
                )} />
                <FormField control={form.control} name="version" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[10px] text-gray-500">الإصدار</FormLabel>
                    <FormControl>
                      <Input placeholder="1.0.0" {...field} className="h-9 rounded-lg border-gray-200 text-[11px]" dir="ltr" disabled={isSaving} />
                    </FormControl>
                    <FormMessage className="text-[10px]" />
                  </FormItem>
                )} />
              </div>
              <FormField control={form.control} name="developer_url" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[10px] text-gray-500">رابط المطور</FormLabel>
                  <FormControl>
                    <Input placeholder="https://developer.com" {...field} className="h-9 rounded-lg border-gray-200 text-[11px]" dir="ltr" disabled={isSaving} />
                  </FormControl>
                  <FormMessage className="text-[10px]" />
                </FormItem>
              )} />
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
