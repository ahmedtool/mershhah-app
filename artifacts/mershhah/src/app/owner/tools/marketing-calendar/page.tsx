'use client';

import { useState, useMemo, useEffect } from 'react';
import PageHeader from "@/components/dashboard/PageHeader";
import { Button } from "@/components/ui/button";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Utensils, Globe, ShoppingCart, CalendarDays, Lightbulb, Ticket, Bell, Copy, Loader2 } from 'lucide-react';
import { months, foodDays, globalDays, saudiEvents, salesSeasons, parseFixedDate } from '@/data/marketing-calendar-2025';
import { useUser } from '@/hooks/useUser';
import { useRouter } from '@/lib/navigation';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';

type CategoryTheme = {
  iconBg: string;
  iconColor: string;
  accent: string;
  badge: string;
};

// Fully-literal class strings (not built with template/replace at runtime)
// so Tailwind's static scan reliably picks them up.
const THEMES: Record<string, CategoryTheme> = {
  orange: { iconBg: "bg-orange-50", iconColor: "text-orange-500", accent: "border-r-orange-300", badge: "bg-orange-50 text-orange-600" },
  emerald: { iconBg: "bg-emerald-50", iconColor: "text-emerald-500", accent: "border-r-emerald-300", badge: "bg-emerald-50 text-emerald-600" },
  blue: { iconBg: "bg-blue-50", iconColor: "text-blue-500", accent: "border-r-blue-300", badge: "bg-blue-50 text-blue-600" },
};

const eventCategories = [
  { title: "أيام الأكل العالمية", data: foodDays, icon: Utensils, theme: "orange" as const },
  { title: "مناسبات وطنية وعالمية", data: globalDays.concat(saudiEvents.filter(e => e.type !== 'season')), icon: Globe, theme: "emerald" as const },
  { title: "مواسم التخفيضات الكبرى", data: salesSeasons.map(s => ({ ...s, month: 'متغير' })), icon: ShoppingCart, theme: "blue" as const },
];

function occasionKey(event: { name: string }) {
  return event.name;
}

async function callAiFunction(path: string, body: Record<string, unknown>) {
  const { data: { session } } = await supabase.auth.getSession();
  const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, data };
}

export default function MarketingCalendarPage() {
  const { user } = useUser();
  const router = useRouter();
  const { toast } = useToast();

  const [selectedMonth, setSelectedMonth] = useState<string>('الكل');
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [ideas, setIdeas] = useState<Record<string, string>>({});
  const [loadingIdeaKey, setLoadingIdeaKey] = useState<string | null>(null);
  const [reminderKeys, setReminderKeys] = useState<Set<string>>(new Set());
  const [togglingReminderKey, setTogglingReminderKey] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.id) return;
    supabase
      .from('marketing_calendar_reminders')
      .select('occasion_key')
      .eq('profile_id', user.id)
      .then(({ data }: { data: any[] | null }) => setReminderKeys(new Set((data || []).map((r: any) => r.occasion_key))));
  }, [user?.id]);

  const filteredEvents = useMemo(() => {
    if (selectedMonth === 'الكل') return eventCategories;
    return eventCategories.map(category => ({
      ...category,
      data: category.data.filter(event => (event as any).month === selectedMonth),
    }));
  }, [selectedMonth]);

  const handleToggleIdea = async (key: string, event: any) => {
    if (expandedKey === key) {
      setExpandedKey(null);
      return;
    }
    setExpandedKey(key);
    if (ideas[key]) return;
    setLoadingIdeaKey(key);
    const { ok, data } = await callAiFunction('generate-marketing-idea', {
      occasionName: event.name,
      occasionDate: event.date,
    });
    setLoadingIdeaKey(null);
    if (ok && data.idea) {
      setIdeas(prev => ({ ...prev, [key]: data.idea }));
    } else {
      toast({ variant: 'destructive', title: 'تعذّر توليد الفكرة', description: data.error || 'حاول مرة أخرى' });
      setExpandedKey(null);
    }
  };

  const handleCreateOffer = (event: any) => {
    const title = `عرض ${event.name}`;
    const description = `عرض خاص بمناسبة ${event.name}${event.date && event.date !== 'متغير' ? ` (${event.date})` : ''}.`;
    router.push(`/owner/offers?prefill_title=${encodeURIComponent(title)}&prefill_desc=${encodeURIComponent(description)}`);
  };

  const toggleReminder = async (key: string, event: any) => {
    if (!user?.id) return;
    const parsed = parseFixedDate(event.date);
    if (!parsed) return;
    setTogglingReminderKey(key);
    const isOn = reminderKeys.has(key);
    if (isOn) {
      await supabase.from('marketing_calendar_reminders').delete().eq('profile_id', user.id).eq('occasion_key', key);
      setReminderKeys(prev => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
      toast({ title: 'ألغيت التذكير' });
    } else {
      const { error } = await supabase.from('marketing_calendar_reminders').insert({
        profile_id: user.id,
        occasion_key: key,
        occasion_name: event.name,
        occasion_month: parsed.month,
        occasion_day: parsed.day,
      });
      if (!error) {
        setReminderKeys(prev => new Set(prev).add(key));
        toast({ title: 'تم', description: 'بنرسل لك تذكير قبل 3 أيام من المناسبة' });
      }
    }
    setTogglingReminderKey(null);
  };

  const copyIdea = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: 'تم نسخ الفكرة' });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="تقويم المناسبات التسويقي"
        description="خطط لحملاتك التسويقية بذكاء — لمطعمك، مقهاك، مخبزك، أو أي مشروع في قطاع المأكولات. استلهم أفكارًا مبتكرة لكل مناسبة."
      />

      <div className="sticky top-14 z-20 bg-background/80 backdrop-blur-sm py-3 -mt-3">
        <ScrollArea className="w-full whitespace-nowrap">
          <div className="flex w-max space-x-2 space-x-reverse pb-2">
            <Button
              variant={selectedMonth === 'الكل' ? 'default' : 'outline'}
              onClick={() => setSelectedMonth('الكل')}
              className="rounded-full"
            >
              عرض الكل
            </Button>
            {months.map(month => (
              <Button
                key={month}
                variant={selectedMonth === month ? 'default' : 'outline'}
                onClick={() => setSelectedMonth(month)}
                className="rounded-full"
              >
                {month}
              </Button>
            ))}
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </div>

      <div className="space-y-10">
        {filteredEvents.map((category) => {
          if (category.data.length === 0) return null;
          const Icon = category.icon;
          const theme = THEMES[category.theme];

          return (
            <div key={category.title}>
              <div className="flex items-center gap-3 mb-4">
                <div className={cn("w-11 h-11 rounded-2xl flex items-center justify-center", theme.iconBg)}>
                  <Icon className={cn("h-5 w-5", theme.iconColor)} />
                </div>
                <div>
                  <h2 className="text-base font-black text-gray-900">{category.title}</h2>
                  <p className="text-[11px] text-gray-400">{category.data.length} مناسبة</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                {category.data.map((event: any) => {
                  const key = occasionKey(event);
                  const isExpanded = expandedKey === key;
                  const isLoadingIdea = loadingIdeaKey === key;
                  const idea = ideas[key];
                  const canRemind = !!parseFixedDate(event.date);
                  const isReminding = reminderKeys.has(key);
                  const isTogglingReminder = togglingReminderKey === key;

                  return (
                    <div
                      key={key}
                      className={cn(
                        "rounded-2xl border border-gray-100 bg-white p-4 border-r-4 hover:shadow-sm transition-shadow",
                        theme.accent
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="text-sm font-bold text-gray-900 leading-snug">{event.name}</h4>
                        {canRemind && (
                          <button
                            onClick={() => toggleReminder(key, event)}
                            disabled={isTogglingReminder}
                            title={isReminding ? "إلغاء التذكير" : "ذكرني قبل 3 أيام"}
                            className={cn(
                              "shrink-0 w-7 h-7 rounded-lg flex items-center justify-center transition-colors",
                              isReminding ? "bg-amber-100 text-amber-600" : "bg-gray-50 text-gray-300 hover:text-gray-500"
                            )}
                          >
                            {isTogglingReminder ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Bell className="h-3.5 w-3.5" fill={isReminding ? "currentColor" : "none"} />}
                          </button>
                        )}
                      </div>

                      {event.date && (
                        <span className={cn("inline-block mt-2 text-[10px] font-bold px-2 py-0.5 rounded-full", theme.badge)}>
                          {event.date}
                        </span>
                      )}

                      <div className="flex items-center gap-1.5 mt-3">
                        <button
                          onClick={() => handleToggleIdea(key, event)}
                          className="flex-1 h-8 rounded-lg text-[11px] font-bold text-gray-500 hover:bg-amber-50 hover:text-amber-600 transition-colors flex items-center justify-center gap-1"
                        >
                          <Lightbulb className="h-3.5 w-3.5" /> فكرة تسويقية
                        </button>
                        <button
                          onClick={() => handleCreateOffer(event)}
                          className="flex-1 h-8 rounded-lg text-[11px] font-bold text-gray-500 hover:bg-primary/10 hover:text-primary transition-colors flex items-center justify-center gap-1"
                        >
                          <Ticket className="h-3.5 w-3.5" /> إنشاء عرض
                        </button>
                      </div>

                      {isExpanded && (
                        <div className="mt-3 pt-3 border-t border-gray-50">
                          {isLoadingIdea ? (
                            <div className="flex items-center gap-2 text-[11px] text-gray-400 py-2">
                              <Loader2 className="h-3.5 w-3.5 animate-spin" /> جاري توليد الفكرة...
                            </div>
                          ) : idea ? (
                            <div className="bg-amber-50/60 rounded-xl p-3 relative">
                              <p className="text-[11px] text-gray-700 leading-relaxed whitespace-pre-wrap pl-6">{idea}</p>
                              <button
                                onClick={() => copyIdea(idea)}
                                className="absolute top-2 left-2 w-6 h-6 rounded-md flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-white transition-colors"
                              >
                                <Copy className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          ) : null}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}

        {filteredEvents.every(c => c.data.length === 0) && (
          <div className="text-center py-16 text-gray-300">
            <CalendarDays className="h-12 w-12 mx-auto mb-4" />
            <p className="font-semibold text-gray-500">لا توجد مناسبات في هذا الشهر.</p>
            <p className="text-sm">جرب اختيار شهر آخر أو عرض الكل.</p>
          </div>
        )}
      </div>
    </div>
  );
}
