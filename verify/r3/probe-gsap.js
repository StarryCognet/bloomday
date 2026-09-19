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
  var out = {}
  ;['#mv-date', '#mv-age', '#mv-title', '.mv__eyebrow'].forEach(function (sel) {
    var e = document.querySelector(sel)
    var cs = getComputedStyle(e)
    out[sel] = {
      eff: eff(e),
      inline: e.getAttribute('style') || '',
      gsapCache: (function () {
        try {
          var t = (window.gsap && gsap.getTweensOf) ? gsap.getTweensOf(e) : null
          return t ? t.length : 'no-gsap'
        } catch (err) { return 'err:' + err.message }
      })(),
      computedOpacity: cs.opacity,
      transition: cs.transition,
      animation: cs.animationName,
      chars: [].map.call(e.querySelectorAll ? e.querySelectorAll('.mt-char') : [], function (c) {
        return { t: c.textContent, inline: c.getAttribute('style') || '', op: getComputedStyle(c).opacity }
      }),
    }
  })
  return { at: Math.round(performance.now()), items: out }
})()
