/**
 * 歌词层 —— 悬浮在屏幕下方，跟着 blessing.lrc 逐句切换（单行大字版）。
 *
 * 三条设计决定：
 *  1. **每句自己重建字符 span**，不用 SplitText —— 每句文本都不同，
 *     SplitText 的 chars 缓存会把新句拼成旧句的字符。
 *  2. **斜切底衬**：歌词要压在任意幕内容之上，没有底衬在某些背景上会读不清。
 *  3. **间奏淡出**：lrc 里的空行是间奏，此时整层淡出，不留上一句挂在屏幕上。
 */
import gsap from 'gsap'
import { EASE } from '../motion'
import { LYRICS, lineIndexAt } from '../lyrics-data'

export interface LyricsReport {
  lines: number
  index: number
  jp: string
  cn: string
  mode: 'showing' | 'gap' | 'idle'
  switches: number
  /** 当前句时间戳与播放位置的偏差（ms），用来证明"真的跟着歌走" */
  offsetMs: number
  audioTime: number
  summary: string
}

declare global {
  interface Window {
    __lyrics?: LyricsReport
  }
}

export interface LyricsLayerHandle {
  destroy(): void
  report(): LyricsReport
}

function buildChars(el: HTMLElement, text: string): HTMLElement[] {
  el.textContent = ''
  const out: HTMLElement[] = []
  for (const ch of text) {
    const s = document.createElement('span')
    s.className = 'lyr__c'
    s.textContent = ch === ' ' ? '\u00a0' : ch
    el.appendChild(s)
    out.push(s)
  }
  return out
}

export function createLyricsLayer(audio: HTMLAudioElement | null): LyricsLayerHandle {
  const root = document.createElement('div')
  root.className = 'lyr'
  root.id = 'lyr'
  root.setAttribute('aria-hidden', 'true')
  root.innerHTML = `
    <span class="lyr__scrim"></span>
    <span class="lyr__edge"></span>
    <div class="lyr__box">
      <p class="lyr__jp" id="lyr-jp"></p>
      <p class="lyr__cn" id="lyr-cn"></p>
    </div>
  `
  document.body.appendChild(root)

  const jpEl = root.querySelector<HTMLElement>('#lyr-jp')!
  const cnEl = root.querySelector<HTMLElement>('#lyr-cn')!
  const boxEl = root.querySelector<HTMLElement>('.lyr__box')!

  let index = -1
  let switches = 0
  let raf = 0
  let destroyed = false
  let lastTl: gsap.core.Timeline | null = null

  gsap.set(root, { opacity: 0 })

  function show(i: number): void {
    const line = LYRICS[i]
    if (!line) return
    lastTl?.kill()
    switches++

    const jpChars = buildChars(jpEl, line.jp)
    const cnChars = buildChars(cnEl, line.cn)
    gsap.set(root, { opacity: 1 })
    gsap.set(boxEl, { y: 0 })

    const tl = gsap.timeline()
    tl.fromTo(
      jpChars,
      { opacity: 0, y: 22, filter: 'blur(6px)' },
      {
        opacity: 1,
        y: 0,
        filter: 'blur(0px)',
        duration: 0.5,
        ease: EASE.slam,
        stagger: 0.028,
        clearProps: 'transform,opacity,filter',
      },
      0,
    )
    tl.fromTo(
      cnChars,
      { opacity: 0, y: 10 },
      { opacity: 1, y: 0, duration: 0.42, ease: EASE.drift, stagger: 0.012, clearProps: 'transform,opacity' },
      0.14,
    )
    lastTl = tl
  }

  function hide(): void {
    lastTl?.kill()
    lastTl = null
    gsap.to(boxEl, { y: 14, duration: 0.4, ease: EASE.sink })
    gsap.to(root, { opacity: 0, duration: 0.45, ease: EASE.sink })
  }

  function tick(): void {
    if (destroyed) return
    const t = audio?.currentTime ?? 0
    const i = lineIndexAt(t)
    if (i !== index) {
      index = i
      const line = i >= 0 ? LYRICS[i] : undefined
      if (line && line.jp) show(i)
      else hide()
    }
    if ((raf & 15) === 0) window.__lyrics = report()
    raf = requestAnimationFrame(tick)
  }

  function report(): LyricsReport {
    const t = audio?.currentTime ?? 0
    const line = index >= 0 ? LYRICS[index] : undefined
    const mode: LyricsReport['mode'] = !line ? 'idle' : line.jp ? 'showing' : 'gap'
    const offsetMs = line ? Math.round((t - line.t) * 1000) : -1
    return {
      lines: LYRICS.length,
      index,
      jp: line?.jp ?? '',
      cn: line?.cn ?? '',
      mode,
      switches,
      offsetMs,
      audioTime: Number(t.toFixed(2)),
      summary:
        `歌词 ${LYRICS.length} 行 · 当前 #${index}（${mode}）· 已切换 ${switches} 次 · ` +
        `播放位置 ${t.toFixed(2)}s / 本句时间戳 ${line ? line.t.toFixed(2) : '-'}s（偏差 ${offsetMs}ms）· ` +
        `词="${line?.jp ?? ''}"`,
    }
  }

  // 让验证工具能直接把播放头挪到某一句去核对
  ;(window as unknown as { __lyricsSeek?: (s: number) => void }).__lyricsSeek = (s: number) => {
    if (audio) audio.currentTime = s
  }

  raf = requestAnimationFrame(tick)

  return {
    destroy() {
      destroyed = true
      cancelAnimationFrame(raf)
      lastTl?.kill()
      root.remove()
    },
    report,
  }
}
