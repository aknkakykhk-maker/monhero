# docs/refactor/ — 技術監査と基盤改善計画

2026-09-05 に `main` 9f9cfa0 を対象に行った全体監査の成果物。**コードは変更していない**(PHASE 1)。
新しいセッションで基盤改善を続けるときは、この順で読む。

| 文書 | 中身 | いつ読むか |
| --- | --- | --- |
| [`CURRENT_ARCHITECTURE.md`](CURRENT_ARCHITECTURE.md) | いまの構成(ファイル・行番号の地図、画面、保存、バトル、音声、音ゲー、検査、依存の向き)、actual / spec の差 | 最初。STEP 完了ごとに更新する |
| [`TECH_DEBT_AUDIT.md`](TECH_DEBT_AUDIT.md) | 負債 30 件(TD-01〜TD-30)と優先度、根拠の行番号、良い点 | 何を直すか決めるとき |
| [`REGRESSION_RISK_MAP.md`](REGRESSION_RISK_MAP.md) | 領域ごとの危険度、壊れ方、拾う検査、検査の穴、触らない領域 | **変更に着手する前に必ず** |
| [`TARGET_ARCHITECTURE.md`](TARGET_ARCHITECTURE.md) | 目指す形(連結ビルドで複数ファイル、保存はキーごとの更新関数、1 画面 1 コンポーネント、画面単位のライフサイクル) | 設計に迷ったとき |
| [`REFACTOR_MASTER_PLAN.md`](REFACTOR_MASTER_PLAN.md) | STEP 0〜10 の明細(目的・対象・変更内容・変更しないもの・依存・リスク・検査・完了条件)と着手順 | 次にやる PR を決めるとき |
| [`BATTLE_DAMAGE_MAP.md`](BATTLE_DAMAGE_MAP.md) | 予測ダメージと実ダメージの分岐の対応表と、一本化の形(STEP 5 の作業表) | STEP 5 に着手するとき |
| [`SCREEN_EFFECTS_MAP.md`](SCREEN_EFFECTS_MAP.md) | `setTimeout` 62 箇所を「画面専用 / 進行 / 対象外」に仕分けた表(STEP 6 の作業表)。移すときはここから引く | STEP 6 の画面切り出しに着手するとき |
| [`EXECUTION_PLAN.md`](EXECUTION_PLAN.md) | STEP ごとの担当モデル(Sonnet 5 / Opus 5)と effort、切り出し順、コピペ用の指示文 | **新しいチャットを始めるとき** |
| [`BASELINE_2026-09.md`](BASELINE_2026-09.md) | 変更前に全検査を回した結果(OK / NG の一覧と分類)。ここに無い NG が出たら「その変更で壊した」 | 検査が落ちたとき |

## 進捗

| STEP | 状態 | 備考 |
| --- | --- | --- |
| PHASE 1 監査 | 完了(2026-09-05) | 本フォルダ |
| STEP 0 文書同期 | 完了(2026-09-06) | D-01〜D-05・D-07 を解消。監査時点(9f9cfa0)以降に main は #1113 まで進み、モンビーの公開曲は 11 曲になっている |
| STEP 1 安全網 | 着手中 | 1本目: 一括検査スクリプト `tools/run-checks.js` とベースライン(完了) / 2本目: エラー境界 `MhErrorBoundary`(完了) / 3本目: vm スタブ不足 11 本の修正(完了、NG 58 → 51) / 4本目以降: 残る B・C 分類 51 本のトリアージ |
| STEP 2 連結ビルドと集約 | 着手中 | 1本目: 編集元を `src/parts/` に分け、`game-system.jsx` を連結生成物にした(完了) / 2本目: 保存キー一覧を SAVE_DATA.md と突き合わせる検査(完了。49 個の未記載を補った) / 3本目以降: 定数・ユーティリティの集約 |
| STEP 3 保存層 | 着手中 | 1本目: 旧形式セーブの通し検査 `boot/legacy-save-boot-check.js`(完了) / 2本目: `mh_masu_mons` の state 更新と保存が対であることの検査 `masu/masu-save-pairing-check.js`(完了。現状は 35 箇所すべて対で、`saveTranscendFruitPair` のような「storeSet を注入し、読み戻して検証し、失敗なら巻き戻す取引関数」が既にある) / 3本目: 複数キー更新の正本 `saveStoredValuesOrRollback`(書く→読み戻す→食い違えば全部戻す)を置き、既存 2 本を包みにし、神殿の 6 箇所(合体・限界突破・超越・超越交換・転生・再生)を寄せた(完了。`masu/save-transaction-check.js` で固定) / 4本目以降: 残る複数キー更新(複数体合体・寄付・報酬受取)の寄せ、キーごとの読込関数 |
| STEP 4 純関数の切り出し | 着手中 | 1本目: 共有層を節ごとに 21 部品へ分けた(移動のみ。完了) / 2本目: 純粋な部品 7 つを `parts.json` で `pure:true` と宣言し `boot/parts-purity-check.js` で守る(完了) / 3本目以降: 19(難易度)から保存処理を出す、jsx 側の表の移動 |
| STEP 7 描画・キャッシュ | 着手中 | 1本目: 染め直した絵のキャッシュを 96 件の LRU に(完了。dataURL が無制限に溜まらない) / 2本目以降: 一覧行の `React.memo`、静的な `style={{}}` の定数化、CSS 静的化の準備 |
| STEP 5 バトル計算 | 完了 | バトル領域の古い検査 7 本を現在形へ(完了)。分岐の対応表 `BATTLE_DAMAGE_MAP.md`(完了)。1本目: 乱数固定の一致検査 `battle/damage-parity-check.js`(完了。2,560 通り一致) / 2本目: ヒット列を純粋な部品の `buildAttackHits` + `ATTACK_COMBO_RULES` に一本化し、実処理と予測をそこへ差し替え(完了) / 3本目: あつの挑発(`stun_atsu`)も `mainCanCrit:false` で同じ関数へ(完了。旧新を同じ乱数列で 72,000 通り比較して一致)。予測表示の既知差(確定会心時にあつの挑発のメイン 1 発ぶん多く出る)もユーザー指示で解消(完了) |
| STEP 6 画面の切り出し | 着手中 | 1本目: 画面ライフサイクルの登録簿 `useScreenEffects`(`src/parts/40-screen-effects.jsx`)を置いた(完了)。`setTimeout` 62 箇所を1本ずつ読み、**画面専用 16 / 進行 31 / 対象外 15** に仕分けて `SCREEN_EFFECTS_MAP.md` に残した。進行(処理中フラグの戻し・次の画面へ進む・`await` の resolve)を止めると操作不能になるため、種別を宣言してから登録する形にし、書き忘れは「止めない」側へ倒す。`ui/screen-effects-check.js`(登録簿の振る舞いと分類表の突き合わせ)と `ui/screen-effects-browser-check.js`(本物の React での止まりかた)で固定。この本では登録簿を置くだけで、既存のタイマーは1本も移していない(ゲームの挙動は変わらない) / 2本目: `SETTINGS` を `src/parts/51-screen-settings.jsx` へ切り出した(完了)。props は「押されたら何をするか」を MonsterHeroGame 側に残して操作だけを渡す形にそろえた。この画面にタイマーは無いので登録簿はまだ使っていない。切り出し前後で JSX の骨格(要素・className・文言・並び)が完全一致することを機械比較で確かめ、実際に設定画面を開く経路(`boot/screen-error-boundary-check` の 設定→ヘルプ→デバッグ設定)も通した / 3本目: `MISSIONS` を `src/parts/52-screen-missions.jsx` へ切り出した(完了)。受け取り(`claimMission` / `claimMissionsBulk`)は保存とギフト送付を伴うので本体に残し、props で受ける。進捗の読み方(`normalizeMissions` ほか)は共有層の純関数なので画面から直接呼ぶ。タブの赤バッジ `tabCountBadge` はギフトボックスも使う小部品なので共有層(16)へ移した。`boot/mission-gift-badge-check` が本体の関数名を文字列で探していたため、「本体 → 画面の props → ボタン」の結線を見る形へ追随させた(緩めていない) / 4本目: `GIFT_BOX` を `src/parts/53-screen-gift-box.jsx` へ切り出した(完了)。受け取り(`claimGiftIds`)は保存を伴うので本体に残し props で受ける。受取可否・期限・報酬の読み方は共有層(17)の純関数なので画面から直接呼ぶ。3本目で共有層へ移した `tabCountBadge` をそのまま使えた / 5本目: `ITEM_INVENTORY` を `src/parts/54-screen-item-inventory.jsx` へ切り出した(完了)。戻り先がホームではなくプロフィールなので `onBack` で受け、画面は行き先を知らない。「使う」の対象えらびは本体側の別画面なので id を渡すだけ。**ここで STEP 6 共通の落とし穴が出た**: `60-app.jsx` を直接読む検査(12本以上ある)は、見ている画面が切り出された瞬間に対象を見失う。落ちればまだよく、「探す文字列がそもそも無い」形だと静かに対象外になる。`harness.js` に `readAppSource()`(本体＋切り出した画面をつないで返す)を置き、実際に落ちた `masu/soul-rank-step2-check` をそれで直した。**以降の画面で検査が落ちたら、まずこの関数へ差し替える** / 6本目以降: `BREEDER_MARKET` → `PROFILE` → … の順に1画面ずつ |
| STEP 8〜10 | 未着手 | |

## 守ること(要約)

- 既存ゲーム・バランス・演出・UI・URL・`mh_*` キー・ランキング・画像・BGM を変えない。
- 全面書き直し・巨大 1 PR・仕様変更との混在・未使用に見えるコードの無断削除・既存 workflow のトリガー変更をしない。
- 検査を先に足し、落ちた検査を緩めない。本体を触る PR は `required` `ci` に加えて `boot` `battle` `mode` の領域まで回す(`BASELINE_2026-09.md` の教訓)。
- 音ゲーのタイミング基盤・保存の移行順序・ランキングの識別子は構造目的で触らない(`REGRESSION_RISK_MAP.md` §4)。
