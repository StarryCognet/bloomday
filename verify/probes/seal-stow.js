// 第一拍/第二拍的状态：文字藏没藏、提示显没显。
new Promise(function (resolve) {
  setTimeout(function () {
    resolve({
      stowed: document.getElementById('seal').classList.contains('is-stowed'),
      logoOpacity: getComputedStyle(document.querySelector('.seal__logo')).opacity,
      tapOpacity: getComputedStyle(document.querySelector('.seal__tap')).opacity,
      ctaOpacity: getComputedStyle(document.querySelector('.seal__cta')).opacity,
    })
  }, 900)
})
