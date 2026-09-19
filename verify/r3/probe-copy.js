(async function () {
  // 标准 3 独立回归：文案/字号/几何/溢出/触控尺寸 + 全站滚动几何
  var cta = document.querySelector('.seal__cta')
  cta.click()
  await new Promise(function (r) { setTimeout(r, 2600) })
  var out = { viewport: [innerWidth, innerHeight], acts: {} }
  var max = document.documentElement.scrollHeight - innerHeight
  out.scrollMax = Math.round(max)
  out.overflowX = document.documentElement.scrollWidth > document.documentElement.clientWidth
  // 逐屏取几何
  for (var y = 0; y <= max; y += 200) {
    window.scrollTo(0, y)
    await new Promise(function (r) { requestAnimationFrame(function () { requestAnimationFrame(r) }) })
  }
  window.scrollTo(0, 0)
  await new Promise(function (r) { setTimeout(r, 800) })

  function box(sel) {
    var e = document.querySelector(sel)
    if (!e) return null
    var r = e.getBoundingClientRect()
    var cs = getComputedStyle(e)
    return { rect: [Math.round(r.left), Math.round(r.top + scrollY), Math.round(r.width), Math.round(r.height)], fs: Math.round(parseFloat(cs.fontSize)), color: cs.color, op: cs.opacity }
  }
  out.geom = {
    sealDate: box('#seal-date'),
    mvDate: box('#mv-date'),
    mvAge: box('#mv-age'),
    mvTitle: box('#mv-title'),
    finSign: box('#fin-sign'),
    finDate: box('#fin-date'),
  }
  // 触控目标尺寸（所有可点元素 >= 44px 高）
  out.smallTargets = [].filter.call(document.querySelectorAll('button,[role=button],a'), function (e) {
    var r = e.getBoundingClientRect()
    return r.width > 0 && (r.height < 44 || r.width < 44)
  }).map(function (e) { return (e.id || e.className) + ' ' + Math.round(e.getBoundingClientRect().width) + 'x' + Math.round(e.getBoundingClientRect().height) })
  // 文案一致性（对照站点配置渲染值）
  var rep = window.__siteReport()
  out.text = {
    sealGreeting: rep.rendered.sealGreeting,
    sealCta: rep.rendered.sealCta,
    mvDate: rep.rendered.mvDate,
    mvAge: rep.rendered.mvAge,
    mvTitle: rep.rendered.mvTitle,
    blessingBlocks: rep.rendered.blessingBlocks,
    blessingChars: rep.rendered.blessingChars,
    galleryCards: rep.rendered.galleryCards,
    finaleSign: rep.rendered.finaleSign,
    finaleDate: rep.rendered.finaleDate,
  }
  out.mv = window.__mv || null
  out.summary = window.__siteSummary()
  return out
})()
