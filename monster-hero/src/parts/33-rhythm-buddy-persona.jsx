// ==================== マスモンの個体差(2026-10-13・社長指示「性格のほかにも個体差を」→ A〜G 全部とプロフィール) ====================
// 同じ性格の子でも話し方が少しずつ違うようにする。性格の言葉づかい(真面目は丁寧、頑固は「〜ぞ」)は崩さず、上に重ねる。
//   A 一人称 / B 人の呼び方 / C 口ぐせ / D 好きな曲・苦手な曲 / E 叩き方のくせ / F 好物・趣味 / G 誕生日
// 決め方: D 以外は個体番号(マスモンの id)から決める。新しい保存キーは作らない。同じ子なら何度開いても同じ。
//   性格が決まる前は「性格なし」の候補から、決まったら性格に合う候補の中から選び直す(性格と合わない組み合わせは表に入れない)。
// D は相棒の記録(mh_rhythm_buddy_v1 の曲ごとの回数・最近のスコア)を読むだけ。書き込まない(CLAUDE.md ⑦)。
// E は見た目とセリフだけ。判定・スコアには使わない。
// 検査: node tools/mode/rhythm-buddy-persona-check.js / 仕様: docs/spec/RHYTHM_BUDDY.md「個体差」

// A 一人称。先頭がその性格のいちばん多い形。'' は性格が決まる前
const RHYTHM_BUDDY_SELF_WORDS = Object.freeze({
  '': Object.freeze(['ぼく', 'わたし', 'おれ', 'あたし', 'うち']),
  jester: Object.freeze(['オイラ', 'ぼく', 'おれ', 'あたし']),
  brave: Object.freeze(['おれ', 'ぼく', 'あたし', 'オイラ']),
  clingy: Object.freeze(['あたし', 'ぼく', 'うち', 'わたし']),
  smart: Object.freeze(['わたし', 'ぼく', 'わたくし']),
  serious: Object.freeze(['わたし', '自分', 'わたくし', 'ぼく']),
  proud: Object.freeze(['わたし', 'わたくし', 'おれ']),
  worrier: Object.freeze(['ぼく', 'わたし', 'あたし', 'うち']),
  stubborn: Object.freeze(['おれ', 'わし', '拙者', '自分']),
  easygoing: Object.freeze(['ぼく', 'うち', 'わし', 'あたし']),
});
// 性別(2026-10-16 社長「ウンディーネとピクシー種は明確に女個体だから、そういう設定を足して」)。
// 種(主血統)で決まる。ピクシー種(ピクシー・ミア・パンドラ)とウンディーネ種(ウンディーネ・ヤオビクニ・スネグーラチカ)は女の子。
// ほかの種は決めない('')。保存はしない(個体のデータは書き換えない・種から毎回決める)
const RHYTHM_BUDDY_FEMALE_LINEAGES = Object.freeze(['pixie', 'undine']);
const rhythmBuddyGenderOf = (baseId) => {
  const map = typeof MONSTER_LINEAGE_MAP !== 'undefined' ? MONSTER_LINEAGE_MAP : null;
  const entry = map && baseId != null && Object.prototype.hasOwnProperty.call(map, baseId) ? map[baseId] : null;
  return entry && RHYTHM_BUDDY_FEMALE_LINEAGES.includes(entry.main) ? 'female' : '';
};
// 女の子の一人称。性格ごとに、上の表から女の子の言い方だけを残したもの(頑固のように1つも無い性格は、近い言い方を足した)。先頭がいちばん多い形
const RHYTHM_BUDDY_SELF_WORDS_FEMALE = Object.freeze({
  '': Object.freeze(['わたし', 'あたし', 'うち']),
  jester: Object.freeze(['あたし', 'うち', 'わたし']),
  brave: Object.freeze(['あたし', 'わたし', 'うち']),
  clingy: Object.freeze(['あたし', 'うち', 'わたし']),
  smart: Object.freeze(['わたし', 'わたくし']),
  serious: Object.freeze(['わたし', 'わたくし']),
  proud: Object.freeze(['わたし', 'わたくし', 'あたし']),
  worrier: Object.freeze(['わたし', 'あたし', 'うち']),
  stubborn: Object.freeze(['あたし', 'わたし', 'うち']),
  easygoing: Object.freeze(['うち', 'あたし', 'わたし']),
});
// B 人の呼び方。suf は名前のあとに付ける形('' は呼び捨て)、call は名前の代わりに呼ぶ形。
// 先頭は、性格ごとの呼び方(33-rhythm-buddy-talk.jsx の RHYTHM_BUDDY_HONORIFICS)と同じにしておく
const RHYTHM_BUDDY_CALL_STYLES = Object.freeze({
  san: Object.freeze({ id: 'san', label: '◯◯さん', suf: 'さん' }),
  kun: Object.freeze({ id: 'kun', label: '◯◯くん', suf: 'くん' }),
  chan: Object.freeze({ id: 'chan', label: '◯◯ちゃん', suf: 'ちゃん' }),
  sama: Object.freeze({ id: 'sama', label: '◯◯様', suf: '様' }),
  cchi: Object.freeze({ id: 'cchi', label: '◯◯っち', suf: 'っち' }),
  dono: Object.freeze({ id: 'dono', label: '◯◯殿', suf: '殿' }),
  bare: Object.freeze({ id: 'bare', label: '呼び捨て', suf: '' }),
  master: Object.freeze({ id: 'master', label: 'マスター', call: 'マスター' }),
  partner: Object.freeze({ id: 'partner', label: '相棒', call: '相棒' }),
  boss: Object.freeze({ id: 'boss', label: 'ボス', call: 'ボス' }),
  lord: Object.freeze({ id: 'lord', label: 'ご主人', call: 'ご主人' }),
});
const RHYTHM_BUDDY_CALLS = Object.freeze({
  '': Object.freeze(['san', 'kun', 'chan']),
  jester: Object.freeze(['cchi', 'kun', 'chan', 'partner']),
  brave: Object.freeze(['bare', 'partner', 'boss', 'kun']),
  clingy: Object.freeze(['chan', 'kun', 'lord', 'san']),
  smart: Object.freeze(['san', 'master', 'kun']),
  serious: Object.freeze(['sama', 'san', 'master']),
  proud: Object.freeze(['bare', 'kun', 'chan']),
  worrier: Object.freeze(['san', 'kun', 'chan', 'master']),
  stubborn: Object.freeze(['bare', 'partner', 'dono']),
  easygoing: Object.freeze(['san', 'kun', 'chan', 'cchi']),
});
// C 口ぐせ。pre は文の頭に付ける一言、end は文の終わりを替える一言(終わりの「!」「。」などを外してから付ける)
const RHYTHM_BUDDY_QUIRKS = Object.freeze({
  '': Object.freeze([{ pre: 'よーし、' }, { pre: 'えっとね、' }, { pre: 'ねえねえ、' }, { pre: 'おっ、' }, { end: '♪' }, { end: '〜' }]),
  jester: Object.freeze([{ pre: 'ねえねえ、' }, { pre: 'おっ、' }, { pre: 'よーし、' }, { end: '!…なんてね' }, { end: '♪' }]),
  brave: Object.freeze([{ pre: 'よーし、' }, { pre: 'おっ、' }, { pre: 'さてと、' }, { end: '!!' }]),
  clingy: Object.freeze([{ pre: 'ねえねえ、' }, { pre: 'えっとね、' }, { end: '〜' }, { end: '♪' }]),
  smart: Object.freeze([{ pre: 'ふむ、' }, { pre: 'さてと、' }, { pre: 'なるほど、' }]),
  serious: Object.freeze([{ pre: 'よーし、' }, { pre: 'えっと、' }, { pre: 'さてと、' }, { end: '!!' }]),
  proud: Object.freeze([{ pre: 'ふふん、' }, { pre: 'まあね、' }, { pre: 'さてと、' }]),
  worrier: Object.freeze([{ pre: 'えっと、' }, { pre: 'あのね、' }, { pre: 'うう、' }, { end: '…' }]),
  stubborn: Object.freeze([{ pre: 'ふん、' }, { pre: 'よし、' }, { pre: 'さて、' }]),
  easygoing: Object.freeze([{ pre: 'ふぁ〜、' }, { pre: 'よいしょ、' }, { pre: 'えっとね、' }, { end: '〜' }, { end: '♪' }]),
});
// E 叩き方のくせ(見た目とセリフだけ)。good=よかったとき / bad=よくなかったとき(どちらも「〜た」で終わる) / talk=自分のくせを話す(言い切りの形)
const RHYTHM_BUDDY_HABITS = Object.freeze([
  Object.freeze({ id: 'early', label: '早押しぎみ', good: '早めに入れた', bad: 'ちょっと急ぎすぎた', talk: 'つい早めに叩いちゃう' }),
  Object.freeze({ id: 'late', label: '遅押しぎみ', good: 'じっくり待てた', bad: 'ちょっと遅れちゃった', talk: 'じっくり待ってから叩く' }),
  Object.freeze({ id: 'exact', label: 'ぴったり', good: 'ぴったり合わせられた', bad: '少しずれちゃった', talk: 'ぴったり合わせたくなる' }),
  Object.freeze({ id: 'wave', label: '波がある', good: '波に乗れた', bad: '波にのまれちゃった', talk: '日によって調子が変わる' }),
  Object.freeze({ id: 'slowStart', label: '出だしが固い', good: '出だしをこらえた', bad: '出だしで固くなった', talk: '出だしはいつも固くなる' }),
  Object.freeze({ id: 'lateStrong', label: '後半に強い', good: '後半で追い上げた', bad: '前半で出遅れた', talk: '後半になると燃えてくる' }),
  Object.freeze({ id: 'fastFan', label: '速い曲が好き', good: '速さに乗れた', bad: '速さに置いていかれた', talk: '速い曲だと燃えてくる' }),
  Object.freeze({ id: 'slowFan', label: 'ゆっくりの曲が好き', good: '落ち着いて叩けた', bad: 'あわてちゃった', talk: 'ゆっくりの曲だと落ち着く' }),
  Object.freeze({ id: 'hold', label: '長押しが得意', good: '長押しをしっかり持てた', bad: '長押しを早く離しちゃった', talk: '長押しなら自信がある' }),
  Object.freeze({ id: 'slide', label: 'スライドが得意', good: 'スライドが決まった', bad: 'スライドでつまずいた', talk: 'スライドなら自信がある' }),
]);
// F 好物・趣味(性格には関係なく選ぶ。どの性格の言い方にも合う名詞にしてある)
const RHYTHM_BUDDY_FOODS = Object.freeze(['プリン', 'おにぎり', 'カレー', 'いちご', '焼き魚', 'ドーナツ', 'ラーメン', 'りんご', 'チョコ', 'お団子']);
const RHYTHM_BUDDY_HOBBIES = Object.freeze(['お昼寝', '歌', '星を見ること', '散歩', '読書', 'おしゃれ', '料理', 'そうじ', '釣り', 'かけっこ']);

// 個体番号と項目名から、決まった数を作る(FNV-1a のあとにかきまぜる)。同じ子・同じ項目なら、いつでも同じ数
const rhythmBuddyPersonaHash = (id, salt) => {
  const s = `${salt}:${String(id == null ? '' : id)}`;
  let h = 2166136261;
  for (let i = 0; i < s.length; i += 1) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  // 最後にかきまぜて、下の桁の偏りを消す(似た id・似た項目名でも、項目ごとにばらばらに出る)
  h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b); h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35); h ^= h >>> 16;
  return h >>> 0;
};
// 一覧から1つ。lean のときは先頭(その性格のいちばん多い形)が出やすい(2つぶんの重み)
const rhythmBuddyPersonaChoose = (list, id, salt, lean) => {
  if (!Array.isArray(list) || !list.length) return null;
  const h = rhythmBuddyPersonaHash(id, salt);
  if (!lean) return list[h % list.length];
  const k = h % (list.length + 1);
  return list[k <= 1 ? 0 : k - 1];
};
// 1年のうちの1日(うるう日は出さない)。{ month, day }
const rhythmBuddyPersonaBirthday = (id) => {
  const n = rhythmBuddyPersonaHash(id, 'bday') % 365;
  const d = new Date(Date.UTC(2025, 0, 1) + n * 86400000);
  return { month: d.getUTCMonth() + 1, day: d.getUTCDate() };
};
// その子の個体差(D の好き・苦手な曲は rhythmBuddyPersonaSongs で別に読む)
// baseId(種)を渡すと性別も決まる。渡さないとき・ほかの種は、これまでと1文字も変わらない
const rhythmBuddyPersona = (masuId, trait = '', baseId = null) => {
  const t = Object.prototype.hasOwnProperty.call(RHYTHM_BUDDY_SELF_WORDS, trait) ? trait : '';
  const gender = rhythmBuddyGenderOf(baseId);
  const callId = rhythmBuddyPersonaChoose(RHYTHM_BUDDY_CALLS[t], masuId, `call:${t}`, true);
  const quirk = rhythmBuddyPersonaChoose(RHYTHM_BUDDY_QUIRKS[t], masuId, `quirk:${t}`, false);
  return {
    gender,
    self: rhythmBuddyPersonaChoose((gender === 'female' ? RHYTHM_BUDDY_SELF_WORDS_FEMALE : RHYTHM_BUDDY_SELF_WORDS)[t], masuId, `self:${t}`, true),
    call: RHYTHM_BUDDY_CALL_STYLES[callId],
    quirk: Object.freeze({ ...quirk, label: quirk.pre ? `「${quirk.pre.replace(/、$/, '')}」` : `文の終わりに「${quirk.end.replace(/^!/, '')}」` }),
    habit: rhythmBuddyPersonaChoose(RHYTHM_BUDDY_HABITS, masuId, 'habit', false),
    food: rhythmBuddyPersonaChoose(RHYTHM_BUDDY_FOODS, masuId, 'food', false),
    hobby: rhythmBuddyPersonaChoose(RHYTHM_BUDDY_HOBBIES, masuId, 'hobby', false),
    birthday: rhythmBuddyPersonaBirthday(masuId),
  };
};
// 今日(日本時間の暦の日付)が誕生日か
const rhythmBuddyIsBirthday = (persona, nowMs) => {
  if (!persona || !persona.birthday || !Number.isFinite(nowMs)) return false;
  const d = new Date(nowMs + 9 * 3600 * 1000);
  return d.getUTCMonth() + 1 === persona.birthday.month && d.getUTCDate() === persona.birthday.day;
};
// D 好きな曲・苦手な曲(相棒の記録を読むだけ)。mon は rhythmBuddyNormalizeMon を通したもの。
//   好き = いちばん多く一緒に遊んだ曲(2回以上) / 苦手 = 3回以上遊んだ曲のうち、最近のスコアの平均がいちばん低い曲(候補が2曲以上あるとき・好きな曲とは別)
const rhythmBuddyPersonaSongs = (mon) => {
  const songs = mon && mon.songs && typeof mon.songs === 'object' ? mon.songs : {};
  const ids = Object.keys(songs).filter((id) => Number.isFinite(songs[id]) && songs[id] > 0)
    .sort((a, b) => (songs[b] - songs[a]) || (a < b ? -1 : 1));
  const like = ids.length && songs[ids[0]] >= 2 ? ids[0] : '';
  const sum = {};
  (Array.isArray(mon && mon.recent) ? mon.recent : []).forEach((x) => {
    if (!x || !x.songId || !(Number(x.max) > 0) || !Number.isFinite(Number(x.score))) return;
    const s = sum[x.songId] || (sum[x.songId] = { total: 0, n: 0 });
    s.total += Math.min(1, Math.max(0, Number(x.score) / Number(x.max)));
    s.n += 1;
  });
  const cands = Object.keys(sum).filter((id) => songs[id] >= 3).map((id) => ({ id, avg: sum[id].total / sum[id].n }))
    .sort((a, b) => (a.avg - b.avg) || (a.id < b.id ? -1 : 1));
  const low = cands.length >= 2 ? cands.find((c) => c.id !== like) : null;
  return { like, dislike: low ? low.id : '' };
};
// C 口ぐせを1つの文に付ける。付けると40文字を超える・ふさわしくない文(「…」で始まる・すでに口ぐせがある)なら、そのまま返す
const rhythmBuddyApplyQuirk = (text, quirk, max = 40) => {
  const s = String(text || '');
  if (!s || !quirk || /^[…\.]/.test(s)) return s;
  let out = s;
  if (quirk.pre) {
    if (s.indexOf(quirk.pre) === 0) return s;
    out = quirk.pre + s;
  } else if (quirk.end) {
    const body = s.replace(/[!！。〜♪…?？]+$/, '');
    if (!body || /[?？]$/.test(s) || s.slice(-quirk.end.length) === quirk.end) return s;
    out = body + quirk.end;
  }
  return out.length <= max ? out : s;
};

// ---- 個体差を使うセリフ(形は RHYTHM_BUDDY_TALK と同じ。rhythmBuddyTalkPick が場面の名前でここも探す) ----
// {self}=一人称 / {who}さん=呼び方(個体ごと) / {food}{hobby}=好物・趣味 / {like}{dislike}=好きな曲・苦手な曲 / {hg}{hb}{ht}=叩き方のくせ
// 場面: pJoin=呼ばれた / pLike=好きな曲を選んだ / pSongDis=苦手な曲に決まった / pHigh・pLow=結果(くせ) / pDislike=苦手な曲で結果が悪い /
//       pFood・pHobby・pHabit=ひとりごと / pBday=誕生日の当日(呼ばれた・ひとりごと)
// 性格が決まった子は、その性格の文だけで話す(traitOnly。共通の文は性格が決まる前の子が使う)
const RHYTHM_BUDDY_PERSONA_TALK_RAW = ({
  pJoin: {
    common: ['{who}さん、{self}も来たよ!', '{self}もまぜて!', '{who}さん、よろしくね!'],
    trait: {
      jester: ['{who}さん、{self}が来たからには笑わせるよ!', '{self}、参上!'], brave: ['{who}さん、{self}に任せろ!', '{self}が先陣を切る!'],
      clingy: ['{who}さん、{self}を呼んでくれたの?うれしい!', '{self}、ずっと待ってたよ〜'], smart: ['{who}さん、{self}も準備できています', '{self}の出番ですね'],
      serious: ['{who}さん、{self}も全力で取り組みます!', '{self}、精一杯がんばります!'], proud: ['{who}さん、{self}を呼ぶとはお目が高いわ', '{self}の出番ね'],
      worrier: ['{who}さん、{self}でいいのかな…がんばる!', '{self}、足を引っぱらないようにする…'], stubborn: ['{who}さん、{self}が来たぞ', '{self}は手を抜かんぞ'],
      easygoing: ['{who}さん、{self}も来たよ〜', '{self}、のんびりがんばるね〜'],
    },
    mood: {},
  },
  pLike: {
    common: ['{self}、{like}がいちばん好き!', '{like}は{self}のお気に入り!'],
    trait: {
      jester: ['{like}は{self}の十八番!', '{like}で盛り上がろ!{self}の大好物!'], brave: ['{like}は{self}の得意曲だ!', '{self}の{like}、見せてやる!'],
      clingy: ['{like}、{self}の大好きな曲〜!', '{self}ね、{like}がいちばん好き!'], smart: ['{like}は{self}のいちばん好きな曲です', '{self}の記録では{like}が最多です'],
      serious: ['{self}、{like}がいちばん好きなんです', '{like}は何度も一緒に遊んだ曲です'], proud: ['{like}は{self}のための曲よ', '{self}といえば{like}でしょ?'],
      worrier: ['{like}なら、{self}も安心…', '{self}、{like}は好きなんだ…'], stubborn: ['{like}は{self}の曲だ', '{self}は{like}と決めている'],
      easygoing: ['{like}、{self}の好きな曲〜', '{self}、{like}がいいな〜'],
    },
    mood: {},
  },
  pSongDis: {
    common: ['{dislike}かぁ…{self}、ちょっと苦手…', 'うう、{dislike}は苦手な曲…'],
    trait: {
      jester: ['{dislike}!?{self}の天敵じゃん!', '{dislike}は笑えないやつ…'], brave: ['{dislike}か。苦手だが逃げないぞ!', '苦手な{dislike}にも挑むぞ!'],
      clingy: ['{dislike}、苦手なの…そばにいてね', '{self}、{dislike}はこわいよ〜'], smart: ['{dislike}は{self}の苦手な曲です', '{dislike}は成績が伸びていません'],
      serious: ['{dislike}は苦手ですが、がんばります', '{self}、{dislike}は練習中です'], proud: ['{dislike}?べ、別に苦手じゃないわ', '{dislike}くらい、どうってことないわ'],
      worrier: ['{dislike}…{self}、自信ないよ…', '{dislike}、またミスしそう…'], stubborn: ['{dislike}か。今日こそ勝つぞ', '苦手な{dislike}でも引かん'],
      easygoing: ['{dislike}か〜、ちょっと苦手〜', 'まあ、{dislike}もいっか〜'],
    },
    mood: {},
  },
  pHigh: {
    common: ['{hg}!'],
    trait: {
      jester: ['{hg}!さすがでしょ?'], brave: ['{hg}!この調子だ!'], clingy: ['{hg}よ〜!ほめて!'], smart: ['{hg}のが勝因ですね'],
      serious: ['{hg}のがよかったです!'], proud: ['{hg}わ。当然ね'], worrier: ['{hg}…よかったぁ'], stubborn: ['{hg}のが効いたぞ'], easygoing: ['{hg}〜。いい感じ〜'],
    },
    mood: {},
  },
  pLow: {
    common: ['{hb}…次こそ!'],
    trait: {
      jester: ['{hb}!まあ次、次!'], brave: ['{hb}。次は取り返す!'], clingy: ['{hb}…なぐさめて〜'], smart: ['{hb}のが原因ですね'],
      serious: ['{hb}…次は気をつけます'], proud: ['{hb}だけよ。次は見てなさい'], worrier: ['{hb}…ごめんね'], stubborn: ['{hb}。次は外さん'], easygoing: ['{hb}〜。まあいっか〜'],
    },
    mood: {},
  },
  pDislike: {
    common: ['やっぱり{dislike}は苦手…', '{dislike}、いつか好きになりたいな'],
    trait: {
      jester: ['{dislike}にまた負けた〜!'], brave: ['{dislike}め…次は勝つ!'], clingy: ['{dislike}、また苦手だった…'], smart: ['{dislike}は課題が残りますね'],
      serious: ['{dislike}はまだ苦手です…次こそ'], proud: ['{dislike}なんて…次は見てなさい'], worrier: ['やっぱり{dislike}はむずかしい…'], stubborn: ['{dislike}め、次こそは'], easygoing: ['{dislike}はむずかしいね〜'],
    },
    mood: {},
  },
  pFood: {
    common: ['{food}食べたいな〜', '終わったら{food}にしよう!'],
    trait: {
      jester: ['{food}食べながら叩きたい!', '{self}の好物は{food}!覚えてね!'], brave: ['勝ったら{food}だ!', '{food}を食べれば百人力だ!'],
      clingy: ['{food}、一緒に食べよ〜?', '{self}ね、{food}が大好きなの〜'], smart: ['{food}は集中力に効くんです', '{self}の好物は{food}です'],
      serious: ['終わったら{food}が食べたいです', '{food}を励みにがんばります!'], proud: ['{food}は{self}の好物よ', '{food}を用意してくれてもいいのよ?'],
      worrier: ['{food}食べたら落ち着くかな…', '{food}、持ってくればよかった…'], stubborn: ['{food}は譲らんぞ', '{self}の好物は{food}だ'],
      easygoing: ['{food}食べたいな〜…', '{food}食べて、お昼寝したいな〜'],
    },
    mood: {},
  },
  pHobby: {
    common: ['趣味は{hobby}なんだ!', '{self}、{hobby}が好きなんだ'],
    trait: {
      jester: ['{hobby}も得意なんだよ!', '{self}の趣味?{hobby}だよ!'], brave: ['{hobby}でも負けないぞ!', '{self}の趣味は{hobby}だ!'],
      clingy: ['{self}ね、{hobby}が大好きなの〜', '今度、{hobby}の話を聞いて〜'], smart: ['{self}の趣味は{hobby}です', '{hobby}は頭の休憩になります'],
      serious: ['{self}、{hobby}が好きなんです', '休みの日は{hobby}が楽しみです'], proud: ['{hobby}なら誰にも負けないわ', '{self}の趣味?{hobby}よ'],
      worrier: ['{hobby}のことを考えると落ち着く…', '{self}、{hobby}が好きなんだ…'], stubborn: ['趣味は{hobby}だ。文句あるか', '{hobby}はゆずれん'],
      easygoing: ['{hobby}っていいよね〜', '{self}ね〜、{hobby}が好き〜'],
    },
    mood: {},
  },
  pHabit: {
    common: ['{self}、{ht}んだ'],
    trait: {
      jester: ['{self}ってさ、{ht}んだよね〜'], brave: ['{self}は{ht}んだ!'], clingy: ['{self}ね、{ht}の〜'], smart: ['{self}は{ht}傾向があります'],
      serious: ['{self}、{ht}んです'], proud: ['{self}、{ht}のよ'], worrier: ['{self}、{ht}んだ…'], stubborn: ['{self}は{ht}のだ'], easygoing: ['{self}ね〜、{ht}んだ〜'],
    },
    mood: {},
  },
  pBday: {
    common: ['今日、{self}の誕生日なんだ!'],
    trait: {
      jester: ['今日は{self}の誕生日!お祝いして〜!'], brave: ['今日は誕生日だ!最高の日にするぞ!'], clingy: ['今日ね、{self}の誕生日なの〜!'],
      smart: ['本日は{self}の誕生日です'], serious: ['今日は{self}の誕生日なんです!'], proud: ['今日は{self}の誕生日よ。祝いなさい'],
      worrier: ['今日、誕生日なんだ…覚えててくれた?'], stubborn: ['今日は誕生日だ。祝ってもいいぞ'], easygoing: ['今日は誕生日なんだ〜うれしいな〜'],
    },
    mood: { bad: ['今日は誕生日なんだけど…'], awful: ['…誕生日なのに'] },
  },
});
const RHYTHM_BUDDY_PERSONA_TALK = Object.freeze(Object.fromEntries(Object.keys(RHYTHM_BUDDY_PERSONA_TALK_RAW)
  .map((k) => [k, Object.freeze({ ...RHYTHM_BUDDY_PERSONA_TALK_RAW[k], traitOnly: true })])));
const RHYTHM_BUDDY_PERSONA_KINDS = Object.freeze(Object.keys(RHYTHM_BUDDY_PERSONA_TALK));
// 女の子の子の言い換え(2026-10-16 社長「女の子用のセリフを足す」)。勇敢・頑固・お調子者の、男の子っぽい言い回しのセリフだけ。
// 左がもとのセリフ(33-rhythm-buddy-talk / convo / persona の性格の束にあるもの)、右が女の子の子が話すときの言い方。性格の個性は残す
// (勇敢=元気で強気・頑固=きりっとして譲らない・お調子者=明るく)。女の子の子のときだけ rhythmBuddyTalkPick が差し替える。ほかの子は使わない
const RHYTHM_BUDDY_FEMALE_LINES = Object.freeze({
  "突撃だー!": "突撃よー!",
  "一番乗りで来たぞ!": "一番乗りで来たよ!",
  "呼ばれたからには手は抜かん!": "呼ばれたからには手は抜かないわ!",
  "自分のやり方でいくぞ": "自分のやり方でいくわ",
  "文句は言わせんぞ": "文句は言わせないわよ",
  "手を抜かんから覚悟しろ": "手は抜かないから覚悟しなさい",
  "{song}で勝負だ!": "{song}で勝負よ!",
  "むずかしくてもいくぞ!": "むずかしくてもいくよ!",
  "強気でいける曲だ!": "強気でいける曲ね!",
  "{song}以外は認めん!": "{song}以外は認めないわ!",
  "{song}がいい。譲れん": "{song}がいい。譲れないわ",
  "曲は{song}だ": "曲は{song}よ",
  "{song}でひと笑いとるぞ!": "{song}でひと笑いとるよ!",
  "勝ちにいくぞ!": "勝ちにいくよ!",
  "妥協はせん!": "妥協はしないわ!",
  "一音も逃さん!": "一音も逃さないわ!",
  "絶対に外さんぞ": "絶対に外さないわ",
  "盛り上げるぞー!おー!": "盛り上げるよー!おー!",
  "笑顔で叩くぞ!": "笑顔で叩くよ!",
  "勝ったぞー!!": "勝ったよー!!",
  "当然の結果だ!": "当然の結果よ!",
  "勝利の味だ!": "勝利の味ね!",
  "当然の結果だ": "当然の結果ね",
  "努力は裏切らん!": "努力は裏切らないわ!",
  "これが俺のやり方だ!": "これがあたしのやり方よ!",
  "努力の成果だ": "努力の成果ね",
  "MVPだぞ〜!拍手!": "MVPだよ〜!拍手!",
  "強敵にも勝てそうだ!": "強敵にも勝てそう!",
  "狙いどおりだ": "狙いどおりね",
  "まだ満足せんぞ": "まだ満足しないわよ",
  "これが実力だ!": "これが実力よ!",
  "納得のいく演奏だ": "納得のいく演奏ね",
  "悔しいが、次だ!": "悔しいけど、次よ!",
  "次はもっと攻めるぞ!": "次はもっと攻めるよ!",
  "妥協はせんぞ": "妥協はしないわよ",
  "次は譲らんぞ": "次は譲らないわよ",
  "次は笑わせるぞ!": "次は笑わせるよ!",
  "もう一回だ!!": "もう一回よ!!",
  "認めん!もう一回だ!": "認めないわ!もう一回よ!",
  "あきらめんぞ!": "あきらめないわよ!",
  "こんな結果は認めん": "こんな結果は認めないわ",
  "次は名誉挽回だ!": "次は名誉挽回よ!",
  "席は任せたぞ!": "席は任せたよ!",
  "次は最後までやるぞ!": "次は最後までやるわ!",
  "席をゆずるのは今回だけだぞ": "席をゆずるのは今回だけよ",
  "よろしく!全力でいくぞ!": "よろしく!全力でいくよ!",
  "負けないぞ!": "負けないよ!",
  "よろしくだ!": "よろしくね!",
  "よろしく。手は抜かん": "よろしく。手は抜かないわ",
  "当然のことだ!": "当然のことよ!",
  "礼などいらん": "お礼なんていらないわ",
  "いや、当然だ": "いいえ、当然よ",
  "次ももっとやるぞ!": "次ももっとやるよ!",
  "褒めても何も出んぞ": "褒めても何も出ないわよ",
  "望むところだ!": "望むところよ!",
  "もう一戦だ!": "もう一戦よ!",
  "おう!次こそ決める!": "ええ!次こそ決めるわ!",
  "望むところだ": "望むところよ",
  "次は絶対だ!": "次は絶対よ!",
  "ここにいるぞ!": "ここにいるよ!",
  "いるぞ": "いるわよ",
  "見ればわかるだろう": "見ればわかるでしょう",
  "待つのも戦いだ!": "待つのも戦いよ!",
  "いつでも準備OKだ!": "いつでも準備OKよ!",
  "待つのも訓練だ!": "待つのも訓練よ!",
  "こちらは構わん": "こちらは構わないわ",
  "待つが、長くは待たんぞ": "待つけど、長くは待たないわよ",
  "待つのは性に合わん": "待つのは性に合わないわ",
  "いつでも全力だ!": "いつでも全力よ!",
  "{who}さんはどうだ": "{who}さんはどう?",
  "うむ、その調子だ": "ええ、その調子よ",
  "気合で乗りきるぞ!ついてこい!": "気合で乗りきるよ!ついてきて!",
  "休むのも勝負のうちだ": "休むのも勝負のうちよ",
  "Lv.{lv}。満足はしとらん": "Lv.{lv}。満足はしてないわ",
  "{fav}以外は認めん": "{fav}以外は認めないわ",
  "{song}は譲れん曲だ": "{song}は譲れない曲よ",
  "{trait}だ!": "{trait}よ!",
  "{score}!次はもっと上だ!": "{score}!次はもっと上よ!",
  "{score}。納得はしとらん": "{score}。納得はしてないわ",
  "{plays}回。まだ足りん": "{plays}回。まだ足りないわ",
  "{me}だ。二度は言わん": "{me}よ。二度は言わないわ",
  "ふっ、当然だ!": "ふふっ、当然よ!",
  "おだてても何も出んぞ…": "おだてても何も出ないわよ…",
  "休むのも勝負だ": "休むのも勝負よ",
  "肉だ!肉を食うぞ!": "お肉!お肉を食べるよ!",
  "腹がへっては戦はできん": "おなかがすいては戦はできないわ",
  "乗りこえられる。俺が保証する": "乗りこえられる。あたしが保証するわ",
  "うおー!突撃だ!": "やあー!突撃よ!",
  "次は俺も取る!": "次はあたしも取る!",
  "次は俺が取る": "次はあたしが取るわ",
  "ならばもう一段上へだ": "なら、もう一段上へよ",
  "また勝負だ": "また勝負よ",
  "引く気はない。やるぞ": "引く気はないわ。やるわよ",
  "なんだ": "なに?",
  "{mate}、負けんぞ": "{mate}、負けないわよ",
  "お、{who}さん登場!盛り上がるぞ!": "お、{who}さん登場!盛り上がるよ!",
  "{who}さん、{song}か。いい度胸だ": "{who}さん、{song}ね。いい度胸だわ",
  "{who}さん、見事だ。次は負けん": "{who}さん、見事ね。次は負けないわ",
  "{who}さん、いい腕だ!": "{who}さん、いい腕ね!",
  "{who}さん、立ちあがれ!次だ!": "{who}さん、立ちあがって!次よ!",
  "{who}さん、あきらめるな。次だ": "{who}さん、あきらめないで。次よ",
  "{who}さん、見事だ。脱帽だ": "{who}さん、見事ね。脱帽よ",
  "{who}さん、今日は勝負だ!": "{who}さん、今日は勝負よ!",
  "{topic}の話だ!忘れてないぞ!": "{topic}の話ね!忘れてないよ!",
  "{plays}回、戦ってきた戦友だな!": "{plays}回、戦ってきた戦友ね!",
  "{plays}回目か。今日もやるぞ": "{plays}回目ね。今日もやるわよ",
  "おはよう!朝から全力だ!": "おはよう!朝から全力よ!",
  "こんにちは!昼間も全開だ!": "こんにちは!昼間も全開よ!",
  "こんにちは!昼から笑いをとるぞ!": "こんにちは!昼から笑いをとるよ!",
  "こんばんは!夜の部も全力だ!": "こんばんは!夜の部も全力よ!",
  "こんばんは。夜こそ本番だ": "こんばんは。夜こそ本番よ",
  "夜ふかしか!つき合うぞ!": "夜ふかし?つき合うよ!",
  "Lv.{lv}!強くなったぞ!": "Lv.{lv}!強くなったよ!",
  "Lv.{lv}か。まだまだこれからだ": "Lv.{lv}ね。まだまだこれからよ",
  "{mate}、勝つのはこっちだ": "{mate}、勝つのはこっちよ",
  "{mate}、いい仲間だな!": "{mate}、いい仲間ね!",
  "{mate}か。頼りにしてるぞ": "{mate}ね。頼りにしてるわよ",
  "{who}さん、{self}が来たぞ": "{who}さん、{self}が来たわよ",
  "{self}は手を抜かんぞ": "{self}は手を抜かないわよ",
  "{like}は{self}の得意曲だ!": "{like}は{self}の得意曲よ!",
  "{self}の{like}、見せてやる!": "{self}の{like}、見せてあげる!",
  "{like}は{self}の曲だ": "{like}は{self}の曲よ",
  "{dislike}か。苦手だが逃げないぞ!": "{dislike}ね。苦手だけど逃げないよ!",
  "苦手な{dislike}にも挑むぞ!": "苦手な{dislike}にも挑むよ!",
  "{dislike}か。今日こそ勝つぞ": "{dislike}ね。今日こそ勝つわよ",
  "苦手な{dislike}でも引かん": "苦手な{dislike}でも引かないわ",
  "{hg}!この調子だ!": "{hg}!この調子よ!",
  "{hg}のが効いたぞ": "{hg}のが効いたわ",
  "{hb}。次は外さん": "{hb}。次は外さないわ",
  "勝ったら{food}だ!": "勝ったら{food}よ!",
  "{food}を食べれば百人力だ!": "{food}を食べれば百人力よ!",
  "{food}は譲らんぞ": "{food}は譲らないわよ",
  "{self}の好物は{food}だ": "{self}の好物は{food}よ",
  "{hobby}でも負けないぞ!": "{hobby}でも負けないよ!",
  "{self}の趣味は{hobby}だ!": "{self}の趣味は{hobby}よ!",
  "{hobby}はゆずれん": "{hobby}はゆずれないわ",
  "{self}は{ht}んだ!": "{self}は{ht}の!",
  "{self}は{ht}のだ": "{self}は{ht}のよ",
  "今日は誕生日だ!最高の日にするぞ!": "今日は誕生日よ!最高の日にするよ!",
  "今日は誕生日だ。祝ってもいいぞ": "今日は誕生日よ。祝ってもいいわよ",
});
// 一人称を、既存のセリフの「私」「ぼく」にも当てる(その子の一人称で話す)。
// 女の子の個体は、セリフに直に書かれた「俺」「オイラ」「僕」「拙者」も、その子の一人称にする(2026-10-16)。ほかの子のセリフは変えない
const rhythmBuddyPersonaSelf = (line, self, female = false) => (self ? String(line).replace(female ? /私|ぼく|俺|オイラ|僕|拙者/g : /私|ぼく/g, self) : String(line));
