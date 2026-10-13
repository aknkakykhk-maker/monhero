# モンヒロビートのマルチでも HELL をえらべるように(2026-10-13)

社長「マルチでヘルがない」→「マルチも通常と同じ仕様にして」。

## 原因

マルチの画面へ渡す難易度の一覧が5難易度(`RHYTHM_DIFFICULTIES`)だけで、難易度えらびのボタンも5列固定だった。
部屋の通信は難易度を名前のまま運ぶだけなので、新しい表・キーは要らない。

## 直したこと

- マルチへ渡す一覧を、ひとりの曲えらびと同じ `RHYTHM_PLAY_DIFFICULTIES`(5難易度 + HELL)にした。HELL の譜面は公開の印が立っていて、その曲に HELL があるときだけ見える(`rhythmWithHellChart`)。HELL の無い曲は今までどおり5つ
- 開き方はひとりと同じ `rhythmDifficultyUnlocked`(その曲の MASTER をクリア)。まだのときはボタンを押せず「🔒HELL」「MASTERで解放」と出す(ほかの難易度の鍵も同じ出し方)
- 難易度えらびのボタンを、難易度の数だけ並ぶ形にした(HELL のある曲は6つ)
- 演奏・判定・満点(105万)・ランク・空中のノーツ・オプション・結果・自己ベスト・ランキングへの送り方は、ひとりの HELL と同じ関数を通る(マルチの結果の処理は難易度で分かれていない)
- 相棒(CPU)は今までどおり、自分の難易度にそろう

## 絵(Chromium・Sheriruth・プライベートルームに検査用のマスモンを呼んだ部屋)

- `before-ready.webp` … 直す前の難易度えらび(5つだけ)
- `after-ready-hell.webp` … 直した後。MASTER をクリアしている人が HELL をえらんだところ
- `after-ready-locked.webp` / `after-ready-locked-portrait.webp` … MASTER をクリアしていない人(横・縦)
- `after-play-hell.webp` … マルチの HELL で演奏が始まったところ(Sheriruth HELL 642ノーツ・空中212)
- `after-select.webp` … 選曲画面(ひとりと同じ曲えらびの部品に HELL が並ぶ)
