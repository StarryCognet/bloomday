/**
 * 可视化幕 —— 跟着歌跳的一屏纯视觉。
 *
 * 为什么要有它：动线原本是「开屏很炸 → 一大段字 → 图片很炸」，
 * 中间缺一个视觉高点。这一幕不放任何说服性的内容，就是让歌说话。
 *
 * 画面三件：随低频膨胀的核心、圆周频谱、每次能量过峰就炸一圈涟漪。
 * 能量来自 AnalyserNode 的真实频谱，不是随机数。
 */
import gsap from 'gsap'
import { SITE } from '../site.config'
import { canvasPalette } from '../tokens'
import { EASE, allowResident, skipMotion } from '../motion'
import type { ActDefinition, ActState } from '../motion/director'

interface Ring {
  r: number
  alpha: number
}

/** 点出来的火花：有重力、会衰减 */
interface Spark {
  x: number
  y: number
  vx: number
  vy: number
  r: number
  life: number
  max: number
  color: string
}

export function createPulse(el: HTMLElement, getAnalyser: () => AnalyserNode | null): ActDefinition {
  el.innerHTML = `
    <div class="pulse">
      <canvas class="pulse__cv" id="pulse-cv"></canvas>
      <div class="pulse__box">
        <p class="pulse__label t-label">${SITE.copy.pulse.label}</p>
        <p class="pulse__line t-h1">${SITE.copy.pulse.line}</p>
      </div>
    </div>
  `

  const canvas = el.querySelector<HTMLCanvasElement>('#pulse-cv')!
  const box = el.querySelector<HTMLElement>('.pulse__box')!
  const ctxMaybe = canvas.getContext('2d')

  const palette = canvasPalette()
  const withAlpha = (hex: string, a: number): string => {
    const n = parseInt(hex.slice(1), 16)
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`
  }

  const BARS = 64
  const rings: Ring[] = []
  const sparks: Spark[] = []
  const freq = { data: null as Uint8Array | null, bass: 0, mid: 0, level: 0 }
  let cssW = 0
  let cssH = 0
  let last = 0
  let prevLevel = 0
  let active = false

  if (!ctxMaybe) {
    return {
      id: 'pulse',
      el,
      setState: () => undefined,
    }
  }
  const ctx: CanvasRenderingContext2D = ctxMaybe

  function resize(): void {
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    cssW = canvas.clientWidth || window.innerWidth
    cssH = canvas.clientHeight || window.innerHeight
    canvas.width = Math.round(cssW * dpr)
    canvas.height = Math.round(cssH * dpr)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  }

  function sample(dt: number): void {
    const a = getAnalyser()
    if (!a) {
      freq.bass += (0.18 - freq.bass) * Math.min(1, dt * 4)
      freq.level = freq.bass
      return
    }
    if (!freq.data || freq.data.length !== a.frequencyBinCount) {
      freq.data = new Uint8Array(a.frequencyBinCount)
    }
    a.getByteFrequencyData(freq.data)
    const d = freq.data
    const n = d.length
    const avg = (from: number, to: number): number => {
      let sum = 0
      const lo = Math.floor(n * from)
      const hi = Math.max(lo + 1, Math.floor(n * to))
      for (let i = lo; i < hi; i++) sum += d[i] ?? 0
      return sum / (hi - lo) / 255
    }
    const b = avg(0, 0.08)
    const m = avg(0.08, 0.5)
    const k = Math.min(1, dt * 8)
    freq.bass += (b - freq.bass) * k
    freq.mid += (m - freq.mid) * k
    freq.level = Math.max(freq.bass, freq.mid * 0.85)
  }

  /** 点哪里炸哪里：一圈火花 + 立刻扩开的涟漪 */
  function spawn(cx: number, cy: number, n: number): void {
    if (skipMotion()) return
    const colors = [palette.cyan, palette.mid, palette.white]
    for (let i = 0; i < n; i++) {
      const ang = Math.random() * Math.PI * 2
      const speed = 90 + Math.random() * 430
      const life = 0.7 + Math.random() * 0.9
      sparks.push({
        x: cx,
        y: cy,
        vx: Math.cos(ang) * speed,
        vy: Math.sin(ang) * speed,
        r: 1.6 + Math.random() * 3.4,
        life,
        max: life,
        color: colors[i % colors.length] ?? palette.cyan,
      })
    }
    rings.push({ r: 6, alpha: 0.85 })
  }

  function onPointer(ev: PointerEvent): void {
    if (!active) return
    const r = canvas.getBoundingClientRect()
    spawn(ev.clientX - r.left, ev.clientY - r.top, 44)
  }

  function frame(now: number): void {
    const dt = last ? Math.min((now - last) / 1000, 0.05) : 0
    last = now
    requestAnimationFrame(frame)
    if (!active) return

    sample(dt)
    if (skipMotion()) {
      ctx.clearRect(0, 0, cssW, cssH)
      return
    }

    const cx = cssW / 2
    const cy = cssH * 0.44
    const base = Math.min(cssW, cssH) * 0.17
    const level = freq.level
    const pulse = base * (1 + level * 0.55)

    ctx.clearRect(0, 0, cssW, cssH)

    // 涟漪：能量从低位冲上高位时炸一圈
    if (level > prevLevel + 0.09 && rings.length < 14) rings.push({ r: pulse, alpha: 0.5 })
    prevLevel = level
    for (let i = rings.length - 1; i >= 0; i--) {
      const ring = rings[i]!
      ring.r += dt * (170 + level * 420)
      ring.alpha -= dt * 0.5
      if (ring.alpha <= 0.01) {
        rings.splice(i, 1)
        continue
      }
      ctx.strokeStyle = withAlpha(palette.cyan, ring.alpha)
      ctx.lineWidth = 1.4
      ctx.beginPath()
      ctx.arc(cx, cy, ring.r, 0, Math.PI * 2)
      ctx.stroke()
    }

    // 圆周频谱：每根柱子的高度直接来自对应频段
    const a = getAnalyser()
    if (a && freq.data) {
      const d = freq.data
      const inner = pulse * 1.18
      for (let i = 0; i < BARS; i++) {
        const idx = Math.floor((i / BARS) * d.length * 0.7)
        const v = (d[idx] ?? 0) / 255
        const ang = (i / BARS) * Math.PI * 2 - Math.PI / 2
        const h = 8 + v * Math.min(cssW, cssH) * 0.16
        const x0 = cx + Math.cos(ang) * inner
        const y0 = cy + Math.sin(ang) * inner
        const x1 = cx + Math.cos(ang) * (inner + h)
        const y1 = cy + Math.sin(ang) * (inner + h)
        ctx.strokeStyle = withAlpha(i % 4 === 0 ? palette.cyan : palette.mid, 0.25 + v * 0.6)
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.moveTo(x0, y0)
        ctx.lineTo(x1, y1)
        ctx.stroke()
      }
    }

    // 火花：点出来的粒子，带重力和衰减
    for (let i = sparks.length - 1; i >= 0; i--) {
      const s = sparks[i]!
      s.life -= dt
      if (s.life <= 0) {
        sparks.splice(i, 1)
        continue
      }
      s.vy += 420 * dt
      s.vx *= 1 - 1.1 * dt
      s.x += s.vx * dt
      s.y += s.vy * dt
      const a = s.life / s.max
      ctx.fillStyle = withAlpha(s.color, 0.25 + a * 0.7)
      ctx.beginPath()
      ctx.arc(s.x, s.y, s.r * (0.4 + a * 0.9), 0, Math.PI * 2)
      ctx.fill()
    }

    // 核心：低频越大越亮越大
    const grd = ctx.createRadialGradient(cx, cy, 0, cx, cy, pulse * 1.5)
    grd.addColorStop(0, withAlpha(palette.white, 0.85))
    grd.addColorStop(0.28, withAlpha(palette.cyan, 0.5 + level * 0.4))
    grd.addColorStop(1, withAlpha(palette.mid, 0))
    ctx.fillStyle = grd
    ctx.beginPath()
    ctx.arc(cx, cy, pulse * 1.5, 0, Math.PI * 2)
    ctx.fill()
  }

  function setState(_node: HTMLElement, state: ActState): void {
    active = state === 'active'
    if (state === 'past') gsap.set(el, { opacity: 0.25 })
    else if (state === 'future') gsap.set(el, { opacity: 0 })
    else gsap.set(el, { opacity: 1, clearProps: 'opacity' })
    gsap.set(box, { opacity: state === 'active' ? 1 : 0 })
  }

  function enter(): gsap.core.Timeline | void {
    if (skipMotion()) {
      gsap.set(box, { opacity: 1 })
      return
    }
    return gsap.timeline().fromTo(
      box,
      { opacity: 0, y: 22 },
      { opacity: 1, y: 0, duration: 0.7, ease: EASE.drift, clearProps: 'transform' },
    )
  }

  // 点哪里炸哪里：这一幕是全程唯一可以戳的地方
  canvas.addEventListener('pointerdown', onPointer)

  resize()
  window.addEventListener('resize', resize)
  if (allowResident()) requestAnimationFrame(frame)

  // 自己观察视口：本站各幕都是自管状态，没有中心导演驱动
  const io = new IntersectionObserver(
    (entries) => {
      const e = entries[0]
      if (e) setState(el, e.isIntersecting && e.intersectionRatio >= 0.3 ? 'active' : 'future')
    },
    { threshold: [0, 0.3] },
  )
  io.observe(el)


  // 自检钩子：证明能量真的来自歌，不是自己动
  ;(window as unknown as { __pulse?: () => unknown }).__pulse = () => ({
    level: Number(freq.level.toFixed(3)),
    bass: Number(freq.bass.toFixed(3)),
    mid: Number(freq.mid.toFixed(3)),
    analyser: getAnalyser() !== null,
    rings: rings.length,
    sparks: sparks.length,
    summary: `能量 ${freq.level.toFixed(3)}（低 ${freq.bass.toFixed(3)} / 中 ${freq.mid.toFixed(3)}）· 分析节点=${
      getAnalyser() !== null
    } · 涟漪 ${rings.length}`,
  })

  return { id: 'pulse', el, setState, enter }
}
