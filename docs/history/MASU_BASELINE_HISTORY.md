# マスモン生成時ベース値の履歴監査（第6A段階）

## 1. 結論

第6A段階では完全履歴の取得を再試行したが、**完全 Git 履歴は取得できなかった**。作業開始時の
checkout は shallow clone（`git rev-parse --is-shallow-repository` が `true`）で remote は未設定だった。
remote 設定を変更せず、公開リポジトリ URL を直接指定して次を実行したが、実行環境の outbound proxy が
GitHub への CONNECT を HTTP 403 で拒否した。

```text
git fetch --unshallow https://github.com/aknkakykhk-maker/monhero.git \
  '+refs/heads/*:refs/remotes/audit/*' '+refs/tags/*:refs/tags/*'
```

GitHub REST API、raw.githubusercontent.com、GitHub Pages に対する HTTPS 取得も同じ 403 で失敗し、
GitHub Actions / Pages deployment 履歴も取得できなかった。したがって本書は、取得済み Git オブジェクトで
再監査できた事実と、取得不能な範囲を明確に分ける。**2026-08-10 以前を推測で補完せず、全期間監査完了、
全旧個体 SAFE、第6B段階へ進行可能とは判定しない。**

## 2. 調査範囲と方法

### 2.1 取得できた範囲

- ローカルに存在する最古のスナップショットは shallow 境界 `3325cfc`（commit 時刻
  `2026-08-10T19:56:52+09:00`、PR #486 の merge commit）である。
- main 相当の連続した履歴として走査できる最古は shallow 境界 `6f3764b`
  （`2026-08-11T03:20:43+09:00`、PR #491 の merge commit）である。
- `.git/shallow` には `21a2026`, `3325cfc`, `4a36b9d`, `6f3764b` の 4 境界があり、いずれも親 commit を
  ローカルでは参照できない。従って最古スナップショットより前の変更経緯や、4 系統が合流する前の連続性はない。
- 作業基準 HEAD は `d540679`（PR #579 merge）である。remote がないため最新 main との照合はできていない。

### 2.2 再監査方法

取得済み全 commit を対象に、次を組み合わせて確認した。

1. `git log --all --follow`、`git log -S`、`git log -G` で
   `baseHp/baseAtk/baseDef/baseGuts/distAptitude` と `ALL_PLAYER_MONSTERS` を検索。
2. 各 main 相当スナップショットに存在する `.js` / `.jsx` / `.html` を走査し、現行
   `monster-hero/data/ally-monsters.js` だけでなく、分割前の `game-system.jsx`、生成済み JS、単一 HTML、
   別 data ファイル、削除・改名候補を比較。
3. モンスターの新規追加は「既存モンスターの値変更」と分け、同一 ID が前後のスナップショットにある場合だけ
   変更前後として集計。
4. `masu_`, `masu_regenerated_`, `masu_migrated_`, `individualStats`, `individualStatOffsets`,
   `distApt`, `distAptBoosts`, `createdAt` の導入・更新経路を `git log -S` とコードで確認。
5. commit / merge 時刻、`BUILD_DATE`、`version.json`、changelog、Pages workflow 定義を比較。

この方法は取得済み範囲内ではファイル分割・改名をまたいで監査できるが、取得できていない親 commit や削除済み
blob の不存在を証明するものではない。

## 3. 基礎値・距離適性の変更履歴

| モンスター | 変更項目 | 変更前 | 変更後 | コミット | 時期 | 信頼度 | 備考 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| ピクシー (`Pixie`) | `baseGuts` | 140 | 170 | 実変更 `bc40d5e`; main merge `33ace5e` | BUILD_DATE / version / changelog `2026-08-14 10:24` JST; commit `10:26:46`; merge `10:26:57` | UNCERTAIN | 値変更は確定。公開完了・端末反映時刻は不明 |
| ミタラシ (`Mitarashi`) | `baseHp` | 600 | 630 | 実変更 `bc40d5e`; main merge `33ace5e` | 同上 | UNCERTAIN | 同一リリースの調整 |
| ミタラシ (`Mitarashi`) | `baseAtk` | 120 | 140 | 実変更 `bc40d5e`; main merge `33ace5e` | 同上 | UNCERTAIN | 同一リリースの調整 |
| ミタラシ (`Mitarashi`) | `baseDef` | 120 | 105 | 実変更 `bc40d5e`; main merge `33ace5e` | 同上 | UNCERTAIN | 同一リリースの調整 |
| ミタラシ (`Mitarashi`) | `baseGuts` | 100 | 90 | 実変更 `bc40d5e`; main merge `33ace5e` | 同上 | UNCERTAIN | 同一リリースの調整 |
| 全モンスター（未取得範囲） | `baseHp`, `baseAtk`, `baseDef`, `baseGuts`, `distAptitude` | 不明 | 最古スナップショットの値は取得済み | shallow 境界より前 | `2026-08-10T19:56:52+09:00` より前 | UNRECOVERABLE | 完全履歴を取得できず、未知の変更件数・旧定義ファイルを断定不能 |

信頼度は、値と変更 commit に加えて利用者への公開境界まで一意なら `EXACT`、値変更は確定しても公開境界が
一意でなければ `UNCERTAIN`、Git オブジェクト不足で値・変更有無を復元できなければ `UNRECOVERABLE` とする。
表の集計は `EXACT` 0 行、`UNCERTAIN` 5 行、監査ギャップ `UNRECOVERABLE` 1 行である。

### 3.1 基礎ステータス

取得済み範囲で検出した既存モンスターの変更は上表の 5 項目だけである。内訳は `baseHp` 1 件、`baseAtk`
1 件、`baseDef` 1 件、`baseGuts` 2 件で、すべてピクシーまたはミタラシである。新モンスター追加時の初期値は
変更に数えていない。**ピクシー・ミタラシ以外は取得済み範囲で 0 件だが、全期間 0 件とは断定しない。**

### 3.2 距離適性

取得済み範囲では、既存モンスターの `distAptitude` 変更は 0 件である。ウンディーネ、ヤオビクニ等の新規定義は
既存値の変更ではない。完全履歴を取得できなかったため、要求された「完全履歴上、既存モンスターの距離適性変更は
0件」という断定はできない。

## 4. 公開境界と `createdAt`

`bc40d5e` のリポジトリ内時系列は、BUILD_DATE / `version.json` / changelog の `2026-08-14 10:24` JST、
実変更 commit の `10:26:46`、main merge の `10:26:57` の順である。workflow は main push 後に check、artifact
upload、Pages deploy を行うが、run/deployment の開始・完了時刻は Git 履歴に含まれず、今回は GitHub API からも
取得できなかった。仮に deployment 完了時刻を取得できても、CDN、PWA、Safari を含むブラウザキャッシュによる
端末反映時刻は一意にならない。

`createdAt` は次の理由で公開境界との自動比較に使えない。

- 通常登録・再生ではクライアントの `Date.now()` であり、端末時計のずれ・変更を検証しない。
- `masu_migrated_<種ID>` では旧種別セーブの生成時ではなく、移行実行時に後付けされる。
- 既存 `mh_masu_mons` のロードは欠損値を補完せず、並び替えも
  `Number(createdAt) || Number(id) || 0` へフォールバックする。
- 合体、限界突破、転生、強化、リセット、染色等は元個体の値または欠損を維持し、操作時刻を記録しない。
- バックアップ復元は値を持ち越すだけで、サーバー時刻による真正性を付与しない。

従って `createdAt` の存在だけで個体を SAFE にせず、公開境界付近の曖昧帯を時刻比較だけで解除しない。

## 5. 保存データから確実に判別できること

| 判別材料 | 確実に分かること | 分からないこと |
| --- | --- | --- |
| `individualStatOffsets` と `distAptBoosts` がともに妥当 | 第3段階以降の新表現を持ち、最新 baseline への追従計算が可能 | フィールドの真正性、端末上での厳密な生成時刻 |
| `masu_regenerated_<時刻>_<乱数>` | コードが発行したものなら再生経路の ID 形式 | IDだけでは旧/新 offset 形式の別、公開版、端末時計の正確さ |
| `masu_migrated_<種ID>` | 旧 `mh_bond_xp` 等からの一度きり移行経路 | 元個体の生成時刻・当時 baseline。`createdAt` は移行時刻 |
| 通常の `masu_<時刻>_<乱数>` | コードが発行したものなら通常登録経路の ID 形式 | 公開版、キャッシュ世代、時刻の真正性 |
| `individualStats` のみ | 旧再生個体の完成 4 能力値を維持できる | 生成時 baseline と正確な offset |
| `distApt` のみ | 旧個体の現在の 4 距離適性を維持できる | 生成時 baseline、投入段階、リセット履歴 |
| フィールド欠損 | 旧形式として許容される可能性 | 欠損だけから導入前のどの版かを一意に特定すること |

`masu_regenerated_` と `masu_migrated_` は取得済み最古境界にも存在し、それより前の導入 commit は取得不能である。
第3段階の新フィールド導入 commit は `individualStatOffsets` の解決が `1effdfd`、新規個体への併記が
`4c5bdc4` で確認できる。新フィールドそのものが A 判定の根拠であり、ID や `createdAt` はその代用にならない。

## 6. 最終分類（変換は行わない）

### A. 新形式なのでそのまま SAFE

`individualStatOffsets` の 4 有限数と `distAptBoosts` の 4 非負整数を持ち、旧完成値表現との一致検査、種 ID、
距離等級、総合力の整合検査をすべて通る個体。最新 baseline へ差分を適用できるため、生成時刻推定は不要である。

### B. 旧形式だが正確なベースを一意に復元可能

個体自身に信頼できる版/baseline snapshot がある、または別の検証済み証拠で生成時に端末へ配信されていた版を
一意に特定でき、その版の完全履歴上の baseline を取得できる個体。**現行の旧保存フィールド、ID、`createdAt`
だけで B に確定できる条件は見つからなかった。**

### C. 現在値維持はできるが生成時ベース不明

妥当な `individualStats` または `distApt` により現在の完成値は読める一方、生成時 baseline、投入段階、公開版を
一意に復元できない旧個体。現在値を維持する読み込みは可能だが、推測した offset / boost を保存してはならない。

### D. 自動移行禁止

値・配列・種 ID が不正、旧完成値と候補差分が不一致、距離適性が baseline より低く投入段階として表現不能、
ポイント総数や上限 M と矛盾、由来不明、または完全履歴・公開境界不足により B を証明できない個体。
`masu_migrated_*`、`createdAt` 欠損/非数値、境界付近、端末時計を信頼できない個体は、他の確実な証拠がない限り
D として自動変換しない。C は読み込み時の現状維持分類であり、自動変換可を意味しない。

## 7. offset / boost 化できる範囲と第6B判定

- **旧再生個体の offset 化:** A は既に offset を持つため変換不要。B の条件を満たす個体だけ
  `individualStats - generationBaseline` を計算し、4 能力と総合力の不変を検証できる。現行フィールドだけで
  B と証明できる旧個体はなく、旧再生個体の一括 offset 化はできない。
- **旧距離適性の boost 化:** B の条件に加え、生成時の 4 baseline、保存 `distApt`、投入/未使用ポイント、
  リセット・転生履歴、上限 M の整合を一意に証明できる個体だけ変換候補になり得る。取得済み範囲の変更 0 件を
  未取得期間へ外挿できないため、旧個体の一括 boost 化はできない。
- **自動移行禁止:** C/D、`masu_migrated_*`、旧版を一意に識別できない ID、`createdAt` だけを根拠にする個体、
  未取得期間または公開曖昧帯に属し得る個体は引き続き禁止する。

以上から、**完全履歴を取得して本表を再監査するまで第6B段階へは進めない**。完全履歴取得後も Pages/PWA の
端末反映境界が一意でなければ、時刻推定ではなく A または確実に証明できる B の allowlist だけを対象とする。

## 8. 今回の非変更範囲

第6A段階ではこの監査文書だけを更新した。`mh_masu_mons`、ゲームロジック、保存形式、自動マイグレーション、UI、
バランス、`monster-hero/data/changelog.js`、`monster-hero/data/help.js` は変更していない。
