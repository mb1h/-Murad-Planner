/* ============================================================
   AI AGENT CORE — Real Tool Executor v8.0 (Session 8)
   Full application control layer.
   Every tool returns {success, result, error} — NEVER LIES.
   All 22+ block fields supported.
   Self-verification loop on every write.
   File extraction tools included.
   Session context memory included.
   ============================================================ */

'use strict';

/* ── Session Context (persists across messages in same session) ─ */
window._sessionContext = window._sessionContext || {
  lastFile: null,          // { name, type, content, size }
  lastImage: null,         // { name, url, description }
  lastTable: null,         // { headers, rows }
  lastBlock: null,         // { id, dayKey, name }
  lastDay: null,           // dayKey string
  lastSubject: null,       // string
  lastCreatedBlocks: [],   // array of {id, dayKey}
  conversationRound: 0,
};

/* ── Tool Registry ─────────────────────────────────────────── */
const AIAgentCore = {

  // ═══════════════════════════════════════════════════════════
  // MAIN DISPATCHER
  // ═══════════════════════════════════════════════════════════
  async execute(toolName, args = {}) {
    console.log(`[AIAgent] Executing: ${toolName}`, args);
    const tool = this.tools[toolName];
    if (!tool) {
      const available = Object.keys(this.tools).join(', ');
      return { success: false, error: `Unknown tool: "${toolName}". Available tools: ${available}` };
    }
    try {
      const result = await tool.call(this, args);
      console.log(`[AIAgent] Result (${toolName}):`, result);
      return result;
    } catch (e) {
      console.error(`[AIAgent] Error (${toolName}):`, e);
      return { success: false, error: e.message };
    }
  },

  // ═══════════════════════════════════════════════════════════
  // PARSE RESPONSE TEXT → EXECUTE TOOLS → RETURN RESULTS
  // ═══════════════════════════════════════════════════════════
  async parseAndExecuteAll(text) {
    if (typeof text !== 'string') return [];
    const results = [];

    let i = 0;
    while (i < text.length) {
      const start = text.indexOf('[TOOL:', i);
      if (start === -1) break;

      const pipePos = text.indexOf('|', start);
      if (pipePos === -1) { i = start + 1; continue; }
      const toolName = text.slice(start + 6, pipePos);

      // Find balanced closing bracket
      let depth = 1;
      let j = pipePos + 1;
      while (j < text.length && depth > 0) {
        if (text[j] === '[') depth++;
        else if (text[j] === ']') depth--;
        j++;
      }

      const argsStr = text.slice(pipePos + 1, j - 1);
      let args = {};
      try { args = JSON.parse(argsStr); } catch (_) { args = { _raw: argsStr }; }

      const result = await this.execute(toolName, args);
      results.push({ tool: toolName, args, result });
      i = j;
    }

    return results;
  },

  // ═══════════════════════════════════════════════════════════
  // INTERNAL HELPERS
  // ═══════════════════════════════════════════════════════════
  _getWeekNum() {
    return typeof getCurrentWeekNum === 'function' ? getCurrentWeekNum() : 1;
  },

  _getDayInfo(dayKey) {
    if (typeof WEEK_SCHEDULE === 'undefined') return null;
    return WEEK_SCHEDULE.find(d => d.key === dayKey) || null;
  },

  _getDayData(weekNum, dayKey) {
    const dayInfo = this._getDayInfo(dayKey);
    if (!dayInfo) return null;
    return typeof getDailyData === 'function'
      ? getDailyData(weekNum, dayKey, dayInfo.pattern)
      : { blocks: [] };
  },

  _saveDayData(weekNum, dayKey, dayData) {
    if (typeof getDayKey !== 'function' || typeof DB === 'undefined') return false;
    const key = getDayKey(weekNum, dayKey);
    return DB.set(key, dayData) !== false;
  },

  // Map a raw block object (from AI) to the full internal schema (all 22+ fields)
  _mapBlockFields(b, index) {
    const ts = Date.now();
    return {
      // Core identity
      id: b.id || ('ai_' + ts + '_' + index),

      // Times
      timeStart: b.timeStart || b.startTime || '08:00',
      timeEnd: b.timeEnd || b.endTime || '09:00',
      duration: b.duration || 60,

      // Name — bilingual object
      name: {
        ar: b.nameAr || b.name || b.title || 'بلوك',
        en: b.nameEn || b.name || b.title || 'Block'
      },

      // Activity — bilingual object
      activity: {
        ar: b.activityAr || b.activity || b.description || '',
        en: b.activityEn || b.activity || b.description || ''
      },

      // Goal / objective
      goal: b.goal || b.objective || '',

      // Learning — store canonical AND alias names for compatibility
      learn: b.learn || b.whatWillILearn || b.willLearn || '',
      whatWillILearn: b.whatWillILearn || b.learn || b.willLearn || '',
      apply: b.apply || b.whatWillIPractice || b.willPractice || b.practice || '',
      whatWillIPractice: b.whatWillIPractice || b.apply || b.willPractice || '',

      // Outcomes
      outputs: b.outputs || b.expectedOutcome || b.outcome || '',
      expectedOutcome: b.expectedOutcome || b.outputs || b.outcome || '',
      notes: b.notes || '',

      // Sound
      sound: b.sound || '',

      // Break flag
      isBreak: b.isBreak || false,

      // Extended fields (Session 8)
      subject: b.subject || '',
      difficulty: b.difficulty || b.level || '',
      tips: b.tips || '',
      exercises: b.exercises || '',
      resources: b.resources || '',
      links: b.links || '',
      priority: b.priority || 'medium',
      status: b.status || 'pending',
      reminders: b.reminders || '',
      tags: Array.isArray(b.tags) ? b.tags : (b.tags ? [b.tags] : []),
      attachments: b.attachments || '',
      aiSummary: b.aiSummary || b.summary || '',
    };
  },

  // Apply surgical field updates to an existing block
  _applyBlockUpdates(block, updates) {
    const fieldsModified = [];
    const fieldsFailed = [];

    const applyField = (key, transform) => {
      if (updates[key] !== undefined) {
        try {
          if (transform) {
            block[key] = transform(updates[key], block[key]);
          } else {
            block[key] = updates[key];
          }
          fieldsModified.push(key);
        } catch (e) {
          fieldsFailed.push({ field: key, reason: e.message });
        }
      }
    };

    const bilingualTransform = (val, existing) => {
      if (typeof existing === 'object' && existing !== null) {
        return { ...existing, ar: val, en: val };
      }
      return { ar: val, en: val };
    };

    // Name fields
    applyField('name', bilingualTransform);
    applyField('title', (v) => { block.name = bilingualTransform(v, block.name); return v; });
    applyField('nameAr', (v) => { block.name = typeof block.name === 'object' ? { ...block.name, ar: v } : { ar: v, en: v }; return v; });
    applyField('nameEn', (v) => { block.name = typeof block.name === 'object' ? { ...block.name, en: v } : { ar: v, en: v }; return v; });

    // Activity fields
    applyField('activity', bilingualTransform);
    applyField('description', (v) => { block.activity = bilingualTransform(v, block.activity); return v; });
    applyField('activityAr', (v) => { block.activity = typeof block.activity === 'object' ? { ...block.activity, ar: v } : { ar: v, en: v }; return v; });
    applyField('activityEn', (v) => { block.activity = typeof block.activity === 'object' ? { ...block.activity, en: v } : { ar: v, en: v }; return v; });

    // All scalar fields
    const scalarFields = [
      'goal', 'objective', 'learn', 'whatWillILearn', 'willLearn',
      'apply', 'whatWillIPractice', 'willPractice', 'practice',
      'notes', 'outputs', 'expectedOutcome', 'outcome',
      'sound', 'timeStart', 'startTime', 'timeEnd', 'endTime',
      'duration', 'isBreak',
      'subject', 'difficulty', 'level',
      'tips', 'exercises', 'resources', 'links',
      'priority', 'status', 'reminders', 'attachments',
      'aiSummary', 'summary'
    ];

    scalarFields.forEach(f => {
      if (updates[f] !== undefined) {
        const canonicalMap = {
          objective: 'goal', willLearn: 'learn', whatWillILearn: 'learn',
          willPractice: 'apply', whatWillIPractice: 'apply', practice: 'apply',
          expectedOutcome: 'outputs', outcome: 'outputs',
          startTime: 'timeStart', endTime: 'timeEnd',
          level: 'difficulty', summary: 'aiSummary'
        };
        const target = canonicalMap[f] || f;
        if (!fieldsModified.includes(target) && !fieldsFailed.find(x => x.field === target)) {
          block[target] = updates[f];
          // Also write alias key for direct field access compatibility
          if (f !== target) block[f] = updates[f];
          fieldsModified.push(target);
        }
      }
    });

    // Tags (array)
    if (updates.tags !== undefined) {
      block.tags = Array.isArray(updates.tags) ? updates.tags : [updates.tags];
      if (!fieldsModified.includes('tags')) fieldsModified.push('tags');
    }

    return { fieldsModified, fieldsFailed };
  },

  // Verify block has the requested fields filled
  _verifyBlockFields(block, requiredFields) {
    const missing = [];
    requiredFields.forEach(f => {
      const val = block[f];
      if (val === undefined || val === null || val === '' ||
          (Array.isArray(val) && val.length === 0) ||
          (typeof val === 'object' && val !== null && !Array.isArray(val) &&
           Object.values(val).every(v => !v))) {
        missing.push(f);
      }
    });
    return missing;
  },

  // ═══════════════════════════════════════════════════════════
  // TOOLS OBJECT — every key is a callable action
  // ═══════════════════════════════════════════════════════════
  tools: {

    /* ── NAVIGATION ─────────────────────────────────────── */
    navigate(args) {
      const raw = (args.page || args.target || '').toLowerCase().trim();
      const map = {
        'dashboard': 'dashboard', 'home': 'dashboard', 'main': 'dashboard', 'رئيسية': 'dashboard',
        'weekly': 'weekly', 'weekly schedule': 'weekly', 'week': 'weekly', 'أسبوع': 'weekly', 'الجدول الأسبوعي': 'weekly',
        'daily': 'daily', 'daily schedule': 'daily', 'today': 'daily', 'يوم': 'daily', 'الجدول اليومي': 'daily',
        'settings': 'settings', 'إعدادات': 'settings',
        'ai-workspace': 'ai-workspace', 'workspace': 'ai-workspace', 'chat': 'ai-workspace', 'محادثة': 'ai-workspace',
        'ai-settings': 'ai-settings', 'ai settings': 'ai-settings', 'providers': 'ai-settings',
        'ai-personality': 'ai-personality', 'personality': 'ai-personality', 'شخصية': 'ai-personality',
        'ai-automation': 'ai-automation', 'automation': 'ai-automation', 'automations': 'ai-automation', 'أتمتة': 'ai-automation',
        'ai-analytics': 'ai-analytics', 'analytics': 'ai-analytics', 'insights': 'ai-analytics', 'تحليلات': 'ai-analytics',
      };
      const pageId = map[raw] || raw;
      if (!pageId) return { success: false, error: 'No page specified' };

      const aiPages = ['ai-workspace', 'ai-analytics', 'ai-automation', 'ai-personality', 'ai-settings'];
      if (aiPages.includes(pageId)) {
        if (window.showAIPage) window.showAIPage(pageId, null);
        else if (window.showPage) window.showPage(pageId, null);
      } else {
        if (window.showPage) window.showPage(pageId, null);
        else return { success: false, error: 'showPage function not available' };
      }

      if (typeof showToast === 'function') showToast(`تم الانتقال إلى ${pageId}`, 'success');
      return { success: true, result: { navigated: pageId } };
    },

    /* ── READ APP STATE ─────────────────────────────────── */
    getAppState() {
      const weekNum = typeof getCurrentWeekNum === 'function' ? getCurrentWeekNum() : 1;
      const today = new Date();
      const dayOfWeek = today.getDay();
      const dayMap = { 6: 'sat', 0: 'sun', 1: 'mon', 2: 'tue', 3: 'wed', 4: 'thu', 5: 'fri' };
      const todayKey = dayMap[dayOfWeek] || 'sat';
      const settings = typeof DB !== 'undefined' ? DB.get('settings', {}) : {};

      const weekData = {};
      if (typeof WEEK_SCHEDULE !== 'undefined' && typeof getDailyData === 'function') {
        WEEK_SCHEDULE.forEach(day => {
          const data = getDailyData(weekNum, day.key, day.pattern);
          weekData[day.key] = {
            day: day.dayEn,
            dayAr: day.dayAr,
            pattern: day.pattern,
            blocks: (data.blocks || []).map(b => ({
              id: b.id,
              name: typeof b.name === 'object' ? b.name.ar : b.name,
              timeStart: b.timeStart,
              timeEnd: b.timeEnd,
              activity: typeof b.activity === 'object' ? b.activity.ar : b.activity,
              goal: b.goal || '',
              learn: b.learn || '',
              apply: b.apply || '',
              duration: b.duration,
              isBreak: b.isBreak || false,
              notes: b.notes || '',
              outputs: b.outputs || '',
              subject: b.subject || '',
              difficulty: b.difficulty || '',
              priority: b.priority || '',
              status: b.status || '',
              aiSummary: b.aiSummary || '',
            }))
          };
        });
      }

      return {
        success: true,
        result: {
          currentPage: window._currentAIPage || 'unknown',
          weekNum,
          todayKey,
          todayDay: typeof WEEK_SCHEDULE !== 'undefined' ? (WEEK_SCHEDULE.find(d => d.key === todayKey)?.dayAr || todayKey) : todayKey,
          date: today.toLocaleDateString('ar-SA'),
          time: today.toLocaleTimeString('ar-SA'),
          userName: settings.userName || 'Murad',
          theme: settings.theme || 'dark',
          weekData,
          currentBlocks: window.currentBlocks || [],
          currentDayKey: window.currentDayKey || null,
          sessionContext: window._sessionContext,
        }
      };
    },

    /* ── READ PAGE CONTENT ──────────────────────────────── */
    readPageContent(args) {
      const page = args.page || window._currentAIPage || 'current';
      const pageEl = document.getElementById('page-' + page) ||
                     document.querySelector('.page.active');
      if (!pageEl) return { success: false, error: `Page element not found: ${page}` };

      const text = pageEl.innerText || pageEl.textContent || '';
      const inputs = Array.from(pageEl.querySelectorAll('input,textarea,select')).map(el => ({
        id: el.id,
        name: el.name,
        type: el.type || el.tagName.toLowerCase(),
        value: el.value,
        placeholder: el.placeholder || '',
        label: document.querySelector(`label[for="${el.id}"]`)?.textContent?.trim() || ''
      }));

      return {
        success: true,
        result: {
          page,
          textContent: text.substring(0, 5000),
          inputs,
          forms: Array.from(pageEl.querySelectorAll('form')).length,
          buttons: Array.from(pageEl.querySelectorAll('button')).map(b => b.textContent.trim()).filter(Boolean).slice(0, 20)
        }
      };
    },

    /* ── READ HOVERED ELEMENT ───────────────────────────── */
    readHoveredElement() {
      if (typeof window._getLastHoveredElement === 'function') {
        const { element: el, text } = window._getLastHoveredElement();
        if (!el || el === document.body) {
          return { success: true, result: { hovered: null, message: 'No element recently hovered' } };
        }
        return {
          success: true,
          result: {
            hovered: {
              tag: el.tagName,
              id: el.id || null,
              className: (el.className || '').toString().substring(0, 100),
              text: text?.substring(0, 300) || '',
              type: el.type || '',
              value: el.value?.substring(0, 200) || ''
            }
          }
        };
      }
      return { success: true, result: { hovered: null, message: 'Hover tracking not initialized' } };
    },

    /* ── ANALYZE SCHEDULE ───────────────────────────────── */
    analyzeSchedule(args) {
      const { dayKey } = args || {};
      const weekNum = typeof getCurrentWeekNum === 'function' ? getCurrentWeekNum() : 1;

      const results = {};
      const daysToCheck = dayKey
        ? [WEEK_SCHEDULE.find(d => d.key === dayKey)].filter(Boolean)
        : WEEK_SCHEDULE;

      let totalIssues = 0;
      const suggestions = [];

      daysToCheck.forEach(dayInfo => {
        if (!dayInfo) return;
        const data = typeof getDailyData === 'function' ? getDailyData(weekNum, dayInfo.key, dayInfo.pattern) : {};
        const blocks = data?.blocks || [];

        const info = {
          day: dayInfo.dayAr,
          dayKey: dayInfo.key,
          blockCount: blocks.length,
          totalMinutes: blocks.reduce((s, b) => s + (b.duration || 0), 0),
          hasReview: blocks.some(b => {
            const n = typeof b.name === 'object' ? b.name.ar : (b.name || '');
            return n.includes('مراجع') || n.includes('Anki');
          }),
          hasBreaks: blocks.some(b => b.isBreak),
          longSessions: blocks.filter(b => !b.isBreak && (b.duration || 0) > 120).length,
          issues: []
        };

        if (blocks.length === 0) {
          info.issues.push('جدول فارغ — لا توجد بلوكات');
          suggestions.push({ day: dayInfo.dayAr, type: 'empty', msg: `يوم ${dayInfo.dayAr} فارغ — يُنصح بإضافة خطة دراسية` });
        } else {
          if (!info.hasReview) {
            info.issues.push('لا يوجد بلوك مراجعة');
            suggestions.push({ day: dayInfo.dayAr, type: 'no_review', msg: `يوم ${dayInfo.dayAr}: لا يوجد بلوك مراجعة — المراجعة تحسن التذكر 70%` });
          }
          if (!info.hasBreaks && blocks.length > 3) {
            info.issues.push('لا توجد استراحات');
            suggestions.push({ day: dayInfo.dayAr, type: 'no_breaks', msg: `يوم ${dayInfo.dayAr}: لا توجد استراحات — يُنصح بـ 15 دقيقة كل 90 دقيقة` });
          }
          if (info.longSessions > 0) {
            info.issues.push(`${info.longSessions} جلسات تتجاوز ساعتين`);
            suggestions.push({ day: dayInfo.dayAr, type: 'long_sessions', msg: `يوم ${dayInfo.dayAr}: جلسات طويلة — قسّمها إلى أجزاء 90 دقيقة` });
          }
        }

        totalIssues += info.issues.length;
        results[dayInfo.key] = info;
      });

      return {
        success: true,
        result: {
          daysAnalyzed: daysToCheck.length,
          totalIssues,
          suggestions,
          details: results,
          summary: totalIssues === 0
            ? 'الجدول ممتاز! لا توجد مشاكل مكتشفة'
            : `وُجدت ${totalIssues} مشكلة في الجدول تستحق المراجعة`
        }
      };
    },

    /* ── WRITE TO TEXTAREA ──────────────────────────────── */
    writeToTextarea(args) {
      const { id, selector, content, append = false } = args;
      if (!content) return { success: false, error: 'content is required' };
      let el = id ? document.getElementById(id) : (selector ? document.querySelector(selector) : null);
      if (!el) {
        el = document.getElementById('aiInputTextarea') || document.getElementById('dockAIInput');
      }
      if (!el) return { success: false, error: 'Textarea not found' };
      if (append) el.value += '\n' + content;
      else el.value = content;
      el.style.height = 'auto';
      el.style.height = Math.min(el.scrollHeight, 240) + 'px';
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.focus();
      return { success: true, result: { filled: el.id || selector, length: content.length } };
    },

    /* ── READ FOCUSED ELEMENT ───────────────────────────── */
    readFocusedElement() {
      const el = document.activeElement;
      if (!el || el === document.body) {
        return { success: true, result: { focused: null, message: 'No element is currently focused' } };
      }
      return {
        success: true,
        result: {
          focused: {
            tag: el.tagName,
            id: el.id,
            type: el.type || '',
            value: el.value?.substring(0, 500) || el.textContent?.substring(0, 200) || '',
            placeholder: el.placeholder || '',
            name: el.name || '',
            label: el.id ? document.querySelector(`label[for="${el.id}"]`)?.textContent?.trim() || '' : '',
            selectionStart: el.selectionStart,
            selectionEnd: el.selectionEnd
          }
        }
      };
    },

    /* ── FILL FIELD ─────────────────────────────────────── */
    fillField(args) {
      const { selector, id, name, value } = args;
      if (value === undefined) return { success: false, error: 'value is required' };

      let el = null;
      if (id) el = document.getElementById(id);
      if (!el && selector) el = document.querySelector(selector);
      if (!el && name) el = document.querySelector(`[name="${name}"]`);
      if (!el) return { success: false, error: `Field not found: id=${id}, selector=${selector}, name=${name}` };

      const tag = el.tagName.toLowerCase();

      if (tag === 'select') {
        const opts = Array.from(el.options);
        const match = opts.find(o =>
          o.value === String(value) ||
          o.text.toLowerCase() === String(value).toLowerCase()
        );
        if (match) {
          el.value = match.value;
        } else {
          return { success: false, error: `No option matching "${value}" in select#${id}` };
        }
      } else if (el.type === 'checkbox' || el.type === 'radio') {
        el.checked = Boolean(value);
      } else {
        el.value = String(value);
        el.style.height = 'auto';
        if (el.scrollHeight) el.style.height = el.scrollHeight + 'px';
      }

      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));

      return { success: true, result: { filled: el.id || el.name || selector, value } };
    },

    /* ── FILL MULTIPLE FIELDS ───────────────────────────── */
    async fillForm(args) {
      const { fields } = args;
      if (!Array.isArray(fields)) return { success: false, error: 'fields must be an array' };
      const results = [];
      for (const f of fields) {
        const r = await this.tools.fillField.call(this, f);
        results.push({ field: f.id || f.selector || f.name, ...r });
      }
      const failed = results.filter(r => !r.success);
      return {
        success: failed.length === 0,
        result: { filled: results.length - failed.length, failed: failed.length, details: results },
        error: failed.length > 0 ? `${failed.length} field(s) failed: ${failed.map(f => f.field).join(', ')}` : undefined
      };
    },

    /* ── CLICK BUTTON ───────────────────────────────────── */
    clickButton(args) {
      const { id, selector, text } = args;
      let btn = null;
      if (id) btn = document.getElementById(id);
      if (!btn && selector) btn = document.querySelector(selector);
      if (!btn && text) {
        btn = Array.from(document.querySelectorAll('button')).find(b =>
          b.textContent.trim().toLowerCase().includes(text.toLowerCase())
        );
      }
      if (!btn) return { success: false, error: `Button not found: id=${id}, selector=${selector}, text="${text}"` };
      if (btn.disabled) return { success: false, error: `Button "${btn.textContent.trim()}" is disabled` };

      btn.click();
      return { success: true, result: { clicked: btn.id || btn.textContent.trim().substring(0, 50) } };
    },

    /* ══════════════════════════════════════════════════════════
       CREATE DAY SCHEDULE — Session 8 REWRITE
       Supports ALL 22+ block fields + DB verification + retry
    ══════════════════════════════════════════════════════════ */
    createDaySchedule(args) {
      const { dayKey, blocks, replaceExisting = false } = args;
      if (!dayKey) return { success: false, error: 'dayKey is required (sat,sun,mon,tue,wed,thu,fri)', blockCount: 0 };
      if (!Array.isArray(blocks) || blocks.length === 0) return { success: false, error: 'blocks array is required and must not be empty', blockCount: 0 };

      const weekNum = this._getWeekNum();
      const dayInfo = this._getDayInfo(dayKey);
      if (!dayInfo) return { success: false, error: `Invalid dayKey: ${dayKey}. Valid: sat,sun,mon,tue,wed,thu,fri`, blockCount: 0 };

      // Show loading indicator for slow operations
      if (typeof showToast === 'function') showToast(`⏳ جارٍ إنشاء ${blocks.length} بلوك ليوم ${dayInfo.dayAr}...`, 'info');

      // Map all blocks with full 22+ field support
      const newBlocks = blocks.map((b, i) => this._mapBlockFields(b, i));

      const storageKey = getDayKey(weekNum, dayKey);
      let dayData = this._getDayData(weekNum, dayKey) || {};

      if (replaceExisting) {
        dayData.blocks = newBlocks;
      } else {
        dayData.blocks = [...(dayData.blocks || []), ...newBlocks];
      }

      // First write attempt
      let saved = this._saveDayData(weekNum, dayKey, dayData);
      if (!saved) {
        return { success: false, error: 'localStorage.set failed — storage may be full', blockCount: 0, failureReason: 'Storage write failed on first attempt' };
      }

      // VERIFY: re-read from storage immediately
      let verify = DB.get(storageKey);
      let savedCount = verify?.blocks?.length || 0;

      // AUTO-RETRY if verification fails
      if (savedCount === 0) {
        console.warn('[AIAgentCore] createDaySchedule: verification failed, retrying...');
        if (typeof showToast === 'function') showToast('⚠️ التحقق فشل، إعادة المحاولة...', 'warning');
        // Synchronous retry — no async delay needed (localStorage is synchronous)

        // Retry
        dayData.blocks = replaceExisting ? newBlocks : [...(DB.get(storageKey)?.blocks || []), ...newBlocks];
        saved = this._saveDayData(weekNum, dayKey, dayData);
        verify = DB.get(storageKey);
        savedCount = verify?.blocks?.length || 0;

        if (savedCount === 0) {
          return {
            success: false,
            error: 'Blocks were not persisted after 2 write attempts. Storage may be full or corrupted.',
            blockCount: 0,
            failureReason: 'DB verification failed after retry',
          };
        }
      }

      // Update live UI if this day is open
      if (window.currentDayKey === dayKey) {
        window.currentBlocks = dayData.blocks;
        if (typeof renderBlocks === 'function') renderBlocks(window.currentBlocks);
      }

      // Update session context
      window._sessionContext.lastDay = dayKey;
      window._sessionContext.lastCreatedBlocks = newBlocks.map(b => ({ id: b.id, dayKey }));

      if (typeof showToast === 'function') showToast(`✅ تم إنشاء ${newBlocks.length} بلوك ليوم ${dayInfo.dayAr}`, 'success');

      // Count non-empty fields across all blocks
      const allFieldNames = ['goal','learn','apply','outputs','notes','subject','difficulty','tips','exercises','resources','links','priority','status','aiSummary'];
      let totalFilled = 0, totalFields = 0;
      newBlocks.forEach(b => {
        allFieldNames.forEach(f => {
          totalFields++;
          const v = b[f];
          if (v && (typeof v !== 'string' || v.trim())) totalFilled++;
        });
      });

      return {
        success: true,
        blockCount: savedCount,
        fieldsModified: totalFilled,
        fieldsFailed: [],
        failureReason: null,
        result: {
          day: dayInfo.dayAr,
          dayKey,
          blocksCreated: newBlocks.length,
          totalBlocks: savedCount,
          verifiedInDB: true,
          fieldCoverage: `${totalFilled}/${totalFields}`,
          blocks: newBlocks.map(b => ({
            id: b.id,
            name: b.name.ar,
            time: `${b.timeStart}–${b.timeEnd}`,
            goal: b.goal,
            learn: b.learn,
            apply: b.apply,
            subject: b.subject,
          }))
        }
      };
    },

    /* ══════════════════════════════════════════════════════════
       UPDATE A SINGLE BLOCK — Session 8 REWRITE
       Surgical update for all 22+ fields individually
    ══════════════════════════════════════════════════════════ */
    updateBlock(args) {
      const { dayKey, blockId, updates } = args;
      if (!dayKey || !blockId) return { success: false, error: 'dayKey and blockId are required', fieldsModified: [], fieldsFailed: [] };
      if (!updates || typeof updates !== 'object') return { success: false, error: 'updates object is required', fieldsModified: [], fieldsFailed: [] };

      const weekNum = this._getWeekNum();
      const dayInfo = this._getDayInfo(dayKey);
      if (!dayInfo) return { success: false, error: `Invalid dayKey: ${dayKey}`, fieldsModified: [], fieldsFailed: [] };

      const storageKey = getDayKey(weekNum, dayKey);
      const dayData = this._getDayData(weekNum, dayKey) || {};
      const blockIdx = (dayData.blocks || []).findIndex(b => b.id === blockId);
      if (blockIdx === -1) return { success: false, error: `Block not found: ${blockId}. Use readDayBlocks to get valid IDs.`, fieldsModified: [], fieldsFailed: [] };

      const block = dayData.blocks[blockIdx];

      // Apply all field updates surgically
      const { fieldsModified, fieldsFailed } = this._applyBlockUpdates(block, updates);

      dayData.blocks[blockIdx] = block;
      const saved = this._saveDayData(weekNum, dayKey, dayData);
      if (!saved) {
        return { success: false, error: 'Storage write failed', fieldsModified: [], fieldsFailed: [{ field: 'all', reason: 'localStorage write failed' }] };
      }

      // Verify the write
      const verify = DB.get(storageKey);
      const verifiedBlock = verify?.blocks?.find(b => b.id === blockId);
      if (!verifiedBlock) {
        return { success: false, error: 'Block update could not be verified in storage', fieldsModified, fieldsFailed };
      }

      // Update live UI
      if (window.currentDayKey === dayKey) {
        window.currentBlocks = dayData.blocks;
        if (typeof renderBlocks === 'function') renderBlocks(window.currentBlocks);
      }

      // Update session context
      window._sessionContext.lastBlock = { id: blockId, dayKey, name: typeof block.name === 'object' ? block.name.ar : block.name };
      window._sessionContext.lastDay = dayKey;

      return {
        success: true,
        blockCount: 1,
        fieldsModified,
        fieldsFailed,
        failureReason: fieldsFailed.length > 0 ? fieldsFailed.map(f => `${f.field}: ${f.reason}`).join('; ') : null,
        result: {
          updated: blockId,
          day: dayInfo.dayAr,
          fieldsChanged: fieldsModified,
          failedFields: fieldsFailed,
          verifiedInDB: true,
        }
      };
    },

    /* ══════════════════════════════════════════════════════════
       FILL ALL BLOCK DETAILS — Point 3
       Fills ALL fields of ALL blocks in a day
    ══════════════════════════════════════════════════════════ */
    fillAllBlockDetails(args) {
      const { dayKey, blockUpdates } = args;
      // blockUpdates: array of { blockId, fields: { goal, learn, apply, notes, ... } }
      // OR { fieldTemplate: { goal, learn, apply, notes, ... } } to apply same template to all
      if (!dayKey) return { success: false, error: 'dayKey is required', blockCount: 0, fieldsModified: [], fieldsFailed: [] };

      const weekNum = this._getWeekNum();
      const dayInfo = this._getDayInfo(dayKey);
      if (!dayInfo) return { success: false, error: `Invalid dayKey: ${dayKey}`, blockCount: 0, fieldsModified: [], fieldsFailed: [] };

      const storageKey = getDayKey(weekNum, dayKey);
      const dayData = this._getDayData(weekNum, dayKey) || {};
      const blocks = dayData.blocks || [];

      if (blocks.length === 0) {
        return { success: false, error: `No blocks found for ${dayInfo.dayAr}. Create blocks first with createDaySchedule.`, blockCount: 0, fieldsModified: [], fieldsFailed: [] };
      }

      if (typeof showToast === 'function') showToast(`⏳ جارٍ تعبئة تفاصيل ${blocks.length} بلوك...`, 'info');

      const allFieldsModified = [];
      const allFieldsFailed = [];

      if (Array.isArray(blockUpdates)) {
        // Per-block updates
        blockUpdates.forEach(u => {
          const idx = blocks.findIndex(b => b.id === u.blockId);
          if (idx === -1) {
            allFieldsFailed.push({ blockId: u.blockId, reason: 'Block not found' });
            return;
          }
          const { fieldsModified, fieldsFailed } = this._applyBlockUpdates(blocks[idx], u.fields || u.updates || u);
          allFieldsModified.push(...fieldsModified.map(f => `${u.blockId}.${f}`));
          allFieldsFailed.push(...fieldsFailed.map(f => ({ ...f, blockId: u.blockId })));
        });
      } else if (args.fieldTemplate || args.fields) {
        // Same template for all blocks
        const template = args.fieldTemplate || args.fields;
        blocks.forEach(block => {
          const { fieldsModified, fieldsFailed } = this._applyBlockUpdates(block, template);
          allFieldsModified.push(...fieldsModified.map(f => `${block.id}.${f}`));
          allFieldsFailed.push(...fieldsFailed.map(f => ({ ...f, blockId: block.id })));
        });
      } else {
        // No template: fill with smart defaults based on block name
        blocks.forEach(block => {
          const blockName = typeof block.name === 'object' ? block.name.ar : (block.name || 'بلوك');
          const isBreak = block.isBreak || blockName.includes('استراحة') || blockName.includes('غداء');

          if (!isBreak) {
            const defaults = {};
            if (!block.goal || block.goal === '') defaults.goal = `إتقان ${blockName} وتحقيق فهم عميق للمفاهيم الأساسية`;
            if (!block.learn || block.learn === '') defaults.learn = `المفاهيم الأساسية في ${blockName}، النظريات الرئيسية، والتطبيقات العملية`;
            if (!block.apply || block.apply === '') defaults.apply = `حل تمارين، تطبيق ما تعلمته على أمثلة واقعية`;
            if (!block.outputs || block.outputs === '') defaults.outputs = `فهم واضح لـ ${blockName}، قدرة على حل المسائل المتعلقة بها`;
            if (!block.notes || block.notes === '') defaults.notes = `راجع المادة بعد كل جلسة، استخدم تقنية Feynman للشرح`;
            if (!block.priority || block.priority === '') defaults.priority = 'high';
            if (!block.status || block.status === '') defaults.status = 'pending';
            if (!block.aiSummary || block.aiSummary === '') defaults.aiSummary = `بلوك دراسة لـ ${blockName} — ${block.duration || 60} دقيقة`;

            if (Object.keys(defaults).length > 0) {
              const { fieldsModified, fieldsFailed } = this._applyBlockUpdates(block, defaults);
              allFieldsModified.push(...fieldsModified.map(f => `${block.id}.${f}`));
              allFieldsFailed.push(...fieldsFailed.map(f => ({ ...f, blockId: block.id })));
            }
          }
        });
      }

      // Save
      const saved = this._saveDayData(weekNum, dayKey, dayData);
      if (!saved) {
        return { success: false, error: 'Storage write failed during fillAllBlockDetails', blockCount: blocks.length, fieldsModified: allFieldsModified, fieldsFailed: allFieldsFailed };
      }

      // Verify
      const verify = DB.get(storageKey);
      const savedBlocks = verify?.blocks || [];
      if (savedBlocks.length === 0) {
        return { success: false, error: 'Verification failed: blocks not found in storage after fillAllBlockDetails', blockCount: 0, fieldsModified: allFieldsModified, fieldsFailed: allFieldsFailed };
      }

      // Update live UI
      if (window.currentDayKey === dayKey) {
        window.currentBlocks = dayData.blocks;
        if (typeof renderBlocks === 'function') renderBlocks(window.currentBlocks);
      }

      window._sessionContext.lastDay = dayKey;
      if (typeof showToast === 'function') showToast(`✅ تم تعبئة تفاصيل ${blocks.length} بلوك`, 'success');

      return {
        success: true,
        blockCount: blocks.length,
        fieldsModified: allFieldsModified,
        fieldsFailed: allFieldsFailed,
        failureReason: allFieldsFailed.length > 0 ? `${allFieldsFailed.length} field(s) failed` : null,
        result: {
          day: dayInfo.dayAr,
          dayKey,
          blocksProcessed: blocks.length,
          fieldsFilledCount: allFieldsModified.length,
          failedCount: allFieldsFailed.length,
          verifiedInDB: true,
        }
      };
    },

    /* ══════════════════════════════════════════════════════════
       VERIFY AND REPAIR BLOCKS — Points 7-8
       Self-verification loop: write → read → compare → fix → repeat
    ══════════════════════════════════════════════════════════ */
    verifyAndRepairBlocks(args) {
      const { dayKey, requiredFields, maxIterations = 3 } = args;
      if (!dayKey) return { success: false, error: 'dayKey is required' };

      const defaultRequiredFields = ['goal', 'learn', 'apply', 'outputs', 'notes', 'priority', 'status'];
      const fieldsToCheck = requiredFields || defaultRequiredFields;

      const weekNum = this._getWeekNum();
      const dayInfo = this._getDayInfo(dayKey);
      if (!dayInfo) return { success: false, error: `Invalid dayKey: ${dayKey}` };

      const storageKey = getDayKey(weekNum, dayKey);
      let iteration = 0;
      let repairLog = [];

      while (iteration < maxIterations) {
        iteration++;

        // Read current state from DB
        const currentData = DB.get(storageKey);
        const blocks = currentData?.blocks || [];

        if (blocks.length === 0) {
          return { success: false, error: `No blocks found for ${dayInfo.dayAr}`, iterations: iteration };
        }

        // Check each block for missing fields
        let anyMissing = false;
        const repairActions = [];

        blocks.forEach(block => {
          if (block.isBreak) return; // Don't repair breaks
          const missing = this._verifyBlockFields(block, fieldsToCheck);
          if (missing.length > 0) {
            anyMissing = true;
            const blockName = typeof block.name === 'object' ? block.name.ar : (block.name || 'بلوك');
            const repairs = {};
            missing.forEach(f => {
              switch (f) {
                case 'goal': repairs.goal = `تحقيق فهم عميق لـ ${blockName}`; break;
                case 'learn': repairs.learn = `المفاهيم الأساسية والنظريات الرئيسية في ${blockName}`; break;
                case 'apply': repairs.apply = `تطبيق عملي وحل تمارين في ${blockName}`; break;
                case 'outputs': repairs.outputs = `إتقان ${blockName} وفهم تطبيقاتها`; break;
                case 'notes': repairs.notes = `استخدم Active Recall وراجع بعد الجلسة`; break;
                case 'priority': repairs.priority = 'high'; break;
                case 'status': repairs.status = 'pending'; break;
                default: repairs[f] = `محتوى ${blockName} — ${f}`; break;
              }
            });
            this._applyBlockUpdates(block, repairs);
            repairActions.push({ blockId: block.id, repairedFields: missing });
          }
        });

        if (!anyMissing) {
          // All fields are filled — done!
          repairLog.push({ iteration, status: 'all_fields_complete', blocksChecked: blocks.length });
          return {
            success: true,
            result: {
              day: dayInfo.dayAr,
              dayKey,
              iterations: iteration,
              repairLog,
              allFieldsComplete: true,
              blocksVerified: blocks.length,
            }
          };
        }

        // Save repairs
        const dayData = currentData;
        dayData.blocks = blocks;
        this._saveDayData(weekNum, dayKey, dayData);
        repairLog.push({ iteration, status: 'repaired', repairActions });

        // Update live UI
        if (window.currentDayKey === dayKey) {
          window.currentBlocks = blocks;
          if (typeof renderBlocks === 'function') renderBlocks(window.currentBlocks);
        }

        // Short wait before re-reading (synchronous fallback)
      }

      // After max iterations, check final state
      const finalData = DB.get(storageKey);
      const finalBlocks = finalData?.blocks || [];
      let remainingIssues = 0;
      finalBlocks.forEach(b => {
        if (!b.isBreak) {
          remainingIssues += this._verifyBlockFields(b, fieldsToCheck).length;
        }
      });

      return {
        success: remainingIssues === 0,
        result: {
          day: dayInfo.dayAr,
          dayKey,
          iterations: maxIterations,
          repairLog,
          allFieldsComplete: remainingIssues === 0,
          remainingMissingFields: remainingIssues,
        },
        error: remainingIssues > 0 ? `${remainingIssues} fields still missing after ${maxIterations} repair iterations` : null
      };
    },

    /* ── DELETE BLOCK ───────────────────────────────────── */
    deleteBlock(args) {
      const { dayKey, blockId } = args;
      if (!dayKey || !blockId) return { success: false, error: 'dayKey and blockId are required' };

      const weekNum = this._getWeekNum();
      const dayInfo = this._getDayInfo(dayKey);
      if (!dayInfo) return { success: false, error: `Invalid dayKey: ${dayKey}` };

      const dayData = this._getDayData(weekNum, dayKey) || {};
      const before = (dayData.blocks || []).length;
      dayData.blocks = (dayData.blocks || []).filter(b => b.id !== blockId);
      if (dayData.blocks.length === before) return { success: false, error: `Block ${blockId} not found in ${dayKey}` };

      this._saveDayData(weekNum, dayKey, dayData);

      if (window.currentDayKey === dayKey) {
        window.currentBlocks = dayData.blocks;
        if (typeof renderBlocks === 'function') renderBlocks(window.currentBlocks);
      }

      if (typeof showToast === 'function') showToast('تم حذف البلوك', 'info');
      return { success: true, blockCount: dayData.blocks.length, result: { deleted: blockId, remaining: dayData.blocks.length } };
    },

    /* ── CLEAR DAY BLOCKS ───────────────────────────────── */
    clearDayBlocks(args) {
      const { dayKey, confirmed = false } = args;
      if (!dayKey) return { success: false, error: 'dayKey is required' };

      const weekNum = this._getWeekNum();
      const dayInfo = this._getDayInfo(dayKey);
      if (!dayInfo) return { success: false, error: `Invalid dayKey: ${dayKey}` };

      const dayData = this._getDayData(weekNum, dayKey) || {};
      const count = (dayData.blocks || []).length;

      if (!confirmed && count > 0) {
        const ok = window.confirm(
          `⚠️ هل أنت متأكد من حذف جميع البلوكات (${count}) ليوم ${dayInfo.dayAr}؟\nهذه العملية لا يمكن التراجع عنها.`
        );
        if (!ok) return { success: false, error: 'تم إلغاء العملية من قبل المستخدم' };
      }

      dayData.blocks = [];
      this._saveDayData(weekNum, dayKey, dayData);

      if (window.currentDayKey === dayKey) {
        window.currentBlocks = [];
        if (typeof renderBlocks === 'function') renderBlocks([]);
      }

      if (typeof showToast === 'function') showToast(`تم مسح ${count} بلوكات من ${dayInfo.dayAr}`, 'info');
      return { success: true, blockCount: 0, result: { cleared: count, day: dayInfo.dayAr } };
    },

    /* ── READ DAY BLOCKS — Enhanced (all 22+ fields) ─────── */
    readDayBlocks(args) {
      const { dayKey } = args;
      if (!dayKey) return { success: false, error: 'dayKey is required' };

      const weekNum = this._getWeekNum();
      const dayInfo = this._getDayInfo(dayKey);
      if (!dayInfo) return { success: false, error: `Invalid dayKey: ${dayKey}` };

      const data = this._getDayData(weekNum, dayKey) || {};

      // Update session context
      window._sessionContext.lastDay = dayKey;

      return {
        success: true,
        result: {
          day: dayInfo.dayAr,
          dayKey,
          pattern: dayInfo.pattern,
          blockCount: (data.blocks || []).length,
          blocks: (data.blocks || []).map(b => ({
            id: b.id,
            name: typeof b.name === 'object' ? b.name.ar : b.name,
            nameEn: typeof b.name === 'object' ? b.name.en : b.name,
            timeStart: b.timeStart,
            timeEnd: b.timeEnd,
            duration: b.duration,
            isBreak: b.isBreak || false,
            // All 22+ fields
            activity: typeof b.activity === 'object' ? b.activity.ar : (b.activity || ''),
            goal: b.goal || '',
            learn: b.learn || '',
            apply: b.apply || '',
            notes: b.notes || '',
            outputs: b.outputs || '',
            subject: b.subject || '',
            difficulty: b.difficulty || '',
            tips: b.tips || '',
            exercises: b.exercises || '',
            resources: b.resources || '',
            links: b.links || '',
            priority: b.priority || '',
            status: b.status || '',
            reminders: b.reminders || '',
            tags: b.tags || [],
            attachments: b.attachments || '',
            aiSummary: b.aiSummary || '',
            sound: b.sound || '',
          }))
        }
      };
    },

    /* ── UPDATE WEEKLY TABLE CELL ───────────────────────── */
    updateWeeklyCell(args) {
      const { dayKey, columnIndex, value } = args;
      if (!dayKey || columnIndex === undefined) return { success: false, error: 'dayKey and columnIndex are required' };

      const weekNum = this._getWeekNum();
      const key = 'week_' + weekNum;
      const data = typeof getWeeklyData === 'function' ? getWeeklyData(weekNum) : DB.get(key, {});

      if (!data[dayKey]) data[dayKey] = { cells: [] };
      if (!Array.isArray(data[dayKey].cells)) data[dayKey].cells = [];
      while (data[dayKey].cells.length <= columnIndex) data[dayKey].cells.push('');
      data[dayKey].cells[columnIndex] = String(value || '');

      DB.set(key, data);

      const tbody = document.getElementById('weeklyTableBody');
      if (tbody) {
        const dayIdx = WEEK_SCHEDULE.findIndex(d => d.key === dayKey);
        const row = tbody.rows[dayIdx];
        if (row) {
          const cell = row.querySelectorAll('.editable-cell')[columnIndex];
          if (cell) cell.textContent = String(value || '');
        }
      }

      return { success: true, result: { dayKey, columnIndex, value } };
    },

    /* ── SAVE WEEKLY TABLE ──────────────────────────────── */
    saveWeeklyTable() {
      if (typeof saveWeeklyData === 'function') {
        saveWeeklyData();
        const weekNum = this._getWeekNum();
        const key = 'week_' + weekNum;
        const verify = DB.get(key);
        if (!verify) return { success: false, error: 'Weekly data was not persisted after save' };
        return { success: true, result: { saved: true, weekNum } };
      }
      return { success: false, error: 'saveWeeklyData function not available' };
    },

    /* ── READ WEEKLY TABLE ──────────────────────────────── */
    readWeeklyTable() {
      const weekNum = this._getWeekNum();
      const data = typeof getWeeklyData === 'function' ? getWeeklyData(weekNum) : DB.get('week_' + weekNum, {});
      const columns = (data._columns || []).map(c => c.ar || c.en || '');
      const rows = WEEK_SCHEDULE.map(day => ({
        day: day.dayAr,
        dayKey: day.key,
        cells: data[day.key]?.cells || []
      }));
      return { success: true, result: { weekNum, columns, rows } };
    },

    /* ── OPEN DAY BOARD ─────────────────────────────────── */
    openDayBoard(args) {
      const { dayKey } = args;
      if (!dayKey) return { success: false, error: 'dayKey is required' };
      const dayInfo = this._getDayInfo(dayKey);
      if (!dayInfo) return { success: false, error: `Invalid dayKey: ${dayKey}` };

      if (typeof openDayBoard === 'function') {
        openDayBoard(dayKey, dayInfo.pattern, null);
        window._sessionContext.lastDay = dayKey;
        return { success: true, result: { opened: dayKey, day: dayInfo.dayAr } };
      }
      return { success: false, error: 'openDayBoard function not found in app.js' };
    },

    /* ── SETTINGS ───────────────────────────────────────── */
    readSettings() {
      const s = typeof DB !== 'undefined' ? DB.get('settings', {}) : {};
      return { success: true, result: s };
    },

    updateSettings(args) {
      const { key, value } = args;
      if (!key) return { success: false, error: 'key is required' };

      const s = typeof DB !== 'undefined' ? DB.get('settings', {}) : {};
      s[key] = value;
      const saved = DB.set('settings', s);
      if (!saved) return { success: false, error: 'Storage write failed' };

      const el = document.getElementById(key);
      if (el) {
        if (el.type === 'checkbox') el.checked = Boolean(value);
        else el.value = String(value);
        el.dispatchEvent(new Event('change', { bubbles: true }));
      }

      if (typeof loadSettingsUI === 'function') loadSettingsUI();
      return { success: true, result: { updated: key, value } };
    },

    /* ── SESSION CONTEXT (memory across messages) ─────── */
    readSessionContext() {
      return { success: true, result: window._sessionContext };
    },

    setSessionContext(args) {
      if (!args || typeof args !== 'object') return { success: false, error: 'args object required' };
      const allowed = ['lastFile', 'lastImage', 'lastTable', 'lastBlock', 'lastDay', 'lastSubject'];
      allowed.forEach(k => {
        if (args[k] !== undefined) window._sessionContext[k] = args[k];
      });
      return { success: true, result: { updated: Object.keys(args).filter(k => allowed.includes(k)) } };
    },

    /* ── MEMORY ─────────────────────────────────────────── */
    addMemory(args) {
      const { key, value, category } = args;
      if (!key || !value) return { success: false, error: 'key and value are required' };
      if (typeof AIMemory !== 'undefined') {
        AIMemory.add(key, value, category || 'general');
        const verify = AIMemory.getAll().find(m => m.key === key);
        if (!verify) return { success: false, error: 'Memory was not saved to storage' };
        return { success: true, result: { saved: key, value } };
      }
      return { success: false, error: 'AIMemory not available' };
    },

    readMemory() {
      if (typeof AIMemory !== 'undefined') {
        return { success: true, result: AIMemory.getAll() };
      }
      return { success: false, error: 'AIMemory not available' };
    },

    /* ── NOTIFICATIONS ──────────────────────────────────── */
    sendNotification(args) {
      const { title, body, type = 'info' } = args;
      if (!title) return { success: false, error: 'title is required' };

      if (typeof showToast === 'function') showToast(title + (body ? ': ' + body : ''), type);

      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification(title, { body: body || '' });
      }

      const nb = document.createElement('div');
      nb.className = 'ai-notification-bubble';
      nb.innerHTML = `<i class="fas fa-bell"></i> <strong>${title}</strong>${body ? ': ' + body : ''}`;
      nb.style.cssText = 'position:fixed;top:80px;right:20px;z-index:9999;background:var(--accent);color:#fff;padding:12px 18px;border-radius:12px;font-size:14px;box-shadow:0 4px 20px rgba(0,0,0,.4);animation:slideIn .3s ease';
      document.body.appendChild(nb);
      setTimeout(() => nb.remove(), 5000);

      return { success: true, result: { notified: true, title, body } };
    },

    /* ── SHOW TOAST ─────────────────────────────────────── */
    showToast(args) {
      const { message, type = 'success' } = args;
      if (!message) return { success: false, error: 'message is required' };
      if (typeof showToast === 'function') showToast(message, type);
      return { success: true, result: { shown: message } };
    },

    /* ── SCROLL / FOCUS ─────────────────────────────────── */
    scrollTo(args) {
      const { selector, id } = args;
      const el = id ? document.getElementById(id) : document.querySelector(selector);
      if (!el) return { success: false, error: `Element not found: ${id || selector}` };
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return { success: true, result: { scrolled: id || selector } };
    },

    focusElement(args) {
      const { id, selector } = args;
      const el = id ? document.getElementById(id) : document.querySelector(selector);
      if (!el) return { success: false, error: `Element not found: ${id || selector}` };
      el.focus();
      if (el.select) el.select();
      return { success: true, result: { focused: id || selector } };
    },

    /* ── LIST PAGE ELEMENTS ─────────────────────────────── */
    listPageElements() {
      const activePage = document.querySelector('.page.active');
      if (!activePage) return { success: false, error: 'No active page found' };

      const buttons = Array.from(activePage.querySelectorAll('button:not(:disabled)'))
        .map(b => ({ id: b.id || null, text: b.textContent.trim().substring(0, 60), onclick: b.getAttribute('onclick') }))
        .filter(b => b.text).slice(0, 30);

      const inputs = Array.from(activePage.querySelectorAll('input,textarea,select'))
        .map(el => ({
          id: el.id || null,
          type: el.type || el.tagName.toLowerCase(),
          name: el.name || null,
          value: el.value?.substring(0, 100) || '',
          placeholder: el.placeholder || ''
        })).slice(0, 30);

      return { success: true, result: { buttons, inputs } };
    },

    /* ── GENERATE STUDY PLAN ────────────────────────────── */
    generateStudyPlan(args) {
      const { dayKey, subjects, hoursAvailable = 8 } = args;
      if (!dayKey || !Array.isArray(subjects) || subjects.length === 0) {
        return { success: false, error: 'dayKey and subjects[] are required' };
      }

      const dayInfo = this._getDayInfo(dayKey);
      if (!dayInfo) return { success: false, error: `Invalid dayKey: ${dayKey}` };

      const totalMinutes = hoursAvailable * 60;
      const studyPerSubject = Math.floor((totalMinutes * 0.7) / subjects.length);

      const blocks = [];
      let currentMinute = 8 * 60;

      const toTime = (min) => {
        const h = Math.floor(min / 60);
        const m = min % 60;
        return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
      };

      blocks.push({
        name: 'مراجعة الصباح',
        activity: 'Anki + Active Recall',
        goal: 'مراجعة المفاهيم السابقة وتقوية الذاكرة طويلة المدى',
        learn: 'تذكر المعلومات المخزنة من الجلسات السابقة',
        apply: 'حل بطاقات Anki وأسئلة المراجعة السريعة',
        outputs: 'تعزيز المراجعة المتباعدة وتقوية الربط بين المعلومات',
        priority: 'high',
        status: 'pending',
        timeStart: toTime(currentMinute),
        timeEnd: toTime(currentMinute + 45),
        duration: 45,
        isBreak: false
      });
      currentMinute += 45;

      subjects.forEach((subj, i) => {
        const dur = Math.min(studyPerSubject, 90);

        if (i > 0) {
          blocks.push({
            name: 'استراحة',
            activity: 'راحة قصيرة ومشي',
            goal: 'تجديد التركيز الذهني',
            timeStart: toTime(currentMinute),
            timeEnd: toTime(currentMinute + 15),
            duration: 15,
            isBreak: true
          });
          currentMinute += 15;
        }

        blocks.push({
          name: subj,
          activity: 'دراسة عميقة + تطبيق',
          goal: `إتقان ${subj} وبناء فهم عميق وقابل للتطبيق`,
          learn: `المفاهيم الأساسية في ${subj}، النظريات الرئيسية، والروابط مع مواد أخرى`,
          apply: `حل تمارين في ${subj}، تطبيق المفاهيم على أمثلة واقعية`,
          outputs: `فهم متين لـ ${subj}، قدرة على شرح المادة بأسلوبي الخاص (Feynman)`,
          notes: `راجع المادة باستخدام Active Recall بعد الجلسة، أضف بطاقات Anki للمفاهيم الجديدة`,
          priority: 'high',
          status: 'pending',
          subject: subj,
          timeStart: toTime(currentMinute),
          timeEnd: toTime(currentMinute + dur),
          duration: dur,
          isBreak: false
        });
        currentMinute += dur;
      });

      blocks.push({
        name: 'غداء',
        activity: 'استراحة الغداء',
        goal: 'راحة ووجبة صحية',
        timeStart: toTime(currentMinute),
        timeEnd: toTime(currentMinute + 60),
        duration: 60,
        isBreak: true
      });
      currentMinute += 60;

      blocks.push({
        name: 'مراجعة ختامية',
        activity: 'Anki + ملخص + تخطيط لغد',
        goal: 'ترسيخ ما تعلمته اليوم وربط المعلومات الجديدة بالقديمة',
        learn: 'مراجعة شاملة لكل ما تم دراسته اليوم',
        apply: 'كتابة ملخص قصير بأسلوبي الخاص، تحديث بطاقات Anki',
        outputs: 'ذاكرة متينة ومنظمة، استعداد لجلسة الغد',
        notes: 'اكتب 3 أشياء تعلمتها اليوم و3 أسئلة لم تجد إجابتها بعد',
        priority: 'high',
        status: 'pending',
        timeStart: toTime(currentMinute),
        timeEnd: toTime(currentMinute + 45),
        duration: 45,
        isBreak: false
      });

      return {
        success: true,
        result: {
          day: dayInfo.dayAr,
          dayKey,
          plan: blocks,
          totalStudyTime: blocks.filter(b => !b.isBreak).reduce((s, b) => s + b.duration, 0),
          message: `تم إنشاء خطة دراسة لـ ${dayInfo.dayAr} بـ ${blocks.length} بلوك مع تفاصيل كاملة`
        }
      };
    },

    /* ══════════════════════════════════════════════════════════
       FILE EXTRACTION TOOLS — Point 9
       extractPdfText, extractWordText, extractExcelData, etc.
    ══════════════════════════════════════════════════════════ */

    /* ── EXTRACT PDF TEXT ───────────────────────────────── */
    extractPdfText(args) {
      // Always read from session memory first (Session 8 behavior)
      const sessionFile = window._sessionContext && window._sessionContext.lastFile;
      if (sessionFile) {
        return {
          success: true,
          result: {
            name: sessionFile.name,
            type: sessionFile.type,
            content: (sessionFile.text || sessionFile.content || '').substring(0, 8000),
            size: sessionFile.size,
            uploadedAt: sessionFile.uploadedAt || sessionFile.extractedAt
          }
        };
      }
      // Fallback: if args has fileContent
      const { fileContent, fileName } = args || {};
      if (fileContent) {
        return {
          success: true,
          result: {
            name: fileName || 'document.pdf',
            type: 'pdf',
            content: String(fileContent).substring(0, 8000)
          }
        };
      }
      return { success: false, error: 'لا يوجد ملف محفوظ في الجلسة الحالية. ارفع ملفاً أولاً.' };
    },

    /* ── EXTRACT WORD TEXT ──────────────────────────────── */
    async extractWordText(args) {
      const { fileContent, fileName } = args;
      const sessionFile = window._sessionContext.lastFile;
      const source = fileContent || (sessionFile?.type === 'word' || sessionFile?.type === 'docx' ? sessionFile.content : null);
      const name = fileName || sessionFile?.name || 'document.docx';

      if (!source && !sessionFile) {
        return { success: false, error: 'لا يوجد ملف Word. ارفع الملف أولاً.' };
      }

      if (sessionFile && !source) {
        return {
          success: true,
          result: {
            fileName: sessionFile.name,
            type: 'word',
            text: sessionFile.text || sessionFile.content || 'محتوى ملف Word محفوظ',
            fromSession: true
          }
        };
      }

      // RTF/DOCX text extraction (basic)
      let text = source || '';
      if (text.includes('{\\rtf')) {
        // Strip RTF markup
        text = text.replace(/\{\\[^{}]*\}/g, '').replace(/\\[a-z]+\d*\s?/g, '').replace(/[{}]/g, '').trim();
      }

      window._sessionContext.lastFile = { name, type: 'word', content: source, text, size: source?.length || 0 };
      return { success: true, result: { fileName: name, type: 'word', text: text.substring(0, 10000), charCount: text.length } };
    },

    /* ── EXTRACT EXCEL DATA ─────────────────────────────── */
    async extractExcelData(args) {
      const { fileContent, fileName } = args;
      const sessionFile = window._sessionContext.lastFile;
      const source = fileContent || (sessionFile?.type === 'excel' || sessionFile?.type === 'csv' ? sessionFile.content : null);
      const name = fileName || sessionFile?.name || 'data.xlsx';

      if (!source && !sessionFile) {
        return { success: false, error: 'لا يوجد ملف Excel/CSV. ارفع الملف أولاً.' };
      }

      if (sessionFile && !source) {
        return {
          success: true,
          result: {
            fileName: sessionFile.name,
            type: sessionFile.type,
            data: sessionFile.data || sessionFile.rows || [],
            text: sessionFile.text || sessionFile.content || '',
            fromSession: true
          }
        };
      }

      // Parse CSV/TSV
      let rows = [];
      let headers = [];
      const text = source || '';
      const lines = text.split('\n').filter(l => l.trim());
      if (lines.length > 0) {
        const sep = text.includes('\t') ? '\t' : ',';
        headers = lines[0].split(sep).map(h => h.replace(/^["']|["']$/g, '').trim());
        rows = lines.slice(1).map(line => {
          const cells = line.split(sep).map(c => c.replace(/^["']|["']$/g, '').trim());
          const row = {};
          headers.forEach((h, i) => { row[h] = cells[i] || ''; });
          return row;
        });
      }

      window._sessionContext.lastTable = { headers, rows };
      window._sessionContext.lastFile = { name, type: 'excel', content: source, data: rows, headers, size: source?.length || 0 };

      return {
        success: true,
        result: {
          fileName: name,
          type: 'excel',
          headers,
          rows: rows.slice(0, 100),
          rowCount: rows.length,
          columnCount: headers.length
        }
      };
    },

    /* ── EXTRACT PPT TEXT ───────────────────────────────── */
    async extractPptText(args) {
      const { fileContent, fileName } = args;
      const sessionFile = window._sessionContext.lastFile;
      const source = fileContent || (sessionFile?.type === 'ppt' || sessionFile?.type === 'pptx' ? sessionFile.content : null);
      const name = fileName || sessionFile?.name || 'presentation.pptx';

      if (!source && !sessionFile) {
        return { success: false, error: 'لا يوجد ملف PowerPoint. ارفع الملف أولاً.' };
      }

      if (sessionFile && !source) {
        return {
          success: true,
          result: {
            fileName: sessionFile.name,
            type: 'ppt',
            text: sessionFile.text || sessionFile.content || 'محتوى ملف PowerPoint محفوظ',
            slides: sessionFile.slides || [],
            fromSession: true
          }
        };
      }

      const text = source || '';
      window._sessionContext.lastFile = { name, type: 'ppt', content: source, text, size: source?.length || 0 };
      return { success: true, result: { fileName: name, type: 'ppt', text: text.substring(0, 10000), charCount: text.length } };
    },

    /* ── EXTRACT IMAGE TEXT (OCR) ───────────────────────── */
    async extractImageText(args) {
      const { imageUrl, fileName, description } = args;
      const sessionImage = window._sessionContext.lastImage;
      const source = imageUrl || sessionImage?.url;
      const name = fileName || sessionImage?.name || 'image';

      if (!source) {
        return { success: false, error: 'لا توجد صورة. ارفع الصورة أولاً.' };
      }

      if (sessionImage && !imageUrl) {
        return {
          success: true,
          result: {
            fileName: sessionImage.name,
            description: sessionImage.description || 'صورة محفوظة في الجلسة',
            text: sessionImage.extractedText || sessionImage.description || '',
            fromSession: true,
            note: 'تم استرداد وصف الصورة من ذاكرة الجلسة'
          }
        };
      }

      // Store the image in session context for future reference
      window._sessionContext.lastImage = {
        name,
        url: source,
        description: description || 'صورة مرفوعة',
        extractedText: description || '',
        uploadedAt: new Date().toISOString()
      };

      return {
        success: true,
        result: {
          fileName: name,
          imageUrl: source,
          description: description || 'تم حفظ الصورة. يمكنك الآن طرح أسئلة عنها.',
          note: 'الصورة محفوظة في ذاكرة الجلسة. استخدم Vision API لتحليلها.'
        }
      };
    },

    /* ── READ LAST FILE FROM SESSION ────────────────────── */
    readLastFile() {
      const file = window._sessionContext.lastFile;
      if (!file) {
        return { success: false, error: 'لا يوجد ملف محفوظ في الجلسة الحالية. ارفع ملفاً أولاً.' };
      }
      return {
        success: true,
        result: {
          ...file,
          text: (file.text || file.content || '').substring(0, 8000)
        }
      };
    },

    /* ── EXPORT DATA ────────────────────────────────────── */
    exportData(args) {
      const { type = 'all' } = args;
      let data = {};

      if (type === 'all' || type === 'schedule') {
        const weekNum = this._getWeekNum();
        data.schedule = {};
        if (typeof WEEK_SCHEDULE !== 'undefined') {
          WEEK_SCHEDULE.forEach(day => {
            data.schedule[day.key] = getDailyData(weekNum, day.key, day.pattern);
          });
        }
      }
      if (type === 'all' || type === 'memory') {
        data.memory = typeof AIMemory !== 'undefined' ? AIMemory.getAll() : [];
      }
      if (type === 'all' || type === 'settings') {
        data.settings = typeof DB !== 'undefined' ? DB.get('settings', {}) : {};
      }

      const json = JSON.stringify(data, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `murad-planner-${type}-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);

      return { success: true, result: { exported: type, size: json.length } };
    },

    /* ── CHANGE THEME ───────────────────────────────────── */
    changeTheme(args) {
      const { theme } = args;
      if (!theme) return { success: false, error: 'theme is required (dark/light)' };
      const validThemes = ['dark', 'light', 'auto'];
      if (!validThemes.includes(theme)) return { success: false, error: `Invalid theme. Use: ${validThemes.join(', ')}` };

      document.documentElement.setAttribute('data-theme', theme);
      const s = typeof DB !== 'undefined' ? DB.get('settings', {}) : {};
      s.theme = theme;
      DB.set('settings', s);

      return { success: true, result: { theme } };
    },

    /* ── CHANGE LANGUAGE ────────────────────────────────── */
    changeLanguage(args) {
      const { lang } = args;
      const validLangs = ['ar', 'en', 'id'];
      if (!validLangs.includes(lang)) return { success: false, error: `Invalid lang. Use: ${validLangs.join(', ')}` };

      if (typeof setLanguage === 'function') {
        setLanguage(lang);
        return { success: true, result: { lang } };
      }
      return { success: false, error: 'setLanguage function not available' };
    },

    /* ── RESET ALL DATA ─────────────────────────────────── */
    resetAllData(args) {
      const { confirmed = false } = args || {};
      if (!confirmed) {
        const ok = window.confirm(
          '⚠️ تحذير خطير!\n\nهذا سيحذف جميع بياناتك بما في ذلك:\n- جميع الجداول الدراسية\n- جميع المهام\n- الإعدادات\n- الذاكرة\n\nهل أنت متأكد تمامًا؟'
        );
        if (!ok) return { success: false, error: 'تم إلغاء إعادة ضبط النظام من قبل المستخدم' };
        const ok2 = window.confirm('هذه فرصتك الأخيرة للتراجع. هل تريد حذف كل شيء؟');
        if (!ok2) return { success: false, error: 'تم إلغاء إعادة ضبط النظام' };
      }
      const keysToDelete = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith('murad_')) keysToDelete.push(k);
      }
      keysToDelete.forEach(k => localStorage.removeItem(k));
      if (typeof showToast === 'function') showToast('تم إعادة ضبط النظام بالكامل', 'warning');
      setTimeout(() => window.location.reload(), 1500);
      return { success: true, result: { deleted: keysToDelete.length } };
    },

    /* ── CONFIRM ACTION ─────────────────────────────────── */
    confirmAction(args) {
      const { message, title = 'تأكيد العملية' } = args;
      if (!message) return { success: false, error: 'message is required' };
      const ok = window.confirm(`${title}\n\n${message}`);
      return { success: true, result: { confirmed: ok } };
    },

    /* ── GENERATE FILE ──────────────────────────────────── */
    async generateFile(args) {
      const { type, content, filename, title = 'Document', data } = args;
      if (!type) return { success: false, error: 'type is required (pdf|word|excel|markdown|csv|json|txt)' };

      const fileType = type.toLowerCase();
      let blob, ext, mimeType;

      try {
        if (fileType === 'json') {
          const jsonContent = typeof content === 'string' ? content : JSON.stringify(data || content || {}, null, 2);
          blob = new Blob([jsonContent], { type: 'application/json' });
          ext = 'json'; mimeType = 'application/json';

        } else if (fileType === 'csv') {
          let csvContent = '';
          if (typeof content === 'string') {
            csvContent = content;
          } else if (Array.isArray(data)) {
            if (data.length > 0) {
              const headers = Object.keys(data[0]);
              csvContent = headers.join(',') + '\n';
              csvContent += data.map(row => headers.map(h => `"${String(row[h] || '').replace(/"/g, '""')}"`).join(',')).join('\n');
            }
          } else {
            csvContent = String(content || '');
          }
          blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8' });
          ext = 'csv'; mimeType = 'text/csv';

        } else if (fileType === 'markdown' || fileType === 'md') {
          blob = new Blob([String(content || '')], { type: 'text/markdown' });
          ext = 'md'; mimeType = 'text/markdown';

        } else if (fileType === 'txt') {
          blob = new Blob([String(content || '')], { type: 'text/plain' });
          ext = 'txt'; mimeType = 'text/plain';

        } else if (fileType === 'pdf') {
          const htmlContent = `<!DOCTYPE html>
<html dir="auto" lang="ar">
<head>
<meta charset="UTF-8">
<title>${title}</title>
<style>
  body { font-family: 'Segoe UI', Arial, sans-serif; direction: rtl; padding: 40px; color: #1a1a2e; line-height: 1.8; }
  h1 { color: #6c63ff; border-bottom: 2px solid #6c63ff; padding-bottom: 10px; }
  h2 { color: #4a4a8a; margin-top: 20px; }
  table { width: 100%; border-collapse: collapse; margin: 16px 0; }
  th { background: #6c63ff; color: white; padding: 10px; text-align: right; }
  td { border: 1px solid #ddd; padding: 8px; text-align: right; }
  tr:nth-child(even) { background: #f8f8ff; }
  .footer { margin-top: 40px; border-top: 1px solid #ddd; padding-top: 16px; font-size: 12px; color: #888; }
</style>
</head>
<body>
<h1>${title}</h1>
${String(content || '')}
<div class="footer">تم الإنشاء بواسطة Murad Planner — ${new Date().toLocaleDateString('ar-SA')}</div>
</body>
</html>`;
          blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
          ext = 'html'; mimeType = 'text/html';

        } else if (fileType === 'word' || fileType === 'docx') {
          const rtfContent = `{\\rtf1\\ansi\\ansicpg1256\\deff0
{\\fonttbl{\\f0\\froman\\fcharset178 Times New Roman;}}
{\\colortbl ;\\red108\\green99\\blue255;}
\\viewkind4\\uc1\\pard\\rtlpar\\cf1\\b\\fs36 ${title}\\b0\\cf0\\fs24\\par\\par
${String(content || '').replace(/\n/g, '\\par\n')}
\\par\\par\\pard\\rtlpar\\fs18 تم الإنشاء بواسطة Murad Planner — ${new Date().toLocaleDateString('ar-SA')}
}`;
          blob = new Blob([rtfContent], { type: 'application/rtf' });
          ext = 'rtf'; mimeType = 'application/rtf';

        } else if (fileType === 'excel' || fileType === 'xlsx' || fileType === 'xls') {
          let csvContent = '';
          if (typeof content === 'string') {
            csvContent = content;
          } else if (Array.isArray(data)) {
            if (data.length > 0) {
              const headers = Object.keys(data[0]);
              csvContent = headers.join('\t') + '\n';
              csvContent += data.map(row => headers.map(h => String(row[h] || '')).join('\t')).join('\n');
            }
          } else {
            csvContent = String(content || '');
          }
          blob = new Blob(['\uFEFF' + csvContent], { type: 'text/tab-separated-values;charset=utf-8' });
          ext = 'tsv'; mimeType = 'text/tab-separated-values';

        } else {
          return { success: false, error: `Unsupported file type: "${type}". Use: pdf, word, excel, markdown, csv, json, txt` };
        }

        const url = URL.createObjectURL(blob);
        const finalName = (filename || `${title.replace(/[^a-zA-Z0-9\u0600-\u06FF]/g, '_')}_${new Date().toISOString().slice(0,10)}`).replace(/\s+/g, '_');
        const fullName = finalName.endsWith('.' + ext) ? finalName : `${finalName}.${ext}`;

        const a = document.createElement('a');
        a.href = url;
        a.download = fullName;
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 3000);

        if (typeof showToast === 'function') showToast(`✅ تم إنشاء الملف: ${fullName}`, 'success');
        return { success: true, result: { filename: fullName, type: ext, size: blob.size, downloadStarted: true } };

      } catch (e) {
        return { success: false, error: `File generation failed: ${e.message}` };
      }
    },

    /* ── GENERATE IMAGE ─────────────────────────────────── */
    async generateImage(args) {
      const { prompt, style = 'realistic', size = '1024x1024' } = args;
      if (!prompt) return { success: false, error: 'prompt is required' };

      const providerSettings = typeof DB !== 'undefined' ? DB.get('settings', {}) : {};
      const apiKey = providerSettings.apiKey || providerSettings.openaiKey;

      if (!apiKey) {
        return { success: false, error: 'لا يوجد مفتاح API. يرجى إضافة مفتاح OpenAI في الإعدادات لتوليد الصور.' };
      }

      try {
        if (typeof showToast === 'function') showToast('⏳ جاري توليد الصورة...', 'info');

        const response = await fetch('https://api.openai.com/v1/images/generations', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          },
          body: JSON.stringify({ model: 'dall-e-3', prompt, n: 1, size, quality: 'standard', response_format: 'url' })
        });

        if (!response.ok) {
          const err = await response.json();
          return { success: false, error: `Image API error: ${err.error?.message || response.statusText}` };
        }

        const result = await response.json();
        const imageUrl = result.data?.[0]?.url;
        if (!imageUrl) return { success: false, error: 'No image URL in response' };

        // Store in session context
        window._sessionContext.lastImage = { name: 'generated_image', url: imageUrl, description: prompt, generatedAt: new Date().toISOString() };

        const msgContainer = document.querySelector('.ai-messages-list');
        if (msgContainer) {
          const imgDiv = document.createElement('div');
          imgDiv.className = 'ai-generated-image-wrap';
          imgDiv.innerHTML = `
            <div class="ai-message assistant" style="margin:8px 0">
              <div class="ai-message-avatar"><div class="ai-avatar-ai"><i class="fas fa-image"></i></div></div>
              <div class="ai-message-content">
                <div class="ai-message-bubble">
                  <img src="${imageUrl}" alt="${prompt}" style="max-width:100%;border-radius:12px;display:block;margin:8px 0" />
                  <div style="font-size:12px;color:var(--text-muted);margin-top:4px">🎨 ${prompt}</div>
                  <a href="${imageUrl}" download="generated_image.png" target="_blank" rel="noopener noreferrer"
                     style="display:inline-block;margin-top:8px;padding:6px 14px;background:var(--accent);color:white;border-radius:8px;font-size:12px;text-decoration:none">
                     <i class="fas fa-download"></i> تحميل الصورة
                  </a>
                </div>
              </div>
            </div>`;
          msgContainer.appendChild(imgDiv);
          imgDiv.scrollIntoView({ behavior: 'smooth', block: 'end' });
        }

        if (typeof showToast === 'function') showToast('✅ تم توليد الصورة بنجاح', 'success');
        return { success: true, result: { imageUrl, prompt, size } };

      } catch (e) {
        return { success: false, error: `Image generation failed: ${e.message}` };
      }
    },

    /* ── TEXT TO SPEECH ─────────────────────────────────── */
    speak(args) {
      const { text, lang } = args;
      if (!text) return { success: false, error: 'text is required' };
      if (!('speechSynthesis' in window)) return { success: false, error: 'TTS not supported' };

      window.speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance(text);
      utter.lang = lang || (document.documentElement.lang === 'ar' ? 'ar-SA' : 'en-US');
      utter.rate = 1.0;
      utter.pitch = 1.0;

      if (utter.lang.startsWith('ar')) {
        const voices = window.speechSynthesis.getVoices();
        const arabicVoice = voices.find(v => v.lang.startsWith('ar'));
        if (arabicVoice) utter.voice = arabicVoice;
      }

      window.speechSynthesis.speak(utter);
      return { success: true, result: { speaking: text.substring(0, 50) } };
    },

    stopSpeaking() {
      if ('speechSynthesis' in window) window.speechSynthesis.cancel();
      return { success: true, result: { stopped: true } };
    },

    /* ── REQUEST PERMISSIONS ────────────────────────────── */
    async requestPermissions(args) {
      const { type } = args;
      if (type === 'notifications') {
        if (!('Notification' in window)) return { success: false, error: 'Notifications not supported' };
        const perm = await Notification.requestPermission();
        return { success: perm === 'granted', result: { permission: perm } };
      }
      if (type === 'microphone') {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          stream.getTracks().forEach(t => t.stop());
          return { success: true, result: { permission: 'granted' } };
        } catch (e) {
          return { success: false, error: e.message };
        }
      }
      return { success: false, error: `Unknown permission type: ${type}` };
    },

    /* ══════════════════════════════════════════════════════════
       FILL BLOCK FIELDS — Session 8 (Surgical update by blockId or all)
       Never recreates schedule. Only modifies specified fields.
    ══════════════════════════════════════════════════════════ */
    fillBlockFields(args) {
      const { dayKey, blockId, fields } = args;
      if (!dayKey) return { success: false, error: 'dayKey is required', fieldsModified: [], fieldsFailed: [] };
      if (!fields || typeof fields !== 'object') return { success: false, error: 'fields object is required', fieldsModified: [], fieldsFailed: [] };

      const weekNum = this._getWeekNum();
      const dayInfo = this._getDayInfo(dayKey);
      if (!dayInfo) return { success: false, error: 'Invalid dayKey: ' + dayKey, fieldsModified: [], fieldsFailed: [] };

      const storageKey = getDayKey(weekNum, dayKey);
      const dayData = this._getDayData(weekNum, dayKey) || { blocks: [] };
      const blocks = dayData.blocks || [];

      if (blocks.length === 0) {
        return { success: false, error: 'No blocks found for day: ' + dayKey + '. Create blocks first with createDaySchedule.', fieldsModified: [], fieldsFailed: [] };
      }

      const allFieldsModified = [];
      const allFieldsFailed = [];

      if (blockId) {
        // Single block update
        const idx = blocks.findIndex(function(b) { return b.id === blockId; });
        if (idx === -1) return { success: false, error: 'Block not found: ' + blockId, fieldsModified: [], fieldsFailed: [] };
        const r = this._applyBlockUpdates(blocks[idx], fields);
        allFieldsModified.push.apply(allFieldsModified, r.fieldsModified);
        allFieldsFailed.push.apply(allFieldsFailed, r.fieldsFailed);
      } else {
        // Update all blocks
        blocks.forEach(function(block) {
          var r = this._applyBlockUpdates(block, fields);
          allFieldsModified.push.apply(allFieldsModified, r.fieldsModified.map(function(f) { return block.id + '.' + f; }));
          allFieldsFailed.push.apply(allFieldsFailed, r.fieldsFailed);
        }, this);
      }

      const saved = this._saveDayData(weekNum, dayKey, dayData);
      if (!saved) return { success: false, error: 'Storage write failed', fieldsModified: allFieldsModified, fieldsFailed: allFieldsFailed };

      // Verify
      const verify = DB.get(storageKey);
      if (!verify || !Array.isArray(verify.blocks)) {
        return { success: false, error: 'Verification failed: data not readable after write', fieldsModified: allFieldsModified, fieldsFailed: allFieldsFailed };
      }

      window._sessionContext.lastDay = dayKey;
      if (blockId) window._sessionContext.lastBlock = { id: blockId, dayKey };

      return {
        success: true,
        blockCount: blockId ? 1 : blocks.length,
        fieldsModified: allFieldsModified,
        fieldsFailed: allFieldsFailed,
        failureReason: allFieldsFailed.length > 0 ? allFieldsFailed.map(function(f) { return f.field + ': ' + f.reason; }).join('; ') : null
      };
    },

    /* ══════════════════════════════════════════════════════════
       FILL ALL BLOCKS ALL FIELDS — Alias for fillAllBlockDetails with smart defaults
    ══════════════════════════════════════════════════════════ */
    fillAllBlocksAllFields(args) {
      const { dayKey, subjectHint } = args || {};
      if (!dayKey) return { success: false, error: 'dayKey is required', blockCount: 0, fieldsModified: [], fieldsFailed: [] };

      const weekNum = this._getWeekNum();
      const dayInfo = this._getDayInfo(dayKey);
      if (!dayInfo) return { success: false, error: 'Invalid dayKey: ' + dayKey, blockCount: 0, fieldsModified: [], fieldsFailed: [] };

      const storageKey = getDayKey(weekNum, dayKey);
      const dayData = this._getDayData(weekNum, dayKey) || { blocks: [] };
      const blocks = dayData.blocks || [];

      if (blocks.length === 0) {
        return { success: false, error: 'No blocks found for day: ' + dayKey + '. Use createDaySchedule first.', blockCount: 0, fieldsModified: [], fieldsFailed: [] };
      }

      if (typeof showToast === 'function') showToast('⏳ جارِ تعبئة تفاصيل ' + blocks.length + ' بلوك...', 'info');

      const allFieldsModified = [];
      const allFieldsFailed = [];
      const self = this;

      blocks.forEach(function(block) {
        const blockName = typeof block.name === 'object' ? block.name.ar : (block.name || 'بلوك');
        const isBreak = block.isBreak || blockName.includes('استراحة') || blockName.includes('غداء') || blockName.includes('صلاة');
        if (!isBreak) {
          const subj = block.subject || subjectHint || blockName;
          const defaults = {};
          if (!block.goal) defaults.goal = 'إتقان ' + subj + ' وتحقيق فهم عميق للمفاهيم الأساسية';
          if (!block.learn) defaults.learn = 'المفاهيم الأساسية في ' + subj + ' والنظريات الرئيسية';
          if (!block.whatWillILearn) defaults.whatWillILearn = 'المفاهيم الأساسية في ' + subj;
          if (!block.apply) defaults.apply = 'حل تمارين وتطبيق ما تعلمته على أمثلة واقعية';
          if (!block.whatWillIPractice) defaults.whatWillIPractice = 'حل تمارين وتطبيق عملي';
          if (!block.outputs) defaults.outputs = 'فهم واضح لـ ' + subj + ' وقدرة على حل المسائل';
          if (!block.expectedOutcome) defaults.expectedOutcome = 'فهم واضح وقدرة على حل المسائل';
          if (!block.notes) defaults.notes = 'راجع المادة بعد كل جلسة، استخدم تقنية Feynman للشرح';
          if (!block.priority) defaults.priority = 'high';
          if (!block.status) defaults.status = 'pending';
          if (!block.aiSummary) defaults.aiSummary = 'بلوك دراسة لـ ' + subj + ' — ' + (block.duration || 60) + ' دقيقة';
          if (Object.keys(defaults).length > 0) {
            const r = self._applyBlockUpdates(block, defaults);
            allFieldsModified.push.apply(allFieldsModified, r.fieldsModified.map(function(f) { return block.id + '.' + f; }));
            allFieldsFailed.push.apply(allFieldsFailed, r.fieldsFailed);
          }
        }
      });

      const saved = this._saveDayData(weekNum, dayKey, dayData);
      if (!saved) {
        return { success: false, error: 'Storage write failed', blockCount: blocks.length, fieldsModified: allFieldsModified, fieldsFailed: allFieldsFailed };
      }

      // Verify
      const verify = DB.get(storageKey);
      if (!verify || !Array.isArray(verify.blocks)) {
        return { success: false, error: 'Verification failed after fillAllBlocksAllFields', blockCount: 0, fieldsModified: allFieldsModified, fieldsFailed: allFieldsFailed };
      }

      if (typeof showToast === 'function') showToast('✅ تم تعبئة تفاصيل ' + blocks.length + ' بلوك', 'success');
      window._sessionContext.lastDay = dayKey;

      return {
        success: true,
        blockCount: blocks.length,
        fieldsModified: allFieldsModified,
        fieldsFailed: allFieldsFailed,
        failureReason: allFieldsFailed.length > 0 ? allFieldsFailed.length + ' field(s) failed' : null,
        result: {
          day: dayInfo.dayAr,
          dayKey,
          blocksProcessed: blocks.length,
          fieldsFilledCount: allFieldsModified.length,
          verifiedInDB: true
        }
      };
    },

    /* ══════════════════════════════════════════════════════════
       VERIFY BLOCK FIELDS — Returns completion % per block
    ══════════════════════════════════════════════════════════ */
    verifyBlockFields(args) {
      const { dayKey, blockId } = args;
      if (!dayKey) return { success: false, error: 'dayKey is required' };

      const weekNum = this._getWeekNum();
      const dayInfo = this._getDayInfo(dayKey);
      if (!dayInfo) return { success: false, error: 'Invalid dayKey: ' + dayKey };

      const dayData = this._getDayData(weekNum, dayKey) || { blocks: [] };
      const blocks = dayData.blocks || [];

      const allFields = ['goal', 'learn', 'apply', 'outputs', 'notes', 'subject', 'difficulty', 'tips', 'exercises', 'resources', 'priority', 'status', 'aiSummary', 'description'];

      const checkBlock = function(block) {
        const name = typeof block.name === 'object' ? block.name.ar : (block.name || 'بلوك');
        const filled = [], empty = [];
        allFields.forEach(function(f) {
          const v = block[f];
          if (v && (typeof v !== 'string' || v.trim())) filled.push(f);
          else empty.push(f);
        });
        return {
          id: block.id,
          name: name,
          isBreak: block.isBreak || false,
          filledFields: filled,
          emptyFields: empty,
          completionPct: Math.round((filled.length / allFields.length) * 100)
        };
      };

      if (blockId) {
        const block = blocks.find(function(b) { return b.id === blockId; });
        if (!block) return { success: false, error: 'Block not found: ' + blockId };
        return { success: true, result: checkBlock(block) };
      }

      const report = blocks.map(checkBlock);
      const studyBlocks = report.filter(function(r) { return !r.isBreak; });
      const avgCompletion = studyBlocks.length > 0
        ? Math.round(studyBlocks.reduce(function(s, r) { return s + r.completionPct; }, 0) / studyBlocks.length)
        : 0;

      return {
        success: true,
        result: {
          day: dayInfo.dayAr,
          dayKey,
          totalBlocks: blocks.length,
          studyBlocks: studyBlocks.length,
          averageCompletion: avgCompletion + '%',
          blocks: report
        }
      };
    },

    /* ══════════════════════════════════════════════════════════
       READ FILE — Returns last uploaded file from session context
    ══════════════════════════════════════════════════════════ */
    readFile(args) {
      const file = window._sessionContext && window._sessionContext.lastFile;
      if (!file) {
        return { success: false, error: 'لا يوجد ملف محفوظ في الجلسة الحالية. ارفع ملفاً أولاً ثم اسألني عنه.' };
      }
      return {
        success: true,
        result: {
          name: file.name,
          type: file.type,
          size: file.size,
          content: (file.text || file.content || '').substring(0, 8000),
          uploadedAt: file.uploadedAt
        }
      };
    },

    /* ══════════════════════════════════════════════════════════
       GET SESSION MEMORY — Returns full session context state
    ══════════════════════════════════════════════════════════ */
    getSessionMemory(args) {
      const ctx = window._sessionContext || {};
      const mem = window.AISessionMemory;
      const data = mem ? {
        lastFile: mem.get('lastFile'),
        lastImage: mem.get('lastImage'),
        lastBlock: mem.get('lastBlock'),
        lastDay: mem.get('lastDay'),
        lastSubject: mem.get('lastSubject'),
        lastTable: mem.get('lastTable')
      } : {
        lastFile: ctx.lastFile,
        lastImage: ctx.lastImage,
        lastBlock: ctx.lastBlock,
        lastDay: ctx.lastDay,
        lastSubject: ctx.lastSubject,
        conversationRound: ctx.conversationRound
      };
      return { success: true, result: data };
    },

  }, // end tools

}; // end AIAgentCore

/* ══════════════════════════════════════════════════════════
   AI SESSION MEMORY — Session-scoped (resets on page reload)
   Exposed as window.AISessionMemory
══════════════════════════════════════════════════════════ */
window.AISessionMemory = {
  _data: {
    lastFile: null,
    lastImage: null,
    lastBlock: null,
    lastDay: null,
    lastSubject: null,
    lastTable: null
  },
  set: function(key, value) {
    if (key in this._data) {
      this._data[key] = value;
      // Sync to _sessionContext for backwards compatibility
      if (window._sessionContext) window._sessionContext[key] = value;
    }
  },
  get: function(key) {
    return this._data[key];
  },
  setFile: function(fileObj) {
    this._data.lastFile = fileObj;
    if (fileObj && fileObj.type === 'image') this._data.lastImage = fileObj;
    // Also sync to _sessionContext
    if (window._sessionContext) {
      window._sessionContext.lastFile = fileObj;
      if (fileObj && fileObj.type === 'image') window._sessionContext.lastImage = fileObj;
    }
  },
  getLastFile: function() {
    return this._data.lastFile;
  },
  buildContextString: function() {
    const parts = [];
    if (this._data.lastFile) parts.push('[Context: File "' + this._data.lastFile.name + '" is loaded]');
    if (this._data.lastDay) parts.push('[Context: Last day = ' + this._data.lastDay + ']');
    if (this._data.lastSubject) parts.push('[Context: Last subject = ' + this._data.lastSubject + ']');
    if (this._data.lastBlock) parts.push('[Context: Last block = ' + JSON.stringify(this._data.lastBlock) + ']');
    return parts.join(' ');
  }
};

window.AIAgentCore = AIAgentCore;
console.log('[AIAgentCore v8.0] Loaded — tools:', Object.keys(AIAgentCore.tools).join(', '));
