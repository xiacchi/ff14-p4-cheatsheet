(function () {
  'use strict';

  const APP_INFO = {
    version: '2026.09.07-r4',
    updatedAt: '2026-09-07 23:00 JST',
  };

  const STORAGE_KEY = 'ff14P4Cheatsheet.settings.v1';

  const DEFAULT_SETTINGS = Object.freeze({
    gc1Seconds: 15,
    gc2Seconds: 15,
    idleResetEnabled: true,
    idleResetSeconds: 300,
    wakeLockEnabled: true,
    wakeLockMinutes: 30,
  });

  const ASSETS = {
    thunder: './assets/icons/exdeath-thunder.png',
    water: './assets/icons/exdeath-water.png',
    acceleration: './assets/icons/exdeath-acceleration.png',
    gaze: './assets/icons/gaze.png',
    fire: './assets/icons/chaos-fire.png',
    chaosWater: './assets/icons/chaos-water.png',
  };

  const LABELS = {
    thunder: '雷',
    water: '水',
    acceleration: '加速度',
  };

  const blankRecord = () => ({
    exdeathTruth: null,
    exdeathDebuff: null,
    chaosTruth: null,
    chaosType: null,
  });

  const state = {
    phase: 1,
    records: [blankRecord(), blankRecord()],
    timerId: null,
    deadline: null,
    timerStarted: false,
    settings: loadSettings(),
    lastInteractionAt: Date.now(),
    idleTickerId: null,
    idleResetHandled: false,
    wakeLock: null,
    wakeLockRequestPending: false,
    magic: {
      line: false,
      fan: false,
    },
    gc2Derived: {
      chaosType: false,
      exdeathDebuff: false,
      disableAcceleration: false,
    },
  };

  const els = {
    app: document.getElementById('app'),
    inputScreen: document.getElementById('inputScreen'),
    resultScreen: document.getElementById('resultScreen'),
    phaseTitle: document.getElementById('phaseTitle'),
    countdown: document.getElementById('countdown'),
    completeButton: document.getElementById('completeButton'),
    resetButton: document.getElementById('resetButton'),
    idleElapsed: document.getElementById('idleElapsed'),
    personalActions: document.getElementById('personalActions'),
    timeline: document.getElementById('timeline'),
    magicLineButton: document.getElementById('magicLineButton'),
    magicFanButton: document.getElementById('magicFanButton'),
    settingsButton: document.getElementById('settingsButton'),
    settingsOverlay: document.getElementById('settingsOverlay'),
    settingsCloseButton: document.getElementById('settingsCloseButton'),
    settingsForm: document.getElementById('settingsForm'),
    gc1SecondsInput: document.getElementById('gc1SecondsInput'),
    gc2SecondsInput: document.getElementById('gc2SecondsInput'),
    idleResetEnabledInput: document.getElementById('idleResetEnabledInput'),
    idleResetSecondsInput: document.getElementById('idleResetSecondsInput'),
    idleResetSecondsRow: document.getElementById('idleResetSecondsRow'),
    wakeLockEnabledInput: document.getElementById('wakeLockEnabledInput'),
    wakeLockMinutesInput: document.getElementById('wakeLockMinutesInput'),
    wakeLockMinutesRow: document.getElementById('wakeLockMinutesRow'),
    restoreDefaultsButton: document.getElementById('restoreDefaultsButton'),
    appVersion: document.getElementById('appVersion'),
    appUpdatedAt: document.getElementById('appUpdatedAt'),
  };

  document.querySelectorAll('.choice-button').forEach((button) => {
    button.addEventListener('click', () => selectChoice(button));
  });

  els.completeButton.addEventListener('click', finalizePhase);
  els.resetButton.addEventListener('click', () => resetAll({ fromIdle: false }));
  els.magicLineButton.addEventListener('click', () => toggleMagic('line'));
  els.magicFanButton.addEventListener('click', () => toggleMagic('fan'));

  els.settingsButton.addEventListener('click', openSettings);
  els.settingsCloseButton.addEventListener('click', closeSettings);
  els.settingsOverlay.addEventListener('click', (event) => {
    if (event.target === els.settingsOverlay) closeSettings();
  });
  els.settingsForm.addEventListener('submit', saveSettingsFromForm);
  els.restoreDefaultsButton.addEventListener('click', () => fillSettingsForm(DEFAULT_SETTINGS));
  els.idleResetEnabledInput.addEventListener('change', refreshIdleSettingAvailability);
  els.wakeLockEnabledInput.addEventListener('change', refreshWakeLockSettingAvailability);

  document.addEventListener('pointerdown', markInteraction, { capture: true, passive: true });
  document.addEventListener('keydown', (event) => {
    markInteraction();
    if (event.key === 'Escape' && !els.settingsOverlay.hidden) closeSettings();
  }, { capture: true });

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      syncWakeLock();
    } else {
      releaseWakeLock();
    }
  });
  window.addEventListener('pagehide', releaseWakeLock);

  function boundedInt(value, fallback, min, max) {
    const number = Number.parseInt(value, 10);
    if (!Number.isFinite(number)) return fallback;
    return Math.min(max, Math.max(min, number));
  }

  function normalizeSettings(raw) {
    const source = raw && typeof raw === 'object' ? raw : {};
    return {
      gc1Seconds: boundedInt(source.gc1Seconds, DEFAULT_SETTINGS.gc1Seconds, 1, 60),
      gc2Seconds: boundedInt(source.gc2Seconds, DEFAULT_SETTINGS.gc2Seconds, 1, 60),
      idleResetEnabled: typeof source.idleResetEnabled === 'boolean'
        ? source.idleResetEnabled
        : DEFAULT_SETTINGS.idleResetEnabled,
      idleResetSeconds: boundedInt(source.idleResetSeconds, DEFAULT_SETTINGS.idleResetSeconds, 30, 3600),
      wakeLockEnabled: typeof source.wakeLockEnabled === 'boolean'
        ? source.wakeLockEnabled
        : DEFAULT_SETTINGS.wakeLockEnabled,
      wakeLockMinutes: boundedInt(source.wakeLockMinutes, DEFAULT_SETTINGS.wakeLockMinutes, 5, 240),
    };
  }

  function loadSettings() {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return { ...DEFAULT_SETTINGS };
      return normalizeSettings(JSON.parse(raw));
    } catch (error) {
      return { ...DEFAULT_SETTINGS };
    }
  }

  function persistSettings() {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state.settings));
    } catch (error) {
      // localStorageが利用不可でも、現在のタブでは設定値をそのまま使用する。
    }
  }

  function markInteraction() {
    state.lastInteractionAt = Date.now();
    state.idleResetHandled = false;
    updateIdleElapsed();
    syncWakeLock();
  }

  function updateIdleElapsed() {
    const elapsedSeconds = Math.max(0, Math.floor((Date.now() - state.lastInteractionAt) / 1000));
    els.idleElapsed.textContent = `操作なし: ${elapsedSeconds}秒`;

    if (
      state.settings.idleResetEnabled
      && elapsedSeconds >= state.settings.idleResetSeconds
      && !state.idleResetHandled
    ) {
      state.idleResetHandled = true;
      resetAll({ fromIdle: true });
    }

    if (wakeLockExpired()) {
      releaseWakeLock();
    }
  }

  function startIdleTicker() {
    if (state.idleTickerId) window.clearInterval(state.idleTickerId);
    state.idleTickerId = window.setInterval(updateIdleElapsed, 1000);
    updateIdleElapsed();
  }

  function wakeLockExpired() {
    const elapsedMs = Date.now() - state.lastInteractionAt;
    return elapsedMs >= state.settings.wakeLockMinutes * 60 * 1000;
  }

  function shouldHoldWakeLock() {
    return state.settings.wakeLockEnabled
      && document.visibilityState === 'visible'
      && !wakeLockExpired();
  }

  async function requestWakeLock() {
    if (
      !shouldHoldWakeLock()
      || state.wakeLock
      || state.wakeLockRequestPending
      || !('wakeLock' in navigator)
    ) return;

    state.wakeLockRequestPending = true;

    try {
      const lock = await navigator.wakeLock.request('screen');

      if (!shouldHoldWakeLock()) {
        await lock.release();
        return;
      }

      state.wakeLock = lock;
      lock.addEventListener('release', () => {
        if (state.wakeLock === lock) state.wakeLock = null;
      }, { once: true });
    } catch (error) {
      // 非対応状態・低電力状態・OS判断などで拒否されてもアプリ本体は継続する。
      state.wakeLock = null;
    } finally {
      state.wakeLockRequestPending = false;
    }
  }

  async function releaseWakeLock() {
    const lock = state.wakeLock;
    state.wakeLock = null;
    if (!lock) return;

    try {
      await lock.release();
    } catch (error) {
      // 既にブラウザ側で解除済みの場合は何もしない。
    }
  }

  function syncWakeLock() {
    if (shouldHoldWakeLock()) {
      requestWakeLock();
    } else {
      releaseWakeLock();
    }
  }

  function currentRecord() {
    return state.records[state.phase - 1];
  }

  function selectChoice(button) {
    if (button.disabled) return;

    const group = button.dataset.group;
    const rawValue = button.dataset.value;
    const record = currentRecord();
    const currentValue = record[group];
    const nextValue = normalizeValue(group, rawValue);

    record[group] = currentValue === nextValue ? null : nextValue;
    refreshGroup(group);

    if (!state.timerStarted) startTimer();
  }

  function normalizeValue(group, value) {
    if (group === 'chaosTruth' || group === 'exdeathTruth') {
      return value === 'true';
    }
    return value;
  }

  function isGc2DerivedButton(group, normalizedValue) {
    if (state.phase !== 2) return false;
    const gc2 = state.records[1];

    if (group === 'chaosType' && state.gc2Derived.chaosType) {
      return gc2.chaosType === normalizedValue;
    }

    if (group === 'exdeathDebuff' && state.gc2Derived.exdeathDebuff) {
      return gc2.exdeathDebuff === normalizedValue;
    }

    return false;
  }

  function isChoiceDisabled(group, normalizedValue) {
    if (state.phase !== 2) return false;

    if (group === 'chaosType' && state.gc2Derived.chaosType) {
      return true;
    }

    if (group === 'exdeathDebuff') {
      if (state.gc2Derived.exdeathDebuff) return true;
      if (state.gc2Derived.disableAcceleration && normalizedValue === 'acceleration') return true;
    }

    return false;
  }

  function refreshGroup(group) {
    const value = currentRecord()[group];
    document.querySelectorAll(`.choice-button[data-group="${group}"]`).forEach((button) => {
      const normalized = normalizeValue(group, button.dataset.value);
      const selected = value === normalized;
      const derived = isGc2DerivedButton(group, normalized);
      const disabled = isChoiceDisabled(group, normalized);

      button.classList.toggle('selected', selected);
      button.classList.toggle('derived', derived);
      button.disabled = disabled;
      button.setAttribute('aria-pressed', String(selected));

      if (derived) {
        button.setAttribute('aria-label', `${button.textContent.trim()}（GC1から自動設定）`);
      } else {
        button.removeAttribute('aria-label');
      }
    });
  }

  function refreshAllGroups() {
    ['chaosTruth', 'chaosType', 'exdeathTruth', 'exdeathDebuff'].forEach(refreshGroup);
  }

  function phaseDurationSeconds() {
    return state.phase === 1 ? state.settings.gc1Seconds : state.settings.gc2Seconds;
  }

  function startTimer() {
    state.timerStarted = true;
    els.completeButton.disabled = false;
    state.deadline = Date.now() + phaseDurationSeconds() * 1000;
    updateCountdown();
    state.timerId = window.setInterval(updateCountdown, 100);
  }

  function updateCountdown() {
    if (!state.timerStarted || !state.deadline) return;

    const remainingMs = Math.max(0, state.deadline - Date.now());
    const remainingSeconds = Math.ceil(remainingMs / 1000);
    els.countdown.textContent = `あと ${remainingSeconds}秒`;
    els.countdown.classList.toggle('urgent', remainingSeconds <= 3);

    if (remainingMs <= 0) finalizePhase();
  }

  function clearTimer() {
    if (state.timerId) window.clearInterval(state.timerId);
    state.timerId = null;
    state.deadline = null;
    state.timerStarted = false;
  }

  function deriveGc2FromGc1() {
    const gc1 = state.records[0];
    const gc2 = state.records[1];

    state.gc2Derived = {
      chaosType: false,
      exdeathDebuff: false,
      disableAcceleration: false,
    };

    if (gc1.chaosType === 'fire') {
      gc2.chaosType = 'water';
      state.gc2Derived.chaosType = true;
    } else if (gc1.chaosType === 'water') {
      gc2.chaosType = 'fire';
      state.gc2Derived.chaosType = true;
    }

    if (gc1.exdeathDebuff === 'thunder' || gc1.exdeathDebuff === 'water') {
      gc2.exdeathDebuff = 'acceleration';
      state.gc2Derived.exdeathDebuff = true;
    } else if (gc1.exdeathDebuff === 'acceleration') {
      state.gc2Derived.disableAcceleration = true;
    }
  }

  function finalizePhase() {
    clearTimer();

    if (state.phase === 1) {
      deriveGc2FromGc1();
      state.phase = 2;
      renderPhase();
      return;
    }

    showResults();
  }

  function applyTheme(theme) {
    els.app.classList.toggle('theme-even', theme === 'even');
    els.app.classList.toggle('theme-odd', theme !== 'even');
  }

  function renderPhase() {
    applyTheme(state.phase === 2 ? 'even' : 'odd');
    els.phaseTitle.textContent = `GC${state.phase}`;
    els.countdown.hidden = false;
    els.countdown.textContent = '入力待ち';
    els.countdown.classList.remove('urgent');
    els.completeButton.textContent = `GC${state.phase}完了`;
    els.completeButton.disabled = true;
    refreshAllGroups();
  }

  function iconMarkup(src, alt, className) {
    return `<img class="${className}" src="${src}" alt="${alt}" onerror="this.hidden=true">`;
  }

  function showResults() {
    clearTimer();
    applyTheme('odd');
    els.inputScreen.hidden = true;
    els.resultScreen.hidden = false;
    els.phaseTitle.textContent = '処理内容';
    els.countdown.hidden = true;
    renderPersonalActions();
    renderTimeline();
    renderMagic();
  }

  function renderPersonalActions() {
    els.personalActions.innerHTML = '';

    const actions = state.records
      .map((record, index) => ({
        gc: index + 1,
        debuff: record.exdeathDebuff,
        truth: record.exdeathTruth,
        result: P4Rules.personalAction(record.exdeathDebuff, record.exdeathTruth),
      }))
      .filter((item) => item.debuff);

    if (actions.length === 0) {
      actions.push({ gc: '-', debuff: null, result: P4Rules.MISSING });
    }

    actions.forEach((item) => {
      const card = document.createElement('article');
      card.className = 'action-card';
      const missing = item.result === P4Rules.MISSING ? ' missing' : '';
      const label = item.debuff ? LABELS[item.debuff] : '個人デバフ';
      const icon = item.debuff ? iconMarkup(ASSETS[item.debuff], label, 'action-icon') : '';

      card.innerHTML = `
        <div class="action-icon-wrap">
          ${icon}
          <div>
            <div class="action-name">${label}</div>
            <div class="action-name">GC${item.gc}</div>
          </div>
        </div>
        <div class="action-result${missing}">${item.result}</div>
      `;
      els.personalActions.appendChild(card);
    });
  }

  function renderTimeline() {
    const gc1 = state.records[0];
    const gc2 = state.records[1];
    const fire = P4Rules.findChaosByType(state.records, 'fire');
    const water = P4Rules.findChaosByType(state.records, 'water');

    const items = [
      { label: '視線1', icon: ASSETS.gaze, result: P4Rules.gazeAction(gc1.exdeathTruth) },
      { label: '炎', icon: ASSETS.fire, result: fire ? P4Rules.chaosAction('fire', fire.chaosTruth) : P4Rules.MISSING },
      { label: '視線2', icon: ASSETS.gaze, result: P4Rules.gazeAction(gc2.exdeathTruth) },
      { label: '水', icon: ASSETS.chaosWater, result: water ? P4Rules.chaosAction('water', water.chaosTruth) : P4Rules.MISSING },
    ];

    els.timeline.innerHTML = '';
    items.forEach((item) => {
      const li = document.createElement('li');
      li.className = 'timeline-item';
      const missing = item.result === P4Rules.MISSING ? ' missing' : '';
      li.innerHTML = `
        <div class="timeline-label">
          ${iconMarkup(item.icon, item.label, '')}
          <span>${item.label}</span>
        </div>
        <div class="timeline-result${missing}">${item.result}</div>
      `;
      els.timeline.appendChild(li);
    });
  }

  function toggleMagic(kind) {
    state.magic[kind] = !state.magic[kind];
    renderMagic();
  }

  function renderMagic() {
    els.magicLineButton.textContent = state.magic.line ? '踏む' : '踏まない';
    els.magicFanButton.textContent = state.magic.fan ? '踏む' : '踏まない';
    els.magicLineButton.setAttribute('aria-pressed', String(state.magic.line));
    els.magicFanButton.setAttribute('aria-pressed', String(state.magic.fan));

  }

  function openSettings() {
    fillSettingsForm(state.settings);
    els.settingsOverlay.hidden = false;
    window.setTimeout(() => els.gc1SecondsInput.focus(), 0);
  }

  function closeSettings() {
    els.settingsOverlay.hidden = true;
    els.settingsButton.focus();
  }

  function fillSettingsForm(settings) {
    els.gc1SecondsInput.value = settings.gc1Seconds;
    els.gc2SecondsInput.value = settings.gc2Seconds;
    els.idleResetEnabledInput.checked = settings.idleResetEnabled;
    els.idleResetSecondsInput.value = settings.idleResetSeconds;
    els.wakeLockEnabledInput.checked = settings.wakeLockEnabled;
    els.wakeLockMinutesInput.value = settings.wakeLockMinutes;
    refreshIdleSettingAvailability();
    refreshWakeLockSettingAvailability();
  }

  function refreshIdleSettingAvailability() {
    const enabled = els.idleResetEnabledInput.checked;
    els.idleResetSecondsInput.disabled = !enabled;
    els.idleResetSecondsRow.style.opacity = enabled ? '1' : '.5';
  }

  function refreshWakeLockSettingAvailability() {
    const enabled = els.wakeLockEnabledInput.checked;
    els.wakeLockMinutesInput.disabled = !enabled;
    els.wakeLockMinutesRow.style.opacity = enabled ? '1' : '.5';
  }

  function saveSettingsFromForm(event) {
    event.preventDefault();

    state.settings = normalizeSettings({
      gc1Seconds: els.gc1SecondsInput.value,
      gc2Seconds: els.gc2SecondsInput.value,
      idleResetEnabled: els.idleResetEnabledInput.checked,
      idleResetSeconds: els.idleResetSecondsInput.value,
      wakeLockEnabled: els.wakeLockEnabledInput.checked,
      wakeLockMinutes: els.wakeLockMinutesInput.value,
    });

    persistSettings();
    fillSettingsForm(state.settings);
    syncWakeLock();
    closeSettings();
  }

  function resetAll({ fromIdle }) {
    clearTimer();
    state.phase = 1;
    state.records = [blankRecord(), blankRecord()];
    state.magic = { line: false, fan: false };
    state.gc2Derived = {
      chaosType: false,
      exdeathDebuff: false,
      disableAcceleration: false,
    };

    if (fromIdle) {
      els.settingsOverlay.hidden = true;
    } else {
      state.lastInteractionAt = Date.now();
      state.idleResetHandled = false;
      syncWakeLock();
    }

    els.resultScreen.hidden = true;
    els.inputScreen.hidden = false;
    renderMagic();
    renderPhase();
    updateIdleElapsed();
  }

  function renderAppInfo() {
    els.appVersion.textContent = `Version ${APP_INFO.version}`;
    els.appUpdatedAt.textContent = `Updated ${APP_INFO.updatedAt}`;
  }

  renderAppInfo();
  renderMagic();
  renderPhase();
  startIdleTicker();
  syncWakeLock();
}());
