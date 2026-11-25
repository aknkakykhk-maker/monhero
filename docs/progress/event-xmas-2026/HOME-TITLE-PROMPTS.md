# クリスマスのタイトル画像・ホーム画面 プロンプト集(チャッピー用)

台帳 r1119-172。社長「クリスマス用のホームとタイトルも作りたい。縦用、横用、タブレット用。ハロウィンのときとおなじやつ」(2026-11-25)。

## 決まったこと(社長 2026-11-25)

- **タイトル**: モンスター+雪の夜の広場(ハロウィンと同じくモンスターが主役・助手は入れない・ボスの影は入れない)
- **ホーム**: ふだんの広場と同じ配置のまま、雪の夜・イルミネーションに、さらにクリスマスの飾りを足す
- 枚数: タイトル3枚+ホーム3枚(縦・横・タブレット)

## ハロウィンのときの大きさ(手本)

| 物 | 縦 | 横 | タブレット |
| --- | --- | --- | --- |
| タイトル | `data/images/title-screen-halloween.jpg` 941×1672 | `title-screen-halloween-wide.jpg` 1672×941 | `title-screen-halloween-square.jpg` 1354×1162 |
| ホーム | `home-background-halloween.jpg` 853×1516 | `home-background-halloween-wide.jpg` 1671×941 | (ハロウィンは作らず、ふだんの `home-background-square.jpg` 1600×1600) |

切りそろえ・縮めはこちらでやる。チャッピーには 9:16 / 16:9 / 1:1 で頼む。

## 使い方

1. チャッピーの新しい会話に「タイトル」の文を送る。3枚できたら、別の新しい会話に「ホーム」の文を送る
2. できた絵は加工せずに `tools/art-sources/promo/xmas-2026/received/` へ置いてもらう

---

## タイトル(縦・横・タブレット)

```
スマホのカードバトルゲーム「モンスターヒーロー」の、クリスマスの期間だけ使うタイトル画面の絵を3枚作ってください。1枚できるごとに見せてください。私が「次へ」と言ったら次へ。

■手本(よく見て、同じ描き方・同じ密度・同じロゴの置き方にする)
- ハロウィンのタイトル(縦): https://github.com/aknkakykhk-maker/monhero/blob/main/monster-hero/data/images/title-screen-halloween.jpg
- ハロウィンのタイトル(横): https://github.com/aknkakykhk-maker/monhero/blob/main/monster-hero/data/images/title-screen-halloween-wide.jpg
- ハロウィンのタイトル(タブレット): https://github.com/aknkakykhk-maker/monhero/blob/main/monster-hero/data/images/title-screen-halloween-square.jpg
- ふだんのタイトル(ロゴの形・色): https://github.com/aknkakykhk-maker/monhero/blob/main/monster-hero/data/images/title-screen-clean.jpg
手本は「ハロウィンの飾りの夜」でしたが、今回はそれを「クリスマスの雪の夜」に置き換えます。描き方(厚塗りで明るく華やか・画面いっぱいに飾り・キャラは大きく)はそのまま。

■出すモンスター(参考の絵と同じ姿・同じ体の色。変えない)
- モッチー: https://github.com/aknkakykhk-maker/monhero/blob/main/monster-hero/images/monsters/mocchi.png
- ハム: https://github.com/aknkakykhk-maker/monhero/blob/main/monster-hero/images/monsters/ham.png
- スネグーラチカ: https://github.com/aknkakykhk-maker/monhero/blob/main/monster-hero/images/monsters/snegurochka.png
全員にクリスマスの小物を足す(赤いサンタ帽・マフラー・プレゼントの箱・ベルなど)。体の形と色は参考のまま。人間は描かない。

■場面
- 雪の降る夜の広場。奥に雪をかぶったお城と山、夜空に大きな月と星
- 真ん中奥に、電飾と星の飾りのついた大きなもみの木。根もとにプレゼントの山
- 手前にモンスター3体を大きく。楽しそうな決めポーズ(モッチーがプレゼントを抱える、ハムがベルを鳴らす、スネグーラチカが雪の結晶を舞わせる、など)
- 赤・緑・金の電飾、ろうそく、リース、キャンディケーン、柊、雪だるまを、手本のかぼちゃ・ランタンの代わりに画面いっぱいに
- 色: 夜空の紺と雪の白を土台に、赤・緑・金の暖かい光。怖い物・暗すぎる所は無し

■文字
- 入れるのはロゴ「MONSTER HERO」だけ。形と色はふだんのタイトルのロゴと同じにし、雪を少しかぶせ、柊を小さく添える
- ほかの文字・英語の飾り文字・日付は入れない

■1枚目: 縦(9:16)
- 手本の縦と同じ配置。ロゴは下の方(手本と同じ位置)、モンスターは真ん中。上と下の端の 8% には顔やロゴを置かない(切れてもよい余白)

■2枚目: 横(16:9)
- 手本の横と同じ配置。ロゴは左上、モンスターは真ん中から右。左右の端の 5% には顔やロゴを置かない

■3枚目: タブレット(1:1 で作る。あとで 7:6 に上下を切る)
- 手本のタブレットと同じ配置。ロゴは下の真ん中、モンスターは真ん中。上と下の端の 8% には顔やロゴを置かない

■絶対に守ること(1つでも外れたら作り直す)
- モッチー・ハム・スネグーラチカは参考の絵と同じ姿・同じ体の色(小物を足すだけ)
- 文字はロゴ「MONSTER HERO」だけ・つづりを正しく
- 3枚とも同じ場面・同じモンスター・同じ色合い(並べて同じシリーズに見える)
- 見せる前に「モンスターの姿が参考と同じか」「ロゴのつづり」「端に顔がかかっていないか」を自分で確かめて一言そえる

■GitHubへ置く(3枚ともできたら)
描き直さず・縮めず、PNG で、リポジトリ aknkakykhk-maker/monhero の main ブランチへ追加してコミットしてください。
置き場所: tools/art-sources/promo/xmas-2026/received/
- 縦 → title-screen-xmas.png
- 横 → title-screen-xmas-wide.png
- タブレット → title-screen-xmas-square.png
コミットメッセージ: 素材: クリスマスのタイトル画面(縦・横・タブレット)(チャッピーで作成・加工なし)
- この場所以外のファイルは、追加・変更・削除しない。同じ名前があれば上書きせず _v2 を付ける
- 終わったら、コミットのリンクと追加したファイルの一覧を見せる

■クロードへの引き継ぎ(最後に、そのままコピーできる文を1つ書く)
---
クロードへ。クリスマスのタイトル画面の絵(縦・横・タブレット)を置きました。
置き場所: tools/art-sources/promo/xmas-2026/received/
コミット: (コミットのリンク)
置いたファイル: (ファイル名の一覧)
お願い: ハロウィンと同じ大きさ(縦 941×1672・横 1672×941・タブレット 1354×1162)に整えて、タイトル画像アレンジに「クリスマス」として入れられるようにしてください。
---
```

## ホーム(縦・横・タブレット)

```
スマホのカードバトルゲーム「モンスターヒーロー」の、クリスマスの期間だけ使うホーム画面の背景を3枚作ってください。1枚できるごとに見せてください。私が「次へ」と言ったら次へ。

■いちばん大事なこと
ホーム画面は、この絵の上に施設のボタンが重なります。**建物・噴水・闘技場・お店・道の位置と大きさを、ふだんの絵と1つも変えないでください。** 変えてよいのは、季節(雪・夜)と飾りだけです。

■元にする絵(この配置のまま描き直す)
- 縦: https://github.com/aknkakykhk-maker/monhero/blob/main/monster-hero/data/images/home-background.jpg
- 横: https://github.com/aknkakykhk-maker/monhero/blob/main/monster-hero/data/images/home-background-wide.jpg
- タブレット: https://github.com/aknkakykhk-maker/monhero/blob/main/monster-hero/data/images/home-background-square.jpg

■手本(季節の変え方・密度・明るさ)
- ハロウィンのホーム(縦): https://github.com/aknkakykhk-maker/monhero/blob/main/monster-hero/data/images/home-background-halloween.jpg
- ハロウィンのホーム(横): https://github.com/aknkakykhk-maker/monhero/blob/main/monster-hero/data/images/home-background-halloween-wide.jpg
ハロウィンは「同じ配置のまま夜にして、かぼちゃとランタンで飾った」絵です。今回はそれを「雪の夜のクリスマス」にします。

■様子
- 雪の降る夜。屋根・木・道の端に雪が積もる。夜空に月と星、奥の山も雪化粧
- 建物の窓に暖かい灯り。屋根のふちと柵に赤・緑・金の電飾
- 噴水のまわりを電飾とリースで飾る(噴水の形と位置は変えない)
- 広場のすみ(建物・道にかからない所)に、星の飾りの大きなもみの木とプレゼントの山
- 闘技場の旗をクリスマスの色(赤と緑)に。お店の屋根の布も赤と白のしま
- 街灯にリースとリボン、道ばたに雪だるま・キャンディケーン・ろうそく・ソリ
- 色: 夜の紺と雪の白を土台に、赤・緑・金の暖かい光。ボタンの文字が読めるよう、真っ暗にしすぎない(手本のハロウィンと同じくらいの明るさ)

■絶対に守ること(1つでも外れたら作り直す)
- 建物・噴水・闘技場・お店・道・広場の模様の位置と大きさは、元の絵と同じ(重ねて比べてずれない)
- 人物・モンスター・文字は描かない
- 3枚とも同じ飾り・同じ色合い
- 見せる前に「元の絵と重ねて配置がずれていないか」を自分で確かめて一言そえる

■1枚目: 縦(9:16)・元の絵は縦
■2枚目: 横(16:9)・元の絵は横
■3枚目: タブレット(1:1)・元の絵はタブレット

■GitHubへ置く(3枚ともできたら)
描き直さず・縮めず、PNG で、リポジトリ aknkakykhk-maker/monhero の main ブランチへ追加してコミットしてください。
置き場所: tools/art-sources/promo/xmas-2026/received/
- 縦 → home-background-xmas.png
- 横 → home-background-xmas-wide.png
- タブレット → home-background-xmas-square.png
コミットメッセージ: 素材: クリスマスのホーム画面の背景(縦・横・タブレット)(チャッピーで作成・加工なし)
- この場所以外のファイルは、追加・変更・削除しない。同じ名前があれば上書きせず _v2 を付ける
- 終わったら、コミットのリンクと追加したファイルの一覧を見せる

■クロードへの引き継ぎ(最後に、そのままコピーできる文を1つ書く)
---
クロードへ。クリスマスのホーム画面の背景(縦・横・タブレット)を置きました。
置き場所: tools/art-sources/promo/xmas-2026/received/
コミット: (コミットのリンク)
置いたファイル: (ファイル名の一覧)
お願い: ふだんの絵と配置がずれていないか重ねて確かめ、ハロウィンと同じ大きさに整えて、ホーム画面アレンジに「クリスマス」として入れられるようにしてください。
---
```
