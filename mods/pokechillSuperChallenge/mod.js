const MOD_ID = "pokechillSuperChallenge";
const STYLE_ID = MOD_ID + "-style";

UltraMods.define({
  id: MOD_ID,
  name: "Pokechill 超级挑战",
  description: "将「超级挑战」独立为 mod：按图鉴解锁顺序开放 Boss 挑战区域，掉落麻辣鸭腿等稀有奖励，并在主商店/进化商店注入对应道具。由 mod 管理器独立启用或禁用。",
  image: "img/items/whiteApricorn.png",
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

    const settings = { enableSuperChallenge: true };

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

    if (settings.enableSuperChallenge) {
        const CARD_VISIBLE_DEX = 1000;
        const CARD_CLICKABLE_DEX = 1115;
        const ENTRY_COST_ITEM = 'whiteApricorn';
        const ENTRY_COST_AMOUNT = 0;

        const SPICY_LEG = 'spicyDuckLeg';
        const SPICY_LEG_IMAGE_URL = 'https://picui.ogmua.cn/s1/2026/03/10/69b009718818c.webp';

        if (typeof afkSeconds === 'undefined') var afkSeconds = 0;

        const MEGA_POKEMON_TO_STONE_MAP = {
            'megaAbsol': 'absolite',
            'megaAlakazam': 'alakazite',
            'megaAmpharos': 'ampharosite',
            'megaAudino': 'audinite',
            'megaBanette': 'banettite',
            'megaBeedrill': 'beedrillite',
            'megaBlastoise': 'blastoisinite',
            'megaBlaziken': 'blazikenite',
            'megaCamerupt': 'cameruptite',
            'megaCharizard': 'charizarditeX',
            'megaCharizardFemale': 'charizarditeY',
            'megaCharizardX': 'charizarditeX',
            'megaCharizardY': 'charizarditeY',
            'megaDiancie': 'diancite',
            'megaGallade': 'galladite',
            'megaGarchomp': 'garchompite',
            'megaGardevoir': 'gardevoirite',
            'megaGengar': 'gengarite',
            'megaGlalie': 'glalitite',
            'megaGyarados': 'gyaradosite',
            'megaHeracross': 'heracronite',
            'megaHoundoom': 'houndoominite',
            'megaKangaskhan': 'kangaskhanite',
            'megaLatias': 'latiasite',
            'megaLatios': 'latiosite',
            'megaLopunny': 'lopunnite',
            'megaLucario': 'lucarionite',
            'megaManectric': 'manectite',
            'megaMawile': 'mawilite',
            'megaMedicham': 'medichamite',
            'megaMetagross': 'metagrossite',
            'megaMewtwo': 'mewtwoniteX',
            'megaMewtwoX': 'mewtwoniteX',
            'megaMewtwoY': 'mewtwoniteY',
            'megaPidgeot': 'pidgeotite',
            'megaPinsir': 'pinsirite',
            'megaSableye': 'sablenite',
            'megaSalamence': 'salamencite',
            'megaSceptile': 'sceptilite',
            'megaScizor': 'scizorite',
            'megaSharpedo': 'sharpedonite',
            'megaSlowbro': 'slowbronite',
            'megaSteelix': 'steelixite',
            'megaSwampert': 'swampertite',
            'megaTyranitar': 'tyranitarite',
            'megaVenusaur': 'venusaurite',
            'megaAltaria': 'altarianite',
        };

        const ITEMS_FOR_EVOLUTION_SHOP = new Map();

        const ALL_BOSSES_IN_ORDER = [
            { id: 'burmySandy', price: 5, stars: 2 },
            { id: 'burmyTrash', price: 5, stars: 2 },
            { id: 'galarianMrmime', price: 20, stars: 4 },
            { id: 'megaSableye', price: 50, stars: 5 },
            { id: 'megaAudino', price: 50, stars: 6 },
            { id: 'megaBanette', price: 55, stars: 6 },
            { id: 'megaSharpedo', price: 55, stars: 6 },
            { id: 'megaHoundoom', price: 60, stars: 6 },
            { id: 'megaAmpharos', price: 60, stars: 6 },
            { id: 'megaSlowbro', price: 65, stars: 7 },
            { id: 'megaAltaria', price: 65, stars: 7 },
            { id: 'megaLopunny', price: 65, stars: 7 },
            { id: 'megaMedicham', price: 55, stars: 6 },
            { id: 'megaGardevoir', price: 75, stars: 8 },
            { id: 'rayquaza', price: 70, stars: 7 },
            { id: 'megaAbsol', price: 70, stars: 7 },
            { id: 'megaKangaskhan', price: 70, stars: 7 },
            { id: 'megaSalamence', price: 80, stars: 8 },
            { id: 'kyuremWhite', price: 90, stars: 9 },
            { id: 'megaRayquaza', price: 99, stars: 10 },
            { id: 'arceus', price: 9999, stars: 10 }
        ];

        let BOSS_CONFIG = ALL_BOSSES_IN_ORDER.reduce((acc, currentBoss, index) => {
            const prevBoss = ALL_BOSSES_IN_ORDER[index - 1];
            acc.push({
                ...currentBoss,
                prevId: prevBoss ? prevBoss.id : null
            });
            return acc;
        }, []);

        console.log('[超级挑战] Boss解锁顺序已配置:', BOSS_CONFIG.map(b => ({ id: b.id, prevId: b.prevId })));

        const priceMap = {};
        const evolutionPriceMap = {};
        function ensureSpicyLeg() {
            if (!item[SPICY_LEG]) {
                item[SPICY_LEG] = {
                    id: SPICY_LEG,
                    name: '麻辣鸭腿',
                    rename: '麻辣鸭腿',
                    type: 'key',
                    got: 0,
                    newItem: 0,
                    info: function() { return '超级挑战中掉落的稀有物品...'; }
                };
            }
            if (item[SPICY_LEG].newItem === undefined) {
                item[SPICY_LEG].newItem = 0;
            }
        }

        const originalLoadGame = window.loadGame;
        window.loadGame = function() {
            const result = originalLoadGame ? originalLoadGame() : undefined;
            ensureSpicyLeg();
            return result;
        };

        const originalSetWildPkmn = window.setWildPkmn;
        window.setWildPkmn = function() {
            originalSetWildPkmn();
            if (saved.currentArea && saved.currentArea.startsWith('superChallenge_')) {
                const areaId = saved.currentArea;
                const bossId = areaId.replace('superChallenge_', '');
                const config = BOSS_CONFIG.find(c => c.id === bossId);
                const stars = config ? config.stars : 5;

                if (stars >= 4) wildBuffs.atkup1 = 99;
                if (stars >= 6) wildBuffs.defup1 = 99;
                if (stars >= 8) wildBuffs.satkup1 = 99;
                if (stars >= 9) wildBuffs.sdefup1 = 99;
                if (stars >= 10) wildBuffs.speup1 = 99;
                updateWildBuffs();
            }
        };

        function waitForGame() {
            if (typeof areas !== 'undefined' && typeof item !== 'undefined' && typeof pkmn !== 'undefined' && typeof givePkmn !== 'undefined' && typeof saveGame !== 'undefined' && typeof updatePreviewTeam !== 'undefined') {
                init();
            } else {
                setTimeout(waitForGame, 100);
            }
        }

        function init() {
            ensureSpicyLeg();
            defineChallengeAreas();
            addMainCardToExploreMenu();
            addMainShopItems();
            addEvolutionShopItems();
            observeMenu();
            injectCustomStyles();
            hookItemShopImages();
            startHealthCheck();
            setInterval(updateCardLock, 5000);
            console.log('[超级挑战] 已启动，奖励修复版 + 商店中文提示。非Mega精灵进主商店，Mega石等进进化商店。Boss需按顺序击败解锁。');
        }

        function generateValidMoves(pokemonId, stars = 5) {
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
                candidates.push({ id: moveId, power: m.power, timer: m.timer || 2000 });
            }

            if (stars >= 8) {
                candidates.sort((a, b) => b.power - a.power);
            } else if (stars >= 5) {
                candidates.sort((a, b) => (b.power * 0.7 + (2000 / (b.timer || 2000)) * 0.3) - (a.power * 0.7 + (2000 / (a.timer || 2000)) * 0.3));
            } else {
                candidates.sort(() => Math.random() - 0.5);
            }

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

        function defineChallengeAreas() {
            const APRICORN_COMMON = ['yellowApricorn', 'pinkApricorn', 'greenApricorn'];
            const APRICORN_RARE = ['whiteApricorn'];
            const APRICORN_VERY_RARE = ['blackApricorn'];

            const ITEM_POOL = {
                low: ['focusBand', 'kingsRock'],
                medium: ['lifeOrb', 'choiceBand'],
                high: ['assaultVest', 'leftovers'],
                veryHigh: ['choiceSpecs', 'weaknessPolicy']
            };

            const FIELD_EFFECTS = {
                low: ['field.heavyWeather'],
                medium: ['field.weakeningCurse'],
                high: ['field.fatiguingCurse'],
                veryHigh: ['field.wonderWard', 'field.neutralisingGas']
            };

            BOSS_CONFIG.forEach(({ id, stars, prevId }) => {
                const areaId = `superChallenge_${id}`;
                const itemReward = { 1: { item: SPICY_LEG, amount: 1 } };

                let rewardIndex = 2;
                if (stars >= 1 && stars <= 3) {
                    const berry = APRICORN_COMMON[Math.floor(Math.random() * APRICORN_COMMON.length)];
                    itemReward[rewardIndex++] = { item: berry, amount: 1 };
                } else if (stars >= 4 && stars <= 6) {
                    for (let i = 0; i < 2; i++) {
                        const berry = APRICORN_COMMON[Math.floor(Math.random() * APRICORN_COMMON.length)];
                        itemReward[rewardIndex++] = { item: berry, amount: 1 };
                    }
                } else if (stars >= 7 && stars <= 9) {
                    for (let i = 0; i < 2; i++) {
                        const berry = APRICORN_COMMON[Math.floor(Math.random() * APRICORN_COMMON.length)];
                        itemReward[rewardIndex++] = { item: berry, amount: 1 };
                    }
                    const rareBerry = APRICORN_RARE[Math.floor(Math.random() * APRICORN_RARE.length)];
                    itemReward[rewardIndex++] = { item: rareBerry, amount: 1 };
                    itemReward[rewardIndex++] = { item: 'goldenBottleCap', amount: 1 };
                } else if (stars === 10) {
                    for (let i = 0; i < 2; i++) {
                        const berry = APRICORN_COMMON[Math.floor(Math.random() * APRICORN_COMMON.length)];
                        itemReward[rewardIndex++] = { item: berry, amount: 1 };
                    }
                    const rareBerry = APRICORN_RARE[Math.floor(Math.random() * APRICORN_RARE.length)];
                    itemReward[rewardIndex++] = { item: rareBerry, amount: 1 };
                    const veryRareBerry = APRICORN_VERY_RARE[Math.floor(Math.random() * APRICORN_VERY_RARE.length)];
                    itemReward[rewardIndex++] = { item: veryRareBerry, amount: 1 };
                    itemReward[rewardIndex++] = { item: 'goldenBottleCap', amount: 2 };
                }

                const difficulty = 300 + stars * 80;
                let bossItem = undefined;
                if (stars <= 3) {
                    bossItem = ITEM_POOL.low[Math.floor(Math.random() * ITEM_POOL.low.length)];
                } else if (stars <= 5) {
                    bossItem = ITEM_POOL.medium[Math.floor(Math.random() * ITEM_POOL.medium.length)];
                } else if (stars <= 7) {
                    bossItem = ITEM_POOL.high[Math.floor(Math.random() * ITEM_POOL.high.length)];
                } else {
                    bossItem = ITEM_POOL.veryHigh[Math.floor(Math.random() * ITEM_POOL.veryHigh.length)];
                }

                const fieldEffects = [];
                if (stars >= 4) fieldEffects.push(FIELD_EFFECTS.low[0]);
                if (stars >= 6) fieldEffects.push(FIELD_EFFECTS.medium[0]);
                if (stars >= 8) fieldEffects.push(FIELD_EFFECTS.high[0]);
                if (stars >= 9) fieldEffects.push(FIELD_EFFECTS.veryHigh[0]);
                if (stars === 10) fieldEffects.push(FIELD_EFFECTS.veryHigh[1]);

                let unlockRequirement, unlockDescription;
                if (prevId) {
                    unlockRequirement = function() {
                        const prevAreaId = `superChallenge_${prevId}`;
                        return item[ENTRY_COST_ITEM] && item[ENTRY_COST_ITEM].got >= ENTRY_COST_AMOUNT && areas[prevAreaId] && areas[prevAreaId].defeated;
                    };
                    const prevBossName = format(prevId) || prevId;
                    unlockDescription = `需要 ${ENTRY_COST_AMOUNT} 个 ${format(ENTRY_COST_ITEM)}，并击败 ${prevBossName}`;
                } else {
                    unlockRequirement = function() {
                        return item[ENTRY_COST_ITEM] && item[ENTRY_COST_ITEM].got >= ENTRY_COST_AMOUNT;
                    };
                    unlockDescription = `需要 ${ENTRY_COST_AMOUNT} 个 ${format(ENTRY_COST_ITEM)}`;
                }

                areas[areaId] = {
                    id: areaId,
                    name: `超级挑战·${format(id)}`,
                    type: 'event',
                    trainer: true,
                    encounter: true,
                    level: 100,
                    difficulty: difficulty,

                    icon: pkmn[id],
                    background: 'space',
                    unlockRequirement: unlockRequirement,
                    unlockDescription: unlockDescription,
                    encounterEffect: function() {
                        if (item[ENTRY_COST_ITEM]) item[ENTRY_COST_ITEM].got -= ENTRY_COST_AMOUNT;
                    },
                    team: {
                        slot1: pkmn[id],
                        slot1Moves: generateValidMoves(id, stars)
                    },
                    ...(bossItem && { slot1Item: bossItem }),
                    fieldEffect: fieldEffects.map(eff => eff.replace('field.', '')),
                    timed: false,
                    ticketIndex: 0,
                    defeated: false,
                    itemReward: itemReward,
                    drops: { common: [] },
                    spawns: { common: [] },
                    reward: []
                };
            });
        }

        function addMainCardToExploreMenu() {
            const exploreMenu = document.getElementById('explore-menu');
            if (!exploreMenu) return;

            const old = document.getElementById('superChallengeMainCard');
            if (old) old.remove();

            const card = document.createElement('div');
            card.id = 'superChallengeMainCard';
            card.className = 'explore-ticket';
            card.style.marginBottom = '10px';
            card.style.cursor = 'pointer';
            card.innerHTML = `
                <span class="hitbox"></span>
                <div style="width: 100%;">
                    <span class="explore-ticket-left">
                        <span><strong style="background:#8B0000; color:white; padding:2px 8px; border-radius:4px;">超级挑战</strong></span>
                    </span>
                    <div id="dexRequirement" style="width: 20%; margin-top: 5px;margin-left:-50px; font-size: 20x; opacity:0.8; border-radius:4px;"></div>
                </div>
                <div style="width: 8rem;" class="explore-ticket-right">
                    <span class="explore-ticket-bg" style="background-image: url(img/bg/space.png);"></span>
                    <img class="explore-ticket-sprite sprite-trim" style="z-index: 10;" src="img/pkmn/sprite/arceus.png">
                </div>
            `;
            exploreMenu.appendChild(card);
            card.addEventListener('click', openChallengeMenu);
            updateCardLock();
        }

        function updateCardLock() {
            const card = document.getElementById('superChallengeMainCard');
            if (!card) return;
            const reqSpan = card.querySelector('#dexRequirement');
            if (!reqSpan) return;

            const dexCount = getDexCount();
            if (dexCount >= CARD_CLICKABLE_DEX) {
                card.style.filter = 'brightness(1)';
                card.style.pointerEvents = 'auto';
                card.style.display = '';
                reqSpan.innerHTML = `已解锁 (${dexCount}/${CARD_CLICKABLE_DEX})`;
            } else if (dexCount >= CARD_VISIBLE_DEX) {
                card.style.filter = 'brightness(0.5) grayscale(80%)';
                card.style.pointerEvents = 'none';
                card.style.display = '';
                reqSpan.innerHTML = `需要图鉴数 ${CARD_CLICKABLE_DEX} (当前 ${dexCount})`;
            } else {
                card.style.display = 'none';
            }
        }

        function getDexCount() {
            return Object.values(pkmn).filter(p => p && p.caught > 0).length;
        }

        function getTotalPkmnCount() {
            return Object.values(pkmn).filter(p => p && !p.hidden && !p.unobtainable).length-1;
        }

        let currentOverlay = null;

        function openChallengeMenu() {
            if (getDexCount() < CARD_CLICKABLE_DEX) return;
            if (currentOverlay) closeChallengeMenu();

            const overlay = document.createElement('div');
            overlay.className = 'super-challenge-overlay';
            overlay.id = 'superChallengeOverlay';
            overlay.addEventListener('click', e => {
                if (e.target === overlay) closeChallengeMenu();
            });

            const container = document.createElement('div');
            container.className = 'super-challenge-container';
            container.innerHTML = `
                <div class="super-challenge-header">
                    <span>🔥超级挑战🔥</span>
                    <span class="super-challenge-close" id="superChallengeCloseBtn">✖</span>
                </div>
                <div class="super-challenge-list" id="superChallengeList"></div>
            `;

            overlay.appendChild(container);
            document.body.appendChild(overlay);
            currentOverlay = overlay;

            document.getElementById('superChallengeCloseBtn').addEventListener('click', closeChallengeMenu);

            const listDiv = document.getElementById('superChallengeList');
            const sortedBosses = [...BOSS_CONFIG].sort((a, b) => (a.stars || 5) - (b.stars || 5));

            sortedBosses.forEach(({ id, stars, prevId }) => {
                const boss = pkmn[id];
                if (!boss) return;

                const starCount = stars || 5;
                const starString = '★'.repeat(starCount) + '☆'.repeat(10 - starCount);
                const areaId = `superChallenge_${id}`;
                const isUnlocked = areas[areaId]?.unlockRequirement?.();
                const isDefeated = areas[areaId]?.defeated;
                const hasPrev = prevId !== null;

                const card = document.createElement('div');
                card.className = 'super-challenge-card';
                if (!isUnlocked) {
                    card.classList.add('locked');
                    card.style.opacity = '0.5';
                    card.style.pointerEvents = 'none';
                }
                card.setAttribute('data-boss', id);

                let statusText = '';
                if (isDefeated) {
                    statusText = '<span style="color: #4CAF50;">[已击败]</span>';
                } else if (isUnlocked) {
                    statusText = '<span style="color: #FFC107;">[可挑战]</span>';
                } else {
                    if (hasPrev) {
                        const prevBossName = format(prevId) || prevId;
                        statusText = `<span style="color: #F44336;">[需先击败 ${prevBossName}]</span>`;
                    } else {
                        statusText = '<span style="color: #F44336;">[未解锁]</span>';
                    }
                }

                let costHtml = '';
                if (ENTRY_COST_AMOUNT > 0) {
                    costHtml = `<div class="super-challenge-card-cost">消耗: ${format(ENTRY_COST_ITEM)} x${ENTRY_COST_AMOUNT}</div>`;
                }

                card.innerHTML = `
                    <img src="img/pkmn/sprite/${id}.png" onerror="this.src='img/pkmn/sprite/missingno.png'">
                    <div class="super-challenge-card-info">
                        <div class="super-challenge-card-name">${format(id)} ${statusText}</div>
                        <div class="super-challenge-card-desc">等级100 · 难度 ${starString}</div>
                        ${costHtml}
                    </div>
                `;

                if (isUnlocked) {
                    card.addEventListener('click', e => {
                        e.stopPropagation();
                        startChallenge(id);
                        closeChallengeMenu();
                    });
                }
                listDiv.appendChild(card);
            });
            replaceSpicyLegImages();
        }

        function closeChallengeMenu() {
            if (currentOverlay) {
                currentOverlay.remove();
                currentOverlay = null;
            }
        }

        function startChallenge(bossId) {
            const areaId = `superChallenge_${bossId}`;
            if (!areas[areaId]) return;

            const config = BOSS_CONFIG.find(c => c.id === bossId);
            const stars = config ? config.stars : 5;
            const moves = generateValidMoves(bossId, stars);

            let bossItem = undefined;
            if (stars <= 3) {
                bossItem = ['focusBand', 'kingsRock'][Math.floor(Math.random() * 2)];
            } else if (stars <= 5) {
                bossItem = ['lifeOrb', 'choiceBand'][Math.floor(Math.random() * 2)];
            } else if (stars <= 7) {
                bossItem = ['assaultVest', 'leftovers'][Math.floor(Math.random() * 2)];
            } else {
                bossItem = ['choiceSpecs', 'weaknessPolicy'][Math.floor(Math.random() * 2)];
            }

            areas[areaId].team.slot1Moves = moves;
            if (bossItem) areas[areaId].team.slot1Item = bossItem;

            saved.currentAreaBuffer = areaId;

            const previewExit = document.getElementById('preview-team-exit');
            const teamMenu = document.getElementById('team-menu');
            const menuButton = document.getElementById('menu-button-parent');
            const exploreMenu = document.getElementById('explore-menu');

            if (previewExit && teamMenu && menuButton && exploreMenu) {
                previewExit.style.display = 'flex';
                teamMenu.style.zIndex = '50';
                teamMenu.style.display = 'flex';
                menuButton.style.display = 'none';
                exploreMenu.style.display = 'none';
            }
            afkSeconds = 0;
            if (typeof updatePreviewTeam === 'function') updatePreviewTeam();
        }

        function addMainShopItems() {
            if (typeof shop === 'undefined') {
                setTimeout(addMainShopItems, 200);
                return;
            }

            BOSS_CONFIG.forEach(({ id, price }) => {
                const shopId = `shop_super_${id}`;
                const isMegaPokemon = MEGA_POKEMON_TO_STONE_MAP.hasOwnProperty(id);
                if (isMegaPokemon) {
                    const stoneId = MEGA_POKEMON_TO_STONE_MAP[id];
                    ITEMS_FOR_EVOLUTION_SHOP.set(stoneId, price);
                    console.log(`[超级挑战商店] 发现Mega宝可梦 ${id}, 对应石头ID为 ${stoneId}, 加入进化商店队列，价格 ${price}。`);
                    return;
                }

                if (shop[shopId]) return;

                shop[shopId] = {
                    pkmn: id,
                    price: price,
                    currency: SPICY_LEG,
                    category: 'pokemon',
                    effect: function() { givePkmn(pkmn[id], 1); }
                };
                priceMap[id] = price;
            });

            if (typeof updateItemShop === 'function') updateItemShop();
        }

        function addEvolutionShopItems() {
            if (typeof shop === 'undefined') {
                setTimeout(addEvolutionShopItems, 200);
                return;
            }

            ITEMS_FOR_EVOLUTION_SHOP.forEach((price, itemId) => {
                const shopId = `shop_super_evolution_${itemId}`;
                if (!item[itemId]) {
                    console.warn(`[超级挑战进化商店] 道具 ${itemId} 不存在，无法添加。`);
                    return;
                }
                if (shop[shopId]) {
                    console.log(`[超级挑战进化商店] 道具 ${itemId} 的商店项已存在，跳过。`);
                    return;
                }

                shop[shopId] = {
                    icon: itemId,
                    price: price,
                    currency: SPICY_LEG,
                    category: 'evolution',
                    effect: function() { item[itemId].got += 1; }
                };
                evolutionPriceMap[itemId] = price;
                console.log(`[超级挑战进化商店] 添加道具 ${itemId} 到进化商店，价格 ${price}`);
            });

            if (typeof updateItemShop === 'function') updateItemShop();
        }

        function getChineseName(id) {
            if (!window.format) return id;
            const displayName = window.format(id);
            if (window.EN_CN_DICT && window.EN_CN_DICT[displayName]) {
                return window.EN_CN_DICT[displayName];
            }
            return displayName;
        }

        let battleEnded = false;

        function startHealthCheck() {
            setInterval(() => {
                if (!saved.currentArea || !saved.currentArea.startsWith('superChallenge_')) {
                    battleEnded = false;
                    return;
                }
                if (battleEnded) return;

                let hp = window.wildPkmnHp;
                if (hp === undefined && window.wildPkmn && window.wildPkmn.hp !== undefined) {
                    hp = window.wildPkmn.hp;
                }
                if (hp !== undefined && hp <= 0) {
                    battleEnded = true;
                    console.log('[超级挑战] 血量归零，尝试退出');
                    if (typeof updateWildPkmn === 'function') updateWildPkmn();
                    setTimeout(() => {
                        const leaveBtn = document.getElementById('explore-leave');
                        if (leaveBtn) leaveBtn.click();
                        else if (typeof leaveCombat === 'function') leaveCombat();
                    }, 500);
                }
            }, 500);
        }

        function hookItemShopImages() {
            const originalUpdateItemShop = window.updateItemShop;
            if (typeof originalUpdateItemShop === 'function') {
                window.updateItemShop = function() {
                    originalUpdateItemShop();
                    setTimeout(() => {
                        replaceSpicyLegImages();
                        bindShopEvents();
                    }, 50);
                };
            }
            setInterval(replaceSpicyLegImages, 2000);
        }

        function bindShopEvents() {
            const shopListing = document.getElementById('shop-listing');
            if (!shopListing) return;

            function shopClickHandler(event) {
                let target = event.target;
                while (target && target !== shopListing) {
                    // 处理宝可梦购买 (data-pkmn)
                    if (target.matches && target.matches('#shop-listing > div[data-pkmn]')) {
                        const id = target.dataset.pkmn;
                        if (priceMap[id] !== undefined) {
                            event.stopPropagation();
                            event.preventDefault();

                            if (id === 'arceus') {
                                const caught = getDexCount();
                                const total = getTotalPkmnCount();
                                if (caught < total) {
                                    showFormalMessage('无法购买', `需要先收集所有宝可梦 (${caught}/${total}) 才能购买阿尔宙斯！`);
                                    return;
                                }
                            }

                            const price = priceMap[id];
                            if (item[SPICY_LEG].got < price) {
                                showFormalMessage('无法购买', '麻辣鸭腿不足！');
                                return;
                            }
                            item[SPICY_LEG].got -= price;
                            givePkmn(pkmn[id], 1);
                            saveGame();
                            const chineseName = getChineseName(id);
                            showFormalMessage('购买成功', `获得 ${chineseName}！`, id);
                            updateItemShop();
                        }
                        break;
                    }
                    // 处理进化道具购买 (data-item)
                    if (target.matches && target.matches('#shop-listing > div[data-item]')) {
                        const itemId = target.dataset.item;
                        if (evolutionPriceMap[itemId] !== undefined) {
                            event.stopPropagation();
                            event.preventDefault();

                            const price = evolutionPriceMap[itemId];
                            const currency = SPICY_LEG;
                            const amount = 21; // 固定购买21个
                            const maxAffordable = Math.floor(item[currency].got / price);

                            if (maxAffordable < amount) {
                                showFormalMessage('无法购买', `麻辣鸭腿不足，最多只能购买 ${maxAffordable} 个！`);
                                return;
                            }

                            // 显示确认框（只显示x21）
                            document.getElementById("tooltipTop").style.display = "none";
                            document.getElementById("tooltipTitle").innerHTML = "确认购买";
                            document.getElementById("tooltipMid").style.display = "none";
                            document.getElementById("tooltipBottom").innerHTML = `
                                <span style="display:flex; justify-content:center; width:100%; flex-wrap:wrap">
                                    <div data-amount="21" style="cursor:pointer; font-size:2rem; width:30%" id="prevent-tooltip-exit">x21</div>
                                </span>
                            `;
                            document.querySelectorAll("#tooltipBottom div").forEach(el => {
                                el.addEventListener("click", () => {
                                    const totalCost = price * amount;
                                    if (item[currency].got >= totalCost) {
                                        item[currency].got -= totalCost;
                                        if (item[itemId].got === undefined) item[itemId].got = 0;
                                        item[itemId].got += amount;
                                        saveGame();
                                        const chineseName = getChineseName(itemId);
                                        showFormalMessage('购买成功', `获得 ${chineseName} x${amount}！`, itemId);
                                        updateItemShop();
                                        closeTooltip();
                                    } else {
                                        document.getElementById("tooltipTitle").innerHTML = "货币不足";
                                        document.getElementById("tooltipTop").style.display = "none";
                                        document.getElementById("tooltipMid").style.display = "none";
                                        document.getElementById("tooltipBottom").innerHTML = `麻辣鸭腿不足<span id="prevent-tooltip-exit"></span>`;
                                    }
                                });
                            });
                            openTooltip();
                        }
                        break;
                    }
                    target = target.parentNode;
                }
            }

            shopListing.removeEventListener('click', shopClickHandler, true);
            shopListing.addEventListener('click', shopClickHandler, true);
        }

        function replaceSpicyLegImages() {
            document.querySelectorAll(`img[src*="${SPICY_LEG}.png"], .spicy-leg-icon`).forEach(img => {
                if (img.src !== SPICY_LEG_IMAGE_URL) img.src = SPICY_LEG_IMAGE_URL;
                img.style.width = '32px';
                img.style.height = '32px';
                img.classList.add('spicy-leg-icon');
            });
        }

        function observeMenu() {
            const observer = new MutationObserver(() => {
                const exploreMenu = document.getElementById('explore-menu');
                if (exploreMenu && !document.getElementById('superChallengeMainCard')) {
                    addMainCardToExploreMenu();
                }
            });
            observer.observe(document.body, { childList: true, subtree: true });
        }

        function injectCustomStyles() {
            const style = document.createElement('style');
            style.textContent = `
                .super-challenge-overlay {
                    position: fixed; top: 0; left: 0; width: 100%; height: 100%;
                    background: rgba(0, 0, 0, 0.7); backdrop-filter: blur(5px); -webkit-backdrop-filter: blur(5px);
                    z-index: 10000; display: flex; justify-content: center; align-items: center;
                    animation: tooltipBoxAppear 0.2s ease;
                }
                .super-challenge-card-cost {
                    font-size: 0.8rem; opacity: 0.8; margin-top: 4px; color: #ffd966;
                }
                .super-challenge-container {
                    width: 650px; max-width: 90vw; max-height: 80vh;
                    background: var(--dark1); border: 2px solid var(--light2); border-radius: 12px;
                    box-shadow: 0 0 30px rgba(255, 69, 0, 0.6);
                    display: flex; flex-direction: column; overflow: hidden;
                    animation: tooltipBoxAppear 0.2s ease;
                    color: var(--light2); font-family: 'Winky Sans', sans-serif;
                }
                .super-challenge-header {
                    background: var(--dark2); padding: 15px 20px; display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid var(--light1);
                }
                .super-challenge-header span:first-child {
                    font-size: 1.8rem; font-weight: bold; color: #ff9966; text-shadow: 2px 2px 0 #aa3300;
                }
                .super-challenge-close {
                    font-size: 2rem; cursor: pointer; color: var(--light1); transition: 0.1s; line-height: 1;
                }
                .super-challenge-card.locked { cursor: not-allowed; }
                .super-challenge-close:hover { color: #ff8888; transform: scale(1.1); }
                .super-challenge-list {
                    padding: 15px; overflow-y: auto; display: flex; flex-direction: column; gap: 10px;
                    background: var(--dark1);
                    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24'%3E%3Cg fill='white' fill-opacity='0.03'%3E%3Cpolygon fill-rule='evenodd' points='8 4 12 6 8 8 6 12 4 8 0 6 4 4 6 0 8 4'/%3E%3C/g%3E%3C/svg%3E");
                }
                .super-challenge-card {
                    background: rgba(0, 0, 0, 0.45); border: 1px solid var(--light1); border-radius: 10px; padding: 12px 15px; display: flex; align-items: center; gap: 15px; cursor: pointer; transition: 0.1s; color: white; backdrop-filter: blur(2px);
                }
                .super-challenge-card:hover { filter: brightness(1.2); border-color: #ffaa66; transform: translateY(-2px); box-shadow: 0 5px 10px rgba(0,0,0,0.5); }
                .super-challenge-card:active { transform: scale(0.98); }
                .super-challenge-card img { width: 64px; height: 64px; image-rendering: pixelated; background: rgba(0,0,0,0.2); border-radius: 8px; }
                .super-challenge-card-info { flex: 1; }
                .super-challenge-card-name { font-size: 1.3rem; font-weight: 200; margin-bottom: 4px; }
                .super-challenge-card-desc { font-size: 0.9rem; opacity: 0.7; }
                @media (max-width: 768px) {
                    .super-challenge-card-stars { display: none !important; }
                    .super-challenge-card .super-challenge-card-info { margin-right: 0; }
                }
                .super-challenge-card-stars { background: var(--dark2); padding: 5px 12px; border-radius: 20px; color: #ffd966; border: 1px solid #ffaa33; display: flex; align-items: center; gap: 4px; font-size: 1rem; white-space: nowrap; }
                .super-challenge-card-stars img { width: 32px !important; height: 32px !important; margin-right: 2px; vertical-align: middle; }
                #superChallengeMainCard .explore-ticket-left span:first-child { font-size: 1.5rem !important; }
                #superChallengeMainCard .explore-ticket-left span strong {font-size: 1.2rem !important; padding: 4px 10px !important; }
            `;
            document.head.appendChild(style);
        }

        const originalLeaveCombat = window.leaveCombat;
        window.leaveCombat = function() {
            if (originalLeaveCombat) originalLeaveCombat();
        };

        waitForGame();
        console.log('[超级挑战] 已启用');
    }

  window[MOD_ID + "_installed"] = true;
}

function remove() {
  window[MOD_ID + "_installed"] = false;
  if (__orig.loadGame) window.loadGame = __orig.loadGame;
  if (__orig.setWildPkmn) window.setWildPkmn = __orig.setWildPkmn;
  if (__orig.updateItemShop) window.updateItemShop = __orig.updateItemShop;
  const ids = ["superChallengeMainCard", "super-challenge-overlay"];
  ids.forEach(id => { const el = document.getElementById(id); if (el) el.remove(); });
}
