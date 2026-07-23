
'use client';

import { useState, useMemo } from 'react';
import PageHeader from "@/components/dashboard/PageHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Utensils, Globe, Flag, ShoppingCart, CalendarDays, Lightbulb, Ticket } from 'lucide-react';
import { months, foodDays, globalDays, saudiEvents, salesSeasons } from '@/data/marketing-calendar-2025';
import { Separator } from '@/components/ui/separator';

const eventCategories = [
    { title: "أيام الأكل العالمية", data: foodDays, icon: Utensils, color: "text-orange-500" },
    { title: "مناسبات وطنية وعالمية", data: globalDays.concat(saudiEvents.filter(e => e.type !== 'season')), icon: Globe, color: "text-green-500" },
    { title: "مواسم التخفيضات الكبرى", data: salesSeasons.map(s => ({...s, month: 'متغير'})), icon: ShoppingCart, color: "text-blue-500" },
];

export default function MarketingCalendarPage() {
    const [selectedMonth, setSelectedMonth] = useState<string>('الكل');

    const filteredEvents = useMemo(() => {
        if (selectedMonth === 'الكل') {
            return eventCategories;
        }
        return eventCategories.map(category => ({
            ...category,
            data: category.data.filter(event => event.month === selectedMonth)
        }));
    }, [selectedMonth]);

    return (
        <div className="space-y-6">
            <PageHeader
                title="تقويم المناسبات التسويقي 2025"
                description="خطط لحملاتك التسويقية بذكاء. استلهم أفكارًا مبتكرة لكل مناسبة."
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
            
             <div className="space-y-8">
                 {filteredEvents.map((category, catIndex) => {
                    if (category.data.length === 0) return null;
                    const Icon = category.icon;
                    // Check if any of the previous categories had data to determine if a separator is needed
                    const isFirstVisibleCategory = filteredEvents.slice(0, catIndex).every(c => c.data.length === 0);

                    return (
                        <div key={category.title}>
                             {!isFirstVisibleCategory && <Separator className="my-8" />}
                             <div className="flex items-center gap-3 mb-6">
                                <div className={`p-3 rounded-full ${category.color.replace('text-', 'bg-')}/10`}>
                                    <Icon className={`h-7 w-7 ${category.color}`} />
                                </div>
                                <h2 className="text-2xl font-bold font-headline">{category.title}</h2>
                             </div>
                             <div className="space-y-2">
                                {category.data.map((event, index) => (
                                    <div key={index} className="flex flex-col sm:flex-row justify-between sm:items-center p-3 rounded-lg hover:bg-card hover:shadow-sm transition-all border border-transparent hover:border-border">
                                        <div className="flex items-center gap-4">
                                            {(event as any).date && <div className="text-sm font-semibold text-muted-foreground w-32 text-center sm:text-right">{(event as any).date}</div>}
                                            <h4 className="font-semibold">{event.name}</h4>
                                        </div>
                                        <div className="flex items-center gap-2 mt-2 sm:mt-0 self-end sm:self-center shrink-0">
                                            <Button size="sm" variant="ghost" className="gap-1 text-xs text-muted-foreground hover:text-amber-600">
                                                <Lightbulb className="h-3.5 w-3.5" /> فكرة تسويقية
                                            </Button>
                                             <Button size="sm" variant="ghost" className="gap-1 text-xs text-muted-foreground hover:text-primary">
                                                <Ticket className="h-3.5 w-3.5" /> إنشاء عرض
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                             </div>
                        </div>
                    )
                 })}
                 {filteredEvents.every(c => c.data.length === 0) && (
                    <div className="text-center py-16 text-muted-foreground">
                        <CalendarDays className="h-12 w-12 mx-auto mb-4" />
                        <p className="font-semibold">لا توجد مناسبات في هذا الشهر.</p>
                        <p className="text-sm">جرب اختيار شهر آخر أو عرض الكل.</p>
                    </div>
                 )}
            </div>
        </div>
    );
}
