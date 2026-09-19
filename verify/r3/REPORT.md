# 第三轮独立复核报告（复核者自跑，未采信任何转述）

工作目录 `E:\Git\bloomday`；静态服务 `http://127.0.0.1:4173/`（服务 `dist/`）；CDP 9222；390x844 dsf=1。
所有结论来自本轮自建工具（`verify/r3/`），**未把作者的 `__journey()` 当通过依据**。

## 0. 结论速览

| 项 | 判定 | 依据 |
|---|---|---|
| 标准 1（全程连贯、无黑屏/无空白停顿/无残留） | **不通过** | ①幕间 460~560ms 无任何一幕文字（可复现）；②**主视觉核心内容终态永久不可见**（`#mv-date`/`#mv-age`/`#mv-title` 有效透明度 0） |
| 标准 1 之"无黑屏/无残留"分项 | 通过 | 全屏纯色遮盖峰值 0.88（底色）+ 残留环/带/整屏 fixed 层 = 0/0/0 |
| 标准 2（单一配置源） | 通过 | swap/badimage/calm 三 case 自己驱动构建+探针；文案/日期/图/歌/强度全跟随；4 张坏图全部静默降级 |
| 标准 3（文案·字号·几何·不溢出） | 通过 | 文案逐字一致、无横向溢出、触控目标全 ≥44px、对比度 7.95/11.53 |
| `__siteSummary()` 的「实际强度」 | 通过 | 报的是 `motionStrength()` 内核值（calm / reduced-motion 下都为 0） |
| 判据自证（人为制造双重曝光） | **通过**（能报出） | 见 §3 |

---

## 1. 标准 1 详证

### 1.1 幕间空白（不通过项之一）

自建时间线探针 `verify/r3/timeline.mjs tl2`（每帧读 `seal-inner` / `.mv__*` 的累乘透明度）：

```
 nom     realMs innerOp mv-eyebrow 可见文字
 300      312   0.414   0          seal 全套（9.19 / 称呼 / 点我开始 / 提示）
 360      374   0        0          —
 420      422   0        0          —
 480      483   0        0          —
 540      544   0        0          —      ← 封印斜切带已扫过
 580      589   0        0          —
 620      620   0        0          —
 ...
 860      867   0        0          —
 900      914   0        0.19       act-mv:.mv__eyebrow   ← 主视觉第一个文字
 940      945   0        0.35       ...
1250     1259   —        0.99       （#mv-date/#mv-age/#mv-title 始终缺席）
```

- 封印文字（`seal-inner`）在 **~355ms 归零**；主视觉第一个可读文字在 **~925ms**。
- 即 `[355, 925]` 共 **约 560ms** 视口内没有属于任何一幕的可读文字。
- 空白帧（`visible` 集合为空）实测：374/422/483/544/589/620/666/713/744/790/821/867ms。
- 像素侧交叉验证（`verify/r3/ink.mjs`，与终态底色帧比差）：`base` run 在 680ms 时"墨量"只剩 0.142%，1400ms 起 0.000%——**画面像素确实没有任何内容**。
  三个独立 run（base / fine / final）都复现。

> 归因：作者把关口做成"封印先自收干净（0~0.38 文字淡出）→ 0.34~0.78 整块淡掉 → 0.78 主视觉才进"，但 780ms 起的主视觉还带 `charSlam` 的 stagger，第一个文字到 ~925ms 才亮。串行化把并行的"双曝"换成了"空档"。且封印整块 0.34~0.78 的 0.44s 淡出**视觉上等于没做**——`.seal` 底色 `--c-deep` 与页面底色同色（#05070f），淡它什么都看不见。

### 1.2 主视觉核心内容永久不可见（不通过项之二，本轮作者修改引入的回归）

点击后 **7~9s**（所有进场动画早已跑完）读全祖先链（`verify/r3/probe-chain.js`）：

```
#mv-date  eff=0  inline="opacity: 0;"                        父链 op 全 1
#mv-age   eff=0  inline=""            父 .mv__age inline="opacity: 0;"
#mv-title eff=0  inline="opacity: 0;"
.mv__eyebrow eff=1 inline="opacity: 1; ..."   ← 唯一活着
```

- `verify/r3/finalstate.mjs`（点击 + 等 6s，逐元素累乘透明度 + 视口判定）：
  `act-mv: 可读 1 / 隐藏 11`，视口内可读文字只有 `SEPTEMBER 19`。
- 像素侧（`verify/r3/ink.mjs` + `strokes()` 判据）：
  同区域笔画量 —— base 终态 `mv-grid(y165-570) blob=9573`；把主视觉文字显出来（§3 的负向变体）`blob=28092`。**3 倍差距**，主视觉主体确实没画出来。
- reduced-motion 下反而正常（`injectedStrength=0`，`#mv-date/#mv-age/#mv-title` 全 `opacity:1`）→ 坏的是 `enter()` 的**正常动效分支**。

根因（`src/acts/main-visual.ts`）：
`const TEXT = ['.mv__eyebrow', '#mv-date', '.mv__age', '#mv-title']` → `gsap.set(TEXT, {opacity:0})`。
选择器 `.mv__age` 命中的是**容器**（不是 `#mv-age`），所以第二道保险给的是"父容器内联 opacity:0"。
`charSlam` 只恢复 `.mt-char` 子节点（`clearProps`），`#mv-date` / `#mv-title` 自身的内联 0、`.mv__age` 容器的内联 0 都没人清。
`enter()` 里只有 `skipMotion()` 分支写 `setTextVisible(true)`，正常分支漏了 → **永久不可见**。

### 1.3 无黑屏 / 无残留（分项通过）

- 整屏纯色占比峰值 `topShare=0.8839`，且最高频色是 `[0,0,8]`（= 站点底色），不是遮盖板；没有任何一帧出现"整屏纯色遮盖"（前两轮的蓝板子问题确已修好：`playBreak` 只用 `slashWipe(bandEl)`，不再擦整屏）。
- 滚到底再滚回：`verify/r3/rec.mjs end --scrollEnd=1` → `可见色带=0 存活环=0 整屏 fixed 层=[]`；回滚到顶后画面与"未点击前"无残留差异（残留=0 带 / 0 环）。
- 各幕接缝：逐 200px 扫全 3601px，`actsWithReadableText` 仅在滚动接缝处同时出现两幕（正常文档行为，不判缺陷）。

### 1.4 reduced-motion（通过）

`--media=prefers-reduced-motion:reduce`：
- `__siteSummary()` → `实际强度=0 · 峰值有时长动画=0 · 峰值全部=0 · 峰值时是谁在动=[]`。
- 点击后单帧落终态：`rm-base` 连拍 t0..t2500 与终态参考帧 **像素差 0.000%**（真停，不是"看着像停"）。
- 内容零缺失：`#mv-date/#mv-age/#mv-title/.mv__eyebrow` 全部 `opacity:1`（与默认路径恰好相反）。

---

## 2. 标准 2 / 3 回归

**标准 2**（`verify/r3/config-regress.mjs`，自建：改配置 → `tsc --noEmit` → `vite build` → 探针读渲染值）：

| case | 结果 |
|---|---|
| `swap` | 称呼句→"小星，今天是你 13 岁的生日。"、CTA→"开始吧"、主视觉→"10.20 / 13 / 生日大喜"、签名→"换过的签名"、收尾日期→"2027.10.20"、bgm→`./blessing.mp3?v=swap`、`gallerySrcs[0]`→`swapped-01.svg`；4 张卡仍在 |
| `badimage` | 4 条路径全指向不存在文件 → 4 张卡全部降级为占位卡，`brokenVisible=0`（截图 `verify/shots/r3/badimage-gal.png` 我实看：占位卡带「角色 01 / FAVORITE / 你说他笑起来最好看」，无裂图、无空白） |
| `calm` | `configuredStrength=0` / `injectedStrength=0` / `峰值有时长动画=0`，文案字数仍 375、段落 7、卡片 4 → 降级不减内容 |

收尾：`--restore` 后 `src/site.config.ts` 与实验前**逐字节一致**（哈希 `04A75749…` 与 `verify/.site.config.orig.ts` 相同），`tsc --noEmit`=0，构建 OK。
`public/gallery/` 4 个原始 svg 未被改动（mtime 仍为 22:47:14）。

**标准 3**：`verify/lint-conventions.mjs` → `PASS（30 个文件，0 处硬编色值、0 处越界曲线）`；
自跑几何探针（`verify/r3/probe-copy.js`）：`overflowX=false`、`scrollMax=3601`、`.mv__eyebrow/#mv-date/#mv-age/#mv-title` 字号 94/94/35px、对比度 7.95 / 11.53、`dateFits=true ageFits=true`、所有 `button/a/[role=button]` 尺寸均 ≥44px（`smallTargets=[]`）、文案与配置逐字一致（7 段 / 375 字 / 4 卡）。

---

## 3. 判据自证（负向对照）

**改动**（唯一一次按授权动 `src/`，已还原）：`src/app.ts` `tl.call(..., undefined, 0.78)` → `0.25`；`src/acts/main-visual.ts` `if (!entered) setTextVisible(false)` → `true`，并在 `enter()` 正常分支补 `setTextVisible(true)`（用来暴露"主视觉文字本来该可见"这一面）。`tsc --noEmit`=0 → build 成功。

**结果**（`verify/r3/analyze.mjs verify/shots/r3/neg.json`）：

```
【判据输出】转场窗口内同时可读幕数峰值=2 @t0ms；双幕帧数=4
        → t0(2幕:seal+act-mv) t150(2幕:seal+act-mv) t250(2幕:seal+act-mv) t320(2幕:seal+act-mv)
```

- **能报出**人为制造的双重曝光（封印与主视觉文字在 0~361ms 连续 4 个采样帧同时可读）。
- 同一判据在**还原后的正常构建**上跑：`峰值=1 @t0ms；双幕帧数=0`（`verify/shots/r3/final.json`）→ 判据不是恒真的。
- 像素侧同步可辨（同区域笔画量）：负向变体 `neg-t600` 的 `mv-grid` blob=**28092**、`seal-cta` 区 blob=**2812**；正常终态 `final/fine-t600` 分别只有 **9573 / 629**（主视觉文字可见；封印早已 none——是 wait 后残余，非双曝）。两帧与终态参考的像素差：负向 8.65% / 正常 0.138%。

**还原**：`Copy-Item verify/r3/_orig/*.orig` → 原文件，哈希与备份逐字节一致
（`app.ts` `D639C772…`、`main-visual.ts` `C87C95E3…`）；
`tsc --noEmit` exit=0；`vite build` OK；产物回到 `dist/assets/main-BA6abAIy.js`（与实验前同名同长）；
还原后再跑一次取证确认 `final` run 复现"终态只有 `.mv__eyebrow`"。

---

## 4. 不一致清单（最重要）

1. **【严重·标准1 不通过】主视觉三块核心文字永久不可见。** 默认强度下点击后 `#mv-date`(9.19) / `#mv-age`(12) / `#mv-title`(生日快乐) 有效透明度恒为 0；`#mv-date`/`#mv-title` 内联 `opacity:0`，`#mv-age` 被父 `.mv__age` 内联 `opacity:0` 压住。第 2 项"保险"修的是转场、砸掉的是整幕内容。reduced-motion 分支反而是唯一正常的（因为那里有 `setTextVisible(true)`）。
2. **【严重·标准1 不通过】幕间空档 ~460–560ms**：封印文字 ~355ms 归零、封印整块 0.34–0.78 的淡出同色不可见、主视觉首字 ~925ms 才亮。作者注里的"0.8s display:none"是 DOM 时刻，不是**观感**时刻。
3. **【中】作者的 `__journey()` 第二版仍报 0，但这次不是盲区而是"看不见缺陷"**：它的断言范围限定"封印 display≠none"的窗口 → 主视觉三块文字在 0.78s 后消失的时间点落在窗口外，永远不进判定；且它对 `.mv__eyebrow` 之外的元素无法区分"被父级 opacity 压住"。**它的 `maxActsReadable=1` 与"页面没问题"不等价**——请勿据此判通过。
4. **【轻】`enter()` 的正常/降级两分支不对称**：`skipMotion()` 分支有 `setTextVisible(true)` + `setState('active')`，正常分支没有；`setState` 里 `state !== 'active'` 才 `setTextVisible(false)`，导致"保险"只在初始化那一次生效并永久残留。这是同一个根因的两面，建议改成 `setTextVisible(!entered)` 并在 `enter()` 里无条件 `setTextVisible(true)`。
5. **【轻】`coversSeen` 信息项复现了旧盲区的味道**：它只看 `body *` 里背景色覆盖率 ≥90% 的元素，`.seal`（`--c-deep`，覆盖率 100%）在整段转场里都算"整屏不透明层"，信息项长期带着噪声，容易被误读成"有遮盖"。本轮它没参与判定，不构成结论风险。

## 5. 最该改的 1~3 件事

1. **把 `#mv-date / #mv-age / #mv-title` 从"永久隐藏"里救出来**：`enter()` 正常分支无条件 `setTextVisible(true)`（且 `.mv__age` 这种容器选择器换成对 `#mv-age` 本体的选择），或在 `setState('active')` 里用 `setTextVisible(!entered)`。不改这条，主视觉这一幕等于空的。
2. **填掉 ~0.5s 空档**：把主视觉的 `enter()` 提前到封印文字开始淡出之后（约 0.30–0.38s）而不是 0.78s，并让主视觉首个文字与封印最后一帧"交叠 1~2 帧"；或者反过来让封印整块淡出与主视觉 slab 扫入并行，用**非底色的**视觉元素（斜切带 / 网点）承接这 0.5s，避免"整屏只剩底色"。同时删掉 0.34–0.78 那段同色淡出（既无观感又占时间）。
3. **给"幕间连贯"换一个不会被范围声明废掉的断言**：以"每帧全屏可读文字所属幕数 ≤1"为不变量，窗口不设封印 display 条件（改为整站生命周期），并把"某一幕在自己的激活期内可读元素数为 0"单列为**内容缺失**断言（本轮该断言一跑就能抓到第 1 条）。

## 6. 复现命令（全部本轮实跑）

```
node verify/r3/rec.mjs base --offs=0,60,120,180,240,300,380,460,560,680,800,950,1150,1400,1800,2400
node verify/r3/analyze.mjs verify/shots/r3/base.json
node verify/r3/timeline.mjs tl2 --offs=300,360,420,480,540,580,620,660,700,740,780,820,860,900,940,980,1020,1100,1250
node verify/r3/ink.mjs verify/shots/r3/base.json t2400
node verify/r3/finalstate.mjs
node verify/r3/probe.mjs --jsfile=verify/r3/probe-chain.js --wait=1500 --click=1 --after=7000
node verify/r3/probe.mjs --jsfile=verify/r3/probe-state.js --wait=1200 --media=prefers-reduced-motion:reduce --click=1 --after=2000
node verify/r3/rec.mjs rm-base --media=prefers-reduced-motion:reduce --offs=0,120,300,600,1200,2500 --scrollEnd=1
node verify/r3/rec.mjs end --offs=200,1200 --scrollEnd=1
node verify/r3/config-regress.mjs            # 标准 2 三 case + 自动还原
node verify/lint-conventions.mjs             # 标准 3
node verify/r3/probe.mjs --jsfile=verify/r3/probe-copy.js --wait=800
# 负向对照：改 src/app.ts(0.78→0.25) + main-visual.ts(保险关掉/补 true) → build → rec neg → analyze
node verify/r3/rec.mjs neg --offs=0,150,250,320,400,500,600,700,900,1200
node verify/r3/analyze.mjs verify/shots/r3/neg.json
# 还原后复跑
node node_modules/typescript/bin/tsc --noEmit
node node_modules/vite/bin/vite.js build
node verify/r3/rec.mjs final --offs=0,180,300,380,460,560,680,900,1200,2000
node verify/r3/analyze.mjs verify/shots/r3/final.json
```

截图：`verify/shots/r3/{base,fine,final,neg,rm-base,end}-t*.png`、`verify/shots/r3/badimage-gal.png`、`verify/shots/r3/probe-*.png`。
