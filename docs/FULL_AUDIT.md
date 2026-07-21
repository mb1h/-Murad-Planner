# FULL_AUDIT.md — Murad Learning Planner
**Date:** 2026-07-21 · **Branch:** `genspark_ai_developer` · **Auditor:** Full-stack AI team (Dev / UI-UX / QA / Security / Performance)

---

## 1. نظرة عامة على المشروع

| البند | القيمة |
|---|---|
| النوع | تطبيق ويب ثابت (Vanilla HTML/CSS/JS — بدون خادم أو Build step) |
| الحجم | ~19,700 سطر JavaScript عبر 28 ملفاً + 10 ملفات CSS |
| التخزين | `localStorage` عبر طبقة `DB` (`js/store.js`) — لا توجد قاعدة بيانات خادمية |
| اللغات | عربي (افتراضي RTL) / إنجليزي / إندونيسي عبر `js/i18n/translator.js` |
| الـ Routing | SPA يدوي: `showPage()` / `showAIPage()` / `showDayPattern()` تبدّل أقسام `<section class="page">` |
| إدارة الحالة | متغيرات `window.*` عامة (`currentBlocks`, `currentWeekNum`, `WorkspaceState`) + حفظ تلقائي مدين (debounced) |
| الـ API | لا يوجد Backend خاص — نداءات AI مباشرة إلى مزودات LLM يُدخل المستخدم مفاتيحها بنفسه |

## 2. هيكل الملفات (بعد التنظيم)

```
index.html               الهيكل الرئيسي (SPA)
css/                     layout → cross-browser → style → ai-* → stabilization → ai-agent → intro → polish
js/
  cross-browser-guard.js يُحمّل أولاً (polyfills وحماية)
  intro.js               المقدمة السينمائية (جديد)
  i18n/{ar,en,id,translator}.js
  data.js  store.js  timer.js  sound.js
  pdf/{utils,theme,data,renderers,engine}.js
  app.js                 التطبيق الرئيسي
  ai-*.js                منظومة الذكاء الاصطناعي (9 ملفات)
  floating-dock.js  stabilization.js
tests/                   ملفات الاختبار اليدوية (نُقلت من الجذر)
docs/                    تقارير التوثيق (هذا المجلد)
```

## 3. الأخطاء الحرجة المكتشفة

| # | الخطورة | الوصف | الملف | الحالة |
|---|---|---|---|---|
| A1 | 🔴 **Critical** | `escapeHtml()` كانت **بلا مفعول إطلاقاً** — الاستبدالات كانت `< → <` و `& → &` (كيانات HTML انحلّت إلى نفس الحرف في جلسة تحرير سابقة). كل استدعاءات التعقيم في التطبيق كانت وهمية → ثغرة XSS مخزنة عبر خلايا الجدول، أسماء البلوكات، ورسائل AI | `js/app.js:967` | ✅ أُصلح |
| A2 | 🔴 High | `renderMarkdown()` كان يمرر نص LLM الخام إلى `innerHTML` مع تعقيم جزئي فقط (الكود المسوّر فقط) → حقن HTML من ردود النموذج أو من محتوى ملفات المستخدم | `js/ai-workspace.js:6` | ✅ أُعيد بناؤه (escape-first + placeholders) |
| A3 | 🟠 Medium | روابط Markdown قبلت `javascript:` URLs | `js/ai-workspace.js` | ✅ `_sanitizeUrl()` يحصر البروتوكولات في http/https/mailto/#/​/ |
| A4 | 🟠 Medium | أسماء النغمات المخصصة (من اسم الملف المرفوع) حُقنت في `innerHTML` دون تعقيم | `js/data.js` | ✅ `escapeHtmlAttr()` |
| A5 | 🟡 Low | رابط تنزيل صورة AI بـ `target="_blank"` دون `rel="noopener"` | `js/ai-agent-core.js:1880` | ✅ أُصلح |
| A6 | 🟡 Low | `escapeAttr()` لم تكن تعقّم `&` | `js/app.js` | ✅ أُصلح |

## 4. الأكواد/الملفات غير المستخدمة (أُزيلت أو نُقلت)

| العنصر | القرار | السبب الموثّق |
|---|---|---|
| `js/i18n.js` (445 سطر) | 🗑️ حُذف | استُبدل بالكامل بـ `js/i18n/*` — غير مُشار إليه في أي `<script>`؛ `translator.js` يحوي fallback لـ `TRANSLATIONS` لكنه لا يُحمَّل أصلاً |
| `test-pdf.html`, `test_session8.js` | 📁 نُقلا إلى `tests/` | أدوات اختبار يدوي — لا تنتمي لجذر الإنتاج؛ صُححت مساراتها النسبية |
| `.backup/` (16 ملف .bak) | 🚫 أُخرج من Git (`.gitignore`) | نسخ احتياطية قديمة تضخّم المستودع؛ بقيت على القرص محلياً |

## 5. الأكواد المكررة (موثّقة — لم تُحذف لأنها بنيوية)

- نمط **الطبقات التصحيحية**: `stabilization.js` و `ai-enhancements.js` يعيدان تعريف دوال عبر `window.*` overrides. هذا تصميم مقصود (patch-layer) وموثق في `STABILIZATION_REPORT.md`. **توصية (لا تُنفذ تلقائياً):** دمج الطبقات في الوحدات الأصلية في إصدار رئيسي قادم.
- 5 دوال escape متشابهة (`escapeHtml`, `_esc`, `_escHtml`, `esc`, `escapeHtmlAttr`) في وحدات مختلفة — جميعها **سليمة الآن** (تم تدقيقها آلياً). توحيدها في util واحد يتطلب نظام modules (توصية مستقبلية).
- قائمة النغمات العشر مكررة في `index.html` مرتين (إعدادات + لوحة البلوك) — مقبولة كـ static markup.

## 6. تحليل الأداء
راجع `PERFORMANCE_REPORT.md`. الخلاصة: لا توجد اختناقات فعلية؛ أُضيف `preconnect` لـ jsDelivr، والمقدمة السينمائية canvas-2D خفيفة (~90 جسيم، rAF واحد، dpr≤2، تتوقف كلياً عند الانتهاء).

## 7. تحليل الأمان
راجع `SECURITY_REPORT.md`. الخلاصة: أخطر ثغرة (escapeHtml المعطلة) أُصلحت وتم التحقق منها بهجمات فعلية داخل المتصفح (Playwright).

## 8. تحليل تجربة المستخدم
راجع `UI_UX_REPORT.md`. أُضيفت: مقدمة سينمائية قابلة للتخطي، skip-link، تسميات ARIA كاملة، micro-interactions، ودعم كامل لـ `prefers-reduced-motion`.

## 9. ما لم يُغيَّر (التزاماً بالحفاظ على الهوية)

- فكرة المنصة، أنماط A/B/C/D، رحلة المستخدم، منطق الأعمال، وكل الوظائف القائمة — **دون أي تغيير**.
- بنية الصفحات والتنقل بينها — كما هي.
- طبقة `stabilization.js` التصحيحية — أُبقيت كما صُممت.
- أسماء الملفات والمتغيرات القائمة — لم تُعد تسميتها إلا للملفات الميتة/الاختبارية الموثقة أعلاه.
