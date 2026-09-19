/**
 * 许愿收尾幕 —— 吹灭蜡烛，落到哥哥的签名。
 *
 * 【交互设计的两条决定】
 *  1. 主路径 = 触摸/点击烛火。手机上"点火"是零学习成本的；
 *     麦克风吹气实现好但**默认不自动请求权限** —— iOS 上凭空弹一个权限框
 *     会直接把生日惊喜打断，所以它只在 URL 带 ?mic=1 时才启用。
 *  2. 不给操作文字说明（验收要求）。但按验收自己那句"不行则补一句提示"，
 *     做一个**延迟 5 秒才浮现**的兜底提示：t=3s 不可见、t=6s 可见，可客观验证。
 */
import gsap from 'gsap'
import { EASE, allowResident, halftoneBreathe, ripple, skipMotion } from '../motion'
import type { ActDefinition, ActState } from '../motion/director'
import { SITE } from '../site.config'

/** 内容全部来自 src/site.config.ts */
const FINALE = {
  wish: SITE.copy.finale.wish,
  hb: SITE.copy.finale.hb,
  line: SITE.copy.finale.line,
  sign: SITE.copy.finale.sign,
  date: SITE.dateFull,
  fallbackHint: SITE.copy.finale.fallbackHint,
}

interface FinReport {
  blown: boolean
  hintVisibleAt3s: boolean
  hintVisibleAt6s: boolean
  /** 签名/日期的实际渲染盒 —— 用来证明没有变成豆腐块（宽度为 0 最典型） */
  signRect: { w: number; h: number }
  dateRect: { w: number; h: number }
  signText: string
  dateText: string
  /** 静止 5 秒后的微动效：同一元素相隔 1.6s 采样两次，值必须不同 */
  microA: string
  microB: string
  microMoving: boolean
  micEnabled: boolean
  summary: string
}

declare global {
  interface Window {
    __finale?: FinReport
  }
}

export function createFinale(el: HTMLElement): ActDefinition {
  el.innerHTML = `
    <div class="fin" id="fin">
      <div class="fin__stage" id="fin-stage">
        <p class="fin__wish">${FINALE.wish}</p>
        <div class="fin__cake">
          <span class="fin__candle"></span>
          <span class="fin__glow" id="fin-glow"></span>
          <span class="fin__flame" id="fin-flame"></span>
          <span class="fin__smoke" id="fin-smoke"></span>
          <span class="fin__cake-body"></span>
          <span class="fin__cake-line fin__cake-line--a"></span>
          <span class="fin__cake-line fin__cake-line--b"></span>
        </div>
        <p class="fin__hint" id="fin-hint">${FINALE.fallbackHint}</p>
      </div>
      <div class="fin__letter" id="fin-letter">
        <p class="fin__hb">${FINALE.hb}</p>
        <p class="fin__line">${FINALE.line}</p>
        <p class="fin__sign" id="fin-sign">${FINALE.sign}</p>
        <p class="fin__date" id="fin-date">${FINALE.date}</p>
        <span class="fin__rule" id="fin-rule"></span>
      </div>
    </div>
  `

  const stage = el.querySelector<HTMLElement>('#fin-stage')!
  const flame = el.querySelector<HTMLElement>('#fin-flame')!
  const glow = el.querySelector<HTMLElement>('#fin-glow')!
  const smoke = el.querySelector<HTMLElement>('#fin-smoke')!
  const hint = el.querySelector<HTMLElement>('#fin-hint')!
  const sign = el.querySelector<HTMLElement>('#fin-sign')!
  const date = el.querySelector<HTMLElement>('#fin-date')!
  const rule = el.querySelector<HTMLElement>('#fin-rule')!

  let blown = false
  let hintTimer = 0
  const micEnabled = new URLSearchParams(location.search).get('mic') === '1'

  /* ── 未吹灭时：烛火本身就在动，视线自然被它拉住 ──────────
     注意这两条是常驻循环，必须过 allowResident() 守卫 ——
     漏了它们，强度 0 时烛火还在闪（实测峰值剩余 3 条动画就是这俩 + 提示淡入）。 */
  const flameIdle = allowResident()
    ? gsap
        .timeline({ repeat: -1, yoyo: true })
        .fromTo(
          flame,
          { scaleY: 0.9, scaleX: 1.05 },
          { scaleY: 1.12, scaleX: 0.94, duration: 0.55, ease: EASE.breathe },
        )
    : gsap.timeline()
  const glowIdle = allowResident()
    ? gsap
        .timeline({ repeat: -1, yoyo: true })
        .fromTo(
          glow,
          { opacity: 0.35, scale: 0.9 },
          { opacity: 0.75, scale: 1.15, duration: 0.9, ease: EASE.breathe },
        )
    : gsap.timeline()

  /* ── 吹灭 ───────────────────────────────────────────────── */
  function blow(): void {
    if (blown) return
    blown = true
    window.clearTimeout(hintTimer)
    flameIdle.kill()
    glowIdle.kill()

    // 强度 0：不吹不冒烟不扩波，直接落终态（内容一字不少）
    if (skipMotion()) {
      gsap.set(flame, { opacity: 0 })
      gsap.set(glow, { opacity: 0 })
      gsap.set(letterParts, { opacity: 1, y: 0 })
      gsap.set(rule, { scaleX: 1 })
      return
    }

    const tl = gsap.timeline()
    // 火苗被"吹歪"再灭：直接消失像是 bug，歪一下才像被吹的
    tl.to(flame, { x: 10, skewX: 22, duration: 0.16, ease: EASE.snap }, 0)
    tl.to(flame, { scaleY: 0.1, scaleX: 0.5, opacity: 0, duration: 0.22, ease: EASE.snap }, 0.16)
    tl.to(glow, { opacity: 0, scale: 1.35, duration: 0.5, ease: EASE.drift }, 0.16)
    // 一缕烟：慢、长尾
    tl.fromTo(smoke, { opacity: 0, y: 0, scaleY: 0.6 }, { opacity: 0.5, duration: 0.5, ease: EASE.drift }, 0.3)
    tl.to(smoke, { y: -90, opacity: 0, scaleY: 1.6, duration: 2.4, ease: EASE.drift }, 0.5)
    // 水波从烛火处扩散
    tl.add(ripple(stage, { intensity: 0.7, rings: 3, origin: { x: 0.5, y: 0.34 } }), 0.16)
    // 信浮现
    tl.fromTo(
      ['.fin__hb', '.fin__line', '.fin__sign', '.fin__date'],
      { opacity: 0, y: 26 },
      { opacity: 1, y: 0, duration: 0.7, ease: EASE.drift, stagger: 0.14, clearProps: 'transform,opacity' },
      0.75,
    )
    tl.fromTo(rule, { scaleX: 0 }, { scaleX: 1, duration: 0.9, ease: EASE.tear, clearProps: 'transform' }, 1.1)

    // 常驻微动效：停下 5 秒也仍然在动，不会像"页面卡死"
    tl.call(() => {
      const breathe = gsap.timeline({ repeat: -1, yoyo: true })
      breathe.fromTo('.fin__hb', { opacity: 0.86 }, { opacity: 1, duration: 1.8, ease: EASE.breathe })
      const pulse = gsap.timeline({ repeat: -1, yoyo: true })
      pulse.fromTo(date, { opacity: 0.72 }, { opacity: 1, duration: 1.4, ease: EASE.breathe })
      // 签名下网点条的呼吸。原来这里还挂了一条 backgroundPosition 漂移，
      // 但 halftoneBreathe 内部会 killTweensOf(rule) 把它杀掉 ——
      // 两条循环抢同一个元素，后者顺手干掉前者。删掉冗余那条，别留死动画。
      if (rule) halftoneBreathe(rule, { duration: 2.4, intensity: 0.3, repeat: -1 })
    })
  }

  /* 兜底提示：5 秒没被碰过才浮现 */
  hintTimer = window.setTimeout(() => {
    if (blown) return
    if (skipMotion()) gsap.set(hint, { opacity: 1, y: 0 })
    else gsap.fromTo(hint, { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: 0.5, ease: EASE.drift })
  }, 5000)

  /* 触摸/点击整块场景都能吹灭 —— 不必精确点中那一小簇火 */
  stage.addEventListener('pointerdown', blow)
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') blow()
  })

  /* 麦克风吹气：默认不自动请求权限，只在 ?mic=1 时启用 */
  if (micEnabled && navigator.mediaDevices?.getUserMedia) {
    navigator.mediaDevices
      .getUserMedia({ audio: true })
      .then((stream) => {
        const Ctx =
          window.AudioContext ??
          (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
        if (!Ctx) return
        const ac = new Ctx()
        const src = ac.createMediaStreamSource(stream)
        const an = ac.createAnalyser()
        an.fftSize = 512
        src.connect(an)
        const buf = new Uint8Array(an.frequencyBinCount)
        const tick = (): void => {
          if (blown) return
          an.getByteFrequencyData(buf)
          let sum = 0
          for (const v of buf) sum += v
          if (sum / buf.length > 42) blow()
          else requestAnimationFrame(tick)
        }
        requestAnimationFrame(tick)
      })
      .catch(() => undefined)
  }

  /* ── 确定性落状态 ───────────────────────────────────── */
  const letterParts = ['.fin__hb', '.fin__line', '.fin__sign', '.fin__date']

  function setState(node: HTMLElement, state: ActState): void {
    const fin = node.querySelector<HTMLElement>('.fin')
    if (!fin) return
    if (state === 'active') gsap.set(fin, { opacity: 1, y: 0, clearProps: 'transform,opacity' })
    else if (state === 'past') gsap.set(fin, { opacity: 0.2, y: -40 })
    else gsap.set(fin, { opacity: 0, y: 40 })
    // 还没吹灭时，哥哥的信必须是**藏着的** ——
    // 否则她蜡烛都没吹，"生日快乐 + 签名"已经先摆在那了，
    // 交互就没了落点（实测截到过这一幕）。
    if (!blown) gsap.set(letterParts, { opacity: 0 })
    if (rule) gsap.set(rule, { scaleX: blown ? 1 : 0 })
  }

  /* ── 审计 ───────────────────────────────────────────── */
  const wait = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))

  async function runAudit(): Promise<void> {
    await wait(3000)
    const hintVisibleAt3s = Number(getComputedStyle(hint).opacity) > 0.05
    await wait(3000)
    const hintVisibleAt6s = Number(getComputedStyle(hint).opacity) > 0.05

    blow()
    await wait(3600) // 让信浮完，进入常驻微动效

    const sample = (): string => {
      const cs = getComputedStyle(date)
      const bs = getComputedStyle(el.querySelector<HTMLElement>('.fin__hb')!)
      const rs = getComputedStyle(rule)
      return `${cs.opacity}|${bs.opacity}|${rs.transform}`
    }
    const microA = sample()
    await wait(1600)
    const microB = sample()

    const sr = sign.getBoundingClientRect()
    const dr = date.getBoundingClientRect()
    const round = (n: number): number => Math.round(n)
    const microMoving = microA !== microB

    window.__finale = {
      blown,
      hintVisibleAt3s,
      hintVisibleAt6s,
      signRect: { w: round(sr.width), h: round(sr.height) },
      dateRect: { w: round(dr.width), h: round(dr.height) },
      signText: sign.textContent ?? '',
      dateText: date.textContent ?? '',
      microA,
      microB,
      microMoving,
      micEnabled,
      summary:
        `吹灭=${blown} · 提示 t3s可见=${hintVisibleAt3s} t6s可见=${hintVisibleAt6s} · ` +
        `签名 ${round(sr.width)}x${round(sr.height)} "${sign.textContent ?? ''}" · ` +
        `日期 ${round(dr.width)}x${round(dr.height)} "${date.textContent ?? ''}" · ` +
        `静止微动效=${microMoving}(${microA} → ${microB}) · 麦克风=${micEnabled}`,
    }
  }

  if (new URLSearchParams(location.search).get('fin') === '1') {
    void runAudit().then(() => {
      document.title = 'finale-audit-done'
    })
  }
  ;(window as unknown as { __finaleRun?: () => Promise<void> }).__finaleRun = runAudit

  return {
    id: 'finale',
    el,
    setState,
    enter: (node) => {
      const fin = node.querySelector<HTMLElement>('.fin')
      if (!fin) return
      return gsap
        .timeline()
        .fromTo(fin, { opacity: 0, y: 40 }, { opacity: 1, y: 0, duration: 0.7, ease: EASE.drift })
    },
    leave: (node, target) => {
      const fin = node.querySelector<HTMLElement>('.fin')
      if (!fin) return
      const to = target === 'past' ? { opacity: 0.2, y: -40 } : { opacity: 0, y: 40 }
      return gsap.timeline().to(fin, { ...to, duration: 0.5, ease: EASE.sink })
    },
  }
}
