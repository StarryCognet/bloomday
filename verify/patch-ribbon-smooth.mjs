/**
 * 把飘带从"逐段描边"改成"填充多边形"。
 * 逐段描边 + round cap 会在每段接缝处鼓出一块，看起来像一串珠子；
 * 填充多边形才是真正的锥形带子，而且能沿长度做渐隐。
 */
import { readFileSync, writeFileSync } from 'node:fs'

const F = 'src/ribbons.ts'
let s = readFileSync(F, 'utf8')
let miss = 0
const rep = (from, to) => {
  if (!s.includes(from)) {
    console.log('MISS: ' + from.split('\n')[0].slice(0, 60))
    miss++
    return
  }
  s = s.replace(from, to)
  console.log('OK  : ' + from.split('\n')[0].slice(0, 60))
}

const oldFn = `  function drawRibbon(r: Ribbon, t: number, e: number): void {
    const color = HEX[r.hue]
    const rx = r.x * cssW
    const ry = r.y * cssH
    const len = r.len * cssH * (0.75 + e * 0.7)
    ctx.lineCap = 'round'
    for (let s = 0; s < SEG; s++) {
      const p0 = s / SEG
      const p1 = (s + 1) / SEG
      const wob = (p: number): number =>
        Math.sin(t * r.rate + r.phase + p * 3.4) * (18 + e * 46) * (1 - p * 0.35)
      const x0 = rx + wob(p0)
      const x1 = rx + wob(p1)
      const y0 = ry - p0 * len
      const y1 = ry - p1 * len
      // 上粗下细 + 两端淡出：飘带的手感全在这
      const taper = Math.sin(p0 * Math.PI)
      ctx.strokeStyle = withAlpha(color, (0.05 + e * 0.30) * taper)
      ctx.lineWidth = Math.max(0.6, r.width * taper * (0.6 + e * 0.9))
      ctx.beginPath()
      ctx.moveTo(x0, y0)
      ctx.lineTo(x1, y1)
      ctx.stroke()
    }
  }`

const newFn = `  function drawRibbon(r: Ribbon, t: number, e: number): void {
    const color = HEX[r.hue]
    const rx = r.x * cssW
    const ry = r.y * cssH
    const len = r.len * cssH * (0.75 + e * 0.7)
    const wob = (p: number): number =>
      Math.sin(t * r.rate + r.phase + p * 3.4) * (14 + e * 34) * (1 - p * 0.35)

    // 左右两条边 + 沿长度渐隐 -> 一条真正平滑的锥形带子。
    // 别用逐段描边：round cap 会在接缝鼓包，看起来像一串珠子。
    ctx.beginPath()
    for (let i = 0; i <= SEG; i++) {
      const p = i / SEG
      const hw = Math.max(0.4, r.width * Math.sin(p * Math.PI) * (0.55 + e * 0.7)) / 2
      const x = rx + wob(p) - hw
      const y = ry - p * len
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    for (let i = SEG; i >= 0; i--) {
      const p = i / SEG
      const hw = Math.max(0.4, r.width * Math.sin(p * Math.PI) * (0.55 + e * 0.7)) / 2
      ctx.lineTo(rx + wob(p) + hw, ry - p * len)
    }
    ctx.closePath()
    const grad = ctx.createLinearGradient(0, ry, 0, ry - len)
    grad.addColorStop(0, withAlpha(color, 0))
    grad.addColorStop(0.34, withAlpha(color, 0.035 + e * 0.19))
    grad.addColorStop(1, withAlpha(color, 0))
    ctx.fillStyle = grad
    ctx.fill()
  }`

rep(oldFn, newFn)
rep('        width: 12 + Math.random() * 26,', '        width: 10 + Math.random() * 20,')
writeFileSync(F, s, 'utf8')
console.log(miss === 0 ? '\n替换成功' : `\n有 ${miss} 处未匹配`)
