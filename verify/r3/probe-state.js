(function () {
  function eff(el) {
    var op = 1, c = el
    while (c && c !== document.documentElement) {
      var s = getComputedStyle(c)
      if (s.display === 'none' || s.visibility === 'hidden') return 0
      op *= Number(s.opacity)
      if (op <= 0.0001) return 0
      c = c.parentElement
    }
    return +op.toFixed(4)
  }
  var seal = document.getElementById('seal')
  var items = [
    ['seal-inner', document.getElementById('seal-inner')],
    ['seal-date', document.getElementById('seal-date')],
    ['seal-cta', document.querySelector('.seal__cta-text')],
    ['mv-eyebrow', document.querySelector('.mv__eyebrow')],
    ['mv-date', document.getElementById('mv-date')],
    ['mv-age', document.getElementById('mv-age')],
    ['mv-age-unit', document.querySelector('.mv__age-unit')],
    ['mv-title', document.getElementById('mv-title')],
  ]
  var out = {}
  items.forEach(function (it) {
    var e = it[1]
    out[it[0]] = e ? { eff: eff(e), inline: e.getAttribute('style') || '', rect: (function () { var r = e.getBoundingClientRect(); return [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)] })() } : null
  })
  return {
    injectedStrength: window.__siteReport ? window.__siteReport().config.injectedStrength : null,
    summary: window.__siteSummary ? window.__siteSummary() : null,
    seal: { display: getComputedStyle(seal).display, opacity: getComputedStyle(seal).opacity, zIndex: getComputedStyle(seal).zIndex },
    scrollLocked: document.documentElement.classList.contains('is-sealed'),
    scrollY: Math.round(scrollY),
    dotPatternTop: getComputedStyle(document.body).backgroundColor,
    items: out,
  }
})()
