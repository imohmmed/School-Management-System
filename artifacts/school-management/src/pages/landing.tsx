import { Link } from 'wouter';
import { GraduationCap, ClipboardCheck, ScanBarcode, FileBarChart, CalendarDays, ShieldCheck, ArrowLeft, UserCheck, Lock } from 'lucide-react';
import { useGetSetupStatus } from '@workspace/api-client-react';

const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');

const modules = [
  { icon: GraduationCap, t: 'سجل الطلاب', d: 'ملف لكل طالب برقم مدرسي وباركود ثابت، مع استيراد من Excel وأرشفة بدل الحذف.', span: 'md:col-span-2' },
  { icon: UserCheck, t: 'الحضور والغياب', d: 'تسجيل يومي لكل صف بنقرة واحدة، مع سجل قابل للتصحيح.', span: '' },
  { icon: ScanBarcode, t: 'قارئ الباركود', d: 'وجّه القارئ إلى الحقل وامسح. يُسجَّل الطالب ويظهر اسمه فورًا.', span: '' },
  { icon: ClipboardCheck, t: 'إدخال الدرجات', d: 'جدول واحد لكل امتحان، وحفظ جماعي مع تحقق من حدود الدرجة.', span: '' },
  { icon: CalendarDays, t: 'الجدول الامتحاني', d: 'جلسات ومواعيد مرتبطة بالمواد والصفوف، جاهزة للطباعة.', span: '' },
  { icon: FileBarChart, t: 'تقارير وتصدير', d: 'تقارير الغياب والنتائج بمرشحات حقيقية، وتصدير XLSX وطباعة مرتبة.', span: 'md:col-span-2' },
];

export default function Landing() {
  const { data: setup } = useGetSetupStatus();
  const first = setup && !setup.initialized;
  return (
    <div className="min-h-[100dvh] bg-background">
      <div className="pattern bg-sidebar text-sidebar-foreground">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
          <div className="flex items-center gap-3">
            <img src={`${basePath}/logo.svg`} alt="" className="size-11 rounded-xl" />
            <span className="font-display text-lg font-extrabold text-sidebar-accent-foreground">نظام إدارة المدارس</span>
          </div>
          <Link href="/sign-in" className="btn btn-sm bg-sidebar-accent text-sidebar-accent-foreground hover:bg-sidebar-border">تسجيل الدخول</Link>
        </div>
        <section className="mx-auto grid max-w-6xl items-center gap-10 px-5 pb-20 pt-10 lg:grid-cols-[1.2fr_1fr] lg:pt-20">
          <div className="rise">
            <p className="mb-4 inline-flex items-center gap-2 rounded-full bg-sidebar-accent px-4 py-1.5 text-sm text-sidebar-primary"><ShieldCheck className="size-4" />لإدارة المدرسة والمعلمين</p>
            <h1 className="font-display text-4xl font-extrabold leading-[1.35] text-sidebar-accent-foreground sm:text-5xl lg:text-6xl">
              دفتر المدرسة اليومي، <span className="text-sidebar-primary">في مكان واحد</span> لا يضيع منه سطر.
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-8 text-sidebar-foreground/85">
              تسجيل الطلاب، الحضور والغياب، الدرجات والجداول الامتحانية في مساحة عمل واحدة تعمل على الهاتف واللوحي والحاسوب، وكل تغيير يُحفظ ويُسجَّل باسم صاحبه.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              {first ? (
                <Link href="/sign-up" className="btn bg-sidebar-primary text-sidebar-primary-foreground hover:brightness-110">إنشاء حساب المدير الأول<ArrowLeft className="size-4" /></Link>
              ) : (
                <Link href="/sign-in" className="btn bg-sidebar-primary text-sidebar-primary-foreground hover:brightness-110">الدخول إلى النظام<ArrowLeft className="size-4" /></Link>
              )}
            </div>
            {setup && (
              <p className="mt-4 flex items-start gap-2 text-sm text-sidebar-foreground/75">
                <Lock className="mt-0.5 size-4 shrink-0" />
                {first ? 'النظام جديد ولم يُنشأ مدير بعد. أول حساب يتم التحقق من بريده يصبح مدير النظام.' : 'الدخول للحسابات المدعوة من مدير المدرسة فقط. إن لم تصلك دعوة فاطلبها من الإدارة.'}
              </p>
            )}
          </div>
          <div className="rise hidden lg:block" style={{ animationDelay: '.15s' }}>
            <div className="rotate-[-2deg] rounded-3xl border border-sidebar-border bg-sidebar-accent/60 p-6">
              <div className="mb-4 flex items-center justify-between text-sm"><span className="font-display font-bold text-sidebar-accent-foreground">مسح الباركود</span><ScanBarcode className="size-5 text-sidebar-primary" /></div>
              <div className="space-y-2.5">
                {['يُقرأ الرمز', 'يُطابَق مع الطالب', 'يُحفظ في الخادم', 'تظهر النتيجة فقط بعد الحفظ'].map((s, i) => (
                  <div key={s} className="flex items-center gap-3 rounded-xl bg-sidebar px-4 py-3">
                    <span className="grid size-7 place-items-center rounded-full bg-sidebar-primary text-sm font-extrabold text-sidebar-primary-foreground">{i + 1}</span>
                    <span className="text-sm">{s}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      </div>

      <section className="mx-auto max-w-6xl px-5 py-16">
        <h2 className="font-display text-3xl font-extrabold">كل ما يحتاجه يوم دراسي</h2>
        <p className="mt-2 max-w-xl text-muted-foreground">الوحدات التي كانت صفحات منفصلة أصبحت نظامًا واحدًا بتنقل ثابت.</p>
        <div className="mt-8 grid gap-4 md:grid-cols-4">
          {modules.map((m) => (
            <div key={m.t} className={`panel p-6 ${m.span || 'md:col-span-1'} ${m.span ? '' : ''}`}>
              <span className="mb-4 grid size-11 place-items-center rounded-xl bg-primary text-primary-foreground"><m.icon className="size-5" /></span>
              <h3 className="font-display text-lg font-bold">{m.t}</h3>
              <p className="mt-1.5 text-sm leading-7 text-muted-foreground">{m.d}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-secondary/70">
        <div className="mx-auto grid max-w-6xl gap-10 px-5 py-16 lg:grid-cols-2">
          <div>
            <h2 className="font-display text-3xl font-extrabold">صلاحيات واضحة لكل شخص</h2>
            <p className="mt-3 leading-8 text-muted-foreground">تُفرض الصلاحيات على الخادم لا في الواجهة فقط، فلا يستطيع أحد تنفيذ ما لم يُسمح له به.</p>
          </div>
          <dl className="space-y-3">
            {[['مدير النظام', 'يدير الطلاب والصفوف والمواد والامتحانات والمستخدمين والإعدادات.'], ['معلم', 'يسجل الدرجات والحضور والغياب ويطلع على التقارير.'], ['مشاهد', 'اطلاع فقط على البيانات والتقارير دون أي تعديل.']].map(([a, b]) => (
              <div key={a} className="panel flex gap-4 p-4"><dt className="w-24 shrink-0 font-display font-bold text-primary">{a}</dt><dd className="text-sm leading-7">{b}</dd></div>
            ))}
          </dl>
        </div>
      </section>

      <footer className="px-5 py-8 text-center text-sm text-muted-foreground">نظام إدارة المدارس - التوقيت المعتمد: بغداد</footer>
    </div>
  );
}
