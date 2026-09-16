'use client';

import { useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Loader2, MapPin, X, Layers, Check, ListPlus, Search } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { syncPublicPage } from '@/lib/public-pages';
import { textSearchPlaces, getPlaceDetails, type TextSearchPlace } from '@/lib/geocoding';
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
// the full single-branch dialog per location.
//
// Uses Places Text Search (via textSearchPlaces), not the Autocomplete
// EditBranchDialog uses for its single-pick search: Autocomplete is a
// per-keystroke typeahead capped at ~5 predictions, far too few for "this
// chain has dozens of branches nationwide". Text Search returns up to 60
// (Google's hard cap, paginated server-side) from one explicit search - a
// deliberate button/Enter action here rather than live-as-you-type, since
// fetching all pages takes a few seconds and costs more per call.
export function BulkAddBranchesDialog({ open, onOpenChange, restaurantId, existingCount, onSaved }: BulkAddBranchesDialogProps) {
  const { toast } = useToast();
  const { user } = useUser();
  const { t, dir } = useLanguage();
  const alignStart = dir === 'rtl' ? 'text-right' : 'text-left';
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<TextSearchPlace[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [queue, setQueue] = useState<QueuedBranch[]>([]);
  const [resolvingPlaceId, setResolvingPlaceId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const maxBranches = user?.entitlements?.maxBranches ?? 1;
  const remainingSlots = Math.max(0, maxBranches - existingCount - queue.length);

  function reset() {
    setQuery('');
    setResults([]);
    setHasSearched(false);
    setQueue([]);
  }

  function handleClose(next: boolean) {
    if (!next) reset();
    onOpenChange(next);
  }

  async function handleSearch() {
    if (!query.trim() || isSearching) return;
    setIsSearching(true);
    try {
      const found = await textSearchPlaces(query);
      setResults(found);
      setHasSearched(true);
    } finally {
      setIsSearching(false);
    }
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

  // Resolves one search result to a full branch and queues it - keeps the
  // results list as-is (no clearing/closing) so the owner can keep picking
  // more branches from the same search instead of starting over.
  async function resolveAndQueue(place: TextSearchPlace): Promise<boolean> {
    setResolvingPlaceId(place.placeId);
    try {
      const result = await getPlaceDetails(place.placeId);
      // city is the branches table's one required location field (NOT
      // NULL) - a result without one can't be queued for a silent insert.
      if (!result || !result.city) {
        toast({ variant: 'destructive', title: t('branches.coordinatesNotFound') });
        return false;
      }
      setQueue((prev) => [...prev, {
        placeId: place.placeId,
        name: result.name || place.name,
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

  // Clicking a queued result again removes it - a quick way to undo a pick
  // without hunting for it in the list below.
  async function handlePick(place: TextSearchPlace) {
    if (queue.some((b) => b.placeId === place.placeId)) {
      removeFromQueue(place.placeId);
      return;
    }
    if (isMaxedOut()) return;
    await resolveAndQueue(place);
  }

  // Queues every not-yet-added result from the current search in one go -
  // the fast path for "this business has several branches, add them all".
  async function handleAddAll() {
    const toAdd = results.filter((p) => !queue.some((b) => b.placeId === p.placeId));
    if (toAdd.length === 0) return;
    const capped = toAdd.slice(0, remainingSlots);
    if (capped.length < toAdd.length) isMaxedOut();
    for (const place of capped) {
      await resolveAndQueue(place);
    }
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
          <div className="flex gap-2">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleSearch(); } }}
              placeholder={t('branches.branchNamePlaceholder')}
              className="h-11 rounded-xl border-gray-200 text-sm flex-1"
              disabled={saving}
            />
            <button type="button" onClick={handleSearch} disabled={isSearching || !query.trim() || saving}
              className="h-11 px-4 rounded-xl bg-gray-900 text-white text-sm font-bold hover:bg-gray-800 transition-colors disabled:opacity-50 flex items-center gap-1.5 shrink-0">
              {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              {t('branches.bulkAddSearchButton')}
            </button>
          </div>

          {isSearching && (
            <p className="text-[11px] text-gray-600">{t('branches.bulkAddSearching')}</p>
          )}

          {!isSearching && hasSearched && results.length === 0 && (
            <p className="text-[11px] text-gray-600">{t('branches.bulkAddNoResults')}</p>
          )}

          {!isSearching && results.length > 0 && (
            <div className="border border-gray-200 rounded-xl max-h-64 overflow-y-auto">
              {results.length > 1 && (
                <button type="button" onClick={handleAddAll}
                  className={`w-full ${alignStart} px-3 py-2 text-xs font-bold text-gray-900 hover:bg-gray-50 transition-colors flex items-center gap-2 border-b border-gray-100`}>
                  <ListPlus className="h-3.5 w-3.5 shrink-0" />
                  {t('branches.bulkAddAllResults')} ({results.length})
                </button>
              )}
              {results.map((p) => {
                const isQueued = queue.some((b) => b.placeId === p.placeId);
                return (
                  <button key={p.placeId} type="button"
                    onClick={() => handlePick(p)}
                    disabled={resolvingPlaceId === p.placeId}
                    className={`w-full ${alignStart} px-3 py-2 transition-colors flex items-center justify-between gap-2 disabled:opacity-50 border-b border-gray-50 last:border-0 ${
                      isQueued ? 'bg-emerald-50' : 'hover:bg-gray-50'
                    }`}>
                    <span className="min-w-0">
                      <span className={`block text-sm font-bold truncate ${isQueued ? 'text-emerald-700' : 'text-gray-900'}`}>{p.name}</span>
                      <span className="block text-[10.5px] text-gray-600 truncate">{p.address}</span>
                    </span>
                    {resolvingPlaceId === p.placeId ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-gray-400 shrink-0" />
                    ) : isQueued ? (
                      <Check className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                    ) : null}
                  </button>
                );
              })}
            </div>
          )}

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
