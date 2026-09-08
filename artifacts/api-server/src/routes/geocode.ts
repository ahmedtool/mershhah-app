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

type AddressComponent = { long_name: string; short_name: string; types: string[] };

function findComponent(components: AddressComponent[], ...types: string[]): string | undefined {
  for (const type of types) {
    const match = components.find((c) => c.types.includes(type));
    if (match) return match.long_name;
  }
  return undefined;
}

// GET /api/geocode/place-details?placeId=..&sessiontoken=.. — resolves a
// chosen autocomplete suggestion to a full branch profile: coordinates, a
// display name, and best-effort city/district so picking one suggestion
// can fill the whole branch form in one step.
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
      fields: "geometry,formatted_address,name,address_components",
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
