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
let lastTrainingPokemon = null; // 上次渲染下拉框时的训练宝可梦 ID
let comboOutsideClick = null;   // 下拉框外部点击关闭监听
let tooltipEl = null;           // 特性描述 tooltip 元素

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

// ===================== 特性读取（移植自原脚本） =====================

// 特性详细描述（取自游戏 ability[id].info()）
function getAbilityDescription(id) {
  if (typeof ability !== "undefined" && ability[id] && typeof ability[id].info === "function") {
    try { return ability[id].info(); } catch (e) { /* ignore */ }
  }
  return "";
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
  refreshCurrentInfo(apiRef);
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

  // 不在重试阶段时，持续刷新状态
  if (state.autoTraining && !visible && uiRefs) {
    uiRefs.statusLabel.textContent = "状态: 训练中...";
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
    }

    .pch-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: var(--light1);
      color: var(--light2);
      padding: 0.45rem 0.6rem;
      border-radius: 0.5rem 0.5rem 0 0;
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
      border-radius: 0 0 0.5rem 0.5rem;
    }

    .pch-section-title {
      display: flex;
      align-items: center;
      gap: 0.4rem;
      color: var(--light1);
      font-weight: bold;
      font-size: 1rem;
    }

    .pch-combo {
      position: relative;
      width: 100%;
    }
    .pch-combo-input {
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
    .pch-combo-input::placeholder { color: rgba(236, 222, 183, 0.6); }

    .pch-combo-list {
      display: none;
      flex-direction: column;
      position: fixed;
      z-index: 1300;
      max-height: 240px;
      overflow-y: auto;
      background: var(--dark2);
      border: 1px solid rgba(255, 255, 255, 0.25);
      border-radius: 0.3rem;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
    }
    .pch-combo-list.open { display: flex; }
    .pch-combo-option {
      padding: 0.5rem 0.55rem;
      color: var(--light2);
      cursor: pointer;
      font-size: 0.9rem;
      line-height: 1.4;
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);
      white-space: normal;
      word-break: break-word;
    }
    .pch-combo-option:last-child { border-bottom: 0; }
    .pch-combo-option:hover, .pch-combo-option.active {
      background: rgb(90, 133, 113);
      color: white;
    }
    .pch-combo-empty {
      padding: 0.4rem 0.45rem;
      color: rgba(236, 222, 183, 0.6);
      font-size: 0.85rem;
    }

    .pch-tooltip {
      position: fixed;
      display: none;
      max-width: 260px;
      background: rgba(54, 52, 47, 0.97);
      color: var(--light2);
      border: 1px solid rgba(255, 255, 255, 0.18);
      border-radius: 0.35rem;
      padding: 0.5rem 0.6rem;
      font-size: 0.8rem;
      line-height: 1.45;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
      z-index: 1400;
      pointer-events: none;
    }
    .pch-tooltip b { color: var(--light2); }

    .pch-divider {
      height: 0;
      margin: 0.05rem 0;
      border-top: 1px solid rgba(54, 52, 47, 0.3);
    }

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

  // ===== 当前信息（需求1：置于目标特性上方）=====
  const infoTitle = document.createElement("div");
  infoTitle.className = "pch-section-title";
  infoTitle.textContent = "📋 当前信息";
  const pkmnLine = document.createElement("div");
  pkmnLine.className = "pch-info";
  pkmnLine.textContent = "宝可梦: 未选择";
  const abilityLine = document.createElement("div");
  abilityLine.className = "pch-info";
  abilityLine.textContent = "特性: 未知";

  // ===== 目标特性（需求2：可搜索下拉选择框）=====
  const targetTitle = document.createElement("div");
  targetTitle.className = "pch-section-title";
  targetTitle.textContent = "🎯 目标特性";

  const combo = document.createElement("div");
  combo.className = "pch-combo";
  const comboInput = document.createElement("input");
  comboInput.type = "text";
  comboInput.className = "pch-combo-input";
  comboInput.placeholder = "选择 / 搜索特性…";
  comboInput.setAttribute("autocomplete", "off");
  const comboList = document.createElement("div");
  comboList.className = "pch-combo-list";
  combo.append(comboInput, comboList);

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

  const divider1 = document.createElement("div");
  divider1.className = "pch-divider";
  const divider2 = document.createElement("div");
  divider2.className = "pch-divider";
  const divider3 = document.createElement("div");
  divider3.className = "pch-divider";

  content.append(
    infoTitle, pkmnLine, abilityLine,
    divider1,
    targetTitle, combo,
    divider2,
    statusTitle, statusLabel,
    divider3,
    toggleBtn2, clearBtn,
    foot
  );
  ui.append(header, content);

  uiRefs = { pkmnLine, abilityLine, comboInput, comboList, combo, statusLabel, toggleBtn: toggleBtn2, clearBtn };

  // 下拉框事件（搜索过滤 + 选中即确认）
  setupCombo(api, comboInput, comboList, combo);

  toggleBtn.addEventListener("click", event => {
    event.stopPropagation();
    toggleCollapse(api, getState(api));
  });

  setupDrag(ui, header, api);
  return ui;
}

// 当前正在训练的宝可梦 ID
function getCurrentTrainingPkmnId() {
  const saved = getSaved();
  if (!saved) return null;
  return saved.trainingPokemon || null;
}

// 该宝可梦"能够学会"的特性 ID 列表：类型匹配（含 "all"），排除隐藏特性与当前已拥有特性
function getLearnableAbilities(pkmnId) {
  const saved = getSaved();
  if (!pkmnId || typeof pkmn === "undefined" || !pkmn[pkmnId]) return [];
  const poke = pkmn[pkmnId];
  const types = poke.type || [];
  const hiddenId = poke.hiddenAbility ? poke.hiddenAbility.id : null;
  const currentId = poke.ability;
  const result = [];
  for (const [id, ab] of Object.entries(typeof ability !== "undefined" ? ability : {})) {
    if (!ab || !Array.isArray(ab.type)) continue;
    const matched = ab.type.includes("all") || ab.type.some(t => types.includes(t));
    if (!matched) continue;
    if (id === hiddenId) continue;   // 隐藏特性无法通过训练获得
    if (id === currentId) continue;  // 当前已拥有，无需作为目标
    result.push(id);
  }
  return result;
}

// 渲染下拉候选（按输入过滤）
function renderComboOptions(api, filterText) {
  if (!uiRefs || !uiRefs.comboList) return;
  const list = uiRefs.comboList;
  list.innerHTML = "";
  const pkmnId = getCurrentTrainingPkmnId();
  const candidates = getLearnableAbilities(pkmnId);
  const filter = (filterText || "").trim().toLowerCase();
  const matches = candidates.filter(id => {
    if (!filter) return true;
    const cn = getAbilityName(id).toLowerCase();
    return cn.includes(filter) || id.toLowerCase().includes(filter);
  });
  if (matches.length === 0) {
    const empty = document.createElement("div");
    empty.className = "pch-combo-empty";
    empty.textContent = pkmnId ? "无匹配特性" : "请先选择训练宝可梦";
    list.appendChild(empty);
    return;
  }
  for (const id of matches) {
    const opt = document.createElement("div");
    opt.className = "pch-combo-option";
    opt.dataset.id = id;
    opt.textContent = getAbilityName(id);
    const cn = ABILITY_CN_DICT[id] ? ABILITY_CN_DICT[id] : id;
    const desc = getAbilityDescription(id);
    opt._tipHtml = `<b>${cn} (${id})</b>` + (desc ? `<br>${desc}` : "");
    if (id === currentTargetId) opt.classList.add("active");
    list.appendChild(opt);
  }
}

// 将输入文本解析为特性 ID（中文名 / ID 精确匹配）
function findExactAbility(text) {
  const t = (text || "").trim();
  if (!t) return null;
  if (CN_TO_ABILITY_DICT[t]) return CN_TO_ABILITY_DICT[t];
  const lower = t.toLowerCase();
  if (ABILITY_CN_DICT[lower]) return lower;
  for (const id of getLearnableAbilities(getCurrentTrainingPkmnId())) {
    if (id.toLowerCase() === lower) return id;
    if ((ABILITY_CN_DICT[id] || "").toLowerCase() === lower) return id;
  }
  return null;
}

// 确认目标特性（选中即确认）
function confirmTarget(api, abilityId, input) {
  currentTargetId = abilityId;
  const cn = getAbilityName(abilityId);
  if (input) input.value = cn;
  const state = getState(api);
  state.autoTraining = false;
  clickedThisCycle = false;
  lastVisible = false;
  if (uiRefs) {
    uiRefs.statusLabel.textContent = `状态: 已锁定目标 ${cn}，可开启自动训练`;
    uiRefs.toggleBtn.textContent = "▶️ 开启自动训练";
    uiRefs.toggleBtn.classList.remove("active");
  }
  api.save();
  updateFloatingUI(api, state);
}

// 下拉框交互：打开 / 过滤 / 选中 / 外部点击关闭
function setupCombo(api, input, list, combo) {
  function positionList() {
    if (!uiEl) return;
    const uiRect = uiEl.getBoundingClientRect();
    list.style.width = uiRect.width + "px";
    const listRect = list.getBoundingClientRect();
    let top = uiRect.top - listRect.height - 6;
    let left = uiRect.left;
    if (top < 8) top = uiRect.bottom + 6; // 顶部空间不足时改在卡片下方
    if (left + uiRect.width > window.innerWidth - 8) left = Math.max(8, window.innerWidth - uiRect.width - 8);
    if (left < 8) left = 8;
    list.style.left = left + "px";
    list.style.top = top + "px";
  }
  function open() {
    renderComboOptions(api, "");
    list.classList.add("open");
    positionList();
  }
  function close() {
    list.classList.remove("open");
    hideTooltip();
  }
  input.addEventListener("focus", open);
  input.addEventListener("click", event => { event.stopPropagation(); open(); });
  input.addEventListener("input", () => { renderComboOptions(api, input.value); list.classList.add("open"); positionList(); });
  input.addEventListener("keydown", event => {
    if (event.key === "Enter") {
      const exact = findExactAbility(input.value);
      if (exact) { confirmTarget(api, exact, input); close(); }
    } else if (event.key === "Escape") {
      close();
    }
  });
  list.addEventListener("click", event => {
    const opt = event.target.closest(".pch-combo-option");
    if (!opt) return;
    event.stopPropagation();
    confirmTarget(api, opt.dataset.id, input);
    close();
  });
  // 悬停选项 -> 显示特性描述 tooltip
  list.addEventListener("mouseover", event => {
    const opt = event.target.closest(".pch-combo-option");
    if (!opt || !opt._tipHtml) return;
    const r = opt.getBoundingClientRect();
    showTooltip(opt._tipHtml, r.right, r.top);
  });
  list.addEventListener("mousemove", event => {
    const opt = event.target.closest(".pch-combo-option");
    if (!opt || !opt._tipHtml) return;
    const r = opt.getBoundingClientRect();
    showTooltip(opt._tipHtml, r.right, r.top);
  });
  list.addEventListener("mouseout", event => {
    const opt = event.target.closest(".pch-combo-option");
    if (opt) hideTooltip();
  });
  // 点击浮窗外部关闭列表
  comboOutsideClick = event => {
    if (list.classList.contains("open") && !combo.contains(event.target) && event.target !== input) close();
  };
  document.addEventListener("mousedown", comboOutsideClick);
}

// 特性描述 tooltip
function getTooltip() {
  if (!tooltipEl) {
    tooltipEl = document.createElement("div");
    tooltipEl.className = "pch-tooltip";
    document.body.appendChild(tooltipEl);
  }
  return tooltipEl;
}
function showTooltip(html, x, y) {
  const t = getTooltip();
  t.innerHTML = html;
  t.style.display = "block";
  const r = t.getBoundingClientRect();
  let left = x + 12;
  let top = y + 12;
  if (left + r.width > window.innerWidth - 8) left = x - r.width - 12;
  if (left < 8) left = 8;
  if (top + r.height > window.innerHeight - 8) top = window.innerHeight - r.height - 8;
  if (top < 8) top = 8;
  t.style.left = left + "px";
  t.style.top = top + "px";
}
function hideTooltip() {
  if (tooltipEl) tooltipEl.style.display = "none";
}

// 刷新"当前信息"模块，并在训练宝可梦变化时重建下拉候选
function refreshCurrentInfo(api) {
  if (!uiRefs) return;
  const pkmnId = getCurrentTrainingPkmnId();
  uiRefs.pkmnLine.textContent = `宝可梦: ${pkmnId ? format(pkmnId) : "未选择训练宝可梦"}`;
  const cur = getCurrentAbility();
  uiRefs.abilityLine.textContent = `特性: ${cur ? getAbilityName(cur) : "未知"}`;
  if (pkmnId !== lastTrainingPokemon) {
    lastTrainingPokemon = pkmnId;
    if (uiRefs.comboList) renderComboOptions(api, uiRefs.comboInput.value);
  }
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
    if (uiRefs) uiRefs.statusLabel.textContent = "状态: 请先选择目标特性";
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
    uiRefs.comboInput.value = "";
    uiRefs.statusLabel.textContent = "状态: 未开始";
    renderComboOptions(api, "");
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
  if (comboOutsideClick) {
    document.removeEventListener("mousedown", comboOutsideClick);
    comboOutsideClick = null;
  }
  if (tooltipEl && tooltipEl.parentNode) tooltipEl.parentNode.removeChild(tooltipEl);
  tooltipEl = null;
  if (uiEl && uiEl.parentNode) uiEl.parentNode.removeChild(uiEl);
  uiEl = null;
  uiRefs = null;
  lastTrainingPokemon = null;
}

function updateFloatingUI(api, state) {
  if (!uiEl || !uiRefs) return;

  refreshCurrentInfo(api);

  // 已锁定目标时回填输入框
  if (currentTargetId && uiRefs.comboInput.value.trim() === "") {
    uiRefs.comboInput.value = getAbilityName(currentTargetId);
  }

  uiRefs.toggleBtn.textContent = state.autoTraining ? "⏸️ 停止训练" : "▶️ 开启自动训练";
  uiRefs.toggleBtn.classList.toggle("active", state.autoTraining);
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
