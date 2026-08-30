(function () {
  "use strict";

  const MOD_ID = "saveVault";
  const VERSION = "1.0.5";
  const SERVER_URL = "https://unexpectedx-savevault.howmany1337.workers.dev";
  const CREDENTIALS_KEY = "ultraPokechill:saveVault:credentials:v1";
  const MENU_BUTTON_ID = "save-vault-menu-button";
  const ROOT_ID = "save-vault-root";
  const STYLE_ID = "save-vault-style";
  const TOAST_ID = "save-vault-toast";
  const BACKUP_INTERVAL_MS = 5 * 60 * 1000;
  const MAX_SNAPSHOT_BYTES = 8 * 1024 * 1024;
  const AAD = new TextEncoder().encode("UltraPokechill Save Vault v1");
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
    keyCache: undefined,
    proofCache: undefined,
    snapshots: [],
    view: "home"
  };

  UltraMods.define({
    id: MOD_ID,
    name: "存档保险库",
    description: "每五分钟自动加密备份您的 UltraPokechill 存档至云端。",
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
      console.warn("[Save Vault] announcement storage is unavailable", error);
    }
    if (window.__ultraProjectAnnouncementScheduled) return;
    window.__ultraProjectAnnouncementScheduled = true;

    const show = () => window.setTimeout(() => {
      if (window.__ultraProjectAnnouncementShown || document.getElementById(ANNOUNCEMENT_ID)) return;
      window.__ultraProjectAnnouncementShown = true;
      try { window.localStorage?.setItem(ANNOUNCEMENT_STORAGE_KEY, "1"); } catch (error) { console.warn("[Save Vault] announcement could not be remembered", error); }
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
    runtime.keyCache = undefined;
    runtime.proofCache = undefined;
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
      #${ROOT_ID} .sv-warning { background:rgba(203,95,72,.13); border-left-color:#c75d51; }
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
      : runtime.view === "dashboard" ? renderDashboard()
      : renderHome();
    root.innerHTML = `
      <section class="sv-card" role="dialog" aria-modal="true" aria-label="Save Vault">
        <header class="sv-head">
          <div class="sv-title"><img src="img/items/parcel.png" alt=""><div><h2>存档保险库</h2><span class="sv-subtitle">自动加密存档保护</span></div></div>
          <button class="sv-close" type="button" data-action="close" aria-label="Close">×</button>
        </header>
        <div class="sv-body">${body}</div>
      </section>`;
    bindVaultEvents(root);
  }

  function renderHome() {
    return `<div class="sv-stack">
      <div class="sv-panel"><h3>保护此存档</h3><p>存档保险库会为您保留最近三次正常存档的加密副本。只要此页面保持打开，系统就会每五分钟自动备份一次。</p><div class="sv-note">您的 PIN码 和原始存档内容绝对不会上传到服务器。恢复备份时，必须同时提供恢复代码和5位数 PIN 码。</div></div>
      <div class="sv-actions"><button class="sv-primary" type="button" data-action="create">创建存档保险库</button><button class="sv-outline" type="button" data-action="recover">恢复已有存档</button></div>
      <div class="sv-panel"><h3>重要提醒</h3><p>请务必将恢复代码保存在此浏览器之外的安全位置。一旦浏览器数据被清除，您需要同时提供恢复代码和 PIN 码才能找回您的三份存档备份。</p></div>
    </div>`;
  }

  function renderCreate() {
    return `<form class="sv-stack" data-form="create">
      <div class="sv-panel"><h3>创建您的存档保险库</h3><p>请设置一个5位数的 PIN 码。此 PIN 码仅用于在本地加密和解密您的备份存档，存档保险库不会将其上传到服务器。</p>
        <label>5位数 PIN 码<input name="pin" inputmode="numeric" autocomplete="new-password" pattern="\\d{5}" maxlength="5" required></label>
        <label>确认 PIN 码<input name="confirmPin" inputmode="numeric" autocomplete="new-password" pattern="\\d{5}" maxlength="5" required></label>
      </div>
      <div class="sv-actions"><button class="sv-primary" type="submit">创建保险库并首次备份</button><button class="sv-outline" type="button" data-action="home">返回</button></div>
    </form>`;
  }

  function renderRecoveryCode() {
    const credentials = getCredentials();
    const code = credentials?.code || "";
    return `<div class="sv-stack">
      <div class="sv-panel"><h3>Write down your recovery code</h3><p>This is the only time Save Vault shows a newly created code in full. Save it somewhere outside this browser.</p><div class="sv-code">${code}</div><div class="sv-actions"><button type="button" data-action="copy-code">Copy code</button></div></div>
      <label class="sv-checkbox"><input type="checkbox" data-role="code-confirm"> <span>I saved this recovery code outside this browser.</span></label>
      <div class="sv-actions"><button class="sv-primary" type="button" data-action="finish-code" disabled>Open Save Vault</button></div>
    </div>`;
  }

  function renderRecovery() {
    return `<form class="sv-stack" data-form="recovery">
      <div class="sv-panel"><h3>Recover existing backups</h3><p>Enter the recovery code and the five-digit PIN used when this vault was created. The code stays in this browser only after the server confirms it.</p>
        <label>Recovery code<input name="code" autocomplete="off" autocapitalize="characters" spellcheck="false" required placeholder="SV1-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX"></label>
        <label>Five-digit PIN<input name="pin" inputmode="numeric" autocomplete="current-password" pattern="\\d{5}" maxlength="5" required></label>
      </div>
      <div class="sv-actions"><button class="sv-primary" type="submit">Find my backups</button><button class="sv-outline" type="button" data-action="home">Back</button></div>
    </form>`;
  }

  function renderDashboard() {
    const credentials = getCredentials();
    const last = Number(credentials?.lastBackupAt || 0);
    const snapshots = runtime.snapshots.slice().sort((a, b) => b.createdAt - a.createdAt);
    const list = snapshots.length ? snapshots.map(snapshot => `<div class="sv-snapshot"><div><strong>${formatDate(snapshot.createdAt)}</strong><span>${formatBytes(snapshot.size)} encrypted · Slot ${snapshot.slot + 1}</span></div><button type="button" data-action="restore" data-slot="${snapshot.slot}">Restore this save</button></div>`).join("") : '<div class="sv-empty">No cloud backup has been found yet. Use “Back up now” to create one.</div>';
    return `<div class="sv-stack">
      <div class="sv-panel"><h3>Automatic protection is on</h3><p>Last local backup: <strong>${last ? formatDate(last) : "not backed up yet"}</strong>. The next automatic check runs every five minutes while the page stays open.</p><div class="sv-status">Only the newest three encrypted snapshots are kept. Unchanged saves are not uploaded again.</div><div class="sv-actions"><button class="sv-primary" type="button" data-action="backup">Back up now</button><button type="button" data-action="refresh">Refresh history</button></div></div>
      <div class="sv-panel"><h3>Recovery history</h3><div class="sv-list">${list}</div></div>
      <div class="sv-panel"><h3>Device access</h3><p>Your recovery code is saved only in this browser to make automatic backups possible.</p><div class="sv-actions"><button type="button" data-action="show-local-code">Show recovery code</button><button class="sv-danger" type="button" data-action="disconnect">Remove this device access</button></div></div>
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
      showToast("Recovery code copied.");
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
  }

  async function createVault(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const pin = String(form.get("pin") || "").trim();
    const confirmPin = String(form.get("confirmPin") || "").trim();
    if (!/^\d{5}$/.test(pin)) return showToast("Choose exactly five digits for the PIN.", true);
    if (pin !== confirmPin) return showToast("The PIN confirmation does not match.", true);
    const credentials = { version: 1, code: generateRecoveryCode(), pin, lastHash: "", lastBackupAt: 0 };
    saveCredentials(credentials);
    runtime.keyCache = undefined;
    runtime.proofCache = undefined;
    try {
      showToast("Setting up encrypted vault…", false, true);
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
      showToast(`Vault was created, but the first backup needs retrying: ${readError(error)}`, true);
    }
  }

  async function recoverVault(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const code = normalizeRecoveryCode(form.get("code"));
    const pin = String(form.get("pin") || "").trim();
    if (!isRecoveryCode(code)) return showToast("That recovery code is not valid.", true);
    if (!/^\d{5}$/.test(pin)) return showToast("Enter the five-digit PIN.", true);
    const candidate = { version: 1, code, pin, lastHash: "", lastBackupAt: 0 };
    try {
      const snapshots = await fetchSnapshots(candidate);
      // The recovery code identifies the encrypted vault, while the PIN is
      // deliberately unknown to the server. Verify it locally by decrypting a
      // real snapshot before this browser receives access to the dashboard.
      if (!snapshots.length) throw new Error("No backup exists for this recovery code, so its PIN cannot be verified yet.");
      showToast("Verifying recovery code and PIN…", false, true);
      await verifyRecoveryCandidate(candidate, snapshots[0]);
      await claimVault(candidate);
      saveCredentials(candidate);
      runtime.keyCache = undefined;
      runtime.proofCache = undefined;
      runtime.snapshots = snapshots;
      runtime.view = "dashboard";
      renderVault();
      showToast("Backups found. Choose one to restore.");
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
    const response = await vaultFetch("/v1/snapshots", { method: "GET" }, credentials);
    const data = await readJson(response);
    if (!response.ok) throw new Error(serverMessage(data, "Could not load backup history."));
    return Array.isArray(data.snapshots) ? data.snapshots : [];
  }

  async function verifyRecoveryCandidate(credentials, snapshot) {
    const slot = Number(snapshot?.slot);
    if (!Number.isInteger(slot) || slot < 0 || slot > 2) throw new Error("The backup list is invalid.");
    const response = await vaultFetch(`/v1/snapshots/${slot}`, { method: "GET" }, credentials);
    if (!response.ok) throw new Error(serverMessage(await readJson(response), "Could not verify this backup."));
    const raw = await decryptSnapshot(new Uint8Array(await response.arrayBuffer()), credentials);
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || !parsed.saved || !parsed.team) {
      throw new Error("This recovery code does not contain a valid UltraPokechill backup.");
    }
  }

  async function backupCurrentSave(showResult) {
    if (runtime.backupInFlight) return;
    const credentials = getCredentials();
    if (!credentials) return;
    runtime.backupInFlight = true;
    try {
      showToast(showResult ? "Encrypting your save…" : "Save Vault: saving encrypted backup…", false, true);
      await claimVault(credentials);
      runtime.api?.save?.();
      const raw = localStorage.getItem("gameData");
      if (!raw) throw new Error("The game does not have a save to protect yet.");
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object" || !parsed.saved || !parsed.team) throw new Error("The current game save is not valid.");
      const plain = textEncoder.encode(raw);
      const hash = await sha256Hex(plain);
      if (hash === credentials.lastHash) {
        showToast("Save Vault: this save is already protected.");
        return;
      }
      if (plain.byteLength > MAX_SNAPSHOT_BYTES) throw new Error("This save is too large for Save Vault.");
      const envelope = await encryptSnapshot(plain, credentials);
      if (envelope.byteLength > MAX_SNAPSHOT_BYTES) throw new Error("The encrypted backup is too large for Save Vault.");
      const response = await vaultFetch("/v1/snapshots", {
        method: "POST",
        headers: { "Content-Type": "application/octet-stream" },
        body: envelope
      }, credentials);
      const data = await readJson(response);
      if (!response.ok) {
        if (response.status === 429) {
          showToast("Save Vault: backup will retry shortly.");
          return;
        }
        throw new Error(serverMessage(data, "Could not save the encrypted backup."));
      }
      credentials.lastHash = hash;
      credentials.lastBackupAt = Number(data.createdAt || Date.now());
      saveCredentials(credentials);
      await refreshSnapshots(showResult);
      showToast(showResult ? "Encrypted backup saved successfully." : "Save Vault: backup protected.");
    } catch (error) {
      // Callers of manual operations still receive the error, but background
      // backups must replace their spinner with a useful notification as well.
      if (!showResult) showToast(`Save Vault: ${readError(error)}`, true);
      throw error;
    } finally {
      runtime.backupInFlight = false;
    }
  }

  async function restoreSnapshot(slot) {
    if (!Number.isInteger(slot) || slot < 0 || slot > 2) throw new Error("Invalid backup slot.");
    const credentials = getCredentials();
    if (!credentials) throw new Error("This browser no longer has vault access.");
    const snapshot = runtime.snapshots.find(item => Number(item.slot) === slot);
    const description = snapshot ? formatDate(snapshot.createdAt) : "this backup";
    if (!window.confirm(`Restore ${description}? Your current browser save will be replaced.`)) return;
    showToast("Downloading and verifying backup…");
    const response = await vaultFetch(`/v1/snapshots/${slot}`, { method: "GET" }, credentials);
    if (!response.ok) throw new Error(serverMessage(await readJson(response), "Could not download this backup."));
    const encrypted = new Uint8Array(await response.arrayBuffer());
    const raw = await decryptSnapshot(encrypted, credentials);
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || !parsed.saved || !parsed.team) throw new Error("This backup is not a valid UltraPokechill save.");
    localStorage.setItem("gameData", raw);
    credentials.lastHash = await sha256Hex(textEncoder.encode(raw));
    credentials.lastBackupAt = Date.now();
    saveCredentials(credentials);
    showToast("Save restored. Reloading the game…");
    window.setTimeout(() => window.location.reload(), 650);
  }

  function disconnectDevice() {
    if (!window.confirm("Remove the recovery code and PIN from this browser? Your cloud backups will remain safe, but automatic backup stops until you recover this vault again.")) return;
    localStorage.removeItem(CREDENTIALS_KEY);
    runtime.keyCache = undefined;
    runtime.proofCache = undefined;
    runtime.snapshots = [];
    runtime.view = "home";
    renderVault();
    showToast("This browser no longer has Save Vault access.");
  }

  async function vaultFetch(path, options, credentials) {
    const headers = new Headers(options.headers || {});
    headers.set("X-SaveVault-Code", credentials.code);
    headers.set("X-SaveVault-Pin-Proof", await getPinProof(credentials));
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 30_000);
    try {
      return await fetch(`${SERVER_URL}${path}`, { ...options, headers, signal: controller.signal, cache: "no-store" });
    } catch (error) {
      if (error?.name === "AbortError") throw new Error("Save Vault did not respond in time. Try again.");
      throw new Error("Could not contact Save Vault. Check your connection and try again.");
    } finally {
      window.clearTimeout(timer);
    }
  }

  async function claimVault(credentials) {
    const response = await vaultFetch("/v1/claim", { method: "POST" }, credentials);
    const data = await readJson(response);
    if (!response.ok) throw new Error(serverMessage(data, "Could not verify the vault PIN."));
  }

  async function encryptSnapshot(plain, credentials) {
    const compressed = await compress(plain);
    const key = await getEncryptionKey(credentials);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv, additionalData: AAD }, key, compressed.bytes));
    const header = new Uint8Array(8 + iv.byteLength);
    header.set([0x53, 0x56, 0x4c, 0x54, 1, compressed.gzip ? 1 : 0, iv.byteLength, 0]);
    header.set(iv, 8);
    const output = new Uint8Array(header.byteLength + cipher.byteLength);
    output.set(header);
    output.set(cipher, header.byteLength);
    return output;
  }

  async function decryptSnapshot(encrypted, credentials) {
    if (encrypted.byteLength < 36 || encrypted[0] !== 0x53 || encrypted[1] !== 0x56 || encrypted[2] !== 0x4c || encrypted[3] !== 0x54 || encrypted[4] !== 1) {
      throw new Error("This backup has an unknown format.");
    }
    const gzip = encrypted[5] === 1;
    const ivLength = encrypted[6];
    if (ivLength !== 12 || encrypted.byteLength <= 8 + ivLength) throw new Error("This backup is damaged.");
    const iv = encrypted.slice(8, 8 + ivLength);
    const cipher = encrypted.slice(8 + ivLength);
    let plain;
    try {
      const key = await getEncryptionKey(credentials);
      plain = new Uint8Array(await crypto.subtle.decrypt({ name: "AES-GCM", iv, additionalData: AAD }, key, cipher));
    } catch (_) {
      throw new Error("The recovery code or PIN is incorrect, or this backup was altered.");
    }
    const restored = gzip ? await decompress(plain) : plain;
    return textDecoder.decode(restored);
  }

  async function getEncryptionKey(credentials) {
    const cacheId = `${credentials.code}:${credentials.pin}`;
    if (runtime.keyCache?.id === cacheId) return runtime.keyCache.key;
    const material = await crypto.subtle.importKey("raw", textEncoder.encode(credentials.pin), "PBKDF2", false, ["deriveKey"]);
    const salt = textEncoder.encode(`UltraPokechill Save Vault v1\n${credentials.code}`);
    const key = await crypto.subtle.deriveKey({ name: "PBKDF2", salt, iterations: 250000, hash: "SHA-256" }, material, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
    runtime.keyCache = { id: cacheId, key };
    return key;
  }

  async function getPinProof(credentials) {
    const cacheId = `${credentials.code}:${credentials.pin}`;
    if (runtime.proofCache?.id === cacheId) return runtime.proofCache.value;
    const material = await crypto.subtle.importKey("raw", textEncoder.encode(credentials.pin), "PBKDF2", false, ["deriveBits"]);
    const salt = textEncoder.encode(`UltraPokechill Save Vault v1\n${credentials.code}`);
    const derived = new Uint8Array(await crypto.subtle.deriveBits({ name: "PBKDF2", salt, iterations: 250000, hash: "SHA-256" }, material, 256));
    const source = new Uint8Array(AAD.byteLength + derived.byteLength);
    source.set(AAD);
    source.set(derived, AAD.byteLength);
    const proof = new Uint8Array(await crypto.subtle.digest("SHA-256", source));
    const value = bytesToBase64Url(proof);
    runtime.proofCache = { id: cacheId, value };
    return value;
  }

  async function compress(bytes) {
    if (typeof CompressionStream !== "function") return { bytes, gzip: false };
    try {
      const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream("gzip"));
      return { bytes: new Uint8Array(await new Response(stream).arrayBuffer()), gzip: true };
    } catch (_) {
      return { bytes, gzip: false };
    }
  }

  async function decompress(bytes) {
    if (typeof DecompressionStream !== "function") throw new Error("This browser cannot open compressed Save Vault backups.");
    try {
      const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"));
      return new Uint8Array(await new Response(stream).arrayBuffer());
    } catch (_) {
      throw new Error("The compressed backup is damaged.");
    }
  }

  function getCredentials() {
    try {
      const credentials = JSON.parse(localStorage.getItem(CREDENTIALS_KEY) || "null");
      if (!credentials || !isRecoveryCode(credentials.code) || !/^\d{5}$/.test(String(credentials.pin || ""))) return null;
      return { version: 1, code: normalizeRecoveryCode(credentials.code), pin: String(credentials.pin), lastHash: String(credentials.lastHash || ""), lastBackupAt: Number(credentials.lastBackupAt || 0) };
    } catch (_) {
      return null;
    }
  }

  function saveCredentials(credentials) {
    localStorage.setItem(CREDENTIALS_KEY, JSON.stringify({ version: 1, code: credentials.code, pin: credentials.pin, lastHash: credentials.lastHash || "", lastBackupAt: Number(credentials.lastBackupAt || 0) }));
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

  async function sha256Hex(bytes) {
    const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
    return Array.from(digest, byte => byte.toString(16).padStart(2, "0")).join("");
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
      invalid_recovery_code: "The recovery code is not valid.",
      invalid_pin: "The recovery code or five-digit PIN is incorrect.",
      invalid_pin_proof: "The five-digit PIN could not be verified.",
      snapshot_not_found: "That backup no longer exists.",
      snapshot_too_large: "This save is too large for Save Vault.",
      save_too_soon: "Please wait a moment before another backup.",
      origin_not_allowed: "This game address is not permitted to use Save Vault."
    };
    return messages[data?.error] || fallback;
  }

  function readError(error) {
    return String(error?.message || error || "Something went wrong.");
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
    try { return new Date(Number(value)).toLocaleString(); } catch (_) { return "Unknown time"; }
  }

  function formatBytes(value) {
    const bytes = Math.max(0, Number(value) || 0);
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }
})();
