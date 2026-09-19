/**
 * 第三轮独立复核 · 自备零依赖 PNG 解码 + 像素统计。
 * 与 verify/indep/png.mjs 无代码继承关系（重新写，避免继承上一轮判据的错误假设）。
 */
import { inflateSync } from 'node:zlib'

export function decode(buf) {
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error('not png')
  let off = 8
  let W = 0, H = 0, depth = 0, ct = 0, interlace = 0
  let plte = null, trns = null
  const idat = []
  while (off + 8 <= buf.length) {
    const len = buf.readUInt32BE(off)
    const type = buf.toString('latin1', off + 4, off + 8)
    const d = buf.subarray(off + 8, off + 8 + len)
    if (type === 'IHDR') {
      W = d.readUInt32BE(0); H = d.readUInt32BE(4); depth = d[8]; ct = d[9]; interlace = d[12]
    } else if (type === 'PLTE') plte = Buffer.from(d)
    else if (type === 'tRNS') trns = Buffer.from(d)
    else if (type === 'IDAT') idat.push(Buffer.from(d))
    else if (type === 'IEND') break
    off += 12 + len
  }
  if (depth !== 8 || interlace !== 0) throw new Error(`unsupported depth=${depth} interlace=${interlace}`)
  const ch = ct === 6 ? 4 : ct === 2 ? 3 : ct === 4 ? 2 : ct === 0 ? 1 : ct === 3 ? 1 : 0
  if (!ch) throw new Error('ct ' + ct)
  const raw = inflateSync(Buffer.concat(idat))
  const stride = W * ch
  const out = Buffer.alloc(H * stride)
  for (let y = 0; y < H; y++) {
    const ft = raw[y * (stride + 1)]
    const src = raw.subarray(y * (stride + 1) + 1, y * (stride + 1) + 1 + stride)
    const dst = out.subarray(y * stride, (y + 1) * stride)
    const prev = y > 0 ? out.subarray((y - 1) * stride, y * stride) : null
    for (let x = 0; x < stride; x++) {
      const a = x >= ch ? dst[x - ch] : 0
      const b = prev ? prev[x] : 0
      const c = prev && x >= ch ? prev[x - ch] : 0
      const v = src[x]
      let r
      if (ft === 0) r = v
      else if (ft === 1) r = v + a
      else if (ft === 2) r = v + b
      else if (ft === 3) r = v + ((a + b) >> 1)
      else {
        const p = a + b - c
        const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c)
        r = v + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c)
      }
      dst[x] = r & 0xff
    }
  }
  const rgba = Buffer.alloc(W * H * 4)
  for (let i = 0, n = W * H; i < n; i++) {
    let R, G, B, A = 255
    if (ct === 6) { R = out[i * 4]; G = out[i * 4 + 1]; B = out[i * 4 + 2]; A = out[i * 4 + 3] }
    else if (ct === 2) { R = out[i * 3]; G = out[i * 3 + 1]; B = out[i * 3 + 2] }
    else if (ct === 4) { R = out[i * 2]; G = out[i * 2 + 1]; B = out[i * 2 + 2]; A = out[i * 2 + 3] }
    else if (ct === 0) { R = G = B = out[i] }
    else { const k = out[i]; R = plte[k * 3]; G = plte[k * 3 + 1]; B = plte[k * 3 + 2]; if (trns && k < trns.length) A = trns[k] }
    rgba[i * 4] = R; rgba[i * 4 + 1] = G; rgba[i * 4 + 2] = B; rgba[i * 4 + 3] = A
  }
  return { W, H, rgba }
}

/**
 * 整帧统计：最高频量化色占比（整屏纯色遮盖的观测量）、平均亮度、边界密度
 */export function stats(img) {
  const { W, H, rgba } = img
  const N = W * H
  const hist = new Map()
  let sum = 0
  for (let i = 0; i < N; i++) {
    const r = rgba[i * 4], g = rgba[i * 4 + 1], b = rgba[i * 4 + 2]
    const k = ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3)
    hist.set(k, (hist.get(k) ?? 0) + 1)
    sum += 0.2126 * r + 0.7152 * g + 0.0722 * b
  }
  let top = 0, topN = 0
  for (const [k, v] of hist) if (v > topN) { topN = v; top = k }
  return {
    W, H,
    topShare: +(topN / N).toFixed(4),
    topColor: [((top >> 10) & 31) << 3, ((top >> 5) & 31) << 3, (top & 31) << 3],
    meanLum: +(sum / N).toFixed(1),
  }
}

/**
 * 在给定矩形里数"文字笔画像素"：与矩形内主导底色差 > 60（L1 距离）的像素。
 * 这是纯像素判据，不看 DOM：
 *  - 文字在 => ink 有一个可观的数量（几百上千）
 *  - 文字不在（只有底色 + 大片色块边界）=> ink 很小
 * 返回 { ink, ratio, edge }。edge = 每 4x4 块内出现 ink 的块数（边缘/笔画分布度）
 */
export function rectInk(img, x0, y0, x1, y1) {
  const { W, H, rgba } = img
  const ax = Math.max(0, Math.floor(x0)), bx = Math.min(W, Math.ceil(x1))
  const ay = Math.max(0, Math.floor(y0)), by = Math.min(H, Math.ceil(y1))
  if (bx - ax < 2 || by - ay < 2) return { ink: 0, ratio: 0, edge: 0, n: 0 }
  const hist = new Map()
  const px = (x, y) => {
    const i = (y * W + x) * 4
    return [rgba[i], rgba[i + 1], rgba[i + 2]]
  }
  for (let y = ay; y < by; y++) for (let x = ax; x < bx; x++) {
    const [r, g, b] = px(x, y)
    const k = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4)
    hist.set(k, (hist.get(k) ?? 0) + 1)
  }
  let bk = 0, bn = 0
  for (const [k, v] of hist) if (v > bn) { bn = v; bk = k }
  const br = ((bk >> 8) & 15) * 17, bg = ((bk >> 4) & 15) * 17, bb = (bk & 15) * 17
  let ink = 0
  const cells = new Set()
  for (let y = ay; y < by; y++) for (let x = ax; x < bx; x++) {
    const [r, g, b] = px(x, y)
    if (Math.abs(r - br) + Math.abs(g - bg) + Math.abs(b - bb) > 60) {
      ink++
      cells.add(((y >> 2) * 4096) + (x >> 2))
    }
  }
  const n = (bx - ax) * (by - ay)
  return { ink, ratio: +(ink / n).toFixed(4), edge: cells.size, n }
}

/**
 * 矩形内"文字亮度足迹"：95 分位通道最大值 + 超过阈值的像素数。
 * 比"与矩形主导色比差"稳：文字是亮色（白/青），亮度分位会被文字笔画顶上去，
 * 而空底色 / 半调网点 / 斜切色带的分位都压在低位。
 */
export function glyphTrace(img, x0, y0, x1, y1, thr = 120) {
  const { W, H, rgba } = img
  const ax = Math.max(0, Math.floor(x0)), bx = Math.min(W, Math.ceil(x1))
  const ay = Math.max(0, Math.floor(y0)), by = Math.min(H, Math.ceil(y1))
  if (bx - ax < 2 || by - ay < 2) return { max: 0, hot: 0, hotRatio: 0, hist: [] }
  const vals = []
  let max = 0, hot = 0
  for (let y = ay; y < by; y++) for (let x = ax; x < bx; x++) {
    const i = (y * W + x) * 4
    const v = Math.max(rgba[i], rgba[i + 1], rgba[i + 2])
    vals.push(v)
    if (v > max) max = v
    if (v >= thr) hot++
  }
  vals.sort((a, b) => a - b)
  const n = vals.length
  const pct = (p) => vals[Math.min(n - 1, Math.floor(n * p))]
  return {
    max,
    hot,
    hotRatio: +(hot / n).toFixed(4),
    p50: pct(0.5), p90: pct(0.9), p99: pct(0.99),
    hist: [pct(0.5), pct(0.75), pct(0.9), pct(0.95), pct(0.99)],
  }
}

/**
 * 「笔画块」判据 —— 复核者最终采用的像素判据。
 *
 * 背景事实（实测）：整站有一层 20px 间距的青色网点 + 斜切色块，
 * 所以"亮的像素"本身不等于文字：网点单像素孤立、色带是连续低亮。
 * 文字的特征是**笔画粗**（大字号 >14px 笔画宽）→ 亮像素会成团。
 *
 * 判据：亮度 >= thr 且 4 邻域内有另一个亮像素的像素数（blob 像素）。
 *   纯网点/纯色带 → 0；有文字 → 数百到上万。
 * 返回 blob 数与 blob 占矩形比例，以及 blob 的最亮值。
 */
export function strokes(img, x0, y0, x1, y1, thr = 90) {
  const { W, H, rgba } = img
  const ax = Math.max(0, Math.floor(x0)), bx = Math.min(W, Math.ceil(x1))
  const ay = Math.max(0, Math.floor(y0)), by = Math.min(H, Math.ceil(y1))
  if (bx - ax < 3 || by - ay < 3) return { blob: 0, blobRatio: 0, peak: 0, n: 0 }
  const lum = (x, y) => {
    const i = (y * W + x) * 4
    return Math.max(rgba[i], rgba[i + 1], rgba[i + 2])
  }
  let blob = 0, peak = 0
  for (let y = ay + 1; y < by - 1; y++) {
    for (let x = ax + 1; x < bx - 1; x++) {
      const v = lum(x, y)
      if (v < thr) continue
      if (v > peak) peak = v
      if (lum(x + 1, y) >= thr || lum(x - 1, y) >= thr || lum(x, y + 1) >= thr || lum(x, y - 1) >= thr) blob++
    }
  }
  const n = (bx - ax - 2) * (by - ay - 2)
  return { blob, blobRatio: +(blob / n).toFixed(4), peak, n }
}

/**
 * 两帧的像素级差异：返回 (a) 平均 L1 通道差 (b) 差异超过 12 的像素占比。
 * 用途：与"空屏参考帧"比对，客观定位"画面上什么都没有"的窗口 ——
 * 不依赖任何 DOM 读数。
 */
export function diff(a, b) {
  if (a.W !== b.W || a.H !== b.H) throw new Error('size mismatch')
  const N = a.W * a.H
  let sum = 0, changed = 0
  for (let i = 0; i < N; i++) {
    const d =
      Math.abs(a.rgba[i * 4] - b.rgba[i * 4]) +
      Math.abs(a.rgba[i * 4 + 1] - b.rgba[i * 4 + 1]) +
      Math.abs(a.rgba[i * 4 + 2] - b.rgba[i * 4 + 2])
    sum += d
    if (d > 12) changed++
  }
  return { meanL1: +(sum / N).toFixed(3), changedRatio: +(changed / N).toFixed(5) }
}
