# ビート部 部長テンポくん の引き継ぎ(2026-10-12 朝)

前の会話: session_01NS12tYT8MdGQhNjvw8dS56(10/07〜10/12)。会話の長さが交代の目安を超えたので交代する(窓口の依頼)。
新しい会話は窓口が立てる。決まりは RULES.md・CLAUDE.md のとおり(日本語のみ・許可の前に日本語で説明・見込みは RULES 21・Supabase は窓口だけ)。

## いまの状態(10/12 5時半)
- 手を付けている作業は無い。main はきれい(作業ブランチ claude/tempo-idle3 = main と同じ)
- 最後の大きい作業: 社長の依頼「全曲 EXPERT 以上のタップ位置の確認」→ **見えている位置と判定の位置のずれは無し**(#2812・報告 `docs/playbot/reports/2026-10-12/tap-position/README.md`)
- Grievous Lady 2分の2つの型(遅れた叩きが次へ移る・帯の隣の片寄り)は **社長の答えで「今のまま」**(10/12 5時)。判定も譜面も変えない

## 残っていること
| 何 | 状態 | 次にやること |
| --- | --- | --- |
| kiki_issen MASTER 153.66秒 | タップ(サブ3〜7)とスライドの押し始め(サブ6〜8)が同じ時刻に重なる。重なった所はスライドが取る | 見た目と判定のどちらに合わせるか決めきれないので一覧に残した。譜面でほどくならリバースくん・オンプくんへ(公開済みなので released-chart-lock を理由つきで) |
| 4u_hitasura MASTER 70.55秒 | スライドとホールド(サブ5〜9)が同じ時刻に重なる。集計ではホールドの左端の内側が取れない判定、判定の関数を1回ずつ作り直して当てると取れる | **食い違いの理由が未確認**。`rhythm-tap-position-report.js` の状態の作り方(書き換えの戻し)を疑う |
| HELL 公開前: GPU の空中スライドの白いふちの描き始めを 2D に合わせる | #2811(claude/rhythm-hell-sky-edge-gpu)が入っている | ドライバーくんの仕事で済んだか、2D と並べた絵で確かめる |
| `mode/rhythm-achievement-check.js` | main でも落ちる(BEST を保存した直後の実績の記録)。ビート部の変更とは無関係 | 窓口へ担当を回すよう伝え済み |

## 作った道具(使い方は各ファイルの冒頭)
- `tools/mode/rhythm-note-reach-scan.js` … 全曲・全難易度の全ノーツを、判定の関数 `rhythmMatchInputBatch` そのもので「どこを押せば取れるか」測る。`--json` でノーツごとの見た目の幅と取れる幅。`--data` で前の版の譜面と比べる
- `tools/mode/rhythm-note-reach-check.js` … 上の速い形(真ん中と和音だけ・全曲10秒)。毎回の検査に入っている
- `tools/mode/rhythm-slide-start-lane-check.js` … スライドの始まりが0.5刻みか(Grievous Lady 33.74秒の再発よけ)
- `tools/playbot/rhythm-tap-position-static.js` … 曲を流さず、画面ごとに全譜面の「描く位置」をゲームの描く計算そのもので出す(82譜面で約40秒・実際に流した記録と差0px)。`--w --h --road --draw 2d --safe`
- `tools/playbot/rhythm-tap-position-bot.js` … 曲を流しながら描く口 `drawNote` の座標を控え、描かれた真ん中を叩く(実プレイの確かめ)
- `tools/playbot/rhythm-tap-position-report.js` … 上の2つの書き出しを、判定の関数で「取れるか」まとめる
- `tools/playbot/rhythm-cross-swap-bot.js` … 交差・持ち替えの確かめ(`--entry debug` で公開曲・`--entry proto` で HELL)

### 道具の落とし穴(踏んだもの)
- **判定の関数は取れたノーツを書き換える**(HOLD/FLICK/SLIDE を指の動きを待つ形へ。FLICK は終わりを60秒先へ)。何度も当てて測る道具では、当てるたびに元へ戻す(`pureMatch`)。戻さないと FLICK が60秒の帯に化けて、あとのノーツが持ち替え待ちに吸われる
- **押されたスライド・ホールドは先頭が判定ラインに止まり、横も指に合わせて描かれる**。描いた位置を控えるのは押される前のコマだけ
- bot を何本も並べて流すとコマが詰まり、叩く時刻が遅れて MISS が出る(判定の窓185msより遅い)。位置の確かめは速い形で、実プレイは1〜2本ずつで
- `--entry select` の曲えらびは版がまとまった曲や上の難易度で外れることがある。デバッグの全解放の曲えらび(`--entry debug`)を使う。行は `data-rhythm-song-row` の id で選び、版は `data-rhythm-song-version` を押す
- `pkill -f <自分のコマンドに含まれる語>` は自分のシェルまで止める。プロセス番号で止める

## 部員(ビート部)と見ていること
| 部員 | 会話 | いま見ていること |
| --- | --- | --- |
| オンプくん | session_01VDL1xQjh5sVox2CGCDkx8w(10/12〜) | 譜面の下書き・HELL の譜面・譜面の検査 |
| マクアケくん | session_01JgrcvWE4GJff7cTHDPoecb | 曲紹介の幕・空中のタップの箱・空中を押した光・空中のレーンの見せ方の案(#2772)。道の床と空中の判定線には触らない約束 |
| リバースくん | session_01DfgZpuPHnVgxrwQiurqUQ1 | Grievous Lady の譜面(#2780 で 33.74秒の始まりを直した)・HELL の Grievous Lady |
| カゲくん | session_01Jqmiq5TioCr8iBg3nU8k77 | 新曲係(Against My Own Shadow ほか) |

## 10/11〜12 に入れたもの(テンポくん)
#2770 交差の持ち替えを空中の段のあるスライドでも / #2774 空中の判定線を道の幅+少しに / #2775・#2800 資料の静止画 / #2781 押した光を紫の床の上に /
#2782 スライドの始まりの検査 / #2790 押しても取れないノーツの検査と道具 / #2812 タップ位置の確かめの報告と道具
