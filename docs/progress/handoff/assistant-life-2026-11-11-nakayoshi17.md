# 引き継ぎメモ: ナカヨシ17 → 次の会話(助手ライフ ❶C のあとの直し・2026-11-11)

読む順: CLAUDE.md → docs/depts/assistant-life.md → このメモ(+ 古い assistant-life-2026-11-11.md の「はまった所」)。

## 公開済み
- ❶C 毎日来る理由(PR #5332): 56-assistant-life-ux.jsx 末尾 AssistantLifeDailyCard / 保存 mh_assistant_life_daily_v1 / 60-app.jsx に道具を足す口(assistantLifeDailySetGranter)。検査は assistant-life-benefit-check に足した(❶C の2本)
- 時間帯の数は ASSISTANT_LIFE_SLOTS から取る(12回になっても動く)。場面は開始時刻で決める(assistantLifeDailySceneOf)

## 次の仕事(社長の声・窓口経由。まだ着手していない。止め絵(縦・横)と案を窓口へ → 社長「この形で」のあと本体)
1. できごとが「シンプルすぎてつまらない・喋り方がへん」
   - 喋り方: ASSISTANT_LIFE_DAILY_SCENES の台詞は全員同じ丁寧語(あつは「笑」で終わる砕けた口調なのに合わない)。台詞は助手ごとの口調の決まり(ASSISTANT_BOND_STYLES・tools/assistant/*-import.js の取り込み)を通す。全員分をココロ2(session_0113GBaDyFxewdSnk2XfiCxF)へ言い直し依頼
   - 中身: 1行を聞くだけ → 時間帯ならではの小さな場面(2人の掛け合い・写真・その場所の様子・選ぶと返事が変わる・ときどき珍しいできごと)。案2〜3個+推奨
2. 助手ライフを開いた最初に、みんな(全助手)がいまどこで何をしているかが分かる「家の画面のような絵の場面」を、得の帯・「今日やれること」より先に出す案。いまの帯(いま・今日・次)とできごとの札はその下か別の所へ
3. 同じ画面を触る人: ナカヨシ19(12回・タブ)・ナカヨシ18(下のタブに「📖 紹介」)。先に一言すり合わせる
4. 残り(前のメモから): STEP4(きずなの上に 💗)/部屋に「⚔ マスモンで対戦(β)」の行

## 気をつけること
- 判断・設計が要るので、上のモデルの会話で
- 保存のキーは足すだけ。mh_assistant_life_daily_v1 は消さない・意味を変えない
- 新しい枝は main から(claude/nakayoshi17-daily はマージ済み)
