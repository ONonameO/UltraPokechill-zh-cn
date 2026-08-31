const MOD_ID = "betterDex";
const STYLE_ID = "better-dex-style";
const CONTROLS_ID = "better-dex-controls";
const MOVE_SELECT_ID = "better-dex-move-select";
const MOVE_SEARCH_ID = "better-dex-move-search";
const MOVE_SCOPE_ID = "better-dex-move-scope";
const CLEAR_BUTTON_ID = "better-dex-clear-move";
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
      display: flex;
      justify-content: center;
      align-items: center;
      flex-wrap: wrap;
      gap: 0.5rem;
      width: 100%;
    }

    #${CONTROLS_ID} select,
    #${CONTROLS_ID} button,
    #${CONTROLS_ID} input {
      font-size: 1rem;
      padding: 0.2rem 0.5rem;
      background-color: var(--dark2);
      color: var(--light2);
      outline: none;
      border: none;
      border-radius: 10rem;
      white-space: nowrap;
    }

    #${CONTROLS_ID} #${MOVE_SCOPE_ID},
    #${CONTROLS_ID} #${CLEAR_BUTTON_ID} {
      width: auto;
      cursor: pointer;
    }
    
    #${CONTROLS_ID} input {
      width: 14.3rem;
      cursor: text;
    }

    #${CONTROLS_ID} #${MOVE_SELECT_ID} {
      width: 9rem;
    }

    #${CONTROLS_ID} #${CLEAR_BUTTON_ID} {
      background-color: rgb(155, 102, 77);
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
    <input id="${MOVE_SEARCH_ID}" type="text" placeholder="搜索招式...">
    <select id="${MOVE_SELECT_ID}">
      <option value="">move</option>
    </select>
    <button id="${CLEAR_BUTTON_ID}" type="button">清除招式</button>
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

  const needle = normalizeMoveToken(searchText);
  const filtered = needle
    ? moves.filter(entry => normalizeMoveToken(entry.id).includes(needle) || normalizeMoveToken(entry.name).includes(needle))
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
  total.style.display = "flex";
  total.style.background = "rgba(91, 114, 163, 1)";
  total.textContent = `Shown: ${shown}`;
}

function getMoveEntries() {
  if (runtime.moveEntries) return runtime.moveEntries;

  const moves = runtime.api?.move || readGlobal("move") || {};
  runtime.moveEntries = Object.keys(moves)
    .filter(id => getMove(id)?.id === id)
    // id  = 招式对象键（如 machPunk），是原版百科搜索所用的权威标识
    // name = 稳定的英文原名 rename（如 machPunch），不随中文 locale 变化，
    //        用于兼容中文插件把“音速拳”转回英文原名（Mach Punch）后的匹配
    // label = 展示用名称（formatName，可能为中文「音速拳」），仅用于显示，不参与匹配
    .map(id => ({ id, name: getMove(id)?.rename || id, label: formatName(id) }))
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

function findMoveByText(value) {
  const norm = normalizeMoveToken(value);
  if (!norm) return "";

  const exact = getMoveEntries().find(entry => (
    normalizeMoveToken(entry.id) === norm || normalizeMoveToken(entry.name) === norm
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

// 规范化招式匹配键：转小写并去除所有非字母数字字符，
// 使 "Mach Punch" / "machpunch" / "Mach-Punch" 等均能互相匹配（对齐百科按 id 模糊匹配的逻辑）
function normalizeMoveToken(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function safeCall(callback) {
  try {
    callback();
  } catch (error) {
    console.warn("[Better Dex] operation failed", error);
  }
}
