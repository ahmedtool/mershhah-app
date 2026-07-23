import { supabase } from '@/lib/supabase';

export type PublicPageData = {
  restaurant: {
    id: string;
    name: string;
    username: string;
    description?: string | null;
    logo?: string | null;
    primaryColor?: string | null;
    secondaryColor?: string | null;
    applications?: Array<{ id?: string; name?: string; value?: string; url?: string; logo?: string }>;
    socialLinks?: Array<{ platform?: string; value?: string }>;
    is_paid_plan?: boolean;
    [key: string]: unknown;
  };
  menu: Array<{
    id: string;
    name?: string;
    description?: string;
    category?: string;
    image_url?: string;
    status?: string;
    sizes?: Array<{ id?: string; name?: string; price?: number }>;
    position?: number;
    clicks_count?: number;
    [key: string]: unknown;
  }>;
  branches: Array<{
    id: string;
    name?: string;
    address?: string;
    city?: string;
    district?: string;
    phone?: string;
    google_maps_url?: string;
    opening_hours?: string;
    status?: string;
    [key: string]: unknown;
  }>;
  offers: Array<{
    id: string;
    title?: string;
    description?: string;
    image_url?: string;
    external_link?: string;
    valid_until?: unknown;
    status?: string;
    [key: string]: unknown;
  }>;
  reviews_summary: {
    count: number;
    averageRating: number;
    distribution: { 5: number; 4: number; 3: number; 2: number; 1: number };
  };
  reviews: Array<{
    id: string;
    rating: number;
    comment?: string;
    createdAt?: unknown;
    is_visible?: boolean;
  }>;
  updated_at: unknown;
};

export async function getPublicPage(username: string): Promise<PublicPageData | null> {
  if (!username?.trim()) return null;
  try {
    const { data, error } = await supabase
      .from('public_pages')
      .select('data')
      .eq('id', username.trim().toLowerCase())
      .single();
    if (error || !data) return null;
    return data.data as PublicPageData;
  } catch {
    return null;
  }
}

export async function syncPublicPage(restaurantId: string): Promise<void> {
  try {
    const { data: restData, error: restError } = await supabase
      .from('restaurants')
      .select('*')
      .eq('id', restaurantId)
      .single();

    if (restError || !restData) return;

    const username = (restData.username ?? '').toString().trim().toLowerCase();
    if (!username) return;

    const now = new Date();

    const [menuRes, branchesRes, offersRes, reviewsRes] = await Promise.all([
      supabase.from('menu_items').select('*').eq('restaurant_id', restaurantId),
      supabase.from('branches').select('*').eq('restaurant_id', restaurantId).eq('status', 'active'),
      supabase.from('offers').select('*').eq('restaurant_id', restaurantId).eq('status', 'active'),
      supabase
        .from('reviews')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .order('created_at', { ascending: false })
        .limit(100),
    ]);

    const menu = menuRes.data || [];
    const branches = branchesRes.data || [];

    const offers = (offersRes.data || []).filter((o: any) => {
      const expiry = o.valid_until ? new Date(o.valid_until) : new Date(0);
      return expiry > now;
    });

    const reviewsList = (reviewsRes.data || []).filter((r: any) => r.is_visible !== false);

    const count = reviewsList.length;
    const totalRating = reviewsList.reduce((sum: number, r: any) => sum + (r.rating || 0), 0);
    const distribution = reviewsList.reduce(
      (acc: { 5: number; 4: number; 3: number; 2: number; 1: number }, r: any) => {
        const star = Math.floor(r.rating || 0);
        if (star >= 1 && star <= 5) acc[star as keyof typeof acc]++;
        return acc;
      },
      { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 }
    );

    const payload: PublicPageData = {
      restaurant: {
        id: restData.id,
        ...restData,
        name: restData.name ?? '',
        username,
        description: restData.description ?? null,
        logo: restData.logo ?? null,
        primaryColor: restData.primaryColor ?? null,
        secondaryColor: restData.secondaryColor ?? null,
        applications: Array.isArray(restData.applications) ? restData.applications : [],
        socialLinks: Array.isArray(restData.socialLinks) ? restData.socialLinks : [],
        is_paid_plan: restData.is_paid_plan ?? false,
      },
      menu,
      branches,
      offers,
      reviews_summary: {
        count,
        averageRating: count > 0 ? totalRating / count : 0,
        distribution,
      },
      reviews: reviewsList,
      updated_at: new Date().toISOString(),
    };

    await supabase
      .from('public_pages')
      .upsert({ id: username, data: payload, updated_at: new Date().toISOString() });
  } catch (e) {
    console.error('[public-pages] sync failed:', e);
  }
}
