// ===== サクセス杯(モンヒロバトルの新しい大会・モンヒロサクセス 段取りの回5b) =====
// 案: docs/progress/player-raise/PLAN.md §5「サクセス杯」・§9 保存・§11 の1
// モンヒロサクセスの保存枠にいる「引退した子」が、この大会のときだけ
// 今のモンヒロバトルの4能力(ライフ・ちから・丈夫さ・ガッツ)に換算されて出る。
// 流れはプロと同じ(勇者モン → 置く距離 → 供モンの候補5体 → アシストカード → WAVE1〜10)。
//
// ★ほかのモンヒロバトル(チャレンジ・クイック・プロ・極限)と既存のランキングには入れない。
//   記録は mh_suc_* (modeKeyPrefix)、ランキングは difficulty の先頭に Suc を付けた別の行(プロの Pro と同じやり方。
//   Supabase の列も表も増やさない)。チャレンジ・プロの自己ベストは読みも書きもしない。
// ★保存枠(mh_monsuc_box_v1)は回3(モンヒロサクセスの保存枠)が書く。ここは**読むだけ**。
//   サクセス杯の成績(優勝の回数・名声)は、保存枠を書き換えずに新しいキー mh_suc_cup_v1 へ別に持つ。
// ★足りない枠はベースモンで埋める(§11 の1 の推奨)。引退した子が1体でもいれば出られる。
// ★この部品は純粋(保存・画面なし)。読み書きは 60-app.jsx が storeGet/storeSet で行う。
// ★換算の幅(×0.8〜×1.6)は仮。測って決めるのは窓口の了解のあと(PLAN §5)。
//   PLAN の例「6能力みな500 → 基礎の約1.4倍」は式と合わない(式どおりだと 0.8 + 500/999×0.8 ≒ ×1.2)。ここは式に従う。

// 公開の印。偽のあいだはデバッグのバトル入口からだけ遊べ、ランキングにも送らない
const SUCCESS_CUP_PUBLIC_RELEASE = false;
// 回3の保存枠(読むだけ)
const SUC_BOX_KEY = 'mh_monsuc_box_v1';
// サクセス杯の成績(新しいキー): { v:1, wins:{ [保存枠の子のid]: 回数 }, fame:名声, runs:[記録した周回id(新しい50件)] }
const SUC_CUP_KEY = 'mh_suc_cup_v1';
// 6能力のキー(monster-hero/data/monhero-success.js の KEYS と同じ並び)
const SUC_STAT_KEYS = Object.freeze(['life', 'pow', 'wise', 'hit', 'eva', 'tough']);
const SUC_STAT_MAX = 999;
// 換算の幅(仮)。0 で ×SUC_RATIO_MIN、999 で ×SUC_RATIO_MAX
const SUC_RATIO_MIN = 0.8;
const SUC_RATIO_MAX = 1.6;
const SUC_CUP_TITLE = 'サクセス杯 優勝';

const sucNum = (value, fallback = 0) => (Number.isFinite(Number(value)) ? Number(value) : fallback);
const sucClampStat = (value) => Math.max(0, Math.min(SUC_STAT_MAX, sucNum(value, 0)));
// 割合(x) = 0.8 + (その能力 ÷ 999) × 0.8
const sucStatRatio = (value) => SUC_RATIO_MIN + (sucClampStat(value) / SUC_STAT_MAX) * (SUC_RATIO_MAX - SUC_RATIO_MIN);

// 保存枠の子1体を読む。読めないものは null(落とすだけで、保存は書き換えない)。
// 6能力は st(PLAN §9 の形) を先に、無ければ stats(計算の芯の育成の形)を見る。熟練も mast → mastery の順
const normalizeSucBoxMon = (raw) => {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const id = typeof raw.id === 'string' || Number.isFinite(raw.id) ? String(raw.id) : '';
  const species = typeof raw.species === 'string' ? raw.species : '';
  if (!id || !species) return null;
  const src = raw.st && typeof raw.st === 'object' ? raw.st : raw.stats && typeof raw.stats === 'object' ? raw.stats : null;
  if (!src) return null;
  const st = {};
  for (const key of SUC_STAT_KEYS) st[key] = sucClampStat(src[key]);
  const techs = Array.isArray(raw.techs) ? raw.techs.filter(t => typeof t === 'string') : [];
  const mastSrc = raw.mast && typeof raw.mast === 'object' ? raw.mast : raw.mastery && typeof raw.mastery === 'object' ? raw.mastery : {};
  // 読み直し済みの形(mast が技と同じ並びの配列)もそのまま通す
  const mast = Array.isArray(raw.mast) ? raw.mast.slice(0, techs.length).map(v => Math.max(0, Math.min(100, sucNum(v, 0))))
    : techs.map(t => Math.max(0, Math.min(100, sucNum(mastSrc[t], 0))));
  return {
    id, species,
    nick: typeof raw.nick === 'string' && raw.nick.trim() ? raw.nick.trim().slice(0, 20) : '',
    st, techs, mast,
    // 未育成の合体の子(raised:false)は出られない。raised が無い古い形は引退した子として扱う
    raised: raw.raised !== false,
    rank: typeof raw.rank === 'string' ? raw.rank : '',
    gen: Math.max(1, Math.floor(sucNum(raw.gen, 1))),
    titles: Array.isArray(raw.titles) ? raw.titles.filter(t => typeof t === 'string') : [],
    sucNormalized: true,
  };
};
// 保存枠から、サクセス杯に出られる子(引退した子)だけを並べる
const readSucBoxMons = (boxRaw) => {
  const mons = boxRaw && typeof boxRaw === 'object' && Array.isArray(boxRaw.mons) ? boxRaw.mons : [];
  return mons.map(normalizeSucBoxMon).filter(m => m && m.raised);
};
// 固有技の Lv: 覚えた技の熟練の平均から(熟練0 → Lv1・100 → Lv9)。技が無ければ Lv1
const sucUniqueLevelOf = (mon) => {
  const list = Array.isArray(mon?.mast) ? mon.mast : [];
  if (!list.length) return 0;
  const avg = list.reduce((sum, v) => sum + sucNum(v, 0), 0) / list.length;
  return Math.max(0, Math.min(8, Math.round(avg / 100 * 8)));
};
// 4能力の倍率(PLAN §5 の式)
const sucBattleRatios = (st) => {
  const s = st || {};
  const hi = Math.max(sucClampStat(s.pow), sucClampStat(s.wise));
  const lo = Math.min(sucClampStat(s.pow), sucClampStat(s.wise));
  return {
    hp: sucStatRatio(s.life),
    atk: sucStatRatio(hi * 0.7 + lo * 0.3),
    def: sucStatRatio(s.tough),
    guts: sucStatRatio((sucClampStat(s.hit) + sucClampStat(s.eva)) / 2),
  };
};
// 保存枠の子を、モンヒロバトルの「モンスターらしいオブジェクト」へ換算する。
// id は種のまま(勇者特性・絵・技の判定を壊さないため)。マスモンではないので masuId は持たない。
// 強化ポイント・限界突破・魂格・継承技は持たない
const convertSucMonToBattle = (boxMon, all = (typeof ALL_PLAYER_MONSTERS !== 'undefined' ? ALL_PLAYER_MONSTERS : null)) => {
  const mon = boxMon && boxMon.sucNormalized ? boxMon : normalizeSucBoxMon(boxMon);
  const base = mon && all ? all[mon.species] : null;
  if (!mon || !base || base.debugOnly) return null;
  const r = sucBattleRatios(mon.st);
  const mul = (value, ratio) => Math.max(1, Math.round(sucNum(value, 0) * ratio));
  const plus = base.plusStats || {};
  const lv = sucUniqueLevelOf(mon);
  return {
    ...base,
    name: mon.nick || base.name,
    baseHp: mul(base.baseHp, r.hp),
    baseAtk: mul(base.baseAtk, r.atk),
    baseDef: mul(base.baseDef, r.def),
    baseGuts: mul(base.baseGuts, r.guts),
    plusStats: { hp: mul(plus.hp, r.hp), atk: mul(plus.atk, r.atk), def: mul(plus.def, r.def), guts: mul(plus.guts, r.guts) },
    unique: typeof uniqueSkillAtLevel === 'function' ? uniqueSkillAtLevel(base.unique, lv) : base.unique,
    inheritedUniques: [],
    sucBoxId: mon.id,
    sucRank: mon.rank,
    sucUniqueLv: lv + 1,
  };
};
// 換算した子の強さのめやす(同じ種が何体もいるとき、いちばん強い子を代表にする)
const sucBattlePower = (mon) => sucNum(mon?.baseHp) / 5 + sucNum(mon?.baseAtk) + sucNum(mon?.baseDef) + sucNum(mon?.baseGuts);
// サクセス杯で選べる子の一覧。先に保存枠の引退した子(種ごとにいちばん強い1体)、
// そのあとに、その種がいないベースモンで埋める(§11 の1)。
// ★プロの選ぶ画面は種の id で子を見分けるので、同じ種は1体にそろえる
const successCupPickList = (boxMons, baseList) => {
  const bySpecies = new Map();
  for (const raw of Array.isArray(boxMons) ? boxMons : []) {
    const mon = convertSucMonToBattle(raw);
    if (!mon) continue;
    const cur = bySpecies.get(mon.id);
    if (!cur || sucBattlePower(mon) > sucBattlePower(cur)) bySpecies.set(mon.id, mon);
  }
  const box = [...bySpecies.values()].sort((a, b) => sucBattlePower(b) - sucBattlePower(a));
  const fill = (Array.isArray(baseList) ? baseList : []).filter(m => m && !bySpecies.has(m.id) && m.masuId == null);
  return [...box, ...fill];
};
const isSucBoxBattleMon = (mon) => !!(mon && typeof mon.sucBoxId === 'string' && mon.sucBoxId);

// サクセス杯の成績(mh_suc_cup_v1)の読み直し。壊れているときは空から
const SUC_CUP_RUNS_MAX = 50;
const normalizeSucCupRecord = (raw) => {
  const src = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  const wins = {};
  if (src.wins && typeof src.wins === 'object' && !Array.isArray(src.wins)) {
    for (const [id, n] of Object.entries(src.wins)) {
      const v = Math.floor(sucNum(n, 0));
      if (id && v > 0) wins[id] = v;
    }
  }
  return {
    v: 1,
    wins,
    fame: Math.max(0, Math.floor(sucNum(src.fame, 0))),
    runs: Array.isArray(src.runs) ? src.runs.filter(r => typeof r === 'string').slice(-SUC_CUP_RUNS_MAX) : [],
  };
};
// 名声(仮): 優勝で 10 + 難易度の段(Beginner 0 〜 Legend 8)。数字は窓口の了解で決め直す
const sucCupFameFor = (difficulty) => {
  const order = typeof DIFFICULTY_SETTINGS === 'object' && DIFFICULTY_SETTINGS ? Object.keys(DIFFICULTY_SETTINGS) : [];
  return 10 + Math.max(0, order.indexOf(difficulty));
};
// 優勝を1回ぶん足す。同じ周回(runId)は二度足さない
const addSucCupWin = (raw, { runId, boxIds = [], difficulty } = {}) => {
  const rec = normalizeSucCupRecord(raw);
  const id = typeof runId === 'string' && runId ? runId : '';
  if (!id || rec.runs.includes(id)) return { record: rec, added: false };
  const wins = { ...rec.wins };
  for (const boxId of [...new Set(boxIds.filter(b => typeof b === 'string' && b))]) wins[boxId] = (wins[boxId] || 0) + 1;
  return {
    record: { v: 1, wins, fame: rec.fame + sucCupFameFor(difficulty), runs: [...rec.runs, id].slice(-SUC_CUP_RUNS_MAX) },
    added: true,
  };
};
// その子が持つ称号(保存枠の titles + サクセス杯の優勝)
const sucCupTitlesOf = (boxId, cupRaw, boxTitles = []) => {
  const rec = normalizeSucCupRecord(cupRaw);
  const titles = Array.isArray(boxTitles) ? boxTitles.slice() : [];
  if ((rec.wins[boxId] || 0) > 0 && !titles.includes(SUC_CUP_TITLE)) titles.push(SUC_CUP_TITLE);
  return titles;
};

// 保存枠がまだ空のとき、デバッグのバトル入口からだけ使う仮の子(保存はしない)。
// 6能力が 0・500・999 の3パターン(PLAN §5 で測るときの最小の組)
const SUC_DEMO_BOX = Object.freeze({
  v: 1, cap: 30,
  mons: Object.freeze([
    { id: 'demo-mocchi-500', species: 'Mocchi', nick: 'もちまる', st: { life: 500, pow: 500, wise: 500, hit: 500, eva: 500, tough: 500 }, techs: ['a', 'b'], mast: { a: 50, b: 50 }, raised: true, rank: 'B', gen: 1, titles: [] },
    { id: 'demo-golem-999', species: 'Golem', nick: 'ゴロン', st: { life: 999, pow: 999, wise: 400, hit: 999, eva: 999, tough: 999 }, techs: ['a'], mast: { a: 100 }, raised: true, rank: 'S', gen: 2, titles: [] },
    { id: 'demo-kyubi-0', species: 'Kyubi', nick: 'こん', st: { life: 0, pow: 0, wise: 0, hit: 0, eva: 0, tough: 0 }, techs: [], mast: {}, raised: true, rank: 'G', gen: 1, titles: [] },
  ]),
});

// モード選択のカードと「？」の説明。形は BATTLE_MODES と同じ
const SUCCESS_CUP_MODE = Object.freeze({
  id: 'success', label: 'サクセス杯', cardLabel: 'サクセス杯', short: 'サクセス杯', emoji: '🎖️', color: '#34d399',
  tagline: 'モンヒロサクセスで育てたモンスターが出られる大会',
  highlights: Object.freeze([
    Object.freeze(['🎖️', '育てたモンスターが4能力で出る']),
    Object.freeze(['💎', '経験値・ダイヤは難易度どおり']),
    Object.freeze(['📊', 'サクセス杯専用のスコアランキング']),
  ]),
  points: Object.freeze([
    Object.freeze(['⚔️', '編成', 'モンヒロサクセスで育てて引退したモンスターが、勇者モンにも供モンにもなれます。足りない枠はベースモンで埋まるので、引退したモンスターが1体でもいれば出られます。今のマスモンは連れていけません。']),
    Object.freeze(['🔁', '能力の換算', '6つの能力は、この大会のときだけライフ・ちから・丈夫さ・ガッツの4つに換算されます。ライフはライフ、ちからはちからとかしこさの高いほう、丈夫さは丈夫さ、ガッツは命中と回避から決まります。固有技のレベルは、覚えた技の熟練から決まります。']),
    Object.freeze(['📈', 'WAVEのあいだの強化', 'チャレンジモードと同じで、WAVEをクリアするたびに強化フェーズがあります。']),
    Object.freeze(['👹', '難しさ', '9段階の難易度から選べます。敵の強さは難易度どおりです。']),
    Object.freeze(['💎', 'もらえる経験値とダイヤ', 'ブリーダー経験値とダイヤは難易度の設定どおりです。マスモンではないので絆経験値は入りません。']),
    Object.freeze(['🏆', 'スコアと記録', 'スコアはサクセス杯専用のランキングに反映されます。自己ベスト・最高到達WAVE・クリア回数も専用の場所に残り、ほかのモードの記録は書き換わりません。優勝すると、出たモンスターに「サクセス杯 優勝」の称号が付きます。']),
    Object.freeze(['🤝', '供モンの加入', 'プロモードと同じで、始める前に供モンの候補を5体選びます。加入候補として出るのは、その5体からランダムに選ばれた3体です。']),
    Object.freeze(['⭐', 'マスモン登録', 'ありません。出たモンスターはモンヒロサクセスの保管場所に残ったままです。']),
    Object.freeze(['⏩', 'スキップチケット', '使えません。']),
    Object.freeze(['🎯', 'こんな人におすすめ', 'モンヒロサクセスで育てたモンスターの強さを、モンヒロバトルで試したい人向けです。']),
  ]),
});
