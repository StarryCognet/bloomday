/**
 * 「单一配置源」验收工具：改写 src/site.config.ts，然后交给构建与探针去判。
 *
 * 用法：
 *   node verify/config-swap.mjs --case=swap      换文案/日期/图/歌
 *   node verify/config-swap.mjs --case=badimage  把图路径故意改错
 *   node verify/config-swap.mjs --case=calm      动效强度拉到 0
 *   node verify/config-swap.mjs --restore        还原
 *
 * 每次都从 .orig 备份还原后再改，保证三个 case 互不污染。
 * 用完必须 --restore（脚本里也会提示）。
 */
import { readFileSync, writeFileSync, existsSync, copyFileSync } from 'node:fs'

const FILE = 'src/site.config.ts'
const BACKUP = 'verify/.site.config.orig.ts'

if (!existsSync(BACKUP)) copyFileSync(FILE, BACKUP)

const arg = process.argv.find((a) => a.startsWith('--case='))?.slice(7)
const restore = process.argv.includes('--restore')

let src = readFileSync(BACKUP, 'utf8')

if (restore) {
  writeFileSync(FILE, src, 'utf8')
  console.log('[config] 已还原')
  process.exit(0)
}

const replaceOnce = (from, to) => {
  if (!src.includes(from)) throw new Error(`找不到要替换的内容：${from}`)
  src = src.replace(from, to)
}

switch (arg) {
  case 'swap': {
    replaceOnce("name: '妹妹'", "name: '小星'")
    replaceOnce('age: 12', 'age: 13')
    replaceOnce("dateLabel: '9.19'", "dateLabel: '10.20'")
    replaceOnce("dateFull: '2026.9.19'", "dateFull: '2027.10.20'")
    replaceOnce("bgm: './blessing.mp3'", "bgm: './blessing.mp3?v=swap'")
    replaceOnce("src: './gallery/char-01.svg'", "src: './gallery/swapped-01.svg'")
    replaceOnce("name: '角色 01'", "name: '角色甲'")
    replaceOnce("note: '你说他笑起来最好看'", "note: '换过的一句话'")
    replaceOnce("cta: '点我开始'", "cta: '开始吧'")
    replaceOnce("title: '生日快乐'", "title: '生日大喜'")
    replaceOnce("sign: '—— 永远爱你的哥哥'", "sign: '—— 换过的签名'")
    console.log('[config] case=swap 已写入')
    break
  }
  case 'badimage': {
    for (const n of ['01', '02', '03', '04']) {
      replaceOnce(`src: './gallery/char-${n}.svg'`, `src: './gallery/does-not-exist-${n}.webp'`)
    }
    console.log('[config] case=badimage 已写入（四张图路径全指向不存在的文件）')
    break
  }
  case 'calm': {
    replaceOnce('strength: 1,', 'strength: 0,')
    console.log('[config] case=calm 已写入（动效强度 0）')
    break
  }
  default:
    console.error('用法: node verify/config-swap.mjs --case=swap|badimage|calm | --restore')
    process.exit(2)
}

writeFileSync(FILE, src, 'utf8')
