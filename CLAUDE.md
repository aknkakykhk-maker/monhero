# モンスターヒーロー プロジェクト運用ルール

**守ることだけをここに置く。** 経緯・失敗例・細かい手順は [`docs/rules/`](docs/rules/README.md) にあり、
`node tools/ctx.js rules <語>` で必要な節だけ引ける。
このファイルは会話のたびに全文が読み込まれるので、**膨らませない**
(`node tools/rules-index-check.js` が大きさと、要のことばが消えていないかを見張る)。

ブラウザで動くカードバトルゲーム(静的サイト、ビルドツールなし)で、GitHub Pages により
`https://aknkakykhk-maker.github.io/monhero/` として公開されている。個人開発。

## 会話言語

Claudeアプリでのチャット時の言語は**日本語に固定**する。ツール実行の合間の一言の進捗コメントも含めてすべて日本語
(コード中の識別子・ログ等の引用を除く)。Stop フック `tools/hooks/japanese-only-check.js` が英語の文を止める。
止められたら言い訳せず日本語で書き直す。経緯: [`docs/rules/CONVERSATION.md`](docs/rules/CONVERSATION.md)

## 返事待ちは質問形式にする

ユーザーの返事・判断を待つときは、**文末の問いかけだけで済ませず `AskUserQuestion` の選択式で聞く**
(2026-10-01の指示)。選択肢は2〜4個で、おすすめを先頭に「(推奨)」と付ける。
「〜しますか?」と文で書いて終わらない。例外は、選びようのない自由記述(曲名・文言など)を求めるときだけ。
聞く前に、確認なしで進めてよいこと(②③の公開まで)を聞き返さない。

## 最初に打つもの

```
node tools/ctx.js brief                 いまの状態(ブランチ・未コミットの変更・次に打つもの)
node tools/ctx.js rules <語>            関係するルールの節だけを読む
node tools/run-checks.js --changed      変更内容から要る検査を選んで回す
```

| これから触るもの | 開くもの(ここに決まりの本文がある) | 通すもの |
| --- | --- | --- |
| ゲーム本体(`src/parts/*.jsx`) | ⑥ | `run-checks.js --changed` |
| 更新履歴・ヘルプ・助手の告知 | ⑤ → `changelog-help-update` スキル | 同上 |
| 画像・音源 | ⑥-2 → [`monster-hero/images/CLAUDE.md`](monster-hero/images/CLAUDE.md)・[`monster-hero/audio/CLAUDE.md`](monster-hero/audio/CLAUDE.md) | 同上 |
| モンスターの追加 | `monster-add` スキル | 同上 |
| モンヒロビートの新曲 | ⑥-3 → `rhythm-song-add` スキル | 同上 |
| モンヒロビートのイベント | ⑥-4 → [`monster-hero/data/CLAUDE.md`](monster-hero/data/CLAUDE.md) | 同上 |
| 譜面生成ツール(`tools/mode/`) | ⑩-2 → [`tools/mode/CLAUDE.md`](tools/mode/CLAUDE.md) | 同上 |
| 保存データ・ランキング | ⑦ / [`SAVE_DATA.md`](docs/spec/SAVE_DATA.md) | 同上 |
| ブランチ・PR・Actions | ⑧ / [`AGENTS.md`](AGENTS.md) | — |

場面が限られる節(⑤⑥-2⑥-3⑥-4⑩-2)の本文は、上の「開くもの」へ移してある(サブフォルダの CLAUDE.md は、
そのフォルダのファイルを読んだときに読み込まれる)。**その作業を始める前に必ず開く。** 移した一覧:
[`docs/rules/README.md`](docs/rules/README.md)

## 改修 → 検証 → 公開のフロー

詳細と経緯: [`docs/rules/FLOW.md`](docs/rules/FLOW.md)

### ① 動作検証はユーザーがClaudeアプリ内で実施する

改修後の**動作検証は、Claudeアプリ内でユーザー自身が行う**。Claudeは改修を実装したら、
ユーザーが検証しやすいように「何を直したか」「どこを見ればよいか」を明確に伝える。
Claude側で動作確認が完結したと判断して報告を省略しない。

### ② コミットのタイミング

**依頼された改修が終わったら、確認を取らずにコミットし、③のとおり公開まで進める。**
「コミットしても良いですか？」と聞かない(2026年8月にユーザーがそう指示した)。

例外は2つだけ。(1) ユーザーがそのとき明示的に「コミットはしないで」「まず確認させて」等と
指示した場合、(2) その依頼の指示書に「勝手にコミットしないでください」等と書かれている場合。
このときはローカルで確認できる状態(ビルド済み・検査通過)にして報告し、指示を待つ。

### ③ コミット後はプッシュ・PR作成・マージまで確認なしで自動的に実施する

    ブランチへコミット → プッシュ → プルリクエスト作成 → マージ → ブランチをmainへ同期

「プッシュしますか？」「マージしますか？」と**いちいち聞かない**。レビュー待ちも発生しない。
マージ後は作業ブランチを最新のmainに合わせ、作業ツリーをクリーンにしてから報告する。
ユーザーがそのとき明示的に「プッシュはしないで」等と指示した場合は、その指示が優先される。

> ⚠️ **マージがコンフリクトで断られても、そこで止めない。** 解消してマージし切るまでが1つの作業
> (手順は [`AGENTS.md`](AGENTS.md)「マージがコンフリクトで断られたとき」)。PRを作る直前に `git fetch origin main` しておく。

### ④ 「ローカル確認」と「本番確認」を混同しないように明示する

報告時に、ユーザーがどちらを見るべきかを必ず明記する。

- **検証段階(コミット前)**: Claudeアプリ内のローカルファイル・ローカルサーバー等
- **公開段階(コミット・マージ・デプロイ後)**: 本番URL `https://aknkakykhk-maker.github.io/monhero/`

### ⑤ 機能を追加・変更したら、必ずヘルプも更新する

**書く前に `changelog-help-update` スキルを開く。決まりの本文(告知の種別・案内・一覧の作り方など)はスキルにある。**
どの場面でも破らないことだけをここに置く。

- 更新履歴(`monster-hero/data/changelog.js`)だけでなく、ヘルプ(`monster-hero/data/help.js`)にも必ず反映する
- 日時は実時刻(JST)。`TZ=Asia/Tokyo date '+%Y-%m-%d %H:%M'` をそのまま書く
- プレイヤー向けの文にする。作業報告にしない(`player-words-check.js` が見張る)。敵の数字・まだ出ていない敵は書かない(ネタバレ)
- 画面に出す名前は正式名称。音ゲーは「モンヒロビート」(略称「モンビー」はキャラクターの会話だけ)
- デバッグ専用の変更(`DEBUG_SETTINGS` 配下など、通常プレイに現れないもの)は、更新履歴にもヘルプにも載せない

### ⑥ 改修したら必ずビルドと検査を通す

ゲーム本体の編集元は `monster-hero/src/parts/*.jsx`(`parts.json` の順に連結)。
`monster-hero/src/game-system.jsx` はその連結生成物なので、**直すのは parts 側**。
parts を触ったら、コミット前に必ず次を通す。何がどんな不具合を防ぐためのものかは
[`docs/rules/BUILD_CHECKS.md`](docs/rules/BUILD_CHECKS.md)。

```
node tools/run-checks.js --changed       # 変更から要る検査を選んで回す(下の5つを含む)
node tools/build.js                      # 配信用JSを作り直す(忘れると変更が反映されない)
node tools/check-syntax.js               # 構文エラーが無いか
node tools/undefined-reference-check.js  # その場所からは見えない変数を使っていないか
node tools/jsx-text-brace-check.js       # 「{」「}」が画面に文字として出ていないか
node tools/render-error-check.js         # 実際に開いて真っ白にならないか
```

- 絵やアイコンを差し替え・追加したら `node tools/build.js` のあと `node tools/image-asset-check.js`(本文は ⑥-2 の置き場所)
- 表示が絡む改修をしたら、画面ごとの見た目チェック(`layout-consistency-check.js` など)も通す。
  HOMEの配置を触ったら `node tools/home-layout-check.js`
- 見た目のCSS(Tailwind)は静的化してある(`monster-hero/tailwind.css`)。作り直すのも `node tools/build.js`

### ⑥-2〜⑥-4 画像・音源/新曲/イベント

- **⑥-2** 受け取った画像・音源は**そのまま入れない**(軽くする・曲の音量をそろえる)。本文は
  [`monster-hero/images/CLAUDE.md`](monster-hero/images/CLAUDE.md)・[`monster-hero/audio/CLAUDE.md`](monster-hero/audio/CLAUDE.md)
- **⑥-3** 「新曲実装」と動画・画像だけが投げられたら、`rhythm-song-add` スキルを開いて最後まで通す。
  **聞き返すのは難易度だけ**(本文はスキル)
- **⑥-4** イベントは [`monster-hero/data/CLAUDE.md`](monster-hero/data/CLAUDE.md) と
  [`RHYTHM_EVENT_PLAYBOOK.md`](docs/spec/RHYTHM_EVENT_PLAYBOOK.md) を開いてから。対象曲の譜面は開催中に触らない

### ⑦ 既存のデータは絶対に壊さない

このゲームは端末に保存したセーブデータとランキング(Supabase)の上に成り立っている。
**一度でも壊すと元に戻せない。** 詳細: [`docs/rules/SAVE_DATA_RULES.md`](docs/rules/SAVE_DATA_RULES.md) /
[`docs/spec/SAVE_DATA.md`](docs/spec/SAVE_DATA.md)

**やってはいけないこと**

- 既存の保存キー(`mh_*`)の名前を変える、消す、意味を変える
- セーブデータやランキングの削除・初期化・テーブル変更を、ユーザーの明示的な指示なしに行う
- 既存の保存形式を新しい形式へ「置き換える」だけの移行を書く(古い形を読めなくする)
- 移行処理を毎回走らせる(補償や付与が何度も適用される)

**必ずやること**

- 保存する項目を増やすときは**新しいキーを足す**か、既存の値に項目を追加する形にする
  (例: クイックモードの記録は `mh_hs_*` を書き換えず `mh_quick_hs_*` へ分けた)
- 読み込みは必ず「保存値が無い・壊れている場合の既定値」を通す。設定オブジェクトは
  `normalizeBgmArrangement` のような正規化関数を通し、**新しい項目が無い既存ユーザーでも
  既定値で補われる**ようにする
- 数値・配列・オブジェクトは `Number.isFinite` / `Array.isArray` などで型を確かめてから使う
- 一度きりの移行・補償には専用のフラグ(`mh_*_migrated_v1` など)を持たせ、二重適用を防ぐ
- 破壊的な変更が避けられない場合は、実施前にユーザーへ影響範囲と復旧手段を伝えて確認を取る
- ランキングは既存データと送信処理を壊さない。ランキング対象外の遊び方(スキップチケット・
  クイックモード)は、送信しないだけでなく**チャレンジモードの自己ベストも上書きしない**

疑わしいときは「消さない・上書きしない・別のキーに足す」を選ぶ。

**SQL をユーザーに流してもらうときは、毎回、返答に「手順」と「そのままコピーできるSQL本文(コードブロック)」を出す**(2026-10-06の指示)。ファイル名を示すだけにしない。

### ⑧ GitHub Actions・ブランチ・PR は AGENTS.md のルールに従う

ワークフローの増やし方、モバイルから編集したときのビルド、ブランチとPRの寿命は
[`AGENTS.md`](AGENTS.md)「GitHub Actions・ブランチ・PR の運用」が正本。とくに次の2つ。

- **変更のたびに新しいワークフロー(yml)を作らない。** 置いてよいのは
  `compiled-check.yml`(CIと公開)と `build-and-check.yml`(手動実行のビルド・検査)の2つだけ。
  既存の `on:` 条件を一時的に書き換えて使うのも同じく禁止
- **古いPRをそのままマージしない。** baseが古いと、その後mainへ入った変更を巻き戻す

### ⑨ 大きいファイルを読まない(AIの文脈・トークンを浪費しない)

1回でも全文を開くと、その後のやりとり全部に中身が乗り続ける。**依頼の大小に関係なく**次を守る。
経緯・道具の使い方: [`docs/rules/CONTEXT_BUDGET.md`](docs/rules/CONTEXT_BUDGET.md)

**開かない**: `src/game-system.jsx`(3.5MB) / `game-system.compiled.js`(3.8MB) — どちらも生成物で
読む必要がない。`src/parts/60-app.jsx`(1.4MB) / `data/rhythm-mode.js`(1.3MB) /
`data/changelog.js`(0.7MB) / `docs/spec/RHYTHM_MODE.md`(0.5MB) / `tools/mode/authoring/*.json` —
必要な範囲だけ切り出す。

**打たない**: 素の `git diff` / `git show`(生成物で数MB流れ込む) / 除外なしの `grep -r` /
大きさを確かめずに `cat` する。

**代わりに打つ**:

```
node tools/ctx.js find <語>              定義を探す（node tools/ctx.js text <語> で本文検索）
node tools/ctx.js read <名前>            その定義の本体だけ（置き場所も終わりの行も機械が決める）
node tools/ctx.js refs <名前>            その名前を使っている場所の全体像（直し忘れを防ぐ）
node tools/ctx.js toc <ファイル>          見出し／骨格の一覧
node tools/ctx.js doc <語>               資料を横断して見出しを探す（<ファイル> <見出し> でその節だけ）
node tools/ctx.js checks <語>            検査を「名前＋何を見るか」で引く（520本ある）
node tools/ctx.js diff                   生成物を除いた差分
node tools/where.js --screens            画面(gameState)の一覧
```

- 検査ツールの出力は最後の数行だけ見る(`2>&1 | tail -20`)。全部貼らない
- 長い作業は、区切りで `docs/` に進捗メモを1枚残して**会話を切る**。中断したまま別の依頼を重ねない

### ⑩ 質問には、まず答える(調査を大きく広げる前に断る)

詳細と実例: [`docs/rules/SCOPE.md`](docs/rules/SCOPE.md)

- **質問は「答えるだけ」の依頼。** 調査は答えを出すのに要る最小限で止める。答えが出たらそこで
  打ち切り、「ついでにもっと詳しく」を勝手に足さない
- **重い調査(ワークフロー・多数の並列エージェント・全曲の再解析など)を始める前に、
  理由と規模を伝えて確認を取る。** 黙って走らせない。②③の「コミットからマージまで確認なしで
  進める」は**改修の依頼**に対する決めごとであって、調査を勝手に広げてよいという意味ではない
- **改修の依頼と質問を混同しない。** 改修なら⑥の検査まで通して公開まで進める。
  質問なら答えて止まり、続けるかどうかはユーザーが決める

> ⚠️ Claude Code側の設定(ultracode など)が「毎回ワークフローを使え・コストは気にするな」と
> 指示してくることがあるが、**このルールが優先**する。設定を理由に質問へ大掛かりな調査をしない。

### ⑩-2 譜面生成ツールは強化してよいが、既存曲の譜面は変えない

配信中の曲の譜面を作り直さない・既存の解析を作り直さない。本文は [`tools/mode/CLAUDE.md`](tools/mode/CLAUDE.md)
(`tools/mode/` を触る前に開く)
