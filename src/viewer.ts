import gsap from 'gsap'
import { EASE, skipMotion } from './motion'
/**
 * 共用放大查看层。
 *
 * 为什么挂在 document.body 而不是幕里：`.act` 有 z-index:2，会形成层叠
 * 上下文 —— 固定在幕里的元素哪怕 z-index 写 999 也逃不出去，会被顶部导航
 * （z-index:40）压住。
 *
 * 盖板：传 coverText 时**根本不设置图片 src**，只显示盖板。这不是"用遮罩
 * 挡住"，是从根上没有可泄露的内容。
 */
export interface ViewerHandle {
  open(src: string, opts?: { coverText?: string }): void
  close(): void
  readonly isOpen: boolean
}

export function createViewer(): ViewerHandle {
  const root = document.createElement('div')
  root.className = 'viewer'
  root.id = 'viewer'
  root.setAttribute('aria-hidden', 'true')
  root.innerHTML =
    '<span class="viewer__scrim"></span>' +
    '<figure class="viewer__card" id="viewer-card">' +
    '<img class="viewer__img" id="viewer-img" alt="" />' +
    '<span class="viewer__cover" id="viewer-cover" hidden><b></b></span>' +
    '</figure>' +
    '<p class="viewer__hint">点一下关掉</p>'
  document.body.appendChild(root)

  const card = root.querySelector<HTMLElement>('#viewer-card')!
  const img = root.querySelector<HTMLImageElement>('#viewer-img')!
  const cover = root.querySelector<HTMLElement>('#viewer-cover')!
  const coverText = cover.querySelector('b')!
  let open = false

  function close(): void {
    if (!open) return
    open = false
    root.classList.remove('is-open')
    root.setAttribute('aria-hidden', 'true')
    img.removeAttribute('src')
  }

  function show(src: string, opts?: { coverText?: string }): void {
    card.classList.toggle('is-cover', Boolean(opts?.coverText))
    if (opts?.coverText) {
      img.removeAttribute('src')
      coverText.textContent = opts.coverText
      cover.hidden = false
    } else {
      img.src = src
      cover.hidden = true
    }
    open = true
    root.classList.add('is-open')
    root.setAttribute('aria-hidden', 'false')
    if (!skipMotion()) {
      // 弹簧弹入：点开的动作要有回弹感，不是淡入
      gsap.fromTo(
        card,
        { opacity: 0, scale: 0.45, rotate: -8 },
        { opacity: 1, scale: 1, rotate: 0, duration: 0.9, ease: EASE.spring },
      )
    }
  }

  root.addEventListener('click', close)

  return {
    open: show,
    close,
    get isOpen() {
      return open
    },
  }
}
