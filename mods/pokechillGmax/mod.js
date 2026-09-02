const MOD_ID = "pokechillGmax";

// 沿用 pokechillDummy / abilityTrainer 的约定：样式抽成独立 <style id> + id 守卫
const STYLE_ID = MOD_ID + "-style";
const PAGE_ID = "gmax-dimension-menu";
const MENU_ITEM_ID = "gmax-menu-item";
const FRAGMENT_ID = "gmaxFragment";
const AREA_PREFIX = "gmaxChallenge_";

// ---- 调参常量（纯代码，刻意不写进存档 / mod state）----
// 本 mod 的启用/禁用完全交由 mod 管理器（UltraMods isEnabled / onToggle）统一管理，
// 不提供 enableGmaxDimension 之类的开关，也不在 saved.mods.state 里保存任何配置。
// Boss 轮换与碎片数量同样不落存档：Boss 由当前 UTC 半天边界确定性推导，刷新即一致。
const GACHA_COST = 30;         // 单次抽奖消耗的碎片数
const BOSS_LEVEL = 150;        // 超极巨化 Boss 等级
const BOSS_COUNT = 5;          // 每轮显示的 Boss 数
const DEX_REQUIREMENT = 100;   // 解锁超极巨化空间所需的最小图鉴数
const UNOWNED_CHANCE = 0.5;    // 存在未拥有宝可梦时，抽中未拥有的概率
const SHINY_CHANCE = 0.1;      // 抽中已拥有宝可梦时，出闪光的概率
const BOSS_BUFF_VALUE = 99;    // Boss 的五项增益数值
// 与 Wild Area（旷野地带）的刷新完全同步：Wild Area 每 12 小时在 UTC 整点边界
// （00:00 / 12:00）切换一次（explore.js getSeed / rotationWildCurrent 依据 halfDayNumber）。
// 这里沿用同一把时钟，让 Boss 在边界整点刷新、倒计时也指向同一个边界。
const HALF_DAY_MS = 12 * 60 * 60 * 1000;

// 右上角 header-help 的 data-help 键（右键弹原版 tooltip 看界面说明）。
// tooltipData 的 help 分支不认识该键，故在 installBackPatches 里 patch 一个兜底分支。
const HELP_KEY = "GmaxDimension";

let activeApi = null;

// ---- 运行时状态（仅存内存，刷新即按当前时间重新推导，不写存档）----
let countdownTimer = null;      // 页面开着时的秒表
let lockTimer = null;           // 锁定图鉴解锁态的低频检查
let battleBuffed = false;       // 本次战斗是否已注入过 Boss 增益
let gmaxPageVisible = false;    // 超极巨化空间页面当前是否展开
let lastRenderHalfDay = -1;     // 已渲染 Boss 列表所用的半天编号（跨边界时重绘）

// ---- 被 patch 过的全局函数（用于 Req4：统一把「返回」导向超极巨化空间）----
let patchedGlobals = {};
let menuCloseBound = false;     // 页面级点击观察是否已绑定（用于收起 gmax 页）

UltraMods.define({
  id: MOD_ID,
  name: "Pokechill 超极巨化空间",
  description: "将「超极巨化空间」独立为 mod：Boss 轮换与旷野地带(Wild Area)在同一个 UTC 半天边界刷新，击败 Boss 收集碎片进行抽奖获取超极巨化宝可梦。启用与否交由模组管理器，所有提示走原版 tooltip，左上角菜单沿用原版样式。",
  image: "img/items/rareCandy.png",
  version: "2.2.2",
  author: "人民当家做主",
  category: "实用工具",
  defaultEnabled: false,
  hooks: {
    onToggle(api, payload) {
      if (payload.enabled) install(api);
      else uninstall(api);
    },
    onRefresh(api) {
      if (!api.isEnabled(MOD_ID)) return;
      install(api);
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
    onCombatStart(api, payload) {
      if (!isGmaxAreaId(payload?.areaId)) {
        battleBuffed = false;
        return;
      }
      battleBuffed = false;
      setTimeout(() => applyBossBuffs(api), 0);
    }
  }
});

// 【刻意不接管「战斗结束即离场」】
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
// 我们只 patch 了 exitPkmnTeam / exitCombat 的「返回目标」，让玩家离开队伍准备
// 或打完结算后回到超极巨化空间页面，而不是 explore-menu（详见 Req4）。

// ---------- 安装 / 卸载 ----------

function install(api) {
  // 防御式守卫：游戏核心对象尚未就绪时直接跳过。
  // 正常时序下不会触发 —— UltraMods 的 onRefresh 在 window.load 之后才跑
  // （mods.js:1537-1542），那时 explore.js / pkmnDictionary.js 等已全部同步加载完毕。
  if (!api.item || !api.pkmn || !api.areas || !api.move) return;

  activeApi = api;

  ensureFragmentItem(api);
  hydrateFragmentFromSave(api);   // 把存档里已攒的碎片读回内存（碎片是玩家货币，随存档保留）

  installStyles();
  installBackPatches();           // Req4：统一「返回」导向超极巨化空间
  installMenuCloseObserver();     // Req3：点其它主菜单项时收起超极巨化空间页
  updateGmaxAreas(api);           // 按当前 UTC 半天边界同步刷新 Boss 挑战区
  addMenuItem(api);
  startLockWatcher(api);

  api.refreshGame();
}

function uninstall(api) {
  stopCountdown();
  stopLockWatcher();
  // 先还原 patch，确保下面用「原版」函数离场，不会因 patch 重新弹回超极巨化页。
  uninstallBackPatches();

  // 若玩家正停在超极巨化战斗/队伍准备里，先复位，避免残留一个已删除的区域
  if (api.saved && isGmaxAreaId(api.saved.currentArea)) {
    if (typeof leaveCombat === "function") leaveCombat();
  } else if (api.saved && isGmaxAreaId(api.saved.currentAreaBuffer)) {
    if (typeof exitPkmnTeam === "function") exitPkmnTeam();
  }

  clearGmaxAreas(api);
  removePage();
  removeMenuItem();
  uninstallMenuCloseObserver();
  removeStyles();

  // 注意：这里刻意不删除 item[FRAGMENT_ID]。
  // saveGame() 是整体覆盖写（localStorage.setItem("gameData", JSON.stringify(data))），
  // 一旦道具从 item 里消失，data.gmaxFragment 就不再被写入，玩家已攒的碎片会被永久抹掉。
  // 保留该道具（禁用时它是惰性的）是唯一安全的做法。
  battleBuffed = false;
  gmaxPageVisible = false;
  activeApi = null;
  api.refreshGame();
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
      info: function () { return "击败超极巨化宝可梦获得的稀有碎片。可在此空间用于抽奖，获取超极巨化宝可梦。"; }
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

// ---------- UTC 半天时钟（与 Wild Area 同步）----------

function getHalfDayNumber(now = Date.now()) {
  return Math.floor(now / HALF_DAY_MS);
}

// 下一个 UTC 半天边界的绝对毫秒时间（与 Wild Area 的 .time-counter-daily 指向同一边界）
function getNextHalfDayBoundary(now = Date.now()) {
  return (Math.floor(now / HALF_DAY_MS) + 1) * HALF_DAY_MS;
}

// 用半天编号做种子的确定性随机。同一半天内刷新页面 / 反复打开，Boss 组合始终一致；
// 半天边界一到，种子自动变化 → Boss 自动换一批，无需任何持久化。
function seededRandom(seed) {
  let s = seed >>> 0;
  return function () {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------- 样式（沿用 pokechillDummy 的独立 style + id 守卫）----------

function installStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    /* 页面外壳完全复刻游戏 dimension-menu（styles.css #dimension-menu）：
       position:fixed、桌面 50% 宽、暗色 portal 背景，z-index 40 —— 低于左上角
       #menu-button-parent(z-index:100)，因此原版左上角菜单球始终浮在页面上方，
       玩家可用原版菜单球回到主菜单（即“去掉自制的球状返回按钮”）。

       【定位修复】刻意不写 top/left/right/bottom 任何偏移，与 #main-content、
       #dimension-menu 等原版子页面一致：body 是 position:fixed + display:flex +
       justify-content:center，游戏窗口是居中的 #main-content(width:50%)。
       不设偏移的 fixed 子元素会停在自身静态位置，正好贴合居中的游戏窗口；
       一旦写了 left:0 就会贴到浏览器视口左缘（即此前“跑到浏览器窗口左侧”的根因）。 */
    #${PAGE_ID} {
      position: fixed;
      height: 100%;
      width: 50%;
      z-index: 40;
      display: none;
      flex-direction: column;
      align-items: center;
      overflow-y: hidden;
      overflow-x: hidden;
      padding: 0;
      background-image: url('img/bg/dimension-1.jpg');
      background-size: 400px;
    }
    #${PAGE_ID}.open { display: flex; }

    /* 动画背景层（dimension-menu 的 #dimension-bg 同款，dimension-fade 呼吸淡入淡出） */
    .gmax-dim-bg {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      background-image: url('img/bg/dimension-2.jpg');
      background-size: 400px;
      animation: dimension-fade 3s infinite ease-in-out;
      z-index: 0;
      pointer-events: none;
    }

    /* 页头：完全对齐原版 #explore-menu-header（背景横幅 + 左碎片/抽奖 + 右标题/帮助/倒计时） */
    .gmax-menu-header {
      position: relative;
      z-index: 3;
      height: 8rem;
      width: 100%;
      background-image: url('img/bg/space.png');
      background-size: cover;
      background-position: 20%;
      image-rendering: pixelated;
      display: flex;
      gap: 0.5rem;
      padding: 0.4rem 2%;
      flex-shrink: 0;
      border-radius: 0 0 0.5rem 0.5rem;
      box-shadow: rgba(0, 0, 0, 0.3) 0 4px 4px 0;
      flex-direction: column;
      justify-content: start;
      align-items: end;
      text-align: end;
      margin-bottom: 1rem;

    }

    .gmax-menu-header span {
      height: 2rem;
      width: auto;
      display: flex;
      justify-content: center;
      align-items: center;
      text-align: center;
      background: var(--dark1);
      color: white;
      border: rgba(255, 255, 255, 0.7) 1px solid;
      border-radius: 0.5rem;
      font-size: 1.5rem;
      background: rgba(0, 0, 0, 0.5);
      padding: 1.3rem 1rem;
      font-weight: 100;
      flex-shrink: 0;
      z-index: 2;
    }

    .gmax-menu-header span svg{
        height: 2rem;
        width: 2rem;
        margin-right: 0.5rem;
    }

    .gmax-menu-header span strong{
        margin-left: 0.2rem;
        font-weight: bolder;
    }

    .gmax-gacha {
      height: 4rem;
      width: 95%;
      display: flex;                 /* 开启弹性布局 */
      justify-content: space-between; /* 左右两端对齐 */
      align-items: center;           /* 垂直方向居中，防止高度不一致 */
      // background-color: var(--dark2);
      border: 2px solid var(--light2);
      position: relative;
      flex-shrink: 0;
      border-radius: 0.5rem;
      padding: 0.3rem 1rem;
      z-index: 4;
    }

    /* 碎片数量：对照 #explore-menu-header span（rgba(0,0,0,.5) 底、白边、白字） */
    .gmax-fragment {
      position: relative;
      height: 2rem;
      display: flex;
      justify-content: center;
      align-items: center;
      text-align: center;
      color: var(--light2);
      font-size: 1.4rem;
      background: rgba(0, 0, 0, 0.5);
      flex-shrink: 0;
    }

    #gmax-fragment-count {
      margin-left: 0.5rem;
      font-weight: 500;
    }

    /* 抽奖按钮：对照原版 .explore-menu-selector div（dark2 底、圆角、居中） */
    .gmax-gacha-btn {
      height: 2.8rem;
      display: flex;
      justify-content: center;
      align-items: center;
      background-color: var(--dark2);
      color: var(--light2);
      border: none;
      border-radius: 0.3rem;
      padding: 0.3rem 1.5rem;
      font-family: inherit;
      font-weight: 600;
      font-size: 1.2rem;
      cursor: pointer;
      white-space: pre-wrap;;
      flex-shrink: 0;
      box-shadow: rgba(0, 0, 0, 0.2) 0 2px 2px 0;
    }
    .gmax-gacha-btn:hover { background-color: #685F4B; }

    /* 标题胶囊：对照 #explore-menu-header span */
    .gmax-title {
      height: 2rem;
      display: flex;
      justify-content: center;
      align-items: center;
      text-align: center;
      background: var(--dark1);
      color: white;
      border: rgba(255, 255, 255, 0.7) 1px solid;
      border-radius: 0.5rem;
      font-size: 1.5rem;
      background: rgba(0, 0, 0, 0.5);
      padding: 1.3rem 1rem;
      font-weight: 100;
      flex-shrink: 0;
      z-index: 2;
    }
    .gmax-title img {
      height: 1.6rem;
      margin-right: 0.5rem;
    }
    /* 帮助胶囊：沿用原版 .header-help（cursor:help、不另加底色），垂直居中对齐标题 */
    .gmax-title-row .header-help {
      height: 2rem;
      display: inline-flex;
      align-items: center;
    }

    /* 外层：负责滚动，裁剪溢出（必须） */
    .gmax-dim-content {
      overflow-y: scroll;      /* 保留滚动条 */
      overflow-x: hidden;      /* 水平方向隐藏 */
      position: relative;
      z-index: 2;
      width: 100%;
      display: flex;
      flex-direction: column;
      justify-content: start;  /* 垂直居中 */
      align-items: center;
      padding: 0;
    }

    /* 网格布局，正常显示 */
    .gmax-card-grid {
      display: flex;
      flex-wrap: wrap;
      justify-content: center;
      gap: clamp(0.6rem, 2.5vw, 1.4rem);
      margin: 5rem 0;
      /* 不需要 padding-top，已由外层提供 */
    }

    /* 卡片样式 */
    .gmax-card {
      margin: 0 auto;
      /* 如果卡片本身需要溢出，在这里处理 */
    }

    .gmax-bhole-reverse {
      animation-direction: reverse;
      scale: 1.3;
    }
      
    /* 星级胶囊：仿原版 #dimension-indicator（黑底 0.6 透明、圆角 100px、金字星），定位到图片正下方 */
    .gmax-card-stars {
      position: absolute;
      bottom: -0.8rem;
      z-index: 900;
      padding: 0.2rem 0.5rem;
      background: rgba(0, 0, 0, 0.6);
      border-radius: 100px;
      color: #ffd700;
      font-size: clamp(0.8rem, 2.5vw, 1.1rem);
      line-height: 1;
      white-space: nowrap;
    }

    @media (max-width: 1000px) {
      #${PAGE_ID} { width: 100% !important; }
    }
    @media (max-width: 640px) {
      .gmax-card { height: clamp(7.5rem, 22vw, 9rem) !important; width: clamp(7.5rem, 22vw, 9rem) !important; }
      .gmax-card .dimension-sprite { scale: 1.4; }
    }
  `;
  document.head.appendChild(style);
}

function removeStyles() {
  document.getElementById(STYLE_ID)?.remove();
}

// ---------- 原版 tooltip 提示（Req2）----------
//
// 完全复用原版的 tooltip 弹层：直接写 tooltipTop / tooltipTitle / tooltipMid / tooltipBottom
// 并调用 openTooltip()，不新建任何自定义弹窗。调用方式与 mythos 的 showMessage 一致。
function gmaxTooltip(title, contentHTML, spriteId) {
  try {
    const top = document.getElementById("tooltipTop");
    const titleEl = document.getElementById("tooltipTitle");
    const midEl = document.getElementById("tooltipMid");
    const bottomEl = document.getElementById("tooltipBottom");
    if (top) top.style.display = "none";
    if (titleEl) {
      titleEl.style.display = "block";
      titleEl.innerHTML = title;
    }
    if (midEl) {
      midEl.style.display = "block";
      if (spriteId) {
        midEl.innerHTML =
          `<div style="text-align:center;padding-bottom:0.5rem;">
             <img src="img/pkmn/sprite/${spriteId}.png" style="height:5rem;image-rendering:pixelated;filter:drop-shadow(0 0 6px rgba(255,215,0,0.8));">
           </div>` + (contentHTML || "");
      } else {
        midEl.innerHTML = contentHTML || "";
      }
    }
    if (bottomEl) bottomEl.style.display = "none";
    if (typeof openTooltip === "function") openTooltip();
  } catch (e) {
    // tooltip DOM 未就绪时静默失败，不阻断主流程
  }
}

// ---------- Boss 轮换（与 Wild Area 同步，确定性、不持久化）----------

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

// 当前半天应显示的 Boss 组合：以 halfDayNumber 为种子做确定性洗牌再截取。
// 同一半天内打开页面 / 刷新均得到同一批；半天边界一过自动换批，无需任何存档。
function computeCurrentBosses(api, halfDay) {
  const allGmax = getAllGmaxPokemon(api);
  if (allGmax.length === 0) return [];
  const rng = seededRandom(halfDay * 2654435761);
  const pool = [...allGmax];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, Math.min(BOSS_COUNT, pool.length));
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

// 把当前半天对应的 Boss 实体化为一组可挑战的 event 区域。
// 直接复用游戏对 event / trainer 区域的发放逻辑（trainer won 分支会读 itemReward 发碎片）。
function updateGmaxAreas(api) {
  clearGmaxAreas(api);
  const halfDay = getHalfDayNumber();
  const bosses = computeCurrentBosses(api, halfDay);
  for (const id of bosses) {
    if (!api.pkmn[id]) continue;
    const areaId = AREA_PREFIX + id;
    if (api.areas[areaId]) continue;
    api.areas[areaId] = {
      id: areaId,
      name: `超极巨·${api.formatName(id)}`,
      type: "event",
      trainer: true,
      encounter: true,
      level: BOSS_LEVEL,
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
  // 卡片区只按当天的 Boss 显示；这些 region 常驻，确保战斗中/结束后区仍存在可查。
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

  wildBuffs.atkup1 = BOSS_BUFF_VALUE;
  wildBuffs.defup1 = BOSS_BUFF_VALUE;
  wildBuffs.satkup1 = BOSS_BUFF_VALUE;
  wildBuffs.sdefup1 = BOSS_BUFF_VALUE;
  wildBuffs.speup1 = BOSS_BUFF_VALUE;
  if (typeof updateWildBuffs === "function") updateWildBuffs();
  battleBuffed = true;
}

// ---------- 进入挑战（队伍准备）----------

function startGmaxChallenge(api, bossId) {
  const areaId = AREA_PREFIX + bossId;
  if (!api.areas[areaId]) return;

  // 若玩家正停留在某个普通战斗里，先不覆盖，交给引擎流程
  if (api.saved && api.saved.currentArea !== undefined) return;

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

  hideGmaxPage();   // 收起超极巨化空间页，进入队伍准备
  resetAfkTimer();
  if (typeof updatePreviewTeam === "function") updatePreviewTeam();
}

// 复位全局挂机计时：原实现用 var afkSeconds 遮蔽了游戏全局，赋值落不到全局；
// 这里直接写全局绑定。
function resetAfkTimer() {
  try {
    if (typeof afkSeconds !== "undefined") afkSeconds = 0;
  } catch (e) {
    // 游戏未提供该绑定时静默跳过
  }
}

// ---------- Req4：返回流程 patch ----------
//
// 引擎的原版行为：
//   - #pkmn-team-return（队伍准备左上角「返回」）→ exitPkmnTeam()：永远回到 explore-menu。
//   - 战斗结束 → exitCombat()：仅当 lastArea 是 dimension 才回 dimension-menu，否则不显示任何区域页。
//   - leaveCombat()：按 type 分发到 explore-menu / vs-menu / training-menu。
//
// 由于超极巨化挑战从独立的 portal 页发起，而非 explore-menu，
// 若直接沿用原版，玩家点返回/战斗结束都会被带到 explore-menu（旅行页），
// 这与「超极巨化空间」入口割裂。这里参照 mythos 对 combat 函数的 patch 方式，
// 统一在这些「离场即返回」的函数里，把目标改为超极巨化空间页。
// patch 均为「包一层 + 记录原函数 + 卸载还原」，不动其它 mod / 原版行为。

function patchGlobal(name, wrapper) {
  if (patchedGlobals[name]) return;                 // 已 patch 过则跳过（幂等）
  const original = window[name];
  if (typeof original !== "function") return;
  const wrapped = wrapper(original);
  patchedGlobals[name] = { original, wrapped };
  window[name] = wrapped;
}

function isGmaxEntry(api) {
  const s = api?.saved || (typeof saved !== "undefined" ? saved : null);
  if (!s) return false;
  return isGmaxAreaId(s.currentArea) || isGmaxAreaId(s.currentAreaBuffer) || isGmaxAreaId(s.lastAreaJoined);
}

function installBackPatches() {
  if (Object.keys(patchedGlobals).length > 0) return;

  // 1) 队伍准备「返回」：若源自超极巨化空间，回到超极巨化空间页
  patchGlobal("exitPkmnTeam", original => function gmaxExitPkmnTeam(...args) {
    const ret = original.apply(this, args);   // 先走原版（它会显示 explore-menu 等）
    const api = activeApi;
    if (!api || !isGmaxEntry(api)) return ret;
    // 收掉原版顺带显示的 explore-menu，改开超极巨化空间
    showGmaxPage(api, true);
    return ret;
  });

  // 2) 战斗真正结束后玩家点「Save and exit」（area-end 上的 exitCombat()），
  //    若本次打的是超极巨化 Boss，回到超极巨化空间。
  //    注：leaveCombat() 会在战斗结算早期自动触发（显示 area-end 结算层），此刻若抢先
  //    展示超极巨化页会与结算层冲突，故只接管玩家主动离开的 exitCombat()。
  patchGlobal("exitCombat", original => function gmaxExitCombat(...args) {
    const wasGmax = isGmaxEntry(activeApi);
    const ret = original.apply(this, args);
    if (!wasGmax || !activeApi) return ret;
    // 引擎在 exitCombat 里仅对 type=="dimension" 开 dimension-menu；对 gmax 开 gmax 页
    showGmaxPage(activeApi, true);
    return ret;
  });

  // 3) 右上角 header-help 的右键说明：tooltipData("help", ...) 的 help 分支只认识原版
  //    那些键（Wild Areas/Dimension/...），不认识本 mod 的 HELP_KEY。这里包一层：
  //    命中 HELP_KEY 时直接用原版 tooltip DOM 展示界面说明，否则委托原函数。
  patchGlobal("tooltipData", original => function gmaxTooltipData(category, ttdata, ...rest) {
    if (category === "help" && ttdata === HELP_KEY) {
      try {
        const top = document.getElementById("tooltipTop");
        const titleEl = document.getElementById("tooltipTitle");
        const midEl = document.getElementById("tooltipMid");
        const bottomEl = document.getElementById("tooltipBottom");
        if (top) top.style.display = "none";
        if (midEl) midEl.style.display = "none";
        if (titleEl) {
          titleEl.style.display = "inline";
          titleEl.innerHTML = "超极巨化空间";
        }
        if (bottomEl) {
          bottomEl.style.display = "inline";
          bottomEl.innerHTML =
            "聚集全宇宙最强的超极巨化宝可梦！这里每隔 12 小时（与旷野地带同一时刻，UTC " +
            "00:00 / 12:00）刷新一批超极巨化 Boss。<br><br>" +
            `击败 Boss 可获得「次元残片」。消耗 ${GACHA_COST} 片残片即可抽奖，有概率抽到未拥有` +
            "的超极巨化宝可梦（已拥有时有概率出现闪光个体）。<br><br>" +
            `图鉴达到 ${DEX_REQUIREMENT} 只后即可挑战。Boss 自带强化增益，请组建最强队伍迎战。`;
        }
        if (typeof openTooltip === "function") openTooltip();
      } catch (e) { /* tooltip DOM 未就绪时静默 */ }
      return;
    }
    return original.call(this, category, ttdata, ...rest);
  });
}

function uninstallBackPatches() {
  for (const name of Object.keys(patchedGlobals)) {
    if (window[name] === patchedGlobals[name].wrapped) {
      window[name] = patchedGlobals[name].original;
    }
  }
  patchedGlobals = {};
}

// ---------- 页面 ----------

function createGmaxPage(api) {
  if (document.getElementById(PAGE_ID)) return;

  const page = document.createElement("div");
  page.id = PAGE_ID;

  page.innerHTML = `
    <div class="gmax-dim-bg"></div>
    <div class="gmax-menu-header">
      <div style="display:flex; gap:0.5rem">
        <span>
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path fill="currentColor" d="M21.22 6.894a3.7 3.7 0 0 0-1.4-1.37l-6-3.31a3.83 3.83 0 0 0-3.63 0l-6 3.31a3.7 3.7 0 0 0-1.4 1.37a3.74 3.74 0 0 0-.52 1.9v6.41a3.79 3.79 0 0 0 1.92 3.27l6 3.3a3.74 3.74 0 0 0 3.63 0l6-3.31a3.72 3.72 0 0 0 1.91-3.26v-6.36a3.64 3.64 0 0 0-.51-1.95m-1 8.31a2.2 2.2 0 0 1-1.14 1.95l-6 3.31q-.158.089-.33.14v-8.18l7.3-4.39c.092.242.136.5.13.76z"></path></svg>
          <strong>超极巨化空间</strong>
        </span>
        <span class="header-help" data-help="${HELP_KEY}"><svg style="opacity:0.8; pointer-events:none" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20"><g fill="currentColor"><g opacity="0.2"><path d="M12.739 17.213a2 2 0 1 1-4 0a2 2 0 0 1 4 0"/><path fill-rule="evenodd" d="M10.71 5.765c-.67 0-1.245.2-1.65.486c-.39.276-.583.597-.639.874a1.45 1.45 0 0 1-2.842-.574c.227-1.126.925-2.045 1.809-2.67c.92-.65 2.086-1.016 3.322-1.016c2.557 0 5.208 1.71 5.208 4.456c0 1.59-.945 2.876-2.169 3.626a1.45 1.45 0 1 1-1.514-2.474c.57-.349.783-.794.783-1.152c0-.574-.715-1.556-2.308-1.556" clip-rule="evenodd"/><path fill-rule="evenodd" d="M10.71 9.63c.8 0 1.45.648 1.45 1.45v1.502a1.45 1.45 0 1 1-2.9 0V11.08c0-.8.649-1.45 1.45-1.45" clip-rule="evenodd"/><path fill-rule="evenodd" d="M14.239 8.966a1.45 1.45 0 0 1-.5 1.99l-2.284 1.367a1.45 1.45 0 0 1-1.49-2.488l2.285-1.368a1.45 1.45 0 0 1 1.989.5" clip-rule="evenodd"/></g><path d="M11 16.25a1.25 1.25 0 1 1-2.5 0a1.25 1.25 0 0 1 2.5 0"/><path fill-rule="evenodd" d="M9.71 4.065c-.807 0-1.524.24-2.053.614c-.51.36-.825.826-.922 1.308a.75.75 0 1 1-1.47-.297c.186-.922.762-1.696 1.526-2.236c.796-.562 1.82-.89 2.919-.89c2.325 0 4.508 1.535 4.508 3.757c0 1.292-.768 2.376-1.834 3.029a.75.75 0 0 1-.784-1.28c.729-.446 1.118-1.093 1.118-1.749c0-1.099-1.182-2.256-3.008-2.256m0 5.265a.75.75 0 0 1 .75.75v1.502a.75.75 0 1 1-1.5 0V10.08a.75.75 0 0 1 .75-.75" clip-rule="evenodd"/><path fill-rule="evenodd" d="M12.638 8.326a.75.75 0 0 1-.258 1.029l-2.285 1.368a.75.75 0 1 1-.77-1.287l2.285-1.368a.75.75 0 0 1 1.028.258" clip-rule="evenodd"/></g></svg></span>
      </div>
      <div class="rotation-timer">
        <strong><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path fill="currentColor" d="M6.94 2c.416 0 .753.324.753.724v1.46c.668-.012 1.417-.012 2.26-.012h4.015c.842 0 1.591 0 2.259.013v-1.46c0-.4.337-.725.753-.725s.753.324.753.724V4.25c1.445.111 2.394.384 3.09 1.055c.698.67.982 1.582 1.097 2.972L22 9H2v-.724c.116-1.39.4-2.302 1.097-2.972s1.645-.944 3.09-1.055V2.724c0-.4.337-.724.753-.724"/><path fill="currentColor" d="M22 14v-2c0-.839-.004-2.335-.017-3H2.01c-.013.665-.01 2.161-.01 3v2c0 3.771 0 5.657 1.172 6.828S6.228 22 10 22h4c3.77 0 5.656 0 6.828-1.172S22 17.772 22 14" opacity="0.5"/><path fill="currentColor" d="M18 17a1 1 0 1 1-2 0a1 1 0 0 1 2 0m0-4a1 1 0 1 1-2 0a1 1 0 0 1 2 0m-5 4a1 1 0 1 1-2 0a1 1 0 0 1 2 0m0-4a1 1 0 1 1-2 0a1 1 0 0 1 2 0m-5 4a1 1 0 1 1-2 0a1 1 0 0 1 2 0m0-4a1 1 0 1 1-2 0a1 1 0 0 1 2 0"/></svg>
        超极巨化刷新</strong>
        <div id="gmax-timer" class="time-counter-daily">--:--:--</div>
      </div>
    </div>

    <div class="gmax-gacha">
        <span class="gmax-fragment">
          <img src="img/items/wormholeResidue.png" style="height:2rem; width:2rem; filter: drop-shadow(0 0 3px white) drop-shadow(0 0 3px white) drop-shadow(0 0 3px white);">
          <span id="gmax-fragment-count">超极巨碎片：0</span>
        </span>
        <button type="button" id="gmax-gacha-btn" class="gmax-gacha-btn">🔄 抽奖   ( <img src="img/items/wormholeResidue.png" style="height:2rem; width:2rem; filter: drop-shadow(0 0 3px white) drop-shadow(0 0 3px white) drop-shadow(0 0 3px white);"> x30 )</button>
    </div>


    <div class="gmax-dim-content">
      <div class="gmax-card-grid" id="gmax-card-grid"></div>
    </div>
  `;

  document.getElementById("main-content").appendChild(page);

  page.querySelector("#gmax-gacha-btn").addEventListener("click", () => performGacha(api));
}

// 渲染 Boss 卡片：复用原版 .dimension-pokemon 卡座 + .dimension-bhole + .dimension-sprite，
// 星级胶囊沿用 dimension 的视觉（红底圆角 + 白色星星），但用独立类 gmax-card-stars 避免
// 与游戏里单例的 #dimension-indicator(id) 冲突。
function renderBossCards(api) {
  const grid = document.getElementById("gmax-card-grid");
  if (!grid) return;
  grid.innerHTML = "";

  const halfDay = getHalfDayNumber();
  const bosses = computeCurrentBosses(api, halfDay);

  for (const id of bosses) {
    if (!api.pkmn[id]) continue;
    const card = document.createElement("div");
    card.className = "dimension-pokemon gmax-card";
    card.dataset.pkmn = id;
    card.dataset.boss = id;

    card.innerHTML = `
      <img class="dimension-bhole" src="img/icons/bhole.png">
      <img class="dimension-bhole gmax-bhole-reverse" src="img/icons/bhole.png">
      <img class="dimension-sprite sprite-trim" src="img/pkmn/sprite/${id}.png">
      <span class="gmax-card-stars">★★★★★★★★★★</span>
    `;
    card.addEventListener("click", e => {
      e.stopPropagation();
      if (isGmaxUnlocked(api)) startGmaxChallenge(api, id);
    });
    grid.appendChild(card);
  }
}

function isGmaxUnlocked(api) {
  return getDexCount(api) >= DEX_REQUIREMENT;
}

function getDexCount(api) {
  let count = 0;
  for (const id in api.pkmn) {
    const p = api.pkmn[id];
    if (p && p.caught > 0) count++;
  }
  return count;
}

// 打开超极巨化空间页；若跨了半天边界会先重建 Boss 挑战区与卡片再展示。
function showGmaxPage(api, fromReturn = false) {
  if (!isGmaxUnlocked(api)) {
    // 未解锁时给原版 tooltip 提示，不进入
    if (fromReturn) {
      // 正常情况不会走到；仅当图鉴掉回阈值以下（几乎不可能）才兜底回主菜单
      if (typeof openMenu === "function") openMenu();
      return;
    }
    gmaxTooltip("尚未解锁", `需要图鉴数达到 ${DEX_REQUIREMENT}（当前 ${getDexCount(api)}）`);
    return;
  }

  let page = document.getElementById(PAGE_ID);
  if (!page) {
    createGmaxPage(api);
    page = document.getElementById(PAGE_ID);
    if (!page) return;
  }

  // 关闭/收起其它主菜单子页面（沿用 mythos hideMainMenus 同款列表）
  [
    "explore-menu", "vs-menu", "item-menu", "team-menu", "pokedex-menu",
    "settings-menu", "guide-menu", "genetics-menu", "shop-menu",
    "training-menu", "dimension-menu", "dictionary-menu"
  ].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = "none";
  });

  // 若跨了半天边界，重建区域与卡片
  const halfDay = getHalfDayNumber();
  if (halfDay !== lastRenderHalfDay) {
    updateGmaxAreas(api);
    lastRenderHalfDay = halfDay;
  }

  renderBossCards(api);
  updateFragmentDisplay(api);

  // 若玩家正从主菜单球点进来的那一刻，展开的下拉是 #menu-button.menu-button-open。
  // 这里把它收起：下拉已无必要（后续可用左上角球再打开），避免与页面重叠。
  const menuBtn = document.getElementById("menu-button");
  if (menuBtn && menuBtn.classList.contains("menu-button-open")) {
    menuBtn.classList.remove("menu-button-open");
  }

  page.classList.add("open");
  gmaxPageVisible = true;
  startCountdown(api);
}

function hideGmaxPage() {
  stopCountdown();
  const page = document.getElementById(PAGE_ID);
  if (page) page.classList.remove("open");
  gmaxPageVisible = false;
}

// Req3：超极巨化空间页 z-index(40) < 左上角菜单球(z100)，故点其它主菜单项进入别的页面时，
// 本页会残留在下方并盖住它。这里在捕获阶段监听：只要点击的是「非本 mod」的 .menu-item
// （即玩家要从主菜单跳去 travel/vs/dex…），就先收起超极巨化空间页。参照 mythos installObservers。
function installMenuCloseObserver() {
  if (menuCloseBound) return;
  document.addEventListener("click", onMenuCloseClick, true);
  menuCloseBound = true;
}

function uninstallMenuCloseObserver() {
  if (!menuCloseBound) return;
  document.removeEventListener("click", onMenuCloseClick, true);
  menuCloseBound = false;
}

function onMenuCloseClick(event) {
  if (!gmaxPageVisible) return;
  const item = event.target?.closest?.("#menu-items .menu-item");
  if (!item) return;
  if (item.id === MENU_ITEM_ID) return;   // 再点自己＝刷新/重开，无需收起
  // 点了其它主菜单项：收起本页，交给引擎的 switchMenu 去展示目标页面
  hideGmaxPage();
}

function updateFragmentDisplay(api) {
  const fragSpan = document.getElementById("gmax-fragment-count");
  if (fragSpan) fragSpan.textContent = '超极巨碎片：' + getFragmentCount(api);
}


// 倒计时：指向下一个 UTC 半天边界（与 Wild Area 的 .time-counter-daily 同一时钟）。
// 边界一到（页面仍开着）自动重建挑战区并重绘卡片 —— 行为与原版 Wild Area 一致。
//
// 【实时刷新修复】不能靠“diff<=0”触发：getNextHalfDayBoundary() 永远返回严格位于
// “当前时刻之后”的下一个边界，所以 diff 在跨过边界的瞬间会从小正数直接跳到 ~12h，
// 永远不会 <=0（原实现的自动刷新因此形同虚设，只有退出重进才重建）。
// 正解：每拍比较“当前半天编号”与“已渲染的半天编号 lastRenderHalfDay”，一旦编号前进
// 就说明刚跨过边界 → 立即重建挑战区与卡片，页面开着也会自己刷新。
function startCountdown(api) {
  stopCountdown();
  const timerEl = document.getElementById("gmax-timer");
  if (!timerEl) return;

  const tick = () => {
    const now = Date.now();
    const halfDay = getHalfDayNumber(now);

    // 半天编号前进 ⇒ 刚跨过 UTC 半天边界：就地刷新 Boss（无需退出重进）
    if (halfDay !== lastRenderHalfDay) {
      updateGmaxAreas(api);
      lastRenderHalfDay = halfDay;
      renderBossCards(api);
    }

    // 显示到下一个半天边界的时间（getNextHalfDayBoundary 已自动滚到下一边界）
    const diff = Math.max(0, getNextHalfDayBoundary(now) - now);
    const hours = Math.floor(diff / 3600000);
    const minutes = Math.floor((diff % 3600000) / 60000);
    const seconds = Math.floor((diff % 60000) / 1000);
    timerEl.textContent =
      `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;

    updateFragmentDisplay(api);
  };

  tick();   // 打开即先渲染一次
  countdownTimer = setInterval(tick, 1000);
}

function stopCountdown() {
  if (countdownTimer) {
    clearInterval(countdownTimer);
    countdownTimer = null;
  }
}

function removePage() {
  stopCountdown();
  document.getElementById(PAGE_ID)?.remove();
  gmaxPageVisible = false;
}

// ---------- 主菜单入口（Req3：左上角菜单沿用原版 .menu-item 结构）----------

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
    if (!isGmaxUnlocked(api)) {
      gmaxTooltip("尚未解锁", `需要图鉴数达到 ${DEX_REQUIREMENT}（当前 ${getDexCount(api)}）`);
      return;
    }
    showGmaxPage(api);
  });

  // 插在「维度/传送门」菜单项之后，视觉上与原版 portal 条目并列
  const dimension = document.getElementById("menu-dimension");
  if (dimension?.parentElement === menuItems) {
    dimension.insertAdjacentElement("afterend", menuItem);
  } else {
    menuItems.appendChild(menuItem);
  }

  updateMenuItemLock(api);
}

function updateMenuItemLock(api) {
  const menuItem = document.getElementById(MENU_ITEM_ID);
  if (!menuItem) return;
  const unlocked = isGmaxUnlocked(api);
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
  if (fragments < GACHA_COST) {
    gmaxTooltip("碎片不足", `需要 ${GACHA_COST} 个碎片。`);
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
    gmaxTooltip("无法抽奖", "还没有任何宝可梦，无法抽奖！");
    return;
  }

  api.setItemAmount(FRAGMENT_ID, fragments - GACHA_COST);

  let resultId = null;
  let isShiny = false;

  if (unowned.length > 0 && Math.random() < UNOWNED_CHANCE) {
    resultId = unowned[Math.floor(Math.random() * unowned.length)];
    api.givePkmn(resultId, 1);
  } else {
    resultId = owned[Math.floor(Math.random() * owned.length)];
    if (Math.random() < SHINY_CHANCE) {
      api.pkmn[resultId].shiny = true;
      isShiny = true;
      api.save();   // 原实现未保存闪光标记，刷新后丢失
    }
  }

  const text = `恭喜获得：<strong>${api.formatName(resultId)}</strong>${isShiny ? " ✦ 闪光！ ✦" : ""}`;
  gmaxTooltip("抽奖结果", text, resultId);

  updateFragmentDisplay(api);
}
