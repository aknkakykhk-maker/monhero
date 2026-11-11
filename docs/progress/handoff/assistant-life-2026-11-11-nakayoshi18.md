# 引き継ぎメモ: 助手部ナカヨシ18(2026-11-11)

## 済んだこと(すべて main に入っている)

| PR | 中身 |
| --- | --- |
| #5346・#5363 | 助手紹介の設計と止め絵(`docs/progress/assistant-life/profile/PLAN.md`) |
| #5404 | 助手紹介「📖 紹介」を公開(印 `assistantLifeProfile` 真・更新履歴5行・ヘルプ1項目)。部品 `56-assistant-life-profile.jsx`・保存 `mh_assistant_life_profile_seen_v1`(NEW の印だけ)・検査 `tools/assistant/life-profile-browser-check.js` |
| #5432 | 紹介の立ち絵を顔の大きさと頭の高さで8人そろえた(`AssistantLifeProfileStand`・町の人形と同じ `assistantLifeStandRule`)。前後 `docs/progress/assistant-life/profile/size/` |
| #5420 | 助手ライフの「町の人」(社長の決め E・開発部カイホウ)。部品 `56-assistant-life-partner.jsx`。判定は開発部の `assistantPartnerLockedNow`・`assistantPartnerProgressNow`。一言8人分は社長「この文で」済み。新UI・旧UIとも止める。検査 `tools/assistant/life-town-person-browser-check.js`(保存に mode:'earn' を入れて本物の口で見る) |
| #5449 | 部屋の「マスモン N体」を持っている全部の数に(出かけた助手の数が少なく出ていた) |

## 待っていること・まだのこと

- 町の人は、解放の印 `assistantPartnerUnlock`(開発部カイホウ)が真になるまで誰にも出ない。更新履歴・ヘルプはカイホウの解放のお知らせにまとめる約束(ナカヨシ側からは足していない)
- 確認役はミハリ4(session_0113GBaAkDpBLtWiFnbkDaA4)に替わった

## main で落ちている検査(この会話の変更とは関係なし。窓口へ報告済み)

- `assistant/assistant-art-scenes-check.js`: 町の人形のソラシドが small 画面で小さすぎ(最大 3.8px)
- `assistant/assistant-life-ux3-check.js` ⑩: 留守の札(7部屋)の字が10.5pxより小さい。#5429(予定表・ナカヨシ19)のあとから
- `card/card-battle-browser-check.js`: 回すたびに落ちる所が変わる(時間帯が変わる時刻に助手ライフの日記・生活のリズムの保存が書かれる)

## はまった所

- **検査とプッシュを `&&` でつなぐとき、`| tail` を挟むと NG でも先へ進む**(tail の終わり方が使われる)。この会話で2回、NG のままプッシュした(マージはしていない)。結果の文字を確かめてから次へ進める
- 実ブラウザの検査を2つの作業場所で同時に回すと、同じつなぎ口(ポート)を取り合って落ちる。同時に回すときはポートを分ける
- `run-checks.js --changed` は助手ライフを触ると400本以上になり、30分の上限で止まることがある(裏で回すときは上限を長く)
- 紹介の1人ずつの画面は、家の画面のいちばん外の枠(`[data-assistant-life-screen]`)へ描く(中に描くと見出しとタブの下に潜る)
- 開発部の口が main に入ると、検査で `window.◯◯ = …` と入れた仮の口は効かない(本物が先に見える)。保存を入れて本物の口で見る
