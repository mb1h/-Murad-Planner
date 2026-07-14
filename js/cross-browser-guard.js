/* ============================================================
   MURAD LEARNING PLANNER — Cross-Browser Guard Layer
   Loads FIRST. Guarantees the app never crashes regardless of:
   - Empty localStorage (new browser / incognito)
   - localStorage disabled (Safari private mode)
   - API failures
   - Missing DOM elements
   - Race conditions
   - Uncaught exceptions
   ============================================================ */

(function () {
  'use strict';

  /* ── 1. localStorage Safety ──────────────────────────────────
     Safari private mode throws SecurityError on localStorage access.
     Replace with in-memory fallback so DB.get/set never throw.
     ─────────────────────────────────────────────────────────── */
  var _memStore = {};
  var _localStorageAvailable = (function () {
    try {
      var k = '__murad_test__';
      localStorage.setItem(k, '1');
      localStorage.removeItem(k);
      return true;
    } catch (e) {
      return false;
    }
  })();

  if (!_localStorageAvailable) {
    // Shim localStorage with in-memory store
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: {
        _data: {},
        setItem: function (k, v) { this._data[k] = String(v); },
        getItem: function (k) { return Object.prototype.hasOwnProperty.call(this._data, k) ? this._data[k] : null; },
        removeItem: function (k) { delete this._data[k]; },
        clear: function () { this._data = {}; },
        key: function (i) { return Object.keys(this._data)[i] || null; },
        get length() { return Object.keys(this._data).length; }
      }
    });
    console.warn('[Guard] localStorage unavailable — using in-memory fallback');
  }

  /* ── 2. sessionStorage Safety ────────────────────────────────*/
  var _sessionStorageAvailable = (function () {
    try {
      var k = '__murad_ss_test__';
      sessionStorage.setItem(k, '1');
      sessionStorage.removeItem(k);
      return true;
    } catch (e) {
      return false;
    }
  })();

  if (!_sessionStorageAvailable) {
    Object.defineProperty(window, 'sessionStorage', {
      configurable: true,
      value: {
        _data: {},
        setItem: function (k, v) { this._data[k] = String(v); },
        getItem: function (k) { return Object.prototype.hasOwnProperty.call(this._data, k) ? this._data[k] : null; },
        removeItem: function (k) { delete this._data[k]; },
        clear: function () { this._data = {}; },
        get length() { return Object.keys(this._data).length; }
      }
    });
    console.warn('[Guard] sessionStorage unavailable — using in-memory fallback');
  }

  /* ── 3. Global Error Boundary ────────────────────────────────
     Catches ANY uncaught error. Prevents blank screen of death.
     Shows a user-friendly recovery UI.
     ─────────────────────────────────────────────────────────── */
  window.addEventListener('error', function (event) {
    // Ignore external script errors (CORS cross-origin)
    if (!event.filename || event.filename.includes('fonts.googleapis') ||
        event.filename.includes('fontawesome') || event.filename.includes('cdn.')) {
      return;
    }

    console.error('[Guard] Uncaught error:', event.message, 'at', event.filename, event.lineno);

    // Don't show UI for trivial errors
    var trivial = ['ResizeObserver', 'Script error', 'Non-Error promise'];
    var isTrivial = trivial.some(function (t) { return (event.message || '').includes(t); });
    if (isTrivial) return;

    // Ensure the app shell is at least visible
    _ensureAppShellVisible();
  });

  window.addEventListener('unhandledrejection', function (event) {
    console.error('[Guard] Unhandled promise rejection:', event.reason);
    // Don't crash — just log
  });

  /* ── 4. DOM Safety Utilities ─────────────────────────────────
     These are defensive wrappers used throughout the guard.
     ─────────────────────────────────────────────────────────── */
  function _safe(fn, fallback) {
    try { return fn(); }
    catch (e) { return typeof fallback !== 'undefined' ? fallback : null; }
  }

  function _el(id) {
    return document.getElementById(id);
  }

  /* ── 5. Ensure App Shell is Visible ──────────────────────────
     If something goes wrong during initialization, this function
     ensures the loading screen is dismissed and at least the
     dashboard is rendered.
     ─────────────────────────────────────────────────────────── */
  function _ensureAppShellVisible() {
    _safe(function () {
      // Hide loading screen
      var ls = _el('loading-screen');
      if (ls && ls.style.display !== 'none') {
        ls.style.opacity = '0';
        ls.style.pointerEvents = 'none';
        setTimeout(function () { ls.style.display = 'none'; }, 300);
      }

      // Ensure at least one page is active
      var pages = document.querySelectorAll('.page');
      var hasActive = false;
      pages.forEach(function (p) {
        if (p.classList.contains('active')) hasActive = true;
      });

      if (!hasActive && pages.length > 0) {
        // Activate dashboard as safe fallback
        var dashboard = _el('page-dashboard');
        if (dashboard) {
          dashboard.classList.add('active');
          console.warn('[Guard] No active page found — activated dashboard as fallback');
        } else {
          // Last resort: show first page
          pages[0].classList.add('active');
        }
      }

      // Ensure main content is visible
      var main = _el('mainContent');
      if (main) {
        main.style.visibility = 'visible';
        main.style.opacity = '1';
      }
    });
  }

  /* ── 6. Loading Screen Safety Timeout ────────────────────────
     If the app takes more than 8 seconds to init, force-dismiss
     the loading screen. Prevents stuck loading on slow networks.
     ─────────────────────────────────────────────────────────── */
  setTimeout(function () {
    _safe(_ensureAppShellVisible);
  }, 8000);

  /* ── 7. Viewport Height Fix for iOS Safari ──────────────────
     100vh in iOS includes the browser chrome (address bar + tab bar).
     This sets --vh CSS variable to the actual visible height.
     ─────────────────────────────────────────────────────────── */
  function _updateVH() {
    _safe(function () {
      var vh = window.innerHeight * 0.01;
      document.documentElement.style.setProperty('--vh', vh + 'px');
      // Also update full height variable
      document.documentElement.style.setProperty('--app-height', window.innerHeight + 'px');
    });
  }

  _updateVH();

  // Update on resize (Chrome mobile) and orientation change (iOS)
  window.addEventListener('resize', _debounce(_updateVH, 100));
  window.addEventListener('orientationchange', function () {
    // iOS fires orientationchange before the viewport updates
    setTimeout(_updateVH, 200);
    setTimeout(_updateVH, 500);
  });

  /* ── 8. Debounce Utility ─────────────────────────────────────*/
  function _debounce(fn, delay) {
    var timer;
    return function () {
      clearTimeout(timer);
      timer = setTimeout(fn, delay);
    };
  }

  /* ── 9. Missing Function Guards ──────────────────────────────
     Create no-op stubs for functions that may not be loaded yet.
     This prevents "X is not a function" errors in onclick handlers.
     ─────────────────────────────────────────────────────────── */
  var _stubs = [
    'showPage', 'showAIPage', 'showDayPattern', 'toggleSidebar',
    'toggleMobileSidebar', 'toggleTheme', 'toggleLanguage',
    'renderDashboard', 'renderWeeklyTable', 'renderSoundLibrary',
    'renderCustomSoundsList', 'renderPerBlockSoundSettings',
    'loadSettingsUI', 'saveSettings', 'exportWeeklyPDF',
    'openDayBoard', 'goBackToWeekly', 'showToast',
    'renderAIWorkspacePage', 'renderAISettingsPage',
    'renderAIPersonalityPage', 'renderAIAutomationPage',
    'renderAIAnalyticsPage', 'updateFloatingAIContext',
    'switchGuideTab', 'toggleUserGuide',
    'openAddProviderModal', 'closeProviderModal', 'saveProvider'
  ];

  _stubs.forEach(function (name) {
    if (typeof window[name] === 'undefined') {
      window[name] = function () {
        // Will be overwritten by the real implementation when loaded
        // Silently no-op until the real function loads
      };
    }
  });

  /* ── 10. DOMContentLoaded Race Condition Guard ───────────────
     Some scripts fire DOMContentLoaded listeners before others load.
     Provide a queue that can be flushed when DOM is ready.
     ─────────────────────────────────────────────────────────── */
  window._domReadyQueue = window._domReadyQueue || [];
  window._domReady = false;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      window._domReady = true;
      window._domReadyQueue.forEach(function (fn) { _safe(fn); });
      window._domReadyQueue = [];
    });
  } else {
    window._domReady = true;
  }

  window._onDomReady = function (fn) {
    if (window._domReady) {
      _safe(fn);
    } else {
      window._domReadyQueue.push(fn);
    }
  };

  /* ── 11. Network Failure Detection ───────────────────────────
     If we go offline, show a non-intrusive banner.
     When back online, hide it.
     ─────────────────────────────────────────────────────────── */
  function _createOfflineBanner() {
    if (_el('_offline-banner')) return;
    var banner = document.createElement('div');
    banner.id = '_offline-banner';
    banner.setAttribute('role', 'alert');
    banner.setAttribute('aria-live', 'polite');
    banner.style.cssText = [
      'position:fixed', 'top:0', 'left:0', 'right:0',
      'background:#ef4444', 'color:#fff',
      'text-align:center', 'padding:8px 16px',
      'font-family:inherit', 'font-size:14px',
      'z-index:99999', 'display:none',
      'transition:opacity 0.3s'
    ].join(';');
    banner.textContent = 'لا يوجد اتصال بالإنترنت — بعض الميزات قد لا تعمل';
    document.body ? document.body.appendChild(banner) :
      document.addEventListener('DOMContentLoaded', function () {
        document.body.appendChild(banner);
      });
    return banner;
  }

  window.addEventListener('offline', function () {
    _safe(function () {
      var b = _el('_offline-banner') || _createOfflineBanner();
      if (b) b.style.display = 'block';
    });
  });

  window.addEventListener('online', function () {
    _safe(function () {
      var b = _el('_offline-banner');
      if (b) b.style.display = 'none';
    });
  });

  /* ── 12. ResizeObserver Polyfill ────────────────────────────
     ResizeObserver is not available in old Safari / old Chrome.
     ─────────────────────────────────────────────────────────── */
  if (!window.ResizeObserver) {
    window.ResizeObserver = function (callback) {
      this._callback = callback;
      this._elements = [];
      this._timer = null;
    };
    window.ResizeObserver.prototype.observe = function (el) {
      this._elements.push(el);
      var self = this;
      if (!this._timer) {
        this._timer = setInterval(function () {
          self._elements.forEach(function (e) {
            self._callback([{ target: e }]);
          });
        }, 200);
      }
    };
    window.ResizeObserver.prototype.unobserve = function (el) {
      this._elements = this._elements.filter(function (e) { return e !== el; });
    };
    window.ResizeObserver.prototype.disconnect = function () {
      clearInterval(this._timer);
      this._timer = null;
      this._elements = [];
    };
  }

  /* ── 13. IntersectionObserver Safety ────────────────────────*/
  if (!window.IntersectionObserver) {
    window.IntersectionObserver = function (callback) {
      this._callback = callback;
    };
    window.IntersectionObserver.prototype.observe = function (el) {
      // Immediately call callback with isIntersecting: true
      this._callback([{ target: el, isIntersecting: true, intersectionRatio: 1 }]);
    };
    window.IntersectionObserver.prototype.unobserve = function () {};
    window.IntersectionObserver.prototype.disconnect = function () {};
  }

  /* ── 14. fetch() Safety Wrapper ─────────────────────────────
     The app uses fetch() for AI API calls.
     Add a timeout wrapper to prevent infinite hangs.
     ─────────────────────────────────────────────────────────── */
  var _originalFetch = window.fetch;
  if (_originalFetch) {
    window.fetch = function (url, options) {
      var timeout = (options && options._timeout) || 60000; // 60s default
      var controller = typeof AbortController !== 'undefined' ? new AbortController() : null;

      var timer = setTimeout(function () {
        if (controller) controller.abort();
      }, timeout);

      var fetchOptions = options || {};
      if (controller && !fetchOptions.signal) {
        fetchOptions = Object.assign({}, fetchOptions, { signal: controller.signal });
      }

      return _originalFetch.call(window, url, fetchOptions)
        .then(function (response) {
          clearTimeout(timer);
          return response;
        })
        .catch(function (err) {
          clearTimeout(timer);
          throw err;
        });
    };
  }

  /* ── 15. CSS Custom Properties Polyfill Check ───────────────
     Very old browsers don't support CSS custom properties.
     Check and warn — we can't polyfill easily but we can degrade.
     ─────────────────────────────────────────────────────────── */
  var _cssVarsSupported = (function () {
    return window.CSS && window.CSS.supports && window.CSS.supports('color', 'var(--test)');
  })();

  if (!_cssVarsSupported) {
    // Apply fallback inline styles for critical elements
    document.documentElement.style.background = '#070b14';
    document.documentElement.style.color = '#f1f5f9';
    console.warn('[Guard] CSS custom properties not supported — applying fallbacks');
  }

  /* ── 16. Touch Device Detection ─────────────────────────────*/
  window._isTouch = (function () {
    return 'ontouchstart' in window ||
      navigator.maxTouchPoints > 0 ||
      (navigator.msMaxTouchPoints && navigator.msMaxTouchPoints > 0);
  })();

  if (window._isTouch) {
    document.documentElement.classList.add('touch-device');
  } else {
    document.documentElement.classList.add('no-touch');
  }

  /* ── 17. Browser Detection (for CSS class hooks) ─────────────
     We add classes to <html> so CSS can target specific browsers
     without JS in CSS files.
     ─────────────────────────────────────────────────────────── */
  var ua = navigator.userAgent;
  var isFirefox = ua.includes('Firefox');
  var isSafari = ua.includes('Safari') && !ua.includes('Chrome') && !ua.includes('Chromium');
  var isIOS = /iPad|iPhone|iPod/.test(ua) || (isSafari && 'ontouchstart' in window);
  var isAndroid = ua.includes('Android');
  var isEdge = ua.includes('Edg/');

  if (isFirefox) document.documentElement.classList.add('browser-firefox');
  if (isSafari) document.documentElement.classList.add('browser-safari');
  if (isIOS) document.documentElement.classList.add('browser-ios');
  if (isAndroid) document.documentElement.classList.add('browser-android');
  if (isEdge) document.documentElement.classList.add('browser-edge');

  /* ── 18. iOS Specific: Disable double-tap zoom ───────────────
     iOS Safari zooms on double-tap. Adding touch-action: manipulation
     via JS to critical interactive elements.
     ─────────────────────────────────────────────────────────── */
  if (isIOS) {
    document.addEventListener('DOMContentLoaded', function () {
      var els = document.querySelectorAll('button, a, [role="button"], .nav-item');
      for (var i = 0; i < els.length; i++) {
        els[i].style.touchAction = 'manipulation';
      }
    });
  }

  /* ── 19. Prevent iOS Body Scroll Bounce ─────────────────────
     iOS overscrolls the body. We've used position:fixed on body
     in CSS. This JS handler ensures scroll containers work correctly.
     ─────────────────────────────────────────────────────────── */
  if (isIOS) {
    document.addEventListener('touchmove', function (e) {
      // Allow scroll only in elements with overflow-y:auto/scroll
      var el = e.target;
      var scrollable = false;
      while (el && el !== document.body) {
        var style = window.getComputedStyle(el);
        var overflow = style.overflowY;
        if ((overflow === 'auto' || overflow === 'scroll') && el.scrollHeight > el.clientHeight) {
          scrollable = true;
          break;
        }
        el = el.parentElement;
      }
      if (!scrollable) {
        e.preventDefault();
      }
    }, { passive: false });
  }

  /* ── 20. Page Visibility API — Pause heavy tasks ─────────────
     When the page is hidden (user switches tab), we can pause
     animations and polling to save battery.
     ─────────────────────────────────────────────────────────── */
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) {
      document.documentElement.classList.add('page-hidden');
    } else {
      document.documentElement.classList.remove('page-hidden');
    }
  });

  /* ── 21. Expose Guard API ─────────────────────────────────── */
  window._Guard = {
    localStorageAvailable: _localStorageAvailable,
    sessionStorageAvailable: _sessionStorageAvailable,
    cssVarsSupported: _cssVarsSupported,
    isTouch: window._isTouch,
    isIOS: isIOS,
    isAndroid: isAndroid,
    isSafari: isSafari,
    isFirefox: isFirefox,
    isEdge: isEdge,
    ensureAppVisible: _ensureAppShellVisible,
    updateVH: _updateVH
  };

  /* ── 22. Confirm Guard Loaded ────────────────────────────────*/
  /* Use a minimal log — no spam in production */
  var _flags = [];
  if (!_localStorageAvailable) _flags.push('no-ls');
  if (isIOS) _flags.push('ios');
  if (isAndroid) _flags.push('android');
  if (isFirefox) _flags.push('ff');

  // Only log if there are special conditions
  if (_flags.length > 0) {
    console.log('[Guard] Cross-browser guard active — flags:', _flags.join(', '));
  }

})();
