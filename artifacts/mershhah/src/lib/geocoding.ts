const NOMINATIM_URL = 'https://nominatim.openstreetmap.org';

interface GeocodingResult {
  latitude: number;
  longitude: number;
  displayName: string;
}

// ── Extract coordinates from any Google Maps URL ────────────────────────────

function extractCoordsFromUrl(url: string): { latitude: number; longitude: number } | null {
  // Pattern 1: /maps/@lat,lng,zoom
  const atMatch = url.match(/@(-?\d+\.?\d*),(-?\d+\.?\d*)/);
  if (atMatch) return { latitude: parseFloat(atMatch[1]), longitude: parseFloat(atMatch[2]) };

  // Pattern 2: ?q=lat,lng or &q=lat,lng
  const qMatch = url.match(/[?&]q=(-?\d+\.?\d*),(-?\d+\.?\d*)/);
  if (qMatch) return { latitude: parseFloat(qMatch[1]), longitude: parseFloat(qMatch[2]) };

  // Pattern 3: !3d and !4d (embedded in encoded URLs)
  const embedMatch = url.match(/!3d(-?\d+\.?\d*)!4d(-?\d+\.?\d*)/);
  if (embedMatch) return { latitude: parseFloat(embedMatch[1]), longitude: parseFloat(embedMatch[2]) };

  return null;
}

async function resolveShortUrl(url: string): Promise<string> {
  try {
    const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;
    const res = await fetch(proxyUrl, { redirect: 'follow' });
    if (res.ok) {
      const text = await res.text();
      // allorigins returns the final page HTML, look for coordinates in it
      const coords = extractCoordsFromUrl(text);
      if (coords) return `resolved://${coords.latitude},${coords.longitude}`;
      return text;
    }
    return url;
  } catch {
    return url;
  }
}

export async function extractFromGoogleMapsUrl(url: string): Promise<GeocodingResult | null> {
  if (!url) return null;

  const isUrl = url.includes('google.com/maps') || url.includes('maps.app.goo.gl') || url.includes('goo.gl/maps');
  if (!isUrl) return null;

  try {
    let resolvedUrl = url;
    if (url.includes('maps.app.goo.gl') || url.includes('goo.gl/maps')) {
      resolvedUrl = await resolveShortUrl(url);
      // If resolved to our marker format
      if (resolvedUrl.startsWith('resolved://')) {
        const [lat, lng] = resolvedUrl.replace('resolved://', '').split(',');
        const latNum = parseFloat(lat);
        const lngNum = parseFloat(lng);
        const address = await reverseGeocode(latNum, lngNum);
        return { latitude: latNum, longitude: lngNum, displayName: address || `${latNum}, ${lngNum}` };
      }
    }

    const coords = extractCoordsFromUrl(resolvedUrl);
    if (!coords) return null;

    const address = await reverseGeocode(coords.latitude, coords.longitude);
    return {
      latitude: coords.latitude,
      longitude: coords.longitude,
      displayName: address || `${coords.latitude}, ${coords.longitude}`,
    };
  } catch (error) {
    console.error('Google Maps URL parsing error:', error);
    return null;
  }
}

// ── Address → Coordinates ───────────────────────────────────────────────────

export async function geocodeAddress(address: string): Promise<GeocodingResult | null> {
  if (!address || address.trim().length < 3) return null;

  try {
    const params = new URLSearchParams({
      q: address,
      format: 'json',
      limit: '1',
      'accept-language': 'ar,en',
    });

    const res = await fetch(`${NOMINATIM_URL}/search?${params}`, {
      headers: { 'User-Agent': 'MershhahApp/1.0' },
    });

    const data = await res.json();
    if (!data || data.length === 0) return null;

    return {
      latitude: parseFloat(data[0].lat),
      longitude: parseFloat(data[0].lon),
      displayName: data[0].display_name,
    };
  } catch (error) {
    console.error('Geocoding error:', error);
    return null;
  }
}

// ── Coordinates → Address ───────────────────────────────────────────────────

export async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
  try {
    const params = new URLSearchParams({
      lat: String(lat),
      lon: String(lng),
      format: 'json',
      'accept-language': 'ar,en',
    });

    const res = await fetch(`${NOMINATIM_URL}/reverse?${params}`, {
      headers: { 'User-Agent': 'MershhahApp/1.0' },
    });

    const data = await res.json();
    return data?.display_name || null;
  } catch (error) {
    console.error('Reverse geocoding error:', error);
    return null;
  }
}
