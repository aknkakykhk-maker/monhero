# モンスターヒーロー プロジェクト運用ルール

**守ることだけをここに置く。** 経緯・失敗例・細かい手順は [`docs/rules/`](docs/rules/README.md) にあり、
`node tools/ctx.js rules <語>` で必要な節だけ引ける。
このファイルは会話のたびに全文が読み込まれるので、**膨らませない**
(`node tools/rules-index-check.js` が大きさと、要のことばが消えていないかを見張る)。

ブラウザで動くカードバトルゲーム(静的サイト、ビルドツールなし)で、GitHub Pages により
`https://aknkakykhk-maker.github.io/monhero/` として公開されている。個人開発。

## 会話言語

Claudeアプリでのチャット時の言語は**日本語に固定**する。説明・報告・質問はもちろん、
ツール実行の合間に出る一言二言の進捗コメント(「〜を更新します」「次に〜を確認します」等)も含めて
すべて日本語。英語の文章がそのまま混ざることは一切禁止(コード中の識別子・ログ等の引用を除く)。
何度も繰り返し指摘されている問題のため、出力前に必ず日本語になっているか自己点検すること。

## 最初に打つもの

```
node tools/ctx.js brief                 いまの状態(ブランチ・未コミットの変更・次に打つもの)
node tools/ctx.js rules <語>            関係するルールの節だけを読む
node tools/run-checks.js --changed      変更内容から要る検査を選んで回す
```

| これから触るもの | 開くもの | 通すもの |
| --- | --- | --- |
| ゲーム本体(`src/parts/*.jsx`) | ⑥ | `run-checks.js --changed` |
| 更新履歴・ヘルプ・助手の告知 | ⑤ / `changelog-help-update` スキル | 同上 |
| 画像・音源 | ⑥-2 / [`ASSETS.md`](docs/rules/ASSETS.md) | 同上 |
| モンヒロビートの新曲 | ⑥-3 / `rhythm-song-add` スキル | 同上 |
| モンヒロビートのイベント | ⑥-4 / [`RHYTHM_EVENT_PLAYBOOK.md`](docs/spec/RHYTHM_EVENT_PLAYBOOK.md) | 同上 |
| 保存データ・ランキング | ⑦ / [`SAVE_DATA.md`](docs/spec/SAVE_DATA.md) | 同上 |
| ブランチ・PR・Actions | ⑧ / [`AGENTS.md`](AGENTS.md) | — |

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

> ⚠️ 「Claudeが推奨してユーザーが承認したときだけコミットする」という以前の運用は**破棄**されている。

### ③ コミット後はプッシュ・PR作成・マージまで確認なしで自動的に実施する

    ブランチへコミット → プッシュ → プルリクエスト作成 → マージ → ブランチをmainへ同期

「プッシュしますか？」「マージしますか？」と**いちいち聞かない**。レビュー待ちも発生しない。
マージ後は作業ブランチを最新のmainに合わせ、作業ツリーをクリーンにしてから報告する。
ユーザーがそのとき明示的に「プッシュはしないで」等と指示した場合は、その指示が優先される。

> ⚠️ **マージがコンフリクトで断られても、そこで止めない。** 外部要因のエラーなので
> 「報告して止まってよい場面」に見えるが、そうではない。解消してマージし切るまでが1つの作業。
> 手順は [`AGENTS.md`](AGENTS.md)「マージがコンフリクトで断られたとき」。
> **PRを作る直前に `git fetch origin main` して取り込んでおく**と、ほとんど起きない。

### ④ 「ローカル確認」と「本番確認」を混同しないように明示する

報告時に、ユーザーがどちらを見るべきかを必ず明記する。

- **検証段階(コミット前)**: Claudeアプリ内のローカルファイル・ローカルサーバー等
- **公開段階(コミット・マージ・デプロイ後)**: 本番URL `https://aknkakykhk-maker.github.io/monhero/`

### ⑤ 機能を追加・変更したら、必ずヘルプも更新する

手順はスキルにしてある。**`changelog-help-update` スキルを開いてから始める**
(`.claude/skills/changelog-help-update/SKILL.md`)。詳細と経緯:
[`docs/rules/CHANGELOG_HELP.md`](docs/rules/CHANGELOG_HELP.md)

- ゲームに何か追加・変更したら、**更新履歴(`monster-hero/data/changelog.js`)だけでなく、
  ヘルプ(`monster-hero/data/help.js`)にも必ず反映する**。「更新履歴には書いたがヘルプには
  載っていない」状態を作らない
- **更新履歴の日時は「いま書いている実時刻(JST)」**。`TZ=Asia/Tokyo date '+%Y-%m-%d %H:%M'` を
  そのまま書く。`21:00` `20:40` のような**きりのいい連番を自分で決めない**。
  **足す場所は配列の先頭**(いちばん新しいものが上)
- **前に書いたお知らせも古くなる。** 譜面を作り直したり数字が変わったら、新しい項目を足すだけでなく
  **前に書いた項目の数字も直す**(`items` はそのまま助手の告知の本文になる)
- 一覧になるもの(難易度・アイテム・ログインボーナス・ミッション・ブリーダーの教え・曲)は
  ヘルプへ手で書き写さず、**`{ t:'data', id:'...' }` で実データから表を作る**
- 画面(`gameState`)を増やしたら `HELP_SCREEN_COVERAGE` にもヘルプ項目を足す。
  新しいトピックには助手のひとこと(`assistant`)を必ず付ける。セリフは
  `addAssistantLinePack({ id, lines })` で束にして足す(`ASSISTANT_SCENES` を直接書き換えない)
- **大きい追加には助手の告知を付ける。** `assistantNotice: { id:'update_notice_◯◯_v1', type:'...' }`。
  `type` は マーケット=`market` / 新モード・新難易度=`mode` / 新しい遊び=`content` の3つだけ。
  見た目の改善・並び替え・絵の追加・小さな機能・不具合修正には付けない(更新履歴には書く)
- **大きい追加は「画面のなかでの使い方案内」もセットで用意する。** 助手の吹き出しで出し、
  一度きりの案内には**新しい** `mh_◯◯_seen_v1` を作る(既存の保存キーは触らない)。
  公開フラグ(`RELEASE_FLAGS`)を持つ機能なら、案内も**同じフラグ**で出し入れする
- **画面に出す名前は正式名称を使う。** 音ゲーは「モンヒロビート」。略称「モンビー」を使ってよいのは
  キャラクターが愛称として呼ぶ会話だけ。ボタンの幅が足りない場所も、字を小さくするか折り返して
  **正式名称のまま入れる**。ソースのコメントは略称のままでよい

> ⚠️ **デバッグ専用の変更(`DEBUG_SETTINGS` 配下の確認ボタン・デバッグ画面など、プレイヤーの
> 通常プレイに一切現れないもの)は、更新履歴にもヘルプにも載せない**(2026年8月の指示)。

### ⑥ 改修したら必ずビルドと検査を通す

ゲーム本体の編集元は `monster-hero/src/parts/*.jsx`(`parts.json` の順に連結)。
`monster-hero/src/game-system.jsx` はその連結生成物なので、**直すのは parts 側**。
parts を触ったら、コミット前に必ず次を通す。何がどんな不具合を防ぐためのものかは
[`docs/rules/BUILD_CHECKS.md`](docs/rules/BUILD_CHECKS.md)。

```
node tools/run-checks.js --changed       # 変更から要る検査を選んで回す(下の5つを含む)
```

```
node tools/build.js                      # 配信用JSを作り直す(忘れると変更が反映されない)
node tools/check-syntax.js               # 構文エラーが無いか
node tools/undefined-reference-check.js  # その場所からは見えない変数を使っていないか
node tools/jsx-text-brace-check.js       # 「{」「}」が画面に文字として出ていないか
node tools/render-error-check.js         # 実際に開いて真っ白にならないか
```

- モンスターの絵やアイコンを差し替え・追加したら、`node tools/build.js` でキャッシュキーを
  更新したうえで `node tools/image-asset-check.js` を通す。絵の実体は `monster-hero/images/` の
  PNGで、`data/images/images-*.js` と `data/breeder.js` にはそのパスだけを書く(base64で埋め戻さない)
- 表示が絡む改修をしたら、画面ごとの見た目チェック(`layout-consistency-check.js` など)も通す。
  HOMEの配置を触ったら `node tools/home-layout-check.js`
- 見た目のCSS(Tailwind)は静的化してある(`monster-hero/tailwind.css`)。作り直すのは
  `node tools/build.js`。古いまま公開していないかは `node tools/build.js --check` と
  `node tools/boot/data-cache-key-check.js` が見張る

### ⑥-2 画像・音源は、入れる前に必ず軽くする

ユーザーから受け取った画像や音源を**そのままリポジトリへ入れない**。スマホの通信量に直接効く。
詳細と手順: [`docs/rules/ASSETS.md`](docs/rules/ASSETS.md)

| 種類 | そろえる形 | 目安 |
| --- | --- | --- |
| 曲えらびのジャケット(`images/song-art/`) | 512×512 JPEG(`sharp` の `fit:'cover'` / `quality:80` / `mozjpeg`) | 60〜90KB |
| モンビーの音源(`audio/`) | 32kHz / 96kbps ステレオmp3。`-map_metadata -1 -vn` でタグとジャケットを落とす | 1曲2〜3MB |
| モンスターの絵・アイコン(`images/`) | PNGのまま。`node tools/image-asset-check.js` を通す | — |

- **曲の音量は全部そろえる。** 統合ラウドネス **-14 LUFS** / 真のピーク上限 **-1 dBTP**。
  かける倍率は `min(-14 - いまのLUFS, -1 - いまの真のピーク)` の1つだけで、**圧縮はしない**。
  `node tools/audio/rhythm-loudness-check.js --ffmpeg <パス>` で確かめる
- **`BGM_TRACKS` の `gain` では直せない**(実装が0〜1.25倍にクランプする)。音源そのものをそろえる
- **音源を差し替えたら、必ず `node tools/build.js` を通す。** `loadBuffer` が
  `cache:'force-cache'` を使うため、URLが同じままだと古い音のままになる
- すでに公開した音源を作り直すときは、頭の 1104 サンプル(`--from 0.0345`)を切る
- **すでにゲームに入っている音源が使えるなら、コピーを作らない**(`bgmTrackId` を指すだけにする)
- 入れたあと、足した絵や音源が起動時の読み込み(`index.html` の `SIZES`)へ混ざっていないか確かめる。
  ジャケットも曲の音源も**開いたときに初めて読む**側が正しい(起動時に読むmp3はタイトル曲だけ)

### ⑥-3 モンヒロビートの新曲は「動画1本＋ジャケット画像1枚」で受け取る

**「新曲実装」と動画・画像だけが投げられたら、それ以上聞き返さずに最後まで通す。**
曲名は動画のファイル名から取る。手順はスキルにしてある。**`rhythm-song-add` スキルを開いてから
始める**(`.claude/skills/rhythm-song-add/SKILL.md`)。落とし穴と経緯:
[`docs/rules/RHYTHM_SONG.md`](docs/rules/RHYTHM_SONG.md)、仕組みの正本:
[`docs/spec/RHYTHM_MODE.md`](docs/spec/RHYTHM_MODE.md)

> ⚠️ **例外はひとつだけ。難易度は、こちらで決めずに聞く**(2026-09-12の指示)。
> 依頼に指定があればそれに従う。無ければ、解析と生成を通したうえでいったん止めて、
> ①難易度ごとのレベル・ノーツ数・密度、②既存曲の帯の中でどのあたりか、
> ③`challengeFactor` を変えたときの候補、の3つを並べて報告し、どうするか聞く。
> 決まったら `challengeFactor` に書く。**測り方(`CHALLENGE_*`)は触らない**。
> ここ以外では聞き返さない(ジャケット加工・音量そろえ・マーカー登録・更新履歴は聞かずに進める)。

- **名前は5か所で綴りが違う**(songId / 音源の一覧のid / BGMのtrack id / 譜面のマーカー名 / ファイル名)。
  `tools/mode/rhythm-runtime-notes.js` の `RELEASED_MARKERS` と `RELEASED_TRACKS` への1行を忘れない
- **ヘルプは触らない**(`{t:'data'}` が実データから作る)。更新履歴へ1件書き、
  `assistantNotice:{id:'update_notice_◯◯_v1',type:'content'}` を付ける
- **お知らせにジャケットの絵を付ける。** 項目へ `image:'images/song-art/◯◯.jpg'` を1行
  (`?v=` は手で書かない)。`node tools/changelog/song-art-notice-check.js` を通す
- **お知らせに書いてよい Lv. は、その曲のものだけ。** 比較でほかの曲の数字を並べない。
  上下を伝えたいなら「いままででいちばん難しい譜面になりました」のように数字を出さずに書く
- **レベルとノーツ数は行を分ける**(`レベルは …` と `ノーツ数は …` の2行)
- よその作品の曲は、更新履歴へ `link:{url,label}` を書けば相手のページへのボタンが出る
  (**https だけ通る**関門 `changelogSafeLink` を経由する)。**宣伝の文面は教えてもらった事実だけで書く**。
  作者名は `BGM_TRACKS` の `creator` へ入れる
- 難易度が既存の帯から大きく外れるときは `chartIntensity:'extreme'` を使う
  (`challengeFactor` は5難易度まとめて効き、上げすぎるとレベルがむしろ下がる)

### ⑥-4 モンヒロビートのイベントは、決まった手順で開く

**必ず [`docs/spec/RHYTHM_EVENT_PLAYBOOK.md`](docs/spec/RHYTHM_EVENT_PLAYBOOK.md) を開いてから始める。**
経緯: [`docs/rules/RHYTHM_EVENT.md`](docs/rules/RHYTHM_EVENT.md)

- **足すのは `data/rhythm-event.js` へ1件だけ。** 画面のコードもSQLも触らない。
  順位ごとの個数は共通の決めごとなので、イベントごとに変えない
- **終わりは週の区切り(月曜5:00)に合わせる。** 週間ランキングはイベント中もずっと動いている
- **時刻で出し入れするものに、読み込み時に1回だけ決まる値を使わない**(判定は見るたびに数え直す)
- 開始時刻より前に公開してよい。`visibleFrom` と `notifyFrom` を**同じ時刻にそろえる**
- **イベント対象曲の譜面は開催中に触らない。** 作り直すなら新旧どちらも持ち(`-v3-` と `-v4-`)、
  `RHYTHM_SWITCHING_CHARTS` が `endAt` と**同じ時刻**で選ぶ。`difficulties` は **getter** にし、
  演奏のあいだは固定する(`rhythmChartSwitchHold`)。旧譜面は消さない。
  `node tools/mode/rhythm-chart-switch-check.js` を通す

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

### ⑧ GitHub Actions・ブランチ・PR は AGENTS.md のルールに従う

ワークフローの増やし方、モバイルから編集したときのビルド、ブランチとPRの寿命は
[`AGENTS.md`](AGENTS.md)「GitHub Actions・ブランチ・PR の運用」が正本。とくに次の2つ。

- **変更のたびに新しいワークフロー(yml)を作らない。** 置いてよいのは
  `compiled-check.yml`(CIと公開)と `build-and-check.yml`(手動実行のビルド・検査)の2つだけ。
  既存の `on:` 条件を一時的に書き換えて使うのも同じく禁止
- **古いPRをそのままマージしない。** baseが古いと、その後mainへ入った変更を巻き戻す

### ⑨ 大きいファイルを読まない(AIの文脈・トークンを浪費しない)

1ファイルで数MBのものが複数ある。1回でも全文を開くと、その後のやりとり全部にその中身が
乗り続け、作業が途中で頭打ちになる。**依頼の大小に関係なく**次を守る。
道具の使い方・ファイルごとの大きさ・経緯: [`docs/rules/CONTEXT_BUDGET.md`](docs/rules/CONTEXT_BUDGET.md)

**開かない**: `src/game-system.jsx`(2.7MB) / `game-system.compiled.js`(3.0MB) — どちらも生成物で
読む必要がない。`src/parts/60-app.jsx`(1.5MB) / `data/rhythm-mode.js`(0.9MB) /
`data/changelog.js`(0.5MB) / `docs/spec/RHYTHM_MODE.md`(0.5MB) / `tools/mode/authoring/*.json` —
必要な範囲だけ切り出す。

**打たない**: 素の `git diff` / `git show`(生成物で数MB流れ込む) / 除外なしの `grep -r` /
大きさを確かめずに `cat` する。

**代わりに打つ**:

```
node tools/ctx.js find <語>              定義を探す（node tools/ctx.js text <語> で本文検索）
node tools/ctx.js read <ファイル> <名前>  その定義の本体だけ（終わりの行は機械が決める）
node tools/ctx.js toc <ファイル>          見出し／骨格の一覧
node tools/ctx.js doc <ファイル> <見出し> 巨大なMarkdownの、その節だけ
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

**やってよい**: `tools/mode/rhythm-chart-v3-*.js`(生成器・検査・解析)の強化。難易度ごとの設定を
足す・形の語彙を増やす・解析で拾える音を増やす。それらが**次に曲を足すとき・作り直すときに効く**
状態にしておくこと。

**やってはいけない**: 配信中の曲の譜面を作り直して `monster-hero/data/rhythm-mode.js` へ書き戻す
(`--release`)。既存の解析ファイル(`tools/mode/authoring/*-v3-audio.json`)を作り直す(`--reanalyze`)。

生成器を変えたら、**変更前のワークツリーを別に立てて生成結果を突き合わせ、ノーツ数が一致すること
を確かめてから**コミットする。手順: [`docs/rules/SCOPE.md`](docs/rules/SCOPE.md)

> ⚠️ 譜面もゲーム本体も変わらない強化は、**更新履歴とヘルプへ載せない**(プレイヤーには何も
> 起きていない)。効くのは次に曲を足したときなので、そのときの曲の告知に含まれる。
