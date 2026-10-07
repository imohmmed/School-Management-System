import { lazy, Suspense, useEffect, useRef, type ComponentType } from 'react';
import { ClerkProvider, SignIn, SignUp, Show, useClerk } from '@clerk/react';
import { publishableKeyFromHost } from '@clerk/react/internal';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { Redirect, Route, Switch, useLocation, Router as WouterRouter } from 'wouter';
import { getGetCurrentUserQueryKey, useGetCurrentUser } from '@workspace/api-client-react';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Shell } from '@/components/shell';
import { MeContext } from '@/lib/auth';
import { ErrorState } from '@/components/kit';
import NotFound from '@/pages/not-found';
import Landing from '@/pages/landing';
import AccessPending from '@/pages/access-pending';

const Dashboard = lazy(() => import('@/pages/dashboard'));
const Classes = lazy(() => import('@/pages/classes'));
const Students = lazy(() => import('@/pages/students'));
const Subjects = lazy(() => import('@/pages/subjects'));
const Exams = lazy(() => import('@/pages/exams'));
const Grades = lazy(() => import('@/pages/grades'));
const Attendance = lazy(() => import('@/pages/attendance'));
const BarcodePage = lazy(() => import('@/pages/barcode'));
const Reports = lazy(() => import('@/pages/reports'));
const UsersPage = lazy(() => import('@/pages/users'));
const SettingsPage = lazy(() => import('@/pages/settings'));
const Activity = lazy(() => import('@/pages/activity'));

const clerkPubKey = publishableKeyFromHost(window.location.hostname, import.meta.env.VITE_CLERK_PUBLISHABLE_KEY);
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;
const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');

function stripBase(path: string): string {
  return basePath && path.startsWith(basePath) ? path.slice(basePath.length) || '/' : path;
}

if (!clerkPubKey) throw new Error('Missing VITE_CLERK_PUBLISHABLE_KEY in .env file');

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: (count, err) => {
        const s = (err as { status?: number })?.status;
        return !(s && s >= 400 && s < 500) && count < 2;
      },
    },
  },
});

const clerkAppearance = {
  cssLayerName: 'clerk',
  options: { logoPlacement: 'inside' as const, logoLinkUrl: basePath || '/', logoImageUrl: `${window.location.origin}${basePath}/logo.svg` },
  variables: {
    colorPrimary: 'hsl(205 64% 24%)',
    colorForeground: 'hsl(215 40% 14%)',
    colorMutedForeground: 'hsl(215 14% 38%)',
    colorDanger: 'hsl(6 68% 42%)',
    colorBackground: 'hsl(40 45% 99%)',
    colorInput: 'hsl(42 33% 96%)',
    colorInputForeground: 'hsl(215 40% 14%)',
    colorNeutral: 'hsl(38 20% 60%)',
    fontFamily: "'IBM Plex Sans Arabic', system-ui, sans-serif",
    borderRadius: '0.7rem',
  },
  elements: {
    rootBox: 'w-full flex justify-center',
    cardBox: 'bg-[hsl(40,45%,99%)] rounded-2xl w-[440px] max-w-full overflow-hidden shadow-xl',
    card: '!shadow-none !border-0 !bg-transparent !rounded-none',
    footer: '!shadow-none !border-0 !bg-transparent !rounded-none',
    headerTitle: 'text-[hsl(215,40%,14%)] font-extrabold',
    headerSubtitle: 'text-[hsl(215,14%,38%)]',
    socialButtonsBlockButtonText: 'text-[hsl(215,40%,14%)]',
    formFieldLabel: 'text-[hsl(215,40%,14%)] font-semibold',
    footerActionLink: 'text-[hsl(205,64%,24%)] font-bold',
    footerActionText: 'text-[hsl(215,14%,38%)]',
    dividerText: 'text-[hsl(215,14%,38%)]',
    identityPreviewEditButton: 'text-[hsl(205,64%,24%)]',
    formFieldSuccessText: 'text-[hsl(160,55%,26%)]',
    alertText: 'text-[hsl(6,68%,34%)]',
    logoBox: 'justify-center',
    logoImage: 'size-14 rounded-xl',
    formButtonPrimary: 'bg-[hsl(205,64%,24%)] hover:bg-[hsl(205,64%,31%)] text-white font-bold',
    formFieldInput: 'border-[hsl(36,16%,72%)]',
    dividerLine: 'bg-[hsl(38,20%,85%)]',
  },
};

const localization = {
  formButtonPrimary: 'متابعة',
  formFieldLabel__emailAddress: 'البريد الإلكتروني',
  formFieldLabel__password: 'كلمة المرور',
  dividerText: 'أو',
  signIn: { start: { title: 'تسجيل الدخول', subtitle: 'ادخل إلى مساحة عمل المدرسة', actionText: 'ليس لديك حساب؟', actionLink: 'إنشاء حساب' } },
  signUp: { start: { title: 'إنشاء حساب', subtitle: 'أنشئ حسابك. الانضمام إلى المدرسة يتم بدعوة من المدير', actionText: 'لديك حساب؟', actionLink: 'تسجيل الدخول' } },
};

function AuthFrame({ children }: { children: React.ReactNode }) {
  return <div className="pattern flex min-h-[100dvh] items-center justify-center bg-sidebar px-4 py-8" dir="rtl">{children}</div>;
}
function SignInPage() {
  return <AuthFrame><SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} /></AuthFrame>;
}
function SignUpPage() {
  return <AuthFrame><SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} /></AuthFrame>;
}

function ClerkQueryClientCacheInvalidator() {
  const { addListener } = useClerk();
  const qc = useQueryClient();
  const prev = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    return addListener(({ user }) => {
      const id = user?.id ?? null;
      if (prev.current !== undefined && prev.current !== id) qc.clear();
      prev.current = id;
    });
  }, [addListener, qc]);
  return null;
}

function HomeRedirect() {
  return (
    <>
      <Show when="signed-in"><Redirect to="/dashboard" /></Show>
      <Show when="signed-out"><Landing /></Show>
    </>
  );
}

function MeGate({ children }: { children: React.ReactNode }) {
  const q = useGetCurrentUser({ query: { retry: false, queryKey: getGetCurrentUserQueryKey() } });
  if (q.isLoading) {
    return <div className="grid min-h-[100dvh] place-items-center bg-background"><div className="h-2 w-40 animate-pulse rounded-full bg-primary/30" aria-label="جارٍ التحميل" /></div>;
  }
  if (q.error) {
    const s = (q.error as { status?: number }).status;
    if (s === 403) return <AccessPending reason="forbidden" onRetry={() => q.refetch()} />;
    return <div className="mx-auto grid min-h-[100dvh] max-w-lg place-items-center px-4"><div className="w-full"><ErrorState error={q.error} onRetry={() => q.refetch()} /></div></div>;
  }
  if (!q.data) return null;
  if (q.data.role === 'pending') return <AccessPending reason="pending" onRetry={() => q.refetch()} />;
  return <MeContext.Provider value={q.data}>{children}</MeContext.Provider>;
}

const pages: Record<string, ComponentType> = {
  '/dashboard': Dashboard, '/classes': Classes, '/students': Students, '/subjects': Subjects, '/exams': Exams,
  '/grades': Grades, '/attendance': Attendance, '/barcode': BarcodePage, '/reports': Reports,
  '/users': UsersPage, '/settings': SettingsPage, '/activity': Activity,
};

function ProtectedApp() {
  const [loc] = useLocation();
  return (
    <>
      <Show when="signed-in">
        <MeGate>
          <Shell>
            <ErrorBoundary resetKey={loc}>
              <Suspense fallback={<div className="panel space-y-3 p-4" aria-busy="true" aria-label="جارٍ التحميل">{[0, 1, 2, 3].map((i) => <div key={i} className="h-10 animate-pulse rounded-lg bg-muted" />)}</div>}>
              <Switch>
                {Object.entries(pages).map(([p, C]) => <Route key={p} path={p} component={C} />)}
                <Route component={NotFound} />
              </Switch>
              </Suspense>
            </ErrorBoundary>
          </Shell>
        </MeGate>
      </Show>
      <Show when="signed-out"><Redirect to="/" /></Show>
    </>
  );
}

const LEGACY: Record<string, string> = {
  'dashboard.html': '/dashboard', 'stud.html': '/students', 'table.html': '/exams', 'barcode.html': '/barcode', 'grades.html': '/grades',
  'absence.html': '/attendance', 'reports.html': '/reports', 'settings.html': '/settings', 'users.html': '/users', 'changes.html': '/activity',
  'index.html': '/dashboard',
};
function LegacyGate({ children }: { children: React.ReactNode }) {
  const [loc] = useLocation();
  const m = /^(?:\/School)?\/([^/]+\.html)$/i.exec(loc);
  const target = m && LEGACY[m[1].toLowerCase()];
  return target ? <Redirect to={target} /> : <>{children}</>;
}

function ClerkProviderWithRoutes() {
  const [, setLocation] = useLocation();
  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      proxyUrl={clerkProxyUrl}
      appearance={clerkAppearance}
      signInUrl={`${basePath}/sign-in`}
      signUpUrl={`${basePath}/sign-up`}
      signInForceRedirectUrl={`${basePath}/dashboard`}
      signUpForceRedirectUrl={`${basePath}/dashboard`}
      localization={localization}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
    >
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <ClerkQueryClientCacheInvalidator />
          <LegacyGate>
          <Switch>
            <Route path="/" component={HomeRedirect} />
            <Route path="/sign-in/*?" component={SignInPage} />
            <Route path="/sign-up/*?" component={SignUpPage} />
            <Route component={ProtectedApp} />
          </Switch>
          </LegacyGate>
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </ClerkProvider>
  );
}

function App() {
  return (
    <WouterRouter base={basePath}>
      <ClerkProviderWithRoutes />
    </WouterRouter>
  );
}

export default App;
