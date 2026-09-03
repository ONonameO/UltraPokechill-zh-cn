# UltraPokechill

> 一个内置 Mod 加载器的宝可梦放置（idle）类网页游戏改版。

- 原版游戏项目地址：<https://github.com/play-pokechill/play-pokechill.github.io>
- 本 Mod 改版项目地址：<https://github.com/play-ultrapokechill/play-ultrapokechill.github.io>

---

## 项目简介

UltraPokechill 是原版 [Pokechill](https://github.com/play-pokechill/play-pokechill.github.io) 的改版，在原版基础上加入了 **Mod 加载器（mod loader）**，并随仓库内置了一批实用 Mod（加速、自定义木桩、超极巨空间等），同时附带中文翻译层与本地存档备份服务器。

本仓库是一个纯前端 + 轻量 Node 服务器的网页游戏，可直接通过 GitHub Pages 部署，也可在本地用 Node.js 启动。

**作者与署名（原版）：**

- 原版制作：<https://guns.lol/rodk>
- Pokechill 作者：<https://github.com/play-pokechill>
- 本改版在内置 Mod 中由多位贡献者共同维护（见下文「内置 Mod」与「创意工坊」）。

---

## 游戏介绍

### 核心玩法

UltraPokechill 的核心循环是「探索 → 收集 → 养成 → 组队 → 挑战」：

1. **探索与对战**：在各类区域（普通区域、事件区域、地牢、次元等）中遭遇野生宝可梦并进行战斗，推进进度、获取资源。
2. **收集与图鉴**：捕捉宝可梦、集齐图鉴（Pokédex），追求闪光（Shiny）、宝可病毒（Pokérus）、星之印记、缎带等稀有属性。
3. **养成与训练**：通过训练、遗传、特性训练、招式学习（TM）等系统提升个体值（IV）、特性与招式配置，打造强力宝可梦。
4. **组队与对战**：组建最多 6 只宝可梦的队伍，挑战竞技场、对战开拓区、超级次元 Boss、传说事件等高难度内容。
5. **赛季与活动**：游戏包含分段（Division/赛区）、季节、天气与限时事件区域等动态内容，持续提供目标。

### 主要特色

- **图鉴与筛选**：支持按属性、等级、进化、特性、闪光、印记、缎带、标签等多维度筛选与排序，方便查漏补缺。
- **养成系统**：个体值（IV）、特性（Ability）、遗传（Genetics，含命运之绳/能量根等）、招式（TM）一应俱全，深度培养。
- **丰富挑战内容**：竞技场（Arena）、对战开拓区（Frontier）、地牢（Dungeon）、超级次元（Mega Dimension）、事件区域（Event Areas）等多种玩法。
- **社交与福利**：奇迹交换（Wonder Trade）、神秘礼物（Mystery Gift）、自动重战（Auto-Refight，需 Auto-Refight Ticket）等便利功能。
- **Mod 加载器**：内置 Mod 框架，可在游戏内启用/停用内置 Mod，并通过创意工坊扩展社区 Mod。
- **中文本地化**：随仓库提供 `zh-cn/` 中文翻译与中文搜索层，降低上手门槛。
- **本地存档备份**：内置「存档保险库」Mod 与本地备份服务器（`server.js`），可将存档加密备份到本地，防止进度丢失。

---

## 内置 Mod

以下 Mod 已随本仓库打包，并在 `mods/index.json` 中登记。进入游戏后可在 Mod 管理界面启用/停用；其中标注「默认关闭」的 Mod 需手动开启（`defaultEnabled: false`）。

| Mod | 名称 | 版本 | 功能简介 | 作者 | 类别 |
| --- | --- | --- | --- | --- | --- |
| `battleNumbers.mod` | 战斗数值显示 | — | 在战斗中显示伤害/治疗等数值，便于观察输出。 | UltraPokechill | 战斗 |
| `saveVault.mod` | 存档保险库 | — | 将存档加密后备份到本地 `saveVault` 服务器，支持恢复。 | UltraPokechill | 实用工具 |
| `mythos.mod` | 神话 | 1.8 | 新增传说级剧情（天气三神：固拉多/盖欧卡/烈空坐），敌人拥有高个体值。 | UltraPokechill | 任务 |
| `allStarters.mod` | 全御三家 | — | 开局即可获得/选择所有御三家初始宝可梦。 | UltraPokechill | 实用工具 |
| `speedBattles.mod` | 战斗加速 | 1.3 | 快速执行普通战斗帧以提升战斗速度，保留常规战斗规则。 | UltraPokechill | 战斗 |
| `movePresets.mod` | 招式预设 | — | 保存并快速套用宝可梦的招式配置方案。 | UltraPokechill | 宝可梦 |
| `pokechillHelper/mod.js` | Pokechill 助手 | 3.8.1 | 集成全局加速、时间跳过与自动重开，减少等待、轻松护肝。 | 黄黄 | 实用工具 |
| `abilityTrainer/mod.js` | 特性训练助手 | 1.0 | 特性训练时自动重复，直到刷出目标特性。 | Reso | 实用工具 |
| `pokechillGmax/mod.js` | 超极巨空间 | 2.2.4 | 菜单新增「超极巨空间」，每 12 小时刷新超极巨 Boss，击败得碎片可抽奖。 | 人民当家做主 & 我不是西药 | 挑战 |
| `customDummy/mod.js` | 自定义木桩 | 2.2.1 | 对战界面新增可配置属性/种族值星级/等级/招式并可锁血的测试木桩。 | 人民当家做主 & 我不是西药 | 实用工具 |
| `coinExchange/mod.js` | 银币换金币 | 2.1.0 | 商店新增「银币换金币」，用银色王冠批量兑换金色王冠。 | 人民当家做主 & 我不是西药 | 商店 |

---

## 创意工坊（社区 Mod）

`mods/workshop.json` 是面向 GitHub Pages 的创意工坊索引：社区 Mod 通过提交 Pull Request 纳入，玩家可在游戏内的创意工坊界面下载启用。当前索引中已收录的部分社区 Mod：

- **更好的图鉴（betterDex）**：属性筛选支持单属性匹配，新增招式筛选。
- **更好的招式排序（betterMoveSorting）**：已习得招式列表支持关键词筛选、排序与标签。
- **闪光进化（shinyEvolve）**：闪光宝可梦进化后仍保持闪光形态。
- **科斯莫姆进化（cosmoemEvolves）**：商店新增科斯莫古糖果，昼夜分别进化为索尔迦雷欧/露奈雅拉。
- **宝可病毒筛选（Pokerus Filter）**：图鉴中快速查找携带宝可病毒的宝可梦。
- **编辑队伍再战（editTeamFightAgain）**：战斗结算界面可先编辑队伍再重战。
- **再见！鲤鱼王！（noMoreMagikarp）**：修复超级次元奖励错误发放鲤鱼王的问题。
- **糖果批量使用（bulkCandyUse）**：一次性使用多颗神奇糖果。
- **未集齐的闪光家族（incomplete_families）**：闪光筛选中定位尚未集齐闪光形态的家族。
- **更好的遗传（betterGenetics）**：遗传界面快捷使用能量根，并提供 5 秒快速遗传模式。
- **Discord 备份（backupMod）**：每 10 分钟自动备份存档至 Discord（使用前请阅读指南）。
- **闪光家族（shinyFamily）**：家族中任一已解锁宝可梦为闪光时，全家族已解锁成员自动闪光。
- **疲劳伤害消除（fatigueRemover）**：移除战斗疲劳造成的 HP 损失。
- **心之鳞片批量使用（multiHeartScale）**：一次性回忆多个招式。

> 完整列表与最新版本以 `mods/workshop.json` 及游戏内创意工坊为准。

---

## 本地化

`zh-cn/` 目录提供中文支持：

- `zhTranslation.js`：界面文本中文翻译层（作用域受限，仅翻译应翻内容）。
- `zhSearch.js`：中文搜索索引，支持用中文检索宝可梦/招式/道具等。

---

## 如何运行

### 方式一：本地服务器（推荐，支持存档保险库）

需安装 [Node.js](https://nodejs.org/)，然后双击运行：

```
Start.bat
```

或直接执行：

```bash
node server.js
# 可选自定义端口： PORT=8080 node server.js
```

启动后访问 <http://127.0.0.1:8000/> 即可游玩。`server.js` 同时托管游戏静态文件与 `/saveVault/*` 备份接口，供「存档保险库」Mod 使用。

### 方式二：GitHub Pages 部署

将本仓库推送到 GitHub 并开启 Pages 即可在线游玩（创意工坊 Mod 通过 `workshop.json` 的 Pull Request 流程更新）。

> ⚠️ **重要限制：GitHub Pages 不会运行 `server.js`。**
> GitHub Pages 是纯静态文件托管，只负责把 `index.html`、`scripts/`、`img/` 等文件发给浏览器，**不会执行任何 Node.js 服务端代码**，因此 `server.js` 在 Pages 上不会启动。
> - **游戏本体可正常游玩**：游戏是纯前端、在浏览器内运行的，普通进度存档写入浏览器 `localStorage`，在 Pages 上同样有效。
> - **「存档保险库」Mod 将失效**：该 Mod 会向 `window.location.origin + /saveVault/*` 发起加密备份请求，而 Pages 站点没有实现该接口的服务器，备份与恢复会失败。
> - **如需线上也能用存档保险库**：需把 `server.js`（或兼容 `/saveVault/*` 协议的实现）单独部署到一个能运行 Node.js 的服务（如 Render / Railway / 自有服务器），并把 Mod 内的 `SERVER_URL` 改为该服务地址；否则在 Pages 上仅作「可玩、但不备份到保险库」使用即可。

---

## 目录结构

```
.
├── index.html            # 游戏主页面（标题 UltraPokechill）
├── styles.css            # 样式表
├── server.js             # 本地静态服务器 + 存档保险库备份接口
├── Start.bat             # Windows 一键启动脚本
├── scripts/              # 游戏核心脚本（探索/战斗/图鉴/商店/队伍/遗传/Mod 加载器等）
├── mods/                 # 内置 Mod 与创意工坊索引
│   ├── index.json        # 内置 Mod 登记清单
│   ├── workshop.json      # 创意工坊 Mod 索引
│   ├── <name>.mod        # 打包后的 Mod（zip）
│   └── <name>/           # 以文件夹形式提供的内置 Mod（含 mod.js / mod.json）
├── zh-cn/                # 中文翻译与中文搜索层
├── img/                  # 精灵图、道具图、UI 图标等素材
├── font/                 # 字体文件
└── saveVault/            # 本地存档备份存储目录（由 server.js 使用）
```

---

## 许可证与致谢

- 游戏本体基于原版 Pokechill，署名与项目地址见顶部。
- 内置 Mod 与创意工坊 Mod 由各自作者维护，版权归原作者所有。
- 如用于二次分发或改版，请保留原作者署名与项目地址。
