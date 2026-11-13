# モンスター基礎情報・血統別の技データ

LINEモンスターファーム徹底攻略のデータです（取得日 2026-11-13）。UTF-8のJSON。

| ファイル | 中身 | 件数 |
|---|---|---:|
| `1_monsters.json` | 全モンスターの基礎情報 | 367体（素質などの基礎データあり366体） |
| `monster-skills-by-blood/NN_<血統>.json` | 血統別の技（34ファイル） | 852技 |
| `2_skill-abilities.json` | 技能力（技についている効果）の辞書 | 744件 |
| `3_skill-buffs.json` | バフ・デバフの辞書 | 34件 |

```
1_monsters.id ←─ 技の unlockedBy[].monsterId / owners[] / abilities[].unlock.monsterId
血統ファイルの skills[].abilities[].abilityId ─→ 2_skill-abilities.abilityId
2_skill-abilities.buffs[]（bf-####）           ─→ 3_skill-buffs.buffId
```

## 1_monsters.json

`monsters[]`：

| キー | 意味 |
|---|---|
| `id` | 4桁のモンスターID（文字列）。**不変**。技データはこのIDで参照する |
| `name` | モンスター名 |
| `aura` | オーラ色（黒・赤・青・白・緑・黄） |
| `monType` | モン類（獣族・無機・魔族・創造・幻霊・怪物） |
| `mainBlood` / `subBlood` | 主血統 / 副血統（副はレアモン・ノーブル・ロード種もある） |
| `limited` / `limitedLabel` | 限定モンスターか / 限定の種類（春限定など） |
| `basics` | 基礎データ。未登録は null（1体） |

`basics`（ゲーム内の詳細画面の値を転記したもの）：

- `talent`：素質％。`life`体力・`power`ちから・`wisdom`かしこさ・`accuracy`命中・`evasion`回避・`defense`丈夫さ
- `gutsRecovery`：ガッツ回復力、`moveSpeed`：移動速度（ともにS〜Gの評価）
- `growthType`（成長タイプ）、`goodEvil`（ヨイワル）、`size`（サイズ）
- `terrain`：地形適性（砂漠・森林・海岸・雪山・火山）、`range`：間合い適性（`far`遠・`mid`中・`near`近・`zero`零）。ともにS〜Gの評価

## 血統別の技（monster-skills-by-blood/）

ファイル名の `NN` はゲーム内の血統順です。各ファイルは `{blood, counts, skills[]}`。
技は血統ごとに共通で、その血統のモンスターなら登録すれば使えます。

| キー | 意味 |
|---|---|
| `skillId` | 技ID（`sk-####`）。不変 |
| `name` / `blood` | 技名 / 血統 |
| `range` | 技を発動できる間合い（`零`・`近`・`中`・`遠`） |
| `moveTo` | 発動後に移動する先の間合い。移動しない技は null |
| `rank` | 技ランク（1〜6） |
| `aura` | 技のオーラ（7値。`無`＝オーラ無し） |
| `skillType` | 技種（`ちから` / `かしこさ`） |
| `guts` | 消費ガッツ |
| `damage` / `accuracy` / `gutsDown` / `critical` | ダメージ・命中率・ガッツダウン・クリティカル率の評価（`SS`〜`G`、各段に`+`付きあり。無い場合は null） |
| `abilities` | 技能力の配列。`abilityId` で `2_skill-abilities.json` を引く。`unlock` が null なら最初から、`{monsterId, level}` なら そのモンスターを★levelまで上げると解放 |
| `unique` / `owners` | 固有技か / 使えるモンスターのID。血統共通技は `owners` が空 |
| `unlockedBy` | 技の登録条件。`{monsterId, rarity}`＝そのモンスターを★rarity（1〜10）以上にすると登録できる |
| `version` / `status` / `sortOrder` / `note` | 版 / `verified`（確認済み）/ 並び順 / 備考 |

## 2_skill-abilities.json / 3_skill-buffs.json

- 技能力：`abilityId`（`sab-####`）、`name`（`背水Lv4`）、`baseName`と`level`（Lvの分解）、`description`（改行は`\n`）、`buffs`（バフID配列）。同名で版違いのものは `version` が違います
- バフ：`buffId`（`bf-####`）、`name`、`kind`（バフ/デバフ）、`description`

## 注意

- 技のアイコン画像・モンスター画像は含みません。
- 技データは血統ごとに順次登録しているため、今後も件数が増えます。
- 公式データではなく、サイト運営者が画面から転記・集計したものです。再配布・転載の扱いは運営者に確認してください。
