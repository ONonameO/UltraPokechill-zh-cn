// Pokechill 特性训练助手 — 改写自 pokechill特性训练助手-1.0.user.js
//  - 保留原脚本的浮窗功能（搜索目标特性 + 自动重试直到获得目标特性）；
//  - UI 为独立浮窗（可拖拽 / 折叠），美术与交互沿用 pokechillHelper 的视觉风格；
//  - 通过 UltraMods 接口注册为游戏 mod，加载逻辑与原脚本一致（直接读取页面全局 saved/pkmn/ability）。

const MOD_ID = "pokechillTrainer";
const STYLE_ID = "pokechill-trainer-style";

// 特性中文字典（原样移植）
const ABILITY_CN_DICT = {
  "stoned": "石化",
  "stamina": "耐力",
  "flowerVeil": "花幕",
  "sweetVeil": "甜幕",
  "shieldsDown": "界限盾壳",
  "merciless": "不仁不义",
  "purifyingSalt": "洁净之盐",
  "powerOfAlchemy": "化学之力",
  "gooey": "黏滑",
  "aromaVeil": "芳香幕",
  "pastelVeil": "粉彩护幕",
  "colorSpore": "彩色孢子",
  "costar": "同台共演",
  "windRider": "乘风",
  "solarPower": "太阳之力",
  "overgrow": "茂盛",
  "ambidextrous": "灵巧双手",
  "draconic": "龙语",
  "hydration": "湿润之躯",
  "sandVeil": "沙隐",
  "snowCloak": "雪隐",
  "grabGuard": "格斗防护",
  "waterGuard": "流水防护",
  "flameGuard": "火焰防护",
  "curseGuard": "诅咒防护",
  "poisonGuard": "毒物防护",
  "iceGuard": "寒冰防护",
  "psychicGuard": "精神防护",
  "fairyGuard": "妖精防护",
  "leafGuard": "自然防护",
  "plainGuard": "普通防护",
  "sinisterGuard": "邪恶防护",
  "steelGuard": "钢铁防护",
  "dragonGuard": "龙之防护",
  "bugGuard": "昆虫防守",
  "groundGuard": "地面防护",
  "flyingGuard": "飞行防护",
  "rockGuard": "岩石防护",
  "iceBody": "冰冻之躯",
  "insomnia": "不眠",
  "immunity": "免疫",
  "average": "均衡",
  "limber": "柔软",
  "blaze": "猛火",
  "torrent": "激流",
  "bastion": "堡垒",
  "resolve": "决心",
  "mistify": "薄雾遮蔽",
  "hexerei": "巫术",
  "glimmer": "微光",
  "rime": "寒霜",
  "voltage": "电压",
  "naturalCure": "自然回复",
  "strongJaw": "强壮之颚",
  "toughClaws": "硬爪",
  "technician": "技术高手",
  "swarm": "虫之预感",
  "levitate": "飘浮",
  "livingShield": "活体护盾",
  "sandForce": "沙之力",
  "solid": "坚硬",
  "adaptability": "适应力",
  "guts": "毅力",
  "ironFist": "铁拳",
  "unburden": "轻装",
  "magicGuard": "魔法防守",
  "sheerForce": "强行",
  "synchronize": "同步",
  "bigPecks": "健壮胸肌",
  "unaware": "纯朴",
  "swiftSwim": "悠游自如",
  "intimidate": "威吓",
  "magmaArmor": "熔岩铠甲",
  "ownTempo": "我行我素",
  "skyward": "天际",
  "chlorophyll": "叶绿素",
  "tintedLens": "有色眼镜",
  "rivalry": "斗争心",
  "fullMetalBody": "金属防护",
  "wonderSkin": "奇迹皮肤",
  "waterVeil": "水幕",
  "thickFat": "厚脂肪",
  "moxie": "自信过度",
  "brittleArmor": "易碎盔甲",
  "sharpness": "锋锐",
  "hyperCutter": "怪力钳",
  "rainDish": "雨盘",
  "static": "静电",
  "poisonPoint": "毒刺",
  "effectSpore": "孢子",
  "flameBody": "火焰之躯",
  "strangeCharm": "奇异之躯",
  "glacialBody": "冰河之躯",
  "scrappy": "胆量",
  "voltAbsorb": "蓄电",
  "waterAbsorb": "流水吸收",
  "flareAbsorb": "火焰吸收",
  "curseAbsorb": "诅咒吸收",
  "poisonAbsorb": "毒吸收",
  "psychicAbsorb": "超能吸收",
  "lightAbsorb": "妖精吸收",
  "growthAbsorb": "青草吸收",
  "pickPocket": "顺手牵羊",
  "blackPelt": "黑色毛皮",
  "fuzzyPelt": "绒绒毛皮",
  "spikyPelt": "刺刺毛皮",
  "icyPelt": "冰冷毛皮",
  "grassyPelt": "草之毛皮",
  "sandyPelt": "沙砾毛皮",
  "moistPelt": "湿润毛皮",
  "fieryPelt": "炽热毛皮",
  "pixiePelt": "妖精纤肤",
  "climaTact": "气候战术",
  "intangible": "无形",
  "flareBoost": "受热激升",
  "hyperconductor": "超导体",
  "faeRush": "妖精疾驰",
  "moltShed": "蜕皮",
  "slushRush": "冰雪疾驰",
  "sandRush": "风沙疾驰",
  "dauntingLook": "惊吓面容",
  "angerPoint": "愤怒穴位",
  "flashAqua": "流水迅闪",
  "flashCryo": "寒冰迅闪",
  "flashElectro": "雷电迅闪",
  "flashFae": "妖精迅闪",
  "flashHerba": "青草迅闪",
  "flashPsycha": "超能迅闪",
  "flashPyro": "火焰迅闪",
  "flashUmbra": "暗影迅闪",
  "flashVenum": "毒液迅闪",
  "justified": "正义之心",
  "strategist": "战术家",
  "multiscale": "多重鳞片",
  "skillLink": "技能连锁",
  "noGuard": "无防守",
  "reckless": "舍身",
  "parentalBond": "亲子爱",
  "hugePower": "大力士",
  "contrary": "唱反调",
  "gloomilate": "黑暗皮肤",
  "aerilate": "飞行皮肤",
  "beastBoost": "异兽增幅",
  "chrysilate": "昆虫皮肤",
  "corrosion": "腐蚀",
  "dancer": "舞者",
  "darkAura": "暗黑气场",
  "cacophony": "杂音",
  "drizzle": "降雨",
  "drought": "日照",
  "electricSurge": "电气制造者",
  "espilate": "超能皮肤",
  "ferrilate": "钢铁皮肤",
  "filter": "过滤",
  "galeWings": "疾风之翼",
  "galvanize": "电气皮肤",
  "goodAsGold": "黄金之躯",
  "gorillaTactics": "蛮力战术",
  "grassySurge": "青草制造者",
  "hydrolate": "流水皮肤",
  "imposter": "变身者",
  "libero": "自由者",
  "thousandArms": "千臂",
  "wonderGuard": "神奇守护",
  "prankster": "恶作剧之心",
  "speedBoost": "加速",
  "scorch": "烧焦",
  "megaLauncher": "波动增幅",
  "metalhead": "铁头",
  "toxicBoost": "毒气增幅",
  "supremeOverlord": "大将",
  "quarkDrive": "夸克充能",
  "protosynthesis": "古代活性",
  "sandStream": "扬沙",
  "snowWarning": "降雪",
  "somberField": "阴森场地",
  "mistySurge": "薄雾制造者",
  "sereneGrace": "天恩",
  "protean": "变幻自如",
  "simple": "单纯",
  "moody": "心情不定",
  "normalize": "普通皮肤",
  "terralate": "大地皮肤",
  "toxilate": "剧毒皮肤",
  "pyrolate": "火焰皮肤",
  "pixilate": "妖精皮肤",
  "verdify": "青草皮肤",
  "dragonMaw": "龙颚",
  "treasureOfRuin": "灾祸之宝",
  "soulAsterism": "灵魂星象",
  "noxious": "恶臭",
  "frostAbsorb": "冰霜吸收",
  "glaciate": "冰冻皮肤",
  "hydratation": "湿润之躯",
  "marvelScale": "神奇鳞片"
};

// 反向字典（中文名 -> ID）
const CN_TO_ABILITY_DICT = {};
for (const [id, cn] of Object.entries(ABILITY_CN_DICT)) {
  CN_TO_ABILITY_DICT[cn] = id;
}

let uiEl = null;
let apiRef = null;
let observer = null;
let observerStarted = false;
let checkTimeout = null;
let clickedThisCycle = false;
let lastVisible = false;
let currentTargetId = ""; // 已锁定的目标特性 ID
let uiRefs = null;         // 浮窗内关键 DOM 引用

UltraMods.define({
  id: MOD_ID,
  name: "Pokechill 特性训练助手",
  description: "特性训练时自动重试，直到获得目标特性；支持中文名 / ID 模糊搜索锁定目标特性。",
  image: "img/items/quickClaw.png",
  version: "1.0",
  author: "CODEBUDDY, Reso",
  category: "实用工具",
  defaultEnabled: false,
  hooks: {
    onToggle(api, payload, state) {
      installStyles();
      ensureState(state);
      apiRef = api;
      if (payload.enabled) {
        ensureFloatingUI(api, state);
        startObserver();
        updateFloatingUI(api, state);
      } else {
        stopObserver();
        removeFloatingUI();
        apiRef = null;
      }
    },
    onRefresh(api, payload, state) {
      installStyles();
      ensureState(state);
      apiRef = api;
      if (api.isEnabled(MOD_ID)) {
        ensureFloatingUI(api, state);
        startObserver();
        updateFloatingUI(api, state);
      }
    }
  }
});

installStyles();

// ===================== 状态 / 存储 =====================

function ensureState(state) {
  if (!state || typeof state !== "object") state = {};
  state.targetAbility = typeof state.targetAbility === "string" ? state.targetAbility : "";
  state.autoTraining = !!state.autoTraining;

  const ui = (state.uiState && typeof state.uiState === "object") ? state.uiState : {};
  state.uiState = {
    left: typeof ui.left === "string" ? ui.left : "10px",
    top: typeof ui.top === "string" ? ui.top : "10px",
    isCollapsed: !!ui.isCollapsed
  };
  return state;
}

function getState(api) {
  const saved = api.saved;
  if (!saved.mods) saved.mods = {};
  if (!saved.mods.state) saved.mods.state = {};
  if (!saved.mods.state[MOD_ID]) saved.mods.state[MOD_ID] = {};
  return ensureState(saved.mods.state[MOD_ID]);
}

// 读取页面全局 saved（与 api.saved 为同一对象）
function getSaved() {
  if (apiRef && apiRef.saved) return apiRef.saved;
  if (typeof saved !== "undefined") return saved;
  return null;
}

// ===================== 特性搜索 / 读取（移植自原脚本） =====================

function searchAbility(searchText) {
  const text = searchText.trim().toLowerCase();
  if (!text) return null;

  // 1. 完全匹配中文名
  if (CN_TO_ABILITY_DICT[searchText.trim()]) {
    return CN_TO_ABILITY_DICT[searchText.trim()];
  }
  // 2. 完全匹配 ID
  if (ABILITY_CN_DICT[text]) {
    return text;
  }
  // 3. 模糊匹配中文名 / ID
  const fuzzyMatches = [];
  for (const [id, cn] of Object.entries(ABILITY_CN_DICT)) {
    if (cn.toLowerCase().includes(text)) fuzzyMatches.push({ id, cn, match: cn });
    if (id.toLowerCase().includes(text)) fuzzyMatches.push({ id, cn, match: id });
  }
  if (fuzzyMatches.length === 1) return fuzzyMatches[0].id;
  // 多个匹配或零匹配都返回 null
  return null;
}

function getCurrentAbility() {
  const saved = getSaved();
  if (!saved || typeof pkmn === "undefined") return null;
  const pkmnId = saved.trainingPokemon;
  if (!pkmnId) return null;
  return (pkmn[pkmnId] && pkmn[pkmnId].ability) || null;
}

function getAbilityName(abilityId) {
  if (!abilityId) return "未知";
  if (ABILITY_CN_DICT[abilityId]) {
    return `${ABILITY_CN_DICT[abilityId]} (${abilityId})`;
  }
  if (typeof ability !== "undefined" && ability[abilityId]) {
    return ability[abilityId].name || abilityId;
  }
  return abilityId;
}

function isInAbilityTraining() {
  const saved = getSaved();
  if (!saved || typeof areas === "undefined") return false;
  return saved.currentArea === areas.training.id &&
         areas.training.currentTraining === "ability";
}

function isActuallyVisible(el) {
  return !!(el && el.offsetParent !== null && el.getClientRects().length > 0);
}

// ===================== 自动训练逻辑（移植自原脚本） =====================

function checkAutoTraining() {
  if (!apiRef || !apiRef.isEnabled(MOD_ID)) return;
  const state = getState(apiRef);
  if (!state.autoTraining || !currentTargetId) return;

  const rejoinBtn = document.getElementById("area-rejoin");
  if (!rejoinBtn) return;

  const visible = isActuallyVisible(rejoinBtn);

  // 按钮从可见变为不可见 -> 重置点击状态
  if (!visible && lastVisible) {
    clickedThisCycle = false;
  }

  // 按钮从不可见变为可见，且本周期未点击过
  if (visible && !lastVisible && !clickedThisCycle) {
    const current = getCurrentAbility();
    if (!current) {
      lastVisible = visible;
      return;
    }
    const name = getAbilityName(current);
    if (uiRefs) uiRefs.currentLabel.textContent = `当前特性: ${name}`;

    if (current === currentTargetId) {
      // 匹配成功，停止自动训练
      state.autoTraining = false;
      if (uiRefs) {
        uiRefs.statusLabel.textContent = "状态: 已获得目标特性 🎉";
        uiRefs.toggleBtn.textContent = "▶️ 开启自动训练";
        uiRefs.toggleBtn.classList.remove("active");
      }
      api.save();
      return;
    }

    // 未匹配，点击重试
    clickedThisCycle = true;
    if (uiRefs) uiRefs.statusLabel.textContent = `状态: 不匹配 (${name})，重试中...`;
    setTimeout(() => {
      const btn = document.getElementById("area-rejoin");
      if (btn) btn.click();
    }, 100);
  }

  lastVisible = visible;

  // 不在重试阶段时，持续刷新当前特性显示
  if (state.autoTraining && !visible) {
    const current = getCurrentAbility();
    if (current && uiRefs) {
      uiRefs.currentLabel.textContent = `当前特性: ${getAbilityName(current)}`;
      uiRefs.statusLabel.textContent = "状态: 训练中...";
    }
  }
}

function scheduleCheck() {
  if (checkTimeout) return;
  checkTimeout = setTimeout(() => {
    checkTimeout = null;
    try { checkAutoTraining(); } catch (e) { /* ignore */ }
  }, 80);
}

function startObserver() {
  if (observerStarted) return;
  observerStarted = true;
  observer = new MutationObserver(scheduleCheck);
  observer.observe(document.body, { childList: true, subtree: true, attributes: true });
}

function stopObserver() {
  if (observer) { observer.disconnect(); observer = null; }
  observerStarted = false;
  if (checkTimeout) { clearTimeout(checkTimeout); checkTimeout = null; }
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
      font-size: 0.9rem;
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
      font-size: 1.15rem;
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

    .pch-section-title {
      display: flex;
      align-items: center;
      gap: 0.4rem;
      color: var(--light1);
      font-weight: bold;
      font-size: 1rem;
    }

    .pch-search {
      width: 100%;
      box-sizing: border-box;
      background: var(--dark2);
      color: var(--light2);
      border: 1px solid rgba(255, 255, 255, 0.2);
      border-radius: 0.3rem;
      font-family: inherit;
      font-size: 0.9rem;
      padding: 0.35rem 0.45rem;
    }
    .pch-search::placeholder { color: rgba(236, 222, 183, 0.6); }

    .pch-search-result {
      font-size: 0.8rem;
      min-height: 1.1em;
      color: var(--dark2);
    }
    .pch-search-result.ok { color: rgb(60, 110, 90); font-weight: bold; }
    .pch-search-result.err { color: #b3453b; font-weight: bold; }

    .pch-info {
      font-size: 0.9rem;
      color: var(--dark2);
    }

    .pch-btn {
      background: var(--light1);
      color: var(--light2);
      border: 0;
      border-radius: 0.4rem;
      font-family: inherit;
      font-size: 0.9rem;
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

    .pch-foot {
      margin-top: 0.35rem;
      font-size: 0.68rem;
      font-weight: bold;
      opacity: 0.7;
      text-align: center;
      pointer-events: none;
    }
  `;
  document.head.appendChild(style);
}

function buildFloatingUI(api, state) {
  const ui = document.createElement("div");
  ui.id = "pokechill-trainer-ui";
  ui.className = "pch-floating";

  const header = document.createElement("div");
  header.className = "pch-header";
  const title = document.createElement("span");
  title.className = "pch-title";
  title.textContent = "⚡ 特性训练助手";
  const toggleBtn = document.createElement("button");
  toggleBtn.type = "button";
  toggleBtn.className = "pch-toggle-btn";
  toggleBtn.title = "折叠 / 展开";
  toggleBtn.textContent = "➖";
  header.append(title, toggleBtn);

  const content = document.createElement("div");
  content.className = "pch-content";

  // 目标特性
  const targetTitle = document.createElement("div");
  targetTitle.className = "pch-section-title";
  targetTitle.textContent = "🎯 目标特性";

  const searchInput = document.createElement("input");
  searchInput.type = "text";
  searchInput.className = "pch-search";
  searchInput.placeholder = "搜索特性（中文 / ID）";

  const searchResult = document.createElement("div");
  searchResult.className = "pch-search-result";
  searchResult.textContent = "";

  // 当前特性
  const currentTitle = document.createElement("div");
  currentTitle.className = "pch-section-title";
  currentTitle.textContent = "🔍 当前特性";
  const currentLabel = document.createElement("div");
  currentLabel.className = "pch-info";
  currentLabel.textContent = "当前特性: 未知";

  // 状态
  const statusTitle = document.createElement("div");
  statusTitle.className = "pch-section-title";
  statusTitle.textContent = "📊 状态";
  const statusLabel = document.createElement("div");
  statusLabel.className = "pch-info";
  statusLabel.textContent = "状态: 未开始";

  // 操作按钮
  const toggleBtn2 = makeButton("▶️ 开启自动训练", () => onToggleTraining(api));
  const clearBtn = makeButton("清除目标", () => onClearTarget(api));

  const foot = document.createElement("div");
  foot.className = "pch-foot";
  foot.textContent = "自动重试直到获得目标特性";

  content.append(
    targetTitle, searchInput, searchResult,
    currentTitle, currentLabel,
    statusTitle, statusLabel,
    toggleBtn2, clearBtn,
    foot
  );
  ui.append(header, content);

  // 事件绑定
  let searchTimeout;
  searchInput.addEventListener("input", () => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      const text = searchInput.value.trim();
      if (!text) {
        searchResult.textContent = "";
        searchResult.className = "pch-search-result";
        currentTargetId = "";
        return;
      }
      const matched = searchAbility(text);
      if (matched) {
        const cn = ABILITY_CN_DICT[matched] || matched;
        searchResult.textContent = `✓ ${cn} (${matched})`;
        searchResult.className = "pch-search-result ok";
        currentTargetId = matched;
      } else {
        searchResult.textContent = "✗ 未找到匹配的特性（或多个匹配）";
        searchResult.className = "pch-search-result err";
        currentTargetId = "";
      }
    }, 300);
  });

  toggleBtn.addEventListener("click", event => {
    event.stopPropagation();
    toggleCollapse(api, getState(api));
  });

  setupDrag(ui, header, api);
  uiRefs = { searchInput, searchResult, currentLabel, statusLabel, toggleBtn: toggleBtn2, clearBtn };
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
  btn.classList.add("active");
  setTimeout(() => {
    const s = apiRef && getState(apiRef);
    if (!(s && s.autoTraining)) btn.classList.remove("active");
  }, 400);
}

function onToggleTraining(api) {
  const state = getState(api);
  if (!currentTargetId) {
    if (uiRefs) uiRefs.statusLabel.textContent = "状态: 请先搜索并锁定目标特性";
    return;
  }
  state.autoTraining = !state.autoTraining;
  clickedThisCycle = false;
  lastVisible = false;
  if (state.autoTraining) {
    if (uiRefs) uiRefs.statusLabel.textContent = "状态: 等待训练结束...";
  } else {
    if (uiRefs) uiRefs.statusLabel.textContent = "状态: 已停止";
  }
  api.save();
  updateFloatingUI(api, state);
  flash(uiRefs.toggleBtn);
}

function onClearTarget(api) {
  const state = getState(api);
  state.autoTraining = false;
  currentTargetId = "";
  clickedThisCycle = false;
  lastVisible = false;
  if (uiRefs) {
    uiRefs.searchInput.value = "";
    uiRefs.searchResult.textContent = "";
    uiRefs.searchResult.className = "pch-search-result";
    uiRefs.statusLabel.textContent = "状态: 未开始";
  }
  api.save();
  updateFloatingUI(api, state);
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
  uiRefs = null;
}

function updateFloatingUI(api, state) {
  if (!uiEl || !uiRefs) return;

  const cur = getCurrentAbility();
  uiRefs.currentLabel.textContent = `当前特性: ${cur ? getAbilityName(cur) : "未知"}`;

  uiRefs.toggleBtn.textContent = state.autoTraining ? "⏸️ 停止训练" : "▶️ 开启自动训练";
  uiRefs.toggleBtn.classList.toggle("active", state.autoTraining);

  if (!state.autoTraining) {
    uiRefs.statusLabel.textContent = "状态: 已停止";
  } else if (!lastVisible) {
    uiRefs.statusLabel.textContent = "状态: 等待训练结束...";
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
