// 进站后派发真实 wheel 事件，再读 scrollY。
// 走的是 Lenis 的 wheel 路径（她不检查 isTrusted），所以等同于她滚轮/触控板的行为。
new Promise(function (resolve) {
  for (var i = 0; i < 8; i++) {
    window.dispatchEvent(new WheelEvent('wheel', { deltaY: 700, bubbles: true, cancelable: true }))
  }
  setTimeout(function () {
    resolve(Math.round(window.scrollY))
  }, 1600)
})
