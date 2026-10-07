import { Link } from 'wouter';
import { LayoutDashboard, Building2, GraduationCap, UserX, ClipboardCheck, RefreshCw, ArrowLeft, CalendarDays, History, UserCheck, ScanBarcode } from 'lucide-react';
import { useGetDashboard } from '@workspace/api-client-react';
import { PageHeader, StatCard, ErrorState, EmptyState } from '@/components/kit';
import { fmtDate, fmtDateTime, fmtNum, stuClass } from '@/lib/format';
import { usePerms } from '@/lib/auth';

export default function Dashboard() {
  const { me, canTeach } = usePerms();
  const q = useGetDashboard();
  const d = q.data;
  const quick = [
    { href: '/attendance', t: 'تسجيل حضور اليوم', i: UserCheck, show: canTeach },
    { href: '/barcode', t: 'قارئ الباركود', i: ScanBarcode, show: canTeach },
    { href: '/grades', t: 'إدخال الدرجات', i: ClipboardCheck, show: canTeach },
    { href: '/students', t: 'سجل الطلاب', i: GraduationCap, show: true },
  ].filter((x) => x.show);
  return (
    <>
      <PageHeader
        icon={LayoutDashboard}
        title={`أهلًا ${me.fullName.split(' ')[0]}`}
        subtitle={q.dataUpdatedAt ? `آخر تحديث للبيانات: ${fmtDateTime(new Date(q.dataUpdatedAt).toISOString())}` : 'نظرة مباشرة على المدرسة اليوم'}
        actions={<button type="button" className="btn btn-outline" onClick={() => q.refetch()} disabled={q.isFetching}><RefreshCw className={`size-4 ${q.isFetching ? 'animate-spin' : ''}`} />تحديث</button>}
      />
      {q.isLoading && <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[0, 1, 2, 3].map((i) => <div key={i} className="panel h-28 animate-pulse" />)}</div>}
      {q.error && <ErrorState error={q.error} onRetry={() => q.refetch()} />}
      {d && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="الطلاب" value={fmtNum(d.studentCount)} icon={GraduationCap} />
            <StatCard label="الصفوف والشعب" value={fmtNum(d.classCount)} icon={Building2} tone="accent" />
            <StatCard label="غائبون اليوم" value={fmtNum(d.absentToday)} icon={UserX} tone="bad" />
            <StatCard label="اكتمال الدرجات" value={`${fmtNum(d.gradeCompletionPercent, 1)}%`} icon={ClipboardCheck} tone="ok" />
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {quick.map((x) => (
              <Link key={x.href} href={x.href} className="panel group flex items-center justify-between gap-3 p-4 font-semibold transition-colors hover:border-primary">
                <span className="flex items-center gap-3"><x.i className="size-5 text-primary" />{x.t}</span>
                <ArrowLeft className="size-4 text-muted-foreground transition-transform group-hover:-translate-x-1" />
              </Link>
            ))}
          </div>
          <div className="mt-6 grid gap-6 lg:grid-cols-5">
            <section className="lg:col-span-3">
              <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-bold"><CalendarDays className="size-5 text-primary" />الامتحانات القادمة</h2>
              {d.upcomingExams.length === 0 ? <EmptyState icon={CalendarDays} title="لا توجد امتحانات قادمة" text="أضف امتحانات إلى الجدول الامتحاني لتظهر هنا." action={<Link href="/exams" className="btn btn-outline">الجدول الامتحاني</Link>} /> : (
                <div className="tbl-wrap"><table className="tbl"><thead><tr><th>المادة</th><th>الصف</th><th>الجلسة</th><th>التاريخ</th></tr></thead><tbody>
                  {d.upcomingExams.map((e) => <tr key={e.id}><td className="font-semibold">{e.subjectName}</td><td>{stuClass(e)}</td><td>{e.sessionName}</td><td>{fmtDate(e.examDate)}</td></tr>)}
                </tbody></table></div>
              )}
            </section>
            <section className="lg:col-span-2">
              <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-bold"><History className="size-5 text-primary" />آخر النشاط</h2>
              {d.recentActivity.length === 0 ? <EmptyState icon={History} title="لا يوجد نشاط بعد" /> : (
                <ul className="panel divide-y divide-border">
                  {d.recentActivity.map((a) => (
                    <li key={a.id} className="px-4 py-3 text-sm">
                      <div className="font-semibold">{a.details}</div>
                      <div className="mt-0.5 text-xs text-muted-foreground">{a.actorName} - {fmtDateTime(a.createdAt)}</div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </>
      )}
    </>
  );
}
