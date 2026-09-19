/**
 * 祝福文案幕 —— 逐段入场，每段一种动效，滚动推进。
 *
 * 【可读性的结构性保证】文字层 z-index:2，装饰层 z-index:0 且 pointer-events:none，
 * 所以装饰在结构上不可能压住字。但"结构上不会"不等于"实际可读"——
 * 装饰是半透明的，字后面叠了色块之后对比度会掉。所以本模块带一个
 * auditAll()：把每条文字背后叠着的装饰按不透明度**合成出真实衬底色**，
 * 再算 WCAG 对比度。（不用 elementFromPoint：它会跳过 pointer-events:none，
 * 而装饰层正是 none，用它测永远测不出遮挡。）
 */
import gsap from 'gsap'
import {
  EASE,
  charSlam,
  halftoneBreathe,
  resetPrimitives,
  ripple,
  skipMotion,
  slashWipe,
  type Direction,
} from '../motion'
import type { ActDefinition, ActState } from '../motion/director'
import { SITE } from '../site.config'

type Motion = 'slam' | 'slamSlow' | 'wipe' | 'wipeSlam' | 'ripple' | 'lyric' | 'type'
type Deco = 'slash' | 'halftone' | 'ring'

interface BlockSpec {
  lines: string[]
  punch?: boolean
  motion: Motion
  direction: Direction
  /** 逐字间隔 */
  stagger?: number
  deco?: Deco
}

/** 文案来自配置源 */
const HEAD = { eyebrow: SITE.copy.blessing.eyebrow, lead: SITE.copy.blessing.lead }

/** 每段用哪种动效 —— 这是实现细节，留在组件里；按段序循环取用 */
const MOTIONS: Array<Omit<BlockSpec, 'lines'>> = [
  { motion: 'slam', direction: 'up', stagger: 0.05 },
  { motion: 'wipe', direction: 'right' },
  { motion: 'slam', direction: 'right', stagger: 0.07, deco: 'halftone', punch: true },
  { motion: 'ripple', direction: 'up', deco: 'ring' },
  { motion: 'slamSlow', direction: 'left', stagger: 0.13 },
  { motion: 'wipeSlam', direction: 'left', deco: 'halftone' },
  { motion: 'slam', direction: 'up', stagger: 0.09, deco: 'slash', punch: true },
]

/** 段数由文案决定：哥哥加段/删段都不会让动效错位（按段序取模循环） */
/** 指定某几段换一种呈现方式（0 起）。改这里就能换段落。 */
const STYLE_OVERRIDE: Record<number, Motion> = {
  2: 'lyric', // 「歌里唱『好好吃…』」—— 这句本来就是歌，做成歌词卡
  3: 'type', // 「以后的事我也想了」—— 情绪最重的一段，打字机更有停顿感
}

const BLOCKS: BlockSpec[] = SITE.copy.blessing.blocks.map((lines, i) => ({
  ...(MOTIONS[i % MOTIONS.length] as Omit<BlockSpec, 'lines'>),
  ...(STYLE_OVERRIDE[i] ? { motion: STYLE_OVERRIDE[i] } : {}),
  lines: [...lines],
}))

/* ── 自检报告 ───────────────────────────────────────────── */
interface LineReport {
  text: string
  chars: number
  clipped: boolean
  inViewportX: boolean
  backdrop: string
  contrast: number
}
interface BlockReport {
  id: string
  motion: string
  direction: string
  stagger: string | null
  deco: string | null
  /** 测量时刻装饰层的实际状态 —— 用来证明"装饰确实叠在字后面"，不是想当然 */
  decoOpacity: number | null
  decoOverlap: boolean | null
  lineCount: number
  chars: number
  lines: LineReport[]
}
interface CopyAudit {
  blocks: BlockReport[]
  allClipped: boolean
  allInX: boolean
  minContrast: number
  /** 快速划到底再回滚之后：各段字符数与行数是否与之前完全一致（不错行/不重影） */
  relineStable: boolean
  detail: string
  /** 一行人类可读摘要 —— 给验证工具读，省得跟命令行引号搏斗 */
  summary: string
}

declare global {
  interface Window {
    __copyAudit?: CopyAudit
  }
}

/* ── 颜色工具 ───────────────────────────────────────────── */
type Rgba = [number, number, number, number]

function parseRgb(c: string): Rgba {
  const m = c.match(/rgba?\(([^)]+)\)/)
  const p = (m?.[1] ?? '0,0,0,0').split(',').map((v) => parseFloat(v))
  return [p[0] ?? 0, p[1] ?? 0, p[2] ?? 0, p[3] ?? 1]
}
function lum(c: Rgba): number {
  const f = (v: number): number => {
    const s = v / 255
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
  }
  return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2])
}
function contrastOf(a: Rgba, b: Rgba): number {
  const la = lum(a)
  const lb = lum(b)
  const hi = Math.max(la, lb)
  const lo = Math.min(la, lb)
  return (hi + 0.05) / (lo + 0.05)
}
/** 把 fg 按 alpha 叠在 bg 上 */
function over(fg: Rgba, bg: Rgba): Rgba {
  const a = fg[3]
  return [
    fg[0] * a + bg[0] * (1 - a),
    fg[1] * a + bg[1] * (1 - a),
    fg[2] * a + bg[2] * (1 - a),
    1,
  ]
}
function tokenRgba(name: string): Rgba {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  return v ? parseRgb(v) : [0, 0, 0, 1]
}

export function createBlessing(el: HTMLElement): ActDefinition {
  el.innerHTML = `
    <div class="bs" id="bs">
      <header class="bs__head">
        <p class="bs__eyebrow t-label">${HEAD.eyebrow}</p>
        <p class="bs__lead">${HEAD.lead}</p>
      </header>
      ${BLOCKS.map(
        (b, i) =>
          `<section class="blk${b.punch ? ' blk--punch' : ''}${
            STYLE_OVERRIDE[i] ? ` blk--${STYLE_OVERRIDE[i]}` : ''
          }" data-blk="b${i + 1}">
          ${b.deco ? `<span class="blk__deco blk__deco--${b.deco}"></span>` : ''}
          <div class="blk__lines">
            ${b.lines.map((l) => `<p class="blk__line">${l}</p>`).join('')}
          </div>
        </section>`,
      ).join('')}
      <div class="bs__tail"></div>
    </div>
  `

  const blockEls = Array.from(el.querySelectorAll<HTMLElement>('.blk'))
  const states = new Map<string, ActState>()
  blockEls.forEach((b) => states.set(b.dataset.blk ?? '', 'future'))

  function lines(blk: HTMLElement): HTMLElement[] {
    return Array.from(blk.querySelectorAll<HTMLElement>('.blk__line'))
  }

  /** 确定性落状态：幂等、无动画。回滚/跳幕全靠它 */
  function setBlockState(blk: HTMLElement, state: ActState): void {
    resetPrimitives(blk)
    const ls = lines(blk)
    const deco = Array.from(blk.querySelectorAll<HTMLElement>('.blk__deco'))
    gsap.killTweensOf([blk, ...ls, ...deco])
    if (state === 'future') {
      gsap.set(ls, { opacity: 0, y: 36 })
      gsap.set(deco, { opacity: 0 })
    } else {
      gsap.set(ls, { opacity: 1, y: 0, clearProps: 'transform,opacity,filter' })
      // 装饰层**不能清 opacity**：它的 CSS 基样式就是 opacity:0（隐藏态），
      // clearProps 会把内联的 1 一起清掉、掉回 0 —— 实测装饰在静止态直接隐形了。
      gsap.set(deco, { opacity: 1, clearProps: 'transform' })
    }
  }

  /** 每段一种动效 —— 配置直接驱动，不在下面写 if-else 大杂烩 */
  function reveal(blk: HTMLElement, spec: BlockSpec): void {
    resetPrimitives(blk)
    // 强度 0：直接落静止态，内容一字不少
    if (skipMotion()) {
      setBlockState(blk, 'active')
      return
    }
    const ls = lines(blk)
    const deco = blk.querySelector<HTMLElement>('.blk__deco')
    gsap.killTweensOf([blk, ...ls, ...(deco ? [deco] : [])])

    const tl = gsap.timeline()
    const fade = { opacity: 1, y: 0, duration: 0.6, ease: EASE.drift, clearProps: 'transform,opacity' }
    if (deco) tl.set(deco, { opacity: 1 }, 0)

    switch (spec.motion) {
      case 'slam':
      case 'slamSlow':
        ls.forEach((line, i) => {
          tl.add(
            charSlam(line, {
              direction: spec.direction,
              duration: spec.motion === 'slamSlow' ? 0.85 : 0.7,
              intensity: 0.75,
              stagger: spec.stagger ?? 0.05,
            }),
            i * 0.12,
          )
        })
        break
      case 'wipe':
        tl.add(slashWipe(blk, { direction: spec.direction, duration: 0.8, intensity: 0.7 }), 0)
        tl.fromTo(ls, { opacity: 0 }, fade, 0.1)
        break
      case 'wipeSlam':
        tl.add(slashWipe(blk, { direction: spec.direction, duration: 0.75, intensity: 0.8 }), 0)
        ls.forEach((line, i) => {
          tl.add(charSlam(line, { direction: 'up', duration: 0.6, intensity: 0.6 }), 0.15 + i * 0.1)
        })
        break
      case 'ripple':
        tl.add(ripple(blk, { intensity: 0.7, rings: 3 }), 0)
        tl.fromTo(ls, { opacity: 0, y: 30 }, fade, 0.12)
        break
      // 歌词卡：逐字依次点亮（步长大，一句被"唱"出来的感觉）
      case 'lyric':
        ls.forEach((line, i) => {
          tl.add(
            charSlam(line, { direction: 'up', duration: 0.55, intensity: 0.45, stagger: 0.085 }),
            i * 0.2,
          )
        })
        break
      // 打字机：逐字显形，位移很小（像是被打出来的，不是被砸出来的）
      case 'type':
        ls.forEach((line, i) => {
          tl.add(
            charSlam(line, { direction: 'up', duration: 0.4, intensity: 0.18, stagger: 0.11 }),
            i * 0.42,
          )
        })
        break
    }

    if (spec.deco === 'halftone' && deco) {
      halftoneBreathe(deco, { duration: 2.2, intensity: 0.4, repeat: -1 })
    }
    tl.eventCallback('onComplete', () => {
      // 动画结束后把字符内联样式清干净，避免叠加滚动留下重影
      ls.forEach((l) => gsap.set(l.querySelectorAll('.mt-char'), { clearProps: 'transform,opacity,filter' }))
    })
  }

  /* 滚动推进：从下方进入才播动效；从上方回滚进来只恢复静止态，不重播 */
  const observer = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        const blk = e.target as HTMLElement
        const id = blk.dataset.blk ?? ''
        const spec = BLOCKS[Number(id.slice(1)) - 1]
        if (!spec) continue
        const st = states.get(id)
        if (e.isIntersecting && e.intersectionRatio >= 0.26) {
          if (st === 'future') {
            reveal(blk, spec)
            states.set(id, 'active')
          } else if (st === 'past') {
            setBlockState(blk, 'active')
            states.set(id, 'active')
          }
        } else if (!e.isIntersecting) {
          const above = e.boundingClientRect.bottom < 0
          setBlockState(blk, above ? 'past' : 'future')
          states.set(id, above ? 'past' : 'future')
        }
      }
    },
    { threshold: [0, 0.26] },
  )
  blockEls.forEach((b) => observer.observe(b))

  /* ── 审计 ─────────────────────────────────────────────── */
  function baseBackdrop(node: HTMLElement): Rgba {
    let cur: HTMLElement | null = node.parentElement
    while (cur) {
      const c = parseRgb(getComputedStyle(cur).backgroundColor)
      if (c[3] > 0.01) return c
      cur = cur.parentElement
    }
    return tokenRgba('--c-deep')
  }

  /** 一个装饰层对衬底的贡献（已折算不透明度）。
      注意两种形态：纯色底看 backgroundColor；半调网点走 background-image，
      只看 backgroundColor 会漏掉它，算出来的对比度就是偏乐观的假数字。 */
  function decoContribution(d: HTMLElement): Rgba | null {
    const cs = getComputedStyle(d)
    const op = parseFloat(cs.opacity || '1')
    if (op <= 0.01) return null
    const bg = parseRgb(cs.backgroundColor)
    if (bg[3] > 0.01) return [bg[0], bg[1], bg[2], bg[3] * op]
    const m = cs.backgroundImage.match(/rgba?\([^)]+\)/)
    if (!m) return null
    const col = parseRgb(m[0])
    const root = getComputedStyle(document.documentElement)
    const dot = parseFloat(root.getPropertyValue('--ht-dot')) || 1.2
    const size = parseFloat(root.getPropertyValue('--ht-size')) || 6
    const coverage = Math.min(1, (Math.PI * dot * dot) / (size * size))
    return [col[0], col[1], col[2], op * coverage]
  }

  /** 把与这条文字几何相交、且排在其下方的装饰层，按不透明度合成进衬底色 */
  function effectiveBackdrop(line: HTMLElement): Rgba {
    let base = baseBackdrop(line)
    const lr = line.getBoundingClientRect()
    const decos = Array.from(line.closest('.blk')?.querySelectorAll<HTMLElement>('.blk__deco') ?? [])
    for (const d of decos) {
      const dr = d.getBoundingClientRect()
      const overlaps = !(dr.right < lr.left || dr.left > lr.right || dr.bottom < lr.top || dr.top > lr.bottom)
      if (!overlaps) continue
      const contrib = decoContribution(d)
      if (contrib) base = over(contrib, base)
    }
    return base
  }

  function measure(blk: HTMLElement, spec: BlockSpec, id: string): BlockReport {
    const ls = lines(blk)
    const decoEl = blk.querySelector<HTMLElement>('.blk__deco')
    let decoOpacity: number | null = null
    let decoOverlap: boolean | null = null
    if (decoEl && ls[0]) {
      decoOpacity = Number(getComputedStyle(decoEl).opacity)
      const dr = decoEl.getBoundingClientRect()
      const lr = ls[0].getBoundingClientRect()
      decoOverlap = !(dr.right < lr.left || dr.left > lr.right || dr.bottom < lr.top || dr.top > lr.bottom)
    }
    const lineReports: LineReport[] = ls.map((l) => {
      const r = l.getBoundingClientRect()
      const back = effectiveBackdrop(l)
      return {
        text: (l.textContent ?? '').slice(0, 12),
        chars: (l.textContent ?? '').replace(/\s/g, '').length,
        clipped: l.scrollHeight > l.clientHeight + 1,
        inViewportX: r.left >= -0.5 && r.right <= window.innerWidth + 0.5,
        backdrop: `rgb(${back.map((v) => Math.round(v)).join(',')})`,
        contrast: Number(contrastOf(parseRgb(getComputedStyle(l).color), back).toFixed(2)),
      }
    })
    return {
      id,
      motion: spec.motion,
      direction: spec.direction,
      stagger: spec.stagger !== undefined ? String(spec.stagger) : null,
      deco: spec.deco ?? null,
      decoOpacity,
      decoOverlap,
      lineCount: ls.length,
      chars: lineReports.reduce((n, l) => n + l.chars, 0),
      lines: lineReports,
    }
  }

  const frame = (): Promise<void> => new Promise((r) => requestAnimationFrame(() => r()))

  async function auditAll(): Promise<void> {
    const blocks: BlockReport[] = []
    for (let i = 0; i < blockEls.length; i++) {
      const blk = blockEls[i]!
      const spec = BLOCKS[i]!
      blk.scrollIntoView({ block: 'center', behavior: 'auto' })
      // 让进场动效跑完再看——审计的是她实际读到的静止画面
      await new Promise((r) => setTimeout(r, 1700))
      await frame()
      blocks.push(measure(blk, spec, blk.dataset.blk ?? ''))
    }

    const before = blocks.map((b) => `${b.id}:${b.lineCount}:${b.chars}`).join('|')

    // 快速划到底再回滚
    const maxY = document.documentElement.scrollHeight - window.innerHeight
    for (let pass = 0; pass < 3; pass++) {
      window.scrollTo(0, maxY)
      await frame()
      window.scrollTo(0, 0)
      await frame()
    }
    await new Promise((r) => setTimeout(r, 900))

    const after = blockEls
      .map((b) => `${b.dataset.blk}:${lines(b).length}:${lines(b).reduce((n, l) => n + (l.textContent ?? '').replace(/\s/g, '').length, 0)}`)
      .join('|')

    const allClipped = blocks.every((b) => b.lines.every((l) => !l.clipped))
    const allInX = blocks.every((b) => b.lines.every((l) => l.inViewportX))
    const minContrast = Math.min(...blocks.flatMap((b) => b.lines.map((l) => l.contrast)))
    const relineStable = before === after

    window.__copyAudit = {
      blocks,
      allClipped,
      allInX,
      minContrast: Number(minContrast.toFixed(2)),
      relineStable,
      detail: relineStable ? '回滚前后各段行数与字符数完全一致' : `回滚前后不一致：\n  before=${before}\n  after=${after}`,
      summary: blocks
        .map((b) => {
          const cfg = `${b.motion}/${b.direction}${b.stagger ? '/st' + b.stagger : ''}${b.deco ? '/' + b.deco : ''}`
          const deco = b.deco ? `decoOp=${b.decoOpacity ?? '-'} overlap=${b.decoOverlap ?? '-'}` : 'noDeco'
          const worst = Math.min(...b.lines.map((l) => l.contrast))
          return `${b.id} ${cfg} ${deco} 行${b.lineCount} 字${b.chars} 衬底${b.lines[0]?.backdrop ?? '-'} 对比${worst}`
        })
        .join(' | '),
    }
    window.scrollTo(0, 0)
  }

  const params = new URLSearchParams(location.search)
  if (params.get('audit') === '1') {
    void auditAll().then(() => {
      document.title = 'copy-audit-done'
    })
  }
  ;(window as unknown as { __copyAuditRun?: () => Promise<void> }).__copyAuditRun = auditAll

  return {
    id: 'blessing',
    el,
    setState: (_node, state) => {
      blockEls.forEach((b) => {
        setBlockState(b, state)
        states.set(b.dataset.blk ?? '', state)
      })
    },
    enter: () => {
      // 幕级进场不做全屏擦除（那会盖住文字）；只让首段启动
      const first = blockEls[0]
      if (first && states.get(first.dataset.blk ?? '') === 'future') {
        reveal(first, BLOCKS[0]!)
        states.set(first.dataset.blk ?? '', 'active')
      }
    },
    leave: (node, target) => {
      const bs = node.querySelector<HTMLElement>('.bs')
      if (!bs) return
      const to = target === 'past' ? { opacity: 0.2, y: -40 } : { opacity: 0, y: 40 }
      return gsap.timeline().to(bs, { ...to, duration: 0.5, ease: EASE.sink })
    },
  }
}
