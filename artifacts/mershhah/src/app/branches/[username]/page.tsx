"use client";

import { useEffect, useState, useMemo } from 'react';
import { useParams } from 'wouter';
import { ChevronRight, MapPin, Phone, Clock, Info, Navigation, MessageCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { getPublicPage } from '@/lib/public-pages';
import { StorageImage } from '@/components/shared/StorageImage';
import { Skeleton } from '@/components/ui/skeleton';

function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export default function PublicBranchesPage() {
  const params = useParams();
  const username = params.username as string;

  const [restaurant, setRestaurant] = useState<any>(null);
  const [branches, setBranches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);

  useEffect(() => {
    if (!username) return;
    setLoading(true);

    const fetchData = async () => {
      try {
        const data = await getPublicPage(username);
        if (data?.restaurant && Array.isArray(data.branches)) {
          setRestaurant(data.restaurant);
          setBranches(data.branches);
          setLoading(false);
          return;
        }

        const { data: rest } = await supabase
          .from('restaurants')
          .select('*')
          .eq('username', username)
          .limit(1)
          .single();

        if (!rest) {
          setRestaurant(null);
          setLoading(false);
          return;
        }

        setRestaurant(rest);

        const { data: branchData } = await supabase
          .from('branches')
          .select('*')
          .eq('restaurant_id', rest.id)
          .eq('status', 'active');

        setBranches(branchData || []);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };

    fetchData();

    const channel = supabase
      .channel(`branches-${username}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'branches' }, fetchData)
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [username]);

  const primaryColor = restaurant?.primaryColor || '#111827';

  const sortedBranches = useMemo(() => {
    if (!userLocation) return branches;
    return [...branches]
      .map((b) => {
        if (b.latitude && b.longitude) {
          return { ...b, distance: haversineDistance(userLocation.lat, userLocation.lng, b.latitude, b.longitude) };
        }
        return { ...b, distance: Infinity };
      })
      .sort((a, b) => (a.distance ?? Infinity) - (b.distance ?? Infinity));
  }, [branches, userLocation]);

  const requestLocation = () => {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocating(false);
      },
      () => setLocating(false),
      { enableHighAccuracy: false, timeout: 5000 }
    );
  };

  useEffect(() => {
    requestLocation();
  }, []);

  const isBranchOpen = (hours?: string | null) => {
    if (!hours) return null;
    try {
      const now = new Date();
      const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
      const today = dayNames[now.getDay()];
      const lower = hours.toLowerCase();
      if (lower.includes(today) || lower.includes('daily') || lower.includes('يومياً') || lower.includes('كل يوم')) {
        return true;
      }
      return null;
    } catch {
      return null;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white" dir="rtl">
        <div className="max-w-lg mx-auto px-5 space-y-8 pt-8">
          <div className="flex flex-col items-center space-y-4">
            <Skeleton className="h-20 w-20 rounded-2xl" />
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-4 w-32" />
          </div>
          <div className="space-y-4">
            {[1,2,3].map(i => (
              <div key={i} className="border border-gray-100 rounded-xl p-5 space-y-4">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-10 w-10 rounded-xl" />
                  <Skeleton className="h-5 w-32" />
                </div>
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-2/3" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!restaurant) {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center bg-white text-center p-6 space-y-5">
        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center text-gray-400">
          <Info size={28} />
        </div>
        <h1 className="text-lg font-bold text-gray-900">المطعم غير موجود</h1>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white pb-16" dir="rtl">

      {/* Header */}
      <div className="max-w-lg mx-auto w-full px-5 pt-6 pb-4 flex items-center justify-between">
        <button
          onClick={() => window.history.back()}
          className="w-9 h-9 rounded-xl flex items-center justify-center text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition-colors"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
        <div className="w-9" />
      </div>

      <div className="max-w-lg mx-auto w-full px-5 pb-6 text-center space-y-3 text-right">
        <div className="relative w-16 h-16 mx-auto rounded-2xl overflow-hidden">
          <StorageImage
            imagePath={restaurant.logo}
            alt={restaurant.name}
            fill
            sizes="64px"
            className="object-cover"
          />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">{restaurant.name}</h1>
          <p className="text-sm text-gray-400 mt-0.5">{branches.length > 0 ? `${branches.length} فروع` : 'الفروع'}</p>
          {userLocation && (
            <p className="text-[10px] text-gray-300 mt-1 flex items-center justify-center gap-1">
              <Navigation className="h-2.5 w-2.5" />
              مرتب حسب القرب منك
            </p>
          )}
        </div>
      </div>

      <div className="max-w-lg mx-auto w-full px-5 space-y-3 text-right" dir="rtl">

        {          branches.length === 0 ? (
          <div className="text-center py-20 space-y-3">
            <MapPin className="h-10 w-10 text-gray-200 mx-auto" />
            <p className="text-sm text-gray-400">لا توجد فروع متاحة</p>
          </div>
        ) : (
          sortedBranches.map((branch: any, index: number) => {
            const isOpen = isBranchOpen(branch.opening_hours);
            const isExpanded = expandedId === branch.id;
            const isNearest = userLocation && index === 0 && branch.distance !== Infinity;

            return (
              <div
                key={branch.id}
                className="border border-gray-100 rounded-xl overflow-hidden transition-all"
                style={isExpanded ? { borderColor: `${primaryColor}30` } : isNearest ? { borderColor: `${primaryColor}20`, backgroundColor: `${primaryColor}03` } : {}}
              >
                {/* Branch Header */}
                <button
                  onClick={() => setExpandedId(isExpanded ? null : branch.id)}
                  className="w-full flex items-center gap-4 p-4 text-right"
                >
                  {/* Number badge */}
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-white text-sm font-bold"
                    style={{ backgroundColor: primaryColor }}
                  >
                    {index + 1}
                  </div>

                  <div className="flex-1 min-w-0 text-right">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-sm font-bold text-gray-900 truncate">{branch.name}</h3>
                      {isNearest && (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full text-white" style={{ backgroundColor: primaryColor }}>
                          الأقرب لك
                        </span>
                      )}
                      {isOpen !== null && (
                        <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${isOpen ? 'bg-emerald-50 text-emerald-600' : 'bg-gray-100 text-gray-400'}`}>
                          {isOpen ? 'مفتوح' : 'مغلق'}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      {(branch.city || branch.district) && (
                        <p className="text-xs text-gray-400 truncate">
                          {[branch.city, branch.district].filter(Boolean).join(' · ')}
                        </p>
                      )}
                      {branch.distance != null && branch.distance !== Infinity && (
                        <span className="text-[10px] text-gray-300 shrink-0">
                          {branch.distance < 1 ? `${Math.round(branch.distance * 1000)} م` : `${branch.distance.toFixed(1)} كم`}
                        </span>
                      )}
                    </div>
                  </div>

                  <ChevronRight
                    className="h-4 w-4 text-gray-300 shrink-0 transition-transform duration-200"
                    style={isExpanded ? { transform: 'rotate(-90deg)' } : {}}
                  />
                </button>

                {/* Expanded Content */}
                {isExpanded && (
                  <div className="px-4 pb-4 space-y-3 border-t border-gray-50 text-right">
                    {branch.address && (
                      <div className="flex items-start gap-2.5 pt-3">
                        <MapPin className="h-3.5 w-3.5 text-gray-300 mt-0.5 shrink-0" />
                        <p className="text-xs text-gray-500 leading-relaxed">{branch.address}</p>
                      </div>
                    )}

                    {branch.opening_hours && (
                      <div className="flex items-center gap-2.5">
                        <Clock className="h-3.5 w-3.5 text-gray-300 shrink-0" />
                        <p className="text-xs text-gray-500">{branch.opening_hours}</p>
                      </div>
                    )}

                    <div className="flex gap-2 pt-1">
                      {branch.phone ? (
                        <a
                          href={`https://wa.me/${branch.phone.replace(/[^0-9]/g, '')}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex-1 flex items-center justify-center gap-2 h-9 rounded-lg bg-[#25D366]/10 text-[#25D366] text-xs font-semibold hover:bg-[#25D366]/20 transition-colors"
                        >
                          <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                          </svg>
                          واتساب
                        </a>
                      ) : null}

                      {(branch.google_maps_url || (branch.latitude && branch.longitude)) ? (
                        <a
                          href={branch.google_maps_url || `https://www.google.com/maps/dir/?api=1&destination=${branch.latitude},${branch.longitude}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex-1 flex items-center justify-center gap-2 h-9 rounded-lg text-xs font-semibold text-white transition-opacity hover:opacity-90"
                          style={{ backgroundColor: primaryColor }}
                        >
                          <Navigation className="h-3.5 w-3.5" />
                          الذهاب
                        </a>
                      ) : null}

                      {branch.phone ? (
                        <a
                          href={`tel:${branch.phone}`}
                          className="flex-1 flex items-center justify-center gap-2 h-9 rounded-lg bg-gray-50 text-xs font-semibold text-gray-600 hover:bg-gray-100 transition-colors"
                        >
                          <Phone className="h-3.5 w-3.5" />
                          اتصل
                        </a>
                      ) : null}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
