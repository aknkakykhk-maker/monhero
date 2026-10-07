// ===== 相棒(モンヒロビートのマルチに呼べる、自分のマスモン)の計算 =====
// 仕様の正本: docs/spec/RHYTHM_BUDDY.md(2026-10-07・ユーザーと決めた)
// ここは保存も画面も持たない純粋な計算だけ。保存と画面は 77-screen-rhythm-multi.jsx。
//
// ・育ち具合はマスモン1体ごと(id ごと)。一度でも相棒として呼んだ子だけが持つ。マスモン本体の保存には触れない
// ・Lv(経験値)・曲のなじみ・難易度の熟練・性格(Lv.50で決まる)・その日の調子(朝5:00で変わる)
// ・演奏はしない。曲・難易度・育ち具合から、それらしい判定の数とスコアを作る

// 新しい保存キー(既存のキーは触らない)。中身は rhythmBuddyNormalize を必ず通す
const RHYTHM_BUDDY_KEY = 'mh_rhythm_buddy_v1';
// 相棒券のアイテムid(data/breeder.js の一覧と同じ。所持数は mh_owned_items)
const RHYTHM_BUDDY_TICKET_ITEM_ID = 'buddy_ticket';
// 「相棒を呼べるようになった」の一度きりの案内を見たか(新しい保存キー)
const RHYTHM_BUDDY_SEEN_KEY = 'mh_rhythm_buddy_seen_v1';
// マスモン全体で1日に無料で呼べる回数(朝5:00で戻る)
const RHYTHM_BUDDY_FREE_PER_DAY = 3;
// 2026-10-07・ユーザー指示「レベルは100まで引き上げてもいい」
const RHYTHM_BUDDY_LEVEL_MAX = 100;
// 性格が決まるLv(育て方が見えるだけ一緒に遊んでから。Lv.50 は約37ライブ)
const RHYTHM_BUDDY_TRAIT_LEVEL = 50;
// 1体が覚えておく曲の数(なじみ)。超えたら回数の少ない曲から忘れる
const RHYTHM_BUDDY_SONG_KEEP = 80;
const RHYTHM_BUDDY_DIFF_IDS = Object.freeze(['EASY', 'NORMAL', 'HARD', 'EXPERT', 'MASTER']);
// 長い曲(粘り型が育つ・強い)のしきい
const RHYTHM_BUDDY_LONG_SONG_MS = 150000;

// 性格。上限は上げず、得意・不得意の形だけを変える
const RHYTHM_BUDDY_TRAITS = Object.freeze([
  Object.freeze({ id: 'steady', label: '安定型', note: 'ブレが小さく、調子の影響を受けにくい' }),
  Object.freeze({ id: 'burst', label: '一発型', note: 'ブレが大きく、たまに大きく当てる' }),
  Object.freeze({ id: 'stamina', label: '粘り型', note: '長い曲ほど強い' }),
  Object.freeze({ id: 'artisan', label: '職人型', note: 'なじみが早くたまり、得意な曲に強い' }),
]);
const RHYTHM_BUDDY_TRAIT_IDS = Object.freeze(RHYTHM_BUDDY_TRAITS.map((t) => t.id));

// その日の調子。weight は出やすさ(%)、acc は判定の良さへの足し引き、spread はブレの倍率
const RHYTHM_BUDDY_MOODS = Object.freeze([
  Object.freeze({ id: 'great', label: '超ご機嫌', icon: '😆', weight: 10, acc: 0.06, spread: 0.7 }),
  Object.freeze({ id: 'good', label: 'ご機嫌', icon: '😊', weight: 25, acc: 0.03, spread: 0.9 }),
  Object.freeze({ id: 'normal', label: '普通', icon: '🙂', weight: 35, acc: 0, spread: 1 }),
  Object.freeze({ id: 'bad', label: '不機嫌', icon: '😒', weight: 20, acc: -0.03, spread: 1.1 }),
  Object.freeze({ id: 'awful', label: '超不機嫌', icon: '😠', weight: 10, acc: -0.06, spread: 1.35 }),
]);
// 前の日に一緒に遊んでいると、不機嫌・超不機嫌が出にくい(減ったぶんは「普通」へ)
const RHYTHM_BUDDY_MOOD_KEPT_WEIGHTS = Object.freeze({ great: 10, good: 25, normal: 47, bad: 13, awful: 5 });

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
// { day, used, mons: { [masuId]: { exp, lives, songs:{songId:回数}, diffs:{EASY:回数…}, longLives, trait, traitAt, lastRound, lastDay, firstAt } } }
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
  return {
    exp: rhythmBuddyInt(o.exp),
    lives: rhythmBuddyInt(o.lives),
    songs,
    diffs,
    longLives: rhythmBuddyInt(o.longLives),
    trait: RHYTHM_BUDDY_TRAIT_IDS.includes(o.trait) ? o.trait : '',
    traitAt: rhythmBuddyInt(o.traitAt),
    lastRound: rhythmBuddyStr(o.lastRound, 40),
    lastDay: rhythmBuddyStr(o.lastDay, 10),
    firstAt: rhythmBuddyInt(o.firstAt, 9e15),
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
// 無料ぶんを1回使う。残っていなければ null(呼ぶ側が相棒券を使う)
const rhythmBuddyUseFree = (state, dayKey) => {
  const st = rhythmBuddyNormalize(state);
  if (rhythmBuddyFreeLeft(st, dayKey) <= 0) return null;
  const used = st.day === dayKey ? st.used : 0;
  return { ...st, day: dayKey, used: used + 1 };
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
const rhythmBuddyExpGain = (diffId, teamRank) => {
  const d = Math.max(0, RHYTHM_BUDDY_DIFF_IDS.indexOf(diffId));
  return 20 + d * 6 + (RHYTHM_BUDDY_RANK_EXP[teamRank] || 0);
};

// ---- 曲のなじみ(星0〜5) ----
const RHYTHM_BUDDY_FAMILIAR_STEPS = Object.freeze([1, 3, 6, 10, 15]);
const rhythmBuddyFamiliarStars = (plays, trait) => {
  // 職人型は1.5倍の速さでたまる
  const n = rhythmBuddyInt(plays) * (trait === 'artisan' ? 1.5 : 1);
  return RHYTHM_BUDDY_FAMILIAR_STEPS.filter((step) => n >= step).length;
};
// 得意な曲(回数の多い順)
const rhythmBuddyTopSongs = (mon, count = 5) => {
  const m = rhythmBuddyNormalizeMon(mon);
  return Object.keys(m.songs).map((songId) => ({ songId, plays: m.songs[songId], stars: rhythmBuddyFamiliarStars(m.songs[songId], m.trait) }))
    .sort((a, b) => (b.plays - a.plays) || (a.songId < b.songId ? -1 : 1)).slice(0, count);
};

// ---- 難易度の熟練(0〜1) ----
const rhythmBuddyMastery = (plays) => 1 - Math.exp(-rhythmBuddyInt(plays) / 15);

// ---- 種類ごとの、なりやすい性格 ----
// 基本の能力値のうち、全種類の中でいちばん抜けているもので決める
//   丈夫さ → 安定型 / ちから → 一発型 / ライフ → 粘り型 / ガッツ → 職人型
// allBases は全種類の { baseHp, baseAtk, baseDef, baseGuts } の一覧(新しい種類が増えても表を足さなくてよい)
const rhythmBuddySpeciesLean = (base, allBases) => {
  const list = Array.isArray(allBases) ? allBases.filter((b) => b && typeof b === 'object') : [];
  if (!base || !list.length) return 'steady';
  const keys = [['baseDef', 'steady'], ['baseAtk', 'burst'], ['baseHp', 'stamina'], ['baseGuts', 'artisan']];
  let best = 'steady';
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
// 4つの点数のいちばん高いもの。種類の傾向は、はじめに少しだけ点を足す(育て方で上書きできる)
const rhythmBuddyTraitScores = (mon, lean) => {
  const m = rhythmBuddyNormalizeMon(mon);
  const total = Math.max(1, m.lives);
  const low = (m.diffs.EASY + m.diffs.NORMAL + m.diffs.HARD) / total;
  const high = (m.diffs.EXPERT + m.diffs.MASTER) / total;
  const long = m.longLives / total;
  const top = Object.values(m.songs).reduce((a, b) => Math.max(a, b), 0);
  const repeat = Math.min(1, (top / total) * 3);
  const scores = { steady: low * 0.8, burst: high * 1.1, stamina: long * 1.4, artisan: repeat * 0.9 };
  if (RHYTHM_BUDDY_TRAIT_IDS.includes(lean)) scores[lean] += 0.25;
  return scores;
};
// Lv.50 で決まる。決まったあとは、10ライブごとに見直し、別の性格が 0.3 以上上回ったときだけゆっくり変わる
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
  const weights = RHYTHM_BUDDY_MOODS.map((mood) => (kept ? RHYTHM_BUDDY_MOOD_KEPT_WEIGHTS[mood.id] : mood.weight));
  const sum = weights.reduce((a, b) => a + b, 0);
  let r = rhythmBuddyHash(`${masuId}|${dayKey}`) * sum;
  for (let i = 0; i < RHYTHM_BUDDY_MOODS.length; i += 1) { r -= weights[i]; if (r < 0) return RHYTHM_BUDDY_MOODS[i]; }
  return RHYTHM_BUDDY_MOODS[2];
};

// ---- うまさ(判定の良さ 0〜1) ----
// 相棒の育ち具合から「無理なく叩ける譜面のLv.」を決め、それより上の譜面ほど落ちる(2026-10-07・ユーザー指示
// 「曲の難易度補正」→ 譜面のLv.とノーツの密度で補正)。譜面のLv.は配信中の曲で EASY 4〜15 / MASTER 17〜47。
// 密度(1秒あたりのノーツ数)は平均で「1 + Lv.÷10」くらいなので、それより詰まっている譜面はさらに少し落ちる
const rhythmBuddyComfortLevel = (level, songPlays, trait) => 14 + 40 * rhythmBuddyGrowthRate(level) + 50 * rhythmBuddySongSkill(songPlays, trait);
const rhythmBuddyAccuracy = ({ mon, songId, diffId, durationMs, mood, chartLevel, density }) => {
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
  acc += 0.03 * mastery - d * 0.012 * (1 - mastery);
  // 譜面のLv.: 無理なく叩けるLv.を超えたぶん1つごとに -0.015(最大 -0.35)。下回るぶんは少しだけ楽(最大 +0.02)
  const over = chartLv - rhythmBuddyComfortLevel(level, m.songs[songId], m.trait);
  acc -= over > 0 ? Math.min(0.35, over * 0.015) : -Math.min(0.02, -over * 0.002);
  // 密度: Lv.の割に詰まっているぶん(1秒あたり1つ多いごとに -0.04)。一発型は半分
  const dens = Number(density);
  if (Number.isFinite(dens) && dens > 0) {
    const extra = dens - (1 + chartLv / 10);
    if (extra > 0) acc -= extra * 0.04 * (m.trait === 'burst' ? 0.5 : 1);
  }
  if (m.trait === 'stamina') acc += Number(durationMs) >= RHYTHM_BUDDY_LONG_SONG_MS ? 0.025 : -0.01;
  const moodAcc = mood ? mood.acc : 0;
  acc += m.trait === 'steady' ? moodAcc * 0.5 : moodAcc;
  // 上限は満点(判定の良さ1)。満点まで届くかは、うまさとブレしだい
  return Math.max(0.1, Math.min(1, acc));
};
// Lv の伸び(0〜1)。はじめのうちほど大きく伸びる
const rhythmBuddyGrowthRate = (level) => Math.pow((Math.max(1, level) - 1) / (RHYTHM_BUDDY_LEVEL_MAX - 1), 0.7);
// その曲の得意(0〜0.10)。遊んだ回数でなだらかに増える。職人型は1.5倍の速さ
const rhythmBuddySongSkill = (plays, trait) => 0.1 * (1 - Math.exp(-rhythmBuddyInt(plays) * (trait === 'artisan' ? 1.5 : 1) / 12));
// ブレ(標準偏差)。うまくなるほど小さくなる(育てはじめは日によって大きく外す)。性格と調子でも変わる
const rhythmBuddySpread = (trait, mood, level = 1) => {
  const base = trait === 'steady' ? 0.02 : trait === 'burst' ? 0.055 : 0.035;
  return base * (1.6 - 1.1 * rhythmBuddyGrowthRate(level)) * (mood ? mood.spread : 1);
};

// ---- 演奏の結果を作る ----
// rand は 0〜1 を返す関数(呼ぶ側が渡す)。戻り値は演奏側の result と同じ形の一部
const rhythmBuddyNormal = (rand) => {
  const u = Math.max(1e-9, rand());
  const v = rand();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
};
const rhythmBuddyPlay = ({ mon, songId, diffId, totalNotes, maxScore, durationMs, mood, rand, chartLevel = 0 }) => {
  const r = typeof rand === 'function' ? rand : Math.random;
  const m = rhythmBuddyNormalizeMon(mon);
  const total = Math.max(1, rhythmBuddyInt(totalNotes, 100000));
  const max = Number(maxScore) > 0 ? Number(maxScore) : 1000000;
  const level = rhythmBuddyLevelInfo(m.exp).level;
  const density = Number(durationMs) > 0 ? total / (Number(durationMs) / 1000) : 0;
  let acc = rhythmBuddyAccuracy({ mon: m, songId, diffId, durationMs, mood, chartLevel, density }) + rhythmBuddyNormal(r) * rhythmBuddySpread(m.trait, mood, level);
  // 一発型は、たまに(8%)大きく当てる
  if (m.trait === 'burst' && r() < 0.08) acc += 0.06;
  acc = Math.max(0.1, Math.min(1, acc));
  const miss = 1 - acc;
  const share = { MISS: miss * 0.45, BAD: miss * 0.15, GOOD: miss * 0.2, GREAT: miss * 0.2 };
  const counts = { MARVELOUS: 0, EXCELLENT: 0, GREAT: 0, GOOD: 0, BAD: 0, MISS: 0 };
  ['MISS', 'BAD', 'GOOD', 'GREAT'].forEach((id) => { counts[id] = Math.round(total * share[id]); });
  const rest = Math.max(0, total - counts.MISS - counts.BAD - counts.GOOD - counts.GREAT);
  counts.MARVELOUS = Math.round(rest * acc);
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
const rhythmBuddyApplyLive = (mon, { round, songId, diffId, durationMs, teamRank, dayKey, lean, nowMs }) => {
  const before = rhythmBuddyNormalizeMon(mon);
  if (!round || before.lastRound === round) return { mon: before, gain: 0, levelUp: 0, familiarUp: false, traitNew: '' };
  const gain = rhythmBuddyExpGain(diffId, teamRank);
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
    lastRound: rhythmBuddyStr(round, 40), lastDay: rhythmBuddyStr(dayKey, 10),
    firstAt: before.firstAt || rhythmBuddyInt(nowMs, 9e15),
  };
  const trait = rhythmBuddyNextTrait(after, lean);
  const traitNew = trait && trait !== before.trait ? trait : '';
  if (traitNew) { after.trait = traitNew; after.traitAt = after.lives; }
  const levelUp = rhythmBuddyLevelInfo(after.exp).level - rhythmBuddyLevelInfo(before.exp).level;
  const familiarUp = !!sid && rhythmBuddyFamiliarStars(songs[sid], after.trait) > rhythmBuddyFamiliarStars(before.songs[sid] || 0, before.trait);
  return { mon: after, gain, levelUp, familiarUp, traitNew };
};
