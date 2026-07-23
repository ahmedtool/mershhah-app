'use client';

import PageHeader from '@/components/dashboard/PageHeader';
import { MenuTable } from '@/components/dashboard/MenuTable';
import { PlusCircle, RefreshCw, Flame, Utensils, DollarSign, Sparkles, Loader2, TrendingUp, Package } from 'lucide-react';
import StatCard from '@/components/dashboard/StatCard';
import { useEffect, useState, useTransition, useMemo } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { EditMenuItemDialog } from '@/components/dashboard/EditMenuItemDialog';
import { ImportMenuDialog } from '@/components/dashboard/ImportMenuDialog';
import { useUser } from '@/hooks/useUser';
import { supabase } from '@/lib/supabase';
import type { MenuItem } from '@/lib/types';

type ItemCategory = 'Star' | 'Plow-Horse' | 'Puzzle' | 'Dog';

export default function MenuPage() {
  const { user, isLoading: isUserLoading } = useUser();
  const [isRefreshing, startRefresh] = useTransition();
  const [isApplyingSort, startApplyingSort] = useTransition();
  const { toast } = useToast();

  const [rawMenuItems, setRawMenuItems] = useState<MenuItem[]>([]);
  const [interactions, setInteractions] = useState<any[]>([]);
  const [isFetchingData, setIsFetchingData] = useState(true);

  const fetchMenuData = async (restaurantId: string) => {
    setIsFetchingData(true);
    const [menuRes, interactionsRes] = await Promise.all([
      supabase.from('menu_items').select('*').eq('restaurant_id', restaurantId),
      supabase.from('menu_item_interactions').select('menu_item_id').eq('restaurant_id', restaurantId),
    ]);
    setRawMenuItems((menuRes.data || []) as MenuItem[]);
    setInteractions(interactionsRes.data || []);
    setIsFetchingData(false);
  };

  useEffect(() => {
    if (!isUserLoading && user?.restaurantId) {
      fetchMenuData(user.restaurantId);
    } else if (!isUserLoading) {
      setIsFetchingData(false);
    }
  }, [isUserLoading, user?.restaurantId]);

  const menuItems = useMemo(() => {
    const popularityMap = new Map<string, number>();
    interactions.forEach((interaction) => {
      const id = interaction.menu_item_id;
      popularityMap.set(id, (popularityMap.get(id) || 0) + 1);
    });

    if (rawMenuItems.length === 0) return [];

    const analyzedItems = rawMenuItems.map((item) => {
      const size = item.sizes?.[0] || { price: 0, cost: 0 };
      const profit = size.price - (size.cost || 0);
      const profitMargin = size.price > 0 ? (profit / size.price) * 100 : 0;
      const popularity = popularityMap.get(item.id) || 0;
      return { ...item, profit, profitMargin, popularity };
    });

    const margins = analyzedItems.map((i) => i.profitMargin).sort((a, b) => a - b);
    const popularities = analyzedItems.map((i) => i.popularity).sort((a, b) => a - b);
    const medianMargin = margins.length > 0 ? margins[Math.floor(margins.length / 2)] : 0;
    const medianPopularity = popularities.length > 0 ? popularities[Math.floor(popularities.length / 2)] : 0;

    const classificationOrder: Record<ItemCategory, number> = {
      Star: 1, Puzzle: 2, 'Plow-Horse': 3, Dog: 4,
    };

    const classifiedItems = analyzedItems.map((item) => {
      let classification: ItemCategory = 'Dog';
      const highProfit = item.profitMargin >= medianMargin;
      const highPopularity = item.popularity >= medianPopularity;
      if (highProfit && highPopularity) classification = 'Star';
      else if (highProfit && !highPopularity) classification = 'Puzzle';
      else if (!highProfit && highPopularity) classification = 'Plow-Horse';
      return { ...item, classification };
    });

    const popularityThreshold = popularities.length > 4 ? popularities[Math.floor(popularities.length * 0.8)] : 0;

    const itemsWithSmartTags = classifiedItems.map((item) => {
      let smartTag: MenuItem['display_tags'] = 'none';
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const createdAt = (item as any).created_at || (item as any).createdAt;
      if (createdAt && new Date(createdAt) > sevenDaysAgo) {
        smartTag = 'new';
      } else if (item.classification === 'Star' && item.popularity > 0 && item.popularity >= popularityThreshold) {
        smartTag = 'best_seller';
      }

      return { ...item, display_tags: smartTag };
    });

    return itemsWithSmartTags.sort((a, b) => {
      const orderA = classificationOrder[a.classification!];
      const orderB = classificationOrder[b.classification!];
      if (orderA !== orderB) return orderA - orderB;
      return b.popularity - a.popularity;
    });
  }, [rawMenuItems, interactions]);

  const handleRefresh = () => {
    startRefresh(() => {
      if (user?.restaurantId) fetchMenuData(user.restaurantId);
      toast({ title: 'تم تحديث البيانات' });
    });
  };

  const handleApplySmartSort = () => {
    if (!user?.restaurantId || menuItems.length === 0) {
      toast({ title: 'لا توجد بيانات للترتيب', variant: 'destructive' });
      return;
    }

    startApplyingSort(async () => {
      try {
        await Promise.all(
          menuItems.map((item, index) =>
            supabase
              .from('menu_items')
              .update({ position: index, display_tags: item.display_tags || 'none' })
              .eq('id', item.id)
          )
        );
        toast({ title: 'تم تطبيق الترتيب الذكي' });
      } catch (error: any) {
        toast({ title: 'خطأ', description: error.message, variant: 'destructive' });
      }
    });
  };

  const loadingOrNoUser = isFetchingData || isUserLoading;
  const popularItem = menuItems.find((item) => item.status === 'available') || null;
  const totalItems = menuItems.length;
  const availableItems = menuItems.filter((item) => item.status === 'available').length;
  const unavailableItems = totalItems - availableItems;

  const calculateAveragePrice = () => {
    if (availableItems === 0) return 0;
    const allPrices = menuItems
      .filter((item) => item.status === 'available')
      .flatMap((item) => (Array.isArray(item.sizes) ? item.sizes.map((size) => size.price) : []));
    if (allPrices.length === 0) return 0;
    return allPrices.reduce((sum, price) => sum + price, 0) / allPrices.length;
  };

  const calculateTotalProfit = () => {
    return menuItems.reduce((sum, item) => {
      const size = item.sizes?.[0];
      if (!size) return sum;
      return sum + ((size.price || 0) - (size.cost || 0));
    }, 0);
  };

  const avgPrice = calculateAveragePrice();
  const totalProfit = calculateTotalProfit();

  return (
    <div className="space-y-5">
      <PageHeader title="إدارة المنيو" description="أضف وعُدّل أطباقك وتابع أرباحك.">
        <div className="flex items-center gap-2">
          <button onClick={handleApplySmartSort} disabled={isApplyingSort || loadingOrNoUser}
            className="h-9 px-4 rounded-xl border border-gray-200 text-xs font-bold text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50 flex items-center gap-2">
            {isApplyingSort ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
            ترتيب ذكي
          </button>
          <button onClick={handleRefresh} disabled={isRefreshing || loadingOrNoUser}
            className="h-9 px-4 rounded-xl border border-gray-200 text-xs font-bold text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50 flex items-center gap-2">
            <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            تحديث
          </button>
          <ImportMenuDialog restaurantId={user?.restaurantId} onSave={() => user?.restaurantId && fetchMenuData(user.restaurantId)}>
            <button disabled={loadingOrNoUser || !user}
              className="h-9 px-4 rounded-xl border border-gray-200 text-xs font-bold text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50 flex items-center gap-2">
              استيراد من صورة
            </button>
          </ImportMenuDialog>
          <EditMenuItemDialog
            restaurantId={user?.restaurantId}
            userId={user?.uid}
            onSave={() => user?.restaurantId && fetchMenuData(user.restaurantId)}
            itemCount={menuItems.length}
            menuItems={rawMenuItems}
          >
            <button disabled={loadingOrNoUser || !user}
              className="h-9 px-4 rounded-xl bg-gray-900 text-white text-xs font-bold hover:bg-gray-800 transition-colors disabled:opacity-50 flex items-center gap-2">
              <PlusCircle className="h-3.5 w-3.5" />
              طبق جديد
            </button>
          </EditMenuItemDialog>
        </div>
      </PageHeader>

      {/* Stats Row */}
      <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
        {loadingOrNoUser ? (
          <>
            <Skeleton className="h-24 rounded-2xl" />
            <Skeleton className="h-24 rounded-2xl" />
            <Skeleton className="h-24 rounded-2xl" />
            <Skeleton className="h-24 rounded-2xl" />
          </>
        ) : (
          <>
            <div className="bg-white border border-gray-100 rounded-2xl p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-bold text-gray-400">إجمالي الأطباق</span>
                <div className="w-7 h-7 rounded-lg bg-gray-50 flex items-center justify-center">
                  <Package className="h-3.5 w-3.5 text-gray-400" />
                </div>
              </div>
              <div className="text-2xl font-black text-gray-900">{totalItems}</div>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-[9px] text-emerald-600 font-bold">{availableItems} متاح</span>
                {unavailableItems > 0 && <span className="text-[9px] text-red-400 font-bold">{unavailableItems} غير متاح</span>}
              </div>
            </div>
            <div className="bg-white border border-gray-100 rounded-2xl p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-bold text-gray-400">متوسط السعر</span>
                <div className="w-7 h-7 rounded-lg bg-gray-50 flex items-center justify-center">
                  <DollarSign className="h-3.5 w-3.5 text-gray-400" />
                </div>
              </div>
              <div className="text-2xl font-black text-gray-900">{avgPrice.toFixed(0)} <span className="text-sm text-gray-400">ر.س</span></div>
              <p className="text-[9px] text-gray-300 mt-1">لكل الأطباق المتاحة</p>
            </div>
            <div className="bg-white border border-gray-100 rounded-2xl p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-bold text-gray-400">الأكثر طلباً</span>
                <div className="w-7 h-7 rounded-lg bg-amber-50 flex items-center justify-center">
                  <Flame className="h-3.5 w-3.5 text-amber-500" />
                </div>
              </div>
              <div className="text-sm font-black text-gray-900 truncate">{popularItem?.name || '—'}</div>
              <p className="text-[9px] text-gray-300 mt-1">بناءً على التفاعل</p>
            </div>
            <div className="bg-white border border-gray-100 rounded-2xl p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-bold text-gray-400">إجمالي الربح</span>
                <div className="w-7 h-7 rounded-lg bg-emerald-50 flex items-center justify-center">
                  <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />
                </div>
              </div>
              <div className="text-2xl font-black text-emerald-600">{totalProfit.toFixed(0)} <span className="text-sm text-gray-400">ر.س</span></div>
              <p className="text-[9px] text-gray-300 mt-1">تقديري من جميع الأطباق</p>
            </div>
          </>
        )}
      </div>

      {/* Menu Items */}
      {loadingOrNoUser ? (
        <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          <Skeleton className="h-48 rounded-2xl" />
          <Skeleton className="h-48 rounded-2xl" />
          <Skeleton className="h-48 rounded-2xl" />
        </div>
      ) : (
        <MenuTable
          items={menuItems}
          restaurantId={user!.restaurantId!}
          userId={user!.uid}
          onActionCompletion={() => user?.restaurantId && fetchMenuData(user.restaurantId)}
        />
      )}
    </div>
  );
}
