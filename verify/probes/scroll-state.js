// 进站后的滚动状态诊断：html 上的类名能直接说明 Lenis 是不是还处于 stopped。
new Promise(function (resolve) {
  setTimeout(function () {
    resolve([
      document.documentElement.className,
      document.documentElement.scrollHeight - window.innerHeight,
      getComputedStyle(document.documentElement).overflow,
      getComputedStyle(document.body).overflow,
      typeof window.__scrollTo,
    ])
  }, 1200)
})
