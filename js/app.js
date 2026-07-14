/* ============================================================
   MURAD LEARNING PLANNER - Main Application
   ============================================================ */

// ===== GLOBAL STATE =====
window.currentDayPattern = null;
window.currentDayKey = null;
window.currentWeekNum = 1;
window.currentBlocks = [];
window._activeBlockId = null;
window._nextBlockId = null;
window._dragSrcEl = null;

// ===== INITIALIZATION =====
window.addEventListener('DOMContentLoaded', () => {
  initLoadingScreen();
});

function initLoadingScreen() {
  const bar = document.getElementById('loading-bar');
  const msg = document.getElementById('loading-msg');
  const screen = document.getElementById('loading-screen');

  const steps = [
    { pct: 15, text: 'Loading data...' },
    { pct: 30, text: 'Initializing UI...' },
    { pct: 50, text: 'Setting up sounds...' },
    { pct: 65, text: 'Building dashboard...' },
    { pct: 80, text: '🤖 Loading AI System...' },
    { pct: 90, text: '🧠 Initializing AI Agents...' },
    { pct: 100, text: '✨ Ready!' },
  ];

  let i = 0;
  const interval = setInterval(() => {
    if (i >= steps.length) {
      clearInterval(interval);
      setTimeout(() => {
        // FIX BUG 1: Synchronously remove pointer events + start opacity fade
        // THEN set display:none quickly (300ms) BEFORE app content is visible.
        // This eliminates the 600ms window where a dark overlay sat on top of rendered content.
        screen.style.transition = 'opacity 0.25s ease';
        screen.style.opacity = '0';
        screen.style.pointerEvents = 'none';
        // Start app immediately while screen fades out — content renders behind transparent overlay
        initApp();
        // Remove from render tree after fade completes (shorter than before: 300ms not 600ms)
        setTimeout(() => {
          screen.style.display = 'none';
          // Reset inline styles so CSS classes work correctly on next use (PDF export)
          screen.style.opacity = '';
          screen.style.transition = '';
          screen.style.pointerEvents = '';
        }, 300);
      }, 200);
      return;
    }
    bar.style.width = steps[i].pct + '%';
    msg.textContent = steps[i].text;
    i++;
  }, 200);
}

function initApp() {
  window.currentWeekNum = getCurrentWeekNum();
  applyTheme(settings.theme || 'dark');
  loadSettingsUI();
  renderDashboard();
  renderWeeklyTable();
  renderSoundLibrary();
  renderCustomSoundsList();
  renderPerBlockSoundSettings();
  setupTooltipSystem();
  // Request notification permission
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
  }
  // Initialize AI system (floating dock is now auto-initialized by floating-dock.js)
  setTimeout(() => {
    if (typeof AIAutomations !== 'undefined') AIAutomations.checkAndRunDue();
    if (typeof AIContextEngine !== 'undefined' && typeof AIAgent !== 'undefined') {
      // Upgrade AIAgent with new context engine
      AIAgent.getAppContext = () => AIContextEngine.build();
      AIAgent.buildSystemPrompt = (ctx) => AIContextEngine.buildSystemPrompt(ctx);
      AIAgent.parseAndExecuteTools = (text) => AIActionEngine.parseAndExecute(text);
    }
  }, 500);
}

// ===== THEME =====
function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  const icon = document.getElementById('theme-icon');
  if (icon) icon.className = theme === 'dark' ? 'fas fa-moon' : 'fas fa-sun';
}

function setTheme(theme) {
  settings.theme = theme;
  DB.set('settings', settings);
  applyTheme(theme);
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme');
  setTheme(current === 'dark' ? 'light' : 'dark');
}

// ===== SIDEBAR =====
function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('collapsed');
}

function toggleMobileSidebar() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebarOverlay');
  const btn = document.getElementById('mobileMenuBtn');
  if (!sidebar) return;
  const isOpen = sidebar.classList.toggle('open');
  if (overlay) overlay.classList.toggle('active', isOpen);
  if (btn) btn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
}


// ===== SHARED AI PAGE RENDERERS (single source of truth) =====
// Prevents duplication between showPage() and showAIPage().
function _renderAIPage(pageId) {
  const renderers = {
    'ai-workspace':   () => typeof renderAIWorkspacePage   === 'function' && renderAIWorkspacePage(),
    'ai-settings':    () => typeof renderAISettingsPage    === 'function' && renderAISettingsPage(),
    'ai-personality': () => typeof renderAIPersonalityPage === 'function' && renderAIPersonalityPage(),
    'ai-automation':  () => typeof renderAIAutomationPage  === 'function' && renderAIAutomationPage(),
    'ai-analytics':   () => typeof renderAIAnalyticsPage   === 'function' && renderAIAnalyticsPage(),
  };
  if (renderers[pageId]) renderers[pageId]();
}

// ===== PAGE NAVIGATION =====
function showPage(pageId, navEl) {
  // Guard: pageId must be a non-empty string
  if (!pageId || typeof pageId !== 'string') return;

  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => {
    n.classList.remove('active');
    n.removeAttribute('aria-current');
  });

  const page = document.getElementById('page-' + pageId);
  if (page) page.classList.add('active');
  if (navEl) {
    navEl.classList.add('active');
    navEl.setAttribute('aria-current', 'page');
  }

  // Render page-specific content (guarded with try/catch — never crash)
  try {
    if (pageId === 'settings') { renderSoundLibrary(); renderPerBlockSoundSettings(); loadSettingsUI(); }
    if (pageId === 'dashboard') renderDashboard();
    if (pageId === 'weekly') renderWeeklyTable();
  } catch (e) {
    console.error('[showPage] Render error for page:', pageId, e);
  }

  // Track current page for AI
  window._currentAIPage = pageId;
  try { if (typeof updateFloatingAIContext === 'function') updateFloatingAIContext(); } catch (e) {}

  // ── Layout fix: hide AI workspace panel on non-AI pages ──
  _syncWorkspaceVisibility(pageId);

  // Handle AI pages via shared renderer
  _renderAIPage(pageId);

  // ── Cross-browser: close mobile sidebar after navigation ──
  _closeMobileSidebar();

  // ── Scroll the active page back to top ──
  if (page) page.scrollTop = 0;
}

function _closeMobileSidebar() {
  try {
    if (window.innerWidth <= 900) {
      const sidebar = document.getElementById('sidebar');
      const overlay = document.getElementById('sidebarOverlay');
      if (sidebar) sidebar.classList.remove('open');
      if (overlay) overlay.classList.remove('active');
    }
  } catch (e) {}
}

function showDayPattern(pattern, navEl) {
  const dayInfo = WEEK_SCHEDULE.find(d => d.pattern === pattern);
  if (dayInfo) openDayBoard(dayInfo.key, pattern, navEl);
}

function goBackToWeekly() {
  showPage('weekly', null);
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.querySelector('.nav-item[onclick*="weekly"]')?.classList.add('active');
}

// ===== AI PAGE NAVIGATION =====
function showAIPage(pageId, navEl) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

  const page = document.getElementById('page-' + pageId);
  if (page) page.classList.add('active');
  if (navEl) navEl.classList.add('active');

  // Track current page for AI context
  window._currentAIPage = pageId;

  // ── Layout fix: sync workspace visibility ──
  _syncWorkspaceVisibility(pageId);

  // Render specific AI pages via shared renderer (no duplicate map)
  _renderAIPage(pageId);

  // Update floating AI context
  if (typeof updateFloatingAIContext === 'function') updateFloatingAIContext();

  // Close mobile sidebar
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebarOverlay');
  if (window.innerWidth <= 768) {
    sidebar?.classList.remove('open');
    overlay?.classList.remove('active');
  }
}

/**
 * _syncWorkspaceVisibility — controls whether the AI workspace panel
 * is visible. On non-AI pages the full workspace layout is hidden and
 * only the floating dock icon remains. On ai-workspace the full layout
 * is shown.
 * Points 17-19: Fix layout overlap.
 */
function _syncWorkspaceVisibility(pageId) {
  const AI_PAGES = ['ai-workspace', 'ai-settings', 'ai-personality', 'ai-automation', 'ai-analytics'];
  const isAIPage = AI_PAGES.includes(pageId);
  const isWorkspacePage = pageId === 'ai-workspace';

  // The workspace layout container (rendered inside #page-ai-workspace)
  // is already hidden because only one .page is active at a time.
  // This function ensures any globally-injected workspace panels
  // don't accidentally overlap non-AI pages.

  // Hide any floating workspace panel that escaped its container
  const floatingPanels = document.querySelectorAll(
    '.ai-workspace-layout, .ai-workspace-panel, #aiWorkspaceFloatingPanel'
  );
  floatingPanels.forEach(el => {
    // Only hide if the element is NOT inside the active page
    const parentPage = el.closest('.page');
    if (!parentPage || !parentPage.classList.contains('active')) {
      el.style.display = 'none';
      el.setAttribute('aria-hidden', 'true');
    } else {
      el.style.display = '';
      el.removeAttribute('aria-hidden');
    }
  });

  // Point 17-19: Floating dock visibility
  // - On ai-workspace: HIDE the floating dock (full workspace is shown)
  // - On ALL other pages: SHOW the floating dock button
  const floatingDock = document.getElementById('floatingDock') ||
                       document.getElementById('floatingAIBtn') ||
                       document.querySelector('.floating-ai-dock');
  if (floatingDock) {
    if (isWorkspacePage) {
      // Hide on AI workspace page — the full workspace is already visible
      floatingDock.style.display = 'none';
    } else {
      // Show on all other pages
      floatingDock.style.display = '';
    }
  }

  // Also call floating-dock's own visibility handler if available
  if (typeof window._updateDockVisibilityForPage === 'function') {
    window._updateDockVisibilityForPage(pageId);
  }

  // Notify workspace module
  if (typeof window._onPageChanged === 'function') {
    window._onPageChanged(pageId, isAIPage, isWorkspacePage);
  }
}

// ===== DASHBOARD =====
function renderDashboard() {
  const weekNum = getCurrentWeekNum();
  window.currentWeekNum = weekNum;
  document.getElementById('stat-week').textContent = weekNum;

  const today = new Date();
  const dayOfWeek = today.getDay();
  const dayMap = { 6: 'sat', 0: 'sun', 1: 'mon', 2: 'tue', 3: 'wed', 4: 'thu', 5: 'fri' };
  const todayKey = dayMap[dayOfWeek] || 'sat';
  const todayInfo = WEEK_SCHEDULE.find(d => d.key === todayKey) || WEEK_SCHEDULE[0];
  const pattern = todayInfo.pattern;

  document.getElementById('stat-pattern').textContent = pattern;
  document.getElementById('stat-day').textContent = currentLang === 'ar' ? todayInfo.dayAr : todayInfo.dayEn;

  const hour = today.getHours();
  const sessionText = hour < 13 ? t('session.morning') : t('session.afternoon');
  document.getElementById('stat-session').textContent = sessionText;
  document.getElementById('stat-status').textContent = t('status.idle');

  const dayData = getDailyData(weekNum, todayKey, pattern);
  const blocks = dayData.blocks || [];
  
  const timeStr = String(hour).padStart(2, '0') + ':' + String(today.getMinutes()).padStart(2, '0');
  let currentBlockInfo = blocks.length > 0 ? blocks[0] : null;
  let nextBlockInfo = blocks.length > 1 ? blocks[1] : null;
  
  if (blocks.length > 0) {
    for (let i = 0; i < blocks.length - 1; i++) {
      if (blocks[i].timeStart && blocks[i].timeEnd && 
          timeStr >= blocks[i].timeStart && timeStr < blocks[i].timeEnd) {
        currentBlockInfo = blocks[i];
        nextBlockInfo = blocks[i + 1] || null;
        break;
      }
    }
  }
  
  const cbName = currentBlockInfo?.name;
  const nbName = nextBlockInfo?.name;
  document.getElementById('stat-block').textContent = cbName ? (typeof cbName === 'object' ? (cbName[currentLang] || cbName.ar) : cbName) : '-';
  document.getElementById('stat-next').textContent = nbName ? (typeof nbName === 'object' ? (nbName[currentLang] || nbName.ar) : nbName) : '-';

  renderWeekOverview(todayKey);
  renderTodayProgress(pattern, blocks);
  renderWeekStats(weekNum);
}

function renderWeekOverview(todayKey) {
  const container = document.getElementById('weekOverview');
  if (!container) return;
  container.innerHTML = WEEK_SCHEDULE.map(day => {
    const isToday = day.key === todayKey;
    const dayName = currentLang === 'ar' ? day.dayAr : day.dayEn;
    return `
      <div class="week-day-card pattern-${day.pattern.toLowerCase()} ${isToday ? 'today' : ''}"
           onclick="openDayBoard('${day.key}', '${day.pattern}')">
        <div class="wdc-name">${dayName}</div>
        <div class="wdc-pattern pat-${day.pattern.toLowerCase()}">${day.pattern}</div>
        <div class="wdc-label">${getPatternShortDesc(day.pattern)}</div>
        ${isToday ? '<div style="font-size:0.65rem;color:var(--accent-primary);margin-top:4px">● Today</div>' : ''}
      </div>
    `;
  }).join('');
}

function getPatternShortDesc(pattern) {
  const desc = {
    A: currentLang === 'ar' ? 'تعلم جديد' : 'New Learning',
    B: currentLang === 'ar' ? 'ترسيخ' : 'Reinforcement',
    C: currentLang === 'ar' ? 'دمج' : 'Integration',
    D: currentLang === 'ar' ? 'إغلاق' : 'Closure',
  };
  return desc[pattern] || pattern;
}

function renderTodayProgress(pattern, blocks) {
  const container = document.getElementById('todayProgressBlocks');
  if (!container) return;
  if (!blocks || blocks.length === 0) {
    container.innerHTML = '<p style="color:var(--text-muted);text-align:center;padding:10px">لا توجد بلوكات</p>';
    return;
  }
  const items = blocks.filter(b => !b.isBreak).slice(0, 5);
  container.innerHTML = items.map((b, i) => {
    const name = typeof b.name === 'object' ? (b.name[currentLang] || b.name.ar) : b.name;
    const fills = ['fill-a', 'fill-b', 'fill-c', 'fill-d', 'fill-a'];
    return `
      <div class="progress-item">
        <div class="progress-label"><span>${name}</span><span>${b.timeStart}</span></div>
        <div class="progress-bar-wrap"><div class="progress-fill ${fills[i % fills.length]}" style="width:0%" data-target="${(i + 1) * 15}"></div></div>
      </div>
    `;
  }).join('');
  setTimeout(() => {
    container.querySelectorAll('.progress-fill[data-target]').forEach(el => {
      el.style.width = el.getAttribute('data-target') + '%';
    });
  }, 300);
}

function renderWeekStats(weekNum) {
  const container = document.getElementById('weekStatsChart');
  if (!container) return;
  const stats = WEEK_SCHEDULE.map(day => {
    const dayData = getDailyData(weekNum, day.key, day.pattern);
    const blocks = dayData.blocks || [];
    const activeBlocks = blocks.filter(b => !b.isBreak).length;
    const totalPossible = (DEFAULT_BLOCKS[day.pattern] || DEFAULT_BLOCKS.A).filter(b => !b.isBreak).length;
    const pct = totalPossible > 0 ? Math.round((activeBlocks / totalPossible) * 100) : 0;
    return {
      label: currentLang === 'ar' ? day.dayAr : day.dayEn,
      pattern: day.pattern,
      pct: pct
    };
  });

  const colorMap = { A: 'var(--accent-a)', B: 'var(--accent-b)', C: 'var(--accent-c)', D: 'var(--accent-d)' };
  container.innerHTML = `<div class="week-stats-bars">` +
    stats.map(s => `
      <div class="stat-bar-item">
        <span class="stat-bar-label">${s.label}</span>
        <div class="stat-bar-track">
          <div class="stat-bar-fill" style="width:0%;background:${colorMap[s.pattern]}" data-target="${s.pct}"></div>
        </div>
        <span class="stat-bar-val">${s.pct}%</span>
      </div>
    `).join('') + `</div>`;

  setTimeout(() => {
    container.querySelectorAll('.stat-bar-fill[data-target]').forEach(el => {
      el.style.width = el.getAttribute('data-target') + '%';
    });
  }, 400);
}

// ===== WEEKLY TABLE =====
function renderWeeklyTable() {
  const weekNum = getCurrentWeekNum();
  window.currentWeekNum = weekNum;
  document.getElementById('currentWeekNum').textContent = weekNum;

  const weekData = getWeeklyData(weekNum);
  const columns = weekData._columns || DEFAULT_COLUMNS;

  document.querySelectorAll('.editable-header').forEach((th, i) => {
    th.textContent = (columns[i] && (columns[i][currentLang] || columns[i].ar)) || DEFAULT_COLUMNS[i]?.ar;
  });

  const tbody = document.getElementById('weeklyTableBody');
  tbody.innerHTML = WEEK_SCHEDULE.map(day => {
    const dayName = currentLang === 'ar' ? day.dayAr : day.dayEn;
    const dayData = weekData[day.key] || { cells: ['', '', '', '', '', ''] };
    const cells = dayData.cells || ['', '', '', '', '', ''];
    return `
      <tr>
        <td class="day-cell">${dayName}</td>
        <td><span class="pattern-badge badge-${day.pattern.toLowerCase()}">${day.pattern}</span></td>
        ${cells.map((cell, i) => `
          <td>
            <div class="editable-cell" 
                 contenteditable="true"
                 data-day="${day.key}"
                 data-col="${i}"
                 oninput="autoSaveWeekly()"
                 onblur="autoSaveWeekly()">${escapeHtml(cell)}</div>
          </td>
        `).join('')}
        <td>
          <button class="day-action-btn" onclick="openDayBoard('${day.key}', '${day.pattern}')">
            <i class="fas fa-external-link-alt"></i> ${t('btn.open')}
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

let autoSaveTimeout = null;
function autoSaveWeekly() {
  clearTimeout(autoSaveTimeout);
  autoSaveTimeout = setTimeout(() => {
    const weekNum = getCurrentWeekNum();
    const key = 'week_' + weekNum;
    const weekData = getWeeklyData(weekNum);
    if (!weekData._columns) weekData._columns = DEFAULT_COLUMNS.map(c => ({ ...c }));

    document.querySelectorAll('.editable-header').forEach((th, i) => {
      if (weekData._columns[i]) {
        weekData._columns[i][currentLang] = th.textContent.trim();
      }
    });

    document.querySelectorAll('.editable-cell').forEach(cell => {
      const dayKey = cell.getAttribute('data-day');
      const col = parseInt(cell.getAttribute('data-col'));
      if (!weekData[dayKey]) weekData[dayKey] = { cells: [] };
      if (!weekData[dayKey].cells) weekData[dayKey].cells = [];
      weekData[dayKey].cells[col] = cell.textContent.trim();
    });

    DB.set(key, weekData);
    showAutoSave();
  }, 800);
}

// ===== DAILY BOARD =====
function openDayBoard(dayKey, pattern, navEl) {
  if (window.currentDayKey && window.currentWeekNum && autoSaveDailyTimeout) {
    clearTimeout(autoSaveDailyTimeout);
    autoSaveDailyTimeout = null;
    saveDailyData(true);
  }

  window.currentDayKey = dayKey;
  window.currentDayPattern = pattern;
  window.currentWeekNum = getCurrentWeekNum();

  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  if (navEl) navEl.classList.add('active');

  const dayData = getDailyData(window.currentWeekNum, dayKey, pattern);
  window.currentBlocks = dayData.blocks || JSON.parse(JSON.stringify(DEFAULT_BLOCKS[pattern] || DEFAULT_BLOCKS.A));

  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById('page-daily').classList.add('active');

  const dayInfo = WEEK_SCHEDULE.find(d => d.key === dayKey) || WEEK_SCHEDULE[0];
  const dayName = currentLang === 'ar' ? dayInfo.dayAr : dayInfo.dayEn;
  document.getElementById('dailyPageTitle').textContent = `Daily Execution Board - ${dayName}`;
  document.getElementById('dailyPageSubtitle').textContent = currentLang === 'ar' ? `النمط ${pattern} | ${getPatternShortDesc(pattern)}` : `Pattern ${pattern} | ${getPatternShortDesc(pattern)}`;

  renderPatternExplanation(pattern);
  renderBlocks(window.currentBlocks);

  const intBuilder = document.getElementById('integrationBuilder');
  if (intBuilder) intBuilder.style.display = pattern === 'C' ? 'block' : 'none';

  if (pattern === 'C' && dayData.integration) {
    const d = dayData.integration;
    if (document.getElementById('intMath')) document.getElementById('intMath').value = d.math || '';
    if (document.getElementById('intProg')) document.getElementById('intProg').value = d.prog || '';
    if (document.getElementById('intCS')) document.getElementById('intCS').value = d.cs || '';
    if (document.getElementById('intResult')) document.getElementById('intResult').value = d.result || '';
    if (document.getElementById('intRelation')) document.getElementById('intRelation').value = d.relation || '';
    if (d.math || d.prog || d.cs) renderIntegrationDiagram();
  }

  renderPerBlockSoundSettings();
}

function showDayPatternBoard(pattern, dayKey) {
  openDayBoard(dayKey || 'sat', pattern);
}

// ===== PATTERN EXPLANATION =====
function renderPatternExplanation(pattern) {
  const card = document.getElementById('patternExplanationCard');
  if (!card) return;
  const p = pattern.toLowerCase();
  card.className = `pattern-explanation-card pat-${p}`;

  const icons = { A: '🌟', B: '💪', C: '🔗', D: '🏆' };
  const accentVars = { A: 'var(--accent-a)', B: 'var(--accent-b)', C: 'var(--accent-c)', D: 'var(--accent-d)' };
  const accent = accentVars[pattern] || 'var(--accent-primary)';

  card.innerHTML = `
    <div class="pec-header">
      <div class="pec-icon">${icons[pattern]}</div>
      <div class="pec-titles">
        <div class="pec-tag" style="color:${accent};font-weight:800;font-size:0.75rem;text-transform:uppercase;letter-spacing:0.1em">${t(`pattern.${p}.tag`)}</div>
        <div class="pec-title">${t(`pattern.${p}.name`)} — ${t(`pattern.${p}.title`)}</div>
        <div class="pec-subtitle" style="color:var(--text-muted)">${t(`pattern.${p}.goal`)}</div>
      </div>
    </div>
    <p style="color:var(--text-secondary);line-height:1.8;font-size:0.9rem;margin-bottom:1rem">${t(`pattern.${p}.goalText`)}</p>
    <div class="pec-grid">
      <div class="pec-item">
        <div class="pec-item-title">💡 ${t(`pattern.${p}.example`)}</div>
        <div class="pec-item-text">${t(`pattern.${p}.exampleText`)}</div>
      </div>
      <div class="pec-item">
        <div class="pec-item-title">🎯 ${t(`pattern.${p}.focus`)}</div>
        <div class="pec-item-text" style="color:${accent}">${t(`pattern.${p}.focusText`)}</div>
      </div>
      <div class="pec-item">
        <div class="pec-item-title">✅ ${currentLang === 'ar' ? 'ما يجب فعله اليوم' : 'What to do today'}</div>
        <div class="pec-item-text" style="color:var(--accent-b)">${t(`pattern.${p}.focusText`)}</div>
      </div>
      <div class="pec-item">
        <div class="pec-item-title">🚫 ${t(`pattern.${p}.avoid`)}</div>
        <div class="pec-item-text" style="color:var(--accent-d)">${t(`pattern.${p}.avoidText`)}</div>
      </div>
    </div>
  `;
}

// ===== BLOCKS RENDERING =====
function renderBlocks(blocks) {
  const container = document.getElementById('blocksContainer');
  if (!container) return;
  container.innerHTML = '';

  blocks.forEach((block, index) => {
    container.appendChild(createBlockCard(block, index));
  });

  const addBtn = document.createElement('button');
  addBtn.className = 'add-block-btn';
  addBtn.innerHTML = `<i class="fas fa-plus"></i> ${currentLang === 'ar' ? 'إضافة بلوك جديد' : 'Add New Block'}`;
  addBtn.onclick = addNewBlock;
  container.appendChild(addBtn);

  initDragDrop();
}

function createBlockCard(block, index) {
  const card = document.createElement('div');
  card.className = 'block-card';
  card.setAttribute('data-block-id', block.id);
  card.setAttribute('data-duration', block.duration || 45);
  card.setAttribute('draggable', 'true');

  const blockName = typeof block.name === 'object' ? (block.name[currentLang] || block.name.ar || '') : (block.name || '');
  const blockActivity = typeof block.activity === 'object' ? (block.activity[currentLang] || block.activity.ar || '') : (block.activity || '');
  const duration = block.duration || 45;
  const isBreak = block.isBreak || false;

  const timerDisplay = timers[block.id] ? formatTime(timers[block.id].remaining) : formatTime(duration * 60);
  const status = timers[block.id]?.status || 'idle';

  card.innerHTML = `
    <div class="block-header">
      <span class="block-drag-handle"><i class="fas fa-grip-vertical"></i></span>
      <span class="block-time-badge">${block.timeStart || ''} - ${block.timeEnd || ''}</span>
      <input type="text" class="block-name-input" value="${escapeAttr(blockName)}"
             placeholder="${currentLang === 'ar' ? 'اسم البلوك' : 'Block name'}"
             onchange="updateBlockName('${block.id}', this.value)"
             ${isBreak ? 'style="color:var(--text-muted)"' : ''}>
      <input type="text" class="block-activity-input" value="${escapeAttr(blockActivity)}"
             placeholder="${currentLang === 'ar' ? 'النشاط...' : 'Activity...'}"
             onchange="updateBlockActivity('${block.id}', this.value)">
      <span class="block-timer-display">${timerDisplay}</span>
      <div class="block-actions">
        <button class="block-delete-btn" onclick="deleteBlock('${block.id}')" title="${currentLang === 'ar' ? 'حذف' : 'Delete'}">
          <i class="fas fa-trash-alt"></i>
        </button>
      </div>
    </div>
    <div class="block-body">
      <div class="block-timer-controls">
        <button class="timer-btn start" onclick="startTimer('${block.id}', ${duration})" 
                style="display:${status === 'running' ? 'none' : 'flex'}">
          <i class="fas fa-play"></i> ${t('timer.start')}
        </button>
        <button class="timer-btn pause" onclick="pauseTimer('${block.id}')"
                style="display:${status === 'running' ? 'flex' : 'none'}">
          <i class="fas fa-pause"></i> ${t('timer.pause')}
        </button>
        <button class="timer-btn resume" onclick="resumeTimer('${block.id}', ${duration})"
                style="display:${status === 'paused' ? 'flex' : 'none'}">
          <i class="fas fa-play"></i> ${t('timer.resume')}
        </button>
        <button class="timer-btn reset" onclick="resetTimer('${block.id}', ${duration})">
          <i class="fas fa-redo"></i> ${t('timer.reset')}
        </button>
        <button class="timer-btn skip" onclick="skipTimer('${block.id}')">
          <i class="fas fa-forward"></i> ${t('timer.skip')}
        </button>
        <button class="timer-btn details" onclick="openBlockPanel('${block.id}')">
          <i class="fas fa-edit"></i> ${t('timer.details')}
        </button>
      </div>
      <div class="timer-progress">
        <div class="timer-progress-bar" style="width:0%"></div>
      </div>
    </div>
  `;

  if (timers[block.id]) updateTimerDisplay(block.id);

  card.addEventListener('mouseenter', (e) => showBlockTooltip(e, block));
  card.addEventListener('mouseleave', hideTooltip);

  return card;
}

function updateBlockName(blockId, value) {
  const block = window.currentBlocks.find(b => b.id === blockId);
  if (block) {
    if (typeof block.name === 'object') {
      block.name.ar = value;
      block.name.en = value;
    } else {
      block.name = { ar: value, en: value };
    }
  }
  autoSaveDaily();
}

function updateBlockActivity(blockId, value) {
  const block = window.currentBlocks.find(b => b.id === blockId);
  if (block) {
    if (typeof block.activity === 'object') {
      block.activity.ar = value;
      block.activity.en = value;
    } else {
      block.activity = { ar: value, en: value };
    }
  }
  autoSaveDaily();
}

function addNewBlock() {
  const newBlock = {
    id: 'block_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
    timeStart: '00:00', timeEnd: '00:00',
    name: { ar: currentLang === 'ar' ? 'بلوك جديد' : 'New Block', en: 'New Block' },
    activity: { ar: '', en: '' },
    goal: '', learn: '', apply: '', notes: '', outputs: '', sound: '', duration: 60,
  };
  window.currentBlocks.push(newBlock);
  renderBlocks(window.currentBlocks);
  autoSaveDaily();
  setTimeout(() => {
    const newCard = document.querySelector(`.block-card[data-block-id="${newBlock.id}"]`);
    if (newCard) newCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, 100);
}

function deleteBlock(blockId) {
  window.currentBlocks = window.currentBlocks.filter(b => b.id !== blockId);
  renderBlocks(window.currentBlocks);
  autoSaveDaily();
  showToast(currentLang === 'ar' ? 'تم حذف البلوك' : 'Block deleted', 'info');
}

let autoSaveDailyTimeout = null;
function autoSaveDaily(immediate = false) {
  clearTimeout(autoSaveDailyTimeout);
  if (immediate) {
    saveDailyData(true);
    return;
  }
  autoSaveDailyTimeout = setTimeout(() => {
    if (!window.currentDayKey || !window.currentWeekNum) return;
    saveDailyData();
  }, 200);
}

// ===== DRAG & DROP =====
function initDragDrop() {
  const container = document.getElementById('blocksContainer');
  if (!container) return;
  const cards = container.querySelectorAll('.block-card');

  cards.forEach(card => {
    card.addEventListener('dragstart', (e) => {
      window._dragSrcEl = card;
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', card.getAttribute('data-block-id'));
      setTimeout(() => card.classList.add('dragging'), 0);
    });
    card.addEventListener('dragend', () => {
      card.classList.remove('dragging');
      container.querySelectorAll('.block-card').forEach(c => c.classList.remove('drag-over'));
    });
    card.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      if (window._dragSrcEl !== card) card.classList.add('drag-over');
    });
    card.addEventListener('dragleave', () => card.classList.remove('drag-over'));
    card.addEventListener('drop', (e) => {
      e.preventDefault();
      card.classList.remove('drag-over');
      if (window._dragSrcEl === card) return;

      const srcId = window._dragSrcEl.getAttribute('data-block-id');
      const tgtId = card.getAttribute('data-block-id');
      const srcIdx = window.currentBlocks.findIndex(b => b.id === srcId);
      const tgtIdx = window.currentBlocks.findIndex(b => b.id === tgtId);
      if (srcIdx === -1 || tgtIdx === -1) return;

      const [removed] = window.currentBlocks.splice(srcIdx, 1);
      window.currentBlocks.splice(tgtIdx, 0, removed);
      renderBlocks(window.currentBlocks);
      autoSaveDaily();
    });
  });
}

// ===== BLOCK DETAILS PANEL =====
let currentPanelBlockId = null;

function openBlockPanel(blockId) {
  currentPanelBlockId = blockId;
  const block = window.currentBlocks.find(b => b.id === blockId);
  if (!block) return;

  const name = typeof block.name === 'object' ? (block.name[currentLang] || block.name.ar || '') : (block.name || '');
  const activity = typeof block.activity === 'object' ? (block.activity[currentLang] || block.activity.ar || '') : (block.activity || '');
  const goal = typeof block.goal === 'object' ? (block.goal[currentLang] || block.goal.ar || '') : (block.goal || '');

  document.getElementById('panelName').value = name;
  document.getElementById('panelTimeStart').value = block.timeStart || '';
  document.getElementById('panelTimeEnd').value = block.timeEnd || '';
  document.getElementById('panelActivity').value = activity;
  document.getElementById('panelGoal').value = goal;
  document.getElementById('panelLearn').value = block.learn || '';
  document.getElementById('panelApply').value = block.apply || '';
  document.getElementById('panelNotes').value = block.notes || '';
  document.getElementById('panelOutputs').value = block.outputs || '';
  if (document.getElementById('panelSound')) document.getElementById('panelSound').value = block.sound || '';

  // FIX BUG 1: Remove inline display:none before adding .open class
  const bp = document.getElementById('blockPanel');
  const po = document.getElementById('panelOverlay');
  bp.style.display = '';
  po.style.display = '';
  // Force a reflow so the transition fires from the off-screen position
  void bp.offsetWidth;
  bp.classList.add('open');
  po.classList.add('active');
}

function closeBlockPanel() {
  const bp = document.getElementById('blockPanel');
  const po = document.getElementById('panelOverlay');
  bp.classList.remove('open');
  po.classList.remove('active');
  // Re-hide via display:none after transition completes so it doesn't render behind content
  setTimeout(() => {
    if (!bp.classList.contains('open')) {
      bp.style.display = 'none';
      po.style.display = 'none';
    }
  }, 350);
  currentPanelBlockId = null;
}

function savePanelData() {
  if (!currentPanelBlockId) return;
  const block = window.currentBlocks.find(b => b.id === currentPanelBlockId);
  if (!block) return;

  const name = document.getElementById('panelName').value;
  block.name = { ar: name, en: name };
  block.timeStart = document.getElementById('panelTimeStart').value;
  block.timeEnd = document.getElementById('panelTimeEnd').value;

  const activity = document.getElementById('panelActivity').value;
  block.activity = { ar: activity, en: activity };

  const goal = document.getElementById('panelGoal').value;
  block.goal = { ar: goal, en: goal };

  block.learn = document.getElementById('panelLearn').value;
  block.apply = document.getElementById('panelApply').value;
  block.notes = document.getElementById('panelNotes').value;
  block.outputs = document.getElementById('panelOutputs').value;
  block.sound = document.getElementById('panelSound')?.value || '';

  const card = document.querySelector(`.block-card[data-block-id="${currentPanelBlockId}"]`);
  if (card) {
    const newCard = createBlockCard(block, 0);
    card.replaceWith(newCard);
    initDragDrop();
  }

  closeBlockPanel();
  saveDailyData(true);
  showToast(t('toast.saved'), 'success');
}

// ===== INTEGRATION DIAGRAM =====
function renderIntegrationDiagram() {
  const math = document.getElementById('intMath')?.value || 'Math';
  const prog = document.getElementById('intProg')?.value || 'Programming';
  const cs = document.getElementById('intCS')?.value || 'Computer Science';
  const result = document.getElementById('intResult')?.value || 'Integrated Project';

  const diag = document.getElementById('integrationDiagram');
  if (!diag) return;

  diag.innerHTML = `
    <div class="diag-node math">${escapeHtml(math)}</div>
    <div class="diag-arrow">+</div>
    <div class="diag-node prog">${escapeHtml(prog)}</div>
    <div class="diag-arrow">+</div>
    <div class="diag-node cs">${escapeHtml(cs)}</div>
    <div class="diag-arrow" style="font-size:2rem;margin:0 1rem">↓</div>
    <div class="diag-node result" style="width:100%;text-align:center;font-size:1.1rem;margin-top:0.5rem">🚀 ${escapeHtml(result)}</div>
  `;
  autoSaveDaily();
}

// ===== TOOLTIP SYSTEM =====
function setupTooltipSystem() {
  document.addEventListener('mousemove', (e) => {
    const tooltip = document.getElementById('customTooltip');
    if (tooltip && tooltip.style.display !== 'none') {
      let x = e.clientX + 15;
      let y = e.clientY + 15;
      if (x + 290 > window.innerWidth) x = e.clientX - 290;
      if (y + 150 > window.innerHeight) y = e.clientY - 130;
      tooltip.style.left = x + 'px';
      tooltip.style.top = y + 'px';
    }
  });
}

function showBlockTooltip(e, block) {
  const tooltip = document.getElementById('customTooltip');
  if (!tooltip) return;
  const name = typeof block.name === 'object' ? (block.name[currentLang] || block.name.ar) : block.name;
  const goal = typeof block.goal === 'object' ? (block.goal[currentLang] || block.goal.ar) : (block.goal || '');
  const activity = typeof block.activity === 'object' ? (block.activity[currentLang] || block.activity.ar) : (block.activity || '');

  document.getElementById('tooltipHeader').textContent = name;
  document.getElementById('tooltipBody').innerHTML = `
    <div><strong>${currentLang === 'ar' ? 'الوقت:' : 'Time:'}</strong> ${block.timeStart} - ${block.timeEnd}</div>
    ${activity ? `<div><strong>${currentLang === 'ar' ? 'النشاط:' : 'Activity:'}</strong> ${escapeHtml(activity)}</div>` : ''}
    ${goal ? `<div><strong>${currentLang === 'ar' ? 'الهدف:' : 'Goal:'}</strong> ${escapeHtml(String(goal))}</div>` : ''}
    ${block.outputs ? `<div><strong>${currentLang === 'ar' ? 'المخرجات:' : 'Outputs:'}</strong> ${escapeHtml(block.outputs)}</div>` : ''}
    <div style="margin-top:4px;color:var(--accent-primary)"><strong>${currentLang === 'ar' ? 'المدة:' : 'Duration:'}</strong> ${block.duration || 45} ${currentLang === 'ar' ? 'دقيقة' : 'min'}</div>
  `;
  tooltip.style.display = 'block';
}

function hideTooltip() {
  const tooltip = document.getElementById('customTooltip');
  if (tooltip) tooltip.style.display = 'none';
}

// ===== TOAST NOTIFICATIONS =====
function showToast(msg, type = 'info') {
  const container = document.getElementById('toastContainer');
  if (!container) return;
  const icons = { success: 'fa-check-circle', error: 'fa-exclamation-circle', info: 'fa-info-circle' };
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<i class="fas ${icons[type] || icons.info}"></i> <span>${msg}</span>`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// ===== HELPER FUNCTIONS =====
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&')
    .replace(/</g, '<')
    .replace(/>/g, '>')
    .replace(/"/g, '"')
    .replace(/'/g, '&#39;');
}

function escapeAttr(str) {
  if (!str) return '';
  return String(str).replace(/"/g, '"').replace(/'/g, '&#39;');
}

// ===== KEYBOARD SHORTCUTS =====
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeUserGuide();
    closeBlockPanel();
    closeModal();
  }
});

// ===== WINDOW RESIZE =====
window.addEventListener('resize', () => {
  if (window.innerWidth <= 768) {
    document.getElementById('sidebar').classList.remove('collapsed');
  }
});

// ===== BEFORE UNLOAD WARNING =====
const hasUnsavedChanges = () => {
  return autoSaveDailyTimeout !== null;
};

window.addEventListener('beforeunload', (e) => {
  if (autoSaveDailyTimeout) {
    clearTimeout(autoSaveDailyTimeout);
    autoSaveDailyTimeout = null;
  }
  if (window.currentDayKey && window.currentWeekNum) {
    saveDailyData(true);
  }
  e.preventDefault();
  e.returnValue = '';
});

// ===== USER GUIDE SYSTEM =====
function buildOverviewContent() {
  if (currentLang === 'ar') {
    return `
      <h3><i class="fas fa-home"></i> فهم النظام قبل استخدامه</h3>
      <p>هذا النظام <strong>ليس جدول مذاكرة عادي</strong>. بل هو نظام تعلم طويل المدى مبنٍ على أسس علمية.</p>
      
      <h4>المراحل الأربع للمعرفة:</h4>
      <div class="highlight-box">
        <p><strong>1. التعلم</strong> - لا تحفظ، بل تفهم وتبني أول تطبيق.<br>
        <strong>2. الترسيخ</strong> - لا تنتقل مباشرة، حل مسائل وكرر حتى تصبح مهارة.<br>
        <strong>3. الدمج</strong> - أهم يوم، اربط المفاهيم وابنِ شيئاً حقيقياً.<br>
        <strong>4. الإنتاج</strong> - يوم الحصاد، اختبر نفسك وانتقل للمعرفة للذاكرة طويلة المدى.</p>
      </div>

      <h4>لماذا ترتيب الأسبوع هكذا؟</h4>
      <ul>
        <li><strong>السبت (A):</strong> بداية جديدة، طاقة عالية، تعلم مفهوماً جديداً</li>
        <li><strong>الأحد (B):</strong> تثبيت ما تعلمته السبت</li>
        <li><strong>الإثنين (A):</strong> طاقة إضافية، مواصلة التعلم</li>
        <li><strong>الثلاثاء (C):</strong> منتصف الأسبوع، وقت الدمج</li>
        <li><strong>الأربعاء (B):</strong> تثبيت ما تعلمته الإثنين</li>
        <li><strong>الخميس (C):</strong> دمج أعمق قبل الإغلاق</li>
        <li><strong>الجمعة (D):</strong> إغلاق الأسبوع وقياس</li>
      </ul>

      <div class="highlight-box">
        <p><strong>لماذا لا يوجد A A A A A؟</strong><br>
        التعلم الجديد وحده يؤدي إلى النسيان. تحتاج لترسيخ ما تعلمته. الدمج هو ما يصنع الفهم الحقيقي.</p>
      </div>
    `;
  } else {
    return `
      <h3><i class="fas fa-home"></i> Understanding the System</h3>
      <p>This system is <strong>not a regular study schedule</strong>. It is a long-term learning system built on scientific foundations.</p>
      
      <h4>Four Stages of Knowledge:</h4>
      <div class="highlight-box">
        <p><strong>1. Learn</strong> - Don't memorize, understand and build first application.<br>
        <strong>2. Reinforce</strong> - Don't move on, solve problems and repeat until it becomes a skill.<br>
        <strong>3. Integrate</strong> - Most important day, connect concepts and build something real.<br>
        <strong>4. Produce</strong> - Harvest day, test yourself and move knowledge to long-term memory.</p>
      </div>

      <h4>Why this weekly order?</h4>
      <ul>
        <li><strong>Saturday (A):</strong> Fresh start, high energy, learn new concept</li>
        <li><strong>Sunday (B):</strong> Reinforce what you learned Saturday</li>
        <li><strong>Monday (A):</strong> Extra energy, continue learning</li>
        <li><strong>Tuesday (C):</strong> Mid-week, integration time</li>
        <li><strong>Wednesday (B):</strong> Reinforce what you learned Monday</li>
        <li><strong>Thursday (C):</strong> Deeper integration before closure</li>
        <li><strong>Friday (D):</strong> Week closure and assessment</li>
      </ul>

      <div class="highlight-box">
        <p><strong>Why not A A A A A?</strong><br>
        New learning alone leads to forgetting. You need to reinforce. Integration creates real understanding.</p>
      </div>
    `;
  }
}

function buildPatternsContent() {
  if (currentLang === 'ar') {
    return `
      <h3><i class="fas fa-star"></i> شرح الأنماط الأربعة بالتفصيل</h3>

      <h4><span class="tag tag-a">النمط A - البذرة (Seed)</span></h4>
      <p><strong>الهدف:</strong> اكتساب معرفة جديدة لأول مرة.</p>
      <p><strong>متى:</strong> السبت، الإثنين (أول يوم في تعلم موضوع جديد).</p>
      <p><strong>ماذا تفعل:</strong></p>
      <ul>
        <li>تعلّم مفهوماً جديداً بالكامل</li>
        <li>دوّن ملاحظاتك</li>
        <li>ابني أول نموذج ذهني</li>
        <li>اكتب أول تطبيق بسيط</li>
      </ul>
      <p><strong>المفتاح:</strong> الفهم الأولي، لا الإتقان.</p>

      <h4><span class="tag tag-b">النمط B - الترسيخ (Reinforcement)</span></h4>
      <p><strong>الهدف:</strong> منع نسيان ما تعلمته وتحويله إلى مهارة.</p>
      <p><strong>متى:</strong> بعد يوم A مباشرة (الأحد بعد السبت، الأربعاء بعد الإثنين).</p>
      <p><strong>ماذا تفعل:</strong></p>
      <ul>
        <li>لا تتعلم مفهوماً جديداً</li>
        <li>حل 20+ مسألة على المفهوم</li>
        <li>اكتب كود بدون ملاحظات</li>
        <li>حسّن الكود القديم</li>
      </ul>
      <p><strong>المفتاح:</strong> التكرار المتعمد.</p>

      <h4><span class="tag tag-c">النمط C - الدمج العميق (Deep Integration)</span></h4>
      <p><strong>الهدف:</strong> ربط المفاهيم مع بعضها وبناء فهم متكامل.</p>
      <p><strong>متى:</strong> الثلاثاء، الخميس (منتصف الأسبوع). <strong>هذا أهم يوم.</strong></p>
      <p><strong>ماذا تفعل:</strong></p>
      <ul>
        <li>اختر 3+ مفاهيم مرتبطة</li>
        <li>افهم كيف ترتبط</li>
        <li>ابن مشروعاً واحداً يستخدمها جميعاً</li>
        <li>اكتب من ذاكرتك قدر الإمكان</li>
      </ul>
      <p><strong>المثال:</strong> Functions + Loops + Array = آلية تصفية</p>
      <p><strong>المفتاح:</strong> فهم العلاقات، بناء شيء متكامل.</p>

      <h4><span class="tag tag-d">النمط D - الإغلاق والإنتاج (Closure)</span></h4>
      <p><strong>الهدف:</strong> نقل المعرفة إلى الذاكرة طويلة المدى وقياس الفهم الحقيقي.</p>
      <p><strong>متى:</strong> الجمعة (آخر يوم في الأسبوع).</p>
      <p><strong>ماذا تفعل:</strong></p>
      <ul>
        <li>مراجعة شاملة</li>
        <li>اختبار ذاتي من الذاكرة</li>
        <li>كتابة شرح فاينمان</li>
        <li>إنهاء المشروع</li>
        <li>تقييم الأسبوع</li>
      </ul>
      <p><strong>المفتاح:</strong> الاختبار الصادق.</p>
    `;
  } else {
    return `
      <h3><i class="fas fa-star"></i> Four Patterns Explained</h3>

      <h4><span class="tag tag-a">Pattern A - Seed</span></h4>
      <p><strong>Goal:</strong> Acquire new knowledge for the first time.</p>
      <p><strong>When:</strong> Saturday, Monday (first day of learning a new topic).</p>
      <p><strong>What to do:</strong></p>
      <ul>
        <li>Learn a new concept completely</li>
        <li>Take notes</li>
        <li>Build first mental model</li>
        <li>Write first simple application</li>
      </ul>
      <p><strong>Key:</strong> Initial understanding, not mastery.</p>

      <h4><span class="tag tag-b">Pattern B - Reinforcement</span></h4>
      <p><strong>Goal:</strong> Prevent forgetting and turn knowledge into skill.</p>
      <p><strong>When:</strong> Right after Pattern A (Sunday after Saturday, Wednesday after Monday).</p>
      <p><strong>What to do:</strong></p>
      <ul>
        <li>Don't learn new concepts</li>
        <li>Solve 20+ problems on the concept</li>
        <li>Write code without notes</li>
        <li>Improve old code</li>
      </ul>
      <p><strong>Key:</strong> Deliberate repetition.</p>

      <h4><span class="tag tag-c">Pattern C - Deep Integration</span></h4>
      <p><strong>Goal:</strong> Connect concepts together and build integrated understanding.</p>
      <p><strong>When:</strong> Tuesday, Thursday (mid-week). <strong>This is the most important day.</strong></p>
      <p><strong>What to do:</strong></p>
      <ul>
        <li>Choose 3+ related concepts</li>
        <li>Understand how they connect</li>
        <li>Build one project using them all</li>
        <li>Write from memory as much as possible</li>
      </ul>
      <p><strong>Example:</strong> Functions + Loops + Array = filtering mechanism</p>
      <p><strong>Key:</strong> Understanding relationships, building something integrated.</p>

      <h4><span class="tag tag-d">Pattern D - Closure & Production</span></h4>
      <p><strong>Goal:</strong> Move knowledge to long-term memory and measure true understanding.</p>
      <p><strong>When:</strong> Friday (last day of the week).</p>
      <p><strong>What to do:</strong></p>
      <ul>
        <li>Comprehensive review</li>
        <li>Memory-based self-testing</li>
        <li>Write Feynman explanation</li>
        <li>Finish the project</li>
        <li>Evaluate the week</li>
      </ul>
      <p><strong>Key:</strong> Honest testing.</p>
    `;
  }
}

function buildWeeklyContent() {
  if (currentLang === 'ar') {
    return `
      <h3><i class="fas fa-calendar-week"></i> ما هو الجدول الأسبوعي؟</h3>
      <p>عرض شامل لـ 7 أيام في الأسبوع. كل يوم له نمط محدد يمكنك تعديل المهام فيه.</p>

      <h4>كيف تستخدمه؟</h4>

      <p><strong>1. تعديل أسماء الأعمدة:</strong></p>
      <p>اضغط على أي اسم عمود (رياضيات، برمجة...) واكتب الاسم الجديد مباشرة.</p>

      <p><strong>2. تعديل محتوى الخلايا:</strong></p>
      <p>اضغط على أي خلية واكتب المهمة لهذا اليوم. الحفظ happens تلقائياً.</p>

      <p><strong>3. التنقل بين الأسابيع:</strong></p>
      <p>استخدم أزرار < و > للانتقال بين الأسابيع. كل أسبوع له بياناته المستقلة.</p>

      <p><strong>4. تحديد نمط اليوم:</strong></p>
      <p>كل يوم له نمط محدد: السبت=A، الأحد=B، الإثنين=A، الثلاثاء=C، الأربعاء=B، الخميس=C، الجمعة=D</p>

      <h4>التسلسل الأسبوعي:</h4>
      <div class="highlight-box">
        <p>السبت → Pattern A (تعلم جديد)
الأحد → Pattern B (ترسيخ)
الإثنين → Pattern A (تعلم جديد)
الثلاثاء → Pattern C (دمج)
الأربعاء → Pattern B (ترسيخ)
الخميس → Pattern C (دمج)
الجمعة → Pattern D (إغلاق)</p>
      </div>
    `;
  } else {
    return `
      <h3><i class="fas fa-calendar-week"></i> What is the Weekly Schedule?</h3>
      <p>A comprehensive view of 7 days in the week. Each day has a specific pattern where you can edit tasks.</p>

      <h4>How to use it?</h4>

      <p><strong>1. Edit column headers:</strong></p>
      <p>Click on any column header and type the new name directly.</p>

      <p><strong>2. Edit cell content:</strong></p>
      <p>Click on any cell and type the task for that day. Auto-save works automatically.</p>

      <p><strong>3. Navigate between weeks:</strong></p>
      <p>Use < and > buttons to navigate between weeks. Each week has independent data.</p>

      <p><strong>4. Define day pattern:</strong></p>
      <p>Each day has a specific pattern: Saturday=A, Sunday=B, Monday=A, Tuesday=C, Wednesday=B, Thursday=C, Friday=D</p>

      <h4>Weekly sequence:</h4>
      <div class="highlight-box">
        <p>Saturday → Pattern A (New Learning)
Sunday → Pattern B (Reinforcement)
Monday → Pattern A (New Learning)
Tuesday → Pattern C (Integration)
Wednesday → Pattern B (Reinforcement)
Thursday → Pattern C (Integration)
Friday → Pattern D (Closure)</p>
      </div>
    `;
  }
}

const guideData = {
  overview: {
    title: currentLang === 'ar' ? 'نظرة عامة على النظام' : 'System Overview',
    content: buildOverviewContent()
  },
  patterns: {
    title: currentLang === 'ar' ? 'شرح الأنماط الأربعة' : 'Four Patterns Explanation',
    content: buildPatternsContent()
  },
  weekly: {
    title: currentLang === 'ar' ? 'الجدول الأسبوعي' : 'Weekly Schedule',
    content: buildWeeklyContent()
  },
  daily: {
    title: currentLang === 'ar' ? 'الجدول اليومي' : 'Daily Schedule',
    content: `
      <h3><i class="fas fa-calendar-day"></i> ${currentLang === 'ar' ? 'ما هو الجدول اليومي؟' : 'What is the Daily Schedule?'}</h3>
      <p>${currentLang === 'ar' ? 'عرض تفصيلي لبلوكات اليوم. كل بلوك هو وحدة زمنية (45-90 دقيقة) لمهمة محددة.' : 'A detailed view of the day\'s blocks. Each block is a time unit (45-90 minutes) for a specific task.'}</p>

      <h4>${currentLang === 'ar' ? 'مكونات البلوك:' : 'Block Components:'}</h4>

      <p><strong>1. ${currentLang === 'ar' ? 'الاسم' : 'Name'}</strong></p>
      <p>${currentLang === 'ar' ? 'اسم البلوك (رياضيات، برمجة، استراحة...).' : 'The block name (Mathematics, Programming, Break...).'}</p>

      <p><strong>2. ${currentLang === 'ar' ? 'النشاط' : 'Activity'}</strong></p>
      <p>${currentLang === 'ar' ? 'الخطوة العملية: "حل 20 مسألة"، "كتابة كود"...' : 'The practical step: "Solve 20 problems", "Write code"...'}</p>

      <p><strong>3. ${currentLang === 'ar' ? 'الهدف' : 'Goal'}</strong></p>
      <p>${currentLang === 'ar' ? 'النتيجة المرجوة من هذا البلوك.' : 'The expected outcome from this block.'}</p>

      <p><strong>4. ${currentLang === 'ar' ? 'ملاحظات' : 'Notes'}</strong></p>
      <p>${currentLang === 'ar' ? 'سجل الصعوبات، النقاط للمراجعة، الأفكار...' : 'Record difficulties, review points, ideas...'}</p>

      <p><strong>5. ${currentLang === 'ar' ? 'مخرجات' : 'Outputs'}</strong></p>
      <p>${currentLang === 'ar' ? 'النتائج الملموسة: "80 سطر كود"، "15 مسألة محلولة..."' : 'Tangible results: "80 lines of code", "15 solved problems..."'}</p>

      <h4>${currentLang === 'ar' ? 'إجراءات البلوك:' : 'Block Actions:'}</h4>
      <ul>
        <li><strong>${currentLang === 'ar' ? 'حذف' : 'Delete'}</strong> - ${currentLang === 'ar' ? 'حذف البلوك بالكامل' : 'Delete the entire block'}</li>
        <li><strong>${currentLang === 'ar' ? 'سحب وإفلات' : 'Drag & Drop'}</strong> - ${currentLang === 'ar' ? 'إعادة ترتيب البلوكات' : 'Reorder blocks'}</li>
        <li><strong>${currentLang === 'ar' ? 'تفاصيل' : 'Details'}</strong> - ${currentLang === 'ar' ? 'فتح لوحة التفاصيل الكاملة' : 'Open full details panel'}</li>
      </ul>
    `
  },
  timer: {
    title: currentLang === 'ar' ? 'المؤقت' : 'Timer',
    content: `
      <h3><i class="fas fa-clock"></i> ${currentLang === 'ar' ? 'كيف يعمل المؤقت؟' : 'How does the Timer work?'}</h3>
      <p>${currentLang === 'ar' ? 'كل بلوك له مؤقت خاص به يساعدك على إدارة الوقت بفعالية.' : 'Each block has its own timer to help you manage time effectively.'}</p>

      <h4>${currentLang === 'ar' ? 'أزرار التحكم:' : 'Control buttons:'}</h4>
      <ul>
        <li><strong>ابدأ</strong> - ${currentLang === 'ar' ? 'بدء العد التنازلي' : 'Start countdown'}</li>
        <li><strong>إيقاف</strong> - ${currentLang === 'ar' ? 'إيقاف مؤقت' : 'Pause'}</li>
        <li><strong>استئناف</strong> - ${currentLang === 'ar' ? 'متابعة من حيث توقفت' : 'Resume from where you stopped'}</li>
        <li><strong>إعادة</strong> - ${currentLang === 'ar' ? 'إعادة تعيين للوقت الكامل' : 'Reset to full time'}</li>
        <li><strong>تخطي</strong> - ${currentLang === 'ar' ? 'تجاوز هذا البلوك' : 'Skip this block'}</li>
      </ul>

      <h4>${currentLang === 'ar' ? 'الميزات:' : 'Features:'}</h4>
      <ul>
        <li>${currentLang === 'ar' ? 'شريط تقدم بصري' : 'Visual progress bar'}</li>
        <li>${currentLang === 'ar' ? 'تنبيه صوتي عند الانتهاء' : 'Sound notification when finished'}</li>
        <li>${currentLang === 'ar' ? 'Modal يعرض البلوك التالي' : 'Modal showing next block'}</li>
        <li>${currentLang === 'ar' ? 'حفظ تلقائي كل 10 ثواني' : 'Auto-save every 10 seconds'}</li>
        <li>${currentLang === 'ar' ? 'استرجاع بعد إغلاق المتصفح' : 'Restore after closing browser'}</li>
      </ul>

      <div class="highlight-box">
        <p><strong>${currentLang === 'ar' ? 'نصيحة:' : 'Tip:'}</strong> ${currentLang === 'ar' ? 'استخدم المؤقت لتدريب نفسك على إدارة الوقت.' : 'Use the timer to train yourself in time management.'}</p>
      </div>
    `
  },
  pdf: {
    title: currentLang === 'ar' ? 'التقارير (PDF)' : 'Reports (PDF)',
    content: `
      <h3><i class="fas fa-file-pdf"></i> ${currentLang === 'ar' ? 'كيف تصدر تقرير PDF؟' : 'How to export a PDF report?'}</h3>
      <p>${currentLang === 'ar' ? 'يمكنك تصدير تقرير يومي احترافي يحتوي على كل تفاصيل يومك.' : 'You can export a professional daily report containing all your day details.'}</p>

      <h4>${currentLang === 'ar' ? 'الخطوات:' : 'Steps:'}</h4>
      <ol>
        <li>${currentLang === 'ar' ? 'افتح صفحة اليوم (Daily Execution Board)' : 'Open the Day page (Daily Execution Board)'}</li>
        <li>${currentLang === 'ar' ? 'اضغط على زر "تصدير PDF يومي"' : 'Click "Export Daily PDF" button'}</li>
        <li>${currentLang === 'ar' ? 'اختر "Save as PDF" كطابعة' : 'Select "Save as PDF" as printer'}</li>
        <li>${currentLang === 'ar' ? 'اضغط Save' : 'Click Save'}</li>
      </ol>

      <h4>${currentLang === 'ar' ? 'محتوى التقرير:' : 'Report content:'}</h4>
      <p><strong>${currentLang === 'ar' ? 'الصفحة 1 - الغلاف:' : 'Page 1 - Cover:'}</strong></p>
      <ul>
        <li>${currentLang === 'ar' ? 'اسم المستخدم والتاريخ واليوم والأسبوع والنمط' : 'Username, Date, Day, Week, Pattern'}</li>
      </ul>

      <p><strong>${currentLang === 'ar' ? 'الصفحة 2 - الجدول:' : 'Page 2 - Table:'}</strong></p>
      <ul>
        <li>${currentLang === 'ar' ? 'جدول كامل بجميع البلوكات مع الوقت والنشاط والهدف والملاحظات والمخرجات' : 'Complete table of all blocks with time, activity, goal, notes, outputs'}</li>
      </ul>

      <p><strong>${currentLang === 'ar' ? 'الصفحة 3 - الأهداف والملاحظات:' : 'Page 3 - Goals & Notes:'}</strong></p>
      <ul>
        <li>${currentLang === 'ar' ? 'قائمة منفصلة بالأهداف والملاحظات' : 'Separate list of goals and notes'}</li>
      </ul>

      <p><strong>${currentLang === 'ar' ? 'الصفحة 4 - المخرجات والخلاصة:' : 'Page 4 - Outputs & Summary:'}</strong></p>
      <ul>
        <li>${currentLang === 'ar' ? 'قائمة المخرجات + أسئلة تأمل' : 'Outputs list + reflection questions'}</li>
      </ul>
    `
  },
  about: {
    title: currentLang === 'ar' ? 'حول النظام' : 'About',
    content: `
      <h3><i class="fas fa-info-circle"></i> ${currentLang === 'ar' ? 'معلومات عن النظام' : 'System Information'}</h3>
      
      <h4>${currentLang === 'ar' ? 'الاسم:' : 'Name:'}</h4>
      <p><strong>Murad Learning Planner</strong></p>

      <h4>${currentLang === 'ar' ? 'الفكرة:' : 'Concept:'}</h4>
      <p>${currentLang === 'ar' ? 'نظام دراسي يومي متكامل يعتمد على منهجية التعلم - الترسيخ - الدمج - الاختبار.' : 'An integrated daily learning system based on Learn - Reinforce - Integrate - Test methodology.'}</p>

      <h4>${currentLang === 'ar' ? 'الأهداف:' : 'Goals:'}</h4>
      <ul>
        <li>${currentLang === 'ar' ? 'تنظيم الدراسة بشكل احترافي' : 'Organize study professionally'}</li>
        <li>${currentLang === 'ar' ? 'ربط المفاهيم عبر المواد' : 'Connect concepts across subjects'}</li>
        <li>${currentLang === 'ar' ? 'قياس الفهم الحقيقي' : 'Measure true understanding'}</li>
        <li>${currentLang === 'ar' ? 'بناء عادة تعلم يومية مستدامة' : 'Build sustainable daily learning habit'}</li>
      </ul>

      <h4>${currentLang === 'ar' ? 'الآلية:' : 'How it works:'}</h4>
      <p>${currentLang === 'ar' 
        ? '1. خطة أسبوعية مسبقة\n2. كل يوم له نمط محدد (A/B/C/D)\n3. كل نمط له بلوكات زمنية\n4. تشغل المؤقت لكل بلوك\n5. تسجل الملاحظات والمخرجات\n6. تصدر تقرير PDF'
        : '1. Pre-made weekly plan\n2. Each day has pattern (A/B/C/D)\n3. Each pattern has time blocks\n4. Run timer for each block\n5. Record notes and outputs\n6. Export PDF report'}</p>

      <h4>${currentLang === 'ar' ? 'المميزات:' : 'Main Features:'}</h4>
      <ul>
        <li>${currentLang === 'ar' ? 'جدول أسبوعي قابل للتعديل' : 'Fully editable weekly schedule'}</li>
        <li>${currentLang === 'ar' ? '4 أنماط تعلم علمية' : '4 scientific learning patterns'}</li>
        <li>${currentLang === 'ar' ? 'مؤقت لكل بلوك' : 'Timer for each block'}</li>
        <li>${currentLang === 'ar' ? 'Integration Builder' : 'Integration Builder'}</li>
        <li>${currentLang === 'ar' ? 'نظام أصوات مخصص' : 'Custom sound system'}</li>
        <li>${currentLang === 'ar' ? 'تصدير PDF احترافي' : 'Professional PDF export'}</li>
        <li>${currentLang === 'ar' ? 'ثنائية اللغة' : 'Bilingual (Arabic/English)'}</li>
        <li>${currentLang === 'ar' ? 'Dark/Light Mode' : 'Dark/Light Mode'}</li>
      </ul>
    `
  }
};

function toggleUserGuide() {
  const panel = document.getElementById('guidePanel');
  const overlay = document.getElementById('guideOverlay');
  const isActive = panel.classList.contains('active');
  
  if (isActive) {
    closeUserGuide();
  } else {
    openUserGuide();
  }
}

function openUserGuide() {
  const panel = document.getElementById('guidePanel');
  const overlay = document.getElementById('guideOverlay');
  // FIX BUG 1: Remove inline display:none before adding .active class
  panel.style.display = '';
  overlay.style.display = '';
  void panel.offsetWidth; // Force reflow so transform transition fires correctly
  panel.classList.add('active');
  overlay.classList.add('active');
  switchGuideTab('overview', document.querySelector('.guide-tab'));
}

function closeUserGuide() {
  const panel = document.getElementById('guidePanel');
  const overlay = document.getElementById('guideOverlay');
  panel.classList.remove('active');
  overlay.classList.remove('active');
  // Re-hide via display:none after transition completes
  setTimeout(() => {
    if (!panel.classList.contains('active')) {
      panel.style.display = 'none';
      overlay.style.display = 'none';
    }
  }, 450);
}

function switchGuideTab(tabName, tabElement) {
  document.querySelectorAll('.guide-tab').forEach(t => t.classList.remove('active'));
  if (tabElement) tabElement.classList.add('active');
  
  const content = document.getElementById('guideContent');
  const data = guideData[tabName];
  
  if (data) {
    content.innerHTML = `
      <div class="guide-section active">
        ${data.content}
      </div>
    `;
  }
}

// ===== SOUND SYSTEM =====
const audioContext = new (window.AudioContext || window.webkitAudioContext)();
const audioBuffers = {};

async function initSoundSystem() {
  // Load default sounds
}

function playAlarmSound(blockId) {
  const block = window.currentBlocks.find(b => b.id === blockId);
  const soundType = block?.sound || settings.defaultSound;
  
  // Use Web Audio API to generate sound
  const oscillator = audioContext.createOscillator();
  const gainNode = audioContext.createGain();
  
  oscillator.connect(gainNode);
  gainNode.connect(audioContext.destination);
  
  switch(soundType) {
    case 'bell':
      oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
      oscillator.type = 'sine';
      break;
    case 'digital':
      oscillator.frequency.setValueAtTime(1000, audioContext.currentTime);
      oscillator.type = 'square';
      break;
    default:
      oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
      oscillator.type = 'sine';
  }
  
  gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
  oscillator.start();
  oscillator.stop(audioContext.currentTime + 0.5);
}

// ===== EXPORT PDF =====
async function exportDailyPDF() {
  showToast('جاري فتح نافذة الطباعة...', 'info');

  const ls = document.getElementById('loading-screen');
  const lm = document.getElementById('loading-msg');
  if (ls) { ls.style.display = 'flex'; ls.style.zIndex = '9999'; if (lm) lm.textContent = 'بناء التقرير...'; }

  try {
    if (window.currentDayKey && window.currentWeekNum) {
      saveDailyData(true);
    }

    const userName = (window.settings?.userName) || 'مراد';
    const weekNum = String(window.currentWeekNum || 1);
    
    let dayKey = window.currentDayKey || 'sat';
    let pattern = window.currentDayPattern || 'A';
    let blocks = [];
    
    if (dayKey && weekNum) {
      const dayData = getDailyData(weekNum, dayKey, pattern);
      blocks = dayData.blocks || [];
    }
    
    const dayInfo = (WEEK_SCHEDULE || []).find(d => d.key === dayKey) || { dayAr: 'السبت', dayEn: 'Saturday' };
    const dayName = dayInfo.dayAr || dayInfo.dayEn;
    const goals = blocks.filter(b => b.goal && b.goal.toString().trim());
    const notes = blocks.filter(b => b.notes && b.notes.toString().trim());
    const outputs = blocks.filter(b => b.outputs && b.outputs.toString().trim());

    const now = new Date();
    const today = now.toLocaleDateString('ar-SA');

    const descs = {
      A: 'اكتشاف مفاهيم ومهارات جديدة',
      B: 'تعميق الفهم وتثبيت المعرفة',
      C: 'ربط المفاهيم وبناء فهم متكامل',
      D: 'اختبار وتقييم الأسبوع'
    };

    const sBlocks = blocks.filter(b => !b.isBreak);

    const printWindow = window.open('', '_blank', 'width=1000,height=700');
    if (!printWindow) throw new Error('يجب السماح بالنوافذ المنبثقة (pop-ups)');

    const html = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8">
<title>تقرير ${userName}</title>
<link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700&display=swap" rel="stylesheet">
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
@page { size: A4; margin: 0; }
body { font-family: 'Tajawal', sans-serif; font-size: 11pt; color: #0f172a; }

.cover { width: 210mm; min-height: 297mm; background: #f8fafc; position: relative; }
.cover-header { height: 14mm; background: linear-gradient(90deg, #2563eb, #0ea5e9); }
.cover-body { padding: 15mm 20mm; }
.cover-brand { font-size: 42pt; font-weight: 700; text-align: center; color: #0f172a; }
.cover-title-ar { font-size: 20pt; font-weight: 700; color: #2563eb; text-align: center; margin-top: 18px; }
.cover-line { width: 70mm; height: 2px; background: #2563eb; margin: 14px auto; position: relative; }
.info-card { max-width: 170mm; margin: 10px auto 0; background: #fff; border-radius: 8px; box-shadow: 0 2px 12px rgba(0,0,0,0.06); overflow: hidden; }
.info-card-bar { height: 7mm; background: linear-gradient(90deg, #2563eb, #0ea5e9); }
.info-card-body { padding: 10mm 12mm; }
.info-row { display: flex; justify-content: space-between; align-items: center; padding: 4mm 0; border-bottom: 1px dotted #f1f5f9; }
.info-row:last-child { border-bottom: none; }
.info-label { font-size: 10.5pt; color: #64748b; }
.info-value { font-size: 12pt; font-weight: 700; color: #0f172a; }
.cover-footer { position: absolute; bottom: 0; width: 100%; height: 22mm; background: #0f172a; display: flex; align-items: center; justify-content: space-between; padding: 0 20mm; }
.cover-footer span { color: #fff; font-size: 11pt; font-weight: 500; }

.page { width: 210mm; min-height: 297mm; padding: 15mm 20mm; page-break-after: always; background: #f8fafc; }
.page:last-child { page-break-after: avoid; }
.page-header { margin-bottom: 6mm; padding-bottom: 2mm; border-bottom: 3px solid #2563eb; }
.page-title { font-size: 17pt; font-weight: 700; color: #2563eb; }

.stats { display: flex; gap: 4mm; margin-bottom: 8mm; }
.stat-box { flex: 1; background: #fff; border-radius: 6px; padding: 5mm; border: 1px solid #e2e8f0; text-align: center; position: relative; }
.stat-box::before { content: ''; position: absolute; top: 0; right: 0; width: 100%; height: 4mm; background: var(--c); border-radius: 6px 6px 0 0; }
.stat-val { font-size: 26pt; font-weight: 700; color: var(--c); margin-top: 2mm; }
.stat-lbl { font-size: 8.5pt; color: #64748b; margin-top: 1mm; }

.pattern-bar { background: #fff; border-radius: 6px; padding: 6mm 10mm; border: 1px solid #e2e8f0; margin-bottom: 8mm; display: flex; align-items: center; gap: 6mm; }
.pattern-stripe { width: 5mm; height: 22mm; background: #2563eb; border-radius: 3px; }
.pattern-body { flex: 1; }
.pattern-title { font-size: 13pt; font-weight: 700; color: #2563eb; }
.pattern-desc { font-size: 9.5pt; color: #64748b; margin-top: 2mm; }

.sec { font-size: 15pt; font-weight: 700; color: #0f172a; margin: 10mm 0 5mm; padding-bottom: 1.5mm; border-bottom: 2px solid var(--sc); }

table { width: 100%; border-collapse: collapse; margin-top: 3mm; font-size: 9.5pt; }
th { background: #2563eb; color: #fff; padding: 4mm 5mm; font-weight: 700; text-align: center; font-size: 10pt; }
td { padding: 3.5mm 5mm; border: 1px solid #e2e8f0; text-align: right; vertical-align: middle; }
tr:nth-child(even) td { background: #f8fafc; }

.card { background: #fff; border-radius: 6px; padding: 6mm; margin-bottom: 5mm; border: 1px solid #e2e8f0; }
.card-goal { border-right: 5mm solid #10b981; }
.card-note { border-right: 5mm solid #0ea5e9; }
.card-output { border-right: 5mm solid #22c55e; }
.card-head { display: flex; justify-content: space-between; margin-bottom: 3mm; }
.card-name { font-weight: 700; font-size: 10.5pt; color: #0f172a; }
.card-time { font-size: 8.5pt; color: #64748b; }
.card-body { font-size: 9.5pt; color: #334155; line-height: 1.7; }

.ref-box { background: #fff; border-radius: 6px; padding: 5mm 8mm; margin-bottom: 5mm; border: 1px solid #e2e8f0; }
.ref-q { font-weight: 700; font-size: 10.5pt; color: #0f172a; margin-bottom: 2mm; display: flex; align-items: center; gap: 4mm; }
.ref-dot { width: 6mm; height: 6mm; border-radius: 50%; flex-shrink: 0; }
.ref-hint { font-size: 8.5pt; color: #94a3b8; }

.footer { margin-top: 12mm; padding-top: 3mm; border-top: 1px solid #e2e8f0; display: flex; justify-content: space-between; font-size: 8.5pt; color: #64748b; }

@media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
</style>
</head>
<body>

<div class="cover">
  <div class="cover-header"></div>
  <div class="cover-body">
    <div class="cover-brand">Murad Planner</div>
    <div class="cover-title-ar">دفتر التعلم الاحترافي</div>
    <div class="cover-line"></div>
    <div class="info-card">
      <div class="info-card-bar"></div>
      <div class="info-card-body">
        <div class="info-row"><span class="info-label">التاريخ</span><span class="info-value">${today}</span></div>
        <div class="info-row"><span class="info-label">اليوم</span><span class="info-value">${dayName}</span></div>
        <div class="info-row"><span class="info-label">الأسبوع</span><span class="info-value">${weekNum}</span></div>
        <div class="info-row"><span class="info-label">النمط</span><span class="info-value">${pattern} — ${descs[pattern]||''}</span></div>
      </div>
    </div>
  </div>
  <div class="cover-footer">
    <span>نظام دراسة ${userName}</span>
    <span>Murad Planner v3</span>
  </div>
</div>

<div class="page">
  <div class="page-header">
    <div class="page-title">ملخص اليوم</div>
    <div style="font-size:10pt;color:#64748b">${dayName}</div>
  </div>
  <div class="stats">
    <div class="stat-box" style="--c:#2563eb"><div class="stat-val">${blocks.length}</div><div class="stat-lbl">بلوكات الدراسة</div></div>
    <div class="stat-box" style="--c:#10b981"><div class="stat-val">${goals.length}</div><div class="stat-lbl">أهداف مسجلة</div></div>
    <div class="stat-box" style="--c:#0ea5e9"><div class="stat-val">${notes.length}</div><div class="stat-lbl">ملاحظات</div></div>
    <div class="stat-box" style="--c:#22c55e"><div class="stat-val">${outputs.length}</div><div class="stat-lbl">مخرجات</div></div>
  </div>
  <div class="pattern-bar">
    <div class="pattern-stripe"></div>
    <div class="pattern-body">
      <div class="pattern-title">النمط ${pattern}</div>
      <div class="pattern-desc">${descs[pattern]||''}</div>
    </div>
  </div>
  <div class="sec" style="--sc:#2563eb">الجدول اليومي</div>
  ${sBlocks.length ? '<table><thead><tr><th>الوقت</th><th>النشاط</th><th>الهدف</th><th>الملاحظات</th><th>المخرجات</th></tr></thead><tbody>' + sBlocks.map(b => {
    return `<tr>
      <td style="white-space:nowrap;text-align:center;font-weight:bold;color:#2563eb">${b.timeStart}${b.timeEnd ? ' - ' + b.timeEnd : ''}</td>
      <td>${escapeHtml(b.name)}</td>
      <td>${escapeHtml(b.goal)}</td>
      <td>${escapeHtml(b.notes)}</td>
      <td>${escapeHtml(b.outputs)}</td>
    </tr>`;
  }).join('') + '</tbody></table>' : '<p style="text-align:center;color:#94a3b8;padding:10mm">لا توجد بلوكات</p>'}
  <div class="footer"><span></span><span>Murad Planner</span></div>
</div>

<div class="page">
  <div class="page-header">
    <div class="page-title">الأهداف والملاحظات</div>
    <div style="font-size:10pt;color:#64748b">${dayName}</div>
  </div>
  <div class="sec" style="--sc:#10b981">أهداف اليوم</div>
  ${goals.length ? goals.map(g => `<div class="card card-goal">
    <div class="card-head"><span class="card-name">${escapeHtml(g.name)}</span><span class="card-time">${escapeHtml(g.timeStart)}${g.timeEnd ? ' - ' + escapeHtml(g.timeEnd) : ''}</span></div>
    <div class="card-body">${escapeHtml(g.goal)}</div>
  </div>`).join('') : '<div class="card"><div class="card-body">لا توجد أهداف مسجلة</div></div>'}
  <div class="sec" style="--sc:#0ea5e9;margin-top:10mm">ملاحظات اليوم</div>
  ${notes.length ? notes.map(n => `<div class="card card-note">
    <div class="card-head"><span class="card-name">${escapeHtml(n.name)}</span><span class="card-time">${escapeHtml(n.timeStart)}${n.timeEnd ? ' - ' + escapeHtml(n.timeEnd) : ''}</span></div>
    <div class="card-body">${escapeHtml(n.notes)}</div>
  </div>`).join('') : '<div class="card"><div class="card-body">لا توجد ملاحظات مسجلة</div></div>'}
  <div class="footer"><span></span><span>Murad Planner</span></div>
</div>

<div class="page">
  <div class="page-header">
    <div class="page-title">المخرجات والخلاصة</div>
    <div style="font-size:10pt;color:#64748b">${dayName}</div>
  </div>
  <div class="sec" style="--sc:#22c55e">مخرجات اليوم</div>
  ${outputs.length ? outputs.map(o => `<div class="card card-output">
    <div class="card-head"><span class="card-name">${escapeHtml(o.name)}</span><span class="card-time">${escapeHtml(o.timeStart)}${o.timeEnd ? ' - ' + escapeHtml(o.timeEnd) : ''}</span></div>
    <div class="card-body">${escapeHtml(o.outputs)}</div>
  </div>`).join('') : '<div class="card"><div class="card-body">لا توجد مخرجات مسجلة</div></div>'}
  <div class="sec" style="--sc:#f59e0b;margin-top:10mm">خلاصة اليوم</div>
  <div class="ref-box"><div class="ref-q"><span class="ref-dot" style="background:#2563eb"></span>ما الذي تعلمته اليوم؟</div><div class="ref-hint">اكتب هنا أبرز الدروس والمفاهيم</div></div>
  <div class="ref-box"><div class="ref-q"><span class="ref-dot" style="background:#f59e0b"></span>ما الذي يحتاج مراجعة؟</div><div class="ref-hint">سجل النقاط التي واجهت صعوبة فيها</div></div>
  <div class="ref-box"><div class="ref-q"><span class="ref-dot" style="background:#22c55e"></span>ما الذي سأفعله غداً؟</div><div class="ref-hint">حدد الخطوات والأهداف لليوم القادم</div></div>
  <div class="footer"><span></span><span>Murad Planner</span></div>
</div>

</body>
</html>`;

    printWindow.document.write(html);
    printWindow.document.close();

    setTimeout(() => {
      printWindow.focus();
      printWindow.print();
      showToast('اختر "Save as PDF" من نافذة الطباعة', 'success');
      if (ls) { ls.style.display = 'none'; ls.style.zIndex = ''; }
    }, 600);

  } catch (err) {
    console.error('[PDF] Error:', err);
    showToast('حدث خطأ: ' + (err.message || err), 'error');
    if (ls) { ls.style.display = 'none'; ls.style.zIndex = ''; }
  }
}

async function exportWeeklyPDF() {
  showToast('تقرير الأسبوع قيد التطوير', 'info');
}

// ===== INITIALIZE =====
window.timers = {};