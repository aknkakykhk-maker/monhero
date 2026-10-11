# オンプくん(ビート部・譜面係)引き継ぎメモ(2026-10-12 未明)

会話が長くなった(約65万)ので交代する。上司はテンポ部長、窓口は統括部長モンヒロくん(`docs/playbot/SESSIONS.md` の窓口の行が正)。

## 守ること(今日増えた決まり)

- 見積もりは AI が手を動かす時間で出す。余裕を足さない。延びるなら理由を先に知らせる(RULES 21)
- 許可の画面が出そうな操作(公開・送信・削除・SQL・設定)の前に、日本語で「何のために・何をするか・読むだけか書き込みか・取り消せるか」を1〜2行(RULES 20)
- 部署は Supabase に直接触らない(読むだけの SELECT も窓口経由)
- HELL は公開の印 `RELEASE_FLAGS.rhythmHell` を偽のまま。印の後ろに組み込む・デバッグで試せる形・bot と検査までは進めてマージしてよい。社長の判断で変わりそうな値は1か所で後から変えられる形にする
- 公開中の譜面は `tools/mode/rhythm-released-chart-lock-check.js` が指紋で見張る(CI でも回る)。決まった直しで変えるときだけ `--update --reason`
- 重い測り(bot・perf-bench)とほかの重い計算を同時に回さない(数字が乱れ、bot の指が遅れる)

## 今日作った・直した道具(どれも main に入っている)

| 道具 | 何をするか |
| --- | --- |
| `tools/mode/rhythm-ref-flow.js` / `rhythm-ref-compare.js` | 参考動画の流れの速さ・待っているノーツ / 参考と演奏画面を並べた1枚(#2681) |
| `tools/mode/rhythm-ref-tiers.js` | 段3: モンスターノーツ4個(#2687)。thumbCheck を両手のシミュレートとそろえた(先読み・レーン毎秒・幅の中で指を離せる・#2699)。`--song <id|all>` で公開中の譜面を2つの物差しで測る。スライドの点の高さを読む |
| `tools/mode/rhythm-overlap-reach-fix.js` | `--write` は `--song` 必須・ほかの曲は1バイトも変えない(#2716) |
| `tools/mode/rhythm-hell-mix.js` | HELL を MASTER から作る(空と地上が混ざって行き来・交差する両手の長押し `crosses`)。Lv. は `shownLevel`(#2762・#2769・#2795) |
| `tools/mode/rhythm-chart-level.js` | 空中がある譜面は「地上と見なした Lv. × `SKY_LEVEL_FACTOR`(1.2)」。`LEVEL_OVERRIDES` に試作の枠の HELL も書ける |
| `tools/playbot/rhythm-cross-swap-bot.js` | 空中のスライドを空中の高さで押す(演奏中のノーツは点の高さが抜けるので曲の表から引く)。`BAD_LIST=1` |

## 残っていること

- **HELL の Lv.**: 社長が遊んだあとに数字を決める。選択肢と直し方は [`hell-perf/level-options.md`](hell-perf/level-options.md)(窓口がまとめて聞く)
- **HELL の重さ**: 3回ずつの測り直し(2D・gpu)。表は [`hell-perf/README.md`](hell-perf/README.md)。どちらの描き方でも HELL は MASTER と同じか軽い
- **Sheriruth HARD/EXPERT/MASTER の 44.335秒のタップ**: 仕上げの道具の巻き添えでサブレーン3→4に動いていた(12459fdc9)。戻すかは窓口が決める(戻すなら3譜面の `t(44335,4,3,0)` を `t(44335,3,3,0)` にして `--update --reason`)
- **交差をきつくした版**(Sheriruth MASTER の交差の見せ場を1拍で2レーン)の下書きはテンポ部長へ渡し済み。試作の枠への組み込みはテンポ部長
- 前からある NG: `rhythm-chart-rev8-check.js`(Rev.7 の譜面が1バイトも変わらない)。テンポ部長に知らせ済み
