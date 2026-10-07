import { utils, writeFile } from 'xlsx';
export type ExportFormat = 'xlsx' | 'csv';
export function exportSheet(filename: string, sheet: string, headers: string[], rows: (string | number)[][], format: ExportFormat = 'xlsx') {
  // CSV is interpreted by spreadsheet software: keep user-entered names/codes
  // as text, never as executable formulas. XLSX already stores them as strings.
  const csvText = (value: string | number) => typeof value === 'string' && /^[\s]*[=+\-@]/.test(value) ? `'${value}` : value;
  const safeRows = format === 'csv' ? rows.map((row) => row.map(csvText)) : rows;
  const ws = utils.aoa_to_sheet([headers, ...safeRows]);
  const base = filename.replace(/\.(xlsx|csv)$/i, '');
  if (format === 'csv') {
    const blob = new Blob(['\uFEFF' + utils.sheet_to_csv(ws)], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `${base}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return;
  }
  ws['!cols'] = headers.map((h) => ({ wch: Math.max(12, h.length + 4) }));
  const wb = utils.book_new();
  wb.Workbook = { Views: [{ RTL: true }] };
  utils.book_append_sheet(wb, ws, sheet.slice(0, 30));
  writeFile(wb, `${base}.xlsx`);
}
