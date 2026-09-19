/**
 * 粒子飘带 —— 常驻底层，能量由 WebAudio 实时分析 BGM 驱动。
 *
 * 两条实现决定：
 *  1. **飘带不是贴图，是一条会呼吸的折线**：每个飘带存一串点，点缓慢上浮 +
 *     正弦横摆，画成上粗下细的锥形描边。这样它跟歌的强弱联动时是"整条一起活"，
 *     而不是整体放大缩小。
 *  2. **能量来自 AnalyserNode 的频域平均**，不是随机数。副歌炸、安静段收，
 *     画的确实是她正在听的那首歌。
 *
 * 性能：飘带 7 条、星屑 60 粒封顶，与分辨率无关；强度 0 时只画一帧静帧。
 */
import { canvasPalette } from './tokens'
import { allowResident, amp, skipMotion } from './motion'

export interface RibbonsHandle {
  destroy(): void
  /** 当前能量 0~1，供自检 */
  energy(): number
  report(): string
}

interface Ribbon {
  x: number
  y: number
  len: number
  width: number
  speed: number
  phase: number
  rate: number
  hue: 'cyan' | 'mid' | 'white'
}

interface Speck {
  x: number
  y: number
  r: number
  speed: number
  drift: number
  alpha: number
}

const SEG = 22

export function createRibbons(analyser: () => AnalyserNode | null): RibbonsHandle {
  const canvas = document.createElement('canvas')
  canvas.className = 'ribbons'
  canvas.id = 'ribbons'
  canvas.setAttribute('aria-hidden', 'true')
  document.body.appendChild(canvas)

  const ctxMaybe = canvas.getContext('2d')
  if (!ctxMaybe) {
    canvas.remove()
    return { destroy: () => undefined, energy: () => 0, report: () => '不可用' }
  }
  const ctx: CanvasRenderingContext2D = ctxMaybe

  const palette = canvasPalette()
  const HEX = { cyan: palette.cyan, mid: palette.mid, white: palette.white }
  const withAlpha = (hex: string, a: number): string => {
    const n = parseInt(hex.slice(1), 16)
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`
  }

  const MAX_RIBBON = 7
  const MAX_SPECK = 60
  const ribbons: Ribbon[] = []
  const specks: Speck[] = []
  let cssW = 0
  let cssH = 0
  let raf = 0
  let last = 0
  let smooth = 0
  let freq: Uint8Array | null = null

  function resize(): void {
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    cssW = window.innerWidth
    cssH = window.innerHeight
    canvas.width = Math.round(cssW * dpr)
    canvas.height = Math.round(cssH * dpr)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  }

  function seed(): void {
    ribbons.length = 0
    specks.length = 0
    const hues: Ribbon['hue'][] = ['cyan', 'mid', 'white']
    for (let i = 0; i < MAX_RIBBON; i++) {
      ribbons.push({
        x: (i + 0.5) / MAX_RIBBON + (Math.random() - 0.5) * 0.12,
        y: Math.random(),
        len: 0.16 + Math.random() * 0.16,
        width: 10 + Math.random() * 20,
        speed: 0.012 + Math.random() * 0.02,
        phase: Math.random() * Math.PI * 2,
        rate: 0.5 + Math.random() * 0.7,
        hue: hues[i % hues.length] ?? 'cyan',
      })
    }
    for (let i = 0; i < MAX_SPECK; i++) {
      specks.push({
        x: Math.random(),
        y: Math.random(),
        r: 0.7 + Math.random() * 1.6,
        speed: 0.01 + Math.random() * 0.03,
        drift: (Math.random() - 0.5) * 0.01,
        alpha: 0.3 + Math.random() * 0.45,
      })
    }
  }

  /** 频域平均 -> 0~1，再做一次平滑，避免逐帧抖动 */
  function readEnergy(dt: number): number {
    const a = analyser()
    if (!a) return 0.22
    if (!freq || freq.length !== a.frequencyBinCount) freq = new Uint8Array(a.frequencyBinCount)
    a.getByteFrequencyData(freq)
    let sum = 0
    // 只看低中频：低频是鼓、中频是人声，高频全是空气噪声
    const n = Math.max(1, Math.floor(freq.length * 0.55))
    for (let i = 0; i < n; i++) sum += freq[i] ?? 0
    const raw = sum / n / 255
    const k = Math.min(1, dt * 6)
    smooth += (raw - smooth) * k
    return smooth
  }

  function drawRibbon(r: Ribbon, t: number, e: number): void {
    const color = HEX[r.hue]
    const rx = r.x * cssW
    const ry = r.y * cssH
    const len = r.len * cssH * (0.75 + e * 0.7)
    const wob = (p: number): number =>
      Math.sin(t * r.rate + r.phase + p * 3.4) * (14 + e * 34) * (1 - p * 0.35)

    // 左右两条边 + 沿长度渐隐 -> 一条真正平滑的锥形带子。
    // 别用逐段描边：round cap 会在接缝鼓包，看起来像一串珠子。
    ctx.beginPath()
    for (let i = 0; i <= SEG; i++) {
      const p = i / SEG
      const hw = Math.max(0.4, r.width * Math.sin(p * Math.PI) * (0.55 + e * 0.7)) / 2
      const x = rx + wob(p) - hw
      const y = ry - p * len
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    for (let i = SEG; i >= 0; i--) {
      const p = i / SEG
      const hw = Math.max(0.4, r.width * Math.sin(p * Math.PI) * (0.55 + e * 0.7)) / 2
      ctx.lineTo(rx + wob(p) + hw, ry - p * len)
    }
    ctx.closePath()
    const grad = ctx.createLinearGradient(0, ry, 0, ry - len)
    grad.addColorStop(0, withAlpha(color, 0))
    grad.addColorStop(0.34, withAlpha(color, 0.035 + e * 0.19))
    grad.addColorStop(1, withAlpha(color, 0))
    ctx.fillStyle = grad
    ctx.fill()
  }

  function frame(now: number): void {
    const dt = last ? Math.min((now - last) / 1000, 0.05) : 0
    last = now
    const t = now / 1000
    if (skipMotion()) {
      // 强度 0：清干净，不留半张飘带
      ctx.clearRect(0, 0, cssW, cssH)
      raf = requestAnimationFrame(frame)
      return
    }

    const e = readEnergy(dt) * amp(1)
    ctx.clearRect(0, 0, cssW, cssH)

    for (const r of ribbons) {
      r.y -= r.speed * dt * (0.6 + e * 1.9)
      if (r.y < -r.len) {
        r.y = 1 + r.len
        r.x = Math.random()
      }
      drawRibbon(r, t, e)
    }

    for (const s of specks) {
      s.y -= s.speed * dt * (0.5 + e * 1.6)
      s.x += s.drift * dt
      if (s.y < -0.02) {
        s.y = 1.02
        s.x = Math.random()
      }
      const a = s.alpha * (0.45 + e * 0.85)
      // 星屑用青，不用白 —— 白点画在白底上等于没画
      ctx.fillStyle = withAlpha(HEX.cyan, Math.min(0.8, a))
      ctx.beginPath()
      ctx.arc(s.x * cssW, s.y * cssH, s.r * (0.8 + e * 0.6), 0, Math.PI * 2)
      ctx.fill()
    }

    raf = requestAnimationFrame(frame)
  }

  resize()
  seed()
  window.addEventListener('resize', resize)
  if (allowResident()) raf = requestAnimationFrame(frame)
  else {
    // 不允许常驻：画一帧静帧就停
    ctx.clearRect(0, 0, cssW, cssH)
    for (const r of ribbons) drawRibbon(r, 0, 0.2)
  }

  return {
    destroy() {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
      canvas.remove()
    },
    energy: () => smooth,
    report: () => `飘带 ${ribbons.length} 条 / 星屑 ${specks.length} 粒 · 能量 ${smooth.toFixed(3)}`,
  }
}
