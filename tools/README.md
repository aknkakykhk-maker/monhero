# 開発用の検証ツール

`monster-hero/` 本体(GitHub Pages で配信される静的サイト)には含まれない、開発時だけ使う
Node.js 製の検証スクリプト。ビルド工程は無いので、これらを実行してもサイトの中身は一切変わらない。

過去のセッションではこれらを一時ディレクトリ(scratchpad)に置いていたためセッションが変わるたびに
消えて作り直しになっていた。今後はこのディレクトリで管理する。

## セットアップ

```
cd tools && npm install
```

`@babel/core` / `@babel/preset-react`(JSXの構文チェック・変換用)、`canvas`
(ブラウザのCanvas APIをNode上で再現し、染色マスクの生成を実画像で検証するため)、
`playwright`(実ブラウザでのスモークテスト用)を入れる。
`node_modules/` はコミットしない(`.gitignore` 済み)。

## スクリプト

| コマンド | 内容 |
| --- | --- |
| `node check-syntax.js` | `monster-hero/game-system.jsx` をBabelで変換して構文エラーが無いか確認する。**改修後は必ず実行する。** |
| `node dye-report.js [モンスターID...]` | 染色もどきの部位マスクを実画像で生成し、部位ごとの画素数・被覆率を出力する。回帰テスト用。 |
| `node dye-report.js --save-baseline` | 現在の結果を `dye-baseline.json` に保存する。以降は実行のたびに差分が表示される。 |
| `node region-map.js [モンスターID...]` | 部位分けを色分けしたPNGを `out/` に書き出す。目視確認用。 |
| `node image-report.js` | 埋め込み画像(base64)の一覧をサイズ順に出す。重複した実体も検出する。 |
| `node monster-image-quality-check.js` | 敵・味方の全身画像数、PNG読込、透過隅、可視画素を検査する。 |
| `node dedupe-images.js [--dry-run]` | 同じ base64 が複数の変数に重複して埋め込まれている箇所を、先に定義した変数への参照に置き換える。画像は1バイトも変えない。 |
| `node stamp-version.js` | BUILD_DATE、version.json、本体JSのキャッシュキーを現在の日本時間に揃える。手で書くと未来の時刻が入るので必ずこれを使う。 |
| `node update-notice-dismiss-check.js` | 新バージョン通知が「押すと更新／×で今回は閉じる」の2択になっているか確認する。 |
| `node update-notice-check.js` | 新バージョンの定期検知、常時表示、キャッシュ回避付き更新を静的に確認する。 |
| `node boot-check.js` | 起動時の事前ロード画面と、画面遷移でBGMが重ならないことを確認する。 |
| `node root-redirect-check.js` | ルートURLがLF APPSを描画せず、`location.replace`でゲームへ直接遷移することを確認する。 |
| `node boot-flow-check.js` | 音声失敗時のTITLE遷移、全画面タイトルタップ、同期的な多重実行防止、GAME準備と演出の並列化を静的に確認する。 |
| `node bulk-enhance-check.js` | マスモンの「まとめて強化」が正しく動くか確認する。 |
| `node mission-gift-badge-check.js` | ミッション・ギフトの未受取バッジ、ミッション一括受取、編成決定後の戻り先、ランキングのタブ分離を確認する。 |
| `node mission-check.js` | デイリー・ウィークリーのJST期間、達成条件、バッジ、ギフト報酬と重複防止を確認する。 |
| `node donation-check.js` | 神殿の寄付額、マスモン削除、8体編成の補正、二重実行防止、保存キー、BGM・戻り先・一覧タイトルを確認する。 |
| `node rebirth-check.js` | Lv30上限移行の補償、二重補償防止、転生条件・費用・効果、固有技Lv、星表示、演出、保存キー、神殿BGMを確認する。 |
| `node bgm-check.js` | BGM(audio/のmp3)が画面に応じて切り替わるかを実ブラウザで確認する。 |
| `node audio-route-check.js` | BGMのaudio要素が再生前にWeb Audioへ接続され、iOSのメディア再生経路へ漏れないことを確認する。 |
| `node emergency-audio-breeder-check.js` | 起動タップ内の音声有効化、保存ミュート保護、ブリーダーLvランキングの独立取得と表示状態を確認する。 |
| `node breeder-ranking-browser-check.js` | Supabaseをスタブした実ブラウザで、全難易度のブリーダーLv集約、重複排除、複数件のDOM表示、タブ往復後の保持を確認する。 |
| `node bgm-arrangement-check.js` | BGMトラック登録、場面別アレンジ保存、最終ボス後のクリア曲、試聴、曲別音量補正を確認する。 |
| `node ranking-member-level-check.js` | スコアランキングの編成に、そのプレイ時点の絆Lvが表示されるか確認する。 |
| `node ranking-monster-icon-check.js` | ランキングのモンスターアイコンがID・名前・旧記録から解決できるか確認する。 |
| `node ranking-check.js` | ランキングの集計仕様(スコアは当時のまま固定/ブリーダーLv・絆Lvは最新)を確認する。通信はスタブ。 |
| `node ranking-request-check.js` | Normal/Hard/MasterのData APIリクエスト、難易度正規化と`eq`取得、旧`clear_id=NULL`表示、`clear_id`重複防止を通信スタブで確認する。 |
| `node ranking-normal-display-check.js` | NormalのGET 3件が変換・絞り込み・並べ替え・重複排除を経て、正規化済みの同一stateキーで画面へ3件表示されることを確認する。 |
| `node enemy-scan-check.js` | ENEMY SCANと実戦の行動定義・確率・威力倍率の共有、表示時に乱数を消費しないことを確認する。 |
| `node bond-ranking-dedupe-check.js` | 同じ人・同じ種類のマスモンが、個体ID付きの記録と古い記録に分かれて二重に並ばないことを確認する。 |
| `node bond-ranking-check.js` | 絆ランキングの全party集計、新旧個体識別、最高Lv重複排除、空・失敗表示を確認する。 |
| `node battle-check.js` | 実際にWAVEを自動で戦い、距離撃の取得・撃破ファンファーレ・引き継ぎ技の強化を確認する。 |
| `node bond-reward-check.js` | 周回終了時の勇者・参加・控えマスモンへの絆経験値配分、重複防止、上限・強化ポイント計算を確認する。 |
| `node unique-range-check.js` | 固有技系統IDによる重複補正と、距離撃の威力判定・移動先・優先順を確認する。 |
| `node debug-battle-check.js` | 隠しデバッグ戦の敵データ再利用、通常記録からの分離、BGM・終了導線・フラグ解除を静的に確認する。 |
| `node title-bgm-check.js` | iOS相当の自動再生制限を再現し、最初のタップだけでタイトルBGMが鳴るか、起動タップがトップ画面へ届いていないかを確認する。 |
| `node difficulty-item-check.js` | 新難易度(Grand Master/Hell/Legend)の表示と色、絆経験値チケットのまとめ使いを確認する。 |
| `node battle-carousel-check.js` | 難易度カードの順序・スワイプ/矢印・敵生成共通化・全WAVE詳細・挑戦導線を確認する。 |
| `node battle-menu-browser-check.js` | 390×844の実ブラウザでHOMEから難易度画面へ入り、例外ゼロ・矢印/スワイプ・全WAVE詳細・戻る/再入場・勇者選択を確認する。 |
| `node ranking-party-check.js` | ランキングpartyの役割保存、旧記録互換、供モン人数と勇者重複防止を確認する。 |
| `node new-player-onboarding-check.js` | 空の保存領域から始まる新規プレイヤー専用の説明・プロフィール設定・途中再開導線を確認する。 |
| `node training-check.js` | 修行の難易度・参加券・24マスマップ・一時保存・道具・報酬・BGM/SE・二重確定防止を確認する。 |
| `node tap-sound-trace.js` | 起動画面のタップからの出来事(イベント・再生・Web Audioの接続)を時系列で並べる。音まわりの調査用。 |
| `node build.js` | **BUILD_DATE・version.json・更新履歴の最新日時を揃え、game-system.jsx を配信用JSへ変換して `monster-hero/game-system.compiled.js` を書き出す。改修したら必ず実行する。** |
| `node build.js --check` | compiled が jsx と一致しているか確認する(古ければ終了コード1)。出荷前チェック用。 |
| `node monster-list-filter-check.js` | ベースモン一覧・マスモン一覧が種別チェックの影響で空にならないか確認する。 |
| `node pasture-check.js` | HOME放牧設定の0体・1体・5体保存、旧セーブ互換、削除済みID除外、歩行タイマーの停止を確認する。 |
| `node feature-check.js` | 実ブラウザでゲームを起動し、主要機能が動くかを確認する。 |
| `node perf-check.js` | 読み込みにかかる時間と転送量を実ブラウザで計測する。 |
| `node smoke.js` | 実ブラウザ(Chromium)で `data/*.js` を読み込み、画像の変数がすべて解決されるか確認する。事前にリポジトリのルートをHTTPで配信しておくこと(`python3 tools/serve.py`)。 |
| `node grid-overlay.js 変数名...` | 立ち絵に0.1刻みの目盛りを重ねたPNGを出す。顔クロップや染色bboxの範囲を実測するときに使う。 |
| `node make-face-icons.js [--preview]` | 立ち絵から顔部分を切り出して256pxの顔アイコンを作り、`_FACE_ICON` を差し替える。切り出し範囲はスクリプト内の `FACE_BOXES`。 |
| `node face-render-check.js` | 顔アイコンが実ブラウザで正しく描画されるか確認し、アイコン選択画面と同じ見た目のスクリーンショットを出す。 |

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
3. `node check-syntax.js` / `node dye-report.js` / `node feature-check.js` を通す
4. `data/changelog.js` の先頭に今回の更新内容を追記する
5. `node build.js` で `BUILD_DATE`・`version.json`・更新履歴の最新日時を現在時刻(JST)に揃え、生成物を更新する
6. コミット → PR → squash マージ

## リポジトリの構成

```
monster-hero/
  index.html                  配信のエントリ。ここから下のファイルを読み込む
  game-v4.html                旧URL。index.html へのリダイレクトだけ置いている
  game-system.compiled.js     ★自動生成物★ src/game-system.jsx を tools/build.js で変換したもの
  src/game-system.jsx         ゲーム本体のソース(配信されない。改修はここに行う)
  data/
    images/                   立ち絵・アイコンの巨大なbase64(images-ally.js / images-enemy.js)
    ally-monsters.js          味方モンスターの定義
    enemy-monsters.js         敵モンスターの定義
    breeder.js                ブリーダーカード・マーケット・ブリーダー用の画像
    skills.js                 技・ガード・カードの色定義
    changelog.js              更新履歴(更新のたびに先頭へ追記する)
  vendor/                     React / ReactDOM(CDNを使わず同梱している)
  audio/                      BGMのmp3(タイトル/別ページ/通常戦/ボス戦の4曲)
  icons/ manifest.json version.json
tools/                        開発用の検証スクリプト(配信されない)
atsu-cup/                     別アプリ(モンヒロとは独立)
index.html                    2つのアプリへのハブページ
```

巨大なbase64を `data/images/` にまとめてあるので、ゲームのバランスやデータを直すときに
開くファイル(`ally-monsters.js` など)と、めったに開かない画像ファイルが混ざらない。

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

`node ranking-finish-check.js` で、最終リザルトがランキング通信を待たないこと、同じ周回を
多重送信しないためのロックがあること、送信直後に全難易度を再取得しないことを確認できる。
