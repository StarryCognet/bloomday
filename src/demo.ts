/**
 * 原语演示页 —— 六个原语逐个可见、可定格、可压测。
 *
 * 取证用法（配合 verify/shot.mjs）：
 *   ?play=all&at=0.45   六个原语同时起播并定格在 45% 进度 → 一张图看到全部手感
 *   ?play=slashWipe&at=0.3
 *   ?stress=1           每个原语连点 20 次，打印节点/残留对比
 *   ?bench=1            六个原语同时上负载，实测 FPS
 */
import gsap from 'gsap'
import {
  EASE_NAMES,
  easeErrors,
  easeValue,
  halftoneBreathe,
  charSlam,
  parallax,
  ripple,
  slashWipe,
  type ParallaxHandle,
} from './motion'

type TimelineId = 'slashWipe' | 'charSlam' | 'halftoneBreathe' | 'ripple'
type CardId = TimelineId | 'parallax' | 'easing'

const CARDS: Array<{ id: CardId; no: string; title: string; hint: string }> = [
  {
    id: 'slashWipe',
    no: '01',
    title: '斜切撕入',
    hint: '斜切色块扫过并擦出内容 · 参数：方向 / 时长 / 强度 / 颜色 / 斜角',
  },
  {
    id: 'charSlam',
    no: '02',
    title: '字符逐字冲击',
    hint: '拆字砸入：位移 + 放大 + 模糊 + 旋转 · 参数：方向 / stagger / 强度',
  },
  {
    id: 'halftoneBreathe',
    no: '03',
    title: '半调 / 噪点呼吸',
    hint: '默认 scale+opacity（合成器友好）；density:true 才动 background-size（贵）',
  },
  {
    id: 'ripple',
    no: '04',
    title: '水波扩散',
    hint: '同心环扩散 · 环池复用，触发多少次 DOM 节点数都不涨',
  },
  {
    id: 'parallax',
    no: '05',
    title: '触摸 / 陀螺仪视差',
    hint: '三层深度 0.4 / 1 / 1.9 · 可程序驱动，返回 destroy 句柄',
  },
  {
    id: 'easing',
    no: '06',
    title: '统一缓动曲线',
    hint: '全站曲线唯一来源 · 菱形 = 进度 25% / 50% / 75% 处的缓动值',
  },
]

const WAIT = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))

/* ── 页面骨架 ─────────────────────────────────────────────── */
function stageInner(id: CardId): string {
  switch (id) {
    case 'slashWipe':
      return `<span class="stage__title">生日快乐</span>`
    case 'charSlam':
      return `<span class="stage__title" id="charSlam-text">生日快乐</span>`
    case 'halftoneBreathe':
      return `<div class="halftone-layer u-halftone"></div><span class="stage__title" style="font-size:1.6rem">呼吸</span>`
    case 'ripple':
      return `<span class="card__meta" style="color:var(--c-white-dim)">点这里出水波</span>`
    case 'parallax':
      return `
        <div class="parallax-layer" data-mt-depth="0.4"></div>
        <div class="parallax-layer" data-mt-depth="1"></div>
        <div class="parallax-layer" data-mt-depth="1.9"></div>`
    case 'easing':
      return `<div class="ease-stage">${EASE_NAMES.map((n) => {
        const v25 = easeValue(n, 0.25)
        const v50 = easeValue(n, 0.5)
        const v75 = easeValue(n, 0.75)
        return `<div class="ease-row">
          <span class="ease-row__name t-label">${n}</span>
          <div class="ease-row__track">
            <i class="ease-dot" style="left:${(v25 * 100).toFixed(1)}%"></i>
            <i class="ease-dot ease-dot--mid" style="left:${(v50 * 100).toFixed(1)}%"></i>
            <i class="ease-dot" style="left:${(v75 * 100).toFixed(1)}%"></i>
          </div>
        </div>
        <span class="card__meta" style="grid-column:2;margin:-4px 0 6px">${v25.toFixed(2)} / ${v50.toFixed(2)} / ${v75.toFixed(2)}</span>`
      }).join('')}</div>`
  }
}

const html = `
<div class="demo">
  <div class="bar">
    <div class="bar__stats" id="stats"></div>
    <div class="bar__acts">
      <button class="btn" id="btn-all">全部播放</button>
      <button class="btn btn--ghost" id="btn-stress">连点 20 次压测</button>
      <button class="btn btn--ghost" id="btn-bench">六原语满负载测 FPS</button>
      <button class="btn btn--ghost" id="btn-reset">复位</button>
    </div>
    <pre class="report" id="report">就绪。读数含义：活动 tween / DOM 节点 / 实测 FPS。</pre>
  </div>
  ${CARDS.map(
    (c) => `<section class="card" id="card-${c.id}">
      <div class="card__head">
        <span class="card__no">${c.no}</span>
        <h2 class="t-h2" style="font-size:1.05rem">${c.title}</h2>
      </div>
      <p class="card__hint">${c.hint}</p>
      <div class="stage${c.id === 'ripple' ? ' stage--ripple' : ''}${c.id === 'parallax' ? ' stage--parallax' : ''}${c.id === 'easing' ? ' stage--ease' : ''}" id="stage-${c.id}">${stageInner(c.id)}</div>
      <div class="card__row">
        <button class="btn" data-play="${c.id}">播放</button>
        <span class="card__meta" id="meta-${c.id}">待触发</span>
      </div>
    </section>`,
  ).join('')}
</div>`

const app = document.querySelector<HTMLDivElement>('#app')
if (!app) throw new Error('#app 不存在')
app.innerHTML = html

const reportEl = document.querySelector<HTMLElement>('#report')!
const statsEl = document.querySelector<HTMLElement>('#stats')!

/* ── 句柄与状态 ───────────────────────────────────────────── */
let parallaxHandle: ParallaxHandle | null = null
const timelineCache = new Map<string, gsap.core.Timeline>()
const errors: string[] = [...easeErrors]

window.addEventListener('error', (e) => {
  errors.push(`${e.message}`)
})

function stageOf(id: string): HTMLElement {
  const el = document.querySelector<HTMLElement>(`#stage-${id}`)
  if (!el) throw new Error(`stage 不存在: ${id}`)
  return el
}

/* ── 播放单个原语；at 给定则定格在该进度 ──────────────────── */
function playOne(id: CardId, at?: number): void {
  const meta = document.querySelector<HTMLElement>(`#meta-${id}`)

  if (id === 'easing') {
    if (meta) meta.textContent = '静态展示：曲线即数据'
    return
  }

  if (id === 'parallax') {
    parallaxHandle?.destroy()
    parallaxHandle = parallax('.parallax-layer', { maxShift: 26, smoothing: 0.18, gyro: false })
    const x = at === undefined ? 0.55 : at * 2 - 1
    const y = at === undefined ? -0.35 : -(at * 2 - 1) * 0.5
    parallaxHandle.set(x, y)
    if (meta) meta.textContent = `虚拟指针 x=${x.toFixed(2)} y=${y.toFixed(2)} · ${parallaxHandle.layers} 层`
    return
  }

  let tl: gsap.core.Timeline
  if (id === 'slashWipe') {
    tl = slashWipe(stageOf(id), { direction: 'right', duration: 1.1, intensity: 0.75 })
  } else if (id === 'charSlam') {
    tl = charSlam('#charSlam-text', { direction: 'up', duration: 0.7, intensity: 0.85 })
  } else if (id === 'halftoneBreathe') {
    tl = halftoneBreathe('.halftone-layer', { duration: 1.4, intensity: 0.7, repeat: 2, yoyo: true })
  } else {
    tl = ripple(stageOf(id), { duration: 1.5, intensity: 0.75, rings: 3 })
  }

  timelineCache.set(id, tl)
  if (at !== undefined) {
    tl.progress(at).pause()
    if (meta) meta.textContent = `已定格 @ ${(at * 100).toFixed(0)}%`
  } else if (meta) {
    meta.textContent = `播放中 · ${tl.duration().toFixed(2)}s`
  }
}

/* ── 读数 ─────────────────────────────────────────────────── */
function activeTweens(): number {
  let n = 0
  gsap.globalTimeline.getChildren(true, true, true).forEach((a) => {
    if ((a as gsap.core.Animation).isActive()) n++
  })
  return n
}

interface Snap {
  nodes: number
  active: number
  bands: number
  rings: number
  dirty: number
}

function snap(id: string): Snap {
  const host = document.querySelector<HTMLElement>(`#card-${id}`) ?? document.body
  const bands = Array.from(host.querySelectorAll<HTMLElement>('.mt-band')).filter(
    (b) => getComputedStyle(b).display !== 'none',
  ).length
  const rings = Array.from(host.querySelectorAll<HTMLElement>('.mt-ring')).filter(
    (r) => Number(getComputedStyle(r).opacity) > 0.02,
  ).length
  // 脏内联 = 动画跑完后仍留着一地 inline transform/filter 的元素（排除原语内部节点）
  const dirty = Array.from(host.querySelectorAll<HTMLElement>('*'))
    .filter((e) => !e.classList.contains('mt-band') && !e.classList.contains('mt-ring'))
    .filter((e) => {
      const s = e.style
      return (s.transform !== '' && s.transform !== 'none') || s.filter !== ''
    }).length
  return { nodes: host.querySelectorAll('*').length, active: activeTweens(), bands, rings, dirty }
}

let fps = 0
function measureFps(ms: number): Promise<number> {
  return new Promise((resolve) => {
    let frames = 0
    const t0 = performance.now()
    const loop = (): void => {
      frames++
      const dt = performance.now() - t0
      if (dt >= ms) resolve(Math.round((frames / dt) * 1000))
      else requestAnimationFrame(loop)
    }
    requestAnimationFrame(loop)
  })
}

function renderStats(): void {
  const stats = snap('__all__')
  statsEl.innerHTML =
    `视口 ${window.innerWidth}x${window.innerHeight} dpr${devicePixelRatio} · ` +
    `FPS <b>${fps}</b> · 活动 tween <b>${activeTweens()}</b> · ` +
    `DOM 节点 <b>${document.querySelectorAll('*').length}</b> · ` +
    `错误 <b>${errors.length}</b>`
  void stats
}

// 每秒滚动更新一次 FPS 读数（不干扰压测）
setInterval(() => {
  void measureFps(700).then((v) => {
    fps = v
    renderStats()
  })
}, 1200)
renderStats()

/* ── 压测：同一原语连点 20 次 ─────────────────────────────── */
async function runStress(): Promise<void> {
  // looping = true 的原语本来就是常驻的：合格标准是"20 次触发只活 1 条"，
  // 而不是"活动 tween 归零"（那既做不到、也不是它该有的行为）。
  const spec: Array<{ id: TimelineId; looping: boolean }> = [
    { id: 'slashWipe', looping: false },
    { id: 'charSlam', looping: false },
    { id: 'halftoneBreathe', looping: true },
    { id: 'ripple', looping: false },
  ]
  const lines: string[] = ['── 连点 20 次压测（预热一次让池子/拆字节点就位后再比）──']
  for (const { id, looping } of spec) {
    playOne(id)
    await WAIT(700)
    const before = snap(id)
    for (let i = 0; i < 20; i++) {
      playOne(id)
      await WAIT(22)
    }
    // 等最后一条时间线自己跑完（GSAP 时间线是 thenable），最多等 8s
    const last = timelineCache.get(id) as unknown as { then?: () => Promise<void> } | undefined
    if (last?.then) await Promise.race([last.then(), WAIT(8000)])
    await WAIT(250)

    const after = snap(id)
    const ok =
      after.nodes === before.nodes &&
      after.bands === 0 &&
      after.rings === 0 &&
      (looping ? after.active <= 1 : after.active === 0 && after.dirty === 0)
    lines.push(
      `${ok ? 'PASS' : 'FAIL'} ${id.padEnd(18)} 节点 ${before.nodes}→${after.nodes} · 活动tween ${after.active}${looping ? '(常驻·上限1)' : ''} · 可见色带 ${after.bands} · 存活环 ${after.rings} · 脏内联 ${after.dirty}${looping ? '(常驻保留)' : ''}`,
    )
    reportEl.textContent = lines.join('\n')
  }
  reportEl.innerHTML = lines
    .map((l) => (l.startsWith('PASS') ? `<em>${l}</em>` : l.startsWith('FAIL') ? `<s>${l}</s>` : l))
    .join('\n')
  renderStats()
}

/* ── 满负载测 FPS ─────────────────────────────────────────── */
async function runBench(seconds = 3): Promise<void> {
  reportEl.textContent = '六个原语同时上负载，实测中…'
  const ids: TimelineId[] = ['slashWipe', 'charSlam', 'halftoneBreathe', 'ripple']
  const timers = ids.map((id, i) => window.setInterval(() => playOne(id), 520 + i * 130))

  parallaxHandle?.destroy()
  parallaxHandle = parallax('.parallax-layer', { maxShift: 26, smoothing: 0.2 })
  parallaxHandle.start()
  const drive = window.setInterval(() => {
    const t = performance.now() / 900
    parallaxHandle?.set(Math.sin(t), Math.cos(t * 0.7) * 0.6)
  }, 40)

  const measured = await measureFps(seconds * 1000)

  timers.forEach((t) => window.clearInterval(t))
  window.clearInterval(drive)
  await WAIT(150)
  // 撤除负载：把还挂着的时间线全部杀掉，再验证确实归零 —— 证明没漏时间线
  timelineCache.forEach((tl) => tl.kill())
  timelineCache.clear()
  parallaxHandle?.destroy()
  parallaxHandle = null
  await WAIT(300)
  const leftover = activeTweens()

  reportEl.innerHTML =
    `<em>FPS = ${measured}</em>（六原语同时负载 ${seconds}s · 视口 ${window.innerWidth}x${window.innerHeight} dpr${devicePixelRatio}）\n` +
    `负载撤除并 kill 全部时间线后：活动 tween = ${leftover}（应为 0）`
  renderStats()
}

/* ── 复位 ─────────────────────────────────────────────────── */
function resetAll(): void {
  timelineCache.forEach((tl) => tl.kill())
  timelineCache.clear()
  parallaxHandle?.destroy()
  parallaxHandle = null
  gsap.globalTimeline.getChildren(true, true, true).forEach((a) => a.kill())
  document.querySelectorAll<HTMLElement>('.mt-band').forEach((b) => {
    gsap.set(b, { display: 'none', clearProps: 'transform' })
  })
  document.querySelectorAll<HTMLElement>('.mt-ring').forEach((r) => gsap.set(r, { opacity: 0, scale: 0 }))
  document.querySelectorAll<HTMLElement>('.mt-char').forEach((c) => gsap.set(c, { clearProps: 'transform,opacity,filter' }))
  reportEl.textContent = '已复位。'
  renderStats()
}

/* ── 交互接线 ─────────────────────────────────────────────── */
document.querySelectorAll<HTMLButtonElement>('[data-play]').forEach((btn) => {
  btn.addEventListener('click', () => playOne(btn.dataset.play as CardId))
})
document.querySelector('#btn-all')?.addEventListener('click', () => {
  ;(CARDS.map((c) => c.id) as CardId[]).forEach((id) => playOne(id))
})
document.querySelector('#btn-stress')?.addEventListener('click', () => {
  void runStress()
})
document.querySelector('#btn-bench')?.addEventListener('click', () => {
  void runBench()
})
document.querySelector('#btn-reset')?.addEventListener('click', resetAll)
stageOf('ripple').addEventListener('pointerdown', (e) => {
  const rect = stageOf('ripple').getBoundingClientRect()
  ripple(stageOf('ripple'), {
    duration: 1.5,
    intensity: 0.75,
    rings: 3,
    origin: {
      x: (e.clientX - rect.left) / rect.width,
      y: (e.clientY - rect.top) / rect.height,
    },
  })
})

/* ── 取证模式（给 verify/shot.mjs 用） ───────────────────── */
const params = new URLSearchParams(location.search)
const play = params.get('play')
const atRaw = params.get('at')
const at = atRaw === null ? undefined : Math.max(0, Math.min(1, Number(atRaw)))
const only = params.get('only')

// ?only=<id> 只留一张卡：逐个原语在高有效分辨率下看真身
if (only) {
  CARDS.forEach((c) => {
    if (c.id !== only) document.querySelector(`#card-${c.id}`)?.remove()
  })
}
const present = CARDS.map((c) => c.id).filter((id) => document.querySelector(`#stage-${id}`))

if (play) {
  const targets = play === 'all' ? present : present.filter((id) => id === play)
  targets.forEach((id) => playOne(id, at))
  reportEl.textContent = `取证模式：${play} 定格 @ ${((at ?? 0.45) * 100).toFixed(0)}%`
}

if (params.get('stress') === '1') {
  void runStress().then(() => {
    document.title = 'stress-done'
  })
}

if (params.get('bench') === '1') {
  void runBench().then(() => {
    document.title = 'bench-done'
  })
}

if (errors.length) {
  reportEl.textContent += `\n⚠ ${errors.length} 条错误：\n${errors.join('\n')}`
}
