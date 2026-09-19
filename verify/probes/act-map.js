// 各幕的位置 + 总高，用来决定滚多少才能到新加的两幕。
new Promise(function (resolve) {
  setTimeout(function () {
    var ids = ['act-mv','act-blessing','act-pulse','act-gift','act-gallery','act-finale']
    var out = {}
    ids.forEach(function (id) {
      var e = document.getElementById(id)
      out[id] = e ? Math.round(e.offsetTop) : null
    })
    out.total = Math.round(document.documentElement.scrollHeight - window.innerHeight)
    resolve(out)
  }, 1000)
})
