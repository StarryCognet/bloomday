// 1) 盖板放大后卡片有没有高度 2) 全局点击有没有火花 3) mv 底部色带是否已隐藏
new Promise(function (resolve) {
  var covered = document.querySelector('.gift__card.is-covered')
  covered.click()
  setTimeout(function () {
    var vc = document.getElementById('viewer-card')
    var cover = document.getElementById('viewer-cover')
    var before = window.__siteReport().ribbons
    // 在祝福幕正文上点一下 —— 不是律动幕，验证"全局"
    document.querySelector('.blk__line').dispatchEvent(
      new PointerEvent('pointerdown', { bubbles: true, clientX: 200, clientY: 400 }),
    )
    setTimeout(function () {
      var band = document.querySelector('.mv__slab--c')
      resolve({
        viewerCardH: Math.round(vc.getBoundingClientRect().height),
        viewerCardW: Math.round(vc.getBoundingClientRect().width),
        coverVisible: !cover.hidden,
        viewerOpen: document.getElementById('viewer').classList.contains('is-open'),
        ribbonsBefore: before,
        ribbonsAfter: window.__siteReport().ribbons,
        mvBandHidden: band ? getComputedStyle(band).display : 'missing',
      })
    }, 700)
  }, 1100)
})
