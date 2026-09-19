/**
 * blessing.lrc 的解析结果 —— 时间戳（秒）+ 日文原文 + 中文翻译。
 *
 * 来源：哥哥提供的 blessing.lrc（halyosy「Blessing」）。
 * 空字符串表示这一行是间奏/空拍 —— 歌词层据此淡出，不要留上一句在屏幕上。
 *
 * 改歌词只改这个文件；时间戳别动，那是跟歌对好的。
 */
export interface LyricLine {
  /** 秒 */
  t: number
  /** 日文原文（空 = 间奏） */
  jp: string
  /** 中文翻译 */
  cn: string
}

export const LYRICS: LyricLine[] = [
  { t: 1.103, jp: 'Blessings for your birthday', cn: '祝你生日快乐' },
  { t: 3.814, jp: 'Blessings for your everyday', cn: '祝你每一天都好' },
  { t: 6.023, jp: '最後の一秒まで前を向け', cn: '直到最后一秒，都要向前看' },
  { t: 13.053, jp: '', cn: '' },

  { t: 19.414, jp: '剥がしても何故だか増えてくタグと', cn: '撕掉了却不知为何越贴越多的标签' },
  { t: 23.671, jp: 'ランク付けされてく理不尽な価値', cn: '还有被排好序的、不讲道理的价值' },
  { t: 28.036, jp: 'そんな数値で人を推し量らないでと', cn: '「别用那种数字去衡量一个人」' },
  { t: 32.333, jp: '飛び交う言葉を手で覆い隠した', cn: '那些飞来飞去的话，我用手捂住了' },
  { t: 33.746, jp: '', cn: '' },

  { t: 36.619, jp: "Oh... It's time to get up 灯火を消す前に", cn: '在灯火熄灭之前' },
  { t: 40.827, jp: "Oh... It's time to get up 足元を照らせ！", cn: '照亮你的脚下！' },
  { t: 45.129, jp: 'ほらここをじっと見つめてみて', cn: '来，盯着这里看一看' },
  { t: 49.505, jp: '最高の味方が映ってるでしょ？', cn: '映着的，是你最好的伙伴吧？' },
  { t: 53.584, jp: 'それは命の証', cn: '那就是生命的证明' },
  { t: 55.168, jp: '', cn: '' },

  { t: 57.73, jp: 'Blessings for your birthday', cn: '祝你生日快乐' },
  { t: 60.502, jp: 'Blessings for your everyday', cn: '祝你每一天都好' },
  { t: 62.657, jp: '例え明日世界が滅んでも', cn: '就算明天世界就要毁灭' },
  { t: 66.617, jp: 'Blessings for your birthday', cn: '祝你生日快乐' },
  { t: 69.154, jp: 'Blessings for your everyday', cn: '祝你每一天都好' },
  { t: 71.462, jp: '最後の一秒まで前を向け', cn: '直到最后一秒，都要向前看' },
  { t: 73.015, jp: '', cn: '' },

  { t: 75.639, jp: 'Hip hip HOORAY これから先も', cn: 'Hip hip HOORAY 从今往后也是' },
  { t: 80.001, jp: 'Hip hip HOORAY 君に幸あれ', cn: 'Hip hip HOORAY 祝你好运' },
  { t: 81.882, jp: '', cn: '' },

  { t: 93.246, jp: 'ゼロからイチを生むのは容易くない事', cn: '从零生出一，从来都不容易' },
  { t: 97.79, jp: '肝心な物は見えないし触れない事', cn: '最要紧的东西，看不见也摸不着' },
  { t: 102.156, jp: '不幸とは幸せだと気づけない事', cn: '所谓不幸，是察觉不到自己有多幸福' },
  { t: 106.497, jp: '毎日が誕生日で命日な事', cn: '每一天，都既是生日也是忌日' },
  { t: 108.384, jp: '', cn: '' },

  { t: 110.781, jp: 'Oh... Stand up take action 泥沼を掻き分けて', cn: '拨开泥沼' },
  { t: 115.068, jp: 'Oh... Stand up take action 蓮の花は咲く', cn: '莲花会开' },
  { t: 119.445, jp: 'ほらここに手を重ねてみて', cn: '来，把手叠在这里试试' },
  { t: 123.593, jp: '温もりが伝わってくるでしょ？', cn: '暖意传过来了吧？' },
  { t: 127.774, jp: 'それは命の証', cn: '那就是生命的证明' },
  { t: 130.172, jp: '', cn: '' },

  { t: 131.917, jp: 'Blessings for your birthday', cn: '祝你生日快乐' },
  { t: 134.684, jp: 'Blessings for your everyday', cn: '祝你每一天都好' },
  { t: 136.858, jp: '例え綺麗事だって構わない', cn: '就算是漂亮话，也没关系' },
  { t: 140.713, jp: 'Blessings for your birthday', cn: '祝你生日快乐' },
  { t: 143.378, jp: 'Blessings for your everyday', cn: '祝你每一天都好' },
  { t: 145.55, jp: 'この世に産まれてくれてありがとう', cn: '谢谢你来到这个世界' },
  { t: 148.515, jp: '', cn: '' },

  { t: 149.758, jp: 'Hip hip HOORAY これから先も', cn: 'Hip hip HOORAY 从今往后也是' },
  { t: 154.095, jp: 'Hip hip HOORAY 君に幸あれ', cn: 'Hip hip HOORAY 祝你好运' },
  { t: 156.689, jp: '', cn: '' },

  { t: 158.799, jp: 'さぁさ寄ってらっしゃい見てらっしゃい', cn: '来呀，都过来看看呀' },
  { t: 160.471, jp: '', cn: '' },
  { t: 161.411, jp: 'ロックでいったらこんな風', cn: '要说摇滚，是这个样子' },
  { t: 163.67, jp: 'Like this Like this Yeah', cn: '就像这样，就像这样' },
  { t: 165.626, jp: 'アカペラでいったらこんな風', cn: '要说清唱，是这个样子' },
  { t: 167.996, jp: 'Like this Like this Yeah', cn: '就像这样，就像这样' },
  { t: 170.144, jp: 'ゲームでいったらこんな風', cn: '要说游戏，是这个样子' },
  { t: 172.554, jp: 'Like this Like this Yeah', cn: '就像这样，就像这样' },
  { t: 174.549, jp: 'ダンスでいったらこんな風', cn: '要说跳舞，是这个样子' },
  { t: 176.728, jp: 'Da da da da da', cn: '哒 哒 哒 哒 哒' },
  { t: 177.893, jp: '', cn: '' },

  { t: 178.362, jp: 'よく食べて よく眠って よく遊んで よく学んで', cn: '好好吃，好好睡，好好玩，好好学' },
  { t: 182.988, jp: 'よく喋って よく喧嘩して ごく普通な毎日を', cn: '好好聊，好好吵，过普普通通的每一天' },
  { t: 187.465, jp: '泣けなくても 笑えなくても 歌えなくても 何もなくても', cn: '就算哭不出来、笑不出来、唱不出来、什么都没有' },
  { t: 191.677, jp: '愛せなくても 愛されなくても それでも生きて欲しい', cn: '就算爱不了人、也无人爱 —— 我还是希望你能活着' },
  { t: 193.162, jp: '', cn: '' },

  { t: 195.311, jp: 'Blessings for your birthday', cn: '祝你生日快乐' },
  { t: 197.927, jp: 'Blessings for your everyday', cn: '祝你每一天都好' },
  { t: 200.091, jp: '例え明日世界が滅んでも', cn: '就算明天世界就要毁灭' },
  { t: 204.032, jp: 'Blessings for your birthday', cn: '祝你生日快乐' },
  { t: 206.613, jp: 'Blessings for your everyday', cn: '祝你每一天都好' },
  { t: 208.835, jp: '最後の一秒まで前を向け', cn: '直到最后一秒，都要向前看' },
  { t: 211.19, jp: '', cn: '' },

  { t: 213.824, jp: "If you're alive あの子が振り向くかも", cn: '只要你还活着，那个人也许会回头' },
  { t: 216.117, jp: "If you're alive 宝くじ当たるかも", cn: '只要你还活着，彩票也许会中' },
  { t: 218.189, jp: "If you're alive 再び始まるかも", cn: '只要你还活着，也许会重新开始' },
  { t: 220.405, jp: '生き抜くためなら', cn: '如果是为了活下去' },
  {
    t: 222.141,
    jp: '棒に振れ 水を差せ 煙に捲け 油を売れ 現を抜かせ',
    cn: '白费就白费，泼冷水就泼冷水，被糊弄就被糊弄，摸鱼就摸鱼，走神就走神',
  },
  { t: 226.546, jp: 'そして 来週も 来月も 来年も 来世も 一緒に祝おう', cn: '然后 —— 下周、下月、明年、下辈子，都一起庆祝吧' },
  { t: 229.258, jp: '', cn: '' },

  { t: 230.169, jp: 'Blessings for your birthday', cn: '祝你生日快乐' },
  { t: 232.866, jp: 'Blessings for your everyday', cn: '祝你每一天都好' },
  { t: 235.083, jp: '例え綺麗事だって構わない', cn: '就算是漂亮话，也没关系' },
  { t: 238.844, jp: 'Blessings for your birthday', cn: '祝你生日快乐' },
  { t: 241.534, jp: 'Blessings for your everyday', cn: '祝你每一天都好' },
  { t: 243.808, jp: 'ここに集えた奇跡にありがとう', cn: '谢谢能聚在这里的奇迹' },
  { t: 245.469, jp: '', cn: '' },

  { t: 247.962, jp: 'Hip hip HOORAY これから先も', cn: 'Hip hip HOORAY 从今往后也是' },
  { t: 252.249, jp: 'Hip hip HOORAY 君に幸あれ', cn: 'Hip hip HOORAY 祝你好运' },
  { t: 256.627, jp: 'Hip hip HOORAY これから先も', cn: 'Hip hip HOORAY 从今往后也是' },
  { t: 261.027, jp: 'Hip hip HOORAY 君に幸あれ', cn: 'Hip hip HOORAY 祝你好运' },
  { t: 265.35, jp: 'Hip hip HOORAY', cn: 'Hip hip HOORAY' },
]

/** 找到 currentTime 对应的那一行；返回 -1 表示还没到第一句 */
export function lineIndexAt(seconds: number): number {
  let lo = 0
  let hi = LYRICS.length - 1
  let found = -1
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    const t = LYRICS[mid]?.t ?? 0
    if (t <= seconds) {
      found = mid
      lo = mid + 1
    } else {
      hi = mid - 1
    }
  }
  return found
}
