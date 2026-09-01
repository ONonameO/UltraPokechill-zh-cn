const MOD_ID = "coinExchange";
const GOLD_ID = "goldenBottleCap";       // 金币：金色王冠
const SILVER_ID = "bottleCap";           // 银币：银色王冠
const SHOP_ID = "shopSilverToGold";      // 商店条目 id
const SILVER_PER_GOLD = 5;               // 数值换算：5 银币换 1 金币

let activeApi;
let saveTimer;

UltraMods.define({
  id: MOD_ID,
  name: "银币换金币",
  description: "商店中新增「银币换金币」兑换项，可用银色王冠批量兑换金色王冠。",
  image: "img/items/goldenBottleCap.png",
  version: "2.1.0",
  author: "人民当家做主 & 我不是西药",
  category: "商店",
  hooks: {
    onToggle(api, payload) {
      if (payload.enabled) install(api);
      else uninstall(api);
    },
    onRefresh(api, payload) {
      if (!api.isEnabled(MOD_ID)) return;
      install(api);
    }
  }
});

function install(api) {
  if (!api.item || !api.shop) return;

  activeApi = api;
  installShopEntry(api);
  api.refreshGame();
}

function uninstall(api) {
  if (api.shop) delete api.shop[SHOP_ID];
  api.refreshGame();
}


function installShopEntry(api) {
  const entry = {
    icon: GOLD_ID,
    name: `金色王冠 x1`,
    price: SILVER_PER_GOLD,               // 数值换算：单价 = 5 银币
    currency: SILVER_ID,                  // 支付货币 = 银色王冠
    category: "all",                      // 出现在所有商店目录页（除餐厅）
    effect() {                           // 兑换执行：发放 1 枚金币
      giveGold(1);
    }
  };

  const shop = api.shop;
  if (!shop) return;

  // 让兑换项始终排在所有商店条目的「第一行」：
  // 游戏按 for (let i in shop) 的属性插入顺序渲染，且本 mod 后注册会落在末尾。
  // 因此在全局 shop 对象(与 api.shop 同一引用)上原地重排，把本条目移到首个键。
  if (Object.keys(shop)[0] === SHOP_ID) {
    shop[SHOP_ID] = entry;               // 已是首条，仅刷新内容
    return;
  }
  const snapshot = {};
  for (const k in shop) snapshot[k] = shop[k];
  for (const k in shop) delete shop[k];
  shop[SHOP_ID] = entry;                  // 首键：渲染时即为第一行
  for (const k in snapshot) if (k !== SHOP_ID) shop[k] = snapshot[k];
}

function giveGold(amount) {
  if (!activeApi) return;
  const gold = activeApi.item?.[GOLD_ID];
  if (!gold) return;

  gold.got += Math.max(1, Math.floor(Number(amount) || 1));
  activeApi.refreshGame();
  queueSave();
}

function queueSave() {
  window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => {
    if (!activeApi) return;
    activeApi.save();
  }, 0);
}
