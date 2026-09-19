/** 把可视化幕 / 礼物盒幕接进主站，并让它们自己观察视口。 */
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

// 两幕自己观察视口：本站没用 director 驱动，各幕都是自管的
const OBSERVER = `
  // 自己观察视口：本站各幕都是自管状态，没有中心导演驱动
  const io = new IntersectionObserver(
    (entries) => {
      const e = entries[0]
      if (e) setState(el, e.isIntersecting && e.intersectionRatio >= 0.3 ? 'active' : 'future')
    },
    { threshold: [0, 0.3] },
  )
  io.observe(el)
`

patch('src/acts/pulse.ts', [
  [
    '  resize()\n  window.addEventListener(\'resize\', resize)\n  if (allowResident()) raf = requestAnimationFrame(frame)',
    '  resize()\n  window.addEventListener(\'resize\', resize)\n  if (allowResident()) raf = requestAnimationFrame(frame)\n' + OBSERVER,
  ],
])

patch('src/acts/gift.ts', [
  [
    '  resize()\n  window.addEventListener(\'resize\', resize)\n  raf = requestAnimationFrame(frame)',
    '  resize()\n  window.addEventListener(\'resize\', resize)\n  raf = requestAnimationFrame(frame)\n' + OBSERVER,
  ],
])

patch('src/app.ts', [
  [
    "import { createRibbons } from './ribbons'",
    "import { createRibbons } from './ribbons'\nimport { createPulse } from './acts/pulse'\nimport { createGift } from './acts/gift'",
  ],
  [
    '  <section class="act" id="act-gallery"></section>',
    '  <section class="act" id="act-pulse"></section>\n  <section class="act" id="act-gift"></section>\n  <section class="act" id="act-gallery"></section>',
  ],
  [
    "const ribbons = createRibbons(() => analyserNode)",
    "const ribbons = createRibbons(() => analyserNode)\n\n/** 可视化幕 + 礼物盒幕：夹在文案和图片之间，补上中间缺的视觉高点与参与感 */\nconst pulse = createPulse(document.getElementById('act-pulse')!, () => analyserNode)\nconst gift = createGift(document.getElementById('act-gift')!)\nvoid pulse\nvoid gift",
  ],
  [
    "  { label: '9.19' },\n  { label: '祝福' },\n  { label: '角色' },\n  { label: '许愿' },",
    "  { label: '9.19' },\n  { label: '祝福' },\n  { label: '律动' },\n  { label: '礼物' },\n  { label: '角色' },\n  { label: '许愿' },",
  ],
  [
    "const actEls = ['act-mv', 'act-blessing', 'act-gallery', 'act-finale']",
    "const actEls = ['act-mv', 'act-blessing', 'act-pulse', 'act-gift', 'act-gallery', 'act-finale']",
  ],
])

patch('index.html', [
  [
    '<link rel="stylesheet" href="/src/finale.css" />',
    '<link rel="stylesheet" href="/src/finale.css" />\n    <link rel="stylesheet" href="/src/pulse.css" />',
  ],
])

console.log(miss === 0 ? '\n全部替换成功' : `\n有 ${miss} 处未匹配`)
