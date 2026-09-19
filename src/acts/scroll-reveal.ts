/**
 * 滚动显现 —— 每一幕滚进视口时，字逐个显出来。
 *
 * 为什么不用现成的 charSlam：它按 `dataset.mtSplit` 复用 `.mt-char` 节点，
 * 而这里要**反复重置再重播**（滚上去再滚下来），缓存会和重置打架。
 * 所以自己拆 span、自己管状态。
 *
 * 状态机跟祝福幕一致：
 *   future（藏着）→ 从下方进入就播 → past（已就位，从上方滚回来不重播）
 * 这样"快速划到底再回滚"不会闪。
 */
import gsap from 'gsap'
import { EASE } from '../motion'

export interface RevealUnit {
  el: HTMLElement
  /** chars = 逐字砸入；fade = 整块上移淡入 */
  mode?: 'chars' | 'fade'
  /** 同一次显现内的时间偏移（秒） */
  delay?: number
}

export interface ScrollRevealHandle {
  /** 仪式就位后才开始观察（否则主视觉在封印底下就先演完了） */
  arm(): void
  destroy(): void
}

const C = 'rv-c'

function split(el: HTMLElement): HTMLElement[] {
  if (el.dataset.rvSplit === '1') return Array.from(el.querySelectorAll<HTMLElement>(`.${C}`))
  // 含子元素的（比如带 <b> 强调的句子）不拆，拆了会毁掉标记
  if (el.children.length > 0) return []
  const text = el.textContent ?? ''
  el.textContent = ''
  const out: HTMLElement[] = []
  for (const ch of text) {
    const s = document.createElement('span')
    s.className = C
    s.textContent = ch === ' ' ? '\u00a0' : ch
    el.appendChild(s)
    out.push(s)
  }
  el.dataset.rvSplit = '1'
  return out
}

export function createScrollReveal(root: HTMLElement, units: RevealUnit[]): ScrollRevealHandle {
  const prepared = units.map((u) => ({
    ...u,
    mode: u.mode ?? 'fade',
    chars: (u.mode ?? 'fade') === 'chars' ? split(u.el) : [],
  }))

  function hide(u: (typeof prepared)[number]): void {
    gsap.killTweensOf([u.el, ...u.chars])
    if (u.mode === 'chars' && u.chars.length) {
      gsap.set(u.chars, { opacity: 0, y: 34 })
    } else {
      gsap.set(u.el, { opacity: 0, y: 26 })
    }
  }

  function play(u: (typeof prepared)[number]): void {
    gsap.killTweensOf([u.el, ...u.chars])
    if (u.mode === 'chars' && u.chars.length) {
      gsap.fromTo(
        u.chars,
        { opacity: 0, y: 34, filter: 'blur(6px)' },
        {
          opacity: 1,
          y: 0,
          filter: 'blur(0px)',
          duration: 0.62,
          ease: EASE.slam,
          stagger: 0.035,
          delay: u.delay ?? 0,
          clearProps: 'transform,opacity,filter',
        },
      )
    } else {
      gsap.fromTo(
        u.el,
        { opacity: 0, y: 26 },
        { opacity: 1, y: 0, duration: 0.6, ease: EASE.drift, delay: u.delay ?? 0, clearProps: 'transform,opacity' },
      )
    }
  }

  let state: 'future' | 'past' = 'future'

  prepared.forEach(hide)

  /**
   * 用位置判断而不是 IntersectionObserver 的比例。
   * 比例在"很高的幕"上会失效：画廊 30 张图后幕高 4919px，
   * 最大可见比例只有 844/4919 = 0.17，够不到 0.28，于是永远不播
   * （实测标题一直空着）。位置判断对任意幕高都成立。
   */
  function check(): void {
    const r = root.getBoundingClientRect()
    const vh = window.innerHeight
    if (r.bottom < 0) return // 整幕已滚到上方 —— 保持就位，不重置
    if (r.top > vh) {
      // 整幕还在下方 —— 重置，等滚下来再播
      if (state === 'past') {
        prepared.forEach(hide)
        state = 'future'
      }
      return
    }
    if (r.top < vh * 0.72 && state === 'future') {
      prepared.forEach((u, i) => play({ ...u, delay: (u.delay ?? 0) + i * 0.07 }))
      state = 'past'
    }
  }

  let raf = 0
  const loop = (): void => {
    check()
    raf = requestAnimationFrame(loop)
  }

  return {
    arm() {
      check()
      raf = requestAnimationFrame(loop)
    },
    destroy() {
      cancelAnimationFrame(raf)
    },
  }
}
