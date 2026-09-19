/**
 * 共享验证工具：CDP 截图（真·手机视口，绕过 Windows 下 --window-size 被钳制的问题）
 *
 * 前置：先起一个带调试端口的 Chrome
 *   chrome --headless=new --remote-debugging-port=9222 --no-sandbox about:blank
 * 用法：
 *   node verify/shot.mjs <url> <out.png> [--w=390] [--h=844] [--dsf=2] [--full]
 *
 * 只用 Node 内置 fetch + WebSocket，零依赖。
 */
import { writeFile } from 'node:fs/promises'
import { readFileSync } from 'node:fs'

const PORT = process.env.CDP_PORT ?? '9222'
const argv = process.argv.slice(2)
const url = argv[0]
const out = argv[1]

if (!url || !out) {
  console.error('用法: node verify/shot.mjs <url> <out.png> [--w=390 --h=844 --dsf=2 --full]')
  process.exit(2)
}

const opt = {}
for (const a of argv.slice(2)) {
  if (!a.startsWith('--')) continue
  const [k, v] = a.replace(/^--/, '').split('=')
  opt[k] = v ?? 'true'
}
const width = Number(opt.w ?? 390)
const height = Number(opt.h ?? 844)
const dsf = Number(opt.dsf ?? 2)
const full = opt.full === 'true'
/** 额外等待毫秒数：跑压测/FPS 基准需要等页面自己算完 */
const extraWait = Number(opt.wait ?? 0)
/** 媒体特性模拟，例如 --media=prefers-reduced-motion:reduce（用 CDP 强制，不靠代码假装） */
const mediaFeature = opt.media ?? ''
/** --click=x,y ：加载后用 CDP 真实派发一次点击（不是 JS 假调用 element.click()） */
const click = opt.click ?? ''
/** --clickSel=<选择器> ：点上某个元素的中心（比硬编坐标稳，换视口也不用重算） */
const clickSel = opt.clickSel ?? ''
/** --burst=0,150,300 ：相对"此刻"的连拍偏移毫秒，用于证明转场中间没有白屏 */
const burst = opt.burst ? opt.burst.split(',').map(Number) : null
/** --probe=<js> ：在页面里求值并打印，用于读取音频/CSS 等运行时状态 */
/** --probeFile=<路径> ：同上，但从文件读表达式。
    为什么需要：这个环境的 PowerShell 会把带引号/比较符的长表达式截断，
    导致探针报 "Unexpected end of input" —— 写进文件就绕开了。 */
const probeExpr = opt.probeFile
  ? readFileSync(opt.probeFile, 'utf8')
  : (opt.probe ?? '')
/** --scrollSel=<选择器> ：截图前先滚到该元素（长页面取证用） */
const scrollSel = opt.scrollSel ?? ''
/** --scrollY=<px> ：直接滚到某个纵向位置（纯数字，绕开命令行引号问题） */
const scrollY = opt.scrollY ?? ''
/** --clickSelAfter=<选择器> ：滚动之后再点一次（多幕页面：先点封印解锁滚动，滚下去，再点这一幕） */
const clickSelAfter = opt.clickSelAfter ?? ''

const targets = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()
const page = targets.find((t) => t.type === 'page')
if (!page) {
  console.error('没有可用的 page target；Chrome 是否带 --remote-debugging-port 在跑？')
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
  } else if (msg.method) {
    seen.add(msg.method)
  }
})

await new Promise((resolve, reject) => {
  ws.addEventListener('open', resolve, { once: true })
  ws.addEventListener('error', () => reject(new Error('WebSocket 连接失败')), { once: true })
})

await send('Page.enable')
await send('Runtime.enable')
await send('Emulation.setDeviceMetricsOverride', {
  width,
  height,
  deviceScaleFactor: dsf,
  mobile: true,
  screenWidth: width,
  screenHeight: height,
})
await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 })
if (mediaFeature) {
  const [name, value] = mediaFeature.split(':')
  await send('Emulation.setEmulatedMedia', { features: [{ name, value }] })
}
await send('Page.navigate', { url })

const t0 = Date.now()
let domContentAt = 0
while (!seen.has('Page.loadEventFired') && Date.now() - t0 < 20000) {
  if (!domContentAt && seen.has('Page.domContentEventFired')) domContentAt = Date.now()
  // load 会被大资源（例如 preload=auto 的 4.7MB 音频）拖后很久，
  // DOMContentLoaded 之后最多再等 1.5s 就走 —— 否则"t=0 定格"根本不是 t=0
  if (domContentAt && Date.now() - domContentAt > 1500) break
  await new Promise((r) => setTimeout(r, 60))
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// 连拍模式下基准等待归零：偏移量要相对于"刚加载完"才有意义
if (!burst) await sleep(1000)
if (extraWait > 0) await sleep(extraWait)

const captureTo = async (file) => {
  const shot = await send('Page.captureScreenshot', {
    format: 'png',
    captureBeyondViewport: full,
  })
  await writeFile(file, Buffer.from(shot.data, 'base64'))
}

const clickAt = async (sel) => {
  const r = await send('Runtime.evaluate', {
    returnByValue: true,
    expression: `(function(){var e=document.querySelector(${JSON.stringify(sel)});if(!e)return null;var b=e.getBoundingClientRect();return {x:Math.round(b.x+b.width/2),y:Math.round(b.y+b.height/2)}})()`,
  })
  const p = r.result?.value
  if (!p) throw new Error(`clickSel 没找到元素: ${sel}`)
  const common = { x: p.x, y: p.y, button: 'left', clickCount: 1 }
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', ...common })
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', ...common })
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', ...common })
}

// 动作序列（顺序有语义）：点第一处 → 等页面稳住 → 滚 → 点第二处 → 连拍
if (clickSel) {
  await clickAt(clickSel)
  await sleep(1800) // 入场封印的转场里会 scrollTo(0,0)，必须等它跑完再滚
}
if (scrollY) {
  await send('Runtime.evaluate', { expression: `(window.__scrollTo || function(y){window.scrollTo(0,y)}).call(window, ${Number(scrollY)})` })
  await sleep(1000)
}
if (clickSelAfter) {
  await clickAt(clickSelAfter)
}
// 兼容：--click=x,y 直接给坐标
if (!clickSel && !clickSelAfter && click) {
  const [cx, cy] = click.split(',').map(Number)
  const common = { x: cx, y: cy, button: 'left', clickCount: 1 }
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', ...common })
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', ...common })
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', ...common })
}

/** --scrollBefore=<y> ：点击序列之后、截图之前滚一次。
    为什么需要它：封印期间 html.is-sealed 把 overflow 锁住了，滚动无效 ——
    想在进站后看到下面的幕，必须"先点完再滚"，而这个顺序原来的工具做不到。 */
if (opt.scrollBefore) {
  // 不调 Lenis 的程序化 scrollTo（实测它进站后无效），改成派发真实滚轮事件 ——
  // 那是她实际走的那条路，也因此是唯一能证明"她能滚到底"的方式。
  await send('Runtime.evaluate', {
    awaitPromise: true,
    expression: `new Promise(function(r){var n=0;var id=setInterval(function(){window.dispatchEvent(new WheelEvent('wheel',{deltaY:900,bubbles:true,cancelable:true}));if(++n>${Number(opt.scrollBefore) || 16}){clearInterval(id);setTimeout(function(){r(Math.round(window.scrollY))},900)}},60)})`,
  })
}

/** --scrollToSel=<选择器> ：闭环滚到某个元素（滚到差 40px 以内才停）。
    为什么不用数滚轮次数：每次实际位移受 Lenis 阻尼影响，实测约 1012px
    而不是名义的 810，靠次数一定会滚过头。 */
if (opt.scrollToSel) {
  await send('Runtime.evaluate', {
    awaitPromise: true,
    expression: `new Promise(function(res){var el=document.querySelector(${JSON.stringify(opt.scrollToSel)});if(!el)return res('NOT_FOUND');var r=el.getBoundingClientRect();var target=r.top+window.scrollY-(window.innerHeight-r.height)/2;var n=0;var id=setInterval(function(){var d=target-window.scrollY;if(Math.abs(d)<40||n++>60){clearInterval(id);setTimeout(function(){res(Math.round(window.scrollY))},700);return}window.dispatchEvent(new WheelEvent('wheel',{deltaY:Math.max(-900,Math.min(900,d)),bubbles:true,cancelable:true}))},70)})`,
  })
}

/** --tapSel=<选择器> ：截图前点一下（比如"点开礼物盒，再拍飞出来的图"）。
    原来的顺序只能"先点后滚"，拍不到"滚到位之后再点"的结果。 */
if (opt.tapSel) {
  await clickAt(opt.tapSel)
  await sleep(Number(opt.tapWait ?? 1100))
}

if (burst) {
  const t0 = Date.now()
  for (const offset of burst) {
    const wait = t0 + offset - Date.now()
    if (wait > 0) await sleep(wait)
    await captureTo(out.replace(/\.png$/, `-t${offset}.png`))
  }
} else {
  await captureTo(out)
}

if (scrollSel) {
  // 不用 scrollIntoView：.act 的 overflow:hidden 让它成了脚本可滚的容器，
  // scrollIntoView 会就近滚它而不是滚页面（实测截出来的两张图完全一样）。
  const r = await send('Runtime.evaluate', {
    returnByValue: true,
    expression: `(function(){var e=document.querySelector(${JSON.stringify(scrollSel)});if(!e)return 'NOT_FOUND';var b=e.getBoundingClientRect();window.scrollTo(0, window.scrollY + b.top - (window.innerHeight - b.height)/2);return Math.round(window.scrollY)+'/'+Math.round(document.documentElement.scrollHeight-window.innerHeight)})()`,
  })
  console.log(`[shot] scrollSel -> scrollY/total = ${r.result?.value}`)
  await sleep(2200) // 等该段的进场动效跑完，截到的是她真正读到的画面
  await captureTo(out.replace(/\.png$/, '-scrolled.png'))
}

let probeText = ''
if (probeExpr) {
  const r = await send('Runtime.evaluate', {
    expression: probeExpr,
    returnByValue: true,
    awaitPromise: true,
  })
  if (r.exceptionDetails) {
    probeText = `  probe=THREW ${r.exceptionDetails.text ?? ''} ${r.exceptionDetails.exception?.description ?? ''}`
  } else {
    probeText = `  probe=${JSON.stringify(r.result?.value ?? r.result?.description ?? null)}`
  }
}

const vp = await send('Runtime.evaluate', {
  returnByValue: true,
  expression: `JSON.stringify({
    cssViewport: document.documentElement.clientWidth + 'x' + document.documentElement.clientHeight,
    dpr: devicePixelRatio,
    scrollWidth: document.documentElement.scrollWidth,
    overflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth
  })`,
})

console.log(`[shot] ${out}  ${vp.result.value}${probeText}`)
ws.close()
