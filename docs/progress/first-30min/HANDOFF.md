# 引き継ぎメモ: はじめての人の最初の30分(2026-11-11・開発部ハジメテ → 次の会話)

`docs/progress/handoff/dev-2026-11-11.md` は別の仕事のメモがもうあるので、この仕事のぶんはここに置く。

## 最初に読むもの

1. CLAUDE.md / docs/depts/dev.md / `node tools/ctx.js decisions dev`
2. このメモと [`PLAN.md`](PLAN.md)(改善案10個・止め絵は `shots/`)

## 社長の答え(窓口経由・2026-11-11)

「10案ほぼ全部」。取りまとめはハジメテ。保存は新しいキーと一度きりの印・**今いる人の進み方は変えない(はじめての人だけ)**。
案3で 2026-10-27 の決めごと(開催中のイベントのお話)の出す時機を変えるのも了承ずみ。
見た目が変わる 4・9 は止め絵を窓口へ。**更新履歴・ヘルプは最後にまとめて1件**の案を窓口へ(バトル部の文案は
`docs/progress/first-30min/BATTLE-TUTORIAL-SPLIT.md` の6.・枝 `claude/battle-tutorial-split-plan`)。

## 済んだもの

- 道具 `tools/boot/first-30min-walk.js` と PLAN.md(PR #5223)
- **案1** ログインボーナスの窓を、助手の案内とれんしゅうのあとに出す(PR #5254)。`60-app.jsx` の `loginBonusGuideBusy` / `loginBonusGuideClear`。道具は縦で OK になった

## 残り(開発部・小さい順)

- **案6** ワンポイントアドバイスとお話を同時に出さない。`60-app.jsx` のお話を流す効果(「HOMEへ着いて、ほかの会話…が終わってから流す」)の条件に
  `!dailyMasuAdvice` を足し(依存の並びにも)、アドバイスを出す効果(`setDailyMasuAdvice({ debugCount:null…` の手前の条件)に `eventReplay` を足す。全員に効くが、順番が変わるだけ
- **案3** はじめての人は、最初のバトルを終えるまでイベントのお話を自動で流さない。はじめての人の印は既存の
  `mh_story_one_at_a_time_v1`(`storyOneAtATime`)が使える。「最初のバトルを終えた」の判定は**まだ決めていない**
  (既存の記録から読めるか、新しいキーにするか)。バトル部セコンド(session_01VKTcSbgZtBChiibCjAYVgW)の
  「はじめの1戦を終えた」とずれないよう、セコンドが確かめに来る。検査 `tools/boot/new-player-stories-browser-check.js` は
  「最初の HOME でお話が1本流れる」を見ているので、合わせて直す
- **案8** ギフトを受け取ったあとの窓に使い道の一言、マーケットの4つの札に「買えるもの」の一言
- **案4** HOME に「つぎにやること」1行(ギフト → バトル1回 → ミッション)。止め絵を窓口へ
- **案9** 助手えらびを顔と一言だけに(くわしい紹介はタップ)。止め絵を窓口へ

## ほかの部

- **案2**(れんしゅうを分ける): バトル部ジン(session_0113GBaBQVfySmikBzzeKUSa)→ セコンドが作る。入れ順は伝えてある
  (案1 → 6 → 3 → 8 → 4・9)。PR 番号が出たら更新履歴のまとめに使う
- **案5・7**(れんしゅうの誘いの文・村の案内を3〜4話に): 文案をこちらで作り、ココロ2(session_0113GBaDyFxewdSnk2XfiCxF)に見てもらう。**未着手**。
  誘いの文は `data/assistants.js` の「新しいれんしゅうができたよ」(助手8人ぶん)
- **案10**(助手ライフ・MFバトルカードで「まずはこれ」): ナカヨシ12(session_0113GBaB4qF5YNFg5nv4p6kw)とソランド(session_01Nd9mE4xnf4BvZF8ia7G4BZ)へ頼む。**未連絡**

## 気をつけること

- `tools` で `npm ci` をしてから検査を回す(`@babel/core` が無いと46本が落ちる)。`run-checks.js --changed` は13分ほどかかるので、
  裏で回して出力をファイルに残す。**コミットの前に回す**(コミット後は「変更0件」になる)
- `boot/harness-exit-check.js` は main の本体でも NG(この仕事の前から)。窓口へ知らせてある
- main がよく進む。PR を作る直前とマージが断られたときに `node tools/merge-main.js`
- 道具は調べもの用で run-checks には入れていない。直すたびに `node tools/boot/first-30min-walk.js --portrait` で確かめる
