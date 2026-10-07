import { useEffect, useRef, useState } from 'react';
import { ScanBarcode, CheckCircle2, XCircle, Trash2 } from 'lucide-react';
import { useRecordAttendance } from '@workspace/api-client-react';
import { PageHeader, ReadOnlyNote, EmptyState } from '@/components/kit';
import { usePerms, useInvalidate } from '@/lib/auth';
import { errMsg, fmtDate, attLabel, stuClass, todayISO } from '@/lib/format';

type Entry = { id: number; code: string; ok: boolean; text: string; sub?: string; time: string };

export default function BarcodePage() {
  const { canTeach } = usePerms();
  const [code, setCode] = useState('');
  const [date, setDate] = useState(todayISO());
  const [status, setStatus] = useState<'present' | 'late'>('present');
  const [log, setLog] = useState<Entry[]>([]);
  const ref = useRef<HTMLInputElement>(null);
  const rec = useRecordAttendance();
  const inv = useInvalidate();
  const seq = useRef(0);
  useEffect(() => { ref.current?.focus(); }, []);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const c = code.trim();
    if (!c || rec.isPending) return;
    const time = new Intl.DateTimeFormat('ar-IQ-u-nu-latn', { timeZone: 'Asia/Baghdad', hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(new Date());
    rec.mutate({ data: { barcode: c, attendanceDate: date, status } }, {
      onSuccess: (a) => { inv(); setLog((l) => [{ id: ++seq.current, code: c, ok: true, text: a.studentName, sub: `${stuClass(a)} - ${attLabel[a.status]} - ${fmtDate(a.attendanceDate)}`, time }, ...l].slice(0, 50)); },
      onError: (er) => setLog((l) => [{ id: ++seq.current, code: c, ok: false, text: (er as { status?: number }).status === 404 ? 'باركود غير معروف' : errMsg(er), time }, ...l].slice(0, 50)),
      onSettled: () => { setCode(''); ref.current?.focus(); },
    });
  };
  const last = log[0];
  return (
    <>
      <PageHeader icon={ScanBarcode} title="قارئ الباركود" subtitle="وجّه قارئ USB إلى الحقل وامسح بطاقة الطالب. يُسجَّل الحضور ويظهر الاسم بعد الحفظ." />
      {!canTeach && <ReadOnlyNote text="تسجيل الباركود للمدير والمعلمين فقط." />}
      <form onSubmit={submit} className="panel mb-5 grid gap-4 p-5 lg:grid-cols-[2fr_1fr_1fr_auto] lg:items-end">
        <label className="text-sm"><span className="mb-1.5 block font-semibold">رمز الباركود</span>
          <input ref={ref} className="inp text-lg" dir="ltr" autoComplete="off" inputMode="text" placeholder="امسح الباركود أو اكتب الرمز ثم Enter" value={code} onChange={(e) => setCode(e.target.value)} disabled={!canTeach} />
        </label>
        <label className="text-sm"><span className="mb-1.5 block font-semibold">التاريخ</span><input className="inp" type="date" max={todayISO()} value={date} onChange={(e) => e.target.value && setDate(e.target.value)} disabled={!canTeach} /></label>
        <label className="text-sm"><span className="mb-1.5 block font-semibold">الحالة</span><select className="inp" value={status} onChange={(e) => setStatus(e.target.value as 'present' | 'late')} disabled={!canTeach}><option value="present">حاضر</option><option value="late">متأخر</option></select></label>
        <button type="submit" className="btn btn-primary min-h-11" disabled={!canTeach || !code.trim() || rec.isPending}>{rec.isPending ? 'جارٍ الحفظ...' : 'تسجيل'}</button>
      </form>
      <div aria-live="polite">
        {last && (
          <div className={`mb-5 flex items-center gap-4 rounded-2xl border-2 p-5 ${last.ok ? 'border-[hsl(160,55%,26%)] bg-[hsl(160,40%,92%)]' : 'border-destructive bg-[hsl(6,70%,94%)]'}`}>
            {last.ok ? <CheckCircle2 className="size-10 shrink-0 text-[hsl(160,55%,26%)]" /> : <XCircle className="size-10 shrink-0 text-destructive" />}
            <div className="min-w-0"><div className="font-display text-xl font-extrabold">{last.text}</div><div className="text-sm">{last.ok ? last.sub : <>الرمز: <span dir="ltr">{last.code}</span></>}</div></div>
          </div>
        )}
      </div>
      <div className="mb-2 flex items-center justify-between"><h2 className="font-display text-lg font-bold">سجل هذه الجلسة</h2>{log.length > 0 && <button type="button" className="btn btn-ghost btn-sm" onClick={() => setLog([])}><Trash2 className="size-4" />مسح العرض</button>}</div>
      {log.length === 0 ? <EmptyState icon={ScanBarcode} title="لم يُمسح أي باركود بعد" text="ستظهر هنا نتائج المسح الناجحة والفاشلة." /> : (
        <ul className="panel divide-y divide-border">{log.map((l) => (
          <li key={l.id} className="flex items-center gap-3 px-4 py-3 text-sm">
            {l.ok ? <CheckCircle2 className="size-5 shrink-0 text-[hsl(160,55%,26%)]" /> : <XCircle className="size-5 shrink-0 text-destructive" />}
            <div className="min-w-0 flex-1"><div className="font-semibold">{l.text}</div><div className="text-xs text-muted-foreground">{l.sub ?? <span dir="ltr">{l.code}</span>}</div></div>
            <span className="num text-xs text-muted-foreground">{l.time}</span>
          </li>))}</ul>
      )}
    </>
  );
}
