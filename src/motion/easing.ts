/**
 * 统一缓动曲线集合 —— 全站动画只准从这里取曲线，禁止各幕自己写 cubic-bezier。
 * 两条自定义曲线用 CustomEase 落地（GSAP 3.13 起全插件免费）。
 */
import gsap from 'gsap'
import { CustomEase } from 'gsap/CustomEase'

gsap.registerPlugin(CustomEase)

/** 注册失败不白屏：记下来，演示页会把错误打在读数里 */
export const easeErrors: string[] = []

function create(name: string, path: string, fallback: string): string {
  try {
    CustomEase.create(name, path)
    return name
  } catch (err) {
    easeErrors.push(`CustomEase ${name} 注册失败，已回退 ${fallback}: ${(err as Error).message}`)
    return fallback
  }
}

export const EASE = {
  /** 撕入：极快起步、几乎瞬间咬住 —— 斜切色块扫过（用 GSAP 五次方，比 drift 明显更凶） */
  tear: 'power4.out',
  /** 冲击：过冲回弹 —— 逐字落点，P3 的"砸下来"手感。集合里唯一的自定义曲线 */
  slam: create('bloomSlam', 'M0,0 C0.12,0 0.16,1.18 0.48,1.04 0.76,0.97 0.88,1 1,1', 'back.out(2)'),
  /** 呼吸：两端平滑 —— 常驻循环 */
  breathe: 'sine.inOut',
  /** 漂移：长尾减速 —— 视差、粒子 */
  drift: 'power2.out',
  /** 沉降：加速离开 —— 退场专用（原先集合里缺这一条，导致调用方硬写 'power2.in'） */
  sink: 'power2.in',
  /** 弹起：轻过冲 */
  pop: 'back.out(1.7)',
  /** 弹簧：真正的往复回弹 —— 点击放大、卡片按压回弹 */
  spring: 'elastic.out(1, 0.45)',
  /** 急停：开头极快，立即咬住 */
  snap: 'expo.out',
  linear: 'none',
} as const

export type EaseName = keyof typeof EASE

export const EASE_NAMES = Object.keys(EASE) as EaseName[]

/** 取缓动在进度 t 处的值，供演示页把曲线画出来（也能拿来比对"手感差异"） */
export function easeValue(name: EaseName, t: number): number {
  const fn = gsap.parseEase(EASE[name])
  return typeof fn === 'function' ? fn(t) : t
}
