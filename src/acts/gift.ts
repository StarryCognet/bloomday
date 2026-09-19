/**
 * 礼物盒幕 —— 全程唯一一次"她做了一件事"。
 *
 * 为什么要有它：从开屏到图片，她一直只能滚，全程被动。这一幕给她一个
 * 明确的动作（点盒子），点了有即时反馈（盖子飞开 + 彩纸炸开 + 换一句话）。
 */
import gsap from 'gsap'
import { SITE } from '../site.config'
import { canvasPalette } from '../tokens'
import { EASE, skipMotion } from '../motion'
import type { ActDefinition, ActState } from '../motion/director'

interface Confetti {
  x: number
  y: number
  vx: number
  vy: number
  rot: number
  vrot: number
  w: number
  h: number
  color: string
  life: number
}

export function createGift(el: HTMLElement): ActDefinition {
  el.innerHTML = `
    <div class="gift">
      <canvas class="gift__cv" id="gift-cv"></canvas>
      <p class="gift__label t-label">${SITE.copy.gift.label}</p>
      <button class="gift__box" id="gift-box" type="button" aria-label="打开礼物">
        <span class="gift__lid"></span>
        <span class="gift__body"></span>
        <span class="gift__ribbon"></span>
      </button>
      <p class="gift__line t-body" id="gift-line">${SITE.copy.gift.line}</p>
      <p class="gift__after t-h2" id="gift-after">${SITE.copy.gift.after}</p>
    </div>
  `

  const canvas = el.querySelector<HTMLCanvasElement>('#gift-cv')!
  const boxEl = el.querySelector<HTMLElement>('#gift-box')!
  const lidEl = el.querySelector<HTMLElement>('.gift__lid')!
  const lineEl = el.querySelector<HTMLElement>('#gift-line')!
  const afterEl = el.querySelector<HTMLElement>('#gift-after')!
  const ctxMaybe = canvas.getContext('2d')

  const palette = canvasPalette()
  const COLORS = [palette.cyan, palette.mid, palette.white, palette.midLight]

  const bits: Confetti[] = []
  let cssW = 0
  let cssH = 0
  let last = 0
  let opened = 0
  let active = false

  function resize(): void {
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    cssW = canvas.clientWidth || window.innerWidth
    cssH = canvas.clientHeight || window.innerHeight
    canvas.width = Math.round(cssW * dpr)
    canvas.height = Math.round(cssH * dpr)
    const c = ctxMaybe
    if (c) c.setTransform(dpr, 0, 0, dpr, 0, 0)
  }

  function burst(): void {
    const cx = cssW / 2
    const cy = cssH * 0.5
    const n = skipMotion() ? 0 : 120
    for (let i = 0; i < n; i++) {
      const ang = Math.random() * Math.PI * 2
      const speed = 180 + Math.random() * 520
      bits.push({
        x: cx,
        y: cy,
        vx: Math.cos(ang) * speed,
        vy: Math.sin(ang) * speed - 220,
        rot: Math.random() * Math.PI,
        vrot: (Math.random() - 0.5) * 14,
        w: 5 + Math.random() * 9,
        h: 9 + Math.random() * 14,
        color: COLORS[i % COLORS.length] ?? palette.cyan,
        life: 1.6 + Math.random() * 1.2,
      })
    }
  }

  function frame(now: number): void {
    const dt = last ? Math.min((now - last) / 1000, 0.05) : 0
    last = now
    requestAnimationFrame(frame)
    const c = ctxMaybe
    if (!c || !active) return
    c.clearRect(0, 0, cssW, cssH)
    for (let i = bits.length - 1; i >= 0; i--) {
      const b = bits[i]!
      b.life -= dt
      if (b.life <= 0) {
        bits.splice(i, 1)
        continue
      }
      b.vy += 760 * dt
      b.vx *= 1 - 1.4 * dt
      b.x += b.vx * dt
      b.y += b.vy * dt
      b.rot += b.vrot * dt
      c.save()
      c.translate(b.x, b.y)
      c.rotate(b.rot)
      c.globalAlpha = Math.min(1, b.life)
      c.fillStyle = b.color
      c.fillRect(-b.w / 2, -b.h / 2, b.w, b.h)
      c.restore()
    }
  }

  function open(): void {
    if (!active) return
    opened++
    burst()
    if (skipMotion()) {
      gsap.set(lidEl, { y: -160, rotate: -24 })
      gsap.set(lineEl, { opacity: 0 })
      gsap.set(afterEl, { opacity: 1 })
      return
    }
    gsap.to(lidEl, { y: -180, rotate: -26, duration: 0.7, ease: EASE.pop })
    gsap.to(boxEl, { scale: 1.04, duration: 0.18, yoyo: true, repeat: 1, ease: EASE.drift })
    gsap.to(lineEl, { opacity: 0, y: -10, duration: 0.35, ease: EASE.sink })
    gsap.fromTo(
      afterEl,
      { opacity: 0, y: 16 },
      { opacity: 1, y: 0, duration: 0.55, delay: 0.28, ease: EASE.drift, clearProps: 'transform' },
    )
  }

  boxEl.addEventListener('click', open)

  function setState(_node: HTMLElement, state: ActState): void {
    active = state === 'active'
    if (state === 'past') gsap.set(el, { opacity: 0.25 })
    else if (state === 'future') gsap.set(el, { opacity: 0 })
    else gsap.set(el, { opacity: 1, clearProps: 'opacity' })
  }

  function enter(): gsap.core.Timeline | void {
    if (skipMotion()) return
    return gsap.timeline().fromTo(
      boxEl,
      { opacity: 0, scale: 0.86 },
      { opacity: 1, scale: 1, duration: 0.6, ease: EASE.pop, clearProps: 'transform' },
    )
  }

  resize()
  window.addEventListener('resize', resize)
  requestAnimationFrame(frame)

  // 自己观察视口：本站各幕都是自管状态，没有中心导演驱动
  const io = new IntersectionObserver(
    (entries) => {
      const e = entries[0]
      if (e) setState(el, e.isIntersecting && e.intersectionRatio >= 0.3 ? 'active' : 'future')
    },
    { threshold: [0, 0.3] },
  )
  io.observe(el)


  ;(window as unknown as { __gift?: () => unknown }).__gift = () => ({
    opened,
    bits: bits.length,
    active,
    summary: `礼物盒 · 打开 ${opened} 次 · 彩纸 ${bits.length} 片 · 当前幕=${active}`,
  })

  return { id: 'gift', el, setState, enter }
}
