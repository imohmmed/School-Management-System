import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import * as fs from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { read, set_fs, utils, version, write } from 'xlsx';
import { exportSheet } from './xlsx.ts';

test('uses the patched SheetJS distribution and reads XLSX, legacy XLS and Arabic CSV', () => {
  assert.equal(version, '0.20.3');
  const wb = utils.book_new();
  const data = [
    ['الاسم الكامل', 'الرقم المدرسي', 'تاريخ الميلاد'],
    ['طالب تجريبي', '00012', new Date('2012-03-04T00:00:00Z')],
  ];
  utils.book_append_sheet(wb, utils.aoa_to_sheet(data), 'طلاب');
  for (const bookType of ['xlsx', 'biff8'] as const) {
    const parsed = read(write(wb, { type: 'buffer', bookType }), { type: 'array', cellDates: true });
    const rows = utils.sheet_to_json<Record<string, unknown>>(parsed.Sheets[parsed.SheetNames[0]], { defval: '', raw: true });
    assert.equal(rows[0]['الاسم الكامل'], 'طالب تجريبي');
    assert.equal(rows[0]['الرقم المدرسي'], '00012');
    assert(rows[0]['تاريخ الميلاد'] instanceof Date);
    assert.equal((rows[0]['تاريخ الميلاد'] as Date).toISOString().slice(0, 10), '2012-03-04');
  }
  const csv = new TextEncoder().encode('\uFEFFالاسم الكامل,الرقم المدرسي\nطالب تجريبي,ABC-12');
  const parsed = read(csv, { type: 'array' });
  const rows = utils.sheet_to_json<Record<string, unknown>>(parsed.Sheets[parsed.SheetNames[0]]);
  assert.equal(rows[0]['الاسم الكامل'], 'طالب تجريبي');
  assert.equal(rows[0]['الرقم المدرسي'], 'ABC-12');
});

test('XLSX export retains Arabic, RTL, numeric grades and text rather than formulas', () => {
  // SheetJS ESM does not import Node fs automatically; browsers use downloads.
  set_fs(fs);
  const dir = mkdtempSync(path.join(tmpdir(), 'school-spreadsheet-'));
  try {
    const file = path.join(dir, 'تقرير.xlsx');
    exportSheet(file, 'الطلاب', ['الاسم', 'الرقم', 'الدرجة'], [['=1+1', '00012', 95]]);
    const wb = read(readFileSync(file), { type: 'buffer' });
    assert.equal(wb.Workbook?.Views?.[0]?.RTL, true);
    const sheet = wb.Sheets['الطلاب'];
    assert.equal(sheet.A2.t, 's');
    assert.equal(sheet.A2.v, '=1+1');
    assert.equal(sheet.A2.f, undefined);
    assert.equal(sheet.B2.v, '00012');
    assert.equal(sheet.C2.t, 'n');
    assert.equal(sheet.C2.v, 95);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('CSV downloads preserve the BOM and neutralize formula injection', async () => {
  const savedDocument = globalThis.document;
  const savedCreate = URL.createObjectURL;
  const savedRevoke = URL.revokeObjectURL;
  let blob: Blob | undefined;
  let clicked = false;
  const link = { href: '', download: '', click() { clicked = true; }, remove() {} };
  globalThis.document = {
    createElement: () => link,
    body: { appendChild: () => {} },
  } as unknown as Document;
  URL.createObjectURL = (value) => { blob = value as Blob; return 'blob:synthetic-test'; };
  URL.revokeObjectURL = () => {};
  try {
    exportSheet('كشف.xlsx', 'الطلاب', ['الاسم', 'الدرجة'], [['=1+1', 95], [' +cmd', 0], ['-cmd', 1], ['@cmd', 2], ['طالب', 90]], 'csv');
    assert(clicked);
    assert.equal(link.download, 'كشف.csv');
    assert(blob);
    const bytes = new Uint8Array(await blob.arrayBuffer());
    assert.deepEqual([...bytes.subarray(0, 3)], [0xef, 0xbb, 0xbf]);
    const text = new TextDecoder().decode(bytes);
    for (const value of ["'=1+1", "' +cmd", "'-cmd", "'@cmd", 'طالب']) assert(text.includes(value));
    assert(text.includes('95'));
  } finally {
    // Allow the production URL cleanup timer to run before restoring the mock.
    await new Promise((resolve) => setTimeout(resolve, 1050));
    if (savedDocument === undefined) Reflect.deleteProperty(globalThis, 'document');
    else globalThis.document = savedDocument;
    URL.createObjectURL = savedCreate;
    URL.revokeObjectURL = savedRevoke;
  }
});
