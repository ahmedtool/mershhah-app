// Shared parsing logic behind the Keeta/HungerStation report-reader tools.
// Column names in real merchant-dashboard exports vary by report type, so
// this detects likely amount/date/item columns by keyword instead of
// assuming a fixed layout - it's the fallback for any report that isn't
// specifically recognized (see keeta-order-log-parser.ts for that one).

import { readTabularFile } from './xlsx-robust-reader';

export type ParsedDeliveryReport = {
  headers: string[];
  rows: Record<string, any>[];
  rowCount: number;
  amountColumn: string | null;
  totalAmount: number | null;
  dateColumn: string | null;
  dateRange: { from: string; to: string } | null;
  itemColumn: string | null;
  topItems: { name: string; count: number; total: number }[];
};

const AMOUNT_KEYWORDS = ["مبلغ", "إجمالي", "اجمالي", "صافي", "سعر", "قيمة", "amount", "total", "price", "net", "value"];
const DATE_KEYWORDS = ["تاريخ", "وقت", "date", "time"];
const ITEM_KEYWORDS = ["صنف", "منتج", "طلب", "وصف", "اسم", "item", "product", "order", "name", "description"];

function findColumn(headers: string[], keywords: string[]): string | null {
  const lower = (s: string) => s.toLowerCase();
  return headers.find((h) => keywords.some((k) => lower(h).includes(lower(k)))) || null;
}

function toNumber(value: unknown): number {
  const n = Number(String(value ?? "").replace(/[^0-9.-]/g, ""));
  return isNaN(n) ? 0 : n;
}

export async function parseDeliveryReport(file: File): Promise<ParsedDeliveryReport> {
  const { headers: rawHeaders, rows: dataOnlyRows } = await readTabularFile(file);
  const allRows: any[][] = [rawHeaders, ...dataOnlyRows];

  if (allRows.length === 0 || rawHeaders.length === 0) {
    return { headers: [], rows: [], rowCount: 0, amountColumn: null, totalAmount: null, dateColumn: null, dateRange: null, itemColumn: null, topItems: [] };
  }

  const headers = allRows[0].map((h) => String(h ?? "").trim()).filter(Boolean);
  const dataRows = allRows.slice(1).filter((r) => r.some((c) => String(c ?? "").trim() !== ""));
  const rows = dataRows.map((r) => Object.fromEntries(headers.map((h, i) => [h, r[i]])));

  const amountColumn = findColumn(headers, AMOUNT_KEYWORDS);
  const dateColumn = findColumn(headers, DATE_KEYWORDS);
  const itemColumn = findColumn(headers, ITEM_KEYWORDS);

  const totalAmount = amountColumn ? rows.reduce((sum, r) => sum + toNumber(r[amountColumn]), 0) : null;

  let dateRange: { from: string; to: string } | null = null;
  if (dateColumn) {
    const dates = rows.map((r) => String(r[dateColumn] ?? "").trim()).filter(Boolean);
    if (dates.length) dateRange = { from: dates[0], to: dates[dates.length - 1] };
  }

  let topItems: { name: string; count: number; total: number }[] = [];
  if (itemColumn) {
    const counts = new Map<string, { count: number; total: number }>();
    rows.forEach((r) => {
      const name = String(r[itemColumn] ?? "").trim();
      if (!name) return;
      const cur = counts.get(name) || { count: 0, total: 0 };
      cur.count += 1;
      cur.total += amountColumn ? toNumber(r[amountColumn]) : 0;
      counts.set(name, cur);
    });
    topItems = Array.from(counts.entries())
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }

  return { headers, rows, rowCount: rows.length, amountColumn, totalAmount, dateColumn, dateRange, itemColumn, topItems };
}
