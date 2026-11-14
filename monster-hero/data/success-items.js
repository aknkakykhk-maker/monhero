// モンヒロサクセスのアイテムの表(id・名前・効果・絵)(2026-11-12 クラフトくん)
// 名前と効果は参考のものをそのまま(社長 2026-11-12・博士だけイッサ博士)。出どころ:
//   docs/progress/player-raise/ITEMS-REF.md(持ちこみ12種)/ TOURNAMENT.md §14(砂時計2種)/ VIDEO-REF.md(修行チケット)
// 一覧と説明: docs/progress/player-raise/art/ITEMS.md。絵は tools/success/item-icons.js が作る(元の SVG は tools/art-sources/success/items/)。
//
// ★いまは index.html から読まれず、誰にも見えない(画面は回2・回3)。保存キーも持たない。
// ★kind: retry = 大会に負けたときのやり直し / start = 始める前に効く(持ちこみ) / use = 育成中にも使える(持ちこみ) / ticket = 修行に使う
//   社長「始める前に効く物と育成中に使う物は色で分ける」→ 画面は kind で色を分ける。
(function (root) {
  'use strict';
  const SUCCESS_ITEMS = Object.freeze([
    { id: 'hourglass', name: '時渡りの砂時計', kind: 'retry', image: 'images/success/items/hourglass.png?v=2a350de4978b',
      text: '時を戻すとの言い伝えがある砂時計。バトルに敗北したときにやり直せる(同じ相手)' },
    { id: 'hourglass-rainbow', name: '虹の時渡りの砂時計', kind: 'retry', image: 'images/success/items/hourglass-rainbow.png?v=ac995b7c637a',
      text: '時を戻すとの言い伝えがある虹の砂時計。敗北したとき相手を変えてやり直せる' },
    { id: 'doctor-guidebook', name: '博士の導き書', kind: 'start', image: 'images/success/items/doctor-guidebook.png?v=a7879c53caec',
      text: 'イッサ博士の大事な書類。1度、イッサ博士が現れる' },
    { id: 'doctor-loupe', name: '博士のルーペ', kind: 'use', image: 'images/success/items/doctor-loupe.png?v=a9734c314027',
      text: 'イッサ博士のお気に入りのルーペ。博士の実験が成功する' },
    { id: 'meeting-misanga', name: '出会いのミサンガ', kind: 'start', image: 'images/success/items/meeting-misanga.png?v=13a234e54263',
      text: '交流を増やすといわれているミサンガ。ようす「イベントメーカー」を付ける' },
    { id: 'weekly-training', name: '週刊!トレーニング', kind: 'start', image: 'images/success/items/weekly-training.png?v=29cd2c1dda64',
      text: 'トレーニングのハウツー雑誌。ようす「トレーニング得意」を付ける' },
    { id: 'training-hachimaki', name: '修行のハチマキ', kind: 'start', image: 'images/success/items/training-hachimaki.png?v=3a80bf6d6b5f',
      text: '頭に巻くと気合いが入るハチマキ。ようす「修行得意」を付ける' },
    { id: 'bond-charm', name: '縁結びのお守り', kind: 'start', image: 'images/success/items/bond-charm.png?v=58236c39080e',
      text: '良縁に恵まれるといわれているお守り。ようす「スターの素質○」を付ける' },
    { id: 'momo-kibidango', name: 'モモのキビダンゴ', kind: 'start', image: 'images/success/items/momo-kibidango.png?v=9c549951ba92',
      text: '食べるとスタミナがつくキビダンゴ。体力の最大値が初めから上がる' },
    { id: 'uketsugi-grass', name: '受け継ぎ草', kind: 'start', image: 'images/success/items/uketsugi-grass.png?v=480c71c413b8',
      text: '伝授でいい結果を残せると噂される草。ようす「うけつぐ魂」を付ける' },
    { id: 'garoe-veggie-juice', name: 'ガロエ印の野菜ジュース', kind: 'use', image: 'images/success/items/garoe-veggie-juice.png?v=f0efa63e419b',
      text: '持ち込むと育成中にも使用できる。体力を完全に回復する' },
    { id: 'akusamasan', name: '悪様散', kind: 'use', image: 'images/success/items/akusamasan.png?v=77e0c02076ef',
      text: '持ち込むと育成中にも使用できる。悪いようすを治して、体力を回復する' },
    { id: 'breeder-license', name: 'ブリーダーライセンス', kind: 'use', image: 'images/success/items/breeder-license.png?v=f8010ded1ace',
      text: '持ち込むと育成中にも使用できる。忠誠度が一定数上がる' },
    { id: 'oily-pack', name: 'オイリーパック', kind: 'use', image: 'images/success/items/oily-pack.png?v=2b1a9c15a29b',
      text: 'オイリーオイル（大）2個と夏美草1個のセット。持ち込むと育成中にも使用できる' },
    { id: 'training-ticket', name: '修行チケット', kind: 'ticket', image: 'images/success/items/training-ticket.png?v=0fc3257c41b8',
      text: '修行に使うチケット。大会などでもらえる' },
  ].map(Object.freeze));
  const api = { SUCCESS_ITEMS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.SUCCESS_ITEMS = SUCCESS_ITEMS;
})(typeof window !== 'undefined' ? window : globalThis);
