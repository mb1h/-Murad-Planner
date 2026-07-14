/* ============================================================
   AI MEMORY ENGINE v1.0
   3-Layer Long-Term Memory Architecture

   Layer 1 — Working Memory   : Last 10 messages + current context (in-memory only)
   Layer 2 — Session Memory   : Current session's tables/files/edits/blocks (window-level)
   Layer 3 — Long-Term Memory : User interests/projects/subjects/preferences/goals (localStorage)
   ============================================================ */

(function () {
  'use strict';

  /* ══════════════════════════════════════════════════════════════
     LAYER 3 — LONG-TERM MEMORY (localStorage, persists forever)
     Stores: user profile, interests, subjects, language prefs,
             daily hours, goals, past schedules, important facts
  ══════════════════════════════════════════════════════════════ */
  const LTM_KEY = 'murad_ltm_v1';
  const LTM_MAX_ENTRIES = 200;

  const LongTermMemory = {
    _data: null,

    _load() {
      if (this._data) return this._data;
      try {
        const raw = localStorage.getItem(LTM_KEY);
        this._data = raw ? JSON.parse(raw) : {
          profile: {},         // user profile facts
          subjects: {},        // subject-specific memories
          preferences: {},     // UI/language/style prefs
          history: [],         // chronological fact entries (max 200)
          projects: [],        // ongoing projects/goals
          achievements: [],    // milestones reached
          lastUpdated: null
        };
      } catch (e) {
        console.error('[LongTermMemory] Load error:', e);
        this._data = { profile: {}, subjects: {}, preferences: {}, history: [], projects: [], achievements: [], lastUpdated: null };
      }
      return this._data;
    },

    _save() {
      try {
        if (this._data) {
          this._data.lastUpdated = new Date().toISOString();
          localStorage.setItem(LTM_KEY, JSON.stringify(this._data));
        }
      } catch (e) {
        console.error('[LongTermMemory] Save error:', e);
      }
    },

    /**
     * Save a fact to long-term memory.
     * @param {string} category - 'profile'|'subject'|'preference'|'project'|'achievement'|'general'
     * @param {string} key - unique key within category
     * @param {*} value - the value to store
     * @param {object} [meta] - optional metadata {source, confidence, tags}
     */
    set(category, key, value, meta = {}) {
      const d = this._load();
      const entry = {
        id: `ltm_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        category,
        key,
        value,
        timestamp: new Date().toISOString(),
        source: meta.source || 'ai',
        confidence: meta.confidence || 'high',
        tags: meta.tags || []
      };

      // Update structured sections
      if (category === 'profile') {
        d.profile[key] = value;
      } else if (category === 'subject') {
        if (!d.subjects[key]) d.subjects[key] = {};
        d.subjects[key] = { ...d.subjects[key], ...( typeof value === 'object' ? value : { info: value }) };
      } else if (category === 'preference') {
        d.preferences[key] = value;
      } else if (category === 'project') {
        const idx = d.projects.findIndex(p => p.key === key);
        if (idx >= 0) d.projects[idx] = { key, value, updatedAt: entry.timestamp };
        else d.projects.push({ key, value, createdAt: entry.timestamp });
      } else if (category === 'achievement') {
        d.achievements.push({ key, value, timestamp: entry.timestamp });
      }

      // Add to chronological history
      d.history.unshift(entry);
      if (d.history.length > LTM_MAX_ENTRIES) {
        d.history = d.history.slice(0, LTM_MAX_ENTRIES);
      }

      this._save();
      return entry;
    },

    /**
     * Get a specific fact
     */
    get(category, key) {
      const d = this._load();
      if (category === 'profile') return d.profile[key];
      if (category === 'subject') return d.subjects[key];
      if (category === 'preference') return d.preferences[key];
      if (category === 'project') return d.projects.find(p => p.key === key)?.value;
      return null;
    },

    /**
     * Get a compact summary for injection into the system prompt.
     * Only returns high-value facts to save tokens.
     */
    getSummaryForPrompt() {
      const d = this._load();
      const lines = [];

      // Profile facts
      if (d.profile.name) lines.push(`اسم المستخدم: ${d.profile.name}`);
      if (d.profile.language) lines.push(`اللغة المفضلة: ${d.profile.language}`);
      if (d.profile.dailyHours) lines.push(`ساعات الدراسة اليومية: ${d.profile.dailyHours} ساعة`);
      if (d.profile.level) lines.push(`المستوى: ${d.profile.level}`);
      if (d.profile.goal) lines.push(`الهدف الرئيسي: ${d.profile.goal}`);
      if (d.profile.preferredExplanationStyle) lines.push(`طريقة الشرح المفضلة: ${d.profile.preferredExplanationStyle}`);

      // Subjects being studied
      const subjectKeys = Object.keys(d.subjects);
      if (subjectKeys.length > 0) {
        lines.push(`المواد الدراسية: ${subjectKeys.join(', ')}`);
        subjectKeys.slice(0, 3).forEach(subj => {
          const info = d.subjects[subj];
          if (info.currentTopic) lines.push(`  • ${subj}: يدرس حالياً ${info.currentTopic}`);
          if (info.level) lines.push(`  • ${subj}: مستوى ${info.level}`);
        });
      }

      // Preferences
      if (d.preferences.responseLanguage) lines.push(`لغة الردود: ${d.preferences.responseLanguage}`);
      if (d.preferences.explanationDepth) lines.push(`عمق الشرح المطلوب: ${d.preferences.explanationDepth}`);
      if (d.preferences.scheduleStyle) lines.push(`أسلوب الجدول: ${d.preferences.scheduleStyle}`);

      // Active projects
      if (d.projects.length > 0) {
        const activeProjects = d.projects.slice(0, 3);
        lines.push(`المشاريع الحالية: ${activeProjects.map(p => p.key).join(', ')}`);
      }

      // Recent important facts (last 5 high-confidence entries)
      const recentFacts = d.history
        .filter(h => h.confidence === 'high' && h.category !== 'preference')
        .slice(0, 5);
      if (recentFacts.length > 0) {
        lines.push('حقائق مهمة محفوظة:');
        recentFacts.forEach(f => {
          const val = typeof f.value === 'string' ? f.value : JSON.stringify(f.value).substring(0, 80);
          lines.push(`  • ${f.key}: ${val}`);
        });
      }

      return lines.join('\n') || 'لا توجد ذاكرة طويلة المدى بعد';
    },

    /**
     * Get full data for context (used only when specifically needed)
     */
    getAll() {
      return this._load();
    },

    /**
     * Search memory for relevant facts given a query
     */
    search(query) {
      const d = this._load();
      const q = query.toLowerCase();
      return d.history.filter(h => {
        const val = typeof h.value === 'string' ? h.value : JSON.stringify(h.value);
        return h.key.toLowerCase().includes(q) ||
               val.toLowerCase().includes(q) ||
               (h.tags || []).some(t => t.toLowerCase().includes(q));
      }).slice(0, 10);
    },

    /**
     * Clear all long-term memory
     */
    clear() {
      this._data = null;
      localStorage.removeItem(LTM_KEY);
    }
  };


  /* ══════════════════════════════════════════════════════════════
     LAYER 2 — SESSION MEMORY (window-level, survives page nav)
     Stores: current session's files, schedule changes, block edits,
             conversations summary, what was done this session
  ══════════════════════════════════════════════════════════════ */
  const SessionMemory = {
    _session: {
      sessionId: `sess_${Date.now()}`,
      startTime: new Date().toISOString(),

      // Files uploaded this session
      lastFile: null,        // last uploaded file {name, type, textContent, summary}
      files: [],             // all files uploaded this session

      // Schedule actions taken this session
      scheduleActions: [],   // [{action, dayKey, blockId, timestamp}]
      lastScheduleDay: null, // last day whose schedule was modified

      // Conversation context
      lastConvId: null,
      messageCount: 0,

      // Proactive advisor state
      advisorLastAnalysis: null,  // timestamp of last proactive analysis
      pendingSuggestions: [],     // suggestions not yet shown to user

      // Current activity
      currentSubject: null,
      currentTopic: null,
    },

    /**
     * Set or update a session value
     */
    set(key, value) {
      this._session[key] = value;
      // Also update window.AISessionMemory for backward compat
      if (window.AISessionMemory) window.AISessionMemory[key] = value;
    },

    get(key) {
      return this._session[key];
    },

    /**
     * Record a file upload
     */
    addFile(fileObj) {
      this._session.lastFile = fileObj;
      this._session.files.unshift(fileObj);
      if (this._session.files.length > 10) this._session.files = this._session.files.slice(0, 10);
    },

    /**
     * Record a schedule action
     */
    addScheduleAction(action) {
      this._session.scheduleActions.unshift({ ...action, timestamp: new Date().toISOString() });
      if (this._session.scheduleActions.length > 50) {
        this._session.scheduleActions = this._session.scheduleActions.slice(0, 50);
      }
      if (action.dayKey) this._session.lastScheduleDay = action.dayKey;
    },

    /**
     * Get a compact summary for injection into working prompt
     */
    getSummaryForPrompt() {
      const s = this._session;
      const lines = [];

      if (s.lastFile) {
        lines.push(`آخر ملف: ${s.lastFile.name} (${s.lastFile.type || 'ملف'})`);
        if (s.lastFile.summary) lines.push(`  ملخص: ${s.lastFile.summary.substring(0, 150)}`);
      }

      if (s.lastScheduleDay) {
        lines.push(`آخر يوم تم تعديله: ${s.lastScheduleDay}`);
      }

      if (s.scheduleActions.length > 0) {
        const recent = s.scheduleActions.slice(0, 3);
        lines.push(`آخر الإجراءات: ${recent.map(a => a.action).join(', ')}`);
      }

      if (s.currentSubject) {
        lines.push(`الموضوع الحالي: ${s.currentSubject}${s.currentTopic ? ' — ' + s.currentTopic : ''}`);
      }

      return lines.join('\n') || '';
    },

    getAll() {
      return { ...this._session };
    }
  };


  /* ══════════════════════════════════════════════════════════════
     LAYER 1 — WORKING MEMORY (in-memory only, last 10 messages)
     Managed by the conversation system, not stored here.
     This module provides the interface to access it.
  ══════════════════════════════════════════════════════════════ */
  const WorkingMemory = {
    _messages: [],
    _maxSize: 10,

    add(message) {
      this._messages.push({
        ...message,
        timestamp: new Date().toISOString()
      });
      if (this._messages.length > this._maxSize) {
        this._messages = this._messages.slice(-this._maxSize);
      }
    },

    getRecent(n = 10) {
      return this._messages.slice(-n);
    },

    clear() {
      this._messages = [];
    },

    getSummaryForPrompt() {
      // Working memory context is already injected via conversation history
      // This just provides access to non-conversation working context
      return '';
    }
  };


  /* ══════════════════════════════════════════════════════════════
     SMART CONTEXT BUILDER
     Before each AI call, builds a layered context injection:
     1. Long-term memory (user profile + subjects) — always included
     2. Session memory (last file + last day + recent actions) — always
     3. Working memory (recent messages) — handled by conversation history
  ══════════════════════════════════════════════════════════════ */
  const MemoryContextBuilder = {
    /**
     * Build the memory context block to inject into system prompt.
     * Optimized to minimize token usage while maximizing relevance.
     */
    build(options = {}) {
      const { includeLTM = true, includeSession = true, query = '' } = options;

      let sections = [];

      // Session Memory — always include (low token cost, high relevance)
      if (includeSession) {
        const sessionSummary = SessionMemory.getSummaryForPrompt();
        if (sessionSummary) {
          sections.push(`## ذاكرة الجلسة الحالية\n${sessionSummary}`);
        }
      }

      // Long-Term Memory — include profile + relevant subjects
      if (includeLTM) {
        const ltmSummary = LongTermMemory.getSummaryForPrompt();
        if (ltmSummary && ltmSummary !== 'لا توجد ذاكرة طويلة المدى بعد') {
          sections.push(`## الذاكرة الطويلة المدى\n${ltmSummary}`);
        }

        // If query provided, search for relevant memories
        if (query) {
          const relevant = LongTermMemory.search(query);
          if (relevant.length > 0) {
            const relLines = relevant.slice(0, 3).map(r => {
              const val = typeof r.value === 'string' ? r.value : JSON.stringify(r.value).substring(0, 80);
              return `  • ${r.key}: ${val}`;
            }).join('\n');
            sections.push(`## ذاكرة ذات صلة بالاستفسار\n${relLines}`);
          }
        }
      }

      return sections.join('\n\n');
    },

    /**
     * Auto-extract and save facts from AI conversation.
     * Called after each AI response to learn from the conversation.
     */
    learnFromConversation(userMsg, aiResponse) {
      try {
        const msg = (userMsg || '').toLowerCase();
        const resp = (aiResponse || '').toLowerCase();

        // Detect language preference
        if (msg.includes('بالعربي') || msg.includes('عربي') || msg.includes('arabic')) {
          LongTermMemory.set('preference', 'responseLanguage', 'Arabic');
        } else if (msg.includes('english') || msg.includes('بالانجليزي')) {
          LongTermMemory.set('preference', 'responseLanguage', 'English');
        }

        // Detect study hours
        const hoursMatch = msg.match(/(\d+)\s*(ساعة|ساعات|hours?)/i);
        if (hoursMatch && msg.includes('يومي')) {
          LongTermMemory.set('profile', 'dailyHours', hoursMatch[1]);
        }

        // Detect subjects
        const subjects = ['python', 'javascript', 'java', 'c++', 'laravel', 'react', 'رياضيات',
                          'فيزياء', 'كيمياء', 'برمجة', 'تصميم', 'إدارة', 'تسويق', 'طب', 'هندسة'];
        subjects.forEach(subj => {
          if (msg.includes(subj) || resp.includes(subj)) {
            LongTermMemory.set('subject', subj, { mentioned: true, lastSeen: new Date().toISOString() });
          }
        });
      } catch (e) {
        // Silent fail — memory learning is non-critical
      }
    }
  };


  /* ══════════════════════════════════════════════════════════════
     PROACTIVE STUDY ADVISOR
     Analyzes schedule data and offers suggestions without being asked
  ══════════════════════════════════════════════════════════════ */
  const ProactiveAdvisor = {
    _lastAnalysisTime: 0,
    _cooldownMs: 5 * 60 * 1000, // 5 minutes between analyses

    /**
     * Analyze the schedule and generate proactive suggestions.
     * Returns an array of suggestion objects or empty array.
     */
    analyze() {
      const now = Date.now();
      if (now - this._lastAnalysisTime < this._cooldownMs) return [];
      this._lastAnalysisTime = now;

      const suggestions = [];
      try {
        const weekData = window.DB?.get?.('weekSchedule') || {};
        const days = Object.entries(weekData);

        // 1. Check for empty days
        const emptyDays = days.filter(([, d]) => !d?.blocks || d.blocks.length === 0);
        if (emptyDays.length >= 2) {
          suggestions.push({
            type: 'empty_days',
            priority: 'high',
            message: `لاحظت أن ${emptyDays.length} أيام فارغة في الجدول. هل تريد أن أضع خطة لها؟`,
            action: 'suggest_fill_empty_days',
            data: { days: emptyDays.map(([k]) => k) }
          });
        }

        // 2. Check for missing review sessions
        const hasReview = days.some(([, d]) => {
          return d?.blocks?.some(b =>
            b.name?.toLowerCase().includes('مراجعة') ||
            b.name?.toLowerCase().includes('review') ||
            b.subject?.toLowerCase().includes('مراجعة')
          );
        });
        if (!hasReview && days.filter(([, d]) => d?.blocks?.length > 0).length >= 3) {
          suggestions.push({
            type: 'missing_review',
            priority: 'medium',
            message: 'لم أجد جلسات مراجعة في الجدول. المراجعة أساسية للتثبيت — هل تريد أن أضيفها؟',
            action: 'suggest_add_review'
          });
        }

        // 3. Check for subject imbalance
        const subjectTimes = {};
        days.forEach(([, d]) => {
          (d?.blocks || []).forEach(b => {
            if (b.isBreak) return;
            const subj = b.subject || b.name || 'غير محدد';
            subjectTimes[subj] = (subjectTimes[subj] || 0) + (b.duration || 60);
          });
        });
        const times = Object.values(subjectTimes);
        if (times.length >= 2) {
          const max = Math.max(...times);
          const min = Math.min(...times);
          const ratio = max / (min || 1);
          if (ratio > 3) {
            const dominant = Object.keys(subjectTimes).find(k => subjectTimes[k] === max);
            const weak = Object.keys(subjectTimes).find(k => subjectTimes[k] === min);
            suggestions.push({
              type: 'imbalance',
              priority: 'medium',
              message: `لاحظت أنك تركز كثيراً على ${dominant} وقليلاً على ${weak}. هل تريد أن أوازن الجدول؟`,
              action: 'suggest_balance',
              data: { dominant, weak }
            });
          }
        }

        // 4. Check for blocks with missing key fields
        let emptyBlockCount = 0;
        days.forEach(([, d]) => {
          (d?.blocks || []).forEach(b => {
            if (!b.isBreak && (!b.goal || !b.whatWillILearn)) emptyBlockCount++;
          });
        });
        if (emptyBlockCount >= 3) {
          suggestions.push({
            type: 'empty_fields',
            priority: 'low',
            message: `${emptyBlockCount} بلوك تحتاج تفاصيل (أهداف، محتوى). هل تريد أن أملأها تلقائياً؟`,
            action: 'suggest_fill_fields',
            data: { count: emptyBlockCount }
          });
        }

      } catch (e) {
        console.error('[ProactiveAdvisor] Error:', e);
      }

      SessionMemory.set('pendingSuggestions', suggestions);
      return suggestions;
    },

    /**
     * Get the most important pending suggestion as a chat message prefix
     */
    getTopSuggestionMessage() {
      const suggestions = SessionMemory.get('pendingSuggestions') || [];
      const top = suggestions.find(s => s.priority === 'high') || suggestions[0];
      if (!top) return '';
      return `\n\n💡 **ملاحظة:** ${top.message}`;
    }
  };


  /* ══════════════════════════════════════════════════════════════
     GLOBAL EXPORTS
  ══════════════════════════════════════════════════════════════ */
  window.AILongTermMemory = LongTermMemory;
  window.AISessionMemory = SessionMemory.getAll();  // backward compat object
  window.AISessionMemoryEngine = SessionMemory;
  window.AIWorkingMemory = WorkingMemory;
  window.AIMemoryContextBuilder = MemoryContextBuilder;
  window.AIProactiveAdvisor = ProactiveAdvisor;

  // Backward compatibility — old AIMemory API
  window.AIMemory = {
    add(entry) {
      return LongTermMemory.set(entry.category || 'general', entry.key || entry.content?.substring(0, 30), entry.content || entry.value, { source: entry.source || 'user' });
    },
    getAll() {
      return LongTermMemory.getAll().history.slice(0, 15).map(h => ({
        content: typeof h.value === 'string' ? `${h.key}: ${h.value}` : `${h.key}: ${JSON.stringify(h.value)}`,
        category: h.category,
        timestamp: h.timestamp
      }));
    },
    search(q) { return LongTermMemory.search(q); },
    clear() { LongTermMemory.clear(); }
  };

  console.log('[AIMemoryEngine] 3-Layer Memory System initialized ✅');

})();
