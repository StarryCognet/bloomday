new Promise(function (resolve) {
  var t = document.getElementById('gal-track')
  var before = Math.round(t.scrollLeft)
  var y0 = Math.round(window.scrollY)
  for (var i = 0; i < 6; i++) {
    t.dispatchEvent(new WheelEvent('wheel', { deltaX: 320, deltaY: 0, bubbles: true, cancelable: true }))
  }
  setTimeout(function () {
    resolve({
      trackScrollLeftBefore: before,
      trackScrollLeftAfter: Math.round(t.scrollLeft),
      horizontalMoved: Math.round(t.scrollLeft) - before,
      pageScrollYBefore: y0,
      pageScrollYAfter: Math.round(window.scrollY),
      overflowX: getComputedStyle(t).overflowX,
      touchAction: getComputedStyle(t).touchAction,
    })
  }, 1000)
})
