/**
 * bloomday · 全站视觉唯一真源（single source of truth）
 *
 * 规则：颜色 / 切角 / 斜切角度 / 字号 / 描边 / 网点密度 **只在本文件定义**。
 *   - DOM  侧：vite.config.ts 里的插件在构建/开发时把 cvars 注入成 :root 的 CSS 变量
 *   - Canvas 侧：直接调 canvasPalette()，取的是同一批常量
 * 任何其它文件硬编颜色或角度 = bug。
 */

/* ── 五级色阶（主色板，定调全站） ─────────────────────────── */
export const color = {
  /** 深底 · 页面最底层，近黑蓝 */
  deep: '#05070F',
  /** 中蓝 · 品牌主色，大面与主视觉 */
  mid: '#1440B8',
  /** 青蓝 · 能量与高光，只给"发光"的东西 */
  cyan: '#35E0FF',
  /** 高光白 · 正文与高光（偏冷，不用纯白） */
  white: '#F2F7FF',
  /** 警示点缀 · 极少量，只给"这一刻" */
  accent: '#FF2E63',
} as const

/* ── 支持色（从主色阶延长，服务于层次而非新调性） ────────── */
export const shade = {
  ink: '#02030A',
  deep2: '#0A0F1F',
  navy: '#0B1330',
  midDark: '#0B2A7A',
  midLight: '#2E6BFF',
  cyanDim: '#1B6E8C',
  whiteDim: '#8FA3C8',
} as const

/* ── 切角几何 · 描边 · 网点 ──────────────────────────────── */
export const geometry = {
  /** 缺角尺寸（px）：panel 用 md，大块用 lg/xl */
  cut: { sm: 8, md: 14, lg: 24, xl: 40 },
  /** 斜切角度（deg）：负值 = P3 招牌的左上→右下倾 */
  skew: { flat: -6, base: -12, steep: -18 },
  /** 描边粗细（px） */
  stroke: { hair: 1, bold: 2, heavy: 4 },
  /** 半调网点：格子大小与点半径 */
  halftone: { size: 6, dot: 1.2, gap: 14 },
  /** 扫描线：间距与不透明度（低于 0.08 在手机上基本看不见） */
  scanline: { step: 3, opacity: 0.1 },
  /** 噪点不透明度 */
  noise: { opacity: 0.06 },
} as const

/* ── 字体 ────────────────────────────────────────────────── */
const CJK =
  '"PingFang SC","HarmonyOS Sans SC","Source Han Sans SC","Noto Sans SC","Microsoft YaHei",system-ui,sans-serif'
/** 展示字体：数字/大标题。全部走系统字体（今晚不引 webfont），最终都回落到 CJK 粗体，不会出豆腐块 */
const DISPLAY = `"Anton","Impact","Haettenschweiler","Arial Black",${CJK}`

export const font = { cjk: CJK, display: DISPLAY } as const

/* ── 字体层级（手机优先，用 clamp 做流体缩放） ───────────── */
export const typography = {
  /** 主视觉巨字：9.19 / 12 */
  hero: { size: 'clamp(4.5rem, 26vw, 9rem)', weight: 900, tracking: '-0.05em', leading: 0.82 },
  /** 幕标题 */
  h1: { size: 'clamp(2rem, 9vw, 3.25rem)', weight: 900, tracking: '-0.02em', leading: 1.05 },
  /** 小节标题 */
  h2: { size: 'clamp(1.35rem, 5.5vw, 1.75rem)', weight: 800, tracking: '-0.01em', leading: 1.25 },
  /** 祝福文案正文：可读性优先，行高放大 */
  body: { size: 'clamp(1.0625rem, 4.4vw, 1.1875rem)', weight: 500, tracking: '0.01em', leading: 1.85 },
  /** 标签 / 角标：宽字距大写字感 */
  label: { size: 'clamp(0.6875rem, 3vw, 0.8125rem)', weight: 700, tracking: '0.18em', leading: 1.2 },
} as const

export type TypeLevel = keyof typeof typography

/* ── 间距（最小集，防止后续硬编） ────────────────────────── */
export const space = { 1: 4, 2: 8, 3: 16, 4: 28 } as const

/* ── 派生：hex → rgba，保证透明度也从同一处出 ────────────── */
function rgba(hex: string, a: number): string {
  const n = parseInt(hex.slice(1), 16)
  const r = (n >> 16) & 255
  const g = (n >> 8) & 255
  const b = n & 255
  return `rgba(${r},${g},${b},${a})`
}

/* ── 切角路径：左上 + 右下缺角（P3 味的关键形状） ────────── */
function cornerCut(px: number): string {
  return `polygon(${px}px 0,100% 0,100% calc(100% - ${px}px),calc(100% - ${px}px) 100%,0 100%,0 ${px}px)`
}

/* ── CSS 变量出口：DOM 侧的唯一入口 ──────────────────────── */
export const cvars: Record<string, string> = {
  // 五级色阶
  '--c-deep': color.deep,
  '--c-mid': color.mid,
  '--c-cyan': color.cyan,
  '--c-white': color.white,
  '--c-accent': color.accent,
  // 支持色
  '--c-ink': shade.ink,
  '--c-deep-2': shade.deep2,
  '--c-navy': shade.navy,
  '--c-mid-dark': shade.midDark,
  '--c-mid-light': shade.midLight,
  '--c-cyan-dim': shade.cyanDim,
  '--c-white-dim': shade.whiteDim,
  // 透明度派生
  '--c-white-12': rgba(color.white, 0.12),
  '--c-white-40': rgba(color.white, 0.4),
  '--c-mid-40': rgba(color.mid, 0.4),
  '--c-cyan-30': rgba(color.cyan, 0.3),
  '--c-ink-80': rgba(shade.ink, 0.8),
  // 切角
  '--cut-sm': `${geometry.cut.sm}px`,
  '--cut-md': `${geometry.cut.md}px`,
  '--cut-lg': `${geometry.cut.lg}px`,
  '--cut-xl': `${geometry.cut.xl}px`,
  '--clip-card': cornerCut(geometry.cut.md),
  '--clip-card-lg': cornerCut(geometry.cut.lg),
  '--clip-card-xl': cornerCut(geometry.cut.xl),
  // 斜切
  '--skew-flat': `${geometry.skew.flat}deg`,
  '--skew-base': `${geometry.skew.base}deg`,
  '--skew-steep': `${geometry.skew.steep}deg`,
  // 描边
  '--stroke-hair': `${geometry.stroke.hair}px`,
  '--stroke-bold': `${geometry.stroke.bold}px`,
  '--stroke-heavy': `${geometry.stroke.heavy}px`,
  // 网点 / 扫描线 / 噪点
  '--ht-size': `${geometry.halftone.size}px`,
  '--ht-dot': `${geometry.halftone.dot}px`,
  '--ht-gap': `${geometry.halftone.gap}px`,
  '--scan-step': `${geometry.scanline.step}px`,
  '--scan-opacity': `${geometry.scanline.opacity}`,
  '--noise-opacity': `${geometry.noise.opacity}`,
  // 字体
  '--font-cjk': font.cjk,
  '--font-display': font.display,
  // 间距
  '--sp-1': `${space[1]}px`,
  '--sp-2': `${space[2]}px`,
  '--sp-3': `${space[3]}px`,
  '--sp-4': `${space[4]}px`,
}

// 字体层级：每级四个变量，从 typography 自动展开
for (const [level, t] of Object.entries(typography)) {
  cvars[`--fs-${level}`] = t.size
  cvars[`--fw-${level}`] = `${t.weight}`
  cvars[`--tr-${level}`] = t.tracking
  cvars[`--lh-${level}`] = `${t.leading}`
}

/** 生成注入 index.html 的 :root 样式块 */
export function tokenCss(): string {
  const body = Object.entries(cvars)
    .map(([k, v]) => `  ${k}: ${v};`)
    .join('\n')
  return `:root {\n${body}\n}`
}

/* ── Canvas 出口：和 DOM 取的是同一批常量 ────────────────── */
export function canvasPalette() {
  return {
    bg: color.deep,
    deep: shade.deep2,
    navy: shade.navy,
    mid: color.mid,
    midLight: shade.midLight,
    cyan: color.cyan,
    white: color.white,
    accent: color.accent,
  }
}
export type CanvasPalette = ReturnType<typeof canvasPalette>
