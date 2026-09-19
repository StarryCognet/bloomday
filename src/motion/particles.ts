/**
 * 粒子背景层 —— 常驻的蓝色光点/气泡，叠在 DOM 之下。
 *
 * 性能上的三个硬决定（都是实测/推理得出，不是拍脑袋）：
 *  1. 预渲染一张径向渐变精灵，逐粒子用 drawImage 贴上去 ——
 *     比每帧对每个粒子做 arc() + createRadialGradient() 快一个量级（后者每帧新建渐变对象）。
 *  2. 用 globalCompositeOperation='lighter' 叠加，暗底上自然发光，省掉阴影与模糊。
 *  3. 位置/速度存 Float32Array（struct-of-arrays），不建对象：
 *     粒子数变化时不产生 GC 抖动，滚动才不会忽然掉帧。
 *
 * 颜色一律从 src/tokens.ts 的 canvasPalette() 取，粒子层不做自己的配色。
 */
import { canvasPalette } from '../tokens'

export type ParticleMood = 'calm' | 'rise' | 'celebrate' | 'finale'

interface MoodProfile {
  /** 每 10000 css px² 的粒子数 */
  density: number
  /** 速度倍数 */
  speed: number
  /** 半径倍数 */
  scale: number
  /** 颜色权重 mid / cyan / white / accent */
  weights: [number, number, number, number]
  /** 纵向漂移方向与幅度（负=上升） */
  drift: number
}

export const PARTICLE_MOODS: Record<ParticleMood, MoodProfile> = {
  /** 默认：文案幕那种安静的慢速上升 */
  calm: { density: 1.5, speed: 0.7, scale: 0.9, weights: [0.45, 0.4, 0.15, 0], drift: -1 },
  /** 主视觉：稍密，更明确地往上走 */
  rise: { density: 2.6, speed: 1.1, scale: 1.0, weights: [0.35, 0.45, 0.2, 0], drift: -1.35 },
  /** Hip hip HOORAY：最密最快，混入白与点缀色 */
  celebrate: { density: 4.5, speed: 2.0, scale: 1.15, weights: [0.2, 0.4, 0.34, 0.06], drift: -1.8 },
  /** 许愿收尾：极慢、略大、带一点点暖色火星 */
  finale: { density: 1.8, speed: 0.45, scale: 1.3, weights: [0.3, 0.3, 0.32, 0.08], drift: -0.55 },
}

export type DeviceTier = 'high' | 'mid' | 'low'

/** 按设备算力定粒子上限 —— 低端机不靠"用户自己去关" */
const TIER_CAP: Record<DeviceTier, number> = { high: 120, mid: 72, low: 40 }

export interface ParticleOptions {
  mood?: ParticleMood
  /** 全局强度 0..1，乘在密度与速度上 */
  intensity?: number
  /** 强制指定设备档（测试用；不传则自动探测） */
  tier?: DeviceTier
  /** 速度基准 px/s */
  baseSpeed?: number
}

export interface ParticleLayerHandle {
  setMood(mood: ParticleMood): void
  getMood(): ParticleMood
  setIntensity(v: number): void
  setEnabled(on: boolean): void
  isEnabled(): boolean
  readonly count: number
  readonly tier: DeviceTier
  readonly reducedMotion: boolean
  destroy(): void
}

function withAlpha(hex: string, a: number): string {
  const n = parseInt(hex.slice(1), 16)
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`
}

/** 预渲染的发光精灵：一次生成，之后每帧只做 drawImage */
function makeSprite(color: string): HTMLCanvasElement {
  const size = 64
  const c = document.createElement('canvas')
  c.width = size
  c.height = size
  const g = c.getContext('2d')
  if (!g) return c
  const grd = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  grd.addColorStop(0, color)
  grd.addColorStop(0.3, withAlpha(color, 0.55))
  grd.addColorStop(1, withAlpha(color, 0))
  g.fillStyle = grd
  g.beginPath()
  g.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2)
  g.fill()
  return c
}

function detectTier(): DeviceTier {
  const nav = navigator as Navigator & { deviceMemory?: number }
  const cores = nav.hardwareConcurrency ?? 4
  const mem = nav.deviceMemory ?? 4
  if (cores >= 8 && mem >= 8) return 'high'
  if (cores >= 4 && mem >= 4) return 'mid'
  return 'low'
}

export function particleLayer(
  canvas: HTMLCanvasElement,
  options: ParticleOptions = {},
): ParticleLayerHandle {
  const ctxMaybe = canvas.getContext('2d')
  if (!ctxMaybe) throw new Error('粒子层需要 2d context')
  // 显式非空：null 收窄在闭包里会失效，直接落成确定类型
  const ctx: CanvasRenderingContext2D = ctxMaybe

  const palette = canvasPalette()
  const colors = [palette.midLight, palette.cyan, palette.white, palette.accent]
  const sprites = colors.map(makeSprite)

  const tier = options.tier ?? detectTier()
  const cap = TIER_CAP[tier]
  const baseSpeed = options.baseSpeed ?? 14
  const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')

  let mood: ParticleMood = options.mood ?? 'calm'
  let intensity = options.intensity ?? 1
  let enabled = true
  let count = 0
  let cssW = 0
  let cssH = 0
  let raf = 0
  let last = 0
  let elapsed = 0

  // struct-of-arrays：位置/速度/半径/透明度/相位/颜色下标
  const MAX = TIER_CAP.high
  const px = new Float32Array(MAX)
  const py = new Float32Array(MAX)
  const vx = new Float32Array(MAX)
  const vy = new Float32Array(MAX)
  const pr = new Float32Array(MAX)
  const pa = new Float32Array(MAX)
  const ph = new Float32Array(MAX)
  const pc = new Uint8Array(MAX)

  const rand = (a: number, b: number): number => a + Math.random() * (b - a)

  function pickColorIndex(weights: [number, number, number, number]): number {
    const total = weights[0] + weights[1] + weights[2] + weights[3]
    let r = Math.random() * total
    for (let i = 0; i < weights.length; i++) {
      r -= weights[i] ?? 0
      if (r <= 0) return i
    }
    return 0
  }

  function seed(): void {
    const profile = PARTICLE_MOODS[mood]
    const target = Math.min(cap, Math.round(((cssW * cssH) / 10000) * profile.density * intensity))
    count = Math.max(0, target)
    for (let i = 0; i < count; i++) {
      px[i] = Math.random() * cssW
      py[i] = Math.random() * cssH
      const sp = rand(0.45, 1.25) * baseSpeed * profile.speed * intensity
      const ang = rand(-0.35, 0.35)
      vx[i] = Math.sin(ang) * sp * 0.5
      vy[i] = Math.cos(ang) * sp * Math.sign(profile.drift)
      pr[i] = rand(0.7, 2.3) * profile.scale
      pa[i] = rand(0.25, 0.75)
      ph[i] = Math.random() * Math.PI * 2
      pc[i] = pickColorIndex(profile.weights)
    }
  }

  function resize(): void {
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    cssW = canvas.clientWidth || window.innerWidth
    cssH = canvas.clientHeight || window.innerHeight
    canvas.width = Math.round(cssW * dpr)
    canvas.height = Math.round(cssH * dpr)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    seed()
    if (!running) drawFrame(0)
  }

  function drawFrame(dt: number): void {
    elapsed += dt
    const profile = PARTICLE_MOODS[mood]
    ctx.clearRect(0, 0, cssW, cssH)
    ctx.globalCompositeOperation = 'lighter'

    for (let i = 0; i < count; i++) {
      const x = px[i] ?? 0
      const y = py[i] ?? 0
      const r = pr[i] ?? 1
      // 呼吸：每颗粒子自己的相位，避免整层同步闪
      const pulse = 0.62 + 0.38 * Math.sin(elapsed * 1.6 + (ph[i] ?? 0))
      ctx.globalAlpha = Math.max(0, Math.min(1, (pa[i] ?? 0.5) * pulse))
      const sprite = sprites[pc[i] ?? 0]
      if (sprite) ctx.drawImage(sprite, x - r * 3, y - r * 3, r * 6, r * 6)
    }
    ctx.globalAlpha = 1
    ctx.globalCompositeOperation = 'source-over'
    void profile
  }

  function step(now: number): void {
    const dt = last ? Math.min((now - last) / 1000, 0.05) : 0
    last = now

    for (let i = 0; i < count; i++) {
      px[i] = (px[i] ?? 0) + (vx[i] ?? 0) * dt
      py[i] = (py[i] ?? 0) + (vy[i] ?? 0) * dt
      // 环绕：出画就从对侧回来，不需要回收池
      if ((py[i] ?? 0) < -12) py[i] = cssH + 12
      else if ((py[i] ?? 0) > cssH + 12) py[i] = -12
      if ((px[i] ?? 0) < -12) px[i] = cssW + 12
      else if ((px[i] ?? 0) > cssW + 12) px[i] = -12
    }

    drawFrame(dt)
    raf = requestAnimationFrame(step)
  }

  let running = false

  function start(): void {
    if (running || !enabled) return
    // 减弱动态效果：只画一帧静态粒子，不跑 rAF（不是"变慢"，是彻底不动）
    if (reducedMotionQuery.matches) {
      drawFrame(0)
      return
    }
    running = true
    last = 0
    raf = requestAnimationFrame(step)
  }

  function stop(): void {
    running = false
    cancelAnimationFrame(raf)
    if (!enabled) {
      ctx.clearRect(0, 0, cssW, cssH)
    }
  }

  const onResize = (): void => resize()
  const onVisibility = (): void => {
    if (document.hidden) stop()
    else start()
  }
  const onReducedMotion = (): void => {
    stop()
    start()
  }

  window.addEventListener('resize', onResize)
  document.addEventListener('visibilitychange', onVisibility)
  reducedMotionQuery.addEventListener('change', onReducedMotion)

  resize()
  start()

  return {
    setMood(next) {
      if (next === mood) return
      mood = next
      seed()
      if (!running) drawFrame(0)
    },
    getMood: () => mood,
    setIntensity(v) {
      intensity = Math.max(0, Math.min(1, v))
      seed()
      if (!running) drawFrame(0)
    },
    setEnabled(on) {
      enabled = on
      if (on) start()
      else stop()
    },
    isEnabled: () => enabled,
    get count() {
      return count
    },
    get tier() {
      return tier
    },
    get reducedMotion() {
      return reducedMotionQuery.matches
    },
    destroy() {
      stop()
      window.removeEventListener('resize', onResize)
      document.removeEventListener('visibilitychange', onVisibility)
      reducedMotionQuery.removeEventListener('change', onReducedMotion)
      count = 0
      ctx.clearRect(0, 0, cssW, cssH)
    },
  }
}
