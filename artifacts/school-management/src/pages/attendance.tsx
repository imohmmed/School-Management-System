import { useMemo, useState } from 'react';
import { UserCheck, Trash2, Pencil, Search, CheckCheck, History as HistoryIcon, ListChecks } from 'lucide-react';
import { useListClasses, useListStudents, useListAttendance, useRecordAttendance, useRecordClassAttendance, useDeleteAttendance, type Attendance, type AttendanceStatus } from '@workspace/api-client-react';
import { PageHeader, EmptyState, ErrorState, TableSkeleton, ReadOnlyNote, ClassSelect, ConfirmDialog, Modal, Field, SaveBar } from '@/components/kit';
import { usePerms, useInvalidate } from '@/lib/auth';
import { ok, fail } from '@/lib/notify';
import { attLabel, attTone, fmtDate, monthStartISO, stuClass, todayISO } from '@/lib/format';

const STATUSES: AttendanceStatus[] = ['present', 'absent', 'late', 'excused'];
const segOn: Record<string, string> = { present: 'bg-[hsl(160,55%,26%)] text-white', absent: 'bg-destructive text-white', late: 'bg-[hsl(36,90%,40%)] text-white', excused: 'bg-primary text-primary-foreground' };

function EditModal({ a, onClose }: { a: Attendance; onClose: () => void }) {
  const rec = useRecordAttendance();
  const inv = useInvalidate();
  const [status, setStatus] = useState<AttendanceStatus>(a.status);
  const [note, setNote] = useState(a.note ?? '');
  const submit = () => rec.mutate({ data: { studentId: a.studentId, attendanceDate: a.attendanceDate.slice(0, 10), status, note: note.trim() || null } },
    { onSuccess: () => { inv(); ok('تم تعديل سجل الحضور'); onClose(); }, onError: (e) => fail(e, 'تعذر تعديل السجل') });
  return (
    <Modal onClose={onClose} title="تعديل سجل الحضور" description={`${a.studentName} - ${fmtDate(a.attendanceDate)}`} footer={<SaveBar onClose={onClose} pending={rec.isPending} onSubmit={submit} />}>
      <div className="grid gap-4">
        <Field label="الحالة"><select className="inp" value={status} onChange={(e) => setStatus(e.target.value as AttendanceStatus)}>{STATUSES.map((x) => <option key={x} value={x}>{attLabel[x]}</option>)}</select></Field>
        <Field label="ملاحظة" hint="اختيارية، حتى 500 حرف"><input className="inp" maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} /></Field>
      </div>
    </Modal>
  );
}

function Daily() {
  const { canTeach } = usePerms();
  const classes = useListClasses();
  const [cls, setCls] = useState('');
  const [date, setDate] = useState(todayISO());
  const classId = cls ? Number(cls) : undefined;
  const students = useListStudents(classId ? { classId, active: true } : undefined, { query: { enabled: !!classId, queryKey: ['/api/students', { classId, active: true }] } });
  const att = useListAttendance(classId ? { from: date, to: date, classId } : undefined, { query: { enabled: !!classId, queryKey: ['/api/attendance', { from: date, to: date, classId }] } });
  const rec = useRecordAttendance();
  const del = useDeleteAttendance();
  const inv = useInvalidate();
  const [busy, setBusy] = useState<number | null>(null);
  const bulkM = useRecordClassAttendance();
  const bulk = bulkM.isPending;
  const [edit, setEdit] = useState<Attendance | null>(null);
  const [rm, setRm] = useState<Attendance | null>(null);
  const byStudent = useMemo(() => new Map((att.data ?? []).map((a) => [a.studentId, a])), [att.data]);
  const sorted = useMemo(() => [...(students.data ?? [])].sort((a, b) => a.fullName.localeCompare(b.fullName, 'ar')), [students.data]);

  const set = (studentId: number, status: AttendanceStatus) => {
    setBusy(studentId);
    rec.mutate({ data: { studentId, attendanceDate: date, status } }, { onSuccess: () => inv(), onError: (e) => fail(e, 'لم يُسجَّل الحضور'), onSettled: () => setBusy(null) });
  };
  const markRest = () => {
    if (!classId) return;
    bulkM.mutate({ data: { classId, attendanceDate: date } }, {
      onSuccess: (r) => { inv(); ok('تم تسجيل الحضور', `سُجّل ${r.savedCount} طالب حاضرًا، وتُرك ${r.skippedCount} لديهم سجل سابق دون تغيير.`); },
      onError: (e) => fail(e, 'لم يُسجَّل الحضور الجماعي'),
    });
  };
  const counts = STATUSES.map((s) => [s, (att.data ?? []).filter((a) => a.status === s).length] as const);
  const error = students.error || att.error;

  return (
    <>
      <div className="panel mb-4 grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_auto]">
        <ClassSelect value={cls} onChange={setCls} classes={classes.data?.filter((c) => c.active)} />
        <input className="inp" type="date" aria-label="التاريخ" value={date} max={todayISO()} onChange={(e) => e.target.value && setDate(e.target.value)} />
        {canTeach && <button type="button" className="btn btn-outline" disabled={!sorted.length || bulk || sorted.every((s) => byStudent.has(s.id))} onClick={markRest}><CheckCheck className="size-4" />{bulk ? 'جارٍ التسجيل...' : 'تسجيل الباقين حاضرين'}</button>}
      </div>
      {!cls && <EmptyState icon={UserCheck} title="اختر الصف" text="اختر الصف والتاريخ لعرض قائمة الطلاب وتسجيل حضورهم." />}
      {cls && (students.isLoading || att.isLoading) && <TableSkeleton />}
      {cls && error && <ErrorState error={error} onRetry={() => { void students.refetch(); void att.refetch(); }} />}
      {cls && students.data && att.data && sorted.length === 0 && <EmptyState icon={UserCheck} title="لا يوجد طلاب فعّالون في هذا الصف" />}
      {cls && students.data && att.data && sorted.length > 0 && (
        <>
          <div className="mb-3 flex flex-wrap gap-2 text-sm">
            {counts.map(([s, n]) => <span key={s} className={`bd ${attTone[s]}`}>{attLabel[s]}: <span className="num">{n}</span></span>)}
            <span className="bd bd-mute">غير مسجّل: <span className="num">{sorted.length - byStudent.size}</span></span>
          </div>
          <ul className="panel divide-y divide-border">
            {sorted.map((s) => {
              const a = byStudent.get(s.id);
              return (
                <li key={s.id} className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0"><div className="font-semibold">{s.fullName}{a?.note && <span className="mr-2 text-xs font-normal text-muted-foreground">- {a.note}</span>}</div><div className="text-xs text-muted-foreground" dir="ltr" style={{ textAlign: 'right' }}>{s.studentCode}</div></div>
                  <div className="flex items-center gap-2">
                    <div role="group" aria-label={`حالة ${s.fullName}`} className="grid flex-1 grid-cols-4 overflow-hidden rounded-xl border border-input sm:w-80 sm:flex-none">
                      {STATUSES.map((st) => (
                        <button key={st} type="button" disabled={!canTeach || busy === s.id} aria-pressed={a?.status === st} onClick={() => a?.status !== st && set(s.id, st)}
                          className={`min-h-11 px-1 text-xs font-semibold transition-colors disabled:cursor-not-allowed sm:text-sm ${a?.status === st ? segOn[st] : 'bg-card hover:bg-muted'}`}>{attLabel[st]}</button>
                      ))}
                    </div>
                    {canTeach && <button type="button" className="btn btn-ghost btn-icon shrink-0" aria-label={`تعديل ملاحظة ${s.fullName}`} disabled={!a} onClick={() => a && setEdit(a)}><Pencil className="size-4" /></button>}
                    {canTeach && <button type="button" className="btn btn-ghost btn-icon shrink-0 text-destructive" aria-label={`إلغاء تسجيل ${s.fullName}`} disabled={!a} onClick={() => a && setRm(a)}><Trash2 className="size-4" /></button>}
                  </div>
                </li>
              );
            })}
          </ul>
          <p className="mt-2 text-xs text-muted-foreground">يُحفظ كل اختيار فور النقر. إعادة الاختيار تعدّل سجل الطالب لنفس اليوم.</p>
        </>
      )}
      {edit && <EditModal a={edit} onClose={() => setEdit(null)} />}
      {rm && <ConfirmDialog title="إلغاء تسجيل الحضور" description={`سيُحذف سجل ${rm.studentName} بتاريخ ${fmtDate(rm.attendanceDate)}.`} confirmLabel="إلغاء التسجيل" pending={del.isPending} onClose={() => setRm(null)}
        onConfirm={() => del.mutate({ id: rm.id }, { onSuccess: () => { inv(); ok('أُلغي السجل'); setRm(null); }, onError: (e) => { fail(e, 'تعذر الإلغاء'); setRm(null); } })} />}
    </>
  );
}

function History() {
  const { canTeach } = usePerms();
  const classes = useListClasses();
  const [cls, setCls] = useState('');
  const [from, setFrom] = useState(monthStartISO());
  const [to, setTo] = useState(todayISO());
  const q = useListAttendance({ from, to, ...(cls ? { classId: Number(cls) } : {}) });
  const del = useDeleteAttendance();
  const inv = useInvalidate();
  const [rm, setRm] = useState<Attendance | null>(null);
  const [edit, setEdit] = useState<Attendance | null>(null);
  const [term, setTerm] = useState('');
  const [st, setSt] = useState('');
  const t = term.trim().toLowerCase();
  const rows = (q.data ?? []).filter((a) => (!st || (st === 'issues' ? a.status !== 'present' : a.status === st)) && (!t || a.studentName.toLowerCase().includes(t) || a.studentCode.toLowerCase().includes(t)));
  return (
    <>
      <div className="panel mb-4 grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-5">
        <div className="relative"><Search className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><input className="inp pr-10" type="search" aria-label="بحث عن طالب" placeholder="اسم الطالب أو رقمه" value={term} onChange={(e) => setTerm(e.target.value)} /></div>
        <select className="inp" aria-label="الحالة" value={st} onChange={(e) => setSt(e.target.value)}><option value="">كل الحالات</option><option value="issues">كل الغيابات والتأخر</option>{STATUSES.map((x) => <option key={x} value={x}>{attLabel[x]}</option>)}</select>
        <ClassSelect value={cls} onChange={setCls} classes={classes.data} all="كل الصفوف" />
        <label className="text-sm"><span className="mb-1 block font-semibold">من</span><input className="inp" type="date" value={from} max={to} onChange={(e) => e.target.value && setFrom(e.target.value)} /></label>
        <label className="text-sm"><span className="mb-1 block font-semibold">إلى</span><input className="inp" type="date" value={to} min={from} onChange={(e) => e.target.value && setTo(e.target.value)} /></label>
      </div>
      {q.isLoading && <TableSkeleton />}
      {q.error && <ErrorState error={q.error} onRetry={() => q.refetch()} />}
      {q.data && rows.length === 0 && <EmptyState icon={HistoryIcon} title={q.data.length ? 'لا سجلات مطابقة للبحث' : 'لا توجد سجلات في هذه الفترة'} />}
      {rows.length > 0 && <p className="mb-2 text-sm text-muted-foreground">السجلات: <span className="num font-bold text-foreground">{rows.length}</span></p>}
      {!!rows.length && <div className="tbl-wrap"><table className="tbl"><thead><tr><th>التاريخ</th><th>الطالب</th><th>الصف</th><th>الحالة</th><th>ملاحظة</th>{canTeach && <th>إجراء</th>}</tr></thead><tbody>
        {rows.map((a) => <tr key={a.id}><td>{fmtDate(a.attendanceDate)}</td><td className="font-semibold">{a.studentName}</td><td>{stuClass(a)}</td><td><span className={`bd ${attTone[a.status]}`}>{attLabel[a.status]}</span></td><td>{a.note || '—'}</td>
          {canTeach && <td><div className="flex gap-1"><button type="button" className="btn btn-ghost btn-icon" aria-label={`تعديل سجل ${a.studentName}`} onClick={() => setEdit(a)}><Pencil className="size-4" /></button><button type="button" className="btn btn-ghost btn-icon text-destructive" aria-label={`حذف سجل ${a.studentName}`} onClick={() => setRm(a)}><Trash2 className="size-4" /></button></div></td>}</tr>)}
      </tbody></table></div>}
      {edit && <EditModal a={edit} onClose={() => setEdit(null)} />}
      {rm && <ConfirmDialog title="حذف سجل الحضور" description={`سيُحذف سجل ${rm.studentName} بتاريخ ${fmtDate(rm.attendanceDate)}.`} confirmLabel="حذف" pending={del.isPending} onClose={() => setRm(null)}
        onConfirm={() => del.mutate({ id: rm.id }, { onSuccess: () => { inv(); ok('تم حذف السجل'); setRm(null); }, onError: (e) => { fail(e, 'تعذر الحذف'); setRm(null); } })} />}
    </>
  );
}

export default function AttendancePage() {
  const { canTeach } = usePerms();
  const [tab, setTab] = useState<'daily' | 'history'>('daily');
  return (
    <>
      <PageHeader icon={UserCheck} title="الحضور والغياب" subtitle="سجّل حضور الصف يوم بيوم، وراجع السجل وصحّحه عند الحاجة." />
      {!canTeach && <ReadOnlyNote />}
      <div role="tablist" className="mb-4 inline-flex rounded-xl bg-secondary p-1">
        {([['daily', 'التسجيل اليومي', ListChecks], ['history', 'السجل', HistoryIcon]] as const).map(([k, l, I]) => (
          <button key={k} role="tab" aria-selected={tab === k} type="button" onClick={() => setTab(k)} className={`flex min-h-10 items-center gap-2 rounded-lg px-4 text-sm font-semibold ${tab === k ? 'bg-card shadow-sm' : 'text-muted-foreground'}`}><I className="size-4" />{l}</button>
        ))}
      </div>
      {tab === 'daily' ? <Daily /> : <History />}
    </>
  );
}
