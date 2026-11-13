// 自動で作った写し(tools/masmon-battle/build-masmon-pvp-bundle.js)。手で直さない。直すのは monster-hero/data/assistant-masmon-battle.js と技データ
// deno-lint-ignore-file
const __mod = { exports: {} };
(function (module) {
// 助手のマスモンの完全オートバトルの「計算」(第③段階の芯・2026-11-11 タタカイ)。
// 設計: docs/spec/ASSISTANT_MASMON_BATTLE.md / 仕様書: docs/progress/assistant-peer/ASSISTANT-MASMON-AUTOBATTLE-SPEC-v1.md §9
//
// ★画面に頼らない純粋な計算。React・window・localStorage・Date・Math.random を使わない。
//   同じ(編成・種)なら、端末でもサーバ(Supabase Edge Function / Deno)でも同じ結果になる。
//   使ってよい計算は + − × ÷・Math.floor/round/min/max/abs/sqrt だけ(Math.exp/log/pow/sin は
//   エンジンで値がずれうるので使わない)。
// ★技はモンスターファームのような助手のマスモン専用の技表(ASSISTANT_MASMON_TECHS・シュギョウ担当)を使う
//   (2026-11-11 社長「距離撃はなしにして、技の性能自体も一新して作ってほしい。モンファーみたいな感じで」)。
//   既存のモンヒロバトルの技(通常攻撃・距離撃・固有技・ガード)は使わない。種から使うのは 距離の得意(distAptitude)と
//   基礎ガッツ(baseGuts → ガッツのたまる速さ)だけ
// ★好き嫌い・疲労・ストレスは入力に取らない(強さに効かせない)。プレイヤーのセーブ・ランキングに触れない。
//
// 使い方:
//   const catalog = ASSISTANT_MASMON_BATTLE.buildCatalog({ ALL_PLAYER_MONSTERS, ASSISTANT_MASMON_TECHS });  // 写し(JSON にできる)
//   const r = ASSISTANT_MASMON_BATTLE.simulate({ seed:'abc', catalog,
//     teamA:{ assistantId:'mua', tactics:20, members:[{ species:'Mocchi', name:'もち', lv:12,
//       stats:{ life:400, pow:420, wise:150, hit:260, eva:180, tough:390 } }] },
//     teamB:{ ... } });
//   r.winner('A'|'B'|'draw')・r.reason('wipe'|'judge')・r.log(1手ずつ)・r.digest(結果の指紋)
//   その試合だけの上乗せ(モンヒロサクセスの特別な1話など・端末だけ): simulate({ ..., buffs:{ A:{ guts:10, hit1:0.15 } } })
//     guts 始まりのガッツ+ / hit1 最初の攻撃の命中+ / crit 会心+ / missCut 外れる率を何割減らすか / eva 相手の命中− / noSulk 「動かない番」なし
//     渡さない(または空)なら今までと1つも変わらない。サーバ(masmon-pvp)は buffs を渡さない=受け付けない
//   試合の決まり(助手マスモン対戦 β の練習だけ・端末だけ): simulate({ ..., rules:{ distStart:0〜3, gutsStart:0〜100, noSwap:true } })
//     distStart 最初の間合い(零・近・中・遠)/ gutsStart 始まりのガッツ / noSwap 勝ち抜き(交代なし・倒れたら次が出る)
//     渡さない(または空)なら今までと1つも変わらない(乱数の引き方も同じ)。サーバ(masmon-pvp)は rules を渡さない=受け付けない
//   1手目: ASSISTANT_MASMON_BATTLE.firstAction(r.log, 'B') → 相手の最初の行動の行(tech・move・guard・charge・swap)
//   自分で操作する試合(モンヒロサクセス): createMatch({ ..., control:{ A:'human' } }) → pending()/choose(手)/auto()/replay(入力, 手の列)
//     オート(simulate)の結果は変えない(検査 tools/masmon-battle/masmon-manual-check.js)
(function (root) {
  'use strict';

  const VERSION = 7;           // 計算を変えたら上げる(7 = 距離適性が G〜M の12段で与ダメ・被ダメ・命中・回避に効く・オリジナル5種の等級と与ダメの補正 ×0.80〜×1.20 を社長の値に・移動速度が速いほど受けるダメージが増える・6 = ガッツの回復を種ごとに広げ(5〜15・等級 G〜A)・移動速度で先手・サイズ(小さい=当たりにくい/大きい=受けるダメージ減)・移動とガードの回復を増やし・回復の速さで与ダメを補正・サーバの試合の行に残る。2 = 技を MF のように一新・3 = 作戦と交代の早さ・4 = 忠誠度の「そっぽを向く番」と人気の会心・5 = ちから/かしこさが同じ種類の技の受けるダメージも減らす)
  const VERSION_PLAIN = 7;     // 忠誠度・人気が効かない編成(忠誠100・人気0)の版。版4までは 3 のままにしていたが、版5でダメージの式がすべての試合で変わったのでそろえた
  const DEF_SAME_KIND = 0.45;  // 受ける技と同じ種類の能力の、防ぎの効き目(丈夫さ 0.9 の半分。版5)
  const STAT_KEYS = ['life', 'pow', 'wise', 'hit', 'eva', 'tough'];
  const STAT_MAX = 999;
  const DIST_NAMES = ['零', '近', '中', '遠'];
  const DIST_START = 2; // 種が無いときの始まりの距離(中)。ふつうは種で 近・中 のどちらか(得意な距離の有利を片寄らせない)
  const GRADES = ['G', 'F', 'E', 'D', 'C', 'B', 'A', 'S', 'S+', 'SS', 'SS+', 'M'];
  const TEAM_MAX = 3;
  const GUTS_MAX = 100;
  const GUTS_START = 50;
  const GUTS_REGEN = 10;      // 毎ラウンドの自然回復の真ん中(MF の「ガッツ回復」の考え方)
  // 2026-11-13 社長「移動を増やし、種の差も広げる」「回復が速い種ほど与ダメが少し下がり、遅い種ほど上がる」
  const GUTS_REGEN_MIN = 5;   // 種ごとの毎ラウンドの自然回復の幅(いちばん遅い種)
  const GUTS_REGEN_MAX = 15;  //                                  (いちばん速い種)
  // ガッツ回復力の等級。G〜A の7段を幅(MIN〜MAX)へ等間隔に写す(社長「いまは S が存在しないので、決めた補正は G〜A の中に合わせて。
  //   今後それより下か上が出たら、幅を広げる」)。S・SS は A から1段の刻みのまま外へ伸ばす(回復も与ダメの補正も同じ刻みで続く)
  const GUTS_REGEN_GRADES = ['G', 'F', 'E', 'D', 'C', 'B', 'A'];
  const GUTS_REGEN_GRADES_UP = ['S', 'SS'];
  // 移動速度(先手)とサイズ(2026-11-13 社長「移動速度・サイズ・移動間合い・技能力の4つを、すべて入れます」「大きいほど受けるダメージを少し減らす」)
  const MOVE_SPEED_FIRST = 6;    // 移動速度の1段ごとに、先手の決め方へ足す分(D が 0。A は +18・G は −18。能力と運の合計は数百。試算で速い側の得が +1〜2 ポイントに収まる量)
  const MOVE_SPEED_TAKEN = 0.03; // 移動速度の1段ごとに受けるダメージを増減(D が ×1。速いほど多く受け、遅いほど少なく受ける。2026-11-13 社長「被ダメに影響。速いほど被ダメが上がる」)
  const SIZE_SMALL_EVADE = 0.02; // 小さい: 受ける技の命中 −2%(よける型)
  const SIZE_LARGE_CUT = 0.05;   // 大きい: 受けるダメージ −5%(耐える型。試算で小さい・大きいのどちらにも偏らない組)
  // 種ごとの等級(参考の資料の評価。gutsRecovery・moveSpeed・size)。資料に無いうちのオリジナルの5種は近い子からの案(社長に確認する)。
  //   g … ガッツ回復力 / m … 移動速度 / z … サイズ(S 小さい・M ふつう・L 大きい)。表に無い種は回復が基礎ガッツから・移動 D・サイズ M
  const SPECIES_TRAITS = Object.freeze({
    Mocchi: { g: 'C', m: 'D', z: 'S' }, Suezo: { g: 'C', m: 'F', z: 'S' }, Golem: { g: 'F', m: 'F', z: 'L' }, Tiger: { g: 'B', m: 'B', z: 'S' },
    Ham: { g: 'E', m: 'D', z: 'S' }, Pixie: { g: 'A', m: 'A', z: 'S' }, Mia: { g: 'A', m: 'A', z: 'S' }, Monol: { g: 'F', m: 'F', z: 'L' },
    Oboro: { g: 'B', m: 'E', z: 'M' }, Plant: { g: 'A', m: 'F', z: 'M' }, Zan: { g: 'B', m: 'B', z: 'M' }, Mitarashi: { g: 'D', m: 'D', z: 'S' },
    Ark: { g: 'A', m: 'A', z: 'M' }, Iblis: { g: 'A', m: 'C', z: 'M' }, Snegurochka: { g: 'B', m: 'A', z: 'S' }, Undine: { g: 'B', m: 'B', z: 'S' },
    Yaobikuni: { g: 'B', m: 'B', z: 'S' }, Yggdrasil: { g: 'C', m: 'F', z: 'L' }, MelWhip: { g: 'B', m: 'C', z: 'L' }, Ghost: { g: 'A', m: 'A', z: 'S' },
    Spooky: { g: 'A', m: 'A', z: 'S' }, Illumine: { g: 'B', m: 'A', z: 'M' }, Dreamy: { g: 'A', m: 'A', z: 'M' }, Kyubi: { g: 'A', m: 'B', z: 'S' },
    Orihime: { g: 'A', m: 'A', z: 'S' },
    // 資料に無いうちのオリジナルの5種(2026-11-13 社長が決めた値)
    Eiki: { g: 'A', m: 'A', z: 'M' }, KenshiMocchi: { g: 'A', m: 'A', z: 'S' }, Pandora: { g: 'A', m: 'A', z: 'S' }, Melody: { g: 'B', m: 'D', z: 'L' }, Kuromy: { g: 'B', m: 'C', z: 'L' },
  });
  const gradeIdx = (g) => { const t = typeof g === 'string' ? g.trim().toUpperCase() : ''; const i = GUTS_REGEN_GRADES.indexOf(t); if (i >= 0) return i; const u = GUTS_REGEN_GRADES_UP.indexOf(t); return u >= 0 ? GUTS_REGEN_GRADES.length + u : -1; };
  const GUTS_CHARGE = 22;     // 「ためる」で足す分(移動・ガードより多いまま)
  const GUTS_MOVE = 10;       // 移動・ガードで足す分
  const REGEN_DMG_SWING = 0.2;  // 回復がいちばん速い種(A)は与ダメ ×(1−これ)、いちばん遅い種(G)は ×(1+これ)。真ん中は ×1(2026-11-13 社長「×0.80〜×1.20」)
  const GUTS_SWAP_IN = 40;    // 交代で出てきたときの最低ガッツ
  const ROUND_LIMIT = 150;    // これを超えたら判定(無限に続かない)
  const SWAP_COOLDOWN = 2;    // 出てきてから自分の手番2回は交代しない(行ったり来たりを防ぐ)
  const CRIT_MULT = 1.5;
  // 忠誠度・人気(2026-11-12 キズナ・案 masmon-plan/POWER.md 8章。助手側の計算 MASMON_CALC.noActChance・critOf と同じ数): 無い編成は 忠誠100・人気0 として、今の結果と1つも変わらない
  const LOYAL_NOACT = 0.0025;  // 自分の番ごとに (100 − 忠誠) × 0.25% でそっぽを向く(何もせずガッツだけたまる)
  const POP_CRIT = 1 / 500;    // 会心の率 + 人気 ÷ 5 %(人気100で +20%)
  const CRIT_CAP = 0.30;       // 技の会心の上限(TECH_LIMITS.crit と同じ)+ 人気の分
  const critWithPop = (base, pop) => (pop > 0 ? Math.min(CRIT_CAP + pop * POP_CRIT, base + pop * POP_CRIT) : base);
  // 技の熟練(0〜100。シュギョウの mh_assistant_masmon_train_v1)の効き。社長が「中」を選んだ(2026-11-11)
  const MASTERY_HIT_MAX = 0.06;    // 熟練100で命中 +6%
  const MASTERY_GUTS_CUT = 0.15;   // 熟練100でガッツ消費 −15%(四捨五入)
  const MASTERY_GUARD_ADD = 0.08;  // ガードの熟練100で受けるダメージがさらに −8%
  // 能力の差の効き方のつまみ(2026-11-11 社長「実際バトルをしてほしい。それを観戦できるようにしたい」。決めるのは観戦してから)。
  //   1体ごとの6能力の合計と、出る全員の平均の合計との差を k 倍にする(6能力の配分=個性はそのまま)。
  //   A=いまのまま(本番の技表で合計+10%の側が約75%勝つ)/B=差を半分に(約62%)/C=差を1.5倍に(約85%)
  const BALANCE = Object.freeze({ A: 1, B: 0.5, C: 1.5 });
  // 技の数字の幅(MF2 の技の幅。docs/spec/ASSISTANT_MASMON_BATTLE.md「MF との対応」)。外れた値は切る
  const TECH_LIMITS = Object.freeze({ power: [1, 70], hit: [-25, 22], guts: [5, 60], crit: [0, 30], gd: [0, 45] });

  // ── 種(シード)から決まる乱数。文字列でも数でもよい ──
  const hashSeed = (seed) => {
    const s = String(seed == null ? '' : seed);
    let h = 1779033703 ^ s.length;
    for (let i = 0; i < s.length; i++) {
      h = Math.imul(h ^ s.charCodeAt(i), 3432918353);
      h = (h << 13) | (h >>> 19);
    }
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return (h ^ (h >>> 16)) >>> 0;
  };
  const makeRng = (seed) => {
    let a = hashSeed(seed);
    return () => {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };

  const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
  const toInt = (v, lo, hi, def) => {
    const n = (v == null || v === '' || typeof v === 'boolean') ? NaN : Number(v);
    return Number.isFinite(n) ? clamp(Math.round(n), lo, hi) : def;
  };

  // ── 助手の性格(仕様書 §7 の仮の傾向)。重みは 1 が普通 ──
  //   aggr 攻め / caution 守り(ガードと反撃の怖さ) / thrift ガッツの節約 / mobility 間合いを取りに行く
  //   swap 交代の好み / gamble 大技(威力30以上)の好み / read 読みの良さ(戦術経験に足す)
  const STYLE_BASE = Object.freeze({ aggr: 1, caution: 1, thrift: 1, mobility: 1, swap: 1, gamble: 1, read: 0 });
  const STYLES = Object.freeze({
    mua:       Object.freeze({ label: '積極型', aggr: 1.3, caution: 0.75, thrift: 0.8, mobility: 1.0, swap: 0.7, gamble: 1.25, read: 0 }),
    kiki:      Object.freeze({ label: '分析型', aggr: 1.0, caution: 1.0, thrift: 1.1, mobility: 1.15, swap: 1.1, gamble: 0.85, read: 15 }),
    momosuke:  Object.freeze({ label: '安定型', aggr: 0.9, caution: 1.25, thrift: 1.25, mobility: 0.9, swap: 0.9, gamble: 0.75, read: 5 }),
    dra:       Object.freeze({ label: '大胆型', aggr: 1.4, caution: 0.6, thrift: 0.7, mobility: 1.2, swap: 0.5, gamble: 1.5, read: 0 }),
    atsu:      Object.freeze({ label: 'バランス型', aggr: 1.0, caution: 1.0, thrift: 1.0, mobility: 1.0, swap: 1.0, gamble: 1.0, read: 5 }),
    kyuko:     Object.freeze({ label: '研究型', aggr: 1.0, caution: 1.0, thrift: 1.05, mobility: 1.25, swap: 1.2, gamble: 1.0, read: 10 }),
    sorashido: Object.freeze({ label: '柔軟型', aggr: 1.05, caution: 1.0, thrift: 1.0, mobility: 1.3, swap: 1.4, gamble: 1.0, read: 5 }),
    erubin:    Object.freeze({ label: '防御型', aggr: 0.8, caution: 1.5, thrift: 1.15, mobility: 0.95, swap: 1.0, gamble: 0.8, read: 5 }),
  });
  // 作戦と交代の早さ(2026-11-11 社長「自分で決める」に 作戦・交代の早さ。数字はミセカタ2の案・鏡の対戦で勝率 47〜52%)。
  // 端末からは名前だけ受け、倍率は計算側の表で掛ける(フレンド対戦でサーバが同じ計算をし、数値の改ざんを通さない)
  const PLANS = Object.freeze({
    attack: Object.freeze({ label: '攻める', mul: Object.freeze({ aggr: 1.25, caution: 0.8, thrift: 0.85, gamble: 1.2 }) }),
    guard:  Object.freeze({ label: '守る',   mul: Object.freeze({ aggr: 0.85, caution: 1.3, thrift: 1.2, gamble: 0.8 }) }),
    range:  Object.freeze({ label: '間合い', mul: Object.freeze({ mobility: 1.35, thrift: 1.05 }) }),
    big:    Object.freeze({ label: '大技',   mul: Object.freeze({ gamble: 1.45, aggr: 1.1, thrift: 0.8 }) }),
  });
  const SWAP_PACES = Object.freeze({
    early: Object.freeze({ label: '早め',   mul: Object.freeze({ swap: 1.5 }) }),
    late:  Object.freeze({ label: 'ねばる', mul: Object.freeze({ swap: 0.55 }) }),
  });
  // 重みの範囲(作戦・上書きのあとに切る)。read(読み)は 0〜30
  const STYLE_RANGE = Object.freeze({ swap: [0.3, 2.0], read: [0, 30], other: [0.4, 1.8] });
  const styleOf = (assistantId, override, plan, swapPace) => {
    const base = STYLES[assistantId] || STYLES.atsu;
    const pm = (PLANS[plan] && PLANS[plan].mul) || {};
    const sm = (SWAP_PACES[swapPace] && SWAP_PACES[swapPace].mul) || {};
    const out = {};
    for (const k of Object.keys(STYLE_BASE)) {
      const o = override && Number.isFinite(Number(override[k])) ? Number(override[k]) : null;
      let v = o != null ? o : (Number.isFinite(base[k]) ? base[k] : STYLE_BASE[k]);
      v = v * (pm[k] || 1) * (sm[k] || 1);
      const [lo, hi] = STYLE_RANGE[k] || STYLE_RANGE.other;
      out[k] = clamp(v, lo, hi);
    }
    return out;
  };


  // ── 技表の写し(画面の変数から一度だけ作る。JSON にしてサーバへ持っていける) ──
  //   ASSISTANT_MASMON_TECHS = { version, species: { [種]: [ { id, name, kind:'pow'|'wise', dist:[0..3], power, hit, guts, crit, gd } ] } }
  const normTech = (t, idx) => {
    const x = t && typeof t === 'object' ? t : {};
    const num = (v, k, def) => { const n = Number(v); const [lo, hi] = TECH_LIMITS[k]; return Number.isFinite(n) ? clamp(Math.round(n), lo, hi) : def; };
    const dist = (Array.isArray(x.dist) ? x.dist : []).map(Number).filter(d => Number.isInteger(d) && d >= 0 && d <= 3);
    return {
      id: typeof x.id === 'string' && x.id ? x.id : `t${idx}`,
      name: typeof x.name === 'string' && x.name ? x.name : `技${idx + 1}`,
      kind: x.kind === 'wise' ? 'wise' : 'pow',
      dist: dist.length ? [...new Set(dist)].sort() : [1],
      power: num(x.power, 'power', 10), hit: num(x.hit, 'hit', 0), guts: num(x.guts, 'guts', 20),
      crit: num(x.crit, 'crit', 5), gd: num(x.gd, 'gd', 0),
      start: !!(x.learn && x.learn.start),        // はじめから覚えている技(覚えた技の記録が無いときはこれだけ)
      // 技を使ったあとに移る間合い(資料の moveTo。0零〜3遠)。無い技は持たない(写しの形を今のままにする)
      ...(Number.isInteger(x.moveTo) && x.moveTo >= 0 && x.moveTo <= 3 ? { moveTo: x.moveTo } : {}),
    };
  };
  const buildCatalog = (src) => {
    const s = src || {};
    const mons = s.ALL_PLAYER_MONSTERS || {};
    const table = (s.ASSISTANT_MASMON_TECHS && s.ASSISTANT_MASMON_TECHS.species) || {};
    const species = {};
    for (const id of Object.keys(mons).sort()) {
      const m = mons[id];
      const techs = Array.isArray(table[id]) ? table[id].map(normTech) : [];
      if (!m || !techs.length) continue;            // 技表に無い種は対戦に出られない
      const apt = Array.isArray(m.distAptitude) && m.distAptitude.length === 4
        ? m.distAptitude.map(g => (GRADES.includes(g) ? g : 'C')) : ['C', 'C', 'C', 'C'];
      species[id] = { name: String(m.name || id), apt, techs, baseGuts: Number(m.baseGuts) || 0 };
    }
    // 種ごとのガッツのたまる速さ(毎ラウンドの自然回復): 表 ASSISTANT_MASMON_GUTS_REGEN(種 → 等級 'G'〜'S' か 回復の数)があればそれ、
    //   無ければモンヒロバトルの基礎ガッツ(baseGuts)の大きさで幅(GUTS_REGEN_MIN〜MAX)に並べる。
    //   与ダメの補正 dmgMul: 回復が速い種ほど少し下がり、遅い種ほど少し上がる(速さで得する分を威力で釣り合わせる)
    const gs = Object.values(species).map(v => v.baseGuts);
    const gMin = Math.min(...gs), gMax = Math.max(...gs);
    // 回復の表: 渡されたもの(試算・差し替え用)があればそれ、無ければ種ごとの等級(SPECIES_TRAITS の g)
    const regenTable = s.ASSISTANT_MASMON_GUTS_REGEN && typeof s.ASSISTANT_MASMON_GUTS_REGEN === 'object' ? s.ASSISTANT_MASMON_GUTS_REGEN
      : Object.fromEntries(Object.entries(SPECIES_TRAITS).map(([k, v]) => [k, v.g]));
    const half = (GUTS_REGEN_MAX - GUTS_REGEN_MIN) / 2;
    for (const [id, v] of Object.entries(species)) {
      // x … 回復の速さ(丸める前)。与ダメの補正は x から引く(等級の刻みどおりに等間隔)。回復そのものは整数に丸める
      const gTxt = typeof regenTable[id] === 'string' ? regenTable[id].trim().toUpperCase() : '';
      const gi = gradeIdx(gTxt);
      const step = (GUTS_REGEN_MAX - GUTS_REGEN_MIN) / (GUTS_REGEN_GRADES.length - 1);
      const num = Number(regenTable[id]);
      const fixed = gi >= 0 ? GUTS_REGEN_MIN + gi * step : (typeof regenTable[id] === 'number' && Number.isFinite(num) ? clamp(num, 1, 30) : NaN);
      v.regen = Number.isFinite(fixed) ? Math.round(fixed)
        : gMax > gMin ? GUTS_REGEN_MIN + Math.round((v.baseGuts - gMin) / (gMax - gMin) * (GUTS_REGEN_MAX - GUTS_REGEN_MIN)) : GUTS_REGEN;
      const x = Number.isFinite(fixed) ? fixed : v.regen; // 表の等級・数は丸める前の値で補正を決める(等級ごとに等間隔)
      v.dmgMul = half > 0 ? Math.round(Math.max(0.3, 1 - (x - (GUTS_REGEN_MIN + half)) / half * REGEN_DMG_SWING) * 1000) / 1000 : 1;
      // 移動速度(先手の足し分)とサイズ
      const tr = SPECIES_TRAITS[id] || {};
      const mi = gradeIdx(tr.m);
      v.first = mi >= 0 ? (mi - GUTS_REGEN_GRADES.indexOf('D')) * MOVE_SPEED_FIRST : 0;
      v.taken = mi >= 0 ? Math.round(Math.max(0.5, 1 + (mi - GUTS_REGEN_GRADES.indexOf('D')) * MOVE_SPEED_TAKEN) * 1000) / 1000 : 1;
      v.size = tr.z === 'S' || tr.z === 'L' ? tr.z : 'M';
      delete v.baseGuts;
    }
    const tv = s.ASSISTANT_MASMON_TECHS && Number(s.ASSISTANT_MASMON_TECHS.version);
    return { version: VERSION, techVersion: Number.isFinite(tv) ? tv : 0, species };
  };

  const LV_MAX = 99;   // 育成の Lv 1〜99(キズナ4の AMG_LV_MAX)。いまは強さに効かない(強さは6能力と熟練が持つ)
  // 距離適性(2026-11-13 社長「距離適性はモンサク用に効果調整して。与ダメや被ダメ・命中・回避等に影響。C を 0% として増減」)
  //   G〜M の12段。C が 0 段・上は B +1 … M +7・下は D −1 … G −4。いまいる間合いの段で、次の4つが増減する(止めない。M まで効く)
  const APT_DMG = 0.04;  // 与えるダメージ: 1段ごとに ±4%
  const APT_DEF = 0.02;  // 受けるダメージ: 1段ごとに ∓2%(得手の間合いでは受けるダメージが減る)
  const APT_HIT = 0.015; // 命中: 1段ごとに ±1.5%
  const APT_EVA = 0.015; // 回避: 1段ごとに ±1.5%(得手の間合いでは相手の命中が下がる)
  const APT_ABOVE_A = 0.5; // A より上(S〜M)の1段の効き目の割合(1 なら同じ刻み。0.5 なら半分の刻みでゆるやかに伸びる)
  const aptSteps = (grade) => { const i = GRADES.indexOf(grade); if (i < 0) return 0; const st = i - GRADES.indexOf('C'); const a = GRADES.indexOf('A') - GRADES.indexOf('C'); return st > a ? a + (st - a) * APT_ABOVE_A : st; };
  const aptMult = (grade) => Math.max(0.5, 1 + aptSteps(grade) * APT_DMG);

  // 1体ぶんの技の表。覚えている技(techs)だけ・熟練で命中とガッツ消費を直す。
  // 覚えた技の記録が無い(古い入れ物)ときは、はじめから覚えている技(learn.start)だけ。それも無い種は全部。
  // 記録があって1つも当てはまらなければ、はじめの技(無ければ最初の技)
  const startTechs = (sp) => { const st = sp.techs.filter(t => t.start); return st.length ? st : sp.techs.slice(); };
  const buildMoves = (catalog, speciesId, techIds, mastery) => {
    const sp = catalog.species[speciesId];
    const known = Array.isArray(techIds) ? sp.techs.filter(t => techIds.includes(t.id)) : startTechs(sp);
    const list = known.length ? known : (sp.techs.some(t => t.start) ? startTechs(sp) : [sp.techs[0]]);
    return list.map(t => {
      const m = clamp(Number(mastery && mastery[t.id]) || 0, 0, 100);
      return { key: t.id, name: t.name, kind: t.kind, dist: t.dist, power: t.power / 20,
        hit: t.hit / 100 + m / 100 * MASTERY_HIT_MAX, guts: Math.round(t.guts * (1 - m / 100 * MASTERY_GUTS_CUT)),
        crit: t.crit / 100, gd: t.gd, big: t.power >= 30, ...(t.moveTo != null ? { moveTo: t.moveTo } : {}) };
    });
  };

  // 助手のマスモンの並び(mh_assistant_life_masmon_v1 の行: monster・nick・lv)と育成の入れ物
  // (mh_assistant_masmon_grow_v1 の amgEntryOf の戻り: st・lv)と修行の入れ物(mh_assistant_masmon_train_v1 の
  // amgtEntryOf の戻り: m=熟練・learn=覚えた技。amgtBattleOf の { techs, mastery } でもよい)から、対戦の1体を作る。入れ物が無ければ既定値
  //   bond(助手の絆 mh_assistant_masmon_bond_v1 の1体: loy・pop)があれば忠誠度・人気も渡す。無ければ渡さない(= 忠誠100・人気0)
  const unitFromGrow = (row, entry, train, bond) => {
    const r = row && typeof row === 'object' ? row : {};
    const e = entry && typeof entry === 'object' ? entry : null;
    const t = train && typeof train === 'object' ? train : null;
    // 修行の入れ物 { m, learn } でも、受け渡し amgtBattleOf の { techs, mastery } でもよい
    const learn = t && (Array.isArray(t.techs) ? t.techs : t.learn);
    const techs = Array.isArray(learn) ? learn : (learn && typeof learn === 'object' ? Object.keys(learn).filter(k => learn[k]) : undefined);
    const mastery = t && (t.mastery && typeof t.mastery === 'object' ? t.mastery : (t.m && typeof t.m === 'object' ? t.m : undefined));
    const bd = bond && typeof bond === 'object' ? bond : null;
    return { species: r.monster, name: r.nick, lv: e && e.lv != null ? e.lv : r.lv, stats: e ? e.st : null,
      techs, mastery: mastery || undefined, ...(bd ? { loy: Math.round(Number(bd.loy)), pop: Math.floor(Number(bd.pop)) } : {}) };
  };

  // ── 入力の正規化(壊れた値は既定値で補う) ──
  // 子ごとに上げた間合い適性の段数(モンサクの育成・合体円盤石で継いだ分の合計。2026-11-13 社長の決め・開発部と同じ形)
  //   aptUp … [零, 近, 中, 遠] の整数。端末から来た値をそのまま信じず、ここで切りそろえる(サーバも同じ芯なので同じ結果):
  //   数の型の整数でないもの(文字列・小数)・負は 0/1つの間合いは per まで/合計が total を超えたら後ろの間合いから削る/M の数が mMax を超えたら、超えた分を(後ろから)SS+ に
  const APT_UP_LIMITS = Object.freeze({ total: 18, per: 11, mMax: 4 });
  const normAptUp = (a) => {
    const out = [0, 0, 0, 0];
    if (!Array.isArray(a)) return out;
    for (let i = 0; i < 4; i++) { const v = a[i]; out[i] = typeof v === 'number' && Number.isInteger(v) && v > 0 ? Math.min(APT_UP_LIMITS.per, v) : 0; }
    let over = out.reduce((x, y) => x + y, 0) - APT_UP_LIMITS.total;
    for (let i = 3; i >= 0 && over > 0; i--) { const cut = Math.min(out[i], over); out[i] -= cut; over -= cut; }
    return out;
  };
  const applyAptUp = (apt, up) => {
    const res = apt.map((g, i) => { const b = GRADES.indexOf(g); return GRADES[Math.min(GRADES.length - 1, (b < 0 ? GRADES.indexOf('C') : b) + (up[i] || 0))]; });
    let ms = res.filter((g) => g === 'M').length;
    for (let i = 3; i >= 0 && ms > APT_UP_LIMITS.mMax; i--) if (res[i] === 'M' && (up[i] || 0) > 0) { res[i] = 'SS+'; ms--; }
    return res;
  };
  const normalizeUnit = (u, catalog) => {
    const src = u && typeof u === 'object' ? u : {};
    const ids = Object.keys(catalog.species);
    const species = catalog.species[src.species] ? src.species : ids[0];
    const stats = {};
    // 能力は stats でも st(育成の入れ物 mh_assistant_masmon_grow_v1 の形)でもよい
    const raw = src.stats && typeof src.stats === 'object' ? src.stats : src.st;
    const ss = raw && typeof raw === 'object' ? raw : {};
    for (const k of STAT_KEYS) stats[k] = toInt(ss[k], 0, STAT_MAX, 100);
    const lv = toInt(src.lv, 1, LV_MAX, 1);
    // 覚えている技(無ければその種の全部)・熟練(技 id ごと+guard・dist・swap。無ければ 0)
    const techs = Array.isArray(src.techs) ? src.techs.filter(x => typeof x === 'string') : null;
    const mastery = {};
    const ms = src.mastery && typeof src.mastery === 'object' ? src.mastery : {};
    for (const k of [...catalog.species[species].techs.map(t => t.id), 'guard', 'dist', 'swap']) mastery[k] = toInt(ms[k], 0, 100, 0);
    const loy = toInt(src.loy, 0, 100, 100); // 忠誠度(無ければ100)
    const pop = toInt(src.pop, 0, 100, 0);   // 人気(無ければ0)
    const aptUp = normAptUp(src.aptUp);        // 上げた間合い適性(無ければ 0 段)
    return { species, name: typeof src.name === 'string' && src.name ? src.name.slice(0, 24) : catalog.species[species].name, lv, stats, techs, mastery, loy, pop, aptUp };
  };
  const normalizeTeam = (t, catalog) => {
    const src = t && typeof t === 'object' ? t : {};
    const list = (Array.isArray(src.members) ? src.members : []).slice(0, TEAM_MAX).map(u => normalizeUnit(u, catalog));
    if (!list.length) throw new Error('assistant-masmon-battle: members が空');
    return {
      assistantId: typeof src.assistantId === 'string' ? src.assistantId : 'atsu',
      tactics: toInt(src.tactics, 0, 100, 0),
      plan: PLANS[src.plan] ? src.plan : null,
      swapPace: SWAP_PACES[src.swapPace] ? src.swapPace : null,
      style: styleOf(src.assistantId, src.style, src.plan, src.swapPace),
      members: list,
    };
  };

  const maxHpOf = (stats) => 100 + Math.round(stats.life * 1.5);

  // ── 計算の部品(AI もこれで見積もる。実際の判定と同じ式) ──
  // モンスターファームの考え方を参考に(docs/spec/ASSISTANT_MASMON_BATTLE.md「MF との対応」):
  //   撃つときのガッツが多いほど当たりやすく(±5%)・重い(×0.9〜1.1)。g は撃つ前のガッツ(省くといまのガッツ)
  const gutsHit = (g) => (clamp(g, 0, GUTS_MAX) - 50) / 50 * 0.05;
  const gutsPow = (g) => 0.9 + clamp(g, 0, GUTS_MAX) / GUTS_MAX * 0.2;
  //   dist … いまの間合い(渡したときだけ距離適性が命中・回避に効く)
  const hitChance = (atkU, defU, mv, g, dist) => clamp(0.75 + (atkU.stats.hit - defU.stats.eva) / STAT_MAX * 0.5 + mv.hit - (defU.size === 'S' ? SIZE_SMALL_EVADE : 0)
    + gutsHit(g == null ? atkU.guts : g)
    + (Number.isInteger(dist) && atkU.apt && defU.apt ? aptSteps(atkU.apt[dist]) * APT_HIT - aptSteps(defU.apt[dist]) * APT_EVA : 0), 0.15, 0.97);
  const rawDamage = (atkU, defU, mv, dist, g) => {
    const a = atkU.stats[mv.kind];
    const base = mv.power * (20 + a * 0.6) * aptMult(atkU.apt[dist]) * gutsPow(g == null ? atkU.guts : g) * (atkU.dmgMul || 1);
    // 受ける側: 丈夫さ(×0.9)に、受ける技と同じ種類の能力(ちから技ならちから・かしこさ技ならかしこさ)を丈夫さの半分の効き目(×0.45)で足す
    //   (2026-11-12 社長「ちから技のダメージが増加する/相手のちから技によるダメージを軽減する。かしこさも同じ。被ダメにも影響ある」)
    return base * 300 / (300 + defU.stats.tough * 0.9 + (defU.stats[mv.kind] || 0) * DEF_SAME_KIND) * (defU.size === 'L' ? 1 - SIZE_LARGE_CUT : 1)
      * Math.max(0.5, 1 - aptSteps(defU.apt ? defU.apt[dist] : 'C') * APT_DEF) // 受ける側の距離適性
      * (defU.taken || 1); // 受ける側の移動速度(速いほど多く受ける)
  };
  const guardCut = (u) => clamp(0.35 + u.stats.tough / STAT_MAX * 0.25, 0.35, 0.6) + (u.mastery ? u.mastery.guard : 0) / 100 * MASTERY_GUARD_ADD;
  const canUse = (u, mv, dist) => mv.dist.includes(dist) && u.guts >= mv.guts;
  const inRange = (mv, dist) => mv.dist.includes(dist);
  const expected = (atkU, defU, mv, dist, guarded, g) => {
    const p = hitChance(atkU, defU, mv, g, dist);
    const crit = critWithPop(mv.crit, atkU.pop || 0);
    return p * rawDamage(atkU, defU, mv, dist, g) * (1 + crit * (CRIT_MULT - 1)) * (guarded ? 1 - guardCut(defU) : 1);
  };
  // 届く距離で一番よい技の期待ダメージ(ガッツが足りるかは gutsAvail で見る)
  const bestThreat = (atkU, defU, dist, gutsAvail) => {
    let best = 0;
    for (const mv of atkU.moves) {
      if (!inRange(mv, dist) || gutsAvail < mv.guts) continue;
      const e = expected(atkU, defU, mv, dist, false, gutsAvail);
      if (e > best) best = e;
    }
    return best;
  };
  // 相性: この組み合わせで、どちらが何手で倒せそうか(大きいほど自分が有利)
  const matchup = (me, foe, dist) => {
    let myBest = 0, foeBest = 0;
    for (let d = 0; d < 4; d++) {
      const w = d === dist ? 1.2 : 1;
      myBest = Math.max(myBest, bestThreat(me, foe, d, GUTS_MAX) * w);
      foeBest = Math.max(foeBest, bestThreat(foe, me, d, GUTS_MAX) * w);
    }
    const myTurns = foe.hp / Math.max(1, myBest * 0.55);   // 0.55 = ガッツの都合で毎手は撃てない分
    const foeTurns = me.hp / Math.max(1, foeBest * 0.55);
    return foeTurns - myTurns;
  };

  // ── 助手の AI: 手の候補に点を付けて一番高いものを選ぶ ──
  //   期待ダメージ・命中率・ガッツ消費・残りライフ・反撃の怖さ・距離・交代の得 を比べ、性格の重みを掛ける。
  //   戦術経験(0〜100)が低いほど見積もりがぶれる(ゆらぎ)。ただし「明らかに損な手」は最初から候補に入れない。
  const chooseAction = (ctx, side) => {
    const st = ctx.state;
    const me = st.teams[side];
    const foeSide = side === 'A' ? 'B' : 'A';
    const foeT = st.teams[foeSide];
    const u = me.units[me.active];
    const f = foeT.units[foeT.active];
    const dist = st.dist;
    const sty = me.style;
    const skill = clamp((me.tactics + sty.read) / 100, 0, 1);
    const cands = [];
    const foeNextGuts = Math.min(GUTS_MAX, f.guts + f.regen);
    const threatNow = bestThreat(f, u, dist, foeNextGuts);
    const hpFrac = u.hp / u.maxHp;
    const danger = threatNow / Math.max(1, u.hp);          // 次の一撃で失う割合

    // 技
    let bestTech = 0;
    for (const mv of u.moves) {
      if (!canUse(u, mv, dist)) continue;
      const e = expected(u, f, mv, dist, f.guarding);
      const p = hitChance(u, f, mv, undefined, dist);
      let score = Math.min(e, f.hp) / f.maxHp * 100 * sty.aggr;
      if (e >= f.hp) score += 35 * p * sty.aggr;                    // 倒しきれそう
      // ガッツの節約: 使ったあと次の手で撃てなくなる分(危ないときは気にしない)
      score -= Math.max(0, mv.guts - u.regen) * 0.12 * sty.thrift * (1 - Math.min(1, danger));
      if (mv.big) score *= 1 + (sty.gamble - 1) * 0.8;               // 大技(威力30以上)の好み
      // ガッツダウン: 当たれば相手が次に撃てる技が減る(相手のガッツが少ないほど効く)
      if (mv.gd > 0) score += p * Math.min(mv.gd, f.guts) * 0.12 * (0.6 + 0.4 * skill);
      if (score > bestTech) bestTech = score;
      cands.push({ type: 'tech', key: mv.key, score, why: e >= f.hp ? 'finish' : (mv.gd > 0 && mv.gd >= 20 ? 'gutsDown' : (mv.big ? 'big' : 'attack')) });
    }
    // 移動(1歩)。手番を1つ使う=いま撃てる技を捨てる。相手も動けるので、得は半分しか当てにしない
    const reachHere = u.moves.some(mv => inRange(mv, dist));
    for (const step of [-1, 1]) {
      const nd = dist + step;
      if (nd < 0 || nd > 3) continue;
      const myGuts = Math.min(GUTS_MAX, u.guts + u.regen + GUTS_MOVE);
      const gain = bestThreat(u, f, nd, myGuts) - bestThreat(u, f, dist, myGuts);
      const risk = bestThreat(f, u, nd, foeNextGuts) - threatNow;
      // 読みが浅いうちは、相手の反撃(risk)を半分しか見ない
      let score = (gain / f.maxHp * 100 * sty.aggr - risk / u.maxHp * 100 * sty.caution * (0.5 + 0.5 * skill)) * 0.9 * sty.mobility;
      score -= bestTech * 0.7 + 2 + u.moveStreak * 5;   // 続けて動くほど損(行ったり来たりを防ぐ)
      // どの技も届かない距離にいるなら、届く方へ
      const toReach = !reachHere && u.moves.some(mv => inRange(mv, nd));
      if (toReach) score += 20;
      cands.push({ type: 'move', step, score, why: toReach ? 'reach' : (gain > 0 ? 'better' : 'safer') });
    }
    // ガード(相手が撃ってこなければ無駄になるので、見込みは 6 割)
    if (threatNow > 0) {
      const saved = threatNow * guardCut(u) * 0.6;
      let score = saved / u.maxHp * 100 * (0.4 + 0.6 * sty.caution) * (0.8 + (1 - hpFrac) * 0.6) * (0.5 + 0.5 * skill);
      score -= bestTech * (0.45 - 0.15 * (sty.caution - 1));
      cands.push({ type: 'guard', score, why: hpFrac < 0.5 ? 'lowHp' : 'block' });
    }
    // ためる(ガッツが満タンなら候補に入れない)
    if (u.guts < GUTS_MAX) {
      const afterGuts = Math.min(GUTS_MAX, u.guts + u.regen + GUTS_CHARGE);
      const nowBest = bestThreat(u, f, dist, u.guts);
      const laterBest = bestThreat(u, f, dist, afterGuts);
      let score = (laterBest - nowBest) / f.maxHp * 100 * 0.6 * (0.8 + 0.2 * sty.thrift);
      score -= danger * 20 * (0.8 + 0.2 * sty.caution);              // 危ないときにためるのは損
      if (nowBest === 0 && laterBest > 0) score += 8;
      cands.push({ type: 'charge', score, why: nowBest === 0 ? 'noGuts' : 'saveUp' });
    }
    // 交代(勝ち抜きの決まりでは出さない)
    if (u.swapCooldown <= 0 && !ctx.noSwap) {
      const cur = matchup(u, f, dist);
      for (let i = 0; i < me.units.length; i++) {
        const b = me.units[i];
        if (i === me.active || b.hp <= 0) continue;
        const gain = matchup(b, f, dist) - cur;
        let score = gain * 6 * sty.swap * (0.4 + 0.6 * skill);
        if (danger >= 1 && hpFrac < 0.5) score += 10 * sty.swap * skill;  // このままだと倒される → 逃がす
        score -= 6;                                                       // 手番を使う分
        cands.push({ type: 'swap', to: i, score, why: danger >= 1 && hpFrac < 0.5 ? 'rescue' : 'matchup' });
      }
    }
    if (!cands.length) cands.push({ type: 'charge', score: 0, why: 'noGuts' });       // ガッツ満タンで何もできない時の保険(実際は起きない)

    // 最低限の判断(戦術経験に関係なく): 当たれば確実に倒せる技があれば、一番当たりやすいものを撃つ
    let sure = null;
    for (const mv of u.moves) {
      if (!canUse(u, mv, dist)) continue;
      const minDmg = rawDamage(u, f, mv, dist) * 0.9 * (f.guarding ? 1 - guardCut(f) : 1);
      if (minDmg < f.hp) continue;
      const p = hitChance(u, f, mv, undefined, dist);
      if (!sure || p > sure.p || (p === sure.p && mv.guts < sure.guts)) sure = { key: mv.key, p, guts: mv.guts };
    }
    if (sure) {
      const pick = cands.find(c => c.type === 'tech' && c.key === sure.key);
      pick.eval = pick.score;
      pick.why = 'finish';
      if (ctx.trace) ctx.lastCands = cands.map(c => Object.assign({}, c, { score: Math.round(c.score * 10) / 10 }));
      return pick;
    }
    // 戦術経験が低いほど、見積もりがぶれる(最大 ±noise)
    const noise = 2 + (1 - skill) * 14;
    let best = null;
    for (const c of cands) {
      c.eval = c.score + (ctx.rng() * 2 - 1) * noise;
      if (!best || c.eval > best.eval) best = c;
    }
    if (ctx.trace) ctx.lastCands = cands.map(c => Object.assign({}, c, { score: Math.round(c.score * 10) / 10, eval: Math.round(c.eval * 10) / 10 }));
    return best;
  };

  // 倒れたときに次に出す1体(相性の一番よいもの)
  const chooseReplacement = (ctx, side) => {
    const st = ctx.state;
    const me = st.teams[side];
    const foeT = st.teams[side === 'A' ? 'B' : 'A'];
    const f = foeT.units[foeT.active];
    let best = -1, bestScore = -Infinity;
    for (let i = 0; i < me.units.length; i++) {
      const b = me.units[i];
      if (b.hp <= 0) continue;
      const skill = clamp((me.tactics + me.style.read) / 100, 0, 1);
      const s = (f && f.hp > 0 ? matchup(b, f, st.dist) : 0) + (ctx.rng() * 2 - 1) * (1 + (1 - skill) * 4) - i * 0.01;
      if (s > bestScore) { bestScore = s; best = i; }
    }
    return best;
  };

  // 対戦の初めの状態(検査からも使う)
  const setupState = (inp, catalog) => {
    const mkTeam = (t) => {
      const nt = normalizeTeam(t, catalog);
      return {
        assistantId: nt.assistantId, tactics: nt.tactics, plan: nt.plan, swapPace: nt.swapPace, style: nt.style, active: 0,
        units: nt.members.map(m => {
          const maxHp = maxHpOf(m.stats);
          return { species: m.species, name: m.name, lv: m.lv, stats: m.stats, apt: applyAptUp(catalog.species[m.species].apt, m.aptUp || [0, 0, 0, 0]),
            moves: buildMoves(catalog, m.species, m.techs, m.mastery), mastery: m.mastery, maxHp, hp: maxHp, guts: GUTS_START, regen: catalog.species[m.species].regen, dmgMul: catalog.species[m.species].dmgMul || 1, first: catalog.species[m.species].first || 0, taken: catalog.species[m.species].taken || 1, size: catalog.species[m.species].size || 'M',
            guarding: false, swapCooldown: SWAP_COOLDOWN, moveStreak: 0, loy: m.loy, pop: m.pop };
        }),
      };
    };
    return { teams: { A: mkTeam(inp.teamA), B: mkTeam(inp.teamB) }, dist: DIST_START, round: 0 };
  };

  // 能力の差の効き方: 1体ごとの合計の差を k 倍(A は何もしない=結果は変わらない)
  const applyBalance = (state, k) => {
    if (k === 1) return;
    const all = [...state.teams.A.units, ...state.teams.B.units];
    const sum = (u) => STAT_KEYS.reduce((t, key) => t + u.stats[key], 0);
    const avg = all.reduce((t, u) => t + sum(u), 0) / all.length;
    for (const u of all) {
      const tot = sum(u);
      if (tot <= 0) continue;
      const f = (avg + (tot - avg) * k) / tot;
      const st = {};
      for (const key of STAT_KEYS) st[key] = clamp(Math.round(u.stats[key] * f), 0, STAT_MAX);
      u.stats = st;
      u.maxHp = maxHpOf(st); u.hp = u.maxHp;
    }
  };

  const ACTION_EVS = ['tech', 'move', 'guard', 'charge', 'swap'];

  // ── その試合だけの上乗せ(buffs) ──
  //   壊れた値・範囲外は切る。効くものが1つも無ければ null(= 今までと同じ計算の道)
  const BUFF_LIMITS = Object.freeze({ guts: [0, 50], hit1: [0, 0.5], crit: [0, 0.5], missCut: [0, 1], eva: [0, 0.5] });
  const normalizeBuffs = (b) => {
    if (!b || typeof b !== 'object') return null;
    const out = {};
    for (const k of Object.keys(BUFF_LIMITS)) {
      const n = Number(b[k]);
      if (!Number.isFinite(n)) continue;
      const v = k === 'guts' ? Math.round(clamp(n, BUFF_LIMITS[k][0], BUFF_LIMITS[k][1])) : clamp(n, BUFF_LIMITS[k][0], BUFF_LIMITS[k][1]);
      if (v > 0) out[k] = v;
    }
    if (b.noSulk === true) out.noSulk = true;
    return Object.keys(out).length ? out : null;
  };
  // 実際に当たるかの率に上乗せを足す(AI の見積もりには入れない)。上乗せが無いときは p をそのまま返す
  const buffedHit = (p, bAtk, bDef, first) => {
    if (!bAtk && !bDef) return p;
    let q = p;
    if (bAtk && first && bAtk.hit1) q += bAtk.hit1;
    if (bDef && bDef.eva) q -= bDef.eva;
    q = clamp(q, 0.05, 0.99);
    if (bAtk && bAtk.missCut) q = 1 - (1 - q) * (1 - bAtk.missCut);
    return clamp(q, 0.05, 0.99);
  };
  // ── 試合の決まり(rules・β の練習だけ) ──
  //   壊れた値・範囲外は切る。効くものが1つも無ければ null(= 今までと同じ計算の道)
  const RULE_LIMITS = Object.freeze({ distStart: [0, 3], gutsStart: [0, GUTS_MAX] });
  const normalizeRules = (r) => {
    if (!r || typeof r !== 'object' || Array.isArray(r)) return null;
    const out = {};
    for (const k of Object.keys(RULE_LIMITS)) {
      if (r[k] === undefined || r[k] === null || r[k] === '') continue;
      const n = Number(r[k]);
      if (Number.isFinite(n)) out[k] = Math.round(clamp(n, RULE_LIMITS[k][0], RULE_LIMITS[k][1]));
    }
    if (r.noSwap === true) out.noSwap = true;
    return Object.keys(out).length ? out : null;
  };
  // 試合の記録から、最初の行動(tech・move・guard・charge・swap)の行を取り出す。side を渡すとその側の1手目
  const firstAction = (log, side) => (Array.isArray(log) ? log : []).find(e => e && ACTION_EVS.includes(e.ev) && (!side || e.side === side)) || null;

  // ── 本体 ──
  // 試合の流れ(ジェネレータ)。ctl[side] が真の側は、手番ごとに手を聞く(yield)。
  //   聞かれる形: { kind:'act', side } → 返す手 { type:'tech', key } / { type:'move', step:-1|1 } / { type:'guard' } / { type:'charge' } / { type:'swap', to }
  //              { kind:'enter', side }(3体で倒れたあとの次の子)→ 返す手 { type:'enter', to }
  //   ctl が両方偽なら一度も止まらない = simulate(オート)。乱数の引き方も記録も、止まれる形にする前と1つも変わらない
  //   (検査 tools/masmon-battle/masmon-manual-check.js が、直す前の計算の指紋の控え auto-golden.json と突き合わせる)。
  //   自分で選んだ手番では AI の見積もりの乱数(ゆらぎ)を引かない。忠誠度の「動かない番」は手を聞く前に決まる(選べない)
  function* battleFlow(inp, catalog, ctl) {
    const rng = makeRng(inp.seed);
    const roundLimit = toInt(inp.roundLimit, 1, 1000, ROUND_LIMIT);
    const state = setupState(inp, catalog);
    const balance = BALANCE[inp.balance] != null ? inp.balance : 'A';
    applyBalance(state, BALANCE[balance]);
    // 上乗せ(渡されたときだけ。乱数は引かない)
    const buffs = { A: null, B: null };
    if (inp.buffs && typeof inp.buffs === 'object') { buffs.A = normalizeBuffs(inp.buffs.A); buffs.B = normalizeBuffs(inp.buffs.B); }
    const usedFirst = { A: false, B: false };
    const rules = normalizeRules(inp.rules);
    if (rules && rules.gutsStart !== undefined) for (const side of ['A', 'B']) for (const x of state.teams[side].units) x.guts = rules.gutsStart;
    for (const side of ['A', 'B']) {
      if (buffs[side] && buffs[side].guts) for (const x of state.teams[side].units) x.guts = Math.min(GUTS_MAX, x.guts + buffs[side].guts);
    }
    state.dist = 1 + Math.floor(rng() * 2);
    if (rules && rules.distStart !== undefined) state.dist = rules.distStart;   // 乱数は上で引いたまま(ほかの流れをずらさない)
    const ctx = { state, rng, trace: !!inp.trace, lastCands: null, buffs, noSwap: !!(rules && rules.noSwap) };
    const log = [];
    const alive = (side) => state.teams[side].units.some(x => x.hp > 0);
    const unitOf = (side) => state.teams[side].units[state.teams[side].active];
    const push = (e) => {
      const row = Object.assign({ r: state.round, d: state.dist }, e);
      if (ACTION_EVS.includes(e.ev)) { row.ga = unitOf('A').guts; row.gb = unitOf('B').guts; }   // 手のあとの両方の場のガッツ
      if (ctx.trace && ctx.lastCands && ACTION_EVS.includes(e.ev)) { row.cands = ctx.lastCands; ctx.lastCands = null; }
      log.push(row);
    };
    const flow = { state, log, ctx, buffs, rules, usedFirst, done: false, result: null };
    yield { kind: 'init', flow };   // 外から状態を見られるように最初に1回だけ渡す(simulate は読み捨てる)

    const movesOf = (side) => state.teams[side].units.map(x => x.moves.map(m => ({ id: m.key, name: m.name, kind: m.kind, guts: m.guts, dist: m.dist })));
    const ver = [...state.teams.A.units, ...state.teams.B.units].some(x => x.loy < 100 || x.pop > 0) ? VERSION : VERSION_PLAIN;
    const ctlRow = ctl.A || ctl.B ? { ctl: Object.assign({}, ctl.A ? { A: 'human' } : {}, ctl.B ? { B: 'human' } : {}) } : {};
    push({ ev: 'start', v: ver, balance,
      plan: { A: state.teams.A.plan, B: state.teams.B.plan }, swapPace: { A: state.teams.A.swapPace, B: state.teams.B.swapPace }, a: state.teams.A.units.map(x => x.name), b: state.teams.B.units.map(x => x.name),
      aMoves: movesOf('A'), bMoves: movesOf('B'),
      aHp: state.teams.A.units.map(x => x.maxHp), bHp: state.teams.B.units.map(x => x.maxHp),
      ...(buffs.A || buffs.B ? { buffs: { A: buffs.A, B: buffs.B } } : {}), ...(rules ? { rules } : {}), ...ctlRow });
    push({ ev: 'enter', side: 'A', i: 0, name: unitOf('A').name });
    push({ ev: 'enter', side: 'B', i: 0, name: unitOf('B').name });

    let winner = null, reason = null;
    function* act(side) {
      const foeSide = side === 'A' ? 'B' : 'A';
      const me = state.teams[side];
      const u = unitOf(side);
      const f = unitOf(foeSide);
      u.guarding = false;
      // 忠誠度が100未満のときだけ乱数を引く(忠誠100・無い編成は乱数の列も今と同じ)
      if (u.loy < 100 && !(buffs[side] && buffs[side].noSulk) && rng() < (100 - u.loy) * LOYAL_NOACT) {
        u.guts = Math.min(GUTS_MAX, u.guts + GUTS_CHARGE);
        push({ ev: 'charge', side, i: me.active, why: 'sulk', guts: u.guts });
        u.swapCooldown = Math.max(0, u.swapCooldown - 1); u.moveStreak = 0; // 「ためる」と同じあと始末
        return;
      }
      let c;
      if (ctl[side]) { const got = yield { kind: 'act', side }; c = Object.assign({}, got, { why: got.aiWhy || 'player' }); }
      else c = chooseAction(ctx, side);
      if (c.type === 'tech') {
        const mv = u.moves.find(m => m.key === c.key);
        const g0 = u.guts;                       // 撃つ前のガッツで当たり・重さを決める
        u.guts -= mv.guts;
        const p = buffedHit(hitChance(u, f, mv, g0, state.dist), buffs[side], buffs[foeSide], !usedFirst[side]);
        usedFirst[side] = true;
        const hit = rng() < p;
        let dmg = 0, crit = false;
        if (hit) {
          const cr = critWithPop(mv.crit, u.pop || 0);
          crit = rng() < (buffs[side] && buffs[side].crit ? Math.min(1, cr + buffs[side].crit) : cr);
          const swing = 0.9 + rng() * 0.2;
          dmg = rawDamage(u, f, mv, state.dist, g0) * swing * (crit ? CRIT_MULT : 1) * (f.guarding ? 1 - guardCut(f) : 1);
          dmg = Math.max(1, Math.round(dmg));
          f.hp = Math.max(0, f.hp - dmg);
        }
        const gd = hit && mv.gd > 0 ? Math.min(mv.gd, f.guts) : 0;   // ガッツダウン
        f.guts -= gd;
        push({ ev: 'tech', side, i: me.active, ti: state.teams[foeSide].active, p: Math.round(p * 1000) / 10, why: c.why, move: mv.key, name: mv.name, kind: mv.kind, hit, crit, dmg,
          guarded: !!(hit && f.guarding), guts: u.guts, foeHp: f.hp, gd, foeGuts: f.guts });
        // 移動先のある技(資料の moveTo): 使ったあと、当たり外れに関係なくその間合いへ移る(移動の行を1つ残す。ガッツは増えない)。
        //   相手が倒れたときは移らない(次のモンスターは今の間合いで出る)
        if (mv.moveTo != null && mv.moveTo !== state.dist && f.hp > 0) {
          const from = state.dist; state.dist = mv.moveTo;
          push({ ev: 'move', side, i: me.active, why: 'techMove', step: mv.moveTo > from ? 1 : -1, to: state.dist, guts: u.guts, byTech: mv.key });
        }
      } else if (c.type === 'move') {
        state.dist = clamp(state.dist + c.step, 0, 3);
        u.guts = Math.min(GUTS_MAX, u.guts + GUTS_MOVE);
        push({ ev: 'move', side, i: me.active, why: c.why, step: c.step, to: state.dist, guts: u.guts });
      } else if (c.type === 'guard') {
        u.guarding = true;
        u.guts = Math.min(GUTS_MAX, u.guts + GUTS_MOVE);
        push({ ev: 'guard', side, i: me.active, why: c.why, name: 'ガード', guts: u.guts });
      } else if (c.type === 'charge') {
        u.guts = Math.min(GUTS_MAX, u.guts + GUTS_CHARGE);
        push({ ev: 'charge', side, i: me.active, why: c.why, guts: u.guts });
      } else if (c.type === 'swap') {
        const from = me.active;
        u.guarding = false;
        me.active = c.to;
        const n = unitOf(side);
        n.guts = Math.max(n.guts, GUTS_SWAP_IN);
        n.swapCooldown = SWAP_COOLDOWN;
        push({ ev: 'swap', side, from, why: c.why, i: c.to, name: n.name, guts: n.guts });
      }
      u.swapCooldown = Math.max(0, u.swapCooldown - 1);
      u.moveStreak = c.type === 'move' ? u.moveStreak + 1 : 0;
      // 倒れた → 次を出す / 全滅なら決着
      if (f.hp <= 0) {
        push({ ev: 'ko', side: foeSide, i: state.teams[foeSide].active, name: f.name });
        if (!alive(foeSide)) { winner = side; reason = 'wipe'; return; }
        const next = ctl[foeSide] ? (yield { kind: 'enter', side: foeSide }).to : chooseReplacement(ctx, foeSide);
        state.teams[foeSide].active = next;
        const n = unitOf(foeSide);
        n.guts = Math.max(n.guts, GUTS_SWAP_IN);
        n.guarding = false;
        n.swapCooldown = SWAP_COOLDOWN;
        push({ ev: 'enter', side: foeSide, i: next, name: n.name, guts: n.guts });
      }
    }

    while (!winner && state.round < roundLimit) {
      state.round++;
      for (const side of ['A', 'B']) {
        const u = unitOf(side);
        u.guts = Math.min(GUTS_MAX, u.guts + u.regen);
      }
      // 先に動く方: 回避+命中の半分が高い方(同じなら種で)
      const ua = unitOf('A'), ub = unitOf('B');
      const sa = ua.stats.eva + ua.stats.hit * 0.5 + rng() * 60 + (ua.first || 0);   // 移動速度の足し分
      const sb = ub.stats.eva + ub.stats.hit * 0.5 + rng() * 60 + (ub.first || 0);
      const order = sa >= sb ? ['A', 'B'] : ['B', 'A'];
      for (const side of order) {
        if (winner) break;
        yield* act(side);
      }
    }
    if (!winner) {
      // 判定: 残りライフの割合の合計(倒れた体は0)。同じなら引き分け
      const score = (side) => {
        const t = state.teams[side];
        return Math.round(t.units.reduce((s, x) => s + x.hp / x.maxHp, 0) / t.units.length * 10000);
      };
      const a = score('A'), b = score('B');
      winner = a > b ? 'A' : b > a ? 'B' : 'draw';
      reason = 'judge';
      push({ ev: 'judge', aScore: a, bScore: b });
    }
    push({ ev: 'end', winner, reason });
    const final = {};
    for (const side of ['A', 'B']) final[side] = state.teams[side].units.map(x => ({ name: x.name, hp: x.hp, maxHp: x.maxHp, guts: x.guts }));
    flow.done = true;
    flow.result = { version: ver, balance, winner, reason, rounds: state.round, log, final, digest: digestOf(log) };
    return flow.result;
  }

  const catalogOf = (inp) => {
    const catalog = inp.catalog;
    if (!catalog || !catalog.species || !Object.keys(catalog.species).length) throw new Error('assistant-masmon-battle: catalog が無い');
    return catalog;
  };

  // オート(両側 AI)で最後まで。サーバ(masmon-pvp)もこれを呼ぶ。control は受け付けない
  // 画面の技の札に出す命中率の見込み(2026-11-13 社長「命中表記は技のコマンドのところにも出してほしい」)。計算は変えない・読むだけ
  //   hitPreviewer(catalog, teamA, teamB) → (side, actA, actB, guts, dist) => { 技のid: 命中%(整数) }
  const hitPreviewer = (catalog, teamA, teamB) => {
    let st = null;
    try { st = setupState({ teamA, teamB }, catalog); } catch (_) { return () => ({}); }
    return (side, actA, actB, guts, dist) => {
      const foe = side === 'A' ? 'B' : 'A';
      const au = st.teams[side].units[side === 'A' ? actA : actB]; const du = st.teams[foe].units[foe === 'A' ? actA : actB];
      const out = {};
      if (!au || !du) return out;
      for (const mv of au.moves) out[mv.key] = Math.round(hitChance(au, du, mv, Number.isFinite(guts) ? guts : au.guts, dist) * 100);
      return out;
    };
  };

  // 試合前の比べっこ(画面が読むだけ・計算は変えない): 1体の種類の等級と、子ごとに上げた分を足した間合い適性
  //   unitTraits(catalog, { species, aptUp }) → { regen, regenGrade, move, size, apt:['C',…] } / 種が無ければ null
  const unitTraits = (catalog, unit) => {
    const u = unit && typeof unit === 'object' ? unit : {};
    const sp = catalog && catalog.species && catalog.species[u.species];
    if (!sp) return null;
    const tr = SPECIES_TRAITS[u.species] || {};
    return { regen: sp.regen, regenGrade: typeof tr.g === 'string' ? tr.g : '', move: typeof tr.m === 'string' ? tr.m : 'D', size: sp.size || 'M',
      apt: applyAptUp(sp.apt, normAptUp(u.aptUp)) };
  };

  const simulate = (input) => {
    const inp = input && typeof input === 'object' ? input : {};
    const g = battleFlow(inp, catalogOf(inp), { A: false, B: false });
    g.next();                                  // init
    const last = g.next();
    if (!last.done) throw new Error('assistant-masmon-battle: オートの試合が手を聞いた');
    return last.value;
  };

  // ── 自分で操作する試合(モンヒロサクセス・2026-11-12 社長「モンサクは自分操作にして」) ──
  //   const m = createMatch({ simulate と同じ入力, control:{ A:'human' } });
  //   m.pending() → いまの手番の選べる手(無ければ null=決着)。m.choose(手) → { ok, reason? } で次の手番まで進む
  //   m.log(伸びていく記録)・m.view()(場の様子)・m.choices()(選んだ手の列)・m.result()(決着したら simulate と同じ形)
  //   m.auto(side) … その側をここからオートにする(列に { type:'auto' } が残る)
  //   見返し・中断の続き: replay(同じ入力, 手の列) で全く同じ所まで進む
  const PLAYER_ACTS = ['tech', 'move', 'guard', 'charge', 'swap'];
  const createMatch = (input) => {
    const inp = input && typeof input === 'object' ? input : {};
    const catalog = catalogOf(inp);
    const c0 = inp.control && typeof inp.control === 'object' ? inp.control : {};
    const ctl = { A: c0.A === 'human', B: c0.B === 'human' };
    const g = battleFlow(inp, catalog, ctl);
    const flow = g.next().value.flow;
    const st = flow.state;
    const picks = [];
    let req = null;
    const advance = (val) => {
      const r = g.next(val);
      req = r.done ? null : r.value;
    };
    advance(undefined);
    const foeOf = (side) => (side === 'A' ? 'B' : 'A');
    const unitOf = (side) => st.teams[side].units[st.teams[side].active];
    // AI ならこの手番に何を選ぶか(おすすめの印。試合の乱数は引かない)
    const hintOf = (side) => {
      try {
        const c = chooseAction({ state: st, rng: makeRng(`hint:${st.round}:${flow.log.length}`), trace: false, lastCands: null, noSwap: flow.ctx.noSwap }, side);
        return c ? { type: c.type, key: c.key, step: c.step, to: c.to } : null;
      } catch (_) { return null; }
    };
    const optionsOf = (rq) => {
      const side = rq.side;
      const me = st.teams[side];
      if (rq.kind === 'enter') {
        return { kind: 'enter', side, enter: me.units.map((x, i) => ({ type: 'enter', to: i, name: x.name, hp: x.hp, maxHp: x.maxHp, ok: x.hp > 0 })) };
      }
      const u = unitOf(side), f = unitOf(foeOf(side));
      const d = st.dist;
      const first = !flow.usedFirst[side];
      const tech = u.moves.map(mv => {
        const reach = inRange(mv, d);
        const p = buffedHit(hitChance(u, f, mv, undefined, d), flow.buffs[side], flow.buffs[foeOf(side)], first);
        return { type: 'tech', key: mv.key, name: mv.name, kind: mv.kind, guts: mv.guts, dist: mv.dist.slice(), reach,
          ok: reach && u.guts >= mv.guts, need: Math.max(0, mv.guts - u.guts), p: Math.round(p * 1000) / 10, gd: mv.gd, crit: mv.crit };
      });
      const move = [-1, 1].map(step => ({ type: 'move', step, to: d + step, ok: d + step >= 0 && d + step <= 3 }));
      const swap = me.units.map((x, i) => ({ type: 'swap', to: i, name: x.name, hp: x.hp, maxHp: x.maxHp,
        ok: i !== me.active && x.hp > 0 && u.swapCooldown <= 0 && !flow.ctx.noSwap })).filter(x => x.to !== me.active);
      return { kind: 'act', side, round: st.round, dist: d, guts: u.guts, hp: u.hp, maxHp: u.maxHp,
        tech, guard: { type: 'guard', ok: true }, move, charge: { type: 'charge', ok: u.guts < GUTS_MAX }, swap,
        swapWait: Math.max(0, u.swapCooldown), hint: hintOf(side) };
    };
    // 渡された手が、いまの手番で選べるか(選べない手は進めない)
    const valid = (rq, c) => {
      const o = optionsOf(rq);
      if (rq.kind === 'enter') return c.type === 'enter' && o.enter.some(x => x.ok && x.to === c.to);
      if (!PLAYER_ACTS.includes(c.type)) return false;
      if (c.type === 'tech') return o.tech.some(x => x.ok && x.key === c.key);
      if (c.type === 'move') return o.move.some(x => x.ok && x.step === c.step);
      if (c.type === 'guard') return true;
      if (c.type === 'charge') return o.charge.ok;
      return o.swap.some(x => x.ok && x.to === c.to);
    };
    const clean = (c) => {
      const o = { type: c.type };
      if (c.type === 'tech') o.key = String(c.key);
      if (c.type === 'move') o.step = c.step;
      if (c.type === 'swap' || c.type === 'enter') o.to = c.to;
      return o;
    };
    // ある側をオートに切り替えたら、その側の手番は AI が選ぶ(いま止まっている手番も)
    const aiPick = (rq) => {
      if (rq.kind === 'enter') return { type: 'enter', to: chooseReplacement(flow.ctx, rq.side) };
      const c = chooseAction(flow.ctx, rq.side);
      return { type: c.type, key: c.key, step: c.step, to: c.to, aiWhy: c.why };
    };
    const runAuto = () => {
      while (req && !ctl[req.side]) {
        const c = aiPick(req);
        advance(c);
      }
    };
    const m = {
      get log() { return flow.log; },
      pending: () => (req && ctl[req.side] ? optionsOf(req) : null),
      choose: (choice) => {
        if (!req) return { ok: false, reason: 'end' };
        const c = choice && typeof choice === 'object' ? choice : {};
        if (c.type === 'auto') return m.auto(req.side);
        if (!valid(req, c)) return { ok: false, reason: 'invalid' };
        const cc = clean(c);
        picks.push(cc);
        advance(cc);
        runAuto();
        return { ok: true };
      },
      auto: (side) => {
        const s = side === 'B' ? 'B' : 'A';
        if (!ctl[s]) return { ok: true };
        ctl[s] = false;
        picks.push({ type: 'auto', side: s });
        runAuto();
        return { ok: true };
      },
      choices: () => picks.map(x => Object.assign({}, x)),
      done: () => flow.done,
      result: () => flow.result,
      view: () => ({ round: st.round, dist: st.dist,
        teams: { A: viewTeam(st.teams.A), B: viewTeam(st.teams.B) } }),
    };
    return m;
  };
  const viewTeam = (t) => ({ active: t.active, units: t.units.map(x => ({ name: x.name, species: x.species, hp: x.hp, maxHp: x.maxHp, guts: x.guts, guarding: x.guarding, swapCooldown: x.swapCooldown })) });
  // 同じ入力と手の列から、同じ所まで進めた試合を返す(列のどこかで選べない手があれば ok:false とその位置)
  const replay = (input, choices) => {
    const m = createMatch(input);
    const list = Array.isArray(choices) ? choices : [];
    for (let i = 0; i < list.length; i++) {
      const c = list[i];
      const r = c && c.type === 'auto' ? m.auto(c.side) : m.choose(c);
      if (!r.ok) return { ok: false, at: i, match: m };
    }
    return { ok: true, match: m };
  };

  // 結果の指紋(同じ種・同じ編成なら同じ値。端末とサーバの突き合わせ用)
  // AI の点の一覧(cands。trace:true のときだけ付く)は除く=trace のあり・なしで同じ指紋(trace なしの値はこれまでと同じ)
  const digestOf = (log) => hashSeed(JSON.stringify(log.map(e => {
    if (!e.cands) return e;
    const c = Object.assign({}, e);
    delete c.cands;
    return c;
  }))).toString(16).padStart(8, '0');

  const api = Object.freeze({
    VERSION, VERSION_PLAIN, STAT_KEYS, STAT_MAX, DIST_NAMES, TEAM_MAX, GUTS_MAX, GUTS_REGEN_MIN, GUTS_REGEN_MAX, GUTS_REGEN_GRADES, GUTS_REGEN_GRADES_UP, SPECIES_TRAITS, MOVE_SPEED_FIRST, MOVE_SPEED_TAKEN, APT_UP_LIMITS, SIZE_SMALL_EVADE, APT_DMG, APT_DEF, APT_HIT, APT_EVA, APT_ABOVE_A, SIZE_LARGE_CUT, GUTS_CHARGE, GUTS_MOVE, REGEN_DMG_SWING, ROUND_LIMIT, STYLES, TECH_LIMITS,
    MASTERY_HIT_MAX, MASTERY_GUTS_CUT, MASTERY_GUARD_ADD, BALANCE, PLANS, SWAP_PACES, STYLE_RANGE,
    LV_MAX, BUFF_LIMITS, RULE_LIMITS, unitTraits, buildCatalog, simulate, hitPreviewer, createMatch, replay, firstAction, unitFromGrow, makeRng, hashSeed,
    WHY: Object.freeze({ sulk: 'そっぽを向いて、言うことを聞かない…', finish: '倒しきれる', gutsDown: 'ガッツを削る', big: '大技', attack: '攻める', reach: '技が届く所へ', better: '有利な間合いへ',
      safer: '危ない間合いから離れる', lowHp: 'ライフが少ないので守る', block: '相手の大きい一撃にそなえる', noGuts: 'ガッツが足りない', saveUp: '大技のためにためる',
      rescue: '倒されそうなので下げる', matchup: '相性のよい仲間へ', player: 'あなたの指示', techMove: '技の勢いで間合いが変わった' }),
    // 検査用(計算の部品)
    _internal: Object.freeze({ setupState, aptMult, aptSteps, normAptUp, applyAptUp, normTech, buildMoves, normalizeUnit, normalizeTeam, normalizeBuffs, buffedHit, styleOf, hitChance, rawDamage, chooseAction, maxHpOf }),
  });
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.ASSISTANT_MASMON_BATTLE = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);

})(__mod);
export const ASSISTANT_MASMON_BATTLE = __mod.exports;
export const MASMON_PVP_CATALOG = {"version":7,"techVersion":2,"species":{"Ark":{"name":"アーク","apt":["E","B","C","B"],"techs":[{"id":"sk-0125","name":"神剣よ断罪を下せ","kind":"wise","dist":[2],"power":13,"hit":-3,"guts":16,"crit":8,"gd":4,"start":true},{"id":"sk-0111","name":"我が瞳の真理を見よ","kind":"wise","dist":[0],"power":6,"hit":1,"guts":17,"crit":8,"gd":9,"start":true},{"id":"sk-0110","name":"世界を揺らせ","kind":"pow","dist":[3],"power":21,"hit":-15,"guts":18,"crit":8,"gd":0,"start":false},{"id":"sk-0113","name":"翔べ震律の刃よ","kind":"wise","dist":[1],"power":8,"hit":-9,"guts":21,"crit":10,"gd":4,"start":false},{"id":"sk-0114","name":"白き誓い切なる願い","kind":"wise","dist":[0],"power":16,"hit":-9,"guts":22,"crit":15,"gd":12,"start":false},{"id":"sk-0112","name":"神光よ汚れを祓え","kind":"wise","dist":[2],"power":30,"hit":-15,"guts":26,"crit":8,"gd":9,"start":false},{"id":"sk-0115","name":"今こそ真なる目醒め","kind":"wise","dist":[3],"power":30,"hit":-9,"guts":30,"crit":10,"gd":9,"start":false},{"id":"sk-0118","name":"蒼き荊よ咎を穿て","kind":"wise","dist":[0],"power":24,"hit":1,"guts":31,"crit":10,"gd":21,"start":false},{"id":"sk-0117","name":"導け神光の道標","kind":"wise","dist":[1],"power":38,"hit":-15,"guts":33,"crit":12,"gd":9,"start":false},{"id":"sk-0116","name":"裁きの光よ下れ","kind":"wise","dist":[2],"power":38,"hit":-9,"guts":36,"crit":18,"gd":12,"start":false},{"id":"sk-0120","name":"熾天の剣よ降り立て","kind":"wise","dist":[1],"power":30,"hit":1,"guts":42,"crit":12,"gd":12,"start":false},{"id":"sk-0119","name":"祈れ輪廻の環よ","kind":"wise","dist":[2],"power":38,"hit":1,"guts":45,"crit":11,"gd":21,"start":false},{"id":"sk-0122","name":"聖光よ奇跡を灯せ","kind":"wise","dist":[2],"power":33,"hit":17,"guts":42,"crit":12,"gd":9,"start":false},{"id":"sk-0124","name":"灰よ還りて聖火となれ","kind":"wise","dist":[0],"power":38,"hit":1,"guts":44,"crit":27,"gd":18,"start":false},{"id":"sk-0123","name":"天の慈悲よ示されよ","kind":"wise","dist":[1],"power":49,"hit":7,"guts":48,"crit":15,"gd":12,"start":false},{"id":"sk-0121","name":"終焉に救いを与えよ","kind":"wise","dist":[3],"power":49,"hit":1,"guts":50,"crit":25,"gd":21,"start":false},{"id":"sk-0129","name":"黎明よ終焉を照らせ","kind":"wise","dist":[3],"power":49,"hit":1,"guts":50,"crit":25,"gd":21,"start":false}],"regen":15,"dmgMul":0.8,"first":18,"taken":1.09,"size":"M"},"Dreamy":{"name":"ドリーミィ","apt":["B","D","D","A"],"techs":[{"id":"sk-0040","name":"プラズマ","kind":"pow","dist":[0],"power":7,"hit":14,"guts":12,"crit":10,"gd":0,"start":true},{"id":"sk-0039","name":"ヴェノムエッジ","kind":"pow","dist":[2],"power":16,"hit":-9,"guts":16,"crit":12,"gd":0,"start":true},{"id":"sk-0053","name":"グレネード","kind":"pow","dist":[3],"power":24,"hit":-22,"guts":22,"crit":12,"gd":5,"start":false},{"id":"sk-0055","name":"おもちゃの爆弾","kind":"pow","dist":[3],"power":24,"hit":-19,"guts":22,"crit":12,"gd":5,"start":false},{"id":"sk-0064","name":"シールドバッシュ","kind":"pow","dist":[1],"power":16,"hit":-19,"guts":19,"crit":12,"gd":0,"start":false},{"id":"sk-0041","name":"エーテルアイス","kind":"wise","dist":[3],"power":8,"hit":1,"guts":24,"crit":6,"gd":15,"start":false},{"id":"sk-0042","name":"モーニングスター","kind":"pow","dist":[2],"power":30,"hit":-19,"guts":26,"crit":10,"gd":0,"start":false},{"id":"sk-0045","name":"ストレート","kind":"pow","dist":[1],"power":24,"hit":4,"guts":23,"crit":6,"gd":7,"start":false},{"id":"sk-0046","name":"アサシンクロウ","kind":"pow","dist":[0],"power":24,"hit":1,"guts":27,"crit":18,"gd":12,"start":false},{"id":"sk-0044","name":"アルカナフレア","kind":"wise","dist":[2],"power":24,"hit":-19,"guts":28,"crit":10,"gd":24,"start":false},{"id":"sk-0043","name":"アサルトアロー","kind":"pow","dist":[3],"power":30,"hit":-3,"guts":32,"crit":18,"gd":0,"start":false},{"id":"sk-0047","name":"アルスマグナ","kind":"pow","dist":[3],"power":30,"hit":7,"guts":33,"crit":10,"gd":0,"start":false},{"id":"sk-0048","name":"ノクターン","kind":"pow","dist":[2],"power":24,"hit":12,"guts":35,"crit":18,"gd":24,"start":false},{"id":"sk-0049","name":"ブレードダンス","kind":"pow","dist":[0],"power":24,"hit":7,"guts":36,"crit":15,"gd":24,"start":false},{"id":"sk-0054","name":"バスターソード","kind":"pow","dist":[1],"power":16,"hit":1,"guts":39,"crit":25,"gd":7,"start":false},{"id":"sk-0050","name":"クリムゾンノヴァ","kind":"pow","dist":[3],"power":27,"hit":1,"guts":41,"crit":12,"gd":7,"start":false},{"id":"sk-0052","name":"ミラージュクロウ","kind":"pow","dist":[0],"power":33,"hit":12,"guts":43,"crit":18,"gd":24,"start":false},{"id":"sk-0051","name":"レクイエムエンド","kind":"pow","dist":[2],"power":49,"hit":-3,"guts":44,"crit":21,"gd":12,"start":false}],"regen":15,"dmgMul":0.8,"first":18,"taken":1.09,"size":"M"},"Eiki":{"name":"エイキ","apt":["A","A","C","C"],"techs":[{"id":"eiki_o01","name":"桜牙","kind":"pow","dist":[0],"power":8,"hit":5,"guts":11,"crit":16,"gd":3,"start":true},{"id":"eiki_o02","name":"花裂き","kind":"pow","dist":[2],"power":8,"hit":5,"guts":14,"crit":10,"gd":3,"start":true},{"id":"eiki_o03","name":"桜風刃","kind":"wise","dist":[2],"power":11,"hit":5,"guts":16,"crit":16,"gd":3,"start":false},{"id":"eiki_o04","name":"花霞斬","kind":"pow","dist":[2],"power":11,"hit":-1,"guts":19,"crit":16,"gd":3,"start":false},{"id":"eiki_o05","name":"桜月輪","kind":"pow","dist":[1],"power":16,"hit":-1,"guts":22,"crit":10,"gd":3,"start":false},{"id":"eiki_o06","name":"桜嵐刃","kind":"wise","dist":[3],"power":16,"hit":-1,"guts":25,"crit":16,"gd":8,"start":false},{"id":"eiki_o07","name":"千花連刃","kind":"pow","dist":[1],"power":25,"hit":-1,"guts":27,"crit":16,"gd":8,"start":false},{"id":"eiki_o08","name":"桜閃爪","kind":"pow","dist":[1],"power":25,"hit":-1,"guts":30,"crit":16,"gd":8,"start":false},{"id":"eiki_o09","name":"桜華絶閃爪","kind":"pow","dist":[0],"power":31,"hit":-1,"guts":32,"crit":16,"gd":8,"start":false},{"id":"eiki_o10","name":"華影緋閃","kind":"pow","dist":[2],"power":16,"hit":-1,"guts":24,"crit":16,"gd":8,"start":false},{"id":"eiki_o11","name":"氷花一閃","kind":"pow","dist":[1],"power":25,"hit":-1,"guts":27,"crit":16,"gd":8,"start":false},{"id":"eiki_o12","name":"桜月斬華","kind":"pow","dist":[2],"power":25,"hit":-1,"guts":30,"crit":16,"gd":8,"start":false},{"id":"eiki_o13","name":"緋雪乱刃","kind":"pow","dist":[1],"power":31,"hit":-1,"guts":31,"crit":16,"gd":8,"start":false},{"id":"eiki_o14","name":"花氷双牙","kind":"pow","dist":[1],"power":31,"hit":-11,"guts":34,"crit":23,"gd":8,"start":false},{"id":"eiki_o15","name":"千華氷嵐","kind":"wise","dist":[2],"power":39,"hit":-11,"guts":37,"crit":16,"gd":8,"start":false},{"id":"eiki_o16","name":"緋桜六華閃","kind":"pow","dist":[2],"power":39,"hit":-11,"guts":40,"crit":23,"gd":8,"start":false},{"id":"eiki_o17","name":"絶影桜華乱舞","kind":"pow","dist":[1],"power":50,"hit":-11,"guts":42,"crit":16,"gd":8,"start":false},{"id":"eiki_o18","name":"絶華緋閃・零桜","kind":"pow","dist":[2],"power":50,"hit":-11,"guts":45,"crit":23,"gd":8,"start":false}],"regen":15,"dmgMul":0.8,"first":18,"taken":1.09,"size":"M"},"Ghost":{"name":"ゴースト","apt":["C","C","A","C"],"techs":[{"id":"sk-0065","name":"ソウルビーム","kind":"wise","dist":[1],"power":12,"hit":3,"guts":14,"crit":6,"gd":5,"start":true},{"id":"sk-0066","name":"ピコピコハンマー","kind":"pow","dist":[0],"power":14,"hit":-25,"guts":14,"crit":6,"gd":0,"start":true},{"id":"sk-0077","name":"ハトのおとしもの","kind":"wise","dist":[2],"power":21,"hit":-25,"guts":24,"crit":10,"gd":7,"start":false},{"id":"sk-0068","name":"びっくり","kind":"wise","dist":[1],"power":10,"hit":-3,"guts":17,"crit":6,"gd":13,"start":false},{"id":"sk-0069","name":"体当たり","kind":"pow","dist":[0],"power":24,"hit":0,"guts":21,"crit":8,"gd":7,"start":false},{"id":"sk-0078","name":"カード","kind":"wise","dist":[3],"power":21,"hit":-3,"guts":21,"crit":10,"gd":7,"start":false},{"id":"sk-0067","name":"すてきステッキ","kind":"wise","dist":[2],"power":8,"hit":-23,"guts":22,"crit":16,"gd":0,"start":false},{"id":"sk-0070","name":"連続カード","kind":"wise","dist":[3],"power":19,"hit":-3,"guts":26,"crit":23,"gd":12,"start":false},{"id":"sk-0071","name":"ドクロビーム","kind":"wise","dist":[2],"power":21,"hit":3,"guts":32,"crit":16,"gd":7,"start":false},{"id":"sk-0072","name":"大パンチ","kind":"pow","dist":[0],"power":38,"hit":-3,"guts":32,"crit":16,"gd":12,"start":false},{"id":"sk-0073","name":"大きなおとしもの","kind":"wise","dist":[2],"power":44,"hit":-3,"guts":34,"crit":16,"gd":24,"start":false},{"id":"sk-0080","name":"びっくりドクロ","kind":"wise","dist":[1],"power":34,"hit":3,"guts":34,"crit":23,"gd":24,"start":false},{"id":"sk-0079","name":"スリーセブン","kind":"wise","dist":[3],"power":27,"hit":-13,"guts":41,"crit":26,"gd":5,"start":false},{"id":"sk-0074","name":"コンビネーション","kind":"pow","dist":[0],"power":24,"hit":10,"guts":46,"crit":16,"gd":12,"start":false},{"id":"sk-0075","name":"Woフォーチュン","kind":"wise","dist":[3],"power":45,"hit":13,"guts":33,"crit":10,"gd":21,"start":false},{"id":"sk-0084","name":"RSF","kind":"wise","dist":[1],"power":27,"hit":10,"guts":39,"crit":23,"gd":15,"start":false},{"id":"sk-0076","name":"運命のコイン","kind":"wise","dist":[2],"power":44,"hit":8,"guts":43,"crit":23,"gd":7,"start":false}],"regen":15,"dmgMul":0.8,"first":18,"taken":1.09,"size":"S"},"Golem":{"name":"ゴーレム","apt":["A","E","G","G"],"techs":[{"id":"sk-0293","name":"でこぴん","kind":"pow","dist":[1],"power":21,"hit":-13,"guts":19,"crit":12,"gd":0,"start":true},{"id":"sk-0294","name":"キック","kind":"pow","dist":[0],"power":24,"hit":-9,"guts":19,"crit":6,"gd":0,"start":true},{"id":"sk-0292","name":"のびーるパンチ","kind":"pow","dist":[2],"power":16,"hit":-13,"guts":23,"crit":6,"gd":15,"start":false},{"id":"sk-0298","name":"ビンタ","kind":"pow","dist":[0],"power":16,"hit":7,"guts":21,"crit":8,"gd":0,"start":false},{"id":"sk-0295","name":"地震","kind":"wise","dist":[3],"power":24,"hit":-13,"guts":30,"crit":8,"gd":12,"start":false},{"id":"sk-0296","name":"大ビンタ","kind":"pow","dist":[2],"power":24,"hit":13,"guts":30,"crit":6,"gd":0,"start":false},{"id":"sk-0297","name":"アッパー","kind":"pow","dist":[1],"power":30,"hit":-13,"guts":30,"crit":11,"gd":0,"start":false},{"id":"sk-0302","name":"ハエたたき","kind":"pow","dist":[0],"power":30,"hit":-3,"guts":22,"crit":8,"gd":12,"start":false},{"id":"sk-0301","name":"合掌","kind":"pow","dist":[1],"power":33,"hit":-9,"guts":26,"crit":18,"gd":0,"start":false},{"id":"sk-0300","name":"フライングプレス","kind":"pow","dist":[2],"power":49,"hit":-18,"guts":35,"crit":18,"gd":15,"start":false},{"id":"sk-0299","name":"大でこぴん","kind":"pow","dist":[3],"power":38,"hit":-16,"guts":36,"crit":25,"gd":5,"start":false},{"id":"sk-0303","name":"竜巻アタック","kind":"pow","dist":[3],"power":49,"hit":-15,"guts":45,"crit":18,"gd":12,"start":false},{"id":"sk-0305","name":"大ハエタタキ","kind":"pow","dist":[1],"power":49,"hit":-3,"guts":48,"crit":6,"gd":27,"start":false},{"id":"sk-0306","name":"大キック","kind":"pow","dist":[0],"power":51,"hit":7,"guts":50,"crit":18,"gd":0,"start":false},{"id":"sk-0304","name":"ぐるぐるアタック","kind":"pow","dist":[2],"power":51,"hit":-9,"guts":53,"crit":15,"gd":24,"start":false},{"id":"sk-0307","name":"掌打","kind":"pow","dist":[1],"power":51,"hit":-13,"guts":56,"crit":18,"gd":12,"start":false}],"regen":7,"dmgMul":1.133,"first":-12,"taken":0.94,"size":"L"},"Ham":{"name":"ハム","apt":["B","B","D","D"],"techs":[{"id":"sk-0339","name":"ワン・ツー","kind":"pow","dist":[2],"power":8,"hit":-6,"guts":13,"crit":6,"gd":2,"start":true},{"id":"sk-0340","name":"正拳","kind":"pow","dist":[0],"power":11,"hit":-6,"guts":19,"crit":10,"gd":2,"start":true},{"id":"sk-0338","name":"飛び蹴り","kind":"pow","dist":[3],"power":11,"hit":-16,"guts":21,"crit":12,"gd":2,"start":false},{"id":"sk-0343","name":"おなら","kind":"wise","dist":[2],"power":6,"hit":4,"guts":12,"crit":6,"gd":9,"start":false},{"id":"sk-0341","name":"バックナックル","kind":"pow","dist":[1],"power":24,"hit":-21,"guts":19,"crit":10,"gd":2,"start":false},{"id":"sk-0342","name":"後ろ蹴り","kind":"pow","dist":[0],"power":16,"hit":10,"guts":28,"crit":10,"gd":2,"start":false},{"id":"sk-0346","name":"ドラゴンパンチ","kind":"pow","dist":[0],"power":16,"hit":-16,"guts":17,"crit":18,"gd":2,"start":false},{"id":"sk-0347","name":"大砲屁","kind":"wise","dist":[2],"power":8,"hit":4,"guts":23,"crit":10,"gd":26,"start":false},{"id":"sk-0344","name":"超飛び蹴り","kind":"pow","dist":[3],"power":30,"hit":-12,"guts":26,"crit":18,"gd":2,"start":false},{"id":"sk-0345","name":"回し蹴り","kind":"pow","dist":[1],"power":30,"hit":4,"guts":38,"crit":12,"gd":7,"start":false},{"id":"sk-0350","name":"超バックナックル","kind":"pow","dist":[1],"power":38,"hit":-22,"guts":24,"crit":10,"gd":2,"start":false},{"id":"sk-0348","name":"瞬撃","kind":"pow","dist":[3],"power":38,"hit":4,"guts":40,"crit":8,"gd":9,"start":false},{"id":"sk-0349","name":"ドラゴンキック","kind":"pow","dist":[2],"power":38,"hit":-16,"guts":41,"crit":25,"gd":9,"start":false},{"id":"sk-0351","name":"暗けい","kind":"pow","dist":[0],"power":30,"hit":10,"guts":42,"crit":10,"gd":14,"start":false}],"regen":8,"dmgMul":1.067,"first":0,"taken":1,"size":"S"},"Iblis":{"name":"イブリース","apt":["D","B","E","B"],"techs":[{"id":"sk-0125","name":"神剣よ断罪を下せ","kind":"wise","dist":[2],"power":13,"hit":-3,"guts":16,"crit":8,"gd":4,"start":true},{"id":"sk-0111","name":"我が瞳の真理を見よ","kind":"wise","dist":[0],"power":6,"hit":1,"guts":17,"crit":8,"gd":9,"start":true},{"id":"sk-0110","name":"世界を揺らせ","kind":"pow","dist":[3],"power":21,"hit":-15,"guts":18,"crit":8,"gd":0,"start":false},{"id":"sk-0113","name":"翔べ震律の刃よ","kind":"wise","dist":[1],"power":8,"hit":-9,"guts":21,"crit":10,"gd":4,"start":false},{"id":"sk-0114","name":"白き誓い切なる願い","kind":"wise","dist":[0],"power":16,"hit":-9,"guts":22,"crit":15,"gd":12,"start":false},{"id":"sk-0112","name":"神光よ汚れを祓え","kind":"wise","dist":[2],"power":30,"hit":-15,"guts":26,"crit":8,"gd":9,"start":false},{"id":"sk-0115","name":"今こそ真なる目醒め","kind":"wise","dist":[3],"power":30,"hit":-9,"guts":30,"crit":10,"gd":9,"start":false},{"id":"sk-0118","name":"蒼き荊よ咎を穿て","kind":"wise","dist":[0],"power":24,"hit":1,"guts":31,"crit":10,"gd":21,"start":false},{"id":"sk-0117","name":"導け神光の道標","kind":"wise","dist":[1],"power":38,"hit":-15,"guts":33,"crit":12,"gd":9,"start":false},{"id":"sk-0116","name":"裁きの光よ下れ","kind":"wise","dist":[2],"power":38,"hit":-9,"guts":36,"crit":18,"gd":12,"start":false},{"id":"sk-0120","name":"熾天の剣よ降り立て","kind":"wise","dist":[1],"power":30,"hit":1,"guts":42,"crit":12,"gd":12,"start":false},{"id":"sk-0119","name":"祈れ輪廻の環よ","kind":"wise","dist":[2],"power":38,"hit":1,"guts":45,"crit":11,"gd":21,"start":false},{"id":"sk-0122","name":"聖光よ奇跡を灯せ","kind":"wise","dist":[2],"power":33,"hit":17,"guts":42,"crit":12,"gd":9,"start":false},{"id":"sk-0124","name":"灰よ還りて聖火となれ","kind":"wise","dist":[0],"power":38,"hit":1,"guts":44,"crit":27,"gd":18,"start":false},{"id":"sk-0123","name":"天の慈悲よ示されよ","kind":"wise","dist":[1],"power":49,"hit":7,"guts":48,"crit":15,"gd":12,"start":false},{"id":"sk-0121","name":"終焉に救いを与えよ","kind":"wise","dist":[3],"power":49,"hit":1,"guts":50,"crit":25,"gd":21,"start":false},{"id":"sk-0129","name":"黎明よ終焉を照らせ","kind":"wise","dist":[3],"power":49,"hit":1,"guts":50,"crit":25,"gd":21,"start":false}],"regen":15,"dmgMul":0.8,"first":6,"taken":1.03,"size":"M"},"Illumine":{"name":"イルミネ","apt":["B","C","A","E"],"techs":[{"id":"sk-0040","name":"プラズマ","kind":"pow","dist":[0],"power":7,"hit":12,"guts":12,"crit":10,"gd":0,"start":true},{"id":"sk-0039","name":"ヴェノムエッジ","kind":"pow","dist":[2],"power":16,"hit":-11,"guts":16,"crit":12,"gd":0,"start":true},{"id":"sk-0053","name":"グレネード","kind":"pow","dist":[3],"power":24,"hit":-24,"guts":22,"crit":12,"gd":5,"start":false},{"id":"sk-0064","name":"シールドバッシュ","kind":"pow","dist":[1],"power":16,"hit":-21,"guts":19,"crit":12,"gd":0,"start":false},{"id":"sk-0041","name":"エーテルアイス","kind":"wise","dist":[3],"power":8,"hit":-1,"guts":24,"crit":6,"gd":15,"start":false},{"id":"sk-0042","name":"モーニングスター","kind":"pow","dist":[2],"power":30,"hit":-21,"guts":26,"crit":10,"gd":0,"start":false},{"id":"sk-0045","name":"ストレート","kind":"pow","dist":[1],"power":24,"hit":2,"guts":23,"crit":6,"gd":7,"start":false},{"id":"sk-0046","name":"アサシンクロウ","kind":"pow","dist":[0],"power":24,"hit":-1,"guts":27,"crit":18,"gd":12,"start":false},{"id":"sk-0044","name":"アルカナフレア","kind":"wise","dist":[2],"power":24,"hit":-21,"guts":27,"crit":10,"gd":24,"start":false},{"id":"sk-0043","name":"アサルトアロー","kind":"pow","dist":[3],"power":30,"hit":-5,"guts":31,"crit":18,"gd":0,"start":false},{"id":"sk-0047","name":"アルスマグナ","kind":"pow","dist":[3],"power":30,"hit":5,"guts":33,"crit":10,"gd":0,"start":false},{"id":"sk-0048","name":"ノクターン","kind":"pow","dist":[2],"power":24,"hit":10,"guts":35,"crit":18,"gd":24,"start":false},{"id":"sk-0049","name":"ブレードダンス","kind":"pow","dist":[0],"power":24,"hit":5,"guts":36,"crit":15,"gd":24,"start":false},{"id":"sk-0054","name":"バスターソード","kind":"pow","dist":[1],"power":16,"hit":-1,"guts":39,"crit":25,"gd":7,"start":false},{"id":"sk-0050","name":"クリムゾンノヴァ","kind":"pow","dist":[3],"power":27,"hit":-1,"guts":41,"crit":12,"gd":7,"start":false},{"id":"sk-0052","name":"ミラージュクロウ","kind":"pow","dist":[0],"power":33,"hit":10,"guts":43,"crit":18,"gd":24,"start":false},{"id":"sk-0051","name":"レクイエムエンド","kind":"pow","dist":[2],"power":49,"hit":-5,"guts":44,"crit":21,"gd":12,"start":false}],"regen":13,"dmgMul":0.867,"first":18,"taken":1.09,"size":"M"},"KenshiMocchi":{"name":"剣士モッチー","apt":["A","A","C","D"],"techs":[{"id":"kenshimocchi_o01","name":"エッジもんた","kind":"pow","dist":[0],"power":8,"hit":5,"guts":11,"crit":10,"gd":6,"start":true},{"id":"kenshimocchi_o02","name":"もちき・リープ","kind":"pow","dist":[2],"power":8,"hit":5,"guts":13,"crit":10,"gd":6,"start":true},{"id":"kenshimocchi_o03","name":"ガッチョスラント","kind":"pow","dist":[1],"power":12,"hit":5,"guts":16,"crit":10,"gd":6,"start":false},{"id":"kenshimocchi_o04","name":"エアリアルもっちゃん","kind":"pow","dist":[2],"power":12,"hit":5,"guts":18,"crit":10,"gd":6,"start":false},{"id":"kenshimocchi_o05","name":"ガッチャー・クロス","kind":"pow","dist":[1],"power":17,"hit":-1,"guts":21,"crit":12,"gd":6,"start":false},{"id":"kenshimocchi_o06","name":"黒桜吹雪","kind":"wise","dist":[3],"power":17,"hit":-1,"guts":23,"crit":12,"gd":6,"start":false},{"id":"kenshimocchi_o07","name":"もっさんスピン","kind":"pow","dist":[1],"power":25,"hit":-1,"guts":26,"crit":12,"gd":6,"start":false},{"id":"kenshimocchi_o08","name":"枝垂れクロス","kind":"wise","dist":[3],"power":25,"hit":-11,"guts":28,"crit":18,"gd":6,"start":false},{"id":"kenshimocchi_o09","name":"バーストもっさま","kind":"pow","dist":[1],"power":31,"hit":-1,"guts":30,"crit":12,"gd":16,"start":false},{"id":"kenshimocchi_o10","name":"ソニック・リープ","kind":"pow","dist":[2],"power":17,"hit":-1,"guts":23,"crit":12,"gd":6,"start":false},{"id":"kenshimocchi_o11","name":"ホリゾンタル・スクエア","kind":"pow","dist":[1],"power":25,"hit":-1,"guts":25,"crit":12,"gd":6,"start":false},{"id":"kenshimocchi_o12","name":"ヴォーパル・ストライク","kind":"pow","dist":[2],"power":25,"hit":-1,"guts":28,"crit":18,"gd":6,"start":false},{"id":"kenshimocchi_o13","name":"デュアル・サーキュラー","kind":"pow","dist":[1],"power":31,"hit":-1,"guts":30,"crit":12,"gd":6,"start":false},{"id":"kenshimocchi_o14","name":"ブラック・テンペスト","kind":"wise","dist":[3],"power":31,"hit":-11,"guts":33,"crit":12,"gd":6,"start":false},{"id":"kenshimocchi_o15","name":"ブラック・チェイン","kind":"pow","dist":[1],"power":31,"hit":-11,"guts":35,"crit":12,"gd":8,"start":false},{"id":"kenshimocchi_o16","name":"ナイトメア・レイド","kind":"pow","dist":[2],"power":40,"hit":-11,"guts":37,"crit":12,"gd":8,"start":false},{"id":"kenshimocchi_o17","name":"ジ・エクリプス","kind":"pow","dist":[1],"power":40,"hit":-11,"guts":40,"crit":12,"gd":8,"start":false},{"id":"kenshimocchi_o18","name":"スターバースト・ストリーム","kind":"pow","dist":[2],"power":51,"hit":-11,"guts":42,"crit":18,"gd":16,"start":false}],"regen":15,"dmgMul":0.8,"first":18,"taken":1.09,"size":"S"},"Kuromy":{"name":"クロミー","apt":["C","A","B","D"],"techs":[{"id":"kuromy_o01","name":"バク頭突き","kind":"pow","dist":[0],"power":9,"hit":7,"guts":12,"crit":10,"gd":5,"start":true},{"id":"kuromy_o02","name":"バク空中落下プレス","kind":"pow","dist":[1],"power":12,"hit":7,"guts":15,"crit":10,"gd":5,"start":true},{"id":"kuromy_o03","name":"ブラックノートライト","kind":"wise","dist":[2],"power":12,"hit":-3,"guts":17,"crit":10,"gd":12,"start":false},{"id":"kuromy_o04","name":"バクパタパタ耳","kind":"pow","dist":[1],"power":18,"hit":-3,"guts":20,"crit":12,"gd":12,"start":false},{"id":"kuromy_o05","name":"巨大雪だるま転がし","kind":"pow","dist":[1],"power":18,"hit":-3,"guts":23,"crit":12,"gd":5,"start":false},{"id":"kuromy_o06","name":"KUROMI'S5アタック","kind":"pow","dist":[2],"power":27,"hit":-3,"guts":26,"crit":12,"gd":5,"start":false},{"id":"kuromy_o07","name":"ナイトメアらっきょうボム","kind":"wise","dist":[2],"power":27,"hit":-3,"guts":28,"crit":12,"gd":15,"start":false},{"id":"kuromy_o08","name":"バコ・ベリースプラッシュ","kind":"wise","dist":[3],"power":34,"hit":-13,"guts":31,"crit":12,"gd":15,"start":false},{"id":"kuromy_o09","name":"ダークパワー","kind":"wise","dist":[2],"power":34,"hit":-13,"guts":34,"crit":12,"gd":7,"start":false},{"id":"kuromy_o10","name":"ドクロボム","kind":"wise","dist":[3],"power":27,"hit":-3,"guts":25,"crit":12,"gd":15,"start":false},{"id":"kuromy_o11","name":"クロミーズ5突撃","kind":"pow","dist":[0],"power":27,"hit":-3,"guts":28,"crit":12,"gd":7,"start":false},{"id":"kuromy_o12","name":"夢くいウィング","kind":"wise","dist":[3],"power":34,"hit":-13,"guts":31,"crit":12,"gd":7,"start":false},{"id":"kuromy_o13","name":"恨み帳メテオ","kind":"wise","dist":[2],"power":34,"hit":-13,"guts":33,"crit":12,"gd":15,"start":false},{"id":"kuromy_o14","name":"黒音符バースト","kind":"wise","dist":[3],"power":42,"hit":-13,"guts":36,"crit":12,"gd":15,"start":false},{"id":"kuromy_o15","name":"らっきょう大雨","kind":"wise","dist":[2],"power":42,"hit":-13,"guts":39,"crit":12,"gd":7,"start":false},{"id":"kuromy_o16","name":"ナイトメアアーク","kind":"wise","dist":[3],"power":42,"hit":-13,"guts":42,"crit":18,"gd":7,"start":false},{"id":"kuromy_o17","name":"ダークオーロラ","kind":"wise","dist":[2],"power":55,"hit":-13,"guts":44,"crit":18,"gd":7,"start":false},{"id":"kuromy_o18","name":"悪夢フィナーレ","kind":"wise","dist":[3],"power":55,"hit":-16,"guts":47,"crit":18,"gd":7,"start":false}],"regen":13,"dmgMul":0.867,"first":6,"taken":1.03,"size":"L"},"Kyubi":{"name":"キュービ","apt":["B","D","B","B"],"techs":[{"id":"sk-0005","name":"ひっかき","kind":"pow","dist":[0],"power":8,"hit":-22,"guts":14,"crit":6,"gd":0,"start":true},{"id":"sk-0003","name":"狐火","kind":"wise","dist":[2],"power":13,"hit":4,"guts":15,"crit":8,"gd":0,"start":true},{"id":"sk-0001","name":"神域移動","kind":"wise","dist":[3],"power":8,"hit":-12,"guts":16,"crit":8,"gd":0,"start":false},{"id":"sk-0004","name":"ひのこ","kind":"wise","dist":[1],"power":24,"hit":-22,"guts":19,"crit":6,"gd":5,"start":false},{"id":"sk-0010","name":"下駄蹴り","kind":"pow","dist":[1],"power":11,"hit":-12,"guts":17,"crit":10,"gd":12,"start":false},{"id":"sk-0008","name":"提灯落とし","kind":"pow","dist":[3],"power":30,"hit":-12,"guts":19,"crit":10,"gd":0,"start":false},{"id":"sk-0009","name":"提灯投げ","kind":"pow","dist":[2],"power":16,"hit":-2,"guts":20,"crit":10,"gd":5,"start":false},{"id":"sk-0018","name":"ゆうわく","kind":"wise","dist":[0],"power":8,"hit":-2,"guts":24,"crit":18,"gd":27,"start":false},{"id":"sk-0015","name":"超狐火","kind":"wise","dist":[3],"power":16,"hit":11,"guts":25,"crit":8,"gd":0,"start":false},{"id":"sk-0017","name":"なめろう","kind":"wise","dist":[1],"power":27,"hit":-2,"guts":25,"crit":8,"gd":24,"start":false},{"id":"sk-0016","name":"火炎車","kind":"wise","dist":[2],"power":38,"hit":-12,"guts":27,"crit":10,"gd":12,"start":false},{"id":"sk-0026","name":"陽炎","kind":"pow","dist":[2],"power":38,"hit":-2,"guts":34,"crit":10,"gd":0,"start":false},{"id":"sk-0027","name":"神光石火","kind":"wise","dist":[1],"power":38,"hit":4,"guts":38,"crit":18,"gd":0,"start":false},{"id":"sk-0028","name":"九重神眼","kind":"wise","dist":[0],"power":30,"hit":11,"guts":38,"crit":10,"gd":12,"start":false},{"id":"sk-0025","name":"神狐蒼火","kind":"wise","dist":[3],"power":38,"hit":11,"guts":44,"crit":18,"gd":7,"start":false},{"id":"sk-0037","name":"煉獄九尾陣","kind":"wise","dist":[0],"power":33,"hit":4,"guts":40,"crit":25,"gd":15,"start":false},{"id":"sk-0036","name":"天河天翔","kind":"wise","dist":[1],"power":49,"hit":4,"guts":41,"crit":12,"gd":0,"start":false},{"id":"sk-0002","name":"八嵐天衝","kind":"wise","dist":[2],"power":38,"hit":-2,"guts":42,"crit":10,"gd":0,"start":false},{"id":"sk-0035","name":"炸裂気泡陣","kind":"wise","dist":[3],"power":24,"hit":1,"guts":45,"crit":27,"gd":12,"start":false}],"regen":15,"dmgMul":0.8,"first":12,"taken":1.06,"size":"S"},"MelWhip":{"name":"メルホイップ","apt":["E","C","A","B"],"techs":[{"id":"sk-0576","name":"頭突き","kind":"pow","dist":[0],"power":16,"hit":-19,"guts":13,"crit":10,"gd":0,"start":true},{"id":"sk-0573","name":"空中脳天撃","kind":"pow","dist":[3],"power":16,"hit":-3,"guts":16,"crit":10,"gd":5,"start":true},{"id":"sk-0575","name":"スターボム","kind":"wise","dist":[1],"power":11,"hit":-9,"guts":17,"crit":9,"gd":12,"start":false},{"id":"sk-0574","name":"グリーンライト","kind":"wise","dist":[2],"power":8,"hit":7,"guts":19,"crit":6,"gd":5,"start":false},{"id":"sk-0577","name":"ワンダーブレイズ","kind":"wise","dist":[2],"power":11,"hit":-19,"guts":15,"crit":16,"gd":5,"start":false},{"id":"sk-0578","name":"ぴろぴろ舌","kind":"pow","dist":[1],"power":16,"hit":-19,"guts":21,"crit":10,"gd":0,"start":false},{"id":"sk-0579","name":"メニーウィング","kind":"wise","dist":[0],"power":11,"hit":1,"guts":22,"crit":16,"gd":7,"start":false},{"id":"sk-0785","name":"メニーウィング・翠","kind":"wise","dist":[0],"power":16,"hit":4,"guts":22,"crit":16,"gd":7,"start":false},{"id":"sk-0787","name":"ライスシャワー","kind":"wise","dist":[3],"power":8,"hit":-3,"guts":26,"crit":10,"gd":15,"start":false},{"id":"sk-0580","name":"月面水爆","kind":"pow","dist":[3],"power":24,"hit":-15,"guts":26,"crit":16,"gd":5,"start":false},{"id":"sk-0581","name":"大玉転がし","kind":"pow","dist":[2],"power":24,"hit":-22,"guts":26,"crit":23,"gd":12,"start":false},{"id":"sk-0582","name":"メテオストーム","kind":"wise","dist":[1],"power":24,"hit":1,"guts":32,"crit":10,"gd":7,"start":false},{"id":"sk-0585","name":"キャンディボム","kind":"pow","dist":[1],"power":24,"hit":12,"guts":32,"crit":8,"gd":27,"start":false},{"id":"sk-0586","name":"苺大噴","kind":"pow","dist":[0],"power":38,"hit":4,"guts":35,"crit":25,"gd":5,"start":false},{"id":"sk-0584","name":"パピヨンバースト","kind":"wise","dist":[2],"power":38,"hit":7,"guts":38,"crit":16,"gd":7,"start":false},{"id":"sk-0583","name":"ヘビーレイン","kind":"wise","dist":[3],"power":38,"hit":1,"guts":40,"crit":25,"gd":0,"start":false},{"id":"sk-0788","name":"ケーキ入刀","kind":"pow","dist":[0],"power":43,"hit":1,"guts":42,"crit":25,"gd":5,"start":false},{"id":"sk-0588","name":"エターナルアーク","kind":"wise","dist":[2],"power":33,"hit":1,"guts":39,"crit":10,"gd":27,"start":false},{"id":"sk-0590","name":"オーロラハック","kind":"wise","dist":[0],"power":51,"hit":-9,"guts":40,"crit":25,"gd":24,"start":false},{"id":"sk-0589","name":"コスモフルーツ","kind":"wise","dist":[1],"power":51,"hit":1,"guts":41,"crit":13,"gd":5,"start":false},{"id":"sk-0587","name":"シャドウレギオン","kind":"pow","dist":[3],"power":38,"hit":12,"guts":42,"crit":16,"gd":12,"start":false}],"regen":13,"dmgMul":0.867,"first":6,"taken":1.03,"size":"L"},"Melody":{"name":"メロディー","apt":["C","B","A","D"],"techs":[{"id":"melody_o01","name":"ぞうさん頭突き","kind":"pow","dist":[0],"power":10,"hit":9,"guts":10,"crit":10,"gd":5,"start":true},{"id":"melody_o02","name":"ピアノパラソル脳天撃","kind":"pow","dist":[1],"power":10,"hit":3,"guts":13,"crit":10,"gd":5,"start":true},{"id":"melody_o03","name":"メロディタクトライト","kind":"wise","dist":[2],"power":14,"hit":3,"guts":15,"crit":10,"gd":5,"start":false},{"id":"melody_o04","name":"ぞうさんぴろぴろ鼻","kind":"pow","dist":[1],"power":14,"hit":3,"guts":18,"crit":12,"gd":13,"start":false},{"id":"melody_o05","name":"マリーランド大玉転がし","kind":"pow","dist":[1],"power":20,"hit":3,"guts":21,"crit":12,"gd":5,"start":false},{"id":"melody_o06","name":"ムーンサルトメロディー","kind":"pow","dist":[2],"power":20,"hit":3,"guts":23,"crit":12,"gd":5,"start":false},{"id":"melody_o07","name":"メロディキャンディボム","kind":"wise","dist":[2],"power":30,"hit":-7,"guts":24,"crit":12,"gd":13,"start":false},{"id":"melody_o08","name":"メロディ苺クッキー","kind":"wise","dist":[3],"power":30,"hit":-7,"guts":27,"crit":12,"gd":13,"start":false},{"id":"melody_o09","name":"ドリームパワー","kind":"wise","dist":[2],"power":38,"hit":-7,"guts":30,"crit":12,"gd":5,"start":false},{"id":"melody_o10","name":"メロメロハート","kind":"wise","dist":[3],"power":20,"hit":-7,"guts":22,"crit":12,"gd":13,"start":false},{"id":"melody_o11","name":"ピアノワルツ","kind":"wise","dist":[2],"power":30,"hit":-7,"guts":24,"crit":12,"gd":13,"start":false},{"id":"melody_o12","name":"リボンウィング","kind":"wise","dist":[3],"power":30,"hit":-7,"guts":27,"crit":12,"gd":5,"start":false},{"id":"melody_o13","name":"パウンドメテオ","kind":"wise","dist":[2],"power":38,"hit":-7,"guts":29,"crit":12,"gd":22,"start":false},{"id":"melody_o14","name":"ピンクバースト","kind":"wise","dist":[3],"power":38,"hit":-7,"guts":32,"crit":12,"gd":22,"start":false},{"id":"melody_o15","name":"キャンディレイン","kind":"wise","dist":[2],"power":38,"hit":-7,"guts":35,"crit":12,"gd":22,"start":false},{"id":"melody_o16","name":"マリーランドアーチ","kind":"wise","dist":[3],"power":48,"hit":-17,"guts":37,"crit":14,"gd":10,"start":false},{"id":"melody_o17","name":"メロディタクト","kind":"wise","dist":[2],"power":48,"hit":-17,"guts":39,"crit":14,"gd":10,"start":false},{"id":"melody_o18","name":"スウィートパレード","kind":"wise","dist":[3],"power":61,"hit":-17,"guts":41,"crit":14,"gd":22,"start":false}],"regen":13,"dmgMul":0.867,"first":0,"taken":1,"size":"L"},"Mia":{"name":"ミーア","apt":["G","C","A","B"],"techs":[{"id":"sk-0260","name":"はり手","kind":"pow","dist":[0],"power":8,"hit":1,"guts":10,"crit":6,"gd":0,"start":true},{"id":"sk-0259","name":"サンダー","kind":"wise","dist":[2],"power":8,"hit":1,"guts":13,"crit":6,"gd":7,"start":true},{"id":"sk-0258","name":"レイ","kind":"wise","dist":[3],"power":11,"hit":-19,"guts":17,"crit":18,"gd":0,"start":false},{"id":"sk-0263","name":"ハイキック","kind":"pow","dist":[1],"power":24,"hit":-3,"guts":15,"crit":8,"gd":0,"start":false},{"id":"sk-0262","name":"ライトニング","kind":"wise","dist":[2],"power":11,"hit":7,"guts":20,"crit":8,"gd":0,"start":false},{"id":"sk-0261","name":"メガレイ","kind":"wise","dist":[3],"power":16,"hit":-15,"guts":24,"crit":21,"gd":0,"start":false},{"id":"sk-0264","name":"なげキッス","kind":"wise","dist":[2],"power":6,"hit":7,"guts":21,"crit":8,"gd":24,"start":false},{"id":"sk-0266","name":"ヒールレイド","kind":"pow","dist":[0],"power":30,"hit":-9,"guts":21,"crit":8,"gd":15,"start":false},{"id":"sk-0265","name":"バン","kind":"wise","dist":[1],"power":30,"hit":-19,"guts":30,"crit":12,"gd":12,"start":false},{"id":"sk-0267","name":"ギガレイ","kind":"wise","dist":[3],"power":24,"hit":1,"guts":28,"crit":25,"gd":5,"start":false},{"id":"sk-0270","name":"投げ飛ばし","kind":"pow","dist":[0],"power":30,"hit":-9,"guts":30,"crit":8,"gd":24,"start":false},{"id":"sk-0268","name":"ギガサンダー","kind":"wise","dist":[2],"power":30,"hit":7,"guts":38,"crit":10,"gd":13,"start":false},{"id":"sk-0269","name":"ビッグバン","kind":"wise","dist":[1],"power":38,"hit":-19,"guts":38,"crit":18,"gd":15,"start":false},{"id":"sk-0274","name":"ギガライトニング","kind":"wise","dist":[2],"power":33,"hit":14,"guts":35,"crit":12,"gd":24,"start":false},{"id":"sk-0273","name":"ファイトクラウド","kind":"pow","dist":[0],"power":38,"hit":1,"guts":40,"crit":18,"gd":15,"start":false},{"id":"sk-0272","name":"コズミックバン","kind":"wise","dist":[1],"power":38,"hit":-3,"guts":45,"crit":12,"gd":24,"start":false},{"id":"sk-0271","name":"アストラルレイ","kind":"wise","dist":[3],"power":51,"hit":-9,"guts":52,"crit":25,"gd":0,"start":false}],"regen":15,"dmgMul":0.8,"first":18,"taken":1.09,"size":"S"},"Mitarashi":{"name":"ミタラシ","apt":["D","D","B","B"],"techs":[{"id":"sk-0402","name":"もんた","kind":"pow","dist":[0],"power":16,"hit":-8,"guts":16,"crit":6,"gd":0,"start":true},{"id":"sk-0400","name":"ローリンモッチ","kind":"pow","dist":[2],"power":16,"hit":-18,"guts":21,"crit":18,"gd":5,"start":true},{"id":"sk-0401","name":"もちき","kind":"pow","dist":[1],"power":24,"hit":-18,"guts":24,"crit":8,"gd":0,"start":false},{"id":"sk-0405","name":"ぺろりん","kind":"wise","dist":[1],"power":6,"hit":-8,"guts":21,"crit":10,"gd":24,"start":false},{"id":"sk-0406","name":"ガッチョ","kind":"pow","dist":[0],"power":21,"hit":2,"guts":21,"crit":8,"gd":0,"start":false},{"id":"sk-0403","name":"モッチ砲","kind":"wise","dist":[3],"power":27,"hit":-2,"guts":25,"crit":6,"gd":0,"start":false},{"id":"sk-0404","name":"さくら吹雪","kind":"wise","dist":[2],"power":16,"hit":-8,"guts":26,"crit":18,"gd":5,"start":false},{"id":"sk-0409","name":"ガッチャー","kind":"pow","dist":[0],"power":24,"hit":8,"guts":24,"crit":8,"gd":7,"start":false},{"id":"sk-0408","name":"もっちゃん","kind":"pow","dist":[1],"power":24,"hit":-23,"guts":26,"crit":6,"gd":5,"start":false},{"id":"sk-0407","name":"超ローリンモッチ","kind":"pow","dist":[2],"power":27,"hit":-8,"guts":35,"crit":25,"gd":7,"start":false},{"id":"sk-0413","name":"超ガッチョ","kind":"pow","dist":[0],"power":33,"hit":2,"guts":35,"crit":10,"gd":15,"start":false},{"id":"sk-0410","name":"大モッチ砲","kind":"wise","dist":[3],"power":49,"hit":2,"guts":41,"crit":10,"gd":5,"start":false},{"id":"sk-0411","name":"枝垂ざくら","kind":"wise","dist":[2],"power":43,"hit":8,"guts":43,"crit":12,"gd":0,"start":false},{"id":"sk-0412","name":"もっさま","kind":"pow","dist":[1],"power":49,"hit":-8,"guts":43,"crit":12,"gd":12,"start":false},{"id":"sk-0416","name":"もっさまん","kind":"pow","dist":[1],"power":49,"hit":-2,"guts":45,"crit":28,"gd":21,"start":false},{"id":"sk-0415","name":"宵闇ざくら","kind":"wise","dist":[2],"power":49,"hit":8,"guts":48,"crit":12,"gd":0,"start":false},{"id":"sk-0414","name":"超モッチ砲","kind":"wise","dist":[3],"power":51,"hit":-8,"guts":50,"crit":18,"gd":15,"start":false}],"regen":10,"dmgMul":1,"first":0,"taken":1,"size":"S"},"Mocchi":{"name":"モッチー","apt":["C","C","C","C"],"techs":[{"id":"sk-0402","name":"もんた","kind":"pow","dist":[0],"power":16,"hit":-8,"guts":16,"crit":6,"gd":0,"start":true},{"id":"sk-0400","name":"ローリンモッチ","kind":"pow","dist":[2],"power":16,"hit":-18,"guts":21,"crit":18,"gd":5,"start":true},{"id":"sk-0401","name":"もちき","kind":"pow","dist":[1],"power":24,"hit":-18,"guts":24,"crit":8,"gd":0,"start":false},{"id":"sk-0405","name":"ぺろりん","kind":"wise","dist":[1],"power":6,"hit":-8,"guts":21,"crit":10,"gd":24,"start":false},{"id":"sk-0406","name":"ガッチョ","kind":"pow","dist":[0],"power":21,"hit":2,"guts":21,"crit":8,"gd":0,"start":false},{"id":"sk-0403","name":"モッチ砲","kind":"wise","dist":[3],"power":27,"hit":-2,"guts":25,"crit":6,"gd":0,"start":false},{"id":"sk-0404","name":"さくら吹雪","kind":"wise","dist":[2],"power":16,"hit":-8,"guts":26,"crit":18,"gd":5,"start":false},{"id":"sk-0409","name":"ガッチャー","kind":"pow","dist":[0],"power":24,"hit":8,"guts":24,"crit":8,"gd":7,"start":false},{"id":"sk-0408","name":"もっちゃん","kind":"pow","dist":[1],"power":24,"hit":-23,"guts":26,"crit":6,"gd":5,"start":false},{"id":"sk-0407","name":"超ローリンモッチ","kind":"pow","dist":[2],"power":27,"hit":-8,"guts":35,"crit":25,"gd":7,"start":false},{"id":"sk-0413","name":"超ガッチョ","kind":"pow","dist":[0],"power":33,"hit":2,"guts":35,"crit":10,"gd":15,"start":false},{"id":"sk-0410","name":"大モッチ砲","kind":"wise","dist":[3],"power":49,"hit":2,"guts":41,"crit":10,"gd":5,"start":false},{"id":"sk-0411","name":"枝垂ざくら","kind":"wise","dist":[2],"power":43,"hit":8,"guts":43,"crit":12,"gd":0,"start":false},{"id":"sk-0412","name":"もっさま","kind":"pow","dist":[1],"power":49,"hit":-8,"guts":43,"crit":12,"gd":12,"start":false},{"id":"sk-0416","name":"もっさまん","kind":"pow","dist":[1],"power":49,"hit":-2,"guts":45,"crit":28,"gd":21,"start":false},{"id":"sk-0415","name":"宵闇ざくら","kind":"wise","dist":[2],"power":49,"hit":8,"guts":48,"crit":12,"gd":0,"start":false},{"id":"sk-0414","name":"超モッチ砲","kind":"wise","dist":[3],"power":51,"hit":-8,"guts":50,"crit":18,"gd":15,"start":false}],"regen":12,"dmgMul":0.933,"first":0,"taken":1,"size":"S"},"Monol":{"name":"モノリス","apt":["B","C","D","C"],"techs":[{"id":"sk-0513","name":"体当たり","kind":"pow","dist":[0],"power":8,"hit":-8,"guts":9,"crit":7,"gd":0,"start":true},{"id":"sk-0512","name":"たおれこみ","kind":"pow","dist":[1],"power":11,"hit":-18,"guts":12,"crit":7,"gd":0,"start":true},{"id":"sk-0511","name":"おんば","kind":"wise","dist":[3],"power":8,"hit":8,"guts":17,"crit":9,"gd":0,"start":false},{"id":"sk-0516","name":"ひっかき","kind":"pow","dist":[1],"power":11,"hit":-18,"guts":14,"crit":9,"gd":15,"start":false},{"id":"sk-0517","name":"針ぶっさし","kind":"pow","dist":[0],"power":24,"hit":-18,"guts":23,"crit":11,"gd":12,"start":false},{"id":"sk-0514","name":"わらわら","kind":"pow","dist":[3],"power":24,"hit":-8,"guts":25,"crit":9,"gd":24,"start":false},{"id":"sk-0515","name":"トリオビームX","kind":"wise","dist":[2],"power":16,"hit":-8,"guts":25,"crit":13,"gd":12,"start":false},{"id":"sk-0519","name":"大たおれこみ","kind":"pow","dist":[2],"power":21,"hit":2,"guts":18,"crit":7,"gd":0,"start":false},{"id":"sk-0520","name":"超おんば","kind":"wise","dist":[1],"power":16,"hit":8,"guts":21,"crit":9,"gd":5,"start":false},{"id":"sk-0518","name":"トリオビームY","kind":"wise","dist":[3],"power":30,"hit":-8,"guts":30,"crit":13,"gd":15,"start":false},{"id":"sk-0521","name":"超針ぶっさし","kind":"pow","dist":[0],"power":49,"hit":-21,"guts":43,"crit":13,"gd":0,"start":false},{"id":"sk-0524","name":"オーロラゲート","kind":"wise","dist":[0],"power":30,"hit":15,"guts":34,"crit":9,"gd":12,"start":false},{"id":"sk-0522","name":"トリオビームZ","kind":"wise","dist":[3],"power":49,"hit":-8,"guts":37,"crit":19,"gd":7,"start":false},{"id":"sk-0523","name":"ドリルアタック","kind":"pow","dist":[2],"power":30,"hit":5,"guts":45,"crit":19,"gd":15,"start":false},{"id":"sk-0526","name":"クリムゾンブレイク","kind":"pow","dist":[2],"power":33,"hit":-8,"guts":41,"crit":19,"gd":7,"start":false},{"id":"sk-0525","name":"トリオビーム∞","kind":"wise","dist":[3],"power":33,"hit":5,"guts":45,"crit":19,"gd":24,"start":false}],"regen":7,"dmgMul":1.133,"first":-12,"taken":0.94,"size":"L"},"Oboro":{"name":"オボロゲソウ","apt":["D","E","B","C"],"techs":[{"id":"sk-0447","name":"つっつき","kind":"pow","dist":[1],"power":24,"hit":-3,"guts":13,"crit":6,"gd":0,"start":true},{"id":"sk-0448","name":"根っこ","kind":"pow","dist":[0],"power":8,"hit":3,"guts":14,"crit":6,"gd":0,"start":true},{"id":"sk-0446","name":"種ガン","kind":"wise","dist":[3],"power":11,"hit":-23,"guts":23,"crit":12,"gd":0,"start":false},{"id":"sk-0452","name":"連続根っこ","kind":"pow","dist":[0],"power":11,"hit":10,"guts":18,"crit":8,"gd":0,"start":false},{"id":"sk-0449","name":"種マシンガン","kind":"wise","dist":[3],"power":16,"hit":-3,"guts":20,"crit":25,"gd":5,"start":false},{"id":"sk-0450","name":"ミツ","kind":"wise","dist":[2],"power":8,"hit":3,"guts":22,"crit":6,"gd":15,"start":false},{"id":"sk-0451","name":"葉っぱブレード","kind":"wise","dist":[1],"power":24,"hit":-25,"guts":22,"crit":8,"gd":0,"start":false},{"id":"sk-0455","name":"連続つっつき","kind":"pow","dist":[1],"power":27,"hit":-3,"guts":19,"crit":15,"gd":13,"start":false},{"id":"sk-0454","name":"花吹雪","kind":"wise","dist":[2],"power":38,"hit":-23,"guts":39,"crit":10,"gd":0,"start":false},{"id":"sk-0453","name":"フラワービーム","kind":"wise","dist":[3],"power":30,"hit":-3,"guts":42,"crit":8,"gd":12,"start":false},{"id":"sk-0459","name":"蒼花爆散","kind":"wise","dist":[0],"power":16,"hit":10,"guts":32,"crit":12,"gd":26,"start":false},{"id":"sk-0458","name":"コンビネーション","kind":"pow","dist":[1],"power":30,"hit":-13,"guts":33,"crit":8,"gd":0,"start":false},{"id":"sk-0456","name":"乱れ咲き","kind":"wise","dist":[3],"power":24,"hit":13,"guts":35,"crit":25,"gd":5,"start":false},{"id":"sk-0457","name":"捕食","kind":"pow","dist":[2],"power":30,"hit":3,"guts":38,"crit":18,"gd":24,"start":false},{"id":"sk-0824","name":"デスブルーム","kind":"pow","dist":[1],"power":33,"hit":13,"guts":40,"crit":21,"gd":24,"start":false}],"regen":13,"dmgMul":0.867,"first":-6,"taken":0.97,"size":"M"},"Orihime":{"name":"オリヒメ","apt":["B","A","D","A"],"techs":[{"id":"sk-0005","name":"ひっかき","kind":"pow","dist":[0],"power":8,"hit":-23,"guts":14,"crit":6,"gd":0,"start":true},{"id":"sk-0003","name":"狐火","kind":"wise","dist":[2],"power":13,"hit":3,"guts":15,"crit":8,"gd":0,"start":true},{"id":"sk-0001","name":"神域移動","kind":"wise","dist":[3],"power":8,"hit":-13,"guts":16,"crit":8,"gd":0,"start":false},{"id":"sk-0004","name":"ひのこ","kind":"wise","dist":[1],"power":24,"hit":-23,"guts":19,"crit":6,"gd":5,"start":false},{"id":"sk-0010","name":"下駄蹴り","kind":"pow","dist":[1],"power":11,"hit":-13,"guts":17,"crit":10,"gd":12,"start":false},{"id":"sk-0008","name":"提灯落とし","kind":"pow","dist":[3],"power":30,"hit":-13,"guts":19,"crit":10,"gd":0,"start":false},{"id":"sk-0009","name":"提灯投げ","kind":"pow","dist":[2],"power":16,"hit":-3,"guts":20,"crit":10,"gd":5,"start":false},{"id":"sk-0496","name":"求愛","kind":"wise","dist":[0],"power":16,"hit":10,"guts":18,"crit":6,"gd":24,"start":false},{"id":"sk-0023","name":"超狐火・星","kind":"wise","dist":[3],"power":24,"hit":10,"guts":22,"crit":9,"gd":0,"start":false},{"id":"sk-0018","name":"ゆうわく","kind":"wise","dist":[0],"power":8,"hit":-3,"guts":24,"crit":18,"gd":27,"start":false},{"id":"sk-0015","name":"超狐火","kind":"wise","dist":[3],"power":16,"hit":10,"guts":25,"crit":8,"gd":0,"start":false},{"id":"sk-0017","name":"なめろう","kind":"wise","dist":[1],"power":27,"hit":-3,"guts":25,"crit":8,"gd":24,"start":false},{"id":"sk-0016","name":"火炎車","kind":"wise","dist":[2],"power":38,"hit":-13,"guts":27,"crit":10,"gd":12,"start":false},{"id":"sk-0026","name":"陽炎","kind":"pow","dist":[2],"power":38,"hit":-3,"guts":34,"crit":10,"gd":0,"start":false},{"id":"sk-0027","name":"神光石火","kind":"wise","dist":[1],"power":38,"hit":3,"guts":38,"crit":18,"gd":0,"start":false},{"id":"sk-0028","name":"九重神眼","kind":"wise","dist":[0],"power":30,"hit":10,"guts":38,"crit":10,"gd":12,"start":false},{"id":"sk-0025","name":"神狐蒼火","kind":"wise","dist":[3],"power":38,"hit":10,"guts":44,"crit":18,"gd":7,"start":false},{"id":"sk-0037","name":"煉獄九尾陣","kind":"wise","dist":[0],"power":33,"hit":3,"guts":40,"crit":25,"gd":15,"start":false},{"id":"sk-0036","name":"天河天翔","kind":"wise","dist":[1],"power":49,"hit":3,"guts":41,"crit":12,"gd":0,"start":false},{"id":"sk-0002","name":"八嵐天衝","kind":"wise","dist":[2],"power":38,"hit":-3,"guts":42,"crit":10,"gd":0,"start":false},{"id":"sk-0035","name":"炸裂気泡陣","kind":"wise","dist":[3],"power":24,"hit":0,"guts":45,"crit":27,"gd":12,"start":false}],"regen":15,"dmgMul":0.8,"first":18,"taken":1.09,"size":"S"},"Pandora":{"name":"パンドラ","apt":["B","B","B","B"],"techs":[{"id":"pandora_o01","name":"デュアルスラップ","kind":"pow","dist":[0],"power":9,"hit":8,"guts":12,"crit":10,"gd":2,"start":true},{"id":"pandora_o02","name":"ルミナスレイ","kind":"wise","dist":[3],"power":12,"hit":-2,"guts":15,"crit":12,"gd":2,"start":true},{"id":"pandora_o03","name":"ナイトサンダー","kind":"wise","dist":[2],"power":18,"hit":-2,"guts":17,"crit":12,"gd":7,"start":false},{"id":"pandora_o04","name":"セラフキック","kind":"pow","dist":[1],"power":18,"hit":-2,"guts":20,"crit":12,"gd":7,"start":false},{"id":"pandora_o05","name":"アビスレイド","kind":"pow","dist":[1],"power":18,"hit":-2,"guts":23,"crit":12,"gd":7,"start":false},{"id":"pandora_o06","name":"ホーリーライトニング","kind":"wise","dist":[3],"power":27,"hit":-12,"guts":26,"crit":12,"gd":7,"start":false},{"id":"pandora_o07","name":"カオスメガレイ","kind":"wise","dist":[2],"power":27,"hit":-2,"guts":28,"crit":12,"gd":7,"start":false},{"id":"pandora_o08","name":"エクリプスキッス","kind":"wise","dist":[3],"power":34,"hit":-12,"guts":31,"crit":18,"gd":7,"start":false},{"id":"pandora_o09","name":"デュアルキッス","kind":"wise","dist":[2],"power":34,"hit":-12,"guts":34,"crit":18,"gd":7,"start":false},{"id":"pandora_o10","name":"デュアルバン","kind":"wise","dist":[3],"power":27,"hit":-12,"guts":25,"crit":12,"gd":7,"start":false},{"id":"pandora_o11","name":"セイクリッドレイ","kind":"wise","dist":[2],"power":27,"hit":-2,"guts":28,"crit":12,"gd":7,"start":false},{"id":"pandora_o12","name":"アビスサンダー","kind":"wise","dist":[3],"power":34,"hit":-12,"guts":31,"crit":12,"gd":7,"start":false},{"id":"pandora_o13","name":"ツインビッグバン","kind":"wise","dist":[2],"power":34,"hit":-12,"guts":33,"crit":12,"gd":7,"start":false},{"id":"pandora_o14","name":"ダークライトニング","kind":"wise","dist":[3],"power":43,"hit":-12,"guts":36,"crit":12,"gd":7,"start":false},{"id":"pandora_o15","name":"カオスコズミック","kind":"wise","dist":[2],"power":43,"hit":-12,"guts":39,"crit":18,"gd":7,"start":false},{"id":"pandora_o16","name":"アストラルクロスレイ","kind":"wise","dist":[3],"power":55,"hit":-15,"guts":42,"crit":25,"gd":7,"start":false},{"id":"pandora_o17","name":"エクリプスノヴァ","kind":"wise","dist":[2],"power":55,"hit":-12,"guts":44,"crit":18,"gd":9,"start":false},{"id":"pandora_o18","name":"ダイスキライライ","kind":"wise","dist":[3],"power":55,"hit":-15,"guts":47,"crit":18,"gd":9,"start":false}],"regen":15,"dmgMul":0.8,"first":18,"taken":1.09,"size":"S"},"Pixie":{"name":"ピクシー","apt":["G","F","B","A"],"techs":[{"id":"sk-0260","name":"はり手","kind":"pow","dist":[0],"power":8,"hit":1,"guts":10,"crit":6,"gd":0,"start":true},{"id":"sk-0259","name":"サンダー","kind":"wise","dist":[2],"power":8,"hit":1,"guts":13,"crit":6,"gd":7,"start":true},{"id":"sk-0258","name":"レイ","kind":"wise","dist":[3],"power":11,"hit":-19,"guts":17,"crit":18,"gd":0,"start":false},{"id":"sk-0263","name":"ハイキック","kind":"pow","dist":[1],"power":24,"hit":-3,"guts":15,"crit":8,"gd":0,"start":false},{"id":"sk-0262","name":"ライトニング","kind":"wise","dist":[2],"power":11,"hit":7,"guts":20,"crit":8,"gd":0,"start":false},{"id":"sk-0261","name":"メガレイ","kind":"wise","dist":[3],"power":16,"hit":-15,"guts":24,"crit":21,"gd":0,"start":false},{"id":"sk-0264","name":"なげキッス","kind":"wise","dist":[2],"power":6,"hit":7,"guts":21,"crit":8,"gd":24,"start":false},{"id":"sk-0266","name":"ヒールレイド","kind":"pow","dist":[0],"power":30,"hit":-9,"guts":21,"crit":8,"gd":15,"start":false},{"id":"sk-0265","name":"バン","kind":"wise","dist":[1],"power":30,"hit":-19,"guts":30,"crit":12,"gd":12,"start":false},{"id":"sk-0267","name":"ギガレイ","kind":"wise","dist":[3],"power":24,"hit":1,"guts":28,"crit":25,"gd":5,"start":false},{"id":"sk-0270","name":"投げ飛ばし","kind":"pow","dist":[0],"power":30,"hit":-9,"guts":30,"crit":8,"gd":24,"start":false},{"id":"sk-0268","name":"ギガサンダー","kind":"wise","dist":[2],"power":30,"hit":7,"guts":38,"crit":10,"gd":13,"start":false},{"id":"sk-0269","name":"ビッグバン","kind":"wise","dist":[1],"power":38,"hit":-19,"guts":38,"crit":18,"gd":15,"start":false},{"id":"sk-0274","name":"ギガライトニング","kind":"wise","dist":[2],"power":33,"hit":14,"guts":35,"crit":12,"gd":24,"start":false},{"id":"sk-0273","name":"ファイトクラウド","kind":"pow","dist":[0],"power":38,"hit":1,"guts":40,"crit":18,"gd":15,"start":false},{"id":"sk-0272","name":"コズミックバン","kind":"wise","dist":[1],"power":38,"hit":-3,"guts":45,"crit":12,"gd":24,"start":false},{"id":"sk-0271","name":"アストラルレイ","kind":"wise","dist":[3],"power":51,"hit":-9,"guts":52,"crit":25,"gd":0,"start":false}],"regen":15,"dmgMul":0.8,"first":18,"taken":1.09,"size":"S"},"Plant":{"name":"プラント","apt":["C","D","F","A"],"techs":[{"id":"sk-0447","name":"つっつき","kind":"pow","dist":[1],"power":27,"hit":-3,"guts":13,"crit":6,"gd":0,"start":true},{"id":"sk-0448","name":"根っこ","kind":"pow","dist":[0],"power":9,"hit":3,"guts":14,"crit":6,"gd":0,"start":true},{"id":"sk-0446","name":"種ガン","kind":"wise","dist":[3],"power":12,"hit":-23,"guts":23,"crit":12,"gd":0,"start":false},{"id":"sk-0452","name":"連続根っこ","kind":"pow","dist":[0],"power":12,"hit":10,"guts":18,"crit":8,"gd":0,"start":false},{"id":"sk-0449","name":"種マシンガン","kind":"wise","dist":[3],"power":18,"hit":-3,"guts":20,"crit":25,"gd":5,"start":false},{"id":"sk-0450","name":"ミツ","kind":"wise","dist":[2],"power":9,"hit":3,"guts":22,"crit":6,"gd":15,"start":false},{"id":"sk-0451","name":"葉っぱブレード","kind":"wise","dist":[1],"power":27,"hit":-25,"guts":22,"crit":8,"gd":0,"start":false},{"id":"sk-0455","name":"連続つっつき","kind":"pow","dist":[1],"power":30,"hit":-3,"guts":19,"crit":15,"gd":13,"start":false},{"id":"sk-0454","name":"花吹雪","kind":"wise","dist":[2],"power":42,"hit":-23,"guts":39,"crit":10,"gd":0,"start":false},{"id":"sk-0453","name":"フラワービーム","kind":"wise","dist":[3],"power":34,"hit":-3,"guts":42,"crit":8,"gd":12,"start":false},{"id":"sk-0459","name":"蒼花爆散","kind":"wise","dist":[0],"power":18,"hit":10,"guts":32,"crit":12,"gd":26,"start":false},{"id":"sk-0458","name":"コンビネーション","kind":"pow","dist":[1],"power":34,"hit":-13,"guts":33,"crit":8,"gd":0,"start":false},{"id":"sk-0456","name":"乱れ咲き","kind":"wise","dist":[3],"power":27,"hit":13,"guts":35,"crit":25,"gd":5,"start":false},{"id":"sk-0457","name":"捕食","kind":"pow","dist":[2],"power":34,"hit":3,"guts":38,"crit":18,"gd":24,"start":false},{"id":"sk-0824","name":"デスブルーム","kind":"pow","dist":[1],"power":37,"hit":13,"guts":40,"crit":21,"gd":24,"start":false}],"regen":15,"dmgMul":0.8,"first":-12,"taken":0.94,"size":"M"},"Snegurochka":{"name":"スネグーラチカ","apt":["D","E","B","A"],"techs":[{"id":"sk-0477","name":"アイスブレード","kind":"pow","dist":[0],"power":8,"hit":-18,"guts":13,"crit":6,"gd":0,"start":true},{"id":"sk-0475","name":"アクアウェイブ","kind":"wise","dist":[2],"power":8,"hit":2,"guts":17,"crit":8,"gd":0,"start":true},{"id":"sk-0476","name":"アクアウィップ","kind":"pow","dist":[1],"power":8,"hit":-8,"guts":21,"crit":8,"gd":15,"start":false},{"id":"sk-0481","name":"スプラッシュ","kind":"wise","dist":[0],"power":11,"hit":-18,"guts":16,"crit":8,"gd":12,"start":false},{"id":"sk-0478","name":"ダブルバレッド","kind":"wise","dist":[3],"power":11,"hit":2,"guts":19,"crit":10,"gd":0,"start":false},{"id":"sk-0742","name":"プレゼントキッス","kind":"wise","dist":[1],"power":11,"hit":2,"guts":20,"crit":25,"gd":0,"start":false},{"id":"sk-0479","name":"アイスアロー","kind":"wise","dist":[2],"power":16,"hit":-8,"guts":24,"crit":18,"gd":7,"start":false},{"id":"sk-0480","name":"アクアキッス","kind":"wise","dist":[1],"power":6,"hit":8,"guts":25,"crit":18,"gd":15,"start":false},{"id":"sk-0484","name":"ドルフィンブロー","kind":"pow","dist":[1],"power":24,"hit":-18,"guts":21,"crit":8,"gd":7,"start":false},{"id":"sk-0483","name":"アイスコフィン","kind":"wise","dist":[2],"power":30,"hit":-23,"guts":24,"crit":10,"gd":5,"start":false},{"id":"sk-0485","name":"ブラッドミスト","kind":"wise","dist":[0],"power":11,"hit":-18,"guts":25,"crit":18,"gd":26,"start":false},{"id":"sk-0743","name":"ジングルベル","kind":"wise","dist":[2],"power":30,"hit":-18,"guts":25,"crit":8,"gd":5,"start":false},{"id":"sk-0482","name":"クリスタルレイン","kind":"wise","dist":[3],"power":24,"hit":2,"guts":32,"crit":18,"gd":0,"start":false},{"id":"sk-0487","name":"アクアブラスト","kind":"wise","dist":[2],"power":16,"hit":15,"guts":26,"crit":10,"gd":15,"start":false},{"id":"sk-0488","name":"ホワイトストーム","kind":"wise","dist":[1],"power":38,"hit":2,"guts":33,"crit":8,"gd":15,"start":false},{"id":"sk-0486","name":"クリスタルアロー","kind":"wise","dist":[3],"power":38,"hit":-8,"guts":34,"crit":27,"gd":5,"start":false},{"id":"sk-0489","name":"アクアウォール","kind":"wise","dist":[0],"power":38,"hit":-8,"guts":34,"crit":12,"gd":0,"start":false},{"id":"sk-0744","name":"メリークリスマス","kind":"wise","dist":[3],"power":38,"hit":-8,"guts":36,"crit":18,"gd":5,"start":false},{"id":"sk-0491","name":"アクアドーム","kind":"wise","dist":[1],"power":30,"hit":8,"guts":34,"crit":18,"gd":27,"start":false},{"id":"sk-0490","name":"ホワイトエレジー","kind":"wise","dist":[2],"power":43,"hit":5,"guts":44,"crit":12,"gd":15,"start":false}],"regen":13,"dmgMul":0.867,"first":18,"taken":1.09,"size":"S"},"Spooky":{"name":"スプーキー","apt":["B","D","B","A"],"techs":[{"id":"sk-0065","name":"ソウルビーム","kind":"wise","dist":[1],"power":12,"hit":3,"guts":14,"crit":6,"gd":5,"start":true},{"id":"sk-0066","name":"ピコピコハンマー","kind":"pow","dist":[0],"power":14,"hit":-25,"guts":14,"crit":6,"gd":0,"start":true},{"id":"sk-0077","name":"ハトのおとしもの","kind":"wise","dist":[2],"power":21,"hit":-25,"guts":24,"crit":10,"gd":7,"start":false},{"id":"sk-0068","name":"びっくり","kind":"wise","dist":[1],"power":10,"hit":-3,"guts":16,"crit":6,"gd":13,"start":false},{"id":"sk-0069","name":"体当たり","kind":"pow","dist":[0],"power":24,"hit":0,"guts":21,"crit":8,"gd":7,"start":false},{"id":"sk-0078","name":"カード","kind":"wise","dist":[3],"power":21,"hit":-3,"guts":21,"crit":10,"gd":7,"start":false},{"id":"sk-0067","name":"すてきステッキ","kind":"wise","dist":[2],"power":8,"hit":-23,"guts":22,"crit":16,"gd":0,"start":false},{"id":"sk-0082","name":"カード・クラブ","kind":"wise","dist":[3],"power":19,"hit":-3,"guts":28,"crit":10,"gd":7,"start":false},{"id":"sk-0070","name":"連続カード","kind":"wise","dist":[3],"power":19,"hit":-3,"guts":25,"crit":23,"gd":12,"start":false},{"id":"sk-0071","name":"ドクロビーム","kind":"wise","dist":[2],"power":21,"hit":3,"guts":32,"crit":16,"gd":7,"start":false},{"id":"sk-0072","name":"大パンチ","kind":"pow","dist":[0],"power":38,"hit":-3,"guts":32,"crit":16,"gd":12,"start":false},{"id":"sk-0073","name":"大きなおとしもの","kind":"wise","dist":[2],"power":44,"hit":-3,"guts":34,"crit":16,"gd":24,"start":false},{"id":"sk-0080","name":"びっくりドクロ","kind":"wise","dist":[1],"power":34,"hit":3,"guts":34,"crit":23,"gd":24,"start":false},{"id":"sk-0079","name":"スリーセブン","kind":"wise","dist":[3],"power":27,"hit":-13,"guts":40,"crit":26,"gd":5,"start":false},{"id":"sk-0074","name":"コンビネーション","kind":"pow","dist":[0],"power":24,"hit":10,"guts":45,"crit":16,"gd":12,"start":false},{"id":"sk-0083","name":"グリンネーション","kind":"pow","dist":[0],"power":24,"hit":13,"guts":50,"crit":19,"gd":15,"start":false},{"id":"sk-0075","name":"Woフォーチュン","kind":"wise","dist":[3],"power":46,"hit":13,"guts":33,"crit":10,"gd":21,"start":false},{"id":"sk-0084","name":"RSF","kind":"wise","dist":[1],"power":27,"hit":10,"guts":38,"crit":23,"gd":15,"start":false},{"id":"sk-0076","name":"運命のコイン","kind":"wise","dist":[2],"power":44,"hit":8,"guts":43,"crit":23,"gd":7,"start":false}],"regen":15,"dmgMul":0.8,"first":18,"taken":1.09,"size":"S"},"Suezo":{"name":"スエゾー","apt":["E","D","C","B"],"techs":[{"id":"sk-0461","name":"ツバはき","kind":"wise","dist":[1],"power":8,"hit":-20,"guts":13,"crit":6,"gd":5,"start":true},{"id":"sk-0462","name":"しっぽアタック","kind":"pow","dist":[0],"power":8,"hit":-17,"guts":14,"crit":6,"gd":0,"start":true},{"id":"sk-0460","name":"テレポート","kind":"pow","dist":[2],"power":8,"hit":9,"guts":18,"crit":8,"gd":0,"start":false},{"id":"sk-0463","name":"テレパシー","kind":"wise","dist":[2],"power":11,"hit":-7,"guts":20,"crit":18,"gd":12,"start":false},{"id":"sk-0464","name":"かみつき","kind":"pow","dist":[1],"power":24,"hit":-20,"guts":22,"crit":8,"gd":7,"start":false},{"id":"sk-0465","name":"キッス","kind":"wise","dist":[0],"power":16,"hit":-7,"guts":27,"crit":8,"gd":15,"start":false},{"id":"sk-0468","name":"なめる","kind":"wise","dist":[1],"power":11,"hit":3,"guts":19,"crit":10,"gd":15,"start":false},{"id":"sk-0467","name":"サイコキネシス","kind":"wise","dist":[2],"power":16,"hit":9,"guts":22,"crit":8,"gd":5,"start":false},{"id":"sk-0466","name":"熱視線","kind":"wise","dist":[3],"power":24,"hit":-17,"guts":29,"crit":25,"gd":7,"start":false},{"id":"sk-0469","name":"ベロビンタ","kind":"pow","dist":[0],"power":39,"hit":-22,"guts":31,"crit":10,"gd":15,"start":false},{"id":"sk-0470","name":"歌う","kind":"wise","dist":[3],"power":24,"hit":-7,"guts":26,"crit":6,"gd":27,"start":false},{"id":"sk-0471","name":"クロノキネシス","kind":"wise","dist":[2],"power":24,"hit":3,"guts":33,"crit":25,"gd":5,"start":false},{"id":"sk-0473","name":"ラブインパクト","kind":"wise","dist":[0],"power":31,"hit":3,"guts":33,"crit":10,"gd":24,"start":false},{"id":"sk-0472","name":"食う","kind":"pow","dist":[1],"power":31,"hit":9,"guts":40,"crit":12,"gd":12,"start":false},{"id":"sk-0474","name":"超熱視線","kind":"wise","dist":[3],"power":44,"hit":3,"guts":39,"crit":27,"gd":7,"start":false}],"regen":12,"dmgMul":0.933,"first":-12,"taken":0.94,"size":"S"},"Tiger":{"name":"ライガー","apt":["C","B","D","D"],"techs":[{"id":"sk-0386","name":"かみつき","kind":"pow","dist":[0],"power":11,"hit":-3,"guts":13,"crit":8,"gd":2,"start":true},{"id":"sk-0385","name":"ひっかき","kind":"pow","dist":[1],"power":8,"hit":-15,"guts":14,"crit":6,"gd":2,"start":true},{"id":"sk-0384","name":"体当たり","kind":"pow","dist":[2],"power":21,"hit":7,"guts":18,"crit":8,"gd":2,"start":false},{"id":"sk-0390","name":"雷撃","kind":"wise","dist":[0],"power":11,"hit":-9,"guts":19,"crit":11,"gd":17,"start":false},{"id":"sk-0389","name":"ワンツー","kind":"pow","dist":[1],"power":27,"hit":-15,"guts":20,"crit":8,"gd":2,"start":false},{"id":"sk-0387","name":"影撃","kind":"pow","dist":[3],"power":11,"hit":1,"guts":24,"crit":18,"gd":2,"start":false},{"id":"sk-0388","name":"冷気弾","kind":"wise","dist":[2],"power":16,"hit":-22,"guts":25,"crit":18,"gd":2,"start":false},{"id":"sk-0393","name":"超雷撃","kind":"wise","dist":[1],"power":27,"hit":-9,"guts":20,"crit":8,"gd":26,"start":false},{"id":"sk-0392","name":"コンビネーション","kind":"pow","dist":[2],"power":30,"hit":-19,"guts":23,"crit":12,"gd":2,"start":false},{"id":"sk-0391","name":"空中回転アタック","kind":"pow","dist":[3],"power":27,"hit":14,"guts":27,"crit":15,"gd":2,"start":false},{"id":"sk-0394","name":"雷撃コンボ","kind":"pow","dist":[0],"power":27,"hit":-9,"guts":30,"crit":21,"gd":14,"start":false},{"id":"sk-0395","name":"ブリザード","kind":"wise","dist":[3],"power":24,"hit":-9,"guts":31,"crit":18,"gd":2,"start":false},{"id":"sk-0396","name":"突き刺し","kind":"pow","dist":[2],"power":33,"hit":-9,"guts":33,"crit":21,"gd":2,"start":false},{"id":"sk-0397","name":"落雷共鳴","kind":"pow","dist":[0],"power":49,"hit":1,"guts":50,"crit":18,"gd":2,"start":false},{"id":"sk-0399","name":"終狼咆哮","kind":"pow","dist":[0],"power":33,"hit":7,"guts":46,"crit":18,"gd":26,"start":false},{"id":"sk-0398","name":"ライジングブースト","kind":"wise","dist":[1],"power":33,"hit":1,"guts":51,"crit":21,"gd":2,"start":false}],"regen":13,"dmgMul":0.867,"first":12,"taken":1.06,"size":"S"},"Undine":{"name":"ウンディーネ","apt":["G","D","C","C"],"techs":[{"id":"sk-0477","name":"アイスブレード","kind":"pow","dist":[0],"power":8,"hit":-18,"guts":13,"crit":6,"gd":0,"start":true},{"id":"sk-0475","name":"アクアウェイブ","kind":"wise","dist":[2],"power":8,"hit":2,"guts":17,"crit":8,"gd":0,"start":true},{"id":"sk-0476","name":"アクアウィップ","kind":"pow","dist":[1],"power":8,"hit":-8,"guts":21,"crit":8,"gd":15,"start":false},{"id":"sk-0481","name":"スプラッシュ","kind":"wise","dist":[0],"power":11,"hit":-18,"guts":16,"crit":8,"gd":12,"start":false},{"id":"sk-0478","name":"ダブルバレッド","kind":"wise","dist":[3],"power":11,"hit":2,"guts":19,"crit":10,"gd":0,"start":false},{"id":"sk-0479","name":"アイスアロー","kind":"wise","dist":[2],"power":16,"hit":-8,"guts":23,"crit":18,"gd":7,"start":false},{"id":"sk-0480","name":"アクアキッス","kind":"wise","dist":[1],"power":6,"hit":8,"guts":24,"crit":18,"gd":15,"start":false},{"id":"sk-0484","name":"ドルフィンブロー","kind":"pow","dist":[1],"power":24,"hit":-18,"guts":21,"crit":8,"gd":7,"start":false},{"id":"sk-0483","name":"アイスコフィン","kind":"wise","dist":[2],"power":30,"hit":-23,"guts":23,"crit":10,"gd":5,"start":false},{"id":"sk-0485","name":"ブラッドミスト","kind":"wise","dist":[0],"power":11,"hit":-18,"guts":25,"crit":18,"gd":26,"start":false},{"id":"sk-0482","name":"クリスタルレイン","kind":"wise","dist":[3],"power":24,"hit":2,"guts":31,"crit":18,"gd":0,"start":false},{"id":"sk-0487","name":"アクアブラスト","kind":"wise","dist":[2],"power":16,"hit":15,"guts":26,"crit":10,"gd":15,"start":false},{"id":"sk-0488","name":"ホワイトストーム","kind":"wise","dist":[1],"power":38,"hit":2,"guts":32,"crit":8,"gd":15,"start":false},{"id":"sk-0486","name":"クリスタルアロー","kind":"wise","dist":[3],"power":38,"hit":-8,"guts":33,"crit":27,"gd":5,"start":false},{"id":"sk-0489","name":"アクアウォール","kind":"wise","dist":[0],"power":38,"hit":-8,"guts":34,"crit":12,"gd":0,"start":false},{"id":"sk-0491","name":"アクアドーム","kind":"wise","dist":[1],"power":30,"hit":8,"guts":34,"crit":18,"gd":27,"start":false},{"id":"sk-0490","name":"ホワイトエレジー","kind":"wise","dist":[2],"power":43,"hit":5,"guts":43,"crit":12,"gd":15,"start":false}],"regen":13,"dmgMul":0.867,"first":12,"taken":1.06,"size":"S"},"Yaobikuni":{"name":"ヤオビクニ","apt":["D","B","E","C"],"techs":[{"id":"sk-0477","name":"アイスブレード","kind":"pow","dist":[0],"power":8,"hit":-18,"guts":13,"crit":6,"gd":0,"start":true},{"id":"sk-0475","name":"アクアウェイブ","kind":"wise","dist":[2],"power":8,"hit":2,"guts":17,"crit":8,"gd":0,"start":true},{"id":"sk-0476","name":"アクアウィップ","kind":"pow","dist":[1],"power":8,"hit":-8,"guts":21,"crit":8,"gd":15,"start":false},{"id":"sk-0481","name":"スプラッシュ","kind":"wise","dist":[0],"power":11,"hit":-18,"guts":16,"crit":8,"gd":12,"start":false},{"id":"sk-0478","name":"ダブルバレッド","kind":"wise","dist":[3],"power":11,"hit":2,"guts":19,"crit":10,"gd":0,"start":false},{"id":"sk-0479","name":"アイスアロー","kind":"wise","dist":[2],"power":16,"hit":-8,"guts":23,"crit":18,"gd":7,"start":false},{"id":"sk-0480","name":"アクアキッス","kind":"wise","dist":[1],"power":6,"hit":8,"guts":24,"crit":18,"gd":15,"start":false},{"id":"sk-0484","name":"ドルフィンブロー","kind":"pow","dist":[1],"power":24,"hit":-18,"guts":21,"crit":8,"gd":7,"start":false},{"id":"sk-0483","name":"アイスコフィン","kind":"wise","dist":[2],"power":30,"hit":-23,"guts":23,"crit":10,"gd":5,"start":false},{"id":"sk-0485","name":"ブラッドミスト","kind":"wise","dist":[0],"power":11,"hit":-18,"guts":25,"crit":18,"gd":26,"start":false},{"id":"sk-0482","name":"クリスタルレイン","kind":"wise","dist":[3],"power":24,"hit":2,"guts":31,"crit":18,"gd":0,"start":false},{"id":"sk-0487","name":"アクアブラスト","kind":"wise","dist":[2],"power":16,"hit":15,"guts":26,"crit":10,"gd":15,"start":false},{"id":"sk-0488","name":"ホワイトストーム","kind":"wise","dist":[1],"power":38,"hit":2,"guts":32,"crit":8,"gd":15,"start":false},{"id":"sk-0486","name":"クリスタルアロー","kind":"wise","dist":[3],"power":38,"hit":-8,"guts":33,"crit":27,"gd":5,"start":false},{"id":"sk-0489","name":"アクアウォール","kind":"wise","dist":[0],"power":38,"hit":-8,"guts":34,"crit":12,"gd":0,"start":false},{"id":"sk-0491","name":"アクアドーム","kind":"wise","dist":[1],"power":30,"hit":8,"guts":34,"crit":18,"gd":27,"start":false},{"id":"sk-0490","name":"ホワイトエレジー","kind":"wise","dist":[2],"power":43,"hit":5,"guts":43,"crit":12,"gd":15,"start":false}],"regen":13,"dmgMul":0.867,"first":12,"taken":1.06,"size":"S"},"Yggdrasil":{"name":"ユグドラシル","apt":["B","D","E","A"],"techs":[{"id":"sk-0576","name":"頭突き","kind":"pow","dist":[0],"power":16,"hit":-19,"guts":13,"crit":10,"gd":0,"start":true},{"id":"sk-0573","name":"空中脳天撃","kind":"pow","dist":[3],"power":16,"hit":-3,"guts":16,"crit":10,"gd":5,"start":true},{"id":"sk-0575","name":"スターボム","kind":"wise","dist":[1],"power":11,"hit":-9,"guts":17,"crit":9,"gd":12,"start":false},{"id":"sk-0574","name":"グリーンライト","kind":"wise","dist":[2],"power":8,"hit":7,"guts":19,"crit":6,"gd":5,"start":false},{"id":"sk-0577","name":"ワンダーブレイズ","kind":"wise","dist":[2],"power":11,"hit":-19,"guts":15,"crit":16,"gd":5,"start":false},{"id":"sk-0578","name":"ぴろぴろ舌","kind":"pow","dist":[1],"power":16,"hit":-19,"guts":21,"crit":10,"gd":0,"start":false},{"id":"sk-0579","name":"メニーウィング","kind":"wise","dist":[0],"power":11,"hit":1,"guts":22,"crit":16,"gd":7,"start":false},{"id":"sk-0580","name":"月面水爆","kind":"pow","dist":[3],"power":24,"hit":-15,"guts":26,"crit":16,"gd":5,"start":false},{"id":"sk-0581","name":"大玉転がし","kind":"pow","dist":[2],"power":24,"hit":-22,"guts":26,"crit":23,"gd":12,"start":false},{"id":"sk-0582","name":"メテオストーム","kind":"wise","dist":[1],"power":24,"hit":1,"guts":32,"crit":10,"gd":7,"start":false},{"id":"sk-0585","name":"キャンディボム","kind":"pow","dist":[1],"power":24,"hit":12,"guts":32,"crit":8,"gd":27,"start":false},{"id":"sk-0586","name":"苺大噴","kind":"pow","dist":[0],"power":38,"hit":4,"guts":35,"crit":25,"gd":5,"start":false},{"id":"sk-0584","name":"パピヨンバースト","kind":"wise","dist":[2],"power":38,"hit":7,"guts":38,"crit":16,"gd":7,"start":false},{"id":"sk-0583","name":"ヘビーレイン","kind":"wise","dist":[3],"power":38,"hit":1,"guts":40,"crit":25,"gd":0,"start":false},{"id":"sk-0588","name":"エターナルアーク","kind":"wise","dist":[2],"power":33,"hit":1,"guts":39,"crit":10,"gd":27,"start":false},{"id":"sk-0590","name":"オーロラハック","kind":"wise","dist":[0],"power":51,"hit":-9,"guts":40,"crit":25,"gd":24,"start":false},{"id":"sk-0589","name":"コスモフルーツ","kind":"wise","dist":[1],"power":51,"hit":1,"guts":41,"crit":13,"gd":5,"start":false},{"id":"sk-0587","name":"シャドウレギオン","kind":"pow","dist":[3],"power":38,"hit":12,"guts":42,"crit":16,"gd":12,"start":false}],"regen":12,"dmgMul":0.933,"first":-12,"taken":0.94,"size":"L"},"Zan":{"name":"ザン","apt":["C","A","B","E"],"techs":[{"id":"sk-0797","name":"シングルショット","kind":"pow","dist":[1],"power":24,"hit":0,"guts":19,"crit":8,"gd":1,"start":true},{"id":"sk-0591","name":"ミラージュシフト","kind":"pow","dist":[3],"power":16,"hit":0,"guts":20,"crit":11,"gd":1,"start":true},{"id":"sk-0592","name":"レッグアーク","kind":"pow","dist":[0],"power":11,"hit":-16,"guts":22,"crit":10,"gd":13,"start":false},{"id":"sk-0594","name":"ソニックナイフ","kind":"pow","dist":[2],"power":16,"hit":-4,"guts":24,"crit":18,"gd":1,"start":false},{"id":"sk-0593","name":"スタナーブリッツ","kind":"wise","dist":[3],"power":24,"hit":0,"guts":25,"crit":8,"gd":13,"start":false},{"id":"sk-0595","name":"ダブルサマー","kind":"pow","dist":[0],"power":27,"hit":-10,"guts":27,"crit":12,"gd":1,"start":false},{"id":"sk-0799","name":"フォルターブリッツ","kind":"wise","dist":[1],"power":24,"hit":3,"guts":30,"crit":10,"gd":22,"start":false},{"id":"sk-0798","name":"メテオドライブ","kind":"pow","dist":[3],"power":24,"hit":-10,"guts":33,"crit":25,"gd":6,"start":false},{"id":"sk-0597","name":"ライジングレイヴ","kind":"pow","dist":[0],"power":38,"hit":0,"guts":40,"crit":25,"gd":25,"start":false},{"id":"sk-0596","name":"アサルトレイド","kind":"pow","dist":[2],"power":33,"hit":6,"guts":42,"crit":12,"gd":6,"start":false},{"id":"sk-0599","name":"ダークホウスト","kind":"pow","dist":[1],"power":38,"hit":13,"guts":46,"crit":21,"gd":1,"start":false},{"id":"sk-0598","name":"アクシズバレット","kind":"pow","dist":[3],"power":30,"hit":-20,"guts":48,"crit":27,"gd":1,"start":false}],"regen":13,"dmgMul":0.867,"first":12,"taken":1.06,"size":"M"}},"idmap":{"mocchi_01":"sk-0402","mocchi_02":"sk-0401","mocchi_03":"sk-0404","mocchi_04":"sk-0408","mocchi_05":"sk-0409","mocchi_06":"sk-0403","mocchi_07":"sk-0412","mocchi_08":"sk-0403","suezo_01":"sk-0462","suezo_02":"sk-0461","suezo_03":"sk-0466","suezo_04":"sk-0468","suezo_05":"sk-0464","suezo_06":"sk-0466","suezo_07":"sk-0460","suezo_08":"sk-0467","golem_01":"sk-0293","golem_02":"sk-0294","golem_03":"sk-0294","golem_04":"sk-0292","golem_05":"sk-0302","golem_06":"sk-0303","golem_07":"sk-0305","golem_08":"sk-0301","tiger_01":"sk-0385","tiger_02":"sk-0385","tiger_03":"sk-0384","tiger_04":"sk-0387","tiger_05":"sk-0391","tiger_06":"sk-0388","tiger_07":"sk-0396","tiger_08":"sk-0390","ham_01":"sk-0342","ham_02":"sk-0340","ham_03":"sk-0338","ham_04":"sk-0343","ham_05":"sk-0345","ham_06":"sk-0348","ham_07":"sk-0349","ham_08":"sk-0347","pixie_01":"sk-0260","pixie_02":"sk-0258","pixie_03":"sk-0259","pixie_04":"sk-0264","pixie_05":"sk-0263","pixie_06":"sk-0262","pixie_07":"sk-0261","pixie_08":"sk-0265","mia_01":"sk-0263","mia_02":"sk-0265","mia_03":"sk-0268","mia_04":"sk-0264","mia_05":"sk-0274","mia_06":"sk-0262","mia_07":"sk-0274","mia_08":"sk-0271","pandora_01":"pandora_o01","pandora_02":"pandora_o02","pandora_03":"pandora_o04","pandora_04":"pandora_o08","pandora_05":"pandora_o05","pandora_06":"pandora_o06","pandora_07":"pandora_o07","pandora_08":"pandora_o10","monol_01":"sk-0512","monol_02":"sk-0512","monol_03":"sk-0514","monol_04":"sk-0515","monol_05":"sk-0519","monol_06":"sk-0518","monol_07":"sk-0521","monol_08":"sk-0515","oboro_01":"sk-0448","oboro_02":"sk-0447","oboro_03":"sk-0448","oboro_04":"sk-0450","oboro_05":"sk-0457","oboro_06":"sk-0451","oboro_07":"sk-0824","oboro_08":"sk-0446","plant_01":"sk-0448","plant_02":"sk-0447","plant_03":"sk-0448","plant_04":"sk-0450","plant_05":"sk-0457","plant_06":"sk-0451","plant_07":"sk-0824","plant_08":"sk-0446","zan_01":"sk-0592","zan_02":"sk-0797","zan_03":"sk-0797","zan_04":"sk-0591","zan_05":"sk-0595","zan_06":"sk-0798","zan_07":"sk-0599","zan_08":"sk-0599","eiki_01":"eiki_o01","eiki_02":"eiki_o02","eiki_03":"eiki_o03","eiki_04":"eiki_o04","eiki_05":"eiki_o06","eiki_06":"eiki_o05","eiki_07":"eiki_o07","eiki_08":"eiki_o10","kenshimocchi_01":"kenshimocchi_o01","kenshimocchi_02":"kenshimocchi_o03","kenshimocchi_03":"kenshimocchi_o02","kenshimocchi_04":"kenshimocchi_o06","kenshimocchi_05":"kenshimocchi_o05","kenshimocchi_06":"kenshimocchi_o04","kenshimocchi_07":"kenshimocchi_o09","kenshimocchi_08":"kenshimocchi_o10","mitarashi_01":"sk-0402","mitarashi_02":"sk-0401","mitarashi_03":"sk-0404","mitarashi_04":"sk-0408","mitarashi_05":"sk-0409","mitarashi_06":"sk-0403","mitarashi_07":"sk-0412","mitarashi_08":"sk-0403","ark_01":"sk-0110","ark_02":"sk-0111","ark_03":"sk-0125","ark_04":"sk-0125","ark_05":"sk-0110","ark_06":"sk-0115","ark_07":"sk-0118","ark_08":"sk-0119","iblis_01":"sk-0110","iblis_02":"sk-0111","iblis_03":"sk-0125","iblis_04":"sk-0125","iblis_05":"sk-0110","iblis_06":"sk-0115","iblis_07":"sk-0118","iblis_08":"sk-0119","snegurochka_01":"sk-0477","snegurochka_02":"sk-0476","snegurochka_03":"sk-0475","snegurochka_04":"sk-0485","snegurochka_05":"sk-0484","snegurochka_06":"sk-0481","snegurochka_07":"sk-0743","snegurochka_08":"sk-0479","undine_01":"sk-0477","undine_02":"sk-0476","undine_03":"sk-0475","undine_04":"sk-0485","undine_05":"sk-0484","undine_06":"sk-0481","undine_07":"sk-0490","undine_08":"sk-0479","yaobikuni_01":"sk-0477","yaobikuni_02":"sk-0476","yaobikuni_03":"sk-0475","yaobikuni_04":"sk-0485","yaobikuni_05":"sk-0484","yaobikuni_06":"sk-0481","yaobikuni_07":"sk-0490","yaobikuni_08":"sk-0479","yggdrasil_01":"sk-0576","yggdrasil_02":"sk-0578","yggdrasil_03":"sk-0574","yggdrasil_04":"sk-0585","yggdrasil_05":"sk-0573","yggdrasil_06":"sk-0580","yggdrasil_07":"sk-0581","yggdrasil_08":"sk-0575","melwhip_01":"sk-0576","melwhip_02":"sk-0578","melwhip_03":"sk-0574","melwhip_04":"sk-0585","melwhip_05":"sk-0573","melwhip_06":"sk-0580","melwhip_07":"sk-0581","melwhip_08":"sk-0575","melody_01":"melody_o01","melody_02":"melody_o04","melody_03":"melody_o03","melody_04":"melody_o07","melody_05":"melody_o02","melody_06":"melody_o06","melody_07":"melody_o05","melody_08":"melody_o10","kuromy_01":"kuromy_o01","kuromy_02":"kuromy_o04","kuromy_03":"kuromy_o03","kuromy_04":"kuromy_o07","kuromy_05":"kuromy_o02","kuromy_06":"kuromy_o06","kuromy_07":"kuromy_o05","kuromy_08":"kuromy_o10","ghost_01":"sk-0066","ghost_02":"sk-0078","ghost_03":"sk-0065","ghost_04":"sk-0068","ghost_05":"sk-0072","ghost_06":"sk-0077","ghost_07":"sk-0074","ghost_08":"sk-0070","spooky_01":"sk-0066","spooky_02":"sk-0082","spooky_03":"sk-0065","spooky_04":"sk-0068","spooky_05":"sk-0072","spooky_06":"sk-0077","spooky_07":"sk-0083","spooky_08":"sk-0070","illumine_01":"sk-0045","illumine_02":"sk-0039","illumine_03":"sk-0040","illumine_04":"sk-0064","illumine_05":"sk-0042","illumine_06":"sk-0043","illumine_07":"sk-0054","illumine_08":"sk-0041","dreamy_01":"sk-0045","dreamy_02":"sk-0039","dreamy_03":"sk-0040","dreamy_04":"sk-0040","dreamy_05":"sk-0042","dreamy_06":"sk-0053","dreamy_07":"sk-0042","dreamy_08":"sk-0055","kyubi_01":"sk-0005","kyubi_02":"sk-0004","kyubi_03":"sk-0003","kyubi_04":"sk-0018","kyubi_05":"sk-0010","kyubi_06":"sk-0009","kyubi_07":"sk-0016","kyubi_08":"sk-0028","orihime_01":"sk-0005","orihime_02":"sk-0004","orihime_03":"sk-0003","orihime_04":"sk-0496","orihime_05":"sk-0010","orihime_06":"sk-0009","orihime_07":"sk-0016","orihime_08":"sk-0028"}};
export const MASMON_PVP_LEARN = {"Mocchi":{"sk-0402":{"start":true},"sk-0400":{"start":true},"sk-0401":{"by":"pow","st":{"pow":100}},"sk-0405":{"by":"wise","st":{"wise":150}},"sk-0406":{"by":"pow","st":{"pow":150}},"sk-0403":{"by":"wise","st":{"wise":150}},"sk-0404":{"by":"wise","st":{"wise":150}},"sk-0409":{"by":"pow","st":{"pow":250},"need":{"sk-0406":25}},"sk-0408":{"by":"pow","st":{"pow":250},"need":{"sk-0406":25}},"sk-0407":{"by":"pow","st":{"pow":250},"need":{"sk-0406":25}},"sk-0413":{"by":"pow","st":{"pow":350},"need":{"sk-0409":40}},"sk-0410":{"by":"wise","st":{"wise":350},"need":{"sk-0405":40}},"sk-0411":{"by":"wise","st":{"wise":350},"need":{"sk-0405":40}},"sk-0412":{"by":"pow","st":{"pow":350},"need":{"sk-0409":40}},"sk-0416":{"by":"pow","st":{"pow":450},"need":{"sk-0413":50}},"sk-0415":{"by":"wise","st":{"wise":450},"need":{"sk-0410":50}},"sk-0414":{"by":"wise","st":{"wise":450},"need":{"sk-0410":50}}},"Suezo":{"sk-0461":{"start":true},"sk-0462":{"start":true},"sk-0460":{"by":"pow","st":{"pow":100}},"sk-0463":{"by":"wise","st":{"wise":150}},"sk-0464":{"by":"pow","st":{"pow":150}},"sk-0465":{"by":"wise","st":{"wise":150}},"sk-0468":{"by":"wise","st":{"wise":250},"need":{"sk-0463":25}},"sk-0467":{"by":"wise","st":{"wise":250},"need":{"sk-0463":25}},"sk-0466":{"by":"wise","st":{"wise":250},"need":{"sk-0463":25}},"sk-0469":{"by":"pow","st":{"pow":250},"need":{"sk-0464":25}},"sk-0470":{"by":"wise","st":{"wise":350},"need":{"sk-0468":40}},"sk-0471":{"by":"wise","st":{"wise":350},"need":{"sk-0468":40}},"sk-0473":{"by":"wise","st":{"wise":350},"need":{"sk-0468":40}},"sk-0472":{"by":"pow","st":{"pow":350},"need":{"sk-0469":40}},"sk-0474":{"by":"wise","st":{"wise":450},"need":{"sk-0470":50}}},"Golem":{"sk-0293":{"start":true},"sk-0294":{"start":true},"sk-0292":{"by":"pow","st":{"pow":100}},"sk-0298":{"by":"pow","st":{"pow":150}},"sk-0295":{"by":"wise","st":{"wise":150}},"sk-0296":{"by":"pow","st":{"pow":150}},"sk-0297":{"by":"pow","st":{"pow":150}},"sk-0302":{"by":"pow","st":{"pow":250},"need":{"sk-0298":25}},"sk-0301":{"by":"pow","st":{"pow":250},"need":{"sk-0298":25}},"sk-0300":{"by":"pow","st":{"pow":250},"need":{"sk-0298":25}},"sk-0299":{"by":"pow","st":{"pow":250},"need":{"sk-0298":25}},"sk-0303":{"by":"pow","st":{"pow":350},"need":{"sk-0302":40}},"sk-0305":{"by":"pow","st":{"pow":350},"need":{"sk-0302":40}},"sk-0306":{"by":"pow","st":{"pow":350},"need":{"sk-0302":40}},"sk-0304":{"by":"pow","st":{"pow":350},"need":{"sk-0302":40}},"sk-0307":{"by":"pow","st":{"pow":450},"need":{"sk-0303":50}}},"Tiger":{"sk-0386":{"start":true},"sk-0385":{"start":true},"sk-0384":{"by":"pow","st":{"pow":100}},"sk-0390":{"by":"wise","st":{"wise":150}},"sk-0389":{"by":"pow","st":{"pow":150}},"sk-0387":{"by":"pow","st":{"pow":150}},"sk-0388":{"by":"wise","st":{"wise":150}},"sk-0393":{"by":"wise","st":{"wise":250},"need":{"sk-0390":25}},"sk-0392":{"by":"pow","st":{"pow":250},"need":{"sk-0389":25}},"sk-0391":{"by":"pow","st":{"pow":250},"need":{"sk-0389":25}},"sk-0394":{"by":"pow","st":{"pow":250},"need":{"sk-0389":25}},"sk-0395":{"by":"wise","st":{"wise":350},"need":{"sk-0393":40}},"sk-0396":{"by":"pow","st":{"pow":350},"need":{"sk-0392":40}},"sk-0397":{"by":"pow","st":{"pow":350},"need":{"sk-0392":40}},"sk-0399":{"by":"pow","st":{"pow":450},"need":{"sk-0396":50}},"sk-0398":{"by":"wise","st":{"wise":450},"need":{"sk-0395":50}}},"Ham":{"sk-0339":{"start":true},"sk-0340":{"start":true},"sk-0338":{"by":"pow","st":{"pow":100}},"sk-0343":{"by":"wise","st":{"wise":150}},"sk-0341":{"by":"pow","st":{"pow":150}},"sk-0342":{"by":"pow","st":{"pow":150}},"sk-0346":{"by":"pow","st":{"pow":250},"need":{"sk-0341":25}},"sk-0347":{"by":"wise","st":{"wise":250},"need":{"sk-0343":25}},"sk-0344":{"by":"pow","st":{"pow":250},"need":{"sk-0341":25}},"sk-0345":{"by":"pow","st":{"pow":250},"need":{"sk-0341":25}},"sk-0350":{"by":"pow","st":{"pow":350},"need":{"sk-0346":40}},"sk-0348":{"by":"pow","st":{"pow":350},"need":{"sk-0346":40}},"sk-0349":{"by":"pow","st":{"pow":350},"need":{"sk-0346":40}},"sk-0351":{"by":"pow","st":{"pow":350},"need":{"sk-0346":40}}},"Pixie":{"sk-0260":{"start":true},"sk-0259":{"start":true},"sk-0258":{"by":"wise","st":{"wise":100}},"sk-0263":{"by":"pow","st":{"pow":150}},"sk-0262":{"by":"wise","st":{"wise":150}},"sk-0261":{"by":"wise","st":{"wise":150}},"sk-0264":{"by":"wise","st":{"wise":250},"need":{"sk-0262":25}},"sk-0266":{"by":"pow","st":{"pow":250},"need":{"sk-0263":25}},"sk-0265":{"by":"wise","st":{"wise":250},"need":{"sk-0262":25}},"sk-0267":{"by":"wise","st":{"wise":350},"need":{"sk-0264":40}},"sk-0270":{"by":"pow","st":{"pow":350},"need":{"sk-0266":40}},"sk-0268":{"by":"wise","st":{"wise":350},"need":{"sk-0264":40}},"sk-0269":{"by":"wise","st":{"wise":350},"need":{"sk-0264":40}},"sk-0274":{"by":"wise","st":{"wise":450},"need":{"sk-0267":50}},"sk-0273":{"by":"pow","st":{"pow":450},"need":{"sk-0270":50}},"sk-0272":{"by":"wise","st":{"wise":450},"need":{"sk-0267":50}},"sk-0271":{"by":"wise","st":{"wise":450},"need":{"sk-0267":50}}},"Mia":{"sk-0260":{"start":true},"sk-0259":{"start":true},"sk-0258":{"by":"wise","st":{"wise":100}},"sk-0263":{"by":"pow","st":{"pow":150}},"sk-0262":{"by":"wise","st":{"wise":150}},"sk-0261":{"by":"wise","st":{"wise":150}},"sk-0264":{"by":"wise","st":{"wise":250},"need":{"sk-0262":25}},"sk-0266":{"by":"pow","st":{"pow":250},"need":{"sk-0263":25}},"sk-0265":{"by":"wise","st":{"wise":250},"need":{"sk-0262":25}},"sk-0267":{"by":"wise","st":{"wise":350},"need":{"sk-0264":40}},"sk-0270":{"by":"pow","st":{"pow":350},"need":{"sk-0266":40}},"sk-0268":{"by":"wise","st":{"wise":350},"need":{"sk-0264":40}},"sk-0269":{"by":"wise","st":{"wise":350},"need":{"sk-0264":40}},"sk-0274":{"by":"wise","st":{"wise":450},"need":{"sk-0267":50}},"sk-0273":{"by":"pow","st":{"pow":450},"need":{"sk-0270":50}},"sk-0272":{"by":"wise","st":{"wise":450},"need":{"sk-0267":50}},"sk-0271":{"by":"wise","st":{"wise":450},"need":{"sk-0267":50}}},"Monol":{"sk-0513":{"start":true},"sk-0512":{"start":true},"sk-0511":{"by":"wise","st":{"wise":100}},"sk-0516":{"by":"pow","st":{"pow":150}},"sk-0517":{"by":"pow","st":{"pow":150}},"sk-0514":{"by":"pow","st":{"pow":150}},"sk-0515":{"by":"wise","st":{"wise":150}},"sk-0519":{"by":"pow","st":{"pow":250},"need":{"sk-0516":25}},"sk-0520":{"by":"wise","st":{"wise":250},"need":{"sk-0515":25}},"sk-0518":{"by":"wise","st":{"wise":250},"need":{"sk-0515":25}},"sk-0521":{"by":"pow","st":{"pow":250},"need":{"sk-0516":25}},"sk-0524":{"by":"wise","st":{"wise":350},"need":{"sk-0520":40}},"sk-0522":{"by":"wise","st":{"wise":350},"need":{"sk-0520":40}},"sk-0523":{"by":"pow","st":{"pow":350},"need":{"sk-0519":40}},"sk-0526":{"by":"pow","st":{"pow":450},"need":{"sk-0523":50}},"sk-0525":{"by":"wise","st":{"wise":450},"need":{"sk-0524":50}}},"Oboro":{"sk-0447":{"start":true},"sk-0448":{"start":true},"sk-0446":{"by":"wise","st":{"wise":100}},"sk-0452":{"by":"pow","st":{"pow":150}},"sk-0449":{"by":"wise","st":{"wise":150}},"sk-0450":{"by":"wise","st":{"wise":150}},"sk-0451":{"by":"wise","st":{"wise":150}},"sk-0455":{"by":"pow","st":{"pow":250},"need":{"sk-0452":25}},"sk-0454":{"by":"wise","st":{"wise":250},"need":{"sk-0449":25}},"sk-0453":{"by":"wise","st":{"wise":250},"need":{"sk-0449":25}},"sk-0459":{"by":"wise","st":{"wise":350},"need":{"sk-0454":40}},"sk-0458":{"by":"pow","st":{"pow":350},"need":{"sk-0455":40}},"sk-0456":{"by":"wise","st":{"wise":350},"need":{"sk-0454":40}},"sk-0457":{"by":"pow","st":{"pow":350},"need":{"sk-0455":40}},"sk-0824":{"by":"pow","st":{"pow":450},"need":{"sk-0458":50}}},"Plant":{"sk-0447":{"start":true},"sk-0448":{"start":true},"sk-0446":{"by":"wise","st":{"wise":100}},"sk-0452":{"by":"pow","st":{"pow":150}},"sk-0449":{"by":"wise","st":{"wise":150}},"sk-0450":{"by":"wise","st":{"wise":150}},"sk-0451":{"by":"wise","st":{"wise":150}},"sk-0455":{"by":"pow","st":{"pow":250},"need":{"sk-0452":25}},"sk-0454":{"by":"wise","st":{"wise":250},"need":{"sk-0449":25}},"sk-0453":{"by":"wise","st":{"wise":250},"need":{"sk-0449":25}},"sk-0459":{"by":"wise","st":{"wise":350},"need":{"sk-0454":40}},"sk-0458":{"by":"pow","st":{"pow":350},"need":{"sk-0455":40}},"sk-0456":{"by":"wise","st":{"wise":350},"need":{"sk-0454":40}},"sk-0457":{"by":"pow","st":{"pow":350},"need":{"sk-0455":40}},"sk-0824":{"by":"pow","st":{"pow":450},"need":{"sk-0458":50}}},"Zan":{"sk-0797":{"start":true},"sk-0591":{"start":true},"sk-0592":{"by":"pow","st":{"pow":100}},"sk-0594":{"by":"pow","st":{"pow":150}},"sk-0593":{"by":"wise","st":{"wise":150}},"sk-0595":{"by":"pow","st":{"pow":150}},"sk-0799":{"by":"wise","st":{"wise":250},"need":{"sk-0593":25}},"sk-0798":{"by":"pow","st":{"pow":250},"need":{"sk-0594":25}},"sk-0597":{"by":"pow","st":{"pow":350},"need":{"sk-0798":40}},"sk-0596":{"by":"pow","st":{"pow":350},"need":{"sk-0798":40}},"sk-0599":{"by":"pow","st":{"pow":450},"need":{"sk-0597":50}},"sk-0598":{"by":"pow","st":{"pow":450},"need":{"sk-0597":50}}},"Mitarashi":{"sk-0402":{"start":true},"sk-0400":{"start":true},"sk-0401":{"by":"pow","st":{"pow":100}},"sk-0405":{"by":"wise","st":{"wise":150}},"sk-0406":{"by":"pow","st":{"pow":150}},"sk-0403":{"by":"wise","st":{"wise":150}},"sk-0404":{"by":"wise","st":{"wise":150}},"sk-0409":{"by":"pow","st":{"pow":250},"need":{"sk-0406":25}},"sk-0408":{"by":"pow","st":{"pow":250},"need":{"sk-0406":25}},"sk-0407":{"by":"pow","st":{"pow":250},"need":{"sk-0406":25}},"sk-0413":{"by":"pow","st":{"pow":350},"need":{"sk-0409":40}},"sk-0410":{"by":"wise","st":{"wise":350},"need":{"sk-0405":40}},"sk-0411":{"by":"wise","st":{"wise":350},"need":{"sk-0405":40}},"sk-0412":{"by":"pow","st":{"pow":350},"need":{"sk-0409":40}},"sk-0416":{"by":"pow","st":{"pow":450},"need":{"sk-0413":50}},"sk-0415":{"by":"wise","st":{"wise":450},"need":{"sk-0410":50}},"sk-0414":{"by":"wise","st":{"wise":450},"need":{"sk-0410":50}}},"Ark":{"sk-0125":{"start":true},"sk-0111":{"start":true},"sk-0110":{"by":"pow","st":{"pow":100}},"sk-0113":{"by":"wise","st":{"wise":150}},"sk-0114":{"by":"wise","st":{"wise":150}},"sk-0112":{"by":"wise","st":{"wise":150}},"sk-0115":{"by":"wise","st":{"wise":250},"need":{"sk-0113":25}},"sk-0118":{"by":"wise","st":{"wise":250},"need":{"sk-0113":25}},"sk-0117":{"by":"wise","st":{"wise":250},"need":{"sk-0113":25}},"sk-0116":{"by":"wise","st":{"wise":250},"need":{"sk-0113":25}},"sk-0120":{"by":"wise","st":{"wise":350},"need":{"sk-0115":40}},"sk-0119":{"by":"wise","st":{"wise":350},"need":{"sk-0115":40}},"sk-0122":{"by":"wise","st":{"wise":450},"need":{"sk-0120":50}},"sk-0124":{"by":"wise","st":{"wise":450},"need":{"sk-0120":50}},"sk-0123":{"by":"wise","st":{"wise":450},"need":{"sk-0120":50}},"sk-0121":{"by":"wise","st":{"wise":450},"need":{"sk-0120":50}},"sk-0129":{"by":"wise","st":{"wise":450},"need":{"sk-0120":50}}},"Iblis":{"sk-0125":{"start":true},"sk-0111":{"start":true},"sk-0110":{"by":"pow","st":{"pow":100}},"sk-0113":{"by":"wise","st":{"wise":150}},"sk-0114":{"by":"wise","st":{"wise":150}},"sk-0112":{"by":"wise","st":{"wise":150}},"sk-0115":{"by":"wise","st":{"wise":250},"need":{"sk-0113":25}},"sk-0118":{"by":"wise","st":{"wise":250},"need":{"sk-0113":25}},"sk-0117":{"by":"wise","st":{"wise":250},"need":{"sk-0113":25}},"sk-0116":{"by":"wise","st":{"wise":250},"need":{"sk-0113":25}},"sk-0120":{"by":"wise","st":{"wise":350},"need":{"sk-0115":40}},"sk-0119":{"by":"wise","st":{"wise":350},"need":{"sk-0115":40}},"sk-0122":{"by":"wise","st":{"wise":450},"need":{"sk-0120":50}},"sk-0124":{"by":"wise","st":{"wise":450},"need":{"sk-0120":50}},"sk-0123":{"by":"wise","st":{"wise":450},"need":{"sk-0120":50}},"sk-0121":{"by":"wise","st":{"wise":450},"need":{"sk-0120":50}},"sk-0129":{"by":"wise","st":{"wise":450},"need":{"sk-0120":50}}},"Snegurochka":{"sk-0477":{"start":true},"sk-0475":{"start":true},"sk-0476":{"by":"pow","st":{"pow":100}},"sk-0481":{"by":"wise","st":{"wise":150}},"sk-0478":{"by":"wise","st":{"wise":150}},"sk-0742":{"by":"wise","st":{"wise":150}},"sk-0479":{"by":"wise","st":{"wise":150}},"sk-0480":{"by":"wise","st":{"wise":150}},"sk-0484":{"by":"pow","st":{"pow":250},"need":{"sk-0477":25}},"sk-0483":{"by":"wise","st":{"wise":250},"need":{"sk-0481":25}},"sk-0485":{"by":"wise","st":{"wise":250},"need":{"sk-0481":25}},"sk-0743":{"by":"wise","st":{"wise":250},"need":{"sk-0481":25}},"sk-0482":{"by":"wise","st":{"wise":250},"need":{"sk-0481":25}},"sk-0487":{"by":"wise","st":{"wise":350},"need":{"sk-0483":40}},"sk-0488":{"by":"wise","st":{"wise":350},"need":{"sk-0483":40}},"sk-0486":{"by":"wise","st":{"wise":350},"need":{"sk-0483":40}},"sk-0489":{"by":"wise","st":{"wise":350},"need":{"sk-0483":40}},"sk-0744":{"by":"wise","st":{"wise":350},"need":{"sk-0483":40}},"sk-0491":{"by":"wise","st":{"wise":450},"need":{"sk-0487":50}},"sk-0490":{"by":"wise","st":{"wise":450},"need":{"sk-0487":50}}},"Undine":{"sk-0477":{"start":true},"sk-0475":{"start":true},"sk-0476":{"by":"pow","st":{"pow":100}},"sk-0481":{"by":"wise","st":{"wise":150}},"sk-0478":{"by":"wise","st":{"wise":150}},"sk-0479":{"by":"wise","st":{"wise":150}},"sk-0480":{"by":"wise","st":{"wise":150}},"sk-0484":{"by":"pow","st":{"pow":250},"need":{"sk-0477":25}},"sk-0483":{"by":"wise","st":{"wise":250},"need":{"sk-0481":25}},"sk-0485":{"by":"wise","st":{"wise":250},"need":{"sk-0481":25}},"sk-0482":{"by":"wise","st":{"wise":250},"need":{"sk-0481":25}},"sk-0487":{"by":"wise","st":{"wise":350},"need":{"sk-0483":40}},"sk-0488":{"by":"wise","st":{"wise":350},"need":{"sk-0483":40}},"sk-0486":{"by":"wise","st":{"wise":350},"need":{"sk-0483":40}},"sk-0489":{"by":"wise","st":{"wise":350},"need":{"sk-0483":40}},"sk-0491":{"by":"wise","st":{"wise":450},"need":{"sk-0487":50}},"sk-0490":{"by":"wise","st":{"wise":450},"need":{"sk-0487":50}}},"Yaobikuni":{"sk-0477":{"start":true},"sk-0475":{"start":true},"sk-0476":{"by":"pow","st":{"pow":100}},"sk-0481":{"by":"wise","st":{"wise":150}},"sk-0478":{"by":"wise","st":{"wise":150}},"sk-0479":{"by":"wise","st":{"wise":150}},"sk-0480":{"by":"wise","st":{"wise":150}},"sk-0484":{"by":"pow","st":{"pow":250},"need":{"sk-0477":25}},"sk-0483":{"by":"wise","st":{"wise":250},"need":{"sk-0481":25}},"sk-0485":{"by":"wise","st":{"wise":250},"need":{"sk-0481":25}},"sk-0482":{"by":"wise","st":{"wise":250},"need":{"sk-0481":25}},"sk-0487":{"by":"wise","st":{"wise":350},"need":{"sk-0483":40}},"sk-0488":{"by":"wise","st":{"wise":350},"need":{"sk-0483":40}},"sk-0486":{"by":"wise","st":{"wise":350},"need":{"sk-0483":40}},"sk-0489":{"by":"wise","st":{"wise":350},"need":{"sk-0483":40}},"sk-0491":{"by":"wise","st":{"wise":450},"need":{"sk-0487":50}},"sk-0490":{"by":"wise","st":{"wise":450},"need":{"sk-0487":50}}},"Yggdrasil":{"sk-0576":{"start":true},"sk-0573":{"start":true},"sk-0575":{"by":"wise","st":{"wise":100}},"sk-0574":{"by":"wise","st":{"wise":100}},"sk-0577":{"by":"wise","st":{"wise":150}},"sk-0578":{"by":"pow","st":{"pow":150}},"sk-0579":{"by":"wise","st":{"wise":150}},"sk-0580":{"by":"pow","st":{"pow":250},"need":{"sk-0578":25}},"sk-0581":{"by":"pow","st":{"pow":250},"need":{"sk-0578":25}},"sk-0582":{"by":"wise","st":{"wise":250},"need":{"sk-0577":25}},"sk-0585":{"by":"pow","st":{"pow":350},"need":{"sk-0580":40}},"sk-0586":{"by":"pow","st":{"pow":350},"need":{"sk-0580":40}},"sk-0584":{"by":"wise","st":{"wise":350},"need":{"sk-0582":40}},"sk-0583":{"by":"wise","st":{"wise":350},"need":{"sk-0582":40}},"sk-0588":{"by":"wise","st":{"wise":450},"need":{"sk-0584":50}},"sk-0590":{"by":"wise","st":{"wise":450},"need":{"sk-0584":50}},"sk-0589":{"by":"wise","st":{"wise":450},"need":{"sk-0584":50}},"sk-0587":{"by":"pow","st":{"pow":450},"need":{"sk-0585":50}}},"MelWhip":{"sk-0576":{"start":true},"sk-0573":{"start":true},"sk-0575":{"by":"wise","st":{"wise":100}},"sk-0574":{"by":"wise","st":{"wise":100}},"sk-0577":{"by":"wise","st":{"wise":150}},"sk-0578":{"by":"pow","st":{"pow":150}},"sk-0579":{"by":"wise","st":{"wise":150}},"sk-0785":{"by":"wise","st":{"wise":150}},"sk-0787":{"by":"wise","st":{"wise":150}},"sk-0580":{"by":"pow","st":{"pow":250},"need":{"sk-0578":25}},"sk-0581":{"by":"pow","st":{"pow":250},"need":{"sk-0578":25}},"sk-0582":{"by":"wise","st":{"wise":250},"need":{"sk-0577":25}},"sk-0585":{"by":"pow","st":{"pow":350},"need":{"sk-0580":40}},"sk-0586":{"by":"pow","st":{"pow":350},"need":{"sk-0580":40}},"sk-0584":{"by":"wise","st":{"wise":350},"need":{"sk-0582":40}},"sk-0583":{"by":"wise","st":{"wise":350},"need":{"sk-0582":40}},"sk-0788":{"by":"pow","st":{"pow":350},"need":{"sk-0580":40}},"sk-0588":{"by":"wise","st":{"wise":450},"need":{"sk-0584":50}},"sk-0590":{"by":"wise","st":{"wise":450},"need":{"sk-0584":50}},"sk-0589":{"by":"wise","st":{"wise":450},"need":{"sk-0584":50}},"sk-0587":{"by":"pow","st":{"pow":450},"need":{"sk-0585":50}}},"Ghost":{"sk-0065":{"start":true},"sk-0066":{"start":true},"sk-0077":{"by":"wise","st":{"wise":100}},"sk-0068":{"by":"wise","st":{"wise":150}},"sk-0069":{"by":"pow","st":{"pow":150}},"sk-0078":{"by":"wise","st":{"wise":150}},"sk-0067":{"by":"wise","st":{"wise":150}},"sk-0070":{"by":"wise","st":{"wise":250},"need":{"sk-0068":25}},"sk-0071":{"by":"wise","st":{"wise":250},"need":{"sk-0068":25}},"sk-0072":{"by":"pow","st":{"pow":250},"need":{"sk-0069":25}},"sk-0073":{"by":"wise","st":{"wise":350},"need":{"sk-0070":40}},"sk-0080":{"by":"wise","st":{"wise":350},"need":{"sk-0070":40}},"sk-0079":{"by":"wise","st":{"wise":350},"need":{"sk-0070":40}},"sk-0074":{"by":"pow","st":{"pow":350},"need":{"sk-0072":40}},"sk-0075":{"by":"wise","st":{"wise":450},"need":{"sk-0073":50}},"sk-0084":{"by":"wise","st":{"wise":450},"need":{"sk-0073":50}},"sk-0076":{"by":"wise","st":{"wise":450},"need":{"sk-0073":50}}},"Spooky":{"sk-0065":{"start":true},"sk-0066":{"start":true},"sk-0077":{"by":"wise","st":{"wise":100}},"sk-0068":{"by":"wise","st":{"wise":150}},"sk-0069":{"by":"pow","st":{"pow":150}},"sk-0078":{"by":"wise","st":{"wise":150}},"sk-0067":{"by":"wise","st":{"wise":150}},"sk-0082":{"by":"wise","st":{"wise":150}},"sk-0070":{"by":"wise","st":{"wise":250},"need":{"sk-0068":25}},"sk-0071":{"by":"wise","st":{"wise":250},"need":{"sk-0068":25}},"sk-0072":{"by":"pow","st":{"pow":250},"need":{"sk-0069":25}},"sk-0073":{"by":"wise","st":{"wise":350},"need":{"sk-0070":40}},"sk-0080":{"by":"wise","st":{"wise":350},"need":{"sk-0070":40}},"sk-0079":{"by":"wise","st":{"wise":350},"need":{"sk-0070":40}},"sk-0074":{"by":"pow","st":{"pow":350},"need":{"sk-0072":40}},"sk-0083":{"by":"pow","st":{"pow":350},"need":{"sk-0072":40}},"sk-0075":{"by":"wise","st":{"wise":450},"need":{"sk-0073":50}},"sk-0084":{"by":"wise","st":{"wise":450},"need":{"sk-0073":50}},"sk-0076":{"by":"wise","st":{"wise":450},"need":{"sk-0073":50}}},"Illumine":{"sk-0040":{"start":true},"sk-0039":{"start":true},"sk-0053":{"by":"pow","st":{"pow":100}},"sk-0064":{"by":"pow","st":{"pow":150}},"sk-0041":{"by":"wise","st":{"wise":150}},"sk-0042":{"by":"pow","st":{"pow":150}},"sk-0045":{"by":"pow","st":{"pow":250},"need":{"sk-0064":25}},"sk-0046":{"by":"pow","st":{"pow":250},"need":{"sk-0064":25}},"sk-0044":{"by":"wise","st":{"wise":250},"need":{"sk-0041":25}},"sk-0043":{"by":"pow","st":{"pow":250},"need":{"sk-0064":25}},"sk-0047":{"by":"pow","st":{"pow":350},"need":{"sk-0045":40}},"sk-0048":{"by":"pow","st":{"pow":350},"need":{"sk-0045":40}},"sk-0049":{"by":"pow","st":{"pow":350},"need":{"sk-0045":40}},"sk-0054":{"by":"pow","st":{"pow":350},"need":{"sk-0045":40}},"sk-0050":{"by":"pow","st":{"pow":450},"need":{"sk-0047":50}},"sk-0052":{"by":"pow","st":{"pow":450},"need":{"sk-0047":50}},"sk-0051":{"by":"pow","st":{"pow":450},"need":{"sk-0047":50}}},"Dreamy":{"sk-0040":{"start":true},"sk-0039":{"start":true},"sk-0053":{"by":"pow","st":{"pow":100}},"sk-0055":{"by":"pow","st":{"pow":100}},"sk-0064":{"by":"pow","st":{"pow":150}},"sk-0041":{"by":"wise","st":{"wise":150}},"sk-0042":{"by":"pow","st":{"pow":150}},"sk-0045":{"by":"pow","st":{"pow":250},"need":{"sk-0064":25}},"sk-0046":{"by":"pow","st":{"pow":250},"need":{"sk-0064":25}},"sk-0044":{"by":"wise","st":{"wise":250},"need":{"sk-0041":25}},"sk-0043":{"by":"pow","st":{"pow":250},"need":{"sk-0064":25}},"sk-0047":{"by":"pow","st":{"pow":350},"need":{"sk-0045":40}},"sk-0048":{"by":"pow","st":{"pow":350},"need":{"sk-0045":40}},"sk-0049":{"by":"pow","st":{"pow":350},"need":{"sk-0045":40}},"sk-0054":{"by":"pow","st":{"pow":350},"need":{"sk-0045":40}},"sk-0050":{"by":"pow","st":{"pow":450},"need":{"sk-0047":50}},"sk-0052":{"by":"pow","st":{"pow":450},"need":{"sk-0047":50}},"sk-0051":{"by":"pow","st":{"pow":450},"need":{"sk-0047":50}}},"Kyubi":{"sk-0005":{"start":true},"sk-0003":{"start":true},"sk-0001":{"by":"wise","st":{"wise":100}},"sk-0004":{"by":"wise","st":{"wise":100}},"sk-0010":{"by":"pow","st":{"pow":150}},"sk-0008":{"by":"pow","st":{"pow":150}},"sk-0009":{"by":"pow","st":{"pow":150}},"sk-0018":{"by":"wise","st":{"wise":250},"need":{"sk-0003":25}},"sk-0015":{"by":"wise","st":{"wise":250},"need":{"sk-0003":25}},"sk-0017":{"by":"wise","st":{"wise":250},"need":{"sk-0003":25}},"sk-0016":{"by":"wise","st":{"wise":250},"need":{"sk-0003":25}},"sk-0026":{"by":"pow","st":{"pow":350},"need":{"sk-0010":40}},"sk-0027":{"by":"wise","st":{"wise":350},"need":{"sk-0018":40}},"sk-0028":{"by":"wise","st":{"wise":350},"need":{"sk-0018":40}},"sk-0025":{"by":"wise","st":{"wise":350},"need":{"sk-0018":40}},"sk-0037":{"by":"wise","st":{"wise":450},"need":{"sk-0027":50}},"sk-0036":{"by":"wise","st":{"wise":450},"need":{"sk-0027":50}},"sk-0002":{"by":"wise","st":{"wise":450},"need":{"sk-0027":50}},"sk-0035":{"by":"wise","st":{"wise":450},"need":{"sk-0027":50}}},"Orihime":{"sk-0005":{"start":true},"sk-0003":{"start":true},"sk-0001":{"by":"wise","st":{"wise":100}},"sk-0004":{"by":"wise","st":{"wise":100}},"sk-0010":{"by":"pow","st":{"pow":150}},"sk-0008":{"by":"pow","st":{"pow":150}},"sk-0009":{"by":"pow","st":{"pow":150}},"sk-0496":{"by":"wise","st":{"wise":250},"need":{"sk-0003":25}},"sk-0023":{"by":"wise","st":{"wise":250},"need":{"sk-0003":25}},"sk-0018":{"by":"wise","st":{"wise":250},"need":{"sk-0003":25}},"sk-0015":{"by":"wise","st":{"wise":250},"need":{"sk-0003":25}},"sk-0017":{"by":"wise","st":{"wise":250},"need":{"sk-0003":25}},"sk-0016":{"by":"wise","st":{"wise":250},"need":{"sk-0003":25}},"sk-0026":{"by":"pow","st":{"pow":350},"need":{"sk-0010":40}},"sk-0027":{"by":"wise","st":{"wise":350},"need":{"sk-0496":40}},"sk-0028":{"by":"wise","st":{"wise":350},"need":{"sk-0496":40}},"sk-0025":{"by":"wise","st":{"wise":350},"need":{"sk-0496":40}},"sk-0037":{"by":"wise","st":{"wise":450},"need":{"sk-0027":50}},"sk-0036":{"by":"wise","st":{"wise":450},"need":{"sk-0027":50}},"sk-0002":{"by":"wise","st":{"wise":450},"need":{"sk-0027":50}},"sk-0035":{"by":"wise","st":{"wise":450},"need":{"sk-0027":50}}},"Pandora":{"pandora_o01":{"start":true},"pandora_o02":{"start":true},"pandora_o03":{"by":"wise","st":{"wise":100}},"pandora_o04":{"by":"pow","st":{"pow":100}},"pandora_o05":{"by":"pow","st":{"pow":100}},"pandora_o06":{"by":"wise","st":{"wise":150}},"pandora_o07":{"by":"wise","st":{"wise":150}},"pandora_o08":{"by":"wise","st":{"wise":250},"need":{"pandora_o06":25}},"pandora_o09":{"by":"wise","st":{"wise":350},"need":{"pandora_o08":40}},"pandora_o10":{"by":"wise","st":{"wise":100}},"pandora_o11":{"by":"wise","st":{"wise":150}},"pandora_o12":{"by":"wise","st":{"wise":250},"need":{"pandora_o06":25}},"pandora_o13":{"by":"wise","st":{"wise":250},"need":{"pandora_o06":25}},"pandora_o14":{"by":"wise","st":{"wise":350},"need":{"pandora_o08":40}},"pandora_o15":{"by":"wise","st":{"wise":350},"need":{"pandora_o08":40}},"pandora_o16":{"by":"wise","st":{"wise":450},"need":{"pandora_o09":50}},"pandora_o17":{"by":"wise","st":{"wise":450},"need":{"pandora_o09":50}},"pandora_o18":{"by":"wise","st":{"wise":450},"need":{"pandora_o09":50}}},"Eiki":{"eiki_o01":{"start":true},"eiki_o02":{"start":true},"eiki_o03":{"by":"wise","st":{"wise":100}},"eiki_o04":{"by":"pow","st":{"pow":100}},"eiki_o05":{"by":"pow","st":{"pow":100}},"eiki_o06":{"by":"wise","st":{"wise":150}},"eiki_o07":{"by":"pow","st":{"pow":150}},"eiki_o08":{"by":"pow","st":{"pow":250},"need":{"eiki_o07":25}},"eiki_o09":{"by":"pow","st":{"pow":350},"need":{"eiki_o08":40}},"eiki_o10":{"by":"pow","st":{"pow":100}},"eiki_o11":{"by":"pow","st":{"pow":150}},"eiki_o12":{"by":"pow","st":{"pow":250},"need":{"eiki_o07":25}},"eiki_o13":{"by":"pow","st":{"pow":250},"need":{"eiki_o07":25}},"eiki_o14":{"by":"pow","st":{"pow":350},"need":{"eiki_o08":40}},"eiki_o15":{"by":"wise","st":{"wise":350},"need":{"eiki_o06":40}},"eiki_o16":{"by":"pow","st":{"pow":450},"need":{"eiki_o09":50}},"eiki_o17":{"by":"pow","st":{"pow":450},"need":{"eiki_o09":50}},"eiki_o18":{"by":"pow","st":{"pow":450},"need":{"eiki_o09":50}}},"KenshiMocchi":{"kenshimocchi_o01":{"start":true},"kenshimocchi_o02":{"start":true},"kenshimocchi_o03":{"by":"pow","st":{"pow":100}},"kenshimocchi_o04":{"by":"pow","st":{"pow":100}},"kenshimocchi_o05":{"by":"pow","st":{"pow":100}},"kenshimocchi_o06":{"by":"wise","st":{"wise":100}},"kenshimocchi_o07":{"by":"pow","st":{"pow":150}},"kenshimocchi_o08":{"by":"wise","st":{"wise":250},"need":{"kenshimocchi_o06":25}},"kenshimocchi_o09":{"by":"pow","st":{"pow":250},"need":{"kenshimocchi_o07":25}},"kenshimocchi_o10":{"by":"pow","st":{"pow":150}},"kenshimocchi_o11":{"by":"pow","st":{"pow":150}},"kenshimocchi_o12":{"by":"pow","st":{"pow":250},"need":{"kenshimocchi_o07":25}},"kenshimocchi_o13":{"by":"pow","st":{"pow":350},"need":{"kenshimocchi_o09":40}},"kenshimocchi_o14":{"by":"wise","st":{"wise":350},"need":{"kenshimocchi_o08":40}},"kenshimocchi_o15":{"by":"pow","st":{"pow":350},"need":{"kenshimocchi_o09":40}},"kenshimocchi_o16":{"by":"pow","st":{"pow":450},"need":{"kenshimocchi_o13":50}},"kenshimocchi_o17":{"by":"pow","st":{"pow":450},"need":{"kenshimocchi_o13":50}},"kenshimocchi_o18":{"by":"pow","st":{"pow":450},"need":{"kenshimocchi_o13":50}}},"Melody":{"melody_o01":{"start":true},"melody_o02":{"start":true},"melody_o03":{"by":"wise","st":{"wise":100}},"melody_o04":{"by":"pow","st":{"pow":100}},"melody_o05":{"by":"pow","st":{"pow":100}},"melody_o06":{"by":"pow","st":{"pow":150}},"melody_o07":{"by":"wise","st":{"wise":150}},"melody_o08":{"by":"wise","st":{"wise":250},"need":{"melody_o07":25}},"melody_o09":{"by":"wise","st":{"wise":350},"need":{"melody_o08":40}},"melody_o10":{"by":"wise","st":{"wise":100}},"melody_o11":{"by":"wise","st":{"wise":150}},"melody_o12":{"by":"wise","st":{"wise":250},"need":{"melody_o07":25}},"melody_o13":{"by":"wise","st":{"wise":250},"need":{"melody_o07":25}},"melody_o14":{"by":"wise","st":{"wise":350},"need":{"melody_o08":40}},"melody_o15":{"by":"wise","st":{"wise":350},"need":{"melody_o08":40}},"melody_o16":{"by":"wise","st":{"wise":450},"need":{"melody_o09":50}},"melody_o17":{"by":"wise","st":{"wise":450},"need":{"melody_o09":50}},"melody_o18":{"by":"wise","st":{"wise":450},"need":{"melody_o09":50}}},"Kuromy":{"kuromy_o01":{"start":true},"kuromy_o02":{"start":true},"kuromy_o03":{"by":"wise","st":{"wise":100}},"kuromy_o04":{"by":"pow","st":{"pow":100}},"kuromy_o05":{"by":"pow","st":{"pow":100}},"kuromy_o06":{"by":"pow","st":{"pow":150}},"kuromy_o07":{"by":"wise","st":{"wise":150}},"kuromy_o08":{"by":"wise","st":{"wise":250},"need":{"kuromy_o07":25}},"kuromy_o09":{"by":"wise","st":{"wise":350},"need":{"kuromy_o08":40}},"kuromy_o10":{"by":"wise","st":{"wise":100}},"kuromy_o11":{"by":"pow","st":{"pow":150}},"kuromy_o12":{"by":"wise","st":{"wise":250},"need":{"kuromy_o07":25}},"kuromy_o13":{"by":"wise","st":{"wise":250},"need":{"kuromy_o07":25}},"kuromy_o14":{"by":"wise","st":{"wise":350},"need":{"kuromy_o08":40}},"kuromy_o15":{"by":"wise","st":{"wise":350},"need":{"kuromy_o08":40}},"kuromy_o16":{"by":"wise","st":{"wise":450},"need":{"kuromy_o09":50}},"kuromy_o17":{"by":"wise","st":{"wise":450},"need":{"kuromy_o09":50}},"kuromy_o18":{"by":"wise","st":{"wise":450},"need":{"kuromy_o09":50}}}};
