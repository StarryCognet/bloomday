// 点一下之后：应该已经在站内（封印 none），而且第二幕主视觉可见。
new Promise(function (resolve) {
  setTimeout(function () {
    resolve({
      sealDisplay: document.getElementById('seal').style.display,
      mvTitleOpacity: getComputedStyle(document.getElementById('mv-title')).opacity,
      mvDateText: document.getElementById('mv-date').textContent,
    })
  }, 1500)
})
