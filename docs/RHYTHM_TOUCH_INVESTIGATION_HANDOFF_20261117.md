# iPhone高速交互タップ抜け：Claudeへの調査引き継ぎ
作成日: 2026-11-17（日本時間）

## 依頼・現在地
ユーザー報告: 長期間、iPhoneで両手の高速交互タップ時に抜ける。片手高速では起きない。Androidは起きないらしい。
原因追求を最優先とし、原因に合う修正方法を決める。数値を闇雲に変更しない。
ChatGPTはゲームコードを変更していない。以下はコード調査、実コードの部品実行、既存実機テレメトリ集計。iPhoneを実際に操作した再現検証ではない。
実機での主原因・各原因の寄与率は未確定。

調査基準: 7653e148a8e8e1c19a12732cfb5192d39d7887c5
この文書を置いたブランチの基点: 258ecc9cb0cb3fca58aa1641cca4db1f70c7ee53
mainは調査後に進んでいる。開始時に最新mainとAGENTS.md、CLAUDE.md、DEVELOPMENT.md、対象範囲のルールを確認し、以下の箇所に変更があるかだけ確認する。古いコードへ戻さない。
このブランチの成果は文書のみ。最新mainで実装し、文書は必要に応じて取り込む。

## 対象
- monster-hero/data/rhythm-mode.js: RHYTHM_TOUCH_BRIDGE、rhythmInputAgeCompMs、rhythmInputAgeMs、rhythmRevealedAgeMs、rhythmTouchNoInputMisses
- monster-hero/src/parts/30-rhythm-play.jsx: syncTouches、inputStarts、startRecovered、onTouchStart
- docs/spec/RHYTHM_TOUCH_DIAG.md
- tools/mode/rhythm-touch-diag.js
- tools/mode/rhythm-touch-bridge-check.js / rhythm-sync-audit-check.js / rhythm-input-rec-check.js / rhythm-timing-diag-check.js
- 過去の修正 PR #6053、記録取り込み PR #6754

## 1. 部品で再現した「新しい接触の誤抑制」
RHYTHM_TOUCH_BRIDGE.touchStart は pending pointer に一致しなければ recovered を照合する。
基準版では各軸28px以内、イベント時刻差600ms以内、touchId未設定なら、既に離した接触でも ignore にする。
recovered は離してから600ms保持され、pointerUp後に新しく触れたものとの区別が不足する。

実コードをNode vmに抽出して実行した手順（単位ms、座標px）:
```js
B.reset();
B.pointerDown(1,100,100,1000,1000);
B.pointerUp(1,1020,1020);
B.sweep(1050);
B.touchStart(2,100,100,1100,1100,0); // 実測 'ignore'
B.isIgnoredTouch(2);               // 実測 true
```
指1はタッチ通知が欠けポインタで救済済み。指2は100ms後の別接触だがポインタ通知がない、という合成条件。
対照: 最後のtouchStart前に B.pointerDown(2,100,100,1100,1100) を呼ぶと 'normal'、ignored=false。
syncTouches は isIgnoredTouch がtrueなら inputStartsへ渡さないため、入力破棄につながる経路がある。

確定したのはこの合成条件の部品挙動。実機でこの組み合わせが起きる頻度は未確認。同じ場所付近の再タップの問題で、離れた左右の全タップ抜けを説明しない。
単に600msを短縮／upAtがあれば一律除外すると、本当に遅れて届いた同じ接触を二重計上する危険がある。
pointerUp前後のstamp、受信時刻、接触寿命、対応済みIDを含めて識別方法を検討。ブラウザのstampが信用できない条件も考慮する。
touchIdの未設定判定が !entry.touchId なので identifier=0 の扱いも回帰確認対象（現時点で実機原因とは断定しない）。

## 2. 実機記録の再集計
基準版 tools/mode/rhythm-touch-diag.js と rows.jsonlを取得し、--fetchでサーバーから28行追加、合計3139行に対して --report --days 14 --json を実行。
この時点でiOS 588曲/8端末、Android 941曲/3端末（集計対象はassistを除外。指標の追加時期・必要サンプル数で下の母数は異なる）。
個別端末ID・生ログ・認証情報はこの文書へ転記しない。最新記録は既存ツールで再取得可能:
```sh
node tools/mode/rhythm-touch-diag.js --fetch --report --days 14
```
当時の集計:
- 詳細診断のあるiOS 231曲: 遅れ扱いtouchstart 4280回、うち他の指が触れていたもの4274回（約99.9%）。
- 自分のtouchstartなしで見えた指2009回: 別のstartで190、moveで11、end系で1808。後から自分のstartが届いた1986回。
- 消えて戻った同IDの指(lsBack)は0。これを防ぐ11/11のguardは、この標本の説明にはならない。
- 11/14 lateStampTypical修正後、80ms超の入力で取れた単押し735回/56曲: 通常入力との差 +9.5ms（修正前は約-49ms）。
- 別の通知から見えた指で取れた単押し752回/68曲: 通常入力との差 +0.3ms。
- 未修正50〜80ms: 単押し690回/70曲、通常入力との差 -29.1ms。通常遅延だけ戻す仮計算では +20.2ms。
- 上記はツールの曲単位集計・中央値等に基づく値。「全入力の実測物理時刻との差」ではない。
- 成功した単押しだけを測る選択バイアスがある。これだけでMISS原因や補正の最適値を決めない。
- 50〜80msにそのまま既存補正を拡張しても +20.2msが残る。案Bは候補であり採用決定ではない。

## 3. 診断に高速交互の盲点
rhythmTouchNoInputMisses はノーツ前後200msにinputTimesがゼロ、かつ前後700msに2つ以上ある場合だけnoInputと数える。
inputStartsは対象ノーツとのマッチ前に時刻をinputTimesへ追加している。位置や指はこの配列に入らない。
従って100ms間隔の交互タップで1打欠けても前後の別指の入力があり、noInputに数えられない。
noInputMissesが低いことを「高速交互の抜けがない／改善した」の根拠にしない。

診断改善案（未実装）:
通知受信 → 接触照合 → 入力採用/抑制と理由 → 座標 → 候補ノーツ → 最終判定まで短い記録で結ぶ。
指・位置・ノーツ別に、抑制・空打ち・別ノーツ取得・通知未観測を区別する。
通知が一切ないケースは「物理的に押した証拠」もないため、未観測=ブラウザが落としたと断定しない。
既存RHYTHM_INPUT_RECをまず再利用し、通常プレイへの負荷、件数上限、既存statsサイズ制約、個人情報を確認。既存指標は過去比較のため残す。

## 4. イベント順の確認と外部情報
syncTouchesの実コードを依存部分のスタブ付きで実行:
- 通常交互: 2本ともinputStartsへ。
- 新しい指が他指のtouchendのtouchesに現れ、その後自分のtouchstartが来る: 1回だけinputStartsへ（救済が働く）。
- 新しい指がどの通知にも出ずpointerも来ない: 入力できない。
- 新しい指が最初は範囲外として見え、後の自分のtouchstartで範囲内になるがmoveなし: そのstartでは拾わない条件あり。実機での発生は未確認、主因扱いしない。
この確認は座標変換やノーツ判定をスタブにした入力ルーティングの部品試験。ブラウザ統合・実機試験ではない。

Apple Developer Forumsの一次報告:
https://developer.apple.com/forums/thread/711928
左右のtouchstart/touchendが重なるとstartが欠ける、iOS Safari/Chromeで発生しAndroidでは起きないという投稿。Appleが今回の端末・OSの原因を確定した資料ではない。
ポインタ経路への置換だけで直るとは限らない。ゲーム側の実測と分ける。

## Claudeに進めてほしい順序
1. 最新mainとの差分を確認し、上記誤抑制を現行コードで再現。検査側にロジックを写さず実関数を使う。
2. 正当な遅着同一接触と、新しい接触を対照にする。実機でこの経路が発生するか既存記録で確認し、不足分だけ診断を補強。
3. 入力を捨てる欠陥について、二重取得防止を維持する最小修正を検討・検証する。
4. 50〜80msは端末・版・曲/難易度・他指の有無で分けて再評価。判定幅を広げる対症療法や、全入力の一律時刻変更をしない。
5. 原因・修正対象・未確定事項を報告。実装する場合は現行CLAUDE.md等に従って正式ビルド、関連テスト、PR/CI/公開まで実施し、実機未確認は明記。

必須の回帰条件:
通常の片手/両手高速、同位置再タップ、離れた左右、pointerのみ欠落、touchのみ欠落、順序逆転、離した後の正当な遅着、他指endからの救済、二重入力、HOLD/SLIDE/FLICK、AndroidのID再利用と0、pause/result時の掃除。
判定窓・譜面・スコア・ランキング・セーブ形式は変更しない。ゲームコード変更時のみ現行ルールに沿ってhelp/changelogを更新。
