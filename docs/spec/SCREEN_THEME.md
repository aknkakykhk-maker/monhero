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
| 2 | マーケットと神殿の飾りを足す(1回目で色は入った) | 未 |
| 3 | バトル(えらび〜バトル中〜リザルト)。`ready:false` を外した。えらび系・リザルトは共通の紫。バトル中は戦場の絵をそのままに `[data-battle-speed]::after` でコウモリと足もとの灯りを薄く重ねる(文字・カードの上に濃い色は置かない) | 済 |
| 4 | モンヒロビート(曲えらび・演奏)。`ready:false` を外す | 未 |

モンヒロビートは `SCREEN_THEME_CATEGORIES` で `ready:false`。外すまでは設定に並ばず、クラシックのまま。
外すときは、演奏中の見やすさ(ノーツ・判定表示)を実際に撮って確かめる。
