/**
 * 独立复核者自备：零依赖 PNG 解码 + 像素质检。
 * 不复用作者任何钩子 —— 判据全部来自"屏幕上真实画出来的像素"。
 *
 * 支持：8bit / truecolor+alpha / truecolor / gray+alpha / gray / palette，非隔行。
 * （CDP Page.captureScreenshot 的 PNG 就是 8bit RGBA 非隔行，其余分支只为稳健。）
 */
import { inflateSync } from 'node:zlib'

const SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

export function decodePng(buf) {
  if (!buf.subarray(0, 8).equals(SIG)) throw new Error('不是 PNG')
  let off = 8
  let ihdr = null
  let plte = null
  let trns = null
  const idat = []
  while (off + 8 <= buf.length) {
    const len = buf.readUInt32BE(off)
    const type = buf.toString('latin1', off + 4, off + 8)
    const data = buf.subarray(off + 8, off + 8 + len)
    if (type === 'IHDR') {
      ihdr = {
        width: data.readUInt32BE(0),
        height: data.readUInt32BE(4),
        depth: data[8],
        colorType: data[9],
        interlace: data[12],
      }
    } else if (type === 'PLTE') plte = Buffer.from(data)
    else if (type === 'tRNS') trns = Buffer.from(data)
    else if (type === 'IDAT') idat.push(Buffer.from(data))
    else if (type === 'IEND') break
    off += 12 + len
  }
  if (!ihdr) throw new Error('缺 IHDR')
  if (ihdr.depth !== 8) throw new Error('只支持 8bit，实际 ' + ihdr.depth)
  if (ihdr.interlace !== 0) throw new Error('不支持隔行')

  const { width: w, height: h, colorType: ct } = ihdr
  const channels = ct === 6 ? 4 : ct === 2 ? 3 : ct === 4 ? 2 : ct === 0 ? 1 : ct === 3 ? 1 : 0
  if (!channels) throw new Error('不支持 colorType ' + ct)

  const raw = inflateSync(Buffer.concat(idat))
  const bpp = channels
  const stride = w * bpp
  const out = Buffer.alloc(h * stride)

  // 逐行反滤波
  for (let y = 0; y < h; y++) {
    const ft = raw[y * (stride + 1)]
    const src = raw.subarray(y * (stride + 1) + 1, y * (stride + 1) + 1 + stride)
    const dst = out.subarray(y * stride, (y + 1) * stride)
    const prev = y > 0 ? out.subarray((y - 1) * stride, y * stride) : null
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? dst[x - bpp] : 0
      const b = prev ? prev[x] : 0
      const c = prev && x >= bpp ? prev[x - bpp] : 0
      const v = src[x]
      let r
      switch (ft) {
        case 0: r = v; break
        case 1: r = v + a; break
        case 2: r = v + b; break
        case 3: r = v + ((a + b) >> 1); break
        case 4: {
          const p = a + b - c
          const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c)
          r = v + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c)
          break
        }
        default: throw new Error('未知滤波类型 ' + ft)
      }
      dst[x] = r & 0xff
    }
  }

  // 统一展开成 RGBA
  const rgba = Buffer.alloc(w * h * 4)
  for (let i = 0, n = w * h; i < n; i++) {
    let R, G, B, A = 255
    if (ct === 6) { R = out[i * 4]; G = out[i * 4 + 1]; B = out[i * 4 + 2]; A = out[i * 4 + 3] }
    else if (ct === 2) { R = out[i * 3]; G = out[i * 3 + 1]; B = out[i * 3 + 2] }
    else if (ct === 4) { R = out[i * 2]; G = out[i * 2]; B = out[i * 2]; A = out[i * 2 + 1] }
    else if (ct === 0) { R = G = B = out[i] }
    else {
      const idx = out[i]
      R = plte[idx * 3]; G = plte[idx * 3 + 1]; B = plte[idx * 3 + 2]
      if (trns && idx < trns.length) A = trns[idx]
    }
    rgba[i * 4] = R; rgba[i * 4 + 1] = G; rgba[i * 4 + 2] = B; rgba[i * 4 + 3] = A
  }
  return { width: w, height: h, rgba }
}

/* ── 把 RGBA 降采样成灰度网格（area 平均），供指标计算 ────────── */
function toGray(img, gw, gh) {
  const { width: w, height: h, rgba } = img
  const g = new Float64Array(gw * gh)
  const cnt = new Float64Array(gw * gh)
  for (let y = 0; y < h; y++) {
    const gy = Math.min(gh - 1, Math.floor((y * gh) / h))
    for (let x = 0; x < w; x++) {
      const gx = Math.min(gw - 1, Math.floor((x * gw) / w))
      const i = (y * w + x) * 4
      const lum = 0.2126 * rgba[i] + 0.7152 * rgba[i + 1] + 0.0722 * rgba[i + 2]
      g[gy * gw + gx] += lum
      cnt[gy * gw + gx]++
    }
  }
  for (let i = 0; i < g.length; i++) g[i] /= cnt[i] || 1
  return g
}

/**
 * 一帧的像素质检。判据全部独立于站点代码：
 *  - topColor/topShare : 最高频"量化色"占比 → 整屏纯色遮盖的充要观测量
 *  - inkRatio          : 与画面主导底色明显不同的像素占比（"有东西在画面上"的最低门槛）
 *  - busyTiles         : 32x24 网格里含高梯度（文字/图形边缘）的格子数
 *  - meanLum / p05/p95
 */
export function frameStats(img, opts = {}) {
  const { width: w, height: h, rgba } = img
  const N = w * h
  const q = 8 // 量化到 8 级/通道
  const hist = new Map()
  let sum = 0
  let lumArr = new Float64Array(N)
  for (let i = 0; i < N; i++) {
    const r = rgba[i * 4], g = rgba[i * 4 + 1], b = rgba[i * 4 + 2]
    const key = ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3)
    hist.set(key, (hist.get(key) ?? 0) + 1)
    const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b
    lumArr[i] = lum
    sum += lum
  }
  let topKey = 0, topN = 0
  for (const [k, v] of hist) if (v > topN) { topN = v; topKey = k }
  const topColor = {
    r: ((topKey >> 10) & 31) << 3,
    g: ((topKey >> 5) & 31) << 3,
    b: (topKey & 31) << 3,
  }
  const meanLum = sum / N

  // ink：与主导底色在通道空间里距离 > 40 的像素
  let ink = 0
  for (let i = 0; i < N; i++) {
    const dr = rgba[i * 4] - topColor.r, dg = rgba[i * 4 + 1] - topColor.g, db = rgba[i * 4 + 2] - topColor.b
    if (Math.abs(dr) + Math.abs(dg) + Math.abs(db) > 40) ink++
  }

  const sorted = Float64Array.from(lumArr).sort()
  const p05 = sorted[Math.floor(N * 0.05)]
  const p95 = sorted[Math.floor(N * 0.95)]

  // 梯度网格：找"有边缘/有文字"的格子
  const gw = 32, gh = 24
  const g = toGray(img, gw, gh)
  let busyTiles = 0
  const tileInk = []
  for (let y = 1; y < gh - 1; y++) {
    for (let x = 1; x < gw - 1; x++) {
      const c = g[y * gw + x]
      const dx = Math.abs(g[y * gw + x + 1] - g[y * gw + x - 1])
      const dy = Math.abs(g[(y + 1) * gw + x] - g[(y - 1) * gw + x])
      if (dx + dy > 14) busyTiles++
    }
  }
  // 行的"有内容"判定：该行灰度标准差够大
  for (let y = 0; y < gh; y++) {
    let m = 0
    for (let x = 0; x < gw; x++) m += g[y * gw + x]
    m /= gw
    let v = 0
    for (let x = 0; x < gw; x++) { const d = g[y * gw + x] - m; v += d * d }
    tileInk.push(Math.sqrt(v / gw))
  }
  const busyRows = tileInk.filter((s) => s > 4).length

  return {
    w, h,
    topColor,
    topShare: +(topN / N).toFixed(4),
    inkRatio: +(ink / N).toFixed(4),
    meanLum: +meanLum.toFixed(1),
    p05: +p05.toFixed(1),
    p95: +p95.toFixed(1),
    busyTiles,
    busyRows,
  }
}
