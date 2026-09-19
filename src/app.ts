/**
 * 主站入口 —— 当前只实现「入场封印」这一幕。
 *
 * 【边界声明】`#next` 是**最小转场占位**（一行字 + 底色），只服务于
 * "点击后进下一幕、中间无黑屏/白屏"这一条验收标准。它**不是**生日主视觉，
 * 主视觉属于下一个小类，此处不实现其内容。
 *
 * 【首屏设计原则】除日期外，所有信息**不做淡入**，只做位移入场。
 * 原因：淡入意味着她在 t=0 看到的是一片黑 —— 那是最糟的第一印象，
 * 也直接违反"不点也能看清首屏全部信息"。
 */
import gsap from 'gsap'
import { EASE, allowResident, charSlam, motionStrength, setMotionStrength, skipMotion, slashWipe } from './motion'
import { geometry } from './tokens'
import { SITE, effectiveStrength } from './site.config'
import { createMainVisual } from './acts/main-visual'
import { createBlessing } from './acts/blessing'
import { createGallery } from './acts/gallery'
import { createFinale } from './acts/finale'
import { createLyricsLayer } from './acts/lyrics-layer'
import { createSmooth } from './smooth'
import { createChrome } from './chrome'
import { createScrollReveal } from './acts/scroll-reveal'
import { createGalleryPin } from './acts/gallery-pin'
import { createRibbons } from './ribbons'
import { createPulse } from './acts/pulse'
import { createGift } from './acts/gift'
import { createViewer } from './viewer'
import { createCaustics } from './acts/caustics'

/** 动效强度由站点入口注入内核 —— 内核不认识 site.config，方向上不能反过来 */
const reduceMQ = window.matchMedia('(prefers-reduced-motion: reduce)')
// 系统的「减弱动态效果」等价于 strength 0 —— 只认自己的开关、不理系统设置是说不过去的
setMotionStrength(reduceMQ.matches ? 0 : effectiveStrength())
reduceMQ.addEventListener('change', () => {
  setMotionStrength(reduceMQ.matches ? 0 : effectiveStrength())
})

/** 内容全部来自 src/site.config.ts，这里只是取个别名，不存任何字面量 */
const SEAL = {
  eyebrow: SITE.copy.seal.eyebrow,
  date: SITE.dateLabel,
  name: SITE.name,
  age: SITE.age,
  cta: SITE.copy.seal.cta,
  hint: SITE.copy.seal.hint,
}

const app = document.querySelector<HTMLDivElement>('#app')
if (!app) throw new Error('#app 不存在')

app.innerHTML = `
  <main class="seal" id="seal">
    <!-- 序章：明日方舟 × P3R 联动「月行水上」开屏（public/ark，已关掉 90° 旋转） -->
    <div class="seal__ark">
      <iframe id="ark-frame" src="./ark/index.html" title="开场动画" scrolling="no"></iframe>
    </div>
    <span class="seal__veil"></span>
    <div class="seal__art" id="seal-art">
      <canvas class="seal__caustics" id="seal-caustics"></canvas>
      <span class="seal__halftone"></span>
      <span class="seal__slash seal__slash--a"></span>
      <span class="seal__slash seal__slash--b"></span>
      <span class="seal__slash seal__slash--c"></span>
    </div>

    <span class="seal__corner seal__corner--tl"></span>
    <span class="seal__corner seal__corner--tr"></span>
    <span class="seal__corner seal__corner--bl"></span>
    <span class="seal__corner seal__corner--br"></span>

    <div class="seal__meta">
      <p class="seal__brand">BLOOMDAY</p>
      <p class="seal__sale">SEP 19 · 2026</p>
    </div>

    <nav class="seal__nav" aria-hidden="true">
      <span>生日快乐</span><span>12</span><span>9.19</span><span>祝福</span><span class="is-on">${SEAL.cta}</span>
    </nav>

    <div class="seal__logo">
      <div class="seal__mark">
        <span class="seal__mark-slab"></span>
        <span class="seal__mark-num" id="seal-date">${SEAL.date}</span>
      </div>
      <p class="seal__logo-sub">${SEAL.name}的生日</p>
      <p class="seal__logo-tiny">BLOOMDAY 2026</p>
    </div>

    <p class="seal__greeting">${SEAL.name}，今天是你 <b class="seal__age">${SEAL.age}</b> 岁的生日。</p>

    <button class="seal__cta" id="seal-cta" type="button">
      <span class="seal__cta-glow" id="seal-glow"></span>
      <span class="seal__cta-arrow">▶</span>
      <span class="seal__cta-text">${SEAL.cta}</span>
    </button>
    <p class="seal__scroll">SCROLL</p>
    <p class="seal__tap">点一下开始</p>
  </main>
  <section class="act" id="act-mv"></section>
  <section class="act" id="act-blessing"></section>
  <section class="act" id="act-pulse"></section>
  <section class="act" id="act-gift"></section>
  <section class="act" id="act-gallery"></section>
  <section class="act" id="act-finale"></section>
`

const sealEl = document.querySelector<HTMLElement>('#seal')!
// 水波焦散层（P3R 的水纹母题）：常驻在蓝色色区里
createCaustics(document.querySelector<HTMLCanvasElement>('#seal-caustics')!)
const dateEl = document.querySelector<HTMLElement>('#seal-date')!
const cta = document.querySelector<HTMLButtonElement>('#seal-cta')!
const glow = document.querySelector<HTMLElement>('#seal-glow')!
const nextEl = document.querySelector<HTMLElement>('#act-mv')!
/** 主视觉在封印底下静静等着被擦出来（初始即 active），不是点击后才凭空出现 */
const mainVisual = createMainVisual(nextEl)
const blessing = createBlessing(document.querySelector<HTMLElement>('#act-blessing')!)
/** 共用放大层：礼物卡片和 30 张图都用它。挂在 body 上，才盖得过顶部导航 */
const viewer = createViewer()

const gallery = createGallery(document.querySelector<HTMLElement>('#act-gallery')!, viewer)
const finale = createFinale(document.querySelector<HTMLElement>('#act-finale')!)
/** 歌词层：常驻悬浮在屏幕下方，跟着 BGM 走 */
const lyrics = createLyricsLayer(document.querySelector<HTMLAudioElement>('#bgm'))

/** 常驻 UI 框架：四角标记 + 顶部细导航 + 品牌条 —— 站点级，不属于任何一幕 */
const chrome = createChrome([
  { label: '9.19' },
  { label: '祝福' },
  { label: '律动' },
  { label: '礼物' },
  { label: '角色' },
  { label: '许愿' },
])
chrome.setActive(-1) // 开屏阶段整条熄灭

/** 滚动显现：每一幕滚进视口时，字逐个显出来 */
const pick = (sel: string, root: HTMLElement): HTMLElement => root.querySelector<HTMLElement>(sel)!
/** 画廊钉住：滚到这一幕就停住，继续往下滚 = 图片横向走，走完才放行 */
const galleryPin = createGalleryPin(document.getElementById('act-gallery')!, document.getElementById('gal-track')!)

/** 粒子飘带：能量来自 BGM 的实时频谱 */
let analyserNode: AnalyserNode | null = null
const ribbons = createRibbons(() => analyserNode)

/** 可视化幕 + 礼物盒幕：夹在文案和图片之间，补上中间缺的视觉高点与参与感 */
const pulse = createPulse(document.getElementById('act-pulse')!, () => analyserNode)
const gift = createGift(document.getElementById('act-gift')!)
void pulse
void gift


/**
 * 在用户手势里挂分析节点。
 * 两个必须记住的点：
 *  1. AudioContext 必须在手势里创建，否则一直是 suspended；
 *  2. createMediaElementSource 之后，元素的输出**只走这张图** ——
 *     不把 analyser 接回 destination 就没声音了。
 * 失败就退化成固定能量，音乐不受影响（元素没被动过）。
 */
function attachAnalyser(): void {
  const el = document.querySelector<HTMLAudioElement>('#bgm')
  if (!el || analyserNode) return
  try {
    const actx = new AudioContext()
    const src = actx.createMediaElementSource(el)
    const an = actx.createAnalyser()
    an.fftSize = 256
    an.smoothingTimeConstant = 0.82
    src.connect(an)
    an.connect(actx.destination)
    void actx.resume()
    analyserNode = an
  } catch {
    analyserNode = null
  }
}

const reveals = [
  createScrollReveal(document.getElementById('act-mv')!, [
    { el: pick('.mv__eyebrow', document.getElementById('act-mv')!), mode: 'fade' },
    { el: pick('#mv-date', document.getElementById('act-mv')!), mode: 'chars' },
    { el: pick('#mv-age', document.getElementById('act-mv')!), mode: 'chars' },
    { el: pick('.mv__title', document.getElementById('act-mv')!), mode: 'chars' },
  ]),
  createScrollReveal(document.getElementById('act-gallery')!, [
    { el: pick('.gal__eyebrow', document.getElementById('act-gallery')!), mode: 'fade' },
    { el: pick('.gal__lead', document.getElementById('act-gallery')!), mode: 'chars' },
    { el: pick('.gal__hint', document.getElementById('act-gallery')!), mode: 'fade' },
  ]),
  createScrollReveal(document.getElementById('act-finale')!, [
    { el: pick('.fin__wish', document.getElementById('act-finale')!), mode: 'fade' },
  ]),
]

/** 滚动时高亮当前幕 */
const actEls = ['act-mv', 'act-blessing', 'act-pulse', 'act-gift', 'act-gallery', 'act-finale']
  .map((id) => document.getElementById(id))
  .filter((e): e is HTMLElement => e !== null)
window.addEventListener(
  'scroll',
  () => {
    const mid = window.scrollY + window.innerHeight * 0.45
    let best = 0
    actEls.forEach((el, i) => {
      if (el.offsetTop <= mid) best = i
    })
    chrome.setActive(best)
  },
  { passive: true },
)

/** 封印还在的时候锁住滚动：否则她能在蓝板子后面乱划，看不到自己在哪 */
const smooth = createSmooth()

// 封印期间只用 CSS 锁滚动（html.is-sealed{overflow:hidden}）。
// 不要再调 smooth.stop()：那是第二套抢滚动权的机制，
// 和 Lenis 自己的状态机叠在一起会让进站后彻底滚不动（已实测）。
document.documentElement.classList.add('is-sealed')
const audio = document.querySelector<HTMLAudioElement>('#bgm')
// BGM 路径也来自配置源
if (audio) audio.src = SITE.bgm

/* ── 进场（P3R 式开幕）─────────────────────────────────────
   蓝色大色区从左侧斜切砸入 → 色区里的斜切亮带依次拉开 → 细字与导航条画入 →
   logo 式日期砸入 → 副行与入口依次落位 → 四角标记扣上。

   注意两点没变：
   1) 给妹妹的话与「点我开始」**只做位移、不做淡入** —— 任何一帧都读得到。
   2) 强度 0 时整段跳过：元素本来就在自然位置、默认可读。 */
if (!skipMotion()) {
  const intro = gsap.timeline()
  intro.fromTo(
    '.seal__art',
    { xPercent: -104, skewX: geometry.skew.steep },
    { xPercent: 0, skewX: 0, duration: 0.85, ease: EASE.tear, clearProps: 'transform' },
    0,
  )
  intro.fromTo(
    '.seal__slash',
    { scaleX: 0 },
    { scaleX: 1, duration: 0.6, ease: EASE.tear, stagger: 0.11, clearProps: 'transform' },
    0.42,
  )
  intro.from(
    ['.seal__brand', '.seal__sale'],
    { opacity: 0, x: -16, duration: 0.5, ease: EASE.drift, stagger: 0.08 },
    0.2,
  )
  intro.from(
    '.seal__nav span',
    { opacity: 0, y: -6, duration: 0.34, ease: EASE.drift, stagger: 0.045 },
    0.34,
  )
  intro.add(charSlam(dateEl, { direction: 'up', duration: 0.8, intensity: 0.95, stagger: 0.08 }), 0.56)
  intro.from(
    ['.seal__logo-sub', '.seal__logo-tiny', '.seal__greeting'],
    { y: 18, duration: 0.55, ease: EASE.drift, stagger: 0.09, clearProps: 'transform' },
    0.86,
  )
  intro.from('.seal__cta', { y: 22, duration: 0.5, ease: EASE.pop, clearProps: 'transform' }, 1.05)
  intro.from('.seal__scroll', { opacity: 0, duration: 0.5 }, 1.2)
  intro.from(
    '.seal__corner',
    { opacity: 0, scale: 0.5, duration: 0.4, ease: EASE.pop, stagger: 0.05, clearProps: 'transform' },
    1.1,
  )
}

/* 「点我开始」呼吸脉冲：常驻，点击时杀掉，避免和转场抢同一个元素 */
if (allowResident()) {
  const pulse = gsap.timeline({ repeat: -1, yoyo: true })
  pulse.fromTo(
    glow,
    { opacity: 0.2, scale: 0.97 },
    { opacity: 0.55, scale: 1.03, duration: 1.15, ease: EASE.breathe },
  )
  cta.addEventListener('click', () => pulse.kill(), { once: true })
}

/* ── 点击进入 ───────────────────────────────────────────────
   音频 play() 必须发生在用户手势的同一个调用栈里，否则 iOS/微信不解锁 */
let started = false

function playBreak(): Promise<void> {
  return new Promise((resolve) => {
    // 强度 0：不做擦除转场，封印直接让开
    if (skipMotion()) {
      sealEl.style.display = 'none'
      mainVisual.enter?.(nextEl)
      resolve()
      return
    }
    const tl = gsap.timeline({ onComplete: resolve })
    // P3R 式退场：封印内容先散开 → 一条斜切亮带扫过蓝色色区 → 整块白底向上抽走，
    // 露出下面的暗蓝主场。**不做全屏擦除盖层**（那会变成"整屏遮盖"，前几轮栽过）。
    tl.to(
      ['.seal__logo', '.seal__meta', '.seal__greeting', '.seal__cta', '.seal__scroll', '.seal__nav', '.seal__corner'],
      { y: -38, opacity: 0, duration: 0.18, ease: EASE.sink, stagger: 0.022 },
      0,
    )
    tl.add(slashWipe('.seal__art', { direction: 'left', duration: 0.42, intensity: 0.7 }), 0.04)
    tl.to('.seal__art', { yPercent: -12, duration: 0.42, ease: EASE.sink }, 0.06)
    tl.to(sealEl, { yPercent: -100, duration: 0.4, ease: EASE.tear }, 0.12)
    tl.set(sealEl, { display: 'none' }, 0.54)
    // 序章是一次性的：让开之后把 iframe 从 DOM 摘掉。
    // 摘掉会销毁它的浏览上下文，连带停掉 60Hz 的曲线求值 rAF、音频和
    // 4MB 解码后的贴图。不摘的话她在后面几幕里，序章还在后台空转烧电。
    tl.call(() => document.getElementById('ark-frame')?.remove(), undefined, 0.56)
    // 主视觉 0.15s 就起手（它的文字在进场前是藏着的），这样封印一让开就已经在砸字，
    // 不会出现"屏幕上什么都没有"的空档。
    tl.call(() => mainVisual.enter?.(nextEl), undefined, 0.15)
  })
}

function enter(): void {
  if (started) return
  started = true
  cta.disabled = true

  // 同步发起播放（不要先 await 别的），再处理失败
  attachAnalyser()
  if (audio) {
    audio.volume = 1
    const p = audio.play()
    if (p) p.catch(() => undefined)
  }

  void playBreak().then(() => {
    document.documentElement.classList.remove('is-sealed')
    chrome.setActive(0)
    reveals.forEach((r) => r.arm())
    galleryPin.layout()
    // 钉住改了文档高度，Lenis 的上限必须跟着重算，否则滚不到底部
    smooth.resize()
    window.scrollTo(0, 0)
    // 祝福幕随时可被读到；这里只把它标成就位
    blessing.setState(blessing.el, 'active')
    gallery.setState(gallery.el, 'active')
    finale.setState(finale.el, 'active')
  })
}

cta.addEventListener('click', enter)
// 序章之后点屏幕任意处直接进站。用捕获阶段，免得被封印里的元素吃掉。
sealEl.addEventListener('click', enter, { capture: true })
// 一进来先把文字藏着，只放序章
sealEl.classList.add('is-stowed')

/* ── 自检钩子：给验证工具读「配置写进去的值」与「页面实际渲染出来的值」──
   验证"只改配置文件就够"靠的就是比对这两组值，而不是靠我保证。 */
declare global {
  interface Window {
    __site?: unknown
    __siteReport?: () => unknown
  }
}

function countActiveDomTweens(onlyMoving = false): number {
  let n = 0
  gsap.globalTimeline.getChildren(true, true, true).forEach((a) => {
    const anim = a as gsap.core.Animation
    if (!anim.isActive()) return
    // onlyMoving：滤掉 gsap.set 那种 0 时长的"瞬时落位"。
    // 强度 0 时仍会有瞬时落位（内容总得摆到该在的位置），但那不是动效 ——
    // 不区分的话，指标会把"摆位置"算成"在动"，看起来像降级没生效。
    if (onlyMoving && anim.duration() <= 0.05) return
    const t = (anim as unknown as { targets?: () => Element[] }).targets?.()
    if (t && t.length > 0) n++
  })
  return n
}

/** 峰值那一刻到底是谁在动 —— 不点名就等于没验证 */
function movingTweenInfo(): string[] {
  const out: string[] = []
  gsap.globalTimeline.getChildren(true, true, true).forEach((a) => {
    const anim = a as gsap.core.Animation
    if (!anim.isActive() || anim.duration() <= 0.05) return
    const t = (anim as unknown as { targets?: () => Element[] }).targets?.() ?? []
    const names = t.map((e) => (typeof e.className === 'string' && e.className ? e.className : e.tagName))
    out.push(`${anim.constructor.name} ${anim.duration().toFixed(2)}s → ${names.join(',')}`)
  })
  return out
}

/** 从加载起连续采样取峰值 —— 单点采样会取到"动画已经跑完"的时刻，两边都是 0，分不出差别 */
let peakDomTweens = 0
let peakMovingTweens = 0
let peakDetail: string[] = []
let samplingPeak = true
const samplePeak = (): void => {
  if (!samplingPeak) return
  const all = countActiveDomTweens()
  const moving = countActiveDomTweens(true)
  if (all > peakDomTweens) peakDomTweens = all
  if (moving > peakMovingTweens) {
    peakMovingTweens = moving
    peakDetail = movingTweenInfo()
  }
  requestAnimationFrame(samplePeak)
}
requestAnimationFrame(samplePeak)
window.setTimeout(() => {
  samplingPeak = false
}, 6000)

function siteReport(): unknown {
  const text = (sel: string): string => (document.querySelector(sel)?.textContent ?? '').trim()
  const charCount = (sel: string): number => text(sel).replace(/\s/g, '').length
  return {
    config: {
      name: SITE.name,
      age: SITE.age,
      dateLabel: SITE.dateLabel,
      dateFull: SITE.dateFull,
      bgm: document.querySelector<HTMLAudioElement>('#bgm')?.getAttribute('src') ?? '',
      gallerySrcs: SITE.gallery.map((g) => g.src),
      /** 配置文件里写的值 */
      configuredStrength: SITE.motion.strength,
      /** 实际注入内核的值（会被系统「减弱动态效果」拉成 0）—— 读数要看这个 */
      injectedStrength: motionStrength(),
      reducedMotion: reduceMQ.matches,
    },
    rendered: {
      sealGreeting: text('.seal__greeting'),
      sealCta: text('.seal__cta-text'),
      mvDate: text('#mv-date'),
      mvAge: text('#mv-age'),
      mvTitle: text('#mv-title'),
      blessingBlocks: document.querySelectorAll('.blk').length,
      blessingChars: charCount('.bs'),
      galleryCards: document.querySelectorAll('.gcard').length,
      galleryNames: Array.from(document.querySelectorAll('.gcard__tag-name')).map((n) => n.textContent?.trim() ?? ''),
      finaleHb: text('.fin__hb'),
      finaleSign: text('#fin-sign'),
      finaleDate: text('#fin-date'),
    },
    activeDomTweens: countActiveDomTweens(),
    lyrics: lyrics.report(),
    ribbons: ribbons.report(),
    peakDomTweens,
    peakMovingTweens,
  }
}

/* ── 幕间连贯的自检钩子（第二版）──────────────────────────────
   第一版有两个结构盲区，被独立复核抓出来：采样窗口只在点击那刻开、
   头两帧整屏层进了白名单、`#seal` 被无条件跳过 ⇒ **"第一帧就在的整屏遮盖"
   永远报 0.0%**（实证：不点击注入整屏层 → 报 0；点击后注入 → 报 100%）。
   更要命的是：0.0% 与"页面真干净"并不等价，不能拿它当通过依据。

   第二版不再给"遮盖"分类，直接断言真正要的东西：
   **任意一帧，视口内可读的文字只应属于一"幕"。**
   可读 =「自身及所有祖先的 opacity 累乘 > 0.1」且「中心点没被别的元素盖住」。 */
interface JourneyReport {
  /** 逐帧统计：同时可读文字的幕数峰值（>1 就是幕间双重曝光） */
  maxActsReadable: number
  maxActsAtMs: number
  maxActsList: string[]
  overlapFrames: number
  /** 去掉白名单后的整屏不透明层（仅信息项，不参与判定） */
  coversSeen: string[]
  emptyAt: number[]
  scanned: number
  residue: string
  summary: string
}

function effectiveOpacity(el: Element): number {
  let op = 1
  let cur: Element | null = el
  while (cur && cur !== document.documentElement) {
    const cs = getComputedStyle(cur)
    if (cs.display === 'none' || cs.visibility === 'hidden') return 0
    op *= Number(cs.opacity)
    if (op <= 0.02) return 0
    cur = cur.parentElement
  }
  return op
}

/** 可读 = 透明度够 + 中心点没被盖住 */
function isReadable(el: HTMLElement): boolean {
  if (effectiveOpacity(el) <= 0.1) return false
  const r = el.getBoundingClientRect()
  const cx = Math.min(window.innerWidth - 1, Math.max(0, r.left + r.width / 2))
  const cy = Math.min(window.innerHeight - 1, Math.max(0, r.top + r.height / 2))
  const stack = document.elementsFromPoint(cx, cy)
  return stack.some((n) => n === el || el.contains(n) || n.contains(el))
}

const TEXTY = 'h1, h2, p, span, b, em, button, div'
function textElements(): HTMLElement[] {
  const out: HTMLElement[] = []
  document.querySelectorAll<HTMLElement>(TEXTY).forEach((el) => {
    const direct = Array.from(el.childNodes).some(
      (n) => n.nodeType === Node.TEXT_NODE && (n.textContent ?? '').trim().length > 0,
    )
    if (direct) out.push(el)
  })
  return out
}

/** 视口内可读文字分别属于哪几"幕" */
function actsWithReadableText(): string[] {
  const acts = new Set<string>()
  for (const el of textElements()) {
    const r = el.getBoundingClientRect()
    if (!(r.bottom > 4 && r.top < window.innerHeight - 4 && r.right > 0 && r.left < window.innerWidth)) continue
    if (!isReadable(el)) continue
    if (el.closest('#seal')) acts.add('seal')
    else {
      const act = el.closest('.act')
      if (act) acts.add(act.id || 'act')
    }
  }
  return [...acts]
}

let maxActsReadable = 0
let maxActsAtMs = -1
let maxActsList: string[] = []
let overlapFrames = 0
const coversSeen = new Set<string>()
const actsT0 = performance.now()

// 从初始化就开扫，一直扫过点击与整段转场 —— 不再"只在点击那刻开窗口"
const scanActs = (): void => {
  const since = performance.now() - actsT0
  if (since > 12000) return
  const acts = actsWithReadableText()
  // 【断言范围】"同时可读幕数 > 1"只在**封印还在的转场窗口**里才算缺陷。
  // 滚动时接缝处两幕文字同时在视口内，是任何正常文档滚动都会有的，不是缺陷——
  // 第一版把滚动阶段也计进去，报出过一个 10053ms 的假峰值。
  const sealNode = document.getElementById('seal')
  const inTransition = !!sealNode && getComputedStyle(sealNode).display !== 'none'
  if (inTransition) {
    if (acts.length > 1) overlapFrames++
    if (acts.length > maxActsReadable) {
      maxActsReadable = acts.length
      maxActsAtMs = Math.round(since)
      maxActsList = acts
    }
  }
  const vArea = window.innerWidth * window.innerHeight
  document.querySelectorAll<HTMLElement>('body *').forEach((el) => {
    const cs = getComputedStyle(el)
    if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) < 0.5) return
    const bg = cs.backgroundColor
    if (!(bg.startsWith('rgb(') || /,\s*(0?\.[5-9]\d*|1)\)\s*$/.test(bg))) return
    const r = el.getBoundingClientRect()
    const w = Math.max(0, Math.min(r.right, window.innerWidth) - Math.max(r.left, 0))
    const h = Math.max(0, Math.min(r.bottom, window.innerHeight) - Math.max(r.top, 0))
    if ((w * h) / vArea >= 0.9) {
      coversSeen.add(typeof el.className === 'string' && el.className ? el.className : el.tagName)
    }
  })
  requestAnimationFrame(scanActs)
}
requestAnimationFrame(scanActs)

async function journey(): Promise<JourneyReport> {
  const max = document.documentElement.scrollHeight - window.innerHeight
  const emptyAt: number[] = []
  let scanned = 0
  const step = 200
  for (let y = 0; y <= max; y += step) {
    window.scrollTo(0, y)
    await new Promise((r) => requestAnimationFrame(() => r(null)))
    await new Promise((r) => requestAnimationFrame(() => r(null)))
    scanned++
    if (actsWithReadableText().length === 0) emptyAt.push(y)
  }
  window.scrollTo(0, 0)
  // 等动画落定再数残留：滚回顶部时可能还有色带在飞，立刻数会把"正在跑"误报成"残留"
  await new Promise((r) => setTimeout(r, 1400))
  const visBand = Array.from(document.querySelectorAll<HTMLElement>('.mt-band')).filter(
    (b) => getComputedStyle(b).display !== 'none' && b.getBoundingClientRect().width > 0,
  ).length
  const liveRing = Array.from(document.querySelectorAll<HTMLElement>('.mt-ring')).filter(
    (r) => Number(getComputedStyle(r).opacity) > 0.02,
  ).length
  const residue = `可见色带=${visBand} 存活环=${liveRing}`
  return {
    maxActsReadable,
    maxActsAtMs,
    maxActsList,
    overlapFrames,
    coversSeen: [...coversSeen],
    emptyAt,
    scanned,
    residue,
    summary:
      `封印转场期间同时可读幕数峰值=${maxActsReadable}` +
      (maxActsReadable > 1 ? `（${maxActsList.join('+')} @ ${maxActsAtMs}ms，双重曝光 ${overlapFrames} 帧）` : '') +
      ` · 滚动扫描 ${scanned} 个位置 · 无可读文字窗口=${emptyAt.length}${emptyAt.length ? '：' + emptyAt.join(',') : ''}` +
      ` · 残留：${residue} · 整屏不透明层（信息项）=[${[...coversSeen].join(',')}]`,
  }
}
;(window as unknown as { __journey?: () => Promise<JourneyReport> }).__journey = journey

/** 一行人类可读摘要，省得跟命令行引号搏斗 */
function siteSummary(): string {
  const r = siteReport() as {
    rendered: { blessingBlocks: number; blessingChars: number; galleryCards: number; finaleSign: string; sealGreeting: string }
    config: { injectedStrength: number }
    peakDomTweens: number
    peakMovingTweens: number
  }
  return [
    `实际强度=${r.config.injectedStrength}`,
    `峰值有时长动画=${r.peakMovingTweens}`,
    `峰值全部(含瞬时落位)=${r.peakDomTweens}`,
    `段落=${r.rendered.blessingBlocks}`,
    `文案字数=${r.rendered.blessingChars}`,
    `卡片=${r.rendered.galleryCards}`,
    `称呼句="${r.rendered.sealGreeting}"`,
    `签名="${r.rendered.finaleSign}"`,
    `峰值时是谁在动=[${peakDetail.join(' ; ')}]`,
  ].join(' · ')
}
;(window as unknown as { __siteSummary?: () => string }).__siteSummary = siteSummary
window.__siteReport = siteReport
window.__site = siteReport()

/* 空格/回车也能进（桌面自测方便，不影响手机） */
window.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' || e.key === ' ') enter()
})
