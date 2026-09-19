'use client';

import { cn } from '@/lib/utils';
import { useLanguage } from '@/components/shared/LanguageContext';
import { clampFileRules, DEFAULT_FILE_RULES, MAX_FILE_SIZE_MB_CEILING, MAX_FILES_CEILING } from '@/lib/form-fields';
import type { FormFileRules } from '@/lib/types';

const SIZE_CHOICES = [1, 2, 5, 10].filter((n) => n <= MAX_FILE_SIZE_MB_CEILING);
const FILE_COUNT_CHOICES = Array.from({ length: MAX_FILES_CEILING }, (_, i) => i + 1);
const TYPE_CHOICES: Array<{ value: FormFileRules['allowed'][number]; labelKey: string }> = [
  { value: 'image', labelKey: 'ownerGateway.fileTypeImage' },
  { value: 'pdf', labelKey: 'ownerGateway.fileTypePdf' },
  { value: 'doc', labelKey: 'ownerGateway.fileTypeDoc' },
];

const pill = (active: boolean) =>
  cn(
    'h-8 px-3 rounded-lg text-[11px] font-bold border transition-colors',
    active ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300',
  );

// Owner-facing controls for what a visitor may upload: max size, how many
// files, and which kinds. Values are always clamped to the platform ceilings
// in lib/form-fields.ts, so an owner can tighten but not loosen past them.
export function FileRulesEditor({
  value, onChange, fallback = DEFAULT_FILE_RULES,
}: {
  value?: FormFileRules;
  onChange: (rules: FormFileRules) => void;
  fallback?: FormFileRules;
}) {
  const { t } = useLanguage();
  const rules = clampFileRules(value, fallback);

  const toggleType = (type: FormFileRules['allowed'][number]) => {
    const has = rules.allowed.includes(type);
    if (has && rules.allowed.length === 1) return; // at least one type must stay allowed
    onChange({ ...rules, allowed: has ? rules.allowed.filter((a) => a !== type) : [...rules.allowed, type] });
  };

  return (
    <div className="space-y-2.5 rounded-lg bg-gray-50 border border-gray-100 p-3">
      <p className="text-[10px] font-bold text-gray-600">{t('ownerGateway.fileRulesTitle')}</p>

      <div className="space-y-1">
        <p className="text-[10px] text-gray-600">{t('ownerGateway.maxSizeLabel')}</p>
        <div className="flex flex-wrap gap-1.5">
          {SIZE_CHOICES.map((mb) => (
            <button key={mb} type="button" onClick={() => onChange({ ...rules, maxSizeMB: mb })} className={pill(rules.maxSizeMB === mb)}>
              {mb} MB
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-1">
        <p className="text-[10px] text-gray-600">{t('ownerGateway.maxFilesLabel')}</p>
        <div className="flex flex-wrap gap-1.5">
          {FILE_COUNT_CHOICES.map((n) => (
            <button key={n} type="button" onClick={() => onChange({ ...rules, maxFiles: n })} className={pill(rules.maxFiles === n)}>
              {n}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-1">
        <p className="text-[10px] text-gray-600">{t('ownerGateway.allowedTypesLabel')}</p>
        <div className="flex flex-wrap gap-1.5">
          {TYPE_CHOICES.map((c) => (
            <button key={c.value} type="button" onClick={() => toggleType(c.value)} className={pill(rules.allowed.includes(c.value))}>
              {t(c.labelKey)}
            </button>
          ))}
        </div>
      </div>

      <p className="text-[10px] text-gray-500 leading-relaxed">{t('ownerGateway.fileRulesNote')}</p>
    </div>
  );
}
