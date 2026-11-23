# 曲選びの詳細の曲名・版の札を収める(r1119-142・2026-11-23 テンポくん)

社長「曲名のあとのてんてんがあるやつとないやつなんなの？てかできるだけちゃんとおさめてほしい」
(写真: `docs/progress/beat/bubble-overlap-2026-11-23/president-title-*.png`・`president-multilive.png`)

## 原因

- 曲名は字の幅の見積もりと CSS の line-clamp だけで切っていた。iPhone の Safari は、収まっている曲名(MF × ICHIKA MIX・全部必殺技でつ)にも「…」を付けていた
- 版のある曲は、横で版の札が曲名の横の幅を取り、曲名の幅が 20〜90px しかなかった(SIX ÉTERNEL が2行でも切れる)
- 版の札は 6.5rem の1行で「ドパガキリミッ…」と切れていた

## 直し方(`monster-hero/src/parts/29-rhythm-screens.jsx`)

- 曲名と版の札を、実際に描いた幅と高さで測って収める(`useRhythmFitText`)
  1. 1行のまま字を小さくする(曲名 横16〜10px・縦17〜10px / 版の札 11〜8px)
  2. 入らなければ行を足す(縦は2行ぶんの高さ43pxの中で3行まで・縦の低い画面は入らない曲名だけ2〜3行)
  3. それでも入らないときだけ「…」
- 版の札は、曲名の横に入らない時だけ次の行へ回す(曲名を最低 9rem 取る)
- マルチライブの曲選びも同じ部品なので一緒に直る
- 縦の低い画面の「曲名は1行・15px」の CSS(index.html)は部品の側へ移した

## 突き合わせ表

| 決めごと・頼み | 満たす所(止め絵) |
|---|---|
| r1119-142 収まっている曲名に「…」を付けない | `yoko-mf_ichika_mix.png`・`yoko-s-zenbu_hissatsuwaza.png`・`rot-zenbu_hissatsuwaza.png` |
| r1119-142 本当に長い曲名・版の札も、小さくする・行を足して収める | `yoko-six_eternel_beat.png`(題と副題を2行・版の札「ドパガキリミックス」が全部)・`tate-six_eternel_beat.png`・`yoko-s-six_eternel_beat.png` |
| r1119-142 全曲・縦横で確かめる | 検査 `tools/mode/rhythm-song-title-fit-check.js`: 62曲・112か所 × 8つの大きさ(縦 390・375・320、横 844・667・932、🔄横、PC)で「…」0件 |
| r1119-142 マルチライブの曲名 | `multi-rot-390.png`(マルチも同じ部品) |
| r1119-140 一言が決定に重ならない | 曲名が2行になって欄があふれても、#7379 の詰める仕組みが働く(`rhythm-song-notice-landscape-check` OK) |
| 画面の文は漢字 | 文言は足していない |

## まだのこと

- マルチライブの「この曲で決定が下に食い込んでる」: Chrome では🔄横 390 で決定の下に約8px の余白があり、写真と同じ位置。札を高くして iPhone をまねても収まった(`TALL=14 ONLY=rot-390 node tools/ui/rhythm-multi-select-fit-check.js`)。何を直すか(難易度と決定のあいだの空きを詰めるか、決定を端から離すか)を窓口に相談する
