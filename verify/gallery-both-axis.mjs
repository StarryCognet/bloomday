/**
 * 画廊：竖向带动横向之外，也允许直接横向滑动（用户选了 B）。
 *
 * 关键在 touch-action:
 *   pan-x  = 横向手势交给浏览器（滚轨道）
 *   竖向不交给浏览器 -> 留给 Lenis 滚页面
 * 这样一根手指竖着划 = 页面往下走，横着划 = 图片翻页，两边都能用。
 *
 * 反过来，用户横着拖之后必须把竖向位置回写，否则两边会脱节
 * （轨道停在别处，而页面位置还指着原来那张）。
 */
import { readFileSync, writeFileSync } from 'node:fs'

let miss = 0
const patch = (file, pairs) => {
  let s = readFileSync(file, 'utf8')
  for (const [from, to, label] of pairs) {
    if (!s.includes(from)) {
      console.log(`MISS ${file}: ${label}`)
      miss++
      continue
    }
    s = s.replace(from, to)
    console.log(`OK   ${file}: ${label}`)
  }
  writeFileSync(file, s, 'utf8')
}

patch('src/gallery.css', [
  [
    `.gal__track {
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  align-items: stretch;
  gap: var(--sp-3);
  padding: 0 var(--sp-3);
  overflow: hidden;
}`,
    `.gal__track {
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  align-items: stretch;
  gap: var(--sp-3);
  padding: 0 var(--sp-3);
  /* 横向允许用户直接滑（用户选了 B）；竖向不交给浏览器，留给 Lenis 滚页面 */
  overflow-x: auto;
  overflow-y: hidden;
  touch-action: pan-x;
  overscroll-behavior-x: contain;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
}`,
    '轨道开放横向',
  ],
])

patch('src/acts/gallery-pin.ts', [
  [
    `  let raf = 0
  const loop = (): void => {
    sync()
    raf = requestAnimationFrame(loop)
  }`,
    `  /**
   * 用户直接横向滑之后，把竖向位置回写 —— 否则两边脱节：
   * 轨道停在别处，而页面位置还指着原来那张。
   * 判据是"轨道的 scrollLeft 和竖向进度应有的值不等"，相等就说明是我自己写的。
   */
  function pullBack(): void {
    if (max <= 0) return
    const expected = progress() * max
    if (Math.abs(track.scrollLeft - expected) < 2) return
    const p = clamp01(track.scrollLeft / max)
    const span = actEl.offsetHeight - window.innerHeight
    if (span > 0) window.scrollTo(0, actEl.offsetTop + p * span)
    lastP = -1
  }
  track.addEventListener('scroll', pullBack, { passive: true })

  // 触控板的横向滚动：Lenis 只管竖向，这里自己接
  track.addEventListener(
    'wheel',
    (ev) => {
      if (Math.abs(ev.deltaX) <= Math.abs(ev.deltaY)) return
      track.scrollLeft += ev.deltaX
    },
    { passive: true },
  )

  let raf = 0
  const loop = (): void => {
    sync()
    raf = requestAnimationFrame(loop)
  }`,
    'pullBack + 横向 wheel',
  ],
])

console.log(miss === 0 ? '\n全部替换成功' : `\n有 ${miss} 处未匹配`)
