# ノーツの見た目を絵で見せる(ヘルプの表・おしゃべり)と、おしゃべりの知識(2026-10-21 開発部)

依頼: 窓口(社長)。「みゅあとおしゃべり」でノーツの見た目を聞くと、色を作って答えていた
(TAP を白っぽい丸・HELL の空のノーツを紫っぽい線・難易度やテーマで色が変わる)。「見た目とかちゃんとわかるようにしてほしい」。

## 画像(幅 320 / 390)

| 写し | 直す前 | 直したあと |
| --- | --- | --- |
| `*-help-notes-*` ヘルプ「ノーツの種類と取り方」 | 字だけの表 | 各行の見出しの上に、演奏画面と同じ描き方のノーツの絵 |
| `*-help-hell-*` ヘルプ「難易度 HELL と空のノーツ」 | 字だけの表 | 空の判定ライン・SKY TAP・SKY SLIDE(左手・右手)の絵 |
| `*-chat-notes-*` / `*-chat-hell-*` おしゃべりの答え | 絵なし | 答えに出たノーツの絵を吹き出しの下に並べる |
| `swatches-all.jpg` | — | 絵の全種類(13) |

- おしゃべりの写しの答えの文は、写しのために置いた見本の文(本物の答えではない)。直す前と後で同じ文を返している。違いは絵が出るかどうかだけ
- 本物の答えの前後は、この作業の環境から公開サイト(github.io)へつながらず、中継役は公開サイトからの呼び出ししか受け付けないので撮れていない。公開後に Claude アプリで確かめてもらう

## 作り

- `rhythmDrawNoteSwatch(ctx, kind, w, h)`(`monster-hero/data/rhythm-mode.js`、`RHYTHM_CANVAS_RENDERER.drawSwatch`)
  … 演奏画面と同じ関数(drawHead・drawBand・drawSlide・drawEndBar・drawGlassBox・drawSkySlideZ)を渡した canvas で呼ぶ。
  色は同じ表(`RHYTHM_NOTE_COLORS`・`RHYTHM_SKY_LOOK`)から取るので、演奏画面の見た目を変えると絵もそろう。種類は `RHYTHM_NOTE_SWATCH_KINDS`
- `RhythmNoteSwatch({kind, width, height})`(`src/parts/41-screen-ui.jsx`)… 上の関数で小さな canvas に描く部品
- ヘルプの表の行の3つ目 `{notes:[…]}` で、その行の絵を出す(`data/help.js`)
- おしゃべりは、答えの文に出たノーツの名前から絵を選ぶ(`rhythmNoteSwatchKindsInText`)。答えか直前の発言に「ノーツ」があるときだけ(「ボタンをタップ」では出ない)
- おしゃべりの知識(`assistant-chat-digest.json` の毎回渡す部分)に、ヘルプの2つの表をヘルプから機械で写し、「書いていない色・形・数字は作らず、ヘルプの項目を案内する」決まりを足した(`tools/build-assistant-chat-digest.js`)。中継役の出し直しは要らない

## 見張り

- `tools/assistant/assistant-chat-check.js` ㉓: 毎回渡す部分に表と決まりが入っている/答えに出たノーツの絵が順に並び、空でない/「ボタンをタップ」では出ない
