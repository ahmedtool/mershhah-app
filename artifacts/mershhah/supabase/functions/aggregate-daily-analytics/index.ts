import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Runs nightly via pg_cron (see schedule_analytics_aggregation.sql). Rolls
// up yesterday's hub_visits/page_events rows into one analytics_daily row
// per restaurant, and yesterday's menu_item_interactions into one
// analytics_daily_items row per (restaurant, item) - then purges raw rows
// older than RETENTION_DAYS from all three tables, since they're safely
// aggregated by then. The reports page's all-time item-popularity total
// stays correct after the purge by summing analytics_daily_items (history)
// plus today's not-yet-aggregated raw rows, instead of scanning the raw
// table's full lifetime.
const RIYADH_OFFSET_HOURS = 3; // Saudi Arabia has no DST
const RETENTION_DAYS = 180;
const PAGE_SIZE = 1000;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    status,
  });
}

// A full Riyadh-local calendar day, expressed as the UTC instant range it
// spans - created_at is stored in UTC, so the query window has to be
// shifted by the UTC+3 offset instead of using UTC midnight (which would
// cut Riyadh's day off 3 hours early/late). Defaults to yesterday (the
// nightly cron's normal run); an explicit `dateOverride` (YYYY-MM-DD, a
// Riyadh calendar date) lets the same function backfill any past day on
// demand, e.g. right after this feature is first deployed.
function riyadhDayUtcRange(dateOverride?: string | null): { dayLabel: string; startUtc: string; endUtc: string } {
  let riyadhDay: Date;
  if (dateOverride) {
    const [y, m, d] = dateOverride.split("-").map(Number);
    riyadhDay = new Date(Date.UTC(y, m - 1, d));
  } else {
    const now = new Date();
    const riyadhNow = new Date(now.getTime() + RIYADH_OFFSET_HOURS * 60 * 60 * 1000);
    const riyadhToday = new Date(Date.UTC(riyadhNow.getUTCFullYear(), riyadhNow.getUTCMonth(), riyadhNow.getUTCDate()));
    riyadhDay = new Date(riyadhToday.getTime() - 24 * 60 * 60 * 1000);
  }
  const dayLabel = riyadhDay.toISOString().slice(0, 10);
  const startUtc = new Date(riyadhDay.getTime() - RIYADH_OFFSET_HOURS * 60 * 60 * 1000).toISOString();
  const endUtc = new Date(riyadhDay.getTime() + 24 * 60 * 60 * 1000 - RIYADH_OFFSET_HOURS * 60 * 60 * 1000).toISOString();
  return { dayLabel, startUtc, endUtc };
}

// A busy day across all restaurants could exceed Supabase's default
// 1000-row response cap - page through with .range() the same way
// syncSupabaseMau pages through listUsers, instead of silently truncating.
async function fetchAllRows(supabase: any, table: string, columns: string, startUtc: string, endUtc: string) {
  const rows: any[] = [];
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from(table)
      .select(columns)
      .gte("created_at", startUtc)
      .lt("created_at", endUtc)
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    rows.push(...(data || []));
    if (!data || data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  return rows;
}

type Bucket = {
  visitsTotal: number;
  uniqueVisitors: Set<string>;
  qr: number;
  link: number;
  sources: Record<string, number>;
  clicks: number;
  events: Record<string, number>;
  items: Map<string, number>;
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Only the cron job (calling with the service key) may trigger this.
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace("Bearer ", "");
    if (token !== supabaseServiceKey) {
      return json({ error: "Unauthorized" }, 401);
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const dateOverride = new URL(req.url).searchParams.get("date");
    const { dayLabel, startUtc, endUtc } = riyadhDayUtcRange(dateOverride);

    const [visits, events, interactions] = await Promise.all([
      fetchAllRows(supabase, "hub_visits", "restaurant_id, source, visitor_id", startUtc, endUtc),
      fetchAllRows(supabase, "page_events", "restaurant_id, event_type, event_detail", startUtc, endUtc),
      fetchAllRows(supabase, "menu_item_interactions", "restaurant_id, menu_item_id", startUtc, endUtc),
    ]);

    const byRestaurant = new Map<string, Bucket>();
    function bucket(restaurantId: string): Bucket {
      let b = byRestaurant.get(restaurantId);
      if (!b) {
        b = { visitsTotal: 0, uniqueVisitors: new Set(), qr: 0, link: 0, sources: {}, clicks: 0, events: {}, items: new Map() };
        byRestaurant.set(restaurantId, b);
      }
      return b;
    }

    for (const v of visits) {
      if (!v.restaurant_id) continue;
      const b = bucket(v.restaurant_id);
      b.visitsTotal++;
      if (v.visitor_id) b.uniqueVisitors.add(v.visitor_id);
      const source = v.source || "other";
      if (source === "qr_branch") b.qr++; else b.link++;
      b.sources[source] = (b.sources[source] || 0) + 1;
    }
    for (const e of events) {
      if (!e.restaurant_id) continue;
      const b = bucket(e.restaurant_id);
      // page_view/branch_view are already covered by the visits counters
      // above (hub_visits) - only the click-type events add new signal here.
      if (e.event_type === "page_view" || e.event_type === "branch_view") continue;
      const key = e.event_detail ? `${e.event_type}:${e.event_detail}` : e.event_type;
      b.events[key] = (b.events[key] || 0) + 1;
      b.clicks++;
    }
    for (const i of interactions) {
      if (!i.restaurant_id || !i.menu_item_id) continue;
      const b = bucket(i.restaurant_id);
      b.items.set(i.menu_item_id, (b.items.get(i.menu_item_id) || 0) + 1);
    }

    const rows = Array.from(byRestaurant.entries()).map(([restaurant_id, b]) => ({
      restaurant_id,
      day: dayLabel,
      visits_total: b.visitsTotal,
      visits_unique: b.uniqueVisitors.size,
      visits_qr: b.qr,
      visits_link: b.link,
      source_breakdown: b.sources,
      clicks_total: b.clicks,
      event_breakdown: b.events,
    }));

    const itemRows: { restaurant_id: string; menu_item_id: string; day: string; interactions: number }[] = [];
    for (const [restaurant_id, b] of byRestaurant.entries()) {
      for (const [menu_item_id, interactions_count] of b.items.entries()) {
        itemRows.push({ restaurant_id, menu_item_id, day: dayLabel, interactions: interactions_count });
      }
    }

    if (rows.length > 0) {
      const { error: upsertError } = await supabase
        .from("analytics_daily")
        .upsert(rows, { onConflict: "restaurant_id,day" });
      if (upsertError) throw upsertError;
    }
    if (itemRows.length > 0) {
      const { error: upsertItemsError } = await supabase
        .from("analytics_daily_items")
        .upsert(itemRows, { onConflict: "restaurant_id,menu_item_id,day" });
      if (upsertItemsError) throw upsertItemsError;
    }

    // Skip the purge on a manual backfill call (?date=...) - only the
    // unattended nightly run (aggregating yesterday) should ever delete
    // anything, so replaying old days to fill the rollups in can never
    // accidentally wipe raw data early.
    let purgedBefore: string | null = null;
    if (!dateOverride) {
      const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();
      const [{ error: purgeVisitsError }, { error: purgeEventsError }, { error: purgeInteractionsError }] = await Promise.all([
        supabase.from("hub_visits").delete().lt("created_at", cutoff),
        supabase.from("page_events").delete().lt("created_at", cutoff),
        supabase.from("menu_item_interactions").delete().lt("created_at", cutoff),
      ]);
      if (purgeVisitsError) throw purgeVisitsError;
      if (purgeEventsError) throw purgeEventsError;
      if (purgeInteractionsError) throw purgeInteractionsError;
      purgedBefore = cutoff;
    }

    return json({ day: dayLabel, restaurantsAggregated: rows.length, itemRowsAggregated: itemRows.length, purgedBefore });
  } catch (err: any) {
    return json({ error: err.message }, 500);
  }
});
