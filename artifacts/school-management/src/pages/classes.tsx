import { useState } from 'react';
import { Building2, Plus, Pencil, Trash2 } from 'lucide-react';
import { useListClasses, useCreateClass, useUpdateClass, useDeleteClass, useGetSettings, type SchoolClass } from '@workspace/api-client-react';
import { PageHeader, EmptyState, ErrorState, TableSkeleton, Modal, Field, SaveBar, ConfirmDialog, ReadOnlyNote } from '@/components/kit';
import { usePerms, useInvalidate } from '@/lib/auth';
import { ok, fail } from '@/lib/notify';
import { fmtNum } from '@/lib/format';

function ClassForm({ initial, defaultYear, onClose }: { initial?: SchoolClass; defaultYear: string; onClose: () => void }) {
  const inv = useInvalidate();
  const create = useCreateClass();
  const update = useUpdateClass();
  const [f, setF] = useState({ gradeLevel: initial?.gradeLevel ?? '', section: initial?.section ?? '', academicYear: initial?.academicYear ?? defaultYear, room: initial?.room ?? '', active: initial?.active ?? true });
  const [tried, setTried] = useState(false);
  const pending = create.isPending || update.isPending;
  const err = (v: string) => (tried && !v.trim() ? 'هذا الحقل مطلوب' : undefined);
  const submit = () => {
    setTried(true);
    if (!f.gradeLevel.trim() || !f.section.trim() || !f.academicYear.trim()) return;
    const data = { gradeLevel: f.gradeLevel.trim(), section: f.section.trim(), academicYear: f.academicYear.trim(), room: f.room.trim() || null, active: f.active };
    const opts = { onSuccess: () => { inv(); ok(initial ? 'تم تعديل الصف' : 'تمت إضافة الصف'); onClose(); }, onError: (e: unknown) => fail(e, 'تعذر حفظ الصف') };
    if (initial) update.mutate({ id: initial.id, data }, opts); else create.mutate({ data }, opts);
  };
  return (
    <Modal onClose={onClose} title={initial ? 'تعديل الصف' : 'إضافة صف'} footer={<SaveBar onClose={onClose} pending={pending} onSubmit={submit} />}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="المرحلة / الصف" error={err(f.gradeLevel)}><input className="inp" value={f.gradeLevel} onChange={(e) => setF({ ...f, gradeLevel: e.target.value })} placeholder="مثال: الأول المتوسط" aria-invalid={!!err(f.gradeLevel)} /></Field>
        <Field label="الشعبة" error={err(f.section)}><input className="inp" value={f.section} onChange={(e) => setF({ ...f, section: e.target.value })} placeholder="مثال: أ" aria-invalid={!!err(f.section)} /></Field>
        <Field label="السنة الدراسية" error={err(f.academicYear)}><input className="inp" value={f.academicYear} onChange={(e) => setF({ ...f, academicYear: e.target.value })} aria-invalid={!!err(f.academicYear)} /></Field>
        <Field label="القاعة (اختياري)"><input className="inp" value={f.room} onChange={(e) => setF({ ...f, room: e.target.value })} /></Field>
        <label className="flex items-center gap-2 text-sm font-semibold sm:col-span-2"><input type="checkbox" className="size-5 accent-[hsl(205,64%,24%)]" checked={f.active} onChange={(e) => setF({ ...f, active: e.target.checked })} />الصف فعّال</label>
      </div>
    </Modal>
  );
}

export default function Classes() {
  const { isManager: isAdmin } = usePerms();
  const q = useListClasses();
  const { data: settings } = useGetSettings();
  const inv = useInvalidate();
  const del = useDeleteClass();
  const [dlg, setDlg] = useState<{ c?: SchoolClass } | null>(null);
  const [rm, setRm] = useState<SchoolClass | null>(null);
  return (
    <>
      <PageHeader icon={Building2} title="الصفوف والشعب" subtitle="أنشئ الصفوف والشعب ثم اربط الطلاب والمواد بها."
        actions={isAdmin && <button type="button" className="btn btn-primary" onClick={() => setDlg({})}><Plus className="size-4" />إضافة صف</button>} />
      {!isAdmin && <ReadOnlyNote />}
      {q.isLoading && <TableSkeleton />}
      {q.error && <ErrorState error={q.error} onRetry={() => q.refetch()} />}
      {q.data && q.data.length === 0 && <EmptyState icon={Building2} title="لا توجد صفوف بعد" text="ابدأ بإضافة أول صف وشعبة لتتمكن من تسجيل الطلاب." action={isAdmin && <button type="button" className="btn btn-primary" onClick={() => setDlg({})}><Plus className="size-4" />إضافة صف</button>} />}
      {q.data && q.data.length > 0 && (
        <div className="tbl-wrap"><table className="tbl">
          <thead><tr><th>الصف</th><th>الشعبة</th><th>السنة الدراسية</th><th>القاعة</th><th>الطلاب</th><th>الحالة</th>{isAdmin && <th>إجراءات</th>}</tr></thead>
          <tbody>{q.data.map((c) => (
            <tr key={c.id}>
              <td className="font-semibold">{c.gradeLevel}</td><td>{c.section}</td><td>{c.academicYear}</td><td>{c.room || '—'}</td>
              <td><span className="num">{fmtNum(c.studentCount)}</span></td>
              <td><span className={`bd ${c.active ? 'bd-ok' : 'bd-mute'}`}>{c.active ? 'فعّال' : 'غير فعّال'}</span></td>
              {isAdmin && <td><div className="flex gap-1">
                <button type="button" className="btn btn-ghost btn-icon" aria-label={`تعديل ${c.gradeLevel} ${c.section}`} onClick={() => setDlg({ c })}><Pencil className="size-4" /></button>
                <button type="button" className="btn btn-ghost btn-icon text-destructive" aria-label={`حذف ${c.gradeLevel} ${c.section}`} onClick={() => setRm(c)}><Trash2 className="size-4" /></button>
              </div></td>}
            </tr>))}</tbody>
        </table></div>
      )}
      {dlg && <ClassForm initial={dlg.c} defaultYear={settings?.academicYear ?? ''} onClose={() => setDlg(null)} />}
      {rm && <ConfirmDialog title="حذف الصف" description={rm.studentCount > 0 ? `في هذا الصف ${rm.studentCount} طالب مسجل ولا يمكن حذفه قبل نقلهم. سيرفض الخادم العملية.` : `سيتم حذف ${rm.gradeLevel} - شعبة ${rm.section} نهائيًا.`} confirmLabel="حذف" pending={del.isPending}
        onClose={() => setRm(null)} onConfirm={() => del.mutate({ id: rm.id }, { onSuccess: () => { inv(); ok('تم حذف الصف'); setRm(null); }, onError: (e) => { fail(e, 'تعذر حذف الصف'); setRm(null); } })} />}
    </>
  );
}
