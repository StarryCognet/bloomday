/**
 * 幕间时间线总控 —— 按幕注册进场/退场，滚动与点击两种驱动。
 *
 * 三条设计原则（都是为了让"乱甩 / 跳幕 / 切后台"不出事）：
 *  1. **确定性落状态优先于动画**：每一幕都有 setState(el, 'future'|'active'|'past')，
 *     幂等、无动画。跳幕时先给所有幕落状态，再只给目标幕补进场动画。
 *     这样"直接跳到最后一幕"天然正确，不依赖把中间每一幕都播一遍。
 *  2. **切换即杀旧**：每次 goTo 先把所有在飞的时间线 kill 掉。
 *     快速甩动 20 次只会活最后一条，不会叠 20 条。
 *  3. **跨度 >1 幕不放动画**：快速滚动时中间幕直接落状态。
 *     否则 20 次甩动会排队 20 段转场，观感就是"卡住然后一口气播完"。
 *
 * 全局暂停用 gsap.globalTimeline：切后台时 pause()，回来 resume()，
 * 动画从停下的位置继续，而不是重新播一遍或叠加第二条。
 */
import gsap from 'gsap'
import { resetPrimitives } from './primitives'

export type ActState = 'future' | 'active' | 'past'

export interface ActDefinition {
  id: string
  el: HTMLElement
  /** 确定性落状态：幂等、无动画。跳幕与兜底全靠它 */
  setState: (el: HTMLElement, state: ActState) => void
  /** 带动画的进场（从 future 演到 active），可选 */
  enter?: (el: HTMLElement) => gsap.core.Timeline | void
  /** 带动画的退场（从 active 演到 target），可选。target 在往回跳时是 'future' */
  leave?: (el: HTMLElement, target: ActState) => gsap.core.Timeline | void
}

export interface DirectorOptions {
  /** 滚动驱动还是点击驱动；默认 scroll */
  drive?: 'scroll' | 'tap'
  /** 是否自己接管 visibilitychange 做全局暂停，默认 true */
  handleVisibility?: boolean
  /** 切幕时的兜底清理；默认清原语痕迹（色带/环/字符内联） */
  reset?: (el: HTMLElement) => void
  onActChange?: (index: number, id: string) => void
}

export interface DirectorHandle {
  register(act: ActDefinition): void
  goTo(index: number, opts?: { immediate?: boolean }): void
  next(): void
  prev(): void
  pause(): void
  resume(): void
  destroy(): void
  /** 硬不变式自查：恰好一个 active，且序号等于 index */
  check(): { ok: boolean; detail: string }
  readonly index: number
  readonly count: number
  readonly paused: boolean
  readonly activeTimelines: number
}

export function createDirector(options: DirectorOptions = {}): DirectorHandle {
  const acts: ActDefinition[] = []
  const timelines = new Map<string, gsap.core.Timeline>()
  const drive = options.drive ?? 'scroll'
  const doReset = options.reset ?? resetPrimitives

  let index = -1
  let paused = false
  let ticking = false
  let destroyed = false

  function killAct(id: string): void {
    const tl = timelines.get(id)
    if (tl) {
      tl.kill()
      timelines.delete(id)
    }
  }

  function killAll(): void {
    for (const id of Array.from(timelines.keys())) killAct(id)
  }

  function run(act: ActDefinition, kind: 'enter' | 'leave', target: ActState = 'past'): void {
    killAct(act.id)
    const fn = kind === 'enter' ? act.enter : act.leave
    if (!fn) return
    const result = kind === 'enter' ? act.enter?.(act.el) : act.leave?.(act.el, target)
    if (result && typeof result.kill === 'function') timelines.set(act.id, result)
  }

  function mark(act: ActDefinition, state: ActState): void {
    act.el.dataset.actState = state
  }

  function goTo(target: number, opts: { immediate?: boolean } = {}): void {
    if (destroyed || acts.length === 0) return
    const clamped = Math.max(0, Math.min(acts.length - 1, target))
    const prev = index
    const immediate = opts.immediate ?? false

    // 1) 先杀干净所有在飞的时间线 —— 快速甩动不叠加的根因
    killAll()
    // 1b) 兜底清理：父时间线被 kill 时，子原语的 onInterrupt 不保证触发，
    //     所以不依赖时间线生命周期、直接按 DOM 现状收干净
    acts.forEach((act) => doReset(act.el))

    // 2) 除目标幕（交给进场动画）与旧幕（交给退场动画）外，其余幕落确定性状态
    acts.forEach((act, i) => {
      const isTarget = i === clamped
      const isLeaving = !immediate && i === prev && prev !== clamped
      if (!immediate && (isTarget || isLeaving)) return
      const state: ActState = i < clamped ? 'past' : i === clamped ? 'active' : 'future'
      act.setState(act.el, state)
      mark(act, state)
    })

    const targetAct = acts[clamped]
    if (!targetAct) return

    // 3) 目标幕：先摆到起跑线，再演进场
    if (immediate) {
      targetAct.setState(targetAct.el, 'active')
    } else {
      targetAct.setState(targetAct.el, 'future')
      run(targetAct, 'enter')
    }
    mark(targetAct, 'active')

    // 4) 旧幕退场（仅带动画、且确实换了幕）。
    //    注意方向：往回跳时旧幕在目标之后，逻辑上应落 'future' 而不是 'past'。
    if (!immediate && prev >= 0 && prev !== clamped) {
      const prevAct = acts[prev]
      if (prevAct) {
        const leaveTo: ActState = prev > clamped ? 'future' : 'past'
        run(prevAct, 'leave', leaveTo)
        mark(prevAct, leaveTo)
      }
    }

    index = clamped
    options.onActChange?.(clamped, targetAct.id)
  }

  function onScroll(): void {
    if (ticking || drive !== 'scroll' || destroyed) return
    ticking = true
    requestAnimationFrame(() => {
      ticking = false
      if (drive !== 'scroll' || destroyed || acts.length === 0) return
      const mid = window.scrollY + window.innerHeight * 0.5
      let best = 0
      let bestDist = Number.POSITIVE_INFINITY
      acts.forEach((act, i) => {
        const h = act.el.offsetHeight || window.innerHeight
        const center = act.el.offsetTop + h / 2
        const d = Math.abs(center - mid)
        if (d < bestDist) {
          bestDist = d
          best = i
        }
      })
      if (best === index) return
      // 跨度大于一幕 = 用户在快速甩：直接落状态，不放动画
      goTo(best, { immediate: Math.abs(best - index) > 1 })
    })
  }

  function onVisibility(): void {
    if (document.hidden) pause()
    else resume()
  }

  function pause(): void {
    if (paused) return
    paused = true
    gsap.globalTimeline.pause()
  }

  function resume(): void {
    if (!paused) return
    paused = false
    gsap.globalTimeline.resume()
  }

  if (drive === 'scroll') window.addEventListener('scroll', onScroll, { passive: true })
  if (options.handleVisibility !== false) {
    document.addEventListener('visibilitychange', onVisibility)
  }

  return {
    register(act) {
      acts.push(act)
      act.setState(act.el, acts.length - 1 === 0 ? 'active' : 'future')
      mark(act, acts.length - 1 === 0 ? 'active' : 'future')
      if (index === -1) index = 0
    },
    goTo,
    next: () => goTo(index + 1),
    prev: () => goTo(index - 1),
    pause,
    resume,
    destroy() {
      destroyed = true
      killAll()
      window.removeEventListener('scroll', onScroll)
      document.removeEventListener('visibilitychange', onVisibility)
      resume()
    },
    check() {
      const activeIdx = acts
        .map((a, i) => (a.el.dataset.actState === 'active' ? i : -1))
        .filter((i) => i >= 0)
      const bad: string[] = []
      if (activeIdx.length !== 1) bad.push(`active 幕数=${activeIdx.length}（应为 1）`)
      else if (activeIdx[0] !== index) bad.push(`active 序号=${activeIdx[0]} 但 index=${index}`)
      for (let i = 0; i < acts.length; i++) {
        const want: ActState = i < index ? 'past' : i === index ? 'active' : 'future'
        const got = acts[i]?.el.dataset.actState
        if (got !== want) bad.push(`#${i} 期望 ${want} 实际 ${got}`)
      }
      return {
        ok: bad.length === 0,
        detail: bad.length === 0 ? `5 幕状态一致，active=#${index}` : bad.join('; '),
      }
    },
    get index() {
      return index
    },
    get count() {
      return acts.length
    },
    get paused() {
      return paused
    },
    get activeTimelines() {
      // 只数真正在跑的：跑完的时间线还留在 map 里，数条目会撒谎
      let n = 0
      timelines.forEach((tl) => {
        if (tl.isActive()) n++
      })
      return n
    },
  }
}
