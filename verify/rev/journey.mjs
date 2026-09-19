/**
 * 独立复核 · 行程式残留测试（只读）
 *
 * 模拟真实旅程：进入 → 依次滚过每一幕 → 到底 → 再滚回来。
 * 关键点：不用"直接跳到某 y 再截图"，而是走完整序列，这样才能暴露
 * "快速跳幕导致进场动画没播、元素停在半透明"这类残留。
 *
 * 用法: node verify/rev/journey.mjs <url> <outDir> <tag>
 */
import { writeFile, mkdir } from 'node:fs/promises'
import { join } from 'node:path'

const PORT = process.env.CDP_PORT ?? '9222'
const [url, outDir, tag] = process.argv.slice(2)
await mkdir(outDir, { recursive: true })

const targets = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()
const page = targets.find((t) => t.type === 'page')
const ws = new WebSocket(page.webSocketDebuggerUrl)
let seq = 0
const pending = new Map()
const seen = new Set()
const send = (m, p = {}) =>
  new Promise((res, rej) => {
    const id = ++seq
    pending.set(id, { res, rej })
    ws.send(JSON.stringify({ id, method: m, params: p }))
  })
ws.addEventListener('message', (ev) => {
  const msg = JSON.parse(ev.data)
  if (msg.id && pending.has(msg.id)) {
    const { res, rej } = pending.get(msg.id)
    pending.delete(msg.id)
    msg.error ? rej(new Error(msg.error.message)) : res(msg.result)
  } else if (msg.method) seen.add(msg.method)
})
await new Promise((r, j) => {
  ws.addEventListener('open', r, { once: true })
  ws.addEventListener('error', () => j(new Error('WS fail')), { once: true })
})
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
await send('Page.enable')
await send('Runtime.enable')
await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true, screenWidth: 390, screenHeight: 844 })
await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 })

const ev = async (e) => {
  const r = await send('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true })
  if (r.exceptionDetails) return { __err: r.exceptionDetails.exception?.description }
  return r.result?.value
}
const shot = async (f) => {
  const s = await send('Page.captureScreenshot', { format: 'png' })
  await writeFile(f, Buffer.from(s.data, 'base64'))
}

await send('Page.navigate', { url })
const t0 = Date.now()
let domAt = 0
while (!seen.has('Page.loadEventFired') && Date.now() - t0 < 25000) {
  if (!domAt && seen.has('Page.domContentEventFired')) domAt = Date.now()
  if (domAt && Date.now() - domAt > 2000) break
  await sleep(60)
}
await sleep(1200)

// 点封印
const r = await send('Runtime.evaluate', {
  returnByValue: true,
  expression: `(function(){var e=document.querySelector('.seal__cta');var b=e.getBoundingClientRect();return {x:Math.round(b.x+b.width/2),y:Math.round(b.y+b.height/2)}})()`,
})
const c = { ...r.result.value, button: 'left', clickCount: 1 }
await send('Input.dispatchMouseEvent', { type: 'mouseMoved', ...c })
await send('Input.dispatchMouseEvent', { type: 'mousePressed', ...c })
await send('Input.dispatchMouseEvent', { type: 'mouseReleased', ...c })
await sleep(2200)

const GALLERY_STATE = `(function(){
  var cards=Array.from(document.querySelectorAll('.gcard'));
  var op=cards.map(function(c){return Number(Number(getComputedStyle(c).opacity).toFixed(3))});
  var tr=cards.map(function(c){return c.style.transform||''});
  var vis=cards.map(function(c){var r=c.getBoundingClientRect();return Math.round(r.top)});
  var f=cards[0]?cards[0].querySelector('.gcard__frame'):null;
  var imgs=Array.from(document.querySelectorAll('.gcard__img')).map(function(i){return i.complete+':'+i.naturalWidth+':'+getComputedStyle(i).display});
  return JSON.stringify({cardOpacity:op,cardInlineTransform:tr,cardAbsTop:vis,
    frameCls:f?f.className:null, imgs:imgs,
    galOpacity:Number(getComputedStyle(document.querySelector('.gal')).opacity),
    dots:Array.from(document.querySelectorAll('.gal__dot')).map(function(d){return d.className}),
    trackScrollLeft:document.querySelector('#gal-track').scrollLeft});
})()`

async function probe(label) {
  const s = await ev(GALLERY_STATE)
  console.log(`  [${label}] ${s}`)
  return JSON.parse(s)
}

console.log('── 起手（仅点击封印，未滚动）──')
await probe('fresh')

console.log('── 滚到底部 3601 ──')
await ev('window.scrollTo(0,3601)')
await sleep(1200)
const atBottom = await probe('bottom')
await shot(join(outDir, `${tag}-1-bottom.png`))

console.log('── 滚回角色幕 2757 ──')
await ev('window.scrollTo(0,2757)')
await sleep(1200)
const back = await probe('back-to-gallery')
await shot(join(outDir, `${tag}-2-backgallery.png`))

console.log('── 滚回顶部 0 ──')
await ev('window.scrollTo(0,0)')
await sleep(1200)
const top = await probe('back-to-top')
await shot(join(outDir, `${tag}-3-top.png`))

const final = await ev(`JSON.stringify({rep:window.__siteReport(),scrollY:window.scrollY})`)
console.log(`\n最终: ${final}`)
console.log(`\n判定要点:`)
console.log(`  底部时卡片 opacity = ${JSON.stringify(atBottom.cardOpacity)}  (期望全 1)`)
console.log(`  滚回角色幕 opacity = ${JSON.stringify(back.cardOpacity)}  (期望全 1)`)
console.log(`  滚回顶部 opacity   = ${JSON.stringify(top.cardOpacity)}`)
const degraded = back.cardOpacity.filter((v) => v < 0.99).length
console.log(`  → 滚回角色幕后仍非全不透明的卡片数 = ${degraded} / 4`)
ws.close()
