# 高速曲 HELL 横並び測定（上限表の判断材料）

目的: ワルキューレ原曲 HELL の選定で唯一届かなかった条件「同じ親指が1.5拍未満で段を変える件数」の上限表（Lv<45:0／45〜54:2／55〜64:4／≥65:6）が、公開済みの速い曲（200 BPM級）の HELL と比べて妥当かを判断する材料を作る。判断自体はしない。

## 方法
- 公開中の HELL 譜面（`rhythm-hell-level.js` の `hellCharts()` が列挙する、ゲームが読む形の譜面データ）を直接測る。再生成（mixBest）はしない。
- 物差しはワルキューレ選定と同一の関数 `rhythm-hell-mix.js` の `levelSwitchViolations(notes, beat)`。この関数は下書き形ノーツ（hand・sky 付き）を要求するため、公開譜面（runtime 形）を下書き形へ忠実に変換してから当てる:
  - スライド: 公開データに残っている `hand` をそのまま使う。点の高さ（sky）は slidePoints の sky。
  - タップ／ホールド／フリック: `hand` は道具自身の `handOf` フォールバック規則（中心位置 (sub+w/2)/2 が 3 未満なら L、そうでなければ R）で付ける。ホールドは下書き形の仕様どおり地上（sky:0）。
  - 変換の忠実さは往復変換（runtime→下書き→`toRuntime`→runtime）で照合する。
- beat（1拍の ms）は選定時と同じ `rhythm-hell-mix.js` の SONGS の値。SONGS に無い曲は解析ファイル（authoring/*-v3-audio.json）の timing.beatMs。
- Lv はワルキューレ選定と同じ `rhythm-chart-level.js` の `chartLevel`（v3）。
- 他の選定条件も同じ道具立てで測る: モンスター数（`counts`）、水平クロス（`flatCross`）、帯の中（`heldBandBlocked`）、押せない（`thumbCheck` の impossible＋地上だけの `simulateRuntime`）。交差区間の除外情報は公開譜面に無いため、thumbCheck は除外なしで数える（選定時の公式値より多めに出る可能性がある）。

## 検証（変換の正しさ）
- 往復変換（runtime→下書き→toRuntime）: lamia／freedom_dive／sheriruth で差分 0（時刻・種類・レーン・高さ・スライド点列が完全一致）。
- 独立検算: 物差しの定義を runtime 形のまま別実装で数え直し、erfolg 32／haruka 4／walkure_short 10／rebellion 43／lamia 20 が変換経由の値と全て一致。
- 測定は全曲 1 秒未満（直接測定のみ。再生成なし）。

## 結果 1: 高速帯（BPM 190 以上・公開 HELL 14譜面）

| 曲 | BPM | Lv | 段変え（上限） | モンスター | 水平クロス | 帯の中 | 押せない | 空タップ | ノーツ数 |
|---|---|---|---|---|---|---|---|---|---|
| six_eternel_beat | 276.0 | 62 | **14**（4） | 4 | 0 | 0 | 0 ※1 | 52 | 804 |
| megalovania_sans | 240.0 | 77 | **9**（6） | 4 | 0 | 0 | 0 | 39 | 971 |
| freedom_dive | 222.2 | 73 | **25**（6） | 4 | 0 | 0 | 0 | 47 | 782 |
| walkure_short | 216.0 | 49 | **10**（2） | 4 | 0 | 0 | 0 | 47 | 713 |
| erfolg | 213.4 | 58 | **32**（4） | 4 | 0 | 0 | 0 | 38 | 906 |
| sparkling_pink_overture | 212.0 | 52 | **12**（2） | 4 | 0 | 0 | 0 | 39 | 593 |
| amakakeru_tsubasa | 207.8 | 67 | **7**（6） | 4 | 0 | 0 | 0 | 78 | 522 |
| haruka | 200.0 | 62 | 4（4）✓ | 4 | 0 | 0 | 0 | 46 | 492 |
| lamia | 199.0 | 78 | **20**（6） | 4 | 0 | 0 | 0 | 42 | 728 |
| nothing_without_you | 194.0 | 44 | **25**（0） | 4 | 0 | 0 | 0 | 44 | 729 |
| rebellion | 193.5 | 48 | **43**（2） | 4 | 0 | 0 | 0 | 67 | 1168 |
| rebellion_short | 193.5 | 49 | **22**（2） | 4 | 0 | 0 | 0 | 28 | 720 |
| eiyuu_no_akashi_milktea | 192.1 | 52 | **9**（2） | 4 | 0 | 0 | 0 | 21 | 645 |
| rising_hope | 190.0 | 58 | **11**（4） | 4 | 0 | 0 | 0 | 7 | 439 |

※1 six_eternel_beat の thumbCheck（交差区間を除外できない形）では impossible 1件だったが、地上だけの simulateRuntime では 0。交差区間の情報が公開譜面に無いための参考値。

読み取れること（判断材料）:
- 高速帯 14譜面のうち、上限表以内は haruka（200 BPM・4件＝上限ちょうど）だけ。残り 13譜面は上限の 1.2〜21 倍（中央値 14件）。
- 他の選定条件（モンスター4・水平クロス0・帯の中0・押せない0）は高速帯の全譜面が満たしている。公開 HELL で実績として存在するのは「段変えだけが上限表より多い」形。
- 同じ曲のショート版 walkure_short は 10件（上限2）だったが、これは作業用コピーに下準備で登録した譜面で、ゲームには未公開（本物 main に walkure の登録が無いことを 2026-11-22 に確認済み）。参考値として扱う。原曲の最良見当付け 6件（Lv.61・上限4）は、公開済みの高速曲の実績範囲（4〜43件）の中では少ない側に位置する。
- 参考: 185〜189 BPM 帯も大半が超過（light_player 27／tsuki_ga_michiru_mae_ni 21／evans 25／sheriruth 19／gourmet_race_64 11／black_shout 7／light_player_short 6／tsuki_short 6＝上限6以内は tsuki_short のみ）。さらに公開 HELL 全 80譜面で見ても、上限表以内は 4譜面（haruka・tsuki_ga_michiru_mae_ni_short・humanoid・dr_wily_stage_1）だけだった。つまりこの上限表は高速曲に限らず、公開済み HELL の実績とは全般に合っていない。

## 結果 2: 全譜面の生データ
- `fast-compare/results.json` / `fast-compare/run.log`: 公開 HELL 80譜面＋grievous_lady（難易度 MASTER のため対象外。参考値: BPM 210・段変え 28）の全測定値（同じ側150ms・見分けにくい所・同じ位置・交差の参考値も含む）。
- 測定スクリプト: `fast-compare/measure.js`（読み取りのみ・再実行可）。

## 注意（数値の前提）
- 親指の割り当て: スライドは公開データの `hand` を使用。タップ等は位置からの復元（道具自身の `handOf` フォールバック規則）。交差区間で「位置と逆の親指」が割り当てられていた箇所は公開データに残っていないため、選定時の公式値と完全一致は保証できない。ただし超過の幅（上限の数倍〜20倍超）が大きいため、この前提で桁の結論が変わる可能性は低い。
- 「押せない」は thumbCheck の impossible と地上だけの simulateRuntime の両方で確認し、表には simulateRuntime でも残った場合のみ本数として扱う考え方に近い（six_eternel_beat の ※1 参照）。選定時の公式の押せない判定（交差区間除外あり）とは厳密には同一でない。
- Lv は選定時と同じ chartLevel（v3）。ゲーム内表示 Lv とは算出方法が違う場合がある。
