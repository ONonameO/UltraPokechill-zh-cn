const MOD_ID = "betterDex";
const STYLE_ID = "better-dex-style";
const CONTROLS_ID = "better-dex-controls";
const MOVE_SELECT_ID = "better-dex-move-select";
const MOVE_SEARCH_ID = "better-dex-move-search";
const MOVE_SCOPE_ID = "better-dex-move-scope";
const CLEAR_BUTTON_ID = "better-dex-clear-move";
const STATUS_ID = "better-dex-status";
const UPDATE_PATCH = "__betterDexUpdatePatch";
const RESET_PATCH = "__betterDexResetPatch";

const runtime = {
  api: undefined,
  state: undefined,
  originalUpdatePokedex: undefined,
  originalResetPokedexFilters: undefined,
  applying: false,
  moveEntries: undefined
};

UltraMods.define({
  id: MOD_ID,
  name: "更好的图鉴",
  description: "在属性筛选中支持单属性匹配（可筛选包含该属性的所有宝可梦），并新增招式筛选功能，可按已装备或已习得的招式进行筛选。",
  image: "img/items/dex.png",
  version: "1.1",
  author: "UltraPokechill",
  category: "图鉴",
  hooks: {
    onToggle(api, payload, state) {
      if (payload.enabled) install(api, state);
      else uninstall();
    },
    onRefresh(api, payload, state) {
      if (api.isEnabled(MOD_ID)) install(api, state);
    }
  }
});

function install(api, state) {
  runtime.api = api;
  runtime.state = ensureState(state);
  installStyles();
  ensureControls();
  patchPokedex();
  patchResetFilters();
  refreshMoveOptions();
  applyBetterDexFilters();
}

function uninstall() {
  restorePokedex();
  restoreResetFilters();
  document.getElementById(CONTROLS_ID)?.remove();
  document.getElementById(STYLE_ID)?.remove();
  runtime.api = undefined;
  runtime.state = undefined;
  runtime.moveEntries = undefined;
  safeCall(() => { if (typeof updatePokedex === "function") updatePokedex(); });
}

function ensureState(state) {
  if (!state || typeof state !== "object") state = {};
  if (!state.moveScope) state.moveScope = "any";
  if (!state.moveSearch) state.moveSearch = "";
  if (!state.moveId) state.moveId = "";
  return state;
}

function installStyles() {
  if (document.getElementById(STYLE_ID)) return;

  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    #${CONTROLS_ID} {
      align-items: center;
      display: flex;
      flex-wrap: wrap;
      gap: 0.45rem;
      justify-content: center;
      width: 100%;
    }

    #${CONTROLS_ID} select,
    #${CONTROLS_ID} input {
      background: var(--dark1);
      border: 1px solid rgba(255,255,255,0.25);
      border-radius: 0.35rem;
      color: white;
      font-family: inherit;
      font-size: 0.95rem;
      height: 2rem;
      min-width: min(12rem, 100%);
      padding: 0 0.45rem;
    }

    #${CONTROLS_ID} button {
      background: rgb(155, 102, 77);
      border: 0;
      border-radius: 0.35rem;
      color: white;
      cursor: pointer;
      font-family: inherit;
      font-size: 0.95rem;
      height: 2rem;
      padding: 0 0.7rem;
    }

    #${CONTROLS_ID} button:hover,
    #${CONTROLS_ID} select:hover,
    #${CONTROLS_ID} input:hover,
    #${CONTROLS_ID} button:focus-visible,
    #${CONTROLS_ID} select:focus-visible,
    #${CONTROLS_ID} input:focus-visible {
      filter: brightness(1.16);
      outline: none;
    }

    #${STATUS_ID} {
      color: var(--light2);
      font-size: 0.85rem;
      line-height: 1.1;
      min-width: 8rem;
      text-align: center;
    }

    @media (max-width: 720px) {
      #${CONTROLS_ID} select,
      #${CONTROLS_ID} input,
      #${CONTROLS_ID} button {
        flex: 1 1 9rem;
        min-width: 0;
      }

      #${STATUS_ID} {
        flex: 1 1 100%;
      }
    }
  `;
  document.head.appendChild(style);
}

function ensureControls() {
  if (document.getElementById(CONTROLS_ID)) return;

  const filtersRow = document.querySelector(".pokedex-filters-menu > div:nth-of-type(3)");
  if (!filtersRow) return;

  const controls = document.createElement("div");
  controls.id = CONTROLS_ID;
  controls.innerHTML = `
    <select id="${MOVE_SCOPE_ID}">
      <option value="any">任意招式</option>
      <option value="equipped">已装备的招式</option>
      <option value="learned">已习得的招式</option>
    </select>
    <input id="${MOVE_SEARCH_ID}" type="text" placeholder="Search Move">
    <select id="${MOVE_SELECT_ID}">
      <option value="">move</option>
    </select>
    <button id="${CLEAR_BUTTON_ID}" type="button">清除招式</button>
    <span id="${STATUS_ID}"></span>
  `;

  filtersRow.appendChild(controls);

  const scope = document.getElementById(MOVE_SCOPE_ID);
  const search = document.getElementById(MOVE_SEARCH_ID);
  const select = document.getElementById(MOVE_SELECT_ID);
  const clear = document.getElementById(CLEAR_BUTTON_ID);

  scope.value = runtime.state.moveScope || "any";
  search.value = runtime.state.moveSearch || "";

  scope.addEventListener("change", () => {
    runtime.state.moveScope = scope.value || "any";
    persist();
    runPokedexUpdate();
  });

  search.addEventListener("input", () => {
    runtime.state.moveSearch = search.value || "";
    refreshMoveOptions();
    persist();
  });

  search.addEventListener("keydown", event => {
    if (event.key !== "Enter") return;
    const exact = findMoveByText(search.value);
    if (exact) {
      runtime.state.moveId = exact;
      refreshMoveOptions();
      persist();
      runPokedexUpdate();
    }
  });

  select.addEventListener("change", () => {
    runtime.state.moveId = select.value || "";
    persist();
    runPokedexUpdate();
  });

  clear.addEventListener("click", () => {
    runtime.state.moveId = "";
    runtime.state.moveSearch = "";
    search.value = "";
    refreshMoveOptions();
    persist();
    runPokedexUpdate();
  });
}

function patchPokedex() {
  if (typeof updatePokedex !== "function") return;
  if (updatePokedex[UPDATE_PATCH]) return;

  runtime.originalUpdatePokedex = updatePokedex;

  const patched = function betterDexUpdatePokedex() {
    const result = runtime.originalUpdatePokedex.apply(this, arguments);
    if (!runtime.applying) applyBetterDexFilters();
    return result;
  };

  patched[UPDATE_PATCH] = true;
  patched.__betterDexOriginal = runtime.originalUpdatePokedex;
  updatePokedex = patched;
  window.updatePokedex = patched;
}

function restorePokedex() {
  if (typeof updatePokedex !== "function" || !updatePokedex[UPDATE_PATCH]) return;
  const original = updatePokedex.__betterDexOriginal || runtime.originalUpdatePokedex;
  if (typeof original !== "function") return;
  updatePokedex = original;
  window.updatePokedex = original;
  runtime.originalUpdatePokedex = undefined;
}

function patchResetFilters() {
  if (typeof resetPokedexFilters !== "function") return;
  if (resetPokedexFilters[RESET_PATCH]) return;

  runtime.originalResetPokedexFilters = resetPokedexFilters;

  const patched = function betterDexResetPokedexFilters() {
    const result = runtime.originalResetPokedexFilters.apply(this, arguments);
    clearMoveFilterState();
    refreshMoveOptions();
    return result;
  };

  patched[RESET_PATCH] = true;
  patched.__betterDexOriginal = runtime.originalResetPokedexFilters;
  resetPokedexFilters = patched;
  window.resetPokedexFilters = patched;
}

function restoreResetFilters() {
  if (typeof resetPokedexFilters !== "function" || !resetPokedexFilters[RESET_PATCH]) return;
  const original = resetPokedexFilters.__betterDexOriginal || runtime.originalResetPokedexFilters;
  if (typeof original !== "function") return;
  resetPokedexFilters = original;
  window.resetPokedexFilters = original;
  runtime.originalResetPokedexFilters = undefined;
}

function clearMoveFilterState() {
  if (!runtime.state) return;
  runtime.state.moveId = "";
  runtime.state.moveSearch = "";
  runtime.state.moveScope = "any";

  const scope = document.getElementById(MOVE_SCOPE_ID);
  const search = document.getElementById(MOVE_SEARCH_ID);
  if (scope) scope.value = "any";
  if (search) search.value = "";
  persist();
}

function refreshMoveOptions() {
  const select = document.getElementById(MOVE_SELECT_ID);
  if (!select) return;

  const moves = getMoveEntries();
  const searchText = String(runtime.state?.moveSearch || "").trim().toLowerCase();
  const currentMove = runtime.state?.moveId || "";
  const optionsKey = `${searchText}|${currentMove}|${moves.length}`;

  if (select.dataset.betterDexOptionsKey === optionsKey) {
    if (select.value !== currentMove) select.value = currentMove;
    return;
  }

  const filtered = searchText
    ? moves.filter(entry => entry.label.toLowerCase().includes(searchText) || entry.id.toLowerCase().includes(searchText))
    : moves;

  select.innerHTML = `<option value="">move</option>` + filtered.map(entry => (
    `<option value="${escapeAttr(entry.id)}">${escapeHtml(entry.label)}</option>`
  )).join("");

  if (currentMove && filtered.some(entry => entry.id === currentMove)) select.value = currentMove;
  else if (currentMove && getMove(currentMove)) {
    const entry = { id: currentMove, label: formatName(currentMove) };
    select.insertAdjacentHTML("beforeend", `<option value="${escapeAttr(entry.id)}">${escapeHtml(entry.label)}</option>`);
    select.value = currentMove;
  }

  select.dataset.betterDexOptionsKey = optionsKey;
}

function applyBetterDexFilters() {
  const list = document.getElementById("pokedex-list");
  if (!list) return;

  ensureControls();
  refreshMoveOptions();

  const cards = Array.from(list.querySelectorAll("[data-pkmn-editor]"));
  if (cards.length === 0) {
    updateStatus(0, false, false);
    return;
  }

  runtime.applying = true;
  try {
    const useMonotype = isDuplicateTypeFilterActive();
    const useMove = Boolean(runtime.state?.moveId);
    let shown = 0;

    for (const card of cards) {
      const id = card.dataset.pkmnEditor;
      const pokemon = getPokemon(id);
      const visible = Boolean(pokemon)
        && (!useMonotype || isMatchingMonotype(pokemon))
        && (!useMove || hasRequestedMove(pokemon, runtime.state.moveId, runtime.state.moveScope));

      if (!visible) {
        card.remove();
        continue;
      }
      shown++;
    }

    updateStatus(shown, useMonotype, useMove);
  } finally {
    runtime.applying = false;
  }
}

function isDuplicateTypeFilterActive() {
  const first = document.getElementById("pokedex-filter-type")?.value;
  const second = document.getElementById("pokedex-filter-type-2")?.value;
  return Boolean(first && second && first !== "all" && first === second);
}

function isMatchingMonotype(pokemon) {
  const type = document.getElementById("pokedex-filter-type")?.value;
  return Array.isArray(pokemon?.type) && pokemon.type.length === 1 && pokemon.type[0] === type;
}

function hasRequestedMove(pokemon, moveId, scope = "any") {
  if (!moveId) return true;

  const equipped = Object.values(pokemon?.moves || {}).includes(moveId);
  const learned = Array.isArray(pokemon?.movepool) && pokemon.movepool.includes(moveId);
  const memory = Array.isArray(pokemon?.movepoolMemory) && pokemon.movepoolMemory.includes(moveId);

  if (scope === "equipped") return equipped;
  if (scope === "learned") return learned || memory;
  return equipped || learned || memory;
}

function updateStatus(shown, useMonotype, useMove) {
  if (!useMonotype && !useMove) return;
  const total = document.getElementById("pokedex-total");
  if (!total) return;

  // 参考原版图鉴的写法，但 totalPokemon 统计「符合当前全部筛选条件的宝可梦总数」
  // （包含尚未捕捉的），gotPokemon 为其中已捕获的数量
  const { totalPokemon, gotPokemon } = getFilteredDexCounts();
  total.style.display = "flex";
  if (gotPokemon === totalPokemon) {
    // 与原版图鉴一致：全部捕获完成时显示金色背景 + 奖杯图标
    total.style.background = "rgba(187, 146, 85, 1)";
    total.innerHTML = `已捕捉: ${gotPokemon} / ${totalPokemon} <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48"><defs><mask id="SVGBetterDexTrophy"><g fill="none" stroke="#fff" stroke-linecap="round" stroke-linejoin="round" stroke-width="4"><path d="M8 44h8m-4 0V4"/><path fill="#555555" d="M40 6H12v16h28l-4-8z"/></g></mask></defs><path fill="currentColor" d="M0 0h48v48H0z" mask="url(#SVGBetterDexTrophy)"/></svg>`;
  } else {
    total.style.background = "rgba(91, 114, 163, 1)";
    total.textContent = `已捕捉: ${gotPokemon} / ${totalPokemon}`;
  }
}

function getMoveEntries() {
  if (runtime.moveEntries) return runtime.moveEntries;

  const moves = runtime.api?.move || readGlobal("move") || {};
  runtime.moveEntries = Object.keys(moves)
    .filter(id => getMove(id)?.id === id)
    .map(id => ({ id, label: formatName(id) }))
    .sort((left, right) => left.label.localeCompare(right.label));

  return runtime.moveEntries;
}

function getMove(id) {
  const moves = runtime.api?.move || readGlobal("move") || {};
  return id ? moves[id] : undefined;
}

function getPokemon(id) {
  const allPokemon = runtime.api?.pkmn || readGlobal("pkmn") || {};
  return id ? allPokemon[id] : undefined;
}

// 读取原版图鉴当前所有筛选控件的值
function readPokedexFilters() {
  const val = id => {
    const el = document.getElementById(id);
    return el ? el.value : "all";
  };
  return {
    type1: val("pokedex-filter-type"),
    type2: val("pokedex-filter-type-2"),
    level: val("pokedex-filter-level"),
    ability: val("pokedex-filter-ability"),
    evolution: val("pokedex-filter-evolution"),
    division: val("pokedex-filter-division"),
    ribbon: val("pokedex-filter-ribbon"),
    signature: val("pokedex-filter-signature"),
    shiny: val("pokedex-filter-shiny"),
    search: (val("pokedex-search") || "").trim().toLowerCase()
  };
}

// 安全读取原版图鉴内部的全局对象/函数（缺失时返回 undefined，绝不抛出）
function safeGlobal(name) {
  try {
    return readGlobal(name);
  } catch (error) {
    return undefined;
  }
}

// 安全调用可能抛错的全局函数，失败时回退为 fallback（避免筛选逻辑崩溃影响界面）
function safeCallResult(callback, fallback) {
  try {
    return callback();
  } catch (error) {
    return fallback;
  }
}

// 判断某只宝可梦是否符合原版图鉴的全部筛选条件（与原版 updatePokedex 的过滤逻辑保持一致）
function matchesOriginalFilters(pokemon, id, f) {
  // 属性筛选（type1 / type2 任一需包含该属性）
  if (f.type1 !== "all" && !(Array.isArray(pokemon.type) && pokemon.type.includes(f.type1))) return false;
  if (f.type2 !== "all" && !(Array.isArray(pokemon.type) && pokemon.type.includes(f.type2))) return false;

  // 等级区间筛选
  if (f.level !== "all") {
    const lv = Number(f.level);
    if (!(pokemon.level <= lv && pokemon.level >= lv - 19)) return false;
  }

  // 特性稀有度筛选
  if (f.ability !== "all") {
    const abilityData = safeGlobal("ability") || {};
    let pkmnAbility = pokemon.ability;
    if (pkmnAbility == null) {
      const learnFn = safeGlobal("learnPkmnAbility");
      if (typeof learnFn === "function") pkmnAbility = safeCallResult(() => learnFn(pokemon.id), undefined);
    }
    if (f.ability !== "4") {
      if (abilityData[pkmnAbility]?.rarity !== f.ability) return false;
    } else {
      if (pokemon.hiddenAbilityUnlocked === true || pokemon.hiddenAbility == null) return false;
    }
  }

  // 进化筛选
  if (f.evolution !== "all") {
    let missingEvolution = false;
    let missingLevelEvolution = false;
    if (typeof pokemon.evolve === "function") {
      const evos = safeCallResult(() => pokemon.evolve(), {}) || {};
      for (const evo in evos) {
        if (evos[evo]?.pkmn?.caught === 0) {
          missingEvolution = true;
          if (evos[evo]?.level !== undefined) missingLevelEvolution = true;
        }
      }
    }
    if (!missingEvolution) return false;
    if (f.evolution === "level-only" && !missingLevelEvolution) return false;
  }

  // 分部筛选
  if (f.division !== "all") {
    const fn = safeGlobal("returnPkmnDivision");
    if (typeof fn === "function" && safeCallResult(() => fn(pokemon), null) !== f.division) return false;
  }

  // 绶带筛选
  if (f.ribbon !== "all" && pokemon.ribbons == null) return false;

  // 招牌 / 蛋招式筛选
  if (f.signature === "false" && pokemon.signature == null) return false;
  if (f.signature === "egg" && pokemon.eggMove == null) return false;

  // 异色筛选
  if (f.shiny === "true" && pokemon.shiny !== true) return false;
  if (f.shiny === "false" && pokemon.shiny === true) return false;
  if (f.shiny === "sign" || f.shiny === "signall") {
    const fn = safeGlobal("giveStarsign");
    if (typeof fn === "function") {
      const res = safeCallResult(() => fn(String(id), "check"), "incomplete");
      if (f.shiny === "sign" && (pokemon.starsignList == null || pokemon.shiny !== true || res === "complete")) return false;
      if (f.shiny === "signall" && res !== "complete") return false;
    }
  }

  // 搜索筛选：名称 / 特性 / 隐藏特性 / 招式池 子串匹配（家族展开为尽力而为）
  if (f.search !== "") {
    const t = f.search;
    const name = String(pokemon.name != null ? pokemon.name : id).toLowerCase();
    let hit = name.includes(t);
    if (!hit && pokemon.ability && String(pokemon.ability).toLowerCase().includes(t)) hit = true;
    if (!hit && pokemon.hiddenAbility && pokemon.hiddenAbility.id && String(pokemon.hiddenAbility.id).toLowerCase().includes(t)) hit = true;
    if (!hit && Array.isArray(pokemon.movepool) && pokemon.movepool.some(m => String(m).toLowerCase().includes(t))) hit = true;
    if (!hit) {
      const famFn = safeGlobal("getEvolutionFamily");
      if (typeof famFn === "function") {
        const fam = safeCallResult(() => famFn(pokemon), []) || [];
        if (fam.some(member => member && String(member.name != null ? member.name : member.id).toLowerCase().includes(t))) hit = true;
      }
    }
    if (!hit) return false;
  }

  return true;
}

function getFilteredDexCounts() {
  const allPokemon = runtime.api?.pkmn || readGlobal("pkmn") || {};
  const filters = readPokedexFilters();
  const useMonotype = isDuplicateTypeFilterActive();
  const useMove = Boolean(runtime.state?.moveId);
  const moveId = runtime.state?.moveId || "";
  const moveScope = runtime.state?.moveScope || "any";

  let totalPokemon = 0;
  let gotPokemon = 0;
  for (const id in allPokemon) {
    const pokemon = allPokemon[id];
    if (!pokemon || typeof pokemon !== "object") continue;
    // 与原版图鉴一致：未获取且标记为不可获得的宝可梦不计入图鉴总量
    if (pokemon.caught === 0 && pokemon.tagObtainedIn === "unobtainable") continue;
    // 同时满足原版图鉴的全部筛选条件（逻辑与）
    if (!matchesOriginalFilters(pokemon, id, filters)) continue;
    // 同时满足 betterDex 的筛选条件（单属性 / 招式）
    if (useMonotype && !isMatchingMonotype(pokemon)) continue;
    if (useMove && !hasRequestedMove(pokemon, moveId, moveScope)) continue;
    totalPokemon++;
    if (pokemon.caught > 0) gotPokemon++;
  }
  return { totalPokemon, gotPokemon };
}

function findMoveByText(value) {
  const needle = String(value || "").trim().toLowerCase();
  if (!needle) return "";

  const exact = getMoveEntries().find(entry => (
    entry.id.toLowerCase() === needle || entry.label.toLowerCase() === needle
  ));
  return exact?.id || "";
}

function runPokedexUpdate() {
  if (typeof updatePokedex === "function") updatePokedex();
  else applyBetterDexFilters();
}

function persist() {
  safeCall(() => runtime.api?.save?.());
}

function readGlobal(name) {
  try {
    return Function(`return typeof ${name} === "undefined" ? undefined : ${name}`)();
  } catch (error) {
    return undefined;
  }
}

function formatName(id) {
  if (runtime.api?.formatName) return runtime.api.formatName(id);
  if (typeof format === "function") return format(id);
  return String(id || "");
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function escapeAttr(value) {
  return escapeHtml(value);
}

function safeCall(callback) {
  try {
    callback();
  } catch (error) {
    console.warn("[Better Dex] operation failed", error);
  }
}
