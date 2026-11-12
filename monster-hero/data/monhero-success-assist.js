// モンヒロサクセスのアシスト能力(モンサク専用の能力)の表(2026-11-12 開発部)
// 案: docs/progress/player-raise/ASSIST.md §1・§3・§5 / 一覧と決めたこと: docs/progress/player-raise/TITLES.md の後半
//
// ★画面なし・保存なし。いまは index.html から読まれず、誰にも見えない(取る画面は回3)。
// ★社長の方針「トレ効果アップ・集合率アップなど誰にでも効くものを優先」(血統・タイプの条件つきは第2弾)。
// ★効き目の数字と値段は芯(monhero-success.js の ASSISTS)と同じ。ここは画面に出す言葉(アイコン・説明)と並べ方を持つ。
//   食い違いは tools/success/monhero-success-tables-check.js が止める(芯を変えたら、ここも直す)。
//   参考(docs/reference/line-mf/assist-*.json)の数字は写さない。
//
//   id    … 芯の ASSISTS の id(保存枠の子の assists:[{ id, lv }] に入る)
//   type  … with(いっしょ型: その子が集まった訓練でだけ)/ self(その子自身の集まり方)/ stay(いるだけ型: 編成でいちばん高い段の1つだけ)
//           battle(試合型: 編成にいると、育てる子の大会の試合で効く。いるだけ型と同じく、編成でいちばん高い段の1つだけ)
//   v     … 段1〜3の効き目(単位は unit)/ cost … 段1〜3を取るのに要るポイント(段の合計)
//   text  … 説明の1行。{v} に段の数字が入る
//   from  … core(第1弾・いつでも取れる)/ hint(お話のひらめきで候補に出る。芯の訓練の計算には入らない・試合の buffs で効く)
//   buff  … type battle だけ: 段1〜3の対戦の芯の buffs(battleBuffs がまとめる)
(function (root) {
  'use strict';

  const fz = (o) => Object.freeze(o);
  const ASSIST_LIST = Object.freeze([
    // ---- 第1弾(条件なし・9種類・芯の ASSISTS と同じ数字) ----
    fz({ id: 'sokoji', icon: '🔥', name: '特訓の底力', type: 'with', unit: '%', v: [4, 7, 10], cost: [40, 80, 128], from: 'core',
      text: 'この子がいっしょに訓練すると、伸びが{v}%上がる' }),
    fz({ id: 'kaketsuke', icon: '📯', name: 'かけつけ', type: 'self', unit: '点', v: [8, 14, 20], cost: [32, 64, 104], from: 'core',
      text: 'この子が得意な訓練に来やすくなる(得意率 +{v}点・90%まで)' }),
    fz({ id: 'hirameki', icon: '✨', name: 'ひらめき', type: 'with', unit: '点', v: [3, 5, 8], cost: [32, 64, 104], from: 'core',
      text: 'この子がいっしょに訓練すると、大成功しやすくなる(+{v}点)' }),
    fz({ id: 'atooshi', icon: '🎯', name: '得意の後押し', type: 'with', unit: '%', v: [8, 14, 20], cost: [24, 48, 80], from: 'core',
      text: 'この子のいちばん高い能力の訓練に来ると、伸びがさらに{v}%上がる' }),
    fz({ id: 'kizuna', icon: '💞', name: '信頼のきずな', type: 'with', unit: '%', v: [6, 10, 14], cost: [40, 80, 128], from: 'core',
      text: 'この子がいっしょに訓練すると、忠誠度が高いほど伸びが上がる(忠誠100で +{v}%)' }),
    fz({ id: 'ochitsuki', icon: '🧘', name: '落ち着き', type: 'with', unit: '%', v: [15, 25, 35], cost: [24, 48, 80], from: 'core',
      text: 'この子がいっしょに訓練すると、失敗しにくくなる(失敗の率 −{v}%)' }),
    fz({ id: 'itawari', icon: '🩹', name: 'いたわり', type: 'with', unit: '%', v: [8, 14, 20], cost: [24, 48, 80], from: 'core',
      text: 'この子がいっしょに訓練すると、減る体力が{v}%少なくなる' }),
    fz({ id: 'shugyo', icon: '⚔', name: '修行の手ほどき', type: 'stay', unit: '%', v: [10, 18, 25], cost: [24, 48, 80], from: 'core',
      text: '編成にいるだけで、修行の伸びと熟練の上がりが{v}%上がる' }),
    fz({ id: 'hitonatsu', icon: '🤝', name: '人なつっこさ', type: 'stay', unit: '倍', v: [1.2, 1.4, 1.6], cost: [32, 64, 104], from: 'core', start: [5, 10, 15],
      text: '編成にいるだけで、みんなの親密度の上がりが{v}倍(この子のはじめの親密度も +{start})' }),

    // ---- お話のひらめき(社長 2026-11-12: 名前どおり「試合の中で効く」)。助手のお話をいい結末で見終えると、引退のときの候補に並ぶ ----
    //   型 battle = いるだけ型の試合版: この子が編成にいると、育てる子の大会の試合で効く(編成でいちばん高い段の1つだけ)。
    //   buff は対戦の芯 ASSISTANT_MASMON_BATTLE.simulate の buffs.A にそのまま入る形(#5722・docs/spec/ASSISTANT_MASMON_BATTLE.md)。
    //   どの試合にも効くので、助手の「特別な1話」(頂への道の1回戦だけ)より小さくした。値段は安い組(24/48/80)= ひらめきの割引ぶん
    fz({ id: 'gatsu', icon: '💪', name: '試合のはじめのガッツ', type: 'battle', unit: '', v: [3, 5, 8], cost: [24, 48, 80], from: 'hint', aid: 'atsu',
      buff: [{ guts: 3 }, { guts: 5 }, { guts: 8 }],
      text: '編成にいるだけで、大会の試合のはじめのガッツが +{v}' }),
    fz({ id: 'miseba', icon: '🎤', name: '見せ場', type: 'battle', unit: '%', v: [3, 5, 8], cost: [24, 48, 80], from: 'hint', aid: 'momosuke',
      buff: [{ crit: 0.03 }, { crit: 0.05 }, { crit: 0.08 }],
      text: '編成にいるだけで、大会の試合で会心が出やすくなる(+{v}%)' }),
    fz({ id: 'mitate', icon: '🔍', name: '見立て', type: 'battle', unit: '%', v: [3, 5, 8], cost: [24, 48, 80], from: 'hint', aid: 'kyuko',
      buff: [{ eva: 0.03 }, { eva: 0.05 }, { eva: 0.08 }],
      text: '編成にいるだけで、大会の試合で相手の攻撃をよけやすくなる(相手の命中 −{v}%)' }),
    fz({ id: 'kensho', icon: '📐', name: '検証', type: 'battle', unit: '%', v: [15, 25, 35], cost: [24, 48, 80], from: 'hint', aid: 'sorashido',
      buff: [{ missCut: 0.15 }, { missCut: 0.25 }, { missCut: 0.35 }],
      text: '編成にいるだけで、大会の試合で技が外れにくくなる(外れる率 −{v}%)' }),
    fz({ id: 'mimamori', icon: '🌙', name: '見守り', type: 'battle', unit: '%', v: [5, 10, 10], cost: [24, 48, 80], from: 'hint', aid: 'erubin',
      buff: [{ hit1: 0.05 }, { hit1: 0.10 }, { hit1: 0.10, noSulk: true }],
      text: '編成にいるだけで、大会の試合の最初の攻撃が当たりやすくなる(+{v}%)', text3: '編成にいるだけで、大会の試合の最初の攻撃が当たりやすくなり(+{v}%)、言うことを聞かない番も出ない' }),
  ]);
  const LIST = ASSIST_LIST;

  const BY_ID = Object.freeze(Object.fromEntries(LIST.map(a => [a.id, a])));
  const TYPE_NAME = Object.freeze({ with: 'いっしょ', self: '自分', stay: 'いるだけ', battle: '試合' });
  const MAX_KINDS = 4;          // 1体に4種類まで(芯の ASSIST_MAX)
  const POINTS_MIN = 20, POINTS_MAX = 400, POINTS_DIV = 50; // ポイント = 切り捨て(総合力 ÷ 50)・20〜400(芯の assistPointsOf)
  // 「おまかせ」: この順に段を1つずつ上げて埋める(ASSIST.md §5)。ひらめきの候補があれば先頭に足し、残りは表の順で埋める
  const AUTO_ORDER = Object.freeze(['sokoji', 'hitonatsu', 'kaketsuke', 'kizuna', 'hirameki']);

  const num = (v, d = 0) => (Number.isFinite(Number(v)) ? Number(v) : d);
  const lvOf = (lv) => Math.min(3, Math.max(1, Math.round(num(lv, 1))));

  // 説明の1行(段つき)。例: describe('sokoji', 2) → 'この子がいっしょに訓練すると、伸びが7%上がる'
  const describe = (id, lv) => {
    const a = BY_ID[id]; if (!a) return '';
    const i = lvOf(lv) - 1;
    return ((i === 2 && a.text3) || a.text).replace('{v}', String(a.v[i])).replace('{start}', a.start ? String(a.start[i]) : '');
  };
  const label = (id, lv) => { const a = BY_ID[id]; return a ? `${a.icon} ${a.name} 段${lvOf(lv)}` : ''; };
  const costOf = (id, lv) => { const a = BY_ID[id]; return a ? a.cost[lvOf(lv) - 1] : 0; };

  // 候補(引退のとき並べる札)。hints は芯の s.hints(type:'assist' の name がひらめきの名前)
  const candidates = (hints) => {
    const names = new Set((Array.isArray(hints) ? hints : []).filter(h => h && h.type === 'assist').map(h => h.name));
    return LIST.filter(a => a.from === 'core' || names.has(a.name));
  };

  // 取ったものを確かめる(保存枠の子・借りた子。ASSIST.md §6 の読み込みと同じ): 知らない id を捨て・段は1〜3・4種類まで・値段の合計が pts を超えたら後ろから外す
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
    cand.forEach(id => { if (!order.includes(id)) order.push(id); }); // 残りのポイントは安い能力で埋める
    const cap = Math.min(POINTS_MAX, Math.max(0, num(pts)));
    const lv = {};
    for (let changed = true; changed;) {
      changed = false;
      for (const id of order) {
        const now = lv[id] || 0; if (now >= 3) continue;
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

  const pointsOf = (power) => Math.min(POINTS_MAX, Math.max(POINTS_MIN, Math.floor(num(power) / POINTS_DIV)));

  const api = Object.freeze({ LIST, BY_ID, TYPE_NAME, MAX_KINDS, POINTS_MIN, POINTS_MAX, AUTO_ORDER, describe, label, costOf, candidates, normPicks, autoPick, pointsOf, battleBuffs });
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.MONHERO_SUCCESS_ASSIST = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
