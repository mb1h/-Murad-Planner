/* ============================================================
   MURAD LEARNING PLANNER - i18n (Arabic / English)
   ============================================================ */

const TRANSLATIONS = {
  ar: {
    // Navigation
    'nav.main': 'الرئيسية',
    'nav.dashboard': 'لوحة التحكم',
    'nav.weekly': 'الجدول الأسبوعي',
    'nav.patterns': 'الأنماط',
    'nav.patternA': 'النمط A - تعلم جديد',
    'nav.patternB': 'النمط B - ترسيخ',
    'nav.patternC': 'النمط C - دمج',
    'nav.patternD': 'النمط D - إغلاق',
    'nav.tools': 'الأدوات',
    'nav.settings': 'الإعدادات',

    // User
    'user.role': 'مخطط التعلم',

    // Dashboard
    'dashboard.title': 'لوحة التحكم',
    'dashboard.subtitle': 'نظام التعلم اليومي المتقدم',
    'dashboard.weekOverview': 'نظرة سريعة على الأسبوع',
    'dashboard.todayProgress': 'تقدم اليوم',
    'dashboard.weekStats': 'إحصائيات الأسبوع',

    // Status Cards
    'status.week': 'الأسبوع الحالي',
    'status.pattern': 'النمط الحالي',
    'status.day': 'اليوم الحالي',
    'status.session': 'الجلسة',
    'status.block': 'البلوك الحالي',
    'status.timer': 'المؤقت',
    'status.next': 'البلوك التالي',
    'status.status': 'الحالة',

    // Weekly
    'weekly.title': 'Weekly Pattern Board',
    'weekly.subtitle': 'الجدول الأسبوعي القابل للتحرير',
    'weekly.week': 'الأسبوع',
    'weekly.saved': 'تم الحفظ التلقائي',

    // Table headers
    'table.day': 'اليوم',
    'table.pattern': 'النمط',
    'table.actions': 'إجراءات',

    // Buttons
    'btn.exportWeekly': 'تصدير PDF أسبوعي',
    'btn.exportDaily': 'تصدير PDF يومي',
    'btn.exportMonthly': 'تصدير PDF شهري',
    'btn.newWeek': 'أسبوع جديد',
    'btn.save': 'حفظ',
    'btn.back': 'رجوع',
    'btn.open': 'فتح',

    // Days
    'day.sat': 'السبت',
    'day.sun': 'الأحد',
    'day.mon': 'الإثنين',
    'day.tue': 'الثلاثاء',
    'day.wed': 'الأربعاء',
    'day.thu': 'الخميس',
    'day.fri': 'الجمعة',

    // Patterns
    'pattern.a.name': 'Pattern A',
    'pattern.a.title': 'تعلم مفاهيم جديدة',
    'pattern.a.tag': 'يوم التعلم الجديد',
    'pattern.a.goal': 'الهدف من هذا اليوم',
    'pattern.a.goalText': 'هذا اليوم مخصص لاكتساب معرفة جديدة لأول مرة. يتم التركيز على الفهم وليس الإتقان. في هذا اليوم تتعرف على المفاهيم الجديدة وتبني أول تصور ذهني عنها.',
    'pattern.a.example': 'مثال عملي',
    'pattern.a.exampleText': 'تعلم Functions لأول مرة • كتابة أول Function بسيطة • قراءة مفهوم جديد • بناء تطبيق صغير',
    'pattern.a.focus': 'ما يجب التركيز عليه',
    'pattern.a.focusText': 'الفهم الأولي • التعرض للمفهوم • التطبيق الأول',
    'pattern.a.avoid': 'ما يجب تجنبه',
    'pattern.a.avoidText': 'التعمق الزائد • حفظ التفاصيل • القلق من عدم الإتقان',

    'pattern.b.name': 'Pattern B',
    'pattern.b.title': 'يوم الترسيخ',
    'pattern.b.tag': 'يوم الترسيخ',
    'pattern.b.goal': 'الهدف من هذا اليوم',
    'pattern.b.goalText': 'هذا اليوم مخصص لترسيخ المعرفة السابقة. لا تتعلم مفاهيم كبيرة جديدة. تركز على حل التمارين والتكرار والتطبيق. تحول الفهم الأولي إلى مهارة عملية.',
    'pattern.b.example': 'مثال عملي',
    'pattern.b.exampleText': 'حل 20 مسألة على Functions • تحسين الكود • تجربة أمثلة إضافية • تطوير المشروع',
    'pattern.b.focus': 'ما يجب التركيز عليه',
    'pattern.b.focusText': 'حل المسائل • تحسين الكود • التكرار المتعمد',
    'pattern.b.avoid': 'ما يجب تجنبه',
    'pattern.b.avoidText': 'تعلم مفاهيم كبيرة جديدة • الانشغال بأشياء خارج الأسبوع',

    'pattern.c.name': 'Pattern C',
    'pattern.c.title': 'يوم الدمج والتكامل',
    'pattern.c.tag': 'أهم يوم في النظام',
    'pattern.c.goal': 'الهدف من هذا اليوم',
    'pattern.c.goalText': 'هذا أهم يوم في النظام. الغرض منه ربط جميع المفاهيم التي تعلمتها سابقاً. تجمع الرياضيات والبرمجة وعلوم الحاسوب في مشروع أو تطبيق واحد. تبحث عن العلاقات بين المفاهيم.',
    'pattern.c.example': 'مثال عملي',
    'pattern.c.exampleText': 'Functions + Variables + Algorithms → برنامج متكامل يستخدم الثلاثة معاً',
    'pattern.c.focus': 'ما يجب التركيز عليه',
    'pattern.c.focusText': 'ربط المفاهيم • بناء شيء متكامل • فهم العلاقات',
    'pattern.c.avoid': 'ما يجب تجنبه',
    'pattern.c.avoidText': 'تعلم مفاهيم جديدة • العمل على كل موضوع بمعزل',

    'pattern.d.name': 'Pattern D',
    'pattern.d.title': 'إغلاق الأسبوع',
    'pattern.d.tag': 'اختبار وتقييم',
    'pattern.d.goal': 'الهدف من هذا اليوم',
    'pattern.d.goalText': 'هذا اليوم مخصص لقياس مستوى الفهم الحقيقي. تختبر نفسك دون الرجوع للمراجع. تحدد نقاط القوة والضعف. تغلق الأسبوع بخلاصة واضحة.',
    'pattern.d.example': 'مثال عملي',
    'pattern.d.exampleText': 'حل اختبار من الذاكرة • كتابة برنامج دون مراجعة • شرح المفاهيم بصوتك • رفع النسخة النهائية',
    'pattern.d.focus': 'ما يجب التركيز عليه',
    'pattern.d.focusText': 'الاختبار الحقيقي • الملاحظات الصادقة • تحديد الفجوات',
    'pattern.d.avoid': 'ما يجب تجنبه',
    'pattern.d.avoidText': 'النظر للمراجع أثناء الاختبار • التهاون في التقييم',

    // Block names (defaults)
    'block.review': 'مراجعة',
    'block.math': 'رياضيات',
    'block.break': 'استراحة',
    'block.programming': 'برمجة',
    'block.cs': 'علوم الحاسوب',
    'block.lunch': 'غداء',
    'block.integration': 'تطبيق متكامل',
    'block.project': 'مشروع',
    'block.closing': 'إغلاق',

    // Panel
    'panel.title': 'تفاصيل البلوك',
    'panel.name': 'اسم البلوك',
    'panel.time': 'الوقت',
    'panel.activity': 'النشاط',
    'panel.goal': 'الهدف',
    'panel.learn': 'ماذا سأتعلم؟',
    'panel.apply': 'ماذا سأطبق؟',
    'panel.notes': 'الملاحظات',
    'panel.outputs': 'المخرجات المتوقعة',
    'panel.sound': 'نغمة التنبيه',

    // Integration
    'integration.title': 'Integration Builder',
    'integration.subtitle': 'اربط المفاهيم بصرياً',
    'integration.math': 'المفهوم الرياضي',
    'integration.prog': 'المفهوم البرمجي',
    'integration.cs': 'مفهوم علوم الحاسوب',
    'integration.result': 'الناتج المتكامل',
    'integration.relation': 'كيف ترتبط معاً؟',
    'integration.build': 'بناء المخطط',

    // Modal
    'modal.blockFinished': 'انتهى البلوك!',
    'modal.nextBlock': 'البلوك التالي:',
    'modal.startNext': 'ابدأ البلوك التالي',
    'modal.close': 'إغلاق',

    // Settings
    'settings.title': 'الإعدادات',
    'settings.subtitle': 'تخصيص تجربة التعلم',
    'settings.sound': 'إعدادات الأصوات',
    'settings.defaultSound': 'نغمة التنبيه الافتراضية',
    'settings.volume': 'مستوى الصوت',
    'settings.repeat': 'تكرار التنبيه',
    'settings.repeatCount': 'عدد التكرارات',
    'settings.duration': 'مدة التنبيه',
    'settings.uploadSound': 'رفع نغمة مخصصة',
    'settings.upload': 'رفع ملف صوتي',
    'settings.uploadHint': 'MP3, WAV, OGG, M4A',
    'settings.customSounds': 'نغماتي المخصصة',
    'settings.general': 'الإعدادات العامة',
    'settings.language': 'اللغة',
    'settings.theme': 'المظهر',
    'settings.dark': 'داكن',
    'settings.light': 'فاتح',
    'settings.userName': 'اسم المستخدم',
    'settings.weekStart': 'بداية الأسبوع',
    'settings.notifications': 'الإشعارات',
    'settings.perBlockSound': 'نغمة مخصصة لكل بلوك',

    // Timer
    'timer.start': 'ابدأ',
    'timer.pause': 'إيقاف',
    'timer.resume': 'استئناف',
    'timer.reset': 'إعادة',
    'timer.skip': 'تخطي',
    'timer.details': 'تفاصيل',

    // Toast
    'toast.saved': 'تم الحفظ بنجاح',
    'toast.error': 'حدث خطأ',
    'toast.pdfExport': 'جارٍ تصدير PDF...',
    'toast.pdfDone': 'تم تصدير PDF بنجاح',

    // Sessions
    'session.morning': 'جلسة صباحية',
    'session.afternoon': 'جلسة مسائية',
    'status.active': 'نشط',
    'status.idle': 'في انتظار',
  },

  en: {
    // Navigation
    'nav.main': 'Main',
    'nav.dashboard': 'Dashboard',
    'nav.weekly': 'Weekly Schedule',
    'nav.patterns': 'Patterns',
    'nav.patternA': 'Pattern A - New Learning',
    'nav.patternB': 'Pattern B - Reinforcement',
    'nav.patternC': 'Pattern C - Integration',
    'nav.patternD': 'Pattern D - Closure',
    'nav.tools': 'Tools',
    'nav.settings': 'Settings',

    // User
    'user.role': 'Learning Planner',

    // Dashboard
    'dashboard.title': 'Dashboard',
    'dashboard.subtitle': 'Advanced Daily Learning System',
    'dashboard.weekOverview': 'Week Overview',
    'dashboard.todayProgress': "Today's Progress",
    'dashboard.weekStats': 'Week Statistics',

    // Status Cards
    'status.week': 'Current Week',
    'status.pattern': 'Current Pattern',
    'status.day': 'Current Day',
    'status.session': 'Session',
    'status.block': 'Current Block',
    'status.timer': 'Timer',
    'status.next': 'Next Block',
    'status.status': 'Status',

    // Weekly
    'weekly.title': 'Weekly Pattern Board',
    'weekly.subtitle': 'Editable Weekly Schedule',
    'weekly.week': 'Week',
    'weekly.saved': 'Auto-saved',

    // Table headers
    'table.day': 'Day',
    'table.pattern': 'Pattern',
    'table.actions': 'Actions',

    // Buttons
    'btn.exportWeekly': 'Export Weekly PDF',
    'btn.exportDaily': 'Export Daily PDF',
    'btn.exportMonthly': 'Export Monthly PDF',
    'btn.newWeek': 'New Week',
    'btn.save': 'Save',
    'btn.back': 'Back',
    'btn.open': 'Open',

    // Days
    'day.sat': 'Saturday',
    'day.sun': 'Sunday',
    'day.mon': 'Monday',
    'day.tue': 'Tuesday',
    'day.wed': 'Wednesday',
    'day.thu': 'Thursday',
    'day.fri': 'Friday',

    // Patterns
    'pattern.a.name': 'Pattern A',
    'pattern.a.title': 'Learning New Concepts',
    'pattern.a.tag': 'New Learning Day',
    'pattern.a.goal': "Today's Goal",
    'pattern.a.goalText': 'This day is dedicated to acquiring new knowledge for the first time. Focus is on understanding, not mastery. You explore new concepts and build your first mental model.',
    'pattern.a.example': 'Practical Example',
    'pattern.a.exampleText': 'Learn Functions for the first time • Write your first simple Function • Read a new CS concept • Build a tiny app',
    'pattern.a.focus': 'What to Focus On',
    'pattern.a.focusText': 'Initial understanding • First exposure • First implementation',
    'pattern.a.avoid': 'What to Avoid',
    'pattern.a.avoidText': 'Over-diving • Memorizing details • Worrying about mastery',

    'pattern.b.name': 'Pattern B',
    'pattern.b.title': 'Reinforcement Day',
    'pattern.b.tag': 'Reinforcement Day',
    'pattern.b.goal': "Today's Goal",
    'pattern.b.goalText': 'This day is for reinforcing previous knowledge. No big new concepts. Focus on solving exercises, repetition, and application. Turn initial understanding into practical skill.',
    'pattern.b.example': 'Practical Example',
    'pattern.b.exampleText': 'Solve 20 problems on Functions • Improve yesterday\'s code • Try more examples • Develop the project',
    'pattern.b.focus': 'What to Focus On',
    'pattern.b.focusText': 'Solving problems • Improving code • Deliberate practice',
    'pattern.b.avoid': 'What to Avoid',
    'pattern.b.avoidText': 'Learning big new concepts • Working outside this week\'s scope',

    'pattern.c.name': 'Pattern C',
    'pattern.c.title': 'Integration Day',
    'pattern.c.tag': 'Most Important Day',
    'pattern.c.goal': "Today's Goal",
    'pattern.c.goalText': 'This is the most important day in the system. Its purpose is to connect all the concepts you learned. Combine Math, Programming, and CS into one project or application. Look for relationships.',
    'pattern.c.example': 'Practical Example',
    'pattern.c.exampleText': 'Functions + Variables + Algorithms → An integrated program using all three',
    'pattern.c.focus': 'What to Focus On',
    'pattern.c.focusText': 'Connecting concepts • Building something complete • Finding relationships',
    'pattern.c.avoid': 'What to Avoid',
    'pattern.c.avoidText': 'Learning new concepts • Working on each topic in isolation',

    'pattern.d.name': 'Pattern D',
    'pattern.d.title': 'Weekly Closure',
    'pattern.d.tag': 'Test & Evaluation',
    'pattern.d.goal': "Today's Goal",
    'pattern.d.goalText': "This day is for measuring your true understanding. Test yourself without references. Identify strengths and weaknesses. Close the week with a clear summary.",
    'pattern.d.example': 'Practical Example',
    'pattern.d.exampleText': 'Solve a math test from memory • Write a program without looking at old code • Explain concepts aloud • Submit final project version',
    'pattern.d.focus': 'What to Focus On',
    'pattern.d.focusText': 'Honest self-testing • Identifying gaps • Clear closure',
    'pattern.d.avoid': 'What to Avoid',
    'pattern.d.avoidText': 'Looking at references during tests • Being lenient in self-evaluation',

    // Block names
    'block.review': 'Review',
    'block.math': 'Mathematics',
    'block.break': 'Break',
    'block.programming': 'Programming',
    'block.cs': 'Computer Science',
    'block.lunch': 'Lunch',
    'block.integration': 'Integration',
    'block.project': 'Project',
    'block.closing': 'Closing',

    // Panel
    'panel.title': 'Block Details',
    'panel.name': 'Block Name',
    'panel.time': 'Time',
    'panel.activity': 'Activity',
    'panel.goal': 'Goal',
    'panel.learn': 'What will I learn?',
    'panel.apply': 'What will I apply?',
    'panel.notes': 'Notes',
    'panel.outputs': 'Expected Outputs',
    'panel.sound': 'Alarm Sound',

    // Integration
    'integration.title': 'Integration Builder',
    'integration.subtitle': 'Visually connect concepts',
    'integration.math': 'Math Concept',
    'integration.prog': 'Programming Concept',
    'integration.cs': 'CS Concept',
    'integration.result': 'Integrated Output',
    'integration.relation': 'How do they connect?',
    'integration.build': 'Build Diagram',

    // Modal
    'modal.blockFinished': 'Block Finished!',
    'modal.nextBlock': 'Next Block:',
    'modal.startNext': 'Start Next Block',
    'modal.close': 'Close',

    // Settings
    'settings.title': 'Settings',
    'settings.subtitle': 'Customize your learning experience',
    'settings.sound': 'Sound Settings',
    'settings.defaultSound': 'Default Alarm Sound',
    'settings.volume': 'Volume',
    'settings.repeat': 'Repeat Alarm',
    'settings.repeatCount': 'Repeat Count',
    'settings.duration': 'Alarm Duration',
    'settings.uploadSound': 'Upload Custom Sound',
    'settings.upload': 'Upload Sound File',
    'settings.uploadHint': 'MP3, WAV, OGG, M4A',
    'settings.customSounds': 'My Custom Sounds',
    'settings.general': 'General Settings',
    'settings.language': 'Language',
    'settings.theme': 'Theme',
    'settings.dark': 'Dark',
    'settings.light': 'Light',
    'settings.userName': 'Username',
    'settings.weekStart': 'Week Start Date',
    'settings.notifications': 'Notifications',
    'settings.perBlockSound': 'Custom Sound Per Block',

    // Timer
    'timer.start': 'Start',
    'timer.pause': 'Pause',
    'timer.resume': 'Resume',
    'timer.reset': 'Reset',
    'timer.skip': 'Skip',
    'timer.details': 'Details',

    // Toast
    'toast.saved': 'Saved successfully',
    'toast.error': 'An error occurred',
    'toast.pdfExport': 'Exporting PDF...',
    'toast.pdfDone': 'PDF exported successfully',

    // Sessions
    'session.morning': 'Morning Session',
    'session.afternoon': 'Afternoon Session',
    'status.active': 'Active',
    'status.idle': 'Idle',
  }
};

let currentLang = localStorage.getItem('murad_lang') || 'ar';

function t(key) {
  return (TRANSLATIONS[currentLang] && TRANSLATIONS[currentLang][key]) || 
         (TRANSLATIONS['ar'] && TRANSLATIONS['ar'][key]) || key;
}

function applyTranslations() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    el.textContent = t(key);
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    el.placeholder = t(el.getAttribute('data-i18n-placeholder'));
  });
  // Update HTML direction
  if (currentLang === 'ar') {
    document.documentElement.setAttribute('dir', 'rtl');
    document.documentElement.setAttribute('lang', 'ar');
    document.documentElement.setAttribute('data-lang', 'ar');
  } else {
    document.documentElement.setAttribute('dir', 'ltr');
    document.documentElement.setAttribute('lang', 'en');
    document.documentElement.setAttribute('data-lang', 'en');
  }
}

function setLanguage(lang) {
  currentLang = lang;
  localStorage.setItem('murad_lang', lang);
  applyTranslations();
  // Update active buttons
  document.getElementById('langAr').classList.toggle('active', lang === 'ar');
  document.getElementById('langEn').classList.toggle('active', lang === 'en');
  // Re-render dynamic content
  if (window.renderWeeklyTable) renderWeeklyTable();
  if (window.renderDashboard) renderDashboard();
  if (window.currentDayPattern) showDayPatternBoard(window.currentDayPattern, window.currentDayKey);
  showToast(lang === 'ar' ? 'تم تغيير اللغة إلى العربية' : 'Language changed to English', 'info');
}

function toggleLanguage() {
  setLanguage(currentLang === 'ar' ? 'en' : 'ar');
}

// Initialize on load
document.addEventListener('DOMContentLoaded', () => {
  applyTranslations();
  document.getElementById('langAr').classList.toggle('active', currentLang === 'ar');
  document.getElementById('langEn').classList.toggle('active', currentLang === 'en');
});
