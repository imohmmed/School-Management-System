---
name: OpenAPI generation caveats
description: Avoid conflicting generated TypeScript names for inline operation request bodies.
---

استخدم مخططات مكوّنات مسماة ومراجع لها في أجسام طلبات OpenAPI بدل أجسام عمليات inline.

**Why:** التوليد المتزامن لـ Zod وأنواع TypeScript قد يولّد اسم `OperationBody` مرتين عند استخدام مخطط inline؛ تصديرهما معًا يؤدي إلى خطأ duplicate export.

**How to apply:** عند إضافة عملية API لها جسم طلب، عرّف الجسم تحت components/schemas وأشر إليه بـ $ref؛ لا تصلح هذا بتعديل الملفات المولدة أو حذف أحد التصديرين يدويًا.
