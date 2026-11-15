# 第2話 ～ヒーローへの道～ 止め絵と突き合わせ表(2026-11-16 ココロ4・r1114-027・028)

撮り方: `SHOT_DIR=docs/progress/monsuc-beta-story/shots/ep2 node tools/boot/monsuc-ep2-story-browser-check.js`
(公開の印 monheroSuccess はブラウザに渡す本体の中だけ真にする。390×844・2倍)

| 決めごと(台本 script.md・窓口の依頼) | 止め絵 | 結果 |
| --- | --- | --- |
| 印 monheroSuccess が真のときだけ、次の HOME で1回流す(偽のあいだは出ない) | (検査 ⓪・①) | 偽: 流れない / 真: 流れる・開き直しても二度は流れない |
| 幕開けはいつもの iris。題字ロゴは第1話だけ | `monsuc_beta_ep2-1-hajimari.png` | iris・題字ロゴなし |
| 町の門から始まる(bg monsuc_gate・場面の説明の文) | `monsuc_beta_ep2-2-saisho.png` | 門の絵と「オープンの日の朝。育成場の門が、大きく開いている」 |
| 山場は闘技場(bg monsuc_arena)で「ヒーローズファイナルで、ヒーローになるんだ！」 | `monsuc_beta_ep2-3-yamaba.png` | 闘技場の絵・みゅあの台詞 |
| 全34行・あつは出ない | (検査 ②) | 34行・あつなし |
| 終わりの札に「🌱 モンヒロサクセスへ」(本編だけ・回想ではボタンなし) | `monsuc_beta_ep2-4-owari.png` | 「終わり」+ ボタン + 閉じる |
| 押すとモンサクを開く(はじめてなら中の始まりの話) | `monsuc_beta_ep2-5-monsuc.png` | 「ホームでひと息ついていると、みゅあが1枚のチラシを手に走ってきた。」から始まる |
| 飛ばした人にみゅあが1回だけ告知(仲良し度 Lv1・2 はていねい語)・印 `mh_monsuc_story_skip_seen_v1` | `monsuc_beta_ep2-6-skip-kokuchi.png` | 「…HOMEに新しいボタンが出ています！…」・閉じると二度と出ない |
| 告知を閉じたあとの HOME(🌱 モンヒロサクセス β の入口がある) | `monsuc_beta_ep2-7-home-after.png` | 入口あり |

台本から変えた所(検査の決まりに合わせた言い換えだけ。台本 script.md も同じに直した):
- 「どの子も、まだデビュー前…」「どの子も、最初の大会は…」→「どのモンスターも、…」(monster-ko-check: モンスターを「子」と呼ばない)
- みゅあの告知「HOMEに新しい札が出てるよ」→「HOMEに新しいボタンが出てるよ」(fuda-word-check・TERMS.md「札は画面の文で使わない」)

あわせて直した所: お話の終わりからモンサクを開いたとき、更新のお知らせの一覧がモンサクの画面の上に重なっていた。モンサクを開いているあいだは待つ(閉じて HOME に戻ったら出る)。
