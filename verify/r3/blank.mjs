/**
 * 第三轮独立复核 · 空屏窗口客观测量
 * 用"与空屏参考帧的像素差"给出被点击到收尾之间"屏幕上什么都没有"的窗口，
 * 完全不依赖 DOM，也不依赖作者的 __journey。
 *
 * 参考帧 = 运行时最靠后的稳态帧（转场后、纯底色 + 网点，画面上无字无形）。
 * 用法：node verify/r3/blank.mjs verify/shots/r3/fine.json
 */
import { readFileSync } from 'node:fs'
import { decode, stats, diff } from './png.mjs'

const REF_LABEL = process.argv[3] ?? 't1100'
for (const f of process.argv.slice(2, 3)) {
  const data = JSON.parse(readFileSync(f, 'utf8'))
  const dir = f.replace(/[^\\/]+$/, '')
  const img = (l) => decode(readFileSync(`${dir}${data.prefix}-${l}.png`))
  const ref = img(REF_LABEL)
  console.log(`===== 空屏测量 ${data.prefix}（参考帧=${REF_LABEL}）=====`)
  console.log('frame   realMs  meanL1(vs空屏)  changed%  topShare  | 判定')
  const rows = []
  for (const r of data.rows) {
    const d = diff(img(r.label), ref)
    const blankish = d.changedRatio < 0.002 && d.meanL1 < 1.0
    rows.push({ label: r.label, realMs: r.realMs, ...d, topShare: r.topShare, blankish })
    console.log(`${r.label.padEnd(7)} ${String(r.realMs).padStart(5)}   ${String(d.meanL1).padStart(8)}      ${String((d.changedRatio * 100).toFixed(3)).padStart(6)}%  ${String(r.topShare).padEnd(7)} | ${blankish ? '≈空屏（与终态底色无差别）' : '有可见内容'}`)
  }
  const blanks = rows.filter((x) => x.blankish)
  let seg = null; const segs = []
  for (const r of rows) {
    if (r.blankish) { if (!seg) seg = [r.realMs, r.realMs]; else seg[1] = r.realMs } else if (seg) { segs.push(seg); seg = null }
  }
  if (seg) segs.push(seg)
  console.log(`\n≈空屏帧: ${blanks.map((b) => b.label + '(' + b.realMs + 'ms)').join(', ') || '无'}`)
  console.log(`≈空屏窗口跨度: ${segs.map((s) => `${s[0]}~${s[1]}ms (${s[1] - s[0]}ms)`).join(' , ') || '无'}`)
  console.log(`首帧(点击后)与空屏差: meanL1=${rows[0].meanL1} changed=${(rows[0].changedRatio * 100).toFixed(2)}%`)
}
