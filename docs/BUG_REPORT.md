# BUG_REPORT.md — Murad Learning Planner
**Date:** 2026-07-21 · **Method:** فحص كود يدوي + اختبار متصفح آلي (Playwright/Chromium) + محاكاة مستخدم حقيقي

## الأخطاء المكتشفة والمُصلحة

| # | الخطورة | الخطأ | الجذر | الإصلاح | التحقق |
|---|---|---|---|---|---|
| B1 | 🔴 Critical | **XSS مخزنة**: `escapeHtml()` بلا مفعول (`< → <`) — أي محتوى مستخدم/AI يُحقن كـ HTML حي | كيانات HTML انحلّت في جلسة تحرير سابقة داخل `js/app.js` | إعادة كتابة الدالة بكيانات صحيحة (`&lt;` `&amp;` `&quot;`)، وكذلك `escapeAttr()` | اختبار حقن فعلي في المتصفح: `<img onerror>` لا يُنفَّذ ✅ |
| B2 | 🔴 High | **حقن HTML في محادثة AI**: `renderMarkdown()` عقّم الكود المسوّر فقط | التحويلات جرت على النص الخام | إعادة بناء: استخراج code-blocks → escape شامل → تحويلات Markdown → استرجاع | `alert(1)` عبر img/link محجوب، وكل صيغ Markdown تعمل ✅ |
| B3 | 🟠 Medium | روابط `javascript:` في Markdown تعمل | لا يوجد فحص للبروتوكول | `_sanitizeUrl()` يسمح بـ http(s)/mailto/#/​/ فقط | `[x](javascript:alert(1))` → `href="#"` ✅ |
| B4 | 🟠 Medium | اسم ملف صوتي مرفوع يُحقن في `innerHTML` | قالب template literal دون تعقيم | `escapeHtmlAttr()` جديدة في `data.js` | فحص كود ✅ |
| B5 | 🟡 Low | `target="_blank"` دون `noopener` (tabnabbing) | سهو | أُضيف `rel="noopener noreferrer"` | فحص كود ✅ |
| B6 | 🟡 Low | 39 مشكلة وصولية: أزرار أيقونية بلا اسم، حقول بلا label مرتبط، لا skip-link، لا meta description | تراكم تاريخي | aria-label + `for=` لكل عنصر، skip-link، meta/OG tags | إعادة تدقيق آلي: **0 مشاكل** ✅ |
| B7 | 🟡 Low | مسارات `tests/test-pdf.html` انكسرت بعد النقل | نقل الملف | تصحيح إلى `../js/pdf/` | فحص ✅ |

## أخطاء لم تُرصد (تم اختبارها وثبتت سلامتها)

- ✅ لا Console Errors أو Page Errors في أي صفحة (14 سيناريو تحميل).
- ✅ لا Broken Links محلية (كل الموارد 200).
- ✅ لا Overflow أفقي على 5 مقاسات شاشة × 4 صفحات.
- ✅ حفظ/استرجاع البيانات عبر إعادة التحميل يعمل (15 مفتاح localStorage).
- ✅ الجدول الأسبوعي 7 صفوف دائماً، التنقل بين الأسابيع سليم.
- ✅ المؤقت start/pause/reset/skip جميعها معرّفة وتعمل.
- ✅ التقارير السابقة (`AUDIT_REPORT.md` القديم) ذكرت مشاكل فقدان بيانات — **أُصلحت سابقاً** في جلسات `stabilization` وتم التحقق من عملها الآن.

## ملاحظة شبكة sandbox
طلب Google Fonts / FontAwesome CDN قد يتأخر في بيئة الـ sandbox — لا علاقة له بالكود، وكل الموارد المحلية سليمة.
