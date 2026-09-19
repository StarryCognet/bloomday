/**
 * 角色与照片幕 —— 横向滑入 + 分层景深 + 拍立得式标注。
 *
 * 【为什么必须有降级路径】哥哥的素材随时可能没到位 / 文件名对不上 / 格式不对。
 * 每张卡都有两条路：正常显示图片，或走纯装饰占位（斜切色块 + 网点 + 角色名）。
 * 走哪条由 <img> 自己的 load/error 事件决定，不靠人保证。
 *
 * 【为什么结构上不会盖字】分层景深用 transform 缩放，且**只缩不放**
 * （scale = 1 - 距离×0.12，中心为 1），transform 不参与布局，
 * 所以任何一张卡都不可能溢出自己的布局盒去压邻卡。audit 再用几何相交实测一遍。
 */
import gsap from 'gsap'
import { EASE, halftoneBreathe, skipMotion, slashWipe } from '../motion'
import type { ActDefinition, ActState } from '../motion/director'
import { SITE } from '../site.config'

/** 内容与素材清单一律来自 src/site.config.ts */
const GALLERY = {
  eyebrow: SITE.copy.gallery.eyebrow,
  lead: SITE.copy.gallery.lead,
  hint: SITE.copy.gallery.hint,
  items: SITE.gallery,
}

interface GalReport {
  items: number
  loaded: number
  fallback: number
  /** 真正意义上的裂图：complete 且 naturalWidth=0 且没被隐藏 —— 必须为 0 */
  brokenVisible: number
  brokenDetail: string[]
  /** 累积布局偏移：图片加载不该把页面顶来顶去 */
  cls: number
  frameHeightBefore: number
  frameHeightAfter: number
  swipes: number
  directions: string[]
  /** 每次停留时逐卡 z-index，须由中心向外单调递减 */
  zOrders: number[][]
  zMonotonic: boolean[]
  /** 图片框 × 文字标注 的几何相交次数 —— 必须为 0 */
  textOverlaps: number
  overlapDetail: string[]
  summary: string
}

declare global {
  interface Window {
    __gallery?: GalReport
  }
}

export function createGallery(el: HTMLElement): ActDefinition {
  el.innerHTML = `
    <div class="gal" id="gal">
      <header class="gal__head">
        <p class="gal__eyebrow t-label">${GALLERY.eyebrow}</p>
        <p class="gal__lead">${GALLERY.lead}</p>
        <p class="gal__hint t-label">${GALLERY.hint}</p>
      </header>
      <div class="gal__track" id="gal-track" data-lenis-prevent>
        ${GALLERY.items
          .map(
            (it, i) => `<article class="gcard" data-g="c${i + 1}">
          <div class="gcard__frame" data-frame>
            <img class="gcard__img" src="${it.src}" alt="${it.name}" loading="lazy" decoding="async" />
            <span class="gcard__lash"></span>
            <span class="gcard__halftone"></span>
            <div class="gcard__fallback">
              <span class="gcard__fb-slash"></span>
              <span class="gcard__fb-name">${it.name}</span>
            </div>
          </div>
          <div class="gcard__tag">
            <span class="gcard__tag-k t-label">${it.tag}</span>
            <span class="gcard__tag-name">${it.name}</span>
            <span class="gcard__tag-note">${it.note}</span>
          </div>
        </article>`,
          )
          .join('')}
      </div>
      <div class="gal__dots">
        ${GALLERY.items.map((_, i) => `<span class="gal__dot${i === 0 ? ' is-on' : ''}"></span>`).join('')}
      </div>
    </div>
  `

  const track = el.querySelector<HTMLElement>('#gal-track')!
  const cards = Array.from(el.querySelectorAll<HTMLElement>('.gcard'))
  const dots = Array.from(el.querySelectorAll<HTMLElement>('.gal__dot'))
  const frames = Array.from(el.querySelectorAll<HTMLElement>('[data-frame]'))

  /* ── CLS：图片加载不该把页面顶来顶去 ─────────────────── */
  let cls = 0
  try {
    new PerformanceObserver((list) => {
      for (const e of list.getEntries() as Array<PerformanceEntry & { value: number; hadRecentInput: boolean }>) {
        if (!e.hadRecentInput) cls += e.value
      }
    }).observe({ type: 'layout-shift', buffered: true })
  } catch {
    cls = -1 // 环境不支持就如实标 -1，不假装 0
  }

  // 量布局盒高度要用 offsetHeight：getBoundingClientRect 包含 transform，
  // 会把"故意的景深缩放"误报成布局跳动（实测最大差 44 就是这么来的）。
  const frameHeightBefore = frames.map((f) => f.offsetHeight)

  /* ── 图片两条路：正常显示 / 降级占位 ────────────────── */
  const loaded = new Set<string>()
  const broken: string[] = []
  frames.forEach((frame, i) => {
    const img = frame.querySelector<HTMLImageElement>('.gcard__img')!
    const id = `c${i + 1}`
    const ok = (): void => {
      loaded.add(id)
      frame.classList.remove('is-fallback')
      frame.classList.add('is-loaded')
    }
    const fail = (): void => {
      broken.push(`${id} ← ${img.getAttribute('src') ?? ''}`)
      frame.classList.remove('is-loaded')
      frame.classList.add('is-fallback')
    }
    img.addEventListener('load', ok)
    img.addEventListener('error', fail)
    // 已缓存完成的情况事件不会再触发，直接看状态
    if (img.complete) {
      if (img.naturalWidth > 0) ok()
      else fail()
    }
  })

  /* ── 横向滑入 + 分层景深 ────────────────────────────── */
  let raf = 0
  function layout(): void {
    raf = 0
    const tr = track.getBoundingClientRect()
    const center = tr.left + tr.width / 2
    let nearest = 0
    let bestD = Number.POSITIVE_INFINITY
    cards.forEach((card, i) => {
      const r = card.getBoundingClientRect()
      const d = Math.min(1, Math.abs(r.left + r.width / 2 - center) / (tr.width * 0.6))
      // 只缩不放：任何一张卡都不会超出自己的布局盒，结构上就不可能盖住邻卡
      gsap.set(card, { scale: 1 - d * 0.12, opacity: 1 - d * 0.42, zIndex: Math.round((1 - d) * 10) })
      if (d < bestD) {
        bestD = d
        nearest = i
      }
    })
    dots.forEach((dot, i) => dot.classList.toggle('is-on', i === nearest))
  }
  const onScroll = (): void => {
    if (!raf) raf = requestAnimationFrame(layout)
  }
  track.addEventListener('scroll', onScroll, { passive: true })
  window.addEventListener('resize', onScroll)

  /* ── 确定性落状态 ───────────────────────────────────── */
  function setState(node: HTMLElement, state: ActState): void {
    const gal = node.querySelector<HTMLElement>('.gal')
    if (!gal) return
    if (state === 'active') gsap.set(gal, { opacity: 1, y: 0, clearProps: 'transform,opacity' })
    else if (state === 'past') gsap.set(gal, { opacity: 0.2, y: -40 })
    else gsap.set(gal, { opacity: 0, y: 40 })
    layout()
  }

  /* ── 进场：斜切撕入 + 逐卡横向滑入 ──────────────────── */
  function enterImpl(node: HTMLElement): gsap.core.Timeline {
    // 强度 0：直接落终态
    if (skipMotion()) {
      setState(node, 'active')
      return gsap.timeline()
    }
    const gal = node.querySelector<HTMLElement>('.gal')
    const tl = gsap.timeline()
    if (gal) tl.add(slashWipe(gal, { direction: 'right', duration: 0.8, intensity: 0.8 }), 0)
    tl.fromTo(
      cards,
      { x: 60, opacity: 0 },
      { x: 0, opacity: 1, duration: 0.65, ease: EASE.drift, stagger: 0.09, clearProps: 'transform,opacity' },
      0.12,
    )
    tl.call(layout)
    const ht = el.querySelector<HTMLElement>('.gcard__halftone')
    if (ht) halftoneBreathe(ht, { duration: 2.6, intensity: 0.35, repeat: -1 })
    return tl
  }

  /* 滚到这一幕才播横向滑入 —— 否则她在上一幕时动画已经放完了，白做 */
  let played = false
  const actObserver = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (e.isIntersecting && e.intersectionRatio >= 0.3 && !played) {
          played = true
          enterImpl(el)
          actObserver.disconnect()
        }
      }
    },
    { threshold: [0, 0.3] },
  )
  actObserver.observe(el)

  /* ── 审计 ───────────────────────────────────────────── */
  const frame = (): Promise<void> => new Promise((r) => setTimeout(r, 420))

  function zOrder(): number[] {
    return cards.map((c) => Number(getComputedStyle(c).zIndex) || 0)
  }

  /** z 由"最近的卡"向两侧单调不增，才算层次一致 */
  function zIsMonotonic(row: number[]): boolean {
    if (row.length === 0) return false
    let peak = 0
    row.forEach((z, i) => {
      if (z > (row[peak] ?? 0)) peak = i
    })
    for (let i = peak; i > 0; i--) if ((row[i - 1] ?? 0) > (row[i] ?? 0)) return false
    for (let i = peak; i < row.length - 1; i++) if ((row[i + 1] ?? 0) > (row[i] ?? 0)) return false
    return true
  }

  function measureOverlaps(): { count: number; detail: string[] } {
    const detail: string[] = []
    let count = 0
    const frameRects = frames.map((f) => f.getBoundingClientRect())
    const tagRects = cards.map((c) => {
      const t = c.querySelector<HTMLElement>('.gcard__tag')
      return t ? t.getBoundingClientRect() : new DOMRect()
    })
    for (let i = 0; i < cards.length; i++) {
      for (let j = 0; j < cards.length; j++) {
        if (i === j) continue
        const a = frameRects[i]!
        const b = tagRects[j]!
        const hit = !(a.right <= b.left || a.left >= b.right || a.bottom <= b.top || a.top >= b.bottom)
        if (hit) {
          count++
          detail.push(`#${i} 图片框 压 #${j} 文字标注`)
        }
      }
    }
    return { count, detail }
  }

  async function swipeTo(i: number): Promise<void> {
    const card = cards[i]
    if (!card) return
    const tr = track.getBoundingClientRect()
    const r = card.getBoundingClientRect()
    track.scrollTo({ left: track.scrollLeft + (r.left + r.width / 2 - (tr.left + tr.width / 2)), behavior: 'auto' })
    await frame()
  }

  async function runAudit(): Promise<void> {
    const directions: string[] = []
    const zOrders: number[][] = []
    let swipes = 0
    for (const target of [1, 2, 3, 2, 1, 0]) {
      const before = track.scrollLeft
      await swipeTo(target)
      const after = track.scrollLeft
      const dir = after > before + 1 ? 'right' : after < before - 1 ? 'left' : 'still'
      directions.push(dir)
      zOrders.push(zOrder())
      if (dir !== 'still') swipes++
    }
    await swipeTo(0)

    const ov = measureOverlaps()
    const frameHeightNow = frames.map((f) => f.offsetHeight)
    const visibleBroken = Array.from(el.querySelectorAll<HTMLImageElement>('.gcard__img')).filter(
      (img) => img.complete && img.naturalWidth === 0 && getComputedStyle(img).display !== 'none',
    )
    const zMonotonic = zOrders.map(zIsMonotonic)
    const maxDelta = Math.max(...frameHeightBefore.map((h, i) => Math.abs(h - (frameHeightNow[i] ?? h))), 0)

    window.__gallery = {
      items: cards.length,
      loaded: loaded.size,
      fallback: cards.length - loaded.size,
      brokenVisible: visibleBroken.length,
      brokenDetail: broken,
      cls: Number(cls.toFixed(4)),
      frameHeightBefore: frameHeightBefore[0] ?? 0,
      frameHeightAfter: frameHeightNow[0] ?? 0,
      swipes,
      directions,
      zOrders,
      zMonotonic,
      textOverlaps: ov.count,
      overlapDetail: ov.detail,
      summary:
        `素材 ${cards.length} · 已加载 ${loaded.size} · 降级 ${cards.length - loaded.size} · ` +
        `可见裂图 ${visibleBroken.length} · CLS ${cls.toFixed(4)} · ` +
        `图片框高 ${frameHeightBefore[0] ?? 0}→${frameHeightNow[0] ?? 0}（最大差 ${maxDelta}） · ` +
        `横滑 ${swipes} 次 方向[${directions.join(',')}] · 层次单调[${zMonotonic.map((v) => (v ? '✓' : '✗')).join('')}] · ` +
        `盖字 ${ov.count} 次${ov.detail.length ? '：' + ov.detail.join('；') : ''}`,
    }
  }

  if (new URLSearchParams(location.search).get('gal') === '1') {
    void runAudit().then(() => {
      document.title = 'gallery-audit-done'
    })
  }
  ;(window as unknown as { __galleryRun?: () => Promise<void> }).__galleryRun = runAudit

  return {
    id: 'gallery',
    el,
    setState,
    enter: enterImpl,
    leave: (node, target) => {
      const gal = node.querySelector<HTMLElement>('.gal')
      if (!gal) return
      const to = target === 'past' ? { opacity: 0.2, y: -40 } : { opacity: 0, y: 40 }
      return gsap.timeline().to(gal, { ...to, duration: 0.5, ease: EASE.sink })
    },
  }
}
