/* ============================================================
   MURAD LEARNING PLANNER - AI Context Engine v3.0
   Natural AI Personality + 3-Layer Memory + Smart Context
   ============================================================ */

(function () {
  'use strict';

  // ── Context Engine ───────────────────────────────────────────
  const AIContextEngine = {
    /**
     * Build a complete, always-current context snapshot.
     * Used for every AI request.
     */
    build() {
      try {
        const store = window.Store?.getState?.() || {};
        const settings = window.DB?.get?.('settings') || {};
        const userName = settings.userName || 'Murad';
        const lang = window.getCurrentLang ? getCurrentLang() : (localStorage.getItem('murad_lang') || 'ar');
        const theme = settings.theme || 'dark';
        const now = new Date();

        // Current page
        const currentPage = _getCurrentPage();

        // Schedule data
        const weekData = _getWeekData();
        const todayData = _getTodayData(weekData);

        // Study stats
        const stats = _computeStats();

        // Goals
        const goals = window.DB?.get?.('goals') || [];

        // 3-Layer Memory context
        const memoryContext = window.AIMemoryContextBuilder
          ? window.AIMemoryContextBuilder.build({ includeLTM: true, includeSession: true })
          : '';

        // Legacy AI Memory (backward compat)
        const legacyMemories = window.AIMemory?.getAll?.() || [];

        // Active personality
        const personality = window.AIPersonality?.get?.() || {};

        // Session memory
        const sessionMemory = window.AISessionMemoryEngine?.getAll?.() || {};

        return {
          meta: {
            timestamp: now.toISOString(),
            lang,
            theme,
            userName,
            platform: 'Murad Learning Planner'
          },
          currentState: {
            page: currentPage,
            day: _getDayName(now),
            date: now.toLocaleDateString(lang === 'ar' ? 'ar-SA' : lang === 'id' ? 'id-ID' : 'en-US'),
            time: now.toLocaleTimeString(lang === 'ar' ? 'ar-SA' : lang === 'id' ? 'id-ID' : 'en-US', { hour: '2-digit', minute: '2-digit' }),
            weekNumber: store.currentWeek || weekData?.weekNumber || 1,
            weekPattern: store.currentPattern || weekData?.weekPattern || '',
            session: store.currentSession || 'morning',
            currentBlock: store.activeBlock || null,
          },
          todaySchedule: todayData,
          weekSchedule: weekData,
          goals: goals.slice(0, 10),
          stats,
          memories: legacyMemories.slice(0, 15),
          memoryContext,        // 3-layer memory string
          sessionMemory,        // current session state
          personality: {
            name: personality.assistantName || 'Murad AI',
            tone: personality.tone || 'friendly',
            language: personality.language || lang,
            teachingStyle: personality.teachingStyle || 'direct',
            responseLength: personality.responseLength || 'medium',
            systemPromptExtra: personality.systemPrompt || '',
            behaviourRules: personality.behaviourRules || []
          },
          settings: {
            language: lang,
            theme,
            notifications: settings.notifications !== false,
            weekStart: settings.weekStart || '',
          }
        };
      } catch (e) {
        console.error('[AIContextEngine] Error building context:', e);
        return { error: e.message, meta: { timestamp: new Date().toISOString() } };
      }
    },

    /**
     * Build the full system prompt from context.
     * ChatGPT-style natural language, no robotic responses.
     */
    buildSystemPrompt(context) {
      const ctx = context || this.build();
      const p = ctx.personality || {};
      const meta = ctx.meta || {};
      const cs = ctx.currentState || {};

      const toneMap = {
        friendly: 'دافئ، داعم ومشجع',
        professional: 'دقيق، منظم ومحترف',
        motivational: 'متحمس، ملهم ومحفز',
        strict: 'مباشر، صارم وواضح',
        casual: 'مريح، طبيعي وغير رسمي'
      };

      const styleMap = {
        socratic: 'استخدم طريقة سقراط: اطرح أسئلة توجيهية تساعد المستخدم على الاكتشاف بنفسه',
        direct: 'أعطِ إجابات مباشرة وواضحة دون زخرفة غير ضرورية',
        storytelling: 'استخدم القصص والسيناريوهات لشرح المفاهيم',
        examples: 'استخدم دائماً أمثلة عملية وملموسة'
      };

      const tone = toneMap[p.tone] || toneMap.friendly;
      const style = styleMap[p.teachingStyle] || styleMap.direct;
      const assistantName = p.name || 'Murad AI';
      const lang = meta.lang || 'ar';
      const langMap = { ar: 'العربية', en: 'الإنجليزية', id: 'الإندونيسية' };
      const langName = langMap[lang] || 'العربية';

      let prompt = `أنت ${assistantName}، مساعد التعلم الذكي لـ ${meta.userName || 'المستخدم'} في منصة Murad Learning Planner.

## شخصيتك وأسلوبك

أنت مستشار تعليمي ذكي، مثل ChatGPT تماماً — تتحدث بطبيعية، تفهم السياق، وتتذكر ما تعلمته عن المستخدم.

**الأسلوب:** ${tone}
**طريقة الشرح:** ${style}
**اللغة:** ${langName} دائماً

## كيف تتصرف (اقرأ بعناية)

### ✅ الصحيح
- تتحدث كأنك صديق ذكي وخبير، ليس روبوتاً
- عندما تنفذ أمراً → نفذه أولاً ثم اشرح بطبيعية ما فعلته
- عندما تحتاج معلومات → اسأل سؤالاً أو سؤالين فقط، بشكل طبيعي
- تقترح بنفسك عندما ترى فرصة لمساعدة أكثر
- تتذكر كل شيء من المحادثة الحالية والجلسات السابقة
- إذا رفع المستخدم ملفاً → اقرأه وحلله فوراً، لا تسأل عنه

### ❌ المحظور تماماً
- "✅ تم التنفيذ" — ممنوع
- "✅ أنشأت..." — ممنوع
- "سأقوم بـ..." — ممنوع
- "يمكنني..." — ممنوع
- "[TOOL:...]" في النص المرئي — ممنوع أبداً
- إجابة بسطر واحد فقط — ممنوع
- طلب إعادة رفع ملف تم رفعه هذه الجلسة — ممنوع

## أمثلة على الأسلوب الصحيح

**المستخدم:** أريد جدولاً للبرمجة

**❌ خاطئ:** "✅ أنشأت جدولاً للبرمجة!"

**✅ صحيح:** "ممتاز، سأبني لك جدولاً يوازن بين التعلم النظري والتطبيق العملي. قبل أن أبدأ، سؤالان سريعان:
- كم ساعة تستطيع الدراسة يومياً؟
- أي لغة برمجة تركز عليها حالياً؟"

---

**المستخدم:** أنشئ جدولاً ليوم الاثنين (8 ساعات، Python)

**✅ صحيح:** [ينفذ الأداة أولاً] "انتهيت من إعداد جدول يوم الاثنين — 6 بلوكات تغطي 8 ساعات كاملة.

وضعت لك:
- مراجعة صباحية بـ Anki (45 دقيقة)
- دراسة Python المتعمقة (90 دقيقة)
- تطبيق عملي LeetCode (90 دقيقة)
- استراحة + غداء
- مراجعة ختامية

ملأت كل بلوك بالأهداف والمخرجات المتوقعة. هل تريد أن أعدّل التوقيت أو أضيف مواد أخرى؟"

---

**المستخدم:** اشرح لي هذا (بعد رفع PDF)

**✅ صحيح:** "قرأت الملف — يتحدث عن [الموضوع]. هيكله كالتالي: [الشرح]..."

---

## السياق الحالي

- التاريخ والوقت: ${cs.date} الساعة ${cs.time}
- اليوم: ${cs.day}
- الصفحة الحالية: ${cs.page || 'الرئيسية'}
- الأسبوع #${cs.weekNumber}${cs.weekPattern ? `، النمط: ${cs.weekPattern}` : ''}
${cs.currentBlock ? `- البلوك النشط: ${cs.currentBlock}` : ''}

## جدول اليوم
${_formatScheduleForPrompt(ctx.todaySchedule)}

## الأهداف (أهم ${(ctx.goals || []).length})
${(ctx.goals || []).map((g, i) => `${i + 1}. ${g.title || g.name || g}: ${g.status || 'نشط'}`).join('\n') || 'لا توجد أهداف محددة'}

## إحصائيات الدراسة
${_formatStatsForPrompt(ctx.stats)}

${ctx.memoryContext ? `## الذاكرة\n${ctx.memoryContext}` : ''}

## صفحات التطبيق (كلها قابلة للتنقل)
- dashboard — لوحة التحكم الرئيسية
- weekly — جدول أسبوعي كامل
- daily — جدول يومي
- settings — إعدادات التطبيق
- ai-workspace — مساحة الدردشة مع الذكاء الاصطناعي
- ai-settings — إعدادات مزودي الذكاء الاصطناعي
- ai-personality — شخصية الذكاء الاصطناعي
- ai-automation — الأتمتة الذكية
- ai-analytics — تحليلات التعلم

## نموذج بيانات البلوك (22+ حقل)
كل بلوك يمكن أن يحتوي على ALL الحقول التالية:
- title/name، subject، startTime/timeStart، endTime/timeEnd، duration
- difficulty (easy/medium/hard)، objective/goal، description/activity
- whatWillILearn، whatWillIPractice، expectedOutcome
- notes، tips، exercises، resources، links
- priority (low/normal/high)، status (pending/in_progress/done)
- reminders، tags، attachments، aiSummary، isBreak

## محرك الأدوات — تنفيذ مباشر بدون إظهاره للمستخدم

**صيغة الأداة:** [TOOL:اسمالأداة|{"param":"value"}]

### التنقل
[TOOL:navigate|{"page":"dashboard"}]
[TOOL:openDayBoard|{"dayKey":"mon"}]

### قراءة البيانات
[TOOL:getAppState|{}]
[TOOL:readDayBlocks|{"dayKey":"mon"}]
[TOOL:readWeeklyTable|{}]
[TOOL:readSettings|{}]
[TOOL:analyzeSchedule|{}]

### إنشاء الجدول (استخدم ALL الحقول)
[TOOL:createDaySchedule|{"dayKey":"mon","replaceExisting":true,"blocks":[
  {"name":"مراجعة صباحية","subject":"مراجعة","timeStart":"08:00","timeEnd":"08:45","duration":45,"difficulty":"easy","goal":"مراجعة المفاهيم","description":"Anki + Active Recall","whatWillILearn":"مراجعة جميع المفاهيم","whatWillIPractice":"Active Recall","expectedOutcome":"تثبيت 90%","notes":"ركز على البطاقات الصعبة","tips":"اختبر نفسك لا تقرأ فقط","priority":"high","status":"pending","isBreak":false}
]}]

### خطة دراسية تلقائية
[TOOL:generateStudyPlan|{"dayKey":"mon","subjects":["Python","رياضيات"],"hoursAvailable":8}]

### تحديث حقول محددة (لا تعد إنشاء الجدول كله)
[TOOL:fillBlockFields|{"dayKey":"mon","blockId":"block_id","fields":{"whatWillILearn":"...","notes":"..."}}]
[TOOL:updateBlock|{"dayKey":"mon","blockId":"block_id","updates":{"goal":"هدف جديد"}}]
[TOOL:fillAllBlocksAllFields|{"dayKey":"mon","subjectHint":"Python"}]

### حذف
[TOOL:deleteBlock|{"dayKey":"mon","blockId":"block_id"}]
[TOOL:clearDayBlocks|{"dayKey":"mon"}]

### الذاكرة
[TOOL:addMemory|{"key":"study_hours","value":"6 ساعات يومياً","category":"profile"}]
[TOOL:readMemory|{}]
[TOOL:saveUserProfile|{"key":"dailyHours","value":"6"}]
[TOOL:saveLongTermMemory|{"category":"profile","key":"subject","value":"Python"}]

### الملفات
[TOOL:readFile|{}]
[TOOL:extractPdfText|{}]

### أخرى
[TOOL:updateWeeklyCell|{"dayKey":"mon","columnIndex":0,"value":"قيمة"}]
[TOOL:updateSettings|{"key":"userName","value":"Murad"}]
[TOOL:sendNotification|{"title":"تنبيه","body":"رسالة","type":"success"}]
[TOOL:generateFile|{"type":"pdf","title":"خطة","content":"محتوى"}]
[TOOL:speak|{"text":"مرحباً","lang":"ar-SA"}]

## قواعد التنفيذ (صارمة)

1. **نفذ أولاً** → اشرح بعدها بطبيعية (عكس هذا الترتيب ممنوع)
2. **لا تقل "سأقوم بـ..."** → قل ما فعلته بعد التنفيذ
3. **لا تُظهر [TOOL:...]** أبداً في النص المرئي
4. **إذا فشلت أداة** → أخبر بالخطأ الحقيقي من result.error
5. **للمهام المتعددة** → سلسل جميع الأدوات في رد واحد
6. **لا تعد إنشاء الجدول كله** لتحديث حقل واحد فقط
7. **تذكر الملف الأخير** من الجلسة — لا تطلب رفعه مجدداً
8. **كن استباقياً** — اقترح التحسينات عندما تراها

## قواعد الرد

- **لا إجابات بسطر واحد** (إلا للأسئلة البسيطة جداً)
- **استخدم Markdown:** عناوين، قوائم، جداول، خط عريض
- **بعد إنشاء الجدول:** أظهر جدول ملخص + إجمالي الساعات + اقتراح
- **بعد قراءة ملف:** أخبر بمحتواه + اعرض خيارات (شرح/ملخص/أسئلة/خطة)
- **بعد تعديل بلوك:** أكد بطبيعية ما تغير
- **عندما ترى مشكلة في الجدول:** أذكرها واقترح الحل

## نموذج رد بعد إنشاء جدول

"انتهيت من إعداد جدول [اليوم] — [N] بلوكات تغطي [X] ساعات.

| الوقت | المادة | الهدف | المدة |
|-------|--------|-------|-------|
| 08:00-08:45 | مراجعة | تثبيت المعلومات | 45 د |
...

⏱️ إجمالي الدراسة: X ساعة
💡 [ملاحظة أو اقتراح مفيد]

هل تريد [تعديل + اقتراح محدد]؟"
`;

      // Add behavior rules from personality settings
      if (p.behaviourRules && p.behaviourRules.length > 0) {
        const rulesText = p.behaviourRules.map(r => '- ' + r).join('\n');
        prompt += '\n\n## تعليمات خاصة من الإعدادات\n' + rulesText;
      }

      // Extra system prompt from personality
      if (p.systemPromptExtra) {
        prompt += '\n\n## تعليمات إضافية\n' + p.systemPromptExtra;
      }

      return prompt;
    }
  };

  // ── Action Engine ─────────────────────────────────────────────
  const AIActionEngine = {
    parseAndExecute(text) {
      if (typeof text !== 'string') return [];
      const executed = [];

      let i = 0;
      while (i < text.length) {
        const start = text.indexOf('[TOOL:', i);
        if (start === -1) break;

        const pipePos = text.indexOf('|', start);
        if (pipePos === -1) { i = start + 1; continue; }
        const toolName = text.slice(start + 6, pipePos);
        if (!/^\w+$/.test(toolName)) { i = start + 1; continue; }

        // Walk balanced brackets
        let depth = 1, j = pipePos + 1;
        while (j < text.length && depth > 0) {
          if (text[j] === '[') depth++;
          else if (text[j] === ']') depth--;
          j++;
        }

        const argsStr = text.slice(pipePos + 1, j - 1);
        let args = {};
        try { args = JSON.parse(argsStr); } catch (e) {
          console.warn('[AIActionEngine] Failed to parse tool args:', argsStr.substring(0, 100));
          i = j; continue;
        }

        const result = this.execute(toolName, args);
        executed.push({ tool: toolName, args, result });
        i = j;
      }

      return executed;
    },

    execute(toolName, args) {
      // Handle new memory tools
      if (toolName === 'saveLongTermMemory' || toolName === 'saveUserProfile') {
        try {
          if (window.AILongTermMemory) {
            const result = window.AILongTermMemory.set(
              args.category || 'profile',
              args.key,
              args.value,
              { source: 'ai_tool' }
            );
            return { success: true, result };
          }
          return { success: false, error: 'AILongTermMemory not loaded' };
        } catch (e) {
          return { success: false, error: e.message };
        }
      }

      // Prefer AIAgentCore (new full engine)
      if (window.AIAgentCore && window.AIAgentCore.tools[toolName]) {
        try {
          const r = window.AIAgentCore.tools[toolName].call(window.AIAgentCore, args);
          // Handle Promise (async tools)
          if (r && typeof r.then === 'function') {
            r.then(res => {
              console.log('[AIActionEngine] Async result (' + toolName + '):', res);
              // If this was a schedule action, record it in session memory
              if (window.AISessionMemoryEngine && (toolName.includes('Block') || toolName.includes('Schedule') || toolName.includes('Plan'))) {
                window.AISessionMemoryEngine.addScheduleAction({ action: toolName, dayKey: args.dayKey });
              }
            }).catch(e => console.error('[AIActionEngine] Async error (' + toolName + '):', e));
            return { success: true, result: 'executing async...' };
          }
          // Record schedule actions in session memory
          if (window.AISessionMemoryEngine && (toolName.includes('Block') || toolName.includes('Schedule') || toolName.includes('Plan'))) {
            window.AISessionMemoryEngine.addScheduleAction({ action: toolName, dayKey: args.dayKey });
          }
          return r;
        } catch (e) {
          console.error('[AIActionEngine] Core tool error (' + toolName + '):', e);
          return { success: false, error: e.message };
        }
      }

      // Legacy fallback
      try {
        const legacyTools = {
          navigate: () => this._navigate(args),
          createSchedule: () => this._createSchedule(args),
          createGoal: () => this._createGoal(args),
          createNote: () => this._createNote(args),
          updateGoal: () => this._updateGoal(args),
          addMemory: () => this._addMemory(args),
          sendNotification: () => this._sendNotification(args),
          optimizePlan: () => this._optimizePlan(args),
          generateWeekPlan: () => this._generateWeekPlan(args),
          getWeekData: () => _getWeekData(),
          getTodayData: () => _getTodayData(),
          getStats: () => _computeStats(),
        };

        if (legacyTools[toolName]) {
          const result = legacyTools[toolName]();
          console.log('[AIActionEngine] Legacy executed: ' + toolName, result);
          return { success: true, result };
        } else {
          return { success: false, error: 'Unknown tool: ' + toolName };
        }
      } catch (e) {
        console.error('[AIActionEngine] Legacy tool error (' + toolName + '):', e);
        return { success: false, error: e.message };
      }
    },

    _navigate(args) {
      const raw = (args.page || args.target || '').toLowerCase().trim();
      if (!raw) return { success: false, error: 'No page specified' };

      const aliases = {
        'dashboard': 'dashboard', 'home': 'dashboard', 'main': 'dashboard',
        'weekly': 'weekly', 'week': 'weekly',
        'daily': 'daily', 'today': 'daily', 'schedule': 'daily',
        'settings': 'settings',
        'ai-workspace': 'ai-workspace', 'workspace': 'ai-workspace', 'chat': 'ai-workspace',
        'ai-settings': 'ai-settings', 'providers': 'ai-settings',
        'ai-personality': 'ai-personality', 'personality': 'ai-personality',
        'ai-automation': 'ai-automation', 'automation': 'ai-automation',
        'ai-analytics': 'ai-analytics', 'analytics': 'ai-analytics',
      };

      const pageId = aliases[raw] || raw;
      const aiPages = ['ai-workspace', 'ai-analytics', 'ai-automation', 'ai-automations', 'ai-personality', 'ai-settings'];

      if (aiPages.includes(pageId)) {
        if (window.showAIPage) showAIPage(pageId, null);
        else if (window.showPage) showPage(pageId, null);
      } else {
        if (window.showPage) showPage(pageId, null);
      }

      if (typeof showToast === 'function') showToast(`تم الانتقال إلى ${pageId}`, 'success');
      return { navigated: pageId };
    },

    _createSchedule(args) {
      const { day, blocks } = args;
      if (!day) throw new Error('Day is required');

      const dayMap = {
        sat: 0, sun: 1, mon: 2, tue: 3, wed: 4, thu: 5, fri: 6,
        saturday: 0, sunday: 1, monday: 2, tuesday: 3, wednesday: 4, thursday: 5, friday: 6
      };

      const dayIndex = dayMap[day.toLowerCase()] ?? 0;
      const weekData = window.DB?.get?.('weekSchedule') || {};
      const dayKey = Object.keys(weekData)[dayIndex];

      if (dayKey && blocks && Array.isArray(blocks)) {
        if (!weekData[dayKey]) weekData[dayKey] = {};
        weekData[dayKey].blocks = blocks.map((b, i) => ({
          id: `block_${Date.now()}_${i}`,
          name: b.name || 'Study Block',
          time: b.time || '09:00',
          duration: b.duration || 60,
          type: b.type || 'study',
          subject: b.subject || b.name || '',
          activity: b.activity || '',
          goal: b.goal || '',
          notes: b.notes || ''
        }));
        window.DB?.set?.('weekSchedule', weekData);
        if (window.renderWeeklyTable) renderWeeklyTable();
      }
      return { day, blocksCount: blocks?.length || 0 };
    },

    _createGoal(args) {
      const goals = window.DB?.get?.('goals') || [];
      const newGoal = {
        id: 'goal_' + Date.now(),
        title: args.title || 'New Goal',
        description: args.description || '',
        deadline: args.deadline || '',
        subject: args.subject || '',
        status: 'active',
        createdAt: new Date().toISOString(),
        progress: 0
      };
      goals.push(newGoal);
      window.DB?.set?.('goals', goals);
      return newGoal;
    },

    _createNote(args) {
      const notes = window.DB?.get?.('notes') || [];
      const note = {
        id: 'note_' + Date.now(),
        title: args.title || 'Note',
        content: args.content || '',
        block: args.block || '',
        tags: args.tags || [],
        createdAt: new Date().toISOString()
      };
      notes.push(note);
      window.DB?.set?.('notes', notes);
      return note;
    },

    _updateGoal(args) {
      const goals = window.DB?.get?.('goals') || [];
      const idx = goals.findIndex(g => g.id === args.id);
      if (idx === -1) throw new Error('Goal not found: ' + args.id);

      Object.assign(goals[idx], {
        ...(args.title && { title: args.title }),
        ...(args.description && { description: args.description }),
        ...(args.status && { status: args.status }),
        ...(args.progress !== undefined && { progress: args.progress }),
        updatedAt: new Date().toISOString()
      });
      window.DB?.set?.('goals', goals);
      return goals[idx];
    },

    _addMemory(args) {
      if (window.AILongTermMemory) {
        return window.AILongTermMemory.set(
          args.category || 'general',
          args.key || args.content?.substring(0, 30),
          args.content || args.value,
          { source: 'ai_action' }
        );
      }
      if (window.AIMemory) {
        return AIMemory.add({ content: args.content || args.value, category: args.category || 'general', source: 'ai_action' });
      }
      return { stored: args.content };
    },

    _sendNotification(args) {
      const msg = args.message || args.text || args.body || 'Notification';
      const type = args.type || 'info';
      if (window.DockNotifications) DockNotifications.add(msg, type, 'AI Assistant');
      if (typeof showToast === 'function') showToast(msg, type);
      return { notified: true, message: msg };
    },

    _optimizePlan(args) {
      const stats = _computeStats();
      const suggestions = [];
      if (stats.completionRate < 50) suggestions.push('قلل عدد البلوكات لتحسين نسبة الإنجاز');
      if (stats.avgSessionLength > 120) suggestions.push('قسم الجلسات الطويلة (>2h) إلى جلسات أقصر');
      if (stats.focusScore < 60) suggestions.push('أضف استراحات أكثر للحفاظ على التركيز');
      return { suggestions, stats };
    },

    _generateWeekPlan(args) {
      const { week, pattern } = args;
      const dayKeys = ['sat', 'sun', 'mon', 'tue', 'wed', 'thu', 'fri'];
      const weekData = window.DB?.get?.('weekSchedule') || {};

      const patternBlocks = {
        A: [
          { name: 'مراجعة صباحية', time: '08:00', duration: 30, type: 'review' },
          { name: 'دراسة مفاهيم جديدة', time: '09:00', duration: 90, type: 'study' },
          { name: 'استراحة', time: '10:30', duration: 15, type: 'break' },
          { name: 'تطبيق وتمارين', time: '10:45', duration: 60, type: 'practice' },
        ],
        B: [
          { name: 'تمارين وحل مسائل', time: '09:00', duration: 90, type: 'practice' },
          { name: 'استراحة', time: '10:30', duration: 15, type: 'break' },
          { name: 'مراجعة وتلخيص', time: '10:45', duration: 60, type: 'review' },
        ]
      };

      dayKeys.forEach((day, i) => {
        const pat = (pattern && pattern[i]) || 'A';
        const blocks = patternBlocks[pat] || patternBlocks.A;
        if (!weekData[day]) weekData[day] = {};
        weekData[day].pattern = pat;
        weekData[day].blocks = blocks.map((b, j) => ({
          id: `block_gen_${i}_${j}_${Date.now()}`,
          ...b
        }));
      });

      window.DB?.set?.('weekSchedule', weekData);
      if (window.renderWeeklyTable) renderWeeklyTable();
      return { weekGenerated: true, daysCount: dayKeys.length };
    }
  };

  // ── Internal helpers ─────────────────────────────────────────
  function _getCurrentPage() {
    const activePage = document.querySelector('.page.active');
    if (activePage) return activePage.id?.replace('page-', '') || 'dashboard';
    return 'dashboard';
  }

  function _getDayName(date) {
    const days = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
    return days[date.getDay()];
  }

  function _getWeekData() {
    try {
      return window.DB?.get?.('weekSchedule') || {};
    } catch (e) { return {}; }
  }

  function _getTodayData(weekData) {
    const wd = weekData || _getWeekData();
    const now = new Date();
    const dayKeys = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
    const todayKey = dayKeys[now.getDay()];
    return wd[todayKey] || {};
  }

  function _computeStats() {
    try {
      const weekData = _getWeekData();
      const days = Object.values(weekData);
      let totalBlocks = 0, completedBlocks = 0, totalDuration = 0;
      const subjectTimes = {};

      days.forEach(day => {
        if (!day || !day.blocks) return;
        day.blocks.forEach(block => {
          if (block.type === 'break' || block.type === 'lunch' || block.isBreak) return;
          totalBlocks++;
          totalDuration += block.duration || 60;
          if (block.completed) completedBlocks++;
          const subj = block.subject || block.name || 'other';
          subjectTimes[subj] = (subjectTimes[subj] || 0) + (block.duration || 60);
        });
      });

      const completionRate = totalBlocks ? Math.round((completedBlocks / totalBlocks) * 100) : 0;
      const avgSessionLength = days.length ? Math.round(totalDuration / days.length) : 0;

      const subjects = Object.entries(subjectTimes).sort(([, a], [, b]) => b - a);
      const bestSubject = subjects[0]?.[0] || '';
      const weakSubject = subjects[subjects.length - 1]?.[0] || '';

      const performanceScore = Math.min(100, completionRate + 10);
      const productivityScore = Math.min(100, Math.round((totalDuration / (7 * 240)) * 100));
      const focusScore = Math.min(100, Math.max(0, 100 - (avgSessionLength > 180 ? (avgSessionLength - 180) / 2 : 0)));
      const burnoutRisk = productivityScore > 90 && completionRate < 60 ? 'high' :
                         productivityScore > 70 ? 'medium' : 'low';

      return {
        totalBlocks, completedBlocks, completionRate,
        totalStudyMinutes: totalDuration, avgSessionLength,
        bestSubject, weakSubject, subjectTimes,
        performanceScore, productivityScore, focusScore,
        burnoutRisk, trend: completionRate > 70 ? 'up' : completionRate > 40 ? 'stable' : 'down'
      };
    } catch (e) {
      return { totalBlocks: 0, completedBlocks: 0, completionRate: 0, performanceScore: 0, productivityScore: 0, focusScore: 0, burnoutRisk: 'low', trend: 'stable' };
    }
  }

  function _formatScheduleForPrompt(todayData) {
    if (!todayData || !todayData.blocks || !todayData.blocks.length) {
      return 'لا يوجد جدول لليوم';
    }
    return todayData.blocks
      .filter(b => b.name)
      .map(b => `- ${b.timeStart || b.time || '?'}: ${b.name} (${b.duration || 60} دقيقة)${b.completed ? ' ✓' : ''}`)
      .join('\n') || 'لا توجد بلوكات';
  }

  function _formatStatsForPrompt(stats) {
    if (!stats) return 'لا توجد إحصائيات';
    return `- نسبة الإنجاز: ${stats.completionRate}%
- نقاط الأداء: ${stats.performanceScore}/100
- نقاط الإنتاجية: ${stats.productivityScore}/100
- نقاط التركيز: ${stats.focusScore}/100
- إجمالي وقت الدراسة: ${stats.totalStudyMinutes} دقيقة هذا الأسبوع
- أفضل مادة: ${stats.bestSubject || 'غير محدد'}
- أضعف مادة: ${stats.weakSubject || 'غير محدد'}
- خطر الإرهاق: ${stats.burnoutRisk}
- الاتجاه: ${stats.trend}`;
  }

  // ── Expose globally ──────────────────────────────────────────
  window.AIContextEngine = AIContextEngine;
  window.AIActionEngine = AIActionEngine;

  // Override old AIAgent functions if present
  if (window.AIAgent) {
    AIAgent.getAppContext = () => AIContextEngine.build();
    AIAgent.buildSystemPrompt = (ctx) => AIContextEngine.buildSystemPrompt(ctx);
    AIAgent.parseAndExecuteTools = (text) => AIActionEngine.parseAndExecute(text);
    AIAgent.executeTool = (tool, args) => AIActionEngine.execute(tool, args);
    AIAgent.getStats = () => _computeStats();
  }

  console.log('[AIContextEngine] v3.0 — Natural AI + 3-Layer Memory ✅');

})();
