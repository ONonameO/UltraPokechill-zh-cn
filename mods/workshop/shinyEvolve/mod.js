const MOD_ID = "shinyEvolve";
const OLD_MOD_ID = "betterEvolves";
const GIVE_PATCH = "__shinyEvolveGivePatch";
const TRAINING_PATCH = "__shinyEvolveTrainingPatch";
const TEAM_EXP_PATCH = "__shinyEvolveTeamExpPatch";
const PUBLIC_API_FLAG = "__ultraShinyEvolveApi";
const PENDING_TIMEOUT = 10000;
const REPAIR_DELAYS = [0, 500, 1500, 4000, 9000];

const runtime = {
  api: undefined,
  enabled: false,
  originalGivePkmn: undefined,
  originalTrainingEffect: undefined,
  originalUpdateTeamExp: undefined,
  pending: undefined,
  pendingTimer: undefined,
  repairTimers: [],
  pokedexCapture: undefined,
  repairingTeam: false
};

UltraMods.define({
  id: MOD_ID,
  name: "闪光进化",
  description: "闪光宝可梦进化后仍保持闪光形态。",
  image: "img/items/shinyStone.png",
  version: "1.6",
  author: "UltraPokechill",
  category: "进化",
  hooks: {
    onToggle(api, payload) {
      if (payload.enabled) install(api);
      else uninstall();
    },
    onRefresh(api) {
      migrateOldEnabledFlag();
      if (api.isEnabled(MOD_ID)) install(api);
    }
  }
});

migrateOldEnabledFlag();

function install(api) {
  runtime.api = api;
  runtime.enabled = true;
  installPublicApi();
  patchGivePkmn();
  patchTraining();
  patchTeamExp();
  installPokedexCapture();
  scheduleRepairPasses();
}

function uninstall() {
  runtime.enabled = false;
  clearPending();
  clearRepairTimers();
  removePublicApi();
  removePokedexCapture();
  restoreTeamExp();
  restoreTraining();
  restoreGivePkmn();
}

function migrateOldEnabledFlag() {
  const savedData = readGlobal("saved");
  if (!savedData?.mods?.enabled) return;
  if (savedData.mods.enabled[OLD_MOD_ID] === true && savedData.mods.enabled[MOD_ID] !== true) {
    savedData.mods.enabled[MOD_ID] = true;
  }
}

function patchGivePkmn() {
  if (typeof givePkmn !== "function") return;
  if (givePkmn[GIVE_PATCH]) return;

  runtime.originalGivePkmn = givePkmn;

  const patched = function shinyEvolveGivePkmn(poke, level) {
    const targetId = getPokemonId(poke);
    const context = runtime.enabled
      ? consumeEvolutionContext(targetId) || inferLevelUpContext(targetId)
      : undefined;

    const result = runtime.originalGivePkmn.apply(this, arguments);

    if (runtime.enabled && context?.sourceWasShiny === true) {
      const target = getPokemon(targetId);
      if (target) {
        const changed = target.shiny !== true || target.shinyDisabled !== undefined;
        target.shiny = true;
        target.shinyDisabled = undefined;
        if (changed) refreshGameState();
        console.info(`[闪光进化] ${context.sourceId} 进化成 闪光${targetId}.`);
      }
    }

    return result;
  };

  patched[GIVE_PATCH] = true;
  patched.__shinyEvolveOriginal = runtime.originalGivePkmn;
  givePkmn = patched;
  window.givePkmn = patched;
}

function restoreGivePkmn() {
  if (typeof givePkmn !== "function" || !givePkmn[GIVE_PATCH]) return;
  const original = givePkmn.__shinyEvolveOriginal || runtime.originalGivePkmn;
  if (typeof original !== "function") return;
  givePkmn = original;
  window.givePkmn = original;
  runtime.originalGivePkmn = undefined;
}

function patchTraining() {
  const trainingData = readGlobal("training");
  const levelTraining = trainingData?.level;
  if (!levelTraining || typeof levelTraining.effect !== "function") return;
  if (levelTraining.effect[TRAINING_PATCH]) return;

  runtime.originalTrainingEffect = levelTraining.effect;

  const patched = function shinyEvolveTrainingEffect() {
    const sourceId = readGlobal("saved")?.trainingPokemon;
    if (runtime.enabled) {
      const source = getPokemon(sourceId);
      const targetId = source?.shiny === true ? findLevelEvolutionTarget(sourceId, 100) : undefined;
      if (targetId) queueEvolution(sourceId, targetId, true, "training");
    }

    const result = runtime.originalTrainingEffect.apply(this, arguments);
    if (runtime.enabled) repairSourceShinyEvolutions(sourceId, { refresh: true });
    return result;
  };

  patched[TRAINING_PATCH] = true;
  patched.__shinyEvolveOriginal = runtime.originalTrainingEffect;
  levelTraining.effect = patched;
}

function restoreTraining() {
  const trainingData = readGlobal("training");
  const levelTraining = trainingData?.level;
  if (!levelTraining || !levelTraining.effect?.[TRAINING_PATCH]) return;
  levelTraining.effect = levelTraining.effect.__shinyEvolveOriginal || runtime.originalTrainingEffect;
  runtime.originalTrainingEffect = undefined;
}

function patchTeamExp() {
  if (typeof updateTeamExp !== "function") return;
  if (updateTeamExp[TEAM_EXP_PATCH]) return;

  runtime.originalUpdateTeamExp = updateTeamExp;

  const patched = function shinyEvolveUpdateTeamExp() {
    const result = runtime.originalUpdateTeamExp.apply(this, arguments);
    if (runtime.enabled && !runtime.repairingTeam) {
      runtime.repairingTeam = true;
      try {
        repairTeamShinyEvolutions();
      } finally {
        runtime.repairingTeam = false;
      }
    }
    return result;
  };

  patched[TEAM_EXP_PATCH] = true;
  patched.__shinyEvolveOriginal = runtime.originalUpdateTeamExp;
  updateTeamExp = patched;
  window.updateTeamExp = patched;
}

function restoreTeamExp() {
  if (typeof updateTeamExp !== "function" || !updateTeamExp[TEAM_EXP_PATCH]) return;
  const original = updateTeamExp.__shinyEvolveOriginal || runtime.originalUpdateTeamExp;
  if (typeof original !== "function") return;
  updateTeamExp = original;
  window.updateTeamExp = original;
  runtime.originalUpdateTeamExp = undefined;
}

function installPokedexCapture() {
  if (runtime.pokedexCapture) return;

  runtime.pokedexCapture = function captureEvolutionClick(event) {
    if (!runtime.enabled) return;

    const card = event.target?.closest?.("#pokedex-list [data-pkmn-editor]");
    if (!card) return;

    const sourceId = card.dataset.pkmnEditor;
    const source = getPokemon(sourceId);
    if (!source || source.shiny !== true) return;

    const evoItemId = readGlobal("evoItemToUse");
    if (evoItemId) {
      const targetId = findItemEvolutionTarget(sourceId, evoItemId);
      if (targetId) queueEvolution(sourceId, targetId, true, "item");
      return;
    }

    const itemToUse = readGlobal("itemToUse");
    const rareCandy = readGlobal("item")?.rareCandy;
    if (itemToUse && rareCandy && itemToUse === rareCandy.id) {
      const targetId = findLevelEvolutionTarget(sourceId, Math.min(100, getLevel(source) + 1));
      if (targetId) queueEvolution(sourceId, targetId, true, "rareCandy");
      scheduleSourceRepair(sourceId);
    }
  };

  document.addEventListener("click", runtime.pokedexCapture, true);
}

function removePokedexCapture() {
  if (!runtime.pokedexCapture) return;
  document.removeEventListener("click", runtime.pokedexCapture, true);
  runtime.pokedexCapture = undefined;
}

function queueEvolution(sourceId, targetId, sourceWasShiny, method) {
  if (!sourceId || !targetId || sourceId === targetId) return;
  clearPending();
  runtime.pending = {
    sourceId,
    targetId,
    sourceWasShiny: sourceWasShiny === true,
    method,
    expiresAt: Date.now() + PENDING_TIMEOUT
  };
  runtime.pendingTimer = window.setTimeout(() => {
    if (runtime.pending?.sourceId === sourceId && runtime.pending?.targetId === targetId) {
      runtime.pending = undefined;
    }
  }, PENDING_TIMEOUT + 100);
}

function clearPending() {
  if (runtime.pendingTimer) window.clearTimeout(runtime.pendingTimer);
  runtime.pendingTimer = undefined;
  runtime.pending = undefined;
}

function scheduleRepairPasses() {
  clearRepairTimers();
  runtime.repairTimers = REPAIR_DELAYS.map(delay => window.setTimeout(() => {
    if (runtime.enabled) repairCaughtShinyEvolutions();
  }, delay));
}

function scheduleSourceRepair(sourceId) {
  for (const delay of [0, 80, 300]) {
    runtime.repairTimers.push(window.setTimeout(() => {
      if (runtime.enabled) repairSourceShinyEvolutions(sourceId, { refresh: true });
    }, delay));
  }
}

function clearRepairTimers() {
  for (const timer of runtime.repairTimers) window.clearTimeout(timer);
  runtime.repairTimers = [];
}

function installPublicApi() {
  window.UltraShinyEvolve = {
    [PUBLIC_API_FLAG]: true,
    queueEvolution(sourceId, targetId, sourceWasShiny, method = "custom") {
      if (!runtime.enabled || !sourceId || !targetId) return false;
      queueEvolution(sourceId, targetId, sourceWasShiny === true, method);
      return true;
    },
    repairShinyEvolution(sourceId) {
      if (!runtime.enabled || !sourceId) return false;
      return repairSourceShinyEvolutions(sourceId, { refresh: true });
    }
  };
}

function removePublicApi() {
  if (window.UltraShinyEvolve?.[PUBLIC_API_FLAG]) delete window.UltraShinyEvolve;
}

function consumeEvolutionContext(targetId) {
  const pending = runtime.pending;
  if (!pending) return undefined;

  if (Date.now() > pending.expiresAt) {
    clearPending();
    return undefined;
  }

  if (pending.targetId !== targetId) return undefined;
  clearPending();
  return pending;
}

function inferLevelUpContext(targetId) {
  if (!targetId) return undefined;

  const stack = getStack();
  const method = /updateTeamExp/i.test(stack)
    ? "battleLevelUp"
    : /bulkCandyUse\.mod|BulkCandyUse|bulk-candy/i.test(stack)
      ? "bulkCandyUse"
      : "";
  if (!method) return undefined;

  const sourceId = findLevelEvolutionSourceForTarget(targetId);
  const source = getPokemon(sourceId);
  if (!source || source.shiny !== true) return undefined;

  return { sourceId, targetId, sourceWasShiny: true, method };
}

function findLevelEvolutionSourceForTarget(targetId) {
  const allPokemon = readGlobal("pkmn");
  if (!allPokemon) return undefined;

  for (const sourceId in allPokemon) {
    const source = allPokemon[sourceId];
    if (getCaught(source) <= 0) continue;
    const evolutions = getLevelEvolutions(sourceId);
    if (evolutions.some(evolution => evolution.targetId === targetId && getLevel(source) >= evolution.requiredLevel)) {
      return sourceId;
    }
  }

  return undefined;
}

function findLevelEvolutionTarget(sourceId, nextLevel) {
  const evolutions = getLevelEvolutions(sourceId);
  return evolutions.find(evolution => (
    Number(nextLevel) >= evolution.requiredLevel &&
    getCaught(getPokemon(evolution.targetId)) <= 0
  ))?.targetId;
}

function getLevelEvolution(sourceId) {
  return getLevelEvolutions(sourceId)[0];
}

function getLevelEvolutions(sourceId) {
  const source = getPokemon(sourceId);
  if (!source || typeof source.evolve !== "function") return [];

  let evolutions;
  try {
    evolutions = source.evolve();
  } catch (error) {
    return [];
  }

  return Object.values(evolutions || {})
    .map(evolution => {
      const requiredLevel = Math.max(1, Math.floor(Number(evolution?.level) || 0));
      const targetId = evolution?.pkmn?.id;
      if (!targetId || requiredLevel <= 0 || !getPokemon(targetId)) return undefined;
      return { targetId, requiredLevel };
    })
    .filter(Boolean);
}

function findItemEvolutionTarget(sourceId, itemId) {
  const source = getPokemon(sourceId);
  if (!source || typeof source.evolve !== "function") return undefined;

  let evolutions;
  try {
    evolutions = source.evolve();
  } catch (error) {
    return undefined;
  }

  for (const key in evolutions) {
    const evolution = evolutions[key];
    const targetId = evolution?.pkmn?.id;
    if (!targetId || evolution?.item?.id !== itemId) continue;
    if (getCaught(getPokemon(targetId)) > 0) continue;
    if (getLevel(source) < getItemEvolutionLevel(itemId, targetId)) continue;
    return targetId;
  }

  return undefined;
}

function getItemEvolutionLevel(itemId, targetId) {
  let requiredLevel = Number(readGlobal("wildAreaLevel2")) || 1;
  if (itemId === "linkStone" || itemId === "oddRock") {
    requiredLevel = Number(readGlobal("wildAreaLevel4")) || requiredLevel;
  }
  if (String(targetId || "").slice(0, 4) === "mega") requiredLevel = 100;
  return Math.max(1, requiredLevel);
}

function repairCaughtShinyEvolutions() {
  const allPokemon = readGlobal("pkmn");
  if (!allPokemon) return;

  let repaired = false;

  for (const sourceId in allPokemon) {
    if (repairSourceShinyEvolutions(sourceId, { refresh: false })) repaired = true;
  }

  if (repaired) refreshGameState();
}

function repairTeamShinyEvolutions() {
  const currentTeam = readGlobal("team");
  if (!currentTeam) return false;

  let repaired = false;
  for (const slot in currentTeam) {
    const sourceId = currentTeam[slot]?.pkmn?.id;
    if (repairSourceShinyEvolutions(sourceId, { refresh: false })) repaired = true;
  }

  // updateTeamExp is already on the stack here. Refresh only the views that do
  // not call updateTeamExp again, otherwise the wrapper recursively re-enters
  // itself until the browser runs out of stack.
  if (repaired) refreshGameState({ skipTeamExp: true });
  return repaired;
}

function repairSourceShinyEvolutions(sourceId, options = {}) {
  const source = getPokemon(sourceId);
  if (!source || source.shiny !== true || getCaught(source) <= 0) return false;

  let repaired = false;
  const evolutions = getLevelEvolutions(sourceId);

  for (const evolution of evolutions) {
    if (getLevel(source) < evolution.requiredLevel) continue;

    const target = getPokemon(evolution.targetId);
    if (!target || getCaught(target) <= 0) continue;
    if (target.shiny === true && target.shinyDisabled === undefined) continue;

    target.shiny = true;
    target.shinyDisabled = undefined;
    repaired = true;
  }

  if (repaired && options.refresh === true) refreshGameState();
  return repaired;
}

function refreshGameState(options = {}) {
  if (options.skipTeamExp !== true) safeCall(() => runtime.api?.refreshGame?.());
  else {
    safeCall(() => { if (typeof updatePreviewTeam === "function") updatePreviewTeam(); });
    safeCall(() => { if (typeof updateTeamPkmn === "function") updateTeamPkmn(); });
  }
  safeCall(() => { if (typeof updatePokedex === "function") updatePokedex(); });
  safeCall(() => { if (typeof saveGame === "function") saveGame(); });
  safeCall(() => runtime.api?.persistMods?.());
}

function getPokemonId(value) {
  if (typeof value === "string") return value;
  return value?.id;
}

function getPokemon(id) {
  const allPokemon = readGlobal("pkmn");
  return id && allPokemon ? allPokemon[id] : undefined;
}

function getCaught(pokemon) {
  return Math.max(0, Math.floor(Number(pokemon?.caught) || 0));
}

function getLevel(pokemon) {
  return Math.max(1, Math.min(100, Math.floor(Number(pokemon?.level) || 1)));
}

function readGlobal(name) {
  try {
    return Function(`return typeof ${name} === "undefined" ? undefined : ${name}`)();
  } catch (error) {
    return undefined;
  }
}

function getStack() {
  try {
    throw new Error();
  } catch (error) {
    return String(error?.stack || "");
  }
}

function safeCall(callback) {
  try {
    callback();
  } catch (error) {
    console.warn("[闪光进化] 刷新失败", error);
  }
}
