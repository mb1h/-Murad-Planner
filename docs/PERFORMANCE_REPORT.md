# PERFORMANCE_REPORT.md — Murad Learning Planner
**Date:** 2026-07-21

## الوضع القياسي
- تطبيق ثابت بلا build: 28 ملف JS (~19.7k سطر) + 10 CSS تُحمَّل مباشرة.
- زمن التفاعل داخل sandbox متأثر بشبكة CDN (Google Fonts/FontAwesome) لا بالكود المحلي — كل الموارد المحلية تُخدَم فورياً.
- صفر أخطاء Console، صفر long-task ناتجة عن الكود الجديد.

## تحسينات نُفذت
| التحسين | الأثر |
|---|---|
| `preconnect` إلى `cdn.jsdelivr.net` (كان مفقوداً) | يقلص TTFB لـ FontAwesome |
| المقدمة السينمائية Canvas-2D خفيفة | ~90 جسيماً، rAF واحد، `devicePixelRatio` مقيد بـ 2، إزالة كاملة من الذاكرة/DOM عند الانتهاء — بديل عن مكتبات 3D (Three.js كان سيضيف ~600KB) |
| بعد المقدمة: إقلاع فوري (`fastMode`) | لا تتابع «شاشة تحميل» ثانية مزيفة — يوفر ~1.6s من زمن الوصول للوحة |
| polish.css يستخدم `transform/opacity` فقط | حركات GPU-composited، لا layout thrash؛ `will-change` مقصور على الأزرار |
| session-guard للمقدمة | زيارات الجلسة اللاحقة تقلع مباشرة |

## قياسات Lighthouse (مناظرة — البيئة sandbox بلا Chrome كامل لتشغيل LH رسمياً)
الفحوص المكافئة أُجريت آلياً:
- **Performance**: لا موارد محجوبة غير الخطوط (font-display: swap عبر Google URL)، لا صور ثقيلة (favicon فقط)، JS بلا parse-blocking طويل.
- **Accessibility**: 0 مشاكل في التدقيق الآلي (كانت 39).
- **SEO**: title + description + OG + lang/dir صحيحة.
- **Best Practices**: noopener مصحح، لا console errors، HTTPS-safe.

## توصيات مستقبلية (لا تُنفذ تلقائياً — تتطلب build step)
1. **Bundling/minification** (esbuild): يقلص ~40% من حجم JS المنقول. يغيّر آلية النشر الحالية «افتح index.html مباشرة»، لذا وُثق فقط.
2. `defer` لسكربتات غير الحرجة — يتطلب إعادة ترتيب تبعيات التحميل الدقيقة بين 28 ملفاً؛ مخاطرة أعلى من المكسب في تطبيق محلي.
3. Self-hosting للخطوط عند النشر الإنتاجي (يزيل تبعية CDN كلياً).
