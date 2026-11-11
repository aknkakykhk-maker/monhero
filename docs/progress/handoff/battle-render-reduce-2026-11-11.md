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
