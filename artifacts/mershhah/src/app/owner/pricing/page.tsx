'use client';

import { useState, useEffect } from 'react';
import PageHeader from "@/components/dashboard/PageHeader";
import { Button } from "@/components/ui/button";
import {
    BarChart3,
    Star,
    MousePointerClick,
    Lock,
    TrendingUp,
    QrCode,
    Link2,
    Copy,
    ArrowUpRight,
    Eye,
    Zap,
    Crown,
} from 'lucide-react';
import { useUser } from '@/hooks/useUser';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabase';
import type { MenuItem } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { Link } from 'wouter';
import { cn } from '@/lib/utils';

type AnalyzedItem = MenuItem & {
    popularity: number;
    profitMargin: number;
};

export default function InsightsHubPage() {
    const { user, isLoading: isUserLoading } = useUser();
    const { toast } = useToast();
    const [isLoadingData, setIsLoadingData] = useState(true);
    const [analysisData, setAnalysisData] = useState<AnalyzedItem[]>([]);
    const [totalClicks, setTotalClicks] = useState(0);
    const [hubVisitsQr, setHubVisitsQr] = useState(0);
    const [hubVisitsLink, setHubVisitsLink] = useState(0);
    const [hubUsername, setHubUsername] = useState<string | null>(null);
    const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

    const isPaid = user?.entitlements?.planId && user.entitlements.planId !== 'free' && user.entitlements.planId !== 'none';

    useEffect(() => {
        if (user?.restaurantId) {
            setIsLoadingData(true);
            const fetchData = async () => {
                try {
                    const restaurantId = user.restaurantId!;
                    const [itemsRes, interactionsRes, hubVisitsRes, restRes] = await Promise.all([
                        supabase.from('menu_items').select('*').eq('restaurant_id', restaurantId),
                        supabase.from('menu_item_interactions').select('menu_item_id').eq('restaurant_id', restaurantId),
                        supabase.from('hub_visits').select('source').eq('restaurant_id', restaurantId),
                        supabase.from('restaurants').select('username').eq('id', restaurantId).single(),
                    ]);

                    const items = (itemsRes.data || []) as MenuItem[];
                    const interactions = interactionsRes.data || [];
                    setTotalClicks(interactions.length);

                    let qrCount = 0; let linkCount = 0;
                    (hubVisitsRes.data || []).forEach((d: any) => {
                        if (d.source === 'qr_branch') qrCount++; else linkCount++;
                    });
                    setHubVisitsQr(qrCount);
                    setHubVisitsLink(linkCount);
                    setHubUsername((restRes.data as any)?.username || null);

                    const popularityMap = new Map();
                    interactions.forEach((i: any) => popularityMap.set(i.menu_item_id, (popularityMap.get(i.menu_item_id) || 0) + 1));

                    const analyzed = items.map(item => {
                        const size = item.sizes?.[0] || { price: 0, cost: 0 };
                        const profit = size.price - (size.cost || 0);
                        const margin = size.price > 0 ? (profit / size.price) * 100 : 0;
                        return { ...item, profitMargin: margin, popularity: popularityMap.get(item.id) || 0 };
                    });
                    analyzed.sort((a, b) => b.popularity - a.popularity);
                    setAnalysisData(analyzed);
                } catch (e: any) {
                    toast({ title: "خطأ في جلب البيانات", description: e.message, variant: "destructive" });
                } finally {
                    setIsLoadingData(false);
                }
            };
            fetchData();
        }
    }, [user, toast]);

    useEffect(() => {
        if (!hubUsername || typeof window === 'undefined') return;
        const baseUrl = import.meta.env.VITE_APP_URL || window.location.origin;
        const qrUrl = `${baseUrl.replace(/\/$/, '')}/hub/${hubUsername}?source=qr_branch`;
        import('qrcode').then((QRCode) => {
            QRCode.toDataURL(qrUrl, { width: 280, margin: 2 }).then(setQrDataUrl).catch(() => {});
        }).catch(() => {});
    }, [hubUsername]);

    const totalVisits = hubVisitsQr + hubVisitsLink;

    if (isLoadingData || isUserLoading) {
        return (
            <div className="space-y-5">
                <Skeleton className="h-10 w-1/3" />
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3"><Skeleton className="h-24 rounded-2xl" /><Skeleton className="h-24 rounded-2xl" /><Skeleton className="h-24 rounded-2xl" /><Skeleton className="h-24 rounded-2xl" /></div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3"><Skeleton className="h-48 rounded-2xl" /><Skeleton className="h-48 rounded-2xl" /></div>
            </div>
        );
    }

    return (
        <div className="space-y-5 pb-20">
            <PageHeader title="مركز التقارير" description="حلل سلوك عملائك وحوّل البيانات إلى قرارات تزيد أرباحك." />

            {/* Stats Row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-white border border-gray-100 rounded-2xl p-4">
                    <div className="flex items-center gap-2 mb-3">
                        <div className="w-8 h-8 rounded-xl bg-gray-900 flex items-center justify-center">
                            <MousePointerClick className="h-3.5 w-3.5 text-white" />
                        </div>
                        <span className="text-[10px] text-gray-400 font-medium">التفاعل</span>
                    </div>
                    <p className="text-2xl font-black text-gray-900">{totalClicks}</p>
                    <p className="text-[10px] text-gray-300 mt-1">نقرة على المنيو</p>
                </div>
                <div className="bg-white border border-gray-100 rounded-2xl p-4">
                    <div className="flex items-center gap-2 mb-3">
                        <div className="w-8 h-8 rounded-xl bg-amber-50 flex items-center justify-center">
                            <Star className="h-3.5 w-3.5 text-amber-500" />
                        </div>
                        <span className="text-[10px] text-gray-400 font-medium">التقييم</span>
                    </div>
                    <p className="text-2xl font-black text-gray-900">{(user as any)?.rating?.toFixed(1) || '0.0'}</p>
                    <p className="text-[10px] text-gray-300 mt-1">{(user as any)?.reviewCount || 0} تقييم</p>
                </div>
                <div className="bg-white border border-gray-100 rounded-2xl p-4">
                    <div className="flex items-center gap-2 mb-3">
                        <div className="w-8 h-8 rounded-xl bg-emerald-50 flex items-center justify-center">
                            <Eye className="h-3.5 w-3.5 text-emerald-500" />
                        </div>
                        <span className="text-[10px] text-gray-400 font-medium">الزيارات</span>
                    </div>
                    <p className="text-2xl font-black text-gray-900">{totalVisits}</p>
                    <p className="text-[10px] text-gray-300 mt-1">زيارة للمنيو</p>
                </div>
                <div className="bg-white border border-gray-100 rounded-2xl p-4">
                    <div className="flex items-center gap-2 mb-3">
                        <div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center">
                            <Zap className="h-3.5 w-3.5 text-blue-500" />
                        </div>
                        <span className="text-[10px] text-gray-400 font-medium">الحالة</span>
                    </div>
                    <p className="text-lg font-black text-gray-900">{totalClicks > 0 ? 'نشط' : 'جديد'}</p>
                    <p className="text-[10px] text-gray-300 mt-1">واجهتك الرقمية</p>
                </div>
            </div>

            {/* Visit Sources */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="bg-white border border-gray-100 rounded-2xl p-5">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-gray-900 flex items-center justify-center">
                                <QrCode className="h-4 w-4 text-white" />
                            </div>
                            <div>
                                <h3 className="text-sm font-bold text-gray-900">داخل الفرع</h3>
                                <p className="text-[10px] text-gray-400">QR على الطاولة</p>
                            </div>
                        </div>
                        <p className="text-2xl font-black text-gray-900">{hubVisitsQr}</p>
                    </div>
                    <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-gray-900 rounded-full transition-all" style={{ width: totalVisits > 0 ? `${(hubVisitsQr / totalVisits) * 100}%` : '0%' }} />
                    </div>
                </div>
                <div className="bg-white border border-gray-100 rounded-2xl p-5">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center">
                                <Link2 className="h-4 w-4 text-gray-500" />
                            </div>
                            <div>
                                <h3 className="text-sm font-bold text-gray-900">خارج الفرع</h3>
                                <p className="text-[10px] text-gray-400">رابط الانستقرام</p>
                            </div>
                        </div>
                        <p className="text-2xl font-black text-gray-900">{hubVisitsLink}</p>
                    </div>
                    <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-gray-400 rounded-full transition-all" style={{ width: totalVisits > 0 ? `${(hubVisitsLink / totalVisits) * 100}%` : '0%' }} />
                    </div>
                </div>
            </div>

            {/* QR & Link Section */}
            {hubUsername && (
                <div className="bg-white border border-gray-100 rounded-2xl p-5">
                    <div className="flex items-center gap-2 mb-5">
                        <h3 className="text-sm font-bold text-gray-900">الرابط الذكي و QR</h3>
                    </div>
                    <div className="flex flex-col md:flex-row gap-8 items-start">
                        <div className="flex-1 space-y-3">
                            <p className="text-[10px] text-gray-400 font-medium">الرابط الذكي</p>
                            <div className="flex gap-2 items-center flex-wrap">
                                <code className="text-xs text-gray-500 bg-gray-50 border border-gray-100 px-3 py-2 rounded-xl break-all">
                                    {(import.meta.env.VITE_APP_URL || '').replace(/\/$/, '') || '...'}/hub/{hubUsername}
                                </code>
                                <Button size="sm" variant="outline" className="h-8 rounded-xl text-xs border-gray-200" onClick={() => {
                                    const url = `${(import.meta.env.VITE_APP_URL || window.location.origin).replace(/\/$/, '')}/hub/${hubUsername}`;
                                    navigator.clipboard.writeText(url);
                                    toast({ title: 'تم نسخ الرابط' });
                                }}><Copy className="h-3 w-3 ml-1" /> نسخ</Button>
                            </div>
                        </div>
                        <div className="space-y-3">
                            <p className="text-[10px] text-gray-400 font-medium">QR للطاولة</p>
                            {qrDataUrl ? (
                                <div className="inline-flex flex-col items-center gap-3">
                                    <div className="inline-block p-3 bg-white rounded-2xl border border-gray-100">
                                        <img src={qrDataUrl} alt="QR للمنيو" className="w-[180px] h-[180px]" />
                                    </div>
                                    <Button size="sm" variant="outline" className="h-8 rounded-xl text-xs border-gray-200" onClick={() => {
                                        const link = document.createElement('a');
                                        link.href = qrDataUrl;
                                        link.download = `hub-qr-${hubUsername || 'menu'}.png`;
                                        document.body.appendChild(link); link.click(); link.remove();
                                    }}>تحميل QR</Button>
                                </div>
                            ) : (
                                <div className="w-[180px] h-[180px] bg-gray-50 border border-gray-100 rounded-2xl animate-pulse flex items-center justify-center text-[10px] text-gray-300">جاري التوليد...</div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Popular Items & Financial */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
                {/* Popular Items */}
                <div className="bg-white border border-gray-100 rounded-2xl p-5">
                    <div className="flex items-center gap-2 mb-4">
                        <TrendingUp className="h-4 w-4 text-gray-400" />
                        <h3 className="text-sm font-bold text-gray-900">الأصناف الأعلى تفاعلاً</h3>
                    </div>
                    {analysisData.length === 0 ? (
                        <div className="py-12 text-center text-gray-300 text-xs">لا توجد بيانات تفاعل بعد</div>
                    ) : (
                        <div className="space-y-2">
                            {analysisData.slice(0, 5).map((item, idx) => (
                                <div key={item.id || `popular-${idx}`} className="flex items-center justify-between p-3 bg-gray-50 border border-gray-100 rounded-xl">
                                    <div className="flex items-center gap-3">
                                        <span className="text-[10px] font-bold text-gray-300 w-4">{idx + 1}</span>
                                        <span className="text-sm font-bold text-gray-900">{item.name}</span>
                                    </div>
                                    <span className="text-[10px] font-mono font-bold text-gray-400 bg-white border border-gray-100 px-2 py-0.5 rounded-md">{item.popularity}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Financial Reports */}
                <div className={cn("bg-white border border-gray-100 rounded-2xl p-5", !isPaid && "relative")}>
                    <div className="flex items-center gap-2 mb-4">
                        <BarChart3 className="h-4 w-4 text-gray-400" />
                        <h3 className="text-sm font-bold text-gray-900">التقارير المالية</h3>
                    </div>
                    {!isPaid ? (
                        <div className="py-12 text-center space-y-4">
                            <div className="w-14 h-14 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto">
                                <Crown className="h-6 w-6 text-gray-400" />
                            </div>
                            <div className="space-y-1">
                                <p className="text-sm font-bold text-gray-900">متاح في الباقات المدفوعة</p>
                                <p className="text-[10px] text-gray-400">اشترك لفتح تقارير الربحية والتوصيات الذكية</p>
                            </div>
                            <Button asChild size="sm" className="h-9 rounded-xl bg-gray-900 text-white hover:bg-gray-800 font-bold text-xs px-6">
                                <Link href="/pricing">ترقية الحساب</Link>
                            </Button>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {analysisData.slice(0, 5).map((item, idx) => (
                                <div key={item.id || `profit-${idx}`} className="flex items-center justify-between p-3 bg-gray-50 border border-gray-100 rounded-xl">
                                    <span className="text-sm font-bold text-gray-900">{item.name}</span>
                                    <span className={cn(
                                        "text-[10px] font-mono font-bold px-2 py-0.5 rounded-md",
                                        item.profitMargin > 50 ? "bg-emerald-50 text-emerald-600" : "bg-gray-100 text-gray-400"
                                    )}>{item.profitMargin.toFixed(0)}%</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
