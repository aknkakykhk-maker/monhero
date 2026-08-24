# 開発用の検証ツール

`monster-hero/` 本体(GitHub Pages で配信される静的サイト)には含まれない、開発時だけ使う
Node.js 製の検証スクリプト。ビルド工程は無いので、これらを実行してもサイトの中身は一切変わらない。

過去のセッションではこれらを一時ディレクトリ(scratchpad)に置いていたためセッションが変わるたびに
消えて作り直しになっていた。今後はこのディレクトリで管理する。

## セットアップ

```
cd tools && npm ci
```

`@babel/core` / `@babel/preset-react`(JSXの構文チェック・変換用)、`canvas`
(ブラウザのCanvas APIをNode上で再現し、染色マスクの生成を実画像で検証するため)、
`playwright`(実ブラウザでのスモークテスト用)を入れる。
`node_modules/` はコミットしない(`.gitignore` 済み)。

正規ビルドと構文確認だけが必要な Codex クラウドでは、ネイティブ依存を省く
`cd tools && npm ci --omit=optional` を使える。画像・ブラウザ系チェックも行う通常の開発環境では、
上記の `npm ci` ですべてを導入する。

`package-lock.json` を正本として `npm ci` を使う。音声・画像を再圧縮するときだけ使う
`ffmpeg-static` / `sharp` は通常のビルド依存から外しているため、必要な作業環境で
`npm install --no-save ffmpeg-static@5.2.0 sharp@0.34.5` を実行する。これらの大型・ネイティブ依存や
`node_modules/`、生成キャッシュはコミットしない。

Codex クラウドで npm レジストリが 403 を返した場合は、`npm config list` と失敗したパッケージを記録し、
レジストリや変換器を独自に差し替えない。正規ビルド不能でも安全な編集元の変更とコミット、標準の
Push / PR フローまでは進められるが、生成物未同期の PR は配信可能・完了ではない。`main` へマージする前に、
依存を利用できる環境で必ず次の両方を成功させる。

```bash
node tools/build.js
node tools/build.js --check
```

## スクリプト

置き場所は次の2種類だけ。

- **`tools/` 直下** … `CLAUDE.md` の必須手順と CI ワークフローが名指しする定番と、その裏方
  (`build.js` / `harness.js` / `stamp-*.js`)。**ここのファイル名は動かさない。**
  動かすと `CLAUDE.md` と `.github/workflows/compiled-check.yml` の書き換えが必要になり、
  CI は1つでも落ちるとデプロイを黙って飛ばすため、事故がいちばん起きやすい場所になる。
- **`tools/<分類>/`** … それ以外の場面ごとの検査。下の見出しがそのままフォルダ名。

新しいスクリプトを足すときは、まず `tools/<分類>/` へ置く。直下へ足すのは
`CLAUDE.md` の必須手順に加えるときだけ。**この一覧に載っていないスクリプトを作らないこと**
(足したら同じPRでここへ1行足す)。

以下はすべて `tools/` の中で実行する。`node tools/〇〇.js` のようにリポジトリのルートから
呼んでもよい(ルート配信を前提とする実ブラウザ検査は、ルートから呼ぶほうが確実)。

### ビルドと必須検査（`game-system.jsx` を触ったら必ず通す）

| コマンド | 内容 |
| --- | --- |
| `node build.js` | **BUILD_DATE・version.json・更新履歴の最新日時を揃え、game-system.jsx を配信用JSへ変換して `monster-hero/game-system.compiled.js` を書き出す。改修したら必ず実行する。** |
| `node build.js --check` | compiled が jsx と一致しているか確認する(古ければ終了コード1)。出荷前チェック用。 |
| `node check-syntax.js` | `monster-hero/game-system.jsx` をBabelで変換して構文エラーが無いか確認する。**改修後は必ず実行する。** |
| `node undefined-reference-check.js` | `game-system.jsx` が「その場所からは見えない変数」を参照していないか、Babelでスコープをたどって確認する。構文としては正しいので `check-syntax.js` では見つからず、その画面を開いた瞬間だけ真っ白になる類の不具合を防ぐ。**改修後は必ず実行する。** |
| `node jsx-text-brace-check.js` | JSXの中に、閉じ忘れ・閉じすぎでできた「{」「}」がそのまま文字として混ざっていないかを調べる。`{cond&&<div>…</div>}` の開き `{cond&&` を書き忘れると、余った `}` は画面に出る文字として扱われ構文エラーにならない。**改修後は必ず実行する。** |
| `node render-error-check.js` | 画面が真っ白になる類の不具合(JSの実行時エラー)を、実際にブラウザで開いて確かめる。構文も参照先も正しいのに描画した瞬間だけ落ちる(宣言前の定数を読むなど)場合はここでしか止められない。**改修後は必ず実行する。** |
| `node compiled-runtime-check.js` | 配信用コードが `jsxDEV` / automatic JSX runtime など、`index.html` が用意していないランタイムを参照していないことと、React / ReactDOM の読込順を確認する。 |
| `node boot-flow-check.js` | 音声失敗時のTITLE遷移、全画面タイトルタップ、同期的な多重実行防止、GAME準備と演出の並列化を静的に確認する。 |
| `node update-notice-check.js` | 新バージョンの定期検知、常時表示、キャッシュ回避付き更新を静的に確認する。 |
| `node stamp-version.js` | BUILD_DATE、version.json、本体JSのキャッシュキーを現在の日本時間に揃える。手で書くと未来の時刻が入るので必ずこれを使う。 |
| `node stamp-boot-sizes.js` | 起動時に読み込むファイルの実サイズ(バイト)を `index.html` の `__mhBoot` へ書き込む。`build.js` から自動で呼ばれる。 |
| `node boot/data-cache-key-check.js` | index.htmlが読み込むdata/*.jsのキャッシュキーが中身と一致しているか確認する(古いデータが読まれて画面が真っ暗になるのを防ぐ)。 |

### 起動・トップ・はじめての案内

| コマンド | 内容 |
| --- | --- |
| `node boot/boot-check.js` | 起動時の事前ロード画面と、画面遷移でBGMが重ならないことを確認する。 |
| `node boot/boot-progress-check.js` | 起動ローディングのゲージが実際の読み込みに沿って動き、最後に100%へ届くかを確かめる。 |
| `node boot/root-redirect-check.js` | ルートURLがLF APPSを描画せず、`location.replace`でゲームへ直接遷移することを確認する。 |
| `node boot/update-notice-dismiss-check.js` | 新バージョン通知が「押すと更新／×で今回は閉じる」の2択になっているか確認する。 |
| `node boot/ui-preferences-check.js` | 設定値の読み込みを確認する。保存が無ければ従来の初期値、壊れた値なら初期値へ戻ることを見る。 |
| `node boot/new-player-onboarding-check.js` | 空の保存領域から始まる新規プレイヤーの流れ(助手をえらぶ → 選んだ助手のあいさつ → プロフィール設定 → 村の案内)と、途中再開導線・既存プレイヤーへ助手選択を出さないことを確認する。 |
| `node boot/kiki-intro-check.js` | きき加入の会話(既存プレイヤーへ初回ログインで1回だけ)を確認する。台本の掛け合いと固定の呼び方(みゅあ→ひめちん / きき→みゅあちん)、プレイヤー向けの呼び方を使っていないこと、未閲覧フラグだけで判定せずオンボーディング完了と合わせて出していること、新規プレイヤーには出ないこと、会話で助手や仲良し度が変わらないこと、会話画面が発言者ごとの顔と表情で描けて縦画面で見切れないことを確認する。 |
| `node boot/onboarding-preview-check.js` | デバッグの「初回プレイを最初から再生」を確認する。入口が1つに統合されていること、再生の順番が本番と同じ(助手選択→あいさつ→プロフィール→村の案内→HOME)で画面も台本も作り直していないこと、途中でやめても控えた値へ必ず戻ること、iPhone縦画面で帯と見出しが重ならないことを見る。**いちばんの要は「保存が走らないこと」**で、本体の `storeSet` をそのまま取り出して動かし、再生中に流れうる保存(助手の選択・きき加入フラグ・名前・アイコン・mh_onboarded・案内の既読・仲良し度など)を実際に呼んで1件も書かれないこと、メモリの控えにも残らないこと、終了後はまた保存できることまで確かめる。 |
| `node assistant/assistant-select-render-check.js` | 「助手をえらぶ」画面のJSXだけを取り出してReactで描き、落ちずに全助手が並ぶこと・顔と紹介と選ぶボタンが出ること・縦画面向けに2列でスクロールできることを確認する(BGMの事前ロードが終わらないサンドボックスでも、この画面だけは実際に描いて確かめられる)。 |
| `node assistant/assistant-unlock-notice-render-check.js` | プロフィールで出す「解放の案内」(仲良し度が届いて新しくできるようになったことを一度だけ知らせる説明)のJSXだけを取り出してReactで描き、落ちずに出ること・見出しと本文とページ番号と顔が出ること・途中は「次へ」最後は「閉じる」になること・ページ番号が行きすぎても最後のページに収まることを見る。加えて、要素の木からボタンを取り出して**実際に押し**、「次へ」が次のページへ、「閉じる」が既読の記録へつながっているかまで確かめる(押しても何も起きない状態を防ぐ)。出さない条件(解放Lv未満・既読・プロフィール以外・はじめての案内中・イベント回想中)でも1つも描かれないこと、本文を画面へ直接書かず `data/assistants.js` から受け取っていることも見る。`assistant-bond-check.js` がデータ側(いつ出すか・何が入るか)を見るのに対し、こちらは「その本文が本当に画面へ出るか」を担当する。 |
| `node assistant/assistant-line-report.js` | 助手のセリフが、どの場面に何本あるかを一覧にする(検査ではなく調べるための道具)。本文は `ASSISTANT_SCENES` の定義と、あとから合流する `addAssistantLinePack` の束に分かれていてファイルを読んでも実数が分からないため、本体と同じ `assistantSceneLines()` を通して合流後の本数を数える。少ない順に並ぶので、セリフを増やすときはここを見て手を付ける場面を決める。`--scene <場面キー>` でその場面の中身を全部、`--min <本数>` でその本数に届いていない場面だけを出せる。足す先は `data/assistants.js` の `linesExtra` の束。 |
| `node boot/event-replay-check.js` | イベント回想(プロフィールから、見たことのある会話イベントを何度でも見返す機能)を確認する。 |
| `node boot/gift-login-check.js` | ギフト受取と、日本時間4時更新のログインボーナスを本番ソースの関数で検証する。 |
| `node boot/mission-check.js` | デイリー・ウィークリーのJST期間、達成条件、バッジ、ギフト報酬と重複防止を確認する。 |
| `node boot/mission-gift-badge-check.js` | ミッション・ギフトの未受取バッジ、ミッション一括受取、編成決定後の戻り先、ランキングのタブ分離を確認する。 |
| `node boot/market-notice-check.js` | マーケットへ商品を足したのに助手の告知(`assistantNotice`)を付け忘れていないか、告知idの重複・種類・本文の有無を確認する。 |

### バトル

| コマンド | 内容 |
| --- | --- |
| `node battle/battle-check.js` | 実際にWAVEを自動で戦い、距離撃の取得・撃破ファンファーレ・引き継ぎ技の強化を確認する。 |
| `node battle/battle-balance-check.js` | 難易度カードと全WAVE詳細が共通の敵生成を使い、WAVE1の敵情報を難易度カードへ戻していないことを確認する。 |
| `node battle/battle-scenario-check.js` | バトルのれんしゅう(台本どおりに動くバトル)の数値を、実際の計算式で検算する。 |
| `node battle/battle-damage-preview-check.js` | 味方の連撃・追撃を含む共通予測と、選択中ガードを反映した敵の予定ダメージ表示を確認する。おりょう・ゴーレム・モッチー/ミタラシ・ききのように「使ったターンからすぐ効く」カードを攻撃カードより先に選んだとき、カード選択中の「合計DMG」がその上乗せぶんを正しく含むかを、実際の処理(processTurn)と同じ並び順で検算する。 |
| `node battle/battle-card-gesture-check.js` | カード名を含むカード全体から約10pxでスワイプへ切り替わり、終了後のclickを無効化しつつ通常タップと技変更を維持することを確認する。 |
| `node auto-turn-check.js` | AUTOの1ターン判断helperについて、ガッツ・枚数・割当先・固有技の所有枠・スロット上限の合法判定、4方針、固定乱数、入力stateの非破壊性を確認する。 |
| `node auto-turn-integration-check.js` | AUTOの1ターン判断結果が選択stateを経由せず既存processTurnへ明示入力され、手動ACTION経路と共通の戦闘処理を使うことを確認する。 |
| `node auto-battle-check.js` | 通常バトルのAUTO ON/OFF、連続実行の同期ロック、実行条件、合法行動なしの停止、手動カード操作・ACTION・緊急回復との排他を確認する。 |
| `node run/auto-full-run-check.js` | WAVE結果・Quick成長結果・Quick加入結果が既存handlerとWAVE後AUTOロックを使って1回だけ進み、WAVE10の終了順序、自動再挑戦・マスモン自動登録を追加していないことを確認する。 |
| `node run/unique-initial-in-battle-check.js` | マスモンに設定した「初期技」が、バトルで実際に配られる固有技カードになるところまでを確認する。山札を組み立てる本体のコードをそのまま動かし、継承技を初期技にすると威力・消費・固有技Lvごとその技が1枚目になること、未設定・無効IDは自前技へ落ちること、ラン中に手で切り替えたらその選択が優先され次のWAVEでも戻らないこと、ラン開始と配置時に前の周回の一時選択(slotUniqueChoice)を消していること、消すのは一時選択だけで保存には触らないことを見る。 |
| `node run/auto-repeat-initial-teaching-check.js` | AUTO∞で「1周目の最初に確定したアシストカードを次の周回でもそろえる」ことを確認する。覚えるのはラン開始時の1枚だけ(手動でもAUTOでも／∞がONでなくても)、WAVE途中のカードでは書き換えない、覚えたIDが今の候補に無ければこれまでのランダム選択へ落とす、テンプレートへ持たせるのは安定したIDだけでカードや強化状態は持ち越さない、新しい保存キーやAUTO設定の項目を増やしていない、までを見る。 |
| `node run/auto-repeat-template-check.js` | AUTO∞第5Aの再周回テンプレートが安定IDだけを保持し、個体消失・Pro制約違反を安全に失敗させ、未接続のまま正規の新規ラン初期化を再利用することを確認する。 |
| `node run/auto-repeat-ui-check.js` | ∞周回ONで通常AUTOもON、∞周回単独OFFで通常AUTO維持、通常AUTO OFFで`stopAllAuto()`が使われることと、状態を保存しないことを確認する。 |
| `node run/eco-mode-internal-check.js` | 省エネモードの初期OFF・3段階cycle・入力制限・AUTO∞/`stopAllAuto()`との停止連動・非永続化に加え、lite/ultraの描画差、必須戦況表示、戦闘処理・速度・CHAMPIONへの非干渉を確認する。 |
| `node battle/battle-carousel-check.js` | 難易度カードの順序・スワイプ/矢印・敵生成共通化・全WAVE詳細・挑戦導線を確認する。 |
| `node battle/battle-menu-browser-check.js` | 390×844の実ブラウザでHOMEから難易度画面へ入り、例外ゼロ・矢印/スワイプ・全WAVE詳細・戻る/再入場・勇者選択を確認する。 |
| `node battle/battle-mode-check.js` | チャレンジ／クイック／プロの報酬と記録を確認する。クイックの育成・プシュケー優先・ダイヤ優先の各方針、他モードへの非適用、ランキング分離、WAVEごとの自動成長、伴モン加入、画面・BGM設定の結線を見る。 |
| `node battle/battle-mode-select-check.js` | バトルの入口(バトルモード選択 → 難易度選択 → モード別スコアランキング)を実ブラウザで開き、押して進めることを確かめる。 |
| `node battle/battle-tutorial-check.js` | バトルチュートリアル(操作しながら覚える練習)の3つの入口(デバッグ設定・はじめての案内の最後・ヘルプ)を確認する。 |
| `node battle/battle-tutorial-v2-check.js` | いま本番で使っているバトルチュートリアル(モード選択から始まる版)を、実ブラウザで通してみる。 |
| `node battle/enemy-scan-check.js` | ENEMY SCANと実戦の行動定義・確率・威力倍率の共有、表示時に乱数を消費しないことを確認する。 |
| `node battle/enemy-defeat-check.js` | 反射ダメージの未満・同値・超過の境界値と、通常攻撃・固有技・連撃・追撃・反射が二重実行防止つきの共通撃破処理へ進むことを確認する。 |
| `node battle/reflect-enemy-hp-check.js` | 反射(モノリスの勇者特性・固有技の障壁)で敵のライフが増えないことを確認する。反射はライフを絶対値で書き戻すため、クロージャが持つ「ターン開始時の `enemy.hp`」を使うと、そのターンに削ったぶんがまるごと巻き戻って敵が回復してしまう(実際に出した不具合)。敵の行動中に古い `enemy.hp` を読んでいないこと、最新のライフを呼び出し側から受け取っていること、撃破判定と同じ値を使い回していることを見たうえで、Reactのstateと同じ振る舞いを再現して代表的な場面のライフを実際に計算する。 |
| `node battle/wave-result-layout-check.js` | WAVEリザルトが背の低い端末でも「次へ進む」に届くかを実ブラウザで測る。内訳が長いWAVE後半に、あふれたぶんが上下へはみ出して押せなくなる(しかも `overflow-hidden` でスクロールもできない)状態を防ぐ。320x568・375x667・393x852で、ボタンが画面内にあること・先頭が上へはみ出さないこと・あふれたぶんをスクロールで追えること・押せる高さ(44px以上)があることを数値で見る。 |
| `node battle/hero-marker-check.js` | バトル画面で「どれが勇者モンか」「勇者特性で同時使用枚数が増えているか」が分かるかを確認する。勇者モンの判定が種idで1か所にまとまっていること、モンスター枠に王冠が出ること、枚数の加算が計算と表示で同じ出どころを使っていること、ヘルプにも載っていることを見る。 |
| `node battle/guard-card-check.js` | デッキに入るガードカードの枚数を確かめる。 |
| `node battle/guard-defense-balance-check.js` | 丈夫さの基本防御とガード値を、表示と実処理で同じ式から出していることを固定する。 |
| `node battle/move-hint-layout-check.js` | 敵の「移動しようとしている」吹き出しの大きさと位置を、実ブラウザで測る。 |
| `node battle/unique-range-check.js` | 固有技系統IDによる重複補正と、距離撃の威力判定・移動先・優先順を確認する。 |
| `node battle/unique-effect-check.js` | 固有技の「効果の説明文」と実際の実装が食い違っていないかを見張る。 |
| `node battle/dist-aptitude-check.js` | 間合い適性が距離ごとの補正値(%)として扱われ、編成全員ぶんが置いた距離に関係なく4距離すべてへ加算されるか確認する。 |
| `node battle/balance-second-card-check.js` | 同じターンの2枚目以降のカードが効果半減になるか(アシストカードは対象外)と、かどみうむの効果量・説明文を確認する。 |
| `node battle/card-icon-check.js` | カードやアイテムの `icon` 欄が、画像と絵文字へ正しく振り分けられているかを確認する。 |
| `node battle/debug-battle-check.js` | 隠しデバッグ戦の敵データ再利用、通常記録からの分離、BGM・終了導線・フラグ解除を静的に確認する。 |
| `node battle/rpg-debug-check.js` | ダンジョンRPG戦闘テスト(デバッグ専用試作)の回帰チェック。6ステータス(ライフ・ちから・丈夫さ・ガッツ・素早さ・運)の純粋計算(1/10変換・素早さ/運の初期値10・1P＝ライフ+6/他+2・敵の自動配分・ダメージ式・ガッツ・行動値・回避率・クリティカル率)と戦闘の進行(コマンド入力→行動順→実行→次ターン)を本体から取り出して実際に動かす。乱数は本体が受け取る rng を差し込んで固定するので「たまたま当たった」で通らない。あわせて「入口はデバッグ設定だけ」「マスモンを使わない」「保存・報酬・ランキングへ触れない」「既存デバッグ戦と混ざらない」「通常バトルの式を変えていない」も確認する。対象は選ばなくてよい仕組み(自動でライフ最小の敵を狙う・敵をタップしてねらいを固定/解除・ねらった敵が倒れたら自動へ戻る・敵のタップで行動を消費しない)も、実際に `rpgLowestHpEnemy()` を動かして確かめる。コマンドのやり直し(`rpgUndoCommand` / `rpgCanUndo`)も実際に戦闘を組み立てて動かし、戻した味方の入力だけが消えること・ほかの味方の選択やライフ/ガッツ/ターン数が変わらないこと・元の状態を書き換えないこと・実行が始まったら戻せないことを確かめる。ダメージの数字は、読める大きさ(通常18px以上・会心22px以上)か・消えるまで0.8秒以上あるか・消す時間がアニメーションと揃っているか・同じ相手へ続けて当たっても出し直すかを、CSSと実装の実値から見る。技の演出(技名の帯・閃光・横だけの揺れ・衝撃波)は、実際に技が出たとき(技を使った回数が増えたとき)だけ出すか・演出の長さと消す時間が揃っているか・技の直後だけ次の行動までの間を長くとるか(`rpgStepDelay` を実際に動かす)も確かめる。さらに、実際に戦闘を決着まで流して「1手ぶんの演出・ダメージ表示を1度も取りこぼさない」ことを確かめる(`rpgSteppedOnce`)。rpgResolveStep は「まだ続く／決着／そのターンの最後」の3通りの抜け方をするため、planStepの増加だけを見ているとターン最後の行動と決着の一撃が丸ごと表示されなくなる。攻撃モーションは表示だけの追加なので、通常バトルと同じ `atkMotion` からモーションを選んでいるか・味方は上/敵は下へ動くか・防御では出さないか・戦闘の計算へ触っていないか、編成画面の人数を1か所へまとめて上に置いているかも見る。 |
| `node battle/rpg-debug-layout-check.js` | ダンジョンRPG戦闘テストの3画面(編成・戦闘・結果)を、本体のJSXとCSSのまま実ブラウザの320x568・375x667・393x852で描いて測る。戦闘画面は 敵1〜4体・コマンド入力中・技一覧を開いた状態・対象選択中・行動順8体の実行中・攻撃モーション中(味方/敵)・ねらいを固定した状態・2体まで決めてやり直せる状態・ダメージの数字が出た瞬間・技の演出中・技名とダメージが同時(敵1/2/4体) の13通りを見て、横スクロールが起きないこと、敵の立ち絵が画面幅の20%以上あって切れないこと、行動順8体が折り返して収まること、行動順の枠が味方(青い丸)と敵(赤い角丸四角)で色も形も違うこと(同じモンスターが両側に居ても見分けられるため)、いま動いている1体を光らせても枠の色が味方・敵のままであること、コマンド・技一覧・もどるが画面内で押せる大きさにあること、いま入力中の味方が1体だけ強調されることを数値で確かめる。すでにコマンドを決めた味方は、カードがタップできるボタンになっていて（44px以上）選んだコマンドが札で出ること、まだ決めていない味方は押せないこと、行動の実行が始まったら誰も押せないことも見る。攻撃モーションはアニメーションを途中で止めて位置を測り、動くのは1体だけ・味方は上/敵は下・終わると元の位置へ戻る・横幅が増えないことを見る。編成は6ステータスのステ振り行と、いちばん上の「人数」がスクロールせずに押せて詳細カードより上にあることも見る。コマンド入力中は「ねらい」の表示がはみ出さないこと、光る敵と🎯が1体だけであること、自動のときはライフ最小の敵が選ばれていることも見る。ダメージの数字はアニメーションを出はじめで止めてから測り、当たった数だけ出るか・通常/会心/回避/戦闘不能が読めるか・小さすぎないか・味方の名前と重ならないか・画面の外へ出ないかを確かめる。技の演出は、技名の帯と撃った本人の名前が読める大きさで出るか・長い技名でも切れず画面からはみ出さないか・技を受けた相手にだけ衝撃波が出るかを見る。技名の帯とダメージの数字は同じ瞬間に出るので、敵1・2・4体すべてで両方を出して重ならないことも測る(帯はモンスターの頭の上ではなく敵エリアのすぐ下へ出す)。結果は会心・回避を含む9列の表がはみ出さないことを見る。確認用の画像を `tools/out/rpg-debug-layout/` へ出す(モンスターの絵は実物)。 |

### 難易度とモード（チャレンジ／クイック／プロ／極限）

| コマンド | 内容 |
| --- | --- |
| `node mode/difficulty-item-check.js` | 新難易度(Grand Master/Hell/Legend)の表示と色、絆経験値チケットのまとめ使いを確認する。 |
| `node mode/extreme-challenge-check.js` | 極限チャレンジ(正式版)を確認する。EXTREME〜INFINITYの倍率と解放の連鎖、Grand Master以上クリアの解放条件、アシストカード50%がEXTREME固有ルールに閉じていること、正式プレイは報酬・クリア記録を保存しデバッグプレイでは保存しないこと、既存の保存キーと全国ランキングへ混ぜていないことを見る。 |
| `node mode/extreme-reward-check.js` | 極限チャレンジの数値を本番の定義で計算して確かめる。EXTREMEの敵×13と報酬倍率、通常難易度(Beginner〜Legend)の敵性能に回帰がないこと(powerOverride=nullを0と取り違えない)、解放判定の境界を見る。 |
| `node mode/extreme-browser-check.js` | 極限チャレンジを実ブラウザで遊んで確認する。未解放時のロック表示、Grand Masterクリア後の解放、EXTREMEを押してバトルが始まること、敵の強さが×13、極限ルール発動の表示、通常難易度に影響が無いこと、正式公開の初回案内が1回だけ出ることを見る。 |
| `node mode/nightmare-rules-check.js` | NIGHTMAREのWAVE後強化50%、自動回復率・距離適性のプラス50%／マイナス200%を代表値で確認し、WAVE後距離強化との分離、EXTREMEと通常モードへの非適用も確認する。 |
| `node mode/ultimate-rules-check.js` | 正式ULTIMATEの解放・報酬・記録共通経路と、累計ターンによる敵強化・供モン加入ボーナス低下、WAVEターンによるトレーニング低下、DISTANCE BREAK、デバッグ戦との分離を代表値で確認する。 |
| `node mode/ultimate-card-layout-check.js` | iPhone縦画面向けに全極限難易度カードを共通の外寸(400px)へ収め、説明・「特殊ルールあり」の1行・4操作(ルール詳細/全WAVE詳細/挑戦/ランキング)・下余白と、カード・ページドット・助手コメントの分離を確認する。**特殊ルールの本文をカードへ並べていないこと**と、特殊ルール欄の文字を10px未満へ小さくして詰め込んでいないことも見る(ルールが増えるたびにカードを大きくする・文字を小さくする、という直し方を封じるため)。ルール詳細のSafe Area・縦スクロール・44pxの閉じる操作も確認する。 |
| `node mode/infinity-rules-check.js` | 極限チャレンジ INFINITY を確認する。基本設定(敵×50 / スコア×20 / 経験値×45 / ダイヤ×30 / 虹80 / ULTIMATEクリアで解放)に加えて、**特殊ルールの計算を本体から切り出してそのまま動かし**、敵+0.75%/T・加入B -0.75pt/T(最低10%)・与ダメ -1.0pt/T(最低30%)・トレーニング -0.75pt/T・距離強化50%・ガッツ150%・BREAK 25Tとその倍率・与ダメ低下→BREAKの適用順を数値表で突き合わせる。CHAOSの与ダメ50%と加入B50%、NIGHTMAREのWAVE後強化50%をINFINITYへ重複適用していないこと、既存4難易度(とくにULTIMATEの35T / -0.75pt / 下限25%)が変わっていないこと、記録キーとランキングキーが既存方式のまま分離されていること、クイックへINFINITYを足していないことも見る。 |
| `node mode/extreme-rule-detail-browser-check.js` | 「ルール詳細」を実ブラウザで開いて確認する。5難易度すべてで開けて難易度ごとに違う内容が出ること、INFINITYの主要ルールが全部載ること、閉じるとシートだけ消えて**選択中の難易度が変わらない**こと、ULTIMATE未クリアならINFINITYがロックされ解放条件が読めることを、実際に押して確かめる。このサンドボックスはTailwindのCDNへ出られずクラスによる寸法が再現できないため、**見た目(px)の確認にはならない**。 |
| `node mode/chaos-rules-check.js` | CHAOSの特殊ルール(与ダメージ50%・加入ボーナス50%・消費ガッツ150%、いずれも端数切り捨て)と、極限チャレンジの説明文を確認する。 |
| `node mode/quick-chaos-check.js` | クイックCHAOSの3報酬方針、同難易度解放、特殊ルール共有、ランキング除外、デバッグ保存なし、既存記録キー、カード構成、一度きり通知を確認する。 |
| `node mode/quick-extreme-special-rules-check.js` | クイック極限難易度が極限本体の `specialRules` を共用することに加え、クイックULTIMATEの公開順・3報酬方針・自動成長低下・全回復・開始表示・固定カード高・ランキング除外・更新通知を確認する。 |
| `node mode/quick-extreme-render-check.js` | クイック難易度カルーセルの再描画で、EXTREME/NIGHTMAREが通常難易度表に無くても表示・報酬値を解決できることを固定する。 |
| `node mode/quick-difficulty-unlock-check.js` | クイックの難易度解放条件を確認する。極限のNIGHTMAREクリアでクイックNIGHTMAREが解放され、EXTREMEやCHAOSのクリアだけでは解放されないことを見る。 |
| `node mode/pro-mode-check.js` | プロモードを実ブラウザで最初から遊んでみて、仕様どおりに動くかを確かめる。 |
| `node mode/skip-ticket-check.js` | スキップチケット(序/破/急)の値段・配布・報酬計算と、スコアやランキングに記録しないこと、勇者モン選択のタブを確認する。 |

### ラン中の育成・報酬・リザルト

| コマンド | 内容 |
| --- | --- |
| `node run/training-check.js` | 修行の難易度・参加券・24マスマップ・一時保存・道具・報酬・BGM/SE・二重確定防止を確認する。 |
| `node run/training-reward-check.js` | WAVE後のトレーニング（4種×2回選択）の計算・同一項目2回の複利・ULTIMATE低下・クイック非適用・2回そろうまで決定できないUIを確認する。 |
| `node run/ally-join-view-check.js` | 供モン合流(PICK_ALLY)の画面を確認する。「現在のステータス」パネル(4ステータス＋間合い適性4距離)、候補カードが加算量ではなく合流後の値と変化量を出すこと、あふれても上側へ届くこと、そして本体の `allyJoinPreview` をそのまま動かして通常／ULTIMATE(累計ターンで加算低下)／NIGHTMARE(適性半減)の数値が実際の合流処理と一致することを見る。 |
| `node run/masu-register-check.js` | ラン終了画面(優勝/敗北/リタイア)の「マスモンとして登録する」にたどり着けるかを確認する。1WAVE以上クリアしたときだけ案内が出ること、リタイアでも獲得内訳を作ってから結果を出すこと、3画面とも中央のスクロール領域が `justify-center` ではなく(はみ出すと上側へ永久に届かなくなるため)内側を `m-auto` で寄せていること、登録の案内を獲得内訳より前に置いていることを見る。 |
| `node run/guts-recovery-check.js` | 固有技の強化画面で、強化ポイント1つを使って現在ガッツを10回復できることを確認する。押せる条件と回復後の値の式を本体からそのまま取り出して動かし、最大を超えないこと・満タンやポイント0では何も起きないこと・持っているポイントぶんだけ使えることを数値で見る。同じ描画の間に連打しても1ポイントで2回ぶん回復できないこと(同期の錠)、ガッツ回復を取り消す導線が無いこと、技の＋／－・ポイントの持ち越し・WAVEクリア時の付与・クイックモードの自動強化に触れていないこと、iPhone縦画面でタップしやすいことも確認する。 |
| `node run/bond-reward-check.js` | 周回終了時の勇者・参加・控えマスモンへの絆経験値配分、重複防止、上限・強化ポイント計算を確認する。 |
| `node run/unique-skill-point-check.js` | 固有技ポイント(限界突破・転生で「あとで決める」を選んだときに残るぶん)を検証する。 |
| `node run/inherited-unique-definition-check.js` | 継承した固有技の定義を確認する。旧スナップショット名ではなく `monId` から最新の固有技名を参照していることを見る。 |
| `node run/inherited-unique-level-check.js` | 継承固有技のLvを確認する。ラン中の強化、Lv.8上限、明示した下位Lvを恒久Lvへ戻さないことを見る。 |
| `node run/ranking-finish-check.js` | ラン終了時のランキング処理が、再び画面遷移を通信待ちにしたり多重送信を許したりしないかを、配信用ソースと生成物の両方で確認する。実通信には依存しない。 |

### マスモンの育成・神殿・保存形式

| コマンド | 内容 |
| --- | --- |
| `node masu/monster-power-check.js` | 総合力(モンスターの育成結果を1つの数値にした派生指標)の計算式を検算する。能力1あたりの点・間合い適性1段階=+10・4距離すべてを合計すること・固有技1個=+100とLv1段階=+200/3、未使用強化ポイント/絆Lv/限界突破/転生/合体/勇者特性/合流ボーナスを加点しないこと、最後だけ四捨五入すること、一括強化のプレビューが実データを書き換えず確定後の値と一致すること、詳細・一覧・並べ替え・強化画面が同じ共通関数を使っていることを確認する。 |
| `node masu/monster-list-filter-check.js` | ベースモン一覧・マスモン一覧が種別チェックの影響で空にならないか確認する。 |
| `node masu/monster-detail-unified-check.js` | モンスター詳細(編成・ベースモン一覧・マスモン一覧・勇者モン選択・ランキング)が、外枠・上部サマリー・本文まで1つのマスターUIを通っているか確認する。呼び出し元固有の操作だけを引数で受け取っていること、上部サマリーの並び(総合力・絆Lv/上限・限界突破・転生・超越)、限界突破(rebirthCount)と転生(reincarnateCount)を取り違えていないこと、一覧カードでも超越を含む育成表示が欠落していないことも見る。神殿の再生確認は、購入前の基礎性能表示だけ本文部品を直接再利用する例外として検査する。 |
| `node masu/monster-detail-actions-check.js` | マスモン詳細の育成導線が対象個体を引き継ぎ、神殿の機能を混ぜていないことを確認する。 |
| `node masu/bulk-enhance-check.js` | マスモンの「まとめて強化」が正しく動くか確認する。 |
| `node masu/breeder-level-cap-check.js` | ブリーダーレベルの計算(`levelInfo`)に実質的な上限が無いことを確認する。以前はループの安全策(200回まで)がそのままレベル上限になっており、Lv.201から上がらなくなっていた。固定回数の`for`ループが残っていないこと、実際に計算関数を動かしてLv.201を超えて正しく上がることを見る。**あわせて、その打ち切りが兼ねていた安全弁の代わりが効いているかも見る**: `NaN`・`Infinity`・文字列などの壊れた保存値は「`xp < need`」がいつまでも偽になるため、守りが無いとその場で無限ループして画面が固まる。1秒以内にLv.1へ落ち着くこと、正しい数値文字列は従来どおり数値として扱うこと、極端に大きい経験値でも短時間で終わることを確認する。 |
| `node masu/fusion-rebirth-check.js` | 合体で上がったレベルぶんの強化ポイントが配られるか、合体・転生の消費ダイヤ単価(絆レベル1あたり50)を確認する。 |
| `node masu/fusion-detail-check.js` | 合体詳細ページと、ランキングへ載せる合体履歴・総合力スナップショットを確認する。 |
| `node masu/fusion-breakthrough-check.js` | 合体と同時に行う複数回限界突破の事前計算を、本番関数で検証する。 |
| `node masu/fusion-reincarnate-bonus-check.js` | 転生ボーナスを確認する。旧セーブを一度だけ正規化すること、保存済みの実ボーナスを回数から再計算しないこと、二重実行ロックを継承加算より前に取ることを見る。 |
| `node masu/fusion-animation-browser-check.js` | 通常合体と「限界突破して合体」が、実ブラウザで同じ演出を最後まで表示することを確認する。 |
| `node masu/rebirth-check.js` | Lv30上限移行の補償、二重補償防止、転生条件・費用・効果、固有技Lv、星表示、演出、保存キー、神殿BGMを確認する。 |
| `node masu/breakthrough-item-check.js` | 限界突破専用アイテム「虹のプシュケー」を確認する。所持数がそのまま限界突破の可否になるため、数え方を固定する。 |
| `node masu/breakthrough-star-check.js` | 限界突破の★(凸数と色・個数)と、最終限界突破(Lv.180 → Lv.200)を確認する。★は保存せず `rebirthCount` から毎回組み立てる。 |
| `node masu/donation-check.js` | 神殿の寄付額、マスモン削除、8体編成の補正、二重実行防止、保存キー、BGM・戻り先・一覧タイトルを確認する。 |
| `node masu/temple-update-check.js` | 神殿の合体・寄付・再生の仕様と後方互換性を編集元ソースから確認する。再生個体の90〜110%の能力差と間合い適性の維持、既存個体との互換性、合体の費用・継承条件、寄付報酬、二重処理ロック、円盤石画像の実在を見る。 |
| `node masu/unique-setting-check.js` | マスモン詳細の「固有技設定」(並び順・初期技)を実装から取り出して確認する。安定キー(自前=`own` / 継承=`inhId:<id>`)で保存すること、並び替えても各技の固有技Lvが入れ替わらないこと、旧セーブ互換(設定なし→従来順／初期技なし→自前／消えた技は無視／増えた技は末尾へ／無効IDは自前へフォールバック)、バトルで初期技が最初に選ばれ切替候補も設定順になること、「初期状態に戻す」が固有技Lv・固有技Pを戻さないこと、新しい保存キーやAUTO設定を増やしていないこと、画面(↑↓ボタン・44px以上・初期技表示)とヘルプ・更新履歴・仕様書までを見る。 |
| `node masu/transcendence-check.js` | 神殿の「超越」(Lv400・35凸の個体だけが行える、Lv上限を500まで伸ばす育成)を実装から取り出して確認する。解放条件・コスト(虹のプシュケー5,000＋ダイヤ100万)の1回だけの消費、限界突破の上限が35凸のままであること、Lv400以降の必要XP、超越ポイントの入り方と100個→1Pの交換、基礎値・間合い適性への反映と上限M、転生・リセットで消えないこと、旧セーブが未超越として読めること、画面まわり(入口・確認・演出・バッジ)とヘルプ・更新履歴を見る。 |
| `node masu/transcend-badge-position-check.js` | 超越マーク(「超」の丸バッジ)が、丸く切り抜いたモンスターの絵に重なっていないかをブラウザで測る。本番のCSSと本番で使っている枠の大きさ(48/56/64/68/80/36px)をそのまま持ち込み、「絵の丸」と「マークの丸」の中心距離が半径の和以上あるかを数値で確かめる。角へ置けば必ず外、とは限らないため。 |
| `node masu/masu-enhance-layer-check.js` | マスモンの詳細・通常強化・超越強化を実ブラウザで開き、画面いっぱいの不透明なレイヤーが同時に2枚重なっていないかを測る。詳細モーダル(z=31000)が強化画面(z=30000)を覆って超越強化が見えなくなる不具合を出したため。虹のプシュケーの交換UIが実際に見えているか、戻ったあとに暗い画面が残らないかも確認する。`python3 tools/serve.py` で配信した状態で実行する。 |
| `node masu/transcend-debug-check.js` | 超越デバッグ画面(デバッグ設定 →「超越確認」)を実ブラウザで開いて確認する。入口がデバッグ設定の中だけであること、画面が出て超越マーク・対象選択・準備のボタンがそろっていること、演出が再生されセーブが変わらないこと、書き換えるのが既存の保存キーだけで必ず確認を出すこと、デバッグ専用なので更新履歴・ヘルプへ載せていないことを見る。`python3 tools/serve.py` で配信した状態で実行する。 |
| `node masu/party-set-check.js` | 編成セット(セット1〜5、通常用など)の正規化を確認する。 |
| `node masu/pasture-check.js` | HOME放牧設定の0体・1体・5体保存、旧セーブ互換、削除済みID除外、歩行タイマーの停止を確認する。 |
| `node masu/masu-baseline-resolution-check.js` | マスモンの旧形式を非変更で維持すること、新規通常・再生個体の新旧表現と総合力、再生乱数回数、適性強化・リセット・転生、最新ベースへの新形式だけの追従、適性上限Mに加え、第4段階の非保存ドライラン分類・候補・保全・一覧集計を確認する。 |
| `node masu/legacy-regeneration-baseline-check.js` | 旧再生個体の4能力から歴代ベースを判定する純粋関数を検査する。 |
| `node masu/legacy-dist-apt-boosts-check.js` | 第6B-2の旧距離適性候補について、通常種の安全判定・不正値拒否・旧ゴーレム保留・新形式ゴーレム正常・入力非変更・保存処理不在を確認する。 |
| `node masu/legacy-masu-migration-diagnosis-check.js` | 第6B-3の個体全体診断について、能力・間合いの独立分類、SAFE_EXACT/PARTIAL/AMBIGUOUS/BLOCKED/ALREADY_MODERN、歴代ベースからの個体差と能力変化量、間合い・既存ポイントの保全、総合力再計算、入力非変更、保存処理不在を確認する。 |
| `node masu/safe-masu-baseline-migration-check.js` | 第6Cの実移行について、SAFE_EXACTだけへの診断候補追加、全非対象分類の無変更、保存直前の個体差・基礎値差ぶんの能力変化・4距離・現行式の総合力・ポイント・旧フィールド・再診断、冪等性、歴代ベース、34凸・35凸、旧保存への再適用を確認する。 |

### モンスター個別・アシストカード・マーケット

| コマンド | 内容 |
| --- | --- |
| `node monster/golem-balance-check.js` | 勇者モンの素の能力が壊れた形になっていないかを、実装と同じ式で見張る。 |
| `node monster/snegurochka-check.js` | スネグーラチカ系3体の基礎能力・適性・合流値、絶氷の楔の状態と距離条件、自動ガッツ回復率の加算と上限(勇者限定)、特性説明を確認する。 |
| `node monster/mermaid-monsters-check.js` | ウンディーネ／ヤオビクニ(スネグーラチカと同系統の人魚)を確認する。ステータス・合流ボーナス・距離適性・通常技9段階・固有技9段階・専用モーション・絶氷の楔と氷海の支配者の共有、マーケット6商品、アイコンを画像複製ではなくscale/x/yで合わせていること、3色染色の部位、スネグーラチカに影響が無いことを見る。 |
| `node monster/mermaid-browser-check.js` | ウンディーネ／ヤオビクニを実ブラウザで確認する。マーケットのアイコン／円盤石タブに6商品が並ぶこと、4つのブリーダーアイコンと2つの円盤石を実際に購入できること、円盤石でモンスターが解放されベースモン一覧に出ること、購入したアイコンがプロフィール選択に並び設定でき、再読み込みしても残ることを見る(`python3 -m http.server 8899` でルートを配信した状態で実行する)。 |
| `node monster/meloso-assist-check.js` | メロソのカード定義、マーケット解放、6枠維持、回復・ガード・枚数条件・次ターン予約・予測共通化を確認する。 |
| `node monster/kiki-assist-check.js` | ききのアシストカード(応援／本気／全力全開)の定義と種別を確認する。 |
| `node monster/poltz-assist-check.js` | ポルツのアシストカード(弁当／挫折／目覚め)の定義と、発動処理を実際に動かして1回あたり・累計の効果量とEXTREME倍率、発動する／しない場面の結線を確認する。 |
| `node monster/lineage-dex-check.js` | 血統データ(主血統×副血統)とモンスター図鑑を確認する。全プレイヤーモンスターに血統があり欠損や綴り間違いが無いこと、純血/派生種/レアの判定、？？？(レア血統)を安全に扱えること、モンスターがいない血統に画像を作っていないこと、図鑑の一覧・詳細が全15体ぶん組み立てられること、解放判定に既存の mh_unlocked_monsters を使い図鑑用の保存キーを増やしていないこと、技・能力を既存データから引いていること、ヘルプ/更新履歴/仕様書の反映までを見る。 |
| `node monster/market-icon-check.js` | マーケットのアイコン商品を確認する。 |
| `node monster/monster-art-fit-check.js` | ウンディーネ・ヤオビクニ(縦長2:3の立ち絵)が、丸枠・正方形枠の一覧で頭のてっぺんや尾びれを欠かさず表示できているかを確認する。 |

### ランキング（Supabase）

| コマンド | 内容 |
| --- | --- |
| `node ranking/ranking-check.js` | ランキングの集計仕様(スコアは当時のまま固定/ブリーダーLv・絆Lvは最新)を確認する。通信はスタブ。 |
| `node ranking/ranking-request-check.js` | Normal/Hard/MasterのData APIリクエスト、難易度正規化と`eq`取得、旧`clear_id=NULL`表示、`clear_id`重複防止を通信スタブで確認する。 |
| `node ranking/ranking-normal-display-check.js` | NormalのGET 3件が変換・絞り込み・並べ替え・重複排除を経て、正規化済みの同一stateキーで画面へ3件表示されることを確認する。 |
| `node ranking/ranking-normal-integration-check.js` | 結果送信の入口からinsert相当、成功判定、ローカル退避までを一続きで確認する。 |
| `node ranking/ranking-refresh-race-check.js` | 保存前GETと保存後の強制GETの競合を、Normalのstate反映まで再現する回帰テスト。 |
| `node ranking/ranking-party-check.js` | ランキングpartyの役割保存、旧記録互換、供モン人数と勇者重複防止を確認する。 |
| `node ranking/ranking-member-level-check.js` | スコアランキングの編成に、そのプレイ時点の絆Lvが表示されるか確認する。 |
| `node ranking/ranking-monster-icon-check.js` | ランキングのモンスターアイコンがID・名前・旧記録から解決できるか確認する。 |
| `node ranking/ranking-monster-detail-check.js` | ランキングの編成から開くモンスター詳細を確認する。 |
| `node ranking/ranking-detail-distance-check.js` | ランキングの表示まわり(間合いの出し方など)を確認する。 |
| `node ranking/ranking-dye-color-check.js` | ランキングの記録に載せる染色カラーが、実際の染色と同じ部位に付くかを確認する。 |
| `node ranking/ranking-dye-cost-check.js` | ランキングの編成に実際の染色色を出す場合の重さを実測する。 |
| `node ranking/ranking-run-stats-check.js` | スコアランキングの「◯◯ターンでクリア」「WAVE ◯ で終了」を、Supabaseをスタブした実ブラウザで確認する。列がある場合の表示(クリアはターン数・途中終了はWAVE・古い記録は何も出さない)に加えて、**列がまだ無い環境でスコアの保存が落ちないこと**を見る。ここが崩れるとSQLを適用するまで新しい記録が1件も残らなくなる(`python3 -m http.server 8899` でルートを配信した状態で実行する)。 |
| `node ranking/bond-ranking-check.js` | 絆ランキングの全party集計、新旧個体識別、最高Lv重複排除、空・失敗表示を確認する。 |
| `node ranking/bond-ranking-dedupe-check.js` | 同じ人・同じ種類のマスモンが、個体ID付きの記録と古い記録に分かれて二重に並ばないことを確認する。 |
| `node ranking/bond-ranking-submit-check.js` | 絆Lvランキングへ、そのプレイの絆Lv(`party[].bondLevel`)がちゃんと載るかを確認する。 |
| `node ranking/bond-levels-table-check.js` | 絆Lvの正本テーブル(`bond_levels`)まわりを、Supabaseをスタブした実ブラウザで確認する。テーブルがある場合は正本の全員が並び、正本にまだ載っていない人は記録側の集計で補われること、テーブルが無い場合(適用前)は404を受けても壊れず従来どおり表示されることを見る(`python3 -m http.server 8899` でルートを配信した状態で実行する)。 |
| `node ranking/bond-levels-schema-match-check.js` | アプリが送るリクエストの形(取得する列・upsertで送る列・`on_conflict`・`Prefer`)と、本番へ適用したテーブル定義(`docs/sql/bond-levels/BOND_LEVELS_APPLY.sql`)が食い違っていないかを突き合わせる。上のスモークはSupabaseを差し替えた偽物で動くため、列名を打ち間違えても200が返って通ってしまう。`bond_levels` は削除の権限をわざと与えていない(消せない)ので、間違った形で書き始める前にここで止める。`rankings` へ後から足した列(`docs/sql/run-stats/RUN_STATS_APPLY.sql` の `turns` / `reached_wave`)も同じ考え方で照合する。 |
| `node ranking/breeder-ranking-browser-check.js` | Supabaseをスタブした実ブラウザで、全難易度のブリーダーLv集約、重複排除、複数件のDOM表示、タブ往復後の保持を確認する。 |
| `node ranking/breeder-ranking-paging-check.js` | ブリーダーLvランキングが「よく遊ぶ人の記録に取得枠を食われて下位の人が消える」状態に戻っていないかを、Supabaseをスタブした実ブラウザで確認する。記録が数百件ある人と1件しかない人を混ぜ、全員が並ぶこと・1人1件にまとまること・ページ送りしていることを見る(`python3 -m http.server 8899` でルートを配信した状態で実行する)。 |
| `node ranking/emergency-audio-breeder-check.js` | 起動タップ内の音声有効化、保存ミュート保護、ブリーダーLvランキングの独立取得と表示状態を確認する。 |

### 助手（みゅあ・きき）

| コマンド | 内容 |
| --- | --- |
| `node assistant-check.js` | 助手(ナビゲーター)システムを確認する。助手の定義・表情画像・場面(scene)の登録・吹き出しの共通コンポーネントに加え、JSXで使うsceneが実在すること、sceneのhelp参照先が実在すること、1画面につき5種類以上のセリフがあること、実際に引いて直前と同じものが出ないこと、条件つきのセリフが通常より優先されること、説明書のような言い回しや語尾の偏りが無いことを見る。 |
| `node assistant-bond-check.js` | 助手との仲良し度を確認する。段階と呼び方、どのLvでも話すことが尽きないか、行動ごとの獲得量と1日上限が指定どおりか(表で1つずつ突き合わせる)、1日の合計上限が行動ごとの上限の合計へ自動追随しているか、Lvアップに必要な累積量を変えていないか、みゅあとききの保存が混ざらないかを見る。**助手のアシストカード分は本体の `grantEquippedAssistantCardBond` / `addAssistantBondFor` を取り出して実際に走らせ**、みゅあカード→みゅあ・ききカード→きき・選択中の助手が別でも本人へ入ること、両方編成なら両方へ入ること、編成保存だけでは増えず実際のバトル開始とカード使用でだけ数えること、選んでいない助手のLvアップ通知を出さないことまで確認する。加えて、**解放の案内(その画面で一度だけ出す説明)の土台**も見る。案内がデータで定義されid が重ならないこと、解放Lvに届くまで出さず届いたら出ること、本文へLvを直書きせず助手ごとの呼び方の例に合わせて変わること、一度見たら二度と出ないこと、既読の記録が壊れた値でも文字列の配列へ落ちること、記録が新しい保存キーへ分かれていること、**画面(プロフィール)から実際に呼び出して起動時に既読を読み・読み終えたら保存しているか**、アップデートの案内(HOME)と出す画面が分かれていること、ヘルプと更新履歴に書いてあること、そして「あとからセリフを足す束(`linesExtra`)がある」「どの場面も5本以上ある」ことを確かめる。描画そのものは `assistant/assistant-unlock-notice-render-check.js` が受け持つ。 |
| `node assistant/assistant-update-notice-check.js` | 正式アップデートの初回助手案内について、通知ID、データ形式、既読の正規化、新規プレイヤー保護、終了時保存、遷移先、デバッグ通知の隔離を確認する。 |
| `node assistant-face-check.js` | 助手の顔アイコンが「顔が真ん中」に切り出せているかを見る。丸く切って使う場所が多いため、中央からずれると欠ける。表情画像を差し替えたら流す。 |
| `node make-assistant-faces.js` | 助手の表情画像(`monster-hero/images/assistant/myua_*.PNG`)から、吹き出し用の小さい顔アイコンを `images/assistant/face/` へ書き出す。元絵は1枚1.5MBあるので、表情画像を差し替え・追加したら必ず流し直す。 |
| `node assistant/daily-masu-advice-check.js` | みゅあの日次ワンポイント案内の本文データ、7体・8体の条件、通常ログインとDEBUGの共通表示経路、本文領域の可視スタイルを確認する。 |

### ヘルプ（更新漏れの検出）

| コマンド | 内容 |
| --- | --- |
| `node help-coverage-check.js` | 「機能を足したのにヘルプに載っていない」を検出する。全画面(gameState)が HELP_SCREEN_COVERAGE に載っているか、難易度・アイテム・ログボ・ミッション・教えが実データから全件出ているかを確認する。 |
| `node help-guide-check.js` | ヘルプ(攻略情報局)を確認する。data/help.js のデータの形、全項目に助手のひとことがあること、カテゴリ→項目→本文の3階層で描かれていること、本文の数値が実際の計算と一致することを見る。 |
| `node help-render-check.js` | ヘルプ画面のJSXを切り出してReactで実際に描画し、カテゴリ一覧・項目一覧・全項目の本文が最後まで描けることを確認する(未定義の変数を参照していれば失敗する)。 |

### 見た目・レイアウト

| コマンド | 内容 |
| --- | --- |
| `node layout-consistency-check.js` | モンスターカードの大きさ統一・難易度カードの高さ・マーケットの商品カードの並び・Masterの文字色・各画面に縦スクロールがあるかを確認する。 |
| `node home-layout-check.js` | HOME画面の配置(みゅあの吹き出し・施設・はじめての案内)を、実ブラウザで測って重なりを数値で確かめる。HOMEの見た目を触ったら流す。 |
| `node image/face-render-check.js` | 顔アイコンが実ブラウザで正しく描画されるか確認し、アイコン選択画面と同じ見た目のスクリーンショットを出す。 |

### 音まわり

| コマンド | 内容 |
| --- | --- |
| `node audio/bgm-check.js` | BGMが実際に鳴っているかを、実ブラウザのWeb Audioそのもので確認する(要 `python3 tools/serve.py`)。`AudioContext.decodeAudioData` と `AudioBufferSourceNode.start/stop` を差し替えて、「どのmp3をデコードしたか」「どれが鳴り始めたか」「そのときAudioContextが動いていたか」を直接見る。オリジナルBGMの再生／いちか4曲のデコード成功／BGMアレンジ画面からの試聴／試聴停止後に元のBGMへ復帰／何度試聴しても無音・二重再生にならない／AudioContextを止めてもタップで再開できる／アレンジで選んだ曲がHOMEで実際に鳴る、までを通しで確認する。★2026年8月に作り直した。以前は `document.querySelectorAll('audio')` を見ていたが、BGMは2026年7月にHTMLAudioElementをやめており、空配列に対する `every()` が素通りして何も観測できていなかった。 |
| `node audio/bgm-arrangement-check.js` | BGMトラック登録、場面別アレンジ保存、最終ボス後のクリア曲、試聴、曲別音量補正を確認する。 |
| `node audio/title-bgm-check.js` | iOS相当の自動再生制限を再現し、最初のタップだけでタイトルBGMが鳴るか、起動タップがトップ画面へ届いていないかを確認する。 |
| `node audio/audio-route-check.js` | BGMのaudio要素が再生前にWeb Audioへ接続され、iOSのメディア再生経路へ漏れないことを確認する。 |
| `node audio/tap-sound-trace.js` | 起動画面のタップからの出来事(イベント・再生・Web Audioの接続)を時系列で並べる。音まわりの調査用。 |
| `node audio/compress-audio.js` | 配信するBGM(MP3)のビットレートをそろえて軽くする。引数なしなら対象を表示するだけで書き換えない。 |

### 画像と染色

| コマンド | 内容 |
| --- | --- |
| `node image-asset-check.js` | 画像の参照先が実在するか、キャッシュキー(`?v=`)が中身と一致しているか、使われていない画像が残っていないかを確認する。 |
| `node image/image-report.js` | `monster-hero/images/` のPNGをフォルダごとにサイズ順で出す。中身が同じ重複ファイル・どこからも参照されていないファイルも検出する。 |
| `node image/monster-image-quality-check.js` | 敵・味方の全身画像数、PNG読込、透過隅、可視画素を検査する。 |
| `node image/extract-images.js [--dry-run]` | data/*.js に base64 で埋め込まれた画像をPNGファイルとして `monster-hero/images/` へ書き出し、定数をそのパスへ置き換える。置き場所はスクリプト内の `PLACEMENT` 表で決める。 |
| `node image/import-monster-art.js` | 受け取ったモンスターのイラストを、ゲームで使う形(正方形・余白そろえ・透過)へ整えて `monster-hero/images/monsters/` へ書き出す。 |
| `node image/compress-images.js` | 配信する画像(PNG)を、見た目を落とさない範囲で軽くする。引数なしなら対象を表示するだけで書き換えない。 |
| `node image/make-face-icons.js [--preview] [MOCCHI ...]` | 立ち絵から顔部分を切り出して256pxの顔アイコンを作り、`images/monster-icons/face/` のPNGを上書きする。モンスターIDを指定すると対象だけを更新する。切り出し範囲はスクリプト内の `FACE_BOXES`。 |
| `node image/grid-overlay.js 変数名...` | 立ち絵に0.1刻みの目盛りを重ねたPNGを出す。顔クロップや染色bboxの範囲を実測するときに使う。 |
| `node image/region-map.js [モンスターID...]` | 部位分けを色分けしたPNGを `out/` に書き出す。目視確認用。 |
| `node image/dye-report.js [モンスターID...]` | 染色もどきの部位マスクを実画像で生成し、部位ごとの画素数・被覆率を出力する。回帰テスト用。 |
| `node image/dye-report.js --save-baseline` | 現在の結果を `dye-baseline.json` に保存する。以降は実行のたびに差分が表示される。 |
| `node image/dye-region-map.js out.png <ID> [y0 y1]` | 染色もどきの部位分けを絵で確かめる。元の絵と、部位ごとに塗り分けた絵(①赤・②黄・③青)を左右に並べて書き出す。被覆率だけでは分からない「どこが混ざっているか」を見るために使う。 |
| `node image/dye-alpha-check.js` | 染色の「濃さ(透過率)」を確かめる。 |
| `node image/dye-edge-check.js` | 染色もどきの「輪郭の塗り残し」を実測して見張る。部位マスクは縮小画像で作るため、等倍へ戻すと境界に隙間が出やすい。 |
| `node image/dye-quality-report.js` | 染色もどきの部位マスクの品質を実測し、モンスターごとに比べる。輪郭のギザギザや白い縁の原因調査用。 |
| `node image/dye-mask-editor-check.js` | 汎用染色マスクエディタの縦横比、本体内だけの描画、外部連結領域だけの掃除、Undo、境界警告、PNG正規化と輪郭内の透明穴維持を確認する。 |
| `node image/undine-dye-mask-check.js` | ウンディーネの染色1（髪）・染色2（顔、首、耳、腕、尻尾、尾びれ）・染色3（服）と3色同時の本番マスクを、正解見本 `art-sources/dye-masks/undine-dye-mask.PNG` と画素単位で比較する。正解PNGは検査時だけ読み込むので、配信フォルダには置いていない。 |
| `node image/yaobikuni-dye-mask-check.js` | ヤオビクニの染色1（髪・胸飾り・両腕〜手・下半身〜尾びれ）・染色2（左右のヒレ／羽状部分）・染色3（顔・耳・首〜胴体）を、保存済み3色マスクと画素単位で比較する。 |

### 通し確認・性能

| コマンド | 内容 |
| --- | --- |
| `node browser/feature-check.js` | 実ブラウザでゲームを起動し、主要機能が動くかを確認する。 |
| `node browser/perf-check.js` | 読み込みにかかる時間と転送量を実ブラウザで計測する。 |
| `node browser/smoke.js` | 実ブラウザ(Chromium)で `data/*.js` を読み込み、画像の変数がすべて解決されるか確認する。事前にリポジトリのルートをHTTPで配信しておくこと(`python3 tools/serve.py`)。 |

`dye-baseline.json` は「現在正しいとされている染色結果」の記録なので、
染色を意図的に変更したときだけ `--save-baseline` で更新すること。

モンスターIDは `MASU_COLOR_REGION_HUES` のキー(`Iblis` / `Suezo` / `Mocchi` / `Mitarashi` /
`Golem` / `Pixie` / `Tiger` / `Ham` / `Oboro` / `Zan` / `Ark` / `Monol`)。省略すると全モンスター。

## 検証用サーバー

ブラウザを使う検証スクリプトは、リポジトリのルートがHTTPで配信されている必要がある。

```
python3 tools/serve.py     # http://localhost:8899
```

`python3 -m http.server` ではなくこれを使うこと。標準のものは1リクエストずつしか処理できず、
BGMのmp3(合計約20MB)を読み込んでいるあいだ他のファイルが返せずページが止まってしまう。

## 出荷手順

1. `game-system.jsx` などを改修する
2. `node build.js` で `game-system.compiled.js` を作り直す(**忘れると変更が反映されない**)
3. `node check-syntax.js` / `node undefined-reference-check.js` / `node image/dye-report.js` / `node browser/feature-check.js` を通す
4. `data/changelog.js` の先頭に今回の更新内容を追記する
5. `node build.js` で `BUILD_DATE`・`version.json`・更新履歴の最新日時を現在時刻(JST)に揃え、生成物を更新する
6. コミット → PR → squash マージ

## リポジトリの構成

```
index.html                    monster-hero/ へ転送するだけの入口
README.md AGENTS.md CLAUDE.md DEVELOPMENT.md   ルートに置く文書はこの4つだけ
monster-hero/                 ★ここに置いたものはすべて配信される★
  index.html                  配信のエントリ。ここから下のファイルを読み込む
  game-v4.html                旧URL。index.html へのリダイレクトだけ置いている
  game-system.compiled.js     ★自動生成物★ src/game-system.jsx を tools/build.js で変換したもの
  src/game-system.jsx         ゲーム本体のソース(配信されない。改修はここに行う)
  data/
    images/                   立ち絵・アイコンの置き場所を書いたパス表(images-ally.js / images-enemy.js)
    ally-monsters.js          味方モンスターの定義
    enemy-monsters.js         敵モンスターの定義
    breeder.js                アシストカード・マーケット・ブリーダー用の画像
    skills.js                 技・ガード・カードの色定義
    assistants.js             助手(みゅあ・きき)の定義と場面別のセリフ
    help.js                   ヘルプ本文
    changelog.js              更新履歴(更新のたびに先頭へ追記する)
  images/                     ゲームが実際に読む画像だけ
  vendor/                     React / ReactDOM(CDNを使わず同梱している)
  audio/                      BGMのmp3(タイトル/別ページ/通常戦/ボス戦の4曲)
  icons/ manifest.json version.json
tools/                        開発用の検証スクリプト(配信されない)
  build.js                    ★CLAUDE.md と CI が名指しする定番はここに置く(21本)
  harness.js                  本体から関数を取り出すための共通ヘルパー
  check-syntax.js  undefined-reference-check.js  jsx-text-brace-check.js
  render-error-check.js  compiled-runtime-check.js  boot-flow-check.js
  update-notice-check.js  image-asset-check.js  layout-consistency-check.js
  home-layout-check.js  help-*-check.js  assistant-*-check.js  stamp-*.js
  boot/                       起動・トップ・はじめての案内(13本)
  battle/                     バトル(24本)
  mode/                       難易度とモード(13本)
  run/                        ラン中の育成・報酬・リザルト(10本)
  masu/                       マスモンの育成・神殿・保存形式(23本)
  monster/                    モンスター個別・アシストカード(8本)
  ranking/                    ランキング(21本)
  assistant/                  助手(3本)
  audio/                      音まわり(6本)
  image/                      画像と染色(17本)
  browser/                    通し確認・性能(3本)
  art-sources/                配信しない原本・検査用の見本画像
  out/                        検査が書き出すPNGなど(Git管理外)
  node_modules/               検査用の依存(ゲームへは同梱しない)
docs/                         仕様・SQL・調査記録(案内は docs/README.md)
supabase/migrations/          再現可能なDB構造変更の正本
.github/workflows/            生成物の一致検査 → 必須検査 → Pagesへのデプロイ
```

絵の実体は `monster-hero/images/` のPNGにまとめてあるので、ゲームのバランスやデータを直すときに
開くファイル(`ally-monsters.js` など)と、めったに開かない画像ファイルが混ざらない。

`monster-hero/` の下はそのまま配信されるので、**ゲームが一度も読まないファイルをここへ置かない**。
検査用の正解見本や差し替え前の原本は `tools/art-sources/` に置く(`tools/art-sources/README.md`)。
置き場所を間違えると `node image-asset-check.js` の「使われていない画像が残っていない」で止まる。

## ブラウザに配信しているもの

`monster-hero/` は静的サイトとして配信される。以前は React・Tailwind・Babel をすべてCDNから読み、
さらに `game-system.jsx` を毎回取得しなおしてブラウザ上でJSXを変換していたため、
ページを開くたびに数秒かかっていた。現在は次のようにしている。

- **React / ReactDOM**: `monster-hero/vendor/` に同梱(CDNへの往復が2回減る)
- **ゲーム本体**: `tools/build.js` で事前変換した `game-system.compiled.js` を普通の `<script>` で読む
  (Babel本体(約2.8MB)のダウンロードも、端末上での変換(モバイルで数秒)も不要になる)
- **Tailwind**: 現状はCDNのまま(実行時にCSSを生成する方式のため、静的CSS化は別途対応が必要)
- **BGM**: `audio/` のmp3。合計17MBあるが `preload='none'` で画面に応じて必要な曲だけを
  読み込むため、初期表示には影響しない(SEは引き続きTone.jsで生成している)

## 仕組み

`game-system.jsx` は素の `<script type="text/babel">` として読ませる前提の1枚岩ファイルで、
モジュールのexportが無い。そのため `harness.js` では次の手順で染色ロジックだけを取り出している。

1. Babel(preset-react)でJSXを変換する
2. 末尾に `globalThis.__dyeExports = { ... }` を追記して、トップレベルの `const` を取り出せるようにする
3. React / ReactDOM / document / window の最小スタブを用意した `vm` コンテキストで実行する
   (`document.createElement('canvas')` は node-canvas を返し、`window.Image` も node-canvas のものを使う)

これにより `getDyeRegionMasks` などを本番と同じコードのまま Node 上で呼べる。

## ランキング終了処理の回帰確認

`node run/ranking-finish-check.js` で、最終リザルトがランキング通信を待たないこと、同じ周回を
多重送信しないためのロックがあること、送信直後に全難易度を再取得しないことを確認できる。

## 神殿（再生・合体・寄付）の回帰確認

`node tools/masu/temple-update-check.js` で、再生個体の90〜110%の能力差と間合い適性の維持、既存個体との互換性、合体の費用・継承条件、寄付報酬、二重処理ロック、円盤石画像の実在を確認できる。
