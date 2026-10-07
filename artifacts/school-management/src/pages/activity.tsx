import { useEffect, useState } from 'react';
import { History, Search } from 'lucide-react';
import { useListActivity } from '@workspace/api-client-react';
import { PageHeader, EmptyState, ErrorState, TableSkeleton } from '@/components/kit';
import { usePerms } from '@/lib/auth';
import { fmtDateTime } from '@/lib/format';

const entityLabels: Record<string, string> = { students: 'الطلاب', classes: 'الصفوف', subjects: 'المواد', 'exam-sessions': 'الفترات', exams: 'الامتحانات', grades: 'الدرجات', attendance: 'الحضور', users: 'المستخدمون', settings: 'الإعدادات' };
const actionLabels: Record<string, string> = { create: 'إضافة', update: 'تعديل', delete: 'حذف', archive: 'أرشفة', save: 'حفظ الدرجات', record: 'تسجيل حضور', invite: 'دعوة', activate: 'تفعيل', revoke: 'إلغاء صلاحية', setup: 'تهيئة النظام' };

export default function Activity() {
  const { isAdmin } = usePerms();
  const [limit, setLimit] = useState(50);
  const [s, setS] = useState('');
  const [ds, setDs] = useState('');
  const [entity, setEntity] = useState('');
  const [action, setAction] = useState('');
  const [page, setPage] = useState(1);
  useEffect(() => { const t = setTimeout(() => setDs(s.trim()), 300); return () => clearTimeout(t); }, [s]);
  useEffect(() => { setPage(1); }, [ds, entity, action, limit]);
  const params = { limit, page, ...(ds ? { search: ds } : {}), ...(entity ? { entity } : {}), ...(action ? { action } : {}) };
  const q = useListActivity(params, { query: { enabled: isAdmin, queryKey: ['/api/activity', params] } });
  if (!isAdmin) return <><PageHeader icon={History} title="سجل التغييرات" /><EmptyState icon={History} title="هذه الصفحة للمدير فقط" /></>;
  const term = ds || entity || action;
  const rows = q.data ?? [];
  return (
    <>
      <PageHeader icon={History} title="سجل التغييرات" subtitle="من فعل ماذا ومتى. السجل للقراءة فقط." />
      <div className="panel mb-4 grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_auto]">
        <div className="relative"><Search className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><input className="inp pr-10" type="search" aria-label="بحث" placeholder="ابحث في السجل" value={s} onChange={(e) => setS(e.target.value)} /></div>
        <select className="inp" aria-label="نوع السجل" value={entity} onChange={(e) => setEntity(e.target.value)}><option value="">كل الأقسام</option>{Object.entries(entityLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select>
        <select className="inp" aria-label="نوع العملية" value={action} onChange={(e) => setAction(e.target.value)}><option value="">كل العمليات</option>{Object.entries(actionLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select>
        <select className="inp" aria-label="عدد السجلات" value={limit} onChange={(e) => setLimit(Number(e.target.value))}>{[25, 50, 100].map((n) => <option key={n} value={n}>{n} في الصفحة</option>)}</select>
      </div>
      {q.isLoading && <TableSkeleton />}
      {q.error && <ErrorState error={q.error} onRetry={() => q.refetch()} />}
      {q.data && rows.length === 0 && <EmptyState icon={History} title={term ? 'لا نتائج مطابقة' : 'لا توجد تغييرات مسجلة'} />}
      {rows.length > 0 && <div className="tbl-wrap"><table className="tbl"><thead><tr><th>الوقت</th><th>المستخدم</th><th>العملية</th><th>السجل</th><th>التفاصيل</th></tr></thead><tbody>
        {rows.map((a) => <tr key={a.id}><td className="whitespace-nowrap">{fmtDateTime(a.createdAt)}</td><td className="font-semibold">{a.actorName}</td><td><span className="bd bd-info">{actionLabels[a.action] ?? a.action}</span></td><td>{entityLabels[a.entity] ?? a.entity}{a.recordId ? ` #${a.recordId}` : ''}</td><td className="min-w-64">{a.details}</td></tr>)}
      </tbody></table></div>}
      {(page > 1 || rows.length >= limit) && <div className="mt-3 flex items-center justify-between"><button type="button" className="btn btn-outline btn-sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>السابق</button><span className="text-sm text-muted-foreground">صفحة <span className="num">{page}</span></span><button type="button" className="btn btn-outline btn-sm" disabled={rows.length < limit} onClick={() => setPage(page + 1)}>التالي</button></div>}
    </>
  );
}
