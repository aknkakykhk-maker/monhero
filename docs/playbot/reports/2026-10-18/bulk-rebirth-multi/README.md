# まとめて転生の回数・最大(2026-10-18)

社長の追加要望「まとめて転生させるの、1回分しかできないから、2回以上できる場合でも回数を増やしたり、最大数転生みたいな感じのがあれば助かる！」。iPhone の幅(390)で撮影。

| ファイル | 中身 |
| --- | --- |
| `before-1-list.png` / `before-2-confirm.png` | 変更前。まとめて転生は1体1回だけ |
| `after-1-list.png` / `after-2-select-all.png` | 変更後。下に「1体あたりの回数 − 1 ＋ 最大」 |
| `after-3-times-2.png` | ＋で2回 |
| `after-4-times-max.png` | 「最大」。ボタンは「まとめて転生（3体・計8回）」 |
| `after-5-confirm.png` | 確認の窓。子ごとの回数(スエゾー×4回・モッチー×2回・タイガー×2回)とLvの変化、得られる物・失う物の合計、ダイヤの合計と残り |
| `after-6-animation.png` / `after-7-done.png` | 「3体・計8回の転生完了！」と、そのあとの一覧 |
| `bulk-rebirth-multi.mp4` | 15秒。すべて選択 → ＋ → 最大 → 確認 → 転生 |

決まり: 子ごとに `buildMasuReincarnation` を回数ぶん順に呼ぶだけ(1回ずつ転生したときと同じ)。
2回目からLvが足りなくなった子はそこまでで次の子へ。ダイヤが足りなくなったら全体をそこで止める。保存は1回。
検査: `tools/masu/bulk-reincarnate-check.js` ⑥・`tools/masu/bulk-reincarnate-browser-check.js` ⑤
