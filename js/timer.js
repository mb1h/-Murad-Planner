/* ============================================================
   MURAD LEARNING PLANNER - Timer System with Persistence
   ============================================================ */

// Active timers map: blockId -> { interval, remaining, total, status }
const timers = {};

function formatTime(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
  return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}

function getTimerEl(blockId) {
  return document.querySelector(`.block-card[data-block-id="${blockId}"] .block-timer-display`);
}
function getProgressEl(blockId) {
  return document.querySelector(`.block-card[data-block-id="${blockId}"] .timer-progress-bar`);
}
function getCardEl(blockId) {
  return document.querySelector(`.block-card[data-block-id="${blockId}"]`);
}

// Use the central daily data store for timer persistence
function saveTimerState(blockId, state) {
  try {
    if (!window.currentDayKey || !window.currentWeekNum) return;
    const key = getDayKey(window.currentWeekNum, window.currentDayKey);
    const data = DB.get(key) || {};
    if (!data.timerState) data.timerState = {};
    data.timerState[blockId] = state;
    DB.set(key, data);
  } catch (e) {
    console.error('[Timer] Save failed:', e);
  }
}

function loadTimerState() {
  try {
    if (!window.currentDayKey || !window.currentWeekNum) return {};
    const key = getDayKey(window.currentWeekNum, window.currentDayKey);
    const data = DB.get(key);
    return (data && data.timerState) ? data.timerState : {};
  } catch (e) {
    return {};
  }
}

function clearTimerState(blockId) {
  try {
    if (!window.currentDayKey || !window.currentWeekNum) return;
    const key = getDayKey(window.currentWeekNum, window.currentDayKey);
    const data = DB.get(key);
    if (data && data.timerState) {
      delete data.timerState[blockId];
      DB.set(key, data);
    }
  } catch (e) {}
}

function startTimer(blockId, durationMin) {
  if (timers[blockId] && timers[blockId].status === 'running') return;

  const totalSec = (durationMin || 45) * 60;

  if (!timers[blockId] || timers[blockId].status === 'idle' || timers[blockId].status === 'done') {
    timers[blockId] = { 
      remaining: totalSec, 
      total: totalSec, 
      status: 'running', 
      interval: null,
      startTime: Date.now()
    };
  } else if (timers[blockId].status === 'paused') {
    timers[blockId].status = 'running';
    timers[blockId].startTime = Date.now() - ((timers[blockId].total - timers[blockId].remaining) * 1000);
  }

  // PERSIST: Save to localStorage
  saveTimerState(blockId, {
    remaining: timers[blockId].remaining,
    total: timers[blockId].total,
    status: 'running',
    startTime: timers[blockId].startTime
  });

  const card = getCardEl(blockId);
  if (card) card.classList.add('timer-running');
  updateTimerButtons(blockId, 'running');

  timers[blockId].interval = setInterval(() => {
    if (timers[blockId].remaining <= 0) {
      clearInterval(timers[blockId].interval);
      timers[blockId].status = 'done';
      clearTimerState(blockId);
      onBlockFinished(blockId);
      return;
    }
    timers[blockId].remaining--;
    updateTimerDisplay(blockId);
    updateDashboardTimer(blockId);
    
    // Update storage every 10 seconds
    if (timers[blockId].remaining % 10 === 0) {
      saveTimerState(blockId, {
        remaining: timers[blockId].remaining,
        total: timers[blockId].total,
        status: 'running',
        startTime: timers[blockId].startTime
      });
    }
  }, 1000);

  updateTimerDisplay(blockId);
}

function pauseTimer(blockId) {
  if (!timers[blockId] || timers[blockId].status !== 'running') return;
  clearInterval(timers[blockId].interval);
  timers[blockId].status = 'paused';
  
  // Update persisted state
  saveTimerState(blockId, {
    remaining: timers[blockId].remaining,
    total: timers[blockId].total,
    status: 'paused',
    startTime: timers[blockId].startTime
  });
  
  const card = getCardEl(blockId);
  if (card) card.classList.remove('timer-running');
  updateTimerButtons(blockId, 'paused');
}

function resumeTimer(blockId, durationMin) {
  if (!timers[blockId] || timers[blockId].status !== 'paused') return;
  startTimer(blockId, durationMin);
}

function resetTimer(blockId, durationMin) {
  if (timers[blockId]) {
    clearInterval(timers[blockId].interval);
  }
  const totalSec = (durationMin || 45) * 60;
  timers[blockId] = { remaining: totalSec, total: totalSec, status: 'idle', interval: null, startTime: null };
  
  // Clear from storage
  clearTimerState(blockId);
  
  const card = getCardEl(blockId);
  if (card) card.classList.remove('timer-running', 'timer-finished');
  updateTimerDisplay(blockId);
  updateTimerButtons(blockId, 'idle');
}

function skipTimer(blockId) {
  if (timers[blockId]) {
    clearInterval(timers[blockId].interval);
    timers[blockId].status = 'done';
  }
  clearTimerState(blockId);
  const card = getCardEl(blockId);
  if (card) card.classList.remove('timer-running');
  updateTimerButtons(blockId, 'done');
  onBlockSkipped(blockId);
}

function restoreTimers() {
  const saved = loadTimerState();
  const now = Date.now();
  
  Object.keys(saved).forEach(blockId => {
    const t = saved[blockId];
    if (!t || t.status === 'done' || t.status === 'idle') return;
    
    if (t.status === 'running') {
      const elapsed = Math.floor((now - (t.startTime || now)) / 1000);
      const remaining = Math.max(0, t.total - elapsed);
      
      if (remaining > 0) {
        timers[blockId] = {
          remaining: remaining,
          total: t.total,
          status: 'running',
          interval: null,
          startTime: t.startTime
        };
        
        // Resume interval
        const card = getCardEl(blockId);
        if (card) card.classList.add('timer-running');
        updateTimerButtons(blockId, 'running');
        
        timers[blockId].interval = setInterval(() => {
          if (timers[blockId].remaining <= 0) {
            clearInterval(timers[blockId].interval);
            timers[blockId].status = 'done';
            clearTimerState(blockId);
            onBlockFinished(blockId);
            return;
          }
          timers[blockId].remaining--;
          updateTimerDisplay(blockId);
          updateDashboardTimer(blockId);
          
          if (timers[blockId].remaining % 10 === 0) {
            saveTimerState(blockId, {
              remaining: timers[blockId].remaining,
              total: timers[blockId].total,
              status: 'running',
              startTime: timers[blockId].startTime
            });
          }
        }, 1000);
        
        updateTimerDisplay(blockId);
      } else {
        // Timer expired while app was closed
        clearTimerState(blockId);
        timers[blockId] = { remaining: 0, total: t.total, status: 'done', interval: null, startTime: null };
        updateTimerDisplay(blockId);
        updateTimerButtons(blockId, 'done');
        onBlockFinished(blockId);
      }
    } else if (t.status === 'paused') {
      timers[blockId] = {
        remaining: t.remaining,
        total: t.total,
        status: 'paused',
        interval: null,
        startTime: t.startTime
      };
      updateTimerDisplay(blockId);
      updateTimerButtons(blockId, 'paused');
    }
  });
}

function updateTimerDisplay(blockId) {
  const timer = timers[blockId];
  if (!timer) return;
  const el = getTimerEl(blockId);
  if (el) el.textContent = formatTime(timer.remaining);
  const prog = getProgressEl(blockId);
  if (prog) {
    const pct = ((timer.total - timer.remaining) / timer.total) * 100;
    prog.style.width = Math.min(100, pct) + '%';
    if (timer.remaining <= 300) prog.style.background = 'linear-gradient(90deg, #ef4444, #f97316)';
    else prog.style.background = '';
  }
}

function updateTimerButtons(blockId, status) {
  const card = getCardEl(blockId);
  if (!card) return;
  const startBtn = card.querySelector('.timer-btn.start');
  const pauseBtn = card.querySelector('.timer-btn.pause');
  const resumeBtn = card.querySelector('.timer-btn.resume');

  if (startBtn) startBtn.style.display = status === 'idle' || status === 'done' ? 'flex' : 'none';
  if (pauseBtn) pauseBtn.style.display = status === 'running' ? 'flex' : 'none';
  if (resumeBtn) resumeBtn.style.display = status === 'paused' ? 'flex' : 'none';
}

function onBlockFinished(blockId) {
  const card = getCardEl(blockId);
  if (card) {
    card.classList.remove('timer-running');
    card.classList.add('timer-finished');
    setTimeout(() => card.classList.remove('timer-finished'), 2000);
  }
  updateTimerButtons(blockId, 'done');

  // Play alarm sound
  playAlarmSound(blockId);

  // Show notification
  if (settings.enableNotifications && 'Notification' in window) {
    const blockName = card?.querySelector('.block-name-input')?.value || 'Block';
    if (Notification.permission === 'granted') {
      new Notification('⏰ ' + (currentLang === 'ar' ? 'انتهى البلوك!' : 'Block Finished!'), {
        body: blockName,
        icon: '/favicon.ico',
      });
    } else if (Notification.permission !== 'denied') {
      Notification.requestPermission();
    }
  }

  // Show modal
  showBlockFinishedModal(blockId);

  // Update dashboard
  const statStatus = document.getElementById('stat-status');
  if (statStatus) statStatus.textContent = t('status.idle');
}

function onBlockSkipped(blockId) {
  showToast((currentLang === 'ar' ? 'تم تخطي البلوك' : 'Block skipped'), 'info');
}

function showBlockFinishedModal(blockId) {
  const card = getCardEl(blockId);
  const blockName = card?.querySelector('.block-name-input')?.value || 'Block';

  // Find next block
  const allCards = document.querySelectorAll('.block-card[data-block-id]');
  let nextName = '';
  for (let i = 0; i < allCards.length; i++) {
    if (allCards[i].getAttribute('data-block-id') === blockId && i + 1 < allCards.length) {
      nextName = allCards[i+1].querySelector('.block-name-input')?.value || '';
      window._nextBlockId = allCards[i+1].getAttribute('data-block-id');
      break;
    }
  }

  document.getElementById('finishedBlockName').textContent = blockName;
  document.getElementById('nextBlockName').textContent = nextName || (currentLang === 'ar' ? 'لا يوجد بلوك تالٍ' : 'No next block');
  document.getElementById('blockFinishedModal').style.display = 'flex';
}

function closeModal() {
  document.getElementById('blockFinishedModal').style.display = 'none';
}

function startNextBlock() {
  closeModal();
  const nextId = window._nextBlockId;
  if (!nextId) return;
  const nextCard = getCardEl(nextId);
  if (!nextCard) return;
  const dur = parseInt(nextCard.getAttribute('data-duration') || 45);
  nextCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
  setTimeout(() => startTimer(nextId, dur), 500);
}

function updateDashboardTimer(activeBlockId) {
  const timer = timers[activeBlockId];
  if (!timer) return;
  const el = document.getElementById('stat-timer');
  if (el) el.textContent = formatTime(timer.remaining);
  const statStatus = document.getElementById('stat-status');
  if (statStatus) statStatus.textContent = t('status.active');
}

// Restore timers on page load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => setTimeout(restoreTimers, 1000));
} else {
  setTimeout(restoreTimers, 1000);
}

// Request notification permission on load
if ('Notification' in window && Notification.permission === 'default') {
  Notification.requestPermission();
}