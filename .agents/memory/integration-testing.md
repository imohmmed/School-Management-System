---
name: Integration testing caveats
description: Clerk programmatic browser handshakes and Node test discovery exclusions.
---

نجاح استدعاء مساعد تسجيل الدخول للاختبار لا يكفي: أكمل رابط المصافحة الذي يعيده، ثم تحقق من حالة Clerk signed-in ومن نجاح `/api/me`.

**Why:** أعاد المساعد استجابة بلا خطأ، لكن المتصفح ظل غير مسجّل حتى أُكملت المصافحة. بعد إكمالها ثبت وجود مستخدم حقيقي وبريد موثّق ونجحت تهيئة أول مدير.

**How to apply:** في اختبار Clerk استخدم تدفق الاختبار المدعوم مع claims override، ولا تضف تجاوز مصادقة إلى التطبيق ولا تختبر نموذج تسجيل الدخول نفسه.

لا تضع اختبار Node المترجم داخل node_modules؛ استخدم مكانًا مؤقتًا خارجها.

**Why:** تجاهل Node --test الملف تحت node_modules رغم أنه موجود، وظهر خطأ Could not find.

**How to apply:** اجمع اختبار المسارات في /tmp ثم شغّله هناك، مع تنظيف بيانات الاختبار المحددة فقط.
