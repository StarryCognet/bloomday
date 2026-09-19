/**
 * 幕间总控测试页 —— 三项验收各自一条自动化：
 *   ?stress=1  真实滚动甩动 20 轮 + 程序化快切 20 次
 *   ?jump=1    直接跳到最后一幕，再回退一幕，看后续事件是否错乱
 *   ?bg=1      模拟切后台（pause）再回来（resume），验证"继续而非重播/叠加"
 *   ?all=1     三条全跑
 */
import gsap from 'gsap'
import { createDirector, type ActDefinition, type ActState } from './motion/director'
import { EASE, charSlam, halftoneBreathe, ripple, slashWipe } from './motion'
import { particleLayer } from './motion/particles'

const params = new URLSearchParams(location.search)
const app = document.querySelector<HTMLDivElement>('#app')
if (!app) throw new Error('#app 不存在')

const ACT_META = [
  { id: 'a1', no: '01', title: '入场封印', body: '点击开始 → 斜切撕入' },
  { id: 'a2', no: '02', title: '生日主视觉', body: '9.19 / 12 → 逐字冲击' },
  { id: 'a3', no: '03', title: '祝福文案', body: '斜切撕入 + 水波扩散' },
  { id: 'a4', no: '04', title: '角色与照片', body: '网点常驻呼吸 + 逐字冲击' },
  { id: 'a5', no: '05', title: '许愿收尾', body: '逐字冲击 + 水波扩散' },
]

app.innerHTML = `
  <canvas id="particles"></canvas>
  <div class="acts">
    ${ACT_META.map(
      (m) => `<section class="act" data-act="${m.id}" data-act-state="future">
        <span class="act__badge">${m.id}</span>
        <div class="act__slash" style="top:${20 + Number(m.no) * 6}%"></div>
        ${m.id === 'a4' ? '<div class="act__halftone"></div>' : ''}
        <div class="act__inner">
          <span class="act__no">${m.no}</span>
          <h2 class="act__title" data-slam="${m.id}">${m.title}</h2>
          <p class="act__body">${m.body}</p>
        </div>
      </section>`,
    ).join('')}
  </div>
  <div class="hud">
    <div class="hud__stats" id="stats"></div>
    <div class="hud__acts">
      <button class="btn" data-goto="0">幕1</button>
      <button class="btn" data-goto="1">幕2</button>
      <button class="btn" data-goto="2">幕3</button>
      <button class="btn" data-goto="3">幕4</button>
      <button class="btn" data-goto="4">幕5</button>
      <button class="btn btn--ghost" id="btn-prev">上一幕</button>
      <button class="btn btn--ghost" id="btn-next">下一幕</button>
      <button class="btn btn--ghost" id="btn-stress">甩动 20 次</button>
      <button class="btn btn--ghost" id="btn-jump">跳最后一幕</button>
      <button class="btn btn--ghost" id="btn-bg">切后台/回来</button>
      <button class="btn btn--ghost" id="btn-fps">粒子层开/关帧率</button>
    </div>
    <div class="hud__report" id="report">就绪。</div>
  </div>
`

const statsEl = document.querySelector<HTMLElement>('#stats')!
const reportEl = document.querySelector<HTMLElement>('#report')!
const errors: string[] = []
window.addEventListener('error', (e) => errors.push(e.message))

const WAIT = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))

function innerOf(el: HTMLElement): HTMLElement | null {
  return el.querySelector<HTMLElement>('.act__inner')
}

/** 确定性落状态：幂等、无动画 —— 跳幕全靠它 */
function setActState(el: HTMLElement, state: ActState): void {
  const inner = innerOf(el)
  if (!inner) return
  const halftone = el.querySelector<HTMLElement>('.act__halftone')
  // 常驻的呼吸先杀掉，再由下面按状态决定是否重启
  gsap.killTweensOf(inner)
  if (halftone) gsap.killTweensOf(halftone)

  if (state === 'active') {
    gsap.set(inner, { opacity: 1, y: 0, clearProps: 'transform,opacity,filter' })
  } else if (state === 'past') {
    gsap.set(inner, { opacity: 0.22, y: -36 })
  } else {
    gsap.set(inner, { opacity: 0, y: 44 })
  }
  if (halftone) gsap.set(halftone, { opacity: 0.3, scale: 1, clearProps: 'transform' })
}

const director = createDirector({ drive: 'scroll', onActChange: (i, id) => {
  renderStats(`${i}:${id}`)
} })

const defs: ActDefinition[] = ACT_META.map((m) => {
  const el = document.querySelector<HTMLElement>(`[data-act="${m.id}"]`)!
  const title = el.querySelector<HTMLElement>(`[data-slam]`)
  return {
    id: m.id,
    el,
    setState: setActState,
    enter: (actEl) => {
      const inner = innerOf(actEl)
      const tl = gsap.timeline()
      // 必须把内容容器从 future 状态演回 active。少了这一步，setState(future)
      // 摆下的 opacity:0 就再也没人恢复（实测"末幕 opacity=0.00"）。
      if (inner) {
        tl.fromTo(
          inner,
          { opacity: 0, y: 44 },
          {
            opacity: 1,
            y: 0,
            duration: 0.7,
            ease: EASE.drift,
            clearProps: 'transform,opacity',
            immediateRender: false,
          },
          0,
        )
      }
      if (m.id === 'a3') slashWipe(inner ?? actEl, { direction: 'left', duration: 0.9 })
      if (title) tl.add(charSlam(title, { direction: 'up', intensity: 0.8, stagger: 0.06 }), 0)
      if (m.id === 'a4') {
        const halftone = actEl.querySelector<HTMLElement>('.act__halftone')
        if (halftone) halftoneBreathe(halftone, { duration: 1.6, intensity: 0.5, repeat: -1 })
      }
      if (m.id === 'a5') tl.add(ripple(actEl, { intensity: 0.7, rings: 3 }), 0.1)
      if (m.id === 'a1' || m.id === 'a2') tl.add(slashWipe(actEl, { direction: 'right', duration: 0.9 }), 0)
      return tl
    },
    leave: (actEl, target) => {
      const inner = innerOf(actEl)
      if (!inner) return
      // 往回跳时目标状态是 future（幕在下方等着），不是 past
      const to = target === 'past' ? { opacity: 0.22, y: -36 } : { opacity: 0, y: 44 }
      return gsap.timeline().to(inner, { ...to, duration: 0.45, ease: EASE.sink })
    },
  }
})
defs.forEach((d) => director.register(d))

/* ── 整站真实形态：粒子层常驻 + 5 幕 + GSAP 滚动驱动 ──────────
   组级验收要求"粒子层常驻时整站滚动帧率 ≥ 无粒子时的 90%"，
   所以必须在**完整结构**上测，不能只在长文页上测。 */
const particleCanvas = document.querySelector<HTMLCanvasElement>('#particles')!
const particles = particleLayer(particleCanvas, { mood: 'rise' })

function measureFps(ms: number): Promise<number> {
  return new Promise((resolve) => {
    let frames = 0
    const t0 = performance.now()
    const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight)
    let dir = 1
    let y = 0
    const loop = (): void => {
      frames++
      y += dir * (max / 2.2)
      if (y >= max) {
        y = max
        dir = -1
      } else if (y <= 0) {
        y = 0
        dir = 1
      }
      window.scrollTo(0, y)
      const dt = performance.now() - t0
      if (dt >= ms) resolve(Math.round((frames / dt) * 1000))
      else requestAnimationFrame(loop)
    }
    requestAnimationFrame(loop)
  })
}

async function runFps(): Promise<void> {
  reportEl.textContent = '帧率对比：预热 5 幕…'
  for (let i = 0; i < director.count; i++) {
    director.goTo(i, { immediate: true })
    await WAIT(120)
  }
  director.goTo(0, { immediate: true })
  window.scrollTo(0, 0)
  await WAIT(400)

  particles.setEnabled(true)
  reportEl.textContent = '帧率对比：粒子层 ON，滚动 2.5s…'
  const on = await measureFps(2500)
  particles.setEnabled(false)
  reportEl.textContent = '帧率对比：粒子层 OFF，滚动 2.5s…'
  const off = await measureFps(2500)
  particles.setEnabled(true)
  window.scrollTo(0, 0)

  const ratio = off > 0 ? (on / off) * 100 : 0
  const ok = ratio >= 90
  reportEl.innerHTML =
    `${ok ? '<em>PASS' : '<s>FAIL'}</s> 整站形态帧率（粒子层常驻 + 5 幕 + GSAP 滚动驱动）\n` +
    `  粒子层 ON  ${on} fps（${particles.count} 粒子 / ${particles.tier} 档）\n` +
    `  粒子层 OFF ${off} fps\n` +
    `  比值 ${ratio.toFixed(1)}% ${ok ? '≥90% PASS' : '<90% FAIL'} · 滚动负载 2.5s×2 · 视口 ${window.innerWidth}x${window.innerHeight} dpr${devicePixelRatio}`
  renderStats()
}

/* ── 读数 ─────────────────────────────────────────────────── */
/**
 * 活动 tween 分两类数：
 *  - dom：真的在改 DOM 的（这些才可能导致错位/残留，验收只认它）
 *  - noop：零时长且没有目标的空转对象（GSAP 内部产物，不动任何东西、也不累积）
 * 混在一起数会让指标名不副实 —— 实测总有一条 dur=0.00 无目标的空转。
 */
function activeTweens(): { dom: number; noop: number } {
  let dom = 0
  let noop = 0
  gsap.globalTimeline.getChildren(true, true, true).forEach((a) => {
    const anim = a as gsap.core.Animation
    if (!anim.isActive()) return
    const withTargets = anim as unknown as { targets?: () => Element[] }
    const targets = typeof withTargets.targets === 'function' ? withTargets.targets() : []
    if (targets.length > 0) dom++
    else noop++
  })
  return { dom, noop }
}

interface Snap {
  nodes: number
  active: number
  noop: number
  bands: number
  rings: number
}

function snapshot(): Snap {
  const t = activeTweens()
  return {
    nodes: document.querySelectorAll('*').length,
    active: t.dom,
    noop: t.noop,
    bands: Array.from(document.querySelectorAll<HTMLElement>('.mt-band')).filter(
      (b) => getComputedStyle(b).display !== 'none',
    ).length,
    rings: Array.from(document.querySelectorAll<HTMLElement>('.mt-ring')).filter(
      (r) => Number(getComputedStyle(r).opacity) > 0.02,
    ).length,
  }
}

function renderStats(extra = ''): void {
  const t = activeTweens()
  statsEl.innerHTML =
    `总控 index <b>${director.index}</b> / ${director.count} · 暂停 <b>${director.paused ? '是' : '否'}</b> · ` +
    `在飞时间线 <b>${director.activeTimelines}</b> · 活动 tween(动DOM) <b>${t.dom}</b> · 空转 <b>${t.noop}</b> · ` +
    `DOM <b>${document.querySelectorAll('*').length}</b> · 错误 <b>${errors.length}</b>${extra ? ' · ' + extra : ''}`
}
renderStats()

document.querySelectorAll<HTMLButtonElement>('[data-goto]').forEach((btn) => {
  btn.addEventListener('click', () => {
    director.goTo(Number(btn.dataset.goto))
    window.scrollTo({ top: director.index * window.innerHeight, behavior: 'auto' })
  })
})
document.querySelector('#btn-prev')?.addEventListener('click', () => director.prev())
document.querySelector('#btn-next')?.addEventListener('click', () => director.next())

/* ── 测试 1：甩动 20 次 ───────────────────────────────────── */
function fling(rounds: number): Promise<void> {
  return new Promise((resolve) => {
    const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight)
    let crossings = 0
    let dir = 1
    let y = window.scrollY
    const loop = (): void => {
      y += dir * (max / 2.4)
      if (y >= max) {
        y = max
        dir = -1
        crossings++
      } else if (y <= 0) {
        y = 0
        dir = 1
        crossings++
      }
      window.scrollTo(0, y)
      if (crossings >= rounds) resolve()
      else requestAnimationFrame(loop)
    }
    requestAnimationFrame(loop)
  })
}

/** 残留诊断：直接列出还在跑的 tween 及其目标，别再靠猜 */
function activeTweenInfo(): string[] {
  const out: string[] = []
  gsap.globalTimeline.getChildren(true, true, true).forEach((a) => {
    const anim = a as gsap.core.Animation
    if (!anim.isActive()) return
    const withTargets = anim as unknown as { targets?: () => Element[] }
    const targets = typeof withTargets.targets === 'function' ? withTargets.targets() : []
    const desc =
      targets
        .map((t) => {
          const cls = typeof t.className === 'string' ? t.className.split(' ').filter(Boolean).join('.') : ''
          return `${t.tagName.toLowerCase()}${t.id ? '#' + t.id : ''}${cls ? '.' + cls : ''}`
        })
        .join(', ') || '(无目标)'
    out.push(`  · ${anim.constructor.name} dur=${anim.duration().toFixed(2)} → ${desc}`)
  })
  return out
}

async function runStress(rounds = 20): Promise<void> {
  reportEl.textContent = '甩动中…'
  // 预热一轮：色带/环池/拆字节点都是懒建的，且必须把**每一幕**都走一遍，
  // 否则首轮建池会被误判成"残留"
  for (let i = 0; i < director.count; i++) {
    director.goTo(i)
    await WAIT(1100)
  }
  director.goTo(0)
  await WAIT(1300)
  const before = snapshot()

  await fling(rounds) // 阶段一：真实滚动甩动（跨度大 → 走"直接落状态"路径）
  window.scrollTo(0, 0)
  await WAIT(400)

  // 阶段二：程序化快切 20 次（走"带动画"路径，最容易叠时间线）
  for (let i = 0; i < rounds; i++) {
    director.goTo(i % 2 === 0 ? director.count - 1 : 0)
    await WAIT(55)
  }
  director.goTo(0)
  await WAIT(2000)

  const after = snapshot()
  const check = director.check()
  const ok =
    check.ok &&
    after.nodes === before.nodes &&
    after.active === 0 &&
    after.bands === 0 &&
    after.rings === 0 &&
    director.activeTimelines === 0
  reportEl.innerHTML = `${ok ? '<em>PASS' : '<s>FAIL'}</s> 甩动 ${rounds} 轮（滚动甩动 + 程序化快切 ${rounds} 次）\n` +
    `  状态不变式：${check.detail}\n` +
    `  节点 ${before.nodes}→${after.nodes} · 活动tween(动DOM) ${after.active} · 空转 ${after.noop} · 在飞时间线 ${director.activeTimelines} · 可见色带 ${after.bands} · 存活环 ${after.rings}` +
    (ok ? '' : `\n  残留 tween：\n${activeTweenInfo().join('\n')}`)
  renderStats()
}

/* ── 测试 2：直接跳到最后一幕 ─────────────────────────────── */
async function runJump(): Promise<void> {
  const last = director.count - 1
  director.goTo(0, { immediate: true })
  await WAIT(250)
  director.goTo(last, { immediate: true }) // 注意：immediate，完全不播中间三幕
  await WAIT(500)

  const jumpCheck = director.check()
  const lastInner = innerOf(defs[last]!.el)
  const lastOpacity = lastInner ? Number(getComputedStyle(lastInner).opacity) : 0

  // 后续事件不错乱：回退一幕，再前进一幕
  director.prev()
  await WAIT(1500)
  const backCheck = director.check()
  director.next()
  await WAIT(1500)
  const fwdCheck = director.check()
  const fwdOpacity = lastInner ? Number(getComputedStyle(lastInner).opacity) : 0

  const ok = jumpCheck.ok && backCheck.ok && fwdCheck.ok && lastOpacity > 0.95 && fwdOpacity > 0.95
  reportEl.innerHTML = `${ok ? '<em>PASS' : '<s>FAIL'}</s> 直接跳最后一幕（跳过中间 3 幕，immediate）\n` +
    `  跳后不变式：${jumpCheck.detail} · 末幕内容 opacity=${lastOpacity.toFixed(2)}\n` +
    `  回退一幕：${backCheck.detail}\n  再前进一幕：${fwdCheck.detail} · 末幕 opacity=${fwdOpacity.toFixed(2)}`
  renderStats()
}

/* ── 测试 3：切后台再回来 ─────────────────────────────────── */
async function runBg(): Promise<void> {
  director.goTo(2) // 让第 3 幕的进场动画正在跑
  await WAIT(150)

  const inner = innerOf(defs[2]!.el)!
  const beforePause = Number(getComputedStyle(inner).opacity)
  const tlCountBefore = director.activeTimelines

  director.pause() // 等价于 visibilitychange → hidden 时走的那条路
  const globalPaused = gsap.globalTimeline.paused()
  await WAIT(600)
  const whilePaused = Number(getComputedStyle(inner).opacity)
  const activeWhilePaused = activeTweens().dom

  director.resume()
  await WAIT(60)
  const justAfterResume = Number(getComputedStyle(inner).opacity)

  await WAIT(2000)
  const afterCheck = director.check()
  const tlCountAfter = director.activeTimelines

  // "继续而非重播"：暂停期间画面冻住；恢复后从冻住的位置接着走，而不是跳回 0 重来。
  // 注意：不能用"暂停期间活动 tween=0"当判据 —— 全局时间线暂停时，
  // 子动画的 isActive() 仍可能报 true，那是错的探针。用"画面有没有冻住"来判。
  const midFlight = beforePause > 0.02 && beforePause < 0.98
  const frozen = Math.abs(whilePaused - beforePause) < 0.08
  const continued = Math.abs(justAfterResume - whilePaused) < 0.25
  const notRestarted = justAfterResume > 0.05
  const noStack = tlCountAfter <= tlCountBefore

  const ok =
    globalPaused && midFlight && frozen && continued && notRestarted && noStack && afterCheck.ok
  reportEl.innerHTML =
    `${ok ? '<em>PASS' : '<s>FAIL'}</s> 切后台再回来（pause / resume）\n` +
    `  globalTimeline.paused=${globalPaused} · 暂停时确有动画在跑=${midFlight}（暂停期间活动 tween=${activeWhilePaused}，此值不作判据）\n` +
    `  opacity：暂停前 ${beforePause.toFixed(2)} → 暂停中 ${whilePaused.toFixed(2)} → 恢复瞬间 ${justAfterResume.toFixed(2)}\n` +
    `  冻住=${frozen} 接着走=${continued} 未重播=${notRestarted} 未叠加=${noStack}（在飞时间线 ${tlCountBefore}→${tlCountAfter}）\n` +
    `  恢复后不变式：${afterCheck.detail}`
  renderStats()
}

document.querySelector('#btn-stress')?.addEventListener('click', () => void runStress())
document.querySelector('#btn-jump')?.addEventListener('click', () => void runJump())
document.querySelector('#btn-bg')?.addEventListener('click', () => void runBg())
document.querySelector('#btn-fps')?.addEventListener('click', () => void runFps())

/* ── 自动取证 ─────────────────────────────────────────────── */
async function runAll(): Promise<void> {
  await runStress()
  const stressText = reportEl.innerHTML
  await runJump()
  const jumpText = reportEl.innerHTML
  await runBg()
  const bgText = reportEl.innerHTML
  reportEl.innerHTML = `${stressText}\n\n${jumpText}\n\n${bgText}\n\n错误 ${errors.length}`
  document.title = 'acts-done'
}

if (params.get('stress') === '1') void runStress().then(() => (document.title = 'acts-done'))
if (params.get('jump') === '1') void runJump().then(() => (document.title = 'acts-done'))
if (params.get('bg') === '1') void runBg().then(() => (document.title = 'acts-done'))
if (params.get('all') === '1') void runAll()
if (params.get('fps') === '1') void runFps().then(() => (document.title = 'acts-fps-done'))

if (errors.length) reportEl.textContent += `\n⚠ ${errors.join('\n')}`
