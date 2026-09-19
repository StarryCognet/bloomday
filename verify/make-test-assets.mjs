/**
 * 生成临时测试素材到 public/gallery/。
 * 用途：验证「有素材」这条路径；跑完请执行 node verify/make-test-assets.mjs --clean 删掉，
 * 让站点回到"素材缺失"的真实状态（哥哥的图还没到）。
 *
 * 用法：
 *   node verify/make-test-assets.mjs          生成
 *   node verify/make-test-assets.mjs --clean  删除
 */
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs'

const DIR = 'public/gallery'
const NAMES = [
  ['char-01.svg', '#1440B8', '#35E0FF', 'CHAR 01'],
  ['char-02.svg', '#0B2A7A', '#F2F7FF', 'CHAR 02'],
  ['char-03.svg', '#0B1330', '#35E0FF', 'CHAR 03'],
  ['char-04.svg', '#2E6BFF', '#05070F', 'US 04'],
]

if (process.argv.includes('--clean')) {
  rmSync(DIR, { recursive: true, force: true })
  console.log(`[assets] 已删除 ${DIR}`)
} else {
  mkdirSync(DIR, { recursive: true })
  for (const [name, bg, fg, label] of NAMES) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 800" width="600" height="800">
  <rect width="600" height="800" fill="${bg}"/>
  <g transform="skewX(-18)" opacity="0.35">
    <rect x="-100" y="180" width="900" height="70" fill="${fg}"/>
    <rect x="-100" y="560" width="900" height="30" fill="${fg}"/>
  </g>
  <circle cx="300" cy="360" r="150" fill="none" stroke="${fg}" stroke-width="6" opacity="0.55"/>
  <text x="300" y="380" fill="${fg}" font-family="sans-serif" font-size="64" font-weight="700"
        text-anchor="middle" letter-spacing="4">${label}</text>
  <text x="300" y="720" fill="${fg}" font-family="sans-serif" font-size="26" opacity="0.75"
        text-anchor="middle">TEST ASSET · 会被删除</text>
</svg>
`
    writeFileSync(`${DIR}/${name}`, svg, 'utf8')
  }
  console.log(`[assets] 已生成 ${NAMES.length} 张测试图 → ${DIR}`)
  console.log(`[assets] 存在=${existsSync(DIR)}`)
}
