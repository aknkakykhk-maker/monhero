// ==================== プレイヤーのランク(ビートランク・カードランク共通)と、ビートランクの経験値 ====================
// 2026-10-29 社長: モンヒロビートに「ビートランク」(上限なし・全員ランク1から)。MFバトルカードのレベルも「カードランク」に改め、対の名前にする。
//   ランクの計算(次のランクまで 20+3×ランク)は2つで同じなので、ここに1か所だけ置く(マルチ部ツナグくんと決めた)。
//   カードは 96-card-tactics.jsx の cardLevelInfo がこれを呼ぶ形に寄せる。
// ★マスモンの「ビートLv」(rhythmBuddyLevelInfo)とは別物。画面でも「Lv」の字を使わず「ランク」と書いて取り違えないようにする。
// 保存は新しいキー mh_rhythm_rank_v1 だけ(既存の記録やランキングには触らない)。読むときは normalizeBeatRank を必ず通す。
// ここは純粋な計算だけ(保存・日付・画面は呼ぶ側)。

// 次のランクまでに要る経験値。差し替えるのはここだけ(サーバの player_rank_of も同じ式)
const playerRankNeed = (rank) => 20 + 3 * rank;
// 壊れた経験値(数でない・無限・負)は0として数える。ループが止まらなくならないよう上限も切る
const playerRankSafeXp = (xp) => { const n = Number(xp); return Number.isFinite(n) ? Math.min(Math.max(0, Math.floor(n)), Number.MAX_SAFE_INTEGER) : 0; };
// 経験値の合計 → { rank(今のランク), into(今のランクの中で、たまった分), need(次のランクまでに要る分) }
const playerRankInfo = (xp) => {
  let left = playerRankSafeXp(xp), rank = 1;
  for (;;) { const need = playerRankNeed(rank); if (left < need) return { rank, into: left, need }; left -= need; rank += 1; }
};

// ---- ビートランク ----
const BEAT_RANK_KEY = 'mh_rhythm_rank_v1';
// 1曲の経験値(2026-10-29 社長。HELL は「劇的に上げる」で 60)。最後まで遊んだときの値
const BEAT_RANK_XP = Object.freeze({ EASY: 6, NORMAL: 8, HARD: 10, EXPERT: 14, MASTER: 18, HELL: 60 });
// 途中でライフが尽きた(失敗)ときは3分の1(端数は四捨五入)。フルコンボ +4、全部 MARVELOUS は +8(フルコンボの +4 と重ねない)。
// みんなで対戦は1曲ぶん(上乗せ込み)を1.5倍(端数は四捨五入)。その日はじめての1曲は、そのあとに +30
const BEAT_RANK_BONUS = Object.freeze({ failDivisor: 3, fullCombo: 4, allMarvelous: 8, multiScale: 1.5, dayFirst: 30 });
// ごほうび(2026-10-29 社長が作り直し。前の「ランク3・10・20、そのあと5ごとにビートP 300」はやめた)
//   ランクが1つ上がるたび: ビートP「そのランク×100」+セッション券1枚
//   5ランクごと(5・10・15…): さらにビートP「そのランク×200」+セッション券「そのランクと同じ枚数」
//   例: ランク5に上がると ビートP 500+1,000・セッション券 1枚+5枚
// 毎ランクのビートPの式はカードランクも同じ(playerRankBeatPointsFor)。券の種類はそれぞれ
const playerRankBeatPointsFor = (rank) => {
  const r = Math.max(0, Math.floor(Number(rank) || 0));
  return r < 2 ? 0 : r * 100 + (r % 5 === 0 ? r * 200 : 0);
};
const beatRankTicketsFor = (rank) => {
  const r = Math.max(0, Math.floor(Number(rank) || 0));
  return r < 2 ? 0 : 1 + (r % 5 === 0 ? r : 0);
};
// そのランクに上がったときにもらえる物を、一目で分かる文に(「ビートP 1,300・セッション券 1枚」)
// そのランクに上がったときにもらえる物を、1つずつ(ごほうびの一覧の画面用)。bonus は5ランクごとのおまけ
const beatRankRewardItems = (rank) => {
  const r = Math.max(0, Math.floor(Number(rank) || 0));
  if (r < 2) return [];
  const bonus = r % 5 === 0;
  return [
    { icon: '🎟️', text: `ビートP ${(r * 100).toLocaleString()}` },
    { icon: '🎶', text: 'セッション券 1枚' },
    ...(bonus ? [{ icon: '🎟️', text: `ビートP ${(r * 200).toLocaleString()}`, bonus: true }, { icon: '🎶', text: `セッション券 ${r.toLocaleString()}枚`, bonus: true }] : []),
  ];
};
const beatRankRewardText = (rank) => `ビートP ${playerRankBeatPointsFor(rank).toLocaleString()}・セッション券 ${beatRankTicketsFor(rank).toLocaleString()}枚`;

// { v:1, xp(経験値の合計), day(その日はじめての1曲を数えた日 JST 'YYYY-MM-DD'), dayFirst(その日の +30 を数えたか),
//   got(ごほうびを配り終えたいちばん上のランク), k(全国ランキングへ書くときの持ち主の鍵。端末で作る) }
const normalizeBeatRank = (raw) => {
  const r = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  const gotRaw = Array.isArray(r.got) ? Math.max(1, ...r.got.filter((n) => Number.isInteger(n))) : Number(r.got);
  const got = Number.isFinite(gotRaw) ? Math.max(1, Math.floor(gotRaw)) : 1;
  const k = typeof r.k === 'string' && /^[A-Za-z0-9_-]{24,128}$/.test(r.k) ? r.k : '';
  return { v: 1, xp: playerRankSafeXp(r.xp), day: typeof r.day === 'string' ? r.day.slice(0, 10) : '', dayFirst: r.dayFirst === true, got, k };
};

// 1曲ぶんの経験値と内わけ(その日はじめての +30 は入れない)。経験値の入らない難易度なら { xp:0 }
const beatRankPlayXp = ({ difficultyId, cleared = true, fullCombo = false, allMarvelous = false, multi = false }) => {
  const base = BEAT_RANK_XP[difficultyId];
  if (!base) return { xp: 0, parts: [] };
  const parts = [];
  let xp = cleared ? base : Math.round(base / BEAT_RANK_BONUS.failDivisor);
  parts.push({ label: cleared ? difficultyId : `${difficultyId}(ライフが尽きた)`, xp });
  if (cleared && allMarvelous) { xp += BEAT_RANK_BONUS.allMarvelous; parts.push({ label: '全部 MARVELOUS', xp: BEAT_RANK_BONUS.allMarvelous }); }
  else if (cleared && fullCombo) { xp += BEAT_RANK_BONUS.fullCombo; parts.push({ label: 'フルコンボ', xp: BEAT_RANK_BONUS.fullCombo }); }
  if (multi) { const scaled = Math.round(xp * BEAT_RANK_BONUS.multiScale); parts.push({ label: 'みんなで対戦 ×1.5', xp: scaled - xp }); xp = scaled; }
  return { xp, parts };
};

// 経験値を足した次の値と、新しくもらうごほうび。today は日本時間の 'YYYY-MM-DD'(呼ぶ側が渡す)
// 返り値: { next, add, parts, from, to, tickets, beatPoints, bonusTickets, bonusPoints }(bonus* は5ランクごとのおまけの分。tickets・beatPoints に含む)
const beatRankAfter = (prev, { difficultyId, cleared, fullCombo, allMarvelous, multi, today }) => {
  const cur = normalizeBeatRank(prev);
  const from = playerRankInfo(cur.xp).rank;
  const play = beatRankPlayXp({ difficultyId, cleared, fullCombo, allMarvelous, multi });
  if (!play.xp) return { next: cur, add: 0, parts: [], from, to: from, tickets: 0, beatPoints: 0 };
  const day = typeof today === 'string' ? today.slice(0, 10) : '';
  const first = !!day && !(cur.day === day && cur.dayFirst);
  const parts = first ? [...play.parts, { label: 'その日はじめての1曲', xp: BEAT_RANK_BONUS.dayFirst }] : play.parts;
  const add = play.xp + (first ? BEAT_RANK_BONUS.dayFirst : 0);
  const xp = playerRankSafeXp(cur.xp + add);
  const to = playerRankInfo(xp).rank;
  let tickets = 0, beatPoints = 0, bonusTickets = 0, bonusPoints = 0;
  for (let r = Math.max(cur.got + 1, 2); r <= to; r++) {
    tickets += beatRankTicketsFor(r); beatPoints += playerRankBeatPointsFor(r);
    if (r % 5 === 0) { bonusTickets += r; bonusPoints += r * 200; }
  }
  return { next: { ...cur, xp, day: day || cur.day, dayFirst: first || (cur.day === day && cur.dayFirst), got: Math.max(cur.got, to) }, add, parts, from, to, tickets, beatPoints, bonusTickets, bonusPoints };
};
