# 既知の課題

AI と人間が、未解決の不具合・技術的負債・調査事項を共有するための一覧です。
ここには再現またはコードから確認できた事実だけを記載し、個別の進捗管理は GitHub Issue に委ねます。
解決時は実装と同じ PR で「解決済み」へ移動してください。

## ステータスと優先度

- ステータス: `未着手` / `調査中` / `対応中` / `保留` / `解決済み`
- 優先度: `P0`（進行不能・データ損失）/ `P1`（主要機能）/ `P2`（回避可能）/ `P3`（改善）
- 種別: `不具合` / `技術的負債` / `性能` / `互換性` / `運用`

## 未解決

### KI-001: Tailwind を CDN と実行時生成に依存している

| 項目 | 内容 |
| --- | --- |
| ステータス | 未着手 |
| 優先度 / 種別 | P2 / 性能・運用 |
| 影響 | 初回表示が外部通信と端末上の CSS 生成に依存し、低速回線やオフラインで表示へ影響する可能性がある |
| 現状 | React / ReactDOM は同梱済みだが、Tailwind は CDN のまま |
| 回避策 | ネットワーク接続下で利用する。変更時は主要画面のレイアウトを目視確認する |
| 完了条件 | 静的 CSS 化の方針、容量、キャッシュ、全主要画面の回帰確認を終える |
| 関連 | GitHub Issue 未登録 |

### KI-002: ゲームロジックが大きな単一 JSX に集中している

| 項目 | 内容 |
| --- | --- |
| ステータス | 未着手 |
| 優先度 / 種別 | P3 / 技術的負債 |
| 影響 | 変更範囲の把握、部分テスト、複数人・複数 AI の並行編集が難しい |
| 現状 | `monster-hero/src/game-system.jsx` はモジュール export を持たず、検証では Babel とスタブで必要なロジックを取り出す |
| 回避策 | 小さい差分を維持し、既存の `tools/` チェックを変更領域ごとに実行する |
| 完了条件 | データ互換性と配信性能を維持した分割方針を決め、段階的な回帰テストを用意する |
| 関連 | GitHub Issue 未登録 |

### KI-003: 編集元と配信用 JavaScript の同期が手動工程である

| 項目 | 内容 |
| --- | --- |
| ステータス | 未着手 |
| 優先度 / 種別 | P2 / 運用 |
| 影響 | `game-system.compiled.js` の再生成を忘れると、ソースの変更が公開版へ反映されない |
| 現状 | `node tools/build.js` で生成し、`node tools/build.js --check` で不一致を検出できる |
| 回避策 | ゲーム本体変更時は両コマンドを必須とし、生成物を同じコミットへ含める |
| 完了条件 | CI などで不一致を自動検出し、マージを防止する |
| 関連 | GitHub Issue 未登録 |

### KI-004: 大容量アセットが配信・保守コストになる

| 項目 | 内容 |
| --- | --- |
| ステータス | 調査中 |
| 優先度 / 種別 | P3 / 性能・技術的負債 |
| 影響 | base64 画像ファイルと BGM が大きく、モバイル回線の通信量、キャッシュ、差分レビューへ負荷がかかる |
| 現状 | 画像は `data/images/` に分離し、BGM は `preload='none'` で必要時に読み込む。重複画像の検査ツールがある。2026-09-05に起動時の読み込みを 7.2MB → 5.3MB へ削減済み（タイトル画像 2.5MB PNG → 0.67MB JPEG）|
| 回避策 | `node tools/image/image-report.js` と `node tools/browser/perf-check.js` で増加を確認し、大容量追加を避ける |
| 完了条件 | 端末・回線別の容量目標を定め、品質を損なわない最適化方針を決める |
| 調査済み（2026-09-05・これ以上の余地は無い箇所）| ・`monster-hero/images/` の大きいPNG（1254px前後・透明あり）は既に最適化済みで、`sharp` で入れ直すと約30%太る<br>・BGMは既に 64〜96kbps<br>・`home-background.jpg` は品質92で入れ直しても 660KB → 655KB<br>・残る大物は本体JS（約2.7MB）で、これはKI-002の分割が前提 |
| 関連 | GitHub Issue 未登録 |

### KI-007: Android実機でBGMが鳴らない報告の切り分けが端末なしでは終わらない

| 項目 | 内容 |
| --- | --- |
| ステータス | 調査中 |
| 優先度 / 種別 | P2 / 互換性 |
| 影響 | OPPO Find X8 / Android 16(ColorOS 16)で「BGMアレンジ曲が再生できない」報告。Chromiumでの自動検査では17曲すべてが `decodeAudioData` に成功し、再現しない |
| 現状 | 端末側でAudioContextが止められたまま復帰しない経路と、試聴がユーザー操作と切れる経路の2つを修正済み(`node tools/audio/bgm-check.js` で回帰を検査)。これで直るかはAndroid実機での確認待ち |
| 回避策 | 画面のどこかをタップすると止まったAudioContextが再開する。試聴が鳴らない場合はもう一度「試聴」を押す |
| 完了条件 | Android 16実機で、いちか4曲の試聴と、アレンジ設定後の実画面での再生を確認できること。再現する場合はChrome DevTools(リモートデバッグ)で `AudioContext.state` とデコード結果を採取する |
| 関連 | 本修正のPR。いちか4曲には128〜248KBの埋め込みPNGジャケットがあるが、デコード阻害は確認できていないため再エンコードしていない |

### KI-008: GOD難易度の助手セリフ(extremeDifficultyGuides)がみゅあ/きき混在検査に落ちる

| 項目 | 内容 |
| --- | --- |
| ステータス | 未着手 |
| 優先度 / 種別 | P3 / 不具合 |
| 影響 | `node tools/assistant-bond-check.js` の「みゅあとききのセリフが混ざらない」がNGになる。CIには含まれていないため公開には影響しないが、放置すると助手をきき選択中でもGOD/極限の案内がみゅあの語調(`who:'mua'`)のまま出る可能性がある |
| 再現環境 | main（PR #899「極限チャレンジ新難易度 GOD 正式公開」由来。音ゲー(モンヒロビート)開発とは無関係） |
| 再現手順 | 1. `node tools/assistant-bond-check.js` を実行 2. `godDifficulty` シーンでNGになることを確認 |
| 期待結果 | `extremeDifficultyGuides` パックのGOD向け行にも、きき選択時に`who:'kiki'`相当の行が用意されている |
| 実際の結果 | `who:'mua'`のまま(またはきき向け分岐が無い)ため、きき選択中でもみゅあの語調で表示されうる |
| 回避策 | なし(実際の画面表示に出るかは未確認。この検査はデータ定義の整合だけを見ている) |
| 完了条件 | `node tools/assistant-bond-check.js` がGODシーンを含め全件成功すること |
| 関連 | PR #899、`monster-hero/data/assistants.js` の `extremeDifficultyGuides` パック |

### KI-009: 外部CDNから読む Tone.js に完全性検証(SRI)が付いていない

| 項目 | 内容 |
| --- | --- |
| ステータス | 保留（このサンドボックスからCDNへ出られずハッシュを取得できないため） |
| 優先度 / 種別 | P2 / 運用 |
| 影響 | `cdnjs.cloudflare.com` が配る `Tone.js` が差し替わった場合、そのまま実行される。効果音・BGMの処理を担うため、実行されると影響範囲は広い |
| 再現環境 | 全環境。デバッグ限定ではなく、通常プレイの音声初期化で読み込む |
| 再現手順 | 1. `monster-hero/src/game-system.jsx` の `Audio_` の `load()` を見る 2. `s.src = 'https://cdnjs.cloudflare.com/ajax/libs/tone/14.8.49/Tone.js'` に `integrity` / `crossOrigin` が無いことを確認 |
| 期待結果 | `s.integrity = 'sha384-...'` と `s.crossOrigin = 'anonymous'` を付け、中身が変わったら実行せず読み込み失敗として扱う |
| 実際の結果 | 検証せずに実行する |
| 回避策 | 読み込みに失敗しても `s.onerror` で先へ進む作りなので、SRIを付けても音が出なくなるだけで進行不能にはならない |
| 完了条件 | ネットワークのある環境で次を実行してハッシュを求め、`game-system.jsx` へ書いて `node tools/build.js` を通す。<br>`curl -sS https://cdnjs.cloudflare.com/ajax/libs/tone/14.8.49/Tone.js \| openssl dgst -sha384 -binary \| openssl base64 -A` |
| 関連 | `monster-hero/src/game-system.jsx`（Tone.js の読み込み） |

### KI-010: Supabase のランキング表に対するRLSをリポジトリから確認できない

| 項目 | 内容 |
| --- | --- |
| ステータス | 保留（サーバー側の設定のため、コードからは確かめられない） |
| 優先度 / 種別 | P2 / 運用 |
| 影響 | 公開鍵(`sb_publishable_*`)は誰でも読めるため、行レベルセキュリティ(RLS)が緩いと他人の記録の書き換え・削除ができる |
| 再現環境 | Supabase の管理画面 |
| 再現手順 | 1. Supabase の該当プロジェクトを開く 2. ランキング用テーブルの RLS ポリシーを見る |
| 期待結果 | 匿名キーでは INSERT のみ許可し、UPDATE / DELETE と他人の行の書き換えを禁止している |
| 実際の結果 | 未確認 |
| 回避策 | なし |
| 完了条件 | 管理画面でポリシーを確認し、`docs/sql/` へ現状のポリシーを書き出す |
| 関連 | `monster-hero/src/game-system.jsx`（ランキング送信）、`docs/sql/` |

## 新規課題テンプレート

課題 ID は `KI-005` のように連番にします。P0/P1 はこの一覧への追記だけで済ませず、GitHub Issue を作成して
再現情報・担当・期限を管理してください。

```markdown
### KI-NNN: 短い課題名

| 項目 | 内容 |
| --- | --- |
| ステータス | 未着手 / 調査中 / 対応中 / 保留 |
| 優先度 / 種別 | P0〜P3 / 不具合・技術的負債・性能・互換性・運用 |
| 影響 | 利用者、端末、機能、データへの影響 |
| 再現環境 | OS / ブラウザ / 画面 / セーブ状態 |
| 再現手順 | 1. ... 2. ... 3. ... |
| 期待結果 | 本来の動作 |
| 実際の結果 | 現在の動作 |
| 回避策 | なければ「なし」 |
| 完了条件 | テストを含む客観的な条件 |
| 関連 | Issue # / PR # / コミット |
```

## 解決済み

### KI-006: iPhoneの消音モード中にBGMが端末スピーカーから流れる（2026-07-29 解決）

- 再調査結果: 前回はHTMLAudioElementを`createMediaElementSource`へ接続しただけで、音源そのものはiOSで消音モードを無視し得るメディア再生経路のままだった。BGMとジングルの`new Audio()`・`.play()`も配信コードに残っていた。
- 解決内容: BGMとジングルを`fetch` / `decodeAudioData`でAudioBuffer化し、AudioBufferSourceNodeから再生する経路へ統一した。SEは従来どおりTone.jsのWeb Audio合成経路を使う。
- 検証: `node tools/audio/audio-route-check.js`、`node tools/build.js --check`、iPhone実機の通常モード・消音モード（実機確認は要実施）
- 関連: 本修正のPR

### KI-005: 全国ランキング失敗を端末内保存成功で隠していた（2026-07-28 解決）

- 解決内容: 全国POST失敗と端末内フォールバックの結果を別々に返し、全難易度を全項目の単一payloadで送る共通経路へ統一した。失敗時はHTTP status・PostgREST code・response bodyを端末内記録へ残す。
- 検証: `node tools/ranking/ranking-normal-integration-check.js`、`node tools/ranking/ranking-request-check.js`、`node tools/run/ranking-finish-check.js`
- 関連: 本修正のPR

解決した項目は削除せず、要約、解決日、PR、検証方法を残します。

```markdown
### KI-NNN: 課題名（YYYY-MM-DD 解決）

- 解決内容: <!-- 何を変更したか -->
- 検証: `コマンド`、確認端末
- 関連: PR #NNN
```
