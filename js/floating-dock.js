/* ============================================================
   FLOATING AI DOCK — v6.0 — Full AI Agent Chat
   - ChatGPT/Claude level UI
   - Shared AIAgentCore engine (same as Workspace)
   - Persistent conversation history per session
   - + menu: images, files, PDF, Excel, Word, camera, mic
   - Drag & Drop file support
   - Markdown, tables, code, images in messages
   - Hover tracking + proactive suggestions
   - Real SpeechRecognition (live)
   ============================================================ */

(function () {
  'use strict';

  // ── Conversation History (persisted in localStorage) ─────────
  const HISTORY_KEY = 'murad_dock_history';
  const MAX_HISTORY = 50;

  const DockHistory = {
    get() {
      try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]'); } catch { return []; }
    },
    push(role, content) {
      const h = this.get();
      h.push({ role, content, ts: Date.now() });
      if (h.length > MAX_HISTORY) h.splice(0, h.length - MAX_HISTORY);
      try { localStorage.setItem(HISTORY_KEY, JSON.stringify(h)); } catch {}
      return h;
    },
    clear() { try { localStorage.removeItem(HISTORY_KEY); } catch {} },
    toMessages() {
      return this.get().map(m => ({ role: m.role === 'ai' ? 'assistant' : m.role, content: m.content }));
    }
  };

  // ── Attachment queue ─────────────────────────────────────────
  const DockAttachments = {
    list: [],
    add(att) { this.list.push(att); _updateAttachmentBar(); },
    remove(idx) { this.list.splice(idx, 1); _updateAttachmentBar(); },
    clear() { this.list = []; _updateAttachmentBar(); },
    get() { return this.list; }
  };

  // ── State ─────────────────────────────────────────────────────
  const DockState = {
    open: false,
    plusMenuOpen: false,
    streaming: false,
    abortController: null,
    notifications: [],
    unreadCount: 0,
    panels: {}
  };

  // ── Notification Manager (legacy compat) ─────────────────────
  const DockNotifications = {
    add(msg, type = 'info', source = '') {
      const notif = { id: 'n_' + Date.now(), message: msg, type, source, time: new Date(), read: false };
      DockState.notifications.unshift(notif);
      if (DockState.notifications.length > 50) DockState.notifications.pop();
      DockState.unreadCount++;
      return notif.id;
    },
    markAllRead() { DockState.notifications.forEach(n => n.read = true); DockState.unreadCount = 0; },
    clearAll() { DockState.notifications = []; DockState.unreadCount = 0; },
    getAll() { return DockState.notifications; }
  };

  // ── Hover Tracking ───────────────────────────────────────────
  let _lastHoveredEl = null;
  let _lastHoveredText = '';

  function _initHoverTracking() {
    document.addEventListener('mouseover', (e) => {
      _lastHoveredEl = e.target;
      const t = e.target.textContent?.trim();
      if (t && t.length > 2 && t.length < 300) _lastHoveredText = t;
    }, { passive: true });
  }

  // ── Markdown Renderer ─────────────────────────────────────────
  function _md(text) {
    if (window.renderMarkdown) return renderMarkdown(text);
    // fallback minimal renderer
    return text
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/`(.+?)`/g, '<code>$1</code>')
      .replace(/\n/g, '<br>');
  }

  function _esc(str) {
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // ── Build Dock HTML ──────────────────────────────────────────
  function _buildDock() {
    ['floatingAI', 'floatingDock'].forEach(id => {
      const old = document.getElementById(id);
      if (old) old.remove();
    });

    const isRTL = document.documentElement.getAttribute('dir') === 'rtl';
    const lang = document.documentElement.lang || 'ar';

    const dock = document.createElement('div');
    dock.id = 'floatingDock';
    dock.className = 'floating-dock floating-dock-v6';

    dock.innerHTML = `
      <!-- Trigger button -->
      <button class="dock-main-btn" id="dockMainBtn" onclick="DockSystem.toggleAI()"
              title="AI Assistant" aria-expanded="false" aria-controls="dockPanelAI">
        <i class="fas fa-robot dock-icon-ai"></i>
        <i class="fas fa-times dock-icon-close" style="display:none"></i>
        <span class="dock-pulse"></span>
        <span class="dock-badge ai-badge" id="dockAIBadge" style="display:none"></span>
      </button>

      <!-- Main Chat Panel -->
      <div class="dock-panel dock-panel-v6" id="dockPanelAI" style="display:none"
           role="dialog" aria-label="AI Assistant" aria-hidden="true">

        <!-- Header -->
        <div class="dock-header-v6" id="dockHeader">
          <div class="dock-header-left">
            <div class="dock-avatar-ring"><i class="fas fa-brain"></i></div>
            <div class="dock-header-info">
              <span class="dock-header-name">AI Agent</span>
              <span class="dock-header-status" id="dockStatus">● متصل</span>
            </div>
          </div>
          <div class="dock-header-right">
            <button class="dock-hdr-btn" onclick="DockSystem.openFull('ai')" title="فتح كامل">
              <i class="fas fa-expand-alt"></i>
            </button>
            <button class="dock-hdr-btn" onclick="DockSystem.clearHistory()" title="محادثة جديدة">
              <i class="fas fa-plus"></i>
            </button>
            <button class="dock-hdr-btn" id="dockCloseBtn" onclick="DockSystem.close()" title="إغلاق">
              <i class="fas fa-times"></i>
            </button>
          </div>
        </div>

        <!-- Context bar -->
        <div class="dock-context-bar" id="dockContextBar"></div>

        <!-- Messages wrapper (relative container for jump-to-bottom btn) -->
        <div class="dock-messages-wrapper" id="dockMessagesWrapper">
          <div class="dock-messages-v6" id="dockMessages"
               ondragover="DockSystem.onDragOver(event)"
               ondrop="DockSystem.onDrop(event)"
               ondragleave="DockSystem.onDragLeave(event)">
            <div class="dock-welcome-v6" id="dockWelcome">
              <div class="dock-welcome-avatar"><i class="fas fa-brain"></i></div>
              <h3>مرحباً! أنا وكيلك الذكي</h3>
              <p>يمكنني قراءة التطبيق كاملاً، إنشاء الجداول، تعبئة النماذج، إنشاء الملفات وأكثر.</p>
              <div class="dock-suggestions-grid">
                <button onclick="DockSystem.sendQuick('حلل جدولي الأسبوعي واخبرني عن نقاط القوة والضعف')">📊 حلّل جدولي</button>
                <button onclick="DockSystem.sendQuick('ما هو وضع تقدمي الدراسي اليوم؟')">📈 تقدمي اليوم</button>
                <button onclick="DockSystem.sendQuick('أنشئ لي خطة دراسة مثالية لهذا الأسبوع')">📚 خطة الأسبوع</button>
                <button onclick="DockSystem.sendQuick('أخبرني بكل شيء عن الصفحة الحالية')">🔍 حالة التطبيق</button>
              </div>
            </div>
            <div id="dockMsgList"></div>
            <div class="dock-typing-v6" id="dockTyping" style="display:none">
              <div class="dock-typing-dots"><span></span><span></span><span></span></div>
              <span class="dock-typing-label">يكتب...</span>
            </div>
          </div>
          <!-- Jump-to-bottom button (shows when user scrolls up while new messages arrive) -->
          <button class="dock-jump-to-bottom hidden" id="dockJumpToBottom"
                  onclick="DockSystem.scrollToBottom()">
            <i class="fas fa-arrow-down"></i> <span id="dockJumpLabel">آخر رسالة</span>
          </button>
        </div>

        <!-- Attachment bar -->
        <div class="dock-attach-bar" id="dockAttachBar" style="display:none"></div>

        <!-- Plus Menu -->
        <div class="dock-plus-menu" id="dockPlusMenu" style="display:none">
          <button onclick="DockSystem.pickFile('image/*','image')" class="dock-plus-item">
            <i class="fas fa-image"></i><span>صورة</span>
          </button>
          <button onclick="DockSystem.pickFile('.pdf','pdf')" class="dock-plus-item">
            <i class="fas fa-file-pdf"></i><span>PDF</span>
          </button>
          <button onclick="DockSystem.pickFile('.xlsx,.xls,.csv','excel')" class="dock-plus-item">
            <i class="fas fa-file-excel"></i><span>Excel</span>
          </button>
          <button onclick="DockSystem.pickFile('.docx,.doc,.rtf','word')" class="dock-plus-item">
            <i class="fas fa-file-word"></i><span>Word</span>
          </button>
          <button onclick="DockSystem.pickFile('*','file')" class="dock-plus-item">
            <i class="fas fa-paperclip"></i><span>ملف</span>
          </button>
          <button onclick="DockSystem.startCamera()" class="dock-plus-item">
            <i class="fas fa-camera"></i><span>كاميرا</span>
          </button>
          <button onclick="DockSystem.toggleVoice()" class="dock-plus-item" id="dockPlusVoiceBtn">
            <i class="fas fa-microphone"></i><span>صوت</span>
          </button>
        </div>

        <!-- Input area -->
        <div class="dock-input-area-v6">
          <div class="dock-input-row-v6">
            <button class="dock-plus-btn-v6" id="dockPlusBtn" onclick="DockSystem.togglePlusMenu()" title="إرفاق">
              <i class="fas fa-plus"></i>
            </button>
            <textarea id="dockAIInput" class="dock-textarea-v6" rows="1"
              placeholder="اسأل أو اطلب أي شيء..." aria-label="مربع رسالة المساعد الذكي"
              onkeydown="DockSystem.handleKey(event)"
              oninput="DockSystem.autoResize(this)"></textarea>
            <button class="dock-send-btn-v6" id="dockSendBtn"
                    onclick="DockSystem.send()" title="إرسال">
              <i class="fas fa-paper-plane" id="dockSendIcon"></i>
            </button>
          </div>
          <div class="dock-input-hint">Shift+Enter للسطر الجديد · اسحب الملفات هنا</div>
        </div>
      </div>

      <!-- NO BACKDROP — using document-level pointerdown listener instead -->
    `;

    document.body.appendChild(dock);
    _applyPositioning();
    _renderHistoryMessages();
  }

  // ── Positioning ───────────────────────────────────────────────
  function _applyPositioning() {
    const dock = document.getElementById('floatingDock');
    if (!dock) return;
    const isRTL = document.documentElement.getAttribute('dir') === 'rtl';
    // FIX: use 900px breakpoint (consistent with layout.css --bp-mobile: 899px)
    const isMobile = window.innerWidth < 900;

    dock.style.bottom = '24px';
    dock.style.right = isRTL ? 'auto' : '24px';
    dock.style.left = isRTL ? '24px' : 'auto';

    const panel = document.getElementById('dockPanelAI');
    if (panel) {
      if (isMobile) {
        panel.style.width = '100vw';
        // FIX: use dvh for correct behavior when keyboard is open on iOS/Android
        panel.style.height = CSS.supports('height', '85dvh') ? '85dvh' : '85vh';
        panel.style.bottom = '0';
        panel.style.right = isRTL ? 'auto' : '0';
        panel.style.left = isRTL ? '0' : 'auto';
        panel.style.borderRadius = '20px 20px 0 0';
        panel.style.paddingBottom = 'max(16px, env(safe-area-inset-bottom, 0px))';
      } else {
        panel.style.width = '420px';
        panel.style.height = '600px';
        panel.style.bottom = '80px';
        panel.style.right = isRTL ? 'auto' : '0';
        panel.style.left = isRTL ? '0' : 'auto';
        panel.style.borderRadius = '20px';
        panel.style.paddingBottom = '';
      }
    }
  }

  // ── Render Stored History ─────────────────────────────────────
  function _renderHistoryMessages() {
    const h = DockHistory.get();
    if (h.length === 0) return;
    const welcome = document.getElementById('dockWelcome');
    if (welcome) welcome.style.display = 'none';
    h.forEach(m => _appendMessage(m.role, m.content, false));
  }

  // ── Append Message ────────────────────────────────────────────
  function _appendMessage(role, content, saveToHistory = true) {
    const list = document.getElementById('dockMsgList');
    const welcome = document.getElementById('dockWelcome');
    if (!list) return;
    if (welcome) welcome.style.display = 'none';

    const isUser = role === 'user';
    const id = 'dm_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
    const settings = typeof DB !== 'undefined' ? DB.get('settings', {}) : {};
    const userName = settings.userName || 'أنت';
    const initial = userName.trim().charAt(0).toUpperCase() || 'أ';

    const div = document.createElement('div');
    div.className = `dock-msg-v6 ${isUser ? 'dock-msg-user' : 'dock-msg-ai'}`;
    div.id = id;

    const bubbleContent = isUser
      ? `<div class="dock-bubble-v6 dock-bubble-user">${_esc(content)}</div>`
      : `<div class="dock-bubble-v6 dock-bubble-ai markdown">${_md(content)}</div>
         <div class="dock-msg-actions-v6">
           <button onclick="DockSystem.copyMsg('${id}')" title="نسخ"><i class="fas fa-copy"></i></button>
           <button onclick="DockSystem.speakMsg('${id}')" title="نطق"><i class="fas fa-volume-up"></i></button>
         </div>`;

    div.innerHTML = `
      <div class="dock-msg-avatar">${isUser ? `<span>${_esc(initial)}</span>` : '<i class="fas fa-brain"></i>'}</div>
      <div class="dock-msg-body">${bubbleContent}</div>
    `;

    list.appendChild(div);

    // ✅ SMART SCROLL: only auto-scroll if already at bottom
    _smartScrollToBottom();

    if (saveToHistory) DockHistory.push(role, content);
    return div;
  }

  // ── Streaming message bubble ──────────────────────────────────
  let _streamDiv = null;
  let _streamBubble = null;

  function _createStreamBubble() {
    const list = document.getElementById('dockMsgList');
    const welcome = document.getElementById('dockWelcome');
    if (!list) return;
    if (welcome) welcome.style.display = 'none';

    _streamDiv = document.createElement('div');
    _streamDiv.className = 'dock-msg-v6 dock-msg-ai';

    _streamBubble = document.createElement('div');
    _streamBubble.className = 'dock-bubble-v6 dock-bubble-ai markdown';
    _streamBubble.textContent = '';

    const avatar = document.createElement('div');
    avatar.className = 'dock-msg-avatar';
    avatar.innerHTML = '<i class="fas fa-brain"></i>';

    const body = document.createElement('div');
    body.className = 'dock-msg-body';
    body.appendChild(_streamBubble);

    _streamDiv.appendChild(avatar);
    _streamDiv.appendChild(body);
    list.appendChild(_streamDiv);
  }

  function _updateStreamBubble(text) {
    if (_streamBubble) {
      _streamBubble.innerHTML = _md(text);
      // ✅ SMART SCROLL: only auto-scroll if already at bottom
      _smartScrollToBottom();
    }
  }

  function _finalizeStreamBubble(text) {
    if (_streamBubble) {
      _streamBubble.innerHTML = _md(text);
      // Add action buttons
      const actions = document.createElement('div');
      actions.className = 'dock-msg-actions-v6';
      const id = _streamDiv?.id || ('dm_' + Date.now());
      if (_streamDiv) _streamDiv.id = id;
      actions.innerHTML = `
        <button onclick="DockSystem.copyMsg('${id}')" title="نسخ"><i class="fas fa-copy"></i></button>
        <button onclick="DockSystem.speakMsg('${id}')" title="نطق"><i class="fas fa-volume-up"></i></button>
      `;
      if (_streamDiv) _streamDiv.querySelector('.dock-msg-body')?.appendChild(actions);
    }
    DockHistory.push('ai', text);
    _streamDiv = null;
    _streamBubble = null;
  }

  // ── Context bar update ────────────────────────────────────────
  function updateDockContext() {
    const bar = document.getElementById('dockContextBar');
    if (!bar) return;
    try {
      let page = window._currentAIPage || window._currentPage || '';
      if (!page && document.querySelector('.page.active')) {
        page = document.querySelector('.page.active').id?.replace('page-', '') || '';
      }
      const weekNum = typeof getCurrentWeekNum === 'function' ? getCurrentWeekNum() : 1;
      const today = new Date();
      const dayMap = { 6: 'السبت', 0: 'الأحد', 1: 'الاثنين', 2: 'الثلاثاء', 3: 'الأربعاء', 4: 'الخميس', 5: 'الجمعة' };
      const todayAr = dayMap[today.getDay()] || '';
      const parts = [page && `📄 ${page}`, todayAr && `📅 ${todayAr}`, `أسبوع ${weekNum}`].filter(Boolean);
      bar.textContent = parts.join(' · ');
      bar.style.display = parts.length ? 'block' : 'none';
    } catch (e) {
      bar.textContent = '';
    }
  }

  // ── Build context for AI request ─────────────────────────────
  function _buildContext() {
    try {
      if (window.AIAgentCore && window.AIAgentCore.tools.getAppState) {
        const r = window.AIAgentCore.tools.getAppState.call(window.AIAgentCore);
        if (r.success) return r.result;
      }
      if (window.AIAgent) return AIAgent.getAppContext?.() || {};
    } catch (e) {}
    return {};
  }

  // ── Send message ─────────────────────────────────────────────
  function send() {
    const input = document.getElementById('dockAIInput');
    const text = input ? input.value.trim() : '';
    const attachments = DockAttachments.get();

    if (!text && attachments.length === 0) return;
    if (DockState.streaming) { abort(); return; }

    // Render user message
    _appendMessage('user', text);
    if (input) { input.value = ''; input.style.height = 'auto'; }
    _closePlusMenu();

    // Show typing
    document.getElementById('dockTyping').style.display = 'flex';
    _setSendBtn(true);
    DockState.streaming = true;

    // Build vision images from attachments
    const visionImages = attachments
      .filter(a => a.type === 'image')
      .map(a => a.dataUrl);

    // Build extra context from attachments
    let attachContext = '';
    attachments.filter(a => a.type !== 'image' && a.textContent).forEach(a => {
      attachContext += `\n\n[ATTACHED FILE: ${a.name}]\n${a.textContent}`;
    });
    DockAttachments.clear();

    const fullText = text + attachContext;

    // Get provider
    const provider = window.AIProviders ? AIProviders.getActiveProvider() : null;
    if (!provider || !provider.apiKey) {
      document.getElementById('dockTyping').style.display = 'none';
      _setSendBtn(false);
      DockState.streaming = false;
      _appendMessage('ai', '⚠️ لم يتم ضبط مزود AI. يرجى إضافة مفتاح API في إعدادات الذكاء الاصطناعي.');
      return;
    }

    if (!window.AIChat || typeof AIChat.sendMessageStream !== 'function') {
      document.getElementById('dockTyping').style.display = 'none';
      _setSendBtn(false);
      DockState.streaming = false;
      _appendMessage('ai', '⚠️ محرك AI غير محمل. يرجى تحديث الصفحة.');
      return;
    }

    // Prepare conversation history (last 10 exchanges)
    const history = DockHistory.toMessages().slice(-20);

    let buffer = '';
    _createStreamBubble();
    document.getElementById('dockTyping').style.display = 'none';

    DockState.abortController = new AbortController();

    try {
      AIChat.sendMessageStream(
        fullText,
        history,
        (delta, fullResponse) => {
          // onChunk
          buffer = typeof fullResponse === 'string' ? fullResponse : buffer + (delta || '');
          _updateStreamBubble(buffer);
        },
        async (fullResponse) => {
          // onDone
          DockState.streaming = false;
          _setSendBtn(false);
          document.getElementById('dockTyping').style.display = 'none';
          const resp = (typeof fullResponse === 'string' && fullResponse) ? fullResponse : buffer;
          buffer = '';

          if (resp) {
            _finalizeStreamBubble(resp);
            // Execute tools via AIAgentCore
            if (window.AIAgentCore) {
              const toolResults = await AIAgentCore.parseAndExecuteAll(resp);
              if (toolResults && toolResults.length > 0) {
                // Show tool execution summary badge
                _renderToolBadges(toolResults);
              }
            } else if (window.AIAgent) {
              AIAgent.parseAndExecuteTools(resp);
            }
            // Auto-save to memory
            if (window.AIMemory) {
              AIMemory.extractAndStore(resp);
            }
          } else {
            _appendMessage('ai', '⚠️ لم تصل استجابة. تحقق من إعدادات المزود.');
          }
        },
        (err) => {
          // onError
          DockState.streaming = false;
          _setSendBtn(false);
          document.getElementById('dockTyping').style.display = 'none';
          buffer = '';
          if (_streamDiv) { _streamDiv.remove(); _streamDiv = null; _streamBubble = null; }
          _appendMessage('ai', '⚠️ ' + (err?.message || 'حدث خطأ في الاتصال'));
        },
        undefined,  // systemPromptOverride
        visionImages.length > 0 ? visionImages : undefined  // visionImages (6th arg)
      );
    } catch (err) {
      DockState.streaming = false;
      _setSendBtn(false);
      document.getElementById('dockTyping').style.display = 'none';
      if (_streamDiv) { _streamDiv.remove(); _streamDiv = null; _streamBubble = null; }
      _appendMessage('ai', '⚠️ ' + err.message);
    }
  }

  // ── Abort streaming ───────────────────────────────────────────
  function abort() {
    if (DockState.abortController) DockState.abortController.abort();
    DockState.streaming = false;
    _setSendBtn(false);
    document.getElementById('dockTyping').style.display = 'none';
    if (_streamBubble && _streamBubble.textContent) {
      const text = _streamBubble.innerHTML;
      _finalizeStreamBubble(_streamBubble.textContent);
    }
  }

  function _setSendBtn(streaming) {
    const btn = document.getElementById('dockSendBtn');
    const icon = document.getElementById('dockSendIcon');
    if (!btn) return;
    if (streaming) {
      btn.classList.add('streaming');
      if (icon) { icon.className = 'fas fa-stop'; }
      btn.title = 'إيقاف';
    } else {
      btn.classList.remove('streaming');
      if (icon) { icon.className = 'fas fa-paper-plane'; }
      btn.title = 'إرسال';
    }
  }

  // ── Render tool execution badges ──────────────────────────────
  function _renderToolBadges(results) {
    if (!results || !results.length) return;
    const list = document.getElementById('dockMsgList');
    if (!list) return;

    const badgeWrap = document.createElement('div');
    badgeWrap.className = 'dock-tool-badges';
    results.forEach(r => {
      const ok = r.result?.success !== false;
      const span = document.createElement('span');
      span.className = `dock-tool-badge ${ok ? 'badge-ok' : 'badge-err'}`;
      span.innerHTML = `<i class="fas fa-${ok ? 'check-circle' : 'times-circle'}"></i> ${_esc(r.tool)}${!ok ? ': ' + _esc(r.result?.error || '') : ''}`;
      badgeWrap.appendChild(span);
    });
    list.appendChild(badgeWrap);
    // ✅ SMART SCROLL: only auto-scroll if already at bottom
    _smartScrollToBottom();
  }

  // ── sendQuick ─────────────────────────────────────────────────
  function sendQuick(msg) {
    const input = document.getElementById('dockAIInput');
    if (input) input.value = msg;
    send();
  }

  // ── handleKey ─────────────────────────────────────────────────
  function handleKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  }

  // ── autoResize ────────────────────────────────────────────────
  function autoResize(el) {
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 160) + 'px';
  }

  // ── Plus menu ─────────────────────────────────────────────────
  function togglePlusMenu() {
    DockState.plusMenuOpen = !DockState.plusMenuOpen;
    const menu = document.getElementById('dockPlusMenu');
    const btn = document.getElementById('dockPlusBtn');
    if (menu) menu.style.display = DockState.plusMenuOpen ? 'grid' : 'none';
    if (btn) btn.classList.toggle('plus-open', DockState.plusMenuOpen);
  }

  function _closePlusMenu() {
    DockState.plusMenuOpen = false;
    const menu = document.getElementById('dockPlusMenu');
    const btn = document.getElementById('dockPlusBtn');
    if (menu) menu.style.display = 'none';
    if (btn) btn.classList.remove('plus-open');
  }

  // ── File picking ──────────────────────────────────────────────
  function pickFile(accept, category) {
    _closePlusMenu();
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept || '*';
    input.multiple = true;
    input.onchange = async () => {
      for (const file of input.files) {
        await _processFile(file, category);
      }
    };
    input.click();
  }

  async function _processFile(file, category) {
    if (!file) return;
    try {
      if (window.AIDocuments && typeof AIDocuments.analyzeFile === 'function') {
        const att = await AIDocuments.analyzeFile(file);
        if (att) {
          DockAttachments.add(att);
          if (typeof showToast === 'function') showToast(`📎 ${file.name} جاهز`, 'success');
          return;
        }
      }
      // Fallback: read as text
      const text = await new Promise((res, rej) => {
        const fr = new FileReader();
        fr.onload = e => res(e.target.result);
        fr.onerror = () => rej(new Error('Read failed'));
        if (file.type.startsWith('image/')) fr.readAsDataURL(file);
        else fr.readAsText(file);
      });
      const att = file.type.startsWith('image/')
        ? { type: 'image', name: file.name, mimeType: file.type, dataUrl: text }
        : { type: 'document', name: file.name, mimeType: file.type, textContent: text.substring(0, 50000) };
      DockAttachments.add(att);

      // Points 10-12: Update session context for cross-message file memory
      if (window._sessionContext) {
        const ext = file.name.split('.').pop().toLowerCase();
        if (file.type.startsWith('image/')) {
          window._sessionContext.lastImage = { name: file.name, url: text, description: `صورة: ${file.name}`, uploadedAt: new Date().toISOString() };
          window._sessionContext.lastFile = { name: file.name, type: 'image', content: text, size: file.size, uploadedAt: new Date().toISOString() };
        } else {
          window._sessionContext.lastFile = { name: file.name, type: ext, content: text.substring(0, 50000), text: text.substring(0, 50000), size: file.size, uploadedAt: new Date().toISOString() };
        }
      }

      if (typeof showToast === 'function') showToast(`📎 ${file.name} جاهز`, 'success');
    } catch (e) {
      if (typeof showToast === 'function') showToast('فشل قراءة الملف: ' + e.message, 'error');
    }
  }

  // ── Attachment bar ────────────────────────────────────────────
  function _updateAttachmentBar() {
    const bar = document.getElementById('dockAttachBar');
    if (!bar) return;
    const atts = DockAttachments.get();
    if (atts.length === 0) { bar.style.display = 'none'; bar.innerHTML = ''; return; }
    bar.style.display = 'flex';
    bar.innerHTML = atts.map((a, i) => `
      <div class="dock-att-chip">
        ${a.type === 'image' ? `<img src="${_esc(a.dataUrl)}" alt="${_esc(a.name)}">` : `<i class="fas fa-file"></i>`}
        <span>${_esc(a.name)}</span>
        <button onclick="DockSystem.removeAttachment(${i})"><i class="fas fa-times"></i></button>
      </div>
    `).join('');
  }

  function removeAttachment(idx) {
    DockAttachments.remove(idx);
  }

  // ── Drag & Drop ───────────────────────────────────────────────
  function onDragOver(e) {
    e.preventDefault();
    const msgs = document.getElementById('dockMessages');
    if (msgs) msgs.classList.add('drag-over');
  }

  function onDragLeave(e) {
    const msgs = document.getElementById('dockMessages');
    if (msgs) msgs.classList.remove('drag-over');
  }

  async function onDrop(e) {
    e.preventDefault();
    const msgs = document.getElementById('dockMessages');
    if (msgs) msgs.classList.remove('drag-over');
    const files = e.dataTransfer?.files;
    if (!files) return;
    for (const file of files) await _processFile(file, 'auto');
  }

  // ── Camera capture ────────────────────────────────────────────
  function startCamera() {
    _closePlusMenu();
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.capture = 'environment';
    input.onchange = async () => {
      if (input.files[0]) await _processFile(input.files[0], 'image');
    };
    input.click();
  }

  // ── Voice input ───────────────────────────────────────────────
  let _recognition = null;
  let _voiceActive = false;

  function toggleVoice() {
    _closePlusMenu();
    if (_voiceActive) _stopVoice();
    else _startVoice();
  }

  function _startVoice() {
    const SRClass = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SRClass) {
      if (typeof showToast === 'function') showToast('التعرف على الكلام غير مدعوم في هذا المتصفح', 'error');
      return;
    }
    _recognition = new SRClass();
    _recognition.lang = document.documentElement.lang === 'ar' ? 'ar-SA' :
                        document.documentElement.lang === 'en' ? 'en-US' : 'ar-SA';
    _recognition.continuous = true;
    _recognition.interimResults = true;

    let finalText = '';
    _recognition.onresult = (e) => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) finalText += t + ' ';
        else interim += t;
      }
      const input = document.getElementById('dockAIInput');
      if (input) {
        input.value = (finalText + interim).trim();
        autoResize(input);
        input.style.opacity = interim ? '0.7' : '1';
      }
    };
    _recognition.onend = () => {
      _voiceActive = false; _updateVoiceBtn(false);
      const input = document.getElementById('dockAIInput');
      if (input) input.style.opacity = '1';
    };
    _recognition.onerror = () => {
      _voiceActive = false; _updateVoiceBtn(false);
      const input = document.getElementById('dockAIInput');
      if (input) input.style.opacity = '1';
    };
    _recognition.start();
    _voiceActive = true;
    _updateVoiceBtn(true);
    if (typeof showToast === 'function') showToast('🎙️ جاري الاستماع... تكلم الآن', 'info');
  }

  function _stopVoice() {
    if (_recognition) { try { _recognition.stop(); } catch {} }
    _voiceActive = false;
    _updateVoiceBtn(false);
  }

  function _updateVoiceBtn(active) {
    const btn = document.getElementById('dockVoiceBtn');
    const pbtn = document.getElementById('dockPlusVoiceBtn');
    [btn, pbtn].forEach(b => {
      if (b) b.classList.toggle('voice-active', active);
    });
  }

  // ── Copy / Speak message ──────────────────────────────────────
  function copyMsg(id) {
    const el = document.getElementById(id);
    const bubble = el?.querySelector('.dock-bubble-v6');
    const text = bubble?.innerText || bubble?.textContent || '';
    navigator.clipboard?.writeText(text).then(() => {
      if (typeof showToast === 'function') showToast('✅ تم النسخ', 'success');
    }).catch(() => {
      if (typeof showToast === 'function') showToast('⚠️ النسخ غير مدعوم', 'warning');
    });
  }

  function speakMsg(id) {
    const el = document.getElementById(id);
    const bubble = el?.querySelector('.dock-bubble-v6');
    const text = bubble?.innerText || bubble?.textContent || '';
    if (!text) return;
    if (window.AIAgentCore) {
      AIAgentCore.tools.speak.call(AIAgentCore, {
        text: text.substring(0, 2000),
        lang: document.documentElement.lang === 'ar' ? 'ar-SA' : 'en-US'
      });
    } else {
      const u = new SpeechSynthesisUtterance(text.substring(0, 2000));
      u.lang = document.documentElement.lang === 'ar' ? 'ar-SA' : 'en-US';
      window.speechSynthesis?.speak(u);
    }
  }

  // ── Clear history ─────────────────────────────────────────────
  function clearHistory() {
    DockHistory.clear();
    DockAttachments.clear();
    const list = document.getElementById('dockMsgList');
    if (list) list.innerHTML = '';
    const welcome = document.getElementById('dockWelcome');
    if (welcome) welcome.style.display = '';
    if (typeof showToast === 'function') showToast('محادثة جديدة', 'info');
  }

  // ── Smart Scroll Helpers ──────────────────────────────────────
  const SCROLL_THRESHOLD = 80; // px from bottom = "at bottom"

  function _isAtBottom() {
    const msgs = document.getElementById('dockMessages');
    if (!msgs) return true;
    return (msgs.scrollHeight - msgs.scrollTop - msgs.clientHeight) <= SCROLL_THRESHOLD;
  }

  function _smartScrollToBottom() {
    const msgs = document.getElementById('dockMessages');
    if (!msgs) return;
    if (_isAtBottom()) {
      // Already at bottom — auto scroll
      msgs.scrollTop = msgs.scrollHeight;
      _hideJumpBtn();
    } else {
      // User is reading old messages — show jump button
      _showJumpBtn();
    }
  }

  function _showJumpBtn() {
    const btn = document.getElementById('dockJumpToBottom');
    if (btn) btn.classList.remove('hidden');
  }

  function _hideJumpBtn() {
    const btn = document.getElementById('dockJumpToBottom');
    if (btn) btn.classList.add('hidden');
  }

  function scrollToBottom() {
    const msgs = document.getElementById('dockMessages');
    if (msgs) msgs.scrollTop = msgs.scrollHeight;
    _hideJumpBtn();
  }

  function _initScrollTracking() {
    const msgs = document.getElementById('dockMessages');
    if (!msgs) return;
    msgs.addEventListener('scroll', () => {
      if (_isAtBottom()) _hideJumpBtn();
    }, { passive: true });
  }

  // ── Outside-click handler (replaces backdrop) ─────────────────
  let _outsideClickHandler = null;

  function _initOutsideClickHandler() {
    // Remove any existing handler
    if (_outsideClickHandler) {
      document.removeEventListener('pointerdown', _outsideClickHandler, true);
    }

    _outsideClickHandler = function (e) {
      if (!DockState.open) return;

      const panel = document.getElementById('dockPanelAI');
      const mainBtn = document.getElementById('dockMainBtn');

      // If click is inside the panel → do nothing
      if (panel && panel.contains(e.target)) return;
      // If click is on the main toggle button → toggleAI() handles it
      if (mainBtn && mainBtn.contains(e.target)) return;

      // Check settings: should we close on outside click?
      let closeOnOutside = true;
      try {
        const settings = typeof DB !== 'undefined' ? DB.get('aiSettings', {}) : {};
        if (settings.closeOnOutsideClick === false) closeOnOutside = false;
      } catch {}

      if (closeOnOutside) close();
    };

    // Use capture phase so it fires before any other listeners
    document.addEventListener('pointerdown', _outsideClickHandler, true);
  }

  // ── Toggle/Open/Close ─────────────────────────────────────────
  function toggleAI() {
    if (DockState.open) close(); else openAI();
  }

  function openAI() {
    DockState.open = true;
    const panel = document.getElementById('dockPanelAI');
    const btn = document.getElementById('dockMainBtn');

    if (panel) { panel.style.display = 'flex'; panel.setAttribute('aria-hidden', 'false'); }
    if (btn) {
      btn.setAttribute('aria-expanded', 'true');
      btn.querySelector('.dock-icon-ai').style.display = 'none';
      btn.querySelector('.dock-icon-close').style.display = '';
    }

    // FIX #7: Restore history messages on every open (memory persistence)
    const list = document.getElementById('dockMsgList');
    if (list && list.children.length === 0) {
      _renderHistoryMessages();
    }

    // FIX #4: visualViewport resize handler (mobile keyboard shrinks viewport)
    if (window.visualViewport) {
      window.visualViewport.removeEventListener('resize', _onViewportResize);
      window.visualViewport.addEventListener('resize', _onViewportResize);
    }

    // ✅ NO BACKDROP — outside click handled by _outsideClickHandler

    updateDockContext();
    setTimeout(() => document.getElementById('dockAIInput')?.focus(), 100);
    _applyPositioning();

    // Proactive check on open
    setTimeout(_doProactiveCheck, 800);
  }

  // FIX #4: visualViewport resize — shrinks panel when keyboard appears on mobile
  function _onViewportResize() {
    if (!DockState.open) return;
    const panel = document.getElementById('dockPanelAI');
    if (!panel) return;
    // FIX: use 900px breakpoint (consistent with layout.css)
    if (window.innerWidth < 900 && window.visualViewport) {
      const vvh = window.visualViewport.height;
      // Use 90% of visible viewport height when keyboard is open
      panel.style.height = Math.floor(vvh * 0.90) + 'px';
      panel.style.maxHeight = Math.floor(vvh * 0.90) + 'px';
    }
  }

  function close() {
    DockState.open = false;
    _closePlusMenu();
    // FIX #4: Remove viewport listener when panel closed
    if (window.visualViewport) {
      window.visualViewport.removeEventListener('resize', _onViewportResize);
    }
    const panel = document.getElementById('dockPanelAI');
    const btn = document.getElementById('dockMainBtn');

    if (panel) { panel.style.display = 'none'; panel.setAttribute('aria-hidden', 'true'); }
    if (btn) {
      btn.setAttribute('aria-expanded', 'false');
      btn.querySelector('.dock-icon-ai').style.display = '';
      btn.querySelector('.dock-icon-close').style.display = 'none';
    }
    // ✅ NO BACKDROP — nothing to hide
  }

  function openFull(section) {
    close();
    if (window.showAIPage) showAIPage('ai-workspace');
    else if (window.showPage) showPage('ai-workspace');
  }

  // ── Legacy panel compat ───────────────────────────────────────
  function openPanel(name) { if (name === 'ai') openAI(); }
  function closePanel() { close(); }

  // ── Proactive suggestions ─────────────────────────────────────
  function _doProactiveCheck() {
    // Only fire proactive if no messages yet in this session
    const h = DockHistory.get();
    if (h.length > 0) return;

    try {
      const weekNum = typeof getCurrentWeekNum === 'function' ? getCurrentWeekNum() : 1;
      const today = new Date();
      const dayMap = { 6: 'sat', 0: 'sun', 1: 'mon', 2: 'tue', 3: 'wed', 4: 'thu', 5: 'fri' };
      const todayKey = dayMap[today.getDay()] || 'sat';

      if (typeof WEEK_SCHEDULE === 'undefined' || typeof getDailyData === 'undefined') return;

      const dayInfo = WEEK_SCHEDULE.find(d => d.key === todayKey);
      if (!dayInfo) return;

      const data = getDailyData(weekNum, todayKey, dayInfo.pattern);
      const blocks = data?.blocks || [];

      const suggestions = [];
      if (blocks.length === 0) {
        suggestions.push({
          text: `📋 لاحظت أن جدول اليوم (${dayInfo.dayAr}) فارغ! هل تريدني أن أنشئ لك خطة دراسة متكاملة؟`,
          quick: `أنشئ خطة دراسة ليوم ${dayInfo.dayAr} من 8 صباحاً حتى 10 مساءً تشمل الدراسة والمراجعة والاستراحات`
        });
      } else if (blocks.length < 3) {
        suggestions.push({
          text: `📌 جدول اليوم يحتوي على ${blocks.length} بلوك فقط. هل تريد إضافة المزيد من الجلسات الدراسية؟`,
          quick: `أضف بلوكات دراسية متنوعة ليوم ${dayInfo.dayAr}`
        });
      }

      // Check for missing review block
      const hasReview = blocks.some(b => {
        const name = typeof b.name === 'object' ? b.name.ar : (b.name || '');
        return name.includes('مراجع') || name.includes('review') || name.includes('Anki');
      });
      if (blocks.length > 0 && !hasReview) {
        suggestions.push({
          text: `🔁 لم أجد بلوك مراجعة في جدول اليوم. المراجعة المنتظمة تحسن التذكر بنسبة 70%. هل أضيفها؟`,
          quick: `أضف بلوك مراجعة في نهاية جدول يوم ${dayInfo.dayAr}`
        });
      }

      if (suggestions.length > 0) {
        const s = suggestions[Math.floor(Math.random() * suggestions.length)];
        // Wait a moment before showing proactive message
        setTimeout(() => {
          if (!DockState.open) return;
          const proactiveDiv = document.createElement('div');
          proactiveDiv.className = 'dock-proactive-card';
          proactiveDiv.innerHTML = `
            <div class="dock-proactive-icon"><i class="fas fa-lightbulb"></i></div>
            <div class="dock-proactive-body">
              <p>${_esc(s.text)}</p>
              <div class="dock-proactive-btns">
                <button onclick="DockSystem.sendQuick('${_esc(s.quick)}')" class="dock-proactive-yes">نعم، افعل ذلك</button>
                <button onclick="this.closest('.dock-proactive-card').remove()" class="dock-proactive-no">لا شكراً</button>
              </div>
            </div>
          `;
          const list = document.getElementById('dockMsgList');
          const welcome = document.getElementById('dockWelcome');
          if (list) {
            if (welcome) welcome.style.display = 'none';
            list.appendChild(proactiveDiv);
            // ✅ SMART SCROLL: only auto-scroll if already at bottom
            _smartScrollToBottom();
          }
        }, 1200);
      }
    } catch (e) {
      console.log('[Dock] Proactive check error:', e.message);
    }
  }

  // ── Utilities ─────────────────────────────────────────────────
  function _handleResize() { _applyPositioning(); }
  function _handleEsc(e) { if (e.key === 'Escape' && DockState.open) close(); }

  function _onLangChange() {
    const dock = document.getElementById('floatingDock');
    if (dock) dock.remove();
    _buildDock();
    _initScrollTracking();       // re-init after rebuild
    _initOutsideClickHandler();  // re-init after rebuild
  }

  // ── Public API ────────────────────────────────────────────────
  const DockSystem = {
    toggle: toggleAI, toggleAI, open: openAI, close, openPanel, closePanel, openFull,
    send, sendQuick, handleKey, autoResize,
    togglePlusMenu, pickFile, removeAttachment, startCamera, toggleVoice,
    onDragOver, onDragLeave, onDrop,
    copyMsg, speakMsg, clearHistory,
    scrollToBottom,    // ✅ exposed for jump-to-bottom button
    updateContext: updateDockContext,
    notify: (msg, type, source) => DockNotifications.add(msg, type, source),
    notifications: DockNotifications,
    getState: () => ({ ...DockState }),
    markAllRead: () => DockNotifications.markAllRead(),
    clearNotifications: () => DockNotifications.clearAll(),
    quickAction: (type) => {
      close();
      if (type === 'ai' && window.showAIPage) showAIPage('ai-workspace');
      else if (type === 'session' && window.showPage) showPage('dashboard');
      else if (type === 'schedule' && window.showPage) showPage('weekly');
    },
    switchGuideTab: () => {}
  };

  // ── Page Awareness (Points 17-19) ────────────────────────────
  // AI workspace pages where the full workspace is shown — hide floating dock button
  const AI_FULL_PAGES = ['ai-workspace'];

  // Pages where we show floating dock (all non-workspace pages)
  function _updateDockVisibilityForPage(pageId) {
    const dock = document.getElementById('floatingDock');
    if (!dock) return;

    if (AI_FULL_PAGES.includes(pageId)) {
      // On AI workspace page: hide the floating button entirely (workspace is full-page)
      dock.style.display = 'none';
      // Also close the panel if open
      if (DockState.open) close();
    } else {
      // On all other pages: show floating button
      dock.style.display = '';
    }
  }

  // ── Loading indicator (Point 16) ─────────────────────────────
  // Show a toast for operations >2 seconds
  function _showLoadingToast(message, minDurationMs = 2000) {
    if (typeof showToast !== 'function') return null;
    let timer = null;
    const toastId = 'loading_' + Date.now();
    timer = setTimeout(() => {
      showToast(message, 'info');
    }, 200); // Show quickly but indicate loading
    return {
      clear: () => { if (timer) clearTimeout(timer); }
    };
  }
  window._showLoadingToast = _showLoadingToast;

  // ── Initialize ────────────────────────────────────────────────
  function init() {
    _buildDock();
    _initHoverTracking();
    _initOutsideClickHandler();  // ✅ replaces transparent backdrop
    _initScrollTracking();       // ✅ track scroll position for jump btn
    window.addEventListener('resize', _handleResize);
    document.addEventListener('keydown', _handleEsc);
    if (window.onLanguageChange) onLanguageChange(_onLangChange);

    window.DockSystem = DockSystem;
    window.DockNotifications = DockNotifications;
    window.updateDockContext = updateDockContext;
    window.updateFloatingAIContext = updateDockContext;

    // Expose hover info to AIAgentCore
    window._getLastHoveredElement = () => ({ element: _lastHoveredEl, text: _lastHoveredText });

    window.closeUserGuide = () => {
      const p = document.getElementById('guidePanel');
      const o = document.getElementById('guideOverlay');
      if (p) p.classList.remove('active');
      if (o) o.classList.remove('active');
    };

    // Page visibility hook — expose so app.js showPage/showAIPage can call it
    window._updateDockVisibilityForPage = _updateDockVisibilityForPage;

    // Apply initial visibility based on current page
    const currentPage = window._currentAIPage || 'weekly';
    _updateDockVisibilityForPage(currentPage);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
