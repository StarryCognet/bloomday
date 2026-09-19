// 点礼物盒 -> 盖子飞开 + 彩纸炸开 + 换一句话。读自检钩子确认。
new Promise(function (resolve) {
  var box = document.getElementById('gift-box')
  box.click()
  setTimeout(function () {
    resolve({
      gift: window.__gift ? window.__gift() : null,
      afterOpacity: getComputedStyle(document.getElementById('gift-after')).opacity,
      lineOpacity: getComputedStyle(document.getElementById('gift-line')).opacity,
    })
  }, 900)
})
