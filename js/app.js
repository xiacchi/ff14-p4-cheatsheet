(function () {
  const CONFIG = {
    gc1Seconds: 15,
    gc2Seconds: 15,
  };

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
    gc2Derived: {
      chaosType: false,
      exdeathDebuff: false,
      restrictToThunderWater: false,
    },
  };

  const els = {
    inputScreen: document.getElementById('inputScreen'),
    resultScreen: document.getElementById('resultScreen'),
    phaseTitle: document.getElementById('phaseTitle'),
    countdown: document.getElementById('countdown'),
    completeButton: document.getElementById('completeButton'),
    resetButton: document.getElementById('resetButton'),
    personalActions: document.getElementById('personalActions'),
    timeline: document.getElementById('timeline'),
  };

  document.querySelectorAll('.choice-button').forEach((button) => {
    button.addEventListener('click', () => selectChoice(button));
  });

  els.completeButton.addEventListener('click', finalizePhase);
  els.resetButton.addEventListener('click', resetAll);

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
      if (state.gc2Derived.restrictToThunderWater && normalizedValue === 'acceleration') return true;
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
    return state.phase === 1 ? CONFIG.gc1Seconds : CONFIG.gc2Seconds;
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
      restrictToThunderWater: false,
    };

    // カオスの炎/水は、GC1とGC2で必ず片方ずつ。
    if (gc1.chaosType === 'fire') {
      gc2.chaosType = 'water';
      state.gc2Derived.chaosType = true;
    } else if (gc1.chaosType === 'water') {
      gc2.chaosType = 'fire';
      state.gc2Derived.chaosType = true;
    }

    // 加速度はGC1/GC2を通して必ず1回だけ付与される。
    // したがってGC1で加速度が付かず雷/水だった場合、GC2は加速度に確定する。
    if (gc1.exdeathDebuff === 'thunder' || gc1.exdeathDebuff === 'water') {
      gc2.exdeathDebuff = 'acceleration';
      state.gc2Derived.exdeathDebuff = true;
    // GC1で加速度ならGC2は雷/水のどちらか。加速度だけ再選択不可にする。
    } else if (gc1.exdeathDebuff === 'acceleration') {
      state.gc2Derived.restrictToThunderWater = true;
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

  function renderPhase() {
    els.phaseTitle.textContent = `GC${state.phase}`;
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
    els.inputScreen.hidden = true;
    els.resultScreen.hidden = false;
    renderPersonalActions();
    renderTimeline();
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

  function resetAll() {
    clearTimer();
    state.phase = 1;
    state.records = [blankRecord(), blankRecord()];
    state.gc2Derived = {
      chaosType: false,
      exdeathDebuff: false,
      restrictToThunderWater: false,
    };
    els.resultScreen.hidden = true;
    els.inputScreen.hidden = false;
    renderPhase();
  }

  renderPhase();
}());
