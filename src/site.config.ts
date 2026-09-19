/**
 * bloomday · 单一配置源
 *
 * 哥哥要改的所有东西都在这个文件里：换文案、换日期、换图、换歌、调动效强度。
 * 不需要读任何组件代码。
 *
 * 改完存盘即可（开发中是热更新，线上需要重新构建一次）。
 */

export interface GalleryItem {
  /** 图片路径。文件不存在时会自动降级成装饰占位卡，不会裂图、不会留空白 */
  src: string
  name: string
  note: string
  tag: string
}

export const SITE = {
  /* ── 1. 称呼、年龄、日期 ─────────────────────────────── */
  name: '妹妹',
  age: 12,
  /** 主视觉与封印上的大字日期 */
  dateLabel: '9.19',
  /** 收尾页的完整日期 */
  dateFull: '2026.9.19',

  /* ── 2. 歌 ───────────────────────────────────────────── */
  /** 把 mp3 放进 public/ 然后改这一行 */
  bgm: './blessing.mp3',

  /* ── 3. 角色 / 照片素材 ──────────────────────────────── */
  /** 把图放进 public/gallery/ 然后改这里的 src 与文案 */
  gallery: [
    // note 留空 = 只显示名字，等你想写什么再填（我不替你编她的事）
    { src: './gallery/makoto-01.jpg', name: '结城理', note: '', tag: 'MAKOTO 01' },
    { src: './gallery/makoto-02.jpg', name: '结城理', note: '', tag: 'MAKOTO 02' },
    { src: './gallery/makoto-03.jpg', name: '结城理', note: '', tag: 'MAKOTO 03' },
    { src: './gallery/makoto-04.jpg', name: '结城理', note: '', tag: 'MAKOTO 04' },
    { src: './gallery/makoto-05.jpg', name: '结城理', note: '', tag: 'MAKOTO 05' },
    { src: './gallery/makoto-06.jpg', name: '结城理', note: '', tag: 'MAKOTO 06' },
    { src: './gallery/makoto-07.jpg', name: '结城理', note: '', tag: 'MAKOTO 07' },
    { src: './gallery/makoto-08.jpg', name: '结城理', note: '', tag: 'MAKOTO 08' },
    { src: './gallery/makoto-09.jpg', name: '结城理', note: '', tag: 'MAKOTO 09' },
    { src: './gallery/makoto-10.jpg', name: '结城理', note: '', tag: 'MAKOTO 10' },
    { src: './gallery/makoto-11.jpg', name: '结城理', note: '', tag: 'MAKOTO 11' },
    { src: './gallery/makoto-12.jpg', name: '结城理', note: '', tag: 'MAKOTO 12' },
    { src: './gallery/makoto-13.jpg', name: '结城理', note: '', tag: 'MAKOTO 13' },
    { src: './gallery/makoto-14.jpg', name: '结城理', note: '', tag: 'MAKOTO 14' },
    { src: './gallery/makoto-15.jpg', name: '结城理', note: '', tag: 'MAKOTO 15' },
    { src: './gallery/makoto-16.jpg', name: '结城理', note: '', tag: 'MAKOTO 16' },
    { src: './gallery/makoto-17.jpg', name: '结城理', note: '', tag: 'MAKOTO 17' },
    { src: './gallery/makoto-18.jpg', name: '结城理', note: '', tag: 'MAKOTO 18' },
    { src: './gallery/makoto-19.jpg', name: '结城理', note: '', tag: 'MAKOTO 19' },
    { src: './gallery/makoto-20.jpg', name: '结城理', note: '', tag: 'MAKOTO 20' },
    { src: './gallery/makoto-21.jpg', name: '结城理', note: '', tag: 'MAKOTO 21' },
    { src: './gallery/makoto-22.jpg', name: '结城理', note: '', tag: 'MAKOTO 22' },
    { src: './gallery/makoto-23.jpg', name: '结城理', note: '', tag: 'MAKOTO 23' },
    { src: './gallery/makoto-24.jpg', name: '结城理', note: '', tag: 'MAKOTO 24' },
    { src: './gallery/makoto-25.jpg', name: '结城理', note: '', tag: 'MAKOTO 25' },
    { src: './gallery/makoto-26.jpg', name: '结城理', note: '', tag: 'MAKOTO 26' },
    { src: './gallery/makoto-27.jpg', name: '结城理', note: '', tag: 'MAKOTO 27' },
    { src: './gallery/makoto-28.jpg', name: '结城理', note: '', tag: 'MAKOTO 28' },
    { src: './gallery/makoto-29.jpg', name: '结城理', note: '', tag: 'MAKOTO 29' },
    { src: './gallery/makoto-30.jpg', name: '结城理', note: '', tag: 'MAKOTO 30' },
  ] as GalleryItem[],

  /* ── 4. 全部文案 ─────────────────────────────────────── */
  copy: {
    /** 第一幕 · 入场封印 */
    seal: {
      eyebrow: 'BLESSINGS FOR YOUR BIRTHDAY',
      cta: '点我开始',
      hint: '点一下，音乐就起来了',
    },

    /** 第二幕 · 生日主视觉 */
    mv: {
      eyebrow: 'SEPTEMBER 19',
      ageUnit: '岁',
      title: '生日快乐',
    },

    /** 第三幕 · 祝福文案（一段一个数组，段内每条一行） */
    blessing: {
      eyebrow: 'TO MY DEAREST SISTER',
      lead: '有些话，我一段一段说。',
      blocks: [
        ['生日快乐。'],
        ['12 岁。'],
        ['好好吃，好好睡，好好玩，好好学。'],
        ['今天你说了算。', '明天也算。', '后天可能不算。', '反正今天算。'],
        ['又长大一岁。'],
        ['但你还是我妹。'],
        ['生日快乐。'],
      ] as string[][],
    },

    /** 第四幕 · 跟着歌跳的可视化（让中间有一个视觉高点，不只是字） */
    pulse: {
      label: 'NOW PLAYING',
      line: '这段就交给歌。',
    },

    /** 第五幕 · 礼物盒（全程唯一一次"她做了一件事"） */
    gift: {
      label: 'ONE MORE THING',
      line: '还有个东西。点一下。',
      after: '拿好了。',
      /** 盖住的那两张上面写的字 */
      coverText: '等快递到了再揭晓',
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
    },

    /** 第四幕 · 角色与照片 */
    gallery: {
      eyebrow: 'HER FAVORITES',
      lead: '收集了一些结城理的优质图片，高清图找你哥要。',
      hint: '接着往下滑 · 图源 Pixiv，版权归原作者',
    },

    /** 第五幕 · 许愿收尾 */
    finale: {
      wish: '许个愿吧。',
      hb: '生日快乐',
      line: '不用说出来，说出来就不灵了。',
      sign: '—— 哥',
      /** 兜底提示：5 秒没被碰过才浮现 */
      fallbackHint: '点一下烛火',
    },
  },

  /* ── 5. 动效强度与降级开关 ───────────────────────────── */
  motion: {
    /** 0 ~ 1。手机发烫/卡顿就往下调；调到 0 全站基本不动，内容一个字不少 */
    strength: 1,
    /** 粒子背景层（还没接进主站，先留开关位） */
    particles: false,
    /** 强制最简：等价于 strength = 0 */
    reduced: false,
  },
} as const

/** 实际生效的动效强度（reduced 优先） */
export function effectiveStrength(): number {
  return SITE.motion.reduced ? 0 : SITE.motion.strength
}
