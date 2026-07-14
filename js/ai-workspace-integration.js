/* ============================================================
   AI WORKSPACE INTEGRATION — Session 4
   Implements:
     1. AIDocuments  — file/image/PDF/DOCX/TXT reading
     2. Voice Recording — MediaRecorder + waveform + transcription
     3. Composer redesign — larger, expandable, rich previews
   ============================================================ */

/* ============================================================
   1. AI DOCUMENTS — File & Image Handling
   ============================================================ */
const AIDocuments = {
  /**
   * Analyze a File object and return a structured attachment descriptor.
   * Supports: images (jpeg/png/gif/webp), PDF, DOCX, TXT, MD, CSV
   */
  async analyzeFile(file) {
    if (!file) return null;
    const name = file.name || 'file';
    const mime = file.type || '';
    const ext  = name.split('.').pop().toLowerCase();

    // ── Images ──────────────────────────────────────────────────
    if (mime.startsWith('image/') || ['jpg','jpeg','png','gif','webp','bmp','svg'].includes(ext)) {
      const dataUrl = await this._readAsDataURL(file);
      const result = {
        type: 'image',
        name,
        mimeType: mime || 'image/jpeg',
        dataUrl,
        size: file.size
      };
      // Points 10-12: Update session context so "اشرح هذا" works
      if (window._sessionContext) {
        window._sessionContext.lastImage = {
          name,
          url: dataUrl,
          description: `صورة مرفوعة: ${name}`,
          uploadedAt: new Date().toISOString()
        };
        window._sessionContext.lastFile = {
          name,
          type: 'image',
          content: dataUrl,
          size: file.size,
          uploadedAt: new Date().toISOString()
        };
      }
      return result;
    }

    // ── Plain text / Markdown / CSV ──────────────────────────────
    if (mime.startsWith('text/') || ['txt','md','markdown','csv','log','json','yaml','yml','xml','html','htm'].includes(ext)) {
      const textContent = await this._readAsText(file);
      const result = {
        type: 'document',
        name,
        mimeType: mime || 'text/plain',
        textContent: textContent.substring(0, 50000),
        size: file.size
      };
      // Update session context
      if (window._sessionContext) {
        window._sessionContext.lastFile = {
          name,
          type: ext === 'csv' ? 'excel' : 'text',
          content: textContent.substring(0, 50000),
          text: textContent.substring(0, 50000),
          size: file.size,
          uploadedAt: new Date().toISOString()
        };
      }
      return result;
    }

    // ── PDF ──────────────────────────────────────────────────────
    if (mime === 'application/pdf' || ext === 'pdf') {
      const textContent = await this._extractPDF(file);
      const result = {
        type: 'document',
        name,
        mimeType: 'application/pdf',
        textContent: textContent.substring(0, 50000),
        size: file.size
      };
      // Update session context for "اشرح هذا"
      if (window._sessionContext) {
        window._sessionContext.lastFile = {
          name,
          type: 'pdf',
          content: textContent.substring(0, 50000),
          text: textContent.substring(0, 50000),
          size: file.size,
          uploadedAt: new Date().toISOString()
        };
      }
      return result;
    }

    // ── DOCX / DOC ───────────────────────────────────────────────
    if (['docx','doc'].includes(ext) || mime.includes('word') || mime.includes('officedocument')) {
      const textContent = await this._extractDOCX(file);
      const result = {
        type: 'document',
        name,
        mimeType: mime || 'application/msword',
        textContent: textContent.substring(0, 50000),
        size: file.size
      };
      if (window._sessionContext) {
        window._sessionContext.lastFile = {
          name,
          type: 'word',
          content: textContent.substring(0, 50000),
          text: textContent.substring(0, 50000),
          size: file.size,
          uploadedAt: new Date().toISOString()
        };
      }
      return result;
    }

    // ── Fallback — try reading as text ───────────────────────────
    try {
      const textContent = await this._readAsText(file);
      const result = {
        type: 'document',
        name,
        mimeType: mime || 'application/octet-stream',
        textContent: textContent.substring(0, 50000),
        size: file.size
      };
      if (window._sessionContext) {
        window._sessionContext.lastFile = {
          name,
          type: ext,
          content: textContent.substring(0, 50000),
          text: textContent.substring(0, 50000),
          size: file.size,
          uploadedAt: new Date().toISOString()
        };
      }
      return result;
    } catch (_) {
      return {
        type: 'unknown',
        name,
        mimeType: mime,
        textContent: `[File: ${name} — could not extract content]`,
        size: file.size
      };
    }
  },

  // ── Internal readers ────────────────────────────────────────

  _readAsDataURL(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload  = e => resolve(e.target.result);
      reader.onerror = () => reject(new Error('Failed to read image'));
      reader.readAsDataURL(file);
    });
  },

  _readAsText(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload  = e => resolve(e.target.result || '');
      reader.onerror = () => reject(new Error('Failed to read text'));
      reader.readAsText(file, 'UTF-8');
    });
  },

  _readAsArrayBuffer(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload  = e => resolve(e.target.result);
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsArrayBuffer(file);
    });
  },

  async _extractPDF(file) {
    // Try pdf.js if available (loaded via CDN or local)
    if (window.pdfjsLib) {
      try {
        const arrayBuffer = await this._readAsArrayBuffer(file);
        const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        let text = '';
        for (let i = 1; i <= Math.min(pdf.numPages, 50); i++) {
          const page = await pdf.getPage(i);
          const content = await page.getTextContent();
          text += content.items.map(s => s.str).join(' ') + '\n\n';
        }
        return text.trim() || `[PDF: ${file.name} — ${pdf.numPages} pages — no extractable text]`;
      } catch (e) {
        console.warn('[AIDocuments] PDF.js extraction failed:', e.message);
      }
    }

    // Fallback: read raw bytes and extract visible ASCII (works for simple PDFs)
    try {
      const text = await this._readAsText(file);
      // Extract text between BT...ET PDF markers or just grab readable strings
      const readable = text.replace(/[^\x20-\x7E\n]/g, ' ')
        .split(/\s+/).filter(w => w.length > 2).join(' ').substring(0, 10000);
      if (readable.length > 100) return `[PDF Content — partial extraction]\n${readable}`;
    } catch (_) {}

    return `[PDF: ${file.name} — install PDF.js for full text extraction]`;
  },

  async _extractDOCX(file) {
    // Try mammoth.js if available
    if (window.mammoth) {
      try {
        const arrayBuffer = await this._readAsArrayBuffer(file);
        const result = await window.mammoth.extractRawText({ arrayBuffer });
        return result.value || `[DOCX: ${file.name} — no content extracted]`;
      } catch (e) {
        console.warn('[AIDocuments] Mammoth.js extraction failed:', e.message);
      }
    }

    // Fallback: DOCX is a ZIP; try reading as text for visible strings
    try {
      const text = await this._readAsText(file);
      const readable = text.replace(/[^\x20-\x7E\n]/g, ' ')
        .split(/\s+/).filter(w => w.length > 2).join(' ').substring(0, 10000);
      if (readable.length > 100) return `[DOCX Content — partial extraction]\n${readable}`;
    } catch (_) {}

    return `[DOCX: ${file.name} — install Mammoth.js for full extraction]`;
  }
};

window.AIDocuments = AIDocuments;

/* ============================================================
   2. VOICE RECORDING — MediaRecorder + Waveform + Transcription
   ============================================================ */
const VoiceRecorder = {
  _mediaRecorder: null,
  _audioChunks: [],
  _stream: null,
  _analyser: null,
  _animFrame: null,
  _startTime: null,
  _timerInterval: null,

  async start() {
    if (this._mediaRecorder) return; // already recording

    try {
      this._stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err) {
      if (typeof showToast === 'function') showToast('Microphone access denied: ' + err.message, 'error');
      return;
    }

    // Set up audio analyser for waveform
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const source = audioCtx.createMediaStreamSource(this._stream);
      this._analyser = audioCtx.createAnalyser();
      this._analyser.fftSize = 256;
      source.connect(this._analyser);
    } catch (_) { this._analyser = null; }

    this._audioChunks = [];
    this._mediaRecorder = new MediaRecorder(this._stream, { mimeType: this._getSupportedMimeType() });

    this._mediaRecorder.ondataavailable = e => {
      if (e.data && e.data.size > 0) this._audioChunks.push(e.data);
    };

    this._mediaRecorder.start(100); // collect every 100ms
    this._startTime = Date.now();

    // Start live speech recognition in parallel
    this._startLiveRecognition();

    // Show recording UI
    this._showRecordingUI();

    // Timer
    this._timerInterval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - this._startTime) / 1000);
      const el = document.getElementById('voiceRecordTimer');
      if (el) el.textContent = this._formatTime(elapsed);
    }, 1000);

    // Draw waveform
    if (this._analyser) this._drawWaveform();

    if (typeof WorkspaceState !== 'undefined') WorkspaceState.voiceRecording = true;
    const micBtn = document.getElementById('voiceMicBtn');
    if (micBtn) { micBtn.classList.add('recording'); micBtn.innerHTML = '<i class="fas fa-stop"></i>'; }
  },

  async stop(sendImmediately = true) {
    if (!this._mediaRecorder) return;

    clearInterval(this._timerInterval);
    cancelAnimationFrame(this._animFrame);

    return new Promise(resolve => {
      this._mediaRecorder.onstop = async () => {
        const mimeType = this._mediaRecorder.mimeType || 'audio/webm';
        const blob = new Blob(this._audioChunks, { type: mimeType });
        const duration = Math.floor((Date.now() - this._startTime) / 1000);

        // Stop live recognition
        this._stopLiveRecognition();

        // Cleanup stream
        this._stream.getTracks().forEach(t => t.stop());
        this._mediaRecorder = null;
        this._stream = null;
        this._analyser = null;
        if (typeof WorkspaceState !== 'undefined') WorkspaceState.voiceRecording = false;

        const micBtn = document.getElementById('voiceMicBtn');
        if (micBtn) { micBtn.classList.remove('recording'); micBtn.innerHTML = '<i class="fas fa-microphone"></i>'; }

        this._hideRecordingUI();

        if (blob.size < 1000) {
          if (typeof showToast === 'function') showToast('Recording too short', 'warning');
          resolve(null);
          return;
        }

        const dataUrl = await this._blobToDataURL(blob);
        const attachment = {
          type: 'audio',
          name: `Recording_${new Date().toISOString().slice(0,19).replace(/:/g,'-')}.webm`,
          mimeType,
          blob,
          dataUrl,
          duration
        };

        if (sendImmediately && typeof WorkspaceState !== 'undefined') {
          // Check if live recognition already put text in textarea
          const ta = document.getElementById('aiInputTextarea');
          const alreadyHasLiveText = ta && ta.value.trim().length > 0;

          if (alreadyHasLiveText) {
            // Live recognition already wrote text — just restore opacity and done
            if (ta) { ta.style.opacity = '1'; if (typeof _agentAutoResize === 'function') _agentAutoResize(ta); }
            if (typeof showToast === 'function') showToast('✅ تم التعرف على الكلام', 'success');
          } else {
            // Try post-hoc transcription
            const transcribed = await this._tryTranscribe(blob, mimeType);
            if (transcribed && transcribed.trim().length > 0) {
              if (ta) {
                ta.value = transcribed.trim();
                ta.style.opacity = '1';
                if (typeof _agentAutoResize === 'function') _agentAutoResize(ta);
              }
              if (typeof showToast === 'function') showToast('✅ ' + transcribed.substring(0, 60), 'success');
            } else {
              // Add as audio attachment (fallback)
              WorkspaceState.attachments.push(attachment);
              if (typeof updateAttachmentsUI === 'function') updateAttachmentsUI();
              if (typeof showToast === 'function') showToast('🎙️ تم إرفاق التسجيل الصوتي', 'info');
            }
          }
        }

        resolve(attachment);
      };

      this._mediaRecorder.stop();
    });
  },

  cancel() {
    if (!this._mediaRecorder) return;
    clearInterval(this._timerInterval);
    cancelAnimationFrame(this._animFrame);
    this._stopLiveRecognition();
    this._liveTranscript = '';
    this._stream.getTracks().forEach(t => t.stop());
    this._mediaRecorder = null;
    this._stream = null;
    this._audioChunks = [];
    if (typeof WorkspaceState !== 'undefined') WorkspaceState.voiceRecording = false;
    const micBtn = document.getElementById('voiceMicBtn');
    if (micBtn) { micBtn.classList.remove('recording'); micBtn.innerHTML = '<i class="fas fa-microphone"></i>'; }
    this._hideRecordingUI();
  },

  async _tryTranscribe(blob, mimeType) {
    // ── Strategy 1: Live SpeechRecognition (recorded simultaneously) ──
    // Already happened during recording via _startLiveRecognition()
    // If we have a pending transcript from the live session, return it
    if (this._liveTranscript && this._liveTranscript.trim().length > 2) {
      const text = this._liveTranscript.trim();
      this._liveTranscript = '';
      return text;
    }

    // ── Strategy 2: Post-recording SpeechRecognition from audio blob ──
    // This works in some browsers by playing audio through an AudioContext
    // and running recognition simultaneously (experimental)
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      console.log('[VoiceRecorder] SpeechRecognition not supported in this browser');
      return null;
    }

    return new Promise((resolve) => {
      try {
        const recog = new SR();
        recog.lang = document.documentElement.lang === 'ar' ? 'ar-SA' :
                     document.documentElement.lang === 'en' ? 'en-US' : 'ar-SA';
        recog.continuous = false;
        recog.interimResults = false;
        recog.maxAlternatives = 1;

        let resolved = false;
        const safeResolve = (val) => {
          if (!resolved) { resolved = true; resolve(val); }
        };

        recog.onresult = (e) => {
          const transcript = Array.from(e.results)
            .map(r => r[0].transcript)
            .join(' ')
            .trim();
          safeResolve(transcript || null);
        };
        recog.onerror = (e) => {
          console.log('[VoiceRecorder] SpeechRecognition error:', e.error);
          safeResolve(null);
        };
        recog.onend = () => safeResolve(null);

        // Try to start recognition — note: this may not transcribe the blob
        // but will fail gracefully and fall back to audio attachment
        recog.start();
        setTimeout(() => safeResolve(null), 3000); // timeout fallback
      } catch (e) {
        console.log('[VoiceRecorder] SpeechRecognition start failed:', e.message);
        resolve(null);
      }
    });
  },

  // Live recognition runs in parallel with MediaRecorder
  _liveTranscript: '',
  _liveRecognition: null,

  _startLiveRecognition() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;
    try {
      this._liveTranscript = '';
      const recog = new SR();
      recog.lang = document.documentElement.lang === 'ar' ? 'ar-SA' :
                   document.documentElement.lang === 'en' ? 'en-US' : 'ar-SA';
      recog.continuous = true;
      recog.interimResults = true;
      recog.maxAlternatives = 1;

      recog.onresult = (e) => {
        let finalText = '';
        let interimText = '';
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const t = e.results[i][0].transcript;
          if (e.results[i].isFinal) finalText += t + ' ';
          else interimText += t;
        }
        if (finalText) this._liveTranscript += finalText;

        // Show live text in textarea
        const ta = document.getElementById('aiInputTextarea');
        if (ta) {
          ta.value = (this._liveTranscript + interimText).trim();
          ta.style.height = 'auto';
          ta.style.height = Math.min(ta.scrollHeight, 240) + 'px';
          // Show interim text visually
          ta.style.opacity = interimText ? '0.7' : '1';
        }
      };

      recog.onerror = (e) => {
        console.log('[VoiceRecorder] Live recognition error:', e.error);
        if (e.error === 'not-allowed') {
          this._liveRecognition = null;
          if (typeof showToast === 'function') showToast('تعذر تشغيل التعرف على الكلام', 'error');
        }
      };

      recog.onend = () => {
        // Restart if still recording
        if (this._mediaRecorder && this._mediaRecorder.state === 'recording') {
          try { recog.start(); } catch (_) {}
        }
      };

      recog.start();
      this._liveRecognition = recog;
    } catch (e) {
      console.log('[VoiceRecorder] Failed to start live recognition:', e.message);
      this._liveRecognition = null;
    }
  },

  _stopLiveRecognition() {
    if (this._liveRecognition) {
      try { this._liveRecognition.stop(); } catch (_) {}
      this._liveRecognition = null;
    }
    // Restore textarea opacity
    const ta = document.getElementById('aiInputTextarea');
    if (ta) ta.style.opacity = '1';
  },

  _getSupportedMimeType() {
    const types = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4', 'audio/ogg'];
    for (const t of types) {
      if (MediaRecorder.isTypeSupported(t)) return t;
    }
    return '';
  },

  _blobToDataURL(blob) {
    return new Promise(resolve => {
      const reader = new FileReader();
      reader.onload = e => resolve(e.target.result);
      reader.readAsDataURL(blob);
    });
  },

  _formatTime(s) {
    const m = Math.floor(s / 60);
    return `${m}:${String(s % 60).padStart(2, '0')}`;
  },

  _showRecordingUI() {
    let bar = document.getElementById('voiceRecordBar');
    if (!bar) {
      bar = document.createElement('div');
      bar.id = 'voiceRecordBar';
      bar.innerHTML = `
        <div class="voice-record-bar">
          <span class="voice-rec-dot"></span>
          <canvas id="voiceWaveCanvas" width="120" height="28"></canvas>
          <span class="voice-rec-timer" id="voiceRecordTimer">0:00</span>
          <button class="voice-rec-stop" onclick="VoiceRecorder.stop(true)" title="Stop and send">
            <i class="fas fa-stop-circle"></i> Send
          </button>
          <button class="voice-rec-cancel" onclick="VoiceRecorder.cancel()" title="Cancel">
            <i class="fas fa-times"></i>
          </button>
        </div>`;
      const inputArea = document.getElementById('aiInputArea') || document.body;
      inputArea.insertBefore(bar, inputArea.firstChild);
    }
    bar.style.display = 'block';
  },

  _hideRecordingUI() {
    const bar = document.getElementById('voiceRecordBar');
    if (bar) bar.remove();
  },

  _drawWaveform() {
    const canvas = document.getElementById('voiceWaveCanvas');
    if (!canvas || !this._analyser) return;
    const ctx = canvas.getContext('2d');
    const bufferLength = this._analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const draw = () => {
      this._animFrame = requestAnimationFrame(draw);
      this._analyser.getByteTimeDomainData(dataArray);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.strokeStyle = '#6366f1';
      ctx.lineWidth = 2;
      ctx.beginPath();
      const sliceW = canvas.width / bufferLength;
      let x = 0;
      for (let i = 0; i < bufferLength; i++) {
        const v = dataArray[i] / 128.0;
        const y = (v * canvas.height) / 2;
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        x += sliceW;
      }
      ctx.stroke();
    };
    draw();
  }
};

window.VoiceRecorder = VoiceRecorder;

/* ============================================================
   3. VOICE INPUT — replaces the broken toggleVoiceInput
   ============================================================ */
function toggleVoiceInput() {
  if (VoiceRecorder._mediaRecorder) {
    VoiceRecorder.stop(true);
  } else {
    VoiceRecorder.start();
  }
}
window.toggleVoiceInput = toggleVoiceInput;

/* ============================================================
   4. ENHANCED COMPOSER — replace renderAIWorkspacePage input area
   Patched in after workspace renders via MutationObserver
   ============================================================ */
function _upgradeComposer() {
  const inputArea = document.getElementById('aiInputArea');
  if (!inputArea || inputArea.dataset.upgraded) return;
  inputArea.dataset.upgraded = 'true';

  // Rebuild the input area with the enhanced composer
  inputArea.innerHTML = `
    <!-- Attachment/audio preview bar -->
    <div class="composer-previews" id="composerPreviews" style="display:none"></div>

    <!-- Voice recording bar (injected by VoiceRecorder._showRecordingUI) -->

    <!-- Main composer row -->
    <div class="composer-row">
      <!-- Left tools -->
      <div class="composer-tools-left">
        <button class="composer-tool" id="composerAttachBtn" onclick="triggerFileUpload()" title="Attach file (PDF, DOCX, TXT…)">
          <i class="fas fa-paperclip"></i>
        </button>
        <button class="composer-tool" id="composerImageBtn" onclick="triggerImageUpload()" title="Attach image">
          <i class="fas fa-image"></i>
        </button>
        <button class="composer-tool" id="voiceMicBtn" onclick="toggleVoiceInput()" title="Voice input">
          <i class="fas fa-microphone"></i>
        </button>
      </div>

      <!-- Text input -->
      <div class="composer-textarea-wrap"
           ondrop="handleFileDrop(event)"
           ondragover="handleDragOver(event)"
           ondragleave="handleDragLeave(event)">
        <textarea
          id="aiInputTextarea"
          class="composer-textarea"
          placeholder="Message AI... (Shift+Enter for new line)"
          rows="1"
          onkeydown="handleAIInputKeydown(event)"
          oninput="_composerAutoResize(this)"
        ></textarea>
        <div class="ai-drag-overlay" id="aiDragOverlay">
          <i class="fas fa-cloud-upload-alt"></i>
          <span>Drop files here</span>
        </div>
      </div>

      <!-- Send button -->
      <button class="composer-send ${typeof WorkspaceState !== 'undefined' && WorkspaceState.isGenerating ? 'stop' : ''}"
              id="aiSendBtn"
              onclick="${typeof WorkspaceState !== 'undefined' && WorkspaceState.isGenerating ? 'stopAIGeneration()' : 'sendAIMessage()'}">
        <i class="fas ${typeof WorkspaceState !== 'undefined' && WorkspaceState.isGenerating ? 'fa-stop-circle' : 'fa-paper-plane'}"></i>
      </button>
    </div>

    <!-- Provider quick switch + footer -->
    ${typeof renderProviderQuickSwitch === 'function' ? renderProviderQuickSwitch() : ''}
    <div class="composer-footer">
      <span class="composer-hint">Enter to send · Shift+Enter for new line · Drop files to attach</span>
      <span class="ai-tts-toggle">
        <label class="ai-toggle-sm">
          <input type="checkbox" id="ttsToggle"
            ${typeof WorkspaceState !== 'undefined' && WorkspaceState.ttsEnabled ? 'checked' : ''}
            onchange="toggleTTS(this.checked)">
          <span class="toggle-slider-sm"></span>
        </label>
        <span>TTS</span>
      </span>
    </div>
  `;

  // hidden file inputs
  if (!document.getElementById('aiFileInput')) {
    const fi = document.createElement('input');
    fi.type = 'file'; fi.id = 'aiFileInput'; fi.style.display = 'none'; fi.multiple = true;
    fi.onchange = e => handleFileInputChange(e);
    document.body.appendChild(fi);
  }
  if (!document.getElementById('aiImageInput')) {
    const ii = document.createElement('input');
    ii.type = 'file'; ii.id = 'aiImageInput'; ii.style.display = 'none'; ii.multiple = true;
    ii.accept = 'image/*';
    ii.onchange = e => handleImageInputChange(e);
    document.body.appendChild(ii);
  }
}

function _composerAutoResize(ta) {
  ta.style.height = 'auto';
  const maxH = 240;
  ta.style.height = Math.min(ta.scrollHeight, maxH) + 'px';
  // Legacy alias
  if (typeof autoResizeTextarea === 'function') autoResizeTextarea(ta);
}
window._composerAutoResize = _composerAutoResize;

// Override updateAttachmentsUI to also update the composer preview bar
const _origUpdateAttachmentsUI = window.updateAttachmentsUI;
window.updateAttachmentsUI = function() {
  // Update legacy preview (in case page hasn't upgraded yet)
  if (typeof _origUpdateAttachmentsUI === 'function') _origUpdateAttachmentsUI();

  // Update composer previews
  const bar = document.getElementById('composerPreviews');
  if (!bar) return;
  const attachments = typeof WorkspaceState !== 'undefined' ? WorkspaceState.attachments : [];
  if (attachments.length === 0) { bar.style.display = 'none'; bar.innerHTML = ''; return; }
  bar.style.display = 'flex';
  bar.innerHTML = attachments.map((a, i) => {
    if (a.type === 'image') {
      return `<div class="composer-preview-chip image-chip">
        <img src="${a.dataUrl}" alt="${escapeHtml(a.name)}" class="composer-preview-thumb" onclick="lightboxImage('${a.dataUrl}')">
        <span>${escapeHtml(a.name)}</span>
        <button onclick="removeAttachment(${i})"><i class="fas fa-times"></i></button>
      </div>`;
    }
    if (a.type === 'audio') {
      return `<div class="composer-preview-chip audio-chip">
        <i class="fas fa-microphone"></i>
        <audio src="${a.dataUrl}" controls style="height:28px;max-width:160px"></audio>
        <span>${escapeHtml(a.name)}</span>
        <button onclick="removeAttachment(${i})"><i class="fas fa-times"></i></button>
      </div>`;
    }
    return `<div class="composer-preview-chip file-chip">
      <i class="fas fa-file-alt"></i>
      <span>${escapeHtml(a.name)}</span>
      <button onclick="removeAttachment(${i})"><i class="fas fa-times"></i></button>
    </div>`;
  }).join('');
};

/* ============================================================
   5. AUDIO BUBBLE RENDERER — adds audio playback in messages
   ============================================================ */
(function _patchRenderMessage() {
  const _orig = window.renderMessage;
  if (!_orig) return;
  window.renderMessage = function(msg, index) {
    let html = _orig(msg, index);
    // Inject audio player for audio attachments
    if (msg.attachments && msg.attachments.some(a => a.type === 'audio')) {
      const audioHtml = msg.attachments
        .filter(a => a.type === 'audio' && a.dataUrl)
        .map(a => `<div class="ai-audio-bubble">
          <i class="fas fa-microphone"></i>
          <audio controls src="${a.dataUrl}" style="height:32px;flex:1"></audio>
          <span class="audio-duration">${a.duration ? Math.floor(a.duration/60)+':'+String(a.duration%60).padStart(2,'0') : ''}</span>
        </div>`).join('');
      html = html.replace('</div>\n  ', audioHtml + '</div>\n  ');
    }
    return html;
  };
})();

/* ============================================================
   6. OBSERVER — auto-upgrade composer whenever workspace renders
   ============================================================ */
(function _watchWorkspacePage() {
  const target = document.getElementById('page-ai-workspace');
  if (!target) {
    // Retry after DOM is ready
    document.addEventListener('DOMContentLoaded', () => _watchWorkspacePage());
    return;
  }
  const obs = new MutationObserver(() => {
    const ia = document.getElementById('aiInputArea');
    if (ia && !ia.dataset.upgraded) _upgradeComposer();
  });
  obs.observe(target, { childList: true, subtree: true });

  // Also patch renderAIWorkspacePage to trigger upgrade after render
  const _origRender = window.renderAIWorkspacePage;
  if (_origRender) {
    window.renderAIWorkspacePage = function() {
      _origRender.apply(this, arguments);
      setTimeout(_upgradeComposer, 50);
    };
  }
})();

/* ============================================================
   7. RENDER AUDIO ATTACHMENTS IN MESSAGE BUBBLES
   Patches AIConversations.addMessage to preserve audio blobs
   ============================================================ */

/* ============================================================
   8. AIAGENTCORE TOOL ALIASES — Session 8
   Register extractPdfText and other file tools in AIAgentCore
   ============================================================ */
(function _registerFileTools() {
  // Wait for AIAgentCore to be available
  const _doRegister = () => {
    if (typeof AIAgentCore === 'undefined' || !AIAgentCore.tools) {
      setTimeout(_doRegister, 100);
      return;
    }

    // extractPdfText — alias for readFile
    if (!AIAgentCore.tools.extractPdfText) {
      AIAgentCore.tools.extractPdfText = async function(args) {
        return await this.tools.readFile.call(this, args);
      };
    }

    // analyzeFile — alias for readFile
    if (!AIAgentCore.tools.analyzeFile) {
      AIAgentCore.tools.analyzeFile = async function(args) {
        return await this.tools.readFile.call(this, args);
      };
    }

    // extractText — alias for readFile
    if (!AIAgentCore.tools.extractText) {
      AIAgentCore.tools.extractText = async function(args) {
        return await this.tools.readFile.call(this, args);
      };
    }

    console.log('[AI Integration] File tool aliases registered: extractPdfText, analyzeFile, extractText');
  };
  _doRegister();
})();

/* ============================================================
   9. FILE UPLOAD → SESSION MEMORY WIRING
   After any file is uploaded via AIDocuments.analyzeFile(),
   store it in AISessionMemory for context persistence.
   ============================================================ */
(function _wireFileToSessionMemory() {
  const _doWire = () => {
    if (typeof AIDocuments === 'undefined') {
      setTimeout(_doWire, 100);
      return;
    }

    const _origAnalyzeFile = AIDocuments.analyzeFile.bind(AIDocuments);
    AIDocuments.analyzeFile = async function(file) {
      const result = await _origAnalyzeFile(file);
      if (result && typeof AISessionMemory !== 'undefined') {
        AISessionMemory.setFile(result);
        console.log('[AI Integration] File stored in session memory:', result.name, '| type:', result.type);
      }
      return result;
    };
  };
  _doWire();
})();

/* ============================================================
   10. FILE CONTEXT INJECTION INTO AI MESSAGES
   When a user sends a message without attachment but
   AISessionMemory.lastFile exists, inject the file content.
   ============================================================ */
(function _wireFileContextInjection() {
  // Patch the workspace sendAIMessage to inject file context
  const _doWire = () => {
    if (typeof window.sendAIMessage !== 'function') {
      setTimeout(_doWire, 200);
      return;
    }

    const _origSend = window.sendAIMessage;
    window.sendAIMessage = function(...args) {
      _injectFileContextIfNeeded();
      return _origSend.apply(this, args);
    };
  };

  function _injectFileContextIfNeeded() {
    if (typeof AISessionMemory === 'undefined') return;
    const lastFile = AISessionMemory.getLastFile();
    if (!lastFile) return;

    const ta = document.getElementById('aiInputTextarea');
    if (!ta || !ta.value.trim()) return;

    const userMsg = ta.value.trim().toLowerCase();
    // Context-sensitive keywords that imply "the file"
    const fileKeywords = [
      'اشرح', 'لخص', 'ملخص', 'شرح', 'اقرأ', 'قرأ', 'تلخيص', 'ترجم', 'ترجمة',
      'ما هو', 'ما هي', 'ما المقصود', 'ما معنى', 'النقطة', 'الصفحة', 'الفقرة',
      'explain', 'summarize', 'translate', 'what is', 'what are', 'tell me about',
      'هذا', 'هذه', 'الملف', 'الوثيقة', 'المستند', 'this file', 'the document',
      'اكمل', 'استمر', 'تابع', 'continue', 'what about', 'نقطة', 'فكرة', 'مفهوم'
    ];

    const isFileReference = fileKeywords.some(kw => userMsg.includes(kw));
    if (!isFileReference) return;

    // Check if no file attachment is currently selected
    const hasAttachment = typeof WorkspaceState !== 'undefined' &&
                          WorkspaceState.attachments && WorkspaceState.attachments.length > 0;
    if (hasAttachment) return; // Already has an attachment

    // Don't add if already contains file marker
    if (ta.value.includes('[ملف:') || ta.value.includes('[File:')) return;

    // Inject the file context
    const fileContextNote = `\n[من الملف: "${lastFile.name}"]`;
    if (!ta.value.includes(fileContextNote)) {
      // Don't modify the textarea — instead store it as pending context
      // that _buildFileContextPrefix() will use
      window._pendingFileContext = {
        name: lastFile.name,
        type: lastFile.type,
        content: (lastFile.textContent || '').substring(0, 30000)
      };
    }
  }

  _doWire();
})();

/* ============================================================
   11. INJECT FILE CONTEXT INTO AI REQUEST MESSAGES
   Patches AIContextEngine or AIChat to prepend file content
   when _pendingFileContext is set.
   ============================================================ */
(function _patchAIChatForFileContext() {
  const _doWire = () => {
    if (typeof AIChat === 'undefined') {
      setTimeout(_doWire, 300);
      return;
    }

    const _origStream = AIChat.sendMessageStream.bind(AIChat);
    AIChat.sendMessageStream = async function(userMessage, conversationHistory, onChunk, onDone, onError, visionImages) {
      let finalMessage = userMessage;

      // Inject file context if pending
      if (window._pendingFileContext) {
        const fc = window._pendingFileContext;
        const fileSection = `\n\n---\n📄 **محتوى الملف المرفوع: "${fc.name}"**\n\`\`\`\n${fc.content.substring(0, 20000)}\n\`\`\`\n---\n`;
        finalMessage = finalMessage + fileSection;
        window._pendingFileContext = null;
      }

      // Also check AISessionMemory for recently referenced files
      if (typeof AISessionMemory !== 'undefined') {
        const lastFile = AISessionMemory.getLastFile();
        const contextStr = AISessionMemory.buildContextString();
        if (contextStr && !finalMessage.includes('[Session:')) {
          // Append session context silently
          finalMessage = finalMessage + `\n\n[Contexte de la session: ${contextStr}]`;
        }
      }

      return _origStream.call(this, finalMessage, conversationHistory, onChunk, onDone, onError, visionImages);
    };
  };
  _doWire();
})();

console.log('[AI Workspace Integration] Loaded — AIDocuments, VoiceRecorder, Composer ready.');
