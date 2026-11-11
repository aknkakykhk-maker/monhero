# 引き継ぎメモ: 開発部カイホウ(助手の解放)(2026-11-11)

次の会話は、CLAUDE.md → `docs/depts/dev.md` → `node tools/ctx.js decisions dev` → このメモ → `docs/progress/assistant-unlock/DESIGN.md` の順に読んで始める。

## 仕事
社長「これから始める人はアシカの助手を使った回数で解放されるようにしようか」。はじめての人は最初に1人選び、ほかの助手はモンヒロバトルでその助手のアシストカードを40回使うと助手になる。今の人は全員そのまま。

## 済んだこと(すべて main・公開の印 `assistantPartnerUnlock` は偽のまま)
- #5373 #5379 設計と止め絵・台帳
- #5408 本体(ミハリ3 OK): 新キー `mh_assistant_partner_v1`・`mh_assistant_card_uses_v1` / 部品 `18-assistant-partner.jsx`(pure・ほかの部の入口 `assistantPartnerOkNow` `assistantPartnerLockedNow` `assistantPartnerProgressNow` `assistantPartnerIdsNow`)/ 演出 `59-assistant-partner-fx.jsx`(4コマ・8人の一言は社長「この文で」)/ 小窓の進み具合・結果画面の1行・ショップの札・プロフィールの仲良し度の並び・町の人の仲良し度とごほうびの止め・あつのお話(はじめての人は挑発40回)/ ヘルプ note「アシストカードで助手を迎える」(releaseFlag・社長「ヘルプだけ・この文で」。更新履歴・助手の告知は載せない)
- #5415 使った回数の保存を戦いの終わりにまとめる(ミハリ3 OK)
- 検査 `tools/assistant/assistant-partner-unlock-check.js`(run-checks に登録)・止め絵の道具 `tools/assistant/assistant-partner-shots.js`

## 次にやること
1. ナカヨシ18の町の人と🔒 #5420(ミハリ3確認中)が main に入るのを待つ
2. 入ったら、`17-release-changelog-login-missions.jsx` の `assistantPartnerUnlock: false` を `true` にする PR を作る(ヘルプの note はもう入っている)。**マージしない。** 窓口が Fable の最終確認(印を真にして earn の人の40回→解放の通し)に回す
3. Fable の OK のあと、窓口の指示でマージ → main へ同期 → 本番 `https://aknkakykhk-maker.github.io/monhero/` で、新しい端末(保存なし)で助手えらびの1行・小窓の棒を見る

## 気をつけること
- 台帳 `PRESIDENT_DECISIONS.md` は merge-main でよくぶつかる。両方とも末尾に足した行なので、印の行を消して両方残す
- 広い検査は ~50分。main でも落ちるもの: screen-effects(表の件数)・battle-menu・card-battle の⑧⑲・assistant-bond-check の lifeCheer(ほかの部)
- tools の playwright は `executablePath: '/opt/pw-browsers/chromium'` で起動する
