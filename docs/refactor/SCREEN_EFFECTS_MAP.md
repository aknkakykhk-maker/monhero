# 画面ライフサイクルの分類表 — setTimeout 62 箇所を「画面専用 / 進行 / 対象外」に仕分ける

2026-09-10 作成(STEP 6-1)。対象は `monster-hero/src/parts/60-app.jsx`(`MonsterHeroGame`)。
`tools/ui/screen-effects-check.js` がこの表を読み、目印が本体にちょうど1つあることと、
表の件数が本体の `setTimeout` の数と一致することを見張っている。**表が古くなるとその検査が落ちる。**

## なぜ仕分けるのか

STEP 6 は「画面を離れたらタイマーが必ず止まる」ようにするのが目的だが、**一律に止めると壊れる**。
数えてみると 62 箇所のうち 31 箇所は「処理中フラグを false へ戻す」「WAVE リザルトへ進める」
「`await` している Promise を resolve する」で、止めると**フラグが立ったまま操作できなくなる**。
たとえば `rebirthProcessingRef.current=false` を止めると、限界突破が二度とできない個体ができる。

そこで `useScreenEffects`(`monster-hero/src/parts/40-screen-effects.jsx`)は種別を宣言させる。

| 種別 | 意味 | 画面を離れたとき |
| --- | --- | --- |
| `screen` | 画面専用。演出の後始末・位置の測定・プレビュー | **止める** |
| `progress` | 進行。フラグ戻し・次の画面へ進む・保存・掃除・`await` の resolve | **止めない**(登録簿から手を離すだけ) |
| 対象外 | 画面(`gameState`)に紐づかない。起動経路・アプリ常駐 | 登録簿に載せない |

内訳は **画面専用 16 / 進行 31 / 対象外 15**。`interval` `raf` `listen` は種別を取らず常に画面専用
(放っておくと永久に走る・参照を掴んだままになるため)。

## 表の読みかた

「目印」は本体の中でその箇所を一意に指す文字列。行番号は改修のたびにずれるので使わない。
「現状」は今の止め方で、`止める`(`clearTimeout` がある)/ `投げっぱなし` / `await`(Promise の resolve)。

## 画面専用(`screen`)— 16 箇所

| 目印 | 分類 | 現状 | 何をしているか / 判断の理由 |
| --- | --- | --- | --- |
| `setTimeout(() => setRpgBattle(prev =>` | screen | 止める | RPG デバッグ戦闘を1体ずつ進める。`RPG_DEBUG_BATTLE` 以外では effect ごと止まる |
| `setTimeout(() => setGameState('RPG_DEBUG_RESULT')` | screen | 止める | 決着を見せてから結果画面へ。デバッグ戦闘の中だけの遷移 |
| `setTimeout(() => setRpgActing(null)` | screen | 止める | RPG デバッグの攻撃モーションを消す |
| `setTimeout(() => setRpgHits(null)` | screen | 止める | RPG デバッグのダメージ数字を消す |
| `setTimeout(() => setRpgSpecial(null)` | screen | 止める | RPG デバッグの必殺演出を消す |
| `Audio_.startRhythmTrack(rhythmPreviewTrackId` | screen | 止める | 曲えらびの試聴を鳴らす。画面を出たら鳴り続けてはいけない |
| `setTimeout(() => setFusionAnimPhase(2)` | screen | 止める | 合体演出の2段目 |
| `setTimeout(() => setFusionAnimPhase(3)` | screen | 止める | 合体演出の3段目 |
| `setTimeout(() => setFusionStep('` | screen | 止める | 合体演出から結果表示へ。保存は演出の前に済んでいる |
| `setTimeout(()=>setBackupCopied` | screen | 投げっぱなし | 「コピーしました」の表示を戻すだけ |
| `setTimeout(()=>setTraini` | screen | 止める | トレーニングのマス効果の吹き出しを消す(`trainingEffectTimerRef`) |
| `setTimeout(()=>setTransc` | screen | 投げっぱなし | 超越演出の見本(デバッグ)を消す |
| `setTimeout(() => setSkip` | screen | 投げっぱなし | スキップ結果画面の演出を1段進める |
| `setTimeout(measure, 80);` | screen | 止める | バトルの案内を出す位置を、描画が落ち着いてから測る |
| `setTimeout(recenterModeL` | screen | 投げっぱなし | モード選びの横スクロールを中央へ寄せ直す |
| `setTimeout(()=>setReinca` | screen | 投げっぱなし | 転生演出の見本(デバッグ)を消す |

## 進行(`progress`)— 31 箇所

止めると何が起きるかを「壊れ方」に書いた。**ここを画面専用にしてはいけない。**

| 目印 | 分類 | 現状 | 何をしているか / 壊れ方 |
| --- | --- | --- | --- |
| `setTimeout(()=>{setScreenShake(false)` | progress | 投げっぱなし | 画面の揺れを戻す。止めると揺れたままバトルへ入る |
| `setTimeout(() => setRipples(prev => prev.filter` | progress | 投げっぱなし | タップ波紋を1件消す。止めると配列に溜まり続ける |
| `setTimeout(resolve, battleMs(baseMs))` | progress | await | `battleWait`。止めるとバトルの `await` が永久に止まり進行不能 |
| `dragAssignToSlot(cardIndex, si)` | progress | 投げっぱなし | ドラッグで入れた枠の光を戻す。止めると光ったまま |
| `atob(restoreInput.trim())` | progress | 投げっぱなし | コード復元後の再読み込み。止めると復元が画面に反映されない |
| `setTimeout(() => URL.rev` | progress | 投げっぱなし | バックアップファイルの ObjectURL を解放する。止めると掴んだまま |
| `throw new Error('no-save-keys')` | progress | 投げっぱなし | ファイル復元後の再読み込み。止めると復元が画面に反映されない |
| `setTimeout(r,350))` | progress | await | トレーニングの駒を進める待ち。止めると盤面が途中で固まる |
| `setTimeout(()=>finishTra` | progress | 投げっぱなし | 残りターン 0 でトレーニングを終える。止めると終われない |
| `setTimeout(r,320))` | progress | await | トレーニングのサイコロの待ち |
| `setTimeout(r,720))` | progress | await | トレーニングのサイコロの待ち(振り直し) |
| `setTimeout(r,850))` | progress | await | トレーニングのサイコロの待ち(確定) |
| `setTimeout(()=>rollTrain` | progress | 投げっぱなし | 道具で振り直したサイコロを次の tick で振る。止めると振り直しが起きない |
| `setTimeout(()=>{ setRebi` | progress | 投げっぱなし | 限界突破の演出終了と `rebirthProcessingRef=false`。止めると二度と限界突破できない |
| `setTimeout(()=>{ setTran` | progress | 投げっぱなし | 超越の演出終了と `transcendProcessingRef=false`。止めると二度と超越できない |
| `setSoulRankAnimation(null)` | progress | 投げっぱなし | 魂ランクの演出終了と `soulRankProcessingRef=false`。止めると二度と上げられない |
| `setTimeout(()=>{ setRein` | progress | 投げっぱなし | 転生の演出終了と `reincarnateProcessingRef=false`。止めると二度と転生できない |
| `setResultActionPending(false)` | progress | 投げっぱなし | リザルトの連打防止を戻す。止めると次の周回を始められない |
| `setTimeout(()=>setPopups` | progress | 投げっぱなし | バトルのダメージ表示を1件消す。止めると溜まり続ける |
| `setTimeout(()=>setTeachi` | progress | 投げっぱなし | 教えカードの演出を消す。止めると出たまま |
| `setTimeout(()=>advanceRu` | progress | 投げっぱなし | WAVE リザルトへ進む。止めるとバトルが終わらない |
| `setTimeout(()=>{setUltim` | progress | 投げっぱなし | 極限の距離開放の表示を消し `setIsBusy(false)`。止めると操作を受け付けない |
| `setTimeout(()=>{setEffec` | progress | 投げっぱなし | 合流演出のあと固有技強化へ進む。止めると進行が止まる |
| `setTimeout(()=>{setOwned` | progress | 投げっぱなし | 教えを反映して次の WAVE を始める。止めると次の WAVE が来ない |
| `const activeIds=slots.filter(Boolean).map(joinRosterEntry)` | progress | 投げっぱなし | トレーニング後に供モン合流・次の WAVE へ。止めると進行が止まる |
| `setTimeout(resolve,step.ms)` | progress | await | 図鑑の攻撃プレビューの1コマ待ち。打ち切りは `dexAttackPreviewRunRef` が持っている |
| `setTimeout(r,650))` | progress | await | 画像デバッグのモーション再生(ため) |
| `setTimeout(r,atkMotion==='eikiSa` | progress | await | 画像デバッグのモーション再生(踏み込み) |
| `setTimeout(r,atkMotion==='arkHol` | progress | await | 画像デバッグのモーション再生(技ごとの尺) |
| `setTimeout(()=>setEffect` | progress | 投げっぱなし | まとめて強化の演出を消す。止めると出たまま |
| `setSlotSettle(i);` | progress | 投げっぱなし | タップで入れた枠の光を戻す。止めると光ったまま |

## 対象外 — 15 箇所

画面(`gameState`)ではなく、起動経路やアプリ全体に紐づくもの。**登録簿には載せない**。
起動経路は `REGRESSION_RISK_MAP.md` §4-6 の「触らない領域」でもある。

| 目印 | 分類 | 現状 | 何をしているか / 対象外の理由 |
| --- | --- | --- | --- |
| `setTimeout(() => { if (!` | 対象外 | 止める | 追いつき表示を戻す。依存は `catchingUp / rhythmScreenOpen / runStage` で画面をまたぐ |
| `setTimeout(r, 260))` | 対象外 | await | 起動ゲージを 100% まで見せる待ち |
| `setTimeout(runRequired, ` | 対象外 | 止める | 起動時の必須読み込みの再試行 |
| `setTimeout(() => cb({tim` | 対象外 | 投げっぱなし | `requestIdleCallback` が無いブラウザの代替(染色マスクの先読み) |
| `setTimeout(() => r({ set` | 対象外 | await | 起動時の音の解錠を 1 秒で打ち切る |
| `setTimeout(r, 760))` | 対象外 | await | 起動時の音の解錠の最低待ち |
| `[0, 300, 1000].map(delay => setTimeout(` | 対象外 | 止める | タイトル BGM の再生を3回試す(`bootPhase` に紐づく) |
| `setTimeout(r,1800))]` | 対象外 | await | 入場前の画像デコードを 1.8 秒で打ち切る |
| `setTimeout(() => setEnte` | 対象外 | 止める | 入場が遅いときの案内を出す |
| `setTimeout(r, 1900))]` | 対象外 | await | 入場処理を 1.9 秒で打ち切る |
| `setTimeout(r, 850))` | 対象外 | await | 入場演出の最低待ち |
| `setTimeout(() => { bootT` | 対象外 | 投げっぱなし | タイトルのタップ吸収を解除する |
| `setTimeout(() => preload('score'` | 対象外 | 投げっぱなし | ランキングの裏での先読み(スコア) |
| `setTimeout(() => preload('breeder'` | 対象外 | 投げっぱなし | ランキングの裏での先読み(ブリーダー Lv) |
| `setTimeout(() => preload('bond',` | 対象外 | 投げっぱなし | ランキングの裏での先読み(絆 Lv) |

## 次の本でやること

STEP 6-2 以降の画面切り出しで、その画面が持つ行をこの表から探し、
`effects.timeout(fn, ms, 'screen')` / `effects.timeout(fn, ms, 'progress')` へ移す。
移したら「現状」の列を `登録簿` に書き換える。全部が `登録簿` になれば STEP 6 の
「`setTimeout` の直接呼び出しが `MonsterHeroGame` から消える」が満たされる。

`interval` 3 箇所・`requestAnimationFrame` 10 箇所・`addEventListener` 16 箇所も同じ登録簿へ移すが、
種別は取らない(常に画面専用)。プレイ時間の計測とバージョン確認の `setInterval` はアプリ常駐なので対象外。
