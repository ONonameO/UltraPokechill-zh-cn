"use strict";

// UltraPokechill 存档保险库 —— 本地备份服务器
// 同时托管游戏静态文件与 /saveVault/* 备份接口，使存档保险库模组（mod.js）的
// SERVER_URL = window.location.origin 能命中一个真正实现了备份协议的地址。
// 纯 Node 内置模块实现，无任何外部依赖。
//   启动：node server.js   （或PORT=xxxx node server.js）
//   默认：http://0.0.0.0:18000

const http = require("http");
const fs = require("fs");
const fsp = require("fs/promises");
const path = require("path");
const crypto = require("crypto");

const ROOT = __dirname; // 项目根目录（server.js 本身位于根目录）
const DATA_DIR = path.join(__dirname, "saveVault"); // 加密快照本地存储目录（根目录下的 saveVault 文件夹）
const PORT = Number(process.env.PORT) || 18000;
const HOST = "0.0.0.0";
const MAX_BODY = 16 * 1024 * 1024; // 16MB 安全上限（模组侧已限制 8MB）
const CODE_RE = /^SV1-(?:[A-Z2-7]{4}-){7}[A-Z2-7]{4}$/; // 与 mod.js 中 isRecoveryCode 保持一致

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".ttf": "font/ttf",
  ".otf": "font/otf",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".rar": "application/octet-stream",
  ".txt": "text/plain; charset=utf-8",
  ".map": "application/json"
};

fs.mkdirSync(DATA_DIR, { recursive: true });

function vaultDir(code) {
  const key = crypto.createHash("sha256").update(String(code)).digest("hex");
  return path.join(DATA_DIR, key);
}
function metaPath(code) {
  return path.join(vaultDir(code), "meta.json");
}
async function readMeta(code) {
  try {
    return JSON.parse(await fsp.readFile(metaPath(code), "utf8"));
  } catch (_) {
    return { slots: {} };
  }
}
async function writeMeta(code, meta) {
  await fsp.writeFile(metaPath(code), JSON.stringify(meta), "utf8");
}

function sendJson(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    "Access-Control-Allow-Origin": "*"
  });
  res.end(body);
}

function corsPreflight(res) {
  res.writeHead(204, {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-SaveVault-Code, X-SaveVault-Pin-Proof"
  });
  res.end();
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", c => {
      size += c.length;
      if (size > MAX_BODY) {
        reject(new Error("too_large"));
        req.destroy();
      } else {
        chunks.push(c);
      }
    });
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

async function handleApi(req, res, url) {
  if (req.method === "OPTIONS") return corsPreflight(res);

  const code = req.headers["x-savevault-code"];
  if (!code || !CODE_RE.test(String(code))) {
    return sendJson(res, 400, { error: "invalid_recovery_code" });
  }

  const parts = url.pathname.split("/").filter(Boolean); // ["saveVault","snapshots", ":slot?"]

  // POST /saveVault/claim —— 校验/登记保险库
  if (parts.length === 2 && parts[1] === "claim") {
    if (req.method !== "POST") return sendJson(res, 405, { error: "method_not_allowed" });
    fs.mkdirSync(vaultDir(code), { recursive: true });
    return sendJson(res, 200, { ok: true });
  }

  // /saveVault/snapshots
  if (parts.length === 2 && parts[1] === "snapshots") {
    if (req.method === "GET") {
      const meta = await readMeta(code);
      const snapshots = Object.entries(meta.slots || {}).map(([slot, info]) => ({
        slot: Number(slot),
        createdAt: info.createdAt,
        size: info.size
      }));
      return sendJson(res, 200, { snapshots });
    }
    if (req.method === "POST") {
      let body;
      try {
        body = await readBody(req);
      } catch (_) {
        return sendJson(res, 413, { error: "snapshot_too_large" });
      }
      if (body.length > MAX_BODY) return sendJson(res, 413, { error: "snapshot_too_large" });

      fs.mkdirSync(vaultDir(code), { recursive: true });
      const meta = await readMeta(code);
      const slots = meta.slots || {};
      const used = Object.keys(slots).map(Number);
      let slot;
      if (used.length < 3) {
        slot = [0, 1, 2].find(i => !used.includes(i));
      } else {
        // 仅保留最新的三份：覆盖创建时间最早的那一份
        slot = used.reduce((a, b) => (slots[a].createdAt < slots[b].createdAt ? a : b));
      }
      const createdAt = Date.now();
      await fsp.writeFile(path.join(vaultDir(code), `slot${slot}.bin`), body);
      slots[slot] = { createdAt, size: body.length };
      meta.slots = slots;
      await writeMeta(code, meta);
      return sendJson(res, 200, { createdAt });
    }
    return sendJson(res, 405, { error: "method_not_allowed" });
  }

  // GET /saveVault/snapshots/:slot —— 返回原始加密字节
  if (parts.length === 3 && parts[1] === "snapshots") {
    const slot = Number(parts[2]);
    if (![0, 1, 2].includes(slot)) return sendJson(res, 404, { error: "snapshot_not_found" });
    const meta = await readMeta(code);
    if (!meta.slots || !meta.slots[slot]) return sendJson(res, 404, { error: "snapshot_not_found" });
    try {
      const data = await fsp.readFile(path.join(vaultDir(code), `slot${slot}.bin`));
      res.writeHead(200, {
        "Content-Type": "application/octet-stream",
        "Content-Length": data.length,
        "Access-Control-Allow-Origin": "*"
      });
      return res.end(data);
    } catch (_) {
      return sendJson(res, 404, { error: "snapshot_not_found" });
    }
  }

  return sendJson(res, 404, { error: "not_found" });
}

function serveStatic(req, res, url) {
  let pathname = decodeURIComponent(url.pathname);
  if (pathname.endsWith("/")) pathname += "index.html";
  const filePath = path.normalize(path.join(ROOT, pathname));
  // 防止路径穿越
  if (filePath !== ROOT && !filePath.startsWith(ROOT + path.sep)) {
    res.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
    return res.end("403 Forbidden");
  }
  fs.stat(filePath, (err, stat) => {
    if (err || !stat.isFile()) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      return res.end("404 Not Found");
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream" });
    fs.createReadStream(filePath).pipe(res);
  });
}

const server = http.createServer((req, res) => {
  let url;
  try {
    url = new URL(req.url, `http://${HOST}:${PORT}`);
  } catch (_) {
    res.writeHead(400);
    return res.end("Bad Request");
  }
  if (url.pathname.startsWith("/saveVault/")) {
    handleApi(req, res, url).catch(err => {
      console.error("[saveVault-server] 处理请求出错:", err);
      if (!res.headersSent) sendJson(res, 500, { error: "internal" });
      else try { res.end(); } catch (_) {}
    });
    return;
  }
  serveStatic(req, res, url);
});

server.listen(PORT, HOST, () => {
  console.log(` [信息] 服务器已启动: http://${HOST}:${PORT}/`);
  console.log(``);
  console.log(`==========================================================================`);
  console.log(``);
  console.log(` [存档保险库] 存档备份接口: /saveVault/claim 、/saveVault/snapshots`);
  console.log(` [存档保险库] 存档存储目录: ${DATA_DIR}`);
  console.log(``);
  console.log(`==========================================================================`);
  console.log(``);
  console.log(` [提示] 按任意键关闭服务器并退出...`);
  console.log(``);
  console.log(`==========================================================================`);
  console.log(``);
});
