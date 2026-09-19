new Promise(function (resolve) {
  var card = document.querySelector('.gift__card.is-covered')
  var b = card.querySelector('.gift__cover b')
  var br = b.getBoundingClientRect()
  var cr = card.getBoundingClientRect()
  resolve({
    cardW: Math.round(cr.width),
    cardH: Math.round(cr.height),
    textW: Math.round(br.width),
    textH: Math.round(br.height),
    overflowsX: br.width > cr.width + 0.5,
    overflowsY: br.height > cr.height + 0.5,
    text: b.textContent,
  })
})
