import type { ReactNode, ComponentType } from 'react';
import { AlertTriangle, Inbox, RefreshCw, Lock, Download } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { errMsg, classLabel } from '@/lib/format';
import type { SchoolClass } from '@workspace/api-client-react';

type Icon = ComponentType<{ className?: string }>;

export function PageHeader({ title, subtitle, icon: I, actions }: { title: string; subtitle?: string; icon?: Icon; actions?: ReactNode }) {
  return (
    <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="flex items-start gap-3">
        {I && (
          <span className="mt-1 grid size-11 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground">
            <I className="size-5" />
          </span>
        )}
        <div>
          <h1 className="font-display text-2xl font-extrabold leading-tight text-foreground sm:text-[1.7rem]">{title}</h1>
          {subtitle && <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

export function EmptyState({ icon: I = Inbox, title, text, action }: { icon?: Icon; title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="panel flex flex-col items-center px-6 py-14 text-center">
      <span className="mb-4 grid size-14 place-items-center rounded-2xl bg-secondary text-primary"><I className="size-7" /></span>
      <h3 className="font-display text-lg font-bold">{title}</h3>
      {text && <p className="mt-1 max-w-md text-sm text-muted-foreground">{text}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  return (
    <div role="alert" className="panel flex flex-col items-center border-destructive/40 px-6 py-12 text-center">
      <span className="mb-4 grid size-14 place-items-center rounded-2xl bg-destructive/10 text-destructive"><AlertTriangle className="size-7" /></span>
      <h3 className="font-display text-lg font-bold">تعذر تحميل البيانات</h3>
      <p className="mt-1 max-w-md text-sm text-muted-foreground">{errMsg(error)}</p>
      {onRetry && <button type="button" className="btn btn-outline mt-5" onClick={onRetry}><RefreshCw className="size-4" />إعادة المحاولة</button>}
    </div>
  );
}

export function ReadOnlyNote({ text = 'حسابك بصلاحية عرض فقط. التعديل متاح للمدير.' }: { text?: string }) {
  return (
    <div className="mb-4 flex items-center gap-2 rounded-xl border border-border bg-secondary px-4 py-2.5 text-sm text-secondary-foreground">
      <Lock className="size-4 shrink-0" />{text}
    </div>
  );
}

export function TableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="panel space-y-3 p-4" aria-busy="true" aria-label="جارٍ التحميل">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-10 animate-pulse rounded-lg bg-muted" style={{ opacity: 1 - i * 0.1 }} />
      ))}
    </div>
  );
}

export function Field({ label, error, hint, children, className = '' }: { label: string; error?: string; hint?: string; children: ReactNode; className?: string }) {
  return (
    <label className={`block text-sm ${className}`}>
      <span className="mb-1.5 block font-semibold text-foreground">{label}</span>
      {children}
      {hint && !error && <span className="mt-1 block text-xs text-muted-foreground">{hint}</span>}
      {error && <span role="alert" className="mt-1 block text-xs font-medium text-destructive">{error}</span>}
    </label>
  );
}

export function ClassSelect({ value, onChange, classes, all, invalid, disabled }: {
  value: string; onChange: (v: string) => void; classes: SchoolClass[] | undefined; all?: string; invalid?: boolean; disabled?: boolean;
}) {
  return (
    <select className="inp" value={value} onChange={(e) => onChange(e.target.value)} aria-invalid={invalid} disabled={disabled}>
      {all !== undefined ? <option value="">{all}</option> : <option value="" disabled>اختر الصف</option>}
      {(classes ?? []).map((c) => <option key={c.id} value={c.id}>{classLabel(c)}</option>)}
    </select>
  );
}

export function ExportButtons({ onExport, disabled, busy }: { onExport: (f: 'xlsx' | 'csv') => void; disabled?: boolean; busy?: boolean }) {
  return (
    <>
      <button type="button" className="btn btn-outline" disabled={disabled || busy} onClick={() => onExport('xlsx')}><Download className="size-4" />{busy ? 'جارٍ التجهيز...' : 'تصدير XLSX'}</button>
      <button type="button" className="btn btn-outline" disabled={disabled || busy} onClick={() => onExport('csv')}><Download className="size-4" />تصدير CSV</button>
    </>
  );
}

export function Modal({ onClose, title, description, children, footer, wide }: {
  onClose: () => void; title: string; description?: string; children: ReactNode; footer?: ReactNode; wide?: boolean;
}) {
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent dir="rtl" className={`flex max-h-[92dvh] w-[calc(100vw-1.5rem)] flex-col gap-0 overflow-hidden rounded-2xl border-card-border bg-card p-0 ${wide ? 'sm:max-w-3xl' : 'sm:max-w-xl'}`}>
        <DialogHeader className="border-b border-border px-5 py-4 text-right sm:text-right">
          <DialogTitle className="font-display text-lg font-bold">{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : <DialogDescription className="sr-only">{title}</DialogDescription>}
        </DialogHeader>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="flex flex-col-reverse gap-2 border-t border-border bg-secondary/50 px-5 py-3 sm:flex-row sm:justify-start">{footer}</div>}
      </DialogContent>
    </Dialog>
  );
}

export function ConfirmDialog({ title, description, confirmLabel, onConfirm, onClose, pending, destructive = true }: {
  title: string; description: string; confirmLabel: string; onConfirm: () => void; onClose: () => void; pending?: boolean; destructive?: boolean;
}) {
  return (
    <AlertDialog open onOpenChange={(o) => !o && !pending && onClose()}>
      <AlertDialogContent dir="rtl" className="w-[calc(100vw-1.5rem)] rounded-2xl bg-card">
        <AlertDialogHeader className="text-right sm:text-right">
          <AlertDialogTitle className="font-display">{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="gap-2 sm:justify-start">
          <AlertDialogAction
            onClick={(e) => { e.preventDefault(); onConfirm(); }}
            disabled={pending}
            className={`btn ${destructive ? 'btn-danger' : 'btn-primary'}`}
          >{pending ? 'جارٍ التنفيذ...' : confirmLabel}</AlertDialogAction>
          <AlertDialogCancel disabled={pending} className="btn btn-outline mt-0">إلغاء</AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function SaveBar({ onClose, pending, label = 'حفظ', onSubmit }: { onClose: () => void; pending?: boolean; label?: string; onSubmit: () => void }) {
  return (
    <>
      <button type="button" className="btn btn-primary" disabled={pending} onClick={onSubmit}>{pending ? 'جارٍ الحفظ...' : label}</button>
      <button type="button" className="btn btn-outline" disabled={pending} onClick={onClose}>إلغاء</button>
    </>
  );
}

export function StatCard({ label, value, icon: I, tone = 'primary', note }: { label: string; value: ReactNode; icon: Icon; tone?: 'primary' | 'accent' | 'bad' | 'ok'; note?: string }) {
  const tones = { primary: 'bg-primary text-primary-foreground', accent: 'bg-accent text-accent-foreground', bad: 'bg-destructive text-destructive-foreground', ok: 'bg-[hsl(var(--success))] text-primary-foreground' };
  return (
    <div className="panel flex items-center gap-4 p-5">
      <span className={`grid size-12 shrink-0 place-items-center rounded-xl ${tones[tone]}`}><I className="size-6" /></span>
      <div className="min-w-0">
        <div className="text-sm text-muted-foreground">{label}</div>
        <div className="font-display text-3xl font-extrabold leading-tight">{value}</div>
        {note && <div className="text-xs text-muted-foreground">{note}</div>}
      </div>
    </div>
  );
}
