/**
 * 第三轮独立复核 · 终态取证（不看作者钩子）
 * 点击 -> 等 6s（所有进场动画必然跑完）-> 读全站每个有直接文字的元素：
 *   自身与祖先 opacity 累乘、是否被盖住、矩形是否在视口内。
 * 目标：回答"她最后到底看到了什么"。
 * 用法：node verify/r3/finalstate.mjs [--media=a:b] [--url=...]
 */
const PORT = process.env.CDP_PORT ?? '9222'
const argv = process.argv.slice(2)
const opt = {}
for (const a of argv) { if (a.startsWith('--')) { const [k, v] = a.replace(/^--/, '').split('='); opt[k] = v ?? 'true' } }

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
await send('Page.navigate', { url: opt.url ?? `http://127.0.0.1:4173/index.html?fs=${Date.now()}` })
{ const t0 = Date.now(); while (Date.now() - t0 < 20000) { const st = await ev('document.readyState').catch(() => null); if (st === 'complete' || st === 'interactive') break; await sleep(40) } }
await sleep(2200)
const p = await ev(`(function(){var e=document.querySelector('.seal__cta');var b=e.getBoundingClientRect();return {x:Math.round(b.x+b.width/2),y:Math.round(b.y+b.height/2)}})()`)
const c = { x: p.x, y: p.y, button: 'left', clickCount: 1 }
await send('Input.dispatchMouseEvent', { type: 'mouseMoved', ...c })
await send('Input.dispatchMouseEvent', { type: 'mousePressed', ...c })
await send('Input.dispatchMouseEvent', { type: 'mouseReleased', ...c })
await sleep(Number(opt.wait ?? 6000))

const probe = `(function(){
  function eff(el){var op=1,c=el;while(c&&c!==document.documentElement){var s=getComputedStyle(c);if(s.display==='none'||s.visibility==='hidden')return 0;op*=Number(s.opacity);if(op<=0.0001)return 0;c=c.parentElement}return +op.toFixed(4)}
  var rows=[];var hidden=[];
  document.querySelectorAll('h1,h2,p,span,b,em,button,div').forEach(function(el){
    var direct=false;for(var i=0;i<el.childNodes.length;i++){var n=el.childNodes[i];if(n.nodeType===3&&n.textContent.trim().length>0){direct=true;break}}
    if(!direct)return;
    var e=eff(el);var r=el.getBoundingClientRect();
    var inVp=(r.bottom>4&&r.top<innerHeight-4&&r.right>0&&r.left<innerWidth);
    var rec={sel:(el.id?('#'+el.id):('.'+(el.className||'').toString().trim().split(/\\s+/)[0])),txt:(el.textContent||'').trim().slice(0,18),
      act:el.closest('#seal')?'seal':(el.closest('.act')?el.closest('.act').id:'other'),
      eff:e, inVp:inVp, inline:el.getAttribute('style')||'', top:Math.round(r.top), left:Math.round(r.left), w:Math.round(r.width), h:Math.round(r.height)};
    if(inVp){rows.push(rec); if(e<=0.1)hidden.push(rec)}
  });
  var acts={};rows.forEach(function(r){acts[r.act]=acts[r.act]||{readable:0,hidden:0};if(r.eff>0.1)acts[r.act].readable++;else acts[r.act].hidden++});
  return JSON.stringify({acts:acts, viewportTexts:rows.map(function(r){return r.sel+'@'+r.eff+(r.eff>0.1?'':'(隐)')+'['+r.txt+']'}), hiddenCount:hidden.length,
    hiddenDetail:hidden.map(function(r){return r.sel+' eff='+r.eff+' inline="'+r.inline+'" rect='+r.left+','+r.top+' '+r.w+'x'+r.h})},null,1);
})()`
console.log(opt.media ? `--- media=${opt.media} ---` : '--- 默认 ---')
console.log(await ev(probe))
ws.close()
