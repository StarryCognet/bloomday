/** 加两幕的文案到配置（内容仍然单源）。 */
import { readFileSync, writeFileSync } from 'node:fs'

const F = 'src/site.config.ts'
let s = readFileSync(F, 'utf8')
const anchor = `    /** 第四幕 · 角色与照片 */`
if (!s.includes(anchor)) {
  console.log('MISS: 找不到插入锚点')
  process.exit(1)
}
const block = `    /** 第四幕 · 跟着歌跳的可视化（让中间有一个视觉高点，不只是字） */
    pulse: {
      label: 'NOW PLAYING',
      line: '这段就交给歌。',
    },

    /** 第五幕 · 礼物盒（全程唯一一次"她做了一件事"） */
    gift: {
      label: 'ONE MORE THING',
      line: '还有个东西。点一下。',
      after: '拿好了。',
    },

`
s = s.replace(anchor, block + anchor)
writeFileSync(F, s, 'utf8')
console.log('OK 已插入 pulse / gift 文案')
