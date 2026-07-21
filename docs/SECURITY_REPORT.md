# SECURITY_REPORT.md — Murad Learning Planner
**Date:** 2026-07-21

## نموذج التهديد
تطبيق ثابت client-side بلا خادم: أسطح الهجوم هي XSS عبر محتوى المستخدم/ردود LLM، وتسريب مفاتيح API المخزنة محلياً.

## ما فُحص وأُصلح

| المجال | النتيجة | الإجراء |
|---|---|---|
| **XSS — تعقيم HTML** | 🔴 كانت `escapeHtml()` بلا مفعول (no-op) | ✅ أُصلحت + دُقّقت كل helpers الـ escape الخمسة آلياً (كلها سليمة الآن) |
| **XSS — Markdown/LLM output** | 🔴 رندر جزئي التعقيم | ✅ escape-first architecture + اختبار حقن فعلي ناجح |
| **URL Injection** | 🟠 `javascript:` مقبول في روابط Markdown | ✅ `_sanitizeUrl()` allow-list |
| **Tabnabbing** | 🟡 `_blank` بلا noopener | ✅ `rel="noopener noreferrer"` |
| **حقن أسماء الملفات** | 🟠 أسماء النغمات المرفوعة | ✅ `escapeHtmlAttr()` |
| **SQL Injection** | N/A | لا قاعدة بيانات — localStorage فقط |
| **CSRF** | N/A | لا خادم ولا جلسات cookie |
| **Authentication/Authorization** | N/A بالتصميم | تطبيق شخصي أحادي المستخدم بلا حسابات |
| **Secrets في الكود** | ✅ نظيف | لا مفاتيح مضمنة؛ حقول `apiKey` في `ai-providers.js` فارغة افتراضياً |
| **Dependencies** | ✅ منخفض الخطر | CDN فقط: Google Fonts + FontAwesome 6.4 (CSS). لا JS خارجي قابل للتنفيذ سوى FA CSS |
| **eval()** | ✅ غير مستخدم | الفحص الشامل لم يجد أي `eval` |

## مخاطر متبقية موثقة (تتطلب قرارات معمارية — لا تُنفذ تلقائياً)

1. **مفاتيح API في localStorage** (`murad_ai_providers`): أي XSS مستقبلية أو وصول فيزيائي للجهاز يكشفها. هذا قيد معماري لتطبيق بلا خادم — البدائل (proxy خادمي، Web Crypto wrapping) تغيّر بنية المشروع. *توصية: إضافة تحذير للمستخدم في AI Settings.*
2. **Content-Security-Policy**: لا يمكن فرض CSP فعال بوجود `onclick` inline handlers المنتشرة (~48 في index.html + قوالب JS). إعادة الهيكلة إلى event delegation شرط مسبق لأي CSP. *موثق كتحسين مستقبلي في IMPROVEMENT_PLAN.md.*
3. **Subresource Integrity (SRI)** لموارد CDN: يتطلب تثبيت إصدارات دقيقة؛ يُوصى به عند النشر الإنتاجي.
4. **رفع الأصوات**: يُقبل بحسب امتداد/نوع الملف ويُخزن Data-URL — الحد 5MB لـ localStorage يحد الأثر، والتشغيل عبر `Audio` آمن من التنفيذ.

## التحقق
كل إصلاح تم التحقق منه بهجوم فعلي داخل Chromium (Playwright) — راجع TEST_REPORT.md قسم «أمان».
