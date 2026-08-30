(function () {
  const modId = "workshopWelcome";
  const badgeId = "workshop-welcome-badge";

  function removeBadge() {
    document.getElementById(badgeId)?.remove();
  }

  function renderBadge() {
    removeBadge();

    const badge = document.createElement("div");
    badge.id = badgeId;
    badge.textContent = "创意工坊Mod 已启用";
    badge.style.position = "fixed";
    badge.style.right = "1rem";
    badge.style.bottom = "1rem";
    badge.style.zIndex = "1300";
    badge.style.padding = "0.55rem 0.8rem";
    badge.style.border = "1px solid rgba(255, 255, 255, 0.35)";
    badge.style.borderRadius = "0.45rem";
    badge.style.background = "rgba(30, 28, 24, 0.92)";
    badge.style.color = "white";
    badge.style.fontSize = "0.95rem";
    badge.style.boxShadow = "rgba(0, 0, 0, 0.35) 0 0.35rem 0.8rem";
    document.body.appendChild(badge);
  }

  UltraMods.define({
    id: modId,
    name: "欢迎来到创意工坊",
    description: "这是一个仅供下载的示例Mod，用于测试 GitHub Pages 创意工坊的运作流程。",
    image: "img/items/endorsement.png",
    version: "1.0.0",
    author: "UltraPokechill",
    category: "示例",
    hooks: {
      onToggle(api, payload) {
        if (payload.enabled) renderBadge();
        else removeBadge();
      },
      onRefresh(api) {
        if (api.isEnabled(modId)) renderBadge();
      }
    }
  });
})();
