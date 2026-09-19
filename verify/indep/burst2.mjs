/**
 * 独立复核者自备：转场连拍（自带媒体特性模拟，例如 prefers-reduced-motion:reduce）。
 * 用法：node verify/indep/burst2.mjs <outPrefix> [--media=a:b] [--wait=n] [--offs=0,60,...]
 */
import { writeFileSync, mkdirSync } from 'node:fs'
import { decodePng, frameStats } from './png.mjs'

const PORT = process.env.CDP_PORT ?? '9222'
const argv = process.argv.slice(2)
const prefix = argv[0] ?? 'burst'
const outDir = argv[1] ?? 'verify/shots/indep'
mkdirSync(outDir, { recursive: true })
const opt = {}
for (const a of argv.slice(2)) {
  if (!a.startsWith('--')) continue
  const [k, v] = a.replace(/^--/, '').split('=')
  opt[k] = v ?? 'true'
}
const W = 390, H = 844
const offs = (opt.offs ?? '0,60,120,180,240,320,420,550,700,900,1200').split(',').map(Number)

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
await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: true, screenWidth: W, screenHeight: H })
if (opt.media) {
  const [n, v] = opt.media.split(':')
  await send('Emulation.setEmulatedMedia', { features: [{ name: n, value: v }] })
}
if (opt.cpu) await send('Emulation.setCPUThrottlingRate', { rate: Number(opt.cpu) })
await send('Page.navigate', { url: `http://127.0.0.1:4173/index.html?rev=${Date.now()}` })
const t0 = Date.now()
while (Date.now() - t0 < 20000) {
  const st = await send('Runtime.evaluate', { expression: 'document.readyState', returnByValue: true }).then((r) => r.result?.value).catch(() => null)
  if (st === 'complete' || st === 'interactive') break
  await sleep(50)
}
const ev = async (e) => (await send('Runtime.evaluate', { expression: e, returnByValue: true })).result?.value
if (!opt.early) await sleep(2000)
const cap = async (f) => { const s = await send('Page.captureScreenshot', { format: 'png' }); const b = Buffer.from(s.data, 'base64'); writeFileSync(f, b); return b }
const rows = []
// 关键：先拍 pre，再点
{
  const b = await cap(`${outDir}/${prefix}-pre.png`)
  rows.push({ label: 'pre', ...frameStats(decodePng(b)) })
}
const p = await ev(`(function(){var e=document.querySelector('.seal__cta');if(!e)return null;var b=e.getBoundingClientRect();return {x:Math.round(b.x+b.width/2),y:Math.round(b.y+b.height/2)}})()`)
if (!p) { console.log('NO_CTA'); process.exit(1) }
const c = { x: p.x, y: p.y, button: 'left', clickCount: 1 }
await send('Input.dispatchMouseEvent', { type: 'mouseMoved', ...c })
await send('Input.dispatchMouseEvent', { type: 'mousePressed', ...c })
await send('Input.dispatchMouseEvent', { type: 'mouseReleased', ...c })
const tc = Date.now()
for (const o of offs) {
  const w = tc + o - Date.now(); if (w > 0) await sleep(w)
  const real = Date.now() - tc
  const b = await cap(`${outDir}/${prefix}-t${o}.png`)
  rows.push({ label: `t${o}`, realMs: real, ...frameStats(decodePng(b)) })
}
// 封印/主视觉 DOM 终态
const dom = await ev(`(function(){var s=document.getElementById('seal');var mv=document.getElementById('mv');return JSON.stringify({sealOpacity:getComputedStyle(s).opacity,sealDisplay:getComputedStyle(s).display,mvOpacity:getComputedStyle(mv).opacity,mvTransform:getComputedStyle(mv).transform,residBands:[].slice.call(document.querySelectorAll('.mt-band')).filter(function(b){return getComputedStyle(b).display!=='none'}).length,textCount:(function(){var n=0,w=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT,null),x;while((x=w.nextNode())){if(x.textContent.trim()){var r=document.createRange();r.selectNodeContents(x);var q=r.getBoundingClientRect();if(q.bottom>0&&q.top<innerHeight)n++}}return n})()})})()`)
console.log(JSON.stringify({ prefix, media: opt.media ?? null, dom, frames: rows }, null, 1))
ws.close()
