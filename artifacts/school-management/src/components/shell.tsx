import { useEffect, useState, type ReactNode } from 'react';
import { Link, useLocation } from 'wouter';
import { useClerk } from '@clerk/react';
import {
  LayoutDashboard, Building2, GraduationCap, BookOpen, CalendarDays, ClipboardCheck, UserCheck,
  ScanBarcode, FileBarChart, Users, Settings, History, Menu, X, LogOut,
} from 'lucide-react';
import { useGetSettings } from '@workspace/api-client-react';
import { usePerms } from '@/lib/auth';
import { roleLabel } from '@/lib/format';
import { unsaved, UNSAVED_MSG } from '@/lib/guard';

const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');

const NAV = [
  { href: '/dashboard', label: 'لوحة التحكم', icon: LayoutDashboard },
  { href: '/students', label: 'الطلاب', icon: GraduationCap },
  { href: '/classes', label: 'الصفوف والشعب', icon: Building2 },
  { href: '/subjects', label: 'المواد', icon: BookOpen },
  { href: '/exams', label: 'الامتحانات', icon: CalendarDays },
  { href: '/grades', label: 'الدرجات', icon: ClipboardCheck },
  { href: '/attendance', label: 'الحضور والغياب', icon: UserCheck },
  { href: '/barcode', label: 'قارئ الباركود', icon: ScanBarcode },
  { href: '/reports', label: 'التقارير', icon: FileBarChart },
  { href: '/users', label: 'المستخدمون', icon: Users, admin: true },
  { href: '/settings', label: 'الإعدادات', icon: Settings },
  { href: '/activity', label: 'سجل التغييرات', icon: History, admin: true },
];

export function Shell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [loc] = useLocation();
  const { me, isAdmin } = usePerms();
  const { signOut } = useClerk();
  const { data: settings } = useGetSettings();

  const [online, setOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true), off = () => setOnline(false);
    window.addEventListener('online', on); window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);
  useEffect(() => setOpen(false), [loc]);
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, []);

  const guardNav = (e: React.MouseEvent) => {
    if (unsaved.dirty && !window.confirm(UNSAVED_MSG)) e.preventDefault();
    else unsaved.dirty = false;
  };

  return (
    <div className="min-h-[100dvh] lg:flex">
      <div className="no-print sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-sidebar-border bg-sidebar px-4 py-3 text-sidebar-foreground lg:hidden">
        <div className="flex min-w-0 items-center gap-3">
          <img src={`${basePath}/logo.svg`} alt="" className="size-9 rounded-lg" />
          <span className="truncate font-display text-sm font-bold">{settings?.schoolName || 'نظام إدارة المدارس'}</span>
        </div>
        <button type="button" aria-label="فتح القائمة" aria-expanded={open} className="btn btn-icon text-sidebar-foreground hover:bg-sidebar-accent" onClick={() => setOpen(true)}>
          <Menu className="size-6" />
        </button>
      </div>

      {open && <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setOpen(false)} aria-hidden />}

      <aside
        className={`no-print pattern fixed inset-y-0 right-0 z-50 flex w-72 flex-col bg-sidebar text-sidebar-foreground transition-[transform,visibility] duration-300 lg:sticky lg:top-0 lg:h-[100dvh] lg:shrink-0 ${open ? 'max-lg:translate-x-0' : 'max-lg:invisible max-lg:translate-x-full'}`}
        aria-label="القائمة الرئيسية"
      >
        <div className="flex items-center justify-between gap-3 px-5 pb-4 pt-6">
          <Link href="/dashboard" className="flex min-w-0 items-center gap-3" onClick={guardNav}>
            <img src={`${basePath}/logo.svg`} alt="" className="size-11 rounded-xl" />
            <div className="min-w-0">
              <div className="truncate font-display text-[0.95rem] font-extrabold leading-tight text-sidebar-accent-foreground">{settings?.schoolName || 'نظام إدارة المدارس'}</div>
              <div className="text-xs text-sidebar-primary">{settings?.academicYear ? `العام الدراسي ${settings.academicYear}` : 'إدارة المدرسة'}</div>
            </div>
          </Link>
          <div className="lg:hidden"><button type="button" aria-label="إغلاق القائمة" className="btn btn-icon hover:bg-sidebar-accent" onClick={() => setOpen(false)}><X className="size-5" /></button></div>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-2">
          {NAV.filter((n) => !n.admin || isAdmin).map((n) => {
            const active = loc === n.href || loc.startsWith(n.href + '/');
            return (
              <Link
                key={n.href}
                href={n.href}
                onClick={guardNav}
                aria-current={active ? 'page' : undefined}
                className={`flex min-h-11 items-center gap-3 rounded-xl px-3.5 text-[0.92rem] font-medium transition-colors ${active ? 'bg-sidebar-primary text-sidebar-primary-foreground font-bold' : 'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'}`}
              >
                <n.icon className="size-[1.15rem] shrink-0" />{n.label}
              </Link>
            );
          })}
        </nav>
        <div className="m-3 rounded-xl bg-sidebar-accent p-3">
          <div className="flex items-center gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-sidebar-primary font-display text-sm font-extrabold text-sidebar-primary-foreground">{me.fullName.trim().charAt(0) || '؟'}</span>
            <div className="min-w-0">
              <div className="truncate text-sm font-bold text-sidebar-accent-foreground">{me.fullName}</div>
              <div className="text-xs opacity-80">{roleLabel[me.role]}</div>
            </div>
          </div>
          <button type="button" className="btn btn-sm mt-3 w-full bg-sidebar/60 text-sidebar-foreground hover:bg-sidebar" onClick={() => signOut({ redirectUrl: basePath || '/' })}>
            <LogOut className="size-4" />تسجيل الخروج
          </button>
        </div>
      </aside>

      <main className="min-w-0 flex-1">
        {!online && <div role="status" className="no-print sticky top-0 z-20 bg-destructive px-4 py-2 text-center text-sm font-semibold text-white">لا يوجد اتصال بالإنترنت. لن تُحفظ أي تغييرات حتى يعود الاتصال.</div>}
        <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-10 lg:py-9">{children}</div>
      </main>
    </div>
  );
}
