import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { GraduationCap, Plus, Pencil, Archive, RotateCcw, Search, Upload, Eye, Printer, IdCard, FileSpreadsheet, CheckCircle2, XCircle } from 'lucide-react';
import { read, utils } from 'xlsx';
import {
  useGetStudentRegister, useListGrades, useListAttendance, useListClasses, useCreateStudent, useUpdateStudent, useArchiveStudent, useGetSettings, createStudent,
  type Student, type SchoolClass, type StudentInput,
} from '@workspace/api-client-react';
import { PageHeader, EmptyState, ErrorState, TableSkeleton, Modal, Field, SaveBar, ConfirmDialog, ReadOnlyNote, ClassSelect, ExportButtons } from '@/components/kit';
import { BarcodeSvg, usePrint } from '@/components/print';
import { usePerms, useInvalidate } from '@/lib/auth';
import { ok, fail } from '@/lib/notify';
import { errMsg, fmtDate, stuClass, attLabel, attTone } from '@/lib/format';
import { fetchAllStudents } from '@/lib/students';
import { exportSheet, type ExportFormat } from '@/lib/xlsx';

const GENDERS = ['ذكر', 'أنثى'];

function StudentForm({ initial, classes, defaultClass, onClose }: { initial?: Student; classes: SchoolClass[]; defaultClass: string; onClose: () => void }) {
  const inv = useInvalidate();
  const create = useCreateStudent();
  const update = useUpdateStudent();
  const [f, setF] = useState({
    fullName: initial?.fullName ?? '', studentCode: initial?.studentCode ?? '', gender: initial?.gender ?? '', dateOfBirth: initial?.dateOfBirth?.slice(0, 10) ?? '',
    guardianName: initial?.guardianName ?? '', guardianPhone: initial?.guardianPhone ?? '', address: initial?.address ?? '', classId: initial ? String(initial.classId) : defaultClass, active: initial?.active ?? true,
  });
  const [tried, setTried] = useState(false);
  const e = { fullName: f.fullName.trim() ? '' : 'اسم الطالب مطلوب', studentCode: f.studentCode.trim() ? '' : 'الرقم المدرسي مطلوب', classId: f.classId ? '' : 'اختر الصف' };
  const set = (k: keyof typeof f, v: string | boolean) => setF({ ...f, [k]: v });
  const sh = (k: keyof typeof e) => (tried ? e[k] : '') || undefined;
  const submit = () => {
    setTried(true);
    if (Object.values(e).some(Boolean)) return;
    const data: StudentInput = {
      fullName: f.fullName.trim(), studentCode: f.studentCode.trim(), gender: f.gender || null, dateOfBirth: f.dateOfBirth || null,
      guardianName: f.guardianName.trim() || null, guardianPhone: f.guardianPhone.trim() || null, address: f.address.trim() || null, classId: Number(f.classId), active: f.active,
    };
    const opts = { onSuccess: () => { inv(); ok(initial ? 'تم حفظ بيانات الطالب' : 'تمت إضافة الطالب'); onClose(); }, onError: (x: unknown) => fail(x, 'تعذر حفظ الطالب') };
    if (initial) update.mutate({ id: initial.id, data }, opts); else create.mutate({ data }, opts);
  };
  return (
    <Modal wide onClose={onClose} title={initial ? 'تعديل بيانات الطالب' : 'إضافة طالب'} footer={<SaveBar onClose={onClose} pending={create.isPending || update.isPending} onSubmit={submit} />}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="الاسم الكامل" error={sh('fullName')} className="sm:col-span-2"><input className="inp" value={f.fullName} onChange={(x) => set('fullName', x.target.value)} aria-invalid={!!sh('fullName')} /></Field>
        <Field label="الرقم المدرسي" error={sh('studentCode')} hint="يجب ألا يتكرر"><input className="inp" dir="ltr" value={f.studentCode} onChange={(x) => set('studentCode', x.target.value)} aria-invalid={!!sh('studentCode')} /></Field>
        <Field label="الصف والشعبة" error={sh('classId')}><ClassSelect value={f.classId} onChange={(v) => set('classId', v)} classes={classes} invalid={!!sh('classId')} /></Field>
        <Field label="الجنس"><select className="inp" value={f.gender} onChange={(x) => set('gender', x.target.value)}><option value="">غير محدد</option>{GENDERS.map((g) => <option key={g}>{g}</option>)}</select></Field>
        <Field label="تاريخ الميلاد"><input className="inp" type="date" value={f.dateOfBirth} onChange={(x) => set('dateOfBirth', x.target.value)} /></Field>
        <Field label="اسم ولي الأمر"><input className="inp" value={f.guardianName} onChange={(x) => set('guardianName', x.target.value)} /></Field>
        <Field label="هاتف ولي الأمر"><input className="inp" dir="ltr" inputMode="tel" value={f.guardianPhone} onChange={(x) => set('guardianPhone', x.target.value)} /></Field>
        <Field label="العنوان" className="sm:col-span-2"><input className="inp" value={f.address} onChange={(x) => set('address', x.target.value)} /></Field>
        <label className="flex items-center gap-2 text-sm font-semibold sm:col-span-2"><input type="checkbox" className="size-5 accent-[hsl(205,64%,24%)]" checked={f.active} onChange={(x) => set('active', x.target.checked)} />الطالب مسجّل فعّال</label>
      </div>
    </Modal>
  );
}

/* ---------- import ---------- */
type Row = { n: number; input: StudentInput | null; name: string; code: string; errors: string[] };
const alias: Record<string, string[]> = {
  fullName: ['الاسم الكامل', 'الاسم', 'اسم الطالب', 'fullname', 'name'],
  studentCode: ['الرقم المدرسي', 'رقم الطالب', 'الرقم', 'studentcode', 'code'],
  gender: ['الجنس', 'gender'],
  dateOfBirth: ['تاريخ الميلاد', 'dateofbirth', 'dob'],
  guardianName: ['ولي الأمر', 'اسم ولي الأمر', 'guardianname'],
  guardianPhone: ['هاتف ولي الأمر', 'الهاتف', 'رقم الهاتف', 'guardianphone', 'phone'],
  address: ['العنوان', 'address'],
};
const norm = (s: unknown) => String(s ?? '').trim().toLowerCase();
const cell = (v: unknown) => (v == null ? '' : v instanceof Date ? v.toISOString().slice(0, 10) : String(v).trim());

function ImportDialog({ classes, defaultClass, onClose }: { classes: SchoolClass[]; defaultClass: string; onClose: () => void }) {
  const inv = useInvalidate();
  const allQ = useQuery({ queryKey: ['/api/students/register', 'import-full'], queryFn: () => fetchAllStudents({}), staleTime: 0 });
  const existing = allQ.data ?? [];
  const [classId, setClassId] = useState(defaultClass);
  const [file, setFile] = useState('');
  const [parseErr, setParseErr] = useState('');
  const [rows, setRows] = useState<Row[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ n: number; name: string; ok: boolean; msg: string }[] | null>(null);
  const known = useMemo(() => new Set(existing.map((s) => norm(s.studentCode))), [existing]);

  const onFile = async (f: File | undefined) => {
    setRows(null); setResult(null); setParseErr('');
    if (!f) return;
    setFile(f.name);
    try {
      if (f.size > 8 * 1024 * 1024) throw new Error('الحد الأعلى لحجم ملف الاستيراد 8 ميغابايت.');
      const wb = read(await f.arrayBuffer(), { type: 'array', cellDates: true });
      const ws = wb.Sheets[wb.SheetNames[0]];
      if (!ws) throw new Error('الملف لا يحتوي على أوراق.');
      const raw = utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '', raw: true });
      if (raw.length === 0) throw new Error('الملف فارغ: لا توجد صفوف بيانات تحت سطر العناوين.');
      const headers = Object.keys(raw[0]);
      const col: Record<string, string> = {};
      for (const [k, names] of Object.entries(alias)) { const h = headers.find((h) => names.includes(norm(h))); if (h) col[k] = h; }
      if (!col.fullName || !col.studentCode) throw new Error('الأعمدة المطلوبة غير موجودة: يجب وجود عمودي "الاسم الكامل" و"الرقم المدرسي" في السطر الأول.');
      const seen = new Set<string>();
      const out: Row[] = raw.map((r, i) => {
        const g = (k: string) => (col[k] ? cell(r[col[k]]) : '');
        const errors: string[] = [];
        const name = g('fullName'), code = g('studentCode');
        if (!name) errors.push('الاسم فارغ');
        if (!code) errors.push('الرقم المدرسي فارغ');
        if (code && known.has(norm(code))) errors.push('الرقم المدرسي موجود مسبقًا في النظام');
        if (code && seen.has(norm(code))) errors.push('الرقم المدرسي مكرر داخل الملف');
        if (code) seen.add(norm(code));
        const dob = g('dateOfBirth');
        if (dob && !/^\d{4}-\d{2}-\d{2}$/.test(dob)) errors.push('تاريخ الميلاد يجب أن يكون بصيغة YYYY-MM-DD');
        const gender = g('gender');
        if (gender && !GENDERS.includes(gender)) errors.push('الجنس يجب أن يكون "ذكر" أو "أنثى"');
        return { n: i + 2, name, code, errors, input: errors.length ? null : { fullName: name, studentCode: code, gender: gender || null, dateOfBirth: dob || null, guardianName: g('guardianName') || null, guardianPhone: g('guardianPhone') || null, address: g('address') || null, classId: 0, active: true } };
      });
      setRows(out);
    } catch (e) {
      setParseErr(e instanceof Error ? e.message : 'تعذر قراءة الملف');
    }
  };

  const valid = rows?.filter((r) => r.input) ?? [];
  const run = async () => {
    if (!classId || valid.length === 0) return;
    setBusy(true);
    const res: { n: number; name: string; ok: boolean; msg: string }[] = [];
    for (const r of rows!) {
      if (!r.input) { res.push({ n: r.n, name: r.name, ok: false, msg: r.errors.join('، ') }); continue; }
      try { await createStudent({ ...r.input, classId: Number(classId) }); res.push({ n: r.n, name: r.name, ok: true, msg: 'تمت الإضافة' }); }
      catch (e) { res.push({ n: r.n, name: r.name, ok: false, msg: errMsg(e) }); }
    }
    setBusy(false); setResult(res); inv();
  };
  const template = () => exportSheet('قالب-استيراد-الطلاب', 'الطلاب', ['الاسم الكامل', 'الرقم المدرسي', 'الجنس', 'تاريخ الميلاد', 'ولي الأمر', 'هاتف ولي الأمر', 'العنوان'], []);

  return (
    <Modal wide onClose={onClose} title="استيراد الطلاب من Excel" description="اختر الصف ثم الملف. ستظهر معاينة وأخطاء كل سطر قبل أي حفظ."
      footer={result ? <button type="button" className="btn btn-primary" onClick={onClose}>إغلاق</button> : <>
        <button type="button" className="btn btn-primary" disabled={busy || !classId || valid.length === 0 || !allQ.data} onClick={run}>{busy ? 'جارٍ الاستيراد...' : `استيراد ${valid.length} طالب`}</button>
        <button type="button" className="btn btn-outline" disabled={busy} onClick={onClose}>إلغاء</button></>}>
      {result ? (
        <div>
          <div className="mb-3 grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-[hsl(160,40%,90%)] p-3 text-center"><div className="font-display text-2xl font-extrabold">{result.filter((r) => r.ok).length}</div><div className="text-sm">تمت إضافتهم</div></div>
            <div className="rounded-xl bg-[hsl(6,70%,92%)] p-3 text-center"><div className="font-display text-2xl font-extrabold">{result.filter((r) => !r.ok).length}</div><div className="text-sm">مرفوضون</div></div>
          </div>
          <ResultTable rows={result} />
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="الصف الذي سيُسجَّل فيه الطلاب"><ClassSelect value={classId} onChange={setClassId} classes={classes} /></Field>
            <Field label="ملف Excel (XLSX / XLS / CSV)"><input type="file" className="inp pt-2" accept=".xlsx,.xls,.csv" onChange={(e) => onFile(e.target.files?.[0])} /></Field>
          </div>
          <button type="button" className="btn btn-ghost btn-sm" onClick={template}><FileSpreadsheet className="size-4" />تنزيل قالب الاستيراد</button>
          {parseErr && <div role="alert" className="rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm font-medium text-destructive">{parseErr}</div>}
          {rows && (
            <div>
              <p className="mb-2 text-sm">الملف <b>{file}</b>: <span className="font-bold text-[hsl(160,60%,22%)]">{valid.length} صالح</span> و<span className="font-bold text-destructive">{rows.length - valid.length} فيه أخطاء</span>. الصفوف الخاطئة لن تُستورد.</p>
              <div className="tbl-wrap max-h-72 overflow-y-auto"><table className="tbl"><thead><tr><th>السطر</th><th>الاسم</th><th>الرقم</th><th>الحالة</th></tr></thead><tbody>
                {rows.map((r) => <tr key={r.n}><td>{r.n}</td><td>{r.name || '—'}</td><td dir="ltr">{r.code || '—'}</td><td>{r.errors.length ? <span className="text-destructive">{r.errors.join('، ')}</span> : <span className="bd bd-ok">جاهز</span>}</td></tr>)}
              </tbody></table></div>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
function ResultTable({ rows }: { rows: { n: number; name: string; ok: boolean; msg: string }[] }) {
  return <div className="tbl-wrap max-h-80 overflow-y-auto"><table className="tbl"><thead><tr><th>السطر</th><th>الاسم</th><th>النتيجة</th></tr></thead><tbody>
    {rows.map((r) => <tr key={r.n}><td>{r.n}</td><td>{r.name || '—'}</td><td><span className={`inline-flex items-center gap-1.5 ${r.ok ? 'text-[hsl(160,60%,22%)]' : 'text-destructive'}`}>{r.ok ? <CheckCircle2 className="size-4" /> : <XCircle className="size-4" />}{r.msg}</span></td></tr>)}
  </tbody></table></div>;
}

/* ---------- profile ---------- */
function Profile({ s, onClose }: { s: Student; onClose: () => void }) {
  const g = useListGrades({ studentId: s.id }, { query: { queryKey: ['/api/grades', { studentId: s.id }] } });
  const a = useListAttendance({ studentId: s.id }, { query: { queryKey: ['/api/attendance', { studentId: s.id }] } });
  const info: [string, string][] = [
    ['الرقم المدرسي', s.studentCode], ['الباركود', s.barcode], ['الصف', stuClass(s)], ['الجنس', s.gender || '—'], ['تاريخ الميلاد', fmtDate(s.dateOfBirth)],
    ['ولي الأمر', s.guardianName || '—'], ['هاتف ولي الأمر', s.guardianPhone || '—'], ['العنوان', s.address || '—'], ['تاريخ الإضافة', fmtDate(s.createdAt)], ['الحالة', s.active ? 'فعّال' : 'مؤرشف'],
  ];
  const att = a.data ?? [];
  return (
    <Modal wide onClose={onClose} title={s.fullName} description="ملف الطالب للعرض فقط" footer={<button type="button" className="btn btn-outline" onClick={onClose}>إغلاق</button>}>
      <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
        {info.map(([k, v]) => <div key={k}><dt className="text-xs text-muted-foreground">{k}</dt><dd className="font-semibold" dir={k === 'الرقم المدرسي' || k === 'الباركود' || k === 'هاتف ولي الأمر' ? 'ltr' : undefined} style={{ textAlign: 'right' }}>{v}</dd></div>)}
      </dl>
      <h3 className="mb-2 mt-6 font-display font-bold">سجل الدرجات</h3>
      {g.isLoading && <TableSkeleton rows={2} />}
      {g.error && <ErrorState error={g.error} onRetry={() => g.refetch()} />}
      {g.data?.length === 0 && <p className="text-sm text-muted-foreground">لا توجد درجات مسجلة.</p>}
      {!!g.data?.length && <div className="tbl-wrap max-h-60 overflow-y-auto"><table className="tbl"><thead><tr><th>المادة</th><th>الامتحان</th><th>الدرجة</th><th>ملاحظة</th></tr></thead><tbody>
        {g.data.map((x) => <tr key={x.id}><td className="font-semibold">{x.subjectName}</td><td>{x.examTitle}</td><td><span className="num">{x.score} / {x.maxScore}</span></td><td>{x.note || '—'}</td></tr>)}</tbody></table></div>}
      <h3 className="mb-2 mt-6 font-display font-bold">سجل الحضور</h3>
      {a.isLoading && <TableSkeleton rows={2} />}
      {a.error && <ErrorState error={a.error} onRetry={() => a.refetch()} />}
      {a.data && <div className="mb-2 flex flex-wrap gap-2 text-sm">{(['present', 'absent', 'late', 'excused'] as const).map((k) => <span key={k} className={`bd ${attTone[k]}`}>{attLabel[k]}: <span className="num">{att.filter((r) => r.status === k).length}</span></span>)}</div>}
      {a.data?.length === 0 && <p className="text-sm text-muted-foreground">لا توجد سجلات حضور.</p>}
      {!!att.length && <div className="tbl-wrap max-h-60 overflow-y-auto"><table className="tbl"><thead><tr><th>التاريخ</th><th>الحالة</th><th>ملاحظة</th></tr></thead><tbody>
        {att.map((r) => <tr key={r.id}><td>{fmtDate(r.attendanceDate)}</td><td><span className={`bd ${attTone[r.status]}`}>{attLabel[r.status]}</span></td><td>{r.note || '—'}</td></tr>)}</tbody></table></div>}
    </Modal>
  );
}

/* ---------- cards ---------- */
function Cards({ students, school }: { students: Student[]; school: string }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '6mm' }}>
      {students.map((s) => (
        <div key={s.id} style={{ border: '1.5px solid #0d3b5c', borderRadius: 8, padding: '4mm', breakInside: 'avoid', textAlign: 'center', height: '52mm' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#0d3b5c' }}>{school}</div>
          <div style={{ fontSize: 15, fontWeight: 800, margin: '2mm 0 0' }}>{s.fullName}</div>
          <div style={{ fontSize: 11 }}>{stuClass(s)} - الرقم المدرسي {s.studentCode}</div>
          <div style={{ display: 'flex', justifyContent: 'center' }}><BarcodeSvg value={s.barcode} height={38} /></div>
        </div>
      ))}
    </div>
  );
}

export default function Students() {
  const { isManager: isAdmin } = usePerms();
  const classes = useListClasses();
  const { data: settings } = useGetSettings();
  const [search, setSearch] = useState('');
  const [dSearch, setDSearch] = useState('');
  const [cls, setCls] = useState('');
  const [status, setStatus] = useState<'true' | 'false' | 'all'>('true');
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => { clearTimeout(timer.current); timer.current = setTimeout(() => setDSearch(search.trim()), 300); return () => clearTimeout(timer.current); }, [search]);
  const [page, setPage] = useState(1);
  const [year, setYear] = useState('');
  const [sort, setSort] = useState<'name' | 'code' | 'newest'>('name');
  const [prof, setProf] = useState<Student | null>(null);
  const years = useMemo(() => Array.from(new Set([settings?.academicYear, ...(classes.data ?? []).map((c) => c.academicYear)].filter((y): y is string => !!y))).sort().reverse(), [classes.data, settings?.academicYear]);
  const visibleClasses = useMemo(() => (classes.data ?? []).filter((c) => !year || c.academicYear === year), [classes.data, year]);
  const pickYear = (y: string) => { setYear(y); if (cls && y && classes.data?.find((c) => String(c.id) === cls)?.academicYear !== y) setCls(''); };
  useEffect(() => { setPage(1); }, [dSearch, cls, status, year, sort]);
  const filt = { sort, ...(year ? { academicYear: year } : {}), ...(dSearch ? { search: dSearch } : {}), ...(cls ? { classId: Number(cls) } : {}), ...(status !== 'all' ? { active: status === 'true' } : {}) };
  const reg = useGetStudentRegister({ ...filt, page, pageSize: 25 });
  const q = { ...reg, data: reg.data?.records };
  const total = reg.data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / 25));
  const [exporting, setExporting] = useState(false);
  const fetchAll = async () => { setExporting(true); try { return await fetchAllStudents(filt); } catch (e) { fail(e, 'تعذر جلب القائمة'); return null; } finally { setExporting(false); } };
  const inv = useInvalidate();
  const archive = useArchiveStudent();
  const update = useUpdateStudent();
  const [dlg, setDlg] = useState<{ s?: Student } | null>(null);
  const [imp, setImp] = useState(false);
  const [arch, setArch] = useState<Student | null>(null);
  const { print, printNode } = usePrint();
  const school = settings?.schoolName || 'المدرسة';

  const reactivate = (s: Student) => update.mutate({ id: s.id, data: { fullName: s.fullName, studentCode: s.studentCode, gender: s.gender, dateOfBirth: s.dateOfBirth, guardianName: s.guardianName, guardianPhone: s.guardianPhone, address: s.address, classId: s.classId, active: true } },
    { onSuccess: () => { inv(); ok('تمت إعادة تفعيل الطالب'); }, onError: (e) => fail(e, 'تعذر إعادة التفعيل') });
  const doExport = async (fmt: ExportFormat) => {
    const all = await fetchAll();
    if (!all?.length) return;
    exportSheet('الطلاب', 'الطلاب', ['الاسم الكامل', 'الرقم المدرسي', 'الصف', 'الشعبة', 'الجنس', 'تاريخ الميلاد', 'ولي الأمر', 'هاتف ولي الأمر', 'العنوان', 'الحالة'],
      all.map((s) => [s.fullName, s.studentCode, s.className, s.section, s.gender ?? '', s.dateOfBirth?.slice(0, 10) ?? '', s.guardianName ?? '', s.guardianPhone ?? '', s.address ?? '', s.active ? 'فعّال' : 'مؤرشف']), fmt);
    ok('تم تصدير القائمة', `${all.length} طالب حسب المرشحات الحالية`);
  };
  const defaultClass = cls;
  const noClasses = classes.data && classes.data.length === 0;

  return (
    <>
      <PageHeader icon={GraduationCap} title="سجل الطلاب" subtitle="ابحث، أضف، عدّل وأرشف. الأرشفة تحفظ السجل بدل حذفه."
        actions={<>
          <ExportButtons onExport={doExport} disabled={!q.data?.length} busy={exporting} />
          <button type="button" className="btn btn-outline" disabled={!q.data?.length || exporting} onClick={async () => { const all = await fetchAll(); if (all?.length) print(<Cards students={all} school={school} />); }}><Printer className="size-4" />طباعة البطاقات</button>
          {isAdmin && <><button type="button" className="btn btn-outline" onClick={() => setImp(true)} disabled={noClasses}><Upload className="size-4" />استيراد</button>
            <button type="button" className="btn btn-primary" onClick={() => setDlg({})} disabled={noClasses}><Plus className="size-4" />إضافة طالب</button></>}
        </>} />
      {!isAdmin && <ReadOnlyNote text="يمكنك البحث وعرض الطلاب وطباعة البطاقات. الإضافة والتعديل للمدير أو المسجّل." />}
      {noClasses && <div className="mb-4 rounded-xl border border-border bg-accent/20 p-3 text-sm">أنشئ صفًا من صفحة الصفوف والشعب قبل إضافة الطلاب.</div>}
      <div className="panel mb-4 grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1fr_1fr]">
        <div className="relative"><Search className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><input className="inp pr-10" type="search" placeholder="بحث بالاسم أو الرقم المدرسي" aria-label="بحث" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
        <select className="inp" aria-label="السنة الدراسية" value={year} onChange={(e) => pickYear(e.target.value)}><option value="">كل السنوات</option>{years.map((y) => <option key={y} value={y}>{y}</option>)}</select>
        <ClassSelect value={cls} onChange={setCls} classes={visibleClasses} all="كل الصفوف" />
        <select className="inp" aria-label="الترتيب" value={sort} onChange={(e) => setSort(e.target.value as typeof sort)}><option value="name">ترتيب بالاسم</option><option value="code">ترتيب بالرقم المدرسي</option><option value="newest">الأحدث أولًا</option></select>
        <select className="inp" aria-label="الحالة" value={status} onChange={(e) => setStatus(e.target.value as typeof status)}><option value="true">الفعّالون</option><option value="false">المؤرشفون</option><option value="all">الكل</option></select>
      </div>
      {q.isLoading && <TableSkeleton />}
      {q.error && <ErrorState error={q.error} onRetry={() => q.refetch()} />}
      {q.data && q.data.length === 0 && <EmptyState icon={GraduationCap} title={dSearch || cls || year || status !== 'true' ? 'لا نتائج مطابقة' : 'لا يوجد طلاب بعد'} text={dSearch || cls ? 'غيّر البحث أو المرشحات.' : 'أضف الطلاب يدويًا أو استوردهم من ملف Excel.'} />}
      {q.data && q.data.length > 0 && (
        <>
          <p className="mb-2 text-sm text-muted-foreground">النتائج: <span className="num font-bold text-foreground">{total}</span> - صفحة <span className="num">{page}</span> من <span className="num">{pages}</span></p>
          <div className="tbl-wrap"><table className="tbl">
            <thead><tr><th>الطالب</th><th>الرقم المدرسي</th><th>الصف</th><th>ولي الأمر</th><th>تاريخ الإضافة</th><th>الحالة</th><th>إجراءات</th></tr></thead>
            <tbody>{q.data.map((s) => (
              <tr key={s.id}>
                <td className="font-semibold">{s.fullName}</td><td dir="ltr" className="text-right">{s.studentCode}</td><td>{stuClass(s)}</td>
                <td>{s.guardianName || '—'}{s.guardianPhone && <div dir="ltr" className="text-right text-xs text-muted-foreground">{s.guardianPhone}</div>}</td>
                <td>{fmtDate(s.createdAt)}</td>
                <td><span className={`bd ${s.active ? 'bd-ok' : 'bd-mute'}`}>{s.active ? 'فعّال' : 'مؤرشف'}</span></td>
                <td><div className="flex gap-1">
                  <button type="button" className="btn btn-ghost btn-icon" aria-label={`عرض ملف ${s.fullName}`} onClick={() => setProf(s)}><Eye className="size-4" /></button>
                  <button type="button" className="btn btn-ghost btn-icon" aria-label={`بطاقة ${s.fullName}`} onClick={() => print(<Cards students={[s]} school={school} />)}><IdCard className="size-4" /></button>
                  {isAdmin && <button type="button" className="btn btn-ghost btn-icon" aria-label={`تعديل ${s.fullName}`} onClick={() => setDlg({ s })}><Pencil className="size-4" /></button>}
                  {isAdmin && (s.active
                    ? <button type="button" className="btn btn-ghost btn-icon text-destructive" aria-label={`أرشفة ${s.fullName}`} onClick={() => setArch(s)}><Archive className="size-4" /></button>
                    : <button type="button" className="btn btn-ghost btn-icon" aria-label={`إعادة تفعيل ${s.fullName}`} disabled={update.isPending} onClick={() => reactivate(s)}><RotateCcw className="size-4" /></button>)}
                </div></td>
              </tr>))}</tbody>
          </table></div>
          <div className="mt-3 flex items-center justify-between gap-2">
            <button type="button" className="btn btn-outline btn-sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>السابق</button>
            <span className="text-sm text-muted-foreground"><span className="num">{(page - 1) * 25 + 1}</span> - <span className="num">{(page - 1) * 25 + q.data.length}</span></span>
            <button type="button" className="btn btn-outline btn-sm" disabled={page >= pages} onClick={() => setPage(page + 1)}>التالي</button>
          </div>
        </>
      )}
      {dlg && <StudentForm initial={dlg.s} classes={classes.data ?? []} defaultClass={defaultClass} onClose={() => setDlg(null)} />}
      {imp && <ImportDialog classes={classes.data ?? []} defaultClass={defaultClass} onClose={() => setImp(false)} />}
      {arch && <ConfirmDialog title="أرشفة الطالب" description={`سيتم أرشفة ${arch.fullName} وإخراجه من القوائم الفعّالة مع بقاء سجلاته. يمكن إعادة تفعيله لاحقًا.`} confirmLabel="أرشفة" pending={archive.isPending}
        onClose={() => setArch(null)} onConfirm={() => archive.mutate({ id: arch.id }, { onSuccess: () => { inv(); ok('تمت أرشفة الطالب'); setArch(null); }, onError: (e) => { fail(e, 'تعذر الأرشفة'); setArch(null); } })} />}
      {prof && <Profile s={prof} onClose={() => setProf(null)} />}
      {printNode}
    </>
  );
}
