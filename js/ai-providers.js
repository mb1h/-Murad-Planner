/* ============================================================
   AI PROVIDER & MODEL MANAGEMENT SYSTEM
   ============================================================ */

const AI_DEFAULT_PROVIDERS = [
  {
    id: 'openai',
    name: 'OpenAI',
    icon: 'fa-robot',
    color: '#10a37f',
    baseUrl: 'https://api.openai.com/v1',
    apiKey: '',
    enabled: true,
    isDefault: true,
    models: [
      { id: 'gpt-4o', name: 'GPT-4o', contextWindow: 128000, inputCost: 2.5, outputCost: 10, maxTokens: 4096, temperature: 0.7 },
      { id: 'gpt-4o-mini', name: 'GPT-4o Mini', contextWindow: 128000, inputCost: 0.15, outputCost: 0.6, maxTokens: 4096, temperature: 0.7 },
      { id: 'gpt-4.1', name: 'GPT-4.1', contextWindow: 1047576, inputCost: 2.0, outputCost: 8.0, maxTokens: 32768, temperature: 0.7 },
      { id: 'o1-mini', name: 'o1 Mini', contextWindow: 128000, inputCost: 3.0, outputCost: 12, maxTokens: 65536, temperature: 1.0 },
      { id: 'o3-mini', name: 'o3 Mini', contextWindow: 200000, inputCost: 1.1, outputCost: 4.4, maxTokens: 100000, temperature: 1.0 },
    ]
  },
  {
    id: 'anthropic',
    name: 'Anthropic',
    icon: 'fa-brain',
    color: '#c084fc',
    baseUrl: 'https://api.anthropic.com/v1',
    apiKey: '',
    enabled: true,
    isDefault: true,
    models: [
      { id: 'claude-sonnet-4-5', name: 'Claude Sonnet 4.5', contextWindow: 200000, inputCost: 3.0, outputCost: 15, maxTokens: 8192, temperature: 0.7 },
      { id: 'claude-opus-4-5', name: 'Claude Opus 4.5', contextWindow: 200000, inputCost: 15, outputCost: 75, maxTokens: 8192, temperature: 0.7 },
      { id: 'claude-3-5-haiku-20241022', name: 'Claude Haiku 3.5', contextWindow: 200000, inputCost: 0.8, outputCost: 4, maxTokens: 8192, temperature: 0.7 },
    ]
  },
  {
    id: 'google',
    name: 'Google Gemini',
    icon: 'fa-google',
    color: '#4285f4',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    apiKey: '',
    enabled: true,
    isDefault: true,
    models: [
      { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', contextWindow: 1000000, inputCost: 1.25, outputCost: 10, maxTokens: 8192, temperature: 0.7 },
      { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', contextWindow: 1000000, inputCost: 0.075, outputCost: 0.3, maxTokens: 8192, temperature: 0.7 },
      { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', contextWindow: 1000000, inputCost: 0.1, outputCost: 0.4, maxTokens: 8192, temperature: 0.7 },
    ]
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    icon: 'fa-route',
    color: '#6366f1',
    baseUrl: 'https://openrouter.ai/api/v1',
    apiKey: '',
    enabled: true,
    isDefault: true,
    models: [
      { id: 'meta-llama/llama-4-maverick', name: 'Llama 4 Maverick', contextWindow: 131072, inputCost: 0.2, outputCost: 0.6, maxTokens: 4096, temperature: 0.7 },
      { id: 'deepseek/deepseek-r1', name: 'DeepSeek R1', contextWindow: 65536, inputCost: 0.55, outputCost: 2.19, maxTokens: 8192, temperature: 0.7 },
      { id: 'qwen/qwen3-235b-a22b', name: 'Qwen3 235B', contextWindow: 40960, inputCost: 0.13, outputCost: 0.6, maxTokens: 8192, temperature: 0.7 },
    ]
  },
  {
    id: 'groq',
    name: 'Groq',
    icon: 'fa-bolt',
    color: '#f59e0b',
    baseUrl: 'https://api.groq.com/openai/v1',
    apiKey: '',
    enabled: true,
    isDefault: true,
    models: [
      { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B', contextWindow: 128000, inputCost: 0.59, outputCost: 0.79, maxTokens: 32768, temperature: 0.7 },
      { id: 'llama-3.1-8b-instant', name: 'Llama 3.1 8B', contextWindow: 131072, inputCost: 0.05, outputCost: 0.08, maxTokens: 8000, temperature: 0.7 },
      { id: 'mixtral-8x7b-32768', name: 'Mixtral 8x7B', contextWindow: 32768, inputCost: 0.24, outputCost: 0.24, maxTokens: 32768, temperature: 0.7 },
    ]
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    icon: 'fa-water',
    color: '#06b6d4',
    baseUrl: 'https://api.deepseek.com/v1',
    apiKey: '',
    enabled: true,
    isDefault: true,
    models: [
      { id: 'deepseek-chat', name: 'DeepSeek Chat V3', contextWindow: 65536, inputCost: 0.27, outputCost: 1.1, maxTokens: 8192, temperature: 0.7 },
      { id: 'deepseek-reasoner', name: 'DeepSeek R1', contextWindow: 65536, inputCost: 0.55, outputCost: 2.19, maxTokens: 8192, temperature: 0.7 },
    ]
  },
  {
    id: 'together',
    name: 'Together AI',
    icon: 'fa-users',
    color: '#8b5cf6',
    baseUrl: 'https://api.together.xyz/v1',
    apiKey: '',
    enabled: true,
    isDefault: true,
    models: [
      { id: 'meta-llama/Llama-4-Maverick-17B-128E-Instruct-FP8', name: 'Llama 4 Maverick', contextWindow: 131072, inputCost: 0.27, outputCost: 0.27, maxTokens: 4096, temperature: 0.7 },
      { id: 'Qwen/Qwen3-235B-A22B-fp8-tput', name: 'Qwen3 235B', contextWindow: 40960, inputCost: 0.9, outputCost: 0.9, maxTokens: 4096, temperature: 0.7 },
    ]
  },
  {
    id: 'mistral',
    name: 'Mistral',
    icon: 'fa-wind',
    color: '#f97316',
    baseUrl: 'https://api.mistral.ai/v1',
    apiKey: '',
    enabled: true,
    isDefault: true,
    models: [
      { id: 'mistral-large-latest', name: 'Mistral Large', contextWindow: 131072, inputCost: 2.0, outputCost: 6.0, maxTokens: 4096, temperature: 0.7 },
      { id: 'mistral-small-latest', name: 'Mistral Small', contextWindow: 131072, inputCost: 0.1, outputCost: 0.3, maxTokens: 4096, temperature: 0.7 },
      { id: 'codestral-latest', name: 'Codestral', contextWindow: 262144, inputCost: 0.2, outputCost: 0.6, maxTokens: 4096, temperature: 0.7 },
    ]
  },
  {
    id: 'xai',
    name: 'xAI',
    icon: 'fa-x',
    color: '#e5e7eb',
    baseUrl: 'https://api.x.ai/v1',
    apiKey: '',
    enabled: true,
    isDefault: true,
    models: [
      { id: 'grok-3-beta', name: 'Grok 3 Beta', contextWindow: 131072, inputCost: 3.0, outputCost: 15, maxTokens: 8192, temperature: 0.7 },
      { id: 'grok-3-mini-beta', name: 'Grok 3 Mini', contextWindow: 131072, inputCost: 0.3, outputCost: 0.5, maxTokens: 8192, temperature: 0.7 },
    ]
  },
  {
    id: 'ollama',
    name: 'Ollama',
    icon: 'fa-server',
    color: '#34d399',
    baseUrl: 'http://localhost:11434/v1',
    apiKey: 'ollama',
    enabled: true,
    isDefault: true,
    models: [
      { id: 'llama3.2', name: 'Llama 3.2', contextWindow: 128000, inputCost: 0, outputCost: 0, maxTokens: 4096, temperature: 0.7 },
      { id: 'qwen2.5', name: 'Qwen 2.5', contextWindow: 32768, inputCost: 0, outputCost: 0, maxTokens: 4096, temperature: 0.7 },
      { id: 'mistral', name: 'Mistral 7B', contextWindow: 32768, inputCost: 0, outputCost: 0, maxTokens: 4096, temperature: 0.7 },
    ]
  },
];

// ===== PROVIDER MANAGER =====
const AIProviders = {

  // Return all providers: merge defaults into persistent store on first run
  getAll() {
    this._seedDefaultsOnce();
    return DB.get('ai_providers', []);
  },

  // Seed default providers into the unified store if not yet done
  _seedDefaultsOnce() {
    if (DB.get('ai_providers_seeded')) return;
    const existing = DB.get('ai_providers', []);
    const existingIds = new Set(existing.map(p => p.id));
    for (const p of AI_DEFAULT_PROVIDERS) {
      if (!existingIds.has(p.id)) {
        existing.push({ ...p });
      }
    }
    DB.set('ai_providers', existing);
    DB.set('ai_providers_seeded', true);
  },

  getEnabled() {
    return this.getAll().filter(p => p.enabled !== false);
  },

  getById(id) {
    return this.getAll().find(p => p.id === id) || null;
  },

  save(provider) {
    const all = this.getAll();
    const idx = all.findIndex(p => p.id === provider.id);
    if (idx >= 0) all[idx] = provider;
    else all.push(provider);
    DB.set('ai_providers', all);
  },

  delete(id) {
    const all = this.getAll().filter(p => p.id !== id);
    DB.set('ai_providers', all);
    // If deleted provider was active, clear active selection
    if (DB.get('ai_active_provider') === id) {
      DB.set('ai_active_provider', all.length > 0 ? all[0].id : null);
    }
  },

  addModel(providerId, model) {
    const provider = this.getById(providerId);
    if (!provider) return;
    if (!provider.models) provider.models = [];
    model.id = model.id || 'model_' + Date.now();
    provider.models.push(model);
    this.save(provider);
    return model;
  },

  updateModel(providerId, modelId, updates) {
    const provider = this.getById(providerId);
    if (!provider) return;
    const model = (provider.models || []).find(m => m.id === modelId);
    if (model) Object.assign(model, updates);
    this.save(provider);
  },

  deleteModel(providerId, modelId) {
    const provider = this.getById(providerId);
    if (!provider) return;
    provider.models = (provider.models || []).filter(m => m.id !== modelId);
    this.save(provider);
  },

  getActiveProvider() {
    const id = DB.get('ai_active_provider', null);
    const all = this.getEnabled();
    if (id) {
      const found = all.find(p => p.id === id);
      if (found) return found;
    }
    return all[0] || null;
  },

  getActiveModel() {
    const provider = this.getActiveProvider();
    if (!provider?.models?.length) return null;
    const modelId = DB.get('ai_active_model_' + provider.id, null);
    return provider.models.find(m => m.id === modelId) || provider.models[0];
  },

  setActive(providerId, modelId) {
    DB.set('ai_active_provider', providerId);
    if (modelId) DB.set('ai_active_model_' + providerId, modelId);
  }
};

window.AIProviders = AIProviders;
