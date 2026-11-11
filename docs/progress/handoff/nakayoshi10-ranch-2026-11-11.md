# 引き継ぎメモ: M/B管理の得の作り直しの材料(ナカヨシ10・2026-11-11)

作り直しは新しい会話「ボクジョウ」が担当(社長の決め: 助手のマスモンにトレーニングチケットを使ってあげてステを上げる形・台帳 #1184)。
止めた枝 `claude/nakayoshi10-ranch-view`(PR なし・消さずに残す)に、「いまの仕組みに表示だけ足す」案の実装と止め絵が全部ある。使えるところは使い、要らないところは捨てる。

## いまの仕組み(main に入っているもの)
- 助手がいま M/B管理(居場所 `ranch`)にいて、プレイヤーが自分のモンスターにトレーニングチケットを使うと、`assistantLifeRanchPerk()`(`56-assistant-life-ux.jsx`)が呼ばれる。
  呼び元は `60-app.jsx` の `useBondXpTickets`(`growthFxMasuBondItem` の `note:` に一文を渡す。演出の下に1行出る)。
- 受け口は `ASSISTANT_LIFE_LINKS.masmonTrainBoost(助手id, { source: 'ranch' })`(キズナ4の `assistantMasmonTrainBoost`・`56-assistant-life-masmon-grow.jsx`)。1日1回・朝4時区切り・助手ごと。受け付けたら true。効き方は、その助手のマスモン全員の「次の育成の回」の伸びが `AMG_CARE.ranchMult`(1.2)倍。
- プレイヤーの経験値は増やさない(絆ランキングに効くため)。
- 帯「いま行くと得なこと」の ranch の行: `assistantLifePerkRows`(同じファイル)。いま main の行の文は「…トレーニングすると、その助手のマスモンも育つ」(分かりにくいと社長)。

## 止めた枝にあるもの(`claude/nakayoshi10-ranch-view`)
- `assistantLifeRanchInfo()` → `{ here, done, left, mult }`(いま ranch にいる起きている助手・今日受け取り済み・まだ・倍率)。育成の保存(`AMG_STORE.state.boost`)を読むだけで、保存は何も足さない。
- `assistantLifeRanchPerk()` の文: 受け取れたとき「◯◯のマスモンたちの次の修行が1.2倍になりました(今日はこれで終わり)」/その日の2回目「…は1.2倍(今日の分は受け取り済み)」。
- `AssistantLifeRanchBand`(M/B管理の画面の帯)。差し込み場所は `60-app.jsx` の `gameState==='MB_MANAGEMENT'` の、`<AssistantBubble scene="mbManagement" compact/>` の直後に1行 `<AssistantLifeRanchBand/>`。助手がいないとき・育成が未公開のときは出ない。
- 検査 `assistant-life-ux-check.js` の ⑪(文・帯・縦横)。止め絵 `docs/progress/assistant-peer/lifeux/step1/check-{tate,yoko}-ranch{,-done}.png`。
- 更新履歴2行・ヘルプ1節の文(社長が「この文で」と言ったもの)もその枝にある。作り直しの形が変われば文も変わるので、そのまま使わない。

## 作り直しで決めること(社長 #1184 の答えから)
- チケットは助手のマスモンに使う(自分のモンスターには入らない・絆ランキングに効かない)。何を上げるかは、助手が「◯◯を鍛えたい」と頼む→そのまま叶える/自分で別の能力を選ぶ。
- 頼みの出る場所(M/B管理にいる助手の帯・部屋・M/B管理の画面)/チケット1枚・重トレーニングチケット1枚でどれだけ上がるか(キズナ4の `56-assistant-life-masmon-grow.jsx` の伸びやすさ・上限とそろえる)/1日の回数/頼みの文(助手8人ぶん・ソラシドは新しい口調。ココロ2に頼んでよい)/保存は新しいキーだけ。
- 能力のどれが いくつ→いくつ になったかを見せる(社長「ステータスの変化も見えるように」)。修行(シュギョウ)の結果の出し方とそろえる。修行の公開と重なる所(`amgt*`)は先にシュギョウと話す。
- 場所の窓・施設にいる助手の部屋へ「その場所の得」をその場で出す直し(ミヤスサ・session_0113GBaAnn6WbUTcsgkFfpPv)と、M/B管理の帯・窓の文と置き場所が重なる。着手前にすり合わせる。

## やってはいけないこと
- 保存の既存キーは変えない。新しいキーを足す(⑦)。60-app.jsx は PR の直前に merge-main で取り込み、差分を見せる(ジン了承の範囲は useBondXpTickets の数行)。
- 全体検査(`run-checks --changed`)は400本超で30〜40分。作業の再起動で途中で止まることがある。止まったら、落ちた検査だけ1本で回し直す。
