/**
 * 复用示例 —— 把「新增一幕复用原语，改动量 ≤3 行」这条验收标准钉成可核对的代码。
 *
 * 这不是网站的任何一幕（幕属于「叙事分幕与内容层」），只是一份 API 契约样本：
 * 下面三行就是全部代价，没有额外注册、没有初始化、没有清理代码要写。
 */
import { charSlam, ripple, slashWipe } from './index'

export function mountScene(root: HTMLElement): void {
  slashWipe(root, { direction: 'right', duration: 1.1, ease: 'tear' })
  charSlam(root.querySelector('.scene__title')!, { direction: 'up', intensity: 0.85 })
  root.addEventListener('pointerdown', () => ripple(root, { intensity: 0.7, rings: 3 }))
}
