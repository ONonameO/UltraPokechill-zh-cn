const MOD_ID = "pokechillGmax";

// 沿用 pokechillDummy / abilityTrainer 的约定：样式抽成独立 <style id> + id 守卫
const STYLE_ID = MOD_ID + "-style";
const PAGE_ID = "gmax-dimension-menu";
const MENU_ITEM_ID = "gmax-menu-item";
const FRAGMENT_ID = "gmaxFragment";
const AREA_PREFIX = "gmaxChallenge_";

// 默认配置。会被写入 UltraMods 的 mod state（saved.mods.state[pokechillGmax].config），
// 随存档持久化；后续调参无需改代码。
const DEFAULT_CONFIG = {
  enableGmaxDimension: true,  // 原实现里是硬编码的 settings.enableGmaxDimension
  gachaCost: 30,
  rotationHours: 12,
  bossLevel: 150,
  bossCount: 5,
  dexRequirement: 100,
  unownedChance: 0.5,   // 存在未拥有宝可梦时，抽中未拥有的概率
  shinyChance: 0.1,     // 抽中已拥有宝可梦时，出闪光的概率
  bossBuffValue: 99     // 超极巨化 Boss 的五项增益数值
};

let activeApi = null;
let activeState = null;
let config = { ...DEFAULT_CONFIG };

// ---- 运行时状态（不持久化到 mod state）----
let currentBosses = [];
let lastRotationTime = Date.now();
let countdownTimer = null;
let lockTimer = null;
let battleBuffed = false;   // 本次战斗是否已注入过 Boss 增益

UltraMods.define({
  id: MOD_ID,
  name: "Pokechill 超极巨化空间",
  description: "将「超极巨化空间」独立为 mod：定时刷新超极巨化 Boss 挑战区，收集碎片进行抽奖获取超极巨化宝可梦。基于 UltraMods API 实现，碎片数量与 Boss 轮换随存档持久化。由 mod 管理器独立启用或禁用。",
  image: "img/items/rareCandy.png",
  version: "2.0.0",
  author: "人民当家做主",
  category: "实用工具",
  defaultEnabled: false,
  hooks: {
    onToggle(api, payload, state) {
      if (payload.enabled) install(api, state);
      else uninstall(api);
    },
    onRefresh(api, payload, state) {
      if (!api.isEnabled(MOD_ID)) return;
      install(api, state);
    },

    // 进入战斗：准备注入 Boss 增益。
    //
    // 为什么不用 patch setWildPkmn：原实现在 setWildPkmn 里写 wildBuffs.*=99，
    // 但 initialiseArea() 紧接着就执行
    //   for (const buff in wildBuffs) { if (wildBuffs[buff] > 0) wildBuffs[buff] = 0 }
    // （explore.js:4049 setWildPkmn -> 4052 清零 -> 4066 updateWildBuffs）
    // 所以那次注入永远被抹掉，是无效代码。
    // 这里改用官方 onCombatStart 钩子，并延迟一拍（initialiseArea 是同步函数，
    // setTimeout 回调必然在其整体执行完之后运行）再写入，从而真正生效。
    onCombatStart(api, payload, state) {
      if (!isGmaxAreaId(payload?.areaId)) {
        battleBuffed = false;
        return;
      }
      battleBuffed = false;
      setTimeout(() => applyBossBuffs(api), 0);
    }
  }
});

// 【刻意不接管「战斗结束」】
//
// 原实现每 500ms 轮询 window.wildPkmnHp，发现 <= 0 就在 500ms 后强制离场。
// 但引擎自身的结算顺序是：
//   Boss 倒下
//     -> updateWildPkmn() 内 `if (trainer) currentTrainerSlot++`   (explore.js:1645)
//     -> setTimeout(..., respawnTimer=1000ms)                      (explore.js:1651)
//     -> setWildPkmn() 里 currentTrainerSlot(2) > maxTrainerSlot(1)(explore.js:410)
//     -> 「trainer won」分支发放 itemReward，也就是碎片         (explore.js:451)
//     -> areas[...].defeated = true; leaveCombat();                (explore.js:505-506)
//
// 即：碎片在击败后约 1000ms 才发放，而原实现 ~500ms 就把玩家踢出战斗，
// 两者构成竞态 —— leaveCombat() 一旦先执行，setWildPkmn() 不会再被调用，
// 这一场的碎片就直接被吞掉。
//
// 引擎自己已经会调 leaveCombat()，mod 再抢一次既多余又有害，因此整段移除。
// 用户可感知的差异只有「回到菜单晚约 500ms」，其余流程与原来完全一致。

// ---------- 安装 / 卸载 ----------

function install(api, state) {
  // 防御式守卫：游戏核心对象尚未就绪时直接跳过。
  // 正常时序下不会触发 —— UltraMods 的 onRefresh 在 window.load 之后才跑
  // （mods.js:1537-1542），那时 explore.js / pkmnDictionary.js 等已全部同步加载完毕。
  // 原实现用 setTimeout 每 100ms 轮询 waitForGame() 等就绪，这里不再需要。
  if (!api.item || !api.pkmn || !api.areas || !api.move) return;

  activeApi = api;
  activeState = state || null;
  config = loadConfig(state);
  if (!config.enableGmaxDimension) return;

  ensureFragmentItem(api);
  hydrateFragmentFromSave(api);   // 修复：把存档里已攒的碎片读回内存
  restoreRotation(activeState);

  installStyles();
  if (currentBosses.length === 0 || isRotationDue()) rotateBosses(api);
  updateGmaxAreas(api);
  addMenuItem(api);
  startLockWatcher(api);

  api.refreshGame();
}

function uninstall(api) {
  stopCountdown();
  stopLockWatcher();

  // 若玩家正停在超极巨化战斗里，先尝试按原实现的方式离场，避免残留一个已删除的区域
  if (api.saved && isGmaxAreaId(api.saved.currentArea)) leaveGmaxCombat();

  clearGmaxAreas(api);
  removePage();
  removeMenuItem();
  removeStyles();

  // 注意：这里刻意不删除 item[FRAGMENT_ID]。
  // saveGame() 是整体覆盖写（localStorage.setItem("gameData", JSON.stringify(data))），
  // 一旦道具从 item 里消失，data.gmaxFragment 就不再被写入，玩家已攒的碎片会被永久抹掉。
  // 保留该道具（禁用时它是惰性的）是唯一安全的做法。
  battleBuffed = false;
  currentBosses = [];
  activeApi = null;
  activeState = null;
  api.refreshGame();
}

// ---------- 配置管理（UltraMods mod state）----------

function loadConfig(state) {
  const stored = state && state.config && typeof state.config === "object" ? state.config : {};
  const merged = { ...DEFAULT_CONFIG };
  // 只接受已知的键，避免存档里的脏数据影响运行
  for (const key of Object.keys(DEFAULT_CONFIG)) {
    if (stored[key] !== undefined && stored[key] !== null) merged[key] = stored[key];
  }
  if (!state) return merged;
  state.config = merged;
  return merged;
}

// ---------- 自定义道具 ----------

function ensureFragmentItem(api) {
  const item = api.item;
  if (!item) return;
  if (!item[FRAGMENT_ID]) {
    item[FRAGMENT_ID] = {
      id: FRAGMENT_ID,
      rename: "超极巨化碎片",
      type: "key",
      got: 0,
      newItem: 0,
      info: function () { return "击败超极巨化宝可梦获得的稀有碎片..."; }
    };
  }
  if (item[FRAGMENT_ID].newItem === undefined) item[FRAGMENT_ID].newItem = 0;
  if (item[FRAGMENT_ID].got === undefined) item[FRAGMENT_ID].got = 0;
}

// 修复存读取顺序问题：
// loadGame() 只遍历「当前 item 里已存在」的键来回写 got（save.js:96-101），
// 而本 mod 是在 window load 之后才注册的道具（mods.js 的 onRefresh 晚于 explore.js 的 loadGame），
// 因此存档中的 data.gmaxFragment 永远读不回来 —— 原实现里碎片每次刷新页面都归零。
// UltraMods API 没有提供「读取存档原始字段」的能力，故这里做最小化兜底：
// 直接读游戏自己的 localStorage 键把数值补回内存。
function hydrateFragmentFromSave(api) {
  try {
    const raw = localStorage.getItem("gameData");
    if (!raw) return;
    const data = JSON.parse(raw);
    const entry = data[FRAGMENT_ID];
    const target = api.item[FRAGMENT_ID];
    if (!entry || !target) return;
    target.got = Math.max(0, Math.floor(Number(entry.got) || 0));
    target.newItem = Math.max(0, Math.floor(Number(entry.newItem) || 0));
  } catch (e) {
    // 存档缺失或损坏时保持默认 0，不影响游戏继续运行
  }
}

function getFragmentCount(api) {
  return Math.max(0, Number(api.item?.[FRAGMENT_ID]?.got) || 0);
}

// ---------- 样式（沿用 pokechillDummy 的独立 style + id 守卫）----------

function installStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    #${PAGE_ID} {
      background-image: url('img/bg/dimension-1.jpg');
      background-size: cover;
    }
    #${MENU_ITEM_ID} { cursor: pointer; }

    /* ---- 页面 ---- */
    .gmax-page {
      position: fixed;
      height: 100%;
      width: 50%;
      z-index: 150;
      overflow-y: scroll;
      overflow-x: hidden;
      flex-direction: column;
      padding-bottom: 3rem;
      display: none;
    }
    .gmax-header {
      height: 5rem;
      width: 100%;
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 0.4rem 2%;
      margin-bottom: 1rem;
      z-index: 3;
    }
    .gmax-menu-button {
      display: flex;
      align-items: center;
      gap: 5px;
      background: rgba(0,0,0,0.5);
      border: 1px solid rgba(255,255,255,0.7);
      border-radius: 0.5rem;
      padding: 0.5rem 1rem;
      cursor: pointer;
      color: white;
      font-size: 1.2rem;
    }
    .gmax-page-title {
      display: flex;
      align-items: center;
      background: rgba(0,0,0,0.5);
      border: 1px solid rgba(255,255,255,0.7);
      border-radius: 0.5rem;
      padding: 0.5rem 1rem;
      color: white;
      font-size: 1.5rem;
    }
    .gmax-page-title svg { margin-right: 0.5rem; }
    .gmax-content {
      width: 100%;
      padding: 10px;
      display: flex;
      flex-direction: column;
      gap: 20px;
    }

    /* ---- 顶部状态条 ---- */
    .gmax-stats {
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: rgba(0,0,0,0.6);
      border-radius: 50px;
      padding: 15px 20px;
      border: 1px solid #4ecca3;
      box-shadow: 0 0 20px rgba(78, 204, 163, 0.5);
      margin-bottom: 10px;
      gap: 10px;
    }
    .gmax-frag {
      display: flex;
      align-items: center;
      gap: 10px;
      font-size: clamp(1.2rem, 5vw, 1.5rem);
      color: white;
    }
    .gmax-frag-icon {
      width: 32px;
      height: 32px;
      filter: drop-shadow(0 0 10px gold);
      flex-shrink: 0;
    }
    .gmax-gacha-wrap {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 5px;
    }
    .gmax-gacha-btn {
      background: linear-gradient(45deg, #ff6b6b, #ff4757);
      border: none;
      border-radius: 40px;
      color: white;
      font-size: clamp(1.1rem, 4vw, 1.3rem);
      padding: 8px 20px;
      cursor: pointer;
      font-weight: bold;
      text-shadow: 0 2px 5px rgba(0,0,0,0.5);
      box-shadow: 0 0 20px #ff6b6b;
      transition: 0.2s;
      white-space: nowrap;
    }
    .gmax-gacha-btn:hover {
      transform: scale(1.05);
      box-shadow: 0 0 30px #ff4757;
    }
    .gmax-gacha-help {
      font-size: 0.8rem;
      color: #aaa;
      text-align: center;
      cursor: help;
    }
    .gmax-timer {
      font-size: clamp(1rem, 4vw, 1.3rem);
      color: #ffd966;
      text-shadow: 0 0 10px orange;
    }

    /* ---- Boss 卡片 ----
       直接复用游戏自带的 .dimension-pokemon / .dimension-sprite / .dimension-bhole
       （styles.css:6738-6764），这里只补尺寸自适应、竖向排布与反向黑洞，
       避免重复定义、也保证游戏日后调整超空间样式时本 mod 自动跟随。 */
    .gmax-card-container {
      display: flex;
      flex-direction: row;
      justify-content: center;
      gap: clamp(10px, 2vw, 20px);
      flex-wrap: wrap;
      padding: 20px 0;
    }
    .gmax-card-container .dimension-pokemon {
      height: clamp(10rem, 30vw, 12rem);
      width: clamp(10rem, 30vw, 12rem);
      flex-direction: column;
      margin: 0 auto;
    }
    .gmax-card-container .dimension-bhole {
      max-width: 200%;
    }
    .gmax-bhole-reverse {
      animation-direction: reverse;
      scale: 1.3;
    }
    .gmax-card-sprite {
      z-index: 2;
      margin-bottom: 0.5rem;
      max-width: 80%;
    }
    .gmax-card-stars {
      font-size: clamp(1rem, 4vw, 1.2rem);
      color: gold;
      text-shadow: 0 0 10px gold;
      background: rgba(0,0,0,0.6);
      padding: 4px 10px;
      border-radius: 20px;
      z-index: 3;
    }

    /* ---- 通用弹窗 ---- */
    .gmax-modal-overlay {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0,0,0,0.8);
      backdrop-filter: blur(8px);
      z-index: 30000;
      display: flex;
      justify-content: center;
      align-items: center;
      animation: tooltipBoxAppear 0.2s ease;
      padding: 10px;
    }
    .gmax-modal-box {
      background: #1a1a2e;
      border: 3px solid #4ecca3;
      border-radius: 30px;
      padding: clamp(15px, 5vw, 30px) clamp(20px, 8vw, 50px);
      box-shadow: 0 0 50px #4ecca3;
      text-align: center;
      color: white;
      font-family: 'Winky Sans', sans-serif;
      max-width: 500px;
      width: 90%;
    }
    .gmax-modal-title {
      margin-bottom: 20px;
      font-size: clamp(1.5rem, 6vw, 2rem);
      background: linear-gradient(45deg, #4ecca3, #00adb5);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }
    .gmax-modal-content {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 15px;
    }
    .gmax-modal-img {
      width: clamp(64px, 20vw, 96px);
      height: clamp(64px, 20vw, 96px);
      image-rendering: pixelated;
      filter: drop-shadow(0 0 10px gold);
    }
    .gmax-modal-text {
      font-size: clamp(1rem, 4vw, 1.3rem);
      line-height: 1.5;
      margin: 0;
    }
    .gmax-modal-btn {
      background: linear-gradient(45deg, #ff6b6b, #ff4757);
      border: none;
      border-radius: 40px;
      color: white;
      font-size: clamp(1.2rem, 5vw, 1.5rem);
      padding: clamp(8px, 2vw, 10px) clamp(20px, 8vw, 40px);
      cursor: pointer;
      font-weight: bold;
      box-shadow: 0 0 20px #ff6b6b;
      transition: 0.2s;
    }
    .gmax-modal-btn:hover { transform: scale(1.05); }

    @media (max-width: 768px) {
      #${PAGE_ID} { width: 100% !important; }
      .gmax-stats { flex-direction: column !important; gap: 10px !important; }
    }
  `;
  document.head.appendChild(style);
}

function removeStyles() {
  document.getElementById(STYLE_ID)?.remove();
}

// ---------- 弹窗 ----------

let modalOverlay = null;

function showFormalMessage(title, content, pkmnId) {
  closeModal();

  modalOverlay = document.createElement("div");
  modalOverlay.className = "gmax-modal-overlay";

  const box = document.createElement("div");
  box.className = "gmax-modal-box";

  const titleEl = document.createElement("h2");
  titleEl.className = "gmax-modal-title";
  titleEl.textContent = title;

  const contentWrapper = document.createElement("div");
  contentWrapper.className = "gmax-modal-content";

  if (pkmnId) {
    const img = document.createElement("img");
    img.className = "gmax-modal-img";
    img.src = `img/pkmn/sprite/${pkmnId}.png`;
    contentWrapper.appendChild(img);
  }

  const contentEl = document.createElement("p");
  contentEl.className = "gmax-modal-text";
  contentEl.textContent = content;
  contentWrapper.appendChild(contentEl);

  const confirmBtn = document.createElement("button");
  confirmBtn.type = "button";
  confirmBtn.className = "gmax-modal-btn";
  confirmBtn.textContent = "确 定";
  confirmBtn.addEventListener("click", closeModal);

  box.appendChild(titleEl);
  box.appendChild(contentWrapper);
  box.appendChild(confirmBtn);
  modalOverlay.appendChild(box);
  document.body.appendChild(modalOverlay);
}

function closeModal() {
  if (modalOverlay) {
    modalOverlay.remove();
    modalOverlay = null;
  }
}

// ---------- Boss 轮换 ----------

function isGmaxAreaId(areaId) {
  return typeof areaId === "string" && areaId.startsWith(AREA_PREFIX);
}

function getAllGmaxPokemon(api) {
  const list = [];
  for (const id in api.pkmn) {
    if (id.toLowerCase().includes("gmax")) list.push(id);
  }
  return list;
}

function isRotationDue() {
  return Date.now() - lastRotationTime >= config.rotationHours * 60 * 60 * 1000;
}

function rotateBosses(api) {
  const allGmax = getAllGmaxPokemon(api);
  if (allGmax.length === 0) return;
  const shuffled = [...allGmax].sort(() => Math.random() - 0.5);
  currentBosses = shuffled.slice(0, config.bossCount);
  lastRotationTime = Date.now();
  persistRotation();
}

// 轮换状态写入 mod state（随存档持久化）。
// 原实现把 currentGmaxBosses / lastRotationTime 放在模块局部变量里，
// 每次刷新页面都会重新随机 —— 这里改为持久化，12 小时轮换才真正跨刷新生效。
function persistRotation() {
  if (!activeState) return;
  activeState.rotation = {
    bosses: [...currentBosses],
    lastRotationTime
  };
}

function restoreRotation(state) {
  const saved = state?.rotation;
  if (!saved || !Array.isArray(saved.bosses)) return;
  currentBosses = saved.bosses;
  lastRotationTime = Number(saved.lastRotationTime) || Date.now();
}

// ---------- 挑战区域 ----------

function generateValidMoves(api, pokemonId) {
  const boss = api.pkmn[pokemonId];
  if (!boss) return ["tackle", "tackle", "tackle", "tackle"];

  const types = Array.isArray(boss.type) ? boss.type : [];
  const moves = [];
  const used = new Set();

  if (boss.signature && boss.signature.id && api.move[boss.signature.id]) {
    moves.push(boss.signature.id);
    used.add(boss.signature.id);
  }

  const candidates = [];
  for (const moveId in api.move) {
    if (used.has(moveId)) continue;
    const m = api.move[moveId];
    if (!m || m.power === undefined || m.power <= 0) continue;
    const moveset = Array.isArray(m.moveset) ? m.moveset : [];
    const canLearn = moveset.includes("all") || types.some(t => moveset.includes(t));
    if (!canLearn) continue;
    candidates.push({ id: moveId, power: m.power });
  }

  candidates.sort((a, b) => b.power - a.power);

  for (const cand of candidates) {
    if (moves.length >= 4) break;
    if (!used.has(cand.id)) {
      moves.push(cand.id);
      used.add(cand.id);
    }
  }

  const defaultMoves = ["hyperBeam", "earthquake", "fireBlast", "thunderbolt"];
  for (const d of defaultMoves) {
    if (moves.length >= 4) break;
    if (!used.has(d) && api.move[d]) {
      moves.push(d);
      used.add(d);
    }
  }
  while (moves.length < 4) moves.push("tackle");
  return moves;
}

function updateGmaxAreas(api) {
  for (const areaId in api.areas) {
    if (isGmaxAreaId(areaId)) delete api.areas[areaId];
  }
  for (const id of currentBosses) {
    if (!api.pkmn[id]) continue;
    const areaId = AREA_PREFIX + id;
    if (api.areas[areaId]) continue;
    api.areas[areaId] = {
      id: areaId,
      name: `超极巨·${api.formatName(id)}`,
      type: "event",
      trainer: true,
      encounter: true,
      level: config.bossLevel,
      difficulty: 800,

      icon: api.pkmn[id],
      background: "space",
      unlockRequirement: () => true,
      unlockDescription: "",
      encounterEffect: () => {},
      team: {
        slot1: api.pkmn[id],
        slot1Moves: generateValidMoves(api, id)
      },
      fieldEffect: [],
      timed: false,
      ticketIndex: 0,
      defeated: false,
      itemReward: { 1: { item: FRAGMENT_ID, amount: 1 } },
      reward: [],
      drops: { common: [] },
      spawns: { common: [] }
    };
  }
}

function clearGmaxAreas(api) {
  for (const areaId in api.areas) {
    if (isGmaxAreaId(areaId)) delete api.areas[areaId];
  }
}

// ---------- Boss 增益 ----------

// 在 initialiseArea 清零 wildBuffs 之后写入，确保真正生效（详见 onCombatStart 注释）
function applyBossBuffs(api) {
  if (battleBuffed) return;
  if (!api.saved || !isGmaxAreaId(api.saved.currentArea)) return;
  if (typeof wildBuffs === "undefined") return;

  const value = config.bossBuffValue;
  wildBuffs.atkup1 = value;
  wildBuffs.defup1 = value;
  wildBuffs.satkup1 = value;
  wildBuffs.sdefup1 = value;
  wildBuffs.speup1 = value;
  if (typeof updateWildBuffs === "function") updateWildBuffs();
  battleBuffed = true;
}

// ---------- 战斗流程 ----------

function startGmaxChallenge(api, bossId) {
  const areaId = AREA_PREFIX + bossId;
  if (!api.areas[areaId]) return;

  api.saved.currentAreaBuffer = areaId;

  const previewExit = document.getElementById("preview-team-exit");
  const teamMenu = document.getElementById("team-menu");
  const menuButton = document.getElementById("menu-button-parent");
  const exploreMenu = document.getElementById("explore-menu");

  if (previewExit && teamMenu && menuButton && exploreMenu) {
    previewExit.style.display = "flex";
    teamMenu.style.zIndex = "50";
    teamMenu.style.display = "flex";
    menuButton.style.display = "none";
    exploreMenu.style.display = "none";
  }
  const menuBtn = document.getElementById("menu-button");
  if (menuBtn && menuBtn.classList.contains("menu-button-open")) {
    menuBtn.classList.remove("menu-button-open");
  }

  closeGmaxPage();          // 关页面并停掉倒计时
  resetAfkTimer();
  if (typeof updatePreviewTeam === "function") updatePreviewTeam();
}

// 仅用于「mod 被禁用时玩家仍停在超极巨化战斗里」的收尾，
// 避免卸载后残留一个已不存在的区域。正常战斗结束由引擎自己的 leaveCombat() 处理
// （详见文件顶部「刻意不接管战斗结束」的说明）。
function leaveGmaxCombat() {
  const leaveBtn = document.getElementById("explore-leave");
  if (leaveBtn) leaveBtn.click();
  else if (typeof leaveCombat === "function") leaveCombat();
}

// 修复：原实现在这里写了 `if (typeof afkSeconds === 'undefined') var afkSeconds = 0;`，
// 这个 var 声明遮蔽了游戏全局的 `let afkSeconds`（explore.js:7485），
// 后续 `afkSeconds = 0` 只写到了 mod 自己的局部变量上，AFK 计时从未被重置。
// 这里不再声明同名变量，直接写全局绑定。
function resetAfkTimer() {
  try {
    if (typeof afkSeconds !== "undefined") afkSeconds = 0;
  } catch (e) {
    // 游戏未提供该绑定时静默跳过
  }
}

// ---------- 页面 ----------

function createGmaxPage(api) {
  if (document.getElementById(PAGE_ID)) return;

  const page = document.createElement("div");
  page.id = PAGE_ID;
  page.className = "gmax-page";

  page.innerHTML = `
    <div class="gmax-header">
      <div class="gmax-menu-button">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="24" height="24">
          <path d="M3 12a9 9 0 1 0 18 0 9 9 0 1 0 -18 0"></path>
          <path d="M9 12a3 3 0 1 0 6 0 3 3 0 1 0 -6 0"></path>
          <path d="M3 12h6"></path>
          <path d="M15 12h6"></path>
        </svg>
        <span>菜单</span>
      </div>
      <span class="gmax-page-title">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path fill="currentColor" d="M21.22 6.894a3.7 3.7 0 0 0-1.4-1.37l-6-3.31a3.83 3.83 0 0 0-3.63 0l-6 3.31a3.7 3.7 0 0 0-1.4 1.37a3.74 3.74 0 0 0-.52 1.9v6.41a3.79 3.79 0 0 0 1.92 3.27l6 3.3a3.74 3.74 0 0 0 3.63 0l6-3.31a3.72 3.72 0 0 0 1.91-3.26v-6.36a3.64 3.64 0 0 0-.51-1.95m-1 8.31a2.2 2.2 0 0 1-1.14 1.95l-6 3.31q-.158.089-.33.14v-8.18l7.3-4.39c.092.242.136.5.13.76z"/></svg>
        超极巨化空间
      </span>
    </div>
    <div class="gmax-content">
      <div class="gmax-stats">
        <div class="gmax-frag">
          <img class="gmax-frag-icon" src="img/items/wormholeResidue.png">
          <span id="gmax-fragment-count">0</span>
        </div>
        <div class="gmax-gacha-wrap">
          <button type="button" id="gmax-gacha-btn" class="gmax-gacha-btn">抽奖 (${config.gachaCost}碎片)</button>
          <div class="gmax-gacha-help" data-help="gacha概率说明">50%未拥有 / 已拥有时10%闪光</div>
        </div>
        <div id="gmax-timer" class="gmax-timer">BOSS刷新倒计时: 12:00:00</div>
      </div>
      <div class="gmax-card-container" id="gmax-card-container"></div>
    </div>
  `;

  document.getElementById("main-content").appendChild(page);

  page.querySelector(".gmax-menu-button").addEventListener("click", () => {
    closeGmaxPage();
    if (typeof openMenu === "function") openMenu();
  });
  page.querySelector("#gmax-gacha-btn").addEventListener("click", () => performGacha(api));
}

function updateGmaxPageDisplay(api) {
  const container = document.getElementById("gmax-card-container");
  if (!container) return;
  container.innerHTML = "";

  for (const id of currentBosses) {
    if (!api.pkmn[id]) continue;

    const card = document.createElement("div");
    card.className = "dimension-pokemon gmax-card";
    card.dataset.pkmn = id;
    card.dataset.boss = id;
    card.innerHTML = `
      <img class="dimension-bhole" src="img/icons/bhole.png">
      <img class="dimension-bhole gmax-bhole-reverse" src="img/icons/bhole.png">
      <img class="dimension-sprite sprite-trim gmax-card-sprite" src="img/pkmn/sprite/${id}.png">
      <div class="gmax-card-stars">★★★★★★★★★★</div>
    `;
    card.addEventListener("click", e => {
      e.stopPropagation();
      startGmaxChallenge(api, id);
    });
    container.appendChild(card);
  }

  updateFragmentDisplay(api);
}

function updateFragmentDisplay(api) {
  const fragSpan = document.getElementById("gmax-fragment-count");
  if (fragSpan) fragSpan.textContent = getFragmentCount(api);
}

function startCountdown(api) {
  stopCountdown();
  const timerEl = document.getElementById("gmax-timer");
  if (!timerEl) return;

  countdownTimer = setInterval(() => {
    const diff = lastRotationTime + config.rotationHours * 60 * 60 * 1000 - Date.now();

    if (diff <= 0) {
      rotateBosses(api);
      updateGmaxAreas(api);
      updateGmaxPageDisplay(api);
    } else {
      const hours = Math.floor(diff / 3600000);
      const minutes = Math.floor((diff % 3600000) / 60000);
      const seconds = Math.floor((diff % 60000) / 1000);
      timerEl.textContent = `刷新倒计时: ${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
    }
    updateFragmentDisplay(api);
  }, 1000);
}

function stopCountdown() {
  if (countdownTimer) {
    clearInterval(countdownTimer);
    countdownTimer = null;
  }
}

function closeGmaxPage() {
  stopCountdown();
  const page = document.getElementById(PAGE_ID);
  if (page) page.style.display = "none";
}

function openGmaxPage(api) {
  let page = document.getElementById(PAGE_ID);
  if (!page) {
    createGmaxPage(api);
    page = document.getElementById(PAGE_ID);
    if (!page) return;
  }

  const menus = ["explore-menu", "vs-menu", "item-menu", "team-menu", "pokedex-menu", "settings-menu", "guide-menu", "genetics-menu", "shop-menu", "training-menu", "dimension-menu"];
  for (const id of menus) {
    const el = document.getElementById(id);
    if (el) el.style.display = "none";
  }
  page.style.display = "flex";

  if (isRotationDue()) {
    rotateBosses(api);
    updateGmaxAreas(api);
  }
  updateGmaxPageDisplay(api);
  startCountdown(api);
}

function removePage() {
  stopCountdown();
  document.getElementById(PAGE_ID)?.remove();
}

// ---------- 主菜单入口 ----------

function getDexCount(api) {
  let count = 0;
  for (const id in api.pkmn) {
    const p = api.pkmn[id];
    if (p && p.caught > 0) count++;
  }
  return count;
}

// 菜单项挂载。
// #menu-items 是 index.html 里的静态节点，而 onRefresh 在 window.load 之后才触发
// （mods.js:1537-1542），理论上必然就绪；这里仍保留有界重试，
// 因为 onRefresh 只在「切换开关 / 导入 / 页面加载」时触发，不会周期性重放，
// 一旦错过就没有第二次机会。
function addMenuItem(api, attempt = 0) {
  const menuItems = document.getElementById("menu-items");
  if (!menuItems) {
    if (attempt < 10) setTimeout(() => addMenuItem(api, attempt + 1), 300);
    return;
  }
  if (document.getElementById(MENU_ITEM_ID)) return;

  const menuItem = document.createElement("div");
  menuItem.id = MENU_ITEM_ID;
  menuItem.className = "menu-item";
  menuItem.innerHTML = `
    <img src="img/items/wormholeResidue.png" style="image-rendering:pixelated;">
    <span>超极巨化空间</span>
  `;
  menuItem.addEventListener("click", () => {
    if (menuItem.classList.contains("menu-item-locked")) {
      showFormalMessage("未解锁", `需要图鉴数达到${config.dexRequirement}（当前 ${getDexCount(api)}）`);
      return;
    }
    openGmaxPage(api);
  });

  menuItems.appendChild(menuItem);
  updateMenuItemLock(api);
}

function updateMenuItemLock(api) {
  const menuItem = document.getElementById(MENU_ITEM_ID);
  if (!menuItem) return;
  const unlocked = getDexCount(api) >= config.dexRequirement;
  menuItem.classList.toggle("menu-item-locked", !unlocked);
}

function startLockWatcher(api) {
  if (lockTimer) return;
  lockTimer = setInterval(() => updateMenuItemLock(api), 5000);
}

function stopLockWatcher() {
  if (lockTimer) {
    clearInterval(lockTimer);
    lockTimer = null;
  }
}

function removeMenuItem() {
  document.getElementById(MENU_ITEM_ID)?.remove();
}

// ---------- 抽奖 ----------

function performGacha(api) {
  const fragments = getFragmentCount(api);
  if (fragments < config.gachaCost) {
    showFormalMessage("碎片不足", `需要 ${config.gachaCost} 个碎片。`);
    return;
  }

  const allPokemon = [];
  for (const id in api.pkmn) {
    if (!api.pkmn[id].hidden) allPokemon.push(id);
  }

  const unowned = allPokemon.filter(id => api.pkmn[id].caught === 0);
  const owned = allPokemon.filter(id => api.pkmn[id].caught > 0);

  // 修复：原实现先扣费再校验，奖池为空时 30 个碎片被扣掉且不退还。
  // 这里改为先确认奖池非空，再走 API 扣费。
  if (unowned.length === 0 && owned.length === 0) {
    showFormalMessage("抽奖失败", "还没有任何宝可梦，无法抽奖！");
    return;
  }

  api.setItemAmount(FRAGMENT_ID, fragments - config.gachaCost);

  let resultId = null;
  let isShiny = false;

  if (unowned.length > 0 && Math.random() < config.unownedChance) {
    resultId = unowned[Math.floor(Math.random() * unowned.length)];
    api.givePkmn(resultId, 1);
  } else {
    resultId = owned[Math.floor(Math.random() * owned.length)];
    if (Math.random() < config.shinyChance) {
      api.pkmn[resultId].shiny = true;
      isShiny = true;
      api.save();   // 原实现未保存闪光标记，刷新后丢失
    }
  }

  let message = `恭喜获得：${api.formatName(resultId)}`;
  if (isShiny) message += " ✦ 闪光！ ✦";
  showFormalMessage("抽奖结果", message, resultId);

  updateFragmentDisplay(api);
}
