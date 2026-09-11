(function () {
  'use strict';

  const STORAGE_KEY = 'ff14P4Cheatsheet.healerAcceleration.v1';
  const APP_INFO = {
    version: '2026.09.11-r6',
    updatedAt: '2026-09-11 16:53 JST',
  };

  const HEALERS = [
    { key: 'white', label: '白', name: '白魔道士', icon: './assets/icons/job-whm.png' },
    { key: 'scholar', label: '学', name: '学者', icon: './assets/icons/job-sch.png' },
  ];

  const state = {
    enabled: loadEnabled(),
    phase: 1,
    acceleration: [blankHealerSelection(), blankHealerSelection()],
    exdeathTruth: [null, null],
    phaseTitleObserver: null,
  };

  function blankHealerSelection() {
    return { white: false, scholar: false };
  }

  function loadEnabled() {
    try {
      return window.localStorage.getItem(STORAGE_KEY) === 'true';
    } catch (error) {
      return false;
    }
  }

  function persistEnabled() {
    try {
      window.localStorage.setItem(STORAGE_KEY, String(state.enabled));
    } catch (error) {
      // localStorage が利用できない場合は現在のタブだけで設定を維持する。
    }
  }

  function injectStyles() {
    if (document.getElementById('healerAccelerationStyles')) return;

    const style = document.createElement('style');
    style.id = 'healerAccelerationStyles';
    style.textContent = `
      .quadrant.exdeath.debuff-area.healer-acceleration-enabled {
        grid-template-rows: auto minmax(0, 1.15fr) minmax(0, .78fr);
      }

      .healer-acceleration-row {
        min-height: 0;
      }

      .healer-acceleration-button {
        font-size: clamp(20px, 2.7vw, 34px);
      }

      .healer-acceleration-button img {
        width: min(6vh, 48px);
        height: min(6vh, 48px);
      }

      .healer-action-card {
        min-height: 0;
        grid-row: span 2;
        border: 1px solid var(--border);
        border-radius: 13px;
        background: var(--panel-2);
        display: grid;
        grid-template-rows: repeat(2, minmax(0, 1fr));
        padding: 3px 9px;
      }

      .healer-action-row {
        min-height: 0;
        display: grid;
        grid-template-columns: minmax(70px, .7fr) 1.3fr;
        align-items: center;
        gap: 8px;
        padding: 3px 0;
      }

      .healer-action-row + .healer-action-row {
        border-top: 1px solid rgba(255, 255, 255, .08);
      }

      .healer-action-identity {
        min-width: 0;
        display: grid;
        grid-template-columns: auto auto auto minmax(0, 1fr);
        align-items: center;
        justify-content: center;
        gap: 6px;
        color: var(--muted);
        font-weight: 800;
      }

      .healer-job-icon {
        width: min(5.6vh, 44px);
        height: min(5.6vh, 44px);
        object-fit: contain;
      }

      .healer-job-label {
        color: var(--text);
        font-size: clamp(18px, 2.1vw, 26px);
        font-weight: 950;
      }

      .healer-action-meta {
        min-width: 0;
        display: grid;
        gap: 1px;
      }

      .healer-action-card .action-icon {
        width: min(6.8vh, 54px);
        height: min(6.8vh, 54px);
      }

      @media (max-height: 500px) {
        .quadrant.exdeath.debuff-area.healer-acceleration-enabled {
          grid-template-rows: auto minmax(0, 1.08fr) minmax(0, .72fr);
        }

        .healer-acceleration-button {
          font-size: clamp(17px, 2.35vw, 28px);
        }

        .healer-acceleration-button img {
          width: min(4.8vh, 32px);
          height: min(4.8vh, 32px);
        }

        .healer-action-card {
          padding: 2px 6px;
          border-radius: 10px;
        }

        .healer-action-row {
          grid-template-columns: minmax(66px, .7fr) 1.3fr;
          gap: 5px;
          padding: 2px 0;
        }

        .healer-job-icon {
          width: min(4.5vh, 30px);
          height: min(4.5vh, 30px);
        }

        .healer-action-card .action-icon {
          width: min(5.4vh, 38px);
          height: min(5.4vh, 38px);
        }

        .healer-job-label {
          font-size: clamp(15px, 1.9vw, 21px);
        }
      }
    `;
    document.head.appendChild(style);
  }

  function installSettingsRow() {
    const form = document.getElementById('settingsForm');
    const note = form?.querySelector('.settings-note');
    if (!form || !note || document.getElementById('healerAccelerationModeInput')) return;

    const row = document.createElement('label');
    row.className = 'setting-row setting-row-toggle';
    row.innerHTML = `
      <span>
        <strong>ヒーラー加速度モード</strong>
        <small>GC1で白・学の加速度を記録し、GC2は各ヒーラーごとに自動補完</small>
      </span>
      <input id="healerAccelerationModeInput" class="toggle-input" type="checkbox">
    `;
    form.insertBefore(row, note);

    const input = document.getElementById('healerAccelerationModeInput');
    input.checked = state.enabled;

    document.getElementById('settingsButton')?.addEventListener('click', () => {
      input.checked = state.enabled;
    });

    document.getElementById('restoreDefaultsButton')?.addEventListener('click', () => {
      input.checked = false;
    });

    form.addEventListener('submit', () => {
      state.enabled = input.checked;
      persistEnabled();
      applyModeVisibility();

      if (state.enabled && state.phase === 2) {
        deriveGc2Acceleration();
        refreshHealerButtons();
      }

      if (state.enabled && document.getElementById('resultScreen')?.hidden === false) {
        renderHealerResults();
      } else if (!state.enabled) {
        removeHealerResults();
      }
    });
  }

  function installHealerButtons() {
    const section = document.querySelector('.quadrant.exdeath.debuff-area');
    if (!section || document.getElementById('healerAccelerationRow')) return;

    const row = document.createElement('div');
    row.id = 'healerAccelerationRow';
    row.className = 'button-row two-col healer-acceleration-row';
    row.setAttribute('aria-label', 'ヒーラー加速度');

    HEALERS.forEach((healer) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'choice-button healer-acceleration-button';
      button.dataset.healer = healer.key;
      button.setAttribute('aria-pressed', 'false');
      button.innerHTML = `
        <img src="${healer.icon}" alt="" onerror="this.hidden=true">
        <span>${healer.label}</span>
      `;
      button.addEventListener('click', () => toggleHealerAcceleration(healer.key));
      row.appendChild(button);
    });

    section.appendChild(row);
    applyModeVisibility();
    refreshHealerButtons();
  }

  function applyModeVisibility() {
    const section = document.querySelector('.quadrant.exdeath.debuff-area');
    const row = document.getElementById('healerAccelerationRow');
    if (!section || !row) return;

    section.classList.toggle('healer-acceleration-enabled', state.enabled);
    row.hidden = !state.enabled;
  }

  function currentPhaseFromTitle() {
    const title = document.getElementById('phaseTitle')?.textContent?.trim();
    if (title === 'GC2') return 2;
    if (title === 'GC1') return 1;
    return state.phase;
  }

  function toggleHealerAcceleration(key) {
    if (!state.enabled || state.phase !== 1) return;

    state.acceleration[0][key] = !state.acceleration[0][key];
    refreshHealerButtons();
    ensureAppTimerStarted();
  }

  function ensureAppTimerStarted() {
    const countdown = document.getElementById('countdown');
    if (!countdown || countdown.hidden || countdown.textContent.trim() !== '入力待ち') return;

    const appButtons = Array.from(document.querySelectorAll('.choice-button[data-group]'))
      .filter((button) => !button.disabled);
    if (appButtons.length === 0) return;

    const probe = appButtons.find((button) => button.classList.contains('selected')) || appButtons[0];
    probe.click();
    probe.click();
  }

  function deriveGc2Acceleration() {
    HEALERS.forEach((healer) => {
      state.acceleration[1][healer.key] = !state.acceleration[0][healer.key];
    });
  }

  function refreshHealerButtons() {
    const selection = state.acceleration[state.phase - 1] || blankHealerSelection();

    document.querySelectorAll('.healer-acceleration-button').forEach((button) => {
      const selected = Boolean(selection[button.dataset.healer]);
      const derived = state.phase === 2;

      button.classList.toggle('selected', selected);
      button.classList.toggle('derived', derived && selected);
      button.disabled = derived;
      button.setAttribute('aria-pressed', String(selected));

      const healer = HEALERS.find((item) => item.key === button.dataset.healer);
      const label = healer?.name || button.textContent.trim();
      if (derived && selected) {
        button.setAttribute('aria-label', `${label}（GC1から自動設定）`);
      } else if (derived) {
        button.setAttribute('aria-label', `${label}（GC1から自動的に対象外）`);
      } else {
        button.setAttribute('aria-label', label);
      }
    });
  }

  function installTruthTracking() {
    document.querySelectorAll('.choice-button[data-group="exdeathTruth"]').forEach((button) => {
      button.addEventListener('click', () => {
        const phase = currentPhaseFromTitle();
        const selected = button.classList.contains('selected');
        state.exdeathTruth[phase - 1] = selected ? button.dataset.value === 'true' : null;
      });
    });
  }

  function resetHealerState() {
    state.phase = 1;
    state.acceleration = [blankHealerSelection(), blankHealerSelection()];
    state.exdeathTruth = [null, null];
    refreshHealerButtons();
    removeHealerResults();
  }

  function installPhaseObserver() {
    const phaseTitle = document.getElementById('phaseTitle');
    if (!phaseTitle) return;

    state.phaseTitleObserver = new MutationObserver(() => {
      const title = phaseTitle.textContent.trim();

      if (title === 'GC1') {
        resetHealerState();
        applyModeVisibility();
        return;
      }

      if (title === 'GC2') {
        state.phase = 2;
        deriveGc2Acceleration();
        applyModeVisibility();
        refreshHealerButtons();
        return;
      }

      if (title === '処理内容') {
        if (state.enabled) renderHealerResults();
      }
    });

    state.phaseTitleObserver.observe(phaseTitle, {
      childList: true,
      characterData: true,
      subtree: true,
    });
  }

  function accelerationGcFor(key) {
    if (state.acceleration[0][key]) return 1;
    if (state.acceleration[1][key]) return 2;
    return null;
  }

  function actionForHealer(key) {
    const gc = accelerationGcFor(key);
    if (!gc) return { gc: '-', result: window.P4Rules?.MISSING || '未入力' };

    const truth = state.exdeathTruth[gc - 1];
    const result = window.P4Rules?.personalAction
      ? window.P4Rules.personalAction('acceleration', truth)
      : (truth === null ? '未入力' : truth ? '止まる' : '動く');
    return { gc, result };
  }

  function renderHealerResults() {
    const container = document.getElementById('personalActions');
    if (!container || !state.enabled) return;

    removeHealerResults();

    const card = document.createElement('article');
    card.id = 'healerAccelerationResults';
    card.className = 'healer-action-card';

    HEALERS.forEach((healer) => {
      const action = actionForHealer(healer.key);
      const row = document.createElement('div');
      row.className = 'healer-action-row';
      const missing = action.result === (window.P4Rules?.MISSING || '未入力') ? ' missing' : '';

      row.innerHTML = `
        <div class="healer-action-identity">
          <img class="healer-job-icon" src="${healer.icon}" alt="" onerror="this.hidden=true">
          <span class="healer-job-label">${healer.label}</span>
          <img class="action-icon" src="./assets/icons/exdeath-acceleration.png" alt="加速度" onerror="this.hidden=true">
          <div class="healer-action-meta">
            <div class="action-name">加速度</div>
            <div class="action-name">GC${action.gc}</div>
          </div>
        </div>
        <div class="action-result${missing}">${action.result}</div>
      `;
      card.appendChild(row);
    });

    container.appendChild(card);
  }

  function removeHealerResults() {
    document.getElementById('healerAccelerationResults')?.remove();
  }

  function updateAppInfo() {
    const version = document.getElementById('appVersion');
    const updatedAt = document.getElementById('appUpdatedAt');
    if (version) version.textContent = `Version ${APP_INFO.version}`;
    if (updatedAt) updatedAt.textContent = `Updated ${APP_INFO.updatedAt}`;
  }

  function init() {
    injectStyles();
    installSettingsRow();
    installHealerButtons();
    installTruthTracking();
    installPhaseObserver();
    updateAppInfo();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
}());
