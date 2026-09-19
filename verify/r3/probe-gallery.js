(async function () {
  // 点封印 -> 等转场 -> 滚到画廊 -> 读图与降级状态
  var cta = document.querySelector('.seal__cta')
  cta.click()
  await new Promise(function (r) { setTimeout(r, 2500) })
  window.scrollTo(0, 2757)
  await new Promise(function (r) { setTimeout(r, 1500) })
  var im = [].slice.call(document.querySelectorAll('.gcard img'))
  var g = null
  try { g = window.__gallery ? window.__gallery() : null } catch (e) { g = 'err:' + e.message }
  return {
    imgs: im.map(function (i) { return { src: i.getAttribute('src'), w: i.naturalWidth, disp: getComputedStyle(i).display } }),
    cards: document.querySelectorAll('.gcard').length,
    fallbackCards: document.querySelectorAll('.gcard.is-fallback').length,
    brokenVisible: im.filter(function (i) { return i.complete && i.naturalWidth === 0 && getComputedStyle(i).display !== 'none' }).length,
    galleryHook: g && typeof g === 'object' ? { cards: g.cards, loaded: g.loaded, fallback: g.fallback } : g,
    scrollY: Math.round(scrollY)
  }
})()
