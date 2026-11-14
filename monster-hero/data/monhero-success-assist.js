// モンヒロサクセスのアシスト効果(モンサク専用)の表(第3版・2026-11-14 開発部 クラフトくん9)
// 案: docs/progress/player-raise/ASSIST-V3.md(第2版は ASSIST.md・TITLES.md §2)
//
// ★社長 2026-11-14:
//   ・「参考資料のアシスト効果で使えそうなのは全部入れて。オリジナルはオリジナルで残していい」
//     → 参考(docs/reference/line-mf/assist-effects.json)のうち今のモンサクに当てはまる物を全部入れた。名前は参考の呼び方
//       (今のオリジナルと中身が同じ物は1つにまとめ、id はそのまま)。オリジナルは名前もそのまま残した
//   ・条件つき(血統・オーラ・モン類)は入れない
//   ・「%は細かくポイントで上げられてもいい」→ 段1〜5 をやめて「目盛り」(1目盛りずつ ＋/−)。満タンの値段は第2版の約半分・1体8種類まで
// ★仕組みが無いので入れなかった物(上限アップ・EXトレ・モン類Lv・ノラモン など)は ASSIST-V3.md §1d
//
//   id    … 英小文字だけ(保存枠の子の assists:[{ id, lv, n }] に入る。第2版の id は変えない)
//   type  … with(いっしょ型: その子が集まったトレーニングでだけ・重なる)/ self(その子自身)/
//           stay(いるだけ型: 編成でいちばん大きい1つだけ)/ battle(試合型: いるだけ型と同じく1つだけ。育てる子の大会の試合で効く)
//   scene … 画面で並べる組(SCENES)/ ref … 参考にある物(true)かオリジナル(false)
//   max   … 目盛りの数 / pt … 1目盛りの値段 / unit … 1目盛りの効き目
//   v     … 目盛り1〜max の効き目(unit × 目盛り。試合型は第2版の段の数字)/ cost … 目盛り1〜max を取るのに要るポイント(合計)
//   text  … 説明の1行。{v} に効き目が入る / v2 … 第2版の段1〜5 の効き目(古い子の段を目盛りに読み替える)
//   from  … core(いつでも取れる)/ hint(お話のひらめきで候補に出る)/ buff … 試合型だけ: 目盛りごとの対戦の芯の buffs
(function (root) {
  'use strict';

  const fz = (o) => Object.freeze(o);
  const SCENES = Object.freeze([
    ['train', 'トレーニング'], ['stat', '能力ごと'], ['team', '編成・親密度'], ['start', 'はじめ'], ['care', '体力・ようす'],
    ['shugyo', '修行'], ['cup', '大会'], ['event', '出来事'], ['aid', '助手'], ['battle', '試合'],
  ].map(([key, name]) => fz({ key, name })));

  const STAT = [['pow', 'ちから'], ['wise', 'かしこさ'], ['hit', '命中'], ['eva', '回避'], ['tough', '丈夫さ'], ['life', 'ライフ']];
  const STAT_ICON = { pow: '💥', wise: '📘', hit: '🎯', eva: '💨', tough: '🛡', life: '❤' };
  const r3 = (x) => Math.round(x * 1000) / 1000;

  const L = [];
  // unit・max・pt から v と cost を作る(v を渡した物はそのまま。cost は pt × 目盛り)
  const add = (o) => {
    const v = Array.isArray(o.v) ? o.v.slice() : Array.from({ length: o.max }, (_, i) => r3((o.base || 0) + o.unit * (i + 1)));
    const cost = Array.from({ length: v.length }, (_, i) => o.pt * (i + 1));
    L.push(fz({ from: 'core', ref: true, ...o, max: v.length, v: Object.freeze(v), cost: Object.freeze(cost) }));
  };
  const T = (s) => `いっしょにトレーニングすると、${s}`;

  // ---- トレーニング(いっしょ型) ----
  add({ id: 'sokoji', icon: '🔥', name: 'トレ効果アップ', type: 'with', scene: 'train', unit: 1, max: 25, pt: 4, u: '%', v2: [5, 10, 15, 20, 25], text: T('伸びが{v}%上がる') });
  add({ id: 'kizuna', icon: '💞', name: '忠誠度効果アップ', type: 'with', scene: 'train', unit: 1, max: 20, pt: 5, u: '%', v2: [4, 8, 12, 16, 20], text: T('忠誠度が高いほど伸びが上がる(忠誠100で +{v}%)') });
  add({ id: 'hirameki', icon: '✨', name: '大成功率アップ', type: 'with', scene: 'train', unit: 1, max: 10, pt: 7, u: '点', v2: [2, 4, 6, 8, 10], text: T('大成功しやすくなる(+{v}点)') });
  add({ id: 'ochitsuki', icon: '🧘', name: '失敗率ダウン', type: 'with', scene: 'train', unit: 5, max: 10, pt: 7, u: '%', v2: [10, 20, 30, 40, 50], text: T('失敗しにくくなる(失敗の率 −{v}%)') });
  add({ id: 'itawari', icon: '🩹', name: '体力消費ダウン', type: 'with', scene: 'train', unit: 1, max: 25, pt: 3, u: '%', v2: [5, 10, 15, 20, 25], text: T('減る体力が{v}%少なくなる') });
  add({ id: 'ninzu', icon: '👥', name: 'トレ人数効果アップ', type: 'with', scene: 'train', unit: 1, max: 15, pt: 5, u: '%', text: 'この子のいるトレーニングに3体以上集まると、伸びがさらに{v}%上がる' });
  add({ id: 'trainlv', icon: '📶', name: 'トレレベルアップ', type: 'with', scene: 'train', unit: 1, max: 2, pt: 35, u: '', text: 'この子が来たトレーニングは、トレーニングLvが +{v} として伸びる(Lv5まで)' });
  add({ id: 'gyakkyo', icon: '🌧', name: '逆境トレレベルアップ', type: 'with', scene: 'train', unit: 1, max: 1, pt: 40, u: '', text: '成長のピークの外でこの子が来たトレーニングは、トレーニングLvが +{v} として伸びる(Lv5まで)' });
  add({ id: 'hagemi', icon: '🏅', name: 'トレ効果アップ・励', type: 'with', scene: 'train', unit: 1, max: 25, pt: 2, u: '%', text: T('賞金の合計が多いほど伸びが上がる(18,000G で +{v}%)') });
  [['haru', '🌸', '春', '3〜5月'], ['natsu', '☀', '夏', '6〜8月'], ['aki', '🍁', '秋', '9〜11月'], ['fuyu', '⛄', '冬', '12〜2月']].forEach(([id, icon, n, m]) =>
    add({ id, icon, name: `トレ効果アップ・${n}`, type: 'with', scene: 'train', unit: 2, max: 10, pt: 2, u: '%', text: T(`${m}のあいだ伸びが{v}%上がる`) }));
  add({ id: 'ninkigreat', icon: '📣', name: '人気度効果大成功アップ', type: 'with', scene: 'train', unit: 1, max: 14, pt: 3, u: '点', text: T('人気が高いほど大成功しやすくなる(人気100で +{v}点)') });
  add({ id: 'challenge', icon: '🎖', name: 'チャレンジ・幸運', type: 'with', scene: 'train', unit: 0.5, max: 3, pt: 13, u: '点', text: T('取った称号1つにつき大成功しやすくなる(+{v}点ずつ)') });
  add({ id: 'tsuika', icon: '➕', name: '追加トレボーナス', type: 'with', scene: 'train', unit: 2, max: 10, pt: 4, u: '%', text: T('{v}%で、あとからどれか1つの能力がさらに +5〜20') });
  add({ id: 'kaifuku', icon: '💧', name: 'トレ後回復効果アップ', type: 'with', scene: 'train', unit: 1, max: 10, pt: 4, u: '', text: T('トレーニングのあと体力が{v}回復する') });
  add({ id: 'atooshi', icon: '🎯', name: '得意の後押し', ref: false, type: 'with', scene: 'train', unit: 2, max: 15, pt: 5, u: '%', v2: [6, 12, 18, 24, 30], text: 'この子のいちばん高い能力のトレーニングに来ると、伸びが{v}%上がる' });
  add({ id: 'miharu', icon: '👀', name: '見張り役', ref: false, type: 'with', scene: 'train', unit: 5, max: 15, pt: 3, u: '%', v2: [15, 30, 45, 60, 75], text: T('サボりにくくなる(サボりの率 −{v}%)') });
  add({ id: 'kibarashi', icon: '🎈', name: '気晴らし', ref: false, type: 'with', scene: 'train', unit: 5, max: 10, pt: 4, u: '%', v2: [10, 20, 30, 40, 50], text: T('たまるストレスが{v}%少なくなる') });

  // ---- 能力ごと(いっしょ型・その能力のトレーニングに来たときだけ) ----
  STAT.forEach(([k, n]) => add({ id: `kun${k}`, icon: STAT_ICON[k], name: `${n}アップ`, type: 'with', scene: 'stat', unit: 2, max: 15, pt: 3, u: '%', stat: k, v2: [6, 12, 18, 24, 30],
    text: `この子が「${n}」のトレーニングにいっしょに来ると、伸びが{v}%上がる` }));

  // ---- 編成・親密度 ----
  add({ id: 'kaketsuke', icon: '📯', name: '得意率アップ', type: 'self', scene: 'team', unit: 1, max: 20, pt: 4, u: '点', v2: [4, 8, 12, 16, 20], text: 'この子が得意なトレーニングに来やすくなる(得意率 +{v}点・90%まで)' });
  add({ id: 'shutsugen', icon: '🚪', name: 'トレーニング出現率アップ', type: 'self', scene: 'team', unit: 1, max: 15, pt: 3, u: '点', text: 'この子がトレーニングに来ない率が{v}点下がる(はじめは15%)' });
  add({ id: 'shitashi', icon: '🌱', name: '初期親密度アップ', type: 'self', scene: 'team', unit: 1, max: 25, pt: 2, u: '', v2: [5, 10, 15, 20, 25], text: 'この子のはじめの親密度が +{v}' });
  add({ id: 'tagpow', icon: '⚡', name: '応援効果アップ', type: 'with', scene: 'team', unit: 1, max: 15, pt: 5, u: '%', v2: [3, 6, 9, 12, 15], text: 'この子が友情タッグになったとき、タッグの強さが +{v}%' });
  add({ id: 'hitonatsu', icon: '🤝', name: '人なつっこさ', ref: false, type: 'stay', scene: 'team', base: 1, unit: 0.05, max: 10, pt: 7, u: '倍', v2: [1.1, 1.2, 1.3, 1.4, 1.5],
    start: Object.freeze(Array.from({ length: 10 }, (_, i) => Math.round(1.5 * (i + 1)))), text: '編成にいるだけで、みんなの親密度の上がりが{v}倍(この子のはじめの親密度も +{start})' });
  add({ id: 'nakayoshi', icon: '🫶', name: '仲よし特訓', ref: false, type: 'with', scene: 'team', unit: 1, max: 5, pt: 8, u: '', v2: [1, 2, 3, 4, 5], text: T('親密度の上がりが +{v}') });
  add({ id: 'shitsuke', icon: '📏', name: 'しつけ上手', ref: false, type: 'stay', scene: 'team', unit: 1, max: 25, pt: 3, u: '%', v2: [5, 10, 15, 20, 25], text: '編成にいるだけで、褒める・叱るで上がる忠誠度が{v}%増える' });

  // ---- はじめ ----
  add({ id: 'shoki', icon: '🌅', name: '初期ステータスアップ', type: 'stay', scene: 'start', unit: 5, max: 10, pt: 7, u: '', text: '編成にいるだけで、育てる子の6つの能力がはじめから +{v}' });
  add({ id: 'ticket0', icon: '🎟', name: '修行チケットボーナス', type: 'stay', scene: 'start', unit: 1, max: 1, pt: 40, u: '枚', text: '編成にいるだけで、育成のはじめに修行チケットが +{v}枚' });
  add({ id: 'tairyoku', icon: '🔋', name: '体力自慢', ref: false, type: 'stay', scene: 'start', unit: 2, max: 10, pt: 4, u: '', v2: [4, 8, 12, 16, 20], text: '編成にいるだけで、育てる子の体力の上限が初めから +{v}' });

  // ---- 体力・ようす ----
  add({ id: 'kuishinbo', icon: '🍙', name: '大会後ご褒美アップ', type: 'stay', scene: 'care', unit: 1, max: 25, pt: 2, u: '%', v2: [5, 10, 15, 20, 25], text: '編成にいるだけで、大会のあとのごはんの効き目が{v}%増える' });
  add({ id: 'trchance', icon: '🎲', name: 'トレーニングチャンス', type: 'stay', scene: 'care', unit: 5, max: 10, pt: 4, u: '%', text: '編成にいるだけで、遊んだとき{v}%で「ひらめき」(次のトレーニングが大成功しやすい)になる' });
  add({ id: 'shchance', icon: '🔮', name: '修行チャンス', type: 'stay', scene: 'care', unit: 5, max: 10, pt: 4, u: '%', text: '編成にいるだけで、遊んだとき{v}%で「修行の気合い」(次の修行の伸び +20%)になる' });
  add({ id: 'gussuri', icon: '💤', name: 'ぐっすり', ref: false, type: 'stay', scene: 'care', unit: 1, max: 25, pt: 2, u: '%', v2: [5, 10, 15, 20, 25], text: '編成にいるだけで、休んだときの体力の回復が{v}%増える' });
  add({ id: 'asobi', icon: '🪁', name: '遊び上手', ref: false, type: 'stay', scene: 'care', unit: 2, max: 25, pt: 2, u: '%', v2: [10, 20, 30, 40, 50], text: '編成にいるだけで、遊んだときの体力の回復と甘え度の上がりが{v}%増える' });
  add({ id: 'tsukisoi', icon: '🏥', name: '通院の付きそい', ref: false, type: 'stay', scene: 'care', unit: 2, max: 15, pt: 3, u: '点', v2: [6, 12, 18, 24, 30], text: '編成にいるだけで、通院で治りやすくなる(+{v}点)' });
  add({ id: 'genki', icon: '🍀', name: '元気のお守り', ref: false, type: 'stay', scene: 'care', unit: 2, max: 25, pt: 2, u: '%', v2: [10, 20, 30, 40, 50], text: '編成にいるだけで、けがや悪いようすになりにくくなる(なる率 −{v}%)' });

  // ---- 修行 ----
  add({ id: 'shugyo', icon: '⚔', name: '修行効果アップ', type: 'stay', scene: 'shugyo', unit: 1, max: 25, pt: 3, u: '%', v2: [5, 10, 15, 20, 25], text: '編成にいるだけで、修行の伸びと熟練の上がりが{v}%上がる' });
  add({ id: 'shugyotoku', icon: '🗡', name: '修行特別効果アップ', type: 'stay', scene: 'shugyo', unit: 1, max: 10, pt: 5, u: '', text: '編成にいるだけで、修行で上がる能力がそれぞれ +{v}' });
  add({ id: 'waza', icon: '📖', name: '技習得率アップ', type: 'stay', scene: 'shugyo', unit: 1, max: 10, pt: 5, u: '%', text: '編成にいるだけで、修行で技を覚える率が +{v}%' });
  add({ id: 'chokyo', icon: '🌋', name: '超修行アップ', type: 'stay', scene: 'shugyo', unit: 1, max: 1, pt: 50, u: '回', text: '編成にいるだけで、超修行できる回数が +{v}回' });
  add({ id: 'wazakazu', icon: '📚', name: '技習得効果アップ', type: 'stay', scene: 'shugyo', unit: 0.5, max: 4, pt: 10, u: '%', text: '編成にいるだけで、覚えた技1つにつき修行の伸びが +{v}%' });
  add({ id: 'shugyohp', icon: '🍃', name: '修行の体力消費ダウン', type: 'stay', scene: 'shugyo', unit: 1, max: 15, pt: 3, u: '%', text: '編成にいるだけで、修行で減る体力が{v}%少なくなる' });
  add({ id: 'aptq', icon: '🧭', name: '適性アップ', type: 'stay', scene: 'shugyo', unit: 1, max: 10, pt: 4, u: '%', text: '編成にいるだけで、修行で間合いの適性が上がる率が +{v}%(はじめは10%)' });

  // ---- 大会 ----
  add({ id: 'shokin', icon: '💰', name: '大会賞金効果アップ', type: 'stay', scene: 'cup', unit: 1, max: 25, pt: 2, u: '%', v2: [5, 10, 15, 20, 25], text: '編成にいるだけで、大会の賞金が{v}%増える' });
  add({ id: 'ikioi', icon: '💹', name: '賞金の勢い', type: 'stay', scene: 'cup', unit: 1, max: 10, pt: 4, u: '点', text: '編成にいるだけで、賞金の合計が多いほどトレーニングで大成功しやすくなる(18,000G で +{v}点)' });
  add({ id: 'ninki', icon: '🌟', name: '人気度効果アップ', type: 'stay', scene: 'cup', unit: 2, max: 25, pt: 2, u: '%', v2: [10, 20, 30, 40, 50], text: '編成にいるだけで、人気の上がりが{v}%増える' });
  add({ id: 'kokoroe', icon: '📜', name: '勝負の心得', ref: false, type: 'stay', scene: 'cup', unit: 1, max: 25, pt: 3, u: '%', v2: [5, 10, 15, 20, 25], text: '編成にいるだけで、大会で勝ったときの能力ポイントが{v}%増える' });
  add({ id: 'ticket', icon: '🎫', name: 'チケット運', ref: false, type: 'stay', scene: 'cup', unit: 5, max: 10, pt: 4, u: '%', v2: [10, 20, 30, 40, 50], text: '編成にいるだけで、大会に勝ったとき{v}%で修行チケットがもう1枚もらえる' });
  add({ id: 'rivaldamashii', icon: '🏁', name: 'ライバル魂', ref: false, type: 'stay', scene: 'cup', unit: 5, max: 10, pt: 4, u: '%', v2: [10, 20, 30, 40, 50], text: '編成にいるだけで、ライバルに勝ったときのごほうび(全能力)が{v}%増える' });

  // ---- 出来事・イッサ博士 ----
  add({ id: 'event', icon: '🎉', name: 'イベント効果アップ', type: 'stay', scene: 'event', unit: 3, max: 10, pt: 5, u: '%', text: '編成にいるだけで、出来事で上がる能力が{v}%増える' });
  add({ id: 'peak', icon: '📈', name: 'ピークターンアップ', type: 'stay', scene: 'event', unit: 1, max: 2, pt: 25, u: 'ターン', text: '編成にいるだけで、成長のピークが終わったあとも{v}ターン、ピークの伸びが続く' });
  add({ id: 'yobimizu', icon: '💬', name: '出来事の呼び水', ref: false, type: 'stay', scene: 'event', unit: 1, max: 15, pt: 5, u: '点', v2: [3, 6, 9, 12, 15], text: '編成にいるだけで、編成の子との出来事が起きやすくなる(+{v}点)' });
  add({ id: 'mejirushi', icon: '🧪', name: '博士の目じるし', ref: false, type: 'stay', scene: 'event', unit: 0.5, max: 5, pt: 8, u: '点', v2: [0.5, 1, 1.5, 2, 2.5], text: '編成にいるだけで、イッサ博士が来やすくなる(1ターン +{v}点)' });
  add({ id: 'joshu', icon: '🔬', name: '博士の助手', ref: false, type: 'stay', scene: 'event', unit: 1, max: 10, pt: 7, u: '点', v2: [2, 4, 6, 8, 10], text: '編成にいるだけで、イッサ博士の実験が成功しやすくなる(+{v}点)' });

  // ---- 助手(参考の「ブリーダー」を助手に当てた) ----
  add({ id: 'aidcome', icon: '🙋', name: '助手の出現率アップ', type: 'stay', scene: 'aid', unit: 1, max: 20, pt: 3, u: '点', text: '編成にいるだけで、助手がトレーニングに来る率が +{v}点(はじめは60%)' });
  add({ id: 'aidtrain', icon: '🏋', name: '助手・鍛錬', type: 'stay', scene: 'aid', unit: 1, max: 25, pt: 3, u: '%', text: '編成にいるだけで、助手が来たトレーニングの伸びが{v}%上がる' });
  add({ id: 'aidluck', icon: '🌈', name: '助手・幸運', type: 'stay', scene: 'aid', unit: 1, max: 10, pt: 6, u: '点', text: '編成にいるだけで、助手が来たトレーニングが大成功しやすくなる(+{v}点)' });
  add({ id: 'aidtrust', icon: '🤲', name: '助手・信頼', type: 'stay', scene: 'aid', unit: 2, max: 25, pt: 2, u: '%', text: '編成にいるだけで、助手が来たトレーニングで忠誠度の効き目が{v}%増える' });
  add({ id: 'aidkeisho', icon: '🔗', name: '助手・継承', type: 'stay', scene: 'aid', unit: 1, max: 1, pt: 80, u: '', text: '助手が来たトレーニングに、この子が来ていなくても、この子のいっしょ型の効果が効く(編成で1体まで)' });

  // ---- お話のひらめき(試合型・社長 2026-11-12「試合の中で効く形」)。いい結末で見終えると引退のときの候補に並ぶ ----
  //   目盛り5つ(第2版の段と同じ数字)。buff は対戦の芯 ASSISTANT_MASMON_BATTLE.simulate の buffs.A に入る形(#5722)
  const hint = (o) => add({ ...o, type: 'battle', scene: 'battle', ref: false, pt: 12, from: 'hint', v2: o.v });
  hint({ id: 'gatsu', icon: '💪', name: '試合のはじめのガッツ', aid: 'atsu', u: '', v: [2, 4, 6, 8, 10],
    buff: [{ guts: 2 }, { guts: 4 }, { guts: 6 }, { guts: 8 }, { guts: 10 }], text: '編成にいるだけで、大会の試合のはじめのガッツが +{v}' });
  hint({ id: 'miseba', icon: '🎤', name: '見せ場', aid: 'momosuke', u: '%', v: [2, 4, 6, 8, 10],
    buff: [{ crit: 0.02 }, { crit: 0.04 }, { crit: 0.06 }, { crit: 0.08 }, { crit: 0.1 }], text: '編成にいるだけで、大会の試合で会心が出やすくなる(+{v}%)' });
  hint({ id: 'mitate', icon: '🔍', name: '見立て', aid: 'kyuko', u: '%', v: [2, 4, 6, 8, 10],
    buff: [{ eva: 0.02 }, { eva: 0.04 }, { eva: 0.06 }, { eva: 0.08 }, { eva: 0.1 }], text: '編成にいるだけで、大会の試合で相手の攻撃をよけやすくなる(相手の命中 −{v}%)' });
  hint({ id: 'kensho', icon: '📐', name: '検証', aid: 'sorashido', u: '%', v: [10, 20, 30, 40, 50],
    buff: [{ missCut: 0.1 }, { missCut: 0.2 }, { missCut: 0.3 }, { missCut: 0.4 }, { missCut: 0.5 }], text: '編成にいるだけで、大会の試合で技が外れにくくなる(外れる率 −{v}%)' });
  hint({ id: 'mimamori', icon: '🌙', name: '見守り', aid: 'erubin', u: '%', v: [4, 8, 12, 16, 20],
    buff: [{ hit1: 0.04 }, { hit1: 0.08 }, { hit1: 0.12 }, { hit1: 0.16 }, { hit1: 0.2, noSulk: true }],
    text: '編成にいるだけで、大会の試合の最初の攻撃が当たりやすくなる(+{v}%)',
    text5: '編成にいるだけで、大会の試合の最初の攻撃が当たりやすくなり(+{v}%)、言うことを聞かない番も出ない' });

  const LIST = Object.freeze(L);
  const BY_ID = Object.freeze(Object.fromEntries(LIST.map(a => [a.id, a])));
  const TYPE_NAME = Object.freeze({ with: 'いっしょ', self: '自分', stay: 'いるだけ', battle: '試合' });
  const VERSION = 3;
  const LV_MAX = Math.max(...LIST.map(a => a.max)); // 目盛りのいちばん多い数(保存の読み込みの上限)
  const MAX_KINDS = 8;          // 1体に8種類まで(社長 2026-11-14)
  const POINTS_MIN = 20, POINTS_MAX = 400, POINTS_DIV = 50; // ポイント = 切り捨て(総合力 ÷ 50)・20〜400(芯の assistPointsOf)
  // 「おまかせ」: この順に5目盛りずつ配る。ひらめきの候補があれば先頭
  const AUTO_ORDER = Object.freeze(['sokoji', 'kizuna', 'hirameki', 'kaketsuke', 'shugyo', 'hitonatsu', 'atooshi', 'ninzu']);
  const AUTO_STEP = 5;

  const num = (v, d = 0) => (Number.isFinite(Number(v)) ? Number(v) : d);
  const nOf = (id, n) => { const a = BY_ID[id]; return a ? Math.min(a.max, Math.max(1, Math.round(num(n, 1)))) : 0; };

  // 保存の読み替え(CLAUDE.md ⑦): { id, n } があれば目盛り n。n が無い古い子(第2版の段 lv 1〜5)は「その段の効き目に届く最小の目盛り」
  //   第2版に無い id は lv をそのまま目盛りにする。どれも目盛りの数で頭打ち
  const fromSaved = (p) => {
    const a = p && typeof p === 'object' ? BY_ID[p.id] : null; if (!a) return 0;
    if (Number.isFinite(Number(p.n)) && p.n !== null && p.n !== '') return nOf(a.id, p.n);
    const lv = Math.min(5, Math.max(1, Math.round(num(p.lv, 1))));
    if (!a.v2) return nOf(a.id, lv);
    const want = a.v2[lv - 1] - 1e-9; const i = a.v.findIndex(x => x >= want);
    return i < 0 ? a.max : i + 1;
  };
  // 書くときの形: 古い版のアプリでも読めるように、いちばん近い段 lv(第2版の段で、効き目を超えない最大)も残す
  const toSaved = (id, n) => {
    const a = BY_ID[id]; if (!a) return null; const k = nOf(id, n); const val = a.v[k - 1];
    let lv = 1; if (a.v2) a.v2.forEach((x, i) => { if (x <= val + 1e-9) lv = i + 1; }); else lv = Math.min(5, k);
    return { id, lv, n: k };
  };

  const fmt = (x) => String(Math.round(x * 100) / 100);
  // 説明の1行(目盛りつき)。例: describe('sokoji', 12) → 'いっしょにトレーニングすると、伸びが12%上がる'
  const describe = (id, n) => {
    const a = BY_ID[id]; if (!a) return '';
    const i = nOf(id, n) - 1;
    return ((i === a.max - 1 && a.text5) || a.text).replace('{v}', fmt(a.v[i])).replace('{start}', a.start ? String(a.start[i]) : '');
  };
  const valueText = (id, n) => { const a = BY_ID[id]; if (!a) return ''; const x = a.v[nOf(id, n) - 1]; return a.u === '倍' ? `×${fmt(x)}` : `+${fmt(x)}${a.u || ''}`; };
  const label = (id, n) => { const a = BY_ID[id]; return a ? `${a.icon} ${a.name} ${valueText(id, n)}` : ''; };
  const costOf = (id, n) => { const a = BY_ID[id]; return a && n >= 1 ? a.cost[nOf(id, n) - 1] : 0; };
  const valueOf = (id, n) => { const a = BY_ID[id]; return a && n >= 1 ? a.v[nOf(id, n) - 1] : 0; };

  // 候補(引退のとき並べる札)。hints は芯の s.hints(type:'assist' の name がひらめきの名前)
  const candidates = (hints) => {
    const names = new Set((Array.isArray(hints) ? hints : []).filter(h => h && h.type === 'assist').map(h => h.name));
    return LIST.filter(a => a.from === 'core' || names.has(a.name));
  };

  // 取ったものを確かめる: 知らない id を捨て・目盛りは1〜max・8種類まで・値段の合計が pts を超えたら外す。出す形は { id, n }
  const normPicks = (list, pts) => {
    const cap = Math.min(POINTS_MAX, Math.max(0, num(pts)));
    const out = []; const seen = {}; let used = 0;
    for (const p of Array.isArray(list) ? list : []) {
      const id = p && typeof p === 'object' ? p.id : null;
      if (!BY_ID[id] || seen[id] || out.length >= MAX_KINDS) continue;
      const n = fromSaved(p); const c = costOf(id, n);
      if (used + c > cap) continue;
      out.push({ id, n }); seen[id] = true; used += c;
    }
    return { picks: out, used, left: cap - used };
  };

  // おまかせ: AUTO_ORDER(ひらめきの候補を先頭)の順に5目盛りずつ配り、配れなくなったら1目盛りずつ。残りは表の順
  const autoPick = (pts, hints) => {
    const cand = candidates(hints).map(a => a.id);
    const order = [...cand.filter(id => BY_ID[id].from === 'hint'), ...AUTO_ORDER.filter(id => cand.includes(id))];
    cand.forEach(id => { if (!order.includes(id)) order.push(id); });
    const cap = Math.min(POINTS_MAX, Math.max(0, num(pts)));
    const n = {}; let left = cap;
    for (const step of [AUTO_STEP, 1]) for (let changed = true; changed;) {
      changed = false;
      for (const id of order) {
        const a = BY_ID[id]; const now = n[id] || 0; if (now >= a.max) continue;
        if (!now && Object.keys(n).length >= MAX_KINDS) continue;
        const k = Math.min(step, a.max - now); const c = k * a.pt; if (c > left) continue;
        n[id] = now + k; left -= c; changed = true;
      }
    }
    return normPicks(order.filter(id => n[id]).map(id => ({ id, n: n[id] })), cap);
  };

  // 試合で効く分(battle 型)を、対戦の芯の buffs.A の形にまとめる。team = 編成の子の assists の配列の配列
  const BUFF_RANGE = Object.freeze({ guts: [0, 50], hit1: [0, 0.5], crit: [0, 0.5], missCut: [0, 1], eva: [0, 0.5] });
  const battleBuffs = (team, extra) => {
    const top = {};
    for (const list of Array.isArray(team) ? team : []) for (const p of Array.isArray(list) ? list : []) {
      const a = p && BY_ID[p.id]; if (!a || a.type !== 'battle') continue;
      top[a.id] = Math.max(top[a.id] || 0, fromSaved(p));
    }
    const out = {};
    const put = (b) => Object.keys(b || {}).forEach(k => {
      if (k === 'noSulk') { if (b[k] === true) out.noSulk = true; return; }
      const r = BUFF_RANGE[k]; const x = Number(b[k]); if (!r || !Number.isFinite(x)) return;
      const v = Math.min(r[1], Math.max(r[0], (out[k] || 0) + x));
      out[k] = k === 'guts' ? Math.round(v) : Math.round(v * 1000) / 1000;
    });
    Object.keys(top).forEach(id => put(BY_ID[id].buff[top[id] - 1]));
    if (extra && typeof extra === 'object') put(extra);
    return out;
  };

  // いるだけ型の効き目: 編成でいちばん大きい目盛りの効き目(無ければ 0)
  const stayValue = (team, id) => {
    let best = 0;
    for (const list of Array.isArray(team) ? team : []) for (const p of Array.isArray(list) ? list : []) if (p && p.id === id) best = Math.max(best, fromSaved(p));
    return best ? valueOf(id, best) : 0;
  };

  const pointsOf = (power) => Math.min(POINTS_MAX, Math.max(POINTS_MIN, Math.floor(num(power) / POINTS_DIV)));

  const api = Object.freeze({ VERSION, LIST, BY_ID, TYPE_NAME, SCENES, LV_MAX, MAX_KINDS, POINTS_MIN, POINTS_MAX, AUTO_ORDER, AUTO_STEP,
    describe, label, valueText, costOf, valueOf, candidates, normPicks, autoPick, pointsOf, battleBuffs, stayValue, fromSaved, toSaved });
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.MONHERO_SUCCESS_ASSIST = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
