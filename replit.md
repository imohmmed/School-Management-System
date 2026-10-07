# نظام إدارة المدارس

تطبيق عربي RTL لإدارة الصفوف والطلاب والمواد والامتحانات والدرجات والحضور والتقارير، مُعاد بناؤه من ملفات المستخدم الأصلية.

## التشغيل

- API: `pnpm --filter @workspace/api-server run dev`
- Web: `pnpm --filter @workspace/school-management run dev`
- المعاينة الأصلية للوحة التحكم داخل sandbox مرجع بصري فقط، لا بيانات مدرسة.
- الخدمات تعتمد `PORT` المخصص لها؛ الواجهة تعتمد `BASE_PATH`.
- PostgreSQL الحالي عبر `@workspace/db` هو مصدر البيانات. لا تستبدله بقاعدة أخرى.

## خريطة المشروع

- `SCHOOL_MANAGEMENT_COMPLETION_TASK.md`: نطاق العمل ومعايير القبول.
- `SCHOOL_SYSTEM_GUIDE.md`: الإعداد والصلاحيات وقواعد البيانات والنسخ والاستعادة.
- `artifacts/school-management/src`: الواجهة، التنقل، صفحات النظام والهوية العربية.
- `artifacts/api-server/src`: المصادقة ومسارات API والتحقق والتدقيق.
- `lib/db/src/schema`: مخطط Drizzle.
- `lib/api-spec/openapi.yaml`: مصدر عقد API.
- `lib/api-client-react` و`lib/api-zod`: مولّدان؛ غيّر العقد ثم نفّذ codegen، ولا تعدّل مخرجات التوليد يدويًا.
- `attached_assets/School_1791389658185.zip`: المصدر الأصلي محفوظ.

## التحقق

```sh
pnpm -w run typecheck:libs
pnpm --filter @workspace/api-server run typecheck
pnpm --filter @workspace/school-management run typecheck
pnpm --filter @workspace/api-server run test:integration
pnpm --filter @workspace/api-spec run codegen
```

اختبار التكامل ينشئ ويحذف سجلاته الصناعية فقط. لا تشغّله على الإنتاج.

## قرارات المنتج والسلامة

- المصادقة مُدارة عبر Clerk؛ لا تخزين لكلمات مرور محلية أو بيانات دخول ثابتة.
- أول حساب موثّق يطالب بإعداد المدير عند خلو حسابات المدرسة؛ سجّل حساب المالك قبل مشاركة التطبيق.
- الانضمام لاحقًا بدعوة أو صلاحية يمنحها المدير؛ الصلاحيات تتحقق في الخادم.
- أرشفة الطلاب تحفظ التاريخ؛ الحضور يحتفظ بصف التسجيل والدرجات بصف الامتحان.
- نتائج النجاح تعتمد معيار المادة، وإعدادات الدرجات قيم أولية وليست تعديلًا رجعيًا.
- لا حذف واسع أو ترحيل إنتاج أو استيراد بيانات طلاب حقيقية دون موافقة.
- جميع الشروحات والواجهة باللغة العربية، مع دعم الهاتف والتابلت والكمبيوتر وأيقونات موحدة.
