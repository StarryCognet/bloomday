(function(){
  var r = window.__siteReport();
  return {
    rendered: r.rendered,
    config: { name: r.config.name, age: r.config.age, dateLabel: r.config.dateLabel, dateFull: r.config.dateFull, bgm: r.config.bgm, gallerySrcs: r.config.gallerySrcs, configuredStrength: r.config.configuredStrength, injectedStrength: r.config.injectedStrength },
    peakMovingTweens: r.peakMovingTweens,
    summary: window.__siteSummary(),
    imgs: [].map.call(document.querySelectorAll('.gcard img'), function(i){ return {src:i.getAttribute('src'), complete:i.complete, w:i.naturalWidth} }),
    cards: document.querySelectorAll('.gcard').length,
    brokenVisible: [].filter.call(document.querySelectorAll('.gcard img'), function(i){ return i.complete && i.naturalWidth === 0 }).length
  };
})()