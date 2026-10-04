# 画面ライフサイクルの分類表 — setTimeout 92 箇所を「画面専用 / 進行 / 対象外」に仕分ける

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

内訳は **画面専用 22 / 進行 30 / 対象外 16**(2026-09-27 に表を今に合わせた。作成時は 16 / 31 / 15。
タップの波紋は 24-battle-fx.jsx へ、画像デバッグのモーション再生3つは 23-rpg-debug.jsx の `attackMotionPreviewSequence` へ移ったので表から外した)。`interval` `raf` `listen` は種別を取らず常に画面専用
(放っておくと永久に走る・参照を掴んだままになるため)。

## 表の読みかた

「目印」は本体の中でその箇所を一意に指す文字列。行番号は改修のたびにずれるので使わない。
「現状」は今の止め方で、`止める`(`clearTimeout` がある)/ `投げっぱなし` / `await`(Promise の resolve)。

**STEP 6 で画面を切り出すと、タイマーも画面ファイルへ移る。** 移った先は「現状」の欄に書き足す。
検査(`tools/ui/screen-effects-check.js`)は本体と切り出した画面を合わせて数えるので、
移しただけでは落ちない。落ちるのは「表に書き忘れた」「表から消えた」ときだけ。

## 画面専用(`screen`)— 22 箇所

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
| `battleMs(Math.round(fxMs*0.12))` | screen | 投げっぱなし | ムーのムービーのあと、技が当たる瞬間に画面を揺らす。止めても揺れないだけ |
| `setTimeout(()=>triggerShake(true), battleMs(Math.round(fxMs*tacticsEnemyHitFrac(` | screen | 投げっぱなし | タクティクスの敵の動きに合わせて、当たる瞬間に揺らす。止めても揺れないだけ |
| `setTimeout(() => finish(true), BOSS_MOVIE_MAX_MS)` | screen | 止める(71-screen-battle.jsx の `BossMovieLayer`) | ボスのムービーを長さの上限で打ち切る。部品が閉じるときは後片付けが `finish(false)` で待っている側を起こす |
| `setTimeout(() => setCanSkip(true), 900)` | screen | 止める(71-screen-battle.jsx の `BossMovieLayer`) | ボスのムービーのスキップを出す |
| `if (!started) finish(false); }, BOSS_MOVIE_START_TIMEOUT_MS` | screen | 止める(71-screen-battle.jsx の `BossMovieLayer`) | ボスのムービーが始まらないときに打ち切る。部品が閉じるときは後片付けが待っている側を起こす |
| `fxRestTimerRef.current = setTimeout(` | screen | 止める(71-screen-battle.jsx) | タクティクスで操作が無いあいだ演出を休ませる。止めても休まないだけ |

## 進行(`progress`)— 30 箇所

止めると何が起きるかを「壊れ方」に書いた。**ここを画面専用にしてはいけない。**

| 目印 | 分類 | 現状 | 何をしているか / 壊れ方 |
| --- | --- | --- | --- |
| `setTimeout(()=>{setScreenShake(false)` | progress | 投げっぱなし | 画面の揺れを戻す。止めると揺れたままバトルへ入る |
| `if (runGenerationRef.current === generation) resolve();` | progress | await | `battleWait`。止めるとバトルの `await` が永久に止まり進行不能 |
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
| `advanceRunStage('WAVE_RESULT');},battleMs(defeatFxOn` | progress | 投げっぱなし | 撃破演出を消して WAVE リザルトへ進む。止めるとバトルが終わらない |
| `setTimeout(()=>{setUltim` | progress | 投げっぱなし | 極限の距離開放の表示を消し `setIsBusy(false)`。止めると操作を受け付けない |
| `advanceRunStage('UPGRADE_SKILL');},battleMs(joinBaseMs` | progress | 投げっぱなし | 合流演出のあと固有技強化へ進む。止めると進行が止まる |
| `setEffect(null); setOwnedTeachings(nextTeachings)` | progress | 投げっぱなし | 教えを反映して次の WAVE を始める。止めると次の WAVE が来ない |
| `setEffect({type:'heal',label:guardLevelUp?` | progress | 投げっぱなし | トレーニング後に供モン合流・次の WAVE へ。止めると進行が止まる |
| `setTimeout(resolve,step.ms)` | progress | await | 図鑑の攻撃プレビューの1コマ待ち。打ち切りは `dexAttackPreviewRunRef` が持っている |
| `setTimeout(()=>setEffect(null),1200)` | progress | 投げっぱなし(65-screen-masu-enhance.jsx へ移動済み) | まとめて強化の演出を消す。止めると出たまま |
| `setSlotSettle(i);` | progress | 投げっぱなし | タップで入れた枠の光を戻す。止めると光ったまま |
| `}, TACTICS_SLOT_FX_MS);` | progress | 止める(次を出すとき) | タクティクスの枠の出来事の札を消す。止めると出たまま |
| `setTacticsExCutin(null); }, ms` | progress | 止める(次を出すとき) | EXのカットイン(教えカードの演出もここへまとまった)を消す。止めると出たまま |
| `setEffect(null), TRANSCEND_ENHANCE_FX_MS` | progress | 投げっぱなし | 超越強化の演出を消す。止めると出たまま |

## 対象外 — 16 箇所

画面(`gameState`)ではなく、起動経路やアプリ全体に紐づくもの。**登録簿には載せない**。
起動経路は `REGRESSION_RISK_MAP.md` §4-6 の「触らない領域」でもある。

| 目印 | 分類 | 現状 | 何をしているか / 対象外の理由 |
| --- | --- | --- | --- |
| `setTimeout(() => { if (!(catchUpUntilRef` | 対象外 | 止める | 追いつき表示を戻す。依存は `catchingUp / rhythmScreenOpen / runStage` で画面をまたぐ |
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
| `refreshRhythmRankingPending(); }, RANKING_RESEND_DELAY_MS` | 対象外 | 止める | 送れなかったランキングの記録を、HOMEに落ち着いてから1回だけ送り直す(アプリ全体で1回) |
| `const timer = setTimeout(resolve, ms)` | 対象外 | await | ランキング送信を待つ時間切れ(`withRhythmRankingTimeout`)。送信が終われば `clearTimeout` で消す |
| `RHYTHM_RANKING_RETRY_DELAYS_MS.map(ms => setTimeout(` | 対象外 | 止める | 送れなかった音ゲーのランキング記録を、開いたまま何度か送り直す。次の予約のたびに前の分を `clearTimeout` |
| `void syncBondLevelsLive(); }, wait` | 対象外 | 止める | 絆Lv・総合力ランキングへの送信。effect の後始末で `clearTimeout` |
| `setGuardImpact(p => (p && p.key === key ? null : p)), battleMs(820)` | progress | 投げっぱなし | ガードの衝撃演出を消す。止めると出たまま |
| `setShown(null), 950` | progress | 投げっぱなし | 小さな表示(1回ぶん)を消す。止めると出たまま |
| `setShown(null), 1500` | progress | 投げっぱなし | 小さな表示(1回ぶん)を消す。止めると出たまま |
| `triggerShake(true), battleMs(240)` | screen | 投げっぱなし | 当たった瞬間の画面の揺れ。止めても揺れないだけ |
| `triggerShake(big); if(big) Audio_.se.crit(); }, hitAt` | screen | 投げっぱなし | 敵の技が当たる瞬間の揺れと会心音。止めても揺れないだけ |
| `setEffect(null); proceedAfterUniqueUpgrade(); }, ms` | progress | 投げっぱなし | 固有技の強化結果(SKILL UP!)を消して次の画面へ進む。止めると進行が止まる |
| `setTimeout(publishFriendProfile, wait)` | 対象外 | 止める | フレンドに見せる自分のプロフィールの公開。アプリ全体で1回(effect の後始末で止める) |
| `if (!closed) onClose(); }, 0` | 対象外 | 止める | 通信を作れなかったとき、呼び出し側へ閉じたことを知らせる(音ゲーのマルチ) |
| `reconnectTimer = setTimeout(` | 対象外 | 止める | 通信が切れたとき2.5秒後に繋ぎ直す。閉じたら止める(音ゲーのマルチ) |
| `resolve(rhythmMultiBestRoom(rooms, '')); }, RHYTHM_MULTI_LOBBY_LISTEN_MS` | 対象外 | await | ロビーの部屋一覧を待つ時間切れ。待っている Promise を resolve する |
| `setFlash(null), 900` | screen | 止める | 画面のフラッシュ演出を消す(音ゲーのマルチ) |
| `setBubbleTick((n) => n + 1), wait + 50` | screen | 止める | 吹き出しを時間で更新する(音ゲーのマルチ) |
| `setCountdown((c) => (c ? { ...c, left: c.left - 1 } : c)), 1000` | screen | 止める | 開始までのカウントダウンを1つ減らす(音ゲーのマルチ) |
| `setShuffleStopped(true); }, RHYTHM_MULTI_SHUFFLE_MS - 800` | screen | 止める | シャッフル演出を止める(音ゲーのマルチ) |
| `RHYTHM_MULTI.markShuffleShown(shuffleRound), RHYTHM_MULTI_SHUFFLE_MS` | progress | 投げっぱなし | シャッフルを見せた印を付ける。止めると同じ演出がまた出る |
| `setCopied(false), 2000` | progress | 投げっぱなし | 「コピーしました」の表示を戻す。止めると出たまま |
| `if (reduce || from === to) { setValue(to); return undefined; }` | screen | 止める | 数字のカウントアップ演出(画面を離れたら止める) |
| `const raidTotals = await Promise.race([sbFetchRaidJackTierTotals(RAID_JACK_EVENT.id)` | 対象外 | await | HOMEの見回りで、ジャックの段階の合計を取る通信の時間切れ(4秒で null を返して今回は出さない) |
| `const totals = await Promise.race([sbFetchRaidJackTierTotals(raidJackEventId)` | 対象外 | await | レイド画面の段階の合計を取る通信の時間切れ(4秒で null を返す) |
| `const loop = () => { timer = setTimeout(` | screen | 止める | HOMEのジャックが「ときどき両腕ポーズ」を取る間隔(約5.6秒おき)。画面を離れたら止める(`alive`・`clearTimeout`) |
| `setPose(false); loop(); }, 1400)` | screen | 止める | 両腕ポーズを戻して次の間隔へ(1.4秒)。画面を離れたら止める |
| `setRaidGrowthBanner(null), 3200` | screen | 止める | レイドバトルの「強化が入ったターン」の帯を消す(3.2秒)。後始末で `clearTimeout` |

## 次の本でやること

STEP 6-2 以降の画面切り出しで、その画面が持つ行をこの表から探し、
`effects.timeout(fn, ms, 'screen')` / `effects.timeout(fn, ms, 'progress')` へ移す。
移したら「現状」の列を `登録簿` に書き換える。全部が `登録簿` になれば STEP 6 の
「`setTimeout` の直接呼び出しが `MonsterHeroGame` から消える」が満たされる。

`interval` 3 箇所・`requestAnimationFrame` 10 箇所・`addEventListener` 16 箇所も同じ登録簿へ移すが、
種別は取らない(常に画面専用)。プレイ時間の計測とバージョン確認の `setInterval` はアプリ常駐なので対象外。
