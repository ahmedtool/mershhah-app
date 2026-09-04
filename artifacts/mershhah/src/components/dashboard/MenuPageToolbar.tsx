'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { PlusCircle, UploadCloud, Sparkles, RefreshCw, Tag, Library, MoreHorizontal, Loader2, X } from 'lucide-react';
import { EditMenuItemDialog } from './EditMenuItemDialog';
import { ImportMenuDialog } from './ImportMenuDialog';
import { AddFromLibraryDialog } from './AddFromLibraryDialog';
import { ManageCategoriesDialog } from './ManageCategoriesDialog';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/components/shared/LanguageContext';
import type { MenuItem } from '@/lib/types';

type ActionButtonProps = {
  icon: React.ElementType;
  label: string;
  description: string;
  onClick?: () => void;
  disabled?: boolean;
  spinning?: boolean;
  variant: 'bar' | 'menu';
};

// "bar" = compact pill shown inline in the toolbar (desktop expand or the
// two always-visible actions). "menu" = a fuller row with a description,
// used in the mobile dropdown.
function ActionButton({ icon: Icon, label, description, onClick, disabled, spinning, variant }: ActionButtonProps) {
  if (variant === 'bar') {
    return (
      <button
        onClick={onClick}
        disabled={disabled}
        title={description}
        className="h-9 px-3.5 rounded-xl border border-gray-200 text-xs font-bold text-gray-600 hover:bg-gray-50 hover:border-gray-300 active:scale-[0.97] transition-all duration-200 disabled:opacity-50 flex items-center gap-1.5 shrink-0 whitespace-nowrap"
      >
        {spinning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Icon className="h-3.5 w-3.5" />}
        {label}
      </button>
    );
  }
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="w-full flex items-start gap-3 px-3 py-2.5 rounded-xl hover:bg-gray-50 active:bg-gray-100 transition-colors text-right disabled:opacity-50"
    >
      <div className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center shrink-0">
        {spinning ? <Loader2 className="h-4 w-4 text-gray-600 animate-spin" /> : <Icon className="h-4 w-4 text-gray-600" />}
      </div>
      <div className="min-w-0">
        <p className="text-xs font-bold text-gray-900">{label}</p>
        <p className="text-[10.5px] text-gray-600 mt-0.5 leading-relaxed">{description}</p>
      </div>
    </button>
  );
}

type MenuPageToolbarProps = {
  restaurantId?: string;
  userId?: string;
  disabled: boolean;
  rawMenuItems: MenuItem[];
  menuItemsCount: number;
  isApplyingSort: boolean;
  isRefreshing: boolean;
  onApplySmartSort: () => void;
  onRefresh: () => void;
  onSave: () => void;
};

export function MenuPageToolbar({
  restaurantId, userId, disabled, rawMenuItems, menuItemsCount,
  isApplyingSort, isRefreshing, onApplySmartSort, onRefresh, onSave,
}: MenuPageToolbarProps) {
  const { t } = useLanguage();
  const [expanded, setExpanded] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const extras = [
    {
      key: 'sort',
      icon: Sparkles,
      label: t('menu.smartSort'),
      description: t('menu.smartSortTooltip'),
      onClick: onApplySmartSort,
      spinning: isApplyingSort,
      disabled: isApplyingSort || disabled,
    },
    {
      key: 'refresh',
      icon: RefreshCw,
      label: t('menu.refresh'),
      description: t('menu.refreshTooltip'),
      onClick: onRefresh,
      spinning: isRefreshing,
      disabled: isRefreshing || disabled,
    },
  ];

  return (
    <div className="flex items-center gap-2">
      {/* Primary action */}
      <EditMenuItemDialog restaurantId={restaurantId} userId={userId} onSave={onSave} itemCount={menuItemsCount} menuItems={rawMenuItems}>
        <button
          disabled={disabled}
          title={t('menu.addNewDishTooltip')}
          className="h-9 px-4 rounded-xl bg-gray-900 text-white text-xs font-bold hover:bg-gray-800 active:scale-[0.97] transition-all duration-200 disabled:opacity-50 flex items-center gap-2 shrink-0"
        >
          <PlusCircle className="h-3.5 w-3.5" />
          {t('menu.newDish')}
        </button>
      </EditMenuItemDialog>

      {/* Secondary action - always visible */}
      <ImportMenuDialog restaurantId={restaurantId} onSave={onSave}>
        <button
          disabled={disabled}
          title={t('menu.importTooltip')}
          className="h-9 px-3.5 rounded-xl border border-gray-200 text-xs font-bold text-gray-600 hover:bg-gray-50 hover:border-gray-300 active:scale-[0.97] transition-all duration-200 disabled:opacity-50 flex items-center gap-1.5 shrink-0 whitespace-nowrap"
        >
          <UploadCloud className="h-3.5 w-3.5" />
          {t('menu.importFromImage')}
        </button>
      </ImportMenuDialog>

      {/* Desktop: extras expand inline within the same bar. The extra
          buttons stay mounted always and are just clipped/faded via the
          wrapper's own width+opacity animation - conditionally mounting
          them via AnimatePresence's exit tracking left invisible buttons
          stuck in the DOM (their exit styles applied, but never unmounted). */}
      <div className="hidden md:flex items-center gap-2">
        <motion.div
          animate={{ maxWidth: expanded ? 640 : 0, opacity: expanded ? 1 : 0 }}
          transition={{ duration: 0.3, ease: 'easeInOut' }}
          className={cn("flex items-center gap-2 overflow-hidden", !expanded && "pointer-events-none")}
          aria-hidden={!expanded}
        >
          {extras.map((a) => (
            <ActionButton key={a.key} icon={a.icon} label={a.label} description={a.description}
              onClick={() => { a.onClick(); setExpanded(false); }} disabled={a.disabled} spinning={a.spinning} variant="bar" />
          ))}
          <ManageCategoriesDialog restaurantId={restaurantId || ''} menuItems={rawMenuItems} onSave={onSave}>
            <ActionButton icon={Tag} label={t('menu.categories')} description={t('menu.categoriesTooltip')} disabled={disabled}
              onClick={() => setExpanded(false)} variant="bar" />
          </ManageCategoriesDialog>
          <AddFromLibraryDialog restaurantId={restaurantId} onSave={onSave} itemCount={menuItemsCount} menuItems={rawMenuItems}>
            <ActionButton icon={Library} label={t('menu.fromLibrary')} description={t('menu.fromLibraryTooltip')} disabled={disabled}
              onClick={() => setExpanded(false)} variant="bar" />
          </AddFromLibraryDialog>
        </motion.div>
        <button
          onClick={() => setExpanded((v) => !v)}
          title={t('menu.moreTools')}
          className={cn(
            "h-9 w-9 rounded-xl border flex items-center justify-center shrink-0 transition-all duration-200 active:scale-[0.97]",
            expanded ? "bg-gray-900 border-gray-900 text-white" : "border-gray-200 text-gray-600 hover:bg-gray-50 hover:border-gray-300"
          )}
        >
          {expanded ? <X className="h-4 w-4" /> : <MoreHorizontal className="h-4 w-4" />}
        </button>
      </div>

      {/* Mobile: extras collapse into a dropdown menu below "المزيد" */}
      <div className="md:hidden relative">
        <button
          onClick={() => setMobileMenuOpen((v) => !v)}
          title={t('menu.moreTools')}
          className={cn(
            "h-9 w-9 rounded-xl border flex items-center justify-center transition-all duration-200 active:scale-[0.97]",
            mobileMenuOpen ? "bg-gray-900 border-gray-900 text-white" : "border-gray-200 text-gray-600 hover:bg-gray-50"
          )}
        >
          {mobileMenuOpen ? <X className="h-4 w-4" /> : <MoreHorizontal className="h-4 w-4" />}
        </button>
        <AnimatePresence>
          {mobileMenuOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setMobileMenuOpen(false)} />
              <motion.div
                initial={{ opacity: 0, y: -8, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.97 }}
                transition={{ duration: 0.15 }}
                className="absolute left-0 top-11 z-50 w-72 bg-white border border-gray-100 rounded-2xl shadow-lg p-1.5"
              >
                {extras.map((a) => (
                  <ActionButton key={a.key} icon={a.icon} label={a.label} description={a.description}
                    onClick={() => { a.onClick(); setMobileMenuOpen(false); }} disabled={a.disabled} spinning={a.spinning} variant="menu" />
                ))}
                <ManageCategoriesDialog restaurantId={restaurantId || ''} menuItems={rawMenuItems} onSave={onSave}>
                  <ActionButton icon={Tag} label={t('menu.categories')} description={t('menu.categoriesTooltip')} disabled={disabled}
                    onClick={() => setMobileMenuOpen(false)} variant="menu" />
                </ManageCategoriesDialog>
                <AddFromLibraryDialog restaurantId={restaurantId} onSave={onSave} itemCount={menuItemsCount} menuItems={rawMenuItems}>
                  <ActionButton icon={Library} label={t('menu.fromLibrary')} description={t('menu.fromLibraryTooltip')} disabled={disabled}
                    onClick={() => setMobileMenuOpen(false)} variant="menu" />
                </AddFromLibraryDialog>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
