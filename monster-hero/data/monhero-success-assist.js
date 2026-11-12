// モンヒロサクセスのアシスト能力(モンサク専用の能力)の表(第2版・2026-11-12 開発部)
// 案: docs/progress/player-raise/ASSIST.md §1・§3・§5 / 一覧と決めたこと: docs/progress/player-raise/TITLES.md §2
//
// ★画面なし・保存なし。いまは index.html から読まれず、誰にも見えない(取る画面は回3)。
// ★社長 2026-11-12:
//   ・「トレ効果アップ・集合率アップなど誰にでも効くものを優先」(血統・タイプの条件つきは入れない)
//   ・「14個では少ない。30〜40個に」→ 40種類 /「種類ごとに数値も多く。トレ効果アップ 5%・10%・15% など」→ どれも5段
//   ・お話のひらめき5つは「試合の中で効く形」(対戦の芯の buffs #5722)
// ★参考(docs/reference/line-mf/assist-*.json)からは「どんな種類があるか」だけを拾い、名前と数字はモンサクの物差しで作り直した。
// ★この第2版が正。芯(monhero-success.js の ASSISTS)はまだ第1版(9種類・3段)なので、芯がこの表を読むように直すまで、
//   芯の訓練の計算には第1版の数字が使われる(見張り tools/success/monhero-success-tables-check.js は、id・名前・型だけ芯と比べる)。
//
//   id    … 英小文字だけ(保存枠の子の assists:[{ id, lv }] に入る)
//   type  … with(いっしょ型: その子が集まった訓練でだけ)/ self(その子自身)/ stay(いるだけ型: 編成でいちばん高い段の1つだけ)
//           battle(試合型: 編成にいると、育てる子の大会の試合で効く。いるだけ型と同じく、編成でいちばん高い段の1つだけ)
//   scene … 画面で並べる組(SCENES)
//   v     … 段1〜5の効き目(単位は unit)/ cost … 段1〜5を取るのに要るポイント(段の合計。値段の組 COST の1つ)
//   text  … 説明の1行。{v} に段の数字が入る(text5 があれば段5はそちら)
//   from  … core(いつでも取れる)/ hint(お話のひらめきで候補に出る)
//   buff  … type battle だけ: 段1〜5の対戦の芯の buffs(battleBuffs がまとめる)
(function (root) {
  'use strict';

  const fz = (o) => Object.freeze(o);
  // 値段の組(段の合計)。ポイントは 20〜400(総合力 ÷ 50)・1体4種類まで。
  //   高: 誰にでもよく効く(段5 = 210 → 総合力 10,500〜 = A ランクから)/ 中: よく効く / 低: 場面が限られる(段1 = 16 → どの子も1つは取れる)
  const COST = Object.freeze({ high: [30, 60, 100, 150, 210], mid: [24, 48, 80, 120, 170], low: [16, 32, 56, 88, 128] });
  const SCENES = Object.freeze([
    ['train', '訓練'], ['stat', '能力ごとの訓練'], ['team', '編成・親密度'], ['care', '体力・ようす'], ['cup', '大会'], ['event', '出来事・博士'], ['battle', '試合'],
  ].map(([key, name]) => fz({ key, name })));

  const STAT = [['pow', 'ちから'], ['wise', 'かしこさ'], ['hit', '命中'], ['eva', '回避'], ['tough', '丈夫さ'], ['life', 'ライフ']];
  const STAT_ICON = { pow: '💥', wise: '📘', hit: '🎯', eva: '💨', tough: '🛡', life: '❤' };

  const L = [];
  const add = (o) => L.push(fz({ from: 'core', ...o, cost: COST[o.cls] }));

  // ---- 訓練(いっしょ型) ----
  add({ id: 'sokoji', icon: '🔥', name: '特訓の底力', type: 'with', scene: 'train', cls: 'high', unit: '%', v: [5, 10, 15, 20, 25],
    text: 'この子がいっしょに訓練すると、伸びが{v}%上がる' });
  add({ id: 'kizuna', icon: '💞', name: '信頼のきずな', type: 'with', scene: 'train', cls: 'high', unit: '%', v: [4, 8, 12, 16, 20],
    text: 'この子がいっしょに訓練すると、忠誠度が高いほど伸びが上がる(忠誠100で +{v}%)' });
  add({ id: 'atooshi', icon: '🎯', name: '得意の後押し', type: 'with', scene: 'train', cls: 'mid', unit: '%', v: [6, 12, 18, 24, 30],
    text: 'この子のいちばん高い能力の訓練に来ると、伸びがさらに{v}%上がる' });
  add({ id: 'hirameki', icon: '✨', name: 'ひらめき', type: 'with', scene: 'train', cls: 'mid', unit: '点', v: [2, 4, 6, 8, 10],
    text: 'この子がいっしょに訓練すると、大成功しやすくなる(+{v}点)' });
  add({ id: 'ochitsuki', icon: '🧘', name: '落ち着き', type: 'with', scene: 'train', cls: 'mid', unit: '%', v: [10, 20, 30, 40, 50],
    text: 'この子がいっしょに訓練すると、失敗しにくくなる(失敗の率 −{v}%)' });
  add({ id: 'itawari', icon: '🩹', name: 'いたわり', type: 'with', scene: 'train', cls: 'mid', unit: '%', v: [5, 10, 15, 20, 25],
    text: 'この子がいっしょに訓練すると、減る体力が{v}%少なくなる' });
  add({ id: 'miharu', icon: '👀', name: '見張り役', type: 'with', scene: 'train', cls: 'low', unit: '%', v: [15, 30, 45, 60, 75],
    text: 'この子がいっしょに訓練すると、サボりにくくなる(サボりの率 −{v}%)' });
  add({ id: 'kibarashi', icon: '🎈', name: '気晴らし', type: 'with', scene: 'train', cls: 'low', unit: '%', v: [10, 20, 30, 40, 50],
    text: 'この子がいっしょに訓練すると、たまるストレスが{v}%少なくなる' });

  // ---- 能力ごとの訓練(いっしょ型・その能力の訓練に来たときだけ) ----
  STAT.forEach(([k, n]) => add({ id: `kun${k}`, icon: STAT_ICON[k], name: `${n}特訓`, type: 'with', scene: 'stat', cls: 'low', unit: '%', v: [6, 12, 18, 24, 30], stat: k,
    text: `この子が「${n}」の訓練にいっしょに来ると、伸びが{v}%上がる` }));

  // ---- 編成・親密度 ----
  add({ id: 'kaketsuke', icon: '📯', name: 'かけつけ', type: 'self', scene: 'team', cls: 'mid', unit: '点', v: [4, 8, 12, 16, 20],
    text: 'この子が得意な訓練に来やすくなる(得意率 +{v}点・90%まで)' });
  add({ id: 'hitonatsu', icon: '🤝', name: '人なつっこさ', type: 'stay', scene: 'team', cls: 'mid', unit: '倍', v: [1.1, 1.2, 1.3, 1.4, 1.5], start: [3, 6, 9, 12, 15],
    text: '編成にいるだけで、みんなの親密度の上がりが{v}倍(この子のはじめの親密度も +{start})' });
  add({ id: 'shitashi', icon: '🌱', name: 'はじめの親しさ', type: 'self', scene: 'team', cls: 'low', unit: '', v: [5, 10, 15, 20, 25],
    text: 'この子のはじめの親密度が +{v}' });
  add({ id: 'nakayoshi', icon: '🫶', name: '仲よし特訓', type: 'with', scene: 'team', cls: 'low', unit: '', v: [1, 2, 3, 4, 5],
    text: 'この子といっしょに訓練すると、親密度の上がりが +{v}' });
  add({ id: 'tagpow', icon: '⚡', name: 'タッグの息', type: 'with', scene: 'team', cls: 'mid', unit: '%', v: [3, 6, 9, 12, 15],
    text: 'この子が友情タッグになったとき、タッグの強さが +{v}%' });
  add({ id: 'shitsuke', icon: '📏', name: 'しつけ上手', type: 'stay', scene: 'team', cls: 'mid', unit: '%', v: [5, 10, 15, 20, 25],
    text: '編成にいるだけで、褒める・叱るで上がる忠誠度が{v}%増える' });

  // ---- 体力・ようす ----
  add({ id: 'gussuri', icon: '💤', name: 'ぐっすり', type: 'stay', scene: 'care', cls: 'low', unit: '%', v: [5, 10, 15, 20, 25],
    text: '編成にいるだけで、休んだときの体力の回復が{v}%増える' });
  add({ id: 'asobi', icon: '🪁', name: '遊び上手', type: 'stay', scene: 'care', cls: 'low', unit: '%', v: [10, 20, 30, 40, 50],
    text: '編成にいるだけで、遊んだときの体力の回復と甘え度の上がりが{v}%増える' });
  add({ id: 'kuishinbo', icon: '🍙', name: '食いしん坊', type: 'stay', scene: 'care', cls: 'low', unit: '%', v: [5, 10, 15, 20, 25],
    text: '編成にいるだけで、ごはんの効き目が{v}%増える' });
  add({ id: 'tsukisoi', icon: '🏥', name: '通院の付きそい', type: 'stay', scene: 'care', cls: 'low', unit: '点', v: [6, 12, 18, 24, 30],
    text: '編成にいるだけで、通院で治りやすくなる(+{v}点)' });
  add({ id: 'genki', icon: '🍀', name: '元気のお守り', type: 'stay', scene: 'care', cls: 'low', unit: '%', v: [10, 20, 30, 40, 50],
    text: '編成にいるだけで、けがや悪いようすになりにくくなる(なる率 −{v}%)' });
  add({ id: 'tairyoku', icon: '🔋', name: '体力自慢', type: 'stay', scene: 'care', cls: 'low', unit: '', v: [4, 8, 12, 16, 20],
    text: '編成にいるだけで、育てる子の体力の上限が初めから +{v}' });
  add({ id: 'shugyo', icon: '⚔', name: '修行の手ほどき', type: 'stay', scene: 'care', cls: 'mid', unit: '%', v: [5, 10, 15, 20, 25],
    text: '編成にいるだけで、修行の伸びと熟練の上がりが{v}%上がる' });

  // ---- 大会 ----
  add({ id: 'shokin', icon: '💰', name: '賞金かせぎ', type: 'stay', scene: 'cup', cls: 'low', unit: '%', v: [5, 10, 15, 20, 25],
    text: '編成にいるだけで、大会の賞金(名声)が{v}%増える' });
  add({ id: 'kokoroe', icon: '📜', name: '勝負の心得', type: 'stay', scene: 'cup', cls: 'mid', unit: '%', v: [5, 10, 15, 20, 25],
    text: '編成にいるだけで、大会で勝ったときの能力ポイントが{v}%増える' });
  add({ id: 'ticket', icon: '🎫', name: 'チケット運', type: 'stay', scene: 'cup', cls: 'low', unit: '%', v: [10, 20, 30, 40, 50],
    text: '編成にいるだけで、大会に勝ったとき{v}%で修行チケットがもう1枚もらえる' });
  add({ id: 'rivaldamashii', icon: '🏁', name: 'ライバル魂', type: 'stay', scene: 'cup', cls: 'low', unit: '%', v: [10, 20, 30, 40, 50],
    text: '編成にいるだけで、ライバルに勝ったときのごほうび(全能力)が{v}%増える' });
  add({ id: 'ninki', icon: '🌟', name: '人気者のお手本', type: 'stay', scene: 'cup', cls: 'low', unit: '%', v: [10, 20, 30, 40, 50],
    text: '編成にいるだけで、人気の上がりが{v}%増える' });

  // ---- 出来事・イッサ博士 ----
  add({ id: 'yobimizu', icon: '💬', name: '出来事の呼び水', type: 'stay', scene: 'event', cls: 'mid', unit: '点', v: [3, 6, 9, 12, 15],
    text: '編成にいるだけで、編成の子との出来事が起きやすくなる(+{v}点)' });
  add({ id: 'mejirushi', icon: '🧪', name: '博士の目じるし', type: 'stay', scene: 'event', cls: 'low', unit: '点', v: [0.5, 1, 1.5, 2, 2.5],
    text: '編成にいるだけで、イッサ博士が来やすくなる(1ターン +{v}点)' });
  add({ id: 'joshu', icon: '🔬', name: '博士の助手', type: 'stay', scene: 'event', cls: 'mid', unit: '点', v: [2, 4, 6, 8, 10],
    text: '編成にいるだけで、イッサ博士の実験が成功しやすくなる(+{v}点)' });

  // ---- お話のひらめき(試合型・社長 2026-11-12「試合の中で効く形」)。いい結末で見終えると引退のときの候補に並ぶ ----
  //   buff は対戦の芯 ASSISTANT_MASMON_BATTLE.simulate の buffs.A に入る形(#5722)。どの試合にも効くので、
  //   助手の「特別な1話」(頂への道の1回戦だけ)より小さくした
  const hint = (o) => add({ ...o, type: 'battle', scene: 'battle', cls: 'mid', from: 'hint' });
  hint({ id: 'gatsu', icon: '💪', name: '試合のはじめのガッツ', aid: 'atsu', unit: '', v: [2, 4, 6, 8, 10],
    buff: [{ guts: 2 }, { guts: 4 }, { guts: 6 }, { guts: 8 }, { guts: 10 }],
    text: '編成にいるだけで、大会の試合のはじめのガッツが +{v}' });
  hint({ id: 'miseba', icon: '🎤', name: '見せ場', aid: 'momosuke', unit: '%', v: [2, 4, 6, 8, 10],
    buff: [{ crit: 0.02 }, { crit: 0.04 }, { crit: 0.06 }, { crit: 0.08 }, { crit: 0.1 }],
    text: '編成にいるだけで、大会の試合で会心が出やすくなる(+{v}%)' });
  hint({ id: 'mitate', icon: '🔍', name: '見立て', aid: 'kyuko', unit: '%', v: [2, 4, 6, 8, 10],
    buff: [{ eva: 0.02 }, { eva: 0.04 }, { eva: 0.06 }, { eva: 0.08 }, { eva: 0.1 }],
    text: '編成にいるだけで、大会の試合で相手の攻撃をよけやすくなる(相手の命中 −{v}%)' });
  hint({ id: 'kensho', icon: '📐', name: '検証', aid: 'sorashido', unit: '%', v: [10, 20, 30, 40, 50],
    buff: [{ missCut: 0.1 }, { missCut: 0.2 }, { missCut: 0.3 }, { missCut: 0.4 }, { missCut: 0.5 }],
    text: '編成にいるだけで、大会の試合で技が外れにくくなる(外れる率 −{v}%)' });
  hint({ id: 'mimamori', icon: '🌙', name: '見守り', aid: 'erubin', unit: '%', v: [4, 8, 12, 16, 20],
    buff: [{ hit1: 0.04 }, { hit1: 0.08 }, { hit1: 0.12 }, { hit1: 0.16 }, { hit1: 0.2, noSulk: true }],
    text: '編成にいるだけで、大会の試合の最初の攻撃が当たりやすくなる(+{v}%)',
    text5: '編成にいるだけで、大会の試合の最初の攻撃が当たりやすくなり(+{v}%)、言うことを聞かない番も出ない' });

  const LIST = Object.freeze(L);
  const BY_ID = Object.freeze(Object.fromEntries(LIST.map(a => [a.id, a])));
  const TYPE_NAME = Object.freeze({ with: 'いっしょ', self: '自分', stay: 'いるだけ', battle: '試合' });
  const LV_MAX = 5;
  const MAX_KINDS = 4;          // 1体に4種類まで(芯の ASSIST_MAX)
  const POINTS_MIN = 20, POINTS_MAX = 400, POINTS_DIV = 50; // ポイント = 切り捨て(総合力 ÷ 50)・20〜400(芯の assistPointsOf)
  // 「おまかせ」: この順に段を1つずつ上げて埋める(ASSIST.md §5)。ひらめきの候補があれば先頭に足し、残りは表の順で埋める
  const AUTO_ORDER = Object.freeze(['sokoji', 'hitonatsu', 'kaketsuke', 'kizuna', 'hirameki']);

  const num = (v, d = 0) => (Number.isFinite(Number(v)) ? Number(v) : d);
  const lvOf = (lv) => Math.min(LV_MAX, Math.max(1, Math.round(num(lv, 1))));

  // 説明の1行(段つき)。例: describe('sokoji', 2) → 'この子がいっしょに訓練すると、伸びが10%上がる'
  const describe = (id, lv) => {
    const a = BY_ID[id]; if (!a) return '';
    const i = lvOf(lv) - 1;
    return ((i === LV_MAX - 1 && a.text5) || a.text).replace('{v}', String(a.v[i])).replace('{start}', a.start ? String(a.start[i]) : '');
  };
  const label = (id, lv) => { const a = BY_ID[id]; return a ? `${a.icon} ${a.name} 段${lvOf(lv)}` : ''; };
  const costOf = (id, lv) => { const a = BY_ID[id]; return a ? a.cost[lvOf(lv) - 1] : 0; };
  const valueOf = (id, lv) => { const a = BY_ID[id]; return a && lv >= 1 ? a.v[lvOf(lv) - 1] : 0; };

  // 候補(引退のとき並べる札)。hints は芯の s.hints(type:'assist' の name がひらめきの名前)
  const candidates = (hints) => {
    const names = new Set((Array.isArray(hints) ? hints : []).filter(h => h && h.type === 'assist').map(h => h.name));
    return LIST.filter(a => a.from === 'core' || names.has(a.name));
  };

  // 取ったものを確かめる(保存枠の子・借りた子。ASSIST.md §6 の読み込みと同じ): 知らない id を捨て・段は1〜5・4種類まで・値段の合計が pts を超えたら後ろから外す
  const normPicks = (list, pts) => {
    const cap = Math.min(POINTS_MAX, Math.max(0, num(pts)));
    const out = []; const seen = {}; let used = 0;
    for (const p of Array.isArray(list) ? list : []) {
      const id = p && typeof p === 'object' ? p.id : null;
      if (!BY_ID[id] || seen[id] || out.length >= MAX_KINDS) continue;
      const lv = lvOf(p.lv); const c = costOf(id, lv);
      if (used + c > cap) continue;
      out.push({ id, lv }); seen[id] = true; used += c;
    }
    return { picks: out, used, left: cap - used };
  };

  // おまかせ: ポイントの中で AUTO_ORDER(ひらめきの候補を先頭)の順に段を上げる
  const autoPick = (pts, hints) => {
    const cand = candidates(hints).map(a => a.id);
    const order = [...cand.filter(id => BY_ID[id].from === 'hint'), ...AUTO_ORDER.filter(id => cand.includes(id))];
    cand.forEach(id => { if (!order.includes(id)) order.push(id); }); // 残りのポイントは表の順で埋める
    const cap = Math.min(POINTS_MAX, Math.max(0, num(pts)));
    const lv = {};
    for (let changed = true; changed;) {
      changed = false;
      for (const id of order) {
        const now = lv[id] || 0; if (now >= LV_MAX) continue;
        if (!now && Object.keys(lv).length >= MAX_KINDS) continue;
        const used = Object.keys(lv).reduce((a, k) => a + costOf(k, lv[k]), 0);
        if (used - (now ? costOf(id, now) : 0) + costOf(id, now + 1) > cap) continue;
        lv[id] = now + 1; changed = true;
      }
    }
    return normPicks(order.filter(id => lv[id]).map(id => ({ id, lv: lv[id] })), cap);
  };

  // 試合で効く分(battle 型)を、対戦の芯の buffs.A の形にまとめる。team = 編成の子の assists の配列の配列([[{ id, lv }], …])
  //   extra(助手の特別な1話の battleMods など)を渡すと足し合わせる。範囲は芯と同じ(guts 0〜50・率 0〜0.5・missCut 0〜1)
  const BUFF_RANGE = Object.freeze({ guts: [0, 50], hit1: [0, 0.5], crit: [0, 0.5], missCut: [0, 1], eva: [0, 0.5] });
  const battleBuffs = (team, extra) => {
    const top = {};
    for (const list of Array.isArray(team) ? team : []) for (const p of Array.isArray(list) ? list : []) {
      const a = p && BY_ID[p.id]; if (!a || a.type !== 'battle') continue;
      top[a.id] = Math.max(top[a.id] || 0, lvOf(p.lv));
    }
    const out = {};
    const put = (b) => Object.keys(b || {}).forEach(k => {
      if (k === 'noSulk') { if (b[k] === true) out.noSulk = true; return; }
      const r = BUFF_RANGE[k]; const n = Number(b[k]); if (!r || !Number.isFinite(n)) return;
      const v = Math.min(r[1], Math.max(r[0], (out[k] || 0) + n));
      out[k] = k === 'guts' ? Math.round(v) : Math.round(v * 1000) / 1000;
    });
    Object.keys(top).forEach(id => put(BY_ID[id].buff[top[id] - 1]));
    if (extra && typeof extra === 'object') put(extra);
    return out;
  };

  // いるだけ型の効き目(芯が読む口): 編成でいちばん高い段の効き目(無ければ 0)。team は battleBuffs と同じ形
  const stayValue = (team, id) => {
    let best = 0;
    for (const list of Array.isArray(team) ? team : []) for (const p of Array.isArray(list) ? list : []) if (p && p.id === id) best = Math.max(best, lvOf(p.lv));
    return best ? valueOf(id, best) : 0;
  };

  const pointsOf = (power) => Math.min(POINTS_MAX, Math.max(POINTS_MIN, Math.floor(num(power) / POINTS_DIV)));

  const api = Object.freeze({ LIST, BY_ID, TYPE_NAME, SCENES, COST, LV_MAX, MAX_KINDS, POINTS_MIN, POINTS_MAX, AUTO_ORDER,
    describe, label, costOf, valueOf, candidates, normPicks, autoPick, pointsOf, battleBuffs, stayValue });
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.MONHERO_SUCCESS_ASSIST = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
