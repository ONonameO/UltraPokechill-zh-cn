const MOD_ID = "pokechillSilverExchange";
const STYLE_ID = MOD_ID + "-style";

UltraMods.define({
  id: MOD_ID,
  name: "Pokechill 银币换金币",
  description: "将「银币换金币」独立为 mod：在道具商店注入兑换项，可用银色王冠批量兑换金色王冠。由 mod 管理器独立启用或禁用。",
  image: "img/items/goldenBottleCap.png",
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


    // ========== 新增银币换金币功能 ==========
    shop.shopGoldenCrownExchange = {
        icon: item.goldenBottleCap.id,
        name: `金色王冠 x1`,
        price: 5,
        currency: item.bottleCap.id,
        category: `all`,
        effect: function() {
            item.goldenBottleCap.got += 1;
        },
        description: 'Exchange 5 Silver Crowns for 1 Golden Crown'
    };

    const originalUpdateItemShopForExchange = updateItemShop;
    updateItemShop = function() {
        const originalShopCategory = shopCategory;
        originalUpdateItemShopForExchange.apply(this, arguments);

        if (originalShopCategory !== undefined && originalShopCategory !== null && originalShopCategory !== 'decor' && originalShopCategory !== 'apricorn') {
            const shopListing = document.getElementById("shop-listing");
            if (shopListing) {
                let existingExchangeItem = document.querySelector('[data-exchange-item="goldenCrown"]');
                if (!existingExchangeItem) {
                    const exchangeDiv = document.createElement("div");
                    exchangeDiv.dataset.item = shop.shopGoldenCrownExchange.icon;
                    exchangeDiv.dataset.exchangeItem = "goldenCrown";

                    const shopItem = shop.shopGoldenCrownExchange.icon;
                    const currency = shop.shopGoldenCrownExchange.currency || item.bottleCap.id;
                    let name = format(shop.shopGoldenCrownExchange.icon);
                    if (shop.shopGoldenCrownExchange.name) name = shop.shopGoldenCrownExchange.name;
                    let stockTag = "";
                    let innerHTMLContent = `
                        <img src="img/items/${shopItem}.png">
                        <span>${name}${stockTag}</span>
                        <strong id="shop-currency-exchange">
                            <img src="img/items/${currency}.png"> x${shop.shopGoldenCrownExchange.price}
                        </strong>
                    `;
                    exchangeDiv.innerHTML = innerHTMLContent;

                    exchangeDiv.addEventListener("click", () => {
                        document.getElementById("tooltipTop").style.display = "none"
                        document.getElementById("tooltipTitle").innerHTML = "How many will you buy?"
                        document.getElementById("tooltipMid").style.display = "none"
                        document.getElementById("tooltipBottom").innerHTML = `
                            <span style="display:flex; justify-content:center; width:100%; flex-wrap:wrap">
                                <div data-amount="1" style="cursor:pointer; font-size:2rem; width:30%" id="prevent-tooltip-exit">x1</div>
                                <div data-amount="5" style="cursor:pointer; font-size:2rem; width:30%">x5</div>
                                <div data-amount="10" style="cursor:pointer; font-size:2rem; width:30%">x10</div>
                                <span style="flex-basis: 100%; height:2rem"></span>
                                <div data-amount="25" style="cursor:pointer; font-size:2rem; width:30%">x25</div>
                                <div data-amount="50" style="cursor:pointer; font-size:2rem; width:30%">x50</div>
                                <div data-amount="100" style="cursor:pointer; font-size:2rem; width:30%">x100</div>
                            </span>
                        `
                        document.querySelectorAll("#tooltipBottom div").forEach(el => {
                            el.addEventListener("click", () => {
                                buyItem(+el.dataset.amount)
                            })
                        })
                        openTooltip()
                    });

                    function buyItem(amount) {
                        const currencyId = shop.shopGoldenCrownExchange.currency || item.bottleCap.id;
                        const price = shop.shopGoldenCrownExchange.price;
                        const totalCost = price * amount;
                        if (item[currencyId].got >= totalCost) {
                            item[currencyId].got -= totalCost;
                            for (let l = 0; l < amount; l++) {
                                if (shop.shopGoldenCrownExchange.effect) {
                                    shop.shopGoldenCrownExchange.effect();
                                } else {
                                    item[shop.shopGoldenCrownExchange.icon].got += 1;
                                }
                            }
                            updateItemShop();
                            closeTooltip();
                        } else {
                            document.getElementById("tooltipTitle").innerHTML = "Cant afford";
                            document.getElementById("tooltipTop").style.display = "none";
                            document.getElementById("tooltipMid").style.display = "none";
                            document.getElementById("tooltipBottom").innerHTML = `You cant afford to purchase this<span id="prevent-tooltip-exit"></span>`;
                        }
                    }

                    const backButton = shopListing.querySelector('#shop-back');
                    if (backButton) {
                        shopListing.insertBefore(exchangeDiv, backButton.nextSibling);
                    } else {
                        shopListing.insertBefore(exchangeDiv, shopListing.firstChild);
                    }
                }
            }
        }
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() {
            setTimeout(updateItemShop, 100);
        });
    } else {
        setTimeout(updateItemShop, 100);
    }

  window[MOD_ID + "_installed"] = true;
}

function remove() {
  window[MOD_ID + "_installed"] = false;
  if (__orig.loadGame) window.loadGame = __orig.loadGame;
  if (__orig.setWildPkmn) window.setWildPkmn = __orig.setWildPkmn;
  if (__orig.updateItemShop) window.updateItemShop = __orig.updateItemShop;
  const ids = [];
  ids.forEach(id => { const el = document.getElementById(id); if (el) el.remove(); });
  document.querySelectorAll('[data-exchange-item="goldenCrown"]').forEach(e => e.remove());
}
