/* ============================================================
   AI AGENT SYSTEM - Full Application Awareness
   ============================================================ */

const AIAgent = {
  // ===== APP CONTEXT READER =====
  getAppContext() {
    const weekNum = getCurrentWeekNum();
    const today = new Date();
    const dayOfWeek = today.getDay();
    const dayMap = { 6: 'sat', 0: 'sun', 1: 'mon', 2: 'tue', 3: 'wed', 4: 'thu', 5: 'fri' };
    const todayKey = dayMap[dayOfWeek] || 'sat';
    const todayInfo = WEEK_SCHEDULE.find(d => d.key === todayKey) || WEEK_SCHEDULE[0];

    const allWeekData = {};
    WEEK_SCHEDULE.forEach(day => {
      const data = getDailyData(weekNum, day.key, day.pattern);
      allWeekData[day.key] = {
        day: day.dayEn,
        dayAr: day.dayAr,
        pattern: day.pattern,
        blocks: (data.blocks || []).map(b => ({
          name: typeof b.name === 'object' ? b.name.en : b.name,
          timeStart: b.timeStart,
          timeEnd: b.timeEnd,
          activity: typeof b.activity === 'object' ? b.activity.en : b.activity,
          goal: typeof b.goal === 'object' ? b.goal.en : b.goal,
          notes: b.notes,
          outputs: b.outputs,
          duration: b.duration,
          isBreak: b.isBreak
        }))
      };
    });

    const memory = AIMemory.getAll();
    const personality = AIPersonality.get();
    const automations = AIAutomations.getAll();

    return {
      user: {
        name: settings.userName || 'Murad',
        language: typeof currentLang !== 'undefined' ? currentLang : 'en',
        theme: settings.theme || 'dark',
      },
      currentState: {
        page: window._currentAIPage || 'dashboard',
        weekNum,
        todayKey,
        todayPattern: todayInfo.pattern,
        todayDay: todayInfo.dayEn,
        time: today.toLocaleTimeString(),
        date: today.toLocaleDateString(),
      },
      schedule: allWeekData,
      memory: memory,
      personality: personality,
      automations: automations.length,
      stats: this.getStats(),
    };
  },

  getStats() {
    const weekNum = getCurrentWeekNum();
    let totalBlocks = 0, completedBlocks = 0, totalStudyMinutes = 0;
    WEEK_SCHEDULE.forEach(day => {
      const data = getDailyData(weekNum, day.key, day.pattern);
      const blocks = data.blocks || [];
      blocks.forEach(b => {
        if (!b.isBreak) {
          totalBlocks++;
          totalStudyMinutes += (b.duration || 45);
          if (b.outputs && b.outputs.trim()) completedBlocks++;
        }
      });
    });
    return { totalBlocks, completedBlocks, totalStudyMinutes, weekNum };
  },

  buildSystemPrompt() {
    const ctx = this.getAppContext();
    const personality = ctx.personality;

    let systemPrompt = personality.systemPrompt || '';
    if (!systemPrompt) {
      systemPrompt = `You are an advanced AI Learning Assistant integrated into Murad Learning Planner — an AI-Powered Learning Operating System.`;
    }

    const contextBlock = `

## YOUR ROLE
You are a native system component with FULL ACCESS to the user's learning data. You are NOT a generic chatbot. You are ${ctx.user.name}'s personal AI Learning Coach.

## CURRENT APP STATE
- Page: ${ctx.currentState.page}
- Date: ${ctx.currentState.date}
- Time: ${ctx.currentState.time}
- Week: ${ctx.currentState.weekNum}
- Today: ${ctx.currentState.todayDay} (Pattern ${ctx.currentState.todayPattern})
- User: ${ctx.user.name}
- Language: ${ctx.user.language}

## TODAY'S SCHEDULE
${JSON.stringify(ctx.schedule[ctx.currentState.todayKey], null, 2)}

## THIS WEEK'S OVERVIEW
${Object.entries(ctx.schedule).map(([k, v]) => `${v.day} (Pattern ${v.pattern}): ${v.blocks.filter(b=>!b.isBreak).map(b=>b.name).join(', ')}`).join('\n')}

## USER STATS
- Week: ${ctx.stats.weekNum}
- Total Study Blocks: ${ctx.stats.totalBlocks}
- Completed (with outputs): ${ctx.stats.completedBlocks}
- Total Study Time: ${Math.round(ctx.stats.totalStudyMinutes/60)} hours

## MEMORY
${ctx.memory.length > 0 ? ctx.memory.map(m => `- ${m.key}: ${m.value}`).join('\n') : 'No long-term memory yet.'}

## PERSONALITY SETTINGS
- Teaching Style: ${personality.teachingStyle || 'Adaptive'}
- Response Format: ${personality.responseFormat || 'Markdown'}
- Learning Style: ${personality.learningStyle || 'Visual'}
- Language Preference: ${personality.preferredLanguage || 'Auto-detect'}
- Behavior Rules: ${(personality.behaviorRules || []).join('; ')}

## CRITICAL: Action-First Rules
You have DIRECT CONTROL over this application. When the user asks you to do something — DO IT IMMEDIATELY.
Do NOT say "I will..." or "I can...". Execute first, confirm briefly after.
Tool calls are extracted and executed BEFORE your text is shown — never display [TOOL:...] syntax as visible text.

## Application Pages
dashboard, weekly, daily, settings, ai-workspace, ai-settings, ai-personality, ai-automation, ai-analytics

## Tools (execute silently, confirm with one line after)
[TOOL:navigate|{"page":"dashboard"}] — navigate to any page
[TOOL:createSchedule|{"dayKey":"mon","blocks":[{"name":"Math","timeStart":"09:00","timeEnd":"10:00","duration":60}]}] — create schedule
[TOOL:createGoal|{"title":"...","description":"...","deadline":"YYYY-MM-DD"}] — add goal
[TOOL:createNote|{"title":"...","content":"..."}] — add note
[TOOL:createAutomation|{"name":"...","trigger":"manual","action":"generate_plan"}] — add automation

Always respond in ${personality.preferredLanguage === 'Arabic' ? 'Arabic' : (ctx.user.language === 'ar' ? 'Arabic' : 'English')} unless asked otherwise.`;

    return systemPrompt + contextBlock;
  },

  // ===== TOOL EXECUTION =====
  async executeTool(toolCall, args) {
    switch (toolCall) {
      case 'navigate':
        return this.toolNavigate(args);
      case 'createSchedule':
        return this.toolCreateSchedule(args);
      case 'createGoal':
        return this.toolCreateGoal(args);
      case 'createNote':
        return this.toolCreateNote(args);
      case 'createAutomation':
        return this.toolCreateAutomation(args);
      case 'getWeekData':
        return this.toolGetWeekData(args);
      default:
        return { success: false, error: 'Unknown tool: ' + toolCall };
    }
  },

  toolNavigate(page) {
    // Accept both string arg and object arg
    const pageId = (typeof page === 'object' ? (page.page || page.target || '') : (page || '')).toLowerCase().trim();
    const aliases = {
      'home': 'dashboard', 'main': 'dashboard',
      'weekly schedule': 'weekly', 'week': 'weekly',
      'daily schedule': 'daily', 'today': 'daily', 'schedule': 'daily',
      'app settings': 'settings',
      'workspace': 'ai-workspace', 'chat': 'ai-workspace', 'ai chat': 'ai-workspace',
      'ai settings': 'ai-settings', 'providers': 'ai-settings',
      'personality': 'ai-personality', 'ai personality': 'ai-personality',
      'automation': 'ai-automation', 'automations': 'ai-automation', 'ai-automations': 'ai-automation',
      'analytics': 'ai-analytics', 'ai analytics': 'ai-analytics', 'insights': 'ai-analytics',
    };
    const target = aliases[pageId] || pageId;
    const aiPages = ['ai-workspace', 'ai-analytics', 'ai-automation', 'ai-personality', 'ai-settings'];
    if (aiPages.includes(target)) {
      if (window.showAIPage) showAIPage(target, null);
      else showPage(target, null);
    } else {
      showPage(target, null);
    }
    if (typeof showToast === 'function') showToast(`Navigated to ${target}`, 'success');
    return { success: true, message: `Navigated to ${target}` };
  },

  toolCreateSchedule(data) {
    try {
      const weekNum = getCurrentWeekNum();
      const { dayKey, blocks } = data;
      if (!dayKey || !blocks) return { success: false, error: 'Missing dayKey or blocks' };

      const dayInfo = WEEK_SCHEDULE.find(d => d.key === dayKey) || WEEK_SCHEDULE[0];
      const newBlocks = blocks.map((b, i) => ({
        id: 'ai_block_' + Date.now() + '_' + i,
        timeStart: b.timeStart || '08:00',
        timeEnd: b.timeEnd || '09:00',
        name: { ar: b.name, en: b.name },
        activity: { ar: b.activity || '', en: b.activity || '' },
        goal: b.goal || '',
        learn: '', apply: '', notes: '', outputs: '', sound: '',
        duration: b.duration || 60,
        isBreak: b.isBreak || false
      }));

      const key = getDayKey(weekNum, dayKey);
      const dayData = getDailyData(weekNum, dayKey, dayInfo.pattern);
      dayData.blocks = newBlocks;
      DB.set(key, dayData);

      if (window.currentDayKey === dayKey) {
        window.currentBlocks = newBlocks;
        renderBlocks(newBlocks);
      }

      showToast(`✅ AI created schedule for ${dayInfo.dayEn}`, 'success');
      return { success: true, message: `Created ${newBlocks.length} blocks for ${dayInfo.dayEn}` };
    } catch (e) {
      return { success: false, error: e.message };
    }
  },

  toolCreateGoal(data) {
    const goals = DB.get('ai_goals', []);
    const goal = {
      id: 'goal_' + Date.now(),
      title: data.title || 'New Goal',
      description: data.description || '',
      deadline: data.deadline || '',
      priority: data.priority || 'medium',
      status: 'active',
      createdAt: new Date().toISOString()
    };
    goals.push(goal);
    DB.set('ai_goals', goals);
    showToast(`✅ Goal created: ${goal.title}`, 'success');
    return { success: true, goal };
  },

  toolCreateNote(data) {
    const notes = DB.get('ai_notes', []);
    const note = {
      id: 'note_' + Date.now(),
      title: data.title || 'New Note',
      content: data.content || '',
      tags: data.tags || [],
      createdAt: new Date().toISOString()
    };
    notes.push(note);
    DB.set('ai_notes', notes);
    showToast(`✅ Note created: ${note.title}`, 'success');
    return { success: true, note };
  },

  toolCreateAutomation(data) {
    return AIAutomations.add(data);
  },

  toolGetWeekData(args) {
    const weekNum = args?.weekNum || getCurrentWeekNum();
    const result = {};
    WEEK_SCHEDULE.forEach(day => {
      const data = getDailyData(weekNum, day.key, day.pattern);
      result[day.key] = { ...day, blocks: data.blocks };
    });
    return { success: true, data: result };
  },

  // ===== PARSE AND EXECUTE TOOLS FROM AI RESPONSE =====
  parseAndExecuteTools(text) {
    const toolRegex = /\[TOOL:(\w+)\|({[^}]+}|[^\]]+)\]/g;
    const results = [];
    let match;
    while ((match = toolRegex.exec(text)) !== null) {
      const toolName = match[1];
      let args;
      try {
        args = JSON.parse(match[2]);
      } catch {
        args = match[2];
      }
      const result = this.executeTool(toolName, args);
      results.push({ tool: toolName, result });
    }
    return results;
  }
};

window.AIAgent = AIAgent;
