'use client';

import { useMemo, useState } from 'react';
import { Link } from 'wouter';
import { MapPin, Navigation, Phone, ShoppingBag, Locate } from 'lucide-react';
import { StorageImage } from '@/components/shared/StorageImage';
import { useLanguage } from '@/components/shared/LanguageContext';
import { trackAppClick, trackMapsClick, trackPhoneClick } from '@/lib/event-tracker';
import { haversineDistanceKm } from '@/lib/geo-distance';
import { isBranchOpenNow } from '@/lib/branch-hours';

interface NearestBranchSectionProps {
  branches: any[];
  restaurantId?: string;
  primaryColor: string;
  username?: string;
}

type LocationPhase = 'idle' | 'locating' | 'located' | 'denied';

export function NearestBranchSection({ branches, restaurantId, primaryColor, username }: NearestBranchSectionProps) {
  const { t, dir } = useLanguage();
  const alignStart = dir === 'rtl' ? 'text-right' : 'text-left';
  const [phase, setPhase] = useState<LocationPhase>('idle');
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [expandedAppsId, setExpandedAppsId] = useState<string | null>(null);

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

  if (branches.length === 0) return null;

  const formatDistance = (distanceKm?: number) => {
    if (distanceKm == null || distanceKm === Infinity) return null;
    return distanceKm < 1
      ? `${Math.round(distanceKm * 1000)} ${t('publicBranches.meterSuffix')}`
      : `${distanceKm.toFixed(1)} ${t('publicBranches.kmSuffix')}`;
  };

  const sortedApps = (apps: any[]) =>
    [...(apps || [])].sort((a, b) => (a.name || '').localeCompare(b.name || '', 'ar'));

  const renderActions = (branch: any) => (
    <div className="flex gap-2">
      {branch.applications?.length > 0 && (
        <button
          type="button"
          onClick={() => setExpandedAppsId((current) => (current === branch.id ? null : branch.id))}
          className="flex-1 flex items-center justify-center gap-1.5 h-10 rounded-xl text-xs font-bold transition-opacity hover:opacity-90"
          style={{ backgroundColor: primaryColor, color: 'var(--r-button-text)' }}
        >
          <ShoppingBag className="h-3.5 w-3.5" />
          {t('publicBranches.deliveryApps')}
        </button>
      )}
      {branch.latitude && branch.longitude && (
        <a
          href={`https://www.google.com/maps/dir/?api=1&destination=${branch.latitude},${branch.longitude}`}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => restaurantId && trackMapsClick(restaurantId)}
          className="flex-1 flex items-center justify-center gap-1.5 h-10 rounded-xl bg-gray-50 border border-gray-100 text-xs font-bold text-gray-700 hover:bg-gray-100 transition-colors"
        >
          <Navigation className="h-3.5 w-3.5" />
          {t('publicBranches.goToLocation')}
        </a>
      )}
      {branch.phone && (
        <a
          href={`tel:${branch.phone}`}
          onClick={() => restaurantId && trackPhoneClick(restaurantId)}
          className="flex-1 flex items-center justify-center gap-1.5 h-10 rounded-xl bg-gray-50 border border-gray-100 text-xs font-bold text-gray-700 hover:bg-gray-100 transition-colors"
        >
          <Phone className="h-3.5 w-3.5" />
          {t('publicBranches.call')}
        </a>
      )}
    </div>
  );

  const renderBranchCard = (branch: any, isNearest: boolean) => {
    const isOpen = isBranchOpenNow(branch.opening_hours);
    const distanceLabel = formatDistance(branch.distance);
    const addressLine = branch.address || [branch.city, branch.district].filter(Boolean).join(' · ');
    return (
      <div
        key={branch.id}
        className="bg-white border p-4 space-y-3"
        style={{ borderRadius: 'var(--r-radius)', borderColor: isNearest ? `${primaryColor}30` : 'var(--r-border, #f3f4f6)' }}
      >
        <div className={alignStart}>
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-sm font-black text-gray-900">{branch.name}</h3>
            {isNearest && (
              <span
                className="text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0"
                style={{ backgroundColor: primaryColor, color: 'var(--r-button-text)' }}
              >
                {t('publicBranches.nearestBadge')}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            {distanceLabel && <span className="text-[10px] font-semibold text-gray-600">{distanceLabel}</span>}
            {isOpen !== null && (
              <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${isOpen ? 'bg-emerald-50 text-emerald-600' : 'bg-gray-100 text-gray-600'}`}>
                {isOpen ? t('publicBranches.openNow') : t('publicBranches.closedNow')}
              </span>
            )}
          </div>
          {addressLine && <p className="text-xs text-gray-600 mt-1.5 line-clamp-1">{addressLine}</p>}
        </div>
        {renderActions(branch)}
        {expandedAppsId === branch.id && (
          <div className="grid grid-cols-4 gap-2 pt-1">
            {sortedApps(branch.applications).map((app: any, idx: number) => (
              <a
                key={app.id || idx}
                href={app.value || '#'}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => restaurantId && trackAppClick(restaurantId, app.name || 'unknown')}
                className="aspect-square bg-gray-50 border border-gray-100 p-2 flex flex-col items-center justify-center gap-1 hover:bg-gray-100 transition-colors"
                style={{ borderRadius: 'var(--r-radius-sm)' }}
              >
                <div className="relative w-full flex-1">
                  <StorageImage imagePath={app.logo} alt={app.name} fill className="object-contain" sizes="56px" />
                </div>
                <span className="text-[8px] font-semibold text-gray-600 text-center line-clamp-1">{app.name}</span>
              </a>
            ))}
          </div>
        )}
      </div>
    );
  };

  const nearestTwo = sortedBranches.slice(0, 2);
  const hasMoreBranches = sortedBranches.length > 2;

  return (
    <section className={`space-y-3 ${alignStart}`}>
      <div className="flex items-center gap-2 px-1">
        <MapPin className="h-3.5 w-3.5 text-gray-600" />
        <h3 className="font-black text-sm text-gray-600">
          {phase === 'located' ? t('publicBranches.nearestBranchTitle') : t('hubPage.branches')}
        </h3>
      </div>

      {branches.length === 1 ? (
        renderBranchCard(branches[0], false)
      ) : phase === 'idle' ? (
        <button
          type="button"
          onClick={requestLocation}
          className="w-full flex items-center justify-center gap-2 h-12 rounded-xl border-2 border-dashed text-sm font-bold transition-colors"
          style={{ borderColor: `${primaryColor}40`, color: primaryColor }}
        >
          <Locate className="h-4 w-4" />
          {t('publicBranches.showNearestBranch')}
        </button>
      ) : phase === 'locating' ? (
        <div className="w-full flex items-center justify-center gap-2 h-12 rounded-xl border-2 border-dashed border-gray-200 text-sm font-bold text-gray-600">
          <Locate className="h-4 w-4 animate-pulse" />
          {t('publicBranches.locating')}
        </div>
      ) : phase === 'located' ? (
        <div className="space-y-3">
          {nearestTwo.map((b, index) => renderBranchCard(b, index === 0))}
          {hasMoreBranches && username && (
            <Link
              href={`/branches/${username}`}
              className="text-xs font-bold underline underline-offset-2 mx-auto block w-fit"
              style={{ color: primaryColor }}
            >
              {t('publicBranches.viewAllBranches')}
            </Link>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-bold text-gray-600">{t('publicBranches.chooseBranchManually')}</p>
            <button
              type="button"
              onClick={requestLocation}
              className="text-[10px] font-bold flex items-center gap-1 shrink-0"
              style={{ color: primaryColor }}
            >
              <Locate className="h-3 w-3" />
              {t('publicBranches.enableLocation')}
            </button>
          </div>
          <div className="space-y-3">
            {branches.map((b) => renderBranchCard(b, false))}
          </div>
        </div>
      )}
    </section>
  );
}
