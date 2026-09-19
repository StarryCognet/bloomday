// 绕过 Lenis，直接原生滚动 —— 分辨"文档不能滚"还是"Lenis 挡着"。
new Promise(function (resolve) {
  window.scrollTo(0, 3000)
  setTimeout(function () {
    resolve([
      Math.round(window.scrollY),
      document.documentElement.clientHeight,
      document.documentElement.scrollHeight,
      getComputedStyle(document.documentElement).overflowY,
      getComputedStyle(document.body).overflowY,
      getComputedStyle(document.body).height,
    ])
  }, 600)
})
