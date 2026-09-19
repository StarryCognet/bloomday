// Lenis 的内部状态：limit 是 0 的话，它会每帧把滚动钉回 0，表现为"完全滚不动"。
new Promise(function (resolve) {
  setTimeout(function () {
    var l = window.__lenis
    if (!l) return resolve('no __lenis')
    resolve({
      limit: Math.round(l.limit),
      animatedScroll: Math.round(l.animatedScroll),
      targetScroll: Math.round(l.targetScroll),
      isStopped: l.isStopped,
      isSmooth: l.isSmooth,
      dimensions: l.dimensions
        ? {
            scrollHeight: Math.round(l.dimensions.scrollHeight),
            height: Math.round(l.dimensions.height),
            limit: Math.round(l.dimensions.limit),
          }
        : null,
    })
  }, 1200)
})
