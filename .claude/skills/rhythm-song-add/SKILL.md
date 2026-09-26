---
name: rhythm-song-add
description: Add a new song to モンヒロビート (the rhythm-game mode of モンスターヒーロー). Use when the user drops an audio file (mp4/m4a/mp3) plus one jacket image, or says 新曲実装 / 曲追加 / この曲入れて. Covers the whole run — extracting and loudness-matching the audio, resizing the jacket, analyzing tempo, generating the 5 charts, asking the user about difficulty (the one place to stop), writing the changelog with the jacket and an optional link to someone else's game, running the checks, and publishing through PR and merge. Also lists the traps actually hit while adding 3 songs.
---

# モンヒロビートに新曲を足す

**このスキルだけで最後まで通せるように書いてある。** ただし譜面生成の仕組みそのものを触るときは
[`docs/spec/RHYTHM_MODE.md`](../../../docs/spec/RHYTHM_MODE.md) を開くこと（そちらが正本）。

運用ルールは [`CLAUDE.md`](../../../CLAUDE.md) の ⑥-2 / ⑥-3 が根拠。
**聞き返すのは難易度だけ。** それ以外は最後まで黙って通す。

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

---

## 5. 解析（テンポは必ず候補を比べる）

```bash
# 音源の一覧へ1件足してから
node tools/mode/rhythm-audio-analyze-v3.js --track <track_id> --write
```

初めて解析すると、一覧のその曲へ `"chartRevision": <最新>`（譜面の作り方のリビジョン。2026-09-26 時点で 10）が自動で入る。
Rev.9 からは、パイプライン（`--write`）が生成の前に音の層の解析 `authoring/<曲>-v3-layers.json` を作る（主役の追跡の材料。**コミットに含める**）。
生成のときに `主役の追跡: ドラム◯小節・歌や主旋律◯小節…` と出ていれば効いている（`効かない` と出たら層の解析を作り直す）。
**消さない**。新しい曲だけが最新の作り方で作られる（既存曲は書いてあるリビジョンのまま）。
中身の一覧は `tools/mode/rhythm-chart-v3-revision.js` の冒頭。Rev.8 は横フリックの向きを払う指の動きで決め、
写しの小節の FLICK も元の小節に揃える（`docs/spec/RHYTHM_CHART_ENGINE_ROADMAP.md` の段1）。
生成のときに `譜面の作り方: MHB CHART ENGINE Rev.8（フレーズの写しあり）…` のように出ていれば効いている
（譜面生成ツールの名前が **MHB CHART ENGINE**、作り方の世代が **Rev.**。2026-09-26 に「版」から呼び名を改めた）。

> 入るリビジョンは `rhythm-chart-v3-revision.js` の `CHART_REVISION_LATEST`(最新リビジョン)。**Rev.5からは6レーン**の譜面になる
> (2026-09-26。道が6レーン・サブレーン12本になった)。パイプラインの `--release` が、譜面を束ねる
> `mhChart(レベル,ノーツ,長さ,6)` の4つ目も書くので、手で `,6` を足さなくてよい。
> 空のマーカーを足すときの `mhChart(…)` は3つのままでよい(書き出しのときに直る)。

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

**唯一の聞き返しポイント**（CLAUDE.md ⑥-3）。依頼に難易度の指定があればそれに従う。
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

決まったら `challengeFactor` に書く。**測り方（`CHALLENGE_*`）は触らない**（ほかの曲まで変わる）。
決めた理由は `docs/spec/RHYTHM_MODE.md` に残す（`rhythm-song-challenge-check.js` が見張る）。

---

## 8. 更新履歴（ヘルプは触らない）

ヘルプは `{t:'data', id:'…'}` が実データから作るので**自動で載る**。手で書き写さない。

> ⚠️ **譜面の作り方のRev.3・Rev.4で初めて入る遊び方は、最初の1曲のときだけヘルプと更新履歴に書く**(2026-09-26)。
> Rev.3で SLIDE が曲線になり、Rev.4で **MASTER に横フリック**(左右へ払う FLICK)が出る。どちらも仕組みは入っているが、
> それを使う曲がまだ無いので、ヘルプにも更新履歴にも書いていない。`node tools/mode/rhythm-side-flick-check.js` の
> 「うち横フリック N本」が 0 から増える曲を入れるときは、ヘルプの「ノーツの色とコンボの演出」の FLICK の行と
> 操作の説明へ横フリックを足し、その曲の更新履歴にも「MASTERでは左右へ払うフリックが出ます」と書く。

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
