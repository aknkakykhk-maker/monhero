# モンヒロ画像制作ルール（リポジトリ側スキル）

このファイルは窓口（Claude）側がモンヒロの画像を扱うときの要点をまとめたものです。完全なパイプライン（生成の実測設定・透過処理ツール・品質検査ツール・キャラ参照DB）は Muse 側のカスタムスキル `monhero_image_generation`（`~/workspace/custom-skills/monhero_image_generation/`）が正本で、画像の生成・加工・検査は原則そちらで実施します。このファイルは、リポジトリ側で画像ファイルを差し替える・登録する際に守る規約だけを抜き出したものです。

## 表情と命名（リポジトリ規約が正本）

- 助手の表情は8種: normal / happy / wink / surprise / troubled / angry / crying / excited。寝顔は sleep として別管理。
- バスト絵・顔アイコン: `<prefix>_<表情>.PNG`（大文字PNG）。顔アイコンは `images/assistant/face/`、衣装別は `images/assistant/<衣装>/`（halloween / card-master / winter / twintail / hosei / sekiyuou）。
- 立ち絵: `images/assistant/stand-<衣装>/<prefix>_<表情>.png`（小文字png）。
- 全身絵: `images/assistant/fullbody/<名前>.png`（土台）と `images/assistant/fullbody/<名前>__<表情>.png`（アンダースコア2つ）。
- 顔アイコンは 256×256 統一。立ち絵の顔位置は `ASSISTANT_LIFE_STAND_FACE` 系パラメータで登録されるため、ポーズ・画角を変えたら顔位置の再登録が要る。

## キャラの正本

- キャラ設定は `monster-hero/data/assistants.js` と既存公式素材が正本。AIの推測で設定を変えない。
- みゅあの顔・耳の正本はハロウィンバスト絵 `images/assistant/halloween/myua_*.PNG`。耳は帽子ではなく2枚重なりの垂れ耳（仕様は Muse 側スキル参照）。

## ジャケット

- `monster-hero/images/song-art/<song-id>.jpg`、正方形（既存は512×512中心、新規は1170×1170）。曲名は正確に。文字が読めない小さいサムネイルは不合格。

## 差し替え時の注意

- 画像の `?v=` はファイルの sha256 先頭12桁（data 側に直書きされているものだけ更新）。
- asset-manifest.json は data ファイルのハッシュも含むので、画像差し替えと data 編集の後に再生成する。
- 生成物（compiled.js 等）は手で直さず build-and-check で作り直す。イラスト差し替えの前例は changelog のみ更新・告知なし。
