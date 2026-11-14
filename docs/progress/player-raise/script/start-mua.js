// モンヒロサクセス 台本: 育成の始まりの場面(みゅあ編)。2026-11-14 社長「始まったときに最初にシナリオ固有のイベントも流して」(案A・台本「このまま入れる」・r1114-100)
// 出す時: 育成を始めたとき、円盤石から生まれる演出のあと・1ターン目の前に毎回(2回目からは「とばす」で飛ばせる)。選択肢なし。
// ほかのシナリオは scn.<助手>.start.* の形で足せば、その助手の育成の始まりに流れる(56-monsuc-intro.jsx)。
// 形は README.md。みゅあの行は仲良し度 Lv1・2 のていねい語版(id の最後に b・bond:[1,2])つき。{mon} 育てるモンスター/{name} 呼び名
const MONSUC_SCRIPT_START_MUA = Object.freeze([
  { id:'scn.mua.start.narr1', who:'narr', t:'円盤石の光がおさまると、そこには生まれたばかりの{mon}がいた。' },
  { id:'scn.mua.start.mua1', who:'mua', e:'excited', t:'わっ、生まれた〜！ はじめまして、{mon}！ あたしは助手のみゅあだよ♪' },
  { id:'scn.mua.start.mua1b', who:'mua', e:'excited', bond:[1,2], t:'生まれました！ はじめまして、{mon}。助手のみゅあです' },
  { id:'scn.mua.start.narr2', who:'narr', t:'{mon}は、きょとんとした顔で、{name}とみゅあを順番に見上げた。' },
  { id:'scn.mua.start.mua2', who:'mua', e:'happy', t:'{name}、ここから46ターン、{mon}といっしょにがんばろうね！' },
  { id:'scn.mua.start.mua2b', who:'mua', e:'happy', bond:[1,2], t:'{name}、ここから46ターン、{mon}といっしょにがんばりましょうね' },
  { id:'scn.mua.start.mua3', who:'mua', e:'wink', t:'目指すは最後の大会『ヒーローズファイナル』！ まずはデビュー戦、勝ちにいこっ ٩(`･ω･´)و' },
  { id:'scn.mua.start.mua3b', who:'mua', e:'wink', bond:[1,2], t:'目指すのは、最後の大会『ヒーローズファイナル』です。まずはデビュー戦、勝ちにいきましょう！' },
]);

if (typeof module !== 'undefined') module.exports = { MONSUC_SCRIPT_START_MUA };
