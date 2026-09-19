// 复现"鼠标停在图片上滚不动"：先滚到角色幕，再把 wheel 事件直接派发到轨道上。
new Promise(function (resolve) {
  for (var i = 0; i < 10; i++) {
    window.dispatchEvent(new WheelEvent('wheel', { deltaY: 700, bubbles: true, cancelable: true }))
  }
  setTimeout(function () {
    var before = Math.round(window.scrollY)
    var track = document.getElementById('gal-track')
    for (var j = 0; j < 6; j++) {
      track.dispatchEvent(new WheelEvent('wheel', { deltaY: 700, bubbles: true, cancelable: true }))
    }
    setTimeout(function () {
      resolve({
        before: before,
        after: Math.round(window.scrollY),
        movedOnImage: Math.round(window.scrollY) - before,
      })
    }, 1300)
  }, 1500)
})
