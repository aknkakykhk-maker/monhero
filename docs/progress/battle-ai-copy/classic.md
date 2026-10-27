# AI コピー(5人目)— クラシック系5つの遊びの洗い出し(バトル部ダイスくん)

ソラシドのアシカ「ソラシドの自動化 → 全自動 → 無人運転」で、使った子の「AI コピー」が次のターンから5人目の味方として戦う。
ここは**タクティクス以外**(クラシック・チャレンジ・プロ・クイック・極限など)の受け持ち。まだ作っていない。調べただけ。
行番号は main `cf67ceb8`(2026-10-27)のもの。

## まず押さえる前提(クラシック系の作り)

| 前提 | どこ | 中身 |
| --- | --- | --- |
| 枠は4つ固定 | 60-app.jsx 696 `useState([null,null,null,null])`・10173 / 10420 / 15198 も `[null×4]` | 定数は無い(`RPG_MAX_PARTY` は RPG だけ)。4 は直書き |
| **枠の番号 = 間合い** | 10-core.jsx 502 `heroDistance < 4`・60-app.jsx 14913 `computeAtkTier(currentSlots, dist)`・15421 `heroSlot < 4` | 0=零・1=近・2=中・3=遠。距離撃のカードも枠ごと(buildDeck 14816 の `rangeIdx = idx`) |
| ライフ・ガッツはパーティで1組 | `hp`・`maxHp`・`guts` の state | 敵の攻撃はこの1組へ入る(handleEnemyTurn 12410〜。クラシックの分かれ道は 12706 `isEvasion && !isTacticsMode`・12914〜12920 `setHp(remainingHp)`) |
| ライフ0で負け | 10038 の useEffect `if (hp <= 0)`・14305 `runResultFinished = hp <= 0`・14523/14528 AUTO を止める・23188 負けの画面・5465 BGM | どれも `hp` だけを見る |
| 敵は「だれ」を狙わない | 12562 `aimedSlots = isTacticsMode ? … : …`・12566 `defenseHeroId = !isTacticsMode ? mainHero?.id` | クラシックは狙いの枠が無い。守りの判定は勇者モン1体ぶん |
| 4人まで | 14685 `postWaveJoinPossible`・14728 `finishQuickGrowth`・16136 `trainingFxEntry` の `slots.filter(Boolean).length < 4` | 供モンが入れるかの判定 |

## 目利き: 5人目は `slots` の5つ目にしない(別の state で持つ)

`slots` を5つにすると、「枠の番号 = 間合い」(4つしかない)・ランキングへ送る編成(6745)・報酬の参加マスモン(9665)・供モンの「4人まで」・
強化やトレーニングの一覧(16097・16252・16434)など、**コピーを入れてはいけない所まで全部に入ってしまう**。
そこで、コピーは `slots` の外に、別の state で持つのがよい:

```
aiCopy = { srcSlot, srcMonsterId, level, spawnTurn, turnsLeft, hp, maxHp, atk, def, guts, maxGuts, hand, nextCard, uniqueCardUid } | null
```
(2026-10-27 開発部と決めた形。保存しない。出すのはアシカの効果から呼ぶ `summonAiCopy(slotIdx, level)`。強さ・ターン数・手札・1枚の選び方・固有技の出し入れは開発部の純粋な関数を呼ぶ。印は `RELEASE_FLAGS.assistantSorashido`)

- 立つ間合いは元の子と同じ `srcSlot`(5つ目の間合いは作らない)。画面の置き場は、縦は4人の列の右はし・横向きは列の下(部長の決め)
- `slots` に入れないので、⑤「4人まで」「倒れたら負け」・ランキング・報酬・セーブからは**何もしなくても外れる**。逆に、コピーを入れたい所(下の表の ①〜④)だけ足す
- **社長の答え(2026-10-27・案2): 5つの遊びのコピーは自分のライフを持たず、パーティの1組のライフを使う。狙われず、倒されず、続くターンが切れたら消える。** なので `aiCopy` の `hp`・`maxHp` は5つの遊びでは持たない(使わない)。ガッツはコピーだけのガッツ(`guts`・`maxGuts`)で毎ターン1枚(社長はまだ何も言っていないので、この形で進める)
- パーティの `hp` も負けの判定も今までどおり

## 変える所の一覧

| # | ファイル | 関数(行) | いまの前提 | 変えること |
| --- | --- | --- | --- | --- |
| ① 枠 | 71-screen-battle.jsx | 味方の枠 2441 `slots.map`(`grid-cols-4`。タクティクスの新配置は `2x2`) | 4列 | 4人の列の右はしに、コピーの札(ライフ・ガッツ・残りターン・元の子の間合い)を足す。間合いの軸(4列)とは別に置き、5つ目の間合いに見えないようにする |
| ① 枠 | 71-screen-battle.jsx | 横向き(#3953 の2列)の CSS 12〜30 行 `.grid.grid-cols-4 … height:112px` | 4列で高さ固定 | 横向きは列の下にコピーの札を置くので、左の列の高さの割り振り(grid-template-rows)に1段足して測り直す |
| ① 枠 | 71-screen-battle.jsx | 極限の小さい枠 1633 `data-ultra-ally-slots grid-cols-4` | 4列 | 同じく右はし(横向きは下)に小さい札 |
| ② 状態 | 60-app.jsx | 新しい state `aiCopy`(696 の近く)・`resetAllState` 10171・`returnToHome` 10871・`handleGiveUp` 11149・`initBattle` 15045 | — | ランの始め・終わり・やめたときに `null` へ戻す。WAVE の終わりに消す(続くターンが残っていても消し、山札の固有技もそこで抜く。窓口の答え待ちの仮。またいで残す答えなら dismissAiCopy を呼ぶ所を外すだけにする)。ライフは持たない(ガッツだけ) |
| ③ 敵の狙い | 60-app.jsx | `handleEnemyTurn` 12410〜(クラシックの攻撃は 12914〜12920) | 攻撃は全部パーティの `hp` へ | **変えない**(社長の答え: コピーは狙われない。攻撃は今までどおりパーティの1組へ) |
| ④ 山札 | 60-app.jsx | `buildDeck` 14816 | 固有技は4枠ぶん | コピーがいれば固有技を1枚足す(`ownerSlotIdx: 'copy'` のような印)。消えたら手札・山札・捨て札から抜く(タクティクスの `ensureTacticsExUniqueInHand` と同じ抜き方) |
| ④ 山札 | 60-app.jsx | `getCardGuts` 10139・`slotMaxUses` 10119・`dragAssignToSlot` 11966 | 置き先は4枠 | プレイヤーはコピーへカードを置けない(コピーは自分の手札で動く)。コピーの固有技カードはコピー専用 |
| 戦いの流れ | 60-app.jsx | `processTurn` 13516 | 味方が撃つのはプレイヤーが置いたカードだけ | **プレイヤーのカードを解いたあと・敵の番(handleEnemyTurn)の前**にコピーが1枚撃つ。ダメージは `getDmg(card, srcSlot, aiCopy.mon …)` 12211 にコピーのちから(元の 60%〜)を渡す。コピーのガッツが足りなければ撃たない |
| 戦いの流れ | 60-app.jsx | ターン終わりの自動回復 12951〜12972 | パーティだけ | コピーのガッツも戻すか(社長の決め。案: 同じ率)。続くターンを1減らし、0 で消す(固有技のカードを抜く) |
| ⑤ 4人・負け | 60-app.jsx | 14685・14728・16136 の `< 4`・10038・14305・23188 の `hp <= 0` | — | **触らない**(`slots`・`hp` の外に置くので、そのままでコピーは数えられない) |
| 触らない | 60-app.jsx | ランキング 6723/6745 `submitLocalScore`・報酬 9665 `awardRunRewards`・`runHasDebugOnlyMonster` 7477 | `slots` から編成を作る | コピーを入れない(`slots` の外なので入らない) |

## 公開まで出さない印

`RELEASE_FLAGS`(17-release-changelog-login-missions.jsx 80)に新しい印を足し、偽のあいだはアシカ「ソラシドの自動化」をくじに出さない。
デバッグの「公開の印が真だったら」でだけ試せるようにする(rhythmHell と同じ形)。

## 社長の答え待ち・決めること

- (決まった)ライフはパーティの1組を使う・狙われない・倒されない(2026-10-27 社長の答え・案2)
- コピーのガッツの自動回復(ターン終わり)
- タクティクス側(別の人の受け持ち)と、`aiCopy` の形・コピーの AI(1枚の選び方)をそろえるか

## 分担(2026-10-27 ジン部長)

- 開発部(ドライバーくん・枝 claude/sorashido-assist): アシカの札・ルールの部品(コピーの強さ・ターン数・切りかえ・固有技の出し入れ・手札と「次に使うカード」の決め方)・見せ方の部品
- バトル部: バトルの状態に5人目を持たせる・敵の狙い(タクティクスだけ)・ターンの順番(プレイヤーのカードのあと1枚)・ダメージとガード・負けの判定から外す・枠の置き場。クラシック系 = ダイスくん、タクティクス = セコンドくん。出す・消す・ターンの始めと終わり・コピーの1枚を使う所は2人で1つの部品にする(タクティクスだけのライフ・狙い・倒れは分ける)

## 社長が決めた Lv ごとの数字(2026-10-27・ジン部長から)

| Lv | 続くターン | ちから | 丈夫さ | ガッツ | うまさ | 1ターンに使う枚数 |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | 2 | 60% | 50% | 60% | 50% | 1枚 |
| 2 | 3 | 80% | 70% | 80% | 65% | 1枚 |
| 3 | 4 | 90% | 80% | 90% | 80% | コピーのガッツの上限が 120 以上で、いまのガッツが2枚ぶん足りるときだけ2枚(上限2枚)。ほかは1枚 |

- 率は元の子に対して。5つの遊びはライフを持たないので、ライフの率は使わない。狙われやすさは5つの遊びでは差が出ない(狙われない)
- processTurn でコピーが使う所は、ドライバーくんの「Lv から枚数の上限などを返す関数」を呼び、その枚数まで「選ぶ → ガッツを引く → 撃つ」を繰り返す形にする。Lv1・Lv2 はいつも1枚
- コピーが使う枚数は、プレイヤーの使える枚数(cardLimit)には数えない

## 開発部の純粋な関数(2026-10-27 ドライバーくん。monster-hero/src/parts/32-sorashido-copy.jsx・説明は docs/progress/sorashido-assist-parts.md)

クラシック系から呼ぶもの:

| 関数 | 使う所 |
| --- | --- |
| `aiCopyStats(srcMon, level, { mode:'classic', effMul, permaAtkPct })` → `{ atk, def, maxGuts, guts, permaAtkPct }`(classic は maxHp を返さない) | 出すとき(summonAiCopy の中) |
| `aiCopyTurns(level)`・`aiCopyRules(level)` | 続くターン・1ターンの枚数の上限 |
| `aiCopyHand(deck, uniqueCard, rand)` → 山札の写しから2枚+固有技 | 出すとき・毎ターンの手札。山札はバトル部が渡す |
| `aiCopyPickCards(hand, { score, costOf, guts, maxGuts, rng, level })` → 0〜2枚(先頭が nextCard) | processTurn でプレイヤーのカードのあと。score は AUTO の点・costOf は getCardGuts |
| `aiCopyUniqueCard(card, srcMonsterId)`・`aiCopyRemoveUnique({ deck, hand, discard }, { uid })` | buildDeck に固有技を1枚足す・消えたら抜く |
| `aiCopySummonPlan(aiCopy, { srcSlot, srcMonsterId, level })` → `{ kind:'new'|'refresh'|'switch', turnsLeft, removeCopy, removeUniqueOf, addUniqueOf }` | アシカを使ったとき |
| `aiCopyTurnEnd(aiCopy)` | ターンの終わり(残りを減らし、0 で消す) |

共通の部品(summonAiCopy・dismissAiCopy・tickAiCopy)はセコンドくんが 33-ai-copy.jsx に書き、上の関数を中で呼ぶ。クラシック系はそれを呼ぶ。

## 作ったもの(2026-10-27 ダイスくん・公開の印 assistantSorashido の裏)

| 所 | 中身 |
| --- | --- |
| 33-ai-copy-classic.jsx | `classicAiCopySrc`(元の子1体の値。供モンも基礎の値=定数 `CLASSIC_AI_COPY_ALLY_BASE`。'plus' で合流ぶんへ戻せる)・`classicAiCopyIsAttack`・`classicAiCopyDamage`・`classicAiCopySpendGuts`・`classicAiCopyRegenGuts`。検査 `tools/battle/ai-copy-classic-check.js` |
| 60-app.jsx `summonClassicAiCopy` | セコンドくんの分かれ道(copy_sorashido)から呼ばれる。固有技の写しはタクティクスと同じく**山札に入れずコピーが持つ**(uniqueCard)。山札の枚数は変わらない |
| 60-app.jsx `planClassicAiCopy` | ターンの終わり(setTurnCount の直後)に、次のターンに出ているコピーの手札と使うカードを決める(枠の札の「次に使うカード」) |
| 60-app.jsx processTurn | `pdTag()` の直後・敵の番の前に、決めておいたカードを使う。ガッツはコピーの分。攻撃は getDmg を元の子の間合いで出し、ちからの比で縮めて attackHits へ(noAnim) |
| 60-app.jsx ターンの終わり | tickAiCopy の直前に、コピーのガッツをパーティと同じ率で戻す(仮) |
| 71-screen-battle.jsx `ClassicAiCopyCell` | 縦は4枠の右はし(幅58px)、横向き(背の低い画面)は列の下の細い帯。コピーがいないときは `display:contents` で列の組み方は今までのまま。写真 `docs/playbot/reports/2026-10-27/ai-copy-classic/` |

段2(2026-10-27): 選ぶ点は共通の aiCopyAutoScore(AUTO の作戦の優先 → 与ダメ)。ガードはコピーの丈夫さで構えてパーティを守る(GUARD_EVOLUTION の flat + コピーの def × mult)。回復・強化・アシカはタクティクスと同じ aiCopyEntries で味方のカードと同じ流れに通す(ガッツはコピーの分)。
コピーの手札の窓(SorashidoCopyHandSheet)/出る・消える演出(appear・vanish)/WAVE をまたぐか(社長の答え待ち)

段3(2026-10-27): コピーは自分の山札を持つ(社長)。共通の summonAiCopy に プレイヤーの山札・手札・捨て札を渡して山札を作る(出たとき・切りかえたとき)。planClassicAiCopy は planAiCopyTurn(count=プレイヤーの手札の枚数)。ターンの終わりは共通の endAiCopyTurn。固有技の写しの出し入れ(classicAiCopyZones・CLASSIC_AI_COPY_UNIQUE_IN_DECK)は外した。プレイヤーの山札は変えない。

段4(2026-10-27): コピーの攻撃・固有技も aiCopyEntries に入れ、プレイヤーのカードと同じ流れに通す。流れの中の getDmg 2か所(あつの挑発・ふつうの攻撃)に dmgScale(コピーのちから ÷ パーティのちから)を掛ける。固有技の特別な効き目はプレイヤーと同じに乗る。ガードだけはコピーの丈夫さで構える別の所。トリックスタートのガッツ返しはコピーの札では返さない。
まだ(部長の判断待ち): 運命のコインの帯・ダメージの数字・ログに出る名前が元の子の名前(見た目だけ)/スエゾーやドレインで戻るガッツはパーティへ入る
