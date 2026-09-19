/** 一次性替换：画廊放满 30 张，并处理由此带来的滚动长度与加载体积。 */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs'

let miss = 0
const patch = (file, pairs) => {
  let s = readFileSync(file, 'utf8')
  for (const [from, to] of pairs) {
    if (typeof from === 'string') {
      if (!s.includes(from)) {
        console.log(`MISS ${file}: ${from.split('\n')[0].slice(0, 60)}`)
        miss++
        continue
      }
      s = s.replace(from, to)
      console.log(`OK   ${file}: ${from.split('\n')[0].slice(0, 60)}`)
    } else {
      if (!from.test(s)) {
        console.log(`MISS ${file}: ${String(from).slice(0, 60)}`)
        miss++
        continue
      }
      s = s.replace(from, to)
      console.log(`OK   ${file}: ${String(from).slice(0, 60)}`)
    }
  }
  writeFileSync(file, s, 'utf8')
}

/* ── 1. 配置：画廊放满实际张数 ───────────────────────────── */
const files = readdirSync('public/gallery')
  .filter((f) => /^makoto-\d+\.jpg$/.test(f))
  .sort()
const entries = files
  .map((f, i) => {
    const n = String(i + 1).padStart(2, '0')
    return `    { src: './gallery/${f}', name: '结城理', note: '', tag: 'MAKOTO ${n}' },`
  })
  .join('\n')

patch('src/site.config.ts', [
  [
    /(\n  gallery: \[)[\s\S]*?(\n  \],)/,
    (_m, a, b) => `${a}\n    // note 留空 = 只显示名字，等你想写什么再填（我不替你编她的事）\n${entries}${b}`,
  ],
])

/* ── 2. 懒加载 ───────────────────────────────────────────
   30 张图如果全部立即加载，首屏就要拉 2.6MB。轨道上横向离屏的图
   浏览器本来就不会加载，加 loading=lazy 就能只拉眼前这几张。 */
patch('src/acts/gallery.ts', [
  [
    '<img class="gcard__img" src="${it.src}" alt="${it.name}" decoding="async" />',
    '<img class="gcard__img" src="${it.src}" alt="${it.name}" loading="lazy" decoding="async" />',
  ],
])

/* ── 3. 滚动比 ───────────────────────────────────────────
   30 张卡横着走等于 20 多屏，手机上是灾难。这里让横向以约 1.8 倍
   于竖向的速度前进，把整段压到 5~6 屏。 */
patch('src/acts/gallery-pin.ts', [
  [
    '    // 高度 = 一屏 + 横向总位移 —— 滚一像素就走一像素，手感 1:1\n    actEl.style.height = `${Math.round(window.innerHeight + max)}px`',
    '    // 高度 = 一屏 + 横向总位移 × RATIO。RATIO < 1 表示横向比竖向快，\n    // 图越多越要压，否则 30 张要滚 20 多屏。\n    actEl.style.height = `${Math.round(window.innerHeight + max * RATIO)}px`',
  ],
  [
    'const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v)',
    'const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v)\n\n/** 竖向滚 1px，横向走 1/RATIO px */\nconst RATIO = 0.55',
  ],
])

/* ── 4. 卡片宽度：窄一点，一屏能看见两张半 ───────────────── */
patch('src/gallery.css', [['  flex: 0 0 76%;', '  flex: 0 0 68%;']])

console.log(miss === 0 ? `\n全部替换成功（${files.length} 张）` : `\n有 ${miss} 处未匹配`)
