# キュービ・オリヒメ 正式公開までの進み具合(モンスター部・ズカン)

決めごとの本文: [hero-trait-ex-spec.md](hero-trait-ex-spec.md)。統括部長の指示(2026-10-27): ①〜⑥を順に進める。
60-app.jsx を触るものは1本ずつ順に入れ、1本マージするたびに統括部長へ短く知らせる。⑦(公開)は社長の合図まで止める。
助手ソラシド・アシカ・お話は開発部クラフトくんの受け持ち。公開日は2体と同じ日にそろえる(⑦の日はクラフトくんと合わせる)。
バトル部の受け持ち(タクティクスの画面など)にかかる所があれば、ジンくんにひと声かける。

## 段取り

- [x] ① 決まった値(タイプ・基礎能力・ビートの能力・固有技の倍率と段・オリヒメの技名・霊魂)と、決めごとの純関数・確認画面の欄 — #4058
- [x] ②-1 キュービ「九尾四相」のつなぎ込み(相の決定・連撃・与ダメ・会心・陽炎の完全回避・煉獄) — #4065
  - 命中の判定が無いので(社長の答え): 天翔ノ相は会心率+20%、霊魂の幻惑は「味方全員の回避率+10%」(⑤で回避の表へ)
- [x] ②-2+③ オリヒメ「天河の契り」のつなぎ込みと、配置の画面の「この子を相方にする」(社長: 案ア・合流のたびに選べる) — #4075
  - 相方の入れ物は orihimeRef(partner/ouse)、効き目は orihimeDmgMultAt / orihimeTakenMultAt / orihimeShareTargets(タクティクスの分け合い)
- [x] ④-1 キュービ「九尾幻灯」(タクティクスのEX。効果 kitsunebi・狐火は kyubiRef.kitsunebi でランの終わりまで) — #4090
- [x] ④-2 オリヒメ「星合の刻」(勇者のとき)・「焦がれ待つ天ノ河」(共モンのとき) — #4099
  - 共モンのときの定義は TACTICS_EX_SKILLS.OrihimeSupport(Orihime の supportKey)。raidExDefOf が勇者でない子を引き替える
  - ⑦で直すこと: ヘルプのEXの表は遊べる子(ALL_PLAYER_MONSTERS)のキーだけ並べるので、OrihimeSupport が出ない。公開のときに「supportKey の先も並べる(共モンのとき)」を足す
  - 星合の続く攻撃は、ヒット列に「攻撃した子の与ダメ×率」の1本として足している(相方の力では殴らない)。確かめのときに社長へ見せる
- [x] ④-3 札の表示(BATTLE_STACK_MARKS に煉獄♨️・陽炎🌫️・狐火🦊・逢瀬🎐・星合🌌T・霊魂🕯️T。60-app の kyubiOrihimeStackMarks → 71 の allyStackCounts) — #4132
  - 公開前の子のEXはヘルプの表に出さない(20-market-notices-help.jsx の tacticsExSkills)
- [x] ⑤ 固有技の効果「霊魂」のつなぎ込み(消費ガッツ×0.7・味方全員の回避率+10%・3ターン。reikonRef) — #4102
- [x] ⑥ デバッグで2体を仮に編成して、実際のバトルで確かめる・run-checks — #4128
  - デバッグのバトルモードの勇者モンの一覧に、下書きの子の「試す用の写し」(debugOnly:true。記録・ランキングに残らない)を出す(draftPreviewMonsterList)
  - オートで合流したときは、相方がまだいなければその子を自動で相方にする(社長: 案ア)
  - 確かめ: tools/monster/kyubi-orihime-browser-check.js(九尾幻灯・煉獄・星合の刻・霊魂・エラーなし)。写真 field-*.jpg
  - オートで戦わせた結果: キュービ 煉獄1→6/10(WAVEをまたいで残る)・霊魂・7WAVEまでエラーなし / オリヒメ 相方が自動で決まり逢瀬1/5・霊魂・8WAVEまでエラーなし
  - 見られていないもの: 狐火の盾(Beginnerの敵はキュービが受ける前に倒れる)・星合の続く攻撃・焦がれの意味不明(共モンのオリヒメは勇者の一覧にしか出ないので)。純関数の検査は通っている
- [ ] ⑦ 公開(社長の合図で。ソラシドと同じ日。日はクラフトくんと合わせる) — ブランチ claude/kyubi-orihime-launch
  - 文と絵は社長の「この文で」「この形で」済み(2026-10-27)。お知らせの絵の下書き: docs/progress/kyubi-orihime/notice-draft/、道具: tools/image/make-kyubi-orihime-release-notice.js
  - 公開のPRでやること:
    - UPCOMING_MONSTER_DRAFTS から ALL_PLAYER_MONSTERS へ移す(draft を外す・atkMotion・trait/traitDesc・unique.effectDesc を入れる)。kyubi-orihime-traits-check の「下書きのまま」の確認を「公開した」へ替える
    - 説明文: 九尾四相・天河の契り・霊魂(統括部長へ送った案のまま)
    - 円盤石の商品(#4019 の近日追加を外す)・顔アイコン/円盤石アイコンの販売(available)。クラフトくんの #4124(メロディー・クロミーの円盤石)はこのPRのマージ直後に入る
    - お知らせの絵3枚を monster-hero/images/events/ へ(1枚目の最下行は円盤石の値段・並べ方に合わせて替える)
    - 更新履歴(題「新モンスター『キュービ』『オリヒメ』が仲間になりました」・本文5行。メロディとクロミーの行はクラフトくんと合わせる。日時は入れるときの実時刻JST)・ヘルプの節・助手の告知
    - ヘルプのタクティクスEXの表: supportKey の先(OrihimeSupport・焦がれ待つ天ノ河)も「共モンのとき」として並べる
    - 公開後に要らなくなるもの: デバッグの試す用の写し(draftPreviewMonsterList は ALL_PLAYER_MONSTERS にいる子を除くので、そのままでよい)
  - マージしたら、すぐクラフトくん(session_01VRYhgmPT7CS6iFeyRbpz1p)へ知らせる

## ②のつなぎ方(調べたこと)

同じ形の先例は「影潜」(楔)とクッキー・黒音符。60-app.jsx の 1105〜1230 行あたりに持ち方がまとまっている。

- 持ち主: `sweetOwnerAt(slotIdx)` … 5つの遊びは勇者モン(`mainHero`)、タクティクスはその枠の子
- 置き場所のキー: `trickStartKeyOf(slotIdx)` … 5つの遊びは `'party'`、タクティクスは枠の番号
- 始まりの距離: `initialBattleDistanceRef.current`(0 零・1 近・2 中・3 遠)。5つの遊びもタクティクスも、勇者モンを置いた距離が入る
  → 九尾四相の相は `kyubiPhaseOfSlot(initialBattleDistanceRef.current)` で決める(タクティクスはその子を置いた枠)
- 連撃の足し方: `withBlackNoteCombo(exCombos, combo, extra)` の extra に足す(楔は `kusabiCombosAt`)
- 守るときの回避: 敵の攻撃の回避の判定(楔の回避は `kusabiEvasion`、`buildUnifiedSpecialDefense` の `existingEvasion`)
- 片付け: WAVE の切り替えは `resetKusabi(); resetDreamPain();` の4か所、ランの片付けは `resetTacticsJoinCatchUp`
- 消費ガッツ: `cost = Math.floor(cost * getTurnBuff('gutsCostMult', 1.0) * tacticsSlotRate(...))`(霊魂は⑤でここへ)

## メモ

- 2体は下書きなので、つないでも通常プレイは変わらない。実際のバトルで確かめるには⑥のデバッグの仮編成が要る
