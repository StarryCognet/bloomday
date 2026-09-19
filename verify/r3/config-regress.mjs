/**
 * 第三轮独立复核 · 标准 2「单一配置源」回归（自己驱动，不等作者结论）
 * 对三个 case（swap / badimage / calm）各自：改配置 -> 构建 -> 探针读"实际渲染出来的值"
 * 最后无条件 --restore + 重新构建 + 校验哈希与备份一致。
 */
import { execSync } from 'node:child_process'
import { readFileSync, writeFileSync, existsSync, copyFileSync } from 'node:fs'

const CFG = 'src/site.config.ts'
const BAK = 'verify/.site.config.orig.ts'
const before = readFileSync(CFG, 'utf8')
const bakBefore = existsSync(BAK) ? readFileSync(BAK, 'utf8') : null
console.log(`[前置] 现场 src/site.config.ts 与备份一致 = ${bakBefore === before}（备份存在=${bakBefore !== null}）`)
if (bakBefore !== before) {
  // 备份脏了：用现场覆盖备份，再开始
  copyFileSync(CFG, BAK)
  console.log('[前置] 备份与现场不一致 → 已用现场覆盖备份')
}

const sh = (cmd) => execSync(cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
const PROBE_JS = `(function(){
  var r = window.__siteReport();
  return {
    rendered: r.rendered,
    config: { name: r.config.name, age: r.config.age, dateLabel: r.config.dateLabel, dateFull: r.config.dateFull, bgm: r.config.bgm, gallerySrcs: r.config.gallerySrcs, configuredStrength: r.config.configuredStrength, injectedStrength: r.config.injectedStrength },
    peakMovingTweens: r.peakMovingTweens,
    summary: window.__siteSummary(),
    imgs: [].map.call(document.querySelectorAll('.gcard img'), function(i){ return {src:i.getAttribute('src'), complete:i.complete, w:i.naturalWidth} }),
    cards: document.querySelectorAll('.gcard').length,
    brokenVisible: [].filter.call(document.querySelectorAll('.gcard img'), function(i){ return i.complete && i.naturalWidth === 0 }).length
  };
})()`

writeFileSync('verify/r3/probe-config.js', PROBE_JS)

function probe (label, media) {
  const mediaArg = media ? ` --media=${media}` : ''
  const out = sh(`node verify/shot.mjs "http://127.0.0.1:4173/index.html?cs=${Date.now()}" verify/shots/r3/cs-${label}.png --w=390 --h=844 --dsf=1 --wait=1200${mediaArg} --probe="$('X')"`.replace('$(X)', ''))
  return out
}

function runProbe (label, media) {
  const mediaArg = media ? ` --media=${media}` : ''
  const cmd = `node verify/r3/probe.mjs --jsfile=verify/r3/probe-config.js --wait=1600 --media=${media ?? 'none:none'}`
  return sh(cmd)
}
function runProbePlain (label) {
  return sh(`node verify/r3/probe.mjs --jsfile=verify/r3/probe-config.js --wait=1600`)
}
function build () {
  sh('node node_modules/typescript/bin/tsc --noEmit')
  return sh('node node_modules/vite/bin/vite.js build')
}

const results = {}
try {
  for (const c of ['swap', 'badimage', 'calm']) {
    sh(`node verify/config-swap.mjs --case=${c}`)
    const b = build()
    const probeOut = c === 'calm' ? runProbePlain(c) : runProbePlain(c)
    results[c] = { buildOk: /built in/.test(b), probe: JSON.parse(probeOut) }
    console.log(`\n===== case=${c} =====`)
    console.log(JSON.stringify(results[c], null, 1))
  }
} finally {
  sh('node verify/config-swap.mjs --restore')
  build()
  const after = readFileSync(CFG, 'utf8')
  console.log(`\n[还原] src/site.config.ts 与实验前逐字节一致 = ${after === before}`)
  console.log(`[还原] 与备份一致 = ${after === readFileSync(BAK, 'utf8')}`)
  console.log(`[还原] 构建: ${/built in/.test(sh('node node_modules/vite/bin/vite.js build')) ? 'OK' : 'FAIL'}`)
}
writeFileSync('verify/shots/r3/config-swap-report.json', JSON.stringify({ before: before.slice(0, 40), results }, null, 1))
