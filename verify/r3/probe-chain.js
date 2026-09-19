(function () {
  function chain(el) {
    var out = [], c = el
    while (c && c !== document.documentElement) {
      var cs = getComputedStyle(c)
      out.push({
        sel: c.id ? '#' + c.id : ('.' + (c.className || '').toString().trim().split(/\s+/)[0]),
        op: cs.opacity,
        disp: cs.display,
        vis: cs.visibility,
        inline: (c.getAttribute('style') || '').slice(0, 120),
      })
      c = c.parentElement
    }
    return out
  }
  function eff(el) { var op = 1, c = el; while (c && c !== document.documentElement) { var s = getComputedStyle(c); if (s.display === 'none' || s.visibility === 'hidden') return 0; op *= Number(s.opacity); if (op <= 0.0001) return 0; c = c.parentElement } return +op.toFixed(4) }
  var out = {}
  ;[['mv-date', '#mv-date'], ['mv-age', '#mv-age'], ['mv-title', '#mv-title'], ['mv-eyebrow', '.mv__eyebrow']].forEach(function (p) {
    var e = document.querySelector(p[1])
    out[p[0]] = e ? { eff: eff(e), computed: getComputedStyle(e).opacity, chain: chain(e) } : null
  })
  out.at = Math.round(performance.now())
  return out
})()
