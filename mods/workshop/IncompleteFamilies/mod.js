(function () {

    const modId = "incomplete_famillies";
    const optionValue = "incompletefamilies";
    const highlightClass = "if-non-shiny-highlight";
    let patched = false;
    let origUpdatePokedex = null;
    let origResetFilters = null;
    let styleEl = null;

    /* ── inject CSS for the non-shiny highlight ── */
    function injectStyles() {
        if (styleEl) return;
        styleEl = document.createElement("style");
        styleEl.textContent = `
            .${highlightClass} {
                outline: 2px solid #ff6b6b !important;
                outline-offset: -2px;
                background: rgba(255, 70, 113, 0.15) !important;
                animation: if-pulse 1.8s ease-in-out infinite;
            }
            @keyframes if-pulse {
                0%, 100% { outline-color: #ff6b6b; }
                50%      { outline-color: #ff9ec2; }
            }
        `;
        document.head.appendChild(styleEl);
    }

    function removeStyles() {
        if (styleEl) { styleEl.remove(); styleEl = null; }
    }

    /* ── add the option to the shiny <select> ── */
    function addOption() {
        const select = document.getElementById("pokedex-filter-shiny");
        if (!select) return;
        if (select.querySelector('option[value="' + optionValue + '"]')) return;
        const opt = document.createElement("option");
        opt.value = optionValue;
        opt.textContent = "incomplete families";
        select.appendChild(opt);
    }

    function removeOption() {
        const select = document.getElementById("pokedex-filter-shiny");
        if (!select) return;
        const opt = select.querySelector('option[value="' + optionValue + '"]');
        if (opt) opt.remove();
        if (select.value === optionValue) {
            select.value = "all";
            if (typeof updatePokedex === "function") updatePokedex();
        }
    }

    /* ── core logic: filter & highlight ── */
    function applyIncompleteFamiliesFilter() {
        const select = document.getElementById("pokedex-filter-shiny");
        if (!select || select.value !== optionValue) return;

        const entries = document.querySelectorAll("#pokedex-list > [data-pkmn-editor]");

        // 1. Build a map of family -> { hasShiny, hasNonShiny, memberIds }
        const processed = new Set();
        const familyMap = new Map();

        entries.forEach(function (div) {
            const id = div.dataset.pkmnEditor;
            if (!id || !pkmn[id] || processed.has(id)) return;

            const family = getEvolutionFamily(pkmn[id]);
            let hasShiny = false;
            let hasNonShiny = false;
            const memberIds = [];

            for (const member of family) {
                if (member.caught <= 0) continue;
                memberIds.push(member.id);
                if (member.shiny === true) hasShiny = true;
                else hasNonShiny = true;
                processed.add(member.id);
            }

            const familyKey = memberIds.sort().join(",");
            if (familyKey && !familyMap.has(familyKey)) {
                familyMap.set(familyKey, { hasShiny: hasShiny, hasNonShiny: hasNonShiny, memberIds: memberIds });
            }
        });

        // 2. Collect IDs of pokemon in incomplete families
        const showIds = new Set();
        const nonShinyIds = new Set();

        familyMap.forEach(function (info) {
            if (info.hasShiny && info.hasNonShiny) {
                info.memberIds.forEach(function (id) {
                    showIds.add(id);
                    if (pkmn[id] && pkmn[id].shiny !== true) {
                        nonShinyIds.add(id);
                    }
                });
            }
        });

        // 3. Hide pokemon NOT in incomplete families, highlight non-shinies
        entries.forEach(function (div) {
            const id = div.dataset.pkmnEditor;
            if (!showIds.has(id)) {
                div.style.display = "none";
            } else if (nonShinyIds.has(id)) {
                div.classList.add(highlightClass);
            }
        });
    }

    /* ── render / remove ── */
    function renderIFFilter() {
        injectStyles();
        addOption();

        if (!patched) {
            patched = true;
            origUpdatePokedex = updatePokedex;
            origResetFilters = resetPokedexFilters;

            updatePokedex = function () {
                origUpdatePokedex.apply(this, arguments);
                try {
                    applyIncompleteFamiliesFilter();
                } catch (err) {
                    console.error("[IncompleteFamilies] error in updatePokedex hook:", err);
                }
            };

            resetPokedexFilters = function () {
                origResetFilters.apply(this, arguments);
                try {
                    document.querySelectorAll("." + highlightClass).forEach(function (el) {
                        el.classList.remove(highlightClass);
                    });
                } catch (err) {
                    console.error("[IncompleteFamilies] error in resetPokedexFilters hook:", err);
                }
            };
        }
    }

    function removeIFFilter() {
        removeOption();
        removeStyles();

        document.querySelectorAll("." + highlightClass).forEach(function (el) {
            el.classList.remove(highlightClass);
        });

        if (patched) {
            updatePokedex = origUpdatePokedex;
            resetPokedexFilters = origResetFilters;
            origUpdatePokedex = null;
            origResetFilters = null;
            patched = false;
        }
    }

    UltraMods.define({
        id: modId,
        name: "Incomplete Families",
        description: "Option for the shiny filter that shows the pokemons famillies that are not fully shiny",
        image: "icon.png",
        version: "1.1",
        author: "LPF",
        category: "Pokedex",
        hooks: {
            onToggle(api, payload) {
                if (payload.enabled)
                    renderIFFilter();
                else
                    removeIFFilter();
            },
            onRefresh(api) {
                if (api.isEnabled(modId)) renderIFFilter();
            }
        }
    });
})();