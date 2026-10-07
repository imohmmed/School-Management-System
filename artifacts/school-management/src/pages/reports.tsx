import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FileBarChart, Printer, UserCheck, ClipboardCheck, Users } from 'lucide-react';
import { useListClasses, useListExamSessions, useListSubjects, useListExams, useGetAttendanceReport, useGetGradesReport, useGetSettings, type SchoolClass } from '@workspace/api-client-react';
import { PageHeader, EmptyState, ErrorState, TableSkeleton, ClassSelect, ExportButtons } from '@/components/kit';
import { PrintTable, usePrint } from '@/components/print';
import { ok } from '@/lib/notify';
import { attLabel, attTone, fmtDate, fmtNum, monthStartISO, stuClass, todayISO } from '@/lib/format';
import { exportSheet, type ExportFormat } from '@/lib/xlsx';
import { fetchAllStudents } from '@/lib/students';

function Mini({ l, v, c }: { l: string; v: string | number; c?: string }) {
  return <div className="panel p-4"><div className="text-sm text-muted-foreground">{l}</div><div className={`font-display text-2xl font-extrabold ${c ?? ''}`}><span className="num">{v}</span></div></div>;
}

function useYears(classes: SchoolClass[] | undefined, current?: string) {
  return useMemo(() => Array.from(new Set([current, ...(classes ?? []).map((c) => c.academicYear)].filter((y): y is string => !!y))).sort().reverse(), [classes, current]);
}
function YearSelect({ value, onChange, years }: { value: string; onChange: (v: string) => void; years: string[] }) {
  return <select className="inp" aria-label="السنة الدراسية" value={value} onChange={(e) => onChange(e.target.value)}><option value="">كل السنوات</option>{years.map((y) => <option key={y} value={y}>{y}</option>)}</select>;
}
const classYear = (classes: SchoolClass[] | undefined, id: string) => classes?.find((c) => String(c.id) === id)?.academicYear;

function AttendanceReport() {
  const classes = useListClasses();
  const { data: settings } = useGetSettings();
  const years = useYears(classes.data, settings?.academicYear);
  const [year, setYear] = useState('');
  const [cls, setCls] = useState('');
  const [from, setFrom] = useState(monthStartISO());
  const [to, setTo] = useState(todayISO());
  const visible = (classes.data ?? []).filter((c) => !year || c.academicYear === year);
  const q = useGetAttendanceReport({ from, to, ...(year ? { academicYear: year } : {}), ...(cls ? { classId: Number(cls) } : {}) });
  const { print, printNode } = usePrint();
  const r = q.data;
  const headers = ['التاريخ', 'الطالب', 'الرقم المدرسي', 'الصف', 'الحالة', 'ملاحظة'];
  const rows = () => (r?.records ?? []).map((a) => [a.attendanceDate.slice(0, 10), a.studentName, a.studentCode, stuClass(a), attLabel[a.status], a.note ?? '']);
  const sub = `الفترة من ${fmtDate(from)} إلى ${fmtDate(to)}${year ? ' - ' + year : ''}${cls ? ' - ' + (classes.data?.find((c) => String(c.id) === cls)?.gradeLevel ?? '') : ''}`;
  return (
    <>
      <div className="panel mb-4 grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
        <YearSelect value={year} years={years} onChange={(y) => { setYear(y); if (cls && y && classYear(classes.data, cls) !== y) setCls(''); }} />
        <ClassSelect value={cls} onChange={setCls} classes={visible} all="كل الصفوف" />
        <label className="text-sm"><span className="mb-1 block font-semibold">من</span><input className="inp" type="date" value={from} max={to} onChange={(e) => e.target.value && setFrom(e.target.value)} /></label>
        <label className="text-sm"><span className="mb-1 block font-semibold">إلى</span><input className="inp" type="date" value={to} min={from} onChange={(e) => e.target.value && setTo(e.target.value)} /></label>
      </div>
      {q.isLoading && <TableSkeleton />}
      {q.error && <ErrorState error={q.error} onRetry={() => q.refetch()} />}
      {r && (
        <>
          <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-5">
            <Mini l="الطلاب" v={fmtNum(r.totalStudents)} /><Mini l="حاضر" v={fmtNum(r.presentCount)} c="text-[hsl(160,55%,26%)]" /><Mini l="غائب" v={fmtNum(r.absentCount)} c="text-destructive" /><Mini l="متأخر" v={fmtNum(r.lateCount)} c="text-[hsl(30,85%,30%)]" /><Mini l="بعذر" v={fmtNum(r.excusedCount)} />
          </div>
          <div className="mb-3 flex flex-wrap gap-2">
            <ExportButtons disabled={!r.records.length} onExport={(f) => { exportSheet(`تقرير-الحضور-${from}-${to}`, 'الحضور', headers, rows(), f); ok('تم تصدير التقرير', `${r.records.length} سجل`); }} />
            <button type="button" className="btn btn-outline" disabled={!r.records.length} onClick={() => print(<PrintTable school={settings?.schoolName ?? ''} title="تقرير الحضور والغياب" subtitle={sub} headers={headers} rows={rows()} />)}><Printer className="size-4" />طباعة</button>
          </div>
          {r.records.length === 0 ? <EmptyState icon={UserCheck} title="لا توجد سجلات في هذه الفترة" text="غيّر الفترة أو الصف. لن يُنزَّل ملف فارغ." /> : (
            <div className="tbl-wrap"><table className="tbl"><thead><tr>{headers.map((h) => <th key={h}>{h}</th>)}</tr></thead><tbody>
              {r.records.map((a) => <tr key={a.id}><td>{fmtDate(a.attendanceDate)}</td><td className="font-semibold">{a.studentName}</td><td dir="ltr" className="text-right">{a.studentCode}</td><td>{stuClass(a)}</td><td><span className={`bd ${attTone[a.status]}`}>{attLabel[a.status]}</span></td><td>{a.note || '—'}</td></tr>)}
            </tbody></table></div>
          )}
        </>
      )}
      {printNode}
    </>
  );
}

function GradesReport() {
  const classes = useListClasses();
  const sessions = useListExamSessions();
  const exams = useListExams();
  const { data: settings } = useGetSettings();
  const years = useYears(classes.data, settings?.academicYear);
  const [year, setYear] = useState('');
  const [cls, setCls] = useState('');
  const [ses, setSes] = useState('');
  const [sub, setSub] = useState('');
  const subjects = useListSubjects();
  const visible = (classes.data ?? []).filter((c) => !year || c.academicYear === year);
  const visibleIds = new Set(visible.map((c) => c.id));
  const subjectOptions = (subjects.data ?? []).filter((s) => (cls ? String(s.classId) === cls : visibleIds.has(s.classId)));
  const passingPercentFor = (examId: number) => {
    const exam = exams.data?.find((item) => item.id === examId);
    const subject = subjects.data?.find((item) => item.id === exam?.subjectId);
    return subject ? subject.passingMarks / subject.totalMarks * 100 : null;
  };
  const q = useGetGradesReport({ ...(year ? { academicYear: year } : {}), ...(cls ? { classId: Number(cls) } : {}), ...(ses ? { sessionId: Number(ses) } : {}), ...(sub ? { subjectId: Number(sub) } : {}) });
  const { print, printNode } = usePrint();
  const r = q.data;
  const headers = ['الطالب', 'الرقم المدرسي', 'الصف', 'المادة', 'الامتحان', 'الدرجة', 'العظمى', 'النسبة %'];
  const rows = () => (r?.records ?? []).map((g) => [g.studentName, g.studentCode, g.className, g.subjectName, g.examTitle, g.score, g.maxScore, Number(((g.score / g.maxScore) * 100).toFixed(1))]);
  const pickYear = (y: string) => {
    setYear(y);
    if (!y) return;
    if (cls && classYear(classes.data, cls) !== y) { setCls(''); setSub(''); return; }
    const sc = subjects.data?.find((s) => String(s.id) === sub);
    if (sc && classYear(classes.data, String(sc.classId)) !== y) setSub('');
  };
  return (
    <>
      <div className="panel mb-4 grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
        <YearSelect value={year} years={years} onChange={pickYear} />
        <ClassSelect value={cls} onChange={(v) => { setCls(v); setSub(''); }} classes={visible} all="كل الصفوف" />
        <select className="inp" aria-label="الجلسة" value={ses} onChange={(e) => setSes(e.target.value)}><option value="">كل الجلسات</option>{sessions.data?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
        <select className="inp" aria-label="المادة" value={sub} onChange={(e) => setSub(e.target.value)}><option value="">كل المواد</option>{subjectOptions.map((s) => <option key={s.id} value={s.id}>{s.name}{!cls ? ` - ${s.className}` : ''}</option>)}</select>
      </div>
      {q.isLoading && <TableSkeleton />}
      {q.error && <ErrorState error={q.error} onRetry={() => q.refetch()} />}
      {r && (
        <>
          <div className="mb-4 grid grid-cols-3 gap-3">
            <Mini l="معدل الدرجات" v={`${fmtNum(r.average, 1)}%`} /><Mini l="سجلات ناجحة" v={fmtNum(r.passCount)} c="text-[hsl(160,55%,26%)]" /><Mini l="سجلات راسبة" v={fmtNum(r.failCount)} c="text-destructive" />
          </div>
          <div className="mb-3 flex flex-wrap gap-2">
            <ExportButtons disabled={!r.records.length} onExport={(f) => { exportSheet('تقرير-الدرجات', 'الدرجات', headers, rows(), f); ok('تم تصدير التقرير', `${r.records.length} سجل`); }} />
            <button type="button" className="btn btn-outline" disabled={!r.records.length} onClick={() => print(<PrintTable school={settings?.schoolName ?? ''} title="تقرير الدرجات" subtitle={`${year ? year + ' - ' : ''}المعدل ${fmtNum(r.average, 1)}% - ناجحون ${r.passCount} - راسبون ${r.failCount}`} headers={headers} rows={rows()} />)}><Printer className="size-4" />طباعة</button>
          </div>
          {r.records.length === 0 ? <EmptyState icon={ClipboardCheck} title="لا توجد درجات مطابقة" text="غيّر المرشحات أو أدخل الدرجات أولًا. لن يُنزَّل ملف فارغ." /> : (
            <div className="tbl-wrap"><table className="tbl"><thead><tr>{headers.map((h) => <th key={h}>{h}</th>)}</tr></thead><tbody>
              {r.records.map((g) => { const p = (g.score / g.maxScore) * 100; const threshold = passingPercentFor(g.examId); return <tr key={g.id}><td className="font-semibold">{g.studentName}</td><td dir="ltr" className="text-right">{g.studentCode}</td><td>{g.className}</td><td>{g.subjectName}</td><td>{g.examTitle}</td><td><span className="num">{fmtNum(g.score, 2)}</span></td><td><span className="num">{fmtNum(g.maxScore, 2)}</span></td><td><span className={`bd ${threshold == null ? 'bd-info' : p >= threshold ? 'bd-ok' : 'bd-bad'}`}>{fmtNum(p, 1)}%</span></td></tr>; })}
            </tbody></table></div>
          )}
        </>
      )}
      {printNode}
    </>
  );
}

function RosterReport() {
  const classes = useListClasses();
  const { data: settings } = useGetSettings();
  const years = useYears(classes.data, settings?.academicYear);
  const [year, setYear] = useState('');
  const [cls, setCls] = useState('');
  const [status, setStatus] = useState<'all' | 'true' | 'false'>('true');
  const { print, printNode } = usePrint();
  const visible = (classes.data ?? []).filter((c) => !year || c.academicYear === year);
  const shownClasses = visible.filter((c) => (!cls || String(c.id) === cls) && (status === 'all' || c.active === (status === 'true')));
  const params = { sort: 'name' as const, ...(year ? { academicYear: year } : {}), ...(cls ? { classId: Number(cls) } : {}), ...(status !== 'all' ? { active: status === 'true' } : {}) };
  const q = useQuery({ queryKey: ['/api/students', 'roster', params], queryFn: () => fetchAllStudents(params) });
  const students = q.data ?? [];
  const sHeaders = ['الطالب', 'الرقم المدرسي', 'الصف', 'الجنس', 'ولي الأمر', 'هاتف ولي الأمر', 'الحالة'];
  const sRows = () => students.map((s) => [s.fullName, s.studentCode, stuClass(s), s.gender ?? '', s.guardianName ?? '', s.guardianPhone ?? '', s.active ? 'فعّال' : 'مؤرشف']);
  const cHeaders = ['الصف', 'الشعبة', 'السنة الدراسية', 'القاعة', 'عدد الطلاب', 'الحالة'];
  const cRows = () => shownClasses.map((c) => [c.gradeLevel, c.section, c.academicYear, c.room ?? '', c.studentCount, c.active ? 'فعّال' : 'غير فعّال']);
  const school = settings?.schoolName ?? '';
  const sub = `${year || 'كل السنوات'} - ${status === 'all' ? 'كل الحالات' : status === 'true' ? 'الفعّالون' : 'المؤرشفون'}`;
  const totalInClasses = shownClasses.reduce((n, c) => n + c.studentCount, 0);
  return (
    <>
      <div className="panel mb-4 grid gap-3 p-4 sm:grid-cols-3">
        <YearSelect value={year} years={years} onChange={(y) => { setYear(y); if (cls && y && classYear(classes.data, cls) !== y) setCls(''); }} />
        <ClassSelect value={cls} onChange={setCls} classes={visible} all="كل الصفوف" />
        <select className="inp" aria-label="الحالة" value={status} onChange={(e) => setStatus(e.target.value as typeof status)}><option value="true">الفعّالون</option><option value="false">المؤرشفون</option><option value="all">الكل</option></select>
      </div>
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-3">
        <Mini l="الصفوف المعروضة" v={fmtNum(shownClasses.length)} /><Mini l="الطلاب المطابقون" v={q.data ? fmtNum(students.length) : '—'} /><Mini l="مجموع طلاب الصفوف" v={fmtNum(totalInClasses)} />
      </div>

      <h2 className="mb-2 font-display text-lg font-bold">الصفوف والشعب</h2>
      <div className="mb-3 flex flex-wrap gap-2">
        <ExportButtons disabled={!shownClasses.length} onExport={(f: ExportFormat) => { exportSheet('كشف-الصفوف', 'الصفوف', cHeaders, cRows(), f); ok('تم تصدير كشف الصفوف', `${shownClasses.length} صف`); }} />
        <button type="button" className="btn btn-outline" disabled={!shownClasses.length} onClick={() => print(<PrintTable school={school} title="كشف الصفوف والشعب" subtitle={sub} headers={cHeaders} rows={cRows()} />)}><Printer className="size-4" />طباعة</button>
      </div>
      {classes.isLoading && <TableSkeleton rows={3} />}
      {classes.error && <ErrorState error={classes.error} onRetry={() => classes.refetch()} />}
      {classes.data && shownClasses.length === 0 && <EmptyState icon={Users} title="لا توجد صفوف مطابقة" />}
      {shownClasses.length > 0 && <div className="tbl-wrap mb-8"><table className="tbl"><thead><tr>{cHeaders.map((h) => <th key={h}>{h}</th>)}</tr></thead><tbody>
        {shownClasses.map((c) => <tr key={c.id}><td className="font-semibold">{c.gradeLevel}</td><td>{c.section}</td><td>{c.academicYear}</td><td>{c.room || '—'}</td><td><span className="num">{fmtNum(c.studentCount)}</span></td><td><span className={`bd ${c.active ? 'bd-ok' : 'bd-mute'}`}>{c.active ? 'فعّال' : 'غير فعّال'}</span></td></tr>)}
      </tbody></table></div>}

      <h2 className="mb-2 mt-6 font-display text-lg font-bold">كشف الطلاب</h2>
      <div className="mb-3 flex flex-wrap gap-2">
        <ExportButtons disabled={!students.length} onExport={(f: ExportFormat) => { exportSheet('كشف-الطلاب', 'الطلاب', sHeaders, sRows(), f); ok('تم تصدير كشف الطلاب', `${students.length} طالب`); }} />
        <button type="button" className="btn btn-outline" disabled={!students.length} onClick={() => print(<PrintTable school={school} title="كشف الطلاب" subtitle={`${sub} - العدد ${students.length}`} headers={sHeaders} rows={sRows()} />)}><Printer className="size-4" />طباعة</button>
      </div>
      {q.isLoading && <TableSkeleton />}
      {q.error && <ErrorState error={q.error} onRetry={() => { void q.refetch(); }} />}
      {q.data && students.length === 0 && <EmptyState icon={Users} title="لا يوجد طلاب مطابقون" text="غيّر السنة أو الصف أو الحالة." />}
      {students.length > 0 && <div className="tbl-wrap"><table className="tbl"><thead><tr>{sHeaders.map((h) => <th key={h}>{h}</th>)}</tr></thead><tbody>
        {students.map((s) => <tr key={s.id}><td className="font-semibold">{s.fullName}</td><td dir="ltr" className="text-right">{s.studentCode}</td><td>{stuClass(s)}</td><td>{s.gender || '—'}</td><td>{s.guardianName || '—'}</td><td dir="ltr" className="text-right">{s.guardianPhone || '—'}</td><td><span className={`bd ${s.active ? 'bd-ok' : 'bd-mute'}`}>{s.active ? 'فعّال' : 'مؤرشف'}</span></td></tr>)}
      </tbody></table></div>}
      {printNode}
    </>
  );
}

export default function Reports() {
  const [tab, setTab] = useState<'att' | 'grades' | 'roster'>('att');
  return (
    <>
      <PageHeader icon={FileBarChart} title="التقارير" subtitle="تقارير مباشرة من السجلات المحفوظة، قابلة للتصدير (XLSX وCSV) والطباعة." />
      <div role="tablist" className="mb-4 inline-flex max-w-full overflow-x-auto rounded-xl bg-secondary p-1">
        {([['att', 'الحضور والغياب', UserCheck], ['grades', 'الدرجات والنتائج', ClipboardCheck], ['roster', 'الطلاب والصفوف', Users]] as const).map(([k, l, I]) => (
          <button key={k} role="tab" aria-selected={tab === k} type="button" onClick={() => setTab(k)} className={`flex min-h-10 shrink-0 items-center gap-2 rounded-lg px-4 text-sm font-semibold ${tab === k ? 'bg-card shadow-sm' : 'text-muted-foreground'}`}><I className="size-4" />{l}</button>
        ))}
      </div>
      {tab === 'att' ? <AttendanceReport /> : tab === 'grades' ? <GradesReport /> : <RosterReport />}
    </>
  );
}
