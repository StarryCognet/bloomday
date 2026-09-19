/**
 * 改成：序章播完，点屏幕任意处 -> 直接进站。
 * 不再显示封印自己的那几行（9.19 / 妹妹的生日 / 问候语 / 点我开始）——
 * 那些内容在第二幕主视觉里本来就有，没必要先给一遍。
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

// 1) 删掉 reveal()，连带那个标志位
rep(
  `/** 封印文字是否已经显出来（第一拍：只放序章，文字藏着） */
let revealed = false

let started = false`,
  `let started = false`,
)

rep(
  `/** 第二拍：点屏幕任意处，封印文字显出来 + 给序章解锁声音并从头播 */
function reveal(): void {
  if (revealed) return
  revealed = true
  sealEl.classList.remove('is-stowed')
  // 文字淡入交给 CSS，这里只补一个"砸下来"的力度
  charSlam(dateEl, { direction: 'up', duration: 0.7, intensity: 0.9, stagger: 0.07 })
  const frame = document.getElementById('ark-frame') as HTMLIFrameElement | null
  try {
    const d = frame?.contentDocument
    d?.getElementById('audio-toggle')?.click() // 解锁声音（同时开始加载）
    d?.getElementById('replay')?.click() // 从头播，让画面和声音对得上
  } catch {
    // 同源应该没问题；结构变了也不该拦住入场
  }
}

function enter(): void {`,
  `function enter(): void {`,
)

// 2) enter() 里不再先显字
rep(
  `function enter(): void {
  if (started) return
  // 还没显字就点「点我开始」的话，先显字
  if (!revealed) reveal()
  started = true`,
  `function enter(): void {
  if (started) return
  started = true`,
)

// 3) 点任意处 = 进站
rep(
  `// 第一拍：点屏幕任意处显字。用捕获阶段，免得被封印里的元素吃掉。
sealEl.addEventListener('click', reveal, { capture: true })`,
  `// 序章之后点屏幕任意处直接进站。用捕获阶段，免得被封印里的元素吃掉。
sealEl.addEventListener('click', enter, { capture: true })`,
)

// 4) 提示语跟着改
rep(`    <p class="seal__tap">看完点一下</p>`, `    <p class="seal__tap">点一下开始</p>`)

writeFileSync(F, s, 'utf8')
console.log(miss === 0 ? '\n替换成功' : `\n有 ${miss} 处未匹配`)
