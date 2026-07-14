/* ================================================================
   MURAD PLANNER — CRITICAL STABILIZATION PATCH
   Fixes: P1 Provider Modal, P2 Model Modal+Validation,
          P3 Dock Navigation, P4 Translation gaps,
          P5 Provider CRUD, P6 Model Validation,
          P7 Global Error System, P8 Diagnostics
   Rule: ONLY adds/overrides broken functions. Never removes working code.
   ================================================================ */

(function () {
  'use strict';

  /* ============================================================
     P7 — GLOBAL ERROR SYSTEM
     Every failure shows: what failed, why, how to fix it
     ============================================================ */

  window.showError = function (what, why, how, duration) {
    duration = duration || 6000;
    const container = document.getElementById('toastContainer') ||
      (() => {
        const c = document.createElement('div');
        c.id = 'toastContainer';
        c.style.cssText = 'position:fixed;bottom:24px;right:24px;z-index:99999;display:flex;flex-direction:column;gap:8px;pointer-events:none';
        document.body.appendChild(c);
        return c;
      })();

    const toast = document.createElement('div');
    toast.className = 'toast error toast-detailed';
    toast.style.cssText = 'pointer-events:auto;max-width:380px;';
    toast.innerHTML = `
      <div class="toast-error-header">
        <i class="fas fa-exclamation-circle"></i>
        <strong>${_esc(what)}</strong>
      </div>
      ${why ? `<div class="toast-error-why"><i class="fas fa-info-circle"></i> ${_esc(why)}</div>` : ''}
      ${how ? `<div class="toast-error-how"><i class="fas fa-wrench"></i> ${_esc(how)}</div>` : ''}
      <button class="toast-close" onclick="this.closest('.toast').remove()"><i class="fas fa-times"></i></button>
    `;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(100%)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, duration);
  };

  function _esc(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function _t(key, fallback) {
    return (window.t && typeof window.t === 'function') ? (window.t(key) || fallback) : fallback;
  }

  /* ============================================================
     P1 + P5 — PROVIDER MODAL (full CRUD)
     Fixes: openAddProviderModal, openEditProviderModal,
            closeProviderModal, saveProvider writing to correct IDs
     The enhanced page uses: providerModal + providerModalContent
     The old workspace used: providerModal + providerModalTitle/Body
     ============================================================ */

  function _getProviderModalContent() {
    // Enhanced page uses providerModalContent
    let el = document.getElementById('providerModalContent');
    if (el) return { el, type: 'enhanced' };
    // Fallback: old workspace uses providerModalBody
    el = document.getElementById('providerModalBody');
    if (el) return { el, type: 'legacy' };
    return null;
  }

  function _buildProviderForm(provider) {
    const providerTypes = ['openai', 'anthropic', 'google', 'cohere', 'mistral', 'custom'];
    const icons = ['fa-robot', 'fa-brain', 'fa-star', 'fa-bolt', 'fa-wind', 'fa-cog', 'fa-microchip', 'fa-satellite', 'fa-atom'];

    return `
      <div class="stab-modal-header">
        <h2 class="stab-modal-title">
          <i class="fas fa-server"></i>
          ${provider ? _t('ai.settings.editProvider', 'Edit Provider') : _t('ai.settings.addProvider', 'إضافة مزود')}
        </h2>
        <button class="stab-modal-close" onclick="closeProviderModal()"><i class="fas fa-times"></i></button>
      </div>
      <div class="stab-modal-body">
        <div class="stab-form-grid">
          <div class="stab-form-group stab-col-2">
            <label class="stab-label">${_t('ai.settings.providerName', 'اسم المزود')} <span class="required">*</span></label>
            <input type="text" id="pf-name" class="stab-input" value="${_esc(provider?.name || '')}" placeholder="e.g. My Custom AI">
          </div>
          <div class="stab-form-group">
            <label class="stab-label">${_t('ai.settings.providerType', 'نوع المزود')}</label>
            <select id="pf-type" class="stab-select">
              ${providerTypes.map(t => `<option value="${t}" ${(provider?.type || 'custom') === t ? 'selected' : ''}>${t}</option>`).join('')}
            </select>
          </div>
          <div class="stab-form-group stab-col-2">
            <label class="stab-label">${_t('ai.settings.baseUrl', 'عنوان URL الأساسي')} <span class="required">*</span></label>
            <input type="url" id="pf-url" class="stab-input" value="${_esc(provider?.baseUrl || '')}" placeholder="https://api.openai.com/v1">
          </div>
          <div class="stab-form-group stab-col-2">
            <label class="stab-label">${_t('ai.settings.apiKey', 'مفتاح API')}</label>
            <div class="stab-input-group">
              <input type="password" id="pf-key" class="stab-input" value="${_esc(provider?.apiKey || '')}" placeholder="sk-...">
              <button type="button" class="stab-input-addon" onclick="document.getElementById('pf-key').type = document.getElementById('pf-key').type === 'password' ? 'text' : 'password'">
                <i class="fas fa-eye"></i>
              </button>
            </div>
          </div>
          <div class="stab-form-group">
            <label class="stab-label">${_t('ai.settings.icon', 'أيقونة')}</label>
            <select id="pf-icon" class="stab-select">
              ${icons.map(ic => `<option value="${ic}" ${(provider?.icon || 'fa-robot') === ic ? 'selected' : ''}><i class="fas ${ic}"></i> ${ic}</option>`).join('')}
            </select>
          </div>
          <div class="stab-form-group">
            <label class="stab-label">${_t('ai.settings.color', 'اللون')}</label>
            <input type="color" id="pf-color" class="stab-color" value="${_esc(provider?.color || '#6366f1')}">
          </div>
          <div class="stab-form-group stab-col-2">
            <label class="stab-label">${_t('ai.settings.customHeaders', 'رؤوس مخصصة')} <small>(JSON)</small></label>
            <textarea id="pf-headers" class="stab-input stab-textarea" rows="2" placeholder='{"X-Custom": "value"}'>${_esc(provider?.customHeaders ? JSON.stringify(provider.customHeaders, null, 2) : '')}</textarea>
          </div>
          <div class="stab-form-group stab-col-2">
            <label class="stab-label">${_t('ai.settings.description', 'وصف')}</label>
            <input type="text" id="pf-desc" class="stab-input" value="${_esc(provider?.description || '')}" placeholder="Short description...">
          </div>
        </div>
        <div id="pf-test-result" class="stab-test-result" style="display:none"></div>
      </div>
      <div class="stab-modal-footer">
        <button class="stab-btn stab-btn-secondary" onclick="closeProviderModal()">${_t('btn.cancel', 'إلغاء')}</button>
        <button class="stab-btn stab-btn-outline" onclick="stabTestProviderFromModal()">${_t('ai.settings.testConnection', 'اختبار الاتصال')}</button>
        <button class="stab-btn stab-btn-primary" onclick="saveProvider()">${_t('btn.save', 'حفظ')}</button>
      </div>
    `;
  }

  window.openAddProviderModal = function () {
    if (typeof WorkspaceState !== 'undefined') WorkspaceState.editingProvider = null;
    const modal = document.getElementById('providerModal');
    const content = _getProviderModalContent();
    if (!modal) {
      showError('Provider modal not found', 'The settings page needs to be rendered first', 'Navigate to AI Settings and try again');
      return;
    }
    if (!content) {
      showError('Provider modal content not found', 'Modal container missing', 'Refresh the page and navigate back to AI Settings');
      return;
    }
    content.el.innerHTML = _buildProviderForm(null);
    modal.style.display = 'flex';
  };

  window.openEditProviderModal = function (id) {
    const provider = (typeof AIProviders !== 'undefined') ? AIProviders.getById(id) : null;
    if (!provider) {
      showError('Provider not found', `Provider ID "${id}" does not exist`, 'Refresh the page and try again');
      return;
    }
    if (typeof WorkspaceState !== 'undefined') WorkspaceState.editingProvider = id;
    const modal = document.getElementById('providerModal');
    const content = _getProviderModalContent();
    if (!modal || !content) {
      showError('Provider modal not found', 'Settings page modal is missing', 'Navigate to AI Settings and try again');
      return;
    }
    content.el.innerHTML = _buildProviderForm(provider);
    modal.style.display = 'flex';
  };

  window.closeProviderModal = function () {
    const modal = document.getElementById('providerModal');
    if (modal) modal.style.display = 'none';
  };

  window.saveProvider = function () {
    const name = (document.getElementById('pf-name')?.value || '').trim();
    const baseUrl = (document.getElementById('pf-url')?.value || '').trim();
    const apiKey = (document.getElementById('pf-key')?.value || '').trim();
    const type = document.getElementById('pf-type')?.value || 'custom';
    const icon = document.getElementById('pf-icon')?.value || 'fa-robot';
    const color = document.getElementById('pf-color')?.value || '#6366f1';
    const description = (document.getElementById('pf-desc')?.value || '').trim();
    const headersRaw = (document.getElementById('pf-headers')?.value || '').trim();

    if (!name) {
      showError('Provider name required', 'Provider name cannot be empty', 'Enter a name for this provider');
      return;
    }
    if (!baseUrl) {
      showError('Base URL required', 'A base URL is required to make API calls', 'Enter the API endpoint URL (e.g. https://api.openai.com/v1)');
      return;
    }

    let customHeaders = {};
    if (headersRaw) {
      try { customHeaders = JSON.parse(headersRaw); }
      catch (e) {
        showError('Invalid JSON in Custom Headers', 'Custom headers must be valid JSON', 'Use format: {"Header-Name": "value"}');
        return;
      }
    }

    const editingId = (typeof WorkspaceState !== 'undefined') ? WorkspaceState.editingProvider : null;

    if (editingId) {
      const existing = AIProviders.getById(editingId);
      AIProviders.save({ ...existing, name, baseUrl, apiKey, type, icon, color, description, customHeaders });
    } else {
      const newProvider = {
        id: 'custom_' + Date.now(),
        name, baseUrl, apiKey, type, icon, color, description, customHeaders,
        enabled: true, isDefault: false, models: [],
        connectionStatus: 'untested'
      };
      AIProviders.save(newProvider);
    }

    window.closeProviderModal();
    if (typeof renderAISettingsPage === 'function') renderAISettingsPage();
    if (typeof showToast === 'function') showToast(_t('toast.saved', 'تم الحفظ'), 'success');
  };

  window.deleteProvider = function (id) {
    const provider = (typeof AIProviders !== 'undefined') ? AIProviders.getById(id) : null;
    if (!provider) return;
    if (!confirm(_t('ai.settings.confirmDelete', 'Are you sure you want to delete this provider?'))) return;
    AIProviders.delete(id);
    if (typeof renderAISettingsPage === 'function') renderAISettingsPage();
    if (typeof showToast === 'function') showToast(_t('toast.deleted', 'تم الحذف'), 'info');
  };

  window.toggleProvider = function (id, enabled) {
    const provider = (typeof AIProviders !== 'undefined') ? AIProviders.getById(id) : null;
    if (provider) AIProviders.save({ ...provider, enabled });
    if (typeof renderAISettingsPage === 'function') renderAISettingsPage();
  };

  // Test provider from the modal's "Test Connection" button
  window.stabTestProviderFromModal = async function () {
    const baseUrl = (document.getElementById('pf-url')?.value || '').trim();
    const apiKey = (document.getElementById('pf-key')?.value || '').trim();
    const resultEl = document.getElementById('pf-test-result');
    if (!resultEl) return;

    if (!baseUrl) {
      resultEl.style.display = 'flex';
      resultEl.className = 'stab-test-result error';
      resultEl.innerHTML = '<i class="fas fa-times-circle"></i> Base URL is required to test';
      return;
    }

    resultEl.style.display = 'flex';
    resultEl.className = 'stab-test-result testing';
    resultEl.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Testing connection...';

    try {
      // Build a minimal test provider object
      const type = document.getElementById('pf-type')?.value || 'custom';
      const testProvider = { id: 'test_temp', baseUrl, apiKey, type };

      if (window.AIProviderValidator) {
        const result = await AIProviderValidator.testConnection(testProvider, null);
        const disp = AIProviderValidator.getStatusDisplay(result.status);
        const ok = result.status === 'connected';
        resultEl.className = 'stab-test-result ' + (ok ? 'success' : 'error');
        resultEl.innerHTML = `<i class="fas ${disp.icon}" style="color:${disp.color}"></i> ${disp.label}${result.latency ? ` (${result.latency}ms)` : ''}${result.message ? ` — ${_esc(result.message)}` : ''}`;
      } else {
        // Fallback: try a basic fetch to the URL
        const resp = await fetch(baseUrl, { method: 'GET', signal: AbortSignal.timeout(5000) });
        resultEl.className = 'stab-test-result ' + (resp.ok || resp.status < 500 ? 'success' : 'error');
        resultEl.innerHTML = `<i class="fas fa-${resp.ok ? 'check' : 'exclamation'}-circle"></i> HTTP ${resp.status}`;
      }
    } catch (err) {
      resultEl.className = 'stab-test-result error';
      const isTimeout = err.name === 'TimeoutError' || err.name === 'AbortError';
      resultEl.innerHTML = `<i class="fas fa-times-circle"></i> ${isTimeout ? 'Connection timed out' : _esc(err.message)}`;
    }
  };

  /* ============================================================
     P2 + P6 — MODEL MODAL + VALIDATION
     Fixes: model modal pointing to wrong IDs,
            adds real validateModel() with API check
     The enhanced page uses: modelModal + modelModalContent
     ============================================================ */

  function _getModelModalContent() {
    let el = document.getElementById('modelModalContent');
    if (el) return { el, type: 'enhanced' };
    el = document.getElementById('modelModalBody');
    if (el) return { el, type: 'legacy' };
    return null;
  }

  function _buildModelForm(model) {
    const caps = ['text', 'vision', 'code', 'reasoning', 'function_calling', 'embeddings', 'audio'];
    const selectedCaps = model?.capabilities || ['text'];

    return `
      <div class="stab-modal-header">
        <h2 class="stab-modal-title">
          <i class="fas fa-microchip"></i>
          ${model ? _t('ai.settings.editModel', 'Edit Model') : _t('ai.settings.addModel', 'إضافة نموذج')}
        </h2>
        <button class="stab-modal-close" onclick="closeModelModal()"><i class="fas fa-times"></i></button>
      </div>
      <div class="stab-modal-body">
        <div class="stab-form-grid">
          <div class="stab-form-group">
            <label class="stab-label">${_t('ai.settings.modelName', 'اسم النموذج')} <span class="required">*</span></label>
            <input type="text" id="mf-name" class="stab-input" value="${_esc(model?.name || '')}" placeholder="e.g. GPT-4o">
          </div>
          <div class="stab-form-group">
            <label class="stab-label">${_t('ai.settings.modelId', 'معرف النموذج')} <span class="required">*</span></label>
            <input type="text" id="mf-id" class="stab-input" value="${_esc(model?.id || '')}" placeholder="e.g. gpt-4o">
          </div>
          <div class="stab-form-group">
            <label class="stab-label">${_t('ai.settings.contextWindow', 'نافذة السياق')}</label>
            <input type="number" id="mf-ctx" class="stab-input" value="${model?.contextWindow || 128000}" min="1000">
          </div>
          <div class="stab-form-group">
            <label class="stab-label">${_t('ai.settings.maxTokens', 'الحد الأقصى للرموز')}</label>
            <input type="number" id="mf-max" class="stab-input" value="${model?.maxTokens || 4096}" min="256">
          </div>
          <div class="stab-form-group">
            <label class="stab-label">${_t('ai.settings.inputCost', 'تكلفة الإدخال')} ($/M)</label>
            <input type="number" id="mf-in-cost" class="stab-input" step="0.001" min="0" value="${model?.inputCost || 0}">
          </div>
          <div class="stab-form-group">
            <label class="stab-label">${_t('ai.settings.outputCost', 'تكلفة الإخراج')} ($/M)</label>
            <input type="number" id="mf-out-cost" class="stab-input" step="0.001" min="0" value="${model?.outputCost || 0}">
          </div>
          <div class="stab-form-group stab-col-2">
            <label class="stab-label">${_t('ai.settings.temperature', 'درجة الإبداعية')} <span id="mf-temp-val">${model?.temperature ?? 0.7}</span></label>
            <input type="range" id="mf-temp" class="stab-range" min="0" max="2" step="0.1" value="${model?.temperature ?? 0.7}" oninput="document.getElementById('mf-temp-val').textContent=this.value">
          </div>
          <div class="stab-form-group stab-col-2">
            <label class="stab-label">${_t('ai.settings.capabilities', 'القدرات')}</label>
            <div class="stab-caps-grid">
              ${caps.map(cap => `
                <label class="stab-cap-check">
                  <input type="checkbox" name="mf-cap" value="${cap}" ${selectedCaps.includes(cap) ? 'checked' : ''}>
                  <span>${cap}</span>
                </label>
              `).join('')}
            </div>
          </div>
        </div>
        <div id="mf-validate-result" class="stab-test-result" style="display:none"></div>
      </div>
      <div class="stab-modal-footer">
        <button class="stab-btn stab-btn-secondary" onclick="closeModelModal()">${_t('btn.cancel', 'إلغاء')}</button>
        <button class="stab-btn stab-btn-outline" onclick="validateModel()">${_t('ai.settings.validateModel', 'التحقق من النموذج')}</button>
        <button class="stab-btn stab-btn-primary" onclick="saveModel()">${_t('btn.save', 'حفظ')}</button>
      </div>
    `;
  }

  window.openAddModelModal = function (providerId) {
    if (typeof WorkspaceState !== 'undefined') {
      WorkspaceState.editingModel = null;
      WorkspaceState.editingProvider = providerId;
    }
    const modal = document.getElementById('modelModal');
    const content = _getModelModalContent();
    if (!modal || !content) {
      showError('Model modal not found', 'Settings page needs to be rendered first', 'Navigate to AI Settings and try again');
      return;
    }
    content.el.innerHTML = _buildModelForm(null);
    modal.style.display = 'flex';
  };

  window.openEditModelModal = function (providerId, modelId) {
    const provider = (typeof AIProviders !== 'undefined') ? AIProviders.getById(providerId) : null;
    const model = provider?.models?.find(m => m.id === modelId);
    if (typeof WorkspaceState !== 'undefined') {
      WorkspaceState.editingProvider = providerId;
      WorkspaceState.editingModel = modelId;
    }
    const modal = document.getElementById('modelModal');
    const content = _getModelModalContent();
    if (!modal || !content) {
      showError('Model modal not found', 'Settings page needs to be rendered first', 'Navigate to AI Settings');
      return;
    }
    content.el.innerHTML = _buildModelForm(model || null);
    modal.style.display = 'flex';
  };

  window.closeModelModal = function () {
    const modal = document.getElementById('modelModal');
    if (modal) modal.style.display = 'none';
  };

  window.saveModel = function () {
    const name = (document.getElementById('mf-name')?.value || '').trim();
    const id = (document.getElementById('mf-id')?.value || '').trim();
    if (!name) {
      showError('Model name required', 'Display name cannot be empty', 'Enter a name like "GPT-4o"');
      return;
    }
    if (!id) {
      showError('Model ID required', 'Model ID is used for API calls', 'Enter the exact model identifier (e.g. gpt-4o)');
      return;
    }

    const caps = Array.from(document.querySelectorAll('input[name="mf-cap"]:checked')).map(c => c.value);

    const modelData = {
      name, id,
      contextWindow: parseInt(document.getElementById('mf-ctx')?.value || 128000),
      maxTokens: parseInt(document.getElementById('mf-max')?.value || 4096),
      inputCost: parseFloat(document.getElementById('mf-in-cost')?.value || 0),
      outputCost: parseFloat(document.getElementById('mf-out-cost')?.value || 0),
      temperature: parseFloat(document.getElementById('mf-temp')?.value || 0.7),
      capabilities: caps.length ? caps : ['text']
    };

    const editingModel = (typeof WorkspaceState !== 'undefined') ? WorkspaceState.editingModel : null;
    const editingProvider = (typeof WorkspaceState !== 'undefined') ? WorkspaceState.editingProvider : null;

    if (editingModel && editingProvider) {
      AIProviders.updateModel(editingProvider, editingModel, modelData);
    } else if (editingProvider) {
      AIProviders.addModel(editingProvider, modelData);
    } else {
      showError('No provider selected', 'Cannot save model without a provider', 'Click "Add Model" button from a provider card');
      return;
    }

    window.closeModelModal();
    if (typeof renderAISettingsPage === 'function') renderAISettingsPage();
    if (typeof showToast === 'function') showToast(_t('toast.saved', 'تم الحفظ'), 'success');
  };

  /* P6 — Model Validation with real API check */
  window.validateModel = async function () {
    const modelId = (document.getElementById('mf-id')?.value || '').trim();
    const resultEl = document.getElementById('mf-validate-result');
    if (!resultEl) return;

    if (!modelId) {
      resultEl.style.display = 'flex';
      resultEl.className = 'stab-test-result error';
      resultEl.innerHTML = '<i class="fas fa-times-circle"></i> Enter a Model ID first';
      return;
    }

    const editingProvider = (typeof WorkspaceState !== 'undefined') ? WorkspaceState.editingProvider : null;
    const provider = editingProvider && typeof AIProviders !== 'undefined' ? AIProviders.getById(editingProvider) : null;

    resultEl.style.display = 'flex';
    resultEl.className = 'stab-test-result testing';
    resultEl.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Validating model...';

    // Step 1: Check provider reachable & API key valid
    if (!provider) {
      resultEl.className = 'stab-test-result error';
      resultEl.innerHTML = '<i class="fas fa-times-circle"></i> Provider not found — save provider first';
      return;
    }
    if (!provider.apiKey) {
      resultEl.className = 'stab-test-result error';
      resultEl.innerHTML = '<i class="fas fa-exclamation-triangle"></i> No API key — enter API key in Base URL field first';
      return;
    }

    // Step 2: Try real validation via AIProviderValidator
    if (window.AIProviderValidator) {
      try {
        const result = await AIProviderValidator.testConnection(provider, modelId);
        const disp = AIProviderValidator.getStatusDisplay(result.status);
        const ok = result.status === 'connected';

        resultEl.className = 'stab-test-result ' + (ok ? 'success' : 'error');
        resultEl.innerHTML = `
          <i class="fas ${disp.icon}" style="color:${disp.color}"></i>
          <div>
            <strong>${disp.label}</strong>
            ${result.latency ? `<span> — ${result.latency}ms</span>` : ''}
            ${result.message ? `<br><small>${_esc(result.message)}</small>` : ''}
          </div>
        `;

        // Update provider's connectionStatus
        AIProviders.save({ ...provider, connectionStatus: result.status });
      } catch (err) {
        resultEl.className = 'stab-test-result error';
        resultEl.innerHTML = `<i class="fas fa-times-circle"></i> ${_esc(err.message)}`;
      }
    } else {
      resultEl.className = 'stab-test-result info';
      resultEl.innerHTML = '<i class="fas fa-info-circle"></i> Validator not loaded — model saved without validation';
    }
  };

  /* ============================================================
     P5 — Enhanced Provider Card with full model management
     Override _renderProviderCard to include Add Model button
     and full model list with edit/delete
     ============================================================ */

  function _buildEnhancedProviderCard(provider, isActive) {
    const diag = window.AIProviderDiagnostics ? AIProviderDiagnostics.get(provider.id) : null;
    const status = provider.connectionStatus || 'untested';
    const statusDisp = window.AIProviderValidator ? AIProviderValidator.getStatusDisplay(status) : { label: status, color: '#6b7280', icon: 'fa-circle' };
    const avgLatency = diag ? AIProviderDiagnostics.getAverageLatency(provider.id) : 0;
    const models = provider.models || [];
    const activeModelId = typeof AIProviders !== 'undefined' ? AIProviders.getActiveModel()?.id : null;

    return `
      <div class="provider-card ${isActive ? 'active' : ''} status-${status}" data-provider-id="${provider.id}">
        <div class="provider-card-header">
          <div class="provider-icon" style="background:${provider.color || '#6c63ff'}22; color:${provider.color || '#6c63ff'}">
            <i class="fas ${provider.icon || 'fa-robot'}"></i>
          </div>
          <div class="provider-info">
            <h3>${_esc(provider.name)}</h3>
            <span class="provider-url">${_esc(provider.baseUrl || '')}</span>
          </div>
          <div class="provider-status" style="color:${statusDisp.color}">
            <i class="fas ${statusDisp.icon}"></i>
            <span id="provStatus_${provider.id}">${statusDisp.label}</span>
          </div>
        </div>

        ${diag ? `
        <div class="provider-mini-stats">
          <span><i class="fas fa-tachometer-alt"></i> ${avgLatency}ms</span>
          <span><i class="fas fa-exchange-alt"></i> ${diag.requestCount || 0} ${_t('diag.requests', 'req')}</span>
          <span><i class="fas fa-times-circle"></i> ${diag.errorCount || 0} ${_t('diag.errors', 'err')}</span>
          <span><i class="fas fa-coins"></i> ${diag.totalTokens || 0} ${_t('diag.tokens', 'tok')}</span>
        </div>` : ''}

        <div class="provider-models-section">
          <div class="provider-models-header">
            <span><i class="fas fa-microchip"></i> ${models.length} ${_t('ai.settings.models', 'نموذج')}</span>
            <button class="btn-xs btn-outline" onclick="openAddModelModal('${provider.id}')">
              <i class="fas fa-plus"></i> ${_t('ai.settings.addModel', 'إضافة نموذج')}
            </button>
          </div>
          ${models.length > 0 ? `
          <div class="provider-models-list">
            ${models.slice(0, 4).map(m => `
              <div class="model-row ${activeModelId === m.id ? 'active-model' : ''}" onclick="AIProviders.setActive('${provider.id}','${m.id}');renderAISettingsPage()" title="${_t('ai.settings.setActive', 'Set as active')}">
                <span class="model-row-name">${_esc(m.name)}</span>
                <span class="model-row-id">${_esc(m.id)}</span>
                ${m.contextWindow ? `<span class="model-badge">${(m.contextWindow/1000).toFixed(0)}k</span>` : ''}
                ${activeModelId === m.id ? `<span class="model-active-dot"><i class="fas fa-check-circle"></i></span>` : ''}
                <div class="model-row-actions" onclick="event.stopPropagation()">
                  <button class="btn-micro" onclick="openEditModelModal('${provider.id}','${m.id}')" title="Edit"><i class="fas fa-edit"></i></button>
                  <button class="btn-micro btn-danger-micro" onclick="deleteModel('${provider.id}','${m.id}')" title="Delete"><i class="fas fa-trash"></i></button>
                </div>
              </div>
            `).join('')}
            ${models.length > 4 ? `<div class="model-row-more">+${models.length - 4} more</div>` : ''}
          </div>` : `<div class="models-empty">${_t('ai.settings.noModels', 'لا توجد نماذج')} — <button class="btn-link" onclick="openAddModelModal('${provider.id}')">${_t('ai.settings.addFirst', 'Add first model')}</button></div>`}
        </div>

        <div class="provider-api-key-row">
          <i class="fas fa-key"></i>
          <input type="password" class="stab-key-input" value="${_esc(provider.apiKey || '')}" placeholder="${_t('ai.settings.apiKey', 'API Key')}..."
                 onchange="saveProviderApiKey('${provider.id}', this.value)" id="stabkey-${provider.id}">
          <button class="btn-micro" onclick="document.getElementById('stabkey-${provider.id}').type = document.getElementById('stabkey-${provider.id}').type==='password'?'text':'password'">
            <i class="fas fa-eye"></i>
          </button>
        </div>

        <div class="provider-card-actions">
          ${isActive
            ? `<span class="active-badge"><i class="fas fa-check-circle"></i> ${_t('ai.settings.active', 'Active')}</span>`
            : `<button class="btn-xs btn-primary" onclick="AIProviders.setActive('${provider.id}');renderAISettingsPage()">${_t('ai.settings.setActive', 'تفعيل')}</button>`
          }
          <label class="stab-toggle-sm" title="${_t('ai.settings.enable', 'Enable/Disable')}">
            <input type="checkbox" ${provider.enabled ? 'checked' : ''} onchange="toggleProvider('${provider.id}',this.checked)">
            <span class="stab-toggle-slider"></span>
          </label>
          <button class="btn-xs btn-secondary" onclick="testProviderConnection('${provider.id}')" id="testBtn_${provider.id}">
            <i class="fas fa-plug"></i> ${_t('ai.settings.testConnection', 'اختبار')}
          </button>
          <button class="btn-xs btn-ghost" onclick="openEditProviderModal('${provider.id}')" title="Edit">
            <i class="fas fa-edit"></i>
          </button>
          <button class="btn-xs btn-danger" onclick="deleteProvider('${provider.id}')" title="Delete">
            <i class="fas fa-trash"></i>
          </button>
        </div>
      </div>
    `;
  }

  // Override the enhanced page's _renderProviderCard once it's available
  window._renderProviderCard = _buildEnhancedProviderCard;

  // Also override the workspace renderProviderCard so old renderer still works
  window.renderProviderCard = function (provider) {
    const active = typeof AIProviders !== 'undefined' ? AIProviders.getActiveProvider() : null;
    return _buildEnhancedProviderCard(provider, active?.id === provider.id);
  };

  window.deleteModel = function (providerId, modelId) {
    if (!confirm(_t('ai.settings.confirmDeleteModel', 'Delete this model?'))) return;
    if (typeof AIProviders !== 'undefined') AIProviders.deleteModel(providerId, modelId);
    if (typeof renderAISettingsPage === 'function') renderAISettingsPage();
    if (typeof showToast === 'function') showToast(_t('toast.deleted', 'تم الحذف'), 'info');
  };

  window.saveProviderApiKey = function (id, key) {
    const provider = typeof AIProviders !== 'undefined' ? AIProviders.getById(id) : null;
    if (provider) AIProviders.save({ ...provider, apiKey: key });
    if (typeof showToast === 'function') showToast(_t('toast.saved', 'تم حفظ المفتاح'), 'success');
  };

  /* ============================================================
     P3 — FLOATING DOCK NAVIGATION FIXES
     Wire AI Assistant → showAIPage('ai-workspace')
     Wire User Guide → showAIPage guide behavior
     Wire Quick Actions → real navigation
     ============================================================ */

  // Wait for DockSystem to be initialized, then patch quick actions
  function _patchDockSystem() {
    if (typeof DockSystem === 'undefined') {
      setTimeout(_patchDockSystem, 300);
      return;
    }

    // Patch quickAction to ensure all types navigate correctly
    const origQuickAction = DockSystem.quickAction ? DockSystem.quickAction.bind(DockSystem) : null;

    DockSystem.quickAction = function (type) {
      // Close dock first
      if (DockSystem.close) DockSystem.close();

      switch (type) {
        case 'session':
          if (window.showPage) showPage('dashboard', null);
          break;
        case 'ai':
          if (window.showAIPage) showAIPage('ai-workspace', null);
          else if (window.showPage) showPage('ai-workspace', null);
          break;
        case 'schedule':
          if (window.showPage) showPage('weekly', null);
          break;
        case 'goal':
          // Open AI panel pre-filled with goal prompt
          if (DockSystem.openPanel) DockSystem.openPanel('ai');
          setTimeout(() => {
            const input = document.getElementById('dockAIInput');
            if (input) {
              input.value = _t('quick.addGoal', 'أضف هدفاً جديداً: ');
              input.focus();
            }
          }, 250);
          break;
        case 'timer':
          if (window.showPage) showPage('dashboard', null);
          setTimeout(() => {
            const btn = document.querySelector('[onclick*="startTimer"], .timer-start-btn, #startBtn');
            if (btn) btn.click();
          }, 300);
          break;
        case 'stats':
          if (window.showPage) showPage('statistics', null);
          break;
        default:
          if (origQuickAction) origQuickAction(type);
      }
    };

    // Patch openPanel to ensure AI panel opens AI workspace link too
    const origOpen = DockSystem.open ? DockSystem.open.bind(DockSystem) : null;
    window._dockPatched = true;
  }

  // Patch dock panel "Go to AI Workspace" button behavior
  function _addDockWorkspaceLink() {
    // Patch navigateTo inside dock if exists
    if (window.DockSystem) {
      window.DockSystem.navigateToAI = function () {
        if (DockSystem.close) DockSystem.close();
        if (window.showAIPage) showAIPage('ai-workspace', null);
        else if (window.showPage) showPage('ai-workspace', null);
      };
    }
  }

  setTimeout(_patchDockSystem, 800);
  setTimeout(_addDockWorkspaceLink, 1000);

  /* ============================================================
     P4 — TRANSLATION SYSTEM: fix hardcoded strings
     The enhanced page uses t() calls but some strings are still
     in English fallback. We extend the translation observer to
     re-translate on language switch.
     ============================================================ */

  function _registerTranslationObserver() {
    if (typeof onLanguageChange === 'function') {
      onLanguageChange(function () {
        // Re-render all AI pages that are currently visible
        const pages = ['ai-settings', 'ai-workspace', 'ai-analytics', 'ai-automation', 'ai-personality'];
        pages.forEach(function (pg) {
          const el = document.getElementById('page-' + pg);
          if (el && el.classList.contains('active')) {
            const renderers = {
              'ai-settings': window.renderAISettingsPage,
              'ai-workspace': window.renderAIWorkspacePage,
              'ai-analytics': window.renderAIAnalyticsPage,
              'ai-automation': window.renderAIAutomationPage,
              'ai-personality': window.renderAIPersonalityPage,
            };
            if (renderers[pg]) renderers[pg]();
          }
        });

        // Update dock system language
        if (window.DockSystem && DockSystem.applyTranslations) {
          DockSystem.applyTranslations();
        }

        // Update all data-i18n elements globally
        if (window.applyTranslations) applyTranslations(document.body);
      });
    } else {
      setTimeout(_registerTranslationObserver, 500);
    }
  }

  _registerTranslationObserver();

  /* Fix missing translation keys by patching t() to never return undefined */
  const _origT = window.t;
  if (_origT) {
    window.t = function (key, params) {
      const result = _origT(key, params);
      // If result is the key itself (translation missing), return a cleaned fallback
      if (result === key && key.includes('.')) {
        // Return the last segment as a readable label
        const parts = key.split('.');
        return parts[parts.length - 1].replace(/_/g, ' ');
      }
      return result;
    };
  }

  /* ============================================================
     P8 — ENHANCED DIAGNOSTICS CENTER
     Patch _renderDiagnosticsContent in enhancements if it exists
     to show all required fields: Provider, Model, Status, Latency,
     Tokens, Request Count, Last Error, Last Success
     ============================================================ */

  function _buildDiagnosticsTable(providers) {
    const allDiag = window.AIProviderDiagnostics ? AIProviderDiagnostics.getAll() : {};

    if (Object.keys(allDiag).length === 0 && providers.every(p => !allDiag[p.id])) {
      return `
        <div class="empty-state">
          <i class="fas fa-stethoscope"></i>
          <h3>${_t('diag.empty', 'لا توجد بيانات تشخيصية')}</h3>
          <p>${_t('diag.emptyHint', 'اختبر اتصال مزود أو أرسل رسالة ذكاء اصطناعي أولاً')}</p>
        </div>`;
    }

    return `
      <div class="stab-diag-container">
        <div class="stab-diag-header-bar">
          <span>${_t('diag.title', 'مركز التشخيص')}</span>
          <button class="btn-xs btn-ghost" onclick="if(window.AIProviderDiagnostics){AIProviderDiagnostics.clearAll ? AIProviderDiagnostics.clearAll() : Object.keys(AIProviderDiagnostics.getAll()).forEach(id=>AIProviderDiagnostics.clear(id));renderAISettingsPage();}">${_t('diag.clearAll', 'مسح الكل')}</button>
        </div>
        <div class="stab-diag-grid">
          ${providers.map(p => {
            const d = allDiag[p.id];
            if (!d && !p.connectionStatus) return '';
            const avgLatency = d && d.requestCount > 0 ? Math.round(d.totalLatency / d.requestCount) : 0;
            const successRate = d && d.requestCount > 0 ? Math.round(((d.requestCount - (d.errorCount || 0)) / d.requestCount) * 100) : 0;
            const lastStatus = d?.lastStatus || p.connectionStatus || 'untested';
            const statusDisp = window.AIProviderValidator ? AIProviderValidator.getStatusDisplay(lastStatus) : { label: lastStatus, color: '#6b7280', icon: 'fa-circle' };
            const activeModel = typeof AIProviders !== 'undefined' ? AIProviders.getActiveModel() : null;

            return `
              <div class="stab-diag-card">
                <div class="stab-diag-card-header">
                  <div style="display:flex;align-items:center;gap:8px">
                    <i class="fas ${p.icon || 'fa-robot'}" style="color:${p.color || '#6c63ff'}"></i>
                    <strong>${_esc(p.name)}</strong>
                  </div>
                  <span style="font-size:11px;color:${statusDisp.color}">
                    <i class="fas ${statusDisp.icon}"></i> ${statusDisp.label}
                  </span>
                </div>
                <div class="stab-diag-rows">
                  <div class="stab-diag-row">
                    <span class="stab-diag-label">${_t('diag.model', 'النموذج')}</span>
                    <span class="stab-diag-value">${activeModel && AIProviders.getActiveProvider()?.id === p.id ? _esc(activeModel.name) : (p.models?.[0]?.name || '—')}</span>
                  </div>
                  <div class="stab-diag-row">
                    <span class="stab-diag-label">${_t('diag.latency', 'التأخير')}</span>
                    <span class="stab-diag-value">${d ? avgLatency + 'ms' : '—'}</span>
                  </div>
                  <div class="stab-diag-row">
                    <span class="stab-diag-label">${_t('diag.tokens', 'الرموز المستخدمة')}</span>
                    <span class="stab-diag-value">${d ? (d.totalTokens || 0).toLocaleString() : '—'}</span>
                  </div>
                  <div class="stab-diag-row">
                    <span class="stab-diag-label">${_t('diag.requests', 'عدد الطلبات')}</span>
                    <span class="stab-diag-value">${d ? (d.requestCount || 0) : '—'}</span>
                  </div>
                  <div class="stab-diag-row">
                    <span class="stab-diag-label">${_t('diag.successRate', 'نسبة النجاح')}</span>
                    <span class="stab-diag-value" style="color:${successRate >= 80 ? '#22c55e' : '#ef4444'}">${d ? successRate + '%' : '—'}</span>
                  </div>
                  <div class="stab-diag-row">
                    <span class="stab-diag-label">${_t('diag.lastError', 'آخر خطأ')}</span>
                    <span class="stab-diag-value stab-diag-error">${d?.lastError ? _esc((typeof d.lastError === 'string' ? d.lastError : (d.lastError?.message || JSON.stringify(d.lastError) || '')).substring(0, 60)) : '—'}</span>
                  </div>
                  <div class="stab-diag-row">
                    <span class="stab-diag-label">${_t('diag.lastSuccess', 'آخر نجاح')}</span>
                    <span class="stab-diag-value">${d?.lastResponse ? new Date(d.lastResponse).toLocaleTimeString() : '—'}</span>
                  </div>
                </div>
                <div class="stab-diag-card-actions">
                  <button class="btn-xs btn-secondary" onclick="testProviderConnection('${p.id}')">
                    <i class="fas fa-plug"></i> ${_t('ai.settings.testConnection', 'اختبار')}
                  </button>
                  <button class="btn-xs btn-ghost" onclick="if(window.AIProviderDiagnostics){AIProviderDiagnostics.clear('${p.id}');renderAISettingsPage();}">
                    <i class="fas fa-trash-alt"></i> ${_t('diag.clear', 'مسح')}
                  </button>
                </div>
              </div>
            `;
          }).filter(Boolean).join('')}
        </div>
      </div>
    `;
  }

  // Override _renderDiagnosticsContent used inside ai-enhancements.js
  window._renderDiagnosticsContent = _buildDiagnosticsTable;

  /* ============================================================
     GLOBAL ERROR CATCH — prevents silent failures
     Wraps onclick handlers to show errors instead of silently failing
     ============================================================ */

  window.addEventListener('error', function (e) {
    // Only show errors from our app code, not browser extensions
    if (e.filename && (e.filename.includes('stabilization') ||
        e.filename.includes('ai-workspace') ||
        e.filename.includes('ai-enhancements') ||
        e.filename.includes('floating-dock'))) {
      showError(
        'JavaScript Error: ' + (e.message || 'Unknown error'),
        e.filename ? e.filename.split('/').pop() + ':' + e.lineno : '',
        'Check browser console for full details'
      );
    }
  });

  window.addEventListener('unhandledrejection', function (e) {
    if (e.reason && e.reason.message) {
      showError(
        'Async Error: ' + e.reason.message,
        'An asynchronous operation failed',
        'Check API key and internet connection'
      );
    }
  });

  console.log('[Stabilization] Patch loaded — P1 P2 P3 P4 P5 P6 P7 P8 fixes active');

})();
