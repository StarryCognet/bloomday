new Promise(function (resolve) {
  var frame = document.querySelector('.gcard__frame')
  frame.click()
  setTimeout(function () {
    var v = document.getElementById('viewer')
    var img = document.getElementById('viewer-img')
    resolve({
      viewerOpen: v.classList.contains('is-open'),
      imgSrc: img.getAttribute('src'),
      natural: img.naturalWidth,
    })
  }, 1100)
})
