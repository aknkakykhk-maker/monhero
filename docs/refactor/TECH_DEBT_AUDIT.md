# 技術的負債の監査結果

調査日: 2026-09-05 / 対象: `main` 9f9cfa0 / 前提: `CURRENT_ARCHITECTURE.md`

優先度の意味:

| 優先度 | 基準 |
| --- | --- |
| **Critical** | 既存プレイヤーのデータや進行を壊しうる。または、どんな小さな不具合でもゲーム全体を止める構造になっている |
| **High** | 新機能を足すたびに回帰を起こしやすい。iPhone での安定性・性能に直結する。修正範囲を毎回広げている |
| **Medium** | 理解・変更コストを上げているが、直ちに不具合にはならない |
| **Low** | 整理すれば楽になるが、放置しても害が小さい |

「対応 STEP」は `REFACTOR_MASTER_PLAN.md` の番号。既知課題(`docs/KNOWN_ISSUES.md` の KI-*)と重なるものは併記する。

## 一覧

| ID | 優先度 | 区分 | 題名 | 対応 STEP |
| --- | --- | --- | --- | --- |
| TD-01 | Critical | エラー耐性 | React のエラー境界が無く、描画中の例外1つで全画面が真っ白になる | **対応済み**(2026-09-06 `MhErrorBoundary`。`boot/screen-error-boundary-check.js`) |
| TD-02 | Critical | セーブ | 同じ保存キーを書く場所が分散し、state と storage を呼び出し側が手で同期している | 3 |
| TD-03 | Critical | 基盤 | data 配下のファイルが `React.createElement` / `window.fetch` を実行時に上書きしている | 9 |
| TD-04 | High | 構造 | `MonsterHeroGame` が 14,723 行・`useState` 417 個の単一コンポーネント | 6, 7 |
| TD-05 | High | 構造 | 本体が export の無い 25,638 行の1ファイルで、検査は識別子名に依存して中身を抜き出している | 2, 4 |
| TD-06 | High | バトル | 与ダメージの「予測表示」と「実処理」が別実装で、勇者・固有技の分岐を二重に持つ | 5 |
| TD-07 | High | ライフサイクル | `MonsterHeroGame` 内の `setTimeout` 58 に対し `clearTimeout` 13。画面を離れても残る演出タイマー | 6 |
| TD-08 | High | 音ゲー | `rhythm-mode.js` 8,624 行のうち 5,916 行が譜面データで、ロジックと同居している | 9 |
| TD-09 | High | 性能 | 音ゲーのランタイムパッチが document 全体に capture リスナーと `MutationObserver(body, subtree)` を常駐させる | 9 |
| TD-10 | High | 性能 | 染色キャッシュ(`_dyeRecolorCache` / `_dyeRegionMaskCache`)に上限も破棄も無い | 7 |
| TD-11 | High | データ分離 | 勇者・モンスター固有の挙動が `mainHero?.id==='X'` の文字列分岐としてロジック中に散在(28 箇所) | 5 |
| TD-12 | High | 検査 | 検査 326 本のうち CI は 28 本。一括実行の入口が無く、84 本はソース文言への正規表現で壊れやすい | 1 |
| TD-13 | High | 性能/運用 | Tailwind を CDN から実行時生成(KI-001)。CSS が `index.html` 617 行と `createAnimationStyle` 547 行の2系統 | 7 |
| TD-14 | High | セーブ | `storeSet` が失敗を握りつぶす。`localStorage` 直接アクセスが 4 系統に残る | 3 |
| TD-15 | Medium | データ分離 | ゲームデータの半分が jsx 側(難易度・モード・BGM・ミッション・ログインボーナス等)にあり、`data/` と二分されている | 4 |
| TD-16 | Medium | 定数 | 難易度 ID 列が jsx と tools 3 ファイルに複製。`RHYTHM_SETTINGS_KEY` が jsx と rhythm-mode で二重定義 | 2(保存キーの一覧は `boot/save-keys-check.js` で文書と突き合わせるようにした。集約そのものは STEP 3 で扱う) |
| TD-17 | Medium | 重複 | clamp が 6 種(`rpgClamp`, `rhythmClamp01`, `_clampColorAlpha`, `clampSkipCount`, `clampSubLane`, `rpgClampLevel`)、正規化の書き方が関数ごとに異なる | 2 |
| TD-18 | Medium | セーブ | 起動時ロードの `useEffect` が 424 行で、読込・正規化・移行・補償・通知計画が直列に混在 | 3 |
| TD-19 | Medium | 文書 | 文書が実装から乖離(`CURRENT_ARCHITECTURE.md` §16 D-01〜D-05) | **対応済み**(2026-09-06) |
| TD-20 | Medium | 基盤 | `index.html` の `<script>` 順序がグローバル依存の唯一の正本。順序を誤っても構文上は通る | 2(再確認: `undefined-reference-check` が index.html の順に data を実行しており、順序違反は読み込み時例外で拾える。静的な相互参照も 2026-09-06 時点で違反なし。追加の検査は不要と判断) |
| TD-21 | Medium | 構造 | デバッグ 13 画面と RPG デバッグ戦闘エンジン(474 行)が本体に同居し、配信物に含まれる | 10 |
| TD-22 | Medium | 描画 | `style={{…}}` 522 箇所、`key={i}` 37 箇所、`React.memo` 0 | 7 |
| TD-23 | Medium | ライフサイクル | `processTurn`(379 行・17 `await`)の途中で画面が変わったときの中断を、個別ロックだけで守っている | 6 |
| TD-24 | Medium | 運用 | Tone.js CDN に SRI が無い(KI-009) | 8 |
| TD-25 | Medium | 運用 | Supabase の RLS を確認できていない(KI-010)。publishable key はソース埋め込み(仕様どおり) | – |
| TD-26 | Medium | 構造 | `data/assistants.js`(3,600 行)がセリフ・親密度計算・チュートリアル台本・スパム抑制を1ファイルに持つ | 10 |
| TD-27 | Low | 配信 | `data/images/title-screen-clean.PNG`(2.6MB)が未参照のまま配信される | **対応済み**(2026-09-06 に削除) |
| TD-28 | Low | 起動 | `changelog.js` 446KB・`assistants.js` 266KB・`help.js` 256KB を起動時に必ず読む | 10 |
| TD-29 | Low | 文書 | `tools/README.md` が 385 本の一覧で、変更領域→実行すべき検査の対応が分からない | 1 |
| TD-30 | Low | 構造 | `RhythmTapTest` のインデント崩れ(列0 の `const`)がトップレベル定義に見える | 9 |

## 詳細

### TD-01 エラー境界が無い(Critical)

- **事実**: `componentDidCatch` / `getDerivedStateFromError` / `ErrorBoundary` は 0 件。`ReactDOM.createRoot(rootEl).render(<MonsterHeroGame/>)` を直接呼ぶ(25,628〜25,630)。
- **影響**: React 18 では描画中に例外が出るとルートごとアンマウントされ、画面が真っ白になる。過去に実際に「マーケットに入ると進行不能」「`Cannot access before initialization` で真っ白」が起きており、`render-error-check.js` はそれを起動画面で拾うだけで、深い画面は守れない。
- **注意**: セーブは即時保存なのでデータは失われないが、プレイヤーには再読み込み以外の回復手段が無い。
- **方針**: ルート直下と `gameState` 単位の境界を足し、落ちた画面だけ HOME へ戻せるようにする。挙動変更ではなく安全網の追加。

### TD-02 保存書き込みの分散(Critical)

- **事実**: `storeSet('mh_masu_mons', …)` 35 箇所、`mh_owned_items` 19、`mh_gold` 13、`mh_gifts` 4、`mh_breeder_xp` 4。`setMasuMons` 29 回、`setOwnedItems` 21 回。ゴールドを減らしてアイテムを増やす等の複数キー更新は呼び出し側が順に書く。
- **影響**: どこか1箇所で `storeSet` を書き忘れると「画面上は反映されたが再起動で戻る」。逆に `storeSet` だけ書くと state と食い違う。複数キー更新の途中で例外が出ると片方だけ保存される(超越リセットの書はコメントで順序を明記して回避している = 個別対応)。
- **方針**: キーごとの「更新関数」(state 更新と保存を1回で行う)を用意し、35 箇所を機械的にではなく1箇所ずつ置き換える。キー名・形式は変えない。

### TD-03 グローバルの実行時上書き(Critical)

- **事実**: `data/rhythm-result-replay-remount.js` が `React.createElement` を差し替え、全要素生成が `type.name==='RhythmTapTest'` の判定を通る。`data/rhythm-geometry-calibration.js` と `data/rhythm-step3-release.js` が `window.fetch` を二重に包み、`version.json` の応答を書き換える。
- **影響**: (1) 本体の関数名 `RhythmTapTest` をリネーム・分割すると再マウント境界が黙って外れ、iPhone で「もう一度」が壊れる(2026-09-05 に文言依存で実際に起きた種類の壊れ方)。(2) 更新バナーの判定が3層(本体 + 2 パッチ)に分かれ、build の不一致がどこで起きたか追えない。(3) 圧縮された本体では `type.name` が保証されない。
- **理由の確認**: どちらも「data だけの出荷で挙動を足す」ための仕組みで、当時の制約(モバイルから compiled を作れない)に由来する。現在は `build-and-check.yml` で緩和済み。
- **方針**: 本体側で `key` による再マウントを実装し、`version.json` の build 判定を本体1箇所にまとめた上で、パッチを **読み込み順から外す**(ファイル削除は最後)。音ゲーのタイミング基盤には触れない。

### TD-04 単一コンポーネント(High)

- **事実**: 10,359〜25,082 行。state 417、effect 72、JSX 6,201 行を1つの `return (` に並べる。`React.memo` 0。
- **影響**: どの state を触っても全画面ぶんの JSX を再評価する。iPhone での「押したときの引っかかり」の温床。関数の追加位置・参照可能な変数が分かりにくく、`undefined-reference-check` / `render-error-check` が必要になった根本原因。
- **方針**: 一度に分割しない。まず画面ごとの JSX を「描画関数 → 独立コンポーネント」に1画面ずつ移す(STEP 6)。永続 state は STEP 3 の更新関数へ寄せる。

### TD-05 export の無い1ファイル(High)

- **事実**: `tools/harness.js` は Babel 変換後に `EXPORTED_NAMES`(138 個)を末尾へ追記して vm で実行する。静的検査 84 本はソース文字列を正規表現で探す。
- **影響**: 関数名の変更・移動が検査を壊す。逆に検査が「実装の文言」に依存するので、リファクタリングの自由度を奪っている(`DEVELOPMENT.md` にも「画面に出る文字を検査の目印にしない」と反省が残る)。
- **方針**: 分割の前に、共有層(1〜10,358 行)を「本体より先に読む別ファイル」へ切り出せるよう、`index.html` の読み込み順に載せる形を決める(STEP 4)。`harness.js` は複数ファイルを連結して評価できるようにする(STEP 1)。

### TD-06 予測ダメージと実ダメージの二重実装(High)

- **事実**: `getAttackPredictedDmg`(16,313〜)と `processTurn` 内(16,752〜16,790)が、ザン 0.3/0.2・エイキ・パンドラ分割・会心倍率 `1.5+critDmgPct` を別々に書いている。被ダメージ側は `getIncomingDamageBeforeTurnReduction` に一本化済み。
- **影響**: 新モンスターの連撃を足すとき両方へ書く必要があり、片方だけ直すと「予測と実際が違う」。`battle-damage-preview-check.js` が一致を検査しているが、検査があることが二重実装の証拠でもある。
- **方針**: 「1枚のカードが生むヒット列」を返す純関数を1つ作り、予測は `crit=確定` で、実処理は乱数で呼ぶ。数式は変えない。

### TD-07 残るタイマー(High)

- **事実**: `MonsterHeroGame` 内 `setTimeout` 58 / `clearTimeout` 13 / `Ref.current=setTimeout` 2。`wait(ms)` 経由の `await` も 8 箇所。
- **影響**: 演出中に戻る・別画面へ行くと、後から `setState` が走り、古い画面の値が新しい画面へ混ざる(「初回の演奏だけサイドのマスモンが変な場所に出る」#1102 と同じ系統)。
- **方針**: 画面(gameState)に紐づくタイマー登録簿を1つ作り、画面を離れたら全部止める。STEP 6 で画面を切り出すときに同時に載せる。

### TD-08 譜面データとロジックの同居(High)

- **事実**: `rhythm-mode.js` 1,577〜7,493 行が `t()/h()/f()/s()` 呼び出しの譜面。公開 7 曲 × 5 難易度 + テスト曲。同じ内容の正式候補 JSON が `monster-hero/debug/*.json`(6.6MB)にもある。
- **影響**: 譜面を1曲足すたびに 618KB のロジックファイルが変わり、diff から判定ロジックの変更が見えなくなる。CI の音ゲー検査 21 本はこのファイル全体を読む。
- **方針**: 譜面を曲ごとのファイルへ分け、`RHYTHM_SONG_ENTRIES` は参照だけにする。**判定・投影・タイミングの関数は一切触らない**。

### TD-09 常駐するランタイムパッチ(High)

- **事実**: `document.addEventListener('touchstart'…, {capture:true})` ×8 以上、`MutationObserver(document.body,{childList:true,subtree:true})` ×5(rhythm-mode 3、lane-svg、geometry-calibration、authoring)。いずれも解除されず、音ゲー以外の画面でも動く。
- **影響**: バトル画面の DOM 更新(ポップアップ・カード)ごとに Observer コールバックが走る。早期 return はあるが、`addedNodes` ごとに `matches`/`querySelector` を呼ぶ実装もあり、iPhone の GC 負荷に効く。
- **方針**: `RHYTHM_PLAY` に入ったときだけ install し、出たら uninstall する API を用意して本体から呼ぶ。挙動は同じ、常駐だけを止める。

### TD-10 無制限の画像キャッシュ(High)

- **事実**: `_dyeRecolorCache[cacheKey] = promise`(dataURL を解決)、`_dyeRegionMaskCache = {}`。削除箇所なし。
- **影響**: 染色したマスモンを多く持つプレイヤーがマスモン一覧・ランキングを行き来すると、dataURL 文字列(1体数百KB)が増え続ける。iPhone Safari のタブ再読み込みの原因になりうる。
- **方針**: LRU(件数上限)にする。キャッシュキーと生成結果は変えない。

### TD-11 文字列分岐の散在(High)

- **事実**: `mainHero?.id==='…'` 23 箇所、`mon?.id==='…'` 5 箇所、`card.monId==='…'` 多数。`ICE_LOCK_MONSTER_IDS`、`MONSTER_ART_CONTAIN_IDS`、`MASK_HIRES_BASE_IDS` のような ID 集合もロジック側。
- **影響**: モンスター追加時に jsx の何箇所を触るべきか grep でしか分からない。`docs/spec/BATTLE_SYSTEM.md` §5 も「各固有技の個別効果は `processTurn` 内の分岐が正本。効果一覧を別データへ完全正規化した構造はない」と認めている。
- **方針**: 全部をデータ化しない。まず「勇者特性」「固有技の連撃」の2種だけ表にし、`processTurn` と予測関数がその表を読む形にする(STEP 5)。

### TD-12 検査の網と CI の乖離(High)

- **事実**: 検査 326 本 / CI 28 本。`tools/README.md` は一覧のみで「この領域を触ったらこれ」の対応が無い。`DEVELOPMENT.md` にも「一括を回して初めて NG が出た」の記録。
- **追記(2026-09-06)**: `tools/run-checks.js` で全 336 本を回したところ、CI 外の 58 本が変更前の main で既に NG だった(`BASELINE_2026-09.md`)。うち 12 本は検査側の vm スタブ不足、残りは期待と実装のずれ・実ブラウザ環境依存で、トリアージが必要。
- **影響**: リファクタリングの回帰を機械的に拾う手段が無い。CI に無い検査は壊れたまま数 PR 進みうる。
- **方針**: (1) 領域→検査の対応表を持つ一括実行スクリプトを 1 本足す(既存 workflow のトリガーは変えない)。(2) 検査の実行時間を計り、CI に足せるものを選ぶ。

### TD-13 CSS の三重構造(High)

- **事実**: Tailwind CDN + `index.html` `<style>` 617 行 + `createAnimationStyle` 547 行。`DEVELOPMENT.md` に「遊ぶのに要る形は外部 CDN に任せない」の反省があり、`index.html` 側へ最低限の CSS を足してきた。
- **影響**: KI-001 のとおり初回表示が外部通信に依存する。どの CSS がどこにあるか探しにくい。
- **方針**: `tools/layout/` には既に Tailwind の手元ビルド手順があるので、静的 CSS 化の準備(使用クラスの抽出と容量計測)を STEP 7 で行い、切替は別途ユーザー判断。

### TD-14 保存失敗の黙殺と直接アクセス(High)

- **事実**: `storeSet` は `catch {}`。`localStorage` 直接: `mh_player_id`、`mh_ranking_debug`、バックアップ、`mhsave-backup.js`。
- **影響**: Safari のプライベートモードや容量超過で保存が失敗しても気づけない。バックアップ経路だけ `window.storage` を見ない(`SAVE_DATA.md` §6 に明記済み)。
- **方針**: 失敗を1箇所で数えて、次回起動時または設定画面で知らせる(仕様追加になるため、まず記録だけ。表示はユーザー判断)。直接アクセスは `storeGet/Set` へ寄せる(挙動同じ)。

### TD-15〜TD-17 データと定数(Medium)

- 難易度・モード・BGM・ミッション・ログインボーナスは jsx 側にある(§6 参照)。`data/` へ動かすと `index.html` の読み込み順と `harness.js` の `EXPORTED_NAMES` を同時に直す必要があり、単独では小さくない。
- `RHYTHM_SETTINGS_KEY`(jsx 2,517)と `'mh_rhythm_settings_v1'`(rhythm-mode 706)の二重定義は、キー名変更時に片方だけ変わる典型。
- 難易度 ID 列 `'Beginner','Easy',…` は tools 3 ファイルにも複製されている。

### TD-18 起動ロードの直列 effect(Medium)

- 12,781〜13,205 行。読込 → `normalize*` → `migrate*` → 補償(`grantCompensationGifts` 等)→ 更新通知の計画 → state 反映。移行は専用フラグで二重適用を防いでいる(良い)。
- 影響: 新しい保存項目を足すたびにこの effect が伸び、途中の例外で以降の読込が全部止まる(ゲーム開始不能)。
- 方針: キーごとの「読込 + 正規化」関数へ分け、順序だけをこの effect に残す(STEP 3)。移行の順序は変えない。

### TD-19 文書の乖離(Medium)

`CURRENT_ARCHITECTURE.md` §16。文書更新のみで解消。

### TD-20 読み込み順の暗黙依存(Medium)

`data/*.js` はグローバル参照。`boot/data-cache-key-check.js` はキャッシュキーの一致を見るが、順序は見ない。STEP 2 で「本体が必要とするグローバル一覧」を検査に足す。

### TD-21 デバッグ機能の同居(Medium)

13 画面 + `rpg*` 474 行 + `debug/*.json` 6.6MB が配信物。`CLAUDE.md` の方針(デバッグは更新履歴に載せない)とは整合しているが、コードとしては本体と同じファイルにある。STEP 10 でファイル分離候補。

### TD-22 描画コスト(Medium)

`style={{…}}` 522 箇所は毎描画で新オブジェクト、`key={i}` 37 箇所は並べ替えのある一覧で誤描画の原因。単独では小さいが TD-04 と組で効く。

### TD-23 長い async ターン処理(Medium)

`processTurn` は 17 `await`。実行ロックと「画面を離れたら以降を捨てる」判定が個別。STEP 6 のタイマー登録簿と同じ仕組みで「このターンはもう無効」を1つの参照で表す。

### TD-27 未参照の配信物(Low・要確認)

`data/images/title-screen-clean.PNG` 2.6MB。`image-asset-check.js` は `monster-hero/images/` だけを見るため検出されない。**2026-09-06 にユーザー確認のうえ削除済み**(復元は git 履歴から可能)。`data/images/` 配下の未参照検出は検査の穴として残る。

## 良い点(壊さないために記録)

監査で確認できた、今後も維持すべき設計。

- **保存の入口が1つ**(`storeGet/storeSet`)で、`setStorageWriteBlocked` による「プレビュー中は保存しない」が全経路に効く。
- **一度きり移行は必ず専用フラグ**を持ち、`diagnose*` はドライラン。`SAVE_DATA.md` が丁寧。
- **`Audio_` が音の唯一の入口**で、AudioContext 復帰・裏面停止・二重再生防止がその中に閉じている。
- **ランキング送信は `clear_id` で冪等**、失敗は端末内フォールバックへ。
- **被ダメージ計算は予測と実処理が同じ関数**を通る(与ダメージ側の手本になる)。
- **`build.js --check` が生成物の一致を CI で強制**し、`compiled-runtime-check` が誤ったランタイムを止める。
- **検査が多い**(326 本)。個々の検査は過去の事故の記録であり、リファクタリングの安全網として再利用できる。
