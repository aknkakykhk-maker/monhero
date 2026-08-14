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

| コマンド | 内容 |
| --- | --- |
| `node check-syntax.js` | `monster-hero/game-system.jsx` をBabelで変換して構文エラーが無いか確認する。**改修後は必ず実行する。** |
| `node compiled-runtime-check.js` | 配信用コードが `jsxDEV` / automatic JSX runtime など、`index.html` が用意していないランタイムを参照していないことと、React / ReactDOM の読込順を確認する。 |
| `node undefined-reference-check.js` | `game-system.jsx` が「その場所からは見えない変数」を参照していないか、Babelでスコープをたどって確認する。構文としては正しいので `check-syntax.js` では見つからず、その画面を開いた瞬間だけ真っ白になる類の不具合を防ぐ。**改修後は必ず実行する。** |
| `node dye-report.js [モンスターID...]` | 染色もどきの部位マスクを実画像で生成し、部位ごとの画素数・被覆率を出力する。回帰テスト用。 |
| `node dye-mask-editor-check.js` | 汎用染色マスクエディタの縦横比、本体内だけの描画、外部連結領域だけの掃除、Undo、境界警告、PNG正規化と輪郭内の透明穴維持を確認する。 |
| `node dye-report.js --save-baseline` | 現在の結果を `dye-baseline.json` に保存する。以降は実行のたびに差分が表示される。 |
| `node dye-region-map.js out.png <ID> [y0 y1]` | 染色もどきの部位分けを絵で確かめる。元の絵と、部位ごとに塗り分けた絵(①赤・②黄・③青)を左右に並べて書き出す。被覆率だけでは分からない「どこが混ざっているか」を見るために使う。 |
| `node undine-dye-mask-check.js` | ウンディーネの染色1（髪）・染色2（顔、首、耳、腕、尻尾、尾びれ）・染色3（服）と3色同時の本番マスクを、正解見本 `undine-dye-mask.PNG` と画素単位で比較する。正解PNGは検査時だけ読み込む。 |
| `node yaobikuni-dye-mask-check.js` | ヤオビクニの染色1（髪・胸飾り・両腕〜手・下半身〜尾びれ）・染色2（左右のヒレ／羽状部分）・染色3（顔・耳・首〜胴体）を、保存済み3色マスクと画素単位で比較する。 |
| `node region-map.js [モンスターID...]` | 部位分けを色分けしたPNGを `out/` に書き出す。目視確認用。 |
| `node image-report.js` | `monster-hero/images/` のPNGをフォルダごとにサイズ順で出す。中身が同じ重複ファイル・どこからも参照されていないファイルも検出する。 |
| `node monster-image-quality-check.js` | 敵・味方の全身画像数、PNG読込、透過隅、可視画素を検査する。 |
| `node extract-images.js [--dry-run]` | data/*.js に base64 で埋め込まれた画像をPNGファイルとして `monster-hero/images/` へ書き出し、定数をそのパスへ置き換える。置き場所はスクリプト内の `PLACEMENT` 表で決める。 |
| `node image-asset-check.js` | 画像の参照先が実在するか、キャッシュキー(`?v=`)が中身と一致しているか、使われていない画像が残っていないかを確認する。 |
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
| `node breeder-ranking-paging-check.js` | ブリーダーLvランキングが「よく遊ぶ人の記録に取得枠を食われて下位の人が消える」状態に戻っていないかを、Supabaseをスタブした実ブラウザで確認する。記録が数百件ある人と1件しかない人を混ぜ、全員が並ぶこと・1人1件にまとまること・ページ送りしていることを見る(`python3 -m http.server 8899` でルートを配信した状態で実行する)。 |
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
| `node battle-damage-preview-check.js` | 味方の連撃・追撃を含む共通予測と、選択中ガードを反映した敵の予定ダメージ表示を静的に確認する。 |
| `node enemy-defeat-check.js` | 反射ダメージの未満・同値・超過の境界値と、通常攻撃・固有技・連撃・追撃・反射が二重実行防止つきの共通撃破処理へ進むことを確認する。 |
| `node battle-card-gesture-check.js` | カード名を含むカード全体から約10pxでスワイプへ切り替わり、終了後のclickを無効化しつつ通常タップと技変更を維持することを確認する。 |
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
| `node monster-power-check.js` | 総合力(モンスターの育成結果を1つの数値にした派生指標)の計算式を検算する。能力1あたりの点・間合い適性1段階=+10・4距離すべてを合計すること・固有技1個=+100とLv1段階=+200/3、未使用強化ポイント/絆Lv/限界突破/転生/合体/勇者特性/合流ボーナスを加点しないこと、最後だけ四捨五入すること、一括強化のプレビューが実データを書き換えず確定後の値と一致すること、詳細・一覧・並べ替え・強化画面が同じ共通関数を使っていることを確認する。 |
| `node masu-baseline-resolution-check.js` | マスモンの旧形式を非変更で維持すること、新規通常・再生個体の新旧表現と総合力、再生乱数回数、適性強化・リセット・転生、最新ベースへの新形式だけの追従、適性上限Mに加え、第4段階の非保存ドライラン分類・候補・保全・一覧集計を確認する。 |
| `node legacy-dist-apt-boosts-check.js` | 第6B-2の旧距離適性候補について、通常種の安全判定・不正値拒否・旧ゴーレム保留・新形式ゴーレム正常・入力非変更・保存処理不在を確認する。 |
| `node legacy-masu-migration-diagnosis-check.js` | 第6B-3の個体全体診断について、能力・間合いの独立分類、SAFE_EXACT/PARTIAL/AMBIGUOUS/BLOCKED/ALREADY_MODERN、全値保全、入力非変更、保存処理不在を確認する。 |
| `node monster-detail-unified-check.js` | モンスター詳細(編成・ベースモン一覧・マスモン一覧・勇者モン選択・ランキング)が、外枠・上部サマリー・本文まで1つのマスターUIを通っているか確認する。呼び出し元固有の操作だけを引数で受け取っていること、上部サマリーの並び(総合力・絆Lv/上限・限界突破・転生)、限界突破(rebirthCount)と転生(reincarnateCount)を取り違えていないことも見る。 |
| `node dist-aptitude-check.js` | 間合い適性が距離ごとの補正値(%)として扱われ、編成全員ぶんが置いた距離に関係なく4距離すべてへ加算されるか確認する。 |
| `node fusion-rebirth-check.js` | 合体で上がったレベルぶんの強化ポイントが配られるか、合体・転生の消費ダイヤ単価(絆レベル1あたり50)を確認する。 |
| `node skip-ticket-check.js` | スキップチケット(序/破/急)の値段・配布・報酬計算と、スコアやランキングに記録しないこと、勇者モン選択のタブを確認する。 |
| `node layout-consistency-check.js` | モンスターカードの大きさ統一・難易度カードの高さ・マーケットの商品カードの並び・Masterの文字色・各画面に縦スクロールがあるかを確認する。 |
| `node extreme-challenge-check.js` | 極限チャレンジ(正式版)を確認する。EXTREMEの倍率と未実装段階、Grand Master以上クリアの解放条件、ブリーダーカード50%がEXTREME固有ルールに閉じていること、正式プレイは報酬・クリア記録を保存しデバッグプレイでは保存しないこと、既存の保存キーと全国ランキングへ混ぜていないことを見る。 |
| `node nightmare-rules-check.js` | NIGHTMAREのWAVE後強化50%、自動回復率・距離適性のプラス50%／マイナス200%を代表値で確認し、WAVE後距離強化との分離、EXTREMEと通常モードへの非適用も確認する。 |
| `node quick-extreme-special-rules-check.js` | クイック極限難易度が極限本体の `specialRules` を共用し、EXTREME/NIGHTMAREの相互混入や通常クイックへの誤適用がないこと、開始表示・カード表示・固定カード高・ランキング除外を確認する。 |
| `node quick-chaos-check.js` | クイックCHAOSの3報酬方針、同難易度解放、特殊ルール共有、ランキング除外、デバッグ保存なし、既存記録キー、カード構成、一度きり通知を確認する。 |
| `node extreme-reward-check.js` | 極限チャレンジの数値を本番の定義で計算して確かめる。EXTREMEの敵×13と報酬倍率、通常難易度(Beginner〜Legend)の敵性能に回帰がないこと(powerOverride=nullを0と取り違えない)、解放判定の境界を見る。 |
| `node extreme-browser-check.js` | 極限チャレンジを実ブラウザで遊んで確認する。未解放時のロック表示、Grand Masterクリア後の解放、EXTREMEを押してバトルが始まること、敵の強さが×13、極限ルール発動の表示、通常難易度に影響が無いこと、正式公開の初回案内が1回だけ出ることを見る。 |
| `node mermaid-monsters-check.js` | ウンディーネ／ヤオビクニ(スネグーラチカと同系統の人魚)を確認する。ステータス・合流ボーナス・距離適性・通常技9段階・固有技9段階・専用モーション・絶氷の楔と氷海の支配者の共有、マーケット6商品、アイコンを画像複製ではなくscale/x/yで合わせていること、3色染色の部位、スネグーラチカに影響が無いことを見る。 |
| `node mermaid-browser-check.js` | ウンディーネ／ヤオビクニを実ブラウザで確認する。マーケットのアイコン／円盤石タブに6商品が並ぶこと、4つのブリーダーアイコンと2つの円盤石を実際に購入できること、円盤石でモンスターが解放されベースモン一覧に出ること、購入したアイコンがプロフィール選択に並び設定でき、再読み込みしても残ることを見る(`python3 -m http.server 8899` でルートを配信した状態で実行する)。 |
| `node battle-mode-check.js` | チャレンジ／クイック／プロの報酬と記録を確認する。クイックの育成・プシュケー優先・ダイヤ優先の各方針、他モードへの非適用、ランキング分離、WAVEごとの自動成長、伴モン加入、画面・BGM設定の結線を見る。 |
| `node hero-marker-check.js` | バトル画面で「どれが勇者モンか」「勇者特性で同時使用枚数が増えているか」が分かるかを確認する。勇者モンの判定が種idで1か所にまとまっていること、モンスター枠に王冠が出ること、枚数の加算が計算と表示で同じ出どころを使っていること、ヘルプにも載っていることを見る。 |
| `node assistant-check.js` | 助手(ナビゲーター)システムを確認する。助手の定義・表情画像・場面(scene)の登録・吹き出しの共通コンポーネントに加え、JSXで使うsceneが実在すること、sceneのhelp参照先が実在すること、1画面につき5種類以上のセリフがあること、実際に引いて直前と同じものが出ないこと、条件つきのセリフが通常より優先されること、説明書のような言い回しや語尾の偏りが無いことを見る。 |
| `node assistant-update-notice-check.js` | 正式アップデートの初回助手案内について、通知ID、データ形式、既読の正規化、新規プレイヤー保護、終了時保存、遷移先、デバッグ通知の隔離を確認する。 |
| `node daily-masu-advice-check.js` | みゅあの日次ワンポイント案内の本文データ、7体・8体の条件、通常ログインとDEBUGの共通表示経路、本文領域の可視スタイルを確認する。 |
| `node make-assistant-faces.js` | 助手の表情画像(`monster-hero/images/assistant/myua_*.PNG`)から、吹き出し用の小さい顔アイコンを `images/assistant/face/` へ書き出す。元絵は1枚1.5MBあるので、表情画像を差し替え・追加したら必ず流し直す。 |
| `node help-coverage-check.js` | 「機能を足したのにヘルプに載っていない」を検出する。全画面(gameState)が HELP_SCREEN_COVERAGE に載っているか、難易度・アイテム・ログボ・ミッション・教えが実データから全件出ているかを確認する。 |
| `node help-render-check.js` | ヘルプ画面のJSXを切り出してReactで実際に描画し、カテゴリ一覧・項目一覧・全項目の本文が最後まで描けることを確認する(未定義の変数を参照していれば失敗する)。 |
| `node help-guide-check.js` | ヘルプ(攻略情報局)を確認する。data/help.js のデータの形、全項目に助手のひとことがあること、カテゴリ→項目→本文の3階層で描かれていること、本文の数値が実際の計算と一致することを見る。 |
| `node data-cache-key-check.js` | index.htmlが読み込むdata/*.jsのキャッシュキーが中身と一致しているか確認する(古いデータが読まれて画面が真っ暗になるのを防ぐ)。 |
| `node meloso-breeder-check.js` | メロソのカード定義、マーケット解放、6枠維持、回復・ガード・枚数条件・次ターン予約・予測共通化を確認する。 |
| `node balance-second-card-check.js` | 同じターンの2枚目以降のカードが効果半減になるか(ブリーダーカードは対象外)と、かどみうむの効果量・説明文を確認する。 |
| `node pasture-check.js` | HOME放牧設定の0体・1体・5体保存、旧セーブ互換、削除済みID除外、歩行タイマーの停止を確認する。 |
| `node feature-check.js` | 実ブラウザでゲームを起動し、主要機能が動くかを確認する。 |
| `node perf-check.js` | 読み込みにかかる時間と転送量を実ブラウザで計測する。 |
| `node smoke.js` | 実ブラウザ(Chromium)で `data/*.js` を読み込み、画像の変数がすべて解決されるか確認する。事前にリポジトリのルートをHTTPで配信しておくこと(`python3 tools/serve.py`)。 |
| `node grid-overlay.js 変数名...` | 立ち絵に0.1刻みの目盛りを重ねたPNGを出す。顔クロップや染色bboxの範囲を実測するときに使う。 |
| `node make-face-icons.js [--preview] [MOCCHI ...]` | 立ち絵から顔部分を切り出して256pxの顔アイコンを作り、`images/monster-icons/face/` のPNGを上書きする。モンスターIDを指定すると対象だけを更新する。切り出し範囲はスクリプト内の `FACE_BOXES`。 |
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
3. `node check-syntax.js` / `node undefined-reference-check.js` / `node dye-report.js` / `node feature-check.js` を通す
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
    images/                   立ち絵・アイコンの置き場所を書いたパス表(images-ally.js / images-enemy.js)
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

絵の実体は `monster-hero/images/` のPNGにまとめてあるので、ゲームのバランスやデータを直すときに
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

## 神殿（再生・合体・寄付）の回帰確認

`node tools/temple-update-check.js` で、再生個体の90〜110%の能力差と間合い適性の維持、既存個体との互換性、合体の費用・継承条件、寄付報酬、二重処理ロック、円盤石画像の実在を確認できる。
