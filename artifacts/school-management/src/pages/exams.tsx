import { useMemo, useState } from 'react';
import { CalendarDays, Plus, Pencil, Trash2, Printer, Layers } from 'lucide-react';
import {
  useListClasses, useListExamSessions, useCreateExamSession, useUpdateExamSession, useDeleteExamSession,
  useListExams, useCreateExam, useUpdateExam, useDeleteExam, useListSubjects, useGetSettings,
  type ExamSession, type Exam, type SchoolClass,
} from '@workspace/api-client-react';
import { PageHeader, EmptyState, ErrorState, TableSkeleton, Modal, Field, SaveBar, ConfirmDialog, ReadOnlyNote, ClassSelect } from '@/components/kit';
import { PrintTable, usePrint } from '@/components/print';
import { usePerms, useInvalidate } from '@/lib/auth';
import { ok, fail } from '@/lib/notify';
import { fmtDate, fmtNum, stuClass, todayISO } from '@/lib/format';

function SessionForm({ initial, defaultYear, onClose }: { initial?: ExamSession; defaultYear: string; onClose: () => void }) {
  const inv = useInvalidate();
  const create = useCreateExamSession();
  const update = useUpdateExamSession();
  const [f, setF] = useState({ name: initial?.name ?? '', academicYear: initial?.academicYear ?? defaultYear, active: initial?.active ?? true });
  const [tried, setTried] = useState(false);
  const submit = () => {
    setTried(true);
    if (!f.name.trim() || !f.academicYear.trim()) return;
    const data = { name: f.name.trim(), academicYear: f.academicYear.trim(), active: f.active };
    const opts = { onSuccess: () => { inv(); ok(initial ? 'تم تعديل الجلسة' : 'تمت إضافة الجلسة'); onClose(); }, onError: (e: unknown) => fail(e, 'تعذر حفظ الجلسة') };
    if (initial) update.mutate({ id: initial.id, data }, opts); else create.mutate({ data }, opts);
  };
  return (
    <Modal onClose={onClose} title={initial ? 'تعديل جلسة امتحانية' : 'إضافة جلسة امتحانية'} footer={<SaveBar onClose={onClose} pending={create.isPending || update.isPending} onSubmit={submit} />}>
      <div className="grid gap-4">
        <Field label="اسم الجلسة" error={tried && !f.name.trim() ? 'الاسم مطلوب' : undefined}><input className="inp" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="مثال: امتحانات نصف السنة" /></Field>
        <Field label="السنة الدراسية" error={tried && !f.academicYear.trim() ? 'السنة مطلوبة' : undefined}><input className="inp" value={f.academicYear} onChange={(e) => setF({ ...f, academicYear: e.target.value })} /></Field>
        <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" className="size-5 accent-[hsl(205,64%,24%)]" checked={f.active} onChange={(e) => setF({ ...f, active: e.target.checked })} />الجلسة فعّالة</label>
      </div>
    </Modal>
  );
}

function ExamForm({ initial, sessions, classes, exams, defaults, onClose }: { initial?: Exam; sessions: ExamSession[]; classes: SchoolClass[]; exams: Exam[]; defaults: { sessionId: string; classId: string }; onClose: () => void }) {
  const inv = useInvalidate();
  const create = useCreateExam();
  const update = useUpdateExam();
  const [f, setF] = useState({ sessionId: initial ? String(initial.sessionId) : defaults.sessionId, classId: initial ? String(initial.classId) : defaults.classId, subjectId: initial ? String(initial.subjectId) : '', examDate: initial?.examDate?.slice(0, 10) ?? todayISO(), totalMarks: String(initial?.totalMarks ?? '') });
  const [tried, setTried] = useState(false);
  const subjects = useListSubjects(f.classId ? { classId: Number(f.classId) } : undefined, { query: { enabled: !!f.classId, queryKey: ['/api/subjects', { classId: Number(f.classId) }] } });
  const total = Number(f.totalMarks);
  const others = exams.filter((x) => x.id !== initial?.id && String(x.sessionId) === f.sessionId && String(x.classId) === f.classId);
  const e = {
    sessionId: f.sessionId ? '' : 'اختر الجلسة', classId: f.classId ? '' : 'اختر الصف', subjectId: f.subjectId ? '' : 'اختر المادة',
    examDate: f.examDate ? '' : 'اختر التاريخ', totalMarks: total > 0 ? '' : 'أدخل درجة عظمى صحيحة',
  };
  const dup = f.subjectId && others.some((x) => String(x.subjectId) === f.subjectId) ? 'هذه المادة مجدولة لهذا الصف في الجلسة نفسها.' : '';
  const clash = f.examDate && others.some((x) => x.examDate.slice(0, 10) === f.examDate) ? 'يوجد امتحان آخر لهذا الصف في التاريخ نفسه.' : '';
  const sh = (k: keyof typeof e) => (tried ? e[k] : '') || undefined;
  const submit = () => {
    setTried(true);
    if (Object.values(e).some(Boolean) || dup || clash) return;
    const data = { sessionId: Number(f.sessionId), classId: Number(f.classId), subjectId: Number(f.subjectId), examDate: f.examDate, totalMarks: total };
    const opts = { onSuccess: () => { inv(); ok(initial ? 'تم تعديل الامتحان' : 'تمت إضافة الامتحان'); onClose(); }, onError: (x: unknown) => fail(x, 'تعذر حفظ الامتحان') };
    if (initial) update.mutate({ id: initial.id, data }, opts); else create.mutate({ data }, opts);
  };
  return (
    <Modal onClose={onClose} title={initial ? 'تعديل امتحان' : 'إضافة امتحان إلى الجدول'} footer={<SaveBar onClose={onClose} pending={create.isPending || update.isPending} onSubmit={submit} />}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="الجلسة" error={sh('sessionId')}><select className="inp" value={f.sessionId} onChange={(x) => setF({ ...f, sessionId: x.target.value })}><option value="" disabled>اختر الجلسة</option>{sessions.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></Field>
        <Field label="الصف" error={sh('classId')}><ClassSelect value={f.classId} onChange={(v) => setF({ ...f, classId: v, subjectId: '' })} classes={classes} /></Field>
        <Field label="المادة" error={sh('subjectId') || (tried ? dup : '') || undefined}>
          <select className="inp" value={f.subjectId} disabled={!f.classId} onChange={(x) => { const s = subjects.data?.find((y) => String(y.id) === x.target.value); setF({ ...f, subjectId: x.target.value, totalMarks: f.totalMarks || String(s?.totalMarks ?? '') }); }}>
            <option value="" disabled>{f.classId ? (subjects.isLoading ? 'جارٍ التحميل...' : 'اختر المادة') : 'اختر الصف أولًا'}</option>
            {subjects.data?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </Field>
        <Field label="تاريخ الامتحان" error={sh('examDate') || (tried ? clash : '') || undefined}><input className="inp" type="date" value={f.examDate} onChange={(x) => setF({ ...f, examDate: x.target.value })} /></Field>
        <Field label="الدرجة العظمى" error={sh('totalMarks')}><input className="inp" type="number" inputMode="decimal" min={0} value={f.totalMarks} onChange={(x) => setF({ ...f, totalMarks: x.target.value })} /></Field>
      </div>
    </Modal>
  );
}

export default function Exams() {
  const { isManager: isAdmin } = usePerms();
  const [tab, setTab] = useState<'schedule' | 'sessions'>('schedule');
  const classes = useListClasses();
  const sessions = useListExamSessions();
  const { data: settings } = useGetSettings();
  const [fs, setFs] = useState('');
  const [fc, setFc] = useState('');
  const exams = useListExams({ ...(fs ? { sessionId: Number(fs) } : {}), ...(fc ? { classId: Number(fc) } : {}) });
  const inv = useInvalidate();
  const delSession = useDeleteExamSession();
  const delExam = useDeleteExam();
  const [sd, setSd] = useState<{ s?: ExamSession } | null>(null);
  const [ed, setEd] = useState<{ e?: Exam } | null>(null);
  const [rmS, setRmS] = useState<ExamSession | null>(null);
  const [rmE, setRmE] = useState<Exam | null>(null);
  const { print, printNode } = usePrint();
  const sorted = useMemo(() => [...(exams.data ?? [])].sort((a, b) => a.examDate.localeCompare(b.examDate)), [exams.data]);
  const doPrint = () => print(<PrintTable school={settings?.schoolName ?? ''} title="الجدول الامتحاني" subtitle={fs ? sessions.data?.find((s) => String(s.id) === fs)?.name : 'كل الجلسات'}
    headers={['التاريخ', 'الصف', 'المادة', 'الجلسة', 'الدرجة العظمى']} rows={sorted.map((x) => [fmtDate(x.examDate), stuClass(x), x.subjectName, x.sessionName, fmtNum(x.totalMarks, 2)])} />);
  return (
    <>
      <PageHeader icon={CalendarDays} title="الامتحانات" subtitle="جلسات الامتحان والجدول الامتحاني لكل صف ومادة."
        actions={<>
          {tab === 'schedule' && <button type="button" className="btn btn-outline" disabled={!sorted.length} onClick={doPrint}><Printer className="size-4" />طباعة الجدول</button>}
          {isAdmin && (tab === 'schedule'
            ? <button type="button" className="btn btn-primary" disabled={!sessions.data?.length || !classes.data?.length} onClick={() => setEd({})}><Plus className="size-4" />إضافة امتحان</button>
            : <button type="button" className="btn btn-primary" onClick={() => setSd({})}><Plus className="size-4" />إضافة جلسة</button>)}
        </>} />
      {!isAdmin && <ReadOnlyNote />}
      <div role="tablist" className="mb-4 inline-flex rounded-xl bg-secondary p-1">
        {([['schedule', 'الجدول الامتحاني', CalendarDays], ['sessions', 'الجلسات', Layers]] as const).map(([k, l, I]) => (
          <button key={k} role="tab" aria-selected={tab === k} type="button" onClick={() => setTab(k)} className={`flex min-h-10 items-center gap-2 rounded-lg px-4 text-sm font-semibold ${tab === k ? 'bg-card shadow-sm' : 'text-muted-foreground'}`}><I className="size-4" />{l}</button>
        ))}
      </div>

      {tab === 'sessions' && (
        <>
          {sessions.isLoading && <TableSkeleton rows={3} />}
          {sessions.error && <ErrorState error={sessions.error} onRetry={() => sessions.refetch()} />}
          {sessions.data?.length === 0 && <EmptyState icon={Layers} title="لا توجد جلسات امتحانية" text="أنشئ جلسة (مثل نصف السنة) ثم أضف امتحاناتها." />}
          {!!sessions.data?.length && <div className="tbl-wrap"><table className="tbl"><thead><tr><th>الجلسة</th><th>السنة الدراسية</th><th>الحالة</th>{isAdmin && <th>إجراءات</th>}</tr></thead><tbody>
            {sessions.data.map((s) => <tr key={s.id}><td className="font-semibold">{s.name}</td><td>{s.academicYear}</td><td><span className={`bd ${s.active ? 'bd-ok' : 'bd-mute'}`}>{s.active ? 'فعّالة' : 'مغلقة'}</span></td>
              {isAdmin && <td><div className="flex gap-1"><button type="button" className="btn btn-ghost btn-icon" aria-label={`تعديل ${s.name}`} onClick={() => setSd({ s })}><Pencil className="size-4" /></button><button type="button" className="btn btn-ghost btn-icon text-destructive" aria-label={`حذف ${s.name}`} onClick={() => setRmS(s)}><Trash2 className="size-4" /></button></div></td>}</tr>)}
          </tbody></table></div>}
        </>
      )}

      {tab === 'schedule' && (
        <>
          <div className="panel mb-4 grid gap-3 p-4 sm:grid-cols-2">
            <select className="inp" aria-label="الجلسة" value={fs} onChange={(e) => setFs(e.target.value)}><option value="">كل الجلسات</option>{sessions.data?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
            <ClassSelect value={fc} onChange={setFc} classes={classes.data} all="كل الصفوف" />
          </div>
          {exams.isLoading && <TableSkeleton />}
          {exams.error && <ErrorState error={exams.error} onRetry={() => exams.refetch()} />}
          {exams.data?.length === 0 && <EmptyState icon={CalendarDays} title="الجدول فارغ" text={sessions.data?.length ? 'أضف امتحانًا لتظهر مواعيده هنا.' : 'أنشئ جلسة امتحانية أولًا من تبويب الجلسات.'} />}
          {sorted.length > 0 && <div className="tbl-wrap"><table className="tbl"><thead><tr><th>التاريخ</th><th>المادة</th><th>الصف</th><th>الجلسة</th><th>الدرجة العظمى</th>{isAdmin && <th>إجراءات</th>}</tr></thead><tbody>
            {sorted.map((x) => <tr key={x.id}><td>{fmtDate(x.examDate)}</td><td className="font-semibold">{x.subjectName}</td><td>{stuClass(x)}</td><td>{x.sessionName}</td><td><span className="num">{fmtNum(x.totalMarks, 2)}</span></td>
              {isAdmin && <td><div className="flex gap-1"><button type="button" className="btn btn-ghost btn-icon" aria-label="تعديل الامتحان" onClick={() => setEd({ e: x })}><Pencil className="size-4" /></button><button type="button" className="btn btn-ghost btn-icon text-destructive" aria-label="حذف الامتحان" onClick={() => setRmE(x)}><Trash2 className="size-4" /></button></div></td>}</tr>)}
          </tbody></table></div>}
        </>
      )}

      {sd && <SessionForm initial={sd.s} defaultYear={settings?.academicYear ?? ''} onClose={() => setSd(null)} />}
      {ed && <ExamForm initial={ed.e} sessions={sessions.data ?? []} classes={classes.data ?? []} exams={exams.data ?? []} defaults={{ sessionId: fs, classId: fc }} onClose={() => setEd(null)} />}
      {rmS && <ConfirmDialog title="حذف الجلسة" description={`سيتم حذف جلسة ${rmS.name}. قد يرفض الخادم ذلك إن كانت لها امتحانات.`} confirmLabel="حذف" pending={delSession.isPending} onClose={() => setRmS(null)}
        onConfirm={() => delSession.mutate({ id: rmS.id }, { onSuccess: () => { inv(); ok('تم حذف الجلسة'); setRmS(null); }, onError: (e) => { fail(e, 'تعذر حذف الجلسة'); setRmS(null); } })} />}
      {rmE && <ConfirmDialog title="حذف الامتحان" description={`سيتم حذف امتحان ${rmE.subjectName} (${stuClass(rmE)}) وما قد يرتبط به من درجات.`} confirmLabel="حذف" pending={delExam.isPending} onClose={() => setRmE(null)}
        onConfirm={() => delExam.mutate({ id: rmE.id }, { onSuccess: () => { inv(); ok('تم حذف الامتحان'); setRmE(null); }, onError: (e) => { fail(e, 'تعذر حذف الامتحان'); setRmE(null); } })} />}
      {printNode}
    </>
  );
}
