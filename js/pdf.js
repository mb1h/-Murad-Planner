/**
 * pdf.js  — Professional PDF Generation Engine using pure jsPDF
 * ──────────────────────────────────────────────
 * Architecture:
 *   • Pure jsPDF and jspdf-autotable
 *   • Procedural generation for pixel-perfect control
 *   • Native Arabic/RTL shaping and rendering
 */

function safe(val) {
  if (val === null || val === undefined) return '';
  if (typeof val === 'object') {
    return String(val.ar || val.en || '');
  }
  return String(val);
}

function bufferToBase64(buffer) {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

function shapeArabic(text) {
  if (!text) return '';
  let str = String(text);
  if (window.ArabicReshaper && window.ArabicReshaper.convertArabic) {
    str = window.ArabicReshaper.convertArabic(str);
  }
  return str;
}

function reverseString(text) {
  return String(text).split('').reverse().join('');
}

async function exportDailyPDF() {
  showToast(t('toast.pdfExport') || 'جاري بناء التقرير الاحترافي...', 'info');

  const loadingScreen = document.getElementById('loading-screen');
  const loadingMsg    = document.getElementById('loading-msg');
  if (loadingScreen) {
    loadingScreen.style.display = 'flex';
    loadingScreen.style.zIndex = '9999';
    if (loadingMsg) loadingMsg.textContent = 'تحميل الخطوط وبناء التقرير...';
  }

  try {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });

    // Load Fonts via Fetch (Smart fallback for local file:/// executions)
    const fontUrls = ['Tajawal-Regular.ttf', 'Tajawal-Bold.ttf'];
    const isFileProtocol = window.location.protocol === 'file:';
    
    for (const url of fontUrls) {
      let buffer = null;
      
      // If we are not on file:///, try fetching locally first
      if (!isFileProtocol) {
        try {
          const resp = await fetch(url);
          if (resp.ok) buffer = await resp.arrayBuffer();
        } catch (e) {
          console.warn(`Local fetch for ${url} failed. Falling back to CDN...`);
        }
      }
      
      // If local fetch failed or was skipped, fetch from CDN
      if (!buffer) {
        try {
          const cdnUrl = `https://raw.githubusercontent.com/google/fonts/main/ofl/tajawal/${url}`;
          const resp = await fetch(cdnUrl);
          if (!resp.ok) throw new Error("CDN response not ok");
          buffer = await resp.arrayBuffer();
        } catch (e) {
          throw new Error("فشل تحميل الخطوط من الإنترنت. يرجى التأكد من اتصالك بالشبكة.");
        }
      }
      
      const b64 = bufferToBase64(buffer);
      doc.addFileToVFS(url, b64);
    }
    doc.addFont('Tajawal-Regular.ttf', 'Tajawal', 'normal');
    doc.addFont('Tajawal-Bold.ttf', 'Tajawal', 'bold');

    const userName     = (window.settings && window.settings.userName) ? window.settings.userName : 'مراد';
    const weekNum      = window.currentWeekNum || 1;
    const dayKey       = window.currentDayKey  || 'sat';
    const pattern      = window.currentDayPattern || 'A';
    const dayInfo      = (window.WEEK_SCHEDULE || []).find(d => d.key === dayKey) || { dayAr: 'السبت' };
    const dayName      = safe(dayInfo.dayAr);
    const today        = new Date().toLocaleDateString('ar-SA');
    const blocks       = window.currentBlocks || [];
    
    const allGoals     = blocks.filter(b => safe(b.goal).trim() !== '');
    const allNotes     = blocks.filter(b => safe(b.notes).trim() !== '');
    const allOutputs   = blocks.filter(b => safe(b.outputs).trim() !== '');

    const colors = {
      primary: [37, 99, 235],   // #2563EB
      secondary: [14, 165, 233], // #0EA5E9
      accent: [20, 184, 166],    // #14B8A6
      success: [34, 197, 94],    // #22C55E
      bg: [248, 250, 252],       // #F8FAFC
      text: [15, 23, 42],        // #0F172A
      textMuted: [148, 163, 184] // #94A3B8
    };

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    const drawTextRTL = (text, x, y, options = {}) => {
      const shaped = shapeArabic(text);
      const reversed = reverseString(shaped);
      doc.text(reversed, x, y, { align: 'right', ...options });
    };

    const drawHeader = (title, subtitle) => {
      doc.setFillColor(...colors.primary);
      doc.rect(0, 0, pageWidth, 4, 'F');
      
      doc.setFont('Tajawal', 'bold');
      doc.setFontSize(16);
      doc.setTextColor(...colors.primary);
      drawTextRTL(title, pageWidth - 15, 18);
      
      doc.setFont('Tajawal', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(...colors.textMuted);
      drawTextRTL(subtitle, 15 + doc.getTextWidth(reverseString(shapeArabic(subtitle))), 18); // Left align trick for right-aligned origin
      
      doc.setDrawColor(226, 232, 240);
      doc.line(15, 22, pageWidth - 15, 22);
    };

    const drawFooter = (pageNum, totalPages) => {
      doc.setDrawColor(226, 232, 240);
      doc.line(15, pageHeight - 15, pageWidth - 15, pageHeight - 15);
      
      doc.setFont('Tajawal', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(...colors.textMuted);
      drawTextRTL(`صفحة ${pageNum} من ${totalPages}`, pageWidth / 2 + 10, pageHeight - 8);
      drawTextRTL(today, 15 + doc.getTextWidth(reverseString(shapeArabic(today))), pageHeight - 8);
    };

    // --- PAGE 1: COVER ---
    doc.setFillColor(...colors.bg);
    doc.rect(0, 0, pageWidth, pageHeight, 'F');
    
    doc.setFillColor(...colors.primary);
    doc.rect(0, 0, pageWidth, 8, 'F');
    
    doc.setFont('Tajawal', 'bold');
    doc.setFontSize(40);
    doc.setTextColor(...colors.text);
    // English text doesn't need reverse
    doc.text("Murad Planner", pageWidth / 2, 80, { align: 'center' });
    
    doc.setFontSize(16);
    doc.setTextColor(...colors.primary);
    drawTextRTL("دفتر الدراسة الاحترافي", pageWidth / 2 + doc.getTextWidth(reverseString(shapeArabic("دفتر الدراسة الاحترافي")))/2, 95);
    
    doc.setDrawColor(...colors.primary);
    doc.setLineWidth(1);
    doc.line(pageWidth/2 - 20, 105, pageWidth/2 + 20, 105);
    
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(pageWidth/2 - 75, 130, 150, 60, 3, 3, 'FD');
    
    const drawCoverRow = (lbl, val, y) => {
      doc.setFont('Tajawal', 'normal');
      doc.setTextColor(...colors.textMuted);
      drawTextRTL(lbl, pageWidth/2 + 65, y);
      
      doc.setFont('Tajawal', 'bold');
      doc.setTextColor(...colors.text);
      // Value is drawn further left
      drawTextRTL(val, pageWidth/2 - 10, y);
    };
    
    drawCoverRow("التاريخ", today, 145);
    drawCoverRow("اليوم", dayName, 155);
    drawCoverRow("الأسبوع", String(weekNum), 165);
    drawCoverRow("النمط", pattern, 175);
    
    doc.setFillColor(...colors.text);
    doc.rect(0, pageHeight - 20, pageWidth, 20, 'F');
    doc.setFont('Tajawal', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(255, 255, 255);
    drawTextRTL(`نظام دراسة ${userName}`, pageWidth - 15, pageHeight - 8);

    // --- PAGE 2: SCHEDULE (AutoTable) ---
    doc.addPage();
    drawHeader("الجدول اليومي", dayName);
    
    doc.autoTable({
      startY: 35,
      head: [[
        shapeArabic("المخرجات"),
        shapeArabic("الملاحظات"),
        shapeArabic("الهدف"),
        shapeArabic("النشاط"),
        shapeArabic("الوقت")
      ]],
      body: blocks.map(b => [
        shapeArabic(safe(b.outputs)),
        shapeArabic(safe(b.notes)),
        shapeArabic(safe(b.goal)),
        shapeArabic(safe(b.name)),
        safe(b.timeStart) + (b.timeEnd ? ' - ' + b.timeEnd : '')
      ]),
      theme: 'grid',
      styles: {
        font: 'Tajawal',
        fontStyle: 'normal',
        fontSize: 9,
        halign: 'right',
        textColor: colors.text,
        cellPadding: 4,
        lineColor: [226, 232, 240]
      },
      headStyles: {
        fillColor: colors.primary,
        textColor: 255,
        fontStyle: 'bold',
        halign: 'center'
      },
      alternateRowStyles: {
        fillColor: colors.bg
      },
      columnStyles: {
        4: { halign: 'center', fontStyle: 'bold', textColor: colors.primary, cellWidth: 25 }
      },
      margin: { left: 15, right: 15 },
      willDrawCell: function(data) {
        if (!data.cell._isReversed && Array.isArray(data.cell.text)) {
           data.cell.text = data.cell.text.map(reverseString);
           data.cell._isReversed = true;
        }
      }
    });

    drawFooter(2, 4);

    // --- PAGE 3: GOALS & NOTES ---
    doc.addPage();
    drawHeader("الأهداف والملاحظات", dayName);
    
    let currentY = 35;
    
    const printWrappedText = (text, x, y, maxWidth, fontSize, fontStyle, color) => {
      doc.setFont('Tajawal', fontStyle);
      doc.setFontSize(fontSize);
      doc.setTextColor(...color);
      
      const shaped = shapeArabic(text);
      const lines = doc.splitTextToSize(shaped, maxWidth);
      const reversedLines = lines.map(reverseString);
      
      doc.text(reversedLines, x, y, { align: 'right' });
      return lines.length * (fontSize * 0.45);
    };

    const drawSection = (title, items, badgeColor, contentKey) => {
      doc.setFont('Tajawal', 'bold');
      doc.setFontSize(14);
      doc.setTextColor(...colors.text);
      drawTextRTL(title, pageWidth - 15, currentY);
      currentY += 10;
      
      if (items.length === 0) {
        doc.setFont('Tajawal', 'normal');
        doc.setFontSize(10);
        doc.setTextColor(...colors.textMuted);
        drawTextRTL("لا توجد عناصر مسجلة.", pageWidth - 15, currentY);
        currentY += 15;
      } else {
        items.forEach(item => {
          if (currentY > pageHeight - 40) {
            drawFooter(doc.internal.getNumberOfPages(), 4);
            doc.addPage();
            drawHeader("الأهداف والملاحظات", dayName);
            currentY = 35;
          }
          
          const contentStr = safe(item[contentKey] || '');
          const shaped = shapeArabic(contentStr);
          doc.setFontSize(10);
          const lines = doc.splitTextToSize(shaped, pageWidth - 40);
          const boxHeight = 15 + (lines.length * 5);
          
          doc.setFillColor(255, 255, 255);
          doc.setDrawColor(226, 232, 240);
          doc.roundedRect(15, currentY, pageWidth - 30, boxHeight, 2, 2, 'FD');
          
          doc.setFillColor(...badgeColor);
          doc.rect(pageWidth - 15 - 3, currentY, 3, boxHeight, 'F');
          
          doc.setFont('Tajawal', 'bold');
          doc.setFontSize(11);
          doc.setTextColor(...colors.text);
          drawTextRTL(safe(item.name), pageWidth - 25, currentY + 8);
          
          printWrappedText(contentStr, pageWidth - 25, currentY + 16, pageWidth - 40, 10, 'normal', colors.textMuted);
          
          currentY += boxHeight + 8;
        });
      }
    };
    
    drawSection("أهداف اليوم", allGoals, colors.accent, 'goal');
    currentY += 5;
    drawSection("ملاحظات اليوم", allNotes, colors.secondary, 'notes');

    drawFooter(3, 4);

    // --- PAGE 4: OUTPUTS & REFLECTION ---
    doc.addPage();
    drawHeader("المخرجات والخلاصة", dayName);
    currentY = 35;
    
    drawSection("مخرجات اليوم", allOutputs, colors.success, 'outputs');
    
    currentY += 5;
    doc.setFont('Tajawal', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(...colors.text);
    drawTextRTL("خلاصة اليوم", pageWidth - 15, currentY);
    currentY += 10;
    
    const drawEmptyBox = (lbl, placeholder) => {
      if (currentY > pageHeight - 40) {
        drawFooter(doc.internal.getNumberOfPages(), 4);
        doc.addPage();
        drawHeader("المخرجات والخلاصة", dayName);
        currentY = 35;
      }

      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(226, 232, 240);
      doc.roundedRect(15, currentY, pageWidth - 30, 25, 2, 2, 'FD');
      
      doc.setFont('Tajawal', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(...colors.text);
      drawTextRTL(lbl, pageWidth - 20, currentY + 8);
      
      doc.setFont('Tajawal', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(...colors.textMuted);
      drawTextRTL(placeholder, pageWidth - 20, currentY + 16);
      
      currentY += 30;
    };
    
    drawEmptyBox("ما الذي تعلمته اليوم؟", "اكتب هنا أبرز الدروس والمفاهيم...");
    drawEmptyBox("ما الذي يحتاج مراجعة؟", "سجل النقاط التي واجهت صعوبة فيها...");
    drawEmptyBox("ما الذي سأفعله غداً؟", "حدد الخطوات والأهداف لليوم القادم...");
    
    drawFooter(doc.internal.getNumberOfPages(), 4);

    doc.save(`تقرير-${userName}-${dayName}-أسبوع${weekNum}.pdf`);
    showToast(t('toast.pdfDone') || '✅ تم تصدير التقرير بنجاح!', 'success');

  } catch (err) {
    console.error('[PDF] Error:', err);
    showToast('حدث خطأ أثناء استخراج التقرير: ' + (err.message || err), 'error');
  } finally {
    if (loadingScreen) {
      loadingScreen.style.display = 'none';
      loadingScreen.style.zIndex = '';
    }
  }
}

async function exportWeeklyPDF() {
  showToast('تقرير الأسبوع قيد التطوير — قريباً!', 'info');
}

window.exportDailyPDF  = exportDailyPDF;
window.exportWeeklyPDF = exportWeeklyPDF;
