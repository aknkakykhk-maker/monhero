---
name: rhythm-song-add
description: Add a new song to モンヒロビート (the rhythm-game mode of モンスターヒーロー). Use when the user drops an audio file (mp4/m4a/mp3) plus one jacket image, or says 新曲実装 / 曲追加 / この曲入れて. Covers the whole run — extracting and loudness-matching the audio, resizing the jacket, analyzing tempo, generating the 5 charts, asking the user about difficulty (the one place to stop), writing the changelog with the jacket and an optional link to someone else's game, running the checks, and publishing through PR and merge. Also lists the traps actually hit while adding 3 songs.
---

# モンヒロビートに新曲を足す

**このスキルだけで最後まで通せるように書いてある。** ただし譜面生成の仕組みそのものを触るときは
[`docs/spec/RHYTHM_MODE.md`](../../../docs/spec/RHYTHM_MODE.md) を開くこと（そちらが正本）。

運用ルールは下の「守ること」(⑥-3 の本文)と、[`monster-hero/audio/CLAUDE.md`](../../../monster-hero/audio/CLAUDE.md)(⑥-2 画像・音源)が根拠。
**聞き返すのは難易度だけ。** それ以外は最後まで黙って通す。

## 守ること(ルートの CLAUDE.md ⑥-3 から移した本文。ここが正本)

**「新曲実装」と動画・画像だけが投げられたら、それ以上聞き返さずに最後まで通す。**
曲名は動画のファイル名から取る。手順はスキルにしてある。**`rhythm-song-add` スキルを開いてから
始める**(`.claude/skills/rhythm-song-add/SKILL.md`)。落とし穴と経緯:
[`docs/rules/RHYTHM_SONG.md`](../../../docs/rules/RHYTHM_SONG.md)、仕組みの正本:
[`docs/spec/RHYTHM_MODE.md`](../../../docs/spec/RHYTHM_MODE.md)

> ⚠️ **例外はひとつだけ。難易度は、こちらで決めずに聞く**(2026-09-12の指示)。
> 依頼に指定があればそれに従う。無ければ、解析と生成を通したうえでいったん止めて、
> ①難易度ごとのレベル・ノーツ数・密度、②既存曲の帯の中でどのあたりか、
> ③`challengeFactor` を変えたときの候補、の3つを並べて報告し、どうするか聞く。
> 決まったら `challengeFactor` に書く。**測り方(`CHALLENGE_*`)は触らない**。
> ここ以外では聞き返さない(ジャケット加工・音量そろえ・マーカー登録・更新履歴は聞かずに進める)。

- **名前は5か所で綴りが違う**(songId / 音源の一覧のid / BGMのtrack id / 譜面のマーカー名 / ファイル名)。
  `tools/mode/rhythm-runtime-notes.js` の `RELEASED_MARKERS` と `RELEASED_TRACKS` への1行を忘れない
- **ヘルプは触らない**(`{t:'data'}` が実データから作る)。更新履歴へ1件書き、
  `assistantNotice:{id:'update_notice_◯◯_v1',type:'content'}` を付ける
- **お知らせにジャケットの絵を付ける。** 項目へ `image:'images/song-art/◯◯.jpg'` を1行
  (`?v=` は手で書かない)。`node tools/changelog/song-art-notice-check.js` を通す
- **お知らせに書いてよい Lv. は、その曲のものだけ。** 比較でほかの曲の数字を並べない。
  上下を伝えたいなら「いままででいちばん難しい譜面になりました」のように数字を出さずに書く
- **レベルとノーツ数は行を分ける**(`レベルは …` と `ノーツ数は …` の2行)
- よその作品の曲は、更新履歴へ `link:{url,label}` を書けば相手のページへのボタンが出る
  (**https だけ通る**関門 `changelogSafeLink` を経由する)。**宣伝の文面は教えてもらった事実だけで書く**。
  作者名は `BGM_TRACKS` の `creator` へ入れる
- 難易度が既存の帯から大きく外れるときは `chartIntensity:'extreme'` を使う
  (`challengeFactor` は5難易度まとめて効き、上げすぎるとレベルがむしろ下がる)


---

## 0. 受け取るもの

| もの | 形 |
| --- | --- |
| 音源 | mp4 / m4a / mp3 のどれか1つ |
| ジャケット | 画像1枚 |

**曲名は音源のファイル名から取る。** UTF-8を16進で綴った形で届くことがある
（`E7A681E696AD…` → `禁断のレジスタンス`）。

> 💡 ファイル名が `________.mp3` のようにアンダースコアだけのときは、
> **その数が日本語の文字数**。ジャケットに書かれている文字と数を照合すれば分かる
> （8つ → 「もう一つの世界へ」が8文字で一致した）。

`songId` は**アンダースコアだけ**を使う。**ハイフンを入れてはいけない**
（全国ランキングが `Rhythm-<songId>-<難易度>` を `-` で3つに割って戻すので、
ハイフンがあると割れ方が変わって**その曲のランキングだけが黙って空になる**）。

---

## 1. 下ごしらえ（最初に1回だけ）

```bash
# tools の依存。これが無いと reencode が「Playwright がありません」で止まる
cd tools && npm install && cd ..

# mp4 / m4a から音を出すのに要る。リポジトリの依存には足さない
mkdir -p "$SCRATCH/ffwork" && cd "$SCRATCH/ffwork" && npm init -y && npm install ffmpeg-static
FF="$SCRATCH/ffwork/node_modules/ffmpeg-static/ffmpeg"
```

`$SCRATCH` はセッションのスクラッチ用ディレクトリ。

> ⚠️ **Playwright の Chromium は AAC も Opus も読めない。** `rhythm-audio-reencode.js` へ
> mp4 / m4a を直接渡すと `EncodingError: Unable to decode audio data` で止まる。
> ffmpeg で WAV にしてから渡す。mp3 は Chromium が読めるのでそのまま渡せる。

---

## 2. 音源（-14 LUFS へそろえる）

```bash
# ① 映像とタグを落として素のWAVへ（mp3ならこの手順は省いてよい）
$FF -v error -i src.m4a -map_metadata -1 -vn -ac 2 -ar 44100 -c:a pcm_s16le full.wav

# ② mp3へ（ここはリポジトリのツールへ戻す。既存曲と作り方をそろえるため）
node tools/mode/rhythm-audio-reencode.js --in full.wav \
  --out monster-hero/audio/bgm-<slug>.mp3 --kbps 96 --rate 32000

# ③ いまの大きさを測る
$FF -hide_banner -nostats -i monster-hero/audio/bgm-<slug>.mp3 \
  -af loudnorm=I=-14:TP=-1:print_format=json -f null - 2>&1 | grep -E 'input_i|input_tp'

# ④ 倍率を出して、もう一度エンコードし直す（②をやり直す。mp3を二重に通さない）
#    dB = min(-14 - いまのLUFS, -1 - いまの真のピーク)   倍率 = 10^(dB/20)
node tools/mode/rhythm-audio-reencode.js --in full.wav \
  --out monster-hero/audio/bgm-<slug>.mp3 --kbps 96 --rate 32000 --gain <倍率>
```

**圧縮はしない**（音の表情が変わる）。上限に当たったらそこで止める。

実例: -14.99 LUFS / -1.76 dBTP の曲は、目標まで上げるとピークが超えるので
**+0.76dB で止めて -14.22 LUFS / -0.98 dBTP**。これで正しい。

`BGM_TRACKS` の `gain` では直せない（実装が 0〜1.25倍にクランプするので +1.9dB まで）。

---

## 3. ジャケット（512×512 JPEG）

```bash
node -e "require('./tools/node_modules/sharp')('<元絵>')
  .resize(512,512,{fit:'cover'}).jpeg({quality:80,mozjpeg:true})
  .toFile('monster-hero/images/song-art/<slug>.jpg').then(r=>console.log(r.size))"
```

目安 60〜90KB。`?v=` は手で書かない（`tools/build.js` が中身のハッシュから付ける）。

> ⚠️ **元絵が正方形でないと、`fit:'cover'` で上下か左右が切れる。**
> 人物の顔やタイトル文字が切れていないか、書き出した絵を目で見て確かめる
> （実際に1曲めで切れて、あとから差し替えになった）。

---

## 4. 名前は5か所で綴りが違う

| どこ | 形 | 例 |
| --- | --- | --- |
| songId（`RHYTHM_SONG_ENTRIES` / `RHYTHM_DEMO_SONG_IDS` / レベル表） | `_` 区切り | `freedom_dive` |
| 音源の一覧のid（`rhythm-song-registry.json` / `RELEASED_TRACKS`） | 同じ | `freedom_dive` |
| BGMのtrack id（`BGM_TRACKS` / `bgmTrackId`） | `melo_` を付ける | `melo_freedom_dive` |
| 譜面のマーカー（`RELEASED_MARKERS` / `// <…-notes>`） | `-` 区切り＋`-v3` | `freedom-dive-v3` |
| ファイル名 | `-` 区切り | `bgm-freedom-dive.mp3` / `freedom-dive.jpg` |

`tools/mode/rhythm-runtime-notes.js` の `RELEASED_MARKERS` と `RELEASED_TRACKS` への
**1行ずつを書き忘れると、検査だけが静かに対象外になる**（落ちないので気づけない）。

`monster-hero/data/rhythm-mode.js` の `RHYTHM_SONG_BEATS` にも1行足す（道の演出の拍の線が使う）。
値は解析ファイルの `timing` の `[beatMs, beatZeroMs, beatsPerBar]`。`node tools/mode/rhythm-song-beats-check.js` が抜けと写し間違いを見つける。
続けて `node tools/mode/rhythm-song-climax.js --write` を打つ（盛り上がる区間の表 `RHYTHM_SONG_CLIMAX`。オプション「盛り上がりの光」が使う）。
抜けると `node tools/mode/rhythm-climax-fx-check.js` が落ちる。

---

## 5. 解析（テンポは必ず候補を比べる）

```bash
# 音源の一覧へ1件足してから
node tools/mode/rhythm-audio-analyze-v3.js --track <track_id> --write
```

初めて解析すると、一覧のその曲へ `"chartRevision": <最新>`（譜面の作り方のリビジョン。2026-10-05 時点で 28。遊んだ記録から学んだ調整値が書き足されると、それより大きい番号になる。`docs/spec/RHYTHM_PLAY_LOG.md`）が自動で入る。
Rev.9 からは、パイプライン（`--write`）が生成の前に音の層の解析 `authoring/<曲>-v3-layers.json` を作る（主役の追跡の材料。**コミットに含める**）。
生成のときに `主役の追跡: ドラム◯小節・歌や主旋律◯小節…` と出ていれば効いている（`効かない` と出たら層の解析を作り直す）。
Rev.12 からは、パイプラインが生成の直後に区間の差し替え（`rhythm-chart-v3-splice.js --apply`）を通す。難易度ごとに `差し替えた` / `差し替えない（理由）` と出る。
**消さない**。新しい曲だけが最新の作り方で作られる（既存曲は書いてあるリビジョンのまま）。
中身の一覧は `tools/mode/rhythm-chart-v3-revision.js` の冒頭。Rev.8 は横フリックの向きを払う指の動きで決め、
写しの小節の FLICK も元の小節に揃える（`docs/spec/RHYTHM_CHART_ENGINE_ROADMAP.md` の段1）。
生成のときに `譜面の作り方: MHB CHART ENGINE Rev.8（フレーズの写しあり）…` のように出ていれば効いている
（譜面生成ツールの名前が **MHB CHART ENGINE**、作り方の世代が **Rev.**。2026-09-26 に「版」から呼び名を改めた）。

> 入るリビジョンは `rhythm-chart-v3-revision.js` の `CHART_REVISION_LATEST`(最新リビジョン)。**Rev.5からは6レーン**の譜面になる
> (2026-09-26。道が6レーン・サブレーン12本になった)。パイプラインの `--release` が、譜面を束ねる
> `mhChart(レベル,ノーツ,長さ,6)` の4つ目も書くので、手で `,6` を足さなくてよい。
> 空のマーカーを足すときの `mhChart(…)` は3つのままでよい(書き出しのときに直る)。

`meter-doubt`（3拍子と判定したが、強い打点が4拍子の位置に多い）が出たら、**示された代わりの候補（4/3倍の BPM・4拍子）を最初に試す**
（2026-09-26。人が直した crossing_field・freedom_dive は、どちらもこの代わりの候補が正解だった。`node tools/mode/rhythm-audio-meter-opinion.js` で全曲を見られる）。
2026-09-29 からは、止める警告の強さ(1.8以上)なら**解析が自動でその候補に直す**（`meter-corrected` の注意が出る・`timing.source` は `auto-corrected`）。
直った値のまま進めてよいが、聞いてずれていれば `--no-auto-meter` か `--bpm` で決め直す。やや疑わしい(1.5〜1.8)ときは今までどおり `meter-doubt` の注意だけ。
`meter-rare`（5拍子・7拍子と判定した）が出たら、まず4拍子（`--beats-per-bar 4`）を試す（only my railgun は5拍子と読んでいた）。
テンポが途中で揺れる曲は、Rev.21 から生成器が自動で合わせる（なめらかに揺れ、半分の区間で確かめられたときだけ。`node tools/mode/rhythm-chart-tempo-warp.js` で見られる）。
`tempo-ambiguous`（ほかの候補と拮抗）が出たら、**必ず候補を比べる**。
このスキルで足した3曲は**全部これが出た**。

```bash
for BPM in <自動の値> <その半分> <その3/4>; do
  node tools/mode/rhythm-audio-analyze-v3.js --track <track_id> --bpm $BPM 2>&1 | grep -E "テンポ|格子"
done
```

**「格子への乗り」の ±43ms で決める。** 実例。

| 曲 | 採用 | 半分 | ほか |
| --- | --- | --- | --- |
| FREEDOM DiVE↓ | 222.22 → **100%** | 111.11 → 50% | 166.70(自動) → 97% |
| The City Beneath the Comets | 170.466 → **98%** | 85.23 → 54% | 113.64 → 73% |
| もう一つの世界へ | 187.5 → **100%** | 93.75 → 60% | 125 → 73% |

自動判定が外れることもある（FREEDOM DiVE↓ は 166.70BPM / 3拍子 と出たが、
正しくは 222.22BPM / 4拍子）。`--beats-per-bar 4` と `--beat-zero <ms>` も指定できる。

倍テンポを疑うときは「拍に音が乗る率」を**偶数拍と奇数拍に分けて**見るのが早い。

### テンポが少しずつ変わる曲（2026-10-05・Rev.28）

20秒ごとの局所テンポが一方向へ動き続ける曲（Emerald Rush は 150.0 → 153.0 BPM）は、1つのテンポの格子から拍が最大で1拍近くずれる。
なめらかな揺れ（Rev.21/23）は幅の上限があるので効かない（「途中で段差のように跳ぶ」と出る）。

1. 基準のテンポ（自動の値）と拍の頭のまま、5秒ごとに拍の位置のずれを測り、前の窓からつないでいく（±80ms の範囲で探す）
2. 前後と3点でならし、音源の一覧へ `"warpPoints":[[時刻ms,ずれms],…]` を書く。ゲームの拍の表 `RHYTHM_SONG_BEATS` の5つ目にも同じ点を書く（4つ目のつなぎ目が無ければ `[]`）
3. 解析の打点が ±15ms・±30ms の格子に乗る割合が上がることを確かめる（Emerald Rush は 33% → 51%・64% → 81%）
4. `node tools/mode/rhythm-chart-rev28-check.js` が、2つの点の一致と、ノーツが「格子＋曲線のずれ」に乗ることを見る

### すでにある曲の short ver. ・切り貼りした版（2026-10-03・Rev.26）

元の曲の録音を途中で切ってつないだ版は、**つなぎ目から先の拍が、前の格子から一定の量だけずれる**。
1つのテンポのままだと、後ろ半分のノーツが音より最大で16分の半分ほど早い・遅いになる。

1. 元の曲の音源と5秒ごとに相関で突き合わせ、ショートのどこが元のどこかを出す（前半は頭を切った34.5msぶん遅れて並ぶ）
2. テンポと拍の頭は**元の曲の登録値を引き継ぐ**（拍の頭は前半のずれを足す。例 440 → 474）
3. つなぎ目の時刻を0.5秒刻みの相関で探し、ずれを「小節の頭がそろう量」で出す（飛ばした長さを小節の長さで割った余りを負にしたもの）
4. 音源の一覧へ `"splices":[{"atMs":<つなぎ目>,"shiftMs":<ずれ>}]` を書き、ゲームの拍の表 `RHYTHM_SONG_BEATS` の4つ目にも `[[atMs,shiftMs]]` を書く
5. `node tools/mode/rhythm-chart-rev26-check.js` が、2つの値の一致と、つなぎ目の前後でノーツがそれぞれの格子に乗ることを見る

ジャケットは元の曲のものを使い回す（`artwork` に同じ絵）。`displayName` は元の曲と同じにして、`subtitle` に「～◯◯～ short ver.」と書く。

**既存の曲の別の版（short ver.・remix・-Another- など）を足したら、`RHYTHM_SONG_VERSION_GROUPS`（`data/rhythm-mode.js`）のその曲の組の末尾へ `['<songId>','short ver.']` を1行足す**（2026-10-03）。
曲えらびでは版がまとめて1行になり、難易度ボタンの上で切り替わる。組に入れ忘れると別の行に並び、`node tools/mode/rhythm-song-version-check.js`
（表示名が同じ公開曲が同じ組に入っているか）が落ちる。`RHYTHM_DEMO_SONG_IDS` には今までどおり末尾へ足す（公開の範囲・ランキング送信はこちら）。

---

## 6. 入れ物を作って譜面を流し込む

`monster-hero/data/rhythm-mode.js` へ次を書く（既存曲の隣に、同じ形で）。

1. `const <NAME>_DURATION_MS=<解析のdurationMs>;`
2. 5難易度ぶんの空のノーツ入れ物（`// <…-v3-easy-notes>` と閉じタグだけ）
3. `const <name>Charts=Object.freeze({EASY:mhChart(1,…), …});`
4. `RHYTHM_SONG_ENTRIES` へ1件（`songId` / `displayName` / `bgmTrackId` / `artwork` / `difficulties`）
5. レベル表（`<rhythm-chart-levels>` の内側）へ仮の行
6. `RHYTHM_DEMO_SONG_IDS` の**末尾**へ songId

さらに `rhythm-runtime-notes.js` へ2行、`13-bgm-and-rhythm-settings.jsx` の `BGM_TRACKS` へ1行。

```bash
node tools/mode/rhythm-chart-v3-pipeline.js --track <track_id> --release
node tools/mode/rhythm-chart-level.js --write
```

> ⚠️ `RHYTHM_SONGS[].bgmTrackId` が `BGM_TRACKS` に在るかを突き合わせる検査は**無い**。
> 書き忘れると「曲えらびには並ぶのに無音で始まる」。ここは目で確かめる。

---

## 7. ★ここで止まって難易度を聞く

**唯一の聞き返しポイント**（上の「守ること」⑥-3）。依頼に難易度の指定があればそれに従う。
無ければ、次を並べて報告してから止まる。

1. **レベル・ノーツ数・毎秒ノーツ**を難易度ごとに
2. **既存曲の帯の中でどこに来るか**（帯から外れているならその旨）
3. **`challengeFactor` を変えた候補**（実際に生成して数字で示す）
4. **体感の数字**（下記）

> ⚠️ **レベルの数字だけでは伝わらない**（実際に「38がめちゃくちゃ難しい感じしなかった」と言われた）。
> Lv. は「指の忙しさ」しか測っていないので、次も一緒に出す。

```bash
node -e "
const fs=require('fs');const s=fs.readFileSync('monster-hero/data/rhythm-mode.js','utf8');
const m=s.match(/<<マーカー>>-master-notes>([\s\S]*?)<\/<<マーカー>>-master-notes>/);
const t=[...m[1].matchAll(/[thfs]\((\d+),/g)].map(x=>+x[1]).sort((a,b)=>a-b);
let best=0;for(let i=0;i<t.length;i++){let j=i;while(j<t.length&&t[j]-t[i]<=4000)j++;if(j-i>best)best=j-i;}
const g=[];for(let i=1;i<t.length;i++){const d=t[i]-t[i-1];if(d>0)g.push(d);}g.sort((a,b)=>a-b);
console.log('最密4秒',best+'打  最短',g[0]+'ms');"
```

参考値（MASTER）: SIX ÉTERNEL Lv.38 は 30打・72ms、Monster Hero Lv.30 は 29打・86ms。

### `challengeFactor` の落とし穴

**上げすぎると逆にレベルが下がる。** 量が打点の上限に近づいて配置が素直になるため。

| 曲 | 自動 | 上げたとき |
| --- | --- | --- |
| FREEDOM DiVE↓ | MASTER 33 | 1.30 → **31** |
| The City Beneath the Comets | MASTER 33 | 1.20 → **30** |

上だけを尖らせたいときは `challengeFactor` ではなく **`chartIntensity:'extreme'`** を使う
（書いた曲にしか効かない。詳しくは `docs/spec/RHYTHM_MODE.md`「19曲目 FREEDOM DiVE↓」）。
`extreme` は全難易度が大きく上がる（Stay With Me short ver. で MASTER 20 → 34）。**中間がほしいときは `chartIntensity:'strong'`**
（extreme の倍率の平方根・16分裏は65%まで残す。同じ曲で 26。2026-10-03）。
音が格子に乗りにくい曲は `challengeFactor` を上げても MASTER が増えず、EXPERT が MASTER を追い越して「難易度の順が崩れている」で止まる。

> ⚠️ **`strong` / `extreme` で短い曲を作ると、EXPERT のほうが体感で難しくなることがある**(2026-10-07・ANiMA)。
> 置ける音を EXPERT の時点で使い切り、MASTER は同時押しで数を稼ぐので、Lv. は MASTER が上でも「叩く回数」「速い連打」は EXPERT が多い。
> 難易度を聞く前に `node tools/mode/rhythm-expert-master-order-check.js` を通す。逆転していたら、曲の一覧の
> `chartIntensityByDifficulty`(例 `{"EXPERT":"mild","MASTER":"extreme"}`。`mild` は strong の半分・`none` は倍率なし)で EXPERT を軽く・MASTER を重くした候補も並べる。
そのときは `challengeFactor` ではなく `chartIntensity` を使う。

決まったら `challengeFactor` に書く。**測り方（`CHALLENGE_*`）は触らない**（ほかの曲まで変わる）。
決めた理由は `docs/spec/RHYTHM_MODE.md` に残す（`rhythm-song-challenge-check.js` が見張る）。

Rev.20 から、自動の歯ごたえはテンポを0.35乗・拍のはっきりさを0.15乗でしか数えない（それまでは0.7乗・0.55乗。
量がすでにテンポに比例しているのに二重に数えていた。`rhythm-chart-rev20-check.js`）。遅い曲・拍の立ちが弱い曲を
人が重く直す必要は、前より少ないはず。まず自動のまま出して、帯の中の位置を見てから決める。

---

## 8. 更新履歴（ヘルプは触らない）

ヘルプは `{t:'data', id:'…'}` が実データから作るので**自動で載る**。手で書き写さない。

> ⚠️ **譜面の作り方のRev.3・Rev.4で初めて入る遊び方は、最初の1曲のときだけヘルプと更新履歴に書く**(2026-09-26)。
> Rev.3で SLIDE が曲線になり、Rev.4で **MASTER に横フリック**(左右へ払う FLICK)が出る。どちらも仕組みは入っているが、
> それを使う曲がまだ無いので、ヘルプにも更新履歴にも書いていない。`node tools/mode/rhythm-side-flick-check.js` の
> 「うち横フリック N本」が 0 から増える曲を入れるときは、ヘルプの「ノーツの色とコンボの演出」の FLICK の行と
> 操作の説明へ横フリックを足し、その曲の更新履歴にも「MASTERでは左右へ払うフリックが出ます」と書く。

> ⚠️ **EXPERT・MASTER は、その曲の HARD を1回クリアすると一度に開く**(2026-10-09 に新曲から、2026-10-10 に全曲へ。社長の選択・改善部の提案 G5・K1)。
> 何もしなくてもそうなる(`data/rhythm-mode.js` の `RHYTHM_DIFFICULTY_UNLOCK_BY`)。曲ごとに書き足すものは無い。

更新履歴（`monster-hero/data/changelog.js`）へ**先頭に**1件。日時は**いまの実時刻**。

```bash
TZ=Asia/Tokyo date '+%Y-%m-%d %H:%M'   # ← これをそのまま書く
```

```js
date: "2026-09-14 20:28", type:'update', title:'モンヒロビート：新曲「◯◯」を追加しました', status:'new',
image: 'images/song-art/<slug>.jpg',                          // ジャケット。告知にも同じ絵が出る
link: { url:'https://…', label:'◯◯ を開く' },                 // よその作品のときだけ
items:[
  'モンヒロビートに「◯◯」（◯分◯秒）を追加しました。曲えらびからすぐ遊べます。',
  'レベルは EASY Lv.◯ ／ NORMAL Lv.◯ ／ HARD Lv.◯ ／ EXPERT Lv.◯ ／ MASTER Lv.◯ です。',
  'ノーツ数は ◯ ／ ◯ ／ ◯ ／ ◯ ／ ◯ です。',
],
assistantNotice: { id:'update_notice_<slug>_v1', type:'content' },
```

守ること。

- **レベルとノーツ数は行を分ける**（1行に詰めると折り返した画面で数字が追えない）
- **ほかの曲の Lv. を混ぜない**（「これまでの最高は…」と並べたら、どちらがこの曲か分からなくなった）。
  上下を伝えたいなら「いままででいちばん難しい譜面になりました」のように**数字を出さずに**書く
- `image` は**1か所だけ**書く（助手の告知が `entry.image` をそのまま持っていく）

---

## 9. よその人の作品の曲のとき

| やること | どこ |
| --- | --- |
| 作者名を入れる | `BGM_TRACKS` の `creator:'<作者名>'`（オリジナルは `'オリジナル'`） |
| お知らせにリンクを出す | 更新履歴の `link:{url,label}` |
| ジャケットを大きくしたときに紹介を出す | 曲データの `credit:{text,link:{url,label}}` |

リンクは `changelogSafeLink` を必ず通す（**https だけ**通り、`target="_blank"` と
`rel="noopener noreferrer"` が付く）。絵の外を押すと閉じる作りなので、
拡大表示のリンクには `onClick={e=>e.stopPropagation()}` を置く。

> ⚠️ **宣伝の文面は、教えてもらった事実だけで書く。**
> このサンドボックスから外部サイトは開けない（`EGRESS_BLOCKED`）ので、ゲームの中身は確かめられない。
> よその人の作品なので、確かめていないことを足すと嘘になる。
> ジャンルや特徴を書きたいなら、ユーザーに聞く。

お知らせは日が経つと埋もれるが、**ジャケットの拡大は曲を選ぶたびに目に入る**ので、
宣伝としてはそちらのほうが効く。

---

## 10. 検査

```bash
node tools/build.js
node tools/run-checks.js --area required     # 14本。全部通すこと
node tools/run-checks.js --area changelog     # お知らせ・ジャケット・リンク
node tools/run-checks.js --area audio         # BGM_TRACKS の src が実在するか
node tools/audio/rhythm-loudness-check.js --ffmpeg "$FF"   # 全曲の音量
node tools/run-checks.js --area mode          # 175本・約14分。譜面まわり
```

**起動時の読み込みが増えたのが譜面だけであることを確かめる。**

```bash
git diff -- monster-hero/index.html | grep -E "^[-+].*SIZES"
```

1曲あたり `data/rhythm-mode.js` が 50KB ほど増えるのは正しい。
**mp3 とジャケットが `SIZES` に入っていたら入れ方を間違えている**（開いたときに読む側にあるのが正しい）。

### NG が出たときの切り分け

**必ず「変更前でも落ちるか」を確かめる。** このリポジトリには**前から落ちている検査が10本前後ある**。

```bash
git worktree add "$SCRATCH/pre" origin/main
ln -sfn "$PWD/tools/node_modules" "$SCRATCH/pre/tools/node_modules"
(cd "$SCRATCH/pre" && node tools/<落ちた検査>.js 2>&1 | tail -2)
```

`tail -2` だけ見て「通った」と判断しない（`grep -E "^NG|件のNG|すべてOK"` で見る）。

---

## 11. 公開

```bash
git add -A && git commit    # ②③のとおり確認は取らない
git fetch origin main && git merge origin/main    # ★PRを作る直前に必ず
git push -u origin <ブランチ>
# PR作成 → squash merge → git reset --hard origin/main → push
```

マージ後にリモートのブランチが消えていることがある。`--force-with-lease` は失敗するので
`git push -u origin <ブランチ>`（新規作成）でよい。

---

## 実際に踏んだ落とし穴（3曲ぶん）

### 待機ループが自分自身を見つけて止まらない

```bash
until ! pgrep -f "run-checks.js --area mode" >/dev/null; do sleep 5; done   # ← 永久に終わらない
```

`pgrep -f` が**この until 文を含むコマンドライン自身**にマッチする。検査はとっくに終わっていたのに
10時間待ち続けた。プロセスIDを控えるか、`Bash` の `run_in_background` で起動して
完了通知を待つこと。

### 更新履歴のマージで、main の項目を消す

`changelog.js` は両者が**先頭に項目を足す**ので必ず衝突する。
衝突ブロックを機械的に連結すると、**エントリの境界（`  },` と `  {`）が欠けて
main の項目が自分の項目に飲み込まれる**（実際に1件消した。件数を数えて気づいた）。

直し方。

1. 衝突ブロックを **main 側で解決**する（`=======` から `>>>>>>>` まで）
2. 自分の項目を**完全な形**（`  {` … `  },`）で組み立てる
3. 日時の**降順**になる位置へ挿入する
4. **件数と逆転を必ず数える**

```bash
node -e "
const fs=require('fs'),vm=require('vm');const ctx={Object,Number,Math,JSON,Array,String};
const src=fs.readFileSync('monster-hero/data/changelog.js','utf8');
vm.runInNewContext(src+'\nthis.out=CHANGELOG;',ctx);
const d=[...src.matchAll(/date:\s*\"([0-9-]+ [0-9:]+)\"/g)].map(m=>m[1]);
let r=0;for(let i=1;i<d.length;i++) if(d[i]>d[i-1])r++;
console.log('件数',ctx.out.length,'／逆転',r,'か所');"
```

### 更新履歴の時刻を未来に書く

`changelog-order-check.js` が**未来の日時**と**コミット時刻との1時間以上のずれ**を見る。
書く直前に `TZ=Asia/Tokyo date` を打ち、その値をそのまま使う。

### 検査が空振りしていた

自分で足した検査が**1件も拾えていなかった**ことが2回あった。

- `[^Lv]{0,40}` … 区切りに `NORMAL` が来ると **L で止まる**。否定先読み `(?:(?!Lv\.).){0,40}` にする
- 置換で「柵を外した版」を作る検査が、置換対象の文字列が変わって**必ず一致してしまう**状態になった

**検査を足したら、わざと壊した入力で落ちることを必ず確かめる。**

### authoring の生成物を作り直すと、既存の検査が落ちる

既存曲を再生成すると `rhythm-chart-v3-check.js` が落ちる（生成器と検査に前からある不整合。
**変更前の生成器でも同じく落ちる**）。新曲を足すだけなら触らないこと。
触ってしまったら `git checkout -- tools/mode/authoring/` で戻す。

### tools/node_modules が無い

セッションの最初に `cd tools && npm install`。無いと reencode が
「Playwright がありません」で止まる。
