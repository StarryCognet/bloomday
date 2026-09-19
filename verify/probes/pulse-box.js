new Promise(function (resolve) {
  var b = document.querySelector('.pulse__box')
  var r = b.getBoundingClientRect()
  resolve({
    op: getComputedStyle(b).opacity,
    top: Math.round(r.top),
    h: Math.round(r.height),
    text: b.textContent.trim(),
    lineColor: getComputedStyle(document.querySelector('.pulse__line')).color,
  })
})
