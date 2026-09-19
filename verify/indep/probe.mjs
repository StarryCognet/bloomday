/**
 * 独立复核者自备：小探针集合（避免命令行引号地狱）。
 * 用法：node verify/indep/probe.mjs <name> [--click=1] [--scrollY=n] [--wait=n] [--media=...] [--url=...]
 *   names: audio | gallery | summary | geometry | broken | overflows
 */
import { writeFileSync } from 'node:fs'

const PORT = process.env.CDP_PORT ?? '9222'
const argv = process.argv.slice(2)
const name = argv[0]
const opt = {}
for (const a of argv.slice(1)) {
  if (!a.startsWith('--')) continue
  const [k, v] = a.replace(/^--/, '').split('=')
  opt[k] = v ?? 'true'
}
const W = Number(opt.w ?? 390), H = Number(opt.h ?? 844), DSF = Number(opt.dsf ?? 1)
const url = opt.url ?? `http://127.0.0.1:4173/index.html?rev=${Date.now()}`

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
await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: DSF, mobile: true, screenWidth: W, screenHeight: H })
await send('Page.navigate', { url })
const t0 = Date.now()
while (Date.now() - t0 < 20000) {
  const st = await send('Runtime.evaluate', { expression: 'document.readyState', returnByValue: true }).then((r) => r.result?.value).catch(() => null)
  if (st === 'complete' || st === 'interactive') break
  await sleep(50)
}
const ev = async (expr, awaitPromise = false) => {
  const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise })
  if (r.exceptionDetails) return { THREW: r.exceptionDetails.exception?.description ?? r.exceptionDetails.text }
  return r.result?.value
}
const clickSeal = async () => {
  const p = await ev(`(function(){var e=document.querySelector('.seal__cta');if(!e)return null;var b=e.getBoundingClientRect();return {x:Math.round(b.x+b.width/2),y:Math.round(b.y+b.height/2)}})()`)
  if (!p || p.THREW) return 'NO_CTA'
  const c = { x: p.x, y: p.y, button: 'left', clickCount: 1 }
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', ...c })
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', ...c })
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', ...c })
  return p
}
if (opt.click) { await clickSeal(); await sleep(2200) }
if (opt.scrollY) { await ev(`window.scrollTo(0,${Number(opt.scrollY)})`); await sleep(Number(opt.wait ?? 1200)) }
else if (opt.wait) await sleep(Number(opt.wait))

const PROBES = {
  audio: `(function(){var a=document.getElementById('bgm');return JSON.stringify({srcAttr:a.getAttribute('src'),currentSrc:a.currentSrc,readyState:a.readyState,duration:Math.round(a.duration*100)/100,networkState:a.networkState,error:a.error?a.error.code:null,paused:a.paused})})()`,
  gallery: `(function(){var r=window.__gallery;var imgs=[].slice.call(document.querySelectorAll('.gcard__img')).map(function(i){return {src:i.getAttribute('src'),complete:i.complete,nw:i.naturalWidth,vis:getComputedStyle(i).opacity}});return JSON.stringify({report:r?{items:r.items,loaded:r.loaded,fallback:r.fallback,brokenVisible:r.brokenVisible,cls:r.cls,frameH:r.frameHeightBefore+'->'+r.frameHeightAfter,textOverlaps:r.textOverlaps,zMono:r.zMonotonic,swipes:r.swipes}:null,imgs:imgs,cards:document.querySelectorAll('.gcard').length,fallbackFrames:document.querySelectorAll('.gcard__frame.is-fallback').length,loadedFrames:document.querySelectorAll('.gcard__frame.is-loaded').length})})()`,
  summary: `(function(){return window.__siteSummary?window.__siteSummary():'NO_HOOK'})()`,
  siteReport: `JSON.stringify(window.__siteReport?window.__siteReport():'NO_HOOK')`,
  geometry: `(function(){var ids=['act-mv','act-blessing','act-gallery','act-finale'];var o={maxScroll:document.documentElement.scrollHeight-innerHeight,scrollY:window.scrollY};o.acts=ids.map(function(id){var e=document.getElementById(id);var r=e.getBoundingClientRect();return {id:id,top:Math.round(r.top+scrollY),h:e.offsetHeight}});return JSON.stringify(o)})()`,
  broken: `(function(){var bad=[].slice.call(document.images).filter(function(i){return i.complete&&i.naturalWidth===0}).map(function(i){return i.getAttribute('src')+'|cls='+i.className+'|disp='+getComputedStyle(i).display+'|op='+getComputedStyle(i).opacity+'|w='+i.getBoundingClientRect().width});
    var fbs=[].slice.call(document.querySelectorAll('.gcard__frame')).map(function(f){var cs=getComputedStyle(f);return {fb:f.classList.contains('is-fallback'),ld:f.classList.contains('is-loaded'),h:Math.round(f.getBoundingClientRect().height),w:Math.round(f.getBoundingClientRect().width),name:(f.querySelector('.gcard__fb-name')||{}).textContent||''}});
    return JSON.stringify({broken:bad, frames:fbs})})()`,
  /* 判据有效性对照：把一个"整屏不透明层"塞进去，
     同时问作者钩子与像素法，看谁抓得到。 */
  negjourney: `(async function(){
    var d=document.createElement('div');
    d.id='neg-cover';
    d.style.cssText='position:fixed;inset:0;width:100vw;height:100vh;background:rgb(20,64,184);opacity:1;z-index:9999';
    document.body.appendChild(d);
    await new Promise(function(r){setTimeout(r,600)});
    var j=null,err=null;
    try{ j=await window.__journey() }catch(e){ err=String(e) }
    var r=d.getBoundingClientRect();
    var cs=getComputedStyle(d);
    return JSON.stringify({
      injected:{w:Math.round(r.width),h:Math.round(r.height),bg:cs.backgroundColor,op:cs.opacity,pos:cs.position},
      authorJourney: j?{maxCover:j.maxCover,maxCoverAtMs:j.maxCoverAtMs,maxCoverEl:j.maxCoverEl,emptyAt:j.emptyAt,scanned:j.scanned,summary:j.summary}:null,
      authorError: err
    })})()`,
  /* 对照组：同样塞一个整屏层，但这次是"点击之后"塞的（采样窗口已开） */
  negjourneyAfterClick: `(async function(){
    var cta=document.querySelector('.seal__cta');
    var b=cta.getBoundingClientRect();
    cta.dispatchEvent(new MouseEvent('click',{bubbles:true,clientX:b.x+b.width/2,clientY:b.y+b.height/2}));
    await new Promise(function(r){setTimeout(r,60)});
    var d=document.createElement('div');
    d.id='neg-cover';
    d.style.cssText='position:fixed;inset:0;width:100vw;height:100vh;background:rgb(20,64,184);opacity:1;z-index:9999';
    document.body.appendChild(d);
    await new Promise(function(r){setTimeout(r,700)});
    var j=await window.__journey();
    return JSON.stringify({authorJourney:{maxCover:j.maxCover,maxCoverAtMs:j.maxCoverAtMs,maxCoverEl:j.maxCoverEl,summary:j.summary}})})()`,
}

const out = await ev(PROBES[name] ?? 'null', true)
console.log(`[probe:${name}] url=${url}`)
console.log(JSON.stringify(out, null, 1))
ws.close()
