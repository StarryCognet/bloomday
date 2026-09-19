/**
 * 生日主视觉幕 —— 日期 9.19 与年龄 12 作为画面主体，P3 式斜切拼贴。
 *
 * 返回一个 ActDefinition（id/el/setState/enter/leave），形状与
 * src/motion/director.ts 的注册契约一致 —— 现在由 app.ts 直接调用，
 * 幕数变多时可直接 register 进总控，不需要改这个文件。
 */
import gsap from 'gsap'
import { EASE, skipMotion } from '../motion'
import type { ActDefinition, ActState } from '../motion/director'
import { SITE } from '../site.config'

/** 内容全部来自 src/site.config.ts */
const MV = {
  eyebrow: SITE.copy.mv.eyebrow,
  date: SITE.dateLabel,
  age: String(SITE.age),
  ageUnit: SITE.copy.mv.ageUnit,
  title: SITE.copy.mv.title,
}

/* ── 自检钩子：给验证工具读实际字号与 WCAG 对比度 ──────────────
   "一眼可辨"不能只靠嘴说，得能算出数字。 */
interface MvReport {
  dateFontPx: number
  ageFontPx: number
  titleFontPx: number
  dateContrast: number
  ageContrast: number
  /** 数字盒子的水平范围（视口坐标），用于证明没出画 */
  dateLeft: number
  dateRight: number
  dateTextW: number
  ageTextW: number
  dateFits: boolean
  ageFits: boolean
  overflowX: boolean
}

declare global {
  interface Window {
    __mv?: MvReport
  }
}

function parseRgb(color: string): [number, number, number] {
  const m = color.match(/rgba?\(([^)]+)\)/)
  const p = (m?.[1] ?? '0,0,0').split(',').map((v) => parseFloat(v))
  return [p[0] ?? 0, p[1] ?? 0, p[2] ?? 0]
}

function luminance([r, g, b]: [number, number, number]): number {
  const f = (c: number): number => {
    const s = c / 255
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
  }
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
}

function contrast(a: string, b: string): number {
  const la = luminance(parseRgb(a))
  const lb = luminance(parseRgb(b))
  const hi = Math.max(la, lb)
  const lo = Math.min(la, lb)
  return (hi + 0.05) / (lo + 0.05)
}

/** 数字背后的实际衬底色。
    先看元素自己的 ::before —— 拼贴块是伪元素，只走祖先链会漏掉它，
    那样算出来的对比度是相对页面底色、不是数字真正的衬底（假的漂亮数字）。 */
function backdropOf(el: HTMLElement): string {
  const isTransparent = (c: string): boolean => c === '' || c === 'transparent' || /,\s*0\)$/.test(c)
  const own = getComputedStyle(el, '::before').backgroundColor
  if (!isTransparent(own)) return own
  let node: HTMLElement | null = el.parentElement
  while (node) {
    const bg = getComputedStyle(node).backgroundColor
    if (!isTransparent(bg)) return bg
    node = node.parentElement
  }
  // 兜底也走 token，不写死颜色
  return getComputedStyle(document.documentElement).getPropertyValue('--c-deep').trim()
}

export function createMainVisual(el: HTMLElement): ActDefinition {
  el.innerHTML = `
    <div class="mv" id="mv">
      <div class="mv__collage">
        <span class="mv__slab mv__slab--a"></span>
        <span class="mv__slab mv__slab--b"></span>
        <span class="mv__slab mv__slab--c"></span>
        <span class="mv__bg"></span>
      </div>
      <div class="mv__grid" id="mv-grid">
        <p class="mv__eyebrow t-label">${MV.eyebrow}</p>
        <div class="mv__date t-hero" id="mv-date">${MV.date}</div>
        <p class="mv__age">
          <span class="mv__age-num t-hero" id="mv-age">${MV.age}</span>
          <span class="mv__age-unit">${MV.ageUnit}</span>
        </p>
        <p class="mv__title t-h1" id="mv-title">${MV.title}</p>
      </div>
    </div>
  `

  const root = el.querySelector<HTMLElement>('.mv')
  void root
  const dateEl = el.querySelector<HTMLElement>('#mv-date')!
  const ageEl = el.querySelector<HTMLElement>('#mv-age')!
  const titleEl = el.querySelector<HTMLElement>('#mv-title')!


  function report(): void {
    const fontOf = (n: HTMLElement): number => parseFloat(getComputedStyle(n).fontSize)
    /** 文字本身的宽度：用 Range 量。
        不能用 scrollWidth —— 它会把装饰性 ::before 色块向右溢出的部分
        也算成"内容超宽"，量的是色块不是数字（实测就是这样误报 fits=false）。 */
    const textWidth = (n: HTMLElement): number => {
      const range = document.createRange()
      range.selectNodeContents(n)
      return range.getBoundingClientRect().width
    }
    const fits = (n: HTMLElement): boolean => {
      const r = n.getBoundingClientRect()
      const withinViewport = r.left >= -0.5 && r.right <= window.innerWidth + 0.5
      return withinViewport && textWidth(n) <= n.clientWidth + 1
    }
    const dBack = backdropOf(dateEl)
    const aBack = backdropOf(ageEl)
    const dRect = dateEl.getBoundingClientRect()
    window.__mv = {
      dateFontPx: Math.round(fontOf(dateEl)),
      ageFontPx: Math.round(fontOf(ageEl)),
      titleFontPx: Math.round(fontOf(titleEl)),
      dateContrast: Number(contrast(getComputedStyle(dateEl).color, dBack).toFixed(2)),
      ageContrast: Number(contrast(getComputedStyle(ageEl).color, aBack).toFixed(2)),
      dateLeft: Math.round(dRect.left),
      dateRight: Math.round(dRect.right),
      dateTextW: Math.round(textWidth(dateEl)),
      ageTextW: Math.round(textWidth(ageEl)),
      dateFits: fits(dateEl),
      ageFits: fits(ageEl),
      overflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    }
  }

  function setState(node: HTMLElement, state: ActState): void {
    const mv = node.querySelector<HTMLElement>('.mv')
    if (!mv) return
    if (state === 'active') {
      gsap.set(mv, { opacity: 1, y: 0, clearProps: 'transform,opacity' })
    } else if (state === 'past') {
      gsap.set(mv, { opacity: 0.2, y: -40 })
    } else {
      gsap.set(mv, { opacity: 0, y: 40 })
    }
    gsap.set(['.mv__slab', '.mv__bg'], { clearProps: 'transform,opacity' })
    report()
  }

  // 初始就是"这一幕已就位"：它一直在封印底下等着被擦出来，
  // 点击后不需要先变透明再出现（那会露出一段底色，观感就是"卡了一下"）
  setState(el, 'active')
  window.addEventListener('resize', report)

  return {
    id: 'main-visual',
    el,
    setState,
    enter: (node) => {
      // 强度 0：直接落终态
      if (skipMotion()) {
        setState(node, 'active')
        return gsap.timeline()
      }
      // 文字的所有权已交给滚动显现（见 app.ts 的 reveals）

      const tl = gsap.timeline()
      // 斜切拼贴块先扫开，文字随后砸入 —— 三块不同角度，构成 P3 的拼贴感
      tl.fromTo(
        '.mv__slab',
        { scaleX: 0 },
        { scaleX: 1, duration: 0.7, ease: EASE.tear, stagger: 0.09, clearProps: 'transform' },
        0,
      )
      tl.fromTo('.mv__bg', { opacity: 0 }, { opacity: 1, duration: 0.6, ease: EASE.drift }, 0)
      // 文字不在这里演 —— 交给滚动显现（一个元素只能有一个动画主人）
      tl.eventCallback('onComplete', report)
      return tl
    },
    leave: (node, target) => {
      const mv = node.querySelector<HTMLElement>('.mv')
      if (!mv) return
      const to = target === 'past' ? { opacity: 0.2, y: -40 } : { opacity: 0, y: 40 }
      return gsap.timeline().to(mv, { ...to, duration: 0.5, ease: EASE.sink })
    },
  }
}
