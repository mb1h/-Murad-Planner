/* ============================================================
   PDF ENGINE — Orchestrator
   Composes the final document from the data model + renderers
   + theme, then hands it to the browser print engine (the only
   fully reliable path for premium Arabic/RTL typography).

   Pipeline:
     PDFData.buildDailyModel()      → normalized model (1 read, deduped)
     PDFRenderers.*                 → pure HTML fragments
     PDFTheme.buildStylesheet()     → semantic print CSS
     PDFEngine.exportDaily()        → print window / Save as PDF
   ============================================================ */
(function (global) {
  'use strict';

  const FONT_LINK =
    '<link rel="preconnect" href="https://fonts.googleapis.com">' +
    '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>' +
    '<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;500;700&family=Tajawal:wght@400;500;700&display=swap" rel="stylesheet">';

  function toast(msg, type) {
    if (typeof global.showToast === 'function') global.showToast(msg, type || 'info');
  }

  function setLoading(visible, msg) {
    const ls = document.getElementById('loading-screen');
    const lm = document.getElementById('loading-msg');
    if (!ls) return;
    if (visible) {
      ls.style.display = 'flex';
      ls.style.zIndex = '9999';
      if (lm && msg) lm.textContent = msg;
    } else {
      ls.style.display = 'none';
      ls.style.zIndex = '';
    }
  }

  /** Compose the complete standalone HTML document. */
  function composeDocument(model) {
    const R = global.PDFRenderers;
    const title = 'تقرير التعلم اليومي — ' + model.meta.dayName + ' — الأسبوع ' + model.meta.weekNum;

    return '<!DOCTYPE html>' +
      '<html lang="ar" dir="rtl"><head><meta charset="UTF-8">' +
      '<title>' + global.PDFUtils.esc(title) + '</title>' +
      FONT_LINK +
      '<style>' + global.PDFTheme.buildStylesheet() + '</style>' +
      '</head><body>' +
      '<div class="print-hint">اضغط Ctrl+P ثم اختر «حفظ كـ PDF» — يختفي هذا التنبيه تلقائياً عند الطباعة</div>' +
      R.renderCover(model) +
      '<div class="report-body">' +
        R.renderDashboard(model) +
        R.renderScheduleTable(model) +
        R.renderBlockDetails(model) +
        R.renderIntegration(model) +
        R.renderAnalytics(model) +
        R.renderReflection(model) +
        R.renderFooter(model) +
      '</div>' +
      '</body></html>';
  }

  /**
   * Export the daily report.
   * Opens a dedicated print window; fonts are awaited before print
   * so Arabic glyphs are never rendered with a fallback font.
   */
  async function exportDaily() {
    toast('جاري بناء التقرير...', 'info');
    setLoading(true, 'بناء تقرير التعلم اليومي...');

    try {
      const model = global.PDFData.buildDailyModel();
      const html = composeDocument(model);

      const win = window.open('', '_blank', 'width=1024,height=768');
      if (!win) throw new Error('يجب السماح بالنوافذ المنبثقة (pop-ups) لتصدير التقرير');

      win.document.open();
      win.document.write(html);
      win.document.close();

      // Wait for webfonts to be ready (with a hard timeout fallback)
      const whenReady = new Promise((resolve) => {
        let settled = false;
        const done = () => { if (!settled) { settled = true; resolve(); } };
        try {
          if (win.document.fonts && win.document.fonts.ready) {
            win.document.fonts.ready.then(done).catch(done);
          }
        } catch (e) { /* ignore */ }
        setTimeout(done, 2500);
      });

      await whenReady;

      setLoading(false);
      win.focus();
      win.print();
      toast('اختر «حفظ كـ PDF» من نافذة الطباعة', 'success');
    } catch (err) {
      console.error('[PDFEngine] Export failed:', err);
      setLoading(false);
      toast('تعذر تصدير التقرير: ' + (err && err.message ? err.message : err), 'error');
    }
  }

  async function exportWeekly() {
    toast('تقرير الأسبوع قيد التطوير — قريباً!', 'info');
  }

  global.PDFEngine = { exportDaily, exportWeekly, composeDocument };

  // Public API kept identical to the legacy implementation so
  // existing buttons / guards keep working without any change.
  global.exportDailyPDF = exportDaily;
  global.exportWeeklyPDF = exportWeekly;
})(window);
