# バトル画面の描き直し削減(C)の途中経過(2026-11-11・ケイサン2)

結論: **案1は見送り、案2(popups を別部品へ)は「いまは止める」**(窓口の判断)。テゴタエの手ごたえの演出が公開されたあと、同じ測り方で数字を取り直し、まだ重ければ案2の設計を1枚書く。

## 測り方
`INIT_JS=tools/battle/render-count-hook.js SECONDS=60 node tools/battle/render-count-run.js`
(INIT_JS の対応は lib/tactics-battle-page.js に入れた)
- 数え方の注意: 旗(flags&1)は前の描画の分が残るので使わない。「alternate が前の commit の木にあり、props か state が変わった部品」だけを数える。
- 下の popups 内訳は、MonsterHeroGame の hook の state 差分で見た(popups は配列の末尾が `side` と `text` を持つもの)。

## 直す前の数字(main 0ee1d338・Chromium・タクティクスプロ・オート・CPU 絞りなし)
- 120秒(WAVE3→7)でアプリ全体の state 変更の描画 290回(約2.4回/秒)。うち popups が変わった 110回(38%)、popups だけ 54回(19%)
- 60秒で BattleScreen の描き直し 約133回
- 常駐の Assistant*/Rhythm*/Card* の8部品はアプリの描画のたびに再描画されるが、中身はすぐ null で軽い → メモ化は見送り

## 案2の見込み
popups を読む所は 71-screen-battle.jsx に10か所以上(敵の数字・味方の枠ごと・盤面の上・時計の useEffect)。効きは描画の約2割。

## 結論(2026-11-11 夜・ケイサン2): 案2「やらずに閉じる」で決定(窓口・ジン部長)

測り直し(main 440d3e07・タクティクスプロ・オート・60秒・CPU 絞りなし。`INIT_JS=tools/battle/render-count-hook.js SECONDS=60 node tools/battle/render-count-run.js`):
- アプリ全体の描画 155回(約2.6回/秒)/バトル画面 111回(約1.8回/秒)。前回(手ごたえの演出の公開前)は133回
- popups が変わった描画は全体の約38%(前回の内訳)。TrainingCountUp(結果画面の数字が増える動き)は60秒で868回だが、演出そのもので減らせない
- バトル画面1回は 1.1ms(CPU 1/4 で約5ms)。オート1ターンあたり 12〜15回(前の会話の実測。今回は TURN 表示の読み取りがずれて割り算できず)

やらない理由: 描画の回数は少なく1回も軽い。コマ落ちの本体は場面の入れ替わり(ブラウザ内部のスタイル・レイアウト・描画)で、popups を別部品に分ける案1(71 を10か所強・addPopup の行を探す検査が多数)では届かない。効きに対して壊しやすさが大きい。
再開するなら: コマ落ちが実機で問題になったとき、場面の入れ替わりで作り直される部品を `PROFILE=1` で先に調べる。
