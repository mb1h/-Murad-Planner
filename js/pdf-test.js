/**
 * pdf-test.js — Minimal PDF test to diagnose Arabic text clipping
 */
async function testArabicPDF() {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF('p', 'mm', 'a4');

  // Load Tajawal font
  for (const url of ['Tajawal-Regular.ttf', 'Tajawal-Bold.ttf']) {
    const r = await fetch(url);
    const buf = await r.arrayBuffer();
    let bin = '';
    const bytes = new Uint8Array(buf);
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    doc.addFileToVFS(url, window.btoa(bin));
  }
  doc.addFont('Tajawal-Regular.ttf', 'Tajawal', 'normal');
  doc.addFont('Tajawal-Bold.ttf', 'Tajawal', 'bold');

  const tests = [
    { text: 'دفتر التعلم الاحترافي', note: 'original long text' },
    { text: 'دفتر', note: 'single word' },
    { text: 'التاريخ', note: 'starts with ا' },
    { text: 'اليوم', note: 'starts with ا' },
    { text: 'الأسبوع', note: 'starts with ا' },
    { text: 'الأهداف', note: 'starts with ا' },
    { text: 'الملاحظات', note: 'starts with ا, ends with ت' },
    { text: 'المخرجات', note: 'starts with ا, ends with ت' },
    { text: 'المشروع', note: 'starts with ا' },
    { text: 'إغلاق', note: 'starts with إ' },
    { text: 'مراد', note: 'no Alef start' },
    { text: 'محمد', note: 'common name' },
    { text: 'رياضيات', note: 'common subject' },
    { text: 'برمجة', note: 'common subject' },
    { text: 'أ', note: 'single Alef' },
    { text: 'ا', note: 'single Alef' },
    { text: 'ت', note: 'single Ta' },
    { text: 'ب', note: 'single Beh' },
  ];

  doc.setFont('Tajawal', 'normal');
  doc.setFontSize(14);
  doc.text('Arabic Text Clipping Test', 105, 15, { align: 'center' });
  doc.text('Tajawal Font — Raw Unicode (NO Presentation Forms)', 105, 22, { align: 'center' });

  let y = 35;
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text('METHOD 1: align:"right" with x=190 (close to right edge)', 15, y, { align: 'left' });
  y += 8;

  tests.forEach((t, i) => {
    doc.setFont('Tajawal', 'normal');
    doc.setFontSize(12);
    doc.setTextColor(50);
    // Method: align:'right' at x=190
    doc.text(t.text, 190, y, { align: 'right' });
    doc.setFontSize(8);
    doc.setTextColor(180);
    doc.text(t.note, 15, y, { align: 'left' });
    y += 8;
    if (y > 280) { doc.addPage(); y = 20; }
  });

  y += 10;
  doc.setTextColor(100);
  doc.setFontSize(10);
  doc.text('METHOD 2: align:"right" with x=205 (very close to edge)', 15, y, { align: 'left' });
  y += 8;

  tests.forEach((t, i) => {
    doc.setFont('Tajawal', 'normal');
    doc.setFontSize(12);
    doc.setTextColor(50);
    doc.text(t.text, 205, y, { align: 'right' });
    doc.setFontSize(8);
    doc.setTextColor(180);
    doc.text(t.note, 15, y, { align: 'left' });
    y += 8;
    if (y > 280) { doc.addPage(); y = 20; }
  });

  y += 10;
  doc.setTextColor(100);
  doc.setFontSize(10);
  doc.text('METHOD 3: Raw text with getTextWidth positioning (manual)', 15, y, { align: 'left' });
  y += 8;

  tests.forEach((t, i) => {
    doc.setFont('Tajawal', 'normal');
    doc.setFontSize(12);
    doc.setTextColor(50);
    // Manual positioning: calculate width, then left edge = 190 - width
    const w = doc.getTextWidth(t.text);
    doc.text(t.text, 190 - w, y, { align: 'left' });
    doc.setFontSize(8);
    doc.setTextColor(180);
    doc.text(t.note + ' w=' + w.toFixed(1) + 'mm', 15, y, { align: 'left' });
    y += 8;
    if (y > 280) { doc.addPage(); y = 20; }
  });

  y += 10;
  doc.setTextColor(100);
  doc.setFontSize(10);
  doc.text('METHOD 4: align:"left" at x=15 (far from edge)', 15, y, { align: 'left' });
  y += 8;

  tests.forEach((t, i) => {
    doc.setFont('Tajawal', 'normal');
    doc.setFontSize(12);
    doc.setTextColor(50);
    doc.text(t.text, 15, y, { align: 'left' });
    doc.setFontSize(8);
    doc.setTextColor(180);
    doc.text(t.note, 100, y, { align: 'left' });
    y += 8;
    if (y > 280) { doc.addPage(); y = 20; }
  });

  doc.save('arabic-test.pdf');
}

window.testArabicPDF = testArabicPDF;