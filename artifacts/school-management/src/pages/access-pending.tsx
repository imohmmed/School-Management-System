import { useClerk } from '@clerk/react';
import { ShieldAlert, LogOut, RefreshCw } from 'lucide-react';

const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');

export default function AccessPending({ onRetry, reason }: { onRetry?: () => void; reason?: 'forbidden' | 'pending' }) {
  const { signOut } = useClerk();
  return (
    <div className="pattern grid min-h-[100dvh] place-items-center bg-sidebar px-4">
      <div role="alert" className="panel w-full max-w-lg p-8 text-center">
        <span className="mx-auto mb-5 grid size-16 place-items-center rounded-2xl bg-accent text-accent-foreground"><ShieldAlert className="size-8" /></span>
        <h1 className="font-display text-2xl font-extrabold">{reason === 'pending' ? 'حسابك بانتظار التفعيل' : 'لا تملك صلاحية الدخول إلى النظام'}</h1>
        <p className="mt-3 text-muted-foreground">
          تم تسجيل دخولك بنجاح، لكن هذا الحساب غير مرتبط بالمدرسة. ينضم المستخدمون الجدد بدعوة من مدير النظام فقط. اطلب من المدير دعوة بريدك الإلكتروني ثم أعد المحاولة.
        </p>
        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
          {onRetry && <button type="button" className="btn btn-primary" onClick={onRetry}><RefreshCw className="size-4" />تحقق مرة أخرى</button>}
          <button type="button" className="btn btn-outline" onClick={() => signOut({ redirectUrl: basePath || '/' })}><LogOut className="size-4" />تسجيل الخروج</button>
        </div>
      </div>
    </div>
  );
}
