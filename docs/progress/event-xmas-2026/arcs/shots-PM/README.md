# みゅあの編「編みかけの夜」の止め絵と決めごとの突き合わせ(r1126-115)

撮り方: `node tools/novel/xmas-novel-shots.js docs/progress/event-xmas-2026/arcs/shots-PM --r1126-115pm`(真グッドを見た状態)

| 決めごと | どこで満たすか(止め絵) |
| --- | --- |
| r1126-115 追記2・追記5: 真グッドのあと、選択の無い場面(C2-2)に新しい選択が増え、そこから視点の編へ | **65-c22-pm は満たしていない**。真グッドを見た状態でも、APM0 が飛ばされて C2-3 の頭(2-3-1)が出る。土台の不具合(下)。台本の上では APM0 が C2-2 の最後に足され、条件 `end_G=1` も付いている(`79-xmas-novel-script.jsx` の `C2-2:APM0`) |
| ALLOCATION 7「マフラーは恋の贈り物にしない(みんなへの贈り物)」 | 66-knit の直前の PM-2-3・PM-2-4(みんなの分・名前はひとりずつ)/ 70-out-pm |
| CRAFT 5 怖さの溜めと外し | 66-knit(窓を叩く音 → 軒の氷だった)/ 68-blackout(部屋で鐘と停電・物音は「下のほう」までしか言わない) |
| 本編 3-4-5「鐘の時、あたし、もう部屋に戻ってた」に合わせる | 68-blackout(背景は みゅあの部屋) |
| CRAFT 3 ミスリードの手がかり(黒い毛糸)を裏側から回収 | 69-sleeve(台所でドラの目が袖に止まった → ホールで気づく。本編 2-2-5 の台所の時刻にそろえた) |
| 時刻つきの選択(r1126-115 追記1) | 67-apm1(23時すぎ。隠す/見せる。②は「もしも」) |
| CRAFT 6・ALLOCATION 6 もしものあとは外側で助手たち本人が閉じる / 呼び方の表 | 70-out-pm(みゅあねぇ・みゅあちん・〜でつ。`script-peer-calls-check.py` 0件) |

## 土台の不具合(窓口へ)

`xmasNovelSettle`(`monster-hero/src/parts/79-xmas-novel-engine.jsx`)は、行の条件を確かめるときに `xmasNovelCtx(script, c)` と見たエンドを渡さない。行そのものに `[end_G=1]` を付けた「選択を足す」の選択は、見たエンドがあっても常に飛ばされる。画面(`79-screen-xmas-novel.jsx`)も `xmasNovelSettle(S, cur)` と2つの引数で呼んでいる。ALLOCATION の #7〜#10(選択を足す)はみな同じ。`xmas-novel-ends-trace.js` の「視点の編 みゅあ」2本も END-G に着いて NG になる。
