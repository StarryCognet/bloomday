/**
 * 开场改成两拍：
 *   第一拍 —— 只放序章（干净的主视觉）+ 底部一句「看完点一下」
 *   第二拍 —— 点屏幕任意处：封印文字显出来（同时给序章解锁声音并从头播）
 * 然后才轮到「点我开始」进站。
 */
import { readFileSync, writeFileSync } from 'node:fs'

let miss = 0
const patch = (file, pairs) => {
  let s = readFileSync(file, 'utf8')
  for (const [from, to] of pairs) {
    if (!s.includes(from)) {
      console.log(`MISS ${file}: ${from.split('\n')[0].slice(0, 60)}`)
      miss++
      continue
    }
    s = s.replace(from, to)
    console.log(`OK   ${file}: ${from.split('\n')[0].slice(0, 60)}`)
  }
  writeFileSync(file, s, 'utf8')
}

patch('src/app.ts', [
  [
    '    <p class="seal__scroll">SCROLL</p>',
    '    <p class="seal__scroll">SCROLL</p>\n    <p class="seal__tap">看完点一下</p>',
  ],
  [
    'let started = false',
    `/** 封印文字是否已经显出来（第一拍：只放序章，文字藏着） */
let revealed = false

let started = false`,
  ],
  [
    'function enter(): void {',
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
  ],
  [
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
    // 兜底：点了第一次却不点第二次 = 卡在封印上。给个自动进站，别让她出不去。
    window.setTimeout(() => {
      if (!started) enter()
    }, 12000)
    return
  }

  started = true`,
    `function enter(): void {
  if (started) return
  // 还没显字就点「点我开始」的话，先显字
  if (!revealed) reveal()
  started = true`,
  ],
  [
    "cta.addEventListener('click', enter)",
    `cta.addEventListener('click', enter)
// 第一拍：点屏幕任意处显字。用捕获阶段，免得被封印里的元素吃掉。
sealEl.addEventListener('click', reveal, { capture: true })
// 一进来先把文字藏着，只放序章
sealEl.classList.add('is-stowed')`,
  ],
])

patch('src/seal.css', [
  [
    '.seal__scroll {',
    `/* 第一拍：只看序章，封印文字全藏着 */
.seal.is-stowed .seal__meta,
.seal.is-stowed .seal__nav,
.seal.is-stowed .seal__logo,
.seal.is-stowed .seal__greeting,
.seal.is-stowed .seal__cta,
.seal.is-stowed .seal__scroll,
.seal.is-stowed .seal__corner {
  opacity: 0;
  pointer-events: none;
}
.seal__meta,
.seal__nav,
.seal__logo,
.seal__greeting,
.seal__cta {
  transition: opacity 0.6s ease;
}
/* 「看完点一下」：只在第一拍出现 */
.seal__tap {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  bottom: calc(env(safe-area-inset-bottom, 0px) + 46px);
  z-index: 6;
  margin: 0;
  font-size: 0.72rem;
  letter-spacing: 0.22em;
  color: var(--c-white);
  opacity: 0;
  pointer-events: none;
}
.seal.is-stowed .seal__tap {
  opacity: 0.8;
}
.seal__scroll {`,
  ],
])

console.log(miss === 0 ? '\n全部替换成功' : `\n有 ${miss} 处未匹配`)
