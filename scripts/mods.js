(function () {
  const registry = {};
  const folderModIds = new Set();
  const linkedModsStorageKey = "ultraPokechill.linkedMods";
  const workshopUpdateResultKey = "ultraPokechill.workshopUpdateResults";
  const workshopIndexPath = "mods/workshop.json";
  let bundledModsLoaded = false;
  let bundledModsLoading;
  let importedModsHydrated = false;
  let linkedModsLoaded = false;
  let linkedModsSyncedSavedRef;
  let workshopLoaded = false;
  let workshopLoading;
  let workshopMods = [];
  let workshopLastError = "";
  let activeModsTab = "installed";
  let workshopUpdateNoticeOpen = false;

  function readLinkedMods() {
    if (typeof localStorage === "undefined") return undefined;

    try {
      const raw = localStorage.getItem(linkedModsStorageKey);
      return raw ? JSON.parse(raw) : undefined;
    } catch (error) {
      console.warn("[UltraMods] Linked mods storage could not be read", error);
      return undefined;
    }
  }

  function persistLinkedMods() {
    if (typeof saved === "undefined" || typeof localStorage === "undefined" || !saved.mods) return;

    try {
      localStorage.setItem(linkedModsStorageKey, JSON.stringify({
        imported: Array.isArray(saved.mods.imported) ? saved.mods.imported : [],
        enabled: saved.mods.enabled || {},
        state: saved.mods.state || {}
      }));
      linkedModsSyncedSavedRef = saved;
    } catch (error) {
      console.warn("[UltraMods] Linked mods storage could not be saved", error);
    }
  }

  function syncLinkedMods() {
    if (typeof saved === "undefined" || !saved.mods) return;
    if (linkedModsSyncedSavedRef === saved) return;

    const linked = readLinkedMods();
    if (!linked) {
      if (!linkedModsLoaded && Array.isArray(saved.mods.imported) && saved.mods.imported.length > 0) {
        persistLinkedMods();
      }
      linkedModsLoaded = true;
      linkedModsSyncedSavedRef = saved;
      return;
    }

    if (Array.isArray(linked.imported)) saved.mods.imported = linked.imported;
    if (linked.enabled && typeof linked.enabled === "object") {
      saved.mods.enabled = { ...saved.mods.enabled, ...linked.enabled };
    }
    if (linked.state && typeof linked.state === "object") {
      saved.mods.state = { ...linked.state, ...saved.mods.state };
    }
    linkedModsLoaded = true;
    linkedModsSyncedSavedRef = saved;
  }

  function ensureSave() {
    if (typeof saved === "undefined") return;
    if (!saved.mods) saved.mods = {};
    if (!saved.mods.enabled) saved.mods.enabled = {};
    if (!saved.mods.state) saved.mods.state = {};
    if (!Array.isArray(saved.mods.imported)) saved.mods.imported = [];
    syncLinkedMods();
  }

  function cleanText(value, fallback) {
    const text = String(value ?? fallback ?? "").trim();
    return text.length > 0 ? text : fallback;
  }

  function cleanImage(value) {
    const image = String(value ?? "").trim();
    if (!image) return "img/items/dex.png";
    if (/^(img\/|mods\/|data:image\/|https?:\/\/)/.test(image)) return image;
    return "img/items/dex.png";
  }

  function resolveWorkshopPath(value) {
    const path = String(value ?? "").trim();
    if (!path) return "";
    if (/^(https?:\/\/|data:)/.test(path)) return path;
    if (path.startsWith("/") || path.startsWith("mods/") || path.startsWith("img/")) return path;
    return `mods/${path}`;
  }

  function mergeHooks(baseHooks = {}, extraHooks = {}) {
    return { ...baseHooks, ...extraHooks };
  }

  function safeCall(label, callback) {
    try {
      callback();
    } catch (error) {
      console.warn(`[UltraMods] ${label} failed`, error);
    }
  }

  function normalizeMod(definition, source) {
    const id = cleanText(definition?.id, "").replace(/[^a-zA-Z0-9_-]/g, "");
    if (!id) return undefined;

    return {
      id,
      name: cleanText(definition.name, id),
      description: cleanText(definition.description, "No description."),
      image: cleanImage(definition.image),
      version: cleanText(definition.version, "1.0"),
      author: cleanText(definition.author, "Unknown"),
      category: cleanText(definition.category, source === "folder" ? "Mods Folder" : "Imported"),
      source,
      sourceFile: cleanText(definition.sourceFile, ""),
      workshop: definition.workshop === true,
      workshopSource: cleanText(definition.workshopSource, ""),
      defaultEnabled: definition.defaultEnabled === true,
      hooks: { ...(definition.hooks || {}) }
    };
  }

  function register(definition) {
    ensureSave();

    const mod = normalizeMod(definition, definition.source || "runtime");
    if (!mod) return undefined;

    registry[mod.id] = mod;

    if (mod.source === "folder") folderModIds.add(mod.id);
    if (saved.mods) {
      if (saved.mods.enabled[mod.id] === undefined) saved.mods.enabled[mod.id] = mod.defaultEnabled;
      if (saved.mods.state[mod.id] === undefined) saved.mods.state[mod.id] = {};
    }

    renderList();
    renderWorkshop();
    return mod;
  }

  function getModState(id) {
    ensureSave();
    if (!saved.mods.state[id]) saved.mods.state[id] = {};
    return saved.mods.state[id];
  }

  function formatNumber(value) {
    const safeNumber = Number.isFinite(value) ? value : 0;
    return Math.max(0, Math.ceil(safeNumber)).toLocaleString("pt-BR");
  }

  function createApi(source) {
    return {
      define(definition) {
        return register({ ...definition, source });
      },
      register(definition) {
        return register({ ...definition, source });
      },
      isEnabled,
      setEnabled,
      runHook,
      formatNumber,
      formatName(value) {
        if (typeof format === "function") return format(value);
        return String(value ?? "");
      },
      typeColor(type) {
        if (typeof returnTypeColor === "function") return returnTypeColor(type);
        return "var(--accent)";
      },
      getBattleState() {
        return {
          wildHp: typeof wildPkmnHp === "undefined" ? undefined : wildPkmnHp,
          wildHpMax: typeof wildPkmnHpMax === "undefined" ? undefined : wildPkmnHpMax,
          currentPokemon: saved?.currentPkmn,
          activeSlot: typeof exploreActiveMember === "undefined" ? undefined : exploreActiveMember
        };
      },
      getTeamState() {
        const state = {};
        if (typeof team === "undefined" || typeof pkmn === "undefined") return state;

        for (const slot in team) {
          const member = team[slot]?.pkmn;
          if (!member?.id || !pkmn[member.id]) continue;

          state[slot] = {
            id: member.id,
            hp: pkmn[member.id].playerHp,
            hpMax: pkmn[member.id].playerHpMax
          };
        }

        return state;
      },
      removeAll(selector) {
        document.querySelectorAll(selector).forEach(el => el.remove());
      },
      save() {
        persistLinkedMods();
        if (typeof saveGame === "function") saveGame();
      },
      persistMods() {
        persistLinkedMods();
      },
      refreshGame() {
        safeCall("updateItemShop", () => { if (typeof updateItemShop === "function") updateItemShop(); });
        safeCall("updateItemBag", () => { if (typeof updateItemBag === "function") updateItemBag(); });
        safeCall("updatePreviewTeam", () => { if (typeof updatePreviewTeam === "function") updatePreviewTeam(); });
        safeCall("updateTeamPkmn", () => { if (typeof updateTeamPkmn === "function") updateTeamPkmn(); });
        safeCall("updateTeamExp", () => { if (typeof updateTeamExp === "function") updateTeamExp(); });
      },
      giveItem(id, amount = 1) {
        if (typeof item === "undefined" || !item[id]) return false;
        const quantity = Math.max(1, Math.floor(Number(amount) || 1));
        item[id].got = Math.max(0, Number(item[id].got) || 0) + quantity;
        item[id].newItem = Math.max(0, Number(item[id].newItem) || 0) + quantity;
        safeCall("updateItemShop", () => { if (typeof updateItemShop === "function") updateItemShop(); });
        safeCall("updateItemBag", () => { if (typeof updateItemBag === "function") updateItemBag(); });
        if (typeof saveGame === "function") saveGame();
        return true;
      },
      setItemAmount(id, amount = 0) {
        if (typeof item === "undefined" || !item[id]) return false;
        item[id].got = Math.max(0, Math.floor(Number(amount) || 0));
        safeCall("updateItemShop", () => { if (typeof updateItemShop === "function") updateItemShop(); });
        safeCall("updateItemBag", () => { if (typeof updateItemBag === "function") updateItemBag(); });
        if (typeof saveGame === "function") saveGame();
        return true;
      },
      givePkmn(id, level = 1) {
        if (typeof pkmn === "undefined" || typeof givePkmn !== "function") return false;
        const pokemon = typeof id === "string" ? pkmn[id] : id;
        if (!pokemon) return false;
        givePkmn(pokemon, Math.max(1, Math.min(100, Math.floor(Number(level) || 1))));
        safeCall("updatePreviewTeam", () => { if (typeof updatePreviewTeam === "function") updatePreviewTeam(); });
        safeCall("updateTeamPkmn", () => { if (typeof updateTeamPkmn === "function") updateTeamPkmn(); });
        safeCall("updateTeamExp", () => { if (typeof updateTeamExp === "function") updateTeamExp(); });
        if (typeof saveGame === "function") saveGame();
        return true;
      },
      setPokemonLevel(id, level = 1) {
        if (typeof pkmn === "undefined" || !pkmn[id]) return false;
        pkmn[id].level = Math.max(1, Math.min(100, Math.floor(Number(level) || 1)));
        if (pkmn[id].exp !== undefined) pkmn[id].exp = 0;
        safeCall("updatePreviewTeam", () => { if (typeof updatePreviewTeam === "function") updatePreviewTeam(); });
        safeCall("updateTeamPkmn", () => { if (typeof updateTeamPkmn === "function") updateTeamPkmn(); });
        safeCall("updateTeamExp", () => { if (typeof updateTeamExp === "function") updateTeamExp(); });
        if (typeof saveGame === "function") saveGame();
        return true;
      },
      get saved() {
        return saved;
      },
      get team() {
        return typeof team === "undefined" ? undefined : team;
      },
      get pkmn() {
        return typeof pkmn === "undefined" ? undefined : pkmn;
      },
      get item() {
        return typeof item === "undefined" ? undefined : item;
      },
      get shop() {
        return typeof shop === "undefined" ? undefined : shop;
      },
      get move() {
        return typeof move === "undefined" ? undefined : move;
      },
      get ability() {
        return typeof ability === "undefined" ? undefined : ability;
      },
      get areas() {
        return typeof areas === "undefined" ? undefined : areas;
      },
      get field() {
        return typeof field === "undefined" ? undefined : field;
      },
      get exploreActiveMember() {
        return typeof exploreActiveMember === "undefined" ? undefined : exploreActiveMember;
      }
    };
  }

  function executeModSource(sourceCode, source, sourceName, baseDefinition = {}) {
    let registeredMod;
    const api = createApi(source);
    api.define = definition => {
      const mergedDefinition = {
        ...baseDefinition,
        ...definition,
        hooks: mergeHooks(baseDefinition.hooks, definition?.hooks),
        source,
        sourceFile: sourceName
      };
      const baseImage = String(baseDefinition.image || "");
      const definedImage = String(definition?.image || "").trim().toLowerCase();
      if (baseImage.startsWith("data:image/") && (!definedImage || definedImage === "icon.png")) {
        mergedDefinition.image = baseDefinition.image;
      }
      registeredMod = register(mergedDefinition);
      return registeredMod;
    };
    api.register = api.define;

    const factory = new Function(
      "UltraMods",
      `"use strict";\n${sourceCode}\n//# sourceURL=${sourceName}`
    );
    const result = factory(api);

    if (result && typeof result === "object") {
      registeredMod = api.define(result);
    }

    if (!registeredMod) {
      registeredMod = register({ ...baseDefinition, source, sourceFile: sourceName });
    }

    return registeredMod;
  }

  async function inflateZipEntry(bytes) {
    if (!("DecompressionStream" in window)) {
      throw new Error("This browser cannot decompress zipped mods.");
    }

    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  }

  async function readZipEntries(arrayBuffer) {
    const view = new DataView(arrayBuffer);
    const bytes = new Uint8Array(arrayBuffer);
    const decoder = new TextDecoder();
    let eocdOffset = -1;

    for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 66000); i--) {
      if (view.getUint32(i, true) === 0x06054b50) {
        eocdOffset = i;
        break;
      }
    }

    if (eocdOffset < 0) throw new Error("Invalid .mod zip.");

    const totalEntries = view.getUint16(eocdOffset + 10, true);
    let centralOffset = view.getUint32(eocdOffset + 16, true);
    const entries = {};

    for (let i = 0; i < totalEntries; i++) {
      if (view.getUint32(centralOffset, true) !== 0x02014b50) {
        throw new Error("Invalid zip central directory.");
      }

      const method = view.getUint16(centralOffset + 10, true);
      const compressedSize = view.getUint32(centralOffset + 20, true);
      const nameLength = view.getUint16(centralOffset + 28, true);
      const extraLength = view.getUint16(centralOffset + 30, true);
      const commentLength = view.getUint16(centralOffset + 32, true);
      const localOffset = view.getUint32(centralOffset + 42, true);
      const name = decoder.decode(bytes.slice(centralOffset + 46, centralOffset + 46 + nameLength)).replace(/\\/g, "/");

      if (view.getUint32(localOffset, true) !== 0x04034b50) {
        throw new Error("Invalid zip local header.");
      }

      const localNameLength = view.getUint16(localOffset + 26, true);
      const localExtraLength = view.getUint16(localOffset + 28, true);
      const dataStart = localOffset + 30 + localNameLength + localExtraLength;
      const compressed = bytes.slice(dataStart, dataStart + compressedSize);

      let content;
      if (method === 0) content = compressed;
      else if (method === 8) content = await inflateZipEntry(compressed);
      else throw new Error(`Unsupported zip compression method: ${method}`);

      entries[name] = content;
      centralOffset += 46 + nameLength + extraLength + commentLength;
    }

    return entries;
  }

  function findZipEntry(entries, fileName) {
    const target = fileName.toLowerCase();
    return Object.keys(entries).find(name => name.split("/").pop().toLowerCase() === target);
  }

  function bytesToText(bytes) {
    return new TextDecoder().decode(bytes);
  }

  function bytesToDataUrl(bytes, mimeType) {
    return new Promise(resolve => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.readAsDataURL(new Blob([bytes], { type: mimeType }));
    });
  }

  async function readModPackage(arrayBuffer, source, sourceName) {
    const entries = await readZipEntries(arrayBuffer);
    const manifestName = findZipEntry(entries, "mod.json");
    const scriptName = findZipEntry(entries, "mod.js");
    const iconName = findZipEntry(entries, "icon.png");

    if (!manifestName) throw new Error(`${sourceName} is missing mod.json`);
    if (!scriptName) throw new Error(`${sourceName} is missing mod.js`);

    const manifest = JSON.parse(bytesToText(entries[manifestName]));
    const script = bytesToText(entries[scriptName]);
    let iconDataUrl;

    if (iconName) {
      iconDataUrl = await bytesToDataUrl(entries[iconName], "image/png");
    }

    const definition = {
      ...manifest,
      image: iconDataUrl || manifest.image,
      packageFile: sourceName
    };

    return {
      manifest,
      script,
      iconDataUrl,
      mod: executeModSource(script, source, sourceName, definition)
    };
  }

  async function loadBundledMods() {
    if (bundledModsLoaded) return true;
    if (bundledModsLoading) return bundledModsLoading;

    bundledModsLoading = (async () => {
      try {
        const response = await fetch("mods/index.json", { cache: "no-store" });
        if (!response.ok) throw new Error("mods/index.json not found");

        const index = await response.json();
        const entries = Array.isArray(index) ? index : index.mods;
        if (!Array.isArray(entries)) throw new Error("mods/index.json has no mods list");

        for (const entry of entries) {
          if (typeof entry === "string") {
            const modPath = entry.startsWith("mods/") ? entry : `mods/${entry}`;

            if (modPath.toLowerCase().endsWith(".mod")) {
              const modResponse = await fetch(modPath, { cache: "no-store" });
              if (!modResponse.ok) {
                console.warn(`[UltraMods] ${modPath} could not be loaded`);
                continue;
              }
              await readModPackage(await modResponse.arrayBuffer(), "folder", modPath);
              continue;
            }

            if (modPath.toLowerCase().endsWith(".js")) {
              const modResponse = await fetch(modPath, { cache: "no-store" });
              if (!modResponse.ok) {
                console.warn(`[UltraMods] ${modPath} could not be loaded`);
                continue;
              }
              executeModSource(await modResponse.text(), "folder", modPath);
              continue;
            }

            if (modPath.toLowerCase().endsWith(".json")) {
              const modResponse = await fetch(modPath, { cache: "no-store" });
              if (!modResponse.ok) {
                console.warn(`[UltraMods] ${modPath} could not be loaded`);
                continue;
              }
              register({ ...(await modResponse.json()), source: "folder", sourceFile: modPath });
            }

            continue;
          }

          if (entry?.script) {
            const modPath = entry.script.startsWith("mods/") ? entry.script : `mods/${entry.script}`;
            const modResponse = await fetch(modPath, { cache: "no-store" });
            if (!modResponse.ok) continue;
            if (modPath.toLowerCase().endsWith(".mod")) {
              await readModPackage(await modResponse.arrayBuffer(), "folder", modPath);
            } else {
              executeModSource(await modResponse.text(), "folder", modPath);
            }
            continue;
          }

          register({ ...entry, source: "folder" });
        }

        return true;
      } catch (error) {
        console.warn("[UltraMods] Bundled mods could not be loaded", error);
        return false;
      } finally {
        bundledModsLoaded = true;
      }
    })();

    return bundledModsLoading;
  }

  function hydrateImportedMods(force = false) {
    ensureSave();
    if (!saved.mods) return;
    const missingImportedMod = saved.mods.imported.some(definition => definition?.id && !registry[definition.id]);
    if (importedModsHydrated && !force && !missingImportedMod) return;

    for (const definition of saved.mods.imported) {
      try {
        if (definition?.id && folderModIds.has(definition.id)) continue;

        if (definition.type === "mod" && definition.code && definition.manifest) {
          const mod = executeModSource(
            definition.code,
            "imported",
            definition.fileName || definition.id || "imported.mod",
            {
              ...definition.manifest,
              image: definition.iconDataUrl || definition.manifest.image,
              workshop: definition.workshop === true,
              workshopSource: definition.workshopSource || ""
            }
          );
          if (folderModIds.has(mod.id)) {
            delete registry[mod.id];
            continue;
          }
          continue;
        }

        if (definition.type === "js" && definition.code) {
          const mod = executeModSource(definition.code, "imported", definition.fileName || definition.id || "imported-mod.js");
          if (folderModIds.has(mod.id)) {
            delete registry[mod.id];
            continue;
          }
          continue;
        }

        const mod = register({ ...definition, source: "imported" });
        if (mod && folderModIds.has(mod.id)) delete registry[mod.id];
      } catch (error) {
        console.warn("[UltraMods] Imported mod could not be loaded", error);
      }
    }

    importedModsHydrated = true;
  }

  function isEnabled(id) {
    ensureSave();
    return saved.mods?.enabled?.[id] === true;
  }

  function setEnabled(id, enabled) {
    ensureSave();
    hydrateImportedMods();

    const mod = registry[id];
    if (!mod) return;

    saved.mods.enabled[id] = enabled === true;

    const hook = mod.hooks?.onToggle;
    if (typeof hook === "function") {
      try {
        hook(createApi(mod.source), { enabled: saved.mods.enabled[id], mod }, getModState(id));
      } catch (error) {
        console.warn(`[UltraMods] ${id}.onToggle failed`, error);
        setStatus(`${mod.name} was toggled, but its activation hook failed. Check the console.`);
      }
    }

    renderList();
    renderWorkshop();
    persistLinkedMods();
    if (enabled) runHook("onRefresh", {});
    if (typeof saveGame === "function") saveGame();
  }

  function runHook(name, payload) {
    ensureSave();
    hydrateImportedMods();
    const results = [];

    for (const id in registry) {
      if (!isEnabled(id)) continue;

      const mod = registry[id];
      const hook = mod.hooks?.[name];
      if (typeof hook !== "function") continue;

      try {
        results.push(hook(createApi(mod.source), payload || {}, getModState(id)));
      } catch (error) {
        console.warn(`[UltraMods] ${id}.${name} failed`, error);
      }
    }

    return results;
  }

  function ensureMenu() {
    let overlay = document.getElementById("mods-popup");
    if (overlay) return overlay;

    overlay = document.createElement("div");
    overlay.id = "mods-popup";
    overlay.innerHTML = `
      <div id="mods-window" class="season-background" role="dialog" aria-modal="true" aria-labelledby="mods-title">
        <div id="mods-header">
          <span id="mods-title">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path fill="currentColor" d="M14 2a2 2 0 0 1 2 2v2h2a2 2 0 0 1 2 2v2h-3a2 2 0 1 0 0 4h3v2a2 2 0 0 1-2 2h-2v2a2 2 0 0 1-2 2h-2v-3a2 2 0 1 0-4 0v3H6a2 2 0 0 1-2-2v-2H2v-4h3a2 2 0 1 0 0-4H2V8a2 2 0 0 1 2-2h2V4a2 2 0 0 1 2-2h2v3a2 2 0 1 0 4 0z"/></svg>
            Mods
          </span>
          <button type="button" id="mods-close" aria-label="Close mods">X</button>
        </div>
        <div id="mods-tabs" role="tablist" aria-label="Mods sections">
          <button type="button" class="active" data-mods-tab="installed">Installed</button>
          <button type="button" data-mods-tab="workshop">Workshop</button>
          <button type="button" id="mods-update-all">Update all</button>
        </div>
        <div id="mods-status" aria-live="polite"></div>
        <div id="mods-installed-panel" class="mods-panel">
          <div id="mods-dropzone">
            <input id="mods-file-input" type="file" accept=".mod,.js,text/javascript,.json,application/json" multiple>
            <strong>Drop .mod files here</strong>
            <span>.mod is a renamed zip with mod.json, mod.js and optional icon.png.</span>
          </div>
          <div id="mods-list"></div>
        </div>
        <div id="mods-workshop-panel" class="mods-panel" hidden>
          <div id="mods-workshop-intro">Community mods are JavaScript packages. Install only mods you trust.</div>
          <div id="mods-workshop-tools">
            <input id="mods-workshop-search" type="search" placeholder="Search workshop mods" autocomplete="off">
            <button type="button" id="mods-workshop-refresh">Refresh</button>
          </div>
          <div id="mods-workshop-list"></div>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    overlay.addEventListener("click", event => {
      if (event.target === overlay) closeMenu();
    });

    document.getElementById("mods-close").addEventListener("click", closeMenu);
    document.querySelectorAll("[data-mods-tab]").forEach(button => {
      button.addEventListener("click", () => switchModsTab(button.dataset.modsTab));
    });
    document.getElementById("mods-update-all").addEventListener("click", async event => {
      event.currentTarget.disabled = true;
      await updateAllWorkshopMods();
      event.currentTarget.disabled = false;
    });
    document.getElementById("mods-workshop-refresh").addEventListener("click", () => {
      setStatus("Refreshing workshop...");
      loadWorkshop(true).then(() => {
        renderWorkshop();
        if (!workshopLastError) setStatus("");
      });
    });
    document.getElementById("mods-workshop-search").addEventListener("input", renderWorkshop);
    document.getElementById("mods-file-input").addEventListener("change", event => {
      importFiles(event.target.files);
      event.target.value = "";
    });

    const dropzone = document.getElementById("mods-dropzone");
    dropzone.addEventListener("click", () => document.getElementById("mods-file-input").click());
    dropzone.addEventListener("dragover", event => {
      event.preventDefault();
      dropzone.classList.add("drag-over");
    });
    dropzone.addEventListener("dragleave", () => dropzone.classList.remove("drag-over"));
    dropzone.addEventListener("drop", event => {
      event.preventDefault();
      dropzone.classList.remove("drag-over");
      importFiles(event.dataTransfer.files);
    });

    return overlay;
  }

  function switchModsTab(tab) {
    activeModsTab = tab === "workshop" ? "workshop" : "installed";

    document.querySelectorAll("[data-mods-tab]").forEach(button => {
      button.classList.toggle("active", button.dataset.modsTab === activeModsTab);
    });

    const installedPanel = document.getElementById("mods-installed-panel");
    const workshopPanel = document.getElementById("mods-workshop-panel");
    if (installedPanel) installedPanel.hidden = activeModsTab !== "installed";
    if (workshopPanel) workshopPanel.hidden = activeModsTab !== "workshop";

    if (activeModsTab === "workshop") {
      renderWorkshop();
      if (!workshopLoaded) {
        setStatus("Loading workshop...");
        loadWorkshop().then(() => {
          renderWorkshop();
          if (!workshopLastError) setStatus("");
        });
      }
    } else {
      setStatus("");
      renderList();
    }
  }

  function setStatus(message) {
    const status = document.getElementById("mods-status");
    if (status) status.textContent = message || "";
  }

  function renderList() {
    const list = document.getElementById("mods-list");
    if (!list) return;

    ensureSave();
    list.innerHTML = "";

    const sourceLabels = {
      folder: "Mods folder",
      imported: "Imported",
      runtime: "Runtime"
    };

    const mods = Object.values(registry).sort((a, b) => {
      if (a.source !== b.source) return a.source === "folder" ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

    for (const mod of mods) {
      const card = document.createElement("div");
      card.className = "mod-card";
      card.dataset.modId = mod.id;

      const image = document.createElement("img");
      image.className = "mod-card-image";
      setModCardImage(image, mod.image);
      image.alt = "";

      const body = document.createElement("div");
      body.className = "mod-card-body";

      const top = document.createElement("div");
      top.className = "mod-card-top";

      const title = document.createElement("strong");
      title.textContent = mod.name;

      const tag = document.createElement("span");
      tag.textContent = mod.workshop ? "Workshop" : sourceLabels[mod.source] || mod.source;

      top.append(title, tag);

      const description = document.createElement("p");
      description.textContent = mod.description;

      const meta = document.createElement("span");
      meta.className = "mod-card-meta";
      meta.textContent = `${mod.category} | v${mod.version} | ${mod.author}`;

      body.append(top, description, meta);

      const actions = document.createElement("div");
      actions.className = "mod-card-actions";

      const workshopEntry = getInstalledWorkshopEntry(mod);
      if (workshopEntry && mod.version !== workshopEntry.version) {
        const update = document.createElement("button");
        update.type = "button";
        update.className = "mod-install";
        update.textContent = "Update";
        update.addEventListener("click", async () => {
          update.disabled = true;
          if (await installWorkshopMod(workshopEntry, { force: true })) reloadAfterWorkshopUpdate();
          else renderList();
        });
        actions.appendChild(update);
      }

      const toggle = document.createElement("button");
      toggle.type = "button";
      toggle.className = isEnabled(mod.id) ? "mod-toggle active" : "mod-toggle";
      toggle.textContent = isEnabled(mod.id) ? "Enabled" : "Disabled";
      toggle.addEventListener("click", () => setEnabled(mod.id, !isEnabled(mod.id)));
      actions.appendChild(toggle);

      if (mod.source === "imported") {
        const remove = document.createElement("button");
        remove.type = "button";
        remove.className = "mod-remove";
        remove.textContent = "Remove";
        remove.addEventListener("click", () => removeImportedMod(mod.id));
        actions.appendChild(remove);
      }

      card.append(image, body, actions);
      list.appendChild(card);
    }
  }

  function normalizeWorkshopEntry(entry, index) {
    if (!entry || typeof entry !== "object") return undefined;

    const sourceUrl = resolveWorkshopPath(entry.url || entry.file || entry.package);
    if (!sourceUrl) return undefined;

    const sourceName = sourceUrl.split("#")[0].split("?")[0].split("/").pop() || `workshop-${index + 1}.mod`;
    const fallbackId = sourceName.replace(/\.mod$/i, "").replace(/[^a-zA-Z0-9_-]/g, "") || `workshop${index + 1}`;
    const id = cleanText(entry.id, fallbackId).replace(/[^a-zA-Z0-9_-]/g, "") || fallbackId;
    const tags = Array.isArray(entry.tags) ? entry.tags.map(tag => String(tag).trim()).filter(Boolean) : [];
    const imagePath = entry.image || entry.icon ? resolveWorkshopPath(entry.image || entry.icon) : "img/items/dex.png";

    return {
      id,
      name: cleanText(entry.name, id),
      description: cleanText(entry.description, "No description."),
      version: cleanText(entry.version, "1.0"),
      author: cleanText(entry.author, "Community"),
      category: cleanText(entry.category, "Workshop"),
      image: cleanImage(imagePath),
      sourceUrl,
      fileName: cleanText(entry.fileName, sourceName),
      tags,
      searchText: `${id} ${entry.name || ""} ${entry.description || ""} ${entry.author || ""} ${entry.category || ""} ${tags.join(" ")}`.toLowerCase()
    };
  }

  function loadWorkshop(force = false) {
    if (workshopLoaded && !force) return Promise.resolve(workshopMods);
    if (workshopLoading && !force) return workshopLoading;

    workshopLoading = (async () => {
      try {
        workshopLastError = "";
        const response = await fetch(workshopIndexPath, { cache: "no-store" });
        if (!response.ok) throw new Error(`${workshopIndexPath} not found`);

        const index = await response.json();
        const entries = Array.isArray(index) ? index : index.mods;
        if (!Array.isArray(entries)) throw new Error(`${workshopIndexPath} has no mods list`);

        workshopMods = entries.map(normalizeWorkshopEntry).filter(Boolean);
        workshopLoaded = true;
        return workshopMods;
      } catch (error) {
        console.warn("[UltraMods] Workshop could not be loaded", error);
        workshopMods = [];
        workshopLoaded = true;
        workshopLastError = "Workshop index could not be loaded.";
        if (activeModsTab === "workshop") setStatus("Workshop index could not be loaded.");
        return workshopMods;
      } finally {
        workshopLoading = undefined;
      }
    })();

    return workshopLoading;
  }

  function getWorkshopInstall(entry) {
    ensureSave();
    const imported = (saved.mods.imported || []).find(mod => (
      mod?.workshopId === entry.id ||
      mod?.workshopSource === entry.sourceUrl ||
      mod?.id === entry.id
    ));
    const id = imported?.id || (registry[entry.id] ? entry.id : "");

    return {
      imported,
      id,
      mod: id ? registry[id] : undefined
    };
  }

  function getInstalledWorkshopVersion(installed) {
    return cleanText(installed?.imported?.manifest?.version || installed?.mod?.version, "");
  }

  function getWorkshopUpdates() {
    hydrateImportedMods();
    return workshopMods
      .map(entry => ({ entry, installed: getWorkshopInstall(entry) }))
      .filter(item => hasWorkshopUpdate(item.installed, item.entry));
  }

  function renderWorkshop() {
    const list = document.getElementById("mods-workshop-list");
    if (!list) return;

    ensureSave();
    list.innerHTML = "";

    const search = document.getElementById("mods-workshop-search");
    const query = String(search?.value || "").trim().toLowerCase();
    const entries = workshopMods.filter(entry => !query || entry.searchText.includes(query));

    if (workshopLoading && !workshopLoaded) {
      const empty = document.createElement("div");
      empty.className = "mods-empty";
      empty.textContent = "Loading workshop...";
      list.appendChild(empty);
      return;
    }

    if (entries.length === 0) {
      const empty = document.createElement("div");
      empty.className = "mods-empty";
      empty.textContent = workshopLoaded ? "No workshop mods found." : "Open the Workshop tab to load community mods.";
      list.appendChild(empty);
      return;
    }

    for (const entry of entries) {
      const card = document.createElement("div");
      card.className = "mod-card";
      card.dataset.workshopId = entry.id;

      const image = document.createElement("img");
      image.className = "mod-card-image";
      setModCardImage(image, entry.image);
      image.alt = "";

      const body = document.createElement("div");
      body.className = "mod-card-body";

      const top = document.createElement("div");
      top.className = "mod-card-top";

      const title = document.createElement("strong");
      title.textContent = entry.name;

      const tag = document.createElement("span");
      tag.textContent = "Workshop";

      top.append(title, tag);

      const description = document.createElement("p");
      description.textContent = entry.description;

      const meta = document.createElement("span");
      meta.className = "mod-card-meta";
      meta.textContent = `${entry.category} | v${entry.version} | ${entry.author}`;

      body.append(top, description, meta);

      const actions = document.createElement("div");
      actions.className = "mod-card-actions";

      const installed = getWorkshopInstall(entry);
      if (installed.imported || installed.mod) {
        if (hasWorkshopUpdate(installed, entry)) {
          const update = document.createElement("button");
          update.type = "button";
          update.className = "mod-install";
          update.textContent = "Update";
          update.addEventListener("click", async () => {
            update.disabled = true;
            if (await installWorkshopMod(entry, { force: true })) reloadAfterWorkshopUpdate();
            else renderWorkshop();
          });
          actions.appendChild(update);
        } else {
          const installedButton = document.createElement("button");
          installedButton.type = "button";
          installedButton.className = "mod-secondary";
          installedButton.textContent = "Installed";
          installedButton.disabled = true;
          actions.appendChild(installedButton);
        }

        if (installed.id && registry[installed.id]) {
          const toggle = document.createElement("button");
          toggle.type = "button";
          toggle.className = isEnabled(installed.id) ? "mod-toggle active" : "mod-toggle";
          toggle.textContent = isEnabled(installed.id) ? "Enabled" : "Enable";
          toggle.addEventListener("click", () => setEnabled(installed.id, !isEnabled(installed.id)));
          actions.appendChild(toggle);
        }
      } else {
        const install = document.createElement("button");
        install.type = "button";
        install.className = "mod-install";
        install.textContent = "Install";
        install.addEventListener("click", async () => {
          install.disabled = true;
          await installWorkshopMod(entry);
          renderWorkshop();
        });
        actions.appendChild(install);
      }

      card.append(image, body, actions);
      list.appendChild(card);
    }
  }

  function hasWorkshopUpdate(installed, entry) {
    if (!installed?.imported || !entry?.version) return false;
    const currentVersion = getInstalledWorkshopVersion(installed);
    return currentVersion !== "" && currentVersion !== entry.version;
  }

  function getInstalledWorkshopEntry(mod) {
    if (!mod?.workshop || workshopMods.length === 0) return undefined;
    return workshopMods.find(entry => entry.id === mod.id || entry.sourceUrl === mod.workshopSource);
  }

  function setModCardImage(image, source) {
    image.onerror = () => {
      image.onerror = null;
      image.src = "img/icons/logo.png";
    };
    image.src = source || "img/icons/logo.png";
  }

  function reloadAfterWorkshopUpdate() {
    setStatus("Mod updated. Reloading...");
    if (typeof saveGame === "function") saveGame();
    window.setTimeout(() => window.location.reload(), 250);
  }

  async function updateAllWorkshopMods(options = {}) {
    ensureSave();
    setStatus("Checking workshop updates...");
    await loadWorkshop(true);
    if (workshopLastError) {
      setStatus("Workshop index could not be loaded.");
      return;
    }
    hydrateImportedMods(true);

    const updates = getWorkshopUpdates();

    if (updates.length === 0) {
      renderList();
      renderWorkshop();
      setStatus("All workshop mods are up to date.");
      return;
    }

    let updated = 0;
    const updatedMods = [];
    for (let index = 0; index < updates.length; index++) {
      const item = updates[index];
      const previousVersion = getInstalledWorkshopVersion(item.installed);
      setStatus(`Updating ${item.entry.name} (${index + 1}/${updates.length})...`);
      if (typeof options.onProgress === "function") options.onProgress(item, index, updates.length);
      if (await installWorkshopMod(item.entry, { force: true })) {
        updated++;
        updatedMods.push({
          id: item.entry.id,
          name: item.entry.name,
          from: previousVersion || "unknown",
          to: item.entry.version
        });
      }
    }

    if (updated > 0) {
      writeWorkshopUpdateResults(updatedMods);
      setStatus(`Updated ${updated} mod${updated === 1 ? "" : "s"}. Reloading...`);
      if (typeof saveGame === "function") saveGame();
      window.setTimeout(() => window.location.reload(), 350);
      return;
    }

    renderList();
    renderWorkshop();
    setStatus("No mods could be updated. Check the console or try again.");
  }

  function writeWorkshopUpdateResults(updatedMods) {
    if (typeof localStorage === "undefined" || !Array.isArray(updatedMods) || updatedMods.length === 0) return;
    try {
      localStorage.setItem(workshopUpdateResultKey, JSON.stringify({
        updatedAt: Date.now(),
        mods: updatedMods
      }));
    } catch (error) {
      console.warn("[UltraMods] Workshop update results could not be saved", error);
    }
  }

  function readWorkshopUpdateResults() {
    if (typeof localStorage === "undefined") return undefined;
    try {
      const raw = localStorage.getItem(workshopUpdateResultKey);
      if (!raw) return undefined;
      localStorage.removeItem(workshopUpdateResultKey);
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed?.mods) || parsed.mods.length === 0) return undefined;
      return parsed.mods;
    } catch (error) {
      console.warn("[UltraMods] Workshop update results could not be read", error);
      return undefined;
    }
  }

  function ensureWorkshopUpdateNotice() {
    let overlay = document.getElementById("mods-update-notice");
    if (overlay) return overlay;

    overlay = document.createElement("div");
    overlay.id = "mods-update-notice";
    overlay.innerHTML = `
      <div id="mods-update-notice-window" role="dialog" aria-modal="true" aria-labelledby="mods-update-notice-title">
        <div id="mods-update-notice-header">
          <span id="mods-update-notice-title">Mod updates</span>
          <button type="button" id="mods-update-notice-close" aria-label="Dismiss">X</button>
        </div>
        <div id="mods-update-notice-body"></div>
        <div id="mods-update-notice-actions"></div>
      </div>
    `;

    document.body.appendChild(overlay);
    overlay.addEventListener("click", event => {
      if (event.target === overlay) closeWorkshopUpdateNotice();
    });
    document.getElementById("mods-update-notice-close").addEventListener("click", closeWorkshopUpdateNotice);
    return overlay;
  }

  function closeWorkshopUpdateNotice() {
    const overlay = document.getElementById("mods-update-notice");
    if (overlay) overlay.style.display = "none";
    workshopUpdateNoticeOpen = false;
  }

  function openWorkshopFromNotice() {
    closeWorkshopUpdateNotice();
    openMenu();
    switchModsTab("workshop");
  }

  function renderWorkshopUpdateNotice({ title, description, mods, showUpdateAll }) {
    const overlay = ensureWorkshopUpdateNotice();
    const titleElement = document.getElementById("mods-update-notice-title");
    const body = document.getElementById("mods-update-notice-body");
    const actions = document.getElementById("mods-update-notice-actions");

    titleElement.textContent = title;
    body.innerHTML = "";
    actions.innerHTML = "";

    const text = document.createElement("p");
    text.textContent = description;
    body.appendChild(text);

    if (Array.isArray(mods) && mods.length > 0) {
      const list = document.createElement("div");
      list.className = "mods-update-notice-list";
      for (const mod of mods) {
        const row = document.createElement("div");
        row.className = "mods-update-notice-row";

        const name = document.createElement("strong");
        name.textContent = mod.name;

        const version = document.createElement("span");
        version.textContent = `${mod.from} -> ${mod.to}`;

        row.append(name, version);
        list.appendChild(row);
      }
      body.appendChild(list);
    }

    const dismiss = document.createElement("button");
    dismiss.type = "button";
    dismiss.className = "mods-update-notice-secondary";
    dismiss.textContent = "Dismiss";
    dismiss.addEventListener("click", closeWorkshopUpdateNotice);
    actions.appendChild(dismiss);

    const openWorkshop = document.createElement("button");
    openWorkshop.type = "button";
    openWorkshop.className = "mods-update-notice-secondary";
    openWorkshop.textContent = "Open Workshop";
    openWorkshop.addEventListener("click", openWorkshopFromNotice);
    actions.appendChild(openWorkshop);

    if (showUpdateAll) {
      const updateAll = document.createElement("button");
      updateAll.type = "button";
      updateAll.className = "mods-update-notice-primary";
      updateAll.textContent = "Update all";
      updateAll.addEventListener("click", async () => {
        updateAll.disabled = true;
        updateAll.textContent = "Updating...";
        await updateAllWorkshopMods({
          onProgress(item, index, total) {
            updateAll.textContent = `Updating ${index + 1}/${total}`;
          }
        });
        updateAll.disabled = false;
        updateAll.textContent = "Update all";
      });
      actions.appendChild(updateAll);
    }

    overlay.style.display = "flex";
    workshopUpdateNoticeOpen = true;
  }

  async function showWorkshopUpdateNoticeIfNeeded() {
    const updatedMods = readWorkshopUpdateResults();
    if (updatedMods?.length > 0) {
      renderWorkshopUpdateNotice({
        title: "Mods updated",
        description: "These workshop mods were updated successfully:",
        mods: updatedMods,
        showUpdateAll: false
      });
      return;
    }

    ensureSave();
    await loadWorkshop(true);
    if (workshopLastError || workshopUpdateNoticeOpen) return;

    const updates = getWorkshopUpdates().map(item => ({
      name: item.entry.name,
      from: getInstalledWorkshopVersion(item.installed),
      to: item.entry.version
    }));

    if (updates.length === 0) return;

    renderWorkshopUpdateNotice({
      title: "Workshop updates available",
      description: `${updates.length} installed workshop mod${updates.length === 1 ? " has" : "s have"} updates available.`,
      mods: updates,
      showUpdateAll: true
    });
  }

  async function installWorkshopMod(entry, options = {}) {
    ensureSave();
    entry = entry?.sourceUrl ? entry : normalizeWorkshopEntry(entry, 0);

    if (!entry) {
      setStatus("Workshop entry has no downloadable .mod file.");
      return false;
    }

    const installed = getWorkshopInstall(entry);
    if (!options.force && (installed.imported || installed.mod)) {
      setStatus(`${entry.name} is already installed.`);
      return false;
    }

    try {
      setStatus(`${options.force ? "Updating" : "Downloading"} ${entry.name}...`);
      const response = await fetch(entry.sourceUrl, { cache: "no-store" });
      if (!response.ok) throw new Error(`${entry.sourceUrl} could not be downloaded`);

      await installImportedPackage(await response.arrayBuffer(), entry.fileName, {
        workshop: true,
        workshopId: entry.id,
        workshopSource: entry.sourceUrl,
        workshopEntry: {
          name: entry.name,
          version: entry.version,
          author: entry.author
        }
      });
      return true;
    } catch (error) {
      console.warn("[UltraMods] Workshop mod could not be installed", error);
      setStatus(`${entry.name} could not be installed.`);
      return false;
    }
  }

  function openMenu() {
    ensureSave();
    const overlay = ensureMenu();
    overlay.style.display = "flex";
    setStatus("Loading mods...");
    renderList();
    switchModsTab(activeModsTab);

    loadBundledMods().then(() => {
      hydrateImportedMods();
      renderList();
      renderWorkshop();
      if (activeModsTab !== "workshop" || (workshopLoaded && !workshopLastError)) setStatus("");
      loadWorkshop().then(() => {
        renderList();
        renderWorkshop();
      });
    });
  }

  function closeMenu() {
    const overlay = document.getElementById("mods-popup");
    if (overlay) overlay.style.display = "none";
  }

  function importFiles(files) {
    const list = Array.from(files || []);
    if (list.length === 0) return;

    for (const file of list) {
      const lowerName = file.name.toLowerCase();

      if (!lowerName.endsWith(".mod") && !lowerName.endsWith(".js") && !lowerName.endsWith(".json")) {
        setStatus(`${file.name} is not a supported mod file.`);
        continue;
      }

      const reader = new FileReader();
      reader.onload = async () => {
        try {
          if (lowerName.endsWith(".mod")) {
            await installImportedPackage(reader.result, file.name);
            return;
          }

          if (lowerName.endsWith(".js")) {
            installImportedScript(String(reader.result), file.name);
            return;
          }

          installImportedManifest(JSON.parse(reader.result), file.name);
        } catch (error) {
          console.warn(error);
          setStatus(`${file.name} could not be loaded.`);
        }
      };

      if (lowerName.endsWith(".mod")) reader.readAsArrayBuffer(file);
      else reader.readAsText(file);
    }
  }

  async function installImportedPackage(arrayBuffer, fileName, options = {}) {
    ensureSave();
    const result = await readModPackage(arrayBuffer, "imported", fileName);
    const mod = result.mod;
    if (options.workshop === true) {
      mod.workshop = true;
      mod.workshopSource = options.workshopSource || "";
    }

    if (folderModIds.has(mod.id)) {
      delete registry[mod.id];
      setStatus(`${mod.name} uses a reserved mods-folder id.`);
      return;
    }

    saved.mods.imported = saved.mods.imported.filter(existing => existing.id !== mod.id);
    const importedDefinition = {
      type: "mod",
      id: mod.id,
      fileName,
      manifest: result.manifest,
      code: result.script,
      iconDataUrl: result.iconDataUrl
    };

    if (options.workshop === true) {
      importedDefinition.workshop = true;
      importedDefinition.workshopId = options.workshopId || "";
      importedDefinition.workshopSource = options.workshopSource || "";
      importedDefinition.workshopEntry = options.workshopEntry || {};
    }

    saved.mods.imported.push(importedDefinition);
    if (saved.mods.enabled[mod.id] === undefined) saved.mods.enabled[mod.id] = false;

    setStatus(`${mod.name} loaded. Enable it to apply.`);
    importedModsHydrated = true;
    renderList();
    renderWorkshop();
    persistLinkedMods();
    runHook("onRefresh", {});
    if (typeof saveGame === "function") saveGame();
  }

  function installImportedScript(code, fileName) {
    ensureSave();
    const mod = executeModSource(code, "imported", fileName);

    if (folderModIds.has(mod.id)) {
      delete registry[mod.id];
      setStatus(`${mod.name} uses a reserved mods-folder id.`);
      return;
    }

    saved.mods.imported = saved.mods.imported.filter(existing => existing.id !== mod.id);
    saved.mods.imported.push({
      type: "js",
      id: mod.id,
      fileName,
      code
    });
    if (saved.mods.enabled[mod.id] === undefined) saved.mods.enabled[mod.id] = false;

    setStatus(`${mod.name} loaded. Enable it to apply.`);
    importedModsHydrated = true;
    renderList();
    renderWorkshop();
    persistLinkedMods();
    runHook("onRefresh", {});
    if (typeof saveGame === "function") saveGame();
  }

  function installImportedManifest(definition, fileName) {
    ensureSave();
    const mod = register({ ...definition, source: "imported", sourceFile: fileName });

    if (!mod) {
      setStatus(`${fileName} has no valid mod id.`);
      return;
    }

    if (folderModIds.has(mod.id)) {
      delete registry[mod.id];
      setStatus(`${mod.name} uses a reserved mods-folder id.`);
      return;
    }

    saved.mods.imported = saved.mods.imported.filter(existing => existing.id !== mod.id);
    saved.mods.imported.push({
      type: "json",
      id: mod.id,
      name: mod.name,
      description: mod.description,
      image: mod.image,
      version: mod.version,
      author: mod.author,
      category: mod.category
    });
    if (saved.mods.enabled[mod.id] === undefined) saved.mods.enabled[mod.id] = false;

    setStatus(`${mod.name} metadata loaded. Use .js for mod logic.`);
    importedModsHydrated = true;
    renderList();
    renderWorkshop();
    persistLinkedMods();
    runHook("onRefresh", {});
    if (typeof saveGame === "function") saveGame();
  }

  function removeImportedMod(id) {
    ensureSave();
    saved.mods.imported = saved.mods.imported.filter(mod => mod.id !== id);
    delete saved.mods.enabled[id];
    delete saved.mods.state[id];
    delete registry[id];
    renderList();
    renderWorkshop();
    persistLinkedMods();
    runHook("onRefresh", {});
    if (typeof saveGame === "function") saveGame();
  }

  window.UltraMods = {
    define(definition) {
      return register({ ...definition, source: "runtime" });
    },
    register,
    runHook,
    isEnabled,
    setEnabled,
    openMenu,
    closeMenu,
    loadBundledMods,
    loadWorkshop,
    installWorkshopMod,
    refresh() {
      runHook("onRefresh", {});
    },
    persist() {
      persistLinkedMods();
    },
    patchFunction(functionName, target, replacement, all = false) {
      if (typeof window[functionName] !== "function") {
          console.warn(`[UltraMods] Cannot patch ${functionName}: not a function`);
          return;
      }
      const original = window[functionName].toString();
      const patched = all ? original.replaceAll(target, replacement) : original.replace(target, replacement);
      
      if (original === patched) {
          console.warn(`[UltraMods] Patch failed for ${functionName}: target string not found`);
          return;
      }

      try {
          // Detect if it's a regular function or an arrow function
          let fn;
          if (patched.trim().startsWith("function")) {
              fn = (0, eval)(`(${patched})`);
          } else {
              fn = (0, eval)(patched);
          }
          window[functionName] = fn;
          console.log(`[UltraMods] Patched function ${functionName} successfully`);
      } catch (error) {
          console.error(`[UltraMods] Failed to apply patch to ${functionName}`, error);
      }
    },
    formatNumber
  };

  loadBundledMods();
  window.addEventListener("load", () => {
    loadBundledMods().then(() => {
      hydrateImportedMods();
      runHook("onRefresh", {});
      window.setTimeout(showWorkshopUpdateNoticeIfNeeded, 700);
    });
  });
})();
