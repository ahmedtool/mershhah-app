// Reads .xlsx/.csv into a plain header+rows table without going through the
// bundled `xlsx` package's own ZIP layer.
//
// Real-world reason: a genuine Keeta "Order Log" export (tested live) uses a
// streamed ZIP - the local file header's compressed-size field is left at 0
// with the real size written after the data in a trailing data descriptor
// (ZIP general-purpose flag bit 3). That's valid ZIP, and Python's zipfile
// and JSZip both handle it correctly, but the `xlsx` package's own ZIP
// reader silently returns zero cells for the whole sheet on files built
// this way - no error, no exception, `sheet_to_json` just returns nothing
// usable. Confirmed by unzipping the exact same file with both libraries
// side by side. Since delivery-app report generators commonly stream their
// exports, this isn't a one-off - hence unzipping with JSZip (does handle
// it) and parsing the worksheet XML directly with DOMParser here, instead
// of depending on the `xlsx` package for .xlsx files at all.

export async function readTabularFile(file: File): Promise<{ headers: string[]; rows: any[][] }> {
  const name = file.name.toLowerCase();
  if (name.endsWith('.csv')) {
    return parseCsv(await file.text());
  }
  return parseXlsx(file);
}

// Reads every sheet in a workbook, keyed by its real display name (not the
// internal sheetN.xml filename) - needed for reports like Keeta's invoice
// summary that ship several named sheets in one file.
export async function readAllSheets(file: File): Promise<Record<string, any[][]>> {
  const JSZip = (await import('jszip')).default;
  const buffer = await file.arrayBuffer();
  const zip = await JSZip.loadAsync(buffer);
  const sharedStrings = await readSharedStrings(zip);
  const sheetPaths = await resolveAllSheetPaths(zip);

  const result: Record<string, any[][]> = {};
  for (const { name, path } of sheetPaths) {
    const f = zip.file(path);
    if (!f) continue;
    const xml = await f.async('string');
    result[name] = parseSheetXml(xml, sharedStrings);
  }
  return result;
}

function parseCsv(text: string): { headers: string[]; rows: any[][] } {
  const lines = text.split(/\r\n|\n|\r/).filter((l) => l.trim() !== '');
  const parseLine = (line: string): string[] => {
    const cells: string[] = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inQuotes) {
        if (ch === '"' && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else if (ch === '"') {
          inQuotes = false;
        } else {
          cur += ch;
        }
      } else if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        cells.push(cur);
        cur = '';
      } else {
        cur += ch;
      }
    }
    cells.push(cur);
    return cells;
  };
  const allRows = lines.map(parseLine);
  const headers = (allRows[0] || []).map((h) => h.trim());
  return { headers, rows: allRows.slice(1) };
}

async function parseXlsx(file: File): Promise<{ headers: string[]; rows: any[][] }> {
  const JSZip = (await import('jszip')).default;
  const buffer = await file.arrayBuffer();
  const zip = await JSZip.loadAsync(buffer);

  const sheetPath = await resolveFirstSheetPath(zip);
  const sheetXmlFile = zip.file(sheetPath);
  if (!sheetXmlFile) return { headers: [], rows: [] };
  const sheetXml = await sheetXmlFile.async('string');

  const sharedStrings = await readSharedStrings(zip);
  const allRows = parseSheetXml(sheetXml, sharedStrings);

  const headers = (allRows[0] || []).map((h) => String(h ?? '').trim());
  return { headers, rows: allRows.slice(1) };
}

function parseSheetXml(sheetXml: string, sharedStrings: string[]): any[][] {
  const doc = new DOMParser().parseFromString(sheetXml, 'application/xml');
  const rowEls = Array.from(doc.getElementsByTagName('row'));

  const allRows: any[][] = [];
  for (const rowEl of rowEls) {
    const rowIndex = parseInt(rowEl.getAttribute('r') || '0', 10) - 1;
    if (rowIndex < 0) continue;
    while (allRows.length <= rowIndex) allRows.push([]);
    const cellEls = Array.from(rowEl.getElementsByTagName('c'));
    for (const cellEl of cellEls) {
      const ref = cellEl.getAttribute('r');
      if (!ref) continue;
      const colIndex = columnLetterToIndex(ref.replace(/[0-9]/g, ''));
      const value = readCellValue(cellEl, sharedStrings);
      const row = allRows[rowIndex];
      while (row.length <= colIndex) row.push('');
      row[colIndex] = value;
    }
  }
  return allRows;
}

async function resolveFirstSheetPath(zip: any): Promise<string> {
  // Most single-sheet exports are xl/worksheets/sheet1.xml - fall back to
  // resolving it properly from workbook.xml.rels only if that guess misses.
  if (zip.file('xl/worksheets/sheet1.xml')) return 'xl/worksheets/sheet1.xml';
  const names = Object.keys(zip.files).filter((n) => /^xl\/worksheets\/sheet\d+\.xml$/.test(n));
  return names.sort()[0] || 'xl/worksheets/sheet1.xml';
}

// Maps each sheet's real display name (from workbook.xml's <sheet name=.../>)
// to its actual worksheet XML path (via workbook.xml.rels), since the two
// are only linked indirectly through an r:id, not by matching order.
async function resolveAllSheetPaths(zip: any): Promise<{ name: string; path: string }[]> {
  const workbookFile = zip.file('xl/workbook.xml');
  const relsFile = zip.file('xl/_rels/workbook.xml.rels');
  if (!workbookFile || !relsFile) {
    const names = Object.keys(zip.files).filter((n) => /^xl\/worksheets\/sheet\d+\.xml$/.test(n)).sort();
    return names.map((path, i) => ({ name: `Sheet${i + 1}`, path }));
  }

  const workbookXml = await workbookFile.async('string');
  const relsXml = await relsFile.async('string');
  const wbDoc = new DOMParser().parseFromString(workbookXml, 'application/xml');
  const relsDoc = new DOMParser().parseFromString(relsXml, 'application/xml');

  const relIdToTarget = new Map<string, string>();
  Array.from(relsDoc.getElementsByTagName('Relationship')).forEach((rel) => {
    const id = rel.getAttribute('Id');
    const target = rel.getAttribute('Target');
    if (id && target) relIdToTarget.set(id, target.replace(/^\/?/, ''));
  });

  const sheetEls = Array.from(wbDoc.getElementsByTagName('sheet'));
  return sheetEls
    .map((el) => {
      const name = el.getAttribute('name') || '';
      const rId = el.getAttribute('r:id') || el.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id') || '';
      const target = relIdToTarget.get(rId);
      const path = target ? (target.startsWith('xl/') ? target : `xl/${target}`) : '';
      return { name, path };
    })
    .filter((s) => s.path);
}

async function readSharedStrings(zip: any): Promise<string[]> {
  const f = zip.file('xl/sharedStrings.xml');
  if (!f) return [];
  const xml = await f.async('string');
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  const siEls = Array.from(doc.getElementsByTagName('si'));
  return siEls.map((si) => {
    const tEls = Array.from(si.getElementsByTagName('t'));
    return tEls.map((t) => t.textContent || '').join('');
  });
}

function readCellValue(cellEl: Element, sharedStrings: string[]): string | number {
  const type = cellEl.getAttribute('t');
  if (type === 'inlineStr') {
    const isEl = cellEl.getElementsByTagName('is')[0];
    if (!isEl) return '';
    const tEls = Array.from(isEl.getElementsByTagName('t'));
    return tEls.map((t) => t.textContent || '').join('');
  }
  const vEl = cellEl.getElementsByTagName('v')[0];
  const raw = vEl?.textContent ?? '';
  if (type === 's') {
    const idx = parseInt(raw, 10);
    return sharedStrings[idx] ?? '';
  }
  if (type === 'str' || type === 'b') return raw;
  if (raw === '') return '';
  const n = Number(raw);
  return isNaN(n) ? raw : n;
}

function columnLetterToIndex(letters: string): number {
  let index = 0;
  for (let i = 0; i < letters.length; i++) {
    index = index * 26 + (letters.charCodeAt(i) - 64);
  }
  return index - 1;
}
