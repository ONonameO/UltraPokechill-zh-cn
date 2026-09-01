const MOD_ID = "pokechillDummy";
const DUMMY_PKMN_ID = "custom_dummy_pkmn";
const DUMMY_AREA_ID = "custom_dummy_area";
const DUMMY_AREA_NAME = "木桩测试 (可配置)";
const DUMMY_SPRITE_URL = "mods/customDummyIcon.png";

// 面板样式表 id（沿用 abilityTrainer 的「独立 style + id 守卫」做法）
const PANEL_STYLE_ID = "dummy-panel-style";

// 属性选项（顺序与游戏 typeDictionary 一致）
const DUMMY_TYPE_LIST = [
  ["normal", "一般"], ["fire", "火"], ["water", "水"], ["electric", "电"],
  ["grass", "草"], ["ice", "冰"], ["fighting", "格斗"], ["poison", "毒"],
  ["ground", "地面"], ["flying", "飞行"], ["psychic", "超能力"], ["bug", "虫"],
  ["rock", "岩石"], ["ghost", "幽灵"], ["dragon", "龙"], ["dark", "恶"],
  ["steel", "钢"], ["fairy", "妖精"]
];

// 种族值项
const DUMMY_BST_LIST = [
  ["hp", "HP"], ["atk", "攻击"], ["def", "防御"],
  ["satk", "特攻"], ["sdef", "特防"], ["spe", "速度"]
];

// 属性配色：优先复用游戏 returnTypeColor()，不可用时回退到同色表
const TYPE_FALLBACK_COLOR = {
  bug: "#92BD2D", dark: "#595761", dragon: "#0C6AC8", electric: "#F2D94E",
  fairy: "#EF90E6", fighting: "#D3425F", fire: "#FBA64C", flying: "#A1BBEC",
  ghost: "#5F6DBC", grass: "#60BE58", ground: "#DA7C4D", ice: "#76D1C1",
  normal: "#A0A29F", poison: "#B763CF", psychic: "#FA8582", rock: "#C9BC8A",
  steel: "#5795A3", water: "#539DDF"
};

let activeApi = null;
let imgErrorHandler = null;
let originalUpdateVS = null;
let pendingReopenConfig = false;   // 标记：本次 pkmn 编辑器是由「配置技能」按钮打开，关闭后应重弹配置面板
let editorCloseObserver = null;    // 监听 #pkmn-editor 关闭，用于自动重开配置面板
const VS_PATCH = "__pokechillDummyVsPatch";

UltraMods.define({
  id: MOD_ID,
  name: "Pokechill 自定义木桩",
  description: "基于 UltraMods API 构建自定义木桩训练区：可配置属性/等级/技能的木桩，支持锁血，用于测试配队与伤害。由 mod 管理器独立启用或禁用。",
  image: "mods/customDummyIcon.png",
  version: "2.2.0",
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
    // 战斗开始（entering dummy area）：确保满血（锁血基础行为）
    onCombatStart(api, payload, state) {
      if (payload?.areaId !== DUMMY_AREA_ID) return;
      syncDummyConfig(api);  // 把编辑器里配置好的技能与等级同步进战斗用的区域对象
      resetDummyHp(api);
    },
    // 玩家每次对木桩造成伤害后：若开启锁血则回满（不再显示伤害飘字）
    // 注意：afterPlayerDamage 在 explore.js 中于 `wildPkmnHp -= totalPower` 之前触发，
    // 因此需按本次伤害量预补偿，减法后恰好回到上限。
    afterPlayerDamage(api, payload, state) {
      if (api.saved?.currentArea !== DUMMY_AREA_ID) return;
      resetDummyHp(api, payload?.rawDamage);
    }
  }
});

// 锁血基础行为：把野生（木桩）血量重置为上限
// addBack 用于在 afterPlayerDamage 钩子中抵消随后紧跟的 `wildPkmnHp -= totalPower`
function resetDummyHp(api, addBack = 0) {
  const dummy = api.pkmn?.[DUMMY_PKMN_ID];
  if (!dummy || dummy.lockHp !== true) return;
  if (typeof wildPkmnHpMax !== "undefined" && typeof wildPkmnHp !== "undefined") {
    wildPkmnHp = wildPkmnHpMax + (Number(addBack) || 0);
  }
  if (typeof updateWildPkmn === "function") updateWildPkmn();
}

function install(api, state) {
  // 游戏核心未就绪时（api.pkmn/api.areas 尚不存在），交由后续 onRefresh 重试
  if (!api.pkmn || !api.areas) return;

  activeApi = api;

  ensureNoneAbility(api);
  registerDummyPokemon(api);   // 通过 UltraMods api.pkmn 注册木桩宝可梦
  registerDummyArea(api);      // 通过 UltraMods api.areas 注册木桩区域（type:"vs" 确保再战/战后返回 VS 菜单正常；原生占位卡由 injectDummyVsCard 移除并替换为注入卡片）
  patchUpdateVS(api);          // 带标记 + 可还原：在原生 updateVS 重渲染后重新注入木桩卡片（游戏无对应钩子）
  setupImageErrorHandler(api);
  installPanelStyles();       // 面板样式（游戏风格，独立 style）
  ensureConfigPanel(api);
  setupEditorCloseWatcher(api);  // 监听 pkmn 编辑器关闭，关闭后（由「配置技能」打开时）自动重弹配置面板

  api.refreshGame();
}

function uninstall(api) {
  if (api.pkmn) delete api.pkmn[DUMMY_PKMN_ID];
  if (api.areas) delete api.areas[DUMMY_AREA_ID];
  removeImageErrorHandler();
  restoreUpdateVS();
  if (editorCloseObserver) { editorCloseObserver.disconnect(); editorCloseObserver = null; }
  pendingReopenConfig = false;
  document.getElementById("dummy-config-panel")?.remove();
  document.getElementById("dummy-vs-card")?.remove();
  document.getElementById(PANEL_STYLE_ID)?.remove();
  api.refreshGame();
}

// ---------- 核心：通过 UltraMods API 注册木桩 ----------

function ensureNoneAbility(api) {
  const ability = api.ability;
  if (!ability) return;
  if (!ability.none) {
    const template = ability.sturdy;
    ability.none = {
      id: "none",
      rename: "无",
      rarity: template ? template.rarity : 1,
      type: ["all"],
      info: function () { return "没有任何效果。"; },
      ...(template && { icon: template.icon, effect: "无效果" })
    };
  }
  const dummy = api.pkmn?.[DUMMY_PKMN_ID];
  if (dummy) dummy.ability = "none";
}

function registerDummyPokemon(api) {
  if (api.pkmn[DUMMY_PKMN_ID]) return; // 已存在则保留既有配置
  api.pkmn[DUMMY_PKMN_ID] = {
    id: DUMMY_PKMN_ID,
    rename: "自定义测试木桩",
    type: ["normal"],
    bst: { hp: 6, atk: 4, def: 2, satk: 4, sdef: 2, spe: 4 },
    level: 100,
    exp: 0,
    caught: 0,
    shiny: false,
    ability: "none",
    hiddenAbility: undefined,
    hiddenAbilityUnlocked: false,
    movepool: [],
    moves: { slot1: undefined, slot2: undefined, slot3: undefined, slot4: undefined },
    ivs: { hp: 0, atk: 0, def: 0, satk: 0, sdef: 0, spe: 0 },
    pokerus: false,
    ribbons: [],
    newMoves: [],
    newPokemon: undefined,
    newEvolution: undefined,
    tag: undefined,
    lockHp: true
  };
}

function registerDummyArea(api) {
  if (api.areas[DUMMY_AREA_ID]) return;
  // 必须带 type:"vs" 与 sprite：原生「再战 / 战后返回 VS 菜单 / updateVS 渲染」都依赖 type:"vs"。
  // 缺 type:"vs" 会导致：战后落到旅行界面（leaveCombat 行 891 判 type），且自动再战（HackTimer 触发 rejoinArea，
  // 行 1312 把 currentArea 置 undefined 再于 1353 设为 lastAreaJoined）时 areas[currentArea] 取不到 → initialiseArea 崩溃。
  // 原生 updateVS 会为它渲染一张占位卡，随后由 injectDummyVsCard 移除并替换为我们自己的可点击卡片，
  // 故玩家实际只会看到注入的卡片（sprite 仅占位卡用，指向已存在训练师图，避免 404）。
  api.areas[DUMMY_AREA_ID] = {
    name: DUMMY_AREA_NAME,
    background: "gym",
    sprite: "scientist",
    trainer: true,
    type: "vs",
    level: 100,
    team: {
      slot1: api.pkmn[DUMMY_PKMN_ID],
      slot1Moves: [undefined, undefined, undefined, undefined]
    },
    dummy: true,
    defeated: false,
    unlockRequirement: () => true,
    reward: []
  };
}

// 根据当前属性刷新可学技能池（基于 moveset 过滤）
function refreshDummyMovepool(api) {
  const dummy = api.pkmn?.[DUMMY_PKMN_ID];
  if (!dummy) return;
  const types = dummy.type;
  const move = api.move;
  const newMovepool = [];
  for (const moveId in move) {
    const m = move[moveId];
    if (m.moveset) {
      if (m.moveset.includes("all") || types.some(t => m.moveset.includes(t))) {
        newMovepool.push(moveId);
      }
    }
  }
  dummy.movepool = newMovepool;
}

// 把木桩在编辑器里配置好的技能与等级同步进战斗使用的区域对象
// （原生 setWildPkmn 的 trainer 分支只读 areas[...].team.slot1Moves 与 areas[...].level，
//  不会读 pkmn.moves / pkmn.level，因此必须同步到区域对象；否则等级始终为注册时的 100）
function syncDummyConfig(api) {
  const dummy = api.pkmn?.[DUMMY_PKMN_ID];
  const area = api.areas?.[DUMMY_AREA_ID];
  if (!dummy || !area || !area.team) return;
  area.team.slot1Moves = [dummy.moves.slot1, dummy.moves.slot2, dummy.moves.slot3, dummy.moves.slot4];
  area.level = Math.min(100, Math.max(1, Number(dummy.level) || 100));
}

// ---------- VS 卡片注入（带标记 + 可还原的全局函数 patch） ----------

function patchUpdateVS(api) {
  if (typeof updateVS !== "function" || updateVS[VS_PATCH]) return;
  originalUpdateVS = updateVS;
  const patched = function pokechillDummyUpdateVS() {
    originalUpdateVS();
    injectDummyVsCard(api);
  };
  patched[VS_PATCH] = true;
  patched.__pokechillDummyOriginal = originalUpdateVS;
  updateVS = patched;
  if (typeof window !== "undefined") window.updateVS = patched;
}

function restoreUpdateVS() {
  if (typeof updateVS !== "function" || !updateVS[VS_PATCH]) return;
  const orig = updateVS.__pokechillDummyOriginal || originalUpdateVS;
  if (typeof orig === "function") {
    updateVS = orig;
    if (typeof window !== "undefined") window.updateVS = orig;
  }
  originalUpdateVS = null;
}

function injectDummyVsCard(api) {
  // 木桩区域已注册 type:"vs"，原生 updateVS 会渲染一张占位卡（非首张会被置灰为 ???），先移除它
  const baseName = document.getElementById("trainer-name-" + DUMMY_AREA_NAME);
  if (baseName) {
    const baseCard = baseName.closest(".vs-card");
    if (baseCard) baseCard.remove();
  }
  // 已注入则跳过（避免原生 updateVS 重渲染导致重复注入）
  if (document.getElementById("dummy-vs-card")) return;

  const listing = document.getElementById("vs-listing");
  if (!listing) return;

  const card = document.createElement("div");
  card.id = "dummy-vs-card";
  card.className = "vs-card";
  card.dataset.trainer = DUMMY_AREA_ID;
  // 注意：此处不使用 .sprite-trim 类，避免跨域图片触发 trimTransparent 的 SecurityError
  card.innerHTML = `
    <span class="hitbox"></span>
    <img class="vs-card-flair" src="img/icons/pokeball.svg">
    <div class="vs-card-bg"></div>
    <span class="explore-ticket-left" style="z-index: 2;">
      <span style="font-size:1.3rem"> 自定义木桩</span>
      <span><strong style="font-size:1rem; background:#964646ff">测试木桩</strong></span>
    </span>
    <div class="vs-card-left">
      <img src="${DUMMY_SPRITE_URL}"
           style="max-width: 96px; max-height: 96px; width: auto; height: auto; transform: none; scale: 1; object-fit: contain; margin: auto;">
    </div>
  `;
  card.addEventListener("click", () => openConfigPanel(api));
  // 放到列表最上方显示（原生卡片已在上一步被移除，故无冲突）
  listing.prepend(card);
}

// ---------- 图片错误处理（让木桩精灵正确显示） ----------

function setupImageErrorHandler(api) {
  if (imgErrorHandler) return;
  imgErrorHandler = function (e) {
    const img = e.target;
    if (!img || img.tagName !== "IMG") return;
    if (img.src.includes(`/sprite/${DUMMY_PKMN_ID}.png`) ||
        img.src.includes(`/sprite/${DUMMY_PKMN_ID}.gif`)) {
      img.src = DUMMY_SPRITE_URL;
      img.onerror = null;
    }
  };
  document.addEventListener("error", imgErrorHandler, true);
}

function removeImageErrorHandler() {
  if (imgErrorHandler) {
    document.removeEventListener("error", imgErrorHandler, true);
    imgErrorHandler = null;
  }
}

// ---------- 面板样式（沿用 abilityTrainer / 原版游戏视觉风格） ----------

function installPanelStyles() {
  if (document.getElementById(PANEL_STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = PANEL_STYLE_ID;
  style.textContent = `
    #dummy-config-panel {
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 320px;
      max-width: 92vw;
      max-height: 90vh;
      overflow-y: auto;
      display: none;
      flex-direction: column;
      border: 1px solid rgba(255, 255, 255, 0.18);
      border-radius: 0.5rem;
      font-family: inherit;
      font-size: 0.9rem;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35);
      z-index: 1200;
      user-select: none;
      box-sizing: border-box;
    }

    .dummy-panel-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: var(--light1);
      color: var(--light2);
      padding: 0.45rem 0.6rem;
      border-radius: 0.5rem 0.5rem 0 0;
    }
    .dummy-panel-title { font-weight: bold; font-size: 1.05rem; }

    .dummy-panel-content {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      background: var(--light2);
      color: var(--dark2);
      padding: 0.6rem 0.7rem;
      border-radius: 0 0 0.5rem 0.5rem;
    }

    .dummy-section-title {
      display: flex;
      align-items: center;
      gap: 0.4rem;
      color: var(--dark2);
      font-weight: bold;
      font-size: 0.95rem;
    }

    .dummy-divider {
      height: 0;
      margin: 0.2rem 0;
      border-top: 2px solid rgba(54, 52, 47, 0.3);
    }

    .dummy-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.5rem;
    }
    .dummy-row > label {
      color: var(--dark2);
      font-weight: 600;
      white-space: nowrap;
    }

    .dummy-select,
    .dummy-input {
      flex: 1;
      min-width: 0;
      box-sizing: border-box;
      background: var(--dark2);
      color: var(--light2);
      border: 1px solid rgba(255, 255, 255, 0.2);
      border-radius: 0.3rem;
      font-family: inherit;
      font-size: 0.85rem;
      padding: 0.3rem 0.4rem;
    }
    .dummy-input { flex: 0 0 4rem; text-align: center; }
    .dummy-select:focus,
    .dummy-input:focus { outline: 1px solid var(--light1); }

    /* 下拉框文字水平居中 */
    .dummy-select { text-align: center; text-align-last: center; }

    /* 下拉选项：基础 / hover / 选中态，配色对齐 abilityTrainer 的 ability-trainer-combo-option */
    .dummy-select option {
      background: var(--dark2);
      color: var(--light2);
      padding: 0.35rem 0.4rem;
      text-align: center;
    }
    .dummy-select option:hover,
    .dummy-select option:focus {
      background: var(--light1);
      color: #fff;
    }
    .dummy-select option:checked,
    .dummy-select option:selected {
      background: rgb(90, 133, 113);
      color: #fff;
    }

    /* 属性下拉：闭合态背景 = 对应属性色、文字白色（配色取自游戏 returnTypeColor()） */
    .dummy-select.dummy-select-type {
      font-weight: bold;
      text-shadow: 0 1px 2px rgba(0, 0, 0, 0.45);
    }
    .dummy-select.dummy-select-type option {
      background: var(--dark2);
      color: var(--light2);
      font-weight: normal;
      text-shadow: none;
    }

    /* 等级滑动条：对齐 pokechillHelper 的 pokechill-helper-slider */
    .dummy-slider {
      flex: 1;
      min-width: 90px;
      accent-color: rgb(90, 133, 113);
      cursor: pointer;
    }

    /* 种族值星级 */
    .dummy-bst-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 0.35rem 0.6rem;
    }
    .dummy-bst-cell {
      display: flex;
      align-items: center;
      gap: 0.3rem;
    }
    .dummy-bst-cell > label {
      color: var(--dark2);
      font-weight: 600;
      min-width: 2.1rem;
      font-size: 0.82rem;
    }
    .dummy-bst-cell .dummy-select {
      flex: 1;
      padding: 0.18rem 0.25rem;
      font-size: 0.78rem;
    }

    /* 锁血开关按钮：对齐 pokechillHelper 的 pokechill-helper-autorejoin（左标签 + 右状态） */
    .dummy-lockhp-btn {
      width: 100%;
      display: flex;
      align-items: center;
      justify-content: space-between;
      text-align: left;
    }
    .dummy-lockhp-status { margin-left: auto; }

    .dummy-btn-row { display: flex; gap: 0.4rem; }

    .dummy-btn {
      flex: 1;
      background: var(--light1);
      color: var(--light2);
      border: 0;
      border-radius: 0.4rem;
      font-family: inherit;
      font-size: 0.9rem;
      white-space: nowrap;
      padding: 0.4rem 0.5rem;
      cursor: pointer;
      transition: filter 0.1s, background 0.1s, transform 0.05s;
    }
    .dummy-btn:hover { background: #685F4B; }
    .dummy-btn:active { transform: translateY(1px); }
    .dummy-btn.primary { background: rgb(90, 133, 113); }
    .dummy-btn.primary:hover { background: rgb(74, 114, 96); }
    /* 开关态：与 pokechillHelper 的 .pokechill-helper-btn.active 一致 */
    .dummy-btn.active {
      background: rgb(90, 133, 113);
      color: #fff;
    }
    .dummy-btn.active:hover { background: rgb(74, 114, 96); }

    .dummy-foot {
      margin-top: 0.2rem;
      font-size: 0.68rem;
      font-weight: bold;
      opacity: 0.7;
      text-align: center;
      pointer-events: none;
    }

    @media (max-width: 768px) {
      #dummy-config-panel {
        width: 92vw !important;
        font-size: 15px !important;
      }
      .dummy-select,
      .dummy-input {
        font-size: 16px !important;
        padding: 0.45rem !important;
      }
      .dummy-btn {
        padding: 0.6rem 0.5rem !important;
        font-size: 15px !important;
      }
      .dummy-bst-grid { grid-template-columns: 1fr; }
    }
  `;
  document.head.appendChild(style);
}

// ---------- 配置面板 ----------

// 监听 pkmn 编辑器（#pkmn-editor）关闭；当其由「配置技能」打开后关闭时，自动重新弹出配置面板
function setupEditorCloseWatcher(api) {
  if (editorCloseObserver) return;
  const editor = document.getElementById("pkmn-editor");
  if (!editor) return;
  editorCloseObserver = new MutationObserver(() => {
    if (editor.style.display === "none" && pendingReopenConfig) {
      pendingReopenConfig = false;
      openConfigPanel(api);   // 重新弹出配置面板，便于继续配置或点「确定」进入战斗
    }
  });
  editorCloseObserver.observe(editor, { attributes: true, attributeFilter: ["style"] });
}

// 生成属性下拉选项；withNone=true 时首项追加「无」（用于第二属性）
function typeOptionsHTML(withNone) {
  let html = withNone ? `<option value="">无</option>` : "";
  for (const [id, label] of DUMMY_TYPE_LIST) {
    html += `<option value="${id}">${label}</option>`;
  }
  return html;
}

// 生成 0-6 星下拉选项（沿用游戏「★」星级表述）
function starOptionsHTML(selected) {
  let html = "";
  for (let i = 0; i <= 6; i++) {
    html += `<option value="${i}" ${selected == i ? "selected" : ""}>${i}★</option>`;
  }
  return html;
}

// 属性配色：优先复用游戏 returnTypeColor()，不可用时回退到同色表
function typeColor(type) {
  if (typeof returnTypeColor === "function") {
    try { return returnTypeColor(type); } catch (e) { /* ignore */ }
  }
  return TYPE_FALLBACK_COLOR[type] || "#000000";
}

// 属性下拉框背景 = 该属性色、文字白色；属性为「无」时回退到样式表默认底色
function updateTypeSelectColor() {
  const ids = ["dummy-type1", "dummy-type2"];
  for (const id of ids) {
    const sel = document.getElementById(id);
    if (!sel) continue;
    if (!sel.value) {
      sel.style.backgroundColor = "";
      sel.style.color = "";
    } else {
      sel.style.backgroundColor = typeColor(sel.value);
      sel.style.color = "#fff";
    }
  }
}

// 锁血开关按钮（对齐 pokechillHelper「自动重开」按钮：左标签 + 右 ON/OFF 状态）
function setLockHp(on) {
  const btn = document.getElementById("dummy-lockhp");
  if (!btn) return;
  btn.dataset.on = on ? "1" : "0";
  btn.classList.toggle("active", !!on);
  const status = btn.querySelector(".dummy-lockhp-status");
  if (status) status.textContent = on ? "ON" : "OFF";
}

function getLockHp() {
  const btn = document.getElementById("dummy-lockhp");
  return btn ? btn.dataset.on === "1" : false;
}

// 等级取值钳制到 1-100
function clampLevel(v) {
  return Math.min(100, Math.max(1, Math.round(Number(v) || 1)));
}

function ensureConfigPanel(api) {
  if (document.getElementById("dummy-config-panel")) return;

  const panel = document.createElement("div");
  panel.id = "dummy-config-panel";
  // 视觉样式统一由 installPanelStyles() 注入的样式表提供，此处仅控制显隐
  panel.style.display = "none";

  const dummy = api.pkmn[DUMMY_PKMN_ID];
  const bst = dummy ? dummy.bst : { hp: 6, atk: 4, def: 2, satk: 4, sdef: 2, spe: 4 };

  panel.innerHTML = `
    <div class="dummy-panel-header">
      <span class="dummy-panel-title">🎯 测试木桩配置</span>
      <button type="button" id="dummy-panel-close" class="dummy-panel-close" title="关闭">✕</button>
    </div>
    <div class="dummy-panel-content">
      <div class="dummy-section-title">🎨 木桩属性</div>
      <div class="dummy-row">
        <label for="dummy-type1">第一属性</label>
        <select id="dummy-type1" class="dummy-select dummy-select-type">${typeOptionsHTML(false)}</select>
      </div>
      <div class="dummy-row">
        <label for="dummy-type2">第二属性</label>
        <select id="dummy-type2" class="dummy-select dummy-select-type">${typeOptionsHTML(true)}</select>
      </div>

      <div class="dummy-divider"></div>

      <div class="dummy-section-title">⭐ 种族值星级</div>
      <div class="dummy-bst-grid">
        ${DUMMY_BST_LIST.map(([key, label]) => `
        <div class="dummy-bst-cell">
          <label for="dummy-bst-${key}">${label}</label>
          <select id="dummy-bst-${key}" class="dummy-select">${starOptionsHTML(bst[key])}</select>
        </div>`).join("")}
      </div>

      <div class="dummy-divider"></div>

      <div class="dummy-section-title">📊 基础参数</div>
      <div class="dummy-row">
        <label for="dummy-level">等级</label>
        <input type="range" id="dummy-level-slider" class="dummy-slider" min="1" max="100" step="1" value="100">
        <input type="number" id="dummy-level" class="dummy-input" min="1" max="100" value="100">
      </div>
      <div class="dummy-btn-row">
        <button type="button" id="dummy-lockhp" class="dummy-btn dummy-lockhp-btn">
          <span>🔒 锁血</span><span class="dummy-lockhp-status">OFF</span>
        </button>
      </div>
      <div class="dummy-btn-row">
        <button type="button" id="dummy-config-skills" class="dummy-btn">⚙️ 配置技能</button>
      </div>

      <div class="dummy-divider"></div>

      <div class="dummy-btn-row">
        <button type="button" id="dummy-config-reset" class="dummy-btn">🔄 重　置</button>
      </div>
      <div class="dummy-btn-row">
        <button type="button" id="dummy-config-ok" class="dummy-btn primary">✔ 确定</button>
        <button type="button" id="dummy-config-cancel" class="dummy-btn">✕ 取消</button>
      </div>
      <div class="dummy-foot">配置木桩属性 / 星级 / 等级后开始测试</div>
    </div>
  `;

  document.body.appendChild(panel);

  const getDummy = () => api.pkmn?.[DUMMY_PKMN_ID];

  function updateBstFromUI() {
    const d = getDummy();
    if (!d) return;
    d.bst.hp = parseInt(document.getElementById("dummy-bst-hp").value, 10);
    d.bst.atk = parseInt(document.getElementById("dummy-bst-atk").value, 10);
    d.bst.def = parseInt(document.getElementById("dummy-bst-def").value, 10);
    d.bst.satk = parseInt(document.getElementById("dummy-bst-satk").value, 10);
    d.bst.sdef = parseInt(document.getElementById("dummy-bst-sdef").value, 10);
    d.bst.spe = parseInt(document.getElementById("dummy-bst-spe").value, 10);
  }

  function setBstToUI() {
    const d = getDummy();
    if (!d) return;
    document.getElementById("dummy-bst-hp").value = d.bst.hp;
    document.getElementById("dummy-bst-atk").value = d.bst.atk;
    document.getElementById("dummy-bst-def").value = d.bst.def;
    document.getElementById("dummy-bst-satk").value = d.bst.satk;
    document.getElementById("dummy-bst-sdef").value = d.bst.sdef;
    document.getElementById("dummy-bst-spe").value = d.bst.spe;
  }

  const updateType = () => {
    const type1 = document.getElementById("dummy-type1").value;
    const type2 = document.getElementById("dummy-type2").value;
    const d = getDummy();
    if (d) d.type = type2 ? [type1, type2] : [type1];
    updateTypeSelectColor();
  };
  document.getElementById("dummy-type1").addEventListener("change", updateType);
  document.getElementById("dummy-type2").addEventListener("change", updateType);

  // 等级：滑动条与数字输入框双向同步（步进 1）
  const levelInput = document.getElementById("dummy-level");
  const levelSlider = document.getElementById("dummy-level-slider");
  levelSlider.addEventListener("input", () => {
    levelInput.value = clampLevel(levelSlider.value);
  });
  levelInput.addEventListener("input", () => {
    levelSlider.value = clampLevel(levelInput.value);
  });
  levelInput.addEventListener("change", () => {
    const v = clampLevel(levelInput.value);
    levelInput.value = v;
    levelSlider.value = v;
  });

  // 锁血开关按钮：点击切换 ON/OFF
  document.getElementById("dummy-lockhp").addEventListener("click", () => {
    setLockHp(!getLockHp());
  });

  document.getElementById("dummy-config-skills").addEventListener("click", () => {
    ensureNoneAbility(api);
    updateType();
    const level = parseInt(document.getElementById("dummy-level").value, 10);
    const d = getDummy();
    if (!d) return;
    d.level = Math.min(100, Math.max(1, level));
    d.lockHp = getLockHp();
    updateBstFromUI();
    refreshDummyMovepool(api);
    panel.style.display = "none";
    if (!api.ability?.none) {
      api.ability.none = { id: "none", rename: "无", rarity: 1, type: ["all"], info: () => "没有任何效果。" };
    }
    if (typeof tooltipData === "function") {
      pendingReopenConfig = true;   // 标记：编辑器关闭后应自动重弹配置面板
      tooltipData("pkmnEditor", DUMMY_PKMN_ID);
    } else {
      alert("无法打开编辑器，请刷新页面重试。");
    }
  });

  document.getElementById("dummy-config-reset").addEventListener("click", () => {
    document.getElementById("dummy-type1").value = "normal";
    document.getElementById("dummy-type2").value = "";
    document.getElementById("dummy-level").value = 100;
    document.getElementById("dummy-level-slider").value = 100;
    setLockHp(true);
    updateTypeSelectColor();

    const d = getDummy();
    if (d) {
      d.type = ["normal"];
      d.level = 100;
      d.lockHp = true;
      d.bst = { hp: 6, atk: 4, def: 2, satk: 4, sdef: 2, spe: 4 };
      d.moves = { slot1: undefined, slot2: undefined, slot3: undefined, slot4: undefined };
    }
    setBstToUI();
    refreshDummyMovepool(api);
  });

  document.getElementById("dummy-config-ok").addEventListener("click", () => {
    const type1 = document.getElementById("dummy-type1").value;
    const type2 = document.getElementById("dummy-type2").value;
    const level = parseInt(document.getElementById("dummy-level").value, 10);
    const lockHp = getLockHp();

    const d = getDummy();
    if (!d) return;
    d.type = type2 ? [type1, type2] : [type1];
    d.level = Math.min(100, Math.max(1, level));
    d.lockHp = lockHp;
    d.playerHp = undefined;
    updateBstFromUI();

    panel.style.display = "none";

    if (api.saved) api.saved.currentAreaBuffer = DUMMY_AREA_ID;
    document.getElementById("preview-team-exit").style.display = "flex";
    document.getElementById("team-menu").style.zIndex = "50";
    document.getElementById("team-menu").style.display = "flex";
    document.getElementById("menu-button-parent").style.display = "none";
    updatePreviewTeam();
    afkSeconds = 0;
    document.getElementById("explore-menu").style.display = "none";
  });

  document.getElementById("dummy-config-cancel").addEventListener("click", () => {
    panel.style.display = "none";
  });

  // 标题栏 ×：等同取消（仅收起面板）
  document.getElementById("dummy-panel-close").addEventListener("click", () => {
    panel.style.display = "none";
  });
}

function openConfigPanel(api) {
  ensureConfigPanel(api);
  const panel = document.getElementById("dummy-config-panel");
  if (!panel) return;
  const d = api.pkmn?.[DUMMY_PKMN_ID];
  if (d) {
    document.getElementById("dummy-type1").value = d.type[0] || "normal";
    document.getElementById("dummy-type2").value = d.type[1] || "";
    document.getElementById("dummy-level").value = d.level;
    const lvSlider = document.getElementById("dummy-level-slider");
    if (lvSlider) lvSlider.value = clampLevel(d.level);
    setLockHp(!!d.lockHp);
    document.getElementById("dummy-bst-hp").value = d.bst.hp;
    document.getElementById("dummy-bst-atk").value = d.bst.atk;
    document.getElementById("dummy-bst-def").value = d.bst.def;
    document.getElementById("dummy-bst-satk").value = d.bst.satk;
    document.getElementById("dummy-bst-sdef").value = d.bst.sdef;
    document.getElementById("dummy-bst-spe").value = d.bst.spe;
  }
  updateTypeSelectColor();
  panel.style.display = "flex";
}
