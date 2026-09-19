/**
 * 序章有声：第一次点击先让序章出声并从头播，第二次点击才进站。
 *
 * 为什么必须两步：浏览器不允许网页自动出声，音频必须由一次用户手势解锁。
 * 想让序章有声音，就只能把"解锁"这一步显式做出来。
 */
import { readFileSync, writeFileSync } from 'node:fs'

const F = 'src/app.ts'
let s = readFileSync(F, 'utf8')
let miss = 0
const rep = (from, to) => {
  if (!s.includes(from)) {
    console.log('MISS: ' + from.split('\n')[0].slice(0, 64))
    miss++
    return
  }
  s = s.replace(from, to)
  console.log('OK  : ' + from.split('\n')[0].slice(0, 64))
}

rep(
  'let started = false',
  `let started = false
/** 序章是否已经出过声（第一次点击只做解锁+重播，不进站） */
let prologuePlayed = false`,
)

rep(
  `function enter(): void {
  if (started) return
  started = true`,
  `function enter(): void {
  if (started) return

  // 第一次点击：让序章出声并从 0 重播（音频必须由手势解锁，绕不过去）
  const frame = document.getElementById('ark-frame') as HTMLIFrameElement | null
  if (frame && !prologuePlayed) {
    prologuePlayed = true
    try {
      const d = frame.contentDocument
      d?.getElementById('audio-toggle')?.click() // 解除静音（同时开始加载音频）
      d?.getElementById('replay')?.click() // 从头播，别让它已经跑了一半
    } catch {
      // 同源应该没问题；结构变了也不该拦住进站
    }
    const label = document.querySelector<HTMLElement>('.seal__cta-text')
    if (label) label.textContent = '进入'
    const hint = document.querySelector<HTMLElement>('.seal__scroll')
    if (hint) hint.textContent = '开场曲放完，或再点一次'
    return
  }

  started = true`,
)

writeFileSync(F, s, 'utf8')
console.log(miss === 0 ? '\n替换成功' : `\n有 ${miss} 处未匹配`)
