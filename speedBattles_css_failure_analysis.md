# zhTranslation.js 导致 speedBattles 模组按钮样式失效 — 根因分析

> 分析对象：`zh-cn/zhTranslation.js` 翻译引擎 + `mods/speedBattles/mod.js` 的动态样式注入
> 现象：启用汉化后，speedBattles 模组的「速度选项按钮」失去样式（无背景、无边框、无圆角、无高亮态），且标签/备注排版错乱。

---

## 一、根因（已用真实数据复现）

**翻译引擎会把注入到 `<head>` 的 `<style>` 元素的文本节点当成普通文本翻译，从而把 CSS 规则本身篡改成非法 CSS，导致选择器与属性全部失效。**

这不是"改了元素的 class"，而是"改了 CSS 规则里的英文标识符"。

### 失效链路（代码级）

1. **注入点** — `mods/speedBattles/mod.js:103-162` 的 `installStyles()` 把 CSS 写进一个 `<style>` 元素并 `document.head.appendChild(style)`（line 161）。该 `<style>` 是 `document.documentElement` 的后代。

   ```js
   const style = document.createElement("style");
   style.id = STYLE_ID;
   style.textContent = `... .speed-battles-option { ... } ...`;  // 这是 <style> 的文本节点
   document.head.appendChild(style);   // 触发 documentElement 的 childList 变更
   ```

2. **观测点** — `zh-cn/zhTranslation.js:4555-4558` 的 `MutationObserver` 监听 `document.documentElement` 的 `childList + subtree`：
   ```js
   observer.observe(document.documentElement, { childList: true, subtree: true });
   ```
   上面的 `appendChild(style)` 被捕获，`walkSync(style)` 被执行。

3. **遍历点** — `zhTranslation.js:4533-4545` 的 `walkSync` **没有**对 `<style>/<script>/<textarea>` 做任何排除，遇到元素就无差别递归其子节点：
   ```js
   function walkSync(node) {
       if (node.nodeType === Node.TEXT_NODE) { /* 翻译文本 */ return; }
       if (node.nodeType !== Node.ELEMENT_NODE) return;
       if (node.shadowRoot) walkSync(node.shadowRoot);
       for (const child of node.childNodes) walkSync(child);   // <style> 的子文本节点也被翻译
   }
   ```
   `<style>` 的子节点正是一个**承载全部 CSS 源码的文本节点**，于是 `translateText(cssText)` 被调用。

4. **破坏点** — `zhTranslation.js:4515-4526` 的 `translateText` 对含拉丁字母的文本依次跑 `applyRegexRules` + `translateByTrie`。CSS 源码里大量出现 `speed`/`white`/`solid`/`items`/`none`/`hp` 等词，被 trie 翻成中文，**CSS 规则被破坏**。

> 补充：修改 `<style>` 文本节点会即时触发浏览器重新解析该样式表，且 `<style>` 内容变更属 `characterData` 而非 `childList` 变更，不会被同一个 observer 再次捕获，因此**破坏是一次性的、持久的**（直到刷新页面）。

---

## 二、实证：原始 CSS vs 被翻译后的 CSS（关键差异行）

| 行 | 原始（正确） | 被篡改后（浏览器实际解析） | 破坏类型 |
|----|-------------|--------------------------|---------|
| L3 | `align-items: center;` | `align-物品: center;` | 属性名 `items`→`物品` 损坏 |
| L4 | `border-top: 1px solid rgba(59,51,35,0.35);` | `border-top: 1px 坚硬 rgba(...)` | 值 `solid`→`坚硬` 损坏 |
| L13 | `.speed-battles-label {` | `.速度-battles-label {` | **选择器** `speed`→`速度` |
| L14 | `color: white;` | `color: 白;` | 值 `white`→`白` 无效 |
| L19 | `.speed-battles-option {` | `.速度-battles-option {` | **选择器** 损坏 |
| L31 | `.speed-battles-option.active {` | `.速度-battles-option.active {` | **选择器** 损坏 |
| L33 | `color: white;` | `color: 白;` | 值无效 |
| L36 | `.speed-battles-note {` | `.速度-battles-note {` | **选择器** 损坏 |
| L42 | `body.speed-battles-fast .explore-hp,` | `body.速度-battles-fast .explore-生命,` | **选择器** `speed`/`hp` 损坏 |
| L43 | `body.speed-battles-fast .explore-hp-wild,` | `body.速度-battles-fast .explore-生命-野生,` | **选择器** 损坏 |
| L45 | `transition: none !important;` | `transition: 无 !important;` | 值 `none`→`无` 无效 |

> 共 13 行被改写，全部使对应 CSS 规则变成非法/不匹配。

---

## 三、受影响的 CSS 规则（speedBattles 内）

| 选择器（原始） | 失效原因 | 视觉后果 |
|----------------|---------|---------|
| `.speed-battles-option`（速度按钮本体） | 选择器 `speed`→`速度` 后不再匹配任何元素 | **按钮失去全部样式**：无背景、无边框、无圆角、无光标指针、无固定最小宽、无内边距 |
| `.speed-battles-option.active`（当前选中态） | 选择器损坏 | 当前速度按钮不显示绿色高亮背景 |
| `.speed-battles-label`（"Battle speed" 标签） | 选择器损坏 | 标签失去白色/字号/右边距样式 |
| `.speed-battles-note`（备注文本） | 选择器损坏 | 备注失去白色/小字号/透明度 |
| `.speed-battles-config`（容器） | 内 `align-items: center`→`align-物品: center` 属性名损坏 | flex 布局失效，按钮排列错乱 |
| `body.speed-battles-fast .explore-hp/-wild` | 选择器 `speed`/`hp` 损坏 + `transition: none`→`无` 值损坏 | 极速战斗时 HP 条过渡关闭规则失效 |

**结论：速度选项按钮「样式丢失」的直接原因是 `.speed-battles-option` 这个选择器本身被翻译成了 `.速度-battles-option`，与 DOM 中真实的 `class="speed-battles-option"` 不再匹配，规则整体失效。**

---

## 四、对四个可能成因的逐项判定

1. **运行时动态修改了 DOM 结构或元素类名，导致原 CSS 选择器无法匹配？**
   → **现象成立，但成因精确为"CSS 规则里的选择器文本被翻译"，而非"元素上的 className 被改"。** 元素 `class` 属性始终是 `speed-battles-option`（未被触碰），是 CSS 侧的选择器字符串被改坏，二者因而对不上。

2. **插入翻译文本改变了元素尺寸/布局，引发样式错乱？**
   → **不成立。** 速度按钮文本为 `1x / 2x / 3x / 5x / 10x / 50x`，不含可被 trie 翻译的英文词（仅数字+x），不会被改写；且问题根源是 CSS 规则整体非法，并非文本变长导致的位移。

3. **覆盖了原有内联样式或 style 属性？**
   → **不成立。** 翻译引擎只改文本节点的 `nodeValue`，从不读写元素的 `style` 属性/内联样式。`syncHpVisuals()` 里 `bar.style.width/background` 等内联设置完全不受影响。

4. **CSS 作用域或加载顺序冲突？**
   → **不成立。** 这不是级联/优先级/加载顺序问题。`styles.css` 由 `<link rel="stylesheet">` 加载（index.html:8），是外部资源而非文本节点，**不受影响**，这也解释了为何只是"部分"CSS 失效；真正的问题是"把 CSS 源码当成了可翻译文本"的内容污染。

---

## 五、波及范围（不只 speedBattles）

翻译引擎对**所有**通过 `<style>` 文本节点注入的样式都会造成同样的篡改。全工程共有 3 处：

- `mods/speedBattles/mod.js:106,161`（本案）
- `mods/mythos/mod.js:1331,2418`（过场/对话/菜单样式，已被静默破坏）
- `scripts/PR/movesetGenerator.js:656,659`（PR 配招器样式，已被静默破坏）

即：凡是用 `document.createElement("style")` + `textContent` + `head.appendChild` 方式注入的 CSS，在汉化环境下都会部分失效。

---

## 六、修复方向（待确认后实施）

核心：让翻译引擎**跳过 `<style>`、`<script>`、`<textarea>` 等不应翻译的元素**。最简单可靠的改法是在 `walkSync` 入口加一道排除（类比其它翻译器对 SCRIPT/STYLE 的处理）：

```js
function walkSync(node) {
    if (node.nodeType === Node.TEXT_NODE) { /* 翻译 */ return; }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const tag = node.tagName;
    if (tag === "STYLE" || tag === "SCRIPT" || tag === "TEXTAREA") return; // 跳过非文本内容的容器
    if (node.shadowRoot) walkSync(node.shadowRoot);
    for (const child of node.childNodes) walkSync(child);
}
```

这样注入的 CSS/JS 文本不再被翻译，选择器与属性名保持原样，按钮样式恢复；同时游戏其余可见文本仍照常汉化。**此改动为治本修复，建议优先采用。**

> 注：因 `<style>` 内容变更属 `characterData`、不会触发当前仅监听 `childList` 的 observer，故即便不修 observer，仅修 `walkSync` 即可挡住启动时 `walkSync(document.body)` 之外的注入场景；但为稳妥仍建议两处（walkSync 递归入口 + observer 回调）都加同一排除判断。
