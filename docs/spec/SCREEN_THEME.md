# 画面テーマ(ハロウィン / クラシック)

2026-09-30 ユーザー要望「他画面もハロウィン仕様に変更したい」「設定でいじれるように」。
回答: 範囲は**バトル・演奏中も含めて全部**／作り方は**色と小さな飾り**(画像なし)／設定は**画面の種類ごと**／
**11月になったら自動でクラシック**(自分で選んだ人はそのまま)。

## 仕組み

| もの | 置き場所 |
| --- | --- |
| 画面の種類・期間・おまかせの解決 | `src/parts/13-bgm-and-rhythm-settings.jsx` の `SCREEN_THEME_*` / `resolveScreenTheme` / `screenThemeCategory` / `screenThemeFor` |
| 保存 | 新しいキー `mh_screen_theme_v1` = `{ menu, market, temple, battle, rhythm }`(各 `auto`/`halloween`/`classic`)。タイトル・ホームは既存の `mh_title_art` / `mh_home_art`(`auto` も入る) |
| 画面への反映 | 一番外の箱 `.mh-app` に `data-mh-theme="halloween|classic"`(いまの gameState の種類で決まる) |
| 共通の色・夜空・飾り | `index.html` の `[data-mh-theme="halloween"]`(`--mh-*` の差し替え・`.mh-screen-shell` の背景・`.mh-title-dialog`・`--mh-bubble-bg`) |
| Tailwind の紺色の置き換え | `tools/theme/halloween-theme-css.js`。`tools/build-tailwind.js` が tailwind.css の末尾へ足す(slate/gray/zinc と暗い indigo/blue を同じ明るさの紫へ) |
| 設定 | `51-screen-settings.jsx` の `ScreenThemeModal`(タイトル画面の設定とHOMEの設定の両方から) |

- `auto` は**見るたびに**今の時刻で決める(`SCREEN_THEME_HALLOWEEN_UNTIL` = 2026-11-01 00:00 JST)。index.html のタイトル画像の先読みも同じ時刻を持っている
- 来年また使うときは `SCREEN_THEME_HALLOWEEN_UNTIL` を期間ごとの表にする

## 進み具合

| 回 | 中身 | 状態 |
| --- | --- | --- |
| 1 | 土台・設定・メニュー画面・マーケット・神殿(色と飾り) | 済 |
| 2 | マーケットと神殿の飾り。`.mh-app` に敷いた夜空・月・コウモリ・かぼちゃがそのまま出るので専用の飾りは足さない | 済 |
| 3 | バトル(えらび〜バトル中〜リザルト)。`ready:false` を外した。えらび系・リザルトは共通の紫。バトル中は色の置き換えだけで、全面の重ねは置かない(置くと iPhone で重くなり、画面の軽さが自動で下がって敵の待機の動きが止まった。下の注意を参照) | 済 |
| 4 | モンヒロビート(曲えらび・演奏)。`ready:false` を外した。シアンだけオレンジへ寄せる(`RHYTHM_MAP`・`data-mh-theme-category=rhythm` のときだけ)。演奏中のノーツ・判定は class ではなく個別の色なので変えていない | 済 |

全部の種類が出せる状態になった。

## オレンジの強め方(2026-09-30)

- 明るい indigo(200〜700)を、ハロウィンのときだけかぼちゃ色のオレンジへ置き換える(`tools/theme/halloween-theme-css.js` の `PUMPKIN`)。白い文字を載せる500〜700は深いオレンジ。モードごとの色(`style` の色)は意味を持つので置き換えない
- `.mh-app` 自身にも夜空・コウモリ・かぼちゃを敷き、`.mh-screen-shell` を使わないバトル系の画面にも透けて見えるようにした
- `build-tailwind.js` の指紋に `halloween-theme-css.js` を入れた(これが無いと、色の規則を直しても tailwind.css が作り直されない)

## 注意: バトル中に全面の重ねを置かない(2026-09-30)

- 敵の待機の動きは `data-tactics-look="rich"` のときだけ動く。端末が重いと、見張りが画面の軽さを自動で下げ(`calm` になる)、敵の待機の動きが止まる。設定の表示は「動かす」のまま
- 一度、バトル中の戦場の上へ `[data-battle-speed]::after` で全面の飾りを重ねたところ、iPhone でこれが起きた。**バトル中の画面には、全面の飾り・背景の重ね・`isolation` を足さない**

## ホーム画面のクリスマス(2026-11-25・r1125-059)

- `HOME_ART_OPTIONS` の先頭に `xmas`(縦 853×1516 / 横 1671×941 / 正方形 1254×1254 の JPEG・ハロウィンと同じ重さ)。素材は `tools/art-sources/promo/xmas-2026/received/` の `_v2` の3枚(改訂版)
- 出す期間はクリスマスのイベントと同じ(`RAID_XMAS_START_AT` 〜 `RAID_XMAS_EVENT.endAt` = 11/30 10:00 〜 12/31 4:00)。見るたびに時刻で決める(保存しない)
  - 開始前は選択肢に出さない(`homeArtOptionsAt`)。アレンジの窓と画面テーマの窓(ホームの行だけ「クリスマス」の札が増える)の両方
  - おまかせは期間中だけクリスマス、そのあとはクラシック(`resolveHomeArt`)。自分で選んだ人は期間のあとも選んだまま
  - 保存キー `mh_home_art` に値 `'xmas'` が入るだけ。知らない値は `'auto'` に戻る読み方はそのまま。開始前に `'xmas'` が入っていても(時計を戻した等)おまかせと同じに決める
- タイトル画像のクリスマスは別の仕事(絵が来てから)
