# 引き継ぎメモ: ビート部 見た目の直し r1119-094(2026-11-22 テンポくん)

次の会話は CLAUDE.md → `docs/depts/beat.md` → `node tools/ctx.js decisions beat` → このメモ → `docs/progress/beat/visual-fix-2026-11-22/README.md` の順に読む。

## 出した PR(どちらも gate が「ミハリ確認が要る」。窓口がミハリに回した。OK ならミハリがマージする。待たずに次へ進む)

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

## 次の会話でやること(窓口 11/22 の指示)

1. 点検の高・中の次の画面へ進む。おすすめ順: マルチの部屋と準備(N20〜N25・N34〜N37) → 縦横の切り替え(N58・N59・N62) → ソロの結果(N49〜N55。#7178 が main に入ったので触ってよい) → 呼ぶ窓・フリーマッチ → 中の残り
2. 公開の前に main の撮り比べの道具(#7190・切り欠きあり)を使う: `tools/browser/visual-compare-check.js`(使い方は頭のコメント)。曲えらびは `SHOT_NOTCH=1 node tools/browser/visual-shoot.js …` でも撮れる(#7183 で足した)
3. 止め絵は縦 390×844・横 844×390・PC・切り欠きありで撮り、`docs/progress/beat/visual-fix-2026-11-22/` に直す前と並べて、番号の表を README に足す
4. 作りかけの枝は、マルチを撮れる道具が直ったら撮って PR にする(#7186 の上に重ねてある。#7183・#7186 が main に入ったら main を取り込む)

## 気をつけること

- 曲えらびの右の欄は container(`landscape:[container-type:size]`)で高さを測る。🔄横は端末が縦のままなので高さの @media を使わない
- index.html の詰める規則(ジャケット5.5rem・決定36px)は `[data-rhythm-multi]` だけに絞った。ソロに戻さない
- main でも落ちる検査: rhythm-landscape-layout(6件)・rhythm-multi-play-guard・rotation-height(モンサクの窓)・changelog-order(並びの逆転7か所)
- 撮影: `node tools/browser/visual-shoot.js --only beat-songs,beat-songs-rot --sizes tate,yoko,yoko-s,pc`(直す前は `SHOT_REV=origin/main`)


---

## 追記 2026-11-22 夜(テンポくん・2つ目の会話)

### 出した PR(どちらも gate「要る」→ 窓口からミハリへ。ミハリがマージ)

| PR | 枝 | 中身 |
|---|---|---|
| #7199 | `beat/r1119-094-multi-result-wip` | マルチの結果 N41・N42・N44 + 検査の入口の直し |
| #7203 | `beat/r1119-094-multi-room`(#7199 の上) | マルチの部屋と準備 N20・N21・N23・N24・N25・N34・N35・N36。**#7199 を先に** |

止め絵: `docs/progress/beat/visual-fix-2026-11-22/multi-result/`・`multi-room/`(README の 3.・4.)

### 分かったこと
- マルチの検査が main で止まっていた原因は、遅れて開く更新履歴の窓と、HOME の上の「🎉 モンヒロビート 本オープン記念」の札の押し間違い。4本直した(assist-result・play-guard・wait-bottom・beat-presence)。**rhythm-multi-layout・rhythm-multi-spectate・home-screen-guide・rhythm-landscape-layout も同じ入口で止まっている見込み**(直していない)
- マルチの部屋・準備・結果は `MULTI_FEW=1 SHOT_DIR=<フォルダ> node tools/ui/rhythm-multi-assist-result-check.js` で撮れる(room-・select-・ready-・result- × 縦・横・🔄横・320×568)
- run-checks --changed はこの枝で約30分かかる。ヘルプ・更新履歴を直したら **build し直してから** 回す(忘れて cache-key・build --check が落ちた)

### 残り(次の1手から)
1. ソロの結果: **N50・N51・N53 は結果画面の並べ方を選ぶ作り替え → 案を2〜3つ止め絵にして docs/progress/ に入れ窓口へ**(まだ作っていない)。N52(ランクアップの「次へ」・位の名前)は `43-player-rank-ui.jsx` でビート部の外 → 窓口に持ち主を聞く。N49 は r1119-092 で直っているか確かめる。N54・N55 は点検で「後で」
2. マルチ: N22(PC の札が柱)・N15(横の決定36px)・N43・N45〜N48(結果の札・空き・数え上げ・吹き出し)。N37(ポーズ)は演奏中なので触らない
3. 縦横の切り替え N58・N59・N62(N61 は社長が決める)
4. 呼ぶ窓・フリーマッチ N16〜N18・N28〜N33 → 中の残り(点検の表のとおり)
5. 曲えらび: N11・N12・V7・V8・V12・V16(PC の列 600px)
