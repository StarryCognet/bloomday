/** 摸清 ACT54 场景图：标题节点在哪、纯色节点都用了哪些颜色。 */
import { sceneData } from '../public/ark/scene-data.js'

const colors = new Map()
const sprites = new Map()
const titleNodes = []
let nodeCount = 0

function walk(n, depth = 0) {
  nodeCount++
  const g = n.graphic
  if (g?.color) {
    const key = g.color.map((v) => Math.round(v * 1000) / 1000).join(', ')
    const e = colors.get(key) ?? { n: 0, names: [] }
    e.n++
    if (e.names.length < 3) e.names.push(n.name)
    colors.set(key, e)
  }
  if (g?.sprite) sprites.set(g.sprite, (sprites.get(g.sprite) ?? 0) + 1)
  if (/title/i.test(n.name) || (g?.sprite && /title/i.test(g.sprite))) {
    titleNodes.push({ name: n.name, sprite: g?.sprite ?? null, type: g?.type ?? null, color: g?.color ?? null })
  }
  for (const c of n.children ?? []) walk(c, depth + 1)
}
walk(sceneData.root)

console.log('节点总数:', nodeCount)
console.log('帧率:', sceneData.frameRate, '时长:', sceneData.duration, 's  帧数:', sceneData.frameCount)
console.log('\n--- 名字/贴图带 title 的节点 ---')
for (const t of titleNodes) console.log(' ', JSON.stringify(t))
console.log('\n--- 精灵引用（前 12）---')
;[...sprites.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12).forEach(([k, v]) => console.log(`  ${v}× ${k}`))
console.log('\n--- 纯色出现最多的 16 种（RGBA 0~1）---')
;[...colors.entries()]
  .sort((a, b) => b[1].n - a[1].n)
  .slice(0, 16)
  .forEach(([k, v]) => console.log(`  ${String(v.n).padStart(4)}× [${k}]   ${v.names.join(' / ')}`))
