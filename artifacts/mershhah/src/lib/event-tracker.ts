import { supabase } from '@/lib/supabase';

type EventType =
  | 'app_click'
  | 'delivery_click'
  | 'social_click'
  | 'maps_click'
  | 'phone_click'
  | 'whatsapp_click'
  | 'review_submit'
  | 'page_view'
  | 'branch_view';

function getDeviceType(): string {
  const w = window.innerWidth;
  if (w < 768) return 'mobile';
  if (w < 1024) return 'tablet';
  return 'desktop';
}

export async function trackEvent(
  restaurantId: string,
  eventType: EventType,
  eventDetail?: string
): Promise<void> {
  try {
    await supabase.from('page_events').insert({
      restaurant_id: restaurantId,
      event_type: eventType,
      event_detail: eventDetail || null,
      device_type: getDeviceType(),
    });
  } catch {
    // silent fail — tracking should never block UI
  }
}

export async function trackAppClick(restaurantId: string, appName: string): Promise<void> {
  return trackEvent(restaurantId, 'app_click', appName);
}

export async function trackDeliveryClick(restaurantId: string, platform: string): Promise<void> {
  return trackEvent(restaurantId, 'delivery_click', platform);
}

export async function trackSocialClick(restaurantId: string, platform: string): Promise<void> {
  return trackEvent(restaurantId, 'social_click', platform);
}

export async function trackMapsClick(restaurantId: string): Promise<void> {
  return trackEvent(restaurantId, 'maps_click', 'google_maps');
}

export async function trackPhoneClick(restaurantId: string): Promise<void> {
  return trackEvent(restaurantId, 'phone_click');
}

export async function trackWhatsappClick(restaurantId: string): Promise<void> {
  return trackEvent(restaurantId, 'whatsapp_click');
}

export async function trackPageView(restaurantId: string): Promise<void> {
  return trackEvent(restaurantId, 'page_view');
}

export async function trackBranchView(restaurantId: string, branchName: string): Promise<void> {
  return trackEvent(restaurantId, 'branch_view', branchName);
}
