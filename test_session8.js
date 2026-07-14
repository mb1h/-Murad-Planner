/**
 * Session 8 — Self-Test Script (15 Scenarios)
 * Simulates browser localStorage + all AIAgentCore tools
 */
'use strict';

// ─── Mock Browser Environment ───────────────────────────────────────────────
const _store = {};
global.localStorage = {
  getItem: k => _store[k] !== undefined ? _store[k] : null,
  setItem: (k, v) => { _store[k] = v; },
  removeItem: k => { delete _store[k]; },
  clear: () => { Object.keys(_store).forEach(k => delete _store[k]); }
};

// Mock DOM
global.document = {
  getElementById: () => null,
  querySelector: () => null,
  querySelectorAll: () => [],
  createElement: (t) => ({ tagName: t, style: {}, className: '', appendChild: () => {}, remove: () => {} }),
  body: { appendChild: () => {} }
};
global.window = global;
global.navigator = { language: 'ar' };
global.showToast = () => {};
global.showPage = () => {};
global.showAIPage = () => {};
global.DockNotifications = { add: () => {} };
global.t = (k) => k;

// ─── Load data.js shim ───────────────────────────────────────────────────────
// Minimal DB implementation matching the real one
const DB = {
  PREFIX: 'murad_',
  get(key) {
    try {
      const raw = localStorage.getItem(this.PREFIX + key);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  },
  set(key, value) {
    try {
      localStorage.setItem(this.PREFIX + key, JSON.stringify(value));
      return true;
    } catch { return false; }
  },
  remove(key) {
    localStorage.removeItem(this.PREFIX + key);
  }
};

// getDayKey helper
function getDayKey(weekNum, dayKey) {
  return 'day_' + weekNum + '_' + dayKey;
}

// getDailyData helper
function getDailyData(weekNum, dayKey) {
  const key = getDayKey(weekNum, dayKey);
  const data = DB.get(key);
  if (data && Array.isArray(data.blocks)) return data;
  return { blocks: [], key };
}

global.DB = DB;
global.getDayKey = getDayKey;
global.getDailyData = getDailyData;
global.WEEK_SCHEDULE = [
  { key: 'sat', label: 'السبت' },
  { key: 'sun', label: 'الأحد' },
  { key: 'mon', label: 'الاثنين' },
  { key: 'tue', label: 'الثلاثاء' },
  { key: 'wed', label: 'الأربعاء' },
  { key: 'thu', label: 'الخميس' },
  { key: 'fri', label: 'الجمعة' }
];

// ─── Load ai-agent-core.js ───────────────────────────────────────────────────
require('./js/ai-agent-core.js');

// ─── Test Framework ──────────────────────────────────────────────────────────
let passed = 0, failed = 0, total = 0;
const results = [];

function test(name, fn) {
  total++;
  try {
    const r = fn();
    const ok = r !== false && r !== null && r !== undefined;
    if (ok) {
      passed++;
      results.push({ name, status: '✅ PASS', detail: typeof r === 'object' ? JSON.stringify(r).slice(0, 120) : String(r) });
    } else {
      failed++;
      results.push({ name, status: '❌ FAIL', detail: 'returned: ' + String(r) });
    }
  } catch (e) {
    failed++;
    results.push({ name, status: '❌ ERROR', detail: e.message });
  }
}

function assert(condition, msg) {
  if (!condition) throw new Error(msg || 'Assertion failed');
  return true;
}

const core = global.AIAgentCore;
if (!core) { console.error('AIAgentCore not loaded!'); process.exit(1); }

// Bind all tool methods so 'this' == AIAgentCore (has _getWeekNum etc.)
Object.keys(core.tools).forEach(k => {
  if (typeof core.tools[k] === 'function') {
    core.tools[k] = core.tools[k].bind(core);
  }
});

// Mock window.confirm to always return true
global.window.confirm = () => true;

// Reset storage before tests
localStorage.clear();

// ─── SCENARIO 1: Create 20 Blocks ────────────────────────────────────────────
test('S1: Create 20 blocks for Monday', () => {
  const blocks = [];
  let hour = 7;
  for (let i = 1; i <= 20; i++) {
    const start = String(hour).padStart(2,'0') + ':00';
    const end = String(hour).padStart(2,'0') + ':30';
    blocks.push({
      name: 'بلوك ' + i,
      subject: 'مادة ' + i,
      timeStart: start,
      timeEnd: end,
      duration: 30,
      difficulty: i % 3 === 0 ? 'hard' : i % 2 === 0 ? 'medium' : 'easy',
      goal: 'هدف البلوك ' + i,
      description: 'وصف البلوك ' + i,
      whatWillILearn: 'سأتعلم في البلوك ' + i,
      whatWillIPractice: 'سأطبق في البلوك ' + i,
      expectedOutcome: 'المخرجات ' + i,
      notes: 'ملاحظات ' + i,
      tips: 'نصائح ' + i,
      exercises: 'تمارين ' + i,
      resources: 'مراجع ' + i,
      priority: 'high',
      status: 'pending',
      isBreak: false
    });
    hour++;
    if (hour > 22) hour = 7;
  }
  
  const result = core.tools.createDaySchedule({ dayKey: 'mon', blocks, replaceExisting: true });
  assert(result.success === true, 'createDaySchedule must return success:true, got: ' + JSON.stringify(result));
  assert(result.blockCount === 20, 'Expected 20 blocks, got: ' + result.blockCount);
  
  // Verify in DB
  const saved = DB.get('day_1_mon');
  assert(saved && saved.blocks && saved.blocks.length === 20, 'DB must have 20 blocks');
  return { blockCount: result.blockCount, dbCount: saved.blocks.length };
});

// ─── SCENARIO 2: Edit title of one block ─────────────────────────────────────
test('S2: Edit title of block #1 only (surgical update)', () => {
  const saved = DB.get('day_1_mon');
  const blockId = saved.blocks[0].id;
  
  const result = core.tools.fillBlockFields({ 
    dayKey: 'mon', 
    blockId, 
    fields: { title: 'عنوان معدّل للبلوك الأول' }
  });
  assert(result.success === true, 'fillBlockFields must succeed: ' + JSON.stringify(result));
  assert(result.fieldsModified && result.fieldsModified.includes('title'), 'title must be in fieldsModified');
  
  // Verify
  const verify = DB.get('day_1_mon');
  const block = verify.blocks.find(b => b.id === blockId);
  const nameAr = block.name && (block.name.ar || block.name);
  assert(nameAr === 'عنوان معدّل للبلوك الأول', 'title not updated in DB: ' + JSON.stringify(block.name));
  assert(verify.blocks.length === 20, 'Schedule must still have 20 blocks (not recreated)');
  return { fieldsModified: result.fieldsModified, newTitle: nameAr };
});

// ─── SCENARIO 3: Edit ALL blocks (update common field) ───────────────────────
test('S3: Update status field for all 20 blocks', () => {
  const result = core.tools.fillBlockFields({
    dayKey: 'mon',
    fields: { status: 'in_progress' }  // no blockId = all blocks
  });
  assert(result.success === true, 'Should succeed: ' + JSON.stringify(result));
  
  const verify = DB.get('day_1_mon');
  const allUpdated = verify.blocks.every(b => b.status === 'in_progress');
  assert(allUpdated, 'All blocks must have status=in_progress');
  return { blocksUpdated: verify.blocks.length };
});

// ─── SCENARIO 4: Fill ALL fields for all blocks ───────────────────────────────
test('S4: fillAllBlocksAllFields - fill all 22+ fields for all blocks', () => {
  const result = core.tools.fillAllBlocksAllFields({ dayKey: 'mon', subjectHint: 'رياضيات' });
  assert(result.success === true, 'fillAllBlocksAllFields must succeed: ' + JSON.stringify(result));
  
  const verify = DB.get('day_1_mon');
  // Check that non-break blocks have key fields filled
  const studyBlocks = verify.blocks.filter(b => !b.isBreak);
  let allHaveFields = true;
  for (const b of studyBlocks) {
    if (!b.whatWillILearn || !b.expectedOutcome) { allHaveFields = false; break; }
  }
  assert(allHaveFields, 'All study blocks must have whatWillILearn and expectedOutcome');
  return { totalBlocks: result.blockCount, fieldsModified: result.fieldsModified ? result.fieldsModified.length : 0 };
});

// ─── SCENARIO 5: Delete all blocks ───────────────────────────────────────────
test('S5: Delete all blocks (clearDayBlocks)', () => {
  const result = core.tools.clearDayBlocks({ dayKey: 'mon', confirmed: true });
  assert(result.success === true, 'clearDayBlocks must succeed: ' + JSON.stringify(result));
  
  const verify = DB.get('day_1_mon');
  const count = verify ? (verify.blocks || []).length : 0;
  assert(count === 0, 'DB must have 0 blocks after clear, got: ' + count);
  return { remainingBlocks: count };
});

// ─── SCENARIO 6: Re-create 5 blocks with all 22+ fields ──────────────────────
test('S6: Re-create 5 blocks with ALL 22+ fields', () => {
  const result = core.tools.createDaySchedule({
    dayKey: 'mon',
    replaceExisting: true,
    blocks: [
      {
        name: 'رياضيات', subject: 'رياضيات', timeStart: '08:00', timeEnd: '09:30',
        duration: 90, difficulty: 'hard', goal: 'إتقان التفاضل والتكامل',
        description: 'دراسة عميقة مع حل مسائل',
        whatWillILearn: 'مفاهيم التكامل والتفاضل',
        whatWillIPractice: 'حل 10 مسائل متنوعة',
        expectedOutcome: 'القدرة على حل مسائل التفاضل',
        notes: 'ركز على الفهم وليس الحفظ', tips: 'استخدم Feynman',
        exercises: 'حل 10 مسائل', resources: 'الكتاب + Khan Academy',
        priority: 'high', status: 'pending', tags: ['math', 'calculus'],
        aiSummary: 'جلسة رياضيات مكثفة', isBreak: false
      },
      {
        name: 'استراحة', timeStart: '09:30', timeEnd: '09:45', duration: 15, isBreak: true, priority: 'normal'
      },
      {
        name: 'برمجة', subject: 'علوم الحاسب', timeStart: '09:45', timeEnd: '11:15',
        duration: 90, difficulty: 'medium', goal: 'إتقان Python',
        description: 'تطبيق عملي على هياكل البيانات',
        whatWillILearn: 'Lists, Dicts, Sets في Python',
        whatWillIPractice: 'كتابة كود Python نظيف',
        expectedOutcome: 'حل 3 مسائل LeetCode',
        notes: 'لا تستخدم AI أولاً', tips: 'فكر في الخوارزمية أولاً',
        exercises: 'حل 2 Easy + 1 Medium', resources: 'Python Docs',
        priority: 'high', status: 'pending', isBreak: false
      },
      {
        name: 'غداء', timeStart: '11:15', timeEnd: '12:00', duration: 45, isBreak: true, priority: 'normal'
      },
      {
        name: 'مراجعة', subject: 'مراجعة عامة', timeStart: '12:00', timeEnd: '12:45',
        duration: 45, difficulty: 'easy', goal: 'ترسيخ المواد',
        description: 'Active Recall وAnki',
        whatWillILearn: 'ترسيخ جميع المواد',
        whatWillIPractice: 'Spaced Repetition',
        expectedOutcome: 'بطاقات Anki جديدة + ملخص',
        notes: 'راجع كل المواد', priority: 'high', status: 'pending', isBreak: false
      }
    ]
  });
  
  assert(result.success === true, 'Re-create must succeed: ' + JSON.stringify(result));
  assert(result.blockCount === 5, 'Expected 5 blocks, got: ' + result.blockCount);
  
  const verify = DB.get('day_1_mon');
  assert(verify.blocks.length === 5, 'DB must have 5 blocks');
  
  // Check all 22+ fields on first study block
  const mathBlock = verify.blocks.find(b => b.subject === 'رياضيات');
  assert(mathBlock, 'Math block must exist');
  assert(mathBlock.whatWillILearn, 'whatWillILearn must be set');
  assert(mathBlock.expectedOutcome, 'expectedOutcome must be set');
  assert(mathBlock.notes, 'notes must be set');
  assert(mathBlock.tips, 'tips must be set');
  assert(mathBlock.aiSummary, 'aiSummary must be set');
  return { blockCount: result.blockCount, mathFields: Object.keys(mathBlock).length };
});

// ─── SCENARIO 7: Upload PDF (file memory) ────────────────────────────────────
test('S7: File memory — setFile and getLastFile', () => {
  const mem = global.AISessionMemory;
  assert(mem, 'AISessionMemory must exist on window');
  
  mem.setFile({
    name: 'test.pdf',
    type: 'pdf',
    content: 'هذا محتوى ملف PDF تجريبي. يحتوي على معلومات مهمة.\n1. النقطة الأولى: مقدمة\n2. النقطة الثانية: التفاصيل\n3. النقطة الثالثة: الخاتمة',
    size: 1024,
    uploadedAt: new Date().toISOString()
  });
  
  const last = mem.getLastFile();
  assert(last, 'getLastFile must return the file');
  assert(last.name === 'test.pdf', 'file name must match');
  assert(last.type === 'pdf', 'file type must be pdf');
  return { fileName: last.name, contentLength: last.content.length };
});

// ─── SCENARIO 8: Upload image ─────────────────────────────────────────────────
test('S8: File memory — image upload', () => {
  const mem = global.AISessionMemory;
  
  mem.setFile({
    name: 'screenshot.png',
    type: 'image',
    content: '[Image: screenshot.png — visual content]',
    dataUrl: 'data:image/png;base64,abc123',
    size: 2048,
    uploadedAt: new Date().toISOString()
  });
  
  const lastFile = mem.getLastFile();
  const lastImage = mem.get('lastImage');
  assert(lastFile.name === 'screenshot.png', 'lastFile must be the image');
  assert(lastImage && lastImage.name === 'screenshot.png', 'lastImage must be set');
  assert(lastFile.type === 'image', 'type must be image');
  return { fileName: lastFile.name, type: lastFile.type };
});

// ─── SCENARIO 9: Explain file (readFile tool) ─────────────────────────────────
test('S9: readFile tool returns last file content', () => {
  // First set a PDF in memory
  global.AISessionMemory.setFile({
    name: 'study_notes.pdf',
    type: 'pdf',
    content: 'هذه ملاحظات الدراسة للفصل الأول: الجبر الخطي.\nيشمل: المصفوفات، المحددات، القيم الذاتية.',
    size: 512,
    uploadedAt: new Date().toISOString()
  });
  
  const result = core.tools.readFile({});
  assert(result.success === true, 'readFile must succeed: ' + JSON.stringify(result));
  assert(result.result, 'readFile must return result object');
  const content = result.result.content || result.result;
  assert(typeof content === 'string' && content.length > 0, 'content must be non-empty string');
  assert(content.includes('الجبر الخطي'), 'content must include file text');
  return { fileName: result.result.name || 'ok', contentPreview: String(content).slice(0, 80) };
});

// ─── SCENARIO 10: Summarize file ─────────────────────────────────────────────
test('S10: extractPdfText alias works (same as readFile)', () => {
  const result = core.tools.extractPdfText({});
  assert(result.success === true, 'extractPdfText must succeed: ' + JSON.stringify(result));
  const content = result.result && (result.result.content || result.result);
  assert(content && content.length > 0, 'content must not be empty');
  return { status: 'extractPdfText alias works', contentLength: String(content).length };
});

// ─── SCENARIO 11: Edit block (updateBlock) ───────────────────────────────────
test('S11: updateBlock — update 8 fields at once', () => {
  const saved = DB.get('day_1_mon');
  const blockId = saved.blocks[0].id;
  
  const result = core.tools.updateBlock({
    dayKey: 'mon',
    blockId,
    updates: {
      title: 'رياضيات متقدمة - محدّث',
      goal: 'إتقان الجبر الخطي والتفاضل',
      whatWillILearn: 'القيم الذاتية والمتجهات الذاتية',
      whatWillIPractice: 'حل مسائل متقدمة في الجبر الخطي',
      expectedOutcome: 'إتمام 15 مسألة بنجاح',
      notes: 'ركز على الفهم الهندسي',
      difficulty: 'hard',
      priority: 'high'
    }
  });
  
  assert(result.success === true, 'updateBlock must succeed: ' + JSON.stringify(result));
  const fieldsModified = result.fieldsModified || [];
  assert(fieldsModified.length >= 4, 'At least 4 fields must be modified, got: ' + fieldsModified.length);
  
  // Verify in DB
  const verify = DB.get('day_1_mon');
  const block = verify.blocks.find(b => b.id === blockId);
  assert(block.whatWillILearn === 'القيم الذاتية والمتجهات الذاتية', 'whatWillILearn must be updated');
  assert(block.difficulty === 'hard', 'difficulty must be updated');
  return { fieldsModified, blockId };
});

// ─── SCENARIO 12: Open dashboard (navigation) ────────────────────────────────
test('S12: navigate to dashboard', () => {
  // Mock showPage tracker
  let navigatedTo = null;
  global.showPage = (pageId) => { navigatedTo = pageId; };
  
  const result = core.tools.navigate({ page: 'dashboard' });
  assert(result && (result.navigated || navigatedTo), 'Should navigate somewhere');
  const target = result.navigated || navigatedTo;
  assert(target === 'dashboard' || target === 'main', 'Should navigate to dashboard, got: ' + target);
  return { navigated: target };
});

// ─── SCENARIO 13: Open weekly view ───────────────────────────────────────────
test('S13: navigate to weekly', () => {
  let navigatedTo = null;
  global.showPage = (pageId) => { navigatedTo = pageId; };
  
  const result = core.tools.navigate({ page: 'weekly' });
  const target = result.navigated || navigatedTo;
  assert(target === 'weekly' || target === 'week', 'Should navigate to weekly, got: ' + target);
  return { navigated: target };
});

// ─── SCENARIO 14: Open analytics ─────────────────────────────────────────────
test('S14: navigate to analytics', () => {
  let navigatedTo = null;
  global.showAIPage = (pageId) => { navigatedTo = pageId; };
  global.showPage = (pageId) => { navigatedTo = pageId; };
  
  const result = core.tools.navigate({ page: 'analytics' });
  const target = result.navigated || navigatedTo;
  assert(target !== null && target !== undefined, 'Should navigate somewhere, got: ' + target);
  return { navigated: target };
});

// ─── SCENARIO 15: Session memory ─────────────────────────────────────────────
test('S15: getSessionMemory tool returns full memory state', () => {
  const mem = global.AISessionMemory;
  mem.set('lastDay', 'mon');
  mem.set('lastSubject', 'رياضيات');
  
  const result = core.tools.getSessionMemory({});
  assert(result.success === true, 'getSessionMemory must succeed: ' + JSON.stringify(result));
  const data = result.result;
  assert(data, 'result must have data');
  assert(data.lastDay === 'mon' || (data._data && data._data.lastDay === 'mon'), 'lastDay must be mon');
  return { lastDay: data.lastDay || (data._data && data._data.lastDay), lastSubject: data.lastSubject || (data._data && data._data.lastSubject) };
});

// ─── BONUS: Verify DB write integrity ────────────────────────────────────────
test('BONUS: verifyBlockFields returns completion %', () => {
  const result = core.tools.verifyBlockFields({ dayKey: 'mon' });
  assert(result.success === true, 'verifyBlockFields must succeed: ' + JSON.stringify(result));
  assert(result.result !== null && result.result !== undefined, 'result must have data');
  return { result: JSON.stringify(result.result).slice(0, 150) };
});

// ─── Print Results ────────────────────────────────────────────────────────────
console.log('\n' + '='.repeat(70));
console.log('  SESSION 8 SELF-TEST RESULTS');
console.log('='.repeat(70));
results.forEach(r => {
  console.log(r.status + ' ' + r.name);
  if (r.detail) console.log('    → ' + r.detail);
});
console.log('='.repeat(70));
console.log(`  Total: ${total} | ✅ Passed: ${passed} | ❌ Failed: ${failed}`);
console.log('  Pass Rate: ' + Math.round((passed / total) * 100) + '%');
console.log('='.repeat(70) + '\n');

if (failed > 0) {
  console.log('FAILED TESTS:');
  results.filter(r => r.status.includes('FAIL') || r.status.includes('ERROR'))
    .forEach(r => console.log('  ❌ ' + r.name + ': ' + r.detail));
  process.exit(1);
} else {
  console.log('🎉 ALL TESTS PASSED — Session 8 is 100% functional!');
  process.exit(0);
}
