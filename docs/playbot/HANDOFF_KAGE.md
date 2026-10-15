# 引き継ぎメモ: ビート部 新曲係カゲくん

会話が長くなった(60万字近く)ので、次の会話へ渡すためのメモ。窓口は統括部長モンヒロくん
`session_014GTmSNS2ae9tRr57k3zFjC`(`docs/playbot/SESSIONS.md` の窓口の行が正)。報告・相談・見込みはすべて窓口へ。

## これまでにやったこと(どれもマージ済み)

| PR | 中身 |
| --- | --- |
| #2708 | 新曲「Against My Own Shadow」(地上5難易度・strong・頭に2秒の無音。Lv.7/9/12/22/29) |
| #2776 | デバッグの「全解放の曲えらび」(`RHYTHM_DEBUG_SELECT`・演奏は from:'proto' で記録しない)。bot `tools/mode/rhythm-debug-select-check.js` |
| #2779 | 曲えらびで前に選んだ難易度を引き継ぐ(新キー `mh_rhythm_last_difficulty_v1`)。bot `tools/mode/rhythm-last-difficulty-check.js` |
| #2783 | デバッグの古い縦の一覧(リズムテストプレイ・from:'debug')を外し、検査4本・playbot 3本を全解放の曲えらびへ付け替え |
| #2787 | 検査2本(rhythm-debug-short のリスタート・rhythm-ranking の送信)を今の作りに合わせた |
| #2789 | `docs/playbot/GENRE_PROPOSAL.md` 全曲のジャンル分けの案(社長に聞く下ごしらえ。曲にはまだ付けていない) |
| #2813 | rhythm-achievement-check を今の作りに合わせた(f9452181 の HELL の流れが間に入った) |

## いま頼まれていること

- マスモン(モンヒロビートの相棒)の個体差の案: `docs/proto/buddy-individuality/README.md` と見本の静止画1枚。**案だけ・ゲームのコードは変えない**
- 待ち: ジャンル分け(社長の返事待ち。決まったら約30分で付ける)

## 覚えておくこと(踏んだ落とし穴)

- 新曲のパイプライン(`rhythm-chart-v3-pipeline.js --release`)の仕上げ `rhythm-overlap-reach-fix.js --write` が、**既存曲(Sheriruth)の譜面を書き換えた**ことがある。新曲を足したら `git diff` で既存曲のマーカーの中が変わっていないか見て、変わっていたら main の内容へ戻す
- 新曲の最初のノーツは2秒より後(足りなければ音源の頭に無音を足す。生成器は無音の手前の音にもノーツを置くので、拍の頭が2秒を超えるだけ足す)
- `run-checks.js --area mode` は1時間の上限で止まることがある。落ちた検査は1本ずつ main の worktree で回して「前から落ちているか」を確かめる
- 検査を今の作りに合わせるときは、わざと壊した入力で落ちることを確かめる(緩めない)
- 許可の画面が出そうな操作(送信・公開・削除・設定)の前に、日本語で「何のため・何をする・読むだけか書き込みか・取り消せるか」を1〜2行書く(RULES 20)
- 見込みは AI の手の時間で出し、延びるなら理由を先に知らせる(RULES 21)
