/**
 * 把"点哪里炸哪里"的粒子提到全局层。
 *
 * 为什么不复用律动幕那一份：那一份只在她滚到律动幕时才活跃（active 门控），
 * 而需求是**全局**——在祝福、图库、收尾任何地方点一下都要有反馈。
 * 这一层本来就常驻（和飘带同一张画布、同一个 rAF），加上去不增开销。
 */
import { readFileSync, writeFileSync } from 'node:fs'

const F = 'src/ribbons.ts'
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

// 1) Spark 接口 + 火花池
rep(
  ['interface Speck {', '  x: number', '  y: number', '  r: number', '  speed: number', '  drift: number', '  alpha: number', '}'].join('\n'),
  [
    'interface Speck {',
    '  x: number',
    '  y: number',
    '  r: number',
    '  speed: number',
    '  drift: number',
    '  alpha: number',
    '}',
    '',
    '/** 点出来的火花：全局层用，带重力与衰减 */',
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
  ].join('\n'),
  'Spark 接口',
)

rep(
  ['  const ribbons: Ribbon[] = []', '  const specks: Speck[] = []'].join('\n'),
  ['  const ribbons: Ribbon[] = []', '  const specks: Speck[] = []', '  const sparks: Spark[] = []'].join('\n'),
  '火花池',
)

// 2) spawn + 全局监听
rep(
  '  function resize(): void {',
  [
    '  /** 点哪里炸哪里（全局）：任何时候点屏幕都有一簇粒子回应 */',
    '  function spawnAt(clientX: number, clientY: number): void {',
    '    if (skipMotion()) return',
    '    const colors = [HEX.cyan, HEX.mid, HEX.white]',
    '    for (let i = 0; i < 26; i++) {',
    '      const ang = Math.random() * Math.PI * 2',
    '      const speed = 70 + Math.random() * 330',
    '      const life = 0.6 + Math.random() * 0.8',
    '      sparks.push({',
    '        x: clientX,',
    '        y: clientY,',
    '        vx: Math.cos(ang) * speed,',
    '        vy: Math.sin(ang) * speed,',
    '        r: 1.4 + Math.random() * 3,',
    '        life,',
    '        max: life,',
    '        color: colors[i % colors.length] ?? HEX.cyan,',
    '      })',
    '    }',
    '  }',
    '',
    '  const onPointer = (ev: PointerEvent): void => spawnAt(ev.clientX, ev.clientY)',
    '',
    '  function resize(): void {',
  ].join('\n'),
  'spawnAt + onPointer',
)

// 3) 绘制（插在帧尾，飘带/星屑之后）
rep(
  '    requestAnimationFrame(frame)\n  }',
  [
    '    // 火花：全局点击的粒子反馈',
    '    for (let i = sparks.length - 1; i >= 0; i--) {',
    '      const sp = sparks[i]!',
    '      sp.life -= dt',
    '      if (sp.life <= 0) {',
    '        sparks.splice(i, 1)',
    '        continue',
    '      }',
    '      sp.vy += 380 * dt',
    '      sp.vx *= 1 - 1.2 * dt',
    '      sp.x += sp.vx * dt',
    '      sp.y += sp.vy * dt',
    '      const a = sp.life / sp.max',
    '      ctx.fillStyle = withAlpha(sp.color, 0.2 + a * 0.7)',
    '      ctx.beginPath()',
    '      ctx.arc(sp.x, sp.y, sp.r * (0.4 + a * 0.9), 0, Math.PI * 2)',
    '      ctx.fill()',
    '    }',
    '',
    '    requestAnimationFrame(frame)',
    '  }',
  ].join('\n'),
  '火花绘制',
)

// 4) 挂全局监听
rep(
  "  window.addEventListener('resize', resize)",
  "  window.addEventListener('resize', resize)\n  // 全局：用捕获阶段，任何元素上的点击都不会漏\n  document.addEventListener('pointerdown', onPointer, { capture: true })",
  '全局 pointerdown',
)

// 5) 自检
rep(
  '    report: () => `飘带 ${ribbons.length} 条 / 星屑 ${specks.length} 粒 · 能量 ${smooth.toFixed(3)}`,',
  '    report: () => `飘带 ${ribbons.length} 条 / 星屑 ${specks.length} 粒 / 火花 ${sparks.length} 颗 · 能量 ${smooth.toFixed(3)}`,',
  '自检火花数',
)

writeFileSync(F, s, 'utf8')
console.log(miss === 0 ? '\n全部替换成功' : `\n有 ${miss} 处未匹配`)
