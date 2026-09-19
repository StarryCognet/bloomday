/**
 * 礼物盒幕 —— 全程唯一一次"她做了一件事"。
 *
 * 点盒子：盖子飞开 + 彩纸炸开 + 四张图从盒里飞出来摊成一把扇子。
 * 点某张图：弹簧按压 + 放大查看（放大层挂在 body 上，见下）。
 * 被标 hidden 的几张全程只显示盖板、不露内容，而且**没有任何解锁开关**。
 */
import gsap from 'gsap'
import { SITE } from '../site.config'
import { canvasPalette } from '../tokens'
import { EASE, skipMotion } from '../motion'
import type { ActDefinition, ActState } from '../motion/director'

interface Confetti {
  x: number
  y: number
  vx: number
  vy: number
  rot: number
  vrot: number
  w: number
  h: number
  color: string
  life: number
}

export function createGift(el: HTMLElement): ActDefinition {
  const cards = SITE.copy.gift.cards
  const coverText = SITE.copy.gift.coverText

  const cardsHtml = cards
    .map(
      (c, i) =>
        '<figure class="gift__card' +
        (c.hidden ? ' is-covered' : '') +
        '" data-i="' +
        i +
        '"><img src="' +
        c.src +
        '" alt="" loading="lazy" decoding="async" />' +
        (c.hidden ? '<span class="gift__cover"><b>' + coverText + '</b></span>' : '') +
        '</figure>',
    )
    .join('')

  el.innerHTML =
    '<div class="gift">' +
    '<canvas class="gift__cv" id="gift-cv"></canvas>' +
    '<p class="gift__label t-label">' +
    SITE.copy.gift.label +
    '</p>' +
    '<div class="gift__cards" id="gift-cards">' +
    cardsHtml +
    '</div>' +
    '<button class="gift__box" id="gift-box" type="button" aria-label="打开礼物">' +
    '<span class="gift__lid"></span><span class="gift__body"></span><span class="gift__ribbon"></span>' +
    '</button>' +
    '<p class="gift__line t-body" id="gift-line">' +
    SITE.copy.gift.line +
    '</p>' +
    '<p class="gift__after t-h2" id="gift-after">' +
    SITE.copy.gift.after +
    '</p>' +
    '</div>'

  /**
   * 放大层挂在 body 上，不放幕里。
   * 原因：.act 有 z-index:2，会形成层叠上下文 —— 固定在幕里的元素哪怕
   * z-index 写 999 也逃不出这一层，会被顶部导航（z-index:40）压住。
   */
  const viewer = document.createElement('div')
  viewer.className = 'gift__viewer'
  viewer.id = 'gift-viewer'
  viewer.setAttribute('aria-hidden', 'true')
  viewer.innerHTML =
    '<span class="gift__viewer-scrim"></span>' +
    '<figure class="gift__viewer-card" id="gift-viewer-card">' +
    '<img id="gift-viewer-img" alt="" />' +
    '<span class="gift__cover" id="gift-viewer-cover"><b>' +
    coverText +
    '</b></span>' +
    '</figure>' +
    '<p class="gift__viewer-hint">点一下关掉</p>'
  document.body.appendChild(viewer)

  const canvas = el.querySelector<HTMLCanvasElement>('#gift-cv')!
  const boxEl = el.querySelector<HTMLElement>('#gift-box')!
  const lidEl = el.querySelector<HTMLElement>('.gift__lid')!
  const lineEl = el.querySelector<HTMLElement>('#gift-line')!
  const afterEl = el.querySelector<HTMLElement>('#gift-after')!
  const cardEls = Array.from(el.querySelectorAll<HTMLElement>('.gift__card'))
  const vCard = viewer.querySelector<HTMLElement>('#gift-viewer-card')!
  const vImg = viewer.querySelector<HTMLImageElement>('#gift-viewer-img')!
  const vCover = viewer.querySelector<HTMLElement>('#gift-viewer-cover')!
  const ctxMaybe = canvas.getContext('2d')

  const palette = canvasPalette()
  const COLORS = [palette.cyan, palette.mid, palette.white, palette.midLight]

  const bits: Confetti[] = []
  let cssW = 0
  let cssH = 0
  let last = 0
  let opened = 0
  let openedViewer = -1
  let active = false

  function resize(): void {
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    cssW = canvas.clientWidth || window.innerWidth
    cssH = canvas.clientHeight || window.innerHeight
    canvas.width = Math.round(cssW * dpr)
    canvas.height = Math.round(cssH * dpr)
    if (ctxMaybe) ctxMaybe.setTransform(dpr, 0, 0, dpr, 0, 0)
  }

  function burst(): void {
    const cx = cssW / 2
    const cy = cssH * 0.52
    const n = skipMotion() ? 0 : 120
    for (let i = 0; i < n; i++) {
      const ang = Math.random() * Math.PI * 2
      const speed = 180 + Math.random() * 520
      bits.push({
        x: cx,
        y: cy,
        vx: Math.cos(ang) * speed,
        vy: Math.sin(ang) * speed - 220,
        rot: Math.random() * Math.PI,
        vrot: (Math.random() - 0.5) * 14,
        w: 5 + Math.random() * 9,
        h: 9 + Math.random() * 14,
        color: COLORS[i % COLORS.length] ?? palette.cyan,
        life: 1.6 + Math.random() * 1.2,
      })
    }
  }

  function frame(now: number): void {
    const dt = last ? Math.min((now - last) / 1000, 0.05) : 0
    last = now
    requestAnimationFrame(frame)
    const c = ctxMaybe
    if (!c || !active) return
    c.clearRect(0, 0, cssW, cssH)
    for (let i = bits.length - 1; i >= 0; i--) {
      const b = bits[i]!
      b.life -= dt
      if (b.life <= 0) {
        bits.splice(i, 1)
        continue
      }
      b.vy += 760 * dt
      b.vx *= 1 - 1.4 * dt
      b.x += b.vx * dt
      b.y += b.vy * dt
      b.rot += b.vrot * dt
      c.save()
      c.translate(b.x, b.y)
      c.rotate(b.rot)
      c.globalAlpha = Math.min(1, b.life)
      c.fillStyle = b.color
      c.fillRect(-b.w / 2, -b.h / 2, b.w, b.h)
      c.restore()
    }
  }

  /** 四张图摊成一把扇子：中间的最高，两边依次向外向下 */
  function fanOut(): void {
    const span = cardEls.length - 1
    cardEls.forEach((card, i) => {
      const off = i - span / 2
      gsap.fromTo(
        card,
        { opacity: 0, scale: 0.3, x: 0, y: 126, rotate: 0 },
        {
          opacity: 1,
          scale: 1,
          x: off * 74,
          y: -Math.abs(off) * 10,
          rotate: off * 11,
          duration: 0.72,
          delay: 0.1 + i * 0.075,
          ease: EASE.pop,
          transformOrigin: '50% 100%',
        },
      )
    })
  }

  function open(): void {
    if (!active) return
    opened++
    burst()
    if (skipMotion()) {
      gsap.set(lidEl, { y: -180, rotate: -26 })
      gsap.set(lineEl, { opacity: 0 })
      gsap.set(afterEl, { opacity: 1 })
      const span = cardEls.length - 1
      cardEls.forEach((card, i) => {
        const off = i - span / 2
        gsap.set(card, { opacity: 1, x: off * 74, y: -Math.abs(off) * 10, rotate: off * 11 })
      })
      return
    }
    fanOut()
    gsap.to(lidEl, { y: -180, rotate: -26, duration: 0.7, ease: EASE.pop })
    gsap.to(boxEl, { scale: 1.04, duration: 0.18, yoyo: true, repeat: 1, ease: EASE.drift })
    gsap.to(lineEl, { opacity: 0, y: -10, duration: 0.35, ease: EASE.sink })
    gsap.fromTo(
      afterEl,
      { opacity: 0, y: 16 },
      { opacity: 1, y: 0, duration: 0.55, delay: 0.42, ease: EASE.drift, clearProps: 'transform' },
    )
  }

  /** 点某张图：弹簧按压 + 放大查看 */
  function openViewer(i: number): void {
    const c = cards[i]
    const card = cardEls[i]
    if (!c || !card) return
    openedViewer = i

    // 被盖住的：放大层里也只显示盖板，图片根本不加载 —— 从根上不露内容
    if (c.hidden) {
      vImg.removeAttribute('src')
      vCover.hidden = false
    } else {
      vImg.src = c.src
      vCover.hidden = true
    }

    viewer.classList.add('is-open')
    viewer.setAttribute('aria-hidden', 'false')

    if (skipMotion()) {
      gsap.set(vCard, { opacity: 1, scale: 1, rotate: 0 })
      return
    }
    // 按下的那一下：先缩，再弹回来
    gsap.fromTo(card, { scale: 0.88 }, { scale: 1, duration: 0.8, ease: EASE.spring })
    gsap.fromTo(
      vCard,
      { opacity: 0, scale: 0.45, rotate: -8 },
      { opacity: 1, scale: 1, rotate: 0, duration: 0.9, ease: EASE.spring },
    )
  }

  function closeViewer(): void {
    if (openedViewer < 0) return
    openedViewer = -1
    viewer.classList.remove('is-open')
    viewer.setAttribute('aria-hidden', 'true')
    if (skipMotion()) return
    gsap.to(vCard, { opacity: 0, scale: 0.7, duration: 0.24, ease: EASE.sink })
  }

  viewer.addEventListener('click', closeViewer)
  cardEls.forEach((card, i) => {
    card.style.pointerEvents = 'auto'
    card.addEventListener('click', (ev) => {
      ev.stopPropagation()
      openViewer(i)
    })
  })

  boxEl.addEventListener('click', open)

  function setState(_node: HTMLElement, state: ActState): void {
    active = state === 'active'
    if (state === 'past') gsap.set(el, { opacity: 0.25 })
    else if (state === 'future') gsap.set(el, { opacity: 0 })
    else gsap.set(el, { opacity: 1, clearProps: 'opacity' })
    // 幕滚出去了就把放大层收掉，免得它孤零零留在屏幕上
    if (!active) closeViewer()
  }

  function enter(): gsap.core.Timeline | void {
    if (skipMotion()) return
    return gsap.timeline().fromTo(
      boxEl,
      { opacity: 0, scale: 0.86 },
      { opacity: 1, scale: 1, duration: 0.6, ease: EASE.pop, clearProps: 'transform' },
    )
  }

  resize()
  window.addEventListener('resize', resize)
  requestAnimationFrame(frame)

  // 自己观察视口：本站各幕都是自管状态，没有中心导演驱动
  const io = new IntersectionObserver(
    (entries) => {
      const e = entries[0]
      if (e) setState(el, e.isIntersecting && e.intersectionRatio >= 0.3 ? 'active' : 'future')
    },
    { threshold: [0, 0.3] },
  )
  io.observe(el)

  ;(window as unknown as { __gift?: () => unknown }).__gift = () => ({
    opened,
    bits: bits.length,
    active,
    cards: cardEls.length,
    covered: el.querySelectorAll('.gift__card.is-covered').length,
    viewer: openedViewer,
    viewerImg: vImg.getAttribute('src') ?? '(未加载)',
    summary:
      `礼物盒 · 打开 ${opened} 次 · 彩纸 ${bits.length} 片 · 飞出 ${cardEls.length} 张` +
      `（盖住 ${el.querySelectorAll('.gift__card.is-covered').length} 张）· 放大中=${openedViewer} · 当前幕=${active}`,
  })

  return { id: 'gift', el, setState, enter }
}
