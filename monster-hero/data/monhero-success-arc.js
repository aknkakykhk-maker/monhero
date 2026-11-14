// モンヒロサクセスの「助手1人分のストーリー」の表(2026-11-13 開発部・設計 docs/progress/player-raise/STORY-ARC.md)
// 社長「モンサクをβ版で公開したいから助手1つ分のストーリーは1連で完成させて」。第1弾は みゅあ。
//
// ★次の助手を足すときは、この表に1つ足し、台本(docs/progress/player-raise/script/arc-<助手>.js)に文を足すだけ。
//   計算は芯(monhero-success.js)とランダムイベントの部品(monhero-success-events.js)がこの表を読んで動く。
// ★React・window・localStorage・Date・Math.random を使わない(芯と同じ)。数は EVENTS §3 の物差し(能力は「トレーニング1回ぶん」の倍数)。
//
// uniq   … 固有イベント(その助手だけの出来事・title は画面の見出し)。from〜to のターンのどこかで1回(毎ターン rate の率・to のターンで必ず)。
//          id が台本の場面 id(scn.<助手>.uq.<名前>)。ch の書き方はランダムイベント(monhero-success-events.js の頭)と同じ
// summit … ヒーローズファイナルの3戦で、助手が選ぶ相手。pop = 人気のいちばん高い常連 / rival = この育成で出会ったライバル(いなければ強い常連)/
//          champ = 王者 / reg = 常連(ふつう)。台本は scn.<助手>.summit.r<1〜3>.(pick|win|lose)
// title  … 超グッドエンディング(特別演出つき)の称号
(function (root) {
  'use strict';

  const M = 1;
  const ARC = Object.freeze({
    mua: Object.freeze({
      uniq: Object.freeze([
        // ジュニア期(6〜17ターン): 写真とろ！
        { id: 'scn.mua.uq.photo', title: '写真とろ！', from: 7, to: 12, rate: 0.35, ch: { a: { fx: [['pop', 3], ['bond', 'aid', 5]] }, b: { fx: [['st', 'eva', M]] } } },
        // ジュニア期の後半〜ミドル期の前半: おやつ作戦会議
        { id: 'scn.mua.uq.snack', title: 'おやつ作戦会議', from: 14, to: 21, rate: 0.35, ch: { a: { fx: [['hp', 20], ['str', -20]] }, b: { fx: [['buff', 'yaruki']] } } },
        // ミドル期(18〜29ターン): 夜の電話
        { id: 'scn.mua.uq.call', title: '夜の電話', from: 22, to: 28, rate: 0.35, ch: { a: { fx: [['bond', 'aid', 10], ['str', -10]] }, b: { fx: [['hp', 10], ['loy', 3]] } } },
        // プロ期(30〜41ターン): 応援うちわ作り
        { id: 'scn.mua.uq.uchiwa', title: '応援うちわ作り', from: 32, to: 40, rate: 0.35, ch: { a: { fx: [['pop', 6], ['bond', 'aid', 5]] }, b: { fx: [['st', 'main', M]] } } },
      ]),
      summit: Object.freeze(['pop', 'rival', 'champ']),
      title: 'みゅあの最高のチーム',
    }),
  });

  // エンディングのお祝い(全助手共通・社長の目安 2026-11-13)。1回ごとに全能力 +n
  const PARTY = Object.freeze({ bad: Object.freeze([5]), good: Object.freeze([10, 10, 10]), super: Object.freeze([15, 17, 20]) });

  const api = Object.freeze({ ARC, PARTY, VERSION: 1 });
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.MONHERO_SUCCESS_ARC = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
