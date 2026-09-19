/**
 * 清掉序章背景里的明日方舟功能 UI（校园商店 / 旅行计划 / Daily Fortune /
 * 今日答案 / 巡学路 / 当期干员查看 / Route / School 那一堆），只留纯展示。
 *
 * 做法：按贴图名匹配，把命中的节点在 CSS 里 display:none。
 * 为什么不改 scene-data 的 active：那些节点的显隐是**被动画曲线驱动的**，
 * 静态改 active 会被曲线覆盖回去；CSS 优先级更硬，而且不怕曲线。
 */
import { readFileSync, writeFileSync } from 'node:fs'

const scene = await import('../public/ark/scene-data.js').then((m) => m.sceneData)

/** 功能 UI 的贴图名特征。保守起见逐个列，不做模糊匹配 —— 宁可少删不可误删。 */
const UI_PATTERNS = [
  'btn_',
  'token',
  'img_daily',
  'img_new',
  'img_zone',
  'img_fortune',
  'img_mission',
  'img_shop',
  'img_lock',
  'img_end',
  'img_add',
  'img_icrcle',
  'now_play',
  'desc_sprite',
  'bg2_',
  'music_line_',
  'glass_',
  'trackpoint',
]

const hits = []
const walk = (n) => {
  const url = n.graphic?.sprite?.url ?? ''
  const file = url.replace('assets/images/', '').replace(/\?.*$/, '')
  if (file && UI_PATTERNS.some((p) => file.startsWith(p))) {
    hits.push({ path: n.path, file })
  }
  for (const c of n.children ?? []) walk(c)
}
walk(scene.root)

console.log(`命中 ${hits.length} 个节点：`)
const byFile = new Map()
for (const h of hits) byFile.set(h.file, (byFile.get(h.file) ?? 0) + 1)
;[...byFile.entries()].sort().forEach(([f, n]) => console.log(`  ${String(n).padStart(3)}× ${f}`))

const css = `
/* ── 生日站改造：清掉明日方舟的功能 UI ──────────────────────
   校园商店 / 旅行计划 / Daily Fortune / 今日答案 / 巡学路 / 当期干员查看 /
   Route / School …… 这些是活动页面的功能入口，跟生日毫无关系，只留纯展示。

   用 CSS 而不是改 scene-data 的 active：那些节点的显隐是**动画曲线驱动的**，
   静态改 active 会被曲线覆盖回去；CSS 优先级更硬。 */
${[...new Set(hits.map((h) => h.path))]
  .map((p) => `[data-path="${p}"]`)
  .join(',\n')} {
  display: none !important;
}
`

writeFileSync('public/ark/styles.css', readFileSync('public/ark/styles.css', 'utf8') + css, 'utf8')
console.log(`\n已写入 CSS，隐藏 ${new Set(hits.map((h) => h.path)).size} 条路径`)
