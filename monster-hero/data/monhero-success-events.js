// モンヒロサクセスのランダムイベント(EVENTS.md 第8版の ①③④⑤⑥小さな賭け⑦⑧・約60種)の「起きる仕組み」(2026-11-12 開発部)
// 案: docs/progress/player-raise/EVENTS.md §1〜§9 / 台詞: docs/progress/player-raise/script/random.js(場面のid = この表の id)
//
// ★画面なし・保存の新しいキーなし・印なし。計算の芯(monhero-success.js)が create() の中でこの部品を作り、SUC.events として出す。
//   芯の内部の関数(能力を足す・忠誠を足す など)は芯から渡してもらう(写さない)。
// ★React・window・localStorage・Date・Math.random を使わない。乱数は「育成の id + ターン + すき間」から作る決まった乱数だけ。
//   出た出来事は s.ev.pend に残すので、選ぶ前に閉じても同じ出来事・同じ選択肢がもう一度出る。結果も決まった乱数(引き直せない)。
// ★助手の連続イベント(②)は芯の storyDue / storyStep、イッサ博士(⑥大きな賭け)は芯の issa、編成の子とのトレーニングイベントは芯の trainEvent。
//   ここはそれ以外のすき間の出来事だけ。
//
// 画面からの呼び方(1ターン):
//   r = SUC.events.open(s, 'start')            ターンのはじめ(行動の前)。r.out.ev が null でなければ出す → SUC.events.pick(s, 'a')
//   (行動・叱る/褒める)
//   r = SUC.events.open(s, 'after')            トレーニングの結果のあと(編成の出来事)
//   r = SUC.events.open(s, 'cup', { won, kind })  大会の結果のあと(settle の out.won・out.kind)
//   SUC.events.buffs(s)                         メイン画面の小さな印(ひとときの状態)
//   台詞(台本エンジン MONHERO_SUCCESS_SCRIPT): event(ev.lines, ctx) で出し、選んだら event(out.next)・確率の結果は event(out.scene)。
//   ctx の cheer / cheer2 には ev.cheerName / ev.cheer2Name、train には ev.train の能力名、cup には ev.cup を入れる
//
// 結果の書き方(fx): [項目, 対象, 大きさ] の並び。1つの選択肢で動くのは3項目まで(EVENTS §3)
//   ['st', 対象, トレーニングの回数]  対象 = 能力のキー / main(素質のいちばん高い能力)/ all / rand / cheer(編成の子の1位の能力)/ type(編成の子のタイプの能力)
//   ['loy', n] 忠誠(甘え・恐れに半分ずつ)/ ['fear', n] 恐れ度だけ / ['pop', n] 人気 / ['popHi', n] 人気60〜のときだけ足す
//   ['hp', n] 体力(上限を100とした目盛り)/ ['str', n] ストレス / ['bond', 'cheer'|'cheer2'|'aid'|'team', n] 親密度
//   ['buff', 状態] / ['fame', n] 賞金(G) / ['pts', n] 能力ポイント / ['mas', n] 熟練 / ['flag', 名前] / ['goal', 目標]
//   確率で分かれるとき: 選択肢に p・ok・ng(ok/ng の台本の場面は scene に書く)
(function (root) {
  'use strict';

  const VERSION = 1;
  const SLOTS = ['start', 'after', 'cup'];
  // 大きさの物差し(EVENTS §3)。能力は「軽いトレーニング1回ぶん」の倍数
  const S = 0.5, M = 1, L = 2;

  // ---- ひとときの状態(EVENTS §3)。同時に2つまで。ようす(サボりグセ・うつ病)は芯の s.yosu で別 ----
  const BUFFS = Object.freeze({
    yaruki: { icon: '🔥', name: 'やる気満々', left: 3, good: true, text: 'トレーニングの大成功 +10%' },
    gokigen: { icon: '🎵', name: 'ごきげん', left: 3, good: true, text: 'ストレスの増え −50%' },
    neboke: { icon: '💤', name: 'ねぼけ', left: 2, good: false, text: 'サボり +10%' },
    futekusare: { icon: '🌀', name: 'ふてくされ', left: 2, good: false, text: '叱っても恐れ度が上がりにくい' },
    hirameki: { icon: '✨', name: 'ひらめき中', left: 0, good: true, text: '次の修行で技を覚えやすい' }, // left 0 = 次の修行まで
    iki: { icon: '🤝', name: '息ぴったり', left: 3, good: true, text: 'その編成の子がトレーニングに来やすい(+20%)' },
  });
  const BUFF_MAX = 2;
  const EFFECT = Object.freeze({ great: 0.10, sab: 0.10, stress: 0.5, tech: 0.15, iki: 0.20, scold: -2, fav: -0.10, inj: 2, baseBoost: 2, guts: 5, issaUp: 0.05, issaDown: -0.05 });

  // ---- 起きる確率(EVENTS §2。数字は試算 tools/success/success-sim.js で合わせた) ----
  // 拾い物とおすそわけ(r1113-037)。kin = 主血統ごとにくれる物(無い血統は、その子の1番の得意の実)/ find = 拾ってくる物の山(決まった乱数で1つ)
  //   どちらも同じ出来事が続けて出すぎないよう、もらってから GIFT_GAP ターンは出さない
  const KIN_GIFT = Object.freeze({ mocchi: 'fruit_life', pixie: 'fruit_wise', plant: 'herb', zan: 'fruit_hit', ark: 'fruit_tough', undine: 'oilyoil', yggdrasil: 'oil', ghost: 'fruit_eva', illumine: 'elixir2', kyubi: 'elixir1' });
  const FIND_POOL = Object.freeze(['oil', 'oil', 'herb', 'herb', 'fruit_life', 'fruit_pow', 'fruit_wise', 'fruit_hit', 'fruit_eva', 'fruit_tough']);
  const GIFT_GAP = 6;
  const RATE = Object.freeze({
    start: 0.16, after: 0.10, gapAdd: 0.03, gapMax: 0.12, recent: -0.08, // すき間ごとの土台・空いたターンごとに足す・前のターンに出たら引く
    cupWin: 0.6, cupLose: 0.6,                                           // 大会のあと(取材・負けたあと)
    unseen: 1.5, seenLow: 0.7,                                           // まだ見ていない ×1.5・何度も見た(3回〜)×0.7
  });
  const GOAL_LINE = Object.freeze({ junior: 260, middle: 420, pro: 600 }); // 「得意をのばす」: 期の終わりに素質のいちばん高い能力がこれ以上
  const GOAL_REWARD = Object.freeze({ star: [['pts', 10], ['pop', 6]], toku: [['st', 'main', L]], naka: [['bond', 'team', 10]] });
  const TYPE_STAT = Object.freeze({ attacker: 'pow', tank: 'tough', supporter: 'wise', healer: 'life', shadow: 'eva' });
  const SEASON_MONTHS = [1, 4, 8, 10, 12];
  const SEASON_KEY = { 1: 'jan', 4: 'apr', 8: 'aug', 10: 'oct', 12: 'dec' };
  const ANNIV_TURN = 13; // 育成の記念日のターン(ジュニア期8月)
  const SEASON_PER_YEAR = 2; // 1年に2つ(EVENTS §0・§5 の「約15回」に収めるため。§5 の表の3つより1つ少ない)。どの2つかは育成ごとに決まった乱数で選ぶ(くり返し遊んでも同じにならない)

  // ---- 出来事の表 ----
  //   kind  … daily / team / self / goal / season / small / body / cup(id の2つ目と同じ)
  //   slot  … start / after / cup / fixed(決まって起きる・すき間の確率に数えない)
  //   when  … (s, x) => 出せるか(x = 芯の部品と、その場で選んだ編成の子)
  //   w     … 重み(数か (s, x) => 数)
  //   ch    … 選択肢 { a: { fx } , b: { p, ok, ng } }。見るだけは fx だけ
  const per = (...keys) => (s, x) => keys.includes(x.period(s).key);
  const L_OK = ['junior', 'middle', 'pro'];
  const EVENTS = [
    // ═══ ① ふだん(16) ═══
    { id: 'ev.daily.nut', kind: 'daily', slot: 'start', w: 10, ch: { a: { fx: [['pop', 3], ['fame', 240]] }, b: { fx: [['hp', 20]] } } },
    { id: 'ev.daily.rain', kind: 'daily', slot: 'start', w: 10, ch: { a: { fx: [['st', 'wise', S]] }, b: { p: 0.5, ok: [['st', 'life', M]], ng: [['hp', -10]] } } },
    { id: 'ev.daily.night', kind: 'daily', slot: 'start', w: (s, x) => (x.hpRatio(s) < 0.3 ? 2 : 10), ch: { a: { fx: [['hp', 10]] }, b: { fx: [['str', -20], ['buff', 'neboke']] } } },
    { id: 'ev.daily.kids', kind: 'daily', slot: 'start', w: (s) => (s.pop >= 60 ? 18 : 10), ch: { a: { fx: [['pop', 3], ['hp', -10]] }, b: { fx: [['pop', 6], ['popHi', 4]] } } },
    { id: 'ev.daily.sweets', kind: 'daily', slot: 'start', w: 10, ch: { a: { need: { fame: 400 }, fx: [['fame', -400], ['buff', 'gokigen']] }, b: { fx: [['loy', 3]] } } },
    { id: 'ev.daily.book', kind: 'daily', slot: 'start', w: 10, ch: { a: { fx: [['st', 'wise', S], ['buff', 'hirameki']] }, b: { fx: [['hp', 20]] } } },
    { id: 'ev.daily.chase', kind: 'daily', slot: 'start', w: (s, x) => (x.hpRatio(s) < 0.3 ? 3 : 10), ch: { a: { fx: [['st', 'eva', S]] }, b: { fx: [['str', -10]] } } },
    { id: 'ev.daily.juggler', kind: 'daily', slot: 'start', w: 10, ch: { a: { fx: [['st', 'hit', S]] }, b: { fx: [['str', -10]] } } },
    { id: 'ev.daily.arm', kind: 'daily', slot: 'start', w: 10, ch: { a: { p: 0.6, ok: [['st', 'pow', M]], ng: [['hp', -10]] }, b: { fx: [['str', -10]] } } },
    { id: 'ev.daily.dream', kind: 'daily', slot: 'start', w: 8, ch: { a: { fx: [['loy', 3]] }, b: { fx: [['loy', 6], ['hp', -10]] } } },
    { id: 'ev.daily.picky', kind: 'daily', slot: 'start', w: 8, ch: { a: { fx: [['st', 'tough', S], ['str', 10]] }, b: { fx: [['str', -10]] } } },
    // 2026-11-13 社長 r1113-037: たまに、育成する子がアイテムを拾ってくる(見るだけ・中身は決まった乱数)
    { id: 'ev.daily.find', kind: 'daily', slot: 'start', w: 5, repeat: true, when: (s, x) => !x.giftedNow(s, 'find'), ch: { fx: [['item', 'find']] } },
    { id: 'ev.daily.mirror', kind: 'daily', slot: 'start', w: (s) => (s.pop >= 60 ? 14 : 8), ch: { a: { fx: [['pop', 3], ['loy', 3]] }, b: { fx: [['st', 'hit', S]] } } },
    { id: 'ev.daily.lost', kind: 'daily', slot: 'start', w: 8, ch: { a: { fx: [['pop', 3], ['hp', -10]] }, b: { fx: [['hp', 10]] } } },
    // 間合いの稽古(2026-11-13 社長: 間合い適性を出来事の選択肢でも上げる)。上げられる間合いが残っていて、出来事で上げた数が上限より少ないときだけ
    { id: 'ev.daily.range', kind: 'daily', slot: 'start', w: 8, repeat: true, when: (s, x) => s.turn >= 3 && x.aptRoom(s), ch: { a: { fx: [['apt', 'best'], ['hp', -10]] }, b: { fx: [['apt', 'low'], ['hp', -10]] } } },
    { id: 'ev.daily.map', kind: 'daily', slot: 'start', w: 6, when: per(...L_OK), ch: { fx: [['buff', 'hirameki']] } },
    { id: 'ev.daily.gift', kind: 'daily', slot: 'start', w: (s) => (s.pop >= 60 ? 14 : 6), ch: { fx: [['hp', 20]] } },
    { id: 'ev.daily.alone', kind: 'daily', slot: 'start', w: (s, x) => (x.loyal(s) >= 70 ? 14 : 4), when: (s, x) => x.loyal(s) >= 50, ch: { fx: [['st', 'main', S]] } },

    // ═══ ③ 編成(8)。トレーニングの結果のあと ═══
    { id: 'ev.team.selfdrill', kind: 'team', slot: 'after', w: 10, pickA: (s, x) => x.team(s, (m, i) => s.bond[i] >= 40),
      ch: { a: { fx: [['st', 'cheer', S], ['mas', 1], ['bond', 'cheer', 10]] }, b: { fx: [['hp', 10]] } } },
    { id: 'ev.team.senpai', kind: 'team', slot: 'after', w: 8, pickA: (s, x) => x.team(s, (m) => m.kind === 'raised' && x.rankAtLeast(m.rank, 'B')),
      ch: { a: { fx: [['buff', 'hirameki']] }, b: { p: 0.5, ok: [['st', 'main', M]], ng: [] } } },
    { id: 'ev.team.fight', kind: 'team', slot: 'after', w: 6, pickPair: (s, x) => x.pair(s, (a, b) => x.typeOf(a) && x.typeOf(a) === x.typeOf(b)),
      ch: { a: { fx: [['bond', 'cheer', 5], ['bond', 'cheer2', 5]] }, b: { fx: [['st', 'main', M], ['buff', 'futekusare']] } } },
    { id: 'ev.team.base', kind: 'team', slot: 'after', w: 6, pickA: (s, x) => x.team(s, (m, i) => m.kind === 'base' && !(s.ev.boost || {})[i]),
      ch: { a: { fx: [['flag', 'baseBoost']] }, b: { fx: [['bond', 'cheer', 5], ['str', -5]] } } }, // b はそっと見守る(Fable ①-16: 選択肢が1つだけだった)
    { id: 'ev.team.friend', kind: 'team', slot: 'after', w: 12, pickA: (s, x) => x.team(s, (m) => m.friend === true || m.from === 'friend'),
      ch: { a: { fx: [['bond', 'cheer', 10]] } } },
    // 2026-11-13 社長 r1113-037: 育成する子と同じ血統(主血統)の編成の子が、いっしょにトレーニングしたあとにアイテムをくれる(中身は血統ごと)
    { id: 'ev.team.kin', kind: 'team', slot: 'after', w: 14, repeat: true, when: (s, x) => !x.giftedNow(s, 'kin'), pickA: (s, x) => x.kinJoined(s),
      ch: { a: { fx: [['item', 'kin'], ['bond', 'cheer', 5]] }, b: { fx: [['st', 'cheer', S], ['bond', 'cheer', 10]] } } },
    { id: 'ev.team.typeskill', kind: 'team', slot: 'after', w: 8, pickA: (s, x) => x.team(s, (m) => Boolean(TYPE_STAT[x.typeOf(m)])),
      ch: { a: { fx: [['st', 'type', S], ['buff', 'hirameki']] } } },
    { id: 'ev.team.sync', kind: 'team', slot: 'after', w: 8, pickPair: (s, x) => x.pair(s, (a, b, i, j) => s.bond[i] >= 60 && s.bond[j] >= 60),
      ch: { fx: [['buff', 'iki']] } },
    // タッグの値をはじめて超えた子(子ごとに1回。同じ出来事は1回までの決まりの外)
    { id: 'ev.team.tagwake', kind: 'team', slot: 'after', w: 40, repeat: true, pickA: (s, x) => ((s.ev.tag || []).length >= 3 ? [] : x.team(s, (m, i) => s.bond[i] >= x.BOND.tag && !(s.ev.tag || []).includes(i))), // 1回の育成で3体まで
      ch: { fx: [['flag', 'tagSeen']] } },

    // ═══ ④ 育てる子(6) ═══
    { id: 'ev.self.peakin', kind: 'self', slot: 'fixed', when: (s, x) => x.peakEdge(s) === 'in', ch: { fx: [['buff', 'yaruki']] } },
    { id: 'ev.self.peakout', kind: 'self', slot: 'fixed', when: (s, x) => x.peakEdge(s) === 'out', ch: { a: { fx: [['hp', 30]] }, b: { fx: [['st', 'main', S], ['str', 20]] } } },
    { id: 'ev.self.slump', kind: 'self', slot: 'start', w: 30, when: (s) => (s.ev.bad || 0) >= 3, ch: { a: { fx: [['str', -20], ['hp', 10]] }, b: { fx: [['buff', 'yaruki']] } } },
    { id: 'ev.self.favtrain', kind: 'self', slot: 'start', w: 20, when: (s, x) => Boolean(x.favCand(s)), ch: { fx: [['flag', 'fav']] } },
    { id: 'ev.self.selfish', kind: 'self', slot: 'start', w: 25, when: (s, x) => x.loyal(s) <= 30 && s.turn >= 4, ch: { a: { fx: [['str', -20]] }, b: { fx: [['loy', 3], ['buff', 'futekusare']] } } },
    // 育成の記念日(2026-11-13 社長): 育て始めて1年(ジュニア期8月=ターン13)のはじめに一度きり。体力が上限の50%回復・ストレス −10。ほかの病気などで出せなければ2ターンまで待つ
    { id: 'ev.self.anniv', kind: 'self', slot: 'fixed', when: (s) => s.turn >= ANNIV_TURN && s.turn <= ANNIV_TURN + 2, ch: { fx: [['hp', 50], ['str', -10]] } },
    { id: 'ev.self.clingy', kind: 'self', slot: 'start', w: 12, when: (s, x) => x.loyal(s) >= 80, ch: { a: { fx: [['loy', 3], ['str', -10]] } } },

    // ═══ ⑤ 期の目標(ジュニア・ミドル・プロのはじめ)と季節の行事(決まって起きる) ═══
    { id: 'ev.goal.pick', kind: 'goal', slot: 'fixed', repeat: true, when: (s, x) => { const p = x.period(s); return L_OK.includes(p.key) && p.at <= 2 && !(s.ev.goal && s.ev.goal[p.key]); },
      ch: { a: { fx: [['goal', 'star']] }, b: { fx: [['goal', 'toku']] }, c: { fx: [['goal', 'naka']] } } },
    { id: 'ev.goal.done', kind: 'goal', slot: 'cup', result: true, ch: { fx: [] } },
    { id: 'ev.goal.miss', kind: 'goal', slot: 'cup', result: true, ch: { fx: [] } },
    // 季節: id の最後の数字 = 何年目(1 ジュニア・2 ミドル・3 プロ)
    { id: 'ev.season.jan1', kind: 'season', slot: 'fixed', ch: { a: { lottery: 'omikuji' } } },
    { id: 'ev.season.jan2', kind: 'season', slot: 'fixed', ch: { a: { fx: [['flag', 'goalPlus']] }, b: { fx: [['hp', 20], ['str', -10]] } } },
    { id: 'ev.season.jan3', kind: 'season', slot: 'fixed', ch: { fx: [['bond', 'aid', 10]] } },
    { id: 'ev.season.apr1', kind: 'season', slot: 'fixed', ch: { a: { fx: [['bond', 'team', 5]] }, b: { fx: [['hp', 20]] } } },
    { id: 'ev.season.apr2', kind: 'season', slot: 'fixed', ch: { a: { fx: [['pop', 6]] }, b: { fx: [['str', -20]] } } },
    { id: 'ev.season.apr3', kind: 'season', slot: 'fixed', ch: { fx: [['loy', 3], ['str', -10]] } },
    { id: 'ev.season.aug1', kind: 'season', slot: 'fixed', ch: { a: { fx: [['st', 'hit', S]] }, b: { fx: [['hp', 20]] } } },
    { id: 'ev.season.aug2', kind: 'season', slot: 'fixed', ch: { a: { p: 0.6, ok: [['st', 'pow', M], ['pop', 3]], ng: [['hp', -10]] }, b: { fx: [['str', -10]] } } },
    { id: 'ev.season.aug3', kind: 'season', slot: 'fixed', ch: { fx: [['str', -30]] } },
    { id: 'ev.season.oct1', kind: 'season', slot: 'fixed', ch: { a: { fx: [['pop', 6]] }, b: { fx: [['pop', 3], ['loy', 3]] } } },
    { id: 'ev.season.oct2', kind: 'season', slot: 'fixed', ch: { a: { fx: [['fame', 800], ['hp', -10]] }, b: { fx: [['fame', 320]] } } },
    { id: 'ev.season.oct3', kind: 'season', slot: 'fixed', ch: { fx: [['buff', 'hirameki']] } },
    { id: 'ev.season.dec1', kind: 'season', slot: 'fixed', ch: { a: { fx: [['st', 'life', S], ['hp', -10]] }, b: { fx: [['hp', 20]] } } },
    { id: 'ev.season.dec2', kind: 'season', slot: 'fixed', ch: { a: { fx: [['loy', 6]] }, b: { fx: [['buff', 'yaruki']] } } },
    { id: 'ev.season.dec3', kind: 'season', slot: 'fixed', ch: { fx: [['buff', 'yaruki']] } },
    { id: 'ev.season.finaljan', kind: 'season', slot: 'fixed', ch: { fx: [['loy', 6], ['str', -10]] } },
    { id: 'ev.season.finalapr', kind: 'season', slot: 'fixed', ch: { fx: [['loy', 3], ['str', -20]] } },

    // ═══ ⑥ 小さな賭け(2)。おみくじは 1月の初もうで(1年目)の a から ═══
    { id: 'ev.small.omikuji', kind: 'small', slot: 'none', ch: { fx: [] } },
    { id: 'ev.small.nut', kind: 'small', slot: 'start', w: 6, when: per(...L_OK),
      ch: { a: { need: { fame: 640 }, p: 0.6, pay: 640, ok: [['st', 'rand', M]], ng: [['hp', -20]], scene: { ok: 'ev.small.nut.ok', ng: 'ev.small.nut.ng' } }, b: { fx: [['str', -5]] } } },

    // ═══ ⑦ 体調(3+帰ってきた) ═══
    { id: 'ev.body.injury', kind: 'body', slot: 'start', w: 60, when: (s, x) => x.hpRatio(s) <= 0.2 && !s.cond, ch: { a: { fx: [['hp', 30]] }, b: { fx: [['flag', 'injRisk']] } } },
    { id: 'ev.body.runaway', kind: 'body', slot: 'start', w: 60, when: (s) => s.stress >= 80 && !s.cond, ch: { a: { fx: [['str', -30], ['hp', 10]] }, b: { fx: [['str', -10]] } } },
    { id: 'ev.body.healed', kind: 'body', slot: 'fixed', repeat: true, when: (s) => s.ev.healed === 'injury' || s.ev.healed === 'ill', ch: { fx: [['loy', 3]] } },
    { id: 'ev.body.home', kind: 'body', slot: 'fixed', repeat: true, when: (s) => s.ev.healed === 'away', ch: { a: { fx: [['loy', 6], ['str', -10]] }, b: { fx: [['fear', 6]] } } },

    // ═══ ⑧ 大会まわり(3)。ライバルの前触れは TOURNAMENT §8b の出し方が決まってから(EVENTS §9) ═══
    { id: 'ev.cup.eve', kind: 'cup', slot: 'start', w: 40, when: (s, x) => x.bigCupTonight(s), ch: { a: { fx: [['hp', 20]] }, b: { fx: [['flag', 'guts']] } } },
    { id: 'ev.cup.interview', kind: 'cup', slot: 'cup', when: (s, x, o) => o.won === true && s.pop >= 60, ch: { a: { fx: [['pop', 6]] }, b: { fx: [['loy', 3]] } } },
    { id: 'ev.cup.after', kind: 'cup', slot: 'cup', when: (s, x, o) => o.won === false && !s.over, ch: { a: { fx: [['str', -20]] }, b: { fx: [['buff', 'yaruki'], ['str', 10]] } } },
  ].map(e => Object.freeze(e));
  const BY_ID = Object.freeze(Object.fromEntries(EVENTS.map(e => [e.id, e])));
  const OMIKUJI = Object.freeze([
    { key: 'great', p: 0.15, fx: [['st', 'all', S], ['buff', 'yaruki']] },
    { key: 'good', p: 0.55, fx: [['st', 'rand', S]] },
    { key: 'bad', p: 0.30, fx: [] }, // 損はしない(助手が笑い飛ばす)
  ]);
  const HEAD = Object.freeze({ uniq: 'メインのお話', daily: '育成イベント', self: '育成イベント', goal: '育成イベント', season: '育成イベント', small: '育成イベント', body: '育成イベント', cup: '育成イベント', team: '編成の子のイベント' });

  // ---- 部品を作る(芯から呼ぶ)。h = 芯の内部の関数 ----
  const create = (h) => {
    const { KEYS, rngOf, periodOf, monthOf, clamp, num, r2, unitOf, addStat, addLoyalRaw, recover, addStress, addBond, loyalOf, aptMult, gainPts, popGain, BOND, FORCED, typeOf, peakOf, TOTAL_TURNS } = h;
    const clone = (o) => JSON.parse(JSON.stringify(o));
    const RANKS = ['G', 'F', 'E', 'D', 'C', 'B', 'A', 'S', 'SS', 'SSS', 'M'];

    // 固有イベント(その助手だけの出来事・data/monhero-success-arc.js の uniq)。芯が h.arc に表を渡す。決まった期のどこかで1回だけ
    const ARCS = h.arc && typeof h.arc === 'object' ? h.arc : {};
    const UNIQ = Object.freeze([].concat(...Object.entries(ARCS).map(([aid, a]) => (a && Array.isArray(a.uniq) ? a.uniq : [])
      .filter(u => u && typeof u.id === 'string' && u.ch).map(u => Object.freeze({ ...u, aid, kind: 'uniq', slot: 'fixed' })))));
    const BYX = Object.freeze({ ...BY_ID, ...Object.fromEntries(UNIQ.map(u => [u.id, u])) });
    const uniqDue = (s) => {
      const ev = evOf(s);
      for (const u of UNIQ) {
        if (u.aid !== s.aid || ev.seen.includes(u.id) || s.turn < u.from || s.turn > u.to + 2) continue;
        if (s.turn >= u.to || rngOf(s.id, s.turn, 'uniq', u.id)() < num(u.rate, 0.35)) return u;
      }
      return null;
    };
    // 保存の形(s.ev)。読めない値は既定に直す(CLAUDE.md ⑦)
    const norm = (raw) => {
      const o = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
      const n = (v, d, lo, hi) => (v !== null && v !== '' && Number.isFinite(Number(v)) ? clamp(Math.round(Number(v)), lo, hi) : d);
      const strs = (v, max) => (Array.isArray(v) ? v.filter(x => typeof x === 'string' && x.length <= 48).slice(0, max) : []);
      const out = {
        v: VERSION, seen: strs(o.seen, 128), gap: n(o.gap, 0, 0, 99), lastTurn: n(o.lastTurn, 0, 0, 99), n: n(o.n, 0, 0, 999),
        buff: (Array.isArray(o.buff) ? o.buff : []).filter(b => b && BUFFS[b.k]).slice(0, BUFF_MAX).map(b => ({ k: b.k, left: n(b.left, BUFFS[b.k].left, 0, 9), ...(Number.isInteger(b.with) ? { with: clamp(b.with, 0, 5) } : {}) })),
        goal: {}, flags: {}, boost: {}, tag: (Array.isArray(o.tag) ? o.tag : []).filter(i => Number.isInteger(i) && i >= 0 && i < 6).slice(0, 6),
        fav: typeof o.fav === 'string' && KEYS.includes(o.fav) ? o.fav : null, bad: n(o.bad, 0, 0, 99), condWas: ['injury', 'ill', 'away'].includes(o.condWas) ? o.condWas : null,
        healed: ['injury', 'ill', 'away'].includes(o.healed) ? o.healed : null, rolled: {}, seasons: {}, pend: null,
      };
      if (o.goal && typeof o.goal === 'object') for (const k of ['junior', 'middle', 'pro']) if (['star', 'toku', 'naka'].includes(o.goal[k])) out.goal[k] = o.goal[k];
      if (o.flags && typeof o.flags === 'object') { if (o.flags.goalPlus === true) out.flags.goalPlus = true; for (const k of ['injRisk', 'guts', 'gift_kin', 'gift_find']) if (Number.isInteger(o.flags[k])) out.flags[k] = clamp(o.flags[k], 0, 99); }
      if (o.boost && typeof o.boost === 'object') for (const [k, v] of Object.entries(o.boost)) if (/^[0-5]$/.test(k) && Number.isFinite(Number(v))) out.boost[k] = clamp(Number(v), 0, 10);
      if (o.rolled && typeof o.rolled === 'object') for (const sl of SLOTS) if (Number.isInteger(o.rolled[sl])) out.rolled[sl] = o.rolled[sl];
      if (o.seasons && typeof o.seasons === 'object') for (const y of ['junior', 'middle', 'pro']) if (Array.isArray(o.seasons[y])) out.seasons[y] = o.seasons[y].filter(m => SEASON_MONTHS.includes(m)).slice(0, 5);
      if (o.pend && typeof o.pend === 'object' && BYX[o.pend.id] && SLOTS.includes(o.pend.slot)) {
        const p = o.pend; out.pend = { id: p.id, slot: p.slot, turn: n(p.turn, 1, 1, 99) };
        for (const k of ['cheer', 'cheer2']) if (Number.isInteger(p[k])) out.pend[k] = clamp(p[k], 0, 5);
        if (typeof p.won === 'boolean') out.pend.won = p.won;
        if (['star', 'toku', 'naka'].includes(p.goal) && ['junior', 'middle', 'pro'].includes(p.gkey)) { out.pend.goal = p.goal; out.pend.gkey = p.gkey; }
      }
      return out;
    };
    const evOf = (s) => (s.ev && s.ev.v === VERSION ? s.ev : (s.ev = norm(s.ev)));

    // ---- 条件で使う部品(x) ----
    const hpRatio = (s) => (s.hpMax > 0 ? s.hp / s.hpMax : 0);
    const mainStat = (s) => KEYS.slice().sort((a, b) => (aptMult(s.species, b) - aptMult(s.species, a)) || (KEYS.indexOf(a) - KEYS.indexOf(b)))[0];
    const team = (s, fn) => s.team.map((m, i) => (fn(m, i) ? i : -1)).filter(i => i >= 0);
    const pair = (s, fn) => { const out = []; for (let i = 0; i < s.team.length; i++) for (let j = i + 1; j < s.team.length; j++) if (fn(s.team[i], s.team[j], i, j)) out.push([i, j]); return out; };
    const rankAtLeast = (r, min) => RANKS.indexOf(r) >= RANKS.indexOf(min);
    const tOf = (m) => { const t = m && typeOf ? typeOf[m.species] : null; return t ? (typeof t === 'string' ? t : t.main || null) : null; }; // タイプの表は { main, sub }
    const peakEdge = (s) => {
      const pk = peakOf ? peakOf(s.type) : null; if (!pk || s.turn < 2) return null;
      const pkey = periodOf(s.turn).key; if (pkey === 'debut' || pkey === 'final') return null;
      const f = (s.turn - 1) / TOTAL_TURNS; const f0 = (s.turn - 2) / TOTAL_TURNS;
      if (f >= pk.from && f0 < pk.from && f < pk.to) return 'in';
      if (f >= pk.to && f0 < pk.to) return 'out';
      return null;
    };
    const favCand = (s) => { const k = KEYS.find(k => num(s.trainXp && s.trainXp[`train:${k}`]) >= 4); return evOf(s).fav ? null : (k || null); };
    // ★★★・👑 の前の晩: 期の最後のターン(強制大会が星3以上)か、最後の期の頂への道の前
    const bigCupTonight = (s) => { const p = periodOf(s.turn); if (p.left !== 1) return false; if (p.key === 'final') return true; const f = FORCED[p.key]; return Boolean(f && f.star >= 3); };
    const lineMain = (sp) => { const l = typeof h.lineOf === 'function' ? h.lineOf(sp) : null; return l && l.main ? l.main : null; };
    // いまのトレーニングに来た編成の子のうち、育成する子と主血統が同じ子(芯の s.last.members)
    const kinJoined = (s) => { const me = lineMain(s.species); const mem = s.last && Array.isArray(s.last.members) ? s.last.members : []; return me ? mem.filter(i => Number.isInteger(i) && s.team[i] && lineMain(s.team[i].species) === me) : []; };
    const giftedNow = (s, kind) => { const t = s.ev && s.ev.flags ? num(s.ev.flags[`gift_${kind}`]) : 0; return t > 0 && s.turn - t < GIFT_GAP; };
    // その出来事でもらえる物(開いたときと選んだときで同じになるよう、決まった乱数とその子から決める)
    const giftOf = (s, kind, cheer) => {
      if (kind === 'kin') { const m = s.team[cheer]; const g = m ? KIN_GIFT[lineMain(m.species)] : null; return g || (m && Array.isArray(m.top) && m.top[0] ? `fruit_${m.top[0]}` : 'fruit_life'); }
      return FIND_POOL[Math.floor(rngOf(s.id, s.turn, 'find')() * FIND_POOL.length)];
    };
    const X = { kinJoined, giftedNow, aptRoom: (s) => typeof h.aptUpRoom === 'function' && [0, 1, 2, 3].some(d => h.aptUpRoom(s, d, 'event')), hpRatio, loyal: loyalOf, period: (s) => periodOf(s.turn), team, pair, rankAtLeast, typeOf: tOf, peakEdge, favCand, bigCupTonight, BOND };

    // ---- 何年目か(ジュニア=1・ミドル=2・プロ=3)と、その年に出る季節の行事 ----
    const yearOf = (s) => ({ junior: 1, middle: 2, pro: 3 })[periodOf(s.turn).key] || 0;
    const seasonsOf = (s, pkey) => {
      const ev = evOf(s); if (ev.seasons[pkey]) return ev.seasons[pkey];
      const rng = rngOf(s.id, 'season', pkey); const m = SEASON_MONTHS.slice();
      for (let i = m.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [m[i], m[j]] = [m[j], m[i]]; }
      return m.slice(0, SEASON_PER_YEAR).sort((a, b) => a - b);
    };
    // 決まって起きるもの(ターンのはじめ)。前のターンにほかが出て見送ったものは、次の月まで待つ
    const fixedDue = (s) => {
      const ev = evOf(s); const p = periodOf(s.turn); const mo = monthOf(s.turn);
      const seen = (id) => ev.seen.includes(id);
      for (const id of ['ev.self.anniv', 'ev.body.home', 'ev.body.healed', 'ev.goal.pick', 'ev.self.peakin', 'ev.self.peakout']) { const e = BYX[id]; if (e.when(s, X, {}) && (e.repeat || !seen(id))) return e; }
      const uq = uniqDue(s); if (uq) return uq;
      if (p.key === 'final') { for (const [m, id] of [[1, 'ev.season.finaljan'], [4, 'ev.season.finalapr']]) if ((mo === m || mo === m + 1) && !seen(id)) return BYX[id]; return null; }
      const y = yearOf(s); if (!y) return null;
      for (const m of seasonsOf(s, p.key)) { const id = `ev.season.${SEASON_KEY[m]}${y}`; if ((mo === m || mo === m + 1) && !seen(id) && BYX[id]) return BYX[id]; }
      return null;
    };

    // 重み(条件・はじめて見る・何度も見た)。meta = 端末に残る見た回数({ id: 回数 }。無くてもよい)
    const weightOf = (e, s, meta) => {
      let w = typeof e.w === 'function' ? e.w(s, X) : num(e.w, 1);
      const c = meta && typeof meta === 'object' ? num(meta[e.id]) : 0;
      if (meta && typeof meta === 'object') w *= c <= 0 ? RATE.unseen : c >= 3 ? RATE.seenLow : 1;
      return Math.max(0, w);
    };
    // 編成の子を選ぶ(条件に合う子から決まった乱数で)
    const castOf = (e, s, rng) => {
      if (e.pickA) { const c = e.pickA(s, X); if (!c.length) return null; return { cheer: c[Math.floor(rng() * c.length)] }; }
      if (e.pickPair) { const c = e.pickPair(s, X); if (!c.length) return null; const p = c[Math.floor(rng() * c.length)]; return { cheer: p[0], cheer2: p[1] }; }
      return {};
    };
    const lookOf = (p) => (p >= 0.7 ? 'good' : p >= 0.45 ? 'even' : 'risky'); // いけそう / 五分五分 / ちょっとあぶない(数字は言わない・ソラシドだけ p を見せる)
    const viewOf = (e, s, cast, o) => {
      const ch = e.ch && (e.ch.a || e.ch.b) ? Object.entries(e.ch).map(([c, v]) => ({ c, look: v.p ? lookOf(v.p) : (v.lottery ? 'even' : 'safe'), p: v.p || null, ok: !v.need || Object.entries(v.need).every(([k, n]) => num(s[k]) >= n), need: v.need || null, fx: v.fx ? v.fx.map(f => f.slice()) : null })) : [];
      const view = { id: e.id, kind: e.kind, head: HEAD[e.kind] || '育成イベント', lines: e.id, watch: ch.length === 0, choices: ch, turn: s.turn };
      if (cast && Number.isInteger(cast.cheer)) { view.cheer = cast.cheer; view.cheerName = s.team[cast.cheer] && s.team[cast.cheer].name; }
      if (cast && Number.isInteger(cast.cheer2)) { view.cheer2 = cast.cheer2; view.cheer2Name = s.team[cast.cheer2] && s.team[cast.cheer2].name; }
      if (e.kind === 'uniq') { view.aid = e.aid; view.title = e.title || ''; } // 固有イベント(助手1人分のストーリー)
      if (e.id === 'ev.self.favtrain') view.train = favCand(s);
      if (e.id === 'ev.team.kin' || e.id === 'ev.daily.find') view.item = giftOf(s, e.id === 'ev.team.kin' ? 'kin' : 'find', cast ? cast.cheer : null);
      if (e.id === 'ev.goal.done' || e.id === 'ev.goal.miss') view.goal = o && o.goal;
      if (e.id === 'ev.cup.eve') { const p = periodOf(s.turn); view.cup = p.key === 'final' ? 'summit' : (FORCED[p.key] && FORCED[p.key].name) || null; }
      return view;
    };

    // 期の目標の判定(強制大会の結果のあと)
    const goalCheck = (s, pkey, won) => {
      const g = evOf(s).goal[pkey]; if (!g) return null;
      const ok = g === 'star' ? won === true : g === 'toku' ? num(s.stats[mainStat(s)]) >= GOAL_LINE[pkey] : s.bond.filter(b => b >= 60).length >= 3;
      return { goal: g, ok };
    };

    // そのすき間で出る出来事(状態は変えない)。o = { seen(端末の見た回数), won, kind }
    const due = (s, slot, o) => {
      const opt = o && typeof o === 'object' ? o : {};
      if (!s || s.over && slot !== 'cup' || !SLOTS.includes(slot)) return null;
      const ev = evOf(s);
      if (ev.pend) return ev.pend.slot === slot ? viewFromPend(s, ev.pend) : null;
      if (ev.rolled[slot] === s.turn) return null;
      const rng = rngOf(s.id, s.turn, 'ev', slot);
      if (slot === 'cup') {
        if (typeof opt.won !== 'boolean') return null;
        if (opt.kind && ['junior', 'middle', 'pro'].includes(opt.kind)) { const g = goalCheck(s, opt.kind, opt.won); if (g) return { e: BYX[g.ok ? 'ev.goal.done' : 'ev.goal.miss'], cast: {}, extra: { goal: g.goal, gkey: opt.kind } }; }
        for (const id of ['ev.cup.interview', 'ev.cup.after']) { const e = BYX[id]; if (e.when(s, X, opt) && !ev.seen.includes(id) && rng() < (opt.won ? RATE.cupWin : RATE.cupLose)) return { e, cast: {} }; }
        return null;
      }
      if (s.battle || (slot === 'start' && (s.acted || s.cond)) || (slot === 'after' && !(s.last && ['train', 'shugyo'].includes(s.last.kind)))) return null;
      if (slot === 'start') { const f = fixedDue(s); if (f) return { e: f, cast: {} }; }
      // ランダムの分
      let p = RATE[slot] + Math.min(RATE.gapMax, ev.gap * RATE.gapAdd) + (ev.lastTurn && ev.lastTurn === s.turn - 1 ? RATE.recent : 0);
      if (ev.lastTurn === s.turn) p = 0; // 1ターンに出来事は最大2つ(はじめに決まったものが出たら、あとは出さない)
      const urgent = EVENTS.filter(e => e.slot === slot && (e.id === 'ev.body.injury' || e.id === 'ev.body.runaway') && (!e.when || e.when(s, X, opt)) && (e.repeat || !ev.seen.includes(e.id)));
      if (!(rng() < p) && !(urgent.length && rng() < 0.5)) return null;
      const pool = [];
      for (const e of EVENTS) {
        if (e.slot !== slot || (!e.repeat && ev.seen.includes(e.id))) continue;
        if (e.when && !e.when(s, X, opt)) continue;
        const cast = castOf(e, s, rngOf(s.id, s.turn, 'cast', e.id)); if (!cast) continue;
        const w = weightOf(e, s, opt.seen); if (w > 0) pool.push({ e, cast, w });
      }
      if (!pool.length) return null;
      let x = rng() * pool.reduce((a, b) => a + b.w, 0);
      for (const it of pool) { if (x < it.w) return it; x -= it.w; }
      return pool[pool.length - 1];
    };
    const viewFromPend = (s, p) => {
      const e = BYX[p.id]; const v = viewOf(e, s, { cheer: p.cheer, cheer2: p.cheer2 }, p.goal ? { goal: p.goal } : null);
      return { e, cast: { cheer: p.cheer, cheer2: p.cheer2 }, extra: p.goal ? { goal: p.goal, gkey: p.gkey } : null, view: v };
    };
    // 画面: その出来事を出す(選ぶ前に閉じても、同じ出来事がもう一度出るよう pend に残す)
    const open = (s0, slot, o) => {
      const s = clone(s0); const ev = evOf(s);
      const d = due(s, slot, o);
      if (!d) { if (SLOTS.includes(slot) && !ev.pend && !(slot === 'cup' && !(o && typeof o.won === 'boolean'))) ev.rolled[slot] = s.turn; return { state: s, out: { ev: null } }; }
      if (d.view) return { state: s, out: { ev: d.view } };
      ev.pend = { id: d.e.id, slot, turn: s.turn, ...(Number.isInteger(d.cast.cheer) ? { cheer: d.cast.cheer } : {}), ...(Number.isInteger(d.cast.cheer2) ? { cheer2: d.cast.cheer2 } : {}), ...(d.extra ? d.extra : {}) };
      if (o && typeof o.won === 'boolean') ev.pend.won = o.won;
      ev.rolled[slot] = s.turn;
      return { state: s, out: { ev: viewOf(d.e, s, d.cast, d.extra) } };
    };
    // 見るだけで出せるか(画面の確かめ・試算)
    const peekDue = (s, slot, o) => { const d = due(s, slot, o); return d ? (d.view || viewOf(d.e, s, d.cast, d.extra)) : null; };

    // ---- 結果をかける ----
    const STAT_TARGETS = ['main', 'all', 'rand', 'cheer', 'type'];
    const applyFx = (s, fx, ctx, rng, delta) => {
      const ev = evOf(s);
      const addSt = (k, size) => { const before = s.stats[k]; addStat(s, k, unitOf(s, k) * size); delta.stats[k] = (delta.stats[k] || 0) + (s.stats[k] - before); };
      for (const f of fx) {
        const [op, a, b] = f;
        if (op === 'st') {
          const size = num(b, S);
          if (a === 'all') KEYS.forEach(k => addSt(k, size));
          else if (a === 'main') addSt(mainStat(s), size);
          else if (a === 'rand') addSt(KEYS[Math.floor(rng() * KEYS.length)], size);
          else if (a === 'cheer') { const m = s.team[ctx.cheer]; addSt(m && m.top ? m.top[0] : mainStat(s), size); }
          else if (a === 'type') { const m = s.team[ctx.cheer]; addSt(TYPE_STAT[tOf(m)] || mainStat(s), size); }
          else if (KEYS.includes(a)) addSt(a, size);
        } else if (op === 'loy') { const n = num(a); addLoyalRaw(s, n >= 0 ? Math.ceil(n / 2) : -Math.ceil(-n / 2), n >= 0 ? Math.floor(n / 2) : -Math.floor(-n / 2)); delta.loyal = (delta.loyal || 0) + n; }
        else if (op === 'fear') { addLoyalRaw(s, 0, num(a)); delta.loyal = (delta.loyal || 0) + num(a); }
        else if (op === 'pop' || (op === 'popHi' && s.pop >= 60)) { const g = num(a) > 0 ? popGain(s, num(a)) : num(a); const b0 = s.pop; s.pop = clamp(s.pop + g, 0, 100); delta.pop = (delta.pop || 0) + (s.pop - b0); }
        else if (op === 'hp') { const b0 = s.hp; recover(s, num(a) / 100); delta.hp = (delta.hp || 0) + (s.hp - b0); }
        else if (op === 'str') { const b0 = s.stress; addStress(s, num(a) > 0 ? num(a) * mod(s, 'stress') : num(a)); delta.stress = (delta.stress || 0) + (s.stress - b0); }
        else if (op === 'bond') {
          const n = num(b); const idx = a === 'aid' ? ['aid'] : a === 'team' ? s.team.map((m, i) => i) : Number.isInteger(ctx[a]) ? [ctx[a]] : [];
          idx.forEach(i => addBond(s, i, n)); if (idx.length) delta.bond = (delta.bond || 0) + n;
        } else if (op === 'buff') addBuff(s, a, ctx, delta);
        else if (op === 'fame') { s.fame = Math.max(0, num(s.fame) + num(a)); if (num(a) > 0) s.fameTotal = num(s.fameTotal) + num(a); delta.fame = (delta.fame || 0) + num(a); }
        else if (op === 'pts') { gainPts(s, num(a)); delta.pts = (delta.pts || 0) + num(a); }
        else if (op === 'apt' && typeof h.addAptUp === 'function') {
          // 間合い適性を1段(芯の上限の中で)。a = 'best' いちばん得意な間合い / 'low' いちばん苦手な間合い / 0〜3
          const g = h.aptGradesOf(s); const R = h.DIST_UP_GRADES;
          const can = [0, 1, 2, 3].filter(d => h.aptUpRoom(s, d, 'event'));
          const d = Number.isInteger(a) ? a : can.slice().sort((x, y) => (a === 'low' ? R.indexOf(g[x]) - R.indexOf(g[y]) : R.indexOf(g[y]) - R.indexOf(g[x])) || x - y)[0];
          if (Number.isInteger(d) && h.addAptUp(s, d, 'event')) delta.apt = { dist: d, from: g[d], grade: h.aptGradesOf(s)[d] };
        }
        else if (op === 'mas') { (s.techs || []).forEach(t => { s.mastery[t] = clamp(num(s.mastery[t]) + num(a), 0, 100); }); delta.mastery = num(a); }
        else if (op === 'item') { const key = giftOf(s, a, ctx.cheer); if (key) { s.bag = s.bag && typeof s.bag === 'object' ? s.bag : {}; s.bag[key] = num(s.bag[key]) + 1; ev.flags[`gift_${a}`] = s.turn; (delta.items = delta.items || []).push(key); } }
        else if (op === 'goal') { const pk = periodOf(s.turn).key; ev.goal[pk] = a; delta.goal = a; }
        else if (op === 'flag') {
          if (a === 'baseBoost' && Number.isInteger(ctx.cheer)) { ev.boost[ctx.cheer] = EFFECT.baseBoost; delta.boost = EFFECT.baseBoost; }
          else if (a === 'tagSeen' && Number.isInteger(ctx.cheer)) { if (!ev.tag.includes(ctx.cheer)) ev.tag.push(ctx.cheer); delta.tagSeen = true; }
          else if (a === 'fav') { ev.fav = favCand(s); delta.fav = ev.fav; }
          else if (a === 'goalPlus') { ev.flags.goalPlus = true; delta.goalPlus = true; }
          else if (a === 'injRisk') { ev.flags.injRisk = s.turn; delta.injRisk = true; }
          else if (a === 'guts') { ev.flags.guts = s.turn; delta.guts = EFFECT.guts; }
        }
      }
    };
    const addBuff = (s, k, ctx, delta) => {
      const ev = evOf(s); const B = BUFFS[k]; if (!B) return;
      const keep = ev.buff.filter(b => b.k !== k);
      const nb = { k, left: B.left }; if (k === 'iki' && Number.isInteger(ctx.cheer)) nb.with = ctx.cheer;
      keep.push(nb); while (keep.length > BUFF_MAX) keep.shift(); // 3つ目が来たら古いほうが消える
      ev.buff = keep; (delta.buffs = delta.buffs || []).push(k);
    };

    // 選ぶ(c = 'a' | 'b' | 'c'。見るだけの出来事は null)
    const pick = (s0, c) => {
      const s = clone(s0); const ev = evOf(s); const p = ev.pend;
      if (!p) return { state: s0, out: { ok: false, why: 'no-event' } };
      const e = BYX[p.id]; const ctx = { cheer: p.cheer, cheer2: p.cheer2 };
      const hasCh = e.ch && (e.ch.a || e.ch.b);
      const choice = hasCh ? e.ch[c] : e.ch;
      if (hasCh && !choice) return { state: s0, out: { ok: false, why: 'bad-choice' } };
      if (choice.need && !Object.entries(choice.need).every(([k, n]) => num(s[k]) >= n)) return { state: s0, out: { ok: false, why: 'need' } };
      const rng = rngOf(s.id, s.turn, 'evpick', p.id, c || '-');
      const delta = { stats: {} }; let res = null; let scene = null;
      if (choice.pay) { s.fame = Math.max(0, num(s.fame) - choice.pay); delta.fame = -choice.pay; }
      if (choice.lottery === 'omikuji') {
        let x = rng(); let hit = OMIKUJI[OMIKUJI.length - 1]; for (const o of OMIKUJI) { if (x < o.p) { hit = o; break; } x -= o.p; }
        res = hit.key; scene = `ev.small.omikuji.${hit.key}`; applyFx(s, hit.fx, ctx, rng, delta); if (!ev.seen.includes('ev.small.omikuji')) ev.seen.push('ev.small.omikuji');
      } else if (choice.p) {
        const win = rng() < choice.p; res = win ? 'ok' : 'ng'; scene = choice.scene ? choice.scene[res] : `${p.id}.${c}.${res}`; // 結果の文: 台本 random.js の <出来事>.<選択肢>.ok / .ng
        applyFx(s, win ? choice.ok : choice.ng, ctx, rng, delta);
      } else applyFx(s, choice.fx || [], ctx, rng, delta);
      // 期の目標の結果(ごほうびは達成のときだけ・願い札で ×1.5)
      if ((e.id === 'ev.goal.done') && p.goal && GOAL_REWARD[p.goal]) {
        const mul = ev.flags.goalPlus ? 1.5 : 1;
        applyFx(s, GOAL_REWARD[p.goal].map(([op, a, b]) => (op === 'st' ? [op, a, b * mul] : op === 'bond' ? [op, a, Math.round(b * mul)] : [op, Math.round(a * mul)])), ctx, rng, delta);
      }
      if (e.id === 'ev.body.healed' || e.id === 'ev.body.home') ev.healed = null;
      if (!ev.seen.includes(e.id)) ev.seen.push(e.id); // repeat の出来事も記録は残す(出すかどうかは when が決める)
      ev.pend = null; ev.gap = 0; ev.lastTurn = s.turn; ev.n += 1;
      return { state: s, out: { ok: true, id: e.id, c: hasCh ? c : null, res, scene, next: hasCh ? `${e.id}.${c}` : null, delta } }; // 台本エンジン: event(next) → 結果があれば event(scene)
    };

    // ---- 芯が読む効き(ひとときの状態・旗) ----
    const has = (s, k) => Boolean(s && s.ev && Array.isArray(s.ev.buff) && s.ev.buff.some(b => b.k === k));
    const mod = (s, k, a) => {
      const ev = s && s.ev; if (!ev || typeof ev !== 'object') return k === 'stress' || k === 'inj' ? 1 : 0;
      switch (k) {
        case 'great': return has(s, 'yaruki') ? EFFECT.great : 0;
        case 'sab': return has(s, 'neboke') ? EFFECT.sab : 0;
        case 'stress': return has(s, 'gokigen') ? EFFECT.stress : 1;
        case 'tech': return has(s, 'hirameki') ? EFFECT.tech : 0;
        case 'scold': return has(s, 'futekusare') ? EFFECT.scold : 0;
        case 'iki': return Array.isArray(ev.buff) && ev.buff.some(b => b.k === 'iki' && b.with === a) ? EFFECT.iki : 0;
        case 'boost': return ev.boost && Number.isFinite(Number(ev.boost[a])) ? Number(ev.boost[a]) : 0;
        case 'fail': return ev.fav && ev.fav === a ? EFFECT.fav : 0;
        case 'inj': return ev.flags && ev.flags.injRisk === s.turn ? EFFECT.inj : 1;
        case 'guts': return ev.flags && ev.flags.guts === s.turn ? EFFECT.guts : 0;
        case 'issa': return (has(s, 'yaruki') ? EFFECT.issaUp : 0) + (has(s, 'futekusare') ? EFFECT.issaDown : 0);
        default: return 0;
      }
    };
    // ターンを閉じるとき(芯の endTurn が s.last を消す前に呼ぶ)
    const tick = (s) => {
      const ev = evOf(s); const last = s.last || {};
      ev.buff = ev.buff.map(b => (b.k === 'hirameki' ? (last.kind === 'shugyo' ? null : b) : { ...b, left: b.left - 1 })).filter(b => b && (b.k === 'hirameki' || b.left > 0));
      if (last.kind === 'train' || last.kind === 'shugyo') ev.bad = ['fail', 'sab'].includes(last.res) ? ev.bad + 1 : 0;
      if (ev.lastTurn !== s.turn) ev.gap = Math.min(99, ev.gap + 1);
      const now = s.cond ? s.cond.kind : null;
      if (ev.condWas && !now) ev.healed = ev.condWas;
      ev.condWas = now;
      if (ev.pend && ev.pend.turn < s.turn) ev.pend = null; // 前のターンの出し残し(ふつうは無い)
      if (ev.bad >= 3 && ev.seen.includes('ev.self.slump')) ev.bad = 0;
      return s;
    };
    const buffs = (s) => (s && s.ev && Array.isArray(s.ev.buff) ? s.ev.buff.filter(b => BUFFS[b.k]).map(b => ({ k: b.k, icon: BUFFS[b.k].icon, name: BUFFS[b.k].name, text: BUFFS[b.k].text, left: b.k === 'hirameki' ? null : b.left, with: b.with })) : []);

    return Object.freeze({ VERSION, LIST: EVENTS, BY_ID: BYX, UNIQ, BUFFS, EFFECT, RATE, OMIKUJI, GOAL_LINE, GOAL_REWARD, norm, due: peekDue, open, pick, mod, tick, buffs, STAT_TARGETS, lookOf });
  };

  const api = Object.freeze({ VERSION, LIST: EVENTS, BY_ID, BUFFS, RATE, SLOTS, create });
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.MONHERO_SUCCESS_EVENTS = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
