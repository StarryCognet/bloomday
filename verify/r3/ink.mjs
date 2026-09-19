/**
 * 第三轮独立复核 · 全屏墨量（纯像素，不看 DOM）
 * ink = 与"空屏参考"差异 > 24 (L1) 的像素占比 —— 用终态空屏帧做参考。
 * 用途：
 *   - 量化"幕间空白"（墨量落到 0 = 屏幕上什么都没有）
 *   - 量化"终态内容量"（墨量恒定 = 画面不再变化，且可比较各幕的信息密度）
 * 用法：node verify/r3/ink.mjs verify/shots/r3/<prefix>.json [参考帧label]
 */
import { readFileSync } from 'node:fs'
import { decode, diff } from './png.mjs'

for (const f of process.argv.slice(2, 3)) {
  const data = JSON.parse(readFileSync(f, 'utf8'))
  const dir = f.replace(/[^\\/]+$/, '')
  const refLabel = process.argv[3]
  const img = (l) => decode(readFileSync(`${dir}${data.prefix}-${l}.png`))
  const last = data.rows[data.rows.length - 1].label
  const ref = img(refLabel ?? last)
  console.log(`===== 墨量 ${data.prefix}（空屏参考=${refLabel ?? last}）=====`)
  console.log('frame   realMs  墨量%   与参考 meanL1  topShare')
  for (const r of data.rows) {
    const d = diff(img(r.label), ref)
    console.log(`${r.label.padEnd(7)} ${String(r.realMs).padStart(5)}   ${String((d.changedRatio * 100).toFixed(3)).padStart(6)}%  ${String(d.meanL1).padStart(8)}      ${r.topShare}`)
  }
  if (data.pre) {
    const d = diff(decode(readFileSync(`${dir}${data.prefix}-pre.png`)), ref)
    console.log(`pre         -   ${(d.changedRatio * 100).toFixed(3)}%  ${d.meanL1}      ${data.pre.stats.topShare}   (点击前首屏)`)
  }
}
