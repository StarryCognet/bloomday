new Promise(function (resolve) {
  var e = document.getElementById('act-gift')
  var r = e.getBoundingClientRect()
  resolve({
    scrollY: Math.round(window.scrollY),
    rectTop: Math.round(r.top),
    rectBottom: Math.round(r.bottom),
    vh: window.innerHeight,
    actH: Math.round(e.offsetHeight),
    gift: window.__gift ? window.__gift() : null,
  })
})
