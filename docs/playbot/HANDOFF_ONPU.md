# ビート部 譜面係 オンプくん の引き継ぎ(2026-10-12 夜)

前の会話: session_01VDL1xQjh5sVox2CGCDkx8w(10/12)。その前は session_01KxMEiw3EwFDLvXkiHxkA4S(〜10/11・メモは
[`reports/2026-10-11/onpu-handoff.md`](reports/2026-10-11/onpu-handoff.md))。会話の長さが交代の目安を超えたので交代する(窓口の依頼)。
新しい会話は窓口が立てる。窓口は統括部長モンヒロくん(番号は [`SESSIONS.md`](SESSIONS.md) の窓口の行が正)。報告はすべて窓口へ send_message。

## いまの状態(10/12 夜)
- **手を付けている作業は無い。** 頼まれた分はすべてマージ済み。作業ブランチは main と同じ
- 最後の作業: HELL の空中の割増しを 1.2倍へ戻した(#2886)。窓口へ報告済み

## 今日やったこと(新しい順・どれも main に入っている)
| PR | 何 |
| --- | --- |
| #2886 | `SKY_LEVEL_FACTOR` 1.3→1.2(社長「マスターの2割増しぐらいをベース難易度に」)。HELL Lv.: Sheriruth 54・Grievous Lady 60・風がそよぐ場所 23 |
| #2877 | Grievous Lady HELL の「長押し中の手」5件を手直し(30.60・52.45・102.74・112.45・117.67秒) |
| #2876 | 風がそよぐ場所 HELL(空中の入口)を足した。**HELL の道具が最初の行を目印のコメントにくっつけて書き、頭の4ノーツが落ちていた不具合を直した**(Sheriruth HELL 638→642) |
| #2872 | 手の決まりの物差しに「長押し中の手は使えない」(`heldHandSwitch`)を足した |
| #2866 | HELL 2曲の手の決まり(150ms・250ms)を直した |
| #2861 | **譜面の作り方を最新リビジョン(Rev.30)だけにした**(古い版の分かれ道とリビジョンの検査17本を外した) |
| #2846 | 手の決まりの物差し `rhythm-chart-hand-rules.js` と検査を足した |
| #2845・#2822・#2821 | 検査の数え漏れ・run-checks の必ず回す表・Sheriruth 44.335秒を遊ばれていたサブレーン4へ戻す |

## 守っている決まり(本文は [`tools/mode/CLAUDE.md`](../../tools/mode/CLAUDE.md)・[`docs/rules/CHART_ENGINE.md`](../rules/CHART_ENGINE.md))
- **⑩-2**: 公開中の曲の譜面は作り直さない・既存の解析も作り直さない。公開中の譜面は `rhythm-released-chart-lock-check.js` が指紋で見張る。
  決まった直しで変えるときだけ `--update --reason "<理由>"`。そのあと `rhythm-overlap-reach-check.js` と手の決まりの検査も回す(#2808→#2821 の教訓)
- **作るのは最新リビジョンだけ**(#2861)。古い作り方はコミット **c2094ad53** から取り出す。曲の一覧の `chartRevision` の数字はデータのまま。
  既に作った譜面を**読む**読み方(`tempoWarpForChart`・`handModelFlagsForRevision`・`laneCountOfChart`)は残す(週次の学び直しが公開曲の時刻を読み解くため・消さない)
- **手の決まり**: 同じ側で地上⇔空中は150ms以上/地上から空中は250ms以上/長押し中の手は使えない(反対の手でも150ms・250ms)/押さえている帯の隣は反対の手が空いているときだけ/同じ側の押し始めは90ms未満にしない(目安)。
  左右はレーンの真ん中で分け、同時押しは除き、手前の同時の点に同じ高さがあれば切り替えに数えない
- **HELL の Lv.** = 空中を地上と見なした Lv. × `SKY_LEVEL_FACTOR`(**1.2**)。空中の無い譜面の Lv. は変わらない
- **HELL は公開済み**(#2931・10/13 13:47。`RELEASE_FLAGS.rhythmHell` は真。Lv. は Sheriruth 54・Grievous Lady 60・風がそよぐ場所 23)。HELL を含む公開中の譜面は触らない。HELL の変更もプレイヤーに見えるので、更新履歴・ヘルプの決まり(CLAUDE.md ⑤)に従う
- 見込みは AI が手を動かす時間で出す(余裕を足さない)。延びるときは理由を先に。Supabase は直接触らない(窓口経由)

## HELL 3曲の状態(どれも公開前・手の決まりは全部0件)
| 曲 | 試作の枠 | 作り方 | Lv. | ノーツ(空中) |
| --- | --- | --- | --- | --- |
| Sheriruth | `sheriruth_hell_debug`/HELL | `rhythm-hell-mix.js --song sheriruth --write` | 54 | 642(239) |
| Grievous Lady | `grievous_lady_hell`/MASTER | リバースくんの道具+**手直し**(下) | 60 | 649(220) |
| 風がそよぐ場所 | `kaze_ga_soyogu_hell_debug`/HELL | `rhythm-hell-mix.js --song kaze_ga_soyogu --write`(gentle・土台は切り替わったあとの V4 の MASTER) | 23 | 193(19) |

- Grievous Lady HELL の手直し(`grievousLadyHellBaseNotes`・作り直すときに消さない・リバースくんへ伝え済み): 137.03秒の手前のスライドの終わりを空へ/29.88秒 地上・33.88・34.03秒 空中/
  109.88〜112.24秒のスライドの終わりを地上へ/30.60秒 地上・52.45秒 空中・102.74秒 地上・112.45秒のスライドの始まりを地上・117.67秒 地上
- ボット(テンポくんの人の指のボット 版3)では3曲とも空中の MISS はわずか。風がそよぐ場所は9本とも MISS 0。案A(空中の受け付けを構えに合わせる)を既定にするかは社長の判断待ち

## よく使う道具と検査
- `node tools/mode/rhythm-hell-mix.js --song <sheriruth|kaze_ga_soyogu> [--write]` … HELL を作る(数・Lv.・手の決まりを出す)
- `node tools/mode/rhythm-chart-hand-rules.js --song <試作の枠の id> [--diff HELL]` / `--all` … 手の決まりの件数と場所
- `node tools/mode/rhythm-chart-hand-rules-check.js` … 公開中の全譜面の件数が控えより増えていないか(新しい曲は `--update --reason`)
- `node tools/mode/rhythm-released-chart-lock-check.js` … 公開中の譜面の指紋・目印の行にノーツが乗っていないか
- `node tools/mode/rhythm-chart-generate-latest-check.js` … 作れるのは最新だけ・モンスターノーツ4個
- `node tools/mode/rhythm-chart-level-check.js` … HELL の Lv. が式と一致・1.2倍
- `node tools/run-checks.js --changed` … 譜面(rhythm-mode.js)を変えたら必ず回す7本を含む
- 生成器を変えたら: 変更前の main を `git worktree add` で別に出し、新しい曲を作った出力の sha256 を突き合わせる(#2861 で43曲215ファイルを比べた)

## 次の会話が最初に読むもの
1. ルートの `CLAUDE.md`・[`RULES.md`](RULES.md)・[`tools/mode/CLAUDE.md`](../../tools/mode/CLAUDE.md)・[`docs/rules/CHART_ENGINE.md`](../rules/CHART_ENGINE.md)
2. このメモ
3. 窓口へ「引き継ぎました」と、頼まれた仕事があればその見込み(AI の手の時間)を送る
