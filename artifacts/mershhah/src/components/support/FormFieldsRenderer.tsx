'use client';

import { useRef, useState } from 'react';
import { Loader2, Upload, X, FileText } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { uploadToImageKit } from '@/lib/imagekit';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/components/shared/LanguageContext';
import { PLATFORM_FILE_RULES, fileAcceptAttr, allowedExtensionsLabel, validateFile } from '@/lib/form-fields';
import type { BusinessGatewayField, FormFileRules, UploadedFormFile } from '@/lib/types';

export type FormFieldValue = string | string[] | UploadedFormFile[];
export type FormValues = Record<string, FormFieldValue>;

export function fieldLabelOf(field: BusinessGatewayField, t: (k: string) => string, isEnglish: boolean) {
  return field.labelKey ? t(field.labelKey) : ((isEnglish && field.label_en) || field.label || '');
}

// A field counts as answered when it has any non-empty value.
export function isFieldFilled(value: FormFieldValue | undefined) {
  if (value === undefined) return false;
  if (Array.isArray(value)) return value.length > 0;
  return value.trim() !== '';
}

export function missingRequiredFields(fields: BusinessGatewayField[], values: FormValues) {
  return fields.filter((f) => f.type !== 'paragraph' && f.required && !isFieldFilled(values[f.id]));
}

// Upload control shared by the "file" field type and the jobs CV. In preview
// mode it renders the same UI but never touches the network.
export function FileUploadInput({
  rules, value, onChange, preview,
}: {
  rules?: FormFileRules;
  value: UploadedFormFile[];
  onChange: (files: UploadedFormFile[]) => void;
  preview?: boolean;
}) {
  const { t } = useLanguage();
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const r = rules ?? PLATFORM_FILE_RULES;
  const canAddMore = value.length < r.maxFiles;

  const handlePick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files || []);
    e.target.value = '';
    if (picked.length === 0 || preview) return;

    const room = r.maxFiles - value.length;
    if (picked.length > room) {
      toast({ title: t('publicFormFiles.tooManyFiles').replace('{n}', String(r.maxFiles)), variant: 'destructive' });
    }
    const toUpload = picked.slice(0, Math.max(0, room));

    setUploading(true);
    const added: UploadedFormFile[] = [];
    for (const file of toUpload) {
      const problem = validateFile(file, r);
      if (problem === 'size') {
        toast({ title: t('publicFormFiles.fileTooLarge').replace('{mb}', String(r.maxSizeMB)), description: file.name, variant: 'destructive' });
        continue;
      }
      if (problem === 'type') {
        toast({ title: t('publicFormFiles.fileTypeNotAllowed').replace('{types}', allowedExtensionsLabel(r)), description: file.name, variant: 'destructive' });
        continue;
      }
      try {
        const url = await uploadToImageKit(file, 'form-uploads');
        added.push({ url, name: file.name });
      } catch {
        toast({ title: t('publicJobs.cvUploadFailed'), description: file.name, variant: 'destructive' });
      }
    }
    setUploading(false);
    if (added.length) onChange([...value, ...added]);
  };

  return (
    <div className="space-y-2">
      <input ref={inputRef} type="file" multiple={r.maxFiles > 1} accept={fileAcceptAttr(r)} onChange={handlePick} className="hidden" />
      {value.map((f, i) => (
        <div key={f.url + i} className="flex items-center gap-2 h-10 px-3 rounded-lg border border-gray-100 bg-gray-50 text-xs text-gray-700">
          <FileText className="h-3.5 w-3.5 shrink-0" />
          <span className="flex-1 truncate">{f.name}</span>
          <button type="button" onClick={() => onChange(value.filter((_, idx) => idx !== i))} className="shrink-0 text-gray-500 hover:text-red-500">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
      {canAddMore && (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="w-full h-10 rounded-lg border border-dashed border-gray-200 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {uploading
            ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> {t('publicJobs.cvUploading')}</>
            : <><Upload className="h-3.5 w-3.5" /> {t('publicJobs.cvUploadPrompt')}</>}
        </button>
      )}
      <p className="text-[10px] text-gray-500">
        {allowedExtensionsLabel(r)} · {t('publicFormFiles.maxSizeHint').replace('{mb}', String(r.maxSizeMB))}
        {r.maxFiles > 1 && ` · ${t('publicFormFiles.maxFilesHint').replace('{n}', String(r.maxFiles))}`}
      </p>
    </div>
  );
}

const inputCls = 'h-10 text-sm rounded-lg border-gray-100';

function htmlInputType(type: BusinessGatewayField['type']) {
  switch (type) {
    case 'number': return 'number';
    case 'email': return 'email';
    case 'phone': return 'tel';
    case 'url': return 'url';
    case 'date': return 'date';
    default: return 'text';
  }
}

// Renders a form's field list exactly as a visitor sees it. Used by the real
// public form and by the owner's "Preview" dialog (preview = true blocks
// uploads so previewing never writes to storage).
export function FormFieldsRenderer({
  fields, values, onChange, preview,
}: {
  fields: BusinessGatewayField[];
  values: FormValues;
  onChange: (values: FormValues) => void;
  preview?: boolean;
}) {
  const { t, dir } = useLanguage();
  const isEnglish = dir === 'ltr';
  const set = (id: string, v: FormFieldValue) => onChange({ ...values, [id]: v });
  const str = (id: string) => (typeof values[id] === 'string' ? (values[id] as string) : '');
  const arr = (id: string) => (Array.isArray(values[id]) ? (values[id] as string[]) : []);

  return (
    <>
      {fields.map((field) => {
        const label = fieldLabelOf(field, t, isEnglish);
        if (field.type === 'paragraph') {
          return <p key={field.id} className="text-xs text-gray-600 leading-relaxed">{label}</p>;
        }
        const options = field.options || [];
        const ltrType = field.type === 'email' || field.type === 'phone' || field.type === 'url';
        return (
          <div key={field.id}>
            <label className="text-xs text-gray-600 mb-1.5 block">
              {label}{field.required && <span className="text-red-500"> *</span>}
            </label>
            {field.type === 'textarea' ? (
              <Textarea value={str(field.id)} onChange={(e) => set(field.id, e.target.value)} rows={3} className="text-sm rounded-lg border-gray-100 resize-none min-h-[80px]" />
            ) : field.type === 'select' ? (
              <Select value={str(field.id)} onValueChange={(v) => set(field.id, v)}>
                <SelectTrigger className={inputCls}><SelectValue /></SelectTrigger>
                <SelectContent>
                  {options.map((opt) => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}
                </SelectContent>
              </Select>
            ) : field.type === 'radio' ? (
              <div className="space-y-1.5">
                {options.map((opt) => (
                  <label key={opt} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                    <input type="radio" name={field.id} checked={str(field.id) === opt} onChange={() => set(field.id, opt)} className="w-4 h-4" />
                    {opt}
                  </label>
                ))}
              </div>
            ) : field.type === 'checkbox' ? (
              <div className="space-y-1.5">
                {options.map((opt) => {
                  const checked = arr(field.id).includes(opt);
                  return (
                    <label key={opt} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => set(field.id, checked ? arr(field.id).filter((o) => o !== opt) : [...arr(field.id), opt])}
                        className="w-4 h-4 rounded"
                      />
                      {opt}
                    </label>
                  );
                })}
              </div>
            ) : field.type === 'yesno' ? (
              <div className="flex gap-2">
                {[['yes', t('publicFormFiles.yes')], ['no', t('publicFormFiles.no')]].map(([v, text]) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => set(field.id, v)}
                    className={`flex-1 h-10 rounded-lg text-sm font-medium border transition-colors ${str(field.id) === v ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-100 hover:border-gray-200'}`}
                  >
                    {text}
                  </button>
                ))}
              </div>
            ) : field.type === 'file' ? (
              <FileUploadInput
                rules={PLATFORM_FILE_RULES}
                value={Array.isArray(values[field.id]) ? (values[field.id] as UploadedFormFile[]) : []}
                onChange={(files) => set(field.id, files)}
                preview={preview}
              />
            ) : (
              <Input
                value={str(field.id)}
                onChange={(e) => set(field.id, e.target.value)}
                type={htmlInputType(field.type)}
                dir={ltrType ? 'ltr' : undefined}
                className={inputCls}
              />
            )}
          </div>
        );
      })}
    </>
  );
}
