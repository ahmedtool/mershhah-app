import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { getVisitorId } from '@/lib/visitor-id';

function presenceChannelName(restaurantId: string): string {
  return `restaurant-presence:${restaurantId}`;
}

// Announces "I'm here right now" on a Supabase Realtime Presence channel -
// no database writes at all, just an ephemeral WebSocket membership that
// disappears the instant the tab closes or loses connection. Keyed by the
// same localStorage visitor_id used for hub_visits, so someone with the
// menu open in two tabs still counts as one live visitor, not two.
export function useAnnouncePresence(restaurantId: string | undefined | null) {
  useEffect(() => {
    if (!restaurantId) return;
    const visitorId = getVisitorId();
    if (!visitorId) return;

    const channel = supabase.channel(presenceChannelName(restaurantId), {
      config: { presence: { key: visitorId } },
    });
    channel.subscribe((status: string) => {
      if (status === 'SUBSCRIBED') {
        channel.track({ online_at: new Date().toISOString() });
      }
    });

    return () => { supabase.removeChannel(channel); };
  }, [restaurantId]);
}

// Watches the same channel from the owner's side, read-only - it never
// calls track() itself, so the owner viewing their own reports page is
// never counted as one of their own live visitors.
export function useLiveVisitorCount(restaurantId: string | undefined | null): number {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!restaurantId) { setCount(0); return; }

    const channel = supabase.channel(presenceChannelName(restaurantId));
    channel.on('presence', { event: 'sync' }, () => {
      setCount(Object.keys(channel.presenceState()).length);
    });
    channel.subscribe();

    return () => { supabase.removeChannel(channel); setCount(0); };
  }, [restaurantId]);

  return count;
}
