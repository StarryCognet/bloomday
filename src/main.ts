/**
 * 「色彩与切角规范」核验板 —— 一次性页面，只为截图验证 token 是否真的单源。
 * 它不是网站的任何一幕，验收完即可整块丢弃（连同 board.css）。
 */
import { canvasPalette, color, cvars, font, geometry, shade, typography } from './tokens'

/* ── 数据 ───────────────────────────────────────────────── */

// [显示名, TS 路径, CSS 变量, 用法] + 对应 hex
const primary: Array<[string, string, string, string, string]> = [
  ['深底', 'color.deep', '--c-deep', '页面最底层', color.deep],
  ['中蓝', 'color.mid', '--c-mid', '品牌主色 / 大面', color.mid],
  ['青蓝', 'color.cyan', '--c-cyan', '能量与高光', color.cyan],
  ['高光白', 'color.white', '--c-white', '正文 / 高光', color.white],
  ['警示点缀', 'color.accent', '--c-accent', '只给"这一刻"', color.accent],
]

const support: Array<[string, string, string]> = [
  ['墨', '--c-ink', shade.ink],
  ['深底 2', '--c-deep-2', shade.deep2],
  ['海军蓝', '--c-navy', shade.navy],
  ['中蓝·暗', '--c-mid-dark', shade.midDark],
  ['中蓝·亮', '--c-mid-light', shade.midLight],
  ['青蓝·暗', '--c-cyan-dim', shade.cyanDim],
  ['白·暗', '--c-white-dim', shade.whiteDim],
]

const typeLevels: Array<[keyof typeof typography, string]> = [
  ['hero', '9.19'],
  ['h1', '生日快乐'],
  ['h2', '然后，我想跟你说说「以后」'],
  ['body', '好好吃饭，好好睡觉，好好玩，好好学。'],
  ['label', 'BLESSINGS FOR YOUR BIRTHDAY'],
]

/* ── 渲染 ───────────────────────────────────────────────── */

function swatchHtml(name: string, path: string, v: string, role: string, hex: string): string {
  return `<div class="swatch">
    <div class="swatch__chip" style="background:${hex}"></div>
    <div class="swatch__meta">
      <span class="swatch__role">${name} <code>${v}</code></span>
      <span class="swatch__hex">${path} = ${hex} · ${role}</span>
    </div>
  </div>`
}

const html = `
<div class="board">
  <header class="board__head">
    <p class="t-label">bloomday · 视觉地基</p>
    <h1 class="t-h1">色彩与切角规范</h1>
    <p class="t-body">
      本页是 <b>token 核验板</b>。全站颜色 / 切角 / 斜切 / 字号 / 描边 / 网点
      只从 <code>src/tokens.ts</code> 出：DOM 走构建期注入的 CSS 变量，Canvas 走
      <code>canvasPalette()</code>。改一处 → 两边同时变。
    </p>
  </header>

  <section class="sec" id="sec01">
    <h2 class="t-h2 sec__title">01 · 蓝色阶（五级主色板）</h2>
    <div class="swatches">
      ${primary.map(([n, p, v, r, h]) => swatchHtml(n, p, v, r, h)).join('')}
    </div>
    <h2 class="t-h2 sec__title">01b · 支持色（主色阶的延长，不引入新调性）</h2>
    <div class="swatches">
      ${support.map(([n, v, h]) => swatchHtml(n, 'shade', v, '', h)).join('')}
    </div>
  </section>

  <section class="sec" id="sec02">
    <h2 class="t-h2 sec__title">02 · 切角与斜切</h2>
    <div class="cuts">
      ${(
        [
          ['sm', geometry.cut.sm],
          ['md', geometry.cut.md],
          ['lg', geometry.cut.lg],
          ['xl', geometry.cut.xl],
        ] as Array<[string, number]>
      )
        .map(
          ([k, px]) =>
            `<div class="cut-demo" style="width:${px * 3}px;height:${px * 2.2}px;clip-path:polygon(${px}px 0,100% 0,100% calc(100% - ${px}px),calc(100% - ${px}px) 100%,0 100%,0 ${px}px)">${k}<br>${px}px</div>`,
        )
        .join('')}
    </div>
    <div class="skews">
      <div class="skew-band skew-band--flat" style="transform:skewX(var(--skew-flat))"></div>
      <div class="skew-band skew-band--base" style="transform:skewX(var(--skew-base))"></div>
      <div class="skew-band skew-band--steep" style="transform:skewX(var(--skew-steep))"></div>
      <em class="swatch__hex">斜切 flat ${geometry.skew.flat}° / base ${geometry.skew.base}° / steep ${geometry.skew.steep}°</em>
    </div>
  </section>

  <section class="sec" id="sec03">
    <h2 class="t-h2 sec__title">03 · 字体层级</h2>
    <div class="type-hero">
      <span class="t-hero">9.19</span>
      <span class="t-hero is-accent">12</span>
    </div>
    <div class="type-list">
      ${typeLevels.map(([lvl, sample]) => {
        const t = typography[lvl]
        return `<div class="type-item">
          <div class="t-${lvl}">${sample}</div>
          <em>.t-${lvl} → ${t.size} / w${t.weight} / tracking ${t.tracking} / line-height ${t.leading}</em>
        </div>`
      }).join('')}
    </div>
  </section>

  <section class="sec" id="sec04">
    <h2 class="t-h2 sec__title">04 · 描边与网点</h2>
    <div class="tex-grid">
      <div class="tex u-stroke-hair"><span>stroke ${geometry.stroke.hair}px</span></div>
      <div class="tex u-stroke"><span>stroke ${geometry.stroke.bold}px</span></div>
      <div class="tex u-stroke-heavy"><span>stroke ${geometry.stroke.heavy}px</span></div>
      <div class="tex u-stroke-accent"><span>stroke accent</span></div>
      <div class="tex tex--fill u-halftone"></div>
      <div class="tex tex--fill u-scanlines"></div>
    </div>
    <em class="swatch__hex">网点 ${geometry.halftone.size}px 格 / ${geometry.halftone.dot}px 点 · 扫描线 ${geometry.scanline.step}px · 噪点 α${geometry.noise.opacity}</em>
  </section>

  <section class="sec" id="sec05">
    <h2 class="t-h2 sec__title">05 · Canvas 取色探针</h2>
    <canvas id="probe"></canvas>
    <pre id="readout" class="readout">measuring…</pre>
  </section>

  <section class="sec" id="sec06">
    <h2 class="t-h2 sec__title">06 · 两幕并排对照</h2>
    <div class="panels">
      <article class="panel panel--a u-cut u-noise">
        <span class="panel__tag t-label">对照板 A</span>
        <div class="panel__band u-skew"></div>
        <div class="panel__num t-hero">9.19</div>
        <p class="panel__foot">斜切带 + 中蓝大面 + 缺角面板。<br>（非任何一幕，仅比对 token 一致性）</p>
      </article>
      <article class="panel panel--b u-cut-lg u-noise">
        <span class="panel__tag t-label">对照板 B</span>
        <div class="panel__band u-skew-steep"></div>
        <div class="panel__num t-hero">12</div>
        <p class="panel__foot">同一批 token 的另一种排布：更陡斜切、青蓝带、更大缺角。</p>
      </article>
    </div>
  </section>
</div>
`

const app = document.querySelector<HTMLDivElement>('#app')
if (!app) throw new Error('#app 不存在')
app.innerHTML = html

/* 聚焦视图：?focus=sec04 只留该节 —— 缩略图里看不清的纹理/几何，用它看真身 */
const focus = new URLSearchParams(location.search).get('focus')
if (focus) {
  document.querySelectorAll<HTMLElement>('.sec').forEach((sec) => {
    if (sec.id !== focus) sec.remove()
  })
  document.querySelector('.board__head')?.remove()
}

/* ── Canvas 探针：只证明「Canvas 从 token 取色」，不做粒子层该做的事 ── */
function mountProbe(canvas: HTMLCanvasElement): void {
  const p = canvasPalette()
  const cssW = canvas.clientWidth || 320
  const cssH = canvas.clientHeight || 140
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  canvas.width = Math.round(cssW * dpr)
  canvas.height = Math.round(cssH * dpr)

  const ctx = canvas.getContext('2d')
  if (!ctx) return
  ctx.scale(dpr, dpr)
  ctx.fillStyle = p.bg
  ctx.fillRect(0, 0, cssW, cssH)

  const keys = ['mid', 'midLight', 'cyan', 'white', 'accent'] as const
  for (let i = 0; i < 44; i++) {
    const k = keys[i % keys.length]
    if (!k) continue
    ctx.beginPath()
    ctx.fillStyle = p[k]
    ctx.arc((((i * 37) % 100) / 100) * cssW, (((i * 61) % 100) / 100) * cssH, 1.4 + ((i * 13) % 10) / 5, 0, Math.PI * 2)
    ctx.fill()
  }
}

/* ── 读数：三处必须给出同一个值 ─────────────────────────── */
function renderReadout(el: HTMLElement): void {
  const cssMid = getComputedStyle(document.documentElement).getPropertyValue('--c-mid').trim()
  const tsMid = color.mid
  const cvsMid = canvasPalette().mid
  const agree =
    cssMid.toLowerCase() === tsMid.toLowerCase() && cvsMid.toLowerCase() === tsMid.toLowerCase()

  el.dataset.agree = agree ? 'yes' : 'no'
  el.textContent = [
    `DOM  getComputedStyle(:root)['--c-mid'] = ${cssMid}`,
    `TS   tokens.color.mid                   = ${tsMid}`,
    `CVS  canvasPalette().mid                = ${cvsMid}`,
    `三处一致 = ${agree ? 'YES' : 'NO'}`,
    `注入变量总数 = ${Object.keys(cvars).length}`,
    `字体 display = ${font.display.slice(0, 48)}…`,
  ].join('\n')
}

const probe = document.querySelector<HTMLCanvasElement>('#probe')
if (probe) mountProbe(probe)

const readout = document.querySelector<HTMLElement>('#readout')
if (readout) renderReadout(readout)
