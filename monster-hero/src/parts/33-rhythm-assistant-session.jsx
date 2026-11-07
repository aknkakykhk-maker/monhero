// ===== モンヒロビート「助手とのセッション」の計算(純粋) =====
// 設計の正本: docs/progress/beat-assistant-session/PLAN.md(社長の決定 2026-11-07)。
//   ・助手をマルチの部屋の席に CPU として呼ぶ(マスモンと同じ)。回数はマスモンと同じ財布(mh_rhythm_buddy_v1 の used・calls)
//   ・助手ごとに「セッションLv」1〜100(絆 Lv とは別)。経験値・必要経験値・スコアの作りはマスモン(33-rhythm-buddy.jsx)をそのまま使う
//   ・調子の代わりに「好み」: 好きな曲は少し上がる・ブレ小・経験値 ×1.3 / 苦手な曲は少し下がる・ブレ大・経験値 ×1.5
//   ・プレイヤーのスコア・判定は変えない。助手のスコアはランキング・自己ベストに送らない
// ★公開の印 RELEASE_FLAGS.rhythmAssistantSession の後ろ。偽のあいだは呼ぶシートに助手のタブを出さない
// 保存は新しいキー RHYTHM_ASSIST_SESSION_KEY だけ(⑦)。マスモンの育ち・助手の絆・助手どうしの仲良し度には書かない

const RHYTHM_ASSIST_SESSION_KEY = 'mh_rhythm_assistant_session_v1';
// 部屋の中では、助手を「masuId」の欄に印つきで入れる(マスモンの id と混ざらないように)。例: 'as:mua'
const RHYTHM_ASSIST_SESSION_PREFIX = 'as:';
const RHYTHM_ASSIST_SESSION_IDS = Object.freeze(['mua', 'kiki', 'momosuke', 'dra', 'atsu', 'kyuko', 'sorashido', 'erubin']);
const rhythmAssistSessionEnabled = () => typeof RELEASE_FLAGS !== 'undefined' && RELEASE_FLAGS.rhythmAssistantSession === true;
const rhythmAssistSessionKey = (assistantId) => `${RHYTHM_ASSIST_SESSION_PREFIX}${assistantId}`;
// 'as:mua' → 'mua'。助手でなければ ''
const rhythmAssistSessionIdOf = (masuId) => {
  const s = typeof masuId === 'string' ? masuId : '';
  if (!s.startsWith(RHYTHM_ASSIST_SESSION_PREFIX)) return '';
  const id = s.slice(RHYTHM_ASSIST_SESSION_PREFIX.length);
  return RHYTHM_ASSIST_SESSION_IDS.includes(id) ? id : '';
};

// 好きな曲(3曲)と苦手な曲(1曲)。曲の別の版(短い版・フル版)も同じ曲として扱う(PLAN.md 4章・社長「案のまま」)。
// 新曲は足さなければ全員ふつう(新曲の追加のときに1行足す)
const RHYTHM_ASSIST_SESSION_TASTE = Object.freeze({
  mua: { like: [['toriko'], ['haruka'], ['crazy_party_night', 'crazy_party_night_full']], dislike: ['grievous_lady'] },
  kiki: { like: [['kiki_issen', 'kiki_issen_short'], ['tsuki_ga_michiru_mae_ni', 'tsuki_ga_michiru_mae_ni_short'], ['kaze_ga_soyogu']], dislike: ['black_shout'] },
  momosuke: { like: [['crossing_field'], ['only_my_railgun'], ['rose', 'rose_short']], dislike: ['dullahan_clockwork'] },
  dra: { like: [['mou_hitotsu_no_sekai_e'], ['big_bridge_no_shitou'], ['senjou_no_shippuu']], dislike: ['stay_with_me', 'stay_with_me_short'] },
  atsu: { like: [['against_my_own_shadow'], ['sad_song', 'sad_song_short'], ['rebellion', 'rebellion_short']], dislike: ['mf_ichika_mix'] },
  kyuko: { like: [['toward_the_stars_short'], ['six_eternel_beat', 'six_eternel_remix'], ['evans']], dislike: ['toriko'] },
  sorashido: { like: [['monster_hero'], ['freedom_dive'], ['humanoid']], dislike: ['kaze_ga_soyogu'] },
  erubin: { like: [['wrath_of_the_thorn_king'], ['altar_world_tree', 'altar_world_tree_short'], ['dullahan']], dislike: ['crazy_party_night', 'crazy_party_night_full'] },
});
// 好み度は -2〜+3。好きな曲は +3、苦手な曲は -2、ほかは 0 から始まり、一緒に遊んだ回数で少しずつ上がる(3回ごとに +1・上限 +3)
const RHYTHM_ASSIST_SESSION_LIKE_MIN = -2;
const RHYTHM_ASSIST_SESSION_LIKE_MAX = 3;
const RHYTHM_ASSIST_SESSION_LIKE_STEP = 3;
const rhythmAssistSessionBaseLike = (assistantId, songId) => {
  const t = RHYTHM_ASSIST_SESSION_TASTE[assistantId];
  if (!t || !songId) return 0;
  if (t.like.some((ids) => ids.includes(songId))) return RHYTHM_ASSIST_SESSION_LIKE_MAX;
  if (t.dislike.includes(songId)) return RHYTHM_ASSIST_SESSION_LIKE_MIN;
  return 0;
};
// 'like'(好き)・'dislike'(苦手)・''(ふつう)。苦手な曲も、好み度が +1 を超えたら「好きになった」
const rhythmAssistSessionTaste = (assistantId, songId) => {
  const b = rhythmAssistSessionBaseLike(assistantId, songId);
  return b > 0 ? 'like' : b < 0 ? 'dislike' : '';
};

const rhythmAssistSessionNormalize = (raw) => {
  const o = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  const src = o.mons && typeof o.mons === 'object' && !Array.isArray(o.mons) ? o.mons : {};
  const mons = {};
  RHYTHM_ASSIST_SESSION_IDS.forEach((id) => {
    if (!src[id] || typeof src[id] !== 'object') return;
    // 育ち(経験値・曲のなじみ・難易度の熟練・最近のスコア)はマスモンと同じ形。助手は性格を持たない
    const mon = rhythmBuddyNormalizeMon(src[id]);
    mon.trait = ''; mon.born = ''; mon.traitAt = 0; mon.traitLock = false;
    // 曲ごとの好みの動き(遊んだ回数。好み度は rhythmAssistSessionLike で決める)
    const likes = {};
    const l = src[id].likes;
    if (l && typeof l === 'object' && !Array.isArray(l)) {
      Object.keys(l).slice(0, 200).forEach((sid) => { const key = rhythmBuddyStr(sid, 60); const n = rhythmBuddyInt(l[sid], 100000); if (key && n > 0) likes[key] = n; });
    }
    // セッション券を渡した節目(Lv.35/65/100。二重に渡さないための印・2026-11-07)
    const rewarded = (Array.isArray(src[id].rewarded) ? src[id].rewarded : []).map((n) => rhythmBuddyInt(n, 100)).filter((n, i, arr) => n > 0 && arr.indexOf(n) === i);
    mons[id] = { ...mon, likes, rewarded };
  });
  return { mons };
};
const rhythmAssistSessionMon = (state, assistantId) => {
  const st = rhythmAssistSessionNormalize(state);
  return st.mons[assistantId] || { ...rhythmBuddyNormalizeMon(null), likes: {}, rewarded: [] };
};
const rhythmAssistSessionLevel = (state, assistantId) => rhythmBuddyLevelInfo(rhythmAssistSessionMon(state, assistantId).exp).level;
// 好み度(-2〜+3)
const rhythmAssistSessionLike = (mon, assistantId, songId) => {
  const base = rhythmAssistSessionBaseLike(assistantId, songId);
  const plays = mon && mon.likes ? rhythmBuddyInt(mon.likes[songId], 100000) : 0;
  return Math.max(RHYTHM_ASSIST_SESSION_LIKE_MIN, Math.min(RHYTHM_ASSIST_SESSION_LIKE_MAX, base + Math.floor(plays / RHYTHM_ASSIST_SESSION_LIKE_STEP)));
};
// 好み度から、スコアの作りに使う「調子」(マスモンの RHYTHM_BUDDY_MOODS から選ぶ)。好き=ご機嫌(少し上がる・ブレ小)・苦手=不機嫌(少し下がる・ブレ大)
const rhythmAssistSessionMood = (like) => {
  const id = like >= RHYTHM_ASSIST_SESSION_LIKE_MAX ? 'good' : like < 0 ? 'bad' : 'normal';
  return RHYTHM_BUDDY_MOODS.find((m) => m.id === id) || RHYTHM_BUDDY_MOODS.find((m) => m.id === 'normal');
};
// 経験値の倍率: 好きな曲 ×1.3・苦手な曲 ×1.5・ふつう ×1
const rhythmAssistSessionExpScale = (like) => (like >= RHYTHM_ASSIST_SESSION_LIKE_MAX ? 1.3 : like < 0 ? 1.5 : 1);

// 助手のスコア。マスモンの rhythmBuddyPlay をそのまま使い、調子の代わりに好みを入れる
const rhythmAssistSessionPlay = ({ state, assistantId, songId, diffId, totalNotes, maxScore, durationMs, rand, chartLevel = 0, humans = 1, nowMs = 0 }) => {
  const mon = rhythmAssistSessionMon(state, assistantId);
  const mood = rhythmAssistSessionMood(rhythmAssistSessionLike(mon, assistantId, songId));
  return rhythmBuddyPlay({ mon, songId, diffId, totalNotes, maxScore, durationMs, mood, rand, chartLevel, humans, nowMs });
};

// 1ライブぶん育てる(同じ回は2度数えない)。{ next, gain, levelUp, likeUp, like, familiarUp }。数えなかったら next は null
const rhythmAssistSessionApplyLive = (state, assistantId, { round, songId, diffId, durationMs, teamRank, dayKey, nowMs, score, maxScore, chartLevel = 0, humans = 1 }) => {
  const st = rhythmAssistSessionNormalize(state);
  if (!RHYTHM_ASSIST_SESSION_IDS.includes(assistantId)) return { next: null, gain: 0, levelUp: 0, likeUp: 0, like: 0, familiarUp: false, tickets: 0 };
  const before = rhythmAssistSessionMon(st, assistantId);
  const likeBefore = rhythmAssistSessionLike(before, assistantId, songId);
  // 育ち方はマスモンと同じ(調子なし)。性格は付けない
  const r = rhythmBuddyApplyLive(before, { round, songId, diffId, durationMs, teamRank, dayKey, lean: '', nowMs, score, maxScore, chartLevel, humans, moodId: '' });
  if (!r.gain) return { next: null, gain: 0, levelUp: 0, likeUp: 0, like: likeBefore, familiarUp: false, tickets: 0 };
  const gain = Math.max(1, Math.round(r.gain * rhythmAssistSessionExpScale(likeBefore)));
  const sid = rhythmBuddyStr(songId, 60);
  const likes = { ...before.likes };
  if (sid) likes[sid] = (likes[sid] || 0) + 1;
  const after = { ...r.mon, exp: before.exp + gain, trait: '', born: '', traitAt: 0, traitLock: false, likes, rewarded: before.rewarded.slice() };
  const likeAfter = rhythmAssistSessionLike(after, assistantId, songId);
  const levelAfter = rhythmBuddyLevelInfo(after.exp).level;
  const levelUp = levelAfter - rhythmBuddyLevelInfo(before.exp).level;
  // 節目のセッション券(まだ渡していない節目だけ。渡した印は同じ書き込みで残す)
  let tickets = 0;
  RHYTHM_ASSIST_SESSION_TICKET_REWARDS.forEach(([lv, n]) => { if (levelAfter >= lv && !after.rewarded.includes(lv)) { after.rewarded.push(lv); tickets += n; } });
  return {
    next: { ...st, mons: { ...st.mons, [assistantId]: after } },
    gain, levelUp, likeUp: likeAfter - likeBefore, like: likeAfter, familiarUp: r.familiarUp, tickets,
  };
};

// 選曲の候補(シャッフル画面の演出だけ。本番の曲は人の選んだ曲から引く今のまま)。好きな曲を出しやすい
const rhythmAssistSessionChooseSong = (state, assistantId, catalog, rand = Math.random) => {
  const list = Array.isArray(catalog) ? catalog.filter((x) => typeof x === 'string' && x) : [];
  if (!list.length) return { songId: '', why: '' };
  const mon = rhythmAssistSessionMon(state, assistantId);
  const liked = list.filter((id) => rhythmAssistSessionLike(mon, assistantId, id) >= RHYTHM_ASSIST_SESSION_LIKE_MAX);
  if (liked.length && rand() < 0.6) return { songId: liked[Math.floor(rand() * liked.length)], why: 'love' };
  const ok = list.filter((id) => rhythmAssistSessionLike(mon, assistantId, id) >= 0);
  const pool = ok.length ? ok : list;
  return { songId: pool[Math.floor(rand() * pool.length)], why: '' };
};

// ---- セッションLv で開くもの(PLAN.md 2章。スコア・判定には効かない) ----
// 演奏中のひとことは Lv.1 から。サビで顔が光るのは Lv.15 から。ビートP の上乗せは Lv.20/40/60/80 で +2/4/6/8%
// 好きな曲(好み度)が見えるのは Lv.10 から
const RHYTHM_ASSIST_SESSION_TASTE_LEVEL = 10;
const RHYTHM_ASSIST_SESSION_GLOW_LEVEL = 15;
// セッション券: Lv.35 で1枚・Lv.65 で2枚・Lv.100 で3枚(それぞれ1回だけ)
const RHYTHM_ASSIST_SESSION_TICKET_REWARDS = Object.freeze([[35, 1], [65, 2], [100, 3]]);
const RHYTHM_ASSIST_SESSION_P_BONUS = Object.freeze([[80, 0.08], [60, 0.06], [40, 0.04], [20, 0.02]]);
const rhythmAssistSessionPBonusOf = (level) => { const hit = RHYTHM_ASSIST_SESSION_P_BONUS.find(([lv]) => level >= lv); return hit ? hit[1] : 0; };
// 呼んだ助手みんなのビートP の上乗せ(周回の報酬・ビートP の人数ボーナスと同じ所にだけ足す。スコアには入れない)
const rhythmAssistSessionRewardBonus = (state, assistantIds) => (Array.isArray(assistantIds) ? assistantIds : [])
  .filter((id, i, arr) => RHYTHM_ASSIST_SESSION_IDS.includes(id) && arr.indexOf(id) === i)
  .reduce((sum, id) => sum + rhythmAssistSessionPBonusOf(rhythmAssistSessionLevel(state, id)), 0);
// 曲の中の時刻がサビ(RHYTHM_SONG_CLIMAX の強さ 0.9 以上の区間)に入っているか
const rhythmAssistSessionInClimax = (songId, timeMs) => {
  const table = typeof RHYTHM_SONG_CLIMAX !== 'undefined' ? RHYTHM_SONG_CLIMAX : null;
  const spans = table && Array.isArray(table[songId]) ? table[songId] : [];
  const t = Number(timeMs);
  return Number.isFinite(t) && spans.some((x) => Array.isArray(x) && Number(x[2]) >= 0.9 && t >= Number(x[0]) && t < Number(x[1]));
};
