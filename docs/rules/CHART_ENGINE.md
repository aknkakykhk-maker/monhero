# 譜面の作り方(MHB CHART ENGINE)の決まりの本文

[`tools/mode/CLAUDE.md`](../../tools/mode/CLAUDE.md) ⑩-2 の詳しい本文。決まりの重さは CLAUDE.md と同じ。

## 作るのは最新リビジョンだけ(2026-10-12)

社長「段階を分けず、一気に古い版を外して最新だけにする」。計画: [`docs/playbot/reports/2026-10-12/revision-cleanup-plan.md`](../playbot/reports/2026-10-12/revision-cleanup-plan.md)

- 生成器・区間の差し替え・自動修正・仕上げの流れは、最新の作り方しか持たない。`--chart-revision` に最新以外を渡すと止まる
  (`tools/mode/rhythm-chart-generate-latest-check.js` が見張る)
- 古い作り方は git の記録から取り出す。外す直前のコミットは **c2094ad53**:
  `git worktree add /tmp/old c2094ad53` → `cd /tmp/old && node tools/mode/rhythm-chart-v3-generate.js --track <曲> --chart-revision <N> --write --output-dir <dir>`
  (浅い取り込みなら先に `git fetch --deepen`)。2026-10-12 に monster_hero_theme を Rev.21 で作れることを確かめた
- 曲の一覧(`authoring/rhythm-song-registry.json`)の `chartRevision` の数字はデータのまま残す。遊んだ記録の学び直しで、その曲がどの作り方で作られたかの印
- 既に作った譜面を**読む**ための読み方は残す: 速さの表(`rhythm-chart-tempo-warp.js` の `tempoWarpForChart`)・手のモデル(`handModelFlagsForRevision`)・
  レーン数(`laneCountOfChart`)。週次の学び直し(`rhythm-play-log.js`)が公開曲の遊んだ記録の時刻を、その曲を作ったときの速さの表で読み解くため
  (最新だけにすると時刻が数十 ms ずれる)
- 外したときの確かめ: 曲の一覧の43曲を最新で作った出力(215ファイル)・自動修正(3曲)・区間の差し替え(Sheriruth)が、外す前と1バイトも同じ

### 強化するとき

- 古い版へ分ける分かれ道(`chartRevision>=N`)は作らない。最新の作り方を直接よくする。公開中の譜面は生成器を通らないので変わらない
- 作る譜面が変わる強化は、`CHART_REVISION_CODE_LATEST` を**いまの最新リビジョン(`CHART_REVISION_LATEST`・学び直しの番号を含む)の次**にし、
  `rhythm-chart-v3-revision.js` の一覧に1行足す(その番号で作った曲がどんな作り方かの記録)
- 変更前のワークツリーを別に立てて、新しい曲を作った結果を突き合わせる(変わらないはずの直しなら1バイトも同じ・変える直しなら中身を確かめる)。手順: [`SCOPE.md`](SCOPE.md)

## 手の決まり(2026-10-12・HELL と Grievous Lady で分かったこと)

`tools/mode/rhythm-chart-hand-rules.js` が数え、`rhythm-chart-hand-rules-check.js` が公開中の全譜面で控えより増えていないかを見る
(譜面を変えたら必ず回す表に入っている)。左右はレーンの真ん中で分け、押し始めと長押しの終わりを点にする(同時押しは除く)。

- 同じ側で地上⇔空中を変えるのは **150ms 以上あける**(親指で上げきれず落ちる・#2830)。空中は同じ側の地上から **250ms 以上**が目安(テンポくん #2826・#2840)
- 押さえている帯と同じ側に来るノーツは、反対の手が空いているときだけ(押さえている親指では叩けない・#2843)
- 同じ側の押し始めは **90ms 未満**にしない目安(遅れた叩きが次のノーツへ移りやすい・9/5)
- 新しい曲を足したら件数を見てから `--update --reason` で控えに足す。HELL は件数を出すだけ(公開前・社長が決める)

## 公開中の譜面のノーツを動かす・戻すとき

`rhythm-overlap-reach-check.js` と手の決まりの検査も回す。「遊ばれていた形」は何かを避けていることがある
(#2808 でタップを元のサブレーンへ戻したら押せない近さの2音になり、#2821 で遊ばれていた形へ戻した)。
