/* ============================================================
   AI MEMORY SYSTEM - Long-term Knowledge Store
   ============================================================ */

const AIMemory = {
  getAll() {
    return DB.get('ai_memory', []);
  },

  // BUG FIX: Support both calling conventions:
  //   add(key, value, category)                      — original (ai-workspace.js)
  //   add({ content, category, source, key, value }) — object form (ai-enhancements.js, ai-context-engine.js)
  // All entries stored with unified fields: { id, key, value, content, category, source, updatedAt }
  add(keyOrObj, value, category = 'general') {
    const memory = this.getAll();
    let entry;

    if (keyOrObj && typeof keyOrObj === 'object') {
      // Object form: { content, category, source, key, value, ... }
      const obj = keyOrObj;
      const key = obj.key || ('mem_' + Date.now());
      entry = {
        id: obj.id || ('mem_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6)),
        key,
        value: obj.value || obj.content || '',
        content: obj.content || obj.value || '',
        category: obj.category || 'general',
        source: obj.source || 'user',
        createdAt: obj.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      const existing = memory.findIndex(m => m.key === key || m.id === entry.id);
      if (existing >= 0) memory[existing] = { ...memory[existing], ...entry };
      else memory.push(entry);
    } else {
      // Original form: add(key, value, category)
      const key = keyOrObj;
      entry = {
        id: 'mem_' + key + '_' + Date.now(),
        key,
        value: typeof value === 'string' ? value : '',
        content: typeof value === 'string' ? value : '',
        category,
        source: 'auto',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      const existing = memory.findIndex(m => m.key === key);
      if (existing >= 0) memory[existing] = { ...memory[existing], ...entry };
      else memory.push(entry);
    }

    DB.set('ai_memory', memory);
    return entry;
  },

  get(key) {
    return this.getAll().find(m => m.key === key);
  },

  // BUG FIX: remove() now handles both key-based and id-based removal
  remove(keyOrId) {
    const memory = this.getAll().filter(m => m.key !== keyOrId && m.id !== keyOrId);
    DB.set('ai_memory', memory);
  },

  clear() {
    DB.set('ai_memory', []);
  },

  extractAndStore(conversationText) {
    // Auto-extract facts to remember from conversations
    if (typeof conversationText !== 'string') return;
    const patterns = [
      { regex: /my name is (\w+)/i, key: 'user_name', cat: 'personal' },
      { regex: /i (?:am|'m) (\d+) years? old/i, key: 'user_age', cat: 'personal' },
      { regex: /i (?:am|'m) studying (.+?)(?:\.|,|$)/i, key: 'study_subject', cat: 'learning' },
      { regex: /i prefer (.+?) learning/i, key: 'learning_preference', cat: 'learning' },
      { regex: /my goal is (.+?)(?:\.|,|$)/i, key: 'main_goal', cat: 'goals' },
    ];
    patterns.forEach(({ regex, key, cat }) => {
      const match = conversationText.match(regex);
      if (match) this.add(key, match[1].trim(), cat);
    });
  }
};

/* ============================================================
   AI PERSONALITY SYSTEM
   ============================================================ */

const AIPersonality = {
  defaults: {
    systemPrompt: '',
    behaviorRules: [
      'Always provide practical, actionable advice',
      'Use examples from the user\'s current schedule',
      'Be encouraging but realistic',
      'Cite scientific learning principles when relevant'
    ],
    learningStyle: 'Visual',
    preferredLanguage: 'Auto-detect',
    teachingStyle: 'Socratic',
    responseFormat: 'Markdown',
    tone: 'Professional',
    focusMode: 'balanced',
    studyCoachEnabled: true,
    burnoutDetection: true,
  },

  get() {
    return DB.get('ai_personality', this.defaults);
  },

  save(data) {
    const current = this.get();
    const updated = { ...current, ...data };
    DB.set('ai_personality', updated);
    return updated;
  },

  reset() {
    DB.set('ai_personality', this.defaults);
    return this.defaults;
  }
};

/* ============================================================
   AI AUTOMATIONS SYSTEM
   ============================================================ */

const AIAutomations = {
  getAll() {
    return DB.get('ai_automations', []);
  },

  add(data) {
    const automations = this.getAll();
    const automation = {
      id: 'auto_' + Date.now(),
      name: data.name || 'New Automation',
      description: data.description || '',
      trigger: data.trigger || 'manual',
      triggerTime: data.triggerTime || '',
      triggerDay: data.triggerDay || '',
      action: data.action || 'generate_plan',
      prompt: data.prompt || '',
      enabled: true,
      lastRun: null,
      createdAt: new Date().toISOString()
    };
    automations.push(automation);
    DB.set('ai_automations', automations);
    this.scheduleAutomation(automation);
    return { success: true, automation };
  },

  update(id, data) {
    const automations = this.getAll();
    const idx = automations.findIndex(a => a.id === id);
    if (idx >= 0) {
      automations[idx] = { ...automations[idx], ...data };
      DB.set('ai_automations', automations);
      return automations[idx];
    }
    return null;
  },

  // save() — upsert: update existing by id, or add new if no id / not found.
  // BUG FIX: ai-enhancements.js calls AIAutomations.save() but only add()/update() existed.
  save(data) {
    if (data && data.id) {
      // Has an id — try to update existing
      const automations = this.getAll();
      const idx = automations.findIndex(a => a.id === data.id);
      if (idx >= 0) {
        automations[idx] = { ...automations[idx], ...data };
        DB.set('ai_automations', automations);
        return { success: true, automation: automations[idx] };
      }
    }
    // No id or not found — treat as new
    return this.add(data);
  },

  delete(id) {
    const automations = this.getAll().filter(a => a.id !== id);
    DB.set('ai_automations', automations);
  },

  toggle(id) {
    const automations = this.getAll();
    const auto = automations.find(a => a.id === id);
    if (auto) {
      auto.enabled = !auto.enabled;
      DB.set('ai_automations', automations);
    }
    return auto;
  },

  scheduleAutomation(automation) {
    if (!automation.enabled || automation.trigger !== 'scheduled') return;
    // Check every minute
    const check = () => {
      const now = new Date();
      const timeStr = now.getHours().toString().padStart(2,'0') + ':' + now.getMinutes().toString().padStart(2,'0');
      const dayStr = ['sun','mon','tue','wed','thu','fri','sat'][now.getDay()];

      if (automation.triggerTime === timeStr) {
        if (!automation.triggerDay || automation.triggerDay === dayStr || automation.triggerDay === 'daily') {
          this.execute(automation.id);
        }
      }
    };
    // Store interval ID
    const intervalId = setInterval(check, 60000);
    automation._intervalId = intervalId;
  },

  async execute(id) {
    const automation = this.getAll().find(a => a.id === id);
    if (!automation) return;

    showToast(`🤖 Running automation: ${automation.name}`, 'info');

    const prompt = automation.prompt || this.getDefaultPrompt(automation.action);
    try {
      const response = await AIChat.sendMessage(prompt, [], true);
      automation.lastRun = new Date().toISOString();
      this.update(id, { lastRun: automation.lastRun });

      // Store result
      const results = DB.get('ai_automation_results', []);
      results.unshift({ automationId: id, name: automation.name, result: response, runAt: automation.lastRun });
      if (results.length > 50) results.splice(50);
      DB.set('ai_automation_results', results);

      showToast(`✅ Automation "${automation.name}" completed`, 'success');
    } catch (e) {
      showToast(`❌ Automation failed: ${e.message}`, 'error');
    }
  },

  getDefaultPrompt(action) {
    const prompts = {
      'generate_plan': 'Generate today\'s optimal study plan based on my current week schedule and learning patterns.',
      'weekly_report': 'Generate a comprehensive weekly progress report with insights and recommendations.',
      'monthly_analysis': 'Analyze my learning progress for the past month and provide detailed insights.',
      'review_goals': 'Review my current goals and suggest adjustments based on my progress.',
      'burnout_check': 'Analyze my recent study patterns and check for signs of burnout. Provide recommendations.',
    };
    return prompts[action] || 'Analyze my current learning status and provide recommendations.';
  },

  checkAndRunDue() {
    const automations = this.getAll().filter(a => a.enabled && a.trigger === 'scheduled');
    automations.forEach(a => {
      if (a._intervalId) return; // Already scheduled
      this.scheduleAutomation(a);
    });
  }
};

/* ============================================================
   RESPONSE CONTENT EXTRACTOR — handles all provider formats
   ============================================================ */

/**
 * Extracts text content from an AI provider API response.
 * Supports all major response formats to prevent "undefined" responses.
 * @param {Object} data - Parsed JSON response from provider
 * @param {string} providerId - Provider identifier for format hints
 * @returns {string} Extracted text content, empty string if not found
 */
function _extractResponseContent(data, providerId) {
  if (!data || typeof data !== 'object') return '';

  // 1. Anthropic format: { content: [{ type: 'text', text: '...' }] }
  if (providerId === 'anthropic') {
    const anthropicText = data.content?.[0]?.text;
    if (typeof anthropicText === 'string') return anthropicText;
  }

  // 2. OpenAI / OpenRouter / Groq / most providers: choices[0].message.content
  const choiceContent = data.choices?.[0]?.message?.content;
  if (typeof choiceContent === 'string') return choiceContent;

  // 3. Some legacy OpenAI completions: choices[0].text
  const choiceText = data.choices?.[0]?.text;
  if (typeof choiceText === 'string') return choiceText;

  // 4. Google Gemini native format: candidates[0].content.parts[0].text
  const geminiText = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (typeof geminiText === 'string') return geminiText;

  // 5. Some custom providers return: { output: '...' }
  if (typeof data.output === 'string') return data.output;
  if (typeof data.output?.text === 'string') return data.output.text;

  // 6. Some providers return: { response: '...' } or { message: '...' }
  if (typeof data.response === 'string') return data.response;
  if (typeof data.message === 'string') return data.message;
  if (typeof data.message?.content === 'string') return data.message.content;

  // 7. Anthropic content array on non-anthropic providers (fallback)
  if (Array.isArray(data.content) && data.content[0]?.text) return String(data.content[0].text);

  // 8. Simple string content field
  if (typeof data.content === 'string') return data.content;

  // 9. result field
  if (typeof data.result === 'string') return data.result;
  if (typeof data.result?.content === 'string') return data.result.content;

  // Nothing found
  return '';
}

/* ============================================================
   DYNAMIC MAX_TOKENS — caps tokens per model to prevent errors
   ============================================================ */

/**
 * Returns a safe max_tokens value for the given model ID.
 * Prevents "This request requires more credits, or fewer max_tokens" errors.
 */
function _getSafeMaxTokens(modelId, requestedMax) {
  if (!modelId) return Math.min(requestedMax || 4096, 4096);
  const m = modelId.toLowerCase();

  // ── Per-model hard caps (Session 8: expanded + fixed for OpenRouter) ──

  // OpenRouter free/limited tier — very strict limit
  if (m.includes(':free'))                                    return Math.min(requestedMax || 1024, 1024);

  // OpenAI GPT-4.1 — large output
  if (m.includes('gpt-4.1'))                                  return Math.min(requestedMax || 8192, 32768);

  // OpenAI o1/o3 — reasoning models, very large
  if (m.includes('o3-mini') || m.includes('o3'))              return Math.min(requestedMax || 4096, 16384);
  if (m.includes('o1-mini'))                                  return Math.min(requestedMax || 4096, 16384);
  if (m.includes('o1'))                                       return Math.min(requestedMax || 4096, 32768);

  // OpenAI GPT-4o family
  if (m.includes('gpt-4o-mini'))                              return Math.min(requestedMax || 4096, 4096);
  if (m.includes('gpt-4o'))                                   return Math.min(requestedMax || 4096, 4096);
  if (m.includes('gpt-4-turbo'))                              return Math.min(requestedMax || 4096, 4096);
  if (m.includes('gpt-4'))                                    return Math.min(requestedMax || 4096, 4096);
  if (m.includes('gpt-3.5'))                                  return Math.min(requestedMax || 4096, 4096);

  // Anthropic Claude — sonnet/opus 4.5 support 8192
  if (m.includes('claude-sonnet-4') || m.includes('claude-opus-4')) return Math.min(requestedMax || 4096, 8192);
  if (m.includes('claude-3-5') || m.includes('claude-3.5'))  return Math.min(requestedMax || 4096, 8192);
  if (m.includes('claude-3-haiku'))                           return Math.min(requestedMax || 4096, 4096);
  if (m.includes('claude-3-sonnet'))                          return Math.min(requestedMax || 4096, 4096);
  if (m.includes('claude-3-opus'))                            return Math.min(requestedMax || 4096, 4096);
  if (m.includes('claude'))                                   return Math.min(requestedMax || 4096, 4096);

  // Google Gemini — 2.5 flash/pro handle 8192 output
  if (m.includes('gemini-2.5-pro'))                           return Math.min(requestedMax || 4096, 8192);
  if (m.includes('gemini-2.5-flash'))                         return Math.min(requestedMax || 4096, 8192);
  if (m.includes('gemini-2'))                                 return Math.min(requestedMax || 4096, 8192);
  if (m.includes('gemini-1.5'))                               return Math.min(requestedMax || 4096, 8192);
  if (m.includes('gemini'))                                   return Math.min(requestedMax || 4096, 4096);

  // Mistral
  if (m.includes('mistral-large'))                            return Math.min(requestedMax || 4096, 4096);
  if (m.includes('codestral'))                                return Math.min(requestedMax || 4096, 4096);
  if (m.includes('mistral'))                                  return Math.min(requestedMax || 2048, 4096);
  if (m.includes('mixtral'))                                  return Math.min(requestedMax || 4096, 4096);

  // Meta Llama (Groq/OpenRouter)
  if (m.includes('llama-3.3') || m.includes('llama-4'))       return Math.min(requestedMax || 4096, 8192);
  if (m.includes('llama-3'))                                  return Math.min(requestedMax || 4096, 4096);
  if (m.includes('llama'))                                    return Math.min(requestedMax || 2048, 2048);

  // DeepSeek
  if (m.includes('deepseek-reasoner'))                        return Math.min(requestedMax || 4096, 8192);
  if (m.includes('deepseek'))                                 return Math.min(requestedMax || 4096, 4096);

  // Qwen3
  if (m.includes('qwen3-235b'))                               return Math.min(requestedMax || 4096, 4096);
  if (m.includes('qwen'))                                     return Math.min(requestedMax || 4096, 4096);

  // Grok
  if (m.includes('grok-3'))                                   return Math.min(requestedMax || 4096, 8192);
  if (m.includes('grok'))                                     return Math.min(requestedMax || 4096, 4096);

  // Groq hosted models — fast inference
  if (m.includes('llama3.3') || m.includes('llama3.2'))       return Math.min(requestedMax || 4096, 4096);

  // Ollama local models — conservative limit
  if (m.includes('ollama') || !m.includes('/'))               return Math.min(requestedMax || 2048, 4096);

  // OpenRouter — for any model routed through OpenRouter, cap at 4096 to be safe
  // (OpenRouter has per-model limits, and requesting too many tokens causes credit errors)
  // Note: if provider is openrouter, this function is called with the model id (no 'openrouter' in it)
  // so we handle OpenRouter models specially in the call site
  return Math.min(requestedMax || 2048, 4096);
}

/* ============================================================
   AI CHAT ENGINE
   ============================================================ */

const AIChat = {
  async sendMessage(userMessage, conversationHistory = [], silent = false) {
    const provider = AIProviders.getActiveProvider();
    const model = AIProviders.getActiveModel();

    if (!provider || !model) {
      throw new Error('No AI provider configured. Please add an API key in AI Settings.');
    }
    if (!provider.apiKey || provider.apiKey === 'ollama' && provider.id !== 'ollama') {
      if (provider.id !== 'ollama') {
        throw new Error(`API key missing for ${provider.name}. Please configure it in AI Settings.`);
      }
    }

    const systemPrompt = AIAgent.buildSystemPrompt();
    const messages = [
      { role: 'system', content: systemPrompt },
      ...conversationHistory,
      { role: 'user', content: userMessage }
    ];

    const personality = AIPersonality.get();
    const temperature = model.temperature ?? 0.7;
    // Point 20: Use provider-aware safe max tokens
    // For OpenRouter, cap at 4096 to prevent credit errors
    const rawMax = model.maxTokens ?? 4096;
    const maxTokens = provider.id === 'openrouter'
      ? Math.min(_getSafeMaxTokens(model.id, rawMax), 4096)
      : _getSafeMaxTokens(model.id, rawMax);

    const requestBody = {
      model: model.id,
      messages,
      temperature,
      max_tokens: maxTokens,
      stream: false
    };

    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${provider.apiKey}`
    };

    // Provider-specific headers
    if (provider.id === 'anthropic') {
      headers['anthropic-version'] = '2023-06-01';
      headers['x-api-key'] = provider.apiKey;
      delete headers['Authorization'];
    }
    if (provider.id === 'openrouter') {
      headers['HTTP-Referer'] = 'https://murad-planner.app';
      headers['X-Title'] = 'Murad Learning Planner';
    }

    // BUG FIX: Apply custom headers from provider configuration (for custom providers)
    if (provider.customHeaders && typeof provider.customHeaders === 'object') {
      Object.assign(headers, provider.customHeaders);
    }

    const baseUrl = provider.baseUrl.replace(/\/$/, '');
    const endpoint = provider.id === 'anthropic'
      ? `${baseUrl}/messages`
      : `${baseUrl}/chat/completions`;

    // Anthropic format
    let body = requestBody;
    if (provider.id === 'anthropic') {
      body = {
        model: model.id,
        max_tokens: maxTokens,
        system: systemPrompt,
        messages: conversationHistory.concat([{ role: 'user', content: userMessage }])
      };
    }

    const response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error?.message || `API Error ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();

    // BUG FIX: Multi-format response parser — handles all provider formats.
    // Never returns undefined/null — always returns a string.
    let content = _extractResponseContent(data, provider.id);

    if (!content) {
      // Log for debugging but don't crash
      console.warn('[AIChat] Empty response from provider:', provider.id, 'Data keys:', Object.keys(data || {}));
      throw new Error(`Empty response from ${provider.name}. The model may have returned no content. Check the Debugger tab in AI Settings.`);
    }

    // Tool execution is handled by the caller (sendAIMessage onDone) to avoid double execution.
    // We still extract memory here for the non-streaming path.
    if (!silent) {
      AIMemory.extractAndStore(userMessage);
    }

    return content;
  },

  async sendMessageStream(userMessage, conversationHistory = [], onChunk, onDone, onError, visionImages = null) {
    const provider = AIProviders.getActiveProvider();
    const model = AIProviders.getActiveModel();

    if (!provider || !model) {
      onError(new Error('No AI provider configured. Please add an API key in AI Settings.'));
      return;
    }

    const systemPrompt = AIAgent.buildSystemPrompt();

    // Build the user content — if vision images are provided, use multipart content array
    let userContent;
    if (visionImages && visionImages.length > 0) {
      userContent = [
        { type: 'text', text: userMessage || 'What is in this image?' },
        ...visionImages.map(img => ({
          type: 'image_url',
          image_url: { url: `data:${img.mediaType};base64,${img.data}` }
        }))
      ];
    } else {
      userContent = userMessage;
    }

    const messages = [
      { role: 'system', content: systemPrompt },
      ...conversationHistory,
      { role: 'user', content: userContent }
    ];

    const temperature = model.temperature ?? 0.7;
    // Point 20: Provider-aware safe max tokens
    const rawMax2 = model.maxTokens ?? 4096;
    const maxTokens = provider.id === 'openrouter'
      ? Math.min(_getSafeMaxTokens(model.id, rawMax2), 4096)
      : _getSafeMaxTokens(model.id, rawMax2);

    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${provider.apiKey}`
    };

    if (provider.id === 'anthropic') {
      headers['anthropic-version'] = '2023-06-01';
      headers['x-api-key'] = provider.apiKey;
      delete headers['Authorization'];
    }
    if (provider.id === 'openrouter') {
      headers['HTTP-Referer'] = 'https://murad-planner.app';
      headers['X-Title'] = 'Murad Learning Planner';
    }

    // BUG FIX: Apply custom headers from provider configuration (for custom providers)
    if (provider.customHeaders && typeof provider.customHeaders === 'object') {
      Object.assign(headers, provider.customHeaders);
    }

    const baseUrl = provider.baseUrl.replace(/\/$/, '');
    const isAnthropic = provider.id === 'anthropic';
    const endpoint = isAnthropic ? `${baseUrl}/messages` : `${baseUrl}/chat/completions`;

    let body;
    if (isAnthropic) {
      // Anthropic vision: images use {type:'image', source:{type:'base64', ...}}
      let anthropicUserContent;
      if (visionImages && visionImages.length > 0) {
        anthropicUserContent = [
          ...visionImages.map(img => ({
            type: 'image',
            source: { type: 'base64', media_type: img.mediaType, data: img.data }
          })),
          { type: 'text', text: userMessage || 'What is in this image?' }
        ];
      } else {
        anthropicUserContent = userMessage;
      }
      body = {
        model: model.id,
        max_tokens: maxTokens,
        stream: true,
        system: systemPrompt,
        messages: conversationHistory.concat([{ role: 'user', content: anthropicUserContent }])
      };
    } else {
      body = {
        model: model.id,
        messages,
        temperature,
        max_tokens: maxTokens,
        stream: true
      };
    }

    // Log the outgoing request for debugging
    console.log('[AIChat Stream] Outgoing request:', {
      endpoint,
      model: model.id,
      provider: provider.id,
      messageCount: messages.length,
      stream: true
    });

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(body)
      });

      // Log HTTP status
      console.log('[AIChat Stream] HTTP status:', response.status, response.statusText);

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error?.message || `API Error ${response.status}: ${response.statusText}`);
      }

      // Check Content-Type — some providers return non-streaming JSON even when stream:true was requested
      const contentType = response.headers.get('content-type') || '';
      console.log('[AIChat Stream] Response Content-Type:', contentType);

      // If the response is plain JSON (not SSE), parse it directly
      if (!contentType.includes('text/event-stream') && !contentType.includes('application/stream')) {
        console.warn('[AIChat Stream] Provider returned non-SSE response despite stream:true — parsing as JSON');
        const data = await response.json().catch(() => null);
        console.log('[AIChat Stream] Raw JSON (non-SSE path):', JSON.stringify(data));
        const extracted = _extractResponseContent(data, provider.id);
        console.log('[AIChat Stream] Extracted content (non-SSE path):', extracted);
        if (typeof extracted === 'string' && extracted.trim().length > 0) {
          // Tool execution is handled by the caller (sendAIMessage onDone) to avoid double execution.
          AIMemory.extractAndStore(userMessage);
          onDone(extracted);
        } else {
          console.error('[AIChat Stream] Non-SSE path: extracted content is empty. Raw data:', data);
          onError(new Error('Empty response from provider. The model returned no content.'));
        }
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullText = '';
      let buffer = '';
      let rawLineCount = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop();

        for (const line of lines) {
          if (!line.trim()) continue;
          if (line === 'data: [DONE]') {
            console.log('[AIChat Stream] Received [DONE] signal');
            continue;
          }
          if (!line.startsWith('data: ')) {
            console.log('[AIChat Stream] Non-data line skipped:', line.substring(0, 120));
            continue;
          }

          rawLineCount++;
          try {
            const jsonStr = line.slice(6);
            const chunk = JSON.parse(jsonStr);

            // Log first few chunks for debugging
            if (rawLineCount <= 3) {
              console.log(`[AIChat Stream] Raw chunk #${rawLineCount}:`, JSON.stringify(chunk));
            }

            let delta = '';
            if (isAnthropic) {
              // Anthropic SSE: content_block_delta event has delta.text
              delta = chunk.delta?.text || '';
            } else {
              // OpenAI-compatible SSE: try all known delta fields
              const d = chunk.choices?.[0]?.delta;
              if (d) {
                // content is the standard field; text and reasoning_content are used by some providers
                const raw = d.content !== undefined ? d.content
                          : d.text     !== undefined ? d.text
                          : d.reasoning_content !== undefined ? d.reasoning_content
                          : d.message  !== undefined ? d.message
                          : '';
                // Explicitly convert null/undefined to ''
                delta = (raw === null || raw === undefined) ? '' : String(raw);
              }

              // Some providers wrap in message instead of choices[].delta
              if (!delta && chunk.message?.content) {
                delta = String(chunk.message.content);
              }
            }

            if (delta) {
              fullText += delta;
              onChunk(delta, fullText);
            }
          } catch (e) {
            console.warn('[AIChat Stream] Failed to parse SSE chunk:', line.substring(0, 200), e.message);
          }
        }
      }

      // Flush any remaining buffer content
      if (buffer.trim() && buffer.startsWith('data: ') && buffer !== 'data: [DONE]') {
        try {
          const chunk = JSON.parse(buffer.slice(6));
          const d = chunk.choices?.[0]?.delta;
          if (d) {
            const raw = d.content !== undefined ? d.content : d.text !== undefined ? d.text : '';
            if (raw) { fullText += String(raw); }
          }
        } catch (e) { /* ignore */ }
      }

      // Ensure fullText is always a string
      if (typeof fullText !== 'string') fullText = '';

      console.log('[AIChat Stream] Stream complete. Total SSE data lines processed:', rawLineCount);
      console.log('[AIChat Stream] fullText length:', fullText.length);
      console.log('[AIChat Stream] fullText preview:', fullText.substring(0, 200));

      // --- NON-STREAMING FALLBACK ---
      // If the stream yielded no content, retry once with stream:false using the universal parser.
      if (!fullText.trim()) {
        console.warn('[AIChat Stream] Stream returned empty content — attempting non-streaming fallback...');
        try {
          const fallbackBody = { ...body, stream: false };
          const fallbackResponse = await fetch(endpoint, {
            method: 'POST',
            headers,
            body: JSON.stringify(fallbackBody)
          });
          console.log('[AIChat Stream] Fallback HTTP status:', fallbackResponse.status);
          const fallbackData = await fallbackResponse.json().catch(() => null);
          console.log('[AIChat Stream] Fallback raw JSON:', JSON.stringify(fallbackData));
          const fallbackContent = _extractResponseContent(fallbackData, provider.id);
          console.log('[AIChat Stream] Fallback extracted content:', fallbackContent);
          if (typeof fallbackContent === 'string' && fallbackContent.trim().length > 0) {
            fullText = fallbackContent;
            // Simulate a single onChunk call so the UI updates before onDone
            onChunk(fullText, fullText);
          } else {
            console.error('[AIChat Stream] Fallback also returned empty. Raw fallback data:', fallbackData);
            onError(new Error('The AI model returned an empty response. Please try again or switch models.'));
            return;
          }
        } catch (fallbackErr) {
          console.error('[AIChat Stream] Fallback request failed:', fallbackErr);
          onError(new Error('Failed to get a response from the AI model. Please check your API key and try again.'));
          return;
        }
      }

      // Tool execution is handled by the caller (sendAIMessage onDone) to avoid double execution.
      AIMemory.extractAndStore(userMessage);

      console.log('[AIChat Stream] Calling onDone with content length:', fullText.length);
      onDone(fullText);
    } catch (e) {
      console.error('[AIChat Stream] Caught error:', e.message, e);
      onError(e);
    }
  }
};

/* ============================================================
   CONVERSATION HISTORY MANAGER
   ============================================================ */

const AIConversations = {
  getAll() {
    return DB.get('ai_conversations', []);
  },

  getById(id) {
    return this.getAll().find(c => c.id === id);
  },

  create(title = 'New Chat') {
    const conv = {
      id: 'conv_' + Date.now(),
      title,
      messages: [],
      folderId: null,
      pinned: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    const convs = this.getAll();
    convs.unshift(conv);
    DB.set('ai_conversations', convs);
    return conv;
  },

  update(id, data) {
    const convs = this.getAll();
    const idx = convs.findIndex(c => c.id === id);
    if (idx >= 0) {
      convs[idx] = { ...convs[idx], ...data, updatedAt: new Date().toISOString() };
      DB.set('ai_conversations', convs);
      return convs[idx];
    }
    return null;
  },

  addMessage(id, message) {
    const conv = this.getById(id);
    if (!conv) return null;
    conv.messages.push({
      id: 'msg_' + Date.now(),
      role: message.role,
      content: message.content,
      timestamp: new Date().toISOString(),
      attachments: message.attachments || []
    });
    // Auto-title from first user message
    if (conv.messages.length === 1 && message.role === 'user') {
      const safeContent = typeof message.content === 'string' ? message.content : '';
      conv.title = safeContent.substring(0, 50) + (safeContent.length > 50 ? '...' : '');
    }
    conv.updatedAt = new Date().toISOString();
    this.update(id, conv);
    return conv;
  },

  delete(id) {
    const convs = this.getAll().filter(c => c.id !== id);
    DB.set('ai_conversations', convs);
  },

  pin(id) {
    const conv = this.getById(id);
    if (conv) this.update(id, { pinned: !conv.pinned });
  },

  search(query) {
    const q = (typeof query === 'string' ? query : '').toLowerCase();
    return this.getAll().filter(c => {
      const titleMatch = typeof c.title === 'string' && c.title.toLowerCase().includes(q);
      const msgMatch = Array.isArray(c.messages) && c.messages.some(m =>
        typeof m.content === 'string' && m.content.toLowerCase().includes(q)
      );
      return titleMatch || msgMatch;
    });
  },

  export(id) {
    const conv = this.getById(id);
    if (!conv) return;
    const text = conv.messages.map(m => `[${(m.role || 'unknown').toUpperCase()}]: ${m.content || ''}`).join('\n\n');
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chat-${conv.title.replace(/[^a-z0-9]/gi, '_')}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  },

  // Folders
  getFolders() {
    return DB.get('ai_chat_folders', []);
  },

  createFolder(name) {
    const folders = this.getFolders();
    const folder = { id: 'folder_' + Date.now(), name, createdAt: new Date().toISOString() };
    folders.push(folder);
    DB.set('ai_chat_folders', folders);
    return folder;
  },

  deleteFolder(id) {
    const folders = this.getFolders().filter(f => f.id !== id);
    DB.set('ai_chat_folders', folders);
    // Move chats out of folder
    const convs = this.getAll().map(c => c.folderId === id ? { ...c, folderId: null } : c);
    DB.set('ai_conversations', convs);
  }
};

/* ============================================================
   DOCUMENT INTELLIGENCE
   NOTE: Full AIDocuments implementation lives in ai-workspace-integration.js
   (supports PDF via pdf.js, DOCX via mammoth.js, images, CSV, plain text).
   This stub is intentionally removed to prevent duplicate const declaration.
   AIDocuments is assigned to window.AIDocuments in ai-workspace-integration.js.
   ============================================================ */

/* ============================================================
   AI ANALYTICS ENGINE
   ============================================================ */

const AIAnalytics = {
  generateInsights() {
    const weekNum = getCurrentWeekNum();
    const allData = [];

    WEEK_SCHEDULE.forEach(day => {
      const data = getDailyData(weekNum, day.key, day.pattern);
      const blocks = data.blocks || [];
      const studyBlocks = blocks.filter(b => !b.isBreak);
      const withOutputs = studyBlocks.filter(b => b.outputs?.trim());
      const withNotes = studyBlocks.filter(b => b.notes?.trim());

      allData.push({
        day: day.dayEn,
        pattern: day.pattern,
        studyBlocks: studyBlocks.length,
        completed: withOutputs.length,
        withNotes: withNotes.length,
        totalMinutes: studyBlocks.reduce((a, b) => a + (b.duration || 45), 0),
        completionRate: studyBlocks.length > 0 ? (withOutputs.length / studyBlocks.length) * 100 : 0
      });
    });

    const avgCompletion = allData.reduce((a, b) => a + b.completionRate, 0) / allData.length;
    const totalStudyHours = allData.reduce((a, b) => a + b.totalMinutes, 0) / 60;
    const bestDay = allData.reduce((a, b) => b.completionRate > a.completionRate ? b : a, allData[0]);
    const burnoutRisk = this.calculateBurnoutRisk(allData);
    const productivityTrend = this.calculateTrend(allData);

    return {
      weekNum,
      avgCompletion: avgCompletion.toFixed(1),
      totalStudyHours: totalStudyHours.toFixed(1),
      bestDay: bestDay?.day,
      burnoutRisk,
      productivityTrend,
      dayBreakdown: allData,
      recommendations: this.generateRecommendations(allData, avgCompletion, burnoutRisk),
    };
  },

  calculateBurnoutRisk(data) {
    const highLoadDays = data.filter(d => d.totalMinutes > 480).length; // > 8 hours
    const lowCompletionDays = data.filter(d => d.completionRate < 30).length;
    const score = (highLoadDays * 20) + (lowCompletionDays * 15);
    if (score >= 60) return 'high';
    if (score >= 30) return 'medium';
    return 'low';
  },

  calculateTrend(data) {
    const validData = data.filter(d => d.studyBlocks > 0);
    if (validData.length < 2) return 'stable';
    const first = validData.slice(0, Math.ceil(validData.length/2));
    const second = validData.slice(Math.floor(validData.length/2));
    const avg1 = first.reduce((a,b) => a + b.completionRate, 0) / first.length;
    const avg2 = second.reduce((a,b) => a + b.completionRate, 0) / second.length;
    if (avg2 > avg1 + 10) return 'improving';
    if (avg2 < avg1 - 10) return 'declining';
    return 'stable';
  },

  generateRecommendations(data, avgCompletion, burnoutRisk) {
    const recs = [];
    if (avgCompletion < 50) recs.push('Consider reducing daily block count for better focus');
    if (burnoutRisk === 'high') recs.push('High burnout risk detected — schedule more breaks');
    if (burnoutRisk === 'medium') recs.push('Watch your energy levels — consider lighter days');
    const patternC = data.find(d => d.pattern === 'C');
    if (patternC && patternC.completionRate < 60) recs.push('Pattern C (Integration) needs more attention');
    if (data.every(d => d.withNotes < 2)) recs.push('Start taking more notes during study sessions');
    return recs;
  }
};

// NOTE: window.AIMemory is intentionally NOT set here.
// ai-memory-engine.js (loaded after this file) exports the full 3-layer
// AIMemory (LTM + Session + Working) and assigns it to window.AIMemory.
// The local AIMemory const remains available for internal backward-compat
// references within this file only.
window.AIPersonality = AIPersonality;
window.AIAutomations = AIAutomations;
window.AIChat = AIChat;
window.AIConversations = AIConversations;
// NOTE: window.AIDocuments is NOT set here.
// ai-workspace-integration.js exports the full version with PDF/DOCX/image support.
window.AIAnalytics = AIAnalytics;
