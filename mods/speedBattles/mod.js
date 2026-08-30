const MOD_ID = "speedBattles";
const STYLE_ID = "speed-battles-style";
const CONFIG_CLASS = "speed-battles-config";
const LEGACY_PATCH_KEY = "__ultraSpeedBattlesPatch";
const LOOP_KEY = "__ultraSpeedBattlesLoop";
const RESPAWN_PATCH_KEY = "__ultraSpeedBattlesRespawnPatch";
const BASE_TIMER = 2000;
const STEP_MS = 1000 / 60;
const INTERVAL_MS = 50;
const SPEEDS = [1, 2, 3, 5, 10, 50];
let renderQueued = false;
let observerStarted = false;

UltraMods.define({
  id: MOD_ID,
  name: "Speed Battles",
  description: "Speeds battles by repeating normal combat ticks, preserving regular battle rules.",
  image: "img/items/quickClaw.png",
  version: "1.3",
  author: "UltraPokechill",
  category: "Battle",
  hooks: {
    onToggle(api, payload, state) {
      installStyles();
      ensureState(state);

      if (payload.enabled) {
        applySpeed(api, state);
      } else {
        restoreSpeed(api);
      }

      updateBodyState(api, state);
      renderConfig(api);
    },
    onRefresh(api, payload, state) {
      installStyles();
      ensureState(state);
      applySpeed(api, state);
      updateBodyState(api, state);
      renderConfig(api);
    },
    afterPlayerDamage(api, payload, state) {
      if (normalizeSpeed(state.speed) < 5) return;
      scheduleVisualSync(api);
    },
    afterWildDamage(api, payload, state) {
      if (normalizeSpeed(state.speed) < 5) return;
      scheduleVisualSync(api);
    },
    afterEnemyDefeated(api, payload, state) {
      accelerateCurrentRespawn(state);
      if (normalizeSpeed(state.speed) >= 5) scheduleVisualSync(api);
    }
  }
});

installStyles();
startMenuObserver();
queueRenderConfig(UltraMods);

function ensureState(state) {
  if (!state || typeof state !== "object") return { speed: 2 };
  state.speed = normalizeSpeed(state.speed || 2);
  return state;
}

function getState(api) {
  const saved = api.saved;
  if (!saved.mods) saved.mods = {};
  if (!saved.mods.state) saved.mods.state = {};
  if (!saved.mods.state[MOD_ID]) saved.mods.state[MOD_ID] = {};
  return ensureState(saved.mods.state[MOD_ID]);
}

function normalizeSpeed(value) {
  const speed = Number(value);
  return SPEEDS.includes(speed) ? speed : 2;
}

function applySpeed(api, state) {
  ensureState(state);
  api.saved.overrideBattleTimer = BASE_TIMER;
  removeLegacyPatch();
  startTurboLoop(state);
  updateBodyState(api, state);
}

function restoreSpeed(api) {
  stopTurboLoop();
  removeLegacyPatch();
  api.saved.overrideBattleTimer = BASE_TIMER;
  document.body.classList.remove("speed-battles-active", "speed-battles-fast");
}

function updateBodyState(api, state) {
  const enabled = api.isEnabled(MOD_ID);
  const speed = normalizeSpeed(state.speed);
  document.body.classList.toggle("speed-battles-active", enabled);
  document.body.classList.toggle("speed-battles-fast", enabled && speed >= 5);
}

function installStyles() {
  if (document.getElementById(STYLE_ID)) return;

  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    .${CONFIG_CLASS} {
      align-items: center;
      border-top: 1px solid rgba(59, 51, 35, 0.35);
      display: flex;
      flex-wrap: wrap;
      gap: 0.35rem;
      grid-column: 2 / 4;
      margin-top: 0.15rem;
      padding-top: 0.45rem;
    }

    .speed-battles-label {
      color: white;
      font-size: 0.95rem;
      margin-right: 0.15rem;
    }

    .speed-battles-option {
      background: var(--dark1);
      border: 0;
      border-radius: 0.3rem;
      color: var(--light2);
      cursor: pointer;
      font-family: inherit;
      font-size: 0.95rem;
      min-width: 3rem;
      padding: 0.25rem 0.45rem;
    }

    .speed-battles-option.active {
      background: rgb(90, 133, 113);
      color: white;
    }

    .speed-battles-note {
      color: white;
      font-size: 0.78rem;
      opacity: 0.78;
    }

    body.speed-battles-fast .explore-hp,
    body.speed-battles-fast .explore-hp-wild,
    body.speed-battles-fast [id^="pkmn-movebox-"][id$="-bar"] {
      transition: none !important;
    }

    @media (max-width: 650px) {
      .${CONFIG_CLASS} {
        grid-column: 1 / -1;
      }
    }
  `;
  document.head.appendChild(style);
}

function startMenuObserver() {
  if (observerStarted) return;
  observerStarted = true;

  const observer = new MutationObserver(() => queueRenderConfig(UltraMods));
  observer.observe(document.documentElement, { childList: true, subtree: true });
}

function queueRenderConfig(api) {
  if (renderQueued) return;
  renderQueued = true;
  requestAnimationFrame(() => {
    renderQueued = false;
    renderConfig(api);
  });
}

function renderConfig(api) {
  const card = document.querySelector(`.mod-card[data-mod-id="${MOD_ID}"]`);
  if (!card) return;

  const state = getState(api);
  const speed = normalizeSpeed(state.speed);
  const enabled = api.isEnabled(MOD_ID);
  let panel = card.querySelector(`.${CONFIG_CLASS}`);

  if (!panel) {
    panel = document.createElement("div");
    panel.className = CONFIG_CLASS;
    card.appendChild(panel);
  }

  const signature = `${speed}:${enabled}`;
  if (panel.dataset.signature === signature) return;
  panel.dataset.signature = signature;
  panel.innerHTML = "";

  const label = document.createElement("span");
  label.className = "speed-battles-label";
  label.textContent = "Battle speed";
  panel.appendChild(label);

  for (const option of SPEEDS) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = option === speed ? "speed-battles-option active" : "speed-battles-option";
    button.textContent = `${option}x`;
    button.addEventListener("click", event => {
      event.preventDefault();
      event.stopPropagation();
      state.speed = option;
      if (api.isEnabled(MOD_ID)) applySpeed(api, state);
      else updateBodyState(api, state);
      api.save();
      renderConfig(api);
    });
    panel.appendChild(button);
  }

  const note = document.createElement("span");
  note.className = "speed-battles-note";
  note.textContent = enabled
    ? `Extra ticks x${speed}`
    : `Saved preset: ${speed}x`;
  panel.appendChild(note);
}

function startTurboLoop(state) {
  const speed = normalizeSpeed(state.speed);
  let loop = window[LOOP_KEY];

  if (!loop) {
    loop = {
      active: false,
      accumulator: 0,
      interval: 0,
      last: performance.now(),
      raf: 0,
      running: false,
      speed: 1
    };
    window[LOOP_KEY] = loop;
  }

  loop.active = true;
  loop.speed = speed;
  loop.last = performance.now();

  if (loop.raf) {
    cancelAnimationFrame(loop.raf);
    loop.raf = 0;
  }

  if (!loop.running || !loop.interval) {
    if (loop.interval) clearInterval(loop.interval);
    loop.running = true;
    loop.interval = setInterval(runTurboLoop, INTERVAL_MS);
  }
}

function stopTurboLoop() {
  const loop = window[LOOP_KEY];
  if (!loop) return;

  loop.active = false;
  loop.speed = 1;
  loop.accumulator = 0;
  if (loop.interval) clearInterval(loop.interval);
  loop.interval = 0;
  if (loop.raf) cancelAnimationFrame(loop.raf);
  loop.raf = 0;
  loop.running = false;
}

function runTurboLoop(now) {
  const loop = window[LOOP_KEY];
  if (!loop?.active) {
    if (loop) {
      if (loop.interval) clearInterval(loop.interval);
      loop.interval = 0;
      loop.running = false;
    }
    return;
  }

  const timestamp = Number.isFinite(Number(now)) ? Number(now) : performance.now();
  const speed = normalizeSpeed(loop.speed);
  const extraTicks = Math.max(0, speed - 1);
  let delta = timestamp - loop.last;
  loop.last = timestamp;
  if (delta > 250) delta = 250;

  if (extraTicks > 0 && !isAfkFastForwardActive()) {
    loop.accumulator += delta * extraTicks;
    runExtraCombatTicks(loop);
  } else {
    loop.accumulator = 0;
  }

}

function runExtraCombatTicks(loop) {
  if (typeof window.exploreCombatPlayer !== "function" || typeof window.exploreCombatWild !== "function") return;

  const maxTicks = Math.max(1, Math.min(600, normalizeSpeed(loop.speed) * 20));
  let ticks = 0;

  while (loop.accumulator >= STEP_MS && ticks < maxTicks) {
    if (isCombatStopped()) {
      loop.accumulator = 0;
      return;
    }

    window.exploreCombatPlayer();

    if (!isCombatStopped()) {
      window.exploreCombatWild();
    }

    loop.accumulator -= STEP_MS;
    ticks++;
  }
}

function removeLegacyPatch() {
  const patch = window[LEGACY_PATCH_KEY];
  if (!patch?.installed) return;

  patch.enabled = false;
  patch.speed = 1;
  patch.skipNextWild = false;

  if (window.exploreCombatPlayer === patch.player) window.exploreCombatPlayer = patch.originalPlayer;
  if (window.exploreCombatWild === patch.wild) window.exploreCombatWild = patch.originalWild;
  patch.installed = false;
}

function isCombatStopped() {
  try {
    return typeof shouldCombatStop === "function" && shouldCombatStop();
  } catch (error) {
    return false;
  }
}

function isAfkFastForwardActive() {
  try {
    return typeof afkSeconds !== "undefined" && afkSeconds > 0;
  } catch (error) {
    return false;
  }
}

function accelerateCurrentRespawn(state) {
  const speed = normalizeSpeed(state.speed);
  if (speed <= 1 || window[RESPAWN_PATCH_KEY]) return;

  const originalSetTimeout = window.setTimeout;
  const originalVoidAnimation = window.voidAnimation;
  const patch = { originalSetTimeout, originalVoidAnimation };
  window[RESPAWN_PATCH_KEY] = patch;

  window.setTimeout = function patchedSpeedBattlesTimeout(callback, delay, ...args) {
    let nextDelay = delay;
    if (typeof delay === "number" && delay > 0 && delay <= 1600) {
      nextDelay = Math.max(1, delay / speed);
    }
    return originalSetTimeout.call(window, callback, nextDelay, ...args);
  };

  if (typeof originalVoidAnimation === "function") {
    window.voidAnimation = function patchedSpeedBattlesAnimation(divName, animationName) {
      let nextAnimation = animationName;
      if (divName === "explore-wild-sprite" && typeof animationName === "string" && animationName.includes("wildPokemonDown")) {
        nextAnimation = animationName.replace(/([0-9]+(?:\.[0-9]+)?)s/g, (match, seconds) => {
          return `${Math.max(0.05, Number(seconds) / speed)}s`;
        });
      }
      return originalVoidAnimation.call(this, divName, nextAnimation);
    };
  }

  originalSetTimeout.call(window, () => {
    const activePatch = window[RESPAWN_PATCH_KEY];
    if (activePatch !== patch) return;
    window.setTimeout = originalSetTimeout;
    if (typeof originalVoidAnimation === "function") window.voidAnimation = originalVoidAnimation;
    delete window[RESPAWN_PATCH_KEY];
  }, 0);
}

function scheduleVisualSync(api) {
  requestAnimationFrame(() => {
    requestAnimationFrame(() => syncHpVisuals(api));
  });
}

function syncHpVisuals(api) {
  const teamState = api.getTeamState();
  for (const slot in teamState) {
    const hp = Number(teamState[slot].hp) || 0;
    const hpMax = Number(teamState[slot].hpMax) || 1;
    const percent = Math.max(0, Math.min(100, (hp / hpMax) * 100));
    const bar = document.getElementById(`explore-${slot}-hp`);
    if (!bar) continue;

    bar.style.width = `${percent}%`;
    if (percent > 60) bar.style.background = "rgb(130, 211, 130)";
    else if (percent < 30) bar.style.background = "rgba(219, 112, 112, 1)";
    else bar.style.background = "rgba(221, 168, 99, 1)";
  }

  const battle = api.getBattleState();
  if (!Number.isFinite(Number(battle.wildHpMax)) || battle.wildHpMax <= 0) return;

  const percent = Math.max(0, Math.min(100, (Number(battle.wildHp) / Number(battle.wildHpMax)) * 100));
  const bars = [
    document.getElementById("exploe-wild-hp"),
    document.getElementById("exploe-wild-hp-2"),
    document.getElementById("exploe-wild-hp-3"),
    document.getElementById("exploe-wild-hp-4")
  ].filter(Boolean);

  const activeBars = Math.max(1, bars.filter(bar => bar.style.display !== "none").length);
  const segment = 100 / activeBars;

  for (let i = 0; i < bars.length; i++) {
    const bar = bars[i];
    if (i >= activeBars) continue;

    const start = segment * i;
    const end = start + segment;
    if (percent > start) {
      bar.style.width = percent >= end ? "100%" : `${((percent - start) / segment) * 100}%`;
    } else {
      bar.style.width = "0%";
    }
  }
}
