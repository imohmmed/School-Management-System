import { useState } from 'react';
import { Users, UserPlus, Ban, RotateCcw, Trash2, MailPlus } from 'lucide-react';
import { useListUsers, useInviteUser, useUpdateUser, useRemoveUser, type SchoolUser, type InviteUserInputRole } from '@workspace/api-client-react';
import { PageHeader, EmptyState, ErrorState, TableSkeleton, Modal, Field, SaveBar, ConfirmDialog } from '@/components/kit';
import { usePerms, useInvalidate } from '@/lib/auth';
import { ok, fail } from '@/lib/notify';
import { fmtDate, roleLabel, userStatusLabel } from '@/lib/format';

const ROLES: InviteUserInputRole[] = ['administrator', 'registrar', 'teacher', 'viewer'];
const tone: Record<string, string> = { active: 'bd-ok', invited: 'bd-info', suspended: 'bd-bad' };

function Invite({ onClose }: { onClose: () => void }) {
  const inv = useInvalidate();
  const m = useInviteUser();
  const [f, setF] = useState({ fullName: '', email: '', role: 'teacher' as InviteUserInputRole });
  const [tried, setTried] = useState(false);
  const eMail = !/^\S+@\S+\.\S+$/.test(f.email.trim()) ? 'أدخل بريدًا إلكترونيًا صحيحًا' : '';
  const eName = !f.fullName.trim() ? 'الاسم مطلوب' : '';
  const submit = () => {
    setTried(true);
    if (eMail || eName) return;
    m.mutate({ data: { fullName: f.fullName.trim(), email: f.email.trim().toLowerCase(), role: f.role } }, { onSuccess: () => { inv(); ok('تمت دعوة المستخدم', 'سيتمكن من الدخول عند التسجيل بهذا البريد.'); onClose(); }, onError: (e) => fail(e, 'تعذرت الدعوة') });
  };
  return (
    <Modal onClose={onClose} title="دعوة مستخدم" description="يدخل المدعو عبر إنشاء حساب بالبريد نفسه." footer={<SaveBar onClose={onClose} pending={m.isPending} label="إرسال الدعوة" onSubmit={submit} />}>
      <div className="grid gap-4">
        <Field label="الاسم الكامل" error={tried ? eName : undefined}><input className="inp" value={f.fullName} onChange={(e) => setF({ ...f, fullName: e.target.value })} /></Field>
        <Field label="البريد الإلكتروني" error={tried ? eMail : undefined}><input className="inp" type="email" dir="ltr" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field>
        <Field label="الدور"><select className="inp" value={f.role} onChange={(e) => setF({ ...f, role: e.target.value as InviteUserInputRole })}>{ROLES.map((r) => <option key={r} value={r}>{roleLabel[r]}</option>)}</select></Field>
      </div>
    </Modal>
  );
}

export default function UsersPage() {
  const { isAdmin, me } = usePerms();
  const q = useListUsers({ query: { enabled: isAdmin, queryKey: ['/api/users'] } });
  const upd = useUpdateUser();
  const del = useRemoveUser();
  const inv = useInvalidate();
  const [invite, setInvite] = useState(false);
  const [rm, setRm] = useState<SchoolUser | null>(null);
  const [sus, setSus] = useState<SchoolUser | null>(null);
  if (!isAdmin) return <><PageHeader icon={Users} title="المستخدمون" /><EmptyState icon={Users} title="هذه الصفحة للمدير فقط" /></>;

  const change = (u: SchoolUser, data: { role?: InviteUserInputRole; status?: 'active' | 'suspended' }, msg: string) =>
    upd.mutate({ id: u.id, data }, { onSuccess: () => { inv(); ok(msg); setSus(null); }, onError: (e) => { fail(e, 'تعذر تحديث المستخدم'); setSus(null); } });

  return (
    <>
      <PageHeader icon={Users} title="المستخدمون" subtitle="ادعُ العاملين وحدّد دور كل واحد، أو أوقف حسابًا مؤقتًا."
        actions={<button type="button" className="btn btn-primary" onClick={() => setInvite(true)}><UserPlus className="size-4" />دعوة مستخدم</button>} />
      {q.isLoading && <TableSkeleton />}
      {q.error && <ErrorState error={q.error} onRetry={() => q.refetch()} />}
      {q.data?.length === 0 && <EmptyState icon={MailPlus} title="لا يوجد مستخدمون" />}
      {!!q.data?.length && <div className="tbl-wrap"><table className="tbl"><thead><tr><th>المستخدم</th><th>البريد</th><th>الدور</th><th>الحالة</th><th>التاريخ</th><th>إجراءات</th></tr></thead><tbody>
        {q.data.map((u) => { const self = u.id === me.id; return (
          <tr key={u.id}>
            <td className="font-semibold">{u.fullName}{self && <span className="bd bd-mute mr-2">أنت</span>}</td>
            <td dir="ltr" className="text-right">{u.email}</td>
            <td><select className="inp min-h-9 w-36 py-1 text-sm" aria-label={`دور ${u.fullName}`} disabled={self || upd.isPending || u.role === 'pending'} value={u.role} onChange={(e) => change(u, { role: e.target.value as InviteUserInputRole }, 'تم تغيير الدور')}>
              {u.role === 'pending' && <option value="pending">{roleLabel.pending}</option>}{ROLES.map((r) => <option key={r} value={r}>{roleLabel[r]}</option>)}</select></td>
            <td><span className={`bd ${tone[u.status]}`}>{userStatusLabel[u.status]}</span></td>
            <td>{fmtDate(u.createdAt)}</td>
            <td><div className="flex gap-1">
              {u.status === 'suspended' && <button type="button" className="btn btn-ghost btn-sm" disabled={upd.isPending} onClick={() => change(u, { status: 'active' }, 'تمت إعادة التفعيل')}><RotateCcw className="size-4" />تفعيل</button>}
              {u.status === 'active' && !self && <button type="button" className="btn btn-ghost btn-sm" onClick={() => setSus(u)}><Ban className="size-4" />إيقاف</button>}
              {!self && <button type="button" className="btn btn-ghost btn-sm text-destructive" onClick={() => setRm(u)}><Trash2 className="size-4" />{u.status === 'invited' ? 'سحب الدعوة' : 'إزالة'}</button>}
            </div></td>
          </tr>); })}
      </tbody></table></div>}
      {invite && <Invite onClose={() => setInvite(false)} />}
      {sus && <ConfirmDialog title="إيقاف الحساب" description={`لن يتمكن ${sus.fullName} من استخدام النظام حتى تعيد تفعيله.`} confirmLabel="إيقاف" pending={upd.isPending} onClose={() => setSus(null)} onConfirm={() => change(sus, { status: 'suspended' }, 'تم إيقاف الحساب')} />}
      {rm && <ConfirmDialog title={rm.status === 'invited' ? 'سحب الدعوة' : 'إزالة المستخدم'} description={`سيتم ${rm.status === 'invited' ? 'سحب دعوة' : 'إزالة'} ${rm.fullName} (${rm.email}).`} confirmLabel={rm.status === 'invited' ? 'سحب الدعوة' : 'إزالة'} pending={del.isPending} onClose={() => setRm(null)}
        onConfirm={() => del.mutate({ id: rm.id }, { onSuccess: () => { inv(); ok('تمت العملية'); setRm(null); }, onError: (e) => { fail(e, 'تعذرت الإزالة'); setRm(null); } })} />}
    </>
  );
}
