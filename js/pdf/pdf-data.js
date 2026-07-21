/* ============================================================
   PDF ENGINE — Data Collector Module
   Reads application state (localStorage via data.js helpers +
   window globals) and produces ONE normalized, deduplicated
   report model. The renderers never touch raw app state.
   ============================================================ */
(function (global) {
  'use strict';

  const U = global.PDFUtils;

  const PATTERN_META = {
    A: { name: 'النمط A', title: 'تعلم مفاهيم جديدة', desc: 'اكتشاف مفاهيم ومهارات جديدة لأول مرة، مع التركيز على الفهم الأولي وبناء التصور الذهني.' },
    B: { name: 'النمط B', title: 'يوم الترسيخ', desc: 'تعميق الفهم وتثبيت المعرفة عبر حل المسائل والتكرار المتعمد وتحسين ما تم تعلمه سابقاً.' },
    C: { name: 'النمط C', title: 'يوم الدمج والتكامل', desc: 'ربط المفاهيم ببعضها وبناء فهم متكامل عبر مشاريع تجمع الرياضيات والبرمجة وعلوم الحاسوب.' },
    D: { name: 'النمط D', title: 'إغلاق الأسبوع', desc: 'اختبار وتقييم مستوى الفهم الحقيقي دون مراجع، وتحديد الفجوات والخطة القادمة.' },
  };

  /** Normalize one raw block into a flat, print-safe record. */
  function normalizeBlock(raw, index) {
    const timerState = raw && raw.__timer ? raw.__timer : null;
    const b = {
      id: U.safeText(raw.id) || ('blk-' + index),
      order: index,
      name: U.safeText(raw.name) || 'بلوك ' + (index + 1),
      activity: U.safeText(raw.activity),
      timeStart: U.westernDigits(U.safeText(raw.timeStart)),
      timeEnd: U.westernDigits(U.safeText(raw.timeEnd)),
      duration: Math.max(0, Number(raw.duration) || 0),
      goal: U.safeText(raw.goal),
      learn: U.safeText(raw.learn),
      apply: U.safeText(raw.apply),
      notes: U.safeText(raw.notes),
      outputs: U.safeText(raw.outputs),
      aiSummary: U.safeText(raw.aiSummary),
      isBreak: !!raw.isBreak,
      done: !!(timerState && timerState.status === 'done'),
    };
    b.timeRange = b.timeStart && b.timeEnd ? (b.timeStart + ' – ' + b.timeEnd) : (b.timeStart || b.timeEnd || '');
    return b;
  }

  /**
   * Deduplicate blocks by id (first occurrence wins).
   * Root cause of the historical "same block printed multiple
   * times" bug: the old pipeline re-read DOM + storage + globals
   * without reconciling them. Here we read storage exactly once.
   */
  function dedupeById(blocks) {
    const seen = new Set();
    const out = [];
    for (const b of blocks) {
      if (seen.has(b.id)) continue;
      seen.add(b.id);
      out.push(b);
    }
    return out;
  }

  function computeStats(studyBlocks, breakBlocks) {
    const durations = studyBlocks.map(b => b.duration).filter(d => d > 0);
    const totalStudyMin = durations.reduce((a, d) => a + d, 0);
    const totalBreakMin = breakBlocks.reduce((a, b) => a + (b.duration || 0), 0);
    const doneCount = studyBlocks.filter(b => b.done).length;
    const subjects = [...new Set(studyBlocks.map(b => b.name).filter(Boolean))];

    return {
      totalStudyMin,
      totalBreakMin,
      blockCount: studyBlocks.length,
      subjectCount: subjects.length,
      subjects,
      goalCount: studyBlocks.filter(b => b.goal).length,
      noteCount: studyBlocks.filter(b => b.notes).length,
      outputCount: studyBlocks.filter(b => b.outputs).length,
      doneCount,
      completionPct: U.pct(doneCount, studyBlocks.length),
      avgSessionMin: durations.length ? Math.round(totalStudyMin / durations.length) : 0,
      longestSessionMin: durations.length ? Math.max(...durations) : 0,
      shortestSessionMin: durations.length ? Math.min(...durations) : 0,
      deepWorkMin: studyBlocks.filter(b => b.duration >= 90).reduce((a, b) => a + b.duration, 0),
    };
  }

  /** Per-subject time distribution for the analytics page. */
  function computeDistribution(studyBlocks, totalStudyMin) {
    const map = new Map();
    for (const b of studyBlocks) {
      const key = b.name || 'أخرى';
      map.set(key, (map.get(key) || 0) + (b.duration || 0));
    }
    return [...map.entries()]
      .map(([subject, minutes]) => ({ subject, minutes, pct: U.pct(minutes, totalStudyMin) }))
      .sort((a, b) => b.minutes - a.minutes);
  }

  /**
   * Build the complete daily report model.
   * Reads persisted daily data ONCE (single query — no duplicated reads).
   */
  function buildDailyModel() {
    // Persist any in-progress edits first, so the report reflects reality.
    try {
      if (global.currentDayKey && global.currentWeekNum && typeof global.saveDailyData === 'function') {
        global.saveDailyData(true);
      }
    } catch (e) { /* non-fatal — proceed with stored data */ }

    const weekNum = Number(global.currentWeekNum) || 1;

    // Resolve active day: prefer app state, otherwise today's schedule slot.
    let dayKey = global.currentDayKey;
    let pattern = global.currentDayPattern;
    const schedule = global.WEEK_SCHEDULE || [];
    if (!dayKey) {
      const dayMap = { 6: 'sat', 0: 'sun', 1: 'mon', 2: 'tue', 3: 'wed', 4: 'thu', 5: 'fri' };
      dayKey = dayMap[new Date().getDay()] || 'sat';
    }
    const dayInfo = schedule.find(d => d.key === dayKey) || { dayAr: 'السبت', pattern: 'A' };
    if (!pattern) pattern = dayInfo.pattern || 'A';

    // Single storage read.
    let dayData = { blocks: [], integration: {}, timerState: {} };
    try {
      if (typeof global.getDailyData === 'function') {
        dayData = global.getDailyData(weekNum, dayKey, pattern) || dayData;
      }
    } catch (e) { /* keep empty model */ }

    const rawBlocks = Array.isArray(dayData.blocks) ? dayData.blocks : [];
    const timerState = dayData.timerState || {};

    // Attach timer completion info before normalization.
    const normalized = dedupeById(
      rawBlocks.map((raw, i) => normalizeBlock(Object.assign({}, raw, { __timer: timerState[raw && raw.id] }), i))
    );

    const studyBlocks = normalized.filter(b => !b.isBreak);
    const breakBlocks = normalized.filter(b => b.isBreak);
    const stats = computeStats(studyBlocks, breakBlocks);

    const integrationRaw = dayData.integration || {};
    const integration = {
      math: U.safeText(integrationRaw.math),
      prog: U.safeText(integrationRaw.prog),
      cs: U.safeText(integrationRaw.cs),
      result: U.safeText(integrationRaw.result),
      relation: U.safeText(integrationRaw.relation),
    };
    integration.hasContent = !!(integration.math || integration.prog || integration.cs || integration.result || integration.relation);

    const userNameRaw = (global.settings && global.settings.userName) || 'مراد';

    return {
      meta: {
        userName: U.safeText(userNameRaw) || 'مراد',
        weekNum,
        dayKey,
        dayName: U.safeText(dayInfo.dayAr) || U.safeText(dayInfo.dayEn),
        date: U.formatDateAr(new Date()),
        pattern,
        patternMeta: PATTERN_META[pattern] || PATTERN_META.A,
      },
      blocks: normalized,          // ordered, deduplicated (breaks included for the timeline)
      studyBlocks,                 // study only — used by table/cards
      stats,
      distribution: computeDistribution(studyBlocks, stats.totalStudyMin),
      integration,
    };
  }

  global.PDFData = { buildDailyModel, PATTERN_META };
})(window);
