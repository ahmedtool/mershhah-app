// Ties together every Keeta report detector/parser so an uploaded file can
// be routed to the right one without the caller knowing the report types in
// advance. Detection order matters only where column signatures could
// otherwise overlap (order_data vs restaurant_data both share several
// financial columns) - each isKeeta*() check requires its own distinguishing
// column, so order here is defensive, not load-bearing.

import { readTabularFile, readAllSheets } from '../xlsx-robust-reader';
import { isKeetaOrderLog, parseKeetaOrderLogRows, generateKeetaInsights, type KeetaOrderLogSummary } from '../keeta-order-log-parser';
import { isKeetaOrderData, parseKeetaOrderData, generateOrderDataInsights, type KeetaOrderDataSummary } from './order-data-parser';
import { isKeetaRatings, parseKeetaRatings, type KeetaRatingsSummary } from './ratings-parser';
import { isKeetaCampaignData, parseKeetaCampaignData, type KeetaCampaignSummary } from './campaign-parser';
import { isKeetaRestaurantData, parseKeetaRestaurantData, type KeetaRestaurantDaySummary } from './restaurant-data-parser';
import { isKeetaItemData, parseKeetaItemData, type KeetaItemDataSummary } from './item-data-parser';
import { isKeetaItemAnalysis, parseKeetaItemAnalysis, type KeetaItemAnalysisSummary } from './item-analysis-parser';
import { isKeetaInvoiceSummary, parseKeetaInvoiceSummary, type KeetaInvoiceSummary } from './invoice-summary-parser';
import type { KeetaReportType } from './types';

export type KeetaParsedReport =
  | { type: 'order_log'; summary: KeetaOrderLogSummary; insights: { alerts: string[]; recommendations: string[] } }
  | { type: 'order_data'; summary: KeetaOrderDataSummary; insights: { alerts: string[]; recommendations: string[] } }
  | { type: 'ratings'; summary: KeetaRatingsSummary }
  | { type: 'campaign_data'; summary: KeetaCampaignSummary }
  | { type: 'restaurant_data'; summary: KeetaRestaurantDaySummary }
  | { type: 'item_data'; summary: KeetaItemDataSummary }
  | { type: 'item_analysis'; summary: KeetaItemAnalysisSummary }
  | { type: 'invoice_summary'; summary: KeetaInvoiceSummary };

// Rows this report type puts in keeta_reports for history browsing, derived
// per-type since each summary shape carries date info differently.
export function reportPeriod(parsed: KeetaParsedReport): { from: string | null; to: string | null } {
  switch (parsed.type) {
    case 'order_log':
    case 'order_data':
    case 'restaurant_data':
    case 'campaign_data':
    case 'item_data':
      return { from: parsed.summary.dateRange?.from ?? null, to: parsed.summary.dateRange?.to ?? null };
    case 'invoice_summary':
      return { from: parsed.summary.dateRange?.from ?? null, to: parsed.summary.dateRange?.to ?? null };
    case 'ratings':
    case 'item_analysis':
      return { from: null, to: null };
  }
}

export function reportRowCount(parsed: KeetaParsedReport): number {
  switch (parsed.type) {
    case 'order_log':
      return parsed.summary.orderCount;
    case 'order_data':
      return parsed.summary.orderCount;
    case 'ratings':
      return parsed.summary.totalReviews;
    case 'campaign_data':
      return parsed.summary.byCampaign.length;
    case 'restaurant_data':
      return parsed.summary.dailySeries.length;
    case 'item_data':
      return parsed.summary.totalItems;
    case 'item_analysis':
      return parsed.summary.totalItems;
    case 'invoice_summary':
      return parsed.summary.periods.length;
  }
}

// Detects and parses whichever Keeta report type the file matches. Reads
// the file at most twice: once as a single sheet (covers every
// header-based report), and only falls back to reading every sheet if
// nothing matched - the invoice summary is the one report shaped that way.
export async function detectAndParseKeetaReport(file: File): Promise<KeetaParsedReport | null> {
  const { headers: rawHeaders, rows } = await readTabularFile(file);
  const headers = rawHeaders.map((h) => String(h ?? '').trim());
  const dataRows = rows.filter((r) => r.some((c) => String(c ?? '').trim() !== ''));

  if (headers.length > 0) {
    if (isKeetaOrderLog(headers)) {
      const summary = parseKeetaOrderLogRows(headers, dataRows);
      if (summary) return { type: 'order_log', summary, insights: generateKeetaInsights(summary) };
    }
    if (isKeetaOrderData(headers)) {
      const summary = parseKeetaOrderData(headers, dataRows);
      return { type: 'order_data', summary, insights: generateOrderDataInsights(summary) };
    }
    if (isKeetaRestaurantData(headers)) {
      return { type: 'restaurant_data', summary: parseKeetaRestaurantData(headers, dataRows) };
    }
    if (isKeetaRatings(headers)) {
      return { type: 'ratings', summary: parseKeetaRatings(headers, dataRows) };
    }
    if (isKeetaCampaignData(headers)) {
      return { type: 'campaign_data', summary: parseKeetaCampaignData(headers, dataRows) };
    }
    if (isKeetaItemData(headers)) {
      return { type: 'item_data', summary: parseKeetaItemData(headers, dataRows) };
    }
    if (isKeetaItemAnalysis(headers)) {
      return { type: 'item_analysis', summary: parseKeetaItemAnalysis(headers, dataRows) };
    }
  }

  // Nothing matched by single-sheet header signature - only the multi-sheet
  // invoice summary report is shaped this way, so check it last.
  const name = file.name.toLowerCase();
  if (name.endsWith('.xlsx')) {
    const sheets = await readAllSheets(file);
    if (isKeetaInvoiceSummary(Object.keys(sheets))) {
      const summary = parseKeetaInvoiceSummary(sheets);
      if (summary) return { type: 'invoice_summary', summary };
    }
  }

  return null;
}

export { REPORT_TYPE_LABELS } from './types';
export type { KeetaReportType };
export { generateOrderDataInsights } from './order-data-parser';
export { generateKeetaInsights } from '../keeta-order-log-parser';
