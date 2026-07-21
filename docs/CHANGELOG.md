# CHANGELOG.md

## [1.1.0] — 2026-07-21 · «Global-Grade Hardening & Cinematic Polish»

### Security 🔐
- **CRITICAL FIX**: `escapeHtml()`/`escapeAttr()` كانتا بلا مفعول (كيانات HTML منحلة) — أُصلحتا؛ كل تعقيم التطبيق يعمل الآن فعلياً.
- إعادة بناء `renderMarkdown()` بمعمارية escape-first (استخراج code-blocks → تعقيم شامل → Markdown → استرجاع).
- `_sanitizeUrl()`: حجب `javascript:` وغيرها من روابط Markdown.
- تعقيم أسماء النغمات المرفوعة (`escapeHtmlAttr` في `data.js`).
- `rel="noopener noreferrer"` لرابط تنزيل صور AI.

### Added ✨
- **مقدمة سينمائية** (`js/intro.js` + `css/intro.css`): فضاء عميق → بنية عصبية → تقارب جسيمات → وميض → كشف الشعار. قابلة للتخطي (زر/Esc/نقر)، مرة لكل جلسة، تُعطَّل مع reduced-motion، ولها toggle في الإعدادات.
- **طبقة صقل UI** (`css/polish.css`): page transitions، micro-interactions، focus glow، skeleton shimmer، toast/modal pop — كلها reduced-motion-safe.
- **SEO/Head**: meta description، Open Graph، theme-color، color-scheme، preconnect jsDelivr.
- **Skip-to-content link** + مفاتيح ترجمة جديدة (ar/en/id) للمقدمة والإعداد الجديد.
- إعداد `introEnabled` في نظام الإعدادات (حفظ/تحميل).

### Accessibility ♿
- 39 → 0 مشاكل: `aria-label` لكل زر أيقوني، ربط `for=` لكل الحقول (24)، `aria-hidden` للأيقونات الزخرفية.

### Removed / Moved 🧹
- حذف `js/i18n.js` (445 سطراً ميتاً — استُبدل بـ `js/i18n/*` ولم يعد يُحمَّل).
- نقل `test-pdf.html` و `test_session8.js` إلى `tests/` مع تصحيح المسارات.
- إخراج `.backup/` من Git عبر `.gitignore` (بقيت محلياً).

### Docs 📚
- `docs/`: FULL_AUDIT, BUG_REPORT, TEST_REPORT, SECURITY_REPORT, UI_UX_REPORT, PERFORMANCE_REPORT, IMPROVEMENT_PLAN, CHANGELOG.

### QA ✅
- حزمة Playwright بـ 68 حالة (تنقل، تفاعلات، مؤقت، إعدادات، دليل، AI pages، responsive ×5 مقاسات، أمان هجومي، وصولية): **68 PASS / 0 FAIL / 0 WARN / 0 console errors**.

### Unchanged (by design) 🛡️
- فكرة المنصة، أنماط A/B/C/D، منطق الأعمال، رحلة المستخدم، بنية الصفحات، جميع الوظائف القائمة، والهوية البصرية — دون أي تغيير جوهري.

---

## [1.0.x] — سجلات سابقة
راجع `STABILIZATION_REPORT.md` و `AUDIT_REPORT.md` و `AI_AUDIT_REPORT.md` في جذر المشروع لتاريخ الجلسات السابقة.
