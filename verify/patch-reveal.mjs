/**
 * 一次性替换：接入「滚动显现」，并把主视觉文字的所有权从 enter 交给它。
 * 一个元素只能有一个动画主人，否则两边抢。
 */
import { readFileSync, writeFileSync } from 'node:fs'

let miss = 0
const patch = (file, pairs) => {
  let s = readFileSync(file, 'utf8')
  for (const [from, to] of pairs) {
    if (!s.includes(from)) {
      console.log(`MISS ${file}: ${from.split('\n')[0].slice(0, 62)}`)
      miss++
      continue
    }
    s = s.replace(from, to)
    console.log(`OK   ${file}: ${from.split('\n')[0].slice(0, 62)}`)
  }
  writeFileSync(file, s, 'utf8')
}

/* ── main-visual.ts：把文字所有权交出去 ─────────────────── */
patch('src/acts/main-visual.ts', [
  [
    `  /** 这一幕的文字。进场动画跑之前必须藏着 ——
      否则封印还在淡出时，两幕的文字会同时可读（实测连续 52 帧双重曝光）。 */
  const TEXT = ['.mv__eyebrow', '#mv-date', '.mv__age', '#mv-title']
  let entered = false
  function setTextVisible(v: boolean): void {
    gsap.set(TEXT, { opacity: v ? 1 : 0 })
  }
`,
    '',
  ],
  [
    `      gsap.set(mv, { opacity: 1, y: 0, clearProps: 'transform,opacity' })
      // 容器可见，但没跑过进场就把文字藏着
      if (!entered) setTextVisible(false)`,
    `      gsap.set(mv, { opacity: 1, y: 0, clearProps: 'transform,opacity' })`,
  ],
  [`    if (state !== 'active') setTextVisible(false)\n`, ''],
  [
    `      // 强度 0：直接落终态
      if (skipMotion()) {
        entered = true
        setTextVisible(true)
        setState(node, 'active')
        return gsap.timeline()
      }
      entered = true`,
    `      // 强度 0：直接落终态
      if (skipMotion()) {
        setState(node, 'active')
        return gsap.timeline()
      }`,
  ],
  [
    `      tl.fromTo(
        '.mv__eyebrow',
        { opacity: 0, y: 14 },
        { opacity: 1, y: 0, duration: 0.5, ease: EASE.drift },
        0.1,
      )
      tl.add(charSlam(dateEl, { direction: 'up', duration: 0.8, intensity: 0.95, stagger: 0.08 }), 0.18)
      tl.add(charSlam(ageEl, { direction: 'right', duration: 0.7, intensity: 0.9 }), 0.42)
      tl.add(charSlam(titleEl, { direction: 'up', duration: 0.6, intensity: 0.7, stagger: 0.05 }), 0.5)
`,
    `      // 文字不在这里演 —— 交给滚动显现（一个元素只能有一个动画主人）
`,
  ],
  [`import { EASE, charSlam, skipMotion } from '../motion'`, `import { EASE, skipMotion } from '../motion'`],
])

/* ── app.ts：建滚动显现 + 仪式后 arm ────────────────────── */
patch('src/app.ts', [
  [
    "import { createChrome } from './chrome'",
    "import { createChrome } from './chrome'\nimport { createScrollReveal } from './acts/scroll-reveal'",
  ],
  [
    'chrome.setActive(-1) // 开屏阶段整条熄灭',
    `chrome.setActive(-1) // 开屏阶段整条熄灭

/** 滚动显现：每一幕滚进视口时，字逐个显出来 */
const pick = (sel: string, root: HTMLElement): HTMLElement => root.querySelector<HTMLElement>(sel)!
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
]`,
  ],
  ['    chrome.setActive(0)', '    chrome.setActive(0)\n    reveals.forEach((r) => r.arm())'],
])

console.log(miss === 0 ? '\n全部替换成功' : `\n有 ${miss} 处未匹配`)
