/* ============================================================
   CINEMATIC INTRO ENGINE — Murad Learning Planner
   ------------------------------------------------------------
   Sequence (≈4.2s total, always skippable):
     0.0s  Deep space — starfield drifts into view
     0.6s  Neural constellation forms (nodes + synapse links)
     2.2s  Particles converge toward the core → light flash
     2.8s  Brand logo + name reveal
     4.2s  Fade to app (or instantly on Skip / Esc / click)

   Guards (intro is completely bypassed when any is true):
     • prefers-reduced-motion: reduce
     • settings.introEnabled === false  (Settings toggle)
     • sessionStorage flag — plays once per browser session
   Performance: single 2D canvas, ~90 particles, rAF-driven,
   auto-caps devicePixelRatio at 2, hard-stops on completion.
   ============================================================ */
(function () {
  'use strict';

  var SESSION_KEY = 'murad_intro_played';

  function reducedMotion() {
    try {
      return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch (e) { return false; }
  }

  function introDisabledInSettings() {
    try {
      var raw = localStorage.getItem('murad_settings');
      if (!raw) return false;
      var s = JSON.parse(raw);
      return s && s.introEnabled === false;
    } catch (e) { return false; }
  }

  function alreadyPlayed() {
    try { return sessionStorage.getItem(SESSION_KEY) === '1'; } catch (e) { return false; }
  }

  function markPlayed() {
    try { sessionStorage.setItem(SESSION_KEY, '1'); } catch (e) { /* private mode */ }
  }

  window.shouldPlayIntro = function () {
    return !reducedMotion() && !introDisabledInSettings() && !alreadyPlayed();
  };

  /**
   * Plays the cinematic intro then invokes onDone exactly once.
   * If guards say "don't play", onDone is called synchronously.
   */
  window.playCinematicIntro = function (onDone) {
    var finished = false;
    function done() {
      if (finished) return;
      finished = true;
      markPlayed();
      cleanup();
      if (typeof onDone === 'function') onDone();
    }

    if (!window.shouldPlayIntro()) { done(); return; }

    /* ---------- DOM ---------- */
    var root = document.createElement('div');
    root.className = 'cinematic-intro';
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-label', 'Intro animation');

    var canvas = document.createElement('canvas');
    var flash = document.createElement('div');
    flash.className = 'intro-flash';

    var lang = (document.documentElement.getAttribute('data-lang') || 'ar');
    var skipLabel = lang === 'ar' ? 'تخطّي' : (lang === 'id' ? 'Lewati' : 'Skip');
    var tagline = lang === 'ar' ? 'نظام التعلم اليومي المتقدم'
      : (lang === 'id' ? 'Sistem Belajar Harian Tingkat Lanjut' : 'Advanced Daily Learning System');

    var brand = document.createElement('div');
    brand.className = 'intro-brand';
    brand.innerHTML =
      '<div class="intro-logo-icon"><i class="fas fa-brain" aria-hidden="true"></i></div>' +
      '<h1>Murad<span>Planner</span></h1>' +
      '<p class="intro-tagline">' + tagline + '</p>';

    var skip = document.createElement('button');
    skip.className = 'intro-skip-btn';
    skip.type = 'button';
    skip.textContent = skipLabel;
    skip.setAttribute('aria-label', skipLabel);

    root.appendChild(canvas);
    root.appendChild(flash);
    root.appendChild(brand);
    root.appendChild(skip);
    document.body.appendChild(root);

    /* ---------- Skip handlers ---------- */
    function requestSkip() { fadeOut(0); }
    skip.addEventListener('click', function (e) { e.stopPropagation(); requestSkip(); });
    root.addEventListener('click', requestSkip);
    function onKey(e) { if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') requestSkip(); }
    document.addEventListener('keydown', onKey);
    skip.focus({ preventScroll: true });

    /* ---------- Canvas scene ---------- */
    var ctx = canvas.getContext('2d');
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var W = 0, H = 0, CX = 0, CY = 0;

    function resize() {
      W = root.clientWidth; H = root.clientHeight;
      CX = W / 2; CY = H * 0.44;
      canvas.width = W * dpr; canvas.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      flash.style.left = (CX - 4) + 'px';
      flash.style.top = (CY - 4) + 'px';
    }
    resize();
    window.addEventListener('resize', resize);

    // Stars (background drift)
    var stars = [];
    for (var i = 0; i < 110; i++) {
      stars.push({
        x: Math.random(), y: Math.random(),
        r: Math.random() * 1.3 + 0.25,
        tw: Math.random() * Math.PI * 2,
        sp: 0.15 + Math.random() * 0.5,
      });
    }

    // Neural nodes (constellation around center)
    var nodes = [];
    var NODE_COUNT = 26;
    for (var n = 0; n < NODE_COUNT; n++) {
      var ang = (n / NODE_COUNT) * Math.PI * 2 + Math.random() * 0.5;
      var rad = 70 + Math.random() * Math.min(200, Math.min(W, H) * 0.28);
      nodes.push({
        ang: ang, rad: rad,
        wob: Math.random() * Math.PI * 2,
        r: 1.6 + Math.random() * 2.2,
      });
    }

    // Converging particles
    var parts = [];
    for (var p = 0; p < 90; p++) {
      var a = Math.random() * Math.PI * 2;
      var d = 200 + Math.random() * Math.max(W, H) * 0.6;
      parts.push({ a: a, d: d, d0: d, sp: 0.6 + Math.random() * 0.9, r: 0.8 + Math.random() * 1.6 });
    }

    var T_FORM = 600, T_CONVERGE = 2200, T_FLASH = 2650, T_REVEAL = 2800, T_END = 4200;
    var start = performance.now();
    var rafId = 0;
    var flashed = false, revealed = false, ending = false;

    function frame(now) {
      var t = now - start;
      ctx.clearRect(0, 0, W, H);

      // --- stars ---
      for (var i = 0; i < stars.length; i++) {
        var s = stars[i];
        var tw = 0.45 + 0.55 * Math.abs(Math.sin(s.tw + t * 0.0012 * s.sp));
        ctx.globalAlpha = tw * Math.min(1, t / 800);
        ctx.fillStyle = '#c7d2fe';
        ctx.beginPath();
        ctx.arc(s.x * W, s.y * H, s.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      // --- neural constellation (form phase) ---
      if (t > T_FORM) {
        var formK = Math.min(1, (t - T_FORM) / 900);           // grow-in
        var shrinkK = t > T_CONVERGE ? Math.max(0, 1 - (t - T_CONVERGE) / 450) : 1; // collapse
        var k = formK * shrinkK;
        if (k > 0.01) {
          var pts = [];
          for (var j = 0; j < nodes.length; j++) {
            var nd = nodes[j];
            var wob = Math.sin(nd.wob + t * 0.0016) * 7;
            var rr = nd.rad * k + wob;
            pts.push([CX + Math.cos(nd.ang) * rr, CY + Math.sin(nd.ang) * rr * 0.78, nd.r * k]);
          }
          // links
          ctx.lineWidth = 0.7;
          for (var u = 0; u < pts.length; u++) {
            for (var v = u + 1; v < pts.length; v++) {
              var dx = pts[u][0] - pts[v][0], dy = pts[u][1] - pts[v][1];
              var dist2 = dx * dx + dy * dy;
              if (dist2 < 110 * 110) {
                ctx.globalAlpha = (1 - Math.sqrt(dist2) / 110) * 0.5 * k;
                ctx.strokeStyle = '#818cf8';
                ctx.beginPath();
                ctx.moveTo(pts[u][0], pts[u][1]);
                ctx.lineTo(pts[v][0], pts[v][1]);
                ctx.stroke();
              }
            }
          }
          // nodes
          for (var w = 0; w < pts.length; w++) {
            ctx.globalAlpha = 0.9 * k;
            ctx.fillStyle = '#a5b4fc';
            ctx.beginPath();
            ctx.arc(pts[w][0], pts[w][1], pts[w][2], 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.globalAlpha = 1;
        }

        // core glow
        var glowR = 26 * k + (t > T_CONVERGE ? (t - T_CONVERGE) * 0.05 : 0);
        var grad = ctx.createRadialGradient(CX, CY, 0, CX, CY, Math.max(glowR, 1) * 3);
        grad.addColorStop(0, 'rgba(165,180,252,' + (0.75 * formK) + ')');
        grad.addColorStop(0.4, 'rgba(99,102,241,' + (0.35 * formK) + ')');
        grad.addColorStop(1, 'rgba(99,102,241,0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(CX, CY, Math.max(glowR, 1) * 3, 0, Math.PI * 2);
        ctx.fill();
      }

      // --- converging particles ---
      if (t > T_FORM + 300 && t < T_FLASH + 200) {
        var convK = Math.min(1, (t - T_FORM - 300) / (T_CONVERGE - T_FORM));
        for (var q = 0; q < parts.length; q++) {
          var pt = parts[q];
          var dd = pt.d0 * (1 - convK * pt.sp);
          if (dd < 6) continue;
          var px = CX + Math.cos(pt.a + t * 0.0002) * dd;
          var py = CY + Math.sin(pt.a + t * 0.0002) * dd * 0.8;
          ctx.globalAlpha = 0.35 + 0.45 * convK;
          ctx.fillStyle = q % 3 === 0 ? '#22d3ee' : '#818cf8';
          ctx.beginPath();
          ctx.arc(px, py, pt.r, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
      }

      // --- phase triggers ---
      if (!flashed && t >= T_FLASH) { flashed = true; root.classList.add('intro-flashing'); }
      if (!revealed && t >= T_REVEAL) { revealed = true; root.classList.add('intro-reveal'); }
      if (!ending && t >= T_END) { ending = true; fadeOut(700); return; }

      rafId = requestAnimationFrame(frame);
    }
    rafId = requestAnimationFrame(frame);

    /* ---------- Teardown ---------- */
    function fadeOut(dur) {
      if (finished) return;
      cancelAnimationFrame(rafId);
      root.classList.add('intro-fade-out');
      setTimeout(done, dur ? 700 : 60);
    }

    function cleanup() {
      cancelAnimationFrame(rafId);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', resize);
      if (root.parentNode) root.parentNode.removeChild(root);
    }
  };
})();
