# HOME を開くと一瞬前の HOME が出る(台帳 r1126-103・追跡表 r1128-043・2026-11-28)

社長「ホームを開くと一瞬旧ホームが出てから新しいのにかわる」。

## 原因

新しい HOME の見た目の決まり(`HOME_V2_CSS`)とクリスマスの札の決まり(`XMAS_HOME_ENTRY_CSS`)を、各部品の `useEffect`(画面を描いた**あと**)で `<head>` に入れていた。
そのため HOME を開いた最初の1コマは、前の HOME の決まり(70-bootstrap.jsx)だけで描かれ、「四角い札8枚・左の丸いボタンの列・大きな告知の絵」の前の HOME そっくりに見えていた。
時刻の切り替え(`HOME_V2_FROM`)は関係ない(最初から新しい HOME の部品を描いている)。

- 描くたびの記録(直す前 `log-before-title-to-home.json`): HOME が出た時点で `v2css:false`、約0.2秒あとに `true`
- そのときの見え方: [`compare-first-frame.jpg`](compare-first-frame.jpg)(左が決まりの入る前の1コマ)

![最初の1コマ](compare-first-frame.jpg)

## 直し方

`69-screen-home.jsx` の `HomeScreen` を描くときに `homeEnsureCss()` で決まりを全部(HOME の札・新しい HOME・レイドのボス・クリスマスの札)先に入れる。同じ id があれば何もしない(各部品の useEffect も同じ id を見て入れない)。

- 直したあとの記録(`log-after-title-to-home.json`・`log-after-back-to-home.json`): HOME が出た最初の1コマから `v2css:true`。HOME を描いたあとで入る HOME まわりの決まりは無い

## 連写(撮り方: `SHOT_DIR=docs/progress/home-flash-r1126-103 node tools/browser/home-flash-burst.js`)

iPhone 縦 390×844・切り欠きの余白・進んだデータ(マスモン5体・裏クイック周回中・助手あり・クリスマスのレイドと花のイベントの後 12/1)。
画面の流し(CDP の screencast)を約70msごとに残し、描くたびの記録(HOME の形・背景・札・ボス・決まり)と合わせて見た。

- 直す前: [`burst-before-title-to-home.jpg`](burst-before-title-to-home.jpg)(決まりが入る前の約0.2秒は描き直しが重く、流しにコマが残らなかった。見え方は上の比べ絵)
- 直したあと: [`burst-after-title-to-home.jpg`](burst-after-title-to-home.jpg)・[`burst-after-back-to-home.jpg`](burst-after-back-to-home.jpg)(最初のコマから新しい HOME の形。入口の絵は読み込みで少し遅れて出る・レイドのボスは合計を読んでから出る。どちらも形は変わらない)

## 突き合わせ表

| 決めごと | 止め絵・記録のどこで満たすか | 満たす |
| --- | --- | --- |
| r1126-103 タイトル→HOME で前の HOME が出ない | `burst-after-title-to-home.jpg`・`log-after-title-to-home.json`(最初から v2css) | ○ |
| r1126-103 別の画面から HOME へ戻るときも | `burst-after-back-to-home.jpg`・`log-after-back-to-home.json` | ○ |
| CLAUDE.md ⑦ 保存データを変えない | 見た目の決まりを入れる時を早めただけ。保存のキー・書き込みなし | ○ |
