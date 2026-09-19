/**
 * 独立复核 · 角色幕横向交互测试（只读）
 * 验证：滑到第 N 张时，中心卡是否被点亮（opacity→1）、圆点是否跟随。
 * 用法: node verify/rev/gal-interact.mjs <url> <outDir> <tag>
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
const click = async (sel) => {
  const r = await send('Runtime.evaluate', {
    returnByValue: true,
    expression: `(function(){var e=document.querySelector(${JSON.stringify(sel)});if(!e)return null;var b=e.getBoundingClientRect();return {x:Math.round(b.x+b.width/2),y:Math.round(b.y+b.height/2)}})()`,
  })
  if (!r.result.value) throw new Error('no ' + sel)
  const c = { ...r.result.value, button: 'left', clickCount: 1 }
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', ...c })
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', ...c })
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', ...c })
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
await click('.seal__cta')
await sleep(2200)
await ev('window.scrollTo(0,2757)')
await sleep(1500)

const ST = `(function(){
  var cards=Array.from(document.querySelectorAll('.gcard'));
  var tr=document.querySelector('#gal-track');
  var trc=tr.getBoundingClientRect();
  var center=trc.left+trc.width/2;
  return JSON.stringify({
    trackScrollLeft:Math.round(tr.scrollLeft),
    trackMax:Math.round(tr.scrollWidth-tr.clientWidth),
    cardOp:cards.map(function(c){return Number(Number(getComputedStyle(c).opacity).toFixed(2))}),
    cardScale:cards.map(function(c){return (c.style.transform||'').slice(0,22)}),
    cardZ:cards.map(function(c){return c.style.zIndex}),
    cardCenterOffset:cards.map(function(c){var r=c.getBoundingClientRect();return Math.round(r.left+r.width/2-center)}),
    dots:Array.from(document.querySelectorAll('.gal__dot')).map(function(d){return d.className.indexOf('is-on')>=0?'ON':'-'})
  });
})()`

console.log('── 初始（第 1 张居中）──')
console.log('  ' + (await ev(ST)))
await shot(join(outDir, `${tag}-g0.png`))

// 真实横滑：滚 track 到第 2、3、4 张
for (const i of [1, 2, 3]) {
  await ev(`(function(){var tr=document.querySelector('#gal-track');var cards=document.querySelectorAll('.gcard');var card=cards[${i}];var trc=tr.getBoundingClientRect();var r=card.getBoundingClientRect();tr.scrollTo({left:tr.scrollLeft+(r.left+r.width/2-(trc.left+trc.width/2)),behavior:'auto'});return tr.scrollLeft})()`)
  await sleep(1100)
  console.log(`── 滑到第 ${i + 1} 张 ──`)
  console.log('  ' + (await ev(ST)))
  await shot(join(outDir, `${tag}-g${i}.png`))
}

// 稍微回滑，验证 layout 是否真的在跟
await ev(`(function(){var tr=document.querySelector('#gal-track');tr.scrollBy({left:-40,behavior:'auto'});return tr.scrollLeft})()`)
await sleep(900)
console.log('── 从第 4 张回滑 40px ──')
console.log('  ' + (await ev(ST)))
ws.close()
