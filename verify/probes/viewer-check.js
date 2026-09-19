new Promise(function (resolve) {
  var c = document.querySelector('.gift__card[data-i="1"]')
  if (!c) return resolve('NOT_FOUND')
  c.click()
  setTimeout(function () {
    var v = document.getElementById('gift-viewer')
    var img = document.getElementById('gift-viewer-img')
    var cov = document.getElementById('gift-viewer-cover')
    resolve({
      clickedDataI: c.getAttribute('data-i'),
      viewerOpen: v.classList.contains('is-open'),
      viewerImgSrc: img.getAttribute('src'),
      coverHidden: cov.hidden,
      coverText: cov.textContent.trim(),
      gift: window.__gift(),
    })
  }, 1000)
})
