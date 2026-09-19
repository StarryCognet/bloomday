/**
 * 水波焦散层 —— P3R 的 UI 水纹母题（官方访谈里说是跟原班人马讨论后定下的）。
 *
 * 做法：十几个柔和的椭圆高光在黑底上缓慢漂移、各自呼吸，
 * 用 lighter 叠加 -> 看起来就是水下那种焦散光斑。
 * 不用逐像素算波动（手机上扛不住），成本恒定、与分辨率无关。
 */
import { canvasPalette } from '../tokens'
export interface CausticsHandle {
  destroy(): void
  readonly count: number
}

interface Blob {
  x: number
  y: number
  r: number
  vx: number
  vy: number
  phase: number
  rate: number
}

export function createCaustics(
  canvas: HTMLCanvasElement,
  options: { count?: number; color?: string } = {},
): CausticsHandle {
  const ctxMaybe = canvas.getContext('2d')
  if (!ctxMaybe) return { destroy: () => undefined, count: 0 }
  const ctx: CanvasRenderingContext2D = ctxMaybe

  // 颜色必须从 token 取 —— 硬编会被 lint 拦下，也不该有第二个配色来源
  const palette = canvasPalette()
  const color = options.color ?? palette.cyan
  const withAlpha = (hex: string, a: number): string => {
    const n = parseInt(hex.slice(1), 16)
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`
  }
  const count = options.count ?? 16
  const blobs: Blob[] = []
  let cssW = 0
  let cssH = 0
  let raf = 0
  let last = 0
  let t = 0

  function sprite(size: number): HTMLCanvasElement {
    const c = document.createElement('canvas')
    c.width = c.height = size
    const g = c.getContext('2d')
    if (g) {
      const grd = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
      grd.addColorStop(0, color)
      grd.addColorStop(0.45, withAlpha(color, 0.35))
      grd.addColorStop(1, withAlpha(color, 0))
      g.fillStyle = grd
      g.beginPath()
      g.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2)
      g.fill()
    }
    return c
  }
  const spriteA = sprite(128)
  const spriteB = sprite(64)

  function seed(): void {
    blobs.length = 0
    for (let i = 0; i < count; i++) {
      blobs.push({
        x: Math.random(),
        y: Math.random(),
        r: 0.18 + Math.random() * 0.34,
        vx: (Math.random() - 0.5) * 0.012,
        vy: (Math.random() - 0.5) * 0.008,
        phase: Math.random() * Math.PI * 2,
        rate: 0.25 + Math.random() * 0.5,
      })
    }
  }

  function resize(): void {
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    cssW = canvas.clientWidth || window.innerWidth
    cssH = canvas.clientHeight || window.innerHeight
    canvas.width = Math.round(cssW * dpr)
    canvas.height = Math.round(cssH * dpr)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  }

  function step(now: number): void {
    const dt = last ? Math.min((now - last) / 1000, 0.05) : 0
    last = now
    t += dt
    ctx.clearRect(0, 0, cssW, cssH)
    ctx.globalCompositeOperation = 'lighter'
    for (const b of blobs) {
      b.x += b.vx * dt
      b.y += b.vy * dt
      if (b.x < -0.3) b.x = 1.3
      if (b.x > 1.3) b.x = -0.3
      if (b.y < -0.3) b.y = 1.3
      if (b.y > 1.3) b.y = -0.3
      const pulse = 0.55 + 0.45 * Math.sin(t * b.rate + b.phase)
      const size = b.r * Math.min(cssW, cssH) * (1.6 + 0.25 * pulse)
      const sx = b.x * cssW - size / 2
      const sy = b.y * cssH - size / 2
      ctx.globalAlpha = 0.09 + 0.10 * pulse
      ctx.drawImage(spriteA, sx, sy, size, size)
      ctx.globalAlpha = 0.06 + 0.08 * pulse
      ctx.drawImage(spriteB, sx + size * 0.22, sy + size * 0.3, size * 0.7, size * 0.7)
    }
    ctx.globalAlpha = 1
    ctx.globalCompositeOperation = 'source-over'
    raf = requestAnimationFrame(step)
  }

  seed()
  resize()
  window.addEventListener('resize', resize)
  raf = requestAnimationFrame(step)

  return {
    destroy() {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
      ctx.clearRect(0, 0, cssW, cssH)
    },
    get count() {
      return count
    },
  }
}
