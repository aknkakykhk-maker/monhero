# MFバトルカード マルチ対戦 進み具合(バトル部 ブレイブくん)

案: [`docs/spec/card-battle/MULTI_PLAN.md`](../../../spec/card-battle/MULTI_PLAN.md)(2026-10-24 社長「この案で作る」)

## 区切り1(2026-10-24): 合言葉で2人が1戦を最後まで遊べる ── できた

- 部品: `monster-hero/src/parts/91-card-battle-multi.jsx`
  - 純粋な計算: 手の入れ替え・相手の見えない札(`CARD_PVP_HIDDEN`)・届いた手の当て方(`cardPvpApplyRemote`)・封(`cardPvpSealText`)・なぞり直し(`cardPvpVerify`)・知らせの掃除
  - 部屋と通信: `CARD_PVP`(React の外。Broadcast だけ・`realtime:mhc-room-<合言葉>`・1手ごとの通し番号と送り直し・ホストのくじは届くまで送り直す)
  - 画面: `CardPvpLobby`(合言葉で作る/入る・待つ・結果と照らし合わせ)
- 84-screen-card-battle.jsx に足した口(`game.pvp` があるときだけ動く): コンピューターと助手のひとことを止める・相手をブリーダーで出す・自分の手を `CARD_PVP.local` へ・届いた手を `step(null, 次の場)` で当てる・投了を知らせる・結果は部屋の画面へ
- 入口: デバッグ設定 → MFバトルカード → 対戦 → マルチ対戦(デバッグのときだけ押せる)
- 検査: `tools/card/card-pvp-check.js`(node で2台・40戦・ズルを見抜く)/ `tools/card/card-pvp-browser-check.js`(ブラウザの2ページで1戦。写真は SHOT_DIR)
- 写真: このフォルダの 00〜03

## 次(区切り2)

時間切れ(自分の番60秒・守り15秒・3回続けて負け)/切断から60秒で戻る(それまでの手を受け取ってなぞり直す)/抜けた人の待ち時間(`mh_card_pvp_penalty_v1`)/
報酬(勝ち24周・200/負け12周・50/抜けた0/1日の上限なし/自分の番が3回より前に終わったら0)/定型のチャット/対人戦の曲(`save.bgm.pvp`・バトルテーマ by いちか)

## 気をつけること

- ルールの本体(82)は「だれの番か」を見ずに手を当てる。マルチでは `cardPvpDecider` で、相手の番でない手をはねている
- カードの番号は「061」「C-001」のような文字(数ではない)
