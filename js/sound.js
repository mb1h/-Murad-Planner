/* ============================================================
   MURAD LEARNING PLANNER - Sound System
   ============================================================ */

// Sound definitions using Web Audio API (no external files needed)
const SOUNDS = {
  bell:        { name: 'Classic Bell 🔔',      nameAr: 'جرس كلاسيكي 🔔' },
  digital:     { name: 'Digital Alarm 📳',      nameAr: 'منبه رقمي 📳' },
  soft:        { name: 'Soft Notification 🎵',  nameAr: 'إشعار ناعم 🎵' },
  school:      { name: 'School Bell 🏫',         nameAr: 'جرس مدرسة 🏫' },
  focus:       { name: 'Focus Bell 🎯',          nameAr: 'جرس تركيز 🎯' },
  nature:      { name: 'Nature Chime 🌿',        nameAr: 'رنين الطبيعة 🌿' },
  meditation:  { name: 'Meditation Bell 🧘',     nameAr: 'جرس التأمل 🧘' },
  productivity:{ name: 'Productivity Bell ⚡',   nameAr: 'جرس الإنتاجية ⚡' },
  minimal:     { name: 'Minimal Bell ✨',         nameAr: 'جرس بسيط ✨' },
  deep:        { name: 'Deep Focus Alarm 🔮',    nameAr: 'منبه التركيز العميق 🔮' },
};

let audioCtx = null;

function getAudioCtx() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  return audioCtx;
}

function playTone(freq, type, duration, volume, startTime, ctx) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.type = type;
  osc.frequency.setValueAtTime(freq, startTime);
  gain.gain.setValueAtTime(volume, startTime);
  gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
  osc.start(startTime);
  osc.stop(startTime + duration);
}

function generateSound(soundId) {
  const ctx = getAudioCtx();
  const vol = ((settings?.volume || 70) / 100) * 0.6;
  const now = ctx.currentTime;

  switch(soundId) {
    case 'bell':
      playTone(880, 'sine', 1.5, vol, now, ctx);
      playTone(1100, 'sine', 0.8, vol * 0.5, now + 0.1, ctx);
      break;
    case 'digital':
      for (let i = 0; i < 3; i++) {
        playTone(880, 'square', 0.2, vol * 0.4, now + i * 0.3, ctx);
        playTone(1100, 'square', 0.2, vol * 0.4, now + i * 0.3 + 0.15, ctx);
      }
      break;
    case 'soft':
      playTone(523, 'sine', 0.8, vol * 0.5, now, ctx);
      playTone(659, 'sine', 0.8, vol * 0.4, now + 0.3, ctx);
      playTone(784, 'sine', 1.0, vol * 0.3, now + 0.6, ctx);
      break;
    case 'school':
      for (let i = 0; i < 5; i++) {
        playTone(700, 'square', 0.15, vol * 0.3, now + i * 0.2, ctx);
      }
      playTone(880, 'sine', 1.0, vol * 0.5, now + 1.2, ctx);
      break;
    case 'focus':
      playTone(528, 'sine', 2.0, vol * 0.4, now, ctx);
      playTone(1056, 'sine', 1.0, vol * 0.2, now + 0.5, ctx);
      break;
    case 'nature':
      playTone(392, 'sine', 0.6, vol * 0.3, now, ctx);
      playTone(494, 'sine', 0.6, vol * 0.3, now + 0.4, ctx);
      playTone(587, 'sine', 0.6, vol * 0.3, now + 0.8, ctx);
      playTone(784, 'sine', 1.0, vol * 0.4, now + 1.2, ctx);
      break;
    case 'meditation':
      playTone(432, 'sine', 3.0, vol * 0.3, now, ctx);
      playTone(864, 'sine', 2.0, vol * 0.15, now + 0.5, ctx);
      break;
    case 'productivity':
      playTone(800, 'sawtooth', 0.1, vol * 0.3, now, ctx);
      playTone(1000, 'sawtooth', 0.1, vol * 0.3, now + 0.15, ctx);
      playTone(1200, 'sine', 1.0, vol * 0.4, now + 0.3, ctx);
      break;
    case 'minimal':
      playTone(1047, 'sine', 0.5, vol * 0.3, now, ctx);
      break;
    case 'deep':
      playTone(220, 'sine', 2.0, vol * 0.5, now, ctx);
      playTone(440, 'sine', 1.5, vol * 0.3, now + 0.3, ctx);
      playTone(660, 'sine', 1.0, vol * 0.2, now + 0.6, ctx);
      break;
    default:
      playTone(880, 'sine', 1.5, vol, now, ctx);
  }
}

function playAlarmSound(blockId) {
  // Get per-block sound or default
  const blockSoundId = (settings?.perBlockSounds && blockId) ? (settings.perBlockSounds[blockId] || settings.defaultSound) : settings.defaultSound;
  const soundId = blockSoundId || 'bell';

  // Check if it's a custom sound
  const customSounds = getCustomSounds();
  const custom = customSounds.find(s => s.id === soundId);

  if (custom) {
    const audio = new Audio(custom.data);
    audio.volume = (settings?.volume || 70) / 100;
    audio.play().catch(() => generateSound('bell'));
    handleRepeat(audio, settings?.repeatCount || 1);
    return;
  }

  // Built-in sound
  generateSound(soundId);

  // Repeat
  const repeatCount = settings?.repeatAlarm ? (settings?.repeatCount || 3) : 1;
  const duration = (settings?.alarmDuration || 10) * 1000;
  let played = 1;

  if (repeatCount > 1) {
    const interval = setInterval(() => {
      if (played >= repeatCount) { clearInterval(interval); return; }
      generateSound(soundId);
      played++;
    }, Math.max(duration / repeatCount, 2000));
  }
}

function handleRepeat(audio, count) {
  let played = 0;
  audio.onended = () => {
    played++;
    if (played < count && settings?.repeatAlarm) {
      audio.currentTime = 0;
      audio.play().catch(() => {});
    }
  };
}

function previewSound(soundId) {
  if (!soundId) return;
  const customSounds = getCustomSounds();
  const custom = customSounds.find(s => s.id === soundId);
  if (custom) {
    const audio = new Audio(custom.data);
    audio.volume = (settings?.volume || 70) / 100;
    audio.play().catch(() => {});
    return;
  }
  generateSound(soundId);
}

// ===== RENDER SOUND LIBRARY =====
function renderSoundLibrary() {
  const el = document.getElementById('soundLibrary');
  if (!el) return;

  const currentDefault = settings.defaultSound || 'bell';
  el.innerHTML = Object.entries(SOUNDS).map(([id, info]) => `
    <div class="sound-item">
      <span class="sound-name">${currentLang === 'ar' ? info.nameAr : info.name}</span>
      <button class="sound-play-btn" onclick="previewSound('${id}'); event.stopPropagation();"
              aria-label="${currentLang === 'ar' ? 'معاينة' : 'Preview'} ${currentLang === 'ar' ? info.nameAr : info.name}" title="${currentLang === 'ar' ? 'معاينة' : 'Preview'}">
        <i class="fas fa-play" aria-hidden="true"></i>
      </button>
      <button class="sound-select-btn ${currentDefault === id ? 'selected' : ''}" 
              onclick="selectDefaultSound('${id}'); event.stopPropagation();">
        ${currentLang === 'ar' ? 'اختيار' : 'Select'}
      </button>
    </div>
  `).join('');
}

function selectDefaultSound(id) {
  settings.defaultSound = id;
  DB.set('settings', settings);
  if (document.getElementById('defaultSound')) document.getElementById('defaultSound').value = id;
  renderSoundLibrary();
  showToast(t('toast.saved'), 'success');
}

// ===== PER-BLOCK SOUND SETTINGS =====
function renderPerBlockSoundSettings() {
  const el = document.getElementById('perBlockSoundSettings');
  if (!el || !window.currentBlocks) return;

  const blocks = window.currentBlocks.filter(b => !b.isBreak);
  if (blocks.length === 0) {
    el.innerHTML = `<p style="color:var(--text-muted);font-size:0.85rem">${currentLang === 'ar' ? 'افتح يوماً لتخصيص نغمات البلوكات' : 'Open a day to customize block sounds'}</p>`;
    return;
  }

  el.innerHTML = blocks.map(b => {
    const blockName = b.name[currentLang] || b.name.ar;
    const perSound = settings.perBlockSounds?.[b.id] || '';
    return `
      <div class="per-block-sound-item">
        <label>${blockName}</label>
        <select class="setting-select" onchange="setPerBlockSound('${b.id}', this.value)">
          <option value="">${currentLang === 'ar' ? 'الافتراضي' : 'Default'}</option>
          ${Object.entries(SOUNDS).map(([id, info]) =>
            `<option value="${id}" ${perSound === id ? 'selected' : ''}>${currentLang === 'ar' ? info.nameAr : info.name}</option>`
          ).join('')}
        </select>
      </div>
    `;
  }).join('');
}

function setPerBlockSound(blockId, soundId) {
  if (!settings.perBlockSounds) settings.perBlockSounds = {};
  settings.perBlockSounds[blockId] = soundId;
  DB.set('settings', settings);
  showToast(t('toast.saved'), 'success');
}
