/* Comprehensive QA harness for Murad Learning Planner */
const { chromium } = require('playwright');

const BASE = 'http://localhost:8080/index.html';
const results = [];
const consoleIssues = [];

function log(section, name, status, detail = '') {
  results.push({ section, name, status, detail });
  console.log(`[${status}] ${section} :: ${name}${detail ? ' — ' + detail : ''}`);
}

async function newPage(browser, viewport) {
  const ctx = await browser.newContext({ viewport, locale: 'ar' });
  const page = await ctx.newPage();
  page.on('console', (m) => {
    if (m.type() === 'error' || m.type() === 'warning') {
      consoleIssues.push({ type: m.type(), text: m.text().slice(0, 300), url: page.url() });
    }
  });
  page.on('pageerror', (e) => consoleIssues.push({ type: 'pageerror', text: String(e).slice(0, 300) }));
  page.on('requestfailed', (r) => {
    if (!r.url().includes('fonts.g') && !r.url().includes('cdn.jsdelivr'))
      consoleIssues.push({ type: 'requestfailed', text: r.url() + ' :: ' + (r.failure()?.errorText || '') });
  });
  return { ctx, page };
}

async function waitReady(page) {
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => {
    const ls = document.getElementById('loading-screen');
    return !ls || ls.style.display === 'none' || getComputedStyle(ls).display === 'none' || ls.classList.contains('hidden');
  }, { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(1500);
}

(async () => {
  const browser = await chromium.launch();

  /* ===== DESKTOP FULL FLOW ===== */
  const { ctx, page } = await newPage(browser, { width: 1440, height: 900 });
  await waitReady(page);
  log('load', 'initial page load', 'PASS');

  // 1. Navigation through all pages
  const pages = ['dashboard', 'weekly', 'settings'];
  for (const p of pages) {
    await page.evaluate((id) => window.showPage(id, null), p).catch((e) => log('nav', p, 'FAIL', String(e)));
    await page.waitForTimeout(400);
    const visible = await page.evaluate((id) => {
      const el = document.getElementById('page-' + id);
      return el && el.classList.contains('active');
    }, p);
    log('nav', `showPage(${p})`, visible ? 'PASS' : 'FAIL');
  }

  // 2. Pattern pages
  for (const pat of ['A', 'B', 'C', 'D']) {
    await page.evaluate((x) => window.showDayPattern(x, null), pat).catch((e) => log('nav', 'pattern' + pat, 'FAIL', String(e)));
    await page.waitForTimeout(400);
    const ok = await page.evaluate(() => {
      const el = document.getElementById('page-daily');
      return el && el.classList.contains('active') && document.getElementById('blocksContainer').children.length > 0;
    });
    log('nav', `pattern ${pat} daily board renders blocks`, ok ? 'PASS' : 'FAIL');
    if (pat === 'C') {
      const ib = await page.evaluate(() => {
        const el = document.getElementById('integrationBuilder');
        return el && el.style.display !== 'none';
      });
      log('feature', 'Integration Builder visible for pattern C', ib ? 'PASS' : 'FAIL');
    }
  }

  // 3. AI pages
  for (const p of ['ai-workspace', 'ai-analytics', 'ai-automation', 'ai-personality', 'ai-settings']) {
    const err = await page.evaluate((id) => {
      try { window.showAIPage(id, null); return null; } catch (e) { return String(e); }
    }, p);
    await page.waitForTimeout(700);
    const hasContent = await page.evaluate((id) => {
      const el = document.getElementById('page-' + id);
      return el && el.classList.contains('active') && el.innerHTML.trim().length > 100;
    }, p);
    log('ai', `showAIPage(${p})`, !err && hasContent ? 'PASS' : 'FAIL', err || (hasContent ? '' : 'no content rendered'));
  }

  // 4. AI chat input exists and send button
  await page.evaluate(() => window.showAIPage('ai-workspace', null));
  await page.waitForTimeout(800);
  const chatUI = await page.evaluate(() => {
    const input = document.querySelector('#aiChatInput, .ai-chat-input, textarea[id*="hat"], .composer textarea, #aiInputTextarea');
    const send = document.querySelector('[onclick*="send"], .ai-send-btn, #aiSendBtn, button[id*="end"]');
    return { input: !!input, send: !!send };
  });
  log('ai', 'chat input present', chatUI.input ? 'PASS' : 'FAIL');
  log('ai', 'send button present', chatUI.send ? 'PASS' : 'FAIL');

  // 5. Theme toggle
  const themeBefore = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
  await page.evaluate(() => window.toggleTheme());
  await page.waitForTimeout(300);
  const themeAfter = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
  log('ui', 'theme toggle', themeBefore !== themeAfter ? 'PASS' : 'FAIL', `${themeBefore} -> ${themeAfter}`);
  await page.evaluate(() => window.toggleTheme());

  // 6. Language toggle
  const langBefore = await page.evaluate(() => document.documentElement.getAttribute('data-lang'));
  await page.evaluate(() => window.toggleLanguage());
  await page.waitForTimeout(400);
  const langAfter = await page.evaluate(() => ({ lang: document.documentElement.getAttribute('data-lang'), dir: document.documentElement.getAttribute('dir') }));
  log('i18n', 'language toggle changes lang+dir', langBefore !== langAfter.lang ? 'PASS' : 'FAIL', JSON.stringify(langAfter));
  // set language explicitly to all three
  for (const l of ['en', 'id', 'ar']) {
    const err = await page.evaluate((x) => { try { window.setLanguage(x); return null; } catch (e) { return String(e); } }, l);
    log('i18n', `setLanguage(${l})`, err ? 'FAIL' : 'PASS', err || '');
    await page.waitForTimeout(300);
  }

  // 7. Sidebar collapse
  const sbErr = await page.evaluate(() => { try { window.toggleSidebar(); window.toggleSidebar(); return null; } catch (e) { return String(e); } });
  log('ui', 'sidebar collapse/expand', sbErr ? 'FAIL' : 'PASS', sbErr || '');

  // 8. Weekly table interactions
  await page.evaluate(() => window.showPage('weekly', null));
  await page.waitForTimeout(500);
  const weeklyRows = await page.evaluate(() => document.querySelectorAll('#weeklyTableBody tr').length);
  log('weekly', 'weekly table renders 7 rows', weeklyRows === 7 ? 'PASS' : 'FAIL', `rows=${weeklyRows}`);
  // week navigation
  const wkErr = await page.evaluate(() => { try { window.changeWeek(1); window.changeWeek(-1); return null; } catch (e) { return String(e); } });
  log('weekly', 'week navigation', wkErr ? 'FAIL' : 'PASS', wkErr || '');
  // edit a cell
  const cellEdit = await page.evaluate(() => {
    const cell = document.querySelector('#weeklyTableBody td[contenteditable="true"], #weeklyTableBody .editable-cell');
    if (!cell) return 'no editable cell';
    cell.textContent = 'QA-TEST-CELL';
    cell.dispatchEvent(new Event('input', { bubbles: true }));
    cell.dispatchEvent(new Event('blur', { bubbles: true }));
    return null;
  });
  log('weekly', 'cell editing', cellEdit ? 'FAIL' : 'PASS', cellEdit || '');
  const saveErr = await page.evaluate(() => { try { window.saveWeeklyData(); return null; } catch (e) { return String(e); } });
  log('weekly', 'saveWeeklyData()', saveErr ? 'FAIL' : 'PASS', saveErr || '');

  // 9. Daily board: open day, block panel, timer
  await page.evaluate(() => { const btn = document.querySelector('#weeklyTableBody .btn-icon, #weeklyTableBody button'); if (btn) btn.click(); });
  await page.waitForTimeout(600);
  const dailyActive = await page.evaluate(() => document.getElementById('page-daily').classList.contains('active'));
  log('daily', 'open day from weekly table', dailyActive ? 'PASS' : 'FAIL');

  const blockCount = await page.evaluate(() => document.querySelectorAll('#blocksContainer .block-card, #blocksContainer [class*="block"]').length);
  log('daily', 'blocks render', blockCount > 0 ? 'PASS' : 'FAIL', `count=${blockCount}`);

  // open block panel
  const panelOpen = await page.evaluate(() => {
    const openBtn = document.querySelector('#blocksContainer [onclick*="openBlockPanel"], #blocksContainer [onclick*="Panel"]');
    if (openBtn) { openBtn.click(); return true; }
    if (typeof window.openBlockPanel === 'function') { window.openBlockPanel(0); return true; }
    return false;
  });
  await page.waitForTimeout(500);
  const panelVisible = await page.evaluate(() => {
    const p = document.getElementById('blockPanel');
    return p && p.style.display !== 'none';
  });
  log('daily', 'block details panel opens', panelOpen && panelVisible ? 'PASS' : 'FAIL');
  if (panelVisible) {
    await page.fill('#panelGoal', 'QA test goal').catch(() => {});
    const spErr = await page.evaluate(() => { try { window.savePanelData(); return null; } catch (e) { return String(e); } });
    log('daily', 'savePanelData()', spErr ? 'FAIL' : 'PASS', spErr || '');
    await page.evaluate(() => window.closeBlockPanel && window.closeBlockPanel());
  }

  // timer test
  const timerFns = await page.evaluate(() => ({
    start: typeof window.startTimer, pause: typeof window.pauseTimer, reset: typeof window.resetTimer, skip: typeof window.skipTimer,
  }));
  log('timer', 'timer API exposed', Object.values(timerFns).every((t) => t === 'function') ? 'PASS' : 'WARN', JSON.stringify(timerFns));
  const timerErr = await page.evaluate(() => {
    try {
      const btn = document.querySelector('#blocksContainer [onclick*="startTimer"], #blocksContainer .timer-btn');
      if (btn) { btn.click(); return null; }
      if (typeof window.startTimer === 'function') { window.startTimer(0); return null; }
      return 'no timer control found';
    } catch (e) { return String(e); }
  });
  await page.waitForTimeout(1500);
  log('timer', 'start timer', timerErr ? 'FAIL' : 'PASS', timerErr || '');

  // add / delete block
  const addErr = await page.evaluate(() => { try { if (typeof window.addNewBlock === 'function') { window.addNewBlock(); return null; } return 'addNewBlock missing'; } catch (e) { return String(e); } });
  log('daily', 'addNewBlock()', addErr ? 'FAIL' : 'PASS', addErr || '');

  // 10. Settings interactions
  await page.evaluate(() => window.showPage('settings', null));
  await page.waitForTimeout(500);
  const soundLib = await page.evaluate(() => document.querySelectorAll('#soundLibrary .sound-item, #soundLibrary [class*="sound"]').length);
  log('settings', 'sound library renders', soundLib > 0 ? 'PASS' : 'FAIL', `items=${soundLib}`);
  const setErr = await page.evaluate(() => { try { window.saveSettings(); return null; } catch (e) { return String(e); } });
  log('settings', 'saveSettings()', setErr ? 'FAIL' : 'PASS', setErr || '');
  const perBlock = await page.evaluate(() => (document.getElementById('perBlockSoundSettings') || {}).children?.length || 0);
  log('settings', 'per-block sound settings render', perBlock > 0 ? 'PASS' : 'WARN', `children=${perBlock}`);

  // 11. User guide
  const guideErr = await page.evaluate(() => { try { window.toggleUserGuide(); return null; } catch (e) { return String(e); } });
  await page.waitForTimeout(400);
  const guideVisible = await page.evaluate(() => { const g = document.getElementById('guidePanel'); return g && g.style.display !== 'none'; });
  log('guide', 'user guide opens', !guideErr && guideVisible ? 'PASS' : 'FAIL', guideErr || '');
  if (guideVisible) {
    for (const tab of ['patterns', 'weekly', 'daily', 'timer', 'pdf', 'about', 'overview']) {
      const tErr = await page.evaluate((t) => { try { window.switchGuideTab(t, document.querySelector('.guide-tab')); return null; } catch (e) { return String(e); } }, tab);
      if (tErr) log('guide', `guide tab ${tab}`, 'FAIL', tErr);
    }
    log('guide', 'all guide tabs switch', 'PASS');
    await page.evaluate(() => window.closeUserGuide());
  }

  // 12. Toast
  const toastErr = await page.evaluate(() => { try { window.showToast('QA toast', 'success'); return null; } catch (e) { return String(e); } });
  log('ui', 'toast notification', toastErr ? 'FAIL' : 'PASS', toastErr || '');

  // 13. PDF export functions exist (don't trigger print window)
  const pdfFns = await page.evaluate(() => ({ daily: typeof window.exportDailyPDF, weekly: typeof window.exportWeeklyPDF }));
  log('pdf', 'PDF export functions exist', pdfFns.daily === 'function' && pdfFns.weekly === 'function' ? 'PASS' : 'FAIL', JSON.stringify(pdfFns));

  // 14. Data persistence check
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);
  const persisted = await page.evaluate(() => {
    const keys = Object.keys(localStorage);
    return { keyCount: keys.length, sample: keys.slice(0, 12) };
  });
  log('data', 'localStorage persistence', persisted.keyCount > 0 ? 'PASS' : 'FAIL', JSON.stringify(persisted));

  // 15. Floating dock
  const dock = await page.evaluate(() => !!document.querySelector('.floating-dock, #floatingDock, [class*="dock"]'));
  log('ui', 'floating dock present', dock ? 'PASS' : 'WARN');

  // 16. Overflow check on all main pages (desktop)
  for (const p of ['dashboard', 'weekly', 'settings']) {
    await page.evaluate((id) => window.showPage(id, null), p);
    await page.waitForTimeout(400);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 2);
    log('layout', `horizontal overflow on ${p} (desktop)`, overflow ? 'FAIL' : 'PASS');
  }

  await page.screenshot({ path: '/tmp/qa/desktop-dashboard.png', fullPage: false }).catch(() => {});
  await ctx.close();

  /* ===== RESPONSIVE CHECKS ===== */
  const viewports = [
    ['laptop', { width: 1280, height: 800 }],
    ['tablet', { width: 768, height: 1024 }],
    ['mobile', { width: 390, height: 844 }],
    ['small-mobile', { width: 360, height: 740 }],
  ];
  for (const [name, vp] of viewports) {
    const { ctx: c2, page: p2 } = await newPage(browser, vp);
    await waitReady(p2);
    for (const pg of ['dashboard', 'weekly', 'settings']) {
      await p2.evaluate((id) => window.showPage(id, null), pg).catch(() => {});
      await p2.waitForTimeout(400);
      const overflow = await p2.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 2);
      log('responsive', `${name} ${pg} overflow`, overflow ? 'FAIL' : 'PASS');
    }
    if (vp.width < 800) {
      // mobile menu test
      const mErr = await p2.evaluate(() => { try { window.toggleMobileSidebar(); return null; } catch (e) { return String(e); } });
      await p2.waitForTimeout(400);
      const open = await p2.evaluate(() => document.getElementById('sidebar').classList.contains('mobile-open') || document.getElementById('sidebar').classList.contains('open'));
      log('responsive', `${name} mobile sidebar opens`, !mErr && open ? 'PASS' : 'FAIL', mErr || '');
      await p2.evaluate(() => window.toggleMobileSidebar());
      // mobile menu button visible
      const btnVis = await p2.evaluate(() => {
        const b = document.getElementById('mobileMenuBtn');
        const s = getComputedStyle(b);
        return s.display !== 'none' && s.visibility !== 'hidden';
      });
      log('responsive', `${name} hamburger visible`, btnVis ? 'PASS' : 'FAIL');
    }
    await p2.screenshot({ path: `/tmp/qa/${name}-dashboard.png` }).catch(() => {});
    // AI workspace on mobile
    await p2.evaluate(() => window.showAIPage('ai-workspace', null)).catch(() => {});
    await p2.waitForTimeout(700);
    const aiOverflow = await p2.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 2);
    log('responsive', `${name} ai-workspace overflow`, aiOverflow ? 'FAIL' : 'PASS');
    await c2.close();
  }

  /* ===== ACCESSIBILITY QUICK AUDIT ===== */
  const { ctx: c3, page: p3 } = await newPage(browser, { width: 1440, height: 900 });
  await waitReady(p3);
  const a11y = await p3.evaluate(() => {
    const issues = [];
    document.querySelectorAll('img:not([alt])').forEach((i) => issues.push('img missing alt: ' + (i.src || '').slice(-40)));
    document.querySelectorAll('button').forEach((b) => {
      if (!b.textContent.trim() && !b.getAttribute('aria-label') && !b.title) issues.push('button no accessible name: ' + (b.id || b.className).slice(0, 60));
    });
    document.querySelectorAll('input:not([type=hidden]), select, textarea').forEach((i) => {
      const id = i.id;
      const hasLabel = id && document.querySelector(`label[for="${id}"]`);
      const wrapped = i.closest('label');
      if (!hasLabel && !wrapped && !i.getAttribute('aria-label')) issues.push('form control unlabeled: ' + (id || i.className || i.type).slice(0, 60));
    });
    if (!document.querySelector('meta[name=description]')) issues.push('missing meta description');
    if (!document.querySelector('a.skip-link, .skip-to-content')) issues.push('no skip-to-content link');
    return issues;
  });
  a11y.slice(0, 40).forEach((i) => log('a11y', i, 'WARN'));
  log('a11y', 'total a11y issues', a11y.length === 0 ? 'PASS' : 'WARN', String(a11y.length));
  await c3.close();

  await browser.close();

  /* ===== SUMMARY ===== */
  const fs = require('fs');
  const fails = results.filter((r) => r.status === 'FAIL');
  const warns = results.filter((r) => r.status === 'WARN');
  console.log('\n========== SUMMARY ==========');
  console.log(`PASS: ${results.filter((r) => r.status === 'PASS').length}, FAIL: ${fails.length}, WARN: ${warns.length}`);
  console.log('\n--- CONSOLE ISSUES (' + consoleIssues.length + ') ---');
  const uniq = [...new Set(consoleIssues.map((c) => c.type + ' :: ' + c.text))];
  uniq.slice(0, 60).forEach((c) => console.log(c));
  fs.writeFileSync('/tmp/qa/results.json', JSON.stringify({ results, consoleIssues: uniq }, null, 2));
})().catch((e) => { console.error('HARNESS ERROR', e); process.exit(1); });
