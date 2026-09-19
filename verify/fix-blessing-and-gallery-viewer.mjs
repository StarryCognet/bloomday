/**
 * 1) 修祝福幕的老 bug：slam/lyric/type 那几段演完仍然看不见。
 * 2) 30 张图接上共用放大层。
 */
import { readFileSync, writeFileSync } from 'node:fs'

let miss = 0
const patch = (file, pairs) => {
  let s = readFileSync(file, 'utf8')
  for (const [from, to] of pairs) {
    if (!s.includes(from)) {
      console.log(`MISS ${file}: ${from.split('\n')[0].slice(0, 58)}`)
      miss++
      continue
    }
    s = s.replace(from, to)
    console.log(`OK   ${file}: ${from.split('\n')[0].slice(0, 58)}`)
  }
  writeFileSync(file, s, 'utf8')
}

patch('src/acts/blessing.ts', [
  [
    `    const deco = blk.querySelector<HTMLElement>('.blk__deco')
    gsap.killTweensOf([blk, ...ls, ...(deco ? [deco] : [])])

    const tl = gsap.timeline()`,
    `    const deco = blk.querySelector<HTMLElement>('.blk__deco')
    gsap.killTweensOf([blk, ...ls, ...(deco ? [deco] : [])])

    // 【必须先把"行"恢复可见】setBlockState('future') 把整行设成 opacity:0，
    // 而 charSlam 只清**字符**的内联样式、从不恢复"行" —— 少了这一句，
    // slam / lyric / type 这几类字演完仍然看不见，要等整段滚过去被置成
    // past（走 else 分支）才现出来。实测的真实症状就是这个。
    gsap.set(ls, { opacity: 1, y: 0, clearProps: 'transform,opacity,filter' })

    const tl = gsap.timeline()`,
  ],
])

patch('src/acts/gallery.ts', [
  [
    "import type { ActDefinition, ActState } from '../motion/director'",
    "import type { ActDefinition, ActState } from '../motion/director'\nimport type { ViewerHandle } from '../viewer'",
  ],
  [
    'export function createGallery(el: HTMLElement): ActDefinition {',
    'export function createGallery(el: HTMLElement, viewer: ViewerHandle): ActDefinition {',
  ],
  [
    "  track.addEventListener('scroll', onScroll, { passive: true })",
    `  track.addEventListener('scroll', onScroll, { passive: true })

  // 点图看大图（共用放大层）。降级态（图没加载出来）不响应。
  Array.from(el.querySelectorAll<HTMLElement>('.gcard')).forEach((cardEl, i) => {
    const item = SITE.gallery[i]
    const frame = cardEl.querySelector<HTMLElement>('.gcard__frame')
    if (!item || !frame) return
    frame.addEventListener('click', () => {
      if (frame.classList.contains('is-fallback')) return
      viewer.open(item.src)
    })
  })`,
  ],
])

patch('src/app.ts', [
  ["import { createGift } from './acts/gift'", "import { createGift } from './acts/gift'\nimport { createViewer } from './viewer'"],
  [
    "const gift = createGift(document.getElementById('act-gift')!)\nvoid pulse\nvoid gift",
    "const gift = createGift(document.getElementById('act-gift')!)\nvoid pulse\nvoid gift\n\n/** 共用放大层：礼物卡片和 30 张图都用它。挂在 body 上，才盖得过顶部导航 */\nconst viewer = createViewer()\nvoid viewer",
  ],
])

patch('index.html', [
  [
    '<link rel="stylesheet" href="/src/pulse.css" />',
    '<link rel="stylesheet" href="/src/pulse.css" />\n    <link rel="stylesheet" href="/src/viewer.css" />',
  ],
])

console.log(miss === 0 ? '\n全部替换成功' : `\n有 ${miss} 处未匹配`)
