# 助手ライフの作り直し: 配置図(案)— 2026-11-20 ナカヨシ

- 仕様書の案: [`docs/spec/ASSISTANT_LIFE.md`](../../../spec/ASSISTANT_LIFE.md)(1本の線・値を4本に畳む・用語・数・保存・作る順・社長に決めてほしいこと)
- 元: 総点検 [`docs/progress/kensa/assistant-life-overhaul-2026-11/`](../../kensa/assistant-life-overhaul-2026-11/README.md)・社長の決定 r1119-040
- **ゲームのコードは変えていない。** 「前」は総点検の本番の止め絵(偽のデータ・15:00)、「後」は手で描いた枠の図

## 絵

1枚に「前・縦/後・縦/見方」と「前・PC/後・PC」を並べた。PC の「前」は止め絵がある家・部屋・町だけ。

| 画面 | 絵 | いちばん押してほしい物 | 前の止め絵でいちばん目立っていた物 |
| --- | --- | --- | --- |
| 家 | [layout-house.png](layout-house.png) | 👀 見る | 📒 育成ノートの帯 |
| 部屋 | [layout-room.png](layout-room.png) | 💬 話す | 「できること」12行 |
| 町 | [layout-town.png](layout-town.png) | 得のいちばん大きい場所へ「行く」 | 地図(得は場所ごとに6種類) |
| 友情(助手どうし) | [layout-yujo.png](layout-yujo.png) | 上がりそうなペアを「見る」 | 線の色の説明・🎉 にぎやかの札 |
| フレンド | [layout-friend.png](layout-friend.png) | 🚪 訪ねる | 説明を閉じる「分かった」 |
| マスモン | [layout-masmon.png](layout-masmon.png) | いる子の札と「応援する」 | 7つの「?」の枠・点線の「まだ」 |

## どの画面にも同じ型

- 上の帯: 左「← 戻る」・まん中に題・右に時刻(「15:00 昼 · 次に動くのは 16:00」)。時刻の話はここだけ
- 下のタブ: 🏡 家・🗺 町・🤝 友情・🏠 フレンド・🐾 マスモン。どの画面も同じ位置(今は町だけ上)
- 主なボタンは1画面に1つ(桃→橙・120×44px 以上・字 13px 以上)。ほかは白地の同じ形
- 字は 見出し16・本文13・注11・数字20 の4段だけ(今は家の最初の画面だけで13段)
- 畳んである物(点線の枠)は押すと開く。PC は場所に余裕があるので開いたまま出してよい
- PC は2段組(左に場面の絵、右に中身)。今の「真ん中に 480px で左右が黒」はやめる
- マスモンの札はモンサクと同じ `MonsucMonCard`(MONSUC_UI §8)

## 撮り直し

```
node docs/progress/assistant-life/overhaul-design/shoot.js
```

`layout.html` の `SCREENS` を直して撮る。言葉の途中で折れないように `word-break:auto-phrase` を付けている。撮ったら全部の絵を開いて、言葉の途中の折り返しと下の空きを目で確かめる。
