/**
 * 一次性替换：接上常驻 UI 框架（四角标记 + 顶部细导航 + 品牌条）+ chrome.css。
 * 用 Node 做替换，避免 shell 改坏带引号/模板串的源码。
 */
import { readFileSync, writeFileSync } from 'node:fs'

let misses = 0
const patch = (file, pairs) => {
  let s = readFileSync(file, 'utf8')
  for (const [from, to] of pairs) {
    if (!s.includes(from)) {
      console.log(`MISS ${file}: ${from.split('\n')[0].slice(0, 64)}`)
      misses++
      continue
    }
    s = s.replace(from, to)
    console.log(`OK   ${file}: ${from.split('\n')[0].slice(0, 64)}`)
  }
  writeFileSync(file, s, 'utf8')
}

const chromeBlock = `const lyrics = createLyricsLayer(document.querySelector<HTMLAudioElement>('#bgm'))

/** 常驻 UI 框架：四角标记 + 顶部细导航 + 品牌条 —— 站点级，不属于任何一幕 */
const chrome = createChrome([
  { label: '9.19' },
  { label: '祝福' },
  { label: '角色' },
  { label: '许愿' },
])
chrome.setActive(-1) // 开屏阶段整条熄灭

/** 滚动时高亮当前幕 */
const actEls = ['act-mv', 'act-blessing', 'act-gallery', 'act-finale']
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
)`

patch('src/app.ts', [
  ["import { createSmooth } from './smooth'", "import { createSmooth } from './smooth'\nimport { createChrome } from './chrome'"],
  ["const lyrics = createLyricsLayer(document.querySelector<HTMLAudioElement>('#bgm'))", chromeBlock],
  ['    smooth.start()', '    smooth.start()\n    chrome.setActive(0)'],
])

patch('index.html', [
  ['<link rel="stylesheet" href="/src/lyrics.css" />', '<link rel="stylesheet" href="/src/lyrics.css" />\n    <link rel="stylesheet" href="/src/chrome.css" />'],
])

console.log(misses === 0 ? '\n全部替换成功' : `\n有 ${misses} 处未匹配`)
