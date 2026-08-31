// Persistence for uploaded Keeta reports: stores the raw file in the
// restaurant-assets bucket (already RLS-scoped by restaurants/{id}/...) and
// a row in keeta_reports with the computed summary as jsonb, so a past
// report can be reopened later without re-uploading or re-parsing.

import { supabase } from '@/lib/supabase';
import type { KeetaReportType } from './types';
import { reportPeriod, reportRowCount, type KeetaParsedReport } from './registry';

const BUCKET = 'restaurant-assets';

export type KeetaReportRow = {
  id: string;
  restaurant_id: string;
  profile_id: string;
  report_type: KeetaReportType | 'account_statement';
  file_name: string;
  storage_path: string | null;
  period_from: string | null;
  period_to: string | null;
  row_count: number | null;
  summary: any;
  created_at: string;
};

export async function saveKeetaReport(params: {
  restaurantId: string;
  profileId: string;
  file: File;
  parsed: KeetaParsedReport;
}): Promise<KeetaReportRow> {
  const { restaurantId, profileId, file, parsed } = params;
  const reportId = crypto.randomUUID();
  const storagePath = `restaurants/${restaurantId}/keeta-reports/${reportId}-${file.name}`;

  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(storagePath, file);
  if (uploadError) throw uploadError;

  const period = reportPeriod(parsed);

  const { data, error } = await supabase
    .from('keeta_reports')
    .insert({
      id: reportId,
      restaurant_id: restaurantId,
      profile_id: profileId,
      report_type: parsed.type,
      file_name: file.name,
      storage_path: storagePath,
      period_from: period.from,
      period_to: period.to,
      row_count: reportRowCount(parsed),
      summary: parsed.summary,
    })
    .select()
    .single();

  if (error) throw error;
  return data as KeetaReportRow;
}

// The account statement (كشف الحساب) PDF is stored as-is with no parsed
// summary - deliberately out of scope for table extraction.
export async function saveAccountStatementFile(params: {
  restaurantId: string;
  profileId: string;
  file: File;
}): Promise<KeetaReportRow> {
  const { restaurantId, profileId, file } = params;
  const reportId = crypto.randomUUID();
  const storagePath = `restaurants/${restaurantId}/keeta-reports/${reportId}-${file.name}`;

  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(storagePath, file);
  if (uploadError) throw uploadError;

  const { data, error } = await supabase
    .from('keeta_reports')
    .insert({
      id: reportId,
      restaurant_id: restaurantId,
      profile_id: profileId,
      report_type: 'account_statement',
      file_name: file.name,
      storage_path: storagePath,
      row_count: null,
      summary: {},
    })
    .select()
    .single();

  if (error) throw error;
  return data as KeetaReportRow;
}

export async function listKeetaReports(restaurantId: string): Promise<KeetaReportRow[]> {
  const { data, error } = await supabase
    .from('keeta_reports')
    .select('*')
    .eq('restaurant_id', restaurantId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []) as KeetaReportRow[];
}

export function getReportFileUrl(storagePath: string): string {
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);
  return data.publicUrl;
}
