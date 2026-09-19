/**
 * 平板兼容。
 *
 * 思路：字号全站都吃 token，所以**在 token 层加一个平板断点抬高封顶**，
 * 一站到底；布局层面（内容最大宽度、卡片密度、歌词尺寸）另开一份覆盖。
 *
 * 为什么必须抬高封顶：现在的 clamp 上界是按手机定的（hero 封在 9rem），
 * 在 1024 宽的屏上 26vw = 266px 早就超了，结果就是**大屏上还是手机字号**，
 * 内容缩在中间一小块。
 */
import { readFileSync, writeFileSync } from 'node:fs'

const F = 'src/tokens.ts'
let s = readFileSync(F, 'utf8')
let miss = 0
const rep = (from, to) => {
  if (!s.includes(from)) {
    console.log('MISS: ' + from.split('\n')[0].slice(0, 62))
    miss++
    return
  }
  s = s.replace(from, to)
  console.log('OK  : ' + from.split('\n')[0].slice(0, 62))
}

rep(
  `export type TypeLevel = keyof typeof typography`,
  `/** 平板及以上（>=640px）：同样的层级，但把封顶抬高 —— 大屏不该还是手机字号 */
export const tabletTypography: Record<keyof typeof typography, string> = {
  hero: 'clamp(5.5rem, 17vw, 13rem)',
  h1: 'clamp(2.4rem, 6vw, 4.5rem)',
  h2: 'clamp(1.6rem, 3.4vw, 2.4rem)',
  body: 'clamp(1.15rem, 2.2vw, 1.5rem)',
  label: 'clamp(0.8rem, 1.3vw, 1rem)',
}

export type TypeLevel = keyof typeof typography`,
)

rep(
  `/** 生成注入 index.html 的 :root 样式块 */
export function tokenCss(): string {
  const body = Object.entries(cvars)
    .map(([k, v]) => \`  \${k}: \${v};\`)
    .join('\\n')
  return \`:root {\\n\${body}\\n}\`
}`,
  `/** 生成注入 index.html 的 :root 样式块（含平板断点） */
export function tokenCss(): string {
  const body = Object.entries(cvars)
    .map(([k, v]) => \`  \${k}: \${v};\`)
    .join('\\n')
  const tablet = Object.entries(tabletTypography)
    .map(([level, size]) => \`  --fs-\${level}: \${size};\`)
    .join('\\n')
  return [
    \`:root {\\n\${body}\\n}\`,
    \`/* 平板及以上：只覆盖字号，字重/字距/行高沿用手机那套 */\\n@media (min-width: 640px) {\\n  :root {\\n\${tablet
      .split('\\n')
      .map((l) => '  ' + l)
      .join('\\n')}\\n  }\\n}\`,
  ].join('\\n')
}`,
)

writeFileSync(F, s, 'utf8')
console.log(miss === 0 ? '\n替换成功' : `\n有 ${miss} 处未匹配`)
