/**
 * 滑动阻尼 —— 用 Lenis 接管纵向滚动。
 *
 * 两个必须注意的点：
 *  1. 封印还在时必须 stop()：否则她能在蓝板子后面乱划，不知道自己在哪。
 *  2. Lenis 接管后 `window.scrollTo` 会被平滑回拉 —— 验证工具会因此失效。
 *     所以这里额外暴露 `window.__scrollTo`（immediate 落位），让取证工具用。
 */
import Lenis from 'lenis'
import 'lenis/dist/lenis.css'

export interface SmoothHandle {
  stop(): void
  start(): void
  destroy(): void
  /** 供验证工具直接落位 */
  jumpTo(y: number): void
  readonly enabled: boolean
}

export function createSmooth(): SmoothHandle {
  const lenis = new Lenis({
    // 手机和桌面用同一套手感：跟手但明显有阻尼
    duration: 1.15,
    lerp: 0.085,
    wheelMultiplier: 0.9,
    touchMultiplier: 1.25,
    syncTouch: true,
    syncTouchLerp: 0.075,
    smoothWheel: true,
    autoRaf: false,
  })

  let raf = 0
  let running = true
  const loop = (t: number): void => {
    lenis.raf(t)
    raf = requestAnimationFrame(loop)
  }
  raf = requestAnimationFrame(loop)

  const jumpTo = (y: number): void => {
    lenis.scrollTo(y, { immediate: true })
  }
  ;(window as unknown as { __scrollTo?: (y: number) => void }).__scrollTo = jumpTo

  return {
    stop() {
      running = false
      lenis.stop()
    },
    start() {
      running = true
      lenis.start()
    },
    destroy() {
      cancelAnimationFrame(raf)
      lenis.destroy()
    },
    jumpTo,
    get enabled() {
      return running
    },
  }
}
