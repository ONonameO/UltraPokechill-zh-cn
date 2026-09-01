// Pokechill 助手 — 非全局战斗加速 + 倍速滑动条/输入框 + 跳过时间 + 自动重开
// 改写自原 pokechill助手 userscript：移除全局变速(Date/RAF 劫持)与静音，
// 改采 speedBattles 的回合推进式战斗加速；跳过时间复用游戏原生 afkSeconds 机制。

const MOD_ID = "pokechillHelper";
const STYLE_ID = "pokechill-helper-style";
const CONFIG_CLASS = "pokechill-helper-config";
const LOOP_KEY = "__pokechillHelperLoop";
const LEGACY_PATCH_KEY = "__pokechillHelperLegacyPatch";
const RESPAWN_PATCH_KEY = "__pokechillHelperRespawnPatch";
const BASE_TIMER = 2000;
const STEP_MS = 1000 / 60;
const INTERVAL_MS = 50;
const SPEEDS = [1, 2, 3, 5, 10, 50];
const MIN_SPEED = 1;
const MAX_SPEED = 50;
let renderQueued = false;
let menuObserverStarted = false;
let rejoinObserverStarted = false;

UltraMods.define({
  id: MOD_ID,
  name: "Pokechill 助手",
  description: "非全局战斗加速（基于回合推进）+ 倍速滑动条与输入框（1-50x）+ 跳过时间 + 自动重开。",
  image: "img/items/quickClaw.png",
  version: "1.0",
  author: "黄黄",
  category: "实用工具",
  defaultEnabled: false,
  hooks: {
    onToggle(api, payload, state) {
      installStyles();
      ensureState(state);

      if (payload.enabled) {
        applySpeed(api, state);
      } else {
        restoreSpeed(api);
      }

      updateBodyState(api, state);
      renderConfig(api);
    },
    onRefresh(api, payload, state) {
      installStyles();
      ensureState(state);
      applySpeed(api, state);
      updateBodyState(api, state);
      renderConfig(api);
    },
    afterPlayerDamage(api, payload, state) {
      if (clampSpeed(state.speed) < 5) return;
      scheduleVisualSync(api);
    },
    afterWildDamage(api, payload, state) {
      if (clampSpeed(state.speed) < 5) return;
      scheduleVisualSync(api);
    },
    afterEnemyDefeated(api, payload, state) {
      accelerateCurrentRespawn(state);
      if (clampSpeed(state.speed) >= 5) scheduleVisualSync(api);
    }
  }
});

installStyles();
startMenuObserver();
startRejoinObserver();
queueRenderConfig(UltraMods);

// ===================== 状态 / 存储 =====================

function ensureState(state) {
  if (!state || typeof state !== "object") state = {};
  state.speed = clampSpeed(state.speed || 2);
  if (!state.autoRejoin || typeof state.autoRejoin !== "object") {
    state.autoRejoin = { enabled: false, count: 0, clickedThisCycle: false, lastVisible: false };
  }
  state.autoRejoin.enabled = !!state.autoRejoin.enabled;
  state.autoRejoin.count = Number(state.autoRejoin.count) || 0;
  return state;
}

function getState(api) {
  const saved = api.saved;
  if (!saved.mods) saved.mods = {};
  if (!saved.mods.state) saved.mods.state = {};
  if (!saved.mods.state[MOD_ID]) saved.mods.state[MOD_ID] = {};
  return ensureState(saved.mods.state[MOD_ID]);
}

function clampSpeed(value) {
  let speed = Math.round(Number(value));
  if (!Number.isFinite(speed)) speed = 2;
  return Math.max(MIN_SPEED, Math.min(MAX_SPEED, speed));
}

function setSpeed(api, state, target) {
  const speed = clampSpeed(target);
  state.speed = speed;
  if (api.isEnabled(MOD_ID)) applySpeed(api, state);
  else updateBodyState(api, state);
  api.save();
  renderConfig(api);
}

// ===================== 战斗加速（非全局，回合推进） =====================

function applySpeed(api, state) {
  ensureState(state);
  api.saved.overrideBattleTimer = BASE_TIMER;
  removeLegacyPatch();
  startTurboLoop(state);
  updateBodyState(api, state);
}

function restoreSpeed(api) {
  stopTurboLoop();
  removeLegacyPatch();
  api.saved.overrideBattleTimer = BASE_TIMER;
  document.body.classList.remove("pokechill-helper-active", "pokechill-helper-fast");
}

function updateBodyState(api, state) {
  const enabled = api.isEnabled(MOD_ID);
  const speed = clampSpeed(state.speed);
  document.body.classList.toggle("pokechill-helper-active", enabled);
  document.body.classList.toggle("pokechill-helper-fast", enabled && speed >= 5);
}

// ===================== 跳过时间（游戏原生 afkSeconds 快进） =====================

function skipTime(hours) {
  if (typeof afkSeconds === "undefined") return;
  const seconds = Math.round(hours * 60 * 60);
  afkSeconds += seconds;
  const label = hours < 1 ? `${hours * 60} 分钟` : `${hours} 小时`;
  console.log(`[Pokechill助手] ⏳ 已跳过 ${label}（afkSeconds += ${seconds}）`);
}

// ===================== 自动重开 =====================

function isActuallyVisible(el) {
  return !!(el && el.offsetParent !== null && el.getClientRects().length > 0);
}

function checkAutoRejoin(api) {
  if (!api.isEnabled(MOD_ID)) return;
  const state = getState(api);
  if (!state.autoRejoin.enabled) return;

  const btn = document.getElementById("area-rejoin");
  if (!btn) return;

  const visible = isActuallyVisible(btn);

  if (!visible && state.autoRejoin.lastVisible) {
    state.autoRejoin.clickedThisCycle = false;
  }

  if (visible && !state.autoRejoin.lastVisible && !state.autoRejoin.clickedThisCycle) {
    state.autoRejoin.clickedThisCycle = true;
    btn.click();
    state.autoRejoin.count++;
    api.save();
    renderConfig(api);
    console.log(`[Pokechill助手] 自动重开触发（总次数: ${state.autoRejoin.count}）`);
  }
  state.autoRejoin.lastVisible = visible;
}

function startRejoinObserver() {
  if (rejoinObserverStarted) return;
  rejoinObserverStarted = true;
  const observer = new MutationObserver(() => {
    try { checkAutoRejoin(UltraMods); } catch (e) { /* ignore */ }
  });
  observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true });
}

// ===================== UI / 样式 =====================

function installStyles() {
  if (document.getElementById(STYLE_ID)) return;

  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    .${CONFIG_CLASS} {
      align-items: center;
      border-top: 1px solid rgba(59, 51, 35, 0.35);
      display: flex;
      flex-wrap: wrap;
      gap: 0.4rem;
      grid-column: 2 / 4;
      margin-top: 0.15rem;
      padding-top: 0.45rem;
    }

    .pch-label,
    .pch-current {
      color: white;
      font-size: 0.95rem;
    }

    .pch-current {
      font-family: monospace;
      min-width: 2.6rem;
      text-align: right;
    }

    .pch-slider {
      flex: 1;
      min-width: 120px;
      accent-color: rgb(90, 133, 113);
      cursor: pointer;
      height: 0.4rem;
    }

    .pch-input {
      width: 3.5rem;
      background: var(--dark2);
      border: 1px solid rgba(255, 255, 255, 0.2);
      border-radius: 0.3rem;
      color: var(--light2);
      font-family: inherit;
      font-size: 0.95rem;
      padding: 0.2rem 0.35rem;
      text-align: center;
    }
    .pch-input::-webkit-outer-spin-button,
    .pch-input::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
    .pch-input { -moz-appearance: textfield; }

    .pch-speed-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 0.35rem;
      width: 100%;
    }

    .pch-btn {
      background: var(--dark1);
      border: 0;
      border-radius: 0.4rem;
      color: var(--light2);
      cursor: pointer;
      font-family: inherit;
      font-size: 0.95rem;
      padding: 0.35rem 0.45rem;
      transition: filter 0.1s, background 0.1s, transform 0.05s;
    }
    .pch-btn:hover { filter: brightness(1.15); }
    .pch-btn:active { transform: translateY(1px); }
    .pch-btn.active {
      background: rgb(90, 133, 113);
      color: white;
    }
    .pch-btn.flash {
      background: rgb(90, 133, 113) !important;
      color: white !important;
    }

    body.pokechill-helper-fast .explore-hp,
    body.pokechill-helper-fast .explore-hp-wild,
    body.pokechill-helper-fast [id^="pkmn-movebox-"][id$="-bar"] {
      transition: none !important;
    }

    @media (max-width: 650px) {
      .${CONFIG_CLASS} {
        grid-column: 1 / -1;
      }
    }
  `;
  document.head.appendChild(style);
}

function startMenuObserver() {
  if (menuObserverStarted) return;
  menuObserverStarted = true;
  const observer = new MutationObserver(() => queueRenderConfig(UltraMods));
  observer.observe(document.documentElement, { childList: true, subtree: true });
}

function queueRenderConfig(api) {
  if (renderQueued) return;
  renderQueued = true;
  requestAnimationFrame(() => {
    renderQueued = false;
    renderConfig(api);
  });
}

function renderConfig(api) {
  const card = document.querySelector(`.mod-card[data-mod-id="${MOD_ID}"]`);
  if (!card) return;

  const state = getState(api);
  const speed = clampSpeed(state.speed);
  const ar = state.autoRejoin;

  let panel = card.querySelector(`.${CONFIG_CLASS}`);
  if (!panel) {
    panel = buildPanel(api, state);
    card.appendChild(panel);
  }

  // 同步动态数值（不重建 DOM，避免输入框失焦 / 滑块闪烁）
  const slider = panel.querySelector(".pch-slider");
  const input = panel.querySelector(".pch-input");
  const current = panel.querySelector(".pch-current");
  if (document.activeElement !== slider) slider.value = String(speed);
  if (document.activeElement !== input) input.value = String(speed);
  current.textContent = `${speed}x`;

  panel.querySelectorAll(".pch-speed-grid .pch-btn").forEach(btn => {
    const val = Number(btn.dataset.speed);
    btn.classList.toggle("active", val === speed);
  });

  const rejoinBtn = panel.querySelector(".pch-autorejoin");
  if (rejoinBtn) {
    rejoinBtn.classList.toggle("active", ar.enabled);
    rejoinBtn.textContent = ar.enabled ? "🔄 自动重开: ON" : "🔄 自动重开: OFF";
  }
  const countSpan = panel.querySelector(".pch-count");
  if (countSpan) countSpan.textContent = `次数: ${ar.count}`;
}

function buildPanel(api, state) {
  const panel = document.createElement("div");
  panel.className = CONFIG_CLASS;

  // 倍速行：标签 + 滑动条 + 输入框 + 当前值
  const speedRow = document.createElement("div");
  speedRow.className = "pch-row";
  speedRow.style.display = "flex";
  speedRow.style.alignItems = "center";
  speedRow.style.gap = "0.4rem";
  speedRow.style.width = "100%";
  speedRow.style.flexWrap = "wrap";

  const label = document.createElement("span");
  label.className = "pch-label";
  label.textContent = "战斗速度";
  speedRow.appendChild(label);

  const slider = document.createElement("input");
  slider.type = "range";
  slider.className = "pch-slider";
  slider.min = String(MIN_SPEED);
  slider.max = String(MAX_SPEED);
  slider.step = "1";
  speedRow.appendChild(slider);

  const input = document.createElement("input");
  input.type = "number";
  input.className = "pch-input";
  input.min = String(MIN_SPEED);
  input.max = String(MAX_SPEED);
  input.step = "1";
  speedRow.appendChild(input);

  const current = document.createElement("span");
  current.className = "pch-current";
  speedRow.appendChild(current);

  panel.appendChild(speedRow);

  // 倍速按钮：6 个，2 行 × 3 列
  const grid = document.createElement("div");
  grid.className = "pch-speed-grid";
  for (const option of SPEEDS) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "pch-btn";
    button.dataset.speed = String(option);
    button.textContent = `${option}x`;
    button.addEventListener("click", event => {
      event.preventDefault();
      event.stopPropagation();
      setSpeed(api, getState(api), option);
    });
    grid.appendChild(button);
  }
  panel.appendChild(grid);

  // 跳过时间行：保留 90 分钟 / 12 小时
  const skipRow = document.createElement("div");
  skipRow.className = "pch-row";
  skipRow.style.display = "flex";
  skipRow.style.gap = "0.4rem";
  skipRow.style.width = "100%";

  const skip90 = document.createElement("button");
  skip90.type = "button";
  skip90.className = "pch-btn pch-skip";
  skip90.textContent = "⏱ 跳过90分钟";
  skip90.addEventListener("click", event => {
    event.preventDefault();
    event.stopPropagation();
    skipTime(1.5);
    flash(skip90);
  });

  const skip12 = document.createElement("button");
  skip12.type = "button";
  skip12.className = "pch-btn pch-skip";
  skip12.textContent = "🌙 跳过12小时";
  skip12.addEventListener("click", event => {
    event.preventDefault();
    event.stopPropagation();
    skipTime(12);
    flash(skip12);
  });

  skipRow.append(skip90, skip12);
  panel.appendChild(skipRow);

  // 自动重开行：开关 + 计数
  const rejoinRow = document.createElement("div");
  rejoinRow.className = "pch-row";
  rejoinRow.style.display = "flex";
  rejoinRow.style.gap = "0.4rem";
  rejoinRow.style.width = "100%";
  rejoinRow.style.alignItems = "center";

  const rejoinBtn = document.createElement("button");
  rejoinBtn.type = "button";
  rejoinBtn.className = "pch-btn pch-autorejoin";
  rejoinBtn.addEventListener("click", event => {
    event.preventDefault();
    event.stopPropagation();
    const s = getState(api);
    s.autoRejoin.enabled = !s.autoRejoin.enabled;
    if (!s.autoRejoin.enabled) {
      s.autoRejoin.count = 0;
      s.autoRejoin.clickedThisCycle = false;
      s.autoRejoin.lastVisible = false;
    }
    api.save();
    renderConfig(api);
  });
  rejoinRow.appendChild(rejoinBtn);

  const countSpan = document.createElement("span");
  countSpan.className = "pch-current pch-count";
  rejoinRow.appendChild(countSpan);
  panel.appendChild(rejoinRow);

  // 滑动条 / 输入框 联动
  slider.addEventListener("input", event => {
    event.stopPropagation();
    setSpeed(api, getState(api), Number(slider.value));
  });
  input.addEventListener("change", event => {
    event.stopPropagation();
    const v = clampSpeed(Number(input.value));
    setSpeed(api, getState(api), v);
    input.value = String(v);
  });
  input.addEventListener("keydown", event => {
    if (event.key === "Enter") {
      event.preventDefault();
      input.blur();
    }
  });

  return panel;
}

function flash(btn) {
  btn.classList.add("flash");
  setTimeout(() => btn.classList.remove("flash"), 400);
}

// ===================== 战斗加速主循环（移植自 speedBattles） =====================

function startTurboLoop(state) {
  const speed = clampSpeed(state.speed);
  let loop = window[LOOP_KEY];

  if (!loop) {
    loop = {
      active: false,
      accumulator: 0,
      interval: 0,
      last: performance.now(),
      raf: 0,
      running: false,
      speed: 1
    };
    window[LOOP_KEY] = loop;
  }

  loop.active = true;
  loop.speed = speed;
  loop.last = performance.now();

  if (loop.raf) {
    cancelAnimationFrame(loop.raf);
    loop.raf = 0;
  }

  if (!loop.running || !loop.interval) {
    if (loop.interval) clearInterval(loop.interval);
    loop.running = true;
    loop.interval = setInterval(runTurboLoop, INTERVAL_MS);
  }
}

function stopTurboLoop() {
  const loop = window[LOOP_KEY];
  if (!loop) return;

  loop.active = false;
  loop.speed = 1;
  loop.accumulator = 0;
  if (loop.interval) clearInterval(loop.interval);
  loop.interval = 0;
  if (loop.raf) cancelAnimationFrame(loop.raf);
  loop.raf = 0;
  loop.running = false;
}

function runTurboLoop(now) {
  const loop = window[LOOP_KEY];
  if (!loop?.active) {
    if (loop) {
      if (loop.interval) clearInterval(loop.interval);
      loop.interval = 0;
      loop.running = false;
    }
    return;
  }

  const timestamp = Number.isFinite(Number(now)) ? Number(now) : performance.now();
  const speed = clampSpeed(loop.speed);
  const extraTicks = Math.max(0, speed - 1);
  let delta = timestamp - loop.last;
  loop.last = timestamp;
  if (delta > 250) delta = 250;

  if (extraTicks > 0 && !isAfkFastForwardActive()) {
    loop.accumulator += delta * extraTicks;
    runExtraCombatTicks(loop);
  } else {
    loop.accumulator = 0;
  }
}

function runExtraCombatTicks(loop) {
  if (typeof window.exploreCombatPlayer !== "function" || typeof window.exploreCombatWild !== "function") return;

  const maxTicks = Math.max(1, Math.min(600, clampSpeed(loop.speed) * 20));
  let ticks = 0;

  while (loop.accumulator >= STEP_MS && ticks < maxTicks) {
    if (isCombatStopped()) {
      loop.accumulator = 0;
      return;
    }

    window.exploreCombatPlayer();

    if (!isCombatStopped()) {
      window.exploreCombatWild();
    }

    loop.accumulator -= STEP_MS;
    ticks++;
  }
}

function removeLegacyPatch() {
  const patch = window[LEGACY_PATCH_KEY];
  if (!patch?.installed) return;

  patch.enabled = false;
  patch.speed = 1;
  patch.skipNextWild = false;

  if (window.exploreCombatPlayer === patch.player) window.exploreCombatPlayer = patch.originalPlayer;
  if (window.exploreCombatWild === patch.wild) window.exploreCombatWild = patch.originalWild;
  patch.installed = false;
}

function isCombatStopped() {
  try {
    return typeof shouldCombatStop === "function" && shouldCombatStop();
  } catch (error) {
    return false;
  }
}

function isAfkFastForwardActive() {
  try {
    return typeof afkSeconds !== "undefined" && afkSeconds > 0;
  } catch (error) {
    return false;
  }
}

function accelerateCurrentRespawn(state) {
  const speed = clampSpeed(state.speed);
  if (speed <= 1 || window[RESPAWN_PATCH_KEY]) return;

  const originalSetTimeout = window.setTimeout;
  const originalVoidAnimation = window.voidAnimation;
  const patch = { originalSetTimeout, originalVoidAnimation };
  window[RESPAWN_PATCH_KEY] = patch;

  window.setTimeout = function patchedPokechillHelperTimeout(callback, delay, ...args) {
    let nextDelay = delay;
    if (typeof delay === "number" && delay > 0 && delay <= 1600) {
      nextDelay = Math.max(1, delay / speed);
    }
    return originalSetTimeout.call(window, callback, nextDelay, ...args);
  };

  if (typeof originalVoidAnimation === "function") {
    window.voidAnimation = function patchedPokechillHelperAnimation(divName, animationName) {
      let nextAnimation = animationName;
      if (divName === "explore-wild-sprite" && typeof animationName === "string" && animationName.includes("wildPokemonDown")) {
        nextAnimation = animationName.replace(/([0-9]+(?:\.[0-9]+)?)s/g, (match, seconds) => {
          return `${Math.max(0.05, Number(seconds) / speed)}s`;
        });
      }
      return originalVoidAnimation.call(this, divName, nextAnimation);
    };
  }

  originalSetTimeout.call(window, () => {
    const activePatch = window[RESPAWN_PATCH_KEY];
    if (activePatch !== patch) return;
    window.setTimeout = originalSetTimeout;
    if (typeof originalVoidAnimation === "function") window.voidAnimation = originalVoidAnimation;
    delete window[RESPAWN_PATCH_KEY];
  }, 0);
}

function scheduleVisualSync(api) {
  requestAnimationFrame(() => {
    requestAnimationFrame(() => syncHpVisuals(api));
  });
}

function syncHpVisuals(api) {
  const teamState = api.getTeamState();
  for (const slot in teamState) {
    const hp = Number(teamState[slot].hp) || 0;
    const hpMax = Number(teamState[slot].hpMax) || 1;
    const percent = Math.max(0, Math.min(100, (hp / hpMax) * 100));
    const bar = document.getElementById(`explore-${slot}-hp`);
    if (!bar) continue;

    bar.style.width = `${percent}%`;
    if (percent > 60) bar.style.background = "rgb(130, 211, 130)";
    else if (percent < 30) bar.style.background = "rgba(219, 112, 112, 1)";
    else bar.style.background = "rgba(221, 168, 99, 1)";
  }

  const battle = api.getBattleState();
  if (!Number.isFinite(Number(battle.wildHpMax)) || battle.wildHpMax <= 0) return;

  const percent = Math.max(0, Math.min(100, (Number(battle.wildHp) / Number(battle.wildHpMax)) * 100));
  const bars = [
    document.getElementById("exploe-wild-hp"),
    document.getElementById("exploe-wild-hp-2"),
    document.getElementById("exploe-wild-hp-3"),
    document.getElementById("exploe-wild-hp-4")
  ].filter(Boolean);

  const activeBars = Math.max(1, bars.filter(bar => bar.style.display !== "none").length);
  const segment = 100 / activeBars;

  for (let i = 0; i < bars.length; i++) {
    const bar = bars[i];
    if (i >= activeBars) continue;

    const start = segment * i;
    const end = start + segment;
    if (percent > start) {
      bar.style.width = percent >= end ? "100%" : `${((percent - start) / segment) * 100}%`;
    } else {
      bar.style.width = "0%";
    }
  }
}
