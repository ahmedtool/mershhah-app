"use client";
import { useEffect, useState, useMemo } from 'react';
import { useParams } from 'wouter';
import { useRouter } from '@/lib/navigation';
import { Button } from '@/components/ui/button';
import { ChevronRight, Search, Info } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { getPublicPage } from '@/lib/public-pages';
import { StorageImage } from '@/components/shared/StorageImage';
import type { MenuItem } from '@/lib/types';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';

export default function PublicMenuPage() {
  const params = useParams();
  const router = useRouter();
  const username = params.username as string;

  const [restaurant, setRestaurant] = useState<any>(null);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [activeCategory, setActiveCategory] = useState<string>('الكل');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [activeItem, setActiveItem] = useState<MenuItem | null>(null);
  const [selectedSize, setSelectedSize] = useState<any>(null);

  const applySort = (items: MenuItem[]): MenuItem[] => {
    const hasPositions = items.some(item => item.position != null);
    if (hasPositions) return [...items].sort((a, b) => (a.position ?? 999) - (b.position ?? 999));
    type E = MenuItem & { profitMargin: number; popularity: number; classification: 'Star' | 'Plow-Horse' | 'Puzzle' | 'Dog' };
    const engineered: E[] = items.map((item) => {
      const size = Array.isArray(item.sizes) && item.sizes[0] ? item.sizes[0] : { price: 0, cost: 0 };
      const price = typeof size.price === 'number' ? size.price : 0;
      const cost = typeof size.cost === 'number' ? size.cost : 0;
      const profitMargin = price > 0 ? ((price - cost) / price) * 100 : 0;
      const popularity = item.clicks_count ?? 0;
      return { ...item, profitMargin, popularity, classification: 'Dog' as const };
    });
    const margins = engineered.map(i => i.profitMargin).sort((a, b) => a - b);
    const popularities = engineered.map(i => i.popularity).sort((a, b) => a - b);
    const medianMargin = margins[Math.floor(margins.length / 2)] ?? 0;
    const medianPopularity = popularities[Math.floor(popularities.length / 2)] ?? 0;
    const classificationOrder: Record<string, number> = { Star: 1, Puzzle: 2, 'Plow-Horse': 3, Dog: 4 };
    engineered.forEach((item) => {
      const highProfit = item.profitMargin >= medianMargin;
      const highPopularity = item.popularity >= medianPopularity;
      item.classification = (highProfit && highPopularity) ? 'Star' : (highProfit && !highPopularity) ? 'Puzzle' : (!highProfit && highPopularity) ? 'Plow-Horse' : 'Dog';
    });
    return engineered.sort((a, b) => {
      const o = classificationOrder[a.classification] - classificationOrder[b.classification];
      if (o !== 0) return o;
      return (b.popularity ?? 0) - (a.popularity ?? 0);
    }) as MenuItem[];
  };

  useEffect(() => {
    if (!username) return;
    setLoading(true);

    const fetchData = async () => {
      try {
        const data = await getPublicPage(username);
        if (data?.restaurant && Array.isArray(data.menu)) {
          setRestaurant(data.restaurant);
          const items = data.menu as MenuItem[];
          setMenuItems(applySort(items));
          setCategories(['الكل', ...Array.from(new Set(items.map(i => i.category).filter(Boolean)))]);
          setLoading(false);
          return;
        }

        const { data: rest } = await supabase
          .from('restaurants')
          .select('*')
          .eq('username', username)
          .limit(1)
          .single();

        if (!rest) {
          setRestaurant(null);
          setLoading(false);
          return;
        }

        setRestaurant(rest);

        const { data: items } = await supabase
          .from('menu_items')
          .select('*')
          .eq('restaurant_id', rest.id);

        const sorted = applySort((items || []) as MenuItem[]);
        setMenuItems(sorted);
        setCategories(['الكل', ...Array.from(new Set(sorted.map(i => i.category).filter(Boolean)))]);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };

    fetchData();

    const channel = supabase
      .channel(`menu-${username}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'menu_items' }, fetchData)
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [username]);

  const filteredItems = useMemo(() => {
    return menuItems.filter(item => {
      const matchesCategory = activeCategory === 'الكل' || item.category === activeCategory;
      const matchesSearch = (item.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                            (item.description || '').toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [menuItems, activeCategory, searchQuery]);

  const primaryColor = restaurant?.primaryColor || '#111827';

  const getPriceDisplay = (item: any) => {
    const price = item.sizes?.[0]?.price;
    if (price === 0) return 'مجاني';
    if (price === undefined || price === null) return 'حسب الطلب';
    return `${price} ر.س`;
  };

  const recordItemClick = async (item: MenuItem) => {
    if (!restaurant?.id) return;
    const current = await supabase
      .from('menu_items')
      .select('clicks_count')
      .eq('id', item.id)
      .single();
    const newCount = (current.data?.clicks_count || 0) + 1;
    supabase.from('menu_items').update({ clicks_count: newCount }).eq('id', item.id).then(() => {});
    supabase.from('menu_item_interactions').insert({
      menu_item_id: item.id,
      restaurant_id: restaurant.id,
      created_at: new Date().toISOString(),
    }).then(() => {});
  };

  const getSuggestionsForItem = (item: MenuItem, allItems: MenuItem[]) => {
    const candidates = allItems.filter(i => i.id !== item.id && i.status === 'available');
    if (candidates.length === 0) return [];
    const sidePriority = ['appetizer', 'dessert', 'drink', 'offer'];
    const scored = candidates.map((c) => {
      let score = 0;
      if (c.display_tags === 'best_seller') score += 3;
      if (c.display_tags === 'daily_offer') score += 2;
      if (sidePriority.includes(c.category)) score += 2;
      if (item.category === 'main' && sidePriority.includes(c.category)) score += 2;
      if (c.category === 'offer') score += 2;
      const clicks = c.clicks_count ?? 0;
      score += Math.min(clicks, 10) * 0.3;
      const baseSize = Array.isArray(c.sizes) && c.sizes[0] ? c.sizes[0] : { price: 0, cost: 0 };
      const price = typeof baseSize.price === 'number' ? baseSize.price : 0;
      const cost = typeof baseSize.cost === 'number' ? baseSize.cost : 0;
      const margin = price > 0 ? (price - cost) / price : 0;
      score += margin * 2;
      return { item: c, score, price };
    });
    scored.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.price - b.price;
    });
    return scored.slice(0, 3).map(s => s.item);
  };

  if (loading) return (
    <div className="min-h-screen bg-white" dir="rtl">
      <div className="max-w-lg mx-auto px-5 space-y-8 pt-8">
        <div className="flex flex-col items-center space-y-4">
          <Skeleton className="h-20 w-20 rounded-2xl" />
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-4 w-56" />
        </div>
        <Skeleton className="h-12 w-full rounded-xl" />
        <div className="flex gap-2">
          {[1,2,3,4].map(i => <Skeleton key={i} className="h-9 w-20 rounded-full" />)}
        </div>
        <div className="space-y-6">
          {[1,2,3].map(i => (
            <div key={i} className="flex gap-4">
              <Skeleton className="h-28 w-28 rounded-xl shrink-0" />
              <div className="flex-1 space-y-3 py-1">
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-4 w-16" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  if (!restaurant) return (
    <div className="h-screen w-full flex flex-col items-center justify-center bg-white text-center p-6 space-y-5">
      <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center text-gray-400">
        <Info size={28} />
      </div>
      <h1 className="text-lg font-bold text-gray-900">المطعم غير موجود</h1>
      <Button onClick={() => router.push('/')} variant="outline" className="rounded-xl px-6">العودة للرئيسية</Button>
    </div>
  );

  const activeSuggestions = activeItem ? getSuggestionsForItem(activeItem, menuItems) : [];

  return (
    <div className="flex flex-col min-h-screen bg-white pb-16" dir="rtl">

      {/* Header */}
      <div className="max-w-lg mx-auto w-full px-5 pt-6 pb-4 flex items-center justify-between">
        <Button
          variant="ghost"
          size="icon"
          className="w-9 h-9 rounded-xl text-gray-500 hover:text-gray-900 hover:bg-gray-100"
          onClick={() => router.back()}
        >
          <ChevronRight className="h-5 w-5" />
        </Button>
        <div className="w-9" />
      </div>

      <div className="max-w-lg mx-auto w-full px-5 pb-6 text-center space-y-3 text-right">
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
          {restaurant.description && (
            <p className="text-sm text-gray-400 mt-0.5 line-clamp-1">{restaurant.description}</p>
          )}
        </div>
      </div>

      <div className="max-w-lg mx-auto w-full px-5 space-y-4">

        {/* Search */}
        <div className="relative">
          <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-300 pointer-events-none" />
          <Input
            placeholder="ابحث في القائمة..."
            className="w-full h-11 rounded-xl bg-gray-50 border border-gray-100 text-sm pr-10 pl-4 focus-visible:ring-1 focus-visible:ring-gray-200 focus-visible:border-gray-200"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {/* Categories */}
        <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-1 -mx-5 px-5">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={cn(
                "shrink-0 px-4 h-8 rounded-full text-xs font-medium transition-colors",
                activeCategory === cat
                  ? "text-white"
                  : "bg-gray-50 text-gray-500 hover:bg-gray-100"
              )}
              style={activeCategory === cat ? { backgroundColor: primaryColor } : {}}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Divider */}
      <div className="max-w-lg mx-auto w-full border-b border-gray-100 mt-3" />

      {/* Menu Items */}
      <div className="max-w-lg mx-auto w-full px-5 pt-5 space-y-8">
        {categories.filter(c => c !== 'الكل').map(category => {
          const itemsInCategory = filteredItems.filter(item => item.category === category);
          if (itemsInCategory.length === 0) return null;

          return (
            <section key={category}>
              <h2 className="text-sm font-semibold text-gray-900 mb-4 px-0.5">{category}</h2>

              <div className="space-y-1">
                {itemsInCategory.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => { recordItemClick(item); setActiveItem(item); setSelectedSize(item.sizes?.[0] || null); }}
                    className="w-full flex items-center gap-4 p-3 -mx-3 rounded-xl hover:bg-gray-50 transition-colors text-right"
                  >
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-semibold text-gray-900 truncate">{item.name}</h3>
                      {item.description && (
                        <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">{item.description}</p>
                      )}
                      <p className="text-xs font-medium mt-1.5" style={{ color: primaryColor }}>
                        {getPriceDisplay(item)}
                      </p>
                    </div>
                    <div className="relative w-16 h-16 rounded-xl overflow-hidden shrink-0">
                      <StorageImage
                        imagePath={item.image_url}
                        alt={item.name}
                        fill
                        className="object-cover"
                        sizes="64px"
                      />
                    </div>
                  </button>
                ))}
              </div>
            </section>
          );
        })}

        {filteredItems.length === 0 && (
          <div className="text-center py-20 space-y-3">
            <div className="w-14 h-14 bg-gray-50 rounded-full flex items-center justify-center mx-auto text-gray-300">
              <Search size={24} />
            </div>
            <p className="text-sm text-gray-400">لا توجد نتائج</p>
          </div>
        )}
      </div>

      {/* Detail Sheet */}
      <Sheet open={!!activeItem} onOpenChange={(open) => !open && setActiveItem(null)}>
        <SheetContent side="bottom" className="rounded-t-2xl px-0 pt-3 pb-6 max-h-[85vh] overflow-y-auto">
          {activeItem && (
            <div className="max-w-md mx-auto px-5 space-y-5">

              {/* Handle */}
              <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto" />

              {/* Image */}
              <div className="relative w-full rounded-xl overflow-hidden" style={{ aspectRatio: '4/3' }}>
                <StorageImage
                  imagePath={activeItem.image_url}
                  alt={activeItem.name}
                  fill
                  className="object-cover"
                  sizes="400px"
                />
              </div>

              {/* Title & Price */}
              <div dir="rtl" className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0 text-right">
                  <h2 className="text-base font-bold text-gray-900">{activeItem.name}</h2>
                  {activeItem.description && (
                    <p className="text-sm text-gray-400 leading-relaxed mt-1">{activeItem.description}</p>
                  )}
                </div>
                <span className="text-sm font-bold shrink-0 pt-0.5" style={{ color: primaryColor }}>
                  {selectedSize && typeof selectedSize.price === 'number'
                    ? (selectedSize.price === 0 ? 'مجاني' : `${selectedSize.price} ر.س`)
                    : getPriceDisplay(activeItem)}
                </span>
              </div>

              {/* Sizes */}
              {Array.isArray(activeItem.sizes) && activeItem.sizes.length > 0 && (
                <div dir="rtl" className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-gray-500">الحجم</p>
                  </div>
                  <div className="flex gap-0 overflow-x-auto no-scrollbar pb-1 snap-x snap-mandatory">
                    {activeItem.sizes.map((size) => {
                      const isActive = selectedSize?.id === size.id;
                      return (
                        <button
                          key={size.id || size.name}
                          type="button"
                          onClick={() => setSelectedSize(size)}
                          className={cn(
                            "shrink-0 px-6 py-3 snap-center transition-all duration-200 border-b-2",
                            isActive
                              ? "border-current"
                              : "border-transparent text-gray-300"
                          )}
                          style={isActive ? { borderColor: primaryColor, color: primaryColor } : {}}
                        >
                          <span className={cn(
                            "text-sm transition-all duration-200",
                            isActive ? "font-bold" : "font-medium"
                          )}>
                            {size.name}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Suggestions */}
              {activeSuggestions.length > 0 && (
                <div dir="rtl" className="space-y-3">
                  <p className="text-xs font-semibold text-gray-500 text-right">يقترح معه</p>
                  <div className="grid grid-cols-3 gap-3">
                    {activeSuggestions.map((sug) => (
                      <button
                        key={sug.id}
                        onClick={() => { recordItemClick(sug); setActiveItem(sug); setSelectedSize(sug.sizes?.[0] || null); }}
                        className="text-right group"
                      >
                        <div className="relative w-full aspect-square rounded-xl overflow-hidden mb-2">
                          <StorageImage
                            imagePath={sug.image_url}
                            alt={sug.name}
                            fill
                            className="object-cover"
                            sizes="150px"
                          />
                        </div>
                        <p className="text-xs text-gray-900 font-semibold truncate">{sug.name}</p>
                        <p className="text-[11px] font-bold mt-0.5" style={{ color: primaryColor }}>
                          {getPriceDisplay(sug)}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
