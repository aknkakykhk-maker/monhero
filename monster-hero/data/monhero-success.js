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
//   const v = SUC.peek(s);                 // そのターンの札(編成の子が集まったトレーニング)・博士が来たか・できること
//   s = SUC.act(s, { kind:'train', stat:'pow' }).state;   // トレーニング(6つ)・shugyo・rest・play・clinic・retry(デビュー戦の再挑戦)
//   s = SUC.react(s, 'praise').state;      // トレーニングの結果のあとに 褒める/叱る/なし(null)
//   s = SUC.issa(s, 'hp').state;           // 博士が来ていれば(peek().issa)、選ぶ(none でもよい)
//   s = SUC.endTurn(s).state;              // ターンを閉じる。期末・頂への道なら s.battle に「戦う大会」が入る
//   while (s.battle) { const opp = SUC.opponents(s); /* 対戦の芯で戦う */ s = SUC.settle(s, wins).state; }
//   if (s.over) { const ev = SUC.evaluate(s); }  // 引退(総合力・ランク・アシストポイント)
(function (root) {
  'use strict';

  const VERSION = 9;   // 計算を変えたら上げる(ランキングの行に残る)。9 = 覚醒・超覚醒(2026-11-13)/8 = 修行の作り直し(技のランク1〜5・仕上がりで率・技ごとの外した回数・超修行。2026-11-13)/7 = 間合い適性を育成中に上げる(修行のくじ・間合いの自慢の大会・出来事。2026-11-13)/6 = 助手1人分のストーリー(固有イベント・相手えらび・エンディングとお祝い・2026-11-13)/2 = アシスト能力を第2版の表(段1〜5・数字)で効かせる(2026-11-12)/3 = 第2版のトレーニングに効く11種を足す/4 = いるだけ型(体力・ようす・編成の7つ)を足す/5 = いるだけ型(大会・出来事の8つ)を足す(2026-11-12)
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
    // 大会で戦うのは基本1戦(社長 2026-11-12・TOURNAMENT §15)。組み合わせ表は演出(bracketOf)
    debut: { key: 'debut', name: 'デビュー戦', star: 1, cup: 'debut', all: 0, pts: 5, pop: 3, title: 'はじめの一歩' },
    junior: { key: 'junior', name: 'ジュニアしめくくり杯', star: 2, cup: 'normal', all: 2, pts: 5, pop: 2, title: 'ジュニアの星' },
    middle: { key: 'middle', name: 'ミドルしめくくり杯', star: 3, cup: 'normal', all: 3, pts: 10, pop: 4, title: 'ミドルの星' },
    pro: { key: 'pro', name: '冬のヒーロー記念', star: 4, cup: 'herowinter', all: 4, pts: 20, pop: 8, title: 'ヒーロー記念', crown: true },
  });
  // 頂への道(最後の期の 3・4・5ターン目の終わりに1戦ずつ・負けたら終わり)
  const SUMMIT = Object.freeze([{ round: 1, name: '頂への道 1回戦', mult: 1.2 }, { round: 2, name: '頂への道 準決勝', mult: 1.3 }, { round: 3, name: '頂への道 決勝', mult: 1.4 }]);
  // 決勝に勝ったときの全能力の上乗せ(前は +8 / 👑ありで +15)は、エンディングのお祝い(data/monhero-success-arc.js の PARTY)へ置きかえた(2026-11-13・二重にしない)
  const SUMMIT_FINAL = Object.freeze({ plain: { all: 0, pts: 30, pop: 10, title: '頂に立った子' }, big: { all: 0, pts: 60, pop: 20, title: 'ヒーローの頂' } });
  // エンディング(STORY-ARC.md §4・社長 2026-11-13): bad = 頂への道で負けて終わる / good = 決勝に勝つ /
  //   super = 決勝に勝つ・育成中の助手の親密度が最大・連続イベントを4話まで見た(特別演出つき)。どれも育成完了
  const PARTY0 = Object.freeze({ bad: [5], good: [10, 10, 10], super: [15, 17, 20] }); // 表が無いときの既定(arc.js と同じ)
  // 再戦(社長 2026-11-12・TOURNAMENT.md §14): 大会に負けたとき、アイテムでやり直せる。2種類あわせて1回の育成で3回まで
  //   時渡りの砂時計(sand)= 同じ相手ともう一度/虹の時渡りの砂時計(rainbow)= 相手を変えてもう一度(組み合わせのくじを引き直す)
  //   持ちこみ・出来事・大会のごほうびでもらえる。デビュー戦(案): やり直して勝てば、その負けは「3回負けたらゲームオーバー」に数えない
  const REMATCH = Object.freeze({ max: 3, carry: 3, crownWin: 'sand', items: Object.freeze({ sand: '時渡りの砂時計', rainbow: '虹の時渡りの砂時計' }) });
  const DEBUT_LOSS_MAX = 3;        // デビュー戦に3回負けたらゲームオーバー(§12 E)
  const DEBUT_RETRY_WEAKEN = 0.1;  // 負けるたびに相手が1割ずつ弱く(§12 D)
  const DEBUT_RETRY_FLOOR = 0.6;   // はじめの6割まで
  // 技表の第2版(2026-11-13)で、種によって初めの技の威力が2倍ちがい、能力に合わない種類の技しか届かない間合いもできた。
  //   デビュー戦が技の差だけで決まらないよう、相手は「初めの技の強さ」の差のぶん能力を下げる(下げるだけ・この割合まで)
  const DEBUT_TECH_FLOOR = 0.4;
  // 差の効かせ方は比の2乗(Math.pow は使わない決まりなので、かけ算で)。社長 2026-11-13「少しやさしくする」: ピクシー・イルミネもデビュー戦を越えられるように
  // 初めの技がその子の能力に合わない(その種類の能力が、もう一方の攻撃の能力のこの割合より低い)ときは、
  //   同じ間合いに届く別の種類の技(はじめから覚える条件を満たしているもの)を1つ足して始める
  const START_TECH_FIT = 0.6;

  // ---- 基礎数値(試算 tools/success/success-sim.js で合わせる。ASSIST.md §4 の「基礎数値」) ----
  const BASE = Object.freeze({
    light: 11,                                     // トレーニングの主の能力の基礎(出来事の「トレーニング1回ぶん」の物差しもこれ)
    sub: [0.35, 0.15],                           // ほか2つ(主に対する割合)。トレーニングは1種類ずつ(軽い/重いの区別はなし・社長 2026-11-12)
    hp: 16,                                      // 体力の減り
    stress: 4,                                   // ストレスの増え(方針の倍率をかける)
  });
  // トレーニングで能力は下がらない(社長 2026-11-12: 3能力が上がるだけ・マイナスはなし)
  // トレーニングLv(社長 2026-11-12): トレーニングごと(6能力の6つ)にトレ経験値があり、踏むたびに +1。最大 Lv5。Lv ごとに基礎値が上がる
  const TRAIN_LV = Object.freeze({ max: 5, need: [0, 4, 9, 15, 22], mult: [1, 1.08, 1.16, 1.25, 1.35] }); // 6つのトレーニングそれぞれ。need = その Lv に要る経験の合計
  const trainLvOf = (xp) => { let lv = 1; for (let i = 1; i < TRAIN_LV.max; i++) if (num(xp) >= TRAIN_LV.need[i]) lv = i + 1; return lv; };
  // 1回のトレーニングで上がる3能力の組み合わせ(主 → [ほか1, ほか2])は助手ごとに違う(台帳 2026-11-12)
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
  // 第1版(9種類・3段)+ 試合型5つ。create に第2版の表(deps.assist = MONHERO_SUCCESS_ASSIST)が渡されたら、
  // 芯が効き目を持つ種類は第2版の段(1〜5)と数字で効く(create の中の ASSISTS)。試合型5つはひらめきの保留中なのでこのまま(社長 2026-11-12)
  // 第2版で足した「トレーニングに効く11種」(ASSISTS_V2_TRAIN)は表があるときだけ出る
  const ASSISTS_V1 = Object.freeze({
    sokoji: { name: '特訓の底力', type: 'with', v: [4, 7, 10], cost: [40, 80, 128] },
    kaketsuke: { name: 'かけつけ', type: 'self', v: [8, 14, 20], cost: [32, 64, 104] },
    hirameki: { name: 'ひらめき', type: 'with', v: [3, 5, 8], cost: [32, 64, 104] },
    atooshi: { name: '得意の後押し', type: 'with', v: [8, 14, 20], cost: [24, 48, 80] },
    kizuna: { name: '信頼のきずな', type: 'with', v: [6, 10, 14], cost: [40, 80, 128] },
    ochitsuki: { name: '落ち着き', type: 'with', v: [15, 25, 35], cost: [24, 48, 80] },
    itawari: { name: 'いたわり', type: 'with', v: [8, 14, 20], cost: [24, 48, 80] },
    shugyo: { name: '修行の手ほどき', type: 'stay', v: [10, 18, 25], cost: [24, 48, 80] },
    hitonatsu: { name: '人なつっこさ', type: 'stay', v: [1.2, 1.4, 1.6], cost: [32, 64, 104], start: [5, 10, 15] },
    // 助手のお話のひらめきで取れる5つ(型 battle・社長 2026-11-12): 編成にいると、育てる子の大会の試合で効く(いちばん高い段の1つだけ)。トレーニングには効かない
    //   数字は data/monhero-success-assist.js と同じ(buff は対戦の芯の buffs の形)
    gatsu: { name: '試合のはじめのガッツ', type: 'battle', v: [3, 5, 8], cost: [24, 48, 80], hint: 'atsu', buff: [{ guts: 3 }, { guts: 5 }, { guts: 8 }] },
    miseba: { name: '見せ場', type: 'battle', v: [3, 5, 8], cost: [24, 48, 80], hint: 'momosuke', buff: [{ crit: 0.03 }, { crit: 0.05 }, { crit: 0.08 }] },
    mitate: { name: '見立て', type: 'battle', v: [3, 5, 8], cost: [24, 48, 80], hint: 'kyuko', buff: [{ eva: 0.03 }, { eva: 0.05 }, { eva: 0.08 }] },
    kensho: { name: '検証', type: 'battle', v: [15, 25, 35], cost: [24, 48, 80], hint: 'sorashido', buff: [{ missCut: 0.15 }, { missCut: 0.25 }, { missCut: 0.35 }] },
    mimamori: { name: '見守り', type: 'battle', v: [5, 10, 10], cost: [24, 48, 80], hint: 'erubin', buff: [{ hit1: 0.05 }, { hit1: 0.10 }, { hit1: 0.10, noSulk: true }] },
  });
  // 第2版で足した「トレーニングに効く11種」(数字は第2版の表から読む。表が無いときは出さない)
  //   miharu: サボりの率 −v%/kibarashi: トレーニングでたまるストレス −v%/kun〇〇: その能力のトレーニングの伸び +v%(memberEffect)/
  //   nakayoshi: その子の親密度の上がり +v/tagpow: その子のタッグの強さ +v(%の点)/shitashi: その子のはじめの親密度 +v
  const ASSISTS_V2_TRAIN = Object.freeze({
    miharu: { type: 'with' }, kibarashi: { type: 'with' },
    kunpow: { type: 'with', stat: 'pow' }, kunwise: { type: 'with', stat: 'wise' }, kunhit: { type: 'with', stat: 'hit' },
    kuneva: { type: 'with', stat: 'eva' }, kuntough: { type: 'with', stat: 'tough' }, kunlife: { type: 'with', stat: 'life' },
    nakayoshi: { type: 'with' }, tagpow: { type: 'with' }, shitashi: { type: 'self' },
    // いるだけ型(体力・ようす・編成の7つ・依頼③の1つ目)。編成でいちばん高い段の1つだけ効く(stayLv)
    //   shitsuke: 褒める・叱るで上がる忠誠度 +v%/gussuri: 休んだときの体力の回復 +v%/asobi: 遊んだときの体力の回復と甘え度 +v%/
    //   kuishinbo: ごはんの効き目 +v%/tsukisoi: 通院で治る率 +v点/genki: けが・病気・家出になる率 −v%/tairyoku: 体力の上限 +v(はじめから)
    shitsuke: { type: 'stay' }, gussuri: { type: 'stay' }, asobi: { type: 'stay' }, kuishinbo: { type: 'stay' },
    tsukisoi: { type: 'stay' }, genki: { type: 'stay' }, tairyoku: { type: 'stay' },
    // いるだけ型(大会・出来事の8つ・依頼③の2つ目)
    //   shokin: 大会の賞金(保存は fame)+v%/kokoroe: 大会に勝ったときの能力ポイント +v%/ticket: 賞金ランクが1段上がるたびに v% で修行チケット +1/
    //   rivaldamashii: ライバルに勝ったときの全能力 +v%/ninki: 人気の上がり +v%/yobimizu: 編成の子との出来事 +v点/
    //   mejirushi: イッサ博士が来る率 1ターン +v点/joshu: イッサ博士の実験の成功 +v点(博士の上下の幅の外で足す)
    shokin: { type: 'stay' }, kokoroe: { type: 'stay' }, ticket: { type: 'stay' }, rivaldamashii: { type: 'stay' },
    ninki: { type: 'stay' }, yobimizu: { type: 'stay' }, mejirushi: { type: 'stay' }, joshu: { type: 'stay' },
  });
  const ASSIST_MAX = 4;
  const ASSIST_MAX_V3 = 8;   // 第3版の表のとき1体8種類まで(社長 2026-11-14)
  const ASSIST_LV_MAX = 5;   // 持ち物の段の上限(第2版)。表が第1版のときも段4・5の持ち物は削らない(効き目は表の段数で頭打ち)
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

  // ---- 間合い適性を育成中に上げる上限(2026-11-13 社長の答え 案 C: 1回の育成で合計 +12・1つの間合いの上限なし・どの間合いも M まで) ----
  //   src … 上げ方ごとの上限(quest 修行のくじ・cup 間合いの自慢の大会の優勝・event 出来事の選択肢)
  //   questRate … 修行1回で、その行き先の間合いが1段上がる率。course … 修行の行き先 → 間合い(0 零・1 近・2 中・3 遠)
  const DIST_UP = Object.freeze({
    grades: Object.freeze(['G', 'F', 'E', 'D', 'C', 'B', 'A', 'S', 'S+', 'SS', 'SS+', 'M']),
    total: 12, per: 11, mMax: 4,   // per 11 = G から M まで(1つの間合いの上限なし)・mMax 4 = どの間合いも M にできる
    src: Object.freeze({ quest: 5, cup: 4, event: 3 }),
    questRate: 0.1,
    course: Object.freeze({ fire: 1, ice: 2, wind: 3, star: 0 }),
    // 合体で継ぐ段数(2026-11-13 社長の答え 案 B): 間合いごとに「親2体の段数(継いだ分 + 育成で上げた分)の平均の半分(切り捨て)」
    //   + 2体とも同じ間合いを same 段以上伸ばしていたら bonus。継げる合計は total まで(超えたら小さい間合いから削る)。1体の最大は 12 + 6 = 18
    inherit: Object.freeze({ same: 2, bonus: 2, total: 6 }),
  });
  // ---- 覚醒・超覚醒(2026-11-13 社長)。k = 1 覚醒・2 超覚醒 ----
  //   rate … 毎ターンのくじ(覚醒: ジュニア〜プロ期の毎ターン 0.5% ≒ 1回の育成で約16%・超覚醒: 覚醒したあとの毎ターン 1.6%)
  //   add … 全能力に足す値 / apt … いちばん高い間合い適性から何個を +1段するか / aptMax … 覚醒で上げる段の合計(育成の上限 +12 とは別)
  //   当たったターンは前触れ(s.omen)だけを見せ、次のターンのはじめに必ず起きる。最後の期に当たったら同じターンの終わりに起きる
  const AWAKE = Object.freeze({
    rate: Object.freeze([0.005, 0.016]), add: Object.freeze([30, 40]), apt: Object.freeze([1, 2]), aptMax: 3,
    periods: Object.freeze([Object.freeze(['junior', 'middle', 'pro']), Object.freeze(['junior', 'middle', 'pro', 'final'])]),
    order: Object.freeze([1, 2, 3, 0]), // 同じ段・同じ技の数なら 近・中・遠・零 の順
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
    fixed: Object.freeze({ base: 8, pct: Object.freeze([0.03, 0.01, 0.005]), overlap: 0.5 }), // 決まった数値(2026-11-14 社長): 行き先の基礎 +8・得意 1位3%/2位1%/3位0.5%・重なりは 1/2 ずつ
    gain: 0.9,                 // 1段で2つの能力に「軽いトレーニング1回ぶん」× 0.9 ずつ(2段で4能力ぶん)
    hp: 30, stress: 8,         // 体力を多めに使う
    ticket0: 1,                // はじめのチケット。期ごとの回数は決めず、チケットの数だけ行ける(社長 2026-11-12)
    pick: 2,                   // 覚えたい技は1つか2つ。2つ選ぶと「超修行」(2026-11-13 社長: 育成中2回まで・修行1回分の時間・2つとも覚えることがある・率 +15・能力の上がりと疲れは2回分)
    // 技を覚える率(2026-11-13 社長の決め。数字はこの表だけで変える)
    //   率 = ランクのもとの率 + 仕上がり q(0〜1)× ランクの幅 + ドラ・修行得意・超修行・その技を外した回数×15・出来事(上限 99)
    //   q = 能力(総合力)60% + 忠誠度 20% + 人気 10% + 時期(その行き先の旬)10%。幅は q=1 でちょうど 99 に届く大きさ(ランクが高い技ほど仕上がりが効く)
    rank: Object.freeze({ base: Object.freeze([70, 55, 40, 25, 15]), spread: Object.freeze([29, 44, 59, 74, 84]) }),
    roleRank: Object.freeze({ light: 1, mid: 2, skill: 3, gdown: 3, heavy: 4, far: 4, big: 5, ult: 5 }), // 技表にランク(rank 1〜5)が無い技は、技の種類から
    q: Object.freeze({ stat: 0.6, loyal: 0.2, pop: 0.1, season: 0.1, powerFull: 14000 }), // 能力は総合力 ÷ powerFull(評価 S の入り口 14,000 で 1)
    season: Object.freeze({ star: [3, 4, 5], fire: [6, 7, 8], wind: [9, 10, 11], ice: [12, 1, 2] }), // 行き先の旬の月(星の湖=春・炎の谷=夏・風の森=秋・氷の峰=冬)
    miss: 15,                  // その技を外すたびに、その技だけ次から +15(技ごとに持つ)
    superAdd: 15, superMax: 2, superTickets: 2, // 超修行: 率 +15・育成中2回まで・チケット2枚(2026-11-13 社長)
    draAdd: 10,                // ドラ: 修行で技を覚えやすい
    mastery: 0,                // 修行での熟練はなし(2026-11-13 社長: 熟練は試合で使った回数と大会の出場で上げる。MASTERY)
    joinMax: 3,                // 1段に付いてくる編成の子の数の上限
    rateTop: 99,
  });
  // ---- 総合力の技の分と熟練(2026-11-13 社長・モンサクだけ。助手マスモンの式 MASMON_CALC.power はそのまま) ----
  //   総合力の技1つ = ランクの値 ×(1 +(届く間合いのいちばん高い適性の段 − C)× 0.1)。覚えた技は全部数える。熟練は入れない
  const TECH_POWER = Object.freeze({ rank: Object.freeze([40, 80, 160, 320, 640]), aptStep: 0.1, aptMid: 'C' });
  //   熟練: 試合でその技を1回使うごと +2(1試合で1つの技は +6 まで)・大会に出るたび覚えている全部の技 +2。出来事の「熟練 +」はそのまま
  //   効き目: 熟練100で 威力 +10%・命中 +5%(比例)。試合の芯へは members[].techBoost で渡す。あとでポイントに変えるので
  //   「たまった熟練」s.mastery と「使った量」s.masterySpent を分けて持つ。効き目は「熟練から自動」+「強化した段」s.techUp(いまは使わない)
  const MASTERY = Object.freeze({ perUse: 2, perMatchCap: 6, perCup: 2, max: 100, boost: Object.freeze({ pow: 0.10, hit: 0.05, guts: 0 }) });
  const TECH_MAX = 99; // 覚えられる技の数(2026-11-13 社長「1種が覚えられる技は資料の技を全部(12〜24技)」: 上限 8 をなくし、技表の全部が候補。99 は壊れた保存を読むときの切りそろえだけ)

  // ---- 持ちこみアイテム(社長 2026-11-12・ITEMS-REF.md: 効果も名前も参考のまま。博士はイッサ博士) ----
  //   before = 始める前に使う(その育成にかける)/ during = 育成中にも使える(1ターンに1個まで)
  //   よいようす(good): イベントメーカー・トレーニング得意・修行得意・スターの素質○・うけつぐ魂(育成のあいだずっと続く)
  const ITEMS = Object.freeze({
    guide: { name: '博士の導き書', use: 'before', issaForce: true },        // 1度、イッサ博士が現れる
    loupe: { name: '博士のルーペ', use: 'during', issaSure: true },           // 博士の実験が成功する(博士が来たターンに使う)
    band: { name: '出会いのミサンガ', use: 'before', good: 'eventMaker' },
    mag: { name: '週刊!トレーニング', use: 'before', good: 'trainGood' },
    hachi: { name: '修行のハチマキ', use: 'before', good: 'shugyoGood' },
    omamori: { name: '縁結びのお守り', use: 'before', good: 'star' },
    dango: { name: 'モモのキビダンゴ', use: 'before', hpMax: 20 },                // 体力の最大値が初めから上がる
    grass: { name: 'うけつぎ草', use: 'before', good: 'uketsugu' },
    juice: { name: 'ガロエ印の野菜ジュース', use: 'during', hpFull: true },                 // 体力を完全に回復
    powder: { name: '悪様散', use: 'during', cure: true, hp: 0.3 },               // 悪いようすを治して体力を回復
    license: { name: 'ブリーダーライセンス', use: 'during', ama: 10, fear: 10 },       // 甘え度 +10・恐れ度 +10(忠誠度 +20。2026-11-13 社長)
    pack: { name: 'オイリーパック', use: 'during', gives: { oilyoil: 2, herb: 1 } }, // 中身はオイリーオイル2個と薬草(2026-11-13 社長: 案)
    oil: { name: 'オイル', use: 'during', hp: 0.2 },                                 // 小さいオイル(体力 上限の20%。2026-11-13 社長)
    oilyoil: { name: 'オイリーオイル', use: 'during', hp: 0.4 },                     // 大きいオイル(体力 上限の40%。2026-11-13 社長)
    herb: { name: '薬草', use: 'during', stress: -20 },                          // 詰め合わせの中身(ストレス −20)
    // 大会の賞品(2026-11-13 大会の第2版)。秘薬=そのターンの修行でその間合いの技を覚えやすい/実=そのターンの訓練でその能力が伸びやすい
    elixir0: { name: '零の秘薬', use: 'during', elixir: 0 }, elixir1: { name: '近の秘薬', use: 'during', elixir: 1 },
    elixir2: { name: '中の秘薬', use: 'during', elixir: 2 }, elixir3: { name: '遠の秘薬', use: 'during', elixir: 3 },
    fruit_life: { name: 'いのちの実', use: 'during', fruit: 'life' }, fruit_pow: { name: 'ちからの実', use: 'during', fruit: 'pow' },
    fruit_wise: { name: 'ちえの実', use: 'during', fruit: 'wise' }, fruit_hit: { name: 'ねらいの実', use: 'during', fruit: 'hit' },
    fruit_eva: { name: 'かわしの実', use: 'during', fruit: 'eva' }, fruit_tough: { name: 'かたさの実', use: 'during', fruit: 'tough' },
    stamina: { name: 'スタミナだんご', use: 'during', hpMax: 15 }, // ルーキーズ・クラウンの賞品: 使うと体力の最大値 +15(体力も同じだけ回復)
  });
  const GOOD = Object.freeze({
    eventMaker: { name: 'イベントメーカー', eventRate: 0.25 },              // 編成の子との出来事 +25%(50% → 75%。2026-11-13 社長)
    trainGood: { name: 'トレーニング得意', train: 0.10 },                  // トレーニングの伸び +10%
    shugyoGood: { name: '修行得意', shugyo: 0.20, techRate: 10 },          // 修行の伸び +20%・技を覚える率 +10
    star: { name: 'スターの素質○', pop: 1.5, bond: 1.2 },                // 人気の上がり ×1.5・親密度の上がり ×1.2(良縁)
    uketsugu: { name: 'うけつぐ魂', story: 0.15, teach: 2, start: 2 },  // start: 編成から受け継ぐはじめの能力 ×2(2026-11-13 社長)               // 連続の話が進む率 +15%・3話(伝授)の能力が2倍
  });
  const CARRY_MAX = 2; // 持ちこみは1回の育成で2つまで(社長 2026-11-12。始める前の物と育成中の袋を合わせて)

  // ---- 賞金(保存は fame)と修行チケット(社長 2026-11-12: チケットは大会でもらい、賞金が大きい大会ほど多い) ----
  // 賞金は TOURNAMENT §2 の星の賞金 × 期の倍率(ジュニア ×1・ミドル ×1.25・プロ ×1.5)。頂への道は 800/1500/3000
  // 2026-11-13 社長: 賞金の桁を参考に寄せる(千〜万G。銅2,500〜3,000・銀4,000・金5,000〜7,500・四大12,500・期末 6,000/7,000/8,000・最後の大会 8,000→9,000→10,000)
  const PRIZE = Object.freeze({ debut: 1000, junior: 6000, middle: 7000, pro: 8000, summit: [8000, 9000, 10000] });
  // 修行チケットの数は桁を上げる前の賞金で決める(釣り合いを変えない): 100→1・750→2・1500→3・2250→4
  const TICKET_BASE = Object.freeze({ debut: 100, junior: 250, middle: 750, pro: 2250, summit: [800, 1500, 3000], cup: { 1: 100, 2: 250, 3: 600, 4: 1500 }, period: { junior: 1, middle: 1.25, pro: 1.5, final: 1.5 } });
  const ticketsOfPrize = (prize) => Math.min(4, 1 + Math.floor(num(prize) / 700)); // prize は TICKET_BASE の桁
  // 桁を上げる前の途中の育成は、読み直すときに一度だけ賞金を ×FAME_SCALE する(印 fameV。newRun は FAME_V で始まる)
  const FAME_V = 2; const FAME_SCALE = 8;

  // ---- 大会のあとのごほうびのごはん(社長 2026-11-12: 体力・忠誠度・能力の3種類・値段は賞金) ----
  // 大会が終わるたびに1回だけ選べる(選ばなくてもよい)。次の行動かターンの区切りで消える
  // 2026-11-13 社長: 「いまのごはんは効果が高すぎる」→ 9種に作り直す(体力はどれも回復で、上限は上がらない)。値段なし(社長: 大会後限定なら値段なしでいい)
  //   前の3種(hp・loyal・stat)は途中の育成に保存されない(大会のあとに選ぶ画面の中だけ)ので、読み替えは要らない。知らない名前は食べられない(ok:false)
  const MEAL_WATCH_MULT = 1.5; // えるびんの見守りの大会に勝ったあと、次のごはんの効き目(1回)
  const MEALS = Object.freeze({
    vitamin: { name: 'ビタミンもどき', hp: 0.2, fear: 3 },               // 体力 上限の20%回復・恐れ度 +3
    gochiso: { name: 'ごちそうもどき', hp: 0.2, ama: 3 },                // 体力 上限の20%回復・甘え度 +3
    f_life: { name: 'もりもりニンジン', hp: 0.1, stat: 'life', add: 15 }, // 体力 上限の10%回復・その能力 +15(6種)
    f_pow: { name: 'がっつりお肉', hp: 0.1, stat: 'pow', add: 15 },
    f_wise: { name: 'ひらめきクルミ', hp: 0.1, stat: 'wise', add: 15 },
    f_hit: { name: 'ねらいうちベリー', hp: 0.1, stat: 'hit', add: 15 },
    f_eva: { name: 'ひらりリンゴ', hp: 0.1, stat: 'eva', add: 15 },
    f_tough: { name: 'かちかちイモ', hp: 0.1, stat: 'tough', add: 15 },
    prune: { name: 'スタープルーン', hp: 0.05, pop: 5, pts: 10 },        // 体力 上限の5%回復・人気 +5・能力ポイント +10
  });

  // ---- 能力ポイント(TOURNAMENT §7b) ----
  const PTS = Object.freeze({ hold: 200, line: { debut: 300, junior: 300, middle: 500, pro: 700, final: 700 } });

  // ---- 経験と Lv(総合力の Lv × 15 に入る。助手マスモンとは別の速さ・案) ----
  const XP = Object.freeze({ train: 2, shugyo: 3, match: 2, need: (lv) => 3 + Math.floor(lv / 5) });
  const LV_MAX = 99;

  // ---- 大会の相手(TOURNAMENT §9) ----
  // 基準の強さ B(6能力の合計)。試算(success-sim.js --calibrate)で「ふつうに育てた子」の勝率が
  // ★ 約80%・★★ 約60%・★★★ 約45%・👑 約30%・頂への道の決勝 約25% になるよう求めた値(TOURNAMENT §9 の 8)
  const BENCH = Object.freeze({ debut: 620, junior: 1080, middle: 1820, pro: 2020, summit: 2050 });
  const STAR_MULT = Object.freeze({ 1: 0.75, 2: 0.95, 3: 1.1, 4: 1.25 });
  // ---- 月ごとの大会(TOURNAMENT §4: ジュニア・ミドル・プロは同じ月の並び。最後の期の1・2月はプロと同じ) ----
  //   系統の id は台本の常連の表(MONSUC_REGULAR_CUPS)と同じ。シナリオの大会(§4b)はあとで足す
  const CUP_SYS = Object.freeze({
    str: { stat: 'pow' }, int: { stat: 'wise' }, aim: { stat: 'hit' }, dodge: { stat: 'eva' }, hard: { stat: 'tough' }, life: { stat: 'life' },
    dist0: { dist: 0 }, dist1: { dist: 1 }, dist2: { dist: 2 }, dist3: { dist: 3 },
    attacker: { type: 'attacker' }, tank: { type: 'tank' }, supporter: { type: 'supporter' }, healer: { type: 'healer' }, shadow: { type: 'shadow' },
    spring: {}, summer: {}, autumn: {}, winter: {}, normal: {}, herosummer: { crown: true },
  });
  const YEAR = Object.freeze([
    ['str', 'dist0', 'attacker'], ['int', 'dist1', 'normal'], ['aim', 'spring', 'tank'], ['dodge', 'dist2', 'normal'], ['hard', 'dist3', 'supporter'], ['life', 'summer', 'normal', 'herosummer'],
    ['str', 'dist0', 'healer'], ['int', 'dist1', 'normal'], ['aim', 'autumn', 'shadow'], ['dodge', 'dist2', 'normal'], ['hard', 'dist3', 'attacker'], ['life', 'winter', 'normal'],
  ]);
  const CUP_STAR = Object.freeze({ junior: 1, middle: 2, pro: 3, final: 3 });       // その期の大会の星(👑 は 4)
  const CUP_COUNT = Object.freeze({ junior: 2, middle: 3, pro: 4, final: 4 });      // その期に並ぶ数(プロの 👑 は6月だけ)
  const CUP_PRIZE = Object.freeze({ 1: 1250, 2: 2500, 3: 3500, 4: 5000 });       // 優勝の賞金(ジュニア基準・G)
  const PERIOD_PRIZE = Object.freeze({ junior: 1, middle: 1.2, pro: 1.5, final: 1.5 }); // ★ジュニア 1,250・★★ミドル 3,000・★★★プロ 5,250・👑 7,500
  const CUP_REWARD = Object.freeze({ pts: { 3: 10, 4: 20 }, pop: { 2: 2, 3: 4, 4: 8 }, statUp: { 1: 4, 2: 8, 3: 12 }, crownAll: 4 });
  const CUP_NEED = Object.freeze({ stat: { 1: 150, 2: 300, 3: 500 }, fameNormal3: 9500, fameCrown: 18000 }); // 賞金の合計。桁を上げる前と同じ「その期の大会をあと何勝」で届く値(★★ 約1勝・★★★ 約1.5勝)
  // ---- 大会の第2版(2026-11-13 社長: 参考画像4・参考動画4から一式。名前・ロゴ・絵はうちの物) ----
  //   ふつうの月の並び(YEAR)に、決まった期・月の大会を足す。ex:true の大会は賞金・強さ・出る条件・ごほうびを自分で持つ
  //   str … 相手の強さ(その月の基準 × str)/prize … 優勝の賞金(G)/tk … 修行チケットを決める前の桁(TICKET_BASE と同じ)
  //   need … { rank: 賞金の段 } { stat: 能力の値 } { won: 'sys:星' }(この育成で優勝)/rw … 勝ったときのごほうび
  //   grade … 札の格の色(bronze・silver・gold・green・four・rainbow)
  // 賞金ランク(2026-11-14 社長「このまま作る」・参考の賞金ランクのピラミッド10段)。下から ルーキー〜ヒーロー。
  //   条件: 1 デビュー戦に出る/2 大会で1勝/3〜10 これまでの賞金の合計。段が1つ上がるたびに修行チケット1枚(チケット運で もう1枚)
  //   step は 1〜10(0 はまだデビュー戦の前)。四大大会の出る条件(need.rank)もこの段
  const FAME_RANK = Object.freeze([
    { name: 'ルーキー', cond: 'debut' }, { name: 'はじめの一勝', cond: 'win' }, { name: '一人前', min: 1500 }, { name: 'うできき', min: 3000 }, { name: '期待の星', min: 5000 },
    { name: 'はなまる', min: 8000 }, { name: 'エース', min: 14000 }, { name: 'スター', min: 22000 }, { name: 'チャンピオン', min: 34000 }, { name: 'ヒーロー', min: 50000 },
  ].map(Object.freeze));
  const FAME_RANK_MAX = FAME_RANK.length; // 10
  const rankStepOf = (s) => { // いまの段(0〜10)
    const lg = (s && s.log) || {}; if (num(lg.wins) + num(lg.losses) <= 0) return 0;
    if (num(lg.wins) < 1) return 1; let r = 2;
    for (let i = 2; i < FAME_RANK_MAX; i++) { if (num(s.fameTotal) >= FAME_RANK[i].min) r = i + 1; else break; }
    return r;
  };
  const rankNameOf = (step) => (step >= 1 && step <= FAME_RANK_MAX ? FAME_RANK[step - 1].name : 'デビュー前');
  const rankNeedG = (step) => num((FAME_RANK[step - 1] || {}).min);
  // 段のほかに、優勝の獲得物に付く修行チケット(期末の大会・頂への道の各戦・★★★以上・四大大会)
  const WIN_TICKET = Object.freeze({ forced: Object.freeze(['junior', 'middle', 'pro']), cupStar: 3, add: 1 });
  const DIST_JA = ['零', '近', '中', '遠'];
  const STAT_JA = Object.freeze({ life: 'ライフ', pow: 'ちから', wise: 'かしこさ', hit: '命中', eva: '回避', tough: '丈夫さ' });
  const SEL_NAME = Object.freeze({ life: 'ライフスター選抜', pow: 'パワースター選抜', wise: 'スマートスター選抜', hit: 'ヒットスター選抜', eva: 'ステップスター選抜', tough: 'ガードスター選抜' });
  const MEM_NAME = Object.freeze({ life: '命の灯記念', pow: '剛腕記念', wise: '叡智記念', hit: '一矢記念', eva: '疾風記念', tough: '鉄壁記念' });
  const GEM = Object.freeze({ attacker: ['ルビー記念', 2], tank: ['サファイア記念', 4], supporter: ['エメラルド記念', 6], healer: ['トパーズ記念', 8], shadow: ['アメジスト記念', 10] });
  // 季節の賞: 同じ月に3つ(同じ賞金・金の格)。名前と賞品(上がる能力)だけ違う(社長「名前だけ別で中身が同じ大会は賞品だけ同等の別物に」)
  const SEASON_PRIZE = Object.freeze({ 3: ['春', ['life', 'hit', 'eva']], 6: ['夏', ['pow', 'tough', 'life']], 9: ['秋', ['wise', 'hit', 'eva']], 12: ['冬', ['tough', 'pow', 'wise']] });
  const SEASON_NAMES = ['陽光賞', '月光賞', '星光賞'];
  const EX_CUPS = Object.freeze((() => {
    const L = [];
    // ジュニア期の大一番(超高難度・1つ): 予想「勝ち目なし…」
    L.push({ sys: 'derby', name: 'ルーキーズ・クラウン', p: 'junior', m: 10, star: 3, str: 1.5, prize: 8000, tk: 1500, grade: 'rainbow', hard: true, rw: { all: 3, pts: 15, pop: 6, title: '若き挑戦者', bag: { stamina: 1 } } });
    // 四大大会(ミドル1月・ミドル5月・プロ8月・プロ11月)。4つ全部勝つと「四大大会制覇」
    [['four1', '暁の大杯', 'middle', 1, 6], ['four2', '蒼天杯', 'middle', 5, 6], ['four3', '獅子王杯', 'pro', 8, 7], ['four4', '天頂杯', 'pro', 11, 7]].forEach(([sys, name, p, m, rank], k) => {
      L.push({ sys, name, p, m, star: 4, str: 1.35, prize: 12500, tk: 1500, grade: 'four', four: true, hard: k === 3, need: { rank }, rw: { all: 5, pts: 20, pop: 8, fruitTop: 1, bag: { oilyoil: 1 } } });
    });
    // 間合いの2段: ミドル1月の間合いトーナメント → プロ7月の間合いチャンピオンズ。賞品はその間合いの秘薬
    [0, 1, 2, 3].forEach((d) => {
      L.push({ sys: `distT${d}`, name: `${DIST_JA[d]}の間合いトーナメント`, p: 'middle', m: 1, star: 2, str: STAR_MULT[2], prize: 3500, tk: 250, grade: 'silver', dist: d, rw: { pts: 10, bag: { [`elixir${d}`]: 1 } } });
      L.push({ sys: `distC${d}`, name: `${DIST_JA[d]}チャンピオンズ`, p: 'pro', m: 7, star: 3, str: STAR_MULT[3], prize: 7000, tk: 600, grade: 'gold', dist: d, need: { won: `distT${d}:2` }, rw: { pts: 15, bag: { [`elixir${d}`]: 2 }, apt: d } });
    });
    // 能力の2段: ミドル6月の選抜(その能力が500以上)→ プロ12月の記念(同じ能力の選抜に優勝)
    KEYS.forEach((k) => {
      L.push({ sys: `sel_${k}`, name: SEL_NAME[k], p: 'middle', m: 6, star: 2, str: STAR_MULT[2], prize: 4000, tk: 250, grade: 'green', stat: k, need: { stat: 500 }, rw: { stat: { [k]: 8 }, bag: { [`fruit_${k}`]: 1 } } });
      L.push({ sys: `mem_${k}`, name: MEM_NAME[k], p: 'pro', m: 12, star: 3, str: STAR_MULT[3], prize: 7500, tk: 600, grade: 'gold', stat: k, need: { won: `sel_${k}:2` }, rw: { stat: { [k]: 15 }, loy: 5, bag: { [`fruit_${k}`]: 2 } } });
    });
    // 宝石の記念(タイプの大会の上の段・プロ期): ミドルの同じタイプの大会に優勝で出られる
    Object.entries(GEM).forEach(([t, [name, m]]) => L.push({ sys: `gem_${t}`, name, p: 'pro', m, star: 3, str: STAR_MULT[3], prize: 6750, tk: 600, grade: 'gold', type: t, need: { won: `${t}:2` }, rw: { all: 3, pts: 10, elixirTop: 1 } }));
    // 季節の賞(ミドル・プロの 3・6・9・12月に3つずつ。ジュニアは今までの四季の大会1つのまま)
    ['middle', 'pro'].forEach((p) => Object.entries(SEASON_PRIZE).forEach(([m, [ja, stats]]) => stats.forEach((k, i) => {
      L.push({ sys: `ssn${m}_${i}`, name: `${SEASON_NAMES[i]}(${ja})`, p, m: Number(m), star: CUP_STAR[p], str: STAR_MULT[CUP_STAR[p]], prize: p === 'pro' ? 7000 : 5500, tk: p === 'pro' ? 600 : 250, grade: 'gold', season: true, rw: { stat: { [k]: 8 }, loy: 3, bag: { [`fruit_${k}`]: 1 } } });
    })));
    return L.map(Object.freeze);
  })());
  const EX_BY_SYS = Object.freeze(Object.fromEntries(EX_CUPS.map((c) => [c.sys, c])));
  const FOUR_DONE = Object.freeze({ all: 15, pts: 40, pop: 15, title: '四大の覇者' }); // 四大大会制覇(一度きり)
  const ELIXIR_ADD = 20; // 秘薬: 使ったターンの修行で、その間合いの技の覚える率 +20
  const FRUIT_MULT = 1.5; // 実: 使ったターンの訓練で、その能力の伸び ×1.5
  // シナリオの大会(TOURNAMENT §4b・助手ごとに1〜2つ。並びの月に1つ足す)。sys は 'sc' + 助手
  const SC_CUPS = Object.freeze({
    mua: [{ p: 'junior', m: 8, star: 2 }, { p: 'middle', m: 8, star: 2 }],
    kiki: [{ p: 'middle', m: 10, star: 3 }, { p: 'pro', m: 10, star: 3 }],
    momosuke: [{ p: 'middle', m: 11, star: 2 }, { p: 'pro', m: 11, star: 2 }],
    dra: [{ p: 'middle', m: 7, star: 2 }, { p: 'pro', m: 7, star: 2 }],
    atsu: [{ p: 'pro', m: 4, star: 3 }],
    kyuko: [{ peak: true, star: 2 }],
    sorashido: [{ p: 'middle', m: 2, star: 2 }, { p: 'pro', m: 2, star: 2 }],
    erubin: [{ p: 'junior', m: 5, star: 1 }, { p: 'pro', m: 5, star: 2 }],
  });
  const SC_NAME = Object.freeze({ mua: '笑顔の大会', kiki: '静かな一撃の大会', momosuke: '人気投票の大会', dra: '技くらべの大会', atsu: '格上への挑戦', kyuko: 'ピークの大会', sorashido: '計算どおりの大会', erubin: '見守りの大会' });
  // 助手のお話(EVENTS ②・台本 scenario.js / asst-*.js・台本の担当の案 2026-11-12。数字は仕組み側の案)
  //   good = 4話のいい結末(全能力 特大 + ひらめき)/ bitter = ほろ苦い結末 / special = 特別な1話を見たとき、頂への道の1回戦だけ効く(重ねがけなし)
  const ASST_STORY = Object.freeze({
    // special は対戦の芯の buffs の形(guts・hit1・crit・missCut・eva・noSulk。docs/spec/ASSISTANT_MASMON_BATTLE.md「その試合だけの上乗せ」)
    //   と、画面・サクセス側の印(line = 最後の一言が変わる・showFirst = 相手の1手目を見せる・noInjury = 試合中のけがなし)
    mua: { good: { hint: 'tech', name: 'みんなの声' }, bitter: { pop: 10 }, special: { line: true } },
    atsu: { good: { hint: 'assist', name: '試合のはじめのガッツ' }, bitter: { pts: 10 }, special: { guts: 10 } },
    kiki: { good: { hint: 'tech', name: '静かな一撃' }, bitter: { stat: 'tough' }, special: { hit1: 0.15 } },
    momosuke: { good: { hint: 'assist', name: '見せ場' }, bitter: { pop: 10 }, special: { crit: 0.10 } },
    dra: { good: { hint: 'tech', name: 'ドラ直伝' }, bitter: { mastery: 10 }, special: { missCut: 0.5 } },
    kyuko: { good: { hint: 'assist', name: '見立て' }, bitter: { stat: 'wise' }, special: { showFirst: true, eva: 0.10 } },
    sorashido: { good: { hint: 'assist', name: '検証' }, bitter: { pts: 10 }, special: { noInjury: true, guts: 5 } },
    erubin: { good: { hint: 'assist', name: '見守り' }, bitter: { loyal: 10 }, special: { noSulk: true } },
  });
  // 話の進み方(EVENTS ②: どの助手も同じ形)。bond = 育成中の助手の親密度・lv = 助手ライフの仲良し度の段で見られる話の上限
  const ASTORY = Object.freeze({
    eps: Object.freeze([{ ep: 1, period: 'debut', bond: 0 }, { ep: 2, period: 'junior', bond: 30 }, { ep: 3, period: 'middle', bond: 50 }, { ep: 4, period: 'pro', bond: 70 }]),
    // 1〜4話は助手ライフの仲良し度 Lv に関係なく見られる・特別な1話だけ Lv5〜(社長 2026-11-13。前は Lv1〜2 が1話だけ・Lv3〜4 が3話まで)
    lvMax: () => 4, specialLv: 5,
    rate: 0.4,                                       // 条件に届いたターンに出る率(期の最後のターンは必ず)
  });
  const STORY_GOOD_ALL = 1.75; // いい結末の全能力 = トレーニング1回ぶん × 1.75(EVENTS §3 の「特大」)
  const STORY_BIG = 2;         // ほろ苦い結末の「大+」= トレーニング2回ぶん
  const RUNNER_UP = 0.4; // 負けたときは準優勝の扱い(★★ 以上・賞金の40%)
  // ライバル(TOURNAMENT §8b・社長 2026-11-12): 月のはじめに決まる・札にアイコン・ごほうびが大きい
  const RIVAL = Object.freeze({ rate: 0.25, str: 1.1, prize: 1.5, all: 12, tickets: 1, title: 'ライバルに勝った' }); // ごほうびの主は全能力 +12(社長 2026-11-12)
  const OPP_JITTER = 0.08;
  // 大会の相手の人気・忠誠度 [人気, 忠誠](期の基準)と上乗せ。忠誠は高め(言うことを聞かない番が多すぎると相手が弱くなりすぎる)・人気は期とともに上がる
  const OPP_POPLOY = Object.freeze({ debut: [10, 60], junior: [20, 65], middle: [35, 70], pro: [50, 75], final: [65, 80] });
  const OPP_POPLOY_ADD = Object.freeze({ champ: [20, 15], rival: [10, 5] });
  const OPP_GEAR = Object.freeze({ debut: { techs: 2, mastery: 10, tactics: 5 }, junior: { techs: 2, mastery: 20, tactics: 10 }, middle: { techs: 3, mastery: 40, tactics: 20 }, pro: { techs: 4, mastery: 60, tactics: 30 }, final: { techs: 5, mastery: 80, tactics: 40 } });

  const create = (deps) => {
    const C = deps && deps.calc;
    if (!C || typeof C.power !== 'function') throw new Error('monhero-success: calc(MASMON_CALC)が要る');
    // ランダムイベント(monhero-success-events.js・開発部 2026-11-12)。部品は create の終わりで作る(芯の内部の関数を渡すため)。無ければ今までどおり
    let EV = null;
    const evMod = (s, k, a) => (EV ? EV.mod(s, k, a) : (k === 'stress' || k === 'inj' ? 1 : 0));
    // アシスト能力: 第2版の表があれば、芯が効き目を持つ種類を第2版の段と数字にする(無い・壊れていれば第1版)。新しい種類は効き目を作るまで出さない
    const AT = deps && deps.assist && deps.assist.BY_ID && typeof deps.assist.BY_ID === 'object' ? deps.assist : null;
    // 第3版の表(2026-11-14 社長「%は細かくポイントで」): 段の代わりに「目盛り」。持ち物の lv は目盛り(1〜その種類の max)
    const AV3 = !!(AT && AT.VERSION === 3 && typeof AT.fromSaved === 'function');
    const ASSISTS = (() => {
      const T = AT ? AT.BY_ID : null;
      if (!T) return ASSISTS_V1;
      if (AV3) { // 表の種類すべて。試合型だけは第1版の数字のまま(ひらめきは社長の保留中・2026-11-12)
        const out = {};
        Object.values(T).forEach((a) => {
          if (!a || typeof a.id !== 'string' || !Array.isArray(a.v) || !Array.isArray(a.cost) || a.v.length !== a.cost.length || !a.v.every(Number.isFinite)) return;
          if (a.type === 'battle') { if (ASSISTS_V1[a.id]) out[a.id] = ASSISTS_V1[a.id]; return; }
          out[a.id] = Object.freeze({ name: a.name, type: a.type, v: a.v.slice(), cost: a.cost.slice(), max: a.v.length, ...(a.stat ? { stat: a.stat } : {}), ...(Array.isArray(a.start) ? { start: a.start.slice() } : {}) });
        });
        return Object.freeze(out);
      }
      const nums = (x) => Array.isArray(x) && x.length >= 1 && x.length <= ASSIST_LV_MAX && x.every(Number.isFinite);
      const out = {};
      Object.keys(ASSISTS_V1).forEach((id) => {
        const b = ASSISTS_V1[id]; const a = T[id];
        if (b.type === 'battle' || !a || a.type !== b.type || !nums(a.v) || !nums(a.cost) || a.cost.length !== a.v.length) { out[id] = b; return; }
        out[id] = Object.freeze({ ...b, name: typeof a.name === 'string' && a.name ? a.name : b.name, v: a.v.slice(), cost: a.cost.slice(), ...(b.start ? { start: nums(a.start) && a.start.length === a.v.length ? a.start.slice() : b.start } : {}) });
      });
      // 第2版で足した「トレーニングに効く11種」(2026-11-12 バトル部・窓口の依頼②)。表にあって形が正しいときだけ効く(表が無ければ出さない)
      Object.keys(ASSISTS_V2_TRAIN).forEach((id) => {
        const w = ASSISTS_V2_TRAIN[id]; const a = T[id];
        if (!a || a.type !== w.type || !nums(a.v) || !nums(a.cost) || a.cost.length !== a.v.length || (w.stat && a.stat !== w.stat)) return;
        out[id] = Object.freeze({ name: typeof a.name === 'string' && a.name ? a.name : id, type: w.type, v: a.v.slice(), cost: a.cost.slice(), ...(w.stat ? { stat: w.stat } : {}) });
      });
      return Object.freeze(out);
    })();
    // 段 lv の効き目(表の段数より上の段は、表のいちばん上の段の値)
    const aOf = (id, key, lv) => { const arr = ASSISTS[id] && ASSISTS[id][key]; return Array.isArray(arr) && lv > 0 ? arr[Math.min(lv, arr.length) - 1] : undefined; };
    const APT = (deps && deps.apt) || {};
    const BENCH_USE = Object.freeze({ ...BENCH, ...((deps && deps.bench) || {}) }); // 試算で基準を探すときだけ外から渡す
    const INIT = (deps && deps.init) || {};
    const TECHS = (deps && deps.techs && deps.techs.species) || {}; // 助手マスモンの技表(無ければ技なしで動く)
    // 技表の第2版(2026-11-13 キズナ): 技 id が変わる。古い id は canon で新しい id へ読み替える(無い表では読み替えない)。保存は書き換えない
    const techCanon = (id) => { try { return deps && deps.techs && typeof deps.techs.canon === 'function' ? deps.techs.canon(id) : id; } catch (e) { return id; } };
    // 技の並び(と熟練)を読み替える。2つの古い技が1つの新しい技に当たるときは、重ねず・熟練は大きい方
    const canonTechList = (ids) => (Array.isArray(ids) ? ids : []).filter(t => typeof t === 'string').map(techCanon).filter((t, i, a) => a.indexOf(t) === i);
    const canonMastery = (m) => { const o = {}; if (m && typeof m === 'object' && !Array.isArray(m)) for (const [k, v] of Object.entries(m)) { const c = techCanon(k); const x = Number(v); if (Number.isFinite(x)) o[c] = Math.max(o[c] == null ? -Infinity : o[c], x); } return o; };
    const techsOf = (sp) => (Array.isArray(TECHS[sp]) ? TECHS[sp] : []);
    const startTechs = (sp) => techsOf(sp).filter(t => t && t.learn && t.learn.start).map(t => t.id);
    // 育成を始めるときの技(START_TECH_FIT)。表の「初めの技」+ 能力に合わない技の間合いを埋める技(1つの技につき1つまで)
    const startTechsRun = (sp) => {
      const base = startTechs(sp); const st = initStats(sp); const own = techsOf(sp); const out = base.slice();
      base.forEach((id) => {
        const t = own.find(x => x && x.id === id); if (!t || (t.kind !== 'pow' && t.kind !== 'wise')) return;
        const other = t.kind === 'pow' ? 'wise' : 'pow';
        if (num(st[t.kind]) >= num(st[other]) * START_TECH_FIT) return;
        const dist = Array.isArray(t.dist) ? t.dist : [];
        const ready = (x) => x && x.kind === other && !out.includes(x.id) && Array.isArray(x.dist) && x.dist.some(d => dist.includes(d))
          && !(x.need && Object.keys(x.need).length) && Object.entries((x.learn && x.learn.st) || {}).every(([k, v]) => num(st[k]) >= num(v));
        const alt = own.filter(ready).sort((x, y) => num(x.rank) - num(y.rank) || num(y.power) - num(x.power))[0];
        if (alt && out.length < TECH_MAX) out.push(alt.id);
      });
      return out;
    };
    const APT_MULT = Object.freeze({ A: 1.3, B: 1.15, C: 1, D: 0.85, E: 0.7 }); // AMG_APT_MULT と同じ値
    const speciesList = Object.keys(INIT).filter(k => Array.isArray(INIT[k])).filter(k => !(deps && deps.monsters && deps.monsters[k] && deps.monsters[k].draft)); // 下書きの子は出さない
    const RIVALS_OK0 = (x) => x && typeof x === 'object' && speciesList.includes(x.species);
    const aptStr = (sp) => (typeof APT[sp] === 'string' && APT[sp].length === 6 ? APT[sp] : 'CCCCCC');
    const aptMult = (sp, k) => APT_MULT[aptStr(sp)[KEYS.indexOf(k)]] || 1;
    // 合体で継いだ間合い適性の段数 [零,近,中,遠](各 0〜11 の整数・合計は DIST_UP.inherit.total まで。超えたら後ろの間合いから削る)
    const aptBaseNorm = (v) => {
      const o = [0, 1, 2, 3].map(i => clamp(Math.round(num(Array.isArray(v) ? v[i] : 0)), 0, DIST_UP.grades.length - 1)); let over = o.reduce((a, b) => a + b, 0) - DIST_UP.inherit.total;
      for (let i = 3; i >= 0 && over > 0; i--) { const cut = Math.min(o[i], over); o[i] -= cut; over -= cut; }
      return o;
    };
    // 覚醒で上げた間合い適性の段数 [零,近,中,遠](各 0〜3・合計 AWAKE.aptMax まで。超えたら後ろの間合いから削る)
    const aptAwakeNorm = (v) => {
      const o = [0, 1, 2, 3].map(i => clamp(Math.round(num(Array.isArray(v) ? v[i] : 0)), 0, AWAKE.aptMax)); let over = o.reduce((a, b) => a + b, 0) - AWAKE.aptMax;
      for (let i = 3; i >= 0 && over > 0; i--) { const cut = Math.min(o[i], over); o[i] -= cut; over -= cut; }
      return o;
    };
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
        // 第3版: 古い子の段(n の無い lv)は表の fromSaved で目盛りへ読み替える(効き目は変わらない)。中では lv = 目盛り・n も持つ
        if (AV3) { const n = AT.fromSaved(a); if (n > 0) { out.push({ id, lv: n, n }); seen[id] = true; } if (out.length >= ASSIST_MAX_V3) break; continue; }
        out.push({ id, lv: clamp(Math.round(num(a.lv, 1)), 1, ASSIST_LV_MAX) }); seen[id] = true; if (out.length >= ASSIST_MAX) break;
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
      // 総合力: 技の並びがある保存枠の子はモンサクの式(TECH_POWER・印 pv 2)。古い形(熟練の数だけ)・ベースモン・
      //   この式より前に始めた育成の編成(保存から戻すとき power はあるが pv が無い)は今までの式(育成の途中でランクが変わらないように)
      const pv2 = !base && Array.isArray(o.techs) && (o.pv === 2 || o.power === undefined);
      const power = pv2 ? powerOfParts({ stats, lv, loyal: loy, pop }, techRowsOf({ species: sp, techs: canonTechList(o.techs), aptUp: o.aptUp, aptBase: o.aptBase, aptAwake: o.aptAwake }))
        : C.power({ stats, masteries, lv, loyal: loy, pop });
      const rank = base ? 'base' : C.rankOf(power).key;
      const top = base ? aptTop3(sp) : top3Of(stats, sp);
      const assists = base ? [] : normAssists(o.assists);
      const own = techsOf(sp).map(t => t.id);
      const techs = base ? startTechs(sp) : (Array.isArray(o.techs) ? canonTechList(o.techs).filter(t => own.includes(t)).slice(0, TECH_MAX) : startTechs(sp));
      const lvOf = (id) => { const a = assists.find(x => x.id === id); return a ? a.lv : 0; };
      const bonus = {}; KEYS.forEach(k => { const i = top.indexOf(k); bonus[k] = i < 0 ? 0 : r2(stats[k] / 40 * POS_COEF[i] + (base ? 0 : RANK_ADD[rank])); });
      const kake = lvOf('kaketsuke'); const fav = Math.min(GATHER.favCap, GATHER.fav + (kake ? aOf('kaketsuke', 'v', kake) / 100 : 0));
      const hn = lvOf('hitonatsu'); const sh = lvOf('shitashi'); const so = lvOf('shutsugen');
      return {
        ...(so ? { none: num(aOf('shutsugen', 'v', so)) } : {}),
        ...(pv2 ? { pv: 2 } : {}), kind: base ? 'base' : 'raised', species: sp, name: typeof o.name === 'string' ? o.name.slice(0, 24) : sp, stats, loy, pop, lv, masteries, rank, power, top, assists, bonus, fav, techs,
        tag: base ? TAG_POWER.base : TAG_POWER[rank], bond0: clamp((base ? BOND_START.base : BOND_START[rank]) + (hn ? aOf('hitonatsu', 'start', hn) : 0) + (sh ? num(aOf('shitashi', 'v', sh)) : 0), 0, BOND.max),
        startAdd: { stat: top[0], v: Math.floor(stats[top[0]] / START_STAT_DIV) },
      };
    };
    const assistLv = (m, id) => { const a = m.assists.find(x => x.id === id); return a ? a.lv : 0; };
    // その子がその能力のトレーニングにいるときの効き(%)= 能力の補正 + いっしょ型アシスト
    const memberEffect = (m, k, loy) => {
      let v = m.bonus[k] || 0;
      const so = assistLv(m, 'sokoji'); if (so) v += aOf('sokoji', 'v', so);
      const at = assistLv(m, 'atooshi'); if (at && m.top[0] === k) v += aOf('atooshi', 'v', at);
      const ki = assistLv(m, 'kizuna'); if (ki) v += aOf('kizuna', 'v', ki) * clamp(num(loy), 0, 100) / 100;
      const ku = assistLv(m, `kun${k}`); if (ku) v += num(aOf(`kun${k}`, 'v', ku)); // 能力ごとの特訓: その能力のトレーニングに来たときだけ
      return r2(v);
    };
    const stayLv = (team, id) => team.reduce((a, m) => Math.max(a, assistLv(m, id)), 0); // いるだけ型は編成でいちばん高い段の1つだけ
    const stayNum = (s, id) => { const lv = stayLv(s.team, id); return lv ? num(aOf(id, 'v', lv)) : 0; }; // その効き目の数(無ければ 0)
    // ---- 第3版で足したアシスト効果(2026-11-14 社長「参考で使えそうなのは全部」・ASSIST-V3.md) ----
    const withSum = (s, card, id) => { let v = 0; if (card) card.members.forEach(i => { const lv = assistLv(s.team[i], id); if (lv) v += num(aOf(id, 'v', lv)); }); return v; }; // いっしょ型を足す
    const withMax = (s, card, id) => { let v = 0; if (card) card.members.forEach(i => { const lv = assistLv(s.team[i], id); if (lv) v = Math.max(v, num(aOf(id, 'v', lv))); }); return v; };
    const FAME_FULL = 18000; // 「励」「賞金の勢い」が満タンになる賞金の合計(ヒーローズ・クラウンに出られる額 CUP_NEED.fameCrown)
    const fameFrac = (s) => clamp(num(s.fameTotal) / FAME_FULL, 0, 1);
    const SEASON_OF = Object.freeze({ haru: [3, 4, 5], natsu: [6, 7, 8], aki: [9, 10, 11], fuyu: [12, 1, 2] });
    // その子のいっしょ型の効き(能力の補正を除く)。助手・継承で、来ていない子の分を足すときに使う
    const assistPart = (m, k, loy) => r2(memberEffect(m, k, loy) - (m.bonus[k] || 0));
    // トレーニングLvの上乗せ: トレレベルアップ(来た子のいちばん大きい1つ)+ 逆境トレレベルアップ(ピークの外)
    const trainLvAdd = (s, card) => (card && card.kind === 'train' ? withMax(s, card, 'trainlv') + (withMax(s, card, 'gyakkyo') && peakInfo(s).state !== 'in' ? 1 : 0) : 0);
    const superMaxOf = (s) => SHUGYO.superMax + (s && Array.isArray(s.team) ? stayNum(s, 'chokyo') : 0);

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
      // 持ちこみ: carry = 始める前に使う物(3つまで)・bag = 育成中に使う物の数
      const carry = (Array.isArray(src.carry) ? src.carry : []).filter(k => ITEMS[k] && ITEMS[k].use === 'before').filter((k, i, a) => a.indexOf(k) === i).slice(0, CARRY_MAX);
      // うけつぎ草(うけつぐ魂): 編成から受け継ぐはじめの能力が2倍(2026-11-13 社長)
      const startMul = carry.some(k => ITEMS[k].good === 'uketsugu') ? GOOD.uketsugu.start : 1;
      team.forEach(m => { stats[m.startAdd.stat] = clamp(stats[m.startAdd.stat] + m.startAdd.v * startMul, 0, STAT_MAX); });
      const aidLv = clamp(Math.round(num(src.aidBondLv, 1)), 1, 10);
      const bag = {}; let room = CARRY_MAX - carry.length;
      if (src.bag && typeof src.bag === 'object') for (const [k, v] of Object.entries(src.bag)) if (ITEMS[k] && ITEMS[k].use === 'during' && room > 0) { const n = clamp(Math.round(num(v)), 0, room); if (n > 0) { bag[k] = n; room -= n; } }
      const good = {}; let hpMax = HP_MAX0; let issaForce = false;
      carry.forEach(k => { const it = ITEMS[k]; if (it.good) good[it.good] = true; if (it.hpMax) hpMax = Math.min(HP_MAX_CAP, hpMax + it.hpMax); if (it.issaForce) issaForce = true; });
      const ty = stayLv(team, 'tairyoku'); if (ty) hpMax = Math.min(HP_MAX_CAP, hpMax + num(aOf('tairyoku', 'v', ty))); // 💪体力自慢
      const hn = stayLv(team, 'hitonatsu');
      const stayT = (id) => { const lv = stayLv(team, id); return lv ? num(aOf(id, 'v', lv)) : 0; };
      const sk = stayT('shoki'); if (sk) KEYS.forEach(k => { stats[k] = clamp(stats[k] + sk, 0, STAT_MAX); }); // 🌅初期ステータスアップ
      return {
        v: VERSION, id, species, aid, type: typeIdx, turn: 1, stats, hpMax, hp: hpMax, stress: 0, carry, bag, good, issaForce, issaSure: false, itemTurn: 0,
        ama: LOYAL.start[0], fear: LOYAL.start[1], pol: clamp(Math.round(num(src.pol)), -3, 3), pp: 0, pop: 0, pts: 0, ptsLost: 0, lv: 1, xp: 0,
        team, bond: team.map(m => m.bond0), story: team.map(() => 0), aidBond: clamp(aidLv * BOND.aidPerLv + (hn ? aOf('hitonatsu', 'start', hn) : 0), 0, BOND.max),
        techs: startTechsRun(species), mastery: Object.fromEntries(startTechsRun(species).map(t => [t, 0])), masterySpent: {}, tickets: SHUGYO.ticket0 + stayT('ticket0'), shugyoUsed: {}, pity: 0, techMiss: {}, superLeft: SHUGYO.superMax + stayT('chokyo'), fame: 0, fameTotal: 0, fameV: FAME_V, fourDone: false, elixir: null, fruit: null, mealReady: false, trainXp: {}, aidLv, astory: { ep: 0, path: null, done: false }, rivalMet: null, ending: null, aptUp: [0, 0, 0, 0], aptLog: { quest: 0, cup: 0, event: 0 }, aptBase: aptBaseNorm(src.aptBase), awake: 0, awakeTurn: 0, aptAwake: [0, 0, 0, 0], omen: null,
        items: { sand: clamp(Math.round(num(src.items && src.items.sand)), 0, REMATCH.carry), rainbow: clamp(Math.round(num(src.items && src.items.rainbow)), 0, REMATCH.carry) }, rematchUsed: 0, wonBefore: Array.isArray(src.wonBefore) ? src.wonBefore.filter(k => typeof k === 'string').slice(0, 64) : [], wonNow: [], rivals: (Array.isArray(src.rivals) ? src.rivals : []).filter(RIVALS_OK0).slice(0, 8).map(r => ({ name: String(r.name || '').slice(0, 24), breeder: typeof r.breeder === 'string' ? r.breeder.slice(0, 24) : null, kind: r.kind === 'friend' ? 'friend' : 'aid', species: r.species, stats: normStats(r.stats, r.species) })),
        cond: null, yosu: {}, hirameki: false, shBoost: false, idle: 0, issaMet: 0, issaWon: 0, issaDone: false,
        debutLoss: 0, debutWon: false, fameRank: 0, crowns: 0, titles: [], battle: null, over: null, last: null, acted: false, reacted: false,
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
        const favUnit = m.fav / (GATHER.top[0] + GATHER.top[1] + GATHER.top[2]); const restUnit = (1 - m.fav) / (GATHER.else + Math.max(0, GATHER.none - num(m.none))); // 🚪トレーニング出現率アップ
        let a = 0; let stat = null;
        for (let j = 0; j < 3 && !stat; j++) { a += GATHER.top[j] * favUnit; if (x < a) stat = m.top[j]; }
        if (!stat) { a += GATHER.else * restUnit; if (x < a) { const others = KEYS.filter(k => !m.top.includes(k)); stat = others[Math.floor(y * others.length)]; } }
        if (!stat && evMod(s, 'iki', i) && rngOf(s.id, s.turn, 'iki', i)() < evMod(s, 'iki', i)) stat = m.top[0]; // 🤝息ぴったり(並びを変えない別の乱数)
        if (stat) cards[cardKey(kind, stat)].members.push(i);
      });
      if (rng() < GATHER.aidRate + stayNum(s, 'aidcome') / 100) { const all = Object.keys(cards); cards[all[Math.floor(rng() * all.length)]].aid = true; } // 🙋助手の出現率アップ
      return cards;
    };
    // その札の「足し算」と「タッグ」(ASSIST §4)
    const cardMult = (s, card) => {
      const loy = loyalOf(s); let add = 0; let tag = 0; const tags = [];
      card.members.forEach(i => { const m = s.team[i]; add += (memberEffect(m, card.stat, loy) + evMod(s, 'boost', i)) / 100; if (s.bond[i] >= BOND.tag) { const tp = assistLv(m, 'tagpow'); tag += (m.tag + (tp ? num(aOf('tagpow', 'v', tp)) : 0)) / 100; tags.push(i); } });
      if (card.members.length >= GATHER.groupMin) add += (GATHER.groupAdd * 100 + withSum(s, card, 'ninzu')) / 100; // 👥トレ人数効果アップ
      if (card.kind === 'train') {
        const hg = withSum(s, card, 'hagemi'); if (hg) add += hg * fameFrac(s) / 100; // 🏅トレ効果アップ・励
        const mo = monthOf(s.turn); Object.keys(SEASON_OF).forEach(id => { if (SEASON_OF[id].includes(mo)) add += withSum(s, card, id) / 100; }); // 🌸☀🍁⛄季節
        if (card.aid) {
          add += stayNum(s, 'aidtrain') / 100; // 🏋助手・鍛錬
          // 🔗助手・継承: 来ていない子のうち、いっしょ型がいちばん大きい1体の分
          let best = 0; s.team.forEach((m, i) => { if (!card.members.includes(i) && assistLv(m, 'aidkeisho')) best = Math.max(best, assistPart(m, card.stat, loy)); });
          add += best / 100;
        }
      }
      if (card.aid && s.aidBond >= BOND.tag) { tag += TAG_POWER.aid / 100; tags.push('aid'); }
      const loyM = card.aid && card.kind === 'train' ? 1 + (loyalMult(loy) - 1) * (1 + stayNum(s, 'aidtrust') / 100) : loyalMult(loy); // 🤲助手・信頼
      return { add: r2(add), tag: r2(tag), tags, mult: r2((1 + add) * (1 + tag)), loyM: r2(loyM) };
    };

    // ---- 確率 ----
    const failRateOf = (s, card) => {
      const ratio = s.hpMax > 0 ? s.hp / s.hpMax : 0;
      let f = RATE.fail + (s.yosu.sabori ? RATE.saboriGuse : 0);
      if (ratio < RATE.failHpFrom) { const d = (RATE.failHpFrom - ratio) / RATE.failHpFrom; f += d * d * RATE.failHpTop; }
      let cut = 0; if (card) card.members.forEach(i => { const lv = assistLv(s.team[i], 'ochitsuki'); if (lv) cut += aOf('ochitsuki', 'v', lv) / 100; });
      f *= 1 - Math.min(0.8, cut);
      if (s.aid === 'dra') f *= 0.7;
      if (num(s.fear) >= 40) f *= RATE.failFearHi;
      if (card) f += evMod(s, 'fail', card.stat); // 出来事「好きなトレーニング」: そのトレーニングの失敗 −10%
      return clamp(f, 0, RATE.failCap);
    };
    // card があれば、いっしょに来た子の「見張り役」でサボりの率が減る(合わせて −80% まで)
    const cutOf = (s, card, id) => { let c = 0; if (card) card.members.forEach(i => { const lv = assistLv(s.team[i], id); if (lv) c += num(aOf(id, 'v', lv)) / 100; }); return Math.min(0.8, c); };
    const sabRateOf = (s, card) => { const ev = evMod(s, 'sab'); const base = s.pol >= 0 ? ev : RATE.sab[-s.pol - 1] * (num(s.ama) >= 40 ? RATE.sabAmaHi : 1) + ev; return base * (1 - cutOf(s, card, 'miharu')); }; // ev = 出来事の 💤ねぼけ
    const greatRateOf = (s, card) => {
      let g = RATE.great + (loyalOf(s) >= 80 ? RATE.greatLoyal80 : 0) + (s.hirameki ? 0.10 : 0) + evMod(s, 'great');
      if (card) card.members.forEach(i => { const lv = assistLv(s.team[i], 'hirameki'); if (lv) g += aOf('hirameki', 'v', lv) / 100; });
      if (card) {
        g += withSum(s, card, 'ninkigreat') * clamp(num(s.pop), 0, 100) / 100 / 100; // 📣人気度効果大成功アップ
        g += withSum(s, card, 'challenge') * (Array.isArray(s.titles) ? s.titles.length : 0) / 100; // 🎖チャレンジ・幸運
        g += stayNum(s, 'ikioi') * fameFrac(s) / 100; // 💹賞金の勢い
        if (card.aid) g += stayNum(s, 'aidluck') / 100; // 🌈助手・幸運
      }
      return clamp(g, 0, 0.6);
    };

    // ---- そのターンの見通し(画面の札・試算の作戦が読む) ----
    const issaComes = (s) => {
      const p = periodOf(s.turn);
      const inWindow = (p.key === 'junior' && p.at >= 7) || p.key === 'middle' || p.key === 'pro';
      if (!inWindow || s.issaMet >= ISSA.maxMeet || s.cond || s.over) return false;
      if (s.issaForce && s.issaMet === 0) return true; // イッサ博士の研究ノート: 1度は必ず来る(来られる最初のターン)
      if (s.stress >= ISSA.stressNo) return false;
      return rngOf(s.id, s.turn, 'issa-meet')() < ISSA.rate + stayNum(s, 'mejirushi') / 100; // 🧪博士の目じるし
    };
    const issaRate = (s, key) => {
      const c = ISSA.choices[key]; if (!c || key === 'none') return 0;
      let d = 0;
      if (loyalOf(s) >= ISSA.upLoyal) d += ISSA.up;
      if (s.hp >= s.hpMax * ISSA.upHp) d += ISSA.up;
      if (s.issaMet >= 2) d += ISSA.upAgain;
      if (s.hp <= s.hpMax * ISSA.downHp) d += ISSA.downHpV;
      if (s.stress >= ISSA.downStress) d += ISSA.downStressV;
      d += evMod(s, 'issa'); // 🔥やる気満々 +5%・🌀ふてくされ −5%(EVENTS 4-⑥)
      d = clamp(d, -ISSA.band, ISSA.band);
      return clamp(c.p + d + stayNum(s, 'joshu') / 100, 0, ISSA.top); // 🔬博士の助手(幅の外で足す・上限 95% はそのまま)
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
    // 技のランク(1〜5)。技表の rank が無ければ技の種類から
    const techRank = (t) => (t && Number.isInteger(t.rank) && t.rank >= 1 && t.rank <= 5 ? t.rank : (SHUGYO.roleRank[t && t.role] || 3));
    // 仕上がりの度合い q(0〜1)。course は行き先(時期の旬を見る。省くと時期は 0)
    const shugyoQ = (s, course) => {
      const Q = SHUGYO.q; const power = powerOf(s);
      const inSeason = course && SHUGYO.season[course] && SHUGYO.season[course].includes(monthOf(s.turn)) ? 1 : 0;
      return r2(clamp(Q.stat * clamp(power / Q.powerFull, 0, 1) + Q.loyal * clamp(loyalOf(s) / 100, 0, 1) + Q.pop * clamp(num(s.pop) / 100, 0, 1) + Q.season * inSeason, 0, 1));
    };
    const fruitMul = (s, k) => (s.fruit && s.fruit.turn === s.turn && s.fruit.stat === k ? FRUIT_MULT : 1);
    const elixirOn = (s, t) => Boolean(s.elixir && s.elixir.turn === s.turn && Array.isArray(t && t.dist) && t.dist.includes(s.elixir.d));
    const techMissOf = (s, id) => clamp(Math.round(num(s.techMiss && s.techMiss[id])), 0, 20);
    // 覚える率(0〜0.99)。o.course … 行き先 / o.super … 超修行
    const techRate = (s, t, o) => {
      const opt = o || {}; const k = techRank(t) - 1;
      const v = SHUGYO.rank.base[k] + shugyoQ(s, opt.course) * SHUGYO.rank.spread[k] + techMissOf(s, t.id) * SHUGYO.miss + (opt.super ? SHUGYO.superAdd : 0) + (elixirOn(s, t) ? ELIXIR_ADD : 0)
        + (s.aid === 'dra' ? SHUGYO.draAdd : 0) + (s.good && s.good.shugyoGood ? GOOD.shugyoGood.techRate : 0) + evMod(s, 'tech') * 100 + (Array.isArray(s.team) ? stayNum(s, 'waza') : 0); // 📖技習得率アップ
      return clamp(v, 0, SHUGYO.rateTop) / 100;
    };
    const superLeft = (s) => clamp(Math.round(num(s && s.superLeft, superMaxOf(s))), 0, superMaxOf(s)); // 🌋超修行アップで回数が増える
    const learnable = (s, course) => techsOf(s.species).filter(t => canLearn(s, t)).map(t => ({ id: t.id, name: t.name, role: t.role, power: t.power, rank: techRank(t), miss: techMissOf(s, t.id), rate: r2(techRate(s, t, { course })), superRate: r2(techRate(s, t, { course, super: true })) }));
    const learnTech = (s, id) => { s.techs.push(id); s.mastery[id] = 0; };
    // 修行で上がる決まった数値(①行き先の基礎 + ②編成の得意。③の倍率はかける前)。画面の見通しにも使う
    const shugyoGainOf = (s, course) => {
      const F = SHUGYO.fixed; const o = Object.fromEntries(KEYS.map(k => [k, 0]));
      ((SHUGYO.courses[course] || SHUGYO.courses.fire).stages || []).forEach(pair => pair.forEach(k => { o[k] += F.base; }));
      KEYS.forEach(k => {
        const c = (s.team || []).map(m => { const i = (m && Array.isArray(m.top) ? m.top : []).indexOf(k); return i < 0 || !m.stats ? 0 : num(m.stats[k]) * (F.pct[i] || 0); }).filter(v => v > 0).sort((x, y) => y - x);
        let w = 1; c.forEach(v => { o[k] += v * w; w *= F.overlap; });
      });
      KEYS.forEach(k => { o[k] = Math.round(o[k] * 10) / 10; });
      return o;
    };
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
      for (const [key, c] of Object.entries(cards)) { const xp = num(s.trainXp && s.trainXp[key]); const lv = trainLvOf(xp); view[key] = { ...c, ...cardMult(s, c), fail: r2(failRateOf(s, c)), great: r2(greatRateOf(s, c)), sab: r2(sabRateOf(s, c)), lv, xp, next: lv >= TRAIN_LV.max ? 0 : TRAIN_LV.need[lv] - xp }; }
      const retry = s.debutLoss > 0 && !s.debutWon;
      const can = s.over ? [] : s.cond ? ['cond'] : retry ? ['retry'] : ['train', 'rest', 'play'].concat(cupsOf(s).some(c => c.entry.ok) ? ['cup'] : [], shugyoLeft(s) > 0 ? ['shugyo'] : [], s.yosu.sabori || s.yosu.utsu ? ['clinic'] : []);
      return { turn: s.turn, period: p, toEnd: TOTAL_TURNS - s.turn + 1, cards: view, sab: r2(sabRateOf(s)), can, shugyo: { left: shugyoLeft(s), tickets: s.tickets, techs: learnable(s), superLeft: superLeft(s) }, cups: cupsOf(s), issa: !s.acted ? false : (!s.issaDone && issaComes(s)), story: s.acted ? null : storyDue(s), retry, cond: s.cond };
    };

    // ---- 伸び(ASSIST §4 の1本の式) ----
    const ageOf = (s) => {
      const a = C.ageMult(s.type, (s.turn - 1) / TOTAL_TURNS);
      const pk = s && Array.isArray(s.team) ? stayNum(s, 'peak') : 0; if (!pk) return a; // 📈ピークターンアップ: ピークのあとも pk ターン、ピークの終わりの伸び
      const T = peakTurnsOf(s); if (!T.length) return a; const to = T[T.length - 1];
      return s.turn > to && s.turn <= to + pk ? Math.max(a, C.ageMult(s.type, (to - 1) / TOTAL_TURNS)) : a;
    };
    const unitOf = (s, k) => BASE.light * aptMult(s.species, k) * ageOf(s); // 「軽いトレーニング1回ぶん」
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
      const mult = v > 0 ? (aOf('hitonatsu', 'v', stayLv(s.team, 'hitonatsu')) || 1) * (s.good && s.good.star ? GOOD.star.bond : 1) : 1;
      if (i === 'aid') s.aidBond = clamp(Math.round(s.aidBond + v * mult), 0, BOND.max); else s.bond[i] = clamp(Math.round(s.bond[i] + v * mult), 0, BOND.max);
    };

    // 編成の子とのトレーニングイベント(1ターン1回まで・50%)。試算は1つ目の選択肢を選ぶ
    const trainEvent = (s, card, rng, out) => {
      if (!card.members.length || rng() >= BOND.eventRate + (s.good && s.good.eventMaker ? GOOD.eventMaker.eventRate : 0) + stayNum(s, 'yobimizu') / 100) return; // 💬出来事の呼び水
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
      // けが(体力が少ないときのトレーニング)・病気(ストレス)・家出(忠誠が低くストレスが高い)
      const ratio = s.hp / s.hpMax; const soft = (s.aid === 'sorashido' ? COND.sorashido : 1) * (1 - Math.min(0.8, stayNum(s, 'genki') / 100)); // 🍀元気のお守り
      if (kind === 'train' && ratio < COND.injLowHp && rng() < COND.injTrain * soft * (EV ? EV.mod(s, 'inj') : 1)) {
        let len = rng() < 0.5 ? COND.injLen[0] : COND.injLen[1]; if (s.aid === 'erubin') len = Math.max(1, len - 1);
        return { kind: 'injury', left: len };
      }
      if (s.stress >= COND.illStress && rng() < COND.illRate * soft) return { kind: 'ill', left: COND.illLen };
      if (loyalOf(s) < COND.awayLoyal && s.stress >= COND.awayStress && rng() < COND.awayRate * (1 - Math.min(0.8, stayNum(s, 'genki') / 100))) { addLoyal(s, COND.awayAma, COND.awayFear); return { kind: 'away', left: COND.awayLen }; }
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
      if (retry) { // デビュー戦の再挑戦: トレーニングはできない。ターンの終わりに戦う
        if (kind !== 'retry') return { state: s0, out: { ok: false, why: 'retry-only' } };
        s.acted = true; s.last = { kind: 'retry' }; return { state: s, out };
      }
      const rng = rngOf(s.id, s.turn, 'act');
      if (kind === 'train') {
        const stat = KEYS.includes(a.stat) ? a.stat : 'pow';
        const card = v.cards[cardKey(kind, stat)];
        const pS = sabRateOf(s, card); const pF = failRateOf(s, card); const pG = greatRateOf(s, card);
        const x = rng(); const res = x < pS ? 'sab' : x < pS + pF ? 'fail' : x < pS + pF + pG ? 'great' : 'ok';
        s.hirameki = false;
        const R = RESULTS[res];
        const pol = C.policyOf(s.pol);
        const ck = cardKey(kind, stat); const tlv = trainLvOf(s.trainXp[ck]); const tlvE = Math.min(TRAIN_LV.max, tlv + trainLvAdd(s, card)); // 📶トレレベルアップ
        const mult = BASE.light * (1 + (s.good && s.good.trainGood ? GOOD.trainGood.train : 0)) * TRAIN_LV.mult[tlvE - 1] * pol.gain * ageOf(s) * R.mult * (1 + card.add) * (1 + card.tag) * (card.loyM || loyalMult(loyalOf(s)));
        s.trainXp[ck] = num(s.trainXp[ck]) + 1; out.trainLv = trainLvOf(s.trainXp[ck]); out.lvUp = out.trainLv > tlv;
        const combo = (TRAIN_COMBO[s.aid] || TRAIN_COMBO.mua)[stat];
        const shares = [1, BASE.sub[0], BASE.sub[1]];
        const gains = {};
        [stat, combo[0], combo[1]].forEach((k, j) => { const g = mult * shares[j] * aptMult(s.species, k) * fruitMul(s, k); gains[k] = (gains[k] || 0) + g; });
        const before = { ...s.stats };
        Object.entries(gains).forEach(([k, g]) => addStat(s, k, g));
        let it = 0; card.members.forEach(i => { const lv = assistLv(s.team[i], 'itawari'); if (lv) it += aOf('itawari', 'v', lv) / 100; });
        const hpCost = BASE.hp * R.hp * (1 - Math.min(0.6, it)) * (s.aid === 'kiki' ? 0.85 : 1); // きき: トレーニングの疲れ −15%
        s.hp = clamp(Math.round(s.hp - hpCost), 0, s.hpMax);
        const kf = withSum(s, card, 'kaifuku'); if (kf && res !== 'sab') s.hp = clamp(Math.round(s.hp + kf), 0, s.hpMax); // 💧トレ後回復効果アップ
        const ts = withMax(s, card, 'tsuika'); // ➕追加トレボーナス(別の乱数で並びを変えない)
        if (ts && res !== 'sab' && res !== 'fail') { const tr = rngOf(s.id, s.turn, 'tsuika'); if (tr() < ts / 100) { const k = KEYS[Math.floor(tr() * KEYS.length)]; const g = 5 + Math.floor(tr() * 16); const b0 = s.stats[k]; addStat(s, k, g); out.tsuika = { stat: k, v: s.stats[k] - b0 }; } }
        const stUp = BASE.stress * pol.stress + R.stress;
        addStress(s, stUp * (EV && stUp > 0 ? EV.mod(s, 'stress') : 1) * (stUp > 0 ? 1 - cutOf(s, card, 'kibarashi') : 1)); // 🎵ごきげん: 増えが半分/🎈気晴らし: 増えを減らす
        card.members.forEach(i => { const nk = assistLv(s.team[i], 'nakayoshi'); addBond(s, i, BOND.train + (nk ? num(aOf('nakayoshi', 'v', nk)) : 0)); }); if (card.aid) addBond(s, 'aid', BOND.train);
        addXp(s, XP.train);
        s.log.train += 1; s.log[res] += 1; s.log.tagTurns[Math.min(3, card.tags.length)] += 1;
        out.result = res; out.card = { kind, stat, add: card.add, tag: card.tag, tags: card.tags, members: card.members.slice() };
        out.gain = {}; KEYS.forEach(k => { if (s.stats[k] !== before[k]) out.gain[k] = s.stats[k] - before[k]; });
        trainEvent(s, card, rng, out);
        const cd = condRoll(s, rng, kind); if (cd) { s.cond = cd; out.cond = cd.kind; }
        s.last = { kind, res }; s.acted = true; s.reacted = false;
        return { state: s, out };
      }
      if (kind === 'cup') { // 月の大会に出る(ターンを使う・ターンの終わりに1戦)
        const c = cupsOf(s).find(x => x.id === (a && a.id));
        if (!c || !c.entry.ok) return { state: s0, out: { ok: false, why: c ? c.entry.why : 'no-cup' } };
        s.acted = true; s.last = { kind: 'cup', cup: { id: c.id, sys: c.sys, star: c.star, rival: c.rival || null } };
        return { state: s, out: { ok: true, cup: c.id } };
      }
      if (kind === 'shugyo') {
        const pk = periodOf(s.turn).key;
        if (shugyoLeft(s) <= 0) return { state: s0, out: { ok: false, why: 'no-shugyo' } };
        const course = SHUGYO.courses[a.course] ? a.course : 'fire';
        // 選んだ技(1つか2つ)。2つなら超修行(育成中 SHUGYO.superMax 回まで)。率は修行の前の仕上がりで決める(画面に出した率と同じ)
        const want = (Array.isArray(a.techs) ? a.techs : []).filter((id, i, arr) => arr.indexOf(id) === i).slice(0, SHUGYO.pick).map(id => techById(s.species, id)).filter(t => canLearn(s, t));
        const sup = want.length >= 2;
        if (sup && superLeft(s) <= 0) return { state: s0, out: { ok: false, why: 'no-super' } };
        if (sup && num(s.tickets) < SHUGYO.superTickets) return { state: s0, out: { ok: false, why: 'no-ticket2' } };
        const rates = want.map(t => techRate(s, t, { course, super: sup }));
        if (sup) s.superLeft = superLeft(s) - 1;
        s.tickets -= sup ? SHUGYO.superTickets : 1; s.shugyoUsed[pk] = num(s.shugyoUsed[pk]) + 1;
        // 2026-11-14 社長: 修行には成功・大成功・失敗・サボりはない(確率は技を覚えるのと間合いの適性だけ)
        const res = 'ok'; const R = RESULTS.ok; const pol = C.policyOf(s.pol);
        // ⚔修行効果アップ: 修行の上がりの合計の最後にかける倍率 ×(1 + v%)(窓口 2026-11-14)
        const sl = stayLv(s.team, 'shugyo'); const boost = 1 + (sl ? aOf('shugyo', 'v', sl) / 100 : 0);
        // 📚技習得効果アップ(覚えた技1つにつき)・🔮修行チャンスの「修行の気合い」(1回で消える)
        const boost2 = (1 + stayNum(s, 'wazakazu') * s.techs.length / 100) * (s.shBoost ? 1.2 : 1); s.shBoost = false;
        const toku = stayNum(s, 'shugyotoku'); // 🗡修行特別効果アップ
        const before = { ...s.stats };
        // 編成の補正もトレーニングと同じ考え方でかける(社長 2026-11-12): 段ごとに、その段の能力が上位3つにある子が付いてくる(多いときは補正の大きい3体まで)
        const stages = [];
        for (let round = 0; round < (sup ? 2 : 1); round++) SHUGYO.courses[course].stages.forEach((pair, si) => { // 超修行は能力の上がりが2回分
          const who = s.team.map((m, i) => ({ i, v: Math.max(memberEffect(m, pair[0], loyalOf(s)) * (m.top.includes(pair[0]) ? 1 : 0), memberEffect(m, pair[1], loyalOf(s)) * (m.top.includes(pair[1]) ? 1 : 0)) }))
            .filter(x => x.v > 0).sort((p, q) => q.v - p.v || p.i - q.i).slice(0, SHUGYO.joinMax).map(x => x.i);
          if (!round) stages.push(who);
          who.forEach(i => addBond(s, i, BOND.train / 2));
        });
        // 上がる量は決まった数値(2026-11-14 社長。種族・年齢・方針・忠誠では変えない)。修行1回ぶん × (超修行は2回)
        //   ① 行き先の基礎: 行き先の4能力に各 SHUGYO.fixed.base
        //   ② 編成の得意: 子それぞれの得意 1位×3%・2位×1%・3位×0.5%(その子の能力の値から)。同じ能力が重なったら大きい順に 1・1/2・1/4…
        //   ③ ①+②の合計に、修行のハチマキ・アシスト「修行効果アップ」を最後にかける
        const fixed = shugyoGainOf(s, course); const mul = (1 + (s.good && s.good.shugyoGood ? GOOD.shugyoGood.shugyo : 0)) * boost;
        KEYS.forEach(k => { if (fixed[k] > 0) addStat(s, k, (fixed[k] * boost2 + toku) * mul * (sup ? 2 : 1)); }); // 📚🔮は①②にかけ、🗡は足してから ⚔(mul)をかける
        out.stages = stages;
        const tired = sup ? 2 : 1; // 超修行は疲れも2回分
        s.hp = clamp(Math.round(s.hp - SHUGYO.hp * R.hp * tired * (1 - stayNum(s, 'shugyohp') / 100)), 0, s.hpMax); addStress(s, (SHUGYO.stress * pol.stress + R.stress) * tired); // 🍃修行の体力消費ダウン
        s.techs.forEach(t => { s.mastery[t] = clamp(num(s.mastery[t]) + Math.round(SHUGYO.mastery * boost), 0, 100); });
        // 技のくじ: 選んだ技それぞれ(超修行なら2つとも覚えることがある)。外した技は、その技だけ次から +SHUGYO.miss(技ごと)
        const tries = []; const got = [];
        want.forEach((t, i) => { const hit = rng() < rates[i]; tries.push({ id: t.id, rate: r2(rates[i]), hit }); if (hit) got.push(t.id); });
        got.forEach(id => { learnTech(s, id); s.log.learned += 1; if (s.techMiss) delete s.techMiss[id]; });
        tries.filter(x => !x.hit).forEach(x => { s.techMiss = { ...(s.techMiss || {}), [x.id]: techMissOf(s, x.id) + 1 }; });
        addXp(s, XP.shugyo); s.log.shugyo += 1; s.log.train += 1; s.log[res] += 1;
        // 間合いのくじ: 行き先の間合いが1割で1段上がる(サボりは無し・別の乱数で並びを変えない)
        const qd = DIST_UP.course[course];
        for (let round = 0; round < (sup ? 2 : 1); round++) if (rngOf(s.id, s.turn, 'aptq', round || '')() < DIST_UP.questRate + stayNum(s, 'aptq') / 100 && addAptUp(s, qd, 'quest')) out.aptUp = { dist: qd, grade: aptGradesOf(s)[qd] }; // 超修行は2回くじ
        out.result = res; out.course = course; out.learned = got[0] || null; out.learnedAll = got; out.tries = tries; out.super = sup;
        out.gain = {}; KEYS.forEach(k => { if (s.stats[k] !== before[k]) out.gain[k] = s.stats[k] - before[k]; });
        s.last = { kind: 'shugyo', res }; s.acted = true; s.reacted = false;
        return { state: s, out };
      }
      if (kind === 'rest') {
        let x = rng(); let pick = REST[1]; for (const r of REST) { if (x < r.p) { pick = r; break; } x -= r.p; }
        recover(s, pick.rec * (1 + stayNum(s, 'gussuri') / 100)); addStress(s, REST_STRESS * (s.aid === 'mua' ? 1.3 : 1)); // 💤ぐっすり
        s.log.rest += 1; out.rest = pick.key; s.last = { kind }; s.acted = true;
        const cd = condRoll(s, rng, kind); if (cd) { s.cond = cd; out.cond = cd.kind; }
        return { state: s, out };
      }
      if (kind === 'play') {
        const asb = 1 + stayNum(s, 'asobi') / 100; // 🪁遊び上手
        recover(s, PLAY.rec * asb); addStress(s, PLAY.stress * (s.aid === 'mua' ? 1.3 : 1));
        if (s.yosu.utsu) { delete s.yosu.utsu; out.cured = ['utsu']; } // 遊ぶでうつ病が治る(先に治してから甘え度を足す)
        addLoyal(s, PLAY.ama * asb, 0);
        // 🎲トレーニングチャンス(ひらめき)・🔮修行チャンス(修行の気合い)。別の乱数で並びを変えない
        const tc = stayNum(s, 'trchance'); if (tc && rngOf(s.id, s.turn, 'trchance')() < tc / 100) { s.hirameki = true; out.hirameki = true; }
        const sc = stayNum(s, 'shchance'); if (sc && rngOf(s.id, s.turn, 'shchance')() < sc / 100) { s.shBoost = true; out.shBoost = true; }
        s.log.play += 1; s.last = { kind }; s.acted = true;
        return { state: s, out };
      }
      if (kind === 'clinic') {
        if (!s.yosu.sabori && !s.yosu.utsu) return { state: s0, out: { ok: false, why: 'no-yosu' } };
        const cured = [];
        for (const key of ['sabori', 'utsu']) {
          const y = s.yosu[key]; if (!y) continue;
          const p = y.visits >= 1 ? 1 : CLINIC.first + (s.aid === 'erubin' ? CLINIC.erubinAdd : 0) + stayNum(s, 'tsukisoi') / 100; // 🏥通院の付きそい
          if (rng() < p) { delete s.yosu[key]; cured.push(key); } else y.visits += 1;
        }
        recover(s, CLINIC.rec); s.log.clinic += 1; out.cured = cured; s.last = { kind }; s.acted = true;
        return { state: s, out };
      }
      return { state: s0, out: { ok: false, why: 'unknown' } };
    };

    // 叱る・褒める(トレーニングの結果のあと1回。しなくてもよい)
    const react = (s0, how) => {
      const s = clone(s0);
      if (!s.last || !['train', 'shugyo'].includes(s.last.kind) || s.reacted) return { state: s, out: { ok: false } };
      const good = s.last.res === 'great' || s.last.res === 'ok';
      s.reacted = true;
      const shk = 1 + stayNum(s, 'shitsuke') / 100; const up = (x) => (x > 0 ? x * shk : x); // 📏しつけ上手: 上がる分だけ増える
      if (how === 'praise') { const d = good ? LOYAL.praiseGood : LOYAL.praiseBad; addLoyal(s, up(d[0] + (s.aid === 'mua' ? 1 : 0)), up(d[1])); const m = C.policyMove(s.pol, s.pp, -1); s.pol = m.pol; s.pp = m.pp; s.idle = 0; }
      else if (how === 'scold') { const d = good ? LOYAL.scoldGood : LOYAL.scoldBad; addLoyal(s, up(d[0] + evMod(s, 'scold')), up(d[1])); const m = C.policyMove(s.pol, s.pp, 1); s.pol = m.pol; s.pp = m.pp; s.idle = 0; }
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

    // 大会のあとのごほうびのごはん(1回だけ・賞金を使う)
    const meal = (s0, key) => {
      const s = clone(s0); const m = Object.prototype.hasOwnProperty.call(MEALS, key) ? MEALS[key] : null;
      // 2026-11-14 社長: 勝ったあとのごはんはただ(賞金を使わない)。
      // えるびんの見守りの大会に勝った印 freeMeal は「次のごはんの効き目 ×1.5(1回)」に読み替える(社長の決め 2026-11-14・食いしん坊と掛け合わせ)
      if (!s.mealReady || !m || s.over) return { state: s0, out: { ok: false } };
      s.mealReady = false;
      const boost = s.freeMeal === true ? MEAL_WATCH_MULT : 1; s.freeMeal = false;
      const kui = (1 + stayNum(s, 'kuishinbo') / 100) * boost; // 🍙食いしん坊: ごはんの効き目が増える(見守りの ×1.5 と掛け合わせ)
      if (m.hp) recover(s, m.hp * kui);
      if (m.ama || m.fear) addLoyalRaw(s, Math.round((m.ama || 0) * kui), Math.round((m.fear || 0) * kui));
      if (m.stat && KEYS.includes(m.stat)) addStat(s, m.stat, Math.round(m.add * kui));
      if (m.pop) s.pop = clamp(s.pop + popGain(s, Math.round(m.pop * kui)), 0, 100);
      if (m.pts) gainPts(s, Math.round(m.pts * kui));
      s.log.meal = (s.log.meal || 0) + 1;
      return { state: s, out: { ok: true, meal: key, boost } };
    };

    // 決める前の見通し(画面の「ちから +38・体力 −26・ストレス +8」): 成功のときの伸び
    const preview = (s, a) => {
      const kind = a && a.kind; const stat = KEYS.includes(a && a.stat) ? a.stat : 'pow';
      if (kind !== 'train') return null;
      const v = peek(s); const card = v.cards[cardKey('train', stat)]; const pol = C.policyOf(s.pol);
      const mult = BASE.light * (1 + (s.good && s.good.trainGood ? GOOD.trainGood.train : 0)) * TRAIN_LV.mult[Math.min(TRAIN_LV.max, card.lv + trainLvAdd(s, card)) - 1] * pol.gain * ageOf(s) * (1 + card.add) * (1 + card.tag) * (card.loyM || loyalMult(loyalOf(s)));
      const combo = (TRAIN_COMBO[s.aid] || TRAIN_COMBO.mua)[stat]; const shares = [1, BASE.sub[0], BASE.sub[1]]; const gain = {};
      [stat, combo[0], combo[1]].forEach((k, j) => { gain[k] = (gain[k] || 0) + Math.round(mult * shares[j] * aptMult(s.species, k) * fruitMul(s, k)); });
      let it = 0; card.members.forEach(i => { const lv = assistLv(s.team[i], 'itawari'); if (lv) it += aOf('itawari', 'v', lv) / 100; });
      return { gain, hp: Math.round(BASE.hp * (1 - Math.min(0.6, it)) * (s.aid === 'kiki' ? 0.85 : 1)), stress: Math.round(BASE.stress * pol.stress * (BASE.stress * pol.stress > 0 ? 1 - cutOf(s, card, 'kibarashi') : 1)), fail: card.fail, great: card.great, sab: card.sab, lv: card.lv };
    };
    // 保存から戻す: 形を確かめて直した s(だめなら null)。数は Number.isFinite・配列は Array.isArray・知らない値は既定
    const restore = (raw) => {
      if (!raw || typeof raw !== 'object' || Array.isArray(raw) || typeof raw.id !== 'string') return null;
      if (!speciesList.includes(raw.species)) return null;
      const base = newRun({ id: raw.id, species: raw.species, aid: raw.aid, team: Array.isArray(raw.team) ? raw.team : [], type: Number.isInteger(raw.type) ? raw.type : undefined });
      const out = clone(base);
      const n = (v, d, lo, hi) => (Number.isFinite(Number(v)) && v !== null && v !== '' ? clamp(Number(v), lo, hi) : d);
      out.turn = Math.round(n(raw.turn, 1, 1, TOTAL_TURNS + 1));
      out.stats = normStats(raw.stats, raw.species);
      out.hpMax = Math.round(n(raw.hpMax, HP_MAX0, 1, HP_MAX_CAP)); out.hp = Math.round(n(raw.hp, out.hpMax, 0, out.hpMax));
      for (const [k, lo, hi] of [['stress', 0, 100], ['ama', 0, LOYAL.half], ['fear', 0, LOYAL.half], ['pol', -3, 3], ['pp', -9, 9], ['pop', 0, 100], ['pts', 0, PTS.hold], ['ptsLost', 0, 1e6], ['lv', 1, LV_MAX], ['xp', 0, 1e4],
        ['aidBond', 0, BOND.max], ['tickets', 0, 99], ['pity', 0, 100], ['fame', 0, 1e7], ['fameTotal', 0, 1e7], ['issaMet', 0, ISSA.maxMeet], ['issaWon', 0, ISSA.maxMeet], ['debutLoss', 0, DEBUT_LOSS_MAX], ['crowns', 0, 9], ['rematchUsed', 0, REMATCH.max], ['idle', 0, 99], ['itemTurn', 0, TOTAL_TURNS + 1]]) out[k] = Math.round(n(raw[k], out[k], lo, hi));
      // 賞金の桁を上げる前(印 fameV が無い)の途中の育成は、一度だけ ×FAME_SCALE。out.fameV は newRun の FAME_V なので二度は掛からない
      if (raw.fameV !== FAME_V) { out.fame = Math.round(clamp(out.fame * FAME_SCALE, 0, 1e7)); out.fameTotal = Math.round(clamp(out.fameTotal * FAME_SCALE, 0, 1e7)); }
      if (Array.isArray(raw.bond)) out.bond = out.bond.map((d, i) => Math.round(n(raw.bond[i], d, 0, BOND.max)));
      if (Array.isArray(raw.story)) out.story = out.story.map((d, i) => Math.round(n(raw.story[i], d, 0, 3)));
      const okTech = techsOf(raw.species).map(t => t.id);
      if (Array.isArray(raw.techs)) { const rm = canonMastery(raw.mastery); out.techs = canonTechList(raw.techs).filter(t => okTech.includes(t)).slice(0, TECH_MAX); out.mastery = Object.fromEntries(out.techs.map(t => [t, Math.round(n(rm[t], 0, 0, 100))])); }
      { const sp0 = canonMastery(raw.masterySpent); out.masterySpent = {}; (out.techs || []).forEach(t => { const v = Math.round(n(sp0[t], 0, 0, MASTERY.max)); if (v > 0) out.masterySpent[t] = v; }); } // 熟練の使った量(あとでポイントに変える分・いまは 0)
      out.trainXp = {}; if (raw.trainXp && typeof raw.trainXp === 'object') Object.keys(raw.trainXp).forEach(key => { if (KEYS.some(k => key === `train:${k}`)) out.trainXp[key] = Math.round(n(raw.trainXp[key], 0, 0, 999)); });
      out.items = { sand: Math.round(n(raw.items && raw.items.sand, 0, 0, 99)), rainbow: Math.round(n(raw.items && raw.items.rainbow, 0, 0, 99)) };
      out.bag = {}; if (raw.bag && typeof raw.bag === 'object') for (const [k, v] of Object.entries(raw.bag)) if (ITEMS[k] && ITEMS[k].use === 'during') out.bag[k] = Math.round(n(v, 0, 0, 99));
      out.carry = Array.isArray(raw.carry) ? raw.carry.filter(k => ITEMS[k] && ITEMS[k].use === 'before').slice(0, CARRY_MAX) : [];
      out.good = {}; if (raw.good && typeof raw.good === 'object') Object.keys(GOOD).forEach(k => { if (raw.good[k]) out.good[k] = true; });
      out.yosu = {}; if (raw.yosu && typeof raw.yosu === 'object') for (const k of ['sabori', 'utsu']) if (raw.yosu[k]) out.yosu[k] = { visits: Math.round(n(raw.yosu[k].visits, 0, 0, 9)) };
      const strs = (v, max) => (Array.isArray(v) ? v.filter(x => typeof x === 'string').slice(0, max) : []);
      out.titles = strs(raw.titles, 64); out.wonNow = strs(raw.wonNow, 128); out.wonBefore = strs(raw.wonBefore, 128);
      for (const k of ['debutWon', 'issaDone', 'issaForce', 'issaSure', 'hirameki', 'acted', 'reacted', 'mealReady', 'special', 'freeMeal', 'fourDone', 'shBoost']) out[k] = raw[k] === true;
      out.elixir = raw.elixir && Number.isInteger(raw.elixir.d) && raw.elixir.d >= 0 && raw.elixir.d <= 3 ? { d: raw.elixir.d, turn: Math.round(n(raw.elixir.turn, 0, 0, TOTAL_TURNS + 1)) } : null;
      out.fruit = raw.fruit && KEYS.includes(raw.fruit.stat) ? { stat: raw.fruit.stat, turn: Math.round(n(raw.fruit.turn, 0, 0, TOTAL_TURNS + 1)) } : null;
      out.cond = raw.cond && typeof raw.cond === 'object' && ['injury', 'ill', 'away'].includes(raw.cond.kind) ? { kind: raw.cond.kind, left: Math.round(n(raw.cond.left, 1, 1, 9)) } : null;
      out.over = ['done', 'lost', 'gameover'].includes(raw.over) ? raw.over : null;
      out.storyEnd = ['good', 'bitter'].includes(raw.storyEnd) ? raw.storyEnd : null;
      out.rivalMet = typeof raw.rivalMet === 'string' ? raw.rivalMet.slice(0, 24) : null;
      out.ending = raw.ending && typeof raw.ending === 'object' && ['bad', 'good', 'super'].includes(raw.ending.kind) ? { kind: raw.ending.kind, parties: partiesOf(raw.ending.kind), seen: raw.ending.seen === true } : null;
      out.aidLv = Math.round(n(raw.aidLv, out.aidLv, 1, 10));
      out.aptBase = aptBaseNorm(raw.aptBase); // 合体円盤石から継いだ段数(無い → 0)
      out.aptUp = aptUpOf({ aptUp: raw.aptUp }); // 上げた段数(無い・壊れている → 0)。上げ方ごとの数も上限で切りそろえる
      // 覚醒・超覚醒(2026-11-13): 印 awake 0〜2・起きたターン・覚醒で上げた段・前触れ { k, turn }(無い・壊れている → 起きていない)
      out.awake = Math.round(n(raw.awake, 0, 0, 2)); out.awakeTurn = Math.round(n(raw.awakeTurn, 0, 0, TOTAL_TURNS + 1)); out.aptAwake = aptAwakeNorm(raw.aptAwake);
      out.omen = raw.omen && typeof raw.omen === 'object' && (raw.omen.k === 1 || raw.omen.k === 2) && raw.omen.k === out.awake + 1 ? { k: raw.omen.k, turn: Math.round(n(raw.omen.turn, out.turn, 1, TOTAL_TURNS)) } : null;
      out.aptLog = Object.fromEntries(Object.keys(DIST_UP.src).map(k => [k, Math.round(n(raw.aptLog && raw.aptLog[k], 0, 0, DIST_UP.src[k]))]));
      out.astory = raw.astory && typeof raw.astory === 'object' ? { ep: Math.round(n(raw.astory.ep, 0, 0, 4)), path: ['good', 'bitter'].includes(raw.astory.path) ? raw.astory.path : null, done: raw.astory.done === true } : out.astory;
      out.hints = Array.isArray(raw.hints) ? raw.hints.filter(h => h && typeof h === 'object' && typeof h.name === 'string').slice(0, 8).map(h => ({ aid: String(h.aid || ''), type: h.type === 'tech' ? 'tech' : 'assist', name: h.name.slice(0, 24) })) : [];
      out.battle = raw.battle && typeof raw.battle === 'object' && ['debut', 'junior', 'middle', 'pro', 'summit', 'cup'].includes(raw.battle.kind) ? clone(raw.battle) : null;
      out.last = raw.last && typeof raw.last === 'object' ? clone(raw.last) : null;
      out.shugyoUsed = raw.shugyoUsed && typeof raw.shugyoUsed === 'object' ? clone(raw.shugyoUsed) : {};
      // 修行の作り直し(2026-11-13): 技ごとの外した回数(無い → 0 回)・超修行の残り(無い → SHUGYO.superMax 回)
      out.techMiss = {}; if (raw.techMiss && typeof raw.techMiss === 'object' && !Array.isArray(raw.techMiss)) for (const [id0, v] of Object.entries(raw.techMiss)) { const id = techCanon(id0); if (okTech.includes(id) && Number.isFinite(Number(v)) && Number(v) > 0) out.techMiss[id] = Math.max(out.techMiss[id] || 0, Math.min(20, Math.round(Number(v)))); }
      out.superLeft = Math.round(n(raw.superLeft, superMaxOf(out), 0, superMaxOf(out)));
      if (EV) out.ev = EV.norm(raw.ev); // ランダムイベント(monhero-success-events.js)。読めなければ「出来事なし・状態なし」
      out.rivals = base.rivals; if (Array.isArray(raw.rivals)) out.rivals = newRun({ id: raw.id, species: raw.species, rivals: raw.rivals }).rivals;
      if (raw.log && typeof raw.log === 'object') for (const k of [...new Set([...Object.keys(out.log), 'meal', 'items', 'rematch', 'astory'])]) {
        if (k !== 'tagTurns' && k !== 'issa' && raw.log[k] === undefined && out.log[k] === undefined) continue; if (k === 'tagTurns') { if (Array.isArray(raw.log.tagTurns)) out.log.tagTurns = out.log.tagTurns.map((d, i) => Math.round(n(raw.log.tagTurns[i], d, 0, 99))); } else if (k === 'issa') out.log.issa = strs(raw.log.issa, 9); else out.log[k] = Math.round(n(raw.log[k], 0, 0, 999)); }
      // 賞金ランク(2026-11-14 から)。無い・壊れた途中の育成は、いまの段で埋める(さかのぼってチケットを配らない)
      { const now = rankStepOf(out); const v = Number(raw.fameRank); out.fameRank = Number.isInteger(v) && v >= 0 && v <= now ? v : now; }
      return out;
    };
    // 助手の連続イベント(EVENTS ②)。そのターンに出る話(1〜4・'special')か null。画面はターンのはじめに見せる
    const storyDue = (s) => {
      const a = s.astory || { ep: 0 }; if (s.over || s.cond || s.battle) return null;
      const p = periodOf(s.turn); const max = ASTORY.lvMax(num(s.aidLv, 1));
      if (a.ep >= 4 && !a.done && num(s.aidLv, 1) >= ASTORY.specialLv && s.storyEnd === 'good' && p.key === 'final' && p.at <= 2) return 'special';
      const next = ASTORY.eps[a.ep]; if (!next || next.ep > max) return null;
      if (p.key !== next.period || s.aidBond < next.bond) return null;
      if (next.ep === 1 && s.turn < 2) return null;
      return (p.left === 1 || rngOf(s.id, s.turn, 'astory')() < ASTORY.rate) ? next.ep : null;
    };
    // 話を見て2択を選ぶ(choice = 'a' | 'b')。3話の選び方で4話がいい結末(a)/ほろ苦い結末(b)に分かれる
    //   1話: a = 素質のいちばん高い能力 中+ / b = 忠誠 小+   2話: a = 体力 大+・助手の親密度 +10 / b = 主の能力 中+・ストレス 中+
    //   (中身の色は台本 scenario.js・asst-*.js が助手ごとに付ける。数の大きさは EVENTS §3 の物差し)
    const storyStep = (s0, choice) => {
      const ep = storyDue(s0); if (ep === null) return { state: s0, out: { ok: false } };
      let s = clone(s0); const c = choice === 'b' ? 'b' : 'a'; const out = { ok: true, ep, choice: c };
      const best = KEYS.slice().sort((x, y) => aptMult(s.species, y) - aptMult(s.species, x))[0];
      if (ep === 1) { if (c === 'a') addStat(s, best, unitOf(s, best)); else addLoyal(s, 3, 0); }
      else if (ep === 2) { if (c === 'a') { recover(s, 0.3); addBond(s, 'aid', 10); } else { const top = top3Of(s.stats, s.species)[0]; addStat(s, top, unitOf(s, top)); addStress(s, 20); } }
      else if (ep === 3) { s.astory.path = c === 'a' ? 'good' : 'bitter'; addBond(s, 'aid', 10); }
      else if (ep === 4) { const r = storyEnd(s, s.astory.path || 'bitter'); s = r.state; out.end = s.storyEnd; }
      else if (ep === 'special') { s = markSpecial(s).state; s.astory.done = true; }
      if (ep !== 'special') s.astory.ep = ep;
      if ((ep === 4 && num(s.aidLv, 1) < ASTORY.specialLv) || ep === 'special' || (ep === 4 && s.storyEnd !== 'good')) s.astory.done = true;
      s.log.astory = (s.log.astory || 0) + 1;
      return { state: s, out };
    };

    // シナリオの大会に勝ったときの上乗せ(TOURNAMENT §4b)
    const scenarioReward = (s, b, out) => {
      const aid = b.sys.slice(2); out.scenario = aid;
      if (aid === 'mua') { addStress(s, -30); addLoyal(s, 3, 0); }
      else if (aid === 'kiki') { const top = top3Of(s.stats, s.species)[0]; addStat(s, top, 12); }
      else if (aid === 'momosuke') s.pop = clamp(s.pop + popGain(s, 10 * 1.5), 0, 100);
      else if (aid === 'dra') s.techs.forEach(t => { s.mastery[t] = clamp(num(s.mastery[t]) + 10, 0, 100); });
      else if (aid === 'atsu') gainWinPts(s, 15);
      else if (aid === 'kyuko') KEYS.forEach(k => addStat(s, k, 3));
      else if (aid === 'sorashido') gainWinPts(s, 10);
      else if (aid === 'erubin') { addLoyal(s, 5, 0); s.freeMeal = true; }
      if (b.star >= 3) { const t = `${SC_NAME[aid]}の優勝`; if (!s.titles.includes(t)) s.titles.push(t); }
    };
    // 助手のお話の4話の結末(1回の育成に1度)。kind = 'good'(いい結末)| 'bitter'(ほろ苦い結末)
    const storyEnd = (s0, kind) => {
      const s = clone(s0); const st = ASST_STORY[s.aid];
      if (!st || s.storyEnd || (kind !== 'good' && kind !== 'bitter')) return { state: s0, out: { ok: false } };
      s.storyEnd = kind;
      if (kind === 'good') { KEYS.forEach(k => addStat(s, k, unitOf(s, k) * STORY_GOOD_ALL)); s.hints = [...(Array.isArray(s.hints) ? s.hints : []), { aid: s.aid, type: st.good.hint, name: st.good.name }]; }
      else {
        const b = st.bitter;
        if (b.pop) s.pop = clamp(s.pop + popGain(s, b.pop), 0, 100);
        if (b.pts) gainPts(s, b.pts);
        if (b.stat) addStat(s, b.stat, unitOf(s, b.stat) * STORY_BIG);
        if (b.mastery) s.techs.forEach(t => { s.mastery[t] = clamp(num(s.mastery[t]) + b.mastery, 0, 100); });
        if (b.loyal) addLoyalRaw(s, Math.ceil(b.loyal / 2), Math.floor(b.loyal / 2));
      }
      const t = kind === 'good' ? 'お話の結末(いい結末)' : 'お話の結末(ほろ苦い結末)'; s.titles.push(`${s.aid}:${t}`);
      return { state: s, out: { ok: true, kind } };
    };
    // 特別な1話を見たら印を付ける。効き目は頂への道の1回戦の試合だけ(battleMods が返す・対戦の芯に渡す)
    const markSpecial = (s0) => { const s = clone(s0); s.special = true; return { state: s, out: { ok: true } }; };
    const battleMods = (s) => (s.special && s.battle && s.battle.kind === 'summit' && s.battle.round === 0 && ASST_STORY[s.aid] ? { ...ASST_STORY[s.aid].special } : {});
    // 対戦の芯にそのまま渡す上乗せ(育てる子の側 A)。画面・サクセス側の印は外す。何も無ければ undefined(今までと同じ試合)
    const BUFF_KEYS = ['guts', 'hit1', 'crit', 'missCut', 'eva', 'noSulk'];
    // 編成のひらめきのアシスト(型 battle・いちばん高い段の1つだけ)+特別な1話を足し合わせ、対戦の芯の範囲で切る
    const BUFF_RANGE = { guts: [0, 50], hit1: [0, 0.5], crit: [0, 0.5], missCut: [0, 0.9], eva: [0, 0.5] };
    const battleBuffs = (s) => {
      if (!s.battle) return undefined;
      const m = {}; const put = (b) => Object.keys(b || {}).forEach(k => { if (k === 'noSulk') { if (b[k] === true) m.noSulk = true; return; } const r = BUFF_RANGE[k]; if (!r || !Number.isFinite(Number(b[k]))) return; const v = clamp(num(m[k]) + Number(b[k]), r[0], r[1]); m[k] = k === 'guts' ? Math.round(v) : Math.round(v * 1000) / 1000; });
      Object.keys(ASSISTS).filter(id => ASSISTS[id].type === 'battle').forEach(id => { const lv = stayLv(s.team, id); if (lv) put(aOf(id, 'buff', lv)); });
      put(battleMods(s));
      const a = {}; BUFF_KEYS.forEach(k => { if (m[k] !== undefined) a[k] = m[k]; }); return Object.keys(a).length ? { A: a } : undefined; };
    const stayV = (s, id) => { const lv = stayLv(s.team, id); return lv ? aOf(id, 'v', lv) : 0; };
    const popGain = (s, v) => Math.round(v * (s.good && s.good.star ? GOOD.star.pop : 1) * (v > 0 ? 1 + stayNum(s, 'ninki') / 100 : 1)); // 🌟人気者のお手本: 上がる分だけ
    // 育成中に使うアイテム(1ターンに1個まで・ターンを使わない)
    const useItem = (s0, key) => {
      const s = clone(s0); const it = ITEMS[key];
      if (!it || it.use !== 'during' || num(s.bag[key]) <= 0 || s.itemTurn === s.turn || s.over) return { state: s0, out: { ok: false } };
      s.bag[key] -= 1; s.itemTurn = s.turn;
      if (it.hpFull) s.hp = s.hpMax;
      if (it.hp) recover(s, it.hp);
      if (it.cure) { s.yosu = {}; }
      if (it.loyal) addLoyalRaw(s, Math.ceil(it.loyal / 2), Math.floor(it.loyal / 2));
      if (it.ama || it.fear) addLoyalRaw(s, num(it.ama), num(it.fear));
      if (it.stress) addStress(s, it.stress);
      if (it.issaSure) s.issaSure = true;
      if (it.gives) for (const [k, n] of Object.entries(it.gives)) s.bag[k] = num(s.bag[k]) + n;
      if (Number.isInteger(it.elixir)) s.elixir = { d: it.elixir, turn: s.turn };
      if (it.fruit) s.fruit = { stat: it.fruit, turn: s.turn };
      if (it.hpMax) { s.hpMax = Math.min(HP_MAX_CAP, s.hpMax + it.hpMax); s.hp = Math.min(s.hpMax, s.hp + it.hpMax); }
      s.log.items = (s.log.items || 0) + 1;
      return { state: s, out: { ok: true, item: key } };
    };

    // ---- ターンを閉じる(期末の強制大会・頂への道・デビュー戦の再挑戦をここで立てる) ----
    const endTurn = (s0) => {
      const s = clone(s0);
      if (s.over || s.battle) return { state: s, out: { ok: false } };
      if (!s.acted) return { state: s, out: { ok: false, why: 'not-acted' } };
      if (EV) EV.tick(s); // 出来事のひとときの状態を1ターン減らす(s.last を消す前)
      if (s.last && s.last.kind === 'retry') s.battle = { kind: 'debut', retry: s.debutLoss, round: 0 };
      else if (s.last && s.last.kind === 'cup') s.battle = { kind: 'cup', id: s.last.cup.id, sys: s.last.cup.sys, star: s.last.cup.star, rival: s.last.cup.rival || null, round: 0 };
      else s.battle = forcedBattle(s);
      s.acted = false; s.reacted = false; s.issaDone = false; s.last = null; s.mealReady = false;
      if (!s.battle) s.turn += 1;
      if (s.turn > TOTAL_TURNS) s.over = 'done';
      return { state: s, out: { ok: true, battle: s.battle } };
    };

    // ---- 大会の相手(TOURNAMENT §9・§15: 戦うのは1戦) ----
    const benchOf = (key) => num(BENCH_USE[key], 1500);
    // 第2版の大会の基準: その期のはじめは前の期の終わり、12月でその期の終わり(月でならす)
    const benchAt = (s) => { const pk = periodOf(s.turn).key; const prev = { junior: 'debut', middle: 'junior', pro: 'middle', final: 'pro' }[pk]; const cur = pk === 'final' ? 'pro' : pk; if (!prev || pk === 'final') return benchOf(cur); const m = monthOf(s.turn); return benchOf(prev) + (benchOf(cur) - benchOf(prev)) * m / 12; };
    const REG = Array.isArray(deps && deps.regulars) ? deps.regulars.filter(r => r && typeof r.cup === 'string' && speciesList.includes(r.species)) : [];
    const RIVALS_OK = (x) => x && typeof x === 'object' && speciesList.includes(x.species);
    const regularsOf = (cup) => REG.filter(r => r.cup === cup);
    const champOf = (cup) => REG.find(r => r.cup === cup && r.champ) || null;
    // 技の強さの目安: 威力 ×(1 + 命中/100)の上位2つの平均(DEBUT_TECH_FLOOR)
    const techPunch = (sp, ids) => {
      const own = techsOf(sp);
      const v = (Array.isArray(ids) ? ids : []).map(id => own.find(t => t && t.id === id)).filter(Boolean)
        .map(t => Math.max(0, num(t.power)) * Math.max(0.5, 1 + num(t.hit) / 100)).sort((x, y) => y - x).slice(0, 2);
      return v.length ? v.reduce((x, y) => x + y, 0) / v.length : 0;
    };
    // デビュー戦の相手の手かげん(相手は表の先頭から n 個の技で戦う。試合の画面と同じ)
    const debutEase = (s, sp, n) => {
      const mine = techPunch(s.species, s.techs); const foe = techPunch(sp, techsOf(sp).slice(0, n).map(t => t.id));
      return mine > 0 && foe > 0 ? clamp((mine / foe) * (mine / foe), DEBUT_TECH_FLOOR, 1) : 1;
    };
    // ---- 助手1人分のストーリー(data/monhero-success-arc.js・STORY-ARC.md) ----
    const ARCX = (deps && deps.arc) || (root && root.MONHERO_SUCCESS_ARC) || null;
    const ARC = ARCX && ARCX.ARC && typeof ARCX.ARC === 'object' ? ARCX.ARC : {};
    const PARTY = ARCX && ARCX.PARTY && typeof ARCX.PARTY === 'object' ? ARCX.PARTY : PARTY0;
    // 頂への道で助手が選ぶ相手(round 0〜2)。{ pick, who(常連か王者)| rival(この育成のライバル) }
    const summitPick = (s, round) => {
      const a = ARC[s.aid]; const pick = a && Array.isArray(a.summit) && a.summit[round] ? a.summit[round] : (round === SUMMIT.length - 1 ? 'champ' : 'reg');
      const regs = regularsOf('peak').filter(r => !r.champ);
      if (pick === 'champ') return { pick, who: champOf('peak') };
      if (pick === 'rival') {
        const list = Array.isArray(s.rivals) ? s.rivals : [];
        const rv = list.find(r => r.name === s.rivalMet) || list[0] || null;
        if (rv) return { pick, rival: rv };
        return { pick: 'strong', who: regs[regs.length - 1] || null };
      }
      return { pick, who: regs[round] || regs[0] || null };
    };
    // エンディングの判定(頂への道の最後の結果で決まる)
    const endingOf = (s, wonFinal) => (!wonFinal ? 'bad' : (num(s.aidBond) >= BOND.max && num(s.astory && s.astory.ep) >= 4 ? 'super' : 'good'));
    const partiesOf = (kind) => (Array.isArray(PARTY[kind]) ? PARTY[kind].map(n => Math.max(0, Math.round(num(n)))) : []);
    // エンディングを付ける: お祝いの能力をまとめて足す(画面は s.ending を見て順に見せる)
    const applyEnding = (s, kind, out) => {
      const parties = partiesOf(kind); const gain = {};
      parties.forEach(n => KEYS.forEach(k => { const b0 = s.stats[k]; addStat(s, k, n); gain[k] = (gain[k] || 0) + (s.stats[k] - b0); }));
      s.ending = { kind, parties, seen: false };
      if (kind === 'super' && ARC[s.aid] && ARC[s.aid].title && !s.titles.includes(ARC[s.aid].title)) s.titles.push(ARC[s.aid].title);
      out.ending = kind; out.party = gain;
    };
    // 画面がエンディングを見せ終えたら(中断して戻っても、もう一度は見せない)
    const endingSeen = (s0) => { if (!s0 || !s0.ending) return { state: s0, out: { ok: false } }; const s = clone(s0); s.ending.seen = true; return { state: s, out: { ok: true } }; };
    const TYPE_OF = (deps && deps.types) || {};
    const DIST_OF = (sp) => { const m = deps && deps.monsters && deps.monsters[sp]; return m && Array.isArray(m.distAptitude) ? m.distAptitude : null; };
    const APT_RANK = Object.fromEntries(DIST_UP.grades.map((g, i) => [g, i]));

    // ---- 間合い適性を育成中に上げる(2026-11-13 社長: 修行のくじ・大会のごほうび・出来事の選択肢の全部) ----
    //   種類の表は書き換えず、サクセスモンに「上げた段数」s.aptUp = [零, 近, 中, 遠] を持たせる。試合と大会の出る条件は種類の段 + 上げた段数で見る
    //   上限は DIST_UP(1回の育成の合計・1つの間合い・M にできる数・上げ方ごと)。端末の値はそのまま信じず、ここと芯で切りそろえる
    const aptUpNorm = (v) => [0, 1, 2, 3].map(i => clamp(Math.round(num(Array.isArray(v) ? v[i] : 0)), 0, DIST_UP.per));
    const aptUpOf = (s) => {
      const up = aptUpNorm(s && s.aptUp); let over = up.reduce((a, b) => a + b, 0) - DIST_UP.total;
      for (let i = 3; i >= 0 && over > 0; i--) { const cut = Math.min(up[i], over); up[i] -= cut; over -= cut; } // 合計が上限を超えたら後ろの間合いから削る
      return up;
    };
    // サクセスモンのいまの間合い適性(G〜M の4つ)。M にできる数を超えた分は M の1つ下
    const aptGradesOf = (s) => {
      const G = DIST_UP.grades; const base = DIST_OF(s.species) || ['C', 'C', 'C', 'C']; const up = aptUpOf(s); let m = 0;
      return [0, 1, 2, 3].map(i => {
        const b = G.indexOf(base[i]); const aw = aptAwakeNorm(s.aptAwake)[i]; let k = Math.min(G.length - 1, (b < 0 ? G.indexOf('C') : b) + up[i] + aptBaseNorm(s.aptBase)[i] + aw);
        if (k === G.length - 1 && up[i] + aw > 0) { if (m >= DIST_UP.mMax) k -= 1; else m += 1; }
        return G[k];
      });
    };
    // 試合の芯へ渡す段数(継いだ分 + 育成で上げた分 + 覚醒の分)。芯がもう一度、上限で切りそろえる。合体で継ぐ段数もこれで数える(親の覚醒の分も入る)
    const aptSendOf = (s) => { const b = aptBaseNorm(s && s.aptBase); const w = aptAwakeNorm(s && s.aptAwake); return aptUpOf(s).map((n, i) => n + b[i] + w[i]); };
    // ---- 総合力(モンサク・TECH_POWER)。技ごとに { r: ランク 1〜5, a: 届く間合いのいちばん高い適性の段 }(ランキングの行もこの形で送る) ----
    const techRowsOf = (s) => {
      const G = DIST_UP.grades; const grades = aptGradesOf(s); const own = techsOf(s.species);
      return (Array.isArray(s.techs) ? s.techs : []).slice(0, TECH_MAX).map(id => own.find(t => t && t.id === id)).filter(Boolean).map((t) => {
        const ds = (Array.isArray(t.dist) ? t.dist : []).filter(d => Number.isInteger(d) && d >= 0 && d <= 3);
        const a = ds.length ? ds.map(d => grades[d]).sort((x, y) => G.indexOf(y) - G.indexOf(x))[0] : TECH_POWER.aptMid;
        return { r: techRank(t), a };
      });
    };
    const techPowerOfRows = (rows) => {
      const G = DIST_UP.grades; const mid = G.indexOf(TECH_POWER.aptMid);
      return (Array.isArray(rows) ? rows : []).reduce((acc, e) => { const i = G.indexOf(e && e.a); return acc + TECH_POWER.rank[clamp(Math.round(num(e && e.r, 1)), 1, 5) - 1] * (10 + ((i < 0 ? mid : i) - mid) * TECH_POWER.aptStep * 10) / 10; }, 0); // 10倍してから割る(小数の誤差を出さない)
    };
    // 6能力・Lv・忠誠・人気は助手マスモンと同じ重み(MASMON_CALC.power に技なしで聞く)+ 技の分
    const powerOfParts = (o, rows) => Math.round(C.power({ stats: o.stats, masteries: [], lv: o.lv, loyal: o.loyal, pop: o.pop }) + techPowerOfRows(rows));
    const powerOf = (s) => powerOfParts({ stats: s.stats, lv: s.lv, loyal: loyalOf(s), pop: s.pop }, techRowsOf(s));
    // 熟練の効き目(試合の芯の members[].techBoost)。熟練から自動 + 強化した段(s.techUp・いまは無い)
    const techBoostOf = (s) => {
      const o = {}; const r3 = (v) => Math.round(v * 1000) / 1000;
      (Array.isArray(s && s.techs) ? s.techs : []).forEach((id) => {
        const m = clamp(num(s.mastery && s.mastery[id]), 0, MASTERY.max) / MASTERY.max; if (m <= 0) return;
        o[id] = { pow: r3(m * MASTERY.boost.pow), hit: r3(m * MASTERY.boost.hit), guts: r3(m * MASTERY.boost.guts) };
      });
      return o;
    };
    // 試合の結果で熟練を足す。use = { 技id: その試合で使った回数 }(無ければ出場の分だけ)
    const gainMastery = (s, use) => {
      const u = use && typeof use === 'object' ? use : {};
      s.techs.forEach((t) => { const n = Math.max(0, Math.floor(num(u[t]))); s.mastery[t] = clamp(num(s.mastery[t]) + MASTERY.perCup + Math.min(MASTERY.perMatchCap, n * MASTERY.perUse), 0, MASTERY.max); });
    };
    // 試合の記録(芯の log)から A の技ごとの使った回数を数える
    const techUseOf = (log, side) => {
      const o = {}; (Array.isArray(log) ? log : []).forEach((e) => { if (e && e.ev === 'tech' && e.side === (side || 'A') && typeof e.move === 'string') o[e.move] = (o[e.move] || 0) + 1; }); return o;
    };
    // 合体で継ぐ段数(親2体は保存枠のマスモンの行。aptBase・aptUp が無ければ 0)
    const aptInherit = (a, b) => {
      const H = DIST_UP.inherit; const pa = aptSendOf(a || {}); const pb = aptSendOf(b || {});
      const o = [0, 1, 2, 3].map(i => Math.floor((pa[i] + pb[i]) / 4) + (pa[i] >= H.same && pb[i] >= H.same ? H.bonus : 0));
      let over = o.reduce((x, y) => x + y, 0) - H.total;
      while (over > 0) { const i = [0, 1, 2, 3].filter(d => o[d] > 0).sort((x, y) => o[x] - o[y] || y - x)[0]; o[i] -= 1; over -= 1; } // 小さい間合いから削る
      return o;
    };
    // 1段上げられるか(上げ方 src = 'quest' | 'cup' | 'event' ごとの上限も見る)
    const aptUpRoom = (s, d, src) => {
      if (!Number.isInteger(d) || d < 0 || d > 3) return false;
      const up = aptUpOf(s); const log = s.aptLog || {}; const G = DIST_UP.grades;
      if (up.reduce((a, b) => a + b, 0) >= DIST_UP.total || up[d] >= DIST_UP.per) return false;
      if (DIST_UP.src[src] != null && num(log[src]) >= DIST_UP.src[src]) return false;
      const now = aptGradesOf(s)[d]; if (now === 'M') return false;
      if (G.indexOf(now) === G.length - 2 && aptGradesOf(s).filter(g => g === 'M').length >= DIST_UP.mMax) return false;
      return true;
    };
    // 1段上げる(上げたら true)。s を直接変える(act・settle・出来事の中で使う)
    const addAptUp = (s, d, src) => {
      if (!aptUpRoom(s, d, src)) return false;
      const up = aptUpOf(s); up[d] += 1; s.aptUp = up;
      s.aptLog = { ...(s.aptLog || {}), [src]: num((s.aptLog || {})[src]) + 1 };
      return true;
    };

    // ---- 覚醒・超覚醒(2026-11-13 社長)。画面はターンのはじめに awakeOpen(s, 'start')、ターンを閉じる前に awakeOpen(s, 'end') を呼ぶ ----
    //   くじ・起きる中身は決まった乱数(育成の id + ターン + 段)。何度呼んでも同じ結果(前触れ・起きたターンは保存に残る)
    const awakeNext = (s) => (num(s.awake) >= 2 ? 0 : Math.round(num(s.awake)) + 1);
    const awakeCanRoll = (s) => {
      const k = awakeNext(s); if (!k || s.over || s.omen) return false;
      if (!AWAKE.periods[k - 1].includes(periodOf(s.turn).key)) return false;
      return !(k === 2 && num(s.awakeTurn) >= s.turn); // 覚醒したターンには超覚醒のくじを引かない
    };
    // 上げる間合い: いまの適性が高い順 → 覚えている技が多く届く順 → 近・中・遠・零。M の間合いは飛ばす
    const awakePick = (s, n) => {
      const G = DIST_UP.grades; const g = aptGradesOf(s); const own = techsOf(s.species).filter(t => (s.techs || []).includes(t.id));
      const reach = [0, 1, 2, 3].map(d => own.filter(t => Array.isArray(t.dist) && t.dist.includes(d)).length);
      const room = AWAKE.aptMax - aptAwakeNorm(s.aptAwake).reduce((a, b) => a + b, 0);
      return AWAKE.order.filter(d => g[d] !== 'M').sort((a, b) => (G.indexOf(g[b]) - G.indexOf(g[a])) || (reach[b] - reach[a]) || (AWAKE.order.indexOf(a) - AWAKE.order.indexOf(b))).slice(0, Math.max(0, Math.min(n, room)));
    };
    const awakeApply = (s, k) => {
      const add = AWAKE.add[k - 1]; const ups = {};
      KEYS.forEach(key => { const was = s.stats[key]; s.stats[key] = clamp(was + add, 0, STAT_MAX); ups[key] = s.stats[key] - was; });
      const before = aptGradesOf(s); const picks = awakePick(s, AWAKE.apt[k - 1]); const w = aptAwakeNorm(s.aptAwake);
      picks.forEach(d => { w[d] += 1; }); s.aptAwake = w;
      const after = aptGradesOf(s);
      s.awake = k; s.awakeTurn = s.turn; s.omen = null;
      return { kind: k, add, ups, apt: picks.map(d => ({ dist: d, from: before[d], to: after[d] })) };
    };
    // when = 'start'(ターンのはじめ: 前のターンの前触れなら起きる・くじを引く)/ 'end'(最後の期で当たった前触れを、そのターンの終わりに起こす)
    //   out.fire … 起きた中身(画面は演出を出す)/ out.omen … 前触れが出た段(1・2)/ 何もなければ {}
    const awakeOpen = (s0, when = 'start') => {
      const s = clone(s0); if (!s.stats) return { state: s, out: {} };
      if (s.omen && s.omen.k === awakeNext(s)) {
        if (when === 'start' && s.omen.turn < s.turn) return { state: s, out: { fire: awakeApply(s, s.omen.k) } };
        if (when === 'end' && s.omen.turn === s.turn && periodOf(s.turn).key === 'final') return { state: s, out: { fire: awakeApply(s, s.omen.k) } };
        return { state: s, out: { omen: s.omen.k } };
      }
      if (s.omen) s.omen = null; // 段が合わない前触れ(壊れた保存)は捨てる
      if (when !== 'start' || !awakeCanRoll(s)) return { state: s, out: {} };
      const k = awakeNext(s);
      if (rngOf(s.id, s.turn, 'awake', k)() < AWAKE.rate[k - 1]) { s.omen = { k, turn: s.turn }; return { state: s, out: { omen: k } }; }
      return { state: s, out: {} };
    };

    // ---- 成長のピーク(C.peakOf の区間。2026-11-13 社長: 予告・始まり・終わりを助手が教える・ピーク中は燃え上がる演出) ----
    //   ピークのターン = 区間に入るターン(デビュー期・最後の期は除く。出来事 ev.self.peakin / peakout と同じ数え方)
    //   peakInfo(s) → { state: 'soon'(あと1〜3ターンで始まる)|'in'(ピーク中)|null, left(ピーク中の残りターン・このターンを含む), in(始まるまでのターン), from, to }
    const peakTurnsOf = (s) => {
      const pk = C.peakOf(s.type); const out = [];
      for (let t = 2; t <= TOTAL_TURNS; t++) { const k = periodOf(t).key; if (k === 'debut' || k === 'final') continue; const f = (t - 1) / TOTAL_TURNS; if (f >= pk.from && f < pk.to) out.push(t); }
      return out;
    };
    const peakInfo = (s) => {
      const T = s && Number.isInteger(s.type) ? peakTurnsOf(s) : []; if (!T.length) return { state: null };
      const from = T[0]; const to = T[T.length - 1];
      if (s.turn >= from && s.turn <= to) return { state: 'in', left: to - s.turn + 1, from, to };
      if (s.turn < from && from - s.turn <= 3) return { state: 'soon', in: from - s.turn, from, to };
      return { state: null, from, to };
    };

    // その月の大会の並び(札)。ライバルは月のはじめ(並びを見せる時)に決まる
    const monthOf = (turn) => { const p = periodOf(turn); return p.key === 'debut' ? 7 + p.at : p.at; }; // 1ターン = 1か月(デビューは8〜12月)
    // きゅうこのピークの大会: 成長のピーク(いちばん伸びる区間)に入った最初のターン(1回の育成に1度)
    const peakTurn = (s) => { const pk = C.peakOf(s.type); const f = (s.turn - 1) / TOTAL_TURNS; const f0 = (s.turn - 2) / TOTAL_TURNS; return s.turn > 1 && f >= pk.from && f < pk.to && !(f0 >= pk.from) && periodOf(s.turn).key !== 'debut' && periodOf(s.turn).key !== 'final'; };
    const cupsOf = (s) => {
      const p = periodOf(s.turn);
      if (!CUP_STAR[p.key] && !(s.aid === 'kyuko' && peakTurn(s))) return [];
      if (s.over) return [];
      if (p.key === 'final' && p.at > 2) return []; // 最後の期の3〜5ターン目は頂への道だけ
      const m = monthOf(s.turn); const row = CUP_STAR[p.key] ? YEAR[m - 1].slice(0, CUP_COUNT[p.key]) : [];
      const SEASON_SYS = ['spring', 'summer', 'autumn', 'winter'];
      const list = row.filter(sys => (sys !== 'herosummer' || p.key === 'pro') && !(SEASON_SYS.includes(sys) && (p.key === 'middle' || p.key === 'pro'))).map((sys, i) => {
        const star = sys === 'herosummer' ? 4 : CUP_STAR[p.key];
        return { id: `${p.key}:${m}:${sys}:${star}`, sys, star, name: (deps && deps.cupNames && deps.cupNames[sys]) || sys, prize: Math.round(CUP_PRIZE[star] * PERIOD_PRIZE[p.key]), index: i };
      });
      // 大会の第2版: 決まった期・月の大会(四大大会・季節の賞・間合いの2段・選抜→記念・宝石の記念・ジュニアの大一番)
      EX_CUPS.forEach((d) => { if (d.p === p.key && d.m === m) list.push({ id: `${p.key}:${m}:${d.sys}:${d.star}`, sys: d.sys, star: d.star, ex: true, name: d.name, grade: d.grade, hard: !!d.hard, prize: d.prize, index: list.length }); });
      // シナリオの大会(その助手の育成だけ)
      (SC_CUPS[s.aid] || []).forEach((d, k) => {
        const hit = d.peak ? peakTurn(s) : (d.p === p.key && d.m === m);
        if (!hit) return;
        let star = d.star; if (s.aid === 'momosuke' && p.key === 'pro' && s.pop >= 50) star = 3; // 人気 50 以上で ★★★
        const sys = `sc${s.aid}`;
        list.push({ id: `${p.key}:${m}:${sys}:${star}:${k}`, sys, star, scenario: true, name: SC_NAME[s.aid], prize: Math.round(CUP_PRIZE[star] * PERIOD_PRIZE[p.key]), index: list.length });
      });
      const rv = rivalOf(s, list.length); if (rv) list[rv.cup].rival = rv.rival;
      return list.map(c => ({ ...c, entry: canEnter(s, c), done: s.wonNow.includes(`${c.sys}:${c.star}`) || s.wonBefore.includes(`${c.sys}:${c.star}`) }));
    };
    const rivalOf = (s, n) => {
      const list = Array.isArray(s.rivals) ? s.rivals : []; if (!list.length || !n) return null;
      const rng = rngOf(s.id, s.turn, 'rival'); if (rng() >= RIVAL.rate) return null;
      const r = list[Math.floor(rng() * list.length)];
      return { cup: Math.floor(rng() * n), rival: { name: r.name, kind: r.kind, species: r.species } };
    };
    // 出る条件(TOURNAMENT §5)。{ ok, why }
    const canEnter = (s, c) => {
      const ex = EX_BY_SYS[c.sys];
      if (ex) {
        const nd = ex.need || {};
        if (nd.rank && rankStepOf(s) < nd.rank) return { ok: false, why: 'rank', need: nd.rank, needName: rankNameOf(nd.rank), needG: rankNeedG(nd.rank) };
        if (nd.stat && ex.stat && s.stats[ex.stat] < nd.stat) return { ok: false, why: 'stat', need: nd.stat, stat: ex.stat };
        if (nd.won && !s.wonNow.includes(nd.won)) { const [ws] = nd.won.split(':'); return { ok: false, why: 'won', wonSys: ws, wonName: (EX_BY_SYS[ws] && EX_BY_SYS[ws].name) || (deps && deps.cupNames && deps.cupNames[ws]) || ws }; }
        if (ex.type) { const t = TYPE_OF[s.species]; if (t && t.main !== ex.type && t.sub !== ex.type) return { ok: false, why: 'type' }; }
        return { ok: true };
      }
      const sy = CUP_SYS[c.sys] || {};
      if (sy.stat && s.stats[sy.stat] < (CUP_NEED.stat[c.star] || 0)) return { ok: false, why: 'stat', need: CUP_NEED.stat[c.star] };
      if ((sy.stat || sy.dist !== undefined) && c.star >= 2 && !s.wonNow.includes(`${c.sys}:${c.star - 1}`)) return { ok: false, why: 'chain' };
      if (sy.dist !== undefined && c.star >= 2) { const d = aptGradesOf(s); if ((APT_RANK[d[sy.dist]] || 0) < APT_RANK.C) return { ok: false, why: 'dist' }; }
      if (sy.type) { const t = TYPE_OF[s.species]; if (t && t.main !== sy.type && t.sub !== sy.type) return { ok: false, why: 'type' }; if (c.star >= 3 && !s.wonNow.includes(`${c.sys}:2`)) return { ok: false, why: 'chain' }; }
      if (c.scenario) {
        if (s.aid === 'kiki' && s.stats.pow < 400 && s.stats.wise < 400) return { ok: false, why: 'stat', need: 400 };
        if (s.aid === 'dra' && s.techs.length < 3) return { ok: false, why: 'techs', need: 3 };
        if (s.aid === 'sorashido' && num(s.log.cond) > 0) return { ok: false, why: 'cond' };
        if (s.aid === 'erubin' && loyalOf(s) < 70) return { ok: false, why: 'loyal', need: 70 };
        return { ok: true };
      }
      if (c.sys === 'normal' && c.star >= 3 && s.fameTotal < CUP_NEED.fameNormal3) return { ok: false, why: 'fame', need: CUP_NEED.fameNormal3 };
      if (c.sys === 'herosummer' && s.fameTotal < CUP_NEED.fameCrown) return { ok: false, why: 'fame', need: CUP_NEED.fameCrown };
      return { ok: true };
    };

    // 第2版の大会に勝ったときのごほうび。四大大会を4つ全部勝つと、最後の大会のあとに「四大大会制覇」(一度きり)
    // 大会に勝ったときにもらうアイテム(2026-11-14 社長「このまま作る」: 直接のごほうびは残し、アイテムを上乗せ)。
    //   ふつうの大会: ★ オイル/★★ その能力の実/★★★ その能力の実+オイリーオイル/👑 得意の間合いの秘薬+得意の能力の実
    //   第2版の大会: rw.bag に加えて rw.fruitTop(得意の能力の実)・rw.elixirTop(得意の間合いの秘薬)。得意はいまの能力・適性で決める
    const topStatOf = (s) => top3Of(s.stats, s.species)[0];
    const topDistOf = (s) => { const G = DIST_UP.grades; const g = aptGradesOf(s); let best = 0; g.forEach((x, i) => { if (G.indexOf(x) > G.indexOf(g[best])) best = i; }); return best; };
    const cupItemsOf = (s, sys, star) => {
      const o = {}; const add = (k, n) => { if (ITEMS[k] && n > 0) o[k] = num(o[k]) + n; };
      const ex = EX_BY_SYS[sys];
      if (ex) { const rw = ex.rw || {}; if (rw.bag) Object.entries(rw.bag).forEach(([k, n]) => add(k, n)); if (rw.fruitTop) add(`fruit_${topStatOf(s)}`, rw.fruitTop); if (rw.elixirTop) add(`elixir${topDistOf(s)}`, rw.elixirTop); return o; }
      const st = (CUP_SYS[sys] || {}).stat; const fk = `fruit_${KEYS.includes(st) ? st : topStatOf(s)}`;
      if (star === 1) add('oil', 1);
      else if (star === 2) add(fk, 1);
      else if (star === 3) { add(fk, 1); add('oilyoil', 1); }
      else if (star >= 4) { add(`elixir${topDistOf(s)}`, 1); add(`fruit_${topStatOf(s)}`, 1); }
      return o;
    };
    const giveItems = (s, items, out) => { const e = Object.entries(items || {}); if (!e.length) return; e.forEach(([k, n]) => { s.bag[k] = num(s.bag[k]) + n; }); out.gotItems = { ...(out.gotItems || {}), ...items }; };
    const exReward = (s, ex, out) => {
      const rw = ex.rw || {}; const got = {};
      if (rw.all) KEYS.forEach(k => addStat(s, k, rw.all));
      if (rw.stat) for (const [k, v] of Object.entries(rw.stat)) addStat(s, k, v);
      if (rw.loy) addLoyalRaw(s, Math.ceil(rw.loy / 2), Math.floor(rw.loy / 2));
      if (rw.pts) gainWinPts(s, rw.pts);
      if (rw.pop) s.pop = clamp(s.pop + popGain(s, rw.pop), 0, 100);
      if (rw.hpMax) { s.hpMax = Math.min(HP_MAX_CAP, s.hpMax + rw.hpMax); s.hp = Math.min(s.hpMax, s.hp + rw.hpMax); }
      Object.assign(got, cupItemsOf(s, ex.sys, ex.star)); for (const [k, n] of Object.entries(got)) s.bag[k] = num(s.bag[k]) + n;
      if (Number.isInteger(rw.apt) && addAptUp(s, rw.apt, 'cup')) out.aptUp = { dist: rw.apt, grade: aptGradesOf(s)[rw.apt] };
      if (rw.title && !s.titles.includes(rw.title)) s.titles.push(rw.title);
      if (Object.keys(got).length) out.gotItems = got;
      out.exReward = { ...rw };
      if (ex.four && !s.fourDone && EX_CUPS.filter(c => c.four).every(c => s.wonNow.includes(`${c.sys}:${c.star}`))) {
        s.fourDone = true; KEYS.forEach(k => addStat(s, k, FOUR_DONE.all)); gainWinPts(s, FOUR_DONE.pts); s.pop = clamp(s.pop + popGain(s, FOUR_DONE.pop), 0, 100);
        if (!s.titles.includes(FOUR_DONE.title)) s.titles.push(FOUR_DONE.title); out.fourDone = { ...FOUR_DONE };
      }
    };
    // 大会の予想(受付の札): 自分の6能力の合計 ÷ 相手の強さ(ゆらぎ・ライバルは入れない)。敵の数字は見せず、ことばだけ返す
    const FORECAST = Object.freeze([[1.25, 'easy', '楽勝'], [1.06, 'good', '有利'], [0.94, 'even', '互角'], [0.8, 'hard', '苦戦'], [0, 'none', '勝ち目なし…']]);
    const forecastOf = (s, c) => {
      if (!c) return null; const pk = periodOf(s.turn).key; const ex = EX_BY_SYS[c.sys];
      const opp = ex ? benchAt(s) * ex.str : benchOf(pk === 'final' ? 'pro' : pk) * (c.sys === 'scatsu' ? STAR_MULT[4] : (STAR_MULT[c.star] || 1)) * (c.rival ? RIVAL.str : 1);
      const ratio = sumOf(s.stats) / Math.max(1, opp);
      let f = FORECAST.find(([min]) => ratio >= min) || FORECAST[FORECAST.length - 1];
      if (ex && ex.hard && ratio < 1.1) f = FORECAST[4]; // 大一番・最後の四大大会は、よほど勝っていないと「勝ち目なし…」
      return { key: f[1], label: f[2] };
    };
    const fourWinsOf = (s) => EX_CUPS.filter(c => c.four && s.wonNow.includes(`${c.sys}:${c.star}`)).length;
    // 戦う1体(王者かライバル。頂への道は1・2戦目が常連・決勝が王者)
    const cupOfBattle = (b) => (b.kind === 'cup' ? b.sys : b.kind === 'summit' ? 'peak' : (FORCED[b.kind] && FORCED[b.kind].cup) || 'normal');
    const opponentsOf = (s) => {
      const b = s.battle; if (!b) return [];
      const rng = rngOf(s.id, s.turn, 'opp', b.kind, b.retry || 0, b.round || 0, ...(b.reroll ? ['re', b.reroll] : []));
      let sum; let gear; let who = null;
      const cup = cupOfBattle(b); const regs = regularsOf(cup);
      let sp0 = null; // 頂への道: 助手が選んだ相手(STORY-ARC §3)。強さはいままでどおり
      if (b.kind === 'summit') { sum = benchOf('summit') * SUMMIT[b.round].mult; gear = OPP_GEAR.final; sp0 = summitPick(s, b.round); who = sp0.who || null; }
      else if (b.kind === 'debut') { sum = benchOf('debut') * STAR_MULT[1] * Math.max(DEBUT_RETRY_FLOOR, 1 - DEBUT_RETRY_WEAKEN * (b.retry || 0)); gear = OPP_GEAR.debut; who = champOf(cup); }
      else if (b.kind === 'cup' && EX_BY_SYS[b.sys]) { const pk = periodOf(s.turn).key; sum = benchAt(s) * EX_BY_SYS[b.sys].str * (b.rival ? RIVAL.str : 1); gear = OPP_GEAR[pk]; who = b.rival ? null : champOf(cup); }
      else if (b.kind === 'cup') { const pk = periodOf(s.turn).key; sum = benchOf(pk === 'final' ? 'pro' : pk) * (b.sys === 'scatsu' ? STAR_MULT[4] : STAR_MULT[b.star]) * (b.rival ? RIVAL.str : 1); /* 格上への挑戦は1つ上の星の強さ */ gear = OPP_GEAR[pk]; who = b.rival ? null : champOf(cup); }
      else { const f = FORCED[b.kind]; sum = benchOf(b.kind) * STAR_MULT[f.star]; gear = OPP_GEAR[b.kind]; who = champOf(cup); }
      // 虹の砂時計は「相手を変える」: 王者のかわりに常連のだれか(いなければ種のくじ)
      if (b.reroll && !b.rival) { const pool = regs.filter(r => !r.champ); who = pool.length ? pool[(b.reroll - 1 + Math.floor(rng() * pool.length)) % pool.length] : null; }
      const total = sum * (1 + (rng() * 2 - 1) * OPP_JITTER);
      const rv = sp0 && sp0.rival ? sp0.rival : b.rival && Array.isArray(s.rivals) ? s.rivals.find(r => r.name === b.rival.name) : null;
      const sp = rv ? rv.species : who ? who.species : (speciesList[Math.floor(rng() * speciesList.length)] || 'Mocchi');
      // 配り方: ライバルはもとの子の6能力の形のまま期の基準に寄せる・ほかは種の伸びやすさ(自慢の大会はその能力を +15%)
      const sy = CUP_SYS[cup] || {};
      const w = KEYS.map(k => (rv && rv.stats ? Math.max(1, num(rv.stats[k], 100)) : aptMult(sp, k) * (0.85 + rng() * 0.3)) * (sy.stat === k ? 1.15 : 1));
      const ws = w.reduce((a, x) => a + x, 0);
      const ease = b.kind === 'debut' ? debutEase(s, sp, gear.techs) : 1; // 初めの技の強さの差(DEBUT_TECH_FLOOR)
      const stats = {}; KEYS.forEach((k, i) => { stats[k] = clamp(Math.round(total * ease * w[i] / ws), 1, STAT_MAX); });
      // 人気と忠誠度(社長 2026-11-12「敵も人気と忠誠度を設定して」): 期の基準 + 王者/ライバル/頂への道の上乗せ + ±5 のくじ。
      //   忠誠度は試合の「言うことを聞かない番」、人気は会心に効く(育てる子と同じ)。乱数は能力を決めたあとに引く(能力は今までと同じ)
      const pk0 = b.kind === 'summit' ? 'final' : b.kind === 'cup' ? periodOf(s.turn).key : b.kind;
      const OP = OPP_POPLOY[pk0] || OPP_POPLOY.junior;
      const plus = (who && who.champ ? OPP_POPLOY_ADD.champ : rv ? OPP_POPLOY_ADD.rival : sp0 && sp0.pick === 'pop' ? [20, 0] : [0, 0]); // 人気者を選んだら人気 +20
      const jit = () => Math.round((rng() * 2 - 1) * 5);
      const pop = clamp(rv && Number.isFinite(rv.pop) ? Math.round(rv.pop) : OP[0] + plus[0] + jit(), 0, 100);
      const loy = clamp(rv && Number.isFinite(rv.loy) ? Math.round(rv.loy) : OP[1] + plus[1] + jit(), 0, 100);
      return [{ species: sp, stats, sum: sumOf(stats), techs: gear.techs, mastery: gear.mastery, tactics: gear.tactics, round: 0, pop, loy,
        name: rv ? rv.name : who ? who.mon : null, breeder: rv ? (rv.breeder || null) : who ? who.breeder : null, champ: Boolean(who && who.champ), rival: Boolean(rv), note: who ? who.note : null, ...(sp0 ? { pick: sp0.pick } : {}) }];
    };

    // 組み合わせ表の演出(8人のトーナメント)。決まった乱数で、ほかの試合の勝ち上がりも決める。戦うのは決勝の1戦だけ
    const bracketOf = (s) => {
      const b = s.battle; if (!b) return null;
      const rng = rngOf(s.id, s.turn, 'bracket', b.kind, b.round || 0, b.retry || 0);
      const cup = cupOfBattle(b); const opp = opponentsOf(s)[0];
      const regs = regularsOf(cup).filter(r => !opp || r.mon !== opp.name);
      const others = regs.map(r => ({ name: r.mon, breeder: r.breeder, species: r.species }));
      while (others.length < 6) others.push({ name: null, breeder: null, species: speciesList[Math.floor(rng() * speciesList.length)] || 'Mocchi' });
      const you = { you: true, species: s.species };
      const foe = { name: opp ? opp.name : null, breeder: opp ? opp.breeder : null, species: opp ? opp.species : 'Mocchi', champ: opp ? opp.champ : false, rival: opp ? opp.rival : false };
      // 左の山に自分、右の山に相手(決勝で当たる)。ほかの6体を並べる
      const pick = others.slice(0, 6).map(x => ({ x, r: rng() })).sort((p, q) => p.r - q.r).map(o => o.x);
      const entrants = [you, pick[0], pick[1], pick[2], foe, pick[3], pick[4], pick[5]];
      const r1 = [0, 2 + (rng() < 0.5 ? 0 : 1), 4, 6 + (rng() < 0.5 ? 0 : 1)]; // 1回戦の勝ち(自分と相手はかならず勝ち上がる)
      const r2 = [0, 4];
      return { cup, entrants, rounds: [r1, r2], final: [0, 4] };
    };

    // 再戦: 負けた試合の直後(settle の前)に呼ぶ。同じ相手ともう一度(試合の乱数は again で変える)
    const canRematch = (s, item = 'sand') => Boolean(s.battle) && Boolean(REMATCH.items[item]) && num(s.items && s.items[item]) > 0 && s.rematchUsed < REMATCH.max;
    const rematch = (s0, item = 'sand') => {
      const s = clone(s0); if (!canRematch(s, item)) return { state: s0, out: { ok: false } };
      s.items[item] -= 1; s.rematchUsed += 1; s.battle.again = num(s.battle.again) + 1; s.log.rematch = (s.log.rematch || 0) + 1;
      if (item === 'rainbow') s.battle.reroll = num(s.battle.reroll) + 1; // 相手を変える
      return { state: s, out: { ok: true, item, left: s.items[item] } };
    };
    // 一度でも(前の育成も含めて)優勝した大会は、結果だけ見て進める(中で試合は計算する・社長 2026-11-12)
    const battleKey = (b) => (b ? (b.kind === 'summit' ? `summit${b.round + 1}` : b.kind === 'cup' ? `${b.sys}:${b.star}` : b.kind) : '');
    const canSkip = (s) => Boolean(s.battle) && (s.wonBefore.includes(battleKey(s.battle)) || s.wonNow.includes(battleKey(s.battle)));

    // 期末・頂への道の大会(ターンの区切りで立つもの)
    const forcedBattle = (s) => {
      const p = periodOf(s.turn);
      if (p.left === 1 && FORCED[p.key] && p.key !== 'final') return { kind: p.key, round: 0 };
      if (p.key === 'final' && p.at >= 3) return { kind: 'summit', round: p.at - 3 };
      return null;
    };

    // 大会の勝ち負けを受けて結果を付ける。wins は1戦の勝ち(true/false。前の形の配列でもよい・先頭を見る)
    const settle = (s0, wins, use) => {
      const s = clone(s0); const b = s.battle; if (!b) return { state: s, out: { ok: false } };
      const won = Array.isArray(wins) ? Boolean(wins[0]) : Boolean(wins);
      const out = { ok: true, kind: b.kind, won };
      addXp(s, XP.match);
      if (b.rival && b.rival.name) s.rivalMet = String(b.rival.name).slice(0, 24); // 頂への道で助手が選ぶ「この育成のライバル」
      if (won) { s.log.wins += 1; addLoyal(s, LOYAL.win[0], LOYAL.win[1]); const bk = battleKey(b); if (!s.wonNow.includes(bk)) s.wonNow.push(bk); } else s.log.losses += 1;
      // 賞金(保存は fame)とチケット。負けたら準優勝の扱い(★★ 以上)
      const pk = periodOf(s.turn).key;
      const star = b.kind === 'cup' ? b.star : b.kind === 'summit' ? 4 : FORCED[b.kind].star;
      const exB = b.kind === 'cup' ? EX_BY_SYS[b.sys] : null;
      let full = b.kind === 'summit' ? PRIZE.summit[b.round] : exB ? exB.prize : b.kind === 'cup' ? Math.round(CUP_PRIZE[b.star] * PERIOD_PRIZE[pk]) : num(PRIZE[b.kind]);
      let tkFull = b.kind === 'summit' ? TICKET_BASE.summit[b.round] : exB ? exB.tk : b.kind === 'cup' ? Math.round(TICKET_BASE.cup[b.star] * TICKET_BASE.period[pk]) : num(TICKET_BASE[b.kind]);
      if (won && b.rival) { full = Math.round(full * RIVAL.prize); tkFull = Math.round(tkFull * RIVAL.prize); }
      let prize = won ? full : (star >= 2 && b.kind !== 'summit' ? Math.round(full * RUNNER_UP) : 0);
      if (b.sys === 'scatsu' && !won) prize = Math.round(full * 0.5); // 格上への挑戦: 負けても賞金の半分
      if (b.sys === 'scmua' && won) prize = Math.round(full * (1 + 0.3 * (1 - s.stress / 100))); // 笑顔の大会: 機嫌がよいほど賞金 ×1.0〜1.3
      prize = Math.round(prize * (1 + stayNum(s, 'shokin') / 100)); // 💰賞金かせぎ
      s.fame += prize; s.fameTotal += prize; out.prize = prize;
      void tkFull; // 2026-11-14 社長: 修行チケットは賞金ランクの段が上がるたびに(勝つたびの1〜4枚はやめた)
      if (won) { // 優勝の獲得物のチケット(期末の大会・頂への道・★★★以上・四大大会)とライバル
        const winTk = (WIN_TICKET.forced.includes(b.kind) || b.kind === 'summit' || (b.kind === 'cup' && (b.star >= WIN_TICKET.cupStar || (exB && exB.four)))) ? WIN_TICKET.add : 0;
        const t = winTk + (b.rival ? RIVAL.tickets : 0); if (t) { s.tickets += t; out.tickets = t; out.winTickets = t; }
      }
      { // 賞金ランク: 上がった段の数だけチケット。🎫チケット運は段が上がるたびに ◯% でもう1枚
        const from = num(s.fameRank); const to = rankStepOf(s);
        if (to > from) {
          const tk = stayNum(s, 'ticket') / 100; let luck = 0;
          for (let st = from + 1; st <= to; st++) if (tk > 0 && rngOf(s.id, s.turn, 'ticket', st)() < tk) luck += 1;
          s.tickets += (to - from) + luck; s.fameRank = to;
          out.rankUp = { from, to, name: rankNameOf(to), tickets: (to - from) + luck, luck }; if (luck) out.ticketLuck = true;
          out.tickets = num(out.tickets) + (to - from) + luck;
        } else out.rankKeep = { step: from, name: rankNameOf(from) };
      }
      s.mealReady = won; // 2026-11-13 社長: 大会に勝ったときだけごはんを選べる(負けたらなし)
      gainMastery(s, use); // 熟練: 出場で全部の技 +2・使った技は1回 +2(1試合で +6 まで)
      s.battle = null;
      if (b.kind === 'debut') {
        if (won) { s.debutWon = true; s.pop = clamp(s.pop + popGain(s, FORCED.debut.pop), 0, 100); gainWinPts(s, FORCED.debut.pts); s.titles.push(s.debutLoss ? '遅咲きの一歩' : FORCED.debut.title); }
        else { s.debutLoss += 1; if (s.debutLoss >= DEBUT_LOSS_MAX) { s.over = 'gameover'; return { state: s, out: { ...out, gameover: true } }; } } // 持ちこみ・使ったアイテム・チケットは戻さない(社長)
        s.turn += 1; return { state: s, out };
      }
      if (b.kind === 'summit') {
        if (!won) { s.over = 'lost'; out.end = true; applyEnding(s, 'bad', out); return { state: s, out }; }
        if (b.round === SUMMIT.length - 1) {
          const g = s.crowns >= 1 || fourWinsOf(s) >= 2 ? SUMMIT_FINAL.big : SUMMIT_FINAL.plain; // 👑 1つ以上か四大大会 2つ以上
          KEYS.forEach(k => addStat(s, k, g.all)); gainWinPts(s, g.pts); s.pop = clamp(s.pop + popGain(s, g.pop), 0, 100); s.titles.push(g.title);
          applyEnding(s, endingOf(s, true), out);
        }
        s.turn += 1; if (s.turn > TOTAL_TURNS) s.over = 'done';
        return { state: s, out };
      }
      if (b.kind === 'cup') {
        if (won && EX_BY_SYS[b.sys]) { exReward(s, EX_BY_SYS[b.sys], out); if (b.rival) { KEYS.forEach(k => addStat(s, k, RIVAL.all * (1 + stayNum(s, 'rivaldamashii') / 100))); if (!s.titles.includes(RIVAL.title)) s.titles.push(RIVAL.title); out.rivalWin = true; } }
        if (won && !EX_BY_SYS[b.sys]) {
          giveItems(s, cupItemsOf(s, b.sys, b.star), out); // 勝ったときのアイテム(直接のごほうびの上乗せ)
          const sy = CUP_SYS[b.sys] || {};
          if (CUP_REWARD.pts[b.star]) gainWinPts(s, CUP_REWARD.pts[b.star]);
          if (CUP_REWARD.pop[b.star]) s.pop = clamp(s.pop + popGain(s, CUP_REWARD.pop[b.star]), 0, 100);
          if (sy.stat && CUP_REWARD.statUp[b.star]) addStat(s, sy.stat, CUP_REWARD.statUp[b.star]);
          if (sy.dist !== undefined && addAptUp(s, sy.dist, 'cup')) out.aptUp = { dist: sy.dist, grade: aptGradesOf(s)[sy.dist] }; // 間合いの自慢の大会: その間合いが1段上がる
          if (b.star === 4) { KEYS.forEach(k => addStat(s, k, CUP_REWARD.crownAll)); s.crowns += 1; }
          if (b.sys && b.sys.startsWith('sc')) scenarioReward(s, b, out);
          if (b.rival) { KEYS.forEach(k => addStat(s, k, RIVAL.all * (1 + stayNum(s, 'rivaldamashii') / 100))); /* 🏁ライバル魂 */ if (!s.titles.includes(RIVAL.title)) s.titles.push(RIVAL.title); out.rivalWin = true; }
        }
        // 大会に出たターンが期の終わりなら、続けて強制大会
        const fb = forcedBattle(s); if (fb) { s.battle = fb; return { state: s, out }; }
        s.turn += 1; if (s.turn > TOTAL_TURNS) s.over = 'done';
        return { state: s, out };
      }
      const f = FORCED[b.kind];
      if (won) { KEYS.forEach(k => addStat(s, k, f.all)); gainWinPts(s, f.pts); s.pop = clamp(s.pop + popGain(s, f.pop), 0, 100); s.titles.push(f.title); if (f.crown) { s.crowns += 1; s.items[REMATCH.crownWin] += 1; } }
      s.turn += 1; return { state: s, out };
    };
    const gainPts = (s, v) => { const room = PTS.hold - s.pts; const g = Math.max(0, Math.min(room, v)); s.pts += g; s.ptsLost += v - g; };
    const gainWinPts = (s, v) => gainPts(s, Math.round(num(v) * (1 + stayNum(s, 'kokoroe') / 100))); // 📜勝負の心得: 大会に勝ったときの能力ポイント

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

    // ---- 合体(PLAN.md §3「合体」・段取りの回3・2026-11-12 開発部) ----
    // 保存枠の「育て終えた子」2体から、未育成の子を1体つくる。ここは計算だけ(保存・画面はゲーム本体の部品)。
    //   種類: 子の主血統 = 主の親の主血統・子の副血統 = もう一方の親の主血統か副血統(くじ)。その組み合わせのモンスターがいればその種類、
    //         いなければ主の親の種類。血統の正本は data/lineages.js の MONSTER_LINEAGE_MAP(deps.lineage で受け取る・読むだけ)
    //   6能力: 生まれた種類の初期値 + 上乗せ(助手マスモンの合体と同じ MASMON_CALC.fuseBonus。2体の平均を元に・そろいで効く・上限なし)
    //   技: 親の技のうち生まれた種類でも覚えられる技を2つまで(熟練は0から・mast は techs と同じ順の配列。保存枠の形は回3 56-monhero-success-r3-store.jsx) / 型: 主の親の型(くじで少し別の型) / 世代: 親の大きい方 + 1
    //   くじは2体の id から作る決まった乱数なので、見通しと本番が同じになる(押し直しても変わらない)
    const LINEAGE = (deps && deps.lineage) || {};
    const FUSE = Object.freeze({ techs: 2, typeChange: 0.1, genMax: 999 });
    const lineOf = (sp) => { const x = LINEAGE[sp]; return x && typeof x.main === 'string' ? { main: x.main, sub: typeof x.sub === 'string' ? x.sub : x.main } : null; };
    const fuseId = (a, b) => 'f' + hashStr(`${a}|${b}`).toString(36) + hashStr(`${b}#${a}`).toString(36).slice(0, 3);
    const boxSt = (m) => normStats(m && m.st, m && m.species);
    const fuseOk = (a, b) => {
      if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return '2体を選んでください';
      if (!a.id || a.id === b.id) return '同じモンスターどうしでは合体できません';
      if (!speciesList.includes(a.species) || !speciesList.includes(b.species)) return 'このモンスターは合体に使えません';
      if (a.raised !== true || b.raised !== true) return '育て終えたモンスターどうしだけ合体できます';
      return true;
    };
    // 子の種類の候補(くじの前): [{ species, sub, chance }]。同じ血統の組に複数の種類がいれば、主の親と同じ種類を先にし、なければ名前順の先頭
    const fuseKinds = (mainSp, matSp) => {
      const lm = lineOf(mainSp); const lt = lineOf(matSp);
      if (!lm || !lt) return [{ species: mainSp, sub: null, chance: 1 }];
      const subs = [lt.main, lt.sub].filter((v, i, a) => a.indexOf(v) === i);
      const pick = (sub) => {
        const hit = speciesList.filter(sp => { const l = lineOf(sp); return l && l.main === lm.main && l.sub === sub; }).sort();
        return hit.includes(mainSp) ? mainSp : (hit[0] || mainSp);
      };
      return subs.map(sub => ({ species: pick(sub), sub, chance: 1 / subs.length }));
    };
    const fusePlan = (a, b) => {
      const okv = fuseOk(a, b); if (okv !== true) return { ok: false, why: okv };
      const r = rngOf('fuse', a.id, b.id);
      const kinds = fuseKinds(a.species, b.species);
      const kind = kinds[Math.min(kinds.length - 1, Math.floor(r() * kinds.length))];
      const species = kind.species;
      const base = initStats(species);
      const sa = boxSt(a); const sb = boxSt(b); const st = {}; const add = {};
      KEYS.forEach(k => { add[k] = C.fuseBonus(sa[k], sb[k]); st[k] = clamp(base[k] + add[k], 1, STAT_MAX); });
      const own = (m) => canonTechList(m.techs);
      const techs = [...own(a), ...own(b)].filter((t, i, arr) => arr.indexOf(t) === i).filter(t => techById(species, t) && !(techById(species, t).learn || {}).start).slice(0, FUSE.techs);
      const t0 = Number.isInteger(a.gt) ? clamp(a.gt, 0, 5) : C.typeFromApt(aptStr(species), r());
      const typeRoll = r(); const changed = typeRoll < FUSE.typeChange;
      const gt = changed ? C.typeFromApt(aptStr(species), r()) : t0;
      const gen = clamp(Math.max(Math.round(num(a.gen, 1)), Math.round(num(b.gen, 1)), 1) + 1, 2, FUSE.genMax);
      const parentOf = (m) => ({ id: String(m.id), species: m.species, nick: typeof m.nick === 'string' ? m.nick.slice(0, 16) : '', rank: typeof m.rank === 'string' ? m.rank : null, gen: Math.max(1, Math.round(num(m.gen, 1))) });
      return {
        ok: true, kinds, sub: kind.sub, base, add,
        typeChanged: changed && gt !== t0,
        parentInfo: [parentOf(a), parentOf(b)],
        child: { id: fuseId(a.id, b.id), species, nick: species === a.species && typeof a.nick === 'string' ? a.nick.slice(0, 16) : '', gen, st, techs, mast: techs.map(() => 0), gt, lv: 1, raised: false, parents: [String(a.id), String(b.id)], ...(aptInherit(a, b).some(n => n > 0) ? { aptBase: aptInherit(a, b) } : {}) },
      };
    };

    // ---- 評価(引退): 総合力・ランク・アシストポイント・上位3つ ----
    // 評価の表示(社長 2026-11-12: ランク表は助手マスモンと同じ・500ごとに番号。C は 6,000/6,500/7,000/7,500 で C1〜C4・M は上限なしで M1・M2…)
    const GRADE_STEP = 500;
    const gradeOf = (power) => { const p = Math.max(0, num(power)); const r = C.rankOf(p); const step = Math.floor((p - r.min) / GRADE_STEP) + 1; return { rank: r.key, step, label: `${r.key}${step}`, min: r.min, next: r.next, toNext: GRADE_STEP - ((p - r.min) % GRADE_STEP) }; };
    const evaluate = (s) => {
      const loy = loyalOf(s);
      const techRows = techRowsOf(s);
      const power = powerOfParts({ stats: s.stats, lv: s.lv, loyal: loy, pop: s.pop }, techRows);
      const rank = C.rankOf(power);
      return { power, rank: rank.key, grade: gradeOf(power), points: assistPointsOf(power), top: top3Of(s.stats, s.species), sum: sumOf(s.stats), loyal: loy, ama: s.ama, fear: s.fear, pop: s.pop, lv: s.lv, techs: techRows.length, techRows, over: s.over };
    };

    const EVX = (deps && deps.events) || (root && root.MONHERO_SUCCESS_EVENTS) || null;
    EV = EVX && typeof EVX.create === 'function' ? EVX.create({
      KEYS, TOTAL_TURNS, FORCED, BOND, rngOf, periodOf, monthOf, clamp, num, r2, unitOf, addStat: (s, k, v) => addStat(s, k, num(v) > 0 ? num(v) * (1 + stayNum(s, 'event') / 100) : v), addLoyalRaw, recover, addStress, addBond, loyalOf, aptMult, gainPts, popGain, addAptUp, aptUpRoom, aptGradesOf, DIST_UP_GRADES: DIST_UP.grades,
      typeOf: TYPE_OF, peakOf: (type) => C.peakOf(type), arc: ARC,
    }) : null;

    return Object.freeze({
      events: EV,
      VERSION, STORY, KEYS, STAT_NAMES, PERIODS, TOTAL_TURNS, FORCED, SUMMIT, BASE, RESULTS, RATE, REST, PLAY, CLINIC, COND, LOYAL, GATHER, BOND, STORY, LOTTERY,
      ASSISTS, ISSA, PTS, XP, SHUGYO, TECH_POWER, MASTERY, techRowsOf, techPowerOfRows, powerOf, techBoostOf, techUseOf, ITEMS, GOOD, CARRY_MAX, useItem, FAME_V, FAME_SCALE, TICKET_BASE, TRAIN_LV, trainLvOf, REMATCH, canRematch, rematch, canSkip, battleKey, PRIZE, MEALS, meal, MEAL_WATCH_MULT, ticketsOfPrize, TECH_MAX, techsOf, canLearn, techRate, learnable, techRank, shugyoQ, superLeft, techMissOf, techCanon, canonTechList, shugyoLeft, teachFrom, BENCH: BENCH_USE, STAR_MULT, TAG_POWER, BOND_START, RANK_ADD, TRAIN_COMBO, AIDS, speciesList, shugyoGainOf, EX_CUPS, EX_BY_SYS, cupItemsOf, CUP_REWARD, FAME_RANK, FAME_RANK_MAX, rankStepOf, rankNameOf, rankNeedG, WIN_TICKET, FOUR_DONE, fourWinsOf, forecastOf, ELIXIR_ADD, FRUIT_MULT,
      rngOf, periodOf, aptMult, initStats, memberOf, memberEffect, newRun, gatherOf, cardMult, peek, failRateOf, sabRateOf, greatRateOf,
      act, react, issa, issaComes, issaRate, endTurn, opponents: opponentsOf, settle, cupsOf, canEnter, bracketOf, gradeOf, GRADE_STEP, stayV, SC_CUPS, SC_NAME, ASST_STORY, storyEnd, markSpecial, battleMods, battleBuffs, peakTurn, ASTORY, storyDue, storyStep, preview, restore, ARC, PARTY, summitPick, endingOf, endingSeen, CUP_SYS, YEAR, RIVAL, CUP_PRIZE, spendPts, autoPts, ptsCost, evaluate, assistPointsOf, loyalOf, loyalMult, top3Of, sumOf,
      FUSE, fuseOk, fuseKinds, fusePlan, fuseId,
      DIST_UP, aptUpOf, aptGradesOf, aptUpRoom, addAptUp, aptSendOf, aptInherit, aptBaseNorm,
      AWAKE, aptAwakeNorm, awakeOpen, awakePick, peakInfo,
    });
  };

  const api = Object.freeze({ VERSION, KEYS, TOTAL_TURNS, PERIODS, create, rngOf, hashStr, periodOf, assistPointsOf });
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.MONHERO_SUCCESS = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
