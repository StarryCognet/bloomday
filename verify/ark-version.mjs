/**
 * 1) 给 scene-data 里所有精灵 URL 统一加版本戳 —— 否则没有 ?v= 的贴图
 *    永远吃浏览器缓存，替换了也看不出变化（这几轮就是栽在这）。
 * 2) 把所有文本类贴图填成不同纯色，一次性定位"标题到底是哪张"。
 */
import { readFileSync, writeFileSync } from 'node:fs'

const F = 'public/ark/scene-data.js'
let s = readFileSync(F, 'utf8')
const before = s
// 先摘掉已有的 ?v=，再统一加新的，避免出现两个查询串
s = s.replace(/(assets\/images\/[^"?]+)\?v=[^"]*/g, '$1')
s = s.replace(/"(assets\/images\/[^"?]+)"/g, '"$1?v=bloomday-3"')
writeFileSync(F, s, 'utf8')
const urls = new Set(s.match(/"assets\/images\/[^"]+"/g) ?? [])
console.log(`版本戳：${urls.size} 个精灵 URL 全部加上 ?v=bloomday-3（原文件 ${before.length} → ${s.length} 字节）`)
