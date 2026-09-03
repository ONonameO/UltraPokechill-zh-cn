# UltraPokechill 汉化版

> 一款宝可梦题材的放置挂机网页游戏，基于「UltraPokechill」汉化，并新增了一些实用 Mod

## 项目简介

| 版本 | 说明 | 
|------|------| 
| [Pokechill](https://github.com/play-pokechill/play-pokechill.github.io) | 一款宝可梦题材的放置挂机游戏 | 
| [UltraPokechill](https://github.com/play-ultrapokechill/play-ultrapokechill.github.io) | Pokechill 的改版，在其基础上增加 Mod 加载器与相关 Mod | 
| [本项目] | UltraPokechill 的汉化版本，新增 / 修改部分 Mod | 

---

## 游戏介绍

UltraPokechill 的核心循环是「探索 → 收集 → 养成 → 挑战」：

- **探索**：在旅行区域（旷野地带、迷宫、事件）中遭遇野生宝可梦并进行战斗，收集宝可梦，获取资源。
- **收集**：捕捉宝可梦，集齐图鉴（Pokedex），追求闪光（Shiny）、星象（Star Sign）、缎带（Ribbon）等稀有属性。
- **养成**：通过训练、遗传、特性训练、招式学习等系统提升个体值（IV）、特性与招式配置，打造强力宝可梦。
- **挑战**：组建最多 6 只宝可梦的队伍，挑战训练家、对战开拓区、超级次元 Boss等高难度内容。

---

## 内置 Mod

以下 Mod 已在 `mods/index.json` 中登记，进入游戏后可在 Mod 管理界面 启用 / 停用

| Mod | 名称 | 版本 | 功能简介 | 作者 | 类别 |
| --- | --- | --- | --- | --- | --- |
| battleNumbers | 战斗统计 | 1.3 | 在战斗中显示具体血量和伤害，并在战斗总结中显示击败的单位 | UltraPokechill | 战斗 UI |
| saveVault | 存档保险库 | 1.0.5 | 每五分钟自动加密备份存档，可自定义备份服务器地址 | UltraPokechill | 实用工具 |
| mythos | 神话 | 1.8 | 新增传说级剧情（天气三神：固拉多/盖欧卡/烈空坐） | UltraPokechill | 任务 |
| allStarters | 全世代初始宝可梦 | 1.4 | 开局可选择所有世代的初始宝可梦 | UltraPokechill | 初始宝可梦 |
| speedBattles | 战斗加速 | 1.3 | 快速执行普通战斗帧以提升战斗速度，保留常规战斗规则 | UltraPokechill | 战斗 |
| movePresets | 招式预设 | 1.7 | 保存并快速套用宝可梦的招式配置方案 | UltraPokechill | 宝可梦 UI |
| pokechillHelper | Pokechill 助手 | 3.8.1 | 集成战斗加速、时间跳过与自动重开 | 黄黄 | 实用工具 |
| abilityTrainer | 特性训练助手 | 1.0 | 特性训练时自动重复，直到刷出目标特性。 | Reso | 实用工具 |
| gmaxDimension | 超极巨空间 | 2.2.4 | 菜单新增「超极巨空间」，每 12 小时刷新超极巨 Boss，击败得碎片可抽奖。 | 人民当家做主 & 我不是西药 | 挑战 |
| customDummy | 自定义木桩 | 2.2.1 | 对战界面新增可配置的测试木桩 | 人民当家做主 & 我不是西药 | 实用工具 |
| coinExchange | 银币换金币 | 2.1.0 | 商店新增「银色王冠」兑换「金色王冠」 | 人民当家做主 | 商店 |

---

## 创意工坊（社区 Mod）

`mods/workshop.json` 是面向 GitHub Pages 的创意工坊索引：社区 Mod 通过提交 Pull Request 纳入，玩家可在游戏内的创意工坊界面下载启用。

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

---

## 如何运行

#### 方式一：本地服务器（推荐，支持存档保险库）

安装 [Node.js](https://nodejs.org/)，然后双击运行：`Start.bat`

或

直接执行：

```bash
node server.js
# 可选自定义端口： PORT=8080 node server.js
```

启动后访问 <http://127.0.0.1:8000/> 即可游玩。`server.js` 同时托管游戏静态文件与 `/saveVault/*` 备份接口，供「存档保险库」Mod 使用。

#### 方式二：GitHub Pages 部署

将本仓库推送到 GitHub 并开启 Pages 即可在线游玩（创意工坊 Mod 通过 `workshop.json` 的 Pull Request 流程更新）。

> 　
> **⚠️ 「存档保险库」Mod 默认备份服务器地址会失效**
> - GitHub Pages 是纯静态文件托管，不会执行任何 Node.js 服务端代码
> - 需要把 `server.js` 单独部署到一个能运行 Node.js 的服务器上，然后在游戏内打开「存档保险库」面板 →「服务器设置」，填入该服务地址并点击「测试连接并保存」，才能使「存档保险库」Mod 成功进行备份
> 　

---

## 目录结构

```
.
├── index.html            # 游戏主页面
├── styles.css            # 样式表
├── server.js             # 本地静态服务器 + 「存档保险库」Mod 备份接口
├── Start.bat             # Windows 一键启动脚本
├── scripts/              # 游戏核心脚本（探索/战斗/图鉴/商店/队伍/遗传/Mod 加载器等）
├── mods/                 # 内置 Mod 与创意工坊索引
│   ├── index.json        # 内置 Mod 登记清单
│   ├── workshop.json      # 创意工坊 Mod 索引
│   ├── <name>.mod        # 打包后的 Mod（zip）
│   └── <name>/           # 以文件夹形式提供的内置 Mod（含 mod.js / mod.json）
├── zh-cn/                # 中文翻译与中文搜索脚本
├── img/                  # 精灵图、道具图、UI 图标等素材
├── font/                 # 字体文件
└── saveVault/            # 「存档保险库」Mod 的备份存储目录
```

---

## 许可证与致谢

- 游戏本体基于 [Pokechill](https://github.com/play-pokechill/play-pokechill.github.io) 与 [UltraPokechill](https://github.com/play-ultrapokechill/play-ultrapokechill.github.io) 开发，原作者署名及项目地址详见上方。
- 内置 Mod 与创意工坊 Mod 由各自作者维护，版权归原作者所有。
- 若进行二次分发或修改，请保留原作者署名及项目地址。

**汉化脚本贡献者**  
GPT-DiamondMoo、CCC、黄黄、Reso

**本汉化版内置 Mod 维护者**  
由多位贡献者共同维护（详见「内置 Mod」与「创意工坊」部分）
