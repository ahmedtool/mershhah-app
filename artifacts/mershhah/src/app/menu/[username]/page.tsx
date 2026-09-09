"use client";
import { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { useParams } from 'wouter';
import { useRouter, useSearchParams } from '@/lib/navigation';
import { Button } from '@/components/ui/button';
import { Search, Info, Star, Navigation, ChevronRight, ChevronLeft } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { getPublicPage, syncPublicPage } from '@/lib/public-pages';
import { trackPageView, trackAppClick, trackPhoneClick } from '@/lib/event-tracker';
import { detectTrafficSource } from '@/lib/traffic-source';
import { StorageImage } from '@/components/shared/StorageImage';
import type { MenuItem } from '@/lib/types';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { getPublicThemeStyle } from '@/lib/public-theme';
import { PublicPageBackdrop } from '@/components/shared/PublicPageBackdrop';
import { useToast } from '@/hooks/use-toast';
import { useDocumentMeta } from '@/hooks/useDocumentMeta';
import { useGoogleFont } from '@/hooks/useGoogleFont';
import { useLanguage } from '@/components/shared/LanguageContext';
import { LanguageSwitcher } from '@/components/shared/LanguageSwitcher';
import { useNearestBranch } from '@/hooks/useNearestBranch';

// One order channel shown on an item's card - either the branch's own
// custom app (the featured "direct" tile) or one of its enabled global
// delivery apps. `price` already resolves the item's per-channel override
// (channel_prices) falling back to the base menu price.
type OrderChannel = {
  id: string;
  name: string;
  logo?: string;
  value: string;
  price: number;
  isDirect: boolean;
};

function buildOrderChannels(item: MenuItem, branch: any, basePrice: number): OrderChannel[] {
  const apps: any[] = Array.isArray(branch?.applications) ? branch.applications : [];
  const withPrice = (app: any): OrderChannel => ({
    id: app.platformId,
    name: app.name,
    logo: app.logo,
    value: app.value,
    price: item.channel_prices?.[app.platformId] ?? basePrice,
    isDirect: app.type === 'custom',
  });
  // The direct/custom app is the restaurant's own full menu, so it always
  // lists every item at the base price. A third-party delivery app only
  // ever carries whatever subset of the menu the owner has actually priced
  // for it - so unlike the direct tile, a global app's tile only shows for
  // an item once the owner has explicitly set that item's price for it;
  // otherwise this item just isn't listed there and the tile stays hidden.
  const direct = apps.filter((a) => a.type === 'custom' && a.value).map(withPrice);
  const global = apps
    .filter((a) => a.type === 'global' && a.value && item.channel_prices?.[a.platformId] != null)
    .map(withPrice);
  return [...direct, ...global];
}

export default function PublicMenuPage() {
  const params = useParams();
  const router = useRouter();
  const username = params.username as string;
  const searchParams = useSearchParams();
  const visitRecorded = useRef(false);
  const { t, dir } = useLanguage();
  const alignStart = dir === 'rtl' ? 'text-right' : 'text-left';

  const [restaurant, setRestaurant] = useState<any>(null);
  const displayName = dir === 'ltr' && restaurant?.name_en ? restaurant.name_en : restaurant?.name;
  useDocumentMeta(
    displayName
      ? (dir === 'rtl' ? `${t('hubPage.menuWord')} ${displayName}` : `${displayName} ${t('hubPage.menuWord')}`)
      : undefined,
    restaurant
      ? ((dir === 'ltr' && restaurant.description_en ? restaurant.description_en : restaurant.description) || (dir === 'rtl'
          ? `${t('publicMenu.metaDescPrefixWord')} ${t('hubPage.menuWord')} ${displayName} ${t('publicMenu.metaDescSuffix')}`
          : `${t('publicMenu.metaDescPrefixWord')} ${displayName}'s ${t('publicMenu.metaDescSuffix')}`))
      : undefined
  );
  useGoogleFont(restaurant?.fontFamily);

  useEffect(() => {
    if (!restaurant?.id || visitRecorded.current) return;
    visitRecorded.current = true;
    const source = detectTrafficSource(searchParams);
    supabase.from('hub_visits').insert({
      restaurant_id: restaurant.id,
      source,
      created_at: new Date().toISOString(),
    }).then(() => {});
    trackPageView(restaurant.id);
  }, [restaurant?.id, searchParams]);

  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [activeCategory, setActiveCategory] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const { phase: branchPhase, nearestBranch, requestLocation } = useNearestBranch(branches);

  const submitItemRating = async (item: MenuItem, rating: number, comment: string) => {
    if (!restaurant?.id || rating === 0) return;
    const { error } = await supabase.from('menu_item_reviews').insert({
      menu_item_id: item.id,
      restaurant_id: restaurant.id,
      rating,
      comment: comment || null,
      is_visible: true,
      created_at: new Date().toISOString(),
    });
    if (error) {
      toast({ variant: 'destructive', title: t('ownerSettings.errorTitle'), description: error.message });
      throw error;
    }
    toast({ title: t('publicShared.thankYouForRating') });
    syncPublicPage(restaurant.id).catch(() => {});
  };

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

  const buildCategoryTabs = (items: MenuItem[], orderedNames: string[]): string[] => {
    const extra = Array.from(new Set(items.map(i => i.category).filter(Boolean)))
      .filter((name) => !orderedNames.includes(name));
    return [...orderedNames, ...extra];
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
          const orderedNames = (data.categories || []).map((c) => c.name);
          const tabs = buildCategoryTabs(items, orderedNames);
          setCategories(tabs);
          setActiveCategory((prev) => prev || tabs[0] || '');
          setBranches(((data.branches || []) as any[]).filter((b) => b.status === 'active'));
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

        const [{ data: items }, { data: categoryRows }, { data: branchRows }] = await Promise.all([
          supabase.from('menu_items').select('*').eq('restaurant_id', rest.id),
          supabase.from('menu_categories').select('name').eq('restaurant_id', rest.id).order('position'),
          supabase.from('branches').select('*').eq('restaurant_id', rest.id).eq('status', 'active'),
        ]);

        const sorted = applySort((items || []) as MenuItem[]);
        setMenuItems(sorted);
        const tabs = buildCategoryTabs(sorted, (categoryRows || []).map((c: any) => c.name));
        setCategories(tabs);
        setActiveCategory((prev) => prev || tabs[0] || '');
        setBranches((branchRows || []) as any[]);
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

  const currentItems = useMemo(() => {
    return menuItems.filter(item => {
      const matchesCategory = item.category === activeCategory;
      const matchesSearch = !searchQuery ||
        (item.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.description || '').toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCategory && matchesSearch && item.status === 'available';
    });
  }, [menuItems, activeCategory, searchQuery]);

  const primaryColor = restaurant?.primaryColor || '#111827';

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

  if (loading) return (
    <div className="min-h-screen bg-white" dir={dir}>
      <div className="max-w-lg mx-auto px-5 space-y-8 pt-8">
        <div className="flex flex-col items-center space-y-4">
          <Skeleton className="h-20 w-20 rounded-2xl" />
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-4 w-56" />
        </div>
        <div className="flex gap-2">
          {[1,2,3,4].map(i => <Skeleton key={i} className="h-9 w-20 rounded-full" />)}
        </div>
        <Skeleton className="h-96 w-full rounded-3xl" />
      </div>
    </div>
  );

  if (!restaurant) return (
    <div className="h-screen w-full flex flex-col items-center justify-center bg-white text-center p-6 space-y-5">
      <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center text-gray-600">
        <Info size={28} />
      </div>
      <h1 className="text-lg font-bold text-gray-900">{t('hubPage.restaurantNotFound')}</h1>
      <Button onClick={() => router.push('/')} variant="outline" className="rounded-xl px-6">{t('hubPage.backToHome')}</Button>
    </div>
  );

  const themeStyle = getPublicThemeStyle(restaurant);

  return (
    <div className="flex flex-col min-h-screen pb-16 relative overflow-x-hidden" style={{ ...themeStyle, background: 'linear-gradient(to bottom, color-mix(in srgb, var(--r-secondary) 25%, white), white 220px)' }} dir={dir}>
      <PublicPageBackdrop />

      {/* Header - compact single row: back, logo, name + subtitle, search, language */}
      <div className="max-w-lg mx-auto w-full px-5 pt-6 pb-3 flex items-center gap-2.5">
        <Button
          variant="ghost"
          size="icon"
          className="w-9 h-9 rounded-xl text-gray-600 hover:text-gray-900 hover:bg-gray-100 shrink-0"
          onClick={() => {
            // A visitor usually lands here fresh (QR code / shared link,
            // often inside a messaging app's own in-app browser), with no
            // in-app page to go back to. history.back()/history.length
            // aren't reliable signals for that in every browser/webview,
            // so only go back when we can see we were actually navigated
            // here from within the app itself; otherwise land on the
            // restaurant's hub page instead of a dead or blank back button.
            let cameFromApp = false;
            try {
              cameFromApp = !!document.referrer && new URL(document.referrer).origin === window.location.origin;
            } catch {
              cameFromApp = false;
            }
            if (cameFromApp) {
              router.back();
            } else {
              router.push(`/${username}`);
            }
          }}
        >
          {dir === 'rtl' ? <ChevronRight className="h-5 w-5" /> : <ChevronLeft className="h-5 w-5" />}
        </Button>
        <div className="relative w-9 h-9 rounded-xl overflow-hidden shrink-0" style={{ borderRadius: 'var(--r-radius-sm)' }}>
          <StorageImage imagePath={restaurant.logo} alt={displayName} fill sizes="36px" className="object-cover" />
        </div>
        <div className={`flex-1 min-w-0 ${alignStart}`}>
          <h1 className="text-sm font-bold text-gray-900 truncate">{displayName}</h1>
          <p className="text-[10px] text-gray-600 truncate">{restaurant.description || t('publicMenu.menuSubtitle')}</p>
        </div>
        <button
          type="button"
          onClick={() => setSearchOpen((v) => !v)}
          className="w-9 h-9 rounded-xl bg-gray-50 text-gray-600 hover:bg-gray-100 transition-colors flex items-center justify-center shrink-0"
        >
          <Search className="h-4 w-4" />
        </button>
        <LanguageSwitcher />
      </div>

      <div className="max-w-lg mx-auto w-full px-5 space-y-3">
        {/* Search - collapsed by default, matching the header's icon-only affordance */}
        {searchOpen && (
          <div className="relative">
            <Search className="absolute start-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-600 pointer-events-none" />
            <Input
              autoFocus
              placeholder={t('publicMenu.searchPlaceholder')}
              className="w-full h-11 rounded-xl bg-gray-50 border border-gray-100 text-sm ps-10 pe-4 focus-visible:ring-1 focus-visible:ring-gray-200 focus-visible:border-gray-200"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        )}

        {/* Categories - underline style */}
        <div className="flex gap-1 overflow-x-auto no-scrollbar -mx-5 px-5 border-b border-gray-100">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={cn(
                "shrink-0 px-3 py-3 text-xs transition-colors relative",
                activeCategory === cat ? "text-gray-900 font-bold" : "text-gray-600 font-medium hover:text-gray-900"
              )}
            >
              {cat}
              {activeCategory === cat && (
                <span className="absolute inset-x-2.5 bottom-0 h-[3px] rounded-full" style={{ backgroundColor: primaryColor }} />
              )}
            </button>
          ))}
        </div>

        {/* Nearest-branch indicator - only worth surfacing with more than one
            branch, since a single branch's channels are shown regardless. */}
        {branches.length > 1 && (
          <div className="text-center">
            {branchPhase === 'located' ? (
              <p className="text-[10px] text-gray-600 flex items-center justify-center gap-1">
                <Navigation className="h-2.5 w-2.5" />
                {t('publicMenu.nearestBranchPrefix')} {nearestBranch?.name} {t('publicMenu.nearestBranchSuffix')}
              </p>
            ) : (
              <button
                type="button"
                onClick={requestLocation}
                disabled={branchPhase === 'locating'}
                className="text-[10px] font-bold flex items-center justify-center gap-1 mx-auto disabled:opacity-50"
                style={{ color: primaryColor }}
              >
                <Navigation className="h-2.5 w-2.5" />
                {branchPhase === 'locating' ? t('publicBranches.locating') : t('publicMenu.showNearestBranchCta')}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Swipeable item rail for the active category */}
      <div className="max-w-lg mx-auto w-full mt-2">
        {currentItems.length === 0 ? (
          <div className="text-center py-20 space-y-3">
            <div className="w-14 h-14 bg-gray-50 rounded-full flex items-center justify-center mx-auto text-gray-600">
              <Search size={24} />
            </div>
            <p className="text-sm text-gray-600">{t('publicMenu.noItemsInCategory')}</p>
          </div>
        ) : (
          <ItemRail
            key={activeCategory}
            items={currentItems}
            nearestBranch={nearestBranch}
            primaryColor={primaryColor}
            dir={dir}
            t={t}
            onEngageItem={(item) => recordItemClick(item)}
            onSubmitRating={submitItemRating}
            onChannelClick={(item, channel) => {
              if (restaurant?.id) {
                if (channel.isDirect) trackAppClick(restaurant.id, channel.name);
                else trackAppClick(restaurant.id, channel.name);
              }
              window.open(channel.value, '_blank', 'noopener,noreferrer');
            }}
          />
        )}
      </div>

    </div>
  );
}

interface ItemRailProps {
  items: MenuItem[];
  nearestBranch: any;
  primaryColor: string;
  dir: 'rtl' | 'ltr';
  t: (key: string) => string;
  onEngageItem: (item: MenuItem) => void;
  onSubmitRating: (item: MenuItem, rating: number, comment: string) => Promise<void>;
  onChannelClick: (item: MenuItem, channel: OrderChannel) => void;
}

function ItemRail({ items, nearestBranch, primaryColor, dir, t, onEngageItem, onSubmitRating, onChannelClick }: ItemRailProps) {
  const railRef = useRef<HTMLDivElement>(null);
  const slideRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const rail = railRef.current;
    if (!rail) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && entry.intersectionRatio > 0.6) {
            const idx = slideRefs.current.findIndex((el) => el === entry.target);
            if (idx !== -1) setActiveIndex(idx);
          }
        });
      },
      { root: rail, threshold: [0.6] }
    );
    slideRefs.current.forEach((el) => el && observer.observe(el));
    return () => observer.disconnect();
  }, [items]);

  return (
    <div className="space-y-2">
      <div
        ref={railRef}
        className="flex overflow-x-auto no-scrollbar snap-x snap-mandatory scroll-smooth [-webkit-overflow-scrolling:touch]"
      >
        {items.map((item, i) => (
          <div
            key={item.id}
            ref={(el) => { slideRefs.current[i] = el; }}
            className="shrink-0 w-full snap-center [scroll-snap-stop:always] px-5"
          >
            <ItemCard
              item={item}
              index={i}
              total={items.length}
              nearestBranch={nearestBranch}
              primaryColor={primaryColor}
              dir={dir}
              t={t}
              onEngageItem={onEngageItem}
              onSubmitRating={onSubmitRating}
              onChannelClick={onChannelClick}
            />
          </div>
        ))}
      </div>

      {items.length > 1 && (
        <>
          <div className="flex items-center justify-center gap-2">
            {items.map((_, i) => (
              <span
                key={i}
                className="block rounded-full transition-all"
                style={{
                  height: i === activeIndex ? 7 : 6,
                  width: i === activeIndex ? 7 : 6,
                  backgroundColor: i === activeIndex ? primaryColor : '#d6deda',
                }}
              />
            ))}
          </div>
          <p className="text-center text-[10px] text-gray-600">{t('publicMenu.swipeHint')}</p>
        </>
      )}
    </div>
  );
}

interface ItemCardProps {
  item: MenuItem;
  index: number;
  total: number;
  nearestBranch: any;
  primaryColor: string;
  dir: 'rtl' | 'ltr';
  t: (key: string) => string;
  onEngageItem: (item: MenuItem) => void;
  onSubmitRating: (item: MenuItem, rating: number, comment: string) => Promise<void>;
  onChannelClick: (item: MenuItem, channel: OrderChannel) => void;
}

function ItemCard({ item, index, total, nearestBranch, primaryColor, dir, t, onEngageItem, onSubmitRating, onChannelClick }: ItemCardProps) {
  const [selectedSize, setSelectedSize] = useState<any>(item.sizes?.[0] || null);
  const [showRatingForm, setShowRatingForm] = useState(false);
  const [itemRating, setItemRating] = useState(0);
  const [itemHoverRating, setItemHoverRating] = useState(0);
  const [itemComment, setItemComment] = useState('');
  const [isSubmittingRating, setIsSubmittingRating] = useState(false);

  const basePrice = item.sizes?.[0]?.price ?? 0;
  const displayPrice = selectedSize && typeof selectedSize.price === 'number' ? selectedSize.price : basePrice;
  const channels = buildOrderChannels(item, nearestBranch, basePrice);
  const highestPrice = channels.length ? Math.max(...channels.map((c) => c.price)) : basePrice;
  const cheapestPrice = channels.length ? Math.min(...channels.map((c) => c.price)) : basePrice;
  const savings = highestPrice - cheapestPrice;

  const handleSubmitRating = async () => {
    if (itemRating === 0) return;
    setIsSubmittingRating(true);
    try {
      await onSubmitRating(item, itemRating, itemComment);
      setShowRatingForm(false);
      setItemRating(0);
      setItemComment('');
    } catch {
      // onSubmitRating already surfaces the error toast
    } finally {
      setIsSubmittingRating(false);
    }
  };

  return (
    <>
      <div className="flex items-center justify-between pt-1">
        {item.display_tags && item.display_tags !== 'none' ? (
          <span className="inline-flex items-center bg-white border border-gray-100 rounded-full px-2.5 py-1.5 text-[10px] font-bold text-gray-700 shadow-sm">
            {item.display_tags === 'best_seller' ? t('publicMenu.tagBestSeller') : item.display_tags === 'daily_offer' ? t('publicMenu.tagDailyOffer') : t('publicMenu.tagNew')}
          </span>
        ) : <span />}
        <span className="text-[10px] text-gray-600">{index + 1} / {total}</span>
      </div>

      <div className="relative flex items-center justify-center" style={{ height: 280 }}>
        <div
          className="absolute rounded-full blur-sm"
          style={{
            inset: 'auto auto 40px 50%', transform: 'translateX(-50%)',
            width: '82%', height: '82%',
            background: `radial-gradient(circle, color-mix(in srgb, ${primaryColor} 8%, transparent) 0%, transparent 70%)`,
          }}
        />
        <div className="relative w-full h-full max-w-[240px]">
          <StorageImage imagePath={item.image_url} alt={item.name} fill className="object-contain drop-shadow-xl" sizes="240px" />
        </div>
      </div>

      <div className="text-center">
        <h2 className="text-2xl font-black text-gray-900 mt-1">{item.name}</h2>
        <span className="text-lg font-bold" style={{ color: primaryColor }}>
          {displayPrice === 0 ? t('planPricing.free') : `${displayPrice} ${t('ownerSettings.currency')}`}
        </span>
        {item.description && <p className="text-xs text-gray-600 mt-1.5 line-clamp-1">{item.description}</p>}
      </div>

      <div className="mt-3 max-w-sm mx-auto space-y-3">
        {/* Rating */}
        <div dir={dir} className="flex items-center justify-between">
          {item.review_count ? (
            <div className="flex items-center gap-1.5">
              <Star className="h-4 w-4 text-amber-400 fill-amber-400" />
              <span className="text-sm font-bold text-gray-900">{item.rating?.toFixed(1)}</span>
              <span className="text-xs text-gray-600">({item.review_count} {t('publicShared.reviewCountSuffix')})</span>
            </div>
          ) : (
            <span className="text-xs text-gray-600">{t('publicMenu.noRatingYet')}</span>
          )}
          {!showRatingForm && (
            <button
              type="button"
              onClick={() => { setShowRatingForm(true); onEngageItem(item); }}
              className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold transition-transform active:scale-95"
              style={{ backgroundColor: `${primaryColor}14`, color: primaryColor, border: `1px solid ${primaryColor}35` }}
            >
              <Star className="h-3.5 w-3.5" fill={primaryColor} />
              {t('publicMenu.rateThisItem')}
            </button>
          )}
        </div>

        {showRatingForm && (
          <div dir={dir} className="rounded-xl border border-gray-100 p-4 space-y-3">
            <div className="flex justify-center gap-1 flex-row-reverse">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onMouseEnter={() => setItemHoverRating(star)}
                  onMouseLeave={() => setItemHoverRating(0)}
                  onClick={() => setItemRating(star)}
                  className="p-0.5 transition-transform hover:scale-110"
                >
                  <Star
                    className="h-7 w-7 transition-colors"
                    fill={star <= (itemHoverRating || itemRating) ? '#f59e0b' : 'none'}
                    stroke={star <= (itemHoverRating || itemRating) ? '#f59e0b' : '#d1d5db'}
                  />
                </button>
              ))}
            </div>
            <Textarea
              placeholder={t('publicShared.leaveComment')}
              value={itemComment}
              onChange={(e) => setItemComment(e.target.value)}
              className="text-sm min-h-[70px] resize-none rounded-xl"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowRatingForm(false)}
                className="flex-1 h-10 rounded-xl border border-gray-200 text-sm font-medium text-gray-600"
              >
                {t('publicShared.cancel')}
              </button>
              <button
                type="button"
                onClick={handleSubmitRating}
                disabled={itemRating === 0 || isSubmittingRating}
                style={{ backgroundColor: primaryColor, color: 'var(--r-button-text)' }}
                className="flex-1 h-10 rounded-xl text-sm font-bold disabled:opacity-50"
              >
                {isSubmittingRating ? t('publicShared.sending') : t('publicShared.send')}
              </button>
            </div>
          </div>
        )}

        {/* Sizes */}
        {Array.isArray(item.sizes) && item.sizes.length > 0 && (
          <div dir={dir} className="space-y-2">
            <p className="text-xs font-semibold text-gray-600">{t('publicMenu.sizeLabel')}</p>
            <div className="flex gap-0 overflow-x-auto no-scrollbar pb-1 snap-x snap-mandatory">
              {item.sizes.map((size) => {
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
                        : "border-transparent text-gray-600"
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
      </div>

      {channels.length > 0 && (
        <div className="mt-4 max-w-sm mx-auto">
          <div className="flex items-center gap-2 justify-center mb-2.5">
            <span className="h-px flex-1 bg-gradient-to-l from-transparent via-gray-200 to-transparent" />
            <span className="text-[10px] font-bold text-gray-600">{t('publicMenu.chooseOrderMethod')}</span>
            <span className="h-px flex-1 bg-gradient-to-r from-transparent via-gray-200 to-transparent" />
          </div>
          <div className={cn("grid gap-2", channels.length >= 4 ? "grid-cols-4" : `grid-cols-${channels.length}`)}>
            {channels.map((channel) => (
              <button
                key={channel.id}
                type="button"
                onClick={() => onChannelClick(item, channel)}
                className={cn(
                  "relative flex flex-col items-center rounded-2xl border p-2 text-center transition-transform active:scale-95",
                  channel.isDirect ? "bg-white shadow-sm" : "bg-white border-gray-100"
                )}
                style={channel.isDirect ? { borderColor: `${primaryColor}50`, background: `linear-gradient(180deg, color-mix(in srgb, ${primaryColor} 5%, white), white)` } : {}}
              >
                {channel.isDirect && (
                  <span
                    className="absolute -top-2 inset-x-0 mx-auto w-fit text-[8px] font-bold text-white rounded-full px-1.5 py-0.5 whitespace-nowrap"
                    style={{ backgroundColor: primaryColor }}
                  >
                    {t('publicMenu.bestForYou')}
                  </span>
                )}
                <div className="relative w-8 h-8 rounded-xl bg-gray-50 overflow-hidden mb-1 mt-1">
                  {channel.logo ? (
                    <StorageImage imagePath={channel.logo} alt={channel.name} fill className="object-contain p-1" sizes="32px" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-[10px] font-black text-gray-600">
                      {channel.name.slice(0, 2)}
                    </div>
                  )}
                </div>
                <span className="text-[9px] font-bold text-gray-900 leading-tight line-clamp-2 min-h-[22px]">{channel.name}</span>
                <span className="text-[10px] font-bold mt-0.5" style={{ color: channel.isDirect ? primaryColor : undefined }}>
                  {channel.price} {t('ownerSettings.currency')}
                </span>
                <span
                  className="w-full mt-1.5 rounded-lg py-1 text-[9px] font-bold"
                  style={channel.isDirect ? { backgroundColor: primaryColor, color: 'var(--r-button-text)' } : { backgroundColor: '#f2f5f3', color: '#2e3e36' }}
                >
                  {channel.isDirect ? t('publicMenu.orderNow') : t('publicMenu.openInApp')}
                </span>
              </button>
            ))}
          </div>
          {savings > 0 && (
            <p className="text-center text-[10px] font-bold mt-2" style={{ color: primaryColor }}>
              {t('publicMenu.savePrefix')} {savings} {t('ownerSettings.currency')} {t('publicMenu.saveSuffix')}
            </p>
          )}
        </div>
      )}
    </>
  );
}
