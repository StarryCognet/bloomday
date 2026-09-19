/** 把 ACT54 序章（public/ark）作为开屏底层接进封印，P3R 外框与入口压在其上。 */
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

patch('src/app.ts', [
  [
    '  <main class="seal" id="seal">\n',
    `  <main class="seal" id="seal">
    <!-- 序章：明日方舟 × P3R 联动「月行水上」开屏（public/ark，已关掉 90° 旋转） -->
    <div class="seal__ark">
      <iframe id="ark-frame" src="./ark/index.html" title="开场动画" scrolling="no"></iframe>
    </div>
    <span class="seal__veil"></span>
`,
  ],
])
