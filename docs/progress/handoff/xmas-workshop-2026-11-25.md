# 引き継ぎメモ: 🎄 クリスマス作業場(2026-11-25)

次の会話は、CLAUDE.md → `docs/depts/battle.md` → このメモ、の順に読んで始める。前の会話(session_0113GBaBheZ5Ad4Ht2XoodYC)の中身は読みに行かない。
この会話は「🎄 クリスマス作業場」。**統括窓口(session_0113GBaCCe57vnmvsZ6f3TFr)から届いた指示だけで動く**。社長に直接質問を出さない(聞きたい事は最後の発言に書いて止まる)。
報告は毎回、最後の発言に「やったこと・PR番号・残り・聞きたい事」を短く書いて止まる(send_message は使わない)。

## 正本(読む所)

- 企画: `docs/progress/event-xmas-2026/PLAN.md`(決まったことの表)・お話: `STORY.md`・きせかえのプロンプト: `SANTA-COSTUME-PROMPTS.md`・ポスター: `POSTER-PROMPTS.md`(お話の筋が決まってから書き直す)
- 社長の決めごと: 台帳 `docs/rules/PRESIDENT_DECISIONS.md` の r1119-172 と追記(全文は開かない。`node tools/ctx.js decisions --grep r1119-172`)

## 公開済み(main)

助手のクリスマスのきせかえ5着: #7556 みゅあ『クリスマス』・#7559 きき『クリスマス』・#7561 ももすけ『クリスマス』・#7567 ソラシド『探偵』・#7569 あつ『探偵』。
11/30 10:00 までは本番で見えない(`ASSISTANT_COSTUME_XMAS_START_AT`・公開フラグ `RELEASE_FLAGS.xmasCostume`)。売り方はハロウィンと同じ(期間中ビートP交換所 1000P・12/31 4:00 からダイヤショップ 100000)。

## 積んでいる PR(ミハリ確認待ち・まだマージしていない)

| PR | 中身 | 向き先 |
| --- | --- | --- |
| #7580 | えるびん『クリスマス』 | main |
| #7583 | きゅうこ『クリスマス』+台帳 r1119-172 追記2行(売り方・お話ではみんなが着ている) | `claude/erubin-santa-costume`(#7580 の上) |

入れ方: ミハリの OK はミハリから直接届く。#7580 → #7583 の順。各回、枝を最新にして main を取り込み(`node tools/merge-main.js` か `git merge origin/main`)、`node tools/build.js` と必ず入る4本+`tools/market/assistant-costume-check.js` を通してプッシュ → マージ(**merge**。squash にすると積んだ次の枝がぶつかる)→ 次の PR の向き先を main に替える。
main を取り込むとぶつかりやすい所: 生成物(asset-manifest・index.html・version.json・compiled・game-system.jsx・tailwind.css)・目録(`tools/image/assistant-art-ledger.json`・`*/CATALOG.md`)は main 側を取ってから `node tools/image/assistant-art-catalog.js` と `node tools/build.js` で作り直す。`tools/assistant/life-stand-cut.json` は**両方の行を残す**(ナカヨシが main で mua・momosuke:halloween を直している。重なった行は1つに)。

返事待ち: きゅうこの寝顔の顔アイコンが少し大きめ(座った姿の絵のため)で良いか → 窓口が社長に聞いている。

## 作り方(次の助手の元絵が届いたら・1人約30分)

元絵は `tools/art-sources/assistants/<フォルダ>/santa/received/<フォルダ>_santa_{fullbody,normal,happy,wink,surprise,troubled,angry,crying,excited,sleep}.png`(**加工しない**)。

1. 目録 `tools/image/assistant-art-catalog.json`: who の outfits に `"santa": "クリスマス"`・fullbodyNames に `"<id>/santa": "<id>_santa"`・groups に `<id>/santa/{bust,face,fullbody,stand}`(書き方は既存の santa の組をまねる。JSON の書式を崩さないよう文字で足す)
2. `tools/assistant/life-fullbody-art.py` の ART に `'<id>:santa'` と `@表情`(sleep も)を足し、`python3 tools/assistant/life-fullbody-art.py --only <id>_santa`
3. normal の全身画(`monster-hero/images/assistant/fullbody/<id>_santa__normal.png`)の頭に目盛りを付けた絵を作って見て、top(帽子を除いた頭のてっぺん)・eye(目の線)・chin(顎の先)を測り、`tools/assistant/life-stand-marks.json` に `fp` と一緒に足す
4. `tools/assistant/life-stand-from-fullbody.py` の HEADS に `stand='stand-santa'`・`sleep=True` で足し、`--only <id>:santa --write --marks`
5. 顔アイコン9枚(寝顔を含む)を並べ、**承認済みのその助手の顔**(ふだん・ほかの服)と並べて比べる。ナカヨシの基準(`docs/progress/assistant-art/face-align/README.md`: 目の高さが丸の0.48〜0.55・顔の幅が丸の約半分)に合わなければ `tools/assistant/life-stand-cut.json` に `"<id>:santa": {"face": {"head":…, "up":…, "dx":…}}` を足して切り直す(head を大きく=顔が小さく、up を大きく=目が下へ)
6. 全身画を `monster-hero/images/assistant/santa/<接頭辞>_<表情>.PNG`(9枚)へ写す(バスト絵)。`56-assistant-life-house.jsx` の顔の表の `santa:` 行に1人足す
7. `monster-hero/data/assistants.js` の3か所(ASSISTANT_STAND_ART・ASSISTANT_FULLBODY_ART・ASSISTANT_FULLBODY_EXPRESSIONS)・寝顔の一覧(`56-assistant-life-roomview.jsx` の ASSISTANT_LIFE_SLEEP_ART)・`monster-hero/data/breeder.js` の衣装(既存の santa の衣装をまねる。`?v=` は顔アイコン happy の sha256 先頭12桁)・`tools/market/assistant-costume-check.js`(売り方と絵の確かめ)・更新履歴(`visibleFrom:'2026-11-30T10:00:00+09:00'`・題「◯◯の着替え『クリスマス』が並びました」)・ヘルプ(「クリスマスイベントの衣装」の1文に名前を足す)
8. `node tools/image/assistant-art-catalog.js`・`node tools/build.js`・必ず入る4本・`image-asset-check.js`・`assistant-costume-check.js`・`changelog/dev-entry-check.js`・`assistant/life-fullbody-pocket-check.js`(服の白を指したら目で見て `ALLOWED` に足す)・`assistant/life-stand-stale-check.js`
9. 12/1 の時計で着せて確かめる(Playwright で `page.clock.setFixedTime(new Date('2026-12-01T15:00:00+09:00'))`・`mh_assistant_costume_owned_v1` と `_worn_v1` を入れて `monster-hero/index.html` を開き、`assistantCostumeImage`・`assistantFullImage`・`assistantFullBodyImage` の行き先が santa の絵で、全部読み込めるか)
10. 枝は前の PR の枝の上に積み、PR の向き先も前の枝にする。gate は「要る」なのでマージせずに止める

## 残り

- **ドラのきせかえ**(元絵待ち): ドラは全身絵が無く落書き風の顔だけ。社長の選択で「顔だけのまま」(全身の決まりの例外)。緑のサンタ帽・ベル・柊・星の形のめがね・ずれたつけひげ(台帳 r1119-172 追記(ドラのきせかえ))。上の手順のうち、全身画・立ち絵は作れない。顔の絵(`dra_santa_face.png`)と表情・寝顔の顔の絵から、`santa/dra_<表情>.PNG` と `santa/face/dra_<表情>.PNG` を作る形になる(ドラのふだんの絵 `images/assistant/dra_*.PNG`・`face/dra_*.PNG` の大きさと置き方をまねる)。届いたら、作り方を窓口に1行で確かめてから始める
- 前に出した PR の説明文(#7556〜#7569)には古い名前・「仮」が残っている(題は直した。マージ済みなので直さなくてよい)
- お話(25話の割り振り・台本)・レイド(仮のボスで作り始める)は、この会話では手を付けていない。前提は STORY.md(探偵役: あつ「謎はすべて解けた!」で罠にはまりドラを名指し→ソラシド「真実はいつもひとつ!」できゅうこを解く・ペンションのオーナーはスネグーラチカのイチーカ・消える順番 みゅあ→きき→ももすけ→えるびん→きゅうこ(ふり))

## はまった所

- 寝顔の絵は大きさ・姿勢がふつうの絵と違う(座った横長など)。道具は大きさをそろえてから切るように直してある。座った絵は顔が少し大きめに写る
- きゅうこの元絵は輪郭の外に薄いもやが多かったが、全身画の書き出し(`life-fullbody-art.py` の掃除)で消えた(縁から3画素より外の薄い画素が0か数えて確かめる)
- 全体の検査(`run-checks.js --changed`)は時間切れで最後まで回らないことがある。落ちる物の多くは main でも落ちる(着替えのブラウザ検査・会話の検査・立ち絵の場面の検査・白い塊の kiki.png/mua.png・ききの立ち絵の切り直し忘れ・更新履歴の並び順の18か所)。疑わしい物は main に切り替えて比べる
- 英語の一言を書くと止めのフックが止める。作業中の一言も日本語で
