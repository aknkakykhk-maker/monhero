# 音源を入れるときの決まり(モンヒロビートの曲・BGM)

ルートの [`CLAUDE.md`](../../CLAUDE.md) から、**この場所のファイルを触るときだけ要る決まり**を移したもの
(Claude Code はこのフォルダのファイルを読んだときにこのファイルを読み込む)。決まりの重さはルートと同じ。
移した一覧: [`docs/rules/README.md`](../../docs/rules/README.md)「節の置き場所」。

> 同じ本文を `monster-hero/images/CLAUDE.md` と `monster-hero/audio/CLAUDE.md` の両方に置いている。直すときは両方を直す
> (`node tools/rules-index-check.js` が両方の要のことばを見張る)。

### ⑥-2 画像・音源は、入れる前に必ず軽くする

ユーザーから受け取った画像や音源を**そのままリポジトリへ入れない**。スマホの通信量に直接効く。
詳細と手順: [`docs/rules/ASSETS.md`](../../docs/rules/ASSETS.md)

| 種類 | そろえる形 | 目安 |
| --- | --- | --- |
| 曲えらびのジャケット(`images/song-art/`) | 512×512 JPEG(`sharp` の `fit:'cover'` / `quality:80` / `mozjpeg`) | 60〜90KB |
| モンビーの音源(`audio/`) | 32kHz / 96kbps ステレオmp3。`-map_metadata -1 -vn` でタグとジャケットを落とす | 1曲2〜3MB |
| モンスターの絵・アイコン(`images/`) | PNGのまま。`node tools/image-asset-check.js` を通す | — |

- **曲の音量は全部そろえる。** 統合ラウドネス **-14 LUFS** / 真のピーク上限 **-1 dBTP**。
  かける倍率は `min(-14 - いまのLUFS, -1 - いまの真のピーク)` の1つだけで、**圧縮はしない**。
  `node tools/audio/rhythm-loudness-check.js --ffmpeg <パス>` で確かめる
- **`BGM_TRACKS` の `gain` では直せない**(実装が0〜1.25倍にクランプする)。音源そのものをそろえる
- **音源を差し替えたら、必ず `node tools/build.js` を通す。** `loadBuffer` が
  `cache:'force-cache'` を使うため、URLが同じままだと古い音のままになる
- すでに公開した音源を作り直すときは、頭の 1104 サンプル(`--from 0.0345`)を切る
- **すでにゲームに入っている音源が使えるなら、コピーを作らない**(`bgmTrackId` を指すだけにする)
- 入れたあと、足した絵や音源が起動時の読み込み(`index.html` の `SIZES`)へ混ざっていないか確かめる。
  ジャケットも曲の音源も**開いたときに初めて読む**側が正しい(起動時に読むmp3はタイトル曲だけ)

### ⑥ から移した: 絵を差し替えたとき

- モンスターの絵やアイコンを差し替え・追加したら、`node tools/build.js` でキャッシュキーを
  更新したうえで `node tools/image-asset-check.js` を通す。絵の実体は `monster-hero/images/` の
  PNGで、`data/images/images-*.js` と `data/breeder.js` にはそのパスだけを書く(base64で埋め戻さない)
- 見た目のCSS(Tailwind)が古いまま公開していないかは `node tools/build.js --check` と
  `node tools/boot/data-cache-key-check.js` が見張る
