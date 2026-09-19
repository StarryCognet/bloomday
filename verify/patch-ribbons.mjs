/** 接入粒子飘带层：分析节点在点击手势里创建，canvas 常驻。 */
import { readFileSync, writeFileSync } from 'node:fs'

let miss = 0
const patch = (file, pairs) => {
  let s = readFileSync(file, 'utf8')
  for (const [from, to] of pairs) {
    if (!s.includes(from)) {
      console.log(`MISS ${file}: ${from.split('\n')[0].slice(0, 60)}`)
      miss++
      continue
    }
    s = s.replace(from, to)
    console.log(`OK   ${file}: ${from.split('\n')[0].slice(0, 60)}`)
  }
  writeFileSync(file, s, 'utf8')
}

const block = `/** 粒子飘带：能量来自 BGM 的实时频谱 */
let analyserNode: AnalyserNode | null = null
const ribbons = createRibbons(() => analyserNode)

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
`

patch('src/app.ts', [
  [
    "import { createGalleryPin } from './acts/gallery-pin'",
    "import { createGalleryPin } from './acts/gallery-pin'\nimport { createRibbons } from './ribbons'",
  ],
  ['const reveals = [', block + '\nconst reveals = ['],
  [
    '  if (audio) {\n    audio.volume = 1',
    '  attachAnalyser()\n  if (audio) {\n    audio.volume = 1',
  ],
  [
    '    lyrics: lyrics.report(),',
    '    lyrics: lyrics.report(),\n    ribbons: ribbons.report(),',
  ],
])

patch('index.html', [
  [
    '<link rel="stylesheet" href="/src/chrome.css" />',
    '<link rel="stylesheet" href="/src/chrome.css" />\n    <link rel="stylesheet" href="/src/ribbons.css" />',
  ],
])

console.log(miss === 0 ? '\n全部替换成功' : `\n有 ${miss} 处未匹配`)
