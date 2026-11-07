# コトバの進み具合(助手たちの今の台詞)

2026-11-07 コトバ(session_0113GBaB9YGcrBJ9rzgiBJgR)。枝 `claude/assistant-life-lines`(main 217cb94 から)。マージはしない(ナカヨシ(3)が仕組みと合わせて取りまとめる)。

## 決まっていること
- 社長: 量A(新しく約3,600行+今の約1,700行を鍵付きの形へ書き直し)・名前は「友情Lv」
- 仕組み: ナカヨシ(3)(session_0113GBaBKy54erQGoMmod837)・枝 `claude/assistant-life`(`LIFE-PLAN.md`・`LIFE-WORDS.md`・`LIFE-STATS.md`)
- 書き手2人目: ツムギ(session_0113GBaDqSB1yA9t2TEucJQ7)。14ペアの2人の掛け合い+今の約380本の書き直し(ペアの割りふりは `ALLOC.md`)
- 好きな場所(データが正本): みゅあ=広場・きき=図書室・もも=練習スタジオ・ドラ=家・あつ=練習スタジオ・きゅうこ=図書室・ソラシド=カード部屋・えるびん=カード部屋

## できたもの(lines/)
- `FEELINGS.md` 8人の気持ちの紙・けんかのたね / `RELATIONS.md` 28ペアの関係メモ・3人組 / `ALLOC.md` 本数の割りふり(2回目) / `SAMPLE.txt` お手本(取り込まない)
- `kotoba-life.txt`: **ひとりごと 431本・2人の掛け合い 14ペア 279本(済み)**
- ツムギ(`tsumugi.txt` 2人 280本・`tsumugi-rewrite.txt` 今の台本を id のまま直す edit/tag 506行)は、この枝に取り込み済み(merge)
- 検査 `tools/assistant/peer-lines-variety-check.js`: lines/*.txt の形・鍵・口調の基本と、重なり・くせの割合(trio A B any も読む)
- 取り込み道具 `tools/assistant/life-talks-import.js`: kotoba-life.txt・tsumugi.txt → assistants.js の ASSISTANT_LIFE_TALKS(印のあいだを書き直す・--check)。**データはまだコミットしていない**(ツムギの折り返し4行の直し待ち)

## 取り込むときの手順
1. `node tools/assistant/life-talks-import.js` → `node tools/build.js`
2. `node tools/boot/ja-wrap-lines-check.js`(取り込んだ台詞の吹き出しの折り返し)。増えた行は `SHOW_ALL=1` で一覧を出し、main と比べて言いかえる
3. `node tools/run-checks.js --changed`

## 残り(コトバの分)
1. 声をかける→こたえる: 28ペア×answer 3(glad/decline/shy)×2本 ≒ 168本(誘う側・誘われる側の両向きを混ぜる)
2. 3人: 上位20組(ALLOC.md の本数・61本)。どの3人でも30本はツムギに頼んだ
3. 言い合い→距離→仲直り: 約52組(ツムギが今の8本を書き直した分を除く。RELATIONS.md の各ペアのけんかのたね)
4. ブリーダーへのひとこと: 8人×場面4×3本 ≒ 96本
5. ツムギの分を見て、取り込んでナカヨシ(3)へ渡す

## 決まったこと(続き)
- どの3人でも: テキスト `trio <A> <B> any`(話すのは A と B だけ)→ データ { trio:null, pair:[A,B], any:true }(ナカヨシ(3) 2026-11-07)
- 今の台本の書き直しは、思い出アルバムが id で覚えているので、id を変えずに直す一覧(edit/tag)。当てる道具はナカヨシ(3)が作る
