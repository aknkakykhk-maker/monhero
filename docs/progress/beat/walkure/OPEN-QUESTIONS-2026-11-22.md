# ワルキューレ 公開前に社長へ聞くこと(2026-11-22 ビート)

済んだ工程: 両版のパイプライン --release(--from-authoring・step6 の直し入り)/ HELL --write(原曲 Lv.61・段変え16件、short Lv.49)/
原曲 HELL 99.22s の1ノーツ直し(notes[302] SLIDE の始点 lane 3→2.5。帯の中0・ほかの数は不変)/ レベル表・songClimax /
expert-master-order・新曲向け検査 / 更新履歴 / 助手の聞きどころ8行 / 譜面の控え2つの登録。

## ① 原曲 EXPERT の「帯の中」1件(142.41s)

- 形: TAP(grid 2050・subLane1 幅4)が HOLD(grid 2043〜2057・subLane2 幅5)と1.5レーン重なる。step6 の資料で「既知・未修正」だった分。
  新しい譜面は0にする検査(`rhythm-chart-hand-rules-check.js`)が止める
- TAP 1つの置き場所(全サブレーン×幅1〜5)では、帯の外かつ押せる(地上シミュ押せない0)所が無い
- 案: **HOLD を subLane2 幅5 → subLane4 幅3**(右端3.5はそのまま・左端を寄せて細く)。帯の中0・押せない0・Lv.36 のまま・忙しい341のまま
- 社長の決め(r1119-095)は HELL 99.22s の1ノーツだけなので、r1119-036 に従って直す前に聞く

## ② 原曲の長さ(11分32秒)

- 「遊ぶ長さは5分まで」(`rhythm-song-length-check.js`)に当たる。例外は社長が決めた曲だけ(いまは altar_world_tree の1曲・`LONG_PLAY_ALLOWED`)
- 台帳に、ワルキューレ原曲を最後まで遊ばせる決めは見つからなかった
- 案: (a) 例外に足す(最後まで遊ぶ。いまの譜面のまま) / (b) playEndMs で5分までにする(原曲の譜面を作り直し・HELL の公式測定もやり直し、約72分)

## 検査で残る NG(ワルキューレに関わらない)

changelog-order(main でも7か所の逆転)・rhythm-hell-level(seasons)・rhythm-chart-v3(seasons)・助手の顔・追跡表・索引・ブラウザの数本(試し聴き・曲えらびを開く・文の折り返し)
