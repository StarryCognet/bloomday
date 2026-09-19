/**
 * 约定静态检查（可复用，不依赖浏览器）
 *   1. 色值只准出现在 src/tokens.ts —— 保证"改一处主色变量，全站同步变色"
 *   2. 缓动曲线只准从 EASE 集合取 —— 字面量必须是集合的键（TS 类型是 EaseName），
 *      写成任意其它字符串（如 'power2.out'）即违规
 *
 * 用法：node verify/lint-conventions.mjs
 */
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const { EASE_NAMES } = await import('../src/motion/easing.ts')
const VALID_EASE_KEYS = new Set(EASE_NAMES)

const SRC = 'src'
const walk = (dir) =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)],
  )

const files = walk(SRC).filter((f) => /\.(ts|css)$/.test(f))
const hexRe = /#[0-9a-fA-F]{6}\b/
const rgbRe = /rgba?\(\s*\d/
const easeLitRe = /ease:\s*['"]([^'"]+)['"]/

const colorHits = []
const easeHits = []

for (const f of files) {
  const lines = readFileSync(f, 'utf8').split('\n')
  lines.forEach((line, i) => {
    const at = `${f}:${i + 1}  ${line.trim()}`
    if (!f.endsWith('tokens.ts') && (hexRe.test(line) || rgbRe.test(line))) colorHits.push(at)
    if (f.endsWith('easing.ts')) return
    const m = line.match(easeLitRe)
    if (m && !VALID_EASE_KEYS.has(m[1])) {
      easeHits.push(`${at}\n      ← '${m[1]}' 不是 EASE 集合成员`)
    }
  })
}

const report = (title, hits, okMsg) => {
  console.log(`\n── ${title} ──`)
  if (hits.length === 0) console.log(`PASS  ${okMsg}`)
  else {
    console.log(`FAIL  ${hits.length} 处：`)
    hits.forEach((h) => console.log('  ' + h))
  }
  return hits.length === 0
}

const okColor = report('色值单源（只准出现在 src/tokens.ts）', colorHits, '0 处硬编色值')
const okEase = report(
  `缓动单源（只准取 EASE 的键：${[...VALID_EASE_KEYS].join(' / ')}）`,
  easeHits,
  '0 处越界曲线字面量',
)

console.log(`\n总结：${okColor && okEase ? 'PASS' : 'FAIL'}（检查 ${files.length} 个文件）`)
process.exit(okColor && okEase ? 0 : 1)
