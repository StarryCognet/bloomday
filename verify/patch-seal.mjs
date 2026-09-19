/**
 * 一次性替换脚本：把 app.ts 里封印的退场换成 P3R 式，并接上水波焦散层。
 * 用 Node 而不是 PowerShell —— 这些文本里全是引号和 ${}，shell 会改坏它。
 * 跑完即可删（或留着当"上次改了哪几处"的记录）。
 */
import { readFileSync, writeFileSync } from 'node:fs'

const F = 'src/app.ts'
let s = readFileSync(F, 'utf8')
let misses = 0

const rep = (from, to) => {
  if (!s.includes(from)) {
    console.log('MISS: ' + from.split('\n')[0].slice(0, 70))
    misses++
    return
  }
  s = s.replace(from, to)
  console.log('OK  : ' + from.split('\n')[0].slice(0, 70))
}

rep(
  "import { createSmooth } from './smooth'",
  "import { createSmooth } from './smooth'\nimport { createCaustics } from './acts/caustics'",
)

rep(
  "const inner = document.querySelector<HTMLElement>('#seal-inner')!",
  '// 水波焦散层（P3R 的水纹母题）：常驻在蓝色色区里\ncreateCaustics(document.querySelector<HTMLCanvasElement>(\'#seal-caustics\')!)',
)

const oldBreak = `    // 【不要在整屏上做擦除】……（见上）
    const bandEl = document.querySelector<HTMLElement>('.seal__band')
    if (bandEl) tl.add(slashWipe(bandEl, { direction: 'right', duration: 0.55, intensity: 0.9 }), 0)
    // 【串行化】封印先把自己收干净，再让主视觉进场。
    // 原来把 mainVisual.enter() 放在 0.4s 与封印淡出**并行**，结果两幕文字
    // 同时可读连续 52 帧（实测 t=750ms 一帧上同时能读「点我开始」和砸入的「9.19」）。
    // 现在：0~0.38s 封印文字上移淡出 → 0.34~0.78s 封印整块淡掉（主视觉文字还藏着）
    //       → 0.78s 起主视觉才开始砸字。
    tl.to(inner, { y: -90, opacity: 0, duration: 0.38, ease: EASE.sink }, 0)
    tl.to(sealEl, { opacity: 0, duration: 0.44, ease: EASE.sink }, 0.34)
    tl.set(sealEl, { display: 'none' }, 0.8)
    tl.call(() => mainVisual.enter?.(nextEl), undefined, 0.78)`

const newBreak = `    // P3R 式退场：封印内容先散开 → 一条斜切亮带扫过蓝色色区 → 整块白底向上抽走，
    // 露出下面的暗蓝主场。**不做全屏擦除盖层**（那会变成"整屏遮盖"，前几轮栽过）。
    tl.to(
      ['.seal__logo', '.seal__meta', '.seal__greeting', '.seal__cta', '.seal__scroll', '.seal__nav', '.seal__corner'],
      { y: -38, opacity: 0, duration: 0.18, ease: EASE.sink, stagger: 0.022 },
      0,
    )
    tl.add(slashWipe('.seal__art', { direction: 'left', duration: 0.42, intensity: 0.7 }), 0.04)
    tl.to('.seal__art', { yPercent: -12, duration: 0.42, ease: EASE.sink }, 0.06)
    tl.to(sealEl, { yPercent: -100, duration: 0.4, ease: EASE.tear }, 0.12)
    tl.set(sealEl, { display: 'none' }, 0.54)
    // 主视觉 0.15s 就起手（它的文字在进场前是藏着的），这样封印一让开就已经在砸字，
    // 不会出现"屏幕上什么都没有"的空档。
    tl.call(() => mainVisual.enter?.(nextEl), undefined, 0.15)`

rep(oldBreak, newBreak)

writeFileSync(F, s, 'utf8')
console.log(misses === 0 ? '\n全部替换成功' : `\n有 ${misses} 处未匹配`)
