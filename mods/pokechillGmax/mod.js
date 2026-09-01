const MOD_ID = "pokechillGmax";
const STYLE_ID = MOD_ID + "-style";

UltraMods.define({
  id: MOD_ID,
  name: "Pokechill 超极巨化空间",
  description: "将「超极巨化空间」独立为 mod：定时刷新超极巨化 Boss 挑战区，收集碎片进行抽奖获取超极巨化宝可梦。由 mod 管理器独立启用或禁用。",
  image: "img/items/rareCandy.png",
  version: "1.0.0",
  author: "人民当家做主",
  category: "实用工具",
  defaultEnabled: false,
  hooks: {
    onToggle(api, payload, state) {
      if (payload.enabled) install();
      else remove();
    },
    onRefresh(api, payload, state) {
      if (api.isEnabled(MOD_ID)) install();
    }
  }
});

const __orig = {};

function install() {
  if (window[MOD_ID + "_installed"]) return;
  __orig.loadGame = window.loadGame;
  __orig.setWildPkmn = window.setWildPkmn;
  __orig.updateItemShop = window.updateItemShop;

    const settings = { enableGmaxDimension: true };

    // ========== 全局弹窗函数（供各模块使用） ==========
    let modalOverlay = null;
    function showFormalMessage(title, content, pkmnId = null) {
        if (modalOverlay) closeModal();

        modalOverlay = document.createElement('div');
        modalOverlay.style.position = 'fixed';
        modalOverlay.style.top = '0';
        modalOverlay.style.left = '0';
        modalOverlay.style.width = '100%';
        modalOverlay.style.height = '100%';
        modalOverlay.style.background = 'rgba(0,0,0,0.8)';
        modalOverlay.style.backdropFilter = 'blur(8px)';
        modalOverlay.style.zIndex = '30000';
        modalOverlay.style.display = 'flex';
        modalOverlay.style.justifyContent = 'center';
        modalOverlay.style.alignItems = 'center';
        modalOverlay.style.animation = 'tooltipBoxAppear 0.2s ease';
        modalOverlay.style.padding = '10px';

        const modalBox = document.createElement('div');
        modalBox.style.background = '#1a1a2e';
        modalBox.style.border = '3px solid #4ecca3';
        modalBox.style.borderRadius = '30px';
        modalBox.style.padding = 'clamp(15px, 5vw, 30px) clamp(20px, 8vw, 50px)';
        modalBox.style.boxShadow = '0 0 50px #4ecca3';
        modalBox.style.textAlign = 'center';
        modalBox.style.color = 'white';
        modalBox.style.fontFamily = "'Winky Sans', sans-serif";
        modalBox.style.maxWidth = '500px';
        modalBox.style.width = '90%';

        const titleEl = document.createElement('h2');
        titleEl.textContent = title;
        titleEl.style.marginBottom = '20px';
        titleEl.style.fontSize = 'clamp(1.5rem, 6vw, 2rem)';
        titleEl.style.background = 'linear-gradient(45deg, #4ecca3, #00adb5)';
        titleEl.style.webkitBackgroundClip = 'text';
        titleEl.style.webkitTextFillColor = 'transparent';
        titleEl.style.backgroundClip = 'text';

        const contentWrapper = document.createElement('div');
        contentWrapper.style.display = 'flex';
        contentWrapper.style.flexDirection = 'column';
        contentWrapper.style.alignItems = 'center';
        contentWrapper.style.gap = '15px';

        if (pkmnId) {
            const img = document.createElement('img');
            img.src = `img/pkmn/sprite/${pkmnId}.png`;
            img.style.width = 'clamp(64px, 20vw, 96px)';
            img.style.height = 'clamp(64px, 20vw, 96px)';
            img.style.imageRendering = 'pixelated';
            img.style.filter = 'drop-shadow(0 0 10px gold)';
            contentWrapper.appendChild(img);
        }

        const contentEl = document.createElement('p');
        contentEl.textContent = content;
        contentEl.style.fontSize = 'clamp(1rem, 4vw, 1.3rem)';
        contentEl.style.lineHeight = '1.5';
        contentEl.style.margin = '0';
        contentWrapper.appendChild(contentEl);

        const confirmBtn = document.createElement('button');
        confirmBtn.textContent = '确 定';
        confirmBtn.style.background = 'linear-gradient(45deg, #ff6b6b, #ff4757)';
        confirmBtn.style.border = 'none';
        confirmBtn.style.borderRadius = '40px';
        confirmBtn.style.color = 'white';
        confirmBtn.style.fontSize = 'clamp(1.2rem, 5vw, 1.5rem)';
        confirmBtn.style.padding = 'clamp(8px, 2vw, 10px) clamp(20px, 8vw, 40px)';
        confirmBtn.style.cursor = 'pointer';
        confirmBtn.style.fontWeight = 'bold';
        confirmBtn.style.boxShadow = '0 0 20px #ff6b6b';
        confirmBtn.style.transition = '0.2s';
        confirmBtn.onmouseover = () => confirmBtn.style.transform = 'scale(1.05)';
        confirmBtn.onmouseout = () => confirmBtn.style.transform = 'scale(1)';
        confirmBtn.onclick = closeModal;

        modalBox.appendChild(titleEl);
        modalBox.appendChild(contentWrapper);
        modalBox.appendChild(confirmBtn);
        modalOverlay.appendChild(modalBox);
        document.body.appendChild(modalOverlay);
    }

    function closeModal() {
        if (modalOverlay) {
            modalOverlay.remove();
            modalOverlay = null;
        }
    }

    if (settings.enableGmaxDimension) {
        const REQUIRED_ARCEUS = true;
        const GMAX_FRAGMENT = 'gmaxFragment';
        const GACHA_COST = 30;
        const ROTATION_HOURS = 12;
        const BOSS_LEVEL = 150;
        const BOSS_COUNT = 5;

        if (typeof afkSeconds === 'undefined') var afkSeconds = 0;

        let currentGmaxBosses = [];
        let lastRotationTime = Date.now();
        let countdownInterval = null;

        function getDexCount() {
            return Object.values(pkmn).filter(p => p && p.caught > 0).length;
        }

        function ensureCustomItems() {
            if (!item[GMAX_FRAGMENT]) {
                item[GMAX_FRAGMENT] = {
                    id: GMAX_FRAGMENT,
                    rename: '超极巨化碎片',
                    type: 'key',
                    got: 0,
                    newItem: 0,
                    info: function() { return '击败超极巨化宝可梦获得的稀有碎片...'; }
                };
            }
            if (item[GMAX_FRAGMENT].newItem === undefined) {
                item[GMAX_FRAGMENT].newItem = 0;
            }
        }

        const originalLoadGame = window.loadGame;
        window.loadGame = function() {
            const result = originalLoadGame ? originalLoadGame() : undefined;
            ensureCustomItems();
            return result;
        };

        const originalSaveGame = window.saveGame;
        window.saveGame = function() {
            if (originalSaveGame) originalSaveGame();
        };

        function getAllGmaxPokemon() {
            const gmaxList = [];
            for (const id in pkmn) {
                if (id.toLowerCase().includes('gmax')) {
                    gmaxList.push(id);
                }
            }
            return gmaxList;
        }

        function refreshGmaxBosses() {
            const allGmax = getAllGmaxPokemon();
            if (allGmax.length === 0) return;
            const shuffled = [...allGmax].sort(() => Math.random() - 0.5);
            currentGmaxBosses = shuffled.slice(0, BOSS_COUNT);
            console.log('[超极巨化空间] 刷新Boss:', currentGmaxBosses);
            lastRotationTime = Date.now();
            if (document.getElementById('gmax-dimension-menu')?.style.display === 'flex') {
                updateGmaxPageDisplay();
            }
        }

        function generateValidMoves(pokemonId) {
            const boss = pkmn[pokemonId];
            if (!boss) return ['tackle', 'tackle', 'tackle', 'tackle'];

            const types = Array.isArray(boss.type) ? boss.type : [];
            const moves = [];
            const used = new Set();

            if (boss.signature && boss.signature.id && move[boss.signature.id]) {
                moves.push(boss.signature.id);
                used.add(boss.signature.id);
            }

            const candidates = [];
            for (let moveId in move) {
                if (used.has(moveId)) continue;
                const m = move[moveId];
                if (!m || m.power === undefined || m.power <= 0) continue;
                const moveset = Array.isArray(m.moveset) ? m.moveset : [];
                const canLearn = moveset.includes('all') || types.some(t => moveset.includes(t));
                if (!canLearn) continue;
                candidates.push({ id: moveId, power: m.power });
            }

            candidates.sort((a, b) => b.power - a.power);

            for (let cand of candidates) {
                if (moves.length >= 4) break;
                if (!used.has(cand.id)) {
                    moves.push(cand.id);
                    used.add(cand.id);
                }
            }

            const defaultMoves = ['hyperBeam', 'earthquake', 'fireBlast', 'thunderbolt'];
            for (let d of defaultMoves) {
                if (moves.length >= 4) break;
                if (!used.has(d) && move[d]) {
                    moves.push(d);
                    used.add(d);
                }
            }
            while (moves.length < 4) moves.push('tackle');
            return moves;
        }

        function updateGmaxAreas() {
            for (const areaId in areas) {
                if (areaId.startsWith('gmaxChallenge_')) {
                    delete areas[areaId];
                }
            }
            currentGmaxBosses.forEach(id => {
                const areaId = `gmaxChallenge_${id}`;
                if (areas[areaId]) return;
                areas[areaId] = {
                    id: areaId,
                    name: `超极巨·${format(id)}`,
                    type: 'event',
                    trainer: true,
                    encounter: true,
                    level: BOSS_LEVEL,
                    difficulty: 800,

                    icon: pkmn[id],
                    background: 'space',
                    unlockRequirement: () => true,
                    unlockDescription: '',
                    encounterEffect: () => {},
                    team: {
                        slot1: pkmn[id],
                        slot1Moves: generateValidMoves(id)
                    },
                    fieldEffect: [],
                    timed: false,
                    ticketIndex: 0,
                    defeated: false,
                    itemReward: { 1: { item: GMAX_FRAGMENT, amount: 1 } },
                    reward: [],
                    drops: { common: [] },
                    spawns: { common: [] }
                };
            });
        }

        const originalSetWildPkmn = window.setWildPkmn;
        window.setWildPkmn = function() {
            originalSetWildPkmn();
            if (saved.currentArea && saved.currentArea.startsWith('gmaxChallenge_')) {
                wildBuffs.atkup1 = 99;
                wildBuffs.defup1 = 99;
                wildBuffs.satkup1 = 99;
                wildBuffs.sdefup1 = 99;
                wildBuffs.speup1 = 99;
                updateWildBuffs();
            }
        };

        function createGmaxPage() {
            if (document.getElementById('gmax-dimension-menu')) return;

            const page = document.createElement('div');
            page.id = 'gmax-dimension-menu';
            page.style.display = 'none';
            page.style.position = 'fixed';
            page.style.height = '100%';
            page.style.width = '50%';
            page.style.background = 'url("img/bg/dimension-1.jpg")';
            page.style.backgroundSize = 'cover';
            page.style.zIndex = '150';
            page.style.overflow = 'scroll';
            page.style.overflowX = 'hidden';
            page.style.flexDirection = 'column';
            page.style.paddingBottom = '3rem';

            const header = document.createElement('div');
            header.style.height = '5rem';
            header.style.width = '100%';
            header.style.display = 'flex';
            header.style.justifyContent = 'space-between';
            header.style.alignItems = 'center';
            header.style.padding = '0.4rem 2%';
            header.style.marginBottom = '1rem';
            header.style.zIndex = '3';

            const menuButton = document.createElement('div');
            menuButton.style.display = 'flex';
            menuButton.style.alignItems = 'center';
            menuButton.style.gap = '5px';
            menuButton.style.background = 'rgba(0,0,0,0.5)';
            menuButton.style.border = '1px solid rgba(255,255,255,0.7)';
            menuButton.style.borderRadius = '0.5rem';
            menuButton.style.padding = '0.5rem 1rem';
            menuButton.style.cursor = 'pointer';
            menuButton.style.color = 'white';
            menuButton.style.fontSize = '1.2rem';
            menuButton.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="24" height="24">
                  <path d="M3 12a9 9 0 1 0 18 0 9 9 0 1 0 -18 0"></path>
                  <path d="M9 12a3 3 0 1 0 6 0 3 3 0 1 0 -6 0"></path>
                  <path d="M3 12h6"></path>
                  <path d="M15 12h6"></path>
                </svg>
                <span>菜单</span>
            `;
            menuButton.onclick = () => {
                page.style.display = 'none';
                openMenu();
            };

            const titleSpan = document.createElement('span');
            titleSpan.style.display = 'flex';
            titleSpan.style.alignItems = 'center';
            titleSpan.style.background = 'rgba(0,0,0,0.5)';
            titleSpan.style.border = '1px solid rgba(255,255,255,0.7)';
            titleSpan.style.borderRadius = '0.5rem';
            titleSpan.style.padding = '0.5rem 1rem';
            titleSpan.style.color = 'white';
            titleSpan.style.fontSize = '1.5rem';
            titleSpan.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" style="margin-right:0.5rem;"><path fill="currentColor" d="M21.22 6.894a3.7 3.7 0 0 0-1.4-1.37l-6-3.31a3.83 3.83 0 0 0-3.63 0l-6 3.31a3.7 3.7 0 0 0-1.4 1.37a3.74 3.74 0 0 0-.52 1.9v6.41a3.79 3.79 0 0 0 1.92 3.27l6 3.3a3.74 3.74 0 0 0 3.63 0l6-3.31a3.72 3.72 0 0 0 1.91-3.26v-6.36a3.64 3.64 0 0 0-.51-1.95m-1 8.31a2.2 2.2 0 0 1-1.14 1.95l-6 3.31q-.158.089-.33.14v-8.18l7.3-4.39c.092.242.136.5.13.76z"/></svg>
                超极巨化空间
            `;

            header.appendChild(menuButton);
            header.appendChild(titleSpan);

            const content = document.createElement('div');
            content.style.width = '100%';
            content.style.padding = '10px';
            content.style.display = 'flex';
            content.style.flexDirection = 'column';
            content.style.gap = '20px';

            const statsBar = document.createElement('div');
            statsBar.className = 'gmax-stats';
            statsBar.style.display = 'flex';
            statsBar.style.flexDirection = window.innerWidth < 768 ? 'column' : 'row';
            statsBar.style.justifyContent = 'space-between';
            statsBar.style.alignItems = 'center';
            statsBar.style.background = 'rgba(0,0,0,0.6)';
            statsBar.style.borderRadius = '50px';
            statsBar.style.padding = '15px 20px';
            statsBar.style.border = '1px solid #4ecca3';
            statsBar.style.boxShadow = '0 0 20px rgba(78, 204, 163, 0.5)';
            statsBar.style.marginBottom = '10px';
            statsBar.style.gap = '10px';
            statsBar.innerHTML = `
                <div style="display:flex; align-items:center; gap:10px;font-size:clamp(1.2rem, 5vw, 1.5rem); color:white;">
                    <img src="img/items/wormholeResidue.png" style="width:32px; height:32px; filter:drop-shadow(0 0 10px gold); flex-shrink:0;">
                    <span id="gmax-fragment-count">${item[GMAX_FRAGMENT]?.got || 0}</span>
                </div>
                <div style="display:flex; flex-direction:column; align-items:center; gap:5px;">
                    <button id="gmax-gacha-btn" style="background:linear-gradient(45deg, #ff6b6b, #ff4757); border:none; border-radius:40px; color:white; font-size:clamp(1.1rem, 4vw, 1.3rem); padding:8px 20px; cursor:pointer; font-weight:bold; text-shadow:0 2px 5px rgba(0,0,0,0.5); box-shadow:0 0 20px #ff6b6b; transition:0.2s;white-space:nowrap;">抽奖 (30碎片)</button>
                    <div style="font-size:0.8rem; color:#aaa; text-align:center;" data-help="gacha概率说明">50%未拥有 / 已拥有时10%闪光</div>
                </div>
                <div id="gmax-timer" style="font-size:clamp(1rem, 4vw, 1.3rem); color:#ffd966; text-shadow:0 0 10px orange;">BOSS刷新倒计时: 12:00:00</div>
            `;

            const cardContainer = document.createElement('div');
            cardContainer.id = 'gmax-card-container';
            cardContainer.style.display = 'flex';
            cardContainer.style.flexDirection = 'row';
            cardContainer.style.justifyContent = 'center';
            cardContainer.style.gap = 'clamp(10px, 2vw, 20px)';
            cardContainer.style.flexWrap = 'wrap';
            cardContainer.style.padding = '20px 0';

            content.appendChild(statsBar);
            content.appendChild(cardContainer);

            page.appendChild(header);
            page.appendChild(content);

            document.getElementById('main-content').appendChild(page);

            document.getElementById('gmax-gacha-btn').addEventListener('click', performGacha);
        }

        function updateGmaxPageDisplay() {
            const container = document.getElementById('gmax-card-container');
            if (!container) return;
            container.innerHTML = '';

            currentGmaxBosses.forEach(id => {
                const boss = pkmn[id];
                if (!boss) return;

                const card = document.createElement('div');
                card.className = 'dimension-pokemon';
                card.style.position = 'relative';
                card.style.height = 'clamp(10rem, 30vw, 12rem)';
                card.style.width = 'clamp(10rem, 30vw, 12rem)';
                card.style.display = 'flex';
                card.style.flexDirection = 'column';
                card.style.justifyContent = 'center';
                card.style.alignItems = 'center';
                card.style.cursor = 'pointer';
                card.style.transition = '0.1s';
                card.style.margin = '0 auto';
                card.dataset.pkmn = id;
                card.dataset.boss = id;
                card.innerHTML = `
                    <img class="dimension-bhole" src="img/icons/bhole.png" style="position:absolute; height:20rem; width:20rem; animation:rotate 20s infinite linear; opacity:0.8; pointer-events:none; max-width:200%;">
                    <img class="dimension-bhole" src="img/icons/bhole.png" style="position:absolute; height:20rem; width:20rem; animation:rotate 20s infinite linear reverse; scale:1.3; opacity:0.8; pointer-events:none; max-width:200%;">
                    <img class="dimension-sprite sprite-trim" src="img/pkmn/sprite/${id}.png" style="animation:pkmn-active 1.5s infinite;image-rendering:pixelated; scale:2; opacity:0.8; z-index:2; margin-bottom:0.5rem; max-width:80%;">
                    <div style="font-size:clamp(1rem, 4vw, 1.2rem); color:gold; text-shadow:0 0 10px gold; background:rgba(0,0,0,0.6); padding:4px 10px; border-radius:20px; z-index:3;">★★★★★★★★★★</div>
                `;

                card.addEventListener('click', e => {
                    e.stopPropagation();
                    startGmaxChallenge(id);
                });
                container.appendChild(card);
            });

            const fragSpan = document.getElementById('gmax-fragment-count');
            if (fragSpan) {
                fragSpan.textContent = item[GMAX_FRAGMENT]?.got || 0;
                fragSpan.style.color = 'white';
            }
        }

        function startPageCountdown() {
            if (countdownInterval) clearInterval(countdownInterval);
            const timerEl = document.getElementById('gmax-timer');
            if (!timerEl) return;

            countdownInterval = setInterval(() => {
                const now = Date.now();
                const nextRefresh = lastRotationTime + ROTATION_HOURS * 60 * 60 * 1000;
                const diff = nextRefresh - now;

                if (diff <= 0) {
                    refreshGmaxBosses();
                    updateGmaxAreas();
                    updateGmaxPageDisplay();
                } else {
                    const hours = Math.floor(diff / 3600000);
                    const minutes = Math.floor((diff % 3600000) / 60000);
                    const seconds = Math.floor((diff % 60000) / 1000);
                    timerEl.textContent = `刷新倒计时: ${hours.toString().padStart(2,'0')}:${minutes.toString().padStart(2,'0')}:${seconds.toString().padStart(2,'0')}`;
                }
                const fragSpan = document.getElementById('gmax-fragment-count');
                if (fragSpan) {
                    fragSpan.textContent = item[GMAX_FRAGMENT]?.got || 0;
                    fragSpan.style.color = 'white';
                }
            }, 1000);
        }

        function performGacha() {
            const fragments = item[GMAX_FRAGMENT]?.got || 0;
            if (fragments < GACHA_COST) {
                showFormalMessage('碎片不足', `需要 ${GACHA_COST} 个碎片。`);
                return;
            }
            item[GMAX_FRAGMENT].got -= GACHA_COST;
            saveGame();

            const allPokemon = [];
            for (const id in pkmn) {
                if (!pkmn[id].hidden) allPokemon.push(id);
            }

            const unowned = allPokemon.filter(id => pkmn[id].caught === 0);
            let resultPkmn = null;
            let isShiny = false;

            if (unowned.length > 0 && Math.random() < 0.5) {
                resultPkmn = unowned[Math.floor(Math.random() * unowned.length)];
                givePkmn(pkmn[resultPkmn], 1);
            } else {
                const owned = allPokemon.filter(id => pkmn[id].caught > 0);
                if (owned.length === 0) {
                    showFormalMessage('抽奖失败', '还没有任何宝可梦，无法抽奖！');
                    return;
                }
                resultPkmn = owned[Math.floor(Math.random() * owned.length)];
                if (Math.random() < 0.1) {
                    pkmn[resultPkmn].shiny = true;
                    isShiny = true;
                }
            }

            let message = `恭喜获得：${format(resultPkmn)}`;
            if (isShiny) message += ` ✦ 闪光！ ✦`;
            showFormalMessage('抽奖结果', message, resultPkmn);

            const fragSpan = document.getElementById('gmax-fragment-count');
            if (fragSpan) {
                fragSpan.textContent = item[GMAX_FRAGMENT]?.got || 0;
                fragSpan.style.color = 'white';
            }
        }

        function startGmaxChallenge(bossId) {
            const areaId = `gmaxChallenge_${bossId}`;
            if (!areas[areaId]) return;

            saved.currentAreaBuffer = areaId;

            const previewExit = document.getElementById('preview-team-exit');
            const teamMenu = document.getElementById('team-menu');
            const menuButton = document.getElementById('menu-button-parent');
            const exploreMenu = document.getElementById('explore-menu');
            const gmaxPage = document.getElementById('gmax-dimension-menu');

            if (previewExit && teamMenu && menuButton && exploreMenu && gmaxPage) {
                previewExit.style.display = 'flex';
                teamMenu.style.zIndex = '50';
                teamMenu.style.display = 'flex';
                menuButton.style.display = 'none';
                exploreMenu.style.display = 'none';
                gmaxPage.style.display = 'none';
            }
            const menuBtn = document.getElementById('menu-button');
            if (menuBtn && menuBtn.classList.contains('menu-button-open')) {
                menuBtn.classList.remove('menu-button-open');
            }
            afkSeconds = 0;
            if (typeof updatePreviewTeam === 'function') updatePreviewTeam();
        }

        function openGmaxPage() {
            const gmaxPage = document.getElementById('gmax-dimension-menu');
            if (!gmaxPage) {
                createGmaxPage();
                setTimeout(() => openGmaxPage(), 50);
                return;
            }
            const menus = ['explore-menu', 'vs-menu', 'item-menu', 'team-menu', 'pokedex-menu', 'settings-menu', 'guide-menu', 'genetics-menu', 'shop-menu', 'training-menu', 'dimension-menu'];
            menus.forEach(id => {
                const el = document.getElementById(id);
                if (el) el.style.display = 'none';
            });
            gmaxPage.style.display = 'flex';

            const now = Date.now();
            const hoursSince = (now - lastRotationTime) / (1000 * 60 * 60);
            if (hoursSince >= ROTATION_HOURS) {
                refreshGmaxBosses();
                updateGmaxAreas();
            }
            updateGmaxPageDisplay();
            startPageCountdown();

            const statsBar = document.querySelector('#gmax-dimension-menu .gmax-stats');
            if (statsBar) {
                const updateLayout = () => {
                    if (window.innerWidth < 768) {
                        statsBar.style.flexDirection = 'column';
                    } else {
                        statsBar.style.flexDirection = 'row';
                    }
                };
                window.addEventListener('resize', updateLayout);
                updateLayout();
            }
        }

        function addMenuItemToMainMenu() {
            const menuItems = document.getElementById('menu-items');
            if (!menuItems) {
                setTimeout(addMenuItemToMainMenu, 500);
                return;
            }
            if (document.getElementById('gmax-menu-item')) return;

            const menuItem = document.createElement('div');
            menuItem.id = 'gmax-menu-item';
            menuItem.className = 'menu-item';
            menuItem.innerHTML = `
                <img src="img/items/wormholeResidue.png" style="image-rendering:pixelated;">
                <span>超极巨化空间</span>
            `;
            menuItem.addEventListener('click', () => {
                if (menuItem.classList.contains('menu-item-locked')) {
                    const dexCount = getDexCount();
                    showFormalMessage('未解锁', `需要图鉴数达到1137（当前 ${dexCount}）`);
                    return;
                }
                openGmaxPage();
            });

            menuItems.appendChild(menuItem);
            updateMenuItemLock();
        }

        function updateMenuItemLock() {
            const menuItem = document.getElementById('gmax-menu-item');
            if (!menuItem) return;
            const dexCount = getDexCount();
            if (dexCount >= 1137) {
                menuItem.classList.remove('menu-item-locked');
            } else {
                menuItem.classList.add('menu-item-locked');
            }
        }

        let battleEnded = false;
        function startHealthCheck() {
            setInterval(() => {
                if (!saved.currentArea || !saved.currentArea.startsWith('gmaxChallenge_')) {
                    battleEnded = false;
                    return;
                }
                if (battleEnded) return;

                let hp = window.wildPkmnHp;
                if (hp !== undefined && hp <= 0) {
                    battleEnded = true;
                    setTimeout(() => {
                        const leaveBtn = document.getElementById('explore-leave');
                        if (leaveBtn) leaveBtn.click();
                        else if (typeof leaveCombat === 'function') leaveCombat();
                    }, 500);
                }
            }, 500);
        }

        function injectStyles() {
            const style = document.createElement('style');
            style.textContent = `
                #gmax-dimension-menu { background-image: url('img/bg/dimension-1.jpg') !important; background-size: cover; }
                #gmax-dimension-menu .dimension-pokemon {  }
                @media (max-width: 768px) {
                    #gmax-dimension-menu { width: 100% !important; }
                    #gmax-dimension-menu .gmax-stats { flex-direction: column !important; gap: 10px !important; }
                }
                #gmax-menu-item { cursor: pointer; }
                #gmax-gacha-btn:hover { transform: scale(1.05); box-shadow: 0 0 30px #ff4757; }
                [data-help="gacha概率说明"] { cursor: help; }
            `;
            document.head.appendChild(style);
        }

        function waitForGame() {
            if (typeof areas !== 'undefined' && typeof item !== 'undefined' && typeof pkmn !== 'undefined' && typeof givePkmn !== 'undefined' && typeof saveGame !== 'undefined' && typeof updatePreviewTeam !== 'undefined') {
                init();
            } else {
                setTimeout(waitForGame, 100);
            }
        }

        function init() {
            ensureCustomItems();
            refreshGmaxBosses();
            updateGmaxAreas();
            addMenuItemToMainMenu();
            startHealthCheck();
            setInterval(updateMenuItemLock, 5000);
            console.log('[超极巨化空间] 正式版已启动，使用自定义超极巨化碎片，点击保存并退出返回活动');
        }

        injectStyles();
        waitForGame();
    }

  window[MOD_ID + "_installed"] = true;
}

function remove() {
  window[MOD_ID + "_installed"] = false;
  if (__orig.loadGame) window.loadGame = __orig.loadGame;
  if (__orig.setWildPkmn) window.setWildPkmn = __orig.setWildPkmn;
  if (__orig.updateItemShop) window.updateItemShop = __orig.updateItemShop;
  const ids = ["gmax-menu-item", "gmax-dimension-menu"];
  ids.forEach(id => { const el = document.getElementById(id); if (el) el.remove(); });
}
