// 在图片上滚 -> 页面往下走 + 画廊横向跟着走（钉住逻辑没被改坏）。
new Promise(function (resolve) {
  for (var i = 0; i < 10; i++) {
    window.dispatchEvent(new WheelEvent('wheel', { deltaY: 700, bubbles: true, cancelable: true }))
  }
  setTimeout(function () {
    var track = document.getElementById('gal-track')
    var a = { y: Math.round(window.scrollY), x: Math.round(track.scrollLeft) }
    for (var j = 0; j < 4; j++) {
      track.dispatchEvent(new WheelEvent('wheel', { deltaY: 700, bubbles: true, cancelable: true }))
    }
    setTimeout(function () {
      resolve({
        beforeY: a.y,
        beforeX: a.x,
        afterY: Math.round(window.scrollY),
        afterX: Math.round(track.scrollLeft),
        maxX: track.scrollWidth - track.clientWidth,
      })
    }, 1300)
  }, 1500)
})
