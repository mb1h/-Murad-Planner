/* ============================================================
   PDF ENGINE — Theme & Typography Module
   Semantic design tokens + the complete print stylesheet.
   One source of truth for colors, spacing and type scale.
   ============================================================ */
(function (global) {
  'use strict';

  // ── Semantic color tokens (print-optimized, high contrast) ──
  const COLORS = {
    primary: '#1d4ed8',
    primarySoft: '#eff6ff',
    secondary: '#0e7490',
    accent: '#7c3aed',
    success: '#15803d',
    successSoft: '#f0fdf4',
    warning: '#b45309',
    warningSoft: '#fffbeb',
    ink: '#0f172a',
    inkSoft: '#334155',
    muted: '#64748b',
    faint: '#94a3b8',
    border: '#e2e8f0',
    borderSoft: '#f1f5f9',
    bg: '#ffffff',
    bgSoft: '#f8fafc',
  };

  function buildStylesheet() {
    const c = COLORS;
    return `
/* ═══ Reset & page setup ═══ */
* { margin: 0; padding: 0; box-sizing: border-box; }
@page { size: A4; margin: 14mm 12mm 16mm 12mm; }
@page :first { margin: 0; }
html, body { direction: rtl; }
body {
  font-family: 'IBM Plex Sans Arabic', 'Tajawal', 'Segoe UI', sans-serif;
  font-size: 10pt; line-height: 1.8; color: ${c.ink}; background: ${c.bg};
  text-align: right;
  -webkit-print-color-adjust: exact; print-color-adjust: exact;
  font-variant-numeric: tabular-nums;
}

/* ═══ Typography scale ═══ */
.t-display { font-size: 30pt; font-weight: 700; letter-spacing: -0.5px; line-height: 1.3; }
.t-h1 { font-size: 17pt; font-weight: 700; color: ${c.ink}; }
.t-h2 { font-size: 13pt; font-weight: 700; color: ${c.ink}; }
.t-h3 { font-size: 11pt; font-weight: 700; color: ${c.inkSoft}; }
.t-body { font-size: 10pt; color: ${c.inkSoft}; }
.t-label { font-size: 8.5pt; font-weight: 500; color: ${c.muted}; letter-spacing: 0.2px; }
.t-meta { font-size: 8pt; color: ${c.faint}; }

/* ═══ Cover page ═══ */
.cover {
  width: 210mm; height: 296mm; position: relative; overflow: hidden;
  background: ${c.bg}; page-break-after: always;
  display: flex; flex-direction: column;
}
.cover-band { height: 6mm; background: linear-gradient(270deg, ${c.primary}, ${c.accent}); }
.cover-inner { flex: 1; padding: 22mm 20mm 0; display: flex; flex-direction: column; }
.cover-brand-row { display: flex; align-items: center; gap: 4mm; }
.cover-logo {
  width: 12mm; height: 12mm; border-radius: 3mm;
  background: ${c.primary}; color: #fff;
  display: flex; align-items: center; justify-content: center;
  font-size: 15pt; font-weight: 700;
}
.cover-brand-name { font-size: 12pt; font-weight: 700; color: ${c.ink}; }
.cover-brand-sub { font-size: 8pt; color: ${c.muted}; }
.cover-title-wrap { margin-top: 26mm; }
.cover-kicker {
  display: inline-block; font-size: 9pt; font-weight: 700; color: ${c.primary};
  background: ${c.primarySoft}; border: 1px solid ${c.primary}22;
  padding: 1.5mm 5mm; border-radius: 10mm; margin-bottom: 6mm;
}
.cover-title { font-size: 32pt; font-weight: 700; color: ${c.ink}; line-height: 1.35; }
.cover-subtitle { font-size: 12pt; color: ${c.muted}; margin-top: 3mm; }
.cover-meta-grid {
  margin-top: 16mm; display: grid; grid-template-columns: 1fr 1fr; gap: 4mm;
}
.cover-meta-cell {
  background: ${c.bgSoft}; border: 1px solid ${c.border}; border-radius: 3mm;
  padding: 5mm 6mm;
}
.cover-meta-cell .k { font-size: 8.5pt; color: ${c.muted}; margin-bottom: 1mm; }
.cover-meta-cell .v { font-size: 13pt; font-weight: 700; color: ${c.ink}; }
.cover-pattern {
  margin-top: 6mm; border: 1px solid ${c.border}; border-right: 1.2mm solid ${c.primary};
  border-radius: 3mm; padding: 6mm 7mm; background: ${c.bg};
}
.cover-pattern .p-name { font-size: 11pt; font-weight: 700; color: ${c.primary}; }
.cover-pattern .p-title { font-size: 13pt; font-weight: 700; color: ${c.ink}; margin-top: 1mm; }
.cover-pattern .p-desc { font-size: 9.5pt; color: ${c.muted}; margin-top: 2mm; line-height: 1.9; }
.cover-footer {
  margin-top: auto; height: 18mm; background: ${c.ink};
  display: flex; align-items: center; justify-content: space-between; padding: 0 20mm;
}
.cover-footer .cf-r { color: #fff; font-size: 9.5pt; font-weight: 500; }
.cover-footer .cf-l { color: ${c.faint}; font-size: 8pt; direction: ltr; }

/* ═══ Content sections ═══ */
.report-body { padding: 0; }
.section { margin-bottom: 9mm; }
.section-head {
  display: flex; align-items: center; gap: 3mm;
  margin-bottom: 4mm; padding-bottom: 2mm;
  border-bottom: 1.5px solid ${c.border};
  break-after: avoid; page-break-after: avoid;
}
.section-head .bar { width: 1.4mm; height: 5.5mm; border-radius: 1mm; background: var(--sc, ${c.primary}); }
.section-head .title { font-size: 13.5pt; font-weight: 700; color: ${c.ink}; }
.section-head .count {
  margin-inline-start: auto; font-size: 8.5pt; color: ${c.muted};
  background: ${c.bgSoft}; border: 1px solid ${c.border};
  padding: 0.8mm 3.5mm; border-radius: 8mm;
}

/* ═══ Stats dashboard ═══ */
.stat-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 3.5mm; }
.stat-grid + .stat-grid { margin-top: 3.5mm; }
.stat-card {
  background: ${c.bg}; border: 1px solid ${c.border}; border-radius: 3mm;
  padding: 4mm 4.5mm; break-inside: avoid; page-break-inside: avoid;
  border-top: 1mm solid var(--sc, ${c.primary});
}
.stat-card .v { font-size: 15pt; font-weight: 700; color: ${c.ink}; line-height: 1.3; }
.stat-card .v small { font-size: 9pt; font-weight: 500; color: ${c.muted}; }
.stat-card .k { font-size: 8pt; color: ${c.muted}; margin-top: 0.5mm; }

/* Completion bar */
.progress-row { display: flex; align-items: center; gap: 4mm; margin-top: 4.5mm;
  background: ${c.bgSoft}; border: 1px solid ${c.border}; border-radius: 3mm; padding: 4mm 5mm;
  break-inside: avoid; page-break-inside: avoid; }
.progress-row .lbl { font-size: 9pt; font-weight: 700; color: ${c.inkSoft}; white-space: nowrap; }
.progress-track { flex: 1; height: 3mm; background: ${c.border}; border-radius: 3mm; overflow: hidden; }
.progress-fill { height: 100%; border-radius: 3mm; background: linear-gradient(270deg, ${c.primary}, ${c.accent}); }
.progress-row .val { font-size: 10pt; font-weight: 700; color: ${c.primary}; white-space: nowrap; }

/* ═══ Main learning table ═══ */
.pdf-table { width: 100%; border-collapse: collapse; font-size: 8.6pt; }
.pdf-table thead { display: table-header-group; }  /* repeat header on every page */
.pdf-table th {
  background: ${c.ink}; color: #fff; font-weight: 700; font-size: 8.6pt;
  padding: 2.8mm 3mm; text-align: right; border: none;
}
.pdf-table th:first-child { border-radius: 0 2mm 0 0; }
.pdf-table th:last-child { border-radius: 2mm 0 0 0; }
.pdf-table td {
  padding: 2.8mm 3mm; border-bottom: 1px solid ${c.borderSoft};
  text-align: right; vertical-align: top; color: ${c.inkSoft}; line-height: 1.7;
}
.pdf-table tbody tr { break-inside: avoid; page-break-inside: avoid; }
.pdf-table tbody tr:nth-child(even) td { background: ${c.bgSoft}; }
.pdf-table .cell-time { white-space: nowrap; font-weight: 700; color: ${c.primary}; direction: ltr; text-align: center; }
.pdf-table .cell-subject { font-weight: 700; color: ${c.ink}; }
.pdf-table .cell-subject .act { display: block; font-weight: 400; font-size: 7.8pt; color: ${c.muted}; margin-top: 0.5mm; }
.pdf-table .cell-dur { white-space: nowrap; color: ${c.muted}; text-align: center; }
.pdf-table .cell-status { text-align: center; white-space: nowrap; }
.pdf-table .empty-dash { color: ${c.faint}; }
.row-break td { background: ${c.warningSoft} !important; color: ${c.warning}; font-size: 8pt; }

.badge {
  display: inline-block; font-size: 7.6pt; font-weight: 700;
  padding: 0.6mm 2.8mm; border-radius: 6mm; border: 1px solid transparent;
}
.badge-done { color: ${c.success}; background: ${c.successSoft}; border-color: ${c.success}33; }
.badge-pending { color: ${c.muted}; background: ${c.bgSoft}; border-color: ${c.border}; }

/* ═══ Detail cards (goals / learn / apply / notes / outputs) ═══ */
.block-card {
  border: 1px solid ${c.border}; border-radius: 3mm; background: ${c.bg};
  margin-bottom: 4.5mm; break-inside: avoid; page-break-inside: avoid; overflow: hidden;
}
.block-card.allow-split { break-inside: auto; page-break-inside: auto; }
.block-card-head {
  display: flex; align-items: baseline; gap: 3mm; padding: 3.2mm 5mm;
  background: ${c.bgSoft}; border-bottom: 1px solid ${c.border};
  break-after: avoid; page-break-after: avoid;
}
.block-card-head .num {
  font-size: 8pt; font-weight: 700; color: ${c.primary};
  background: ${c.primarySoft}; border-radius: 6mm; padding: 0.4mm 2.6mm;
}
.block-card-head .nm { font-size: 10.5pt; font-weight: 700; color: ${c.ink}; }
.block-card-head .tm { margin-inline-start: auto; font-size: 8pt; color: ${c.muted}; direction: ltr; }
.block-card-body { padding: 3.5mm 5mm 4mm; }
.field { margin-bottom: 3mm; }
.field:last-child { margin-bottom: 0; }
.field-label {
  display: flex; align-items: center; gap: 2mm;
  font-size: 8pt; font-weight: 700; color: var(--fc, ${c.muted});
  margin-bottom: 1mm; break-after: avoid; page-break-after: avoid;
}
.field-label::before { content: ''; width: 1.6mm; height: 1.6mm; border-radius: 50%; background: var(--fc, ${c.muted}); }
.field-content { font-size: 9.3pt; color: ${c.inkSoft}; line-height: 1.85; overflow-wrap: break-word; word-break: break-word; }

/* Rich text inside notes */
.pdf-para { margin-bottom: 1.6mm; }
.pdf-para:last-child { margin-bottom: 0; }
.pdf-list { margin: 1mm 5mm 2mm 0; padding-inline-start: 5mm; }
.pdf-list li { margin-bottom: 1mm; }
.pdf-code {
  font-family: 'Courier New', monospace; font-size: 8pt; line-height: 1.6;
  background: ${c.bgSoft}; border: 1px solid ${c.border}; border-radius: 2mm;
  padding: 3mm 4mm; margin: 2mm 0; text-align: left; direction: ltr;
  white-space: pre-wrap; overflow-wrap: break-word; color: ${c.ink};
}

/* ═══ Analytics ═══ */
.dist-row { display: flex; align-items: center; gap: 4mm; margin-bottom: 3mm; break-inside: avoid; page-break-inside: avoid; }
.dist-row .subj { width: 38mm; font-size: 9pt; font-weight: 700; color: ${c.inkSoft};
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.dist-row .track { flex: 1; height: 4.5mm; background: ${c.bgSoft}; border: 1px solid ${c.borderSoft}; border-radius: 2mm; overflow: hidden; }
.dist-row .fill { height: 100%; background: var(--dc, ${c.primary}); border-radius: 2mm; }
.dist-row .time { width: 22mm; font-size: 8.5pt; color: ${c.muted}; text-align: left; white-space: nowrap; }

/* ═══ Integration (Pattern C) ═══ */
.integration-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 3.5mm; margin-bottom: 4mm; }
.int-cell { border: 1px solid ${c.border}; border-radius: 3mm; padding: 4mm 4.5mm; background: ${c.bg};
  border-top: 1mm solid var(--sc, ${c.primary}); break-inside: avoid; page-break-inside: avoid; }
.int-cell .k { font-size: 8pt; font-weight: 700; color: ${c.muted}; margin-bottom: 1mm; }
.int-cell .v { font-size: 9.5pt; font-weight: 500; color: ${c.ink}; }

/* ═══ Reflection ═══ */
.ref-card {
  border: 1px solid ${c.border}; border-radius: 3mm; background: ${c.bg};
  padding: 4.5mm 5.5mm; margin-bottom: 4mm; break-inside: avoid; page-break-inside: avoid;
  border-right: 1.2mm solid var(--rc, ${c.primary});
}
.ref-card .q { font-size: 10.5pt; font-weight: 700; color: ${c.ink}; }
.ref-card .hint { font-size: 8.5pt; color: ${c.faint}; margin-top: 1mm; }
.ref-lines { margin-top: 3.5mm; }
.ref-lines .ln { height: 7mm; border-bottom: 1px dashed ${c.border}; }

/* ═══ Empty state ═══ */
.empty-note {
  text-align: center; color: ${c.faint}; font-size: 9pt;
  background: ${c.bgSoft}; border: 1px dashed ${c.border}; border-radius: 3mm; padding: 6mm;
}

/* ═══ Running header/footer on content pages ═══ */
.page-chrome { position: fixed; left: 0; right: 0; z-index: 10; }
.report-footer {
  margin-top: 10mm; padding-top: 3mm; border-top: 1px solid ${c.border};
  display: flex; justify-content: space-between; font-size: 8pt; color: ${c.faint};
}

/* Keep section heads glued to first content element */
.section-head + * { break-before: avoid; page-break-before: avoid; }

/* Screen preview niceties (before printing) */
@media screen {
  body { background: #e2e8f0; }
  .cover, .report-body { background: #fff; margin: 8mm auto; box-shadow: 0 4px 24px rgba(0,0,0,.12); }
  .report-body { width: 210mm; padding: 14mm 12mm; }
  .print-hint {
    position: fixed; top: 10px; left: 10px; z-index: 99;
    background: ${c.ink}; color: #fff; font-size: 12px; font-family: inherit;
    padding: 8px 14px; border-radius: 8px; opacity: .92;
  }
}
@media print {
  .print-hint { display: none !important; }
  .report-body { width: auto; padding: 0; }
}
`;
  }

  global.PDFTheme = { COLORS, buildStylesheet };
})(window);
