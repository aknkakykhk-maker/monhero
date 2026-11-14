# 引き継ぎメモ: 開発部 クラフトくん12(モンサクのホーム・マスモンボックス・詳細の技の欄)(2026-11-14)

次の会話は、CLAUDE.md → `docs/depts/dev.md` → `node tools/ctx.js decisions dev` → このメモ、の順に読んで始める。前の会話の中身は読みに行かない。

## マージ済み

- #6104 HOME の左の列を詰める・本オープン記念の札を2行(案B)
- #6109 モンサクのホームの作り直し(題字ロゴ・大きな「続きから」・3つの札)・忠誠と人気を上の帯へ・休む/遊ぶ/通院の変化と音・トレーニングのスライド・イベントの選択肢・`.msx button` の初期化を `:where` で最弱に
- #6141 マスモンボックスの作り直し(56-monhero-success-mm.jsx。入口・ボックス式の一覧・詳細は共通部品 `MsxMonDetail`・ハート `mh_monsuc_fav_v1`・並べ替えと表示 `mh_monsuc_box_view_v1`・100体・M/B管理から開く・「保存枠」の字は0件)

## 開いている物

- **#6224(枝 `dev/msx-detail-techgrid`)詳細の技の欄**: 段は技のランク1〜5で必ず5つ・1升に1技。同じ間合い・同じランクに2つ以上ある升は**1つ目(技表の並び順)を出し、右上に⇄の印(`.tg-alt`)だけ**付けた(社長の決め r1114-128 の前半)。マージ済みにして区切る
- **#6116(枝 `dev/msx-beta-entry-text`・下書き)**: HOME の入口の札のリボン「β版 開幕！」と一言・更新履歴の上の帯(`pinTop:{ days:14 }`)・横画面の入口の位置。**β公開の日に窓口の合図で一緒にマージ。それまでマージしない**

## 覚えておくこと

- 名前のぶつかりに注意: `.fc`(顔アイコン36px)・`.hd`・`.lk`(`.msx .lk` は白黒・明るさ半分)などの短い名前はモンサク全体の CSS に既にある。新しい部品は `mmg-*`・`tg-*` のような固有の名前にする
- 撮影の道具: `tools/success/success-shoot.js`(`SHOT_ONLY`・`SHOT_QUICK`・`SHOT_PORT`・`SHOT_LOWBTN`)、`tools/success/success-r3-shoot.js`(X0〜X10 がマスモンボックス。`#x` は `[data-msx-x]` を押す)
- success-r3-shoot.js の大会(C2・W1・B2・R1・C3・C4*)と修行 Q3 の NG は main でも出る元からの物
- 確認の頼み先: ミハリ9 `session_0113GBaDKNufrPVAD8t4N46U`

## 次の会話でやること: 被った升の技を選ぶ仕組み(r1114-128 の後半)

社長の決め(台帳・追跡表 r1114-128):
- 升目は間合い×ランクで1升に1技。同じ間合い・同じランクに技が2つ以上ある所は、どれを覚えるかをプレイヤーが選ぶ
- 選べる所: 育成を始める前のベースモンの詳細・合体で生まれた子の詳細。育成中も**その技を覚えるまで**は変えられる(覚えたあとは変えられない)
- 選ばなかった技は、その升では覚えない(修行で覚える候補から外す)
- ⇄の升を押すと候補の技を並べて選ぶ。既定は今の並びの1つ目
- 選んだ結果は保存が要る → **新しいキー**か既存の値に項目を足す(CLAUDE.md ⑦)。`docs/spec/SAVE_DATA.md` に載せる。**gate は「要る」→ ミハリ9**

触る場所の手掛かり:
- 升目: `monster-hero/src/parts/56-monhero-success-start.jsx` の `MsxMonDetail` の中、`tgAt(r, d)`(ランク r・間合い d の技の並び)と `tgRanks.map(...)`。⇄は `alts.length > 1` のとき。`const i = 0` の所を「選んだ技の位置」に替える
- 修行で覚える候補: `monster-hero/data/monhero-success.js` の `learnable(s, course)`(`techsOf(s.species).filter(t => canLearn(s, t))`)と `canLearn`。ここで「選ばれなかった技」を外す。修行の画面は `56-monhero-success-r3-quest.jsx`(`SUC.learnable`)
- 保存の案(未決・ミハリ9と相談): ベースモン/合体の子はマスモンボックスの子の値(`mh_monsuc_box_v1` の1体)に項目 `techPick:{"ランク-間合い":技id}` を足す、育成中は育成の状態 s に同じ項目を足して始めるときに写す。既定(項目なし)は1つ目なので古いデータはそのまま読める
- 技表: `monster-hero/data/assistant-masmon-techs.js`(1技 = {id,name,kind,dist,power,hit,guts,crit,gd,rank,learn})。1つの技が `dist` に複数の間合いを持つことがあるので、「升」は(ランク・間合い)で数える

## スネグーラチカの X10 の食い違い(覚え方「はじめから」なのに「まだ覚えていない」)

撮影の道具の種まきが原因で、実データの不具合ではない見込み。
- `tools/success/success-r3-shoot.js` の種まきの子 bx0(スネグーラチカ)は `techs: []` で入れてある
- 詳細の `has(t)` は、`known`(その子の techs)が**配列なら** `known.includes(t.id)` で決まる → 空の配列なので全部「まだ覚えていない」
- 一方「覚え方」の行は技表の `learn.start` を見て「はじめから」と出す
- 実際に育てた子は、はじめからの技が techs に入っている(育成の始めに `learn.start` の技を入れる)ので食い違わないはず
- 直すなら: 種まきの techs に、その種族の `learn.start` の技を入れる。念のため `has()` で `learn.start` の技は常に覚えている扱いにしてもよい(社長に聞いてから)
