# バトルの与ダメージ: 予測表示と実処理の対応表(STEP 5 の作業表)

作成日: 2026-09-06 / 対象: `main` eb4ca7f / 場所はすべて `monster-hero/src/parts/60-app.jsx`

STEP 5「バトル計算の一本化」で、**予測表示(`getAttackPredictedDmg`)と実処理(`processTurn` 内)が別々に持っている
勇者特性・固有技の連撃の分岐**を 1 つの純関数へ寄せるための、現状の正確な写し。数式は変えない。
被ダメージ側は既に `getIncomingDamageBeforeTurnReduction` → `applyTurnDamageReduction` に一本化済みで、ここでは扱わない。

## 1. 基礎ダメージ `getDmg`(1 か所。予測も実処理もこれを使う)

`getDmg(card, slotIdx, mon, additionalOryo, additionalDmgMod, isSecondOrLaterAtk, attackStartDist)`

1. 距離差倍率 `[1.5,1.3,1.1,0.9][|slotIdx - attackStartDist|]`(範囲外は 1.0)
2. 技倍率: `stun_atsu` は `baseValue`(既定 1.5)/ 固有技は `baseMult + evoLevel×0.5 + 中二病スタック×0.1(アーク・イブリース)` / 距離技は `rangeAttackDamageMultiplier` / それ以外は `mult || baseMult || 1`
3. 勇者特性倍率: ゴーレム ×1.2、ピクシー・ミア勇者の固有技 ×2.0、パンドラ勇者が使う「引き継いだ」固有技 ×1.5
4. `totalBuffMult = 特性 × ターン攻撃倍率 × (1 + 永続攻撃 + みゅあ攻撃 + 追加おりょう) × (1 + 距離ダメージ補正 + 間合い適性補正)`
5. `finalDmg = floor(atk × 距離差 × 技倍率 × totalBuffMult × (1 + 敵の WAVE 限定被ダメ補正 + 追加補正))`
6. 2 回目以降の攻撃は `floor(× 0.5)`
7. 極限: GOD は `applyGodSpecialDamage`、それ以外は `ultimateDamageTurnMultiplier` → `applyUltimateDistanceBreak`、最後に `applyExtremeIntegerRule(…,'damageDealt')`

## 2. ヒット列(ここが二重実装)

`d` = `getDmg` の結果。`comboDmgBonus = permaBuffs.comboDmgPct`、`critMult = 1.5 + permaBuffs.critDmgPct`。

| # | ヒット | 発生条件 | 実処理(`processTurn`) | 予測(`getAttackPredictedDmg`) | 差 |
| --- | --- | --- | --- | --- | --- |
| 1 | メイン | 常に | `mainBaseD = pandoraSplit ? floor(d×0.5) : d`。会心は `guaranteedCrit || rand < (card.crit‖0.1)+critRatePct`。`finalD = crit ? floor(mainBaseD×critMult) : mainBaseD` | 同じ式。会心は `guaranteedCrit` のときだけ乗せる(乱数は予測しない) | 意図どおり(乱数のみ) |
| 2 | 連撃(ザン特性) | 勇者=ザン かつ 攻撃者=ザン | `rollCombo(0.3+combo)`: `base=floor(d×rate)`、会心は個別に判定 | `extraHit(0.3+combo)` | 同じ |
| 3 | 連斬(ザン固有技) | `card.type==='unique' && card.monId==='Zan'`(誰が使っても) | `rollCombo(0.2+combo)` | `extraHit(0.2+combo)` | 同じ |
| 4 | 桜花連舞(エイキ特性) | 勇者=エイキ かつ 攻撃者=エイキ | `rollCombo(0.1+combo)` ×2、さらにエイキ自身の固有技なら `rollCombo(0.3+combo)` | 同じ順・同じ本数 | 同じ |
| 5 | 緋桜連華(エイキ固有技) | `unique && monId==='Eiki'` | `rollCombo(0.15+combo)` ×2 | 同じ | 同じ |
| 6 | 禁忌解錠(通常攻撃の後半) | 勇者=パンドラ かつ 攻撃者=パンドラ かつ `atk`/`range_atk` | `rollCombo(0.5+combo, noAnim)` | `extraHit(0.5+combo)` | 同じ |
| 7 | 禁忌解錠(固有技) | 上に加えて `unique && monId==='Pandora'` | `rollCombo(1.0+combo, noAnim)` | `extraHit(1.0+combo)` | 同じ |
| 8 | 全体連撃(きき由来) | `globalComboDmgPct + 局所加算 > 0` | `base=floor(d×rate)`、会心は個別判定。**実処理には同じ塊が 2 か所ある**(6,342 行付近と 6,460 行付近。分岐の違いで別々に書かれている) | `extraHit(globalComboDmgPct + additionalGlobalCombo)` | 式は同じ。実処理側の重複を 1 つにできる |
| 9 | 贖罪の追撃(アーク・イブリース固有技) | `unique && monId in (Ark, Iblis)` | `floor(finalD×0.2)`(会心後のメインを基準。会心なし・演出なし) | `floor(mainDmg×0.2)`(`guaranteedCrit` のときだけ会心後) | 同じ(乱数会心の差のみ) |

実処理はヒットごとに `attackHits.push({dmg, isCrit, slotIdx, isSpecial, skillName, isUnique, monId, noAnim})` を積み、`totalDmg` に加算する。
予測は合計値だけを返す。

## 2.5 一本化後の形(2026-09-06 実施)

`buildAttackHits`(`src/parts/22-enemy-and-bond-entries.jsx`。純粋な部品)がヒット列を作り、実処理は `rollCrit: () => Math.random() < …`、
予測は `rollCrit: () => false`(確定会心 `guaranteedCrit` だけ反映)で呼ぶ。倍率は `ATTACK_COMBO_RULES` の表 1 か所。
贖罪の追撃は `attackAtonementDmg` で、実処理では固有技の効果ブロック側(順序を変えないため)、予測では合計に足す。
実処理側にあった全体連撃の重複 2 か所のうち、通常攻撃側は `buildAttackHits` へ吸収した。
**残っている変種**: あつの挑発(`stun_atsu`。バフカード扱いの攻撃)は、メインに会心が無く連撃はザン・エイキの勇者特性だけ、という別の規則で
`processTurn` の中に独自に書かれたまま。ここは規則が違うので、無理に同じ関数へ入れず、次に触るときに `buildAttackHits` へ
「メインの会心なし」の選択肢を足して寄せる。

## 3. 一本化の形(案・実施前の記録)

```text
buildAttackHits({ d, card, mon, mainHero, permaBuffs, turnBuffs, additionalGlobalCombo, rollCrit })
  → [{ kind:'main'|'combo'|'global'|'atonement', base, rate, crit:boolean, dmg, noAnim, skillName }]
```

- `rollCrit` は「会心を決める関数」。実処理は `() => guaranteedCrit || Math.random() < rate`、予測は `() => guaranteedCrit`。
- 実処理はこの配列から `attackHits` と `totalDmg` を作り、予測は `dmg` の合計を取る。
- 分岐の表(勇者特性・固有技の連撃)は `core/constants/hero-traits`(仮)へ:
  `{ Zan:{ trait:[0.3], unique:[0.2] }, Eiki:{ trait:[0.1,0.1], traitUnique:[0.3], unique:[0.15,0.15] }, Pandora:{ splitNormal:0.5, unique:1.0 }, Ark/Iblis:{ atonement:0.2 } }`
- **順序を変えない**(メイン → ザン特性 → 連斬 → 桜花連舞 → 緋桜連華 → 禁忌の後半 → 禁忌固有 → 全体連撃 → 贖罪)。
  `battle-scenario-check` と `battle-damage-preview-check` は順序と本数を見ている。

## 4. 先に足す検査

- **乱数を固定した一致検査**: `Math.random` を 0(会心なし)と 1(会心あり=`guaranteedCrit` 相当)に固定し、全勇者 × 全カード種で
  `processTurn` 側のヒット列の合計と `getAttackPredictedDmg` が一致すること。`processTurn` は state に依存するので、
  一本化した純関数を先に作り、そこへ両者を差し替えてから検査する(差し替え前後で `battle-damage-preview-check` が通ることで等価を確認)。

## 5. 触るときの注意

- `getDmg` の式は 1 か所なので触らない。ヒット列だけを寄せる。
- `attackHits` の項目(`isSpecial` / `noAnim` / `skillName`)はモーション再生の判定に使われている(ザン専用モーション、禁忌の先頭ヒットなど)。名前を変えない。
- `hasCrit`(演出用)と `totalDmg` の加算タイミングは今のまま(ヒット列を作ってから一括で加算してよいかは、途中で `await` が無いことを確認済み: ヒット列の生成は同期)。
