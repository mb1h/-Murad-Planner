/* ============================================================
   PDF ENGINE — Renderers Module
   Pure functions: report model → HTML strings.
   Each renderer has a single responsibility and never reads
   application state directly.
   ============================================================ */
(function (global) {
  'use strict';

  const U = global.PDFUtils;
  const C = () => global.PDFTheme.COLORS;

  const DASH = '<span class="empty-dash">—</span>';

  function val(text, rich) {
    const s = U.safeText(text);
    if (!s) return DASH;
    return rich ? U.richText(s) : U.esc(s);
  }

  /* ── Cover page ─────────────────────────────────────────── */
  function renderCover(model) {
    const m = model.meta;
    const s = model.stats;
    return `
<div class="cover">
  <div class="cover-band"></div>
  <div class="cover-inner">
    <div class="cover-brand-row">
      <div class="cover-logo">م</div>
      <div>
        <div class="cover-brand-name">مخطط مراد</div>
        <div class="cover-brand-sub" dir="ltr">Murad Planner</div>
      </div>
    </div>
    <div class="cover-title-wrap">
      <span class="cover-kicker">تقرير التعلم اليومي</span>
      <div class="cover-title">يوم ${U.esc(m.dayName)}</div>
      <div class="cover-subtitle">الأسبوع ${m.weekNum} · ${U.esc(m.date)}</div>
    </div>
    <div class="cover-meta-grid">
      <div class="cover-meta-cell"><div class="k">إجمالي وقت الدراسة</div><div class="v">${U.esc(U.formatDuration(s.totalStudyMin))}</div></div>
      <div class="cover-meta-cell"><div class="k">عدد البلوكات الدراسية</div><div class="v">${s.blockCount}</div></div>
      <div class="cover-meta-cell"><div class="k">المواد الدراسية</div><div class="v">${s.subjectCount}</div></div>
      <div class="cover-meta-cell"><div class="k">نسبة الإنجاز</div><div class="v">${s.completionPct}%</div></div>
    </div>
    <div class="cover-pattern">
      <div class="p-name">${U.esc(m.patternMeta.name)}</div>
      <div class="p-title">${U.esc(m.patternMeta.title)}</div>
      <div class="p-desc">${U.esc(m.patternMeta.desc)}</div>
    </div>
  </div>
  <div class="cover-footer">
    <span class="cf-r">نظام دراسة ${U.esc(m.userName)}</span>
    <span class="cf-l">Murad Planner · Daily Learning Report</span>
  </div>
</div>`;
  }

  /* ── Section head helper ────────────────────────────────── */
  function sectionHead(title, color, count) {
    const countHtml = (count !== undefined && count !== null)
      ? `<span class="count">${U.esc(String(count))}</span>` : '';
    return `<div class="section-head" style="--sc:${color}">
      <span class="bar"></span><span class="title">${U.esc(title)}</span>${countHtml}
    </div>`;
  }

  /* ── Daily dashboard ────────────────────────────────────── */
  function renderDashboard(model) {
    const s = model.stats;
    const c = C();
    const card = (v, k, color, small) => `
      <div class="stat-card" style="--sc:${color}">
        <div class="v">${v}${small ? `<small> ${U.esc(small)}</small>` : ''}</div>
        <div class="k">${U.esc(k)}</div>
      </div>`;
    return `
<div class="section">
  ${sectionHead('لوحة اليوم', c.primary)}
  <div class="stat-grid">
    ${card(U.esc(U.shortDuration(s.totalStudyMin)), 'إجمالي وقت الدراسة', c.primary)}
    ${card(s.blockCount, 'بلوكات الدراسة', c.secondary)}
    ${card(s.subjectCount, 'المواد الدراسية', c.accent)}
    ${card(s.doneCount, 'بلوكات مكتملة', c.success)}
  </div>
  <div class="stat-grid">
    ${card(s.goalCount, 'أهداف مسجلة', c.primary)}
    ${card(s.noteCount, 'ملاحظات', c.secondary)}
    ${card(s.outputCount, 'مخرجات', c.success)}
    ${card(U.esc(U.shortDuration(s.avgSessionMin)), 'متوسط الجلسة', c.warning)}
  </div>
  <div class="progress-row">
    <span class="lbl">نسبة إنجاز اليوم</span>
    <div class="progress-track"><div class="progress-fill" style="width:${s.completionPct}%"></div></div>
    <span class="val">${s.completionPct}%</span>
  </div>
</div>`;
  }

  /* ── Main learning table (one row per block — never duplicated) ── */
  function renderScheduleTable(model) {
    const c = C();
    const blocks = model.blocks; // full ordered timeline incl. breaks
    if (!blocks.length) {
      return `<div class="section">${sectionHead('الجدول الدراسي', c.primary, 0)}
        <div class="empty-note">لا توجد بلوكات مسجلة لهذا اليوم.</div></div>`;
    }
    const rows = blocks.map(b => {
      if (b.isBreak) {
        return `<tr class="row-break">
          <td class="cell-time">${U.esc(b.timeRange) || '—'}</td>
          <td colspan="5">استراحة — ${U.esc(b.name)}${b.activity ? ' · ' + U.esc(b.activity) : ''}</td>
          <td class="cell-dur">${U.esc(U.shortDuration(b.duration))}</td>
        </tr>`;
      }
      return `<tr>
        <td class="cell-time">${U.esc(b.timeRange) || '—'}</td>
        <td class="cell-subject">${U.esc(b.name)}${b.activity ? `<span class="act">${U.esc(b.activity)}</span>` : ''}</td>
        <td>${val(b.goal)}</td>
        <td>${val(b.learn)}</td>
        <td>${val(b.apply)}</td>
        <td class="cell-status">${b.done
          ? '<span class="badge badge-done">مكتمل ✓</span>'
          : '<span class="badge badge-pending">قيد التنفيذ</span>'}</td>
        <td class="cell-dur">${U.esc(U.shortDuration(b.duration))}</td>
      </tr>`;
    }).join('');
    return `
<div class="section">
  ${sectionHead('الجدول الدراسي', c.primary, blocks.length + ' بلوك')}
  <table class="pdf-table">
    <thead><tr>
      <th style="width:17mm">الوقت</th>
      <th style="width:26mm">المادة</th>
      <th>الهدف</th>
      <th>ماذا سأتعلم؟</th>
      <th>ماذا سأطبق؟</th>
      <th style="width:17mm">الحالة</th>
      <th style="width:12mm">المدة</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table>
</div>`;
  }

  /* ── Detailed block cards (notes are the heart of the report) ── */
  function renderBlockDetails(model) {
    const c = C();
    const detailed = model.studyBlocks.filter(b => b.goal || b.learn || b.apply || b.notes || b.outputs || b.aiSummary);
    if (!detailed.length) {
      return `<div class="section">${sectionHead('تفاصيل البلوكات والملاحظات', c.secondary, 0)}
        <div class="empty-note">لم تُسجَّل تفاصيل أو ملاحظات لبلوكات هذا اليوم بعد.</div></div>`;
    }
    const field = (label, content, color, rich) => {
      const s = U.safeText(content);
      if (!s) return '';
      return `<div class="field" style="--fc:${color}">
        <div class="field-label">${U.esc(label)}</div>
        <div class="field-content">${rich ? U.richText(s) : U.esc(s)}</div>
      </div>`;
    };
    const cards = detailed.map((b, i) => {
      const longNote = (b.notes || '').length > 600;
      return `
<div class="block-card${longNote ? ' allow-split' : ''}">
  <div class="block-card-head">
    <span class="num">${i + 1}</span>
    <span class="nm">${U.esc(b.name)}${b.activity ? ' · ' + U.esc(b.activity) : ''}</span>
    <span class="tm">${U.esc(b.timeRange)}</span>
  </div>
  <div class="block-card-body">
    ${field('الهدف', b.goal, c.primary)}
    ${field('ماذا سأتعلم؟', b.learn, c.secondary)}
    ${field('ماذا سأطبق؟', b.apply, c.accent)}
    ${field('الملاحظات', b.notes, c.warning, true)}
    ${field('المخرجات المتوقعة', b.outputs, c.success, true)}
    ${field('ملخص المساعد الذكي', b.aiSummary, c.muted)}
  </div>
</div>`;
    }).join('');
    return `<div class="section">
      ${sectionHead('تفاصيل البلوكات والملاحظات', c.secondary, detailed.length + ' بلوك')}
      ${cards}
    </div>`;
  }

  /* ── Integration section (Pattern C) ────────────────────── */
  function renderIntegration(model) {
    if (!model.integration.hasContent) return '';
    const c = C();
    const g = model.integration;
    const cell = (k, v, color) => `<div class="int-cell" style="--sc:${color}">
      <div class="k">${U.esc(k)}</div><div class="v">${val(v)}</div></div>`;
    return `
<div class="section">
  ${sectionHead('خريطة الدمج والتكامل', c.accent)}
  <div class="integration-grid">
    ${cell('الرياضيات', g.math, c.primary)}
    ${cell('البرمجة', g.prog, c.secondary)}
    ${cell('علوم الحاسوب', g.cs, c.accent)}
  </div>
  ${U.safeText(g.result) ? `<div class="block-card"><div class="block-card-body">
    <div class="field" style="--fc:${c.success}"><div class="field-label">نتيجة الدمج</div>
    <div class="field-content">${U.richText(g.result)}</div></div></div></div>` : ''}
  ${U.safeText(g.relation) ? `<div class="block-card"><div class="block-card-body">
    <div class="field" style="--fc:${c.accent}"><div class="field-label">العلاقات بين المفاهيم</div>
    <div class="field-content">${U.richText(g.relation)}</div></div></div></div>` : ''}
</div>`;
  }

  /* ── Analytics: time distribution + session stats ───────── */
  function renderAnalytics(model) {
    const c = C();
    const s = model.stats;
    const palette = [c.primary, c.secondary, c.accent, c.success, c.warning, c.muted];
    const dist = model.distribution;
    const distHtml = dist.length ? dist.map((d, i) => `
      <div class="dist-row" style="--dc:${palette[i % palette.length]}">
        <span class="subj">${U.esc(d.subject)}</span>
        <div class="track"><div class="fill" style="width:${Math.max(2, d.pct)}%"></div></div>
        <span class="time">${U.esc(U.shortDuration(d.minutes))} · ${d.pct}%</span>
      </div>`).join('')
      : '<div class="empty-note">لا تتوفر بيانات لتوزيع الوقت.</div>';

    const card = (v, k, color) => `<div class="stat-card" style="--sc:${color}">
      <div class="v">${v}</div><div class="k">${U.esc(k)}</div></div>`;

    return `
<div class="section">
  ${sectionHead('تحليلات اليوم', c.accent)}
  <div class="stat-grid">
    ${card(U.esc(U.shortDuration(s.deepWorkMin)), 'العمل العميق (جلسات ≥ 90 دقيقة)', c.primary)}
    ${card(U.esc(U.shortDuration(s.longestSessionMin)), 'أطول جلسة', c.secondary)}
    ${card(U.esc(U.shortDuration(s.shortestSessionMin)), 'أقصر جلسة', c.warning)}
    ${card(U.esc(U.shortDuration(s.totalBreakMin)), 'إجمالي الاستراحات', c.muted)}
  </div>
  <div style="margin-top:5mm">
    <div class="t-h3" style="margin-bottom:3mm">توزيع وقت التعلم حسب المادة</div>
    ${distHtml}
  </div>
</div>`;
  }

  /* ── Reflection page ────────────────────────────────────── */
  function renderReflection(model) {
    const c = C();
    const items = [
      { q: 'ما أهم ما تعلمته اليوم؟', hint: 'دوّن أبرز المفاهيم والدروس المكتسبة.', color: c.primary },
      { q: 'ما أصعب مفهوم واجهته؟', hint: 'حدد النقاط التي احتاجت جهداً أكبر للفهم.', color: c.accent },
      { q: 'ما الذي يحتاج إلى مراجعة؟', hint: 'سجل المواضيع التي ستعود إليها لاحقاً.', color: c.warning },
      { q: 'ما خطة الغد؟', hint: 'حدد الخطوات والأهداف لليوم القادم.', color: c.success },
    ];
    const lines = '<div class="ref-lines">' + '<div class="ln"></div>'.repeat(3) + '</div>';
    return `
<div class="section">
  ${sectionHead('مراجعة اليوم والخلاصة', c.success)}
  ${items.map(it => `
  <div class="ref-card" style="--rc:${it.color}">
    <div class="q">${U.esc(it.q)}</div>
    <div class="hint">${U.esc(it.hint)}</div>
    ${lines}
  </div>`).join('')}
</div>`;
  }

  /* ── Report footer ──────────────────────────────────────── */
  function renderFooter(model) {
    const m = model.meta;
    return `<div class="report-footer">
      <span>تقرير التعلم اليومي · ${U.esc(m.dayName)} · الأسبوع ${m.weekNum}</span>
      <span dir="ltr">Murad Planner</span>
    </div>`;
  }

  global.PDFRenderers = {
    renderCover,
    renderDashboard,
    renderScheduleTable,
    renderBlockDetails,
    renderIntegration,
    renderAnalytics,
    renderReflection,
    renderFooter,
  };
})(window);
