/**
 * 第三轮独立复核 · 判据（完全不看作者的 __journey）
 *
 * 对每一帧做两件事：
 *  A. 像素层：整帧最高频色占比 topShare —— 整屏纯色遮盖的第一观测量
 *  B. 元素层：对每个"视口内 + DOM 上自己与祖先 opacity 累乘 > 0.1"的文字元素，
 *     用**像素**数它矩形里到底有没有文字笔画（rectInk）。
 *     DOM 透明度只用来挑"候选"，最终"可读"由像素 ink 决定。
 *     可读 = ink >= INK_MIN 且 edge >= EDGE_MIN（笔画要有分布，不是一条色块边）
 *  C. 汇总：同时可读的"幕"数（seal / act-mv / act-blessing / act-gallery / act-finale）
 *     —— 判断范围限定在"封印还在（display != none）"的转场窗口，
 *        与作者第二版的范围声明一致（滚动时接缝两幕同屏不算缺陷）。
 *
 * 用法：node verify/r3/analyze.mjs verify/shots/r3/<prefix>.json
 */
import { readFileSync } from 'node:fs'
import { decode, stats, rectInk } from './png.mjs'

const INK_MIN = 25        // 矩形内至少这么多笔画像素
const EDGE_MIN = 4        // 笔画至少分布在 4 个 4x4 网格里（排除"整块色边"）
const files = process.argv.slice(2)

for (const f of files) {
  const data = JSON.parse(readFileSync(f, 'utf8'))
  const dir = f.replace(/[^\\/]+$/, '')
  console.log(`\n===== ${data.prefix}  ${data.w}x${data.h} media=${data.media} cpu=${data.cpu} =====`)
  const rows = data.rows

  // 判据有效性自证：先报"像素统计"三件套
  console.log('frame      realMs  topShare  topColor        meanLum | 可读文字元素（按幕）')
  let maxActs = 0, maxAt = null, overlapFrames = 0, overlapList = []
  const perFrame = []
  for (const r of rows) {
    const img = decode(readFileSync(`${dir}${data.prefix}-${r.label}.png`))
    const seals = new Set()
    const readable = []
    for (const t of r.dom.texts) {
      if (t.eff <= 0.1) continue                 // DOM 侧门槛：透明度不足，直接不算候选
      const ink = rectInk(img, t.x, t.y, t.x + t.w, t.y + t.h)
      if (ink.ink >= INK_MIN && ink.edge >= EDGE_MIN) {
        readable.push({ sel: t.sel, act: t.act, txt: t.txt, ink: ink.ink, edge: ink.edge, eff: t.eff, covered: t.covered })
        seals.add(t.act)
      } else if (ink.ink >= INK_MIN) {
        readable.push({ sel: t.sel, act: t.act, txt: t.txt, ink: ink.ink, edge: ink.edge, eff: t.eff, lowEdge: true })
        seals.add(t.act)
      }
    }
    const inTransition = r.dom.seal.display !== 'none'
    const bad = inTransition && seals.size > 1
    if (bad) { overlapFrames++; if (overlapList.length < 12) overlapList.push(`t${r.nominal}(${seals.size}幕:${[...seals].join('+')})`) }
    if (inTransition && seals.size > maxActs) { maxActs = seals.size; maxAt = r.nominal }
    perFrame.push({ label: r.label, nominal: r.nominal, realMs: r.realMs, topShare: r.topShare, acts: [...seals], readable, inTransition, sealDisplay: r.dom.seal.display })
    console.log(
      `${r.label.padEnd(9)} ${String(r.realMs).padStart(5)}  ${String(r.topShare).padEnd(8)} ${JSON.stringify(r.topColor).padEnd(15)} ${String(r.meanLum).padStart(5)}  | ` +
      (readable.length ? readable.map((x) => `${x.act}:${x.sel}${x.lowEdge ? '(弱)' : ''}`).join('  ') : '—') +
      (bad ? '   <<< 双幕同时可读' : '') +
      (r.dom.seal.display === 'none' ? '   [封印已 none]' : ''),
    )
  }
  const maxTop = Math.max(...rows.map((r) => r.topShare))
  console.log(`\n【判据输出】转场窗口内同时可读幕数峰值=${maxActs}${maxAt !== null ? ` @t${maxAt}ms` : ''}；双幕帧数=${overlapFrames}${overlapFrames ? ' → ' + overlapList.join(' ') : ''}`)
  console.log(`【判据输出】整帧最高频色占比峰值=${maxTop}（≈1 即整屏纯色遮盖）；空白帧(topShare>0.9 且无可读)=${perFrame.filter((p) => p.topShare > 0.9 && p.readable.length === 0).map((p) => p.label).join(',') || '无'}`)
  if (data.tail) {
    console.log(`【残留】滚到底: topShare=${data.tail.bottom.stats.topShare} 可读=${data.tail.bottom.dom.texts.filter((t) => t.eff > 0.1).length}个元素`)
    console.log(`【残留】回滚到顶: topShare=${data.tail.backTop.stats.topShare} 环/带/整屏fixed=${data.tail.residue.rings}/${data.tail.residue.bands}/${JSON.stringify(data.tail.residue.fixedCovers)} scrollY=${data.tail.residue.scrollY}`)
  }
}
