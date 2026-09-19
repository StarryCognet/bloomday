/**
 * 负向对照（判据有效性验证）：人为把"整屏纯色遮盖"重新塞回去，
 * 看独立判据能不能抓到。抓不到 = 判据是坏的，它报的 0 一文不值。
 *
 * 用法：node verify/indep/negative.mjs <mode> [--delay=200]
 *   mode = runtime   运行期注入一个整屏纯蓝 fixed 层（不动 src/）
 *   mode = band      把 mt-band 强行放大成整屏（模拟"擦除打在整屏上"）
 *   mode = none      对照：不注入任何东西
 */
import { writeFileSync, mkdirSync } from 'node:fs'
import { decodePng, frameStats } from './png.mjs'

const PORT = process.env.CDP_PORT ?? '9222'
const argv = process.argv.slice(2)
const mode = argv[0] ?? 'none'
const opt = {}
for (const a of argv.slice(1)) { if (a.startsWith('--')) { const [k, v] = a.replace(/^--/, '').split('='); opt[k] = v ?? 'true' } }
const delay = Number(opt.delay ?? 200)
const OUT = 'verify/shots/indep'
mkdirSync(OUT, { recursive: true })

const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()
const page = list.find((t) => t.type === 'page')
const ws = new WebSocket(page.webSocketDebuggerUrl)
let seq = 0
const pending = new Map()
const send = (m, p = {}) => new Promise((res, rej) => { const id = ++seq; pending.set(id, { res, rej }); ws.send(JSON.stringify({ id, method: m, params: p })) })
ws.addEventListener('message', (ev) => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { const { res, rej } = pending.get(m.id); pending.delete(m.id); m.error ? rej(new Error(m.error.message)) : res(m.result) } })
await new Promise((res, rej) => { ws.addEventListener('open', res, { once: true }); ws.addEventListener('error', () => rej(new Error('ws')), { once: true }) })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
await send('Page.enable'); await send('Runtime.enable')
await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true, screenWidth: 390, screenHeight: 844 })
await send('Page.navigate', { url: `http://127.0.0.1:4173/index.html?rev=${Date.now()}` })
const t0 = Date.now()
while (Date.now() - t0 < 20000) {
  const st = await send('Runtime.evaluate', { expression: 'document.readyState', returnByValue: true }).then((r) => r.result?.value).catch(() => null)
  if (st === 'complete' || st === 'interactive') break
  await sleep(50)
}
const ev = async (e) => (await send('Runtime.evaluate', { expression: e, returnByValue: true })).result?.value
await sleep(2000)
const p = await ev(`(function(){var e=document.querySelector('.seal__cta');var b=e.getBoundingClientRect();return {x:Math.round(b.x+b.width/2),y:Math.round(b.y+b.height/2)}})()`)
const c = { x: p.x, y: p.y, button: 'left', clickCount: 1 }
await send('Input.dispatchMouseEvent', { type: 'mouseMoved', ...c })
await send('Input.dispatchMouseEvent', { type: 'mousePressed', ...c })
await send('Input.dispatchMouseEvent', { type: 'mouseReleased', ...c })
const tc = Date.now()

if (mode === 'runtime') {
  setTimeout(() => {
    send('Runtime.evaluate', {
      expression: `(function(){var d=document.createElement('div');d.id='neg-cover';d.style.cssText='position:fixed;inset:0;background:rgb(20,64,184);z-index:9999';document.body.appendChild(d);return 1})()`,
      returnByValue: true,
    }).catch(() => {})
  }, delay)
}
if (mode === 'band') {
  setTimeout(() => {
    send('Runtime.evaluate', {
      expression: `(function(){var b=document.querySelector('.mt-band');if(!b)return 'NO_BAND';
        b.style.cssText='position:fixed;left:0;top:0;right:0;bottom:0;width:100vw;height:100vh;display:block;opacity:1;background:rgb(20,64,184);z-index:9999;transform:none;x:0;y:0';
        return 'FORCED'})()`,
      returnByValue: true,
    }).catch(() => {})
  }, delay)
}

const rows = []
const marks = [0, 100, 180, delay + 20, delay + 120, delay + 300, delay + 700]
for (const m of marks) {
  const w = tc + m - Date.now(); if (w > 0) await sleep(w)
  const real = Date.now() - tc
  const s = await send('Page.captureScreenshot', { format: 'png' })
  const b = Buffer.from(s.data, 'base64')
  writeFileSync(`${OUT}/neg-${mode}-t${m}.png`, b)
  rows.push({ at: m, realMs: real, ...frameStats(decodePng(b)) })
}
const dom = await ev(`(function(){var d=document.getElementById('neg-cover');return d?('cover w='+d.getBoundingClientRect().width+' h='+d.getBoundingClientRect().height):'no-injected-cover'})()`)
console.log(JSON.stringify({ mode, delay, dom, rows: rows.map((r) => ({ at: r.at, realMs: r.realMs, topShare: r.topShare, topColor: r.topColor, busyTiles: r.busyTiles, inkRatio: r.inkRatio })), verdict: `最大最高频色占比=${Math.max(...rows.map((r) => r.topShare)).toFixed(3)}` }, null, 1))
ws.close()
