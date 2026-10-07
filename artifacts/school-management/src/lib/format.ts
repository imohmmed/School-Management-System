export const TZ = 'Asia/Baghdad';
export const fmtNum = (n: number | null | undefined, d = 0) =>
  n == null || Number.isNaN(n) ? '—' : new Intl.NumberFormat('en', { maximumFractionDigits: d }).format(n);
export function todayISO() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date());
}
export function monthStartISO() {
  return todayISO().slice(0, 8) + '01';
}
const dOpts: Intl.DateTimeFormatOptions = { timeZone: TZ, year: 'numeric', month: 'long', day: 'numeric' };
export function fmtDate(s?: string | null) {
  if (!s) return '—';
  const d = /^\d{4}-\d{2}-\d{2}$/.test(s) ? new Date(s + 'T12:00:00Z') : new Date(s);
  if (Number.isNaN(d.getTime())) return s;
  return new Intl.DateTimeFormat('ar-IQ-u-nu-latn', dOpts).format(d);
}
export function fmtDateTime(s?: string | null) {
  if (!s) return '—';
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s;
  return new Intl.DateTimeFormat('ar-IQ-u-nu-latn', { ...dOpts, hour: '2-digit', minute: '2-digit' }).format(d);
}
export function errMsg(e: unknown): string {
  const x = e as { status?: number; data?: { message?: string } | null; message?: string };
  if (x?.data?.message) return x.data.message;
  switch (x?.status) {
    case 401: return 'انتهت الجلسة، يرجى تسجيل الدخول من جديد.';
    case 403: return 'ليست لديك صلاحية لتنفيذ هذه العملية.';
    case 404: return 'السجل المطلوب غير موجود.';
    case 409: return 'يوجد تعارض مع سجل آخر.';
  }
  if (x?.status && x.status >= 500) return 'حدث خطأ في الخادم. حاول مرة أخرى.';
  if (typeof navigator !== 'undefined' && !navigator.onLine) return 'لا يوجد اتصال بالإنترنت.';
  return x?.message || 'تعذر إكمال الطلب.';
}
export const roleLabel: Record<string, string> = { administrator: 'مدير النظام', registrar: 'مسجّل', teacher: 'معلم', viewer: 'مشاهد', pending: 'قيد الانتظار' };
export const userStatusLabel: Record<string, string> = { active: 'فعّال', invited: 'مدعو', suspended: 'موقوف' };
export const attLabel: Record<string, string> = { present: 'حاضر', absent: 'غائب', late: 'متأخر', excused: 'غياب بعذر' };
export const attTone: Record<string, string> = { present: 'bd-ok', absent: 'bd-bad', late: 'bd-warn', excused: 'bd-info' };
export const classLabel = (c: { gradeLevel: string; section: string }) => `${c.gradeLevel} - شعبة ${c.section}`;
export const stuClass = (s: { className: string; section: string }) => `${s.className} - ${s.section}`;
