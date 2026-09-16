'use client';

import { useRef, useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Loader2, MapPin, X, Layers, Check, ListPlus } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { syncPublicPage } from '@/lib/public-pages';
import { createPlacesSessionToken, autocompletePlaces, getPlaceDetails, type PlaceSuggestion } from '@/lib/geocoding';
import { useUser } from '@/hooks/useUser';
import { useLanguage } from '@/components/shared/LanguageContext';

interface QueuedBranch {
  placeId: string;
  name: string;
  city: string;
  district: string;
  phone?: string;
  latitude?: number | null;
  longitude?: number | null;
}

interface BulkAddBranchesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  restaurantId: string;
  existingCount: number;
  onSaved?: () => void;
}

// Lets an owner with many locations search and queue up several branches -
// one search batch at a time (e.g. every Jeddah location, then every Riyadh
// one) - before saving them all in a single insert, instead of repeating
// the full single-branch dialog per location. Reuses the same real Google
// Places autocomplete/details as EditBranchDialog's branch-name search.
export function BulkAddBranchesDialog({ open, onOpenChange, restaurantId, existingCount, onSaved }: BulkAddBranchesDialogProps) {
  const { toast } = useToast();
  const { user } = useUser();
  const { t, dir } = useLanguage();
  const alignStart = dir === 'rtl' ? 'text-right' : 'text-left';
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [resultsOpen, setResultsOpen] = useState(false);
  const [queue, setQueue] = useState<QueuedBranch[]>([]);
  const [resolvingPlaceId, setResolvingPlaceId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const sessionTokenRef = useRef(createPlacesSessionToken());
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const maxBranches = user?.entitlements?.maxBranches ?? 1;
  const remainingSlots = Math.max(0, maxBranches - existingCount - queue.length);

  function reset() {
    setQuery('');
    setSuggestions([]);
    setQueue([]);
    sessionTokenRef.current = createPlacesSessionToken();
  }

  function handleClose(next: boolean) {
    if (!next) reset();
    onOpenChange(next);
  }

  function handleQueryChange(value: string) {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!value.trim()) { setSuggestions([]); return; }
    debounceRef.current = setTimeout(async () => {
      setIsSearching(true);
      try {
        const results = await autocompletePlaces(value, sessionTokenRef.current);
        setSuggestions(results);
      } finally {
        setIsSearching(false);
      }
    }, 300);
  }

  function isMaxedOut() {
    if (remainingSlots > 0) return false;
    toast({
      variant: 'destructive',
      title: t('branches.maxBranchesReached'),
      description: `${t('branches.currentPlanPrefix')} (${user?.entitlements?.planName || ''}) ${t('branches.allowsMax')} ${maxBranches} ${t('branches.branchWord')}. ${t('branches.upgradeForMore')}`,
    });
    return true;
  }

  // Resolves one suggestion to a full branch and queues it, WITHOUT closing
  // the results list or clearing the search - a query for a chain's name
  // (e.g. "ماكدونالدز الرياض") legitimately matches several of its real
  // branches at once, and picking one used to wipe the list, forcing the
  // owner to retype the exact same search just to reach the next branch.
  async function resolveAndQueue(suggestion: PlaceSuggestion): Promise<boolean> {
    setResolvingPlaceId(suggestion.placeId);
    try {
      const result = await getPlaceDetails(suggestion.placeId, sessionTokenRef.current);
      // city is the branches table's one required location field (NOT
      // NULL) - a result without one can't be queued for a silent insert.
      if (!result || !result.city) {
        toast({ variant: 'destructive', title: t('branches.coordinatesNotFound') });
        return false;
      }
      const name = result.name || suggestion.description.split(/[،,]/)[0].trim();
      setQueue((prev) => [...prev, {
        placeId: suggestion.placeId,
        name,
        city: result.city!,
        district: result.district || '',
        phone: result.phone,
        latitude: result.latitude,
        longitude: result.longitude,
      }]);
      return true;
    } finally {
      setResolvingPlaceId(null);
    }
  }

  // Clicking a queued suggestion again removes it - a quick way to undo a
  // pick without hunting for it in the list below.
  async function handlePick(suggestion: PlaceSuggestion) {
    if (queue.some((b) => b.placeId === suggestion.placeId)) {
      removeFromQueue(suggestion.placeId);
      return;
    }
    if (isMaxedOut()) return;
    await resolveAndQueue(suggestion);
    sessionTokenRef.current = createPlacesSessionToken();
  }

  // Queues every not-yet-added result from the current search in one go -
  // the fast path for "this business name has several branches, add them
  // all" instead of clicking each one individually.
  async function handleAddAll() {
    const toAdd = suggestions.filter((s) => !queue.some((b) => b.placeId === s.placeId));
    if (toAdd.length === 0) return;
    const capped = toAdd.slice(0, remainingSlots);
    if (capped.length < toAdd.length) isMaxedOut();
    for (const suggestion of capped) {
      await resolveAndQueue(suggestion);
    }
    sessionTokenRef.current = createPlacesSessionToken();
  }

  function removeFromQueue(placeId: string) {
    setQueue((prev) => prev.filter((b) => b.placeId !== placeId));
  }

  async function handleSaveAll() {
    if (!restaurantId || queue.length === 0) return;
    setSaving(true);
    try {
      const rows = queue.map((b) => ({
        id: crypto.randomUUID(),
        restaurant_id: restaurantId,
        name: b.name,
        city: b.city,
        district: b.district || null,
        status: 'active' as const,
        ...(b.phone ? { phone: b.phone } : {}),
        ...(b.latitude != null ? { latitude: b.latitude } : {}),
        ...(b.longitude != null ? { longitude: b.longitude } : {}),
      }));
      const { error } = await supabase.from('branches').insert(rows);
      if (error) throw error;
      toast({ title: `${t('branches.bulkAddSuccessPrefix')} ${queue.length} ${t('branches.branchWord')}` });
      syncPublicPage(restaurantId).catch(() => {});
      onSaved?.();
      handleClose(false);
    } catch (e: unknown) {
      toast({ variant: 'destructive', title: t('common.errorTitle'), description: e instanceof Error ? e.message : String(e) });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg max-h-[92vh] overflow-y-auto p-0 gap-0" dir={dir}>
        <div className="px-5 pt-5 pb-3 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center">
              <Layers className="h-5 w-5 text-gray-600" />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900">{t('branches.bulkAddTitle')}</h2>
              <p className="text-xs text-gray-600 mt-0.5">{t('branches.bulkAddDesc')}</p>
            </div>
          </div>
        </div>

        <div className="p-5 space-y-4">
          <div className="relative">
            <Input
              value={query}
              onChange={(e) => handleQueryChange(e.target.value)}
              onFocus={() => setResultsOpen(true)}
              onBlur={() => setTimeout(() => setResultsOpen(false), 200)}
              placeholder={t('branches.branchNamePlaceholder')}
              className="h-11 rounded-xl border-gray-200 text-sm"
              disabled={saving}
            />
            {isSearching && (
              <Loader2 className="absolute end-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-gray-400" />
            )}
            {resultsOpen && suggestions.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-50 max-h-64 overflow-y-auto">
                {suggestions.length > 1 && (
                  <button type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={handleAddAll}
                    className={`w-full ${alignStart} px-3 py-2 text-xs font-bold text-gray-900 hover:bg-gray-50 transition-colors flex items-center gap-2 border-b border-gray-100`}>
                    <ListPlus className="h-3.5 w-3.5 shrink-0" />
                    {t('branches.bulkAddAllResults')}
                  </button>
                )}
                {suggestions.map((s) => {
                  const isQueued = queue.some((b) => b.placeId === s.placeId);
                  return (
                    <button key={s.placeId} type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => handlePick(s)}
                      disabled={resolvingPlaceId === s.placeId}
                      className={`w-full ${alignStart} px-3 py-2 text-sm transition-colors flex items-center justify-between gap-2 disabled:opacity-50 ${
                        isQueued ? 'bg-emerald-50 text-emerald-700' : 'text-gray-700 hover:bg-gray-50'
                      }`}>
                      <span className="truncate">{s.description}</span>
                      {resolvingPlaceId === s.placeId ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin text-gray-400 shrink-0" />
                      ) : isQueued ? (
                        <Check className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                      ) : null}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <p className="text-[11px] font-bold text-gray-600">
              {queue.length > 0 ? `${queue.length} ${t('branches.bulkAddQueuedSuffix')}` : t('branches.bulkAddQueueEmpty')}
            </p>
            {queue.length > 0 && (
              <div className="space-y-1.5 max-h-64 overflow-y-auto">
                {queue.map((b) => (
                  <div key={b.placeId} className="flex items-center gap-2 bg-gray-50 border border-gray-100 rounded-xl px-3 py-2">
                    <MapPin className="h-3.5 w-3.5 text-gray-600 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-gray-900 truncate">{b.name}</p>
                      <p className="text-[10px] text-gray-600 truncate">{[b.district, b.city].filter(Boolean).join('، ') || '—'}</p>
                    </div>
                    <button type="button" onClick={() => removeFromQueue(b.placeId)} className="text-gray-600 hover:text-red-500 transition-colors p-1 shrink-0">
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {remainingSlots <= 0 && (
            <p className="text-[11px] text-red-500">
              {t('branches.currentPlanPrefix')} ({user?.entitlements?.planName || ''}) {t('branches.allowsMax')} {maxBranches} {t('branches.branchWord')}. {t('branches.upgradeForMore')}
            </p>
          )}

          <div className="flex flex-wrap gap-2 pt-2">
            <button type="button" onClick={() => handleClose(false)}
              className="flex-1 h-11 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors">
              {t('common.cancel')}
            </button>
            <button type="button" onClick={handleSaveAll} disabled={saving || queue.length === 0}
              className="flex-1 h-11 rounded-xl bg-gray-900 text-white text-sm font-medium hover:bg-gray-800 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {saving
                ? t('common.saving')
                : queue.length > 0
                ? `${t('branches.bulkAddSubmitPrefix')} ${queue.length} ${t('branches.branchWord')}`
                : t('branches.bulkAddSubmitPrefix')}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
