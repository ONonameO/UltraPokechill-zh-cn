const MOD_ID = "pokechillSilverExchange";
const GOLD_ID = "goldenBottleCap";       // 金币：金色王冠
const SILVER_ID = "bottleCap";           // 银币：银色王冠
const SHOP_ID = "shopSilverToGold";      // 商店条目 id
const SILVER_PER_GOLD = 5;               // 数值换算：5 银币换 1 金币

let activeApi;
let saveTimer;

UltraMods.define({
  id: MOD_ID,
  name: "银币换金币",
  description: "商店中新增「银币换金币」兑换项，可用银色王冠批量兑换金色王冠。由 mod 管理器独立启用或禁用。",
  image: "img/items/goldenBottleCap.png",
  version: "2.0.0",
  author: "人民当家做主",
  category: "实用工具",
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

// 复用 CosmoemEvolves 的商店注入模式：注册一条商店条目，由游戏自带的
// updateItemShop / buyItem 流程负责渲染、数量选择(x1/x5/x10/x25/x50/x100)、
// 余额校验(条件校验)与扣币，effect() 仅负责「兑换执行」——每调用一次发放 1 枚金币。
function installShopEntry(api) {
  api.shop[SHOP_ID] = {
    icon: GOLD_ID,
    name: `金色王冠 x1`,
    price: SILVER_PER_GOLD,               // 数值换算：单价 = 5 银币
    currency: SILVER_ID,                  // 支付货币 = 银色王冠
    category: "goods",
    condition() {                         // 条件校验：持有银币时才显示
      return (api.item?.[SILVER_ID]?.got || 0) > 0;
    },
    effect() {                           // 兑换执行：发放 1 枚金币
      giveGold(1);
    }
  };
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
