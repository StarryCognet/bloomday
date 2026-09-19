/** 补：把配置里的画廊数组铺满实际张数（上一版正则漏了 `] as GalleryItem[],`）。 */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs'

const F = 'src/site.config.ts'
const files = readdirSync('public/gallery')
  .filter((f) => /^makoto-\d+\.jpg$/.test(f))
  .sort()

const entries = files
  .map((f, i) => {
    const n = String(i + 1).padStart(2, '0')
    return `    { src: './gallery/${f}', name: '结城理', note: '', tag: 'MAKOTO ${n}' },`
  })
  .join('\n')

const s = readFileSync(F, 'utf8')
const re = /(\n  gallery: \[)[\s\S]*?(\n  \] as GalleryItem\[\],)/
if (!re.test(s)) {
  console.log('MISS: 没匹配到 gallery 数组')
  process.exit(1)
}
writeFileSync(
  F,
  s.replace(re, (_m, a, b) => `${a}\n    // note 留空 = 只显示名字，等你想写什么再填（我不替你编她的事）\n${entries}${b}`),
  'utf8',
)
console.log(`OK 已写入 ${files.length} 项`)
