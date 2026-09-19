/**
 * 粒子层测试页 —— 只为「粒子背景层」这一小类取证：
 *   ?mood=calm|rise|celebrate|finale
 *   ?off=1     不启用粒子层（对照组）
 *   ?fps=1     自动跑「开/关各滑 2s」的帧率对比并打印比值
 *   ?tier=low|mid|high  强制设备档，验证粒子上限
 * 减弱动态效果由 CDP Emulation.setEmulatedMedia 强制，不靠代码假装。
 */
import { particleLayer, type ParticleLayerHandle, type ParticleMood } from './motion/particles'

const params = new URLSearchParams(location.search)

const app = document.querySelector<HTMLDivElement>('#app')
if (!app) throw new Error('#app 不存在')

app.innerHTML = `
  <canvas id="particles"></canvas>
  <div class="page">
    <div class="bar">
      <div class="bar__stats" id="stats">启动中…</div>
      <div class="bar__acts">
        <button class="btn" data-mood="calm">calm</button>
        <button class="btn" data-mood="rise">rise</button>
        <button class="btn" data-mood="celebrate">celebrate</button>
        <button class="btn" data-mood="finale">finale</button>
        <button class="btn btn--ghost" id="btn-toggle">关闭粒子层</button>
        <button class="btn btn--ghost" id="btn-fps">开/关帧率对比</button>
      </div>
      <pre class="report" id="report">就绪。</pre>
    </div>
    <h1 class="t-hero">9.19</h1>
    <p class="t-body">粒子层是整场演出的底色。这一段正文专门用来看对比度：
      光点绝不能盖住字，也不能让字看起来发灰。</p>
    ${Array.from({ length: 14 })
      .map(
        (_, i) => `<p class="t-body">第 ${i + 1} 段。妹妹点开链接以后，会一路往下看：
      这一段是用来产生真实滚动负载的填充文本，同时充当对比度检查的样本。</p>`,
      )
      .join('')}
    <p class="t-label">BLESSINGS FOR YOUR BIRTHDAY</p>
  </div>
`

const statsEl = document.querySelector<HTMLElement>('#stats')!
const reportEl = document.querySelector<HTMLElement>('#report')!
const canvas = document.querySelector<HTMLCanvasElement>('#particles')!
const errors: string[] = []
window.addEventListener('error', (e) => errors.push(e.message))

const handle: ParticleLayerHandle = particleLayer(canvas, {
  mood: (params.get('mood') as ParticleMood | null) ?? 'calm',
  tier: (params.get('tier') as 'low' | 'mid' | 'high' | null) ?? undefined,
})

if (params.get('off') === '1') handle.setEnabled(false)

function renderStats(extra = ''): void {
  statsEl.innerHTML =
    `设备档 <b>${handle.tier}</b> · 粒子数 <b>${handle.count}</b> · ` +
    `情绪 <b>${handle.getMood()}</b> · 状态 <b>${handle.isEnabled() ? '开' : '关'}</b> · ` +
    `减弱动效 <b>${handle.reducedMotion ? '是' : '否'}</b> · 错误 <b>${errors.length}</b>${extra}`
}
renderStats()

document.querySelectorAll<HTMLButtonElement>('[data-mood]').forEach((btn) => {
  btn.addEventListener('click', () => {
    handle.setMood(btn.dataset.mood as ParticleMood)
    renderStats()
  })
})

const toggleBtn = document.querySelector<HTMLButtonElement>('#btn-toggle')!
toggleBtn.addEventListener('click', () => {
  handle.setEnabled(!handle.isEnabled())
  toggleBtn.textContent = handle.isEnabled() ? '关闭粒子层' : '开启粒子层'
  renderStats()
})

/* ── 真实滚动负载下的帧率测量 ─────────────────────────────
   不是"页面静止时数 rAF"——那测不出粒子层的代价。
   这里在测量期间用 rAF 驱动 scrollTop 来回滚，制造真实的重绘/合成负载。 */
function measureFps(ms: number, scroll: boolean): Promise<number> {
  return new Promise((resolve) => {
    let frames = 0
    const t0 = performance.now()
    let dir = 1
    const maxScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight)
    let y = window.scrollY

    const loop = (): void => {
      frames++
      if (scroll) {
        y += dir * 26
        if (y >= maxScroll) {
          y = maxScroll
          dir = -1
        } else if (y <= 0) {
          y = 0
          dir = 1
        }
        window.scrollTo(0, y)
      }
      const dt = performance.now() - t0
      if (dt >= ms) resolve(Math.round((frames / dt) * 1000))
      else requestAnimationFrame(loop)
    }
    requestAnimationFrame(loop)
  })
}

async function compareFps(): Promise<void> {
  reportEl.textContent = '测量中：粒子层 ON，滚动负载 2s…'
  handle.setEnabled(true)
  await new Promise((r) => setTimeout(r, 300))
  const on = await measureFps(2000, true)

  reportEl.textContent = '测量中：粒子层 OFF，滚动负载 2s…'
  handle.setEnabled(false)
  await new Promise((r) => setTimeout(r, 300))
  const off = await measureFps(2000, true)

  handle.setEnabled(true)
  window.scrollTo(0, 0)
  const ratio = off > 0 ? (on / off) * 100 : 0
  const pass = ratio >= 90
  reportEl.innerHTML =
    `粒子层 ON  <em>${on} fps</em>（${handle.count} 粒子 / ${handle.tier} 档）\n` +
    `粒子层 OFF ${off} fps\n` +
    `比值 ${ratio.toFixed(1)}% ${pass ? '<em>≥90% PASS</em>' : '<s>&lt;90% FAIL</s>'} · 滚动负载 2s × 2，视口 ${window.innerWidth}x${window.innerHeight} dpr${devicePixelRatio}`
  renderStats()
  document.title = 'fps-done'
}

document.querySelector('#btn-fps')?.addEventListener('click', () => {
  void compareFps()
})

if (params.get('fps') === '1') {
  void compareFps()
}

if (errors.length) reportEl.textContent += `\n⚠ ${errors.join('\n')}`
