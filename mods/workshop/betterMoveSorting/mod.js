const MOD_ID = "betterMoveSorting";
const STYLE_ID = "better-move-sorting-style";
const CONTROLS_ID = "better-move-sorting-controls";

const TYPE_ORDER = [
  "normal",
  "fire",
  "water",
  "electric",
  "grass",
  "ice",
  "fighting",
  "poison",
  "ground",
  "flying",
  "psychic",
  "bug",
  "rock",
  "ghost",
  "dragon",
  "dark",
  "steel",
  "fairy"
];

const SORT_MODES = [
  { id: "power", label: "威力" },
  { id: "type", label: "属性" },
  { id: "class", label: "类型" },
  { id: "tags", label: "标签" },
  { id: "speed", label: "速度" },
  { id: "name", label: "名称" }
];

const runtime = {
  api: undefined,
  state: undefined,
  observer: undefined,
  sorting: false
};

UltraMods.define({
  id: MOD_ID,
  name: "更好的招式排序",
  description: "在宝可梦的已习得招式列表中，新增招式关键词筛选与排序功能，并为每个招式添加相关标签。",
  image: "img/items/tmWater.png",
  version: "1.5",
  author: "UltraPokechill",
  category: "宝可梦 UI",
  hooks: {
    onToggle(api, payload, state) {
      if (payload.enabled) install(api, state);
      else uninstall();
    },
    onRefresh(api, payload, state) {
      if (api.isEnabled(MOD_ID)) install(api, state);
    }
  }
});

function install(api, state) {
  runtime.api = api;
  runtime.state = state;
  if (!SORT_MODES.some(mode => mode.id === state.sortMode)) state.sortMode = "power";

  installStyles();
  ensureControls();
  startObserver();
  applySort();
}

function uninstall() {
  runtime.observer?.disconnect();
  runtime.observer = undefined;
  document.getElementById(CONTROLS_ID)?.remove();
  document.getElementById(STYLE_ID)?.remove();
}

function installStyles() {
  if (document.getElementById(STYLE_ID)) return;

  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    #${CONTROLS_ID} {
      background: var(--light2);
      border-bottom: 2px solid var(--light1);
      color: var(--light1);
      display: flex;
      flex-wrap: wrap;
      gap: 0.35rem;
      justify-content: center;
      padding: 0.45rem 0.5rem 0.55rem;
      width: 95%;
    }

    #${CONTROLS_ID} button {
      background: var(--dark1);
      border: 2px solid var(--dark2);
      border-radius: 0.25rem;
      color: var(--light2);
      cursor: pointer;
      font-family: inherit;
      font-size: 1rem;
      min-width: 4.6rem;
      padding: 0.18rem 0.45rem;
      transition: 0.1s;
    }

    #${CONTROLS_ID} button:hover,
    #${CONTROLS_ID} button:focus-visible {
      filter: brightness(1.18);
      outline: none;
    }

    #${CONTROLS_ID} button.active {
      background: rgb(109, 152, 197);
      border-color: rgb(151, 217, 255);
      color: white;
    }

    /* 标签容器：承载某招式匹配到的全部标签，整体靠右并与类型图标对齐。 */
    .better-move-sort-tags {
      align-items: center;
      display: inline-flex;
      flex: 0 0 auto;
      flex-wrap: wrap;
      gap: 0.2rem;
      justify-content: flex-end;
      line-height: 1;
      margin-left: auto;
      margin-right: 0.35rem;
      max-width: 100%;
      overflow: hidden;
      z-index: 2;
    }

    .better-move-sort-tag {
      align-items: center;
      background: rgba(239, 226, 181, 0.18);
      border: 1px solid rgba(239, 226, 181, 0.35);
      border-radius: 0.25rem;
      color: #efe2b5;
      display: inline-flex;
      flex: 0 0 auto;
      font-size: 0.72rem;
      justify-content: center;
      line-height: 1;
      max-width: 6.2rem;
      overflow: hidden;
      padding: 0.12rem 0.22rem;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    #pkmn-editor-current-moves .pkmn-movebox,
    #pkmn-editor-movepool .pkmn-movebox {
      justify-content: flex-start;
      overflow: hidden;
    }

    #pkmn-editor-current-moves .pkmn-movebox img,
    #pkmn-editor-movepool .pkmn-movebox img {
      flex: 0 0 2rem;
      margin-left: auto;
    }

    #pkmn-editor-current-moves .pkmn-movebox:has(> .better-move-sort-tags) img,
    #pkmn-editor-movepool .pkmn-movebox:has(> .better-move-sort-tags) img {
      margin-left: 0;
    }

    #pkmn-editor-current-moves .pkmn-movebox span,
    #pkmn-editor-current-moves .pkmn-movebox strong,
    #pkmn-editor-movepool .pkmn-movebox span,
    #pkmn-editor-movepool .pkmn-movebox strong {
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    @media (max-width: 700px) {
      #${CONTROLS_ID} button {
        flex: 1 1 5rem;
        min-width: 0;
      }

      .better-move-sort-tags {
        gap: 0.15rem;
        margin-right: 0.25rem;
      }

      .better-move-sort-tag {
        font-size: 0.58rem;
        max-width: 4.8rem;
        padding: 0.09rem 0.16rem;
      }
    }
  `;
  document.head.appendChild(style);
}

function startObserver() {
  if (runtime.observer) return;

  const editor = document.getElementById("pkmn-editor");
  if (!editor) return;

  runtime.observer = new MutationObserver(() => {
    if (runtime.sorting) return;
    ensureControls();
    applySort();
  });

  runtime.observer.observe(editor, {
    attributes: true,
    attributeFilter: ["style"],
    childList: true,
    subtree: true
  });
}

function ensureControls() {
  const title = document.querySelector(".pkmn-editor-learnt-move-title");
  const list = document.getElementById("pkmn-editor-movepool");
  if (!title || !list) return;

  let controls = document.getElementById(CONTROLS_ID);
  if (!controls) {
    controls = document.createElement("div");
    controls.id = CONTROLS_ID;
    controls.innerHTML = SORT_MODES.map(mode => (
      `<button type="button" data-better-move-sort="${mode.id}">${mode.label}</button>`
    )).join("");

    controls.querySelectorAll("[data-better-move-sort]").forEach(button => {
      button.addEventListener("click", () => {
        runtime.state.sortMode = button.dataset.betterMoveSort;
        runtime.api.save();
        updateActiveButton();
        applySort();
      });
    });
  }

  if (controls.parentElement !== title.parentElement || controls.previousElementSibling !== title) {
    title.insertAdjacentElement("afterend", controls);
  }

  updateActiveButton();
}

function updateActiveButton() {
  const activeMode = runtime.state?.sortMode || "power";
  document.querySelectorAll(`#${CONTROLS_ID} [data-better-move-sort]`).forEach(button => {
    button.classList.toggle("active", button.dataset.betterMoveSort === activeMode);
  });
}

function applySort() {
  const list = document.getElementById("pkmn-editor-movepool");
  const editor = document.getElementById("pkmn-editor");
  if (!list || !editor || getComputedStyle(editor).display === "none") return;

  const moveBoxes = Array.from(list.children).filter(element => element.dataset?.move && getMove(element.dataset.move));
  if (moveBoxes.length < 2) {
    annotateMoveBoxes(moveBoxes);
    return;
  }

  const mode = runtime.state?.sortMode || "power";
  const sortedMoveBoxes = [...moveBoxes].sort((left, right) => compareMoveBoxes(left, right, mode));
  const currentOrder = moveBoxes.map(element => element.dataset.move).join("|");
  const sortedOrder = sortedMoveBoxes.map(element => element.dataset.move).join("|");

  runtime.sorting = true;
  sortedMoveBoxes.forEach(element => {
    annotateMoveBox(element);
  });

  if (currentOrder !== sortedOrder) {
    const fragment = document.createDocumentFragment();
    sortedMoveBoxes.forEach(element => {
      fragment.appendChild(element);
    });
    list.appendChild(fragment);
  }

  runtime.sorting = false;
}

function annotateMoveBoxes(moveBoxes) {
  moveBoxes.forEach(annotateMoveBox);
}

function annotateMoveBox(element) {
  const moveData = getMove(element.dataset.move);
  if (!moveData) return;

  const labels = getMoveTags(moveData);
  const container = element.querySelector(".better-move-sort-tags");
  const existingKey = container
    ? Array.from(container.querySelectorAll(".better-move-sort-tag")).map(tag => tag.textContent).sort().join("|")
    : "";
  const newKey = [...labels].sort().join("|");

  if (labels.length === 0) {
    container?.remove();
    return;
  }

  if (existingKey === newKey) return;
  container?.remove();

  const typeIcon = element.querySelector("img");
  const wrapper = document.createElement("span");
  wrapper.className = "better-move-sort-tags";

  labels.forEach(label => {
    const tag = document.createElement("small");
    tag.className = "better-move-sort-tag";
    tag.textContent = label;
    wrapper.appendChild(tag);
  });

  if (typeIcon) element.insertBefore(wrapper, typeIcon);
  else element.appendChild(wrapper);
}

function compareMoveBoxes(left, right, mode) {
  const leftId = left.dataset.move;
  const rightId = right.dataset.move;
  const leftMove = getMove(leftId);
  const rightMove = getMove(rightId);

  if (mode === "type") {
    return compareNumber(typeRank(leftMove.type), typeRank(rightMove.type))
      || compareText(leftMove.type, rightMove.type)
      || compareNumber(powerValue(rightMove), powerValue(leftMove))
      || compareText(formatName(leftId), formatName(rightId));
  }

  if (mode === "class") {
    return compareNumber(classRank(leftMove), classRank(rightMove))
      || compareNumber(powerValue(rightMove), powerValue(leftMove))
      || compareText(formatName(leftId), formatName(rightId));
  }

  if (mode === "tags") {
    return compareNumber(tagRank(leftMove), tagRank(rightMove))
      || compareNumber(powerValue(rightMove), powerValue(leftMove))
      || compareText(formatName(leftId), formatName(rightId));
  }

  if (mode === "speed") {
    return compareNumber(timerValue(leftMove), timerValue(rightMove))
      || compareNumber(powerValue(rightMove), powerValue(leftMove))
      || compareText(formatName(leftId), formatName(rightId));
  }

  if (mode === "name") {
    return compareText(formatName(leftId), formatName(rightId));
  }

  return compareNumber(powerValue(rightMove), powerValue(leftMove))
    || compareNumber(timerValue(leftMove), timerValue(rightMove))
    || compareText(formatName(leftId), formatName(rightId));
}

function getMove(id) {
  return typeof move === "undefined" ? undefined : move[id];
}

function formatName(id) {
  if (runtime.api) return runtime.api.formatName(id);
  if (typeof format === "function") return format(id);
  return String(id || "");
}

function typeRank(type) {
  const index = TYPE_ORDER.indexOf(type);
  return index === -1 ? TYPE_ORDER.length : index;
}

function classRank(moveData) {
  if (powerValue(moveData) <= 0) return 2;
  if (moveData.split === "physical") return 0;
  if (moveData.split === "special") return 1;
  return 3;
}

function tagRank(moveData) {
  const tags = getMoveTags(moveData);
  if (tags.length === 0) return 9;
  return Math.min(...tags.map(tagRankValue));
}

function getMoveTags(moveData) {
  const tags = [];
  if (powerValue(moveData) <= 0) tags.push("变化");
  if (moveData.moveset === undefined) tags.push("专属");
  if (moveData.restricted) tags.push("限制");
  if (timerValue(moveData) < getDefaultTimer()) tags.push("高速");
  if (timerValue(moveData) > getDefaultTimer()) tags.push("低速");
  if (moveData.multihit) tags.push("多段攻击");
  if (moveData.buildup !== undefined) {
    tags.push("威力递增");
    return tags;
  }
  if (moveData.powerMod !== undefined) tags.push("威力浮动");
  if (moveData.hitEffect !== undefined) tags.push("追加效果");
  if (moveData.castEffect !== undefined) tags.push("特殊效果");
  return tags;
}

function tagRankValue(tag) {
  if (tag === "专属") return 0;
  if (tag === "限制") return 1;
  if (tag === "高速") return 2;
  if (tag === "低速") return 3;
  if (tag === "多段攻击") return 4;
  if (tag === "威力递增") return 5;
  if (tag === "威力浮动") return 6;
  if (tag === "追加效果") return 7;
  if (tag === "特殊效果") return 8;
  if (tag === "变化") return 9;
  return 10;
}

function getDefaultTimer() {
  return typeof defaultPlayerMoveTimer === "number" ? defaultPlayerMoveTimer : 2000;
}

function timerValue(moveData) {
  return Number(moveData?.timer) || getDefaultTimer();
}

function powerValue(moveData) {
  return Number(moveData?.power) || 0;
}

function compareNumber(left, right) {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function compareText(left, right) {
  return String(left || "").localeCompare(String(right || ""), undefined, { sensitivity: "base" });
}
