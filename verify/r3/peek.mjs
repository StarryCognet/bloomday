/**
 * 第三轮独立复核 · 运行态取证：某个元素及其子节点的真实渲染属性（含 inline style）
 * 用法：node verify/r3/peek.mjs "<selector>" [--url=http://127.0.0.1:4173/index.html] [--click=1] [--wait=2500]
 */
const PORT = process.env.CDP_PORT ?? '9222'
const argv = process.argv.slice(2)
const sel = argv[0]
const opt = {}
for (const a of argv.slice(1)) { if (a.startsWith('--')) { const [k, v] = a.replace(/^--/, '').split('='); opt[k] = v ?? 'true' } }

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
if (opt.url) await send('Page.navigate', { url: opt.url })
{ const t0 = Date.now(); while (Date.now() - t0 < 20000) { const st = await ev('document.readyState').catch(() => null); if (st === 'complete' || st === 'interactive') break; await sleep(40) } }
if (opt.click) {
  await sleep(2200)
  const p = await ev(`(function(){var e=document.querySelector('.seal__cta');var b=e.getBoundingClientRect();return {x:Math.round(b.x+b.width/2),y:Math.round(b.y+b.height/2)}})()`)
  const c = { x: p.x, y: p.y, button: 'left', clickCount: 1 }
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', ...c })
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', ...c })
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', ...c })
}
await sleep(Number(opt.wait ?? 2500))

const out = await ev(`(function(){
  var root=document.querySelector(${JSON.stringify(sel)});
  if(!root)return JSON.stringify({error:'not found '+${JSON.stringify(sel)}});
  function desc(el,depth){
    var cs=getComputedStyle(el);var r=el.getBoundingClientRect();
    return {tag:el.tagName,cls:(el.className||'').toString(),inline:el.getAttribute('style')||'',
      rect:[Math.round(r.left),Math.round(r.top),Math.round(r.width),Math.round(r.height)],
      display:cs.display,opacity:cs.opacity,visibility:cs.visibility,transform:cs.transform,filter:cs.filter,
      color:cs.color,fontSize:cs.fontSize,text:(el.childNodes.length&&el.children.length===0?el.textContent:''),
      children:depth>0?[].map.call(el.children,function(c){return desc(c,depth-1)}):undefined};
  }
  var chars=root.querySelectorAll('.mt-char');
  var charInfo=[].map.call(chars,function(c){var cs=getComputedStyle(c);var r=c.getBoundingClientRect();
    return {t:c.textContent,inline:c.getAttribute('style')||'',op:+cs.opacity,fs:cs.fontSize,disp:cs.display,
      rect:[Math.round(r.left),Math.round(r.top),Math.round(r.width),Math.round(r.height)],filter:cs.filter,transform:cs.transform}});
  return JSON.stringify({root:desc(root,2),charCount:chars.length,chars:charInfo,
    splitFlag:root.dataset.mtSplit||null},null,1);
})()`)
console.log(out)
ws.close()
