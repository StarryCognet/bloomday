new Promise(function (resolve) {
  var e = document.getElementById('act-gift')
  var r = e.getBoundingClientRect()
  resolve({
    scrollY: Math.round(window.scrollY),
    top: Math.round(r.top),
    bottom: Math.round(r.bottom),
    vh: window.innerHeight,
    visibleRatio: Number((Math.min(r.bottom, window.innerHeight) - Math.max(r.top, 0) > 0 ? (Math.min(r.bottom, window.innerHeight) - Math.max(r.top, 0)) / r.height : 0).toFixed(3)),
    gift: window.__gift ? window.__gift() : null,
  })
})
