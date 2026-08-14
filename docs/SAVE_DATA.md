# セーブデータ設計書

## 1. 保存層

`storeGet` / `storeSet` が保存の唯一の共通入口である。優先順位は次のとおり。

1. `window.storage` があれば JSON 文字列で読み書きする。
2. なければブラウザ `localStorage` を使う。
3. どちらも使えなければ `_memStore` に保存する。この場合は再読み込みで消える。

全呼び出しは `shared=false` であり、共有ストレージ利用は現行コードにない。書き込み失敗は基本的に握りつぶされ、利用者へ永続化失敗を通知する仕組みは**未確認**。

## 2. キー一覧

| キー | 値・既定値 | 用途 |
| --- | --- | --- |
| `mh_se_volume` | number / `1` | SE音量0～100 |
| `mh_bgm_volume` | number / `1` | BGM音量0～100 |
| `mh_breeder_name` | string / `名無しのブリーダー` | 表示名（保存時最大10文字） |
| `mh_breeder_icon` | string or null | 種IDまたは購入アイコンID |
| `mh_breeder_xp` | number / `0` | 累計ブリーダーXP |
| `mh_gold` | number / `0` | ゴールド（UI上のダイヤ表記を含む） |
| `mh_breeder_points` | number / `0` | 未使用マーケットポイント |
| `mh_breeder_points_granted` | number or null | 累計付与済み相当数 |
| `mh_market_icons` | string[] / `[]` | 購入アイコンID |
| `mh_owned_items` | object / `{}` | 消耗品ID→個数 |
| `mh_unlocked_monsters` | string[] / 初期8種 | 解放済み種ID |
| `mh_monster_roster` | string[] / 解放済み一覧 | 候補編成。種IDまたは `masu:<id>` |
| `mh_unlocked_teachings` | string[] / 初期6枚 | 解放済み教えID |
| `mh_teaching_roster` | string[] / 解放済み一覧 | 教え候補編成 |
| `mh_masu_mons` | object[] / `[]` | マスモン個体一覧。`uniqueSkillPoints`（未使用の固有技ポイント）は後から足した項目で、持っていない既存データは0として読む |
| `mh_changelog_seen` | string / `''` | 最後に既読にした更新日時 |
| `mh_onboarded` | boolean or null | 初回プロフィール誘導完了 |
| `mh_hs_<難易度>` | number / `0` | 端末ハイスコア（チャレンジ） |
| `mh_attempts_<難易度>` | number / `0` | 挑戦回数 |
| `mh_clears_<難易度>` | number / `0` | 完走回数（チャレンジ） |
| `mh_highest_wave_<難易度>` | number / `0` | 最高到達WAVE（チャレンジ） |
| `mh_quick_hs_<難易度>` | number / `0` | 端末ハイスコア（クイック） |
| `mh_quick_clears_<難易度>` | number / `0` | 完走回数（クイック） |
| `mh_quick_highest_wave_<難易度>` | number / `0` | 最高到達WAVE（クイック） |
| `mh_pro_hs_<難易度>` | number / `0` | 端末ハイスコア（プロ） |
| `mh_pro_clears_<難易度>` | number / `0` | 完走回数（プロ） |
| `mh_pro_highest_wave_<難易度>` | number / `0` | 最高到達WAVE（プロ） |
| `mh_rank_<難易度>` | object[] / `[]` | 全国送信失敗時の端末ランキング |

難易度部分は `Beginner`, `Easy`, `Normal`, `Hard`, `Expert`, `Master`, `GrandMaster`, `Hell`, `Legend`。難易度キーは保存・ランキング識別子なので既存名を変更しない。

バトルモードごとの記録は接頭辞で分ける（`modeKeyPrefix`：チャレンジ `mh_`／クイック `mh_quick_`／プロ `mh_pro_`）。モードを増やしても既存キーの意味は変えず、新しい接頭辞のキーを足すだけにする。未プレイのモードのキーは存在しないので、読み込みは既定値 `0` に落ちる。

全国ランキング（Supabase）はテーブルの列を増やさず、`difficulty` へ入れる値でモードを分ける。プロは `ProHard` のように先頭へ `Pro` を付けた値（`rankingDifficultyForMode`）。既存のチャレンジの行（`Hard` など）は書き換えも変換もしない。

## 3. マイグレーション・補正フラグ

| キー | 処理 |
| --- | --- |
| `mh_masu_migrated` | false時、旧種別絆データからマスモンを一度だけ生成 |
| `mh_points_migrated` | false時、現ブリーダーLv-1相当ポイントを遡及付与 |
| `mh_points_base_granted` | false時、全プレイヤーへ初期1ポイントを一度付与 |
| `mh_breeder_points_granted` | XPカーブ緩和後の不足ポイント補填と二重付与防止 |
| `mh_masu_rebirth_full_reset_migrated_v1` | 旧仕様で転生済みの個体をLv1・未使用強化ポイント5へ一度だけ補正 |
| `mh_masu_baseline_relative_migrated_v1` | 第6Cの基礎値追従形式への安全移行を記録。trueでも未移行個体を再診断する |

旧形式として `mh_bond_xp`（種ID→XP）、`mh_dist_apt_points`（種ID→未使用点）、`mh_dist_apt_overrides`（種ID→適性配列）を読み込む。XPが正の既知種だけ `masu_migrated_<種ID>` として追加する。旧キーは削除しない。

さらに起動時、各マスモンの現在絆Lvから得られるはずの総点と、使用済み＋未使用点を比較し、不足分を補う。過剰分を減らす処理はない。

`mh_onboarded` が存在しない場合、名前が既定値でない、XPが正、またはいずれかのハイスコアが正なら既存利用者としてtrueにする。

## 4. マスモン形式

必須または新規生成時のフィールドは `id`, `baseId`, `name`, `bondXp`, `distAptPoints`, `distApt[4]`,
`statPoints.{hp,atk,def,guts}`, `createdAt`。任意で次を持つ。

- `colors`: 部位別色ID。旧 `color` は読み取り互換あり。
- `fusionHistory[]`: `{subName, subBaseId, subBondLevel, xpGained, inherited, timestamp}`。
- `inheritedUniques[]`: 副の固有技データ、`sourceMasuName`、継承技1件ごとの永久一意な `inheritedUniqueId`。`lineageId` は血統・継承元情報として別に保持する。
- `uniqueSkillLevels`: 自前技は `own`、継承技は `inhId:<inheritedUniqueId>` が恒久Lvの正本。旧 `inh:0`, `inh:1` … は互換用に削除せず残す。
- `fusionBondLevels`: 合体XPによるレベル上昇数。ロード時の強化ポイント不足補填から除外するための累計値。
- `reincarnateBonusPoints`: その個体自身が転生で実際に獲得した強化ポイント累計。欠損する旧個体だけ `reincarnateCount × 10` で補完し、保存値があれば回数から再計算しない。
- `inheritedReincarnateBonusPoints`: 合体で受け継いだ転生由来の強化ポイント累計。欠損時は0。
- `inheritedReincarnateCount`: 合体で受け継いだ転生育成の表示用回数分。自身の転生回数・条件判定には使わず、欠損時は0。
- `individualStatOffsets`: 第3段階以降に新規再生した個体が持つ `{hp,atk,def,guts}`。同時に保存する `individualStats` と生成時点の種基礎値との差で、最新の種基礎値へ加算して解決する。存在時は `individualStats` より優先する。
- `distAptBoosts`: 第3段階以降に新規登録・新規再生した個体が持つ、零・近・中・遠の順の上昇段階数。生成直後は `[0,0,0,0]` で、最新の種適性へ加え、上限Mで解決する。互換用の完成値 `distApt` も併記・同期する。

第3段階では新規生成個体から新旧形式の併記を開始した。既存 `mh_masu_mons` は未移行であり、ロード時の一括書換えや新フィールドの自動追加は行わない。旧フィールドの `individualStats` と `distApt` も削除せず、欠損は正常な旧データとして扱う。したがって基礎値追従化はまだ完了していない。

継承固有技Lvについては別の構造ベース移行を起動時に行う。`inheritedUniqueId` または対応する安定Lvキーが欠けた
有効な継承技だけを、現在の配列順と旧 `inh:N` を対応させて補完する。専用トップレベルフラグは持たず、2回目は変更せず、
古いバックアップを復元すれば同じ規則で再移行する。解決順は安定IDキー、旧 `inh:N`、`evoLevel` の順である。
配列は表示順にすぎず、ID移行後の本人確認には使わない。継承技削除UI・削除処理・返却処理は未実装である。

第4段階では純粋なドライラン診断だけを追加した。`diagnoseMasuBaselineMigration` は候補と保全検査を返し、一覧版は3分類を集計するが、いずれも保存処理や起動処理から呼ばれない。**第4段階：既存個体の移行可否をドライラン診断可能。実データは未移行。** `mh_masu_mons`、旧個体の各フィールド、移行完了フラグは一切変更しない。

第6Cでは起動時診断が個体全体を `SAFE_EXACT` と確定した場合だけ実移行し、`individualStatOffsets` /
`distAptBoosts` を追加する。`individualStats`、`distApt` とその他の既存フィールドは削除・変更しない。能力は確定した
生成時ベースとの個体差と `statPoints` を維持したまま最新ベースへ追従するため、旧ベース由来個体では基礎値変更分だけ
移行前から変化し、総合力も移行後の能力・4距離適性・固有技Lv等から現行式で再計算される。

保存直前に個体差、能力変化量、4距離適性、ポイント、既存フィールド、総合力を検証し、候補の再診断が
`ALREADY_MODERN` になることまで確認する。少しでも不整合なら元個体をそのまま残す。専用キーは
`mh_masu_baseline_relative_migrated_v1` で、trueでも前回保留個体を再診断する。`PARTIAL` / `AMBIGUOUS` /
`BLOCKED` は推測移行せず完全に未変更とする。

旧形式のゴーレムは、歴代ベース適性の差から実際の間合い適性への投入段階数を一意に復元できないため、
ポイント不足補填でも現在ベースとの差を推測しない。`statPoints`、`distAptPoints`、`distApt` をそのまま保留し、
`distAptBoosts` を持つ新形式のゴーレムだけを通常の不足補填対象とする。

明示的な `schemaVersion` は存在しない。未知フィールドはオブジェクトスプレッドにより多くの更新で維持されるが、全経路での保証は**未確認**。

## 5. ラン中データと保存タイミング

HP、ガッツ、現在WAVE、手札、山札、バフ、技強化、スコア等のラン中stateは保存しない。再読み込みによるラン再開機能はない。

永続データは操作単位で即時保存する。主なタイミングは名前・アイコン・音量変更、購入、編成確定、個体育成・改名・削除・融合、ラン終了報酬、挑戦開始、完走、スコア更新。React state更新と `storeSet` はトランザクションではなく、複数キーをまとめて原子的に更新する仕組みは**未確認**。

## 6. バックアップと復元

プロフィールの手動バックアップは、`localStorage` 内の `mh_` で始まる全キーについて「保存済みの生文字列」をオブジェクトにし、JSON→UTF-8互換変換→Base64化する。復元はBase64を逆変換し、`mh_` キーが1つ以上あれば各値をそのまま `localStorage` へ書き、再読み込みする。

注意事項:

- `window.storage` やメモリフォールバックの内容は書き出さず、`localStorage` 専用。
- 署名、暗号化、チェックサム、スキーマ検証、値型検証はない。
- 復元は既存の `mh_` キーを全消去せず、コードに含まれるキーだけ上書きする。
- バックアップコードには進行データと表示名が含まれるため、公開場所へ貼らない。

## 7. ランキングデータ

Supabaseへ `{difficulty, user_name, hero, party, score, level, icon, clear_id}` の全項目を、全難易度共通の経路から1回だけ送る。`difficulty`は表示名ではなく既存の難易度keyへ正規化し、取得時は過去行の大文字小文字の揺れを含む完全一致で検索する。`clear_id`は送信の冪等化だけに使い、取得・表示のフィルターには使わないため、`clear_id=NULL`の旧記録も表示対象となる。全国保存の成否は端末内フォールバックと別に保持する。全国保存失敗時は `mh_rank_<難易度>` へ `{userName, hero, party, score, diff, level, icon, clearId, at, nationalSaved, nationalError}` を追加し、HTTP status・PostgREST code・response bodyを診断可能にしたうえで、スコア上位50件と名前ごとの最新1件を保持する。

`party` は各枠の `{name, emoji, imgUrl, bondLevel}`。個体名ではなく種名を送る。全国側の保持期間、RLS、重複排除制約、削除方針はリポジトリからは**未確認**。

## 8. 互換性ルール

- キー名、難易度ID、種ID、教えID、アイテムIDを表示文言の都合で変更しない。
- 新形式導入時は既存値の既定値補完と一度限りの移行フラグを用意する。
- `mh_masu_mons` は利用者の育成資産であり、破壊的再生成をしない。
- 保存変更時はバックアップ往復、旧キー移行、起動、購入・報酬、ランキングフォールバックを確認する。
