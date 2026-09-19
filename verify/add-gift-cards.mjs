/**
 * 礼物盒：点开后从盒里飞出四张图。
 * 第 2、3 张（索引 1、2）盖住不露内容，也不做任何解锁开关 —— 留给哥哥之后自己弄。
 */
import { readFileSync, writeFileSync } from 'node:fs'

let miss = 0
const patch = (file, pairs) => {
  let s = readFileSync(file, 'utf8')
  for (const [from, to] of pairs) {
    if (!s.includes(from)) {
      console.log(`MISS ${file}: ${from.split('\n')[0].slice(0, 60)}`)
      miss++
      continue
    }
    s = s.replace(from, to)
    console.log(`OK   ${file}: ${from.split('\n')[0].slice(0, 60)}`)
  }
  writeFileSync(file, s, 'utf8')
}

patch('src/site.config.ts', [
  [
    `      after: '拿好了。',
    },`,
    `      after: '拿好了。',
      /**
       * 盒子里飞出来的四张图。
       * hidden: true 的会被盖住、不露内容，而且**没有任何解锁开关** ——
       * 留给哥哥之后自己决定怎么揭。
       */
      cards: [
        { src: './gift/gift-1.jpg', hidden: false },
        { src: './gift/gift-2.jpg', hidden: true },
        { src: './gift/gift-3.jpg', hidden: true },
        { src: './gift/gift-4.jpg', hidden: false },
      ],
    },`,
  ],
])

patch('src/acts/gift.ts', [
  [
    `  const canvas = el.querySelector<HTMLCanvasElement>('#gift-cv')!`,
    `  const CARDS = SITE.copy.gift.cards
  const cardsHtml = CARDS.map(
    (c, i) => `<figure class="gift__card${c.hidden ? ' is-covered' : ''}" data-i="${i}">
        <img src="${c.src}" alt="" />
        ${c.hidden ? '<span class="gift__cover" aria-hidden="true"><b>?</b></span>' : ''}
      </figure>`,
  ).join('')

  const canvas = el.querySelector<HTMLCanvasElement>('#gift-cv')!`,
  ],
  [
    `      <p class="gift__line t-body" id="gift-line">\${SITE.copy.gift.line}</p>`,
    `      <div class="gift__cards" id="gift-cards">\${cardsHtml}</div>
      <p class="gift__line t-body" id="gift-line">\${SITE.copy.gift.line}</p>`,
  ],
  [
    `    gsap.to(lidEl, { y: -180, rotate: -26, duration: 0.7, ease: EASE.pop })`,
    `    // 四张图从盒里飞出来，摊成一把扇子
    const cards = Array.from(el.querySelectorAll<HTMLElement>('.gift__card'))
    cards.forEach((card, i) => {
      const off = i - (cards.length - 1) / 2
      gsap.fromTo(
        card,
        { opacity: 0, scale: 0.3, x: 0, y: 120, rotate: 0 },
        {
          opacity: 1,
          scale: 1,
          x: off * 74,
          y: -Math.abs(off) * 10,
          rotate: off * 11,
          duration: 0.72,
          delay: 0.1 + i * 0.075,
          ease: EASE.pop,
          transformOrigin: '50% 100%',
        },
      )
    })
    gsap.to(lidEl, { y: -180, rotate: -26, duration: 0.7, ease: EASE.pop })`,
  ],
  [
    `    opened,
    bits: bits.length,
    active,
    summary: \`礼物盒 · 打开 \${opened} 次 · 彩纸 \${bits.length} 片 · 当前幕=\${active}\`,`,
    `    opened,
    bits: bits.length,
    active,
    cards: el.querySelectorAll('.gift__card').length,
    covered: el.querySelectorAll('.gift__card.is-covered').length,
    summary: \`礼物盒 · 打开 \${opened} 次 · 彩纸 \${bits.length} 片 · 飞出 \${el.querySelectorAll('.gift__card').length} 张（盖住 \${el.querySelectorAll('.gift__card.is-covered').length} 张）· 当前幕=\${active}\`,`,
  ],
])

console.log(miss === 0 ? '\n替换成功' : `\n有 ${miss} 处未匹配`)
