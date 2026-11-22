# 歌い分け(ダブルボーカル)を譜面の手へ写した — Beyond the Same Sky(2026-11-22・ビート)

台帳 r1119-096 の追記(社長「ダブルボーカルの曲だから、そこんとこうまく読み取って気持ちよくやれるようにしてほしい」)。

## 経緯

1. 最初に、音源から伴奏を引いて声の高さだけで分けた(`tools/audio/vocal-split-pitch.py`・`vocal-split-phrases.py`)。
   声をきちんと取り出せず、確かな区間は76のうち5だけだった。結果は `beyond_the_same_sky-table.md`(古い試み・参考)
2. 社長が、歌い分けの札が付いた歌詞(Suno に入れた歌詞そのもの)をくれた → [`lyrics-parts.txt`](lyrics-parts.txt)。
   女声(Selected Voice)と男声(Secondary Voice)の2人。「Male Low Harmony Only」は女声が主旋律で、男声は低く重ねるだけ
3. 声の分離器(audio-separator・UVR-MDX-NET-Voc_FT。重みは GitHub のリリースから取れた)で声だけを抜き出し、
   声の主の埋め込み(resemblyzer)で0.5秒ごとに2人へ分けた(`tools/audio/vocal-split-speaker.py`)
4. 歌詞の札の並びを、声の主の並びと小節(BPM178・1小節1.348秒)に当てて、区間の表を作った(`tools/audio/vocal-parts-table.py`)。
   short ver. は、音の似かたで割り出した対応で写した(0〜107.8秒=原曲と同じ / 107.8〜134.0秒=原曲の+59.7秒 / 135.5秒〜=原曲の+103.6秒)

## 区間の表

[`parts-table.md`](parts-table.md)(JSON は `parts-table.json`)。原曲41区間・short 25区間。
確かさ(0.5秒ごとの声の主が歌詞の札と合う割合)は平均0.91。1か所だけ札と音が違った:
「たとえ時が二人を隔てても 私は君を忘れない」(187.2〜194.6秒)は札が男声だが、声は女声だったので女声にした。

## 譜面へ(これから)

最初は「声の側にないタップの横の位置だけを裏返す」写し方を試したが、社長の評価(#7187 の位置だけの手直しで HELL の手の流れが音楽から外れた)を受けて、
位置の手直しはやめた(譜面には入れていない)。HELL・MASTER(原曲・short)は、この表の区間(歌の拍・言葉の頭・歌い分け・サビの盛り上がり)に合わせて
組み直す。引き継ぎ: `docs/progress/handoff/` の beat の最新メモ。
