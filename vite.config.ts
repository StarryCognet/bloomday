import { fileURLToPath } from 'node:url'
import { defineConfig, type Plugin } from 'vite'
import { tokenCss } from './src/tokens'

/** 相对本配置文件解析路径（ESM 下没有 __dirname） */
const page = (name: string): string => fileURLToPath(new URL(name, import.meta.url))

/**
 * 把 src/tokens.ts 里的 token 注入成 index.html 的 :root CSS 变量。
 * 为什么用插件而不是手写一份 tokens.css：手写就会出现两份真源，
 * 改一处漏一处。这里 DOM 与 Canvas 共用 src/tokens.ts 一个来源。
 * 改 tokens.ts → vite 会因 config 依赖变化自动重启 → 刷新即全站变色。
 */
function injectDesignTokens(): Plugin {
  return {
    name: 'bloomday:inject-design-tokens',
    transformIndexHtml(html: string) {
      const style = `<style id="bloomday-tokens">\n${tokenCss()}\n</style>`
      if (!html.includes('<!--TOKENS-->')) {
        throw new Error('index.html 缺少 <!--TOKENS--> 占位符，token 无法注入')
      }
      return html.replace('<!--TOKENS-->', style)
    },
  }
}

export default defineConfig({
  plugins: [injectDesignTokens()],
  // 相对路径：将来挂 GitHub Pages 子目录也能直接用
  base: './',
  server: { port: 5273, strictPort: true },
  build: {
    rollupOptions: {
      input: {
        // 站点本体
        main: page('index.html'),
        // 视觉地基核验板（已完成验收，保留可复跑）
        board: page('board.html'),
        // 原语演示页是长期保留的开发页，不是废件
        demo: page('demo.html'),
        // 粒子层测试页
        particles: page('particles.html'),
        // 幕间总控测试页
        acts: page('acts.html'),
      },
    },
  },
})
