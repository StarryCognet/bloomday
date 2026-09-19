// 关键：块**还在视口里**时，行的 opacity 应该是 1。
// 修复前是 0 —— 那正是"看不见文字，滚过去才显示"的症状。
new Promise(function (resolve) {
  setTimeout(function () {
    var out = []
    ;['b1', 'b2', 'b4'].forEach(function (id) {
      var blk = document.querySelector('[data-blk="' + id + '"]')
      if (!blk) return
      var r = blk.getBoundingClientRect()
      var line = blk.querySelector('.blk__line')
      out.push({
        id: id,
        inView: r.top < window.innerHeight && r.bottom > 0,
        lineOpacity: getComputedStyle(line).opacity,
        text: (line.textContent || '').slice(0, 10),
      })
    })
    resolve(out)
  }, 1400)
})
