---
name: monster-add
description: Add a new playable ally monster (味方モンスター) to モンスターヒーロー — the 20th-and-beyond entry in ALL_PLAYER_MONSTERS. Use when the user drops a monster illustration or says 新モンスター実装 / モンスター追加 / この子を実装して / 新しい味方モンスター. Lists every place one monster must be registered (stats, 9 attack names, unique skill, images, 立ち絵・顔アイコン・円盤石アイコン, lineage, dex text, market discs, market icon framing, dye regions, attack motion), which values must be asked rather than invented, how the 3 dye-region styles differ (3 parts is the rule, KenshiMocchi's 5 is the exception), and the checks that catch a missing registration.
---

# 味方モンスターを1体足す

**参照実装は「ミーア」(`Mia`)。** 必要なものがひととおり揃っている唯一の例なので、
新しい子を足すときは `grep -n "Mia" <ファイル>` で当たりを取ってから同じ場所へ1行ずつ足す。

## 0. 聞き返す場所

絵だけ渡されたときに**勝手に決めてはいけないもの**。まとめて1回で聞く。

| 決めるもの | 例(ミーア) |
| --- | --- |
| モンスターid・表示名・絵文字 | `Mia` / ミーア / 🧚 |
| 勇者特性と説明 | 魔力開放 / 勇者モン選択時：固有技のダメージが2倍 |
| 基礎能力4つ | ライフ300 / ガッツ180 / ちから175 / 丈夫さ60 |
| 供モン加算4つ(`plusStats`) | hp120 / atk30 / def10 / guts65 |
| 間合い適性4つ(零・近・中・遠) | `['G','C','A','B']` |
| 固有技の名前・倍率・消費ガッツ・効果 | バン / 2.1倍 / 42 / 魔法空間：次ターン、カード消費ガッツ0 |
| 血統(`main`/`sub`)と区分 | `pixie` / `unknown` |
| 円盤石の値段 | 1500 |

能力値はバランスに直結する(ゴーレムの合掌の消費68のように、ユーザーが決めた数字が
コメントで固定されている例がある)。**指定があればそのとおりに入れ、無ければ聞く。**
絵・アイコン・図鑑の文面・染色の部位分けは、聞かずに進めてよい。

## 1. 必要なデータの全体像

**1体につき、次の9か所すべてに登録が要る。** どれか1つ抜けても画面はふつうに動いてしまう。

| # | ファイル | 何を足すか |
| --- | --- | --- |
| 1 | `data/ally-monsters.js` | `HERO_ATK_NAMES[id]` … 通常技の名前**9つ**(進化段階ごと) |
| 2 | 同上 | `ALL_PLAYER_MONSTERS[id]` … 本体。下の表のとおり |
| 3 | `data/images/images-ally.js` | `<ID>_IMG` / `<ID>_ICON` / `<ID>_FACE_ICON`(＋使うなら `<ID>_DYE_MASK`) |
| 4 | `data/lineages.js` | `MONSTER_LINEAGE_MAP[id]={main,sub}` と `MONSTER_DEX_DESCRIPTIONS[id]`(図鑑の説明文) |
| 5 | `data/breeder.js` | `<ID>_DISC_ICON` と、マーケットの商品**3件**(アイコン / 円盤石アイコン / 円盤石) |
| 6 | `parts/20-market-notices-help.jsx` | `MARKET_ICON_FRAMING` へ**2行**(`<id>_disc_icon` と `<Id>`)。丸枠への収まり |
| 7 | `parts/15-dye-and-art.jsx` | `MASU_COLOR_REGION_HUES[id]` … 染色の部位分け(§4) |
| 8 | `monster-hero/images/` | 立ち絵 `monsters/<id>.png` ／ 円盤石 `disc-icons/<id>-disc.PNG` |
| 9 | `parts/60-app.jsx` ほか | 勇者特性・固有技の**実効果のID分岐**(§5)。表示だけでは何も起きない |

### `ALL_PLAYER_MONSTERS` のフィールド

```js
Mia: { id:'Mia', name:"ミーア", emoji:"🧚", imgUrl:MIA_IMG, iconUrl:MIA_ICON, faceIconUrl:MIA_FACE_ICON,
  atkMotion:'miaSongNotes', trait:"魔力開放", traitDesc:"勇者モン選択時：固有技のダメージが2倍",
  baseHp:300, baseGuts:180, baseAtk:175, baseDef:60,
  plusStats:{hp:120,atk:30,def:10,guts:65},
  distAptitude:['G','C','A','B'],
  unique:{ name:"バン", icon:MIA_ICON, monId:"Mia", baseMult:2.1, baseGuts:42, evoLevel:0,
    names:["バン","ギガレイ","ギガサンダー","ビッグバン","ギガライトニング","コズミッグバン","テラレイ","テラバン","ドラゴ・ノヴァ"],
    effectDesc:"魔法空間：次ターン、カード消費ガッツ0" } },
```

- `distAptitude` は**零・近・中・遠の順**。`A`〜`G` の7段階
- `unique.names` も**9つ**。`HERO_ATK_NAMES` と同じ段数
- `atkMotion` は**全種で必須**。専用モーションを作らないなら `'default'`
- 解放は `type:'disc'` の商品idを**モンスターidと同じ**にすることで紐づく。
  初期解放したいときだけ `STARTER_MONSTER_IDS`(`data/ally-monsters.js` の末尾)へ足す。
  ふつうは足さない — 円盤石を買って解放するのが既定で、解放状況は `mh_unlocked_monsters` に入る

## 2. 絵を整える

**受け取った画像をそのまま入れない**(CLAUDE.md ⑥-2)。順に通す。

```bash
# ① 立ち絵。正方形・余白そろえ・透過へ
node tools/image/import-monster-art.js <元画像> <モンスターid> --size 1024

# ② 外側の透明な余白を落とす(他の子と同じ大きさで並ぶように)
node tools/image/trim-art-margin.js monster-hero/images/monsters/<id>.png

# ③ 顔アイコン(faceIconUrl)。--preview で out/ に下見してから本番
node tools/image/make-face-icons.js --preview
node tools/image/make-face-icons.js

# ④ 円盤石アイコン。共通の土台へ重ねる
node tools/image/make-disc-icon.js monster-hero/images/monsters/<id>.png monster-hero/images/disc-icons/<id>-disc.PNG
node tools/image/make-disc-icon-transparent.js <id>-disc     # 白背景が残っていたら

# ⑤ 反映とキャッシュキー
node tools/build.js
node tools/image-asset-check.js
node tools/image/monster-image-quality-check.js
```

- **同じ絵を使い回すならパスを2回書かない。** `const MIA_ICON = MIA_IMG;` のように変数で参照する
- 立ち絵が縦長で枠からはみ出すなら `MONSTER_ART_CONTAIN_IDS`(`15-dye-and-art.jsx`)へ id を足す
- 丸枠への収まりは `MARKET_ICON_FRAMING` の `scale` / `x` / `y` で合わせ、
  `node tools/image/market-icon-framing-check.js` で数値を確かめる

## 3. 通常技・固有技の名前

`HERO_ATK_NAMES[id]` に**9つ**。同じ系統の子とそろえてよい
(ミーアはピクシーと同じ並び。パンドラは同じ系統だが独自の名前を持っている)。

## 4. 染色(いちばん手が要る)

**原則は3部位。**`MASU_COLOR_REGION_HUES[id]` の配列の**長さがそのまま部位数**になり、
染色UIの枠数も `dyeRegionCount` が同じ値から自動で決まるので、UI側の対応は要らない。

> **例外: 剣士モッチー(`KenshiMocchi`)だけ5部位。** 3以外にもできる、という実例。
> 配列を書かなかった子は「全身一括の1枠」になる(部位分けなしでも染色自体は効く)。

やり方は3通りある。**絵に合うものを選ぶ。**

| 方式 | 書くもの | 使っている子 |
| --- | --- | --- |
| **色相ルール**(いちばん軽い) | `{hue, sMin, vMin, bbox…}` を3つ | モッチー・ライガー・ハム・ピクシーなど大半 |
| **配信マスクPNG** | `images-ally.js` へ `<ID>_DYE_MASK`、実体を `images/monsters/<id>-dye-mask.PNG` | モッチー・プラント・ヤオビクニ・永輝・剣士モッチー |
| **埋め込み部位マップ**(いちばん正確) | `<ID>_EXACT_REGION_2BIT` と `_SIZE` を `15-dye-and-art.jsx` へ | **ミーア**・パンドラ |

- 部位マップ・マスクは**デバッグ画面の「染色マスクエディタ」から書き出す**。
  書き出したPNGは配信フォルダではなく `tools/art-sources/dye-masks/` へ置く(検査専用の正解見本)
- 承認済みのマスクを取り込むときは `node tools/image/convert-dye-mask.js <入力> <出力> --snap`
  (本番と同じ判定で純色へそろえる。953KB→37KB になった例がある)
- 境目に元の色の筋が出るなら `noEdgeGuard:true`、輪郭が荒れるなら `MASU_COLOR_SMOOTH[id]` を調整
- 正解見本と画素単位で比べる検査を1本足す(`tools/image/<id>-dye-mask-check.js`。
  ミーア・永輝・モッチー・プラント・ウンディーネ・ヤオビクニに前例がある)

## 5. 攻撃モーションと、特性・固有技の実効果

**表示テキストを足しただけでは何も起きない。** `trait` / `unique.effectDesc` は説明文であって、
効き目は本体のID分岐が作る。

```bash
node tools/where.js --text "monId==='Pixie'"      # 似た効果の子を探して、その分岐へ id を足す
```

- 例: ミーアの「次ターン カード消費ガッツ0」は `60-app.jsx` の
  `card.monId==='Pixie'||card.monId==='Mia'` という分岐で効いている
- 勇者特性の倍率も同じ形(`mainHero?.id==='Golem'?1.2:1.0` のような並び)
- **専用モーションを作るなら3か所**。`24-battle-fx.jsx`(見た目) /
  `23-rpg-debug.jsx`(プレビューの待ち時間) / `60-app.jsx`(本番の待ち時間)。
  ミーアの `miaSongNotes` が手本で、`MIA_SONG_NOTES_MOTION_MS` を3か所が参照している。
  作らないなら `atkMotion:'default'`

## 6. 検査

```bash
node tools/build.js
node tools/run-checks.js --area required 2>&1 | tail -20
node tools/run-checks.js --area monster,image 2>&1 | tail -25
```

とくに効くもの。

| 検査 | 見ているもの |
| --- | --- |
| `monster/lineage-dex-check.js` | 血統・区分・図鑑の説明文の抜け |
| `monster/monster-card-consistency-check.js` | 一覧カードの表示 |
| `monster/monster-art-fit-check.js` | 立ち絵が枠へ収まるか(`MONSTER_ART_CONTAIN_IDS`) |
| `monster/market-icon-check.js` | マーケットのアイコン商品の綴り |
| `image/market-icon-framing-check.js` | 丸枠への収まり(`MARKET_ICON_FRAMING`) |
| `image/monster-image-quality-check.js` | 寸法・透過・背景の残り |
| `image-asset-check.js` | 参照先の綴り・キャッシュキー |
| `image/dye-report.js` | 染色の塗り分けの下見(レポート) |
| `masu/monster-power-check.js` | 総合力の計算 |
| `ranking/bond-ranking-species-check.js` | 絆Lvランキングの種別 |
| `mode/species-challenge-*-check.js` | 種族チャレンジ(血統で選ばれる) |

## 7. 更新履歴・ヘルプ

**`changelog-help-update` スキルへ。** ここでは要点だけ。

- モンスターの一覧・図鑑・マーケットは `{t:'data', id:'…'}` が実データから作るので
  **ヘルプへ手で書き写さない**(`monsterLineages` / `monsterPower` などのidがある)
- マーケットに円盤石を並べたので、更新履歴へ
  `assistantNotice:{id:'update_notice_◯◯_v1', type:'market'}` を**必ず**付ける
  (`node tools/boot/market-notice-check.js` が見張る)

## 8. 落とし穴

### 画面はふつうに動いてしまう
血統を書き忘れる・マーケットの3件のうち1件だけ足す・`MARKET_ICON_FRAMING` を書かない、
のどれも**エラーにならない**。気づけるのは §6 の検査だけなので、必ず `--area monster,image` まで通す。

### 円盤石の商品idはモンスターidと同じ
`{ id:'Mia', type:'disc' }` の `id` が解放と紐づく。アイコン商品のほうは `mia_icon` /
`mia_disc_icon` と小文字スネークで、**綴りが3件で違う**。混ぜない。

### 絵を2枚置く
`iconUrl` / `faceIconUrl` が立ち絵と同じでよいなら `const MIA_ICON = MIA_IMG;` と参照する。
同じ絵のファイルを2枚置くと `tools/image/image-report.js` が指摘する。

### 既存の保存キーを触る
解放状況は `mh_unlocked_monsters` に入っている。**新しい子を足しても保存形は変えない**
(idを1つ増やすだけ。CLAUDE.md ⑦)。
