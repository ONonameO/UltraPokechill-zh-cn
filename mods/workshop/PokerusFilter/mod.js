(function () {

    const modId = "pkrs_filter";
    const selectId = "pokedex-filter-pokerus";
    let patched = false;
    let origUpdatePokedex = null;
    let origResetFilters = null;


    function renderPkrsFilter() {
        // ── inject the <select> ──
        if (!document.getElementById(selectId)) {
            const select = document.createElement("select");
            select.id = selectId;
            select.innerHTML =
                `<option value="all">宝可病毒</option>` +
                `<option value="true">携带宝可病毒</option>`;

            // Insert before the first "Clear Filters" button
            const clearBtn = document.querySelector(".pokedex-filters-menu .clear-filters");
            if (clearBtn) clearBtn.parentElement.insertBefore(select, clearBtn);

            select.addEventListener("change", () => {
                if (typeof updatePokedex === "function") updatePokedex();
            });
        }

        // ── monkey-patch updatePokedex & resetPokedexFilters ──
        if (!patched) {
            patched = true;

            // Grab the current (original) references right before patching
            origUpdatePokedex = updatePokedex;
            origResetFilters = resetPokedexFilters;

            updatePokedex = function () {
                origUpdatePokedex.apply(this, arguments);

                const sel = document.getElementById(selectId);
                if (!sel || sel.value === "all") return;

                // hide every entry whose pokemon doesn't carry pokerus
                const entries = document.querySelectorAll("#pokedex-list > [data-pkmn-editor]");
                entries.forEach(div => {
                    const id = div.dataset.pkmnEditor;
                    if (id && pkmn[id] && pkmn[id].pokerus !== true) {
                        div.style.display = "none";
                    }
                });
            };

            resetPokedexFilters = function () {
                origResetFilters.apply(this, arguments);
                const sel = document.getElementById(selectId);
                if (sel) { sel.value = "all"; }
            };
        }
    }

    function removePkrsFilter() {
        // remove the <select>
        const el = document.getElementById(selectId);
        if (el) el.remove();

        // restore original functions
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
        name: "宝可病毒筛选",
        description: "在图鉴中新增一个筛选器，以便快速查找携带宝可病毒的宝可梦。",
        image: "img/items/colburBerry.png",
        version: "1.0",
        author: "LPF",
        category: "图鉴",
        hooks: {
            onToggle(api, payload) {
                if (payload.enabled)
                    renderPkrsFilter();
                else
                    removePkrsFilter();
            },
            onRefresh(api) {
                if (api.isEnabled(modId)) renderPkrsFilter();
            }
        }
    });
})();