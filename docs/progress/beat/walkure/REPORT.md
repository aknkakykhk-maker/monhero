# ワルキューレ（6組目）譜面レーン下準備 REPORT

作業日: 2026-11-21 / 作業場所: `~/workspace/new-songs/group6-walkure/prep/`（本体リポジトリ monhero-check は無変更・git status クリーンを確認済み。実装・PR は今回の範囲外）

売り方（決定済み・再確認なし）: 原曲＋ショートの2版バンドル、500ビートP、両版開放。

## 結論サマリ

- 音源処理（両版）: **完了**。音量・頭パディングとも実測で目標範囲に着地。
- テンポ決定（両版）: **完了**。216.03 BPM・4拍子、±43ms 格子適合 100%。
- 譜面生成＋自動修正＋手の仕上げ（両版・各5難易度）: **完了**。ノーツ数は両版とも難易度順を満たす。モンスターノーツは全難易度4つ（点検ツール実測）。
- レベル（自動測定）: 原曲 11/14/25/36/50、ショート 12/15/24/30/50（＋ショートHELL 49）。
- HELL ショート版: **variant 2 で全条件クリア**（Lv.49）。スクラッチ側 rhythm-mode.js へ書き出し済み。
- HELL 原曲: variant 0 の測定のみ完了（Lv.65）。選定条件を満たさず**未確定**（下記）。
- **残る詰まり**: 検証ゲート step6（両手シミュレート厳格側）で、原曲 EXPERT 3件・MASTER 2件、ショート EXPERT 1件の「押せない」が残った。道具側の自動修正・手の仕上げのモデルでは全て 0 件になっており、モデル間の判定差。試した手は下記「step6 残件の経緯」に全部記録した。本実装時はこの解消が先決（パイプラインの --release はこのゲートで止まる）。

## 1. 音源処理

| | 原曲 | ショート版 |
|---|---|---|
| 素材 | audio-walkure-original.m4a（689.9s・ステレオ） | audio-walkure-short.m4a（178.4s・モノラル） |
| 素材の実測 | −6.97 LUFS / TP +3.15 dBTP / 頭の無音 0.608s | −11.02 LUFS / TP +0.73 dBTP / 頭の無音 0.656s |
| ゲイン | ×0.4453（−7.03 dB） | ×0.7096（−2.98 dB） |
| 頭パディング | 無音 2000ms 追加 | 無音 2000ms 追加 |
| 処理後（prep/bgm-walkure.mp3 / bgm-walkure-short.mp3） | **−14.24 LUFS / TP −5.58 dBTP / 鳴り始め 2.634s** / 691.9s / 192kbps 44.1kHz | **−14.25 LUFS / TP −5.34 dBTP / 鳴り始め 2.682s** / 180.4s / 192kbps 44.1kHz |

- 原曲は素材のままでは過去の着地範囲（−14〜−16 LUFS）を大きく外れていたため調整必須だった。両版とも鳴り始めが2秒より後ろにある（最初のノーツ条件を満たす）。
- **モノラル扱いの判断**: ショート版はデュアルモノ化した。理由: 情報は増えないが、過去曲は全てステレオで、ゲームの音声経路・解析系との一貫性を取るため。
- エンコード 192kbps の根拠: 素材は AAC 約130kbps 相当。前例（erfolg は約128k源→128k、amakakeru は192k）に倣い、劣化を避けて 192k を採用。

### ショート版と原曲の照合（Rev.26 の手順・相関）

- ショート版は原曲の**頭 [0〜約178.3秒] の抜粋**。一定オフセット **−0.047秒**（ショートが47ms前倒し）、相関 0.95〜0.99、**つなぎ目なし**、末尾約3.4秒にフェードアウト。最終 mp3 同士でも −0.047秒を再確認済み。
- この −47ms が両版の beatZero 差（70ms vs 23ms）の根拠。

## 2. テンポ決定

| | 原曲 | ショート版 |
|---|---|---|
| 自動判定 | 162.02 BPM / 3拍子 / beatZero 70ms → ±43ms 適合 95%（tempo-unstable 警告あり） | 161.98 BPM（参考） |
| **採用** | **216.03 BPM（×4/3）/ 4拍子 / beatZero 70ms → ±43ms 100%**（±15ms 43% / ±30ms 86%） | **216.03 BPM / 4拍子 / beatZero 23ms（=70−47）→ ±43ms 100%**（±15ms 46% / ±30ms 88%） |
| 却下候補 | 半分 81.01 BPM → 52%、3/4 の 121.52 BPM → 71% | 原曲の値を引き継ぎ（照合済みのため） |

- ×4/3 の型は Erfolg・天翔る翼と同じ前例どおり。人が決めた値として登録済み（source: "command"）のため、解析の tempo-unstable 警告は notice に下がり、検証ゲートの停止条件にはならない（criticalWarnings=0 を確認済み）。

## 3. 難易度表（自動測定・生成＋自動修正＋手の仕上げ後の最終値）

### 原曲 walkure（691.9秒）

| 難易度 | Lv | ノーツ数 | 内訳 |
|---|---|---|---|
| EASY | 11 | 1698 | TAP1633 / HOLD65 |
| NORMAL | 14 | 1912 | TAP1772 / HOLD74 / FLICK66 |
| HARD | 25 | 2619 | TAP2425 / HOLD104 / FLICK78 / SLIDE12 |
| EXPERT | 36 | 2850 | TAP2554 / HOLD138 / FLICK102 / SLIDE56 |
| MASTER | 50 | 3460 | TAP3208 / HOLD46 / FLICK166 / SLIDE40 |
| HELL | 65（variant 0 測定値・未確定） | 骨組み 2866 | hell-mix 測定: 地上タップ2231 / 空タップ215 / HOLD195 / SLIDE76 |

### ショート walkure_short（180.4秒）

| 難易度 | Lv | ノーツ数 | 内訳 |
|---|---|---|---|
| EASY | 12 | 446 | TAP429 / HOLD17 |
| NORMAL | 15 | 500 | TAP462 / HOLD19 / FLICK19 |
| HARD | 24 | 654 | TAP598 / HOLD27 / FLICK23 / SLIDE6 |
| EXPERT | 30 | 720 | TAP639 / HOLD36 / FLICK30 / SLIDE15 |
| MASTER | 50 | 878 | TAP804 / HOLD13 / FLICK49 / SLIDE12 |
| HELL | **49（variant 2・確定）** | — | 地上タップ554 / 空タップ47 / HOLD49 / SLIDE24 |

- Lv は点検ツール（rhythm-chart-review.js、authoring の fixed を読む自動測定）の値。レベルは自動測定のままが決定済み。
- 密度の注意: 216 BPM のため EASY でも毎秒 2.48〜2.54 ノーツと、公開曲の帯（1.01〜2.325）より高い。両版の全難易度で最密4秒も帯より高め（review-*.txt に全件）。
- 生成設定（registry-entries.json に控えあり）: 両版とも `chartIntensityByDifficulty {EXPERT:'mild', MASTER:'extreme'}`、`sustainScale {MASTER:0.2}`、`handFinish {EXPERT:'smooth', MASTER:'smooth'}`、`flowPlacement:true`。原曲は生成 variant 1 を採用（variant 0 との比較は下記）。

## 4. 検査結果

- **モンスターノーツ**: 両版・全難易度（HELL 含む）**4つ**（点検ツール／hell-mix 実測）✓
- **ノーツ数の難易度順**: 両版とも EASY<NORMAL<HARD<EXPERT<MASTER ✓（生成直後は原曲で EXPERT 2899 > MASTER 2874 の逆転があったが、上記の強さ設定で解消）
- **帯の中・太さの飛び**（点検ツール）: ショート版は全難易度 0 ✓。原曲は EXPERT に**帯の中 1件**が残る（手の仕上げでも外せなかった分）。
- **step6（両手シミュレート・検証ゲート側）**: 下記の残件あり。
- 正式の expert-master-order-check と hand-rules-check、レベル表の --write、songClimax の測定は、ランタイムへ書いた後（本実装時）の工程のため下準備では未実施。スクラッチ側では入れ物（マーカー・entries・BEATS・VERSION_GROUPS 等）を scaffold.js で用意済み（work/ 内）。

### step6 残件（最終 artifacts の状態）

| 版 | 難易度 | 件数 | 場所 |
|---|---|---|---|
| 原曲 | EXPERT | 3 | 142.6s 第129小節 レーン4 TAP（2.5レーンを139msで移動できない）／380.0s 第343小節 レーン1 TAP（同）／388.6s 第350小節 レーン4.75 TAP（0.5レーンずれた場所を69msで叩き直せない・最低105ms） |
| 原曲 | MASTER | 2 | 117.0s 第106小節 レーン5 TAP（4レーンを208ms・最低222ms）／172.7s 第156小節 レーン4.25 HOLD（2.5レーンを139ms） |
| ショート | EXPERT | 1 | 89.3s 第81小節 レーン1.75 TAP（2.5レーンを139ms） |
| ショート | MASTER ほか | 0 | — |

- いずれも 216 BPM の16分音符（69ms）・8分音符（139ms）間隔での親指の移動・叩き直しが、step6 モデルの物理限界を 1〜2 割下回る境界ケース。自動修正・手の仕上げ自身のモデルでは全て 0 件（道具間で判定が割れている）。
- 388.6s（原曲EXPERT）と 172.7s（原曲MASTER）と 89.3s（ショートEXPERT＝原曲89.2sと同じ音楽箇所）は、設定・variant を変えても繰り返し現れる構造的な箇所。

### step6 残件の経緯（試したこと）

1. 第1 pass（設定なし）: 生成時点で EXPERT>MASTER の逆転＋自動修正後に EXPERT・MASTER 各1件残り、パイプラインが自動修正で停止。
2. 第2 pass（EXPERT 'none' / MASTER 'strong'）: step6 で EXPERT 3件・MASTER 1件。
3. 第1 pass 相当の設定（EXPERT 'mild' / MASTER 'extreme'）＋ handFinish smooth: step6 で EXPERT 2件・MASTER 1件（最良）。
4. 第3 pass（同設定・生成 variant 1）: step6 で EXPERT 3件・MASTER 2件。→ 現在の artifacts はこの第3 pass。設定と variant の組み合わせでは全消しできなかった。
- その他: handFinish は keep-climax → smooth（EXPERT/MASTER）で交差・真ん中越え・同じ側の速い押し始めは大幅減（例: MASTER 交差 93→1）。差し替え（splice）は EXPERT/MASTER では候補側に押せないが増えるため両 pass とも不採用だった。

## 5. HELL

### ショート版: variant 2 で確定

| variant | Lv | モンスター | 水平クロス | 帯の中 | 押せない | 同じ側150ms以内の高さ変更（上限2） |
|---|---|---|---|---|---|---|
| 0 | 47 | 4 | 0 | 0 | 0 | 4 ✗ |
| 1 | 50 | 4 | 0 | 0 | 0 | 4 ✗ |
| **2** | **49** | **4** | **0** | **0** | **0** | **1 ✓** |
| 3 | 50 | 4 | 0 | 0 | 0 | 3 ✗ |

- SONGS 行に variant:2 を記録し、`--write` でスクラッチ側 rhythm-mode.js の `<walkure-short-v3-hell-notes>` と Lv.49 を書き込み済み（hell-mix-songs-lines.txt に控え）。

### 原曲: variant 0 の測定のみ・未確定

- variant 0: **Lv.65**、モンスター4、水平クロス0、押せない0。ただし**帯の中 1件**（99.22s・半レーン）と、**同じ親指が1.5拍未満で段を変える 51件**（Lv.65帯の上限は6）が残り、選定条件を満たさない。
- variant 1〜3 の比較は未実施: hell-mix の原曲1回が約61分（MASTER 相当の下書きを音源から作り直すため）かかり、このレーンの残り時間では回し切れなかった。本実装時に variant 比較（または hellDensity を下げた候補の比較）が必要。

## 6. 成果物（prep/ 内）

- `bgm-walkure.mp3` / `bgm-walkure-short.mp3`: 処理後音源
- `charts/`: 両版の fixed 譜面 JSON（各5難易度）＋ HELL 骨組み JSON（各1）
- `registry-entries.json`: 両版の registry 設定の控え（テンポ・強さ設定・handFinish 等）
- `hell-mix-songs-lines.txt`: hell-mix SONGS への追加行の控え
- `review-walkure.txt` / `review-walkure-short.txt`: 点検ツールの全出力
- `scaffold.js`: スクラッチ側 rhythm-mode.js / rhythm-runtime-notes.js への入れ物挿入スクリプト（本実装時の挿入内容の控えを兼ねる）
- `work/`: 作業コピー一式（tools・authoring・スクラッチ版 data）。各種ログ（pipeline-*.log / step*.log / short-*.log）も prep/ 直下に残した
- 入れ物の内容（scaffold で用意）: 両曲の5難易度＋HELL の空マーカー、レベル仮行、`RHYTHM_SONG_ENTRIES`（displayName「ワルキューレ」、ショートは subtitle 'short ver.'、bgmTrackId は `melo_walkure` / `melo_walkure_short`、artwork は `images/song-art/walkure.jpg`）、`RHYTHM_SONG_BEATS`（walkure:[277.743,70,4]、walkure_short:[277.743,23,4]）、`RHYTHM_HELL_CHARTS`、`RHYTHM_PROTO_SONGS` の hell_debug 枠、`RHYTHM_DEMO_SONG_IDS` 末尾追加、`RHYTHM_SONG_VERSION_GROUPS` に [['walkure','原曲'],['walkure_short','short ver.']]

## 7. 残る未確定事項

1. **step6 残件の解消**（原曲 EXPERT 3・MASTER 2、ショート EXPERT 1）: 本実装のパイプライン --release がこのゲートで止まる。道具のモデル間差異が原因で、設定・variant の範囲では消えなかった。実装時の選択肢: 生成器側の改修を窓口と相談／該当箇所の手直し可否の判断（今回は「生成物の手直し禁止」の範囲外とした）。
2. **原曲 HELL の variant 選定**（variant 0 は条件未達。1〜3 未比較・各約61分）。
3. **ジャケット 1020×1008 の正方形化**: 判断未確定のまま記録だけ（entries の artwork は `images/song-art/walkure.jpg` を指す形で用意）。
4. **「きゅうこの曲」の扱い**: 未確認のまま記録だけ（今回は何もしていない）。
5. 本実装時の残工程: パイプライン --release（ランタイム書き込み・正式候補）、レベル表 --write、songClimax 測定、expert-master-order-check、hand-rules-check、build・run-checks、changelog、PR。

## 8. 作業中の事故メモ

- パイプライン一括実行が2回、外部からの SIGTERM で途中終了した（生成後・自動修正中）。対策として工程を分割し、自動修正は難易度別（--difficulty）に分けて完走させた。最終 artifacts の一貫性（生成→差し替え→自動修正→手の仕上げを同一設定で通過）は保たれている。
