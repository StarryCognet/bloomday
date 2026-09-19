/** 一次性替换：画廊换成结城理的真图（已压缩），并换掉那句话。 */
import { readFileSync, writeFileSync } from 'node:fs'

const F = 'src/site.config.ts'
let s = readFileSync(F, 'utf8')
let miss = 0
const rep = (from, to) => {
  if (!s.includes(from)) {
    console.log('MISS: ' + from.split('\n')[0].slice(0, 70))
    miss++
    return
  }
  s = s.replace(from, to)
  console.log('OK  : ' + from.split('\n')[0].slice(0, 70))
}

rep(
  `    { src: './gallery/char-01.svg', name: '角色 01', note: '你说他笑起来最好看', tag: 'FAVORITE' },
    { src: './gallery/char-02.svg', name: '角色 02', note: '你手机壁纸一直是他', tag: 'WALLPAPER' },
    { src: './gallery/char-03.svg', name: '角色 03', note: '你为他哭过一整晚', tag: 'TEARS' },
    { src: './gallery/char-04.svg', name: '我们的合照', note: '这张是去年生日拍的', tag: 'US' },`,
  `    // note 留空 = 只显示名字，等你想写什么再填（我不替你编她的事）
    { src: './gallery/makoto-01.jpg', name: '结城理', note: '', tag: 'MAKOTO 01' },
    { src: './gallery/makoto-02.jpg', name: '结城理', note: '', tag: 'MAKOTO 02' },
    { src: './gallery/makoto-03.jpg', name: '结城理', note: '', tag: 'MAKOTO 03' },
    { src: './gallery/makoto-04.jpg', name: '结城理', note: '', tag: 'MAKOTO 04' },
    { src: './gallery/makoto-05.jpg', name: '结城理', note: '', tag: 'MAKOTO 05' },
    { src: './gallery/makoto-06.jpg', name: '结城理', note: '', tag: 'MAKOTO 06' },`,
)

rep(`      lead: '这些是你喜欢的角色，哥哥记着呢。',`, `      lead: '收集了一些结城理的优质图片，高清图找你哥要。',`)

writeFileSync(F, s, 'utf8')
console.log(miss === 0 ? '\n全部替换成功' : `\n有 ${miss} 处未匹配`)
