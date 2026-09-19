/**
 * 第三轮独立复核 · 通用运行态探针（把 JS 放进文件，绕开 PowerShell 的引号/转义问题）
 * 用法：node verify/r3/probe.mjs --jsfile=verify/r3/probe-rm-pre.js [--media=a:b] [--wait=300] [--click=0]
 */
import { readFileSync } from 'node:fs'

const PORT = process.env.CDP_PORT ?? '9222'
const argv = process.argv.slice(2)
const opt = {}
for (const a of argv) { if (a.startsWith('--')) { const [k, v] = a.replace(/^--/, '').split('='); opt[k] = v ?? 'true' } }
const expr = readFileSync(opt.jsfile, 'utf8')

const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()
const page = list.find((t) => t.type === 'page')
const ws = new WebSocket(page.webSocketDebuggerUrl)
let seq = 0
const pending = new Map()
const send = (m, p = {}) => new Promise((res, rej) => { const id = ++seq; pending.set(id, { res, rej }); ws.send(JSON.stringify({ id, method: m, params: p })) })
ws.addEventListener('message', (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { const { res, rej } = pending.get(m.id); pending.delete(m.id); m.error ? rej(new Error(m.error.message)) : res(m.result) } })
await new Promise((res, rej) => { ws.addEventListener('open', res, { once: true }); ws.addEventListener('error', () => rej(new Error('ws')), { once: true }) })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const ev = async (x) => { const r = await send('Runtime.evaluate', { expression: x, returnByValue: true, awaitPromise: true }); if (r.exceptionDetails) throw new Error('eval ' + (r.exceptionDetails.exception?.description ?? r.exceptionDetails.text)); return r.result?.value }

await send('Page.enable'); await send('Runtime.enable')
await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true, screenWidth: 390, screenHeight: 844 })
if (opt.media) { const [n, v] = opt.media.split(':'); await send('Emulation.setEmulatedMedia', { features: [{ name: n, value: v }] }) }
await send('Page.navigate', { url: opt.url ?? `http://127.0.0.1:4173/index.html?p=${Date.now()}` })
{ const t0 = Date.now(); while (Date.now() - t0 < 20000) { const st = await ev('document.readyState').catch(() => null); if (st === 'complete' || st === 'interactive') break; await sleep(30) } }
if (opt.wait) await sleep(Number(opt.wait))
if (opt.click === '1') {
  const p = await ev(`(function(){var e=document.querySelector('.seal__cta');var b=e.getBoundingClientRect();return {x:Math.round(b.x+b.width/2),y:Math.round(b.y+b.height/2)}})()`)
  const c = { x: p.x, y: p.y, button: 'left', clickCount: 1 }
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', ...c })
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', ...c })
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', ...c })
  if (opt.after) await sleep(Number(opt.after))
}
console.log(JSON.stringify(await ev(expr), null, 1))
ws.close()
