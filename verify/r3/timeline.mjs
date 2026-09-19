/**
 * 第三轮独立复核 · 细时间线探针（不抓像素，只读运行态 + 计算"可见文字"集合）
 * 目的：定位"整屏空白"的起止毫秒数，并对像素连拍做交叉验证。
 * 用法：node verify/r3/timeline.mjs <prefix> [--offs=...] [--media=a:b] [--samples=...]
 */
import { writeFileSync, mkdirSync } from 'node:fs'

const PORT = process.env.CDP_PORT ?? '9222'
const argv = process.argv.slice(2)
const prefix = argv[0]
const OUT = 'verify/shots/r3'
mkdirSync(OUT, { recursive: true })
const opt = {}
for (const a of argv.slice(1)) { if (a.startsWith('--')) { const [k, v] = a.replace(/^--/, '').split('='); opt[k] = v ?? 'true' } }
const offs = (opt.offs ?? '0,60,120,180,240,300,340,380,420,460,520,560,600,640,680,720,760,800,840,880,920,960').split(',').map(Number)

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
await send('Page.navigate', { url: `http://127.0.0.1:4173/index.html?tl=${Date.now()}` })
{ const t0 = Date.now(); while (Date.now() - t0 < 20000) { const st = await ev('document.readyState').catch(() => null); if (st === 'complete' || st === 'interactive') break; await sleep(40) } }
await sleep(2200)

const PROBE = `(function(){
  function eff(el){var op=1,c=el;while(c&&c!==document.documentElement){var s=getComputedStyle(c);if(s.display==='none'||s.visibility==='hidden')return 0;op*=Number(s.opacity);if(op<=0.002)return 0;c=c.parentElement}return op}
  function vis(){var out=[];document.querySelectorAll('h1,h2,p,span,b,em,button,div').forEach(function(el){
    var direct=false;for(var i=0;i<el.childNodes.length;i++){var n=el.childNodes[i];if(n.nodeType===3&&n.textContent.trim().length>0){direct=true;break}}
    if(!direct)return;var r=el.getBoundingClientRect();
    if(!(r.bottom>4&&r.top<innerHeight-4&&r.right>0&&r.left<innerWidth))return;
    var e=eff(el); if(e>0.1) out.push((el.closest('#seal')?'seal':(el.closest('.act')?el.closest('.act').id:'other'))+':'+(el.id?('#'+el.id):('.'+(el.className||'').toString().trim().split(/\\s+/)[0]))+'@'+e.toFixed(2));
  });return out}
  var s=document.getElementById('seal'),i=document.getElementById('seal-inner'),m=document.getElementById('mv');
  return JSON.stringify({sealDisp:getComputedStyle(s).display,sealOp:+getComputedStyle(s).opacity,innerOp:+getComputedStyle(i).opacity,
    innerY:getComputedStyle(i).transform,mvOp:m?+getComputedStyle(m).opacity:null,visible:vis()});
})()`

const rows = []
const sample = async (nominal) => { const t = Date.now() - tC; const v = JSON.parse(await ev(PROBE)); rows.push({ nominal, realMs: t, ...v }) }

const p = await ev(`(function(){var e=document.querySelector('.seal__cta');var b=e.getBoundingClientRect();return {x:Math.round(b.x+b.width/2),y:Math.round(b.y+b.height/2)}})()`)
const c = { x: p.x, y: p.y, button: 'left', clickCount: 1 }
await send('Input.dispatchMouseEvent', { type: 'mouseMoved', ...c })
await send('Input.dispatchMouseEvent', { type: 'mousePressed', ...c })
await send('Input.dispatchMouseEvent', { type: 'mouseReleased', ...c })
const tC = Date.now()
for (const o of offs) { const w = tC + o - Date.now(); if (w > 0) await sleep(w); await sample(o) }
await sleep(1500)
const fin = JSON.parse(await ev(PROBE))

console.log(`===== timeline ${prefix} media=${opt.media ?? '-'} =====`)
console.log('nominal realMs sealDisp sealOp innerOp innerY                       mvOp | 可见文字(eff>0.1)')
for (const r of rows) {
  console.log(`${String(r.nominal).padStart(5)} ${String(r.realMs).padStart(6)} ${r.sealDisp.padEnd(7)} ${String(r.sealOp).padStart(6)} ${String(r.innerOp).padStart(7)} ${(r.innerY || '-').padEnd(30)} ${String(r.mvOp).padStart(4)} | ${r.visible.join(' ') || '—'}`)
}
// 空白窗口：整屏没有任何 eff>0.1 的视口内文字
const blank = rows.filter((r) => r.visible.length === 0)
let seg = null
const segs = []
for (const r of rows) {
  if (r.visible.length === 0) { if (!seg) seg = [r.realMs, r.realMs]; else seg[1] = r.realMs }
  else if (seg) { segs.push(seg); seg = null }
}
if (seg) segs.push(seg)
console.log(`\n空白帧=${blank.map((b) => b.nominal).join(',') || '无'}`)
console.log(`估算空白窗口(相邻采样点跨度)=${segs.map((s) => `${s[0]}~${s[1]}ms`).join(' , ') || '无'}`)
console.log(`终态=${JSON.stringify(fin)}`)
writeFileSync(`${OUT}/${prefix}-timeline.json`, JSON.stringify({ prefix, media: opt.media ?? null, rows, blank: blank.map((b) => b.realMs), segs, fin }))
ws.close()
