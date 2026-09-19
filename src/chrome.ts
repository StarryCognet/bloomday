/**
 * 常驻 UI 框架 —— 四角标记 + 顶部细导航 + 品牌条。
 *
 * 为什么做成"一次性挂载"而不是每个幕自己写：
 * P3R 官网那种"像界面而不像网页"的感觉，靠的就是**外框始终在**，
 * 内容在里面换。所以它是站点级的，不属于任何一幕。
 */
export interface ChromeHandle {
  /** 高亮第 index 个导航项（-1 = 全灭，用于开屏） */
  setActive(index: number): void
  show(): void
  hide(): void
  destroy(): void
}

export interface ChromeSection {
  label: string
}

export function createChrome(sections: ChromeSection[]): ChromeHandle {
  const root = document.createElement('div')
  root.className = 'chrome'
  root.id = 'chrome'
  root.setAttribute('aria-hidden', 'true')
  root.innerHTML = `
    <span class="chrome__corner chrome__corner--tl"></span>
    <span class="chrome__corner chrome__corner--tr"></span>
    <span class="chrome__corner chrome__corner--bl"></span>
    <span class="chrome__corner chrome__corner--br"></span>
    <span class="chrome__brand">BLOOMDAY</span>
    <nav class="chrome__nav">
      ${sections.map((s, i) => `<span data-i="${i}">${s.label}</span>`).join('')}
    </nav>
  `
  document.body.appendChild(root)

  const items = Array.from(root.querySelectorAll<HTMLElement>('.chrome__nav span'))
  // 初值不能跟 setActive(-1) 相同：setActive 开头有 index === active 的早退，
  // 写成 -1 的话开屏那次调用直接返回，is-idle 永远加不上 —— 开屏时外框不隐藏，
  // 会和封印自己的品牌字叠在一起（实测 .chrome__brand 透明度 0.75）。
  let active = Number.NaN

  return {
    setActive(index) {
      if (index === active) return
      active = index
      items.forEach((el, i) => el.classList.toggle('is-on', i === index))
      root.classList.toggle('is-idle', index < 0)
    },
    show() {
      root.classList.remove('is-hidden')
    },
    hide() {
      root.classList.add('is-hidden')
    },
    destroy() {
      root.remove()
    },
  }
}
