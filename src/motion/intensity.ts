/**
 * 动效强度：注入式的全局旋钮。
 *
 * 为什么不做成"内核去 import 站点配置"：那是依赖方向反了 ——
 * 动效库不该知道站点长什么样。所以这里持有一个可设的值，
 * 由站点入口在启动时注入（app.ts 调 setMotionStrength）。
 *
 * strength = 0 时，原语不播动画、直接落终态，常驻循环一律不启动；
 * 内容本身完全不受影响（这是"降级不等于缺内容"的底线）。
 */

let strength = 1

export function setMotionStrength(v: number): void {
  strength = Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 1
}

export function motionStrength(): number {
  return strength
}

/** 把全局强度乘进原语的 intensity 参数 */
export function amp(intensity: number): number {
  return intensity * strength
}

/** 是否跳过动画、直接落终态 */
export function skipMotion(): boolean {
  return strength <= 0.05
}

/** 常驻循环（呼吸/粒子）是否允许启动 */
export function allowResident(): boolean {
  return strength > 0.2
}
