// モンヒロサクセス(プレイヤー側のターン制の育成)の「計算の芯」(段取りの回1・2026-11-12 クラフトくん)
// 案: docs/progress/player-raise/PLAN.md(§1・§2)/ ASSIST.md(§0b〜§4)/ TOURNAMENT.md(§1・§1b・§6・§9・§12)/ EVENTS.md(4-⑥・§14)
//
// ★画面なし・保存なし・印なし。いまは index.html から読まれず、誰にも見えない(画面と保存は回2)。
// ★React・window・localStorage・Date・Math.random を使わない。乱数は「育成の id + ターン + 用途」から作る決まった乱数だけ
//   (同じ育成を同じ手で進めれば、端末が変わっても中断して続けても同じ結果になる)。
// ★助手マスモンの計算(MASMON_CALC)と、種ごとの素質の表(AMG_APT・AMG_INIT)は写さずに使い回す。
//   それらはゲーム本体(src/parts/56-assistant-life-masmon-*.jsx)にあるので、外から渡してもらう:
//     const SUC = MONHERO_SUCCESS.create({ calc: MASMON_CALC, apt: AMG_APT, init: AMG_INIT });
//   試算と検査(tools/success/)は Node で parts から取り出して渡す(tools/success/load.js)。
// ★試合そのもの(助手マスモン対戦の芯)はここでは回さない。大会は「相手を作る」と「勝ち負けを受けて結果を付ける」だけ。
//
// 1ターンの進め方(画面からも試算からも同じ順で呼ぶ):
//   let s = SUC.newRun({ id, species, aid, team, aidBondLv });
//   const v = SUC.peek(s);                 // そのターンの札(編成の子が集まった訓練)・博士が来たか・できること
//   s = SUC.act(s, { kind:'train', stat:'pow' }).state;   // 訓練(6つ)・shugyo・rest・play・clinic・retry(デビュー戦の再挑戦)
//   s = SUC.react(s, 'praise').state;      // 訓練の結果のあとに 褒める/叱る/なし(null)
//   s = SUC.issa(s, 'hp').state;           // 博士が来ていれば(peek().issa)、選ぶ(none でもよい)
//   s = SUC.endTurn(s).state;              // ターンを閉じる。期末・頂への道なら s.battle に「戦う大会」が入る
//   while (s.battle) { const opp = SUC.opponents(s); /* 対戦の芯で戦う */ s = SUC.settle(s, wins).state; }
//   if (s.over) { const ev = SUC.evaluate(s); }  // 引退(総合力・ランク・アシストポイント)
(function (root) {
  'use strict';

  const VERSION = 1;
  const KEYS = ['life', 'pow', 'wise', 'hit', 'eva', 'tough'];
  const STAT_NAMES = Object.freeze({ life: 'ライフ', pow: 'ちから', wise: 'かしこさ', hit: '命中', eva: '回避', tough: '丈夫さ' });
  const STAT_MAX = 999;
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const num = (v, d = 0) => (v === null || v === undefined || v === '' ? d : Number.isFinite(Number(v)) ? Number(v) : d);
  const r2 = (v) => Math.round(v * 100) / 100;
  const clone = (o) => JSON.parse(JSON.stringify(o));

  // ---- 決まった乱数(FNV-1a で種を作り、mulberry32 で並べる) ----
  const hashStr = (s) => { let h = 0x811c9dc5; const t = String(s); for (let i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return h >>> 0; };
  const rngOf = (...parts) => {
    let a = hashStr(parts.join('|'));
    return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  };

  // ---- 期とターン(TOURNAMENT.md §1・46ターン固定) ----
  const PERIODS = Object.freeze([
    { key: 'debut', name: 'デビュー期', len: 5 },
    { key: 'junior', name: 'ジュニア期', len: 12 },
    { key: 'middle', name: 'ミドル期', len: 12 },
    { key: 'pro', name: 'プロ期', len: 12 },
    { key: 'final', name: '最後の期', len: 5 },
  ]);
  const TOTAL_TURNS = PERIODS.reduce((a, p) => a + p.len, 0); // 46
  const periodOf = (turn) => {
    let t = clamp(Math.round(num(turn, 1)), 1, TOTAL_TURNS); let start = 1;
    for (let i = 0; i < PERIODS.length; i++) { const p = PERIODS[i]; if (t < start + p.len) return { index: i, key: p.key, name: p.name, len: p.len, start, at: t - start + 1, left: start + p.len - t }; start += p.len; }
    const p = PERIODS[PERIODS.length - 1]; return { index: PERIODS.length - 1, key: p.key, name: p.name, len: p.len, start: TOTAL_TURNS - p.len + 1, at: p.len, left: 1 };
  };
  // 期末の強制大会(ターンを使わない)。星: 1=★ 2=★★ 3=★★★ 4=👑
  const FORCED = Object.freeze({
    debut: { key: 'debut', name: 'デビュー戦', star: 1, matches: 1, all: 0, pts: 5, pop: 3, title: 'はじめの一歩' },
    junior: { key: 'junior', name: 'ジュニアしめくくり杯', star: 2, matches: 2, all: 2, pts: 5, pop: 2, title: 'ジュニアの星' },
    middle: { key: 'middle', name: 'ミドルしめくくり杯', star: 3, matches: 3, all: 3, pts: 10, pop: 4, title: 'ミドルの星' },
    pro: { key: 'pro', name: '冬のヒーロー記念', star: 4, matches: 3, all: 4, pts: 20, pop: 8, title: 'ヒーロー記念', crown: true },
  });
  // 頂への道(最後の期の 3・4・5ターン目の終わりに1戦ずつ・負けたら終わり)
  const SUMMIT = Object.freeze([{ round: 1, name: '頂への道 1回戦', mult: 1.2 }, { round: 2, name: '頂への道 準決勝', mult: 1.3 }, { round: 3, name: '頂への道 決勝', mult: 1.4 }]);
  const SUMMIT_FINAL = Object.freeze({ plain: { all: 8, pts: 30, pop: 10, title: '頂に立った子' }, big: { all: 15, pts: 60, pop: 20, title: 'ヒーローの頂' } });
  // 再戦(社長 2026-11-12・TOURNAMENT.md §14): 大会に負けたとき、アイテムでやり直せる。2種類あわせて1回の育成で3回まで
  //   時渡りの砂時計(sand)= 同じ相手ともう一度/虹の時渡りの砂時計(rainbow)= 相手を変えてもう一度(組み合わせのくじを引き直す)
  //   持ちこみ・出来事・大会のごほうびでもらえる。デビュー戦(案): やり直して勝てば、その負けは「3回負けたらゲームオーバー」に数えない
  const REMATCH = Object.freeze({ max: 3, carry: 3, crownWin: 'sand', items: Object.freeze({ sand: '時渡りの砂時計', rainbow: '虹の時渡りの砂時計' }) });
  const DEBUT_LOSS_MAX = 3;        // デビュー戦に3回負けたらゲームオーバー(§12 E)
  const DEBUT_RETRY_WEAKEN = 0.1;  // 負けるたびに相手が1割ずつ弱く(§12 D)
  const DEBUT_RETRY_FLOOR = 0.6;   // はじめの6割まで

  // ---- 基礎数値(試算 tools/success/success-sim.js で合わせる。ASSIST.md §4 の「基礎数値」) ----
  const BASE = Object.freeze({
    light: 11,                                     // 訓練の主の能力の基礎(出来事の「訓練1回ぶん」の物差しもこれ)
    sub: [0.35, 0.15],                           // ほか2つ(主に対する割合)。訓練は1種類ずつ(軽い/重いの区別はなし・社長 2026-11-12)
    hp: 16,                                      // 体力の減り
    stress: 4,                                   // ストレスの増え(方針の倍率をかける)
  });
  // 訓練で能力は下がらない(社長 2026-11-12: 3能力が上がるだけ・マイナスはなし)
  // 訓練Lv(社長 2026-11-12): 訓練ごと(6能力の6つ)にトレ経験値があり、踏むたびに +1。最大 Lv5。Lv ごとに基礎値が上がる
  const TRAIN_LV = Object.freeze({ max: 5, need: [0, 4, 9, 15, 22], mult: [1, 1.08, 1.16, 1.25, 1.35] }); // 6つの訓練それぞれ。need = その Lv に要る経験の合計
  const trainLvOf = (xp) => { let lv = 1; for (let i = 1; i < TRAIN_LV.max; i++) if (num(xp) >= TRAIN_LV.need[i]) lv = i + 1; return lv; };
  // 1回の訓練で上がる3能力の組み合わせ(主 → [ほか1, ほか2])は助手ごとに違う(台帳 2026-11-12)
  const TRAIN_COMBO = Object.freeze({
    mua: { life: ['pow', 'tough'], pow: ['life', 'hit'], wise: ['hit', 'eva'], hit: ['pow', 'eva'], eva: ['hit', 'life'], tough: ['life', 'pow'] },
    kiki: { life: ['wise', 'tough'], pow: ['wise', 'tough'], wise: ['pow', 'hit'], hit: ['wise', 'pow'], eva: ['wise', 'hit'], tough: ['pow', 'life'] },
    momosuke: { life: ['eva', 'wise'], pow: ['eva', 'life'], wise: ['eva', 'life'], hit: ['eva', 'wise'], eva: ['life', 'wise'], tough: ['eva', 'life'] },
    dra: { life: ['tough', 'pow'], pow: ['tough', 'hit'], wise: ['tough', 'life'], hit: ['pow', 'tough'], eva: ['tough', 'pow'], tough: ['pow', 'life'] },
    atsu: { life: ['wise', 'hit'], pow: ['life', 'eva'], wise: ['hit', 'life'], hit: ['eva', 'wise'], eva: ['hit', 'tough'], tough: ['life', 'wise'] },
    kyuko: { life: ['wise', 'eva'], pow: ['wise', 'life'], wise: ['life', 'hit'], hit: ['wise', 'eva'], eva: ['wise', 'hit'], tough: ['wise', 'life'] },
    sorashido: { life: ['hit', 'tough'], pow: ['hit', 'wise'], wise: ['hit', 'tough'], hit: ['wise', 'life'], eva: ['hit', 'wise'], tough: ['hit', 'eva'] },
    erubin: { life: ['tough', 'eva'], pow: ['tough', 'life'], wise: ['life', 'tough'], hit: ['tough', 'eva'], eva: ['tough', 'life'], tough: ['life', 'eva'] },
  });
  const AIDS = Object.freeze(Object.keys(TRAIN_COMBO));

  // ---- 結果(社長 2026-11-12: 大成功 ×1.5 / 成功 ×1 / 失敗 ×0 / サボり ×0.3) ----
  const RESULTS = Object.freeze({
    great: { name: '大成功', mult: 1.5, hp: 1, stress: -2 },
    ok: { name: '成功', mult: 1, hp: 1, stress: 0 },
    fail: { name: '失敗', mult: 0, hp: 1, stress: 2 },
    sab: { name: 'サボり', mult: 0.3, hp: 0.3, stress: -3 },
  });
  const RATE = Object.freeze({
    great: 0.08, greatLoyal80: 0.03,             // 大成功の土台・忠誠80〜で +3%(ASSIST §4c)
    fail: 0.03,                                  // 失敗の土台(体力が十分なとき)
    failHpFrom: 0.5,                             // 体力が上限のこの割合を下回ると失敗が増えはじめる
    failHpTop: 0.7,                              // 体力0のときに足される失敗の率(二乗で増える = どんどん上がる)
    saboriGuse: 0.05,                            // ようす「サボりグセ」= 失敗率の下限 +5%(台帳 2026-11-12)
    sab: [0.04, 0.08, 0.12],                     // サボり: 甘い・溺愛・超溺愛(普通〜厳しい側では起きない)
    sabAmaHi: 1.2,                               // 甘え度 40〜 で少し起きやすい
    failFearHi: 0.9,                             // 恐れ度 40〜 で失敗が少し減る
    failCap: 0.9,
  });

  // ---- 休む・遊ぶ・通院(社長 2026-11-12) ----
  const REST = Object.freeze([{ key: 'poor', name: 'あんまり休めなかった', p: 0.1, rec: 0.5 }, { key: 'normal', name: '普通の休養', p: 0.7, rec: 0.7 }, { key: 'great', name: 'がっつり休めた', p: 0.2, rec: 0.9 }]);
  const PLAY = Object.freeze({ rec: 0.5, ama: 5, stress: -20 });
  const REST_STRESS = -10;
  const CLINIC = Object.freeze({ first: 0.7, erubinAdd: 0.1, rec: 0.3 }); // 1回目70%・2回目は必ず(社長)・1ターンだけ
  const HP_MAX0 = 100, HP_MAX_CAP = 160;

  // ---- 体調(けが・病気・家出。長さはターン) ----
  const COND = Object.freeze({
    injLowHp: 0.3, injTrain: 0.08, injLen: [1, 2],
    illStress: 70, illRate: 0.10, illLen: 1,
    awayLoyal: 20, awayStress: 80, awayRate: 0.2, awayLen: 1, awayAma: -8, awayFear: -4,
    rec: 0.3, sorashido: 0.7,
  });

  // ---- 忠誠度 = 甘え度 + 恐れ度(各50まで・ASSIST §4c) ----
  const LOYAL = Object.freeze({
    half: 50, start: [10, 10], capBoost: 60, // 補正 = 1 + min(忠誠,60)/100
    praiseGood: [4, 0], praiseBad: [2, -2], scoldBad: [0, 4], scoldGood: [-3, 1],
    win: [2, 0], loseScold: [0, 3], idleTurns: 4, idle: [-1, -1],
  });
  // 方針の段(-3〜+3)で、甘え度・恐れ度の上がり方が変わる(甘い側ほど甘えが上がりやすい)
  const POL_AMA = Object.freeze([1.5, 1.35, 1.2, 1, 0.8, 0.65, 0.5]);
  const POL_FEAR = Object.freeze([0.5, 0.65, 0.8, 1, 1.2, 1.35, 1.5]);

  // ---- 編成(ASSIST §0b・§4a・§4b) ----
  const TEAM_SIZE = 6;
  const RANK_KEYS = ['G', 'F', 'E', 'D', 'C', 'B', 'A', 'S', 'SS', 'SSS', 'M'];
  const RANK_ADD = Object.freeze({ G: 0, F: 0, E: 1, D: 1, C: 2, B: 3, A: 4, S: 5, SS: 6, SSS: 6, M: 8 });       // 能力の補正の上乗せ(%)
  const TAG_POWER = Object.freeze({ base: 15, G: 20, F: 20, E: 22, D: 22, C: 24, B: 25, A: 27, S: 30, SS: 32, SSS: 32, M: 35, aid: 25 }); // タッグの強さ(%)
  const BOND_START = Object.freeze({ base: 0, G: 10, F: 10, E: 15, D: 15, C: 20, B: 25, A: 30, S: 35, SS: 40, SSS: 40, M: 50 });
  const POS_COEF = [1.0, 0.9, 0.8];
  const GATHER = Object.freeze({ fav: 0.65, favCap: 0.9, top: [30, 20, 15], else: 20, none: 15, aidRate: 0.6, groupAdd: 0.10, groupMin: 3 });
  const BOND = Object.freeze({ max: 100, tag: 80, train: 8, aidPerLv: 8, eventRate: 0.5 });
  const STORY = Object.freeze([{ need: 0, p: 1, bond: 10 }, { need: 40, p: 0.7, bond: 10 }, { need: 60, p: 0.5, bond: 15 }]);
  const LOTTERY = Object.freeze([{ key: 'self', p: 0.4 }, { key: 'rest', p: 0.25 }, { key: 'talk', p: 0.15 }, { key: 'tip', p: 0.1 }, { key: 'pal', p: 0.1 }]);
  const START_STAT_DIV = 25; // はじめの能力 = 1位の値 ÷ 25

  // ---- アシスト能力(ASSIST §1・§3) ----
  const ASSISTS = Object.freeze({
    sokoji: { name: '特訓の底力', type: 'with', v: [4, 7, 10], cost: [40, 80, 128] },
    kaketsuke: { name: 'かけつけ', type: 'self', v: [8, 14, 20], cost: [32, 64, 104] },
    hirameki: { name: 'ひらめき', type: 'with', v: [3, 5, 8], cost: [32, 64, 104] },
    atooshi: { name: '得意の後押し', type: 'with', v: [8, 14, 20], cost: [24, 48, 80] },
    kizuna: { name: '信頼のきずな', type: 'with', v: [6, 10, 14], cost: [40, 80, 128] },
    ochitsuki: { name: '落ち着き', type: 'with', v: [15, 25, 35], cost: [24, 48, 80] },
    itawari: { name: 'いたわり', type: 'with', v: [8, 14, 20], cost: [24, 48, 80] },
    shugyo: { name: '修行の手ほどき', type: 'stay', v: [10, 18, 25], cost: [24, 48, 80] },
    hitonatsu: { name: '人なつっこさ', type: 'stay', v: [1.2, 1.4, 1.6], cost: [32, 64, 104], start: [5, 10, 15] },
  });
  const ASSIST_MAX = 4;
  const assistPointsOf = (power) => clamp(Math.floor(num(power) / 50), 20, 400);

  // ---- イッサ博士(EVENTS.md 4-⑥・社長の確率どおり) ----
  const ISSA = Object.freeze({
    choices: Object.freeze({
      stat: { name: 'ステータスアップ', p: 0.35 },
      hpmax: { name: '体力上限アップ', p: 0.60 },
      hp: { name: '体力回復', p: 0.90 },
      loyal: { name: '忠誠度アップ', p: 0.75 },
      pop: { name: '人気アップ', p: 0.75 },
      none: { name: '何もしない', p: 0 },
    }),
    rate: 0.03, maxMeet: 3, stressNo: 70, // 出会う: ジュニア期の7ターン目〜プロ期の終わり・1ターン約3%・3回まで・ストレス70〜は来ない
    upLoyal: 80, upHp: 0.7, upAgain: 0.05, up: 0.05, downHp: 0.3, downHpV: -0.10, downStress: 50, downStressV: -0.05, band: 0.10, top: 0.95,
  });

  // ---- 修行(社長 2026-11-12: 参考と同じ形。チケット・2段で能力2つずつ・最後に技を覚えるくじ・外すと次の率が上がる) ----
  // 行き先は4つ(段ごとに上がる能力の組)。覚えられる技は助手マスモンの技表(ASSISTANT_MASMON_TECHS)のその種の技で、
  // 技の条件(learn.st の能力の下限・learn.need の熟練)を満たしたものだけ。learn.by(助手マスモンの修行の系統)は使わない
  const SHUGYO = Object.freeze({
    courses: Object.freeze({
      fire: { name: '炎の谷', stages: [['hit', 'life'], ['tough', 'eva']] },
      ice: { name: '氷の峰', stages: [['pow', 'tough'], ['life', 'wise']] },
      wind: { name: '風の森', stages: [['eva', 'hit'], ['wise', 'pow']] },
      star: { name: '星の湖', stages: [['wise', 'life'], ['eva', 'pow']] },
    }),
    gain: 0.9,                 // 1段で2つの能力に「軽い訓練1回ぶん」× 0.9 ずつ(2段で4能力ぶん)
    hp: 30, stress: 8,         // 体力を多めに使う
    ticket0: 1,                // はじめのチケット。期ごとの回数は決めず、チケットの数だけ行ける(社長 2026-11-12)
    pick: 2,                   // 覚えたい技を2つまで選ぶ(上から順にくじ・1回の修行で覚えるのは1つまで)
    rate: Object.freeze({ light: 60, mid: 50, skill: 40, gdown: 40, heavy: 35, far: 35, big: 25, ult: 15 }),
    pity: 15,                  // 外すたびに次の率 +15(覚えたら0に戻る)
    draAdd: 10,                // ドラ: 修行で技を覚えやすい
    mastery: 10,               // 修行するたびに覚えている技の熟練 +10
    joinMax: 3,                // 1段に付いてくる編成の子の数の上限
    rateTop: 95,
  });
  const TECH_MAX = 8;

  // ---- 持ちこみアイテム(社長 2026-11-12・ITEMS-REF.md: 効果も名前も参考のまま。博士はイッサ博士) ----
  //   before = 始める前に使う(その育成にかける)/ during = 育成中にも使える(1ターンに1個まで)
  //   よいようす(good): イベントメーカー・トレーニング得意・修行得意・スターの素質○・うけつぐ魂(育成のあいだずっと続く)
  const ITEMS = Object.freeze({
    issaNote: { name: '博士の導き書', use: 'before', issaForce: true },        // 1度、イッサ博士が現れる
    issaLoupe: { name: '博士のルーペ', use: 'during', issaSure: true },           // 博士の実験が成功する(博士が来たターンに使う)
    misanga: { name: '出会いのミサンガ', use: 'before', good: 'eventMaker' },
    weekly: { name: '週刊!トレーニング', use: 'before', good: 'trainGood' },
    hachimaki: { name: '修行のハチマキ', use: 'before', good: 'shugyoGood' },
    omamori: { name: '縁結びのお守り', use: 'before', good: 'star' },
    kibidango: { name: 'モモのキビダンゴ', use: 'before', hpMax: 20 },                // 体力の最大値が初めから上がる
    uketsugi: { name: 'うけつぎ草', use: 'before', good: 'uketsugu' },
    juice: { name: 'ガロエ印の野菜ジュース', use: 'during', hpFull: true },                 // 体力を完全に回復
    powder: { name: '悪様散', use: 'during', cure: true, hp: 0.3 },               // 悪いようすを治して体力を回復
    license: { name: 'ブリーダーライセンス', use: 'during', loyal: 10 },               // 忠誠度が一定数上がる
    pack: { name: 'オイリーパック', use: 'during', gives: { oil: 2, herb: 1 } }, // 中身はオイル2個と薬草
    oil: { name: 'オイル', use: 'during', hp: 0.3 },                                 // 詰め合わせの中身(体力 上限の30%)
    herb: { name: '薬草', use: 'during', stress: -20 },                          // 詰め合わせの中身(ストレス −20)
  });
  const GOOD = Object.freeze({
    eventMaker: { name: 'イベントメーカー', eventRate: 0.15 },              // 編成の子との出来事 +15%(50% → 65%)
    trainGood: { name: 'トレーニング得意', train: 0.10 },                  // 訓練の伸び +10%
    shugyoGood: { name: '修行得意', shugyo: 0.20, techRate: 10 },          // 修行の伸び +20%・技を覚える率 +10
    star: { name: 'スターの素質○', pop: 1.5, bond: 1.2 },                // 人気の上がり ×1.5・親密度の上がり ×1.2(良縁)
    uketsugu: { name: 'うけつぐ魂', story: 0.15, teach: 2 },               // 連続の話が進む率 +15%・3話(伝授)の能力が2倍
  });
  const CARRY_MAX = 2; // 持ちこみは1回の育成で2つまで(社長 2026-11-12。始める前の物と育成中の袋を合わせて)

  // ---- 賞金(名声)と修行チケット(社長 2026-11-12: チケットは大会でもらい、賞金が大きい大会ほど多い) ----
  // 賞金は TOURNAMENT §2 の星の賞金 × 期の倍率(ジュニア ×1・ミドル ×1.25・プロ ×1.5)。頂への道は 800/1500/3000
  const PRIZE = Object.freeze({ debut: 100, junior: 250, middle: 750, pro: 2250, summit: [800, 1500, 3000] });
  const PRIZE_LOSE = Object.freeze([0.40, 0.15]); // 2試合以上の大会で、決勝で負け 40%・その前で負け 15%
  const ticketsOfPrize = (prize) => Math.min(4, 1 + Math.floor(num(prize) / 700)); // 勝ったときだけ: 100→1・750→2・1500→3・2250→4

  // ---- 大会のあとのごほうびのごはん(社長 2026-11-12: 体力・忠誠度・能力の3種類・値段は名声) ----
  // 大会が終わるたびに1回だけ選べる(選ばなくてもよい)。次の行動かターンの区切りで消える
  const MEALS = Object.freeze({
    hp: { name: 'スタミナごはん', cost: 150, hp: 0.4 },              // 体力を上限の40%ぶん回復
    loyal: { name: 'なかよしごはん', cost: 300, ama: 3, fear: 2 },    // 忠誠度 +5(甘え +3・恐れ +2)
    stat: { name: 'パワーごはん', cost: 500, all: 0.4 },              // 6能力すべて +「軽い訓練1回ぶん」× 0.4
  });

  // ---- 能力ポイント(TOURNAMENT §7b) ----
  const PTS = Object.freeze({ hold: 200, line: { debut: 300, junior: 300, middle: 500, pro: 700, final: 700 } });

  // ---- 経験と Lv(総合力の Lv × 15 に入る。助手マスモンとは別の速さ・案) ----
  const XP = Object.freeze({ train: 2, shugyo: 3, match: 2, need: (lv) => 3 + Math.floor(lv / 5) });
  const LV_MAX = 99;

  // ---- 大会の相手(TOURNAMENT §9) ----
  // 基準の強さ B(6能力の合計)。試算(success-sim.js --calibrate)で「ふつうに育てた子」の勝率が
  // ★ 約80%・★★ 約60%・★★★ 約45%・👑 約30%・頂への道の決勝 約25% になるよう求めた値(TOURNAMENT §9 の 8)
  const BENCH = Object.freeze({ debut: 700, junior: 970, middle: 1290, pro: 1650, summit: 2000 });
  const STAR_MULT = Object.freeze({ 1: 0.75, 2: 0.95, 3: 1.1, 4: 1.25 });
  const ROUND_ADD = Object.freeze([0, 0.05, 0.10]); // 1回戦・準決勝・決勝(★★ は準決勝から)
  const OPP_JITTER = 0.08;
  const OPP_GEAR = Object.freeze({ debut: { techs: 2, mastery: 10, tactics: 5 }, junior: { techs: 2, mastery: 20, tactics: 10 }, middle: { techs: 3, mastery: 40, tactics: 20 }, pro: { techs: 4, mastery: 60, tactics: 30 }, final: { techs: 5, mastery: 80, tactics: 40 } });

  const create = (deps) => {
    const C = deps && deps.calc;
    if (!C || typeof C.power !== 'function') throw new Error('monhero-success: calc(MASMON_CALC)が要る');
    const APT = (deps && deps.apt) || {};
    const BENCH_USE = Object.freeze({ ...BENCH, ...((deps && deps.bench) || {}) }); // 試算で基準を探すときだけ外から渡す
    const INIT = (deps && deps.init) || {};
    const TECHS = (deps && deps.techs && deps.techs.species) || {}; // 助手マスモンの技表(無ければ技なしで動く)
    const techsOf = (sp) => (Array.isArray(TECHS[sp]) ? TECHS[sp] : []);
    const startTechs = (sp) => techsOf(sp).filter(t => t && t.learn && t.learn.start).map(t => t.id);
    const APT_MULT = Object.freeze({ A: 1.3, B: 1.15, C: 1, D: 0.85, E: 0.7 }); // AMG_APT_MULT と同じ値
    const speciesList = Object.keys(INIT).filter(k => Array.isArray(INIT[k]));
    const aptStr = (sp) => (typeof APT[sp] === 'string' && APT[sp].length === 6 ? APT[sp] : 'CCCCCC');
    const aptMult = (sp, k) => APT_MULT[aptStr(sp)[KEYS.indexOf(k)]] || 1;
    const initStats = (sp) => { const a = Array.isArray(INIT[sp]) ? INIT[sp] : [100, 100, 100, 100, 100, 100]; const o = {}; KEYS.forEach((k, i) => { o[k] = clamp(Math.round(num(a[i], 100)), 0, STAT_MAX); }); return o; };
    const normStats = (st, sp) => { const base = initStats(sp); const o = {}; KEYS.forEach(k => { o[k] = clamp(Math.round(num(st && st[k], base[k])), 0, STAT_MAX); }); return o; };
    const sumOf = (st) => KEYS.reduce((a, k) => a + num(st[k]), 0);
    const loyalOf = (s) => clamp(num(s.ama) + num(s.fear), 0, 100);
    const loyalMult = (loy) => 1 + Math.min(num(loy), LOYAL.capBoost) / 100;

    // 上位3つ(同じ値なら種の伸びやすさが高い方 → 能力の並び順)
    const top3Of = (st, sp) => KEYS.slice().sort((a, b) => (st[b] - st[a]) || (aptMult(sp, b) - aptMult(sp, a)) || (KEYS.indexOf(a) - KEYS.indexOf(b))).slice(0, 3);
    const aptTop3 = (sp) => KEYS.slice().sort((a, b) => (aptMult(sp, b) - aptMult(sp, a)) || (initStats(sp)[b] - initStats(sp)[a]) || (KEYS.indexOf(a) - KEYS.indexOf(b))).slice(0, 3);

    // ---- 編成の1体(保存枠の子・フレンドの子・ベースモン)。6能力から毎回出し直す(送られた数字を信じない) ----
    const normAssists = (list) => {
      const out = []; const seen = {};
      for (const a of Array.isArray(list) ? list : []) {
        const id = a && typeof a === 'object' ? a.id : null; if (!ASSISTS[id] || seen[id]) continue;
        out.push({ id, lv: clamp(Math.round(num(a.lv, 1)), 1, 3) }); seen[id] = true; if (out.length >= ASSIST_MAX) break;
      }
      return out;
    };
    const memberOf = (src) => {
      const o = src && typeof src === 'object' ? src : {};
      const sp = speciesList.includes(o.species) ? o.species : (speciesList[0] || 'Mocchi');
      const base = o.kind !== 'raised';
      const stats = base ? initStats(sp) : normStats(o.stats, sp);
      const loy = base ? 0 : clamp(Math.round(num(o.loy)), 0, 100); const pop = base ? 0 : clamp(Math.round(num(o.pop)), 0, 100);
      const lv = base ? 1 : clamp(Math.round(num(o.lv, 1)), 1, LV_MAX);
      const masteries = base ? [] : (Array.isArray(o.masteries) ? o.masteries.slice(0, 8).map(m => clamp(num(m), 0, 100)) : []);
      const power = C.power({ stats, masteries, lv, loyal: loy, pop });
      const rank = base ? 'base' : C.rankOf(power).key;
      const top = base ? aptTop3(sp) : top3Of(stats, sp);
      const assists = base ? [] : normAssists(o.assists);
      const own = techsOf(sp).map(t => t.id);
      const techs = base ? startTechs(sp) : (Array.isArray(o.techs) ? o.techs.filter(t => own.includes(t)).slice(0, TECH_MAX) : startTechs(sp));
      const lvOf = (id) => { const a = assists.find(x => x.id === id); return a ? a.lv : 0; };
      const bonus = {}; KEYS.forEach(k => { const i = top.indexOf(k); bonus[k] = i < 0 ? 0 : r2(stats[k] / 40 * POS_COEF[i] + (base ? 0 : RANK_ADD[rank])); });
      const kake = lvOf('kaketsuke'); const fav = Math.min(GATHER.favCap, GATHER.fav + (kake ? ASSISTS.kaketsuke.v[kake - 1] / 100 : 0));
      const hn = lvOf('hitonatsu');
      return {
        kind: base ? 'base' : 'raised', species: sp, name: typeof o.name === 'string' ? o.name.slice(0, 24) : sp, stats, loy, pop, lv, rank, power, top, assists, bonus, fav, techs,
        tag: base ? TAG_POWER.base : TAG_POWER[rank], bond0: clamp((base ? BOND_START.base : BOND_START[rank]) + (hn ? ASSISTS.hitonatsu.start[hn - 1] : 0), 0, BOND.max),
        startAdd: { stat: top[0], v: Math.floor(stats[top[0]] / START_STAT_DIV) },
      };
    };
    const assistLv = (m, id) => { const a = m.assists.find(x => x.id === id); return a ? a.lv : 0; };
    // その子がその能力の訓練にいるときの効き(%)= 能力の補正 + いっしょ型アシスト
    const memberEffect = (m, k, loy) => {
      let v = m.bonus[k] || 0;
      const so = assistLv(m, 'sokoji'); if (so) v += ASSISTS.sokoji.v[so - 1];
      const at = assistLv(m, 'atooshi'); if (at && m.top[0] === k) v += ASSISTS.atooshi.v[at - 1];
      const ki = assistLv(m, 'kizuna'); if (ki) v += ASSISTS.kizuna.v[ki - 1] * clamp(num(loy), 0, 100) / 100;
      return r2(v);
    };
    const stayLv = (team, id) => team.reduce((a, m) => Math.max(a, assistLv(m, id)), 0); // いるだけ型は編成でいちばん高い段の1つだけ

    // ---- はじめる ----
    const newRun = (o) => {
      const src = o && typeof o === 'object' ? o : {};
      const id = typeof src.id === 'string' && src.id ? src.id.slice(0, 64) : 'run';
      const species = speciesList.includes(src.species) ? src.species : (speciesList[0] || 'Mocchi');
      const aid = AIDS.includes(src.aid) ? src.aid : 'mua';
      const raw = Array.isArray(src.team) ? src.team.slice(0, TEAM_SIZE) : [];
      while (raw.length < TEAM_SIZE) raw.push({ kind: 'base', species }); // 空いた枠はベースモン(育てる子と同じ種)
      const team = raw.map(memberOf);
      const typeIdx = Number.isInteger(src.type) ? clamp(src.type, 0, 5) : C.typeFromApt(aptStr(species), rngOf(id, 'type')());
      const stats = initStats(species);
      team.forEach(m => { stats[m.startAdd.stat] = clamp(stats[m.startAdd.stat] + m.startAdd.v, 0, STAT_MAX); });
      const aidLv = clamp(Math.round(num(src.aidBondLv, 1)), 1, 10);
      // 持ちこみ: carry = 始める前に使う物(3つまで)・bag = 育成中に使う物の数
      const carry = (Array.isArray(src.carry) ? src.carry : []).filter(k => ITEMS[k] && ITEMS[k].use === 'before').filter((k, i, a) => a.indexOf(k) === i).slice(0, CARRY_MAX);
      const bag = {}; let room = CARRY_MAX - carry.length;
      if (src.bag && typeof src.bag === 'object') for (const [k, v] of Object.entries(src.bag)) if (ITEMS[k] && ITEMS[k].use === 'during' && room > 0) { const n = clamp(Math.round(num(v)), 0, room); if (n > 0) { bag[k] = n; room -= n; } }
      const good = {}; let hpMax = HP_MAX0; let issaForce = false;
      carry.forEach(k => { const it = ITEMS[k]; if (it.good) good[it.good] = true; if (it.hpMax) hpMax = Math.min(HP_MAX_CAP, hpMax + it.hpMax); if (it.issaForce) issaForce = true; });
      const hn = stayLv(team, 'hitonatsu');
      return {
        v: VERSION, id, species, aid, type: typeIdx, turn: 1, stats, hpMax, hp: hpMax, stress: 0, carry, bag, good, issaForce, issaSure: false, itemTurn: 0,
        ama: LOYAL.start[0], fear: LOYAL.start[1], pol: clamp(Math.round(num(src.pol)), -3, 3), pp: 0, pop: 0, pts: 0, ptsLost: 0, lv: 1, xp: 0,
        team, bond: team.map(m => m.bond0), story: team.map(() => 0), aidBond: clamp(aidLv * BOND.aidPerLv + (hn ? ASSISTS.hitonatsu.start[hn - 1] : 0), 0, BOND.max),
        techs: startTechs(species), mastery: Object.fromEntries(startTechs(species).map(t => [t, 0])), tickets: SHUGYO.ticket0, shugyoUsed: {}, pity: 0, fame: 0, fameTotal: 0, mealReady: false, trainXp: {},
        items: { sand: clamp(Math.round(num(src.items && src.items.sand)), 0, REMATCH.carry), rainbow: clamp(Math.round(num(src.items && src.items.rainbow)), 0, REMATCH.carry) }, rematchUsed: 0, wonBefore: Array.isArray(src.wonBefore) ? src.wonBefore.filter(k => typeof k === 'string').slice(0, 64) : [], wonNow: [],
        cond: null, yosu: {}, hirameki: false, idle: 0, issaMet: 0, issaWon: 0, issaDone: false,
        debutLoss: 0, debutWon: false, crowns: 0, titles: [], battle: null, over: null, last: null, acted: false, reacted: false,
        log: { train: 0, great: 0, ok: 0, fail: 0, sab: 0, rest: 0, play: 0, clinic: 0, cond: 0, events: 0, story: 0, lottery: 0, shugyo: 0, learned: 0, taught: 0, tagTurns: [0, 0, 0, 0], wins: 0, losses: 0, issa: [] },
      };
    };

    // ---- そのターンの集まり(決まった乱数: 育成の id + ターン) ----
    const cardKey = (kind, stat) => `${kind}:${stat}`;
    const gatherOf = (s) => {
      const rng = rngOf(s.id, s.turn, 'gather');
      const cards = {}; for (const k of KEYS) cards[cardKey('train', k)] = { kind: 'train', stat: k, members: [], aid: false };
      s.team.forEach((m, i) => {
        const x = rng(); const kind = 'train'; rng(); const y = rng(); // 2つ目の乱数は前の形(軽い/重い)の名残。並びを変えないため引くだけ
        const favUnit = m.fav / (GATHER.top[0] + GATHER.top[1] + GATHER.top[2]); const restUnit = (1 - m.fav) / (GATHER.else + GATHER.none);
        let a = 0; let stat = null;
        for (let j = 0; j < 3 && !stat; j++) { a += GATHER.top[j] * favUnit; if (x < a) stat = m.top[j]; }
        if (!stat) { a += GATHER.else * restUnit; if (x < a) { const others = KEYS.filter(k => !m.top.includes(k)); stat = others[Math.floor(y * others.length)]; } }
        if (stat) cards[cardKey(kind, stat)].members.push(i);
      });
      if (rng() < GATHER.aidRate) { const all = Object.keys(cards); cards[all[Math.floor(rng() * all.length)]].aid = true; }
      return cards;
    };
    // その札の「足し算」と「タッグ」(ASSIST §4)
    const cardMult = (s, card) => {
      const loy = loyalOf(s); let add = 0; let tag = 0; const tags = [];
      card.members.forEach(i => { const m = s.team[i]; add += memberEffect(m, card.stat, loy) / 100; if (s.bond[i] >= BOND.tag) { tag += m.tag / 100; tags.push(i); } });
      if (card.members.length >= GATHER.groupMin) add += GATHER.groupAdd;
      if (card.aid && s.aidBond >= BOND.tag) { tag += TAG_POWER.aid / 100; tags.push('aid'); }
      return { add: r2(add), tag: r2(tag), tags, mult: r2((1 + add) * (1 + tag)) };
    };

    // ---- 確率 ----
    const failRateOf = (s, card) => {
      const ratio = s.hpMax > 0 ? s.hp / s.hpMax : 0;
      let f = RATE.fail + (s.yosu.sabori ? RATE.saboriGuse : 0);
      if (ratio < RATE.failHpFrom) { const d = (RATE.failHpFrom - ratio) / RATE.failHpFrom; f += d * d * RATE.failHpTop; }
      let cut = 0; if (card) card.members.forEach(i => { const lv = assistLv(s.team[i], 'ochitsuki'); if (lv) cut += ASSISTS.ochitsuki.v[lv - 1] / 100; });
      f *= 1 - Math.min(0.8, cut);
      if (s.aid === 'dra') f *= 0.7;
      if (num(s.fear) >= 40) f *= RATE.failFearHi;
      return clamp(f, 0, RATE.failCap);
    };
    const sabRateOf = (s) => { if (s.pol >= 0) return 0; return RATE.sab[-s.pol - 1] * (num(s.ama) >= 40 ? RATE.sabAmaHi : 1); };
    const greatRateOf = (s, card) => {
      let g = RATE.great + (loyalOf(s) >= 80 ? RATE.greatLoyal80 : 0) + (s.hirameki ? 0.10 : 0);
      if (card) card.members.forEach(i => { const lv = assistLv(s.team[i], 'hirameki'); if (lv) g += ASSISTS.hirameki.v[lv - 1] / 100; });
      return clamp(g, 0, 0.6);
    };

    // ---- そのターンの見通し(画面の札・試算の作戦が読む) ----
    const issaComes = (s) => {
      const p = periodOf(s.turn);
      const inWindow = (p.key === 'junior' && p.at >= 7) || p.key === 'middle' || p.key === 'pro';
      if (!inWindow || s.issaMet >= ISSA.maxMeet || s.cond || s.over) return false;
      if (s.issaForce && s.issaMet === 0) return true; // イッサ博士の研究ノート: 1度は必ず来る(来られる最初のターン)
      if (s.stress >= ISSA.stressNo) return false;
      return rngOf(s.id, s.turn, 'issa-meet')() < ISSA.rate;
    };
    const issaRate = (s, key) => {
      const c = ISSA.choices[key]; if (!c || key === 'none') return 0;
      let d = 0;
      if (loyalOf(s) >= ISSA.upLoyal) d += ISSA.up;
      if (s.hp >= s.hpMax * ISSA.upHp) d += ISSA.up;
      if (s.issaMet >= 2) d += ISSA.upAgain;
      if (s.hp <= s.hpMax * ISSA.downHp) d += ISSA.downHpV;
      if (s.stress >= ISSA.downStress) d += ISSA.downStressV;
      d = clamp(d, -ISSA.band, ISSA.band);
      return clamp(c.p + d, 0, ISSA.top);
    };
    // ---- 技を覚える(修行のくじ・連続イベントの伝授) ----
    const techById = (sp, id) => techsOf(sp).find(t => t.id === id) || null;
    const canLearn = (s, t) => {
      if (!t || s.techs.includes(t.id) || s.techs.length >= TECH_MAX) return false;
      const L = t.learn || {}; if (L.start) return true;
      if (L.st && Object.entries(L.st).some(([k, v]) => num(s.stats[k]) < num(v))) return false;
      if (L.need && Object.entries(L.need).some(([id, v]) => num(s.mastery[id]) < num(v))) return false;
      return true;
    };
    const techRate = (s, t) => clamp((SHUGYO.rate[t.role] || 30) + s.pity + (s.aid === 'dra' ? SHUGYO.draAdd : 0) + (s.good && s.good.shugyoGood ? GOOD.shugyoGood.techRate : 0), 0, SHUGYO.rateTop) / 100;
    const learnable = (s) => techsOf(s.species).filter(t => canLearn(s, t)).map(t => ({ id: t.id, name: t.name, role: t.role, power: t.power, rate: r2(techRate(s, t)) }));
    const learnTech = (s, id) => { s.techs.push(id); s.mastery[id] = 0; };
    const shugyoLeft = (s) => Math.max(0, num(s.tickets));
    // 連続イベントの3話「受け継ぐもの」: その編成の子が持つ技を伝授する。育てる子の種がその技を持てないときは、
    // 育てる子の種の「同じ役割(小技・大技…)」の技を覚える。それも無ければ熟練 +10 と能力 中+
    const teachFrom = (s, m) => {
      const mine = techsOf(s.species);
      for (const id of m.techs.slice().reverse()) {
        const same = mine.find(t => t.id === id && !s.techs.includes(t.id));
        if (same && s.techs.length < TECH_MAX) return same.id;
        const src = techById(m.species, id); if (!src) continue;
        const alt = mine.find(t => t.role === src.role && !s.techs.includes(t.id));
        if (alt && s.techs.length < TECH_MAX) return alt.id;
      }
      return null;
    };

    const peek = (s) => {
      const p = periodOf(s.turn);
      const cards = gatherOf(s);
      const view = {};
      for (const [key, c] of Object.entries(cards)) view[key] = { ...c, ...cardMult(s, c), fail: r2(failRateOf(s, c)), great: r2(greatRateOf(s, c)) };
      const retry = s.debutLoss > 0 && !s.debutWon;
      const can = s.over ? [] : s.cond ? ['cond'] : retry ? ['retry'] : ['train', 'rest', 'play'].concat(shugyoLeft(s) > 0 ? ['shugyo'] : [], s.yosu.sabori || s.yosu.utsu ? ['clinic'] : []);
      return { turn: s.turn, period: p, toEnd: TOTAL_TURNS - s.turn + 1, cards: view, sab: r2(sabRateOf(s)), can, shugyo: { left: shugyoLeft(s), tickets: s.tickets, techs: learnable(s) }, issa: !s.acted ? false : (!s.issaDone && issaComes(s)), retry, cond: s.cond };
    };

    // ---- 伸び(ASSIST §4 の1本の式) ----
    const ageOf = (s) => C.ageMult(s.type, (s.turn - 1) / TOTAL_TURNS);
    const unitOf = (s, k) => BASE.light * aptMult(s.species, k) * ageOf(s); // 「軽い訓練1回ぶん」
    const addStat = (s, k, v) => { s.stats[k] = clamp(Math.round(s.stats[k] + v), 0, STAT_MAX); };
    const addLoyal = (s, ama, fear) => {
      if (s.yosu.utsu) return; // うつ病のあいだ忠誠度(甘え度・恐れ度)は動かない(台帳 2026-11-12)
      const i = clamp(s.pol, -3, 3) + 3;
      s.ama = clamp(Math.round(num(s.ama) + (ama > 0 ? ama * POL_AMA[i] : ama)), 0, LOYAL.half);
      s.fear = clamp(Math.round(num(s.fear) + (fear > 0 ? fear * POL_FEAR[i] : fear)), 0, LOYAL.half);
    };
    const addXp = (s, x) => { s.xp += x; while (s.lv < LV_MAX && s.xp >= XP.need(s.lv)) { s.xp -= XP.need(s.lv); s.lv += 1; } };
    const recover = (s, frac) => { s.hp = clamp(Math.round(s.hp + s.hpMax * frac), 0, s.hpMax); };
    const addStress = (s, v) => { s.stress = clamp(Math.round(s.stress + v), 0, 100); };
    const addBond = (s, i, v) => {
      const mult = v > 0 ? ([1, ...ASSISTS.hitonatsu.v][stayLv(s.team, 'hitonatsu')] || 1) * (s.good && s.good.star ? GOOD.star.bond : 1) : 1;
      if (i === 'aid') s.aidBond = clamp(Math.round(s.aidBond + v * mult), 0, BOND.max); else s.bond[i] = clamp(Math.round(s.bond[i] + v * mult), 0, BOND.max);
    };

    // 編成の子との訓練イベント(1ターン1回まで・50%)。試算は1つ目の選択肢を選ぶ
    const trainEvent = (s, card, rng, out) => {
      if (!card.members.length || rng() >= BOND.eventRate + (s.good && s.good.eventMaker ? GOOD.eventMaker.eventRate : 0)) return;
      // 話を進められる子を先に
      const cand = card.members.slice().sort((a, b) => s.story[a] - s.story[b]);
      const i = cand.find(j => s.story[j] < 3) !== undefined ? cand.find(j => s.story[j] < 3) : cand[0];
      const m = s.team[i]; const fk = m.top[0];
      const ep = s.story[i]; const st = STORY[ep];
      s.log.events += 1;
      if (st && s.bond[i] >= st.need && rng() < Math.min(1, st.p + (s.good && s.good.uketsugu && ep > 0 ? GOOD.uketsugu.story : 0))) {
        s.story[i] = ep + 1; s.log.story += 1; addBond(s, i, st.bond);
        if (ep === 0) addStat(s, fk, unitOf(s, fk) * 0.5);
        else if (ep === 1) { addStat(s, fk, unitOf(s, fk)); s.hp = clamp(s.hp - 10, 0, s.hpMax); }
        else { // 技の伝授(社長 2026-11-12: 技を覚える道は修行と、編成の子の連続イベントの2つ)
          const tid = m.kind === 'base' ? null : teachFrom(s, m);
          if (tid) { learnTech(s, tid); s.log.taught += 1; out.taught = tid; } else s.techs.forEach(t => { s.mastery[t] = clamp(num(s.mastery[t]) + 10, 0, 100); });
          addStat(s, fk, unitOf(s, fk) * (s.good && s.good.uketsugu ? GOOD.uketsugu.teach : 1));
        }
        out.event = { who: i, story: ep + 1 };
        return;
      }
      s.log.lottery += 1;
      let x = rng(); let pick = LOTTERY[LOTTERY.length - 1].key; for (const l of LOTTERY) { if (x < l.p) { pick = l.key; break; } x -= l.p; }
      if (pick === 'self') { addStat(s, fk, unitOf(s, fk) * 0.5); addBond(s, i, 5); }
      else if (pick === 'rest') s.hp = clamp(s.hp + 10, 0, s.hpMax);
      else if (pick === 'talk') { addStress(s, -10); addBond(s, i, 5); }
      else if (pick === 'tip') s.hirameki = true;
      else addBond(s, i, 10);
      out.event = { who: i, lottery: pick };
    };

    const condRoll = (s, rng, kind) => {
      // けが(体力が少ないときの訓練)・病気(ストレス)・家出(忠誠が低くストレスが高い)
      const ratio = s.hp / s.hpMax; const soft = s.aid === 'sorashido' ? COND.sorashido : 1;
      if (kind === 'train' && ratio < COND.injLowHp && rng() < COND.injTrain * soft) {
        let len = rng() < 0.5 ? COND.injLen[0] : COND.injLen[1]; if (s.aid === 'erubin') len = Math.max(1, len - 1);
        return { kind: 'injury', left: len };
      }
      if (s.stress >= COND.illStress && rng() < COND.illRate * soft) return { kind: 'ill', left: COND.illLen };
      if (loyalOf(s) < COND.awayLoyal && s.stress >= COND.awayStress && rng() < COND.awayRate) { addLoyal(s, COND.awayAma, COND.awayFear); return { kind: 'away', left: COND.awayLen }; }
      return null;
    };

    // ---- 行動 ----
    const act = (s0, a) => {
      const s = clone(s0); const out = { ok: true };
      if (s.over) return { state: s, out: { ok: false, why: 'over' } };
      if (s.acted) return { state: s, out: { ok: false, why: 'acted' } };
      const v = peek(s); const kind = a && a.kind; s.mealReady = false;
      const retry = s.debutLoss > 0 && !s.debutWon;
      if (s.cond) { // 体調が悪いターンは休み扱い
        recover(s, COND.rec); addStress(s, REST_STRESS); s.cond.left -= 1; out.cond = s.cond.kind; if (s.cond.left <= 0) s.cond = null;
        s.log.cond += 1; s.acted = true; s.last = { kind: 'cond' }; return { state: s, out };
      }
      if (retry) { // デビュー戦の再挑戦: 訓練はできない。ターンの終わりに戦う
        if (kind !== 'retry') return { state: s0, out: { ok: false, why: 'retry-only' } };
        s.acted = true; s.last = { kind: 'retry' }; return { state: s, out };
      }
      const rng = rngOf(s.id, s.turn, 'act');
      if (kind === 'train') {
        const stat = KEYS.includes(a.stat) ? a.stat : 'pow';
        const card = v.cards[cardKey(kind, stat)];
        const pS = sabRateOf(s); const pF = failRateOf(s, card); const pG = greatRateOf(s, card);
        const x = rng(); const res = x < pS ? 'sab' : x < pS + pF ? 'fail' : x < pS + pF + pG ? 'great' : 'ok';
        s.hirameki = false;
        const R = RESULTS[res];
        const pol = C.policyOf(s.pol);
        const ck = cardKey(kind, stat); const tlv = trainLvOf(s.trainXp[ck]);
        const mult = BASE.light * (1 + (s.good && s.good.trainGood ? GOOD.trainGood.train : 0)) * TRAIN_LV.mult[tlv - 1] * pol.gain * ageOf(s) * R.mult * (1 + card.add) * (1 + card.tag) * loyalMult(loyalOf(s));
        s.trainXp[ck] = num(s.trainXp[ck]) + 1; out.trainLv = trainLvOf(s.trainXp[ck]); out.lvUp = out.trainLv > tlv;
        const combo = (TRAIN_COMBO[s.aid] || TRAIN_COMBO.mua)[stat];
        const shares = [1, BASE.sub[0], BASE.sub[1]];
        const gains = {};
        [stat, combo[0], combo[1]].forEach((k, j) => { const g = mult * shares[j] * aptMult(s.species, k); gains[k] = (gains[k] || 0) + g; });
        const before = { ...s.stats };
        Object.entries(gains).forEach(([k, g]) => addStat(s, k, g));
        let it = 0; card.members.forEach(i => { const lv = assistLv(s.team[i], 'itawari'); if (lv) it += ASSISTS.itawari.v[lv - 1] / 100; });
        const hpCost = BASE.hp * R.hp * (1 - Math.min(0.6, it)) * (s.aid === 'kiki' ? 0.85 : 1); // きき: 訓練の疲れ −15%
        s.hp = clamp(Math.round(s.hp - hpCost), 0, s.hpMax);
        addStress(s, (BASE.stress * pol.stress) + R.stress);
        card.members.forEach(i => addBond(s, i, BOND.train)); if (card.aid) addBond(s, 'aid', BOND.train);
        addXp(s, XP.train);
        s.log.train += 1; s.log[res] += 1; s.log.tagTurns[Math.min(3, card.tags.length)] += 1;
        out.result = res; out.card = { kind, stat, add: card.add, tag: card.tag, tags: card.tags, members: card.members.slice() };
        out.gain = {}; KEYS.forEach(k => { if (s.stats[k] !== before[k]) out.gain[k] = s.stats[k] - before[k]; });
        trainEvent(s, card, rng, out);
        const cd = condRoll(s, rng, kind); if (cd) { s.cond = cd; out.cond = cd.kind; }
        s.last = { kind, res }; s.acted = true; s.reacted = false;
        return { state: s, out };
      }
      if (kind === 'shugyo') {
        const pk = periodOf(s.turn).key;
        if (shugyoLeft(s) <= 0) return { state: s0, out: { ok: false, why: 'no-shugyo' } };
        const course = SHUGYO.courses[a.course] ? a.course : 'fire';
        s.tickets -= 1; s.shugyoUsed[pk] = num(s.shugyoUsed[pk]) + 1;
        const pS = sabRateOf(s); const pF = failRateOf(s, null); const pG = greatRateOf(s, null);
        const x = rng(); const res = x < pS ? 'sab' : x < pS + pF ? 'fail' : x < pS + pF + pG ? 'great' : 'ok';
        const R = RESULTS[res]; const pol = C.policyOf(s.pol);
        const sl = stayLv(s.team, 'shugyo'); const boost = 1 + (sl ? ASSISTS.shugyo.v[sl - 1] / 100 : 0);
        const before = { ...s.stats };
        // 編成の補正も訓練と同じ考え方でかける(社長 2026-11-12): 段ごとに、その段の能力が上位3つにある子が付いてくる(多いときは補正の大きい3体まで)
        const stages = [];
        SHUGYO.courses[course].stages.forEach((pair, si) => {
          const who = s.team.map((m, i) => ({ i, v: Math.max(memberEffect(m, pair[0], loyalOf(s)) * (m.top.includes(pair[0]) ? 1 : 0), memberEffect(m, pair[1], loyalOf(s)) * (m.top.includes(pair[1]) ? 1 : 0)) }))
            .filter(x => x.v > 0).sort((p, q) => q.v - p.v || p.i - q.i).slice(0, SHUGYO.joinMax).map(x => x.i);
          stages.push(who);
          pair.forEach(k => {
            const card = { kind: 'shugyo', stat: k, members: who, aid: false };
            const cm = cardMult(s, card);
            addStat(s, k, BASE.light * SHUGYO.gain * (1 + (s.good && s.good.shugyoGood ? GOOD.shugyoGood.shugyo : 0)) * pol.gain * ageOf(s) * R.mult * boost * (1 + cm.add) * (1 + cm.tag) * aptMult(s.species, k) * loyalMult(loyalOf(s)));
          });
          who.forEach(i => addBond(s, i, BOND.train / 2));
        });
        out.stages = stages;
        s.hp = clamp(Math.round(s.hp - SHUGYO.hp * R.hp), 0, s.hpMax); addStress(s, SHUGYO.stress * pol.stress + R.stress);
        s.techs.forEach(t => { s.mastery[t] = clamp(num(s.mastery[t]) + Math.round(SHUGYO.mastery * boost), 0, 100); });
        // 技のくじ: 選んだ技(2つまで)を上から順に。1回で覚えるのは1つまで。外したら次の率が上がる
        const want = (Array.isArray(a.techs) ? a.techs : []).slice(0, SHUGYO.pick).map(id => techById(s.species, id)).filter(t => canLearn(s, t));
        let got = null; const tries = [];
        if (res !== 'sab') for (const t of want) { const p = techRate(s, t); const hit = rng() < p; tries.push({ id: t.id, rate: r2(p), hit }); if (hit) { got = t.id; break; } }
        if (got) { learnTech(s, got); s.pity = 0; s.log.learned += 1; } else if (want.length) s.pity += SHUGYO.pity;
        addXp(s, XP.shugyo); s.log.shugyo += 1; s.log.train += 1; s.log[res] += 1;
        out.result = res; out.course = course; out.learned = got; out.tries = tries;
        out.gain = {}; KEYS.forEach(k => { if (s.stats[k] !== before[k]) out.gain[k] = s.stats[k] - before[k]; });
        s.last = { kind: 'shugyo', res }; s.acted = true; s.reacted = false;
        return { state: s, out };
      }
      if (kind === 'rest') {
        let x = rng(); let pick = REST[1]; for (const r of REST) { if (x < r.p) { pick = r; break; } x -= r.p; }
        recover(s, pick.rec); addStress(s, REST_STRESS * (s.aid === 'mua' ? 1.3 : 1));
        s.log.rest += 1; out.rest = pick.key; s.last = { kind }; s.acted = true;
        const cd = condRoll(s, rng, kind); if (cd) { s.cond = cd; out.cond = cd.kind; }
        return { state: s, out };
      }
      if (kind === 'play') {
        recover(s, PLAY.rec); addStress(s, PLAY.stress * (s.aid === 'mua' ? 1.3 : 1));
        if (s.yosu.utsu) { delete s.yosu.utsu; out.cured = ['utsu']; } // 遊ぶでうつ病が治る(先に治してから甘え度を足す)
        addLoyal(s, PLAY.ama, 0);
        s.log.play += 1; s.last = { kind }; s.acted = true;
        return { state: s, out };
      }
      if (kind === 'clinic') {
        if (!s.yosu.sabori && !s.yosu.utsu) return { state: s0, out: { ok: false, why: 'no-yosu' } };
        const cured = [];
        for (const key of ['sabori', 'utsu']) {
          const y = s.yosu[key]; if (!y) continue;
          const p = y.visits >= 1 ? 1 : CLINIC.first + (s.aid === 'erubin' ? CLINIC.erubinAdd : 0);
          if (rng() < p) { delete s.yosu[key]; cured.push(key); } else y.visits += 1;
        }
        recover(s, CLINIC.rec); s.log.clinic += 1; out.cured = cured; s.last = { kind }; s.acted = true;
        return { state: s, out };
      }
      return { state: s0, out: { ok: false, why: 'unknown' } };
    };

    // 叱る・褒める(訓練の結果のあと1回。しなくてもよい)
    const react = (s0, how) => {
      const s = clone(s0);
      if (!s.last || !['train', 'shugyo'].includes(s.last.kind) || s.reacted) return { state: s, out: { ok: false } };
      const good = s.last.res === 'great' || s.last.res === 'ok';
      s.reacted = true;
      if (how === 'praise') { const d = good ? LOYAL.praiseGood : LOYAL.praiseBad; addLoyal(s, d[0] + (s.aid === 'mua' ? 1 : 0), d[1]); const m = C.policyMove(s.pol, s.pp, -1); s.pol = m.pol; s.pp = m.pp; s.idle = 0; }
      else if (how === 'scold') { const d = good ? LOYAL.scoldGood : LOYAL.scoldBad; addLoyal(s, d[0], d[1]); const m = C.policyMove(s.pol, s.pp, 1); s.pol = m.pol; s.pp = m.pp; s.idle = 0; }
      else { s.idle += 1; if (s.idle >= LOYAL.idleTurns) { addLoyal(s, LOYAL.idle[0], LOYAL.idle[1]); s.idle = 0; } }
      return { state: s, out: { ok: true, loyal: loyalOf(s), pol: s.pol } };
    };

    // イッサ博士(peek().issa が真のターンだけ。ターンを使わない)
    const issa = (s0, key) => {
      const s = clone(s0);
      if (s.issaDone || !issaComes(s)) return { state: s, out: { ok: false } };
      s.issaDone = true; s.issaMet += 1;
      if (!ISSA.choices[key] || key === 'none') { s.log.issa.push('none'); return { state: s, out: { ok: true, choice: 'none' } }; }
      const p = s.issaSure ? 1 : issaRate(s, key); const win = rngOf(s.id, s.turn, 'issa')() < p; s.issaSure = false;
      if (key === 'stat') { KEYS.forEach(k => addStat(s, k, win ? 50 : -10)); if (!win) s.yosu.sabori = { visits: 0 }; else if (!s.titles.includes('秘めた力')) s.titles.push('秘めた力'); }
      else if (key === 'hpmax') { if (win) { s.hpMax = Math.min(HP_MAX_CAP, s.hpMax + 20); s.hp = Math.min(s.hpMax, s.hp + 20); } else s.hp = clamp(s.hp - 20, 0, s.hpMax); }
      else if (key === 'hp') { if (win) recover(s, 0.8); else { s.hp = clamp(s.hp - 30, 0, s.hpMax); s.yosu.utsu = { visits: 0 }; } }
      else if (key === 'loyal') { if (win) { const half = 15 / 2; addLoyalRaw(s, Math.ceil(half), Math.floor(half)); } else addLoyalRaw(s, -3, -2); }
      else if (key === 'pop') s.pop = clamp(s.pop + (win ? 15 : -5), 0, 100);
      if (win) s.issaWon += 1;
      s.log.issa.push(`${key}:${win ? 'win' : 'lose'}`);
      return { state: s, out: { ok: true, choice: key, win, p: r2(p) } };
    };
    // 博士の忠誠度は甘え度・恐れ度に半分ずつ(方針の倍率はかけない・うつ病なら動かない)
    const addLoyalRaw = (s, ama, fear) => { if (s.yosu.utsu) return; s.ama = clamp(s.ama + ama, 0, LOYAL.half); s.fear = clamp(s.fear + fear, 0, LOYAL.half); };

    // 大会のあとのごほうびのごはん(1回だけ・名声を使う)
    const meal = (s0, key) => {
      const s = clone(s0); const m = MEALS[key];
      if (!s.mealReady || !m || s.fame < m.cost || s.over) return { state: s0, out: { ok: false } };
      s.fame -= m.cost; s.mealReady = false;
      if (m.hp) recover(s, m.hp);
      if (m.ama || m.fear) addLoyalRaw(s, m.ama || 0, m.fear || 0);
      if (m.all) KEYS.forEach(k => addStat(s, k, unitOf(s, k) * m.all));
      s.log.meal = (s.log.meal || 0) + 1;
      return { state: s, out: { ok: true, meal: key } };
    };

    const popGain = (s, v) => Math.round(v * (s.good && s.good.star ? GOOD.star.pop : 1));
    // 育成中に使うアイテム(1ターンに1個まで・ターンを使わない)
    const useItem = (s0, key) => {
      const s = clone(s0); const it = ITEMS[key];
      if (!it || it.use !== 'during' || num(s.bag[key]) <= 0 || s.itemTurn === s.turn || s.over) return { state: s0, out: { ok: false } };
      s.bag[key] -= 1; s.itemTurn = s.turn;
      if (it.hpFull) s.hp = s.hpMax;
      if (it.hp) recover(s, it.hp);
      if (it.cure) { s.yosu = {}; }
      if (it.loyal) addLoyalRaw(s, Math.ceil(it.loyal / 2), Math.floor(it.loyal / 2));
      if (it.stress) addStress(s, it.stress);
      if (it.issaSure) s.issaSure = true;
      if (it.gives) for (const [k, n] of Object.entries(it.gives)) s.bag[k] = num(s.bag[k]) + n;
      s.log.items = (s.log.items || 0) + 1;
      return { state: s, out: { ok: true, item: key } };
    };

    // ---- ターンを閉じる(期末の強制大会・頂への道・デビュー戦の再挑戦をここで立てる) ----
    const endTurn = (s0) => {
      const s = clone(s0);
      if (s.over || s.battle) return { state: s, out: { ok: false } };
      if (!s.acted) return { state: s, out: { ok: false, why: 'not-acted' } };
      const p = periodOf(s.turn);
      if (s.last && s.last.kind === 'retry') s.battle = { kind: 'debut', retry: s.debutLoss, round: 0 };
      else if (p.left === 1 && FORCED[p.key] && p.key !== 'final') s.battle = { kind: p.key, round: 0, wins: 0 };
      else if (p.key === 'final' && p.at >= 3) s.battle = { kind: 'summit', round: p.at - 3 };
      s.acted = false; s.reacted = false; s.issaDone = false; s.last = null; s.mealReady = false;
      if (!s.battle) s.turn += 1;
      if (s.turn > TOTAL_TURNS) s.over = 'done';
      return { state: s, out: { ok: true, battle: s.battle } };
    };

    // ---- 大会の相手(TOURNAMENT §9) ----
    const benchOf = (key) => num(BENCH_USE[key], 1500);
    const opponentsOf = (s) => {
      const b = s.battle; if (!b) return [];
      const rng = rngOf(s.id, s.turn, 'opp', b.kind, b.retry || 0, b.round || 0, ...(b.reroll ? ['re', b.reroll] : []));
      const list = [];
      let sum; let gear; let n = 1; let star = 1;
      if (b.kind === 'summit') { sum = benchOf('summit') * SUMMIT[b.round].mult; gear = OPP_GEAR.final; }
      else if (b.kind === 'debut') { sum = benchOf('debut') * STAR_MULT[1] * Math.max(DEBUT_RETRY_FLOOR, 1 - DEBUT_RETRY_WEAKEN * (b.retry || 0)); gear = OPP_GEAR.debut; }
      else { const f = FORCED[b.kind]; star = f.star; n = f.matches; sum = benchOf(b.kind) * STAR_MULT[star]; gear = OPP_GEAR[b.kind]; }
      for (let j = 0; j < n; j++) {
        const roundAdd = n === 1 ? 0 : ROUND_ADD[3 - n + j];
        const total = sum * (1 + roundAdd) * (1 + (rng() * 2 - 1) * OPP_JITTER);
        const sp = speciesList[Math.floor(rng() * speciesList.length)] || 'Mocchi';
        const w = KEYS.map(k => aptMult(sp, k) * (0.85 + rng() * 0.3)); const ws = w.reduce((a, x) => a + x, 0);
        const stats = {}; KEYS.forEach((k, i) => { stats[k] = clamp(Math.round(total * w[i] / ws), 1, STAT_MAX); });
        list.push({ species: sp, stats, sum: sumOf(stats), techs: gear.techs, mastery: gear.mastery, tactics: gear.tactics, round: j });
      }
      return list;
    };

    // 再戦: 負けた試合の直後(settle の前)に呼ぶ。同じ相手ともう一度(試合の乱数は again で変える)。札を1枚使う
    const canRematch = (s, item = 'sand') => Boolean(s.battle) && Boolean(REMATCH.items[item]) && num(s.items && s.items[item]) > 0 && s.rematchUsed < REMATCH.max;
    const rematch = (s0, item = 'sand') => {
      const s = clone(s0); if (!canRematch(s, item)) return { state: s0, out: { ok: false } };
      s.items[item] -= 1; s.rematchUsed += 1; s.battle.again = num(s.battle.again) + 1; s.log.rematch = (s.log.rematch || 0) + 1;
      if (item === 'rainbow') s.battle.reroll = num(s.battle.reroll) + 1; // 相手を変える
      return { state: s, out: { ok: true, item, left: s.items[item] } };
    };
    // 一度でも(前の育成も含めて)優勝した大会は、結果だけ見て進める(中で試合は計算する・社長 2026-11-12)
    const battleKey = (b) => (b ? (b.kind === 'summit' ? `summit${b.round + 1}` : b.kind) : '');
    const canSkip = (s) => Boolean(s.battle) && (s.wonBefore.includes(battleKey(s.battle)) || s.wonNow.includes(battleKey(s.battle)));

    // 大会の勝ち負けを受けて結果を付ける。wins は試合ごとの勝ち(true/false)の配列(はじめに負けた所まででよい)
    const settle = (s0, wins) => {
      const s = clone(s0); const b = s.battle; if (!b) return { state: s, out: { ok: false } };
      const res = Array.isArray(wins) ? wins.map(Boolean) : [Boolean(wins)];
      const out = { ok: true, kind: b.kind };
      const opp = opponentsOf(s0); const need = opp.length;
      let won = true; let played = 0; for (let j = 0; j < need; j++) { played += 1; if (!res[j]) { won = false; break; } }
      addXp(s, XP.match * played); out.won = won;
      if (won) { s.log.wins += 1; addLoyal(s, LOYAL.win[0], LOYAL.win[1]); const bk = battleKey(b); if (!s.wonNow.includes(bk)) s.wonNow.push(bk); } else s.log.losses += 1;
      // 賞金(名声)とチケット
      const full = b.kind === 'summit' ? PRIZE.summit[b.round] : num(PRIZE[b.kind]);
      const lostAt = won ? -1 : played - 1; const fromEnd = need - 1 - lostAt;
      const prize = won ? full : (need >= 2 && fromEnd < PRIZE_LOSE.length ? Math.round(full * PRIZE_LOSE[fromEnd]) : 0);
      s.fame += prize; s.fameTotal += prize; out.prize = prize;
      if (won) { const t = ticketsOfPrize(full); s.tickets += t; out.tickets = t; }
      s.mealReady = true;
      s.techs.forEach(t => { s.mastery[t] = clamp(num(s.mastery[t]) + played, 0, 100); }); // 試合でも熟練が少し上がる
      s.battle = null;
      if (b.kind === 'debut') {
        if (won) { s.debutWon = true; s.pop = clamp(s.pop + popGain(s, FORCED.debut.pop), 0, 100); gainPts(s, FORCED.debut.pts); s.titles.push(s.debutLoss ? '遅咲きの一歩' : FORCED.debut.title); }
        else { s.debutLoss += 1; if (s.debutLoss >= DEBUT_LOSS_MAX) { s.over = 'gameover'; return { state: s, out: { ...out, gameover: true } }; } }
        s.turn += 1; return { state: s, out };
      }
      if (b.kind === 'summit') {
        if (!won) { s.over = 'lost'; out.end = true; return { state: s, out }; }
        if (b.round === SUMMIT.length - 1) {
          const g = s.crowns >= 1 ? SUMMIT_FINAL.big : SUMMIT_FINAL.plain;
          KEYS.forEach(k => addStat(s, k, g.all)); gainPts(s, g.pts); s.pop = clamp(s.pop + popGain(s, g.pop), 0, 100); s.titles.push(g.title);
        }
        s.turn += 1; if (s.turn > TOTAL_TURNS) s.over = 'done';
        return { state: s, out };
      }
      const f = FORCED[b.kind];
      if (won) { KEYS.forEach(k => addStat(s, k, f.all)); gainPts(s, f.pts); s.pop = clamp(s.pop + popGain(s, f.pop), 0, 100); s.titles.push(f.title); if (f.crown) { s.crowns += 1; s.items[REMATCH.crownWin] += 1; } }
      s.turn += 1; return { state: s, out };
    };
    const gainPts = (s, v) => { const room = PTS.hold - s.pts; const g = Math.max(0, Math.min(room, v)); s.pts += g; s.ptsLost += v - g; };

    // ---- 能力ポイント(TOURNAMENT §7b): 1点で +1・期の目安を超えると 2点で +1 ----
    const ptsCost = (s, k) => (s.stats[k] >= PTS.line[periodOf(s.turn).key] ? 2 : 1);
    const spendPts = (s0, k, times = 1) => {
      const s = clone(s0); let n = 0;
      for (let i = 0; i < times; i++) { if (!KEYS.includes(k) || s.stats[k] >= STAT_MAX) break; const c = ptsCost(s, k); if (s.pts < c) break; s.pts -= c; s.stats[k] += 1; n += 1; }
      return { state: s, out: { ok: n > 0, n } };
    };
    // おまかせ: 低い能力から順に
    const autoPts = (s0) => {
      let s = clone(s0);
      while (s.pts > 0) { const k = KEYS.slice().sort((a, b) => s.stats[a] - s.stats[b])[0]; const r = spendPts(s, k, 1); if (!r.out.ok) break; s = r.state; }
      return { state: s, out: { ok: true } };
    };

    // ---- 評価(引退): 総合力・ランク・アシストポイント・上位3つ ----
    const evaluate = (s) => {
      const loy = loyalOf(s);
      const masteries = (Array.isArray(s.techs) ? s.techs : []).map(t => num(s.mastery && s.mastery[t]));
      const power = C.power({ stats: s.stats, masteries, lv: s.lv, loyal: loy, pop: s.pop });
      const rank = C.rankOf(power);
      return { power, rank: rank.key, points: assistPointsOf(power), top: top3Of(s.stats, s.species), sum: sumOf(s.stats), loyal: loy, ama: s.ama, fear: s.fear, pop: s.pop, lv: s.lv, techs: masteries.length, over: s.over };
    };

    return Object.freeze({
      VERSION, KEYS, STAT_NAMES, PERIODS, TOTAL_TURNS, FORCED, SUMMIT, BASE, RESULTS, RATE, REST, PLAY, CLINIC, COND, LOYAL, GATHER, BOND, STORY, LOTTERY,
      ASSISTS, ISSA, PTS, XP, SHUGYO, ITEMS, GOOD, CARRY_MAX, useItem, TRAIN_LV, trainLvOf, REMATCH, canRematch, rematch, canSkip, battleKey, PRIZE, MEALS, meal, ticketsOfPrize, TECH_MAX, techsOf, canLearn, techRate, learnable, shugyoLeft, teachFrom, BENCH: BENCH_USE, STAR_MULT, TAG_POWER, BOND_START, RANK_ADD, TRAIN_COMBO, AIDS, speciesList,
      rngOf, periodOf, aptMult, initStats, memberOf, memberEffect, newRun, gatherOf, cardMult, peek, failRateOf, sabRateOf, greatRateOf,
      act, react, issa, issaComes, issaRate, endTurn, opponents: opponentsOf, settle, spendPts, autoPts, ptsCost, evaluate, assistPointsOf, loyalOf, loyalMult, top3Of, sumOf,
    });
  };

  const api = Object.freeze({ VERSION, KEYS, TOTAL_TURNS, PERIODS, create, rngOf, hashStr, periodOf, assistPointsOf });
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.MONHERO_SUCCESS = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
