# ジャックの絵(預かり)

2026-10-04 にユーザーから受け取り、`tools/image/prepare-enemy-art.js`(ボスなので `LONG=1024`)で整えたもの。
**配信へは `monster-hero/images/` に置いたときだけ出る**(置くのはゲームへ組み込むとき。先に置くと
`tools/image-asset-check.js` が「どこからも参照されていない絵」として落とす)。

| ファイル | 使い道 |
| --- | --- |
| `jack.png` | バトルグラフィック。通常の立ち絵(1枚目) |
| `jack-pose.png` | バトルグラフィック。両腕を上げたポーズ(2枚目)。大技・登場・HOMEのときどきのポーズ |
| `jack-icon.png` | イベント中の顔アイコン(3枚目)。256px |

透過は受け取った絵のまま(こちらでは抜いていない)。設計: `docs/spec/RAID_BOSS_JACK.md`
