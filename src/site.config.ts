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
      lead: '有些话，我想一段一段说给你听。',
      blocks: [
        ['希望你在未来的新一岁里，', '想笑就大声笑，想哭就放心哭，'],
        [
          '喜欢的角色一直追到结局，喜欢的歌一直循环到腻，',
          '好好吃饭，好好睡觉，好好玩，好好学——',
          '像歌里唱的那样，把每一天都过成自己的生日。',
        ],
        ['不用急着长大，也不用活成谁的标准答案。', '在哥哥这里，你永远有不用解释的特权。'],
        ['然后，我想跟你说说「以后」。'],
        [
          '以后考砸了，第一个来找我，我陪你一起骂那张卷子；',
          '以后被人欺负了，告诉我，我去；你不想说，我也不逼你，我就在旁边站着；',
          '以后你越长越高，总有哪天会比我高，那时候换你罩我；',
          '以后你想去很远的地方，我不拦你，我只问一句「钱够不够」；',
        ],
        [
          '再往后，你会有自己的朋友、自己的生活、自己的秘密，',
          '可能不会什么都跟我说了——没关系，我只要你过得好。',
        ],
        ['但有一件事，我希望永远不变：', '不管过多少年，你收到我的消息，还是会笑着回我一句「哥」。'],
      ] as string[][],
    },

    /** 第四幕 · 角色与照片 */
    gallery: {
      eyebrow: 'HER FAVORITES',
      lead: '收集了一些结城理的优质图片，高清图找你哥要。',
      hint: '接着往下滑',
    },

    /** 第五幕 · 许愿收尾 */
    finale: {
      wish: '许个愿吧。',
      hb: '生日快乐',
      line: '愿你的世界里，永远有光照亮。',
      sign: '—— 永远爱你的哥哥',
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
