/**
 * 动效原语库 —— 六个可参数化原语，全部由 GSAP 时间线驱动。
 *
 * 硬约定（后续所有幕都靠这三条不出事）：
 *  1. 每个原语返回 gsap.core.Timeline，调用方可以 chain / pause / kill。
 *  2. 同一 (元素 × 原语) 同一时刻只允许一条时间线：重复触发**先杀旧的那条**。
 *     这是"连点 20 次不叠加、不错位、不留残留"的根因解法。
 *  3. 原语结束后把内联样式清干净（clearProps），不留一地 inline transform。
 *
 * 颜色/角度/网点密度全部从 src/tokens.ts 取，原语内部不硬编任何视觉值。
 */
import gsap from 'gsap'
import { SplitText } from 'gsap/SplitText'
import { EASE, type EaseName } from './easing'
import { allowResident, amp, skipMotion } from './intensity'
import { color as palette, geometry } from '../tokens'

gsap.registerPlugin(SplitText)

export type Direction = 'left' | 'right' | 'up' | 'down'

export interface BaseOptions {
  duration?: number
  delay?: number
  ease?: EaseName
  /** 0..1 强度：统一缩放位移/缩放/blur/stagger 的幅度 */
  intensity?: number
}

const DEFAULTS = { duration: 0.9, delay: 0, intensity: 0.6 }

/* ── 单例登记：同一个元素上的同一个原语，只活一条时间线 ───────────── */
const registry = new WeakMap<Element, Map<string, gsap.core.Timeline>>()

function registryOf(el: Element): Map<string, gsap.core.Timeline> {
  let map = registry.get(el)
  if (!map) {
    map = new Map()
    registry.set(el, map)
  }
  return map
}

function claim(el: Element, key: string): void {
  const map = registryOf(el)
  map.get(key)?.kill()
  map.delete(key)
}

function commit(el: Element, key: string, tl: gsap.core.Timeline): gsap.core.Timeline {
  registryOf(el).set(key, tl)
  return tl
}

function resolve(target: string | Element): HTMLElement {
  const el = typeof target === 'string' ? document.querySelector<HTMLElement>(target) : target
  if (!el) throw new Error(`原语目标不存在: ${String(target)}`)
  return el as HTMLElement
}

/** 确保宿主能裁剪原语产生的子元素（幂等，不累积） */
function ensureStage(el: HTMLElement): void {
  if (getComputedStyle(el).position === 'static') el.style.position = 'relative'
  el.style.overflow = 'hidden'
}

function dirVectors(direction: Direction, intensity: number): { x: number; y: number } {
  const d = 100 * (0.4 + intensity * 0.9)
  if (direction === 'left') return { x: -d, y: 0 }
  if (direction === 'right') return { x: d, y: 0 }
  if (direction === 'up') return { x: 0, y: -d }
  return { x: 0, y: d }
}

/* ══ 原语 1 · 斜切撕入 ═══════════════════════════════════════════
   一条斜切色块从左/右扫过并盖住内容，再穿出去把内容"擦"出来。
   P3 的招牌转场。 */
export interface SlashWipeOptions extends BaseOptions {
  direction?: Direction
  /** 色带颜色，默认取 token 的 --c-mid */
  color?: string
  /** 斜切角度（deg），默认取 token 的 skew.steep */
  skew?: number
}

const BAND = 'mt-band'

export function slashWipe(target: string | Element, options: SlashWipeOptions = {}): gsap.core.Timeline {
  const el = resolve(target)
  const { duration, delay } = { ...DEFAULTS, ...options }
  const direction = options.direction ?? 'right'
  const bandColor = options.color ?? palette.mid
  const skew = options.skew ?? geometry.skew.steep

  ensureStage(el)
  // 强度 0：直接落终态，不建色带、不播动画（内容不受影响）
  if (skipMotion()) return gsap.timeline()
  let band = el.querySelector<HTMLElement>(`:scope > .${BAND}`)
  if (!band) {
    band = document.createElement('div')
    band.className = BAND
    el.appendChild(band)
  }

  claim(el, 'slashWipe')
  gsap.killTweensOf(band)

  const horizontal = direction === 'left' || direction === 'right'
  const enter = direction === 'left' || direction === 'up' ? -115 : 115
  const exit = -enter

  gsap.set(band, {
    position: 'absolute',
    left: '-25%',
    right: '-25%',
    top: '-30%',
    bottom: '-30%',
    display: 'block',
    background: bandColor,
    zIndex: 5,
    skewX: skew,
    transformOrigin: 'center center',
    xPercent: horizontal ? enter : 0,
    yPercent: horizontal ? 0 : enter,
    opacity: 1,
    pointerEvents: 'none',
  })

  // 被 kill 时必须自己收拾干净：总控每次切幕都会杀掉在飞的时间线，
  // 只靠时间线末尾的 .set() 是不够的 —— 中途被杀，斜切色块就会以
  // display:block 卡在画面上（实测"可见色带 1"）。
  const tl = gsap.timeline({
    delay,
    onInterrupt: () => gsap.set(band, { display: 'none', xPercent: 0, yPercent: 0 }),
  })
  tl.to(band, {
    xPercent: horizontal ? 0 : 0,
    yPercent: horizontal ? 0 : 0,
    duration: duration * 0.45,
    ease: EASE.tear,
  })
    .to(band, {
      xPercent: horizontal ? exit : 0,
      yPercent: horizontal ? 0 : exit,
      duration: duration * 0.45,
      ease: EASE.tear,
    })
    .set(band, { display: 'none', xPercent: 0, yPercent: 0 })

  return commit(el, 'slashWipe', tl)
}

/* ══ 原语 2 · 字符逐字冲击 ═══════════════════════════════════════
   拆字后逐字砸入：位移 + 放大 + 模糊 + 轻微旋转，stagger 出"扫过去"的节奏。 */
export interface CharSlamOptions extends BaseOptions {
  direction?: Direction
  /** 每字间隔（秒），默认按 intensity 反比 */
  stagger?: number
  /** 起始模糊半径 px */
  blur?: number
  /** 起始缩放 */
  scale?: number
}

export function charSlam(target: string | Element, options: CharSlamOptions = {}): gsap.core.Timeline {
  const el = resolve(target)
  const { duration, delay } = { ...DEFAULTS, ...options }
  const intensity = amp(options.intensity ?? DEFAULTS.intensity)
  const ease = options.ease ?? 'slam'
  const direction = options.direction ?? 'up'
  const stagger = options.stagger ?? 0.05 * (1.4 - intensity)
  // 模糊不能给太大：>8px 时文字在中途完全糊成一团，看不出是"砸进来的字"
  const blur = options.blur ?? 7 * intensity
  const scale = options.scale ?? 1 + 0.5 * intensity

  // 已经拆过就复用现有字符节点，绝不二次拆（二次拆会嵌套 span，就是残留）
  let chars: HTMLElement[]
  if (el.dataset.mtSplit === '1') {
    chars = Array.from(el.querySelectorAll<HTMLElement>('.mt-char'))
  } else {
    const split = new SplitText(el, { type: 'chars', charsClass: 'mt-char' })
    chars = split.chars as HTMLElement[]
    el.dataset.mtSplit = '1'
  }

  claim(el, 'charSlam')
  gsap.killTweensOf(chars)

  // 强度 0：拆好字直接落终态，不播逐字冲击
  if (skipMotion()) {
    gsap.set(chars, { clearProps: 'transform,opacity,filter' })
    return gsap.timeline()
  }

  const v = dirVectors(direction, intensity)
  const from: gsap.TweenVars = {
    opacity: 0,
    x: v.x,
    y: v.y,
    scale,
    rotate: direction === 'up' ? -8 : 8,
  }
  const to: gsap.TweenVars = {
    opacity: 1,
    x: 0,
    y: 0,
    scale: 1,
    rotate: 0,
    duration,
    ease: EASE[ease],
    stagger,
    clearProps: 'transform,opacity',
  }
  if (blur > 0.5) {
    from.filter = `blur(${blur}px)`
    to.filter = 'blur(0px)'
    to.clearProps = 'transform,opacity,filter'
  }

  // 中途被 kill 时把内联样式清掉，不让字符卡在半截的位移/模糊里
  const tl = gsap.timeline({
    delay,
    onInterrupt: () => gsap.set(chars, { clearProps: 'transform,opacity,filter' }),
  })
  tl.fromTo(chars, from, to)
  return commit(el, 'charSlam', tl)
}

/* ══ 原语 3 · 半调/噪点呼吸 ═════════════════════════════════════
   默认走 scale + opacity（合成器友好，不触发重排重绘）；
   density: true 才去animate background-size（网点真的变密变疏，但每帧重绘，
   只建议小面积用）。 */
export interface BreatheOptions extends BaseOptions {
  sizeFrom?: number
  sizeTo?: number
  opacityFrom?: number
  opacityTo?: number
  scaleFrom?: number
  scaleTo?: number
  repeat?: number
  yoyo?: boolean
  /** true = 动画网点密度本身（贵）；false = 只缩放+透明度（默认，便宜） */
  density?: boolean
}

export function halftoneBreathe(target: string | Element, options: BreatheOptions = {}): gsap.core.Timeline {
  const el = resolve(target)
  const { duration, delay } = { ...DEFAULTS, ...options }
  const intensity = amp(options.intensity ?? DEFAULTS.intensity)
  const repeat = options.repeat ?? -1
  const yoyo = options.yoyo ?? true
  const opFrom = options.opacityFrom ?? 0.55
  const opTo = options.opacityTo ?? Math.min(1, opFrom + 0.45 * (0.4 + intensity))

  claim(el, 'halftoneBreathe')
  gsap.killTweensOf(el)
  // 强度过低：常驻循环一律不启动（常驻呼吸是最该先关的那类）
  if (!allowResident()) return gsap.timeline()

  const tl = gsap.timeline({ delay, repeat, yoyo })

  if (options.density) {
    const sizeFrom = options.sizeFrom ?? geometry.halftone.size
    const sizeTo = options.sizeTo ?? geometry.halftone.size * (1.5 + intensity)
    tl.fromTo(
      el,
      { backgroundSize: `${sizeFrom}px ${sizeFrom}px`, opacity: opFrom },
      { backgroundSize: `${sizeTo}px ${sizeTo}px`, opacity: opTo, duration, ease: EASE.breathe },
    )
  } else {
    const scaleFrom = options.scaleFrom ?? 1
    const scaleTo = options.scaleTo ?? 1 + 0.06 + intensity * 0.08
    tl.fromTo(
      el,
      { scale: scaleFrom, opacity: opFrom },
      { scale: scaleTo, opacity: opTo, duration, ease: EASE.breathe },
    )
  }
  return commit(el, 'halftoneBreathe', tl)
}

/* ══ 原语 4 · 水波扩散 ═══════════════════════════════════════════
   从一点扩散出若干同心环。环用固定池复用，不为每次触发新建节点。 */
export interface RippleOptions extends BaseOptions {
  /** 归一化起点，默认正中 */
  origin?: { x: number; y: number }
  rings?: number
  maxScale?: number
  color?: string
  /** 环的基础直径 px */
  baseSize?: number
}

const RING = 'mt-ring'

export function ripple(target: string | Element, options: RippleOptions = {}): gsap.core.Timeline {
  const el = resolve(target)
  const { duration, delay } = { ...DEFAULTS, ...options }
  const intensity = amp(options.intensity ?? DEFAULTS.intensity)
  const origin = options.origin ?? { x: 0.5, y: 0.5 }
  const ringCount = options.rings ?? 3
  const ringColor = options.color ?? palette.cyan
  const baseSize = options.baseSize ?? 90

  ensureStage(el)
  // 强度 0：不扩环
  if (skipMotion()) return gsap.timeline()

  // 环池：一次建好，之后只复用，节点数恒定
  const pool = Array.from(el.querySelectorAll<HTMLElement>(`:scope > .${RING}`))
  while (pool.length < ringCount) {
    const ring = document.createElement('div')
    ring.className = RING
    el.appendChild(ring)
    pool.push(ring)
  }

  claim(el, 'ripple')
  gsap.killTweensOf(pool)

  // 扩散终点按宿主对角线算：写死 scale 会在小舞台上把环整个推出画外，
  // 结果就是"环看不见"（实测 675px 直径打 150px 高的舞台，一出生就被裁掉）。
  const hostW = el.clientWidth || 320
  const hostH = el.clientHeight || 150
  const maxScale =
    options.maxScale ?? (Math.hypot(hostW, hostH) * (0.5 + 0.45 * intensity)) / baseSize

  gsap.set(pool, {
    position: 'absolute',
    left: `${origin.x * 100}%`,
    top: `${origin.y * 100}%`,
    width: baseSize,
    height: baseSize,
    border: `2px solid ${ringColor}`,
    borderRadius: '50%',
    boxSizing: 'border-box',
    xPercent: -50,
    yPercent: -50,
    scale: 0,
    opacity: 0,
    pointerEvents: 'none',
  })

  // 完成与被 kill 走同一套清理，否则中途切幕会把环留在画面上
  const cleanup = (): void => {
    gsap.set(pool, { opacity: 0, scale: 0 })
  }
  const tl = gsap.timeline({ delay, onComplete: cleanup, onInterrupt: cleanup })
  const gap = duration / (ringCount * 2)
  pool.forEach((ring, i) => {
    // 线性扩张 + 线性淡出：水环是匀速推开的，且中途仍然看得见。
    // 用 power2.out 会让透明度开头就掉光，中段只剩个看不见的大圈。
    tl.fromTo(
      ring,
      { scale: 0, opacity: 0.9 },
      { scale: maxScale, opacity: 0, duration, ease: EASE.linear },
      i * gap,
    )
  })
  return commit(el, 'ripple', tl)
}

/* ══ 原语 5 · 触摸与陀螺仪视差 ═══════════════════════════════════
   常驻效果，不是一次性时间线，所以返回一个句柄：
   可程序驱动（set，方便测试与"跟随手指以外的东西"）、可 start/stop/destroy。 */
export interface ParallaxOptions {
  /** 默认深度，元素可用 data-mt-depth 单独覆盖 */
  depth?: number
  /** 深度 1 时的最大位移 px */
  maxShift?: number
  /** 0..1，越大越跟手；越小越飘 */
  smoothing?: number
  /** 是否接陀螺仪（iOS 需用户手势里授权） */
  gyro?: boolean
}

export interface ParallaxHandle {
  /** 程序驱动虚拟指针，坐标归一化到 -1..1 */
  set(x: number, y: number): void
  start(): void
  stop(): void
  destroy(): void
  readonly layers: number
}

export function parallax(
  targets: string | Element[],
  options: ParallaxOptions = {},
): ParallaxHandle {
  const els = (typeof targets === 'string'
    ? Array.from(document.querySelectorAll<HTMLElement>(targets))
    : targets.map((t) => resolve(t))) as HTMLElement[]

  const baseDepth = options.depth ?? 1
  const maxShift = options.maxShift ?? 18
  const smoothing = options.smoothing ?? 0.12

  const depths = els.map((el) => {
    const attr = Number(el.dataset.mtDepth)
    return Number.isFinite(attr) && attr !== 0 ? attr : baseDepth
  })

  // 强度 0：视差是纯装饰的常驻效果，直接给一个空句柄
  if (skipMotion()) {
    return {
      set: () => undefined,
      start: () => undefined,
      stop: () => undefined,
      destroy: () => undefined,
      get layers() {
        return els.length
      },
    }
  }

  els.forEach((el) => {
    el.style.willChange = 'transform'
  })

  let targetX = 0
  let targetY = 0
  let curX = 0
  let curY = 0
  let raf = 0
  let running = false
  let authorized = false

  const tick = (): void => {
    curX += (targetX - curX) * smoothing
    curY += (targetY - curY) * smoothing
    els.forEach((el, i) => {
      const d = depths[i] ?? 1
      gsap.set(el, { x: curX * maxShift * d, y: curY * maxShift * d })
    })
    raf = requestAnimationFrame(tick)
  }

  const onPointer = (e: PointerEvent | Touch): void => {
    targetX = (e.clientX / window.innerWidth) * 2 - 1
    targetY = (e.clientY / window.innerHeight) * 2 - 1
  }
  const onOrientation = (e: DeviceOrientationEvent): void => {
    if (!authorized) return
    if (e.gamma == null || e.beta == null) return
    targetX = Math.max(-1, Math.min(1, e.gamma / 30))
    targetY = Math.max(-1, Math.min(1, (e.beta - 45) / 30))
  }

  const handle: ParallaxHandle = {
    set(x, y) {
      targetX = Math.max(-1, Math.min(1, x))
      targetY = Math.max(-1, Math.min(1, y))
      if (!running) {
        curX = targetX
        curY = targetY
        els.forEach((el, i) => {
          const d = depths[i] ?? 1
          gsap.set(el, { x: curX * maxShift * d, y: curY * maxShift * d })
        })
      }
    },
    start() {
      if (running) return
      running = true
      window.addEventListener('pointermove', onPointer as EventListener, { passive: true })
      window.addEventListener('touchmove', ((e: TouchEvent) => {
        const t = e.touches[0]
        if (t) onPointer(t)
      }) as EventListener, { passive: true })
      if (options.gyro) {
        window.addEventListener('deviceorientation', onOrientation as EventListener)
        const anyDOE = DeviceOrientationEvent as unknown as {
          requestPermission?: () => Promise<'granted' | 'denied'>
        }
        if (typeof anyDOE?.requestPermission === 'function') {
          anyDOE
            .requestPermission()
            .then((r) => {
              authorized = r === 'granted'
            })
            .catch(() => {
              authorized = false
            })
        } else {
          authorized = true
        }
      }
      raf = requestAnimationFrame(tick)
    },
    stop() {
      running = false
      cancelAnimationFrame(raf)
      window.removeEventListener('pointermove', onPointer as EventListener)
      window.removeEventListener('deviceorientation', onOrientation as EventListener)
    },
    destroy() {
      handle.stop()
      els.forEach((el) => {
        gsap.killTweensOf(el)
        gsap.set(el, { x: 0, y: 0, clearProps: 'transform,willChange' })
      })
    },
    get layers() {
      return els.length
    },
  }
  return handle
}

/** 六个原语的统一出口，供演示页与后续各幕按名字调用 */
export const PRIMITIVES = {
  slashWipe,
  charSlam,
  halftoneBreathe,
  ripple,
  parallax,
} as const

export type PrimitiveName = keyof typeof PRIMITIVES

/**
 * 兜底清理：抹掉一个子树里所有原语留下的痕迹（色带 / 环 / 字符内联样式）。
 *
 * 为什么需要它：原语自己的 onInterrupt 只在"自己被 kill"时可靠触发；
 * 当总控 kill 的是一条**包含该原语的父时间线**时，子时间线的 onInterrupt 不保证跑，
 * 于是斜切色块会以 display:block 卡住（实测"可见色带 1"、存活环 3）。
 * 这个函数不看时间线生命周期，只看 DOM 现状，所以任何路径下都能收干净。
 */
export function resetPrimitives(root: Element): void {
  // 第一步：把这个子树里**所有**在跑的东西全杀掉，包括常驻循环。
  // 为什么不靠总控的 killAll：halftoneBreathe 那种 repeat:-1 的时间线是原语
  // 自己拿着的，不在总控的登记表里；而退场幕又会跳过确定性 setState，
  // 结果就是永远留一条活动 tween（实测"活动tween 1"）。
  // 按子树杀不留死角，代价只是切幕时一次 O(n)，不是每帧。
  gsap.killTweensOf([root, ...Array.from(root.querySelectorAll('*'))])

  root.querySelectorAll<HTMLElement>(`.${BAND}`).forEach((band) => {
    gsap.set(band, { display: 'none', xPercent: 0, yPercent: 0 })
  })
  root.querySelectorAll<HTMLElement>(`.${RING}`).forEach((ring) => {
    gsap.set(ring, { opacity: 0, scale: 0 })
  })
  root.querySelectorAll<HTMLElement>('.mt-char').forEach((char) => {
    gsap.set(char, { clearProps: 'transform,opacity,filter' })
  })
}
