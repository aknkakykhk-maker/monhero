# ゲームで使っていない画像の一覧(r1123-008)

<!-- このファイルは node tools/image/unused-images.js が書く。手で直さない(直すのは道具) -->

**まだ何も移していない・消していない。** 社長が OK したあとに、保管庫 `archive/unused-assets/` へ移す(消さない)。
判定のしかたと限界は `tools/image/unused-images.js` の頭の説明。静的に読んだ結果なので、移す前に動かして読み込まれた物の記録でも確かめる。

## 要約

| 判定 | 枚数 | 容量 |
| --- | ---: | ---: |
| 全画像 | 2639 | 387.8MB |
| 使っている | 2630 | 387.7MB |
| 使っていない候補 | 0 | 0.0MB |
| 要確認(怪しいので残す側) | 9 | 0.1MB |

「使っている」の内訳: 道筋がそのまま書いてある(絵の表の定数を含む) 1100 枚 / 名前を組み立てる型に合う 1530 枚 / フォルダと名前が別々に書いてある 0 枚

## 種類(フォルダ)ごとの内訳

| フォルダ | 全部 | 使っていない候補 | 容量 | 要確認 | 容量 |
| --- | ---: | ---: | ---: | ---: | ---: |
| `monsters` | 117 | 0 | 0.0KB | 3 | 10.6KB |
| `lineage-icons` | 37 | 0 | 0.0KB | 6 | 135.3KB |

## 使っていない候補(0 枚・0.0MB)

なし

## 要確認(9 枚・0.1MB)

### `lineage-icons`(6 枚・135.3KB)

- 理由: 絵の表(data/images)に定数 LINEAGE_ICON_KAWAZUMO があるが、その定数をどこも使っていない
  - `images/lineage-icons/kawazumo.png` 20.6KB
- 理由: 絵の表(data/images)に定数 LINEAGE_ICON_KIJIN があるが、その定数をどこも使っていない
  - `images/lineage-icons/kijin.png` 23.8KB
- 理由: 絵の表(data/images)に定数 LINEAGE_ICON_LORD があるが、その定数をどこも使っていない
  - `images/lineage-icons/lord.png` 25.0KB
- 理由: 絵の表(data/images)に定数 LINEAGE_ICON_NENDORO があるが、その定数をどこも使っていない
  - `images/lineage-icons/nendoro.png` 16.0KB
- 理由: 絵の表(data/images)に定数 LINEAGE_ICON_NOBLE があるが、その定数をどこも使っていない
  - `images/lineage-icons/noble.png` 22.3KB
- 理由: 絵の表(data/images)に定数 LINEAGE_ICON_SHINRYU があるが、その定数をどこも使っていない
  - `images/lineage-icons/shinryu.png` 27.5KB

### `monsters`(3 枚・10.6KB)

- 理由: 絵の表(data/images)に定数 MIA_WING_BODY_MASK があるが、その定数をどこも使っていない
  - `images/monsters/mia-wing-body.png` 5.2KB
- 理由: 絵の表(data/images)に定数 MIA_WING_LEFT_MASK があるが、その定数をどこも使っていない
  - `images/monsters/mia-wing-left.png` 2.7KB
- 理由: 絵の表(data/images)に定数 MIA_WING_RIGHT_MASK があるが、その定数をどこも使っていない
  - `images/monsters/mia-wing-right.png` 2.6KB

## 拾った「名前を組み立てる型」(当たった枚数の多い順)

- 1028 枚: `{CARD_IMAGE_SET.imageDir}/{size}/{img}.jpg`(monster-hero/src/parts/84-screen-card-battle.jsx)
- 135 枚: `images/assistant/fullbody/{name}{Array.isArray(exprs) && expr}.png`(monster-hero/data/assistants.js)
- 134 枚: `{who.imageDir}/{who.imagePrefix}_{assistantExpressionName(who,}.PNG`(monster-hero/data/assistants.js)
- 120 枚: `images/assistant/{dir}/{who.imagePrefix}_{ex}.png`(monster-hero/data/assistants.js)
- 113 枚: `{who.imageDir}/face/{who.imagePrefix}_{assistantExpressionName(who,}.PNG`(monster-hero/data/assistants.js)

当たらなかった型: 24 個(画像のフォルダの外・音・動画の組み立てなど)
