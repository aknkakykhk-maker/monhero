// モンヒロサクセスの育成の記録帳(育て終えた子の記録)の形と読み書きの部品(2026-11-12 開発部)
// 案と画面の見本: docs/progress/player-raise/TITLES.md §3
//
// ★画面なし。いまは index.html から読まれず、誰にも見えない(画面は回3)。localStorage には触らない(画面が文字列を渡す)。
// ★保存キーは新しく足す 1つ: mh_monsuc_record_v1(CLAUDE.md ⑦。既存のキーは読まない・書かない)
//     { v:1, list:[ 記録 ], total }    list は新しい順・200件まで。total は今までに育て終えた数(200件を超えても数え続ける)
//   記録 = { id, species, nick, rank, power, sum, titles:[称号の id], aid, endAt, gen, best }
//     id      … 育成の id(保存枠の子と同じ。同じ id は2度入れない = 引退の画面を2度押しても1件)
//     rank    … 育成ランク(G〜M)/ power … 総合力 / sum … 6能力の合計
//     titles  … monhero-success-titles.js の finalize の結果(id。知らない文字はそのまま)
//     aid     … コーチの助手 / endAt … 引退した時刻(ミリ秒。画面が Date.now() を渡す)/ gen … 世代(合体の何代目か)
//     best    … その種でいちばん高い総合力だったとき true(書いたときに決める。あとで抜かれても書き換えない)
// ★保存枠(mh_monsuc_box_v1)から子が外れても(合体・手放す)、記録帳には残る。消すのは「200件を超えた古い分」だけ。
(function (root) {
  'use strict';

  const KEY = 'mh_monsuc_record_v1';
  const MAX = 200;
  const RANKS = ['G', 'F', 'E', 'D', 'C', 'B', 'A', 'S', 'SS', 'SSS', 'M'];
  const AIDS = ['mua', 'kiki', 'momosuke', 'dra', 'atsu', 'kyuko', 'sorashido', 'erubin'];
  const fin = (v, lo, hi, d = 0) => { const n = Number(v); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, Math.round(n))) : d; };
  const str = (v, n) => (typeof v === 'string' ? v.slice(0, n) : '');

  const normEntry = (e) => {
    if (!e || typeof e !== 'object') return null;
    const id = str(e.id, 64); if (!id) return null;
    return {
      id, species: str(e.species, 32), nick: str(e.nick, 24),
      rank: RANKS.includes(e.rank) ? e.rank : 'G', power: fin(e.power, 0, 99999), sum: fin(e.sum, 0, 99999),
      titles: Array.isArray(e.titles) ? e.titles.filter(t => typeof t === 'string' && t).map(t => t.slice(0, 64)).slice(0, 64) : [],
      aid: AIDS.includes(e.aid) ? e.aid : '', endAt: fin(e.endAt, 0, 9e15), gen: fin(e.gen, 1, 999, 1), best: e.best === true,
    };
  };

  // 読み込み: 無い・壊れている → 空の記録帳。知らない項目は捨てる
  const parse = (text) => {
    let raw = null;
    try { raw = typeof text === 'string' ? JSON.parse(text) : text; } catch (_) { raw = null; }
    const o = raw && typeof raw === 'object' ? raw : {};
    const seen = new Set(); const list = [];
    for (const e of Array.isArray(o.list) ? o.list : []) { const n = normEntry(e); if (n && !seen.has(n.id)) { seen.add(n.id); list.push(n); } if (list.length >= MAX) break; }
    return { v: 1, list, total: Math.max(fin(o.total, 0, 1e9), list.length) };
  };

  // 1件足す(新しい順の先頭へ)。同じ id がもうあれば何もしない(二重に数えない)
  const add = (book, entry) => {
    const b = parse(book); const e = normEntry(entry);
    if (!e || b.list.some(x => x.id === e.id)) return { book: b, added: false };
    const prev = b.list.filter(x => x.species === e.species).reduce((a, x) => Math.max(a, x.power), -1);
    e.best = e.power > prev;
    return { book: { v: 1, list: [e, ...b.list].slice(0, MAX), total: b.total + 1 }, added: true };
  };

  // 並べ替え・絞り込み(画面の上のボタン): order = new(新しい順)/ power(総合力の順)/ rank(ランクの順)・species で種を絞る
  const view = (book, opt) => {
    const b = parse(book); const o = opt && typeof opt === 'object' ? opt : {};
    let list = b.list.slice();
    if (o.species) list = list.filter(e => e.species === o.species);
    if (o.order === 'power') list.sort((a, c) => c.power - a.power || c.endAt - a.endAt);
    else if (o.order === 'rank') list.sort((a, c) => RANKS.indexOf(c.rank) - RANKS.indexOf(a.rank) || c.power - a.power);
    return list;
  };

  // 見出しのまとめ(育てた数・いちばん高いランク・称号の種類の数)
  const summary = (book) => {
    const b = parse(book);
    const top = b.list.reduce((a, e) => (RANKS.indexOf(e.rank) > RANKS.indexOf(a) ? e.rank : a), '');
    const titles = new Set(); b.list.forEach(e => e.titles.forEach(t => titles.add(t)));
    return { total: b.total, kept: b.list.length, topRank: top, titleKinds: titles.size };
  };

  const stringify = (book) => JSON.stringify(parse(book));

  const api = Object.freeze({ KEY, MAX, parse, add, view, summary, stringify, normEntry });
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.MONHERO_SUCCESS_RECORD = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
