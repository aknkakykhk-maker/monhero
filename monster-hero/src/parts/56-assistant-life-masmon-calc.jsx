// マスモンの育成の「計算だけの部品」(2026-11-12 キズナ・案 docs/progress/assistant-peer/masmon-plan/POWER.md 第3版・FUSE.md 第2版)
//   窓口のお願い: 助手や保存キーに結びつけない。入力 = 値(能力・寿命の割合・方針など)、出力 = 結果。助手の側はこれを呼ぶだけ
//   のちのプレイヤー側の育成(ターン制)からも使えるよう、年齢は日数ではなく「寿命のうち何割まで来たか(0〜1)」で受ける
//   React・保存・Date・Math.random を使わない。乱数がいる所は 0〜1 の値 r を外から渡す(同じ入力なら同じ結果)
const MASMON_CALC = (() => {
  const KEYS = ['life', 'pow', 'wise', 'hit', 'eva', 'tough'];
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const num = (v, d = 0) => (v === null || v === undefined || v === '' ? d : Number.isFinite(Number(v)) ? Number(v) : d); // null・'' も既定値(Number(null)=0 にしない・ミハリ5)
  const STAT_MAX = 999;

  // ---- 総合力とランク(POWER.md 1・2章) ----
  // 能力の重み(2026-11-14 社長「能力が高いほど1あたりの総合力が増える」・直線): 能力1あたり = stat + statUp × 能力 ÷ statAt(0 で 2.5・900 で 4.5・999 で 約4.72)
  const POWER_W = Object.freeze({ stat: 2.5, statUp: 2, statAt: 900, tech: 100, mastery: 1, lv: 15, loyal: 10, pop: 10, techMax: 8 });
  const statPower = (v) => { const x = clamp(num(v), 0, STAT_MAX); return x * (POWER_W.stat + POWER_W.statUp * x / POWER_W.statAt); };
  // stats: { life, pow, ... } / masteries: 覚えた技ごとの熟練(0〜100)の配列 / lv / loyal / pop
  const power = (o) => {
    const { stats, masteries, lv = 1, loyal = 0, pop = 0 } = o && typeof o === 'object' ? o : {}; const st = stats && typeof stats === 'object' ? stats : {}; // どんな値でも数を返す(ミハリ5)
    const sum = KEYS.reduce((a, k) => a + statPower(st[k]), 0);
    const tech = (Array.isArray(masteries) ? masteries : []).slice(0, POWER_W.techMax).reduce((a, m) => a + POWER_W.tech + clamp(num(m), 0, 100) * POWER_W.mastery, 0);
    return Math.round(sum + tech + clamp(num(lv, 1), 1, 99) * POWER_W.lv + clamp(num(loyal), 0, 100) * POWER_W.loyal + clamp(num(pop), 0, 100) * POWER_W.pop);
  };
  // ランク(2026-11-14 社長「M は 20,000」)。key は 11 種のまま(表で引く所はこれ)。M より上は 500 ごとに M1〜M9 → MG → MG1〜MG9 → MF …(画面に出すのは label)
  const RANKS = Object.freeze([['G', 0], ['F', 2000], ['E', 3000], ['D', 4500], ['C', 6000], ['B', 8000], ['A', 11000], ['S', 14000], ['SS', 16000], ['SSS', 18000], ['M', 20000]]);
  const M_STEP = 500; const M_LETTERS = Object.freeze(['', 'G', 'F', 'E', 'D', 'C', 'B', 'A']); // M・MG・MF … MA(それぞれ番号なし+1〜9)
  const mLabelOf = (v) => { const i = Math.min(M_LETTERS.length * 10 - 1, Math.max(0, Math.floor((v - RANKS[RANKS.length - 1][1]) / M_STEP))); const b = Math.floor(i / 10), n = i % 10;
    return { label: `M${M_LETTERS[b]}${n ? n : ''}`, labelMin: RANKS[RANKS.length - 1][1] + i * M_STEP, labelNext: i + 1 < M_LETTERS.length * 10 ? RANKS[RANKS.length - 1][1] + (i + 1) * M_STEP : null }; };
  const rankOf = (p) => { const v = num(p); let i = 0; RANKS.forEach(([, min], j) => { if (v >= min) i = j; });
    const key = RANKS[i][0]; const m = key === 'M' ? mLabelOf(v) : { label: key, labelMin: RANKS[i][1], labelNext: RANKS[i + 1] ? RANKS[i + 1][1] : null };
    return { key, min: RANKS[i][1], next: RANKS[i + 1] ? RANKS[i + 1][1] : null, index: i, ...m }; };

  // ---- 合体の上乗せ(FUSE.md 第2版): 平均 × √(弱い方÷強い方) を効く値にし、200 ×(効く値÷999)^1.5 ----
  const FUSE = Object.freeze({ top: 200, pow: 1.5, ref: 999 });
  const fuseBonus = (a, b) => { // 入力も 999 で切る(ミハリ5)
    const x = clamp(num(a), 0, STAT_MAX); const y = clamp(num(b), 0, STAT_MAX); const hi = Math.max(x, y); const lo = Math.min(x, y);
    if (hi <= 0) return 0;
    return Math.round(FUSE.top * Math.pow((((x + y) / 2) * Math.sqrt(lo / hi)) / FUSE.ref, FUSE.pow));
  };
  // base(種類の初期値)+ 上乗せ。能力の上限 999 だけ守る
  const fuseStats = (base, a, b) => { const st = {}; const add = {}; for (const k of KEYS) { add[k] = fuseBonus(a && a[k], b && b[k]); st[k] = clamp(Math.round(num(base && base[k]) + add[k]), 1, STAT_MAX); } return { st, add }; };

  // ---- 育ちの速さ(POWER.md 7章・社長 ×3) ----
  const PACE = 3;

  // ---- 成長の型と、年齢(寿命の割合)での伸び(6章) ----
  const GROW_TYPES = Object.freeze([
    { key: 'vearly', name: '超早熟', c: [1.3, 1.7, 1.7, 1.4, 1.1, 0.9, 0.8, 0.7, 0.7, 0.6] },
    { key: 'early', name: '早熟', c: [1.1, 1.4, 1.6, 1.6, 1.3, 1.0, 0.9, 0.8, 0.7, 0.6] },
    { key: 'normal', name: '普通', c: [0.9, 1.0, 1.2, 1.4, 1.5, 1.4, 1.2, 1.0, 0.8, 0.7] },
    { key: 'late', name: '晩成', c: [0.7, 0.8, 0.9, 1.0, 1.2, 1.4, 1.5, 1.5, 1.2, 0.9] },
    { key: 'vlate', name: '超晩成', c: [0.7, 0.8, 0.8, 0.9, 1.0, 1.1, 1.3, 1.5, 1.6, 1.4] },
    { key: 'steady', name: '持続', c: [1.0, 1.1, 1.15, 1.15, 1.15, 1.15, 1.15, 1.15, 1.1, 1.0] },
  ]);
  const typeOf = (t) => GROW_TYPES[clamp(Math.round(num(t, 2)), 0, GROW_TYPES.length - 1)];
  // frac = 寿命のうち何割まで来たか(0〜1)。1 以上 = 寿命(伸びは 0)
  const ageMult = (t, frac) => { const f = num(frac); if (f >= 1) return 0; const c = typeOf(t).c; return c[clamp(Math.floor(Math.max(0, f) * 10), 0, 9)]; };
  // いちばん伸びる区間(表示用): { from, to }(寿命の割合)と高さ
  const peakOf = (t) => { const c = typeOf(t).c; const top = Math.max(...c); const idx = c.map((v, i) => (v === top ? i : -1)).filter(i => i >= 0); return { from: idx[0] / 10, to: (idx[idx.length - 1] + 1) / 10, mult: top }; };
  // 迎えたときの型: 伸びやすさの字(A〜E の6文字)で出やすさを変える。どの型も出る。r は 0〜1
  const typeFromApt = (apt, r) => {
    const s = String(apt || ''); const hi = (s.match(/A/g) || []).length; const lo = (s.match(/[CDE]/g) || []).length;
    const w = [1, 2, 3, 2, 1, 1]; // 超早熟・早熟・普通・晩成・超晩成・持続
    if (hi >= 2) { w[0] += 1; w[1] += 2; } else if (lo >= 4) { w[3] += 2; w[4] += 1; }
    const total = w.reduce((a, b) => a + b, 0); let x = clamp(num(r), 0, 0.999999) * total;
    for (let i = 0; i < w.length; i++) { if (x < w[i]) return i; x -= w[i]; }
    return 2;
  };

  // ---- 育成方針(5章): -3 超溺愛 〜 0 普通 〜 +3 超スパルタ ----
  const POLICIES = Object.freeze([
    { name: '超溺愛', life: 40, stress: 0.6, gain: 0.80, sab: 2.0 },
    { name: '溺愛', life: 37, stress: 0.75, gain: 0.87, sab: 1.6 },
    { name: '甘い', life: 33, stress: 0.9, gain: 0.94, sab: 1.3 },
    { name: '普通', life: 30, stress: 1.0, gain: 1.00, sab: 1.0 },
    { name: '厳しい', life: 27, stress: 1.15, gain: 1.06, sab: 0.8 },
    { name: 'スパルタ', life: 23, stress: 1.3, gain: 1.12, sab: 0.6 },
    { name: '超スパルタ', life: 20, stress: 1.5, gain: 1.18, sab: 0.4 },
  ]);
  const policyOf = (pol) => POLICIES[clamp(Math.round(num(pol)), -3, 3) + 3];
  const POLICY_STEP = 10;
  // 褒める(-1)・叱る(+1)で点が動き、10点で1段。逆へ押すと点が戻る。返り値 { pol, pp }
  const policyMove = (pol, pp, dir) => {
    let p = clamp(Math.round(num(pol)), -3, 3); let q = clamp(Math.round(num(pp)), -(POLICY_STEP - 1), POLICY_STEP - 1) + (dir > 0 ? 1 : dir < 0 ? -1 : 0);
    if (q >= POLICY_STEP) { if (p < 3) { p += 1; q = 0; } else q = POLICY_STEP - 1; }
    if (q <= -POLICY_STEP) { if (p > -3) { p -= 1; q = 0; } else q = -(POLICY_STEP - 1); }
    return { pol: p, pp: q };
  };
  // 寿命の進み: 1単位(助手は1日・プレイヤー側は1ターンなど)ごとに足す割合。base は「普通の方針の寿命」をその単位で
  const lifeLen = (pol, base = 30) => (policyOf(pol).life / 30) * Math.max(1, num(base, 30)); // その方針の寿命(base と同じ単位)
  const lifeStep = (pol, base = 30) => 1 / lifeLen(pol, base);
  // 1日 = 1か月 として「◯歳◯か月」
  const ageLabel = (months) => { const m = Math.max(0, Math.floor(num(months))); return `${Math.floor(m / 12)}歳${m % 12}か月`; };

  // ---- 忠誠度と人気(3・4章) ----
  const noActChance = (loyal) => (100 - clamp(num(loyal, 100), 0, 100)) * 0.0025; // 100で0・0で0.25
  const critBonus = (pop) => clamp(num(pop), 0, 100) / 500; // 100で +0.20
  const CRIT_CAP = 0.30;
  const critOf = (base, pop) => Math.min(CRIT_CAP + critBonus(pop), Math.max(0, num(base)) + critBonus(pop));
  const sabLoyalMult = (loyal) => 1.5 - clamp(num(loyal, 50), 0, 100) / 100;
  const POP = Object.freeze({ pvpWin: 2, pvpLose: 0.5, peerWin: 1, peerLose: 0.2, spar: 0.2, idleDays: 7, idleDrop: 1 });
  const popAfterBattle = (pop, kind, win) => { const d = kind === 'pvp' ? (win ? POP.pvpWin : POP.pvpLose) : kind === 'peer' ? (win ? POP.peerWin : POP.peerLose) : kind === 'spar' && win ? POP.spar : 0; return clamp(num(pop) + d, 0, 100); };

  // ---- 訓練・修行の結果(9章) ----
  const RESULTS = Object.freeze({ great: { name: '大成功', mult: 1.5, str: -3 }, ok: { name: '成功', mult: 1, str: 0 }, fail: { name: '失敗', mult: 0.3, str: 0 }, cheat: { name: 'ズル', mult: 0.2, str: 0, noFat: true }, skip: { name: 'サボり', mult: 0, fat: -5, str: -5 } });
  // sab = 育成ノートのサボりの起きやすさ(0〜1・忠誠と方針をかける前)/fail = 失敗の起きやすさ/r = 0〜1
  const resultOf = (o) => {
    const { loyal = 50, pol = 0, sab = 0, fail = 0, r = 0.5 } = o && typeof o === 'object' ? o : {};
    const L = clamp(num(loyal, 50), 0, 100); const x = clamp(num(r), 0, 0.999999);
    const pSkip = clamp(num(sab) * sabLoyalMult(L) * policyOf(pol).sab, 0, 0.9);
    const pCheat = L < 50 ? Math.min(0.10, (50 - L) / 500) : 0;
    const pFail = clamp(num(fail), 0, 0.9);
    const pGreat = L >= 80 ? 0.11 : 0.08;
    let a = pSkip; if (x < a) return 'skip';
    a += pCheat; if (x < a) return 'cheat';
    a += pFail; if (x < a) return 'fail';
    a += pGreat; if (x < a) return 'great';
    return 'ok';
  };
  // 叱る(scold)・褒める(praise)の結果: 忠誠度の増減と、方針の向き(+1 厳しい側・-1 甘い側)
  const reactOf = (result, act) => {
    const good = result === 'great' || result === 'ok'; const bad = result === 'cheat' || result === 'skip';
    if (act === 'praise') return { loyal: good ? 3 : result === 'fail' ? 1 : bad ? -3 : 0, dir: -1 };
    if (act === 'scold') return { loyal: bad ? 4 : result === 'fail' ? -2 : good ? -5 : 0, dir: 1 };
    return { loyal: 0, dir: 0 };
  };

  // ---- けが・病気・家出の長さ(社長: 重さで幅): 軽い1回・ふつう3回・重い6回。疲れ・ストレスが高いほど重い ----
  const condLen = (load, r) => { const v = clamp(num(load), 0, 100); const x = clamp(num(r), 0, 0.999999); const heavy = v >= 90 ? 0.3 : v >= 80 ? 0.15 : 0.05; const light = v >= 90 ? 0.2 : v >= 80 ? 0.35 : 0.5; return x < heavy ? 6 : x < heavy + light ? 1 : 3; };

  return Object.freeze({ KEYS, STAT_MAX, POWER_W, statPower, power, RANKS, M_STEP, M_LETTERS, rankOf, FUSE, fuseBonus, fuseStats, PACE, GROW_TYPES, typeOf, ageMult, peakOf, typeFromApt,
    POLICIES, policyOf, POLICY_STEP, policyMove, lifeLen, lifeStep, ageLabel, noActChance, critBonus, CRIT_CAP, critOf, sabLoyalMult, POP, popAfterBattle, RESULTS, resultOf, reactOf, condLen });
})();
