/* ============================================================
   PDF ENGINE — Utilities Module
   Single source of truth for value safety, escaping and
   text formatting used by the PDF report renderers.
   ============================================================ */
(function (global) {
  'use strict';

  /**
   * Safely extract a printable string from any value.
   * Handles: null / undefined / {ar,en} bilingual objects /
   * arrays / numbers / broken JSON — never returns
   * "[object Object]", "undefined", "null" or "NaN".
   */
  function safeText(val, lang) {
    if (val === null || val === undefined) return '';
    if (typeof val === 'string') {
      const s = val.trim();
      if (s === 'undefined' || s === 'null' || s === 'NaN' || s === '[object Object]') return '';
      return s;
    }
    if (typeof val === 'number') return Number.isFinite(val) ? String(val) : '';
    if (typeof val === 'boolean') return '';
    if (Array.isArray(val)) {
      return val.map(v => safeText(v, lang)).filter(Boolean).join('، ');
    }
    if (typeof val === 'object') {
      // Bilingual {ar, en} objects — prefer requested language, fall back gracefully
      const pref = lang === 'en' ? ['en', 'ar'] : ['ar', 'en'];
      for (const k of pref) {
        const s = safeText(val[k], lang);
        if (s) return s;
      }
      // Common alternative shapes
      for (const k of ['text', 'value', 'label', 'name', 'title']) {
        if (k in val) {
          const s = safeText(val[k], lang);
          if (s) return s;
        }
      }
      return '';
    }
    return '';
  }

  /** Escape a string for safe HTML interpolation. */
  function esc(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /** Convert Arabic-Indic digits to Western digits (better for print alignment). */
  function westernDigits(text) {
    return String(text == null ? '' : text).replace(/[\u0660-\u0669\u06F0-\u06F9]/g, function (ch) {
      const code = ch.charCodeAt(0);
      const base = code >= 0x06F0 ? 0x06F0 : 0x0660;
      return String.fromCharCode(code - base + 48);
    });
  }

  /** Format minutes as a natural Arabic duration, e.g. "٥ ساعات و٣٠ دقيقة" (western digits). */
  function formatDuration(totalMin) {
    const min = Math.max(0, Math.round(Number(totalMin) || 0));
    const h = Math.floor(min / 60);
    const m = min % 60;
    const hTxt = h === 0 ? '' : (h === 1 ? 'ساعة واحدة' : h === 2 ? 'ساعتان' : (h + ' ساعات'));
    const mTxt = m === 0 ? '' : (m === 1 ? 'دقيقة واحدة' : m === 2 ? 'دقيقتان' : (m + ' دقيقة'));
    if (hTxt && mTxt) return hTxt + ' و' + mTxt;
    return hTxt || mTxt || '0 دقيقة';
  }

  /** Short compact duration, e.g. "1:30 س" or "45 د". */
  function shortDuration(totalMin) {
    const min = Math.max(0, Math.round(Number(totalMin) || 0));
    if (min < 60) return min + ' د';
    const h = Math.floor(min / 60);
    const m = min % 60;
    return m ? (h + ':' + String(m).padStart(2, '0') + ' س') : (h + ' س');
  }

  /** Gregorian Arabic date with western digits, e.g. "17 يوليو 2026". */
  function formatDateAr(date) {
    const d = date instanceof Date ? date : new Date();
    try {
      const s = d.toLocaleDateString('ar-EG-u-ca-gregory', { day: 'numeric', month: 'long', year: 'numeric' });
      return westernDigits(s);
    } catch (e) {
      return d.toISOString().slice(0, 10);
    }
  }

  /** Detect whether a text fragment is predominantly LTR (code, English). */
  function isMostlyLtr(text) {
    const s = String(text || '');
    const ltr = (s.match(/[A-Za-z]/g) || []).length;
    const rtl = (s.match(/[\u0600-\u06FF]/g) || []).length;
    return ltr > rtl * 2 && ltr > 3;
  }

  /**
   * Convert a plain-text user note into structured, print-safe HTML.
   * Supports: paragraphs, bullet lists (-, *, •), numbered lists,
   * fenced code blocks (```), and per-line direction isolation so
   * mixed Arabic/English never breaks the RTL layout.
   */
  function richText(raw) {
    const text = safeText(raw);
    if (!text) return '';

    const lines = text.replace(/\r\n?/g, '\n').split('\n');
    const out = [];
    let list = null;   // { type: 'ul'|'ol', items: [] }
    let code = null;   // array of code lines

    const flushList = () => {
      if (!list) return;
      const tag = list.type;
      out.push('<' + tag + ' class="pdf-list">' + list.items.map(i => '<li>' + i + '</li>').join('') + '</' + tag + '>');
      list = null;
    };
    const lineHtml = (s) => {
      const dir = isMostlyLtr(s) ? ' dir="ltr" style="text-align:left"' : '';
      return '<span' + dir + '>' + esc(s) + '</span>';
    };

    for (const rawLine of lines) {
      const line = rawLine.replace(/\s+$/, '');

      // Fenced code blocks
      if (/^\s*```/.test(line)) {
        if (code) {
          out.push('<pre class="pdf-code" dir="ltr">' + esc(code.join('\n')) + '</pre>');
          code = null;
        } else {
          flushList();
          code = [];
        }
        continue;
      }
      if (code) { code.push(rawLine); continue; }

      if (!line.trim()) { flushList(); continue; }

      let m;
      if ((m = line.match(/^\s*[-*•]\s+(.+)$/))) {
        if (!list || list.type !== 'ul') { flushList(); list = { type: 'ul', items: [] }; }
        list.items.push(lineHtml(m[1]));
        continue;
      }
      if ((m = line.match(/^\s*(\d+)[.)\u06F0-\u06F9\u0660-\u0669]*[.)]\s+(.+)$/)) || (m = line.match(/^\s*(\d+)[.)]\s+(.+)$/))) {
        if (!list || list.type !== 'ol') { flushList(); list = { type: 'ol', items: [] }; }
        list.items.push(lineHtml(m[2]));
        continue;
      }

      flushList();
      out.push('<p class="pdf-para">' + lineHtml(line) + '</p>');
    }
    if (code) out.push('<pre class="pdf-code" dir="ltr">' + esc(code.join('\n')) + '</pre>');
    flushList();
    return out.join('');
  }

  /** Percentage helper that never yields NaN. */
  function pct(part, total) {
    const p = Number(part) || 0;
    const t = Number(total) || 0;
    if (t <= 0) return 0;
    return Math.min(100, Math.round((p / t) * 100));
  }

  global.PDFUtils = { safeText, esc, westernDigits, formatDuration, shortDuration, formatDateAr, isMostlyLtr, richText, pct };
})(window);
