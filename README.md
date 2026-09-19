# BLOOMDAY

给妹妹的 12 岁生日站。2026-09-19。

打开链接 → 一段游戏开场动画自动播放 → 点一下进站 → 跟着歌走的一整页。

## 技术栈

| | |
|---|---|
| 构建 | Vite 5 + TypeScript（无框架，动效用 GSAP 直接操作 DOM） |
| 滚动 | Lenis（纵向阻尼） |
| 动画 | GSAP 3 |
| 音频 | 原生 `HTMLAudioElement` + WebAudio `AnalyserNode`（飘带的能量来自实时频谱） |
| 部署 | 纯静态，产物在 `dist/` |

## 本地跑

```bash
npm ci
npm run dev          # 开发
npm run build        # 类型检查 + 构建
npm run preview      # 预览构建产物（:4173）
```

## 部署（Cloudflare Pages）

| 字段 | 值 |
|---|---|
| 框架预设 | Vite |
| 构建命令 | `npm run build` |
| 构建输出目录 | `dist` |

`vite.config.ts` 里 `base: './'`，挂根目录或子路径都不会白屏。

## 结构

```
src/
  tokens.ts          设计 token 单源 —— 颜色/几何/字体层级，注入 :root，
                     并带一个 >=640px 的平板断点。色值硬编会被 lint 拦下。
  site.config.ts     站点配置单源 —— 称呼/日期/图片/BGM/动效强度。
                     换这些不需要动代码。
  motion/            动效内核（缓动、原语、粒子、导演、强度）。
                     内核不认识 site.config —— 依赖方向不能反。
  acts/              五幕：main-visual / blessing / gallery / finale
                     + gallery-pin（钉住横向）、scroll-reveal（滚动显现）
                     + lyrics-layer（卡拉OK 歌词）、caustics（水波）
  ribbons.ts         常驻粒子飘带层
  smooth.ts          Lenis 滚动阻尼
  chrome.ts          常驻 UI 框架（四角标记 / 顶部细导航）
public/
  blessing.mp3       BGM
  gallery/           30 张结城理图片（长边 900，已压缩）
  ark/               序章：明日方舟 × P3R 联动开场动画的改造版
verify/              零依赖验证工具（CDP 截图 / 探针 / 各幕审计）
```

## 序章（`public/ark/`）改了哪里

原仓库是《明日方舟》ACT54SIDE「月行水上」开场动画的浏览器复刻，
角色换成结城理。这里的改造：

- **关掉 90° 旋转**：原版竖屏把 16:9 舞台转 90° 塞进 9:16，画面躺倒且没有
  任何提示。改成竖屏"铺满裁左右"，正着看。
- **清掉功能 UI**：校园商店 / 旅行计划 / Daily Fortune / 今日答案 / 巡学路 /
  Route / School 等 47 条路径。用 CSS `[data-path=...]` 而不是改 `scene-data`
  的 `active` —— 那些节点的显隐是**动画曲线驱动的**，静态改会被覆盖回去。
- **换成生日内容**：`title_main` → HAPPY / BIRTHDAY、`entry_main_text` →
  妹妹，生日快乐。、`entry_back_text_*` → BLOOMDAY / 2026.09.19。
- **隐藏播放器控件**，竖屏加一句"把手机横过来"。

## 版权

仓库内含第三方版权素材，**仅作个人生日礼物使用，不用于任何商业用途**：

- `public/gallery/` —— 30 张 Pixiv 同人图，版权归各原作者
- `public/ark/` —— 《明日方舟》（鹰角网络）×《女神异闻录 3 Reload》（Atlus）
  的官方活动素材
- `public/blessing.mp3` —— halyosy「Blessing」
