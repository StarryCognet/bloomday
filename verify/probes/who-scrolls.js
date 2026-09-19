// 分辨"到底是谁在滚"：window 还是 body。
new Promise(function (resolve) {
  for (var i = 0; i < 8; i++) {
    window.dispatchEvent(new WheelEvent('wheel', { deltaY: 700, bubbles: true, cancelable: true }))
  }
  setTimeout(function () {
    resolve({
      windowScrollY: Math.round(window.scrollY),
      bodyScrollTop: Math.round(document.body.scrollTop),
      scrollingElement: document.scrollingElement === document.documentElement ? 'html' : 'body',
      htmlScrollTop: Math.round(document.documentElement.scrollTop),
    })
  }, 1600)
})
