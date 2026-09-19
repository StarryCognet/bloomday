/**
 * 把 ACT54 序章改成生日版：换标题贴图 + 按节点名精确改染色值。
 *
 * 为什么按节点名改而不是全局换色：`[0,0,0,1]` 被 8 个遮罩/底色节点共用，
 * 全局替换会把遮罩也改白，整个画面会烂掉。只能点名改。
 */
import { readFileSync, writeFileSync } from 'node:fs'

const F = 'public/ark/scene-data.js'
const raw = readFileSync(F, 'utf8')
const prefix = raw.slice(0, raw.indexOf('{'))
const body = raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1)

let data
try {
  data = JSON.parse(body)
} catch (e) {
  console.log('场景图不是纯 JSON，解析失败：' + e.message)
  process.exit(1)
}

// 站点色板（src/tokens.ts）
const CYAN = [0.208, 0.878, 1, 1] // #35E0FF
const MID = [0.078, 0.251, 0.722, 1] // #1440B8
const WHITE = [1, 1, 1, 1]

/** 按节点名点名改色 */
const BY_NAME = {
  title_main: CYAN, // 大标题本体
  title_main_copy: WHITE, // 错位副本（硬阴影那一层）
  title_ch: WHITE, // 中文标题本体
  title_ch_copy: CYAN, // 中文错位副本
}

/** 青色系整体靠向站点色板（这几个值没有被遮罩复用，替换是安全的） */
const REMAP = [
  { from: [0.063, 0.608, 0.969], to: MID },
  { from: [0.125, 0.741, 1], to: CYAN },
  { from: [0, 0.894, 1], to: CYAN },
  { from: [0.863, 1, 0.286], to: CYAN }, // 原本的荧光绿点缀
]

const near = (a, b) => a.length >= 3 && b.every((v, i) => Math.abs(a[i] - v) < 0.01)

let byName = 0
let remapped = 0

function walk(n) {
  const g = n.graphic
  if (g?.color) {
    const named = BY_NAME[n.name]
    if (named) {
      g.color = [...named]
      byName++
    } else {
      for (const r of REMAP) {
        if (near(g.color, r.from)) {
          g.color = [...r.to]
          remapped++
          break
        }
      }
    }
  }
  for (const c of n.children ?? []) walk(c)
}
walk(data.root)

writeFileSync(F, prefix + JSON.stringify(data) + ';', 'utf8')
console.log(`按名改色 ${byName} 处，青色系重映射 ${remapped} 处`)
