# 検査ベースライン(2026-09-06)

`main` 2088577(PR #1114 まで、コード変更なし)に対して `node tools/run-checks.js --area all` を実行した結果。
**リファクタリングの前に「何が通り、何が通っていないか」を固定するための記録**であり、ここに載っている NG は今回の変更で壊れたものではない。
以降の STEP では、この一覧に無い NG が出たら「その変更で壊した」とみなす。逆にここにある NG は、別 PR でトリアージ(検査を直す / 実装の乖離を直す / 廃止する)する。

## 結果の要約

| 項目 | 値 |
| --- | ---: |
| 検査本数 | 336 |
| OK | 278 |
| NG | 58(→ 2026-09-06 の A 修正後 51) |
| 所要時間(全部・直列) | 約 19 分 |

CI 相当(`--area ci` 28 本)と CLAUDE.md の必須検査(`--area required` 14 本)は**全件 OK**。NG はすべて CI に入っていない検査。

## 領域ごとの内訳

| 領域 | 本数 | OK | NG | 最長(秒) |
| --- | ---: | ---: | ---: | ---: |
| root | 26 | 26 | 0 | 14 |
| boot | 17 | 17 | 0 | 10 |
| assistant | 5 | 4 | 1 | 0 |
| mode | 133 | 127 | 6 | 77 |
| audio | 15 | 10 | 5 | 48 |
| battle | 29 | 11 | 18 | 84 |
| browser | 2 | 1 | 1 | 4 |
| changelog | 4 | 4 | 0 | 11 |
| image | 15 | 14 | 1 | 15 |
| masu | 36 | 30 | 6 | 51 |
| monster | 12 | 6 | 6 | 56 |
| ranking | 23 | 17 | 6 | 32 |
| run | 19 | 11 | 8 | 4 |

## NG の分類

### A. 検査側の vm スタブ不足(本体が増やしたグローバルを検査の実行環境が用意していない)(11本 → **2026-09-06 に検査側を修正**)

本体が後から足した定義(`BREEDER_MARKET_ITEMS` への push、`GOD_SETTING`、`BGM_TOGGLE_SCENES`、`normalizeTranscendStatPoints`、`applyNightmareSignedModifier`、`normalizeAutoRepeatBreakthroughLevel`)を各検査の vm へ渡し、`RANGE_LABELS` の二重宣言は切り出し範囲を行単位に直した。実装は触っていない。

| 検査 | 修正後 |
| --- | --- |
| `audio/title-bgm-default-check.js` | OK |
| `masu/donation-check.js` | OK |
| `masu/pasture-check.js` | OK |
| `run/auto-repeat-bond-level-cap-check.js` | OK |
| `ranking/ranking-normal-display-check.js` | OK |
| `ranking/ranking-request-check.js` | OK |
| `run/unique-initial-in-battle-check.js` | OK |
| `battle/dist-aptitude-check.js` | 読み込みは通るようになり、残りは B 分類(期待文言のずれ): NG: マスモン強化でも補正値(%)を出す |
| `battle/unique-range-check.js` | 読み込みは通るようになり、残りは B 分類(期待文言のずれ):  |
| `run/bond-reward-check.js` | 読み込みは通るようになり、残りは B 分類(期待文言のずれ):  |
| `run/unique-skill-point-check.js` | 読み込みは通るようになり、残りは B 分類(期待文言のずれ):  |

### B. 検査の期待が実装の現在の形と合っていない(文言・構造の正規表現、または実装側の乖離)。要トリアージ(38本)

| 検査 | 最後に出た行 |
| --- | --- |
| `assistant/momosuke-check.js` | 1件のNGがあります |
| `audio/audio-route-check.js` | ✓ monster-hero/game-system.compiled.js: 同一BGMの重複ソースを作らない |
| `audio/auto-bgm-continuity-check.js` | OK: 今後の更新バナー・更新情報確認を開発ルール化 |
| `audio/pandora-boss-bgm-check.js` | 2件のNGがあります |
| `battle/balance-second-card-check.js` | 4件のNGがあります |
| `battle/battle-balance-check.js` | } |
| `battle/battle-carousel-check.js` | } |
| `battle/battle-mode-check.js` | 4件のNGがあります |
| `battle/battle-scenario-check.js` |  |
| `battle/battle-tutorial-check.js` | NG: 練習中はチャレンジ以外の「難易度を選ぶ」を押せない |
| `battle/card-icon-check.js` | NG: iconをそのまま描いている箇所が残っていない — st.icon — cardIconNode() を通すこと |
| `battle/enemy-defeat-check.js` | NG  通常攻撃・固有技・連撃・追撃の合計が共通撃破処理へ進む |
| `battle/enemy-scan-check.js` | 1件のNGがあります |
| `battle/guard-card-check.js` | NG: 強化画面の予告も同じ式を使う |
| `battle/hero-marker-check.js` | NG: 枚数の計算がその値を使う |
| `battle/rpg-debug-check.js` | 2件NG |
| `masu/party-set-check.js` | } |
| `masu/rebirth-check.js` | 2件のNGがあります |
| `mode/extreme-difficulty-theme-check.js` | } |
| `mode/nightmare-rules-check.js` | } |
| `mode/species-challenge-clear-flow-check.js` | 1件NG |
| `mode/species-challenge-unlock-check.js` |  |
| `monster/golem-balance-check.js` | NG: 自動ガッツ回復率を実装から読める |
| `monster/kiki-assist-check.js` | } |
| `monster/market-icon-check.js` | NG: 対象アイコンを共通部品で拡大・位置調整する |
| `monster/meloso-assist-check.js` | } |
| `monster/mermaid-monsters-check.js` | 1件のNGがあります |
| `monster/plant-check.js` | OK: Plant助手告知IDは1件だけ |
| `ranking/emergency-audio-breeder-check.js` | } |
| `ranking/ranking-refresh-race-check.js` |  |
| `run/auto-full-run-check.js` | NG: WAVE10はAUTO停止後に既存の終了ロック・報酬・記録・CHAMPIONを通る |
| `run/eco-mode-internal-check.js` |  |
| `run/ranking-finish-check.js` | 92/102 項目OK |
| `run/training-check.js` | OK: 折りたたみDEBUG操作 |

| `battle/dist-aptitude-check.js` | NG: マスモン強化でも補正値(%)を出す(A の修正後に残ったもの) |
| `battle/unique-range-check.js` | (A の修正後に残ったもの) |
| `run/bond-reward-check.js` | (A の修正後に残ったもの) |
| `run/unique-skill-point-check.js` | (A の修正後に残ったもの) |

### C. 実ブラウザ検査。Tailwind CDN が届かない環境での見た目依存、または要素の探し方が古い。要トリアージ(16本)

| 検査 | 最後に出た行 |
| --- | --- |
| `audio/bgm-arrangement-layout-check.js` | NG: 本物と同じCSSを用意できる — 0KB / `page.addStyleTag: content: expected string, got object`(2026-09-06 追記。CDN の Tailwind を取り込めず CSS が空になるための失敗で、PR3 時点=`552adee3` でも同じように落ちることを確認済み) |
| `mode/rhythm-judgment-band-check.js` | NG: 検査を最後まで実行できる — `Cannot find module '/home/user/monhero/tools/node_modules/sharp'`(2026-09-06 追記。画像を作る `sharp` がこの環境に入っていないだけで、実装とは関係ない) |
| `masu/masu-growth-breakdown-check.js` | NG: 本物と同じCSSを用意できる — 0KB / 4項目の現在値がそろわない(2026-09-06 追記。`bgm-arrangement-layout-check` と同じく Tailwind を取り込めず CSS が空になるための失敗) |
| `audio/title-bgm-check.js` | NG  タップだけでタイトルBGMが鳴る(他ページへ移動しなくてよい) — 拒否された再生 0回 |
| `battle/battle-check.js` | NG  ファンファーレのあとBGMが戻る — (無音) |
| `battle/battle-menu-browser-check.js` | } |
| `battle/battle-tutorial-v2-check.js` | 1件のNGがあります |
| `battle/wave-result-layout-check.js` | } |
| `browser/feature-check.js` | NG  トップにバージョンが表示される — ver 2026-09-06 10:25 |
| `image/dye-edge-check.js` | NG: Undine: 輪郭の塗り残しが 22.89% (上限 5%)。染めても元の色の縁が残ります |
| `masu/bulk-enhance-check.js` | } |
| `masu/fusion-animation-browser-check.js` | Error: ボタンが見つかりません: /神殿/ |
| `mode/extreme-browser-check.js` | NG  通常の難易度画面が開く(極限の影響なし) — バトル モード選択ブリーダーLv絆Lv 左右にスワイプしてモードを選択 BATTLE MODE 🏆 チャレンジモード 強化を選んでじっくり攻略する、基本のモード 最高 |
| `mode/extreme-rule-detail-browser-check.js` | 3件のNGがあります |
| `ranking/breeder-ranking-browser-check.js` | } |
| `ranking/ranking-check.js` | NG  ランキングを開ける — ボタンが見つからない |

## 実行環境についての注記

- このサンドボックスは外部 CDN(Tailwind)へ出られないため、実ブラウザ検査は見た目が崩れた状態で動く。C 分類の一部はそれが原因の可能性があるが、実機や通信のある環境で再実行して切り分けるまでは「検査が古い」と断定しない。
- `tools/package-lock.json` の playwright(1.62)は `chromium-1234` / `chromium_headless_shell-1234` を探すが、この環境に入っているのは 1194 だった。今回はローカルにだけ 1234 → 1194 のリンクを作って動かした(リポジトリには入れていない)。`headless: true` で起動する検査はこのリンクが無いと 0.5 秒で落ちる。
- `run-checks.js` は、自分で `serve.py` を立てる検査(`boot-check` など)の前に共有の配信を止める。初回の実行ではここを誤ってポートを取り合い `boot-check` が落ちたが、直したあとは OK。

## 所要時間の長いもの(CI へ足すときの参考)

| 検査 | 秒 |
| --- | ---: |
| `battle/battle-check.js` | 84 |
| `mode/extreme-browser-check.js` | 77 |
| `monster/mermaid-browser-check.js` | 56 |
| `masu/bulk-enhance-check.js` | 51 |
| `mode/rhythm-audio-general-check.js` | 50 |
| `mode/extreme-rule-detail-browser-check.js` | 49 |
| `audio/bgm-check.js` | 48 |
| `masu/masu-enhance-layer-check.js` | 42 |
| `mode/rhythm-chart-v2-step5-check.js` | 41 |
| `ranking/bond-levels-table-check.js` | 32 |
| `ranking/ranking-run-stats-check.js` | 31 |
| `masu/masu-growth-breakdown-check.js` | 25 |

`--area required` は約 1 分、`--area ci` は約 2 分。A 分類の 11 本はスタブに定数を足すだけで直る見込みが高く、直したら `battle` / `masu` / `run` / `ranking` の領域を CI 候補にできる。

## 次にやること(STEP 1 の残り・別 PR)

1. A 分類: 2026-09-06 に対応済み(11 本中 7 本が OK、4 本は B 分類として残る)。
2. B 分類: 1 本ずつ「検査が古い」のか「実装が仕様から外れた」のかを判定する。実装側の乖離と判明したものは `KNOWN_ISSUES.md` へ移す(例: `battle/card-icon-check` の「`st.icon` を直接描いている箇所」、`monster/golem-balance-check` の「自動回復 null」、`image/dye-edge-check` の Undine の塗り残し)。
3. C 分類: 通信のある環境(または Tailwind の手元ビルド `tools/layout/`)で再実行して切り分ける。

## 2026-09-06 夕: 共有層の分割後に全件を回した結果

`main` #1125 + 共有層の 21 分割(PR 未マージ時点)で `--area all` を実行: 340 本 / NG 54 → ベースラインの 51 本に対して**新しい NG が 3 本**あり、原因を切り分けた。

| 検査 | 原因 | 対応 |
| --- | --- | --- |
| `viewport-height-check.js` | エラー境界(#1117)の受け止め画面が `100dvh` を直書きしていた(Android のナビゲーションバーで下端が隠れる、と決めた事項に反する) | `var(--mh-vh)` に直した |
| `mode/rhythm-player-screen-debug-check.js` | エラー境界(#1117)のわざと投げる例外の文言に「デバッグ」があり、演奏画面の範囲(`RhythmTapTest` 〜 `MonsterHeroGame`)で数えられていた | 文言から「デバッグ」を外した |
| `battle/rpg-debug-layout-check.js` | 分割のとき、離れた位置にあった説明コメントを定義の直前へ動かしたが、その行を切り出しの終端に使っていた | コメントを元の位置へ戻した |

3 本とも直したうえで、上記 3 本 + `required` + `ci` が OK。新しく足した検査(`boot/legacy-save-boot-check` / `boot/save-keys-check` / `boot/screen-error-boundary-check` / `boot/parts-purity-check`)はすべて OK。
main 側で足された `mode/rhythm-forced-rotation-check.js` も OK。残る NG はベースラインと同じ 51 本。

教訓: `required` と `ci` だけでは #1117 の 2 件の退行を拾えなかった。**本体を触る PR では、少なくとも `boot` `battle` `mode` の領域まで回す**(所要 10 分程度)。

## B 分類のトリアージ(2026-09-06 夜)

NG の行を全件読み、実装側を照らして分類した。**大半は「実装が意図して変わったのに、検査が実装の文言を固定していた」**もので、
検査 1 本ごとに「いまの意図した形」へ言い直す必要がある(数式や順序の意図は保ったまま)。1 本直すと次の古い行が出てくる層構造に
なっているものが多く(`battle-balance` / `battle-carousel` / `nightmare-rules` で確認)、まとめて直すより領域ごとに少しずつ直すのがよい。

| 判定 | 検査 | 根拠(いまの実装との差) |
| --- | --- | --- |
| 直した | `battle/enemy-defeat-check` | `resolveEnemyDefeat` の終端の見つけ方と、攻撃側の呼び出し(`enemyHpAfterOurAttacks`)を現在形へ。同期ロック・共通処理の意図はそのまま |
| 直した(2026-09-06 夜) | `battle/battle-balance-check` | 敵生成は `battleSetting.power` とターン倍率(GOD は神威倍率)を渡す形へ。vm に `QUICK_DIFFICULTY_SETTINGS` を渡す |
| 直した | `battle/battle-carousel-check` | 同上。呼び出し箇所は GOD 分岐で 3 か所 |
| 直した | `mode/nightmare-rules-check` | 距離強化・符号付き補正・回復の式が WAVE 番号も受け取る形へ |
| 検査が古い(意図した変更) | `run/ranking-finish-check` | 周回IDのリセットが 4 経路(チャレンジ/クイック/プロ/種族)に増えた、送信 payload に `reached_wave` / `turns` が増えた(#run-stats)、レベル系の取得の引数が `RANKING_SELECT_FULL` に |
| 検査が古い | `run/unique-skill-point-check` | 購入処理が数量対応(#1126 で 100P 単位など)に変わり、固定していた文字列が変わった |
| 直した | `battle/dist-aptitude-check`, `battle/battle-scenario-check`, `battle/enemy-scan-check`, `battle/hero-marker-check` | 適性の受け渡しに特別ルールと WAVE 番号、会心の基礎ダメージ名 `mainBaseD`、SCAN の `waveDifficulty`、ききの枚数ボーナス、再計算条件の並び |
| 検査が古い | `ranking/ranking-refresh-race-check`, `run/eco-mode-internal-check`, `monster/kiki-assist-check`, `monster/meloso-assist-check`, `ranking/emergency-audio-breeder-check`, `mode/extreme-difficulty-theme-check`, `masu/party-set-check` | いずれも「特定の1行の文字列がある」ことを見ており、その行が別の書き方に変わっている(切り出しの needle が見つからない、`prev.length >= STARTER_TEACHING_IDS.length` の形が変わった、など) |
| 検査が古い | `battle/battle-mode-check`, `battle/battle-tutorial-check`, `battle/guard-card-check`(「ガード枚数」の文言が変わった), `battle/balance-second-card-check`, `battle/rpg-debug-check`, `battle/unique-range-check`, `masu/rebirth-check`, `run/bond-reward-check`, `run/training-check`, `run/training-reward-check`(2026-09-06 に追記。`cardIconNode` を切り出せず落ちる。本記録の作成後に古くなったもので、`runStage` の変更とは無関係), `mode/species-challenge-clear-flow-check`, `mode/species-challenge-unlock-check`, `monster/mermaid-monsters-check`, `monster/market-icon-check`, `monster/plant-check`(「全16種」→ いま 19 種), `assistant/momosuke-check`, `audio/auto-bgm-continuity-check`, `audio/pandora-boss-bgm-check`, `audio/audio-route-check` | 説明文・件数・部品名などの固定文字列。実装の説明文や部品が更新されている |
| **実装側の確認が要る** | `battle/card-icon-check` | `{st.icon}` を `cardIconNode()` を通さず直接描いている箇所が 1 つある(60-app 内の選択肢一覧)。絵文字前提の直描きなら文字化けの元、というのが検査の主張。意図した表示か要確認 |
| **実装側の確認が要る** | `monster/golem-balance-check` | ゴーレムの自動ガッツ回復率を実装から読めない(`null`)。式の定数の置き場所が変わっただけか、値が消えたのかを要確認 |
| **データ側の確認が要る** | `image/dye-edge-check` | Undine の染色マスクの輪郭の塗り残し 22.9%(上限 5%)。マスク画像の品質の問題で、コードではない |

方針: 「検査が古い」は、その領域を触る STEP(バトル → STEP 5、ランキング → STEP 3 の取引関数)で、直す前にその領域の検査を現在形へ言い直してから着手する。
「実装側の確認が要る」3 件は KNOWN_ISSUES へ移す候補(ユーザー判断)。

## 実行環境の注記(追記)

- `battle/battle-mode-select-check.js` は `run-checks.js --area battle` の中では NG になったが、単体では OK。自分で配信(serve.py)を立てる検査が
  続くとき、直前の検査の配信が閉じ切る前に次が同じポートを取ろうとして落ちることがある(検査の中身の問題ではない)。
  一括実行で落ちた実ブラウザ検査は、単体で再実行して判断する。

---

## 2026-09-07 追記: `--area run,battle` の NG 17本を解消した

ユーザー指示「NGは解消しておきたい」。**実装は一切変えていない**。落ちていた17本はすべて
「実装が変わったのに検査が追随していない」か「この環境では測れないものを測ろうとしていた」で、
`node tools/run-checks.js --area run,battle` は **56本すべてOK / NG 0** になった。

### ① 実装の変更に検査が追随していなかったもの(13本)

| 検査 | 何が変わっていたか |
| --- | --- |
| `run/auto-repeat-internal-check` | `stopAllAuto` が理由つき(`reason`)になり、停止経路が defeat/retire/manual/hidden に分かれた。`blur`/`pagehide` は `visibilityState` で裏を取る `onMaybeHidden` 経由になった |
| `run/eco-mode-internal-check` | 同じく `stopAllAuto` の引数。超省エネの音声退避が `quickMuted` も控えるようになった |
| `run/training-reward-check` | 画面がアイコンを共通部品(`cardIconNode`)で描くようになり、評価用の props に無くて落ちていた |
| `run/training-check` | HOMEの修行の施設はモンヒロビートへ譲った(入口は無いが紹介画面は残る)。デバッグ画面は項目が増えたので距離ではなく画面の範囲で見る |
| `run/bond-reward-check` | 強化ポイントの倍率が「凸の数」から**到達レベルの帯**(〜270=+1 / 271〜330=+2 / 331〜400=+3)へ変わっていた |
| `run/unique-skill-point-check` | マーケットの購入が「計算(`buildMarketItemPurchase`)＋巻き戻せる保存(`saveMarketBalances`)」へ整理された |
| `run/ranking-finish-check` | 周回IDリセットの経路が増え、POSTに `reached_wave`/`turns` が足され、ブリーダーLvの取得がページ送りへ変わり、勝利処理の手前に種族チャレンジの枝が入っていた |
| `battle/guard-card-check` | 「能力覚醒」画面の予告を見ていたが、その画面は #639 で「トレーニング」へ置き換わっている |
| `battle/rpg-debug-check` | RPG画面の切り出し終端が `DEBUG_SETTINGS` のままで、あいだに入ったモンヒロビートの `masuMons` まで拾っていた。モーション表にエイキも増えていた |
| `battle/unique-range-check` | 合体の継承判定が2か所からの重複計算 → `buildFusionInheritancePlan` 1か所へ集約されていた |
| `battle/balance-second-card-check` | 効果量が固定値から段階の値になり、自動回復の説明に「（次のターンから）」が足されていた |
| `battle/battle-mode-check` | ダイヤ方針を通す経路が増え、モード別BGMの既定曲が入れ替わり、モードカードと報酬の見出しが組み直されていた |
| `battle/battle-tutorial-check` / `-v2-check` | **v1とv2の役割が入れ替わっていた**(v2=本番の入口 / v1=デバッグからだけのお試し)。プロの説明も「難しい」→「ベースモンだけで挑む」へ |
| `battle/enemy-defeat-check` | 画面の切り替えが `setGameState` 直呼びから `advanceRunStage` へ統一されていた |

### ② ブラウザ検査の導線が古かったもの(2本)

`battle/battle-check` と `battle/battle-menu-browser-check` は、**起動から先へ1歩も進めていなかった**。

- はじめての案内をとばす鍵が `mh_intro_done` → `mh_onboarded`(＋`mh_tutorial_seen_v1`)
- 起動画面と「はじめる」は `pointerdown` で拾う作りなので `click()` では進まない
- 「召喚開始」でいきなり始まる作りは無くなり、HOME →「バトル」→ モード選択 → 難易度 の順になった
- 確定ボタンの名前が「決定」→「勇者モンに選ぶ」「この供モンを選ぶ」へ
- 「攻撃覚醒」は「トレーニング」(4種類から2つ選ぶ)へ
- ログインボーナス・ギフト・更新のお知らせ・助手の告知が続けて出るので、送り切ってから進む必要がある

### ③ この環境では測れないもの(理由つきで飛ばす)

| 何を | なぜ測れないか |
| --- | --- |
| `battle/battle-check` の上部ヘッダーの実測 | Tailwind の CDN が届かず `w-*`/`p-*` が効かない。ボタンが0px近くまで潰れ、TURN と SCORE の左右関係も崩れる |
| `battle/battle-check` のファンファーレ | ヘッドレスChromiumは自動再生を止めるので `<audio>` がひとつも動かない(この表の「(無音)」がそれ) |
| `battle/battle-menu-browser-check` 全体 | カードの高さ・スクロール・ボタンが画面内に収まるかの実測なので、Tailwind が無いと意味が無い |

どれも `w-12` の実測(48pxになるか)や `<audio>` の有無で**環境を判定してから飛ばす**ようにした。
CDNが届く環境では今までどおり測る。黙って通すのではなく、飛ばした理由を必ず1行出す。

> ⚠ **教訓**: 検査が落ちたまま放置されると、「本当に壊したとき」に気づけなくなる。
> とくにブラウザ検査は、画面の作りが変わると**入口で止まって全項目NG**になり、
> 一見「大量に壊れた」ように見える。まず**どこまで進めているか**を出してから中身を疑うこと。
