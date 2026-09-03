const MOD_ID = "saveVault";
const VERSION = "2.0.5";
// 备份目标地址改为“当前项目运行时所在的同源服务器”（由 Start.bat 启动的本地服务器，
// 或部署后的站点域名），不再硬编码旧的外部服务器。若以 file:// 方式打开则回退到本地开发地址。
// 备份服务器地址：优先读取浏览器中持久化保存的自定义地址，否则回退到当前
// 站点同源地址（由 Start.bat 启动的本地服务器或部署后的站点域名）。以 file://
// 方式打开时回退到本地开发地址。地址可在 Mod 管理界面的「存档保险库」卡片中编辑。
const SERVER_URL_STORAGE_KEY = "ultraPokechill:saveVault:serverUrl:v1";
let SERVER_URL = resolveServerUrl();
function resolveServerUrl() {
  try {
    const saved = (localStorage.getItem(SERVER_URL_STORAGE_KEY) || "").trim();
    if (saved && /^https?:\/\/.+/.test(saved.replace(/\/+$/, ""))) {
      return saved.replace(/\/+$/, "");
    }
  } catch (_) {}
  const origin = window.location && window.location.origin;
  if (origin && origin !== "null" && /^https?:\/\//.test(origin)) {
    return origin.replace(/\/+$/, "");
  }
  return "http://0.0.0.0:18000";
}
function setServerUrl(value) {
  const normalized = (value || "").trim().replace(/\/+$/, "");
  if (!normalized) {
    const origin = window.location && window.location.origin;
    const fallback = (origin && /^https?:\/\//.test(origin)) ? origin.replace(/\/+$/, "") : "http://0.0.0.0:18000";
    SERVER_URL = fallback;
    try { localStorage.removeItem(SERVER_URL_STORAGE_KEY); } catch (_) {}
    return fallback;
  }
  if (!/^https?:\/\/.+/.test(normalized)) throw new Error("请输入以 http:// 或 https:// 开头的有效地址。");
  SERVER_URL = normalized;
  try { localStorage.setItem(SERVER_URL_STORAGE_KEY, normalized); } catch (_) {}
  return normalized;
}
const CREDENTIALS_KEY = "ultraPokechill:saveVault:credentials:v1";
const MENU_BUTTON_ID = "save-vault-menu-button";
const ROOT_ID = "save-vault-root";
const STYLE_ID = "save-vault-style";
const TOAST_ID = "save-vault-toast";
const BACKUP_INTERVAL_MS = 5 * 60 * 1000;
const MAX_SNAPSHOT_BYTES = 8 * 1024 * 1024;
const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();
const ANNOUNCEMENT_ID = "battle-versus-project-announcement";
const ANNOUNCEMENT_STORAGE_KEY = "ultraPokechill:battleVersus:projectAnnouncementSeen";
const GUNS_LOL_ICON = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAAAXNSR0IArs4c6QAAA9JJREFUeNq9lkmIHFUYxz81oqBRJBgl6kFwOXhSvIiigWh37T01SYMTF0QkihCR2O/Vq56ervdqm+kZlBgmjB70oGJkhFxEL254EBHEgyIumAVCSIaEXLJv0/kelVReF0Nm6an5wUd1UV3v2/7vewVlMLp59A6q831o//hWvA2vB6ghfgjqO2+FlSCuv3cPqQbnG9Wgq5pniA9gJWiaSbWhiePSKZHOK2jVdlfeN2vJi4CUV3pDfH7FWX7Ng0DTghPMGX1g+bN2kucI9jrPGk35XWgFn4Llgrw0fgsuOPlOtT2rOsRgfhx24seZFQXFAKgRvg/LAXPTJ6jO/y04OI/Kp5zz67vd7nXMjuKrz/isZ4YfefWx26EfdmzdcRMz+Rip8h6lE03sHRlMnwQkqI/fTc3w6zxrnR/2a+km6BcU0KNUF3+oAttWac9iWac8p7MaEM8KNxONH1UzT1+eXAP9sGXLhzdiRm1c+KyqbDlwmm6yAZBkaPtdnil2F3tOdDED/TCycewRYojfSKVX3Z4VfRy8ENyWVSapE50fyR0rFWKWSGEpTNenb6BWRLHXp9VFsQqHmBW7gIyhoJghPskdKyar5dnR67AUWoPjD3qG+Ll30fYsM8MpHwcOIP5A+kxDD/YrzwsBBCd2vrnI+S+3D26jt4gmThaynmkOJDogE7j3mRVtx6l2IXeoCI7Z0TQ+uyjvh+24BgvFd9OH5AApZI2DQ3zB3fG1mcKTp4jW/r8nUxlkRYot+I/VomcBwXd+b2Q6mVzgKI2fbmj8TK96+SHfiRxA+Hq+CjPjjWqWNVHLje/hgBH8FXEzXAbvJ2Tw2Ma/YCFQg79bcP5nG4cJIK1a52Gq81/U56oxJ34DCrBa8trldc7JiTi/6Nxwvczu6uQS37WHOuuoGY1gP09d2fek54jNDLPdpe4c1IePAjyZzX3xKyyUph1tzUorLZjP8v9RjR/vvNpZLT9EqMl/UoR7pDmYPAaLgZriyzyASp7pvIa93i0dKlX5NJAtXCx+Pb1Tbrk8AEVwhcrMGZychsyON0I/tNx0IHOMlvXxANF6Tr45v3iwCt8Hg517YTnw7fBtXPAbNpBl05LngRYcy7NWs6/kZRdQJp4Vdq6lA6rzPXKSQlngKN4wV+bqve+kDpQFZreK6uLgXNmTXP3Rt1AmzBBp0bm6beUhNPx8fB+URcuO7lcnZjEQgkFQK9oEZUKN8Cul78U5cJg6nXVQJi1nVMudK7OAmuIz303XQNnI080zxN/Kp9fMcC12YSVhthjydL7P08Nd3J1Yu9R1LgFLF3oZUAMlkQAAAABJRU5ErkJggg==";

const runtime = {
  api: undefined,
  enabled: false,
  interval: undefined,
  menuObserver: undefined,
  observerTimer: undefined,
  backupInFlight: false,
  serverReturnView: "home",
  snapshots: [],
  view: "home"
};

UltraMods.define({
  id: MOD_ID,
  name: "存档保险库",
  description: "每五分钟自动备份您的 UltraPokechill 存档至云端，使用前请先设置备份服务器地址。",
  image: "img/items/parcel.png",
  version: VERSION,
  author: "UltraPokechill",
  category: "实用工具",
  hooks: {
    onToggle(api, payload) {
      if (payload.enabled) install(api);
      else uninstall();
    },
    onRefresh(api) {
      if (api.isEnabled(MOD_ID)) install(api);
    }
  }
});

// The old Battle Versus update is deliberately owned by Save Vault now, so
// it remains available without shipping the online battle mod itself.
scheduleProjectAnnouncement();

function scheduleProjectAnnouncement() {
  try {
    if (window.localStorage?.getItem(ANNOUNCEMENT_STORAGE_KEY) === "1") return;
  } catch (error) {
    console.warn("[存档保险库] 公告不可用", error);
  }
  if (window.__ultraProjectAnnouncementScheduled) return;
  window.__ultraProjectAnnouncementScheduled = true;

  const show = () => window.setTimeout(() => {
    if (window.__ultraProjectAnnouncementShown || document.getElementById(ANNOUNCEMENT_ID)) return;
    window.__ultraProjectAnnouncementShown = true;
    try { window.localStorage?.setItem(ANNOUNCEMENT_STORAGE_KEY, "1"); } catch (error) { console.warn("[存档保险库] 无法保存公告记录", error); }
    const overlay = document.createElement("div");
    overlay.id = ANNOUNCEMENT_ID;
    overlay.innerHTML = `
      <style>
        #${ANNOUNCEMENT_ID}{position:absolute;inset:0;z-index:10060;display:flex;align-items:center;justify-content:center;padding:1rem;background:color-mix(in srgb,var(--dark1) 82%,transparent);backdrop-filter:blur(4px);animation:svAnnouncementFade .18s ease-out}
        #${ANNOUNCEMENT_ID}>div{position:relative;display:grid;grid-template-columns:8rem minmax(0,1fr);align-items:center;width:min(35rem,100%);min-height:13rem;padding:1.25rem;color:var(--dark1);background:linear-gradient(135deg,var(--light2),var(--light1));border:3px solid var(--dark2);border-radius:.7rem;box-shadow:0 1rem 3rem #0007;font-family:inherit}
        #${ANNOUNCEMENT_ID} .sv-announcement-sprite{width:8rem;max-height:10rem;object-fit:contain;image-rendering:pixelated;filter:drop-shadow(0 .45rem .25rem #352b1b44)}
        #${ANNOUNCEMENT_ID} .sv-announcement-copy{display:flex;min-width:0;flex-direction:column;align-items:flex-start}#${ANNOUNCEMENT_ID} small{color:var(--dark2);font-weight:800;letter-spacing:.1em;text-transform:uppercase}
        #${ANNOUNCEMENT_ID} strong{margin-top:.25rem;font-size:clamp(1.45rem,5vw,2.05rem);line-height:1.08}#${ANNOUNCEMENT_ID} p{margin:.45rem 0 1rem;font-size:1.1rem}
        #${ANNOUNCEMENT_ID} .sv-announcement-actions{display:flex;flex-wrap:wrap;gap:.55rem}#${ANNOUNCEMENT_ID} a,#${ANNOUNCEMENT_ID} button{display:inline-flex;min-height:2.6rem;align-items:center;justify-content:center;gap:.45rem;padding:.5rem .8rem;color:var(--light2);background:var(--dark1);border:0;border-radius:.35rem;font:inherit;font-weight:800;text-decoration:none;cursor:pointer}#${ANNOUNCEMENT_ID} a{background:var(--dark2)}#${ANNOUNCEMENT_ID} .sv-guns-icon{box-sizing:content-box;width:1.45rem;height:1.45rem;padding:.16rem;background:#f8f3e5;border:1px solid #b49d65;border-radius:.25rem;image-rendering:pixelated;object-fit:contain}
        #${ANNOUNCEMENT_ID} .sv-announcement-x{position:absolute;top:.4rem;right:.55rem;width:2rem;height:2rem;padding:0;color:var(--dark1);background:transparent;font-size:1.7rem}
        @keyframes svAnnouncementFade{from{opacity:0}to{opacity:1}}@media(max-width:500px){#${ANNOUNCEMENT_ID}>div{grid-template-columns:5rem 1fr;padding:1rem .75rem}#${ANNOUNCEMENT_ID} .sv-announcement-sprite{width:5.2rem}#${ANNOUNCEMENT_ID} .sv-announcement-actions{width:100%}#${ANNOUNCEMENT_ID} a,#${ANNOUNCEMENT_ID} .sv-announcement-actions button{width:100%}}
      </style>
      <div role="dialog" aria-modal="true" aria-labelledby="sv-project-title">
        <button type="button" class="sv-announcement-x" data-sv-announcement-close aria-label="Close">&times;</button>
        <img class="sv-announcement-sprite" src="img/pkmn/sprite/pikachuPhd.png" alt="">
        <div class="sv-announcement-copy"><small>最新动态</small><strong id="sv-project-title">这个项目并没有结束！</strong><p>我只是有点忙啦~</p><div class="sv-announcement-actions"><a href="https://guns.lol/rodk" target="_blank" rel="noopener noreferrer"><img class="sv-guns-icon" src="${GUNS_LOL_ICON}" alt="Guns.lol">guns.lol/rodk</a><button type="button" data-sv-announcement-close>确定</button></div></div>
      </div>`;
    overlay.addEventListener("click", event => {
      if (event.target === overlay || event.target.closest("[data-sv-announcement-close]")) overlay.remove();
    });
    (document.getElementById("main-content") || document.body).appendChild(overlay);
    overlay.querySelector(".sv-announcement-actions button")?.focus();
  }, 350);

  if (document.readyState === "complete") show();
  else window.addEventListener("load", show, { once: true });
}

function install(api) {
  runtime.api = api;
  runtime.enabled = true;
  installStyles();
  ensureMenuButton();
  observeMenu();
  startAutomaticBackup();
}

function uninstall() {
  runtime.enabled = false;
  window.clearInterval(runtime.interval);
  runtime.interval = undefined;
  runtime.menuObserver?.disconnect();
  runtime.menuObserver = undefined;
  window.clearTimeout(runtime.observerTimer);
  runtime.observerTimer = undefined;
  document.getElementById(MENU_BUTTON_ID)?.remove();
  document.getElementById(ROOT_ID)?.remove();
  document.getElementById(TOAST_ID)?.remove();
  document.getElementById(STYLE_ID)?.remove();
}

function installStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    #${ROOT_ID} { position:fixed; inset:0; z-index:2147483000; display:flex; align-items:center; justify-content:center; padding:18px; box-sizing:border-box; background:rgba(20,18,15,.68); color:var(--dark3, #37342c); font-family:inherit; }
    #${ROOT_ID} *, #${ROOT_ID} *::before, #${ROOT_ID} *::after { box-sizing:border-box; }
    #${ROOT_ID} .sv-card { width:min(680px, 100%); max-height:min(92dvh, 790px); overflow:auto; background:var(--light1, #f5e7ba); border:3px solid var(--dark2, #454137); border-radius:12px; box-shadow:0 16px 45px rgba(0,0,0,.42); }
    #${ROOT_ID} .sv-head { position:sticky; top:0; z-index:2; display:flex; gap:12px; align-items:flex-start; justify-content:space-between; padding:17px 19px 14px; color:var(--light1, #f7e8ba); background:var(--dark2, #3c3931); border-bottom:2px solid var(--accent, #c89945); }
    #${ROOT_ID} .sv-title { display:flex; align-items:center; gap:10px; min-width:0; }
    #${ROOT_ID} .sv-title img { width:34px; height:34px; image-rendering:pixelated; object-fit:contain; }
    #${ROOT_ID} h2, #${ROOT_ID} h3, #${ROOT_ID} p { margin:0; }
    #${ROOT_ID} h2 { font-size:1.22rem; line-height:1.1; color:inherit; }
    #${ROOT_ID} h3 { font-size:.9rem; letter-spacing:.03em; text-transform:uppercase; }
    #${ROOT_ID} .sv-subtitle { display:block; margin-top:3px; font-size:.79rem; opacity:.8; }
    #${ROOT_ID} .sv-close, #${ROOT_ID} button { appearance:none; border:2px solid rgba(48,45,38,.45); border-radius:6px; color:var(--dark3, #343128); background:var(--light2, #e5d6a6); font:inherit; font-weight:700; cursor:pointer; }
    #${ROOT_ID} .sv-close { min-width:36px; min-height:36px; color:var(--light1, #fff1c9); background:transparent; border-color:rgba(255,241,201,.38); font-size:1.18rem; line-height:1; }
    #${ROOT_ID} .sv-close:hover { background:rgba(255,255,255,.12); }
    #${ROOT_ID} .sv-body { padding:19px; }
    #${ROOT_ID} .sv-stack { display:grid; gap:14px; }
    #${ROOT_ID} .sv-panel { display:grid; gap:10px; padding:15px; background:color-mix(in srgb, var(--light2, #e5d6a6) 72%, transparent); border:1px solid rgba(55,52,43,.27); border-radius:8px; }
    #${ROOT_ID} .sv-panel p { color:var(--dark2, #474235); font-size:.91rem; line-height:1.42; }
    #${ROOT_ID} .sv-note { padding:10px 12px; background:rgba(77,145,216,.14); border-left:4px solid #4f91d8; border-radius:4px; font-size:.85rem; line-height:1.38; }
    #${ROOT_ID} .sv-actions { display:flex; flex-wrap:wrap; gap:9px; align-items:center; }
    #${ROOT_ID} button { min-height:39px; padding:8px 13px; }
    #${ROOT_ID} button:hover:not(:disabled) { filter:brightness(1.08); transform:translateY(-1px); }
    #${ROOT_ID} button:disabled { opacity:.52; cursor:not-allowed; }
    #${ROOT_ID} .sv-primary { color:#fff3cc; background:var(--dark2, #3a382f); border-color:var(--dark2, #3a382f); }
    #${ROOT_ID} .sv-danger { color:#fff0e4; background:#b95350; border-color:#94433f; }
    #${ROOT_ID} .sv-outline { background:transparent; }
    #${ROOT_ID} label { display:grid; gap:5px; font-size:.86rem; font-weight:700; }
    #${ROOT_ID} input { width:100%; min-height:41px; padding:8px 10px; color:var(--dark3, #37342b); background:var(--light1, #f7e8be); border:1px solid rgba(52,48,39,.4); border-radius:5px; font:inherit; font-weight:600; }
    #${ROOT_ID} input:focus { outline:2px solid var(--accent, #c89945); outline-offset:1px; }
    #${ROOT_ID} .sv-code { overflow-wrap:anywhere; padding:12px; color:#fff5ce; background:var(--dark2, #38362e); border-radius:6px; font-family:monospace; font-size:1rem; font-weight:700; letter-spacing:.045em; text-align:center; }
    #${ROOT_ID} .sv-status { display:flex; gap:9px; align-items:flex-start; padding:10px 12px; background:rgba(79,145,216,.12); border-radius:6px; font-size:.87rem; line-height:1.35; }
    #${ROOT_ID} .sv-status::before { content:""; flex:0 0 auto; width:9px; height:9px; margin-top:4px; border-radius:50%; background:#4f91d8; }
    #${ROOT_ID} .sv-warning { display:flex; gap:9px; align-items:flex-start; padding:10px 12px; background:rgba(203,95,72,.13); border-radius:6px; font-size:.87rem; line-height:1.35; }
    #${ROOT_ID} .sv-warning::before { content:""; flex:0 0 auto; width:9px; height:9px; margin-top:4px; border-radius:50%; background:#c75d51; }
    #${ROOT_ID} .sv-list { display:grid; gap:8px; }
    #${ROOT_ID} .sv-snapshot { display:flex; align-items:center; justify-content:space-between; gap:10px; padding:11px; background:rgba(54,51,43,.1); border:1px solid rgba(55,52,43,.22); border-radius:6px; }
    #${ROOT_ID} .sv-snapshot strong, #${ROOT_ID} .sv-snapshot span { display:block; }
    #${ROOT_ID} .sv-snapshot span { margin-top:3px; font-size:.78rem; opacity:.75; }
    #${ROOT_ID} .sv-empty { padding:14px; color:var(--dark2, #454137); background:rgba(54,51,43,.1); border-radius:6px; text-align:center; font-size:.88rem; }
    #${ROOT_ID} .sv-checkbox { display:flex; gap:8px; align-items:flex-start; font-size:.84rem; line-height:1.35; font-weight:600; }
    #${ROOT_ID} .sv-checkbox input { width:17px; min-height:17px; margin:0; }
    #${TOAST_ID} { position:fixed; z-index:2147483647; left:50%; bottom:22px; transform:translateX(-50%); display:flex; align-items:center; justify-content:center; gap:9px; max-width:min(94vw, 600px); padding:11px 15px; color:#fff6d8; background:#3d3a31; border:2px solid #d0ae65; border-radius:7px; box-shadow:0 8px 18px rgba(0,0,0,.32); font:700 .88rem inherit; text-align:center; }
    #${TOAST_ID}.error { background:#9f4644; border-color:#f3b16c; }
    #${TOAST_ID}.saving::before { content:""; width:16px; height:16px; flex:0 0 16px; border:3px solid rgba(255,246,215,.35); border-top-color:#fff6d8; border-radius:50%; animation:save-vault-spin .72s linear infinite; }
    @keyframes save-vault-spin { to { transform:rotate(360deg); } }
    @media (max-width:480px) { #${ROOT_ID} { align-items:flex-end; padding:8px; } #${ROOT_ID} .sv-card { max-height:calc(100dvh - 16px); } #${ROOT_ID} .sv-head { padding:14px; } #${ROOT_ID} .sv-body { padding:14px; } #${ROOT_ID} .sv-snapshot { align-items:flex-start; flex-direction:column; } #${ROOT_ID} .sv-snapshot button { width:100%; } }
  `;
  document.head.appendChild(style);
}

function ensureMenuButton() {
  const parent = document.getElementById("menu-items");
  if (!parent || document.getElementById(MENU_BUTTON_ID)) return;
  const button = document.createElement("div");
  button.id = MENU_BUTTON_ID;
  button.className = "menu-item";
  button.setAttribute("role", "button");
  button.tabIndex = 0;
  button.innerHTML = '<img src="img/items/parcel.png" alt=""><span>存档保险库</span>';
  const open = event => {
    event.preventDefault();
    event.stopPropagation();
    openVault();
  };
  button.addEventListener("click", open);
  button.addEventListener("keydown", event => {
    if (event.key === "Enter" || event.key === " ") open(event);
  });
  parent.appendChild(button);
}

function observeMenu() {
  if (runtime.menuObserver || !document.documentElement) return;
  runtime.menuObserver = new MutationObserver(() => {
    if (!runtime.enabled || document.getElementById(MENU_BUTTON_ID)) return;
    window.clearTimeout(runtime.observerTimer);
    runtime.observerTimer = window.setTimeout(() => {
      runtime.observerTimer = undefined;
      if (runtime.enabled) ensureMenuButton();
    }, 60);
  });
  runtime.menuObserver.observe(document.documentElement, { childList: true, subtree: true });
}

// ---- 存档保险库界面：可编辑的备份服务器地址 ----
// 在存档保险库面板内提供「服务器设置」视图，用户可直接设置备份服务器地址。
// 点击「测试连接并保存」时，会先向该地址发起一次连接测试；测试成功才写入
// 浏览器 localStorage（刷新后依然生效），失败则展示原因且不保存。

function escapeAttr(value) {
  return String(value || "").replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function renderServerSettings() {
  const current = SERVER_URL;
  return `<div class="sv-stack">
    <div class="sv-panel"><h3>备份服务器地址</h3><p>设置接收备份的服务器地址。默认使用当前站点同源地址（本地服务器或部署后的站点域名）。</p>
      <label>服务器地址<input name="server" type="text" spellcheck="false" autocomplete="off" placeholder="https://your-server.example.com" value="${escapeAttr(current)}"></label>
      <div class="sv-actions"><button class="sv-primary" type="button" data-action="server-test-save">测试连接并保存</button><button class="sv-outline" type="button" data-action="server-back">返回</button></div>
      <div class="sv-server-result" data-role="server-result" hidden></div>
    </div>
    <div class="sv-panel"><h3>说明</h3><p>点击「测试连接并保存」后，系统会先向该地址发送一次连接测试；测试成功才会保存配置，刷新页面后依然生效；测试失败会显示原因且不会保存。</p></div>
  </div>`;
}

async function testServerConnection(url) {
  const prev = SERVER_URL;
  SERVER_URL = url;
  try {
    // 用一次性生成的合法格式恢复代码做一次只读的快照列表请求；
    // 服务器返回 200 且响应为 {snapshots:[...]} 即视为连接成功且接口存在。
    const testCredentials = { code: generateRecoveryCode() };
    const response = await vaultFetch("/saveVault/snapshots", { method: "GET" }, testCredentials);
    if (!response.ok) {
      const data = await readJson(response);
      return { ok: false, reason: serverMessage(data, `服务器返回 HTTP ${response.status}`) };
    }
    const data = await readJson(response);
    if (!data || !Array.isArray(data.snapshots)) {
      return { ok: false, reason: "服务器未实现存档保险库接口（/saveVault/snapshots 返回格式不符）。" };
    }
    return { ok: true };
  } catch (error) {
    return { ok: false, reason: readError(error) };
  } finally {
    SERVER_URL = prev;
  }
}

function showServerResult(el, ok, message) {
  if (!el) return;
  el.hidden = false;
  el.className = `sv-server-result ${ok === true ? "sv-status" : ok === false ? "sv-warning" : "sv-status"}`.trim();
  el.textContent = message;
}

function startAutomaticBackup() {
  if (runtime.interval) return;
  runtime.interval = window.setInterval(() => {
    // Browsers can delay background timers, but whenever the timer gets time
    // the vault still saves. A hidden tab must not silently disable protection.
    if (!runtime.enabled || !getCredentials()) return;
    backupCurrentSave(false).catch(() => {});
  }, BACKUP_INTERVAL_MS);
  const credentials = getCredentials();
  if (credentials && Date.now() - Number(credentials.lastBackupAt || 0) > BACKUP_INTERVAL_MS) {
    window.setTimeout(() => backupCurrentSave(false).catch(() => {}), 12_000);
  }
}

function openVault() {
  installStyles();
  runtime.view = getCredentials() ? "dashboard" : "home";
  renderVault();
  if (runtime.view === "dashboard") refreshSnapshots(true).catch(error => showToast(readError(error), true));
}

function closeVault() {
  document.getElementById(ROOT_ID)?.remove();
}

function renderVault() {
  let root = document.getElementById(ROOT_ID);
  if (!root) {
    root = document.createElement("div");
    root.id = ROOT_ID;
    root.addEventListener("click", event => { if (event.target === root) closeVault(); });
    document.body.appendChild(root);
  }
  const body = runtime.view === "create" ? renderCreate()
    : runtime.view === "recovery" ? renderRecovery()
    : runtime.view === "show-code" ? renderRecoveryCode()
    : runtime.view === "server" ? renderServerSettings()
    : runtime.view === "dashboard" ? renderDashboard()
    : renderHome();
  root.innerHTML = `
    <section class="sv-card" role="dialog" aria-modal="true" aria-label="Save Vault">
      <header class="sv-head">
        <div class="sv-title"><img src="img/items/parcel.png" alt=""><div><h2>存档保险库</h2><span class="sv-subtitle">自动备份存档</span></div></div>
        <button class="sv-close" type="button" data-action="close" aria-label="Close">X</button>
      </header>
      <div class="sv-body">${body}</div>
    </section>`;
  bindVaultEvents(root);
}

function renderHome() {
  return `<div class="sv-stack">
    <div class="sv-panel"><h3>自动备份</h3><p>存档保险库会为您保留最近三次正常存档的副本。<br>只要此页面保持打开，系统就会每五分钟自动备份一次。</p><div class="sv-note">您的原始存档内容会上传到备份服务器进行存储。<br>恢复备份时，必须提供对应的恢复代码。</div></div>
    <div class="sv-actions"><button class="sv-primary" type="button" data-action="create">创建存档保险库</button><button class="sv-outline" type="button" data-action="recover">恢复已有备份</button><button class="sv-outline" type="button" data-action="server">服务器设置</button></div>
    <div class="sv-panel"><h3>重要提醒</h3><p>请务必将恢复代码保存在此浏览器之外的安全位置。一旦浏览器数据被清除，您需要提供恢复代码才能找回您的三份存档备份。</p></div>
  </div>`;
}

function renderCreate() {
  return `<form class="sv-stack" data-form="create">
    <div class="sv-panel"><h3>创建您的存档保险库</h3><p>系统会为您生成一份恢复代码，并每五分钟自动备份您的存档。请务必在下一步妥善保存恢复代码。</p></div>
    <div class="sv-actions"><button class="sv-primary" type="submit">创建保险库并首次备份</button><button class="sv-outline" type="button" data-action="home">返回</button></div>
  </form>`;
}

function renderRecoveryCode() {
  const credentials = getCredentials();
  const code = credentials?.code || "";
  return `<div class="sv-stack">
    <div class="sv-panel"><h3>请记下你的恢复代码</h3><p>这是存档保险库唯一一次向您完整展示新生成的恢复代码。请将其保存在本浏览器之外的安全位置。</p><div class="sv-code">${code}</div><div class="sv-actions"><button type="button" data-action="copy-code">复制代码</button></div></div>
    <label class="sv-checkbox"><input type="checkbox" data-role="code-confirm"> <span>我已将此恢复代码保存在本浏览器之外的安全位置。</span></label>
    <div class="sv-actions"><button class="sv-primary" type="button" data-action="finish-code" disabled>打开存档保险库</button></div>
  </div>`;
}

function renderRecovery() {
  return `<form class="sv-stack" data-form="recovery">
    <div class="sv-panel"><h3>恢复已有备份</h3><p>请输入创建此保险库时使用的恢复代码。<br>在服务器确认之前，该代码仅保留在本浏览器中。</p>
      <label>恢复代码<input name="code" autocomplete="off" autocapitalize="characters" spellcheck="false" required placeholder="SV1-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX"></label>
    </div>
    <div class="sv-actions"><button class="sv-primary" type="submit">查找我的备份</button><button class="sv-outline" type="button" data-action="home">返回</button></div>
  </form>`;
}

function renderDashboard() {
  const credentials = getCredentials();
  const last = Number(credentials?.lastBackupAt || 0);
  const snapshots = runtime.snapshots.slice().sort((a, b) => b.createdAt - a.createdAt);
  const list = snapshots.length ? snapshots.map(snapshot => `<div class="sv-snapshot"><div><strong>${formatDate(snapshot.createdAt)}</strong><span>${formatBytes(snapshot.size)} 已备份 · 槽位 ${snapshot.slot + 1}</span></div><button type="button" data-action="restore" data-slot="${snapshot.slot}">恢复此存档</button></div>`).join("") : '<div class="sv-empty">尚未发现云端备份。点击“立即备份”创建一个。</div>';
  return `<div class="sv-stack">
    <div class="sv-panel"><h3>自动存档已开启</h3><p>上次本地备份：<strong>${last ? formatDate(last) : "尚未备份"}</strong><br>只要此页面保持打开，系统就会每五分钟自动备份一次。</p><div class="sv-status">仅保留最新的三份存档。内容未变化的存档不会重复上传。</div><div class="sv-actions"><button class="sv-primary" type="button" data-action="backup">立即备份</button><button type="button" data-action="refresh">刷新备份记录</button></div></div>
    <div class="sv-panel"><h3>恢复记录</h3><div class="sv-list">${list}</div></div>
    <div class="sv-panel"><h3>设备访问</h3><p>为了让自动备份能够运行，你的恢复代码将保存在本浏览器中。</p><div class="sv-actions"><button type="button" data-action="show-local-code">显示恢复代码</button><button class="sv-danger" type="button" data-action="disconnect">移除本设备访问</button></div></div>
    <div class="sv-panel"><h3>备份服务器</h3><p>当前备份服务器：<strong>${escapeAttr(SERVER_URL)}</strong></p><div class="sv-actions"><button type="button" data-action="server">服务器设置</button></div></div>
  </div>`;
}

function bindVaultEvents(root) {
  root.querySelector('[data-action="close"]')?.addEventListener("click", closeVault);
  root.querySelectorAll('[data-action="home"]').forEach(button => button.addEventListener("click", () => { runtime.view = "home"; renderVault(); }));
  root.querySelector('[data-action="create"]')?.addEventListener("click", () => { runtime.view = "create"; renderVault(); });
  root.querySelector('[data-action="recover"]')?.addEventListener("click", () => { runtime.view = "recovery"; renderVault(); });
  root.querySelector('[data-action="backup"]')?.addEventListener("click", () => backupCurrentSave(true).catch(error => showToast(readError(error), true)));
  root.querySelector('[data-action="refresh"]')?.addEventListener("click", () => refreshSnapshots(true).catch(error => showToast(readError(error), true)));
  root.querySelector('[data-action="show-local-code"]')?.addEventListener("click", () => { runtime.view = "show-code"; renderVault(); });
  root.querySelector('[data-action="disconnect"]')?.addEventListener("click", disconnectDevice);
  root.querySelector('[data-action="copy-code"]')?.addEventListener("click", async () => {
    const code = getCredentials()?.code;
    if (!code) return;
    await copyText(code);
    showToast("恢复代码已复制");
  });
  root.querySelector('[data-role="code-confirm"]')?.addEventListener("change", event => {
    const finish = root.querySelector('[data-action="finish-code"]');
    if (finish) finish.disabled = !event.target.checked;
  });
  root.querySelector('[data-action="finish-code"]')?.addEventListener("click", () => {
    runtime.view = "dashboard";
    renderVault();
    refreshSnapshots(true).catch(error => showToast(readError(error), true));
  });
  root.querySelector('[data-form="create"]')?.addEventListener("submit", createVault);
  root.querySelector('[data-form="recovery"]')?.addEventListener("submit", recoverVault);
  root.querySelectorAll('[data-action="restore"]').forEach(button => button.addEventListener("click", () => restoreSnapshot(Number(button.dataset.slot)).catch(error => showToast(readError(error), true))));
  root.querySelector('[data-action="server"]')?.addEventListener("click", () => {
    runtime.serverReturnView = runtime.view;
    runtime.view = "server";
    renderVault();
  });
  root.querySelector('[data-action="server-back"]')?.addEventListener("click", () => {
    runtime.view = runtime.serverReturnView || "dashboard";
    renderVault();
  });
  root.querySelector('[data-action="server-test-save"]')?.addEventListener("click", async () => {
    const input = root.querySelector('[name="server"]');
    const resultEl = root.querySelector('[data-role="server-result"]');
    const raw = (input.value || "").trim();
    let normalized;
    if (!raw) {
      const origin = window.location && window.location.origin;
      normalized = (origin && /^https?:\/\//.test(origin)) ? origin.replace(/\/+$/, "") : "http://0.0.0.0:18000";
    } else {
      normalized = raw.replace(/\/+$/, "");
      if (!/^https?:\/\/.+/.test(normalized)) {
        showServerResult(resultEl, false, "请输入以 http:// 或 https:// 开头的有效地址。");
        return;
      }
    }
    showServerResult(resultEl, null, "正在测试与服务器的连接...");
    const test = await testServerConnection(normalized);
    if (!test.ok) {
      showServerResult(resultEl, false, `连接测试失败：${test.reason}`);
      return;
    }
    setServerUrl(normalized);
    showServerResult(resultEl, true, "连接测试成功，服务器地址已保存。刷新页面后依然生效。");
  });
}

async function createVault(event) {
  event.preventDefault();
  const credentials = { version: 1, code: generateRecoveryCode(), lastHash: "", lastBackupAt: 0 };
  saveCredentials(credentials);
  try {
    showToast("正在创建存档保险库…", false, true);
    await claimVault(credentials);
  } catch (error) {
    localStorage.removeItem(CREDENTIALS_KEY);
    showToast(readError(error), true);
    return;
  }
  runtime.view = "show-code";
  renderVault();
  try {
    await backupCurrentSave(true);
  } catch (error) {
    showToast(`存档保险库已创建，但首次备份需要重试：${readError(error)}`, true);
  }
}

async function recoverVault(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const code = normalizeRecoveryCode(form.get("code"));
  if (!isRecoveryCode(code)) return showToast("该恢复代码无效。", true);
  const candidate = { version: 1, code, lastHash: "", lastBackupAt: 0 };
  try {
    const snapshots = await fetchSnapshots(candidate);
    if (!snapshots.length) throw new Error("该恢复代码下不存在任何备份，因此无法验证。");
    showToast("正在验证恢复代码...", false, true);
    await verifyRecoveryCandidate(candidate, snapshots[0]);
    await claimVault(candidate);
    saveCredentials(candidate);
    runtime.snapshots = snapshots;
    runtime.view = "dashboard";
    renderVault();
    showToast("已找到备份存档。请选择一份进行恢复。");
  } catch (error) {
    showToast(readError(error), true);
  }
}

async function refreshSnapshots(renderDashboard) {
  const credentials = getCredentials();
  if (!credentials) return;
  runtime.snapshots = await fetchSnapshots(credentials);
  // Automatic saves update memory only. They never open, redraw, or steal
  // focus from the game; the full panel is exclusively opened by its menu button.
  if (renderDashboard && runtime.view === "dashboard" && document.getElementById(ROOT_ID)) renderVault();
}

async function fetchSnapshots(credentials) {
  const response = await vaultFetch("/saveVault/snapshots", { method: "GET" }, credentials);
  const data = await readJson(response);
  if (!response.ok) throw new Error(serverMessage(data, "无法加载备份记录。"));
  return Array.isArray(data.snapshots) ? data.snapshots : [];
}

async function verifyRecoveryCandidate(credentials, snapshot) {
  const slot = Number(snapshot?.slot);
  if (!Number.isInteger(slot) || slot < 0 || slot > 2) throw new Error("备份列表无效。");
  const response = await vaultFetch(`/saveVault/snapshots/${slot}`, { method: "GET" }, credentials);
  if (!response.ok) throw new Error(serverMessage(await readJson(response), "无法验证该备份。"));
  const raw = textDecoder.decode(new Uint8Array(await response.arrayBuffer()));
  const parsed = JSON.parse(raw);
  if (!parsed || typeof parsed !== "object" || !parsed.saved || !parsed.team) {
    throw new Error("该恢复代码不包含有效的 UltraPokechill 备份。");
  }
}

async function backupCurrentSave(showResult) {
  if (runtime.backupInFlight) return;
  const credentials = getCredentials();
  if (!credentials) return;
  runtime.backupInFlight = true;
  try {
    showToast(showResult ? "正在备份你的存档..." : "[存档保险库] 正在保存存档...", false, true);
    await claimVault(credentials);
    runtime.api?.save?.();
    const raw = localStorage.getItem("gameData");
    if (!raw) throw new Error("游戏尚未生成需要保护的存档。");
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || !parsed.saved || !parsed.team) throw new Error("当前游戏存档无效。");
    const plain = textEncoder.encode(raw);
    const hash = fnv1aHash(raw);
    if (hash === credentials.lastHash) {
      showToast("[存档保险库] 存档已备份。");
      return;
    }
    if (plain.byteLength > MAX_SNAPSHOT_BYTES) throw new Error("该存档过大，超出存档保险库的上限。");
    const payload = plain;
    if (payload.byteLength > MAX_SNAPSHOT_BYTES) throw new Error("存档过大，超出存档保险库的上限。");
    const response = await vaultFetch("/saveVault/snapshots", {
      method: "POST",
      headers: { "Content-Type": "application/octet-stream" },
      body: payload
    }, credentials);
    const data = await readJson(response);
    if (!response.ok) {
      if (response.status === 429) {
        showToast("[存档保险库] 备份即将稍后重试。");
        return;
      }
      throw new Error(serverMessage(data, "无法保存存档。"));
    }
    credentials.lastHash = hash;
    credentials.lastBackupAt = Number(data.createdAt || Date.now());
    saveCredentials(credentials);
    await refreshSnapshots(showResult);
    showToast(showResult ? "存档已备份成功。" : "[存档保险库] 存档已自动备份。");
  } catch (error) {
    // Callers of manual operations still receive the error, but background
    // backups must replace their spinner with a useful notification as well.
    if (!showResult) showToast(`[存档保险库] ${readError(error)}`, true);
    throw error;
  } finally {
    runtime.backupInFlight = false;
  }
}

async function restoreSnapshot(slot) {
  if (!Number.isInteger(slot) || slot < 0 || slot > 2) throw new Error("无效的备份槽位。");
  const credentials = getCredentials();
  if (!credentials) throw new Error("本浏览器已不再拥有保险库访问权限。");
  const snapshot = runtime.snapshots.find(item => Number(item.slot) === slot);
  const description = snapshot ? formatDate(snapshot.createdAt) : "this backup";
  if (!window.confirm(`确定恢复 ${description} 吗？你当前的浏览器存档将被替换。`)) return;
  showToast("正在下载并验证存档...");
  const response = await vaultFetch(`/saveVault/snapshots/${slot}`, { method: "GET" }, credentials);
  if (!response.ok) throw new Error(serverMessage(await readJson(response), "无法下载该存档。"));
  const data = new Uint8Array(await response.arrayBuffer());
  const raw = textDecoder.decode(data);
  const parsed = JSON.parse(raw);
  if (!parsed || typeof parsed !== "object" || !parsed.saved || !parsed.team) throw new Error("该存档不是有效的 UltraPokechill 存档。");
  localStorage.setItem("gameData", raw);
  credentials.lastHash = fnv1aHash(raw);
  credentials.lastBackupAt = Date.now();
  saveCredentials(credentials);
  showToast("存档已恢复。正在重新加载游戏...");
  window.setTimeout(() => window.location.reload(), 650);
}

function disconnectDevice() {
  if (!window.confirm("确定要从本浏览器移除恢复代码吗？你的云端备份仍然安全，但自动备份将停止，直到你再次恢复此保险库。")) return;
  localStorage.removeItem(CREDENTIALS_KEY);
  runtime.snapshots = [];
  runtime.view = "home";
  renderVault();
  showToast("本浏览器已不再拥有存档保险库访问权限。");
}

async function vaultFetch(path, options, credentials) {
  const headers = new Headers(options.headers || {});
  headers.set("X-SaveVault-Code", credentials.code);
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 30_000);
  try {
    return await fetch(`${SERVER_URL}${path}`, { ...options, headers, signal: controller.signal, cache: "no-store" });
  } catch (error) {
    if (error?.name === "AbortError") throw new Error("存档保险库未能及时响应，请重试。");
    throw new Error("无法连接存档保险库，请检查网络连接或备份服务器地址设置后重试。");
  } finally {
    window.clearTimeout(timer);
  }
}

async function claimVault(credentials) {
  const response = await vaultFetch("/saveVault/claim", { method: "POST" }, credentials);
  const data = await readJson(response);
  if (!response.ok) throw new Error(serverMessage(data, "无法验证保险库。"));
}

// 加密与解密已移除：改明文备份，不再依赖 crypto.subtle（AES-GCM）。

// 密钥派生（PBKDF2）已移除：明文备份无需客户端密钥。

// 压缩（CompressionStream）已移除：明文备份无需压缩。

function getCredentials() {
  try {
    const credentials = JSON.parse(localStorage.getItem(CREDENTIALS_KEY) || "null");
    if (!credentials || !isRecoveryCode(credentials.code)) return null;
    return { version: 1, code: normalizeRecoveryCode(credentials.code), lastHash: String(credentials.lastHash || ""), lastBackupAt: Number(credentials.lastBackupAt || 0) };
  } catch (_) {
    return null;
  }
}

function saveCredentials(credentials) {
  localStorage.setItem(CREDENTIALS_KEY, JSON.stringify({ version: 1, code: credentials.code, lastHash: credentials.lastHash || "", lastBackupAt: Number(credentials.lastBackupAt || 0) }));
}

function generateRecoveryCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(20));
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = 0;
  let value = 0;
  let output = "";
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += alphabet[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  return `SV1-${output.match(/.{1,4}/g).join("-")}`;
}

function normalizeRecoveryCode(value) {
  return String(value || "").toUpperCase().replace(/\s+/g, "").replace(/_/g, "-").trim();
}

function isRecoveryCode(value) {
  return /^SV1-(?:[A-Z2-7]{4}-){7}[A-Z2-7]{4}$/.test(normalizeRecoveryCode(value));
}

async function fnv1aHash(value) {
  const str = String(value == null ? "" : value);
  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function bytesToBase64Url(bytes) {
  let binary = "";
  bytes.forEach(byte => { binary += String.fromCharCode(byte); });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function readJson(response) {
  try { return await response.json(); } catch (_) { return {}; }
}

function serverMessage(data, fallback) {
  const messages = {
    invalid_recovery_code: "恢复代码无效。",
    snapshot_not_found: "该备份已不存在。",
    snapshot_too_large: "该存档过大，超出存档保险库的上限。",
    save_too_soon: "请稍候片刻再进行下一次备份。",
    origin_not_allowed: "当前游戏地址未被允许使用存档保险库。"
  };
  return messages[data?.error] || fallback;
}

function readError(error) {
  return String(error?.message || error || "出现了一些问题。");
}

async function copyText(value) {
  try {
    await navigator.clipboard.writeText(value);
    return;
  } catch (_) {}
  const input = document.createElement("textarea");
  input.value = value;
  input.style.position = "fixed";
  input.style.opacity = "0";
  document.body.appendChild(input);
  input.select();
  document.execCommand("copy");
  input.remove();
}

function showToast(message, error, saving) {
  let toast = document.getElementById(TOAST_ID);
  if (!toast) {
    toast = document.createElement("div");
    toast.id = TOAST_ID;
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.className = `${error ? "error" : ""}${saving ? " saving" : ""}`.trim();
  window.clearTimeout(showToast.timer);
  if (!saving) showToast.timer = window.setTimeout(() => toast?.remove(), 5000);
}

function formatDate(value) {
  try { return new Date(Number(value)).toLocaleString(); } catch (_) { return "未知时间"; }
}

function formatBytes(value) {
  const bytes = Math.max(0, Number(value) || 0);
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}