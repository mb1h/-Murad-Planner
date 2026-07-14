/* ============================================================
   MURAD LEARNING PLANNER - AI Provider Validator & Diagnostics v2.0
   Real API validation before save, diagnostics center, request debugger
   ============================================================ */

(function () {
  'use strict';

  // ── Request Log ──────────────────────────────────────────────
  const MAX_LOG_ENTRIES = 100;
  const STORAGE_KEY = 'murad_ai_request_log';
  const DIAG_KEY = 'murad_ai_diagnostics';

  // ── Connection Status Types ──────────────────────────────────
  const CONNECTION_STATUS = {
    UNTESTED: 'untested',
    TESTING: 'testing',
    CONNECTED: 'connected',
    FAILED: 'failed',
    INVALID_KEY: 'invalid_key',
    INVALID_MODEL: 'invalid_model',
    RATE_LIMITED: 'rate_limited',
    QUOTA_EXCEEDED: 'quota_exceeded',
    OFFLINE: 'offline',
    TIMEOUT: 'timeout'
  };

  // ── Request Logger ───────────────────────────────────────────
  const AIRequestLogger = {
    _log: null,

    _getLog() {
      if (!this._log) {
        try {
          const raw = localStorage.getItem(STORAGE_KEY);
          this._log = raw ? JSON.parse(raw) : [];
        } catch (e) {
          this._log = [];
        }
      }
      return this._log;
    },

    _save() {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this._log.slice(0, MAX_LOG_ENTRIES)));
      } catch (e) { /* quota */ }
    },

    add(entry) {
      const log = this._getLog();
      log.unshift({
        id: 'req_' + Date.now(),
        timestamp: new Date().toISOString(),
        ...entry
      });
      if (log.length > MAX_LOG_ENTRIES) log.pop();
      this._save();
      // Notify any UI observers
      if (window._aiDebuggerUpdateCallback) window._aiDebuggerUpdateCallback();
    },

    getAll() { return this._getLog(); },

    clear() {
      this._log = [];
      try { localStorage.removeItem(STORAGE_KEY); } catch (e) { /* */ }
    }
  };

  // ── Provider Diagnostics ─────────────────────────────────────
  const AIProviderDiagnostics = {
    _diag: null,

    _get() {
      if (!this._diag) {
        try {
          const raw = localStorage.getItem(DIAG_KEY);
          this._diag = raw ? JSON.parse(raw) : {};
        } catch (e) {
          this._diag = {};
        }
      }
      return this._diag;
    },

    _save() {
      try { localStorage.setItem(DIAG_KEY, JSON.stringify(this._diag)); } catch (e) { /* */ }
    },

    record(providerId, modelId, { success, latency, tokensUsed, errorMsg, status }) {
      const diag = this._get();
      if (!diag[providerId]) {
        diag[providerId] = {
          requestCount: 0,
          errorCount: 0,
          totalLatency: 0,
          totalTokens: 0,
          lastResponse: null,
          lastError: null,
          lastStatus: CONNECTION_STATUS.UNTESTED,
          modelStats: {}
        };
      }
      const p = diag[providerId];
      p.requestCount++;
      p.totalLatency += latency || 0;
      p.totalTokens += tokensUsed || 0;
      p.lastStatus = status || (success ? CONNECTION_STATUS.CONNECTED : CONNECTION_STATUS.FAILED);

      if (success) {
        p.lastResponse = new Date().toISOString();
      } else {
        p.errorCount++;
        p.lastError = { message: errorMsg, time: new Date().toISOString() };
      }

      // Model-level stats
      if (modelId) {
        if (!p.modelStats[modelId]) p.modelStats[modelId] = { requests: 0, errors: 0, avgLatency: 0, tokens: 0 };
        const m = p.modelStats[modelId];
        m.requests++;
        m.tokens += tokensUsed || 0;
        m.avgLatency = m.requests === 1 ? latency : (m.avgLatency + latency) / 2;
        if (!success) m.errors++;
      }

      this._save();
    },

    get(providerId) {
      const diag = this._get();
      return diag[providerId] || null;
    },

    getAll() {
      return this._get();
    },

    getAverageLatency(providerId) {
      const d = this.get(providerId);
      if (!d || d.requestCount === 0) return 0;
      return Math.round(d.totalLatency / d.requestCount);
    },

    clear(providerId) {
      const diag = this._get();
      if (providerId) {
        delete diag[providerId];
      } else {
        this._diag = {};
      }
      this._save();
    }
  };

  // ── Provider Validator ───────────────────────────────────────
  const AIProviderValidator = {
    /**
     * Test a provider connection with a minimal API request.
     * Returns { status, latency, message, model }
     */
    async testConnection(provider, modelId) {
      const startTime = Date.now();
      let status = CONNECTION_STATUS.FAILED;
      let message = '';
      let latencyMs = 0;

      if (!provider) return { status: CONNECTION_STATUS.FAILED, message: 'No provider', latency: 0 };
      if (!provider.apiKey && provider.type !== 'ollama' && provider.id !== 'ollama') {
        return { status: CONNECTION_STATUS.INVALID_KEY, message: t ? t('validation.noApiKey') : 'No API key', latency: 0 };
      }

      const useModel = modelId || (provider.models && provider.models[0]?.id) || 'gpt-3.5-turbo';

      // Build test request
      let url, headers, body;
      try {
        ({ url, headers, body } = _buildTestRequest(provider, useModel));
      } catch (e) {
        return { status: CONNECTION_STATUS.FAILED, message: 'Failed to build request: ' + e.message, latency: 0 };
      }

      // Log the request
      const logEntry = {
        type: 'test',
        providerId: provider.id,
        providerName: provider.name,
        modelId: useModel,
        url,
        payload: body,
        headers: _sanitizeHeaders(headers)
      };

      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 15000); // 15s timeout

        const res = await fetch(url, {
          method: 'POST',
          headers,
          body: JSON.stringify(body),
          signal: controller.signal
        });
        clearTimeout(timeout);
        latencyMs = Date.now() - startTime;

        const responseText = await res.text();
        let responseData = null;
        try { responseData = JSON.parse(responseText); } catch (e) { /* raw */ }

        logEntry.httpStatus = res.status;
        logEntry.responseTime = latencyMs;
        logEntry.response = responseData || responseText.slice(0, 500);

        if (res.ok) {
          status = CONNECTION_STATUS.CONNECTED;
          message = window.t ? t('validation.connected') : 'Connected';
        } else {
          status = _mapHttpErrorToStatus(res.status, responseData);
          message = _getStatusMessage(status, responseData);
          logEntry.error = message;
        }
      } catch (err) {
        latencyMs = Date.now() - startTime;
        logEntry.responseTime = latencyMs;

        if (err.name === 'AbortError') {
          status = CONNECTION_STATUS.TIMEOUT;
          message = 'Request timed out (15s)';
        } else if (err.message.includes('Failed to fetch') || err.message.includes('NetworkError')) {
          status = CONNECTION_STATUS.OFFLINE;
          message = window.t ? t('validation.offline') : 'Provider offline or CORS error';
        } else {
          status = CONNECTION_STATUS.FAILED;
          message = err.message;
        }
        logEntry.error = message;
      }

      logEntry.status = status;
      AIRequestLogger.add(logEntry);
      AIProviderDiagnostics.record(provider.id, useModel, {
        success: status === CONNECTION_STATUS.CONNECTED,
        latency: latencyMs,
        errorMsg: status !== CONNECTION_STATUS.CONNECTED ? message : null,
        status
      });

      return { status, latency: latencyMs, message, model: useModel };
    },

    /**
     * Validate provider data before saving (without test request).
     * Returns { valid, errors }
     */
    validateProviderData(providerData) {
      const errors = [];

      if (!providerData.name?.trim()) {
        errors.push(window.t ? t('validation.fillRequired') : 'Provider name is required');
      }
      if (!providerData.baseUrl?.trim()) {
        errors.push('Base URL is required');
      }
      if (!providerData.models || providerData.models.length === 0) {
        errors.push(window.t ? t('validation.noModel') : 'At least one model is required');
      }
      providerData.models?.forEach((m, idx) => {
        if (!m.id?.trim()) errors.push(`Model ${idx + 1}: ID is required`);
        if (!m.name?.trim()) errors.push(`Model ${idx + 1}: Name is required`);
      });

      return { valid: errors.length === 0, errors };
    },

    getStatusDisplay(status) {
      const map = {
        [CONNECTION_STATUS.UNTESTED]: { label: window.t ? t('ai.settings.status.untested') : 'Not Tested', color: '#6b7280', icon: 'fa-question-circle' },
        [CONNECTION_STATUS.TESTING]: { label: window.t ? t('validation.testing') : 'Testing...', color: '#f59e0b', icon: 'fa-spinner fa-spin' },
        [CONNECTION_STATUS.CONNECTED]: { label: window.t ? t('ai.settings.status.connected') : 'Connected', color: '#22c55e', icon: 'fa-check-circle' },
        [CONNECTION_STATUS.FAILED]: { label: window.t ? t('ai.settings.status.failed') : 'Failed', color: '#ef4444', icon: 'fa-times-circle' },
        [CONNECTION_STATUS.INVALID_KEY]: { label: window.t ? t('ai.settings.status.invalid_key') : 'Invalid API Key', color: '#ef4444', icon: 'fa-key' },
        [CONNECTION_STATUS.INVALID_MODEL]: { label: window.t ? t('ai.settings.status.invalid_model') : 'Invalid Model', color: '#f59e0b', icon: 'fa-exclamation-circle' },
        [CONNECTION_STATUS.RATE_LIMITED]: { label: window.t ? t('ai.settings.status.rate_limited') : 'Rate Limited', color: '#f59e0b', icon: 'fa-hourglass-half' },
        [CONNECTION_STATUS.QUOTA_EXCEEDED]: { label: window.t ? t('ai.settings.status.quota_exceeded') : 'Quota Exceeded', color: '#ef4444', icon: 'fa-ban' },
        [CONNECTION_STATUS.OFFLINE]: { label: window.t ? t('ai.settings.status.offline') : 'Provider Offline', color: '#6b7280', icon: 'fa-wifi' },
        [CONNECTION_STATUS.TIMEOUT]: { label: 'Timeout', color: '#f59e0b', icon: 'fa-clock' },
      };
      return map[status] || map[CONNECTION_STATUS.UNTESTED];
    }
  };

  // ── Build test request by provider type ──────────────────────
  function _buildTestRequest(provider, modelId) {
    const baseUrl = provider.baseUrl.replace(/\/$/, '');

    // Anthropic
    if (provider.type === 'anthropic' || provider.id === 'anthropic') {
      return {
        url: `${baseUrl}/messages`,
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': provider.apiKey,
          'anthropic-version': '2023-06-01'
        },
        body: {
          model: modelId,
          max_tokens: 5,
          messages: [{ role: 'user', content: 'Hi' }]
        }
      };
    }

    // Google Gemini
    if (provider.type === 'google' || provider.id === 'google' || provider.id === 'gemini') {
      return {
        url: `${baseUrl}/models/${modelId}:generateContent?key=${provider.apiKey}`,
        headers: { 'Content-Type': 'application/json' },
        body: {
          contents: [{ role: 'user', parts: [{ text: 'Hi' }] }],
          generationConfig: { maxOutputTokens: 5 }
        }
      };
    }

    // Cohere
    if (provider.type === 'cohere' || provider.id === 'cohere') {
      return {
        url: `${baseUrl}/chat`,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${provider.apiKey}`
        },
        body: {
          model: modelId,
          message: 'Hi',
          max_tokens: 5
        }
      };
    }

    // OpenAI-compatible (default for OpenAI, OpenRouter, Groq, DeepSeek, Mistral, Together, xAI, Ollama, Custom)
    const authHeader = provider.apiKey ? { 'Authorization': `Bearer ${provider.apiKey}` } : {};
    const extraHeaders = provider.headers || {};
    return {
      url: `${baseUrl}/chat/completions`,
      headers: {
        'Content-Type': 'application/json',
        ...authHeader,
        ...extraHeaders
      },
      body: {
        model: modelId,
        messages: [{ role: 'user', content: 'Hi' }],
        max_tokens: 5,
        stream: false
      }
    };
  }

  function _sanitizeHeaders(headers) {
    const safe = { ...headers };
    if (safe.Authorization) safe.Authorization = safe.Authorization.replace(/Bearer\s+.+/, 'Bearer ***');
    if (safe['x-api-key']) safe['x-api-key'] = '***';
    if (safe['api-key']) safe['api-key'] = '***';
    return safe;
  }

  function _mapHttpErrorToStatus(httpStatus, body) {
    if (httpStatus === 401 || httpStatus === 403) return CONNECTION_STATUS.INVALID_KEY;
    if (httpStatus === 404) return CONNECTION_STATUS.INVALID_MODEL;
    if (httpStatus === 429) {
      const msg = JSON.stringify(body || '').toLowerCase();
      if (msg.includes('quota') || msg.includes('credit') || msg.includes('billing')) {
        return CONNECTION_STATUS.QUOTA_EXCEEDED;
      }
      return CONNECTION_STATUS.RATE_LIMITED;
    }
    if (httpStatus >= 500) return CONNECTION_STATUS.OFFLINE;
    return CONNECTION_STATUS.FAILED;
  }

  function _getStatusMessage(status, body) {
    const msgs = {
      [CONNECTION_STATUS.INVALID_KEY]: window.t ? t('validation.invalid_key') : 'Invalid API Key',
      [CONNECTION_STATUS.INVALID_MODEL]: window.t ? t('validation.invalid_model') : 'Invalid model ID',
      [CONNECTION_STATUS.RATE_LIMITED]: window.t ? t('validation.rate_limited') : 'Rate limit exceeded',
      [CONNECTION_STATUS.QUOTA_EXCEEDED]: window.t ? t('validation.quota_exceeded') : 'Quota exceeded',
      [CONNECTION_STATUS.OFFLINE]: window.t ? t('validation.offline') : 'Provider offline',
      [CONNECTION_STATUS.FAILED]: window.t ? t('validation.failed') : 'Connection failed',
    };
    const base = msgs[status] || 'Connection failed';
    if (body?.error?.message) return base + ': ' + body.error.message.slice(0, 100);
    return base;
  }

  // ── Expose globally ──────────────────────────────────────────
  window.AIProviderValidator = AIProviderValidator;
  window.AIRequestLogger = AIRequestLogger;
  window.AIProviderDiagnostics = AIProviderDiagnostics;
  window.CONNECTION_STATUS = CONNECTION_STATUS;

  // ── Monkey-patch AIChat to auto-log all requests ─────────────
  // This runs after ai-engine.js loads.
  //
  // IMPORTANT: The wrapper must be fully transparent — it must pass through
  // ALL arguments to the caller's callbacks unchanged and with the correct
  // arity. The real sendMessageStream calls:
  //   onChunk(delta, fullText)   — two arguments
  //   onDone(fullText)           — one argument: the authoritative parsed string
  //
  // The log entry's `response` field must be set to that same `fullText` so
  // the Debugger and the chat bubble always show the same parsed text.
  // No second parse, no truncation, no re-derivation.
  window.addEventListener('load', () => {
    if (window.AIChat && AIChat.sendMessageStream) {
      const _originalStream = AIChat.sendMessageStream.bind(AIChat);
      AIChat.sendMessageStream = function (userMessage, conversationHistory, onChunk, onDone, onError, visionImages) {
        const provider = window.AIProviders ? AIProviders.getActiveProvider() : null;
        const model = window.AIProviders ? AIProviders.getActiveModel() : null;
        const startTime = Date.now();
        let tokenEstimate = 0;

        // wrappedChunk(delta, fullText) — mirrors the real signature exactly.
        // tokenEstimate is updated from delta (first arg), which is the new
        // characters only — avoids double-counting the accumulating fullText.
        const wrappedChunk = (delta, fullText) => {
          if (typeof delta === 'string') {
            tokenEstimate += Math.ceil(delta.length / 4);
          }
          if (onChunk) onChunk(delta, fullText);
        };

        // wrappedDone(fullText) — receives the single authoritative parsed
        // string that sendMessageStream already extracted and validated.
        // We log that exact value as `response` — no second parse.
        const wrappedDone = (fullText) => {
          const latency = Date.now() - startTime;
          if (provider) {
            AIProviderDiagnostics.record(provider.id, model?.id, {
              success: true,
              latency,
              tokensUsed: tokenEstimate
            });
            AIRequestLogger.add({
              type: 'chat',
              providerId: provider.id,
              providerName: provider.name,
              modelId: model?.id,
              url: (provider.baseUrl || '').replace(/\/$/, '') + '/chat/completions',
              payload: {
                messages: (conversationHistory || []).slice(-1).concat([{ role: 'user', content: typeof userMessage === 'string' ? userMessage.slice(0, 300) : '' }]),
              },
              headers: { Authorization: 'Bearer ***' },
              httpStatus: 200,
              responseTime: latency,
              // Use the exact same fullText the chat bubble will display — no truncation,
              // no re-parse. The debugger and the chat are now reading the same string.
              response: typeof fullText === 'string' ? fullText : '',
              parsedText: typeof fullText === 'string' ? fullText : '',
              status: CONNECTION_STATUS.CONNECTED,
              tokensEstimate: tokenEstimate
            });
          }
          if (onDone) onDone(fullText);
        };

        const wrappedError = (err) => {
          const latency = Date.now() - startTime;
          if (provider) {
            AIProviderDiagnostics.record(provider.id, model?.id, {
              success: false,
              latency,
              errorMsg: err?.message,
              status: CONNECTION_STATUS.FAILED
            });
            AIRequestLogger.add({
              type: 'chat',
              providerId: provider.id,
              providerName: provider.name,
              modelId: model?.id,
              url: (provider.baseUrl || '').replace(/\/$/, '') + '/chat/completions',
              payload: { messages: (conversationHistory || []).slice(-1) },
              headers: { Authorization: 'Bearer ***' },
              httpStatus: 0,
              responseTime: latency,
              error: err?.message,
              status: CONNECTION_STATUS.FAILED
            });
          }
          if (onError) onError(err);
        };

        return _originalStream(userMessage, conversationHistory, wrappedChunk, wrappedDone, wrappedError, visionImages);
      };
    }
  });

})();
