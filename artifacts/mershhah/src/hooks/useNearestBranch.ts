import { useMemo, useState } from 'react';
import { haversineDistanceKm } from '@/lib/geo-distance';

export type NearestBranchPhase = 'idle' | 'locating' | 'located' | 'denied';

// Shared with the hub page's nearest-branch card: same permission-on-tap
// flow (never auto-prompts), same Haversine sort. Any page that needs to
// know "which branch is this visitor closest to" uses this hook instead
// of re-implementing the geolocation dance.
export function useNearestBranch(branches: any[]) {
  const [phase, setPhase] = useState<NearestBranchPhase>('idle');
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);

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
        setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setPhase('located');
      },
      () => setPhase('denied'),
      { enableHighAccuracy: false, timeout: 8000 }
    );
  };

  const nearestBranch = phase === 'located' ? (sortedBranches[0] ?? null) : (branches[0] ?? null);

  return { phase, sortedBranches, nearestBranch, requestLocation };
}
