/**
 * 画廊钉住 —— 页面滚到这一幕就钉住，继续往下滚换算成横向位移，
 * 所有图走完才放行继续往下滚。
 *
 * 为什么不用"劫持滚动"：那种做法要拦 wheel/touch 自己算，跟 Lenis 的阻尼
 * 会互相打架。这里只做两件事——
 *  1. 把这一幕撑高（高度 = 一屏 + 横向总位移），让竖向有足够的滚动距离；
 *  2. 把 `.gal` 粘在顶部，再按滚动进度写 `track.scrollLeft`。
 * 所以它仍然是**原生滚动**，Lenis 的平滑完全保留；横向也不用手势，
 * `overflow:hidden` 让用户拖不动，只能由竖向滚动驱动。
 */
export interface GalleryPinHandle {
  /** 重新量一遍（图片加载完、旋屏、字体变化后都要） */
  layout(): void
  progress(): number
  destroy(): void
}

const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v)

/** 竖向滚 1px，横向走 1/RATIO px */
const RATIO = 0.55

export function createGalleryPin(actEl: HTMLElement, track: HTMLElement): GalleryPinHandle {
  let max = 0

  function layout(): void {
    // 先把高度还原，否则量到的 clientWidth 会被上一轮的布局影响
    actEl.style.height = ''
    max = Math.max(0, track.scrollWidth - track.clientWidth)
    // 高度 = 一屏 + 横向总位移 × RATIO。RATIO < 1 表示横向比竖向快，
    // 图越多越要压，否则 30 张要滚 20 多屏。
    actEl.style.height = `${Math.round(window.innerHeight + max * RATIO)}px`
    sync()
  }

  function progress(): number {
    const span = actEl.offsetHeight - window.innerHeight
    if (span <= 0) return 0
    return clamp01((window.scrollY - actEl.offsetTop) / span)
  }

  let lastP = -1
  function sync(): void {
    if (max <= 0) return
    const p = progress()
    // 只在竖向进度真的变了才写 —— 否则每帧覆写会把 swipeTo 之类的
    // 程序化横向定位立刻冲掉（取证工具有一条正需要它）
    if (Math.abs(p - lastP) < 0.0005) return
    lastP = p
    track.scrollLeft = p * max
  }

  let raf = 0
  const loop = (): void => {
    sync()
    raf = requestAnimationFrame(loop)
  }

  layout()
  window.addEventListener('resize', layout)
  raf = requestAnimationFrame(loop)

  return {
    layout,
    progress,
    destroy() {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', layout)
      actEl.style.height = ''
    },
  }
}
