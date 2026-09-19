/**
 * 独立复核者自备：转场/滚动/残留 的独立取证工具。
 * 不复用作者 __journey / __gallery / __siteSummary 的任何判据。
 *
 * 用法：node verify/indep/drive.mjs <case> [outdir]
 *   case = break       点击封印后高密度连拍 + 页面内每帧几何遥测
 *   case = breaklate   同上，但点击发生在入场动画跑完之后（作者报告的口径）
 *   case = breakearly  加载后立刻点（入场还在跑，看叠加态）
 *   case = geom        各幕 offsetTop/offsetHeight + 每 40px 的独立文字计数扫描
 *   case = residual    滚到底再回滚，数残留
 *   case = zoom <y>    在指定 y 细拍（配合 geom 标出的可疑位置）
 */
import { writeFileSync, mkdirSync } from 'node:fs'
import { decodePng, frameStats } from './png.mjs'

const PORT = process.env.CDP_PORT ?? '9222'
const caseName = process.argv[2] ?? 'break'
const OUT = process.argv[3] ?? `verify/shots/indep`
mkdirSync(OUT, { recursive: true })

const W = 390, H = 844, DSF = 1

/* ── CDP 最小客户端 ───────────────────────────────────────── */
const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()
let page = list.find((t) => t.type === 'page' && t.url.startsWith('http://127.0.0.1:4173'))
let created = false
if (!page) {
  const r = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' })).json()
  page = r
  created = true
}
const ws = new WebSocket(page.webSocketDebuggerUrl)
let seq = 0
const pending = new Map()
const events = []
const send = (method, params = {}) =>
  new Promise((resolve, reject) => {
    const id = ++seq
    pending.set(id, { resolve, reject })
    ws.send(JSON.stringify({ id, method, params }))
  })
ws.addEventListener('message', (ev) => {
  const m = JSON.parse(ev.data)
  if (m.id && pending.has(m.id)) {
    const { resolve, reject } = pending.get(m.id)
    pending.delete(m.id)
    if (m.error) reject(new Error(m.error.message)); else resolve(m.result)
  } else if (m.method) events.push(m.method)
})
await new Promise((res, rej) => {
  ws.addEventListener('open', res, { once: true })
  ws.addEventListener('error', () => rej(new Error('ws fail')), { once: true })
})
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

await send('Page.enable')
await send('Runtime.enable')
await send('Emulation.setDeviceMetricsOverride', {
  width: W, height: H, deviceScaleFactor: DSF, mobile: true, screenWidth: W, screenHeight: H,
})
await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 })

const evaluate = async (expression, awaitPromise = false) => {
  const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise })
  if (r.exceptionDetails) {
    throw new Error('页面求值抛错: ' + (r.exceptionDetails.exception?.description ?? r.exceptionDetails.text))
  }
  return r.result?.value
}

/* ── 独立文字计数：用 DOM Range 的 rect 判定"确实有字画在那儿" ──
   与作者的实现无关（作者是遍历固定标签名 + 看 opacity/rect）。 */
const TEXT_COUNT_FN = `
function __myTextNodes(){
  const out=[];
  const walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT,null);
  let n;
  while((n=walker.nextNode())){
    const t=(n.textContent||'').replace(/\\s+/g,' ').trim();
    if(!t) continue;
    const el=n.parentElement; if(!el) continue;
    let vis=true, p=el;
    while(p&&p!==document.documentElement){
      const cs=getComputedStyle(p);
      if(cs.display==='none'||cs.visibility==='hidden'||Number(cs.opacity)<0.15){vis=false;break}
      p=p.parentElement;
    }
    if(!vis) continue;
    let rects=[];
    try{ const rg=document.createRange(); rg.selectNodeContents(n); rects=Array.from(rg.getClientRects()) }catch(e){ continue }
    let hit=0;
    for(const r of rects){
      if(r.width<1||r.height<1) continue;
      if(r.bottom>2 && r.top<innerHeight-2 && r.right>2 && r.left<innerWidth-2) hit++;
    }
    if(hit>0) out.push(t.slice(0,18));
  }
  return out;
}`

/* ── 每帧几何遥测（页面内 rAF 高频采样，CDP 只负责起停）──
   记录：所有 .mt-band 的视口覆盖比例与"是不是真在视口里"、封印不透明度、
   作者背景层的不透明度、以及视口内文字条数。 */
const TELEMETRY_FN = `
${TEXT_COUNT_FN}
window.__T = (function(){
  const t0mark = {t:0};
  const rec=[];
  const seen={};
  function cover(el){
    const r=el.getBoundingClientRect();
    const vw=innerWidth, vh=innerHeight;
    const w=Math.max(0,Math.min(r.right,vw)-Math.max(r.left,0));
    const h=Math.max(0,Math.min(r.bottom,vh)-Math.max(r.top,0));
    return {frac:(w*h)/(vw*vh), x:Math.round(r.left), y:Math.round(r.top), w:Math.round(r.width), h:Math.round(r.height), op:Number(getComputedStyle(el).opacity)};
  }
  return {
    start(){ this.t0=performance.now(); this.on=true; this.rec=[]; if(!this.loop)this.loop=this.tick.bind(this); requestAnimationFrame(this.loop) },
    tick(){
      if(this.on){
        const e={t:+(performance.now()-this.t0).toFixed(1)};
        const seal=document.getElementById('seal');
        if(seal){ const cs=getComputedStyle(seal); e.sealOpacity=Number(cs.opacity); e.sealDisplay=cs.display; e.sealCover=cover(seal).frac }
        const bands=Array.from(document.querySelectorAll('.mt-band')).filter(b=>getComputedStyle(b).display!=='none');
        e.bands=bands.map(b=>({el:(b.parentElement&&b.parentElement.className)||'?',...cover(b)}));
        const inner=document.getElementById('seal-inner');
        e.innerOpacity=inner?Number(getComputedStyle(inner).opacity):null;
        e.text=__myTextNodes().length;
        e.scrollY=window.scrollY;
        this.rec.push(e);
      }
      requestAnimationFrame(this.loop);
    },
    stop(){ this.on=false; return this.rec }
  }
})();
`

/* ── 命中测试型遮盖检测（独立判据）──
   用 elementFromPoint 让浏览器自己回答"这个像素上画的是谁"，
   再看它的不透明底色 —— 这是作者那套"查 position/opacity/className 白名单"
   的独立替代品：不依赖元素类型，也不需要"第一帧就在 = 背景层"这种豁免。 */
const HITTEST_FN = `
window.__H = (function(){
  const GP=20, GQ=40;                       // 20x40 = 800 个采样点
  function opaqueBg(cs){
    const bg=cs.backgroundColor||'';
    const m=bg.match(/rgba?\\(([^)]+)\\)/);
    if(!m) return false;
    const p=m[1].split(',').map(Number);
    const a=p.length>3?p[3]:1;
    return a>=0.85;
  }
  function effOpacity(el){
    let o=1,n=el;
    while(n&&n.nodeType===1){ o*=Number(getComputedStyle(n).opacity); if(o<0.05)return o; n=n.parentElement }
    return o;
  }
  function probe(x,y){
    const el=document.elementFromPoint(x,y);
    if(!el) return {tag:'NONE'};
    let n=el, cover=null;
    while(n&&n.nodeType===1){
      const cs=getComputedStyle(n);
      if(cs.display==='none'||cs.visibility==='hidden') break;
      if(opaqueBg(cs)){
        const r=n.getBoundingClientRect();
        if(r.left<=x&&r.right>=x&&r.top<=y&&r.bottom>=y){ cover={name:(n.className&&typeof n.className==='string')?n.className:n.tagName, w:Math.round(r.width), h:Math.round(r.height), bg:cs.backgroundColor, op:+Number(cs.opacity).toFixed(2)}; break }
      }
      n=n.parentElement;
    }
    return {top:(el.className&&typeof el.className==='string')?el.className:el.tagName, cover, effOp:+effOpacity(el).toFixed(2)};
  }
  function walkTree(){
    const res=[];
    document.querySelectorAll('.mt-band').forEach(b=>{
      const cs=getComputedStyle(b);
      const r=b.getBoundingClientRect();
      const vw=innerWidth,vh=innerHeight;
      const w=Math.max(0,Math.min(r.right,vw)-Math.max(r.left,0));
      const h=Math.max(0,Math.min(r.bottom,vh)-Math.max(r.top,0));
      res.push({el:'.mt-band', parent:(b.parentElement&&typeof b.parentElement.className==='string')?b.parentElement.className:'?',
        display:cs.display, opacity:+Number(cs.opacity).toFixed(2), x:Math.round(r.left), y:Math.round(r.top), w:Math.round(r.width), h:Math.round(r.height),
        vpFrac:+((w*h)/(vw*vh)).toFixed(4), cssColor:cs.backgroundColor});
    });
    return res;
  }
  return {
    start(){ this.on=true; this.rec=[]; this.snap=[]; this.t0=performance.now(); this.loop=this.tick.bind(this); requestAnimationFrame(this.loop) },
    tick(){
      if(!this.on) return;
      const t=performance.now()-this.t0;
      let covered=0, coverNames={};
      for(let i=1;i<GP;i++)for(let j=1;j<GQ;j++){
        const x=Math.round(innerWidth*i/GP), y=Math.round(innerHeight*j/GQ);
        const r=probe(x,y);
        if(r.cover){covered++; const k=r.cover.name+'|'+r.cover.bg; coverNames[k]=(coverNames[k]||0)+1}
      }
      const total=(GP-1)*(GQ-1);
      const e={t:+t.toFixed(1), coveredPct:+(covered/total*100).toFixed(2), coverNames, text:__myTextNodes().length, bands:walkTree()};
      this.rec.push(e);
      const marks=[150,300,450,600,750,900,1100,1400,1800];
      for(const m of marks){
        if(t>=m&&!this['s'+m]){
          this['s'+m]=1;
          const mid=probe(Math.round(innerWidth/2),Math.round(innerHeight/2));
          const ids=['#mv-date','#mv-age','#mv-title','#seal-date','.seal__greeting','.mv__eyebrow','.seal__cta'];
          const rects={};
          ids.forEach(s=>{const el=document.querySelector(s); if(!el)return; const r=el.getBoundingClientRect();
            rects[s]={x:Math.round(r.left),y:Math.round(r.top),w:Math.round(r.width),h:Math.round(r.height),op:+Number(getComputedStyle(el).opacity).toFixed(2)}});
          this.snap.push({t:+t.toFixed(1), centerTop:mid.top, centerCover:mid.cover, centerEffOp:mid.effOp,
            sealOpacity:Number(getComputedStyle(document.getElementById('seal')).opacity).toFixed(2),
            sealDisplay:getComputedStyle(document.getElementById('seal')).display, rects, bands:walkTree()});
        }
      }
      requestAnimationFrame(this.loop);
    },
    stop(){ this.on=false; return {rec:this.rec, snap:this.snap} }
  }
})();
`

/* ── 同时出现在视口里的文字分属哪些幕（跨幕叠加的最直接观测量）── */
const TEXT_INV_FN = `
function __myTextInv(){
  const out=[];
  const walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT,null);
  let n;
  while((n=walker.nextNode())){
    const t=(n.textContent||'').replace(/\\s+/g,' ').trim();
    if(!t) continue;
    const el=n.parentElement; if(!el) continue;
    let vis=true,p=el;
    while(p&&p!==document.documentElement){const cs=getComputedStyle(p);
      if(cs.display==='none'||cs.visibility==='hidden'||Number(cs.opacity)<0.15){vis=false;break} p=p.parentElement}
    if(!vis) continue;
    let rg,rects=[];
    try{rg=document.createRange();rg.selectNodeContents(n);rects=Array.from(rg.getClientRects())}catch(e){continue}
    if(!rects.some(r=>r.width>=1&&r.height>=1&&r.bottom>2&&r.top<innerHeight-2)) continue;
    out.push({t:t.slice(0,14), own:(el.className&&typeof el.className==='string')?el.className:el.tagName,
      act:(el.closest('.act')||{}).id||'seal', op:+Number(getComputedStyle(el).opacity).toFixed(2)});
  }
  return out;
}
`

const NAV_URL = `http://127.0.0.1:4173/index.html?rev=${Date.now()}`
await send('Page.navigate', { url: NAV_URL })
// 等 DOM ready（不等 load：4.7MB 音频会拖很久）
{
  const t0 = Date.now()
  while (Date.now() - t0 < 15000) {
    const st = await evaluate('document.readyState').catch(() => null)
    if (st === 'interactive' || st === 'complete') break
    await sleep(50)
  }
}
// 等封印 CTA 存在
{
  const t0 = Date.now()
  while (Date.now() - t0 < 8000) {
    const ok = await evaluate(`!!document.querySelector('.seal__cta')`).catch(() => false)
    if (ok) break
    await sleep(50)
  }
}

const report = { case: caseName, url: NAV_URL, viewport: `${W}x${H}@${DSF}`, frames: [], notes: [] }

const captureTo = async (file) => {
  const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false })
  const buf = Buffer.from(shot.data, 'base64')
  writeFileSync(file, buf)
  return buf
}

const clickSeal = async () => {
  const p = await evaluate(`(function(){const e=document.querySelector('.seal__cta');if(!e)return null;const b=e.getBoundingClientRect();return {x:Math.round(b.x+b.width/2),y:Math.round(b.y+b.height/2)}})()`)
  if (!p) throw new Error('找不到 .seal__cta')
  const common = { x: p.x, y: p.y, button: 'left', clickCount: 1 }
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', ...common })
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', ...common })
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', ...common })
  return p
}

/* ══ case: 连拍 ══════════════════════════════════════════ */
if (caseName === 'break' || caseName === 'breaklate' || caseName === 'breakearly') {
  await evaluate(TELEMETRY_FN)
  if (caseName === 'breaklate') await sleep(2000)
  if (caseName === 'breakearly') await sleep(0)
  // 起点基准帧
  const pre = await captureTo(`${OUT}/${caseName}-pre.png`)
  report.frames.push({ label: 'pre', ...frameStats(decodePng(pre)) })
  await evaluate('window.__T.start()')
  const clickPt = await clickSeal()
  report.clickPt = clickPt
  const targets = [0, 60, 120, 180, 240, 320, 420, 550, 700, 900, 1200]
  const t0 = Date.now()
  for (const off of targets) {
    const wait = t0 + off - Date.now()
    if (wait > 0) await sleep(wait)
    const real = Date.now() - t0
    const buf = await captureTo(`${OUT}/${caseName}-t${off}.png`)
    const st = frameStats(decodePng(buf))
    report.frames.push({ label: `t${off}`, realMs: real, ...st })
  }
  const rec = await evaluate('window.__T.stop()')
  writeFileSync(`${OUT}/${caseName}-telemetry.json`, JSON.stringify(rec, null, 1))
  // 遥测摘要：最大色带覆盖 / 色带出现的最大覆盖时刻
  let maxBand = 0, maxBandT = -1, maxBandEl = ''
  let maxSealCover = 0, maxSealT = -1
  let minText = Infinity, minTextT = -1
  for (const e of rec) {
    for (const b of e.bands ?? []) {
      if (b.frac > maxBand) { maxBand = b.frac; maxBandT = e.t; maxBandEl = b.el }
    }
    if ((e.sealCover ?? 0) > maxSealCover) { maxSealCover = e.sealCover; maxSealT = e.t }
    if ((e.text ?? 0) < minText) { minText = e.text; minTextT = e.t }
  }
  report.telemetry = {
    frames: rec.length,
    maxBandCover: +maxBand.toFixed(4), maxBandAtMs: maxBandT, maxBandEl,
    maxSealCover: +maxSealCover.toFixed(4), maxSealAtMs: maxSealT,
    minTextInViewport: minText === Infinity ? null : minText, minTextAtMs: minTextT,
    zeroTextFrames: rec.filter((e) => (e.text ?? 0) === 0).map((e) => e.t),
  }
  // 色带覆盖随时间（隔几帧打一条，看形状）
  report.bandTimeline = rec
    .filter((_, i) => i % 6 === 0)
    .map((e) => ({ t: e.t, band: +Math.max(0, ...(e.bands ?? []).map((b) => b.frac)).toFixed(3), sealOp: e.sealOpacity, text: e.text }))
  report.summary =
    `连拍 ${report.frames.length} 帧（真实偏移 ${report.frames.map((f) => f.realMs).filter((x) => x !== undefined).join('/')}ms）` +
    ` · 最高频色占比最大=${Math.max(...report.frames.map((f) => f.topShare)).toFixed(3)}` +
    ` · 页面内 ${rec.length} 帧遥测：色带最大视口覆盖=${(maxBand * 100).toFixed(1)}%@${maxBandT}ms(${maxBandEl})` +
    ` 封印最大覆盖=${(maxSealCover * 100).toFixed(1)}%@${maxSealT}ms` +
    ` 视口文字最少=${minText}@${minTextT}ms`
}

/* ══ case: 逐帧命中测试（无 CDP 截图开销，页面自身满帧采样）════ */
if (caseName === 'breakprobe') {
  await evaluate(`${TEXT_COUNT_FN}\n${HITTEST_FN}`)
  await sleep(2000) // 与 breaklate 同口径：等入场动画跑完再点
  await captureTo(`${OUT}/breakprobe-pre.png`)
  await evaluate('window.__H.start()')
  await clickSeal()
  await sleep(2600)
  const r = await evaluate('window.__H.stop()')
  writeFileSync(`${OUT}/breakprobe-raw.json`, JSON.stringify(r, null, 1))
  const rec = r.rec
  let worst = { pct: 0, t: -1, names: null }
  let maxBand = { frac: 0, t: -1, el: '', y: 0, h: 0 }
  let minText = Infinity, minTextT = -1
  for (const e of rec) {
    if (e.coveredPct > worst.pct) worst = { pct: e.coveredPct, t: e.t, names: e.coverNames }
    for (const b of e.bands) if (b.vpFrac > maxBand.frac) maxBand = { frac: b.vpFrac, t: e.t, el: b.parent, y: b.y, h: b.h }
    if (e.text < minText) { minText = e.text; minTextT = e.t }
  }
  report.hittest = {
    framesSampled: rec.length,
    gridPoints: 19 * 39,
    maxCoveredPct: worst.pct, maxCoveredAtMs: worst.t, maxCoveredBy: worst.names,
    maxBandVpFrac: maxBand.frac, maxBandAtMs: maxBand.t, maxBandParent: maxBand.el, maxBandY: maxBand.y, maxBandH: maxBand.h,
    minText, minTextAtMs: minTextT,
    zeroTextFrames: rec.filter((e) => e.text === 0).map((e) => e.t),
  }
  report.snapshots = r.snap
  report.summary =
    `${rec.length} 帧逐帧命中测试（19x39=741 采样点/帧）: 不透明遮盖最高 ${worst.pct}%@${worst.t}ms` +
    ` · 色带最大视口占比 ${(maxBand.frac * 100).toFixed(1)}%@${maxBand.t}ms(${maxBand.el} y=${maxBand.y} h=${maxBand.h})` +
    ` · 视口文字最少 ${minText}@${minTextT}ms · 零文字帧 ${report.hittest.zeroTextFrames.length}`
}

/* ══ case: 跨幕叠加（封印与主视觉文字同时可读的时长）════════ */
if (caseName === 'crossfade') {
  await evaluate(`${TEXT_COUNT_FN}\n${TEXT_INV_FN}
window.__X={rec:[],on:true,t0:0};
window.__X.start=function(){ this.on=true; this.rec=[]; this.t0=performance.now(); const self=this;
  (function loop(){ if(!self.on) return
    const inv=__myTextInv();
    const seal=inv.filter(x=>x.act==='seal'), mv=inv.filter(x=>x.act==='act-mv');
    self.rec.push({t:+(performance.now()-self.t0).toFixed(1), sealN:seal.length, mvN:mv.length,
      sampleSeal:seal.slice(0,2).map(s=>s.t), sampleMv:mv.slice(0,2).map(s=>s.t)});
    requestAnimationFrame(loop) })() }`)
  await sleep(2000)
  await evaluate('window.__X.start()')
  await clickSeal()
  await sleep(2600)
  const x = await evaluate('window.__X.on=false; window.__X.rec')
  const overlap = x.filter((e) => e.sealN > 0 && e.mvN > 0)
  let runStart = null, runs = [], prev = null
  for (const e of x) {
    const on = e.sealN > 0 && e.mvN > 0
    if (on && runStart === null) runStart = e.t
    if (!on && runStart !== null) { runs.push([runStart, prev]); runStart = null }
    prev = e.t
  }
  if (runStart !== null) runs.push([runStart, prev])
  report.crossfade = {
    frames: x.length,
    overlapFrames: overlap.length,
    overlapRunsMs: runs.map(([a, b]) => [a, b, +(b - a).toFixed(0)]),
    peakSimultaneous: overlap.reduce((m, e) => Math.max(m, e.sealN + e.mvN), 0),
    first: overlap[0] ?? null,
    last: overlap[overlap.length - 1] ?? null,
    timeline: x.filter((_, i) => i % 4 === 0).map((e) => `${e.t}:seal${e.sealN}/mv${e.mvN}`),
  }
  report.summary =
    `跨幕文字叠加：${overlap.length} 帧同时有封印文字与主视觉文字` +
    `，连续区段=${runs.map(([a, b]) => `${a}→${b}ms(${(b - a).toFixed(0)}ms)`).join(' , ') || '无'}` +
    ` · 峰值同屏文字条数=${report.crossfade.peakSimultaneous}`
}

/* ══ case: 干净单帧（每张都独立重载，无逐帧探针开销）════════ */
if (caseName === 'single') {
  const offs = [0, 150, 300, 450, 600, 750, 900, 1100, 1400]
  for (const o of offs) {
    await send('Page.navigate', { url: NAV_URL + '&s=' + o })
    const tn = Date.now()
    while (Date.now() - tn < 15000) {
      const st = await evaluate('document.readyState').catch(() => null)
      if (st === 'complete' || st === 'interactive') break
      await sleep(40)
    }
    const has = await evaluate(`!!document.querySelector('.seal__cta')`).catch(() => false)
    if (!has) { report.notes.push('CTA 未出现，跳过 t=' + o); continue }
    await sleep(2000)
    const c0 = Date.now()
    await clickSeal()
    await sleep(Math.max(0, o - (Date.now() - c0)))
    const real = Date.now() - c0
    const buf = await captureTo(`${OUT}/single-t${o}.png`)
    report.frames.push({ label: `t${o}`, realMs: real, ...frameStats(decodePng(buf)) })
  }
  report.summary = `干净单帧 ${report.frames.length} 张（每张都独立重载后定时拍）：` +
    report.frames.map((f) => `t${f.label.slice(1)}=dominant${f.topShare}/busy${f.busyTiles}`).join(' ')
}

/* ══ case: 几何 + 精细文字扫描 ══════════════════════════ */
if (caseName === 'geom' || caseName === 'zoom') {
  // 先点封印解锁，等转场结束
  await clickSeal()
  await sleep(2200)
  await evaluate(TEXT_COUNT_FN)
  const geo = await evaluate(`(function(){
    const ids=['act-mv','act-blessing','act-gallery','act-finale'];
    const out={docHeight:document.documentElement.scrollHeight, maxScroll:document.documentElement.scrollHeight-innerHeight, vh:innerHeight};
    out.acts=ids.map(id=>{const e=document.getElementById(id);if(!e)return {id,missing:true};
      const r=e.getBoundingClientRect();
      return {id, offsetTop:e.offsetTop, offsetHeight:e.offsetHeight, top:Math.round(r.top+scrollY), bottom:Math.round(r.bottom+scrollY)}});
    // 找首尾相接处有没有缝
    out.gaps=[];
    for(let i=0;i<out.acts.length-1;i++){
      const a=out.acts[i],b=out.acts[i+1];
      if(a.missing||b.missing)continue;
      out.gaps.push({between:a.id+'→'+b.id, gap:b.top-a.bottom});
    }
    return out})()`)
  report.geometry = geo

  const step = caseName === 'zoom' ? 20 : 40
  const rows = []
  for (let y = 0; y <= geo.maxScroll; y += step) {
    await evaluate(`window.scrollTo(0,${y})`)
    // 等动画落定：这一位置上的进场动效跑完
    await sleep(340)
    const names = await evaluate(`__myTextNodes()`)
    rows.push({ y, n: names.length, sample: names.slice(0, 4) })
  }
  await evaluate('window.scrollTo(0,0)')
  report.scan = {
    step,
    scanned: rows.length,
    zeroAt: rows.filter((r) => r.n === 0).map((r) => r.y),
    lowAt: rows.filter((r) => r.n > 0 && r.n <= 1).map((r) => ({ y: r.y, n: r.n, sample: r.sample })),
    min: Math.min(...rows.map((r) => r.n)),
    all: rows,
  }
  // 对零文字位置逐张取证
  const zs = report.scan.zeroAt
  for (const z of zs.slice(0, 6)) {
    await evaluate(`window.scrollTo(0,${z})`)
    await sleep(340)
    await captureTo(`${OUT}/zero-y${z}.png`)
  }
  report.summary =
    `幕几何：` + (geo.acts ?? []).map((a) => `${a.id} top=${a.offsetTop} h=${a.offsetHeight}`).join(' / ') +
    ` · 文档高=${geo.docHeight} 最大滚动=${geo.maxScroll}` +
    ` · 缝=[${(geo.gaps ?? []).map((g) => `${g.between}:${g.gap}`).join(',')}]` +
    ` · 独立文字扫描 ${rows.length} 个位置(步长${step}) 零文字=${zs.length}${zs.length ? '：' + zs.join(',') : ''}` +
    ` 最少=${report.scan.min}`
}

/* ══ case: 残留 ═════════════════════════════════════════ */
if (caseName === 'residual') {
  await clickSeal()
  await sleep(2200)
  const max = await evaluate('document.documentElement.scrollHeight-innerHeight')
  for (let y = 0; y <= max; y += 400) {
    await evaluate(`window.scrollTo(0,${y})`)
    await sleep(260)
  }
  await evaluate(`window.scrollTo(0,${max})`)
  await sleep(1200)
  await captureTo(`${OUT}/residual-bottom.png`)
  await evaluate('window.scrollTo(0,0)')
  await sleep(1600)
  await captureTo(`${OUT}/residual-backtop.png`)
  const resid = await evaluate(`(function(){
    const bands=Array.from(document.querySelectorAll('.mt-band'));
    const visBands=bands.filter(b=>{const cs=getComputedStyle(b);return cs.display!=='none'&&Number(cs.opacity)>0.02});
    const rings=Array.from(document.querySelectorAll('.mt-ring')).filter(r=>Number(getComputedStyle(r).opacity)>0.02);
    const spills=Array.from(document.querySelectorAll('.mt-spill,.mt-shard,.mt-slash,.mt-ghost')).filter(r=>{const cs=getComputedStyle(r);return cs.display!=='none'&&Number(cs.opacity)>0.02});
    return {totalBands:bands.length, visibleBands:visBands.length, bandDetail:visBands.map(b=>{const c=b.getBoundingClientRect();return {parent:b.parentElement.className, x:Math.round(c.x),y:Math.round(c.y),w:Math.round(c.width),h:Math.round(c.height),op:getComputedStyle(b).opacity}}),
      visibleRings:rings.length, visibleSpills:spills.length,
      sealDisplay:getComputedStyle(document.getElementById('seal')).display,
      docOverflow:document.documentElement.scrollWidth+'/'+document.documentElement.clientWidth}})()`)
  report.residual = resid
  report.summary = `滚到底再回滚后：可见色带=${resid.visibleBands}/${resid.totalBands} 存活环=${resid.visibleRings} 其它残留=${resid.visibleSpills} 封印 display=${resid.sealDisplay} 横向溢出=${resid.docOverflow}`
}

writeFileSync(`${OUT}/${caseName}-report.json`, JSON.stringify(report, null, 1))
console.log(JSON.stringify({ case: caseName, summary: report.summary, telemetry: report.telemetry, frames: report.frames, scan: report.scan ? { zeroAt: report.scan.zeroAt, lowAt: report.scan.lowAt, min: report.scan.min, scanned: report.scan.scanned } : undefined, geometry: report.geometry, residual: report.residual, notes: report.notes }, null, 1))
if (created) await fetch(`http://127.0.0.1:${PORT}/json/close/${page.id}`).catch(() => {})
ws.close()
