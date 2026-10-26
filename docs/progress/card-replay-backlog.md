# カード部 ミカエシくん(過去の対戦を見る・リプレイ) 見つけた物・済んだ物

案: [`card-multi-plus/README.md`](card-multi-plus/README.md) の「2. リプレイ」。社長の決め: 終わったあとは相手の手札も見られる(台帳 2026-10-27)。

## 作り(枝 claude/card-replay)
- 新しい部品 `92-card-replay.jsx`: 保存 `mh_card_replays_v1`(10試合・お気に入り3・約150KB)、なぞり直し `cardReplayBuild`、1手ごとの場の指紋 `cardReplayPrint`、再生の帯 `CardReplayBar`
- 91: なぞり直し(`cardPvpVerify`)が通った試合だけ保存。結果の画面に「この対戦を見る」
- 84: `CardBattleBoard` の `game.replay`(手を受け付けない・通信と持ち時間は `pvpLive` で止める・相手の手札を表で出す)。`CardBattleScreen` の `openReplay(id, back)`
- 検査: `tools/card/card-replay-check.js`(node)・`card-pvp-browser-check.js` の ⑫

## 履歴の画面とのつなぎ(ツナグくんと決める)
- 記録の鍵は試合の番号(`CARD_PVP` の `s.match`)。`cardReplayHas(id)` で「▶ この対戦を見る」を出すか決め、押したら 84 の `openReplay(id, '<戻る view>')`

## まだ(次にやる)
- 助手と対戦のリプレイ(84 の手を当てる所で、手を一覧に足す口。`kind:'cpu'` の形はもう読める)
- お気に入りの付け外しの画面(履歴の画面ができてから。関数 `cardReplayFav` はある)
- 進めるときに技の帯・動きも見せる(いまは場の差し替えと一言だけ)
