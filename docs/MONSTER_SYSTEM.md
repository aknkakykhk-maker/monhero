# モンスターシステム設計書

## 1. 用語とデータモデル

- **ベースモン（種）**: `ALL_PLAYER_MONSTERS` にある不変の定義。ID、表示名、画像、特性、基礎能力、合流能力、距離適性、固有技を持つ。
- **マスモン（個体）**: プレイヤーが保存・育成するインスタンス。`baseId` で種を参照し、個体名、絆XP、強化、染色、融合履歴、継承固有技を持つ。
- **勇者モン**: ラン開始時に最初に選んだ1体。基礎能力がランの初期能力になり、勇者特性を発動する。
- **供モン**: WAVE途中で合流する仲間。`plusStats` と距離適性段階差をラン能力へ加え、固有技を提供する。

マスモンをバトル用に解決するときは、ベース定義を複製して `masuId`、個体名、個体距離適性、ステータス強化値、染色、継承固有技を重ねる。種IDは特性判定を壊さないため変更しない。

## 2. 現在の種

`ALL_PLAYER_MONSTERS` には12種（Mocchi、Suezo、Golem、Tiger、Ham、Pixie、Monol、Oboro、Zan、Mitarashi、Ark、Iblis）がある。初期解放は先頭8種で、Zan、Mitarashi、Ark、Iblis はマーケットの円盤石購入で解放する。

各定義の必須実装項目は次のとおり。

| フィールド | 用途 |
| --- | --- |
| `id`, `name`, `emoji` | 識別・表示 |
| `imgUrl`, `iconUrl`, `faceIconUrl` | 立ち絵・アイコン |
| `atkMotion` | 攻撃モーション識別子。全種で明示する |
| `trait`, `traitDesc` | 勇者特性の表示。実効果は本体のID分岐 |
| `baseHp`, `baseGuts`, `baseAtk`, `baseDef` | 勇者時の初期能力 |
| `plusStats` | 供モン合流時の加算能力 |
| `distAptitude[4]` | 零・近・中・遠の順の距離適性 |
| `unique` | 固有技名、画像、倍率、消費、9段階名、説明 |

表示説明だけ追加しても効果は発生しない。勇者特性や固有技効果は `game-system.jsx` 内のID・カード種別分岐も同時に必要である。

## 3. 編成と解放

- 解放済み種は `mh_unlocked_monsters`、ラン候補編成は `mh_monster_roster` に保存する。
- 編成要素はベース種ID、または `masu:<個体ID>`。マスモン削除・融合で個体が消えた場合、対応する編成要素も除去する。
- 同一種のベースモンと複数のマスモン個体は別候補として扱える。
- UIはベース／マスモン／血統／絆／名前／編成中で並べ替え、表示情報を切り替える。これらのUI設定自体は保存されない。

## 4. 絆と強化

絆レベルの次レベル必要XPは次式である。

```text
max(1, round(50 × level^1.4 × 0.05))
```

レベルは1から始まり、コードは最大200回の反復で算出する。1レベル上昇ごとに強化ポイントを1得る。読み込み時には「絆Lv-1」と使用済み＋未使用ポイントを比較し、不足分を補填する。

強化ポイント1点で次のどれかを行う。

- 任意距離の適性を G→F→E→D→C→B→A→S→S+→SS→SS+→M の次段階へ上げる。
- ライフ+10、ちから+3、丈夫さ+3、ガッツ+3。

1点ずつと一括配分の両UIがあり、一括配分は確定まで下書きだけを保持する。「絆ポイントリセットの書」は距離適性と能力をベース値へ戻し、使用分を未使用ポイントへ返す。絆XPと絆Lvは変えない。

ラン終了時、勇者が既存マスモンなら経験値を直接加算する。ベースモンなら保存せず、リザルトで新規マスモン登録を選んだ場合だけ、そのランの獲得XPを初期値にする。供モンとして参加した既存マスモンには勇者獲得量の4分の1（最低1）を加算する。チケットは定義された `bondXp`×使用枚数を直接加える。

## 5. マスモンの保存形

新規個体の基本形は次のとおり。任意項目は機能利用時に追加される。

```js
{
  id, baseId, name, bondXp,
  distAptPoints,
  distApt: [grade0, grade1, grade2, grade3],
  statPoints: { hp, atk, def, guts },
  createdAt,
  colors,              // 任意。部位別の色ID配列
  fusionHistory,       // 任意。融合履歴配列
  inheritedUniques     // 任意。継承固有技配列
}
```

旧染色の単一 `color` は読み取り時に `[color]` として扱う。旧種別絆データから移行した個体IDは `masu_migrated_<種ID>`、通常登録IDは時刻と乱数を含む `masu_...` である。IDの永続的な一意性保証範囲は**未確認**（サーバー採番はない）。

## 5.5. 総合力

「その個体がいま実際に持っている能力・育成結果」を1つの数値にした、表示・比較用の派生指標。
正本は `game-system.jsx` の `monsterPowerOf`（解決済みモンスターを渡す）と
`masuPowerOf`（保存データのマスモンを渡す）で、画面ごとに式を書かない。

### 計算式

各項目を足し、**最後に一度だけ四捨五入**して整数で表示する（項目ごとには丸めない）。

```text
総合力 = ライフ×1 + ちから×(10/3) + 丈夫さ×(10/3) + ガッツ×(10/3)
       + 4距離ぶんの間合い適性
       + 固有技の所持数×100 + 固有技の強化Lvの合計×(200/3)
```

強化ポイント1点ぶんの伸び（ライフ+10 / ちから+3 / 丈夫さ+3 / ガッツ+3 / 間合い適性1段階）は、
どれも総合力+10になる。

### 間合い適性の換算

零・近・中・遠の**4距離すべて**を合計する（戦闘で配置した距離だけではない）。

| 段階 | M | SS+ | SS | S+ | S | A | B | C | D | E | F | G |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 点 | +70 | +60 | +50 | +40 | +30 | +20 | +10 | 0 | -10 | -20 | -30 | -40 |

例: A / C / E / G は `+20 + 0 - 20 - 40 = -40`。

### 固有技の換算

- 固有技を1つ持っていること自体で **+100**（Lv0でも付く）
- 固有技の強化Lv1段階ごとに **+200/3**
- 自前の固有技と合体で継承した固有技は同じ基準。壊れた保存データ（`null`、名前や倍率を持たない要素）は
  架空の技として数えない

例: 自前Lv3 + 継承Lv2 → 技所持 `2×100` ＋ 技Lv `(3+2)×200/3`。

### 総合力に含めないもの

未使用強化ポイント / 絆Lv・絆XP / Lv上限 / 限界突破回数 / 転生回数 / 合体回数と合体で得たXP /
勇者特性 / 合流ボーナス（`plusStats`）/ 染色 / 所持アイテム / ダイヤ・ゴールド。

**未使用強化ポイントは0点**。持っているだけでは上がらず、能力や間合い適性へ実際に振った時点で上がる。
絆ポイントリセットで強化済みの能力が未使用ポイントへ戻れば、そのぶん総合力は下がる。
再び振れば上がる。この上下は補填せず、そのまま反映する。

### 保存しない

ランキングだけは例外で、記録を作った時点の総合力を **`detail.power` として数値1つだけ保存する**（§5.6）。
セーブデータ（`mh_*`）には保存しない。

総合力そのものは**セーブデータへ保存しない**。現在の個体データから毎回計算する派生値なので、
能力の変更・間合い適性の変更・固有技の強化・継承技の追加・リセットへ自動で追従する。
ベースモンは基礎能力・基礎の4距離適性・自前の固有技1個から同じ式で計算するため、マスモンと比較できる。

### 使うところ

モンスター詳細の上部サマリー、一覧カード、強化画面の強化前後プレビュー、一覧の並べ替え。
強化のプレビューは `applyEnhancePlanToMasu`（下書きを実データへ触れずに当てはめる）を通し、
確定処理も同じ関数を使うので、プレビューの値と確定後の総合力が一致する。

回帰確認: `node tools/monster-power-check.js`

## 5.6. ランキングの記録形（RANKING_DETAIL_VERSION）

ランキングの1体ぶんの詳細は `rankingMasuDetail(masu)` が作り、`rankingDetailToMasu(baseId, detail, colors)`
が表示用の「マスモン相当」へ戻す。Supabase のスキーマは変えず、既存の `party[].detail` の JSON の中だけで拡張する。

| 版 | 追加したもの |
|---|---|
| v1 | 名前・絆XP・限界突破・Lv上限・強化ステータス・間合い適性・強化P・固有技Lv・継承技(monId+Lv)・`fusionCount` |
| v2 | `power`（記録時点の総合力）と `fusion`（合体履歴の中身） |
| v3 | `reincarnateCount`（転生回数）。v1・v2 は持たないので読むときは 0 へ倒す |

- `power` は必ず共通の `monsterPowerOf(mergeMasuIntoMon(masu))` で作る。ランキング専用の式は作らない。
  あとで種のバランス・能力・距離適性・固有技を変えても、過去の記録の数字が動かないようにするためのもの。
- `fusion` は1件 `{ b:相手の種ID, n:当時の個体名, l:相手の絆Lv, x:獲得XP, i:継承1, t:日時(秒) }`。
  空の項目は入れない。件数は `RANKING_FUSION_MAX`（12件）で切り、切っても `fusionCount` には本当の回数を残す。
- 絵・技の説明・base64 は**絶対に入れない**。どの端末も同じデータを持っているので、IDから引き直す。
  1体あたり v1相当236バイト → v2(合体3回)431バイト → v2(上限12件)933バイト。

### 旧記録との互換

- v1 の記録には `power` が無い。そのときは**現在の共通計算で出した参考値**を表示し、
  「この記録には総合力が残っていないため、いまのデータで計算した参考値です」と断る。
  **0 を総合力として表示しない**（分からないときは `—`）。
- v1 の記録には `fusion` が無い。`fusionCount` ぶんの空の項目だけを置き、履歴の中身は作らない。
- 壊れた記録（`fusion` が配列でない、`power` が負や文字列）でも落ちず、既定値へ倒す。

### 絆Lvランキングへ何を送るか

絆Lvランキングは、記録の `party[].bondLevel` を `collectBondRankingEntries` で集計している。
つまり**載るかどうかは送信側で `bondLevel` を入れているかで決まる**。`submitLocalScore` の決まりは次のとおり。

- マスモンの枠 … **そのランの絆経験値を加算したあと**の個体（`postRunMasuMonsRef`）から絆Lvを出す。
  `setMasuMons` の反映は非同期なので、state を直接読むと1ラン遅れた絆Lvを送ってしまう。
  同じ理由で `detail`（育て方・総合力スナップショット）も加算後の個体から作る。
- まだマスモンでない勇者モンの枠 … そのランでためた絆経験値ぶんの絆Lv（`runHeroBondLevelRef`）を送る。
  リザルトで「マスモンとして登録」するとこの経験値がそのまま初期値になるので、
  登録後の個体が到達する絆Lvと同じ値になる。
  これが無いと、ベースモンで遊んだランは絆Lvランキングへ1件も載らなかった
  （登録はスコア送信より後なので、その記録には間に合わない）。
- 供モンのベースモンの枠 … 絆の概念が無いので `null`（送らない）。

**クリア限定ではない。** 優勝・敗北・リタイアはどれも `awardRunRewards(...)` → `submitRunScoreOnce()` の
同じ経路を通り、違うのは渡すクリアWAVE数だけ（優勝は10、敗北とリタイアは `wave - 1`）。
`recordClearOnce` は通算クリア回数を数えるだけで、ランキングには関わらない。
WAVE1で諦めた場合だけはクリアWAVEが0で絆経験値の加算が起きず `postRunMasuMonsRef` が空になるが、
そのときは今のマスモンへフォールバックして現在の絆Lvを送る。
まだマスモンでない勇者モンだけは、絆経験値が0なので送る値が無い（存在しない個体を作らないため）。

集計側は `masuId` があれば `masu:<id>`、無ければ `legacy:<種ID>` で個体を数える。
同じ人・同じ種で両方の記録があるときは個体ID付きへ寄せるので、
登録前の記録と登録後の記録が二重に並ぶことはない。

### 絆Lvランキングの取得（並び順と件数）

送るところが正しくても、**取ってくる並び順**が違うと載らない。絆Lvだけ事情が違う。

| ランキング | 並び順 | 件数 | 取る列 |
|---|---|---|---|
| スコア | `score.desc.nullslast` | 難易度ごと50 | party込み |
| ブリーダーLv | `level.desc.nullslast` | 400 | partyなし |
| 絆Lv | `created_at.desc.nullslast` →（失敗時）`id.desc` | 120 | party込み |

絆Lvは「新しい記録」を見て集計する。以前は `order=id.desc` だけを使っていたが、
**`rankings.id` が uuid だと `id.desc` は作成順にならず、毎回ばらばらの記録を拾ってしまう**。
スコアは `score.desc`、ブリーダーLvは `level.desc` なのでこの影響を受けず、
絆Lvだけ「プレイしても更新されない」ように見える状態になっていた。
記録した時刻で並べ、`created_at` が使えない環境のために `id.desc` へ落とすフォールバックを残してある。

件数も60件では狭く、プレイ直後の自分の記録すら枠に入らないことがあったため120件へ広げた
（絆Lvは編成 `party` ごと取るので1行が重い。ここを増やしすぎると読み込みが重くなる）。

回帰確認: `node tools/bond-ranking-submit-check.js`、`node tools/bond-ranking-check.js`

### ランキングの詳細は readOnly

ランキングから開くモンスター詳細・合体詳細は、自分の個体と**同じ** `renderMonsterDetailModal` /
`renderFusionDetailModal` を使う。違いは `readOnly: true` を渡すことだけで、
名前変更・強化・編成・合体・限界突破・転生・寄付といった所有者だけの操作は呼び出し元が渡さない。

回帰確認: `node tools/ranking-monster-detail-check.js`、`node tools/fusion-detail-check.js`

## 6. 融合

- 主と副の異なる2個体を選ぶ。費用は `(主の絆Lv + 副の絆Lv) × 100` ゴールド。
- 副の全 `bondXp` を主へ加え、副個体を削除する。能力値、距離適性、使用済み・未使用の強化ポイントは合体で増減しない。
- 技を継承しない合体は0ダイヤ。副が絆Lv30以上で継承を選択した場合は3000ダイヤを消費し、副の種の固有技を `inheritedUniques` へ追加する。主の絆Lvに条件はない。
- 融合履歴には副名、種ID、融合時絆Lv、獲得XP、継承有無、時刻を残す。
- 副が編成中なら編成から除く。主の種、名前、強化、染色は維持される。

### 6.1. 合体詳細

モンスター詳細が「いまの個体を見る場所」なのに対し、合体詳細は
**「その個体がどんな合体を重ねて今に至ったか」を見る場所**として分離してある。

- モンスター詳細に置くのは `renderFusionSection` のサマリー1行（`合体回数 N回` ＋ `合体詳細を見る ＞`）だけ。
  合体が0回でも出す（入口の場所が個体によって変わらないようにするため）。
- 本体は `renderFusionDetailModal`。上部サマリーは詳細とまったく同じ `renderMonsterSummaryHeader` を
  `compact: true` で使い、画像・個体名・元のベースモン名・総合力・合体回数だけを出す。
- 履歴は**新しい合体が上**（`#3 → #2 → #1`）。1件に出すのは実際に保存されている項目だけで、
  日時・相手の絆Lv・獲得XPは保存が無ければ行ごと出さない。
- 継承した固有技そのものは履歴に持っていない。継承したのは必ず相手の種の固有技なので、
  主の `inheritedUniques` から同じ `monId` のものを探して名前を出し、見つからなければ種の固有技名を出す。
- 0件なら「まだ合体履歴はありません」。
- 読み取りは `normalizeFusionHistory(masu)` が正本。保存が無い項目は `null` のままにし、推測で埋めない。

### 6.2. ランキングの合体詳細

ランキングの記録から復元した個体でも、同じ `renderFusionDetailModal` へ入る（readOnly）。
合体回数しか残っていない古い記録では、履歴を作らず

```
合体回数 3回
詳細な合体履歴はこの記録には保存されていません
```

と出す。架空の相手・日時は生成しない（`hasDetail` で見分ける）。

回帰確認: `node tools/fusion-detail-check.js`

## 7. 転生

> レベル上限を上げるのは §7.5 の**限界突破**（`rebirthCount`）で、転生（`reincarnateCount`）とは別物である。
> 以下の記述は名称を分けるより前のもので、上限+5の部分は限界突破が担う。

- 現在のレベル上限到達時に転生でき、転生回数を1、レベル上限を5、選択した固有技Lvを1増やす。
- 転生後は同種の未育成Lv1と同じ絆XP、能力値、距離適性へ戻し、使用済み強化ポイントを0、未使用強化ポイントを5にする。転生前の未使用ポイントは持ち越さない。
- 名前、染色、転生回数、レベル上限、固有技Lv、引き継ぎ固有技、合体履歴、編成状態だけを維持する。
- 旧仕様で転生済みの個体は、ロード時の `mh_masu_rebirth_full_reset_migrated_v1` 移行で一度だけ同じ状態へ補正する。

## 7.5. 限界突破（★とレベル上限）

回数は `rebirthCount`（保存キーは従来のまま）、レベル上限は `levelCap` に持つ。
**★の色と個数は保存しない。`rebirthCount` から `breakthroughStars(count)` が毎回組み立てる。**

### レベル上限

| 凸数 | レベル上限 |
|---|---|
| 0 | 30（`INITIAL_MASU_LEVEL_CAP`） |
| n（1〜30） | 30 + 5n（`BREAKTHROUGH_LEVEL_CAP_GAIN` = 5） |
| 30 | 180（`BREAKTHROUGH_FINAL_LEVEL_CAP`） |
| 31 | **200**（`MAX_MASU_LEVEL_CAP`）＝最終限界突破。以降は突破できない |

30凸（上限Lv.180）に達したあとの1回だけが**最終限界突破**で、+5ではなく一気にLv.200へ上げる
（`buildMasuBreakthrough` の `isFinal` / 戻り値の `finalBreakthrough`）。
Lv.200へ達すると `levelCap >= MAX_MASU_LEVEL_CAP` の判定で突破できなくなる。
費用（`masuRebirthCost`）・もらえる強化ポイント・固有技Lvアップの扱いは通常の限界突破と同じ。

### 必要アイテム「虹のプシュケー」

限界突破には `rainbow_psyche`（虹のプシュケー）を消費する。
所持数は他の消耗アイテムと同じ **`mh_owned_items`（`{ itemId: 個数 }`）** に入れる。
新しい保存キーは作らないので、持っていない旧セーブは自動的に0個として読める（`ownedItemCount` が0へ倒す）。

必要数は `breakthroughItemCost(nextCount)`（`nextCount` = `rebirthCount + 1`）。

```text
必要数 = 5 + (突破回数 - 1) × 1
```

| 回数 | 必要数 |
|---|---|
| 1 | 5 |
| 2 | 6 |
| 3 | 7 |
| 30 | 34 |
| 31（最終限界突破） | 35 |

31回すべて行うと合計620個。数値は `BREAKTHROUGH_ITEM_BASE` / `BREAKTHROUGH_ITEM_STEP` が正本で、
画面の説明文と計算式の表記もこの定数から作る（数字を書き写さない）。

- 判定は `buildMasuBreakthrough` の中で、レベル上限・到達Lv・ダイヤの次に行う。
  足りなければ `ok:false` を返し、**何も消費しない**。
- 消費は `executeMasuBreakthrough` が保存に成功したときだけ。`result.nextPsyche`（= 所持 − 必要数）を
  そのまま `mh_owned_items` へ書くので、失敗・キャンセル・画面遷移では減らない。
- 入手は**クリアしたときだけ**。難易度ごとの個数は `CLEAR_PSYCHE_REWARD`。

| 難易度 | Beginner | Easy | Normal | Hard | Expert | Master | Grand Master | Hell | Legend |
|---|---|---|---|---|---|---|---|---|---|
| 個数 | 1 | 2 | 3 | 5 | 7 | 10 | 15 | 20 | 30 |

  配るのは `recordClearOnce` の中の `awardClearPsyche` 1か所だけ。
  `recordClearOnce` はチャレンジ・クイックの両方が通る「クリアを1周回に1回だけ記録する」入口で、
  `clearRecordedRef` が二重付与を止める。敗北・リタイア・スキップチケットはこの関数を通らない。
- マーケットでは売らない（`shop:false`）。獲得数はリザルトの `psycheGain` に出す。

回帰確認: `node tools/breakthrough-item-check.js`

### ★の段階

5凸で1段階が完成し、次の段階では**1個ずつ新しい色へ置き換わる**。並びは新しい色が先頭。

| 段階 | 色 | 凸数 |
|---|---|---|
| 1 | 青 | 1〜5 |
| 2 | 黄色 | 6〜10 |
| 3 | ピンク | 11〜15 |
| 4 | 紫 | 16〜20 |
| 5 | 赤 | 21〜25 |
| 6 | 金 | 26〜30 |
| 最終 | 虹 | 31 |

例: `1凸=青★1` / `5凸=青★5` / `6凸=黄色★1+青★4` / `11凸=ピンク★1+黄色★4` /
`26凸=金★1+赤★4` / `30凸=金★5` / `31凸=虹★5`。
1段階目（青）だけは前の色が無いので、5個に満たないまま凸数ぶんだけ出す。

- 「黄色」と「金」を見分けられるよう、黄色は光沢無しの素の黄色（`#fde047`）、
  金は一段濃い金色（`#f5c04a`）に上が明るく下が暗い金属的な縁取りを付ける。
- 虹は5個それぞれを違う色にして、小さくても最終段階だと分かるようにする。常時アニメーションは使わない。
- 旧仕様で31回を超えて進めていた個体（上限Lv.185〜195）も虹★5で表示し、
  次の限界突破でLv.200へ入れる。既存の保存値は書き換えない。

★を描くのは `RebirthStars` の1か所だけで、マスモン詳細・一覧カード・編成・放牧・限界突破/転生画面・
HOMEの放牧マスモン・ランキングの詳細まで、すべて同じ実装を通る。限界突破の演出も同じ色を使う。

回帰確認: `node tools/breakthrough-star-check.js`



## 8. 神殿の再生と寄付報酬

- 再生は解放済みベースモンから新規マスモンを作る。専用保存値 `mh_temple_regeneration_used_v1` が未設定の初回だけ無料で、以降は100ダイヤ。
- 再生個体は `individualStats` にライフ・ちから・丈夫さ・ガッツの固有基礎値を保存する。各値はベース基礎値へ独立な0.90～1.10倍を掛けて四捨五入し、既存個体や間合い適性には適用しない。
- 寄付では従来どおり累計絆XPと同数のダイヤに加え、`floor(絆Lv / 5)` 個の虹のプシュケーを `mh_owned_items.rainbow_psyche` へ加算する。

## 9. 染色

「染色もどき」を1個消費し、種ごとに定義された部位数の色を保存する。プリセット色IDまたは `custom:<色相>:<彩度%>:<明度%>` を使い、少なくとも1部位の有効色が必要。画像をCanvasで解析した部位マスクと色変換キャッシュで描画する。マスク境界、除外領域、平滑化、フォールバックは `game-system.jsx` の `MASU_COLOR_*` 定義が正本である。

## 10. 変更時の確認

- 種・特性・固有技: `monster-hero/data/ally-monsters.js` と `monster-hero/src/game-system.jsx`
- 画像: `monster-hero/data/images/images-ally.js`
- 育成・融合・染色: `mergeMasuIntoMon`、`reconcileMasuPoints`、`executeMasuFusion`、`useDyeItem`
- 総合力: `monsterPowerOf` / `masuPowerOf` / `applyEnhancePlanToMasu`（`game-system.jsx` のモジュール直下）
- モンスター詳細のマスターUI: `renderMonsterDetailModal` / `renderMonsterSummaryHeader` / `renderMonsterDetailInfo`
- 一覧カードのマスターUI: `renderMonsterCardBody`
- 合体詳細: `renderFusionSection` / `renderFusionDetailModal` / `normalizeFusionHistory`
- ランキングの記録形: `RANKING_DETAIL_VERSION` / `rankingMasuDetail` / `rankingDetailToMasu`
- 絆Lvランキングへ送る値: `submitLocalScore` / `postRunMasuMonsRef` / `runHeroBondLevelRef`
- 限界突破の★とレベル上限: `breakthroughStars` / `BREAKTHROUGH_STAR_TIERS` / `BREAKTHROUGH_FINAL_LEVEL_CAP` / `buildMasuBreakthrough`
- 限界突破に使うアイテム: `BREAKTHROUGH_ITEM_ID` / `breakthroughItemCost` / `CLEAR_PSYCHE_REWARD` / `awardClearPsyche`
- 回帰確認: `node tools/monster-power-check.js`、`node tools/monster-detail-unified-check.js`、`node tools/fusion-detail-check.js`、`node tools/ranking-monster-detail-check.js`、`node tools/bond-ranking-submit-check.js`、`node tools/breakthrough-star-check.js`、`node tools/breakthrough-item-check.js`、`node tools/bulk-enhance-check.js`、`node tools/dye-report.js`、`node tools/battle-check.js`
