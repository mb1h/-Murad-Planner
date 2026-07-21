/* ============================================================
   MURAD LEARNING PLANNER - Data & Storage
   ============================================================ */

// ===== WEEK SCHEDULE CONFIG =====
const WEEK_SCHEDULE = [
  { key: 'sat', dayAr: 'السبت',    dayEn: 'Saturday',  pattern: 'A' },
  { key: 'sun', dayAr: 'الأحد',    dayEn: 'Sunday',    pattern: 'B' },
  { key: 'mon', dayAr: 'الإثنين',  dayEn: 'Monday',    pattern: 'A' },
  { key: 'tue', dayAr: 'الثلاثاء', dayEn: 'Tuesday',   pattern: 'C' },
  { key: 'wed', dayAr: 'الأربعاء', dayEn: 'Wednesday', pattern: 'B' },
  { key: 'thu', dayAr: 'الخميس',   dayEn: 'Thursday',  pattern: 'C' },
  { key: 'fri', dayAr: 'الجمعة',   dayEn: 'Friday',    pattern: 'D' },
];

// ===== DEFAULT BLOCKS PER PATTERN =====
const DEFAULT_BLOCKS = {
  A: [
    { id: 'r1', timeStart: '08:00', timeEnd: '08:45', name: { ar: 'مراجعة', en: 'Review' }, activity: { ar: 'Anki + Active Recall', en: 'Anki + Active Recall' }, goal: { ar: 'مراجعة المفاهيم السابقة', en: 'Review previous concepts' }, learn: '', apply: '', notes: '', outputs: '', sound: '', duration: 45 },
    { id: 'r2', timeStart: '08:45', timeEnd: '10:15', name: { ar: 'رياضيات', en: 'Mathematics' }, activity: { ar: 'مفهوم جديد', en: 'New Concept' }, goal: { ar: 'تعلم مفهوم رياضي جديد', en: 'Learn a new math concept' }, learn: '', apply: '', notes: '', outputs: '', sound: '', duration: 90 },
    { id: 'r3', timeStart: '10:15', timeEnd: '10:30', name: { ar: 'استراحة', en: 'Break' }, activity: { ar: 'راحة قصيرة', en: 'Short break' }, goal: { ar: 'تجديد التركيز', en: 'Refresh focus' }, learn: '', apply: '', notes: '', outputs: '', sound: '', duration: 15, isBreak: true },
    { id: 'r4', timeStart: '10:30', timeEnd: '11:30', name: { ar: 'برمجة', en: 'Programming' }, activity: { ar: 'التطبيق الأول', en: 'First Implementation' }, goal: { ar: 'تطبيق المفهوم أول مرة', en: 'First application of the concept' }, learn: '', apply: '', notes: '', outputs: '', sound: '', duration: 60 },
    { id: 'r5', timeStart: '11:30', timeEnd: '13:00', name: { ar: 'علوم الحاسوب', en: 'Computer Science' }, activity: { ar: 'مفهوم جديد', en: 'New Concept' }, goal: { ar: 'تعلم مفهوم CS جديد', en: 'Learn a new CS concept' }, learn: '', apply: '', notes: '', outputs: '', sound: '', duration: 90 },
    { id: 'r6', timeStart: '13:00', timeEnd: '14:00', name: { ar: 'غداء', en: 'Lunch' }, activity: { ar: 'استراحة الغداء', en: 'Lunch break' }, goal: { ar: 'راحة ووجبة', en: 'Rest and meal' }, learn: '', apply: '', notes: '', outputs: '', sound: '', duration: 60, isBreak: true },
    { id: 'r7', timeStart: '14:00', timeEnd: '15:30', name: { ar: 'تطبيق متكامل', en: 'Integration' }, activity: { ar: 'رياضيات + برمجة', en: 'Math + Programming' }, goal: { ar: 'دمج المفاهيم الجديدة', en: 'Connect new concepts' }, learn: '', apply: '', notes: '', outputs: '', sound: '', duration: 90 },
    { id: 'r8', timeStart: '15:30', timeEnd: '15:45', name: { ar: 'استراحة', en: 'Break' }, activity: { ar: 'راحة قصيرة', en: 'Short break' }, goal: { ar: 'تجديد التركيز', en: 'Refresh focus' }, learn: '', apply: '', notes: '', outputs: '', sound: '', duration: 15, isBreak: true },
    { id: 'r9', timeStart: '15:45', timeEnd: '16:45', name: { ar: 'مشروع', en: 'Project' }, activity: { ar: 'بدء المشروع', en: 'Start Project' }, goal: { ar: 'بدء تنفيذ المشروع', en: 'Start the project implementation' }, learn: '', apply: '', notes: '', outputs: '', sound: '', duration: 60 },
    { id: 'r10', timeStart: '16:45', timeEnd: '17:30', name: { ar: 'إغلاق', en: 'Closing' }, activity: { ar: 'Anki + ملخص', en: 'Anki + Summary' }, goal: { ar: 'مراجعة ما تعلمته اليوم', en: 'Review what you learned today' }, learn: '', apply: '', notes: '', outputs: '', sound: '', duration: 45 },
  ],
  B: [
    { id: 'b1', timeStart: '08:00', timeEnd: '08:45', name: { ar: 'مراجعة', en: 'Review' }, activity: { ar: 'Anki', en: 'Anki' }, goal: { ar: 'مراجعة بطاقات Anki', en: 'Review Anki cards' }, learn: '', apply: '', notes: '', outputs: '', sound: '', duration: 45 },
    { id: 'b2', timeStart: '08:45', timeEnd: '10:15', name: { ar: 'رياضيات', en: 'Mathematics' }, activity: { ar: 'حل مسائل', en: 'Solve Problems' }, goal: { ar: 'ترسيخ المفاهيم الرياضية', en: 'Reinforce math concepts' }, learn: '', apply: '', notes: '', outputs: '', sound: '', duration: 90 },
    { id: 'b3', timeStart: '10:15', timeEnd: '10:30', name: { ar: 'استراحة', en: 'Break' }, activity: { ar: 'راحة قصيرة', en: 'Short break' }, goal: '', learn: '', apply: '', notes: '', outputs: '', sound: '', duration: 15, isBreak: true },
    { id: 'b4', timeStart: '10:30', timeEnd: '11:30', name: { ar: 'برمجة', en: 'Programming' }, activity: { ar: 'تحسين كود الأمس', en: 'Improve Yesterday Code' }, goal: { ar: 'تحسين وترسيخ الكود', en: 'Improve and reinforce code' }, learn: '', apply: '', notes: '', outputs: '', sound: '', duration: 60 },
    { id: 'b5', timeStart: '11:30', timeEnd: '13:00', name: { ar: 'علوم الحاسوب', en: 'Computer Science' }, activity: { ar: 'تدريب عميق', en: 'Deep Practice' }, goal: { ar: 'ترسيخ مفاهيم CS', en: 'Reinforce CS concepts' }, learn: '', apply: '', notes: '', outputs: '', sound: '', duration: 90 },
    { id: 'b6', timeStart: '13:00', timeEnd: '14:00', name: { ar: 'غداء', en: 'Lunch' }, activity: { ar: 'استراحة الغداء', en: 'Lunch break' }, goal: '', learn: '', apply: '', notes: '', outputs: '', sound: '', duration: 60, isBreak: true },
    { id: 'b7', timeStart: '14:00', timeEnd: '15:30', name: { ar: 'تطبيق متكامل', en: 'Application' }, activity: { ar: 'تطوير العمل السابق', en: 'Improve Previous Work' }, goal: { ar: 'تطوير وتحسين التطبيقات', en: 'Develop and improve applications' }, learn: '', apply: '', notes: '', outputs: '', sound: '', duration: 90 },
    { id: 'b8', timeStart: '15:30', timeEnd: '15:45', name: { ar: 'استراحة', en: 'Break' }, activity: { ar: 'راحة قصيرة', en: 'Short break' }, goal: '', learn: '', apply: '', notes: '', outputs: '', sound: '', duration: 15, isBreak: true },
    { id: 'b9', timeStart: '15:45', timeEnd: '16:45', name: { ar: 'مشروع', en: 'Project' }, activity: { ar: 'إضافة مميزات', en: 'Add Features' }, goal: { ar: 'تطوير المشروع', en: 'Develop project features' }, learn: '', apply: '', notes: '', outputs: '', sound: '', duration: 60 },
    { id: 'b10', timeStart: '16:45', timeEnd: '17:30', name: { ar: 'إغلاق', en: 'Closing' }, activity: { ar: 'مراجعة الترسيخ', en: 'Reinforcement Review' }, goal: { ar: 'إغلاق اليوم بمراجعة', en: 'Close day with review' }, learn: '', apply: '', notes: '', outputs: '', sound: '', duration: 45 },
  ],
  C: [
    { id: 'c1', timeStart: '08:00', timeEnd: '08:45', name: { ar: 'مراجعة', en: 'Review' }, activity: { ar: 'Anki', en: 'Anki' }, goal: { ar: 'مراجعة جميع البطاقات', en: 'Review all cards' }, learn: '', apply: '', notes: '', outputs: '', sound: '', duration: 45 },
    { id: 'c2', timeStart: '08:45', timeEnd: '10:15', name: { ar: 'رياضيات', en: 'Mathematics' }, activity: { ar: 'مراجعة المفاهيم', en: 'Review Concepts' }, goal: { ar: 'مراجعة جميع المفاهيم الرياضية', en: 'Review all math concepts' }, learn: '', apply: '', notes: '', outputs: '', sound: '', duration: 90 },
    { id: 'c3', timeStart: '10:15', timeEnd: '10:30', name: { ar: 'استراحة', en: 'Break' }, activity: { ar: 'راحة قصيرة', en: 'Short break' }, goal: '', learn: '', apply: '', notes: '', outputs: '', sound: '', duration: 15, isBreak: true },
    { id: 'c4', timeStart: '10:30', timeEnd: '11:30', name: { ar: 'برمجة', en: 'Programming' }, activity: { ar: 'مراجعة التطبيقات', en: 'Review Implementations' }, goal: { ar: 'مراجعة جميع الكود', en: 'Review all code' }, learn: '', apply: '', notes: '', outputs: '', sound: '', duration: 60 },
    { id: 'c5', timeStart: '11:30', timeEnd: '13:00', name: { ar: 'علوم الحاسوب', en: 'Computer Science' }, activity: { ar: 'مراجعة وربط', en: 'Review & Connect' }, goal: { ar: 'ربط مفاهيم CS بالمواضيع الأخرى', en: 'Connect CS concepts to other topics' }, learn: '', apply: '', notes: '', outputs: '', sound: '', duration: 90 },
    { id: 'c6', timeStart: '13:00', timeEnd: '14:00', name: { ar: 'غداء', en: 'Lunch' }, activity: { ar: 'استراحة الغداء', en: 'Lunch break' }, goal: '', learn: '', apply: '', notes: '', outputs: '', sound: '', duration: 60, isBreak: true },
    { id: 'c7', timeStart: '14:00', timeEnd: '15:30', name: { ar: 'دمج عميق', en: 'Deep Integration' }, activity: { ar: 'ربط كل شيء', en: 'Connect Everything' }, goal: { ar: 'بناء فهم متكامل لجميع المفاهيم', en: 'Build integrated understanding' }, learn: '', apply: '', notes: '', outputs: '', sound: '', duration: 90 },
    { id: 'c8', timeStart: '15:30', timeEnd: '15:45', name: { ar: 'استراحة', en: 'Break' }, activity: { ar: 'راحة قصيرة', en: 'Short break' }, goal: '', learn: '', apply: '', notes: '', outputs: '', sound: '', duration: 15, isBreak: true },
    { id: 'c9', timeStart: '15:45', timeEnd: '16:45', name: { ar: 'مشروع', en: 'Project' }, activity: { ar: 'بناء الجزء المتكامل', en: 'Build Integrated Part' }, goal: { ar: 'تطبيق الدمج في المشروع', en: 'Apply integration in project' }, learn: '', apply: '', notes: '', outputs: '', sound: '', duration: 60 },
    { id: 'c10', timeStart: '16:45', timeEnd: '17:30', name: { ar: 'إغلاق', en: 'Closing' }, activity: { ar: 'كتابة العلاقات', en: 'Write Relationships' }, goal: { ar: 'توثيق العلاقات بين المفاهيم', en: 'Document concept relationships' }, learn: '', apply: '', notes: '', outputs: '', sound: '', duration: 45 },
  ],
  D: [
    { id: 'd1', timeStart: '08:00', timeEnd: '08:45', name: { ar: 'مراجعة', en: 'Review' }, activity: { ar: 'Anki', en: 'Anki' }, goal: { ar: 'مراجعة نهائية لجميع البطاقات', en: 'Final review of all cards' }, learn: '', apply: '', notes: '', outputs: '', sound: '', duration: 45 },
    { id: 'd2', timeStart: '08:45', timeEnd: '10:15', name: { ar: 'اختبار رياضيات', en: 'Math Test' }, activity: { ar: 'بدون مراجع', en: 'No References' }, goal: { ar: 'قياس الفهم الحقيقي للرياضيات', en: 'Measure true math understanding' }, learn: '', apply: '', notes: '', outputs: '', sound: '', duration: 90 },
    { id: 'd3', timeStart: '10:15', timeEnd: '10:30', name: { ar: 'استراحة', en: 'Break' }, activity: { ar: 'راحة قصيرة', en: 'Short break' }, goal: '', learn: '', apply: '', notes: '', outputs: '', sound: '', duration: 15, isBreak: true },
    { id: 'd4', timeStart: '10:30', timeEnd: '11:30', name: { ar: 'اختبار برمجة', en: 'Programming Test' }, activity: { ar: 'كتابة كود من الذاكرة', en: 'Coding From Memory' }, goal: { ar: 'كتابة كود بدون مراجعة', en: 'Write code without references' }, learn: '', apply: '', notes: '', outputs: '', sound: '', duration: 60 },
    { id: 'd5', timeStart: '11:30', timeEnd: '13:00', name: { ar: 'اختبار CS', en: 'CS Test' }, activity: { ar: 'شرح المفاهيم', en: 'Explain Concepts' }, goal: { ar: 'شرح مفاهيم CS بكلماتك', en: 'Explain CS concepts in your own words' }, learn: '', apply: '', notes: '', outputs: '', sound: '', duration: 90 },
    { id: 'd6', timeStart: '13:00', timeEnd: '14:00', name: { ar: 'غداء', en: 'Lunch' }, activity: { ar: 'استراحة الغداء', en: 'Lunch break' }, goal: '', learn: '', apply: '', notes: '', outputs: '', sound: '', duration: 60, isBreak: true },
    { id: 'd7', timeStart: '14:00', timeEnd: '15:30', name: { ar: 'مراجعة أسبوعية', en: 'Weekly Review' }, activity: { ar: 'مراجعة الأسبوع كاملاً', en: 'Entire Week Review' }, goal: { ar: 'استعراض إنجازات الأسبوع', en: 'Review week achievements' }, learn: '', apply: '', notes: '', outputs: '', sound: '', duration: 90 },
    { id: 'd8', timeStart: '15:30', timeEnd: '15:45', name: { ar: 'استراحة', en: 'Break' }, activity: { ar: 'راحة قصيرة', en: 'Short break' }, goal: '', learn: '', apply: '', notes: '', outputs: '', sound: '', duration: 15, isBreak: true },
    { id: 'd9', timeStart: '15:45', timeEnd: '16:45', name: { ar: 'مشروع نهائي', en: 'Final Project' }, activity: { ar: 'النسخة النهائية', en: 'Final Version' }, goal: { ar: 'إتمام المشروع النهائي', en: 'Complete the final project version' }, learn: '', apply: '', notes: '', outputs: '', sound: '', duration: 60 },
    { id: 'd10', timeStart: '16:45', timeEnd: '17:30', name: { ar: 'ملاحظات الأداء', en: 'Performance Notes' }, activity: { ar: 'تأمل وتقييم', en: 'Reflection' }, goal: { ar: 'تقييم الأسبوع وتحديد الخطوة القادمة', en: 'Evaluate week and plan next steps' }, learn: '', apply: '', notes: '', outputs: '', sound: '', duration: 45 },
  ],
};

// ===== DEFAULT WEEKLY COLUMNS =====
const DEFAULT_COLUMNS = [
  { ar: 'رياضيات', en: 'Mathematics' },
  { ar: 'برمجة', en: 'Programming' },
  { ar: 'علوم الحاسوب', en: 'Computer Science' },
  { ar: 'التطبيق المتكامل', en: 'Integration' },
  { ar: 'المشروع', en: 'Project' },
  { ar: 'المراجعة', en: 'Review' },
];

// ===== STORAGE HELPERS =====
const DB = {
  get(key, def = null) {
    try {
      const val = localStorage.getItem('murad_' + key);
      return val !== null ? JSON.parse(val) : def;
    } catch { return def; }
  },
  set(key, val) {
    try { localStorage.setItem('murad_' + key, JSON.stringify(val)); return true; }
    catch { return false; }
  },
  remove(key) { localStorage.removeItem('murad_' + key); }
};

// ===== SETTINGS =====
let settings = DB.get('settings', {
  defaultSound: 'bell',
  volume: 70,
  repeatAlarm: false,
  repeatCount: 3,
  alarmDuration: 10,
  userName: 'Murad',
  weekStartDate: '',
  enableNotifications: true,
  theme: 'dark',
  perBlockSounds: {},
});

function saveSettings() {
  settings.defaultSound = document.getElementById('defaultSound')?.value || settings.defaultSound;
  settings.volume = parseInt(document.getElementById('alarmVolume')?.value || settings.volume);
  settings.repeatAlarm = document.getElementById('repeatAlarm')?.checked || false;
  settings.repeatCount = parseInt(document.getElementById('repeatCount')?.value || settings.repeatCount);
  settings.alarmDuration = parseInt(document.getElementById('alarmDuration')?.value || settings.alarmDuration);
  settings.userName = document.getElementById('userName')?.value || settings.userName;
  settings.weekStartDate = document.getElementById('weekStartDate')?.value || '';
  settings.enableNotifications = document.getElementById('enableNotifications')?.checked || false;
  document.getElementById('volumeVal').textContent = settings.volume + '%';
  DB.set('settings', settings);
  showToast(t('toast.saved'), 'success');
}

function loadSettingsUI() {
  if (document.getElementById('defaultSound')) document.getElementById('defaultSound').value = settings.defaultSound;
  if (document.getElementById('alarmVolume')) {
    document.getElementById('alarmVolume').value = settings.volume;
    document.getElementById('volumeVal').textContent = settings.volume + '%';
  }
  if (document.getElementById('repeatAlarm')) document.getElementById('repeatAlarm').checked = settings.repeatAlarm;
  if (document.getElementById('repeatCount')) document.getElementById('repeatCount').value = settings.repeatCount;
  if (document.getElementById('alarmDuration')) document.getElementById('alarmDuration').value = settings.alarmDuration;
  if (document.getElementById('userName')) document.getElementById('userName').value = settings.userName || 'Murad';
  if (document.getElementById('weekStartDate')) document.getElementById('weekStartDate').value = settings.weekStartDate || '';
  if (document.getElementById('enableNotifications')) document.getElementById('enableNotifications').checked = settings.enableNotifications !== false;
}

// ===== WEEK DATA =====
function getCurrentWeekNum() { return DB.get('currentWeek', 1); }
function setCurrentWeekNum(n) { DB.set('currentWeek', n); }

function getWeeklyData(weekNum) {
  const key = 'week_' + weekNum;
  return DB.get(key, getDefaultWeeklyData());
}

function getDefaultWeeklyData() {
  const data = {};
  WEEK_SCHEDULE.forEach(day => {
    data[day.key] = { cells: ['', '', '', '', '', ''] };
  });
  data._columns = DEFAULT_COLUMNS.map(c => ({ ...c }));
  return data;
}

function saveWeeklyData() {
  const weekNum = getCurrentWeekNum();
  const key = 'week_' + weekNum;
  const tbody = document.getElementById('weeklyTableBody');
  const data = getWeeklyData(weekNum);
  if (!data._columns) data._columns = DEFAULT_COLUMNS.map(c => ({ ...c }));

  // Save columns
  document.querySelectorAll('.editable-header').forEach((th, i) => {
    if (data._columns[i]) data._columns[i][currentLang] = th.textContent.trim();
  });

  // Save cells
  tbody.querySelectorAll('tr').forEach((tr, i) => {
    const dayKey = WEEK_SCHEDULE[i]?.key;
    if (!dayKey) return;
    if (!data[dayKey]) data[dayKey] = { cells: [] };
    const cells = tr.querySelectorAll('.editable-cell');
    data[dayKey].cells = Array.from(cells).map(c => c.textContent.trim());
  });

  DB.set(key, data);
  showAutoSave();
  showToast(t('toast.saved'), 'success');
}

function showAutoSave() {
  const el = document.getElementById('autoSaveIndicator');
  if (el) { el.style.opacity = '1'; setTimeout(() => el.style.opacity = '0.5', 2000); }
}

// ===== DAILY DATA =====
function getDayKey(weekNum, dayKey) { return `day_${weekNum}_${dayKey}`; }

function getDailyData(weekNum, dayKey, pattern) {
  const key = getDayKey(weekNum, dayKey);
  const saved = DB.get(key);
  if (saved && saved.blocks && saved.blocks.length > 0) {
    // Restore timer state if exists - match by block ID
    if (saved.timerState && window.timers) {
      Object.keys(saved.timerState).forEach(blockId => {
        if (!window.timers[blockId]) {
          const ts = saved.timerState[blockId];
          if (ts) window.timers[blockId] = { ...ts, interval: null };
        }
      });
    }
    return saved;
  }
  // Create from defaults - only generate IDs once and store pattern
  const blocks = JSON.parse(JSON.stringify(DEFAULT_BLOCKS[pattern] || DEFAULT_BLOCKS.A));
  const result = {
    blocks,
    integration: { math: '', prog: '', cs: '', result: '', relation: '' },
    timerState: {},
    _pattern: pattern
  };
  // Save immediately to establish the IDs
  DB.set(key, result);
  return result;
}

function saveDailyData(immediate = false) {
  if (!window.currentDayKey || !window.currentWeekNum) return false;
  const key = getDayKey(window.currentWeekNum, window.currentDayKey);
  
  // Collect blocks from DOM and memory
  const blocks = [];
  document.querySelectorAll('.block-card[data-block-id]').forEach(card => {
    const id = card.getAttribute('data-block-id');
    const existingBlock = window.currentBlocks?.find(b => b.id === id) || {};
    const isPanelOpen = (typeof currentPanelBlockId !== 'undefined') && currentPanelBlockId === id;
    
    // Read current values from inputs
    const nameInput = card.querySelector('.block-name-input');
    const activityInput = card.querySelector('.block-activity-input');
    
    const name = nameInput?.value || existingBlock.name?.ar || existingBlock.name || '';
    
    // ── DATA ISOLATION FIX ─────────────────────────────────────
    // There is only ONE detail side-panel in the DOM, shared by all
    // blocks. Its field values (notes/goal/learn/apply/outputs/times)
    // must ONLY be applied to the block that currently owns the panel
    // (currentPanelBlockId). Previously they were read for EVERY block
    // in this loop, so one block's notes bled into all other blocks
    // (and from there into the exported PDF report).
    const panelField = (elId, fallback) => {
      if (isPanelOpen) {
        const el = document.getElementById(elId);
        if (el) return el.value;
      }
      return fallback || '';
    };
    
    blocks.push({
      ...existingBlock,
      id,
      name: typeof name === 'object' ? name : { ar: name, en: name },
      activity: typeof (activityInput?.value || existingBlock.activity) === 'object'
        ? ((activityInput?.value ? { ar: activityInput.value, en: activityInput.value } : existingBlock.activity) || { ar: '', en: '' })
        : { ar: activityInput?.value || '', en: activityInput?.value || '' },
      timeStart: panelField('panelTimeStart', existingBlock.timeStart),
      timeEnd: panelField('panelTimeEnd', existingBlock.timeEnd),
      goal: panelField('panelGoal', existingBlock.goal),
      learn: panelField('panelLearn', existingBlock.learn),
      apply: panelField('panelApply', existingBlock.apply),
      notes: panelField('panelNotes', existingBlock.notes),
      outputs: panelField('panelOutputs', existingBlock.outputs),
      sound: panelField('panelSound', existingBlock.sound),
      duration: existingBlock.duration || 45,
      isBreak: existingBlock.isBreak || false,
    });
  });
  
  const data = DB.get(key) || {};
  data.blocks = blocks;
  
  // Integration - save current form values
  data.integration = {
    math: document.getElementById('intMath')?.value || '',
    prog: document.getElementById('intProg')?.value || '',
    cs: document.getElementById('intCS')?.value || '',
    result: document.getElementById('intResult')?.value || '',
    relation: document.getElementById('intRelation')?.value || '',
  };
  
  // Timer state for ALL current blocks
  data.timerState = {};
  if (window.currentBlocks && window.currentBlocks.length > 0) {
    window.currentBlocks.forEach(b => {
      const t = timers[b.id];
      if (t) {
        data.timerState[b.id] = {
          remaining: t.remaining,
          total: t.total,
          status: t.status,
          startTime: t.startTime
        };
      }
    });
  }
  
  DB.set(key, data);
  
  if (!immediate) {
    showToast(t('toast.saved'), 'success');
  }
  
  return true;
}

function collectCurrentBlocks() {
  const blocks = [];
  document.querySelectorAll('.block-card[data-block-id]').forEach(card => {
    const id = card.getAttribute('data-block-id');
    const existingBlock = window.currentBlocks?.find(b => b.id === id) || {};
    
    // Check if detail panel is open for this block
    const isPanelOpen = (typeof currentPanelBlockId !== 'undefined') && currentPanelBlockId === id;
    
    blocks.push({
      ...existingBlock,
      id,
      name: {
        ar: card.querySelector('.block-name-input')?.value || existingBlock.name?.ar || '',
        en: card.querySelector('.block-name-input')?.value || existingBlock.name?.en || '',
      },
      activity: {
        ar: card.querySelector('.block-activity-input')?.value || existingBlock.activity?.ar || '',
        en: card.querySelector('.block-activity-input')?.value || existingBlock.activity?.en || '',
      },
      timeStart: existingBlock.timeStart || '',
      timeEnd: existingBlock.timeEnd || '',
      goal: isPanelOpen ? (document.getElementById('panelGoal')?.value || '') : (existingBlock.goal || ''),
      learn: existingBlock.learn || '',
      apply: existingBlock.apply || '',
      notes: isPanelOpen ? (document.getElementById('panelNotes')?.value || '') : (existingBlock.notes || ''),
      outputs: isPanelOpen ? (document.getElementById('panelOutputs')?.value || '') : (existingBlock.outputs || ''),
      sound: existingBlock.sound || '',
      duration: existingBlock.duration || 45,
      isBreak: existingBlock.isBreak || false,
    });
  });
  return blocks;
}

// ===== WEEK NUMBER CHANGE =====
function changeWeek(delta) {
  const cur = getCurrentWeekNum();
  const newNum = Math.max(1, cur + delta);
  setCurrentWeekNum(newNum);
  document.getElementById('currentWeekNum').textContent = newNum;
  renderWeeklyTable();
}

// ===== CUSTOM SOUNDS =====
function getCustomSounds() { return DB.get('customSounds', []); }
function saveCustomSounds(arr) { DB.set('customSounds', arr); }

function uploadCustomSound(input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    const sounds = getCustomSounds();
    const name = file.name.replace(/\.[^.]+$/, '');
    const id = 'custom_' + Date.now();
    sounds.push({ id, name, data: e.target.result, type: file.type });
    saveCustomSounds(sounds);
    renderCustomSoundsList();
    showToast(t('toast.saved'), 'success');
  };
  reader.readAsDataURL(file);
  input.value = '';
}

function renderCustomSoundsList() {
  const sounds = getCustomSounds();
  const el = document.getElementById('customSoundsList');
  const section = document.getElementById('customSoundsSection');
  if (!el) return;
  if (sounds.length === 0) { if(section) section.style.display = 'none'; return; }
  if(section) section.style.display = 'block';
  el.innerHTML = sounds.map(s => `
    <div class="custom-sound-item">
      <span class="custom-sound-name">${s.name}</span>
      <button class="sound-play-btn" onclick="playCustomSound('${s.id}')"><i class="fas fa-play"></i></button>
      <button class="custom-sound-delete" onclick="deleteCustomSound('${s.id}')"><i class="fas fa-trash"></i></button>
    </div>
  `).join('');
}

function playCustomSound(id) {
  const sounds = getCustomSounds();
  const s = sounds.find(x => x.id === id);
  if (!s) return;
  const audio = new Audio(s.data);
  audio.volume = (settings.volume || 70) / 100;
  audio.play().catch(() => {});
}

function deleteCustomSound(id) {
  const sounds = getCustomSounds().filter(s => s.id !== id);
  saveCustomSounds(sounds);
  renderCustomSoundsList();
}
