'use client';

import { useEffect, useState, useTransition } from 'react';
import { useParams } from 'wouter';
import { supabase } from '@/lib/supabase';
import { getPublicPage } from '@/lib/public-pages';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Loader2, ChevronRight, CheckCircle, Info } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { StorageImage } from '@/components/shared/StorageImage';
import { Skeleton } from '@/components/ui/skeleton';

const ticketSchema = z.object({
  name: z.string().min(2, 'الاسم مطلوب'),
  phone: z.string().min(10, 'رقم الجوال مطلوب'),
  category: z.enum(['complaint', 'inquiry', 'employment', 'suggestion', 'other']),
  subject: z.string().min(3, 'الموضوع مطلوب'),
  message: z.string().min(5, 'الرسالة مطلوبة'),
});

const categoryOptions = [
  { value: 'complaint', label: 'شكوى', icon: '⚠️' },
  { value: 'inquiry', label: 'استفسار', icon: '❓' },
  { value: 'employment', label: 'توظيف', icon: '💼' },
  { value: 'suggestion', label: 'اقتراح', icon: '💡' },
  { value: 'other', label: 'أخرى', icon: '📝' },
] as const;

export default function SupportPage() {
  const params = useParams();
  const username = params.username as string;
  const { toast } = useToast();

  const [restaurant, setRestaurant] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, startSubmitting] = useTransition();
  const [submitted, setSubmitted] = useState(false);

  const form = useForm<z.infer<typeof ticketSchema>>({
    resolver: zodResolver(ticketSchema),
    defaultValues: { name: '', phone: '', category: 'other', subject: '', message: '' },
  });

  useEffect(() => {
    const fetchData = async () => {
      if (!username) return;
      try {
        const data = await getPublicPage(username);
        if (data?.restaurant) {
          setRestaurant(data.restaurant);
          setLoading(false);
          return;
        }
        const { data: rest } = await supabase
          .from('restaurants')
          .select('*')
          .eq('username', username)
          .limit(1)
          .single();
        setRestaurant(rest || null);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [username]);

  const onSubmit = (values: z.infer<typeof ticketSchema>) => {
    if (!restaurant) return;
    startSubmitting(async () => {
      try {
        const { error } = await supabase.from('support_tickets').insert({
          name: values.name,
          email: '',
          subject: values.subject,
          message: values.message,
          phone: values.phone,
          category: values.category,
          restaurant_id: restaurant.id,
          restaurant_name: restaurant.name,
          status: 'open',
          created_at: new Date().toISOString(),
        });
        if (error) throw error;
        setSubmitted(true);
      } catch (error: any) {
        toast({
          title: 'خطأ',
          description: 'فشل إرسال التذكرة. حاول مرة أخرى.',
          variant: 'destructive',
        });
      }
    });
  };

  const primaryColor = restaurant?.primaryColor || '#111827';

  if (loading) {
    return (
      <div className="min-h-screen bg-white" dir="rtl">
        <div className="max-w-lg mx-auto px-5 space-y-8 pt-8">
          <div className="flex flex-col items-center space-y-4">
            <Skeleton className="h-20 w-20 rounded-2xl" />
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-4 w-32" />
          </div>
          <Skeleton className="h-80 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  if (!restaurant) {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center bg-white text-center p-6 space-y-5">
        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center text-gray-400">
          <Info size={28} />
        </div>
        <h1 className="text-lg font-bold text-gray-900">المطعم غير موجود</h1>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white pb-16" dir="rtl">

      {/* Header */}
      <div className="max-w-lg mx-auto w-full px-5 pt-6 pb-4 flex items-center justify-between">
        <button
          onClick={() => window.history.back()}
          className="w-9 h-9 rounded-xl flex items-center justify-center text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition-colors"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
        <div className="w-9" />
      </div>

      <div className="max-w-lg mx-auto w-full px-5 pb-8 text-center space-y-3 text-right">
        <div className="relative w-16 h-16 mx-auto rounded-2xl overflow-hidden">
          <StorageImage
            imagePath={restaurant.logo}
            alt={restaurant.name}
            fill
            sizes="64px"
            className="object-cover"
          />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">{restaurant.name}</h1>
          <p className="text-sm text-gray-400 mt-0.5">تذكرة دعم</p>
        </div>
      </div>

      <div className="max-w-lg mx-auto w-full px-5">
        {submitted ? (
          <div className="text-center py-20 space-y-4">
            <div className="w-16 h-16 rounded-full bg-emerald-50 flex items-center justify-center mx-auto">
              <CheckCircle className="h-8 w-8 text-emerald-500" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">تم الإرسال!</h2>
              <p className="text-sm text-gray-400 mt-1 max-w-xs mx-auto">
                شكراً لتواصلك. تم استلام رسالتك وسنرد عليك قريباً.
              </p>
            </div>
            <button
              onClick={() => window.history.back()}
              className="text-xs font-semibold"
              style={{ color: primaryColor }}
            >
              العودة
            </button>
          </div>
        ) : (
          <div className="border border-gray-100 rounded-xl p-5">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 text-right">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs text-gray-500">الاسم</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="اسمك"
                          className="h-10 text-sm rounded-lg border-gray-100"
                        />
                      </FormControl>
                      <FormMessage className="text-[10px]" />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs text-gray-500">رقم الجوال</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type="tel"
                          placeholder="05XXXXXXXX"
                          className="h-10 text-sm rounded-lg border-gray-100"
                          dir="ltr"
                        />
                      </FormControl>
                      <FormMessage className="text-[10px]" />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="category"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs text-gray-500">نوع التذكرة</FormLabel>
                      <div className="grid grid-cols-3 gap-2">
                        {categoryOptions.map((opt) => (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => field.onChange(opt.value)}
                            className={`flex flex-col items-center gap-1 p-2.5 rounded-xl border text-xs font-bold transition-all ${
                              field.value === opt.value
                                ? 'border-gray-900 bg-gray-900 text-white'
                                : 'border-gray-100 bg-white text-gray-500 hover:border-gray-200'
                            }`}
                          >
                            <span className="text-base">{opt.icon}</span>
                            <span>{opt.label}</span>
                          </button>
                        ))}
                      </div>
                      <FormMessage className="text-[10px]" />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="subject"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs text-gray-500">الموضوع</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="موضوع الرسالة"
                          className="h-10 text-sm rounded-lg border-gray-100"
                        />
                      </FormControl>
                      <FormMessage className="text-[10px]" />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="message"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs text-gray-500">الرسالة</FormLabel>
                      <FormControl>
                        <Textarea
                          {...field}
                          placeholder="اشرح مشكلتك..."
                          rows={4}
                          className="text-sm rounded-lg border-gray-100 resize-none min-h-[100px]"
                        />
                      </FormControl>
                      <FormMessage className="text-[10px]" />
                    </FormItem>
                  )}
                />

                <Button
                  type="submit"
                  className="w-full h-10 rounded-lg text-sm font-semibold text-white"
                  style={{ backgroundColor: primaryColor }}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : 'إرسال'}
                </Button>
              </form>
            </Form>
          </div>
        )}
      </div>
    </div>
  );
}
