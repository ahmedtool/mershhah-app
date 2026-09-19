import type { BusinessGatewayFieldType, FormFileRules } from '@/lib/types';

// Field types the owner can build a form from, in the order shown in the
// type picker. labelKey resolves under ownerGateway.*.
export const FIELD_TYPE_OPTIONS: Array<{ type: BusinessGatewayFieldType; labelKey: string }> = [
  { type: 'text', labelKey: 'ownerGateway.fieldTypeText' },
  { type: 'textarea', labelKey: 'ownerGateway.fieldTypeTextarea' },
  { type: 'number', labelKey: 'ownerGateway.fieldTypeNumber' },
  { type: 'email', labelKey: 'ownerGateway.fieldTypeEmail' },
  { type: 'phone', labelKey: 'ownerGateway.fieldTypePhone' },
  { type: 'url', labelKey: 'ownerGateway.fieldTypeUrl' },
  { type: 'date', labelKey: 'ownerGateway.fieldTypeDate' },
  { type: 'select', labelKey: 'ownerGateway.fieldTypeSelect' },
  { type: 'radio', labelKey: 'ownerGateway.fieldTypeRadio' },
  { type: 'checkbox', labelKey: 'ownerGateway.fieldTypeCheckbox' },
  { type: 'yesno', labelKey: 'ownerGateway.fieldTypeYesNo' },
  { type: 'file', labelKey: 'ownerGateway.fieldTypeFile' },
  { type: 'paragraph', labelKey: 'ownerGateway.fieldTypeParagraph' },
];

export const typeHasOptions = (type: BusinessGatewayFieldType) =>
  type === 'select' || type === 'radio' || type === 'checkbox';

// Paragraph is static text - it collects nothing, so it can't be required.
export const typeCollectsInput = (type: BusinessGatewayFieldType) => type !== 'paragraph';

export const newFieldId = () => `f${Date.now().toString(36)}${Math.floor(Math.random() * 1000)}`;

// ---- Upload limits -------------------------------------------------------
// Decided by the platform, NOT by restaurant owners: we pay for the storage,
// so this is the one place that says how much a visitor may upload. Change a
// number here and every form (custom, built-in, jobs CV) follows.
// Enforced in the browser before upload - uploads go browser -> ImageKit
// with a short-lived signature, so a hand-crafted request could bypass it.
export const PLATFORM_FILE_RULES: FormFileRules = { maxSizeMB: 5, maxFiles: 1, allowed: ['image', 'pdf'] };
export const PLATFORM_CV_RULES: FormFileRules = { maxSizeMB: 5, maxFiles: 1, allowed: ['pdf', 'image'] };

const FILE_GROUPS: Record<FormFileRules['allowed'][number], { mimes: string[]; exts: string[]; accept: string }> = {
  image: { mimes: ['image/jpeg', 'image/png', 'image/webp'], exts: ['jpg', 'jpeg', 'png', 'webp'], accept: 'image/jpeg,image/png,image/webp' },
  pdf: { mimes: ['application/pdf'], exts: ['pdf'], accept: 'application/pdf' },
  doc: {
    mimes: ['application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
    exts: ['doc', 'docx'],
    accept: '.doc,.docx',
  },
};

export const fileAcceptAttr = (rules: FormFileRules) => rules.allowed.map((g) => FILE_GROUPS[g].accept).join(',');

export const allowedExtensionsLabel = (rules: FormFileRules) =>
  rules.allowed.flatMap((g) => FILE_GROUPS[g].exts).join(', ').toUpperCase();

// Returns which rule a file breaks, or null when it's fine. Checks the
// extension as well as the MIME type because browsers report an empty type
// for some document formats.
export function validateFile(file: File, rules: FormFileRules): 'size' | 'type' | null {
  if (file.size > rules.maxSizeMB * 1024 * 1024) return 'size';
  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  const ok = rules.allowed.some((g) => FILE_GROUPS[g].mimes.includes(file.type) || FILE_GROUPS[g].exts.includes(ext));
  return ok ? null : 'type';
}
