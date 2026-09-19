/** 去掉歌词上方那条蓝色斜线（.lyr__edge）：元素 + 基础样式 + 平板覆盖，三处一起清。 */
import { readFileSync, writeFileSync } from 'node:fs'

let miss = 0
const edit = (file, fn) => {
  const before = readFileSync(file, 'utf8')
  const after = fn(before)
  if (after === before) {
    console.log(`MISS ${file}：没有匹配到，未改动`)
    miss++
    return
  }
  writeFileSync(file, after, 'utf8')
  console.log(`OK   ${file}：${before.length - after.length} 字节已删`)
}

edit('src/acts/lyrics-layer.ts', (s) =>
  s.replace(/\n\s*<span class="lyr__edge"><\/span>/, ''),
)

edit('src/lyrics.css', (s) =>
  s.replace(/\/\* P3 的斜切边[\s\S]*?\n\.lyr__edge \{[\s\S]*?\n\}\n/, ''),
)

edit('src/tablet.css', (s) => s.replace(/\n  \.lyr__edge \{[\s\S]*?\n  \}\n/, '\n'))

console.log(miss === 0 ? '\n三处全部清除' : `\n有 ${miss} 处未匹配`)
