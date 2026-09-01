// Pokechill 助手 — 全局加速 + 倍速滑动条/输入框 + 跳过时间(原版 Date 劫持) + 自动重开
// 改写自原 pokechill助手 userscript（v3.8.1）：
//  - 全局加速：劫持 requestAnimationFrame / performance.now / Date / setTimeout / setInterval，
//    以虚拟时间方式将倍速覆盖到整个游戏运行过程（不再局限于战斗场景）；
//  - 跳过时间沿用原脚本对 window.Date 的劫持方式（虚拟时间偏移）；
//  - UI 为独立浮窗（可拖拽/折叠），美术与交互沿用原版游戏 mod 卡片风格；


const MOD_ID = "pokechillHelper";
const STYLE_ID = "pokechill-helper-style";
const TIME_KEY = "__pokechillHelperTimeHijack";
const SPEEDS = [1, 2, 3, 5, 10, 50];
const MIN_SPEED = 1;
const MAX_SPEED = 50;

let uiEl = null;
let timeOriginals = null;
let timeState = { speed: 1, isActive: false, startTime: { real: 0, virtual: 0 } };
let rejoinObserver = null;
let rejoinObserverStarted = false;
let hotkeysInstalled = false;
let apiRef = null;
let resizeHandler = null;       // 窗口 resize 时约束浮窗位置的监听

UltraMods.define({
  id: MOD_ID,
  name: "Pokechill 助手",
  description: "集成全局加速、时间跳过与自动重开三大功能，可将全局游戏运行提速，减少等待时间，轻松护肝。",
  image: "img/pkmn/sprite/rotom.png",
  version: "3.8.1",
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
        ensureFloatingUI(api, state);
        startRejoinObserver(api);
        installHotkeys(api);
      } else {
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
        ensureFloatingUI(api, state);
        startRejoinObserver(api);
      }
      updateBodyState(api, state);
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
  setGlobalSpeed(speed);
  updateBodyState(api, state);
  api.save();
  updateFloatingUI(api, state);
}

// 全局加速：更新虚拟时间锚点并设定倍速（状态判断/参数配置参考原脚本 setSpeed）
function setGlobalSpeed(speed) {
  if (timeState.speed === speed && timeState.isActive) return;
  updateTimeAnchor();
  timeState.speed = speed;
}

// ===================== 全局加速（劫持时间相关 API，覆盖整个游戏运行） =====================

function updateBodyState(api, state) {
  const enabled = api.isEnabled(MOD_ID);
  const speed = clampSpeed(state.speed);
  document.body.classList.toggle("pokechill-helper-active", enabled);
  document.body.classList.toggle("pokechill-helper-fast", enabled && speed >= 5);
}

// ===================== 跳过时间（沿用原脚本：劫持 window.Date） =====================

function saveOriginals() {
  if (timeOriginals) return;
  const rafName = window.requestAnimationFrame ? "requestAnimationFrame" :
                  window.webkitRequestAnimationFrame ? "webkitRequestAnimationFrame" : null;
  timeOriginals = {
    raf: rafName ? window[rafName] : null,
    Date: window.Date,
    dateNow: Date.now,
    perfNow: (window.performance && window.performance.now) ? window.performance.now : null,
    setTimeout: window.setTimeout,
    setInterval: window.setInterval
  };
}

function getRealNow() {
  if (timeOriginals && timeOriginals.perfNow) {
    return timeOriginals.perfNow.call(window.performance);
  }
  if (timeOriginals) return timeOriginals.dateNow.call(timeOriginals.Date);
  return Date.now();
}

function getVirtualTime(realTimeNow) {
  if (!timeState.isActive) return realTimeNow;
  const realDelta = realTimeNow - timeState.startTime.real;
  return timeState.startTime.virtual + (realDelta * timeState.speed);
}

function updateTimeAnchor() {
  const realNow = getRealNow();
  const currentVirtual = timeState.isActive ? getVirtualTime(realNow) : realNow;
  timeState.startTime.real = realNow;
  timeState.startTime.virtual = currentVirtual;
  timeState.isActive = true;
}

// 劫持 requestAnimationFrame：回调收到的是虚拟时间戳
function hijackRAF() {
  if (!timeOriginals.raf) return;
  const rafPolyfill = (callback) => {
    return timeOriginals.raf.call(window, (realTimestamp) => {
      const virtualTimestamp = timeState.isActive ? getVirtualTime(realTimestamp) : realTimestamp;
      callback(virtualTimestamp);
    });
  };
  if (window.requestAnimationFrame) window.requestAnimationFrame = rafPolyfill;
  if (window.webkitRequestAnimationFrame) window.webkitRequestAnimationFrame = rafPolyfill;
}

// 劫持 performance.now：返回虚拟时间
function hijackPerformance() {
  if (!timeOriginals.perfNow) return;
  window.performance.now = () => {
    const realNow = timeOriginals.perfNow.call(window.performance);
    return timeState.isActive ? getVirtualTime(realNow) : realNow;
  };
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

// 劫持 setTimeout / setInterval：按倍速缩放延迟（覆盖整个游戏运行过程）
function hijackTimers() {
  window.setTimeout = (cb, delay, ...args) => {
    const scaledDelay = timeState.isActive ? (delay / timeState.speed) : delay;
    return timeOriginals.setTimeout.call(window, cb, scaledDelay, ...args);
  };
  window.setInterval = (cb, delay, ...args) => {
    const scaledDelay = timeState.isActive ? (delay / timeState.speed) : delay;
    return timeOriginals.setInterval.call(window, cb, scaledDelay, ...args);
  };
}

function installTimeHijack() {
  if (window[TIME_KEY]) return;
  const state = getState(apiRef);
  saveOriginals();
  hijackRAF();
  hijackPerformance();
  hijackDate();
  hijackTimers();
  const now = getRealNow();
  timeState = {
    speed: clampSpeed(state.speed || 1),
    isActive: false,
    startTime: { real: now, virtual: now }
  };
  updateTimeAnchor();
  window[TIME_KEY] = true;
}

function removeTimeHijack() {
  if (!window[TIME_KEY]) return;
  if (timeOriginals) {
    window.Date = timeOriginals.Date;
    if (timeOriginals.perfNow) window.performance.now = timeOriginals.perfNow;
    if (timeOriginals.raf) {
      if (window.requestAnimationFrame) window.requestAnimationFrame = timeOriginals.raf;
      if (window.webkitRequestAnimationFrame) window.webkitRequestAnimationFrame = timeOriginals.raf;
    }
    window.setTimeout = timeOriginals.setTimeout;
    window.setInterval = timeOriginals.setInterval;
  }
  timeState = { speed: 1, isActive: false, startTime: { real: 0, virtual: 0 } };
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
    .pokechill-helper-floating {
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

    .pokechill-helper-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: var(--light1);
      color: var(--light2);
      padding: 0.45rem 0.6rem;
      cursor: grab;
    }
    .pokechill-helper-title {
      font-weight: bold;
      font-size: 1.15rem;
      pointer-events: none;
    }
    .pokechill-helper-toggle-btn {
      background: transparent;
      border: 0;
      color: var(--light2);
      cursor: pointer;
      font-size: 1.1rem;
      line-height: 1;
      padding: 0 0.2rem;
    }
    .pokechill-helper-toggle-btn:hover { transform: scale(1.15); }

    .pokechill-helper-content {
      display: flex;
      flex-direction: column;
      gap: 0.45rem;
      background: var(--light2);
      color: var(--dark2);
      padding: 0.55rem 0.6rem;
    }

    .pokechill-helper-section-title {
      display: flex;
      align-items: center;
      gap: 0.4rem;
      color: var(--dark2);
      font-weight: bold;
      font-size: 1rem;
    }


    .pokechill-helper-speed-row {
      display: flex;
      align-items: center;
      gap: 0.4rem;
      flex-wrap: wrap;
    }

    .pokechill-helper-slider {
      flex: 1;
      min-width: 110px;
      accent-color: rgb(90, 133, 113);
      cursor: pointer;
    }

    .pokechill-helper-input {
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
    .pokechill-helper-input::-webkit-outer-spin-button,
    .pokechill-helper-input::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
    .pokechill-helper-input { -moz-appearance: textfield; }

    .pokechill-helper-speed-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 0.35rem;
    }

    .pokechill-helper-btn {
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
    .pokechill-helper-btn:hover { background: #685F4B; }
    .pokechill-helper-btn:active { transform: translateY(1px); }
    .pokechill-helper-btn.active {
      background: rgb(90, 133, 113);
      color: white;
    }

    .pokechill-helper-divider {
      height: 0;
      margin: 0.5rem 0;
      border-top: 2px solid rgba(54, 52, 47, 0.3);
    }
    .pokechill-helper-skip-row {
      display: flex;
      gap: 0.4rem;
    }
    .pokechill-helper-skip-row .pokechill-helper-btn { flex: 1; }

    .pokechill-helper-rejoin-row {
      display: flex;
      align-items: center;
      gap: 0.4rem;
    }
    .pokechill-helper-autorejoin {
      flex: 1;
      width: 100%;
      display: flex;
      align-items: center;
      justify-content: space-between;
      text-align: left;
    }
    .pokechill-helper-rejoin-status {
      margin-left: auto;
    }

    .pokechill-helper-foot {
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
  ui.className = "pokechill-helper-floating";

  const header = document.createElement("div");
  header.className = "pokechill-helper-header";
  const title = document.createElement("span");
  title.className = "pokechill-helper-title";
  title.textContent = "⚡ Pokechill 助手";
  const toggleBtn = document.createElement("button");
  toggleBtn.type = "button";
  toggleBtn.className = "pokechill-helper-toggle-btn";
  toggleBtn.title = "折叠 / 展开";
  toggleBtn.textContent = "➖";
  header.append(title, toggleBtn);

  const content = document.createElement("div");
  content.className = "pokechill-helper-content";

  // 倍速标题行（仅标题，倍速数值由滑块/输入框控制，不再渲染 nx）
  const speedHeader = document.createElement("div");
  speedHeader.className = "pokechill-helper-section-title";
  const label = document.createElement("span");
  label.className = "pokechill-helper-section-title";
  label.textContent = "⏳ 游戏加速";
  speedHeader.append(label);

  // 倍速行：滑动条 + 输入框
  const speedRow = document.createElement("div");
  speedRow.className = "pokechill-helper-speed-row";
  const slider = document.createElement("input");
  slider.type = "range";
  slider.className = "pokechill-helper-slider";
  slider.min = String(MIN_SPEED);
  slider.max = String(MAX_SPEED);
  slider.step = "1";
  const input = document.createElement("input");
  input.type = "text";
  input.className = "pokechill-helper-input";
  input.inputMode = "numeric";
  input.placeholder = String(MIN_SPEED);
  input.title = `输入 ${MIN_SPEED}-${MAX_SPEED} 的整数`;
  speedRow.append(slider, input);

  // 倍速按钮：6 个，2 行 × 3 列
  const grid = document.createElement("div");
  grid.className = "pokechill-helper-speed-grid";
  for (const option of SPEEDS) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "pokechill-helper-btn";
    button.dataset.speed = String(option);
    button.textContent = `${option}x`;
    button.addEventListener("click", event => {
      event.preventDefault();
      event.stopPropagation();
      setSpeed(api, getState(api), option);
    });
    grid.appendChild(button);
  }

  // 跳过时间模块：上下两条 pokechill-helper-divider 分隔线（参考 pokechillTrainer），
  // 标题位于上方分隔线正下方，分隔线在标题之上
  const skipDividerTop = document.createElement("div");
  skipDividerTop.className = "pokechill-helper-divider";
  const skipTitle = document.createElement("div");
  skipTitle.className = "pokechill-helper-section-title";
  skipTitle.textContent = "⏰ 跳过时间";

  // 跳过时间行：沿用原脚本的 1小时 / 12 小时（要求2）
  const skipRow = document.createElement("div");
  skipRow.className = "pokechill-helper-skip-row";
  const skip1 = makeButton("🕙 1小时", () => { skipTime(1); flash(skip1); });
  const skip12 = makeButton("🌙 12小时", () => { skipTime(12); flash(skip12); });
  skipRow.append(skip1, skip12);

  const skipDividerBottom = document.createElement("div");
  skipDividerBottom.className = "pokechill-helper-divider";

  // 自动重开行：按钮内含 ON/OFF 与(次数)，右侧对齐（要求7）
  const rejoinRow = document.createElement("div");
  rejoinRow.className = "pokechill-helper-rejoin-row";
  const rejoinBtn = document.createElement("button");
  rejoinBtn.type = "button";
  rejoinBtn.className = "pokechill-helper-btn pokechill-helper-autorejoin";
  const rejoinLabel = document.createElement("span");
  rejoinLabel.className = "pokechill-helper-rejoin-label";
  rejoinLabel.textContent = "🔄 自动重开";
  const rejoinStatus = document.createElement("span");
  rejoinStatus.className = "pokechill-helper-rejoin-status";
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
  foot.className = "pokechill-helper-foot";
  foot.textContent = "Ctrl+Shift+↑/↓ 调整加速倍速";

  content.append(speedHeader, speedRow, grid, skipDividerTop, skipTitle, skipRow, skipDividerBottom, rejoinRow, foot);
  ui.append(header, content);

  // 事件
  slider.addEventListener("input", event => {
    event.stopPropagation();
    setSpeed(api, getState(api), Number(slider.value));
  });
  input.addEventListener("input", event => {
    event.stopPropagation();
    const cleaned = input.value.replace(/[^0-9]/g, "");
    if (cleaned !== input.value) input.value = cleaned;
  });
  input.addEventListener("change", event => {
    event.stopPropagation();
    const v = clampSpeed(Number(input.value || MIN_SPEED));
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
  b.className = "pokechill-helper-btn";
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
  clampFloatingPosition(uiEl);   // 初始位置也需约束在可视区内（窗口可能已变小）
  if (state.uiState.isCollapsed) collapseUI(true);
  updateFloatingUI(api, state);

  if (!resizeHandler) {
    resizeHandler = () => onWindowResize();
    window.addEventListener("resize", resizeHandler);
  }
}

function removeFloatingUI() {
  if (resizeHandler) {
    window.removeEventListener("resize", resizeHandler);
    resizeHandler = null;
  }
  if (uiEl && uiEl.parentNode) uiEl.parentNode.removeChild(uiEl);
  uiEl = null;
}

function updateFloatingUI(api, state) {
  if (!uiEl) return;
  const speed = clampSpeed(state.speed);

  const slider = uiEl.querySelector(".pokechill-helper-slider");
  const input = uiEl.querySelector(".pokechill-helper-input");
  if (document.activeElement !== slider) slider.value = String(speed);
  if (document.activeElement !== input) input.value = String(speed);

  uiEl.querySelectorAll(".pokechill-helper-speed-grid .pokechill-helper-btn").forEach(btn => {
    btn.classList.toggle("active", Number(btn.dataset.speed) === speed);
  });

  const ar = state.autoRejoin;
  const rejoinBtn = uiEl.querySelector(".pokechill-helper-autorejoin");
  if (rejoinBtn) {
    rejoinBtn.classList.toggle("active", ar.enabled);
    const status = rejoinBtn.querySelector(".pokechill-helper-rejoin-status");
    if (status) status.textContent = ar.enabled ? `ON ( ${ar.count} )` : "OFF";
  }
}

function toggleCollapse(api, state) {
  state.uiState.isCollapsed = !state.uiState.isCollapsed;
  collapseUI(state.uiState.isCollapsed);
  api.save();
}

function collapseUI(collapsed) {
  if (!uiEl) return;
  const content = uiEl.querySelector(".pokechill-helper-content");
  const btn = uiEl.querySelector(".pokechill-helper-toggle-btn");
  if (collapsed) {
    content.style.display = "none";
    btn.textContent = "➕";
  } else {
    content.style.display = "flex";
    btn.textContent = "➖";
  }
}

// 将浮窗整体约束在浏览器可视区域内部，确保不被移出窗口
function clampFloatingPosition(ui) {
  if (!ui) return;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const rect = ui.getBoundingClientRect();
  const w = rect.width;
  const h = rect.height;
  if (w <= 0 || h <= 0) return;
  const maxLeft = Math.max(0, vw - w);
  const maxTop = Math.max(0, vh - h);
  let left = rect.left;
  let top = rect.top;
  if (left > maxLeft) left = maxLeft;
  if (left < 0) left = 0;
  if (top > maxTop) top = maxTop;
  if (top < 0) top = 0;
  ui.style.left = left + "px";
  ui.style.top = top + "px";
}

// 窗口尺寸变化时重新计算并夹紧浮窗位置，并持久化
function onWindowResize() {
  if (!uiEl || !apiRef) return;
  clampFloatingPosition(uiEl);
  const s = getState(apiRef);
  s.uiState.left = uiEl.style.left;
  s.uiState.top = uiEl.style.top;
  apiRef.save();
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
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const rect = ui.getBoundingClientRect();
    const w = rect.width;
    const h = rect.height;
    let left = originLeft + (event.clientX - startX);
    let top = originTop + (event.clientY - startY);
    // 实时约束：浮窗整体必须完全位于可视区内
    const maxLeft = Math.max(0, vw - w);
    const maxTop = Math.max(0, vh - h);
    left = Math.min(Math.max(0, left), maxLeft);
    top = Math.min(Math.max(0, top), maxTop);
    ui.style.left = left + "px";
    ui.style.top = top + "px";
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

