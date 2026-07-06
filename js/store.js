/**
 * store.js — Centralized State Management
 * Single Source of Truth for the entire application
 */

const Store = {
  state: {
    weekNum: 1,
    dayKey: 'sat',
    pattern: 'A',
    blocks: [],
    integration: { math: '', prog: '', cs: '', result: '', relation: '' },
    timerState: {},
    lastSaved: null,
  },

  listeners: [],
  subscribe(fn) { this.listeners.push(fn); },
  notify() { this.listeners.forEach(fn => fn(this.state)); },

  setDay(weekNum, dayKey, pattern) {
    this.state.weekNum = weekNum;
    this.state.dayKey = dayKey;
    this.state.pattern = pattern;
    this.persist();
    this.notify();
  },

  setBlocks(blocks) {
    this.state.blocks = blocks;
    this.persist();
    this.notify();
  },

  updateBlock(blockId, updates) {
    const block = this.state.blocks.find(b => b.id === blockId);
    if (block) {
      Object.assign(block, updates);
      this.persist();
      this.notify();
    }
  },

  setIntegration(data) {
    this.state.integration = { ...this.state.integration, ...data };
    this.persist();
    this.notify();
  },

  setTimerState(timerState) {
    this.state.timerState = { ...this.state.timerState, ...timerState };
    this.persist();
    this.notify();
  },

  clearTimerState() {
    this.state.timerState = {};
    this.persist();
    this.notify();
  },

  persist() {
    this.state.lastSaved = Date.now();
    try {
      localStorage.setItem('murad_appState', JSON.stringify(this.state));
    } catch (e) {
      console.error('[Store] Persist failed:', e);
    }
  },

  hydrate() {
    try {
      const saved = localStorage.getItem('murad_appState');
      if (saved) {
        const parsed = JSON.parse(saved);
        this.state = { ...this.state, ...parsed };
        this.notify();
        return true;
      }
    } catch (e) {
      console.error('[Store] Hydrate failed:', e);
    }
    return false;
  },

  getCurrentBlocks() { return this.state.blocks; },
  getCurrentDayKey() { return this.state.dayKey; },
  getCurrentWeekNum() { return this.state.weekNum; },
  getCurrentPattern() { return this.state.pattern; },
  getTimerState() { return this.state.timerState; },
};

// Initialize on load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => Store.hydrate());
} else {
  Store.hydrate();
}

window.Store = Store;