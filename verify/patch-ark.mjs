/** 改造 public/ark：关掉 90° 旋转，竖屏改成"铺满裁左右"，不再把画面躺倒。 */
import { readFileSync, writeFileSync } from 'node:fs'

const F = 'public/ark/app.js'
let s = readFileSync(F, 'utf8')
let miss = 0
const rep = (from, to) => {
  if (!s.includes(from)) {
    console.log('MISS: ' + from.split('\n')[0].slice(0, 70))
    miss++
    return
  }
  s = s.replace(from, to)
  console.log('OK  : ' + from.split('\n')[0].slice(0, 70))
}

rep(
  `  const scale = portrait
    ? Math.min(width / sceneHeight, height / sceneWidth)
    : Math.min(width / sceneWidth, height / sceneHeight);`,
  `  // 原版竖屏是把 16:9 舞台转 90° 塞进 9:16 —— 结果整个画面躺倒，而且没有任何提示。
  // 改成：竖屏不旋转，用"铺满"裁掉左右，画面正着看；横屏仍是完整 16:9。
  const scale = portrait
    ? Math.max(width / sceneWidth, height / sceneHeight)
    : Math.min(width / sceneWidth, height / sceneHeight);`,
)

rep(
  `  scaler.style.setProperty("--stage-rotation", portrait ? "90deg" : "0deg");`,
  `  scaler.style.setProperty("--stage-rotation", "0deg");`,
)

writeFileSync(F, s, 'utf8')
console.log(miss === 0 ? '\napp.js 替换成功' : `\n有 ${miss} 处未匹配`)
