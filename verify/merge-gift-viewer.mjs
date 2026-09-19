/**
 * 把礼物盒的放大层合并到共用层。
 *
 * 之前留了两份实现（礼物一份、共用一份），结果"盖板放大后卡片塌成一条"
 * 只在礼物那一份上修不到 —— 重复代码的真正代价。现在礼物直接用 viewer.ts。
 */
import { readFileSync, writeFileSync } from 'node:fs'

const F = 'src/acts/gift.ts'
let s = readFileSync(F, 'utf8')
let miss = 0
const rep = (from, to, label) => {
  if (!s.includes(from)) {
    console.log('MISS ' + label)
    miss++
    return
  }
  s = s.replace(from, to)
  console.log('OK   ' + label)
}

// 1) 签名 + import
rep(
  "import type { ActDefinition, ActState } from '../motion/director'",
  "import type { ActDefinition, ActState } from '../motion/director'\nimport type { ViewerHandle } from '../viewer'",
  'import ViewerHandle',
)
rep(
  'export function createGift(el: HTMLElement): ActDefinition {',
  'export function createGift(el: HTMLElement, viewer: ViewerHandle): ActDefinition {',
  '签名带 viewer',
)

// 2) 删掉自己那份放大层的 DOM
const vDom = [
  '  /**',
  '   * 放大层挂在 body 上，不放幕里。',
  '   * 原因：.act 有 z-index:2，会形成层叠上下文 —— 固定在幕里的元素哪怕',
  '   * z-index 写 999 也逃不出这一层，会被顶部导航（z-index:40）压住。',
  '   */',
  '  const viewer = document.createElement(\'div\')',
  '  viewer.className = \'gift__viewer\'',
  '  viewer.id = \'gift-viewer\'',
  '  viewer.setAttribute(\'aria-hidden\', \'true\')',
].join('\n')
const vDomEnd = "  document.body.appendChild(viewer)\n"
const start = s.indexOf(vDom)
if (start >= 0) {
  const end = s.indexOf(vDomEnd, start)
  if (end >= 0) {
    s = s.slice(0, start) + s.slice(end + vDomEnd.length)
    console.log('OK   已删除自建放大层 DOM')
  } else {
    console.log('MISS 放大层 DOM 结尾')
    miss++
  }
} else {
  console.log('MISS 放大层 DOM 开头')
  miss++
}

// 3) 删掉 vCard / vImg / vCover 三个引用
rep(
  [
    "  const vCard = viewer.querySelector<HTMLElement>('#gift-viewer-card')!",
    "  const vImg = viewer.querySelector<HTMLImageElement>('#gift-viewer-img')!",
    "  const vCover = viewer.querySelector<HTMLElement>('#gift-viewer-cover')!",
  ].join('\n'),
  '',
  '删除 vCard/vImg/vCover',
)

// 4) openViewer / closeViewer 改成调共用层
const openStart = s.indexOf('  /** 点某张图：弹簧按压 + 放大查看 */')
const closeEndMark = "  viewer.addEventListener('click', closeViewer)\n"
const closeEnd = s.indexOf(closeEndMark, openStart)
if (openStart >= 0 && closeEnd >= 0) {
  const replacement = [
    '  /** 点某张图：弹簧按压 + 交给共用放大层 */',
    '  function openViewer(i: number): void {',
    '    const c = cards[i]',
    '    const card = cardEls[i]',
    '    if (!c || !card) return',
    '    openedViewer = i',
    '    // 盖住的只传 coverText：共用层里**根本不设置 src**，从根上不泄露',
    '    if (!skipMotion()) {',
    '      gsap.fromTo(card, { scale: 0.88 }, { scale: 1, duration: 0.8, ease: EASE.spring })',
    '    }',
    '    viewer.open(c.src, c.hidden ? { coverText } : undefined)',
    '  }',
    '',
  ].join('\n')
  s = s.slice(0, openStart) + replacement + s.slice(closeEnd + closeEndMark.length)
  console.log('OK   openViewer/closeViewer 改为共用层')
} else {
  console.log('MISS openViewer 区块')
  miss++
}

// 5) setState 里收放大层
rep('    if (!active) closeViewer()', '    if (!active) viewer.close()', 'setState 收放大层')

// 6) 自检里去掉只属于自建层的字段
rep(
  "    viewerImg: vImg.getAttribute('src') ?? '(未加载)',\n",
  '',
  '自检去掉 viewerImg',
)

writeFileSync(F, s, 'utf8')
console.log(miss === 0 ? '\n全部替换成功' : `\n有 ${miss} 处未匹配`)
