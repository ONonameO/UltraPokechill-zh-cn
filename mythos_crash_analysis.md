# Mythos 模组在汉化后启用导致页面崩溃 — 根因分析

## 结论（一句话）

页面崩溃**不是**删掉 `localization.js` 直接引起的，而是**新接入的 zh-cn 汉化插件**在 `document` 上挂了**两个全局 MutationObserver**，对 **mythos 模组注入的大段 DOM 做昂贵的「同步逐节点翻译」**，在启用/刷新该模组时把主线程长时间阻塞，浏览器判定页面无响应 → 表现为「崩溃」。

---

## 证据链

### 1. zh-cn 插件在启动时挂了全局观察器（新增变量）
`index.html` 启动脚本（约 1733–1737 行）在游戏脚本之前加载：
- `zh-cn/chs.js` → `zh-cn/zhTranslation.js` → `zh-cn/zhSearch.js` → `zh-cn/core.js`

其中：
- `zh-cn/zhTranslation.js` 末尾 `observer.observe(document.documentElement, {childList:true, subtree:true})`，并对 `document.body` 做初始 `walk()`。
- `zh-cn/core.js` 同样挂了一个观察 `document.body`（`characterData`+`childList`+`subtree`）的 MutationObserver。

> 旧版 `scripts/localization.js`（已删除）**没有全局观察器**，它只通过 `data-i18n` 静态属性翻译，而 mythos 的内容是纯 `innerHTML`，本来就不会被它翻译——所以**汉化之前启用 mythos 是瞬时的**。这就是「只有汉化后才崩溃」的关键：zh-cn 是唯一的增量因子。

### 2. 每条文本节点的翻译成本极高
- `zh-cn/zhTranslation.js` 第 16 行起 `RAW_REGEX_RULES` 共有 **623 条正则**（已用 `grep -c` 验证 = 623）。
- 第 1348–1355 行 `applyRegexRules(text)`：对**每个文本节点**依次执行 `r.regex.test(text)`，命中才 `replace`。
- `translateText()`（4509–4514）= `applyRegexRules` + `translateByTrie`，由 `walk()` 在**每一个新增节点**上调用。
- 更糟的是 `zh-cn/core.js` 的 `cnItem()` 还会再跑一遍：其 `canTranslateByEnCn()`（约 133–152 行）对**每个单词**再扫描一遍 `window.EN_CN_REGEX_RULES`（同一份 623 条）。等于**同一个单词被扫约 1246 次**。

### 3. mythos 模组注入的 DOM 又大又频繁重渲染
- `mods/mythos/mod.js` 第 2618 行 `renderMythosMenu()` 通过 `content.innerHTML = ` 注入一整块含大量**剧情/区域/敌人描述**的 DOM。
- 它在多个生命周期钩子里被调用：`onRefresh`(896)、`install`(927)、`afterBattleSummaryRender`(911)，以及约 10 处内部导航/刷新调用（2612、2680、2730、2742、2757、3158、3163、3352、3686 等）。
- 每次 `innerHTML` 变化都会触发上面两个全局观察器，对**全部文本节点**重做一次昂贵的同步翻译。

### 4. mythos 自身的观察器不是元凶（已排除）
`mods/mythos/mod.js` 第 3225–3257 行 `installObservers()` 确实有 MutationObserver，但只监听 `menu-items`(childList) 与 `area-end`(childList+subtree)，回调是：
- `ensureMenuButton()`（2514–2542）：**幂等**——`if (!button)` 才创建，不会重复插入；
- `syncMenuButton()`（2544–2549）：只设置 `style.filter`；
- `hideSagaRejoin()`：只改 `display`，不重渲染。

这些回调不会反过来触发 `renderMythosMenu`，因此**不会形成观察器反馈死循环**。真正的瓶颈是 zh-cn 对「大 DOM 的逐节点重翻译」。

### 5. 翻译函数本身没有死循环（已排除）
- `translateByTrie()`（4469–4507）每次迭代 `i` 必然前进（`i++` 或 `i = lastIndex`，`lastIndex ≥ i+1`），必然终止。
- `walk()` 递归受 DOM 深度限制，不会无限递归。
- `translateByTrie`/`applyRegexRules` 中的正则是 `(.+)` 这类简单贪婪匹配，**不是**嵌套量词，不存在灾难性回溯（ReDoS）风险；主要开销来自**规则数量 × 节点数 × 重复扫描**，而非单条正则。

---

## 为什么是「崩溃」而不是「只是慢」
`renderMythosMenu` 一次注入可能含数十~上百个文本节点、每个节点数十~数百词。按上面估算，单次渲染的主线程同步翻译工作量可达**数十万次正则 `test`**，单次渲染即产生数百毫秒~数秒的「长任务」；启用时 `install()` 又会连续触发多次渲染（确保按钮、菜单、刷新进度、渲染菜单）。叠加后主线程被长时间独占，浏览器弹出「页面无响应」并最终杀掉标签页，用户即感知为「页面崩溃」。

---

## 修复方向（待你确认后再动手）

| 方案 | 思路 | 取舍 |
|------|------|------|
| **A. 降低正则成本** | 把 623 条 `RAW_REGEX_RULES` 合并/预编译（如单条 alternation 大正则或 Aho–Corasick），并移除 `core.js` 里重复的 623 扫描 | 保留全中文，收益最大 |
| **B. 异步/增量翻译** | 用 `requestIdleCallback` + 防抖，只在变更子树做增量翻译，避免一次性同步扫全树 | 保留全中文，体验最佳 |
| **C. 对 mythos 容器豁免** | 给 mythos 容器加 `notranslate`/跳过标记，或在 `innerHTML` 批量写入期间 `disconnect` 观察器、写完一次性翻译再 `observe` | 简单；但 mythos 内容会保持英文（除非手动补翻） |
| **D. 合并重渲染** | 对 `renderMythosMenu` 的多次调用做防抖/合并，减少重渲染次数 | 缓解但不治本 |

**推荐组合：A + B**——既保留中文，又从根源消除主线程阻塞。`C` 可作为快速止血方案。

> 注：当前 `scripts/tooltip.js`、`scripts/script.js`、`scripts/explore.js` 中残留的 `window.UltraLocale?.translateText?.(...)` 等为可选链调用，在 `localization.js` 删除后已自动降级为「不翻译」，由 zh-cn 观察器兜底翻译，**与本次崩溃无关**，可暂不处理。
