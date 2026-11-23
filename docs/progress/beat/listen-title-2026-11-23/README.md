# 鑑賞の画面の曲名(r1119-154・2026-11-23)

社長の写真: 縦(iPhone)の鑑賞で、曲名が「♪ 全部必 / 殺技でつ( / `･ω･)」と3行に崩れていた。

- 直す前: `before-tate-390.png`(縦)・`before-yoko.png`(横)
- 直した後: `after-tate-390.png`・`after-tate-375.png`・`after-tate-320.png`(縦)・`after-yoko.png`・`after-yoko-small.png`(横)

直したこと
- 縦は右上の「🎧 鑑賞中・難易度」の札を曲名の下の段へ回し、曲名を ✕ の手前まで広げた(ジャケットは大きいまま)
- 曲名は #7403 の useRhythmFitText で実際に測って収める(字を縮める → 2行 → 最後だけ「…」)
- 横は曲名の欄を 28cqw → 38cqw に(レーンの外の範囲)。札は今までどおり ✕ の左

検査: `node tools/mode/rhythm-listen-title-fit-check.js`(全100曲・縦390/375/320・横844/667。「…」0件・2行まで・✕/札/コンボ数/入切/下の帯と重ならない)
