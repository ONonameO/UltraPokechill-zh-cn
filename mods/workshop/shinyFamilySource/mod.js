const MOD_ID = "shinyFamily";
const PATCH_KEY = "__shinyFamilyPatch";
const REPAIR_DELAYS = [0, 60, 300, 1200];

const runtime = {
  api: undefined,
  enabled: false,
  familyCache: undefined,
  cacheTime: 0,
  originalGivePkmn: undefined,
  originalLeaveCombat: undefined,
  originalUpdatePokedex: undefined,
  originalUpdateTeamExp: undefined,
  originalSaveGame: undefined,
  interval: undefined,
  timers: [],
  updateGuard: false,
  saveGuard: false
};

UltraMods.define({
  id: MOD_ID,
  name: "Shiny Family",
  description: "Makes every unlocked Pokemon in an evolution family shiny once any unlocked member of that family is shiny.",
  image: "img/items/shinyStone.png",
  version: "1.3",
  author: "UltraPokechill",
  category: "Evolution",
  hooks: {
    onToggle(api, payload) {
      if (payload.enabled) install(api);
      else uninstall();
    },
    onRefresh(api) {
      if (api.isEnabled(MOD_ID)) install(api);
    },
    afterEnemyDefeated(api) {
      if (!runtime.enabled) return;
      queueRepair("enemyDefeated");
    }
  }
});

function install(api) {
  runtime.api = api;
  runtime.enabled = true;
  rebuildFamilyCache();
  patchGivePkmn();
  patchLeaveCombat();
  patchUpdateTeamExp();
  patchUpdatePokedex();
  patchSaveGame();
  installInterval();
  queueRepair("install", true);
}

function uninstall() {
  runtime.enabled = false;
  clearTimers();
  clearIntervalRepair();
  restoreSaveGame();
  restoreUpdatePokedex();
  restoreUpdateTeamExp();
  restoreLeaveCombat();
  restoreGivePkmn();
  runtime.familyCache = undefined;
}

function patchGivePkmn() {
  if (typeof givePkmn !== "function" || givePkmn[PATCH_KEY]) return;

  runtime.originalGivePkmn = givePkmn;
  const patched = function shinyForeverGivePkmn(...args) {
    const result = runtime.originalGivePkmn.apply(this, args);
    if (runtime.enabled) {
      const id = getPokemonId(args[0]);
      repairFamilyFor(id, { refresh: true });
      queueRepair("givePkmn");
    }
    return result;
  };

  patched[PATCH_KEY] = true;
  patched.__shinyForeverOriginal = runtime.originalGivePkmn;
  givePkmn = patched;
  window.givePkmn = patched;
}

function restoreGivePkmn() {
  if (typeof givePkmn !== "function" || !givePkmn[PATCH_KEY]) return;
  const original = givePkmn.__shinyForeverOriginal || runtime.originalGivePkmn;
  if (typeof original !== "function") return;
  givePkmn = original;
  window.givePkmn = original;
  runtime.originalGivePkmn = undefined;
}

function patchLeaveCombat() {
  if (typeof leaveCombat !== "function" || leaveCombat[PATCH_KEY]) return;

  runtime.originalLeaveCombat = leaveCombat;
  const patched = function shinyForeverLeaveCombat(...args) {
    if (runtime.enabled) repairAllFamilies({ refresh: false });
    const result = runtime.originalLeaveCombat.apply(this, args);
    if (runtime.enabled) {
      repairAllFamilies({ refresh: true });
      updateAreaEndSprites();
      queueRepair("leaveCombat");
    }
    return result;
  };

  patched[PATCH_KEY] = true;
  patched.__shinyForeverOriginal = runtime.originalLeaveCombat;
  leaveCombat = patched;
  window.leaveCombat = patched;
}

function restoreLeaveCombat() {
  if (typeof leaveCombat !== "function" || !leaveCombat[PATCH_KEY]) return;
  const original = leaveCombat.__shinyForeverOriginal || runtime.originalLeaveCombat;
  if (typeof original !== "function") return;
  leaveCombat = original;
  window.leaveCombat = original;
  runtime.originalLeaveCombat = undefined;
}

function patchUpdateTeamExp() {
  if (typeof updateTeamExp !== "function" || updateTeamExp[PATCH_KEY]) return;

  runtime.originalUpdateTeamExp = updateTeamExp;
  const patched = function shinyForeverUpdateTeamExp(...args) {
    const result = runtime.originalUpdateTeamExp.apply(this, args);
    if (runtime.enabled) queueRepair("teamExp");
    return result;
  };

  patched[PATCH_KEY] = true;
  patched.__shinyForeverOriginal = runtime.originalUpdateTeamExp;
  updateTeamExp = patched;
  window.updateTeamExp = patched;
}

function restoreUpdateTeamExp() {
  if (typeof updateTeamExp !== "function" || !updateTeamExp[PATCH_KEY]) return;
  const original = updateTeamExp.__shinyForeverOriginal || runtime.originalUpdateTeamExp;
  if (typeof original !== "function") return;
  updateTeamExp = original;
  window.updateTeamExp = original;
  runtime.originalUpdateTeamExp = undefined;
}

function patchUpdatePokedex() {
  if (typeof updatePokedex !== "function" || updatePokedex[PATCH_KEY]) return;

  runtime.originalUpdatePokedex = updatePokedex;
  const patched = function shinyForeverUpdatePokedex(...args) {
    if (runtime.enabled && !runtime.updateGuard) {
      runtime.updateGuard = true;
      try {
        repairAllFamilies({ refresh: false });
      } finally {
        runtime.updateGuard = false;
      }
    }
    return runtime.originalUpdatePokedex.apply(this, args);
  };

  patched[PATCH_KEY] = true;
  patched.__shinyForeverOriginal = runtime.originalUpdatePokedex;
  updatePokedex = patched;
  window.updatePokedex = patched;
}

function restoreUpdatePokedex() {
  if (typeof updatePokedex !== "function" || !updatePokedex[PATCH_KEY]) return;
  const original = updatePokedex.__shinyForeverOriginal || runtime.originalUpdatePokedex;
  if (typeof original !== "function") return;
  updatePokedex = original;
  window.updatePokedex = original;
  runtime.originalUpdatePokedex = undefined;
}

function patchSaveGame() {
  if (typeof saveGame !== "function" || saveGame[PATCH_KEY]) return;

  runtime.originalSaveGame = saveGame;
  const patched = function shinyForeverSaveGame(...args) {
    if (runtime.enabled && !runtime.saveGuard) {
      runtime.saveGuard = true;
      try {
        repairAllFamilies({ refresh: false });
      } finally {
        runtime.saveGuard = false;
      }
    }
    return runtime.originalSaveGame.apply(this, args);
  };

  patched[PATCH_KEY] = true;
  patched.__shinyForeverOriginal = runtime.originalSaveGame;
  saveGame = patched;
  window.saveGame = patched;
}

function restoreSaveGame() {
  if (typeof saveGame !== "function" || !saveGame[PATCH_KEY]) return;
  const original = saveGame.__shinyForeverOriginal || runtime.originalSaveGame;
  if (typeof original !== "function") return;
  saveGame = original;
  window.saveGame = original;
  runtime.originalSaveGame = undefined;
}

function installInterval() {
  clearIntervalRepair();
  runtime.interval = window.setInterval(() => {
    if (runtime.enabled) repairAllFamilies({ refresh: false });
  }, 8000);
}

function clearIntervalRepair() {
  if (runtime.interval) window.clearInterval(runtime.interval);
  runtime.interval = undefined;
}

function queueRepair(reason, forceRefresh = false) {
  clearTimers();
  runtime.timers = REPAIR_DELAYS.map(delay => window.setTimeout(() => {
    if (!runtime.enabled) return;
    const changed = repairAllFamilies({ refresh: false });
    updateAreaEndSprites();
    if (changed && forceRefresh) refreshGameState();
  }, delay));
}

function clearTimers() {
  for (const timer of runtime.timers) window.clearTimeout(timer);
  runtime.timers = [];
}

function repairAllFamilies(options = {}) {
  const allPokemon = getPokemonMap();
  const cache = getFamilyCache();
  if (!allPokemon || !cache) return false;

  let changed = false;
  for (const family of cache.families.values()) {
    if (!familyHasUnlockedShiny(family, allPokemon)) continue;
    for (const id of family) {
      const pokemon = allPokemon[id];
      if (!isUnlockedPokemon(pokemon)) continue;
      if (pokemon.shiny === true && pokemon.shinyDisabled !== true) continue;
      pokemon.shiny = true;
      pokemon.shinyDisabled = undefined;
      changed = true;
    }
  }

  if (changed && options.refresh === true) refreshGameState();
  return changed;
}

function repairFamilyFor(id, options = {}) {
  if (!id) return false;
  const allPokemon = getPokemonMap();
  const cache = getFamilyCache();
  const root = cache?.familyById?.get(id);
  const family = root ? cache.families.get(root) : undefined;
  if (!allPokemon || !family || !familyHasUnlockedShiny(family, allPokemon)) return false;

  let changed = false;
  for (const familyId of family) {
    const pokemon = allPokemon[familyId];
    if (!isUnlockedPokemon(pokemon)) continue;
    if (pokemon.shiny === true && pokemon.shinyDisabled !== true) continue;
    pokemon.shiny = true;
    pokemon.shinyDisabled = undefined;
    changed = true;
  }

  if (changed && options.refresh === true) refreshGameState();
  return changed;
}

function familyHasUnlockedShiny(family, allPokemon) {
  for (const id of family) {
    const pokemon = allPokemon[id];
    if (isUnlockedPokemon(pokemon) && pokemon.shiny === true) return true;
  }
  return false;
}

function isUnlockedPokemon(pokemon) {
  // Broadened to include anyone with a level or caught count
  return (Number(pokemon?.caught) || 0) > 0 || (Number(pokemon?.level) || 0) > 1 || pokemon?.newPokemon === true;
}

function getFamilyCache() {
  if (!runtime.familyCache || Date.now() - runtime.cacheTime > 2000) {
    rebuildFamilyCache();
  }
  return runtime.familyCache;
}

function rebuildFamilyCache() {
  const allPokemon = getPokemonMap();
  if (!allPokemon) return undefined;

  const ids = Object.keys(allPokemon).filter(id => allPokemon[id]?.id === id);
  const parent = new Map(ids.map(id => [id, id]));
  const lowerToId = new Map(ids.map(id => [id.toLowerCase(), id]));
  const canonicalIds = [...ids].sort((a, b) => b.length - a.length);

  const find = id => {
    let root = parent.get(id) || id;
    while (parent.get(root) && parent.get(root) !== root) root = parent.get(root);
    let current = id;
    while (parent.get(current) && parent.get(current) !== root) {
      const next = parent.get(current);
      parent.set(current, root);
      current = next;
    }
    return root;
  };

  const union = (a, b) => {
    if (!parent.has(a) || !parent.has(b)) return;
    const rootA = find(a);
    const rootB = find(b);
    if (rootA !== rootB) parent.set(rootB, rootA);
  };

  for (const id of ids) {
    const pokemon = allPokemon[id];
    if (typeof pokemon.evolve !== "function") continue;

    let evolutions;
    try {
      evolutions = pokemon.evolve();
    } catch (error) {
      continue;
    }

    for (const key in evolutions || {}) {
      const targetId = evolutions[key]?.pkmn?.id;
      if (targetId && parent.has(targetId)) union(id, targetId);
    }
  }

  const formBuckets = new Map();
  for (const id of ids) {
    const key = getFormFamilyKey(id, canonicalIds, lowerToId);
    if (!key) continue;
    if (!formBuckets.has(key)) formBuckets.set(key, []);
    formBuckets.get(key).push(id);
  }

  for (const bucket of formBuckets.values()) {
    for (let i = 1; i < bucket.length; i++) union(bucket[0], bucket[i]);
  }

  const families = new Map();
  const familyById = new Map();
  for (const id of ids) {
    const root = find(id);
    if (!families.has(root)) families.set(root, new Set());
    families.get(root).add(id);
    familyById.set(id, root);
  }

  runtime.familyCache = { families, familyById };
  runtime.cacheTime = Date.now();
  return runtime.familyCache;
}

function getFormFamilyKey(id, canonicalIds, lowerToId) {
  const strippedLower = stripFormAffixes(id);

  for (const candidate of canonicalIds) {
    if (candidate.length < 3 || candidate === id) continue;
    const lowerCandidate = candidate.toLowerCase();
    if (strippedLower === lowerCandidate || strippedLower.startsWith(lowerCandidate) || lowerCandidate.startsWith(strippedLower)) {
       const rest = strippedLower.length > lowerCandidate.length ? strippedLower.slice(lowerCandidate.length) : lowerCandidate.slice(strippedLower.length);
       if (!rest || isKnownFormSuffix(rest)) return candidate;
    }
  }

  if (lowerToId.has(strippedLower)) return lowerToId.get(strippedLower);
  return undefined;
}

function stripFormAffixes(id) {
  let value = String(id || "").toLowerCase();
  const affixes = ["alolan", "galarian", "hisuian", "paldean", "mega", "primal", "spiky", "alola", "galar", "hisui", "paldea", "gmax", "ash", "world"];
  
  let changed = true;
  while(changed) {
    changed = false;
    for (const affix of affixes) {
      if (value.startsWith(affix) && value.length > affix.length) {
        value = value.slice(affix.length);
        changed = true;
      }
      if (value.endsWith(affix) && value.length > affix.length) {
        value = value.slice(0, -affix.length);
        changed = true;
      }
    }
  }
  return value;
}

function isKnownFormSuffix(rest) {
  if (!rest) return true;
  return /^(alola|galar|hisui|paldea|gmax|ash|world|hoenn|sinnoh|unova|kalos|belle|libre|phd|popstar|rockstar|cap|original|origin|altered|therian|incarnate|wash|heat|frost|fan|mow|sandy|trash|plant|east|west|sunshine|midnight|dusk|dawn|crowned|blade|shield|sky|land|white|black|blue|red|yellow|orange|green|pink|school|solo|amped|lowkey|rapid|single|eternal|complete|zygardecomplete|small|large|super|totem|starter|partner|bloodmoon|hero|family|hangry|fullbelly|curly|droopy|stretchy|combat|blaze|aqua|breed|paldeablaze|paldeaaqua)$/i.test(rest);
}

function updateAreaEndSprites() {
  const allPokemon = getPokemonMap();
  const list = document.getElementById("area-end-pkmn-list");
  if (!allPokemon || !list) return;

  for (const card of list.querySelectorAll("[data-pkmn-editor]")) {
    const id = card.dataset.pkmnEditor;
    const pokemon = allPokemon[id];
    if (!pokemon?.shiny || pokemon.shinyDisabled === true) continue;

    const img = card.querySelector("img");
    if (img) img.src = `img/pkmn/shiny/${id}.png`;

    if (!card.classList.contains("has-shiny-forever-tag")) {
      card.classList.add("has-shiny-forever-tag");
      const tag = document.createElement("span");
      tag.className = "shiny-forever-tag";
      tag.dataset.shinyForeverTag = "true";
      tag.textContent = "Shiny Forever!";
      card.appendChild(tag);
    }
  }
}

function refreshGameState() {
  safeCall(() => runtime.api?.refreshGame?.());
  safeCall(() => {
    if (typeof updatePokedex === "function" && !runtime.updateGuard) updatePokedex();
  });
  safeCall(() => {
    if (typeof saveGame === "function" && !runtime.saveGuard) saveGame();
  });
}

function getPokemonId(value) {
  if (typeof value === "string") return value;
  return value?.id;
}

function getPokemonMap() {
  try {
    return typeof pkmn === "undefined" ? window.pkmn : pkmn;
  } catch (error) {
    return window.pkmn;
  }
}

function safeCall(callback) {
  try {
    callback();
  } catch (error) {
    console.warn("[Shiny Forever] refresh failed", error);
  }
}

window.ShinyForever = {
  repair: () => repairAllFamilies({ refresh: true }),
  rebuildFamilies: () => rebuildFamilyCache()
};
