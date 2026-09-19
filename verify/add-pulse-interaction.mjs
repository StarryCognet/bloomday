/**
 * 律动幕加互动 + 粒子特效。
 * 用逐行数组拼接而不是模板字符串 —— 目标代码里全是反引号和 ${}，
 * 无论 PowerShell 还是 JS 模板串都会互相打架。
 */
import { readFileSync, writeFileSync } from 'node:fs'

const F = 'src/acts/pulse.ts'
let s = readFileSync(F, 'utf8')
let miss = 0
const rep = (from, to, label) => {
  if (!s.includes(from)) {
    console.log('MISS ' + label)
    miss++
    return
  }
  s = s.replace(from, to)
  console.log('OK   ' + label)
}

// 1) Spark 接口
rep(
  ['interface Ring {', '  r: number', '  alpha: number', '}', ''].join('\n'),
  [
    'interface Ring {',
    '  r: number',
    '  alpha: number',
    '}',
    '',
    '/** 点出来的火花：有重力、会衰减 */',
    'interface Spark {',
    '  x: number',
    '  y: number',
    '  vx: number',
    '  vy: number',
    '  r: number',
    '  life: number',
    '  max: number',
    '  color: string',
    '}',
    '',
  ].join('\n'),
  'Spark 接口',
)

// 2) 火花池
rep(['  const rings: Ring[] = []', ''].join('\n'), ['  const rings: Ring[] = []', '  const sparks: Spark[] = []', ''].join('\n'), '火花池')

// 3) spawn + onPointer + frame 签名
const frameLine = '  function frame(now: number): void {'
rep(
  frameLine,
  [
    '  /** 点哪里炸哪里：一圈火花 + 立刻扩开的涟漪 */',
    '  function spawn(cx: number, cy: number, n: number): void {',
    '    if (skipMotion()) return',
    '    const colors = [palette.cyan, palette.mid, palette.white]',
    '    for (let i = 0; i < n; i++) {',
    '      const ang = Math.random() * Math.PI * 2',
    '      const speed = 90 + Math.random() * 430',
    '      const life = 0.7 + Math.random() * 0.9',
    '      sparks.push({',
    '        x: cx,',
    '        y: cy,',
    '        vx: Math.cos(ang) * speed,',
    '        vy: Math.sin(ang) * speed,',
    '        r: 1.6 + Math.random() * 3.4,',
    '        life,',
    '        max: life,',
    '        color: colors[i % colors.length] ?? palette.cyan,',
    '      })',
    '    }',
    '    rings.push({ r: 6, alpha: 0.85 })',
    '  }',
    '',
    '  function onPointer(ev: PointerEvent): void {',
    '    if (!active) return',
    '    const r = canvas.getBoundingClientRect()',
    '    spawn(ev.clientX - r.left, ev.clientY - r.top, 44)',
    '  }',
    '',
    frameLine,
  ].join('\n'),
  'spawn + onPointer',
)

// 4) 火花绘制（插在核心之前）
rep(
  '    // 核心：低频越大越亮越大',
  [
    '    // 火花：点出来的粒子，带重力和衰减',
    '    for (let i = sparks.length - 1; i >= 0; i--) {',
    '      const s = sparks[i]!',
    '      s.life -= dt',
    '      if (s.life <= 0) {',
    '        sparks.splice(i, 1)',
    '        continue',
    '      }',
    '      s.vy += 420 * dt',
    '      s.vx *= 1 - 1.1 * dt',
    '      s.x += s.vx * dt',
    '      s.y += s.vy * dt',
    '      const a = s.life / s.max',
    '      ctx.fillStyle = withAlpha(s.color, 0.25 + a * 0.7)',
    '      ctx.beginPath()',
    '      ctx.arc(s.x, s.y, s.r * (0.4 + a * 0.9), 0, Math.PI * 2)',
    '      ctx.fill()',
    '    }',
    '',
    '    // 核心：低频越大越亮越大',
  ].join('\n'),
  '火花绘制',
)

// 5) 监听
rep(
  "  resize()\n  window.addEventListener('resize', resize)",
  "  // 点哪里炸哪里：这一幕是全程唯一可以戳的地方\n  canvas.addEventListener('pointerdown', onPointer)\n\n  resize()\n  window.addEventListener('resize', resize)",
  'pointerdown 监听',
)

// 6) 自检钩子带上火花数
rep('    rings: rings.length,', '    rings: rings.length,\n    sparks: sparks.length,', '自检 sparks')

writeFileSync(F, s, 'utf8')
console.log(miss === 0 ? '\n全部替换成功' : `\n有 ${miss} 处未匹配`)
