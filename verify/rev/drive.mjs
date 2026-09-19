/**
 * 独立复核用 CDP 驱动器（只读；不碰 src/ 业务代码）
 *
 * 用法：
 *   node verify/rev/drive.mjs --url=<url> --out=DIR --ys=0,300,... [--w=390 --h=844 --dsf=1]
 *        [--seal=1] [--settle=2200] [--full=1] [--jpg=1]
 *
 * 每个 y 采集：
 *   - 截图（裁到当前视口）
 *   - pageProbe：候选元素中真正"可见落点"的（aria-hidden 为 false）计数与最暗像素
 *   - metrics：脏内联 transform 残留、幕根 opacity、横向溢出、视口内文本
 * 结果追加写入 OUT/samples.jsonl，最后打印汇总表。
 */
import { writeFile, mkdir, appendFile } from 'node:fs/promises'
import { join } from 'node:path'
import { inflateSync } from 'node:zlib'

const PORT = process.env.CDP_PORT ?? '9222'
const argv = process.argv.slice(2)
const opt = {}
for (const a of argv) {
  if (!a.startsWith('--')) continue
  const i = a.indexOf('=')
  if (i < 0) opt[a.slice(2)] = 'true'
  else opt[a.slice(2, i)] = a.slice(i + 1)
}

const url = opt.url ?? 'http://127.0.0.1:4173/'
const outDir = opt.out ?? 'verify/shots/rev'
const W = Number(opt.w ?? 390)
const H = Number(opt.h ?? 844)
const DSF = Number(opt.dsf ?? 1)
const SEAL = opt.seal === '1'
const SETTLE = Number(opt.settle ?? 2200)
const FULL = opt.full === '1'
const MEDIA = opt.media ?? ''
const BURST = opt.burst ? opt.burst.split(',').map(Number) : null
const SEAM = opt.seam ? opt.seam.split(',').map(Number) : null
const PROBE_AFTER = opt.probeAfter ?? ''
const ys = (opt.ys ?? '0').split(',').map(Number)
const tag = opt.tag ?? 's'

await mkdir(outDir, { recursive: true })

/* ── CDP 连接 ─────────────────────────────────────────── */
const targets = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()
const page = targets.find((t) => t.type === 'page')
if (!page) {
  console.error('没有可用 page target')
  process.exit(3)
}
const ws = new WebSocket(page.webSocketDebuggerUrl)
let seq = 0
const pending = new Map()
const seen = new Set()
const send = (method, params = {}) =>
  new Promise((resolve, reject) => {
    const id = ++seq
    pending.set(id, { resolve, reject })
    ws.send(JSON.stringify({ id, method, params }))
  })
ws.addEventListener('message', (ev) => {
  const msg = JSON.parse(ev.data)
  if (msg.id && pending.has(msg.id)) {
    const { resolve, reject } = pending.get(msg.id)
    pending.delete(msg.id)
    if (msg.error) reject(new Error(msg.error.message))
    else resolve(msg.result)
  } else if (msg.method) seen.add(msg.method)
})
await new Promise((resolve, reject) => {
  ws.addEventListener('open', resolve, { once: true })
  ws.addEventListener('error', () => reject(new Error('WS 连接失败')), { once: true })
})

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

await send('Page.enable')
await send('Runtime.enable')
await send('Emulation.setDeviceMetricsOverride', {
  width: W,
  height: H,
  deviceScaleFactor: DSF,
  mobile: true,
  screenWidth: W,
  screenHeight: H,
})
await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 })
if (MEDIA) {
  const [name, value] = MEDIA.split(':')
  await send('Emulation.setEmulatedMedia', { features: [{ name, value }] })
  console.log(`[drive] 已强制媒体特性 ${name}:${value}`)
}

/** awaitPromise 求值，返回 byValue */
async function evalAsync(expr) {
  const r = await send('Runtime.evaluate', {
    expression: expr,
    awaitPromise: true,
    returnByValue: true,
  })
  if (r.exceptionDetails) {
    return { __err: r.exceptionDetails.exception?.description ?? r.exceptionDetails.text }
  }
  return r.result?.value
}

async function clickSel(sel) {
  const r = await send('Runtime.evaluate', {
    returnByValue: true,
    expression: `(function(){var e=document.querySelector(${JSON.stringify(sel)});if(!e)return null;var b=e.getBoundingClientRect();return {x:Math.round(b.x+b.width/2),y:Math.round(b.y+b.height/2)}})()`,
  })
  const p = r.result?.value
  if (!p) throw new Error(`找不到元素 ${sel}`)
  const common = { x: p.x, y: p.y, button: 'left', clickCount: 1 }
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', ...common })
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', ...common })
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', ...common })
}

/* ── 页面内探针：与业务代码无关，纯 DOM 事实 ─────────── */
const PROBE = `(function(){
  var vh = window.innerHeight;
  var vis = function(e){
    if (!e) return false;
    var cs = getComputedStyle(e);
    if (cs.display === 'none' || cs.visibility === 'hidden') return false;
    if (Number(cs.opacity) <= 0.05) return false;
    var r = e.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) return false;
    // 视口相交（留 1px 容差）
    var top = Math.max(0, r.top), bot = Math.min(vh, r.bottom);
    return bot - top >= 1;
  };
  var info = function(e){
    if (!e) return null;
    var cs = getComputedStyle(e);
    var r = e.getBoundingClientRect();
    return {
      cls: (e.className || e.tagName).toString().slice(0,40),
      op: Number(Number(cs.opacity).toFixed(3)),
      txt: (e.textContent||'').replace(/\\s+/g,' ').trim().slice(0,50),
      rect: [Math.round(r.left),Math.round(r.top),Math.round(r.width),Math.round(r.height)]
    };
  };
  // 幕的物理容器
  var actIds = ['act-mv','act-blessing','act-gallery','act-finale'];
  var acts = actIds.map(function(id){ return document.getElementById(id); });
  var actBoxes = acts.map(function(a){
    if(!a) return null;
    var r=a.getBoundingClientRect();
    return {id:a.id, top:Math.round(r.top), bottom:Math.round(r.bottom), h:Math.round(r.height), state:a.dataset.actState||''};
  });
  // 幕根透明度（各幕自己的根节点）
  var roots = ['.mv','.bs','.gal','.fin'].map(function(s){return document.querySelector(s)});
  var rootOp = roots.map(function(e){ return e? Number(Number(getComputedStyle(e).opacity).toFixed(3)) : null; });
  var rootInline = roots.map(function(e){ return e? (e.style.opacity||'') + '|' + (e.style.transform||'') : null; });
  // 脏内联 transform 残留
  var all = Array.from(document.querySelectorAll('#app *'));
  var dirty = all.filter(function(e){
    var t = e.style.transform, f = e.style.filter;
    return (t && t !== 'none') || (f && f !== '');
  });
  var clean = all.filter(function(e){ return e.style.cssText !== ''; });
  // 视口内可见的文本节点（只算真正看得见的）
  var textEls = all.filter(function(e){ return e.children.length===0 && (e.textContent||'').trim() && vis(e); });
  var visibleText = textEls.map(function(e){ return (e.textContent||'').replace(/\\s+/g,' ').trim(); });
  var classes = {};
  visibleText.forEach(function(t,i){ classes[t] = (textEls[i].className||'').toString().slice(0,30); });
  var finEarly = ['.fin__hb','.fin__line','.fin__sign','.fin__date'].map(function(s){
    var e=document.querySelector(s); if(!e) return null;
    return { sel:s, op:Number(Number(getComputedStyle(e).opacity).toFixed(3)), vis:vis(e) };
  });
  var galImgs = Array.from(document.querySelectorAll('.gcard__img')).map(function(im){
    return { src:(im.getAttribute('src')||'').split('/').pop(), complete:im.complete, nw:im.naturalWidth, disp:getComputedStyle(im).display, vis:vis(im) };
  });
  var fbFrames = Array.from(document.querySelectorAll('.gcard__frame')).map(function(f){ return f.className.toString(); });
  var rootGeom = ['.mv','.bs','.gal','.fin'].map(function(s){
    var e=document.querySelector(s); if(!e) return null;
    var r=e.getBoundingClientRect(); var cs=getComputedStyle(e);
    return { sel:s, absTop:Math.round(r.top+window.scrollY), h:Math.round(r.height),
             offTop:e.offsetTop, offH:e.offsetHeight, z:cs.zIndex, pos:cs.position,
             op:Number(Number(cs.opacity).toFixed(3)), inl:e.style.cssText.slice(0,120) };
  });
  var hintNow = (function(){
    var h=document.querySelector('#fin-hint'); if(!h) return null;
    return { op:Number(Number(getComputedStyle(h).opacity).toFixed(3)), vis:vis(h),
             txt:(h.textContent||'').trim(),
             rect:(function(){var r=h.getBoundingClientRect();return [Math.round(r.left),Math.round(r.top+window.scrollY),Math.round(r.width),Math.round(r.height)]})() };
  })();
  // 祝福幕内部各块的真实纵向占位：用来算"最后一行文字到下一幕之间到底空多少"
  var bsParts = (function(){
    var g=document.querySelector('.bs'); if(!g) return null;
    var kids=Array.from(g.querySelectorAll('*')).filter(function(e){
      var cs=getComputedStyle(e);
      return cs.display!=='none' && e.getBoundingClientRect().height>1;
    });
    var rows=kids.map(function(e){
      var r=e.getBoundingClientRect();
      return { c:(e.className||e.tagName).toString().slice(0,22),
               top:Math.round(r.top+window.scrollY), bot:Math.round(r.bottom+window.scrollY), h:Math.round(r.height) };
    }).sort(function(a,b){return a.top-b.top});
    var last=rows.length?rows[rows.length-1]:null;
    return { count:rows.length, first:rows[0]||null, last:last,
             lastBottom:last?last.bot:null, galleryTop:(function(){var e=document.getElementById('act-gallery');return e?Math.round(e.getBoundingClientRect().top+window.scrollY):null})(),
             blocks:Array.from(document.querySelectorAll('.blk')).map(function(e){var r=e.getBoundingClientRect();return [Math.round(r.top+window.scrollY),Math.round(r.bottom+window.scrollY)]}) };
  })();
  var html = document.documentElement;
  return {
    scrollY: Math.round(window.scrollY),
    maxScroll: Math.round(html.scrollHeight - vh),
    scrollHeight: html.scrollHeight,
    overflowX: html.scrollWidth > html.clientWidth,
    overflowXby: html.scrollWidth - html.clientWidth,
    actBoxes: actBoxes,
    rootGeom: rootGeom,
    hintNow: hintNow,
    bsParts: bsParts,
    actsVisible: acts.map(function(a,i){ return a? vis(a) : false; }),
    rootOpacity: rootOp,
    rootInline: rootInline,
    dirtyCount: dirty.length,
    dirty: dirty.slice(0,10).map(function(e){ return (e.className||e.tagName).toString().slice(0,30)+' t='+(e.style.transform||'').slice(0,60); }),
    inlineStyled: clean.length,
    visibleTextCount: visibleText.length,
    visibleText: visibleText.slice(0,25),
    finEarly: finEarly,
    galImgs: galImgs,
    fbFrames: fbFrames,
    gsapActive: (window.gsap? window.gsap.globalTimeline.getChildren(true,true,true).filter(function(a){return a.isActive()}).length : -1)
  };
})()`

/* ── 最暗像素：用 CDP 抓图后在 node 侧解 PNG ──────────── */
async function capture(file) {
  const shot = await send('Page.captureScreenshot', {
    format: 'png',
    captureBeyondViewport: FULL,
  })
  const buf = Buffer.from(shot.data, 'base64')
  await writeFile(file, buf)
  return buf
}

/* 极简 PNG 解码：只处理 8bit RGB/RGBA 非隔行 */
function decodePng(buf) {
  let p = 8
  let w = 0, h = 0, bitDepth = 0, colorType = 0
  const idat = []
  while (p < buf.length) {
    const len = buf.readUInt32BE(p)
    const type = buf.toString('ascii', p + 4, p + 8)
    const data = buf.subarray(p + 8, p + 8 + len)
    if (type === 'IHDR') {
      w = data.readUInt32BE(0)
      h = data.readUInt32BE(4)
      bitDepth = data[8]
      colorType = data[9]
    } else if (type === 'IDAT') idat.push(Buffer.from(data))
    else if (type === 'IEND') break
    p += 12 + len
  }
  if (bitDepth !== 8 || (colorType !== 2 && colorType !== 6)) {
    return { w, h, unsupported: `bitDepth=${bitDepth} colorType=${colorType}` }
  }
  const bpp = colorType === 6 ? 4 : 3
  const raw = Buffer.concat(idat)
  const out = inflateSync(raw)
  const stride = w * bpp
  const px = Buffer.alloc(h * stride)
  let o = 0
  for (let y = 0; y < h; y++) {
    const ft = out[o++]
    const line = out.subarray(o, o + stride)
    o += stride
    const cur = px.subarray(y * stride, (y + 1) * stride)
    const prev = y > 0 ? px.subarray((y - 1) * stride, y * stride) : Buffer.alloc(stride)
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? cur[x - bpp] : 0
      const b = prev[x]
      const c = x >= bpp ? prev[x - bpp] : 0
      let v = line[x]
      if (ft === 1) v += a
      else if (ft === 2) v += b
      else if (ft === 3) v += (a + b) >> 1
      else if (ft === 4) {
        const pp = a + b - c
        const pa = Math.abs(pp - a), pb = Math.abs(pp - b), pc = Math.abs(pp - c)
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c
      }
      cur[x] = v & 0xff
    }
  }
  return { w, h, bpp, px }
}

function bandStats(img, y0, y1) {
  const { w, h, bpp, px } = img
  let min = 255, max = 0, sum = 0, n = 0, ink = 0, hist = new Array(16).fill(0)
  const a = Math.max(0, Math.min(h - 1, Math.round(y0)))
  const b = Math.max(0, Math.min(h - 1, Math.round(y1)))
  for (let y = a; y <= b; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w * bpp + x * bpp
      const lum = (px[i] * 299 + px[i + 1] * 587 + px[i + 2] * 114) / 1000
      if (lum < min) min = lum
      if (lum > max) max = lum
      sum += lum
      if (lum > 25) ink++
      n++
      hist[Math.min(15, Math.floor(lum / 16))]++
    }
  }
  return {
    min: Math.round(min), max: Math.round(max), mean: Math.round(sum / n),
    inkPct: Math.round((ink / n) * 1000) / 10,
    hist: hist.map((v) => Math.round((v / n) * 1000) / 10),
  }
}

/* ── 导航 ─────────────────────────────────────────────── */
await send('Page.navigate', { url })
const t0 = Date.now()
let domAt = 0
while (!seen.has('Page.loadEventFired') && Date.now() - t0 < 25000) {
  if (!domAt && seen.has('Page.domContentEventFired')) domAt = Date.now()
  if (domAt && Date.now() - domAt > 2000) break
  await sleep(60)
}
await sleep(1200)

if (SEAL) {
  if (BURST) {
    /* 连拍：真实点击 → 按毫秒偏移连续出图，证明转场中间没有黑屏/空白 */
    const tClick = Date.now()
    await clickSel('.seal__cta')
    const recs = []
    const jobs = []
    for (const off of BURST) {
      const wait = tClick + off - Date.now()
      if (wait > 0) await sleep(wait)
      const shot = await send('Page.captureScreenshot', { format: 'png' })
      const dt = Date.now() - tClick
      const file = join(outDir, `${tag}-t${off}.png`)
      // 解码放到下一帧的等待窗口里做，避免解码本身拖慢连拍节奏
      jobs.push(
        (async () => {
          const buf = Buffer.from(shot.data, 'base64')
          await writeFile(file, buf)
          let px = null
          try { px = decodePng(buf) } catch { px = null }
          const st = px && px.px ? {
            whole: bandStats(px, 0, px.h - 1),
            top: bandStats(px, 0, px.h * 0.25),
            mid: bandStats(px, px.h * 0.375, px.h * 0.625),
            bot: bandStats(px, px.h * 0.75, px.h - 1),
          } : null
          return { off, dt, file, st }
        })(),
      )
    }
    const got = await Promise.all(jobs)
    for (const g of got) {
      const p = await evalAsync(PROBE)
      const known = recs.find((r) => r.off === g.off)
      if (known) known.probe = p
      console.log(
        `t=${String(g.off).padStart(5)}ms (实际 ${g.dt}ms) 墨量(全/上/中/下)=` +
        (g.st ? `${g.st.whole.inkPct}/${g.st.top.inkPct}/${g.st.mid.inkPct}/${g.st.bot.inkPct}%` : '?') +
        ` 最暗=${g.st ? g.st.whole.min : '?'} 均亮=${g.st ? g.st.whole.mean : '?'}` +
        ` 幕状态[${(p.actBoxes || []).map((a) => (a ? a.state : '?')).join(',')}]` +
        ` 幕可见[${(p.actsVisible || []).map((v) => (v ? '1' : '0')).join('')}]` +
        ` 视口文本=${JSON.stringify((p.visibleText || []).slice(0, 6))}`,
      )
      await appendFile(join(outDir, 'burst.jsonl'), JSON.stringify({ ...g, probe: p }) + '\n')
      void known
    }
    console.log(`[drive] 连拍 ${BURST.length} 帧 → ${outDir}`)
    ws.close()
    process.exit(0)
  }
  await clickSel('.seal__cta')
  await sleep(2000)
}
// 让首屏动效彻底停：采样期间不应有跨 y 不同的"还在动"的污染
await sleep(SETTLE)

const results = []
for (const y of ys) {
  await send('Runtime.evaluate', { expression: `window.scrollTo(0, ${y})` })
  await sleep(900)
  const file = join(outDir, `${tag}-y${y}.png`)
  const buf = await capture(file)
  let px = null
  try {
    px = decodePng(buf)
  } catch (e) {
    px = { err: String(e).slice(0, 120) }
  }
  const probe = await evalAsync(PROBE)
  const H_ = px && px.h ? px.h : H * DSF
  const stats = px && px.px ? {
    top: bandStats(px, 0, H_ * 0.25),
    mid: bandStats(px, H_ * 0.375, H_ * 0.625),
    bot: bandStats(px, H_ * 0.75, H_ - 1),
    whole: bandStats(px, 0, H_ - 1),
  } : { err: px && px.unsupported ? px.unsupported : 'decode-failed' }
  // 精确接缝：目标绝对 y 落在视口内的哪一行，取 ±2px 扫描带
  let seamStat = null
  if (SEAM && px && px.px) {
    for (const target of SEAM) {
      const local = target - y
      if (local >= 0 && local <= H_) {
        seamStat = seamStat || {}
        seamStat[target] = {
          localRow: Math.round(local),
          ...bandStats(px, Math.max(0, local - 2), Math.min(H_ - 1, local + 2)),
        }
      }
    }
  }
  const rec = { y, file, probe, stats, seamStat }
  results.push(rec)
  await appendFile(join(outDir, 'samples.jsonl'), JSON.stringify(rec) + '\n')
  const p = probe || {}
  console.log(
    `y=${String(y).padStart(5)} scrollY=${String(p.scrollY).padStart(5)}/${p.maxScroll}` +
    ` 幕状态[${(p.actBoxes || []).map((a) => (a ? a.state : '?')).join(',')}]` +
    ` 幕可见[${(p.actsVisible || []).map((v) => (v ? '1' : '0')).join('')}]` +
    ` 根op[${(p.rootOpacity || []).join(',')}]` +
    ` 脏transform=${p.dirtyCount} 可见文本=${p.visibleTextCount}` +
    ` 最暗(min/mean)=${stats.whole ? stats.whole.min + '/' + stats.whole.mean : '?'}` +
    ` 墨量(top/mid/bot)=${stats.top ? stats.top.inkPct + '/' + stats.mid.inkPct + '/' + stats.bot.inkPct : '?'}%`,
  )
  if (seamStat) {
    for (const k of Object.keys(seamStat)) {
      console.log(`       接缝绝对值 y=${k} 视口内第 ${seamStat[k].localRow} 行: min=${seamStat[k].min} mean=${seamStat[k].mean} max=${seamStat[k].max}`)
    }
  }
  if (p.dirty && p.dirty.length) console.log(`       脏残留: ${p.dirty.join(' ; ')}`)
  if (p.visibleText && p.visibleText.length) console.log(`       视口文本: ${JSON.stringify(p.visibleText)}`)
  if (p.finEarly) {
    const early = p.finEarly.filter((f) => f && f.op > 0.05)
    if (early.length) console.log(`       !! 收尾信提前可见: ${JSON.stringify(early)}`)
  }
  if (p.galImgs && p.galImgs.length) {
    const bad = p.galImgs.filter((i) => i.complete && i.nw === 0 && i.disp !== 'none')
    if (bad.length) console.log(`       !! 可见裂图: ${JSON.stringify(bad)}`)
  }
  if (p.rootGeom && y === ys[0]) {
    console.log('       ── 幕几何 ──')
    for (const g of p.rootGeom) {
      if (g) console.log(`         ${g.sel} absTop=${g.absTop} h=${g.h} offTop=${g.offTop} offH=${g.offH} z=${g.z} pos=${g.pos} op=${g.op} inl=[${g.inl}]`)
    }
    console.log(`         files: ${(p.galImgs || []).map((i) => i.src).join(',')}`)
    console.log(`         frames: ${JSON.stringify(p.fbFrames)}`)
    console.log(`         hintNow: ${JSON.stringify(p.hintNow)}`)
    if (p.bsParts) {
      console.log(`         祝福幕 blocks(top,bot)=${JSON.stringify(p.bsParts.blocks)}`)
      console.log(`         祝福幕最后元素 bot=${p.bsParts.lastBottom} → galleryTop=${p.bsParts.galleryTop} 差值=${p.bsParts.galleryTop - p.bsParts.lastBottom}px`)
      console.log(`         祝福幕最后元素=${JSON.stringify(p.bsParts.last)}`)
    }
  }
  if (PROBE_AFTER) {
    const extra = await evalAsync(PROBE_AFTER)
    console.log(`       probeAfter: ${JSON.stringify(extra)}`)
  }
}
console.log(`\n[drive] ${results.length} 个采样 → ${outDir}`)
ws.close()
