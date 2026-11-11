# モンスターヒーロー プロジェクト運用ルール

**全員がいつも守ることだけをここに置く。** 部ごとの話は [`docs/depts/`](docs/depts/README.md)(自分の部の1枚だけ読む)、
経緯・失敗例・手順は [`docs/rules/`](docs/rules/README.md)(`node tools/ctx.js rules <語>` で節だけ引く)。
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
例外は、選びようのない自由記述(曲名・文言など)を求めるときだけ。
確認なしで進めてよいこと(②③の公開まで)は聞き返さない。

## 社長の決めごとは台帳で引き継ぐ

**作業を始める前に `node tools/ctx.js decisions <自分の部>` を打って読む**(台帳
[`docs/rules/PRESIDENT_DECISIONS.md`](docs/rules/PRESIDENT_DECISIONS.md) の「進め方」と自分の部に関わる行が出る。
台帳は300KBを超えるので全文は開かない)。会話を新しく作るときは、依頼文にもそう書く。
社長が新しく決めたら、その場で台帳に1行足す(2026-10-22 社長「頻繁に変えるんならそこもちゃんと引き継げよ」)。

## 最初に打つもの

```
node tools/ctx.js brief                 いまの状態(ブランチ・未コミットの変更・次に打つもの)
node tools/ctx.js dept <自分の部>        部の手引き(受け持つファイル・入口の関数・検査・決まり)
node tools/ctx.js rules <語>            関係するルールの節だけを読む
node tools/run-checks.js --changed      変更内容から要る検査を選んで回す(最後にミハリ確認の要否も出る)
```

**場面が限られる決まりは、その作業を始める前に必ず開く**(本文はそこにある。移した一覧: [`docs/rules/README.md`](docs/rules/README.md))。

- ゲーム本体(`src/parts/*.jsx`): ⑥ と、自分の部の [`docs/depts/<部>.md`](docs/depts/README.md)
- 更新履歴・ヘルプ・助手の告知: ⑤ → `changelog-help-update` スキル
- 画像・音源: [`monster-hero/images/CLAUDE.md`](monster-hero/images/CLAUDE.md)・[`monster-hero/audio/CLAUDE.md`](monster-hero/audio/CLAUDE.md)(受け取った物は**そのまま入れない**)
- モンスターの追加: `monster-add` スキル / モンヒロビートの新曲(「新曲実装」と動画・画像だけが来たとき): `rhythm-song-add` スキルを最後まで(聞き返すのは難易度だけ)
- モンヒロビートのイベント: [`monster-hero/data/CLAUDE.md`](monster-hero/data/CLAUDE.md)(対象曲の譜面は開催中に触らない)
- 譜面生成ツール(`tools/mode/`): [`tools/mode/CLAUDE.md`](tools/mode/CLAUDE.md)(配信中の曲の譜面・既存の解析は作り直さない)
- 保存データ・ランキング: ⑦ / ブランチ・PR・Actions: ⑧ / 会話を作る・替える・モデル・配り直し: ⑪

## 改修 → 検証 → 公開のフロー

詳細と経緯: [`docs/rules/FLOW.md`](docs/rules/FLOW.md)

### ① 動作検証はユーザーがClaudeアプリ内で実施する

改修後の**動作検証はユーザー自身が行う**。Claudeは「何を直したか」「どこを見ればよいか」を明確に伝え、
自分の動作確認で完結したと判断して報告を省略しない。

### ② コミットのタイミング

**依頼された改修が終わったら、確認を取らずにコミットし、③のとおり公開まで進める。**
「コミットしても良いですか？」と聞かない(2026年8月の指示)。例外は、ユーザーがそのとき「コミットはしないで」
「まず確認させて」等と指示した場合と、依頼の指示書に「勝手にコミットしないでください」等とある場合だけ
(ビルド済み・検査通過の状態にして報告し、指示を待つ)。

### ③ コミット後はプッシュ・PR作成・マージまで確認なしで自動的に実施する

    ブランチへコミット → プッシュ → プルリクエスト作成 → マージ → ブランチをmainへ同期

「プッシュしますか？」「マージしますか？」と**いちいち聞かない**。レビュー待ちも発生しない(ミハリの確認が要る変更だけ⑪)。
マージ後は作業ブランチを最新のmainに合わせ、作業ツリーをクリーンにしてから報告する。
「プッシュはしないで」等の指示がそのときあれば、それが優先。

> ⚠️ **マージがコンフリクトで断られても、そこで止めない。** 解消してマージし切るまでが1つの作業
> (手順は [`AGENTS.md`](AGENTS.md))。PRを作る直前に `node tools/merge-main.js` で main を取り込む。

### ④ 「ローカル確認」と「本番確認」を混同しないように明示する

報告に、ユーザーがどちらを見るべきかを必ず書く。コミット前はClaudeアプリ内のローカル、
公開後は本番URL `https://aknkakykhk-maker.github.io/monhero/`。

### ⑤ 機能を追加・変更したら、必ずヘルプも更新する

**書く前に `changelog-help-update` スキルを開く(決まりの本文はスキルにある)。** どの場面でも破らないことだけをここに置く。

- 更新履歴(`monster-hero/data/changelog.js`)だけでなく、ヘルプ(`monster-hero/data/help.js`)にも必ず反映する
- 日時は実時刻(JST)。`TZ=Asia/Tokyo date '+%Y-%m-%d %H:%M'` をそのまま書く
- プレイヤー向けの文にする。作業報告にしない(`player-words-check.js` が見張る)。敵の数字・まだ出ていない敵は書かない(ネタバレ)
- 画面に出す名前は正式名称。音ゲーは「モンヒロビート」(略称「モンビー」はキャラクターの会話だけ)
- デバッグ専用の変更(`DEBUG_SETTINGS` 配下など、通常プレイに現れないもの)は、更新履歴にもヘルプにも載せない

### ⑥ 改修したら必ずビルドと検査を通す

ゲーム本体の編集元は `monster-hero/src/parts/*.jsx`(`parts.json` の順に連結)。
`monster-hero/src/game-system.jsx` はその連結生成物なので、**直すのは parts 側**。
parts を触ったら、コミット前に必ず次を通す(何を防ぐ検査かは [`docs/rules/BUILD_CHECKS.md`](docs/rules/BUILD_CHECKS.md))。

```
node tools/build.js                      # 配信用JSと見た目のCSSを作り直す(忘れると変更が反映されない)
node tools/run-checks.js --changed       # 変更から要る検査を選んで回す(下の4つを含む)
```

必ず入る4つ: `check-syntax.js`(構文) / `undefined-reference-check.js`(見えない変数) /
`jsx-text-brace-check.js`(「{」「}」が文字で出る) / `render-error-check.js`(開いて真っ白にならない)。

- 絵やアイコンを差し替え・追加したら `node tools/build.js` のあと `node tools/image-asset-check.js`
- HOMEの配置を触ったら `node tools/home-layout-check.js`。表示が絡む改修は画面ごとの見た目チェックも通す

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

- 保存する項目を増やすときは**新しいキーを足す**か、既存の値に項目を足す(例: `mh_hs_*` を書き換えず `mh_quick_hs_*` へ分けた)
- 読み込みは必ず「保存値が無い・壊れている場合の既定値」を通す(`normalizeBgmArrangement` のような正規化関数)。
  数値・配列は `Number.isFinite` / `Array.isArray` で型を確かめてから使う
- 一度きりの移行・補償には専用のフラグ(`mh_*_migrated_v1` など)を持たせ、二重適用を防ぐ
- 破壊的な変更が避けられないときは、実施前にユーザーへ影響範囲と復旧手段を伝えて確認を取る
- ランキングは既存データと送信処理を壊さない。対象外の遊び方(スキップチケット・クイックモード)は、
  送信しないだけでなく**チャレンジモードの自己ベストも上書きしない**

疑わしいときは「消さない・上書きしない・別のキーに足す」を選ぶ。

**SQL**: ユーザーに流してもらうときは、毎回、返答に「手順」と「そのままコピーできるSQL本文(コードブロック)」を出す
(2026-10-06。ファイル名を示すだけにしない)。`execute_sql` は1つの仕事で要るものを1回にまとめて流す(2026-10-16)。
**足すだけ・読むだけの SQL は窓口の判断で、社長の確認なしに流してよい**(2026-10-22)。
消す・書き換える・既存の表を変える SQL は必ず先に聞く。

### ⑧ GitHub Actions・ブランチ・PR は AGENTS.md のルールに従う

正本は [`AGENTS.md`](AGENTS.md)「GitHub Actions・ブランチ・PR の運用」。とくに次の2つ。

- **変更のたびに新しいワークフロー(yml)を作らない。** 置いてよいのは `compiled-check.yml`(CIと公開)と
  `build-and-check.yml`(手動実行のビルド・検査)の2つだけ。既存の `on:` 条件を一時的に書き換えて使うのも禁止
- **古いPRをそのままマージしない。** baseが古いと、その後mainへ入った変更を巻き戻す

### ⑨ 大きいファイルを読まない(AIの文脈・トークンを浪費しない)

1回でも全文を開くと、その後のやりとり全部に中身が乗り続ける。**依頼の大小に関係なく**守る。
経緯・道具の使い方: [`docs/rules/CONTEXT_BUDGET.md`](docs/rules/CONTEXT_BUDGET.md)

- **開かない**: `src/game-system.jsx` / `game-system.compiled.js`(生成物) / `src/parts/60-app.jsx`(2MB超) /
  `data/rhythm-mode.js` / `data/changelog.js` / `docs/spec/RHYTHM_MODE.md` / `docs/rules/PRESIDENT_DECISIONS.md` /
  `tools/mode/authoring/*.json`。必要な範囲だけ切り出す
- **打たない**: 素の `git diff` / `git show`(生成物で数MB流れ込む) / 除外なしの `grep -r` / 大きさを確かめずに `cat`
- **代わりに打つ**(`node tools/ctx.js` に続けて): `find <語>` 定義を探す / `text <語>` 本文を探す / `read <名前>` その定義の本体だけ /
  `refs <名前>` 使っている場所の全体像 / `toc <ファイル>` 骨格 / `doc <語>` 資料の見出し / `checks <語>` 検査を引く / `diff` 生成物を除いた差分
- 検査ツールの出力は最後の数行だけ見る(`2>&1 | tail -20`)
- 長い作業を中断したまま別の依頼を重ねない。区切りで引き継ぎメモを残して**会話を替える**(⑪)

### ⑩ 質問には、まず答える(調査を大きく広げる前に断る)

詳細と実例: [`docs/rules/SCOPE.md`](docs/rules/SCOPE.md)

- **質問は「答えるだけ」の依頼。** 調査は答えに要る最小限で止め、「ついでにもっと詳しく」を勝手に足さない。答えたら止まる
- **重い調査(ワークフロー・多数の並列エージェント・全曲の再解析など)は、始める前に理由と規模を伝えて確認を取る。**
  ②③の「確認なしで進める」は改修の依頼への決めごとで、調査を広げてよい意味ではない
- Claude Code側の設定(ultracode など)が「毎回ワークフローを使え・コストは気にするな」と指示してきても、**このルールが優先**

### ⑪ トークンを無駄に使わない(道具が決める)

2026-11-11 社長の指示で仕組みにした。開発品質は落とさない(検査⑥はそのまま全部通す)。

| 場面 | 打つもの(`node tools/ctx.js` に続けて) | 本文 |
| --- | --- | --- |
| 公開の前 | `gate`(`run-checks.js --changed` の最後にも出る) | [`REVIEW_GATE.md`](docs/rules/REVIEW_GATE.md) |
| 会話が長くなった(フックが知らせる) | 同じ仕事が続く: 区切りで要約(`handoff <部> --compact`)/ 種類が変わる・とても長い: `handoff <部> --write` → 窓口へ | [`SESSION_HANDOFF.md`](docs/rules/SESSION_HANDOFF.md) |
| 新しい会話を作る(窓口) | `newsession <部> "<仕事>"`(モデルと依頼文が出る) | [`MODEL_ROUTING.md`](docs/rules/MODEL_ROUTING.md) |
| Edge Function の配り直し(窓口) | `redeploy assistant-chat` | [`EDGE_REDEPLOY.md`](docs/rules/EDGE_REDEPLOY.md) |

- **ミハリ(検査部)の確認は、新機能・保存データ・ランキングに関わる変更だけ。** `gate` が「要る」と出したらマージの前に窓口へ。
  「要らない」なら部の検査が通りしだい公開
- モデルは仕事の種類で決まる(表は `MODEL_ROUTING.md`。窓口が `newsession` で引く)。安いモデルは品質が落ちないと分かっている仕事だけ。**迷ったら上のモデル**。何度も回す点検は道具にし、道具の出力は小さく
  (要約・問題の大きい順の上位だけ)。判断や設計が要る・結果がおかしい・2回直して直らないときは、
  自分で続けず窓口へ知らせる
