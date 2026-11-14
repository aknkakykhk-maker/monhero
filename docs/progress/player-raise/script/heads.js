// モンヒロサクセス 台本: 出来事の見出しの分け方(VIDEO-REF.md 参考動画2「イベントの見出しを3種類に分ける」)
// 場面のidの頭で、画面の上に出す見出しを決める。どの出来事の行も、ちょうど1つに当たる(tools/success/success-script-check.js が見張る)。
//   train … 育成イベント(助手と育てているモンスター。ふだんの出来事・季節・体調・大会まわり・ライバル・イッサ博士)
//   cheer … 編成の子のイベント(編成の子との連続3話・くじ・すき間の編成の出来事)
//   main  … メインのお話(シナリオの助手の4話+特別な1話・シナリオの大会。称号や能力ポイントにつながる)
//   none  … 出来事ではない(ターンごとのことば・モンスターの声。見出しを出さない)
const MONSUC_SCRIPT_HEADS = Object.freeze([
  { prefix:'scn.', head:'main', label:'メインのお話' },
  { prefix:'cheer.', head:'cheer', label:'編成の子のイベント' },
  { prefix:'ev.team.', head:'cheer', label:'編成の子のイベント' },
  { prefix:'ev.', head:'train', label:'育成イベント' },
  { prefix:'issa.', head:'train', label:'育成イベント' },
  { prefix:'turn.', head:'none', label:'' },
  { prefix:'mon.', head:'none', label:'' },
  { prefix:'item.', head:'none', label:'' },
  { prefix:'tut.', head:'none', label:'' }, // β版のチュートリアル(みゅあの説明。出来事ではない)
]);

// 行の id から見出しを引く(上から順に、最初に当たったもの)
function monsucScriptHeadOf(id) {
  const hit = MONSUC_SCRIPT_HEADS.find(h => String(id).startsWith(h.prefix));
  return hit ? hit.head : null;
}

if (typeof module !== 'undefined') module.exports = { MONSUC_SCRIPT_HEADS, monsucScriptHeadOf };
