// ===== 相棒(モンヒロビートのマルチに呼べる、自分のマスモン)の計算 =====
// 仕様の正本: docs/spec/RHYTHM_BUDDY.md(2026-10-07・ユーザーと決めた)
// ここは保存も画面も持たない純粋な計算だけ。保存と画面は 77-screen-rhythm-multi.jsx。
//
// ・育ち具合はマスモン1体ごと(id ごと)。一度でも相棒として呼んだ子だけが持つ。マスモン本体の保存には触れない
// ・Lv(経験値)・曲のなじみ・難易度の熟練・性格(Lv.30で決まる)・その日の調子(朝5:00で変わる)
// ・演奏はしない。曲・難易度・育ち具合から、それらしい判定の数とスコアを作る

// 新しい保存キー(既存のキーは触らない)。中身は rhythmBuddyNormalize を必ず通す
const RHYTHM_BUDDY_KEY = 'mh_rhythm_buddy_v1';
// セッション券のアイテムid(data/breeder.js の一覧と同じ。所持数は mh_owned_items)
const RHYTHM_BUDDY_TICKET_ITEM_ID = 'session_ticket';
// 「マスモンを呼べるようになった」の一度きりの案内を見たか(新しい保存キー)
const RHYTHM_BUDDY_SEEN_KEY = 'mh_rhythm_buddy_seen_v1';
// マスモン全体で1日に無料で呼べる回数(朝5:00で戻る)
const RHYTHM_BUDDY_FREE_PER_DAY = 3;
// 2026-10-07・ユーザー指示「レベルは100まで引き上げてもいい」
const RHYTHM_BUDDY_LEVEL_MAX = 100;
// 性格が決まるLv(育て方が見えるだけ一緒に遊んでから。2026-10-07 に 50 から 30 へ)
const RHYTHM_BUDDY_TRAIT_LEVEL = 30;
// 1体が覚えておく曲の数(なじみ)。超えたら回数の少ない曲から忘れる
const RHYTHM_BUDDY_SONG_KEEP = 80;
const RHYTHM_BUDDY_DIFF_IDS = Object.freeze(['EASY', 'NORMAL', 'HARD', 'EXPERT', 'MASTER']);
// 相棒が取ったスコアを覚えておく回数(伸びのグラフ)
const RHYTHM_BUDDY_RECENT_KEEP = 30;
// 長い曲(のんびり屋が育つ・強い)のしきい
const RHYTHM_BUDDY_LONG_SONG_MS = 150000;

// 性格。上限は上げず、得意・不得意の形だけを変える
// 2026-10-07 ユーザー指示「性格一覧に各効果を設定して」で9つにした(はじめは4つ)。
// how … なりやすい育て方(画面に出す)
const RHYTHM_BUDDY_TRAITS = Object.freeze([
  Object.freeze({ id: 'jester', label: 'ひょうきん', note: '当たり外れが大きい。たまに大きく当てるが、たまに大きく外す', how: 'EXPERT・MASTERをよく遊ぶ' }),
  Object.freeze({ id: 'brave', label: '勇敢', note: '難しい譜面に強い(叩けるLv.を超えても落ちにくい)', how: '自分より難しい譜面によく挑む' }),
  Object.freeze({ id: 'clingy', label: '甘えん坊', note: '毎日呼ぶとご機嫌になりやすい。何日もあくと、すねて不機嫌になりやすい', how: '毎日続けて呼ぶ' }),
  Object.freeze({ id: 'smart', label: 'インテリ', note: '曲の得意が早くたまる', how: 'いろいろな曲を遊ぶ' }),
  Object.freeze({ id: 'serious', label: '真面目', note: 'ブレが小さく、調子の影響を受けにくい', how: 'EASY〜HARDをよく遊ぶ' }),
  Object.freeze({ id: 'proud', label: 'プライドが高い', note: '部屋に人が多いほど張り切って上手になる', how: '人の多い部屋でよく遊ぶ' }),
  Object.freeze({ id: 'worrier', label: '心配性', note: '大きなミスが少なく、コンボが切れにくい。最高判定はやや少ない', how: '調子の悪い日にもよく遊ぶ' }),
  Object.freeze({ id: 'stubborn', label: '頑固', note: 'よく遊ぶ難易度ではとても強いが、慣れていない難易度ではかなり落ちる', how: '同じ難易度ばかり遊ぶ' }),
  Object.freeze({ id: 'easygoing', label: 'のんびり屋', note: '長い曲に強いが、ノーツが詰まった譜面は苦手', how: '長い曲をよく遊ぶ' }),
]);
const RHYTHM_BUDDY_TRAIT_IDS = Object.freeze(RHYTHM_BUDDY_TRAITS.map((t) => t.id));
// はじめの4つで決まっていた子の性格は、読み込むときに置き換える(保存データを壊さない)
const RHYTHM_BUDDY_OLD_TRAITS = Object.freeze({ steady: 'serious', burst: 'jester', stamina: 'easygoing', artisan: 'smart' });

// その日の調子。weight は出やすさ(%)、acc は判定の良さへの足し引き、spread はブレの倍率
const RHYTHM_BUDDY_MOODS = Object.freeze([
  Object.freeze({ id: 'great', label: '超ご機嫌', icon: '😆', weight: 10, acc: 0.06, spread: 0.7, exp: 1.3 }),
  Object.freeze({ id: 'good', label: 'ご機嫌', icon: '😊', weight: 25, acc: 0.03, spread: 0.9, exp: 1.15 }),
  Object.freeze({ id: 'normal', label: '普通', icon: '🙂', weight: 35, acc: 0, spread: 1, exp: 1 }),
  Object.freeze({ id: 'bad', label: '不機嫌', icon: '😒', weight: 20, acc: -0.03, spread: 1.1, exp: 0.85 }),
  Object.freeze({ id: 'awful', label: '超不機嫌', icon: '😠', weight: 10, acc: -0.06, spread: 1.35, exp: 0.7 }),
]);
// 前の日に一緒に遊んでいると、不機嫌・超不機嫌が出にくい(減ったぶんは「普通」へ)
const RHYTHM_BUDDY_MOOD_KEPT_WEIGHTS = Object.freeze({ great: 10, good: 25, normal: 47, bad: 13, awful: 5 });
// 甘えん坊は、前の日にも遊んでいるとご機嫌になりやすく、3日以上あくと不機嫌になりやすい
const RHYTHM_BUDDY_MOOD_CLINGY_KEPT_WEIGHTS = Object.freeze({ great: 22, good: 35, normal: 33, bad: 7, awful: 3 });
const RHYTHM_BUDDY_MOOD_CLINGY_SULK_WEIGHTS = Object.freeze({ great: 5, good: 15, normal: 30, bad: 30, awful: 20 });

const rhythmBuddyInt = (v, max = 1e9) => {
  const n = Math.floor(Number(v));
  return Number.isFinite(n) ? Math.min(max, Math.max(0, n)) : 0;
};
const rhythmBuddyStr = (v, max) => String(v == null ? '' : v).replace(/[\u0000-\u001f]/g, '').slice(0, max);

// 朝5:00(JST)で区切った日付キー(レイドの回数と同じ数え方)
const rhythmBuddyDayKey = (nowMs) => {
  const now = Number.isFinite(nowMs) ? nowMs : 0;
  return new Date(now + 9 * 3600 * 1000 - 5 * 3600 * 1000).toISOString().slice(0, 10);
};
const rhythmBuddyPrevDayKey = (dayKey) => {
  const t = Date.parse(`${dayKey}T00:00:00Z`);
  return Number.isFinite(t) ? new Date(t - 86400000).toISOString().slice(0, 10) : '';
};

// ---- 保存の形 ----
// { day, used, mons: { [masuId]: { exp, lives, songs:{songId:回数}, diffs:{EASY:回数…}, best:{EASY:{score,songId}…}, longLives, trait, traitAt, lastRound, lastDay, firstAt } } }
const rhythmBuddyNormalizeMon = (raw) => {
  const o = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  const songs = {};
  if (o.songs && typeof o.songs === 'object' && !Array.isArray(o.songs)) {
    Object.keys(o.songs).slice(0, RHYTHM_BUDDY_SONG_KEEP * 2).forEach((id) => {
      const key = rhythmBuddyStr(id, 60);
      const n = rhythmBuddyInt(o.songs[id], 100000);
      if (key && n > 0) songs[key] = n;
    });
  }
  const diffs = {};
  RHYTHM_BUDDY_DIFF_IDS.forEach((id) => { diffs[id] = rhythmBuddyInt(o.diffs && o.diffs[id], 1e6); });
  // 難易度ごとの最高スコア(2026-10-07 追加。ランキング用)。{ EASY:{ score, songId }… }。
  // 無い人は、残っている最近のスコアから拾い直す(最近のスコアは30件までなので、それより前の最高は拾えない)
  const recent = (Array.isArray(o.recent) ? o.recent : []).filter((x) => x && typeof x === 'object').slice(0, RHYTHM_BUDDY_RECENT_KEEP).map((x) => ({
    at: rhythmBuddyInt(x.at, 9e15), songId: rhythmBuddyStr(x.songId, 60),
    diffId: RHYTHM_BUDDY_DIFF_IDS.includes(x.diffId) ? x.diffId : '',
    score: rhythmBuddyInt(x.score, 1e7), max: Math.max(1, rhythmBuddyInt(x.max, 1e7)),
  })).filter((x) => x.score <= x.max);
  const best = {};
  const takeBest = (diffId, score, songId) => {
    if (!RHYTHM_BUDDY_DIFF_IDS.includes(diffId) || !(score > 0)) return;
    if (!best[diffId] || score > best[diffId].score) best[diffId] = { score, songId: rhythmBuddyStr(songId, 60) };
  };
  if (o.best && typeof o.best === 'object' && !Array.isArray(o.best)) {
    RHYTHM_BUDDY_DIFF_IDS.forEach((id) => { const b = o.best[id]; if (b && typeof b === 'object') takeBest(id, rhythmBuddyInt(b.score, 1e7), b.songId); });
  }
  recent.forEach((x) => takeBest(x.diffId, x.score, x.songId));
  return {
    exp: rhythmBuddyInt(o.exp),
    lives: rhythmBuddyInt(o.lives),
    songs,
    diffs,
    best,
    longLives: rhythmBuddyInt(o.longLives),
    trait: RHYTHM_BUDDY_TRAIT_IDS.includes(o.trait) ? o.trait : (RHYTHM_BUDDY_OLD_TRAITS[o.trait] || ''),
    // 性格を決めるための記録(2026-10-07 追加。無ければ0)
    hardLives: rhythmBuddyInt(o.hardLives), crowdLives: rhythmBuddyInt(o.crowdLives), badMoodLives: rhythmBuddyInt(o.badMoodLives),
    streakDays: rhythmBuddyInt(o.streakDays, 9999), bestStreakDays: rhythmBuddyInt(o.bestStreakDays, 9999),
    traitAt: rhythmBuddyInt(o.traitAt),
    lastRound: rhythmBuddyStr(o.lastRound, 40),
    lastDay: rhythmBuddyStr(o.lastDay, 10),
    firstAt: rhythmBuddyInt(o.firstAt, 9e15),
    // 最近のスコア(新しい順・2026-10-07 追加)。無い・壊れているときは空
    recent,
  };
};
const rhythmBuddyNormalize = (raw) => {
  const o = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  const mons = {};
  if (o.mons && typeof o.mons === 'object' && !Array.isArray(o.mons)) {
    Object.keys(o.mons).slice(0, 2000).forEach((id) => {
      const key = rhythmBuddyStr(id, 80);
      if (key) mons[key] = rhythmBuddyNormalizeMon(o.mons[id]);
    });
  }
  return { day: rhythmBuddyStr(o.day, 10), used: rhythmBuddyInt(o.used, 99), mons };
};

// ---- 1日の回数 ----
const rhythmBuddyFreeLeft = (state, dayKey) => {
  const st = rhythmBuddyNormalize(state);
  const used = st.day === dayKey ? st.used : 0;
  return Math.max(0, RHYTHM_BUDDY_FREE_PER_DAY - used);
};
// 無料ぶんを1回使う。残っていなければ null(呼ぶ側がセッション券を使う)
const rhythmBuddyUseFree = (state, dayKey) => {
  const st = rhythmBuddyNormalize(state);
  if (rhythmBuddyFreeLeft(st, dayKey) <= 0) return null;
  const used = st.day === dayKey ? st.used : 0;
  return { ...st, day: dayKey, used: used + 1 };
};

// 使った無料ぶんを1回返す(人が来て、呼んだマスモンが席をゆずったとき)。同じ日のときだけ
const rhythmBuddyRefundFree = (state, dayKey) => {
  const st = rhythmBuddyNormalize(state);
  if (st.day !== dayKey || st.used <= 0) return null;
  return { ...st, used: st.used - 1 };
};

// ---- レベル ----
// Lv n → n+1 に要る経験値。Lv.50 までおよそ1,800、Lv.100 までおよそ6,500。
// 1ライブ平均50前後なので、Lv.50 まで約37ライブ、Lv.100 まで約130ライブ(1日15ライブなら9日ほど)
// (2026-10-07・ユーザー指示「うまくなるデメリットがないからもっと早く」→「必要経験値を1/10」)
const rhythmBuddyNeedExp = (level) => Math.round(6 + 1.2 * Math.max(1, level));
const rhythmBuddyLevelInfo = (exp) => {
  let rest = rhythmBuddyInt(exp);
  let level = 1;
  while (level < RHYTHM_BUDDY_LEVEL_MAX && rest >= rhythmBuddyNeedExp(level)) { rest -= rhythmBuddyNeedExp(level); level += 1; }
  const need = level >= RHYTHM_BUDDY_LEVEL_MAX ? 0 : rhythmBuddyNeedExp(level);
  return { level, into: level >= RHYTHM_BUDDY_LEVEL_MAX ? 0 : rest, need };
};
// 1ライブの経験値。難しい難易度・高いチームランクほど多い
const RHYTHM_BUDDY_RANK_EXP = Object.freeze({ M: 30, SS: 26, S: 22, A: 18, B: 14, C: 10, D: 7, E: 5, F: 3, G: 0 });
// 今日の調子で経験値(成長)が変わる(2026-10-07・ユーザー指示「成長率を機嫌によって変えたい」)。
// 真面目は「調子の影響を受けにくい」ので、倍率の差を半分にする。返り値は経験値にかける倍率
const rhythmBuddyMoodExpScale = (moodId, trait = '') => {
  const mood = RHYTHM_BUDDY_MOODS.find((x) => x.id === moodId);
  const scale = mood ? mood.exp : 1;
  return Math.round((trait === 'serious' ? 1 + (scale - 1) / 2 : scale) * 1000) / 1000;
};
const rhythmBuddyExpGain = (diffId, teamRank, moodId = '', trait = '') => {
  const d = Math.max(0, RHYTHM_BUDDY_DIFF_IDS.indexOf(diffId));
  const base = 20 + d * 6 + (RHYTHM_BUDDY_RANK_EXP[teamRank] || 0);
  return Math.max(1, Math.round(base * rhythmBuddyMoodExpScale(moodId, trait)));
};

// ---- 曲のなじみ(星0〜5) ----
const RHYTHM_BUDDY_FAMILIAR_STEPS = Object.freeze([1, 3, 6, 10, 15]);
const rhythmBuddyFamiliarStars = (plays, trait) => {
  // インテリは1.5倍の速さでたまる
  const n = rhythmBuddyInt(plays) * (trait === 'smart' ? 1.5 : 1);
  return RHYTHM_BUDDY_FAMILIAR_STEPS.filter((step) => n >= step).length;
};
// 得意な曲(回数の多い順)
// 相棒が曲をえらぶときの理由(画面へ出すひとこと)。通信には文字の短いコードだけ流す
const RHYTHM_BUDDY_PICK_WHY = Object.freeze({
  fav: 'この曲が得意!', hard: 'ちょっと難しい曲に挑戦!', safe: '今日は慣れた曲で安心したい', long: '長い曲をのんびり楽しみたい',
  fun: '気分で選んだよ', new: 'はじめての曲にワクワク!',
});
// 新しい曲(まだ一緒に遊んでいない曲)に挑戦する確率。性格と今日の調子で変わる
const rhythmBuddyNewSongChance = (trait, moodId) => {
  const base = { jester: 0.25, brave: 0.2, stubborn: 0.04, serious: 0.08 }[trait];
  const mood = { great: 0.08, good: 0.04, bad: -0.04, awful: -0.08 }[moodId] || 0;
  return Math.round(Math.min(0.4, Math.max(0, (base == null ? 0.12 : base) + mood)) * 100) / 100;
};
// 相棒の選曲(2026-10-07・ユーザー指示「もうちょい選曲に意思をもたせる」)。本番の曲は人の選曲だけで決まるので、
// これはシャッフル画面で見せる「相棒の気持ち」。info(songId) → { level, durationMs } は曲の最高Lv.と長さ
// 返り値 { songId, why }。why は RHYTHM_BUDDY_PICK_WHY のキー。遊べる曲が無ければ songId は ''
const rhythmBuddyChooseSong = (mon, catalog, { mood = null, info = null, rand = Math.random } = {}) => {
  const m = rhythmBuddyNormalizeMon(mon);
  const list = Array.isArray(catalog) ? catalog.filter((id) => typeof id === 'string' && id) : [];
  if (!list.length) return { songId: '', why: '' };
  const pickOne = (arr) => arr[Math.min(arr.length - 1, Math.floor(rand() * arr.length))];
  const played = rhythmBuddyTopSongs(m, RHYTHM_BUDDY_SONG_KEEP).map((x) => x.songId).filter((id) => list.includes(id));
  if (!played.length) return { songId: pickOne(list), why: 'new' };
  const fresh = list.filter((id) => !played.includes(id));
  const moodId = mood && mood.id;
  if (fresh.length && rand() < rhythmBuddyNewSongChance(m.trait, moodId)) return { songId: pickOne(fresh), why: 'new' };
  const top = played.slice(0, 5);
  const stat = (id, key) => { try { return Number(info && info(id) && info(id)[key]) || 0; } catch (_) { return 0; } };
  const most = (arr, key) => arr.reduce((a, b) => (stat(b, key) > stat(a, key) ? b : a), arr[0]);
  if (m.trait === 'easygoing' && info) return { songId: most(top, 'durationMs'), why: 'long' };
  if (moodId === 'bad' || moodId === 'awful' || m.trait === 'worrier') return { songId: top[0], why: 'safe' };
  if ((moodId === 'great' || moodId === 'good' || m.trait === 'brave') && info) return { songId: most(top, 'level'), why: 'hard' };
  if (m.trait === 'jester') return { songId: pickOne(top), why: 'fun' };
  return { songId: pickOne(top.slice(0, 3)), why: 'fav' };
};
const rhythmBuddyTopSongs = (mon, count = 5) => {
  const m = rhythmBuddyNormalizeMon(mon);
  return Object.keys(m.songs).map((songId) => ({ songId, plays: m.songs[songId], stars: rhythmBuddyFamiliarStars(m.songs[songId], m.trait) }))
    .sort((a, b) => (b.plays - a.plays) || (a.songId < b.songId ? -1 : 1)).slice(0, count);
};

// ---- 難易度の熟練(0〜1) ----
const rhythmBuddyMastery = (plays) => 1 - Math.exp(-rhythmBuddyInt(plays) / 15);

// ---- 種類ごとの、なりやすい性格 ----
// 基本の能力値のうち、全種類の中でいちばん抜けているもので決める
//   丈夫さ → 真面目 / ちから → 勇敢 / ライフ → のんびり屋 / ガッツ → ひょうきん
// allBases は全種類の { baseHp, baseAtk, baseDef, baseGuts } の一覧(新しい種類が増えても表を足さなくてよい)
const rhythmBuddySpeciesLean = (base, allBases) => {
  const list = Array.isArray(allBases) ? allBases.filter((b) => b && typeof b === 'object') : [];
  if (!base || !list.length) return 'serious';
  const keys = [['baseDef', 'serious'], ['baseAtk', 'brave'], ['baseHp', 'easygoing'], ['baseGuts', 'jester']];
  let best = 'serious';
  let bestZ = -Infinity;
  keys.forEach(([k, trait]) => {
    const vals = list.map((b) => Number(b[k]) || 0);
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    const z = max > min ? ((Number(base[k]) || 0) - min) / (max - min) : 0;
    if (z > bestZ) { bestZ = z; best = trait; }
  });
  return best;
};

// ---- 性格を育ち方から決める ----
// 9つの点数(0〜1くらい)のいちばん高いもの。種類の傾向は、はじめに少しだけ点を足す(育て方で上書きできる)
const rhythmBuddyTraitScores = (mon, lean) => {
  const m = rhythmBuddyNormalizeMon(mon);
  const total = Math.max(1, m.lives);
  const share = (n) => Math.min(1, n / total);
  const low = share(m.diffs.EASY + m.diffs.NORMAL + m.diffs.HARD);
  const high = share(m.diffs.EXPERT + m.diffs.MASTER);
  const topDiff = share(Math.max(...RHYTHM_BUDDY_DIFF_IDS.map((id) => m.diffs[id])));
  const variety = Math.min(1, Object.keys(m.songs).length / total * 1.5);
  const scores = {
    jester: high * 0.9,
    brave: share(m.hardLives) * 1.2,
    clingy: Math.min(1, m.bestStreakDays / 10) * 0.9,
    smart: variety * 0.8,
    serious: low * 0.8,
    proud: share(m.crowdLives) * 1.1,
    worrier: share(m.badMoodLives) * 2,
    stubborn: Math.max(0, (topDiff - 0.6) / 0.4) * 0.9,
    easygoing: share(m.longLives) * 1.4,
  };
  if (RHYTHM_BUDDY_TRAIT_IDS.includes(lean)) scores[lean] += 0.25;
  return scores;
};
// Lv.30 で決まる。決まったあとは、10ライブごとに見直し、別の性格が 0.3 以上上回ったときだけゆっくり変わる
const rhythmBuddyNextTrait = (mon, lean) => {
  const m = rhythmBuddyNormalizeMon(mon);
  if (rhythmBuddyLevelInfo(m.exp).level < RHYTHM_BUDDY_TRAIT_LEVEL) return '';
  const scores = rhythmBuddyTraitScores(m, lean);
  const best = RHYTHM_BUDDY_TRAIT_IDS.slice().sort((a, b) => scores[b] - scores[a])[0];
  if (!m.trait) return best;
  if (m.lives - m.traitAt < 10) return m.trait;
  return scores[best] >= scores[m.trait] + 0.3 ? best : m.trait;
};
const rhythmBuddyTraitOf = (id) => RHYTHM_BUDDY_TRAITS.find((t) => t.id === id) || null;

// ---- その日の調子 ----
// マスモンの id と日付から決める(その日のうちは何度見ても同じ。端末をまたいでも同じ)
const rhythmBuddyHash = (text) => {
  let h = 2166136261;
  const s = String(text);
  for (let i = 0; i < s.length; i += 1) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0) / 4294967296;
};
const rhythmBuddyMood = (masuId, dayKey, mon) => {
  const m = rhythmBuddyNormalizeMon(mon);
  const kept = !!m.lastDay && m.lastDay === rhythmBuddyPrevDayKey(dayKey);
  // 甘えん坊: 毎日呼ぶとご機嫌になりやすく、3日以上あくと、すねて不機嫌になりやすい
  const lastT = Date.parse(`${m.lastDay}T00:00:00Z`);
  const nowT = Date.parse(`${dayKey}T00:00:00Z`);
  const gapDays = Number.isFinite(lastT) && Number.isFinite(nowT) ? Math.round((nowT - lastT) / 86400000) : 0;
  const table = m.trait === 'clingy' && kept ? RHYTHM_BUDDY_MOOD_CLINGY_KEPT_WEIGHTS
    : m.trait === 'clingy' && gapDays >= 3 ? RHYTHM_BUDDY_MOOD_CLINGY_SULK_WEIGHTS
      : kept ? RHYTHM_BUDDY_MOOD_KEPT_WEIGHTS : null;
  const weights = RHYTHM_BUDDY_MOODS.map((mood) => (table ? table[mood.id] : mood.weight));
  const sum = weights.reduce((a, b) => a + b, 0);
  let r = rhythmBuddyHash(`${masuId}|${dayKey}`) * sum;
  for (let i = 0; i < RHYTHM_BUDDY_MOODS.length; i += 1) { r -= weights[i]; if (r < 0) return RHYTHM_BUDDY_MOODS[i]; }
  return RHYTHM_BUDDY_MOODS[2];
};

// ---- うまさ(判定の良さ 0〜1) ----
// 相棒の育ち具合から「無理なく叩ける譜面のLv.」を決め、それより上の譜面ほど落ちる(2026-10-07・ユーザー指示
// 「曲の難易度補正」→ 譜面のLv.とノーツの密度で補正)。譜面のLv.は配信中の曲で EASY 4〜15 / MASTER 17〜47。
// 密度(1秒あたりのノーツ数)は平均で「1 + Lv.÷10」くらいなので、それより詰まっている譜面はさらに少し落ちる
// 画面に出す「無理なく叩ける譜面のLv.」(曲の得意を入れない値。得意な曲は最大+5)
const rhythmBuddyComfortLevelOf = (mon) => {
  const m = rhythmBuddyNormalizeMon(mon);
  return Math.floor(rhythmBuddyComfortLevel(rhythmBuddyLevelInfo(m.exp).level, 0, m.trait));
};
const rhythmBuddyComfortLevel = (level, songPlays, trait) => 14 + 40 * rhythmBuddyGrowthRate(level) + 50 * rhythmBuddySongSkill(songPlays, trait);
const rhythmBuddyAccuracy = ({ mon, songId, diffId, durationMs, mood, chartLevel, density, humans = 1 }) => {
  const m = rhythmBuddyNormalizeMon(mon);
  const { level } = rhythmBuddyLevelInfo(m.exp);
  const d = Math.max(0, RHYTHM_BUDDY_DIFF_IDS.indexOf(diffId));
  const mastery = rhythmBuddyMastery(m.diffs[RHYTHM_BUDDY_DIFF_IDS[d]]);
  // 譜面のLv.が分からないときは、難易度の種類からだいたいの値を使う
  const chartLv = Number(chartLevel) > 0 ? Number(chartLevel) : [7, 9, 14, 19, 26][d];
  // はじめのうちほど大きく伸び、育ちきると人より上手
  let acc = 0.68 + 0.27 * rhythmBuddyGrowthRate(level);
  // 遊んだ曲ほど得意になる(2026-10-07・ユーザー指示)。最大 +0.06(無理なく叩けるLv.も最大+5)
  acc += 0.6 * rhythmBuddySongSkill(m.songs[songId], m.trait);
  // 難易度の種類ごとの慣れ(譜面のLv.と役目が重なるので小さめ)
  // 頑固は、慣れた難易度でとても強く、慣れていない難易度でかなり落ちる(効き目2倍)
  const masteryRate = m.trait === 'stubborn' ? 2 : 1;
  acc += (0.03 * mastery - d * 0.012 * (1 - mastery)) * masteryRate;
  // 譜面のLv.: 無理なく叩けるLv.を超えたぶん1つごとに -0.015(最大 -0.35)。下回るぶんは少しだけ楽(最大 +0.02)
  const over = chartLv - rhythmBuddyComfortLevel(level, m.songs[songId], m.trait);
  // 勇敢は、超えたぶんの落ち方が7割
  acc -= over > 0 ? Math.min(0.35, over * 0.015) * (m.trait === 'brave' ? 0.7 : 1) : -Math.min(0.02, -over * 0.002);
  // 密度: Lv.の割に詰まっているぶん(1秒あたり1つ多いごとに -0.04)
  const dens = Number(density);
  if (Number.isFinite(dens) && dens > 0) {
    const extra = dens - (1 + chartLv / 10);
    // のんびり屋は、詰まった譜面が苦手(1.5倍落ちる)
    if (extra > 0) acc -= extra * 0.04 * (m.trait === 'easygoing' ? 1.5 : 1);
  }
  if (m.trait === 'easygoing') acc += Number(durationMs) >= RHYTHM_BUDDY_LONG_SONG_MS ? 0.025 : -0.01;
  // プライドが高い: 部屋の人(呼んだマスモンを除く)が多いほど張り切る。ひとりだと少し手を抜く
  if (m.trait === 'proud') acc += Math.max(-0.01, Math.min(0.04, 0.012 * (Math.floor(Number(humans) || 1) - 1) - (Number(humans) <= 1 ? 0.01 : 0)));
  const moodAcc = mood ? mood.acc : 0;
  acc += m.trait === 'serious' ? moodAcc * 0.5 : moodAcc;
  // 上限は満点(判定の良さ1)。満点まで届くかは、うまさとブレしだい
  return Math.max(0.1, Math.min(1, acc));
};
// Lv の伸び(0〜1)。はじめのうちほど大きく伸びる
const rhythmBuddyGrowthRate = (level) => Math.pow((Math.max(1, level) - 1) / (RHYTHM_BUDDY_LEVEL_MAX - 1), 0.7);
// その曲の得意(0〜0.10)。遊んだ回数でなだらかに増える。インテリは1.5倍の速さ
const rhythmBuddySongSkill = (plays, trait) => 0.1 * (1 - Math.exp(-rhythmBuddyInt(plays) * (trait === 'smart' ? 1.5 : 1) / 12));
// ブレ(標準偏差)。うまくなるほど小さくなる(育てはじめは日によって大きく外す)。性格と調子でも変わる
const rhythmBuddySpread = (trait, mood, level = 1) => {
  const base = trait === 'serious' ? 0.02 : trait === 'jester' ? 0.055 : 0.035;
  return base * (1.6 - 1.1 * rhythmBuddyGrowthRate(level)) * (mood ? mood.spread : 1);
};

// ---- 演奏の結果を作る ----
// rand は 0〜1 を返す関数(呼ぶ側が渡す)。戻り値は演奏側の result と同じ形の一部
const rhythmBuddyNormal = (rand) => {
  const u = Math.max(1e-9, rand());
  const v = rand();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
};
const rhythmBuddyPlay = ({ mon, songId, diffId, totalNotes, maxScore, durationMs, mood, rand, chartLevel = 0, humans = 1 }) => {
  const r = typeof rand === 'function' ? rand : Math.random;
  const m = rhythmBuddyNormalizeMon(mon);
  const total = Math.max(1, rhythmBuddyInt(totalNotes, 100000));
  const max = Number(maxScore) > 0 ? Number(maxScore) : 1000000;
  const level = rhythmBuddyLevelInfo(m.exp).level;
  const density = Number(durationMs) > 0 ? total / (Number(durationMs) / 1000) : 0;
  let acc = rhythmBuddyAccuracy({ mon: m, songId, diffId, durationMs, mood, chartLevel, density, humans }) + rhythmBuddyNormal(r) * rhythmBuddySpread(m.trait, mood, level);
  // ひょうきんは、たまに(8%)大きく当て、たまに(8%)大きく外す
  if (m.trait === 'jester') { const roll = r(); if (roll < 0.08) acc += 0.06; else if (roll < 0.16) acc -= 0.06; }
  acc = Math.max(0.1, Math.min(1, acc));
  const miss = 1 - acc;
  // 心配性は、大きなミス(MISS・BAD)が少ないかわりに、GOOD・GREATが多い
  const share = m.trait === 'worrier'
    ? { MISS: miss * 0.25, BAD: miss * 0.1, GOOD: miss * 0.35, GREAT: miss * 0.3 }
    : { MISS: miss * 0.45, BAD: miss * 0.15, GOOD: miss * 0.2, GREAT: miss * 0.2 };
  const counts = { MARVELOUS: 0, EXCELLENT: 0, GREAT: 0, GOOD: 0, BAD: 0, MISS: 0 };
  ['MISS', 'BAD', 'GOOD', 'GREAT'].forEach((id) => { counts[id] = Math.round(total * share[id]); });
  const rest = Math.max(0, total - counts.MISS - counts.BAD - counts.GOOD - counts.GREAT);
  // 心配性は、最高判定がやや少ない
  counts.MARVELOUS = Math.round(rest * acc * (m.trait === 'worrier' ? 0.92 : 1));
  counts.EXCELLENT = rest - counts.MARVELOUS;
  const breaks = counts.MISS + counts.BAD;
  // 切れた数で割った長さに、ばらつきを少し(いちばん長いつながりは平均より長い)
  const maxCombo = breaks === 0 ? total : Math.min(total - breaks, Math.round((total - breaks) / (breaks + 1) * (1.6 + r() * 1.4)));
  const rates = { MARVELOUS: 1, EXCELLENT: 0.98, GREAT: 0.9, GOOD: 0.7, BAD: 0.3, MISS: 0 };
  const judged = Object.keys(counts).reduce((sum, id) => sum + counts[id] * rates[id], 0);
  const score = Math.min(max, Math.round((judged / total * 0.9 + maxCombo / total * 0.1) * max));
  const offBeat = counts.EXCELLENT + counts.GREAT + counts.GOOD + counts.BAD;
  const fast = Math.round(offBeat * (0.35 + r() * 0.3));
  return {
    score, maxCombo, cleared: true, judgments: counts, fast, slow: offBeat - fast,
    fullCombo: breaks === 0, allExcellent: breaks === 0 && counts.GREAT + counts.GOOD === 0, allMarvelous: false,
  };
};

// ---- 1ライブぶん育てる ----
// 同じ回(round)は2度数えない。戻り値の gain/levelUp/familiarUp/traitNew は結果画面に出す
const rhythmBuddyApplyLive = (mon, { round, songId, diffId, durationMs, teamRank, dayKey, lean, nowMs, score, maxScore, chartLevel = 0, humans = 1, moodId = '' }) => {
  const before = rhythmBuddyNormalizeMon(mon);
  if (!round || before.lastRound === round) return { mon: before, gain: 0, levelUp: 0, familiarUp: false, traitNew: '' };
  const gain = rhythmBuddyExpGain(diffId, teamRank, moodId, before.trait);
  const songs = { ...before.songs };
  const sid = rhythmBuddyStr(songId, 60);
  if (sid) songs[sid] = (songs[sid] || 0) + 1;
  // 覚えておく曲の数を超えたら、回数の少ない曲から忘れる(いま遊んだ曲は残す)
  const ids = Object.keys(songs);
  if (ids.length > RHYTHM_BUDDY_SONG_KEEP) {
    ids.filter((id) => id !== sid).sort((a, b) => songs[a] - songs[b]).slice(0, ids.length - RHYTHM_BUDDY_SONG_KEEP).forEach((id) => { delete songs[id]; });
  }
  const diffs = { ...before.diffs };
  if (RHYTHM_BUDDY_DIFF_IDS.includes(diffId)) diffs[diffId] += 1;
  const after = {
    ...before, exp: before.exp + gain, lives: before.lives + 1, songs, diffs,
    longLives: before.longLives + (Number(durationMs) >= RHYTHM_BUDDY_LONG_SONG_MS ? 1 : 0),
    // 性格を決めるための記録: 自分より難しい譜面 / 人が3人以上の部屋 / 調子の悪い日 / 毎日続けて呼んだ日数
    hardLives: before.hardLives + (Number(chartLevel) > rhythmBuddyComfortLevel(rhythmBuddyLevelInfo(before.exp).level, before.songs[sid] || 0, before.trait) ? 1 : 0),
    crowdLives: before.crowdLives + (Number(humans) >= 3 ? 1 : 0),
    badMoodLives: before.badMoodLives + (moodId === 'bad' || moodId === 'awful' ? 1 : 0),
    streakDays: before.lastDay === dayKey ? Math.max(1, before.streakDays) : before.lastDay && before.lastDay === rhythmBuddyPrevDayKey(dayKey) ? before.streakDays + 1 : 1,
    lastRound: rhythmBuddyStr(round, 40), lastDay: rhythmBuddyStr(dayKey, 10),
    firstAt: before.firstAt || rhythmBuddyInt(nowMs, 9e15),
    recent: Number.isFinite(Number(score)) && Number(maxScore) > 0
      ? [{ at: rhythmBuddyInt(nowMs, 9e15), songId: sid, diffId: RHYTHM_BUDDY_DIFF_IDS.includes(diffId) ? diffId : '', score: Math.min(rhythmBuddyInt(score, 1e7), rhythmBuddyInt(maxScore, 1e7)), max: rhythmBuddyInt(maxScore, 1e7) }, ...before.recent].slice(0, RHYTHM_BUDDY_RECENT_KEEP)
      : before.recent,
  };
  after.bestStreakDays = Math.max(before.bestStreakDays, after.streakDays);
  if (RHYTHM_BUDDY_DIFF_IDS.includes(diffId) && Number(maxScore) > 0 && Number.isFinite(Number(score))) {
    const got = Math.min(rhythmBuddyInt(score, 1e7), rhythmBuddyInt(maxScore, 1e7));
    if (got > ((before.best[diffId] && before.best[diffId].score) || 0)) after.best = { ...before.best, [diffId]: { score: got, songId: sid } };
  }
  const trait = rhythmBuddyNextTrait(after, lean);
  const traitNew = trait && trait !== before.trait ? trait : '';
  if (traitNew) { after.trait = traitNew; after.traitAt = after.lives; }
  const levelUp = rhythmBuddyLevelInfo(after.exp).level - rhythmBuddyLevelInfo(before.exp).level;
  const familiarUp = !!sid && rhythmBuddyFamiliarStars(songs[sid], after.trait) > rhythmBuddyFamiliarStars(before.songs[sid] || 0, before.trait);
  return { mon: after, gain, levelUp, familiarUp, traitNew };
};
