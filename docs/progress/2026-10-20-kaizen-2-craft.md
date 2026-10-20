# 改善部の見直し・その2(kaizen-2)の開発部の進み具合(2026-10-20〜)

依頼: 窓口(社長が決めた分)。本文は `docs/playbot/reports/2026-10-20/kaizen-2.md`。M2・M4 はバトル部、HELL はビート部。

| # | 中身 | 状態 |
| --- | --- | --- |
| M1 | デバッグ設定の入口に合言葉(塩+PBKDF2・`mh_debug_unlocked_v1`) | 済み(#3209) |
| M3 | 言葉の途中の折り返し(アシストカードの継承・強化の題名と説明、結果の「刻み」の説明・MAX COMBO) | 済み(作業中のPR) |
| M5 | マルチの部屋(320 で「ルームを出る」が切れる・390 で枠の下に空き) | 済み(作業中のPR) |
| M6 | 結果のランクの横に、その難易度での出来(満点の◯%)を小さく足す | 済み(作業中のPR) |
| M7 | HOME(320)でみゅあの吹き出しが「M/B管理」の札を隠す → 320 で2行まで・home-layout-check に 320 | 済み(作業中のPR) |
| M8 | 結果(320)で下の帯が表に重なる → 表を詰め、帯の上に「▼ ビートP・ライブログ」 | 済み(作業中のPR) |
| M9 | 曲えらび(320)で「並べ替え：」を外して値だけ | 済み(作業中のPR) |
| M10 | ギフト(320)でカボチャの飾りが字に重なる → 札の地を同じ色の不透明な色にした | 済み(作業中のPR) |

## 調べてわかったこと

- M3: `Intl.Segmenter('ja',{granularity:'word'})` で言葉の切れ目に U+200B を入れ、`word-break:keep-all` で切れ目だけで折る部品にする。
  直す場所は `67-screen-pick.jsx`(継承・強化の題名 844行・説明 845行・カードの説明 `shownDesc`)と `30-rhythm-play.jsx`(`data-rhythm-result-ticks`・MAX COMBO)
- M9: `29-rhythm-screens.jsx` の `data-rhythm-song-sort` / `data-rhythm-genre-open` の `<small>` に `max-[359px]:hidden`
- M10: カボチャは `index.html` の `[data-mh-theme="halloween"] .mh-screen-shell` の背景の絵。ギフトの札(`.mh-gift-card`)の地が半透明なので透ける
- M6: `30-rhythm-play.jsx` の `data-rhythm-difficulty-name` の行。満点は `difficulty.maxScore`
- 結果の画面・マルチの部屋は、`tools/playbot/lib/session.js` の `openSession`(にせの Supabase)と `scenarios/rhythm.js`・`multi.js` で開ける(改善部の撮り方)

## 検査

- `tools/boot/ja-wrap-check.js`: 主な画面(幅320/390)の短い字が言葉の途中で折れていないか
- `tools/boot/kaizen2-layout-check.js`: M3・M5〜M10 の作りが戻っていないか
- `tools/home-layout-check.js`: 本物の画面で 320×568 と 390×844 を測る部分を足した(M7)
- 画面写し: `docs/playbot/reports/2026-10-20/kaizen-2-fix/`
