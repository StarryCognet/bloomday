# 独立复核报告 · 标准 1 重审 + 作者反诉 + 标准 2/3 回归

复核者：独立复核 agent（冷视角）。作者修的是 `src/app.ts`（`playBreak` 擦除目标 `sealEl`→`.seal__band` + 新增 `__journey()`）。
复核期我**没有改任何 `src/` 业务代码**；只在 `verify/indep/` 下自建了独立取证脚本，`src/site.config.ts` 用 `config-swap` 改过后已 `--restore` 并重建（与 `verify/.site.config.orig.ts` 逐字节一致）。

## 一、标准 1 判定：**不通过**

理由不是作者修的那块蓝板子（那块真的修好了），而是修完后**仍然存在**、且**作者的自检钩子结构上抓不到**的两件事：
① 幕间 0.25–0.30s 的两幕文字双重曝光（元素残留的实质形态）；
② 该时段画面密度实降（busy 252→174 / inkRatio 0.233→0.373 / p95 180→120 / 只有 2 个 GSAP 时长动画在跑）。

### 1.1 整屏纯色遮盖：确认已消除（作者的修复成立）

我自己写解码器（`verify/indep/png.mjs`，零依赖 inflate + 反滤波）从 CDP 真截图算像素，不用作者任何钩子。

| 指标 | 结果 | 说明 |
|---|---|---|
| 逐帧「最高频量化色占比」峰值（11 帧连拍） | **0.766**（=深底 #05070F） | 整屏纯色遮盖时为 1.000 |
| 逐帧命中测试（58 帧 × 741 采样点，`elementFromPoint` 沿祖先链找不透明底色） | 除 `#seal`/`.mv` 两个幕底（RGB 5,7,15）外，**无任何中途出现的整屏不透明层** | 这是独立判据，不是作者的 position/className 白名单 |
| `.mt-band` 最大视口覆盖 | **10.2% @ 87ms**（父元素 `seal__band`，y=305 h=86） | 原失败模式是 100% |
| 副色带 `.mt-band`（父 `mv__title`） | 最大 4.04% | 局限在标题盒内 |
| 视口内文字条数最小值 | **5**（@866–948ms） | **零文字帧 = 0** |

**判据有效性对照（关键，用来证明我报的 0 不是坏判据给的 0）**

| 对照 | 我的像素判据 | 作者 `__journey()` |
|---|---|---|
| 不注入（真实页面） | topShare 0.765，busyTiles 252 | maxCover=0.0% |
| 运行期注入一个 `position:fixed;inset:0;background:rgb(20,64,184)` 整屏层 | **topShare=1.000，busyTiles=0，inkRatio=0** | 点击后再注入 → **maxCover=100.0%（DIV @98ms）** ✅ |
| 同上，但**点击之前**注入并保持 | — | **maxCover=0.0%**，且「零文字空窗=0」（该层明明盖满一屏）❌ |

### 1.2 空白停顿 / 元素残留：**不通过**

- 残留（滚到底再回滚，独立统计）：`.mt-band` 总共 3 个，**可见 0 个**（含 3 个非整屏父元素）；存活环 0；其它残留元素 0；`#seal` display=none；横向无溢出（390/390）。→ 这部分干净。
- **但转场中间存在两幕文字同屏的时段**：页面内逐帧清点文字节点所属幕（用 `Range.getClientRects()` 判定真的画在视口里）：

  ```
  封印文字 & 主视觉文字同时可见：52 帧，连续区段 5.7ms → 846ms（840ms）
  峰值同屏文字条数 15
  ```

  决定性一帧（干净单帧，每次独立重载后定时拍，排除逐帧探针开销伪影）：
  `verify/shots/indep/single-t750.png` —— 同一画面上同时可读：封印的「点我开始」CTA、封印的「妹妹，今天是你 12 岁」、主视觉新砸入的「9.19」，以及正在擦入的「生日快乐」描边；两个「9.19」一虚一实叠着；`meanLum` 只有 29，整屏发灰。
  该帧实测：`topShare=0.617 / busyTiles=174 / p95=119.9`，而点击前是 `0.765 / 252 / 180.8`。

  机制（读代码可复核）：`tl.call(() => mainVisual.enter(), undefined, 0.4)`（app.ts:139）让主视觉进场与封印淡出**并行**；封印 `opacity:0` 到 **0.42+0.45=0.87s** 才跑完，`display:none` 在 0.95s；而主视觉 `slashWipe(titleEl)` 从 +0.5s 起算、`charSlam(titleEl)` +0.62s——封印还在 30–50% 不透明时，下一幕的文字已经在擦入/砸入。

  **作者的 `__journey()` 为什么抓不到**：它只统计 `position:absolute|fixed` 且自身 `backgroundColor` 不透明（α≥0.5）且面积≥90% 视口的元素。两幕交叉淡入淡出时没有任何这样的元素；`#seal` 还被 `if (el.id === 'seal') return` 显式跳过。它也不统计「几幕的文字同时在屏上」。

### 1.3 自检钩子的第二个结构性盲区（与本次修复无关，但直接影响"能不能信 0.0%"）

`window.__journey()` 报的 `maxCover` **只在点击那一刻才开采样窗口**（`enter()` 里 `coverScanning = true`），且初始化头两帧扫到的整屏层会被永久写进 `persistentFullscreen` 白名单。后果：**任何"从第一帧就在"的整屏遮盖，这个钩子永远报 0.0%**——上面 1.1 的第三行对照就是实证（整屏层在，报 0.0%）。此外它的「零文字空窗」判定只看 DOM 里文字自身 opacity（祖先链），被不透明层盖住不算，所以那个对照里它同时报了「零文字空窗=0」。

## 二、作者的反诉：**两位都成立**（但结论描述需要更精确）

- 幕几何（`offsetTop/offsetHeight`，390×844）：`act-mv 0/844` → `act-blessing 844/1913` → `act-gallery 2757/844` → `act-finale 3601/844`；文档高 4445，最大滚动 3601；**相邻幕接缝全部为 0px**（无空洞 layer）。
- 独立文字扫描：步长 40px、每个位置 settle 340ms 后再数，**91 个位置零文字 = 0**，最少 2 条（y=3400–3600 是 `许个愿吧。` + `点一下烛火`，两者都在视口内）。
- 争议带 y≈2840–3080：实测该带内 y=2880/2920/2960/3000/3040/3080 各有 **8–9 条**文字在视口内（`角色 01`/`FAVORITE`/`你说他笑起来最好看` + `.gal__dots`）；`pos-3080.png` 实拍：`角色 01` 蓝带与下方的 `角色 01 / 你说他笑起来最好看` 标注卡都在屏上。**该带不是空白带。**
- 争议带 y≈3600：`pos-3601.png` 实拍 `许个愿吧。` + 烛火在视口内；下方大片深色是 `act-finale` 的下半屏留白，其出现位置在**最后一条文字之后**（页面已到底），不是「幕之间的空窗」。

**结论修正（重要）**：空白带的**观测**确实是假阳性，但把它描述成「正常留白」淡化了另一件事——y≈2840–3080 之所以看起来"空"，是因为**角色幕的 4 张卡全部在降级态**（`public/gallery/` 里本来就没有素材，4 张卡是深蓝色块 + 角色名）。这是素材未到位，不是留白设计。至于「网格采样粒度问题」这个**归因**我无法核实（上一轮判据的脚本不在仓库里），只能确认**结论**：那个空窗在这台机器、这个视口、这套判据下不存在。

## 三、标准 2 回归：**通过**

| 场景 | 证据 |
|---|---|
| 素材缺失（`--case=badimage`，4 条路径全指向不存在的文件） | 4 张 `<img>` 全部 `complete=true / naturalWidth=0 / display:none / width=0`（**没裂图**）；4 个 frame 全部 `is-fallback`，高度 365/328/328/328，占位名 `角色 01/02/03/04/我们的合照` —— **不留空洞**；实拍 `badimage-y2757.png`：占位卡完整、`FAVORITE / 角色 01 / 你说他笑起来最好看` 三行全在 |
| 素材到位（`make-test-assets.mjs` 生成 4 张） | 4 张全部 `naturalWidth=600`、`loadedFrames=4 / fallbackFrames=0`；`is-loaded` 正常 |
| 基线（素材不存在时的默认出厂态） | 4/4 走降级，不裂图不空洞 |

## 四、标准 3 回归：**通过**（含"换歌"实化）

- `--case=swap` 后 `__siteReport()` 的 `config` vs `rendered` 双侧一致：名称 妹妹→小星、age 12→13、dateLabel 9.19→10.20、dateFull 2026.9.19→2027.10.20、cta 点我开始→开始吧、title 生日快乐→生日大喜、sign →—— 换过的签名、卡片名/note 同步变；同一时刻 `blessingBlocks=7 / blessingChars=375 / galleryCards=4` 内容一条不少。
- 单源 lint：`lint-conventions.mjs` **PASS**（30 个文件，0 处硬编色值、0 处越界缓动字面量）。
- **"换歌"这次实了**（补上上一轮点名的薄弱证据）：
  1. `Copy-Item public\blessing.mp3 public\blessing-alt.mp3`（真·另一个文件名）
  2. `src/site.config.ts` 的 `bgm` 改成 `'./blessing-alt.mp3'` → 重建
  3. 点击后读 `#bgm`：`srcAttr="./blessing-alt.mp3"`，**`currentSrc="http://127.0.0.1:4173/blessing-alt.mp3"`**，`readyState=4`，`duration=270.72`，`error=null`
  4. `dist/blessing-alt.mp3` 存在，服务器 `GET /blessing-alt.mp3 → HTTP 200 / 4715853 bytes`
  → 配置换了文件名，页面真的换了文件，不是缓存戳。测完已删除该测试文件、还原配置并重建。
- **仍存的薄弱点（照实记）**：`verify/config-swap.mjs` 的 `swap` 用例对歌只做 `?v=swap` 缓存戳，下一次跑回归仍然验不到"换文件"；这条要真实化得改脚本。

## 五、不一致清单（最重要）

1. **【真，本次复核新发现】幕间文字双重曝光 0.25–0.30s**。`single-t750.png` / `breaklate-t420-t550.png` 可见两个「9.19」重叠、CTA 与「生日快乐」互相穿透。作者的 `__journey()` 报「0.0% + 零文字空窗 0 + 无残留」，与观感不符——不是数据造假，是判据看不见这类目标（无整屏不透明元素）。作者报告"整体通过"属于**漏测**。
2. **【真】`__journey()` 的 `maxCover` 有系统性盲区**：采样窗口只在点击那刻开 + 头两帧整屏层进白名单 ⇒ **"第一帧就在的整屏遮盖"永远报 0.0%**；且 `#seal` 被无条件跳过。实证：注入整屏层不点击 → 报 `maxCover:0`；点击后注入 → 报 `100%`。所以**"0.0%"这个数与"页面真的干净"不等价**。
3. **【真】`__journey()` 的"零文字空窗"判据不同源**：它用「带直接文字的元素数」，与上一轮报出空窗的网格采样不是同一套判据；两套判据都没抓到上面第 1 条的叠加，所以"空窗=0"不能拿来支撑"幕间连贯"。
4. **【真但次要】`strength:0` 后 `.mt-band` 计数残留 1 个**：`calm` 模式下拿作者的「可见色带」口径（`display!=='none'`）会数到 1 个隐藏条（0×0、视觉不可见、`residBands` DOM 残留 1）。视觉上无影响——calm 模式点击是**原子切换**：7 张连拍像素逐字节相同（`topShare 0.7149 / busyTiles 222 / meanLum 23.0` 全程不变），`#seal` 从 active 直接 `display:none`，无黑屏无空白，这条路径比正常路径干净得多。
5. **【假阳性，作者反诉成立】y≈2840–3080 空白带、y≈3600 空窗**：均不存在（8–9 条 / 2 条文字在视口内，实拍为证）。归因（网格粒度）无法核实。
6. **【观感描述不足，非数据错】** 作者把 y≈2840–3080 说成"98px 正常留白"，但该处是**素材缺失导致的 4 张降级卡**；作为交付给妹妹的页面，这块视觉观感需要素材或更强的占位设计。
7. **【事实澄清】** 作者自称"只改了 `src/app.ts`"属实（`config-swap` 已还原）；但 `verify/` 下与我无关的上轮脚本/截图大量残留，`verify/shots/` 已有 200+ 文件，不影响判定。
8. **【无关但值得记】** 页面不响应 `prefers-reduced-motion`（`Emulation.setEmulatedMedia` 强制 reduce 后，DOM 仍报 `sealOpacity:0 / mvOpacity:1` 的动画终态，动画照跑）。降级开关只有 `site.config.ts` 的 `motion.strength`。标准 1 相关：`playBreak()` 的 `skipMotion()` 分支实测干净。

## 六、整体结论 + 最该改的 1~3 件事

**整体**：作者对自己报的那个 bug（整屏纯蓝 200–320ms）的修复**是真的、可复现、我用自己的像素判据独立确认了**；素材降级（标准 2）和配置单源（标准 3，含换歌）都**通过**。但标准 1 作为一条"全程连贯"的组级标准，**仍不通过**：蓝板子换成了更难看的双重曝光，而且作者新增的自检钩子在结构上就抓不到它——**一个在坏页面上也报 0.0% 的判据，不能作为这条标准的通过依据**。

**最该改的三件事**

1. **把封印退场和主视觉入场串行化**（app.ts:135–139）。要么让主视觉的文字级动画（`charSlam`/`slashWipe`）在封印 `display:none` 之后才开始，要么把封印从 0.42s 起、0.45s 内淡完并让主视觉在 0.87s 后才砸字；封印淡出期间只允许下一幕的**背景/色块**在，不允许它的**文字**在。目标：不存在任何一帧同时可读两幕文字（一条可断言的上限，例如 ≤80ms 且仅限背景层）。
2. **修 `__journey()` 的两个盲区**：把采样窗口从"点击那刻"提前到"页面初始化"，去掉 `persistentFullscreen` 白名单（改用"用户手势之后才出现"判定），去掉 `el.id === 'seal'` 的无条件跳过；并**新增一条独立断言**——逐帧统计"视口内文字分属几幕"，>1 幕即失败。现在的判据只能证明"没有整屏不透明块"，证明不了"幕间连贯"。
3. **换歌证据实化 + 降级开关补齐**：把 `verify/config-swap.mjs` 的 `swap` 用例改成"真的复制一份 mp3 并改 `bgm` 指向它"（否则每次回归这条都是缓存戳级别的假证据）；顺手把 `prefers-reduced-motion` 接到既有 `strength:0` 路径（妹妹的手机若开了减弱动态，现在等于没接）。

---

### 附：本轮实际跑的命令（可复现）

```
# 自建独立取证工具（都在 verify/indep/，未触碰 src/）
node verify/indep/drive.mjs breaklate  verify/shots/indep   # 点击后 11 帧连拍 + 页面内每帧遥测
node verify/indep/drive.mjs breakearly verify/shots/indep   # 加载后立刻点（叠加态）
node verify/indep/drive.mjs breakprobe verify/shots/indep   # 58 帧 × 741 点命中测试
node verify/indep/drive.mjs crossfade  verify/shots/indep   # 跨幕文字同屏时长
node verify/indep/drive.mjs single     verify/shots/indep   # 干净单帧（独立重载定时拍）
node verify/indep/drive.mjs geom       verify/shots/indep   # 91 位置 × 40px 独立文字扫描
node verify/indep/drive.mjs residual   verify/shots/indep   # 滚到底再回滚数残留
node verify/indep/burst2.mjs cpu4 verify/shots/indep --cpu=4   # 4 倍 CPU 降速
node verify/indep/negative.mjs runtime --delay=200          # 判据有效性负向对照
node verify/indep/probe.mjs negjourney                      # 作者钩子对照（未点击注入整屏层）
node verify/indep/probe.mjs negjourneyAfterClick            # 作者钩子对照（点击后注入）
node verify/indep/probe.mjs audio --click=1 --wait=1500     # 换歌
node verify/indep/probe.mjs gallery --click=1 --scrollY=2757 --wait=2500
node verify/indep/probe.mjs broken  --click=1 --scrollY=2757 --wait=3000
node verify/make-test-assets.mjs ; node verify/config-swap.mjs --case=badimage
node verify/config-swap.mjs --case=swap ; node verify/config-swap.mjs --case=calm
node verify/config-swap.mjs --restore
node node_modules/vite/bin/vite.js build ; node node_modules/typescript/bin/tsc --noEmit
node verify/lint-conventions.mjs
```

主要截图：`verify/shots/indep/single-t750.png`（双重曝光决定性一帧）、`single-t150.png`、`single-t1100.png`、`breaklate-t240/t320/t420/t550.png`、`pos-3080.png`、`pos-3601.png`、`badimage-y2757.png`、`calm-t0.png`、`neg-runtime-t220.png`。
数据：`verify/shots/indep/breakprobe-raw.json`、`geom-report.json`、`crossfade-report.json`、`residual-report.json`、`breaklate-telemetry.json`。
