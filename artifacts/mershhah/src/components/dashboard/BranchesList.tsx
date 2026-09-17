'use client';

import { useState, useMemo, useEffect } from 'react';
import { Pencil, Trash2, MapPin, Phone, Layers, Clock, Link2, X, CheckSquare, AlertTriangle, Check, Loader2, QrCode, Download } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabase';
import { syncPublicPage } from '@/lib/public-pages';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { EditBranchDialog } from './EditBranchDialog';
import { BulkEditDialog } from './BulkEditDialog';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/components/shared/LanguageContext';
import type { Branch } from '@/lib/types';

interface BranchWarning {
  key: string;
  label: string;
}

function getBranchWarnings(branch: Branch, t: (key: string) => string): BranchWarning[] {
  const acknowledged = branch.acknowledged_warnings || [];
  const candidates: BranchWarning[] = [];
  if (!branch.phone) candidates.push({ key: 'no_phone', label: t('branches.warningNoPhone') });
  if (!branch.opening_hours) candidates.push({ key: 'no_hours', label: t('branches.warningNoHours') });
  if (!branch.latitude || !branch.longitude) candidates.push({ key: 'no_location', label: t('branches.warningNoLocation') });
  return candidates.filter((w) => !acknowledged.includes(w.key));
}

interface BranchesListProps {
  branches: Branch[];
  restaurantId: string;
  username?: string | null;
  onChanged?: () => void;
}

export function BranchesList({ branches, restaurantId, username, onChanged }: BranchesListProps) {
  const { toast } = useToast();
  const { t, dir } = useLanguage();
  const [editBranch, setEditBranch] = useState<Branch | null>(null);
  const [deleteBranch, setDeleteBranch] = useState<Branch | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [bulkEditOpen, setBulkEditOpen] = useState(false);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [cityFilter, setCityFilter] = useState<string | null>(null);
  const [acknowledgingKey, setAcknowledgingKey] = useState<string | null>(null);
  const [qrBranch, setQrBranch] = useState<Branch | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

  // Each branch needs its OWN QR code, not one shared code for the whole
  // restaurant - a single QR can't reveal which physical branch it was
  // scanned at, that only works if each branch's printed code encodes its
  // own ?branch=<id> link. Generated lazily (only while this dialog is
  // open for a specific branch) instead of pre-rendering one per branch.
  useEffect(() => {
    if (!qrBranch || !username) { setQrDataUrl(null); return; }
    const link = `${window.location.origin}/${username}?branch=${qrBranch.id}`;
    let cancelled = false;
    import('qrcode').then((QRCode) => {
      QRCode.toDataURL(link, { width: 280, margin: 2 }).then((url) => { if (!cancelled) setQrDataUrl(url); }).catch(() => {});
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [qrBranch, username]);

  const cities = useMemo(
    () => [...new Set(branches.map((b) => b.city).filter(Boolean))] as string[],
    [branches],
  );
  const cityLabel = (city: string) => {
    if (dir !== 'ltr') return city;
    const withEn = branches.find((b) => b.city === city && b.city_en);
    return withEn?.city_en || city;
  };
  const visibleBranches = cityFilter ? branches.filter((b) => b.city === cityFilter) : branches;

  const selectedBranches = branches.filter((b) => selectedIds.has(b.id));

  const toggleSelected = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Select-all only picks up what the current city filter shows, so
  // filtering to one city then hitting select-all doesn't silently pull
  // in every other city's branches too.
  const selectAll = () => setSelectedIds(new Set(visibleBranches.map((b) => b.id)));
  const clearSelection = () => setSelectedIds(new Set());

  const handleAcknowledgeWarning = async (branch: Branch, warningKey: string) => {
    const trackingKey = `${branch.id}:${warningKey}`;
    setAcknowledgingKey(trackingKey);
    try {
      const next = [...(branch.acknowledged_warnings || []), warningKey];
      const { error } = await supabase.from('branches').update({ acknowledged_warnings: next }).eq('id', branch.id);
      if (error) throw error;
      onChanged?.();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      toast({ variant: 'destructive', title: t('common.errorTitle'), description: msg });
    } finally {
      setAcknowledgingKey(null);
    }
  };

  const handleCopyBranchLink = (branch: Branch) => {
    if (!username) return;
    const link = `${window.location.origin}/${username}?branch=${branch.id}`;
    navigator.clipboard.writeText(link);
    toast({ title: t('branches.copiedLinkTitle'), description: t('branches.copiedLinkDesc') });
  };

  const handleDelete = async () => {
    if (!deleteBranch || !restaurantId) return;
    setDeleting(true);
    try {
      const { error } = await supabase
        .from('branches')
        .delete()
        .eq('id', deleteBranch.id)
        .eq('restaurant_id', restaurantId);
      if (error) throw error;
      toast({ title: t('branches.branchDeleted') });
      syncPublicPage(restaurantId).catch(() => {});
      onChanged?.();
      setDeleteBranch(null);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      toast({ variant: 'destructive', title: t('menu.deleteError'), description: msg });
    } finally {
      setDeleting(false);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0 || !restaurantId) return;
    setBulkDeleting(true);
    try {
      const { error } = await supabase
        .from('branches')
        .delete()
        .in('id', Array.from(selectedIds))
        .eq('restaurant_id', restaurantId);
      if (error) throw error;
      toast({ title: `${t('branches.deletedCountPrefix')} ${selectedIds.size} ${t('branches.branchWord')}` });
      syncPublicPage(restaurantId).catch(() => {});
      onChanged?.();
      clearSelection();
      setBulkDeleteOpen(false);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      toast({ variant: 'destructive', title: t('menu.deleteError'), description: msg });
    } finally {
      setBulkDeleting(false);
    }
  };

  if (branches.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
          <MapPin className="h-7 w-7 text-gray-600" />
        </div>
        <p className="text-sm font-medium text-gray-600">{t('branches.noBranchesYet')}</p>
        <p className="text-xs text-gray-600 mt-1">{t('branches.clickAddBranch')}</p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-3">
        {/* City filter */}
        {cities.length > 1 && (
          <div className="flex items-center gap-2">
            <Select value={cityFilter ?? '__all__'} onValueChange={(v) => setCityFilter(v === '__all__' ? null : v)}>
              <SelectTrigger className="h-9 w-auto min-w-[160px] rounded-lg border-gray-200 text-xs">
                <SelectValue placeholder={t('branches.allCitiesFilter')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">{t('branches.allCitiesFilter')}</SelectItem>
                {cities.map((city) => (
                  <SelectItem key={city} value={city}>{cityLabel(city)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Selection bar - only appears once at least one branch is checked */}
        {selectedIds.size > 0 ? (
          <div className="flex items-center justify-between gap-3 flex-wrap bg-gray-900 rounded-xl px-4 py-2.5">
            <div className="flex items-center gap-3">
              <span className="text-xs font-bold text-white">{selectedIds.size} {t('branches.branchSelectedSuffix')}</span>
              {selectedIds.size < visibleBranches.length ? (
                <button onClick={selectAll} className="text-[11px] font-medium text-gray-300 hover:text-white transition-colors">
                  {t('branches.selectAllLabel')} ({visibleBranches.length})
                </button>
              ) : (
                <button onClick={clearSelection} className="text-[11px] font-medium text-gray-300 hover:text-white transition-colors">
                  {t('branches.deselectAll')}
                </button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setBulkEditOpen(true)}
                className="h-8 px-3.5 rounded-lg bg-white text-gray-900 text-xs font-bold hover:bg-gray-100 transition-colors flex items-center gap-1.5"
              >
                <Layers className="h-3.5 w-3.5" />
                {t('branches.bulkEdit')}
              </button>
              <button
                onClick={() => setBulkDeleteOpen(true)}
                className="h-8 px-3.5 rounded-lg bg-red-500 text-white text-xs font-bold hover:bg-red-600 transition-colors flex items-center gap-1.5"
              >
                <Trash2 className="h-3.5 w-3.5" />
                {t('branches.deleteSelectedTitle')}
              </button>
              <button
                onClick={clearSelection}
                title={t('branches.deselect')}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-300 hover:text-white hover:bg-white/10 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        ) : branches.length > 1 ? (
          <p className="text-[11px] text-gray-600 flex items-center gap-1.5 px-0.5">
            <CheckSquare className="h-3 w-3" />
            {t('branches.selectMultipleHint')}
          </p>
        ) : null}

        {/* Branches grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {visibleBranches.map((branch) => {
            const isSelected = selectedIds.has(branch.id);
            const warnings = getBranchWarnings(branch, t);
            return (
              <div
                key={branch.id}
                className={cn(
                  "group relative bg-white border rounded-xl p-4 hover:shadow-sm transition-all",
                  isSelected ? "border-gray-900 ring-1 ring-gray-900" : "border-gray-100 hover:border-gray-200"
                )}
              >
                {/* Header */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <button
                      onClick={() => toggleSelected(branch.id)}
                      title={isSelected ? t('branches.deselect') : t('branches.selectForBulkEdit')}
                      className={cn(
                        "shrink-0 w-5 h-5 rounded-md border flex items-center justify-center transition-colors",
                        isSelected ? "bg-gray-900 border-gray-900 text-white" : "border-gray-300 text-transparent hover:border-gray-400"
                      )}
                    >
                      <svg viewBox="0 0 12 12" className="w-3 h-3" fill="none">
                        <path d="M2 6l2.5 2.5L10 3" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </button>
                    <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center text-sm font-bold text-gray-600 shrink-0">
                      {branch.name?.[0] || t('branches.branchInitial')}
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-sm font-semibold text-gray-900 leading-tight truncate">{branch.name}</h3>
                      <p className="text-[11px] text-gray-600 mt-0.5 truncate">{branch.city} · {branch.district}</p>
                    </div>
                  </div>

                  {/* Status */}
                  <span className={`shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                    branch.status === 'active' ? 'bg-emerald-50 text-emerald-600' : 'bg-gray-100 text-gray-600'
                  }`}>
                    {branch.status === 'active' ? t('common.active') : t('branches.disabled')}
                  </span>
                </div>

                {/* Persistent missing-info warnings - stay until the owner
                    fixes the underlying field or explicitly acknowledges it */}
                {warnings.length > 0 && (
                  <div className="mb-3 space-y-1.5">
                    {warnings.map((w) => {
                      const trackingKey = `${branch.id}:${w.key}`;
                      const isAcking = acknowledgingKey === trackingKey;
                      return (
                        <div key={w.key} className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5">
                          <AlertTriangle className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                          <span className="flex-1 text-[11px] font-medium text-amber-800">{w.label}</span>
                          <button
                            onClick={() => setEditBranch(branch)}
                            className="text-[10px] font-bold text-amber-700 hover:text-amber-900 underline underline-offset-2 shrink-0"
                          >
                            {t('branches.fixNow')}
                          </button>
                          <button
                            onClick={() => handleAcknowledgeWarning(branch, w.key)}
                            disabled={isAcking}
                            title={t('branches.acknowledgeWarning')}
                            className="shrink-0 w-5 h-5 rounded-md flex items-center justify-center text-amber-600 hover:bg-amber-100 disabled:opacity-50"
                          >
                            {isAcking ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Info */}
                <div className="space-y-1.5 mb-3">
                  {branch.phone && (
                    <a href={`tel:${branch.phone}`} className="flex items-center gap-1.5 text-xs text-gray-600 hover:text-gray-900 transition-colors">
                      <Phone className="h-3 w-3 text-gray-600" />
                      {branch.phone}
                    </a>
                  )}
                  {branch.opening_hours && (
                    <div className="flex items-center gap-1.5 text-xs text-gray-600">
                      <Clock className="h-3 w-3 text-gray-600" />
                      <span className="truncate">{branch.opening_hours}</span>
                    </div>
                  )}
                  {branch.address && (
                    <div className="flex items-center gap-1.5 text-xs text-gray-600">
                      <MapPin className="h-3 w-3 text-gray-600 shrink-0" />
                      <span className="truncate">{branch.address}</span>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 pt-2 border-t border-gray-50">
                  <button
                    onClick={() => setEditBranch(branch)}
                    className="flex-1 flex items-center justify-center gap-1.5 h-8 rounded-lg text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    {t('common.edit')}
                  </button>
                  <div className="w-px h-4 bg-gray-100" />
                  <button
                    onClick={() => setDeleteBranch(branch)}
                    className="flex-1 flex items-center justify-center gap-1.5 h-8 rounded-lg text-xs font-medium text-red-500 hover:bg-red-50 transition-colors"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    {t('common.delete')}
                  </button>
                  <div className="w-px h-4 bg-gray-100" />
                  <button
                    onClick={() => handleCopyBranchLink(branch)}
                    disabled={!username}
                    title={t('branches.copyBranchLinkTooltip')}
                    className="w-8 h-8 shrink-0 flex items-center justify-center rounded-lg text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-40"
                  >
                    <Link2 className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => setQrBranch(branch)}
                    disabled={!username}
                    title={t('branches.branchQrTooltip')}
                    className="w-8 h-8 shrink-0 flex items-center justify-center rounded-lg text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-40"
                  >
                    <QrCode className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <BulkEditDialog
        open={bulkEditOpen}
        onOpenChange={setBulkEditOpen}
        branches={selectedBranches}
        restaurantId={restaurantId}
        onSaved={() => { setBulkEditOpen(false); clearSelection(); onChanged?.(); }}
      />

      <EditBranchDialog
        open={Boolean(editBranch)}
        onOpenChange={(open) => !open && setEditBranch(null)}
        branch={editBranch}
        restaurantId={restaurantId}
        onSaved={() => { setEditBranch(null); onChanged?.(); }}
      />

      <Dialog open={Boolean(qrBranch)} onOpenChange={(o) => !o && setQrBranch(null)}>
        <DialogContent className="sm:max-w-sm p-0 gap-0" dir={dir}>
          <div className="px-5 pt-5 pb-3 border-b border-gray-100">
            <h2 className="text-base font-bold text-gray-900">{t('branches.branchQrTitle')}</h2>
            <p className="text-xs text-gray-600 mt-0.5">{qrBranch?.name}</p>
          </div>
          <div className="p-5 flex flex-col items-center gap-3">
            {qrDataUrl ? (
              <>
                <div className="inline-block p-3 bg-white rounded-2xl border border-gray-100">
                  <img src={qrDataUrl} alt={t('branches.branchQrTitle')} className="w-[200px] h-[200px]" />
                </div>
                <div className="flex gap-2 w-full">
                  <button
                    onClick={() => qrBranch && handleCopyBranchLink(qrBranch)}
                    className="flex-1 h-9 rounded-xl border border-gray-200 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors flex items-center justify-center gap-1.5"
                  >
                    <Link2 className="h-3.5 w-3.5" />
                    {t('common.copy')}
                  </button>
                  <button
                    onClick={() => {
                      if (!qrDataUrl || !qrBranch) return;
                      const link = document.createElement('a');
                      link.href = qrDataUrl;
                      link.download = `branch-qr-${qrBranch.name || qrBranch.id}.png`;
                      document.body.appendChild(link); link.click(); link.remove();
                    }}
                    className="flex-1 h-9 rounded-xl bg-gray-900 text-white text-xs font-medium hover:bg-gray-800 transition-colors flex items-center justify-center gap-1.5"
                  >
                    <Download className="h-3.5 w-3.5" />
                    {t('reports.downloadQr')}
                  </button>
                </div>
                <p className="text-[10px] text-gray-500 text-center leading-relaxed">{t('branches.branchQrHint')}</p>
              </>
            ) : (
              <div className="w-[200px] h-[200px] bg-gray-50 border border-gray-100 rounded-2xl animate-pulse flex items-center justify-center text-[10px] text-gray-600">{t('reports.generating')}</div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(deleteBranch)} onOpenChange={(o) => !o && setDeleteBranch(null)}>
        <AlertDialogContent dir={dir} className={dir === 'rtl' ? 'text-right' : 'text-left'}>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('branches.deleteBranchTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('branches.deleteConfirmPrefix')} &quot;{deleteBranch?.name}&quot;{t('branches.deleteConfirmSuffix')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleting} className="bg-destructive hover:bg-destructive/90">
              {deleting ? t('menu.deleting') : t('common.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
        <AlertDialogContent dir={dir} className={dir === 'rtl' ? 'text-right' : 'text-left'}>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('branches.confirmBulkDeleteTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('branches.confirmBulkDeletePrefix')} {selectedIds.size} {t('branches.branchWord')}؟
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={bulkDeleting}>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleBulkDelete} disabled={bulkDeleting} className="bg-destructive hover:bg-destructive/90">
              {bulkDeleting ? t('menu.deleting') : t('common.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
