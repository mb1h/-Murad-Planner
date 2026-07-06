/**
 * export-pdf.js — CSS-to-PDF for Arabic (replaces jsPDF-based solution)
 * Uses window.print() with properly formatted HTML + Tajawal font
 */

function safe(val) {
  if (val === null || val === undefined) return '';
  if (typeof val === 'object') return String(val.ar || val.en || '');
  return String(val);
}

function toWesternDigits(text) {
  return String(text).replace(/[\u0660-\u0669\u06F0-\u06F9]/g, function(ch) {
    const code = ch.charCodeAt(0);
    const base = code >= 0x06F0 ? 0x06F0 : 0x0660;
    return String.fromCharCode(code - base + 48);
  });
}

async function exportDailyPDF() {
  showToast('جاري فتح نافذة الطباعة...', 'info');

  const ls = document.getElementById('loading-screen');
  const lm = document.getElementById('loading-msg');
  if (ls) { ls.style.display = 'flex'; ls.style.zIndex = '9999'; if (lm) lm.textContent = 'بناء التقرير...'; }

  try {
    // Ensure current data is saved before building PDF
    const wasOnDailyPage = !!window.currentDayKey;
    if (wasOnDailyPage && window.currentWeekNum) {
      saveDailyData(true);
    }

    const userName = toWesternDigits((window.settings?.userName) || 'مراد');
    const weekNum = toWesternDigits(String(window.currentWeekNum || 1));
    
    // Use CURRENT ACTIVE DAY from app state — not fallback defaults
    let dayKey = window.currentDayKey || 'sat';
    let pattern = window.currentDayPattern || 'A';
    let blocks = [];
    
    if (wasOnDailyPage && dayKey && weekNum) {
      const dayData = getDailyData(weekNum, dayKey, pattern);
      blocks = dayData.blocks || [];
    } else {
      // Fallback: get today's schedule
      const today = new Date();
      const dayOfWeek = today.getDay();
      const dayMap = { 6: 'sat', 0: 'sun', 1: 'mon', 2: 'tue', 3: 'wed', 4: 'thu', 5: 'fri' };
      dayKey = dayMap[dayOfWeek] || 'sat';
      pattern = (WEEK_SCHEDULE.find(d => d.key === dayKey) || {}).pattern || 'A';
      const dayData = getDailyData(weekNum, dayKey, pattern);
      blocks = dayData.blocks || [];
    }
    
    const dayInfo = (WEEK_SCHEDULE || []).find(d => d.key === dayKey) || { dayAr: 'السبت', dayEn: 'Saturday' };
    const dayName = safe(dayInfo.dayAr);
    const goals = blocks.filter(b => safe(b.goal).trim());
    const notes = blocks.filter(b => safe(b.notes).trim());
    const outputs = blocks.filter(b => safe(b.outputs).trim());

    const now = new Date();
    const today = toWesternDigits(now.toLocaleDateString('ar-SA'));

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
.cover-en { font-size: 10pt; text-align: center; color: #94a3b8; margin-top: 4px; }
.cover-title-ar { font-size: 20pt; font-weight: 700; color: #2563eb; text-align: center; margin-top: 18px; }
.cover-line { width: 70mm; height: 2px; background: #2563eb; margin: 14px auto; position: relative; }
.cover-line::after { content: ''; position: absolute; top: -5px; left: 50%; transform: translateX(-50%); width: 10px; height: 10px; background: #10b981; border-radius: 50%; }
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
.page-subtitle { font-size: 10pt; color: #64748b; }

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
    <div class="cover-en">Learning Intelligence System</div>
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
    <div class="page-subtitle">${dayName}</div>
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
    const cls = b.isBreak ? 'break-row' : '';
    return `<tr class="${cls}">
      <td style="white-space:nowrap;text-align:center;font-weight:bold;color:#2563eb">${safe(b.timeStart)}${b.timeEnd ? ' - ' + safe(b.timeEnd) : ''}</td>
      <td>${safe(b.name)}</td><td>${safe(b.goal)}</td><td>${safe(b.notes)}</td><td>${safe(b.outputs)}</td>
    </tr>`;
  }).join('') + '</tbody></table>' : '<p style="text-align:center;color:#94a3b8;padding:10mm">لا توجد بلوكات</p>'}
  <div class="footer"><span></span><span>Murad Planner</span></div>
</div>

<div class="page">
  <div class="page-header">
    <div class="page-title">الأهداف والملاحظات</div>
    <div class="page-subtitle">${dayName}</div>
  </div>
  <div class="sec" style="--sc:#10b981">أهداف اليوم</div>
  ${goals.length ? goals.map(g => `<div class="card card-goal">
    <div class="card-head"><span class="card-name">${safe(g.name)}</span><span class="card-time">${safe(g.timeStart)}${g.timeEnd ? ' - ' + safe(g.timeEnd) : ''}</span></div>
    <div class="card-body">${safe(g.goal)}</div>
  </div>`).join('') : '<div class="card"><div class="card-body">لا توجد أهداف مسجلة</div></div>'}
  <div class="sec" style="--sc:#0ea5e9;margin-top:10mm">ملاحظات اليوم</div>
  ${notes.length ? notes.map(n => `<div class="card card-note">
    <div class="card-head"><span class="card-name">${safe(n.name)}</span><span class="card-time">${safe(n.timeStart)}${n.timeEnd ? ' - ' + safe(n.timeEnd) : ''}</span></div>
    <div class="card-body">${safe(n.notes)}</div>
  </div>`).join('') : '<div class="card"><div class="card-body">لا توجد ملاحظات مسجلة</div></div>'}
  <div class="footer"><span></span><span>Murad Planner</span></div>
</div>

<div class="page">
  <div class="page-header">
    <div class="page-title">المخرجات والخلاصة</div>
    <div class="page-subtitle">${dayName}</div>
  </div>
  <div class="sec" style="--sc:#22c55e">مخرجات اليوم</div>
  ${outputs.length ? outputs.map(o => `<div class="card card-output">
    <div class="card-head"><span class="card-name">${safe(o.name)}</span><span class="card-time">${safe(o.timeStart)}${o.timeEnd ? ' - ' + safe(o.timeEnd) : ''}</span></div>
    <div class="card-body">${safe(o.outputs)}</div>
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

window.exportDailyPDF = exportDailyPDF;
window.exportWeeklyPDF = exportWeeklyPDF;