# モンヒロサクセスのアイテム(id・名前・効果・絵)

社長(2026-11-12)「アイテムの絵はクロードで作ったやつでいい。作り込みたくなったらまた考える」。
15枚の絵は Claude が SVG で描いて PNG にした(外のAI画像は使っていない。参考の絵は見るだけで写していない)。

- 表の正本: `monster-hero/data/success-items.js`(`SUCCESS_ITEMS`。まだ index.html からは読まれない。画面は回2・回3)
- 絵: `monster-hero/images/success/items/<id>.png`(512×512・透明背景・1枚 8〜23KB)
- 元の SVG: `tools/art-sources/success/items/<id>.svg` / 作る道具: `node tools/success/item-icons.js`(SVG・PNG・一覧の絵をまとめて作り直す。`--check` でそろっているかだけ)
- 一覧の絵: [`items-sheet.png`](items-sheet.png)(1枚ごとに 160px と 64px を明るい地・暗い地で並べた。64px でも何の物か読めるのを確かめた)
- 名前と効果は参考のまま(博士だけイッサ博士)。出どころ: [`ITEMS-REF.md`](../ITEMS-REF.md)・TOURNAMENT.md §14・VIDEO-REF.md
- そろえ方: [`ITEM-ICON-PROMPTS.md`](ITEM-ICON-PROMPTS.md) の「共通の頭」(正方形・透明背景・やわらかいトゥーン調・光は左上・文字なし・余白1割)

## 対応表

| # | id | 名前 | 種類(kind) | 効果 |
| --- | --- | --- | --- | --- |
| 1 | `hourglass` | 時渡りの砂時計 | やり直し(大会に負けたとき)(`retry`) | 時を戻すとの言い伝えがある砂時計。バトルに敗北したときにやり直せる(同じ相手) |
| 2 | `hourglass-rainbow` | 虹の時渡りの砂時計 | やり直し(大会に負けたとき)(`retry`) | 時を戻すとの言い伝えがある虹の砂時計。敗北したとき相手を変えてやり直せる |
| 3 | `doctor-guidebook` | 博士の導き書 | 持ちこみ・始める前に効く(`start`) | イッサ博士の大事な書類。1度、イッサ博士が現れる |
| 4 | `doctor-loupe` | 博士のルーペ | 持ちこみ・育成中にも使える(`use`) | イッサ博士のお気に入りのルーペ。博士の実験が成功する |
| 5 | `meeting-misanga` | 出会いのミサンガ | 持ちこみ・始める前に効く(`start`) | 交流を増やすといわれているミサンガ。ようす「イベントメーカー」を付ける |
| 6 | `weekly-training` | 週刊!トレーニング | 持ちこみ・始める前に効く(`start`) | トレーニングのハウツー雑誌。ようす「トレーニング得意」を付ける |
| 7 | `training-hachimaki` | 修行のハチマキ | 持ちこみ・始める前に効く(`start`) | 頭に巻くと気合いが入るハチマキ。ようす「修行得意」を付ける |
| 8 | `bond-charm` | 縁結びのお守り | 持ちこみ・始める前に効く(`start`) | 良縁に恵まれるといわれているお守り。ようす「スターの素質○」を付ける |
| 9 | `momo-kibidango` | モモのキビダンゴ | 持ちこみ・始める前に効く(`start`) | 食べるとスタミナがつくキビダンゴ。体力の最大値が初めから上がる |
| 10 | `uketsugi-grass` | うけつぎ草 | 持ちこみ・始める前に効く(`start`) | 伝授でいい結果を残せると噂される草。ようす「うけつぐ魂」を付ける |
| 11 | `garoe-veggie-juice` | ガロエ印の野菜ジュース | 持ちこみ・育成中にも使える(`use`) | 持ち込むと育成中にも使用できる。体力を完全に回復する |
| 12 | `akusamasan` | 悪様散 | 持ちこみ・育成中にも使える(`use`) | 持ち込むと育成中にも使用できる。悪いようすを治して、体力を回復する |
| 13 | `breeder-license` | ブリーダーライセンス | 持ちこみ・育成中にも使える(`use`) | 持ち込むと育成中にも使用できる。忠誠度が一定数上がる |
| 14 | `oily-pack` | オイリーパック | 持ちこみ・育成中にも使える(`use`) | オイル2個と薬草の詰め合わせ。持ち込むと育成中にも使用できる |
| 15 | `training-ticket` | 修行チケット | 修行に使う(`ticket`) | 修行に使うチケット。大会などでもらえる |

## 種類と色(社長「始める前に効く物と育成中に使う物は色で分ける」)

一覧の絵の枠の色は仮のもの: やり直し=紫 / 始める前に効く=青 / 育成中にも使える=橙 / 修行チケット=灰。画面での色は回2・回3で決める。

## 画面に入れるとき(回2・回3)

- index.html に `data/success-items.js` を足し、絵は `SUCCESS_ITEMS[].image` から読む(`?v=` は stamp-version.js が付ける)
- 検査の参照元(`tools/image-asset-check.js` の sources)と stamp-version.js の IMAGE_HOST_FILES にはもう足してある
- 絵は事前ダウンロードの battle 組に入っている(起動時の読み込み core には入らない)

## 新しいアイテムを足す手順(社長「今後新しいアイテムを作るときも同じ見た目で」)

1. `monster-hero/data/success-items.js` の `SUCCESS_ITEMS` に1行足す(id は英小文字とハイフン・`image` は `images/success/items/<id>.png`)
2. `tools/success/item-icons.js` の `ART['<id>']` に絵を1つ足す。そろえ方は次の部品を使えば自然にそろう
   - ふちの線 `line`(こげ茶 #3d2618・太さ9)/ 細い線 `thin` / 足もとの影 `groundShadow()` / きらめき `sparkle()` / 星 `star5()` / 金 `GOLD`
   - 光は左上: グラデーションは左上を明るく、白い半透明の筋を左上側に1本
   - 中身は 512 の枠の 50〜460 に収める(余白1割)。文字・数字は入れない
3. `node tools/success/item-icons.js` を打つ(SVG・PNG・一覧の絵がまとめて作り直される。表と絵の数が合わないと止まる)
4. `items-sheet.png` を開いて、64px でも何の物か読めるか・ほかと並べて浮いていないかを見る
5. `node tools/build.js` → `node tools/image-asset-check.js` → `node tools/run-checks.js --changed`
