import { useEffect, useMemo, useState } from 'react';
import { haversineDistanceKm } from '@/lib/geo-distance';

export type NearestBranchPhase = 'idle' | 'locating' | 'located' | 'denied';

const STORAGE_KEY = 'mershhah_visitor_location';
const STALE_AFTER_MS = 30 * 60 * 1000;

type StoredLocation = { lat: number; lng: number; savedAt: number };

// A location saved on one public page (hub/menu/branches) should still be
// there on the next one instead of asking the visitor to grant it again
// every time they navigate - sessionStorage so it doesn't outlive the
// visit, and a 30-minute staleness window since someone genuinely on the
// move could otherwise keep matching to a branch near where they started.
function readStoredLocation(): { lat: number; lng: number } | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredLocation;
    if (Date.now() - parsed.savedAt > STALE_AFTER_MS) return null;
    return { lat: parsed.lat, lng: parsed.lng };
  } catch {
    return null;
  }
}

function writeStoredLocation(lat: number, lng: number): void {
  try {
    const entry: StoredLocation = { lat, lng, savedAt: Date.now() };
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(entry));
  } catch {
    // Private-browsing or storage disabled - the location still works for
    // this page, it just won't carry over to the next one.
  }
}

// Shared with the hub page's nearest-branch card: same permission-on-tap
// flow (never auto-prompts), same Haversine sort. Any page that needs to
// know "which branch is this visitor closest to" uses this hook instead
// of re-implementing the geolocation dance.
export function useNearestBranch(branches: any[]) {
  const [phase, setPhase] = useState<NearestBranchPhase>('idle');
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    const stored = readStoredLocation();
    if (stored) {
      setUserLocation(stored);
      setPhase('located');
    }
  }, []);

  const sortedBranches = useMemo(() => {
    if (!userLocation) return branches;
    return [...branches]
      .map((b) => ({
        ...b,
        distance: b.latitude && b.longitude
          ? haversineDistanceKm(userLocation.lat, userLocation.lng, b.latitude, b.longitude)
          : Infinity,
      }))
      .sort((a, b) => (a.distance ?? Infinity) - (b.distance ?? Infinity));
  }, [branches, userLocation]);

  const requestLocation = () => {
    if (!navigator.geolocation) { setPhase('denied'); return; }
    setPhase('locating');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        setUserLocation({ lat, lng });
        setPhase('located');
        writeStoredLocation(lat, lng);
      },
      () => setPhase('denied'),
      { enableHighAccuracy: false, timeout: 8000 }
    );
  };

  const nearestBranch = phase === 'located' ? (sortedBranches[0] ?? null) : (branches[0] ?? null);

  return { phase, sortedBranches, nearestBranch, requestLocation };
}
