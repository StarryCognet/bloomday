/**
 * 祝福幕加两种呈现方式：
 *   lyric —— 第 3 段（"歌里唱…"）做成大字歌词卡，逐字依次点亮
 *   type  —— 第 4 段（"以后的事我也想了"）做成打字机，逐字显形 + 光标
 *
 * 索引写在这里而不是配置里：这几段的**文案**属于配置（内容），
 * 而"用哪种方式演"属于这一幕的表现，归本幕管。
 */
import { readFileSync, writeFileSync } from 'node:fs'

const F = 'src/acts/blessing.ts'
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
  `const BLOCKS: BlockSpec[] = SITE.copy.blessing.blocks.map((lines, i) => ({
  ...(MOTIONS[i % MOTIONS.length] as Omit<BlockSpec, 'lines'>),`,
  `/** 指定某几段换一种呈现方式（0 起）。改这里就能换段落。 */
const STYLE_OVERRIDE: Record<number, string> = {
  2: 'lyric', // 「歌里唱『好好吃…』」—— 这句本来就是歌，做成歌词卡
  3: 'type', // 「以后的事我也想了」—— 情绪最重的一段，打字机更有停顿感
}

const BLOCKS: BlockSpec[] = SITE.copy.blessing.blocks.map((lines, i) => ({
  ...(MOTIONS[i % MOTIONS.length] as Omit<BlockSpec, 'lines'>),
  ...(STYLE_OVERRIDE[i] ? { motion: STYLE_OVERRIDE[i] } : {}),`,
)

rep(
  `        (b, i) => \`<section class="blk\${b.punch ? ' blk--punch' : ''}" data-blk="b\${i + 1}">`,
  `        (b, i) =>
          \`<section class="blk\${b.punch ? ' blk--punch' : ''}\${
            STYLE_OVERRIDE[i] ? \` blk--\${STYLE_OVERRIDE[i]}\` : ''
          }" data-blk="b\${i + 1}">`,
)

rep(
  `      case 'ripple':
        tl.add(ripple(blk, { intensity: 0.7, rings: 3 }), 0)
        tl.fromTo(ls, { opacity: 0, y: 30 }, fade, 0.12)
        break`,
  `      case 'ripple':
        tl.add(ripple(blk, { intensity: 0.7, rings: 3 }), 0)
        tl.fromTo(ls, { opacity: 0, y: 30 }, fade, 0.12)
        break
      // 歌词卡：逐字依次点亮（步长大，一句被"唱"出来的感觉）
      case 'lyric':
        ls.forEach((line, i) => {
          tl.add(
            charSlam(line, { direction: 'up', duration: 0.55, intensity: 0.45, stagger: 0.085 }),
            i * 0.2,
          )
        })
        break
      // 打字机：逐字显形，位移很小（像是被打出来的，不是被砸出来的）
      case 'type':
        ls.forEach((line, i) => {
          tl.add(
            charSlam(line, { direction: 'up', duration: 0.4, intensity: 0.18, stagger: 0.11 }),
            i * 0.42,
          )
        })
        break`,
)

writeFileSync(F, s, 'utf8')
console.log(miss === 0 ? '\n替换成功' : `\n有 ${miss} 处未匹配`)
