const MOD_ID = "pokechillDummy";
const DUMMY_PKMN_ID = "custom_dummy_pkmn";
const DUMMY_AREA_ID = "custom_dummy_area";
const DUMMY_AREA_NAME = "木桩测试 (可配置)";
const DUMMY_SPRITE_URL = "mods/customDummyIcon.png";

let activeApi = null;
let imgErrorHandler = null;
let originalUpdateVS = null;
const VS_PATCH = "__pokechillDummyVsPatch";

UltraMods.define({
  id: MOD_ID,
  name: "Pokechill 自定义木桩",
  description: "基于 UltraMods API 构建自定义木桩训练区：可配置属性/等级/技能的木桩，支持锁血，用于测试配队与伤害。由 mod 管理器独立启用或禁用。",
  image: "mods/customDummyIcon.png",
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
    // 战斗开始（entering dummy area）：确保满血（锁血基础行为）
    onCombatStart(api, payload, state) {
      if (payload?.areaId !== DUMMY_AREA_ID) return;
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
  registerDummyArea(api);      // 通过 UltraMods api.areas 注册木桩区域（原生 setWildPkmn 会自动生成）
  patchUpdateVS(api);          // 带标记 + 可还原的卡片注入（无对应钩子时的既范式）
  setupImageErrorHandler(api);
  addMobileStyles();
  ensureConfigPanel(api);

  api.refreshGame();
}

function uninstall(api) {
  if (api.pkmn) delete api.pkmn[DUMMY_PKMN_ID];
  if (api.areas) delete api.areas[DUMMY_AREA_ID];
  removeImageErrorHandler();
  restoreUpdateVS();
  document.getElementById("dummy-config-panel")?.remove();
  document.getElementById("dummy-vs-card")?.remove();
  document.getElementById("dummy-mobile-style")?.remove();
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
    rename: "DUCK",
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
  api.areas[DUMMY_AREA_ID] = {
    name: DUMMY_AREA_NAME,
    background: "gym",
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
  // 移除原生为木桩区域渲染的占位卡片（非首张会被置灰为 ???）
  const baseName = document.getElementById("trainer-name-" + DUMMY_AREA_NAME);
  if (baseName) {
    const baseCard = baseName.closest(".vs-card");
    if (baseCard) baseCard.remove();
  }
  // 已注入则跳过（避免 updateVS 重复渲染导致重复注入）
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
  listing.appendChild(card);
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

// ---------- 移动端适配样式 ----------

function addMobileStyles() {
  if (document.getElementById("dummy-mobile-style")) return;
  const style = document.createElement("style");
  style.id = "dummy-mobile-style";
  style.textContent = `
    @media (max-width: 768px) {
      #dummy-config-panel {
        width: 95vw !important;
        min-width: unset !important;
        padding: 1rem !important;
        font-size: 14px !important;
      }
      #dummy-config-panel select,
      #dummy-config-panel input[type="number"] {
        font-size: 16px !important;
        padding: 0.5rem !important;
      }
      #dummy-config-panel button {
        padding: 0.8rem 1rem !important;
        font-size: 16px !important;
      }
      #dummy-config-panel .vs-card {
        max-width: 100% !important;
      }
      #dummy-config-panel [style*="grid-template-columns: repeat(2, 1fr)"] {
        gap: 0.8rem !important;
      }
      #dummy-config-panel > div > div[style*="justify-content:space-between"] {
        flex-direction: column;
        align-items: stretch !important;
        gap: 0.8rem;
      }
      #dummy-config-panel > div > div[style*="justify-content:space-between"] button {
        width: 100%;
      }
    }
  `;
  document.head.appendChild(style);
}

// ---------- 配置面板 ----------

function generateStarOptions(selected) {
  let options = "";
  for (let i = 0; i <= 6; i++) {
    options += `<option value="${i}" ${selected == i ? "selected" : ""}>${i}星</option>`;
  }
  return options;
}

function ensureConfigPanel(api) {
  if (document.getElementById("dummy-config-panel")) return;

  const panel = document.createElement("div");
  panel.id = "dummy-config-panel";
  panel.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: var(--light2, #ECDEB7);
    border: 2px solid var(--light1, #94886B);
    border-radius: 0.5rem;
    padding: 1.5rem;
    z-index: 10000;
    display: none;
    flex-direction: column;
    gap: 1rem;
    min-width: 350px;
    max-width: 90vw;
    max-height: 90vh;
    overflow-y: auto;
    color: var(--dark1, #36342F);
    font-family: 'Courier New', monospace;
    box-shadow: 0 0 20px rgba(0,0,0,0.5);
  `;

  const dummy = api.pkmn[DUMMY_PKMN_ID];
  const bst = dummy ? dummy.bst : { hp: 6, atk: 4, def: 2, satk: 4, sdef: 2, spe: 4 };

  panel.innerHTML = `
    <h3 style="margin:0; text-align:center;">配置木桩</h3>
    <div style="display:flex; flex-direction:column; gap:0.8rem;">
      <div>
        <label>第一属性:</label>
        <select id="dummy-type1" style="width:100%; padding:0.3rem;">
          <option value="normal">一般</option>
          <option value="fire">火</option>
          <option value="water">水</option>
          <option value="electric">电</option>
          <option value="grass">草</option>
          <option value="ice">冰</option>
          <option value="fighting">格斗</option>
          <option value="poison">毒</option>
          <option value="ground">地面</option>
          <option value="flying">飞行</option>
          <option value="psychic">超能力</option>
          <option value="bug">虫</option>
          <option value="rock">岩石</option>
          <option value="ghost">幽灵</option>
          <option value="dragon">龙</option>
          <option value="dark">恶</option>
          <option value="steel">钢</option>
          <option value="fairy">妖精</option>
        </select>
      </div>
      <div>
        <label>第二属性 (可选):</label>
        <select id="dummy-type2" style="width:100%; padding:0.3rem;">
          <option value="">无</option>
          <option value="normal">一般</option>
          <option value="fire">火</option>
          <option value="water">水</option>
          <option value="electric">电</option>
          <option value="grass">草</option>
          <option value="ice">冰</option>
          <option value="fighting">格斗</option>
          <option value="poison">毒</option>
          <option value="ground">地面</option>
          <option value="flying">飞行</option>
          <option value="psychic">超能力</option>
          <option value="bug">虫</option>
          <option value="rock">岩石</option>
          <option value="ghost">幽灵</option>
          <option value="dragon">龙</option>
          <option value="dark">恶</option>
          <option value="steel">钢</option>
          <option value="fairy">妖精</option>
        </select>
      </div>
      <div style="margin-top:0.5rem;">
        <label style="font-weight:bold;">种族值星级 (0-6星):</label>
        <div style="display:grid; grid-template-columns: repeat(2, 1fr); gap:0.5rem; margin-top:0.3rem;">
          <div><label>HP:</label> <select id="dummy-bst-hp" style="width:100%;">${generateStarOptions(bst.hp)}</select></div>
          <div><label>攻击:</label> <select id="dummy-bst-atk" style="width:100%;">${generateStarOptions(bst.atk)}</select></div>
          <div><label>防御:</label> <select id="dummy-bst-def" style="width:100%;">${generateStarOptions(bst.def)}</select></div>
          <div><label>特攻:</label> <select id="dummy-bst-satk" style="width:100%;">${generateStarOptions(bst.satk)}</select></div>
          <div><label>特防:</label> <select id="dummy-bst-sdef" style="width:100%;">${generateStarOptions(bst.sdef)}</select></div>
          <div><label>速度:</label> <select id="dummy-bst-spe" style="width:100%;">${generateStarOptions(bst.spe)}</select></div>
        </div>
      </div>
      <div>
        <label>等级 (1-100):</label>
        <input type="number" id="dummy-level" min="1" max="100" value="100" style="width:100%; padding:0.3rem;">
      </div>
      <div style="display:flex; align-items:center; gap:0.5rem; justify-content:space-between;">
        <div>
          <input type="checkbox" id="dummy-lockhp" checked>
          <label>锁血 (每回合回满)</label>
        </div>
        <button id="dummy-config-skills" style="background:#4CAF50; color:white; border:none; padding:0.5rem 1rem; border-radius:0.3rem; cursor:pointer;">⚙️ 配置技能</button>
      </div>
    </div>
    <div style="display:flex; gap:0.5rem; margin-top:1rem;">
      <button id="dummy-config-reset" style="background:var(--light1, #94886B); color:white; border:none; padding:0.5rem 1rem; border-radius:0.3rem; cursor:pointer; flex:1;">重置</button>
      <button id="dummy-config-ok" style="background:#4CAF50; color:white; border:none; padding:0.5rem 1rem; border-radius:0.3rem; cursor:pointer; flex:1;">确定</button>
      <button id="dummy-config-cancel" style="background:#f44336; color:white; border:none; padding:0.5rem 1rem; border-radius:0.3rem; cursor:pointer; flex:1;">取消</button>
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
  };
  document.getElementById("dummy-type1").addEventListener("change", updateType);
  document.getElementById("dummy-type2").addEventListener("change", updateType);

  document.getElementById("dummy-config-skills").addEventListener("click", () => {
    ensureNoneAbility(api);
    updateType();
    const level = parseInt(document.getElementById("dummy-level").value, 10);
    const d = getDummy();
    if (!d) return;
    d.level = Math.min(100, Math.max(1, level));
    d.lockHp = document.getElementById("dummy-lockhp").checked;
    updateBstFromUI();
    refreshDummyMovepool(api);
    panel.style.display = "none";
    if (!api.ability?.none) {
      api.ability.none = { id: "none", rename: "无", rarity: 1, type: ["all"], info: () => "没有任何效果。" };
    }
    if (typeof tooltipData === "function") {
      tooltipData("pkmnEditor", DUMMY_PKMN_ID);
    } else {
      alert("无法打开编辑器，请刷新页面重试。");
    }
  });

  document.getElementById("dummy-config-reset").addEventListener("click", () => {
    document.getElementById("dummy-type1").value = "normal";
    document.getElementById("dummy-type2").value = "";
    document.getElementById("dummy-level").value = 100;
    document.getElementById("dummy-lockhp").checked = true;

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
    const lockHp = document.getElementById("dummy-lockhp").checked;

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
    document.getElementById("dummy-lockhp").checked = !!d.lockHp;
    document.getElementById("dummy-bst-hp").value = d.bst.hp;
    document.getElementById("dummy-bst-atk").value = d.bst.atk;
    document.getElementById("dummy-bst-def").value = d.bst.def;
    document.getElementById("dummy-bst-satk").value = d.bst.satk;
    document.getElementById("dummy-bst-sdef").value = d.bst.sdef;
    document.getElementById("dummy-bst-spe").value = d.bst.spe;
  }
  panel.style.display = "flex";
}
