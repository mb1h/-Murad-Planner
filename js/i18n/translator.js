/* ============================================================
   MURAD LEARNING PLANNER - Global Translation Engine v2.0
   Supports: Arabic, English, Indonesian
   ============================================================ */

(function () {
  'use strict';

  // ── State ───────────────────────────────────────────────────
  const SUPPORTED_LANGUAGES = ['ar', 'en', 'id'];
  const DEFAULT_LANGUAGE = 'ar';

  let _currentLang = localStorage.getItem('murad_lang') || DEFAULT_LANGUAGE;
  let _translations = {};
  let _observers = [];

  // ── Load translations ────────────────────────────────────────
  function _loadTranslations() {
    // Merge all language dictionaries
    if (typeof LANG_AR !== 'undefined') _translations.ar = LANG_AR;
    if (typeof LANG_EN !== 'undefined') _translations.en = LANG_EN;
    if (typeof LANG_ID !== 'undefined') _translations.id = LANG_ID;

    // Fallback: also merge legacy TRANSLATIONS if present (for backwards compat)
    if (typeof TRANSLATIONS !== 'undefined') {
      Object.keys(TRANSLATIONS).forEach(lang => {
        if (!_translations[lang]) _translations[lang] = {};
        Object.assign(_translations[lang], TRANSLATIONS[lang]);
      });
    }
  }

  // ── Core t() function ────────────────────────────────────────
  function t(key, params) {
    if (!_translations[_currentLang]) _loadTranslations();

    let value = (_translations[_currentLang] && _translations[_currentLang][key]) ||
                (_translations[DEFAULT_LANGUAGE] && _translations[DEFAULT_LANGUAGE][key]) ||
                key;

    // Parameter substitution: t('hello.name', {name: 'Murad'}) → 'Hello Murad'
    if (params && typeof params === 'object') {
      Object.keys(params).forEach(param => {
        value = value.replace(new RegExp(`\\{${param}\\}`, 'g'), params[param]);
      });
    }

    return value;
  }

  // ── Apply translations to DOM ────────────────────────────────
  function applyTranslations(root) {
    const container = root || document;

    // Text content
    container.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      if (key) el.textContent = t(key);
    });

    // Placeholder attributes
    container.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
      const key = el.getAttribute('data-i18n-placeholder');
      if (key) el.placeholder = t(key);
    });

    // Title attributes
    container.querySelectorAll('[data-i18n-title]').forEach(el => {
      const key = el.getAttribute('data-i18n-title');
      if (key) el.title = t(key);
    });

    // Aria-label attributes
    container.querySelectorAll('[data-i18n-aria]').forEach(el => {
      const key = el.getAttribute('data-i18n-aria');
      if (key) el.setAttribute('aria-label', t(key));
    });

    // HTML content (for rich text)
    container.querySelectorAll('[data-i18n-html]').forEach(el => {
      const key = el.getAttribute('data-i18n-html');
      if (key) el.innerHTML = t(key);
    });

    // Update DOM direction & lang
    _updateDocumentLocale();
  }

  // ── Update document locale ───────────────────────────────────
  function _updateDocumentLocale() {
    const isRTL = _currentLang === 'ar';
    document.documentElement.setAttribute('dir', isRTL ? 'rtl' : 'ltr');
    document.documentElement.setAttribute('lang', _currentLang);
    document.documentElement.setAttribute('data-lang', _currentLang);
  }

  // ── Language switching ───────────────────────────────────────
  function setLanguage(lang) {
    if (!SUPPORTED_LANGUAGES.includes(lang)) {
      console.warn(`[i18n] Unsupported language: ${lang}. Supported: ${SUPPORTED_LANGUAGES.join(', ')}`);
      return;
    }

    const prevLang = _currentLang;
    _currentLang = lang;
    localStorage.setItem('murad_lang', lang);

    // Reload translations if needed
    _loadTranslations();

    // Apply to full DOM
    applyTranslations();

    // Update language selector buttons
    _updateLangButtons(lang);

    // Notify observers
    _observers.forEach(fn => {
      try { fn(lang, prevLang); } catch (e) { console.error('[i18n] Observer error:', e); }
    });

    // Re-render dynamic content
    _rerenderDynamicContent(lang);

    // Show toast
    if (typeof showToast === 'function') {
      showToast(t('toast.langChanged'), 'info');
    }
  }

  function _updateLangButtons(lang) {
    // Update button active states for all known lang buttons
    ['langAr', 'langEn', 'langId'].forEach(btnId => {
      const btn = document.getElementById(btnId);
      if (btn) {
        const btnLang = btnId.replace('lang', '').toLowerCase();
        btn.classList.toggle('active', btnLang === lang);
      }
    });

    // Also handle data-lang-btn attributes
    document.querySelectorAll('[data-lang-btn]').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-lang-btn') === lang);
    });
  }

  function _rerenderDynamicContent(lang) {
    if (window.renderWeeklyTable) renderWeeklyTable();
    if (window.renderDashboard) renderDashboard();
    if (window.currentDayPattern) showDayPatternBoard(window.currentDayPattern, window.currentDayKey);

    // Re-render AI pages if visible
    const aiPages = ['ai-workspace', 'ai-settings', 'ai-analytics', 'ai-automation', 'ai-personality'];
    aiPages.forEach(pageId => {
      const page = document.getElementById('page-' + pageId);
      if (page && page.classList.contains('active')) {
        const renderers = {
          'ai-workspace': window.renderAIWorkspacePage,
          'ai-settings': window.renderAISettingsPage,
          'ai-analytics': window.renderAIAnalyticsPage,
          'ai-automation': window.renderAIAutomationPage,
          'ai-personality': window.renderAIPersonalityPage,
        };
        if (renderers[pageId]) renderers[pageId]();
      }
    });

    // Update floating dock context
    if (window.updateDockContext) updateDockContext();
    if (window.updateFloatingAIContext) updateFloatingAIContext();
  }

  function toggleLanguage() {
    const idx = SUPPORTED_LANGUAGES.indexOf(_currentLang);
    setLanguage(SUPPORTED_LANGUAGES[(idx + 1) % SUPPORTED_LANGUAGES.length]);
  }

  function getCurrentLang() {
    return _currentLang;
  }

  function isRTL() {
    return _currentLang === 'ar';
  }

  // ── Observer pattern ─────────────────────────────────────────
  function onLanguageChange(fn) {
    if (typeof fn === 'function') _observers.push(fn);
  }

  // ── Convenience formatters ───────────────────────────────────
  function formatNumber(num) {
    try {
      return new Intl.NumberFormat(_currentLang === 'ar' ? 'ar-SA' : _currentLang).format(num);
    } catch (e) {
      return String(num);
    }
  }

  function formatDate(date, options) {
    try {
      const locale = _currentLang === 'ar' ? 'ar-SA' : _currentLang === 'id' ? 'id-ID' : 'en-US';
      return new Intl.DateTimeFormat(locale, options || { dateStyle: 'medium' }).format(date);
    } catch (e) {
      return date.toLocaleDateString();
    }
  }

  function formatTime(date) {
    try {
      const locale = _currentLang === 'ar' ? 'ar-SA' : _currentLang === 'id' ? 'id-ID' : 'en-US';
      return new Intl.DateTimeFormat(locale, { timeStyle: 'short' }).format(date);
    } catch (e) {
      return date.toLocaleTimeString();
    }
  }

  // ── Initialize ───────────────────────────────────────────────
  function init() {
    _loadTranslations();

    document.addEventListener('DOMContentLoaded', () => {
      applyTranslations();
      _updateLangButtons(_currentLang);
    });

    // If DOM already loaded
    if (document.readyState !== 'loading') {
      applyTranslations();
      _updateLangButtons(_currentLang);
    }
  }

  // ── Export to global scope ───────────────────────────────────
  // Override old globals with new engine
  window.t = t;
  window.applyTranslations = applyTranslations;
  window.setLanguage = setLanguage;
  window.toggleLanguage = toggleLanguage;
  window.getCurrentLang = getCurrentLang;
  window.isRTL = isRTL;
  window.onLanguageChange = onLanguageChange;
  window.formatNumber = formatNumber;
  window.formatDate = formatDate;
  window.formatTime = formatTime;
  window.currentLang = _currentLang; // legacy compat

  // Proxy to keep window.currentLang in sync
  Object.defineProperty(window, 'currentLang', {
    get() { return _currentLang; },
    set(v) { /* read-only via this path */ }
  });

  init();

})();
