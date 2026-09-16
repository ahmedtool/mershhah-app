import { Router, type IRouter, type Request, type Response } from "express";

const router: IRouter = Router();

function getApiKey(): string {
  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key) throw new Error("Google Maps is not configured (GOOGLE_MAPS_API_KEY)");
  return key;
}

// GET /api/geocode/reverse?lat=..&lng=.. — coordinates -> a human-readable
// address, via Google's Geocoding API. The key stays server-side; the
// browser never sees it.
router.get("/reverse", async (req: Request, res: Response) => {
  try {
    const lat = Number(req.query.lat);
    const lng = Number(req.query.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      res.status(400).json({ error: "lat and lng query params are required" });
      return;
    }
    const key = getApiKey();
    const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&language=ar&key=${key}`;
    const r = await fetch(url);
    const data = (await r.json()) as { status: string; results?: Array<{ formatted_address: string }> };
    if (data.status !== "OK" || !data.results?.length) {
      res.json({ address: null });
      return;
    }
    res.json({ address: data.results[0].formatted_address });
  } catch (error: any) {
    console.error("[geocode-route] reverse error:", error);
    res.status(500).json({ error: error.message || "Internal server error" });
  }
});

// GET /api/geocode/forward?address=.. — address text -> coordinates, via
// Google's Geocoding API.
router.get("/forward", async (req: Request, res: Response) => {
  try {
    const address = (req.query.address as string || "").trim();
    if (!address) {
      res.status(400).json({ error: "address query param is required" });
      return;
    }
    const key = getApiKey();
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&language=ar&key=${key}`;
    const r = await fetch(url);
    const data = (await r.json()) as {
      status: string;
      results?: Array<{ formatted_address: string; geometry: { location: { lat: number; lng: number } } }>;
    };
    if (data.status !== "OK" || !data.results?.length) {
      res.json({ result: null });
      return;
    }
    const top = data.results[0];
    res.json({
      result: {
        latitude: top.geometry.location.lat,
        longitude: top.geometry.location.lng,
        displayName: top.formatted_address,
      },
    });
  } catch (error: any) {
    console.error("[geocode-route] forward error:", error);
    res.status(500).json({ error: error.message || "Internal server error" });
  }
});

// GET /api/geocode/autocomplete?input=..&sessiontoken=.. — branch-name/address
// search suggestions, restricted to Saudi Arabia. sessiontoken groups the
// keystroke-by-keystroke calls plus the following place-details call into
// one billed Google Places session instead of N separate requests.
router.get("/autocomplete", async (req: Request, res: Response) => {
  try {
    const input = (req.query.input as string || "").trim();
    const sessiontoken = (req.query.sessiontoken as string || "").trim();
    if (!input) {
      res.json({ suggestions: [] });
      return;
    }
    const key = getApiKey();
    const params = new URLSearchParams({
      input,
      key,
      language: "ar",
      components: "country:sa",
      // Without this, Google mixes in cities/districts/plain addresses
      // alongside actual businesses - typing a broad area name (a city or
      // neighborhood) then surfaced that region itself as a top "match"
      // instead of the restaurant/shop the owner was actually looking for.
      // "establishment" restricts results to real places of business, so
      // multiple branches of the same name each show up as their own pick.
      types: "establishment",
    });
    if (sessiontoken) params.set("sessiontoken", sessiontoken);
    const url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?${params.toString()}`;
    const r = await fetch(url);
    const data = (await r.json()) as {
      status: string;
      predictions?: Array<{ place_id: string; description: string }>;
    };
    if (data.status !== "OK" && data.status !== "ZERO_RESULTS") {
      res.json({ suggestions: [] });
      return;
    }
    res.json({
      suggestions: (data.predictions || []).map((p) => ({
        placeId: p.place_id,
        description: p.description,
      })),
    });
  } catch (error: any) {
    console.error("[geocode-route] autocomplete error:", error);
    res.status(500).json({ error: error.message || "Internal server error" });
  }
});

// GET /api/geocode/textsearch?query=.. — a real one-shot "find every
// matching business" search (Places Text Search), used by the bulk branch
// importer instead of Autocomplete: Autocomplete is a per-keystroke
// typeahead capped at ~5 predictions, fine for picking one place but far
// too few for "this chain has dozens of branches in Saudi Arabia". Text
// Search returns up to 20 results per page and up to 3 pages (Google's
// hard cap - 60 total, no way to request more from a single query),
// fetched here automatically so the caller gets one combined list.
router.get("/textsearch", async (req: Request, res: Response) => {
  try {
    const query = (req.query.query as string || "").trim();
    if (!query) {
      res.json({ places: [] });
      return;
    }
    const key = getApiKey();
    const places: Array<{ placeId: string; name: string; address: string }> = [];
    let pageToken: string | undefined;

    for (let page = 0; page < 3; page++) {
      const params = new URLSearchParams({ key, language: "ar", region: "sa" });
      if (pageToken) {
        params.set("pagetoken", pageToken);
      } else {
        params.set("query", `${query} Saudi Arabia`);
      }
      const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?${params.toString()}`;

      // A fresh next_page_token isn't immediately valid - Google's own docs
      // say to expect a short delay. Retry once on INVALID_REQUEST instead
      // of giving up on what would otherwise be a real next page.
      let data: { status: string; results?: Array<{ place_id: string; name: string; formatted_address: string }>; next_page_token?: string } | undefined;
      for (let attempt = 0; attempt < 2; attempt++) {
        if (pageToken) await new Promise((r) => setTimeout(r, 2000));
        const r = await fetch(url);
        data = (await r.json()) as typeof data;
        if (data?.status !== "INVALID_REQUEST") break;
      }
      if (!data || (data.status !== "OK" && data.status !== "ZERO_RESULTS")) break;

      for (const place of data.results || []) {
        places.push({ placeId: place.place_id, name: place.name, address: place.formatted_address });
      }
      if (!data.next_page_token) break;
      pageToken = data.next_page_token;
    }

    res.json({ places });
  } catch (error: any) {
    console.error("[geocode-route] textsearch error:", error);
    res.status(500).json({ error: error.message || "Internal server error" });
  }
});

type AddressComponent = { long_name: string; short_name: string; types: string[] };

function findComponent(components: AddressComponent[], ...types: string[]): string | undefined {
  for (const type of types) {
    const match = components.find((c) => c.types.includes(type));
    if (match) return match.long_name;
  }
  return undefined;
}

type OpeningHoursPeriod = { open: { day: number; time: string }; close?: { day: number; time: string } };
type DayHours = { open: string; close: string };

function formatGoogleTime(time: string): string {
  return `${time.slice(0, 2)}:${time.slice(2, 4)}`;
}

// Google gives a list of open/close periods keyed by day-of-week (0=Sunday..
// 6=Saturday), which can include multiple periods per day (split hours) or
// a 24-hour day (no `close`). We only need one open/close pair per day to
// match the branch form's own simplified "same every day, optionally
// different on Friday" model, so the last period seen per day wins.
function extractWeeklyHours(periods?: OpeningHoursPeriod[]): (DayHours | null)[] | undefined {
  if (!periods?.length) return undefined;
  const weekly: (DayHours | null)[] = [null, null, null, null, null, null, null];
  for (const period of periods) {
    if (!period.close) continue;
    weekly[period.open.day] = {
      open: formatGoogleTime(period.open.time),
      close: formatGoogleTime(period.close.time),
    };
  }
  return weekly.some((d) => d) ? weekly : undefined;
}

// GET /api/geocode/place-details?placeId=..&sessiontoken=.. — resolves a
// chosen autocomplete suggestion to a full branch profile: coordinates, a
// display name, best-effort city/district, phone, and weekly opening hours,
// so picking one suggestion can fill the whole branch form in one step.
router.get("/place-details", async (req: Request, res: Response) => {
  try {
    const placeId = (req.query.placeId as string || "").trim();
    const sessiontoken = (req.query.sessiontoken as string || "").trim();
    if (!placeId) {
      res.status(400).json({ error: "placeId query param is required" });
      return;
    }
    const key = getApiKey();
    const params = new URLSearchParams({
      place_id: placeId,
      key,
      language: "ar",
      fields: "geometry,formatted_address,name,address_components,international_phone_number,formatted_phone_number,opening_hours",
    });
    if (sessiontoken) params.set("sessiontoken", sessiontoken);
    const url = `https://maps.googleapis.com/maps/api/place/details/json?${params.toString()}`;
    const r = await fetch(url);
    const data = (await r.json()) as {
      status: string;
      result?: {
        geometry: { location: { lat: number; lng: number } };
        formatted_address: string;
        name?: string;
        address_components?: AddressComponent[];
        international_phone_number?: string;
        formatted_phone_number?: string;
        opening_hours?: { periods?: OpeningHoursPeriod[] };
      };
    };
    if (data.status !== "OK" || !data.result) {
      res.json({ result: null });
      return;
    }
    const components = data.result.address_components || [];
    const city = findComponent(components, "locality", "administrative_area_level_2", "administrative_area_level_1");
    const district = findComponent(components, "sublocality_level_1", "sublocality", "neighborhood");
    res.json({
      result: {
        latitude: data.result.geometry.location.lat,
        longitude: data.result.geometry.location.lng,
        displayName: data.result.name
          ? `${data.result.name} - ${data.result.formatted_address}`
          : data.result.formatted_address,
        name: data.result.name,
        city,
        district,
        phone: data.result.international_phone_number || data.result.formatted_phone_number,
        weeklyHours: extractWeeklyHours(data.result.opening_hours?.periods),
      },
    });
  } catch (error: any) {
    console.error("[geocode-route] place-details error:", error);
    res.status(500).json({ error: error.message || "Internal server error" });
  }
});

// POST /api/geocode/resolve-url { url } — follows a short Google Maps link
// (maps.app.goo.gl / goo.gl/maps) to its final destination. This has
// nothing to do with the Google Maps API - it's a plain HTTP redirect,
// but the browser can't follow a cross-origin redirect and read the
// resulting URL (CORS), which is why this used to go through a public
// third-party proxy (allorigins.win) instead. Doing it server-side needs
// no external dependency at all.
router.post("/resolve-url", async (req: Request, res: Response) => {
  try {
    const { url } = req.body as { url?: string };
    if (!url) {
      res.status(400).json({ error: "url is required" });
      return;
    }
    const r = await fetch(url, { redirect: "follow" });
    res.json({ resolvedUrl: r.url });
  } catch (error: any) {
    console.error("[geocode-route] resolve-url error:", error);
    res.status(500).json({ error: error.message || "Internal server error" });
  }
});

export default router;
