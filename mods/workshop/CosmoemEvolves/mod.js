const MOD_ID = "cosmoemEvolves";
const ITEM_ID = "cosmogCandy";
const SHOP_ID = "shopCosmogCandy";
const REQUIRED_CANDY = 100;
const REMOVED_POKEMON = ["cosmog", "cosmoem"];
const TOOLTIP_PATCH = "__cosmoemEvolvesTooltipPatch";
let activeApi;
let activeState;
let saveTimer;
let originalTooltipData;

UltraMods.define({
  id: MOD_ID,
  name: "科斯莫姆进化",
  description: "商店中新增科斯莫古糖果，白天使用可使科斯莫姆进化为索尔迦雷欧，夜晚使用则进化为露奈雅拉。",
  image: "img/items/cosmogCandy.png",
  version: "1.4",
  author: "UltraPokechill",
  category: "进化",
  hooks: {
    onToggle(api, payload, state) {
      if (payload.enabled) install(api, state);
      else uninstall(api);
    },
    onRefresh(api, payload, state) {
      if (!api.isEnabled(MOD_ID)) return;
      install(api, state);
    },
    onItemTarget(api, payload, state) {
      if (payload.itemId !== ITEM_ID) return undefined;
      install(api, state);

      if (payload.pokemonId !== "cosmoem") return { hide: true };
      if ((api.pkmn?.cosmoem?.caught || 0) <= 0) return { hide: true };

      payload.element.addEventListener("click", () => showCandyMenu(api, state));
      return { handled: true };
    }
  }
});

function install(api, state) {
  if (!api.item || !api.shop || !api.pkmn) return;

  activeApi = api;
  activeState = state;
  normalizeState(api, state);
  installItem(api, state);
  installShopEntry(api);
  patchTooltipData(api);
  api.refreshGame();
}

function uninstall(api) {
  restoreTooltipData();
  if (api.shop) delete api.shop[SHOP_ID];
  if (api.item) delete api.item[ITEM_ID];
  api.refreshGame();
}

function patchTooltipData(api) {
  if (typeof tooltipData !== "function") return;
  if (tooltipData[TOOLTIP_PATCH]) return;

  originalTooltipData = tooltipData;

  const patched = function cosmoemEvolvesTooltipData(category, ttdata) {
    const result = originalTooltipData.apply(this, arguments);
    if (category === "pkmnEditor" && ttdata === "cosmoem") renderCosmoemUnlock(api);
    return result;
  };

  patched[TOOLTIP_PATCH] = true;
  patched.__cosmoemEvolvesOriginal = originalTooltipData;
  tooltipData = patched;
  window.tooltipData = patched;
}

function restoreTooltipData() {
  if (typeof tooltipData !== "function" || !tooltipData[TOOLTIP_PATCH]) return;
  const original = tooltipData.__cosmoemEvolvesOriginal || originalTooltipData;
  if (typeof original !== "function") return;
  tooltipData = original;
  window.tooltipData = original;
  originalTooltipData = undefined;
}

function renderCosmoemUnlock(api = activeApi) {
  const extra = document.getElementById("pkmn-editor-extra-info");
  if (!extra || !api?.pkmn) return;

  extra.querySelector("[data-cosmoem-evolves-unlock]")?.remove();

  const evolutionId = getCurrentCosmoemEvolutionId();
  const period = isDay() ? "白天(06:00 — 18:00)" : "夜晚(18:00 — 06:00)";
  const name = escapeHtml(api.formatName(evolutionId));
  const mark = (api.pkmn[evolutionId]?.caught || 0) > 0 ? "&#10004;" : "&#10060;";

  extra.insertAdjacentHTML(
    "beforeend",
    `<span data-cosmoem-evolves-unlock>在 ${period} 喂食 ${REQUIRED_CANDY} 个科斯莫古糖果  解锁 ${name} ${mark}</span>`
  );
}

function normalizeState(api, state) {
  if (!Number.isFinite(Number(state.owned))) state.owned = Number(api.item?.[ITEM_ID]?.got) || 0;
  if (!Number.isFinite(Number(state.consumed))) state.consumed = 0;

  state.owned = clamp(Math.floor(Number(state.owned) || 0), 0, 999999);
  state.consumed = clamp(Math.floor(Number(state.consumed) || 0), 0, REQUIRED_CANDY);
}

function installItem(api, state) {
  const existing = api.item[ITEM_ID] || {};

  api.item[ITEM_ID] = {
    ...existing,
    id: ITEM_ID,
    type: "key",
    sort: "key",
    usable: true,
    itemToUse: false,
    got: state.owned,
    newItem: existing.newItem || 0,
    subtitle: ` (喂食进度：${state.consumed} / ${REQUIRED_CANDY})`,
    effect() {
      showCandyMenu(api, state);
    },
    info() {
      return `使用时: 将科斯莫古糖果喂给科斯莫姆 (喂食进度：${state.consumed} / ${REQUIRED_CANDY})<br>喂食进度达到 ${REQUIRED_CANDY} 时，科斯莫姆会在<br>白天(06:00 — 18:00) 进化为 索尔迦雷欧<br>夜晚(18:00 — 06:00) 进化为 露奈雅拉`;
    }
  };
}

function showCandyMenu(api, state) {
  normalizeState(api, state);

  if ((api.item?.[ITEM_ID]?.got || 0) <= 0 || state.owned <= 0) {
    showMessage("你还没有 科斯莫古糖果");
    return;
  }

  if ((api.pkmn?.cosmoem?.caught || 0) <= 0) {
    showMessage("你需要有一只 科斯莫姆 才能使用");
    return;
  }

  const remaining = REQUIRED_CANDY - state.consumed;
  const maxUse = Math.max(1, Math.min(state.owned, api.item[ITEM_ID].got, remaining));
  const options = [1, 10, 25, maxUse]
    .map(amount => Math.min(amount, maxUse))
    .filter((amount, index, list) => amount > 0 && list.indexOf(amount) === index);

  const bottom = document.getElementById("tooltipBottom");
  const title = document.getElementById("tooltipTitle");
  const top = document.getElementById("tooltipTop");
  const mid = document.getElementById("tooltipMid");

  if (!bottom || !title || typeof window.openTooltip !== "function") {
    useCandy(api, state, maxUse);
    return;
  }

  if (top) top.style.display = "none";
  title.style.display = "inline";
  title.innerHTML = "科斯莫古糖果";
  if (mid) {
    mid.style.display = "inline";
    mid.innerHTML = `喂食进度：${state.consumed} / ${REQUIRED_CANDY}<br>背包里有 ${state.owned} 个`;
  }
  bottom.style.display = "inline";
  bottom.innerHTML = `
    <span style="display:flex; justify-content:center; width:100%; flex-wrap:wrap; gap:0.4rem">
      ${options.map(amount => {
        const label = amount === maxUse ? `Max x${amount}` : `x${amount}`;
        return `<div data-cosmog-candy="${amount}" style="cursor:pointer; font-size:1.6rem; min-width:5rem; padding:0.3rem 0.5rem">${label}</div>`;
      }).join("")}
    </span>
    <span id="prevent-tooltip-exit"></span>
  `;

  bottom.querySelectorAll("[data-cosmog-candy]").forEach(button => {
    button.addEventListener("click", () => useCandy(api, state, Number(button.dataset.cosmogCandy)));
  });

  window.openTooltip();
}

function installShopEntry(api) {
  api.shop[SHOP_ID] = {
    icon: ITEM_ID,
    name: "科斯莫古糖果",
    price: 3,
    currency: "bottleCap",
    category: "goods",
    effect() {
      giveCandy(1);
    }
  };
}

function giveCandy(amount) {
  if (!activeApi || !activeState) return;
  normalizeState(activeApi, activeState);

  activeState.owned += Math.max(1, Math.floor(Number(amount) || 1));
  installItem(activeApi, activeState);
  queueSave();
}

function useCandy(api, state, amount = 1) {
  normalizeState(api, state);

  if ((api.item?.[ITEM_ID]?.got || 0) <= 0 || state.owned <= 0) {
    showMessage("你还没有 科斯莫古糖果");
    return;
  }

  if ((api.pkmn?.cosmoem?.caught || 0) <= 0) {
    showMessage("你需要有一只 科斯莫姆 才能使用");
    return;
  }

  const quantity = Math.max(1, Math.min(
    Math.floor(Number(amount) || 1),
    state.owned,
    api.item[ITEM_ID].got,
    REQUIRED_CANDY - state.consumed
  ));

  state.owned -= quantity;
  state.consumed += quantity;
  installItem(api, state);

  if (state.consumed >= REQUIRED_CANDY) {
    evolveCosmoem(api, state);
    return;
  }

  api.refreshGame();
  api.save();
  updatePokedexSafe();
  if (state.owned <= 0 && typeof window.exitTmTeaching === "function") window.exitTmTeaching();
  showMessage(`科斯莫姆已食用 ${quantity} 个科斯莫古糖果 (喂食进度：${state.consumed} / ${REQUIRED_CANDY})`);
}

function evolveCosmoem(api, state) {
  const evolutionId = getCurrentCosmoemEvolutionId();
  const sourceWasShiny = api.pkmn?.cosmoem?.shiny === true;
  const targetWasCaught = Math.max(0, Math.floor(Number(api.pkmn?.[evolutionId]?.caught) || 0));
  const wasShiny = api.pkmn?.[evolutionId]?.shiny === true;
  const naturalShinyChance = getNaturalShinyChance(api);
  queueShinyEvolve(api, "cosmoem", evolutionId, sourceWasShiny);

  state.consumed = 0;
  installItem(api, state);
  removePokemonFromTeams(api, REMOVED_POKEMON);

  for (const id of REMOVED_POKEMON) {
    if (!api.pkmn?.[id]) continue;
    api.pkmn[id].caught = 0;
    api.pkmn[id].exp = 0;
    api.pkmn[id].level = 1;
  }

  api.givePkmn(evolutionId, 1);
  applyShinyEvolveCompatibility(api, evolutionId, sourceWasShiny, targetWasCaught);
  applyShinyCharmChance(api, evolutionId, wasShiny, naturalShinyChance);
  api.refreshGame();
  api.save();
  updatePokedexSafe();

  if (typeof window.exitTmTeaching === "function") window.exitTmTeaching();
  showMessage(`科斯莫姆 已进化为 ${api.formatName(evolutionId)}。科斯莫古 与 科斯莫姆 已移除。`);
}

function queueShinyEvolve(api, sourceId, targetId, sourceWasShiny) {
  if (sourceWasShiny !== true || api.isEnabled?.("shinyEvolve") !== true) return false;
  return window.UltraShinyEvolve?.queueEvolution?.(sourceId, targetId, true, MOD_ID) === true;
}

function applyShinyEvolveCompatibility(api, targetId, sourceWasShiny, targetWasCaught) {
  if (sourceWasShiny !== true || api.isEnabled?.("shinyEvolve") !== true) return;
  if (targetWasCaught > 0 || api.pkmn?.[targetId]?.shiny === true) return;

  api.pkmn[targetId].shiny = true;
  api.pkmn[targetId].shinyDisabled = undefined;
}

function applyShinyCharmChance(api, pokemonId, wasShiny, targetChance) {
  if (wasShiny || api.pkmn?.[pokemonId]?.shiny === true) return;

  const baseChance = 1 / 400;
  if (targetChance <= baseChance) return;

  const extraChance = clamp((targetChance - baseChance) / (1 - baseChance), 0, 1);
  if (Math.random() < extraChance) api.pkmn[pokemonId].shiny = true;
}

function getNaturalShinyChance(api) {
  let chance = 1 / 400;
  const charm = api.item?.shinyCharm;
  if (!charm) return chance;

  for (const slot of getCharmSlots(api)) {
    if (slot?.item !== charm.id) continue;
    const power = typeof charm.power === "function" ? Number(charm.power()) || 0 : 0;
    chance *= (power / 100) + 1;
  }

  return clamp(chance, 0, 1);
}

function getCharmSlots(api) {
  const runtimeTeam = api.team || {};
  const runtimeSlots = Object.values(runtimeTeam).filter(slot => slot?.pkmn);
  if (runtimeSlots.length > 0) return runtimeSlots;

  const preview = api.saved?.previewTeams?.[api.saved?.currentPreviewTeam] || {};
  return Object.values(preview);
}

function removePokemonFromTeams(api, ids) {
  const removeSet = new Set(ids);
  const previewTeams = api.saved?.previewTeams || {};

  for (const teamId in previewTeams) {
    for (const slot in previewTeams[teamId]) {
      if (!removeSet.has(previewTeams[teamId][slot]?.pkmn)) continue;
      previewTeams[teamId][slot].pkmn = undefined;
      previewTeams[teamId][slot].item = undefined;
    }
  }

  for (const slot in api.team || {}) {
    if (!removeSet.has(api.team[slot]?.pkmn?.id)) continue;
    api.team[slot].pkmn = undefined;
    api.team[slot].item = undefined;
  }
}

function isDay() {
  const hour = new Date().getHours();
  return hour >= 6 && hour < 18;
}

function getCurrentCosmoemEvolutionId() {
  return isDay() ? "solgaleo" : "lunala";
}

function updatePokedexSafe() {
  if (typeof window.updatePokedex === "function") window.updatePokedex();
  if (typeof window.updateItemBag === "function") window.updateItemBag();
}

function showMessage(message) {
  const bottom = document.getElementById("tooltipBottom");
  const title = document.getElementById("tooltipTitle");
  const top = document.getElementById("tooltipTop");
  const mid = document.getElementById("tooltipMid");

  if (!bottom || !title || typeof window.openTooltip !== "function") return;

  if (top) top.style.display = "none";
  if (mid) mid.style.display = "none";
  title.style.display = "inline";
  title.innerHTML = "科斯莫古糖果";
  bottom.style.display = "inline";
  bottom.innerHTML = `${escapeHtml(message)}<span id="prevent-tooltip-exit"></span>`;
  window.openTooltip();
}

function queueSave() {
  window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => {
    if (!activeApi) return;
    activeApi.save();
  }, 0);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
