# ソラシドのアシカ「ソラシドの自動化」: 開発部の部品とバトルへのつなぎ方(2026-10-27 ドライバー)

社長が決めた効果は、クラフト部長の依頼のとおりです(使った子の AIコピーが、使った次のターンの始まりに5人目の味方として現れ、決めたターン数のあいだ戦う)。
公開はキュービ・オリヒメと同じ日です。公開の印 `assistantSorashido` は、ストックくんの `claude/sorashido` が足します。こちらは読むだけです。

開発部が作ったのは、データ・計算の部品・見せ方の部品です。バトルの状態に5人目を持たせる所は、バトル部(ジンくん)が作ります。
5人目を出す・消す時期、敵の狙い、ターンの順番、ダメージとガード、倒れたとき、枠とマスの置き場もバトル部の受け持ちです。

## データ(`monster-hero/data/breeder.js`)

| 名前 | 中身 |
| --- | --- |
| `TEACHING_CARDS` の `sorashido` | `subType:'copy_sorashido'`・ガッツ20・`releaseFlag:'assistantSorashido'` |
| `BREEDER_EVO_NAMES.sorashido` | ソラシドの自動化 → 全自動 → 無人運転 |
| `SORASHIDO_TIERS[Lv]` | `rates`(ライフ・ちから・丈夫さ・ガッツ。Lv1 50/60/50/60%・Lv2 70/80/70/80%・Lv3 80/90/80/90%)・`turns`(2→3→4)・`pick`(0.5→0.65→0.8)・`maxCards`(1/1/2)・`hateStart`(0.5/0.75/1.0)・`hateGain`(1.0/1.25/1.5)・`gutsFor2`(120) |
| マーケット `sorashido` | 150,000。公開の印が立ち、加入のお話 `sorashido_join_2026_10_27` を見たら並ぶ(`sorashidoCardOnSale`) |
| `teachingCardReleased(card)` | 公開の印が付いたアシカを、印が立つまで表に出さない(ヘルプの「ブリーダーの教え」) |

- ヘイトは `TACTICS_HATE.assist.sorashido = 'buff'`(「強める」と同じ5)です。
- ヘルプの説明は `releaseFlag:'assistantSorashido'` を付けて置いています。
- EXTREME では、ほかのアシカと同じく効果倍率 `effMul`(0.5)をコピーの強さに掛けます。

## 計算の部品(`monster-hero/src/parts/32-sorashido-copy.jsx`・純粋な関数)

コピーの状態 `aiCopy = { srcSlot, srcMonsterId, level, spawnTurn, turnsLeft, hp, maxHp, atk, def, guts, maxGuts, hand, nextCard, uniqueCardUid, pos }` はバトル部が持ちます(保存しない)。
乱数は `rng`(0以上1未満を返す関数)を渡します。検査では固定しています(`tools/battle/sorashido-copy-check.js`)。

| 関数 | いつ呼ぶ | 返すもの・バトル側がやること |
| --- | --- | --- |
| `aiCopyRules(level)` | いつでも | `{ rates, turns, pick, maxCards, hateStart, hateGain, gutsFor2 }`(Lv 0〜2) |
| `aiCopyTurns(level)` | コピーを作るとき | 2 / 3 / 4 |
| `aiCopySummonPlan(aiCopy, { srcSlot, srcMonsterId, level })` | アシカを使ったとき(`summonAiCopy` の中) | `{ kind, turnsLeft, removeCopy, removeUniqueOf, addUniqueOf }`。下の表のとおり |
| `aiCopyTurnEnd(aiCopy)` | コピーが出ているターンの終わり | `{ turnsLeft, expired, removeUniqueOf }`。`expired` ならコピーを外し、固有技を抜く |
| `aiCopyStats(src, level, { mode, effMul, permaAtkPct })` | コピーを置くとき | `{ atk, def, maxGuts, guts, permaAtkPct }`。`mode:'tactics'` のときだけ `maxHp・hp` も返す(5つの遊びはパーティのライフ) |
| `aiCopyStartHate(srcHate, level)` | タクティクスでコピーを置くとき | 元の子の🔥の 50 / 75 / 100%(上限100) |
| `aiCopyHateGainMult(level)` | タクティクスで🔥が増えるとき | ×1.0 / ×1.25 / ×1.5 |
| `aiCopyUniqueCard(card, srcMonsterId)` | 固有技を1枚足すとき | 印 `sorashidoCopyOf` と `uid` を付けた写し(`uniqueCardUid` に持つ) |
| `aiCopyRemoveUnique({ deck, hand, discard }, { uid } または { srcMonsterId })` | 抜くとき | 3か所から印の付いた分だけを抜いた新しい配列 |
| (古い形)`aiCopyHand` | — | 下の「2026-10-27 の変更」の `aiCopyBuildDeck`・`aiCopyDraw` に替わりました |
| `aiCopyPickCards(hand, { score, costOf, guts, maxGuts, rng, level })` | 手札を作ったあと | 使うカードの配列(0〜2枚)。先頭が `nextCard`。`score` には AUTO の点を渡す |

`aiCopySummonPlan` の `kind` ごとに、バトル側がやること:

| kind | どんなとき | バトル側がやること |
| --- | --- | --- |
| `'new'` | コピーが出ていないとき | `addUniqueOf` の固有技を1枚足す |
| `'refresh'` | 同じ子でもう一度使ったとき | 続くターンが最初に戻るだけ。固有技は足さない |
| `'switch'` | 別の子に使ったとき | `removeCopy` ならいまのコピーを外す。`removeUniqueOf` の固有技を抜き、`addUniqueOf` を1枚足す |

`aiCopyPickCards` で選ぶ枚数:

- Lv1・Lv2 は1枚です。
- Lv3 は、コピーのガッツの上限が120以上で、今のガッツが2枚ぶん足りるときだけ2枚です。2枚目も同じうまさで選び、1枚目と同じカードは選びません。
- プレイヤーの「使える枚数」には数えません。ガッツはコピー自身の分を使います。

- 5人目の枠は `SORASHIDO_COPY_SLOT`(4)です。
- `effMul`(EXTREME などで 0.5)は強さにだけ掛けます。続くターン・うまさ・固有技1枚には掛けません。

## 見せ方の部品(`monster-hero/src/parts/24-sorashido-copy-view.jsx`)

| 部品 | 使い方 |
| --- | --- |
| `<SorashidoCopyFx phase>` | コピーの絵を包む。出たとき `'appear'`(約1.1秒)→ ふだん `'idle'` → 選ぶとき `'thinking'` → 消えるとき `'vanish'`(約0.9秒たってから外す) |
| `<SorashidoNextCardBadge card layout turnsLeft>` | 5人目の枠の上。カードを選んだあとに `card` を渡す(無ければ「考え中」)。`layout` は `'portrait'` / `'landscape'` |
| `<SorashidoCopyHandSheet open copyName turnsLeft cards nextCard guts maxGuts onClose renderCard>` | 5人目の枠を押したときに開く。`renderCard` を渡すとバトルの手札と同じ見た目で並ぶ |

検査は `tools/battle/sorashido-copy-view-check.js` です(320・390・844×390 で、はみ出し・押せる大きさ・札の読みやすさを見ます)。
報告の写真と動画は `docs/playbot/reports/2026-10-27/sorashido-assist/` に置きました。

## 2026-10-27 の変更: コピーは自分の山札を持つ(固有技は足さない)

社長の答えは「山札自体を別物として扱えば足す必要はない」「普通に山札の枚数で、自分たちと同じような確率」です。

| 関数 | いつ呼ぶ | 返すもの |
| --- | --- | --- |
| `aiCopyBuildDeck(zones, { srcSlot, srcMonsterId })` | コピーが出たとき・切りかえたとき(`plan.rebuildDeck`) | `{ deck, discard: [] }` |
| `aiCopyDraw({ deck, discard }, count, rng)` | 毎ターンの始め | `{ hand, deck, discard }` |
| `aiCopyDiscardHand({ deck, discard }, hand)` | ターンの終わり | `{ deck, discard }` |
| `aiCopyCanPick(card, { srcSlot, srcMonsterId })` | 山札に入れるかの見分け | 真偽 |

- `aiCopyBuildDeck` の中身: プレイヤーの山札・手札・捨て札の写しから、距離撃(`range_atk`)・ソラシドのアシカ・コピーした子以外の味方の固有技を抜いたものです。
  - コピーした子の固有技はもとから入っているので残ります。足しもしません。
- `aiCopyDraw` の引き方: プレイヤーと同じく、無作為・重ならずに `count` 枚を引きます。山札が尽きたら捨て札を戻して続けます。
  - `count` には、プレイヤーの手札と同じ枚数を呼ぶ側が渡します(既定は3)。
- `aiCopyDiscardHand`: ターンの終わりに、手札(使ったカードも使わなかったカードも)を捨て札へ移します。
- 固有技の持ち主は、カードの `ownerSlotIdx`(枠の番号)で見分けます。無ければ `monId`(モンスターの種類)で見分けます(60-app.jsx の固有技のカード)。
- `aiCopySummonPlan` の `kind` ごとの山札の扱い: `new`・`switch` は山札を作り直し、`refresh` はそのままにします。
- 決まった割合(`uniqueRate`)は持ちません。
- 説明文とヘルプは「コピーは自分の山札(距離撃とほかの子の固有技を抜いたもの)から引く」の言い方です。

★古い形として次のものを残しています。33-ai-copy.jsx とその検査が新しい部品へ移ったら消します。

- `aiCopyHand`・`aiCopyUniqueCard`・`aiCopyRemoveUnique`・`SORASHIDO_COPY_UNIQUE_COUNT`
- `aiCopySummonPlan` と `aiCopyTurnEnd` の `addUniqueOf`・`removeUniqueOf`

## まだ決めていないこと

- 顔の絵は届くまで「🤖」です。届いたら `SORASHIDO_FACE_ICON` を差し替えます(ストックくんの仮の顔は `assistantFaceImage` から出ます)。
