# 引き継ぎメモ: ビート部・Beyond the Same Sky の歌い分けの組み直し(2026-11-22 夜)

前の会話は読みに行かない。CLAUDE.md → docs/depts/beat.md → tools/mode/CLAUDE.md → このメモ。

## いまの状態
- PR #7232(枝 beat/r1119-105-sky-vocal-rebuild)。**社長が比べ絵を見て OK するまでマージしない**。gate はミハリ確認「要る」
- 比べ絵と区間ごとの作り方: docs/progress/beat/chart-fix-2026-11-22/rebuild/README.md
- 表示 Lv. が変わる: 原曲 MASTER 33→36・short MASTER 35→32(HELL は固定 55・58)
- 交差0・手の決まり0・点検の帯の外れ0。run-checks の NG は main でも同じ物だけ

## 社長の答えで分かれる所
- OK → main を取り込み(tools/merge-main.js。ぶつかったら rhythm-mode.js と控え4つは main 側を取り、
  rhythm-vocal-split-chart.js --write ×4 → rhythm-chart-level.js --write → 控えを --update --reason で作り直す)→ 更新履歴の時刻を公開の時刻へ → ミハリ → マージ
- 直しが要る → 値は rhythm-vocal-split-chart.js の TUNE(曲ごと)と DIFFS。気になっている点は「受け渡し」(速い言葉を反対の手の内側へ渡す)。
  減らすと歌う手だけに寄るが Lv. が下がる
- 声だけの音源は会話の中で作った(audio-separator UVR-MDX-NET-Voc_FT)。声の拍は vocal-split/*-vocal-notes.json にコミット済みなので、作り直しには要らない
