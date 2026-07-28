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
| `mh_masu_mons` | object[] / `[]` | マスモン個体一覧 |
| `mh_changelog_seen` | string / `''` | 最後に既読にした更新日時 |
| `mh_onboarded` | boolean or null | 初回プロフィール誘導完了 |
| `mh_hs_<難易度>` | number / `0` | 端末ハイスコア |
| `mh_attempts_<難易度>` | number / `0` | 挑戦回数 |
| `mh_clears_<難易度>` | number / `0` | 完走回数 |
| `mh_rank_<難易度>` | object[] / `[]` | 全国送信失敗時の端末ランキング |

難易度部分は `Beginner`, `Easy`, `Normal`, `Hard`, `Expert`, `Master`, `GrandMaster`, `Hell`, `Legend`。難易度キーは保存・ランキング識別子なので既存名を変更しない。

## 3. マイグレーション・補正フラグ

| キー | 処理 |
| --- | --- |
| `mh_masu_migrated` | false時、旧種別絆データからマスモンを一度だけ生成 |
| `mh_points_migrated` | false時、現ブリーダーLv-1相当ポイントを遡及付与 |
| `mh_points_base_granted` | false時、全プレイヤーへ初期1ポイントを一度付与 |
| `mh_breeder_points_granted` | XPカーブ緩和後の不足ポイント補填と二重付与防止 |

旧形式として `mh_bond_xp`（種ID→XP）、`mh_dist_apt_points`（種ID→未使用点）、`mh_dist_apt_overrides`（種ID→適性配列）を読み込む。XPが正の既知種だけ `masu_migrated_<種ID>` として追加する。旧キーは削除しない。

さらに起動時、各マスモンの現在絆Lvから得られるはずの総点と、使用済み＋未使用点を比較し、不足分を補う。過剰分を減らす処理はない。

`mh_onboarded` が存在しない場合、名前が既定値でない、XPが正、またはいずれかのハイスコアが正なら既存利用者としてtrueにする。

## 4. マスモン形式

必須または新規生成時のフィールドは `id`, `baseId`, `name`, `bondXp`, `distAptPoints`, `distApt[4]`,
`statPoints.{hp,atk,def,guts}`, `createdAt`。任意で次を持つ。

- `colors`: 部位別色ID。旧 `color` は読み取り互換あり。
- `fusionHistory[]`: `{subName, subBaseId, subBondLevel, xpGained, inherited, timestamp}`。
- `inheritedUniques[]`: 副の固有技データと `sourceMasuName`。

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

Supabaseへ `{difficulty, user_name, hero, party, score, level, icon}` を送る。列互換のため level/iconを順に省いた4形式で再試行する。失敗時は `mh_rank_<難易度>` へ `{userName, hero, party, score, diff, level, icon, at}` を追加し、スコア上位50件と名前ごとの最新1件を保持する。

`party` は各枠の `{name, emoji, imgUrl, bondLevel}`。個体名ではなく種名を送る。全国側の保持期間、RLS、重複排除制約、削除方針はリポジトリからは**未確認**。

## 8. 互換性ルール

- キー名、難易度ID、種ID、教えID、アイテムIDを表示文言の都合で変更しない。
- 新形式導入時は既存値の既定値補完と一度限りの移行フラグを用意する。
- `mh_masu_mons` は利用者の育成資産であり、破壊的再生成をしない。
- 保存変更時はバックアップ往復、旧キー移行、起動、購入・報酬、ランキングフォールバックを確認する。

