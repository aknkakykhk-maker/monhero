# 引き継ぎメモ: 開発部 クラフトくん12(モンサクのホーム・マスモンボックス・詳細の技の欄)(2026-11-14)

次の会話は、CLAUDE.md → `docs/depts/dev.md` → `node tools/ctx.js decisions dev` → このメモ、の順に読んで始める。前の会話の中身は読みに行かない。

## マージ済み

- #6104 HOME の左の列を詰める・本オープン記念の札を2行(案B)
- #6109 モンサクのホームの作り直し(題字ロゴ・大きな「続きから」・3つの札)・忠誠と人気を上の帯へ・休む/遊ぶ/通院の変化と音・トレーニングのスライド・イベントの選択肢・`.msx button` の初期化を `:where` で最弱に
- #6141 マスモンボックスの作り直し(56-monhero-success-mm.jsx。入口・ボックス式の一覧・詳細は共通部品 `MsxMonDetail`・ハート `mh_monsuc_fav_v1`・並べ替えと表示 `mh_monsuc_box_view_v1`・100体・M/B管理から開く・「保存枠」の字は0件)

## 開いている物

- **#6224(枝 `dev/msx-detail-techgrid`)詳細の技の欄**: 遠・中・近・零の4列の升目、段は技のランク1〜5で固定(同じ間合い・同じランクに2つ以上ある段は行を増やす=案A)、ちから=金・かしこさ=緑、覚えていない技は升の地を暗く、覚え方に条件「修行で覚える(かしこさ150以上・前の技の熟練)」。止め絵は `docs/progress/player-raise/techgrid-2026-11-14/`(X4・X9・X10・M1D)。**社長の止め絵の OK 待ち**(案A/案B の答えも)。gate は「要らない」。マージ前に merge-main → run-checks を通す
- **#6116(枝 `dev/msx-beta-entry-text`・下書き)**: HOME の入口の札のリボン「β版 開幕！」と一言・更新履歴の上の帯(`pinTop:{ days:14 }`)・横画面の入口の位置。**β公開の日に窓口の合図で一緒にマージ。それまでマージしない**

## 覚えておくこと

- 名前のぶつかりに注意: `.fc`(顔アイコン36px)・`.hd`・`.lk`(`.msx .lk` は白黒・明るさ半分)などの短い名前はモンサク全体の CSS に既にある。新しい部品は `mmg-*`・`tg-*` のような固有の名前にする
- 撮影の道具: `tools/success/success-shoot.js`(`SHOT_ONLY`・`SHOT_QUICK`・`SHOT_PORT`・`SHOT_LOWBTN`)、`tools/success/success-r3-shoot.js`(X0〜X10 がマスモンボックス。`#x` は `[data-msx-x]` を押す)
- success-r3-shoot.js の大会(C2・W1・B2・R1・C3・C4*)と修行 Q3 の NG は main でも出る元からの物
- 確認の頼み先: ミハリ9 `session_0113GBaDKNufrPVAD8t4N46U`
