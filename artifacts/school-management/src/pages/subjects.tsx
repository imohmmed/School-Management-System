import { useState } from 'react';
import { BookOpen, Plus, Pencil, Trash2 } from 'lucide-react';
import { useListClasses, useListSubjects, useCreateSubject, useUpdateSubject, useDeleteSubject, type Subject, type SchoolClass } from '@workspace/api-client-react';
import { PageHeader, EmptyState, ErrorState, TableSkeleton, Modal, Field, SaveBar, ConfirmDialog, ReadOnlyNote, ClassSelect } from '@/components/kit';
import { usePerms, useInvalidate } from '@/lib/auth';
import { ok, fail } from '@/lib/notify';
import { fmtNum, stuClass } from '@/lib/format';

function SubjectForm({ initial, classes, defaultClass, onClose }: { initial?: Subject; classes: SchoolClass[]; defaultClass: string; onClose: () => void }) {
  const inv = useInvalidate();
  const create = useCreateSubject();
  const update = useUpdateSubject();
  const [f, setF] = useState({ classId: initial ? String(initial.classId) : defaultClass, name: initial?.name ?? '', code: initial?.code ?? '', totalMarks: String(initial?.totalMarks ?? 100), passingMarks: String(initial?.passingMarks ?? 50) });
  const [tried, setTried] = useState(false);
  const total = Number(f.totalMarks), pass = Number(f.passingMarks);
  const e = {
    classId: !f.classId ? 'اختر الصف' : '',
    name: !f.name.trim() ? 'اسم المادة مطلوب' : '',
    totalMarks: !(total > 0) ? 'أدخل درجة عظمى أكبر من صفر' : '',
    passingMarks: !(pass >= 0) || f.passingMarks === '' ? 'أدخل درجة النجاح' : pass > total ? 'درجة النجاح أكبر من الدرجة العظمى' : '',
  };
  const bad = Object.values(e).some(Boolean);
  const show = (k: keyof typeof e) => (tried ? e[k] : '') || undefined;
  const submit = () => {
    setTried(true);
    if (bad) return;
    const data = { classId: Number(f.classId), name: f.name.trim(), code: f.code.trim() || null, totalMarks: total, passingMarks: pass };
    const opts = { onSuccess: () => { inv(); ok(initial ? 'تم تعديل المادة' : 'تمت إضافة المادة'); onClose(); }, onError: (x: unknown) => fail(x, 'تعذر حفظ المادة') };
    if (initial) update.mutate({ id: initial.id, data }, opts); else create.mutate({ data }, opts);
  };
  return (
    <Modal onClose={onClose} title={initial ? 'تعديل المادة' : 'إضافة مادة'} footer={<SaveBar onClose={onClose} pending={create.isPending || update.isPending} onSubmit={submit} />}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="الصف" error={show('classId')} className="sm:col-span-2"><ClassSelect value={f.classId} onChange={(v) => setF({ ...f, classId: v })} classes={classes} invalid={!!show('classId')} /></Field>
        <Field label="اسم المادة" error={show('name')}><input className="inp" value={f.name} onChange={(x) => setF({ ...f, name: x.target.value })} aria-invalid={!!show('name')} /></Field>
        <Field label="الرمز (اختياري)"><input className="inp" value={f.code} onChange={(x) => setF({ ...f, code: x.target.value })} /></Field>
        <Field label="الدرجة العظمى" error={show('totalMarks')}><input className="inp" type="number" inputMode="decimal" min={0} value={f.totalMarks} onChange={(x) => setF({ ...f, totalMarks: x.target.value })} /></Field>
        <Field label="درجة النجاح" error={show('passingMarks')}><input className="inp" type="number" inputMode="decimal" min={0} value={f.passingMarks} onChange={(x) => setF({ ...f, passingMarks: x.target.value })} /></Field>
      </div>
    </Modal>
  );
}

export default function Subjects() {
  const { isManager: isAdmin } = usePerms();
  const classes = useListClasses();
  const [cls, setCls] = useState('');
  const q = useListSubjects(cls ? { classId: Number(cls) } : undefined);
  const inv = useInvalidate();
  const del = useDeleteSubject();
  const [dlg, setDlg] = useState<{ s?: Subject } | null>(null);
  const [rm, setRm] = useState<Subject | null>(null);
  const add = <button type="button" className="btn btn-primary" onClick={() => setDlg({})} disabled={!classes.data?.length}><Plus className="size-4" />إضافة مادة</button>;
  return (
    <>
      <PageHeader icon={BookOpen} title="المواد الدراسية" subtitle="كل مادة مرتبطة بصف ولها درجة عظمى ودرجة نجاح." actions={isAdmin && add} />
      {!isAdmin && <ReadOnlyNote />}
      <div className="mb-4 max-w-xs"><ClassSelect value={cls} onChange={setCls} classes={classes.data} all="كل الصفوف" /></div>
      {(q.isLoading || classes.isLoading) && <TableSkeleton />}
      {q.error && <ErrorState error={q.error} onRetry={() => q.refetch()} />}
      {q.data && q.data.length === 0 && <EmptyState icon={BookOpen} title="لا توجد مواد" text={classes.data?.length ? 'أضف مواد الصف ليمكن جدولة الامتحانات.' : 'أنشئ صفًا أولًا ثم أضف مواده.'} />}
      {q.data && q.data.length > 0 && (
        <div className="tbl-wrap"><table className="tbl">
          <thead><tr><th>المادة</th><th>الرمز</th><th>الصف</th><th>الدرجة العظمى</th><th>درجة النجاح</th>{isAdmin && <th>إجراءات</th>}</tr></thead>
          <tbody>{q.data.map((s) => (
            <tr key={s.id}><td className="font-semibold">{s.name}</td><td>{s.code || '—'}</td><td>{stuClass({ className: s.className, section: s.section })}</td><td><span className="num">{fmtNum(s.totalMarks, 2)}</span></td><td><span className="num">{fmtNum(s.passingMarks, 2)}</span></td>
              {isAdmin && <td><div className="flex gap-1">
                <button type="button" className="btn btn-ghost btn-icon" aria-label={`تعديل ${s.name}`} onClick={() => setDlg({ s })}><Pencil className="size-4" /></button>
                <button type="button" className="btn btn-ghost btn-icon text-destructive" aria-label={`حذف ${s.name}`} onClick={() => setRm(s)}><Trash2 className="size-4" /></button>
              </div></td>}</tr>))}</tbody>
        </table></div>
      )}
      {dlg && <SubjectForm initial={dlg.s} classes={classes.data ?? []} defaultClass={cls} onClose={() => setDlg(null)} />}
      {rm && <ConfirmDialog title="حذف المادة" description={`سيتم حذف مادة ${rm.name}. قد يرفض الخادم الحذف إن كانت مرتبطة بامتحانات.`} confirmLabel="حذف" pending={del.isPending}
        onClose={() => setRm(null)} onConfirm={() => del.mutate({ id: rm.id }, { onSuccess: () => { inv(); ok('تم حذف المادة'); setRm(null); }, onError: (e) => { fail(e, 'تعذر حذف المادة'); setRm(null); } })} />}
    </>
  );
}
