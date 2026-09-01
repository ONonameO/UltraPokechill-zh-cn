// Pokechill 助手 — 非全局战斗加速 + 倍速滑动条/输入框 + 跳过时间(原版 Date 劫持) + 自动重开
// 改写自原 pokechill助手 userscript：
//  - 战斗加速改用 speedBattles 的回合推进式（非全局）机制；
//  - 跳过时间沿用原脚本对 window.Date 的劫持方式（仅做时钟偏移，1x，不加速全局时间）；
//  - UI 为独立浮窗（可拖拽/折叠），美术与交互沿用原版游戏 mod 卡片风格；
//  - 删除静音功能。

const MOD_ID = "pokechillHelper";
const STYLE_ID = "pokechill-helper-style";
const LOOP_KEY = "__pokechillHelperLoop";
const RESPAWN_PATCH_KEY = "__pokechillHelperRespawnPatch";
const TIME_KEY = "__pokechillHelperTimeHijack";
const BASE_TIMER = 2000;
const STEP_MS = 1000 / 60;
const INTERVAL_MS = 50;
const SPEEDS = [1, 2, 3, 5, 10, 50];
const MIN_SPEED = 1;
const MAX_SPEED = 50;

let uiEl = null;
let timeOriginals = null;
let timeState = { isActive: false, startTime: { real: 0, virtual: 0 } };
let rejoinObserver = null;
let rejoinObserverStarted = false;
let hotkeysInstalled = false;
let apiRef = null;

UltraMods.define({
  id: MOD_ID,
  name: "Pokechill 助手",
  description: "非全局战斗加速（回合推进）+ 倍速滑动条/输入框(1-50x) + 跳过时间(原版 Date 劫持) + 自动重开。独立浮窗 UI。",
  image: "img/items/quickClaw.png",
  version: "1.0",
  author: "黄黄",
  category: "实用工具",
  defaultEnabled: false,
  hooks: {
    onToggle(api, payload, state) {
      installStyles();
      ensureState(state);
      apiRef = api;

      if (payload.enabled) {
        installTimeHijack();
        applySpeed(api, state);
        ensureFloatingUI(api, state);
        startRejoinObserver(api);
        installHotkeys(api);
      } else {
        restoreSpeed(api);
        removeTimeHijack();
        removeFloatingUI();
        stopRejoinObserver();
        removeHotkeys();
      }

      updateBodyState(api, state);
    },
    onRefresh(api, payload, state) {
      installStyles();
      ensureState(state);
      apiRef = api;

      if (api.isEnabled(MOD_ID)) {
        installTimeHijack();
        applySpeed(api, state);
        ensureFloatingUI(api, state);
        startRejoinObserver(api);
      }
      updateBodyState(api, state);
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

// ===================== 状态 / 存储 =====================

function ensureState(state) {
  if (!state || typeof state !== "object") state = {};
  state.speed = clampSpeed(state.speed || 2);

  const ui = (state.uiState && typeof state.uiState === "object") ? state.uiState : {};
  state.uiState = {
    left: typeof ui.left === "string" ? ui.left : "10px",
    top: typeof ui.top === "string" ? ui.top : "10px",
    isCollapsed: !!ui.isCollapsed
  };

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
  updateFloatingUI(api, state);
}

// ===================== 战斗加速（非全局，回合推进，移植自 speedBattles） =====================

function applySpeed(api, state) {
  ensureState(state);
  api.saved.overrideBattleTimer = BASE_TIMER;
  startTurboLoop(state);
  updateBodyState(api, state);
}

function restoreSpeed(api) {
  stopTurboLoop();
  api.saved.overrideBattleTimer = BASE_TIMER;
  document.body.classList.remove("pokechill-helper-active", "pokechill-helper-fast");
}

function updateBodyState(api, state) {
  const enabled = api.isEnabled(MOD_ID);
  const speed = clampSpeed(state.speed);
  document.body.classList.toggle("pokechill-helper-active", enabled);
  document.body.classList.toggle("pokechill-helper-fast", enabled && speed >= 5);
}

// ===================== 跳过时间（沿用原脚本：劫持 window.Date） =====================

function saveOriginals() {
  if (timeOriginals) return;
  timeOriginals = { Date: window.Date, dateNow: Date.now };
}

function getRealNow() {
  return timeOriginals ? timeOriginals.dateNow.call(timeOriginals.Date) : Date.now();
}

function getVirtualTime(realTimeNow) {
  if (!timeState.isActive) return realTimeNow;
  const realDelta = realTimeNow - timeState.startTime.real;
  return timeState.startTime.virtual + (realDelta * 1); // 1x：仅做时钟偏移，不加速全局时间
}

function updateTimeAnchor() {
  const realNow = getRealNow();
  const currentVirtual = timeState.isActive ? getVirtualTime(realNow) : realNow;
  timeState.startTime.real = realNow;
  timeState.startTime.virtual = currentVirtual;
  timeState.isActive = true;
}

function hijackDate() {
  const OriginalDate = timeOriginals.Date;
  const MockDate = function (...args) {
    if (args.length === 0 && timeState.isActive) {
      const realNow = timeOriginals.dateNow.call(OriginalDate);
      const offset = getVirtualTime(getRealNow()) - getRealNow();
      return new OriginalDate(realNow + offset);
    }
    return new OriginalDate(...args);
  };
  MockDate.prototype = OriginalDate.prototype;
  MockDate.UTC = OriginalDate.UTC;
  MockDate.parse = OriginalDate.parse;
  MockDate.now = () => {
    const realNow = timeOriginals.dateNow.call(OriginalDate);
    if (!timeState.isActive) return realNow;
    return getVirtualTime(realNow);
  };
  window.Date = MockDate;
}

function installTimeHijack() {
  if (window[TIME_KEY]) return;
  saveOriginals();
  hijackDate();
  const now = getRealNow();
  timeState = { isActive: false, startTime: { real: now, virtual: now } };
  window[TIME_KEY] = true;
}

function removeTimeHijack() {
  if (!window[TIME_KEY]) return;
  if (timeOriginals) window.Date = timeOriginals.Date;
  timeState = { isActive: false, startTime: { real: 0, virtual: 0 } };
  window[TIME_KEY] = false;
}

function skipTime(hours) {
  updateTimeAnchor();
  const msToAdd = hours * 60 * 60 * 1000;
  timeState.startTime.virtual += msToAdd;
  const label = hours < 1 ? `${hours * 60} 分钟` : `${hours} 小时`;
  console.log(`[Pokechill助手] ⏳ 已跳过 ${label}`);
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
    updateFloatingUI(api, state);
    console.log(`[Pokechill助手] 自动重开触发（总次数: ${state.autoRejoin.count}）`);
  }
  state.autoRejoin.lastVisible = visible;
}

function startRejoinObserver(api) {
  if (rejoinObserverStarted) return;
  rejoinObserverStarted = true;
  rejoinObserver = new MutationObserver(() => {
    try { if (apiRef) checkAutoRejoin(apiRef); } catch (e) { /* ignore */ }
  });
  rejoinObserver.observe(document.documentElement, { childList: true, subtree: true, attributes: true });
}

function stopRejoinObserver() {
  if (rejoinObserver) { rejoinObserver.disconnect(); rejoinObserver = null; }
  rejoinObserverStarted = false;
}

// ===================== 浮窗 UI（独立、可拖拽/折叠，游戏风格） =====================

function installStyles() {
  if (document.getElementById(STYLE_ID)) return;

  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    .pch-floating {
      position: fixed;
      top: 10px;
      left: 10px;
      width: 300px;
      border: 1px solid rgba(255, 255, 255, 0.18);
      border-radius: 0.5rem;
      font-family: inherit;
      font-size: 0.95rem;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35);
      z-index: 1100;
      user-select: none;
      box-sizing: border-box;
      overflow: hidden;
    }

    .pch-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: var(--light1);
      color: var(--light2);
      padding: 0.45rem 0.6rem;
      cursor: grab;
    }
    .pch-title {
      font-weight: bold;
      font-size: 1rem;
      pointer-events: none;
    }
    .pch-toggle-btn {
      background: transparent;
      border: 0;
      color: var(--light2);
      cursor: pointer;
      font-size: 1.1rem;
      line-height: 1;
      padding: 0 0.2rem;
    }
    .pch-toggle-btn:hover { transform: scale(1.15); }

    .pch-content {
      display: flex;
      flex-direction: column;
      gap: 0.45rem;
      background: var(--light2);
      color: var(--dark2);
      padding: 0.55rem 0.6rem;
    }

    .pch-speed-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.4rem;
    }
    .pch-speed-title {
      display: flex;
      align-items: center;
      gap: 0.4rem;
      color: var(--light1);
      font-weight: bold;
    }

    .pch-reset-btn {
      padding: 0.15rem 0.55rem;
      font-size: 0.85rem;
    }

    .pch-speed-row {
      display: flex;
      align-items: center;
      gap: 0.4rem;
      flex-wrap: wrap;
    }

    .pch-slider {
      flex: 1;
      min-width: 110px;
      accent-color: rgb(90, 133, 113);
      cursor: pointer;
    }

    .pch-input {
      width: 3.5rem;
      background: var(--dark2);
      color: var(--light2);
      border: 1px solid rgba(255, 255, 255, 0.2);
      border-radius: 0.3rem;
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
    }

    .pch-btn {
      background: var(--light1);
      color: var(--light2);
      border: 0;
      border-radius: 0.4rem;
      font-family: inherit;
      font-size: 0.95rem;
      padding: 0.35rem 0.45rem;
      cursor: pointer;
      transition: filter 0.1s, background 0.1s, transform 0.05s;
    }
    .pch-btn:hover { background: #685F4B; }
    .pch-btn:active { transform: translateY(1px); }
    .pch-btn.active {
      background: rgb(90, 133, 113);
      color: white;
    }

    .pch-skip-row { display: flex; gap: 0.4rem; }
    .pch-skip-row .pch-btn { flex: 1; }

    .pch-rejoin-row {
      display: flex;
      align-items: center;
      gap: 0.4rem;
    }
    .pch-autorejoin {
      flex: 1;
      width: 100%;
      display: flex;
      align-items: center;
      justify-content: space-between;
      text-align: left;
    }
    .pch-rejoin-status {
      margin-left: auto;
    }

    .pch-foot {
      margin-top: 0.35rem;
      font-size: 0.7rem;
      font-weight: bold;
      opacity: 0.7;
      text-align: center;
      pointer-events: none;
    }

    body.pokechill-helper-fast .explore-hp,
    body.pokechill-helper-fast .explore-hp-wild,
    body.pokechill-helper-fast [id^="pkmn-movebox-"][id$="-bar"] {
      transition: none !important;
    }
  `;
  document.head.appendChild(style);
}

function buildFloatingUI(api, state) {
  const ui = document.createElement("div");
  ui.id = "pokechill-helper-ui";
  ui.className = "pch-floating";

  const header = document.createElement("div");
  header.className = "pch-header";
  const title = document.createElement("span");
  title.className = "pch-title";
  title.textContent = "⚡ Pokechill 助手";
  const toggleBtn = document.createElement("button");
  toggleBtn.type = "button";
  toggleBtn.className = "pch-toggle-btn";
  toggleBtn.title = "折叠 / 展开";
  toggleBtn.textContent = "➖";
  header.append(title, toggleBtn);

  const content = document.createElement("div");
  content.className = "pch-content";

  // 倍速标题行：标题文字 + 当前倍速(nx) + 重置按钮（要求5、4）
  const speedHeader = document.createElement("div");
  speedHeader.className = "pch-speed-header";
  const speedTitle = document.createElement("div");
  speedTitle.className = "pch-speed-title";
  const label = document.createElement("span");
  label.className = "pch-label";
  label.textContent = "⏳ 战斗速度: ";
  const current = document.createElement("span");
  current.className = "pch-current";
  speedTitle.append(label, current);
  const resetBtn = makeButton("重置", () => { setSpeed(api, getState(api), 1); flash(resetBtn); });
  resetBtn.classList.add("pch-reset-btn");
  speedHeader.append(speedTitle, resetBtn);

  // 倍速行：滑动条 + 输入框
  const speedRow = document.createElement("div");
  speedRow.className = "pch-speed-row";
  const slider = document.createElement("input");
  slider.type = "range";
  slider.className = "pch-slider";
  slider.min = String(MIN_SPEED);
  slider.max = String(MAX_SPEED);
  slider.step = "1";
  const input = document.createElement("input");
  input.type = "number";
  input.className = "pch-input";
  input.min = String(MIN_SPEED);
  input.max = String(MAX_SPEED);
  input.step = "1";
  speedRow.append(slider, input);

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

  // 跳过时间行：沿用原脚本的 60 分钟 / 12 小时（要求2）
  const skipRow = document.createElement("div");
  skipRow.className = "pch-skip-row";
  const skip60 = makeButton("🕙 60分钟", () => { skipTime(1); flash(skip60); });
  const skip12 = makeButton("🌙 12小时", () => { skipTime(12); flash(skip12); });
  skipRow.append(skip60, skip12);

  // 自动重开行：按钮内含 ON/OFF 与(次数)，右侧对齐（要求7）
  const rejoinRow = document.createElement("div");
  rejoinRow.className = "pch-rejoin-row";
  const rejoinBtn = document.createElement("button");
  rejoinBtn.type = "button";
  rejoinBtn.className = "pch-btn pch-autorejoin";
  const rejoinLabel = document.createElement("span");
  rejoinLabel.className = "pch-rejoin-label";
  rejoinLabel.textContent = "🔄 自动重开";
  const rejoinStatus = document.createElement("span");
  rejoinStatus.className = "pch-rejoin-status";
  rejoinBtn.append(rejoinLabel, rejoinStatus);
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
    updateFloatingUI(api, s);
  });
  rejoinRow.append(rejoinBtn);

  const foot = document.createElement("div");
  foot.className = "pch-foot";
  foot.textContent = "Ctrl+Shift+↑/↓ 调整战斗速度";

  content.append(speedHeader, speedRow, grid, skipRow, rejoinRow, foot);
  ui.append(header, content);

  // 事件
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
    if (event.key === "Enter") { event.preventDefault(); input.blur(); }
  });
  toggleBtn.addEventListener("click", event => {
    event.stopPropagation();
    toggleCollapse(api, getState(api));
  });

  setupDrag(ui, header, api);
  return ui;
}

function makeButton(text, onClick) {
  const b = document.createElement("button");
  b.type = "button";
  b.className = "pch-btn";
  b.textContent = text;
  b.addEventListener("click", event => {
    event.preventDefault();
    event.stopPropagation();
    onClick();
  });
  return b;
}

function flash(btn) {
  btn.classList.add("flash");
  setTimeout(() => btn.classList.remove("flash"), 400);
}

function ensureFloatingUI(api, state) {
  if (uiEl) {
    updateFloatingUI(api, state);
    return;
  }
  uiEl = buildFloatingUI(api, state);
  document.body.appendChild(uiEl);

  uiEl.style.left = state.uiState.left;
  uiEl.style.top = state.uiState.top;
  if (state.uiState.isCollapsed) collapseUI(true);
  updateFloatingUI(api, state);
}

function removeFloatingUI() {
  if (uiEl && uiEl.parentNode) uiEl.parentNode.removeChild(uiEl);
  uiEl = null;
}

function updateFloatingUI(api, state) {
  if (!uiEl) return;
  const speed = clampSpeed(state.speed);

  const slider = uiEl.querySelector(".pch-slider");
  const input = uiEl.querySelector(".pch-input");
  const current = uiEl.querySelector(".pch-current");
  if (document.activeElement !== slider) slider.value = String(speed);
  if (document.activeElement !== input) input.value = String(speed);
  current.textContent = `${speed}x`;

  uiEl.querySelectorAll(".pch-speed-grid .pch-btn").forEach(btn => {
    btn.classList.toggle("active", Number(btn.dataset.speed) === speed);
  });

  const ar = state.autoRejoin;
  const rejoinBtn = uiEl.querySelector(".pch-autorejoin");
  if (rejoinBtn) {
    rejoinBtn.classList.toggle("active", ar.enabled);
    const status = rejoinBtn.querySelector(".pch-rejoin-status");
    if (status) status.textContent = ar.enabled ? `ON (${ar.count})` : "OFF";
  }
}

function toggleCollapse(api, state) {
  state.uiState.isCollapsed = !state.uiState.isCollapsed;
  collapseUI(state.uiState.isCollapsed);
  api.save();
}

function collapseUI(collapsed) {
  if (!uiEl) return;
  const content = uiEl.querySelector(".pch-content");
  const btn = uiEl.querySelector(".pch-toggle-btn");
  if (collapsed) {
    content.style.display = "none";
    btn.textContent = "➕";
  } else {
    content.style.display = "flex";
    btn.textContent = "➖";
  }
}

function setupDrag(ui, handle, api) {
  let dragging = false;
  let startX = 0, startY = 0, originLeft = 0, originTop = 0;

  handle.addEventListener("mousedown", event => {
    if (event.target.tagName === "BUTTON") return;
    dragging = true;
    ui.style.cursor = "grabbing";
    startX = event.clientX;
    startY = event.clientY;
    originLeft = ui.offsetLeft;
    originTop = ui.offsetTop;
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
    event.preventDefault();
  });

  function onMove(event) {
    if (!dragging) return;
    ui.style.left = (originLeft + (event.clientX - startX)) + "px";
    ui.style.top = (originTop + (event.clientY - startY)) + "px";
  }

  function onUp() {
    if (!dragging) return;
    dragging = false;
    ui.style.cursor = "default";
    document.removeEventListener("mousemove", onMove);
    document.removeEventListener("mouseup", onUp);
    const s = getState(api);
    s.uiState.left = ui.style.left;
    s.uiState.top = ui.style.top;
    api.save();
  }
}

// ===================== 快捷键 =====================

function onHotkey(event) {
  if (!event.ctrlKey || !event.shiftKey) return;
  if (!apiRef || !apiRef.isEnabled(MOD_ID)) return;

  const state = getState(apiRef);
  const key = event.key.toLowerCase();
  if (["arrowup", "arrowdown"].includes(key)) event.preventDefault();

  if (event.key === "ArrowUp") setSpeed(apiRef, state, clampSpeed(state.speed + 1));
  if (event.key === "ArrowDown") setSpeed(apiRef, state, clampSpeed(state.speed - 1));
}

function installHotkeys(api) {
  apiRef = api;
  if (hotkeysInstalled) return;
  hotkeysInstalled = true;
  document.addEventListener("keydown", onHotkey);
}

function removeHotkeys() {
  if (!hotkeysInstalled) return;
  document.removeEventListener("keydown", onHotkey);
  hotkeysInstalled = false;
  apiRef = null;
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
