import { useEffect, useMemo, useRef, useState } from 'react';
import { ClipboardCheck, Save, Undo2, Search } from 'lucide-react';
import { useListExams, useListStudents, useListGrades, useSaveGrades, useListSubjects, useListClasses, useListExamSessions } from '@workspace/api-client-react';
import { PageHeader, EmptyState, ErrorState, TableSkeleton, ReadOnlyNote, ClassSelect } from '@/components/kit';
import { usePerms, useInvalidate } from '@/lib/auth';
import { ok, fail } from '@/lib/notify';
import { fmtDate, fmtNum, stuClass } from '@/lib/format';
import { unsaved } from '@/lib/guard';

type Entry = { score: string; note: string };
type Sheet = Record<number, Entry>;
type Audit = 'all' | 'missing' | 'invalid';

export default function Grades() {
  const { canTeach } = usePerms();
  const subjects = useListSubjects();
  const exams = useListExams();
  const classes = useListClasses();
  const sessions = useListExamSessions();
  const [fc, setFc] = useState('');
  const [fsub, setFsub] = useState('');
  const [fses, setFses] = useState('');
  const [examId, setExamId] = useState('');
  const [search, setSearch] = useState('');
  const [audit, setAudit] = useState<Audit>('all');
  const exam = exams.data?.find((e) => String(e.id) === examId);
  const students = useListStudents(exam ? { classId: exam.classId, active: true } : undefined, { query: { enabled: !!exam, queryKey: ['/api/students', { classId: exam?.classId, active: true }] } });
  const grades = useListGrades(exam ? { examId: exam.id } : undefined, { query: { enabled: !!exam, queryKey: ['/api/grades', { examId: exam?.id }] } });
  const save = useSaveGrades();
  const inv = useInvalidate();
  // Drafts are kept per exam so switching exams or filters never discards typed values.
  const [drafts, setDrafts] = useState<Record<string, Sheet>>({});
  const bases = useRef<Record<string, Sheet>>({});
  const [tried, setTried] = useState(false);
  const vals: Sheet = drafts[examId] ?? {};
  const base: Sheet = bases.current[examId] ?? {};

  useEffect(() => {
    if (!exam || !grades.data || !students.data || drafts[examId]) return;
    const m: Sheet = {};
    for (const s of students.data) m[s.id] = { score: '', note: '' };
    for (const g of grades.data) m[g.studentId] = { score: String(g.score), note: g.note ?? '' };
    bases.current[examId] = structuredClone(m);
    setDrafts((d) => ({ ...d, [examId]: m }));
    setTried(false);
  }, [exam, examId, grades.data, students.data, drafts]);

  const ready = !!exam && !!drafts[examId];
  const sheetDirty = (id: string) => { const v = drafts[id], b = bases.current[id]; return !!v && !!b && Object.keys(v).some((k) => { const a = v[+k], c = b[+k]; return !c || a.score !== c.score || a.note !== c.note; }); };
  const dirtyIds = Object.keys(drafts).filter(sheetDirty);
  const dirty = dirtyIds.length > 0;
  const currentDirty = ready && dirtyIds.includes(examId);
  useEffect(() => {
    unsaved.dirty = dirty;
    const h = (e: BeforeUnloadEvent) => { if (unsaved.dirty) { e.preventDefault(); e.returnValue = ''; } };
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, [dirty]);
  useEffect(() => () => { unsaved.dirty = false; }, []);

  const errorFor = (e: Entry) => {
    if (e.score === '') return '';
    const n = Number(e.score);
    if (Number.isNaN(n)) return 'قيمة غير صحيحة';
    if (n < 0) return 'لا يمكن أن تكون سالبة';
    if (exam && n > exam.totalMarks) return `أكبر من ${fmtNum(exam.totalMarks, 2)}`;
    return '';
  };
  const reasonErr = (id: number, e: Entry) => {
    const b = base[id];
    if (!b || b.score === '' || e.score === '' || Number(b.score) === Number(e.score)) return '';
    return e.note.trim() && e.note.trim() !== b.note.trim() ? '' : 'اكتب سبب التصحيح في الملاحظة';
  };
  const issue = (id: number) => { const e = vals[id] ?? { score: '', note: '' }; return errorFor(e) || reasonErr(id, e); };
  const hasErr = Object.keys(vals).some((id) => issue(+id));
  const filled = Object.values(vals).filter((e) => e.score !== '').length;

  const setEntry = (id: number, patch: Partial<Entry>) => setDrafts((d) => ({ ...d, [examId]: { ...d[examId], [id]: { ...(d[examId]?.[id] ?? { score: '', note: '' }), ...patch } } }));
  const submit = () => {
    setTried(true);
    if (!exam || hasErr || filled === 0) return;
    const body = Object.entries(vals).filter(([, e]) => e.score !== '').map(([id, e]) => ({ studentId: Number(id), score: Number(e.score), note: e.note.trim() || null }));
    const sent = structuredClone(vals);
    const key = examId;
    save.mutate({ data: { examId: exam.id, grades: body } }, {
      onSuccess: () => { bases.current[key] = sent; setDrafts((d) => ({ ...d })); inv(); ok('تم حفظ الدرجات', `${body.length} طالب`); },
      onError: (e) => fail(e, 'لم تُحفظ الدرجات'),
    });
  };
  const discard = () => setDrafts((d) => ({ ...d, [examId]: structuredClone(bases.current[examId]) }));

  const subject = subjects.data?.find((item) => item.id === exam?.subjectId);
  const passPct = subject ? subject.passingMarks / subject.totalMarks * 100 : null;

  const subjectOptions = useMemo(() => (subjects.data ?? []).filter((s) => !fc || String(s.classId) === fc), [subjects.data, fc]);
  const examOptions = useMemo(() => {
    const list = (exams.data ?? []).filter((x) => (!fc || String(x.classId) === fc) && (!fsub || String(x.subjectId) === fsub) && (!fses || String(x.sessionId) === fses));
    if (exam && !list.some((x) => x.id === exam.id)) list.unshift(exam);
    return list;
  }, [exams.data, fc, fsub, fses, exam]);
  const pickClass = (v: string) => { setFc(v); if (fsub && v && subjects.data?.find((s) => String(s.id) === fsub)?.classId !== Number(v)) setFsub(''); };

  const all = useMemo(() => [...(students.data ?? [])].sort((a, b) => a.fullName.localeCompare(b.fullName, 'ar')), [students.data]);
  const term = search.trim().toLowerCase();
  const missing = all.filter((s) => (vals[s.id]?.score ?? '') === '').length;
  const invalid = all.filter((s) => issue(s.id)).length;
  const sorted = all.filter((s) => (!term || s.fullName.toLowerCase().includes(term) || s.studentCode.toLowerCase().includes(term))
    && (audit === 'all' || (audit === 'missing' ? (vals[s.id]?.score ?? '') === '' : !!issue(s.id))));
  const loading = !!exam && (students.isLoading || grades.isLoading);
  const error = students.error || grades.error;

  return (
    <>
      <PageHeader icon={ClipboardCheck} title="الدرجات" subtitle="اختر الامتحان، أدخل الدرجات ثم احفظها دفعة واحدة. تصحيح درجة محفوظة يتطلب كتابة السبب في الملاحظة."
        actions={canTeach && ready && <>
          <button type="button" className="btn btn-outline" disabled={!currentDirty || save.isPending} onClick={discard}><Undo2 className="size-4" />تراجع</button>
          <button type="button" className="btn btn-primary" disabled={!currentDirty || save.isPending} onClick={submit}><Save className="size-4" />{save.isPending ? 'جارٍ الحفظ...' : 'حفظ الدرجات'}</button>
        </>} />
      {!canTeach && <ReadOnlyNote text="حسابك بصلاحية عرض فقط. إدخال الدرجات للمدير والمسجّل والمعلمين." />}
      <div className="panel mb-4 grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3">
        <ClassSelect value={fc} onChange={pickClass} classes={classes.data} all="كل الصفوف" />
        <select className="inp" aria-label="المادة" value={fsub} onChange={(e) => setFsub(e.target.value)}><option value="">كل المواد</option>{subjectOptions.map((s) => <option key={s.id} value={s.id}>{s.name}{!fc ? ` - ${s.className}` : ''}</option>)}</select>
        <select className="inp" aria-label="الجلسة" value={fses} onChange={(e) => setFses(e.target.value)}><option value="">كل الجلسات</option>{sessions.data?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
        <label className="text-sm sm:col-span-2 lg:col-span-3"><span className="mb-1.5 block font-semibold">الامتحان</span>
          <select className="inp" value={examId} onChange={(e) => { setExamId(e.target.value); setTried(false); setSearch(''); setAudit('all'); }} disabled={exams.isLoading}>
            <option value="">{exams.isLoading ? 'جارٍ التحميل...' : examOptions.length ? 'اختر الامتحان' : 'لا توجد امتحانات مطابقة'}</option>
            {examOptions.map((x) => <option key={x.id} value={x.id}>{x.subjectName} - {stuClass(x)} - {x.sessionName} ({fmtDate(x.examDate)}){dirtyIds.includes(String(x.id)) ? ' - تعديلات غير محفوظة' : ''}</option>)}
          </select>
        </label>
        {exam && <p className="text-sm text-muted-foreground sm:col-span-2 lg:col-span-3">الدرجة العظمى <b className="num text-foreground">{fmtNum(exam.totalMarks, 2)}</b>{passPct !== null && <> - نسبة النجاح المعتمدة للمادة <b className="num text-foreground">{fmtNum(passPct, 1)}%</b></>}</p>}
      </div>
      {dirty && <div role="status" className="mb-4 rounded-xl border border-accent bg-accent/20 px-4 py-2 text-sm font-semibold">لديك تعديلات غير محفوظة في <span className="num">{dirtyIds.length}</span> امتحان. تبقى محفوظة محليًا عند تبديل الامتحان أو المرشحات، ولا تُرسل إلا بزر الحفظ لكل امتحان.</div>}
      {exams.error && <ErrorState error={exams.error} onRetry={() => exams.refetch()} />}
      {exams.data?.length === 0 && <EmptyState icon={ClipboardCheck} title="لا توجد امتحانات" text="أضف امتحانات إلى الجدول الامتحاني لتتمكن من إدخال درجاتها." />}
      {!exam && !!exams.data?.length && <EmptyState icon={ClipboardCheck} title="اختر امتحانًا للبدء" />}
      {loading && <TableSkeleton />}
      {error && <ErrorState error={error} onRetry={() => { void students.refetch(); void grades.refetch(); }} />}
      {ready && !loading && !error && all.length === 0 && <EmptyState icon={ClipboardCheck} title="لا يوجد طلاب فعّالون في هذا الصف" />}
      {ready && all.length > 0 && (
        <>
          <div className="panel mb-3 grid gap-3 p-4 lg:grid-cols-[2fr_auto] lg:items-center">
            <div className="relative"><Search className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><input className="inp pr-10" type="search" aria-label="بحث عن طالب" placeholder="ابحث بالاسم أو الرقم المدرسي" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
            <div role="group" aria-label="تدقيق الإدخال" className="grid grid-cols-3 overflow-hidden rounded-xl border border-input">
              {([['all', 'عرض الكل'], ['missing', 'الناقص'], ['invalid', 'الخاطئ']] as const).map(([k, l]) => (
                <button key={k} type="button" aria-pressed={audit === k} onClick={() => setAudit(k)} className={`min-h-10 px-4 text-sm font-semibold ${audit === k ? 'bg-primary text-primary-foreground' : 'bg-card hover:bg-muted'}`}>{l}</button>
              ))}
            </div>
          </div>
          <div className="mb-3 flex flex-wrap gap-2 text-sm">
            <span className="bd bd-mute">الإجمالي: <span className="num">{all.length}</span></span>
            <span className="bd bd-ok">مُدخَل: <span className="num">{filled}</span></span>
            <span className="bd bd-warn">ناقص: <span className="num">{missing}</span></span>
            <span className="bd bd-bad">خاطئ: <span className="num">{invalid}</span></span>
            {currentDirty && <span className="bd bd-warn">تعديلات غير محفوظة</span>}
          </div>
          {sorted.length === 0 ? <EmptyState icon={ClipboardCheck} title="لا طلاب مطابقون" text="غيّر البحث أو عرض التدقيق." /> : (
          <div className="tbl-wrap"><table className="tbl">
            <thead><tr><th>الطالب</th><th>الرقم</th><th className="w-40">الدرجة</th><th>النتيجة</th><th>ملاحظة</th></tr></thead>
            <tbody>{sorted.map((s) => {
              const e = vals[s.id] ?? { score: '', note: '' };
              const er = errorFor(e);
              const rs = er ? '' : reasonErr(s.id, e);
              const pct = e.score !== '' && !er && exam ? (Number(e.score) / exam.totalMarks) * 100 : null;
              return (
                <tr key={s.id}>
                  <td className="font-semibold">{s.fullName}</td><td dir="ltr" className="text-right">{s.studentCode}</td>
                  <td>
                    <input className="inp" type="number" inputMode="decimal" min={0} max={exam?.totalMarks} step="any" aria-label={`درجة ${s.fullName}`} aria-invalid={!!er} disabled={!canTeach} value={e.score} onChange={(x) => setEntry(s.id, { score: x.target.value })} />
                    {er && <span role="alert" className="mt-1 block text-xs font-medium text-destructive">{er}</span>}
                  </td>
                  <td>{pct == null || passPct == null ? <span className="text-muted-foreground">—</span> : <span className={`bd ${pct >= passPct ? 'bd-ok' : 'bd-bad'}`}>{pct >= passPct ? 'ناجح' : 'راسب'} - {fmtNum(pct, 1)}%</span>}</td>
                  <td className="min-w-48"><input className="inp" aria-label={`ملاحظة ${s.fullName}`} disabled={!canTeach} value={e.note} placeholder={base[s.id]?.score ? 'سبب التصحيح عند تغيير الدرجة' : 'اختياري'} aria-invalid={!!rs} onChange={(x) => setEntry(s.id, { note: x.target.value })} />{rs && <span role="alert" className="mt-1 block text-xs font-medium text-destructive">{rs}</span>}</td>
                </tr>
              );
            })}</tbody>
          </table></div>)}
          {tried && hasErr && <p role="alert" className="mt-3 text-sm font-semibold text-destructive">صحّح الدرجات والملاحظات المشار إليها قبل الحفظ. استخدم عرض "الخاطئ" للوصول إليها.</p>}
          {tried && filled === 0 && <p role="alert" className="mt-3 text-sm font-semibold text-destructive">لم تُدخل أي درجة.</p>}
        </>
      )}
    </>
  );
}
