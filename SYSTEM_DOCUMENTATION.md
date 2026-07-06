# توثيق النظام - Murad Learning Planner

## Architecture

### نظرة عامة
تطبيق Single Page Application (SPA) مبني بتقنيات الويب الأساسية (Vanilla JS) بدون أي frameworks.

### بنية الملفات
```
index.html          - الصفحة الرئيسية
├── css/
│   ├── style.css   - التصميم الكامل (CSS Variables + Glassmorphism)
│   └── pdf-report.css - تصميم تقارير PDF
└── js/
    ├── i18n.js     - نظام التدويل (عربي/إنجليزي)
    ├── data.js     - البيانات الافتراضية + التخزين المحلي
    ├── store.js    - إدارة الحالة المركزية
    ├── timer.js    - نظام المؤقت
    ├── sound.js    - نظام الأصوات
    ├── export-pdf.js - تصدير PDF
    ├── app.js      - التطبيق الرئيسي
```

### المكونات الرئيسية

#### 1. Loading Screen
- شاشة تحميل مع progress bar
- يتأكد من تحميل جميع الموارد قبل عرض التطبيق
- يختفي تلقائياً بعد انتهاء التحميل

#### 2. Sidebar
- التنقل الرئيسي بين الصفحات
- Logo + أزرار التحكم (لغة، مظهر)
- قابلة للطي (collapsed mode)
- دعم الموبايل (overlay menu)

#### 3. Pages (4 صفحات رئيسية)
- **Dashboard** - لوحة التحكم
- **Weekly** - الجدول الأسبوعي
- **Daily** - الجدول اليومي
- **Settings** - الإعدادات

#### 4. Panels & Modals
- **Block Panel** - لوحة تفاصيل البلوك
- **Block Finished Modal** - تنبيه انتهاء البلوك
- **Toast Notifications** - إشعارات منبثقة
- **Tooltip** - تلميحات hover

---

## Data Flow

### تدفق البيانات الكامل

```
User Action
    ↓
UI Event Handler (app.js)
    ↓
State Update (window.currentBlocks)
    ↓
Auto-save (after 200ms/800ms)
    ↓
DB.set() → localStorage
    ↓
UI Re-render
```

### هيكل البيانات

#### Weekly Data
```javascript
{
  _columns: [
    { ar: 'رياضيات', en: 'Mathematics' },
    { ar: 'برمجة', en: 'Programming' },
    ...
  ],
  sat: { cells: ['Linear Algebra', 'React', ...] },
  sun: { cells: ['Problems', 'Code Review', ...] },
  ...
}
```

#### Daily Data
```javascript
{
  blocks: [
    {
      id: 'r1',
      timeStart: '08:00',
      timeEnd: '08:45',
      name: { ar: 'مراجعة', en: 'Review' },
      activity: { ar: 'Anki', en: 'Anki' },
      goal: { ar: 'مراجعة المفاهيم', en: 'Review concepts' },
      learn: '',
      apply: '',
      notes: '',
      outputs: '',
      sound: '',
      duration: 45,
      isBreak: false
    }
  ],
  integration: {
    math: '',
    prog: '',
    cs: '',
    result: '',
    relation: ''
  },
  timerState: {
    blockId: {
      remaining: 120,
      total: 1800,
      status: 'running',
      startTime: 1234567890
    }
  },
  _pattern: 'A'
}
```

#### Settings
```javascript
{
  defaultSound: 'bell',
  volume: 70,
  repeatAlarm: false,
  repeatCount: 3,
  alarmDuration: 10,
  userName: 'Murad',
  weekStartDate: '',
  enableNotifications: true,
  theme: 'dark',
  perBlockSounds: {}
}
```

---

## State Management

### إدارة الحالة
النظام يستخدم ** centralized state** مع تخزين محلي:

#### 1. Global State (window)
```javascript
window.currentDayPattern  // النمط الحالي (A/B/C/D)
window.currentDayKey      // مفتاح اليوم (sat/sun/mon...)
window.currentWeekNum     // رقم الأسبوع الحالي
window.currentBlocks      // مصفوفة البلوكات الحالية
window._activeBlockId    // معرف البلوك النشط
window._nextBlockId      // معرف البلوك التالي
window._dragSrcEl        // عنصر السحب في Drag & Drop
window.timers            // خريطة المؤقتات النشطة
```

#### 2. Persistence Layer (localStorage)
```javascript
// المفاتيح المستخدمة:
'murad_settings'          // الإعدادات العامة
'murad_currentWeek'       // رقم الأسبوع الحالي
'murad_week_1'           // بيانات الأسبوع الأول
'murad_day_1_sat'        // بيانات يوم السبت من الأسبوع الأول
'murad_customSounds'     // الأصوات المخصصة
'murad_lang'             // اللغة المختارة (ar/en)
```

#### 3. Data Flow بين المكونات

**عند تعديل بلوك:**
```
User edits block name
    → updateBlockName() (app.js:529)
    → Updates window.currentBlocks
    → autoSaveDaily() (debounced 200ms)
    → saveDailyData() (data.js:215)
    → DB.set() → localStorage
```

**عند فتح يوم:**
```
User clicks "Open" on Saturday
    → openDayBoard('sat', 'A') (app.js:335)
    → Flush pending auto-save for current day
    → Update window.currentDayKey/Pattern/WeekNum
    → getDailyData(weekNum, dayKey, pattern)
    → If exists: load from localStorage
    → If not: create from DEFAULT_BLOCKS[pattern]
    → renderBlocks()
    → restoreTimers() (if any)
```

---

## Storage

### LocalStorage Schema

#### الهيكل العام
```
murad_settings          → Object
murad_currentWeek       → Number
murad_week_{n}          → Object (_columns + days)
murad_day_{week}_{day}  → Object (blocks + integration + timerState)
murad_customSounds      → Array
murad_lang              → String
```

### آليات الحفظ

#### 1. Auto-save للبيانات اليومية
- **Trigger:** بعد 200ms من آخر تعديل (`autoSaveDailyTimeout`)
- **يشمل:** name, activity, goal, learn, apply, notes, outputs, timerState
- **Site effect:** يحدث عند التنقل بين الأيام أيضاً

#### 2. Auto-save للجدول الأسبوعي
- **Trigger:** بعد 800ms من آخر تعديل (`autoSaveTimeout`)
- **يشمل:** أسماء الأعمدة + محتوى الخلايا

#### 3. Manual Save
- زر "Save" في الإعدادات
- `saveWeeklyData()` للجدول الأسبوعي

### Storage Helpers
```javascript
const DB = {
  get(key, def)     // جلب من localStorage
  set(key, val)     // حفظ في localStorage
  remove(key)       // حذف من localStorage
}
```

---

## PDF System

### التقارير المتاحة

#### 1. Daily PDF Report
```
الصفحة 1: الغلاف
  - اسم المستخدم، التاريخ، اليوم، الأسبوع، النمط

الصفحة 2: جدول اليوم
  - كل البلوكات مع الوقت والنشاط والهدف والملاحظات والمخرجات
  - إحصائيات (عدد البلوكات، الأهداف، الملاحظات، المخرجات)

الصفحة 3: الأهداف والملاحظات
  - قائمة بالأهداف المحددة
  - قائمة بالملاحظات المسجلة

الصفحة 4: المخرجات والخلاصة
  - قائمة بالمخرجات
  - أسئلة تأمل (ما تعلمته، ما يحتاج مراجعة، ماذا سأفعل غداً)
```

#### 2. Weekly PDF Report
- **Status:** قيد التطوير (not implemented yet)

### آليات التصدير
```javascript
exportDailyPDF()
  → Ensure data saved
  → Build HTML string with Tajawal font
  → Open print window
  → window.print()
  → User selects "Save as PDF"
```

### التصميم
- حجم A4
- هوامش 0
- خط Tajawal للمحتوى العربي
- ألوان: Blue (#2563eb) primary
- Gradients للعناوين

---

## Timer System

### بنية المؤقت
```javascript
const timers = {
  [blockId]: {
    interval: null,      // setInterval object
    remaining: 1800,     // Seconds remaining
    total: 1800,         // Total seconds
    status: 'running',   // idle | running | paused | done
    startTime: 1234567890 // When timer started
  }
}
```

### حالات المؤقت

#### 1. Idle
- لم يبدأ بعد
- يعرض الوقت الكامل
- زر "Start" visible

#### 2. Running
- يعمل حالياً
- ينقص كل ثانية
- حفظ تلقائي كل 10 ثواني
- أزرار: Pause, Reset, Skip

#### 3. Paused
- متوقف مؤقتاً
- يحفظ الوقت المتبقي
- أزرار: Resume, Reset, Skip

#### 4. Done
- انتهى الوقت
- يشغل تنبيه
- يعرض Modal
- أزرار: Reset, Start Next

### استرجاع المؤقت

عند إعادة تحميل الصفحة:
```javascript
restoreTimers() (timer.js:170)
  → Load timerState from localStorage
  → Calculate elapsed time
  → If timer was running:
    → Resume with remaining time
    → Or mark as done if expired
  → If timer was paused:
    → Restore paused state
```

### ميزات إضافية
- **Browser Notifications** - تنبيه عند الانتهاء
- **Sound Alarm** - نغمة قابلة للتخصيص
- **Modal** - يعرض البلوك التالي
- **Dashboard Update** - يحدث المؤقت في لوحة التحكم
- **Progress Bar** - شريط تقدم بصري

---

## Dashboard Logic

### حساب البيانات الحالية

```javascript
renderDashboard() {
  // 1. الأسبوع الحالي
  weekNum = getCurrentWeekNum()

  // 2. اليوم الحالي (من التاريخ)
  today = new Date()
  dayOfWeek = today.getDay() // 0=Sun, 6=Sat
  todayKey = dayMap[dayOfWeek]

  // 3. النمط الحالي (من WEEK_SCHEDULE)
  pattern = WEEK_SCHEDULE.find(d => d.key === todayKey).pattern

  // 4. الجلسة (صباحية/مسائية)
  hour = today.getHours()
  session = hour < 13 ? 'morning' : 'afternoon'

  // 5. البلوك الحالي (من البيانات المحفوظة)
  blocks = getDailyData(weekNum, todayKey, pattern).blocks
  currentBlock = findBlockByCurrentTime(blocks)

  // 6. البلوك التالي
  nextBlock = blocks[indexOf(currentBlock) + 1]

  // 7. تحديث UI
  updateStatCards()
  renderWeekOverview()
  renderTodayProgress()
  renderWeekStats()
}
```

### الإحصائيات الأسبوعية

```javascript
renderWeekStats(weekNum) {
  WEEK_SCHEDULE.map(day => {
    dayData = getDailyData(weekNum, day.key, day.pattern)
    activeBlocks = countNonBreakBlocks(dayData.blocks)
    totalPossible = countNonBreakBlocks(DEFAULT_BLOCKS[day.pattern])
    completion = (activeBlocks / totalPossible) * 100
  })

  // Render progress bars with colors per pattern
}
```

---

## Settings & Configuration

### الإعدادات المتاحة

#### الأصوات
- نغمة التنبيه الافتراضية (10 خيارات)
- مستوى الصوت (0-100%)
- تكرار التنبيه (on/off)
- عدد التكرارات (1-10)
- مدة التنبيه (5-60 ثانية)
- رفع نغمات مخصصة (MP3, WAV, OGG, M4A)

#### العامة
- اللغة (عربي/إنجليزي)
- المظهر (داكن/فاتح)
- اسم المستخدم
- تاريخ بداية الأسبوع
- الإشعارات (on/off)

#### لكل بلوك
- نغمة تنبيه خاصة لكل بلوك

### حفظ الإعدادات
```javascript
saveSettings() {
  // Read all inputs
  settings.defaultSound = document.getElementById('defaultSound').value
  settings.volume = ...
  settings.repeatAlarm = ...
  // ...

  // Save to localStorage
  DB.set('settings', settings)

  // Show toast
  showToast('تم الحفظ بنجاح', 'success')
}
```

---

## i18n System

### بنية التدويل

```javascript
const TRANSLATIONS = {
  ar: { 'key': 'النص العربي' },
  en: { 'key': 'English Text' }
}

function t(key) {
  return TRANSLATIONS[currentLang][key] || fallback
}

function applyTranslations() {
  // Update text content
  document.querySelectorAll('[data-i18n]').forEach(el => {
    el.textContent = t(el.getAttribute('data-i18n'))
  })

  // Update direction (RTL/LTR)
  if (currentLang === 'ar') {
    dir = 'rtl'
    lang = 'ar'
  } else {
    dir = 'ltr'
    lang = 'en'
  }
}

function setLanguage(lang) {
  currentLang = lang
  localStorage.setItem('murad_lang', lang)
  applyTranslations()
  reRenderDynamicContent()
}
```

### استخدامها في HTML
```html
<span data-i18n="dashboard.title">لوحة التحكم</span>
<input data-i18n-placeholder="settings.userName" ...>
```

---

## Component Interactions

### الصفحات الرئيسية

#### Dashboard
- يعرض إحصائيات الأسبوع الحالي
- يعرض اليوم الحالي تلقائياً
- يمكن الانتقال لصفحة Weekly أو Daily

#### Weekly Pattern Board
- جدول 7 أيام × 6 أعمدة
- تعديل مباشر (contenteditable)
- حفظ تلقائي
- زر "Open" للذهاب لصفحة اليوم

#### Daily Execution Board
- يعرض بلوكات اليوم
- يمكن إضافة/حذف/إعادة ترتيب البلوكات
- لكل بلوك: مؤقت + تفاصيل
- Pattern C فقط: Integration Builder

#### Settings
- إعدادات الأصوات
- إعدادات عامة
- نغمات مخصصة لكل بلوك

### الأحداث الرئيسية

#### 1. تغيير اليوم
```javascript
openDayBoard(dayKey, pattern)
  → Flush current day auto-save
  → Update global state
  → Load day data
  → Render blocks
  → Restore timers
```

#### 2. تعديل بلوك
```javascript
updateBlockName(blockId, value)
  → Update window.currentBlocks
  → autoSaveDaily()
    → Wait 200ms
    → saveDailyData()
      → Collect blocks from DOM
      → Save to DB
      → Show toast
```

#### 3. انتهاء مؤقت
```javascript
onBlockFinished(blockId)
  → Clear interval
  → Update UI (timer-finished class)
  → Play alarm sound
  → Show notification
  → Show modal
  → Update dashboard status
```

---

## Extension Points

### كيفية إضافة نمط جديد (Pattern E)

1. في `data.js`:
```javascript
const DEFAULT_BLOCKS = {
  E: [
    { id: 'e1', timeStart: '08:00', ... }
  ]
}
```

2. في `WEEK_SCHEDULE`:
```javascript
{ key: 'sat', pattern: 'E' }
```

3. في `i18n.js`:
```javascript
'pattern.e.name': 'Pattern E',
'pattern.e.title': '...',
...
```

4. في `index.html` (sidebar):
```html
<a href="#" class="nav-item pattern-e" onclick="showDayPattern('E', this)">
  <i class="fas fa-star"></i>
  <span data-i18n="nav.patternE">Pattern E</span>
</a>
```

5. في `css/style.css`:
```css
.nav-item.pattern-e:hover,
.nav-item.pattern-e.active {
  background: #purple;
  box-shadow: 0 4px 15px rgba(purple, 0.3);
}
```

### كيفية إضافة تقرير PDF جديد

1. في `export-pdf.js`:
```javascript
async function exportWeeklyPDF() {
  // Build HTML template
  // Include all 7 days
  // Open print window
}
```

---

## Performance Considerations

### Current Implementation
- **No Virtual Scrolling** - الجداول صغيرة (7 rows × 7 cols)
- **No Debouncing on Inputs** - Auto-save 200ms delay
- **Full Re-render on Changes** - Blocks re-render on every change

### Optimization Opportunities
1. Virtual scrolling للجداول الكبيرة
2. Debouncing على inputs
3. RequestAnimationFrame للanimations
4. Lazy loading للصور
5. Service Worker للـ PWA

---

## Security

### Current State
- **No Authentication** - لا يوجد نظام تسجيل دخول
- **Client-side Only** - كل البيانات في المتصفح
- **No Validation** - لا يوجد تحقق من المدخلات

### Recommendations
1. إضافة validation للوقت (HH:MM format)
2. Limit localStorage size
3. Sanitize inputs قبل الحفظ
4. Consider IndexedDB للبيانات الكبيرة

---

## Testing

### Manual Testing Checklist

#### Dashboard
- [ ] يعرض الأسبوع الحالي
- [ ] يعرض اليوم الحالي
- [ ] يعرض النمط الصحيح
- [ ] الإحصائيات تُحسب بشكل صحيح

#### Weekly Table
- [ ] تعديل الأعمدة يحفظ
- [ ] تعديل الخلايا يحفظ
- [ ] التنقل بين الأسابيع يعمل
- [ ] زر "Open" يفتح اليوم الصحيح

#### Daily Board
- [ ] البلوكات تظهر بشكل صحيح
- [ ] إضافة بلوك جديد يعمل
- [ ] حذف بلوك يعمل
- [ ] Drag & Drop يعمل
- [ ] حفظ التفاصيل يعمل

#### Timer
- [ ] Start يعمل
- [ ] Pause/Resume يعمل
- [ ] Reset يعمل
- [ ] Skip يعمل
- [ ] التنبيه يعمل
- [ ] الحفظ التلقائي يعمل

#### PDF
- [ ] تصدير اليوم يعمل
- [ ] التقرير يظهر بشكل صحيح
- [ ] الخطوط العربية تظهر

#### Settings
- [ ] حفظ الإعدادات يعمل
- [ ] تغيير اللغة يعمل
- [ ] تغيير المظهر يعمل
- [ ] رفع صوت مخصص يعمل

---

## Known Issues

### من AUDIT_REPORT.md

1. **فقدان بيانات البلوك عند التنقل السريع** - P0 Critical
2. **عدم حفظ goals/notes/outputs بشكل صحيح** - P0 Critical
3. **localStorage يصل لـ 5MB** - P2 Medium
4. **المؤقت لا يحفظ بشكل مستمر** - P0 Critical
5. **الإحصائيات في Dashboard وهمية** - P1 High

---

## Future Enhancements

### Phase 1: Core Fixes
- إصلاح مشاكل حفظ البيانات
- إصلاح حفظ المؤقت
- تحسين الإحصائيات

### Phase 2: Features
- Weekly PDF Report
- Calendar view
- Drag & drop للأسبوع
- Custom patterns

### Phase 3: Advanced
- PWA Support
- Cloud sync
- Analytics dashboard
- Social features

---

*تم إنشاء هذا التوثيق بناءً على الكود المصدري الفعلي لـ Murad Learning Planner v3.0*