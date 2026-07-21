/* ============================================================
   AI WORKSPACE UI — Full LLM Interface
   ============================================================ */

/* ===== MARKED.JS INTEGRATION (inline mini renderer) =====
   Security: the whole input is HTML-escaped FIRST (code blocks are
   extracted to placeholders beforehand so they keep exact contents),
   then markdown transforms run on the escaped text. Link hrefs are
   restricted to http(s)/mailto/# to block javascript: URLs. */
function _sanitizeUrl(url) {
  const u = String(url || '').trim();
  return /^(https?:\/\/|mailto:|#|\/)/i.test(u) ? u : '#';
}

function renderMarkdown(text) {
  if (!text) return '';
  // 1) Extract fenced code blocks so escaping/markdown never touches them
  const codeBlocks = [];
  let src = String(text).replace(/```(\w+)?\n([\s\S]*?)```/g, (_, lang, code) => {
    const langClass = lang ? ` class="language-${escapeHtml(lang)}"` : '';
    codeBlocks.push(`<div class="ai-code-block"><div class="code-header"><span class="code-lang">${escapeHtml(lang || 'code')}</span><button class="copy-code-btn" onclick="copyCode(this)" aria-label="نسخ الكود" title="نسخ"><i class="fas fa-copy" aria-hidden="true"></i></button></div><pre><code${langClass}>${escapeHtml(code.trim())}</code></pre></div>`);
    return '\u0000CODE' + (codeBlocks.length - 1) + '\u0000';
  });

  // 2) Escape ALL raw HTML in the remaining text (XSS guard)
  src = escapeHtml(src);

  let html = src
    // Inline code
    .replace(/`([^`]+)`/g, '<code class="ai-inline-code">$1</code>')
    // Headers
    .replace(/^### (.+)$/gm, '<h3 class="ai-h3">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 class="ai-h2">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 class="ai-h1">$1</h1>')
    // Bold & italic
    .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/__(.+?)__/g, '<strong>$1</strong>')
    .replace(/_(.+?)_/g, '<em>$1</em>')
    // Horizontal rule
    .replace(/^---+$/gm, '<hr class="ai-hr">')
    // Blockquote (input is already escaped, so '>' is '&gt;')
    .replace(/^&gt; (.+)$/gm, '<blockquote class="ai-blockquote">$1</blockquote>')
    // Unordered lists
    .replace(/^[\*\-] (.+)$/gm, '<li class="ai-li">$1</li>')
    .replace(/(<li class="ai-li">.*<\/li>)\n(?!<li)/g, '<ul class="ai-ul">$1</ul>\n')
    // Ordered lists
    .replace(/^\d+\. (.+)$/gm, '<li class="ai-oli">$1</li>')
    // Links — href restricted to safe protocols
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, label, url) => `<a href="${_sanitizeUrl(url)}" target="_blank" rel="noopener noreferrer" class="ai-link">${label}</a>`)
    // Paragraphs
    .replace(/\n\n/g, '</p><p class="ai-p">')
    // Line breaks
    .replace(/\n/g, '<br>');

  // Wrap in paragraph
  html = '<p class="ai-p">' + html + '</p>';
  // Fix nested UL/OL
  html = html.replace(/<\/li>\n<li/g, '</li><li');

  // 3) Restore extracted code blocks
  html = html.replace(/\u0000CODE(\d+)\u0000/g, (_, i) => codeBlocks[Number(i)] || '');

  return html;
}

function copyCode(btn) {
  const code = btn.closest('.ai-code-block').querySelector('code').textContent;
  navigator.clipboard.writeText(code).then(() => {
    btn.innerHTML = '<i class="fas fa-check"></i>';
    setTimeout(() => { btn.innerHTML = '<i class="fas fa-copy"></i>'; }, 2000);
  });
}

/* ============================================================
   TOOL SYNTAX STRIPPER
   Removes [TOOL:name|{...}] tags from text shown to the user.
   Tool execution happens in onDone BEFORE this text is rendered.
   ============================================================ */
function _stripToolSyntax(text) {
  if (typeof text !== 'string') return '';
  // Remove [TOOL:name|{...}] — handles nested brackets in JSON args (e.g. arrays like blocks:[...]).
  // Strategy: scan character-by-character, track bracket depth, extract and remove full [TOOL:...] spans.
  let result = '';
  let i = 0;
  while (i < text.length) {
    // Check for [TOOL: prefix
    if (text[i] === '[' && text.slice(i, i + 6) === '[TOOL:') {
      let depth = 1;
      let j = i + 1;
      while (j < text.length && depth > 0) {
        if (text[j] === '[') depth++;
        else if (text[j] === ']') depth--;
        j++;
      }
      // j now points to the character after the closing ]
      i = j; // skip the entire [TOOL:...] span
    } else {
      result += text[i];
      i++;
    }
  }
  return result.replace(/\n{3,}/g, '\n\n').trim();
}

/* ============================================================
   WORKSPACE STATE
   ============================================================ */

const WorkspaceState = {
  currentConvId: null,
  isGenerating: false,
  attachments: [],
  searchQuery: '',
  editingProvider: null,
  editingModel: null,
  voiceRecording: false,
  speechRecognition: null,
  ttsEnabled: false,
  currentMode: 'chat', // chat | research | deep-think | study-coach | exam-prep | flashcards | mindmap
  // Session 13: track whether first message has been sent in the current conversation
  // Suggestions are hidden after the first send, never shown again until new conversation
  _chatHasSentMessage: false,
};

/* ============================================================
   AI WORKSPACE PAGE RENDERER
   ============================================================ */

function renderAIWorkspacePage() {
  const container = document.getElementById('page-ai-workspace');
  if (!container) return;

  // Guard against corrupted localStorage data
  let convs, folders;
  try {
    convs = AIConversations.getAll();
    // Sanitize: ensure each conv has required fields
    convs = convs.filter(c => c && typeof c === 'object' && c.id).map(c => ({
      ...c,
      title: typeof c.title === 'string' ? c.title : 'Untitled',
      messages: Array.isArray(c.messages) ? c.messages.map(m => ({
        ...m,
        content: typeof m.content === 'string' ? m.content : '',
        role: typeof m.role === 'string' ? m.role : 'user'
      })) : []
    }));
    folders = AIConversations.getFolders();
    if (!Array.isArray(folders)) folders = [];
  } catch (e) {
    console.warn('[AI Workspace] Storage read error:', e.message);
    convs = [];
    folders = [];
  }
  const activeConv = WorkspaceState.currentConvId
    ? AIConversations.getById(WorkspaceState.currentConvId)
    : null;

  container.innerHTML = `
    <div class="ai-workspace-layout">
      <!-- Sidebar -->
      <div class="ai-sidebar" id="aiSidebar">
        <div class="ai-sidebar-header">
          <button class="ai-new-chat-btn" onclick="aiNewChat()">
            <i class="fas fa-plus"></i>
            <span>${t('ai.workspace.newChat')}</span>
          </button>
          <button class="ai-sidebar-toggle-btn" onclick="toggleAISidebar()" title="${t('ai.workspace.newChat')}">
            <i class="fas fa-bars"></i>
          </button>
        </div>

        <div class="ai-search-wrap">
          <i class="fas fa-search ai-search-icon"></i>
          <input type="text" class="ai-search-input" placeholder="${t('ai.workspace.search')}" 
                 oninput="searchAIChats(this.value)" value="${WorkspaceState.searchQuery}" />
        </div>

        <div class="ai-conv-list" id="aiConvList">
          ${renderConversationList(convs, folders)}
        </div>

        <div class="ai-sidebar-footer">
          <button class="ai-sidebar-action" onclick="showAIPage('ai-settings', null)">
            <i class="fas fa-sliders-h"></i> ${t('nav.ai.settings')}
          </button>
          <button class="ai-sidebar-action" onclick="showAIPage('ai-personality', null)">
            <i class="fas fa-user-circle"></i> ${t('nav.ai.personality')}
          </button>
        </div>
      </div>

      <!-- Main Chat Area -->
      <div class="ai-main" id="aiMain">
        <!-- Top Bar -->
        <div class="ai-topbar">
          <div class="ai-topbar-left">
            <button class="ai-back-btn" onclick="toggleAISidebar()">
              <i class="fas fa-bars"></i>
            </button>
            <div class="ai-mode-selector">
              ${renderModeSelector()}
            </div>
          </div>
          <div class="ai-topbar-center">
            <h2 class="ai-chat-title" id="aiChatTitle">
              ${activeConv ? escapeHtml(activeConv.title) : '✨ ' + t('ai.workspace.title')}
            </h2>
          </div>
          <div class="ai-topbar-right">
            ${renderModelSelector()}
            ${activeConv ? `
              <button class="ai-topbar-btn" onclick="pinAIChat('${activeConv.id}')" title="${t('ai.workspace.pinChat')}">
                <i class="fas fa-thumbtack ${activeConv.pinned ? 'active' : ''}"></i>
              </button>
              <button class="ai-topbar-btn" onclick="exportAIChat('${activeConv.id}')" title="${t('ai.workspace.exportChat')}">
                <i class="fas fa-download"></i>
              </button>
              <button class="ai-topbar-btn danger" onclick="deleteAIChat('${activeConv.id}')" title="${t('ai.workspace.deleteChat')}">
                <i class="fas fa-trash"></i>
              </button>
            ` : ''}
          </div>
        </div>

        <!-- Messages wrapper: relative container for jump-to-bottom button -->
        <div class="ai-messages-wrapper" id="aiMessagesWrapper" style="flex:1;min-height:0;position:relative;display:flex;flex-direction:column;">
          <div class="ai-messages" id="aiMessages" onscroll="_aiWorkspaceScrollHandler()">
            ${activeConv && activeConv.messages.length > 0
              ? renderMessages(activeConv.messages)
              : renderWelcomeScreen()}
          </div>
          <!-- Jump to bottom button -->
          <button class="ai-jump-to-bottom hidden" id="aiJumpToBottom" onclick="_aiScrollToBottom()" title="آخر رسالة">
            <i class="fas fa-arrow-down"></i> <span>آخر رسالة</span>
          </button>
        </div>

        <!-- Input Area — Modern Agent Composer -->
        <!-- NOTE: aiAttachmentsPreview REMOVED — attachments shown only in agentPreviewsBar below -->
        <div class="ai-input-area" id="aiInputArea">
          <!-- Single attachment preview bar (only location) -->
          <div class="agent-previews-bar ${WorkspaceState.attachments.length > 0 ? 'visible' : ''}" id="agentPreviewsBar">
            ${WorkspaceState.attachments.map((a, i) => `
              <div class="agent-preview-chip">
                ${a.type === 'image' ? `<img src="${a.dataUrl}" onclick="lightboxImage('${a.dataUrl}')" alt="${escapeHtml(a.name)}">` : `<i class="fas fa-file-alt"></i>`}
                <span>${escapeHtml(a.name)}</span>
                <button onclick="removeAttachment(${i})"><i class="fas fa-times"></i></button>
              </div>
            `).join('')}
          </div>

          <!-- Main composer -->
          <div class="agent-composer" id="agentComposer">
            <!-- Expandable tools row -->
            <div class="agent-tools-row" id="agentToolsRow">
              <button class="agent-tool-btn" onclick="triggerFileUpload()" title="إرفاق ملف (PDF, DOCX, TXT…)">
                <i class="fas fa-paperclip"></i>
              </button>
              <button class="agent-tool-btn" onclick="triggerImageUpload()" title="إرفاق صورة">
                <i class="fas fa-image"></i>
              </button>
              <button class="agent-tool-btn ${WorkspaceState.voiceRecording ? 'recording' : ''}" 
                      id="voiceMicBtn"
                      onclick="toggleVoiceInput()" 
                      title="تسجيل صوتي">
                <i class="fas fa-microphone${WorkspaceState.voiceRecording ? '-slash' : ''}"></i>
              </button>
              <button class="agent-tool-btn" onclick="exportAIChat(WorkspaceState.currentConvId)" title="تصدير المحادثة">
                <i class="fas fa-download"></i>
              </button>
              <span class="agent-tool-label">الأدوات</span>
            </div>

            <!-- Input row -->
            <div class="agent-input-row" ondrop="handleFileDrop(event)" ondragover="handleDragOver(event)" ondragleave="handleDragLeave(event)">
              <!-- Plus toggle -->
              <button class="agent-plus-btn" id="agentPlusBtn" onclick="toggleAgentTools()" title="أدوات">
                <i class="fas fa-plus"></i>
              </button>

              <!-- Textarea -->
              <textarea
                id="aiInputTextarea"
                class="agent-textarea"
                placeholder="اسألني أي شيء أو اطلب مني تنفيذ أي إجراء… (Enter للإرسال، Shift+Enter لسطر جديد)"
                rows="1"
                onkeydown="handleAIInputKeydown(event)"
                oninput="_agentAutoResize(this)"
              ></textarea>

              <!-- Send / Stop button -->
              <button class="agent-send-btn ${WorkspaceState.isGenerating ? 'stop' : ''}"
                      id="aiSendBtn"
                      onclick="${WorkspaceState.isGenerating ? 'stopAIGeneration()' : 'sendAIMessage()'}"
                      title="${WorkspaceState.isGenerating ? 'إيقاف' : 'إرسال'}">
                <i class="fas ${WorkspaceState.isGenerating ? 'fa-stop-circle' : 'fa-paper-plane'}"></i>
              </button>
            </div>
          </div>

          <!-- Quick provider switch -->
          ${renderProviderQuickSwitch()}

          <!-- Footer -->
          <div class="ai-input-footer">
            <span>Enter للإرسال · Shift+Enter لسطر جديد · اسحب الملفات هنا</span>
            <span class="ai-tts-toggle">
              <label class="ai-toggle-sm">
                <input type="checkbox" id="ttsToggle" ${WorkspaceState.ttsEnabled ? 'checked' : ''} onchange="toggleTTS(this.checked)">
                <span class="toggle-slider-sm"></span>
              </label>
              <span>TTS</span>
            </span>
          </div>
        </div>
      </div>
    </div>
    <input type="file" id="aiFileInput" style="display:none" multiple onchange="handleFileInputChange(event)" />
    <input type="file" id="aiImageInput" style="display:none" accept="image/*" multiple onchange="handleImageInputChange(event)" />
  `;

  // ✅ Smart scroll: only scroll to bottom when first rendering or on new conversation
  setTimeout(() => {
    _aiScrollToBottom();
    _aiInitScrollTracking();
  }, 50);
}

function renderModeSelector() {
  const modes = [
    { id: 'chat', icon: 'fa-comments', label: t('ai.workspace.mode.chat') },
    { id: 'study-coach', icon: 'fa-graduation-cap', label: t('ai.workspace.mode.teach') },
    { id: 'deep-think', icon: 'fa-brain', label: t('ai.workspace.mode.analyze') },
    { id: 'research', icon: 'fa-search', label: t('ai.workspace.mode.plan') },
    { id: 'exam-prep', icon: 'fa-clipboard-check', label: t('ai.workspace.mode.teach') },
    { id: 'flashcards', icon: 'fa-layer-group', label: t('ai.workspace.mode.chat') },
    { id: 'mindmap', icon: 'fa-project-diagram', label: t('ai.workspace.mode.plan') },
  ];
  return `
    <div class="ai-mode-tabs">
      ${modes.map(m => `
        <button class="ai-mode-tab ${WorkspaceState.currentMode === m.id ? 'active' : ''}"
                onclick="setAIMode('${m.id}')" title="${m.label}">
          <i class="fas ${m.icon}"></i>
          <span>${m.label}</span>
        </button>
      `).join('')}
    </div>
  `;
}

function renderModelSelector() {
  const provider = AIProviders.getActiveProvider();
  const model = AIProviders.getActiveModel();
  const providers = AIProviders.getEnabled();

  return `
    <div class="ai-model-selector" id="aiModelSelector">
      <button class="ai-model-btn" onclick="toggleModelDropdown()">
        <i class="fas fa-microchip"></i>
        <span>${model?.name || t('ai.settings.activeModel')}</span>
        <i class="fas fa-chevron-down"></i>
      </button>
      <div class="ai-model-dropdown" id="aiModelDropdown" style="display:none">
        ${providers.map(p => `
          <div class="ai-model-group">
            <div class="ai-model-group-label">
              <i class="fas ${p.icon || 'fa-robot'}"></i> ${p.name}
              ${!p.apiKey ? `<span class="no-key-badge">${t('ai.settings.apiKey')}</span>` : ''}
            </div>
            ${(p.models || []).map(m => `
              <button class="ai-model-option ${model?.id === m.id ? 'active' : ''}"
                      onclick="selectModel('${p.id}', '${m.id}')">
                <span class="model-name">${m.name}</span>
                <span class="model-ctx">${m.contextWindow ? (m.contextWindow/1000).toFixed(0)+'k ctx' : ''}</span>
              </button>
            `).join('')}
          </div>
        `).join('')}
        <div class="ai-model-dropdown-footer">
          <button onclick="showAIPage('ai-settings', null); closeModelDropdown()">
            <i class="fas fa-cog"></i> ${t('ai.settings.providers')}
          </button>
        </div>
      </div>
    </div>
  `;
}

function renderConversationList(convs, folders) {
  const query = WorkspaceState.searchQuery;
  const filteredConvs = query ? AIConversations.search(query) : convs;

  const pinned = filteredConvs.filter(c => c.pinned);
  const unpinned = filteredConvs.filter(c => !c.pinned);

  let html = '';

  if (pinned.length > 0) {
    html += `<div class="ai-conv-group"><div class="ai-conv-group-label"><i class="fas fa-thumbtack"></i> ${t('ai.workspace.pinned')}</div>
      ${pinned.map(c => renderConvItem(c)).join('')}
    </div>`;
  }

  // Group by folder
  folders.forEach(folder => {
    const folderConvs = unpinned.filter(c => c.folderId === folder.id);
    if (folderConvs.length > 0) {
      html += `<div class="ai-conv-group">
        <div class="ai-conv-group-label" onclick="toggleFolder('${folder.id}')">
          <i class="fas fa-folder"></i> ${escapeHtml(folder.name)}
          <button class="ai-conv-folder-delete" onclick="deleteFolder('${folder.id}');event.stopPropagation()">
            <i class="fas fa-times"></i>
          </button>
        </div>
        <div class="ai-folder-content" id="folder-${folder.id}">
          ${folderConvs.map(c => renderConvItem(c)).join('')}
        </div>
      </div>`;
    }
  });

  // Ungrouped
  const ungrouped = unpinned.filter(c => !c.folderId);
  if (ungrouped.length > 0) {
    const today = [], yesterday = [], older = [];
    const now = new Date();
    ungrouped.forEach(c => {
      const d = new Date(c.updatedAt);
      const diff = Math.floor((now - d) / 86400000);
      if (diff === 0) today.push(c);
      else if (diff === 1) yesterday.push(c);
      else older.push(c);
    });

    if (today.length > 0) {
      html += `<div class="ai-conv-group"><div class="ai-conv-group-label">${t('ai.workspace.conversations')}</div>${today.map(c => renderConvItem(c)).join('')}</div>`;
    }
    if (yesterday.length > 0) {
      html += `<div class="ai-conv-group"><div class="ai-conv-group-label">${t('ai.analytics.daily')}</div>${yesterday.map(c => renderConvItem(c)).join('')}</div>`;
    }
    if (older.length > 0) {
      html += `<div class="ai-conv-group"><div class="ai-conv-group-label">${t('ai.workspace.loadMore')}</div>${older.map(c => renderConvItem(c)).join('')}</div>`;
    }
  }

  if (filteredConvs.length === 0) {
    html = `<div class="ai-empty-chats">
      <i class="fas fa-comments"></i>
      <p>${query ? t('ai.settings.noLogs') : t('ai.workspace.noConversations')}</p>
    </div>`;
  }

  return html;
}

function renderConvItem(conv) {
  const isActive = conv.id === WorkspaceState.currentConvId;
  const lastMsg = conv.messages[conv.messages.length - 1];
  const lastContent = typeof lastMsg?.content === 'string' ? lastMsg.content : '';
  const preview = lastMsg ? (lastContent.substring(0, 60) || '…') : 'No messages yet';

  return `
    <div class="ai-conv-item ${isActive ? 'active' : ''}" onclick="loadConversation('${conv.id}')"
         data-conv-id="${conv.id}">
      <div class="ai-conv-item-icon">
        <i class="fas fa-comment${conv.pinned ? '-dots' : ''}"></i>
      </div>
      <div class="ai-conv-item-content">
        <div class="ai-conv-item-title">${escapeHtml(conv.title)}</div>
        <div class="ai-conv-item-preview">${escapeHtml(preview)}</div>
      </div>
      <div class="ai-conv-item-actions">
        <button onclick="pinAIChat('${conv.id}');event.stopPropagation()" title="Pin">
          <i class="fas fa-thumbtack ${conv.pinned ? 'pinned' : ''}"></i>
        </button>
        <button onclick="deleteAIChat('${conv.id}');event.stopPropagation()" title="Delete">
          <i class="fas fa-trash"></i>
        </button>
      </div>
    </div>
  `;
}

function renderMessages(messages) {
  return messages.map((msg, i) => renderMessage(msg, i)).join('');
}

function renderMessage(msg, index) {
  const isUser = msg.role === 'user';
  const time = new Date(msg.timestamp || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const attachments = msg.attachments || [];
  const safeId = (msg.id || ('msg_' + index)).replace(/[^a-zA-Z0-9_]/g, '_');
  const userName = (typeof settings !== 'undefined' ? settings.userName : null) || 'U';

  const attachmentHtml = attachments.length > 0 ? `
    <div class="ai-message-attachments">
      ${attachments.map(a => {
        if (a.type === 'image') {
          return `<img src="${a.dataUrl}" alt="${escapeHtml(a.name)}" class="ai-msg-image" onclick="lightboxImage('${a.dataUrl}')">`;
        }
        if (a.type === 'audio') {
          return `<div class="ai-audio-bubble"><i class="fas fa-microphone"></i><audio controls src="${a.dataUrl}" style="height:28px;flex:1"></audio></div>`;
        }
        return `<div class="ai-msg-file"><i class="fas fa-file-alt"></i> ${escapeHtml(a.name)}</div>`;
      }).join('')}
    </div>` : '';

  return `
    <div class="ai-message ${isUser ? 'user' : 'assistant'}" data-msg-id="${safeId}">
      <div class="ai-message-avatar">
        ${isUser
          ? `<div class="ai-avatar-user">${userName[0].toUpperCase()}</div>`
          : `<div class="ai-avatar-ai"><i class="fas fa-brain"></i></div>`}
      </div>
      <div class="ai-message-content">
        ${attachmentHtml}
        <div class="ai-message-bubble">
          <div class="ai-message-text ${isUser ? '' : 'markdown'}">
            ${isUser ? escapeHtml(msg.content || '') : renderMarkdown(msg.content || '')}
          </div>
        </div>
        <div class="ai-message-meta">
          <span class="ai-message-time">${time}</span>
          ${!isUser ? `
            <div class="ai-message-actions">
              <button onclick="copyMessage('${safeId}')" title="نسخ"><i class="fas fa-copy"></i></button>
              <button onclick="speakMessage('${safeId}')" title="قراءة"><i class="fas fa-volume-up"></i></button>
              <button onclick="regenerateMessage(${index})" title="إعادة توليد"><i class="fas fa-redo"></i></button>
              <button onclick="editMessage(${index})" title="تعديل"><i class="fas fa-edit"></i></button>
            </div>
          ` : `
            <div class="ai-message-actions">
              <button onclick="editUserMessage(${index})" title="تعديل"><i class="fas fa-edit"></i></button>
            </div>
          `}
        </div>
      </div>
    </div>
  `;
}

function renderWelcomeScreen() {
  // SESSION 13: If first message already sent in this session, show empty state (no suggestions)
  if (WorkspaceState._chatHasSentMessage) {
    return ''; // Suggestions permanently hidden for this conversation
  }

  const userName = settings.userName || 'Learner';
  const suggestions = [
    { icon: 'fa-calendar-alt', text: t('ai.workspace.sugg2'), prompt: 'Create an optimized study plan for today based on my current schedule.' },
    { icon: 'fa-chart-line', text: t('ai.workspace.sugg1'), prompt: 'Analyze my learning progress this week and give me insights.' },
    { icon: 'fa-lightbulb', text: t('ai.workspace.sugg3'), prompt: 'I need help understanding a concept. Can you help me?' },
    { icon: 'fa-tasks', text: t('ai.workspace.sugg4'), prompt: 'Help me define clear, measurable learning goals for this week.' },
    { icon: 'fa-sync', text: t('ai.workspace.sugg1'), prompt: 'Generate flashcards from my current week\'s study blocks.' },
    { icon: 'fa-project-diagram', text: t('ai.workspace.sugg2'), prompt: 'Create a mind map for the topics I\'m studying this week.' },
  ];

  return `
    <div class="ai-welcome">
      <div class="ai-welcome-logo">
        <div class="ai-welcome-icon"><i class="fas fa-brain"></i></div>
      </div>
      <h2 class="ai-welcome-title">${t('ai.workspace.welcome')}</h2>
      <p class="ai-welcome-subtitle">${t('ai.workspace.welcomeSub')}</p>
      <div class="ai-suggestions-grid">
        ${suggestions.map(s => `
          <button class="ai-suggestion-card" onclick="sendAIMessage('${s.prompt.replace(/'/g, "\\'")}')">
            <i class="fas ${s.icon}"></i>
            <span>${s.text}</span>
          </button>
        `).join('')}
      </div>
    </div>
  `;
}

function renderAttachments() {
  return WorkspaceState.attachments.map((a, i) => `
    <div class="ai-attachment-chip">
      ${a.type === 'image'
        ? `<img src="${a.dataUrl}" alt="${escapeHtml(a.name)}" class="attachment-thumb">`
        : `<i class="fas fa-file"></i>`}
      <span>${escapeHtml(a.name)}</span>
      <button onclick="removeAttachment(${i})"><i class="fas fa-times"></i></button>
    </div>
  `).join('');
}

/* ============================================================
   AGENT COMPOSER HELPERS
   ============================================================ */

function toggleAgentTools() {
  const row = document.getElementById('agentToolsRow');
  const btn = document.getElementById('agentPlusBtn');
  if (!row) return;
  const isOpen = row.classList.contains('open');
  row.classList.toggle('open', !isOpen);
  if (btn) btn.classList.toggle('open', !isOpen);
}

function _agentAutoResize(ta) {
  ta.style.height = 'auto';
  ta.style.height = Math.min(ta.scrollHeight, 240) + 'px';
}
window._agentAutoResize = _agentAutoResize;

/* ============================================================
   WORKSPACE SCROLL SYSTEM
   - Only .ai-messages scrolls
   - Jump-to-bottom button appears when scrolled up
   - Smart auto-scroll: only scrolls when already at bottom
   ============================================================ */

const AI_SCROLL_THRESHOLD = 80; // px from bottom to consider "at bottom"

function _aiIsAtBottom() {
  const msgs = document.getElementById('aiMessages');
  if (!msgs) return true;
  return (msgs.scrollHeight - msgs.scrollTop - msgs.clientHeight) <= AI_SCROLL_THRESHOLD;
}

function _aiScrollToBottom() {
  const msgs = document.getElementById('aiMessages');
  if (!msgs) return;
  msgs.scrollTop = msgs.scrollHeight;
  _aiHideJumpBtn();
}

function _aiSmartScrollToBottom() {
  if (_aiIsAtBottom()) {
    _aiScrollToBottom();
  } else {
    _aiShowJumpBtn();
  }
}

function _aiShowJumpBtn() {
  const btn = document.getElementById('aiJumpToBottom');
  if (btn) btn.classList.remove('hidden');
}

function _aiHideJumpBtn() {
  const btn = document.getElementById('aiJumpToBottom');
  if (btn) btn.classList.add('hidden');
}

function _aiWorkspaceScrollHandler() {
  if (_aiIsAtBottom()) {
    _aiHideJumpBtn();
  } else {
    _aiShowJumpBtn();
  }
}

function _aiInitScrollTracking() {
  const msgs = document.getElementById('aiMessages');
  if (!msgs) return;
  // Already wired via onscroll attribute in HTML
}

/* ✅ FIX: Single attachment display — only agentPreviewsBar, aiAttachmentsPreview REMOVED */
function updateAttachmentsPreview() {
  const bar = document.getElementById('agentPreviewsBar');
  const atts = WorkspaceState.attachments;

  if (bar) {
    bar.className = 'agent-previews-bar' + (atts.length > 0 ? ' visible' : '');
    bar.innerHTML = atts.map((a, i) => `
      <div class="agent-preview-chip">
        ${a.type === 'image'
          ? `<img src="${a.dataUrl}" onclick="lightboxImage('${a.dataUrl}')" alt="${escapeHtml(a.name)}" title="${escapeHtml(a.name)}">`
          : `<i class="fas fa-${_getFileIcon(a)}"></i>`}
        <span>${escapeHtml(a.name)}</span>
        ${a.textContent ? `<span class="chip-read-badge" title="تم القراءة"><i class="fas fa-check-circle"></i></span>` : ''}
        <button onclick="removeAttachment(${i})" title="إزالة"><i class="fas fa-times"></i></button>
      </div>
    `).join('');
  }

  // Hide any legacy element that might exist
  const legacy = document.getElementById('aiAttachmentsPreview');
  if (legacy) legacy.style.display = 'none';
}

function _getFileIcon(att) {
  if (att.type === 'image') return 'image';
  const ext = (att.name || '').split('.').pop().toLowerCase();
  if (ext === 'pdf') return 'file-pdf';
  if (['doc', 'docx'].includes(ext)) return 'file-word';
  if (['xls', 'xlsx'].includes(ext)) return 'file-excel';
  if (['ppt', 'pptx'].includes(ext)) return 'file-powerpoint';
  if (['txt', 'md'].includes(ext)) return 'file-alt';
  if (['js', 'py', 'ts', 'html', 'css'].includes(ext)) return 'file-code';
  return 'file-alt';
}

// Override the old updateAttachmentsUI
window.updateAttachmentsUI = updateAttachmentsPreview;

function editMessage(index) {
  const conv = WorkspaceState.currentConvId ? AIConversations.getById(WorkspaceState.currentConvId) : null;
  if (!conv) return;
  const msg = conv.messages[index];
  if (!msg || msg.role !== 'assistant') return;
  const newContent = prompt('تعديل الرسالة:', msg.content);
  if (newContent === null) return;
  msg.content = newContent;
  AIConversations.update(WorkspaceState.currentConvId, { messages: conv.messages });
  renderAIWorkspacePage();
}

function editUserMessage(index) {
  const conv = WorkspaceState.currentConvId ? AIConversations.getById(WorkspaceState.currentConvId) : null;
  if (!conv) return;
  const msg = conv.messages[index];
  if (!msg || msg.role !== 'user') return;
  const ta = document.getElementById('aiInputTextarea');
  if (ta) {
    ta.value = msg.content || '';
    _agentAutoResize(ta);
    ta.focus();
  }
}

/* ============================================================
   WORKSPACE ACTIONS
   ============================================================ */

function aiNewChat() {
  WorkspaceState.currentConvId = null;
  WorkspaceState.attachments = [];
  // SESSION 13: Reset suggestion-hide state — new conversation shows suggestions again
  WorkspaceState._chatHasSentMessage = false;
  renderAIWorkspacePage();
}

function loadConversation(id) {
  WorkspaceState.currentConvId = id;
  // If the loaded conversation already has messages, mark as sent so suggestions stay hidden
  const conv = AIConversations.getById(id);
  WorkspaceState._chatHasSentMessage = !!(conv && conv.messages && conv.messages.length > 0);
  renderAIWorkspacePage();
  closeMobileAISidebar();
}

async function sendAIMessage(overrideText) {
  if (WorkspaceState.isGenerating) return;

  const textarea = document.getElementById('aiInputTextarea');
  const text = overrideText || (textarea ? textarea.value.trim() : '');
  if (!text && WorkspaceState.attachments.length === 0) return;

  // Create conversation if needed
  if (!WorkspaceState.currentConvId) {
    const safeText = typeof text === 'string' ? text : '';
    const conv = AIConversations.create(safeText.substring(0, 50) || 'New Chat');
    WorkspaceState.currentConvId = conv.id;
  }

  const attachments = [...WorkspaceState.attachments];
  WorkspaceState.attachments = [];

  // ── Clear composer UI immediately after grabbing attachments ──
  if (textarea) {
    textarea.value = '';
    textarea.style.height = 'auto';
  }
  // ✅ FIX: Clear only agentPreviewsBar (single display point)
  const previewBar = document.getElementById('agentPreviewsBar');
  if (previewBar) { previewBar.className = 'agent-previews-bar'; previewBar.innerHTML = ''; }

  // SESSION 13: Hide suggestion cards on first message — never show again until new conversation
  if (!WorkspaceState._chatHasSentMessage) {
    WorkspaceState._chatHasSentMessage = true;
    const welcome = document.querySelector('.ai-welcome');
    if (welcome) {
      welcome.classList.add('suggestions-hiding');
      setTimeout(() => {
        if (welcome.parentNode) welcome.remove();
      }, 320);
    }
  }

  // Build message content — document text is appended for context
  let messageContent = text;
  const visionImages = []; // {type:'base64'/'url', mediaType, data/url}

  if (attachments.length > 0) {
    const attachmentTexts = attachments.map(a => {
      if (a.type === 'image') {
        // Collect for vision API payload
        if (a.dataUrl) visionImages.push({ mediaType: a.mimeType || 'image/jpeg', data: a.dataUrl.split(',')[1] || a.dataUrl });
        return `\n\n[Image attached: ${a.name}]`;
      }
      if (a.type === 'audio') return `\n\n[Audio recording attached]`;
      if (a.textContent) return `\n\n[Attached file: ${a.name}]\n\`\`\`\n${a.textContent.substring(0, 8000)}\n\`\`\``;
      return `\n\n[Attachment: ${a.name}]`;
    }).join('');
    messageContent = text + attachmentTexts;
  }

  // Add user message to UI immediately
  AIConversations.addMessage(WorkspaceState.currentConvId, {
    role: 'user',
    content: text,
    attachments
  });

  // Update UI
  const msgs = document.getElementById('aiMessages');
  const convList = document.getElementById('aiConvList');
  const conv = AIConversations.getById(WorkspaceState.currentConvId);

  // Declare typingId at function scope so streaming callbacks can reference it
  let typingId = null;

  if (msgs) {
    // Add user message
    const userMsgHtml = renderMessage(conv.messages[conv.messages.length - 1], conv.messages.length - 1);
    msgs.insertAdjacentHTML('beforeend', userMsgHtml);

    // Add AI typing indicator
    typingId = 'typing_' + Date.now();
    msgs.insertAdjacentHTML('beforeend', `
      <div class="ai-message assistant typing-indicator" id="${typingId}">
        <div class="ai-message-avatar"><div class="ai-avatar-ai"><i class="fas fa-brain"></i></div></div>
        <div class="ai-message-content">
          <div class="ai-message-bubble">
            <div class="ai-typing-dots"><span></span><span></span><span></span></div>
          </div>
        </div>
      </div>
    `);
    _aiScrollToBottom(); // always scroll when user sends a message
  }

  // Update send button
  const sendBtn = document.getElementById('aiSendBtn');
  if (sendBtn) sendBtn.innerHTML = '<i class="fas fa-stop-circle"></i>';

  WorkspaceState.isGenerating = true;

  // Get conversation history (without system prompt)
  const history = conv.messages.slice(0, -1).map(m => ({
    role: m.role,
    content: m.content
  }));

  // Build message with mode context
  const modePrompts = {
    'study-coach': 'As my study coach, ',
    'deep-think': 'Think step by step deeply about this. ',
    'research': 'Research and provide comprehensive information about: ',
    'exam-prep': 'As an exam preparation assistant, ',
    'flashcards': 'Generate flashcards for: ',
    'mindmap': 'Create a structured mind map for: ',
  };
  const modePrefix = modePrompts[WorkspaceState.currentMode] || '';
  const finalMessage = modePrefix ? modePrefix + messageContent : messageContent;

  // If there are vision images, build a multipart content array for the API
  // The engine's sendMessageStream will detect this and send to vision endpoint
  const visionPayload = visionImages.length > 0 ? visionImages : null;

  let fullResponse = '';
  const typingEl = document.getElementById(typingId);

  AIChat.sendMessageStream(
    finalMessage,
    history,
    (delta, full) => {
      fullResponse = full;
      if (typingEl) {
        // Strip [TOOL:...] tags from streaming preview
        const displayText = _stripToolSyntax(full);
        typingEl.classList.remove('typing-indicator');
        typingEl.querySelector('.ai-message-content').innerHTML = `
          <div class="ai-message-bubble">
            <div class="ai-message-text markdown">${renderMarkdown(displayText || '…')}</div>
          </div>
          <div class="ai-message-meta"><span class="ai-message-time">…</span></div>
        `;
        if (msgs) _aiSmartScrollToBottom(); // smart scroll during streaming
      }
    },
    (fullText) => {
      WorkspaceState.isGenerating = false;

      // Guard: never save or render an empty assistant message
      console.log('[sendAIMessage] onDone called. fullText length:', typeof fullText === 'string' ? fullText.length : 'NOT_STRING', 'preview:', typeof fullText === 'string' ? fullText.substring(0, 100) : fullText);

      if (typeof fullText !== 'string' || !fullText.trim()) {
        console.error('[sendAIMessage] onDone received empty/invalid fullText — showing error bubble instead');
        if (typingEl) {
          typingEl.querySelector('.ai-message-content').innerHTML = `
            <div class="ai-message-text error-msg">
              <i class="fas fa-exclamation-circle"></i>
              <strong>${t('ai.error.emptyResponse') || 'Empty Response'}</strong>: The AI returned no content. Please try again.
              <br><small>Check your <a href="#" onclick="showPage('ai-settings',null)">AI Settings</a> or try a different model.</small>
            </div>
          `;
        }
        if (sendBtn) sendBtn.innerHTML = '<i class="fas fa-paper-plane"></i>';
        return;
      }

      // ── STEP 1: Execute ALL tool calls FIRST — using AIAgentCore ──
      let toolsExecuted = [];
      try {
        if (window.AIActionEngine) {
          toolsExecuted = AIActionEngine.parseAndExecute(fullText);
        } else if (window.AIAgent) {
          toolsExecuted = AIAgent.parseAndExecuteTools(fullText);
        }
        if (toolsExecuted.length > 0) {
          console.log('[sendAIMessage] Tools executed:', toolsExecuted.map(t => `${t.tool}→${t.result?.success ? 'OK' : 'FAIL'}`));
        }
      } catch (toolErr) {
        console.error('[sendAIMessage] Tool execution error:', toolErr);
      }

      // ── STEP 2: Strip [TOOL:...] tags from displayed content ──
      const displayText = _stripToolSyntax(fullText).trim();

      // Build tool badge HTML for executed tools
      const toolBadgesHtml = toolsExecuted.length > 0 ? `
        <div class="ai-tool-badges">
          ${toolsExecuted.map(t => {
            const ok = t.result?.success !== false;
            return `<span class="ai-tool-badge ${ok ? 'success' : 'error'}">
              <i class="fas ${ok ? 'fa-check-circle' : 'fa-times-circle'}"></i>
              ${t.tool}${!ok && t.result?.error ? ': ' + escapeHtml(String(t.result.error).substring(0, 60)) : ''}
            </span>`;
          }).join('')}
        </div>` : '';

      // ✅ FIX: Natural fallback — no robotic "✅ تم التنفيذ"
      // If tools executed but no display text, the AI was silent after acting (that's OK)
      const finalDisplayText = displayText.length > 0 ? displayText : fullText.trim();

      // Save AI response to conversation (clean text only)
      AIConversations.addMessage(WorkspaceState.currentConvId, {
        role: 'assistant',
        content: finalDisplayText
      });

      // Update typing element to final message with tool badges
      if (typingEl) {
        const savedConv = AIConversations.getById(WorkspaceState.currentConvId);
        const lastMsg = savedConv.messages[savedConv.messages.length - 1];
        const msgHtml = renderMessage(lastMsg, savedConv.messages.length - 1);
        // Inject tool badges before the message bubble
        const withBadges = toolBadgesHtml ? msgHtml.replace(
          '<div class="ai-message-bubble">',
          toolBadgesHtml + '<div class="ai-message-bubble">'
        ) : msgHtml;
        typingEl.outerHTML = withBadges;
      }

      if (msgs) _aiSmartScrollToBottom(); // smart scroll after response

      // After AI responds, learn from conversation for long-term memory
      if (window.AIMemoryContextBuilder) {
        try {
          const userInput = text || '';
          AIMemoryContextBuilder.learnFromConversation(userInput, finalDisplayText);
        } catch (e) { /* silent */ }
      }

      // Update send button
      if (sendBtn) sendBtn.innerHTML = '<i class="fas fa-paper-plane"></i>';

      // TTS
      if (WorkspaceState.ttsEnabled && typeof fullText === 'string' && fullText) {
        speakText(fullText.substring(0, 500));
      }

      // Update conversation list title
      if (convList) {
        const updated = AIConversations.getAll();
        const folders = AIConversations.getFolders();
        convList.innerHTML = renderConversationList(updated, folders);
      }

      // Update page title
      const titleEl = document.getElementById('aiChatTitle');
      if (titleEl) {
        const updatedConv = AIConversations.getById(WorkspaceState.currentConvId);
        if (updatedConv) titleEl.textContent = updatedConv.title;
      }
    },
    (error) => {
      WorkspaceState.isGenerating = false;
      if (typingEl) {
        typingEl.querySelector('.ai-message-content').innerHTML = `
          <div class="ai-message-text error-msg">
            <i class="fas fa-exclamation-circle"></i>
            <strong>Error:</strong> ${escapeHtml(error.message)}
            <br><small>Please check your API key in <a href="#" onclick="showPage('ai-settings',null)">AI Settings</a></small>
          </div>
        `;
      }
      if (sendBtn) sendBtn.innerHTML = '<i class="fas fa-paper-plane"></i>';
    },
    visionPayload  // 6th arg: vision images (null if none)
  );
}

function stopAIGeneration() {
  WorkspaceState.isGenerating = false;
  const sendBtn = document.getElementById('aiSendBtn');
  if (sendBtn) sendBtn.innerHTML = '<i class="fas fa-paper-plane"></i>';
  showToast('Generation stopped', 'info');
}

function handleAIInputKeydown(e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendAIMessage();
  }
}

function autoResizeTextarea(textarea) {
  textarea.style.height = 'auto';
  const maxH = 200;
  textarea.style.height = Math.min(textarea.scrollHeight, maxH) + 'px';
}

function setAIMode(mode) {
  WorkspaceState.currentMode = mode;
  renderAIWorkspacePage();
}

// Model selector — PORTAL IMPLEMENTATION
// The dropdown is rendered into document.body with position:fixed so it is NEVER
// clipped by any overflow:hidden parent, and always sits above suggestion cards.
const _MODEL_PORTAL_ID = 'aiModelDropdownPortal';

function _buildModelPortal() {
  // Remove stale portal
  const existing = document.getElementById(_MODEL_PORTAL_ID);
  if (existing) existing.remove();

  const provider = AIProviders.getActiveProvider();
  const model = AIProviders.getActiveModel();
  const providers = AIProviders.getEnabled();

  const portal = document.createElement('div');
  portal.id = _MODEL_PORTAL_ID;
  portal.className = 'ai-model-dropdown-portal';
  portal.innerHTML = `
    ${providers.map(p => `
      <div class="ai-model-group">
        <div class="ai-model-group-label">
          <i class="fas ${p.icon || 'fa-robot'}"></i> ${p.name}
          ${!p.apiKey ? `<span class="no-key-badge">No Key</span>` : ''}
        </div>
        ${(p.models || []).map(m => `
          <button class="ai-model-option ${model?.id === m.id ? 'active' : ''}"
                  onclick="selectModel('${p.id}', '${m.id}')">
            <span class="model-name">${m.name}</span>
            <span class="model-ctx">${m.contextWindow ? (m.contextWindow/1000).toFixed(0)+'k ctx' : ''}</span>
          </button>
        `).join('')}
      </div>
    `).join('')}
    <div class="ai-model-dropdown-footer">
      <button onclick="showAIPage('ai-settings', null); closeModelDropdown()">
        <i class="fas fa-cog"></i> Provider Settings
      </button>
    </div>
  `;
  document.body.appendChild(portal);
  return portal;
}

function _positionModelPortal(btn) {
  const portal = document.getElementById(_MODEL_PORTAL_ID);
  if (!portal || !btn) return;
  const rect = btn.getBoundingClientRect();
  const isRTL = document.documentElement.getAttribute('dir') === 'rtl';

  portal.style.position = 'fixed';
  portal.style.zIndex = '2147483647'; // max z-index — above everything
  portal.style.maxHeight = '400px';
  portal.style.overflowY = 'auto';

  // Position: open UPWARD if button is in lower half of screen
  const spaceBelow = window.innerHeight - rect.bottom;
  const spaceAbove = rect.top;
  const portalHeight = Math.min(400, portal.scrollHeight || 300);

  if (spaceBelow >= portalHeight || spaceBelow >= spaceAbove) {
    // Open downward
    portal.style.top = (rect.bottom + 6) + 'px';
    portal.style.bottom = 'auto';
  } else {
    // Open upward
    portal.style.bottom = (window.innerHeight - rect.top + 6) + 'px';
    portal.style.top = 'auto';
  }

  if (isRTL) {
    portal.style.left = Math.max(8, rect.left) + 'px';
    portal.style.right = 'auto';
  } else {
    const rightEdge = window.innerWidth - rect.right;
    portal.style.right = Math.max(8, rightEdge) + 'px';
    portal.style.left = 'auto';
  }
  portal.style.width = '300px';
}

function toggleModelDropdown() {
  const existing = document.getElementById(_MODEL_PORTAL_ID);
  if (existing) {
    closeModelDropdown();
    return;
  }
  const btn = document.querySelector('#aiModelSelector .ai-model-btn');
  const portal = _buildModelPortal();
  _positionModelPortal(btn);
  portal.style.display = 'block';

  // Close on scroll or resize
  const _close = () => closeModelDropdown();
  window.addEventListener('scroll', _close, { once: true, passive: true });
  window.addEventListener('resize', _close, { once: true, passive: true });
}

function closeModelDropdown() {
  const portal = document.getElementById(_MODEL_PORTAL_ID);
  if (portal) portal.remove();
  // Also hide legacy inline dropdown if present
  const dd = document.getElementById('aiModelDropdown');
  if (dd) dd.style.display = 'none';
}

function selectModel(providerId, modelId) {
  AIProviders.setActive(providerId, modelId);
  closeModelDropdown();
  renderAIWorkspacePage();
  showToast('Model selected', 'success');
}

document.addEventListener('click', (e) => {
  // Close model portal when clicking outside model selector OR portal itself
  if (!e.target.closest('#aiModelSelector') && !e.target.closest('#' + _MODEL_PORTAL_ID)) {
    closeModelDropdown();
  }
});

// Conversation actions
function pinAIChat(id) {
  AIConversations.pin(id);
  renderAIWorkspacePage();
}

function exportAIChat(id) {
  AIConversations.export(id);
  showToast('Chat exported', 'success');
}

function deleteAIChat(id) {
  if (!confirm('Delete this conversation?')) return;
  AIConversations.delete(id);
  if (WorkspaceState.currentConvId === id) WorkspaceState.currentConvId = null;
  renderAIWorkspacePage();
  showToast('Conversation deleted', 'info');
}

function searchAIChats(query) {
  WorkspaceState.searchQuery = query;
  const convList = document.getElementById('aiConvList');
  if (convList) {
    const convs = AIConversations.getAll();
    const folders = AIConversations.getFolders();
    convList.innerHTML = renderConversationList(convs, folders);
  }
}

function toggleAISidebar() {
  const sidebar = document.getElementById('aiSidebar');
  if (sidebar) sidebar.classList.toggle('collapsed');
}

function closeMobileAISidebar() {
  if (window.innerWidth <= 768) {
    const sidebar = document.getElementById('aiSidebar');
    if (sidebar) sidebar.classList.add('collapsed');
  }
}

function toggleFolder(id) {
  const content = document.getElementById('folder-' + id);
  if (content) content.classList.toggle('collapsed');
}

function deleteFolder(id) {
  if (!confirm('Delete this folder? Chats will be ungrouped.')) return;
  AIConversations.deleteFolder(id);
  renderAIWorkspacePage();
}

// Message actions
function copyMessage(msgId) {
  const conv = AIConversations.getById(WorkspaceState.currentConvId);
  const msg = conv?.messages.find(m => m.id === msgId);
  if (msg) {
    navigator.clipboard.writeText(msg.content);
    showToast('Copied to clipboard', 'success');
  }
}

function speakMessage(msgId) {
  const conv = AIConversations.getById(WorkspaceState.currentConvId);
  const msg = conv?.messages.find(m => m.id === msgId);
  if (msg) speakText(msg.content);
}

function regenerateMessage(index) {
  const conv = AIConversations.getById(WorkspaceState.currentConvId);
  if (!conv || conv.messages.length < 2) return;
  // Remove last AI message and resend
  const lastUserMsg = [...conv.messages].reverse().find(m => m.role === 'user');
  if (lastUserMsg) sendAIMessage(lastUserMsg.content);
}

// File handling
function triggerFileUpload() {
  document.getElementById('aiFileInput')?.click();
}

function triggerImageUpload() {
  document.getElementById('aiImageInput')?.click();
}

/* ✅ FIX: Single file upload handler — saves to session memory, updates only agentPreviewsBar */
async function handleFileInputChange(e) {
  const files = Array.from(e.target.files);
  for (const file of files) {
    const doc = await AIDocuments.analyzeFile(file);
    WorkspaceState.attachments.push(doc);
    // ✅ Save to session memory for file context
    _saveFileToSessionMemory(doc);
  }
  updateAttachmentsPreview(); // single display point
  e.target.value = '';
}

async function handleImageInputChange(e) {
  const files = Array.from(e.target.files);
  for (const file of files) {
    const doc = await AIDocuments.analyzeFile(file);
    WorkspaceState.attachments.push(doc);
    // ✅ Save to session memory
    _saveFileToSessionMemory(doc);
  }
  updateAttachmentsPreview(); // single display point
  e.target.value = '';
}

/* ✅ Save file to session memory so AI remembers it across the session */
function _saveFileToSessionMemory(doc) {
  if (!doc) return;
  const fileRecord = {
    name: doc.name,
    type: doc.type || 'file',
    mimeType: doc.mimeType,
    size: doc.size,
    uploadedAt: new Date().toISOString(),
    textContent: doc.textContent ? doc.textContent.substring(0, 3000) : null,
    summary: doc.textContent
      ? doc.textContent.substring(0, 200).replace(/\n+/g, ' ').trim()
      : (doc.type === 'image' ? 'صورة مرفوعة' : 'ملف مرفق'),
    dataUrl: doc.type === 'image' ? doc.dataUrl : null
  };

  // Save to 3-layer session memory
  if (window.AISessionMemoryEngine) {
    window.AISessionMemoryEngine.addFile(fileRecord);
  }

  // Also update legacy window.AISessionMemory for backward compat
  if (window.AISessionMemory) {
    window.AISessionMemory.lastFile = fileRecord;
    if (!window.AISessionMemory.files) window.AISessionMemory.files = [];
    window.AISessionMemory.files.unshift(fileRecord);
  }

  // Also update _sessionContext for ai-workspace-integration
  if (window._sessionContext) {
    window._sessionContext.lastFile = fileRecord;
  }

  console.log('[FileMemory] Saved to session:', doc.name);
}

/* ✅ FIX: updateAttachmentsUI now delegates to updateAttachmentsPreview (single display) */
function updateAttachmentsUI() {
  updateAttachmentsPreview();
}

function removeAttachment(index) {
  WorkspaceState.attachments.splice(index, 1);
  updateAttachmentsPreview();
}

function handleFileDrop(e) {
  e.preventDefault();
  e.currentTarget.classList.remove('drag-active');
  document.getElementById('aiDragOverlay').style.display = 'none';
  const files = Array.from(e.dataTransfer.files);
  files.forEach(async file => {
    const doc = await AIDocuments.analyzeFile(file);
    WorkspaceState.attachments.push(doc);
    updateAttachmentsUI();
  });
}

function handleDragOver(e) {
  e.preventDefault();
  e.currentTarget.classList.add('drag-active');
  const overlay = document.getElementById('aiDragOverlay');
  if (overlay) overlay.style.display = 'flex';
}

function handleDragLeave(e) {
  e.currentTarget.classList.remove('drag-active');
  const overlay = document.getElementById('aiDragOverlay');
  if (overlay) overlay.style.display = 'none';
}

// Voice input
function toggleVoiceInput() {
  if (WorkspaceState.voiceRecording) {
    stopVoiceRecording();
  } else {
    startVoiceRecording();
  }
}

function startVoiceRecording() {
  if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
    showToast('Speech recognition not supported in this browser', 'error');
    return;
  }
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  WorkspaceState.speechRecognition = new SR();
  WorkspaceState.speechRecognition.continuous = true;
  WorkspaceState.speechRecognition.interimResults = true;
  WorkspaceState.speechRecognition.lang = typeof currentLang !== 'undefined' && currentLang === 'ar' ? 'ar-SA' : 'en-US';

  WorkspaceState.speechRecognition.onresult = (e) => {
    const transcript = Array.from(e.results).map(r => r[0].transcript).join('');
    const textarea = document.getElementById('aiInputTextarea');
    if (textarea) {
      textarea.value = transcript;
      autoResizeTextarea(textarea);
    }
  };

  WorkspaceState.speechRecognition.onerror = () => stopVoiceRecording();
  WorkspaceState.speechRecognition.start();
  WorkspaceState.voiceRecording = true;

  const btn = document.querySelector('.ai-input-tool.recording, .ai-input-tool[onclick="toggleVoiceInput()"]');
  if (btn) {
    btn.classList.add('recording');
    btn.innerHTML = '<i class="fas fa-microphone-slash"></i>';
  }
  showToast('🎤 Listening...', 'info');
}

function stopVoiceRecording() {
  if (WorkspaceState.speechRecognition) {
    WorkspaceState.speechRecognition.stop();
    WorkspaceState.speechRecognition = null;
  }
  WorkspaceState.voiceRecording = false;
  const btn = document.querySelector('.ai-input-tool.recording');
  if (btn) {
    btn.classList.remove('recording');
    btn.innerHTML = '<i class="fas fa-microphone"></i>';
  }
}

// TTS
function toggleTTS(enabled) {
  WorkspaceState.ttsEnabled = enabled;
  if (!enabled && window.speechSynthesis) window.speechSynthesis.cancel();
}

function speakText(text) {
  if (!window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text.replace(/[#*`]/g, ''));
  utterance.lang = typeof currentLang !== 'undefined' && currentLang === 'ar' ? 'ar-SA' : 'en-US';
  utterance.rate = 1.0;
  window.speechSynthesis.speak(utterance);
}

function lightboxImage(src) {
  const overlay = document.createElement('div');
  overlay.className = 'ai-lightbox';
  overlay.innerHTML = `<img src="${src}" alt=""><button onclick="this.parentElement.remove()"><i class="fas fa-times"></i></button>`;
  overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
  document.body.appendChild(overlay);
}

/* ============================================================
   AI SETTINGS PAGE
   ============================================================ */

function renderAISettingsPage() {
  const container = document.getElementById('page-ai-settings');
  if (!container) return;

  const providers = AIProviders.getAll();

  container.innerHTML = `
    <div class="page-header">
      <div class="page-title">
        <h1><i class="fas fa-robot"></i> ${t('ai.settings.title')}</h1>
        <p>${t('ai.settings.providers')}</p>
      </div>
      <div class="page-actions">
        <button class="btn-primary" onclick="openAddProviderModal()">
          <i class="fas fa-plus"></i> ${t('ai.settings.addProvider')}
        </button>
      </div>
    </div>

    <div class="ai-providers-grid">
      ${providers.map(p => renderProviderCard(p)).join('')}
    </div>

    <!-- Add/Edit Provider Modal -->
    <div class="modal-overlay" id="providerModal" style="display:none">
      <div class="modal glass-card" style="max-width:600px;width:100%">
        <div class="modal-header">
          <h3 id="providerModalTitle">${t('ai.settings.addProvider')}</h3>
          <button onclick="closeProviderModal()"><i class="fas fa-times"></i></button>
        </div>
        <div id="providerModalBody"></div>
      </div>
    </div>

    <!-- Add/Edit Model Modal -->
    <div class="modal-overlay" id="modelModal" style="display:none">
      <div class="modal glass-card" style="max-width:550px;width:100%">
        <div class="modal-header">
          <h3 id="modelModalTitle">${t('ai.settings.addModel')}</h3>
          <button onclick="closeModelModal()"><i class="fas fa-times"></i></button>
        </div>
        <div id="modelModalBody"></div>
      </div>
    </div>
  `;
}

function renderProviderCard(provider) {
  const models = provider.models || [];
  return `
    <div class="ai-provider-card glass-card ${provider.enabled ? '' : 'disabled'}">
      <div class="ai-provider-header">
        <div class="ai-provider-icon" style="background:${provider.color}20;color:${provider.color}">
          <i class="fas ${provider.icon || 'fa-robot'}"></i>
        </div>
        <div class="ai-provider-info">
          <h3>${escapeHtml(provider.name)}</h3>
          <span class="ai-provider-url">${provider.baseUrl}</span>
        </div>
        <div class="ai-provider-actions">
          <label class="toggle">
            <input type="checkbox" ${provider.enabled ? 'checked' : ''} 
                   onchange="toggleProvider('${provider.id}', this.checked)">
            <span class="toggle-slider"></span>
          </label>
          <button class="btn-icon" onclick="openEditProviderModal('${provider.id}')" aria-label="تعديل المزود" title="تعديل">
            <i class="fas fa-edit" aria-hidden="true"></i>
          </button>
          <button class="btn-icon danger" onclick="deleteProvider('${provider.id}')" aria-label="حذف المزود" title="حذف">
            <i class="fas fa-trash" aria-hidden="true"></i>
          </button>
        </div>
      </div>

      <div class="ai-provider-key">
        <div class="api-key-field">
          <i class="fas fa-key"></i>
          <input type="password" 
                 value="${provider.apiKey || ''}"
                 placeholder="Enter API Key..."
                 class="setting-input api-key-input"
                 onchange="saveProviderApiKey('${provider.id}', this.value)"
                 id="key-${provider.id}" />
          <button onclick="toggleKeyVisibility('key-${provider.id}')">
            <i class="fas fa-eye"></i>
          </button>
        </div>
      </div>

      <div class="ai-provider-models">
        <div class="ai-models-header">
          <span>${models.length} ${t('ai.settings.models')}</span>
          <button class="btn-sm" onclick="openAddModelModal('${provider.id}')">
            <i class="fas fa-plus"></i> ${t('ai.settings.addModel')}
          </button>
        </div>
        <div class="ai-models-list">
          ${models.map(m => renderModelItem(provider.id, m)).join('')}
        </div>
      </div>
    </div>
  `;
}

function renderModelItem(providerId, model) {
  return `
    <div class="ai-model-item">
      <div class="ai-model-item-info">
        <span class="ai-model-item-name">${escapeHtml(model.name)}</span>
        <span class="ai-model-item-id">${escapeHtml(model.id)}</span>
        <div class="ai-model-badges">
          ${model.contextWindow ? `<span class="model-badge">${(model.contextWindow/1000).toFixed(0)}k ctx</span>` : ''}
          ${model.inputCost > 0 ? `<span class="model-badge cost">$${model.inputCost}/$${model.outputCost}/M</span>` : '<span class="model-badge free">Free</span>'}
        </div>
      </div>
      <div class="ai-model-item-actions">
        <button onclick="openEditModelModal('${providerId}', '${model.id}')">
          <i class="fas fa-edit"></i>
        </button>
        <button onclick="deleteModel('${providerId}', '${model.id}')">
          <i class="fas fa-trash"></i>
        </button>
      </div>
    </div>
  `;
}

// Provider CRUD
function openAddProviderModal() {
  WorkspaceState.editingProvider = null;
  document.getElementById('providerModalTitle').textContent = t('ai.settings.addProvider');
  document.getElementById('providerModalBody').innerHTML = renderProviderForm(null);
  document.getElementById('providerModal').style.display = 'flex';
}

function openEditProviderModal(id) {
  const provider = AIProviders.getById(id);
  WorkspaceState.editingProvider = id;
  document.getElementById('providerModalTitle').textContent = t('ai.settings.editProvider');
  document.getElementById('providerModalBody').innerHTML = renderProviderForm(provider);
  document.getElementById('providerModal').style.display = 'flex';
}

function renderProviderForm(provider) {
  return `
    <div class="modal-body">
      <div class="form-group">
        <label>${t('ai.settings.providerName')}</label>
        <input type="text" id="pf-name" class="setting-input" value="${provider?.name || ''}" placeholder="e.g. My Custom AI">
      </div>
      <div class="form-group">
        <label>${t('ai.settings.baseUrl')}</label>
        <input type="text" id="pf-url" class="setting-input" value="${provider?.baseUrl || ''}" placeholder="https://api.example.com/v1">
      </div>
      <div class="form-group">
        <label>${t('ai.settings.apiKey')}</label>
        <input type="password" id="pf-key" class="setting-input" value="${provider?.apiKey || ''}" placeholder="sk-...">
      </div>
      <div class="form-group">
        <label>Icon (FontAwesome class)</label>
        <input type="text" id="pf-icon" class="setting-input" value="${provider?.icon || 'fa-robot'}" placeholder="fa-robot">
      </div>
      <div class="form-group">
        <label>Color</label>
        <input type="color" id="pf-color" class="setting-input" value="${provider?.color || '#6366f1'}" style="height:40px;padding:4px">
      </div>
      <div class="modal-actions">
        <button class="btn-secondary" onclick="closeProviderModal()">Cancel</button>
        <button class="btn-primary" onclick="saveProvider()">Save Provider</button>
      </div>
    </div>
  `;
}

function saveProvider() {
  const name = document.getElementById('pf-name').value.trim();
  const baseUrl = document.getElementById('pf-url').value.trim();
  const apiKey = document.getElementById('pf-key').value.trim();
  const icon = document.getElementById('pf-icon').value.trim();
  const color = document.getElementById('pf-color').value;

  if (!name || !baseUrl) { showToast('Name and Base URL are required', 'error'); return; }

  if (WorkspaceState.editingProvider) {
    const provider = AIProviders.getById(WorkspaceState.editingProvider);
    AIProviders.save({ ...provider, name, baseUrl, apiKey, icon, color });
  } else {
    const provider = {
      id: 'custom_' + Date.now(),
      name, baseUrl, apiKey, icon, color,
      enabled: true, isDefault: false,
      models: []
    };
    AIProviders.save(provider);
  }

  closeProviderModal();
  renderAISettingsPage();
  showToast('Provider saved', 'success');
}

function closeProviderModal() {
  document.getElementById('providerModal').style.display = 'none';
}

function toggleProvider(id, enabled) {
  const provider = AIProviders.getById(id);
  if (provider) AIProviders.save({ ...provider, enabled });
  renderAISettingsPage();
}

function saveProviderApiKey(id, key) {
  const provider = AIProviders.getById(id);
  if (provider) AIProviders.save({ ...provider, apiKey: key });
  showToast('API key saved', 'success');
}

function deleteProvider(id) {
  if (!confirm('Delete this provider?')) return;
  AIProviders.delete(id);
  renderAISettingsPage();
  showToast('Provider deleted', 'info');
}

function toggleKeyVisibility(inputId) {
  const input = document.getElementById(inputId);
  if (input) input.type = input.type === 'password' ? 'text' : 'password';
}

// Model CRUD
function openAddModelModal(providerId) {
  WorkspaceState.editingModel = null;
  WorkspaceState.editingProvider = providerId;
  document.getElementById('modelModalTitle').textContent = t('ai.settings.addModel');
  document.getElementById('modelModalBody').innerHTML = renderModelForm(null);
  document.getElementById('modelModal').style.display = 'flex';
}

function openEditModelModal(providerId, modelId) {
  const provider = AIProviders.getById(providerId);
  const model = provider?.models?.find(m => m.id === modelId);
  WorkspaceState.editingProvider = providerId;
  WorkspaceState.editingModel = modelId;
  document.getElementById('modelModalTitle').textContent = t('ai.settings.editModel');
  document.getElementById('modelModalBody').innerHTML = renderModelForm(model);
  document.getElementById('modelModal').style.display = 'flex';
}

function renderModelForm(model) {
  return `
    <div class="modal-body">
      <div class="form-row">
        <div class="form-group">
          <label>${t('ai.settings.modelName')}</label>
          <input type="text" id="mf-name" class="setting-input" value="${model?.name || ''}" placeholder="GPT-4o">
        </div>
        <div class="form-group">
          <label>${t('ai.settings.modelId')}</label>
          <input type="text" id="mf-id" class="setting-input" value="${model?.id || ''}" placeholder="gpt-4o">
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>${t('ai.settings.contextWindow')}</label>
          <input type="number" id="mf-ctx" class="setting-input" value="${model?.contextWindow || 128000}">
        </div>
        <div class="form-group">
          <label>${t('ai.settings.maxTokens')}</label>
          <input type="number" id="mf-max" class="setting-input" value="${model?.maxTokens || 4096}">
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>${t('ai.settings.inputCost')}</label>
          <input type="number" id="mf-in-cost" class="setting-input" step="0.01" value="${model?.inputCost || 0}">
        </div>
        <div class="form-group">
          <label>${t('ai.settings.outputCost')}</label>
          <input type="number" id="mf-out-cost" class="setting-input" step="0.01" value="${model?.outputCost || 0}">
        </div>
      </div>
      <div class="form-group">
        <label>${t('ai.settings.temperature')}</label>
        <input type="range" id="mf-temp" min="0" max="2" step="0.1" value="${model?.temperature || 0.7}" class="setting-slider" oninput="document.getElementById('mf-temp-val').textContent = this.value">
        <span id="mf-temp-val">${model?.temperature || 0.7}</span>
      </div>
      <div class="modal-actions">
        <button class="btn-secondary" onclick="closeModelModal()">${t('btn.cancel')}</button>
        <button class="btn-primary" onclick="saveModel()">${t('btn.save')}</button>
      </div>
    </div>
  `;
}

function saveModel() {
  const name = document.getElementById('mf-name').value.trim();
  const id = document.getElementById('mf-id').value.trim();
  if (!name || !id) { showToast(t('validation.fillRequired'), 'error'); return; }

  const modelData = {
    name,
    id,
    contextWindow: parseInt(document.getElementById('mf-ctx').value),
    maxTokens: parseInt(document.getElementById('mf-max').value),
    inputCost: parseFloat(document.getElementById('mf-in-cost').value),
    outputCost: parseFloat(document.getElementById('mf-out-cost').value),
    temperature: parseFloat(document.getElementById('mf-temp').value),
  };

  if (WorkspaceState.editingModel) {
    AIProviders.updateModel(WorkspaceState.editingProvider, WorkspaceState.editingModel, modelData);
  } else {
    AIProviders.addModel(WorkspaceState.editingProvider, modelData);
  }

  closeModelModal();
  renderAISettingsPage();
  showToast(t('toast.saved'), 'success');
}

function closeModelModal() {
  document.getElementById('modelModal').style.display = 'none';
}

function deleteModel(providerId, modelId) {
  if (!confirm(t('ai.settings.confirmDeleteModel'))) return;
  AIProviders.deleteModel(providerId, modelId);
  renderAISettingsPage();
  showToast(t('toast.deleted'), 'info');
}

/* ============================================================
   AI PERSONALITY PAGE
   ============================================================ */

function renderAIPersonalityPage() {
  const container = document.getElementById('page-ai-personality');
  if (!container) return;
  const p = AIPersonality.get();

  container.innerHTML = `
    <div class="page-header">
      <div class="page-title">
        <h1><i class="fas fa-user-circle"></i> ${t('ai.personality.title')}</h1>
        <p>${t('ai.personality.save')}</p>
      </div>
      <div class="page-actions">
        <button class="btn-secondary" onclick="resetPersonality()">
          <i class="fas fa-undo"></i> ${t('ai.personality.reset')}
        </button>
        <button class="btn-primary" onclick="savePersonality()">
          <i class="fas fa-save"></i> ${t('btn.save')}
        </button>
      </div>
    </div>

    <div class="settings-grid">
      <div class="glass-card settings-card">
        <div class="card-header-inner">
          <h3><i class="fas fa-terminal"></i> ${t('ai.personality.systemPrompt')}</h3>
        </div>
        <div class="form-group">
          <label>${t('ai.personality.systemPrompt')}</label>
          <textarea id="per-system-prompt" class="setting-textarea" rows="6" 
                    placeholder="You are an expert AI tutor...">${escapeHtml(p.systemPrompt || '')}</textarea>
          <small class="form-hint">Leave blank to use the default context-aware system prompt</small>
        </div>
      </div>

      <div class="glass-card settings-card">
        <div class="card-header-inner">
          <h3><i class="fas fa-sliders-h"></i> ${t('ai.settings.activeProvider')}</h3>
        </div>
        <div class="setting-item">
          <label>${t('ai.personality.teachingStyle')}</label>
          <select class="setting-select" id="per-teaching">
            ${['Socratic', 'Direct', 'Adaptive', 'Collaborative', 'Inquiry-based'].map(s =>
              `<option value="${s}" ${p.teachingStyle === s ? 'selected' : ''}>${s}</option>`).join('')}
          </select>
        </div>
        <div class="setting-item">
          <label>${t('ai.settings.activeModel')}</label>
          <select class="setting-select" id="per-learning">
            ${['Visual', 'Auditory', 'Kinesthetic', 'Reading/Writing', 'Multimodal'].map(s =>
              `<option value="${s}" ${p.learningStyle === s ? 'selected' : ''}>${s}</option>`).join('')}
          </select>
        </div>
        <div class="setting-item">
          <label>${t('ai.personality.responseLength')}</label>
          <select class="setting-select" id="per-format">
            ${['Markdown', 'Plain Text', 'Structured', 'Conversational', 'Bullet Points'].map(s =>
              `<option value="${s}" ${p.responseFormat === s ? 'selected' : ''}>${s}</option>`).join('')}
          </select>
        </div>
        <div class="setting-item">
          <label>${t('ai.personality.tone')}</label>
          <select class="setting-select" id="per-tone">
            ${['Professional', 'Friendly', 'Encouraging', 'Strict', 'Casual'].map(s =>
              `<option value="${s}" ${p.tone === s ? 'selected' : ''}>${s}</option>`).join('')}
          </select>
        </div>
        <div class="setting-item">
          <label>${t('ai.personality.language')}</label>
          <select class="setting-select" id="per-lang">
            ${['Auto-detect', 'English', 'Arabic', 'French', 'Spanish', 'German'].map(s =>
              `<option value="${s}" ${p.preferredLanguage === s ? 'selected' : ''}>${s}</option>`).join('')}
          </select>
        </div>
      </div>

      <div class="glass-card settings-card">
        <div class="card-header-inner">
          <h3><i class="fas fa-list-ul"></i> ${t('ai.personality.behaviourRules')}</h3>
        </div>
        <div id="behaviorRulesList">
          ${(p.behaviorRules || []).map((rule, i) => `
            <div class="rule-item" id="rule-${i}">
              <input type="text" class="setting-input" value="${escapeHtml(rule)}" id="rule-text-${i}">
              <button onclick="removeBehaviorRule(${i})"><i class="fas fa-times"></i></button>
            </div>
          `).join('')}
        </div>
        <button class="btn-secondary" onclick="addBehaviorRule()" style="margin-top:8px">
          <i class="fas fa-plus"></i> ${t('ai.personality.addRule')}
        </button>
      </div>

      <div class="glass-card settings-card">
        <div class="card-header-inner">
          <h3><i class="fas fa-toggle-on"></i> ${t('ai.settings.activeProvider')}</h3>
        </div>
        <div class="setting-item">
          <label>${t('ai.workspace.mode.teach')}</label>
          <div class="toggle-wrap">
            <label class="toggle">
              <input type="checkbox" id="per-coach" ${p.studyCoachEnabled ? 'checked' : ''}>
              <span class="toggle-slider"></span>
            </label>
          </div>
        </div>
        <div class="setting-item">
          <label>${t('ai.analytics.burnout')}</label>
          <div class="toggle-wrap">
            <label class="toggle">
              <input type="checkbox" id="per-burnout" ${p.burnoutDetection ? 'checked' : ''}>
              <span class="toggle-slider"></span>
            </label>
          </div>
        </div>
      </div>
    </div>
  `;
}

function savePersonality() {
  const rules = Array.from(document.querySelectorAll('[id^="rule-text-"]'))
    .map(el => el.value.trim()).filter(r => r);

  AIPersonality.save({
    systemPrompt: document.getElementById('per-system-prompt').value,
    teachingStyle: document.getElementById('per-teaching').value,
    learningStyle: document.getElementById('per-learning').value,
    responseFormat: document.getElementById('per-format').value,
    tone: document.getElementById('per-tone').value,
    preferredLanguage: document.getElementById('per-lang').value,
    behaviorRules: rules,
    studyCoachEnabled: document.getElementById('per-coach').checked,
    burnoutDetection: document.getElementById('per-burnout').checked,
  });
  showToast(t('toast.saved'), 'success');
}

function resetPersonality() {
  if (!confirm(t('ai.personality.reset'))) return;
  AIPersonality.reset();
  renderAIPersonalityPage();
  showToast(t('toast.saved'), 'info');
}

let _ruleCount = 0;
function addBehaviorRule() {
  const list = document.getElementById('behaviorRulesList');
  if (!list) return;
  const idx = list.children.length;
  list.insertAdjacentHTML('beforeend', `
    <div class="rule-item" id="rule-${idx}">
      <input type="text" class="setting-input" placeholder="e.g. Always use examples" id="rule-text-${idx}">
      <button onclick="this.parentElement.remove()"><i class="fas fa-times"></i></button>
    </div>
  `);
}

function removeBehaviorRule(idx) {
  document.getElementById('rule-' + idx)?.remove();
}

/* ============================================================
   AI AUTOMATION PAGE
   ============================================================ */

function renderAIAutomationPage() {
  const container = document.getElementById('page-ai-automation');
  if (!container) return;
  const automations = AIAutomations.getAll();

  container.innerHTML = `
    <div class="page-header">
      <div class="page-title">
        <h1><i class="fas fa-robot"></i> ${t('ai.auto.title')}</h1>
        <p>${t('ai.auto.new')}</p>
      </div>
      <div class="page-actions">
        <button class="btn-primary" onclick="openAddAutomationModal()">
          <i class="fas fa-plus"></i> ${t('ai.auto.new')}
        </button>
      </div>
    </div>

    <div class="ai-automations-grid">
      ${automations.length > 0
        ? automations.map(a => renderAutomationCard(a)).join('')
        : `<div class="ai-empty-state glass-card">
            <i class="fas fa-robot fa-3x"></i>
            <h3>${t('ai.auto.noAutomations')}</h3>
            <p>${t('ai.auto.new')}</p>
            <button class="btn-primary" onclick="openAddAutomationModal()">
              <i class="fas fa-plus"></i> ${t('ai.auto.new')}
            </button>
          </div>`}
    </div>

    <!-- Templates -->
    <div class="section-header" style="margin-top:2rem">
      <h2>${t('ai.auto.templates')}</h2>
    </div>
    <div class="ai-templates-grid">
      ${renderAutomationTemplates()}
    </div>

    <!-- Modal -->
    <div class="modal-overlay" id="automationModal" style="display:none">
      <div class="modal glass-card" style="max-width:600px;width:100%">
        <div class="modal-header">
          <h3 id="automationModalTitle">${t('ai.auto.new')}</h3>
          <button onclick="closeAutomationModal()"><i class="fas fa-times"></i></button>
        </div>
        <div id="automationModalBody"></div>
      </div>
    </div>
  `;
}

function renderAutomationCard(auto) {
  return `
    <div class="ai-automation-card glass-card ${auto.enabled ? '' : 'disabled'}">
      <div class="ai-automation-header">
        <div class="ai-automation-icon">
          <i class="fas ${getAutomationIcon(auto.trigger)}"></i>
        </div>
        <div class="ai-automation-info">
          <h3>${escapeHtml(auto.name)}</h3>
          <p>${escapeHtml(auto.description || '')}</p>
        </div>
        <label class="toggle">
          <input type="checkbox" ${auto.enabled ? 'checked' : ''} 
                 onchange="toggleAutomation('${auto.id}', this.checked)">
          <span class="toggle-slider"></span>
        </label>
      </div>
      <div class="ai-automation-meta">
        <span class="ai-auto-trigger">
          <i class="fas fa-clock"></i>
          ${formatTrigger(auto)}
        </span>
        ${auto.lastRun ? `<span class="ai-auto-last-run">${t('ai.auto.lastRun')}: ${new Date(auto.lastRun).toLocaleString()}</span>` : ''}
      </div>
      <div class="ai-automation-actions">
        <button class="btn-sm" onclick="runAutomation('${auto.id}')">
          <i class="fas fa-play"></i> ${t('ai.auto.run')}
        </button>
        <button class="btn-sm" onclick="editAutomation('${auto.id}')">
          <i class="fas fa-edit"></i>
        </button>
        <button class="btn-sm danger" onclick="deleteAutomation('${auto.id}')">
          <i class="fas fa-trash"></i>
        </button>
      </div>
    </div>
  `;
}

function renderAutomationTemplates() {
  const templates = [
    { name: 'Daily Study Plan', trigger: 'scheduled', triggerTime: '06:00', action: 'generate_plan', icon: 'fa-sun', desc: 'Generate daily study plan every morning at 6AM' },
    { name: 'Weekly Report', trigger: 'scheduled', triggerTime: '20:00', triggerDay: 'fri', action: 'weekly_report', icon: 'fa-chart-bar', desc: 'Generate weekly progress report every Friday evening' },
    { name: 'Monthly Analysis', trigger: 'scheduled', triggerTime: '09:00', triggerDay: 'mon', action: 'monthly_analysis', icon: 'fa-calendar', desc: 'Monthly deep analysis on the first Monday' },
    { name: 'Burnout Check', trigger: 'scheduled', triggerTime: '18:00', action: 'burnout_check', icon: 'fa-heartbeat', desc: 'Daily burnout detection and wellness check' },
    { name: 'Goal Review', trigger: 'scheduled', triggerTime: '19:00', triggerDay: 'sun', action: 'review_goals', icon: 'fa-bullseye', desc: 'Weekly goal review every Sunday evening' },
  ];

  return templates.map(t => `
    <div class="ai-template-card" onclick="applyAutomationTemplate(${JSON.stringify(t).replace(/"/g, '&quot;')})">
      <div class="ai-template-icon"><i class="fas ${t.icon}"></i></div>
      <div class="ai-template-info">
        <h4>${t.name}</h4>
        <p>${t.desc}</p>
      </div>
      <button class="btn-sm">${t('btn.apply')}</button>
    </div>
  `).join('');
}

function getAutomationIcon(trigger) {
  return { scheduled: 'fa-clock', manual: 'fa-hand-pointer', event: 'fa-bell' }[trigger] || 'fa-robot';
}

function formatTrigger(auto) {
  if (auto.trigger === 'manual') return t('ai.auto.trigger.manual');
  if (auto.trigger === 'scheduled') {
    const days = { daily: 'Daily', mon: 'Monday', tue: 'Tuesday', wed: 'Wednesday', thu: 'Thursday', fri: 'Friday', sat: 'Saturday', sun: 'Sunday' };
    const day = days[auto.triggerDay] || 'Daily';
    return `${day} at ${auto.triggerTime || '00:00'}`;
  }
  return auto.trigger;
}

function openAddAutomationModal(template = null) {
  document.getElementById('automationModalTitle').textContent = template ? t('ai.auto.templates') : t('ai.auto.new');
  document.getElementById('automationModalBody').innerHTML = renderAutomationForm(template);
  document.getElementById('automationModal').style.display = 'flex';
}

function renderAutomationForm(data = null) {
  return `
    <div class="modal-body">
      <div class="form-group">
        <label>${t('ai.auto.name')}</label>
        <input type="text" id="af-name" class="setting-input" value="${data?.name || ''}" placeholder="Daily Study Plan Generator">
      </div>
      <div class="form-group">
        <label>${t('ai.settings.description')}</label>
        <input type="text" id="af-desc" class="setting-input" value="${data?.description || ''}" placeholder="Optional description...">
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>${t('ai.auto.trigger')}</label>
          <select class="setting-select" id="af-trigger" onchange="renderTriggerConfig()">
            <option value="manual" ${(data?.trigger||'manual') === 'manual' ? 'selected' : ''}>Manual</option>
            <option value="scheduled" ${data?.trigger === 'scheduled' ? 'selected' : ''}>Scheduled</option>
          </select>
        </div>
        <div class="form-group">
          <label>${t('ai.auto.action')}</label>
          <select class="setting-select" id="af-action">
            ${[
              ['generate_plan', 'Generate Daily Plan'],
              ['weekly_report', 'Weekly Progress Report'],
              ['monthly_analysis', 'Monthly Analysis'],
              ['burnout_check', 'Burnout Check'],
              ['review_goals', 'Review Goals'],
              ['custom', 'Custom Prompt'],
            ].map(([v, l]) => `<option value="${v}" ${data?.action === v ? 'selected' : ''}>${l}</option>`).join('')}
          </select>
        </div>
      </div>
      <div id="af-trigger-config">
        ${data?.trigger === 'scheduled' ? renderScheduleConfig(data) : ''}
      </div>
      <div class="form-group">
        <label>${t('ai.workspace.inputPlaceholder')}</label>
        <textarea id="af-prompt" class="setting-textarea" rows="3" placeholder="Leave blank to use default action prompt...">${escapeHtml(data?.prompt || '')}</textarea>
      </div>
      <div class="modal-actions">
        <button class="btn-secondary" onclick="closeAutomationModal()">${t('btn.cancel')}</button>
        <button class="btn-primary" onclick="saveAutomation()">${t('btn.save')}</button>
      </div>
    </div>
  `;
}

function renderScheduleConfig(data = null) {
  return `
    <div class="form-row">
      <div class="form-group">
        <label>${t('timer.start')}</label>
        <input type="time" id="af-time" class="setting-input" value="${data?.triggerTime || '06:00'}">
      </div>
      <div class="form-group">
        <label>${t('table.day')}</label>
        <select class="setting-select" id="af-day">
          ${[['daily','Every Day'],['mon','Monday'],['tue','Tuesday'],['wed','Wednesday'],['thu','Thursday'],['fri','Friday'],['sat','Saturday'],['sun','Sunday']].map(([v,l]) => `<option value="${v}" ${data?.triggerDay === v ? 'selected' : ''}>${l}</option>`).join('')}
        </select>
      </div>
    </div>
  `;
}

function renderTriggerConfig() {
  const trigger = document.getElementById('af-trigger')?.value;
  const config = document.getElementById('af-trigger-config');
  if (config) config.innerHTML = trigger === 'scheduled' ? renderScheduleConfig() : '';
}

function saveAutomation() {
  const trigger = document.getElementById('af-trigger').value;
  const data = {
    name: document.getElementById('af-name').value.trim(),
    description: document.getElementById('af-desc').value.trim(),
    trigger,
    action: document.getElementById('af-action').value,
    prompt: document.getElementById('af-prompt').value.trim(),
    triggerTime: trigger === 'scheduled' ? document.getElementById('af-time')?.value : '',
    triggerDay: trigger === 'scheduled' ? document.getElementById('af-day')?.value : '',
  };
  if (!data.name) { showToast('Name is required', 'error'); return; }
  AIAutomations.add(data);
  closeAutomationModal();
  renderAIAutomationPage();
  showToast('Automation created', 'success');
}

function closeAutomationModal() {
  document.getElementById('automationModal').style.display = 'none';
}

function toggleAutomation(id, enabled) {
  AIAutomations.update(id, { enabled });
}

function runAutomation(id) {
  AIAutomations.execute(id);
}

function deleteAutomation(id) {
  if (!confirm('Delete this automation?')) return;
  AIAutomations.delete(id);
  renderAIAutomationPage();
}

function applyAutomationTemplate(template) {
  openAddAutomationModal(typeof template === 'string' ? JSON.parse(template) : template);
}

function editAutomation(id) {
  const auto = AIAutomations.getAll().find(a => a.id === id);
  if (auto) openAddAutomationModal(auto);
}

/* ============================================================
   AI ANALYTICS PAGE
   ============================================================ */

function renderAIAnalyticsPage() {
  const container = document.getElementById('page-ai-analytics');
  if (!container) return;

  const insights = AIAnalytics.generateInsights();
  const burnoutColors = { low: '#10b981', medium: '#f59e0b', high: '#ef4444' };
  const trendIcons = { improving: 'fa-arrow-trend-up', stable: 'fa-minus', declining: 'fa-arrow-trend-down' };
  const trendColors = { improving: '#10b981', stable: '#6b7280', declining: '#ef4444' };

  container.innerHTML = `
    <div class="page-header">
      <div class="page-title">
        <h1><i class="fas fa-chart-line"></i> AI Analytics</h1>
        <p>AI-powered insights about your learning patterns</p>
      </div>
      <div class="page-actions">
        <button class="btn-primary" onclick="generateAIAnalysisReport()">
          <i class="fas fa-brain"></i> Generate AI Report
        </button>
      </div>
    </div>

    <!-- Key Metrics -->
    <div class="status-grid" style="grid-template-columns:repeat(auto-fill,minmax(180px,1fr))">
      <div class="status-card">
        <div class="card-icon"><i class="fas fa-check-circle" style="color:#10b981"></i></div>
        <div class="card-content">
          <span class="card-label">Completion Rate</span>
          <span class="card-value" style="color:#10b981">${insights.avgCompletion}%</span>
        </div><div class="card-glow"></div>
      </div>
      <div class="status-card">
        <div class="card-icon"><i class="fas fa-clock" style="color:#6366f1"></i></div>
        <div class="card-content">
          <span class="card-label">Study Hours</span>
          <span class="card-value">${insights.totalStudyHours}h</span>
        </div><div class="card-glow"></div>
      </div>
      <div class="status-card">
        <div class="card-icon"><i class="fas fa-star" style="color:#f59e0b"></i></div>
        <div class="card-content">
          <span class="card-label">Best Day</span>
          <span class="card-value">${insights.bestDay || 'N/A'}</span>
        </div><div class="card-glow"></div>
      </div>
      <div class="status-card">
        <div class="card-icon"><i class="fas fa-heartbeat" style="color:${burnoutColors[insights.burnoutRisk]}"></i></div>
        <div class="card-content">
          <span class="card-label">Burnout Risk</span>
          <span class="card-value" style="color:${burnoutColors[insights.burnoutRisk]}">${insights.burnoutRisk.toUpperCase()}</span>
        </div><div class="card-glow"></div>
      </div>
      <div class="status-card">
        <div class="card-icon"><i class="fas ${trendIcons[insights.productivityTrend]}" style="color:${trendColors[insights.productivityTrend]}"></i></div>
        <div class="card-content">
          <span class="card-label">Trend</span>
          <span class="card-value" style="color:${trendColors[insights.productivityTrend]}">${insights.productivityTrend.toUpperCase()}</span>
        </div><div class="card-glow"></div>
      </div>
    </div>

    <!-- Day Breakdown Chart -->
    <div class="two-col">
      <div class="glass-card">
        <div class="card-header-inner">
          <h3><i class="fas fa-chart-bar"></i> Weekly Completion Breakdown</h3>
        </div>
        ${insights.dayBreakdown.map(d => `
          <div class="analytics-bar-item">
            <div class="analytics-bar-label">
              <span class="pat-badge badge-${d.pattern.toLowerCase()}">${d.pattern}</span>
              <span>${d.day}</span>
            </div>
            <div class="analytics-bar-track">
              <div class="analytics-bar-fill" style="width:${d.completionRate}%;background:var(--accent-${d.pattern.toLowerCase()})"></div>
            </div>
            <span class="analytics-bar-val">${d.completionRate.toFixed(0)}%</span>
          </div>
        `).join('')}
      </div>

      <div class="glass-card">
        <div class="card-header-inner">
          <h3><i class="fas fa-lightbulb"></i> AI Recommendations</h3>
        </div>
        ${insights.recommendations.length > 0
          ? insights.recommendations.map(r => `
              <div class="ai-recommendation">
                <i class="fas fa-arrow-right"></i>
                <span>${escapeHtml(r)}</span>
              </div>
            `).join('')
          : '<p style="color:var(--text-muted);padding:12px">Great work! No issues detected this week.</p>'}

        <div class="card-header-inner" style="margin-top:1.5rem">
          <h3><i class="fas fa-calendar-check"></i> Pattern Analysis</h3>
        </div>
        ${insights.dayBreakdown.map(d => `
          <div class="pattern-analysis-item">
            <div class="pai-header">
              <span class="pat-badge badge-${d.pattern.toLowerCase()}">${d.pattern}</span>
              <strong>${d.day}</strong>
              <span style="color:var(--text-muted)">${d.studyBlocks} blocks · ${Math.round(d.totalMinutes/60)}h</span>
            </div>
            <div class="pai-bar"><div style="width:${d.completionRate}%;background:var(--accent-${d.pattern.toLowerCase()});height:4px;border-radius:2px;transition:width 1s ease"></div></div>
          </div>
        `).join('')}
      </div>
    </div>

    <!-- Memory Viewer -->
    <div class="glass-card" style="margin-top:1.5rem">
      <div class="card-header-inner">
        <h3><i class="fas fa-memory"></i> Knowledge Memory</h3>
        <button class="btn-sm" onclick="clearAIMemory()"><i class="fas fa-trash"></i> Clear All</button>
      </div>
      <div id="memoryList">
        ${renderMemoryList()}
      </div>
      <div class="memory-add-form" style="margin-top:1rem;display:flex;gap:8px">
        <input type="text" id="memKeyInput" class="setting-input" placeholder="Key (e.g. favorite_subject)" style="flex:1">
        <input type="text" id="memValInput" class="setting-input" placeholder="Value (e.g. Mathematics)" style="flex:2">
        <button class="btn-primary" onclick="addMemoryEntry()"><i class="fas fa-plus"></i></button>
      </div>
    </div>
  `;

  // Animate bars
  setTimeout(() => {
    container.querySelectorAll('.analytics-bar-fill').forEach(el => {
      const w = el.style.width;
      el.style.width = '0%';
      setTimeout(() => el.style.width = w, 100);
    });
  }, 200);
}

function renderMemoryList() {
  const memory = AIMemory.getAll();
  if (memory.length === 0) return '<p style="color:var(--text-muted);padding:8px">No memories stored yet. Chat with the AI to build memory.</p>';
  return `<div class="memory-grid">
    ${memory.map(m => `
      <div class="memory-item">
        <div class="memory-key">${escapeHtml(m.key)}</div>
        <div class="memory-val">${escapeHtml(m.value)}</div>
        <div class="memory-cat">${m.category}</div>
        <button onclick="AIMemory.remove('${m.key}');document.getElementById('memoryList').innerHTML=renderMemoryList()">
          <i class="fas fa-times"></i>
        </button>
      </div>
    `).join('')}
  </div>`;
}

function addMemoryEntry() {
  const key = document.getElementById('memKeyInput').value.trim();
  const val = document.getElementById('memValInput').value.trim();
  if (!key || !val) { showToast('Key and value are required', 'error'); return; }
  AIMemory.add(key, val, 'manual');
  document.getElementById('memKeyInput').value = '';
  document.getElementById('memValInput').value = '';
  document.getElementById('memoryList').innerHTML = renderMemoryList();
  showToast('Memory saved', 'success');
}

function clearAIMemory() {
  if (!confirm('Clear all AI memory? This cannot be undone.')) return;
  AIMemory.clear();
  document.getElementById('memoryList').innerHTML = renderMemoryList();
  showToast('Memory cleared', 'info');
}

async function generateAIAnalysisReport() {
  showToast('🤖 Generating AI analysis...', 'info');
  const prompt = `Analyze my complete learning data for week ${getCurrentWeekNum()} and provide:
1. Detailed performance analysis
2. Pattern-by-pattern breakdown
3. Burnout risk assessment
4. Top 5 specific recommendations
5. Goal completion forecast for next week

Please be specific and use my actual data.`;

  try {
    const response = await AIChat.sendMessage(prompt, []);
    const conv = AIConversations.create('Weekly Analysis Report');
    AIConversations.addMessage(conv.id, { role: 'user', content: prompt });
    AIConversations.addMessage(conv.id, { role: 'assistant', content: response });
    WorkspaceState.currentConvId = conv.id;
    showPage('ai-workspace', null);
    renderAIWorkspacePage();
  } catch (e) {
    showToast('Error: ' + e.message, 'error');
  }
}


window.WorkspaceState = WorkspaceState;
window.renderAIWorkspacePage = renderAIWorkspacePage;
window.renderAISettingsPage = renderAISettingsPage;
window.renderAIPersonalityPage = renderAIPersonalityPage;
window.renderAIAutomationPage = renderAIAutomationPage;
window.renderAIAnalyticsPage = renderAIAnalyticsPage;
window.renderMarkdown = renderMarkdown;
window.renderMemoryList = renderMemoryList;

/* ============================================================
   PHASE 3 — MULTI-PROVIDER SWITCH INSIDE CONVERSATION
   ============================================================ */

/**
 * Renders a compact provider switcher strip inside the input area
 * Allows instant provider/model switching per message
 */
function renderProviderQuickSwitch() {
  const providers = (typeof AIProviders !== 'undefined') ? AIProviders.getEnabled() : [];
  const activeProvider = (typeof AIProviders !== 'undefined') ? AIProviders.getActiveProvider() : null;
  const activeModel = (typeof AIProviders !== 'undefined') ? AIProviders.getActiveModel() : null;

  if (!providers.length) return '';

  return `
    <div class="provider-quick-switch" id="providerQuickSwitch">
      <span class="pqs-label"><i class="fas fa-robot"></i></span>
      <div class="pqs-pills">
        ${providers.slice(0, 6).map(p => {
          const isActive = activeProvider && activeProvider.id === p.id;
          const firstModel = p.models && p.models[0];
          return `
            <button class="pqs-pill ${isActive ? 'active' : ''}"
                    onclick="quickSwitchProvider('${p.id}')"
                    title="${p.name}${firstModel ? ' — ' + firstModel.name : ''}${!p.apiKey ? ' (No API Key)' : ''}">
              <i class="fas ${p.icon || 'fa-microchip'}"></i>
              <span>${(typeof p.name === 'string' && p.name.length > 8) ? p.name.substring(0, 8) + '…' : (p.name || '')}</span>
              ${isActive ? '<span class="pqs-active-dot"></span>' : ''}
              ${!p.apiKey ? '<span class="pqs-no-key" title="No API Key">!</span>' : ''}
            </button>
          `;
        }).join('')}
        ${providers.length > 6 ? `<span class="pqs-more">+${providers.length - 6}</span>` : ''}
      </div>
      ${activeModel ? `<span class="pqs-model-label">${activeModel.name}</span>` : ''}
    </div>
  `;
}

/**
 * Instantly switch to a different provider (uses first enabled model)
 */
function quickSwitchProvider(providerId) {
  if (typeof AIProviders === 'undefined') return;
  const provider = AIProviders.getById(providerId);
  if (!provider) return;

  // Set active provider
  AIProviders.setActive(providerId, provider.models && provider.models[0] ? provider.models[0].id : null);

  // Update the quick switch strip
  const pqs = document.getElementById('providerQuickSwitch');
  if (pqs) {
    pqs.outerHTML = renderProviderQuickSwitch();
  }

  // Update the model selector in the topbar
  const modelSel = document.getElementById('aiModelSelector');
  if (modelSel) {
    modelSel.outerHTML = renderModelSelector();
  }

  const provName = provider.name;
  const modelName = provider.models && provider.models[0] ? provider.models[0].name : 'Default';
  if (typeof showToast === 'function') {
    showToast(`Switched to ${provName} — ${modelName}`, 'success');
  }
}

/**
 * Enhanced renderMessage — adds provider badge to AI messages
 */
(function _enhanceRenderMessage() {
  const _orig = renderMessage;
  window.renderMessage = function(msg, index) {
    const html = _orig(msg, index);
    if (msg.role !== 'assistant' || !msg.providerId) return html;

    // Inject provider badge after avatar
    const provider = (typeof AIProviders !== 'undefined') ? AIProviders.getById(msg.providerId) : null;
    if (!provider) return html;

    const badge = `<span class="msg-provider-badge" title="${provider.name}${msg.modelId ? ' / ' + msg.modelId : ''}">
      <i class="fas ${provider.icon || 'fa-robot'}"></i> ${provider.name}
    </span>`;

    // Insert badge into meta area
    return html.replace(
      /<span class="ai-message-time">/,
      badge + '<span class="ai-message-time">'
    );
  };
})();

/**
 * Enhanced sendAIMessage — records providerId + modelId on assistant messages
 */
(function _enhanceSendAIMessage() {
  const _origSend = sendAIMessage;
  // We patch the save path: wrap AIConversations.addMessage to inject provider info
  // This is done by overriding the completion callback via a flag
  window._wsProviderInjection = true; // flag for enhanced save
})();

window.renderProviderQuickSwitch = renderProviderQuickSwitch;
window.quickSwitchProvider = quickSwitchProvider;
