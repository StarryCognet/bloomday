/**
 * 第三轮独立复核 · 连拍记录器（自带，不复用作者/上一轮脚本）
 *
 * 每帧同时抓两样东西：
 *   1) Page.captureScreenshot 的真实像素（存盘 + 统计）
 *   2) 同帧的 DOM 读数：每个文字元素的视口矩形、自身及祖先 opacity 累乘、
 *      命中测试栈（document.elementsFromPoint）、封印 display/opacity
 *
 * 判据读的是**像素**（文字是否真画出来了），DOM 读数只用于归因定位。
 *
 * 用法：
 *   node verify/r3/rec.mjs <prefix> [--offs=0,60,...] [--media=a:b] [--cpu=n]
 *                          [--nw=1]（不等待，加载完立刻点）
 *                          [--scrollEnd=1]（滚到底再回滚的残留检查）
 *                          [--quiet=1]
 */
import { writeFileSync, mkdirSync } from 'node:fs'
import { decode, stats } from './png.mjs'

const PORT = process.env.CDP_PORT ?? '9222'
const argv = process.argv.slice(2)
const prefix = argv[0]
const OUT = 'verify/shots/r3'
mkdirSync(OUT, { recursive: true })
const opt = {}
for (const a of argv.slice(1)) {
  if (!a.startsWith('--')) continue
  const [k, v] = a.replace(/^--/, '').split('=')
  opt[k] = v ?? 'true'
}
const W = Number(opt.w ?? 390)
const H = Number(opt.h ?? 844)
const offs = (opt.offs ?? '0,60,120,180,240,300,380,460,560,680,800,950,1150,1400,1800').split(',').map(Number)

const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()
const page = list.find((t) => t.type === 'page')
if (!page) throw new Error('no page target')
const ws = new WebSocket(page.webSocketDebuggerUrl)
let seq = 0
const pending = new Map()
const errors = []
const send = (m, p = {}) =>
  new Promise((res, rej) => { const id = ++seq; pending.set(id, { res, rej }); ws.send(JSON.stringify({ id, method: m, params: p })) })
ws.addEventListener('message', (ev) => {
  const m = JSON.parse(ev.data)
  if (m.id && pending.has(m.id)) {
    const { res, rej } = pending.get(m.id); pending.delete(m.id)
    m.error ? rej(new Error(m.error.message)) : res(m.result)
  } else if (m.method === 'Runtime.exceptionThrown') {
    errors.push(m.params?.exceptionDetails?.text ?? 'exc')
  }
})
await new Promise((res, rej) => { ws.addEventListener('open', res, { once: true }); ws.addEventListener('error', () => rej(new Error('ws')), { once: true }) })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const ev = async (expr) => {
  const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })
  if (r.exceptionDetails) throw new Error('eval: ' + (r.exceptionDetails.exception?.description ?? r.exceptionDetails.text))
  return r.result?.value
}

await send('Page.enable'); await send('Runtime.enable')
await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: true, screenWidth: W, screenHeight: H })
if (opt.media) {
  const [n, v] = opt.media.split(':')
  await send('Emulation.setEmulatedMedia', { features: [{ name: n, value: v }] })
}
if (opt.cpu) await send('Emulation.setCPUThrottlingRate', { rate: Number(opt.cpu) })
await send('Page.navigate', { url: `http://127.0.0.1:4173/index.html?r3=${Date.now()}` })
{
  const t0 = Date.now()
  while (Date.now() - t0 < 20000) {
    const st = await ev('document.readyState').catch(() => null)
    if (st === 'complete' || st === 'interactive') break
    await sleep(50)
  }
}
if (!opt.nw) await sleep(2200)

/* 每帧的 DOM 读数：文字元素 + 祖先 opacity 累乘 + 命中测试 */
const DOMREAD = `(function(){
  function eff(el){var op=1,c=el;while(c&&c!==document.documentElement){var s=getComputedStyle(c);if(s.display==='none'||s.visibility==='hidden')return 0;op*=Number(s.opacity);if(op<=0.02)return 0;c=c.parentElement}return op}
  var out=[];
  document.querySelectorAll('h1,h2,p,span,b,em,button,div').forEach(function(el){
    var direct=false;
    for(var i=0;i<el.childNodes.length;i++){var n=el.childNodes[i];if(n.nodeType===3&&n.textContent.trim().length>0){direct=true;break}}
    if(!direct)return;
    var r=el.getBoundingClientRect();
    if(!(r.bottom>4&&r.top<innerHeight-4&&r.right>0&&r.left<innerWidth))return;
    var cx=Math.min(innerWidth-1,Math.max(0,r.left+r.width/2)), cy=Math.min(innerHeight-1,Math.max(0,r.top+r.height/2));
    var stack=document.elementsFromPoint(cx,cy).filter(function(n){return n&&n.nodeType===1});
    var covered=stack.some(function(n){return n===el||el.contains(n)||n.contains(el)});
    var stackNames=stack.map(function(n){return n.id?('#'+n.id):(typeof n.className==='string'&&n.className?('.'+n.className.trim().split(/\\s+/)[0]):n.tagName)});
    var act=el.closest('.act');
    out.push({sel:(el.id?('#'+el.id):(typeof el.className==='string'&&el.className?('.'+el.className.trim().split(/\\s+/).join('.')):el.tagName)),
      txt:(el.textContent||'').trim().slice(0,14), act:el.closest('#seal')?'seal':(act?act.id:'other'),
      x:Math.round(r.left),y:Math.round(r.top),w:Math.round(r.width),h:Math.round(r.height),
      eff:+eff(el).toFixed(3), covered:covered, stack:stackNames, fs:parseFloat(getComputedStyle(el).fontSize)});
  });
  var s=document.getElementById('seal');
  var mv=document.getElementById('mv');
  return JSON.stringify({
    seal:{display:getComputedStyle(s).display,opacity:+getComputedStyle(s).opacity},
    sealInner:{opacity:+getComputedStyle(document.getElementById('seal-inner')).opacity},
    mv:{opacity:mv?+getComputedStyle(mv).opacity:null},
    texts:out
  });
})()`

const cap = async (f) => {
  const s = await send('Page.captureScreenshot', { format: 'png' })
  const b = Buffer.from(s.data, 'base64')
  writeFileSync(f, b)
  return b
}

const rows = []
const record = async (label, nominal) => {
  // 先读 DOM（盒子坐标），再抓像素 —— DOM 是截图的 t-ε，宁可盒子"早一点"也不晚一点
  const dom = JSON.parse(await ev(DOMREAD))
  const t = Date.now()
  const b = await cap(`${OUT}/${prefix}-${label}.png`)
  const realMs = t - tClick
  const st = stats(decode(b))
  rows.push({ label, nominal, realMs, ...st, dom })
}

// 点击前基准
const p = await ev(`(function(){var e=document.querySelector('.seal__cta');if(!e)return null;var b=e.getBoundingClientRect();return {x:Math.round(b.x+b.width/2),y:Math.round(b.y+b.height/2)}})()`)
if (!p) throw new Error('.seal__cta not found')
const pre = await cap(`${OUT}/${prefix}-pre.png`)
const preStats = stats(decode(pre))
const preDom = JSON.parse(await ev(DOMREAD))

const c = { x: p.x, y: p.y, button: 'left', clickCount: 1 }
await send('Input.dispatchMouseEvent', { type: 'mouseMoved', ...c })
await send('Input.dispatchMouseEvent', { type: 'mousePressed', ...c })
await send('Input.dispatchMouseEvent', { type: 'mouseReleased', ...c })
const tClick = Date.now()

for (const o of offs) {
  const w = tClick + o - Date.now(); if (w > 0) await sleep(w)
  await record(`t${o}`, o)
}

let tail = null
if (opt.scrollEnd) {
  await sleep(600)
  const max = await ev('document.documentElement.scrollHeight - innerHeight')
  // 逐屏滚到底
  for (let y = 0; y <= max; y += Math.round(H * 0.8)) {
    await ev(`window.scrollTo(0, ${y})`)
    await sleep(120)
  }
  await ev(`window.scrollTo(0, ${max})`)
  await sleep(2500)
  const b = await cap(`${OUT}/${prefix}-end-bottom.png`)
  const s1 = stats(decode(b))
  const d1 = JSON.parse(await ev(DOMREAD))
  const full = await ev(`JSON.stringify({scrollY:Math.round(scrollY),max:Math.round(document.documentElement.scrollHeight-innerHeight)})`)
  // 回滚到顶
  await ev('window.scrollTo(0,0)')
  await sleep(2500)
  const b2 = await cap(`${OUT}/${prefix}-end-top.png`)
  const s2 = stats(decode(b2))
  const d2 = JSON.parse(await ev(DOMREAD))
  const residue = await ev(`JSON.stringify({
    bands:[].slice.call(document.querySelectorAll('.mt-band')).filter(function(x){var c=getComputedStyle(x);return c.display!=='none'&&x.getBoundingClientRect().width>0}).length,
    rings:[].slice.call(document.querySelectorAll('.mt-ring')).filter(function(x){return +getComputedStyle(x).opacity>0.02}).length,
    fixedCovers:[].slice.call(document.querySelectorAll('body > *')).filter(function(x){var c=getComputedStyle(x);if(c.display==='none'||c.position!=='fixed')return false;var r=x.getBoundingClientRect();return r.width* r.height>innerWidth*innerHeight*0.9}).map(function(x){return x.id||x.className}),
    scrollY:Math.round(scrollY)
  })`)
  tail = { bottom: { stats: s1, dom: d1 }, backTop: { stats: s2, dom: d2 }, residue: JSON.parse(residue), full: JSON.parse(full) }
}

const report = { prefix, w: W, h: H, media: opt.media ?? null, cpu: opt.cpu ?? null, errors, pre: { stats: preStats, dom: preDom }, rows, tail }
writeFileSync(`${OUT}/${prefix}.json`, JSON.stringify(report))
console.log(`[rec] ${prefix}  frames=${rows.length}  errors=${errors.length}  -> ${OUT}/${prefix}.json`)
if (opt.quiet !== '1') console.log(rows.map((r) => `${r.label}@${r.realMs}ms top=${r.topShare} seal=${r.dom.seal.display} mv=${r.dom.mv.opacity}`).join('\n'))
ws.close()
