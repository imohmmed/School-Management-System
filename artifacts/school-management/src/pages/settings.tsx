import { useEffect, useRef, useState } from 'react';
import { Settings as SettingsIcon, Save } from 'lucide-react';
import { useGetSettings, useUpdateSettings } from '@workspace/api-client-react';
import { PageHeader, ErrorState, TableSkeleton, Field, ReadOnlyNote } from '@/components/kit';
import { usePerms, useInvalidate } from '@/lib/auth';
import { ok, fail } from '@/lib/notify';

export default function SettingsPage() {
  const { isAdmin } = usePerms();
  const q = useGetSettings();
  const m = useUpdateSettings();
  const inv = useInvalidate();
  const [f, setF] = useState({ schoolName: '', academicYear: '', gradeScaleMax: '', passingPercent: '', barcodePrefix: '' });
  const [tried, setTried] = useState(false);
  const done = useRef(false);
  useEffect(() => {
    if (q.data && !done.current) { done.current = true; setF({ schoolName: q.data.schoolName, academicYear: q.data.academicYear, gradeScaleMax: String(q.data.gradeScaleMax), passingPercent: String(q.data.passingPercent), barcodePrefix: q.data.barcodePrefix }); }
  }, [q.data]);
  const max = Number(f.gradeScaleMax), pp = Number(f.passingPercent);
  const e = {
    schoolName: f.schoolName.trim() ? '' : 'اسم المدرسة مطلوب', academicYear: f.academicYear.trim() ? '' : 'السنة الدراسية مطلوبة',
    gradeScaleMax: max > 0 ? '' : 'أدخل رقمًا أكبر من صفر', passingPercent: f.passingPercent !== '' && pp >= 0 && pp <= 100 ? '' : 'النسبة بين 0 و100',
    barcodePrefix: '',
  };
  const sh = (k: keyof typeof e) => (tried ? e[k] : '') || undefined;
  const submit = (ev: React.FormEvent) => {
    ev.preventDefault(); setTried(true);
    if (Object.values(e).some(Boolean)) return;
    m.mutate({ data: { schoolName: f.schoolName.trim(), academicYear: f.academicYear.trim(), gradeScaleMax: max, passingPercent: pp, barcodePrefix: f.barcodePrefix.trim() } }, { onSuccess: () => { inv(); ok('تم حفظ الإعدادات'); }, onError: (x) => fail(x, 'لم تُحفظ الإعدادات') });
  };
  const set = (k: keyof typeof f) => (ev: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: ev.target.value });
  return (
    <>
      <PageHeader icon={SettingsIcon} title="الإعدادات" subtitle="بيانات المدرسة والعام الدراسي وقواعد الدرجات، وتظهر في التقارير والبطاقات." />
      {!isAdmin && <ReadOnlyNote />}
      {q.isLoading && <TableSkeleton rows={5} />}
      {q.error && <ErrorState error={q.error} onRetry={() => q.refetch()} />}
      {q.data && (
        <form onSubmit={submit} className="grid max-w-3xl gap-5">
          <fieldset disabled={!isAdmin || m.isPending} className="panel grid gap-4 p-5 sm:grid-cols-2">
            <legend className="sr-only">بيانات المدرسة</legend>
            <h2 className="font-display text-lg font-bold sm:col-span-2">المدرسة والعام الدراسي</h2>
            <Field label="اسم المدرسة" error={sh('schoolName')} className="sm:col-span-2"><input className="inp" value={f.schoolName} onChange={set('schoolName')} /></Field>
            <Field label="السنة الدراسية" error={sh('academicYear')}><input className="inp" value={f.academicYear} onChange={set('academicYear')} placeholder="2025-2026" dir="ltr" /></Field>
            <Field label="بادئة الباركود" hint="تُضاف إلى الباركودات الجديدة"><input className="inp" dir="ltr" value={f.barcodePrefix} onChange={set('barcodePrefix')} /></Field>
          </fieldset>
          <fieldset disabled={!isAdmin || m.isPending} className="panel grid gap-4 p-5 sm:grid-cols-2">
            <h2 className="font-display text-lg font-bold sm:col-span-2">الدرجات</h2>
            <Field label="الدرجة العظمى للسلم" error={sh('gradeScaleMax')} hint="مثال: 100"><input className="inp" type="number" min={1} inputMode="decimal" value={f.gradeScaleMax} onChange={set('gradeScaleMax')} /></Field>
            <Field label="نسبة النجاح %" error={sh('passingPercent')}><input className="inp" type="number" min={0} max={100} inputMode="decimal" value={f.passingPercent} onChange={set('passingPercent')} /></Field>
          </fieldset>
          {isAdmin && <div><button type="submit" className="btn btn-primary" disabled={m.isPending}><Save className="size-4" />{m.isPending ? 'جارٍ الحفظ...' : 'حفظ الإعدادات'}</button></div>}
        </form>
      )}
    </>
  );
}
