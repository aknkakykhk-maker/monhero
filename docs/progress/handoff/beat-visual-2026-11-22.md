# 引き継ぎメモ: ビート部 見た目の直し r1119-094(2026-11-22 テンポくん)

次の会話は CLAUDE.md → `docs/depts/beat.md` → `node tools/ctx.js decisions beat` → このメモ → `docs/progress/beat/visual-fix-2026-11-22/README.md` の順に読む。

## 出した PR(どちらも gate が「ミハリ確認が要る」(更新履歴を足した)。窓口の確認待ち・マージしていない)

| PR | 枝 | 中身 |
|---|---|---|
| #7183 | `beat/r1119-094-select-right` | 曲えらびの右側(社長の写真): 決定を下端に52px・ランダムを細く・BPM の帯を曲名の下へ・PC は全幅で縦に積む・横のアシスト/ミラーに名前(N1〜N5・N10・N13一部・N14 PC) |
| #7186 | `beat/r1119-094-select-tate` | #7183 の上に重ねた枝。縦の一言を1行・320幅の題・鍵の条件を10pxの1行・足りないビートP(N6〜N9・V14)。**#7183 を先にマージ** |

## 作りかけ(PR にしていない)

- 枝 `beat/r1119-094-multi-result-wip`(#7186 の上): マルチの結果の列をいる人数だけ・「チームのランク」・次へを主に(N41・N42・N44)。
  **止め絵が撮れていない**: `tools/ui/rhythm-multi-assist-result-check.js` / `rhythm-multi-play-guard-check.js` が main でもモード選びに入れず止まる。
  1つ目の原因は新しい「助手を選ぶ」画面(`mh_assistant_selected_v1` を種に足すと通り抜けるはずだが、足してもまだ同じ所で止まった・2回で打ち切り)。
  検査部に直してもらうか、撮れる道具ができたら撮って確かめてから PR にする

## 残りの指摘(点検 docs/progress/kensa/beat-api-2026-11/README.md の番号)

- 曲えらび: N11・N12・V7・V8・V12・V16(PC の列が600pxで細いのが元。N1 の残りの空き約170pxもここ)。マルチの横の決定36px(N15)
- マルチの結果: N43・N45〜N48(N41・N42・N44 は作りかけの枝)
- マルチの部屋と準備: N20〜N25・N34〜N37 / 縦横の切り替え: N58・N59・N61(社長が決める)・N62
- ソロの結果: N49〜N55(r1119-092 は main に入った。結果の画面はもう触ってよい)
- 呼ぶ窓・フリーマッチ: N16〜N18・N28〜N33 / 演奏中は社長が「直さない」(r1119-038 A)
- 中の残り(モード選び・オプション・窓・ランキング・交換所・ヘルプ)は点検の表のとおり

## 気をつけること

- 曲えらびの右の欄は container(`landscape:[container-type:size]`)で高さを測る。🔄横は端末が縦のままなので高さの @media を使わない
- index.html の詰める規則(ジャケット5.5rem・決定36px)は `[data-rhythm-multi]` だけに絞った。ソロに戻さない
- main でも落ちる検査: rhythm-landscape-layout(6件)・rhythm-multi-play-guard・rotation-height(モンサクの窓)・changelog-order(並びの逆転7か所)
- 撮影: `node tools/browser/visual-shoot.js --only beat-songs,beat-songs-rot --sizes tate,yoko,yoko-s,pc`(直す前は `SHOT_REV=origin/main`)
