const MOD_ID = "pokechillDummy";
const STYLE_ID = MOD_ID + "-style";

UltraMods.define({
  id: MOD_ID,
  name: "Pokechill 自定义木桩",
  description: "将「自定义木桩」独立为 mod：创建可配置属性/等级/技能的木桩训练区，用于测试配队与伤害。由 mod 管理器独立启用或禁用。",
  image: "img/items/luxuryBall.png",
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

    const settings = { enableCustomDummy: true, dummyAreaId: 'custom_dummy_area', dummyPkmnId: 'custom_dummy_pkmn' };

if (settings.enableCustomDummy) {
    // 使用 settings 中的 ID，如果没有则使用默认值
    const dummyAreaId = settings.dummyAreaId || 'dummyCustom';
    const dummyPkmnId = settings.dummyPkmnId || 'dummy_custom';
    const DUMMY_SPRITE_URL = 'https://picui.ogmua.cn/s1/2026/03/10/69afbe020b09a.webp';

    // 安全定义 ability.none，确保包含 rarity
    function ensureNoneAbility() {
        if (!ability.none) {
            // 尝试从真实能力（如 sturdy）复制结构
            const template = ability.sturdy;
            ability.none = {
                id: 'none',
                rename: '无',
                rarity: template ? template.rarity : 1,
                type: ['all'],
                info: function() { return '没有任何效果。'; },
                // 如果有其他属性，保留兼容性
                ...(template && { icon: template.icon, effect: '无效果' })
            };
        }
        // 确保木桩的 ability 指向 'none'
        if (pkmn[dummyPkmnId]) {
            pkmn[dummyPkmnId].ability = 'none';
        }
    }

    // 等待游戏核心加载
    function waitForDummy() {
        if (typeof areas === 'undefined' || typeof pkmn === 'undefined' || typeof move === 'undefined' || typeof ability === 'undefined') {
            setTimeout(waitForDummy, 200);
            return;
        }
        console.log('[DummyCustom] 游戏核心已加载，开始注入...');
        ensureNoneAbility();          // 确保能力存在
        initDummyPokemon();
        injectDummyTarget();
        createConfigPanel();
        setupImageErrorHandler();
        addMobileStyles();
    }
    waitForDummy();

    // 全局图片错误处理：将木桩相关的图片请求替换为自定义图片
    function setupImageErrorHandler() {
        document.addEventListener('error', function(e) {
            const img = e.target;
            if (img.tagName !== 'IMG') return;
            if (img.src.includes(`/sprite/${dummyPkmnId}.png`) ||
                img.src.includes(`/sprite/${dummyPkmnId}.gif`) ||
                img.src.includes(`/trainers/.png`)) {
                if (img.src.includes('/trainers/.png')) {
                    img.style.display = 'none';
                    e.preventDefault();
                    return;
                }
                img.src = DUMMY_SPRITE_URL;
                img.onerror = null;
                console.log('[DummyCustom] 替换图片为自定义木桩图片');
            }
        }, true);
    }

    function initDummyPokemon() {
        if (!pkmn[dummyPkmnId]) {
            pkmn[dummyPkmnId] = {
                id: dummyPkmnId,
                rename: 'DUCK',
                type: ['normal'],
                bst: { hp: 6, atk: 4, def: 2, satk: 4, sdef: 2, spe: 4 },
                level: 100,
                exp: 0,
                caught: 0,
                shiny: false,
                ability: 'none',              // 使用 none 能力
                hiddenAbility: undefined,
                hiddenAbilityUnlocked: false,
                movepool: [],
                moves: { slot1: undefined, slot2: undefined, slot3: undefined, slot4: undefined },
                ivs: { hp: 0, atk: 0, def: 0, satk: 0, sdef: 0, spe: 0 },
                pokerus: false,
                ribbons: [],
                newMoves: [],
                newPokemon: undefined,
                newEvolution: undefined,
                tag: undefined,
                lockHp: true
            };
        }
        ensureNoneAbility(); // 再次确保，防止加载顺序问题
    }

    // 根据当前属性刷新可学技能池（基于 moveset 过滤）
    function refreshDummyMovepool() {
        const dummy = pkmn[dummyPkmnId];
        if (!dummy) return;
        const types = dummy.type;
        const newMovepool = [];
        for (const moveId in move) {
            const m = move[moveId];
            if (m.moveset) {
                if (m.moveset.includes('all') || types.some(t => m.moveset.includes(t))) {
                    newMovepool.push(moveId);
                }
            }
        }
        dummy.movepool = newMovepool;
        console.log(`[DummyCustom] 刷新技能池，共 ${newMovepool.length} 个技能（基于属性 ${types.join('/')}）`);
    }

    function ensureDummyArea() {
        if (!areas[dummyAreaId]) {
            areas[dummyAreaId] = {
                name: `木桩测试 (可配置)`,
                background: 'gym',
                trainer: true,
                type: 'vs',
                level: 100,
                team: {
                    slot1: pkmn[dummyPkmnId],
                    slot1Moves: [undefined, undefined, undefined, undefined]
                },
                dummy: true,
                defeated: false,
                unlockRequirement: () => true,
                reward: []
            };
        }
    }

    // 生成0-6星选项的HTML
    function generateStarOptions(selected) {
        let options = '';
        for (let i = 0; i <= 6; i++) {
            options += `<option value="${i}" ${selected == i ? 'selected' : ''}>${i}星</option>`;
        }
        return options;
    }

    // 添加移动端适配样式
    function addMobileStyles() {
        const style = document.createElement('style');
        style.textContent = `
            @media (max-width: 768px) {
                #dummy-config-panel {
                    width: 95vw !important;
                    min-width: unset !important;
                    padding: 1rem !important;
                    font-size: 14px !important;
                }
                #dummy-config-panel select,
                #dummy-config-panel input[type="number"] {
                    font-size: 16px !important;
                    padding: 0.5rem !important;
                }
                #dummy-config-panel button {
                    padding: 0.8rem 1rem !important;
                    font-size: 16px !important;
                }
                #dummy-config-panel .vs-card {
                    max-width: 100% !important;
                }
                #dummy-config-panel [style*="grid-template-columns: repeat(2, 1fr)"] {
                    gap: 0.8rem !important;
                }
                #dummy-config-panel > div > div[style*="justify-content:space-between"] {
                    flex-direction: column;
                    align-items: stretch !important;
                    gap: 0.8rem;
                }
                #dummy-config-panel > div > div[style*="justify-content:space-between"] button {
                    width: 100%;
                }
            }
        `;
        document.head.appendChild(style);
    }

    // 飘字显示函数（复制原脚本逻辑，确保锁血时也能显示）
    function showDamageFloat(value, isPlayer, element) {
        if (!element || value <= 0) return;
        const color = isPlayer ? '#FF0000' : '#00FF00';
        const fontWeight = 'bold';
        const rect = element.getBoundingClientRect();

        const div = document.createElement('div');
        div.style.cssText = `
            position: fixed; left: ${rect.left + rect.width/2}px; top: ${rect.top + rect.height/2}px;
            transform: translate(-50%, -50%);
            color: ${color}; font-weight: ${fontWeight}; font-size: 24px;
            text-shadow: 3px 3px 6px rgba(0,0,0, 1); z-index: 10001; pointer-events: none;
            animation: floatUp 2s ease-out forwards;
            font-family: 'Winky Sans', 'Consolas', monospace;
        `;
        div.textContent = `-${Math.round(value)}`;

        document.body.appendChild(div);
        setTimeout(() => div.remove(), 2000);
    }

    function createConfigPanel() {
        if (document.getElementById('dummy-config-panel')) return;

        const panel = document.createElement('div');
        panel.id = 'dummy-config-panel';
        panel.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: var(--light2, #ECDEB7);
            border: 2px solid var(--light1, #94886B);
            border-radius: 0.5rem;
            padding: 1.5rem;
            z-index: 10000;
            display: none;
            flex-direction: column;
            gap: 1rem;
            min-width: 350px;
            max-width: 90vw;
            max-height: 90vh;
            overflow-y: auto;
            color: var(--dark1, #36342F);
            font-family: 'Courier New', monospace;
            box-shadow: 0 0 20px rgba(0,0,0,0.5);
        `;

        const dummy = pkmn[dummyPkmnId];
        const bst = dummy ? dummy.bst : { hp:6, atk:4, def:2, satk:4, sdef:2, spe:4 };

        panel.innerHTML = `
            <h3 style="margin:0; text-align:center;">配置木桩</h3>
            <div style="display:flex; flex-direction:column; gap:0.8rem;">
                <div>
                    <label>第一属性:</label>
                    <select id="dummy-type1" style="width:100%; padding:0.3rem;">
                        <option value="normal">一般</option>
                        <option value="fire">火</option>
                        <option value="water">水</option>
                        <option value="electric">电</option>
                        <option value="grass">草</option>
                        <option value="ice">冰</option>
                        <option value="fighting">格斗</option>
                        <option value="poison">毒</option>
                        <option value="ground">地面</option>
                        <option value="flying">飞行</option>
                        <option value="psychic">超能力</option>
                        <option value="bug">虫</option>
                        <option value="rock">岩石</option>
                        <option value="ghost">幽灵</option>
                        <option value="dragon">龙</option>
                        <option value="dark">恶</option>
                        <option value="steel">钢</option>
                        <option value="fairy">妖精</option>
                    </select>
                </div>
                <div>
                    <label>第二属性 (可选):</label>
                    <select id="dummy-type2" style="width:100%; padding:0.3rem;">
                        <option value="">无</option>
                        <option value="normal">一般</option>
                        <option value="fire">火</option>
                        <option value="water">水</option>
                        <option value="electric">电</option>
                        <option value="grass">草</option>
                        <option value="ice">冰</option>
                        <option value="fighting">格斗</option>
                        <option value="poison">毒</option>
                        <option value="ground">地面</option>
                        <option value="flying">飞行</option>
                        <option value="psychic">超能力</option>
                        <option value="bug">虫</option>
                        <option value="rock">岩石</option>
                        <option value="ghost">幽灵</option>
                        <option value="dragon">龙</option>
                        <option value="dark">恶</option>
                        <option value="steel">钢</option>
                        <option value="fairy">妖精</option>
                    </select>
                </div>
                <div style="margin-top:0.5rem;">
                    <label style="font-weight:bold;">种族值星级 (0-6星):</label>
                    <div style="display:grid; grid-template-columns: repeat(2, 1fr); gap:0.5rem; margin-top:0.3rem;">
                        <div><label>HP:</label> <select id="dummy-bst-hp" style="width:100%;">${generateStarOptions(bst.hp)}</select></div>
                        <div><label>攻击:</label> <select id="dummy-bst-atk" style="width:100%;">${generateStarOptions(bst.atk)}</select></div>
                        <div><label>防御:</label> <select id="dummy-bst-def" style="width:100%;">${generateStarOptions(bst.def)}</select></div>
                        <div><label>特攻:</label> <select id="dummy-bst-satk" style="width:100%;">${generateStarOptions(bst.satk)}</select></div>
                        <div><label>特防:</label> <select id="dummy-bst-sdef" style="width:100%;">${generateStarOptions(bst.sdef)}</select></div>
                        <div><label>速度:</label> <select id="dummy-bst-spe" style="width:100%;">${generateStarOptions(bst.spe)}</select></div>
                    </div>
                </div>
                <div>
                    <label>等级 (1-100):</label>
                    <input type="number" id="dummy-level" min="1" max="100" value="100" style="width:100%; padding:0.3rem;">
                </div>
                <div style="display:flex; align-items:center; gap:0.5rem; justify-content:space-between;">
                    <div>
                        <input type="checkbox" id="dummy-lockhp" checked>
                        <label>锁血 (每回合回满)</label>
                    </div>
                    <button id="dummy-config-skills" style="background:#4CAF50; color:white; border:none; padding:0.5rem 1rem; border-radius:0.3rem; cursor:pointer;">⚙️ 配置技能</button>
                </div>
            </div>
            <div style="display:flex; gap:0.5rem; margin-top:1rem;">
                <button id="dummy-config-reset" style="background:var(--light1, #94886B); color:white; border:none; padding:0.5rem 1rem; border-radius:0.3rem; cursor:pointer; flex:1;">重置</button>
                <button id="dummy-config-ok" style="background:#4CAF50; color:white; border:none; padding:0.5rem 1rem; border-radius:0.3rem; cursor:pointer; flex:1;">确定</button>
                <button id="dummy-config-cancel" style="background:#f44336; color:white; border:none; padding:0.5rem 1rem; border-radius:0.3rem; cursor:pointer; flex:1;">取消</button>
            </div>
        `;

        document.body.appendChild(panel);

        function updateBstFromUI() {
            const dummy = pkmn[dummyPkmnId];
            dummy.bst.hp = parseInt(document.getElementById('dummy-bst-hp').value, 10);
            dummy.bst.atk = parseInt(document.getElementById('dummy-bst-atk').value, 10);
            dummy.bst.def = parseInt(document.getElementById('dummy-bst-def').value, 10);
            dummy.bst.satk = parseInt(document.getElementById('dummy-bst-satk').value, 10);
            dummy.bst.sdef = parseInt(document.getElementById('dummy-bst-sdef').value, 10);
            dummy.bst.spe = parseInt(document.getElementById('dummy-bst-spe').value, 10);
        }

        function setBstToUI() {
            const dummy = pkmn[dummyPkmnId];
            document.getElementById('dummy-bst-hp').value = dummy.bst.hp;
            document.getElementById('dummy-bst-atk').value = dummy.bst.atk;
            document.getElementById('dummy-bst-def').value = dummy.bst.def;
            document.getElementById('dummy-bst-satk').value = dummy.bst.satk;
            document.getElementById('dummy-bst-sdef').value = dummy.bst.sdef;
            document.getElementById('dummy-bst-spe').value = dummy.bst.spe;
        }

        const updateType = () => {
            const type1 = document.getElementById('dummy-type1').value;
            const type2 = document.getElementById('dummy-type2').value;
            pkmn[dummyPkmnId].type = type2 ? [type1, type2] : [type1];
        };
        document.getElementById('dummy-type1').addEventListener('change', updateType);
        document.getElementById('dummy-type2').addEventListener('change', updateType);

        // 配置技能按钮：确保能力存在，然后打开编辑器
        document.getElementById('dummy-config-skills').addEventListener('click', () => {
            // 先确保能力定义完整
            ensureNoneAbility();
            // 保存当前设置到木桩
            updateType();
            const level = parseInt(document.getElementById('dummy-level').value, 10);
            pkmn[dummyPkmnId].level = Math.min(100, Math.max(1, level));
            pkmn[dummyPkmnId].lockHp = document.getElementById('dummy-lockhp').checked;
            updateBstFromUI();
            refreshDummyMovepool();
            panel.style.display = 'none';
            // 再次检查 ability.none 是否完整（以防万一）
            if (!ability.none) {
                ability.none = { id: 'none', rename: '无', rarity: 1, type: ['all'], info: () => '没有任何效果。' };
            }
            // 调用游戏内置编辑器
            if (typeof tooltipData === 'function') {
                tooltipData('pkmnEditor', dummyPkmnId);
            } else {
                alert('无法打开编辑器，请刷新页面重试。');
            }
        });

        document.getElementById('dummy-config-reset').addEventListener('click', () => {
            document.getElementById('dummy-type1').value = 'normal';
            document.getElementById('dummy-type2').value = '';
            document.getElementById('dummy-level').value = 100;
            document.getElementById('dummy-lockhp').checked = true;

            const dummy = pkmn[dummyPkmnId];
            dummy.type = ['normal'];
            dummy.level = 100;
            dummy.lockHp = true;
            dummy.bst = { hp:6, atk:4, def:2, satk:4, sdef:2, spe:4 };
            dummy.moves = { slot1: undefined, slot2: undefined, slot3: undefined, slot4: undefined };
            setBstToUI();
            refreshDummyMovepool();
            console.log('[DummyCustom] 木桩已重置为默认值，技能已清空');
        });

        document.getElementById('dummy-config-ok').addEventListener('click', () => {
            const type1 = document.getElementById('dummy-type1').value;
            const type2 = document.getElementById('dummy-type2').value;
            const level = parseInt(document.getElementById('dummy-level').value, 10);
            const lockHp = document.getElementById('dummy-lockhp').checked;

            const dummy = pkmn[dummyPkmnId];
            dummy.type = type2 ? [type1, type2] : [type1];
            dummy.level = Math.min(100, Math.max(1, level));
            dummy.lockHp = lockHp;
            dummy.playerHp = undefined;
            updateBstFromUI();

            panel.style.display = 'none';

            saved.currentAreaBuffer = dummyAreaId;
            document.getElementById('preview-team-exit').style.display = 'flex';
            document.getElementById('team-menu').style.zIndex = '50';
            document.getElementById('team-menu').style.display = 'flex';
            document.getElementById('menu-button-parent').style.display = 'none';
            updatePreviewTeam();
            afkSeconds = 0;
            document.getElementById('explore-menu').style.display = 'none';
        });

        document.getElementById('dummy-config-cancel').addEventListener('click', () => {
            panel.style.display = 'none';
        });
    }

    function injectDummyTarget() {
        ensureDummyArea();

        const originalUpdateVS = updateVS;
        updateVS = function() {
            originalUpdateVS();

            const vsListing = document.getElementById('vs-listing');
            if (!vsListing) return;

            const existingCards = vsListing.querySelectorAll(`[data-trainer="${dummyAreaId}"]`);
            existingCards.forEach(card => card.remove());

            const dummyCard = document.createElement('div');
            dummyCard.className = 'vs-card';
            dummyCard.dataset.trainer = dummyAreaId;
            dummyCard.innerHTML = `
                <span class="hitbox"></span>
                <img class="vs-card-flair" src="img/icons/pokeball.svg">
                <div class="vs-card-bg"></div>
                <span class="explore-ticket-left" style="z-index: 2;">
                    <span style="font-size:1.3rem"> 自定义木桩</span>
                    <span><strong style="font-size:1rem; background:#964646ff">测试木桩</strong></span>
                </span>
                <div class="vs-card-left">
                    <img class="sprite-trim" src="${DUMMY_SPRITE_URL}"
                         style="max-width: 96px; max-height: 96px; width: auto; height: auto; transform: none; scale: 1; object-fit: contain; margin: auto;"
                         data-dummy="true">
                </div>
            `;

            dummyCard.addEventListener('click', () => {
                const panel = document.getElementById('dummy-config-panel');
                if (panel) {
                    const dummy = pkmn[dummyPkmnId];
                    document.getElementById('dummy-type1').value = dummy.type[0] || 'normal';
                    document.getElementById('dummy-type2').value = dummy.type[1] || '';
                    document.getElementById('dummy-level').value = dummy.level;
                    document.getElementById('dummy-lockhp').checked = dummy.lockHp;
                    document.getElementById('dummy-bst-hp').value = dummy.bst.hp;
                    document.getElementById('dummy-bst-atk').value = dummy.bst.atk;
                    document.getElementById('dummy-bst-def').value = dummy.bst.def;
                    document.getElementById('dummy-bst-satk').value = dummy.bst.satk;
                    document.getElementById('dummy-bst-sdef').value = dummy.bst.sdef;
                    document.getElementById('dummy-bst-spe').value = dummy.bst.spe;
                    panel.style.display = 'flex';
                }
            });

            vsListing.appendChild(dummyCard);
        };
    }

    const originalSetWildPkmn = setWildPkmn;
    setWildPkmn = function() {
        if (saved.currentArea === dummyAreaId) {
            const dummy = pkmn[dummyPkmnId];
            if (!dummy) return;

            barProgressWild = 0;
            exploreCombatWildTurn = 1;
            ['team-indicator', 'spiraling-indicator', 'factory-indicator', 'training-indicator', 'raid-timer-indicator']
                .forEach(id => document.getElementById(id) && (document.getElementById(id).style.display = 'none'));

            saved.currentPkmn = dummyPkmnId;
            wildLevel = dummy.level;

            const hpStars = dummy.bst.hp;
            wildPkmnHp = (100 + (hpStars * 30) * (1 + dummy.level * 0.2)) * 4;
            wildPkmnHpMax = wildPkmnHp;

            document.getElementById('explore-wild-name').innerHTML = (dummy.rename || '木桩') + ` <span class="explore-pkmn-level">lvl ${dummy.level}</span>`;
            const sprite = document.getElementById('explore-wild-sprite');
            sprite.src = DUMMY_SPRITE_URL;
            sprite.dataset.dummy = "true";
            sprite.onerror = function() { console.warn('木桩图片加载失败'); };
            if (pkmn.psyduck?.float) sprite.classList.add('floating-pkmn');
            else sprite.classList.remove('floating-pkmn');
            document.getElementById('explore-wild-sprite-data').dataset.pkmn = dummyPkmnId;

            const moves = [dummy.moves.slot1, dummy.moves.slot2, dummy.moves.slot3, dummy.moves.slot4];
            const container = document.getElementById('explore-header-moves-wild');
            container.innerHTML = '';
            for (let i = 0; i < 4; i++) {
                const moveId = moves[i];
                if (!moveId) {
                    const emptyDiv = document.createElement('div');
                    emptyDiv.className = 'pkmn-movebox';
                    emptyDiv.style.pointerEvents = 'none';
                    emptyDiv.style.opacity = '0.3';
                    container.appendChild(emptyDiv);
                } else {
                    const moveDiv = document.createElement('div');
                    moveDiv.className = 'pkmn-movebox';
                    moveDiv.style.borderColor = returnTypeColor(move[moveId].type);
                    moveDiv.id = `pkmn-movebox-wild-${i+1}`;
                    moveDiv.innerHTML = `
                        <div id="pkmn-movebox-wild-${i+1}-bar" class="pkmn-movebox-progress" style="background:${returnTypeColor(move[moveId].type)}"></div>
                        <span>${format(moveId)}</span>
                        <img style="background:${returnTypeColor(move[moveId].type)}" src="img/icons/${move[moveId].type}.svg">
                    `;
                    moveDiv.dataset.move = moveId;
                    container.appendChild(moveDiv);
                }
            }

            updateWildPkmn();
            voidAnimation('explore-wild-sprite', 'wildPokemonSpawn 0.5s 1');
            return;
        }
        const sprite = document.getElementById('explore-wild-sprite');
        if (sprite) delete sprite.dataset.dummy;
        originalSetWildPkmn();
    };

    // 重写战斗逻辑，在锁血时显示伤害飘字
    const originalExploreCombatPlayer = exploreCombatPlayer;
    exploreCombatPlayer = function() {
        // 如果是木桩战斗且锁血，记录伤害前血量
        let damage = 0;
        const isDummy = saved.currentArea === dummyAreaId;
        const lockHp = isDummy && pkmn[dummyPkmnId] && pkmn[dummyPkmnId].lockHp;
        if (lockHp) {
            const oldHp = wildPkmnHp;
            originalExploreCombatPlayer();
            const newHp = wildPkmnHp;
            damage = oldHp - newHp;
            // 显示伤害飘字
            if (damage > 0) {
                const wildSprite = document.getElementById('explore-wild-sprite');
                if (wildSprite) {
                    showDamageFloat(damage, false, wildSprite);
                }
            }
            // 重置血量（如果锁血）
            if (pkmn[dummyPkmnId].lockHp) {
                wildPkmnHp = wildPkmnHpMax;
                updateWildPkmn();
            }
        } else {
            originalExploreCombatPlayer();
        }
    };

    const originalExploreCombatWild = exploreCombatWild;
    exploreCombatWild = function() {
        // 木桩锁血对野生回合没有影响，但保留原逻辑
        originalExploreCombatWild();
        if (saved.currentArea === dummyAreaId && pkmn[dummyPkmnId] && pkmn[dummyPkmnId].lockHp) {
            wildPkmnHp = wildPkmnHpMax;
            updateWildPkmn();
        }
    };

    // 安全包装原函数，忽略跨域错误
    if (typeof trimTransparent === 'function') {
        const originalTrimTransparent = trimTransparent;
        trimTransparent = function(img) {
            try {
                return originalTrimTransparent(img);
            } catch (e) {
                if (e.name === 'SecurityError' && e.message.includes('cross-origin')) {
                    console.warn('[DummyCustom] 忽略跨域裁剪错误');
                    return { width: img.naturalWidth, height: img.naturalHeight };
                }
                throw e;
            }
        };
    }
}

  window[MOD_ID + "_installed"] = true;
}

function remove() {
  window[MOD_ID + "_installed"] = false;
  if (__orig.loadGame) window.loadGame = __orig.loadGame;
  if (__orig.setWildPkmn) window.setWildPkmn = __orig.setWildPkmn;
  if (__orig.updateItemShop) window.updateItemShop = __orig.updateItemShop;
  const ids = ["dummy-config-panel"];
  ids.forEach(id => { const el = document.getElementById(id); if (el) el.remove(); });
  document.querySelectorAll('[data-trainer="custom_dummy_area"]').forEach(e => e.remove());
}
